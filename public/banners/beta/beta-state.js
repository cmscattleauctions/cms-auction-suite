/* =============================================================
 * Beta OBS Builder — mode + settings state
 * -------------------------------------------------------------
 * Small, dependency-free state module. Mirrors the localStorage
 * pattern Classic already uses for GitHub repo settings (same file,
 * top of the <script> block) rather than inventing a new persistence
 * mechanism — these are per-workstation operator preferences, not
 * team-shared config (team-shared config — tags, stinger — lives in
 * Firestore; see beta-tags-data.js / beta-stinger-data.js).
 * ============================================================= */

const MODE_KEY = 'cms_obs_build_mode_v1';         // 'classic' | 'beta'
const SETTINGS_KEY = 'cms_obs_beta_settings_v1';

export const DEFAULT_SETTINGS = {
  // Mirrors the existing hardcoded DROPBOX_BANNER_PATH convention — the
  // deterministic local root the generated auction package is meant to
  // be unzipped into. Videos live under `${auctionObsRoot}${auctionFolder}/...`
  // — for an operator who keeps a fresh dated folder per auction. Not
  // every operator works this way; see lotVideosFolder below.
  auctionObsRoot: '/Users/brysonmurray/Library/CloudStorage/Dropbox/Auction OBS/Auctions/',
  auctionFolder: '',                // e.g. "2026-09-10" — set per build
  // Optional. Some operators never use per-auction dated folders at all —
  // they keep ONE flat folder and just replace its contents each month.
  // videoLocalPath() can't express "flat, no /videos/ subfolder" using
  // auctionObsRoot/auctionFolder alone (that formula always appends a
  // literal "/videos/" segment), so this is a separate override: when
  // set, videos are looked up directly here instead, ignoring
  // auctionObsRoot/auctionFolder entirely for video purposes. Empty by
  // default so the per-auction-folder behavior above is unchanged for
  // operators who do use it.
  lotVideosFolder: '',
  // Tags and the stinger, unlike videos, don't change per auction — they
  // live in the same fixed folder as the lot transition banners (which
  // Download All Banners already downloads), not a per-auction subfolder.
  // index.html's Classic script (getDropboxBannerPath()) reads this exact
  // field straight out of localStorage too, for its own transition/option
  // banner image paths — same real-world folder, one setting instead of
  // two. If SETTINGS_KEY or this field name ever changes, update that
  // read too.
  lotBannersFolder: '/Users/brysonmurray/Library/CloudStorage/Dropbox/Auction OBS/Lot Banners/',
  videoExt: 'mp4',
  assumedVideoWidth: 1920,          // used only to compute a sane default on-canvas scale
  assumedVideoHeight: 1080,
  tagLayout: {
    rightMargin: 80,
    bottomMargin: 80,
    spacing: 30,
    tagHeight: 180,
  },
};

export function getBuildMode() {
  const v = localStorage.getItem(MODE_KEY);
  return v === 'beta' ? 'beta' : 'classic'; // Classic is always the default
}
export function setBuildMode(mode) {
  localStorage.setItem(MODE_KEY, mode === 'beta' ? 'beta' : 'classic');
}

export function getBetaSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      tagLayout: { ...DEFAULT_SETTINGS.tagLayout, ...(saved.tagLayout || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveBetaSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Deterministic local path an auto-matched/skip-and-later-dropped video is expected at. */
export function videoLocalPath(settings, cmsVideoId) {
  if (settings.lotVideosFolder) {
    return `${settings.lotVideosFolder}${cmsVideoId}.${settings.videoExt}`;
  }
  return `${settings.auctionObsRoot}${settings.auctionFolder}/videos/${cmsVideoId}.${settings.videoExt}`;
}
/** Flat — lands in the same folder as the lot banners themselves, no subfolder. */
export function tagLocalPath(settings, tagFileName) {
  return `${settings.lotBannersFolder}${tagFileName}`;
}
export function stingerLocalPath(settings, stingerFileName) {
  return `${settings.lotBannersFolder}${stingerFileName}`;
}
