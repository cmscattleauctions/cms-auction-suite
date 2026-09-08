/* =============================================================
 * Migration-admin gate for Netlify Functions
 * -------------------------------------------------------------
 * Used by monday-migration-test.mjs. Requires a real, currently-valid
 * Firebase ID token (see verify-firebase-token.mjs) belonging to the
 * one account allowed to run migrations — same email constant as
 * functions/index.js's SUITE_ADMIN_EMAIL and shared/admin-data.js's
 * SUITE_ADMIN_EMAIL, kept here as its own copy since this directory
 * is a separate deploy target with no shared import path to either.
 * ============================================================= */

import { verifyFirebaseIdToken } from './verify-firebase-token.mjs';

const MIGRATION_ADMIN_EMAIL = 'jayton.h@cmslivestock.com';

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Throws AuthError if `req` doesn't carry a valid ID token for the
 * migration admin. Returns the token payload (email, uid) on success.
 */
export async function requireMigrationAdmin(req) {
  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AuthError('Sign in as the suite admin and try again (missing Authorization header).');
  }

  let payload;
  try {
    payload = await verifyFirebaseIdToken(match[1]);
  } catch {
    // Never echo the underlying verification error back to the client —
    // it's diagnostic detail about token internals, not something a
    // caller needs to see either way (expired vs malformed vs wrong
    // signature all mean the same thing to them: sign in again).
    throw new AuthError('Your session is invalid or expired — sign in again and retry.');
  }

  const email = String(payload.email || '').toLowerCase();
  if (email !== MIGRATION_ADMIN_EMAIL) {
    throw new AuthError('This account is not authorized for migration operations.', 403);
  }

  return payload;
}
