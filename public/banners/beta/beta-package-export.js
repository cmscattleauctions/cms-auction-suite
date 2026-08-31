/* =============================================================
 * Beta OBS Builder — auction package export
 * -------------------------------------------------------------
 * Produces a self-contained, human-readable auction folder as a ZIP
 * (using the same JSZip already loaded by Classic for the banner ZIP —
 * no new dependency):
 *
 *   CMS_Auction_OBS_Package/
 *     CMS_Auction_Scene_Collection.json
 *     MANIFEST.txt                            (human-readable: what goes where)
 *
 * Tag images and the stinger video are NOT bundled in this package —
 * unlike videos, they don't change per auction, so they're bundled
 * into Classic's own "Download All Banners" ZIP instead (alongside the
 * lot transition banners, which also live in a fixed, not per-auction,
 * folder) — see collectLotBannerAssets() in beta-main.js, called from
 * index.html's dlAllBanners(). This keeps the two downloads aligned
 * with the two different local-folder lifetimes: Lot Banners Folder
 * (fixed, reused every auction) vs. Auction OBS Root/Auction Folder
 * (a fresh dated subfolder every auction, for videos only).
 *
 * Cattle video files are deliberately NOT bundled here either — see the
 * project's video-source philosophy: the app never re-transports
 * multi-gigabyte video bytes through the browser. Videos are expected
 * at a deterministic local path (beta-state.js) that the operator's
 * existing video workflow already populates. Where the operator uses
 * "Choose File" to manually resolve one unmatched lot, that single file
 * is offered as its own direct download (see downloadRenamedVideoFile
 * below) — a light, per-file operation, not a bulk in-memory ZIP of
 * every video in the auction (which would risk exhausting browser
 * memory on a real auction's total video footage).
 * ============================================================= */

export async function fetchAsBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return res.blob();
}

function buildManifest({ auctionFolder, settings, lotPlans, uniqueVideoSources, tagAssets, unmatchedLots, missingTagImages }) {
  const lines = [];
  lines.push('CMS Auction OBS Package — Automated Video Setup (Beta)');
  lines.push(`Auction folder: ${auctionFolder}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('HOW TO USE');
  lines.push('----------');
  lines.push(`1. Place the cattle video files listed below into:`);
  lines.push(`   ${settings.auctionObsRoot}${auctionFolder}/videos/`);
  lines.push(`   using the EXACT filenames shown — these are already baked into the OBS JSON.`);
  lines.push(`2. Tag images and the stinger video are NOT in this package — they're bundled`);
  lines.push(`   into "Download All Banners" instead (alongside the lot transition banners),`);
  lines.push(`   since they don't change per auction. Make sure that download has been placed`);
  lines.push(`   into ${settings.lotBannersFolder} before importing this JSON.`);
  lines.push('3. In OBS: Scene Collection -> Import, choose the .json file from this package.');
  lines.push('');
  lines.push(`REQUIRED VIDEO FILES (${uniqueVideoSources.size})`);
  lines.push('----------------------------------------');
  if (!uniqueVideoSources.size) lines.push('(none matched — every lot will need a video dragged in manually, same as Classic)');
  for (const [cmsId, path] of uniqueVideoSources.entries()) {
    const lots = [...lotPlans.entries()].filter(([, p]) => p.cmsVideoId === cmsId).map(([lot]) => lot);
    lines.push(`  ${path.split('/').pop()}  <-  ${path}`);
    lines.push(`      used by lot(s): ${lots.join(', ')}`);
  }
  lines.push('');
  lines.push(`LOTS WITHOUT A MATCHED VIDEO (${unmatchedLots.length}) — drag in manually, same as Classic today`);
  lines.push('-------------------------------------------------------------------------------------');
  unmatchedLots.forEach(u => lines.push(`  Lot ${u.lot} — ${u.reason}`));
  lines.push('');
  if (missingTagImages.length) {
    lines.push(`WARNING — TAGS MISSING A LOCAL IMAGE (${missingTagImages.length})`);
    lines.push('----------------------------------------------------');
    missingTagImages.forEach(t => lines.push(`  ${t} — configure an image for this tag in Verification Tags before the build.`));
    lines.push('');
  }
  lines.push(`VERIFICATION TAG IMAGES USED IN THIS AUCTION (${tagAssets.size}) — see Download All Banners`);
  lines.push('----------------------------------------------------------------------------');
  for (const asset of tagAssets.values()) lines.push(`  ${asset.fileName}`);
  return lines.join('\n');
}

/**
 * Builds and triggers download of the auction package ZIP: the OBS JSON
 * plus a human-readable manifest. Tag images and the stinger are bundled
 * separately — see the file header.
 * `obsJson` is the ALREADY-AUGMENTED collection (from beta-obs-augment.js).
 */
export async function exportAuctionPackage({ obsJson, auctionFolder, settings, lotPlans, uniqueVideoSources, tagAssets, unmatchedLots, missingTagImages }) {
  const zip = new JSZip();
  zip.file('CMS_Auction_Scene_Collection.json', JSON.stringify(obsJson, null, 2));
  zip.file('MANIFEST.txt', buildManifest({ auctionFolder, settings, lotPlans, uniqueVideoSources, tagAssets, unmatchedLots, missingTagImages }));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CMS_Auction_OBS_Package_${auctionFolder || 'build'}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * "Choose File" resolution — renames the operator's picked File to the
 * deterministic target filename and downloads it as a single file, so
 * they just move/copy it into the auction's videos/ folder. No bulk zip,
 * no assumption about File System Access API support (works everywhere).
 */
export function downloadRenamedVideoFile(file, targetFileName) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = targetFileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
