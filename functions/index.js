/* =============================================================
 * CMS Auction Suite — Firebase Cloud Functions
 * -------------------------------------------------------------
 * transferClip: the one piece of this project that runs server-side
 * with the Admin SDK, and only for one specific reason — moving a
 * clip file from Monday.com to Firebase Storage.
 *
 * Why this exists: the Monday clips migration originally had the
 * browser fetch each file directly from Monday's public_url and
 * upload it straight to Storage, keeping every server (Netlify
 * Functions included) out of the byte path entirely. That broke in
 * live testing — Monday's CDN doesn't send CORS headers permitting
 * fetch() from another origin, so every browser-side download failed
 * with "Failed to fetch" (a server-side fetch of the same kind of
 * URL, tested earlier from a Netlify Function, has no such
 * restriction — CORS is a browser-only mechanism). Proxying the
 * bytes through a Netlify Function was considered next, but ruled
 * out because the account's Netlify bandwidth/credit budget doesn't
 * have room for ~169GB in one shot. This function does the same
 * proxy job from inside the same Google Cloud project Storage
 * already lives in, so Monday->function->Storage never touches a
 * second vendor's billing at all.
 *
 * Auth: verifies the caller's Firebase ID token, then checks the
 * exact same approval flag the Firestore/Storage security rules
 * check (users/{uid}.approved) — this function is a second front
 * door, so it enforces the same rule those rules do rather than
 * trusting the caller.
 * ============================================================= */

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { randomUUID } = require('crypto');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const MAX_CLIP_BYTES = 2 * 1024 * 1024 * 1024; // matches docs/storage.rules' own cap

async function isApproved(uid, decodedToken) {
  if (decodedToken.approved === true) return true;
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  return snap.exists && snap.data().approved === true;
}

function sanitizeFilename(name) {
  return String(name || 'clip').replace(/[^a-zA-Z0-9._-]/g, '_');
}

exports.transferClip = onRequest({ cors: true, timeoutSeconds: 540, memory: '512MiB' }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Use POST' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ ok: false, error: 'Missing Authorization bearer token' });
    return;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid or expired auth token' });
    return;
  }

  if (!(await isApproved(decoded.uid, decoded))) {
    res.status(403).json({ ok: false, error: 'Account not approved' });
    return;
  }

  const { publicUrl, recordId, filename } = req.body || {};
  if (!publicUrl || !recordId || !filename) {
    res.status(400).json({ ok: false, error: 'Missing publicUrl, recordId, or filename' });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(publicUrl);
  } catch (err) {
    res.status(502).json({ ok: false, error: `Could not reach the source file: ${err.message}` });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    res.status(502).json({ ok: false, error: `Source fetch failed (HTTP ${upstream.status})` });
    return;
  }
  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > MAX_CLIP_BYTES) {
    res.status(413).json({ ok: false, error: `${filename} is larger than the 2GB per-file limit` });
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
    res.status(500).json({ ok: false, error: err.message });
    return;
  }

  // Same URL shape the client SDK's getDownloadURL() produces, so every
  // clip (staff-uploaded or migrated) is interchangeable downstream.
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;

  res.json({ ok: true, storagePath: path, downloadUrl, sizeBytes: bytesWritten });
});
