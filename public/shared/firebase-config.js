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
     apiKey:            "AIzaSyAuKPqH2qX7VOgbkdONh0In8Vgiaa4lYYU",
     authDomain:        "cms-auction-suite.firebaseapp.com",
     projectId:         "cms-auction-suite",
     storageBucket:     "cms-auction-suite.firebasestorage.app",
     messagingSenderId: "912870540884",
     appId:             "1:912870540884:web:42ded8841807333fb5cfc1",
   };

   export const FIREBASE_CONFIGURED = true;
