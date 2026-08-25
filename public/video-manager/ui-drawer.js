/* =============================================================
 * CMS Video Manager — Right-side detail drawer
 * -------------------------------------------------------------
 * Two tabs: "Cattle & Video Details" (metadata + operational
 * controls) and "Clips" (dedicated media-management view). The
 * drawer is user-resizable (drag handle on the left edge, width
 * persisted for the session) and read-first throughout — static
 * info renders as a compact summary, with edit controls revealed
 * only on demand.
 *
 * IMPORTANT distinction: editing cattle info (consignor/sex/sire/
 * dam/weight/month) never silently changes the Video ID. Those are
 * two separate actions — see updateCattleFields() vs setVideoIdFields()
 * in repository.js. When the two diverge we show a warning and an
 * explicit opt-in "Update Video ID to match" action instead of
 * quietly reassigning an ID that may already be in use elsewhere.
 *
 * Note on scope: the old "Playback" (overlay-mode) section and, later,
 * the "Video Configuration / Source Quality" section were both removed
 * outright per feedback — videoFormat is still a real field (still
 * editable via the footer's Mark Needs Redo action and shown as a
 * small pill in the header summary), just without its own dedicated
 * editing section in the Details tab.
 * ============================================================= */

import { escapeHtml, formatDate, formatDateTime, formatDuration, formatBytes, sexShort, cattleSummaryLine, cleanYoutubeUrl } from './format.js';
import { formatMonthYear, buildBaseId, monthYearToInputValue, inputValueToMonthYear } from './video-id.js';
import { showToast, copyToClipboard } from './toast.js';
import { openDeleteConfirmModal } from './ui-modals.js';
import * as StorageData from './storage-data.js';

const FORMAT_BADGE_CLASS = { clean: 'format-clean', 'legacy-tagged': 'format-legacy', 'needs-redo': 'format-redo', unknown: 'format-unknown' };

/* Small identifying marks for each publishing surface — not the real
 * brand logos (those are trademarked assets we don't have rights to
 * ship), just enough visual distinction to scan the list at a glance. */
const PUB_ICONS = {
  youtube: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor"/><path d="M10 8.7v6.6l5.8-3.3-5.8-3.3Z" fill="#fff"/></svg>`,
  embed: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 6.5 3.5 12l5 5.5M15.5 6.5l5 5.5-5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  canva: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M8.3 12.2a3.7 3.7 0 0 1 6-2.9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="15.3" cy="12.2" r="1.3" fill="#fff"/></svg>`,
};

const WIDTH_KEY = 'vm-drawer-width';
const WIDTH_MIN = 380;
const WIDTH_MAX = 900;
const WIDTH_DEFAULT = 520;

function clampWidth(n) { return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, n)); }
function getStoredWidth() {
  const raw = Number(sessionStorage.getItem(WIDTH_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampWidth(raw) : WIDTH_DEFAULT;
}

let activeId = null;
let activeTab = 'details'; // 'details' | 'clips'
let editingCattleField = null;
let usageExpanded = false;
let activityExpanded = false;
let notesEditing = false;
let previewClipId = null;
let drawerWidth = getStoredWidth();

export async function openDrawer(id, ctx) {
  closeDrawer();
  activeId = id;
  activeTab = 'details';
  editingCattleField = null;
  usageExpanded = false;
  activityExpanded = false;
  notesEditing = false;
  previewClipId = null;
  await paint(ctx);
}

export function closeDrawer() {
  const root = document.getElementById('vm-drawer-root');
  if (root) root.innerHTML = '';
  activeId = null;
}

async function paint(ctx) {
  const rec = await ctx.repo.getVideoById(activeId);
  const root = document.getElementById('vm-drawer-root');
  if (!rec) { root.innerHTML = ''; return; }
  const prevBody = root.querySelector('#vm-drawer-tabbody');
  const prevScrollTop = prevBody ? prevBody.scrollTop : 0;

  const sexLabel = ctx.ref.sexLabel(rec.sexCode) || `Code ${rec.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(rec.sireCode) || `Code ${rec.sireCode}`;
  const damLabel = ctx.ref.damLabel(rec.damCode) || `Code ${rec.damCode}`;
  const formatMeta = ctx.ref.videoFormatMeta(rec.videoFormat);
  const cattleLine = cattleSummaryLine({ sexLabel, sireLabel, damLabel, weight: rec.weight, monthYear: rec.monthYear });

  root.innerHTML = `
    <div class="vm-drawer-backdrop" id="vm-drawer-backdrop"></div>
    <aside class="vm-drawer" id="vm-drawer-el" style="width:${drawerWidth}px;">
      <div class="vm-drawer-resize-handle" id="vm-drawer-resize" title="Drag to resize"></div>
      <div class="vm-drawer-header">
        <div class="vm-drawer-header-main">
          <div class="vm-drawer-title">${escapeHtml(rec.videoId)}</div>
          ${consignorHeaderHtml(rec)}
          <div class="vm-drawer-cattleline">${escapeHtml(cattleLine)}</div>
          <div class="vm-drawer-badges">
            <span class="status-pill status-${rec.isDraft ? 'draft' : rec.status}">${rec.isDraft ? 'Draft' : statusLabel(rec.status)}</span>
            ${rec.videoFormat && rec.videoFormat !== 'unknown' ? `<span class="format-pill ${FORMAT_BADGE_CLASS[rec.videoFormat] || ''}">${escapeHtml(formatMeta ? formatMeta.short : rec.videoFormat)}</span>` : ''}
            ${rec.hasTags ? `<span class="format-pill format-legacy">Has Tags</span>` : ''}
            ${rec.isDuplicateId ? `<span class="format-pill format-redo">Duplicate ID</span>` : ''}
          </div>
        </div>
        <div class="vm-drawer-header-actions">
          <button class="vm-drawer-nav-btn" id="vm-drawer-prev" type="button" title="Previous record" ${navState(ctx).hasPrev ? '' : 'disabled'}>
            <svg viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5 3.5 6l4 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="vm-drawer-nav-btn" id="vm-drawer-next" type="button" title="Next record" ${navState(ctx).hasNext ? '' : 'disabled'}>
            <svg viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5 8.5 6l-4 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="vm-drawer-close" id="vm-drawer-close">&times;</button>
        </div>
      </div>

      <div class="vm-drawer-tabs">
        <button class="vm-drawer-tab ${activeTab === 'details' ? 'active' : ''}" data-drawer-tab="details" type="button">Cattle &amp; Video Details</button>
        <button class="vm-drawer-tab ${activeTab === 'clips' ? 'active' : ''}" data-drawer-tab="clips" type="button">Clips <span class="n">${rec.clips.length}</span></button>
      </div>

      <div class="vm-drawer-tabbody scroll-thin" id="vm-drawer-tabbody">
        ${activeTab === 'details' ? detailsTabHtml(rec, ctx, sexLabel, sireLabel, damLabel) : clipsTabHtml(rec)}
      </div>

      ${footerHtml(rec)}
    </aside>
  `;

  const body = root.querySelector('#vm-drawer-tabbody');
  if (body) body.scrollTop = prevScrollTop;

  root.querySelector('#vm-drawer-close').addEventListener('click', closeDrawer);
  root.querySelector('#vm-drawer-backdrop').addEventListener('click', closeDrawer);
  root.querySelector('#vm-drawer-prev')?.addEventListener('click', () => navigateDrawer(-1, ctx));
  root.querySelector('#vm-drawer-next')?.addEventListener('click', () => navigateDrawer(1, ctx));
  root.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', async () => {
    await ctx.repo.setStatus(rec.id, btn.dataset.move, 'Staff');
    showToast('Status updated');
    ctx.refresh();
    paint(ctx);
  }));

  root.querySelectorAll('[data-drawer-tab]').forEach(btn => btn.addEventListener('click', () => {
    activeTab = btn.dataset.drawerTab;
    paint(ctx);
  }));

  wireResize(root);
  wireFooter(root, rec, ctx);
  // Always wired, not just on the details tab — the consignor click-to-edit
  // control lives in the header, which is visible on both tabs.
  wireCattleSection(root, rec, ctx);

  if (activeTab === 'details') {
    wireDuplicateBanner(root, rec, ctx);
    wireVideoMakerBanner(root, rec, ctx);
    wirePublishingSection(root, rec, ctx);
    wireHasTagsSection(root, rec, ctx);
    wireUsageSection(root, ctx);
    wireNotesSection(root, rec, ctx);
    wireActivitySection(root, ctx);
  } else {
    wireClipsTab(root, rec, ctx);
  }
}

function statusLabel(s) { return s === 'ready' ? 'Ready to Make' : s === 'hold' ? 'On Hold' : 'Created'; }

/** Where the currently-open record sits in the table's own filtered/sorted list — so Previous/Next step through what's actually on screen. */
function navState(ctx) {
  const list = ctx.getCurrentList ? ctx.getCurrentList() : [];
  const idx = list.findIndex(r => r.id === activeId);
  return { list, idx, hasPrev: idx > 0, hasNext: idx >= 0 && idx < list.length - 1 };
}

function navigateDrawer(delta, ctx) {
  const { list, idx } = navState(ctx);
  const next = list[idx + delta];
  if (next) ctx.openDrawer(next.id);
}

/* =============================================================
 * Resize — drag handle on the left edge, clamped, persisted for
 * the session via sessionStorage.
 * ============================================================= */
function wireResize(root) {
  const handle = root.querySelector('#vm-drawer-resize');
  const drawerEl = root.querySelector('#vm-drawer-el');
  if (!handle || !drawerEl) return;
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = drawerEl.getBoundingClientRect().width;
    document.body.classList.add('vm-resizing');
    function onMove(ev) {
      const next = clampWidth(startWidth + (startX - ev.clientX));
      drawerEl.style.width = next + 'px';
      drawerWidth = next;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('vm-resizing');
      sessionStorage.setItem(WIDTH_KEY, String(drawerWidth));
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/* =============================================================
 * CATTLE & VIDEO DETAILS TAB — assembly
 * ============================================================= */
function detailsTabHtml(rec, ctx, sexLabel, sireLabel, damLabel) {
  return `
    ${rec.isDuplicateId ? duplicateBannerHtml(rec) : ''}
    ${rec.status === 'created' ? videoMakerBannerHtml(rec) : ''}
    ${cattleSectionHtml(rec, ctx, sexLabel, sireLabel, damLabel)}
    ${rec.hasTags ? hasTagsSectionHtml(rec) : ''}
    ${publishingSectionHtml(rec)}
    ${usageSectionHtml(rec)}
    ${notesSectionHtml(rec)}
    ${activitySectionHtml(rec)}
    ${recordInfoSectionHtml(rec)}
    ${!rec.hasTags ? hasTagsSectionHtml(rec) : ''}
  `;
}

/* =============================================================
 * Duplicate Video ID banner — surfaced when a bulk import (or, in
 * theory, a race) lands two records on the same final id. Reuses
 * the same suffixing the live collision UI assigns at creation time.
 * ============================================================= */
function duplicateBannerHtml(rec) {
  return `
    <div class="vm-id-warning vm-id-warning-danger">
      <svg viewBox="0 0 20 20" fill="none"><path d="M10 2 1 17h18L10 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 8v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="14.5" r="0.9" fill="currentColor"/></svg>
      <div>
        This Video ID is used by more than one record.
        <button class="btn-text" id="dup-fix-btn" type="button">Assign next available suffix →</button>
      </div>
    </div>`;
}

function wireDuplicateBanner(root, rec, ctx) {
  const btn = root.querySelector('#dup-fix-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const suffix = await ctx.repo.nextSuffixFor(rec.baseVideoId);
    const fields = { consignorCode: rec.consignorCode, sexCode: rec.sexCode, sireCode: rec.sireCode, damCode: rec.damCode, weight: rec.weight, monthYear: rec.monthYear };
    await ctx.repo.setVideoIdFields(rec.id, fields, 'Staff', { forceSuffix: suffix });
    showToast('Video ID updated with suffix');
    ctx.refresh();
    paint(ctx);
  });
}

/* =============================================================
 * Video Maker — prominent on Created videos so it's obvious at a
 * glance who built this one.
 * ============================================================= */
function videoMakerBannerHtml(rec) {
  return `
    <div class="vm-videomaker-banner">
      <span class="k">Video Maker</span>
      <span class="v" id="d-videomaker-display">${escapeHtml(rec.videoMaker)}</span>
    </div>`;
}

function wireVideoMakerBanner(root, rec, ctx) {
  const display = root.querySelector('#d-videomaker-display');
  if (!display) return;
  const row = display.closest('.vm-videomaker-banner');
  row.addEventListener('click', () => {
    row.innerHTML = `<span class="k">Video Maker</span>`;
    const input = document.createElement('input');
    input.type = 'text'; input.value = rec.videoMaker; input.style.flex = '1'; input.style.marginLeft = '10px';
    row.appendChild(input);
    input.focus(); input.select();
    const commit = async () => {
      const val = input.value.trim();
      if (val && val !== rec.videoMaker) await ctx.repo.updateVideo(rec.id, { videoMaker: val }, 'Staff');
      ctx.refresh();
      paint(ctx);
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  });
}

/* =============================================================
 * Consignor — click-to-edit lives in the drawer header (shown on
 * both tabs) rather than repeated inside Cattle Information.
 * ============================================================= */
function consignorHeaderHtml(rec) {
  if (editingCattleField !== 'consignorCode') {
    return `<div class="vm-drawer-sub" data-cattle-field="consignorCode">${escapeHtml(rec.consignorName)}<span class="edit-hint" title="Edit"><svg viewBox="0 0 16 16" fill="none"><path d="M11 2.5 13.5 5 5.5 13 2 14l1-3.5L11 2.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></span></div>`;
  }
  return `
    <div class="vm-drawer-sub-editing" data-cattle-editing="consignorCode">
      <div class="vm-combo" id="cattle-consignor-combo" data-selected-code="${escapeHtml(rec.consignorCode)}">
        <input type="text" id="cattle-input-consignorCode" value="${escapeHtml(rec.consignorName)}" autocomplete="off" />
        <div class="vm-combo-list" id="cattle-consignor-list" hidden></div>
      </div>
      <div class="vm-fieldedit-actions">
        <button class="btn btn-xs btn-primary" data-cattle-save="consignorCode" type="button">Save</button>
        <button class="btn btn-xs btn-ghost" data-cattle-cancel type="button">Cancel</button>
      </div>
    </div>`;
}

/* =============================================================
 * CATTLE INFORMATION — compact two-column grid, click-to-edit.
 * Consignor lives in the drawer header now, not repeated here.
 * ============================================================= */
const CATTLE_FIELDS = [
  { key: 'sexCode', label: 'Sex', kind: 'select' },
  { key: 'weight', label: 'Weight', kind: 'number' },
  { key: 'sireCode', label: 'Sire', kind: 'select' },
  { key: 'damCode', label: 'Dam', kind: 'select' },
  { key: 'monthYear', label: 'Video Month', kind: 'monthyear', span: true },
];

function cattleDisplay(rec, key, sexLabel, sireLabel, damLabel) {
  if (key === 'sexCode') return sexShort(sexLabel);
  if (key === 'sireCode') return sireLabel;
  if (key === 'damCode') return damLabel;
  if (key === 'weight') return `${rec.weight} lb`;
  if (key === 'monthYear') return formatMonthYear(rec.monthYear);
  return '';
}

function cattleSectionHtml(rec, ctx, sexLabel, sireLabel, damLabel) {
  const computedBase = buildBaseId({
    consignorCode: rec.consignorCode, sexCode: rec.sexCode, sireCode: rec.sireCode,
    damCode: rec.damCode, weight: rec.weight, monthYear: rec.monthYear,
  });
  const idMismatch = computedBase !== rec.baseVideoId;

  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Cattle Information</div>
      <div class="vm-cattle-grid">
        ${CATTLE_FIELDS.map(f => cattleCellHtml(rec, ctx, f, sexLabel, sireLabel, damLabel)).join('')}
      </div>
      ${idMismatch ? `
        <div class="vm-id-warning">
          <svg viewBox="0 0 20 20" fill="none"><path d="M10 2 1 17h18L10 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 8v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="10" cy="14.5" r="0.9" fill="currentColor"/></svg>
          <div>
            Video ID reflects the original coding and will not change automatically.
            <button class="btn-text" id="cattle-update-id" type="button">Update Video ID to match →</button>
          </div>
        </div>
        <div id="cattle-id-collision-feedback"></div>
      ` : ''}
      ${rec.videoIdHistory.length ? `
        <div class="vm-drawer-section-title" style="margin-top:16px;">Previous Video IDs</div>
        ${rec.videoIdHistory.map(h => `<div class="vm-history-item">${escapeHtml(h.id)} — ${formatDate(h.changedAt)} (${escapeHtml(h.reason)})</div>`).join('')}
      ` : ''}
    </div>`;
}

function cattleCellHtml(rec, ctx, field, sexLabel, sireLabel, damLabel) {
  const spanClass = field.span ? ' is-span' : '';
  if (editingCattleField !== field.key) {
    return `
      <div class="vm-cattle-cell2${spanClass}" data-cattle-field="${field.key}">
        <span class="k">${field.label}</span>
        <span class="v">${escapeHtml(cattleDisplay(rec, field.key, sexLabel, sireLabel, damLabel))}</span>
      </div>`;
  }
  return `
    <div class="vm-cattle-cell2${spanClass} is-editing" data-cattle-editing="${field.key}">
      <span class="k">${field.label}</span>
      ${cattleControlHtml(rec, ctx, field)}
      <div class="vm-fieldedit-actions">
        <button class="btn btn-xs btn-primary" data-cattle-save="${field.key}" type="button">Save</button>
        <button class="btn btn-xs btn-ghost" data-cattle-cancel type="button">Cancel</button>
      </div>
    </div>`;
}

function cattleControlHtml(rec, ctx, field) {
  if (field.kind === 'select') {
    const options = field.key === 'sexCode' ? ctx.ref.getSexTypes() : field.key === 'sireCode' ? ctx.ref.getSireTypes() : ctx.ref.getDamTypes();
    return `<select id="cattle-input-${field.key}">${options.map(o => `<option value="${o.code}" ${o.code === rec[field.key] ? 'selected' : ''}>${escapeHtml(o.code)}- ${escapeHtml(o.label)}</option>`).join('')}</select>`;
  }
  if (field.kind === 'number') {
    return `<input type="number" id="cattle-input-${field.key}" value="${rec.weight}" />`;
  }
  return `<input type="month" id="cattle-input-${field.key}" value="${escapeHtml(monthYearToInputValue(rec.monthYear))}" />`;
}

function wireCattleSection(root, rec, ctx) {
  root.querySelectorAll('[data-cattle-field]').forEach(row => {
    row.addEventListener('click', () => { editingCattleField = row.dataset.cattleField; paint(ctx); });
  });
  const cancelEdit = () => { editingCattleField = null; paint(ctx); };
  root.querySelectorAll('[data-cattle-cancel]').forEach(btn => btn.addEventListener('click', cancelEdit));

  const editingRow = root.querySelector('[data-cattle-editing]');
  if (editingRow) {
    editingRow.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); root.querySelector('[data-cattle-save]')?.click(); }
        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      });
    });
    const firstControl = editingRow.querySelector('input, select');
    if (firstControl) { firstControl.focus(); if (firstControl.select) firstControl.select(); }
  }

  const combo = root.querySelector('#cattle-consignor-combo');
  if (combo) {
    const input = combo.querySelector('#cattle-input-consignorCode');
    const list = combo.querySelector('#cattle-consignor-list');
    const consignors = ctx.ref.getConsignors();
    function renderOptions(query) {
      const q = query.trim().toLowerCase();
      const matches = q ? consignors.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q)) : consignors;
      list.innerHTML = matches.length
        ? matches.slice(0, 30).map(c => `<button type="button" class="vm-combo-option" data-code="${escapeHtml(c.code)}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</button>`).join('')
        : `<div class="vm-combo-empty">No match</div>`;
      list.hidden = false;
      list.querySelectorAll('[data-code]').forEach(opt => opt.addEventListener('click', () => {
        const rec2 = consignors.find(c => c.code === opt.dataset.code);
        input.value = rec2.name;
        combo.dataset.selectedCode = rec2.code;
        list.hidden = true;
      }));
    }
    input.addEventListener('focus', () => renderOptions(input.value));
    input.addEventListener('input', () => renderOptions(input.value));
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  }

  root.querySelectorAll('[data-cattle-save]').forEach(btn => btn.addEventListener('click', async () => {
    const key = btn.dataset.cattleSave;
    let value;
    if (key === 'consignorCode') {
      const consignorInput = root.querySelector('#cattle-input-consignorCode');
      const selectedCode = combo ? combo.dataset.selectedCode : null;
      const match = ctx.ref.getConsignors().find(c => c.code === selectedCode);
      if (!match || match.name !== consignorInput.value.trim()) { showToast('Pick a consignor from the list'); return; }
      value = selectedCode;
    } else if (key === 'monthYear') {
      value = inputValueToMonthYear(root.querySelector(`#cattle-input-${key}`).value);
      if (!value) { showToast('Pick a month'); return; }
    } else {
      value = root.querySelector(`#cattle-input-${key}`).value.trim();
      if (!value) { showToast('This field can’t be empty'); return; }
    }
    const actions = btn.closest('.vm-fieldedit-actions');
    if (actions) actions.innerHTML = `<span class="vm-fieldedit-saving">Saving…</span>`;
    await ctx.repo.updateCattleFields(rec.id, { [key]: value }, 'Staff');
    showToast('Saved');
    editingCattleField = null;
    ctx.refresh();
    paint(ctx);
  }));

  const updateIdBtn = root.querySelector('#cattle-update-id');
  if (updateIdBtn) updateIdBtn.addEventListener('click', async () => {
    const fields = { consignorCode: rec.consignorCode, sexCode: rec.sexCode, sireCode: rec.sireCode, damCode: rec.damCode, weight: rec.weight, monthYear: rec.monthYear };
    const { collision } = await ctx.repo.setVideoIdFields(rec.id, fields, 'Staff');
    const feedback = root.querySelector('#cattle-id-collision-feedback');
    if (collision) {
      feedback.innerHTML = `
        <div class="vm-unrecognized-inline" style="align-items:flex-start;flex-direction:column;">
          <div>Video ID already exists: <strong>${escapeHtml(collision.videoId)}</strong> (${escapeHtml(collision.consignorName)})</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-sm" id="cattle-open-collision" type="button">Open Existing</button>
            <button class="btn btn-sm btn-primary" id="cattle-suffix-collision" type="button">Create Separate (assign suffix)</button>
          </div>
        </div>`;
      feedback.querySelector('#cattle-open-collision').addEventListener('click', () => { closeDrawer(); openDrawer(collision.id, ctx); });
      feedback.querySelector('#cattle-suffix-collision').addEventListener('click', async () => {
        const suffix = await ctx.repo.nextSuffixFor(buildBaseId(fields));
        await ctx.repo.setVideoIdFields(rec.id, fields, 'Staff', { forceSuffix: suffix });
        showToast('Video ID updated with suffix');
        ctx.refresh();
        paint(ctx);
      });
      return;
    }
    showToast('Video ID updated');
    ctx.refresh();
    paint(ctx);
  });
}

/* =============================================================
 * HAS TAGS — single checkbox; its section sits near Video
 * Configuration while checked, and relocates to the very bottom
 * of the tab once cleared (see detailsTabHtml()).
 * ============================================================= */
function hasTagsSectionHtml(rec) {
  return `
    <div class="vm-drawer-section">
      <div class="vm-hastags-panel">
        <div class="vm-hastags-icon">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 9.5 9.5 3H16a1 1 0 0 1 1 1v6.5l-6.5 6.5a1 1 0 0 1-1.4 0L3 10.9a1 1 0 0 1 0-1.4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12.5" cy="7.5" r="1" fill="currentColor"/></svg>
        </div>
        <div class="vm-hastags-text">
          <div class="vm-hastags-title">Has Tags</div>
          <div class="vm-hastags-desc">Baked-in program/certification graphics should be removed before this video is reused.</div>
        </div>
        <label class="switch"><input type="checkbox" id="d-hastags" ${rec.hasTags ? 'checked' : ''} /><span class="track"></span></label>
      </div>
    </div>`;
}

function wireHasTagsSection(root, rec, ctx) {
  const cb = root.querySelector('#d-hastags');
  if (cb) cb.addEventListener('change', async e => {
    await ctx.repo.setHasTags(rec.id, e.target.checked, 'Staff');
    ctx.refresh();
    paint(ctx);
  });
}

/* =============================================================
 * PUBLISHING — read-first. YouTube/Canva/Embed each show a
 * compact summary row; edit controls only appear once staff
 * explicitly asks for them (Replace Video / Add / Change).
 * ============================================================= */
function truncateMiddle(str, max = 44) {
  if (!str || str.length <= max) return str || '';
  const half = Math.floor((max - 1) / 2);
  return `${str.slice(0, half)}…${str.slice(str.length - half)}`;
}

function publishingSectionHtml(rec) {
  const ytUrl = cleanYoutubeUrl(rec);
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Publishing</div>
      ${rec.youtubeUrl ? `
        <div class="vm-pub-row">
          <span class="vm-pub-icon vm-pub-icon-youtube">${PUB_ICONS.youtube}</span>
          <div class="vm-pub-main">
            <div class="vm-pub-label">YouTube</div>
            <div class="vm-pub-value" title="${escapeHtml(ytUrl)}">${escapeHtml(truncateMiddle(ytUrl))}</div>
          </div>
          <div class="vm-pub-actions">
            <button class="btn-text" data-open-yt type="button">Open</button>
            <button class="btn-text" data-copy="url" type="button">Copy Link</button>
            <button class="btn-text" id="d-change-yt" type="button">Replace Video</button>
          </div>
        </div>
        <div id="d-change-yt-panel"></div>
        <div class="vm-pub-row">
          <span class="vm-pub-icon vm-pub-icon-embed">${PUB_ICONS.embed}</span>
          <div class="vm-pub-main">
            <div class="vm-pub-label">Embed</div>
            <div class="vm-pub-value" title="${escapeHtml(rec.embedUrl)}">${escapeHtml(truncateMiddle(rec.embedUrl))}</div>
          </div>
          <div class="vm-pub-actions">
            <button class="btn-text" data-open-embed type="button">Open</button>
            <button class="btn-text" data-copy="code" type="button">Copy Embed Code</button>
          </div>
        </div>
        ${canvaRowHtml(rec)}
        ${previousVersionsHtml(rec)}
      ` : `
        <div class="field" style="margin-top:2px;">
          <label><span class="vm-pub-icon vm-pub-icon-youtube vm-pub-icon-inline">${PUB_ICONS.youtube}</span>YouTube</label>
          <div class="vm-link-row"><input type="text" id="d-yt-input" placeholder="Paste YouTube link…" /><button class="btn btn-sm btn-primary" id="d-yt-save" type="button">Save</button></div>
        </div>
        ${canvaRowHtml(rec)}
      `}
    </div>`;
}

function canvaRowHtml(rec) {
  if (rec.canvaLink) {
    return `
      <div class="vm-pub-row">
        <span class="vm-pub-icon vm-pub-icon-canva">${PUB_ICONS.canva}</span>
        <div class="vm-pub-main">
          <div class="vm-pub-label">Canva Design</div>
          <div class="vm-pub-value" title="${escapeHtml(rec.canvaLink)}">${escapeHtml(truncateMiddle(rec.canvaLink))}</div>
        </div>
        <div class="vm-pub-actions">
          <button class="btn-text" id="d-canva-open" type="button">Open</button>
          <button class="btn-text" data-copy="canva" type="button">Copy</button>
          <button class="btn-text" id="d-canva-edit" type="button">Change</button>
        </div>
      </div>
      <div id="d-canva-edit-panel"></div>`;
  }
  // No link yet — always show an empty box (not hidden behind a click)
  // so it's obvious at a glance that this one still needs a Canva link.
  return `
    <div class="field" style="margin-top:2px;">
      <label><span class="vm-pub-icon vm-pub-icon-canva vm-pub-icon-inline">${PUB_ICONS.canva}</span>Canva Design</label>
      <div class="vm-link-row">
        <input type="text" id="d-canva-input" placeholder="Paste Canva design link…" />
        <button class="btn btn-sm btn-primary" id="d-canva-save" type="button">Save</button>
      </div>
    </div>`;
}

function previousVersionsHtml(rec) {
  if (!rec.previousYouTubeVideos.length) return '';
  return `
    <div class="vm-drawer-subsection-title" style="margin-top:14px;">Previous Versions</div>
    ${rec.previousYouTubeVideos.map(p => `
      <div class="vm-version-item">
        <div class="vm-version-date">${formatDate(p.replacedAt)}</div>
        <div class="vm-version-label">Previous YouTube version</div>
        ${p.reason ? `<div class="vm-version-reason">${escapeHtml(p.reason)}</div>` : ''}
        ${p.replacedBy ? `<div class="vm-version-meta">Replaced by ${escapeHtml(p.replacedBy)}</div>` : ''}
        <button class="btn-text" data-open-prev="${escapeHtml(p.url)}" type="button" style="margin-top:4px;">Open Previous Version →</button>
      </div>
    `).join('')}`;
}

function wirePublishingSection(root, rec, ctx) {
  root.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const map = { url: cleanYoutubeUrl(rec), code: rec.embedCode, canva: rec.canvaLink };
    await copyToClipboard(map[btn.dataset.copy]);
    showToast('Copied');
  }));
  const openYt = root.querySelector('[data-open-yt]');
  if (openYt) openYt.addEventListener('click', () => window.open(cleanYoutubeUrl(rec), '_blank', 'noopener'));
  const openEmbed = root.querySelector('[data-open-embed]');
  if (openEmbed) openEmbed.addEventListener('click', () => window.open(rec.embedUrl, '_blank', 'noopener'));
  root.querySelectorAll('[data-open-prev]').forEach(btn => btn.addEventListener('click', () => window.open(btn.dataset.openPrev, '_blank', 'noopener')));

  const openCanva = root.querySelector('#d-canva-open');
  if (openCanva) openCanva.addEventListener('click', () => window.open(rec.canvaLink, '_blank', 'noopener'));

  const canvaSaveBtn = root.querySelector('#d-canva-save');
  if (canvaSaveBtn) canvaSaveBtn.addEventListener('click', async () => {
    const val = root.querySelector('#d-canva-input').value.trim();
    if (!val) { showToast('Paste a Canva link first'); return; }
    await ctx.repo.updateVideo(rec.id, { canvaLink: val }, 'Staff');
    ctx.refresh();
    paint(ctx);
  });

  const canvaEditBtn = root.querySelector('#d-canva-edit');
  if (canvaEditBtn) canvaEditBtn.addEventListener('click', () => {
    const panel = root.querySelector('#d-canva-edit-panel');
    panel.innerHTML = `
      <div class="vm-link-row" style="margin-top:6px;">
        <input type="text" id="d-canva-edit-input" value="${escapeHtml(rec.canvaLink)}" />
        <button class="btn btn-sm btn-primary" id="d-canva-edit-save" type="button">Save</button>
        <button class="btn btn-sm btn-ghost" id="d-canva-edit-cancel" type="button">Cancel</button>
      </div>`;
    panel.querySelector('#d-canva-edit-cancel').addEventListener('click', () => panel.innerHTML = '');
    panel.querySelector('#d-canva-edit-save').addEventListener('click', async () => {
      const val = panel.querySelector('#d-canva-edit-input').value.trim();
      await ctx.repo.updateVideo(rec.id, { canvaLink: val || null }, 'Staff');
      showToast('Canva link updated');
      ctx.refresh();
      paint(ctx);
    });
  });

  const ytSave = root.querySelector('#d-yt-save');
  if (ytSave) ytSave.addEventListener('click', async () => {
    const val = root.querySelector('#d-yt-input').value.trim();
    const ytId = parseYoutubeLink(val);
    if (!ytId) { showToast('Could not read a YouTube link from that'); return; }
    await ctx.repo.setYoutube(rec.id, { youtubeUrl: val.startsWith('http') ? val : `https://youtu.be/${ytId}`, youtubeId: ytId }, 'Staff');
    ctx.refresh();
    paint(ctx);
  });

  const changeYtBtn = root.querySelector('#d-change-yt');
  if (changeYtBtn) changeYtBtn.addEventListener('click', () => {
    const panel = root.querySelector('#d-change-yt-panel');
    panel.innerHTML = `
      <div class="vm-link-row" style="margin-top:4px;">
        <input type="text" id="d-change-yt-input" placeholder="New YouTube link…" />
      </div>
      <div class="field"><input type="text" id="d-change-yt-reason" placeholder="Reason (optional) — e.g. rebuilt clean" /></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-sm btn-primary" id="d-change-yt-save" type="button">Save New Version</button>
        <button class="btn btn-sm btn-ghost" id="d-change-yt-cancel" type="button">Cancel</button>
      </div>
    `;
    panel.querySelector('#d-change-yt-cancel').addEventListener('click', () => panel.innerHTML = '');
    panel.querySelector('#d-change-yt-save').addEventListener('click', async () => {
      const val = panel.querySelector('#d-change-yt-input').value.trim();
      const reason = panel.querySelector('#d-change-yt-reason').value.trim();
      const ytId = parseYoutubeLink(val);
      if (!ytId) { showToast('Could not read a YouTube link from that'); return; }
      await ctx.repo.setYoutube(rec.id, { youtubeUrl: val.startsWith('http') ? val : `https://youtu.be/${ytId}`, youtubeId: ytId }, 'Staff', reason);
      showToast('New YouTube version saved — previous version kept in history');
      ctx.refresh();
      paint(ctx);
    });
  });
}

function parseYoutubeLink(val) {
  const m = val.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{5,})/);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{5,}$/.test(val) ? val : null);
}

/* =============================================================
 * USAGE — Current Usage (today or later) vs Usage History (past).
 * ============================================================= */
function usageRowHtml(u) {
  return `
    <div class="vm-usage-card">
      <div class="vm-usage-card-top">
        <span class="vm-usage-card-sale">${escapeHtml(u.auctionName)}</span>
        <span class="vm-usage-card-date">${formatDate(u.auctionDate)}</span>
      </div>
      <div class="vm-usage-card-lot">Lot${u.lots.length > 1 ? 's' : ''} ${u.lots.map(escapeHtml).join(', ')}</div>
    </div>`;
}

function usageSectionHtml(rec) {
  if (!rec.usage.length) return `<div class="vm-drawer-section"><div class="vm-drawer-section-title">Usage</div><p class="muted">Not used in any auctions yet.</p></div>`;
  const todayIso = new Date().toISOString().slice(0, 10);
  const sorted = [...rec.usage].sort((a, b) => b.auctionDate.localeCompare(a.auctionDate));
  const current = sorted.filter(u => u.auctionDate >= todayIso);
  const history = sorted.filter(u => u.auctionDate < todayIso);
  const shownHistory = usageExpanded ? history : history.slice(0, 3);
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Usage</div>
      ${current.length ? `
        <div class="vm-drawer-subsection-title">Current Usage</div>
        ${current.map(usageRowHtml).join('')}
      ` : ''}
      ${history.length ? `
        <div class="vm-drawer-subsection-title" style="margin-top:${current.length ? '12px' : '0'};">Usage History</div>
        ${shownHistory.map(usageRowHtml).join('')}
        ${history.length > 3 ? `<button class="btn-text" id="d-usage-toggle" type="button" style="margin-top:6px;font-size:12px;">${usageExpanded ? 'Show less' : `View all usage (${history.length})`}</button>` : ''}
      ` : ''}
    </div>`;
}

function wireUsageSection(root, ctx) {
  const toggle = root.querySelector('#d-usage-toggle');
  if (toggle) toggle.addEventListener('click', () => { usageExpanded = !usageExpanded; paint(ctx); });
}

/* =============================================================
 * NOTES — read-first; Edit reveals the textarea. Save behavior is
 * unchanged (autosave on blur), just gated behind Edit now.
 * ============================================================= */
function notesSectionHtml(rec) {
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Notes</div>
      ${notesEditing ? `
        <textarea id="d-notes" rows="4">${escapeHtml(rec.notes)}</textarea>
      ` : rec.notes ? `
        <p class="vm-notes-text">${escapeHtml(rec.notes)}</p>
        <button class="btn-text" id="d-notes-edit" type="button">Edit</button>
      ` : `
        <p class="muted">No notes yet.</p>
        <button class="btn-text" id="d-notes-edit" type="button">+ Add notes</button>
      `}
    </div>`;
}

function wireNotesSection(root, rec, ctx) {
  const editBtn = root.querySelector('#d-notes-edit');
  if (editBtn) editBtn.addEventListener('click', () => { notesEditing = true; paint(ctx); });

  const textarea = root.querySelector('#d-notes');
  if (textarea) {
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.addEventListener('blur', async e => {
      await ctx.repo.updateVideo(rec.id, { notes: e.target.value.trim() }, 'Staff');
      notesEditing = false;
      ctx.refresh();
      paint(ctx);
    });
    textarea.addEventListener('keydown', e => { if (e.key === 'Escape') { notesEditing = false; paint(ctx); } });
  }
}

/* =============================================================
 * ACTIVITY — collapsed to a one-line summary by default.
 * ============================================================= */
function activityItemHtml(a) {
  return `
    <div class="vm-activity-item">
      <span class="vm-activity-dot"></span>
      <div>
        <div class="vm-activity-msg">${escapeHtml(a.message)}</div>
        <div class="vm-activity-meta">${escapeHtml(a.actor)} · ${formatDateTime(a.ts)}</div>
      </div>
    </div>`;
}

function activitySectionHtml(rec) {
  if (!rec.activity.length) return '';
  const sorted = [...rec.activity].sort((a, b) => b.ts.localeCompare(a.ts));
  if (!activityExpanded) {
    const latest = sorted[0];
    return `
      <div class="vm-drawer-section">
        <div class="vm-drawer-section-title">Activity <span>${sorted.length}</span></div>
        <div class="vm-activity-latest">Latest: ${escapeHtml(latest.message)} · ${formatDate(latest.ts)}</div>
        <button class="btn-text" id="d-activity-toggle" type="button" style="margin-top:8px;font-size:12px;">View Activity</button>
      </div>`;
  }
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Activity <span>${sorted.length}</span></div>
      ${sorted.map(activityItemHtml).join('')}
      <button class="btn-text" id="d-activity-toggle" type="button" style="margin-top:6px;font-size:12px;">Show less</button>
    </div>`;
}

function wireActivitySection(root, ctx) {
  const toggle = root.querySelector('#d-activity-toggle');
  if (toggle) toggle.addEventListener('click', () => { activityExpanded = !activityExpanded; paint(ctx); });
}

/** Plain record metadata — no edit affordance, just the two dates staff sometimes need to check. */
function recordInfoSectionHtml(rec) {
  return `
    <div class="vm-drawer-section vm-record-info">
      <span>Added ${formatDate(rec.dateAdded)}</span>
      <span>Last Updated ${formatDateTime(rec.lastUpdated)}</span>
    </div>`;
}

/* =============================================================
 * CLIPS TAB — each clip is its own card with a real video thumbnail
 * (a browser shows a video element's first frame automatically once
 * metadata loads, so no canvas capture is needed) and a centered
 * play button that expands that one card to an inline player.
 * Download All is the primary action here per the workflow this tab
 * is actually used for: pulling files, not editing them.
 * ============================================================= */
function clipsTabHtml(rec) {
  return `
    <div class="vm-drawer-section" style="border-bottom:none;">
      <div class="vm-drawer-section-title">Source Clips <span>${rec.clips.length}</span></div>
      ${rec.clips.length ? `
        <div class="vm-clips-tab-actions">
          <button class="btn btn-primary btn-sm" id="c-download-all" type="button">Download All</button>
          <button class="btn btn-sm btn-ghost" id="c-add-clips" type="button">+ Add Clips</button>
        </div>
        <div class="vm-clip-list2">
          ${rec.clips.map((c, i) => clipCardHtml(c, i, c.id === previewClipId)).join('')}
        </div>
      ` : `
        <p class="muted">No clips uploaded yet.</p>
        <button class="btn btn-primary btn-sm" id="c-add-clips" type="button" style="margin-top:8px;">Add Clips</button>
      `}
    </div>`;
}

function clipCardHtml(c, index, isPlaying) {
  return `
    <div class="vm-clip-card2 ${isPlaying ? 'is-playing' : ''}" data-clip-id="${c.id}">
      <div class="vm-clip-card2-label">Clip ${index + 1}</div>
      <div class="vm-clip-thumb">
        ${c.downloadUrl
          ? `<video preload="metadata" muted playsinline data-clip-video="${c.id}" ${isPlaying ? 'controls autoplay' : ''} src="${escapeHtml(c.downloadUrl)}#t=0.5"></video>`
          : `<div class="vm-clip-thumb-empty">No file yet</div>`}
        ${c.downloadUrl && !isPlaying ? `
          <button class="vm-clip-play-btn" data-play-clip2="${c.id}" type="button" title="Play">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z"/></svg>
          </button>` : ''}
      </div>
      <div class="vm-clip-meta-row">
        <span>${formatDuration(c.durationSec)}</span>
        <span>${formatDate(c.uploadedAt)}</span>
        <span>${formatBytes(c.sizeBytes)}</span>
      </div>
      <div class="vm-clip-card2-actions">
        <button class="btn btn-sm btn-ghost" data-download-clip2="${c.id}" type="button">Download</button>
        <span class="vm-overflow">
          <button class="vm-overflow-btn" data-clip-more="${c.id}" type="button" title="More">⋯</button>
          <div class="vm-overflow-menu" id="clip-menu-${escapeHtml(c.id)}" hidden>
            <button data-play-clip2="${c.id}" type="button">${isPlaying ? 'Stop preview' : 'Preview'}</button>
          </div>
        </span>
      </div>
    </div>`;
}

function setPreviewClip(rec, clipId) {
  if (!clipId || clipId === previewClipId) { previewClipId = null; return; }
  const clip = rec.clips.find(c => c.id === clipId);
  if (!clip || !clip.downloadUrl) {
    showToast('This clip has no file to preview yet');
    previewClipId = null;
    return;
  }
  previewClipId = clipId;
}

/* Force a real decoded frame to paint as the thumbnail. The `#t=0.5`
 * URL fragment alone isn't reliably honored as a poster frame across
 * browsers (some just show black until playback starts), so explicitly
 * seek once metadata is ready. Also swap in a "couldn't load" state on
 * error instead of leaving a blank/broken video box. */
function wireClipThumbnails(root) {
  root.querySelectorAll('[data-clip-video]').forEach(video => {
    video.addEventListener('loadedmetadata', () => {
      if (video.currentTime < 0.1) {
        try { video.currentTime = Math.min(0.5, (video.duration || 1) / 4); } catch { /* ignore */ }
      }
    }, { once: true });
    video.addEventListener('error', () => {
      const thumb = video.closest('.vm-clip-thumb');
      if (thumb) thumb.innerHTML = `<div class="vm-clip-thumb-empty vm-clip-thumb-error">Couldn't load preview</div>`;
    }, { once: true });
  });
}

function wireClipsTab(root, rec, ctx) {
  wireClipThumbnails(root);
  const addBtn = root.querySelector('#c-add-clips');
  if (addBtn) addBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/*'; input.multiple = true;
    input.addEventListener('change', async () => {
      const files = [...input.files];
      if (!files.length) return;
      showToast(`Uploading ${files.length} clip${files.length === 1 ? '' : 's'}…`);
      const clips = [];
      for (const file of files) {
        try {
          const result = await StorageData.uploadClip(rec.id, file);
          clips.push({
            id: 'clip_' + Math.random().toString(36).slice(2, 10),
            filename: file.name, swatch: Math.floor(Math.random() * 8), durationSec: null,
            sizeBytes: file.size, uploader: 'Staff', uploadedAt: new Date().toISOString(),
            isOriginal: true, storagePath: result.storagePath, downloadUrl: result.downloadUrl,
          });
        } catch (err) {
          showToast(`Failed to upload ${file.name}: ${err.message}`);
        }
      }
      if (!clips.length) return;
      await ctx.repo.addClips(rec.id, clips, 'Staff');
      showToast(`${clips.length} clip(s) added`);
      ctx.refresh();
      paint(ctx);
    });
    input.click();
  });

  const downloadAllBtn = root.querySelector('#c-download-all');
  if (downloadAllBtn) downloadAllBtn.addEventListener('click', () => downloadClips(rec.clips));

  root.querySelectorAll('[data-download-clip2]').forEach(btn => btn.addEventListener('click', () => {
    const clip = rec.clips.find(c => c.id === btn.dataset.downloadClip2);
    downloadClips(clip ? [clip] : []);
  }));
  root.querySelectorAll('[data-play-clip2]').forEach(btn => btn.addEventListener('click', () => {
    setPreviewClip(rec, btn.dataset.playClip2);
    paint(ctx);
  }));
  root.querySelectorAll('[data-clip-more]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const menu = root.querySelector(`#clip-menu-${btn.dataset.clipMore}`);
    if (!menu) return;
    const opening = menu.hidden;
    root.querySelectorAll('.vm-overflow-menu').forEach(m => m.hidden = true);
    menu.hidden = !opening;
    if (opening) setTimeout(() => document.addEventListener('click', () => { menu.hidden = true; }, { once: true }), 0);
  }));
}

function downloadClips(clips) {
  const real = clips.filter(c => c.downloadUrl);
  if (!real.length) { showToast('No files to download yet'); return; }
  real.forEach(c => window.open(c.downloadUrl, '_blank', 'noopener'));
}

/* =============================================================
 * FOOTER — one primary status move at most; everything else
 * (other moves, Mark Needs Redo, Delete) lives in an overflow menu,
 * with Delete visually separated as the destructive action.
 * ============================================================= */
function footerHtml(rec) {
  const moves = ['ready', 'hold', 'created'].filter(s => s !== rec.status);
  const primaryTarget = rec.status !== 'created' ? 'created' : null;
  const secondaryMoves = moves.filter(s => s !== primaryTarget);
  return `
    <div class="vm-drawer-footer">
      ${primaryTarget ? `<button class="btn btn-primary" data-move="${primaryTarget}" type="button">Move to ${statusLabel(primaryTarget)}</button>` : `<span class="vm-drawer-footer-spacer"></span>`}
      <span class="vm-overflow">
        <button class="btn btn-ghost vm-overflow-btn" id="d-footer-more" type="button" title="More actions">⋯</button>
        <div class="vm-overflow-menu vm-overflow-menu-up" id="d-footer-menu" hidden>
          ${secondaryMoves.map(s => `<button data-move="${s}" type="button">Move to ${statusLabel(s)}</button>`).join('')}
          ${rec.videoFormat !== 'needs-redo' ? `<button id="d-footer-redo" type="button">Mark Needs Redo</button>` : ''}
          <div class="vm-overflow-divider"></div>
          <button id="d-footer-delete" type="button" class="is-destructive">Delete…</button>
        </div>
      </span>
    </div>`;
}

function wireFooter(root, rec, ctx) {
  const moreBtn = root.querySelector('#d-footer-more');
  const menu = root.querySelector('#d-footer-menu');
  if (moreBtn && menu) {
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      const opening = menu.hidden;
      menu.hidden = !opening;
      // Only arm the outside-click closer while actually open, and only
      // once per open — registering this unconditionally on every paint()
      // (which happens on nearly every drawer interaction) would pile up
      // stale listeners that fire on unrelated clicks.
      if (opening) setTimeout(() => document.addEventListener('click', () => { menu.hidden = true; }, { once: true }), 0);
    });
  }
  const redoBtn = root.querySelector('#d-footer-redo');
  if (redoBtn) redoBtn.addEventListener('click', async () => {
    await ctx.repo.markNeedsRedo(rec.id, 'Staff');
    showToast('Marked Needs Redo');
    ctx.refresh();
    paint(ctx);
  });
  const deleteBtn = root.querySelector('#d-footer-delete');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    openDeleteConfirmModal(rec, ctx, () => { closeDrawer(); ctx.refresh(); });
  });
}
