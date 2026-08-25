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

import { escapeHtml, formatDateShort, formatDuration, cattleSummaryTwoLine } from './format.js';
import { showToast, copyToClipboard } from './toast.js';
import { handleIdEntryLoop } from './ui-modals.js';
import { openCompareModal } from './ui-compare.js';
import * as StorageData from './storage-data.js';

let addRowOpen = false;
const compareSelection = new Map(); // id -> record snapshot, so the compare bar/modal work across tabs

export function renderTable(container, records, ctx) {
  const isCreated = ctx.state.statusTab === 'created';
  const showWorkingOn = ctx.state.statusTab === 'ready';
  const headCells = isCreated
    ? ['', 'Video', 'Cattle', 'Clips', 'Tags', 'Usage', 'Published', 'Added', '']
    : showWorkingOn
      ? ['', 'Video', 'Cattle', 'Clips', 'Status', 'Working On', 'Added', '']
      : ['', 'Video', 'Cattle', 'Clips', 'Status', 'Added', ''];
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
  tbody.innerHTML = records.map(r => (isCreated ? createdRowHtml(r, ctx) : readyRowHtml(r, ctx, showWorkingOn))).join('') + addRowHtml(colspan);

  wireRows(tbody, ctx);
  wireAddRow(tbody, ctx);
  paintCompareBar(ctx);
}

/* =============================================================
 * Compare mode — a checkbox on every row feeds a small floating
 * bar; picking 2–4 videos opens a side-by-side/stacked/grid
 * comparison so staff can decide which one to actually use.
 * ============================================================= */
function compareCheckboxCell(r) {
  return `<input type="checkbox" class="vm-compare-check" data-compare="${r.id}" ${compareSelection.has(r.id) ? 'checked' : ''} title="Select to compare" />`;
}

function paintCompareBar(ctx) {
  let bar = document.getElementById('vm-compare-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'vm-compare-bar';
    bar.className = 'vm-compare-bar';
    document.body.appendChild(bar);
  }
  if (compareSelection.size < 2) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `
    <span class="vm-compare-bar-count">${compareSelection.size} selected</span>
    <button class="btn btn-primary btn-sm" id="vm-compare-go" type="button">Compare</button>
    <button class="btn btn-ghost btn-sm" id="vm-compare-clear" type="button">Clear</button>
  `;
  bar.querySelector('#vm-compare-go').addEventListener('click', () => {
    openCompareModal([...compareSelection.values()], ctx);
  });
  bar.querySelector('#vm-compare-clear').addEventListener('click', () => {
    compareSelection.clear();
    ctx.refresh();
  });
}

/* =============================================================
 * Shared cell pieces
 * ============================================================= */

/* =============================================================
 * Exception highlighting — restrained: a small dot + tooltip on the
 * Video ID cell and a thin left-edge accent on the row, nothing
 * heavier. Healthy rows stay completely plain. `context` narrows
 * which flags surface as a dot on Ready/Hold rows, since the Status
 * column there already communicates "no clips"/"upload incomplete".
 * ============================================================= */
function rowExceptions(r, context) {
  const flags = [];
  if (r.isDuplicateId) flags.push({ label: 'Duplicate Video ID', severity: 'bad' });
  if (r.needsReview) flags.push({ label: 'Needs Review', severity: 'warn' });
  if (r.videoFormat === 'needs-redo') flags.push({ label: 'Needs Redo', severity: 'bad' });
  if (context === 'created') {
    if (!r.clips.length) flags.push({ label: 'No clips', severity: 'warn' });
    if (!r.youtubeUrl) flags.push({ label: 'Missing YouTube link', severity: 'bad' });
  }
  return flags;
}

function exceptionDot(r, context) {
  const flags = rowExceptions(r, context);
  if (!flags.length) return '';
  const worst = flags.some(f => f.severity === 'bad') ? 'bad' : 'warn';
  return `<span class="vm-exception-dot is-${worst}" title="${escapeHtml(flags.map(f => f.label).join(' · '))}"></span>`;
}

function rowExceptionClass(r, context) {
  const flags = rowExceptions(r, context);
  if (!flags.length) return '';
  return flags.some(f => f.severity === 'bad') ? 'has-exception is-bad-row' : 'has-exception';
}

/**
 * Merged identity cell — consignor name is the primary/scannable text,
 * Video ID is secondary underneath. Consignor is what staff actually
 * recognize a record by; the ID matters for lookups/copying but
 * shouldn't be the loudest thing in the row.
 */
function identityCell(r, context) {
  return `
    <div class="vm-identity-cell">
      <div class="vm-identity-primary">${exceptionDot(r, context)}${escapeHtml(r.consignorName)}</div>
      <div class="vm-identity-secondary">${escapeHtml(r.baseVideoId)}${r.suffix ? `<span class="suffix">-${r.suffix}</span>` : ''}</div>
    </div>`;
}

function cattleCell(r, ctx) {
  const sexLabel = ctx.ref.sexLabel(r.sexCode) || `Code ${r.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(r.sireCode) || `Code ${r.sireCode}`;
  const damLabel = ctx.ref.damLabel(r.damCode) || `Code ${r.damCode}`;
  const { line1, line2 } = cattleSummaryTwoLine({ sexLabel, sireLabel, damLabel, weight: r.weight, monthYear: r.monthYear });
  return `
    <div class="vm-cattle-cell" title="${escapeHtml(`${line1} · ${line2}`)}">
      <div class="vm-cattle-line1">${escapeHtml(line1)}</div>
      <div class="vm-cattle-line2">${escapeHtml(line2)}</div>
    </div>`;
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
  if (r.isDraft) return `<span class="vm-status-text is-bad">Upload Incomplete</span>`;
  if (!r.clips.length) return `<span class="vm-status-text is-warn">Waiting for Clips</span>`;
  return `<span class="vm-status-text is-ready">Ready to Build</span>`;
}

function hasTagsCell(r) {
  if (!r.hasTags) return '';
  return `<span class="format-pill format-legacy">Has Tags</span>`;
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
    return `<span class="vm-cell" data-editable="true" data-id="${r.id}" data-field="videoLink" tabindex="0" title="Not published yet — paste a YouTube link"><span class="is-empty is-unpublished">Paste YouTube link…</span></span>`;
  }
  return `
    <span class="yt-actions">
      <button class="btn btn-icon" data-open-yt="${r.id}" title="Open YouTube Video">▶</button>
      <button class="btn btn-icon" data-copy-link="${r.id}" title="Copy YouTube Link">⿻</button>
      <button class="btn btn-icon" data-copy-embed="${r.id}" title="Copy Embed Code">&lt;/&gt;</button>
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

function workingOnCell(r) {
  if (r.workingOn) {
    return `<button class="vm-workingon-chip is-claimed" data-workingon="${r.id}" type="button" title="Click to release">${escapeHtml(r.workingOn)}</button>`;
  }
  return `<button class="vm-workingon-chip" data-workingon="${r.id}" type="button">Claim</button>`;
}

/* =============================================================
 * Row rendering (two column sets)
 * ============================================================= */
function readyRowHtml(r, ctx, showWorkingOn) {
  return `
    <tr data-id="${r.id}" class="${rowExceptionClass(r, 'ready')}">
      <td class="vm-col-check">${compareCheckboxCell(r)}</td>
      <td>${identityCell(r, 'ready')}</td>
      <td>${cattleCell(r, ctx)}</td>
      <td>${clipsCell(r)}</td>
      <td>${statusIssueCell(r)}</td>
      ${showWorkingOn ? `<td>${workingOnCell(r)}</td>` : ''}
      <td>${formatDateShort(r.dateAdded)}</td>
      <td>${actionCell(r)}</td>
    </tr>`;
}

function createdRowHtml(r, ctx) {
  return `
    <tr data-id="${r.id}" class="${rowExceptionClass(r, 'created')}">
      <td class="vm-col-check">${compareCheckboxCell(r)}</td>
      <td>${identityCell(r, 'created')}</td>
      <td>${cattleCell(r, ctx)}</td>
      <td>${clipsCell(r)}</td>
      <td>${hasTagsCell(r)}</td>
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
    const compareCheck = e.target.closest('[data-compare]');
    if (compareCheck) {
      e.stopPropagation();
      const id = compareCheck.dataset.compare;
      if (compareCheck.checked) {
        const rec = await ctx.repo.getVideoById(id);
        compareSelection.set(id, rec);
      } else {
        compareSelection.delete(id);
      }
      paintCompareBar(ctx);
      return;
    }

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
      await copyToClipboard(rec.embedCode);
      showToast('Copied');
      return;
    }

    const openYtBtn = e.target.closest('[data-open-yt]');
    if (openYtBtn) {
      const rec = await ctx.repo.getVideoById(openYtBtn.dataset.openYt);
      window.open(rec.youtubeUrl, '_blank', 'noopener');
      return;
    }

    const workingOnBtn = e.target.closest('[data-workingon]');
    if (workingOnBtn) {
      const rec = await ctx.repo.getVideoById(workingOnBtn.dataset.workingon);
      if (rec.workingOn) {
        await ctx.repo.clearWorkingOn(rec.id, 'Staff');
        showToast('Released');
        ctx.refresh();
      } else {
        openStaffPopover(workingOnBtn, rec, ctx);
      }
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

/* =============================================================
 * Working On — staff picker popover, click "Claim" to open
 * ============================================================= */
function closeStaffPopover() {
  const existing = document.getElementById('vm-active-staff-popover');
  if (existing) {
    if (existing._cleanup) existing._cleanup();
    existing.remove();
  }
}

function openStaffPopover(anchorEl, rec, ctx) {
  closeStaffPopover();
  const staff = ctx.ref.getStaffList();
  const rect = anchorEl.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = 'vm-popover vm-popover-narrow';
  pop.id = 'vm-active-staff-popover';
  const width = 180;
  pop.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 200)}px`;
  pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  pop.innerHTML = `
    <div class="vm-popover-title">Who's building this?</div>
    ${staff.map(s => `<button class="vm-popover-staff-option" data-claim-staff="${escapeHtml(s.name)}" type="button">${escapeHtml(s.name)}</button>`).join('')}
  `;
  document.body.appendChild(pop);

  pop.querySelectorAll('[data-claim-staff]').forEach(btn => btn.addEventListener('click', async () => {
    await ctx.repo.setWorkingOn(rec.id, btn.dataset.claimStaff, 'Staff');
    showToast(`${btn.dataset.claimStaff} is building this now`);
    closeStaffPopover();
    ctx.refresh();
  }));

  function outsideHandler(e) { if (!pop.contains(e.target) && e.target !== anchorEl) closeStaffPopover(); }
  function escHandler(e) { if (e.key === 'Escape') closeStaffPopover(); }
  setTimeout(() => document.addEventListener('click', outsideHandler), 0);
  document.addEventListener('keydown', escHandler);
  pop._cleanup = () => {
    document.removeEventListener('click', outsideHandler);
    document.removeEventListener('keydown', escHandler);
  };
}

function previewClip(clip) {
  if (!clip || !clip.downloadUrl) { showToast('This clip has no file to preview yet'); return; }
  window.open(clip.downloadUrl, '_blank', 'noopener');
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
    const files = [...input.files];
    if (!files.length) return;
    showToast(`Uploading ${files.length} clip${files.length === 1 ? '' : 's'}…`);
    const clips = [];
    for (const file of files) {
      try {
        const result = await StorageData.uploadClip(id, file);
        clips.push({
          id: 'clip_' + Math.random().toString(36).slice(2, 10),
          filename: file.name,
          swatch: Math.floor(Math.random() * 8),
          durationSec: null,
          sizeBytes: file.size,
          uploader: 'Staff',
          uploadedAt: new Date().toISOString(),
          isOriginal: true,
          storagePath: result.storagePath,
          downloadUrl: result.downloadUrl,
        });
      } catch (err) {
        showToast(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
    if (!clips.length) return;
    await ctx.repo.addClips(id, clips, 'Staff');
    showToast(`${clips.length} clip(s) added`);
    ctx.refresh();
  });
  input.click();
}

async function downloadAll(id, ctx) {
  const rec = await ctx.repo.getVideoById(id);
  const real = rec.clips.filter(c => c.downloadUrl);
  if (!real.length) {
    showToast('No files to download yet');
    return;
  }
  real.forEach(c => window.open(c.downloadUrl, '_blank', 'noopener'));
}
