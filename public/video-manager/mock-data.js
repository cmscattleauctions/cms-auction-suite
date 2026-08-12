/* =============================================================
 * CMS Video Manager — Mock reference data + seed video records
 * -------------------------------------------------------------
 * Everything here is LOCAL/MOCK. No Firebase. No network calls.
 * This is the single source of truth for fake data — nothing in
 * the UI layer should hardcode arrays; it all comes through
 * repository.js, which reads from here.
 *
 * A tiny seeded RNG keeps the generated portion of the data set
 * identical across reloads, which makes manual QA reproducible
 * ("search 800-A should always return the same 3 records").
 * ============================================================= */

import { buildBaseId, generateInternalId } from './video-id.js';

/* =============================================================
 * Seeded RNG (mulberry32)
 * ============================================================= */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(19820826);
const pick = arr => arr[Math.floor(rng() * arr.length)];
const int = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

/* =============================================================
 * Reference dictionaries
 * ============================================================= */

export const SEX_TYPES = [
  { code: '1', label: 'Steers' },
  { code: '2', label: 'Heifers' },
  { code: '3', label: 'Steers & Heifers' },
];

export const SIRE_TYPES = [
  { code: '0',  label: 'Native' },
  { code: '1',  label: 'TD' },
  { code: '2',  label: 'Angus' },
  { code: '3',  label: 'Charolais' },
  { code: '4',  label: 'Holstein' },
  { code: '5',  label: 'Hawaiians' },
  { code: '6',  label: 'ABS Infocus' },
  { code: '7',  label: 'Gardner Angus Bulls' },
  { code: '8',  label: 'Wolf Limo Bulls' },
  { code: '9',  label: 'Simmental Bull' },
  { code: '10', label: 'MexicanXB' },
];

export const DAM_TYPES = [
  { code: '0',  label: 'Native' },
  { code: '1',  label: 'Holstein' },
  { code: '2',  label: 'Jersey' },
  { code: '3',  label: 'Holstein and Jersey' },
  { code: '4',  label: 'Wagyu' },
  { code: '5',  label: 'Hawaiians' },
  { code: '10', label: 'MexicanXB' },
];

export const CONSIGNORS = [
  { code: '21', name: 'TL Harvesting, Inc.',      flaggedNew: false },
  { code: '14', name: 'Rocking H Cattle Co.',      flaggedNew: false },
  { code: '33', name: 'Bar None Ranch',            flaggedNew: false },
  { code: '8',  name: 'Hayden & Sons Livestock',   flaggedNew: false },
  { code: '45', name: 'Prairie View Farms',        flaggedNew: false },
  { code: '19', name: 'Circle K Cattle',           flaggedNew: false },
  { code: '27', name: 'Sundown Ranch',             flaggedNew: false },
  { code: '5',  name: 'Whitetail Creek Farms',     flaggedNew: false },
  { code: '52', name: 'Lone Star Cattle Co.',      flaggedNew: false },
  { code: '12', name: 'Blackwater Ranch',          flaggedNew: false },
  { code: '39', name: 'Golden Plains Livestock',   flaggedNew: false },
  { code: '7',  name: 'Red River Cattle Co.',      flaggedNew: false },
  { code: '16', name: 'Silver Spur Farms',         flaggedNew: false },
  { code: '44', name: 'Wagon Wheel Livestock',     flaggedNew: false },
  { code: '23', name: 'Mesquite Flat Ranch',       flaggedNew: false },
  { code: '9',  name: 'Rafter T Cattle',           flaggedNew: false },
  { code: '61', name: 'Cross Timbers Ranch',       flaggedNew: true  },
  { code: '58', name: 'High Plains Genetics',      flaggedNew: true  },
];

export const VIDEO_MAKERS = ['Hayden Hollis', 'Bryson Murray', 'Colt Reagan', 'Dusty Fields', 'Reyes Martinez'];

export const STAFF = [
  { id: 'hayden', name: 'Hayden Hollis',            role: 'staff', watch: true  },
  { id: 'bryson', name: 'Bryson Murray',            role: 'staff', watch: false },
  { id: 'repA',   name: 'Rep — Colt Reagan',        role: 'rep',   watch: true  },
  { id: 'repB',   name: 'Rep — Dusty Fields',       role: 'rep',   watch: true  },
  { id: 'repC',   name: 'Rep — Reyes Martinez',     role: 'rep',   watch: false },
];

export function labelFor(list, code) {
  const hit = list.find(x => x.code === String(code));
  return hit ? hit.label : null;
}

export function consignorFor(code) {
  return CONSIGNORS.find(c => c.code === String(code)) || null;
}

/* =============================================================
 * Clip + record helpers
 * ============================================================= */

const CLIP_SWATCHES = 8; // maps to CSS gradient classes .clip-swatch-0..7

function makeClip({ swatch, duration, sizeMb, filename, uploader, uploadedAt, isOriginal = true }) {
  return {
    id: 'clip_' + Math.random().toString(36).slice(2, 10),
    filename,
    swatch: swatch % CLIP_SWATCHES,
    durationSec: duration,
    sizeBytes: Math.round(sizeMb * 1024 * 1024),
    uploader,
    uploadedAt,
    isOriginal,
  };
}

function makeClips(n, { videoMaker, dateAdded, filenamePrefix }) {
  const clips = [];
  for (let i = 0; i < n; i++) {
    clips.push(makeClip({
      swatch: int(0, CLIP_SWATCHES - 1),
      duration: int(8, 65),
      sizeMb: +(int(40, 320) / 10).toFixed(1),
      filename: `${filenamePrefix}_${String(i + 1).padStart(2, '0')}.mov`,
      uploader: videoMaker,
      uploadedAt: dateAdded,
    }));
  }
  return clips;
}

function isoDaysAgo(days, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, int(0, 59), 0, 0);
  return d.toISOString();
}

const MONTH_YEARS = ['0824', '1024', '1224', '0225', '0425', '0625', '0825', '1025', '1225', '0226', '0426', '0626', '0826'];

function activity(ts, actor, type, message) {
  return { ts, actor, type, message };
}

/* =============================================================
 * Record builder
 * ============================================================= */

let recordSeq = 0;

function buildRecord(overrides = {}) {
  recordSeq++;
  const consignor = overrides.consignor || pick(CONSIGNORS);
  const sexCode = overrides.sexCode || pick(SEX_TYPES).code;
  const sireCode = overrides.sireCode ?? pick(SIRE_TYPES).code;
  const damCode = overrides.damCode ?? pick(DAM_TYPES).code;
  const weight = overrides.weight || int(38, 95) * 10;
  const monthYear = overrides.monthYear || pick(MONTH_YEARS);
  const baseId = overrides.baseId || buildBaseId({
    consignorCode: consignor.code, sexCode, sireCode, damCode, weight, monthYear,
  });
  const suffix = overrides.suffix ?? null;
  const finalId = suffix ? `${baseId}-${suffix}` : baseId;

  const daysAgo = overrides.daysAgo ?? int(1, 540);
  const dateAdded = overrides.dateAdded || isoDaysAgo(daysAgo);
  const videoMaker = overrides.videoMaker || pick(VIDEO_MAKERS);
  const clipCount = overrides.clipCount ?? pick([0, 0, 1, 2, 3, 3, 5, 5, 7, 9]);
  const clips = overrides.clips || makeClips(clipCount, {
    videoMaker, dateAdded, filenamePrefix: `${consignor.code}_${monthYear}`,
  });

  const status = overrides.status || 'created';
  const hasYoutube = overrides.hasYoutube ?? (status === 'created' ? rng() < 0.85 : rng() < 0.06);
  const ytSlug = Math.random().toString(36).slice(2, 9);
  const youtubeId = hasYoutube ? (overrides.youtubeId || ytSlug) : null;
  const youtubeUrl = hasYoutube ? `https://youtu.be/${youtubeId}` : null;
  const embedUrl = hasYoutube ? `https://www.youtube.com/embed/${youtubeId}` : null;
  const embedCode = hasYoutube
    ? `<iframe width="560" height="315" src="${embedUrl}" title="CMS Auction Video" frameborder="0" allowfullscreen></iframe>`
    : null;

  const act = overrides.activity || [
    activity(dateAdded, videoMaker, 'created', 'Record created'),
    ...(clipCount > 0 ? [activity(dateAdded, videoMaker, 'clips', `${clipCount} clip${clipCount === 1 ? '' : 's'} uploaded`)] : []),
    ...(hasYoutube ? [activity(isoDaysAgo(Math.max(daysAgo - 2, 0)), 'Hayden Hollis', 'youtube', 'YouTube link added')] : []),
    ...(status !== 'created' ? [] : [activity(isoDaysAgo(Math.max(daysAgo - 1, 0)), 'Hayden Hollis', 'status', 'Moved to Created')]),
  ];

  return {
    id: overrides.id || generateInternalId(),
    videoId: finalId,
    baseVideoId: baseId,
    suffix,
    videoIdHistory: overrides.videoIdHistory || [],
    consignorCode: consignor.code,
    consignorName: consignor.name,
    sexCode, sireCode, damCode, weight, monthYear,
    status,                       // 'ready' | 'hold' | 'created'
    isDraft: overrides.isDraft || false,
    needsReview: overrides.needsReview || consignor.flaggedNew || false,
    videoMaker,
    createdBy: overrides.createdBy || videoMaker,
    dateAdded,
    lastUpdated: overrides.lastUpdated || dateAdded,
    notes: overrides.notes || '',
    clips,
    listingImageUrl: overrides.listingImageUrl || null,
    youtubeId, youtubeUrl, embedUrl, embedCode,
    usage: overrides.usage || [],
    activity: act,
  };
}

/* =============================================================
 * Hand-authored "special case" records
 * (kept literal so they exactly match the examples used while
 * designing the Video ID / collision / usage-history behavior)
 * ============================================================= */

function specialCases() {
  const tl = consignorFor('21');
  const base = buildBaseId({ consignorCode: '21', sexCode: '2', sireCode: '2', damCode: '2', weight: '450', monthYear: '0826' });

  const original = buildRecord({
    id: 'vid_tlh0826a',
    consignor: tl, sexCode: '2', sireCode: '2', damCode: '2', weight: 450, monthYear: '0826',
    baseId: base, suffix: null,
    status: 'created', daysAgo: 9, videoMaker: 'Hayden Hollis',
    clipCount: 7,
    hasYoutube: true, youtubeId: 'tlh450heifers',
    notes: 'Strong set, uniform frame. Good sale-day candidates.',
    usage: [
      { auctionDate: isoDaysAgo(1).slice(0, 10), auctionName: 'August Feeder Special', lots: ['800-A', '800-B', '801'] },
      { auctionDate: isoDaysAgo(97).slice(0, 10), auctionName: 'May Video Sale', lots: ['214', '215'] },
    ],
  });
  original.dateAdded = isoDaysAgo(9);
  original.activity = [
    activity(isoDaysAgo(9), 'Hayden Hollis', 'created', 'Record created'),
    activity(isoDaysAgo(9), 'Hayden Hollis', 'clips', '7 clips uploaded'),
    activity(isoDaysAgo(7), 'Hayden Hollis', 'youtube', 'YouTube link added'),
    activity(isoDaysAgo(6), 'Hayden Hollis', 'status', 'Moved to Created'),
    activity(isoDaysAgo(1), 'Hayden Hollis', 'usage', 'Usage CSV associated Lots 800-A, 800-B, 801'),
    activity(isoDaysAgo(97), 'Hayden Hollis', 'usage', 'Usage CSV associated Lots 214, 215'),
  ];

  // Collision example: a genuinely different video package, same cattle
  // classification -> suffixed on creation.
  const collision2 = buildRecord({
    id: 'vid_tlh0826b',
    consignor: tl, sexCode: '2', sireCode: '2', damCode: '2', weight: 450, monthYear: '0826',
    baseId: base, suffix: 2,
    status: 'ready', daysAgo: 2, videoMaker: 'Bryson Murray',
    clipCount: 3, hasYoutube: false,
    notes: 'Second load, same classification as 21.2.2.2.450.0826 — different pen.',
    activity: [
      activity(isoDaysAgo(2), 'Bryson Murray', 'created', 'Record created'),
      activity(isoDaysAgo(2), 'Bryson Murray', 'id', `Video ID collided with ${base} — created as ${base}-2`),
      activity(isoDaysAgo(2), 'Bryson Murray', 'clips', '3 clips uploaded'),
    ],
  });

  const collision3 = buildRecord({
    id: 'vid_tlh0826c',
    consignor: tl, sexCode: '2', sireCode: '2', damCode: '2', weight: 450, monthYear: '0826',
    baseId: base, suffix: 3,
    status: 'hold', daysAgo: 1, videoMaker: 'Hayden Hollis',
    clipCount: 0, hasYoutube: false,
    notes: 'On hold pending consignor confirmation of weight.',
    activity: [
      activity(isoDaysAgo(1), 'Hayden Hollis', 'created', 'Record created'),
      activity(isoDaysAgo(1), 'Hayden Hollis', 'id', `Video ID collided with ${base} — created as ${base}-3`),
      activity(isoDaysAgo(1), 'Hayden Hollis', 'status', 'Moved to On Hold'),
    ],
  });

  // Video ID history example: weight correction changed the final id.
  const oldBase = buildBaseId({ consignorCode: '14', sexCode: '1', sireCode: '3', damCode: '0', weight: '475', monthYear: '0326' });
  const newBase = buildBaseId({ consignorCode: '14', sexCode: '1', sireCode: '3', damCode: '0', weight: '450', monthYear: '0326' });
  const idHistory = buildRecord({
    id: 'vid_rhc0326a',
    consignor: consignorFor('14'), sexCode: '1', sireCode: '3', damCode: '0', weight: 450, monthYear: '0326',
    baseId: newBase, suffix: null,
    status: 'created', daysAgo: 40, videoMaker: 'Colt Reagan',
    clipCount: 5, hasYoutube: true, youtubeId: 'rhc475steers',
    videoIdHistory: [{ id: oldBase, changedAt: isoDaysAgo(35), reason: 'Weight corrected from 475 to 450' }],
    activity: [
      activity(isoDaysAgo(40), 'Colt Reagan', 'created', 'Record created as ' + oldBase),
      activity(isoDaysAgo(40), 'Colt Reagan', 'clips', '5 clips uploaded'),
      activity(isoDaysAgo(36), 'Hayden Hollis', 'youtube', 'YouTube link added'),
      activity(isoDaysAgo(35), 'Hayden Hollis', 'field', 'Weight changed: 475 → 450'),
      activity(isoDaysAgo(35), 'Hayden Hollis', 'id', `Video ID changed: ${oldBase} → ${newBase}`),
      activity(isoDaysAgo(34), 'Hayden Hollis', 'status', 'Moved to Created'),
    ],
  });

  // Draft: interrupted rep upload, no clips finished yet.
  const draft = buildRecord({
    id: 'vid_draft001',
    consignor: consignorFor('58'), sexCode: '3', sireCode: '9', damCode: '4', weight: 610, monthYear: '0826',
    status: 'ready', isDraft: true, daysAgo: 0, videoMaker: 'Rep — Dusty Fields',
    clipCount: 1, hasYoutube: false, needsReview: true,
    notes: 'Upload interrupted — feedlot cell signal dropped mid-transfer.',
    activity: [
      activity(isoDaysAgo(0), 'Rep — Dusty Fields', 'created', 'Record created (draft, rep upload)'),
      activity(isoDaysAgo(0), 'Rep — Dusty Fields', 'clips', '1 of 4 clips uploaded before interruption'),
    ],
  });

  // Zero clips, needs review, new consignor.
  const noClips = buildRecord({
    id: 'vid_nc001',
    consignor: consignorFor('61'), sexCode: '2', sireCode: '2', damCode: '1', weight: 520, monthYear: '0726',
    status: 'ready', daysAgo: 3, videoMaker: 'Rep — Colt Reagan',
    clipCount: 0, hasYoutube: false, needsReview: true,
    notes: '',
    activity: [activity(isoDaysAgo(3), 'Rep — Colt Reagan', 'created', 'Record created')],
  });

  // Heavily reused YouTube video across many auctions.
  const reused = buildRecord({
    id: 'vid_reused01',
    consignor: consignorFor('33'), sexCode: '1', sireCode: '2', damCode: '2', weight: 700, monthYear: '0126',
    status: 'created', daysAgo: 210, videoMaker: 'Hayden Hollis',
    clipCount: 4, hasYoutube: true, youtubeId: 'barnone700steers',
    usage: [
      { auctionDate: isoDaysAgo(5).slice(0, 10), auctionName: 'August Feeder Special', lots: ['612'] },
      { auctionDate: isoDaysAgo(40).slice(0, 10), auctionName: 'July Video Sale', lots: ['104', '105'] },
      { auctionDate: isoDaysAgo(75).slice(0, 10), auctionName: 'June Video Sale', lots: ['88'] },
      { auctionDate: isoDaysAgo(110).slice(0, 10), auctionName: 'May Video Sale', lots: ['210', '211', '212'] },
      { auctionDate: isoDaysAgo(150).slice(0, 10), auctionName: 'April Video Sale', lots: ['44'] },
      { auctionDate: isoDaysAgo(190).slice(0, 10), auctionName: 'March Video Sale', lots: ['9', '10'] },
    ],
  });

  return [original, collision2, collision3, idHistory, draft, noClips, reused];
}

/* =============================================================
 * Public: generate the full mock video set
 * ============================================================= */

let cachedVideos = null;

export function generateMockVideos() {
  if (cachedVideos) return cachedVideos;

  const records = [...specialCases()];

  const statusPlan = [
    ...Array(10).fill('ready'),
    ...Array(6).fill('hold'),
    ...Array(38).fill('created'),
  ];

  statusPlan.forEach((status, i) => {
    records.push(buildRecord({
      status,
      isDraft: status === 'ready' && rng() < 0.12,
    }));
  });

  // De-dupe any accidental base-id collisions from the procedural
  // generator itself (statistically rare, but keep the invariant true).
  const seen = new Set();
  records.forEach(r => {
    while (seen.has(r.videoId)) {
      const n = (r.suffix || 1) + 1;
      r.suffix = n;
      r.videoId = `${r.baseVideoId}-${n}`;
    }
    seen.add(r.videoId);
  });

  cachedVideos = records;
  return records;
}
