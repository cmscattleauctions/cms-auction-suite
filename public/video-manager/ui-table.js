/* =============================================================
 * CMS Video Manager — Table view
 * -------------------------------------------------------------
 * Dense operational table — target ~32-34px rows so dozens of
 * records are scannable without scrolling. Ready/On Hold and
 * Created use different column sets because the workflow differs:
 * Ready/Hold cares about "is this record usable yet" (Status/
 * Issue); Created cares about "what's published and where it's
 * been used" (Source/Usage/Published). Cattle attributes (sex,
 * sire, dam, weight, month) are collapsed into one summary line —
 * editing them happens in the drawer, not per-cell here (see
 * ui-drawer.js's Cattle Information section).
 * ============================================================= */

import { escapeHtml, formatDateShort, formatDuration, cattleSummaryLine } from './format.js';
import { showToast, copyToClipboard } from './toast.js';
import { handleIdEntryLoop } from './ui-modals.js';

let addRowOpen = false;

export function renderTable(container, records, ctx) {
  const isCreated = ctx.state.statusTab === 'created';
  const headCells = isCreated
    ? ['Video ID', 'Consignor', 'Cattle', 'Clips', 'Source', 'Usage', 'Published', 'Added', '']
    : ['Video ID', 'Consignor', 'Cattle', 'Clips', 'Status', 'Added', ''];
  const colspan = headCells.length;

  container.innerHTML = `
    <div class="vm-table-wrap">
      <table class="vm-table">
        <thead><tr>${headCells.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody id="vm-table-body"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#vm-table-body');
  tbody.innerHTML = records.map(r => (isCreated ? createdRowHtml(r, ctx) : readyRowHtml(r, ctx))).join('') + addRowHtml(colspan);

  wireRows(tbody, ctx);
  wireAddRow(tbody, ctx);
}

/* =============================================================
 * Shared cell pieces
 * ============================================================= */
const FORMAT_BADGE_CLASS = {
  clean: 'format-clean', 'legacy-tagged': 'format-legacy', 'needs-redo': 'format-redo', unknown: 'format-unknown',
};

function videoIdCell(r) {
  return `
    <span class="vm-videoid-cell">${escapeHtml(r.baseVideoId)}${r.suffix ? `<span class="suffix">-${r.suffix}</span>` : ''}</span>
    <span class="vm-row-flags">
      ${r.isDraft ? '<span class="vm-row-flag draft">Draft</span>' : ''}
      ${r.needsReview ? '<span class="vm-row-flag review">Review</span>' : ''}
    </span>`;
}

function cattleCell(r, ctx) {
  const sexLabel = ctx.ref.sexLabel(r.sexCode) || `Code ${r.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(r.sireCode) || `Code ${r.sireCode}`;
  const damLabel = ctx.ref.damLabel(r.damCode) || `Code ${r.damCode}`;
  return `<span class="vm-cattle-cell">${escapeHtml(cattleSummaryLine({ sexLabel, sireLabel, damLabel, weight: r.weight, monthYear: r.monthYear }))}</span>`;
}

function clipsCell(r) {
  if (!r.clips.length) {
    return `<span class="vm-clips-none">No clips</span><button class="vm-clips-addlink" data-add-files="${r.id}" type="button">+ Add</button>`;
  }
  return `
    <button class="vm-clips-trigger" data-clips-trigger="${r.id}" type="button" title="View clips">
      <svg viewBox="0 0 24 24" fill="none"><path d="M4 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.6"/><path d="M17 10.5 22 8v8l-5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      ${r.clips.length} clip${r.clips.length === 1 ? '' : 's'}
    </button>`;
}

function statusIssueCell(r) {
  if (r.isDraft) return `<span class="vm-status-text is-bad">Upload incomplete</span>`;
  if (r.needsReview) return `<span class="vm-status-text is-warn">Needs Review</span>`;
  if (r.status === 'hold') return `<span class="vm-status-text">On Hold</span>`;
  return `<span class="vm-status-text is-ready">Ready</span>`;
}

function sourceCell(r, ctx) {
  const meta = ctx.ref.videoFormatMeta(r.videoFormat);
  const short = meta ? meta.short : r.videoFormat;
  const full = meta ? meta.desc : '';
  return `<span class="format-pill ${FORMAT_BADGE_CLASS[r.videoFormat] || ''}" title="${escapeHtml(full)}">${escapeHtml(short)}</span>`;
}

function usageCell(r) {
  if (!r.usage.length) return `<span class="vm-status-text">—</span>`;
  const sorted = [...r.usage].sort((a, b) => b.auctionDate.localeCompare(a.auctionDate));
  const latest = sorted[0];
  const lotLabel = latest.lots[0] + (latest.lots.length > 1 ? ` +${latest.lots.length - 1}` : '');
  const moreUses = r.usage.length > 1 ? ` +${r.usage.length - 1}` : '';
  return `<span class="vm-status-text">Lot ${escapeHtml(lotLabel)} · ${formatDateShort(latest.auctionDate)}${moreUses}</span>`;
}

function publishedCell(r) {
  if (!r.youtubeUrl) {
    return `<span class="vm-cell" data-editable="true" data-id="${r.id}" data-field="videoLink" tabindex="0"><span class="is-empty">Paste YouTube link…</span></span>`;
  }
  return `
    <span class="yt-actions">
      <button class="btn btn-icon" data-open-yt="${r.id}" title="Open YouTube"><svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" stroke-width="1.3"/><path d="M9 3h3v3M12 2 7.5 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
      <button class="btn btn-icon" data-copy-link="${r.id}" title="Copy video link"><svg viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 9.5V2.5A1 1 0 0 1 3.5 1.5h7" stroke="currentColor" stroke-width="1.3"/></svg></button>
      <button class="btn btn-icon" data-copy-embed="${r.id}" title="Copy embed link"><svg viewBox="0 0 14 14" fill="none"><path d="M5 4 2 7l3 3M9 4l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </span>`;
}

function editableCell(r, field, display, isEmpty = false) {
  return `<span class="vm-cell" data-editable="true" data-id="${r.id}" data-field="${field}" tabindex="0">${
    isEmpty ? '<span class="is-empty">—</span>' : (display || '<span class="is-empty">—</span>')
  }</span>`;
}

function actionCell(r) {
  return `<button class="vm-row-action" data-open-drawer="${r.id}" type="button">Open ›</button>`;
}

/* =============================================================
 * Row rendering (two column sets)
 * ============================================================= */
function readyRowHtml(r, ctx) {
  return `
    <tr data-id="${r.id}">
      <td>${videoIdCell(r)}</td>
      <td>${escapeHtml(r.consignorName)}</td>
      <td>${cattleCell(r, ctx)}</td>
      <td>${clipsCell(r)}</td>
      <td>${statusIssueCell(r)}</td>
      <td>${formatDateShort(r.dateAdded)}</td>
      <td>${actionCell(r)}</td>
    </tr>`;
}

function createdRowHtml(r, ctx) {
  return `
    <tr data-id="${r.id}">
      <td>${videoIdCell(r)}</td>
      <td>${escapeHtml(r.consignorName)}</td>
      <td>${cattleCell(r, ctx)}</td>
      <td>${clipsCell(r)}</td>
      <td>${sourceCell(r, ctx)}</td>
      <td>${usageCell(r)}</td>
      <td>${publishedCell(r)}</td>
      <td>${formatDateShort(r.dateAdded)}</td>
      <td>${actionCell(r)}</td>
    </tr>`;
}

/* =============================================================
 * ADD ROW — fast entry
 * ============================================================= */
function addRowHtml(colspan) {
  if (!addRowOpen) {
    return `<tr class="vm-addrow-row"><td colspan="${colspan}"><button class="vm-addrow-btn" id="vm-open-addrow" type="button">+ Add row</button></td></tr>`;
  }
  return `
    <tr class="vm-addrow-row">
      <td colspan="${colspan}">
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="text" id="vm-addrow-input" class="vm-videoid-input" placeholder="Type Video ID, e.g. 21.2.2.2.450.0826, then press Tab or Enter" autocomplete="off" />
          <button class="btn btn-sm btn-ghost" id="vm-close-addrow" type="button">Cancel</button>
        </div>
        <div id="vm-addrow-feedback" style="margin-top:6px;"></div>
      </td>
    </tr>`;
}

function wireAddRow(tbody, ctx) {
  const openBtn = tbody.querySelector('#vm-open-addrow');
  if (openBtn) openBtn.addEventListener('click', () => { addRowOpen = true; ctx.refresh(); });

  const closeBtn = tbody.querySelector('#vm-close-addrow');
  if (closeBtn) closeBtn.addEventListener('click', () => { addRowOpen = false; ctx.refresh(); });

  const input = tbody.querySelector('#vm-addrow-input');
  if (!input) return;
  input.focus();

  const commit = async () => {
    const raw = input.value.trim();
    if (!raw) return;
    const feedback = tbody.querySelector('#vm-addrow-feedback');
    const outcome = await handleIdEntryLoop(raw, ctx, feedback);
    if (!outcome) return;

    if (outcome.type === 'open') { addRowOpen = false; ctx.openDrawer(outcome.existing.id); return; }

    if (outcome.type === 'add-to-existing') {
      addRowOpen = false;
      showToast(`Opening ${outcome.existing.videoId} to add files`);
      ctx.openDrawer(outcome.existing.id);
      return;
    }

    let suffix = outcome.fields.suffix || null;
    if (outcome.type === 'create-separate') suffix = await ctx.repo.nextSuffixFor(outcome.baseId);

    const record = await ctx.repo.createVideo({
      ...outcome.fields, suffix, status: ctx.state.statusTab,
    }, 'Staff');
    showToast(`Created ${record.videoId}`);
    addRowOpen = false;
    ctx.refresh();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { addRowOpen = false; ctx.refresh(); }
  });
}

/* =============================================================
 * Row interaction wiring (delegated) — clicking anywhere on a row
 * not otherwise interactive opens the drawer.
 * ============================================================= */
function wireRows(tbody, ctx) {
  tbody.addEventListener('click', async e => {
    const clipsTrigger = e.target.closest('[data-clips-trigger]');
    if (clipsTrigger) {
      const rec = await ctx.repo.getVideoById(clipsTrigger.dataset.clipsTrigger);
      openClipsPopover(clipsTrigger, rec, ctx);
      return;
    }

    const editable = e.target.closest('.vm-cell[data-editable="true"]');
    if (editable && !editable.classList.contains('editing')) { startEdit(editable, ctx); return; }

    const addFilesBtn = e.target.closest('[data-add-files]');
    if (addFilesBtn) { pickFilesForRow(addFilesBtn.dataset.addFiles, ctx); return; }

    const copyLinkBtn = e.target.closest('[data-copy-link]');
    if (copyLinkBtn) {
      const rec = await ctx.repo.getVideoById(copyLinkBtn.dataset.copyLink);
      await copyToClipboard(rec.youtubeUrl);
      showToast('Copied');
      return;
    }

    const copyEmbedBtn = e.target.closest('[data-copy-embed]');
    if (copyEmbedBtn) {
      const rec = await ctx.repo.getVideoById(copyEmbedBtn.dataset.copyEmbed);
      await copyToClipboard(rec.embedUrl);
      showToast('Copied');
      return;
    }

    const openYtBtn = e.target.closest('[data-open-yt]');
    if (openYtBtn) {
      const rec = await ctx.repo.getVideoById(openYtBtn.dataset.openYt);
      window.open(rec.youtubeUrl, '_blank', 'noopener');
      return;
    }

    const openDrawerBtn = e.target.closest('[data-open-drawer]');
    if (openDrawerBtn) { ctx.openDrawer(openDrawerBtn.dataset.openDrawer); return; }

    // Fallback: click anywhere else on a data row opens the drawer.
    const tr = e.target.closest('tr[data-id]');
    if (tr) ctx.openDrawer(tr.dataset.id);
  });
}

function startEdit(span, ctx) {
  const field = span.dataset.field;
  const id = span.dataset.id;
  const raw = span.textContent.trim() === 'Paste YouTube link…' ? '' : span.textContent.trim();
  span.classList.add('editing');

  const input = document.createElement('input');
  input.className = 'vm-edit-input';
  input.value = raw;
  input.style.cssText = 'width:100%;background:transparent;border:none;color:inherit;font:inherit;outline:none;';
  span.innerHTML = '';
  span.appendChild(input);
  input.focus();
  input.select();

  const finish = async (commit) => {
    span.classList.remove('editing');
    if (!commit) { ctx.refresh(); return; }
    const value = input.value.trim();
    await applyFieldEdit(id, field, value, ctx);
    ctx.refresh();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key === 'Tab') { finish(true); }
  });
  input.addEventListener('blur', () => finish(true));
}

async function applyFieldEdit(id, field, value, ctx) {
  if (field === 'videoLink') {
    if (!value) return;
    const ytId = extractYoutubeId(value);
    if (!ytId) { showToast('Could not read a YouTube link from that'); return; }
    return ctx.repo.setYoutube(id, { youtubeUrl: value.startsWith('http') ? value : `https://youtu.be/${ytId}`, youtubeId: ytId }, 'Staff');
  }
}

function extractYoutubeId(link) {
  const m = link.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{5,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{5,}$/.test(link.trim())) return link.trim();
  return null;
}

/* =============================================================
 * Clips popover — click "N clips" to see the individual files
 * without leaving the table. Monochrome, no per-clip colored icons.
 * ============================================================= */
function closeClipsPopover() {
  const existing = document.getElementById('vm-active-popover');
  if (existing) {
    if (existing._cleanup) existing._cleanup();
    existing.remove();
  }
}

function openClipsPopover(anchorEl, rec, ctx) {
  closeClipsPopover();
  const rect = anchorEl.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'vm-popover';
  pop.id = 'vm-active-popover';
  const width = 300;
  pop.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 200)}px`;
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  pop.innerHTML = `
    <div class="vm-popover-title">${rec.clips.length} Source Clip${rec.clips.length === 1 ? '' : 's'}</div>
    ${rec.clips.map(c => `
      <div class="vm-popover-clip-row">
        <svg class="vm-popover-clip-icon" viewBox="0 0 24 24" fill="none"><path d="M4 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.6"/><path d="M17 10.5 22 8v8l-5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        <span class="vm-popover-clip-name">${escapeHtml(c.filename)}</span>
        <span class="vm-popover-clip-dur">${formatDuration(c.durationSec)}</span>
        <button class="vm-popover-play" data-play-clip="${c.id}" type="button" title="Preview"><svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 2l7 4-7 4V2z"/></svg></button>
      </div>
    `).join('')}
    <div class="vm-popover-footer"><button class="btn btn-sm btn-block" id="pop-download-all" type="button">Download All</button></div>
  `;
  document.body.appendChild(pop);

  pop.querySelector('#pop-download-all').addEventListener('click', () => downloadAll(rec.id, ctx));
  pop.querySelectorAll('[data-play-clip]').forEach(btn => btn.addEventListener('click', () => {
    const clip = rec.clips.find(c => c.id === btn.dataset.playClip);
    previewClip(clip);
  }));

  function outsideHandler(e) { if (!pop.contains(e.target) && e.target !== anchorEl) closeClipsPopover(); }
  function escHandler(e) { if (e.key === 'Escape') closeClipsPopover(); }
  setTimeout(() => document.addEventListener('click', outsideHandler), 0);
  document.addEventListener('keydown', escHandler);
  pop._cleanup = () => {
    document.removeEventListener('click', outsideHandler);
    document.removeEventListener('keydown', escHandler);
  };
}

function previewClip(clip) {
  if (!clip || !clip.fileHandle) { showToast('Mock data — original files aren’t wired to real storage in this prototype yet'); return; }
  const url = URL.createObjectURL(clip.fileHandle);
  window.open(url, '_blank', 'noopener');
}

/* =============================================================
 * Files: add + download
 * ============================================================= */
function pickFilesForRow(id, ctx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const clips = [...input.files].map(file => ({
      id: 'clip_' + Math.random().toString(36).slice(2, 10),
      filename: file.name,
      swatch: Math.floor(Math.random() * 8),
      durationSec: null,
      sizeBytes: file.size,
      uploader: 'Staff',
      uploadedAt: new Date().toISOString(),
      isOriginal: true,
      fileHandle: file,
    }));
    if (!clips.length) return;
    await ctx.repo.addClips(id, clips, 'Staff');
    showToast(`${clips.length} clip(s) added`);
    ctx.refresh();
  });
  input.click();
}

async function downloadAll(id, ctx) {
  const rec = await ctx.repo.getVideoById(id);
  const real = rec.clips.filter(c => c.fileHandle);
  if (!real.length) {
    showToast('Mock data — original files aren’t wired to real storage in this prototype yet');
    return;
  }
  real.forEach(c => {
    const url = URL.createObjectURL(c.fileHandle);
    const a = document.createElement('a');
    a.href = url; a.download = c.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
}
