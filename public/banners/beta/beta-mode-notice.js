/* =============================================================
 * Beta OBS Builder — shared "automated-only" mode notice
 * -------------------------------------------------------------
 * Verification Tags, Stinger, and Settings' File Locations/Tag
 * Placement all only matter in Automated Video Setup — Beta. Rather
 * than repeat a large explanatory banner on every one of those pages,
 * this renders: a small status chip when Beta is already active, or a
 * compact actionable warning (with a one-click switch) when it isn't.
 * ============================================================= */

/**
 * @param container  element to render the notice into (its innerHTML is replaced)
 * @param opts.isBeta         current mode, boolean
 * @param opts.setBuildMode   shared mode-switch function from index.html
 */
export function renderModeNotice(container, { isBeta, setBuildMode }) {
  if (isBeta) {
    container.innerHTML = `<span class="status-chip good" style="margin-bottom:16px;">Automated Beta feature</span>`;
    return;
  }
  container.innerHTML = `
    <div class="alert-banner" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
      <span>Automated Video Setup is currently off. These settings will not be used while Classic mode is active.</span>
      <button type="button" class="btn btn-ghost btn-sm" id="btnEnableAutomatedMode">Enable Automated Mode</button>
    </div>
  `;
  container.querySelector('#btnEnableAutomatedMode').addEventListener('click', () => setBuildMode('beta'));
}
