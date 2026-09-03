/* =============================================================
 * CMS Auction Suite — Admin Settings data layer
 * -------------------------------------------------------------
 * User management for the suite admin (jayton.h@cmslivestock.com —
 * see isSuiteAdmin() in docs/firestore.rules, the actual security
 * boundary; everything here is just the client side of that).
 *
 * Approve / role / allowedTabs are plain Firestore reads/writes on
 * users/{uid} — isSuiteAdmin() already lets the admin read/update any
 * user's doc directly, no server round-trip needed.
 *
 * Create-account and set-password go through the adminJobs Firestore-
 * trigger pattern (functions/index.js's adminRunJob) since both need
 * the Admin SDK: creating a Firebase Auth account from the client
 * would sign the admin's own session OUT and into the new account,
 * and the client SDK can only change the CURRENTLY signed-in user's
 * own password, not anyone else's.
 * ============================================================= */

import { getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, updateDoc,
  addDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { FIREBASE_CONFIGURED } from './firebase-config.js';

export const SUITE_ADMIN_EMAIL = 'jayton.h@cmslivestock.com';

let auth = null, db = null;
if (FIREBASE_CONFIGURED) {
  const app = getApp(); // shell.js always loads auth.js first, which already initialized this
  auth = getAuth(app);
  db = getFirestore(app);
}

/** True for the one account allowed to see/use Admin Settings — UX gating only, the real boundary is isSuiteAdmin() in the rules. */
export function isCurrentUserSuiteAdmin() {
  const email = auth && auth.currentUser && auth.currentUser.email;
  return !!email && email.toLowerCase() === SUITE_ADMIN_EMAIL;
}

/** All users/{uid} docs — only resolves for the suite admin (see isSuiteAdmin()'s read rule). */
export async function listAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => (a.email || '').localeCompare(b.email || ''));
}

export async function setApproved(uid, approved) {
  await updateDoc(doc(db, 'users', uid), { approved: !!approved });
}

/** @param patch { role?: string, allowedTabs?: string[]|null } — null/omitted allowedTabs means every tab. */
export async function setResponsibilities(uid, patch) {
  await updateDoc(doc(db, 'users', uid), patch);
}

const JOB_TIMEOUT_MS = 20000;

function runAdminJob(op, params) {
  return new Promise((resolve, reject) => {
    if (!db || !auth || !auth.currentUser) { reject(new Error('Not signed in')); return; }
    addDoc(collection(db, 'adminJobs'), {
      op, params,
      requestedBy: auth.currentUser.uid,
      status: 'pending',
      createdAt: serverTimestamp(),
    }).then(jobRef => {
      const timeoutId = setTimeout(() => {
        unsub();
        reject(new Error('Timed out waiting for the server.'));
      }, JOB_TIMEOUT_MS);

      const unsub = onSnapshot(jobRef, snap => {
        const data = snap.data();
        if (!data || data.status === 'pending') return;
        clearTimeout(timeoutId);
        unsub();
        if (data.status === 'done') resolve(data.result || {});
        else reject(new Error(data.error || 'Operation failed.'));
      }, err => {
        clearTimeout(timeoutId);
        unsub();
        reject(err);
      });
    }).catch(reject);
  });
}

/** @returns {Promise<{uid: string}>} */
export function createUserAccount({ email, password, role, allowedTabs }) {
  return runAdminJob('createUser', { email, password, role: role || '', allowedTabs: allowedTabs || null });
}

export function setUserPassword(uid, password) {
  return runAdminJob('setPassword', { uid, password });
}
