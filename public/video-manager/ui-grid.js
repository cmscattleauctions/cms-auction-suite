/* =============================================================
 * CMS Video Manager — Grid view
 * -------------------------------------------------------------
 * Secondary to Table view — true 16:9 video-oriented cards, not
 * decorative. Preview priority: real YouTube thumbnail (Created
 * records with a YouTube link) > a neutral placeholder. Nothing is
 * ever fabricated — if there's no YouTube link, the placeholder is
 * what's shown.
 *
 * Deliberately NOT captured here: a frame grabbed from the clip's own
 * Storage file. That used to happen automatically for every card with
 * an uploaded-but-unpublished clip — a hidden <video> per card, src
 * set to the real file, the browser buffering however much it needed
 * to reach the seek target — which meant just switching to Grid view
 * silently pulled real video bytes for every record on screen. That's
 * exactly the browsing-triggers-downloads pattern this app must not
 * have (original files load only on an explicit Download/Preview
 * click — see the drawer's Clips tab for that click-to-load pattern).
 * A YouTube thumbnail is a plain small image fetch, not the source
 * video, so that path is unaffected.
 * ============================================================= */

import { escapeHtml, cattleSummaryLine } from './format.js';

const FORMAT_BADGE_CLASS = {
  clean: 'format-clean', 'legacy-tagged': 'format-legacy', 'needs-redo': 'format-redo', unknown: 'format-unknown',
};

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
        ${r.videoFormat && r.videoFormat !== 'unknown' ? `
        <div class="vm-card-foot">
          <span class="format-pill ${FORMAT_BADGE_CLASS[r.videoFormat] || ''}" title="${escapeHtml(formatMeta ? formatMeta.desc : '')}">${escapeHtml(formatMeta ? formatMeta.short : r.videoFormat)}</span>
        </div>` : ''}
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

  return `
    <div class="vm-card-preview">
      ${PLACEHOLDER_ICON}
      ${clipBadge}
    </div>`;
}
