/* =============================================================
 * CMS Video Manager — Reference dictionaries
 * -------------------------------------------------------------
 * Consignors, sex/sire/dam code lists, video makers, video format
 * definitions, and staff.
 *
 * The arrays below are the SEED/default values only. Consignors and
 * sire/dam types are Firestore-backed (see referenceData/* in
 * firestore-data.js and ensureReferenceLoaded() in repository.js) —
 * repository.js mutates these same array objects in place once real
 * data loads, or writes them to Firestore as-is the very first time
 * (bootstrapping the collection). Sex types, video makers, video
 * formats, and staff are still plain static/in-memory data; nothing
 * edits those at runtime. Nothing in the UI layer should import this
 * file directly — it all comes through repository.js.
 * ============================================================= */

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

// Real consignor list, per "Video Links - Copy of ID System.csv" (Aug 2026).
// Codes are permanent once used in a Video ID — see Video ID Manager's
// lock icon / doc comment above ReferenceDataRepository in repository.js.
export const CONSIGNORS = [
  { code: '1',  name: 'Tuls', flaggedNew: false, active: true },
  { code: '2',  name: 'Lone Star', flaggedNew: false, active: true },
  { code: '3',  name: 'Transition', flaggedNew: false, active: true },
  { code: '4',  name: 'Southwest', flaggedNew: false, active: true },
  { code: '5',  name: 'Road Runner', flaggedNew: false, active: true },
  { code: '6',  name: 'Vlot', flaggedNew: false, active: true },
  { code: '7',  name: 'Calftech', flaggedNew: false, active: true },
  { code: '8',  name: 'Breedr', flaggedNew: false, active: true },
  { code: '9',  name: 'Cnossen', flaggedNew: false, active: true },
  { code: '10', name: 'Natural Harvest', flaggedNew: false, active: true },
  { code: '11', name: 'Rajen Dairy', flaggedNew: false, active: true },
  { code: '12', name: 'Facil/ Bogle Calf Ranch', flaggedNew: false, active: true },
  { code: '13', name: 'Terrell (Prairie Creek Cattle)', flaggedNew: false, active: true },
  { code: '14', name: 'Burk Ranch Operations', flaggedNew: false, active: true },
  { code: '15', name: 'Hollis Ranch', flaggedNew: false, active: true },
  { code: '16', name: 'Billy Ray Jones', flaggedNew: false, active: true },
  { code: '17', name: 'Joe Paul Tomerlin', flaggedNew: false, active: true },
  { code: '18', name: 'Tirzo Rivera', flaggedNew: false, active: true },
  { code: '19', name: 'Fullmer', flaggedNew: false, active: true },
  { code: '20', name: 'Double M Ranch', flaggedNew: false, active: true },
  { code: '21', name: 'TL Harvesting Inc. @ Bullseye', flaggedNew: false, active: true },
  { code: '22', name: 'Klett Ranch', flaggedNew: false, active: true },
  { code: '23', name: 'Kash King Cattle', flaggedNew: false, active: true },
  { code: '24', name: 'Triple J Ranch', flaggedNew: false, active: true },
  { code: '25', name: 'Skipper Davis', flaggedNew: false, active: true },
  { code: '26', name: '3 C Farms (Chris Gilmer)', flaggedNew: false, active: true },
  { code: '27', name: 'Dickey Hendry', flaggedNew: false, active: true },
  { code: '28', name: 'Bullseye Calf Ranch', flaggedNew: false, active: true },
  { code: '29', name: 'Allen Ray', flaggedNew: false, active: true },
  { code: '30', name: 'Stone Creek Co. (Victor Neese)', flaggedNew: false, active: true },
  { code: '31', name: 'Tuls @ Hereford', flaggedNew: false, active: true },
  { code: '32', name: 'Brian Billings', flaggedNew: false, active: true },
  { code: '33', name: 'Billy Wayne Tripp', flaggedNew: false, active: true },
  { code: '34', name: '2 Ray Cattle Co.', flaggedNew: false, active: true },
  { code: '35', name: 'Red Melder', flaggedNew: false, active: true },
  { code: '36', name: 'Mark Myers', flaggedNew: false, active: true },
  { code: '37', name: 'Afford Cattle', flaggedNew: false, active: true },
  { code: '38', name: 'Outlier Dairy, LLC', flaggedNew: false, active: true },
  { code: '39', name: 'Dustin Hughes', flaggedNew: false, active: true },
  { code: '40', name: 'Prime Performance', flaggedNew: false, active: true },
  { code: '41', name: 'Liberty Belle Cattle Co.', flaggedNew: false, active: true },
  { code: '42', name: 'EB Cattle Co.', flaggedNew: false, active: true },
  { code: '43', name: 'Walking T Cattle Co.', flaggedNew: false, active: true },
  { code: '44', name: 'TBN Cattle, LLC', flaggedNew: false, active: true },
  { code: '45', name: 'SJA Cattle and Ranching', flaggedNew: false, active: true },
  { code: '46', name: 'B & K Partnership', flaggedNew: false, active: true },
  { code: '47', name: 'South Central Cattle Co.', flaggedNew: false, active: true },
  { code: '48', name: 'Rohrbach Farms', flaggedNew: false, active: true },
  { code: '49', name: 'N&N Dairy', flaggedNew: false, active: true },
  { code: '50', name: 'Frontier Dairy', flaggedNew: false, active: true },
  { code: '51', name: 'Tim Foote Cattle Co.', flaggedNew: false, active: true },
  { code: '52', name: 'Cedar Ridge', flaggedNew: false, active: true },
  { code: '53', name: 'Karter Castleberry', flaggedNew: false, active: true },
  { code: '54', name: 'Hat Cattle Co.', flaggedNew: false, active: true },
  { code: '55', name: 'Jerry Whitley', flaggedNew: false, active: true },
  { code: '56', name: 'Cooper Bar Ranch', flaggedNew: false, active: true },
  { code: '57', name: 'Wes Galyean', flaggedNew: false, active: true },
  { code: '58', name: '4C Cattle', flaggedNew: false, active: true },
  { code: '59', name: 'Texas West Cattle, LLC', flaggedNew: false, active: true },
  { code: '60', name: 'Joel Yssel', flaggedNew: false, active: true },
  { code: '61', name: 'Reliable Feeders', flaggedNew: false, active: true },
  { code: '62', name: 'GBC and Company, LLC', flaggedNew: false, active: true },
  { code: '63', name: 'TL Harvesting Inc. @ Sunnyside, TX', flaggedNew: false, active: true },
  { code: '64', name: 'Red River Dairy', flaggedNew: false, active: true },
  { code: '65', name: 'Tamanne Cattle', flaggedNew: false, active: true },
  { code: '66', name: 'Kim Martin', flaggedNew: false, active: true },
  { code: '67', name: 'Rocker M Cattle Co.', flaggedNew: false, active: true },
  { code: '68', name: 'CCW Cattle Co (Audie Waite)', flaggedNew: false, active: true },
  { code: '69', name: 'BFS', flaggedNew: false, active: true },
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


// Seed data only — Firestore (referenceData/staff) is the real source of
// truth once ensureReferenceLoaded() runs; see repository.js. Edit who
// can claim a video to build via Tools -> Manage Staff, not here.
export const STAFF = [
  { id: 'hayden', name: 'Hayden Hollis',            role: 'staff', watch: true,  active: true },
  { id: 'bryson', name: 'Bryson Murray',            role: 'staff', watch: false, active: true },
  { id: 'repA',   name: 'Rep — Colt Reagan',        role: 'rep',   watch: true,  active: true },
  { id: 'repB',   name: 'Rep — Dusty Fields',       role: 'rep',   watch: true,  active: true },
  { id: 'repC',   name: 'Rep — Reyes Martinez',     role: 'rep',   watch: false, active: true },
];

export function labelFor(list, code) {
  const hit = list.find(x => x.code === String(code));
  return hit ? hit.label : null;
}

export function consignorFor(code) {
  return CONSIGNORS.find(c => c.code === String(code)) || null;
}
