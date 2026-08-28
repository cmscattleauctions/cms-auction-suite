/* =============================================================
 * Beta OBS Builder — Video identification & matching
 * -------------------------------------------------------------
 * Pure functions. No DOM, no Firebase. Implements the deterministic
 * (non-fuzzy) matching hierarchy from the Automated Video Setup spec:
 *
 *   Priority 1 — explicit, structurally-valid CMS Video ID on the row
 *   Priority 2 — YouTube URL on the row -> extract YouTube ID ->
 *                look up the Video Manager record -> use its CMS Video ID
 *   Priority 3 — a raw YouTube ID (no URL wrapper) on the row -> same lookup
 *
 * No fuzzy matching is ever applied to video identity — a wrong cattle
 * video attached to a lot is worse than an unmatched video, so any
 * ambiguity here always resolves to "unmatched" (a warning), never a guess.
 *
 * Reuses the existing CMS Video ID grammar from video-manager/video-id.js
 * (Consignor.Sex.Sire.Dam.Weight.MMYY[-suffix]) rather than re-implementing it.
 * ============================================================= */

import { parseVideoId } from '../../video-manager/video-id.js';

/** True if `raw` is a structurally-valid CMS Video ID (Priority 1 candidate). */
export function isValidCmsVideoId(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  return parseVideoId(s).valid;
}

/**
 * Extract a YouTube video identifier from a URL in any of the common
 * formats CMS actually uses (watch?v=, youtu.be/, embed/, shorts/), or
 * return the input unchanged if it already looks like a bare 11-ish char
 * YouTube ID. Returns null if nothing usable is found.
 */
export function extractYoutubeId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  // youtu.be/<id>
  let m = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (m) return stripTrailing(m[1]);

  // .../watch?v=<id>  (also matches v=<id> anywhere in a query string)
  m = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (m) return stripTrailing(m[1]);

  // .../embed/<id>  or  .../shorts/<id>  or  .../live/<id>
  m = raw.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{6,})/);
  if (m) return stripTrailing(m[1]);

  // Bare id, no URL wrapper at all (Priority 3 raw-identifier case)
  if (/^[a-zA-Z0-9_-]{6,15}$/.test(raw) && !raw.includes('.') && !raw.includes('/')) {
    return raw;
  }
  return null;
}

function stripTrailing(id) {
  // A regex boundary of 6+ id-chars can over-capture into a following
  // path/query segment on malformed input; real YouTube ids are 11 chars.
  return id.length > 11 ? id.slice(0, 11) : id;
}

/**
 * Resolve one lot row's video identity down to a canonical CMS Video ID,
 * given the row's raw fields and a lookup function for the Video Manager
 * store (see beta-video-lookup.js — kept separate so this module stays
 * Firebase-free and unit-testable).
 *
 * `row` fields used (all optional, all as they appear in the Working On CSV):
 *   explicitVideoId      — the "Video" column, when someone typed a CMS Video ID directly
 *   youtubeUrl            — "Preview Video Link" (preferred) or "Automated Embedded Link"
 *
 * `lookupByYoutubeId(youtubeId) => { videoId, youtubeId, ... } | null`
 *   Supplied by the caller (backed by a batched Firestore lookup map in practice).
 *
 * Returns:
 *   { status: 'matched', cmsVideoId, source: 'explicit'|'youtube', youtubeId }
 *   { status: 'unmatched', reason, youtubeId }
 */
export function resolveLotVideo(row, lookupByYoutubeId) {
  const explicit = String(row.explicitVideoId || '').trim();
  if (explicit && isValidCmsVideoId(explicit)) {
    return { status: 'matched', cmsVideoId: explicit, source: 'explicit', youtubeId: null };
  }

  const rawLink = String(row.youtubeUrl || '').trim();
  const youtubeId = extractYoutubeId(rawLink);

  if (!youtubeId) {
    return {
      status: 'unmatched',
      reason: explicit ? 'The "Video" column value is not a valid CMS Video ID and no YouTube link was found.' : 'No CMS Video ID and no YouTube link on this row.',
      youtubeId: null,
    };
  }

  const record = lookupByYoutubeId(youtubeId);
  if (!record || !record.videoId) {
    return {
      status: 'unmatched',
      reason: `No Video Manager record found for YouTube ID ${youtubeId}.`,
      youtubeId,
    };
  }

  return { status: 'matched', cmsVideoId: record.videoId, source: 'youtube', youtubeId };
}

/** Sanitize a CMS Video ID (or YouTube ID fallback) into a safe local filename stem. */
export function safeFileStem(id) {
  return String(id || '').trim().replace(/[^A-Za-z0-9._-]/g, '_');
}
