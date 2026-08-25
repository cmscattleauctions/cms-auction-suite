/* =============================================================
 * CMS Video Manager — Firebase Storage data layer
 * -------------------------------------------------------------
 * Thin wrapper around Firebase Storage for clip files. Same init
 * pattern as firestore-data.js — reuses the one Firebase App
 * instance (getApp()) rather than creating a second one.
 *
 * Everything here runs client-side: a browser uploads a File
 * directly to Storage, gated by Storage Security Rules (see
 * docs/storage.rules), same trust model as Firestore writes
 * elsewhere in this app. No server ever sees clip bytes.
 *
 * The Monday clips migration reuses this same upload path via
 * uploadClipFromUrl() — it fetches the file from Monday's public_url
 * in the browser, then re-uploads it through the identical
 * uploadClip() used by a normal staff upload, so both paths produce
 * clips in exactly the same shape.
 * ============================================================= */

import { getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

import { FIREBASE_CONFIGURED } from '../shared/firebase-config.js';

export const configured = FIREBASE_CONFIGURED;

// Matches the hard cap enforced server-side by docs/storage.rules — checked
// here too so a bad file is rejected before spending any time/bandwidth
// uploading it, not just after Storage rejects the write.
export const MAX_CLIP_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

let storage = null;
if (FIREBASE_CONFIGURED) {
  storage = getStorage(getApp());
}

function requireStorage() {
  if (!storage) throw new Error('Firebase Storage is not configured (see shared/firebase-config.js).');
  return storage;
}

function sanitizeFilename(name) {
  return String(name || 'clip').replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Upload one File to Storage under videoClips/{recordId}/, resumable with
 * live progress. Resolves { storagePath, downloadUrl, sizeBytes }.
 */
export function uploadClip(recordId, file, { onProgress } = {}) {
  const s = requireStorage();
  if (file.size > MAX_CLIP_BYTES) {
    return Promise.reject(new Error(`${file.name} is larger than the 2GB per-file limit`));
  }
  const path = `videoClips/${recordId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const fileRef = ref(s, path);
  const task = uploadBytesResumable(fileRef, file, { contentType: file.type || 'video/mp4' });

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      snap => { if (onProgress) onProgress(snap.totalBytes ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0); },
      reject,
      async () => {
        try {
          const downloadUrl = await getDownloadURL(fileRef);
          resolve({ storagePath: path, downloadUrl, sizeBytes: file.size });
        } catch (err) { reject(err); }
      }
    );
  });
}

/**
 * Fetch a file from a remote URL (Monday's asset public_url) and re-upload
 * it through the exact same path as a normal staff upload. Storage can't
 * pull from an external URL on its own, so the browser is the one doing
 * both the download and the upload here — that's also why this has to run
 * client-side rather than in a Netlify Function (no server in the byte path).
 */
export async function uploadClipFromUrl(recordId, sourceUrl, filename, { onProgress } = {}) {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status}) for ${filename}`);
  const blob = await res.blob();
  if (blob.size > MAX_CLIP_BYTES) throw new Error(`${filename} is larger than the 2GB per-file limit`);
  const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
  return uploadClip(recordId, file, { onProgress });
}

export async function deleteClipFile(storagePath) {
  if (!storage || !storagePath) return;
  try { await deleteObject(ref(storage, storagePath)); } catch { /* already gone — fine */ }
}
