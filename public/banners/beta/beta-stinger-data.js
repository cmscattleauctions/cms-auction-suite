/* =============================================================
 * Beta OBS Builder — CMS Video Intro / Stinger config (Firestore/Storage)
 * -------------------------------------------------------------
 * Singleton doc: obsStingerConfig/default
 *   { enabled, storagePath, fileName, videoUrl, durationMs, transitionPointMs, updatedAt }
 *
 * Storage: obs-stinger/{filename}
 *
 * Replaces the earlier image-or-video "intro overlay" design. Per
 * investigation (see project deliverable notes), a real "intro plays,
 * then cattle video begins" sequence is only achievable via OBS's
 * native Stinger Transition applied as a per-scene Transition Override
 * — which requires a VIDEO asset (a static image has no "transition
 * point" concept). Image-based intros are no longer supported here.
 * ============================================================= */

import {
  getBetaDb, getBetaStorage,
  doc, getDoc, setDoc, serverTimestamp,
  ref, uploadBytes, getDownloadURL,
} from './beta-firebase.js';

const DOC_PATH = ['obsStingerConfig', 'default'];
const STORAGE_ROOT = 'obs-stinger';

const DEFAULT_CONFIG = {
  enabled: false, storagePath: null, fileName: null, videoUrl: null,
  durationMs: 800, transitionPointMs: 700,
};

export async function getStingerConfig() {
  const db = getBetaDb();
  if (!db) return { ...DEFAULT_CONFIG };
  const snap = await getDoc(doc(db, ...DOC_PATH));
  if (!snap.exists()) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...snap.data() };
}

export async function saveStingerConfig(patch) {
  const db = getBetaDb();
  if (!db) throw new Error('Firebase is not configured.');
  await setDoc(doc(db, ...DOC_PATH), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export async function setStingerAsset(file) {
  const storage = getBetaStorage();
  if (!storage) throw new Error('Firebase is not configured.');
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase();
  const fileName = `stinger.${ext}`;
  const path = `${STORAGE_ROOT}/${fileName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || undefined });
  const videoUrl = await getDownloadURL(storageRef);
  await saveStingerConfig({ storagePath: path, fileName, videoUrl });
  return { path, fileName, videoUrl };
}
