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

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const MAX_CLIP_BYTES = 2 * 1024 * 1024 * 1024; // matches docs/storage.rules' own cap

function sanitizeFilename(name) {
  return String(name || 'clip').replace(/[^a-zA-Z0-9._-]/g, '_');
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

    let upstream;
    try {
      upstream = await fetch(publicUrl);
    } catch (err) {
      await fail(`Could not reach the source file: ${err.message}`);
      return;
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
