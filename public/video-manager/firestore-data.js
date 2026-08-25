/* =============================================================
 * CMS Video Manager — Firestore data layer
 * -------------------------------------------------------------
 * Thin wrapper around the `videoRecords` Firestore collection.
 * repository.js is the only thing that imports this — it owns
 * business logic (search/filter/exceptions/activity log/etc.);
 * this file just knows how to read and write documents.
 *
 * Mirrors the exact init pattern already proven in
 * shared/cms-data.js (same SDK version, same getApps()/getApp()
 * reuse guard, same demo-mode fallback when Firebase isn't
 * configured) — this app runs in its own iframe/tab, so it needs
 * its own Firebase App instance, but Firebase Auth's session is
 * shared across same-origin frames via IndexedDB, so a user
 * already signed into the shell is automatically signed in here
 * too.
 *
 * Collection shape: videoRecords/{id} — one document per video
 * record, `id` matching the record's own internal `id` field
 * (see repository.js). Clip entries never have their `fileHandle`
 * (a live browser File object) written here — see stripFileHandles()
 * — actual clip bytes need Firebase Storage, which isn't wired up
 * yet (see docs/MONDAY-MIGRATION.md).
 *
 * Also holds referenceData/{consignors|sireTypes|damTypes} — the
 * Video ID Manager's code dictionaries, small enough that each is one
 * document holding its whole list rather than one doc per item.
 * ============================================================= */

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, deleteDoc, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { firebaseConfig, FIREBASE_CONFIGURED } from '../shared/firebase-config.js';

const COLLECTION = 'videoRecords';
const REFERENCE_COLLECTION = 'referenceData';
const BATCH_MAX = 450; // Firestore hard-caps a batch at 500 writes; leave headroom

let db = null, auth = null;
if (FIREBASE_CONFIGURED) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export const configured = FIREBASE_CONFIGURED;

function requireDb() {
  if (!db) throw new Error('Video Manager needs Firebase configured to load real data (see shared/firebase-config.js).');
  return db;
}

export function isSignedIn() {
  return !!(auth && auth.currentUser);
}
export function currentUserEmail() {
  try { return (auth && auth.currentUser && auth.currentUser.email) || ''; } catch { return ''; }
}

/** Strip anything Firestore can't store — a live File object is the only offender today. */
function stripFileHandles(record) {
  if (!record.clips || !record.clips.length) return record;
  return {
    ...record,
    clips: record.clips.map(({ fileHandle, ...rest }) => rest),
  };
}

/** Every document, unfiltered — repository.js does search/filter/sort client-side, same as the old mock version did. 629 documents is trivial for a single read. */
export async function fetchAllVideos() {
  if (!db) return [];
  const snap = await getDocs(collection(db, COLLECTION));
  const out = [];
  snap.forEach(d => out.push(d.data()));
  return out;
}

export async function fetchVideo(id) {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? snap.data() : null;
}

/** Full overwrite of one record (repository.js always writes the complete record, not a partial patch). */
export async function saveVideo(record) {
  requireDb();
  await setDoc(doc(db, COLLECTION, record.id), stripFileHandles(record));
}

export async function deleteVideoDoc(id) {
  requireDb();
  await deleteDoc(doc(db, COLLECTION, id));
}

/**
 * Bulk import — used only by the Monday migration flow. Chunks into
 * Firestore batch writes (max ~450/batch) so hundreds of records
 * commit as a handful of atomic batches instead of one write per
 * record. Idempotent: every record's `id` is a stable value derived
 * from its Monday item id (see the import UI), so re-running this
 * with the same input just overwrites the same documents rather than
 * creating duplicates.
 */
export async function importVideosBatch(records, onProgress) {
  requireDb();
  const clean = records.map(stripFileHandles);
  let written = 0;
  for (let i = 0; i < clean.length; i += BATCH_MAX) {
    const chunk = clean.slice(i, i + BATCH_MAX);
    const batch = writeBatch(db);
    chunk.forEach(record => batch.set(doc(db, COLLECTION, record.id), record));
    await batch.commit();
    written += chunk.length;
    if (onProgress) onProgress(written, clean.length);
  }
  return written;
}

/**
 * Reference dictionaries (consignors, sire/dam types) — small enough to
 * live as one document per list rather than one document per item.
 * `key` is 'consignors' | 'sireTypes' | 'damTypes'.
 */
export async function fetchReferenceList(key) {
  if (!db) return null;
  const snap = await getDoc(doc(db, REFERENCE_COLLECTION, key));
  return snap.exists() ? snap.data().items : null;
}

export async function saveReferenceList(key, items) {
  requireDb();
  await setDoc(doc(db, REFERENCE_COLLECTION, key), { items });
}
