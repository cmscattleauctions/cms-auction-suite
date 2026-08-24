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
  { code: '1', label: 'Steers', active: true },
  { code: '2', label: 'Heifers', active: true },
  { code: '3', label: 'Steers & Heifers', active: true },
];

export const SIRE_TYPES = [
  { code: '0',  label: 'Native', active: true },
  { code: '1',  label: 'TD', active: true },
  { code: '2',  label: 'Angus', active: true },
  { code: '3',  label: 'Charolais', active: true },
  { code: '4',  label: 'Holstein', active: true },
  { code: '5',  label: 'Hawaiians', active: true },
  { code: '6',  label: 'ABS Infocus', active: true },
  { code: '7',  label: 'Gardner Angus Bulls', active: true },
  { code: '8',  label: 'Wolf Limo Bulls', active: true },
  { code: '9',  label: 'Simmental Bull', active: true },
  { code: '10', label: 'MexicanXB', active: true },
];

export const DAM_TYPES = [
  { code: '0',  label: 'Native', active: true },
  { code: '1',  label: 'Holstein', active: true },
  { code: '2',  label: 'Jersey', active: true },
  { code: '3',  label: 'Holstein and Jersey', active: true },
  { code: '4',  label: 'Wagyu', active: true },
  { code: '5',  label: 'Hawaiians', active: true },
  { code: '10', label: 'MexicanXB', active: true },
];

export const CONSIGNORS = [
  { code: '21', name: 'TL Harvesting, Inc.',      flaggedNew: false, active: true },
  { code: '14', name: 'Rocking H Cattle Co.',      flaggedNew: false, active: true },
  { code: '33', name: 'Bar None Ranch',            flaggedNew: false, active: true },
  { code: '8',  name: 'Hayden & Sons Livestock',   flaggedNew: false, active: true },
  { code: '45', name: 'Prairie View Farms',        flaggedNew: false, active: true },
  { code: '19', name: 'Circle K Cattle',           flaggedNew: false, active: true },
  { code: '27', name: 'Sundown Ranch',             flaggedNew: false, active: true },
  { code: '5',  name: 'Whitetail Creek Farms',     flaggedNew: false, active: true },
  { code: '52', name: 'Lone Star Cattle Co.',      flaggedNew: false, active: true },
  { code: '12', name: 'Blackwater Ranch',          flaggedNew: false, active: true },
  { code: '39', name: 'Golden Plains Livestock',   flaggedNew: false, active: true },
  { code: '7',  name: 'Red River Cattle Co.',      flaggedNew: false, active: true },
  { code: '16', name: 'Silver Spur Farms',         flaggedNew: false, active: true },
  { code: '44', name: 'Wagon Wheel Livestock',     flaggedNew: false, active: true },
  { code: '23', name: 'Mesquite Flat Ranch',       flaggedNew: false, active: true },
  { code: '9',  name: 'Rafter T Cattle',           flaggedNew: false, active: true },
  { code: '61', name: 'Cross Timbers Ranch',       flaggedNew: true,  active: true },
  { code: '58', name: 'High Plains Genetics',      flaggedNew: true,  active: true },
];

export const VIDEO_MAKERS = ['Hayden Hollis', 'Bryson Murray', 'Colt Reagan', 'Dusty Fields', 'Reyes Martinez'];

/* =============================================================
 * Video Format — new policy (see docs in repository.js)
 * -------------------------------------------------------------
 * Going forward, completed videos should be "clean": no ASV/NHTC/
 * etc. logos baked into the footage, no CMS intro baked in. Those
 * will eventually be applied dynamically in OBS. Historical
 * YouTube videos mostly still have logos baked in ("Legacy
 * Tagged") and are reclassified/rebuilt only as needed — we are
 * NOT rebuilding the whole library up front.
 * ============================================================= */
export const VIDEO_FORMATS = [
  { code: 'clean',        label: 'Clean',         short: 'Clean',   desc: 'No outdated certification/program graphics baked in. Safe for future dynamic OBS overlays.' },
  { code: 'legacy-tagged', label: 'Legacy Tagged', short: 'Legacy',  desc: 'The current YouTube video has certification/program logos baked into the footage.' },
  { code: 'needs-redo',   label: 'Needs Redo',    short: 'Redo',    desc: 'Known to need a rebuild before this video is reused.' },
  { code: 'unknown',      label: 'Unknown',       short: 'Unknown', desc: 'Not reviewed yet — the default for anything migrated without a confident classification.' },
];


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
  const embedUrl = hasYoutube ? `https://www.youtube.com/embed/${youtubeId}?mute=1&autoplay=1&playlist=${youtubeId}&loop=1` : null;
  const embedCode = hasYoutube
    ? `<iframe width="560" height="315" src="${embedUrl}" title="CMS Auction Video" frameborder="0" allowfullscreen></iframe>`
    : null;

  // Video Format: only meaningful once a completed YouTube video exists.
  // Library is mid-classification, so mix Legacy Tagged / Needs Redo /
  // Unknown into the existing catalog rather than assuming everything's
  // clean — that mirrors real life post-Monday-migration.
  const videoFormat = overrides.videoFormat || (!hasYoutube ? 'unknown' : pick([
    'clean', 'clean', 'clean', 'clean', 'legacy-tagged', 'legacy-tagged', 'legacy-tagged', 'needs-redo', 'unknown',
  ]));
  // Has Tags: true for anything with baked-in program/certification graphics
  // that need to come out before the source video is reused (matches the
  // "Legacy Tagged" classification for the mock set's mid-migration mix).
  const hasTags = overrides.hasTags ?? (videoFormat === 'legacy-tagged');
  const previousYouTubeVideos = overrides.previousYouTubeVideos || [];

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
    canvaLink: overrides.canvaLink || null,
    clips,
    listingImageUrl: overrides.listingImageUrl || null,
    // "Current" YouTube video. previousYouTubeVideos holds superseded
    // versions (see repository.js setYoutube) — usage records can pin
    // to the youtubeId that was current at the time, since historical
    // auctions may have used an older version.
    youtubeId, youtubeUrl, embedUrl, embedCode,
    previousYouTubeVideos,
    videoFormat,             // 'clean' | 'legacy-tagged' | 'needs-redo' | 'unknown'
    hasTags,                  // boolean — needs baked-in program/certification graphics removed before reuse
    workingOn: overrides.workingOn || null, // staff name currently building this video, or null
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
    videoFormat: 'clean',
    notes: 'Strong set, uniform frame. Good sale-day candidates. Shot clean per the new policy — no baked-in intro or program logos.',
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
    videoFormat: 'legacy-tagged', hasTags: true,
    notes: 'NHTC logo is burned into the footage from the old template — fine to keep using until this consignor is featured again.',
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
    videoFormat: 'legacy-tagged', hasTags: true,
    notes: 'Long-running video, reused every year this consignor comes back. ASV logo baked in from 2024 template.',
    usage: [
      { auctionDate: isoDaysAgo(5).slice(0, 10), auctionName: 'August Feeder Special', lots: ['612'], youtubeVersionId: 'barnone700steers' },
      { auctionDate: isoDaysAgo(40).slice(0, 10), auctionName: 'July Video Sale', lots: ['104', '105'], youtubeVersionId: 'barnone700steers' },
      { auctionDate: isoDaysAgo(75).slice(0, 10), auctionName: 'June Video Sale', lots: ['88'], youtubeVersionId: 'barnone700steers' },
      { auctionDate: isoDaysAgo(110).slice(0, 10), auctionName: 'May Video Sale', lots: ['210', '211', '212'], youtubeVersionId: 'barnone700steers' },
      { auctionDate: isoDaysAgo(150).slice(0, 10), auctionName: 'April Video Sale', lots: ['44'], youtubeVersionId: 'barnone700steers' },
      { auctionDate: isoDaysAgo(190).slice(0, 10), auctionName: 'March Video Sale', lots: ['9', '10'], youtubeVersionId: 'barnone700steers' },
    ],
  });

  // Needs Redo: staff has already flagged this one for a rebuild.
  const needsRedo = buildRecord({
    id: 'vid_redo001',
    consignor: consignorFor('16'), sexCode: '1', sireCode: '4', damCode: '1', weight: 815, monthYear: '0526',
    status: 'created', daysAgo: 60, videoMaker: 'Reyes Martinez',
    clipCount: 3, hasYoutube: true, youtubeId: 'silverspur815steers',
    videoFormat: 'needs-redo',
    notes: 'Old CMS intro is baked in and out of date (old logo). Rebuild before this consignor is featured again.',
    activity: [
      activity(isoDaysAgo(60), 'Reyes Martinez', 'created', 'Record created'),
      activity(isoDaysAgo(60), 'Reyes Martinez', 'clips', '3 clips uploaded'),
      activity(isoDaysAgo(58), 'Reyes Martinez', 'youtube', 'YouTube link added'),
      activity(isoDaysAgo(57), 'Reyes Martinez', 'status', 'Moved to Created'),
      activity(isoDaysAgo(12), 'Hayden Hollis', 'format', 'Marked Needs Redo — outdated CMS intro baked in'),
    ],
  });

  // YouTube version history: was Legacy Tagged, staff shot a clean
  // replacement, old link retained in previousYouTubeVideos. Usage
  // recorded under the old version is still attributed correctly.
  const versionHistory = buildRecord({
    id: 'vid_verhist01',
    consignor: consignorFor('39'), sexCode: '2', sireCode: '2', damCode: '4', weight: 540, monthYear: '0726',
    status: 'created', daysAgo: 300, videoMaker: 'Bryson Murray',
    clipCount: 6, hasYoutube: true, youtubeId: 'goldenplains540heifers-v2',
    videoFormat: 'clean',
    notes: 'Rebuilt clean in August after the old ASV/NHTC-tagged version was retired.',
    previousYouTubeVideos: [{
      id: 'goldenplains540heifers-v1',
      url: 'https://youtu.be/goldenplains540heifers-v1',
      embedUrl: 'https://www.youtube.com/embed/goldenplains540heifers-v1',
      embedCode: '<iframe width="560" height="315" src="https://www.youtube.com/embed/goldenplains540heifers-v1" title="CMS Auction Video" frameborder="0" allowfullscreen></iframe>',
      replacedAt: isoDaysAgo(45),
      replacedBy: 'Bryson Murray',
      reason: 'Rebuilt clean — old version had ASV/NHTC baked in',
    }],
    usage: [
      { auctionDate: isoDaysAgo(20).slice(0, 10), auctionName: 'July Video Sale', lots: ['301'], youtubeVersionId: 'goldenplains540heifers-v2' },
      { auctionDate: isoDaysAgo(200).slice(0, 10), auctionName: 'January Video Sale', lots: ['55', '56'], youtubeVersionId: 'goldenplains540heifers-v1' },
      { auctionDate: isoDaysAgo(260).slice(0, 10), auctionName: 'November Video Sale', lots: ['12'], youtubeVersionId: 'goldenplains540heifers-v1' },
    ],
    activity: [
      activity(isoDaysAgo(300), 'Bryson Murray', 'created', 'Record created'),
      activity(isoDaysAgo(300), 'Bryson Murray', 'clips', '6 clips uploaded'),
      activity(isoDaysAgo(298), 'Bryson Murray', 'youtube', 'YouTube link added'),
      activity(isoDaysAgo(297), 'Bryson Murray', 'status', 'Moved to Created'),
      activity(isoDaysAgo(260), 'Hayden Hollis', 'usage', 'Usage CSV associated Lot 12'),
      activity(isoDaysAgo(200), 'Hayden Hollis', 'usage', 'Usage CSV associated Lots 55, 56'),
      activity(isoDaysAgo(45), 'Bryson Murray', 'format', 'Marked Needs Redo — ASV/NHTC baked in from old template'),
      activity(isoDaysAgo(45), 'Bryson Murray', 'youtube', 'YouTube video replaced — previous version retained in history'),
      activity(isoDaysAgo(45), 'Bryson Murray', 'format', 'Video Format changed to Clean'),
      activity(isoDaysAgo(20), 'Hayden Hollis', 'usage', 'Usage CSV associated Lot 301'),
    ],
  });

  return [original, collision2, collision3, idHistory, draft, noClips, reused, needsRedo, versionHistory];
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
