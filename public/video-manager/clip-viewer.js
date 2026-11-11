/* =============================================================
 * Clip viewer — first-frame posters + full-size player
 * -------------------------------------------------------------
 * Posters: each clip card shows its real first frame. Grabbed lazily
 * (only once a card scrolls into view, max 2 at a time) by loading the
 * clip with preload="metadata", seeking a hair past 0, and drawing that
 * frame to a small canvas. The browser only range-requests the bytes it
 * needs for that one frame, not the whole clip. The resulting JPEG is
 * cached in memory + IndexedDB per clip, so reopening a lot is instant
 * and doesn't touch Storage again. The bucket allows CORS GET from any
 * origin (docs/storage-cors.json), which is what lets the canvas read
 * the frame; if that ever fails, the card falls back to showing the
 * paused <video> itself as the poster.
 *
 * Player: a full-screen lightbox over the drawer. Big video, prev/next
 * through every clip in the lot, a thumbnail strip, playback speed,
 * frame stepping, loop, and Download. Keyboard: ←/→ clip, Space play/
 * pause, , and . step one frame, J/L ±5s, Esc close.
 * ============================================================= */

import { escapeHtml, formatDuration, formatBytes, formatDate } from './format.js';

const POSTER_W = 480;
const memCache = new Map(); // clipId -> dataURL | 'video' (CORS fallback) | 'error'
const durationCache = new Map(); // clipId -> seconds

/* ---------- IndexedDB poster cache (best-effort; private mode etc. just skips it) ---------- */
let dbPromise = null;
function idb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open('vm-clip-posters', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('posters');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbPromise;
}
async function idbGet(key) {
  const db = await idb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const r = db.transaction('posters').objectStore('posters').get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function idbSet(key, val) {
  const db = await idb();
  if (!db) return;
  try { db.transaction('posters', 'readwrite').objectStore('posters').put(val, key); } catch { /* ignore */ }
}

/* ---------- frame grab, 2 at a time ---------- */
let active = 0;
const queue = [];
function schedule(task) {
  return new Promise((resolve) => {
    queue.push({ task, resolve });
    pump();
  });
}
function pump() {
  while (active < 2 && queue.length) {
    const { task, resolve } = queue.shift();
    active++;
    task().then(resolve, () => resolve(null)).finally(() => { active--; pump(); });
  }
}

function grabFirstFrame(url) {
  return new Promise(resolve => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      v.removeAttribute('src');
      try { v.load(); } catch { /* ignore */ }
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), 20000);
    v.addEventListener('loadedmetadata', () => {
      // A hair past 0: some encoders put a black/blank frame at exactly 0.
      try { v.currentTime = Math.min(0.1, (v.duration || 1) / 10); } catch { finish(null); }
    }, { once: true });
    v.addEventListener('seeked', () => {
      try {
        const w = v.videoWidth, h = v.videoHeight;
        if (!w || !h) { finish({ duration: v.duration, dataUrl: null }); return; }
        const scale = Math.min(1, POSTER_W / w);
        const c = document.createElement('canvas');
        c.width = Math.round(w * scale);
        c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        finish({ duration: v.duration, dataUrl: c.toDataURL('image/jpeg', 0.72) });
      } catch {
        // Canvas tainted (CORS) — caller falls back to a <video> poster.
        finish({ duration: v.duration, dataUrl: null, tainted: true });
      }
    }, { once: true });
    v.addEventListener('error', () => finish(null), { once: true });
    v.src = url;
  });
}

async function posterFor(clip) {
  if (memCache.has(clip.id)) return memCache.get(clip.id);
  const stored = await idbGet(clip.id);
  if (stored && stored.dataUrl) {
    memCache.set(clip.id, stored.dataUrl);
    if (stored.duration) durationCache.set(clip.id, stored.duration);
    return stored.dataUrl;
  }
  const res = await schedule(() => grabFirstFrame(clip.downloadUrl));
  if (res && Number.isFinite(res.duration)) durationCache.set(clip.id, res.duration);
  // Anything short of a captured frame (CORS hiccup, timeout, codec the
  // canvas path can't read) falls back to the paused <video> as poster —
  // it still shows the first frame in practice, and its own error
  // handler (paintPoster) shows "Couldn't load preview" if that fails too.
  let val = 'video';
  if (res && res.dataUrl) {
    val = res.dataUrl;
    idbSet(clip.id, { dataUrl: res.dataUrl, duration: res.duration || null });
  }
  memCache.set(clip.id, val);
  return val;
}

/** Known duration for a clip — stored value first, else whatever the poster grab measured. */
export function clipDuration(clip) {
  return clip.durationSec || durationCache.get(clip.id) || null;
}

function paintPoster(el, clip, val) {
  if (!el.isConnected) return;
  if (val === 'error') {
    el.innerHTML = `<div class="vm-clip-thumb-empty vm-clip-thumb-error">Couldn't load preview</div>`;
  } else if (val === 'video') {
    el.innerHTML = `<video muted playsinline preload="metadata" src="${escapeHtml(clip.downloadUrl)}#t=0.1"></video>`;
    el.querySelector('video').addEventListener('error', () => {
      el.innerHTML = `<div class="vm-clip-thumb-empty vm-clip-thumb-error">Couldn't load preview</div>`;
    }, { once: true });
  } else {
    el.innerHTML = `<img alt="" src="${val}" />`;
  }
  el.classList.remove('is-loading');
  const durEl = el.closest('[data-clip-card]')?.querySelector('[data-clip-dur]');
  const d = clipDuration(clip);
  if (durEl && d) { durEl.textContent = formatDuration(Math.round(d)); durEl.hidden = false; }
}

/**
 * Fill every [data-poster-clip] inside `root` with that clip's first
 * frame, lazily as each scrolls into view.
 */
export function hydrateClipPosters(root, clips) {
  const byId = new Map(clips.map(c => [c.id, c]));
  const els = [...root.querySelectorAll('[data-poster-clip]')];
  const load = (el) => {
    const clip = byId.get(el.dataset.posterClip);
    if (!clip || !clip.downloadUrl) return;
    if (memCache.has(clip.id)) { paintPoster(el, clip, memCache.get(clip.id)); return; }
    posterFor(clip).then(val => paintPoster(el, clip, val));
  };
  if (!('IntersectionObserver' in window)) { els.forEach(load); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      load(e.target);
    });
  }, { rootMargin: '200px' });
  els.forEach(el => {
    // Already cached: paint synchronously so there's no flash on re-render.
    const clip = byId.get(el.dataset.posterClip);
    if (clip && memCache.has(clip.id)) paintPoster(el, clip, memCache.get(clip.id));
    else io.observe(el);
  });
}

/* =============================================================
 * Full-size player
 * ============================================================= */
const SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const FRAME = 1 / 30;

/**
 * @param clips       the lot's clips (only ones with a downloadUrl are shown)
 * @param startId     clip id to open on
 * @param opts.title  header text (the Video ID)
 * @param opts.onDownload(clip)
 */
export function openClipViewer(clips, startId, { title = '', onDownload } = {}) {
  const list = clips.filter(c => c.downloadUrl);
  if (!list.length) return;
  let idx = Math.max(0, list.findIndex(c => c.id === startId));
  let speed = 1;
  let loop = true;
  const previouslyFocused = document.activeElement;

  const el = document.createElement('div');
  el.className = 'vm-cv';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.tabIndex = -1;
  el.innerHTML = `
    <div class="vm-cv-top">
      <div class="vm-cv-title">
        <span class="mono">${escapeHtml(title)}</span>
        <span class="vm-cv-count" id="cv-count"></span>
      </div>
      <div class="vm-cv-top-actions">
        <button type="button" class="vm-cv-btn" id="cv-download" title="Download this clip">Download</button>
        <button type="button" class="vm-cv-icon" id="cv-close" title="Close (Esc)" aria-label="Close">&times;</button>
      </div>
    </div>
    <div class="vm-cv-stage">
      <button type="button" class="vm-cv-nav prev" id="cv-prev" title="Previous clip (←)" aria-label="Previous clip">
        <svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 3.5 6l4 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <video id="cv-video" controls playsinline></video>
      <button type="button" class="vm-cv-nav next" id="cv-next" title="Next clip (→)" aria-label="Next clip">
        <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8.5 6l-4 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="vm-cv-bar">
      <div class="vm-cv-meta" id="cv-meta"></div>
      <div class="vm-cv-controls">
        <button type="button" class="vm-cv-btn" id="cv-back" title="Back one frame (,)">‹ Frame</button>
        <button type="button" class="vm-cv-btn" id="cv-fwd" title="Forward one frame (.)">Frame ›</button>
        <div class="vm-cv-speeds" role="group" aria-label="Playback speed">
          ${SPEEDS.map(s => `<button type="button" data-speed="${s}">${s}×</button>`).join('')}
        </div>
        <button type="button" class="vm-cv-btn" id="cv-loop" aria-pressed="true" title="Loop clip">Loop</button>
      </div>
    </div>
    <div class="vm-cv-strip" id="cv-strip">
      ${list.map((c, i) => `
        <button type="button" class="vm-cv-thumb" data-cv-idx="${i}" title="Clip ${i + 1}">
          <span class="vm-cv-thumb-img is-loading" data-poster-clip="${escapeHtml(c.id)}"></span>
          <span class="vm-cv-thumb-n">${i + 1}</span>
        </button>`).join('')}
    </div>
  `;
  document.body.appendChild(el);
  document.documentElement.classList.add('vm-modal-open');
  hydrateClipPosters(el, list);

  const video = el.querySelector('#cv-video');

  function show(i) {
    idx = (i + list.length) % list.length;
    const c = list[idx];
    const poster = memCache.get(c.id);
    if (poster && poster.startsWith && poster.startsWith('data:')) video.poster = poster; else video.removeAttribute('poster');
    video.src = c.downloadUrl;
    video.loop = loop;
    video.playbackRate = speed;
    video.play().catch(() => { /* autoplay blocked — controls are there */ });
    el.querySelector('#cv-count').textContent = list.length > 1 ? `Clip ${idx + 1} of ${list.length}` : 'Clip 1';
    const d = clipDuration(c);
    el.querySelector('#cv-meta').innerHTML = [
      escapeHtml(c.filename || ''),
      d ? formatDuration(Math.round(d)) : '',
      c.sizeBytes ? formatBytes(c.sizeBytes) : '',
      c.uploadedAt ? formatDate(c.uploadedAt) : '',
    ].filter(Boolean).map(t => `<span>${t}</span>`).join('');
    el.querySelectorAll('[data-cv-idx]').forEach(b => {
      const on = Number(b.dataset.cvIdx) === idx;
      b.classList.toggle('active', on);
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    el.querySelector('#cv-prev').hidden = list.length < 2;
    el.querySelector('#cv-next').hidden = list.length < 2;
    el.querySelector('#cv-strip').hidden = list.length < 2;
  }
  function paintSpeed() {
    el.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('active', Number(b.dataset.speed) === speed));
  }
  function step(dir) {
    video.pause();
    video.currentTime = Math.max(0, Math.min((video.duration || 0), video.currentTime + dir * FRAME));
  }
  function close() {
    video.pause();
    video.removeAttribute('src');
    try { video.load(); } catch { /* ignore */ }
    document.removeEventListener('keydown', onKey, true);
    el.remove();
    if (!document.querySelector('.vm-modal-backdrop, .vm-cv')) document.documentElement.classList.remove('vm-modal-open');
    if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus();
  }
  function onKey(e) {
    if (e.target.matches && e.target.matches('input, textarea, select')) return;
    const k = e.key;
    let handled = true;
    if (k === 'Escape') close();
    else if (k === 'ArrowRight' && !e.shiftKey) show(idx + 1);
    else if (k === 'ArrowLeft' && !e.shiftKey) show(idx - 1);
    else if (k === ' ' || k === 'k' || k === 'K') { if (video.paused) video.play(); else video.pause(); }
    else if (k === ',') step(-1);
    else if (k === '.') step(1);
    else if (k === 'j' || k === 'J') video.currentTime = Math.max(0, video.currentTime - 5);
    else if (k === 'l' || k === 'L') video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }
  // Capture phase so the drawer's own key handling doesn't also react.
  document.addEventListener('keydown', onKey, true);

  el.querySelector('#cv-close').addEventListener('click', close);
  el.querySelector('#cv-prev').addEventListener('click', () => show(idx - 1));
  el.querySelector('#cv-next').addEventListener('click', () => show(idx + 1));
  el.querySelector('#cv-back').addEventListener('click', () => step(-1));
  el.querySelector('#cv-fwd').addEventListener('click', () => step(1));
  el.querySelector('#cv-download').addEventListener('click', () => onDownload && onDownload(list[idx]));
  el.querySelector('#cv-loop').addEventListener('click', e => {
    loop = !loop;
    video.loop = loop;
    e.currentTarget.setAttribute('aria-pressed', String(loop));
    e.currentTarget.classList.toggle('active', loop);
  });
  el.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    video.playbackRate = speed;
    paintSpeed();
  }));
  el.querySelectorAll('[data-cv-idx]').forEach(b => b.addEventListener('click', () => show(Number(b.dataset.cvIdx))));
  // Click the dark area around the video to close.
  el.querySelector('.vm-cv-stage').addEventListener('click', e => { if (e.target === e.currentTarget) close(); });
  video.addEventListener('loadedmetadata', () => {
    const c = list[idx];
    if (Number.isFinite(video.duration)) durationCache.set(c.id, video.duration);
  });
  // Swipe left/right on touch to change clips.
  let touchX = null;
  const stage = el.querySelector('.vm-cv-stage');
  stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60 && list.length > 1) show(idx + (dx < 0 ? 1 : -1));
  }, { passive: true });

  el.querySelector('#cv-loop').classList.add('active');
  paintSpeed();
  show(idx);
  el.focus();
}
