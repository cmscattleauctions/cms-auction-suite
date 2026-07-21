/* =============================================================
 * CMS Auction Suite — Auction Results tab
 * -------------------------------------------------------------
 * Upload the weekly working-sheet CSV, enter high bids / buyers
 * after the sale, merge option lots that sold together, and
 * export the Auction Results CSV in the exact column format the
 * team uses downstream.
 *
 * Format notes (matched to the real results file):
 *  - Column order and names are fixed, including the
 *    "Delivery State Date" spelling.
 *  - Lot Sequence = 10 × row position in the ORIGINAL working
 *    sheet; a merged group keeps its first member's sequence
 *    (701=10, 702AB=20, 703=40 — B's slot is consumed).
 *  - Contract # = <Lot>-<MMDDYY>, Contract Date = MMDDYY.
 *  - High Bid is $/cwt. "PO" = passed out → Estimated $ "PO",
 *    Total Pounds 0.
 *  - Estimated $ = Head × Base Weight × Bid ÷ 100.
 *  - Merged lots (e.g. 702AB) sum Load Count and Head Count.
 * ============================================================= */

import { COLUMN_NAMES, getCol, parseLotNumber } from "../shared/csv.js";

const OUT_COLUMNS = [
  "Reference #", "Representative", "CMS Internal Notes", "CMS External Notes",
  "Lot Number", "Lot Sequence", "Group Number", "Consignor", "Load Count",
  "Head Count", "Breed", "Sex", "Base Weight", "Delivery State Date",
  "Delivery End Date", "Delivery", "Location", "Shrink", "Slide",
  "Description", "Second Description", "Type", "Video", "Year", "Contract #",
  "Down Money Due", "Lot Number #2", "Buyer", "Calculated High Bid",
  "Contract Date", "Estimated $", "Total Pounds",
];

/** state */
let baseRows = [];        // one per working-sheet lot row, in sheet order
let mergedBases = new Set(); // numeric bases whose option lots are merged
let inputs = new Map();   // output lot label -> { bid, buyer, down }

const $ = (id) => document.getElementById(id);

/* =============================================================
 * Upload wiring
 * ============================================================= */
const dropzone = $("dropzone");
const fileInput = $("file-input");
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

$("btn-export").addEventListener("click", exportCsv);
$("btn-apply-down").addEventListener("click", applyDownPerHead);
$("sale-date").valueAsDate = new Date();

function handleFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: "greedy",
    complete: (results) => buildModel(results.data),
    error: (err) => alert("Could not read that CSV: " + err.message),
  });
}

/* =============================================================
 * Model
 * ============================================================= */
function buildModel(rows) {
  baseRows = [];
  mergedBases = new Set();
  inputs = new Map();

  let seq = 0;
  for (const row of rows) {
    const lot = getCol(row, [COLUMN_NAMES.lotNumber]).trim();
    if (!lot) continue;
    seq += 10;
    const parsed = parseLotNumber(lot);
    baseRows.push({
      lot,
      base: parsed.base,
      suffix: parsed.suffix,
      seq,
      ref: getCol(row, ["Reference #"]),
      rep: getCol(row, [COLUMN_NAMES.rep, COLUMN_NAMES.repAlt]),
      cmsInt: getCol(row, ["CMS Internal Notes"]),
      cmsExt: getCol(row, ["CMS External Notes"]),
      consignor: getCol(row, [COLUMN_NAMES.consignor, COLUMN_NAMES.seller]),
      loads: parseFloat(getCol(row, ["# of loads", "Load Count", "# of Loads"])) || 0,
      head: parseFloat(getCol(row, [COLUMN_NAMES.head, "Head Count"])) || 0,
      breed: getCol(row, ["Breed"]),
      sex: getCol(row, [COLUMN_NAMES.sex]),
      weight: parseFloat(getCol(row, ["Weight", COLUMN_NAMES.baseWeight, COLUMN_NAMES.baseWt])) || 0,
      delStart: getCol(row, ["Delivery Start Date", "Delivery State Date"]),
      delEnd: getCol(row, ["Delivery End Date"]),
      delivery: getCol(row, [COLUMN_NAMES.delivery]),
      location: getCol(row, [COLUMN_NAMES.location]),
      shrink: getCol(row, [COLUMN_NAMES.shrink]),
      slide: getCol(row, [COLUMN_NAMES.slide]),
      desc: getCol(row, [COLUMN_NAMES.description]),
      desc2: getCol(row, ["Description 2", "Second Description"]),
      type: getCol(row, [COLUMN_NAMES.type]),
      video: getCol(row, ["Automated Embedded Link", "Preview Video Link", "Video"]),
    });
  }
  render();
}

/** Build the output rows from base rows + merge state */
function outputRows() {
  const out = [];
  let i = 0;
  while (i < baseRows.length) {
    const r = baseRows[i];
    // Collect a consecutive run of the same base with suffixes
    const group = [r];
    let j = i + 1;
    while (
      j < baseRows.length &&
      baseRows[j].base === r.base &&
      baseRows[j].suffix &&
      r.suffix !== "" // only option lots group
    ) {
      group.push(baseRows[j]);
      j++;
    }

    if (group.length > 1 && mergedBases.has(r.base)) {
      out.push({
        ...r,
        lot: r.base + group.map((g) => g.suffix).join(""),
        loads: round2(group.reduce((s, g) => s + g.loads, 0)),
        head: group.reduce((s, g) => s + g.head, 0),
        groupSize: group.length,
        mergeBase: r.base,
        isMerged: true,
      });
    } else {
      group.forEach((g, k) =>
        out.push({
          ...g,
          groupSize: group.length,
          mergeBase: group.length > 1 ? r.base : null,
          isMerged: false,
          firstOfGroup: k === 0,
        })
      );
    }
    i = j;
  }
  return out;
}

function getInput(lotLabel) {
  if (!inputs.has(lotLabel)) {
    inputs.set(lotLabel, { bid: "", buyer: "", down: "0" });
  }
  return inputs.get(lotLabel);
}

/* =============================================================
 * Rendering
 * ============================================================= */
function render() {
  dropzone.hidden = true;
  $("controls").hidden = false;
  $("header-actions").hidden = false;

  const rows = outputRows();
  const html = `
    <table class="results-table">
      <thead><tr>
        <th>Lot</th><th>Options</th><th>Consignor</th>
        <th class="num">Loads</th><th class="num">Head</th><th class="num">Wt</th>
        <th>High Bid $/cwt</th><th>Buyer</th><th>Down $</th>
        <th class="num">Est. $</th><th class="num">Lbs</th>
      </tr></thead>
      <tbody>
        ${rows
          .map((r) => {
            const inp = getInput(r.lot);
            const mergeBtn =
              r.mergeBase != null && (r.isMerged || r.firstOfGroup)
                ? `<button class="merge-btn ${r.isMerged ? "active" : ""}" data-base="${r.mergeBase}" type="button">
                     ${r.isMerged ? "Merged — click to split" : "Merge " + r.groupSize + " lots"}
                   </button>`
                : "";
            return `
          <tr data-lot="${escAttr(r.lot)}" class="${(r.groupSize > 1 && (r.firstOfGroup || r.isMerged)) ? "group-start" : ""}">
            <td class="lotcell">${esc(r.lot)}</td>
            <td>${mergeBtn}</td>
            <td>${esc(r.consignor)}</td>
            <td class="num">${trimNum(r.loads)}</td>
            <td class="num">${r.head}</td>
            <td class="num">${r.weight}</td>
            <td style="white-space:nowrap">
              <input class="bid" data-field="bid" value="${escAttr(inp.bid)}" placeholder="0.00">
              <button class="po-btn ${isPO(inp.bid) ? "active" : ""}" type="button">PO</button>
            </td>
            <td><input class="buyer" data-field="buyer" value="${escAttr(inp.buyer)}"></td>
            <td><input class="down" data-field="down" type="number" min="0" step="1" value="${escAttr(inp.down)}"></td>
            <td class="num est-cell">${estDisplay(r, inp.bid)}</td>
            <td class="num lbs-cell">${lbsDisplay(r, inp.bid)}</td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
  $("table-wrap").innerHTML = html;
}

/* Delegated events for the table */
$("table-wrap").addEventListener("input", (e) => {
  const tr = e.target.closest("tr[data-lot]");
  if (!tr) return;
  const inp = getInput(tr.dataset.lot);
  const field = e.target.dataset.field;
  if (!field) return;
  inp[field] = e.target.value;
  if (field === "bid") refreshRowCalc(tr);
});

$("table-wrap").addEventListener("click", (e) => {
  const merge = e.target.closest(".merge-btn");
  if (merge) {
    const base = Number(merge.dataset.base);
    if (mergedBases.has(base)) mergedBases.delete(base);
    else mergedBases.add(base);
    render();
    return;
  }
  const po = e.target.closest(".po-btn");
  if (po) {
    const tr = po.closest("tr[data-lot]");
    const inp = getInput(tr.dataset.lot);
    inp.bid = isPO(inp.bid) ? "" : "PO";
    tr.querySelector("input.bid").value = inp.bid;
    po.classList.toggle("active", isPO(inp.bid));
    refreshRowCalc(tr);
  }
});

function refreshRowCalc(tr) {
  const rows = outputRows();
  const r = rows.find((x) => x.lot === tr.dataset.lot);
  if (!r) return;
  const inp = getInput(r.lot);
  tr.querySelector(".est-cell").textContent = estDisplay(r, inp.bid);
  tr.querySelector(".lbs-cell").textContent = lbsDisplay(r, inp.bid);
  tr.querySelector(".po-btn").classList.toggle("active", isPO(inp.bid));
}

function applyDownPerHead() {
  const perHead = parseFloat($("down-per-head").value);
  if (isNaN(perHead)) return;
  for (const r of outputRows()) {
    getInput(r.lot).down = String(Math.round(r.head * perHead));
  }
  render();
}

/* =============================================================
 * Calculations + formats
 * ============================================================= */
function isPO(bid) {
  return String(bid).trim().toUpperCase() === "PO";
}
function bidNum(bid) {
  const n = parseFloat(String(bid).replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}
function estDisplay(r, bid) {
  if (isPO(bid)) return "PO";
  const b = bidNum(bid);
  if (b == null) return "—";
  return money((r.head * r.weight * b) / 100);
}
function lbsDisplay(r, bid) {
  if (isPO(bid)) return "0";
  return commas(r.head * r.weight);
}
function money(v) {
  return (
    "$" +
    Number(v).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
function commas(v) {
  return Number(v).toLocaleString("en-US");
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
function trimNum(v) {
  return String(round2(v));
}

/* =============================================================
 * Export
 * ============================================================= */
function saleDateParts() {
  const val = $("sale-date").value; // yyyy-mm-dd
  const [y, m, d] = val
    ? val.split("-").map(Number)
    : (() => {
        const t = new Date();
        return [t.getFullYear(), t.getMonth() + 1, t.getDate()];
      })();
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const yy = String(y).slice(-2);
  return { year: y, mmddyy: `${mm}${dd}${yy}`, label: `${m}_${d}_${yy}` };
}

function exportCsv() {
  const { year, mmddyy, label } = saleDateParts();
  const lines = [OUT_COLUMNS.map(csvCell).join(",")];

  for (const r of outputRows()) {
    const inp = getInput(r.lot);
    const po = isPO(inp.bid);
    const b = bidNum(inp.bid);
    const row = {
      "Reference #": r.ref,
      "Representative": r.rep,
      "CMS Internal Notes": r.cmsInt,
      "CMS External Notes": r.cmsExt,
      "Lot Number": r.lot,
      "Lot Sequence": r.seq,
      "Group Number": isNaN(r.base) ? r.lot : r.base,
      "Consignor": r.consignor,
      "Load Count": trimNum(r.loads),
      "Head Count": r.head,
      "Breed": r.breed,
      "Sex": r.sex,
      "Base Weight": r.weight,
      "Delivery State Date": r.delStart,
      "Delivery End Date": r.delEnd,
      "Delivery": r.delivery,
      "Location": r.location,
      "Shrink": r.shrink,
      "Slide": r.slide,
      "Description": r.desc,
      "Second Description": r.desc2,
      "Type": r.type,
      "Video": r.video,
      "Year": year,
      "Contract #": `${r.lot}-${mmddyy}`,
      "Down Money Due": money(parseFloat(inp.down) || 0),
      "Lot Number #2": r.lot,
      "Buyer": inp.buyer,
      "Calculated High Bid": po ? "PO" : b == null ? "" : money(b),
      "Contract Date": mmddyy,
      "Estimated $": po ? "PO" : b == null ? "" : money((r.head * r.weight * b) / 100),
      "Total Pounds": po || b == null ? "0" : commas(r.head * r.weight),
    };
    lines.push(OUT_COLUMNS.map((c) => csvCell(row[c])).join(","));
  }

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${label} - Auction_Results.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* =============================================================
 * Helpers
 * ============================================================= */
function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escAttr(s) {
  return esc(s).replace(/"/g, "&quot;");
}
