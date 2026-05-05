/* =============================================================
 * Firebase configuration
 * -------------------------------------------------------------
 * Fill these values in from your Firebase project's Web App
 * config (Console → Project Settings → Your apps → Web app
 * → SDK setup and configuration → Config).
 *
 * These values are NOT secrets. They are public identifiers that
 * Firebase requires on the client. Real security comes from:
 *   1. Firebase Auth domain restrictions (set in console)
 *   2. The `approved` custom claim check in auth.js
 *   3. Firestore/Storage security rules (if/when added)
 * ============================================================= */

export const firebaseConfig = {
  apiKey:            "REPLACE_ME_API_KEY",
  authDomain:        "REPLACE_ME.firebaseapp.com",
  projectId:         "REPLACE_ME_PROJECT_ID",
  storageBucket:     "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME_SENDER_ID",
  appId:             "REPLACE_ME_APP_ID",
};

/* Set to true after you fill in real config values above.
 * While false, the app runs in "demo mode" — auth screens render
 * but nothing actually authenticates. Useful for design review. */
export const FIREBASE_CONFIGURED = false;
