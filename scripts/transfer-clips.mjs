#!/usr/bin/env node
/* =============================================================
 * Local clip-transfer worker
 * -------------------------------------------------------------
 * Run this on your own computer to process the clipTransferJobs
 * queue the Monday migration page (public/monday-migration-test.html)
 * writes to. Does the exact same Monday-fetch-to-Storage work as
 * functions/index.js's transferClip — built as a fallback after this
 * Google Workspace org's Domain Restricted Sharing policy blocked
 * every way of letting Cloud Run invoke that function automatically
 * (see functions/index.js's own comment for the full story). This
 * script sidesteps that entirely by running as you, locally, rather
 * than as a cloud service Google has to authorize.
 *
 * Nothing is ever kept on this computer: each file streams straight
 * from Monday into Firebase Storage in small chunks, never written
 * to disk and never fully buffered in memory.
 *
 * One-time setup:
 *   1. gcloud auth application-default login
 *   2. npm install --prefix scripts
 *
 * Run:
 *   node scripts/transfer-clips.mjs
 *
 * Leave it running in a terminal window — it polls Firestore for
 * pending jobs every few seconds and processes a few at a time (see
 * CONCURRENCY below). Safe to stop with Ctrl+C and restart anytime;
 * jobs that already finished are never re-processed.
 * ============================================================= */

import admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';

const PROJECT_ID = 'cms-auction-suite';
// Matches shared/firebase-config.js — the Cloud Function version of this
// logic can rely on Cloud Functions' runtime to auto-detect the default
// bucket, but a plain local script has no such runtime context, so it's
// spelled out explicitly here.
const STORAGE_BUCKET = 'cms-auction-suite.firebasestorage.app';
const MAX_CLIP_BYTES = 2 * 1024 * 1024 * 1024; // matches docs/storage.rules' own cap
const CONCURRENCY = 3; // simultaneous file transfers — mirrors the browser-based transfer's own throttling
const POLL_INTERVAL_MS = 5000;

admin.initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
const db = admin.firestore();
const bucket = admin.storage().bucket();

function sanitizeFilename(name) {
  return String(name || 'clip').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function formatBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function processJob(doc) {
  const job = doc.data();
  const { publicUrl, recordId, filename } = job || {};
  const jobRef = doc.ref;

  const fail = message =>
    jobRef.update({ status: 'error', error: message, completedAt: admin.firestore.FieldValue.serverTimestamp() });

  if (!publicUrl || !recordId || !filename) {
    await fail('Missing publicUrl, recordId, or filename');
    return;
  }

  console.log(`Transferring ${filename}…`);

  let upstream;
  try {
    upstream = await fetch(publicUrl);
  } catch (err) {
    await fail(`Could not reach the source file: ${err.message}`);
    console.log(`  Failed: ${filename} — could not reach source`);
    return;
  }
  if (!upstream.ok || !upstream.body) {
    await fail(`Source fetch failed (HTTP ${upstream.status})`);
    console.log(`  Failed: ${filename} — HTTP ${upstream.status}`);
    return;
  }
  const declaredLength = Number(upstream.headers.get('content-length') || 0);
  if (declaredLength && declaredLength > MAX_CLIP_BYTES) {
    await fail(`${filename} is larger than the 2GB per-file limit`);
    console.log(`  Skipped: ${filename} — over the 2GB limit`);
    return;
  }

  const path = `videoClips/${recordId}/${Date.now()}-${sanitizeFilename(filename)}`;
  const downloadToken = randomUUID();
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
    try { await file.delete({ ignoreNotFound: true }); } catch { /* nothing to clean up */ }
    await fail(err.message);
    console.log(`  Failed: ${filename} — ${err.message}`);
    return;
  }

  // Same URL shape the client SDK's getDownloadURL() produces, so migrated
  // and staff-uploaded clips are interchangeable everywhere else in the app.
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;

  await jobRef.update({
    status: 'done',
    storagePath: path,
    downloadUrl,
    sizeBytes: bytesWritten,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`  Done: ${filename} (${formatBytes(bytesWritten)})`);
}

const inFlight = new Set();
let totalDone = 0;

async function poll() {
  if (inFlight.size >= CONCURRENCY) return;
  const snap = await db.collection('clipTransferJobs')
    .where('status', '==', 'pending')
    .limit(CONCURRENCY + inFlight.size)
    .get();

  for (const doc of snap.docs) {
    if (inFlight.size >= CONCURRENCY) break;
    if (inFlight.has(doc.id)) continue;
    inFlight.add(doc.id);
    processJob(doc)
      .then(() => { totalDone++; })
      .catch(err => console.log(`  Unexpected error on ${doc.id}: ${err.message}`))
      .finally(() => inFlight.delete(doc.id));
  }
}

console.log(`Watching clipTransferJobs for pending work (project: ${PROJECT_ID})…`);
console.log('Leave this running — Ctrl+C to stop, safe to restart anytime.\n');

setInterval(poll, POLL_INTERVAL_MS);
poll();

process.on('SIGINT', () => {
  console.log(`\nStopping — ${totalDone} file(s) completed this run. Re-run this script anytime to continue.`);
  process.exit(0);
});
