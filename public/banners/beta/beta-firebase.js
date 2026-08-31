/* =============================================================
 * Beta OBS Builder — Firebase bootstrap for the Banners app
 * -------------------------------------------------------------
 * The Banners tab's own document already loads public/shared/cms-data.js
 * (banner state images) via a <script type="module"> injected in
 * index.html's <head>, which calls initializeApp() first — so this
 * module MUST reuse that same app instance (getApps().length ? getApp()
 * : initializeApp(...)) rather than calling initializeApp() again, or
 * Firebase throws "Firebase App named '[DEFAULT]' already exists".
 * This is the exact init pattern already proven in shared/cms-data.js
 * and video-manager/firestore-data.js — mirrored here, not reinvented.
 *
 * Firebase Auth's persisted session (IndexedDB) is shared across
 * same-origin frames, so a user already signed into the shell is
 * automatically signed in here too, same as those two modules.
 * ============================================================= */

import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';

import { firebaseConfig, FIREBASE_CONFIGURED } from '../../shared/firebase-config.js';

let app = null, auth = null, db = null, storage = null;
if (FIREBASE_CONFIGURED) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export const betaFirebaseReady = FIREBASE_CONFIGURED;

export function getBetaDb() { return db; }
export function getBetaStorage() { return storage; }
export function getBetaAuth() { return auth; }

/** Logs a structured diagnostic for a failed Storage op: uid, path, project, bucket, error code/message. */
export function logStorageError({ op, path }, err) {
  console.error('[beta-firebase] Storage operation failed', {
    op, path,
    uid: auth && auth.currentUser ? auth.currentUser.uid : null,
    projectId: storage && storage.app ? storage.app.options.projectId : null,
    bucket: storage && storage.app ? storage.app.options.storageBucket : null,
    code: err && err.code,
    message: err && err.message,
  });
}

/** Resolves once with the current Firebase Auth user (or null in demo mode / signed out). */
export function currentUser() {
  if (!FIREBASE_CONFIGURED) return Promise.resolve(null);
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user || null); });
  });
}

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, orderBy, writeBatch,
  ref, uploadBytes, getDownloadURL, deleteObject,
};
