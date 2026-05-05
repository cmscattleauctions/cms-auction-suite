/* =============================================================
 * CMS Auction Suite — Auth module
 * -------------------------------------------------------------
 * Wraps Firebase Auth. Handles:
 *   - Email/password login
 *   - Email/password sign-up (creates pending account)
 *   - Approval gate: checks `approved === true` custom claim
 *   - Sign-out
 *   - Initial state resolution (waits for Firebase to know who
 *     you are before showing any UI — prevents flicker)
 *
 * Approval flow:
 *   1. User signs up → Firebase creates account → user is signed in
 *   2. App checks token claims for `approved`
 *   3. If approved: shows the suite shell
 *   4. If not: shows pending screen with sign-out
 *   5. Owner approves via Firebase Console (sets custom claim)
 *   6. User refreshes → token refreshes → claim seen → admitted
 * ============================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import { firebaseConfig, FIREBASE_CONFIGURED } from './firebase-config.js';

/* ----- Initialize ----- */
let app = null;
let auth = null;
if (FIREBASE_CONFIGURED) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
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
 *
 * The shell uses this on boot to decide what to show.
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
  await createUserWithEmailAndPassword(auth, email, password);
  // The new user is signed in immediately but has no `approved` claim.
  // The approval gate in resolveAuthState() will route them to the
  // pending screen until you set the claim in Firebase Console.
}

export async function logout() {
  if (!FIREBASE_CONFIGURED) {
    // Demo mode: just reload to "reset" state
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
 * Internal: check approved claim
 * -------------------------------------------------------------
 * We force-refresh the ID token so newly-set claims are seen
 * without requiring the user to log out and back in.
 * ============================================================= */
async function checkApproved(user) {
  try {
    const token = await user.getIdTokenResult(/* forceRefresh */ true);
    return token.claims.approved === true;
  } catch (err) {
    console.error('[auth] Failed to read claims:', err);
    return false;
  }
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
