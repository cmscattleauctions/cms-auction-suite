/* =============================================================
 * Beta OBS Builder — Stinger Settings page
 * -------------------------------------------------------------
 * Split out from beta-tag-manager-ui.js so the CMS Stinger asset has
 * its own nav tab instead of sharing a page with Verification Tags
 * and OBS Settings. Manages the single CMS video-entry intro asset
 * (obs-stinger/{filename} in Storage, obsStingerConfig/default in
 * Firestore) — see beta-stinger-data.js for the persistence layer.
 * ============================================================= */

import { getStingerConfig, saveStingerConfig, setStingerAsset } from './beta-stinger-data.js';

export async function initStingerSettingsPage(root, { showToast }) {
  root.innerHTML = `
    <div style="max-width:640px;">
      <div class="card">
        <div class="section-title">CMS Video Intro / Stinger</div>
        <div class="info-banner" style="margin-bottom:14px;font-size:12px;padding:12px 14px;">
          Implemented as a native <strong>OBS Stinger Transition</strong>, applied as the incoming transition on every Lot Video scene AND every Transition scene that follows one (lot transitions and breed/type transitions) — so it plays going into a lot's video and again going out of it into the next transition banner. This is OBS's own built-in mechanism (no plugin, no script).<br><br>
          <strong>Known limitation:</strong> OBS activates the cattle video's Media Source (and restarts it) the instant the Stinger begins, not when it visually reveals the video — so the first fraction of a second of the cattle video plays underneath the Stinger before it's shown. Keep this clip short (well under 1 second is a reasonable target) to keep that unavoidable overlap imperceptible. A video asset is required — a static image has no natural end point for OBS to key the transition off of.
        </div>
        <div class="form-row">
          <label class="form-label">Stinger Video (MP4/MOV/WebM)</label>
          <div class="img-drop" id="introImgDrop">
            <input type="file" accept="video/mp4,video/quicktime,video/webm" id="introImgInput">
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
        <p id="introMsg" class="helper" style="margin-top:10px;min-height:18px;">Applies as a Transition Override on every Lot Video scene, and on the Transition scene right after one (lot or breed/type) — so it plays going in and coming back out. Skipped on the show's opening transition and on a lot transition right after a breed/type transition, since neither follows an actual lot video.</p>
      </div>
    </div>
  `;

  wireIntro(root, showToast);
  await refreshIntro(root);
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
  const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
  const handleFile = file => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast(`Stinger asset must be MP4, MOV, or WebM (got "${file.type || 'unknown type'}").`, true);
      return;
    }
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
