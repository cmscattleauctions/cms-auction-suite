/* =============================================================
 * CMS Cattle Video Upload — Rep portal
 * -------------------------------------------------------------
 * Base UX only, per the Video Manager phase-1 spec:
 *   - Mocked role behavior (no real Firebase Auth wired yet)
 *   - Rep sees ONLY this upload flow — no Auction Suite nav, no
 *     Video Manager, no numeric Video ID codes, no ID guide
 *   - Generates the Video ID silently server-side-equivalent;
 *     the rep never sees it
 *   - Collisions are resolved in plain English, not ID jargon
 *
 * Shares the same mock data-service layer as the staff app so the
 * schema and collision rules stay identical. Note: this page runs
 * in its own browsing context (a separate document, not an
 * iframe of the staff app), so its in-memory mock store is its
 * own copy for this phase — real cross-app persistence arrives
 * once this is wired to Firebase.
 * ============================================================= */

import { ReferenceDataRepository, VideoRepository } from '../video-manager/repository.js';
import { buildBaseId } from '../video-manager/video-id.js';

const main = document.getElementById('ru-main');

const formState = {
  consignorCode: '', sexCode: '', sireCode: '', damCode: '', weight: '', monthYear: '',
  notes: '', listingImageDataUrl: null,
};
const files = []; // { file, progress, status }

function showToast(msg) {
  const root = document.getElementById('ru-toast-root');
  const el = document.createElement('div');
  el.className = 'ru-toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function currentMonthYear() {
  const d = new Date();
  return String(d.getMonth() + 1).padStart(2, '0') + String(d.getFullYear()).slice(-2);
}

function render() {
  const consignors = ReferenceDataRepository.getConsignors();
  const sexes = ReferenceDataRepository.getSexTypes();
  const sires = ReferenceDataRepository.getSireTypes();
  const dams = ReferenceDataRepository.getDamTypes();

  main.innerHTML = `
    <div class="ru-card">
      <h2>Cattle Details</h2>
      <p class="hint">Just the basics — we'll handle the rest.</p>

      <div class="field">
        <label>Consignor</label>
        <select id="f-consignor">
          <option value="">Select consignor…</option>
          ${consignors.map(c => `<option value="${c.code}" ${formState.consignorCode === c.code ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-ghost" id="f-new-consignor" type="button" style="margin-top:8px;">+ Add New Consignor</button>
      </div>

      <div class="field">
        <label>Sex</label>
        <select id="f-sex">
          <option value="">Select…</option>
          ${sexes.map(s => `<option value="${s.code}" ${formState.sexCode === s.code ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Sire Type</label>
          <select id="f-sire">
            <option value="">Select…</option>
            ${sires.map(s => `<option value="${s.code}" ${formState.sireCode === s.code ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Dam Type</label>
          <select id="f-dam">
            <option value="">Select…</option>
            ${dams.map(s => `<option value="${s.code}" ${formState.damCode === s.code ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label>Weight (lbs)</label>
          <input type="number" id="f-weight" placeholder="450" value="${formState.weight}" />
        </div>
        <div class="field">
          <label>Month / Year</label>
          <input type="text" id="f-monthyear" placeholder="0826" maxlength="4" value="${formState.monthYear}" />
        </div>
      </div>
    </div>

    <div class="ru-card">
      <h2>Optional Listing Image</h2>
      <p class="hint">One photo of the lot, if you have it.</p>
      <div class="ru-videopick-row">
        <button class="btn" id="f-photo-take" type="button">Take Photo</button>
        <button class="btn" id="f-photo-choose" type="button">Choose Photo</button>
      </div>
      <input type="file" id="f-photo-input-take" accept="image/*" capture="environment" style="display:none" />
      <input type="file" id="f-photo-input-choose" accept="image/*" style="display:none" />
      <div class="ru-listing-preview" id="f-photo-preview"></div>
    </div>

    <div class="ru-card">
      <h2>Cattle Videos</h2>
      <p class="hint">Take video now, or select from your camera roll. You can add more anytime.</p>
      <div class="ru-videopick-row">
        <button class="btn btn-primary" id="f-video-take" type="button">Take Video</button>
        <button class="btn" id="f-video-choose" type="button">Select Videos</button>
      </div>
      <input type="file" id="f-video-input-take" accept="video/*" capture="environment" style="display:none" />
      <input type="file" id="f-video-input-choose" accept="video/*" multiple style="display:none" />
      <div id="f-video-list" style="margin-top:12px;"></div>
      <div class="ru-total-size" id="f-video-total"></div>
    </div>

    <div class="ru-card">
      <h2>Notes</h2>
      <textarea id="f-notes" rows="3" placeholder="Optional — anything we should know">${escapeHtml(formState.notes)}</textarea>
    </div>

    <div id="f-existing-banner"></div>

    <button class="btn btn-primary" id="f-submit" type="button" style="padding:16px;font-size:16px;">Submit Video</button>
  `;

  wire();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb < 1000 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
}

function wire() {
  main.querySelector('#f-consignor').addEventListener('change', e => formState.consignorCode = e.target.value);
  main.querySelector('#f-sex').addEventListener('change', e => formState.sexCode = e.target.value);
  main.querySelector('#f-sire').addEventListener('change', e => formState.sireCode = e.target.value);
  main.querySelector('#f-dam').addEventListener('change', e => formState.damCode = e.target.value);
  main.querySelector('#f-weight').addEventListener('input', e => formState.weight = e.target.value);
  main.querySelector('#f-monthyear').addEventListener('input', e => formState.monthYear = e.target.value);
  main.querySelector('#f-notes').addEventListener('input', e => formState.notes = e.target.value);

  main.querySelector('#f-new-consignor').addEventListener('click', () => {
    const name = prompt('New consignor name:');
    if (!name || !name.trim()) return;
    const code = ReferenceDataRepository.suggestNextConsignorCode();
    const rec = ReferenceDataRepository.addConsignor({ name: name.trim(), code });
    formState.consignorCode = rec.code;
    render();
    showToast(`Added ${rec.name}`);
  });

  wirePhotoPicker();
  wireVideoPickers();
  renderVideoList();

  main.querySelector('#f-submit').addEventListener('click', onSubmit);

  if (!formState.monthYear) {
    formState.monthYear = currentMonthYear();
    main.querySelector('#f-monthyear').value = formState.monthYear;
  }
}

function wirePhotoPicker() {
  const takeBtn = main.querySelector('#f-photo-take'), chooseBtn = main.querySelector('#f-photo-choose');
  const takeInput = main.querySelector('#f-photo-input-take'), chooseInput = main.querySelector('#f-photo-input-choose');
  takeBtn.addEventListener('click', () => takeInput.click());
  chooseBtn.addEventListener('click', () => chooseInput.click());
  [takeInput, chooseInput].forEach(input => input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      formState.listingImageDataUrl = reader.result;
      main.querySelector('#f-photo-preview').innerHTML = `<img src="${reader.result}" />`;
    };
    reader.readAsDataURL(file);
  }));
}

function wireVideoPickers() {
  const takeBtn = main.querySelector('#f-video-take'), chooseBtn = main.querySelector('#f-video-choose');
  const takeInput = main.querySelector('#f-video-input-take'), chooseInput = main.querySelector('#f-video-input-choose');
  takeBtn.addEventListener('click', () => takeInput.click());
  chooseBtn.addEventListener('click', () => chooseInput.click());
  [takeInput, chooseInput].forEach(input => input.addEventListener('change', () => {
    [...input.files].forEach(addVideoFile);
    input.value = '';
  }));
}

function addVideoFile(file) {
  const entry = { file, progress: 0, status: 'uploading' };
  files.push(entry);
  renderVideoList();
  simulateUpload(entry);
}

function simulateUpload(entry) {
  const willFail = Math.random() < 0.15 && entry.progress === 0;
  const timer = setInterval(() => {
    if (entry.status !== 'uploading') { clearInterval(timer); return; }
    entry.progress += 6 + Math.random() * 10;
    if (willFail && entry.progress > 40) { entry.status = 'failed'; entry.progress = 40; clearInterval(timer); }
    else if (entry.progress >= 100) { entry.progress = 100; entry.status = 'complete'; clearInterval(timer); }
    renderVideoList();
  }, 260);
}

function renderVideoList() {
  const list = main.querySelector('#f-video-list');
  if (!list) return;
  list.innerHTML = files.map((entry, i) => `
    <div class="ru-file-row">
      <div class="ru-file-thumb"><svg viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4V1z"/></svg></div>
      <div class="ru-file-info">
        <div class="ru-file-name">${escapeHtml(entry.file.name)} · ${formatBytes(entry.file.size)}</div>
        <div class="ru-progress-bar"><div class="ru-progress-fill ${entry.status === 'failed' ? 'failed' : entry.status === 'complete' ? 'complete' : ''}" style="width:${entry.progress}%"></div></div>
        <div class="ru-file-status">${entry.status === 'uploading' ? `Uploading… ${Math.round(entry.progress)}% ${navigator.onLine === false ? '(waiting for signal)' : ''}` : entry.status === 'complete' ? 'Uploaded' : 'Failed — will resume when signal improves'}</div>
      </div>
      ${entry.status === 'failed' ? `<button class="btn btn-sm" data-retry="${i}">Retry</button>` : `<button class="btn btn-sm btn-ghost" data-remove="${i}">✕</button>`}
    </div>
  `).join('');
  list.querySelectorAll('[data-retry]').forEach(b => b.addEventListener('click', () => {
    const entry = files[Number(b.dataset.retry)];
    entry.status = 'uploading'; entry.progress = 0;
    simulateUpload(entry);
  }));
  list.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
    files.splice(Number(b.dataset.remove), 1);
    renderVideoList();
  }));

  const totalEl = main.querySelector('#f-video-total');
  if (totalEl) {
    if (!files.length) { totalEl.textContent = ''; }
    else {
      const total = files.reduce((n, e) => n + e.file.size, 0);
      totalEl.textContent = `${files.length} video${files.length === 1 ? '' : 's'} · ${formatBytes(total)} total`;
    }
  }
}

/* =============================================================
 * Submit + plain-English collision handling
 * ============================================================= */
async function onSubmit() {
  const { consignorCode, sexCode, sireCode, damCode, weight, monthYear } = formState;
  if (!consignorCode || !sexCode || !sireCode || !damCode || !weight || monthYear.length !== 4) {
    showToast('Fill in consignor, sex, sire, dam, weight and month/year');
    return;
  }
  if (!files.some(f => f.status === 'complete') && files.length) {
    showToast('Wait for at least one video to finish uploading');
    return;
  }

  const baseId = buildBaseId({ consignorCode, sexCode, sireCode, damCode, weight, monthYear });
  const existing = await VideoRepository.findByFinalId(baseId);

  const clips = files.filter(f => f.status === 'complete').map(f => ({
    id: 'clip_' + Math.random().toString(36).slice(2, 10),
    filename: f.file.name, swatch: Math.floor(Math.random() * 8), durationSec: null,
    sizeBytes: f.file.size, uploader: 'Rep', uploadedAt: new Date().toISOString(),
    isOriginal: true, fileHandle: f.file,
  }));

  if (existing) {
    renderExistingBanner(existing, async choice => {
      if (choice === 'add') {
        await VideoRepository.addClips(existing.id, clips, 'Rep');
        showSuccess(`Added to the existing video record for these cattle.`);
      } else {
        const suffix = await VideoRepository.nextSuffixFor(baseId);
        const rec = await createRecord({ consignorCode, sexCode, sireCode, damCode, weight, monthYear, suffix }, clips);
        showSuccess(`Created a new video record.`);
      }
    });
    return;
  }

  await createRecord({ consignorCode, sexCode, sireCode, damCode, weight, monthYear, suffix: null }, clips);
  showSuccess(`Thanks! Your video was submitted for review.`);
}

async function createRecord(fields, clips) {
  return VideoRepository.createVideo({
    ...fields, status: 'ready', isDraft: clips.length === 0,
    notes: formState.notes.trim(), clips, listingImageUrl: formState.listingImageDataUrl,
  }, 'Rep');
}

function renderExistingBanner(existing, onChoice) {
  const banner = main.querySelector('#f-existing-banner');
  banner.innerHTML = `
    <div class="ru-existing-banner">
      <p>A video record already exists for these cattle details (${escapeHtml(existing.consignorName)}, ${existing.weight} lbs, ${existing.clips.length} clip${existing.clips.length === 1 ? '' : 's'} already on file).</p>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" id="ex-add">Add Videos to Existing</button>
        <button class="btn btn-sm" id="ex-new">Create New Video</button>
      </div>
    </div>
  `;
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  banner.querySelector('#ex-add').addEventListener('click', () => onChoice('add'));
  banner.querySelector('#ex-new').addEventListener('click', () => onChoice('new'));
}

function showSuccess(message) {
  main.innerHTML = `
    <div class="ru-card ru-success">
      <div class="icon"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h2>Submitted</h2>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary" id="again-btn">Upload Another</button>
    </div>
  `;
  main.querySelector('#again-btn').addEventListener('click', () => {
    formState.consignorCode = ''; formState.sexCode = ''; formState.sireCode = ''; formState.damCode = '';
    formState.weight = ''; formState.monthYear = ''; formState.notes = ''; formState.listingImageDataUrl = null;
    files.length = 0;
    render();
  });
}

render();
