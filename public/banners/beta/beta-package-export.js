/* =============================================================
 * Beta OBS Builder — auction package export
 * -------------------------------------------------------------
 * Produces a self-contained, human-readable auction folder as a ZIP
 * (using the same JSZip already loaded by Classic for the banner ZIP —
 * no new dependency):
 *
 *   CMS_Auction_OBS_Package/
 *     CMS_Auction_Scene_Collection.json
 *     tags/ASV.png, tags/NHTC.png, ...        (small — pulled from Firebase Storage)
 *     stinger/stinger.mp4                     (small — pulled from Firebase Storage)
 *     MANIFEST.txt                            (human-readable: what goes where)
 *
 * Cattle video files are deliberately NOT bundled here — see the
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

async function fetchAsBlob(url) {
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
  lines.push(`1. Unzip this package so its contents land inside:`);
  lines.push(`   ${settings.auctionObsRoot}${auctionFolder}/`);
  lines.push(`   (i.e. tags/ and stinger/ from this zip go directly under that folder)`);
  lines.push(`2. Place the cattle video files listed below into:`);
  lines.push(`   ${settings.auctionObsRoot}${auctionFolder}/videos/`);
  lines.push(`   using the EXACT filenames shown — these are already baked into the OBS JSON.`);
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
  lines.push(`VERIFICATION TAG IMAGES BUNDLED (${tagAssets.size})`);
  lines.push('----------------------------------');
  for (const asset of tagAssets.values()) lines.push(`  tags/${asset.fileName}`);
  return lines.join('\n');
}

/**
 * Builds and triggers download of the full auction package ZIP.
 * `obsJson` is the ALREADY-AUGMENTED collection (from beta-obs-augment.js).
 */
export async function exportAuctionPackage({ obsJson, auctionFolder, settings, lotPlans, uniqueVideoSources, tagAssets, stingerAsset, unmatchedLots, missingTagImages }) {
  const zip = new JSZip();
  zip.file('CMS_Auction_Scene_Collection.json', JSON.stringify(obsJson, null, 2));

  const tagsFolder = zip.folder('tags');
  for (const asset of tagAssets.values()) {
    if (!asset.downloadUrl) continue;
    const blob = await fetchAsBlob(asset.downloadUrl);
    tagsFolder.file(asset.fileName, blob);
  }

  if (stingerAsset && stingerAsset.downloadUrl) {
    const stingerFolder = zip.folder('stinger');
    const blob = await fetchAsBlob(stingerAsset.downloadUrl);
    stingerFolder.file(stingerAsset.fileName, blob);
  }

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
