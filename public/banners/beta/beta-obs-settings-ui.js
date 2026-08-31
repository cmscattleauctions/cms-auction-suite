/* =============================================================
 * Beta OBS Builder — OBS Settings page
 * -------------------------------------------------------------
 * Split out from beta-tag-manager-ui.js so the local-path and tag
 * layout settings have their own nav tab instead of sharing a page
 * with Verification Tags and the Stinger. Persists to beta-state.js
 * (localStorage — device-local build settings, not shared Firebase
 * state like tags/stinger).
 * ============================================================= */

import * as State from './beta-state.js';

export async function initObsSettingsPage(root, { showToast }) {
  root.innerHTML = `
    <div style="max-width:640px;">
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
  `;

  wireSettings(root, showToast);
  refreshSettingsForm(root);
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
