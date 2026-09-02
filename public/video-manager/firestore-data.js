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
 * record, `id` matching the record's own internal `id` field (see
 * repository.js). Clips carry a real Storage downloadUrl/storagePath
 * (see storage-data.js) rather than a live browser File object —
 * stripFileHandles() is just a defensive backstop in case a `File`
 * ever ends up on a clip in memory (Firestore can't serialize one),
 * not the primary mechanism.
 *
 * Also holds referenceData/{consignors|sireTypes|damTypes} — the
 * Video ID Manager's code dictionaries, small enough that each is one
 * document holding its whole list rather than one doc per item.
 * ============================================================= */

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, deleteDoc, writeBatch,
  addDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { firebaseConfig, FIREBASE_CONFIGURED } from '../shared/firebase-config.js';

const COLLECTION = 'videoRecords';
const REFERENCE_COLLECTION = 'referenceData';
const JOBS_COLLECTION = 'clipTransferJobs';
const BATCH_MAX = 450; // Firestore hard-caps a batch at 500 writes; leave headroom
// Generous: a job can now be processed either by the Cloud Function (540s cap)
// or by the local worker script (scripts/transfer-clips.mjs) running on
// whatever upload speed the operator's own connection has, where a single
// large clip can legitimately take well over 10 minutes.
const TRANSFER_TIMEOUT_MS = 60 * 60 * 1000;

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

/**
 * ONLY the public Cattle Video Upload page (public/video-upload/) should
 * ever call this — never the internal Video Manager, which relies on the
 * shell's real (approved-staff) session already being present via
 * shared IndexedDB, per this file's header comment. Resolves once
 * signed in, anonymous or otherwise (a no-op if already signed in —
 * e.g. an approved staffer testing the public page in the same browser
 * keeps their real session, never gets silently downgraded to anon).
 */
export async function ensureAnonymousAuth() {
  if (!auth) throw new Error('Firebase is not configured.');
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export function currentUid() {
  return (auth && auth.currentUser && auth.currentUser.uid) || null;
}

export function isSignedIn() {
  return !!(auth && auth.currentUser);
}
export function currentUserEmail() {
  try { return (auth && auth.currentUser && auth.currentUser.email) || ''; } catch { return ''; }
}

/** ID token for calling the transferClip Cloud Function — that endpoint verifies it server-side (see functions/index.js) rather than trusting Firestore/Storage rules, since it's a second front door onto Storage. */
/**
 * Ask the transferClip Cloud Function to move a clip from a remote URL
 * (Monday's asset public_url) into Storage — used only by the Monday
 * clips migration. Writes a clipTransferJobs doc (a normal rules-gated
 * Firestore write, same trust model as everything else in this app),
 * which triggers the function; then watches that same doc until it
 * flips to done/error. See functions/index.js for why this goes through
 * Firestore instead of a direct HTTP call to the function.
 */
export function requestClipTransfer(recordId, publicUrl, filename) {
  return new Promise((resolve, reject) => {
    if (!db || !auth?.currentUser) { reject(new Error('Not signed in')); return; }

    addDoc(collection(db, JOBS_COLLECTION), {
      recordId, publicUrl, filename,
      requestedBy: auth.currentUser.uid,
      status: 'pending',
      createdAt: serverTimestamp(),
    }).then(jobRef => {
      const timeoutId = setTimeout(() => {
        unsub();
        reject(new Error('Transfer timed out waiting for the server'));
      }, TRANSFER_TIMEOUT_MS);

      const unsub = onSnapshot(jobRef, snap => {
        const data = snap.data();
        if (!data || data.status === 'pending') return;
        clearTimeout(timeoutId);
        unsub();
        if (data.status === 'done') {
          resolve({ storagePath: data.storagePath, downloadUrl: data.downloadUrl, sizeBytes: data.sizeBytes });
        } else {
          reject(new Error(data.error || 'Transfer failed'));
        }
      }, err => {
        clearTimeout(timeoutId);
        unsub();
        reject(err);
      });
    }).catch(reject);
  });
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
