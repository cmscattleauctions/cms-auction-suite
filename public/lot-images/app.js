/* =============================================================
 * CMS Auction Suite — Lot Images tab
 * -------------------------------------------------------------
 * Upload the weekly working-sheet CSV → get one image per lot,
 * named Lot_<LotNumber>.jpg, plus a manifest CSV.
 *
 * How the images work:
 *   Our uploads use a custom logo thumbnail, so the "main"
 *   YouTube thumbnail is useless for listings. But YouTube also
 *   auto-generates 3 real frames from every video's footage:
 *     vi/<id>/1.jpg  (early)
 *     vi/<id>/2.jpg  (middle)   ← default pick
 *     vi/<id>/3.jpg  (late)
 *   Those are shown here for preview (no CORS needed for <img>).
 *   Downloads go through /api/thumb (netlify/functions/thumb.mjs)
 *   which adds CORS headers and upgrades to the best available
 *   resolution (maxres → sd → hq).
 *
 * Uses shared/csv.js for column matching (per its guidance that
 * new code should prefer it over rolling its own).
 * ============================================================= */

import { COLUMN_NAMES, getCol, sortByLot } from "../shared/csv.js";

const VIDEO_LINK_COLS = ["Preview Video Link", "Automated Embedded Link"];
const DEFAULT_FRAME = 2;

/** state */
let lots = [];      // [{ lot, consignor, videoId, link }]
let videos = [];    // [{ id, frame, lots: [lot labels] }] — one frame choice per video
let missing = [];   // lot numbers with no video link

/* =============================================================
 * DOM
 * ============================================================= */
const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone");
const fileInput = $("file-input");
const grid = $("grid");
const summary = $("summary");
const headerActions = $("header-actions");
const progressCard = $("progress-card");
const progressLabel = $("progress-label");
const progressFill = $("progress-fill");

/* =============================================================
 * Upload wiring
 * ============================================================= */
dropzone.addEventListener("click", () => fileInput.click());
$("btn-browse").addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});
["dragover", "dragenter"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) handleFile(f);
});

$("btn-zip").addEventListener("click", downloadZip);
$("btn-csv").addEventListener("click", downloadManifestOnly);
grid.addEventListener("click", onGridClick);

/* =============================================================
 * CSV parsing
 * ============================================================= */
function handleFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    complete: (results) => buildModel(results.data),
    error: (err) => alert("Could not read that CSV: " + err.message),
  });
}

function videoIdFrom(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:youtu\.be\/|watch\?v=|embed\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function buildModel(rows) {
  lots = [];
  missing = [];

  const lotKeyRows = rows.filter(
    (r) => getCol(r, [COLUMN_NAMES.lotNumber]).trim() !== ""
  );
  const sorted = sortByLotSafe(lotKeyRows);

  for (const row of sorted) {
    const lot = getCol(row, [COLUMN_NAMES.lotNumber]).trim();
    const consignor = getCol(row, [
      COLUMN_NAMES.consignor,
      COLUMN_NAMES.seller,
    ]);
    let link = "";
    let vid = null;
    for (const col of VIDEO_LINK_COLS) {
      link = getCol(row, [col]);
      vid = videoIdFrom(link);
      if (vid) break;
    }

    if (!vid) {
      missing.push(lot);
      continue;
    }
    lots.push({ lot, consignor, videoId: vid, link });
  }

  // One card per unique video; picking a frame applies to every lot on it
  const byVideo = new Map();
  for (const l of lots) {
    if (!byVideo.has(l.videoId)) {
      byVideo.set(l.videoId, { id: l.videoId, frame: DEFAULT_FRAME, lots: [], consignors: new Set() });
    }
    const v = byVideo.get(l.videoId);
    v.lots.push(l.lot);
    if (l.consignor) v.consignors.add(l.consignor);
  }
  videos = [...byVideo.values()];

  render();
}

/** sortByLot expects the raw key; wrap to survive odd headers */
function sortByLotSafe(rows) {
  try {
    // find the actual "Lot Number" key from the first row
    const sample = rows[0] || {};
    const key = Object.keys(sample).find(
      (k) => k.toLowerCase().trim() === COLUMN_NAMES.lotNumber.toLowerCase()
    );
    return key ? sortByLot(rows, key) : rows;
  } catch {
    return rows;
  }
}

/* =============================================================
 * Rendering
 * ============================================================= */
function render() {
  dropzone.hidden = true;
  headerActions.hidden = false;
  summary.hidden = false;

  summary.innerHTML = `
    <div class="stat"><b>${lots.length}</b> lots with images</div>
    <div class="stat"><b>${videos.length}</b> videos — pick one clip each</div>
    ${
      missing.length
        ? `<div class="stat warn"><b>${missing.length}</b> lots missing a video link<br>
           <span style="font-size:12px">${escapeHtml(missing.join(", "))}</span></div>`
        : ""
    }
    <div class="stat" style="align-self:center">
      <button class="btn btn-secondary" id="btn-reset" type="button">Upload a different CSV</button>
    </div>
  `;
  $("btn-reset").addEventListener("click", reset);

  grid.innerHTML = videos
    .map(
      (v, i) => `
    <div class="card video-card" data-index="${i}">
      <img class="main-frame"
           src="https://i.ytimg.com/vi/${v.id}/hq${v.frame}.jpg"
           alt="Frame preview" loading="lazy">
      <div class="body">
        <div class="lot-badges">
          ${v.lots
            .map((l) => `<span class="lot-badge">Lot ${escapeHtml(l)}</span>`)
            .join("")}
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:10px">${escapeHtml([...v.consignors].join(", "))}</div>
        <div class="frame-picker">
          <span class="hint">Pick clip${v.lots.length > 1 ? " (applies to all " + v.lots.length + " lots)" : ""}:</span>
          ${[1, 2, 3]
            .map(
              (n) => `
            <img class="frame-thumb ${n === v.frame ? "selected" : ""}"
                 data-frame="${n}"
                 src="https://i.ytimg.com/vi/${v.id}/hq${n}.jpg"
                 alt="Frame option ${n}" loading="lazy">`
            )
            .join("")}
        </div>
        <a class="video-link" href="https://www.youtube.com/watch?v=${v.id}"
           target="_blank" rel="noopener">Open video ↗</a>
      </div>
    </div>`
    )
    .join("");
}

function onGridClick(e) {
  const thumb = e.target.closest(".frame-thumb");
  if (!thumb) return;
  const card = thumb.closest(".video-card");
  const video = videos[Number(card.dataset.index)];
  video.frame = Number(thumb.dataset.frame);

  card.querySelector(".main-frame").src = `https://i.ytimg.com/vi/${video.id}/hq${video.frame}.jpg`;
  card
    .querySelectorAll(".frame-thumb")
    .forEach((t) =>
      t.classList.toggle("selected", Number(t.dataset.frame) === video.frame)
    );
}

function reset() {
  lots = [];
  videos = [];
  missing = [];
  fileInput.value = "";
  grid.innerHTML = "";
  summary.hidden = true;
  headerActions.hidden = true;
  progressCard.hidden = true;
  dropzone.hidden = false;
}

/* =============================================================
 * Downloads
 * ============================================================= */

function frameFor(videoId) {
  const v = videos.find((x) => x.id === videoId);
  return v ? v.frame : DEFAULT_FRAME;
}

function manifestCsv() {
  const header = "lot_number,consignor,filename,video_link,frame\n";
  const rows = lots.map((l) =>
    [
      csvCell(l.lot),
      csvCell(l.consignor),
      csvCell(`Lot_${l.lot}.jpg`),
      csvCell(l.link),
      frameFor(l.videoId),
    ].join(",")
  );
  return header + rows.join("\n") + "\n";
}

function downloadManifestOnly() {
  saveBlob(
    new Blob([manifestCsv()], { type: "text/csv" }),
    "lot_images.csv"
  );
}

/**
 * Fetch one video's chosen frame as a Blob.
 * Try the Netlify function first (CORS + best resolution),
 * then fall back to a direct fetch in case the function isn't
 * available (e.g. local python http.server).
 */
async function fetchFrameBlob(videoId, frame) {
  const attempts = [
    `/api/thumb?id=${videoId}&frame=${frame}`,
    `/.netlify/functions/thumb?id=${videoId}&frame=${frame}`,
    `https://i.ytimg.com/vi/${videoId}/hq${frame}.jpg`,
  ];
  for (const url of attempts) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size > 2000) return blob;
      }
    } catch {
      /* try next */
    }
  }
  throw new Error(`Could not download frame for video ${videoId}`);
}

async function downloadZip() {
  const btn = $("btn-zip");
  btn.disabled = true;
  progressCard.hidden = false;

  const zip = new JSZip();
  const cache = new Map(); // videoId -> blob
  const failedLots = [];

  const queue = [...videos];
  let done = 0;
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const v = queue.shift();
      try {
        cache.set(v.id, await fetchFrameBlob(v.id, v.frame));
      } catch {
        /* marked missing below per-lot */
      }
      done++;
      progressLabel.textContent = `Downloading clips… ${done} of ${videos.length}`;
      progressFill.style.width = `${(done / videos.length) * 90}%`;
    }
  });
  await Promise.all(workers);

  progressLabel.textContent = "Building zip…";
  for (const l of lots) {
    const blob = cache.get(l.videoId);
    if (blob) zip.file(`Lot_${l.lot}.jpg`, blob);
    else failedLots.push(l.lot);
  }
  zip.file("lot_images.csv", manifestCsv());

  const out = await zip.generateAsync({ type: "blob" });
  progressFill.style.width = "100%";
  saveBlob(out, "lot_images.zip");

  progressLabel.textContent = failedLots.length
    ? `Done — but these lots failed: ${failedLots.join(", ")}`
    : "Done! Check your downloads for lot_images.zip";
  btn.disabled = false;
  setTimeout(() => {
    if (!failedLots.length) progressCard.hidden = true;
    progressFill.style.width = "0%";
  }, 4000);
}

/* =============================================================
 * Helpers
 * ============================================================= */
function saveBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
