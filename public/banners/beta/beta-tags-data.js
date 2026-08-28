/* =============================================================
 * Beta OBS Builder — Verification Tag Firestore/Storage repository
 * -------------------------------------------------------------
 * Collection: obsVerificationTags/{tagId}
 *   { name, enabled, detectionTerms: string[], sortOrder,
 *     storagePath, imageUrl, defaultHeightPx, createdAt, updatedAt }
 *
 * Storage:    obs-verification-tags/{tagId}/{filename}
 *
 * This is intentionally the ONLY module that touches this collection —
 * mirrors the "repository" convention already used by
 * video-manager/repository.js (UI code never talks to Firestore directly).
 * ============================================================= */

import {
  getBetaDb, getBetaStorage,
  collection, doc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  orderBy, query, serverTimestamp,
  ref, uploadBytes, getDownloadURL, deleteObject,
} from './beta-firebase.js';

const COLLECTION = 'obsVerificationTags';
const STORAGE_ROOT = 'obs-verification-tags';

let cache = null; // [{...tag}] — loaded once per builder session, invalidated on any write

export async function listTags({ force = false } = {}) {
  if (cache && !force) return cache;
  const db = getBetaDb();
  if (!db) { cache = []; return cache; }
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy('sortOrder', 'asc')));
  cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return cache;
}

export function invalidateTagCache() { cache = null; }

export async function listEnabledTags(opts) {
  const all = await listTags(opts);
  return all.filter(t => t.enabled !== false);
}

export async function createTag({ name, detectionTerms, defaultHeightPx, sortOrder, imageFile }) {
  const db = getBetaDb();
  if (!db) throw new Error('Firebase is not configured.');
  const ref0 = await addDoc(collection(db, COLLECTION), {
    name: String(name || '').trim(),
    enabled: true,
    detectionTerms: normalizeTerms(detectionTerms),
    defaultHeightPx: defaultHeightPx || 180,
    sortOrder: sortOrder ?? Date.now(),
    storagePath: null,
    imageUrl: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (imageFile) await setTagImage(ref0.id, imageFile);
  invalidateTagCache();
  return ref0.id;
}

export async function updateTag(id, patch) {
  const db = getBetaDb();
  if (!db) throw new Error('Firebase is not configured.');
  const clean = { ...patch, updatedAt: serverTimestamp() };
  if ('detectionTerms' in clean) clean.detectionTerms = normalizeTerms(clean.detectionTerms);
  await updateDoc(doc(db, COLLECTION, id), clean);
  invalidateTagCache();
}

export async function setTagEnabled(id, enabled) {
  return updateTag(id, { enabled: !!enabled });
}

/** Adds `text` as a new future detection term for tag `id` (the "Use + Remember" fuzzy action). */
export async function addDetectionTerm(id, text) {
  const tags = await listTags({ force: true });
  const tag = tags.find(t => t.id === id);
  if (!tag) throw new Error('Tag not found.');
  const existing = Array.isArray(tag.detectionTerms) ? tag.detectionTerms : [];
  const clean = String(text || '').trim();
  if (!clean) return;
  const already = existing.some(t => t.toLowerCase() === clean.toLowerCase());
  if (already) return;
  return updateTag(id, { detectionTerms: [...existing, clean] });
}

export async function deleteTag(id) {
  const db = getBetaDb();
  if (!db) throw new Error('Firebase is not configured.');
  const tags = await listTags({ force: true });
  const tag = tags.find(t => t.id === id);
  if (tag && tag.storagePath) {
    try { await deleteObject(ref(getBetaStorage(), tag.storagePath)); } catch { /* already gone — fine */ }
  }
  await deleteDoc(doc(db, COLLECTION, id));
  invalidateTagCache();
}

export async function setTagImage(id, file) {
  const storage = getBetaStorage();
  if (!storage) throw new Error('Firebase is not configured.');
  const db = getBetaDb();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${STORAGE_ROOT}/${id}/tag.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || undefined });
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, COLLECTION, id), { storagePath: path, imageUrl: url, updatedAt: serverTimestamp() });
  invalidateTagCache();
  return { path, url };
}

function normalizeTerms(terms) {
  const arr = Array.isArray(terms) ? terms : String(terms || '').split(/[\n,]/);
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const clean = String(t || '').trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}
