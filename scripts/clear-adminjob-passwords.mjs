#!/usr/bin/env node
/* =============================================================
 * One-time cleanup: strip plaintext passwords from old adminJobs docs
 * -------------------------------------------------------------
 * Part of the security hardening pass — see docs/HARDENING_CHECKLIST.md,
 * item 6 ("Passwords persisted in adminJobs documents"). Every
 * createUser/setPassword job written by shared/admin-data.js's
 * runAdminJob() carries a plaintext password in params.password.
 * functions/index.js's adminRunJob Cloud Function now strips that
 * field itself on every future job (success or failure) — this script
 * is the one-time catch-up for jobs created BEFORE that fix shipped,
 * which are still sitting in Firestore with a real password in them.
 *
 * Only touches documents that currently have params.password set —
 * leaves everything else (op, requestedBy, status, timestamps, result)
 * untouched, so the audit trail (who ran what job, when) survives.
 *
 * Defaults to a dry run — it only reports what it WOULD change.
 * Pass --apply to actually write the fix.
 *
 * One-time setup (same as scripts/transfer-clips.mjs):
 *   1. gcloud auth application-default login
 *   2. npm install --prefix scripts
 *
 * Run:
 *   node scripts/clear-adminjob-passwords.mjs           # dry run
 *   node scripts/clear-adminjob-passwords.mjs --apply   # actually fix it
 * ============================================================= */

import admin from 'firebase-admin';

const PROJECT_ID = 'cms-auction-suite';
const APPLY = process.argv.includes('--apply');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const snap = await db.collection('adminJobs').get();

const affected = [];
snap.forEach(doc => {
  const j = doc.data();
  if (j.params && typeof j.params === 'object' && 'password' in j.params) {
    affected.push({ id: doc.id, op: j.op, status: j.status });
  }
});

if (!affected.length) {
  console.log('No adminJobs documents with a stored password found — nothing to do.');
  process.exit(0);
}

console.log(`Found ${affected.length} adminJobs document(s) with a plaintext password:\n`);
for (const j of affected) console.log(`  ${j.id} — op:${j.op} status:${j.status}`);
console.log('');

if (!APPLY) {
  console.log('Dry run only — nothing was changed. Re-run with --apply to clear these fields.');
  process.exit(0);
}

let cleared = 0;
for (const j of affected) {
  await db.collection('adminJobs').doc(j.id).update({
    'params.password': admin.firestore.FieldValue.delete(),
  });
  cleared++;
  console.log(`  Cleared ${j.id}`);
}
console.log(`\nDone — cleared ${cleared} document(s).`);
