/* =============================================================
 * CMS Video Manager — Grid view
 * -------------------------------------------------------------
 * Visual video library. Preview priority: original cattle clip >
 * listing image > CMS placeholder. Never the YouTube thumbnail
 * (ours are just the CMS logo).
 * ============================================================= */

import { escapeHtml, sexShort } from './format.js';

export function renderGrid(container, records, ctx) {
  container.innerHTML = `<div class="vm-grid">${records.map(r => cardHtml(r, ctx)).join('')}</div>`;

  container.querySelectorAll('.vm-card').forEach(card => {
    card.addEventListener('click', () => ctx.openDrawer(card.dataset.id));
  });
}

function cardHtml(r, ctx) {
  const sexLabel = ctx.ref.sexLabel(r.sexCode) || `Code ${r.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(r.sireCode) || `Code ${r.sireCode}`;
  const damLabel = ctx.ref.damLabel(r.damCode) || `Code ${r.damCode}`;
  const originalClips = r.clips.filter(c => c.isOriginal);

  return `
    <div class="vm-card" data-id="${r.id}">
      ${previewHtml(r, originalClips)}
      <div class="vm-card-body">
        <div class="vm-card-id">${escapeHtml(r.videoId)}</div>
        <div class="vm-card-consignor">${escapeHtml(r.consignorName)}${r.needsReview ? '<span class="vm-new-badge">NEW</span>' : ''}</div>
        <div class="vm-card-meta-row">
          <span class="sex-chip sex-${r.sexCode}">${sexShort(sexLabel)}</span>
          <span class="vm-card-breed">${escapeHtml(sireLabel)} × ${escapeHtml(damLabel)}</span>
        </div>
        <div class="vm-card-foot">
          <span class="vm-card-clipcount">${originalClips.length} original clip${originalClips.length === 1 ? '' : 's'} · ${r.weight} lbs</span>
          <span class="status-pill status-${r.isDraft ? 'draft' : r.status}">${r.isDraft ? 'Draft' : r.status === 'ready' ? 'Ready' : r.status === 'hold' ? 'On Hold' : 'Created'}</span>
        </div>
      </div>
    </div>`;
}

function previewHtml(r, originalClips) {
  if (originalClips.length) {
    const c = originalClips[0];
    return `
      <div class="vm-card-preview has-clip clip-swatch-${c.swatch}">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <span class="src-tag">Clip Preview</span>
        ${r.youtubeId ? '<span class="yt-flag">YouTube ✓</span>' : ''}
      </div>`;
  }
  if (r.listingImageUrl) {
    return `
      <div class="vm-card-preview" style="background-image:url('${r.listingImageUrl}');background-size:cover;background-position:center;">
        <span class="src-tag">Listing Photo</span>
        ${r.youtubeId ? '<span class="yt-flag">YouTube ✓</span>' : ''}
      </div>`;
  }
  return `
    <div class="vm-card-preview">
      <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.4"/><path d="M17 10.5 22 8v8l-5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
      <span class="src-tag">No preview yet</span>
      ${r.youtubeId ? '<span class="yt-flag">YouTube ✓</span>' : ''}
    </div>`;
}
