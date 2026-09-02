/* =============================================================
 * Beta OBS Builder — orchestrator
 * -------------------------------------------------------------
 * The ONLY module public/banners/index.html imports for Beta. Owns the
 * pipeline (video match -> tag detect -> asset localize) and exposes a
 * small surface index.html's existing inline script calls into. Keeping
 * this as the single seam is what makes Beta additive/isolated: Classic's
 * code never has to know Beta's internals, only "is beta on, and if so
 * call these few functions."
 * ============================================================= */

import * as State from './beta-state.js';
import { listEnabledTags, addDetectionTerm } from './beta-tags-data.js';
import { batchLookupByYoutubeId, rememberVideoMapping } from './beta-video-lookup.js';
import { resolveLotVideo, extractYoutubeId, isValidCmsVideoId, safeFileStem } from './beta-video-match.js';
import { detectTagsForLot } from './beta-tag-detect.js';
import { getStingerConfig } from './beta-stinger-data.js';
import { augmentObsJsonForBeta } from './beta-obs-augment.js';
import { exportAuctionPackage, downloadFile, fetchAsBlob } from './beta-package-export.js';

export { State };

/**
 * Loads a tag image and finds its actual VISIBLE content bounding box —
 * not just the raw PNG/SVG canvas dimensions. Source tag images are
 * supplied externally and often carry wildly inconsistent transparent
 * padding (a checkmark badge cropped tight vs. a logo with 25% empty
 * space above/below) — scaling by naturalHeight alone (the old
 * behavior) made those render at very different visual sizes for the
 * same "Tag Height" setting, even though the setting was identical.
 * Scanning for the actual opaque pixels and using THAT for scale/
 * position math (see layoutTagRow in beta-obs-augment.js) makes tags
 * come out visually consistent regardless of how much padding their
 * source file happens to carry.
 *
 * Loads the image TWICE, deliberately: once plain (no crossOrigin —
 * exactly how this worked before content-trimming existed, and the
 * ONLY thing that determines whether this tag is usable at all), then
 * again WITH crossOrigin purely to attempt reading canvas pixel data
 * for the trim. A canvas read needs CORS or it throws; earlier this
 * function set crossOrigin on the single, only image load, which meant
 * any CORS hiccup made the ENTIRE tag fail to load (pushed into
 * missingTagImages, silently dropped from every download) instead of
 * just losing the trim — the single point of failure this second load
 * exists to remove. The trim stays a pure best-effort enhancement that
 * can never cause a tag to be dropped.
 */
function loadImageContentBox(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const naturalWidth = img.naturalWidth, naturalHeight = img.naturalHeight;
      const fullBox = { naturalWidth, naturalHeight, contentX: 0, contentY: 0, contentWidth: naturalWidth, contentHeight: naturalHeight };

      const cimg = new Image();
      cimg.crossOrigin = 'anonymous';
      cimg.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = naturalWidth;
          canvas.height = naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(cimg, 0, 0);
          const { data } = ctx.getImageData(0, 0, naturalWidth, naturalHeight);
          const ALPHA_THRESHOLD = 10; // ignore near-fully-transparent anti-aliasing noise at edges
          let minX = naturalWidth, minY = naturalHeight, maxX = -1, maxY = -1;
          for (let y = 0; y < naturalHeight; y++) {
            const rowBase = y * naturalWidth;
            for (let x = 0; x < naturalWidth; x++) {
              if (data[(rowBase + x) * 4 + 3] > ALPHA_THRESHOLD) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (maxX < 0) { resolve(fullBox); return; } // fully transparent — nothing to trim to
          resolve({ naturalWidth, naturalHeight, contentX: minX, contentY: minY, contentWidth: maxX - minX + 1, contentHeight: maxY - minY + 1 });
        } catch (err) {
          console.warn(`[beta] Could not read pixel data for ${url} (using untrimmed bounds):`, err);
          resolve(fullBox);
        }
      };
      cimg.onerror = () => {
        console.warn(`[beta] Could not CORS-load ${url} for content trimming — tag still usable, just untrimmed.`);
        resolve(fullBox);
      };
      cimg.src = url;
    };
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

/**
 * Build the full Beta pipeline result from Classic's already-parsed CSV
 * state (public/banners/index.html's parseWorkingOnCSV output — extended
 * with description/explicitVideoId/youtubeUrl fields per lotRow, see
 * index.html's K map. Classic itself never reads those extra fields, so
 * this extension is behaviorally inert for Classic).
 *
 * `fuzzyResolutions` — Map<lowercased foundText, 'use'|'ignore'> carried
 * across re-runs within one build session (cleared on new CSV upload).
 */
export async function runBetaPipeline(parsedCsvState, fuzzyResolutions = {}) {
  const settings = State.getBetaSettings();
  const tags = await listEnabledTags();

  // ---- Tag detection (Description is the sole source of truth) ----
  const perLotTags = new Map();   // lot -> { applied: [...], pendingFuzzy: [...] }
  for (const row of parsedCsvState.lotRows) {
    perLotTags.set(row.lot, detectTagsForLot(row.description, tags, fuzzyResolutions));
  }
  const fuzzyGroups = groupFuzzySuggestions(perLotTags);

  // ---- Video matching (batched YouTube ID lookup) ----
  const youtubeIds = parsedCsvState.lotRows
    .map(r => extractYoutubeId(r.youtubeUrl))
    .filter(Boolean);
  const youtubeMap = await batchLookupByYoutubeId(youtubeIds);
  const lookupFn = id => youtubeMap.get(id) || null;

  const lotPlans = new Map();
  const unmatchedLots = [];
  for (const row of parsedCsvState.lotRows) {
    const result = resolveLotVideo(row, lookupFn);
    const tagIds = (perLotTags.get(row.lot)?.applied || []).map(a => a.tagId);
    if (result.status === 'matched') {
      lotPlans.set(row.lot, {
        lot: row.lot, status: 'matched', cmsVideoId: result.cmsVideoId, source: result.source,
        youtubeId: result.youtubeId, tagIds,
        videoScale: settings.assumedVideoWidth ? (settings.assumedVideoWidth < 3840 ? 3840 / settings.assumedVideoWidth : 1) : 1,
      });
    } else {
      lotPlans.set(row.lot, { lot: row.lot, status: 'unmatched', cmsVideoId: null, youtubeId: result.youtubeId, tagIds, reason: result.reason });
      unmatchedLots.push({ lot: row.lot, reason: result.reason });
    }
  }

  // ---- Dedupe local video paths (one file per distinct CMS Video ID) ----
  const uniqueVideoSources = new Map();
  for (const plan of lotPlans.values()) {
    if (plan.status === 'matched' && !uniqueVideoSources.has(plan.cmsVideoId)) {
      uniqueVideoSources.set(plan.cmsVideoId, State.videoLocalPath(settings, plan.cmsVideoId));
    }
  }

  // ---- Localize tag assets actually used anywhere in this auction ----
  const usedTagIds = new Set();
  for (const plan of lotPlans.values()) plan.tagIds.forEach(id => usedTagIds.add(id));
  const tagAssets = new Map();
  const missingTagImages = [];
  for (const tagId of usedTagIds) {
    const tag = tags.find(t => t.id === tagId);
    if (!tag) continue;
    if (!tag.imageUrl) { missingTagImages.push(tag.name); continue; }
    const fileName = `${safeFileStem(tag.name)}.png`;
    const fallbackH = tag.defaultHeightPx || 180;
    let box = { naturalWidth: fallbackH, naturalHeight: fallbackH, contentX: 0, contentY: 0, contentWidth: fallbackH, contentHeight: fallbackH };
    try { box = await loadImageContentBox(tag.imageUrl); } catch { missingTagImages.push(tag.name); continue; }
    tagAssets.set(tagId, {
      id: tagId, name: tag.name, fileName,
      localPath: State.tagLocalPath(settings, fileName),
      downloadUrl: tag.imageUrl,
      naturalWidth: box.naturalWidth, naturalHeight: box.naturalHeight,
      contentX: box.contentX, contentY: box.contentY,
      contentWidth: box.contentWidth, contentHeight: box.contentHeight,
      sortOrder: tag.sortOrder ?? 0,
      // Manual per-tag fine-tuning on top of the auto-trimmed size —
      // most tags need neither; see beta-obs-augment.js's layoutTagRow.
      sizeAdjustPct: tag.sizeAdjustPct ?? 100,
      verticalOffsetPx: tag.verticalOffsetPx ?? 0,
    });
  }

  // ---- Stinger config (native OBS Transition Override — see beta-obs-augment.js) ----
  const stingerConfigDoc = await getStingerConfig();
  let stingerAsset = null;
  if (stingerConfigDoc.enabled && stingerConfigDoc.videoUrl) {
    stingerAsset = {
      enabled: true,
      fileName: stingerConfigDoc.fileName,
      downloadUrl: stingerConfigDoc.videoUrl,
      localPath: State.stingerLocalPath(settings, stingerConfigDoc.fileName),
      durationMs: stingerConfigDoc.durationMs || 800,
      transitionPointMs: stingerConfigDoc.transitionPointMs ?? 700,
    };
  }

  const totalTagSources = [...perLotTags.values()].reduce((sum, r) => sum + r.applied.length, 0);
  const lotsWithTags = [...perLotTags.values()].filter(r => r.applied.length > 0).length;

  return {
    settings, tags, perLotTags, fuzzyGroups,
    lotPlans, unmatchedLots, uniqueVideoSources,
    tagAssets, missingTagImages, stingerAsset,
    summary: {
      totalLots: parsedCsvState.lotRows.length,
      totalUniqueVideos: uniqueVideoSources.size,
      videosMatched: [...lotPlans.values()].filter(p => p.status === 'matched').length,
      videosUnmatched: unmatchedLots.length,
      totalVideoScenes: parsedCsvState.lotRows.length,
      exactTagMatches: [...perLotTags.values()].reduce((s, r) => s + r.applied.filter(a => !a.fromFuzzy).length, 0),
      pendingFuzzyMatches: fuzzyGroups.length,
      totalTagSources, lotsWithTags,
      missingTagImages: missingTagImages.length,
    },
  };
}

/** Keeps Build Summary numbers in sync after a Choose File / Skip Video action mutates lotPlans in place. */
function recomputeVideoSummary(ctx) {
  ctx.summary.videosMatched = [...ctx.lotPlans.values()].filter(p => p.status === 'matched').length;
  ctx.summary.videosUnmatched = ctx.unmatchedLots.length;
  ctx.summary.totalUniqueVideos = ctx.uniqueVideoSources.size;
}

function groupFuzzySuggestions(perLotTags) {
  const groups = new Map(); // key: foundText|tagId -> { foundText, suggestedTagId, suggestedTagName, lots: [] }
  for (const [lot, result] of perLotTags.entries()) {
    for (const s of result.pendingFuzzy) {
      const key = `${s.foundText.toLowerCase()}|${s.suggestedTagId}`;
      if (!groups.has(key)) groups.set(key, { foundText: s.foundText, suggestedTagId: s.suggestedTagId, suggestedTagName: s.suggestedTagName, lots: [] });
      groups.get(key).lots.push(lot);
    }
  }
  return [...groups.values()];
}

/**
 * Resolve one lot's unmatched video by an operator-picked local File.
 * This is a FALLBACK for this build only — it never silently rewrites
 * the authoritative CMS Video ID <-> YouTube ID relationship (that lives
 * in Video Manager / the `videos` collection, see beta-video-lookup.js).
 *
 * If the chosen file's name is itself a valid CMS Video ID AND this lot
 * already has a known YouTube ID (from the CSV) with no existing mapping,
 * we stash an EXPLICIT, unconfirmed `rememberOffer` on the plan — the
 * review UI surfaces it as its own "Remember this match?" action the
 * operator must actively click. Nothing is written to Firestore here.
 */
export async function resolveWithChosenFile(ctx, lot, file) {
  const plan = ctx.lotPlans.get(lot);
  if (!plan) return;
  const settings = ctx.settings;
  const stem = safeFileStem(plan.youtubeId || `LOT-${lot}`);
  const ext = (file.name.split('.').pop() || settings.videoExt).toLowerCase();
  const targetFileName = `${stem}.${ext}`;

  downloadFile(file, targetFileName);

  const guessId = file.name.replace(/\.[^.]+$/, '');
  const cmsVideoId = isValidCmsVideoId(guessId) ? guessId : stem;
  plan.status = 'matched';
  plan.cmsVideoId = cmsVideoId;
  plan.source = 'manual-file';
  ctx.uniqueVideoSources.set(cmsVideoId, State.videoLocalPath(settings, cmsVideoId));

  plan.rememberOffer = (isValidCmsVideoId(guessId) && plan.youtubeId)
    ? { lot, cmsVideoId: guessId, youtubeId: plan.youtubeId, confirmed: false }
    : null; // clear any stale offer from a previous Choose File attempt on this lot

  ctx.unmatchedLots = ctx.unmatchedLots.filter(u => u.lot !== lot);
  recomputeVideoSummary(ctx);
  return plan;
}

/**
 * Explicit operator confirmation for a `rememberOffer` — the only path
 * that writes to Firestore. Re-checks for a conflicting mapping right
 * before writing (rather than trusting the pipeline-run-time lookup,
 * which could be stale) so this never silently clobbers a real record
 * with a manually-guessed one.
 */
export async function confirmRememberMapping(ctx, lot) {
  const plan = ctx.lotPlans.get(lot);
  if (!plan || !plan.rememberOffer || plan.rememberOffer.confirmed) return;
  const { cmsVideoId, youtubeId } = plan.rememberOffer;

  const fresh = await batchLookupByYoutubeId([youtubeId]);
  const existing = fresh.get(youtubeId);
  if (existing && existing.videoId && existing.videoId !== cmsVideoId) {
    plan.rememberOffer.conflict = existing.videoId;
    throw new Error(`YouTube ID ${youtubeId} is already mapped to ${existing.videoId} — not overwriting. Resolve this in Video Manager if that's wrong.`);
  }

  const result = await rememberVideoMapping({ cmsVideoId, youtubeId, youtubeUrl: null });
  if (result.status === 'no-record') {
    throw new Error(result.message);
  }
  plan.rememberOffer.confirmed = true;
}

/** Operator declined — just clear the offer, nothing is written. */
export function dismissRememberOffer(ctx, lot) {
  const plan = ctx.lotPlans.get(lot);
  if (plan) plan.rememberOffer = null;
}

/** Explicit "Skip Video" — still fully valid, per spec: never blocks the build. */
export function resolveWithSkip(ctx, lot) {
  const plan = ctx.lotPlans.get(lot);
  if (!plan) return;
  plan.status = 'skipped';
  plan.cmsVideoId = null;
  ctx.unmatchedLots = ctx.unmatchedLots.filter(u => u.lot !== lot);
  recomputeVideoSummary(ctx);
}

/** "Use + Remember" — apply now AND persist the alias to Firestore for future builds. */
export async function rememberFuzzyAlias(tagId, foundText) {
  await addDetectionTerm(tagId, foundText);
}

/**
 * Final step: augment Classic's already-built OBS JSON with Beta's
 * video/tag/intro scene items, then export the downloadable package.
 */
export async function buildAndExportBeta(ctx, classicObsJson, canvasW, canvasH) {
  const lotPlansForAugment = new Map();
  for (const [lot, plan] of ctx.lotPlans.entries()) {
    lotPlansForAugment.set(lot, {
      cmsVideoId: plan.status === 'matched' ? plan.cmsVideoId : null,
      videoScale: plan.videoScale,
      tagIds: plan.tagIds,
    });
  }

  const augmented = augmentObsJsonForBeta(classicObsJson, {
    canvasW, canvasH,
    lotPlans: lotPlansForAugment,
    uniqueVideoSources: ctx.uniqueVideoSources,
    tagAssets: ctx.tagAssets,
    tagLayout: ctx.settings.tagLayout,
    stingerConfig: ctx.stingerAsset,
  });

  await exportAuctionPackage({
    obsJson: augmented,
    auctionFolder: ctx.settings.auctionFolder || 'auction',
    settings: ctx.settings,
    lotPlans: ctx.lotPlans,
    uniqueVideoSources: ctx.uniqueVideoSources,
    tagAssets: ctx.tagAssets,
    unmatchedLots: ctx.unmatchedLots,
    missingTagImages: ctx.missingTagImages,
  });

  return augmented;
}

/**
 * Tag images + the stinger video, as {fileName, blob} pairs ready to drop
 * into a zip alongside the lot banners — called from Classic's
 * dlAllBanners() via window.CMSBetaHooks when Beta mode is on. These land
 * in the same fixed Lot Banners Folder as the banners themselves (see
 * beta-state.js tagLocalPath/stingerLocalPath), not a per-auction folder,
 * since neither changes per auction.
 */
export async function collectLotBannerAssets(ctx) {
  const assets = [];
  for (const asset of ctx.tagAssets.values()) {
    if (!asset.downloadUrl) continue;
    const blob = await fetchAsBlob(asset.downloadUrl);
    assets.push({ fileName: asset.fileName, blob });
  }
  if (ctx.stingerAsset && ctx.stingerAsset.downloadUrl) {
    const blob = await fetchAsBlob(ctx.stingerAsset.downloadUrl);
    assets.push({ fileName: ctx.stingerAsset.fileName, blob });
  }
  return assets;
}
