/* =============================================================
 * CMS Auction Suite — Auth module
 * -------------------------------------------------------------
 * Wraps Firebase Auth + Firestore. Handles:
 *   - Email/password login
 *   - Email/password sign-up (creates pending account + Firestore doc)
 *   - Approval gate: checks Firestore doc field `approved === true`
 *   - Sign-out
 *   - Initial state resolution
 *
 * Approval flow:
 *   1. User signs up → Firebase creates account → user is signed in
 *   2. We create users/{uid} in Firestore with { approved: false, ... }
 *   3. App reads users/{uid} on every load
 *   4. If approved: shows the suite shell
 *   5. If not: shows pending screen with sign-out
 *   6. Owner approves via Firebase Console (toggles `approved: true`)
 *   7. User refreshes → doc re-read → admitted
 *
 * Why Firestore not custom claims:
 *   Custom claims require the Firebase Admin SDK, which requires a
 *   service account key. Some Google Workspace org policies block
 *   service account key creation. Firestore needs no admin SDK.
 * ============================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

import { firebaseConfig, FIREBASE_CONFIGURED } from './firebase-config.js';

/* ----- Initialize ----- */
let app = null;
let auth = null;
let db = null;
if (FIREBASE_CONFIGURED) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

/* =============================================================
 * Public API
 * ============================================================= */

/**
 * Wait for Firebase to determine the current auth state, then
 * resolve with one of:
 *   { state: 'signed-out' }
 *   { state: 'pending',  user }      — signed in but not approved
 *   { state: 'approved', user }      — full access
 *   { state: 'demo' }                — Firebase not configured
 */
export function resolveAuthState() {
  if (!FIREBASE_CONFIGURED) {
    return Promise.resolve({ state: 'demo' });
  }
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) return resolve({ state: 'signed-out' });
      const approved = await checkApproved(user);
      resolve({ state: approved ? 'approved' : 'pending', user });
    });
  });
}

export function watchAuthState(callback) {
  if (!FIREBASE_CONFIGURED) return () => {};
  return onAuthStateChanged(auth, async user => {
    if (!user) return callback({ state: 'signed-out' });
    const approved = await checkApproved(user);
    callback({ state: approved ? 'approved' : 'pending', user });
  });
}

export async function login(email, password) {
  if (!FIREBASE_CONFIGURED) throw new Error('Firebase not configured');
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signup(email, password) {
  if (!FIREBASE_CONFIGURED) throw new Error('Firebase not configured');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // Create the pending user doc immediately. Security rules ensure
  // the user can only create their OWN doc, and only with approved:false.
  await ensureUserDoc(cred.user);
}

export async function logout() {
  if (!FIREBASE_CONFIGURED) {
    location.reload();
    return;
  }
  await signOut(auth);
}

export async function resetPassword(email) {
  if (!FIREBASE_CONFIGURED) throw new Error('Firebase not configured');
  await sendPasswordResetEmail(auth, email);
}

/* =============================================================
 * Internal: check approved doc
 * -------------------------------------------------------------
 * Reads users/{uid} from Firestore. If the doc doesn't exist yet
 * (e.g. user signed up before this version of the code shipped),
 * we create it with approved:false so the admin can find it.
 * ============================================================= */
async function checkApproved(user) {
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Backfill: legacy account with no doc yet
      await ensureUserDoc(user);
      return false;
    }
    return snap.data().approved === true;
  } catch (err) {
    console.error('[auth] Failed to read approval doc:', err);
    return false;
  }
}

async function ensureUserDoc(user) {
  if (!user) return;
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    email:     user.email || '',
    approved:  false,
    createdAt: serverTimestamp(),
  });
}

/* =============================================================
 * Friendly error messages
 * ============================================================= */
export function authErrorMessage(err) {
  const code = err && err.code ? err.code : '';
  switch (code) {
    case 'auth/invalid-email':           return 'That email address looks invalid.';
    case 'auth/user-disabled':           return 'This account has been disabled.';
    case 'auth/user-not-found':          return 'No account with that email.';
    case 'auth/wrong-password':          return 'Incorrect password.';
    case 'auth/invalid-credential':      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':    return 'An account with that email already exists.';
    case 'auth/weak-password':           return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':       return 'Too many attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':  return 'Network error. Check your connection.';
    default:                              return err.message || 'Something went wrong. Try again.';
  }
}
