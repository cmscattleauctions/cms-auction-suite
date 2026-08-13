/* =============================================================
 * CMS Video Manager — Right-side detail drawer
 * Details / Clips / Usage / Activity
 * ============================================================= */

import { escapeHtml, formatDate, formatDateTime, formatBytes, formatDuration, sexShort } from './format.js';
import { formatMonthYear, buildBaseId } from './video-id.js';
import { showToast, copyToClipboard } from './toast.js';

let activeId = null;
let activeTab = 'details';

export async function openDrawer(id, ctx) {
  closeDrawer();
  activeId = id;
  activeTab = 'details';
  await paint(ctx);
}

export function closeDrawer() {
  const root = document.getElementById('vm-drawer-root');
  if (root) root.innerHTML = '';
  activeId = null;
}

async function paint(ctx) {
  const rec = await ctx.repo.getVideoById(activeId);
  const root = document.getElementById('vm-drawer-root');
  if (!rec) { root.innerHTML = ''; return; }

  const sexLabel = ctx.ref.sexLabel(rec.sexCode) || `Code ${rec.sexCode}`;
  const sireLabel = ctx.ref.sireLabel(rec.sireCode) || `Code ${rec.sireCode}`;
  const damLabel = ctx.ref.damLabel(rec.damCode) || `Code ${rec.damCode}`;

  root.innerHTML = `
    <div class="vm-drawer-backdrop" id="vm-drawer-backdrop"></div>
    <aside class="vm-drawer">
      <div class="vm-drawer-header">
        <div>
          <div class="vm-drawer-title">${escapeHtml(rec.videoId)}</div>
          <div class="vm-drawer-sub">${escapeHtml(rec.consignorName)} · ${sexShort(sexLabel)} · ${escapeHtml(sireLabel)} × ${escapeHtml(damLabel)} · ${rec.weight} lbs</div>
        </div>
        <button class="vm-drawer-close" id="vm-drawer-close">&times;</button>
      </div>

      <div class="vm-drawer-statusbar">
        <span class="label">Status</span>
        <span class="status-pill status-${rec.isDraft ? 'draft' : rec.status}">${rec.isDraft ? 'Draft' : statusLabel(rec.status)}</span>
        <span class="vm-status-actions" style="margin-left:auto;">
          ${['ready', 'hold', 'created'].filter(s => s !== rec.status).map(s =>
            `<button class="btn btn-sm" data-move="${s}">Move to ${statusLabel(s)}</button>`).join('')}
        </span>
      </div>

      <div class="vm-drawer-tabs">
        ${['details', 'clips', 'usage', 'activity'].map(t => `
          <button class="vm-drawer-tab ${activeTab === t ? 'active' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}${t === 'clips' ? ` (${rec.clips.length})` : t === 'usage' ? ` (${rec.usage.length})` : ''}</button>
        `).join('')}
      </div>

      <div class="vm-drawer-body scroll-thin" id="vm-drawer-body"></div>
    </aside>
  `;

  root.querySelector('#vm-drawer-close').addEventListener('click', closeDrawer);
  root.querySelector('#vm-drawer-backdrop').addEventListener('click', closeDrawer);
  root.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', async () => {
    await ctx.repo.setStatus(rec.id, btn.dataset.move, 'Staff');
    showToast('Status updated');
    ctx.refresh();
    paint(ctx);
  }));
  root.querySelectorAll('.vm-drawer-tab').forEach(btn => btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    paint(ctx);
  }));

  const body = root.querySelector('#vm-drawer-body');
  if (activeTab === 'details') body.innerHTML = detailsHtml(rec, ctx), wireDetails(body, rec, ctx);
  else if (activeTab === 'clips') body.innerHTML = clipsHtml(rec), wireClips(body, rec, ctx);
  else if (activeTab === 'usage') body.innerHTML = usageHtml(rec);
  else body.innerHTML = activityHtml(rec);
}

function statusLabel(s) { return s === 'ready' ? 'Ready to Make' : s === 'hold' ? 'On Hold' : 'Created'; }

/* =============================================================
 * DETAILS tab
 * ============================================================= */
function detailsHtml(rec, ctx) {
  const sexes = ctx.ref.getSexTypes(), sires = ctx.ref.getSireTypes(), dams = ctx.ref.getDamTypes();
  const consignors = ctx.ref.getConsignors();

  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Classification (defines the Video ID)</div>
      <div class="field-row">
        <div><label>Consignor</label><select id="d-consignor">${consignors.map(c => `<option value="${c.code}" ${c.code === rec.consignorCode ? 'selected' : ''}>${c.name} (${c.code})</option>`).join('')}</select></div>
        <div><label>Sex</label><select id="d-sex">${sexes.map(s => `<option value="${s.code}" ${s.code === rec.sexCode ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">
        <div><label>Sire</label><select id="d-sire">${sires.map(s => `<option value="${s.code}" ${s.code === rec.sireCode ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
        <div><label>Dam</label><select id="d-dam">${dams.map(s => `<option value="${s.code}" ${s.code === rec.damCode ? 'selected' : ''}>${s.label}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">
        <div><label>Weight</label><input type="number" id="d-weight" value="${rec.weight}" /></div>
        <div><label>Month / Year</label><input type="text" id="d-monthyear" value="${rec.monthYear}" maxlength="4" /></div>
      </div>
      <div class="field-hint" id="d-id-preview">Video ID: <strong style="color:var(--text)">${escapeHtml(rec.videoId)}</strong></div>
      <div id="d-collision-feedback"></div>
      <button class="btn btn-primary btn-sm" id="d-save-id" style="margin-top:10px;">Save Correction</button>
      ${rec.videoIdHistory.length ? `
        <div class="vm-drawer-section-title" style="margin-top:16px;">Previous Video IDs</div>
        ${rec.videoIdHistory.map(h => `<div class="vm-history-item">${escapeHtml(h.id)} — ${formatDate(h.changedAt)} (${escapeHtml(h.reason)})</div>`).join('')}
      ` : ''}
    </div>

    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Details</div>
      ${rec.status === 'created' ? `
        <div class="field"><label>Video Maker</label><input type="text" id="d-videomaker" value="${escapeHtml(rec.videoMaker)}" /></div>
      ` : `
        <div class="field"><label>Video Maker</label><input type="text" value="—" disabled /><p class="field-hint">Assigned once this video is moved to Created.</p></div>
      `}
      <div class="field-row">
        <div><label>Created By</label><input type="text" value="${escapeHtml(rec.createdBy)}" disabled /></div>
        <div><label>Date Added</label><input type="text" value="${formatDate(rec.dateAdded)}" disabled /></div>
      </div>
      <div class="field"><label>Last Updated</label><input type="text" value="${formatDateTime(rec.lastUpdated)}" disabled /></div>
      <div class="field"><label>Notes</label><textarea id="d-notes" rows="3">${escapeHtml(rec.notes)}</textarea></div>
      <div class="field">
        <label>Canva Link</label>
        <div class="vm-link-row">
          <input type="text" id="d-canvalink" placeholder="Paste Canva design link…" value="${escapeHtml(rec.canvaLink || '')}" />
          <button class="btn btn-sm" id="d-canva-copy" ${rec.canvaLink ? '' : 'disabled'}>Copy</button>
        </div>
      </div>
    </div>

    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Video Format</div>
      <div class="field-row">
        <div>
          <label>Video Format</label>
          <select id="d-videoformat">
            ${ctx.ref.getVideoFormats().map(f => `<option value="${f.code}" ${f.code === rec.videoFormat ? 'selected' : ''}>${f.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Overlay Mode</label>
          <select id="d-overlaymode">
            ${ctx.ref.getOverlayModes().map(m => `<option value="${m.code}" ${m.code === rec.overlayMode ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-hint" style="margin-bottom:10px;">${escapeHtml(ctx.ref.videoFormatMeta(rec.videoFormat)?.desc || '')} Overlay Mode is informational for now — it does not control OBS yet.</div>

      <label>Baked-In Tags</label>
      <div class="tag-chip-row" id="d-tags-row">
        ${ctx.ref.getProgramTags().map(t => `
          <button type="button" class="tag-chip ${rec.bakedInTags.includes(t.name) ? 'active' : ''}" data-tag="${escapeHtml(t.name)}">${escapeHtml(t.name)}</button>
        `).join('')}
        <button type="button" class="tag-chip tag-chip-add" id="d-add-tag">+ Add Tag</button>
      </div>
      <div class="field-hint">${rec.bakedInTags.length ? `Baked in: ${rec.bakedInTags.map(escapeHtml).join(', ')}` : 'Clean videos are safe for dynamic OBS overlays.'}</div>

      ${rec.videoFormat !== 'needs-redo' ? `<button class="btn btn-sm" id="d-mark-redo" style="margin-top:12px;border-color:var(--danger);color:var(--danger);">Mark Needs Redo</button>` : ''}
    </div>

    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">YouTube</div>
      ${rec.youtubeUrl ? `
        <div class="vm-link-row"><input type="text" value="${escapeHtml(rec.youtubeUrl)}" disabled /><button class="btn btn-sm" data-copy="url">Copy Video Link</button></div>
        <div class="vm-link-row"><input type="text" value="${escapeHtml(rec.embedUrl)}" disabled /><button class="btn btn-sm" data-copy="embed">Copy Embed Link</button></div>
        <div class="vm-link-row"><input type="text" value="${escapeHtml(rec.embedCode)}" disabled /><button class="btn btn-sm" data-copy="code">Copy Embed Code</button></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-ghost" data-open-yt>Open YouTube</button>
          <button class="btn btn-sm" id="d-change-yt" style="border-color:var(--info, #1e40af);color:var(--info, #1e40af);">Change YouTube Video</button>
        </div>
        <div id="d-change-yt-panel"></div>
        ${rec.previousYouTubeVideos.length ? `
          <div class="vm-drawer-section-title" style="margin-top:16px;">Previous YouTube Versions</div>
          ${rec.previousYouTubeVideos.map(p => `
            <div class="vm-history-item">
              <a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.url)}</a><br>
              Replaced ${formatDate(p.replacedAt)} by ${escapeHtml(p.replacedBy)}${p.reason ? ` — ${escapeHtml(p.reason)}` : ''}
            </div>
          `).join('')}
        ` : ''}
      ` : `
        <div class="vm-link-row"><input type="text" id="d-yt-input" placeholder="Paste YouTube link…" /><button class="btn btn-sm btn-primary" id="d-yt-save">Save</button></div>
      `}
    </div>
  `;
}

function wireDetails(body, rec, ctx) {
  const preview = body.querySelector('#d-id-preview');
  function recompute() {
    const fields = {
      consignorCode: body.querySelector('#d-consignor').value,
      sexCode: body.querySelector('#d-sex').value,
      sireCode: body.querySelector('#d-sire').value,
      damCode: body.querySelector('#d-dam').value,
      weight: body.querySelector('#d-weight').value,
      monthYear: body.querySelector('#d-monthyear').value,
    };
    preview.innerHTML = `Video ID: <strong style="color:var(--text)">${escapeHtml(buildBaseId(fields))}</strong>`;
    return fields;
  }
  body.querySelectorAll('#d-consignor,#d-sex,#d-sire,#d-dam,#d-weight,#d-monthyear').forEach(el => {
    el.addEventListener('input', recompute);
    el.addEventListener('change', recompute);
  });

  body.querySelector('#d-save-id').addEventListener('click', async () => {
    const fields = recompute();
    const { collision } = await ctx.repo.setVideoIdFields(rec.id, fields, 'Staff');
    const feedback = body.querySelector('#d-collision-feedback');
    if (collision) {
      feedback.innerHTML = `
        <div class="vm-unrecognized-inline" style="align-items:flex-start;flex-direction:column;">
          <div>Video ID already exists: <strong>${escapeHtml(collision.videoId)}</strong> (${escapeHtml(collision.consignorName)})</div>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="btn btn-sm" id="d-open-collision">Open Existing</button>
            <button class="btn btn-sm btn-primary" id="d-suffix-collision">Create Separate (assign suffix)</button>
          </div>
        </div>`;
      feedback.querySelector('#d-open-collision').addEventListener('click', () => { closeDrawer(); openDrawer(collision.id, ctx); });
      feedback.querySelector('#d-suffix-collision').addEventListener('click', async () => {
        const suffix = await ctx.repo.nextSuffixFor(buildBaseId(fields));
        await ctx.repo.setVideoIdFields(rec.id, fields, 'Staff', { forceSuffix: suffix });
        showToast('Video ID updated with suffix');
        ctx.refresh();
        paint(ctx);
      });
      return;
    }
    showToast('Video ID updated');
    ctx.refresh();
    paint(ctx);
  });

  const videoMakerInput = body.querySelector('#d-videomaker');
  if (videoMakerInput) videoMakerInput.addEventListener('blur', e => ctx.repo.updateVideo(rec.id, { videoMaker: e.target.value.trim() }, 'Staff'));
  body.querySelector('#d-notes').addEventListener('blur', e => ctx.repo.updateVideo(rec.id, { notes: e.target.value.trim() }, 'Staff'));
  body.querySelector('#d-canvalink').addEventListener('blur', e => {
    const val = e.target.value.trim();
    ctx.repo.updateVideo(rec.id, { canvaLink: val || null }, 'Staff');
    const copyBtn = body.querySelector('#d-canva-copy');
    copyBtn.disabled = !val;
  });
  const canvaCopyBtn = body.querySelector('#d-canva-copy');
  if (canvaCopyBtn) canvaCopyBtn.addEventListener('click', async () => {
    await copyToClipboard(body.querySelector('#d-canvalink').value.trim());
    showToast('Copied');
  });

  body.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const map = { url: rec.youtubeUrl, embed: rec.embedUrl, code: rec.embedCode };
    await copyToClipboard(map[btn.dataset.copy]);
    showToast('Copied');
  }));
  const openYt = body.querySelector('[data-open-yt]');
  if (openYt) openYt.addEventListener('click', () => window.open(rec.youtubeUrl, '_blank', 'noopener'));

  const ytSave = body.querySelector('#d-yt-save');
  if (ytSave) ytSave.addEventListener('click', async () => {
    const val = body.querySelector('#d-yt-input').value.trim();
    const ytId = parseYoutubeLink(val);
    if (!ytId) { showToast('Could not read a YouTube link from that'); return; }
    await ctx.repo.setYoutube(rec.id, { youtubeUrl: val.startsWith('http') ? val : `https://youtu.be/${ytId}`, youtubeId: ytId }, 'Staff');
    ctx.refresh();
    paint(ctx);
  });

  const changeYtBtn = body.querySelector('#d-change-yt');
  if (changeYtBtn) changeYtBtn.addEventListener('click', () => {
    const panel = body.querySelector('#d-change-yt-panel');
    panel.innerHTML = `
      <div class="vm-link-row" style="margin-top:8px;">
        <input type="text" id="d-change-yt-input" placeholder="New YouTube link…" />
      </div>
      <div class="field"><input type="text" id="d-change-yt-reason" placeholder="Reason (optional) — e.g. rebuilt clean" /></div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-sm btn-primary" id="d-change-yt-save">Save New Version</button>
        <button class="btn btn-sm btn-ghost" id="d-change-yt-cancel">Cancel</button>
      </div>
    `;
    panel.querySelector('#d-change-yt-cancel').addEventListener('click', () => panel.innerHTML = '');
    panel.querySelector('#d-change-yt-save').addEventListener('click', async () => {
      const val = panel.querySelector('#d-change-yt-input').value.trim();
      const reason = panel.querySelector('#d-change-yt-reason').value.trim();
      const ytId = parseYoutubeLink(val);
      if (!ytId) { showToast('Could not read a YouTube link from that'); return; }
      await ctx.repo.setYoutube(rec.id, { youtubeUrl: val.startsWith('http') ? val : `https://youtu.be/${ytId}`, youtubeId: ytId }, 'Staff', reason);
      showToast('New YouTube version saved — previous version kept in history');
      ctx.refresh();
      paint(ctx);
    });
  });

  body.querySelector('#d-videoformat').addEventListener('change', async e => {
    await ctx.repo.setVideoFormat(rec.id, e.target.value, 'Staff');
    ctx.refresh();
    paint(ctx);
  });
  body.querySelector('#d-overlaymode').addEventListener('change', async e => {
    await ctx.repo.setOverlayMode(rec.id, e.target.value, 'Staff');
    ctx.refresh();
  });

  body.querySelectorAll('#d-tags-row [data-tag]').forEach(btn => btn.addEventListener('click', async () => {
    const tag = btn.dataset.tag;
    const tags = new Set(rec.bakedInTags);
    tags.has(tag) ? tags.delete(tag) : tags.add(tag);
    await ctx.repo.setBakedInTags(rec.id, [...tags], 'Staff');
    ctx.refresh();
    paint(ctx);
  }));
  const addTagBtn = body.querySelector('#d-add-tag');
  if (addTagBtn) addTagBtn.addEventListener('click', async () => {
    const name = prompt('New tag name (e.g. GAP4):');
    if (!name || !name.trim()) return;
    try {
      const tag = ctx.ref.addProgramTag(name.trim());
      await ctx.repo.setBakedInTags(rec.id, [...rec.bakedInTags, tag.name], 'Staff');
      ctx.refresh();
      paint(ctx);
    } catch (err) {
      showToast(err.message);
    }
  });

  const markRedoBtn = body.querySelector('#d-mark-redo');
  if (markRedoBtn) markRedoBtn.addEventListener('click', async () => {
    await ctx.repo.markNeedsRedo(rec.id, 'Staff');
    showToast('Marked Needs Redo');
    ctx.refresh();
    paint(ctx);
  });
}

function parseYoutubeLink(val) {
  const m = val.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{5,})/);
  return m ? m[1] : (/^[a-zA-Z0-9_-]{5,}$/.test(val) ? val : null);
}

/* =============================================================
 * CLIPS tab
 * ============================================================= */
function clipsHtml(rec) {
  if (!rec.clips.length) {
    return `<div class="vm-drawer-section"><p class="muted">No clips uploaded yet.</p><button class="btn btn-primary btn-sm" id="c-add-clips" style="margin-top:10px;">Add Clips</button></div>`;
  }
  return `
    <div class="vm-drawer-section">
      <button class="btn btn-primary btn-block" id="c-download-all">Download All ${rec.clips.length} Clip${rec.clips.length === 1 ? '' : 's'}</button>
    </div>
    <div class="vm-drawer-section">
      <div class="vm-clip-list">
        ${rec.clips.map(c => `
          <div class="vm-clip-row">
            <span class="clip-thumb clip-swatch-${c.swatch}"><svg viewBox="0 0 12 12" fill="currentColor"><path d="M3 2l7 4-7 4V2z"/></svg></span>
            <div class="vm-clip-info">
              <div class="vm-clip-name">${escapeHtml(c.filename)}</div>
              <div class="vm-clip-details">${formatDuration(c.durationSec)} · ${formatBytes(c.sizeBytes)} · ${escapeHtml(c.uploader)} · ${formatDateTime(c.uploadedAt)}</div>
            </div>
            <button class="btn btn-sm" data-download-clip="${c.id}">Download</button>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="vm-drawer-section">
      <button class="btn btn-sm" id="c-add-clips">+ Add More Clips</button>
    </div>
  `;
}

function wireClips(body, rec, ctx) {
  const addBtn = body.querySelector('#c-add-clips');
  if (addBtn) addBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/*'; input.multiple = true;
    input.addEventListener('change', async () => {
      const clips = [...input.files].map(file => ({
        id: 'clip_' + Math.random().toString(36).slice(2, 10),
        filename: file.name, swatch: Math.floor(Math.random() * 8), durationSec: null,
        sizeBytes: file.size, uploader: 'Staff', uploadedAt: new Date().toISOString(),
        isOriginal: true, fileHandle: file,
      }));
      if (!clips.length) return;
      await ctx.repo.addClips(rec.id, clips, 'Staff');
      showToast(`${clips.length} clip(s) added`);
      ctx.refresh();
      paint(ctx);
    });
    input.click();
  });

  const downloadAll = body.querySelector('#c-download-all');
  if (downloadAll) downloadAll.addEventListener('click', () => downloadClips(rec.clips));

  body.querySelectorAll('[data-download-clip]').forEach(btn => btn.addEventListener('click', () => {
    const clip = rec.clips.find(c => c.id === btn.dataset.downloadClip);
    downloadClips(clip ? [clip] : []);
  }));
}

function downloadClips(clips) {
  const real = clips.filter(c => c.fileHandle);
  if (!real.length) { showToast('Mock data — original files aren’t wired to real storage in this prototype yet'); return; }
  real.forEach(c => {
    const url = URL.createObjectURL(c.fileHandle);
    const a = document.createElement('a');
    a.href = url; a.download = c.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });
}

/* =============================================================
 * USAGE tab
 * ============================================================= */
function usageHtml(rec) {
  if (!rec.usage.length) return `<div class="vm-drawer-section"><p class="muted">Not used in any auctions yet.</p></div>`;
  const totalLots = rec.usage.reduce((n, u) => n + u.lots.length, 0);
  const sorted = [...rec.usage].sort((a, b) => b.auctionDate.localeCompare(a.auctionDate));
  return `
    <div class="vm-drawer-section">
      <div class="vm-drawer-section-title">Used in Auctions — ${totalLots} use${totalLots === 1 ? '' : 's'}</div>
      ${sorted.map(u => `
        <div class="vm-usage-group">
          <div class="vm-usage-date">${formatDate(u.auctionDate)} — ${escapeHtml(u.auctionName)}</div>
          <div class="vm-usage-lots">${u.lots.map(l => `<span class="vm-usage-lot">${escapeHtml(l)}</span>`).join('')}</div>
          ${u.youtubeVersionId && u.youtubeVersionId !== rec.youtubeId ? `<div class="field-hint" style="margin-top:4px;">Used an earlier YouTube version (${escapeHtml(u.youtubeVersionId)})</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

/* =============================================================
 * ACTIVITY tab
 * ============================================================= */
function activityHtml(rec) {
  if (!rec.activity.length) return `<div class="vm-drawer-section"><p class="muted">No activity yet.</p></div>`;
  const sorted = [...rec.activity].sort((a, b) => b.ts.localeCompare(a.ts));
  return `
    <div class="vm-drawer-section">
      ${sorted.map(a => `
        <div class="vm-activity-item">
          <span class="vm-activity-dot"></span>
          <div>
            <div class="vm-activity-msg">${escapeHtml(a.message)}</div>
            <div class="vm-activity-meta">${escapeHtml(a.actor)} · ${formatDateTime(a.ts)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
