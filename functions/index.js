/* =============================================================
 * CMS Auction Suite — Firebase Cloud Functions
 * -------------------------------------------------------------
 * transferClip: the one piece of this project that runs server-side
 * with the Admin SDK, and only for one specific reason — moving a
 * clip file from Monday.com to Firebase Storage.
 *
 * Why this is a Firestore trigger, not an HTTP endpoint: it started
 * as an onRequest function the browser called directly. That broke
 * twice in live testing —
 *   1. The original design had the browser fetch Monday's public_url
 *      directly; Monday's CDN doesn't send CORS headers permitting
 *      that, so it always failed with "Failed to fetch". Moving the
 *      fetch server-side (here) fixed that.
 *   2. Calling this function directly over HTTP then failed too —
 *      Cloud Run (what 2nd-gen HTTPS functions run on) requires the
 *      caller to have the "Cloud Run Invoker" role, and granting
 *      that to `allUsers` (needed for a browser to call it) is
 *      blocked outright by this Google Workspace org's "Domain
 *      Restricted Sharing" policy — not something fixable at the
 *      project level.
 * So instead: the browser writes a document to clipTransferJobs
 * (a normal Firestore write, gated by security rules exactly like
 * every other write in this app — see docs/firestore.rules), this
 * function reacts to that write via Firestore's own event system
 * (Eventarc, already provisioned by the first deploy), and writes
 * the result back onto the same document for the browser to read.
 * Firestore-triggered invocation is Google-internal service-to-
 * service plumbing, not a public HTTP grant, so the org policy that
 * blocked the HTTP approach doesn't apply here.
 * ============================================================= */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { randomUUID } = require('crypto');
const dns = require('node:dns');
const net = require('node:net');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const MAX_CLIP_BYTES = 2 * 1024 * 1024 * 1024; // matches docs/storage.rules' own cap
const SUITE_ADMIN_EMAIL = 'jayton.h@cmslivestock.com'; // matches docs/firestore.rules' isSuiteAdmin()
const FETCH_TIMEOUT_MS = 30 * 1000; // connect+headers only — body streaming isn't bound by this

function sanitizeFilename(name) {
  return String(name || 'clip').replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * SSRF guard for transferClip below — publicUrl is a value the CLIENT
 * supplies when creating a clipTransferJobs document (see
 * public/video-manager/firestore-data.js's requestClipTransfer()), and
 * this function fetches it with the Admin SDK's own service-account
 * network access, then persists whatever comes back into Storage,
 * which any approved user can then read out again (docs/storage.rules).
 * Without validation, a malicious approved account could point
 * publicUrl at an internal service or the cloud metadata endpoint
 * (169.254.169.254) and exfiltrate its response through a "clip".
 *
 * This checks the ACTUAL RESOLVED IP(s), not just the hostname string,
 * so a hostname crafted to look legitimate can't hide a private target.
 * It does not fully close a DNS-rebinding race (the name could
 * legitimately re-resolve to a different IP between this check and
 * fetch()'s own internal resolution a moment later) — full protection
 * would mean pinning the checked IP into the actual socket connection,
 * which Node's global fetch doesn't expose a supported way to do. This
 * closes the realistic threat model here (a malicious/compromised
 * approved account pointing this at a static internal address), not a
 * network-level adversary controlling DNS — flagged as an accepted
 * residual gap in docs/HARDENING_CHECKLIST.md.
 */
function isPrivateOrReservedIp(ip) {
  const type = net.isIP(ip);
  if (type === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true;                       // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true;          // 192.168.0.0/16
    if (a === 127) return true;                       // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;          // 169.254.0.0/16 link-local, incl. cloud metadata
    if (a === 0) return true;                         // 0.0.0.0/8
    if (a >= 224) return true;                         // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('::ffff:')) {
      const v4 = lower.slice(7);
      return net.isIP(v4) === 4 ? isPrivateOrReservedIp(v4) : true;
    }
    if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
    if (/^f[cd]/.test(lower)) return true;    // fc00::/7 unique local
    return false;
  }
  return true; // not a recognizable IP at all — fail closed
}

async function assertPublicHost(hostname) {
  let addresses;
  try {
    addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    throw new Error(`Could not resolve host "${hostname}": ${err.message}`);
  }
  if (!addresses.length) throw new Error(`Host "${hostname}" did not resolve to any address`);
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error(`Host "${hostname}" resolves to a private/internal address — refusing to fetch`);
    }
  }
}

/** https-only, resolves to a public IP — throws a client-safe message on failure. */
async function assertSafeFetchTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Source URL is not a valid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only https:// source URLs are allowed');
  }
  await assertPublicHost(parsed.hostname);
  return parsed;
}

exports.transferClip = onDocumentCreated(
  { document: 'clipTransferJobs/{jobId}', timeoutSeconds: 540, memory: '512MiB' },
  async event => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    const jobRef = snap.ref;
    const { publicUrl, recordId, filename } = job || {};

    const fail = message =>
      jobRef.update({ status: 'error', error: message, completedAt: admin.firestore.FieldValue.serverTimestamp() });

    if (!publicUrl || !recordId || !filename) {
      await fail('Missing publicUrl, recordId, or filename');
      return;
    }

    // Defense in depth beyond docs/firestore.rules — re-verify the
    // requester's actual Auth record directly, same reasoning as
    // adminRunJob below (this function bypasses rules with the Admin
    // SDK). This job type is only ever created by the Monday clips
    // migration (public/monday-migration-test.html), which is itself
    // now migration-admin-gated (see docs/HARDENING_CHECKLIST.md item
    // 1) — no regular staff workflow uses this, so scoping it to the
    // same one account is a real restriction, not just a formality.
    let requester;
    try {
      requester = await admin.auth().getUser(job.requestedBy);
    } catch {
      await fail('Could not verify the requesting account.');
      return;
    }
    if ((requester.email || '').toLowerCase() !== SUITE_ADMIN_EMAIL) {
      await fail('Not authorized for clip transfer operations.');
      return;
    }

    let validatedUrl;
    try {
      validatedUrl = await assertSafeFetchTarget(publicUrl);
    } catch (err) {
      await fail(err.message);
      return;
    }

    let upstream;
    try {
      upstream = await fetch(validatedUrl, { redirect: 'manual', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (err) {
      await fail(`Could not reach the source file: ${err.message}`);
      return;
    }

    // Handle at most one redirect hop, re-validating the target the
    // same way as the original URL — redirect: 'manual' above means
    // fetch() never follows one on its own, which would skip this
    // check entirely for whatever host the redirect points to.
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get('location');
      if (!location) { await fail('Source returned a redirect with no Location header'); return; }
      let redirectUrl;
      try {
        redirectUrl = await assertSafeFetchTarget(new URL(location, validatedUrl).toString());
      } catch (err) {
        await fail(`Redirect target rejected: ${err.message}`);
        return;
      }
      try {
        upstream = await fetch(redirectUrl, { redirect: 'error', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      } catch (err) {
        await fail(`Could not reach the redirected source file: ${err.message}`);
        return;
      }
    }

    if (!upstream.ok || !upstream.body) {
      await fail(`Source fetch failed (HTTP ${upstream.status})`);
      return;
    }
    const declaredLength = Number(upstream.headers.get('content-length') || 0);
    if (declaredLength && declaredLength > MAX_CLIP_BYTES) {
      await fail(`${filename} is larger than the 2GB per-file limit`);
      return;
    }

    const path = `videoClips/${recordId}/${Date.now()}-${sanitizeFilename(filename)}`;
    const downloadToken = randomUUID();
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const writeStream = file.createWriteStream({
      metadata: {
        contentType: upstream.headers.get('content-type') || 'video/mp4',
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      },
    });

    let bytesWritten = 0;
    try {
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesWritten += value.byteLength;
        if (bytesWritten > MAX_CLIP_BYTES) throw new Error(`${filename} is larger than the 2GB per-file limit`);
        await new Promise((resolve, reject) => {
          writeStream.write(Buffer.from(value), err => (err ? reject(err) : resolve()));
        });
      }
      await new Promise((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.end();
      });
    } catch (err) {
      // Best-effort cleanup of a partial object rather than leaving a broken file behind.
      try { await file.delete({ ignoreNotFound: true }); } catch { /* nothing to clean up */ }
      await fail(err.message);
      return;
    }

    // Same URL shape the client SDK's getDownloadURL() produces, so every
    // clip (staff-uploaded or migrated) is interchangeable downstream.
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;

    await jobRef.update({
      status: 'done',
      storagePath: path,
      downloadUrl,
      sizeBytes: bytesWritten,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

/* =============================================================
 * Admin Settings — user management
 * -------------------------------------------------------------
 * Two operations that genuinely need the Admin SDK and can't be done
 * from the client: creating a Firebase Auth account (doing that from
 * the client would sign the admin's own session OUT and into the new
 * account — a well-known Auth SDK quirk) and setting another user's
 * password directly (the client SDK can only change the CURRENTLY
 * signed-in user's own password). Everything else Admin Settings does
 * (approve, role, allowedTabs, listing users) is a plain Firestore
 * read/write gated by isSuiteAdmin() in docs/firestore.rules — no
 * function needed for those.
 *
 * Same Firestore-trigger job pattern as transferClip above, for the
 * same reason documented in this file's header: onCall/onRequest
 * functions need the "Cloud Run Invoker" role granted to allUsers to
 * be reachable from a browser at all, which this Workspace org's
 * Domain Restricted Sharing policy blocks outright. A Firestore write
 * (already gated by security rules, same as every other write in this
 * app) triggering a function server-side sidesteps that entirely.
 * ============================================================= */
exports.adminRunJob = onDocumentCreated(
  { document: 'adminJobs/{jobId}', timeoutSeconds: 60 },
  async event => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    const jobRef = snap.ref;

    // createUser/setPassword jobs carry a plaintext password in
    // params.password (see shared/admin-data.js) — it only needs to
    // exist for the few seconds it takes this function to read and
    // act on it. Every terminal update (success or failure) strips it
    // via FieldValue.delete() rather than leaving it sitting in
    // Firestore indefinitely; the rest of the job doc (op, requestedBy,
    // status, timestamps) is left in place as an audit trail.
    const clearedFields = { 'params.password': admin.firestore.FieldValue.delete() };
    const fail = message =>
      jobRef.update({ status: 'error', error: message, completedAt: admin.firestore.FieldValue.serverTimestamp(), ...clearedFields });

    // Defense in depth beyond docs/firestore.rules — the rules already
    // restrict who can create a job document at all, but this function
    // runs with the Admin SDK (which bypasses rules entirely), so it
    // re-checks the requester's actual Auth record directly rather than
    // trusting a client-supplied email field.
    let requester;
    try {
      requester = await admin.auth().getUser(job.requestedBy);
    } catch {
      await fail('Could not verify the requesting account.');
      return;
    }
    if ((requester.email || '').toLowerCase() !== SUITE_ADMIN_EMAIL) {
      await fail('Not authorized for admin operations.');
      return;
    }

    try {
      if (job.op === 'createUser') {
        const { email, password, role, allowedTabs } = job.params || {};
        if (!email || !password) { await fail('Email and password are required.'); return; }
        const userRecord = await admin.auth().createUser({ email, password });
        await admin.firestore().doc(`users/${userRecord.uid}`).set({
          email: userRecord.email,
          approved: true, // an admin explicitly creating an account is the approval — no separate pending step
          role: role || '',
          allowedTabs: Array.isArray(allowedTabs) ? allowedTabs : null, // null = every tab
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: requester.email,
        });
        await jobRef.update({ status: 'done', result: { uid: userRecord.uid }, completedAt: admin.firestore.FieldValue.serverTimestamp(), ...clearedFields });
      } else if (job.op === 'setPassword') {
        const { uid, password } = job.params || {};
        if (!uid || !password) { await fail('uid and password are required.'); return; }
        await admin.auth().updateUser(uid, { password });
        await jobRef.update({ status: 'done', completedAt: admin.firestore.FieldValue.serverTimestamp(), ...clearedFields });
      } else {
        await fail(`Unknown op "${job.op}".`);
      }
    } catch (err) {
      await fail(err.message || String(err));
    }
  }
);
