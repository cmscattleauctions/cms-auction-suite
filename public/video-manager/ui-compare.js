/* =============================================================
 * CMS Video Manager — Compare mode
 * -------------------------------------------------------------
 * Side-by-side/stacked/grid comparison for deciding which of a
 * handful of candidate videos to actually use (e.g. two video
 * packages shot for the same cattle classification). Read-only —
 * "Use This Video" just opens that record's drawer to continue
 * work there; it doesn't move or delete the others.
 * ============================================================= */

import { escapeHtml, cattleSummaryLine } from './format.js';

let currentLayout = 'side-by-side'; // 'side-by-side' | 'stacked' | 'grid'

export function openCompareModal(records, ctx) {
  const root = document.getElementById('vm-modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'vm-modal-backdrop';
  backdrop.innerHTML = `<div class="vm-modal vm-modal-wide vm-compare-modal">${panelShellHtml(records.length)}</div>`;
  root.appendChild(backdrop);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  function close() { backdrop.remove(); }
  const modal = backdrop.querySelector('.vm-modal');

  function repaint() {
    modal.innerHTML = panelShellHtml(records.length);
    wire();
  }

  function wire() {
    modal.querySelector('.vm-modal-close').addEventListener('click', close);
    modal.querySelectorAll('[data-layout]').forEach(btn => btn.addEventListener('click', () => {
      currentLayout = btn.dataset.layout;
      repaint();
    }));
    modal.querySelectorAll('[data-use-video]').forEach(btn => btn.addEventListener('click', () => {
      close();
      ctx.openDrawer(btn.dataset.useVideo);
    }));
  }

  function panelShellHtml(count) {
    return `
      <div class="vm-modal-header">
        <div>
          <h2>Compare ${count} Videos</h2>
          <p class="field-hint">Pick the one you want to use — the rest stay untouched.</p>
        </div>
        <button class="vm-modal-close" type="button">&times;</button>
      </div>
      <div class="vm-compare-layout-toggle">
        <button type="button" class="vm-compare-layout-btn ${currentLayout === 'side-by-side' ? 'active' : ''}" data-layout="side-by-side">Side by Side</button>
        <button type="button" class="vm-compare-layout-btn ${currentLayout === 'stacked' ? 'active' : ''}" data-layout="stacked">Top / Bottom</button>
        <button type="button" class="vm-compare-layout-btn ${currentLayout === 'grid' ? 'active' : ''}" data-layout="grid">4 Corners</button>
      </div>
      <div class="vm-modal-body vm-compare-body">
        <div class="vm-compare-grid layout-${currentLayout}">
          ${records.map(r => panelHtml(r)).join('')}
        </div>
      </div>`;
  }

  function panelHtml(r) {
    const sexLabel = ctx.ref.sexLabel(r.sexCode) || `Code ${r.sexCode}`;
    const sireLabel = ctx.ref.sireLabel(r.sireCode) || `Code ${r.sireCode}`;
    const damLabel = ctx.ref.damLabel(r.damCode) || `Code ${r.damCode}`;
    const cattle = cattleSummaryLine({ sexLabel, sireLabel, damLabel, weight: r.weight, monthYear: r.monthYear });
    const formatMeta = ctx.ref.videoFormatMeta(r.videoFormat);
    const statusWord = r.status === 'created' ? 'Created' : r.status === 'hold' ? 'On Hold' : 'Ready to Make';

    return `
      <div class="vm-compare-panel">
        <div class="vm-compare-media">
          ${r.youtubeId
            ? `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(r.youtubeId)}" title="${escapeHtml(r.videoId)}" frameborder="0" allowfullscreen></iframe>`
            : `<div class="vm-compare-media-empty">No YouTube video yet${r.clips.length ? ` — ${r.clips.length} source clip${r.clips.length === 1 ? '' : 's'} uploaded` : ''}</div>`}
        </div>
        <div class="vm-compare-info">
          <div class="vm-compare-id">${escapeHtml(r.videoId)}</div>
          <div class="vm-compare-consignor">${escapeHtml(r.consignorName)}</div>
          <div class="vm-compare-cattle">${escapeHtml(cattle)}</div>
          <div class="vm-compare-badges">
            <span class="status-pill status-${r.status}">${statusWord}</span>
            <span class="format-pill ${{clean:'format-clean','legacy-tagged':'format-legacy','needs-redo':'format-redo',unknown:'format-unknown'}[r.videoFormat] || ''}">${escapeHtml(formatMeta ? formatMeta.short : r.videoFormat)}</span>
          </div>
          <button class="btn btn-primary btn-sm btn-block" data-use-video="${r.id}" type="button" style="margin-top:8px;">Use This Video</button>
        </div>
      </div>`;
  }

  wire();
}
