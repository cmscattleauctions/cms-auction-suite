/* =============================================================
 * CMS Video Manager — Table view
 * -------------------------------------------------------------
 * Fast, Monday/Excel-style operational view. Click a cell, type,
 * Tab/Shift+Tab/Enter to move, Escape to cancel. Video ID is
 * entered once (fast row) or corrected from the drawer — editing
 * it here would re-trigger the full collision workflow mid-row,
 * which is confusing, so this view keeps that in one place.
 * ============================================================= */

import { escapeHtml, formatDate, formatBytes, sexShort } from './format.js';
import { formatMonthYear } from './video-id.js';
import { showToast, copyToClipboard } from './toast.js';
import { handleIdEntryLoop } from './ui-modals.js';

const EDITABLE_FIELDS = ['weight', 'videoMaker', 'notes', 'videoLink'];

let addRowOpen = false;

export function renderTable(container, records, ctx) {
  container.innerHTML = `
    <div class="vm-table-wrap">
      <table class="vm-table">
        <thead><tr>
          <th>Video ID</th><th>Consignor</th><th>Sex</th><th>Sire Breed</th><th>Dam Breed</th>
          <th>Weight</th><th>Month/Year</th><th>Clips</th><th>Video Maker</th><th>Date Added</th>
          <th>Notes</th><th>Video Link</th><th>Embed Link</th><th>Format</th><th>Actions</th>
        </tr></thead>
        <tbody id="vm-table-body"></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector('#vm-table-body');
  tbody.innerHTML = records.map(r => rowHtml(r, ctx)).join('') + addRowHtml(ctx);

  wireRows(tbody, ctx);
  wireAddRow(tbody, ctx);
}

/* =============================================================
 * Row rendering
 * ============================================================= */
function rowHtml(r, ctx) {
  const sexLabel = ctx.ref.sexLabel(r.sexCode) || `Code ${r.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(r.sireCode) || `Code ${r.sireCode}`;
  const damLabel = ctx.ref.damLabel(r.damCode) || `Code ${r.damCode}`;

  return `
    <tr data-id="${r.id}">
      <td>
        <span class="vm-videoid-cell">${escapeHtml(r.baseVideoId)}${r.suffix ? `<span class="suffix">-${r.suffix}</span>` : ''}</span>
        ${r.isDraft ? '<div class="status-pill status-draft" style="margin-top:4px;">Draft</div>' : ''}
        ${r.needsReview ? '<div class="vm-new-badge">NEEDS REVIEW</div>' : ''}
      </td>
      <td>${escapeHtml(r.consignorName)}</td>
      <td><span class="sex-chip sex-${r.sexCode}">${sexShort(sexLabel)}</span></td>
      <td>${escapeHtml(sireLabel)}</td>
      <td>${escapeHtml(damLabel)}</td>
      <td>${editableCell(r, 'weight', `${r.weight} lbs`)}</td>
      <td>${escapeHtml(formatMonthYear(r.monthYear))}</td>
      <td>${clipsCell(r, ctx)}</td>
      <td>${r.status === 'created' ? editableCell(r, 'videoMaker', escapeHtml(r.videoMaker)) : `<span class="is-empty" title="Assigned once this video is moved to Created">—</span>`}</td>
      <td>${formatDate(r.dateAdded)}</td>
      <td class="vm-notes-cell" title="${r.notes ? escapeHtml(r.notes) : ''}">${editableCell(r, 'notes', r.notes ? escapeHtml(r.notes) : '', !r.notes)}</td>
      <td>${videoLinkCell(r)}</td>
      <td>${embedLinkCell(r)}</td>
      <td>${videoFormatCell(r, ctx)}</td>
      <td>${actionsCell(r)}</td>
    </tr>
  `;
}

const FORMAT_BADGE_CLASS = {
  clean: 'format-clean', 'legacy-tagged': 'format-legacy', 'needs-redo': 'format-redo', unknown: 'format-unknown',
};

function videoFormatCell(r, ctx) {
  const meta = ctx.ref.videoFormatMeta(r.videoFormat);
  const short = meta ? meta.short : r.videoFormat;
  const full = meta ? meta.desc : '';
  return `<span class="format-pill ${FORMAT_BADGE_CLASS[r.videoFormat] || ''}" title="${escapeHtml(full)}">${escapeHtml(short)}</span>`;
}

function editableCell(r, field, display, isEmpty = false) {
  return `<span class="vm-cell" data-editable="true" data-id="${r.id}" data-field="${field}" tabindex="0">${
    isEmpty ? '<span class="is-empty">—</span>' : (display || '<span class="is-empty">—</span>')
  }</span>`;
}

function clipsCell(r, ctx) {
  if (!r.clips.length) {
    return `<span class="clip-none">No clips</span> <button class="clip-download-btn" data-add-files="${r.id}" style="background:var(--surface-2);color:var(--text-dim)">+ Add Files</button>`;
  }
  const shown = r.clips.slice(0, 3);
  const extra = r.clips.length - shown.length;
  const thumbs = shown.map(c => `<span class="clip-thumb clip-swatch-${c.swatch}"><svg viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4V1z"/></svg></span>`).join('');
  return `
    <span class="clip-strip">
      ${thumbs}${extra > 0 ? `<span class="clip-more">+${extra}</span>` : ''}
      <span class="clip-count-label">${r.clips.length} Clip${r.clips.length === 1 ? '' : 's'}</span>
      <button class="clip-download-btn" data-download-all="${r.id}"><svg viewBox="0 0 12 12" fill="none"><path d="M6 1v7M3 5l3 3 3-3M2 10h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Download</button>
      <button class="clip-download-btn" data-add-files="${r.id}" style="background:var(--surface-2);color:var(--text-dim)">+</button>
    </span>`;
}

function videoLinkCell(r) {
  if (!r.youtubeUrl) {
    return `<span class="vm-cell" data-editable="true" data-id="${r.id}" data-field="videoLink" tabindex="0"><span class="is-empty">Paste YouTube link…</span></span>`;
  }
  return `
    <span class="yt-actions">
      <button class="btn btn-icon" data-copy-link="${r.id}" title="Copy video link"><svg viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M2.5 9.5V2.5A1 1 0 0 1 3.5 1.5h7" stroke="currentColor" stroke-width="1.3"/></svg></button>
      <button class="btn btn-icon" data-open-yt="${r.id}" title="Open YouTube"><svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" stroke-width="1.3"/><path d="M9 3h3v3M12 2 7.5 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button>
    </span>`;
}

function embedLinkCell(r) {
  if (!r.embedUrl) return `<span class="yt-none">—</span>`;
  return `<button class="btn btn-icon" data-copy-embed="${r.id}" title="Copy embed link"><svg viewBox="0 0 14 14" fill="none"><path d="M5 4 2 7l3 3M9 4l3 3-3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
}

function actionsCell(r) {
  const moves = [
    { s: 'ready', l: 'Ready' }, { s: 'hold', l: 'On Hold' }, { s: 'created', l: 'Created' },
  ].filter(m => m.s !== r.status);
  return `
    <span class="row-actions">
      <select class="btn btn-sm" data-move="${r.id}" style="width:auto;padding:5px 6px;">
        <option value="">Move…</option>
        ${moves.map(m => `<option value="${m.s}">${m.l}</option>`).join('')}
      </select>
      <button class="btn btn-sm" data-open-drawer="${r.id}">Open</button>
    </span>`;
}

/* =============================================================
 * ADD ROW — fast entry
 * ============================================================= */
function addRowHtml(ctx) {
  if (!addRowOpen) {
    return `<tr class="vm-addrow-row"><td colspan="15"><button class="vm-addrow-btn" id="vm-open-addrow" type="button">+ Add row</button></td></tr>`;
  }
  return `
    <tr class="vm-addrow-row">
      <td colspan="15">
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
 * Row interaction wiring (delegated)
 * ============================================================= */
function wireRows(tbody, ctx) {
  tbody.addEventListener('click', async e => {
    const editable = e.target.closest('.vm-cell[data-editable="true"]');
    if (editable && !editable.classList.contains('editing')) { startEdit(editable, ctx); return; }

    const addFilesBtn = e.target.closest('[data-add-files]');
    if (addFilesBtn) { pickFilesForRow(addFilesBtn.dataset.addFiles, ctx); return; }

    const downloadAllBtn = e.target.closest('[data-download-all]');
    if (downloadAllBtn) { downloadAll(downloadAllBtn.dataset.downloadAll, ctx); return; }

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
  });

  tbody.addEventListener('change', async e => {
    const moveSelect = e.target.closest('[data-move]');
    if (moveSelect && moveSelect.value) {
      await ctx.repo.setStatus(moveSelect.dataset.move, moveSelect.value, 'Staff');
      showToast('Status updated');
      ctx.refresh();
    }
  });
}

function startEdit(span, ctx) {
  const field = span.dataset.field;
  const id = span.dataset.id;
  const isTextarea = field === 'notes';
  const raw = span.textContent.trim() === '—' ? '' : span.textContent.trim();
  span.classList.add('editing');

  const input = document.createElement(isTextarea ? 'textarea' : 'input');
  input.className = 'vm-edit-input';
  input.value = field === 'weight' ? raw.replace(/[^\d.]/g, '') : raw === 'Paste YouTube link…' ? '' : raw;
  if (field === 'weight') input.type = 'number';
  input.style.cssText = 'width:100%;background:transparent;border:none;color:inherit;font:inherit;outline:none;';
  span.innerHTML = '';
  span.appendChild(input);
  input.focus();
  input.select();

  const finish = async (commit) => {
    span.classList.remove('editing');
    if (!commit) { renderTableSoft(ctx); return; }
    const value = input.value.trim();
    await applyFieldEdit(id, field, value, ctx);
    ctx.refresh();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !isTextarea) { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    if (e.key === 'Tab') { finish(true); } // allow default focus move after commit
  });
  input.addEventListener('blur', () => finish(true));
}

function renderTableSoft(ctx) { ctx.refresh(); }

async function applyFieldEdit(id, field, value, ctx) {
  if (field === 'weight') {
    const record = await ctx.repo.getVideoById(id);
    const weight = Number(value);
    if (!weight || weight === record.weight) return;
    const { collision } = await ctx.repo.setVideoIdFields(id, { ...record, weight }, 'Staff');
    if (collision) {
      showToast(`That weight would collide with ${collision.videoId} — kept previous weight`);
      return;
    }
    showToast(`Weight updated — Video ID is now ${record.baseVideoId ? '' : ''}${(await ctx.repo.getVideoById(id)).videoId}`);
    return;
  }
  if (field === 'videoMaker') return ctx.repo.updateVideo(id, { videoMaker: value }, 'Staff');
  if (field === 'notes') return ctx.repo.updateVideo(id, { notes: value }, 'Staff');
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
