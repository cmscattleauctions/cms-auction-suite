/* =============================================================
 * CMS Video Manager — Data-service layer
 * -------------------------------------------------------------
 * This is the ONLY place that touches the "database" (mock, for
 * now). UI code must never read mock-data.js directly and must
 * never scatter its own arrays — everything goes through these
 * repositories.
 *
 * When Firebase is wired in later, each Mock*Repository below
 * gets a Firebase*Repository sibling with the exact same method
 * signatures (all already return Promises so the swap is a
 * drop-in). UI code calls e.g. `videoService.getVideos(...)` and
 * never needs to change.
 * ============================================================= */

import {
  SEX_TYPES, SIRE_TYPES, DAM_TYPES, CONSIGNORS, VIDEO_MAKERS, STAFF,
  generateMockVideos, labelFor, consignorFor,
} from './mock-data.js';
import { buildBaseId, nextAvailableSuffix, formatMonthYear, generateInternalId } from './video-id.js';

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
 * In-memory store
 * ============================================================= */
const videos = generateMockVideos();
const emitter = createEmitter();

function touch(record, actor) {
  record.lastUpdated = new Date().toISOString();
}

function logActivity(record, actor, type, message) {
  record.activity.unshift({ ts: new Date().toISOString(), actor, type, message });
}

/* =============================================================
 * ReferenceDataRepository
 * -------------------------------------------------------------
 * Consignors + sex/sire/dam code dictionaries. Staff can add
 * missing codes inline without leaving the workflow; new
 * consignors are flagged NEW — NEEDS REVIEW.
 * ============================================================= */
export const ReferenceDataRepository = {
  getSexTypes()  { return [...SEX_TYPES]; },
  getSireTypes() { return [...SIRE_TYPES]; },
  getDamTypes()  { return [...DAM_TYPES]; },
  getConsignors() { return [...CONSIGNORS].sort((a, b) => a.name.localeCompare(b.name)); },

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

  addConsignor({ name, code }) {
    if (CONSIGNORS.some(c => c.code === String(code))) {
      throw new Error(`Consignor code ${code} is already in use`);
    }
    const rec = { code: String(code), name, flaggedNew: true };
    CONSIGNORS.push(rec);
    emitter.emit({ type: 'reference-changed' });
    return rec;
  },

  addSireType(code, label) {
    if (SIRE_TYPES.some(s => s.code === String(code))) throw new Error('Sire code already exists');
    const rec = { code: String(code), label };
    SIRE_TYPES.push(rec);
    emitter.emit({ type: 'reference-changed' });
    return rec;
  },

  addDamType(code, label) {
    if (DAM_TYPES.some(s => s.code === String(code))) throw new Error('Dam code already exists');
    const rec = { code: String(code), label };
    DAM_TYPES.push(rec);
    emitter.emit({ type: 'reference-changed' });
    return rec;
  },

  getVideoMakers() { return [...VIDEO_MAKERS]; },
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
  getUsage(videoRecordId) {
    const v = videos.find(v => v.id === videoRecordId);
    return v ? [...v.usage].sort((a, b) => b.auctionDate.localeCompare(a.auctionDate)) : [];
  },

  /**
   * Parse raw CSV text into a preview classification. Real matching
   * would key off YouTube URL/ID against Firestore; here we match
   * against the mock video set's youtubeUrl/youtubeId.
   * Expected columns (case-insensitive): Auction Date, Lot Number,
   * YouTube Link, [Auction Name], [Consignor]
   */
  previewCsv(rawText) {
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

  confirmImport(preview) {
    const applied = [...preview.matched, ...preview.repeated];
    const touched = new Map();
    applied.forEach(r => {
      const v = r.video;
      if (!touched.has(v.id)) touched.set(v.id, new Map());
      const byDate = touched.get(v.id);
      if (!byDate.has(r.auctionDate)) byDate.set(r.auctionDate, { auctionDate: r.auctionDate, auctionName: r.auctionName || 'Imported Auction', lots: [] });
      byDate.get(r.auctionDate).lots.push(r.lot);
    });

    const importId = 'import_' + Date.now();
    const snapshot = [];
    touched.forEach((byDate, videoId) => {
      const v = videos.find(v => v.id === videoId);
      byDate.forEach(entry => {
        snapshot.push({ videoId, entry });
        v.usage.unshift(entry);
      });
      const lotList = [...byDate.values()].flatMap(e => e.lots).join(', ');
      logActivity(v, 'Usage Import', 'usage', `Usage CSV associated Lots ${lotList}`);
    });

    importHistory.push({ id: importId, at: new Date().toISOString(), snapshot });
    emitter.emit({ type: 'videos-changed' });
    return { importId, videosAffected: touched.size, usesAdded: applied.length };
  },

  undoImport(importId) {
    const record = importHistory.find(i => i.id === importId);
    if (!record) return false;
    record.snapshot.forEach(({ videoId, entry }) => {
      const v = videos.find(v => v.id === videoId);
      if (!v) return;
      const idx = v.usage.indexOf(entry);
      if (idx >= 0) v.usage.splice(idx, 1);
      logActivity(v, 'Usage Import', 'usage', `Undid usage import (Lots ${entry.lots.join(', ')})`);
    });
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
  if (filters.videoMaker && v.videoMaker !== filters.videoMaker) return false;
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
  return true;
}

export const VideoRepository = {
  /** Full query: status tab + search + filters + sort. Always resolves ALL matches — no pagination. */
  async getVideos({ status = null, search = '', filters = {}, sort = null } = {}) {
    let list = videos.filter(v => (status ? v.status === status : true));
    list = list.filter(v => matchesSearch(v, search) && matchesFilters(v, filters));
    if (sort) list = [...list].sort(sort);
    return list.map(v => ({ ...v }));
  },

  async getCounts() {
    return {
      ready: videos.filter(v => v.status === 'ready').length,
      hold: videos.filter(v => v.status === 'hold').length,
      created: videos.filter(v => v.status === 'created').length,
      draft: videos.filter(v => v.isDraft).length,
      total: videos.length,
    };
  },

  async getVideoById(id) {
    const v = videos.find(v => v.id === id);
    return v ? { ...v } : null;
  },

  /** Exact-match lookup against the CURRENT active id of any record. */
  async findByFinalId(finalId) {
    const v = videos.find(v => v.videoId === finalId);
    return v ? { ...v } : null;
  },

  /** Suggest the next unique suffix for a base id that's already taken. */
  async nextSuffixFor(baseId) {
    const active = new Set(videos.map(v => v.videoId));
    return nextAvailableSuffix(baseId, active);
  },

  async createVideo(fields, actor = 'Staff') {
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
      clips: fields.clips || [],
      listingImageUrl: fields.listingImageUrl || null,
      youtubeId: null, youtubeUrl: null, embedUrl: null, embedCode: null,
      usage: [],
      activity: [{ ts: now, actor, type: 'created', message: fields.suffix
        ? `Record created as ${finalId} (Video ID collision with ${baseId})`
        : 'Record created' }],
    };
    videos.unshift(record);
    emitter.emit({ type: 'videos-changed' });
    return { ...record };
  },

  async updateVideo(id, patch, actor = 'Staff') {
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');

    const fieldLabels = { consignorName: 'Consignor', weight: 'Weight', notes: 'Notes', videoMaker: 'Video Maker' };
    Object.entries(patch).forEach(([key, val]) => {
      if (val === undefined || v[key] === val) return;
      if (fieldLabels[key]) logActivity(v, actor, 'field', `${fieldLabels[key]} changed: ${v[key]} → ${val}`);
      v[key] = val;
    });
    touch(v, actor);
    emitter.emit({ type: 'videos-changed' });
    return { ...v };
  },

  /**
   * Recompute a record's Video ID from edited classification fields and
   * apply the same collision rules used at creation time. Retains the
   * old id in history. Returns { record, collision } — collision is
   * null unless the new id is already taken by ANOTHER record.
   */
  async setVideoIdFields(id, fields, actor = 'Staff', { forceSuffix = null } = {}) {
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
    emitter.emit({ type: 'videos-changed' });
    return { record: { ...v }, collision: null };
  },

  async addClips(id, clips, actor = 'Staff') {
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.clips.push(...clips);
    logActivity(v, actor, 'clips', `${clips.length} more clip${clips.length === 1 ? '' : 's'} added`);
    touch(v, actor);
    emitter.emit({ type: 'videos-changed' });
    return { ...v };
  },

  async setStatus(id, status, actor = 'Staff') {
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    const labels = { ready: 'Ready to Make', hold: 'On Hold', created: 'Created' };
    v.status = status;
    v.isDraft = false;
    logActivity(v, actor, 'status', `Moved to ${labels[status]}`);
    touch(v, actor);
    emitter.emit({ type: 'videos-changed' });
    return { ...v };
  },

  async setYoutube(id, { youtubeUrl, youtubeId }, actor = 'Staff') {
    const v = videos.find(v => v.id === id);
    if (!v) throw new Error('Video not found');
    v.youtubeUrl = youtubeUrl;
    v.youtubeId = youtubeId;
    v.embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
    v.embedCode = `<iframe width="560" height="315" src="${v.embedUrl}" title="CMS Auction Video" frameborder="0" allowfullscreen></iframe>`;
    logActivity(v, actor, 'youtube', 'YouTube link added');
    touch(v, actor);
    emitter.emit({ type: 'videos-changed' });
    return { ...v };
  },

  subscribe(fn) { return emitter.subscribe(fn); },
};

/** Grouped export mirroring the conceptual `videoService` used across the app. */
export const videoService = VideoRepository;
