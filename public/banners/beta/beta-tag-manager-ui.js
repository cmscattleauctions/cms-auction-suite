/* =============================================================
 * Beta OBS Builder — Verification Tags settings page
 * -------------------------------------------------------------
 * New Settings-area page (added as a nav tab in index.html, same
 * pattern as the existing "State Library" admin page). Lets an
 * authorized user (the shell already gates the whole app on Firebase
 * Auth + approval — see shared/auth.js) manage verification tags
 * (create/edit/enable/disable/delete/upload image).
 *
 * The CMS Stinger asset and the OBS local-path/tag-layout settings
 * that used to live on this same page now have their own tabs —
 * see beta-stinger-ui.js and beta-obs-settings-ui.js.
 *
 * Reuses Classic's existing CSS classes throughout (card, form-row,
 * two-col, img-drop, status-chip, del-btn, ...).
 * ============================================================= */

import { listTags, createTag, updateTag, setTagEnabled, deleteTag, setTagImage, reorderTags } from './beta-tags-data.js';
import { fetchAsBlob, downloadFile } from './beta-package-export.js';
import { safeFileStem } from './beta-video-match.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Extension from the tag's own storagePath (e.g. ".../tag.svg") — NOT hardcoded, since tags can be PNG or SVG. */
function tagImageExt(tag) {
  const path = tag.storagePath || '';
  const ext = path.split('.').pop();
  return ext && ext !== path ? ext.toLowerCase() : 'png';
}

let pendingTagImageFile = null;
let editingTagId = null;

export async function initTagManagerPage(root, { showToast }) {
  root.innerHTML = `
    <div class="admin-grid">
      <div style="display:grid;gap:20px;">
        <div class="card">
          <div class="section-title" id="tagFormTitle">Add Verification Tag</div>
          <div class="form-row">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" id="tagNameInput" placeholder="NHTC">
          </div>
          <div class="form-row">
            <label class="form-label">Detection Terms (one per line or comma-separated)</label>
            <textarea class="form-textarea mono" id="tagTermsInput" placeholder="NHTC&#10;N.H.T.C.&#10;Non Hormone Treated Cattle"></textarea>
          </div>
          <div class="form-row">
            <label class="form-label">Tag Image</label>
            <div class="img-drop" id="tagImgDrop">
              <input type="file" accept=".png,.svg,image/png,image/svg+xml" id="tagImgInput">
              <svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <p>Drop PNG or SVG or click to browse</p>
              <img id="tagImgThumb" class="img-preview-thumb">
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">Default Height (px, on a 3840×2160 canvas)</label>
            <input type="number" class="form-input" id="tagHeightInput" value="180" min="40" max="800">
          </div>
          <div class="two-col">
            <div class="form-row">
              <label class="form-label">Size Adjust (%)</label>
              <input type="number" class="form-input" id="tagSizeAdjustInput" value="100" min="10" max="400">
            </div>
            <div class="form-row">
              <label class="form-label">Vertical Offset (px)</label>
              <input type="number" class="form-input" id="tagVerticalOffsetInput" value="0" min="-500" max="500">
            </div>
          </div>
          <p class="helper" style="margin-top:-4px;margin-bottom:10px;">Sizing is automatic — every tag's actual visible content (padding trimmed) is scaled to match the global Tag Height in OBS Settings. These two only matter if a tag STILL looks off after that: 100% = no manual size change; negative offset moves it up, positive moves it down.</p>
          <div class="two-col">
            <button class="btn btn-success" id="btnSaveTag">Save Tag</button>
            <button class="btn btn-ghost" id="btnCancelEditTag" style="display:none;">Cancel Edit</button>
          </div>
          <p id="tagFormMsg" class="helper" style="margin-top:10px;min-height:18px;"></p>
        </div>
      </div>

      <div>
        <button class="btn btn-ghost btn-sm" id="btnDownloadAllTags" style="margin-bottom:10px;">Download All Tag Images</button>
        <div class="section-title">Verification Tags (<span id="tagLibCount">0</span>)</div>
        <p class="helper" style="margin-top:-6px;margin-bottom:10px;">Drag a tag to reorder — this is the order they're laid out in on the video (right-aligned, left to right).</p>
        <div class="state-library-grid" id="tagLibGrid"><p class="no-states">No verification tags configured yet.</p></div>
      </div>
    </div>
  `;

  wireForm(root, showToast);
  wireReorder(root, showToast);
  wireDownloadAll(root, showToast);
  await refreshTagList(root, showToast);
}

async function refreshTagList(root, showToast) {
  const tags = await listTags({ force: true });
  const grid = root.querySelector('#tagLibGrid');
  const count = root.querySelector('#tagLibCount');
  count.textContent = tags.length;
  if (!tags.length) { grid.innerHTML = `<p class="no-states">No verification tags configured yet.</p>`; return; }
  grid.innerHTML = tags.map(t => `
    <div class="state-lib-card tag-lib-card${t.enabled === false ? ' tag-disabled' : ''}" draggable="true" data-id="${esc(t.id)}">
      ${t.imageUrl ? `<img src="${esc(t.imageUrl)}" alt="${esc(t.name)}" draggable="false">` : `<div style="height:100px;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">No image</div>`}
      <div class="state-lib-label" style="flex-direction:column;align-items:stretch;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="state-abbr" style="font-size:13px;">${esc(t.name)}${t.enabled === false ? ' (disabled)' : ''}</span>
          <span class="status-chip ${t.enabled === false ? 'warn' : 'good'}" style="padding:2px 8px;font-size:10px;">${t.enabled === false ? 'Disabled' : 'Enabled'}</span>
        </div>
        <p class="helper" style="font-size:11px;">${(t.detectionTerms || []).map(esc).join(', ') || '(no detection terms)'}</p>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm beta-tag-edit" data-id="${esc(t.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm beta-tag-toggle" data-id="${esc(t.id)}">${t.enabled === false ? 'Enable' : 'Disable'}</button>
          ${t.imageUrl ? `<button class="tag-download-btn beta-tag-download" data-id="${esc(t.id)}" title="Download"><svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 3V16.5M7.5 12L12 16.5L16.5 12"/></svg></button>` : ''}
          <button class="del-btn beta-tag-delete" data-id="${esc(t.id)}" title="Delete">×</button>
        </div>
      </div>
    </div>`).join('');

  grid.querySelectorAll('.beta-tag-edit').forEach(btn => btn.addEventListener('click', () => startEditTag(root, btn.dataset.id, tags)));
  grid.querySelectorAll('.beta-tag-toggle').forEach(btn => btn.addEventListener('click', async () => {
    const tag = tags.find(t => t.id === btn.dataset.id);
    await setTagEnabled(tag.id, tag.enabled === false);
    await refreshTagList(root, showToast);
  }));
  grid.querySelectorAll('.beta-tag-download').forEach(btn => btn.addEventListener('click', async () => {
    const tag = tags.find(t => t.id === btn.dataset.id);
    btn.disabled = true;
    try {
      const blob = await fetchAsBlob(tag.imageUrl);
      downloadFile(blob, `${safeFileStem(tag.name)}.${tagImageExt(tag)}`);
    } catch (err) {
      console.error(err);
      showToast(`Failed to download ${tag.name}: ${err.message}`, true);
    } finally {
      btn.disabled = false;
    }
  }));
  grid.querySelectorAll('.beta-tag-delete').forEach(btn => btn.addEventListener('click', async () => {
    const tag = tags.find(t => t.id === btn.dataset.id);
    if (!confirm(`Delete verification tag "${tag.name}"? This cannot be undone. If historical builds may still reference it, consider Disable instead.`)) return;
    await deleteTag(tag.id);
    showToast(`${tag.name} deleted`);
    await refreshTagList(root, showToast);
  }));
}

function startEditTag(root, id, tags) {
  const tag = tags.find(t => t.id === id);
  if (!tag) return;
  editingTagId = id;
  root.querySelector('#tagFormTitle').textContent = `Edit "${tag.name}"`;
  root.querySelector('#tagNameInput').value = tag.name || '';
  root.querySelector('#tagTermsInput').value = (tag.detectionTerms || []).join('\n');
  root.querySelector('#tagHeightInput').value = tag.defaultHeightPx || 180;
  root.querySelector('#tagSizeAdjustInput').value = tag.sizeAdjustPct ?? 100;
  root.querySelector('#tagVerticalOffsetInput').value = tag.verticalOffsetPx ?? 0;
  root.querySelector('#btnCancelEditTag').style.display = '';
  const thumb = root.querySelector('#tagImgThumb');
  if (tag.imageUrl) { thumb.src = tag.imageUrl; thumb.style.display = 'block'; }
  root.scrollIntoView({ behavior: 'smooth' });
}

function resetTagForm(root) {
  editingTagId = null;
  pendingTagImageFile = null;
  root.querySelector('#tagFormTitle').textContent = 'Add Verification Tag';
  root.querySelector('#tagNameInput').value = '';
  root.querySelector('#tagTermsInput').value = '';
  root.querySelector('#tagHeightInput').value = 180;
  root.querySelector('#tagSizeAdjustInput').value = 100;
  root.querySelector('#tagVerticalOffsetInput').value = 0;
  root.querySelector('#tagImgInput').value = '';
  root.querySelector('#tagImgThumb').style.display = 'none';
  root.querySelector('#btnCancelEditTag').style.display = 'none';
}

function wireForm(root, showToast) {
  const drop = root.querySelector('#tagImgDrop');
  const input = root.querySelector('#tagImgInput');
  const ALLOWED_TAG_IMAGE_TYPES = ['image/png', 'image/svg+xml'];
  const handleFile = file => {
    if (!ALLOWED_TAG_IMAGE_TYPES.includes(file.type)) {
      showToast(`Tag image must be PNG or SVG (got "${file.type || 'unknown type'}").`, true);
      return;
    }
    pendingTagImageFile = file;
    const thumb = root.querySelector('#tagImgThumb');
    if (file.type === 'image/svg+xml') { thumb.src = URL.createObjectURL(file); thumb.style.display = 'block'; return; }
    const reader = new FileReader();
    reader.onload = e => { thumb.src = e.target.result; thumb.style.display = 'block'; };
    reader.readAsDataURL(file);
  };
  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  root.querySelector('#btnCancelEditTag').addEventListener('click', () => resetTagForm(root));

  root.querySelector('#btnSaveTag').addEventListener('click', async () => {
    const name = root.querySelector('#tagNameInput').value.trim();
    const terms = root.querySelector('#tagTermsInput').value;
    const height = Number(root.querySelector('#tagHeightInput').value) || 180;
    const sizeAdjustPct = Number(root.querySelector('#tagSizeAdjustInput').value) || 100;
    const verticalOffsetPx = Number(root.querySelector('#tagVerticalOffsetInput').value) || 0;
    const msg = root.querySelector('#tagFormMsg');
    if (!name) { showToast('Tag name is required.', true); return; }
    msg.textContent = 'Saving...';
    try {
      if (editingTagId) {
        await updateTag(editingTagId, { name, detectionTerms: terms, defaultHeightPx: height, sizeAdjustPct, verticalOffsetPx });
        if (pendingTagImageFile) await setTagImage(editingTagId, pendingTagImageFile);
        showToast(`${name} updated`);
      } else {
        await createTag({ name, detectionTerms: terms, defaultHeightPx: height, sizeAdjustPct, verticalOffsetPx, imageFile: pendingTagImageFile });
        showToast(`${name} created`);
      }
      resetTagForm(root);
      msg.textContent = '';
      await refreshTagList(root, showToast);
    } catch (err) {
      console.error(err);
      msg.textContent = 'Save failed.';
      showToast(err.message, true);
    }
  });
}

// Native HTML5 drag-and-drop, delegated on the grid so it keeps working
// across every refreshTagList() re-render without re-wiring per card.
function wireReorder(root, showToast) {
  const grid = root.querySelector('#tagLibGrid');
  let draggedEl = null;

  grid.addEventListener('dragstart', e => {
    const card = e.target.closest('.tag-lib-card');
    if (!card) return;
    draggedEl = card;
    card.classList.add('tag-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });

  grid.addEventListener('dragover', e => {
    if (!draggedEl) return;
    e.preventDefault();
    const target = e.target.closest('.tag-lib-card');
    if (!target || target === draggedEl) return;
    const rect = target.getBoundingClientRect();
    const before = (e.clientX - rect.left) < rect.width / 2;
    grid.insertBefore(draggedEl, before ? target : target.nextSibling);
  });

  grid.addEventListener('dragend', async () => {
    if (!draggedEl) return;
    draggedEl.classList.remove('tag-dragging');
    const newOrder = Array.from(grid.querySelectorAll('.tag-lib-card')).map(c => c.dataset.id);
    draggedEl = null;
    try {
      await reorderTags(newOrder);
      showToast('Tag order saved');
    } catch (err) {
      console.error(err);
      showToast('Failed to save new order — reloading.', true);
      await refreshTagList(root, showToast);
    }
  });
}

function wireDownloadAll(root, showToast) {
  root.querySelector('#btnDownloadAllTags').addEventListener('click', async () => {
    const btn = root.querySelector('#btnDownloadAllTags');
    const origText = btn.textContent;
    btn.disabled = true;
    try {
      const tags = await listTags();
      const withImage = tags.filter(t => t.imageUrl);
      if (!withImage.length) { showToast('No tag images to download yet.', true); return; }

      const zip = new JSZip();
      for (let i = 0; i < withImage.length; i++) {
        const t = withImage[i];
        btn.textContent = `Downloading ${i + 1}/${withImage.length}...`;
        const blob = await fetchAsBlob(t.imageUrl);
        zip.file(`${safeFileStem(t.name)}.${tagImageExt(t)}`, blob);
      }
      btn.textContent = 'Zipping...';
      const blob = await zip.generateAsync({ type: 'blob' });
      downloadFile(blob, 'CMS_Verification_Tags.zip');
      showToast(`${withImage.length} tag image${withImage.length === 1 ? '' : 's'} downloaded`);
    } catch (err) {
      console.error(err);
      showToast(`Failed to download tag images: ${err.message}`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}
