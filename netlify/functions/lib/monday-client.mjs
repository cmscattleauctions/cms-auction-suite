/* =============================================================
 * Monday.com API v2 (GraphQL) — thin server-side client
 * -------------------------------------------------------------
 * Every request that carries MONDAY_API_TOKEN happens here, and
 * only here — this module is imported by Netlify Functions
 * (server-side), never by anything under public/ (client-side).
 *
 * Security rules this file exists to enforce:
 *  - the token is read from process.env, never hardcoded
 *  - the token is never logged, echoed, or included in any
 *    response body — only success/failure and a last-4 fingerprint
 *  - every request is a read (GraphQL `query`), never `mutation`
 * ============================================================= */

const MONDAY_API_URL = 'https://api.monday.com/v2';
// Pinned so `items_page`/cursor pagination and `assets` behave the way
// this module expects, regardless of what Monday's default version is
// on the day this runs.
const MONDAY_API_VERSION = '2024-10';

export class MondayConfigError extends Error {
  constructor(message) { super(message); this.name = 'MondayConfigError'; }
}

function getToken() {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token || !token.trim()) {
    throw new MondayConfigError(
      'MONDAY_API_TOKEN is not set in this environment. See netlify/functions/README.md.'
    );
  }
  return token.trim();
}

/** Last 4 characters only — enough to confirm "yes, a token is loaded and it's THIS one" without exposing it. */
export function tokenFingerprint() {
  try {
    const t = getToken();
    return `…${t.slice(-4)} (${t.length} chars)`;
  } catch {
    return null;
  }
}

/**
 * Run a read-only GraphQL query against Monday's API.
 * Throws MondayConfigError if the token isn't configured, or a plain
 * Error (with `.mondayErrors`/`.status`) if Monday itself rejects it.
 */
export async function mondayQuery(query, variables = {}) {
  const token = getToken();

  if (/^\s*mutation\b/i.test(query)) {
    // Belt-and-suspenders — this whole tool is read-only by design
    // (see the file header on monday-migration-test.mjs).
    throw new Error('Refusing to send a mutation — this client is read-only by design.');
  }

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
      'API-Version': MONDAY_API_VERSION,
    },
    body: JSON.stringify({ query, variables }),
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Monday API returned a non-JSON response (HTTP ${res.status}).`);
  }

  if (json.errors && json.errors.length) {
    const err = new Error(json.errors.map(e => e.message).join('; '));
    err.mondayErrors = json.errors;
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`Monday API HTTP ${res.status}`);
  }
  return json.data;
}

/** Standard JSON response helper — keeps every action's output shape consistent. */
export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function errorResponse(err) {
  const message = err && err.message ? err.message : String(err);
  const status = err instanceof MondayConfigError ? 400 : 502;
  const body = { ok: false, error: message };
  if (err && err.mondayErrors) body.mondayErrors = err.mondayErrors;
  return jsonResponse(body, status);
}
