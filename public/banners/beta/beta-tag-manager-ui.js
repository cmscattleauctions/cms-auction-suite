/* =============================================================
 * Beta OBS Builder — Verification Tags settings page
 * -------------------------------------------------------------
 * Lives under Assets -> Verification Tags (see index.html's Build/
 * Assets/Settings nav). Lets an authorized user (the shell already
 * gates the whole app on Firebase Auth + approval — see
 * shared/auth.js) manage verification tags (create/edit/enable/
 * disable/delete/upload image).
 *
 * Full-width card grid; editing happens in the shared right-side
 * drawer (../beta-drawer.js), not a permanently-visible form —
 * detection terms are implementation detail and only shown there,
 * never on the card.
 *
 * The CMS Stinger asset and the OBS local-path/tag-layout settings
 * live in their own places — see beta-stinger-ui.js and
 * beta-obs-settings-ui.js.
 *
 * Reuses Classic's existing CSS classes throughout (card, form-row,
 * two-col, img-drop, status-chip, del-btn, ...).
 * ============================================================= */

import { openDrawer, closeDrawer } from '../beta-drawer.js';
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

// Only meaningful while the drawer is open — set on drawer-open, cleared
// on drawer-close (whether via Save, Delete, or just dismissing it).
let pendingTagImageFile = null;
let editingTagId = null;

export async function initTagManagerPage(root, { showToast }) {
  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:6px;">
      <div>
        <div class="section-title" style="margin-bottom:2px;">Verification Tags</div>
        <p class="helper" id="tagLibCountLabel">0 tags</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost btn-sm" id="btnDownloadAllTags">Download All Tag Images</button>
        <button class="btn btn-primary" id="btnAddTag">+ Add Tag</button>
      </div>
    </div>
    <p class="helper" style="margin-top:-2px;margin-bottom:14px;">Drag a tag to reorder — this is the order they're laid out in on the video (right-aligned, left to right).</p>
    <div class="state-library-grid" id="tagLibGrid"><p class="no-states">No verification tags configured yet.</p></div>
  `;

  root.querySelector('#btnAddTag').addEventListener('click', () => openTagDrawer(root, showToast, null));
  wireReorder(root, showToast);
  wireDownloadAll(root, showToast);
  await refreshTagList(root, showToast);
}

async function refreshTagList(root, showToast) {
  const tags = await listTags({ force: true });
  const grid = root.querySelector('#tagLibGrid');
  const count = root.querySelector('#tagLibCountLabel');
  count.textContent = `${tags.length} tag${tags.length === 1 ? '' : 's'}`;
  if (!tags.length) { grid.innerHTML = `<p class="no-states">No verification tags configured yet.</p>`; return; }
  grid.innerHTML = tags.map(t => `
    <div class="state-lib-card tag-lib-card${t.enabled === false ? ' tag-disabled' : ''}" draggable="true" data-id="${esc(t.id)}" role="button" tabindex="0">
      ${t.imageUrl ? `<img src="${esc(t.imageUrl)}" alt="${esc(t.name)}" draggable="false">` : `<div style="height:100px;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">No image</div>`}
      <div class="state-lib-label" style="justify-content:space-between;">
        <span class="state-abbr" style="font-size:13px;">${esc(t.name)}</span>
        <span class="status-chip ${t.enabled === false ? 'warn' : 'good'}" style="padding:2px 8px;font-size:10px;">${t.enabled === false ? 'Disabled' : 'Enabled'}</span>
      </div>
    </div>`).join('');

  // Whole card opens the drawer — no permanently-visible action buttons.
  // Guard against a click firing right after a drag (native HTML5 DnD
  // still dispatches a click on release in most browsers).
  grid.querySelectorAll('.tag-lib-card').forEach(card => {
    const open = () => {
      const tag = tags.find(t => t.id === card.dataset.id);
      if (tag) openTagDrawer(root, showToast, tag);
    };
    card.addEventListener('click', () => { if (!card.classList.contains('tag-dragging')) open(); });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

function openTagDrawer(root, showToast, tag) {
  editingTagId = tag ? tag.id : null;
  pendingTagImageFile = null;

  const body = openDrawer({
    title: tag ? `Edit "${tag.name}"` : 'Add Verification Tag',
    onClose: () => { editingTagId = null; pendingTagImageFile = null; },
    bodyHtml: `
      <div class="form-row">
        <label class="form-label">Name</label>
        <input type="text" class="form-input" id="tagNameInput" placeholder="NHTC" value="${tag ? esc(tag.name) : ''}">
      </div>
      <div class="form-row">
        <label class="form-label">Detection Terms (one per line or comma-separated)</label>
        <textarea class="form-textarea mono" id="tagTermsInput" placeholder="NHTC&#10;N.H.T.C.&#10;Non Hormone Treated Cattle">${tag ? esc((tag.detectionTerms || []).join('\n')) : ''}</textarea>
      </div>
      <div class="form-row">
        <label class="form-label">Tag Image</label>
        <div class="img-drop" id="tagImgDrop">
          <input type="file" accept=".png,.svg,image/png,image/svg+xml" id="tagImgInput">
          <svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <p>Drop PNG or SVG or click to browse</p>
          <img id="tagImgThumb" class="img-preview-thumb" style="${tag && tag.imageUrl ? 'display:block' : ''}" ${tag && tag.imageUrl ? `src="${esc(tag.imageUrl)}"` : ''}>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">Default Height (px, on a 3840×2160 canvas)</label>
        <input type="number" class="form-input" id="tagHeightInput" value="${tag ? (tag.defaultHeightPx || 180) : 180}" min="40" max="800">
      </div>
      <div class="two-col">
        <div class="form-row">
          <label class="form-label">Size Adjust (%)</label>
          <input type="number" class="form-input" id="tagSizeAdjustInput" value="${tag ? (tag.sizeAdjustPct ?? 100) : 100}" min="10" max="400">
        </div>
        <div class="form-row">
          <label class="form-label">Vertical Offset (px)</label>
          <input type="number" class="form-input" id="tagVerticalOffsetInput" value="${tag ? (tag.verticalOffsetPx ?? 0) : 0}" min="-500" max="500">
        </div>
      </div>
      <p class="helper" style="margin-top:-4px;">Sizing is automatic — every tag's actual visible content (padding trimmed) is scaled to match the global Tag Height in Settings. These two only matter if a tag STILL looks off after that: 100% = no manual size change; negative offset moves it up, positive moves it down.</p>
      <div class="form-row">
        <label class="form-label">Status</label>
        <button type="button" class="btn btn-ghost toggle-btn" id="tagEnabledToggle" style="width:fit-content;">Enabled: ${tag && tag.enabled === false ? 'No' : 'Yes'}</button>
      </div>
      <div class="two-col">
        <button class="btn btn-success" id="btnSaveTag">Save Tag</button>
        ${tag ? `<button class="btn btn-danger" id="btnDeleteTag">Delete Tag</button>` : '<span></span>'}
      </div>
      ${tag && tag.imageUrl ? `<button class="btn btn-ghost btn-sm" id="btnDownloadThisTag" style="width:fit-content;">Download This Tag's Image</button>` : ''}
      <p id="tagFormMsg" class="helper" style="min-height:18px;"></p>
    `,
  });

  const enabledBtn = body.querySelector('#tagEnabledToggle');
  enabledBtn.dataset.enabled = (tag && tag.enabled === false) ? '0' : '1';
  enabledBtn.classList.toggle('active', enabledBtn.dataset.enabled === '1');
  enabledBtn.addEventListener('click', () => {
    const next = enabledBtn.dataset.enabled !== '1';
    enabledBtn.dataset.enabled = next ? '1' : '0';
    enabledBtn.textContent = `Enabled: ${next ? 'Yes' : 'No'}`;
    enabledBtn.classList.toggle('active', next);
  });

  const drop = body.querySelector('#tagImgDrop');
  const input = body.querySelector('#tagImgInput');
  const thumb = body.querySelector('#tagImgThumb');
  const ALLOWED_TAG_IMAGE_TYPES = ['image/png', 'image/svg+xml'];
  const handleFile = file => {
    if (!ALLOWED_TAG_IMAGE_TYPES.includes(file.type)) {
      showToast(`Tag image must be PNG or SVG (got "${file.type || 'unknown type'}").`, true);
      return;
    }
    pendingTagImageFile = file;
    if (file.type === 'image/svg+xml') { thumb.src = URL.createObjectURL(file); thumb.style.display = 'block'; return; }
    const reader = new FileReader();
    reader.onload = e => { thumb.src = e.target.result; thumb.style.display = 'block'; };
    reader.readAsDataURL(file);
  };
  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  const downloadThisBtn = body.querySelector('#btnDownloadThisTag');
  if (downloadThisBtn) {
    downloadThisBtn.addEventListener('click', async () => {
      downloadThisBtn.disabled = true;
      try {
        const blob = await fetchAsBlob(tag.imageUrl);
        downloadFile(blob, `${safeFileStem(tag.name)}.${tagImageExt(tag)}`);
      } catch (err) {
        console.error(err);
        showToast(`Failed to download ${tag.name}: ${err.message}`, true);
      } finally {
        downloadThisBtn.disabled = false;
      }
    });
  }

  const deleteBtn = body.querySelector('#btnDeleteTag');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete verification tag "${tag.name}"? This cannot be undone. If historical builds may still reference it, consider Disable instead.`)) return;
      try {
        await deleteTag(tag.id);
        showToast(`${tag.name} deleted`);
        closeDrawer();
        await refreshTagList(root, showToast);
      } catch (err) {
        console.error(err);
        showToast(err.message, true);
      }
    });
  }

  body.querySelector('#btnSaveTag').addEventListener('click', async () => {
    const name = body.querySelector('#tagNameInput').value.trim();
    const terms = body.querySelector('#tagTermsInput').value;
    const height = Number(body.querySelector('#tagHeightInput').value) || 180;
    const sizeAdjustPct = Number(body.querySelector('#tagSizeAdjustInput').value) || 100;
    const verticalOffsetPx = Number(body.querySelector('#tagVerticalOffsetInput').value) || 0;
    const enabled = enabledBtn.dataset.enabled === '1';
    const msg = body.querySelector('#tagFormMsg');
    if (!name) { showToast('Tag name is required.', true); return; }
    msg.textContent = 'Saving...';
    try {
      if (editingTagId) {
        await updateTag(editingTagId, { name, detectionTerms: terms, defaultHeightPx: height, sizeAdjustPct, verticalOffsetPx });
        await setTagEnabled(editingTagId, enabled);
        if (pendingTagImageFile) await setTagImage(editingTagId, pendingTagImageFile);
        showToast(`${name} updated`);
      } else {
        const newId = await createTag({ name, detectionTerms: terms, defaultHeightPx: height, sizeAdjustPct, verticalOffsetPx, imageFile: pendingTagImageFile });
        if (!enabled) await setTagEnabled(newId, false);
        showToast(`${name} created`);
      }
      closeDrawer();
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
