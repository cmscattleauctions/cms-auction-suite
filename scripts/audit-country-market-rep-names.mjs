#!/usr/bin/env node
/* =============================================================
 * Audit: Country Market rep_name collisions across profiles
 * -------------------------------------------------------------
 * Part of the security hardening pass — see
 * docs/HARDENING_CHECKLIST.md, "Country Market rep-name
 * impersonation." docs/firestore.rules now blocks a NEW profile from
 * ever being created with a non-empty rep_name, so going forward the
 * only way two profiles can end up sharing a rep_name is an admin
 * assigning the same name to two different accounts — but any
 * profile created BEFORE that rule shipped could already have a
 * client-set rep_name, and this checks for that.
 *
 * cmLots' ownership rule trusts `lot.rep == the caller's rep_name`
 * as a stable identity — two profiles sharing one rep_name means both
 * accounts can edit the same lots as if they were the same person.
 * This is read-only: it reports collisions, it does not change
 * anything. Resolving a real collision needs a human decision (which
 * account actually owns that name) that this script can't make.
 *
 * One-time setup (same as scripts/transfer-clips.mjs):
 *   1. gcloud auth application-default login
 *   2. npm install --prefix scripts
 *
 * Run:
 *   node scripts/audit-country-market-rep-names.mjs
 * ============================================================= */

import admin from 'firebase-admin';

const PROJECT_ID = 'cms-auction-suite';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const snap = await db.collection('profiles').get();

const byRepName = new Map(); // rep_name -> [{ uid, email, role }]
snap.forEach(doc => {
  const p = doc.data();
  const name = (p.rep_name || '').trim();
  if (!name) return;
  if (!byRepName.has(name)) byRepName.set(name, []);
  byRepName.get(name).push({ uid: doc.id, email: p.email, role: p.role });
});

const collisions = [...byRepName.entries()].filter(([, accounts]) => accounts.length > 1);

if (!collisions.length) {
  console.log(`Checked ${snap.size} profile(s) — no rep_name is shared by more than one account. Nothing to do.`);
  process.exit(0);
}

console.log(`Found ${collisions.length} rep_name value(s) shared by more than one account:\n`);
for (const [name, accounts] of collisions) {
  console.log(`  "${name}":`);
  for (const a of accounts) console.log(`    - ${a.email || '(no email)'} (uid ${a.uid}, role ${a.role})`);
  console.log('');
}
console.log('Review each of these — decide which account (if any) should keep this rep_name, and');
console.log('update the others via the app\'s Admin page (or a targeted Firestore write) to fix it.');
console.log('This script only reports; it does not change any profile.');
