#!/usr/bin/env node
/* =============================================================
 * Migration: move Country Market buyer identities into their own
 * admin-only-readable collection
 * -------------------------------------------------------------
 * Part of the security hardening pass — see
 * docs/HARDENING_CHECKLIST.md, "Buyer-field protection." Firestore
 * security rules are document-granular, not field-granular — the
 * only way to make a lot's buyer identity admin-only-readable while
 * everyone else can still read the rest of the lot is to move it into
 * a separate document. This copies every cmLots.buyer value into
 * cmLotBuyers/{lotId} (see docs/firestore.rules), then — only with
 * --apply — removes the buyer field from the cmLots document.
 *
 * Safe to run more than once: existing cmLotBuyers docs are
 * overwritten with the current cmLots.buyer value, not duplicated.
 * Nothing is deleted except the single `buyer` field on cmLots docs
 * that already have a copy safely written to cmLotBuyers first.
 *
 * Defaults to a dry run — it only reports what it WOULD change.
 * Pass --apply to actually write the migration.
 *
 * One-time setup (same as scripts/transfer-clips.mjs):
 *   1. gcloud auth application-default login
 *   2. npm install --prefix scripts
 *
 * Run:
 *   node scripts/migrate-country-market-buyers.mjs           # dry run
 *   node scripts/migrate-country-market-buyers.mjs --apply   # migrate
 * ============================================================= */

import admin from 'firebase-admin';

const PROJECT_ID = 'cms-auction-suite';
const APPLY = process.argv.includes('--apply');

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const snap = await db.collection('cmLots').get();

const withBuyer = [];
snap.forEach(doc => {
  const l = doc.data();
  if (l.buyer && String(l.buyer).trim()) {
    withBuyer.push({ id: doc.id, lot: l.lot, buyer: l.buyer });
  }
});

if (!withBuyer.length) {
  console.log(`Checked ${snap.size} lot(s) — none have a buyer set on the lot document. Nothing to do.`);
  process.exit(0);
}

console.log(`Found ${withBuyer.length} lot(s) with a buyer set directly on the lot document:\n`);
for (const l of withBuyer) console.log(`  Lot ${l.lot} (${l.id}): "${l.buyer}"`);
console.log('');

if (!APPLY) {
  console.log('Dry run only — nothing was changed.');
  console.log('Re-run with --apply to: 1) write each of these into cmLotBuyers/{lotId},');
  console.log('then 2) remove the buyer field from the cmLots document.');
  process.exit(0);
}

let migrated = 0;
for (const l of withBuyer) {
  await db.collection('cmLotBuyers').doc(l.id).set({ id: l.id, buyer: l.buyer }, { merge: true });
  await db.collection('cmLots').doc(l.id).update({ buyer: admin.firestore.FieldValue.delete() });
  migrated++;
  console.log(`  Migrated lot ${l.lot}`);
}
console.log(`\nDone — migrated ${migrated} lot(s). Buyer identities now live in cmLotBuyers, admin-only.`);
