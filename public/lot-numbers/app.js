/* =============================================================
 * CMS Auction Suite — Lot #'s tab
 * -------------------------------------------------------------
 * Upload the working-sheet CSV → lot numbers are assigned from
 * the auction month: August → 801, 802, 803A, 803B …
 *
 * Rules:
 *  - Only rows that are actual lots get numbers (a row counts as
 *    a lot if it has a Consignor or a Head count). Section-header
 *    rows and blanks pass through untouched.
 *  - Option lots: consecutive rows whose "Option" column is
 *    filled (A, B, C …) AND that share the same Reference # are
 *    one group — they share a base number and keep their letter:
 *    803A, 803B. Everything else gets its own base number.
 *  - The whole CSV is preserved exactly (all columns, all rows,
 *    original order); only the Lot Number column is written.
 * ============================================================= */

const MONTHS = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

/** state */
let fields = [];   // original column order
let rows = [];     // original parsed rows (objects)
let plan = [];     // [{ rowIndex, lot, isLot, groupStart, option, ref, consignor }]

const $ = (id) => document.getElementById(id);

/* =============================================================
 * Controls
 * ============================================================= */
const monthSel = $("month");
MONTHS.forEach((m, i) => {
  const opt = document.createElement("option");
  opt.value = i + 1;
  opt.textContent = m;
  monthSel.appendChild(opt);
});
// Default to next month (this month's sale is usually already numbered)
const next = (new Date().getMonth() + 1) % 12;
monthSel.value = next + 1;

function defaultStart() {
  return Number(monthSel.value) * 100 + 1;
}
$("start-num").value = defaultStart();

monthSel.addEventListener("change", () => {
  $("start-num").value = defaultStart();
  renumber();
});
$("start-num").addEventListener("input", renumber);
$("btn-export").addEventListener("click", exportCsv);

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

function handleFile(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: false, // keep every row so the export mirrors the input
    complete: (results) => {
      fields = results.meta.fields || [];
      rows = results.data;
      // Papa can append one fully-empty trailing row; drop it
      while (rows.length && fields.every((f) => !String(rows[rows.length - 1][f] ?? "").trim())) {
        rows.pop();
      }
      if (!fields.some((f) => f.toLowerCase().trim() === "lot number")) {
        fields = [...fields, "Lot Number"];
      }
      if (!fields.some((f) => f.toLowerCase().trim() === "group number")) {
        const lotIdx = fields.findIndex((f) => f.toLowerCase().trim() === "lot number");
        fields = [...fields.slice(0, lotIdx + 1), "Group Number", ...fields.slice(lotIdx + 1)];
      }
      renumber();
    },
    error: (err) => alert("Could not read that CSV: " + err.message),
  });
}

/* =============================================================
 * Numbering
 * ============================================================= */
function col(row, name) {
  const key = fields.find((f) => f.toLowerCase().trim() === name.toLowerCase());
  return key ? String(row[key] ?? "").trim() : "";
}

function isLotRow(row) {
  return col(row, "Consignor") !== "" || col(row, "Head") !== "";
}

function renumber() {
  if (!rows.length) return;
  const start = parseInt($("start-num").value, 10) || defaultStart();

  plan = [];
  let base = start - 1;
  let prev = null; // { ref, option } of previous lot row

  rows.forEach((row, rowIndex) => {
    if (!isLotRow(row)) {
      plan.push({ rowIndex, lot: "", isLot: false });
      prev = null;
      return;
    }
    const option = col(row, "Option").toUpperCase();
    const ref = col(row, "Reference #");

    let groupStart;
    // Option letters are the only reliable group signal on real sheets:
    // Reference #s sometimes differ WITHIN a group (752A/752B) and
    // sometimes match ACROSS adjacent groups (732A–D then 733A–D).
    // So: B directly after A (C after B, …) continues the group; a
    // fresh "A" — or anything non-sequential — starts a new one.
    const continuesSequence =
      option &&
      prev &&
      prev.option &&
      option.length === 1 &&
      prev.option.length === 1 &&
      option.charCodeAt(0) === prev.option.charCodeAt(0) + 1;
    if (continuesSequence) {
      groupStart = false;
    } else {
      base += 1;
      groupStart = true;
    }
    plan.push({
      rowIndex,
      lot: option ? `${base}${option}` : String(base),
      group: String(base),
      isLot: true,
      groupStart,
      option,
      ref,
      consignor: col(row, "Consignor"),
      head: col(row, "Head"),
      breed: col(row, "Breed"),
    });
    prev = { ref, option };
  });

  render();
}

/* =============================================================
 * Rendering
 * ============================================================= */
function render() {
  dropzone.hidden = true;
  $("controls").hidden = false;
  $("header-actions").hidden = false;

  const lotCount = plan.filter((p) => p.isLot).length;
  const lastLot = [...plan].reverse().find((p) => p.isLot);

  $("table-wrap").innerHTML = `
    <p class="muted" style="margin:0 0 12px">
      ${lotCount} lots numbered ${esc(plan.find((p) => p.isLot)?.lot || "")} through
      ${esc(lastLot?.lot || "")}. Rows without a consignor are left untouched.
    </p>
    <table class="num-table">
      <thead><tr>
        <th>New Lot #</th><th>Group #</th><th>Option</th><th>Consignor</th>
        <th>Head</th><th>Breed</th><th>Reference #</th>
      </tr></thead>
      <tbody>
        ${plan
          .map((p) => {
            if (!p.isLot) {
              const raw = fields
                .map((f) => String(rows[p.rowIndex][f] ?? "").trim())
                .filter(Boolean)
                .join(" · ");
              return `<tr class="skip"><td class="newlot">—</td><td colspan="6">${esc(raw || "(blank row)")}</td></tr>`;
            }
            return `
          <tr class="${p.groupStart && p.option ? "group-start" : ""}">
            <td class="newlot">${esc(p.lot)}</td>
            <td>${esc(p.group)}</td>
            <td class="opt">${esc(p.option)}</td>
            <td>${esc(p.consignor)}</td>
            <td>${esc(p.head)}</td>
            <td>${esc(p.breed)}</td>
            <td>${esc(p.ref)}</td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

/* =============================================================
 * Export — full original CSV with Lot Number filled
 * ============================================================= */
function exportCsv() {
  const lotKey =
    fields.find((f) => f.toLowerCase().trim() === "lot number") || "Lot Number";
  const groupKey =
    fields.find((f) => f.toLowerCase().trim() === "group number") || "Group Number";

  const outRows = rows.map((row, i) => {
    const p = plan[i];
    const copy = { ...row };
    if (p && p.isLot) {
      copy[lotKey] = p.lot;
      copy[groupKey] = p.group;
    }
    return copy;
  });

  const lines = [fields.map(csvCell).join(",")];
  for (const row of outRows) {
    lines.push(fields.map((f) => csvCell(row[f])).join(","));
  }

  const monthName = MONTHS[Number(monthSel.value) - 1];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${monthName}_Auction - Working_On_Numbered.csv`;
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
