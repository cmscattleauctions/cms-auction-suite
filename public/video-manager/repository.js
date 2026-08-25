/* =============================================================
 * CMS Video Manager — Data-service layer
 * -------------------------------------------------------------
 * This is the ONLY place that touches the database. UI code must
 * never read mock-data.js or firestore-data.js directly and must
 * never scatter its own arrays — everything goes through these
 * repositories.
 *
 * Video records are real and Firestore-backed (see firestore-data.js
 * for the `videoRecords` collection). Consignors and sire/dam types
 * (the Video ID Manager's editable dictionaries) are Firestore-backed
 * too, one document per list under referenceData/* — see
 * ensureReferenceLoaded() below. Sex types, video makers, video
 * formats, and staff are still plain static lists in mock-data.js;
 * nothing edits those at runtime, so there was no need to move them.
 *
 * All video records load once into an in-memory cache on first use
 * (629 documents is trivial for a single Firestore read) and every
 * write updates both Firestore and the cache before emitting
 * 'videos-changed', so the UI layer's existing subscribe()-based
 * refresh keeps working completely unchanged. Reference data follows
 * the same shape but is preloaded explicitly by app.js's boot() (see
 * ReferenceDataRepository.preload()) rather than loaded lazily on
 * first read, since several places read it synchronously.
 * ============================================================= */

import {
  SEX_TYPES, SIRE_TYPES, DAM_TYPES, CONSIGNORS, VIDEO_MAKERS, STAFF,
  VIDEO_FORMATS,
  labelFor, consignorFor,
} from './mock-data.js';
import { buildBaseId, nextAvailableSuffix, formatMonthYear, generateInternalId } from './video-id.js';
import * as FirestoreData from './firestore-data.js';

/* =============================================================
 * Tiny pub/sub so views can re-render when the store changes,
 * without a framework.
 * ============================================================= */
function createEmitter() {
  const listeners = new Set();
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(evt) { listeners.forEach(fn => fn(evt)); },
  };
}

/* =============================================================
 * Video record cache — loaded once from Firestore, kept in sync
 * with every write this tab makes. Doesn't pick up writes from
 * OTHER tabs/users automatically (no realtime listener — matches
 * the manual-refresh pattern already used by shared/cms-data.js
 * elsewhere in this suite); reloading the page picks those up.
 * ============================================================= */
let videos = [];
let loadPromise = null;
const emitter = createEmitter();

function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = FirestoreData.fetchAllVideos().then(list => { videos = list; return videos; });
  }
  return loadPromise;
}

async function persist(record) {
  await FirestoreData.saveVideo(record);
  emitter.emit({ type: 'videos-changed' });
}

function touch(record, actor) {
  record.lastUpdated = new Date().toISOString();
}

/* =============================================================
 * Reference data cache — same load-once-then-persist pattern as
 * the video cache above. CONSIGNORS/SIRE_TYPES/DAM_TYPES (imported
 * from mock-data.js) are mutated in place — cleared and repopulated
 * from Firestore, or left as-is and used to seed Firestore the very
 * first time a document doesn't exist yet — rather than reassigned,
 * since nothing outside this file imports those array bindings.
 * ============================================================= */
const REFERENCE_LISTS = { consignors: CONSIGNORS, sireTypes: SIRE_TYPES, damTypes: DAM_TYPES };
let referenceLoadPromise = null;

async function loadOrSeedReferenceList(key, arr) {
  const stored = await FirestoreData.fetchReferenceList(key);
  if (stored) {
    arr.length = 0;
    arr.push(...stored);
  } else {
    await FirestoreData.saveReferenceList(key, arr);
  }
}

function ensureReferenceLoaded() {
  if (!referenceLoadPromise) {
    referenceLoadPromise = Promise.all(
      Object.entries(REFERENCE_LISTS).map(([key, arr]) => loadOrSeedReferenceList(key, arr))
    );
  }
  return referenceLoadPromise;
}

async function persistReferenceList(key) {
  await FirestoreData.saveReferenceList(key, REFERENCE_LISTS[key]);
  emitter.emit({ type: 'reference-changed' });
}

function logActivity(record, actor, type, message) {
  record.activity.unshift({ ts: new Date().toISOString(), actor, type, message });
}

/* =============================================================
 * ReferenceDataRepository
 * -------------------------------------------------------------
 * Consignors + sex/sire/dam code dictionaries. Staff can add
 * missing codes inline without leaving the workflow; new
 * consignors are flagged NEW — NEEDS REVIEW. Still in-memory/
 * mock-data.js-backed, not Firestore — see file header.
 * ============================================================= */
export const ReferenceDataRepository = {
  /** Awaited once by app.js's boot(), before anything below is read — see ensureReferenceLoaded() above. */
  preload() { return ensureReferenceLoaded(); },

  getSexTypes()  { return [...SEX_TYPES].sort((a, b) => Number(a.code) - Number(b.code)); },
  getSireTypes() { return [...SIRE_TYPES].sort((a, b) => Number(a.code) - Number(b.code)); },
  getDamTypes()  { return [...DAM_TYPES].sort((a, b) => Number(a.code) - Number(b.code)); },
  // Numeric order by code, per staff request — matches how the ID system
  // itself is organized, and how it reads on the printed code sheet.
  getConsignors() { return [...CONSIGNORS].sort((a, b) => Number(a.code) - Number(b.code)); },

  // Synchronous — relies on the video cache already being populated,
  // which is always true by the time a user can reach the Video ID
  // Manager (it's opened from the Tools menu, which only renders after
  // app.js's boot() has already awaited a full getVideos()/getCounts()
  // pass). If that assumption ever stops holding, make this async and
  // await ensureLoaded() like everything below does.
  countVideosForConsignor(code) { return videos.filter(v => v.consignorCode === String(code)).length; },

  findConsignor(code) { return consignorFor(code); },
  sexLabel(code)  { return labelFor(SEX_TYPES, code); },
  sireLabel(code) { return labelFor(SIRE_TYPES, code); },
  damLabel(code)  { return labelFor(DAM_TYPES, code); },

  suggestNextConsignorCode() {
    const used = new Set(CONSIGNORS.map(c => Number(c.code)));
    let n = 1;
    while (used.has(n)) n++;
    return String(n);
  },

  async addConsignor({ name, code }) {
    if (CONSIGNORS.some(c => c.code === String(code))) {
      throw new Error(`Consignor code ${code} is already in use`);
    }
    const rec = { code: String(code), name, flaggedNew: true, active: true };
    CONSIGNORS.push(rec);
    await persistReferenceList('consignors');
    return rec;
  },

  /** Renames the consignor AND every video record that references it — see the same sync caveat as countVideosForConsignor above. */
  async renameConsignor(code, name) {
    const rec = CONSIGNORS.find(c => c.code === String(code));
    if (!rec) throw new Error('Consignor not found');
    rec.name = name;
    await ensureLoaded();
    const affected = videos.filter(v => v.consignorCode === String(code));
    affected.forEach(v => { v.consignorName = name; });
    if (affected.length) await FirestoreData.importVideosBatch(affected);
    await persistReferenceList('consignors');
    emitter.emit({ type: 'videos-changed' });
    return rec;
  },

  async setConsignorActive(code, active) {
    const rec = CONSIGNORS.find(c => c.code === String(code));
    if (!rec) throw new Error('Consignor not found');
    rec.active = active;
    await persistReferenceList('consignors');
    return rec;
  },

  async clearConsignorFlag(code) {
    const rec = CONSIGNORS.find(c => c.code === String(code));
    if (!rec) throw new Error('Consignor not found');
    rec.flaggedNew = false;
    await persistReferenceList('consignors');
    return rec;
  },

  async addSireType(code, label) {
    if (SIRE_TYPES.some(s => s.code === String(code))) throw new Error('Sire code already exists');
    const rec = { code: String(code), label, active: true };
    SIRE_TYPES.push(rec);
    await persistReferenceList('sireTypes');
    return rec;
  },

  async renameSireType(code, label) {
    const rec = SIRE_TYPES.find(s => s.code === String(code));
    if (!rec) throw new Error('Sire type not found');
    rec.label = label;
    await persistReferenceList('sireTypes');
    return rec;
  },

  async setSireActive(code, active) {
    const rec = SIRE_TYPES.find(s => s.code === String(code));
    if (!rec) throw new Error('Sire type not found');
    rec.active = active;
    await persistReferenceList('sireTypes');
    return rec;
  },

  async addDamType(code, label) {
    if (DAM_TYPES.some(s => s.code === String(code))) throw new Error('Dam code already exists');
    const rec = { code: String(code), label, active: true };
    DAM_TYPES.push(rec);
    await persistReferenceList('damTypes');
    return rec;
  },

  async renameDamType(code, label) {
    const rec = DAM_TYPES.find(s => s.code === String(code));
    if (!rec) throw new Error('Dam type not found');
    rec.label = label;
    await persistReferenceList('damTypes');
    return rec;
  },

  async setDamActive(code, active) {
    const rec = DAM_TYPES.find(s => s.code === String(code));
    if (!rec) throw new Error('Dam type not found');
    rec.active = active;
    await persistReferenceList('damTypes');
    return rec;
  },

  getVideoMakers() { return [...VIDEO_MAKERS]; },

  /* ----- Video Format library -----
   * Mock/local for now. Real schema will carry over unchanged when
   * this becomes a Firestore-backed collection. */
  getVideoFormats() { return [...VIDEO_FORMATS]; },
  videoFormatMeta(code) { return VIDEO_FORMATS.find(f => f.code === code) || null; },

  /** Staff who can claim a video to build — reps don't build videos. */
  getStaffList() { return STAFF.filter(s => s.role === 'staff').map(s => ({ ...s })); },
};

/* =============================================================
 * NotificationRepository
 * ============================================================= */
export const NotificationRepository = {
  getWatchList() { return STAFF.map(s => ({ ...s })); },
  setWatch(id, watch) {
    const s = STAFF.find(s => s.id === id);
    if (s) { s.watch = watch; emitter.emit({ type: 'notifications-changed' }); }
  },
};

/* =============================================================
 * UsageRepository
 * ============================================================= */
let importHistory = [];

export const UsageRepository = {
  async getUsage(videoRecordId) {
    await ensureLoaded();
    const v = videos.find(v => v.id === videoRecordId);
    return v ? [...v.usage].sort((a, b) => b.auctionDate.localeCompare(a.auctionDate)) : [];
  },

  /**
   * Parse raw CSV text into a preview classification, matched against
   * the real Firestore-backed video set's youtubeUrl/youtubeId.
   * Expected columns (case-insensitive): Auction Date, Lot Number,
   * YouTube Link, [Auction Name], [Consignor]
   */
  async previewCsv(rawText) {
    await ensureLoaded();
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { matched: [], repeated: [], unmatched: [], ambiguous: [], rows: [] };

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const col = name => header.findIndex(h => h.includes(name));
    const iDate = col('date'), iLot = col('lot'), iLink = col('youtube') >= 0 ? col('youtube') : col('link'),
          iAuction = col('auction') >= 0 && !header[col('auction')].includes('date') ? col('auction') : -1;

    const rows = lines.slice(1).map(line => {
      const cells = line.split(',').map(c => c.trim());
      return {
        auctionDate: iDate >= 0 ? cells[iDate] : '',
        lot: iLot >= 0 ? cells[iLot] : '',
        youtubeLink: iLink >= 0 ? cells[iLink] : '',
        auctionName: iAuction >= 0 ? cells[iAuction] : '',
      };
    });

    const byYoutube = new Map();
    videos.forEach(v => {
      if (!v.youtubeId) return;
      if (!byYoutube.has(v.youtubeId)) byYoutube.set(v.youtubeId, []);
      byYoutube.get(v.youtubeId).push(v);
    });

    const linkCounts = new Map();
    rows.forEach(r => linkCounts.set(r.youtubeLink, (linkCounts.get(r.youtubeLink) || 0) + 1));

    const matched = [], repeated = [], unmatched = [], ambiguous = [];
    rows.forEach(r => {
      const ytId = extractYoutubeId(r.youtubeLink);
      const hits = ytId ? (byYoutube.get(ytId) || []) : [];
      if (!ytId || !r.lot) {
        unmatched.push({ ...r, reason: 'Missing lot number or YouTube link' });
      } else if (hits.length === 0) {
        unmatched.push({ ...r, reason: 'No video record found for this YouTube link' });
      } else if (hits.length > 1) {
        ambiguous.push({ ...r, reason: `${hits.length} video records share this YouTube link`, candidates: hits });
      } else if (linkCounts.get(r.youtubeLink) > 1) {
        repeated.push({ ...r, video: hits[0] });
      } else {
        matched.push({ ...r, video: hits[0] });
      }
    });

    return { rows, matched, repeated, unmatched, ambiguous };
  },

  async confirmImport(preview) {
    const applied = [...preview.matched, ...preview.repeated];
    const touched = new Map();
    applied.forEach(r => {
      const v = r.video;
      if (!touched.has(v.id)) touched.set(v.id, new Map());
      const byDate = touched.get(v.id);
      if (!byDate.has(r.auctionDate)) byDate.set(r.auctionDate, { auctionDate: r.auctionDate, auctionName: r.auctionName || 'Imported Auction', lots: [], youtubeVersionId: v.youtubeId });
      byDate.get(r.auctionDate).lots.push(r.lot);
    });

    const importId = 'import_' + Date.now();
    const snapshot = [];
    const changedRecords = [];
    touched.forEach((byDate, videoId) => {
      const v = videos.find(v => v.id === videoId);
      byDate.forEach(entry => {
        snapshot.push({ videoId, entry });
        v.usage.unshift(entry);
      });
      const lotList = [...byDate.values()].flatMap(e => e.lots).join(', ');
      logActivity(v, 'Usage Import', 'usage', `Usage CSV associated Lots ${lotList}`);
      changedRecords.push(v);
    });

    if (changedRecords.length) await FirestoreData.importVideosBatch(changedRecords);
    importHistory.push({ id: importId, at: new Date().toISOString(), snapshot });
    emitter.emit({ type: 'videos-changed' });
    return { importId, videosAffected: touched.size, usesAdded: applied.length };
  },

  async undoImport(importId) {
    const record = importHistory.find(i => i.id === importId);
    if (!record) return false;
    const changedRecords = [];
    record.snapshot.forEach(({ videoId, entry }) => {
      const v = videos.find(v => v.id === videoId);
      if (!v) return;
      const idx = v.usage.indexOf(entry);
      if (idx >= 0) v.usage.splice(idx, 1);
      logActivity(v, 'Usage Import', 'usage', `Undid usage import (Lots ${entry.lots.join(', ')})`);
      changedRecords.push(v);
    });
    if (changedRecords.length) await FirestoreData.importVideosBatch(changedRecords);
    importHistory = importHistory.filter(i => i.id !== importId);
    emitter.emit({ type: 'videos-changed' });
    return true;
  },
};

function extractYoutubeId(link) {
  if (!link) return null;
  const m = link.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{5,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{5,}$/.test(link)) return link; // bare id
  return null;
}

/* =============================================================
 * VideoRepository
 * ============================================================= */
function searchText(v) {
  const usage = v.usage.map(u => `${u.auctionName} ${u.auctionDate} ${u.lots.join(' ')}`).join(' ');
  const history = v.videoIdHistory.map(h => h.id).join(' ');
  return [
    v.videoId, v.baseVideoId, history,
    v.consignorName, v.consignorCode,
    ReferenceDataRepository.sexLabel(v.sexCode),
    ReferenceDataRepository.sireLabel(v.sireCode),
    ReferenceDataRepository.damLabel(v.damCode),
    v.weight, formatMonthYear(v.monthYear), v.monthYear,
    v.videoMaker, v.notes, v.youtubeUrl, v.youtubeId,
    new Date(v.dateAdded).toLocaleDateString(),
    usage,
    ReferenceDataRepository.videoFormatMeta(v.videoFormat)?.label, v.hasTags ? 'has tags' : '', v.workingOn,
  ].filter(Boolean).join(' ').toLowerCase();
}

function matchesSearch(v, query) {
  if (!query || !query.trim()) return true;
  const words = query.toLowerCase().trim().split(/\s+/);
  const text = searchText(v);
  return words.every(w => text.includes(w));
}

function matchesFilters(v, filters = {}) {
  if (filters.consignorCode && v.consignorCode !== filters.consignorCode) return false;
  if (filters.sexCode && v.sexCode !== filters.sexCode) return false;
  if (filters.sireCode && v.sireCode !== filters.sireCode) return false;
  if (filters.damCode && v.damCode !== filters.damCode) return false;
  if (filters.videoMaker && (v.status !== 'created' || v.videoMaker !== filters.videoMaker)) return false;
  if (filters.weightMin != null && v.weight < filters.weightMin) return false;
  if (filters.weightMax != null && v.weight > filters.weightMax) return false;
  if (filters.dateFrom && v.dateAdded < filters.dateFrom) return false;
  if (filters.dateTo && v.dateAdded > filters.dateTo) return false;
  if (filters.hasYoutube === true && !v.youtubeId) return false;
  if (filters.hasYoutube === false && v.youtubeId) return false;
  if (filters.needsReview && !v.needsReview) return false;
  if (filters.hasUsage === true && v.usage.length === 0) return false;
  if (filters.hasUsage === false && v.usage.length > 0) return false;
  if (filters.isDraft === true && !v.isDraft) return false;
  if (filters.videoFormat && v.videoFormat !== filters.videoFormat) return false;
  if (filters.monthYear && v.monthYear !== filters.monthYear) return false;
  if (filters.hasClips === true && v.clips.length === 0) return false;
  if (filters.hasClips === false && v.clips.length > 0) return false;
  return true;
}

/**
 * Video IDs are supposed to be unique (collisions get an explicit -2/-3
 * suffix at creation/edit time — see setVideoIdFields), but a bulk import
 * (e.g. from Monday) can land records outside that flow. This flags any
 * videoId shared by more than one non-trashed record so staff can resolve
 * it with a suffix, same as the live collision UI does.
 */
function duplicateIdSet() {
  const counts = new Map();
  videos.forEach(v => { if (!v.deletedAt) counts.set(v.videoId, (counts.get(v.videoId) || 0) + 1); });
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
}

export const VideoRepository = {
  /** Full query: status tab + search + filters + sort. Always resolves ALL matches — no pagination. */
  async getVideos({ status = null, search = '', filters = {}, sort = null } = {}) {
    await ensureLoaded();
    const dupes = duplicateIdSet();
    let list = videos.filter(v => !v.deletedAt && (status ? v.status === status : true));
    list = list.filter(v => matchesSearch(v, search) && matchesFilters(v, filters));
    if (sort) list = [...list].sort(sort);
    return list.map(v => ({ ...v, isDuplicateId: dupes.has(v.videoId) }));
  },

  async getCounts() {
    await ensureLoaded();
    const active = videos.filter(v => !v.deletedAt);
    return {
      ready: active.filter(v => v.status === 'ready').length,
      hold: active.filter(v => v.status === 'hold').length,
      created: active.filter(v => v.status === 'created').length,
      draft: active.filter(v => v.isDraft).length,
      total: active.length,
    };
  },

  async getVideoById(id) {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    return v ? { ...v, isDuplicateId: duplicateIdSet().has(v.videoId) } : null;
  },

  /** Exact-match lookup against the CURRENT active id of any record. */
  async findByFinalId(finalId) {
    await ensureLoaded();
    const v = videos.find(v => v.videoId === finalId);
    return v ? { ...v } : null;
  },

  /** Suggest the next unique suffix for a base id that's already taken. */
  async nextSuffixFor(baseId) {
    await ensureLoaded();
    const active = new Set(videos.map(v => v.videoId));
    return nextAvailableSuffix(baseId, active);
  },

  async createVideo(fields, actor = 'Staff') {
    await ensureLoaded();
    const baseId = fields.baseId || buildBaseId(fields);
    const finalId = fields.suffix ? `${baseId}-${fields.suffix}` : baseId;
    const now = new Date().toISOString();
    const consignor = ReferenceDataRepository.findConsignor(fields.consignorCode);

    const record = {
      id: generateInternalId(),
      videoId: finalId, baseVideoId: baseId, suffix: fields.suffix || null,
      videoIdHistory: [],
      consignorCode: fields.consignorCode, consignorName: consignor ? consignor.name : fields.consignorCode,
      sexCode: fields.sexCode, sireCode: fields.sireCode, damCode: fields.damCode,
      weight: Number(fields.weight), monthYear: fields.monthYear,
      status: fields.status || 'ready',
      isDraft: fields.isDraft || false,
      needsReview: (consignor && consignor.flaggedNew) || false,
      videoMaker: fields.videoMaker || actor,
      createdBy: actor,
      dateAdded: now, lastUpdated: now,
      notes: fields.notes || '',
      canvaLink: fields.canvaLink || null,
      clips: fields.clips || [],
      listingImageUrl: fields.listingImageUrl || null,
      youtubeId: null, youtubeUrl: null, embedUrl: null, embedCode: null,
      previousYouTubeVideos: [],
      // New-video policy: everything created from here forward is
      // assumed Clean (no baked-in intro/program logos) until staff
      // says otherwise. Historical/migrated records default to
      // Unknown instead (or hasTags:true from Monday — see the
      // migration import flow in monday-migration-test.html).
      videoFormat: fields.videoFormat || 'clean',
      hasTags: fields.hasTags || false,
      workingOn: null,
      usage: [],
      activity: [{ ts: now, actor, type: 'created', message: fields.suffix
        ? `Record created as ${finalId} (Video ID collision with ${baseId})`
        : 'Record created' }],
    };
    videos.unshift(record);
    await persist(record);
    return { ...record };
  },

  async updateVideo(id, patch, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');

    const fieldLabels = { consignorName: 'Consignor', weight: 'Weight', notes: 'Notes', videoMaker: 'Video Maker', canvaLink: 'Canva Link' };
    Object.entries(patch).forEach(([key, val]) => {
      if (val === undefined || v[key] === val) return;
      if (fieldLabels[key]) logActivity(v, actor, 'field', `${fieldLabels[key]} changed: ${v[key]} → ${val}`);
      v[key] = val;
    });
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  /**
   * Quick cattle-info correction: updates the display/classification
   * fields (consignor, sex, sire, dam, weight, month/year) WITHOUT
   * touching videoId/baseVideoId/suffix. Deliberately separate from
   * setVideoIdFields() below — correcting "what this video actually
   * shows" and "what the Video ID says" are two different actions,
   * and an existing Video ID must never change silently just because
   * a typo in the weight got fixed. The drawer shows a warning + an
   * explicit opt-in path to setVideoIdFields() when the two diverge.
   */
  async updateCattleFields(id, fields, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');

    const fieldLabels = { consignorCode: 'Consignor', sexCode: 'Sex', sireCode: 'Sire', damCode: 'Dam', weight: 'Weight', monthYear: 'Month/Year' };
    const patch = { ...fields };
    if (patch.weight != null) patch.weight = Number(patch.weight);
    if (patch.consignorCode && patch.consignorCode !== v.consignorCode) {
      const consignor = ReferenceDataRepository.findConsignor(patch.consignorCode);
      patch.consignorName = consignor ? consignor.name : patch.consignorCode;
    }

    Object.entries(fields).forEach(([key, val]) => {
      const compareVal = key === 'weight' ? Number(val) : val;
      if (compareVal === v[key]) return;
      if (fieldLabels[key]) logActivity(v, actor, 'field', `${fieldLabels[key]} changed: ${v[key]} → ${compareVal}`);
    });
    Object.assign(v, patch);
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  /**
   * Recompute a record's Video ID from edited classification fields and
   * apply the same collision rules used at creation time. Retains the
   * old id in history. Returns { record, collision } — collision is
   * null unless the new id is already taken by ANOTHER record.
   */
  async setVideoIdFields(id, fields, actor = 'Staff', { forceSuffix = null } = {}) {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    const newBase = buildBaseId(fields);
    const newFinal = forceSuffix ? `${newBase}-${forceSuffix}` : newBase;
    if (newFinal === v.videoId) return { record: { ...v }, collision: null };

    if (!forceSuffix) {
      const clash = videos.find(o => o.id !== id && o.videoId === newBase);
      if (clash) return { record: { ...v }, collision: { ...clash } };
    }

    const oldId = v.videoId;
    v.videoIdHistory.push({ id: oldId, changedAt: new Date().toISOString(), reason: 'Metadata correction' });
    Object.assign(v, fields, { baseVideoId: newBase, videoId: newFinal, suffix: forceSuffix || null });
    logActivity(v, actor, 'id', `Video ID changed: ${oldId} → ${newFinal}`);
    touch(v, actor);
    await persist(v);
    return { record: { ...v }, collision: null };
  },

  async addClips(id, clips, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.clips.push(...clips);
    logActivity(v, actor, 'clips', `${clips.length} more clip${clips.length === 1 ? '' : 's'} added`);
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  async setStatus(id, status, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    const labels = { ready: 'Ready to Make', hold: 'On Hold', created: 'Created' };
    v.status = status;
    v.isDraft = false;
    logActivity(v, actor, 'status', `Moved to ${labels[status]}`);
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  /**
   * Set (or replace) the current YouTube video. If one is already set
   * and differs, it's pushed into previousYouTubeVideos first — we
   * never silently overwrite a completed version, since historical
   * auction usage may point at it (see UsageRepository.confirmImport
   * and usage.youtubeVersionId).
   */
  async setYoutube(id, { youtubeUrl, youtubeId }, actor = 'Staff', reason = '') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    const isReplacement = !!v.youtubeId && v.youtubeId !== youtubeId;

    if (isReplacement) {
      v.previousYouTubeVideos.unshift({
        id: v.youtubeId, url: v.youtubeUrl, embedUrl: v.embedUrl, embedCode: v.embedCode,
        replacedAt: new Date().toISOString(), replacedBy: actor, reason: reason || '',
      });
    }

    v.youtubeUrl = youtubeUrl;
    v.youtubeId = youtubeId;
    v.embedUrl = `https://www.youtube.com/embed/${youtubeId}?mute=1&autoplay=1&playlist=${youtubeId}&loop=1`;
    v.embedCode = `<iframe width="560" height="315" src="${v.embedUrl}" title="CMS Auction Video" frameborder="0" allowfullscreen></iframe>`;
    logActivity(v, actor, 'youtube', isReplacement
      ? `YouTube video replaced — previous version retained in history${reason ? ` (${reason})` : ''}`
      : 'YouTube link added');
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  async setVideoFormat(id, format, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    const meta = ReferenceDataRepository.videoFormatMeta(format);
    v.videoFormat = format;
    logActivity(v, actor, 'format', format === 'needs-redo'
      ? 'Marked Needs Redo'
      : `Video Format changed to ${meta ? meta.label : format}`);
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  /** Convenience wrapper — does not delete or touch clips/YouTube/usage/history, only the format. */
  async markNeedsRedo(id, actor = 'Staff') {
    return VideoRepository.setVideoFormat(id, 'needs-redo', actor);
  },

  async setHasTags(id, checked, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.hasTags = !!checked;
    logActivity(v, actor, 'format', v.hasTags ? 'Marked Has Tags' : 'Has Tags cleared');
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  async setWorkingOn(id, name, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.workingOn = name;
    logActivity(v, actor, 'format', `${name} started building this video`);
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  async clearWorkingOn(id, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.workingOn = null;
    logActivity(v, actor, 'format', 'Released — no longer building this video');
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  /* =============================================================
   * Deletion — soft delete only. A trashed record disappears from
   * every normal view (getVideos/getCounts already filter on
   * !deletedAt) but nothing is actually destroyed until an explicit,
   * separate purge — so clips/publishing/usage/history/notes/activity
   * are never silently orphaned.
   * ============================================================= */
  async trashVideo(id, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.deletedAt = new Date().toISOString();
    v.deletedBy = actor;
    logActivity(v, actor, 'deleted', 'Moved to Trash');
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  async restoreVideo(id, actor = 'Staff') {
    await ensureLoaded();
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.deletedAt = null;
    v.deletedBy = null;
    logActivity(v, actor, 'restored', 'Restored from Trash');
    touch(v, actor);
    await persist(v);
    return { ...v };
  },

  /** Permanent, separate from trashVideo() on purpose — see doc comment above. */
  async purgeVideo(id) {
    await ensureLoaded();
    const idx = videos.findIndex(v => v.id === id);
    if (idx === -1) throw new Error('Video not found');
    videos.splice(idx, 1);
    await FirestoreData.deleteVideoDoc(id);
    emitter.emit({ type: 'videos-changed' });
    return true;
  },

  async getTrashedVideos() {
    await ensureLoaded();
    return videos.filter(v => v.deletedAt).map(v => ({ ...v }));
  },

  /**
   * Bulk-create/overwrite many fully-formed records at once — used
   * only by the Monday migration import flow (see
   * public/monday-migration-test.html). Each record's `id` should
   * already be a stable, deterministic value (the import derives it
   * from the Monday item id) so re-running the import is idempotent:
   * it overwrites the same documents rather than creating duplicates.
   */
  async importRecords(records, onProgress) {
    await ensureLoaded();
    const byId = new Map(videos.map(v => [v.id, v]));
    records.forEach(r => byId.set(r.id, r));
    videos = [...byId.values()];
    await FirestoreData.importVideosBatch(records, onProgress);
    emitter.emit({ type: 'videos-changed' });
    return records.length;
  },

  subscribe(fn) { return emitter.subscribe(fn); },
};

/** Grouped export mirroring the conceptual `videoService` used across the app. */
export const videoService = VideoRepository;
