/* =============================================================
 * Beta OBS Builder — Settings page
 * -------------------------------------------------------------
 * Build Mode, File Locations, and Verification Tag Placement, all
 * consolidated onto one page (index.html's Build/Assets/Settings
 * nav). Build Mode applies immediately on selection (no Save button
 * of its own, matching the header dropdown's instant-apply behavior
 * it mirrors); File Locations and Tag Placement share ONE Save flow
 * since both write into the same Firestore doc (obsBetaSettings/
 * default) and splitting them risked a partial-save inconsistency
 * with the existing fallback-to-previous-value pattern below.
 * ============================================================= */

import * as State from './beta-state.js';
import { renderTagPlacementPreview } from './beta-tag-preview.js';
import { renderModeNotice } from './beta-mode-notice.js';

/**
 * @param opts.showToast
 * @param opts.setBuildMode  shared mode-switch function from index.html
 *   (wraps State.setBuildMode + the header dropdown's own UI update +
 *   a Beta review re-run when needed) — Build Mode here must go through
 *   it too, never call State.setBuildMode directly, or the header and
 *   this card would silently fall out of sync.
 */
export async function initSettingsPage(root, { showToast, setBuildMode }) {
  root.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <div class="section-title">Build Mode</div>
      <div style="display:grid;gap:12px;margin-top:8px;">
        <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;">
          <input type="radio" name="settingsBuildMode" value="classic" id="settingsModeClassic" style="margin-top:4px;">
          <span><strong>Classic</strong><br><span class="helper">Current manual OBS workflow.</span></span>
        </label>
        <label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;">
          <input type="radio" name="settingsBuildMode" value="beta" id="settingsModeBeta" style="margin-top:4px;">
          <span><strong>Automated Video Setup — Beta</strong><br><span class="helper">Automatically creates video sources, verification tags, and stinger transitions.</span></span>
        </label>
      </div>
    </div>

    <div id="settingsModeNotice" style="margin-bottom:16px;"></div>

    <div class="settings-grid">
      <div class="card">
        <div class="section-title">File Locations</div>
        <div class="form-row">
          <label class="form-label">Lot Banners Folder (local path)</label>
          <input type="text" class="form-input mono" id="lotBannersFolderInput">
          <p class="helper" style="margin-top:6px;">Where banners, tag images, and the stinger video all land — download them together via "Download All Banners" and move everything here at once. Fixed; doesn't change per auction.</p>
        </div>
        <div class="form-row">
          <label class="form-label">Lot Videos Folder (local path)</label>
          <input type="text" class="form-input mono" id="lotVideosFolderInput" placeholder="e.g. .../Auction OBS/Lot Videos/">
          <p class="helper" style="margin-top:6px;">Where cattle videos live. Also fixed — if you replace this folder's contents each month rather than using a fresh dated folder per auction (the common case), this is the only video setting you need; leave "Advanced video folders" below untouched.</p>
        </div>
        <details style="margin:4px 0 4px;">
          <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);">Advanced video folders (only if you use a fresh dated folder per auction instead of Lot Videos Folder above)</summary>
          <div style="margin-top:14px;">
            <div class="form-row">
              <label class="form-label">Auction OBS Root (local path)</label>
              <input type="text" class="form-input mono" id="obsRootInput">
            </div>
            <div class="form-row">
              <label class="form-label">Auction Folder (e.g. 2026-09-10)</label>
              <input type="text" class="form-input" id="auctionFolderInput" placeholder="2026-09-10">
            </div>
            <p class="helper" style="margin-top:-4px;">Only used when Lot Videos Folder above is blank. Videos are then expected at Auction OBS Root/Auction Folder/videos/&lt;id&gt;.mp4 — a fresh dated subfolder set per build.</p>
          </div>
        </details>
      </div>

      <div class="card">
        <div class="section-title">Verification Tag Placement</div>
        <div class="tag-placement-preview">
          <canvas id="tagPlacementPreviewCanvas" width="480" height="270"></canvas>
        </div>
        <div class="two-col" style="margin-top:14px;">
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
        <p class="helper" style="margin-top:10px;">Tags always form a right-aligned horizontal row in the bottom-right corner, ordered by Sort Order in Verification Tags.</p>
      </div>
    </div>

    <div class="action-row" style="margin-top:20px;justify-content:flex-start;">
      <button class="btn btn-primary" id="btnSaveBetaSettings">Save Settings</button>
    </div>
  `;

  renderModeNotice(root.querySelector('#settingsModeNotice'), { isBeta: State.getBuildMode() === 'beta', setBuildMode });
  wireBuildModeCard(root, setBuildMode);
  wireSettings(root, showToast);
  await refreshSettingsForm(root, showToast);
}

function wireBuildModeCard(root, setBuildMode) {
  const classicRadio = root.querySelector('#settingsModeClassic');
  const betaRadio = root.querySelector('#settingsModeBeta');
  const current = State.getBuildMode();
  classicRadio.checked = current !== 'beta';
  betaRadio.checked = current === 'beta';
  classicRadio.addEventListener('change', () => { if (classicRadio.checked) setBuildMode('classic'); });
  betaRadio.addEventListener('change', () => { if (betaRadio.checked) setBuildMode('beta'); });
}

function currentLayoutFromForm(root, fallback) {
  return {
    tagHeight: Number(root.querySelector('#layoutHeightInput').value) || fallback.tagHeight,
    spacing: Number(root.querySelector('#layoutSpacingInput').value) || fallback.spacing,
    rightMargin: Number(root.querySelector('#layoutRightInput').value) || fallback.rightMargin,
    bottomMargin: Number(root.querySelector('#layoutBottomInput').value) || fallback.bottomMargin,
  };
}

async function refreshSettingsForm(root, showToast) {
  let s;
  try {
    s = await State.getBetaSettings();
  } catch (err) {
    console.error(err);
    showToast(`Could not load Settings: ${err.message}`, true);
    return;
  }
  root.querySelector('#obsRootInput').value = s.auctionObsRoot;
  root.querySelector('#auctionFolderInput').value = s.auctionFolder;
  root.querySelector('#lotVideosFolderInput').value = s.lotVideosFolder;
  root.querySelector('#lotBannersFolderInput').value = s.lotBannersFolder;
  root.querySelector('#layoutHeightInput').value = s.tagLayout.tagHeight;
  root.querySelector('#layoutSpacingInput').value = s.tagLayout.spacing;
  root.querySelector('#layoutRightInput').value = s.tagLayout.rightMargin;
  root.querySelector('#layoutBottomInput').value = s.tagLayout.bottomMargin;

  const canvas = root.querySelector('#tagPlacementPreviewCanvas');
  const redrawPreview = () => renderTagPlacementPreview(canvas, currentLayoutFromForm(root, s.tagLayout));
  redrawPreview();
  ['#layoutHeightInput', '#layoutSpacingInput', '#layoutRightInput', '#layoutBottomInput'].forEach(sel => {
    root.querySelector(sel).addEventListener('input', redrawPreview);
  });
}

function wireSettings(root, showToast) {
  root.querySelector('#btnSaveBetaSettings').addEventListener('click', async () => {
    const btn = root.querySelector('#btnSaveBetaSettings');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const s = await State.getBetaSettings();
      s.auctionObsRoot = root.querySelector('#obsRootInput').value.trim() || s.auctionObsRoot;
      if (!s.auctionObsRoot.endsWith('/')) s.auctionObsRoot += '/';
      s.auctionFolder = root.querySelector('#auctionFolderInput').value.trim();
      s.lotVideosFolder = root.querySelector('#lotVideosFolderInput').value.trim();
      if (s.lotVideosFolder && !s.lotVideosFolder.endsWith('/')) s.lotVideosFolder += '/';
      s.lotBannersFolder = root.querySelector('#lotBannersFolderInput').value.trim() || s.lotBannersFolder;
      if (!s.lotBannersFolder.endsWith('/')) s.lotBannersFolder += '/';
      s.tagLayout.tagHeight = Number(root.querySelector('#layoutHeightInput').value) || s.tagLayout.tagHeight;
      s.tagLayout.spacing = Number(root.querySelector('#layoutSpacingInput').value) || s.tagLayout.spacing;
      s.tagLayout.rightMargin = Number(root.querySelector('#layoutRightInput').value) || s.tagLayout.rightMargin;
      s.tagLayout.bottomMargin = Number(root.querySelector('#layoutBottomInput').value) || s.tagLayout.bottomMargin;
      await State.saveBetaSettings(s);
      showToast('Settings saved — shared with every operator');
    } catch (err) {
      console.error(err);
      showToast(`Failed to save Settings: ${err.message}`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}
