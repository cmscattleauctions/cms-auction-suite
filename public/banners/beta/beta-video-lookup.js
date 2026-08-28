/* =============================================================
 * Beta OBS Builder — Video Manager lookup (Firestore-backed)
 * -------------------------------------------------------------
 * Reads the REAL `videoRecords` collection (public/video-manager/
 * firestore-data.js — Video Manager is fully Firebase-wired in
 * production, not mock data) for YouTube ID -> canonical CMS Video ID.
 *
 * Batches lookups (one query per <=10 distinct YouTube IDs, Firestore's
 * `in` operator limit at a conservative chunk size) instead of one read
 * per lot row — a single auction can have 100+ lots but far fewer
 * distinct videos once option-lot / reused-video duplicates collapse.
 * ============================================================= */

import { getBetaDb, collection, doc, getDocs, query, where, updateDoc, serverTimestamp } from './beta-firebase.js';

const COLLECTION = 'videoRecords';
const CHUNK_SIZE = 10;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Given a list of distinct YouTube IDs, return a Map<youtubeId, record>.
 * Missing ids simply aren't in the map (caller treats absence as unmatched).
 */
export async function batchLookupByYoutubeId(youtubeIds) {
  const map = new Map();
  const db = getBetaDb();
  const distinct = [...new Set((youtubeIds || []).filter(Boolean))];
  if (!db || !distinct.length) return map;

  for (const group of chunk(distinct, CHUNK_SIZE)) {
    const snap = await getDocs(query(collection(db, COLLECTION), where('youtubeId', 'in', group)));
    snap.forEach(d => {
      const data = d.data();
      // If a YouTube id somehow has multiple records, first one wins —
      // ambiguity here still resolves the same way explicit fuzzy-match
      // ambiguity does: never guess, so ties are just "first seen".
      if (!map.has(data.youtubeId)) map.set(data.youtubeId, { docId: d.id, ...data });
    });
  }
  return map;
}

/**
 * Look up a video record by its CMS Video ID — used by
 * rememberVideoMapping below to find the REAL record to complete,
 * never to fabricate one.
 */
async function findByVideoId(cmsVideoId) {
  const db = getBetaDb();
  if (!db || !cmsVideoId) return null;
  const snap = await getDocs(query(collection(db, COLLECTION), where('videoId', '==', cmsVideoId)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { docId: d.id, ...d.data() };
}

/**
 * Records a resolved YouTube ID -> CMS Video ID mapping so future builds
 * match it automatically (the video-matching analog of the tag system's
 * "Use + Remember"). Only called on an explicit operator confirmation
 * (see beta-main.js's confirmRememberMapping).
 *
 * DELIBERATELY CONSERVATIVE: `videoRecords` is the real collection the
 * live Video Manager UI renders (consignor/sex/sire/dam codes, activity
 * log, usage history, clips, etc.) — this function only ever UPDATES an
 * EXISTING record's youtubeId/youtubeUrl/embedUrl/embedCode fields
 * (mirroring exactly what repository.js's own setYoutube() writes). It
 * never creates a new record, which would otherwise need to fabricate a
 * consignor name, sex/sire/dam labels, and every other field the real
 * UI expects — guessing at those would risk shipping a malformed record
 * into a collection real staff actively use. If no record exists yet
 * for this CMS Video ID, the caller surfaces that as "add it in Video
 * Manager first" instead of writing anything.
 */
export async function rememberVideoMapping({ cmsVideoId, youtubeId, youtubeUrl }) {
  const db = getBetaDb();
  if (!db || !cmsVideoId || !youtubeId) return { status: 'skipped' };

  const existing = await findByVideoId(cmsVideoId);
  if (!existing) {
    return { status: 'no-record', message: `No Video Manager record exists for ${cmsVideoId} yet — add it there first, then this mapping can be saved.` };
  }

  await updateDoc(doc(db, COLLECTION, existing.docId), {
    youtubeId,
    youtubeUrl: youtubeUrl || existing.youtubeUrl || null,
    embedUrl: `https://www.youtube.com/embed/${youtubeId}?mute=1&autoplay=1&playlist=${youtubeId}&loop=1`,
    embedCode: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}" title="CMS Auction Video" frameborder="0" allowfullscreen></iframe>`,
    lastUpdated: serverTimestamp(),
  });
  return { status: 'updated', docId: existing.docId };
}
