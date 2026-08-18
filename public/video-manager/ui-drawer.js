/* =============================================================
 * CMS Video Manager — Right-side detail drawer
 * -------------------------------------------------------------
 * One continuous scroll (Cattle Information, Source Clips,
 * Publishing, Source Status, Usage History, Notes, Activity),
 * not tabs — matches the dense-operations direction. Sticky
 * footer at the bottom carries the status-move actions, with at
 * most one primary button.
 *
 * IMPORTANT distinction: editing cattle info (consignor/sex/sire/
 * dam/weight/month) never silently changes the Video ID. Those are
 * two separate actions — see updateCattleFields() vs setVideoIdFields()
 * in repository.js. When the two diverge we show a warning and an
 * explicit opt-in "Update Video ID to match" action instead of
 * quietly reassigning an ID that may already be in use elsewhere.
 * ============================================================= */

import { escapeHtml, formatDate, formatDateTime, formatDuration, sexShort } from './format.js';
import { formatMonthYear, buildBaseId, monthYearToInputValue, inputValueToMonthYear } from './video-id.js';
import { showToast, copyToClipboard } from './toast.js';

let activeId = null;
let editingCattleField = null;
let usageExpanded = false;
let activityExpanded = false;

export async function openDrawer(id, ctx) {
  closeDrawer();
  activeId = id;
  editingCattleField = null;
  usageExpanded = false;
  activityExpanded = false;
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
  const prevBody = root.querySelector('#vm-drawer-body');
  const prevScrollTop = prevBody ? prevBody.scrollTop : 0;

  const sexLabel = ctx.ref.sexLabel(rec.sexCode) || `Code ${rec.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(rec.sireCode) || `Code ${rec.sireCode}`;
  const damLabel = ctx.ref.damLabel(rec.damCode) || `Code ${rec.damCode}`;
  const formatMeta = ctx.ref.videoFormatMeta(rec.videoFormat);
  const FORMAT_BADGE_CLASS = { clean: 'format-clean', 'legacy-tagged': 'format-legacy', 'needs-redo': 'format-redo', unknown: 'format-unknown' };

  root.innerHTML = `
    <div class="vm-drawer-backdrop" id="vm-drawer-backdrop"></div>
    <aside class="vm-drawer">
      <div class="vm-drawer-header">
        <div>
          <div class="vm-drawer-title">${escapeHtml(rec.videoId)}</div>
          <div class="vm-drawer-sub">${escapeHtml(rec.consignorName)}</div>
          <div class="vm-drawer-badges">
            <span class="status-pill status-${rec.isDraft ? 'draft' : rec.status}">${rec.isDraft ? 'Draft' : statusLabel(rec.status)}</span>
            <span class="format-pill ${FORMAT_BADGE_CLASS[rec.videoFormat] || ''}">${escapeHtml(formatMeta ? formatMeta.short : rec.videoFormat)}</span>
          </div>
        </div>
        <button class="vm-drawer-close" id="vm-drawer-close">&times;</button>
      </div>

      <div class="vm-drawer-body scroll-thin" id="vm-drawer-body">
        ${cattleSectionHtml(rec, ctx, sexLabel, sireLabel, damLabel)}
        ${clipsSectionHtml(rec)}
        ${publishingSectionHtml(rec)}
        ${sourceStatusSectionHtml(rec, ctx)}
        ${usageSectionHtml(rec)}
        ${notesSectionHtml(rec)}
        ${activitySectionHtml(rec)}
      </div>

      ${footerHtml(rec)}
    </aside>
  `;

  const body = root.querySelector('#vm-drawer-body');
  if (body) body.scrollTop = prevScrollTop;

  root.querySelector('#vm-drawer-close').addEventListener('click', closeDrawer);
  root.querySelector('#vm-drawer-backdrop').addEventListener('click', closeDrawer);
  root.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', async () => {
    await ctx.repo.setStatus(rec.id, btn.dataset.move, 'Staff');
    showToast('Status updated');
    ctx.refresh();
    paint(ctx);
  }));

  wireCattleSection(root, rec, ctx);
  wireClipsSection(root, rec, ctx);
  wirePublishingSection(root, rec, ctx);
  wireSourceStatusSection(root, rec, ctx);
  wireUsageSection(root, ctx);
  wireNotesSection(root, rec, ctx);
  wireActivitySection(root, ctx);
}

function statusLabel(s) { return s === 'ready' ? 'Ready to Make' : s === 'hold' ? 'On Hold' : 'Created'; }

/* =============================================================
 * CATTLE INFORMATION — click-to-edit rows
 * ============================================================= */
const CATTLE_FIELDS = [
  { key: 'consignorCode', label: 'Consignor', kind: 'consignor' },
  { key: 'sexCode', label: 'Sex', kind: 'select' },
  { key: 'sireCode', label: 'Sire', kind: 'select' },
  { key: 'damCode', label: 'Dam', kind: 'select' },
  { key: 'weight', label: 'Weight', kind: 'number' },
  { key: 'monthYear', label: 'Video Month', kind: 'monthyear' },
];

function cattleDisplay(rec, key, sexLabel, sireLabel, damLabel) {
  if (key === 'consignorCode') return rec.consignorName;
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
      ${CATTLE_FIELDS.map(f => cattleRowHtml(rec, ctx, f, sexLabel, sireLabel, damLabel)).join('')}
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

function cattleRowHtml(rec, ctx, field, sexLabel, sireLabel, damLabel) {
  if (editingCattleField !== field.key) {
    return `
      <div class="vm-fieldrow" data-cattle-field="${field.key}">
        <span class="k">${field.label}</span>
        <span class="v">${escapeHtml(cattleDisplay(rec, field.key, sexLabel, sireLabel, damLabel))}</span>
        <span class="edit-hint" title="Edit"><svg viewBox="0 0 16 16" fill="none"><path d="M11 2.5 13.5 5 5.5 13 2 14l1-3.5L11 2.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg></span>
      </div>`;
  }
  return `
    <div class="vm-fieldedit" data-cattle-editing="${field.key}">
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
    return `<select id="cattle-input-${field.key}">${options.map(o => `<option value="${o.code}" ${o.code === rec[field.key] ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`;
  }
  if (field.kind === 'number') {
    return `<input type="number" id="cattle-input-${field.key}" value="${rec.weight}" />`;
  }
  if (field.kind === 'monthyear') {
    return `<input type="month" id="cattle-input-${field.key}" value="${escapeHtml(monthYearToInputValue(rec.monthYear))}" />`;
  }
  // consignor: searchable combo
  return `
    <div class="vm-combo" id="cattle-consignor-combo" data-selected-code="${escapeHtml(rec.consignorCode)}">
      <input type="text" id="cattle-input-consignorCode" value="${escapeHtml(rec.consignorName)}" autocomplete="off" />
      <div class="vm-combo-list" id="cattle-consignor-list" hidden></div>
    </div>`;
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
 * SOURCE CLIPS
 * ============================================================= */
function clipsSectionHtml(rec) {
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Source Clips
        <span>${rec.clips.length}</span>
      </div>
      ${rec.clips.length ? `
        <div class="vm-clip-list">
          ${rec.clips.map(c => `
            <div class="vm-clip-row">
              <svg class="vm-clip-icon" viewBox="0 0 24 24" fill="none"><path d="M4 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.6"/><path d="M17 10.5 22 8v8l-5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
              <div class="vm-clip-info">
                <div class="vm-clip-name" data-preview-clip="${c.id}" title="Preview">${escapeHtml(c.filename)}</div>
                <div class="vm-clip-details">${formatDuration(c.durationSec)} · ${escapeHtml(c.uploader)} · ${formatDate(c.uploadedAt)}</div>
              </div>
              <button class="vm-clip-play" data-preview-clip="${c.id}" type="button" title="Preview"><svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 2l7 4-7 4V2z"/></svg></button>
              <button class="btn btn-xs" data-download-clip="${c.id}" type="button">Download</button>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-sm" id="c-download-all" type="button">Download All</button>
          <button class="btn btn-sm btn-ghost" id="c-add-clips" type="button">+ Add Clips</button>
        </div>
      ` : `
        <p class="muted">No clips uploaded yet.</p>
        <button class="btn btn-primary btn-sm" id="c-add-clips" type="button" style="margin-top:8px;">Add Clips</button>
      `}
    </div>`;
}

function wireClipsSection(root, rec, ctx) {
  const addBtn = root.querySelector('#c-add-clips');
  if (addBtn) addBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/*'; input.multiple = true;
    input.addEventListener('change', async () => {
      const clips = [...input.files].map(file => ({
        id: 'clip_' + Math.random().toString(36).slice(2, 10),
        filename: file.name, swatch: Math.floor(Math.random() * 8), durationSec: null,
        sizeBytes: file.size, uploader: 'Staff', uploadedAt: new Date().toISOString(),
        isOriginal: true, fileHandle: file,
      }));
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

  root.querySelectorAll('[data-download-clip]').forEach(btn => btn.addEventListener('click', () => {
    const clip = rec.clips.find(c => c.id === btn.dataset.downloadClip);
    downloadClips(clip ? [clip] : []);
  }));
  root.querySelectorAll('[data-preview-clip]').forEach(btn => btn.addEventListener('click', () => {
    const clip = rec.clips.find(c => c.id === btn.dataset.previewClip);
    if (!clip || !clip.fileHandle) { showToast('Mock data — original files aren’t wired to real storage in this prototype yet'); return; }
    window.open(URL.createObjectURL(clip.fileHandle), '_blank', 'noopener');
  }));
}

function downloadClips(clips) {
  const real = clips.filter(c => c.fileHandle);
  if (!real.length) { showToast('Mock data — original files aren’t wired to real storage in this prototype yet'); return; }
  real.forEach(c => {
    const url = URL.createObjectURL(c.fileHandle);
    const a = document.createElement('a');
    a.href = url; a.download = c.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
}

/* =============================================================
 * PUBLISHING
 * ============================================================= */
function publishingSectionHtml(rec) {
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Publishing</div>
      ${rec.youtubeUrl ? `
        <div class="vm-link-row"><input type="text" value="${escapeHtml(rec.youtubeUrl)}" disabled /><button class="btn btn-sm" data-copy="url" type="button" title="Copy YouTube Link">Copy Link</button><button class="btn btn-sm btn-ghost" data-open-yt type="button" title="Open YouTube Video">Open</button></div>
        <div class="vm-link-row"><input type="text" value="${escapeHtml(rec.embedCode)}" disabled /><button class="btn btn-sm" data-copy="code" type="button" title="Copy Embed Code">Copy Code</button></div>
        <button class="btn btn-sm" id="d-change-yt" type="button" style="margin-bottom:8px;">Change YouTube Video</button>
        <div id="d-change-yt-panel"></div>
        ${rec.previousYouTubeVideos.length ? `
          <div class="vm-drawer-section-title" style="margin-top:14px;">Previous Versions</div>
          ${rec.previousYouTubeVideos.map(p => `
            <div class="vm-history-item">
              <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.url)}</a><br>
              Replaced ${formatDate(p.replacedAt)} by ${escapeHtml(p.replacedBy)}${p.reason ? ` — ${escapeHtml(p.reason)}` : ''}
            </div>
          `).join('')}
        ` : ''}
      ` : `
        <div class="vm-link-row"><input type="text" id="d-yt-input" placeholder="Paste YouTube link…" /><button class="btn btn-sm btn-primary" id="d-yt-save" type="button">Save</button></div>
      `}
      ${rec.status === 'created' ? `
        <div class="vm-fieldrow" data-cattle-field="__none" style="cursor:default;">
          <span class="k">Video Maker</span>
          <span class="v" id="d-videomaker-display">${escapeHtml(rec.videoMaker)}</span>
        </div>
        <input type="text" id="d-videomaker" value="${escapeHtml(rec.videoMaker)}" style="display:none;" />
      ` : ''}
    </div>`;
}

function wirePublishingSection(root, rec, ctx) {
  root.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const map = { url: rec.youtubeUrl, code: rec.embedCode };
    await copyToClipboard(map[btn.dataset.copy]);
    showToast('Copied');
  }));
  const openYt = root.querySelector('[data-open-yt]');
  if (openYt) openYt.addEventListener('click', () => window.open(rec.youtubeUrl, '_blank', 'noopener'));

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

  const vmDisplay = root.querySelector('#d-videomaker-display');
  if (vmDisplay) {
    const row = vmDisplay.closest('.vm-fieldrow');
    const hiddenInput = root.querySelector('#d-videomaker');
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      row.innerHTML = `<span class="k">Video Maker</span>`;
      const input = document.createElement('input');
      input.type = 'text'; input.value = rec.videoMaker; input.style.flex = '1';
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
}

function parseYoutubeLink(val) {
  const m = val.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{5,})/);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{5,}$/.test(val) ? val : null);
}

/* =============================================================
 * SOURCE STATUS — compact selector + short explanation
 * ============================================================= */
function sourceStatusSectionHtml(rec, ctx) {
  const meta = ctx.ref.videoFormatMeta(rec.videoFormat);
  const showTags = rec.videoFormat !== 'clean';
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Source Status</div>
      <div class="vm-drawer-section-hint">Is this underlying source video reusable?</div>
      <div class="vm-source-select-row">
        <select id="d-videoformat">
          ${ctx.ref.getVideoFormats().map(f => `<option value="${f.code}" ${f.code === rec.videoFormat ? 'selected' : ''}>${f.label}</option>`).join('')}
        </select>
        ${rec.videoFormat !== 'needs-redo' ? `<button class="btn btn-sm btn-ghost" id="d-mark-redo" type="button">Mark Needs Redo</button>` : ''}
      </div>
      <p class="field-hint" id="d-videoformat-desc">${escapeHtml(meta ? meta.desc : '')}</p>

      ${showTags ? `
        <label style="display:block;margin:12px 0 6px;">Baked-In Tags</label>
        <div class="tag-chip-row" id="d-tags-row">
          ${ctx.ref.getProgramTags().map(t => `
            <button type="button" class="tag-chip ${rec.bakedInTags.includes(t.name) ? 'active' : ''}" data-tag="${escapeHtml(t.name)}">${escapeHtml(t.name)}</button>
          `).join('')}
          <button type="button" class="tag-chip tag-chip-add" id="d-add-tag">+ Add Tag</button>
        </div>
      ` : ''}
    </div>

    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Playback</div>
      <div class="vm-drawer-section-hint">How should overlays be handled during playback/OBS?</div>
      <select id="d-overlaymode" style="max-width:200px;">
        ${ctx.ref.getOverlayModes().map(m => `<option value="${m.code}" ${m.code === rec.overlayMode ? 'selected' : ''}>${m.label}</option>`).join('')}
      </select>
    </div>`;
}

function wireSourceStatusSection(root, rec, ctx) {
  root.querySelector('#d-videoformat').addEventListener('change', async e => {
    await ctx.repo.setVideoFormat(rec.id, e.target.value, 'Staff');
    ctx.refresh();
    paint(ctx);
  });
  root.querySelector('#d-overlaymode').addEventListener('change', async e => {
    await ctx.repo.setOverlayMode(rec.id, e.target.value, 'Staff');
    ctx.refresh();
  });
  root.querySelectorAll('#d-tags-row [data-tag]').forEach(btn => btn.addEventListener('click', async () => {
    const tag = btn.dataset.tag;
    const tags = new Set(rec.bakedInTags);
    tags.has(tag) ? tags.delete(tag) : tags.add(tag);
    await ctx.repo.setBakedInTags(rec.id, [...tags], 'Staff');
    ctx.refresh();
    paint(ctx);
  }));
  const addTagBtn = root.querySelector('#d-add-tag');
  if (addTagBtn) addTagBtn.addEventListener('click', async () => {
    const name = prompt('New tag name (e.g. GAP4):');
    if (!name || !name.trim()) return;
    try {
      const tag = ctx.ref.addProgramTag(name.trim());
      await ctx.repo.setBakedInTags(rec.id, [...rec.bakedInTags, tag.name], 'Staff');
      ctx.refresh();
      paint(ctx);
    } catch (err) {
      showToast(err.message);
    }
  });
  const markRedoBtn = root.querySelector('#d-mark-redo');
  if (markRedoBtn) markRedoBtn.addEventListener('click', async () => {
    await ctx.repo.markNeedsRedo(rec.id, 'Staff');
    showToast('Marked Needs Redo');
    ctx.refresh();
    paint(ctx);
  });
}

/* =============================================================
 * USAGE HISTORY — latest few + View all
 * ============================================================= */
function usageSectionHtml(rec) {
  if (!rec.usage.length) return `<div class="vm-drawer-section"><div class="vm-drawer-section-title">Usage History</div><p class="muted">Not used in any auctions yet.</p></div>`;
  const sorted = [...rec.usage].sort((a, b) => b.auctionDate.localeCompare(a.auctionDate));
  const shown = usageExpanded ? sorted : sorted.slice(0, 3);
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Usage History</div>
      ${shown.map(u => `
        <div class="vm-usage-row">
          <span class="d">${formatDate(u.auctionDate)} — ${escapeHtml(u.auctionName)}</span>
          <span class="lots">${u.lots.map(escapeHtml).join(', ')}</span>
        </div>
      `).join('')}
      ${sorted.length > 3 ? `<button class="btn-text" id="d-usage-toggle" type="button" style="margin-top:8px;font-size:12px;">${usageExpanded ? 'Show less' : `View all ${sorted.length} uses`}</button>` : ''}
    </div>`;
}

function wireUsageSection(root, ctx) {
  const toggle = root.querySelector('#d-usage-toggle');
  if (toggle) toggle.addEventListener('click', () => { usageExpanded = !usageExpanded; paint(ctx); });
}

/* =============================================================
 * NOTES + Canva Link
 * ============================================================= */
function notesSectionHtml(rec) {
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Notes</div>
      <textarea id="d-notes" rows="3">${escapeHtml(rec.notes)}</textarea>
      <div class="field" style="margin-top:10px;">
        <label>Canva Link</label>
        <div class="vm-link-row">
          <input type="text" id="d-canvalink" placeholder="Paste Canva design link…" value="${escapeHtml(rec.canvaLink || '')}" />
          <button class="btn btn-sm" id="d-canva-copy" type="button" ${rec.canvaLink ? '' : 'disabled'}>Copy</button>
        </div>
      </div>
    </div>`;
}

function wireNotesSection(root, rec, ctx) {
  root.querySelector('#d-notes').addEventListener('blur', e => ctx.repo.updateVideo(rec.id, { notes: e.target.value.trim() }, 'Staff'));
  root.querySelector('#d-canvalink').addEventListener('blur', e => {
    const val = e.target.value.trim();
    ctx.repo.updateVideo(rec.id, { canvaLink: val || null }, 'Staff');
    root.querySelector('#d-canva-copy').disabled = !val;
  });
  const canvaCopyBtn = root.querySelector('#d-canva-copy');
  if (canvaCopyBtn) canvaCopyBtn.addEventListener('click', async () => {
    await copyToClipboard(root.querySelector('#d-canvalink').value.trim());
    showToast('Copied');
  });
}

/* =============================================================
 * ACTIVITY — latest few + View all (kept as a compact log, not a tab)
 * ============================================================= */
function activitySectionHtml(rec) {
  if (!rec.activity.length) return '';
  const sorted = [...rec.activity].sort((a, b) => b.ts.localeCompare(a.ts));
  const shown = activityExpanded ? sorted : sorted.slice(0, 3);
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Activity</div>
      ${shown.map(a => `
        <div class="vm-activity-item">
          <span class="vm-activity-dot"></span>
          <div>
            <div class="vm-activity-msg">${escapeHtml(a.message)}</div>
            <div class="vm-activity-meta">${escapeHtml(a.actor)} · ${formatDateTime(a.ts)}</div>
          </div>
        </div>
      `).join('')}
      ${sorted.length > 3 ? `<button class="btn-text" id="d-activity-toggle" type="button" style="margin-top:6px;font-size:12px;">${activityExpanded ? 'Show less' : `View all ${sorted.length} events`}</button>` : ''}
    </div>`;
}

function wireActivitySection(root, ctx) {
  const toggle = root.querySelector('#d-activity-toggle');
  if (toggle) toggle.addEventListener('click', () => { activityExpanded = !activityExpanded; paint(ctx); });
}

/* =============================================================
 * FOOTER — status moves, one primary at most
 * ============================================================= */
function footerHtml(rec) {
  const moves = ['ready', 'hold', 'created'].filter(s => s !== rec.status);
  const primaryTarget = rec.status !== 'created' ? 'created' : null;
  return `
    <div class="vm-drawer-footer">
      ${moves.map(s => `<button class="btn ${s === primaryTarget ? 'btn-primary' : 'btn-ghost'}" data-move="${s}" type="button">Move to ${statusLabel(s)}</button>`).join('')}
    </div>`;
}
