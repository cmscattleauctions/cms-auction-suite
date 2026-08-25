/* =============================================================
 * CMS Video Manager — Firebase Storage data layer
 * -------------------------------------------------------------
 * Thin wrapper around Firebase Storage for clip files. Same init
 * pattern as firestore-data.js — reuses the one Firebase App
 * instance (getApp()) rather than creating a second one.
 *
 * A normal staff upload (uploadClip) runs entirely client-side: the
 * browser already has the File in hand (picked from disk), so it
 * uploads directly to Storage, gated by Storage Security Rules (see
 * docs/storage.rules) — no server involved.
 *
 * The Monday clips migration (uploadClipFromUrl) is different: it
 * needs bytes that live on Monday's CDN, and Monday's CORS policy
 * blocks the browser from fetching them directly. That leg goes
 * through the transferClip Cloud Function (functions/index.js)
 * instead, which does the Monday fetch + Storage write server-side.
 * Both paths produce clips in the same shape either way.
 * ============================================================= */

import { getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

import { firebaseConfig, FIREBASE_CONFIGURED } from '../shared/firebase-config.js';
import { getIdToken } from './firestore-data.js';

// Deployed alongside this project's Firestore/Storage rules (see functions/index.js).
// Default Firebase Functions v2 region — deploy config doesn't override it, so this
// URL is stable as long as that stays true.
const TRANSFER_CLIP_FUNCTION_URL = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/transferClip`;

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
 * Move a clip from a remote URL (Monday's asset public_url) into Storage —
 * used only by the Monday clips migration. This does NOT fetch+upload from
 * the browser: Monday's CDN doesn't send CORS headers permitting a
 * cross-origin fetch() from this app's origin (confirmed by every transfer
 * failing with "Failed to fetch" in live testing), so the download has to
 * happen server-side. Proxying through a Netlify Function was the first
 * choice, but the account's Netlify bandwidth/credit budget can't absorb
 * ~169GB in one shot, so this calls transferClip (functions/index.js)
 * instead — a Firebase Cloud Function in the same Google Cloud project
 * Storage already lives in, so the fetch-from-Monday and write-to-Storage
 * legs both stay inside infrastructure already being paid for here, with
 * nothing routed through a second vendor.
 */
export async function uploadClipFromUrl(recordId, sourceUrl, filename) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not signed in');
  const res = await fetch(TRANSFER_CLIP_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ publicUrl: sourceUrl, recordId, filename }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || `Transfer failed (HTTP ${res.status})`);
  return { storagePath: json.storagePath, downloadUrl: json.downloadUrl, sizeBytes: json.sizeBytes };
}

export async function deleteClipFile(storagePath) {
  if (!storage || !storagePath) return;
  try { await deleteObject(ref(storage, storagePath)); } catch { /* already gone — fine */ }
}
