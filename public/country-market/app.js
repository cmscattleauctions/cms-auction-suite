// CMS Country Page Manager — Combined Bundle
// Auto-generated — do not edit individual sections

// ── CONFIG ──────────────────────────────────────────────────
// ============================================================
// CMS COUNTRY PAGE MANAGER — CONFIG
// All hardcoded values and constants live here
// ============================================================

// Data layer: Firestore, via ./firestore-adapter.js (window.CMSCountryDB).
// This app shares the suite's Firebase project — same login as the shell.

const STATUS = {
  STAGED: 'Staged',
  ACTIVE: 'Active',
  SOLD: 'Sold',
  WAITING: 'Waiting to Ship',
  ARCHIVED: 'Archived'
};

const STATUS_META = {
  'Staged':          { color: 'status-staged',  label: 'Staged' },
  'Active':          { color: 'status-active',  label: 'Active' },
  'Sold':            { color: 'status-sold',    label: 'Sold' },
  'Waiting to Ship': { color: 'status-waiting', label: 'Waiting' },
  'Archived':        { color: 'status-archived', label: 'Archived' }
};

const ROLES = {
  ADMIN: 'admin',
  REP: 'rep'
};

const COMPANY = {
  name: 'Cattle Marketing Services',
  address: '6900 I-40 West, Suite 135',
  city: 'Amarillo, TX 79106',
  phone: '(806) 355-7505'
};

const DEFAULT_SALE_TYPES = [
  'Timed Auction',
  'Direct Bid Auction',
  'Buy Now'
];

const ARCHIVE_REASONS = [
  'Did not sell / expired',
  'Pulled by consignor',
  'Moved to monthly auction',
  'Duplicate listing',
  'Timed auction ended',
  'Other'
];

// BidPath CSV — all 89 columns in exact order
const BP_COLUMNS = [
  'ItemFullNumber', 'LotFullNumber', 'GroupId', 'LotCategory',
  'LotName*', 'LotDescription', 'StartingBid*', 'ReservePrice',
  'Consignor', 'BuyNowAmount', 'Quantity', 'BulkWinBidDistribution',
  'BpRangeCalculation', 'PublishDate', 'StartBiddingDate', 'StartClosingDate',
  'YouTube link', 'Load Count', 'Head Count', 'Base Weight',
  'Sex Filter', 'Delivery', 'Shrink', 'Slide', 'Rep', 'Comments',
  'Breed', 'Lot Location', 'Type', 'Second Notes',
  'Lot Sequence', 'Consignor Filter', 'Sex', 'Direct Bid?'
];

const DOC_COLORS = {
  blue:   '#336699',
  gray:   '#818589',
  steel:  '#6F8FAF',
  navy:   '#202E4A',
  teal:   '#3FA796',
  gold:   '#C9A66B'
};


// ── STATE ───────────────────────────────────────────────────
// ============================================================
// CMS COUNTRY PAGE MANAGER — STATE MODULE
// Single source of truth. All UI renders from here.
// ============================================================

const state = {
  lots: [],
  consignors: [],
  settings: {},
  profiles: [],

  ui: {
    activePage: 'dash',
    activeLotId: null,
    ldpOpen: false,
    ldpTab: 'overview',
    searchQuery: '',
    sortCol: null,
    sortDir: 'asc',
    theme: 'light'
  }
};

// ── Lot helpers ───────────────────────────────────────────────

function getLot(id) {
  return state.lots.find(l => l.id === id) || null;
}

function getLotsByStatus(status) {
  return state.lots.filter(l => l.status === status);
}

function getStagedLots()  { return getLotsByStatus('Staged'); }
function getActiveLots()  { return getLotsByStatus('Active'); }
function getSoldLots()    { return state.lots.filter(l => l.status === 'Sold'); }
function getWaitingLots() { return state.lots.filter(l => l.status === 'Sold' && l.soldSt === 'waiting'); }
function getShippedLots() { return state.lots.filter(l => l.status === 'Sold' && l.soldSt === 'shipped'); }
function getArchivedLots(){ return getLotsByStatus('Archived'); }


// Keep every list in the app ordered by Lot Sequence (numeric),
// falling back to the lot number when a sequence is missing.
function seqVal(l) {
  const s = parseFloat(l.seq);
  if (!isNaN(s)) return s;
  const m = String(l.lot || '').match(/^(\d+)/);
  return m ? parseInt(m[1], 10) * 10 : Number.MAX_SAFE_INTEGER;
}
function sortLotsBySeq() {
  state.lots.sort((a, b) => seqVal(a) - seqVal(b) || String(a.lot).localeCompare(String(b.lot)));
}

function upsertLot(lot) {
  const idx = state.lots.findIndex(l => l.id === lot.id);
  if (idx >= 0) state.lots[idx] = lot;
  else state.lots.unshift(lot);
  sortLotsBySeq();
}

function removeLot(id) {
  state.lots = state.lots.filter(l => l.id !== id);
}

// ── Consignor helpers ─────────────────────────────────────────

function getConsignorProfile(name) {
  return state.consignors.find(c => c.name === name) || null;
}

function upsertConsignorState(profile) {
  const idx = state.consignors.findIndex(c => c.id === profile.id);
  if (idx >= 0) state.consignors[idx] = profile;
  else state.consignors.push(profile);
}

function removeConsignorState(id) {
  state.consignors = state.consignors.filter(c => c.id !== id);
}

// ── Settings helpers ──────────────────────────────────────────

function getSetting(key, fallback = null) {
  return state.settings[key] ?? fallback;
}

function getReps() {
  return getSetting('reps', []);
}

function getSaleTypes() {
  return getSetting('sale_types', ['Timed Auction', 'Direct Bid Auction', 'Buy Now']);
}

// ── UI helpers ────────────────────────────────────────────────

function setPage(page) {
  state.ui.activePage = page;
}

function openLDP(id) {
  state.ui.activeLotId = id;
  state.ui.ldpOpen = true;
  state.ui.ldpTab = 'overview';
}

function closeLDP() {
  state.ui.ldpOpen = false;
  state.ui.activeLotId = null;
}

function setLDPTab(tab) {
  state.ui.ldpTab = tab;
}

// ── Badge counts ──────────────────────────────────────────────

function getBadgeCounts() {
  return {
    staged:  getStagedLots().length,
    active:  getActiveLots().length,
    sold:    getSoldLots().length,
    waiting: getWaitingLots().length
  };
}

// ── Search / filter ───────────────────────────────────────────

function searchLots(query) {
  if (!query) return state.lots;
  const q = query.toLowerCase();
  return state.lots.filter(l =>
    (l.lot || '').toLowerCase().includes(q) ||
    (l.con || '').toLowerCase().includes(q) ||
    (l.breed || '').toLowerCase().includes(q) ||
    (l.rep || '').toLowerCase().includes(q) ||
    (l.type || '').toLowerCase().includes(q)
  );
}


// ── AUTH ────────────────────────────────────────────────────
// ============================================================
// CMS COUNTRY PAGE MANAGER — AUTH MODULE
// Firestore client init (via adapter), login, logout, session
// ============================================================


// Shared Firestore client (installed by ./firestore-adapter.js)
let _lotsChannel = null;  // realtime subscription reference
function getDb() {
  if (!window.CMSCountryDB) throw new Error('Firestore adapter not loaded');
  return window.CMSCountryDB;
}

let _currentUser    = null;
let _currentProfile = null;
let _isLoadingApp   = false;

function getCurrentUser()    { return _currentUser; }
function getCurrentProfile() { return _currentProfile; }

// Role helpers — UI layer only. DB-level enforcement via Firestore security rules.
function isAdmin() { return _currentProfile?.role === 'admin'; }
function isRep()   { return _currentProfile?.role === 'rep'; }
function getRepName()         { return _currentProfile?.rep_name || ''; }
function getUserDisplayName() {
  return _currentProfile?.full_name || _currentUser?.email || 'User';
}

// ── Centralized permissions ───────────────────────────────────
function canViewLot(lot)      { if (!_currentUser) return false; if (isAdmin()) return true; return !lot.rep || lot.rep === getRepName(); }
function canEditLot(lot)      { if (!_currentUser) return false; if (isAdmin()) return true; return !!(lot && lot.rep === getRepName() && (lot.status === 'Staged' || lot.status === 'Active')); }
function canDeleteLot()        { return isAdmin(); }
function canChangeStatus()     { return isAdmin(); }
function canViewBuyer()        { return isAdmin(); }
function canViewProfiles()     { return isAdmin(); }
function canEditProfiles()     { return isAdmin(); }
function canManageSettings()   { return isAdmin(); }
function canManageConsignors() { return isAdmin() || isRep(); }
function canDeleteConsignors() { return isAdmin(); }
function canCreateLot()        { return isAdmin() || isRep(); }
function canAccessAdmin()      { return isAdmin(); }

function requirePerm(allowed, message) {
  if (!allowed) { const msg = message || 'Permission denied.'; console.warn('[CMS] Blocked:', msg); throw new Error(msg); }
}

async function signIn(email, password) {
  const { data, error } = await getDb().auth.signInWithPassword({ email, password });
  if (error) throw error;
  _currentUser = data.user;
  await loadProfile();
  return data.user;
}

async function signOut() {
  // Tear down realtime before clearing session
  teardownRealtime();
  // Clear all in-memory app state
  _currentUser    = null;
  _currentProfile = null;
  _isLoadingApp   = false;
  _appBooted      = false;
  state.lots       = [];
  state.consignors = [];
  state.settings   = {};
  state.profiles   = [];
  state.ui.activeLotId = null;
  state.ui.ldpOpen     = false;
  try { await getDb().auth.signOut(); } catch(e) {}
}

async function getSession() {
  const { data } = await getDb().auth.getSession();
  if (data?.session?.user) {
    _currentUser = data.session.user;
    await loadProfile();
    return data.session.user;
  }
  return null;
}

async function loadProfile() {
  if (!_currentUser) return;
  const { data, error } = await getDb()
    .from('profiles')
    .select('*')
    .eq('id', _currentUser.id)
    .single();
  if (!error && data) _currentProfile = data;
}

async function refreshProfile() {
  await loadProfile();
}

// Auth state listener — registered during boot, not at parse time
let _appBooted = false;
function setupAuthListener() {
  getDb().auth.onAuthStateChange(async (event, session) => {
    if (event === 'TOKEN_REFRESHED' && session?.user) {
      // Auth token refreshed — update our reference, nothing else needed
      _currentUser = session.user;
    } else if (event === 'SIGNED_OUT') {
      // Only act on SIGNED_OUT after the app is running — during boot, the adapter may fire
      // SIGNED_OUT before restoring the session; we ignore that by checking _appBooted.
      if (_appBooted) {
        await signOut();
        showLogin();
      }
    }
    // SIGNED_IN is intentionally NOT handled here.
    // Initial load: boot() calls getSession() directly.
    // Login from login screen: signIn() calls loadApp() directly after success.
    // This avoids the race condition where SIGNED_OUT fires during session restore.
  });
}


// ── DATABASE ────────────────────────────────────────────────
// ============================================================
// CMS COUNTRY PAGE MANAGER — DATABASE MODULE
//
// SECURITY NOTICE: Every function here is guarded by requirePerm()
// for UI-layer defense, but CAN be bypassed in the browser console.
// Firestore security rules enforce the same boundaries at the
// database level. See docs/COUNTRY-MARKET-SETUP.md.
//
// Table-level enforcement needed:
//   lots         — reps see/edit only their own; admins see all
//   profiles     — only admins can update role/rep_name
//   settings     — only admins can write
//   consignors   — only admins can write; authenticated users read
//   activity_log — insert for authenticated; select for all
// ============================================================

// ── Input normalization ───────────────────────────────────────
// Returns an error string if validation fails, null if OK.
// Also normalises values in-place (trims strings, coerces numbers).
function normalizeLot(l) {
  const ALLOWED_STATUSES = Object.values(STATUS);
  // Trim all string fields
  const strFields = ['lot','con','breed','sex','sale','rep','type','del','loc',
    'shrink','slide','notes','secondDesc','cmsIntNotes','cmsExtNotes','yt',
    'buyer','soldNotes','archRsn','wt','ask','buyNow','startBid'];
  for (const f of strFields) { if (typeof l[f] === 'string') l[f] = l[f].trim(); }
  // Required fields
  if (!l.lot) return 'Lot Number is required';
  if (!l.con) return 'Consignor is required';
  if (!l.sale) return 'Sale Type is required';
  // Numeric
  if (l.head !== undefined && l.head !== null && l.head !== '') {
    const n = Number(l.head);
    if (isNaN(n) || n <= 0) return 'Head Count must be a positive number';
    l.head = n;
  }
  if (l.loads !== undefined && l.loads !== null && l.loads !== '') {
    const n = Number(l.loads);
    if (isNaN(n) || n <= 0) return 'Loads must be a positive number';
    l.loads = n;
  }
  if (l.seq) { const n = Number(l.seq); if (!isNaN(n)) l.seq = n; }
  // Status enum guard
  if (l.status && !ALLOWED_STATUSES.includes(l.status)) {
    return `Invalid status: ${l.status}`;
  }
  return null;
}

// Normalise settings values — trim, deduplicate, remove empties
function normalizeSettingArray(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map(v => String(v).trim()).filter(Boolean))];
}
// ── LOTS ─────────────────────────────────────────────────────

async function fetchLots() {
  const { data, error } = await getDb()
    .from('lots')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function insertLot(lot) {
  requirePerm(canCreateLot(), "You do not have permission to create lots.");
  const normErr = normalizeLot(lot);
  if (normErr) throw new Error(normErr);
  const { data, error } = await getDb()
    .from('lots')
    .insert([lotToDb(lot)])
    .select()
    .single();
  if (error) throw error;
  return dbToLot(data);
}

async function updateLot(id, changes) {
  const lot = getLot(id);
  if ('status' in changes) { requirePerm(canChangeStatus(), "Only admins can change lot status."); }
  else { requirePerm(canEditLot(lot), "You do not have permission to edit this lot."); }
  // Normalize string fields in changes before writing
  const strFields = ['lot','con','breed','sex','sale','rep','type','del','loc',
    'shrink','slide','notes','secondDesc','buyer','soldNotes','archRsn','wt','ask','buyNow','startBid'];
  for (const f of strFields) {
    if (f in changes && typeof changes[f] === 'string') changes[f] = changes[f].trim();
  }
  const dbChanges = lotToDb(changes);
  dbChanges.updated_at = new Date().toISOString();
  const { data, error } = await getDb()
    .from('lots')
    .update(dbChanges)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return dbToLot(data);
}

async function deleteLot(id) {
  requirePerm(canDeleteLot(), "Only admins can delete lots.");
  const { error } = await getDb()
    .from('lots')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── CONSIGNORS ───────────────────────────────────────────────

async function fetchConsignors() {
  const { data, error } = await getDb()
    .from('consignors')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

async function upsertConsignor(profile) {
  requirePerm(canManageConsignors(), "Only admins can manage consignors.");
  const { data, error } = await getDb()
    .from('consignors')
    .upsert({
      name: profile.name,
      breeds: profile.breeds || [],
      sexes: profile.sexes || [],
      locations: profile.locations || [],
      shrink: profile.shrink || [],
      slides: profile.slides || []
    }, { onConflict: 'name' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteConsignor(id) {
  requirePerm(canDeleteConsignors(), "Only admins can delete consignors.");
  const { error } = await getDb()
    .from('consignors')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── SETTINGS ─────────────────────────────────────────────────

async function fetchSettings() {
  const { data, error } = await getDb()
    .from('settings')
    .select('*');
  if (error) throw error;
  // Convert array of {key, value} to plain object
  const settings = {};
  for (const row of data) {
    settings[row.key] = row.value;
  }
  return settings;
}

async function saveSetting(key, value) {
  requirePerm(canManageSettings(), "Only admins can change settings.");
  if (!key || typeof key !== 'string' || !key.trim()) throw new Error('Invalid setting key');
  // Sanitize key — alphanumeric and underscores only
  const cleanKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleanKey) throw new Error('Invalid setting key format');
  // If value is an array, normalize it
  const cleanValue = Array.isArray(value) ? normalizeSettingArray(value) : value;
  const { error } = await getDb()
    .from('settings')
    .upsert({ key: cleanKey, value: cleanValue, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

// ── ACTIVITY LOG ─────────────────────────────────────────────

async function logActivity(lotId, action, userName) {
  const { error } = await getDb()
    .from('activity_log')
    .insert([{
      lot_id: lotId,
      user_name: userName,
      action,
      created_at: new Date().toISOString()
    }]);
  if (error) console.warn('Log error:', error);
}

async function fetchActivityForLot(lotId) {
  const { data, error } = await getDb()
    .from('activity_log')
    .select('*')
    .eq('lot_id', lotId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ── PROFILES ─────────────────────────────────────────────────

async function fetchProfiles() {
  requirePerm(canViewProfiles(), "Only admins can view profiles.");
  const { data, error } = await getDb()
    .from('profiles')
    .select('*')
    .order('full_name');
  if (error) throw error;
  return data;
}

async function updateProfile(id, changes) {
  requirePerm(canEditProfiles(), "Only admins can edit profiles.");
  if (!id) throw new Error('Profile ID is required');
  const ALLOWED = new Set(['full_name','role','rep_name','email']);
  const safe = Object.fromEntries(
    Object.entries(changes)
      .filter(([k, v]) => ALLOWED.has(k) && v !== undefined)
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
  );
  if (safe.role && !['admin','rep'].includes(safe.role)) throw new Error(`Invalid role: ${safe.role}`);
  if (Object.keys(safe).length === 0) throw new Error('No valid fields to update');
  const { error } = await getDb()
    .from('profiles')
    .update(safe)
    .eq('id', id);
  if (error) throw error;
}

// ── FIELD MAPPING: JS ↔ DB ───────────────────────────────────
// JS uses camelCase, DB uses snake_case

function lotToDb(l) {
  const d = {};
  const map = {
    lot: 'lot', seq: 'seq', gid: 'gid',
    itemFullNumber: 'item_full_number',
    sale: 'sale', rep: 'rep', con: 'con',
    breed: 'breed', sex: 'sex', type: 'type',
    loads: 'loads', head: 'head', wt: 'wt',
    del: 'del', loc: 'loc', shrink: 'shrink', slide: 'slide',
    notes: 'notes', secondDesc: 'second_desc',
    yt: 'yt', imgFrame: 'img_frame',
    cmsIntNotes: 'cms_int_notes', cmsExtNotes: 'cms_ext_notes',
    closeDate: 'close_date', closeTime: 'close_time',
    startBidDate: 'start_bid_date', startBidTime: 'start_bid_time',
    ask: 'ask', buyNow: 'buy_now', startBid: 'start_bid',
    highBid: 'high_bid', highBidNote: 'high_bid_note',
    highBidBy: 'high_bid_by', highBidAt: 'high_bid_at',
    status: 'status', listDate: 'list_date',
    buyer: 'buyer', soldDate: 'sold_date', soldSt: 'sold_st',
    shipDate: 'ship_date', price: 'price', down: 'down',
    soldNotes: 'sold_notes', archRsn: 'arch_rsn', archDate: 'arch_date',
    intNotes: 'int_notes', extNotes: 'ext_notes', log: 'log'
  };
  const DATE_COLS = new Set(['close_date','close_time','start_bid_date','start_bid_time',
    'sold_date','ship_date','arch_date','list_date']);
  for (const [js, db] of Object.entries(map)) {
    if (l[js] !== undefined) {
      // Postgres DATE/TIME columns reject empty strings — send null instead
      d[db] = (DATE_COLS.has(db) && l[js] === '') ? null : l[js];
    }
  }
  return d;
}

function dbToLot(d) {
  if (!d) return null;
  return {
    id: d.id,
    lot: d.lot,
    seq: d.seq,
    gid: d.gid,
    itemFullNumber: d.item_full_number || '',
    sale: d.sale,
    rep: d.rep,
    con: d.con,
    breed: d.breed,
    sex: d.sex,
    type: d.type,
    loads: d.loads,
    head: d.head,
    wt: d.wt,
    del: d.del,
    loc: d.loc,
    shrink: d.shrink,
    slide: d.slide,
    notes: d.notes,
    secondDesc: d.second_desc,
    yt: d.yt,
    imgFrame: d.img_frame || 2,
    cmsIntNotes: d.cms_int_notes,
    cmsExtNotes: d.cms_ext_notes,
    closeDate: d.close_date,
    closeTime: d.close_time,
    startBidDate: d.start_bid_date,
    startBidTime: d.start_bid_time,
    ask: d.ask,
    buyNow: d.buy_now,
    startBid: d.start_bid,
    highBid: d.high_bid,
    highBidNote: d.high_bid_note,
    highBidBy: d.high_bid_by || '',
    highBidAt: d.high_bid_at || '',
    status: d.status,
    listDate: d.list_date,
    buyer: d.buyer,
    soldDate: d.sold_date,
    soldSt: d.sold_st,
    shipDate: d.ship_date,
    price: d.price,
    down: d.down,
    soldNotes: d.sold_notes,
    archRsn: d.arch_rsn,
    archDate: d.arch_date,
    intNotes: d.int_notes || [],
    extNotes: d.ext_notes || [],
    log: d.log || [],
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
}


// ── CSV ─────────────────────────────────────────────────────
// ============================================================
// CMS COUNTRY PAGE MANAGER — CSV MODULE
// BidPath CSV export. Available at any time for any lot.
// ============================================================


function bpDate(dateStr, timeStr) {
  if (!dateStr) return '';
  const t = timeStr ? timeStr.substring(0, 5) : '00:00';
  return `${dateStr} ${t}:00 CST`;
}

function buildLotName(l) {
  const loads = l.loads || 1;
  const breed = l.breed || '';
  return `${loads} Load${loads !== 1 ? 's' : ''} of ${breed}`;
}

function getLotCat(l) {
  const parts = [l.con, (l.sex || '').split('\n')[0], l.type].filter(Boolean);
  return parts.join(';');
}

function lotToRow(l) {
  // ── BidPath field normalizers ─────────────────────────────────────────
  // Sex Filter: BidPath only accepts these exact three values
  const normSexFilter = (sex) => {
    const s = (sex || '').toLowerCase();
    const hasSteer  = s.includes('steer');
    const hasHeifer = s.includes('heifer');
    if (hasSteer && hasHeifer) return 'Steers/ Heifers';
    if (hasSteer)  return 'Steers';
    if (hasHeifer) return 'Heifers';
    // Fallback: check first line for common terms
    const first = (sex || '').split('\n')[0].trim();
    if (/bull/i.test(first)) return 'Steers';  // treat bulls as steers for BidPath
    return 'Steers/ Heifers';  // safest default for mixed/unknown
  };

  // Type: BidPath only accepts these exact four values
  const normType = (type) => {
    const t = (type || '').toLowerCase();
    // Already an exact match — pass through
    const exact = ['Black X Beef on Dairy','Charolais X Beef on Dairy','Holsteins','Natives'];
    if (exact.includes(type)) return type;
    if (t.includes('charolais'))                             return 'Charolais X Beef on Dairy';
    if (t.includes('holstein'))                              return 'Holsteins';
    if (t.includes('native') || t.includes('yearling') ||
        t.includes('stocker') || t.includes('grass') ||
        t.includes('angus') || t.includes('hereford') ||
        t.includes('commercial'))                            return 'Natives';
    if (t.includes('black') || t.includes('dairy') ||
        t.includes('beef on dairy') || t.includes('angus x')) return 'Black X Beef on Dairy';
    return 'Natives';  // safest default
  };

  const sex1     = (l.sex || '').split('\n')[0].trim();
  const sexFilter = normSexFilter(l.sex);
  const bpType    = normType(l.type);
  const isDirect  = (l.sale || '').toLowerCase().includes('direct');

  // Format a date+time for BidPath: "YYYY-MM-DD HH:MM:00 CST"
  const bpDateTime = (dateStr, timeStr) => {
    if (!dateStr) return '';
    const time = timeStr ? timeStr.substring(0, 5) : '00:00';
    return `${dateStr} ${time}:00 CST`;
  };

  // LotName: "N Load(s) of Breed"
  const loads = l.loads || 1;
  const loadWord = +loads === 1 ? 'Load' : 'Loads';
  const lotName = `${loads} ${loadWord} of ${(l.breed || '').split('\n')[0].trim()}`;

  // LotCategory: "Consignor;SexFilter;Type" — uses normalized values
  const lotCategory = [l.con, sexFilter, bpType].filter(Boolean).join(';');

  const publishDt   = bpDateTime(l.listDate || l.closeDate, null);
  const startBidDt  = bpDateTime(l.startBidDate || l.listDate || l.closeDate,
                                  l.startBidTime || null);
  const closeDt     = bpDateTime(l.closeDate, l.closeTime);

  // GroupId: must be numeric integer or blank.
  // Use the lot sequence number if available (it's already numeric).
  const groupId = l.seq ? String(+l.seq || '') : '';

  return {
    'ItemFullNumber':        l.itemFullNumber || '',
    'LotFullNumber':         l.lot || '',
    'GroupId':               groupId,
    'LotCategory':           lotCategory,
    'LotName*':              lotName,
    'LotDescription':        l.notes || '',
    'StartingBid*':          l.startBid || l.ask || '',
    'ReservePrice':          '',
    'Consignor':             l.con || '',
    'BuyNowAmount':          l.buyNow || '',
    'Quantity':              l.head || '',
    'BulkWinBidDistribution':'MASTER',
    'BpRangeCalculation':    'sliding',
    'PublishDate':           publishDt,
    'StartBiddingDate':      startBidDt,
    'StartClosingDate':      closeDt,
    'YouTube link':          l.yt || '',
    'Load Count':            l.loads || '',
    'Head Count':            l.head || '',
    'Base Weight':           l.wt || '',
    'Sex Filter':            sexFilter,
    'Delivery':              l.del || '',
    'Shrink':                l.shrink || '',
    'Slide':                 l.slide || '',
    'Rep':                   l.rep || '',
    'Comments':              l.head || '',
    'Breed':                 l.breed || '',
    'Lot Location':          l.loc || '',
    'Type':                  bpType,
    'Second Notes':          l.secondDesc || '',
    'Lot Sequence':          l.seq || '',
    'Consignor Filter':      l.con || '',
    'Sex':                   l.sex || '',
    'Direct Bid?':           isDirect ? 'Yes' : 'No'
  };
}


function escapeCSV(val) {
  const s = (val === null || val === undefined) ? '' : String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCSV(lots) {
  // Exports now use the Country Page 33-column template format
  // (matches the team's BidPath upload template exactly).
  const header = CP_COLUMNS.map(escapeCSV).join(',');
  const rows = lots.map(lot => {
    const row = lotToCountryRow(lot);
    return CP_COLUMNS.map(col => escapeCSV(row[col] ?? '')).join(',');
  });
  return [header, ...rows].join('\r\n');
}

// ============================================================
// COUNTRY PAGE EXPORT (template CSV + lot images)
// Exports the Country Page upload template with LotImage filled,
// and downloads a zip that also contains one image per lot —
// a real frame pulled from the lot's YouTube video (frames 1/2/3,
// chosen per lot via "Listing Image Frame"; default 2 = middle).
// Images are fetched through the suite's /api/thumb function.
// ============================================================

const CP_COLUMNS = [
  'LotFullNumber','Lot Sequence','Rep','Consignor','LotName*','Load Count',
  'Quantity','Head Count','Comments','Sex','Base Weight','Delivery',
  'Lot Location','Shrink','Slide','LotDescription','Second Notes','Type',
  'YouTube link','LotCategory','Sex Filter','Consignor Filter','LotImage',
  'StartingBid*','ReservePrice','BuyNowAmount','Make Offer Amount',
  'StartBiddingDate','PublishDate','UnpublishDate','StartClosingDate',
  'Direct Bid?','BestOffer'
];

// Format a lot's date+time for the template: "YYYY-MM-DD HH:MM:SS UTC".
// Times are entered as US Central; convert using the browser's tz data
// (handles CST/CDT automatically; falls back to CST -6 if unavailable).
function cpUtcDate(dateStr, timeStr) {
  if (!dateStr) return '';
  const t = (timeStr || '00:00').substring(0, 5);
  let offsetHours = -6; // CST fallback
  try {
    const probe = new Date(`${dateStr}T${t}:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', timeZoneName: 'shortOffset'
    }).formatToParts(probe);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value || '';
    const m = tzName.match(/GMT([+-]\d+)/);
    if (m) offsetHours = parseInt(m[1], 10);
  } catch (e) { /* keep CST fallback */ }
  const local = new Date(`${dateStr}T${t}:00Z`); // wall time, pretend-UTC
  const utc = new Date(local.getTime() - offsetHours * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${utc.getUTCFullYear()}-${p(utc.getUTCMonth() + 1)}-${p(utc.getUTCDate())} ` +
         `${p(utc.getUTCHours())}:${p(utc.getUTCMinutes())}:00 UTC`;
}

function cpVideoId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|watch\?v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function cpImageName(l) {
  const safe = String(l.lot || '').replace(/[^A-Za-z0-9_-]/g, '');
  return safe ? `Lot_${safe}.jpg` : '';
}

function lotToCountryRow(l) {
  const normSexFilter = (sex) => {
    const s = (sex || '').toLowerCase();
    if (s.includes('steer') && s.includes('heifer')) return 'Steers/ Heifers';
    if (s.includes('steer'))  return 'Steers';
    if (s.includes('heifer')) return 'Heifers';
    return 'Steers/ Heifers';
  };
  const loads = l.loads || 1;
  const closeDt = cpUtcDate(l.closeDate, l.closeTime);
  const startBidDt = cpUtcDate(l.startBidDate || l.closeDate, l.startBidTime || l.closeTime);
  const hasVideo = !!cpVideoId(l.yt);
  const isDirect = l.sale === 'Direct Bid Auction';

  return {
    'LotFullNumber':     l.lot || '',
    'Lot Sequence':      l.seq || '',
    'Rep':               l.rep || '',
    'Consignor':         l.con || '',
    'LotName*':          `${loads} Load${loads !== 1 ? 's' : ''} of ${l.breed || ''}`,
    'Load Count':        loads,
    'Quantity':          l.head || '',
    'Head Count':        l.head || '',
    'Comments':          l.head || '',
    'Sex':               l.sex || '',
    'Base Weight':       l.wt || '',
    'Delivery':          l.del || '',
    'Lot Location':      l.loc || '',
    'Shrink':            l.shrink || '',
    'Slide':             l.slide || '',
    'LotDescription':    l.notes || '',
    'Second Notes':      l.secondDesc || '',
    'Type':              l.type || '',
    'YouTube link':      l.yt || '',
    'LotCategory':       [l.con, (l.sex || '').split('\n')[0], l.type].filter(Boolean).join(';'),
    'Sex Filter':        normSexFilter(l.sex),
    'Consignor Filter':  l.con || '',
    'LotImage':          hasVideo ? cpImageName(l) : '',
    'StartingBid*':      l.startBid || '',
    'ReservePrice':      l.ask || '',
    'BuyNowAmount':      l.buyNow || '',
    'Make Offer Amount': l.startBid || '',
    'StartBiddingDate':  startBidDt,
    'PublishDate':       '',
    'UnpublishDate':     '',
    'StartClosingDate':  closeDt,
    'Direct Bid?':       isDirect ? 'Yes' : 'No',
    'BestOffer':         isDirect ? 1 : 2
  };
}

function buildCountryCSV(lots) {
  const header = CP_COLUMNS.map(escapeCSV).join(',');
  const rows = lots.map(l => {
    const row = lotToCountryRow(l);
    return CP_COLUMNS.map(col => escapeCSV(row[col] ?? '')).join(',');
  });
  return header + '\n' + rows.join('\n');
}

async function cpFetchFrame(videoId, frame) {
  const attempts = [
    `/api/thumb?id=${videoId}&frame=${frame}`,
    `/.netlify/functions/thumb?id=${videoId}&frame=${frame}`,
    `https://i.ytimg.com/vi/${videoId}/hq${frame}.jpg`
  ];
  for (const url of attempts) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size > 2000) return blob;
      }
    } catch (_) { /* next */ }
  }
  return null;
}

async function downloadCountryZip(lots) {
  if (!lots.length) { toast('No lots to export', true); return; }
  const csv = buildCountryCSV(lots);
  const stamp = new Date().toISOString().split('T')[0];

  if (typeof JSZip === 'undefined') {
    // Fallback: CSV only
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CountryPage_${stamp}.csv`;
    a.click();
    toast('JSZip not loaded — downloaded CSV only');
    return;
  }

  toast('Building Country Page export…');
  const zip = new JSZip();
  zip.file(`CountryPage_${stamp}.csv`, '\uFEFF' + csv);

  const cache = new Map();
  const missing = [];
  for (const l of lots) {
    const vid = cpVideoId(l.yt);
    const name = cpImageName(l);
    if (!vid || !name) { missing.push(l.lot); continue; }
    const frame = [1,2,3].includes(+l.imgFrame) ? +l.imgFrame : 2;
    const key = `${vid}-${frame}`;
    if (!cache.has(key)) cache.set(key, await cpFetchFrame(vid, frame));
    const blob = cache.get(key);
    if (blob) zip.file(name, blob);
    else missing.push(l.lot);
  }

  const out = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = `CountryPage_${stamp}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(missing.length
    ? `Exported — no image for: ${missing.join(', ')}`
    : `Exported ${lots.length} lot(s) with images`);
}

function downloadCSV(lots, filename) {
  const csv = buildCSV(lots);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `BidPath_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ============================================================
// DIRECT BID — current high bid tracking
// ============================================================

function offerAge(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms) || ms < 0) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}
function offerAgeColor(iso) {
  if (!iso) return 'var(--text-muted)';
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 24) return 'var(--ok)';
  if (h < 72) return 'var(--warn)';
  return 'var(--err)';
}

let _qbEditing = null; // lot id whose bid chip is expanded into the inline editor

function bidCell(l) {
  if (l.sale !== 'Direct Bid Auction') return '<td style="color:var(--text-faint);">—</td>';

  // Inline quick-entry: type amount (+ optional buyer), press Enter.
  // Timestamp is set automatically to now. Clock icon opens the full
  // dialog for backdating an offer that came in earlier.
  if (!l.highBid || _qbEditing === l.id) {
    return `<td class="bid-wrap">
      <span class="quick-bid" data-id="${l.id}" style="display:inline-flex;gap:4px;align-items:center;white-space:nowrap;">
        <input type="number" step="0.01" min="0" class="qb-amt" placeholder="$ bid" value="${esc(l.highBid || '')}"
               style="width:74px;padding:6px 8px;border:1.5px solid var(--brand);border-radius:var(--r);font:inherit;font-weight:700;">
        <input type="text" class="qb-by" placeholder="buyer" value="${esc(l.highBidBy || '')}"
               style="width:92px;padding:6px 8px;border:1px solid var(--border-mid);border-radius:var(--r);font:inherit;font-size:12px;">
        <button class="btn btn-primary btn-sm qb-save" title="Save (or press Enter)" style="padding:5px 9px;">✓</button>
        <button class="btn btn-ghost btn-sm qb-time" title="Backdate — set when the offer was made" style="padding:5px 7px;">⏱</button>
      </span>
    </td>`;
  }

  // Saved bid: prominent chip; click to quick-edit
  return `<td class="bid-wrap">
    <div class="bid-chip" data-id="${l.id}" title="Click to update"
         style="display:inline-block;background:var(--brand-pale);border:1.5px solid var(--brand);border-radius:var(--r);padding:4px 10px;cursor:pointer;">
      <div style="font-size:16px;font-weight:800;color:var(--brand-dark);line-height:1.1;">$${esc(l.highBid)}</div>
      <div style="font-size:11px;color:var(--text-mid);">${esc(l.highBidBy || 'Unknown buyer')}
        <span style="color:${offerAgeColor(l.highBidAt)};font-weight:700;"> · ${offerAge(l.highBidAt) || 'no time'}</span>
      </div>
    </div>
  </td>`;
}

async function saveQuickBid(lotId, amount, by) {
  const l = getLot(lotId);
  if (!l) return;
  if (!amount || isNaN(+amount)) { toast('Enter a bid amount', true); return; }
  try {
    const saved = await updateLot(l.id, {
      highBid: String(amount),
      highBidBy: by || '',
      highBidAt: new Date().toISOString()
    });
    upsertLot(saved);
    logActivity(l.id, `High bid $${amount}${by ? ' from ' + by : ''}`, getUserDisplayName());
    _qbEditing = null;
    rerenderCurrentPage();
    toast('High bid recorded');
  } catch (e) {
    toast(e.message || 'Failed to save bid', true);
  }
}

// Delegated events for quick bid entry (survives table re-renders)
(function () {
  function ctx(el) {
    const box = el.closest('.quick-bid');
    if (!box) return null;
    return {
      id: +box.dataset.id,
      amt: box.querySelector('.qb-amt')?.value.trim(),
      by: box.querySelector('.qb-by')?.value.trim()
    };
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (!e.target.classList) return;
    if (e.target.classList.contains('qb-amt') || e.target.classList.contains('qb-by')) {
      const c = ctx(e.target);
      if (c) { e.preventDefault(); saveQuickBid(c.id, c.amt, c.by); }
    }
  });
  document.addEventListener('click', (e) => {
    const save = e.target.closest('.qb-save');
    if (save) { const c = ctx(save); if (c) saveQuickBid(c.id, c.amt, c.by); return; }
    const time = e.target.closest('.qb-time');
    if (time) { const c = ctx(time); if (c) { _qbEditing = null; showBidModal(c.id); } return; }
    const chip = e.target.closest('.bid-chip');
    if (chip) {
      _qbEditing = +chip.dataset.id;
      rerenderCurrentPage();
      // focus the amount box of the newly opened editor
      setTimeout(() => {
        document.querySelector(`.quick-bid[data-id="${chip.dataset.id}"] .qb-amt`)?.focus();
      }, 30);
    }
  });
})();

function showBidModal(lotId) {
  const l = getLot(lotId);
  if (!l) return;
  document.getElementById('bid-modal-overlay')?.remove();
  const nowLocal = (() => {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })();
  const existingAt = l.highBidAt ? (() => {
    const d = new Date(l.highBidAt); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  })() : nowLocal;

  const wrap = document.createElement('div');
  wrap.id = 'bid-modal-overlay';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(19,24,32,.55);z-index:2000;display:flex;align-items:center;justify-content:center;';
  wrap.innerHTML = `
    <div style="background:var(--surface);border-radius:var(--rl);box-shadow:var(--s3);padding:22px;width:340px;max-width:92vw;">
      <div style="font-weight:800;font-size:16px;margin-bottom:2px;">Record High Bid — Lot ${esc(l.lot)}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">${esc(l.con || '')}</div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Bid amount ($/cwt)</label>
      <input id="bid-amount" type="number" step="0.01" min="0" value="${esc(l.highBid || '')}"
             style="width:100%;padding:8px 10px;border:1px solid var(--border-mid);border-radius:var(--r);font:inherit;margin-bottom:12px;">
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">Who made the offer</label>
      <input id="bid-by" type="text" value="${esc(l.highBidBy || '')}" placeholder="Buyer name"
             style="width:100%;padding:8px 10px;border:1px solid var(--border-mid);border-radius:var(--r);font:inherit;margin-bottom:12px;">
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;">When the offer was made</label>
      <input id="bid-at" type="datetime-local" value="${existingAt}"
             style="width:100%;padding:8px 10px;border:1px solid var(--border-mid);border-radius:var(--r);font:inherit;margin-bottom:16px;">
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" id="bid-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="bid-save">Save Bid</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  document.getElementById('bid-cancel').addEventListener('click', () => wrap.remove());
  document.getElementById('bid-amount').focus();
  document.getElementById('bid-save').addEventListener('click', async () => {
    const amount = document.getElementById('bid-amount').value.trim();
    const by = document.getElementById('bid-by').value.trim();
    const atLocal = document.getElementById('bid-at').value;
    if (!amount || isNaN(+amount)) { toast('Enter a bid amount', true); return; }
    const atIso = atLocal ? new Date(atLocal).toISOString() : new Date().toISOString();
    try {
      const saved = await updateLot(l.id, { highBid: amount, highBidBy: by, highBidAt: atIso });
      upsertLot(saved);
      logActivity(l.id, `High bid $${amount}${by ? ' from ' + by : ''}`, getUserDisplayName());
      wrap.remove();
      rerenderCurrentPage();
      toast('High bid recorded');
    } catch (e) {
      toast(e.message || 'Failed to save bid', true);
    }
  });
}

function downloadSingleLotCSV(lot) {
  downloadCSV([lot], `BidPath_${lot.lot}_${new Date().toISOString().split('T')[0]}.csv`);
}

function downloadStagedCSV(lots) {
  const staged = lots.filter(l => l.status === 'Staged');
  downloadCSV(staged, `BidPath_Staged_${new Date().toISOString().split('T')[0]}.csv`);
}

function downloadSelectedCSV(lots, ids) {
  const selected = lots.filter(l => ids.includes(l.id));
  downloadCSV(selected, `BidPath_Selected_${new Date().toISOString().split('T')[0]}.csv`);
}


// ── DOCUMENTS ───────────────────────────────────────────────
// ============================================================
// CMS COUNTRY PAGE MANAGER — DOCUMENTS MODULE
// Listing confirmations, trade confirmations, contracts
// ============================================================



const { blue, navy, gold, steel, teal } = DOC_COLORS;

function docHdr(auctionName, auctionDate) {
  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:18px;margin-bottom:18px;border-bottom:3px solid ${blue};">
      <div>
        <div style="font-size:22px;font-weight:800;color:${navy};letter-spacing:-0.5px;">${COMPANY.name}</div>
        <div style="font-size:11px;color:#666;margin-top:3px;">${COMPANY.address} &bull; ${COMPANY.city} &bull; ${COMPANY.phone}</div>
      </div>
      ${auctionName ? `<div style="text-align:right;">
        <div style="font-size:13px;font-weight:700;color:${blue};">${auctionName}</div>
        ${auctionDate ? `<div style="font-size:11px;color:#666;">${auctionDate}</div>` : ''}
      </div>` : ''}
    </div>`;
}

function docSection(title, rows) {
  const rowsHtml = rows.filter(Boolean).map(([label, value]) => `
    <tr>
      <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.6px;width:38%;border-bottom:1px solid #f0f0f0;">${label}</td>
      <td style="padding:6px 10px;font-size:13px;color:#1a2332;border-bottom:1px solid #f0f0f0;">${value || '—'}</td>
    </tr>`).join('');
  return `
    <div style="margin-bottom:20px;">
      <div style="font-size:10px;font-weight:700;color:${blue};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid ${blue};">${title}</div>
      <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
    </div>`;
}

const PRINT_CSS = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Source Sans 3', sans-serif; font-size: 13px; color: #1a2332; background: #fff; }
    .doc-wrap { max-width: 780px; margin: 0 auto; padding: 32px; }
    .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
    .sig-line { border-bottom: 1px solid #333; margin-bottom: 4px; height: 28px; }
    .sig-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: .6px; }
    .doc-title { font-size: 18px; font-weight: 800; color: ${navy}; margin-bottom: 20px; }
    .notice { background: #f8f9fa; border-left: 3px solid ${blue}; padding: 10px 14px; font-size: 11.5px; color: #444; margin: 16px 0; }
    @media print { body { margin: 0; } .doc-wrap { padding: 0.4in 0.5in; } }
  </style>`;

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

function fmtTime(t) {
  if (!t) return '';
  try {
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'} CT`;
  } catch { return t; }
}

// ── DOCUMENTS MODULE ─────────────────────────────────────────
// Rebuilt to match CMS PDF format from production examples

const DOC_CSS = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Source Sans 3',sans-serif;font-size:12px;color:#1a2332;background:#fff;}
    .doc{max-width:900px;margin:0 auto;padding:28px 32px;}
    .doc-hdr{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:14px;margin-bottom:16px;border-bottom:3px solid #336699;}
    .doc-hdr-left{}
    .doc-entity{font-size:15px;font-weight:800;color:#1e2d4a;letter-spacing:-.3px;}
    .doc-auction{font-size:11px;color:#4a5568;margin-top:3px;}
    .doc-title{font-size:13px;font-weight:700;color:#336699;margin-top:8px;text-transform:uppercase;letter-spacing:.5px;}
    .doc-hdr-right{text-align:right;}
    .doc-co{font-size:13px;font-weight:700;color:#1e2d4a;}
    .doc-addr{font-size:10px;color:#718096;line-height:1.6;margin-top:2px;}
    .lot-block{margin-bottom:14px;border:1px solid #d0d9e8;border-radius:6px;overflow:hidden;}
    .lot-hdr{padding:9px 14px 8px;color:#fff;font-weight:700;font-size:11.5px;display:flex;justify-content:space-between;align-items:baseline;}
    .lot-breed{padding:4px 14px 6px;color:#fff;font-size:10px;opacity:.9;}
    .lot-grid{display:grid;background:#fff;border-top:1px solid rgba(255,255,255,.25);}
    .lot-grid-header{display:grid;background:rgba(0,0,0,.06);padding:4px 0;}
    .lot-grid-values{display:grid;padding:4px 0;}
    .gc{text-align:center;padding:3px 4px;}
    .gc-label{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#4a5568;}
    .gc-val{font-size:11px;font-weight:600;color:#1a2332;margin-top:2px;}
    .lot-notes{padding:7px 14px;background:#f8f9fb;border-top:1px solid #e2e8f0;font-size:10px;color:#4a5568;line-height:1.5;}
    .cms-notes{padding:6px 14px;background:#fff8e1;border-top:1px solid #f6c96b;font-size:10px;font-weight:700;color:#7a5010;}
    .dm-row{padding:6px 14px;background:#f0f4f9;border-top:1px solid #d0d9e8;font-size:11px;font-weight:700;color:#1e2d4a;display:flex;justify-content:space-between;}
    .footer-block{margin-top:20px;padding-top:16px;border-top:2px solid #336699;font-size:9.5px;color:#4a5568;display:grid;grid-template-columns:1fr 1fr;gap:20px;}
    .sig-block{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:28px;padding-top:16px;border-top:1px solid #d0d9e8;}
    .sig-line{border-bottom:1px solid #333;height:28px;margin-bottom:4px;}
    .sig-label{font-size:9.5px;color:#718096;text-transform:uppercase;letter-spacing:.5px;}
    .contract-box{border:1px solid #d0d9e8;border-radius:4px;overflow:hidden;margin-bottom:10px;}
    .contract-section{background:#e8eef6;padding:6px 12px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#336699;border-bottom:1px solid #d0d9e8;}
    .contract-row{display:grid;grid-template-columns:140px 1fr;border-bottom:1px solid #e8eef0;}
    .contract-row:last-child{border-bottom:none;}
    .cr-label{padding:7px 12px;font-size:10px;font-weight:600;color:#718096;background:#f8f9fb;border-right:1px solid #e8eef0;}
    .cr-val{padding:7px 12px;font-size:11px;color:#1a2332;}
    .price-row{background:#e8eef6;}
    .price-row .cr-val{font-size:14px;font-weight:800;color:#1e2d4a;}
    .terms{font-size:9px;color:#4a5568;line-height:1.7;margin-top:14px;}
    .terms p{margin-bottom:6px;}
    .terms strong{font-weight:700;color:#1e2d4a;}
    @media print{body{margin:0;}.doc{padding:.4in .5in;}}
  </style>`;

function fmtD(d) {
  if (!d) return '';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'}); }
  catch(e) { return d; }
}

function lotColorHex(l) {
  const hay = ((l.type||'') + ' ' + (l.breed||'')).toLowerCase();
  if (hay.includes('charolais')) return '#C9A66B';
  if (hay.includes('holstein')) return '#6F8FAF';
  if (hay.includes('native')) return '#3FA796';
  if (hay.includes('black x') || hay.includes('beef on dairy') || hay.includes('blackx')) return '#202E4A';
  return '#336699';
}

function consignorColorHex(name) {
  const palette = ['#202E4A','#336699','#3FA796','#6F8FAF','#C9A66B'];
  let h = 0;
  for (let i=0; i<(name||'').length; i++) { h = ((h<<5)-h) + name.charCodeAt(i); h |= 0; }
  return palette[Math.abs(h) % palette.length];
}

function docHeader(entityLabel, entityName, docTitle, auctionName, auctionDate) {
  return `
    <div class="doc-hdr">
      <div class="doc-hdr-left">
        <div class="doc-entity">${entityLabel}: ${entityName}</div>
        ${auctionName ? `<div class="doc-auction">${auctionName}${auctionDate ? ' &bull; ' + auctionDate : ''}</div>` : ''}
        <div class="doc-title">${docTitle}</div>
      </div>
      <div class="doc-hdr-right">
        <div class="doc-co">CMS Livestock Auction</div>
        <div class="doc-addr">6900 I-40 West, Suite 135<br>Amarillo, TX 79106<br>(806) 355-7505</div>
      </div>
    </div>`;
}

function gridCols(columns) {
  return `grid-template-columns:${columns.map(c => c.w+'px').join(' ')};`;
}

function lotBlock(l, mode, showBuyer, showCmsNotes) {
  const color = mode === 'rep' ? consignorColorHex(l.con) : lotColorHex(l);
  const textColor = color === '#C9A66B' ? '#3a2800' : '#fff';
  const lotNum = l.lot || '—';
  const cols = [
    {label:'Loads', val:l.loads||'—', w:55},
    {label:'Head', val:l.head||'—', w:55},
    {label:'Sex', val:(l.sex||'').replace(/\n/g,' / ')||'—', w:100},
    {label:'Base Wt', val:l.wt ? l.wt+'#' : '—', w:75},
    {label:'Delivery', val:l.del||'—', w:160},
    {label:'Location', val:l.loc||'—', w:130},
    {label:'Shrink', val:l.shrink||'—', w:65},
    {label:'Slide', val:l.slide||'—', w:160},
  ];
  // Price NOT in grid - it shows in the summary row below

  const gs = `display:grid;${gridCols(cols)}`;
  const notes = [l.notes, l.secondDesc].filter(Boolean).join(' | ');
  const cmsExtNotes = showCmsNotes && l.cmsExtNotes ? l.cmsExtNotes : '';
  const cmsIntNotes = ''; // Internal notes only appear in contract details, never in confirmations

  return `
    <div class="lot-block">
      <div class="lot-hdr" style="background:${color};color:${textColor};">
        <span>Lot # ${esc(lotNum)} — ${esc(l.con)||'—'}</span>
        ${mode==='rep' ? `<span style="font-size:10px;opacity:.85;">${esc(l.sale||'')}</span>` : ''}
      </div>
      <div class="lot-breed" style="background:${color};">${esc(l.breed||'')}</div>
      <div style="${gs};border-top:1px solid #e2e8f0;">
        ${cols.map(col => `<div class="gc" style="border-right:1px solid #e2e8f0;"><div class="gc-label">${col.label}</div></div>`).join('')}
      </div>
      <div style="${gs};background:#fff;">
        ${cols.map(col => `<div class="gc" style="border-right:1px solid #e2e8f0;padding-bottom:8px;"><div class="gc-val">${esc(col.val)}</div></div>`).join('')}
      </div>
      ${notes ? `<div class="lot-notes"><strong>Notes:</strong> ${esc(notes)}</div>` : ''}
      ${cmsExtNotes ? `<div class="cms-notes">CMS External Notes: ${esc(cmsExtNotes)}</div>` : ''}
      ${cmsIntNotes ? `<div class="cms-notes" style="background:#ffeaea;border-color:#f4a49e;color:#7a1f18;">CMS Internal Notes: ${esc(cmsIntNotes)}</div>` : ''}
      ${l.price ? `<div class="dm-row"><span>Price: ${l.price==='PO'?'PO (Pass Out)':'$'+esc(l.price)+'/cwt'}</span>${l.down && l.down !== '0' ?`<span>Down Money Due: $${esc(l.down)}</span>`:''}</div>` : ''}
    </div>`;
}

// ── LISTING CONFIRMATION ──────────────────────────────────────

function listingConfirmHTML(l, mode, auctionName, auctionDate) {
  const isRep = mode === 'rep';
  const entityLabel = isRep ? 'Rep' : 'Consignor';
  const entityName = isRep ? (l.rep || '—') : (l.con || '—');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${DOC_CSS}</head><body>
    <div class="doc">
      ${docHeader(entityLabel, entityName, 'Listing Confirmation', auctionName, auctionDate)}
      ${lotBlock(l, mode, false, isRep)}
    </div></body></html>`;
}

// ── TRADE CONFIRMATION ────────────────────────────────────────

function tradeConfirmHTML(l, mode, auctionName, auctionDate, hideBuyer) {
  // Buyer is NEVER shown on rep or consignor trade confirmations
  const isRep = mode === 'rep';
  const entityLabel = isRep ? 'Rep' : 'Consignor';
  const entityName = isRep ? (l.rep || '—') : (l.con || '—');
  const showCmsNotes = isRep;
  const soldInfo = l.soldDate ? `<div style="margin-top:10px;padding:7px 14px;background:#f0f4f9;border-radius:4px;font-size:11px;color:#4a5568;">Sold: ${esc(fmtD(l.soldDate))}</div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${DOC_CSS}</head><body>
    <div class="doc">
      ${docHeader(entityLabel, entityName, 'Trade Confirmation', auctionName, auctionDate)}
      ${lotBlock(l, mode, false, showCmsNotes)}
      ${soldInfo}
    </div></body></html>`;
}

// ── BUYER CONTRACT ────────────────────────────────────────────

function buyersContractHTML(l, auctionName, auctionDate) {
  const terms = `All cattle shall be in good physical condition and shall be free of any defects including but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances. Buyer hereby grants a purchase money security interest in the above-described cattle to CMS Livestock Auction to secure full payment and collection of the purchase price.
Buyer does hereby agree to a down payment of $30.00 per head if delivery date is more than 30 days past the auction date as good faith money to be applied at the time of delivery.
Buyer does hereby agree to payment by wire transfer the day following delivery of the cattle or by overnight carrier at Buyer's expense. Payments if sent overnight shall be sent to: CMS Livestock Auction, 6900 I-40 West, Suite 135, Amarillo, TX 79106.
The CMS Livestock Auction Video Auction Terms of Service Agreement as stated in auction registration and participation are incorporated by reference into this contract.`;

  const loc = l.loc ? `FOB, ${esc(l.loc)}` : '—';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${DOC_CSS}</head><body>
    <div class="doc">
      ${docHeader('Buyer', l.buyer||'—', 'Buyer Cattle Sales Contract', auctionName, auctionDate)}
      <div style="font-size:11px;color:#4a5568;margin-bottom:12px;">CMS Livestock Auction does hereby confirm the following cattle were purchased on the <strong>CMS Country Market</strong> and the buyer listed below agrees to the purchase of the following livestock:</div>
      
      <div style="background:#e8eef6;border:1px solid #c5d4e8;border-radius:4px;padding:10px 14px;margin-bottom:12px;">
        ${l.lot ? `<div style="font-size:13px;font-weight:800;color:#1e2d4a;">Lot # ${esc(l.lot)} — ${esc(l.con) || '—'}</div>` : ''}
        <div style="font-size:11.5px;color:#4a5568;margin-top:3px;">${esc(l.breed) || ''}</div>
      </div>

      <div class="contract-box">
        <div class="contract-section">Quantity & Description</div>
        <div class="contract-row"><div class="cr-label">Loads</div><div class="cr-val">${esc(l.loads) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Head Count</div><div class="cr-val">${esc(l.head) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Sex</div><div class="cr-val">${esc((l.sex||'').replace(/\n/g,' / '))||'—'}</div></div>
        <div class="contract-row"><div class="cr-label">Base Weight</div><div class="cr-val">${l.wt ? esc(l.wt)+' lbs' : '—'}</div></div>
      </div>

      <div class="contract-box">
        <div class="contract-section">Terms</div>
        <div class="contract-row"><div class="cr-label">Delivery</div><div class="cr-val">${esc(l.del) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Location</div><div class="cr-val">${loc}</div></div>
        <div class="contract-row"><div class="cr-label">Shrink</div><div class="cr-val">${esc(l.shrink) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Slide</div><div class="cr-val">${esc(l.slide) || '—'}</div></div>
        <div class="contract-row price-row"><div class="cr-label">Purchase Price</div><div class="cr-val">${l.price && l.price!=='PO' ? '$'+esc(l.price)+'/cwt' : esc(l.price)||'—'}</div></div>
      </div>

      ${esc(l.notes) || l.secondDesc ? `<div class="contract-box"><div class="contract-section">Notes</div><div style="padding:8px 12px;font-size:10px;color:#4a5568;">${esc([l.notes,l.secondDesc].filter(Boolean).join(' | '))}</div></div>` : ''}
      ${l.down ? `<div style="background:#fff8e1;border:1px solid #f6c96b;border-radius:4px;padding:8px 12px;font-size:11px;font-weight:700;color:#7a5010;margin-bottom:10px;">Down Money Due: $${esc(l.down)}</div>` : ''}

      <div class="terms">${terms.split('\\n').map(p => `<p>${esc(p)}</p>`).join('')}</div>

      <div class="sig-block">
        <div><div class="sig-line"></div><div class="sig-label">Buyer Signature / Date</div></div>
        <div><div class="sig-line"></div><div class="sig-label">CMS Livestock Auction / Date</div></div>
      </div>
    </div></body></html>`;
}

// ── SELLER CONTRACT ───────────────────────────────────────────

function sellersContractHTML(l, auctionName, auctionDate) {
  const terms = `All cattle shall be in good physical condition and shall be free of any defects including but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller agrees to deliver the above-described cattle to Buyer as sold through CMS Livestock Auction on the agreed-upon delivery date. Seller further agrees that once cattle are sold through CMS Livestock Auction, Seller shall not sell, transfer, or otherwise dispose of the cattle to any party other than the Buyer prior to the delivery date without written consent from CMS Livestock Auction.
Seller represents and warrants that all information provided regarding the cattle, including weight, breed, age, and health status, is accurate to the best of Seller's knowledge.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.
The CMS Livestock Auction Seller's Terms of Service Agreement as signed prior to the auction are incorporated by reference into this contract.`;

  const loc = l.loc ? `FOB, ${esc(l.loc)}` : '—';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${DOC_CSS}</head><body>
    <div class="doc">
      ${docHeader('Consignor', l.con||'—', 'Seller Cattle Sales Contract', auctionName, auctionDate)}
      <div style="font-size:11px;color:#4a5568;margin-bottom:12px;">CMS Livestock Auction confirms the following cattle were sold on the <strong>CMS Country Market</strong>:</div>

      <div style="background:#e8eef6;border:1px solid #c5d4e8;border-radius:4px;padding:10px 14px;margin-bottom:12px;">
        ${l.lot ? `<div style="font-size:13px;font-weight:800;color:#1e2d4a;">Lot # ${esc(l.lot)} — ${esc(l.con) || '—'}</div>` : ''}
        <div style="font-size:11.5px;color:#4a5568;margin-top:3px;">${esc(l.breed) || ''}</div>
      </div>

      <div class="contract-box">
        <div class="contract-section">Quantity & Description</div>
        <div class="contract-row"><div class="cr-label">Loads</div><div class="cr-val">${esc(l.loads) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Head Count</div><div class="cr-val">${esc(l.head) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Sex</div><div class="cr-val">${esc((l.sex||'').replace(/\n/g,' / '))||'—'}</div></div>
        <div class="contract-row"><div class="cr-label">Base Weight</div><div class="cr-val">${l.wt ? esc(l.wt)+' lbs' : '—'}</div></div>
      </div>

      <div class="contract-box">
        <div class="contract-section">Terms</div>
        <div class="contract-row"><div class="cr-label">Delivery</div><div class="cr-val">${esc(l.del) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Location</div><div class="cr-val">${loc}</div></div>
        <div class="contract-row"><div class="cr-label">Shrink</div><div class="cr-val">${esc(l.shrink) || '—'}</div></div>
        <div class="contract-row"><div class="cr-label">Slide</div><div class="cr-val">${esc(l.slide) || '—'}</div></div>
        <div class="contract-row price-row"><div class="cr-label">Purchase Price</div><div class="cr-val">${l.price && l.price!=='PO' ? '$'+esc(l.price)+'/cwt' : esc(l.price)||'—'}</div></div>
      </div>

      ${esc(l.notes) || l.secondDesc ? `<div class="contract-box"><div class="contract-section">Notes</div><div style="padding:8px 12px;font-size:10px;color:#4a5568;">${esc([l.notes,l.secondDesc].filter(Boolean).join(' | '))}</div></div>` : ''}

      <div class="terms">${terms.split('\\n').map(p => `<p>${esc(p)}</p>`).join('')}</div>

      <div class="sig-block">
        <div><div class="sig-line"></div><div class="sig-label">Seller / Consignor Signature / Date</div></div>
        <div><div class="sig-line"></div><div class="sig-label">CMS Livestock Auction / Date</div></div>
      </div>
    </div></body></html>`;
}

// ── BUYER RECAP ───────────────────────────────────────────────

function buyerRecapHTML(l, auctionName, auctionDate) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${DOC_CSS}</head><body>
    <div class="doc">
      ${docHeader('Buyer', l.buyer||'—', 'Buyer Recap & Down Money Invoice', auctionName, auctionDate)}
      ${lotBlock(l, 'buyer', true, false)}
      ${l.down ? `<div class="dm-row" style="background:#fff8e1;border-color:#f6c96b;color:#7a5010;margin-top:-1px;">Down Money Due: $${esc(l.down)}</div>` : ''}
      <div style="margin-top:20px;padding-top:14px;border-top:2px solid #336699;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#336699;margin-bottom:10px;">REMIT TO CMS LIVESTOCK AUCTION VIA WIRE TRANSFER, ACH, OR OVERNIGHT DELIVERY</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;font-size:9.5px;color:#4a5568;line-height:1.7;">
          <div><strong>PLEASE INCLUDE BUYER NAME AND LOT NUMBERS ON PAYMENT</strong><br>Wire Instructions for CMS Livestock Auction<br><br>Send Overnight Payments to:<br>CMS Livestock Auction<br>6900 I-40 West, Suite 135<br>Amarillo, TX 79106</div>
          <div>Wire funds to:<br>Happy State Bank<br>200 Main Street, Canadian, TX 79014<br><br>Contact our office at (806) 355-7505<br>or CMSCattleAuctions@gmail.com<br>for account and routing number</div>
        </div>
      </div>
    </div></body></html>`;
}


// ── CONTRACT DETAILS ─────────────────────────────────────────

function contractDetailsHTML(l, auctionName, auctionDate) {
  const loc = l.loc ? `FOB, ${esc(l.loc)}` : '—';
  const price = l.price === 'PO' ? 'PO' : (l.price ? `$${esc(l.price)}/cwt` : '—');
  const notes = [l.notes, l.secondDesc].filter(Boolean).join(' | ');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${DOC_CSS}
  <style>
    .cd-page { max-width: 920px; margin: 0 auto; padding: 24px 32px; }
    .cd-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
    .cd-top-left .cd-title { font-size:20px; font-weight:800; color:#1e2d4a; }
    .cd-top-left .cd-auction { font-size:11px; color:#4a5568; margin-top:4px; }
    .cd-top-right { text-align:right; }
    .cd-contract-num { font-size:16px; font-weight:800; color:#336699; }
    .cd-co { font-size:11px; font-weight:700; color:#1e2d4a; margin-top:4px; }
    .cd-addr { font-size:9.5px; color:#718096; line-height:1.6; }
    .cd-parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
    .cd-party { background:#e8eef6; border:1px solid #c5d4e8; border-radius:6px; padding:10px 14px; }
    .cd-party-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:#336699; margin-bottom:3px; }
    .cd-party-name { font-size:13px; font-weight:800; color:#1e2d4a; }
    .cd-lot-hdr { border-radius:6px 6px 0 0; padding:10px 14px 8px; display:flex; justify-content:space-between; align-items:baseline; }
    .cd-breed { padding:3px 14px 8px; font-size:10.5px; opacity:.9; }
    .cd-grid-wrap { border:1px solid #d0d9e8; border-radius:0 0 6px 6px; overflow:hidden; }
    .cd-grid { display:grid; grid-template-columns:55px 55px 100px 75px 160px 130px 65px 1fr 75px; }
    .cd-gh { background:#e8eef6; border-bottom:1px solid #d0d9e8; }
    .cd-gh div, .cd-gv div { text-align:center; padding:4px 3px; border-right:1px solid #d0d9e8; }
    .cd-gh div:last-child, .cd-gv div:last-child { border-right:none; }
    .cd-gh div { font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:#4a5568; }
    .cd-gv div { font-size:11px; font-weight:600; color:#1a2332; padding:6px 3px; }
    .cd-notes { padding:7px 14px; background:#f8f9fb; border-top:1px solid #e2e8f0; font-size:10px; color:#4a5568; line-height:1.5; }
    .cd-price-row { display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#e8eef6; border-top:2px solid #336699; font-weight:800; color:#1e2d4a; }
    .cd-price-val { font-size:16px; color:#336699; }
    .cd-dm { padding:7px 14px; background:#fff8e1; border-top:1px solid #f6c96b; font-size:11px; font-weight:700; color:#7a5010; }
    .cd-dm-received { margin-top:16px; display:flex; align-items:center; gap:12px; }
    .cd-checkbox { width:14px; height:14px; border:1.5px solid #333; flex-shrink:0; }
    .cd-sign-line { flex:1; border-bottom:1px solid #333; height:20px; }
  </style>
  </head><body>
  <div class="cd-page">

    <div class="cd-top">
      <div class="cd-top-left">
        <div class="cd-title">Contract Details</div>
        <div class="cd-auction">${auctionName || ''}${auctionDate ? ' &bull; ' + auctionDate : ''}</div>
      </div>
      <div class="cd-top-right">
        <div class="cd-contract-num">Contract # ${esc(l.lot) || '—'}</div>
        <div class="cd-co">CMS Livestock Auction</div>
        <div class="cd-addr">6900 I-40 West, Suite 135<br>Amarillo, TX 79106<br>(806) 355-7505</div>
      </div>
    </div>

    <div class="cd-parties">
      <div class="cd-party">
        <div class="cd-party-label">Buyer</div>
        <div class="cd-party-name">${esc(l.buyer) || '—'}</div>
      </div>
      <div class="cd-party">
        <div class="cd-party-label">Consignor</div>
        <div class="cd-party-name">${esc(l.con) || '—'}</div>
      </div>
    </div>

    <div>
      <div class="cd-lot-hdr" style="background:${lotColorHex(l)};color:${lotColorHex(l)==='#C9A66B'?'#3a2800':'#fff'};">
        <span style="font-size:12px;font-weight:800;">Lot # ${esc(l.lot) || '—'}</span>
        <span style="font-size:10px;opacity:.8;">${esc(l.sale) || ''}</span>
      </div>
      <div class="cd-breed" style="background:${lotColorHex(l)};color:${lotColorHex(l)==='#C9A66B'?'#3a2800':'#fff'};">${esc(l.breed) || ''}</div>
      <div class="cd-grid-wrap">
        <div class="cd-grid cd-gh">
          <div><div>Loads</div></div>
          <div><div>Head</div></div>
          <div><div>Sex</div></div>
          <div><div>Base Wt</div></div>
          <div><div>Delivery</div></div>
          <div><div>Location</div></div>
          <div><div>Shrink</div></div>
          <div><div>Slide</div></div>
          <div><div>Price</div></div>
        </div>
        <div class="cd-grid cd-gv">
          <div><div>${esc(l.loads) || '—'}</div></div>
          <div><div>${esc(l.head) || '—'}</div></div>
          <div><div>${esc((l.sex || '').replace(/\n/g, ' / ')) || '—'}</div></div>
          <div><div>${l.wt ? esc(l.wt) + '#' : '—'}</div></div>
          <div><div>${esc(l.del) || '—'}</div></div>
          <div><div>${loc}</div></div>
          <div><div>${esc(l.shrink) || '—'}</div></div>
          <div><div>${esc(l.slide) || '—'}</div></div>
          <div><div style="font-weight:800;color:#336699;">${price}</div></div>
        </div>
      </div>
      ${notes ? `<div class="cd-notes"><strong>Notes:</strong> ${notes}</div>` : ''}
      ${l.cmsIntNotes ? `<div class="cd-notes" style="background:#ffeaea;color:#7a1f18;border-top:1px solid #f4a49e;"><strong>CMS Internal Notes:</strong> ${esc(l.cmsIntNotes)}</div>` : ''}

      <div class="cd-price-row">
        <span>Purchase Price</span>
        <span class="cd-price-val">${price}</span>
      </div>

      <div class="cd-dm">
        Down Money Due: ${l.down && l.down !== '0' ? '$' + esc(l.down) : '$0.00'}
      </div>

      ${l.down && l.down !== '0' ? `
      <div class="cd-dm-received">
        <div class="cd-checkbox"></div>
        <span style="font-size:11px;font-weight:700;">Down Money Received</span>
        <span style="font-size:10px;margin-left:20px;">Initials: </span>
        <div class="cd-sign-line" style="max-width:80px;"></div>
        <span style="font-size:10px;margin-left:20px;">Date: </span>
        <div class="cd-sign-line" style="max-width:100px;"></div>
      </div>` : ''}

    </div>
  </div>
  </body></html>`;
}

function printHTML(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:99999;';
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1500);
  };
  iframe.src = url;
}

function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'document.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── GET ALL DOCS FOR A LOT ────────────────────────────────────

function getDocsForLot(l, auctionName, auctionDate, userIsAdmin) {
  const docs = [];
  const isSold = ['Sold', 'Waiting to Ship'].includes(l.status);
  const isActive = l.status === 'Active';
  const isStaged = l.status === 'Staged';

  if (isStaged || isActive) {
    docs.push({ label: 'Consignor Listing Conf.', html: () => listingConfirmHTML(l, 'consignor', auctionName, auctionDate) });
    docs.push({ label: 'Rep Listing Conf.', html: () => listingConfirmHTML(l, 'rep', auctionName, auctionDate) });
  }
  const hasSaleData = l.price && (isSold || l.soldDate);
  if (isSold || hasSaleData) {
    docs.push({ label: 'Contract Details', html: () => contractDetailsHTML(l, auctionName, auctionDate) });
    docs.push({ label: 'Consignor Trade Conf.', html: () => tradeConfirmHTML(l, 'consignor', auctionName, auctionDate) });
    docs.push({ label: 'Rep Trade Conf.', html: () => tradeConfirmHTML(l, 'rep', auctionName, auctionDate) });
    docs.push({ label: "Buyer's Contract", html: () => buyersContractHTML(l, auctionName, auctionDate) });
    docs.push({ label: "Seller's Contract", html: () => sellersContractHTML(l, auctionName, auctionDate) });
    docs.push({ label: 'Buyer Recap', html: () => buyerRecapHTML(l, auctionName, auctionDate) });
  }
  return docs;
}


// ── APP ─────────────────────────────────────────────────────
// ============================================================
// CMS COUNTRY PAGE MANAGER — MAIN APP
// Bootstraps auth, loads data, wires everything together
// ============================================================







// ── BOOTSTRAP ────────────────────────────────────────────────

async function boot() {
  // Step 1: Set up listener for POST-boot events only (token refresh, sign-out).
  // Do NOT let it trigger loadApp on initial load — getSession() handles that.
  setupAuthListener();
  try {
    // Step 2: getSession() properly awaits session restoration from localStorage.
    // It does NOT fire SIGNED_OUT first the way onAuthStateChange does.
    const user = await getSession();
    if (!user) {
      showLogin();
      return;
    }
    // Step 3: We have a valid session — load the app.
    await loadApp();
  } catch (e) {
    console.error('[CMS] Boot error:', e);
    showBootError(String(e.message || e));
  }
}

async function loadApp() {
  if (_isLoadingApp) { console.warn('[CMS] loadApp already running'); return; }
  _isLoadingApp = true;
  showLoadingScreen();
  let step = 'startup';
  try {
    step = 'lots / consignors / settings';
    const [lots, consignors, settings] = await Promise.all([
      fetchLots(), fetchConsignors(), fetchSettings()
    ]);
    state.lots       = lots?.map ? lots.map(dbToLot) : [];
    sortLotsBySeq();
    state.consignors = consignors || [];
    state.settings   = settings  || {};
    if (isAdmin()) {
      step = 'profiles';
      state.profiles = await fetchProfiles();
    }
  } catch (e) {
    console.error('[CMS] loadApp failed at:', step, e);
    _isLoadingApp = false;
    showLoadError(step, e);
    return;
  }
  const savedTheme = localStorage.getItem('cms-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  hideLoadingScreen();
  renderApp();
  teardownRealtime();
  setupRealtime();
  _appBooted    = true;
  _isLoadingApp = false;
}

function showLoadError(step, err) {
  document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;background:#0f1520;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:#1a2235;border:1px solid #c0392b;border-radius:10px;padding:32px;max-width:520px;width:100%;">
        <div style="color:#f4a49e;font-size:18px;font-weight:700;margin-bottom:12px;">⚠ Failed to Load</div>
        <div style="color:#d4dce8;font-size:13px;margin-bottom:8px;">Could not load: <strong>${escHtml(step)}</strong></div>
        <div style="color:#9db0d0;font-size:12px;font-family:monospace;background:#0d1117;padding:10px;border-radius:6px;margin-bottom:18px;">${escHtml(err?.message || String(err))}</div>
        <div style="display:flex;gap:10px;">
          <button onclick="location.reload()" style="background:#3b82f6;border:none;color:#fff;padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;">Retry</button>
          <button onclick="showLogin()" style="background:transparent;border:1px solid #334155;color:#9db0d0;padding:10px 20px;border-radius:6px;cursor:pointer;">Back to Login</button>
        </div>
      </div>
    </div>`;
}


// ── REALTIME SYNC ─────────────────────────────────────────────


function teardownRealtime() {
  if (_lotsChannel) {
    try { getDb().removeChannel(_lotsChannel); } catch(e) { console.warn('[CMS] teardownRealtime:', e); }
    _lotsChannel = null;
  }
}

function setupRealtime() {
  // Idempotent — always tear down before re-subscribing
  teardownRealtime();
  _lotsChannel = getDb()
    .channel('lots-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, async (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const lot = dbToLot(payload.new);
        upsertLot(lot);
        if (state.ui.activeLotId === lot.id) renderLDP(lot.id);
      } else if (payload.eventType === 'DELETE') {
        removeLot(payload.old.id);
      }
      updateBadges();
      rerenderCurrentPage();
    })
    .subscribe();
}

// ── AUTH UI ───────────────────────────────────────────────────

function showLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">
          <span class="login-star">★</span>
          <div class="login-brand">CMS<span>Country Page</span></div>
        </div>
        <div class="login-title">Sign in to your account</div>
        <div class="login-subtitle">Cattle Marketing Services — Internal Tool</div>
        <div class="field" style="margin-bottom:14px;">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="field" style="margin-bottom:20px;">
          <label>Password</label>
          <input type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password">
        </div>
        <div id="login-err" class="login-err" style="display:none;"></div>
        <button class="btn btn-primary btn-full" id="login-btn">Sign In</button>
        <div class="login-footer" style="display:flex;justify-content:space-between;align-items:center;">
          <span>Access restricted to CMS team members only.</span>
          <button id="forgot-link" type="button" style="background:none;border:none;color:var(--brand-light,#60a5fa);font-size:12px;cursor:pointer;padding:0;text-decoration:underline;">Forgot password?</button>
        </div>
      </div>
    </div>`;

  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('login-pass').focus(); });
  document.getElementById('forgot-link')?.addEventListener('click', doForgotPassword);
}

async function doForgotPassword() {
  const email = document.getElementById('login-email').value.trim();
  const errEl = document.getElementById('login-err');
  const link = document.getElementById('forgot-link');
  if (!email) {
    if (errEl) { errEl.textContent = 'Enter your email address above first.'; errEl.style.display = 'block'; }
    document.getElementById('login-email')?.focus();
    return;
  }
  if (link) { link.textContent = 'Sending…'; link.style.pointerEvents = 'none'; }
  try {
    const { error } = await getDb().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
    // Replace the form with a confirmation message
    const card = document.querySelector('.login-card');
    if (card) {
      card.innerHTML = `
        <div class="login-logo">
          <span class="login-star">★</span>
          <div class="login-brand">CMS<span>Country Page</span></div>
        </div>
        <div class="login-title" style="margin-bottom:12px;">Check your email</div>
        <div style="font-size:14px;color:var(--text-muted,#9db0d0);line-height:1.6;text-align:center;">
          A password reset link has been sent to<br>
          <strong style="color:var(--text,#e6edf7);">${escHtml ? escHtml(email) : email}</strong><br><br>
          Check your inbox and follow the link to set a new password.
        </div>
        <button class="btn btn-primary btn-full" style="margin-top:24px;" onclick="showLogin()">Back to Sign In</button>
      `;
    }
  } catch(e) {
    if (link) { link.textContent = 'Forgot password?'; link.style.pointerEvents = ''; }
    if (errEl) { errEl.textContent = e.message || 'Could not send reset email. Try again.'; errEl.style.display = 'block'; }
  }
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-err');
  if (!email || !pass) { showLoginErr('Please enter your email and password.'); return; }
  btn.textContent = 'Signing in…';
  btn.disabled = true;
  err.style.display = 'none';
  try {
    await signIn(email, pass);
    await loadApp();
  } catch (e) {
    showLoginErr(e.message || 'Invalid email or password.');
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

function showLoginErr(msg) {
  const el = document.getElementById('login-err');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── APP SHELL ─────────────────────────────────────────────────

function renderApp() {
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    <div class="app-body">
      ${renderSidebar()}
      <main class="main-content" id="main-content">
        ${renderPageContent()}
      </main>
    </div>
    ${renderLDPOverlay()}
    ${renderModals()}
    <div class="toast" id="toast"></div>`;
  attachAppEvents();
  setupBuilderEvents();
  setupCSVButtons();
  updateBadges();
}

function renderHeader() {
  const profile = getCurrentProfile();
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  return `
    <header class="app-header">
      <div class="header-left">
        <button class="mob-menu-btn" id="mob-menu-btn" aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="header-brand">
          <span class="brand-star">★</span>
          <span class="brand-name">CMS</span>
          <span class="brand-sub">Country Page</span>
        </div>
      </div>
      <div class="header-search">
        <input type="text" id="global-search" placeholder="Search lots…" autocomplete="off" style="padding-left:12px;">
        <div class="search-results" id="search-results"></div>
      </div>
      <div class="header-right">
        <button class="theme-btn" id="theme-btn" title="Toggle theme">
          ${theme === 'dark' ? '☀' : '☾'}
        </button>
        <div class="user-menu" id="user-menu">
          <div class="user-avatar">${esc(getUserDisplayName().charAt(0).toUpperCase())}</div>
          <div class="user-info">
            <span class="user-name">${esc(getUserDisplayName())}</span>
            <span class="user-role">${isAdmin() ? 'Admin' : 'Rep'}</span>
          </div>
          <div class="user-dropdown" id="user-dropdown" style="display:none;">
            <button id="logout-btn">Sign Out</button>
          </div>
        </div>
      </div>
    </header>`;
}

function renderSidebar() {
  const p = state.ui.activePage;
  const counts = getBadgeCounts();
  const adminPages = isAdmin() ? `
    <a class="nav-item ${p==='consignors'?'active':''}" data-page="consignors">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      Consignors
    </a>
    <a class="nav-item ${p==='admin'?'active':''}" data-page="admin">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 5v2.5l1.5 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      Admin
    </a>` : '';

  return `
    <aside class="sidebar" id="sidebar">
      <nav class="sidebar-nav">
        <div class="nav-section-label">Overview</div>
        <a class="nav-item ${p==='dash'?'active':''}" data-page="dash">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>
          Dashboard
        </a>
        <a class="nav-item ${p==='builder'?'active':''}" data-page="builder">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1v13M1 7.5h13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          Lot Builder
        </a>
        <div class="nav-section-label" style="margin-top:16px;">Pipeline</div>
        <a class="nav-item ${p==='staged'?'active':''}" data-page="staged">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="3" width="13" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 3V2M10 3V2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Staged
          ${counts.staged ? `<span class="nav-badge">${counts.staged}</span>` : ''}
        </a>
        <a class="nav-item ${p==='active'?'active':''}" data-page="active">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 4.5v3l2 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Active
          ${counts.active ? `<span class="nav-badge nav-badge-active">${counts.active}</span>` : ''}
        </a>
        <a class="nav-item ${p==='sold'?'active':''}" data-page="sold">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2.5 7.5l3.5 3.5 6.5-6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sold
          ${counts.sold ? `<span class="nav-badge nav-badge-sold">${counts.sold}</span>` : ''}
        </a>
        <a class="nav-item ${p==='archive'?'active':''}" data-page="archive">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="4" width="13" height="10" rx="1" stroke="currentColor" stroke-width="1.4"/><path d="M1 4l2-3h9l2 3" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
          Archive
        </a>
        ${adminPages}
      </nav>
    </aside>`;
}

// ── PAGE ROUTING ──────────────────────────────────────────────

function renderPageContent() {
  switch (state.ui.activePage) {
    case 'dash':        return renderDashPage();
    case 'builder':     return renderBuilderPage();
    case 'staged':      return renderStagedPage();
    case 'active':      return renderActivePage();
    case 'sold':        return renderSoldPage();
    case 'archive':     return renderArchivePage();
    case 'consignors':  return renderConsignorsPage();
    case 'admin':       return isAdmin() ? renderAdminPage() : renderDashPage();
    default:            return renderDashPage();
  }
}

function goPage(page) {
  state.ui.activePage = page;
  document.getElementById('main-content').innerHTML = renderPageContent();
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('sidebar')?.classList.remove('open');
  // Always wire up events after any page render
  setupBuilderEvents();
  setupCSVButtons();
}

function rerenderCurrentPage() {
  const mc = document.getElementById('main-content');
  if (mc) {
    mc.innerHTML = renderPageContent();
    setupBuilderEvents();
    setupCSVButtons();
  }
}

// ── DASHBOARD ─────────────────────────────────────────────────

function renderDashPage() {
  const lots = state.lots;
  const active = lots.filter(l => l.status === 'Active');
  const staged = lots.filter(l => l.status === 'Staged');
  const waiting = lots.filter(l => l.status === 'Sold' && l.soldSt === 'waiting');
  const shipped = lots.filter(l => l.status === 'Sold' && l.soldSt === 'shipped');
  const totalHead = active.reduce((s, l) => s + (+l.head || 0), 0);
  const now48 = Date.now() + 48 * 3600000;
  const closing = active.filter(l => {
    if (!l.closeDate) return false;
    const dt = new Date(`${l.closeDate}T${l.closeTime || '17:00'}:00`);
    return dt.getTime() <= now48 && dt.getTime() > Date.now();
  });

  const fmtTime = t => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'} CT`;
  };

  const pipelineCard = (title, cls, items) => `
    <div class="pipe-col">
      <div class="pipe-header ${cls}">
        <span>${title}</span>
        <span class="pipe-count">${items.length}</span>
      </div>
      <div class="pipe-cards">
        ${items.length ? items.slice(0, 8).map(l => `
          <div class="pipe-card" data-action="open-ldp" data-id="${l.id}">
            <div class="pipe-card-lot">${esc(l.lot)}</div>
            <div class="pipe-card-con">${esc(l.con) || '—'}</div>
            <div class="pipe-card-detail">${l.head || 0} hd${l.wt ? ` · ${esc(l.wt)}#` : ''} · ${esc((l.sex || '').split('\n')[0]) || '—'}</div>
            ${l.ask ? `<div class="pipe-card-price">Ask: $${esc(l.ask)}/cwt${l.buyNow ? ` · BN: $${esc(l.buyNow)}` : ''}</div>` : ''}
            ${l.closeDate && l.status === 'Active' ? `<div class="pipe-card-close">Closes ${l.closeDate} ${fmtTime(l.closeTime)}</div>` : ''}
          </div>`).join('') : `<div class="pipe-empty">No lots</div>`}
      </div>
    </div>`;

  // Closing soon table
  const allClose = lots
    .filter(l => l.closeDate && (l.status === 'Active' || l.status === 'Staged'))
    .sort((a, b) => new Date(a.closeDate + 'T' + (a.closeTime || '17:00')).getTime() - new Date(b.closeDate + 'T' + (b.closeTime || '17:00')).getTime())
    .slice(0, 8);

  const closingRows = allClose.map(l => {
    const dt = new Date(`${l.closeDate}T${l.closeTime || '17:00'}:00`);
    const diff = dt.getTime() - Date.now();
    const totalMins = Math.floor(diff / 60000);
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const cdText = diff < 0 ? 'Closed' : days > 0 ? `${days}d ${hrs}h ${mins}m` : `${hrs}h ${mins}m`;
    const cdCls = diff < 0 ? '' : totalMins < 360 ? 'urgent' : totalMins < 1440 ? 'soon' : 'ok';
    return `<tr>
      <td><strong class="lot-link" data-action="open-ldp" data-id="${l.id}">${esc(l.lot)}</strong></td>
      <td>${esc(l.con) || '—'}</td>
      <td>${l.head || '—'}</td>
      <td>${l.ask ? '$' + esc(l.ask) : '—'}</td>
      <td>${l.buyNow ? '$' + esc(l.buyNow) : '—'}</td>
      <td>${l.closeDate} ${l.closeTime ? fmtTime(l.closeTime) : ''}</td>
      <td><span class="countdown ${cdCls}">${cdText}</span></td>
    </tr>`;
  }).join('');

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <div class="page-header-meta">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      <div class="stat-row">
        <div class="stat-card">
          <div class="stat-value">${active.length}</div>
          <div class="stat-label">Active Lots</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalHead.toLocaleString()}</div>
          <div class="stat-label">Head on Market</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${waiting.length}</div>
          <div class="stat-label">Waiting to Ship</div>
        </div>
        <div class="stat-card ${closing.length ? 'stat-warn' : ''}">
          <div class="stat-value">${closing.length}</div>
          <div class="stat-label">Closing in 48h</div>
        </div>
      </div>

      <div class="section-header"><h2>Pipeline</h2></div>
      <div class="pipeline">
        ${pipelineCard('Staged', 'pipe-staged', staged)}
        ${pipelineCard('Active', 'pipe-active', active)}
        ${pipelineCard('Waiting to Ship', 'pipe-waiting', waiting)}
        ${pipelineCard('Shipped', 'pipe-shipped', shipped)}
      </div>

      <div class="section-header" style="margin-top:28px;">
        <h2>Closing Soon</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Lot #</th><th>Consignor</th><th>Head</th><th>Asking</th><th>Buy Now</th><th>Closes</th><th>Countdown</th>
          </tr></thead>
          <tbody>${closingRows || '<tr><td colspan="6" class="empty-row">No lots with close dates set.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ── LOT BUILDER ───────────────────────────────────────────────


// ── XSS PROTECTION + RENDER HELPERS ─────────────────────────
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const escHtml = esc;  // alias used in templates and showLoadError

/** Render a status badge safely. */
function statusBadge(status) {
  const cls = esc((status || '').toLowerCase().replace(/ /g, '-'));
  return `<span class="badge badge-${cls}">${esc(status)}</span>`;
}

/** Render an empty-state block. */
function emptyState(msg, colspan) {
  return colspan
    ? `<tr><td colspan="${colspan}" class="empty-row">${esc(msg)}</td></tr>`
    : `<div class="empty-state">${esc(msg)}</div>`;
}

/** Render an error banner. */
function errorBanner(msg) {
  return `<div class="error-banner" style="color:var(--err);padding:10px;border:1px solid var(--err);border-radius:6px;margin:8px 0;">${esc(msg)}</div>`;
}

/** Render a loading block. */
function loadingBlock(label) {
  return `<div class="loading-block" style="color:var(--text-muted);padding:12px;text-align:center;">${esc(label || 'Loading…')}</div>`;
}

/** Safe table cell. */
function td(value, cls) {
  const c = cls ? ` class="${esc(cls)}"` : '';
  return `<td${c}>${esc(value ?? '—')}</td>`;
}

function suggestNextLot() {
  const lots = state.lots.filter(l => l.status === 'Staged' || l.status === 'Active');
  if (!lots.length) return '';
  // Find highest lot number and increment letter suffix
  const nums = lots.map(l => l.lot || '').filter(Boolean);
  if (!nums.length) return '';
  // Try to auto-increment last lot
  const last = [...nums].sort().pop();
  const match = last.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
  if (match) {
    const prefix = match[1], num = parseInt(match[2]), suffix = match[3];
    return prefix + (num + 1) + suffix;
  }
  return '';
}

function suggestNextSeq() {
  const lots = state.lots.filter(l => l.status === 'Staged' || l.status === 'Active');
  if (!lots.length) return '';
  const seqs = lots.map(l => parseInt(l.seq) || 0).filter(s => s > 0);
  if (!seqs.length) return '';
  return Math.max(...seqs) + 1000;
}

function renderBuilderPage() {
  const reps = state.settings['reps'] || [];
  const saleTypes = state.settings['sale_types'] || ['Timed Auction', 'Direct Bid Auction', 'Buy Now'];
  const categories = state.settings['categories'] || [];
  // Merge DB consignors with hardcoded INTEL names — deduplicated and sorted
  const intelNames = typeof INTEL !== 'undefined' ? Object.keys(INTEL) : [];
  const dbNames = state.consignors.map(c => c.name);
  const consignorNames = [...new Set([...dbNames, ...intelNames])].sort();

  const repOpts = reps.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  const saleOpts = saleTypes.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  const catOpts = categories.map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
  const conOpts = consignorNames.map(cn => `<option value="${esc(cn)}">${esc(cn)}</option>`).join('');

  // Pre-fill rep if user is a rep
  const defaultRep = isRep() ? getRepName() : '';

  return `
    <div class="page-content builder-page">
      <div class="page-header">
        <h1 class="page-title">Lot Builder</h1>
      </div>

      <form id="lot-form" autocomplete="off">
        <!-- Lot Identity -->
        <div class="form-section">
          <div class="form-section-title"><span class="section-step">1</span> Lot Identity</div>
          <div class="form-grid-4">
            <div class="field">
              <label>Lot Number <span class="req">*</span></label>
              <input type="text" id="f-lot" placeholder="e.g. C101" value="${suggestNextLot()}">
            </div>
            <div class="field">
              <label>Sequence</label>
              <input type="number" id="f-seq" placeholder="1000" value="${suggestNextSeq()}">
            </div>
            <div class="field">
              <label>Group ID <span class="field-hint">auto</span></label>
              <input type="text" id="f-gid" readonly>
            </div>
            <div class="field">
              <label>BidPath Item # <span class="field-hint">post-upload</span></label>
              <input type="text" id="f-item-num" placeholder="e.g. 126526">
            </div>
          </div>
          <div class="form-grid-3" style="margin-top:12px;">
            <div class="field">
              <label>Sale Type <span class="req">*</span></label>
              <select id="f-sale"><option value="">Select…</option>${saleOpts}</select>
            </div>
            <div class="field">
              <label>Rep</label>
              <select id="f-rep-sel" ${isRep() ? 'disabled' : ''}><option value="">Select…</option>${repOpts}</select>
              ${!isRep() ? '<input type="text" id="f-rep" placeholder="Or type name…" style="margin-top:6px;">' : `<input type="hidden" id="f-rep" value="${esc(defaultRep)}">`}
            </div>
            <div class="field">
              <label>List Date</label>
              <input type="date" id="f-date" value="${new Date().toISOString().split('T')[0]}">
            </div>
          </div>
        </div>

        <!-- Consignor -->
        <div class="form-section">
          <div class="form-section-title"><span class="section-step">2</span> Consignor</div>
          <div class="form-grid-2">
            <div class="field">
              <label>Consignor <span class="req">*</span></label>
              <div class="combo-wrap">
                <select id="f-con"><option value="">Select…</option>${conOpts}</select>
                <span class="combo-or">or</span>
                <input type="text" id="f-con-c" placeholder="Type custom…">
                <button type="button" class="btn btn-ghost btn-sm" id="new-con-btn">+ New</button>
              </div>
            </div>
            <div class="field">
              <label>Lot Type <span class="req">*</span></label>
              <select id="f-type"><option value="">Select…</option>${catOpts}</select>
            </div>
          </div>
          <div id="intel-panel" class="intel-panel" style="display:none;"></div>
        </div>

        <!-- Cattle Details -->
        <div class="form-section">
          <div class="form-section-title"><span class="section-step">3</span> Cattle Details</div>
          <div class="form-grid-3">
            <div class="field">
              <label>Loads</label>
              <input type="number" id="f-loads" placeholder="1" min="1">
            </div>
            <div class="field">
              <label>Head Count <span class="req">*</span></label>
              <input type="number" id="f-head" placeholder="e.g. 90">
            </div>
            <div class="field">
              <label>Base Weight (lbs)</label>
              <input type="text" id="f-wt" placeholder="e.g. 550">
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:12px;">
            <div class="field">
              <label>Breed / Description <span class="req">*</span></label>
              <select id="f-br"><option value="">Select…</option></select>
              <input type="text" id="f-br-c" placeholder="Or type description…" style="margin-top:6px;">
              <div id="sg-br" class="suggestion-pills"></div>
            </div>
            <div class="field">
              <label>Sex <span class="req">*</span></label>
              <select id="f-sx"><option value="">Select…</option></select>
              <textarea id="f-sx-c" placeholder="Or type sex details…" rows="2" style="margin-top:6px;"></textarea>
              <div id="sg-sx" class="suggestion-pills"></div>
            </div>
          </div>
        </div>

        <!-- Sale Settings -->
        <div class="form-section">
          <div class="form-section-title"><span class="section-step">4</span> Sale Settings</div>
          <div class="form-grid-3">
            <div class="field">
              <label>Asking Bid ($/cwt)</label>
              <input type="text" id="f-ask" placeholder="e.g. 340.00">
            </div>
            <div class="field">
              <label>Starting Bid ($/cwt)</label>
              <input type="text" id="f-startbid" placeholder="e.g. 100">
            </div>
            <div class="field">
              <label>Buy Now ($/cwt)</label>
              <input type="text" id="f-buynow" placeholder="e.g. 380.00">
            </div>
          </div>
          <div class="form-grid-4" style="margin-top:12px;">
            <div class="field">
              <label>Close Date</label>
              <input type="date" id="f-close-date">
            </div>
            <div class="field">
              <label>Close Time</label>
              <input type="time" id="f-close-time">
            </div>
            <div class="field">
              <label>Start Bid Date</label>
              <input type="date" id="f-startbid-date">
            </div>
            <div class="field">
              <label>Start Bid Time</label>
              <input type="time" id="f-startbid-time">
            </div>
          </div>
        </div>

        <!-- Delivery -->
        <div class="form-section">
          <div class="form-section-title"><span class="section-step">5</span> Delivery & Location</div>
          <div class="form-grid-2">
            <div class="field">
              <label>Delivery Window</label>
              <div class="delivery-inputs">
                <input type="date" id="f-ds">
                <span class="delivery-dash">–</span>
                <input type="date" id="f-de">
                <input type="hidden" id="f-del-raw">
              </div>
            </div>
            <div class="field">
              <label>Location</label>
              <select id="f-loc"><option value="">Select…</option></select>
              <input type="text" id="f-loc-c" placeholder="Or type location…" style="margin-top:6px;">
              <div id="sg-loc" class="suggestion-pills"></div>
            </div>
          </div>
          <div class="form-grid-3" style="margin-top:12px;">
            <div class="field">
              <label>Shrink</label>
              <input type="text" id="f-shrink" placeholder="e.g. 3%">
              <div id="sg-shrink" class="suggestion-pills"></div>
            </div>
            <div class="field" style="grid-column:span 2;">
              <label>Slide</label>
              <div class="slide-builder">
                <select id="f-sl-type">
                  <option value="">Slide type…</option>
                  <option>Traditional Slide</option>
                  <option>Dairy Slide</option>
                  <option>Custom</option>
                </select>
                <input type="text" id="f-sl-amt" placeholder="Amount (e.g. 12 Cent)">
                <select id="f-sl-dir">
                  <option value="">Direction…</option>
                  <option>Up and Down</option>
                  <option>Up Only</option>
                  <option>Down Only</option>
                </select>
                <input type="text" id="f-sl-stop" placeholder="Stop (e.g. 50# stops)">
              </div>
              <input type="text" id="f-sl-c" placeholder="Or type slide manually…" style="margin-top:6px;">
              <div id="sg-sl" class="suggestion-pills"></div>
            </div>
          </div>
        </div>

        <!-- Notes & Media -->
        <div class="form-section">
          <div class="form-section-title"><span class="section-step">6</span> Notes & Media</div>
          <div class="form-grid-2">
            <div class="field">
              <label>Lot Description (BidPath)</label>
              <textarea id="f-notes" rows="4" placeholder="Public lot description…"></textarea>
            </div>
            <div class="field">
              <label>Second Description (BidPath)</label>
              <textarea id="f-second-desc" rows="4" placeholder="Second notes for BidPath…"></textarea>
            </div>
          </div>
          <div class="form-grid-2" style="margin-top:12px;">
            <div class="field">
              <label>CMS Internal Notes <span class="field-hint">not exported</span></label>
              <textarea id="f-cms-int" rows="3" placeholder="Internal team notes…"></textarea>
            </div>
            <div class="field">
              <label>CMS External Notes <span class="field-hint">not exported</span></label>
              <textarea id="f-cms-ext" rows="3" placeholder="External notes…"></textarea>
            </div>
          </div>
        <div class="field" style="margin-top:12px;">
            <label>YouTube Embed URL</label>
            <input type="text" id="f-yt" placeholder="https://www.youtube.com/embed/…">
          </div>
          <div class="field" style="margin-top:12px;">
            <label>Listing Image Frame <span class="field-hint">real frame from the video — used in Country Page export</span></label>
            <input type="hidden" id="f-img-frame" value="2">
            <div id="f-img-frame-picker" style="display:flex;gap:8px;flex-wrap:wrap;"></div>
          </div>
        </div>
      </form>
      <div class="builder-sticky-bar">
        <button class="btn btn-ghost" id="clear-form-btn">Clear Form</button>
        <button class="btn btn-primary" id="save-lot-btn">Save to Staged</button>
      </div>
    </div>`;
}

// ── LOT TABLES ────────────────────────────────────────────────


function sortIcon(col) {
  if (state.ui.sortCol !== col) return '<span style="color:var(--text-faint);margin-left:3px;">⇅</span>';
  return state.ui.sortDir === 'asc' ? '<span style="color:var(--brand);margin-left:3px;">↑</span>' : '<span style="color:var(--brand);margin-left:3px;">↓</span>';
}
function handleSort(col) {
  if (state.ui.sortCol === col) {
    state.ui.sortDir = state.ui.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.ui.sortCol = col;
    state.ui.sortDir = 'asc';
  }
  rerenderCurrentPage();
}
function parseSortVal(val, col) {
  if (!val) return '';
  // For delivery window "January 15 - February 1", sort by start date
  if (col === 'del') {
    const part = val.split('-')[0].trim();
    const d = new Date(part + ' ' + new Date().getFullYear());
    return isNaN(d) ? val : d.toISOString();
  }
  return val;
}

function sortedByState(lots) {
  if (!state.ui.sortCol) {
    return [...lots].sort((a, b) => seqVal(a) - seqVal(b) || String(a.lot).localeCompare(String(b.lot)));
  }
  const col = state.ui.sortCol;
  const dir = state.ui.sortDir === 'asc' ? 1 : -1;
  return [...lots].sort((a, b) => {
    const av = parseSortVal(a[col] || '', col);
    const bv = parseSortVal(b[col] || '', col);
    const an = parseFloat(av), bn = parseFloat(bv);
    if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
    return av.toString().localeCompare(bv.toString()) * dir;
  });
}

function renderStagedPage() {
  const lots = sortedByState(getStagedLots());
  const sh = (label, col) => `<th class="sortable-th" data-sort="${col}" style="cursor:pointer;user-select:none;">${label}${sortIcon(col)}</th>`;

  const closeFmt = (l) => {
    if (!l.closeDate) return '—';
    const dt = new Date(`${l.closeDate}T${l.closeTime || '17:00'}:00`);
    const diff = dt.getTime() - Date.now();
    if (diff < 0) return '<span style="color:var(--text-muted);">Closed</span>';
    const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), m = Math.floor((diff%3600000)/60000);
    const txt = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
    const cls = diff < 21600000 ? 'color:var(--err);font-weight:600;' : diff < 86400000 ? 'color:var(--warn);' : 'color:var(--ok);';
    return `<span style="${cls}">${txt}</span>`;
  };


  const rows = lots.map(l => `
    <tr data-id="${l.id}" style="cursor:pointer;" onclick="if(!event.target.closest('button,select,input,.bid-wrap'))renderLDP(${l.id})">
      <td style="font-family:var(--mono);font-weight:700;color:var(--brand);">${esc(l.sale) || '—'}</td>
      <td><strong style="color:var(--brand);cursor:pointer;">${esc(l.lot)}</strong></td>
      <td style="color:var(--text-muted);">${esc(l.seq) || '—'}</td>
      <td>${esc(l.con) || '—'}</td>
      <td>${esc(l.loads) || '—'}</td>
      <td>${l.head || '—'}</td>
      <td class="col-hide-md" style="font-size:12px;max-width:160px;" title="${esc(l.breed || '')}">${esc((l.breed||'').substring(0,35))}${(l.breed||'').length>35?'…':''}</td>
      <td class="col-hide-sm">${(l.sex||'').split('\n')[0]||'—'}</td>
      <td class="col-hide-sm">${esc(l.wt)||'—'}</td>
      <td class="col-hide-md">${esc(l.del)||'—'}</td>
      <td class="col-hide-sm">${l.ask?'$'+esc(l.ask):'—'}</td>
      <td class="col-hide-sm">${l.buyNow?'$'+esc(l.buyNow):'—'}</td>
      <td class="col-hide-md">${closeFmt(l)}</td>
      
    </tr>`).join('');

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Staged <span class="page-count">${lots.length}</span></h1>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="import-csv-btn">Import Lots CSV</button>\n          <button class="btn btn-ghost btn-sm" id="csv-all-btn">Download All CSV</button>\n          <button class="btn btn-ghost btn-sm" id="cp-zip-btn">Country Page CSV + Images</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${sh('Sale Type','sale')}
            ${sh('Lot #','lot')}
            ${sh('Seq','seq')}
            ${sh('Consignor','con')}
            ${sh('Loads','loads')}
            ${sh('Head','head')}
            <th class="col-hide-md">Breed</th>
            <th class="col-hide-sm">Sex</th>
            <th class="col-hide-sm">Base Wt</th>
            <th class="col-hide-md">Delivery</th>
            <th class="col-hide-sm">Asking</th>
            <th class="col-hide-sm">Buy Now</th>
            <th class="col-hide-md">Closes</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="14" class="empty-row">No staged lots.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}


function renderActivePage() {
  const lots = sortedByState(getActiveLots());
  const sh = (label, col) => `<th class="sortable-th" data-sort="${col}" style="cursor:pointer;user-select:none;">${label}${sortIcon(col)}</th>`;

  const closeFmt = (l) => {
    if (!l.closeDate) return '—';
    const dt = new Date(`${l.closeDate}T${l.closeTime || '17:00'}:00`);
    const diff = dt.getTime() - Date.now();
    if (diff < 0) return '<span style="color:var(--text-muted);">Closed</span>';
    const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000), m = Math.floor((diff%3600000)/60000);
    const txt = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
    const cls = diff < 21600000 ? 'color:var(--err);font-weight:600;' : diff < 86400000 ? 'color:var(--warn);' : 'color:var(--ok);';
    return `<span style="${cls}">${txt}</span>`;
  };

  const rows = lots.map(l => `
    <tr data-id="${l.id}" style="cursor:pointer;" onclick="if(!event.target.closest('button,select,input,.bid-wrap'))renderLDP(${l.id})">
      <td style="font-family:var(--mono);font-weight:700;color:var(--brand);">${esc(l.sale) || '—'}</td>
      <td><strong style="color:var(--brand);">${esc(l.lot)}</strong></td>
      <td style="color:var(--text-muted);">${l.seq || '—'}</td>
      <td>${esc(l.con) || '—'}</td>
      <td>${esc(l.loads) || '—'}</td>
      <td>${l.head || '—'}</td>
      <td class="col-hide-md" style="font-size:12px;max-width:160px;">${esc((l.breed||'').substring(0,35))}${(l.breed||'').length>35?'…':''}</td>
      <td class="col-hide-sm">${(l.sex||'').split('\n')[0]||'—'}</td>
      <td class="col-hide-sm">${esc(l.wt)||'—'}</td>
      <td class="col-hide-md">${esc(l.del)||'—'}</td>
      <td class="col-hide-sm">${l.ask?'$'+esc(l.ask):'—'}</td>
      <td class="col-hide-sm">${l.buyNow?'$'+esc(l.buyNow):'—'}</td>
      ${bidCell(l)}
      <td>${closeFmt(l)}</td>
      
    </tr>`).join('');

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Active <span class="page-count">${lots.length}</span></h1>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="import-csv-btn">Import Lots CSV</button>\n          <button class="btn btn-ghost btn-sm" id="csv-all-btn">Download All CSV</button>\n          <button class="btn btn-ghost btn-sm" id="cp-zip-btn">Country Page CSV + Images</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            ${sh('Sale Type','sale')}
            ${sh('Lot #','lot')}
            ${sh('Seq','seq')}
            ${sh('Consignor','con')}
            ${sh('Loads','loads')}
            ${sh('Head','head')}
            <th class="col-hide-md">Breed</th>
            <th class="col-hide-sm">Sex</th>
            <th class="col-hide-sm">Base Wt</th>
            <th class="col-hide-md">Delivery</th>
            <th class="col-hide-sm">Asking</th>
            <th class="col-hide-sm">Buy Now</th>
            ${sh('High Bid','highBid')}
            <th class="sortable-th" data-sort="closeDate" style="cursor:pointer;user-select:none;">Closes${sortIcon('closeDate')}</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="15" class="empty-row">No active lots.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}


function renderSoldPage() {
  const sold = state.lots.filter(l => l.status === 'Sold' && l.soldSt === 'waiting');
  const shipped = state.lots.filter(l => l.status === 'Sold' && l.soldSt === 'shipped');

  const soldRows = sold.map(l => `
    <tr data-id="${l.id}">
      <td><strong class="lot-link" data-action="open-ldp" data-id="${l.id}">${esc(l.lot)}</strong></td>
      <td>${esc(l.con) || '—'}</td>
      <td>${l.head || '—'}</td>
      <td>${esc(l.wt) || '—'}</td>
      <td>${l.price && l.price !== 'PO' ? '$' + esc(l.price) + '/cwt' : esc(l.price) || '—'}</td>
      <td>${canViewBuyer() ? esc(l.buyer || '—') : '—'}</td>
      <td>${esc(l.del) || '—'}</td>
      <td>${isAdmin() ? `<button class="btn btn-xs btn-primary" data-action="mark-shipped" data-id="${l.id}">Mark Shipped</button>` : ''}</td>
    </tr>`).join('');

  const shippedRows = shipped.map(l => `
    <tr data-id="${l.id}">
      <td><strong class="lot-link" data-action="open-ldp" data-id="${l.id}">${esc(l.lot)}</strong></td>
      <td>${esc(l.con) || '—'}</td>
      <td>${l.head || '—'}</td>
      <td>${canViewBuyer() ? esc(l.buyer || '—') : '—'}</td>
      <td>${l.price && l.price !== 'PO' ? '$' + esc(l.price) + '/cwt' : esc(l.price) || '—'}</td>
      <td>${esc(l.shipDate) || '—'}</td>
      
    </tr>`).join('');

  return `
    <div class="page-content">
      <div class="page-header"><h1 class="page-title">Sold</h1></div>
      <div class="section-header"><h2>Waiting to Ship <span class="page-count">${sold.length}</span></h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Lot #</th><th>Consignor</th><th>Head</th><th>Weight</th><th>Price</th><th>Buyer</th><th class="sortable-th" data-sort="del" style="cursor:pointer;user-select:none;">Delivery${sortIcon('del')}</th><th></th></tr></thead>
          <tbody>${soldRows || '<tr><td colspan="9" class="empty-row">No lots waiting to ship.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="section-header" style="margin-top:28px;"><h2>Shipped <span class="page-count">${shipped.length}</span></h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Lot #</th><th>Consignor</th><th>Head</th><th>Buyer</th><th>Price</th><th>Ship Date</th></tr></thead>
          <tbody>${shippedRows || '<tr><td colspan="7" class="empty-row">No shipped lots.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function renderArchivePage() {
  const lots = state.lots.filter(l => l.status === 'Archived');
  const rows = lots.map(l => `
    <tr data-id="${l.id}">
      <td><strong class="lot-link" data-action="open-ldp" data-id="${l.id}">${esc(l.lot)}</strong></td>
      <td>${esc(l.con) || '—'}</td>
      <td>${l.head || '—'}</td>
      <td class="col-hide-sm" style="font-size:12px;">${esc(l.breed) || '—'}</td>
      <td style="font-size:12px;color:var(--text-muted);">${esc(l.archRsn) || '—'}</td>
      <td class="col-hide-sm">${esc(l.archDate) || '—'}</td>
      
    </tr>`).join('');

  return `
    <div class="page-content">
      <div class="page-header"><h1 class="page-title">Archive <span class="page-count">${lots.length}</span></h1></div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Lot #</th><th>Consignor</th><th>Head</th>
            <th class="col-hide-sm">Breed</th><th>Reason</th>
            <th class="col-hide-sm">Archived</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="empty-row">No archived lots.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ── CONSIGNORS PAGE ───────────────────────────────────────────

function renderConsignorsPage() {
  const cards = state.consignors.map(c => `
    <div class="con-card">
      <div class="con-card-header">
        <div class="con-name">${esc(c.name)}</div>
        ${isAdmin() ? `<button class="btn btn-xs btn-ghost" data-action="edit-consignor" data-id="${c.id}">Edit</button>` : ''}
      </div>
      ${c.breeds?.length ? `<div class="con-detail"><span class="con-label">Breeds</span>${c.breeds.map(esc).join(', ')}</div>` : ''}
      ${c.sexes?.length ? `<div class="con-detail"><span class="con-label">Sex</span>${c.sexes.map(esc).join(', ')}</div>` : ''}
      ${c.locations?.length ? `<div class="con-detail"><span class="con-label">Locations</span>${c.locations.map(esc).join(', ')}</div>` : ''}
    </div>`).join('');

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">Consignor Profiles</h1>
        ${isAdmin() ? '<button class="btn btn-primary" id="new-con-page-btn">+ New Consignor</button>' : ''}
      </div>
      <div class="con-grid">${cards || '<div class="empty-state">No consignor profiles yet.</div>'}</div>
    </div>`;
}

// ── ADMIN PAGE ────────────────────────────────────────────────

function renderAdminPage() {
  const reps = state.settings['reps'] || [];
  const saleTypes = state.settings['sale_types'] || [];
  const categories = state.settings['categories'] || [];
  const company = state.settings['company'] || '';
  const address = state.settings['address'] || '';
  const phone = state.settings['phone'] || '';
  const email = state.settings['email'] || '';
  const website = state.settings['website'] || '';
  const terms = state.settings['terms'] || '';

  const profiles = state.profiles || [];

  const listItems = (arr, key) => arr.map((v, i) => `
    <div class="admin-list-item">
      <span>${esc(v)}</span>
      <button class="btn btn-xs btn-ghost text-danger" data-action="remove-setting" data-key="${esc(key)}" data-idx="${i}">Remove</button>
    </div>`).join('');

  const profileRows = profiles.map(p => `
    <tr>
      <td>
        <input class="profile-name-inp" data-id="${p.id}"
          value="${esc(p.full_name || '')}" placeholder="Full name"
          style="width:130px;padding:4px 6px;font-size:12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);">
      </td>
      <td style="font-size:12px;color:var(--text-muted);">${esc(p.email) || '—'}</td>
      <td>
        <select class="profile-role-sel" data-id="${p.id}" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);">
          <option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="rep"   ${p.role === 'rep'   ? 'selected' : ''}>Rep</option>
        </select>
      </td>
      <td>
        <input class="profile-repname-inp" data-id="${p.id}"
          value="${esc(p.rep_name || '')}" placeholder="Rep name"
          style="width:150px;padding:4px 6px;font-size:12px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);">
      </td>
      <td>
        <button class="btn btn-xs btn-primary profile-save-btn" data-id="${p.id}">Save</button>
      </td>
    </tr>`).join('');

  return `
    <div class="page-content">
      <div class="page-header"><h1 class="page-title">Admin Settings</h1></div>
      <div class="admin-grid">

        <div class="form-section">
          <div class="form-section-title">Company Info</div>
          <div class="form-grid-2">
            <div class="field"><label>Company Name</label><input type="text" id="a-co" value="${esc(company)}"></div>
            <div class="field"><label>Phone</label><input type="text" id="a-ph" value="${esc(phone)}"></div>
            <div class="field"><label>Address</label><input type="text" id="a-addr" value="${esc(address)}"></div>
            <div class="field"><label>Email</label><input type="text" id="a-em" value="${esc(email)}"></div>
            <div class="field"><label>Website</label><input type="text" id="a-web" value="${esc(website)}"></div>
          </div>
          <div class="field" style="margin-top:12px;"><label>Terms & Conditions</label><textarea id="a-terms" rows="3">${esc(terms)}</textarea></div>
          <div style="margin-top:14px;"><button class="btn btn-primary" id="save-admin-btn">Save Company Info</button></div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Reps</div>
          <div class="admin-list" id="a-reps-list">${listItems(reps, 'reps')}</div>
          <div class="admin-add-row">
            <input type="text" id="a-rep-input" placeholder="Rep name…">
            <button class="btn btn-ghost" data-action="add-setting" data-key="reps" data-input="a-rep-input">Add</button>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Sale Types</div>
          <div class="admin-list" id="a-sales-list">${listItems(saleTypes, 'sale_types')}</div>
          <div class="admin-add-row">
            <input type="text" id="a-sale-input" placeholder="Sale type…">
            <button class="btn btn-ghost" data-action="add-setting" data-key="sale_types" data-input="a-sale-input">Add</button>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Categories / Types</div>
          <div class="admin-list" id="a-cats-list">${listItems(categories, 'categories')}</div>
          <div class="admin-add-row">
            <input type="text" id="a-cat-input" placeholder="Category name…">
            <button class="btn btn-ghost" data-action="add-setting" data-key="categories" data-input="a-cat-input">Add</button>
          </div>
        </div>

        <div class="form-section" style="grid-column:1/-1;">
          <div class="form-section-title">Team Members</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Full Name</th><th>Email</th><th>Role</th><th>Rep Name</th><th></th></tr></thead>
              <tbody>${profileRows || '<tr><td colspan="5" class="empty-row">No profiles found.</td></tr>'}</tbody>
            </table>
          </div>
        </div>

      </div>
    </div>`;
}

// ── LDP (LOT DETAIL PANEL) ────────────────────────────────────

function renderLDPOverlay() {
  return `
    <div class="ldp-overlay" id="ldp-overlay"></div>
    <div class="ldp" id="ldp">
      <div class="ldp-inner" id="ldp-inner"></div>
    </div>`;
}

function renderLDP(id) {
  const l = getLot(id);
  if (!l) return;
  state.ui.activeLotId = id;
  state.ui.ldpOpen = true;

  const inner = document.getElementById('ldp-inner');
  if (!inner) return;

  const fmtDate = d => { if (!d) return ''; try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; } };
  const tab = state.ui.ldpTab || 'overview';

  inner.innerHTML = `
    <div class="ldp-header">
      <div class="ldp-header-main">
        <div class="ldp-lot-num">${esc(l.lot)}</div>
        <span class="badge badge-${esc((l.status || '').toLowerCase().replace(/ /g, '-'))}">${esc(l.status)}</span>
      </div>
      <div class="ldp-header-sub">${esc(l.con) || ''} ${l.rep ? `· ${esc(l.rep)}` : ''}</div>
      <div class="ldp-header-stats">
        <div class="ldp-stat"><span>${l.head || '—'}</span><small>Head</small></div>
        <div class="ldp-stat"><span>${esc(l.wt) || '—'}</span><small>lbs</small></div>
        <div class="ldp-stat"><span>${l.ask ? '$' + esc(l.ask) : '—'}</span><small>Asking</small></div>
        ${l.buyNow ? `<div class="ldp-stat"><span>$${esc(l.buyNow)}</span><small>Buy Now</small></div>` : ''}
      </div>
      <button class="ldp-close-btn" id="ldp-close" title="Close" style="position:absolute;top:12px;right:14px;">✕</button>
    </div>

    <div class="ldp-tabs">
      <button class="ldp-tab ${tab === 'overview' ? 'active' : ''}" data-ldp-tab="overview">Overview</button>
      <button class="ldp-tab ${tab === 'edit' ? 'active' : ''}" data-ldp-tab="edit">Edit</button>
      ${l.status === 'Sold' ? `<button class="ldp-tab ${tab === 'sale' ? 'active' : ''}" data-ldp-tab="sale">Sale Info</button>` : ''}
      <button class="ldp-tab ${tab === 'notes' ? 'active' : ''}" data-ldp-tab="notes">Notes</button>
      <button class="ldp-tab ${tab === 'docs' ? 'active' : ''}" data-ldp-tab="docs">Documents</button>
      <button class="ldp-tab ${tab === 'log' ? 'active' : ''}" data-ldp-tab="log">Activity</button>
    </div>

    <div class="ldp-body">
      ${tab === 'overview' ? renderLDPOverview(l) : ''}
      ${tab === 'edit'     ? renderLDPEdit(l) : ''}
      ${tab === 'sale'     ? renderLDPSale(l) : ''}
      ${tab === 'notes'    ? renderLDPNotes(l) : ''}
      ${tab === 'docs'     ? renderLDPDocs(l) : ''}
      ${tab === 'log'      ? renderLDPLog(l) : ''}
    </div>

    <div class="ldp-footer">
      ${(l.status === 'Staged' || l.status === 'Active') ? `<button class="btn btn-primary" data-action="sell" data-id="${l.id}">Mark as Sold</button>` : ''}
      ${l.status === 'Archived' && isAdmin() ? `<button class="btn btn-danger" data-action="delete-lot" data-id="${l.id}" style="margin-right:auto;">Delete Lot</button>` : ''}
      ${isAdmin() ? `
        <select class="ldp-status-select" onchange="if(this.value)handleAction('change-status',{id:'${l.id}',status:this.value})">
          <option value="">Move to…</option>
          ${l.status !== 'Staged' ? `<option value="Staged">→ Staged</option>` : ''}
          ${l.status !== 'Active' ? `<option value="Active">→ Active</option>` : ''}
          ${l.status !== 'Sold' ? `<option value="Sold">→ Sold</option>` : ''}
          ${l.status !== 'Archived' ? `<option value="Archived">→ Archive</option>` : ''}
        </select>` : ''}
      ${l.status === 'Sold' && l.soldSt !== 'shipped' && isAdmin() ? `<button class="btn btn-primary" data-action="mark-shipped" data-id="${l.id}">Mark as Shipped</button>` : ''}
      ${l.status === 'Sold' && l.soldSt === 'shipped' && isAdmin() ? `<button class="btn btn-ghost" data-action="to-waiting" data-id="${l.id}">Undo Shipped</button>` : ''}
      <button class="btn btn-ghost" data-action="clone" data-id="${l.id}" title="Duplicate this lot">Duplicate</button>
      <button class="btn btn-ghost" data-action="csv-single" data-id="${l.id}">CSV</button>
      <button class="btn btn-ghost" data-action="open-docs" data-id="${l.id}">Docs</button>
    </div>`;

  document.getElementById('ldp').classList.add('open');
  document.getElementById('ldp-overlay').classList.add('open');
}

function renderLDPOverview(l) {
  const row = (label, val) => val ? `<div class="detail-row"><span class="detail-label">${esc(label)}</span><span class="detail-val">${esc(val)}</span></div>` : '';
  return `
    <div class="ldp-section">
      <div class="ldp-section-title">Lot Details</div>
      ${row('Breed', l.breed)}
      ${row('Sex', (l.sex || '').replace(/\n/g, ' / '))}
      ${row('Type', l.type)}
      ${row('Loads', l.loads)}
      ${row('Sale Type', l.sale)}
      ${row('Group ID', l.gid)}
      ${row('BidPath #', l.itemFullNumber)}
    </div>
    <div class="ldp-section">
      <div class="ldp-section-title">Delivery</div>
      ${row('Delivery Window', l.del)}
      ${row('Location', l.loc)}
      ${row('Shrink', l.shrink)}
      ${row('Slide', l.slide)}
    </div>
    <div class="ldp-section">
      <div class="ldp-section-title">Sale Settings</div>
      ${row('Starting Bid', l.startBid ? '$' + l.startBid + '/cwt' : null)}
      ${row('Close Date', l.closeDate ? l.closeDate + (l.closeTime ? ' · ' + l.closeTime : '') : null)}
    </div>
    ${(l.status === 'Sold' || l.status === 'Waiting to Ship' || l.status === 'Archived') && l.price ? `
    <div class="ldp-section">
      <div class="ldp-section-title" style="display:flex;justify-content:space-between;align-items:center;">
        Sale Details
        ${isAdmin() ? `<button class="btn btn-xs btn-ghost" data-action="sell" data-id="${l.id}" style="text-transform:none;font-size:11px;">Edit Sale Info</button>` : ''}
      </div>
      ${row('Sale Price', l.price === 'PO' ? 'PO (Pass Out)' : '$' + l.price + '/cwt')}
      ${isAdmin() ? row('Buyer', l.buyer || '—') : ''}
      ${row('Sold Date', l.soldDate || '—')}
      ${row('Down Money', l.down ? '$' + l.down : null)}
      ${row('Sale Notes', l.soldNotes || null)}
      ${row('Ship Status', l.soldSt === 'shipped' ? 'Shipped · ' + (l.shipDate || '') : l.soldSt === 'waiting' ? 'Waiting to Ship' : null)}
    </div>` : ''}
    ${l.notes ? `<div class="ldp-section"><div class="ldp-section-title">Description</div><div class="detail-notes">${esc(l.notes).replace(/\n/g, '<br>')}</div></div>` : ''}
    ${l.yt && /^https:\/\/www\.youtube\.com\/embed\//.test(l.yt) ? `<div class="ldp-section"><div class="ldp-section-title">Video</div><div class="video-wrap"><iframe src="${esc(l.yt)}" frameborder="0" allowfullscreen></iframe></div></div>` : ''}`;
}

function renderLDPEdit(l) {
  const reps = state.settings['reps'] || [];
  const saleTypes = state.settings['sale_types'] || ['Timed Auction', 'Direct Bid Auction', 'Buy Now'];
  const categories = state.settings['categories'] || [];

  const fld = (label, key, val, type='text') => `
    <div class="field">
      <label>${esc(label)}</label>
      <input type="${esc(type)}" class="ldp-field" data-key="${esc(key)}" value="${esc(val ?? '')}">
    </div>`;
  const fldTA = (label, key, val, rows=3) => `
    <div class="field">
      <label>${esc(label)}</label>
      <textarea class="ldp-field" data-key="${esc(key)}" rows="${rows}">${esc(val ?? '')}</textarea>
    </div>`;
  const fldSel = (label, key, val, opts) => `
    <div class="field">
      <label>${esc(label)}</label>
      <select class="ldp-field" data-key="${esc(key)}">
        <option value="">Select…</option>
        ${opts.map(o => `<option value="${esc(o)}" ${val===o?'selected':''}>${esc(o)}</option>`).join('')}
      </select>
    </div>`;

  return `
    <div class="ldp-edit-form">

      <div class="ldp-edit-section">
        <div class="ldp-edit-section-title">Identity</div>
        <div class="form-grid-3">
          ${fld('Lot Number','lot',l.lot)}
          ${fld('Sequence','seq',l.seq,'number')}
          ${fld('BidPath Item #','itemFullNumber',l.itemFullNumber)}
        </div>
        <div class="form-grid-2" style="margin-top:10px;">
          ${fldSel('Sale Type','sale',l.sale,saleTypes)}
          ${fldSel('Rep','rep',l.rep,reps)}
        </div>
        <div class="form-grid-2" style="margin-top:10px;">
          ${fld('Consignor','con',l.con)}
          ${fldSel('Type','type',l.type,categories)}
        </div>
      </div>

      <div class="ldp-edit-section">
        <div class="ldp-edit-section-title">Cattle</div>
        <div class="form-grid-3">
          ${fld('Loads','loads',l.loads,'number')}
          ${fld('Head','head',l.head,'number')}
          ${fld('Base Weight','wt',l.wt)}
        </div>
        <div class="form-grid-2" style="margin-top:10px;">
          ${fldTA('Breed / Description','breed',l.breed,2)}
          ${fldTA('Sex','sex',l.sex,2)}
        </div>
      </div>

      <div class="ldp-edit-section">
        <div class="ldp-edit-section-title">Sale Settings</div>
        <div class="form-grid-3">
          ${fld('Asking ($/cwt)','ask',l.ask)}
          ${fld('Starting Bid','startBid',l.startBid)}
          ${fld('Buy Now','buyNow',l.buyNow)}
        </div>
        <div class="form-grid-4" style="margin-top:10px;">
          ${fld('Close Date','closeDate',l.closeDate,'date')}
          ${fld('Close Time','closeTime',l.closeTime,'time')}
          ${fld('Start Bid Date','startBidDate',l.startBidDate,'date')}
          ${fld('Start Bid Time','startBidTime',l.startBidTime,'time')}
        </div>
      </div>

      <div class="ldp-edit-section">
        <div class="ldp-edit-section-title">Delivery</div>
        <div class="form-grid-2">
          ${fld('Delivery Window','del',l.del)}
          ${fld('Location','loc',l.loc)}
        </div>
        <div class="form-grid-2" style="margin-top:10px;">
          ${fld('Shrink','shrink',l.shrink)}
          ${fldTA('Slide','slide',l.slide,2)}
        </div>
      </div>

      <div class="ldp-edit-section">
        <div class="ldp-edit-section-title">Notes</div>
        <div class="form-grid-2">
          ${fldTA('Lot Description','notes',l.notes,3)}
          ${fldTA('Second Description','secondDesc',l.secondDesc,3)}
        </div>
        <div class="form-grid-2" style="margin-top:10px;">
          ${fldTA('CMS Internal Notes','cmsIntNotes',l.cmsIntNotes,2)}
          ${fldTA('CMS External Notes','cmsExtNotes',l.cmsExtNotes,2)}
        </div>
        ${fld('YouTube URL','yt',l.yt)}
        ${fld('Image Frame (1, 2, or 3)','imgFrame',l.imgFrame || 2,'number')}
      </div>

      <div style="padding-top:4px;">
        <button class="btn btn-primary" data-action="save-ldp-edit" data-id="${l.id}">Save Changes</button>
      </div>
    </div>`;
}


function renderLDPSale(l) {
  const canEdit = canEditLot(l) || isAdmin();
  return `
    <div class="ldp-section">
      <div class="ldp-section-title">Sale Details</div>
      <div class="form-grid-2">
        <div class="field">
          <label>Sale Price ($/cwt)</label>
          <input type="number" step="0.01" id="sale-price-inp" class="sale-field" value="${esc(l.price !== 'PO' ? l.price || '' : '')}" ${canEdit ? '' : 'readonly'} placeholder="Per cwt…">
        </div>
        <div class="field">
          <label>Buyer Name</label>
          <input type="text" id="sale-buyer-inp" class="sale-field" value="${esc(l.buyer || '')}" ${canEdit ? '' : 'readonly'} placeholder="Buyer…">
        </div>
        <div class="field">
          <label>Down Money ($)</label>
          <input type="number" step="0.01" id="sale-down-inp" class="sale-field" value="${esc(l.down || '')}" ${canEdit ? '' : 'readonly'} placeholder="0.00">
        </div>
        <div class="field">
          <label>Sold Date</label>
          <input type="date" id="sale-date-inp" class="sale-field" value="${esc(l.soldDate || '')}" ${canEdit ? '' : 'readonly'}>
        </div>
        <div class="field" style="grid-column:1/-1;">
          <label>Sale Notes</label>
          <textarea id="sale-notes-inp" class="sale-field" rows="3" ${canEdit ? '' : 'readonly'} placeholder="Notes…">${esc(l.soldNotes || '')}</textarea>
        </div>
        <div class="field" style="grid-column:1/-1; display:flex; align-items:center; gap:10px;">
          <label style="margin:0; display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="sale-po-inp" class="sale-field" ${l.price === 'PO' ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
            PO (Pass Out) — no sale price
          </label>
        </div>
      </div>
      ${canEdit ? `
        <div style="margin-top:16px; display:flex; gap:8px;">
          <button class="btn btn-primary" data-action="save-sale-info" data-id="${l.id}">Save Sale Info</button>
        </div>` : ''}
    </div>
    <div class="ldp-section">
      <div class="ldp-section-title">Shipping</div>
      <div class="form-grid-2">
        <div class="field">
          <label>Ship Date</label>
          <input type="date" id="sale-ship-inp" class="sale-field" value="${esc(l.shipDate || '')}" ${canEdit ? '' : 'readonly'}>
        </div>
        <div class="field" style="align-self:end;">
          <span style="font-size:13px; color:var(--text-muted);">
            Status: <strong>${l.soldSt === 'shipped' ? '✓ Shipped' : 'Waiting to Ship'}</strong>
          </span>
        </div>
      </div>
      ${canEdit ? `
        <div style="margin-top:12px; display:flex; gap:8px;">
          ${l.soldSt !== 'shipped' ? `<button class="btn btn-ghost" data-action="mark-shipped" data-id="${l.id}">Mark as Shipped</button>` : `<button class="btn btn-ghost" data-action="to-waiting" data-id="${l.id}">Unmark Shipped</button>`}
        </div>` : ''}
    </div>`;
}

function renderLDPNotes(l) {
  const renderList = (arr, type) => (arr || []).map(n => `
    <div class="note-entry">
      <div class="note-meta">${esc(n.ts || n.created_at || '')} ${n.user ? '· ' + esc(n.user) : ''}</div>
      <div class="note-text">${esc(n.text || n.content || '')}</div>
    </div>`).join('') || '<div class="empty-notes">No notes yet.</div>';

  return `
    <div class="ldp-section">
      <div class="ldp-section-title">Internal Notes</div>
      <div class="note-input-row">
        <textarea id="int-note-input" placeholder="Add internal note…" rows="2"></textarea>
        <button class="btn btn-ghost btn-sm" data-action="add-note" data-type="internal" data-id="${l.id}">Add</button>
      </div>
      <div id="int-notes-list">${renderList(l.intNotes, 'internal')}</div>
    </div>
    <div class="ldp-section" style="margin-top:20px;">
      <div class="ldp-section-title">External Notes</div>
      <div class="note-input-row">
        <textarea id="ext-note-input" placeholder="Add external note…" rows="2"></textarea>
        <button class="btn btn-ghost btn-sm" data-action="add-note" data-type="external" data-id="${l.id}">Add</button>
      </div>
      <div id="ext-notes-list">${renderList(l.extNotes, 'external')}</div>
    </div>`;
}

function renderLDPDocs(l) {
  const docs = getDocsForLot(l, '', '', isAdmin());
  if (!docs.length) return '<div class="empty-state">No documents available for this lot status.</div>';

  return `
    <div class="docs-meta">
      <div class="form-grid-2">
        <div class="field"><label>Auction Name</label><input type="text" id="doc-auction-name" placeholder="e.g. Spring Calf Sale 2026"></div>
        <div class="field"><label>Auction Date</label><input type="date" id="doc-auction-date"></div>
      </div>
    </div>
    <div class="doc-list">
      ${docs.map((d, i) => `
        <div class="doc-item">
          <span>${d.label}</span>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-ghost btn-sm" data-action="print-doc" data-lot-id="${l.id}" data-doc-idx="${i}">🖨 Print</button>
            <button class="btn btn-ghost btn-sm" data-action="download-doc" data-lot-id="${l.id}" data-doc-idx="${i}">⬇ Download</button>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderLDPLog(l) {
  // Fetch fresh from DB and inject
  const container = `<div class="ldp-section" id="ldp-log-container">
    <div style="color:var(--text-muted);font-size:12px;padding:8px 0;">Loading activity...</div>
  </div>`;
  // Async fetch after render
  setTimeout(async () => {
    const el = document.getElementById('ldp-log-container');
    if (!el) return;
    try {
      const entries = await fetchActivityForLot(l.id);
      if (!document.getElementById('ldp-log-container')) return;
      el.innerHTML = entries && entries.length ? entries.map(e => `
        <div class="log-entry">
          <div class="log-dot"></div>
          <div>
            <div class="log-text">${esc(e.action || e.text || '')}</div>
            <div class="log-time">${esc(e.user_name ? e.user_name + ' · ' : '')}${e.created_at ? new Date(e.created_at).toLocaleString() : ''}</div>
          </div>
        </div>`).join('') : '<div class="empty-notes">No activity logged yet.</div>';
    } catch(err) {
      const el2 = document.getElementById('ldp-log-container');
      if (el2) el2.innerHTML = '<div class="empty-notes">Could not load activity.</div>';
    }
  }, 100);
  return container;
}

// ── MODALS ────────────────────────────────────────────────────

function renderModals() {
  return `
    <!-- Sell Modal -->
    <div class="modal-overlay" id="m-sell" style="display:none;">
      <div class="modal">
        <div class="modal-header">
          <h3>Mark as Sold</h3>
          <button class="modal-close" data-close="m-sell">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="sell-id">
          <div class="form-grid-2">
            <div class="field">
              <label>Sale Price ($/cwt) <span class="req">*</span></label>
              <input type="text" id="sell-price" placeholder="e.g. 340.00">
              <label class="checkbox-label" style="margin-top:6px;">
                <input type="checkbox" id="sell-po"> PO (Pass Out)
              </label>
              <div id="sell-price-err" class="field-err" style="display:none;">Enter a price or check PO.</div>
            </div>
            <div class="field">
              <label>Buyer Name <span class="req">*</span></label>
              <input type="text" id="sell-buyer">
            </div>
            <div class="field">
              <label>Sold Date</label>
              <input type="date" id="sell-date">
            </div>
            <div class="field">
              <label>Down Money Due ($)</label>
              <input type="text" id="sell-down">
            </div>
            <div class="field" style="grid-column:1/-1;">
              <label>Notes</label>
              <input type="text" id="sell-notes" placeholder="Any sale notes…">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-close="m-sell">Cancel</button>
          <button class="btn btn-primary" data-action="confirm-sell">Confirm Sale</button>
        </div>
      </div>
    </div>

    <!-- Archive Modal -->
    <div class="modal-overlay" id="m-arch" style="display:none;">
      <div class="modal">
        <div class="modal-header">
          <h3>Archive Lot</h3>
          <button class="modal-close" data-close="m-arch">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="arch-id">
          <div class="field">
            <label>Reason</label>
            <select id="arch-rsn">
              ${ARCHIVE_REASONS.map(r => `<option>${r}</option>`).join('')}
            </select>
          </div>
          <div class="field" id="arch-other-wrap" style="display:none;margin-top:10px;">
            <label>Specify reason</label>
            <input type="text" id="arch-other" placeholder="Describe the reason…">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-close="m-arch">Cancel</button>
          <button class="btn btn-danger" data-action="confirm-arch">Archive</button>
        </div>
      </div>
    </div>

    <!-- Delete Lot Modal -->
    <div class="modal-overlay" id="m-delete-lot" style="display:none;">
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <h3 style="color:var(--err,#ef4444);">⚠ Permanently Delete Lot</h3>
          <button class="modal-close" data-close="m-delete-lot">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="delete-lot-id">
          <p style="font-size:14px;color:var(--text-muted);line-height:1.6;margin-bottom:16px;">
            This will <strong style="color:var(--err);">permanently delete</strong> this lot and all its activity history from the database. This cannot be undone.
          </p>
          <div class="field">
            <label style="font-size:13px;">Type the lot number <strong id="delete-lot-num" style="color:var(--text);font-family:var(--mono);"></strong> to confirm:</label>
            <input type="text" id="delete-lot-confirm" placeholder="Lot number…" autocomplete="off"
              style="margin-top:8px;border-color:var(--err,#ef4444);">
          </div>
          <div id="delete-lot-err" style="display:none;color:var(--err);font-size:12px;margin-top:6px;"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-close="m-delete-lot">Cancel</button>
          <button class="btn btn-danger" data-action="confirm-delete-lot">Delete Forever</button>
        </div>
      </div>
    </div>

    <!-- Ship Modal -->
    <div class="modal-overlay" id="m-ship" style="display:none;">
      <div class="modal">
        <div class="modal-header">
          <h3>Mark as Shipped</h3>
          <button class="modal-close" data-close="m-ship">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="ship-id">
          <div class="field">
            <label>Ship Date</label>
            <input type="date" id="ship-date" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-close="m-ship">Cancel</button>
          <button class="btn btn-primary" data-action="confirm-ship">Confirm Shipped</button>
        </div>
      </div>
    </div>

    <!-- Consignor Modal -->
    <div class="modal-overlay" id="m-consignor" style="display:none;">
      <div class="modal modal-lg">
        <div class="modal-header">
          <h3 id="con-modal-title">New Consignor Profile</h3>
          <button class="modal-close" data-close="m-consignor">✕</button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="con-edit-id">
          <input type="hidden" id="con-modal-returnto">
          <div class="field"><label>Name <span class="req">*</span></label><input type="text" id="con-name"></div>
          <div class="form-grid-2" style="margin-top:12px;">
            <div class="field"><label>Typical Breeds</label><textarea id="con-breeds" rows="3" placeholder="One per line…"></textarea></div>
            <div class="field"><label>Typical Sexes</label><textarea id="con-sexes" rows="3" placeholder="One per line…"></textarea></div>
            <div class="field"><label>Typical Locations</label><textarea id="con-locs" rows="2" placeholder="One per line…"></textarea></div>
            <div class="field"><label>Typical Shrink Values</label><textarea id="con-shrink" rows="2" placeholder="One per line…"></textarea></div>
            <div class="field" style="grid-column:1/-1;"><label>Typical Slides</label><textarea id="con-slides" rows="3" placeholder="One per line…"></textarea></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-danger btn-sm" id="con-delete-btn" data-action="delete-consignor" style="display:none;margin-right:auto;">Delete Consignor</button>
          <button class="btn btn-ghost" data-close="m-consignor">Cancel</button>
          <button class="btn btn-primary" data-action="save-consignor">Save Consignor</button>
        </div>
      </div>
    </div>`;
}

// ── EVENTS ────────────────────────────────────────────────────

function attachAppEvents() {
  const app = document.getElementById('app');

  // Delegated click handler for the whole app
  app.addEventListener('click', handleClick);
  app.addEventListener('change', handleChange);

  // Theme toggle
  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);

  // User menu
  document.getElementById('user-menu')?.addEventListener('click', () => {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await signOut();
    showLogin();
  });

  // Mobile sidebar
  document.getElementById('mob-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Global search
  const searchInput = document.getElementById('global-search');
  let searchTimer;
  searchInput?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => handleSearch(e.target.value), 180);
  });

  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      const sr = document.getElementById('search-results');
      if (sr) sr.style.display = 'none';
    }
  });
  // Delete lot confirm — Enter key submits, Escape cancels
  document.addEventListener('keydown', e => {
    if (document.activeElement?.id === 'delete-lot-confirm') {
      if (e.key === 'Enter')  { e.preventDefault(); doDeleteLot(); }
      if (e.key === 'Escape') { document.getElementById('m-delete-lot').style.display = 'none'; }
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.header-search')) {
      const sr = document.getElementById('search-results');
      if (sr) sr.style.display = 'none';
    }
  }, { passive: true });  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      const sr = document.getElementById('search-results');
      if (sr) sr.style.display = 'none';
    }
  });
  // Delete lot confirm — Enter key submits, Escape cancels
  document.addEventListener('keydown', e => {
    if (document.activeElement?.id === 'delete-lot-confirm') {
      if (e.key === 'Enter')  { e.preventDefault(); doDeleteLot(); }
      if (e.key === 'Escape') { document.getElementById('m-delete-lot').style.display = 'none'; }
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.header-search')) {
      const sr = document.getElementById('search-results');
      if (sr) sr.style.display = 'none';
    }
  }, { passive: true });
  searchInput?.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      const r = document.getElementById('search-results');
      if (r) r.style.display = 'none';
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.header-search')) {
      const r = document.getElementById('search-results');
      if (r) r.style.display = 'none';
    }
  }, { passive: true });

  // LDP close
  document.getElementById('ldp-overlay')?.addEventListener('click', closeLDPPanel);

  // Sell modal PO toggle
  document.getElementById('sell-po')?.addEventListener('change', e => {
    const checked = e.target.checked;
    const priceInput = document.getElementById('sell-price');
    const buyerInput = document.getElementById('sell-buyer');
    if (priceInput) { priceInput.disabled = checked; if (checked) priceInput.value = ''; }
    if (buyerInput) { buyerInput.disabled = checked; if (checked) buyerInput.value = ''; }
    const err = document.getElementById('sell-price-err');
    if (err) err.style.display = 'none';
  });

  // Archive other reason
  document.getElementById('arch-rsn')?.addEventListener('change', e => {
    const wrap = document.getElementById('arch-other-wrap');
    if (wrap) wrap.style.display = e.target.value === 'Other' ? '' : 'none';
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.style.display = 'none'; });
  });
}

function handleClick(e) {
  // Sortable column headers
  const sortTh = e.target.closest('.sortable-th');
  if (sortTh) { handleSort(sortTh.dataset.sort); return; }

  const btn = e.target.closest('[data-action]');
  const page = e.target.closest('[data-page]');
  const close = e.target.closest('[data-close]');
  const ldpTab = e.target.closest('[data-ldp-tab]');
  const moreBtn = e.target.closest('.action-more-btn');
  const closeBtn = e.target.closest('#ldp-close');

  if (closeBtn) { closeLDPPanel(); return; }
  if (ldpTab) { state.ui.ldpTab = ldpTab.dataset.ldpTab; renderLDP(state.ui.activeLotId); return; }
  if (close) { document.getElementById(close.dataset.close).style.display = 'none'; return; }
  if (page) { goPage(page.dataset.page); return; }
  if (moreBtn) { toggleDropdown(moreBtn.dataset.id); return; }
  if (btn) { handleAction(btn.dataset.action, btn.dataset); return; }

  // Close dropdowns on outside click
  document.querySelectorAll('.action-dropdown.open').forEach(d => d.classList.remove('open'));
}

function handleChange(e) {
  if (e.target.classList.contains('profile-role-sel')) {
    const id = e.target.dataset.id;
    const role = e.target.value;
    updateProfile(id, { role })
      .then(() => { toast('Role updated'); if (isAdmin()) fetchProfiles().then(p => { state.profiles = p; }); })
      .catch(err => toast(err.message, true));
  }

  if (e.target.classList.contains('profile-save-btn')) {
    const id = e.target.dataset.id;
    const row = e.target.closest('tr');
    const fullName = row.querySelector('.profile-name-inp')?.value?.trim() || '';
    const repName  = row.querySelector('.profile-repname-inp')?.value?.trim() || '';
    const role     = row.querySelector('.profile-role-sel')?.value || 'rep';
    updateProfile(id, { full_name: fullName, rep_name: repName, role })
      .then(() => { toast('Profile saved'); fetchProfiles().then(p => { state.profiles = p; rerenderCurrentPage(); }); })
      .catch(err => toast(err.message || 'Failed to save profile', true));
  }
  if (e.target.id === 'f-con' || e.target.id === 'f-con-c') {
    onConsignorChange();
  }
}

function handleAction(action, data) {
  const id = data.id ? +data.id : null;
  switch (action) {
    case 'open-ldp':      renderLDP(id); break;
    case 'sell':          openSellModal(id); break;
    case 'mark-active':   doMarkActive(id); break;
    case 'mark-shipped':  openShipModal(id); break;
    case 'to-waiting':    doToWaiting(id); break;
    case 'archive':       openArchiveModal(id); break;
    case 'restore':       doRestore(id); break;
    case 'clone':         doClone(id); break;
    case 'csv-single':    downloadSingleLotCSV(getLot(id)); break;
    case 'open-docs':     renderLDP(id); setTimeout(() => { state.ui.ldpTab = 'docs'; renderLDP(id); }, 50); break;
    case 'print-doc':      doPrintDoc(data); break;
    case 'download-doc':   doDownloadDoc(data); break;
    case 'add-note':       doAddNote(id, data.type); break;
    case 'add-setting':    doAddSetting(data.key, data.input); break;
    case 'remove-setting': doRemoveSetting(data.key, +data.idx); break;
    case 'edit-consignor': openEditConsignor(+data.id); break;
    case 'confirm-sell':   doSell(); break;
    case 'confirm-arch':   doArchive(); break;
    case 'confirm-delete-lot': doDeleteLot(); break;
    case 'delete-lot':   openDeleteLotModal(id); break;
    case 'confirm-ship':   doShip(); break;
    case 'save-consignor': saveConsignor(); break;
    case 'delete-consignor': deleteConsignorProfile(); break;
    case 'save-ldp-edit':  saveLDPEdit(+data.id); break;
    case 'save-sale-info': saveSaleInfo(+data.id); break;
    case 'change-status':
      if (data.status === 'Sold') { openSellModal(id); }
      else if (data.status === 'Archived') { openArchiveModal(id); }
      else { doChangeStatus(id, data.status); }
      break;
  }
}

function toggleDropdown(id) {
  document.querySelectorAll('.action-dropdown').forEach(d => {
    if (d.id !== `dd-${id}`) d.classList.remove('open');
  });
  document.getElementById(`dd-${id}`)?.classList.toggle('open');
}

// ── LOT BUILDER LOGIC ─────────────────────────────────────────

function readForm() {
  const v = id => document.getElementById(id)?.value?.trim() || '';
  const n = id => parseInt(document.getElementById(id)?.value) || 0;
  const con = v('f-con-c') || v('f-con');
  const breed = v('f-br-c') || v('f-br');
  const sex = v('f-sx-c') || v('f-sx');
  const loc = v('f-loc-c') || v('f-loc');
  const rep = v('f-rep') || v('f-rep-sel');

  const slAmt = v('f-sl-amt');
  const slType = v('f-sl-type');
  const slDir = v('f-sl-dir');
  const slStop = v('f-sl-stop');
  const slCustom = v('f-sl-c');
  const slide = slCustom || (slAmt && slType ? `${slAmt} ${slType}${slDir ? ' ' + slDir : ''}${slStop ? '\n' + slStop : ''}` : '');

  const fmtDelDate = iso => {
    if (!iso) return '';
    try {
      // Parse as local date (append T12:00:00 to avoid timezone rollback)
      const d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    } catch { return iso; }
  };
  const dsRaw = v('f-ds'), deRaw = v('f-de');
  const ds = fmtDelDate(dsRaw), de = fmtDelDate(deRaw);
  const delRaw = v('f-del-raw');  // prefilled by doClone when date pickers can't hold the value
  const del = ds && de ? `${ds} - ${de}` : ds || de || delRaw;

  return {
    lot: v('f-lot'), seq: n('f-seq'),
    gid: v('f-gid') || [con, (sex || '').split('\n')[0], v('f-type')].filter(Boolean).join('/'),
    itemFullNumber: v('f-item-num'),
    sale: v('f-sale'), rep, con,
    breed, sex, type: v('f-type'),
    loads: n('f-loads') || 1, head: n('f-head'), wt: v('f-wt'),
    del, loc, shrink: v('f-shrink'), slide,
    notes: v('f-notes'), secondDesc: v('f-second-desc'),
    cmsIntNotes: v('f-cms-int'), cmsExtNotes: v('f-cms-ext'),
    yt: v('f-yt'),
    imgFrame: parseInt(v('f-img-frame'), 10) || 2,
    closeDate: v('f-close-date'), closeTime: v('f-close-time'),
    startBidDate: v('f-startbid-date'), startBidTime: v('f-startbid-time'),
    ask: v('f-ask'), buyNow: v('f-buynow'), startBid: v('f-startbid'),
    listDate: v('f-date') || new Date().toISOString().split('T')[0],
    status: STATUS.STAGED, log: [], intNotes: [], extNotes: []
  };
}

function validateLot(l) {
  if (!l.lot || !l.lot.trim()) return 'Lot Number is required';
  if (!l.con || !l.con.trim()) return 'Consignor is required';
  if (!l.head || isNaN(+l.head) || +l.head <= 0) return 'Head Count must be a positive number';
  if (l.loads && (isNaN(+l.loads) || +l.loads <= 0)) return 'Loads must be a positive number';
  if (l.wt && isNaN(+l.wt.replace(/[^0-9.]/g,''))) return 'Base Weight must be a number';
  if (!l.breed || !l.breed.trim()) return 'Breed / Description is required';
  if (!l.sex || !l.sex.trim()) return 'Sex is required';
  if (!l.sale) return 'Sale Type is required';
  if (l.closeDate && l.closeTime) {
    const dt = new Date(l.closeDate + 'T' + l.closeTime);
    if (isNaN(dt.getTime())) return 'Close date/time is invalid';
  }
  return null;
}

/** Normalize + validate a lot before DB write. Mutates l in place. Returns error string or null. */

async function doSaveLot(e) {
  e?.preventDefault();
  try { requirePerm(canCreateLot(), 'You do not have permission to create lots.'); }
  catch(permErr) { toast(permErr.message, true); return; }
  const l = readForm();
  const err = validateLot(l);
  if (err) {
    toast(err, true);
    // Highlight the problematic field
    const fieldMap = {
      'Lot Number': 'f-lot', 'Consignor': 'f-con-c', 'Head Count': 'f-head',
      'Breed': 'f-br-c', 'Sex': 'f-sx-c', 'Sale Type': 'f-sale', 'Loads': 'f-loads',
    };
    for (const [label, id] of Object.entries(fieldMap)) {
      if (err.includes(label)) {
        const el = document.getElementById(id);
        if (el) { el.focus(); el.classList.add('field-invalid'); setTimeout(() => el.classList.remove('field-invalid'), 2500); }
        break;
      }
    }
    return;
  }
  try {
    const saved = await insertLot(l);
    upsertLot(saved);
    await logActivity(saved.id, `Lot ${saved.lot} created`, getUserDisplayName());
    toast(esc(saved.lot) + " saved to Staged");
    clearBuilderForm();
    updateBadges();
    // Prompt to download CSV
    if (confirm(esc(saved.lot) + " saved to Staged.\n\nDownload the lot CSV + image now?")) {
      downloadCountryZip([saved]);
    }
  } catch (e) {
    toast(e.message || 'Failed to save lot', true);
  }
}

function clearBuilderForm() {
  ['f-lot','f-seq','f-item-num','f-rep','f-con-c','f-br-c','f-sx-c','f-loads',
   'f-head','f-wt','f-loc-c','f-shrink','f-sl-c','f-sl-amt','f-sl-stop',
   'f-notes','f-second-desc','f-yt','f-ds','f-de','f-del-raw','f-close-date','f-close-time',
   'f-ask','f-buynow','f-startbid','f-startbid-date','f-startbid-time',
   'f-cms-int','f-cms-ext'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['f-con','f-br','f-sx','f-loc','f-sale','f-type','f-rep-sel','f-sl-type','f-sl-dir']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('intel-panel').style.display = 'none';
}

// Hardcoded INTEL profiles — fallback when no DB consignor profile exists
const INTEL = {
  'Tuls Calf Ranch': {
    breeds: ['Combination of TD/ ST/ GENEX/ ABS Genetics X Holstein Cows','TD Angus Bulls X Holstein Cows','Charolais TD Bulls X 25% Holstein Cows // 75% Composite Jersey Cows'],
    sexes: ['Steers/ Heifers \nHeifers -15','Steers','Heifers'],
    locations: ['Clovis, NM'],
    shrink: ['0%','3%'],
    slides: ['90 Cent Dairy Slide up and down','12 Cent Traditional Slide up and down\n50# stops']
  },
  'Lone Star Calf Ranch': {
    breeds: ['Combination of TD/InFocus/Genex Genetics X Jersey & Composite Jersey Cross Cows','Combination of TD/InFocus/Genex/ABS Genetics X Holstein Cows','Holstein'],
    sexes: ['Heifers','Steers','Steers/ Heifers \nHeifers -15'],
    locations: ['Hereford, TX'],
    shrink: ['0%','3%'],
    slides: ['12 Cent Traditional Slide up and down\n50# stops','80 cent dairy slide up and down']
  },
  'Bullseye Calf Ranch': {
    breeds: ['Holstein'],
    sexes: ['Steers'],
    locations: ['Lovington, NM'],
    shrink: ['0%'],
    slides: ['80 cent dairy slide up and down']
  },
  'Transition Growers': {
    breeds: ['TD Angus Bulls X Holstein Cows'],
    sexes: ['Steers/ Heifers \nHeifers -15'],
    locations: ['10 miles South of Hereford, TX'],
    shrink: ['3%'],
    slides: ['12 Cent Traditional Slide up and down\n35# stops']
  },
  'Prime Performance': {
    breeds: ['TD Angus Bulls X Holstein Cows'],
    sexes: ['Steers','Heifers','Steers/ Heifers \nHeifers -10'],
    locations: ['10 miles South of Hereford, TX'],
    shrink: ['3%'],
    slides: ['12 Cent Traditional Slide up and down\n35# stops']
  },
  'Calftech': {
    breeds: ['Charolais Bulls X 75% Holstein Cows // 25% Composite Jersey Cows'],
    sexes: ['Steers','Heifers'],
    locations: ['Tipton, CA'],
    shrink: ['2%'],
    slides: ['12 Cent Traditional Slide up and down\n50# stops']
  },
  'Rajen Dairy': {
    breeds: ['Wulf Limousin Bulls X Holstein Cows'],
    sexes: ['Steers'],
    locations: ['Clovis, NM'],
    shrink: ['0%'],
    slides: ['80 Cent Dairy Slide up and down']
  }
};

function onConsignorChange() {
  const con = document.getElementById('f-con-c')?.value.trim() || document.getElementById('f-con')?.value;
  if (!con) return;
  const profile = state.consignors.find(c => c.name === con) || INTEL[con];
  const panel = document.getElementById('intel-panel');
  if (!panel) return;
  if (!profile) { panel.style.display = 'none'; return; }

  const pills = (arr, targetId) => (arr || []).map(v =>
    `<button type="button" class="pill" data-target="${esc(targetId)}" data-val="${esc(v)}">${esc(v.split('\n')[0])}</button>`).join('');

  panel.style.display = 'block';
  panel.innerHTML = `
    <div class="intel-title">Suggestions for ${esc(con)}</div>
    <div class="intel-row">${pills(profile.breeds, 'f-br-c')}</div>
    <div class="intel-row">${pills(profile.sexes, 'f-sx-c')}</div>
    <div class="intel-row">${pills(profile.locations, 'f-loc-c')}</div>
    <div class="intel-row">${pills(profile.slides, 'f-sl-c')}</div>`;

  panel.querySelectorAll('.pill').forEach(p => {
    p.addEventListener('click', () => {
      const target = document.getElementById(p.dataset.target);
      if (target) target.value = p.dataset.val;
      p.classList.toggle('active');
    });
  });
}

// ── MODAL ACTIONS ─────────────────────────────────────────────

function openSellModal(id) {
  const el = document.getElementById('m-sell');
  if (!el) return;
  const lot = getLot(id);
  document.getElementById('sell-id').value = id;
  // Pre-populate with existing sold data if lot was previously sold
  const priceEl = document.getElementById('sell-price');
  const buyerEl = document.getElementById('sell-buyer');
  const downEl  = document.getElementById('sell-down');
  const notesEl = document.getElementById('sell-notes');
  const dateEl  = document.getElementById('sell-date');
  const poEl    = document.getElementById('sell-po');
  // Reset disabled states first
  [priceEl, buyerEl, downEl, notesEl].forEach(e => { if (e) e.disabled = false; });
  // Pre-fill from existing data
  if (priceEl) priceEl.value = (lot && lot.price && lot.price !== 'PO') ? lot.price : '';
  if (buyerEl) buyerEl.value = (lot && lot.buyer) ? lot.buyer : '';
  if (downEl)  downEl.value  = (lot && lot.down)  ? lot.down  : '';
  if (notesEl) notesEl.value = (lot && lot.soldNotes) ? lot.soldNotes : '';
  if (dateEl)  dateEl.value  = (lot && lot.soldDate) ? lot.soldDate : new Date().toISOString().split('T')[0];
  if (poEl) {
    poEl.checked = !!(lot && lot.price === 'PO');
    if (poEl.checked) { if (priceEl) priceEl.disabled = true; if (buyerEl) buyerEl.disabled = true; }
  }
  const err = document.getElementById('sell-price-err');
  if (err) err.style.display = 'none';
  el.style.display = 'flex';
}

async function doSell() {
  // NOTE: Real enforcement is Firestore security rules.
  requirePerm(canChangeStatus(), 'Only admins can mark lots as sold.');
  const id = +document.getElementById('sell-id').value;
  const isPO = document.getElementById('sell-po').checked;
  const rawPrice = document.getElementById('sell-price').value.trim();
  const buyer = document.getElementById('sell-buyer').value.trim();
  const errEl = document.getElementById('sell-price-err');

  if (!isPO && !rawPrice) { errEl.style.display = 'block'; document.getElementById('sell-price').focus(); return; }
  if (!isPO && !buyer) { toast('Buyer name is required', true); return; }
  errEl.style.display = 'none';

  const changes = {
    status: STATUS.SOLD, soldSt: 'waiting',
    buyer: isPO ? '' : buyer,
    price: isPO ? 'PO' : rawPrice,
    soldDate: document.getElementById('sell-date').value,
    down: document.getElementById('sell-down').value.trim(),
    soldNotes: document.getElementById('sell-notes').value.trim()
  };

  try {
    const updated = await updateLot(id, changes);
    upsertLot(updated);
    await logActivity(id, isPO ? 'Marked as PO (Pass Out)' : `Sold to ${esc(buyer)} @ $${esc(rawPrice)}/cwt`, getUserDisplayName());
    document.getElementById('m-sell').style.display = 'none';
    toast(`Lot marked as Sold`);
    rerenderCurrentPage();
    updateBadges();
    if (state.ui.ldpOpen && state.ui.activeLotId === id) renderLDP(id);
  } catch (e) { toast(e.message || 'Failed to save', true); }
}

function openArchiveModal(id) {
  document.getElementById('arch-id').value = id;
  document.getElementById('arch-rsn').value = ARCHIVE_REASONS[0];
  document.getElementById('arch-other').value = '';
  document.getElementById('arch-other-wrap').style.display = 'none';
  document.getElementById('m-arch').style.display = 'flex';
}

async function doArchive() {
  requirePerm(canChangeStatus(), 'Only admins can archive lots.');
  const id = +document.getElementById('arch-id').value;
  const sel = document.getElementById('arch-rsn').value;
  const other = document.getElementById('arch-other').value.trim();
  if (sel === 'Other' && !other) { toast('Please specify a reason', true); return; }
  const reason = sel === 'Other' ? other : sel;
  try {
    const updated = await updateLot(id, { status: STATUS.ARCHIVED, archRsn: reason, archDate: new Date().toISOString().split('T')[0] });
    upsertLot(updated);
    await logActivity(id, `Archived — ${esc(reason)}`, getUserDisplayName());
    document.getElementById('m-arch').style.display = 'none';
    toast('Lot archived');
    rerenderCurrentPage();
    updateBadges();
    if (state.ui.ldpOpen && state.ui.activeLotId === id) closeLDPPanel();
  } catch (e) { toast(e.message || 'Failed to archive', true); }
}

function openShipModal(id) {
  document.getElementById('ship-id').value = id;
  document.getElementById('ship-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('m-ship').style.display = 'flex';
}

async function doShip() {
  requirePerm(canChangeStatus(), 'Only admins can mark lots as shipped.');
  const id = +document.getElementById('ship-id').value;
  const shipDate = document.getElementById('ship-date').value;
  try {
    const updated = await updateLot(id, { soldSt: 'shipped', shipDate });
    upsertLot(updated);
    await logActivity(id, `Marked as Shipped — ${shipDate}`, getUserDisplayName());
    document.getElementById('m-ship').style.display = 'none';
    toast('Lot marked as Shipped');
    rerenderCurrentPage();
    if (state.ui.ldpOpen && state.ui.activeLotId === id) renderLDP(id);
  } catch (e) { toast(e.message || 'Failed to update', true); }
}


async function doChangeStatus(id, newStatus) {
  try { requirePerm(canChangeStatus(), 'Only admins can change lot status.'); }
  catch(e) { toast(e.message, true); return; }
  if (!id || !newStatus) return;
  const lot = getLot(id);
  if (!lot) return;
  const changes = { status: newStatus };
  if (newStatus === STATUS.SOLD) {
    changes.soldSt = 'waiting';
    if (!lot.soldDate) changes.soldDate = new Date().toISOString().split('T')[0];
  } else {
    // Moving away from Sold — clear all sale fields
    changes.soldSt    = null;
    changes.soldDate  = null;
    changes.price     = null;
    changes.buyer     = null;
    changes.down      = null;
    changes.soldNotes = null;
    changes.shipDate  = null;
  }
  if (newStatus === STATUS.ARCHIVED) {
    changes.archDate = new Date().toISOString().split('T')[0];
  }
  if (newStatus === STATUS.STAGED || newStatus === STATUS.ACTIVE) {
    changes.archRsn  = null;
    changes.archDate = null;
  }
  try {
    const updated = await updateLot(id, changes);
    upsertLot(updated);
    await logActivity(id, `Status changed to ${newStatus}`, getUserDisplayName());
    toast(`Lot moved to ${newStatus}`);
    rerenderCurrentPage();
    updateBadges();
    if (state.ui.ldpOpen && state.ui.activeLotId === id) renderLDP(id);
  } catch (e) { toast(e.message || 'Failed to update status', true); }
}

async function doMarkActive(id) {
  requirePerm(canChangeStatus(), 'Only admins can mark lots active.');
  try {
    const updated = await updateLot(id, { status: STATUS.ACTIVE });
    upsertLot(updated);
    await logActivity(id, 'Marked Active', getUserDisplayName());
    toast('Lot marked Active');
    rerenderCurrentPage();
    updateBadges();
    if (state.ui.ldpOpen && state.ui.activeLotId === id) renderLDP(id);
  } catch (e) { toast(e.message || 'Failed to update', true); }
}

async function doToWaiting(id) {
  try {
    const updated = await updateLot(id, { soldSt: 'waiting' });
    upsertLot(updated);
    await logActivity(id, 'Moved back to Waiting to Ship', getUserDisplayName());
    toast('Moved to Waiting to Ship');
    rerenderCurrentPage();
  } catch (e) { toast(e.message || 'Failed', true); }
}

async function doRestore(id) {
  try {
    const updated = await updateLot(id, { status: STATUS.STAGED, archRsn: null, archDate: null });
    upsertLot(updated);
    await logActivity(id, 'Restored from Archive', getUserDisplayName());
    toast('Lot restored to Staged');
    rerenderCurrentPage();
    updateBadges();
  } catch (e) { toast(e.message || 'Failed', true); }
}

function doClone(id) {
  const orig = getLot(id);
  if (!orig) { toast('Lot not found', true); return; }

  // Navigate to builder first, then prefill once DOM is ready
  closeLDPPanel();
  goPage('builder');

  // Use requestAnimationFrame to wait for builder DOM to render
  requestAnimationFrame(() => requestAnimationFrame(() => {
    clearBuilderForm();

    const set = (elId, val) => {
      const el = document.getElementById(elId);
      if (el && val != null && val !== '') el.value = val;
    };

    // Identity — append -copy to lot number so user knows to rename it
    set('f-lot',      orig.lot ? orig.lot + '-copy' : '');
    set('f-seq',      orig.seq);
    set('f-item-num', orig.itemFullNumber);
    set('f-sale',     orig.sale);

    // Rep — use hidden input (populated by renderBuilderPage for reps)
    set('f-rep',     orig.rep);
    set('f-rep-sel', orig.rep);

    // Consignor — set the combo box
    const conSel = document.getElementById('f-con');
    if (conSel && orig.con) {
      // Add the option if not already present
      if (![...conSel.options].some(o => o.value === orig.con)) {
        conSel.appendChild(new Option(orig.con, orig.con));
      }
      conSel.value = orig.con;
    }
    set('f-con-c', orig.con);

    // Cattle details
    set('f-type',   orig.type);
    set('f-loads',  orig.loads);
    set('f-head',   orig.head);
    set('f-wt',     orig.wt);

    // Breed / sex — textarea combos
    const brSel = document.getElementById('f-br');
    if (brSel && orig.breed) {
      if (![...brSel.options].some(o => o.value === orig.breed)) {
        brSel.appendChild(new Option(orig.breed, orig.breed));
      }
      brSel.value = orig.breed;
    }
    set('f-br-c', orig.breed);

    const sxSel = document.getElementById('f-sx');
    if (sxSel && orig.sex) {
      if (![...sxSel.options].some(o => o.value === orig.sex)) {
        sxSel.appendChild(new Option(orig.sex, orig.sex));
      }
      sxSel.value = orig.sex;
    }
    set('f-sx-c', orig.sex);

    // Location / delivery
    const locSel = document.getElementById('f-loc');
    if (locSel && orig.loc) {
      if (![...locSel.options].some(o => o.value === orig.loc)) {
        locSel.appendChild(new Option(orig.loc, orig.loc));
      }
      locSel.value = orig.loc;
    }
    set('f-loc-c',  orig.loc);
    set('f-shrink', orig.shrink);
    set('f-sl-c',   orig.slide);

    // Delivery window — stored as "Month Day - Month Day" text.
    // Can't put this back into date inputs, so store in hidden f-del-raw.
    // readForm() uses f-del-raw as fallback when date pickers are empty.
    set('f-del-raw', orig.del);

    // Pricing
    set('f-ask',          orig.ask);
    set('f-buynow',       orig.buyNow);
    set('f-startbid',     orig.startBid);
    set('f-close-date',   orig.closeDate);
    set('f-close-time',   orig.closeTime);
    set('f-startbid-date',orig.startBidDate);
    set('f-startbid-time',orig.startBidTime);

    // Notes
    set('f-notes',       orig.notes);
    set('f-second-desc', orig.secondDesc);
    set('f-cms-int',     orig.cmsIntNotes);
    set('f-cms-ext',     orig.cmsExtNotes);
    set('f-yt',          orig.yt);
    set('f-img-frame',   orig.imgFrame || 2);
    window.__cmsFramePicker?.();

    // Trigger consignor intel panel
    onConsignorChange();

    if (orig.del) {
      toast('Delivery window copied as text — re-pick dates if needed.');
    } else {
      toast('Lot prefilled from ' + esc(orig.lot) + '. Review and save when ready.');
    }
  }));
}

// ── LDP SAVE ──────────────────────────────────────────────────

async function saveLDPEdit(id) {
  // NOTE: Real enforcement is Firestore security rules.
  const lot = getLot(id);
  requirePerm(canEditLot(lot), 'You do not have permission to edit this lot.');
  const changes = {};
  document.querySelectorAll('.ldp-field').forEach(el => {
    changes[el.dataset.key] = el.value;
  });
  // Validate/normalize the changed fields
  if (lot) {
    const merged = { ...lot, ...changes };
    const err = normalizeLot(merged);
    if (err) { toast(err, true); return; }
  }
  try {
    const updated = await updateLot(id, changes);
    upsertLot(updated);
    await logActivity(id, 'Lot details updated', getUserDisplayName());
    toast('Changes saved');
    renderLDP(id);
  } catch (e) { toast(e.message || 'Failed to save', true); }
}

async function saveSaleInfo(id) {
  try { requirePerm(canChangeStatus(), 'Only admins can edit sale information.'); }
  catch(e) { toast(e.message, true); return; }
  const isPO    = document.getElementById('sale-po-inp')?.checked;
  const price   = isPO ? 'PO' : (document.getElementById('sale-price-inp')?.value.trim() || '');
  const buyer   = isPO ? '' : (document.getElementById('sale-buyer-inp')?.value.trim() || '');
  const down    = document.getElementById('sale-down-inp')?.value.trim() || '';
  const notes   = document.getElementById('sale-notes-inp')?.value.trim() || '';
  const date    = document.getElementById('sale-date-inp')?.value || '';
  const shipDate= document.getElementById('sale-ship-inp')?.value || '';
  if (!isPO && !price) { toast('Enter a sale price or check PO', true); return; }
  try {
    const updated = await updateLot(id, { price, buyer, down, soldNotes: notes, soldDate: date, shipDate });
    upsertLot(updated);
    await logActivity(id, 'Sale info updated', getUserDisplayName());
    toast('Sale info saved');
    renderLDP(id);
  } catch(e) { toast(e.message || 'Failed to save sale info', true); }
}

function openDeleteLotModal(id) {
  const lot = getLot(id);
  if (!lot) return;
  if (lot.status !== 'Archived') { toast('Only archived lots can be deleted.', true); return; }
  try { requirePerm(canDeleteLot(), 'Only admins can delete lots.'); }
  catch(e) { toast(e.message, true); return; }
  document.getElementById('delete-lot-id').value = id;
  const numEl = document.getElementById('delete-lot-num');
  if (numEl) numEl.textContent = lot.lot;
  const inp = document.getElementById('delete-lot-confirm');
  if (inp) inp.value = '';
  const err = document.getElementById('delete-lot-err');
  if (err) err.style.display = 'none';
  document.getElementById('m-delete-lot').style.display = 'flex';
  setTimeout(() => inp?.focus(), 50);
}

async function doDeleteLot() {
  const id = +document.getElementById('delete-lot-id').value;
  const lot = getLot(id);
  if (!lot) return;
  const typed = document.getElementById('delete-lot-confirm')?.value.trim();
  const errEl = document.getElementById('delete-lot-err');
  if (typed !== lot.lot) {
    if (errEl) { errEl.textContent = 'Lot number does not match. Try again.'; errEl.style.display = 'block'; }
    document.getElementById('delete-lot-confirm')?.select();
    return;
  }
  try {
    await deleteLot(id);
    removeLot(id);
    document.getElementById('m-delete-lot').style.display = 'none';
    toast('Lot ' + esc(lot.lot) + ' permanently deleted.');
    updateBadges();
    rerenderCurrentPage();
    if (state.ui.ldpOpen && state.ui.activeLotId === id) closeLDPPanel();
  } catch(e) { toast(e.message || 'Failed to delete lot', true); }
}

// ── NOTES ─────────────────────────────────────────────────────

async function doAddNote(id, type) {
  const inputId = type === 'internal' ? 'int-note-input' : 'ext-note-input';
  const text = document.getElementById(inputId)?.value.trim();
  if (!text) { toast('Enter a note first', true); return; }
  const lot = getLot(id);
  if (!lot) return;
  const note = { ts: new Date().toLocaleString(), text, type, user: getUserDisplayName() };
  const key = type === 'internal' ? 'intNotes' : 'extNotes';
  const updated_notes = [note, ...(lot[key] || [])];
  try {
    const updated = await updateLot(id, { [key === 'intNotes' ? 'intNotes' : 'extNotes']: updated_notes });
    upsertLot(updated);
    document.getElementById(inputId).value = '';
    toast('Note added');
    renderLDP(id);
  } catch (e) { toast(e.message || 'Failed', true); }
}

// ── DOCUMENTS ─────────────────────────────────────────────────

function doPrintDoc(data) {
  const id = +data.lotId;
  const idx = +data.docIdx;
  const l = getLot(id);
  if (!l) return;
  const auctionName = document.getElementById('doc-auction-name')?.value || '';
  const auctionDate = document.getElementById('doc-auction-date')?.value || '';
  const docs = getDocsForLot(l, auctionName, auctionDate, isAdmin());
  if (docs[idx]) printHTML(docs[idx].html());
}

function doDownloadDoc(data) {
  const id = +data.lotId;
  const idx = +data.docIdx;
  const l = getLot(id);
  if (!l) return;
  const auctionName = document.getElementById('doc-auction-name')?.value || '';
  const auctionDate = document.getElementById('doc-auction-date')?.value || '';
  const docs = getDocsForLot(l, auctionName, auctionDate, isAdmin());
  if (docs[idx]) {
    const label = docs[idx].label.replace(/[^a-z0-9]/gi, '_');
    downloadHTML(docs[idx].html(), `${l.lot}_${label}.html`);
  }
}

// ── CONSIGNOR CRUD ────────────────────────────────────────────

function openNewConsignor(returnTo) {
  document.getElementById('con-modal-title').textContent = 'New Consignor Profile';
  document.getElementById('con-edit-id').value = '';
  document.getElementById('con-delete-btn').style.display = 'none';
  document.getElementById('con-modal-returnto').value = returnTo || '';
  ['con-name','con-breeds','con-sexes','con-locs','con-shrink','con-slides'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('m-consignor').style.display = 'flex';
}

function openEditConsignor(id) {
  const c = state.consignors.find(x => x.id === id);
  if (!c) return;
  document.getElementById('con-modal-title').textContent = 'Edit Consignor Profile';
  document.getElementById('con-edit-id').value = c.id;
  document.getElementById('con-delete-btn').style.display = 'inline-flex';
  document.getElementById('con-modal-returnto').value = '';
  document.getElementById('con-name').value = c.name || '';
  document.getElementById('con-breeds').value = (c.breeds || []).join('\n');
  document.getElementById('con-sexes').value = (c.sexes || []).join('\n');
  document.getElementById('con-locs').value = (c.locations || []).join('\n');
  document.getElementById('con-shrink').value = (c.shrink || []).join('\n');
  document.getElementById('con-slides').value = (c.slides || []).join('\n');
  document.getElementById('m-consignor').style.display = 'flex';
}

async function deleteConsignorProfile() {
  try { requirePerm(canDeleteConsignors(), 'Only admins can delete consignors.'); }
  catch(e) { toast(e.message, true); return; }
  const id = document.getElementById('con-edit-id')?.value;
  if (!id) return;
  if (!confirm('Delete this consignor profile?')) return;
  try {
    await deleteConsignor(+id);
    removeConsignorState(+id);
    document.getElementById('m-consignor').style.display = 'none';
    toast('Consignor deleted');
    rerenderCurrentPage();
  } catch (e) { toast(e.message || 'Failed to delete', true); }
}

async function saveConsignor() {
  try { requirePerm(canManageConsignors(), 'Only admins can save consignor profiles.'); }
  catch(permErr) { toast(permErr.message, true); return; }
  const name = document.getElementById('con-name').value.trim();
  if (!name) { toast('Name is required', true); return; }
  const toArr = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
  const profile = {
    name,
    breeds: toArr('con-breeds'),
    sexes: toArr('con-sexes'),
    locations: toArr('con-locs'),
    shrink: toArr('con-shrink'),
    slides: toArr('con-slides')
  };
  const editId = document.getElementById('con-edit-id').value;
  if (editId) profile.id = +editId;
  try {
    const saved = await upsertConsignor(profile);
    upsertConsignorState(saved);
    const returnTo = document.getElementById('con-modal-returnto').value;
    document.getElementById('m-consignor').style.display = 'none';
    toast('Consignor saved');
    if (returnTo === 'builder') {
      const sel = document.getElementById('f-con');
      if (sel) {
        const existing = [...sel.options].find(o => o.value === name);
        if (!existing) { const o = new Option(name, name); sel.appendChild(o); }
        sel.value = name;
        onConsignorChange();
      }
    } else {
      rerenderCurrentPage();
    }
  } catch (e) { toast(e.message || 'Failed to save', true); }
}

// ── ADMIN SETTINGS ────────────────────────────────────────────

async function doAddSetting(key, inputId) {
  requirePerm(canManageSettings(), "Only admins can manage settings.");
  const val = document.getElementById(inputId)?.value.trim();
  if (!val) return;
  const cleaned = val.replace(/[<>]/g, '').trim();
  if (!cleaned) return;
  const existing = state.settings[key] || [];
  if (!existing.includes(cleaned)) {
    const arr = normalizeSettingArray([...existing, cleaned]);
    await saveSetting(key, arr);
    state.settings[key] = arr;
    document.getElementById(inputId).value = '';
    rerenderCurrentPage();
    toast(`Added: ${esc(cleaned)}`);
  }
}

async function doRemoveSetting(key, idx) {
  requirePerm(canManageSettings(), "Only admins can manage settings.");
  const arr = [...(state.settings[key] || [])];
  arr.splice(idx, 1);
  await saveSetting(key, arr);
  state.settings[key] = arr;
  rerenderCurrentPage();
  toast('Removed');
}

async function saveAdminInfo() {
  requirePerm(canManageSettings(), 'Only admins can save company info.');
  const btn = document.getElementById('save-admin-btn');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  try {
    const fields = { company: 'a-co', address: 'a-addr', phone: 'a-ph', email: 'a-em', website: 'a-web', terms: 'a-terms' };
    for (const [key, id] of Object.entries(fields)) {
      const val = document.getElementById(id)?.value || '';
      await saveSetting(key, val);
      state.settings[key] = val;
    }
    toast('Company info saved');
  } catch (e) {
    toast(e.message || 'Failed to save settings', true);
  } finally {
    if (btn) { btn.textContent = 'Save Company Info'; btn.disabled = false; }
  }
}

// ── CSV BUTTONS ───────────────────────────────────────────────

// ── CSV LOT IMPORT ────────────────────────────────────────────
// Upload a numbered working-sheet CSV and create Staged lots.
// Column matching is case-insensitive; lots whose Lot Number
// already exists are skipped so re-imports are safe.

function impCol(row, names) {
  for (const name of names) {
    const key = Object.keys(row).find(k => k.toLowerCase().trim() === name.toLowerCase());
    if (key != null) {
      const v = String(row[key] ?? '').trim();
      if (v !== '') return v;
    }
  }
  return '';
}

function workingRowToLot(row, seq) {
  const lotNum = impCol(row, ['Lot Number']);
  const baseMatch = lotNum.match(/^(\d+)/);
  return {
    lot: lotNum,
    seq,
    gid: baseMatch ? baseMatch[1] : '',
    sale: 'Timed Auction',
    rep: impCol(row, ['Rep', 'Representative']),
    con: impCol(row, ['Consignor', 'Seller']),
    breed: impCol(row, ['Breed']),
    sex: impCol(row, ['Sex']),
    type: impCol(row, ['Type']),
    loads: parseFloat(impCol(row, ['# of loads', 'Load Count'])) || 1,
    head: parseInt(impCol(row, ['Head', 'Head Count']), 10) || 0,
    wt: impCol(row, ['Weight', 'Base Weight']),
    del: impCol(row, ['Delivery']),
    loc: impCol(row, ['Location', 'Lot Location']),
    shrink: impCol(row, ['Shrink']),
    slide: impCol(row, ['Slide']),
    notes: impCol(row, ['Description', 'LotDescription']),
    secondDesc: impCol(row, ['Description 2', 'Second Description', 'Second Notes']),
    yt: impCol(row, ['Automated Embedded Link', 'Preview Video Link', 'YouTube link']),
    imgFrame: 2,
    ask: '', buyNow: '', startBid: '',
    listDate: new Date().toISOString().split('T')[0],
    status: STATUS.STAGED,
    log: [], intNotes: [], extNotes: []
  };
}

async function importLotsCSV(file) {
  if (!canCreateLot()) { toast('You do not have permission to create lots', true); return; }
  Papa.parse(file, {
    header: true,
    skipEmptyLines: 'greedy',
    complete: async (results) => {
      const candidates = [];
      for (const row of results.data) {
        const lot = impCol(row, ['Lot Number']);
        const con = impCol(row, ['Consignor', 'Seller']);
        const head = impCol(row, ['Head', 'Head Count']);
        if (lot && con && head) candidates.push(row);
      }
      if (!candidates.length) {
        toast('No importable rows found — make sure the CSV has Lot Number, Consignor, and Head columns (run it through the Lot #\u2019s tab first if it isn\u2019t numbered).', true);
        return;
      }
      const existing = new Set(state.lots.map(l => String(l.lot).trim()));
      const fresh = candidates.filter(r => !existing.has(impCol(r, ['Lot Number'])));
      const skipped = candidates.length - fresh.length;
      if (!fresh.length) { toast('All ' + candidates.length + ' lots already exist — nothing to import', true); return; }
      const msg = 'Import ' + fresh.length + ' lot(s) to Staged?' + (skipped ? '\n(' + skipped + ' skipped — lot number already exists)' : '');
      if (!confirm(msg)) return;

      toast('Importing ' + fresh.length + ' lots\u2026');
      let ok = 0, failed = [];
      let seq = 10 + Math.max(0, ...state.lots.map(l => +l.seq || 0));
      for (const row of fresh) {
        try {
          const saved = await insertLot(workingRowToLot(row, seq));
          upsertLot(saved);
          logActivity(saved.id, 'Imported from CSV', getUserDisplayName());
          seq += 10; ok++;
        } catch (e) {
          failed.push(impCol(row, ['Lot Number']) + ' (' + (e.message || 'error') + ')');
        }
      }
      updateBadges();
      rerenderCurrentPage();
      if (failed.length) toast('Imported ' + ok + '; failed: ' + failed.join(', '), true);
      else toast('Imported ' + ok + ' lot(s) to Staged');
    },
    error: (err) => toast('Could not read CSV: ' + err.message, true)
  });
}

function setupCSVButtons() {
  document.getElementById('import-csv-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.addEventListener('change', () => { if (input.files[0]) importLotsCSV(input.files[0]); });
    input.click();
  });

  document.getElementById('csv-all-btn')?.addEventListener('click', () => {
    const page = state.ui.activePage;
    if (page === 'staged') downloadStagedCSV(state.lots);
    else if (page === 'active') downloadCSV(getActiveLots(), `BidPath_Active_${new Date().toISOString().split('T')[0]}.csv`);
  });
  document.getElementById('cp-zip-btn')?.addEventListener('click', () => {
    // Checked lots if any are selected, otherwise everything on this page
    const ids = [...document.querySelectorAll('.lot-cb:checked')].map(el => +el.dataset.id);
    const page = state.ui.activePage;
    let lots;
    if (ids.length) lots = state.lots.filter(l => ids.includes(l.id));
    else if (page === 'active') lots = getActiveLots();
    else lots = state.lots.filter(l => l.status === STATUS.STAGED);
    downloadCountryZip(lots);
  });
  document.getElementById('csv-checked-btn')?.addEventListener('click', () => {
    const ids = [...document.querySelectorAll('.lot-cb:checked')].map(el => +el.dataset.id);
    if (!ids.length) { toast('Select at least one lot', true); return; }
    downloadSelectedCSV(state.lots, ids);
  });
  document.getElementById('check-all-staged')?.addEventListener('change', e => {
    document.querySelectorAll('.lot-cb').forEach(cb => cb.checked = e.target.checked);
  });
}

// ── BUILDER EVENTS ────────────────────────────────────────────

function setupBuilderEvents() {
  // Only wire elements that live inside #main-content (page-specific)
  // Modal buttons and app-shell buttons are handled by delegated events in attachAppEvents
  const wire = (id, event, fn) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.wired === event) return;
    el.addEventListener(event, fn);
    el.dataset.wired = event;
  };
  wire('save-lot-btn',   'click',  doSaveLot);
  wire('clear-form-btn', 'click',  clearBuilderForm);
  wire('new-con-btn',    'click',  () => openNewConsignor('builder'));
  wire('f-con',          'change', onConsignorChange);
  wire('f-con-c',        'input',  onConsignorChange);
  wire('new-con-page-btn','click', () => openNewConsignor());
  wire('save-admin-btn', 'click',  saveAdminInfo);
}

// ── SEARCH ────────────────────────────────────────────────────

function handleSearch(query) {
  const results = document.getElementById('search-results');
  if (!results) return;
  if (!query) { results.style.display = 'none'; return; }
  const hits = searchLots(query).slice(0, 8);
  if (!hits.length) { results.style.display = 'none'; return; }
  results.innerHTML = hits.map(l => `
    <div class="sr-item" data-action="open-ldp" data-id="${l.id}">
      <strong>${esc(l.lot)}</strong> — ${esc(l.con) || '—'} · ${l.head || 0} hd · <span class="badge badge-${esc((l.status||'').toLowerCase().replace(/ /g,'-'))}" style="font-size:10px;">${esc(l.status)}</span>
    </div>`).join('');
  results.style.display = 'block';
  results.querySelectorAll('.sr-item').forEach(el => {
    el.addEventListener('click', () => {
      renderLDP(+el.dataset.id);
      results.style.display = 'none';
      document.getElementById('global-search').value = '';
    });
  });
}

// ── LDP OPEN/CLOSE ────────────────────────────────────────────

function closeLDPPanel() {
  document.getElementById('ldp')?.classList.remove('open');
  document.getElementById('ldp-overlay')?.classList.remove('open');
  state.ui.ldpOpen = false;
  state.ui.activeLotId = null;
}

// LDP expand removed - wider state is default

// ── UTILITIES ─────────────────────────────────────────────────

function daysHtml(listDate) {
  if (!listDate) return '—';
  const days = Math.floor((Date.now() - new Date(listDate + 'T12:00:00').getTime()) / 86400000);
  const cls = days > 30 ? 'days-warn' : days > 14 ? 'days-caution' : '';
  return `<span class="${cls}">${days}d</span>`;
}

function formatCloseDisplay(closeDate, closeTime) {
  return `${closeDate}${closeTime ? ' ' + closeTime : ''}`;
}

function getCloseClass(closeDate, closeTime) {
  if (!closeDate) return '';
  const dt = new Date(`${closeDate}T${closeTime || '17:00'}:00`);
  const diff = dt.getTime() - Date.now();
  if (diff < 0) return 'close-past';
  if (diff < 6 * 3600000) return 'close-urgent';
  if (diff < 24 * 3600000) return 'close-soon';
  return '';
}

function updateBadges() {
  const counts = getBadgeCounts();
  document.querySelectorAll('[data-page="staged"] .nav-badge').forEach(el => el.textContent = counts.staged || '');
  document.querySelectorAll('[data-page="active"] .nav-badge').forEach(el => el.textContent = counts.active || '');
  document.querySelectorAll('[data-page="sold"] .nav-badge').forEach(el => el.textContent = counts.sold || '');
  // Hide badge entirely when count is 0
  document.querySelectorAll('.nav-badge').forEach(el => { el.style.display = el.textContent ? '' : 'none'; });
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('cms-theme', isDark ? 'light' : 'dark');
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = isDark ? '☾' : '☀';
}

function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' toast-error' : ' toast-success');
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function showLoadingScreen() {
  document.getElementById('app').innerHTML = `
    <div class="loading-screen">
      <div class="loading-logo">★</div>
      <div class="loading-text">Loading CMS…</div>
    </div>`;
}

function hideLoadingScreen() { /* renderApp() replaces #app innerHTML entirely */ }

function showBootError(msg) {
  document.getElementById('app').innerHTML = `
    <div style="min-height:100vh;background:#0f1520;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:#1a2235;border:1px solid #c0392b;border-radius:10px;padding:32px;max-width:500px;width:100%;">
        <div style="color:#f4a49e;font-size:18px;font-weight:700;margin-bottom:12px;">⚠ Startup Error</div>
        <div style="color:#d4dce8;font-size:13px;line-height:1.6;font-family:monospace;white-space:pre-wrap;">${escHtml ? escHtml(msg) : msg}</div>
        <div style="color:#5a7a9a;font-size:11px;margin-top:16px;">Open browser console (F12) for full details.</div>
      </div>
    </div>`;
}

// Boot the app
document.addEventListener('DOMContentLoaded', () => {
  // Catch any synchronous errors during boot
  window.onerror = (msg, src, line, col, err) => {
    showBootError(`${msg}\n\nFile: ${src}\nLine: ${line}`);
    return true;
  };
  window.onunhandledrejection = (e) => {
    showBootError(String(e.reason?.message || e.reason || 'Unknown error'));
  };

  // Verify the Firestore adapter loaded
  if (typeof window.CMSCountryDB === 'undefined') {
    showBootError('Data layer failed to load.\n\nCheck your internet connection and try refreshing.');
    return;
  }

  boot().catch(e => {
    console.error('Boot failed:', e);
    showBootError(`Boot failed:\n${e.message || String(e)}`);
  });
});



// ============================================================
// LISTING IMAGE FRAME PICKER (builder form)
// Shows the 3 real frames YouTube generates from the video's
// footage; click one to use it as the lot's listing image.
// ============================================================
(function () {
  function updatePicker() {
    const holder = document.getElementById('f-img-frame-picker');
    if (!holder) return;
    const yt = document.getElementById('f-yt')?.value || '';
    const vid = cpVideoId(yt);
    const sel = parseInt(document.getElementById('f-img-frame')?.value, 10) || 2;
    if (!vid) {
      holder.innerHTML = '<span style="font-size:12px;color:#8a8f99;">Enter a YouTube URL above to preview frames</span>';
      return;
    }
    holder.innerHTML = [1, 2, 3].map(n => `
      <img src="https://i.ytimg.com/vi/${vid}/hq${n}.jpg" data-frame="${n}"
           title="Frame ${n}" loading="lazy"
           style="width:120px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;cursor:pointer;
                  border:3px solid ${n === sel ? '#b8860b' : 'transparent'};
                  opacity:${n === sel ? '1' : '.6'};">`).join('');
  }
  window.__cmsFramePicker = updatePicker;

  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'f-yt') updatePicker();
  });
  document.addEventListener('click', e => {
    const img = e.target.closest('#f-img-frame-picker img');
    if (img) {
      const hidden = document.getElementById('f-img-frame');
      if (hidden) hidden.value = img.dataset.frame;
      updatePicker();
      return;
    }
    if (e.target && (e.target.id === 'clear-form-btn' || e.target.id === 'save-lot-btn')) {
      setTimeout(updatePicker, 100);
    }
  });
  // Render whenever the builder form appears
  const mo = new MutationObserver(() => {
    if (document.getElementById('f-img-frame-picker') &&
        !document.getElementById('f-img-frame-picker').hasChildNodes()) {
      updatePicker();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
