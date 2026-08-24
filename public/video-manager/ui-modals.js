/* =============================================================
 * CMS Video Manager — Modals
 * Upload screen, Video ID collision resolution, new consignor,
 * quick-add unrecognized code, CSV usage import, notifications.
 * ============================================================= */

import { escapeHtml, formatDate, formatBytes, formatDuration, cattleSummaryLine } from './format.js';
import { showToast, copyToClipboard } from './toast.js';
import { resolveVideoIdEntry, CODE_KIND_LABELS, CODE_KIND_SHORT_LABELS } from './id-workflow.js';
import { buildBaseId, formatMonthYear, parseVideoId, monthYearToInputValue, inputValueToMonthYear } from './video-id.js';

/* ----- generic modal shell ----- */
function mountModal(innerHtml, { wide = false } = {}) {
  const root = document.getElementById('vm-modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'vm-modal-backdrop';
  backdrop.innerHTML = `<div class="vm-modal ${wide ? 'vm-modal-wide' : ''}">${innerHtml}</div>`;
  root.appendChild(backdrop);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  function close() { backdrop.remove(); }
  const modal = backdrop.querySelector('.vm-modal');
  modal.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', close));
  return { backdrop, modal, close };
}

/* =============================================================
 * Collision resolution — three options
 * Returns Promise<{ action: 'add'|'open'|'create' }>
 * ============================================================= */
export function openCollisionModal(existing, baseId, ctx) {
  return new Promise(resolve => {
    const sexLabel = ctx.ref.sexLabel(existing.sexCode) || existing.sexCode;
    const sireLabel = ctx.ref.sireLabel(existing.sireCode) || existing.sireCode;
    const damLabel = ctx.ref.damLabel(existing.damCode) || existing.damCode;

    const { modal, close } = mountModal(`
      <div class="vm-modal-header"><h2>Video ID already exists</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
      <div class="vm-modal-body">
        <div class="vm-collision-summary">
          <div class="vid">${escapeHtml(existing.videoId)}</div>
          <div class="row">${escapeHtml(existing.consignorName)}</div>
          <div class="row">${sexLabel} · ${sireLabel} × ${damLabel}</div>
          <div class="row">${existing.weight} lbs</div>
          <div class="row">${existing.clips.length} clip${existing.clips.length === 1 ? '' : 's'}</div>
          <div class="row">Created ${formatDate(existing.dateAdded)}</div>
        </div>
        <div class="vm-collision-options">
          <button class="vm-option-btn" data-action="add">
            <div><div class="title">Add files to existing</div><div class="desc">Use when these new files actually belong to the existing video record.</div></div>
          </button>
          <button class="vm-option-btn" data-action="open">
            <div><div class="title">Open existing video</div><div class="desc">Open this record in the detail drawer instead.</div></div>
          </button>
          <button class="vm-option-btn" data-action="create">
            <div><div class="title">Create separate video</div><div class="desc">Genuinely a different video package with the same cattle classification. We'll assign ${escapeHtml(baseId)}-2 (or next available).</div></div>
          </button>
        </div>
      </div>
    `);
    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => { resolve({ action: btn.dataset.action }); close(); });
    });
    modal.querySelector('.vm-modal-close').addEventListener('click', () => resolve({ action: null }));
  });
}

/* =============================================================
 * Quick-add an unrecognized code inline (consignor/sex/sire/dam)
 * Returns Promise<boolean success>
 * ============================================================= */
export function openQuickAddCodeModal(kind, code, ctx) {
  return new Promise(resolve => {
    const label = CODE_KIND_LABELS[kind] || kind;
    const shortLabel = CODE_KIND_SHORT_LABELS[kind] || kind;
    const needsName = kind === 'consignor';
    const { modal, close } = mountModal(`
      <div class="vm-modal-header"><h2>${shortLabel} code ${escapeHtml(code)} is not recognized</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
      <div class="vm-modal-body">
        <p class="muted" style="margin-bottom:14px;">Add it now without leaving what you were doing.</p>
        ${needsName ? `
          <div class="field"><label>Consignor Name</label><input type="text" id="qa-name" placeholder="e.g. Cross Timbers Ranch" /></div>
        ` : `
          <div class="field"><label>${label} ${code} Label</label><input type="text" id="qa-name" placeholder="e.g. Red Angus" /></div>
        `}
      </div>
      <div class="vm-modal-footer">
        <button class="btn btn-ghost" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="qa-save">Add ${label} ${escapeHtml(code)}</button>
      </div>
    `);
    modal.querySelector('#qa-save').addEventListener('click', () => {
      const val = modal.querySelector('#qa-name').value.trim();
      if (!val) return;
      try {
        if (kind === 'consignor') ctx.ref.addConsignor({ name: val, code });
        else if (kind === 'sire') ctx.ref.addSireType(code, val);
        else if (kind === 'dam') ctx.ref.addDamType(code, val);
        showToast(`Added ${label.toLowerCase()} ${code}`);
        resolve(true);
      } catch (err) {
        showToast(err.message);
        resolve(false);
      }
      close();
    });
    modal.querySelector('.vm-modal-close').addEventListener('click', () => resolve(false));
  });
}

/* =============================================================
 * New consignor
 * Returns Promise<consignor|null>
 * ============================================================= */
export function openNewConsignorModal(ctx) {
  return new Promise(resolve => {
    const suggested = ctx.ref.suggestNextConsignorCode();
    const { modal, close } = mountModal(`
      <div class="vm-modal-header"><h2>New Consignor</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
      <div class="vm-modal-body">
        <div class="field"><label>Consignor Name</label><input type="text" id="nc-name" placeholder="e.g. Cross Timbers Ranch" /></div>
        <div class="field"><label>Consignor Code</label><input type="text" id="nc-code" value="${suggested}" /></div>
        <p class="field-hint">Suggested next unused number. New consignors are flagged NEW — NEEDS REVIEW until confirmed.</p>
      </div>
      <div class="vm-modal-footer">
        <button class="btn btn-ghost" data-modal-close>Cancel</button>
        <button class="btn btn-primary" id="nc-save">Create Consignor</button>
      </div>
    `);
    modal.querySelector('#nc-save').addEventListener('click', () => {
      const name = modal.querySelector('#nc-name').value.trim();
      const code = modal.querySelector('#nc-code').value.trim();
      if (!name || !code) return;
      try {
        const rec = ctx.ref.addConsignor({ name, code });
        showToast(`Consignor ${name} added — NEW, needs review`);
        resolve(rec);
      } catch (err) {
        showToast(err.message);
        return;
      }
      close();
    });
    modal.querySelector('.vm-modal-close').addEventListener('click', () => resolve(null));
  });
}

/* =============================================================
 * Video ID Manager — staff-only reference system
 * -------------------------------------------------------------
 * Manages the code dictionaries (Consignors, Sex, Sire Types, Dam
 * Types) that build and parse Video IDs, plus a plain-language
 * explainer. This is the reference system, NOT the video records
 * themselves — see repository.js's VideoRepository for that.
 *
 * Code safety: existing numeric codes are permanent. This UI only
 * ever lets staff add a new code, correct a display-name spelling,
 * or mark a value inactive — never reassign or delete a code that's
 * already been used, since that would make historical Video IDs
 * ambiguous. Reps never see this tool (rep portal has its own
 * separate, code-free UI — see /video-upload).
 * ============================================================= */
const ID_MANAGER_TABS = [
  ['consignors', 'Consignors'], ['sex', 'Sex'], ['sire', 'Sire Types'], ['dam', 'Dam Types'],
];

const IDMGR_LOCK_ICON = `<span class="vm-idmgr-lock" title="Codes already used in Video IDs remain permanent."><svg viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="6.5" rx="1.3" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" stroke-width="1.3"/></svg></span>`;

export function openVideoIdManagerModal(ctx) {
  let tab = 'consignors';
  const example = { consignorCode: '21', sexCode: '2', sireCode: '2', damCode: '2', weight: '450', monthYear: '0826' };
  const exampleId = buildBaseId(example);

  const { modal } = mountModal(`
    <div class="vm-modal-header">
      <div>
        <h2>Video ID Manager</h2>
        <p class="field-hint">Controls the codes used to construct CMS Video IDs. Existing codes remain permanently associated with historical videos.</p>
      </div>
      <button class="vm-modal-close" data-modal-close>&times;</button>
    </div>
    <div class="vm-modal-body" style="padding-bottom:0;">
      <div class="vm-idmgr-explainer">
        <div class="cap">Example Video ID</div>
        <div class="fmt">21<span class="sep">.</span>2<span class="sep">.</span>2<span class="sep">.</span>2<span class="sep">.</span>450<span class="sep">.</span>0826</div>
        <div class="cap">Consignor · Sex · Sire · Dam · Weight · Month/Year</div>
      </div>
    </div>
    <div class="vm-idmgr-tabs" id="idmgr-tabs">
      ${ID_MANAGER_TABS.map(([id, label]) => `<button type="button" class="vm-idmgr-tab ${id === tab ? 'active' : ''}" data-idmgr-tab="${id}">${label}</button>`).join('')}
    </div>
    <div class="vm-modal-body" id="idmgr-body"></div>
    <div class="vm-modal-footer"><button class="btn btn-primary" data-modal-close>Done</button></div>
  `, { wide: true });

  modal.querySelector('#idmgr-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-idmgr-tab]');
    if (!btn) return;
    tab = btn.dataset.idmgrTab;
    modal.querySelectorAll('[data-idmgr-tab]').forEach(b => b.classList.toggle('active', b.dataset.idmgrTab === tab));
    paintTab();
  });

  function paintTab() {
    const body = modal.querySelector('#idmgr-body');
    if (tab === 'consignors') renderConsignorsTab(body, ctx);
    else if (tab === 'sex') renderSexTab(body, ctx);
    else if (tab === 'sire') renderCodeTab(body, ctx, {
      title: 'Sire Type', get: () => ctx.ref.getSireTypes(),
      add: (code, label) => ctx.ref.addSireType(code, label),
      rename: (code, label) => ctx.ref.renameSireType(code, label),
      setActive: (code, active) => ctx.ref.setSireActive(code, active),
    });
    else if (tab === 'dam') renderCodeTab(body, ctx, {
      title: 'Dam Type', get: () => ctx.ref.getDamTypes(),
      add: (code, label) => ctx.ref.addDamType(code, label),
      rename: (code, label) => ctx.ref.renameDamType(code, label),
      setActive: (code, active) => ctx.ref.setDamActive(code, active),
    });
  }
  paintTab();
}

/* ----- shared overflow-menu helper: click "⋯", pick an action ----- */
function wireOverflowMenus(container) {
  container.querySelectorAll('.vm-overflow').forEach(wrap => {
    const btn = wrap.querySelector('.vm-overflow-btn');
    const menu = wrap.querySelector('.vm-overflow-menu');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const willOpen = menu.hidden;
      container.querySelectorAll('.vm-overflow-menu').forEach(m => m.hidden = true);
      menu.hidden = !willOpen;
      // Arm the outside-click closer only while actually open, and only
      // once per open — this function re-runs on every table repaint, so
      // registering unconditionally would pile up stale listeners that
      // fire on unrelated clicks later.
      if (willOpen) setTimeout(() => document.addEventListener('click', () => { menu.hidden = true; }, { once: true }), 0);
    });
  });
}

function statusText(rec) {
  if (rec.flaggedNew) return `<span class="vm-idmgr-status needs-review">Needs Review</span>`;
  if (rec.active === false) return `<span class="vm-idmgr-status inactive">Inactive</span>`;
  return `<span class="vm-idmgr-status active">Active</span>`;
}

function renderConsignorsTab(container, ctx) {
  let query = '';
  let sortBy = 'name';
  let editingCode = null;
  container.innerHTML = `
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      <input type="text" id="idmgr-c-search" placeholder="Search consignors…" style="flex:1;" />
      <select id="idmgr-c-sort" style="width:auto;">
        <option value="name">Sort: Name</option>
        <option value="code">Sort: Code</option>
      </select>
    </div>
    <div id="idmgr-c-list"></div>
    <button class="btn btn-ghost" id="idmgr-c-add" type="button" style="margin-top:12px;">+ Add Consignor</button>
  `;
  const list = container.querySelector('#idmgr-c-list');

  function paint() {
    let rows = ctx.ref.getConsignors();
    if (sortBy === 'code') rows = [...rows].sort((a, b) => Number(a.code) - Number(b.code));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q));
    }
    list.innerHTML = `
      <table class="vm-idmgr-table">
        <thead><tr><th>Code</th><th>Consignor</th><th>Videos</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map(c => `
            <tr data-code="${escapeHtml(c.code)}">
              <td class="vm-idmgr-code">${escapeHtml(c.code)}${IDMGR_LOCK_ICON}</td>
              <td>${editingCode === c.code
                ? `<input type="text" class="idmgr-name-input" value="${escapeHtml(c.name)}" style="max-width:240px;" />`
                : escapeHtml(c.name)}</td>
              <td>${ctx.ref.countVideosForConsignor(c.code)}</td>
              <td>${statusText(c)}</td>
              <td>
                ${editingCode === c.code ? `
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-xs btn-primary" data-save="${escapeHtml(c.code)}" type="button">Save</button>
                    <button class="btn btn-xs btn-ghost" data-cancel-edit type="button">Cancel</button>
                  </div>
                ` : `
                  ${c.flaggedNew ? `<button class="btn btn-xs" data-review="${escapeHtml(c.code)}" type="button">Review</button>` : `<button class="btn btn-xs" data-edit="${escapeHtml(c.code)}" type="button">Edit</button>`}
                  <span class="vm-overflow">
                    <button class="vm-overflow-btn" type="button">⋯</button>
                    <div class="vm-overflow-menu" hidden>
                      ${c.flaggedNew ? `<button data-edit="${escapeHtml(c.code)}" type="button">Rename</button>` : ''}
                      <button data-toggle-active="${escapeHtml(c.code)}" type="button">${c.active === false ? 'Activate' : 'Mark inactive'}</button>
                    </div>
                  </span>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${!rows.length ? '<p class="muted" style="margin-top:10px;">No consignors match.</p>' : ''}
    `;

    list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => { editingCode = btn.dataset.edit; paint(); }));
    list.querySelectorAll('[data-cancel-edit]').forEach(btn => btn.addEventListener('click', () => { editingCode = null; paint(); }));
    list.querySelectorAll('[data-save]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.save;
      const input = list.querySelector(`tr[data-code="${CSS.escape(code)}"] .idmgr-name-input`);
      const name = input.value.trim();
      if (!name) { showToast('Name cannot be empty'); return; }
      try { ctx.ref.renameConsignor(code, name); showToast(`Updated ${name}`); ctx.refresh(); editingCode = null; paint(); } catch (err) { showToast(err.message); }
    }));
    list.querySelectorAll('[data-review]').forEach(btn => btn.addEventListener('click', () => {
      ctx.ref.clearConsignorFlag(btn.dataset.review); ctx.refresh(); paint();
    }));
    list.querySelectorAll('[data-toggle-active]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.toggleActive;
      const rec = ctx.ref.getConsignors().find(c => c.code === code);
      ctx.ref.setConsignorActive(code, rec.active === false);
      ctx.refresh();
      paint();
    }));
    wireOverflowMenus(list);
  }
  paint();

  container.querySelector('#idmgr-c-search').addEventListener('input', e => { query = e.target.value; paint(); });
  container.querySelector('#idmgr-c-sort').addEventListener('change', e => { sortBy = e.target.value; paint(); });
  container.querySelector('#idmgr-c-add').addEventListener('click', async () => {
    const rec = await openNewConsignorModal(ctx);
    if (rec) { ctx.refresh(); paint(); }
  });
}

function renderSexTab(container, ctx) {
  const rows = ctx.ref.getSexTypes();
  container.innerHTML = `
    <table class="vm-idmgr-table">
      <thead><tr><th>Code</th><th>Name</th><th>Status</th></tr></thead>
      <tbody>
        ${rows.map(s => `<tr><td class="vm-idmgr-code">${escapeHtml(s.code)}${IDMGR_LOCK_ICON}</td><td>${escapeHtml(s.label)}</td><td>${statusText(s)}</td></tr>`).join('')}
      </tbody>
    </table>
  `;
}

function renderCodeTab(container, ctx, cfg) {
  let editingCode = null;
  container.innerHTML = `<div id="idmgr-code-list"></div>`;
  const list = container.querySelector('#idmgr-code-list');

  function paint() {
    const rows = [...cfg.get()].sort((a, b) => Number(a.code) - Number(b.code));
    list.innerHTML = `
      <table class="vm-idmgr-table">
        <thead><tr><th>Code</th><th>Name</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr data-code="${escapeHtml(r.code)}">
              <td class="vm-idmgr-code">${escapeHtml(r.code)}${IDMGR_LOCK_ICON}</td>
              <td>${editingCode === r.code
                ? `<input type="text" class="idmgr-code-name-input" value="${escapeHtml(r.label)}" style="max-width:240px;" />`
                : escapeHtml(r.label)}</td>
              <td>${statusText(r)}</td>
              <td>
                ${editingCode === r.code ? `
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-xs btn-primary" data-save="${escapeHtml(r.code)}" type="button">Save</button>
                    <button class="btn btn-xs btn-ghost" data-cancel-edit type="button">Cancel</button>
                  </div>
                ` : `
                  <button class="btn btn-xs" data-edit="${escapeHtml(r.code)}" type="button">Edit</button>
                  <span class="vm-overflow">
                    <button class="vm-overflow-btn" type="button">⋯</button>
                    <div class="vm-overflow-menu" hidden>
                      <button data-toggle="${escapeHtml(r.code)}" type="button">${r.active === false ? 'Activate' : 'Mark inactive'}</button>
                    </div>
                  </span>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="field-row" style="margin-top:14px;align-items:flex-end;">
        <div><label>New Code</label><input type="text" id="idmgr-code-new-code" placeholder="e.g. 11" /></div>
        <div><label>Name</label><input type="text" id="idmgr-code-new-name" placeholder="e.g. Red Angus" /></div>
      </div>
      <button class="btn btn-ghost" id="idmgr-code-add" type="button" style="margin-top:8px;">+ Add ${cfg.title}</button>
    `;
    list.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => { editingCode = btn.dataset.edit; paint(); }));
    list.querySelectorAll('[data-cancel-edit]').forEach(btn => btn.addEventListener('click', () => { editingCode = null; paint(); }));
    list.querySelectorAll('[data-save]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.save;
      const input = list.querySelector(`tr[data-code="${CSS.escape(code)}"] .idmgr-code-name-input`);
      const label = input.value.trim();
      if (!label) { showToast('Name cannot be empty'); return; }
      try { cfg.rename(code, label); showToast(`Updated code ${code}`); ctx.refresh(); editingCode = null; paint(); } catch (err) { showToast(err.message); }
    }));
    list.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', () => {
      const code = btn.dataset.toggle;
      const rec = cfg.get().find(r => r.code === code);
      cfg.setActive(code, rec.active === false);
      ctx.refresh();
      paint();
    }));
    wireOverflowMenus(list);
    list.querySelector('#idmgr-code-add').addEventListener('click', () => {
      const codeInput = list.querySelector('#idmgr-code-new-code');
      const nameInput = list.querySelector('#idmgr-code-new-name');
      const code = codeInput.value.trim();
      const name = nameInput.value.trim();
      if (!code || !name) { showToast('Enter both a code and a name'); return; }
      try {
        cfg.add(code, name);
        showToast(`Added ${cfg.title.toLowerCase()} ${code}`);
        paint();
      } catch (err) { showToast(err.message); }
    });
  }
  paint();
}

/* =============================================================
 * Upload Cattle Videos
 * -------------------------------------------------------------
 * Video ID field first: search or type an existing ID (inline
 * preview + explicit add-clips-vs-create-separate choice, since
 * duplicates are allowed on purpose) or expand the builder if you
 * don't have one yet. Listing Image is intentionally not part of
 * this flow anymore — the field stays in the data model (see
 * mock-data.js/repository.js) so nothing historical breaks, it's
 * just not offered here.
 * ============================================================= */
export function openUploadModal(ctx) {
  const sexes = ctx.ref.getSexTypes(), sires = ctx.ref.getSireTypes(), dams = ctx.ref.getDamTypes();
  const consignors = ctx.ref.getConsignors();
  let buildOpen = false;
  let builtId = null;
  let matchedExisting = null;
  let idChoice = null; // 'add-to-existing' | 'create-separate'
  const pickedFiles = []; // { file, progress, status, durationSec }

  const { modal, close } = mountModal(`
    <div class="vm-modal-header"><h2>Upload Cattle Videos</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
    <div class="vm-modal-body">
      <div class="field">
        <label>Video ID</label>
        <input type="text" id="um-id-input" placeholder="Search or enter an existing Video ID…" autocomplete="off" />
      </div>
      <div id="um-id-result"></div>
      <button class="vm-build-toggle-link" id="um-build-toggle" type="button">Don't have a Video ID? Build one →</button>

      <div id="um-build-panel" style="display:none;margin-top:16px;">
        <div class="field">
          <label>Consignor <button type="button" class="btn btn-sm btn-ghost" id="um-new-consignor" style="margin-left:6px">+ Add New</button></label>
          <select id="um-b-consignor"><option value="">Select consignor…</option>
            ${consignors.map(c => `<option value="${c.code}">${c.name} (${c.code})${c.flaggedNew ? ' — NEW' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div><label>Sex</label><select id="um-b-sex"><option value="">Select…</option>${sexes.map(s => `<option value="${s.code}">${s.code}- ${s.label}</option>`).join('')}</select></div>
          <div><label>Weight</label><input type="number" id="um-b-weight" placeholder="450" /></div>
        </div>
        <div class="field-row">
          <div><label>Sire</label><select id="um-b-sire"><option value="">Select…</option>${sires.map(s => `<option value="${s.code}">${s.code}- ${s.label}</option>`).join('')}</select></div>
          <div><label>Dam</label><select id="um-b-dam"><option value="">Select…</option>${dams.map(s => `<option value="${s.code}">${s.code}- ${s.label}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Month / Year</label><input type="month" id="um-b-monthyear" /></div>
        <div class="vm-generated-id-box is-placeholder" id="um-b-preview">
          <div><div class="label">Generated Video ID</div><div class="id">Fill in all fields</div></div>
        </div>
        <div id="um-build-feedback"></div>
      </div>

      <div class="field" style="margin-top:18px;">
        <label>Cattle Videos</label>
        <div class="vm-dropzone" id="um-dropzone"><strong>Drop cattle clips here</strong><br>or choose files</div>
        <input type="file" id="um-file-input" accept="video/*" multiple style="display:none" />
        <div id="um-file-list"></div>
        <div id="um-file-summary" class="vm-upload-summary"></div>
      </div>

      <div class="field"><label>Notes</label><textarea id="um-notes" rows="3" placeholder="Optional notes…"></textarea></div>
    </div>
    <div class="vm-modal-footer">
      <button class="btn btn-ghost" data-modal-close>Cancel</button>
      <button class="btn btn-primary" id="um-submit">Create Video Record</button>
    </div>
  `, { wide: true });

  /* ----- Video ID field: live existing-record detection ----- */
  const idInput = modal.querySelector('#um-id-input');
  const idResult = modal.querySelector('#um-id-result');
  let debounceTimer;
  idInput.addEventListener('input', () => {
    matchedExisting = null; idChoice = null;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkIdInput, 200);
  });

  async function checkIdInput() {
    const raw = idInput.value.trim();
    const parsed = parseVideoId(raw);
    if (!raw || !parsed.valid) { idResult.innerHTML = ''; return; }
    const existing = await ctx.repo.findByFinalId(parsed.finalId);
    if (!existing) { matchedExisting = null; idResult.innerHTML = ''; return; }
    matchedExisting = existing;
    const sexLabel = ctx.ref.sexLabel(existing.sexCode) || existing.sexCode;
    const sireLabel = ctx.ref.sireLabel(existing.sireCode) || existing.sireCode;
    const damLabel = ctx.ref.damLabel(existing.damCode) || existing.damCode;
    const statusWord = existing.status === 'created' ? 'Created' : existing.status === 'hold' ? 'On Hold' : 'Ready to Make';
    idResult.innerHTML = `
      <div class="vm-id-search-result">
        <div class="vid">${escapeHtml(existing.videoId)}</div>
        <div class="line">${escapeHtml(existing.consignorName)}</div>
        <div class="line">${escapeHtml(cattleSummaryLine({ sexLabel, sireLabel, damLabel, weight: existing.weight, monthYear: existing.monthYear }))}</div>
        <div class="exists-note">This Video ID already has ${existing.clips.length} clip${existing.clips.length === 1 ? '' : 's'} and a ${statusWord} video.</div>
        <div class="vm-id-search-choices">
          <button class="btn btn-sm ${idChoice === 'add-to-existing' ? 'btn-primary' : ''}" id="um-choice-add" type="button">Add clips to existing record</button>
          <button class="btn btn-sm ${idChoice === 'create-separate' ? 'btn-primary' : ''}" id="um-choice-separate" type="button">Create another record using this Video ID</button>
        </div>
      </div>`;
    idResult.querySelector('#um-choice-add').addEventListener('click', () => { idChoice = 'add-to-existing'; checkIdInput(); });
    idResult.querySelector('#um-choice-separate').addEventListener('click', () => { idChoice = 'create-separate'; checkIdInput(); });
  }

  /* ----- Build Video ID (collapsed by default) ----- */
  const buildPanel = modal.querySelector('#um-build-panel');
  const buildToggle = modal.querySelector('#um-build-toggle');
  buildToggle.addEventListener('click', () => {
    buildOpen = !buildOpen;
    buildPanel.style.display = buildOpen ? '' : 'none';
    buildToggle.textContent = buildOpen ? '← Hide builder' : "Don't have a Video ID? Build one →";
  });

  modal.querySelector('#um-new-consignor').addEventListener('click', async () => {
    const rec = await openNewConsignorModal(ctx);
    if (rec) {
      const sel = modal.querySelector('#um-b-consignor');
      sel.insertAdjacentHTML('beforeend', `<option value="${rec.code}">${rec.name} (${rec.code}) — NEW</option>`);
      sel.value = rec.code;
    }
  });

  function updateBuildPreview() {
    const consignorCode = modal.querySelector('#um-b-consignor').value;
    const sexCode = modal.querySelector('#um-b-sex').value;
    const sireCode = modal.querySelector('#um-b-sire').value;
    const damCode = modal.querySelector('#um-b-dam').value;
    const weight = modal.querySelector('#um-b-weight').value;
    const monthYear = inputValueToMonthYear(modal.querySelector('#um-b-monthyear').value);
    const box = modal.querySelector('#um-b-preview');
    if (consignorCode && sexCode && sireCode && damCode && weight && monthYear.length === 4) {
      builtId = buildBaseId({ consignorCode, sexCode, sireCode, damCode, weight, monthYear });
      box.classList.remove('is-placeholder');
      box.innerHTML = `<div><div class="label">Generated Video ID</div><div class="id">${escapeHtml(builtId)}</div></div><button class="btn btn-sm btn-ghost" id="um-b-copy" type="button">Copy</button>`;
      box.querySelector('#um-b-copy').addEventListener('click', async () => { await copyToClipboard(builtId); showToast('Copied'); });
    } else {
      builtId = null;
      box.classList.add('is-placeholder');
      box.innerHTML = `<div><div class="label">Generated Video ID</div><div class="id">Fill in all fields</div></div>`;
    }
  }
  buildPanel.addEventListener('change', updateBuildPreview);
  buildPanel.addEventListener('input', updateBuildPreview);

  /* ----- file picking + mock resumable-upload simulation ----- */
  const dropzone = modal.querySelector('#um-dropzone');
  const fileInput = modal.querySelector('#um-file-input');
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', e => e.preventDefault());
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    [...(e.dataTransfer?.files || [])].forEach(file => addFileRow(file));
  });
  fileInput.addEventListener('change', () => {
    [...fileInput.files].forEach(file => addFileRow(file));
    fileInput.value = '';
  });

  function addFileRow(file) {
    const entry = { file, progress: 0, status: 'uploading', durationSec: null };
    pickedFiles.push(entry);
    renderFileList();
    simulateUpload(entry);
    readDuration(file).then(d => { entry.durationSec = d; renderFileList(); });
  }

  function readDuration(file) {
    return new Promise(resolve => {
      try {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => { resolve(Math.round(v.duration) || null); URL.revokeObjectURL(url); };
        v.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
        v.src = url;
      } catch { resolve(null); }
    });
  }

  function simulateUpload(entry) {
    const willFail = Math.random() < 0.12 && entry.progress === 0;
    const timer = setInterval(() => {
      if (entry.status !== 'uploading') { clearInterval(timer); return; }
      entry.progress += 8 + Math.random() * 14;
      if (willFail && entry.progress > 45) {
        entry.status = 'failed'; entry.progress = 45; clearInterval(timer);
      } else if (entry.progress >= 100) {
        entry.progress = 100; entry.status = 'complete'; clearInterval(timer);
      }
      renderFileList();
    }, 220);
  }

  function renderFileList() {
    const list = modal.querySelector('#um-file-list');
    list.innerHTML = pickedFiles.map((entry, i) => `
      <div class="vm-upload-file-row">
        <div style="flex:1">
          <div class="name">${escapeHtml(entry.file.name)} · ${entry.durationSec != null ? formatDuration(entry.durationSec) : formatBytes(entry.file.size)}</div>
          <div class="vm-progress-bar"><div class="vm-progress-fill ${entry.status === 'failed' ? 'failed' : entry.status === 'complete' ? 'complete' : ''}" style="width:${entry.progress}%"></div></div>
          <div class="vm-upload-status">${entry.status === 'uploading' ? `Uploading… ${Math.round(entry.progress)}%` : entry.status === 'complete' ? 'Complete' : 'Failed — connection dropped'}</div>
        </div>
        ${entry.status === 'failed' ? `<button class="btn btn-sm" data-retry="${i}" type="button">Retry</button>` : ''}
        <button class="btn btn-icon btn-ghost" data-remove-file="${i}" type="button" title="Remove">×</button>
      </div>
    `).join('');
    const summary = modal.querySelector('#um-file-summary');
    const totalDur = pickedFiles.reduce((s, e) => s + (e.durationSec || 0), 0);
    summary.textContent = pickedFiles.length ? `${pickedFiles.length} clip${pickedFiles.length === 1 ? '' : 's'}${totalDur ? ` · ${formatDuration(totalDur)} total` : ''}` : '';
    list.querySelectorAll('[data-retry]').forEach(b => b.addEventListener('click', () => {
      const entry = pickedFiles[Number(b.dataset.retry)];
      entry.status = 'uploading'; entry.progress = 0;
      simulateUpload(entry);
    }));
    list.querySelectorAll('[data-remove-file]').forEach(b => b.addEventListener('click', () => {
      pickedFiles.splice(Number(b.dataset.removeFile), 1);
      renderFileList();
    }));
  }

  /* ----- submit ----- */
  modal.querySelector('#um-submit').addEventListener('click', async () => {
    const clips = pickedFiles.filter(e => e.status === 'complete').map(e => ({
      id: 'clip_' + Math.random().toString(36).slice(2, 10),
      filename: e.file.name,
      swatch: Math.floor(Math.random() * 8),
      durationSec: e.durationSec,
      sizeBytes: e.file.size,
      uploader: 'Staff',
      uploadedAt: new Date().toISOString(),
      isOriginal: true,
      fileHandle: e.file,
    }));
    const notes = modal.querySelector('#um-notes').value.trim();

    // Case 1: the typed/searched ID matched an existing record and a choice was made inline.
    if (matchedExisting) {
      if (!idChoice) { showToast('Choose whether to add clips or create a separate record'); return; }
      if (idChoice === 'add-to-existing') {
        await ctx.repo.addClips(matchedExisting.id, clips, 'Staff');
        showToast(`${clips.length} clip(s) added to ${matchedExisting.videoId}`);
        close(); ctx.refresh();
        return;
      }
      const suffix = await ctx.repo.nextSuffixFor(matchedExisting.baseVideoId);
      const fields = {
        consignorCode: matchedExisting.consignorCode, sexCode: matchedExisting.sexCode,
        sireCode: matchedExisting.sireCode, damCode: matchedExisting.damCode,
        weight: matchedExisting.weight, monthYear: matchedExisting.monthYear,
      };
      const record = await ctx.repo.createVideo({ ...fields, suffix, status: 'ready', notes, clips }, 'Staff');
      showToast(`Created ${record.videoId}`);
      close(); ctx.refresh();
      return;
    }

    // Case 2: fresh ID (typed or built) — full resolution loop (unrecognized codes + a
    // collision safety-net, since the Build panel doesn't get the live inline check above).
    const rawId = builtId || idInput.value.trim();
    if (!rawId) { showToast('Enter a Video ID or build one'); return; }

    const feedbackEl = buildOpen ? modal.querySelector('#um-build-feedback') : null;
    const outcome = await handleIdEntryLoop(rawId, ctx, feedbackEl);
    if (!outcome) return; // user cancelled somewhere in the loop

    if (outcome.type === 'open') { close(); ctx.openDrawer(outcome.existing.id); return; }

    if (outcome.type === 'add-to-existing') {
      await ctx.repo.addClips(outcome.existing.id, clips, 'Staff');
      showToast(`${clips.length} clip(s) added to ${outcome.existing.videoId}`);
      close(); ctx.refresh();
      return;
    }

    let suffix = outcome.fields.suffix || null;
    if (outcome.type === 'create-separate') suffix = await ctx.repo.nextSuffixFor(outcome.baseId);
    const record = await ctx.repo.createVideo({ ...outcome.fields, suffix, status: 'ready', notes, clips }, 'Staff');
    showToast(`Created ${record.videoId}`);
    close();
    ctx.refresh();
  });
}

/**
 * Shared id-entry resolution loop: handles unrecognized codes (inline
 * quick-add) and collisions (3-way modal), looping until the id is
 * clean or the user backs out. `feedbackEl` (optional) receives inline
 * structural-error messages; when omitted, a toast is used instead.
 * Returns:
 *   null                                        — cancelled
 *   { type:'create', fields }                   — safe to create
 *   { type:'create-separate', fields, baseId }  — create with next suffix
 *   { type:'add-to-existing', existing, fields }
 *   { type:'open', existing }
 */
async function handleIdEntryLoop(rawId, ctx, feedbackEl) {
  let current = rawId;
  for (let guard = 0; guard < 6; guard++) {
    const result = await resolveVideoIdEntry(current, ctx);

    if (result.reason === 'invalid') {
      if (feedbackEl) {
        feedbackEl.innerHTML = `<div class="vm-unrecognized-inline" style="background:var(--danger-bg);border-color:rgba(239,74,95,0.4);color:#ff8fa3">${escapeHtml(result.error)}</div>`;
      } else {
        showToast(result.error);
      }
      return null;
    }

    if (result.ok) {
      if (feedbackEl) feedbackEl.innerHTML = '';
      return { type: 'create', fields: result.fields, baseId: result.baseId };
    }

    if (result.reason === 'unrecognized') {
      for (const m of result.missing) {
        const added = await openQuickAddCodeModal(m.kind, m.code, ctx);
        if (!added) return null;
      }
      continue; // re-resolve with new reference data
    }

    if (result.reason === 'collision') {
      const choice = await openCollisionModal(result.existing, result.baseId, ctx);
      if (!choice.action) return null;
      if (choice.action === 'open') return { type: 'open', existing: result.existing };
      if (choice.action === 'add') return { type: 'add-to-existing', existing: result.existing, fields: result.parsed };
      if (choice.action === 'create') return { type: 'create-separate', fields: result.parsed, baseId: result.baseId };
    }
  }
  return null;
}

export { handleIdEntryLoop };

/* =============================================================
 * CSV Usage Import
 * ============================================================= */
export function openCsvImportModal(ctx) {
  let step = 'upload'; // upload -> preview -> done
  let csvText = '';
  let preview = null;
  let lastImportId = null;

  const { modal, close } = mountModal(renderStep(), { wide: true });
  wire();

  function renderStep() {
    const steps = ['Upload', 'Preview', 'Confirm'];
    const stepIdx = step === 'upload' ? 0 : step === 'preview' ? 1 : 2;
    const stepsHtml = `<div class="vm-csv-steps">${steps.map((s, i) => `<div class="vm-csv-step ${i === stepIdx ? 'active' : i < stepIdx ? 'done' : ''}">${s}</div>`).join('')}</div>`;

    if (step === 'upload') {
      return `
        <div class="vm-modal-header"><h2>Import Auction Usage CSV</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
        <div class="vm-modal-body">
          ${stepsHtml}
          <p class="muted" style="margin-bottom:12px;">Columns: Auction Date, Lot Number, YouTube Link (optionally Auction Name, Consignor). The same YouTube link may appear on multiple rows — that's valid, it means one video was used on multiple lots.</p>
          <div class="field"><label>CSV File</label><input type="file" id="csv-file-input" accept=".csv,text/csv" /></div>
          <div class="field"><label>…or paste CSV text</label><textarea id="csv-text-input" rows="8" placeholder="Auction Date,Lot Number,YouTube Link,Auction Name&#10;2026-08-13,800-A,https://youtu.be/tlh450heifers,August Feeder Special"></textarea></div>
        </div>
        <div class="vm-modal-footer">
          <button class="btn btn-ghost" data-modal-close>Cancel</button>
          <button class="btn btn-primary" id="csv-preview-btn">Preview Import</button>
        </div>`;
    }

    if (step === 'preview') {
      const { matched, repeated, unmatched, ambiguous } = preview;
      const rowsHtml = (rows, cols) => rows.length ? `
        <table class="vm-csv-table"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.slice(0, 8).map(r => `<tr>
          <td>${escapeHtml(r.auctionDate)}</td><td>${escapeHtml(r.lot)}</td><td>${escapeHtml(r.youtubeLink)}</td>
          <td>${escapeHtml(r.video ? r.video.videoId : (r.reason || ''))}</td>
        </tr>`).join('')}</tbody></table>
        ${rows.length > 8 ? `<p class="field-hint">+ ${rows.length - 8} more</p>` : ''}
      ` : `<p class="muted">None</p>`;

      return `
        <div class="vm-modal-header"><h2>Import Auction Usage CSV</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
        <div class="vm-modal-body">
          ${stepsHtml}
          <div class="vm-csv-summary-grid">
            <div class="vm-csv-summary-card matched"><div class="n">${matched.length}</div><div class="l">Matched</div></div>
            <div class="vm-csv-summary-card repeated"><div class="n">${repeated.length}</div><div class="l">Repeated Uses</div></div>
            <div class="vm-csv-summary-card unmatched"><div class="n">${unmatched.length}</div><div class="l">Unmatched</div></div>
            <div class="vm-csv-summary-card ambiguous"><div class="n">${ambiguous.length}</div><div class="l">Ambiguous</div></div>
          </div>
          <div class="vm-drawer-section-title">Matched + Repeated (will be applied)</div>
          ${rowsHtml([...matched, ...repeated], ['Date', 'Lot', 'YouTube Link', 'Video ID'])}
          <div class="vm-drawer-section-title" style="margin-top:14px;">Unmatched / Ambiguous (skipped)</div>
          ${rowsHtml([...unmatched, ...ambiguous], ['Date', 'Lot', 'YouTube Link', 'Reason'])}
        </div>
        <div class="vm-modal-footer">
          <button class="btn btn-ghost" id="csv-back-btn">Back</button>
          <button class="btn btn-primary" id="csv-confirm-btn" ${(matched.length + repeated.length) === 0 ? 'disabled' : ''}>Confirm Import</button>
        </div>`;
    }

    // done
    return `
      <div class="vm-modal-header"><h2>Import Complete</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
      <div class="vm-modal-body">
        ${stepsHtml}
        <p style="font-size:14px;">Usage recorded for <strong>${preview._result.videosAffected}</strong> video${preview._result.videosAffected === 1 ? '' : 's'} (${preview._result.usesAdded} use${preview._result.usesAdded === 1 ? '' : 's'} total).</p>
      </div>
      <div class="vm-modal-footer">
        <button class="btn btn-danger" id="csv-undo-btn">Undo Import</button>
        <button class="btn btn-primary" data-modal-close>Done</button>
      </div>`;
  }

  function repaint() {
    modal.innerHTML = renderStep();
    wire();
  }

  function wire() {
    modal.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', close));
    const previewBtn = modal.querySelector('#csv-preview-btn');
    if (previewBtn) previewBtn.addEventListener('click', async () => {
      const fileInput = modal.querySelector('#csv-file-input');
      if (fileInput.files[0]) {
        csvText = await fileInput.files[0].text();
      } else {
        csvText = modal.querySelector('#csv-text-input').value;
      }
      if (!csvText.trim()) { showToast('Choose a file or paste CSV text'); return; }
      preview = ctx.usage.previewCsv(csvText);
      step = 'preview';
      repaint();
    });
    const backBtn = modal.querySelector('#csv-back-btn');
    if (backBtn) backBtn.addEventListener('click', () => { step = 'upload'; repaint(); });
    const confirmBtn = modal.querySelector('#csv-confirm-btn');
    if (confirmBtn) confirmBtn.addEventListener('click', () => {
      const result = ctx.usage.confirmImport(preview);
      preview._result = result;
      lastImportId = result.importId;
      step = 'done';
      repaint();
      ctx.refresh();
    });
    const undoBtn = modal.querySelector('#csv-undo-btn');
    if (undoBtn) undoBtn.addEventListener('click', () => {
      ctx.usage.undoImport(lastImportId);
      showToast('Import undone');
      close();
      ctx.refresh();
    });
  }
}

/* =============================================================
 * Delete confirmation — deliberately hard to trigger by accident.
 * Soft delete only (moves to Trash); staff must type the exact
 * Video ID before the final button enables.
 * ============================================================= */
export function openDeleteConfirmModal(rec, ctx, onDeleted) {
  const { modal, close } = mountModal(`
    <div class="vm-modal-header"><h2>Delete Video Record</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
    <div class="vm-modal-body">
      <div class="vm-delete-summary">
        <div class="vid">${escapeHtml(rec.videoId)}</div>
        <div class="row">${escapeHtml(rec.consignorName)}</div>
      </div>
      <div class="vm-delete-warning">
        <p>This moves the record to <strong>Trash</strong> — it disappears from Ready to Make / On Hold / Created immediately. Nothing is destroyed yet; it can be restored from Trash (Tools menu), or permanently deleted later.</p>
        <p style="margin-top:8px;">This will also affect:</p>
        <ul>
          <li>${rec.clips.length} source clip${rec.clips.length === 1 ? '' : 's'}</li>
          <li>${rec.youtubeUrl ? 'Publishing info — YouTube link and embed code' : 'No publishing info yet'}</li>
          <li>${rec.usage.length} auction usage record${rec.usage.length === 1 ? '' : 's'}</li>
          <li>${rec.previousYouTubeVideos.length} previous version${rec.previousYouTubeVideos.length === 1 ? '' : 's'}</li>
          <li>Notes and ${rec.activity.length} activity event${rec.activity.length === 1 ? '' : 's'}</li>
        </ul>
      </div>
      <div class="field" style="margin-top:14px;">
        <label>Type the Video ID to confirm — ${escapeHtml(rec.videoId)}</label>
        <input type="text" id="del-confirm-input" placeholder="Type the Video ID exactly" autocomplete="off" />
      </div>
    </div>
    <div class="vm-modal-footer">
      <button class="btn btn-ghost" data-modal-close>Cancel</button>
      <button class="btn btn-danger-solid" id="del-confirm-btn" type="button" disabled>Move to Trash</button>
    </div>
  `);
  const input = modal.querySelector('#del-confirm-input');
  const btn = modal.querySelector('#del-confirm-btn');
  input.addEventListener('input', () => { btn.disabled = input.value.trim() !== rec.videoId; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && btn.disabled) e.preventDefault(); });
  btn.addEventListener('click', async () => {
    if (input.value.trim() !== rec.videoId) return;
    await ctx.repo.trashVideo(rec.id, 'Staff');
    showToast(`${rec.videoId} moved to Trash`);
    close();
    if (onDeleted) onDeleted();
  });
}

/* =============================================================
 * Trash — restore, or permanently delete (separate, deliberate
 * two-step action: click once to arm, click again within a few
 * seconds to actually purge).
 * ============================================================= */
export function openTrashModal(ctx) {
  const { modal } = mountModal(`
    <div class="vm-modal-header"><h2>Trash</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
    <div class="vm-modal-body" id="trash-body"></div>
    <div class="vm-modal-footer"><button class="btn btn-primary" data-modal-close>Done</button></div>
  `, { wide: true });

  async function paint() {
    const body = modal.querySelector('#trash-body');
    const trashed = await ctx.repo.getTrashedVideos();
    if (!trashed.length) { body.innerHTML = `<p class="muted">Trash is empty.</p>`; return; }
    body.innerHTML = trashed.map(r => `
      <div class="vm-trash-row">
        <div>
          <div class="vid">${escapeHtml(r.videoId)}</div>
          <div class="row">${escapeHtml(r.consignorName)} · Deleted ${formatDate(r.deletedAt)}${r.deletedBy ? ` by ${escapeHtml(r.deletedBy)}` : ''}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-sm" data-restore="${r.id}" type="button">Restore</button>
          <button class="btn btn-sm btn-danger" data-purge="${r.id}" type="button">Delete Permanently</button>
        </div>
      </div>
    `).join('');

    body.querySelectorAll('[data-restore]').forEach(btn => btn.addEventListener('click', async () => {
      await ctx.repo.restoreVideo(btn.dataset.restore, 'Staff');
      showToast('Restored');
      ctx.refresh();
      paint();
    }));
    body.querySelectorAll('[data-purge]').forEach(btn => btn.addEventListener('click', async () => {
      if (btn.dataset.armed !== 'true') {
        btn.dataset.armed = 'true';
        btn.textContent = 'Confirm — cannot be undone';
        setTimeout(() => { if (btn.isConnected && btn.dataset.armed === 'true') { btn.dataset.armed = 'false'; btn.textContent = 'Delete Permanently'; } }, 4000);
        return;
      }
      await ctx.repo.purgeVideo(btn.dataset.purge);
      showToast('Permanently deleted');
      paint();
    }));
  }
  paint();
}

/* =============================================================
 * Notification settings
 * ============================================================= */
export function openNotificationsModal(ctx) {
  const { modal } = mountModal(`
    <div class="vm-modal-header"><h2>Notification Settings</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
    <div class="vm-modal-body">
      <p class="muted" style="margin-bottom:10px;">Watch a teammate to be notified when they create a video, upload clips, or update a video. (Prototype — no notifications are actually sent yet.)</p>
      <div id="notify-list"></div>
    </div>
    <div class="vm-modal-footer"><button class="btn btn-primary" data-modal-close>Done</button></div>
  `);
  const list = modal.querySelector('#notify-list');
  function paint() {
    list.innerHTML = ctx.notifications.getWatchList().map(s => `
      <div class="vm-notify-row">
        <div><div class="name">${escapeHtml(s.name)}</div><div class="role">${s.role}</div></div>
        <label class="switch"><input type="checkbox" data-watch="${s.id}" ${s.watch ? 'checked' : ''} /><span class="track"></span></label>
      </div>
    `).join('');
    list.querySelectorAll('[data-watch]').forEach(inp => {
      inp.addEventListener('change', () => ctx.notifications.setWatch(inp.dataset.watch, inp.checked));
    });
  }
  paint();
}
