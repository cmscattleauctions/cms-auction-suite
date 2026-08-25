/* =============================================================
 * CMS Video Manager — Grid view
 * -------------------------------------------------------------
 * Secondary to Table view — true 16:9 video-oriented cards, not
 * decorative. Preview priority: real YouTube thumbnail (Created
 * records with a YouTube link) > a captured frame from the first
 * source clip's Storage file > a neutral placeholder. Nothing is
 * ever fabricated — if neither is available, the placeholder is
 * what's shown.
 *
 * The frame capture reads the clip via a cross-origin <video>, which
 * only works for canvas capture if the Storage bucket's CORS config
 * allows this app's origin — Firebase Storage ships with no CORS
 * rules by default. If that's not configured, this silently falls
 * back to the placeholder (see the catch in getClipFrame) rather
 * than erroring; it's a progressive enhancement, not required for
 * clips to be viewable (the drawer/table preview & download both
 * work regardless, straight from downloadUrl).
 * ============================================================= */

import { escapeHtml, cattleSummaryLine } from './format.js';

const FORMAT_BADGE_CLASS = {
  clean: 'format-clean', 'legacy-tagged': 'format-legacy', 'needs-redo': 'format-redo', unknown: 'format-unknown',
};

const frameCache = new Map(); // clip.id -> data URL, so we don't re-capture on every refresh()

const PLACEHOLDER_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.4"/><path d="M17 10.5 22 8v8l-5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

export function renderGrid(container, records, ctx) {
  container.innerHTML = `<div class="vm-grid">${records.map(r => cardHtml(r, ctx)).join('')}</div>`;

  container.querySelectorAll('.vm-card').forEach(card => {
    card.addEventListener('click', () => ctx.openDrawer(card.dataset.id));
  });

  // YouTube's thumbnail CDN doesn't 404 for a nonexistent video id — it
  // serves a generic "unavailable" placeholder (always exactly 120x90,
  // vs. a real hqdefault thumbnail's 480x360), with an HTTP 200. So we
  // check both: a genuine load error, and the known dimensions of that
  // generic placeholder — either way, fall back to our own neutral icon
  // rather than showing YouTube's broken-looking gray box.
  container.querySelectorAll('[data-yt-thumb]').forEach(img => {
    const swap = () => {
      const preview = img.closest('.vm-card-preview');
      if (preview) { img.remove(); preview.insertAdjacentHTML('afterbegin', PLACEHOLDER_ICON); }
    };
    img.addEventListener('error', swap, { once: true });
    img.addEventListener('load', () => {
      if (img.naturalWidth === 120 && img.naturalHeight === 90) swap();
    }, { once: true });
  });

  // Progressive enhancement: capture a frame for cards with a real
  // uploaded clip and no YouTube thumbnail yet.
  records.forEach(r => {
    if (r.youtubeId) return;
    const clip = r.clips.find(c => c.isOriginal && c.downloadUrl);
    if (!clip) return;
    const img = container.querySelector(`[data-frame-target="${r.id}"]`);
    if (!img) return;
    getClipFrame(clip).then(dataUrl => {
      if (!dataUrl) return;
      img.previousElementSibling?.remove();
      img.src = dataUrl;
      img.style.display = '';
    });
  });
}

function cardHtml(r, ctx) {
  const sexLabel = ctx.ref.sexLabel(r.sexCode) || `Code ${r.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(r.sireCode) || `Code ${r.sireCode}`;
  const damLabel = ctx.ref.damLabel(r.damCode) || `Code ${r.damCode}`;
  const originalClips = r.clips.filter(c => c.isOriginal);
  const formatMeta = ctx.ref.videoFormatMeta(r.videoFormat);
  const cattle = cattleSummaryLine({ sexLabel, sireLabel, damLabel, weight: r.weight, monthYear: r.monthYear });

  return `
    <div class="vm-card" data-id="${r.id}">
      ${previewHtml(r, originalClips)}
      <div class="vm-card-body">
        <div class="vm-card-id">${escapeHtml(r.videoId)}${r.isDraft ? '<span class="vm-row-flag draft">Draft</span>' : ''}</div>
        <div class="vm-card-consignor">${escapeHtml(r.consignorName)}</div>
        <div class="vm-card-cattle">${escapeHtml(cattle)}</div>
        <div class="vm-card-foot">
          <span class="format-pill ${FORMAT_BADGE_CLASS[r.videoFormat] || ''}" title="${escapeHtml(formatMeta ? formatMeta.desc : '')}">${escapeHtml(formatMeta ? formatMeta.short : r.videoFormat)}</span>
        </div>
      </div>
    </div>`;
}

function previewHtml(r, originalClips) {
  const clipBadge = originalClips.length
    ? `<span class="vm-card-clipbadge">${originalClips.length} clip${originalClips.length === 1 ? '' : 's'}</span>`
    : '';

  if (r.youtubeId) {
    return `
      <div class="vm-card-preview">
        <img data-yt-thumb src="https://img.youtube.com/vi/${encodeURIComponent(r.youtubeId)}/hqdefault.jpg" alt="" />
        ${clipBadge}
      </div>`;
  }

  const frameClip = originalClips.find(c => c.downloadUrl);
  if (frameClip) {
    const cached = frameCache.get(frameClip.id);
    return `
      <div class="vm-card-preview">
        ${cached ? `<img src="${cached}" alt="" />` : PLACEHOLDER_ICON}
        ${cached ? '' : `<img data-frame-target="${r.id}" style="display:none;" alt="" />`}
        ${clipBadge}
      </div>`;
  }

  return `
    <div class="vm-card-preview">
      ${PLACEHOLDER_ICON}
      ${clipBadge}
    </div>`;
}

/** Lightweight client-side frame grab — one video load + one canvas draw, from the clip's real Storage URL. */
function getClipFrame(clip) {
  if (frameCache.has(clip.id)) return Promise.resolve(frameCache.get(clip.id));
  return new Promise(resolve => {
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.crossOrigin = 'anonymous'; // needed for canvas capture; requires CORS allowed on the Storage bucket
      video.src = clip.downloadUrl;
      video.addEventListener('loadedmetadata', () => { video.currentTime = Math.min(0.5, video.duration / 2 || 0); });
      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320; canvas.height = 180;
          canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          frameCache.set(clip.id, dataUrl);
          resolve(dataUrl);
        } catch { resolve(null); } // tainted canvas (no CORS on the bucket) — fall back to placeholder
      });
      video.addEventListener('error', () => resolve(null));
    } catch { resolve(null); }
  });
}
