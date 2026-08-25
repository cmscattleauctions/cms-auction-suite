/* =============================================================
 * CMS Video Manager — Compare mode
 * -------------------------------------------------------------
 * Grid comparison for deciding which of a handful of candidate
 * videos to actually use (e.g. two video packages shot for the
 * same cattle classification). Always a responsive grid — as many
 * videos as were selected, wrapping and scrolling rather than
 * capping at a fixed count. Players autoplay (muted) via the same
 * embedUrl used everywhere else, so it's an actual side-by-side
 * watch, not just stills. Read-only — "Use This Video" just opens
 * that record's drawer to continue work there; it doesn't move or
 * delete the others.
 * ============================================================= */

import { escapeHtml, cattleSummaryLine } from './format.js';

export function openCompareModal(records, ctx) {
  let active = [...records]; // mutable — panels can be ruled out (closed) one at a time without leaving compare mode
  const root = document.getElementById('vm-modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'vm-modal-backdrop';
  backdrop.innerHTML = `<div class="vm-modal vm-compare-modal"></div>`;
  root.appendChild(backdrop);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  function close() { backdrop.remove(); }
  const modal = backdrop.querySelector('.vm-modal');

  function paint() {
    modal.innerHTML = panelShellHtml(active.length);
    modal.querySelector('.vm-modal-close').addEventListener('click', close);
    modal.querySelectorAll('[data-use-video]').forEach(btn => btn.addEventListener('click', () => {
      close();
      ctx.openDrawer(btn.dataset.useVideo);
    }));
    modal.querySelectorAll('[data-rule-out]').forEach(btn => btn.addEventListener('click', () => {
      active = active.filter(r => r.id !== btn.dataset.ruleOut);
      if (!active.length) { close(); return; }
      paint();
    }));
  }

  function panelShellHtml(count) {
    return `
      <div class="vm-modal-header">
        <div>
          <h2>Compare ${count} Video${count === 1 ? '' : 's'}</h2>
          <p class="field-hint">Pick the one you want to use, or close the ones you've ruled out — the rest stay untouched.</p>
        </div>
        <button class="vm-modal-close" type="button">&times;</button>
      </div>
      <div class="vm-modal-body vm-compare-body">
        <div class="vm-compare-grid">
          ${active.map(r => panelHtml(r)).join('')}
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
        <button class="vm-compare-rule-out" data-rule-out="${r.id}" type="button" title="Rule out — remove from comparison">&times;</button>
        <div class="vm-compare-media">
          ${r.embedUrl
            ? `<iframe src="${escapeHtml(r.embedUrl)}" title="${escapeHtml(r.videoId)}" frameborder="0" allow="autoplay" allowfullscreen></iframe>`
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

  paint();
}
