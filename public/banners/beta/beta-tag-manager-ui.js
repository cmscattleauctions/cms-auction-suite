/* =============================================================
 * Beta OBS Builder — Verification Tags settings page
 * -------------------------------------------------------------
 * New Settings-area page (added as a nav tab in index.html, same
 * pattern as the existing "State Library" admin page). Lets an
 * authorized user (the shell already gates the whole app on Firebase
 * Auth + approval — see shared/auth.js) manage:
 *   - verification tags (create/edit/enable/disable/delete/upload image)
 *   - the Beta local-path + tag-layout settings (beta-state.js)
 *   - the single CMS video-entry intro asset
 * Reuses Classic's existing CSS classes throughout (card, form-row,
 * two-col, img-drop, status-chip, del-btn, ...).
 * ============================================================= */

import * as State from './beta-state.js';
import { listTags, createTag, updateTag, setTagEnabled, deleteTag, setTagImage, addDetectionTerm } from './beta-tags-data.js';
import { getStingerConfig, saveStingerConfig, setStingerAsset } from './beta-stinger-data.js';

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
            <button class="btn btn-success" id="btnSaveTag">Save Tag</button>
            <button class="btn btn-ghost" id="btnCancelEditTag" style="display:none;">Cancel Edit</button>
          </div>
          <p id="tagFormMsg" class="helper" style="margin-top:10px;min-height:18px;"></p>
        </div>

        <div class="card">
          <div class="section-title">CMS Video Intro / Stinger</div>
          <div class="info-banner" style="margin-bottom:14px;font-size:12px;padding:12px 14px;">
            Implemented as a native <strong>OBS Stinger Transition</strong>, applied only as the incoming transition on every Lot Video scene — leaving a Video scene is always a plain Cut, never this Stinger. This is OBS's own built-in mechanism (no plugin, no script).<br><br>
            <strong>Known limitation:</strong> OBS activates the cattle video's Media Source (and restarts it) the instant the Stinger begins, not when it visually reveals the video — so the first fraction of a second of the cattle video plays underneath the Stinger before it's shown. Keep this clip short (well under 1 second is a reasonable target) to keep that unavoidable overlap imperceptible. A video asset is required — a static image has no natural end point for OBS to key the transition off of.
          </div>
          <div class="form-row">
            <label class="form-label">Stinger Video (MP4/MOV)</label>
            <div class="img-drop" id="introImgDrop">
              <input type="file" accept="video/mp4,video/quicktime" id="introImgInput">
              <svg viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <p>Drop the stinger clip or click to browse</p>
              <p id="introFileLabel" class="helper" style="margin-top:6px;"></p>
            </div>
          </div>
          <div class="two-col">
            <div class="form-row">
              <label class="form-label">Clip Length Estimate (ms)</label>
              <input type="number" class="form-input" id="introDurationInput" value="800" min="0" max="10000">
            </div>
            <div class="form-row">
              <label class="form-label">Transition Point (ms)</label>
              <input type="number" class="form-input" id="introTransitionPointInput" value="700" min="0" max="10000">
            </div>
          </div>
          <p class="helper" style="margin-top:-4px;margin-bottom:10px;">OBS actually uses the clip's own real length at runtime regardless of the estimate above — this is only a fallback/display value. Transition Point is when OBS's internal renderer swaps to the Video scene's content; largely invisible if your clip is opaque the whole way through.</p>
          <div class="two-col">
            <button class="btn btn-ghost toggle-btn" id="btnIntroEnabled">Enabled: No</button>
            <button class="btn btn-primary" id="btnSaveIntro">Save Stinger Settings</button>
          </div>
          <p id="introMsg" class="helper" style="margin-top:10px;min-height:18px;">Applies as a Transition Override on every Lot Video scene — fires only entering a Video scene, never leaving one, regardless of which scene you came from.</p>
        </div>

        <div class="card">
          <div class="section-title">OBS Beta Settings</div>
          <div class="form-row">
            <label class="form-label">Auction OBS Root (local path)</label>
            <input type="text" class="form-input mono" id="obsRootInput">
          </div>
          <div class="form-row">
            <label class="form-label">Auction Folder (e.g. 2026-09-10)</label>
            <input type="text" class="form-input" id="auctionFolderInput" placeholder="2026-09-10">
          </div>
          <div class="two-col">
            <div class="form-row">
              <label class="form-label">Tag Height (px)</label>
              <input type="number" class="form-input" id="layoutHeightInput" min="40" max="800">
            </div>
            <div class="form-row">
              <label class="form-label">Tag Spacing (px)</label>
              <input type="number" class="form-input" id="layoutSpacingInput" min="0" max="400">
            </div>
            <div class="form-row">
              <label class="form-label">Right Margin (px)</label>
              <input type="number" class="form-input" id="layoutRightInput" min="0" max="800">
            </div>
            <div class="form-row">
              <label class="form-label">Bottom Margin (px)</label>
              <input type="number" class="form-input" id="layoutBottomInput" min="0" max="800">
            </div>
          </div>
          <button class="btn btn-primary" id="btnSaveBetaSettings">Save Beta Settings</button>
          <p class="helper" style="margin-top:10px;">Tags always form a right-aligned horizontal row in the bottom-right corner, ordered by Sort Order below.</p>
        </div>
      </div>

      <div>
        <div class="section-title">Verification Tags (<span id="tagLibCount">0</span>)</div>
        <div class="state-library-grid" id="tagLibGrid"><p class="no-states">No verification tags configured yet.</p></div>
      </div>
    </div>
  `;

  wireForm(root, showToast);
  wireIntro(root, showToast);
  wireSettings(root, showToast);
  await refreshTagList(root, showToast);
  await refreshIntro(root);
  refreshSettingsForm(root);
}

async function refreshTagList(root, showToast) {
  const tags = await listTags({ force: true });
  const grid = root.querySelector('#tagLibGrid');
  const count = root.querySelector('#tagLibCount');
  count.textContent = tags.length;
  if (!tags.length) { grid.innerHTML = `<p class="no-states">No verification tags configured yet.</p>`; return; }
  grid.innerHTML = tags.map(t => `
    <div class="state-lib-card" data-id="${esc(t.id)}">
      ${t.imageUrl ? `<img src="${esc(t.imageUrl)}" alt="${esc(t.name)}">` : `<div style="height:100px;background:var(--blue);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;">No image</div>`}
      <div class="state-lib-label" style="flex-direction:column;align-items:stretch;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span class="state-abbr" style="font-size:13px;">${esc(t.name)}</span>
          <span class="status-chip ${t.enabled === false ? 'warn' : 'good'}" style="padding:2px 8px;font-size:10px;">${t.enabled === false ? 'Disabled' : 'Enabled'}</span>
        </div>
        <p class="helper" style="font-size:11px;">${(t.detectionTerms || []).map(esc).join(', ') || '(no detection terms)'}</p>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm beta-tag-edit" data-id="${esc(t.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm beta-tag-toggle" data-id="${esc(t.id)}">${t.enabled === false ? 'Enable' : 'Disable'}</button>
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
  root.querySelector('#tagImgInput').value = '';
  root.querySelector('#tagImgThumb').style.display = 'none';
  root.querySelector('#btnCancelEditTag').style.display = 'none';
}

function wireForm(root, showToast) {
  const drop = root.querySelector('#tagImgDrop');
  const input = root.querySelector('#tagImgInput');
  const handleFile = file => {
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
    const msg = root.querySelector('#tagFormMsg');
    if (!name) { showToast('Tag name is required.', true); return; }
    msg.textContent = 'Saving...';
    try {
      if (editingTagId) {
        await updateTag(editingTagId, { name, detectionTerms: terms, defaultHeightPx: height });
        if (pendingTagImageFile) await setTagImage(editingTagId, pendingTagImageFile);
        showToast(`${name} updated`);
      } else {
        await createTag({ name, detectionTerms: terms, defaultHeightPx: height, imageFile: pendingTagImageFile });
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

async function refreshIntro(root) {
  const cfg = await getStingerConfig();
  root.querySelector('#introDurationInput').value = cfg.durationMs || 800;
  root.querySelector('#introTransitionPointInput').value = cfg.transitionPointMs ?? 700;
  const btn = root.querySelector('#btnIntroEnabled');
  btn.textContent = `Enabled: ${cfg.enabled ? 'Yes' : 'No'}`;
  btn.classList.toggle('active', !!cfg.enabled);
  btn.dataset.enabled = cfg.enabled ? '1' : '0';
  if (cfg.fileName) {
    root.querySelector('#introFileLabel').textContent = `Current: ${cfg.fileName}`;
  }
}

function wireIntro(root, showToast) {
  let pendingIntroFile = null;
  const drop = root.querySelector('#introImgDrop');
  const input = root.querySelector('#introImgInput');
  const handleFile = file => {
    if (!file.type.startsWith('video/')) { showToast('Stinger asset must be a video (MP4/MOV).', true); return; }
    pendingIntroFile = file;
    root.querySelector('#introFileLabel').textContent = `Ready: ${file.name}`;
  };
  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag-over'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  root.querySelector('#btnIntroEnabled').addEventListener('click', function () {
    const next = this.dataset.enabled !== '1';
    this.dataset.enabled = next ? '1' : '0';
    this.textContent = `Enabled: ${next ? 'Yes' : 'No'}`;
    this.classList.toggle('active', next);
  });

  root.querySelector('#btnSaveIntro').addEventListener('click', async () => {
    const msg = root.querySelector('#introMsg');
    const enabled = root.querySelector('#btnIntroEnabled').dataset.enabled === '1';
    const durationMs = Number(root.querySelector('#introDurationInput').value) || 800;
    const transitionPointMs = Number(root.querySelector('#introTransitionPointInput').value) || 0;
    msg.textContent = 'Saving...';
    try {
      if (pendingIntroFile) await setStingerAsset(pendingIntroFile);
      await saveStingerConfig({ enabled, durationMs, transitionPointMs });
      pendingIntroFile = null;
      msg.textContent = 'Stinger settings saved.';
      showToast('Stinger settings saved');
    } catch (err) {
      console.error(err);
      msg.textContent = 'Save failed.';
      showToast(err.message, true);
    }
  });
}

function refreshSettingsForm(root) {
  const s = State.getBetaSettings();
  root.querySelector('#obsRootInput').value = s.auctionObsRoot;
  root.querySelector('#auctionFolderInput').value = s.auctionFolder;
  root.querySelector('#layoutHeightInput').value = s.tagLayout.tagHeight;
  root.querySelector('#layoutSpacingInput').value = s.tagLayout.spacing;
  root.querySelector('#layoutRightInput').value = s.tagLayout.rightMargin;
  root.querySelector('#layoutBottomInput').value = s.tagLayout.bottomMargin;
}

function wireSettings(root, showToast) {
  root.querySelector('#btnSaveBetaSettings').addEventListener('click', () => {
    const s = State.getBetaSettings();
    s.auctionObsRoot = root.querySelector('#obsRootInput').value.trim() || s.auctionObsRoot;
    if (!s.auctionObsRoot.endsWith('/')) s.auctionObsRoot += '/';
    s.auctionFolder = root.querySelector('#auctionFolderInput').value.trim();
    s.tagLayout.tagHeight = Number(root.querySelector('#layoutHeightInput').value) || s.tagLayout.tagHeight;
    s.tagLayout.spacing = Number(root.querySelector('#layoutSpacingInput').value) || s.tagLayout.spacing;
    s.tagLayout.rightMargin = Number(root.querySelector('#layoutRightInput').value) || s.tagLayout.rightMargin;
    s.tagLayout.bottomMargin = Number(root.querySelector('#layoutBottomInput').value) || s.tagLayout.bottomMargin;
    State.saveBetaSettings(s);
    showToast('Beta settings saved');
  });
}
