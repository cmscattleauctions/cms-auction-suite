/* =============================================================
 * Beta OBS Builder — review/validation screen
 * -------------------------------------------------------------
 * Renders the three review sections required before generating the
 * OBS collection in Beta mode: Video Matching, Verification Tags,
 * Build Summary. Reuses Classic's existing CSS classes (card,
 * section-title, btn, status-chip, stat, ...) — see beta.css for the
 * handful of Beta-only additions. Nothing here ever blocks the build;
 * every action either resolves a warning or leaves it as a warning.
 * ============================================================= */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let hiddenFileInput = null;
function getHiddenFileInput() {
  if (hiddenFileInput) return hiddenFileInput;
  hiddenFileInput = document.createElement('input');
  hiddenFileInput.type = 'file';
  hiddenFileInput.accept = 'video/*,.mp4,.mov,.mkv';
  hiddenFileInput.style.display = 'none';
  document.body.appendChild(hiddenFileInput);
  return hiddenFileInput;
}

/**
 * @param container  DOM element to render into
 * @param ctx         result of beta-main.runBetaPipeline()
 * @param handlers    { onChooseFile(lot, file), onSkip(lot), onFuzzyUse(group), onFuzzyIgnore(group), onFuzzyRemember(group),
 *                       onConfirmRemember(lot), onDismissRemember(lot), onRerender(), showToast(msg, isError) }
 */
export function renderBetaReview(container, ctx, handlers) {
  container.innerHTML = `
    ${renderVideoSection(ctx)}
    ${renderTagSection(ctx)}
    ${renderSummarySection(ctx)}
  `;
  wireVideoSection(container, ctx, handlers);
  wireTagSection(container, ctx, handlers);
}

/* ---------------- Video Matching ---------------- */

function renderVideoSection(ctx) {
  const { summary, unmatchedLots, lotPlans } = ctx;
  const pct = summary.totalLots ? Math.round((summary.videosMatched / summary.totalLots) * 100) : 0;
  const rememberOffers = [...lotPlans.values()].filter(p => p.rememberOffer && !p.rememberOffer.confirmed);
  return `
  <div class="card" style="margin-bottom:20px;">
    <div class="section-title">Beta Review · Video Matching</div>
    <div class="beta-stat-line">
      <strong>${summary.videosMatched} / ${summary.totalLots}</strong> lots matched to a local video automatically
      <span class="status-chip ${summary.videosUnmatched ? 'warn' : 'good'}" style="margin-left:10px;">${pct}% matched</span>
    </div>
    ${unmatchedLots.length ? `
      <details style="margin-top:10px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);">${unmatchedLots.length} lot${unmatchedLots.length === 1 ? '' : 's'} need a video — click to review</summary>
        <div class="beta-warning-list">
          ${unmatchedLots.map(u => `
            <div class="beta-warning-row" data-lot="${esc(u.lot)}">
              <div><strong>Lot ${esc(u.lot)}</strong> — <span class="helper">${esc(u.reason)}</span></div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost btn-sm beta-btn-choose" data-lot="${esc(u.lot)}">Choose File</button>
                <button class="btn btn-ghost btn-sm beta-btn-skip" data-lot="${esc(u.lot)}">Skip Video</button>
              </div>
            </div>`).join('')}
        </div>
      </details>` : `<p class="helper" style="margin-top:8px;">All lots matched — nothing to review.</p>`}
    ${rememberOffers.length ? `
      <div class="beta-fuzzy-list" style="margin-top:14px;">
        ${rememberOffers.map(p => `
          <div class="beta-fuzzy-row" data-lot="${esc(p.lot)}">
            <div>
              <strong>Remember this match?</strong> Lot ${esc(p.lot)} — YouTube ID <span class="mono">${esc(p.rememberOffer.youtubeId)}</span> isn't linked to a CMS Video ID yet.
              <div class="helper">The file you chose is named <span class="mono">${esc(p.rememberOffer.cmsVideoId)}</span>. Save this as its permanent Video Manager mapping for future auctions?</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-ghost btn-sm beta-remember-dismiss" data-lot="${esc(p.lot)}">No Thanks</button>
              <button class="btn btn-success btn-sm beta-remember-confirm" data-lot="${esc(p.lot)}">Remember Mapping</button>
            </div>
          </div>`).join('')}
      </div>` : ''}
  </div>`;
}

function wireVideoSection(container, ctx, handlers) {
  const input = getHiddenFileInput();
  container.querySelectorAll('.beta-btn-choose').forEach(btn => {
    btn.addEventListener('click', () => {
      const lot = btn.dataset.lot;
      input.onchange = async () => {
        const file = input.files[0];
        input.value = '';
        if (!file) return;
        await handlers.onChooseFile(lot, file);
        handlers.onRerender();
      };
      input.click();
    });
  });
  container.querySelectorAll('.beta-btn-skip').forEach(btn => {
    btn.addEventListener('click', () => {
      handlers.onSkip(btn.dataset.lot);
      handlers.onRerender();
    });
  });
  container.querySelectorAll('.beta-remember-confirm').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await handlers.onConfirmRemember(btn.dataset.lot);
      } catch (err) {
        handlers.showToast(err.message, true); // conflict case — rare, surfaced not silently dropped
      }
      handlers.onRerender();
    });
  });
  container.querySelectorAll('.beta-remember-dismiss').forEach(btn => {
    btn.addEventListener('click', () => {
      handlers.onDismissRemember(btn.dataset.lot);
      handlers.onRerender();
    });
  });
}

/* ---------------- Verification Tags ---------------- */

function renderTagSection(ctx) {
  const { summary, fuzzyGroups, missingTagImages } = ctx;
  return `
  <div class="card" style="margin-bottom:20px;">
    <div class="section-title">Beta Review · Verification Tags</div>
    <div class="beta-stat-line">
      <strong>${summary.exactTagMatches}</strong> exact tag matches across ${summary.lotsWithTags} lot(s)
      ${fuzzyGroups.length ? `<span class="status-chip warn" style="margin-left:10px;">${fuzzyGroups.length} possible match${fuzzyGroups.length === 1 ? '' : 'es'} need review</span>`
        : `<span class="status-chip good" style="margin-left:10px;">No fuzzy matches pending</span>`}
    </div>
    ${missingTagImages.length ? `<div class="alert-banner" style="display:block;margin-top:14px;"><strong>Missing tag image${missingTagImages.length === 1 ? '' : 's'}:</strong> ${missingTagImages.map(esc).join(', ')} — upload an image for these in Verification Tags, or that tag will be skipped on affected lots.</div>` : ''}
    ${fuzzyGroups.length ? `
      <div class="beta-fuzzy-list">
        ${fuzzyGroups.map((g, i) => `
          <div class="beta-fuzzy-row" data-idx="${i}">
            <div>
              <strong>Possible Tag Match</strong> — found <span class="mono">"${esc(g.foundText)}"</span> → suggests <strong>${esc(g.suggestedTagName)}</strong>
              <div class="helper">Lot${g.lots.length === 1 ? '' : 's'}: ${g.lots.map(esc).join(', ')}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-ghost btn-sm beta-fz-use" data-idx="${i}">Use This Time</button>
              <button class="btn btn-ghost btn-sm beta-fz-ignore" data-idx="${i}">Don't Use</button>
              <button class="btn btn-success btn-sm beta-fz-remember" data-idx="${i}">Use + Remember</button>
            </div>
          </div>`).join('')}
      </div>` : ''}
  </div>`;
}

function wireTagSection(container, ctx, handlers) {
  const bind = (cls, fn) => container.querySelectorAll(cls).forEach(btn => {
    btn.addEventListener('click', async () => {
      const group = ctx.fuzzyGroups[Number(btn.dataset.idx)];
      if (!group) return;
      await fn(group);
      handlers.onRerender();
    });
  });
  bind('.beta-fz-use', handlers.onFuzzyUse);
  bind('.beta-fz-ignore', handlers.onFuzzyIgnore);
  bind('.beta-fz-remember', handlers.onFuzzyRemember);
}

/* ---------------- Build Summary ---------------- */

function renderSummarySection(ctx) {
  const s = ctx.summary;
  const warnings = [];
  if (s.videosUnmatched) warnings.push(`${s.videosUnmatched} lot(s) have no matched video — they'll build with intro/tags only, ready for a manual drag-and-drop.`);
  if (s.pendingFuzzyMatches) warnings.push(`${s.pendingFuzzyMatches} possible tag match(es) still need a decision above.`);
  if (s.missingTagImages) warnings.push(`${s.missingTagImages} tag(s) used in this auction have no image configured.`);

  return `
  <div class="card">
    <div class="section-title">Beta Review · Build Summary</div>
    <div class="stats-row">
      <div class="stat"><div class="stat-num">${s.totalVideoScenes}</div><div class="stat-label">Video Scenes</div></div>
      <div class="stat"><div class="stat-num">${s.videosMatched}</div><div class="stat-label">Videos Attached</div></div>
      <div class="stat"><div class="stat-num" style="color:${s.videosUnmatched ? '#ffaa44' : undefined}">${s.videosUnmatched}</div><div class="stat-label">Need Manual Video</div></div>
      <div class="stat"><div class="stat-num">${s.totalTagSources}</div><div class="stat-label">Tag Sources</div></div>
      <div class="stat"><div class="stat-num">${s.lotsWithTags}</div><div class="stat-label">Lots With Tags</div></div>
    </div>
    ${warnings.length ? `<div class="alert-banner" style="display:block;">${warnings.map(esc).join('<br>')}</div>` : `<p class="helper">No open warnings — ready to generate.</p>`}
  </div>`;
}
