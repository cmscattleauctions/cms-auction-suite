/* =============================================================
 * CMS Video Manager — Modals
 * Upload screen, Video ID collision resolution, new consignor,
 * quick-add unrecognized code, CSV usage import, notifications.
 * ============================================================= */

import { escapeHtml, formatDate, formatBytes } from './format.js';
import { showToast } from './toast.js';
import { resolveVideoIdEntry, CODE_KIND_LABELS } from './id-workflow.js';
import { buildBaseId, formatMonthYear } from './video-id.js';

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
    const needsName = kind === 'consignor';
    const { modal, close } = mountModal(`
      <div class="vm-modal-header"><h2>${label} code ${escapeHtml(code)} is not recognized</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
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
 * Manage Consignors — list + inline rename + add new
 * ============================================================= */
export function openManageConsignorsModal(ctx) {
  const { modal } = mountModal(`
    <div class="vm-modal-header"><h2>Consignors</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
    <div class="vm-modal-body">
      <p class="muted" style="margin-bottom:12px;">Rename a consignor to fix a typo or update how their name appears — this updates every video already on file for them.</p>
      <div id="mc-list"></div>
    </div>
    <div class="vm-modal-footer">
      <button class="btn btn-ghost" id="mc-add" type="button">+ New Consignor</button>
      <button class="btn btn-primary" data-modal-close>Done</button>
    </div>
  `, { wide: true });

  const list = modal.querySelector('#mc-list');

  function paint() {
    const consignors = ctx.ref.getConsignors();
    list.innerHTML = consignors.map(c => `
      <div class="vm-notify-row" data-code="${escapeHtml(c.code)}">
        <div style="flex:1;display:flex;align-items:center;gap:8px;">
          <input type="text" class="mc-name-input" value="${escapeHtml(c.name)}" style="width:100%;max-width:280px;" />
          <span class="field-hint">#${escapeHtml(c.code)}</span>
          ${c.flaggedNew ? '<span class="status-pill status-hold">NEW — needs review</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;">
          ${c.flaggedNew ? `<button class="btn btn-sm btn-ghost" data-review="${escapeHtml(c.code)}" type="button">Mark reviewed</button>` : ''}
          <button class="btn btn-sm" data-save="${escapeHtml(c.code)}" type="button">Save</button>
        </div>
      </div>
    `).join('') || '<p class="muted">No consignors yet.</p>';

    list.querySelectorAll('[data-save]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.save;
        const input = list.querySelector(`.vm-notify-row[data-code="${CSS.escape(code)}"] .mc-name-input`);
        const name = input.value.trim();
        if (!name) { showToast('Name cannot be empty'); return; }
        try {
          ctx.ref.renameConsignor(code, name);
          showToast(`Updated ${name}`);
          ctx.refresh();
        } catch (err) {
          showToast(err.message);
        }
      });
    });
    list.querySelectorAll('[data-review]').forEach(btn => {
      btn.addEventListener('click', () => {
        ctx.ref.clearConsignorFlag(btn.dataset.review);
        paint();
      });
    });
  }
  paint();

  modal.querySelector('#mc-add').addEventListener('click', async () => {
    const rec = await openNewConsignorModal(ctx);
    if (rec) paint();
  });
}

/* =============================================================
 * Full Upload Screen
 * ============================================================= */
export function openUploadModal(ctx) {
  const sexes = ctx.ref.getSexTypes(), sires = ctx.ref.getSireTypes(), dams = ctx.ref.getDamTypes();
  const consignors = ctx.ref.getConsignors();
  let mode = 'enter'; // 'enter' | 'build'
  const pickedFiles = []; // { file, progress, status }
  let listingImageDataUrl = null;

  const { modal, close } = mountModal(`
    <div class="vm-modal-header"><h2>Upload Video</h2><button class="vm-modal-close" data-modal-close>&times;</button></div>
    <div class="vm-modal-body">
      <div class="vm-idbuild-toggle">
        <button class="btn active" data-mode="enter" type="button">Enter Video ID</button>
        <button class="btn" data-mode="build" type="button">Build Video ID</button>
      </div>

      <div id="um-enter-panel">
        <div class="field"><label>Video ID</label><input type="text" id="um-id-input" placeholder="21.2.2.2.450.0826" /></div>
        <div id="um-id-feedback"></div>
      </div>

      <div id="um-build-panel" style="display:none">
        <div class="field">
          <label>Consignor <button type="button" class="btn btn-sm btn-ghost" id="um-new-consignor" style="margin-left:6px">+ Add New</button></label>
          <select id="um-b-consignor"><option value="">Select consignor…</option>
            ${consignors.map(c => `<option value="${c.code}">${c.name} (${c.code})${c.flaggedNew ? ' — NEW' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="field-row">
          <div><label>Sex</label><select id="um-b-sex"><option value="">Select…</option>${sexes.map(s => `<option value="${s.code}">${s.label}</option>`).join('')}</select></div>
          <div><label>Weight</label><input type="number" id="um-b-weight" placeholder="450" /></div>
        </div>
        <div class="field-row">
          <div><label>Sire</label><select id="um-b-sire"><option value="">Select…</option>${sires.map(s => `<option value="${s.code}">${s.label}</option>`).join('')}</select></div>
          <div><label>Dam</label><select id="um-b-dam"><option value="">Select…</option>${dams.map(s => `<option value="${s.code}">${s.label}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Month / Year</label><input type="text" id="um-b-monthyear" placeholder="0826 (Aug 2026)" maxlength="4" /></div>
        <div class="field-hint" id="um-b-preview" style="margin-bottom:14px;"></div>
        <div id="um-build-feedback"></div>
      </div>

      <div class="field" style="margin-top:18px;">
        <label>Cattle Videos</label>
        <div class="vm-dropzone" id="um-dropzone"><strong>Click to choose files</strong><br>or drag video files here</div>
        <input type="file" id="um-file-input" accept="video/*" multiple style="display:none" />
        <div id="um-file-list"></div>
      </div>

      <div class="field">
        <label>Optional Listing Image</label>
        <input type="file" id="um-image-input" accept="image/*" />
        <div id="um-image-preview" class="field-hint"></div>
      </div>

      <div class="field"><label>Notes</label><textarea id="um-notes" rows="3" placeholder="Optional notes…"></textarea></div>
    </div>
    <div class="vm-modal-footer">
      <button class="btn btn-ghost" data-modal-close>Cancel</button>
      <button class="btn btn-primary" id="um-submit">Create Video Record</button>
    </div>
  `, { wide: true });

  /* mode toggle */
  modal.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      modal.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
      modal.querySelector('#um-enter-panel').style.display = mode === 'enter' ? '' : 'none';
      modal.querySelector('#um-build-panel').style.display = mode === 'build' ? '' : 'none';
    });
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
    const monthYear = modal.querySelector('#um-b-monthyear').value;
    const preview = modal.querySelector('#um-b-preview');
    if (consignorCode && sexCode && sireCode && damCode && weight && monthYear.length === 4) {
      const id = buildBaseId({ consignorCode, sexCode, sireCode, damCode, weight, monthYear });
      preview.innerHTML = `Generated ID: <strong style="color:var(--text)">${id}</strong>`;
    } else {
      preview.textContent = 'Fill in all fields to generate the Video ID.';
    }
  }
  modal.querySelector('#um-build-panel').addEventListener('change', updateBuildPreview);
  modal.querySelector('#um-build-panel').addEventListener('input', updateBuildPreview);

  /* file picking + mock resumable-upload simulation */
  const dropzone = modal.querySelector('#um-dropzone');
  const fileInput = modal.querySelector('#um-file-input');
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    [...fileInput.files].forEach(file => addFileRow(file));
    fileInput.value = '';
  });

  function addFileRow(file) {
    const entry = { file, progress: 0, status: 'uploading' };
    pickedFiles.push(entry);
    renderFileList();
    simulateUpload(entry);
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
          <div class="name">${escapeHtml(entry.file.name)} · ${formatBytes(entry.file.size)}</div>
          <div class="vm-progress-bar"><div class="vm-progress-fill ${entry.status === 'failed' ? 'failed' : entry.status === 'complete' ? 'complete' : ''}" style="width:${entry.progress}%"></div></div>
          <div class="vm-upload-status">${entry.status === 'uploading' ? `Uploading… ${Math.round(entry.progress)}%` : entry.status === 'complete' ? 'Complete' : 'Failed — connection dropped'}</div>
        </div>
        ${entry.status === 'failed' ? `<button class="btn btn-sm" data-retry="${i}">Retry</button>` : ''}
        <button class="btn btn-sm btn-ghost" data-remove-file="${i}">Remove</button>
      </div>
    `).join('');
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

  modal.querySelector('#um-image-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      listingImageDataUrl = reader.result;
      modal.querySelector('#um-image-preview').innerHTML = `<img src="${reader.result}" style="max-width:120px;border-radius:6px;margin-top:6px;display:block" />`;
    };
    reader.readAsDataURL(file);
  });

  /* submit */
  modal.querySelector('#um-submit').addEventListener('click', async () => {
    let rawId;
    if (mode === 'enter') {
      rawId = modal.querySelector('#um-id-input').value.trim();
      if (!rawId) { showToast('Enter a Video ID or switch to Build Video ID'); return; }
    } else {
      const consignorCode = modal.querySelector('#um-b-consignor').value;
      const sexCode = modal.querySelector('#um-b-sex').value;
      const sireCode = modal.querySelector('#um-b-sire').value;
      const damCode = modal.querySelector('#um-b-dam').value;
      const weight = modal.querySelector('#um-b-weight').value;
      const monthYear = modal.querySelector('#um-b-monthyear').value;
      if (!consignorCode || !sexCode || !sireCode || !damCode || !weight || monthYear.length !== 4) {
        showToast('Fill in all fields to build the Video ID'); return;
      }
      rawId = buildBaseId({ consignorCode, sexCode, sireCode, damCode, weight, monthYear });
    }

    const feedbackEl = modal.querySelector(mode === 'enter' ? '#um-id-feedback' : '#um-build-feedback');
    const outcome = await handleIdEntryLoop(rawId, ctx, feedbackEl);
    if (!outcome) return; // user cancelled somewhere in the loop

    if (outcome.type === 'open') {
      close();
      ctx.openDrawer(outcome.existing.id);
      return;
    }

    const clips = pickedFiles.filter(e => e.status === 'complete').map(e => ({
      id: 'clip_' + Math.random().toString(36).slice(2, 10),
      filename: e.file.name,
      swatch: Math.floor(Math.random() * 8),
      durationSec: null,
      sizeBytes: e.file.size,
      uploader: 'Staff',
      uploadedAt: new Date().toISOString(),
      isOriginal: true,
      fileHandle: e.file,
    }));

    let fields = outcome.fields;
    let suffix = fields.suffix || null;
    if (outcome.type === 'create-separate') {
      suffix = await ctx.repo.nextSuffixFor(outcome.baseId);
    }

    const record = await ctx.repo.createVideo({
      ...fields, suffix,
      status: 'ready',
      notes: modal.querySelector('#um-notes').value.trim(),
      clips,
      listingImageUrl: listingImageDataUrl,
    }, 'Staff');

    if (outcome.type === 'add-to-existing') {
      await ctx.repo.addClips(outcome.existing.id, clips, 'Staff');
      showToast(`${clips.length} clip(s) added to ${outcome.existing.videoId}`);
    } else {
      showToast(`Created ${record.videoId}`);
    }
    close();
    ctx.refresh();
  });

  modal.querySelector('.vm-modal-close').addEventListener('click', () => {});
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
