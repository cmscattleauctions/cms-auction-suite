/* =============================================================
 * CMS Auction Suite — Shared Data layer (Firestore)
 * -------------------------------------------------------------
 * One small ES module that both sub-apps (Listings + Banners)
 * load. It wraps Firebase Firestore so the rest of the app can
 * stay as plain, non-module scripts and just call window.CMSData.
 *
 * What it stores (all in Firestore, shared across all users):
 *
 *   listingProjects/{autoId}
 *       name, payload (JSON string of the whole builder state),
 *       updatedAt, updatedBy, createdAt
 *
 *   stateImages/{ABBR}            (ABBR = "TX", "NM", ...)
 *       abbr, ext ("png"|"svg"), dataUrl (base64 data: URL),
 *       updatedAt, updatedBy
 *
 *   appSettings/{key}             (key = "listings")
 *       value (JSON string), updatedAt
 *
 * Why Firestore (not Storage) for the state images:
 *   The banner generator draws each state image onto a <canvas>
 *   and then exports the canvas to PNG. A cross-origin image
 *   (e.g. a Storage download URL) would "taint" the canvas and
 *   break the export unless the bucket has a CORS config applied
 *   from the command line. Storing the image as a base64 data:
 *   URL sidesteps that entirely — data URLs never taint a canvas
 *   and need no extra setup. Uploads are downscaled if needed to
 *   stay under the Firestore 1 MB document limit.
 * ============================================================= */

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { firebaseConfig, FIREBASE_CONFIGURED } from './firebase-config.js';

/* ----- init (reuse the already-initialized default app if present) ----- */
let db = null, auth = null;
if (FIREBASE_CONFIGURED) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export const configured = FIREBASE_CONFIGURED;

function requireDb() {
  if (!db) throw new Error('Cloud saving is unavailable in demo mode (Firebase is not configured).');
  return db;
}
function currentEmail() {
  try { return (auth && auth.currentUser && auth.currentUser.email) || ''; } catch { return ''; }
}
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

/* =============================================================
 * Listing projects
 * ============================================================= */
const FIRESTORE_MAX = 1000000; // 1 MB document hard limit

export async function listProjects() {
  if (!db) return [];
  const q = query(collection(db, 'listingProjects'), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  const out = [];
  snap.forEach(d => {
    const data = d.data() || {};
    out.push({
      id: d.id,
      name: data.name || '(untitled)',
      updatedAt: tsToMillis(data.updatedAt),
      updatedBy: data.updatedBy || '',
    });
  });
  return out;
}

export async function loadProject(id) {
  requireDb();
  const snap = await getDoc(doc(db, 'listingProjects', id));
  if (!snap.exists()) throw new Error('That saved project no longer exists.');
  const data = snap.data() || {};
  let payload = data.payload;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  return { id: snap.id, name: data.name || '', payload };
}

/**
 * Save (or overwrite) a project.
 *   id   — existing project id, or null to create a new one
 *   name — friendly name shown in the list
 *   data — the full builder-state object (will be JSON-stringified)
 * Returns the project id.
 */
export async function saveProject(id, name, data) {
  requireDb();
  const payload = JSON.stringify(data);
  if (payload.length > FIRESTORE_MAX - 5000) {
    throw new Error('This project is too large to save to the cloud (over ~1 MB). Try removing very large pasted notes.');
  }
  const base = {
    name: name || 'Untitled listing',
    payload,
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  };
  if (id) {
    await setDoc(doc(db, 'listingProjects', id), base, { merge: true });
    return id;
  }
  base.createdAt = serverTimestamp();
  const ref = await addDoc(collection(db, 'listingProjects'), base);
  return ref.id;
}

export async function renameProject(id, name) {
  requireDb();
  await updateDoc(doc(db, 'listingProjects', id), { name: name || 'Untitled listing', updatedAt: serverTimestamp() });
}

export async function deleteProject(id) {
  requireDb();
  await deleteDoc(doc(db, 'listingProjects', id));
}

/* =============================================================
 * App settings (shared, one doc per key)
 * ============================================================= */
export async function getSettings(key) {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'appSettings', key));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  if (typeof data.value === 'string') {
    try { return JSON.parse(data.value); } catch { return null; }
  }
  return data.value || null;
}
export async function setSettings(key, value) {
  if (!db) return;
  await setDoc(doc(db, 'appSettings', key), {
    value: JSON.stringify(value),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/* =============================================================
 * State images (banner generator) — base64 data URLs in Firestore
 * ============================================================= */

/** Returns a map: { TX: {abbr, ext, dataUrl, updatedAt, updatedBy}, ... } */
export async function listStateImages() {
  if (!db) return {};
  const snap = await getDocs(collection(db, 'stateImages'));
  const out = {};
  snap.forEach(d => {
    const data = d.data() || {};
    if (!data.dataUrl) return;
    const abbr = (data.abbr || d.id || '').toUpperCase();
    out[abbr] = {
      abbr,
      ext: data.ext || 'png',
      dataUrl: data.dataUrl,
      updatedAt: tsToMillis(data.updatedAt),
      updatedBy: data.updatedBy || '',
    };
  });
  return out;
}

export async function saveStateImage(abbr, dataUrl, ext) {
  requireDb();
  abbr = (abbr || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(abbr)) throw new Error('State abbreviation must be exactly 2 letters.');
  if (!dataUrl || dataUrl.indexOf('data:') !== 0) throw new Error('Image data is missing or invalid.');
  if (dataUrl.length > FIRESTORE_MAX - 5000) {
    throw new Error('Image is still too large after compression. Try a smaller PNG.');
  }
  await setDoc(doc(db, 'stateImages', abbr), {
    abbr, ext: ext || 'png', dataUrl,
    updatedAt: serverTimestamp(),
    updatedBy: currentEmail(),
  });
}

export async function deleteStateImage(abbr) {
  requireDb();
  abbr = (abbr || '').toUpperCase();
  await deleteDoc(doc(db, 'stateImages', abbr));
}

/* =============================================================
 * File → data URL helpers (used by both apps for uploads)
 * -------------------------------------------------------------
 * PNGs are auto-downscaled if they would blow past the Firestore
 * document limit. SVGs are stored as-is (they are tiny text).
 * ============================================================= */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}
function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode that image.'));
    img.src = src;
  });
}

/**
 * Turn an uploaded image File into a data: URL suitable for Firestore.
 * Returns { dataUrl, ext }.
 */
export async function imageFileToStorableDataUrl(file) {
  const name = (file.name || '').toLowerCase();
  const isSvg = name.endsWith('.svg') || file.type === 'image/svg+xml';
  const raw = await readFileAsDataURL(file);

  if (isSvg) return { dataUrl: raw, ext: 'svg' };

  // PNG/JPEG: re-encode to PNG, downscaling progressively until it
  // comfortably fits under the Firestore document limit.
  const img = await loadImageEl(raw);
  const TARGET = 780000; // keep well under 1 MB of base64
  let maxEdge = Math.max(img.width, img.height);
  let dataUrl = raw;

  // If the original already fits and is reasonably sized, keep it.
  if (raw.length <= TARGET && maxEdge <= 2000) return { dataUrl: raw, ext: 'png' };

  // Otherwise re-encode, shrinking by ~15% each pass if still too big.
  const caps = [1600, 1400, 1200, 1000, 850, 700, 560];
  for (const cap of caps) {
    if (maxEdge <= cap && dataUrl.length <= TARGET && dataUrl !== raw) break;
    const scale = Math.min(1, cap / maxEdge);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    dataUrl = c.toDataURL('image/png');
    if (dataUrl.length <= TARGET) break;
  }
  return { dataUrl, ext: 'png' };
}

export function isAuthed() {
  return !!(auth && auth.currentUser);
}
