/* =============================================================
 * Firebase ID token verification — no Admin SDK, no service
 * account secret needed.
 * -------------------------------------------------------------
 * Netlify Functions run outside the Firebase project, so they can't
 * use the Admin SDK the way functions/index.js's Cloud Functions do.
 * A Firebase ID token is a standard signed JWT though, and Google
 * publishes the public keys used to sign it — verifying one here
 * only needs those public keys (fetched + cached by `jose`), not any
 * secret of our own. This checks "is this JWT genuinely signed by
 * Firebase, for this project, still valid" — nothing more; it does
 * NOT check *who* the token belongs to or whether they're allowed to
 * do anything. That's require-migration-admin.mjs's job, one layer up.
 * ============================================================= */

import { createRemoteJWKSet, jwtVerify } from 'jose';

// Matches public/shared/firebase-config.js's projectId.
const PROJECT_ID = 'cms-auction-suite';
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;

// jose caches the fetched key set (and handles rotation) internally —
// one JWKS instance for the life of this module/function instance.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

/**
 * Verifies a Firebase ID token's signature, issuer, audience, and
 * expiry. Returns the decoded payload (uid via `.sub`, `.email`, etc.)
 * on success. Throws on any failure — caller decides how to respond.
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Missing ID token');
  }
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUER,
    audience: PROJECT_ID,
  });
  if (!payload.sub) throw new Error('Token missing subject');
  return payload;
}
