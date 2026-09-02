/* =============================================================
 * Beta OBS Builder — OBS Settings page
 * -------------------------------------------------------------
 * Split out from beta-tag-manager-ui.js so the local-path and tag
 * layout settings have their own nav tab instead of sharing a page
 * with Verification Tags and the Stinger. Persists via beta-state.js
 * to a shared Firestore doc (obsBetaSettings/default) — same as tags
 * and the stinger, so settings survive a cleared browser or a switch
 * to a different machine instead of being stuck on one device.
 * ============================================================= */

import * as State from './beta-state.js';

export async function initObsSettingsPage(root, { showToast }) {
  root.innerHTML = `
    <div style="max-width:640px;">
      <div class="card">
        <div class="section-title">OBS Beta Settings</div>

        <div class="form-row">
          <label class="form-label">Lot Banners Folder (local path)</label>
          <input type="text" class="form-input mono" id="lotBannersFolderInput">
          <p class="helper" style="margin-top:6px;">Where banners, tag images, and the stinger video all land — download them together via "Download All Banners" and move everything here at once. Fixed; doesn't change per auction.</p>
        </div>
        <div class="form-row">
          <label class="form-label">Lot Videos Folder (local path)</label>
          <input type="text" class="form-input mono" id="lotVideosFolderInput" placeholder="e.g. .../Auction OBS/Lot Videos/">
          <p class="helper" style="margin-top:6px;">Where cattle videos live. Also fixed — if you replace this folder's contents each month rather than using a fresh dated folder per auction (the common case), this is the only video setting you need; leave "Per-auction video folders" below untouched.</p>
        </div>

        <details style="margin:4px 0 20px;">
          <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);">Per-auction video folders (advanced — only if you use a fresh dated folder per auction instead of Lot Videos Folder above)</summary>
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
  await refreshSettingsForm(root, showToast);
}

async function refreshSettingsForm(root, showToast) {
  let s;
  try {
    s = await State.getBetaSettings();
  } catch (err) {
    console.error(err);
    showToast(`Could not load OBS Settings: ${err.message}`, true);
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
      showToast('Beta settings saved — shared with every operator');
    } catch (err) {
      console.error(err);
      showToast(`Failed to save OBS Settings: ${err.message}`, true);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}
