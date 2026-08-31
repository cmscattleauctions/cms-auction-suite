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
  getBetaDb, getBetaStorage, logStorageError,
  doc, getDoc, setDoc, serverTimestamp,
  ref, uploadBytes, getDownloadURL, deleteObject,
} from './beta-firebase.js';

const DOC_PATH = ['obsStingerConfig', 'default'];
const STORAGE_ROOT = 'obs-stinger';

// Must stay in sync with the contentType regex on obs-stinger/{fileName}
// in docs/storage.rules — mismatches here surface as a generic
// storage/unauthorized error with no hint that it was actually a
// content-type rejection.
const ALLOWED_CONTENT_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MIME_BY_EXT = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
const MAX_BYTES = 50 * 1024 * 1024;

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

  // Some browsers (notably Windows Chrome) don't have a MIME mapping for
  // .mov and report file.type === '' — fall back to the extension in that
  // case rather than rejecting a legitimate upload. If a type IS reported,
  // it must actually match, since that's what the Storage rule checks.
  if (file.type ? !ALLOWED_CONTENT_TYPES.includes(file.type) : !MIME_BY_EXT[ext]) {
    throw new Error(`Stinger asset must be MP4, MOV, or WebM (got "${file.type || `.${ext}`}").`);
  }
  // Always upload with the canonical MIME type for the extension, rather
  // than trusting the browser's (sometimes empty or inconsistent) file.type
  // — the Storage rule checks the *stored* contentType, so an empty or
  // off-spec value here would fail the rule the same way an unsupported
  // format does.
  const contentType = MIME_BY_EXT[ext] || file.type;
  if (file.size >= MAX_BYTES) {
    throw new Error(`Stinger asset must be under ${MAX_BYTES / (1024 * 1024)}MB.`);
  }

  const fileName = `stinger.${ext}`;
  const path = `${STORAGE_ROOT}/${fileName}`;
  const storageRef = ref(storage, path);

  // The stored fileName carries the extension (stinger.mp4 vs stinger.webm),
  // so switching formats on re-upload leaves the old blob behind under a
  // different name — clean it up so obs-stinger/ never accumulates stale
  // assets nothing references any more.
  const previous = await getStingerConfig();

  try {
    await uploadBytes(storageRef, file, { contentType });
  } catch (err) {
    logStorageError({ op: 'uploadBytes', path }, err);
    throw err;
  }

  let videoUrl;
  try {
    videoUrl = await getDownloadURL(storageRef);
  } catch (err) {
    logStorageError({ op: 'getDownloadURL', path }, err);
    throw err;
  }

  await saveStingerConfig({ storagePath: path, fileName, videoUrl });

  if (previous.storagePath && previous.storagePath !== path) {
    try {
      await deleteObject(ref(storage, previous.storagePath));
    } catch (err) {
      // Non-fatal — the new asset is already live and saved. Just log it
      // so an orphaned file doesn't go unnoticed.
      logStorageError({ op: 'deleteObject (stale asset cleanup)', path: previous.storagePath }, err);
    }
  }

  return { path, fileName, videoUrl };
}
