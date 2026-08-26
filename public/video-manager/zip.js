/* =============================================================
 * CMS Video Manager — minimal client-side ZIP writer
 * -------------------------------------------------------------
 * Store-only (no compression — these are already-compressed video
 * files, so compressing again would just burn CPU for no size win).
 * Streams straight to disk via the File System Access API when the
 * browser supports it (Chromium), so a handful of multi-GB clips
 * never sit fully buffered in memory; falls back to assembling an
 * in-memory Blob and triggering a normal download when that API
 * isn't available (Safari/Firefox).
 *
 * Uses the standard "data descriptor" ZIP feature (general-purpose
 * flag bit 3) so CRC-32/size can be written *after* each file's
 * bytes have streamed through, rather than needing to know them
 * up front — every mainstream unzip tool (Explorer, Archive
 * Utility, 7-Zip, unzip) supports this.
 *
 * No Zip64 support: fine for a handful of clips per video record
 * (each already capped at 2GB elsewhere in this app), not intended
 * for huge multi-GB+ archives.
 * ============================================================= */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function createCrc32() {
  let crc = 0xFFFFFFFF;
  return {
    update(chunk) {
      for (let i = 0; i < chunk.length; i++) crc = CRC_TABLE[(crc ^ chunk[i]) & 0xFF] ^ (crc >>> 8);
    },
    value() { return (crc ^ 0xFFFFFFFF) >>> 0; },
  };
}

function sanitizeZipName(name) {
  return String(name || 'clip').replace(/[\\/:*?"<>|]/g, '_');
}

function localHeaderBytes(nameBytes) {
  const buf = new ArrayBuffer(30);
  const v = new DataView(buf);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 0x0008, true); // bit 3: sizes/CRC follow in a data descriptor
  v.setUint16(8, 0, true); // method: store
  v.setUint16(10, 0, true); // time
  v.setUint16(12, 0x21, true); // date: fixed placeholder (1980-01-01) — not meaningful here
  v.setUint32(14, 0, true); // crc — in data descriptor instead
  v.setUint32(18, 0, true); // compressed size — in data descriptor instead
  v.setUint32(22, 0, true); // uncompressed size — in data descriptor instead
  v.setUint16(26, nameBytes.length, true);
  v.setUint16(28, 0, true); // extra field length
  return new Uint8Array(buf);
}

function dataDescriptorBytes(crc, size) {
  const buf = new ArrayBuffer(16);
  const v = new DataView(buf);
  v.setUint32(0, 0x08074b50, true);
  v.setUint32(4, crc, true);
  v.setUint32(8, size, true);
  v.setUint32(12, size, true);
  return new Uint8Array(buf);
}

function centralHeaderBytes(rec) {
  const buf = new ArrayBuffer(46);
  const v = new DataView(buf);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, 0x0008, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, 0, true);
  v.setUint16(14, 0x21, true);
  v.setUint32(16, rec.crc, true);
  v.setUint32(20, rec.size, true);
  v.setUint32(24, rec.size, true);
  v.setUint16(28, rec.nameBytes.length, true);
  v.setUint16(30, 0, true);
  v.setUint16(32, 0, true);
  v.setUint16(34, 0, true);
  v.setUint16(36, 0, true);
  v.setUint32(38, 0, true);
  v.setUint32(42, rec.localHeaderOffset, true);
  return new Uint8Array(buf);
}

function eocdBytes(count, centralSize, centralOffset) {
  const buf = new ArrayBuffer(22);
  const v = new DataView(buf);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(4, 0, true);
  v.setUint16(6, 0, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, centralSize, true);
  v.setUint32(16, centralOffset, true);
  v.setUint16(20, 0, true);
  return new Uint8Array(buf);
}

/**
 * Build a ZIP from `files` (each { filename, downloadUrl }) and hand it
 * to the user as `zipFilename`. Rejects with an AbortError if the user
 * cancels a native save dialog — callers should treat that as a no-op,
 * not a failure.
 */
export async function downloadFilesAsZip(files, zipFilename, { onProgress } = {}) {
  if (!files.length) throw new Error('No files to zip');

  let useFsApi = typeof window.showSaveFilePicker === 'function';
  let fsStream = null;
  const memChunks = useFsApi ? null : [];

  if (useFsApi) {
    fsStream = await window.showSaveFilePicker({
      suggestedName: zipFilename,
      types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
    }).then(handle => handle.createWritable());
  }

  let offset = 0;
  async function write(bytes) {
    offset += bytes.length;
    if (useFsApi) await fsStream.write(bytes);
    else memChunks.push(bytes);
  }

  const centralRecords = [];
  for (const file of files) {
    const nameBytes = new TextEncoder().encode(sanitizeZipName(file.filename));
    const localHeaderOffset = offset;
    await write(localHeaderBytes(nameBytes));
    await write(nameBytes);

    const res = await fetch(file.downloadUrl);
    if (!res.ok || !res.body) throw new Error(`Could not fetch ${file.filename}`);
    const crc = createCrc32();
    let size = 0;
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      crc.update(value);
      size += value.byteLength;
      await write(value);
    }
    await write(dataDescriptorBytes(crc.value(), size));

    centralRecords.push({ nameBytes, crc: crc.value(), size, localHeaderOffset });
    onProgress?.(file, centralRecords.length, files.length);
  }

  const centralStart = offset;
  for (const rec of centralRecords) {
    await write(centralHeaderBytes(rec));
    await write(rec.nameBytes);
  }
  await write(eocdBytes(centralRecords.length, offset - centralStart, centralStart));

  if (useFsApi) {
    await fsStream.close();
  } else {
    const blob = new Blob(memChunks, { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
