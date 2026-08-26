#!/usr/bin/env node
/* =============================================================
 * One-time cleanup: clear fake YouTube ids on not-yet-made videos
 * -------------------------------------------------------------
 * Root cause (now fixed going forward in monday-migration-test.html,
 * ui-table.js, and ui-drawer.js): the Monday "Preview Link" column
 * for items that haven't been made yet sometimes held Monday's own
 * boilerplate help text instead of a real link (something like "To
 * convert YouTube embed links, paste the original link here... e.g.
 * youtu.be/xxxxx"). The old extraction regex searched for a
 * youtu.be/-shaped pattern ANYWHERE in that text rather than
 * requiring the whole field to actually be a link, so it found that
 * example id buried in the instructions — and since the boilerplate
 * text is identical on every such item, every Ready/On Hold record
 * migrated with it ended up tagged with the exact same fake id.
 *
 * This script only touches documents that are NOT status: 'created'
 * (a Ready/On Hold record can never have a real published link yet,
 * by the app's own rules) and that currently have a youtubeId set.
 * It clears youtubeId/youtubeUrl/embedUrl/embedCode on those and
 * leaves everything else on the record untouched.
 *
 * Defaults to a dry run — it only reports what it WOULD change.
 * Pass --apply to actually write the fix.
 *
 * One-time setup (same as scripts/transfer-clips.mjs):
 *   1. gcloud auth application-default login
 *   2. npm install --prefix scripts
 *
 * Run:
 *   node scripts/clear-bad-youtube-links.mjs           # dry run
 *   node scripts/clear-bad-youtube-links.mjs --apply   # actually fix it
 * ============================================================= */

import admin from 'firebase-admin';

const PROJECT_ID = 'cms-auction-suite';
const APPLY = process.argv.includes('--apply');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const snap = await db.collection('videoRecords').get();

const affected = [];
snap.forEach(doc => {
  const v = doc.data();
  if (v.status !== 'created' && v.youtubeId) {
    affected.push({ id: doc.id, videoId: v.videoId, status: v.status, youtubeId: v.youtubeId });
  }
});

if (!affected.length) {
  console.log('No Ready/On Hold records with a youtubeId found — nothing to do.');
  process.exit(0);
}

console.log(`Found ${affected.length} Ready/On Hold record(s) with a youtubeId set:\n`);
const byYtId = new Map();
for (const r of affected) byYtId.set(r.youtubeId, (byYtId.get(r.youtubeId) || 0) + 1);
for (const [ytId, count] of byYtId) console.log(`  youtubeId "${ytId}" — ${count} record(s)`);
console.log('');

if (!APPLY) {
  console.log('Dry run only — nothing was changed. Re-run with --apply to clear these fields.');
  process.exit(0);
}

let cleared = 0;
for (const r of affected) {
  await db.collection('videoRecords').doc(r.id).update({
    youtubeId: null,
    youtubeUrl: null,
    embedUrl: null,
    embedCode: null,
  });
  cleared++;
  console.log(`  Cleared ${r.videoId} (${r.status})`);
}
console.log(`\nDone — cleared ${cleared} record(s).`);
