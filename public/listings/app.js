/* ==================================================================
 * CMS Livestock Auction — Listing Builder
 * ------------------------------------------------------------------
 * Client-side app. No build step, no server required.
 *
 * RESPONSIBILITIES (top-to-bottom):
 *   1. Global state + default config (header, colors, toggles)
 *   2. CSV parsing + normalization of raw rows into Lot records
 *   3. Grouping:   by Type -> section | by Group Number -> option cluster
 *   4. Option-lot logic:  parse "401A" into {base:401, suffix:"A"}
 *                         then group by shared base/Group Number.
 *   5. Pagination:   slice rows across 8.5"x11" landscape pages.
 *   6. Rendering:    sale header, section bars, table rows, footer.
 *   7. Inline editing: every cell is contentEditable; edits are
 *                      written back into the Lot records live.
 *   8. Export:       PDF via window.print, HTML via Blob download.
 * ================================================================== */


/* ============================================================
 * 1. STATE + DEFAULTS
 * ============================================================ */

/** Default header text. Change these to re-brand globally. */
const DEFAULT_HEADER = {
  title:    'CMS LIVESTOCK AUCTION',
  subtitle: 'April DairyX, Holstein and Native Auction',
  datetime: 'April 9th, 2026 @ 1:00PM',
  website:  'www.CattleMarketingServices.com',
  phone:    '(806) 355-7505',
  fax:      '(806) 355-7990',
  addr1:    '6900 I40 West',
  addr2:    'STE 135',
  addr3:    'Amarillo, TX 79106',
};

/** Default color per Type. Fallback color is used for unknown types. */
const DEFAULT_SECTION_COLORS = {
  'Black X Beef on Dairy':     '#0f2747',  // navy
  'Charolais X Beef on Dairy': '#a67c2b',  // warm gold/tan
  'Natives':                   '#2f6b5a',  // muted green/teal
  'Holsteins':                 '#3b5a80',  // steel blue
};
const FALLBACK_SECTION_COLOR = '#2a5aa0';

/** Options toggled from the sidebar. */
const DEFAULT_OPTIONS = {
  showVideo:         true,
  showExternalNotes: true,
  showInternalNotes: false,
  zebra:             true,
};

/** Page capacity expressed in "height units" where 1 unit = ~85px rendered.
 *
 *  Measured empirically against live rendered pages:
 *    - Content area per continuation page: ~681px
 *    - Typical 3-line notes row:           ~85px  (= 1.0 unit)
 *    - Typical 4-line notes row:           ~110px (= 1.3 units)
 *    - Section bar + thead overhead:       ~59px  (= 0.7 units)
 *
 *  Page 1 is smaller because it carries the sale header (~100px). */
const PAGE_CAPACITY_FIRST = 6.8;
const PAGE_CAPACITY_REST  = 8.3;
const SECTION_BAR_UNITS   = 0.4;
const TABLE_HEADER_UNITS  = 0.4;

/** Global mutable state. */
const state = {
  lots: [],                            // parsed Lot records
  header: { ...DEFAULT_HEADER },
  colors: { ...DEFAULT_SECTION_COLORS },
  options: { ...DEFAULT_OPTIONS },
  logoDataUrl: null,                   // base64 data URL for custom logo
  lastRawCsv: null,                    // for Reset
};


/* ============================================================
 * 2. CSV PARSING + NORMALIZATION
 * ============================================================ */

/**
 * Parse raw CSV string into an array of Lot records.
 *
 * We use a hand-rolled parser (not PapaParse) so the app has
 * zero runtime dependencies and works completely offline.
 * It handles:
 *   - quoted fields with embedded commas
 *   - quoted fields with embedded newlines  (critical for the
 *     "Slide" and "Description" columns which contain \n)
 *   - escaped quotes ("")
 *   - Windows CRLF or Unix LF line endings
 */
function parseCsv(csvText) {
  const rows = csvToRows(csvText);
  if (!rows.length) return [];
  const headers = rows.shift().map(h => (h || '').trim());
  const objects = rows
    .filter(r => r.some(v => v && v.trim()))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (r[i] != null ? r[i] : ''); });
      return obj;
    });
  return objects.map(normalizeRow).filter(lot => lot.lotNumber);
}

/** State-machine CSV tokenizer. Returns array of row arrays. */
function csvToRows(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;   // consume CRLF
      row.push(field); rows.push(row);
      row = []; field = ''; i++; continue;
    }
    field += c; i++;
  }
  // Flush trailing field/row (no terminating newline)
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Trim + collapse whitespace, preserve intentional line breaks. */
function cleanText(val) {
  if (val == null) return '';
  return String(val).replace(/\r\n/g, '\n').trim();
}

/**
 * Convert a raw CSV row into a typed Lot record.
 * Every field is safe-defaulted so downstream code never crashes on blanks.
 */
function normalizeRow(row) {
  const lotNumber  = cleanText(row['Lot Number']);
  const { base, suffix } = parseLotNumber(lotNumber);

  return {
    referenceNum:    cleanText(row['Reference #']),
    representative:  cleanText(row['Representative']),
    internalNotes:   cleanText(row['CMS Internal Notes']),
    externalNotes:   cleanText(row['CMS External Notes']),

    lotNumber:       lotNumber,
    lotBase:         base,
    lotSuffix:       suffix,
    lotSequence:     safeNumber(row['Lot Sequence']),
    groupNumber:     cleanText(row['Group Number']),

    consignor:       cleanText(row['Consignor']),
    loadCount:       cleanText(row['Load Count']),
    headCount:       cleanText(row['Head Count']),
    breed:           cleanText(row['Breed']),
    sex:             cleanText(row['Sex']),
    baseWeight:      cleanText(row['Base Weight']),

    deliveryStart:   cleanText(row['Delivery State Date']),
    deliveryEnd:     cleanText(row['Delivery End Date']),
    delivery:        cleanText(row['Delivery']),

    location:        cleanText(row['Location']),
    shrink:          cleanText(row['Shrink']),
    slide:           cleanText(row['Slide']),

    description:     cleanText(row['Description']),
    secondDesc:      cleanText(row['Second Description']),
    type:            cleanText(row['Type']) || 'Uncategorized',
    video:           cleanText(row['Video']),

    // User-editable status, not in CSV by default.
    price:           cleanText(row['Price'] || row['Price / Status'] || ''),
  };
}

function safeNumber(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}


/* ============================================================
 * 3. OPTION LOT GROUPING
 * ============================================================
 *
 * A "Lot Number" looks like either:
 *   - "402"   -> base=402, suffix=""     (standalone)
 *   - "401A"  -> base=401, suffix="A"    (option lot)
 *   - "410C"  -> base=410, suffix="C"    (option lot)
 *
 * Grouping rule:
 *   Two lots belong to the same option cluster when they share
 *   EITHER the numeric base portion OR the Group Number field,
 *   AND at least one of them has an alpha suffix.
 *
 * Rendering rule:
 *   - Rows within a cluster use a soft dotted divider (opt-group-mid)
 *   - The LAST row in each cluster uses a strong boundary (opt-group-end)
 *   - Standalone lots always get a strong boundary (opt-standalone)
 *
 * Net effect: option lots (401A/401B) visually hug together,
 * and a clear rule separates them from the next unrelated lot.
 */

function parseLotNumber(raw) {
  if (!raw) return { base: '', suffix: '' };
  // Match a leading number and any trailing alpha (ignore internal spaces).
  const m = raw.trim().match(/^(\d+)\s*([A-Za-z]*)/);
  if (!m) return { base: raw.trim(), suffix: '' };
  return { base: m[1], suffix: (m[2] || '').toUpperCase() };
}

/**
 * Given an ordered list of lots within a section, annotate each
 * with a groupPos flag: 'standalone' | 'start' | 'mid' | 'end'.
 * Used purely for styling the boundary lines.
 */
function annotateOptionGroups(sortedLots) {
  const n = sortedLots.length;
  for (let i = 0; i < n; i++) {
    const curr = sortedLots[i];
    const prev = i > 0 ? sortedLots[i - 1] : null;
    const next = i < n - 1 ? sortedLots[i + 1] : null;

    const sameAsPrev = prev && inSameOptionCluster(curr, prev);
    const sameAsNext = next && inSameOptionCluster(curr, next);

    if (!sameAsPrev && !sameAsNext) curr.groupPos = 'standalone';
    else if (!sameAsPrev &&  sameAsNext) curr.groupPos = 'start';
    else if ( sameAsPrev &&  sameAsNext) curr.groupPos = 'mid';
    else if ( sameAsPrev && !sameAsNext) curr.groupPos = 'end';
  }
}

/**
 * Two lots are in the same option cluster when:
 *   - they share a Group Number (if non-empty), OR
 *   - they share the numeric base portion of the lot number
 * AND at least one of them has a suffix (otherwise they're two
 * unrelated standalone lots that happen to share a base, which
 * shouldn't occur, but we defend against).
 */
function inSameOptionCluster(a, b) {
  const shareGroup = a.groupNumber && b.groupNumber && a.groupNumber === b.groupNumber;
  const shareBase  = a.lotBase && b.lotBase && a.lotBase === b.lotBase;
  const hasSuffix  = a.lotSuffix || b.lotSuffix;
  return Boolean((shareGroup || shareBase) && hasSuffix);
}


/* ============================================================
 * 4. BUILD SECTIONED STRUCTURE
 * ============================================================ */

/**
 * Group parsed lots by Type (section), sorted within each section
 * by Lot Sequence, and annotate option-group positions.
 *
 * Preserve the order in which Types first appear in the CSV
 * (so the user's authoring order is respected).
 */
function buildSections(lots) {
  const sectionMap = new Map();  // type -> array
  const order      = [];         // first-seen order of Types

  for (const lot of lots) {
    if (!sectionMap.has(lot.type)) {
      sectionMap.set(lot.type, []);
      order.push(lot.type);
    }
    sectionMap.get(lot.type).push(lot);
  }

  const sections = order.map(type => {
    const items = sectionMap.get(type).slice();
    items.sort((a, b) => a.lotSequence - b.lotSequence);
    annotateOptionGroups(items);
    return { type, lots: items };
  });

  return sections;
}


/* ============================================================
 * 5. PAGINATION
 * ============================================================
 *
 * Flatten the sections into a linear stream of "blocks":
 *   - { kind: 'section', type, isFirstForType }
 *   - { kind: 'row',     lot, sectionType }
 *
 * Estimate each row's height in "units" (1 unit = standard short row).
 * A section bar is 0.6 units. Page budgets are tuned empirically.
 *
 * Orphan prevention:
 *   - A section bar that can't fit with >= 1 row on the current page
 *     goes to the next page.
 *   - An option-lot cluster is kept together when possible — if the
 *     first row of a cluster would otherwise break, flush the page
 *     and start the cluster at the top of the next one.
 */
function estimateRowUnits(lot) {
  // Count lines in notes column (the usual culprit for tall rows)
  const descLines = countVisualLines(lot.description, 60);
  const sdLines   = countVisualLines(lot.secondDesc, 60);
  const extLines  = state.options.showExternalNotes ? countVisualLines(lot.externalNotes, 60) : 0;
  const intLines  = state.options.showInternalNotes ? countVisualLines(lot.internalNotes, 60) : 0;
  const notesTotalLines = descLines + sdLines + extLines + intLines;

  // Description column (~16% width) wraps breed text
  const breedLines = countVisualLines(lot.breed, 22);
  // Slide column tends to have "$0.90 Dairy / Slide Up and Down" stacked
  const slideLines = countVisualLines(lot.slide, 18);

  const maxLines = Math.max(notesTotalLines, breedLines, slideLines, 1);

  // Measured: 1 line ~ 28px, each additional line ~ 16px => ~85px = 1u = 4 lines
  // So units ~= (28 + (lines-1)*16) / 85
  return (28 + (maxLines - 1) * 16) / 85;
}

/** Count likely wrapped-plus-explicit-newline lines in a text block. */
function countVisualLines(text, charsPerLine) {
  if (!text) return 0;
  let lines = 0;
  for (const para of text.split('\n')) {
    lines += Math.max(1, Math.ceil(para.length / charsPerLine));
  }
  return lines;
}

function paginate(sections) {
  // Build a linear stream with cluster metadata so we can keep clusters intact.
  const stream = [];
  for (const s of sections) {
    stream.push({ kind: 'section', type: s.type });
    for (const lot of s.lots) {
      stream.push({
        kind: 'row',
        lot,
        sectionType: s.type,
        units: estimateRowUnits(lot),
        groupPos: lot.groupPos,
      });
    }
  }

  const pages = [];
  let current = [];
  let capacity = PAGE_CAPACITY_FIRST;
  let used = 0;
  let activeSection = null;  // the section whose rows we're currently emitting

  const flush = (carrySection = false) => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
    capacity = PAGE_CAPACITY_REST;
    // Carry the active section as a continuation bar on the next page
    if (carrySection && activeSection) {
      current.push({ kind: 'section', type: activeSection, continuation: true });
      used += SECTION_BAR_UNITS + TABLE_HEADER_UNITS;
    }
  };

  /** Look ahead from index i for the length (in units) of the
   *  current option-lot cluster starting at this row. Returns 0 if
   *  the row is standalone or is the tail of a cluster. */
  const clusterUnitsFrom = (i) => {
    if (stream[i].kind !== 'row') return 0;
    if (stream[i].groupPos !== 'start') return stream[i].units;
    let sum = 0;
    for (let j = i; j < stream.length; j++) {
      if (stream[j].kind !== 'row') break;
      sum += stream[j].units;
      if (stream[j].groupPos === 'end' || stream[j].groupPos === 'standalone') break;
      if (j > i && stream[j].groupPos === 'start') break; // defensive
    }
    return sum;
  };

  for (let i = 0; i < stream.length; i++) {
    const item = stream[i];

    if (item.kind === 'section') {
      activeSection = item.type;
      const barAndHead = SECTION_BAR_UNITS + TABLE_HEADER_UNITS;
      // Need at least room for bar + thead + one row
      if (used + barAndHead + 0.9 > capacity) flush();
      current.push(item);
      used += barAndHead;
      continue;
    }

    // Row: try to keep clusters intact
    const need = item.groupPos === 'start' ? clusterUnitsFrom(i) : item.units;

    if (used + need > capacity) {
      // If this single row alone doesn't fit, the cluster is too big
      // for any page — accept a break; start on a fresh page.
      flush(/*carrySection*/ true);
    }

    current.push(item);
    used += item.units;
  }
  flush();
  return pages;
}


/* ============================================================
 * 6. RENDERING
 * ============================================================ */

/** Escape user-visible text for safe HTML insertion. */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render the whole document into #docRoot. */
function renderDocument() {
  const docRoot = document.getElementById('docRoot');
  const empty = document.getElementById('emptyState');

  if (!state.lots.length) {
    empty.style.display = 'flex';
    docRoot.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  const sections = buildSections(state.lots);
  const pages    = paginate(sections);

  const totalPages = pages.length;

  docRoot.innerHTML = pages.map((items, pageIdx) =>
    renderPage(items, pageIdx, totalPages)
  ).join('');

  wireUpInlineEditors();
  renderSectionNav(sections);
  applyZebraStriping();
}

/** Render a single landscape page. */
function renderPage(items, pageIdx, totalPages) {
  const isFirst = pageIdx === 0;
  const parts = [];

  parts.push(`<div class="doc-page" data-page="${pageIdx + 1}">`);
  if (isFirst) parts.push(renderSaleHeader());

  parts.push('<div class="page-content">');

  let inTable = false;
  let rowIdx  = 0;

  const closeTable = () => {
    if (inTable) { parts.push('</tbody></table>'); inTable = false; }
  };

  for (const item of items) {
    if (item.kind === 'section') {
      closeTable();
      parts.push(renderSectionBar(item.type, !!item.continuation));
      parts.push(renderTableOpen());
      inTable = true;
      rowIdx = 0;
    } else {
      // Safety net: shouldn't happen because paginate() always carries
      // a continuation bar, but handle it defensively anyway.
      if (!inTable) {
        parts.push(renderSectionBar(item.sectionType, true));
        parts.push(renderTableOpen());
        inTable = true;
        rowIdx = 0;
      }
      parts.push(renderLotRow(item.lot, rowIdx++));
    }
  }
  closeTable();

  parts.push('</div>'); // /page-content

  parts.push(renderFooter(pageIdx + 1, totalPages));
  parts.push('</div>'); // /doc-page
  return parts.join('');
}

/** Render the sale header (first page only).
 *  Uses a 3-column grid: blank spacer | center content | logo. */
function renderSaleHeader() {
  const h = state.header;
  const logoContent = state.logoDataUrl
    ? `<div class="sale-logo has-image"><img src="${esc(state.logoDataUrl)}" alt="Logo" /></div>`
    : `<div class="sale-logo"><b>CMS</b><div>LIVESTOCK<br/>AUCTION</div></div>`;

  return `
    <div class="sale-header">
      <div></div>
      <div class="sale-header-center">
        <div class="sale-title"    contenteditable="true" data-hk="title">${esc(h.title)}</div>
        <div class="sale-subtitle" contenteditable="true" data-hk="subtitle">${esc(h.subtitle)}</div>
        <div class="sale-meta">
          <span contenteditable="true" data-hk="website">${esc(h.website)}</span>
          <span contenteditable="true" data-hk="addr1">${esc(h.addr1)}</span>
          <span contenteditable="true" data-hk="addr2">${esc(h.addr2)}</span>
          <span contenteditable="true" data-hk="addr3">${esc(h.addr3)}</span>
          <span>Phone: <span contenteditable="true" data-hk="phone">${esc(h.phone)}</span></span>
          <span>Fax: <span contenteditable="true" data-hk="fax">${esc(h.fax)}</span></span>
        </div>
        <div class="sale-datetime" contenteditable="true" data-hk="datetime">${esc(h.datetime)}</div>
      </div>
      ${logoContent}
    </div>
  `;
}

/** Render the colored bar introducing a Type section. */
function renderSectionBar(type, continuation = false) {
  const color = state.colors[type] || FALLBACK_SECTION_COLOR;
  const label = continuation ? `${type} (cont.)` : type;
  return `
    <div class="section-bar" style="background:${color};"
         contenteditable="true" data-section-type="${esc(type)}">${esc(label)}</div>
  `;
}

/** Open the lot table with colgroup + thead. */
function renderTableOpen() {
  return `
    <table class="lot-table">
      <colgroup>
        <col class="c-lot"/><col class="c-seller"/><col class="c-head"/>
        <col class="c-desc"/><col class="c-sex"/><col class="c-wt"/>
        <col class="c-del"/><col class="c-loc"/><col class="c-shrink"/>
        <col class="c-slide"/><col class="c-notes"/><col class="c-price"/>
      </colgroup>
      <thead>
        <tr>
          <th>Lot</th><th>Seller</th><th>Head</th>
          <th>Description</th><th>Sex</th><th>Base Wt.</th>
          <th>Delivery</th><th>Location</th><th>Shrink</th>
          <th>Slide</th><th>Notes</th><th>Price</th>
        </tr>
      </thead>
      <tbody>
  `;
}

/** Render a single lot row. */
function renderLotRow(lot, rowIdx) {
  const id = `lot-${lot.referenceNum}-${lot.lotNumber}`;

  // Boundary / grouping class
  const posClass =
    lot.groupPos === 'standalone' ? 'opt-standalone' :
    lot.groupPos === 'end'        ? 'opt-group-end'  :
    lot.groupPos === 'mid' || lot.groupPos === 'start' ? 'opt-group-mid' : '';

  // Price styling
  const priceRaw = (lot.price || '').trim();
  const priceClass =
    /^po$/i.test(priceRaw)      ? 'price-po' :
    /^scratch$/i.test(priceRaw) ? 'price-scratch' :
    /\$?\d/.test(priceRaw)      ? 'price-numeric' : '';

  // Scratched rows strike through other columns
  const scratchedCls = /^scratch$/i.test(priceRaw) ? 'lot-scratched' : '';

  const altCls = rowIdx % 2 === 1 ? 'row-alt' : '';

  // Description cell: "X Load of <Breed>"
  const descLine = [
    lot.loadCount ? `<b>${esc(lot.loadCount)} Load${lot.loadCount === '1' ? '' : 's'}</b> of ` : '',
    esc(lot.breed),
  ].join('');

  // Notes
  const notesHtml = renderNotes(lot);

  // Video link
  const videoHtml = state.options.showVideo && lot.video
    ? ` <a class="video-icon" href="${esc(lot.video)}" target="_blank" rel="noopener" contenteditable="false">▶</a>`
    : '';

  return `
    <tr id="${esc(id)}" class="${altCls} ${posClass} ${scratchedCls}" data-lot-key="${esc(lot.lotNumber)}">
      <td class="cell-lot"   contenteditable="true" data-f="lotNumber">${esc(lot.lotNumber)}${videoHtml}</td>
      <td class="align-left" contenteditable="true" data-f="consignor">${esc(lot.consignor)}</td>
      <td                    contenteditable="true" data-f="headCount">${esc(lot.headCount)}</td>
      <td class="align-left" contenteditable="true" data-f="breed">${descLine}</td>
      <td                    contenteditable="true" data-f="sex">${esc(lot.sex)}</td>
      <td                    contenteditable="true" data-f="baseWeight">${esc(lot.baseWeight)}</td>
      <td                    contenteditable="true" data-f="delivery">${esc(lot.delivery)}</td>
      <td                    contenteditable="true" data-f="location">${esc(lot.location)}</td>
      <td                    contenteditable="true" data-f="shrink">${esc(lot.shrink)}</td>
      <td                    contenteditable="true" data-f="slide">${esc(lot.slide)}</td>
      <td class="align-left" data-f="notes-container">${notesHtml}</td>
      <td class="cell-price ${priceClass}" contenteditable="true" data-f="price">${esc(priceRaw)}</td>
    </tr>
  `;
}

/** Render the notes cell (primary + secondary + optional external/internal). */
function renderNotes(lot) {
  const parts = [];
  if (lot.description) {
    parts.push(`<div class="notes-primary" contenteditable="true" data-f="description">${esc(lot.description)}</div>`);
  }
  if (lot.secondDesc) {
    parts.push(`<div class="notes-secondary" contenteditable="true" data-f="secondDesc">${esc(lot.secondDesc)}</div>`);
  }
  if (state.options.showExternalNotes && lot.externalNotes) {
    parts.push(`<div class="notes-external" contenteditable="true" data-f="externalNotes">★ ${esc(lot.externalNotes)}</div>`);
  }
  if (state.options.showInternalNotes && lot.internalNotes) {
    parts.push(`<div class="notes-internal" contenteditable="true" data-f="internalNotes">⚑ ${esc(lot.internalNotes)}</div>`);
  }
  return parts.join('') || '<div class="muted">—</div>';
}

/** Page footer with sale tag + page number. */
function renderFooter(page, total) {
  const h = state.header;
  return `
    <div class="doc-footer">
      <div class="sale-tag">${esc(h.title)} — ${esc(h.datetime)}</div>
      <div>Page ${page} of ${total}</div>
    </div>
  `;
}

/** Apply zebra striping class toggle based on option. */
function applyZebraStriping() {
  document.querySelectorAll('.lot-table').forEach(t => {
    t.classList.toggle('zebra', state.options.zebra);
  });
}


/* ============================================================
 * 7. INLINE EDITING WIRE-UP
 * ============================================================ */

function wireUpInlineEditors() {
  const root = document.getElementById('docRoot');

  // Lot-row fields: save back to state.lots
  root.querySelectorAll('[data-f]').forEach(el => {
    el.addEventListener('blur', () => {
      const row = el.closest('tr[data-lot-key]');
      if (!row) return;
      const lotKey = row.dataset.lotKey;
      const lot = state.lots.find(l => l.lotNumber === lotKey);
      if (!lot) return;

      const f = el.dataset.f;
      if (f === 'notes-container') return;  // children handle themselves
      lot[f] = extractEditableText(el);

      // If price changed, re-style that cell.
      if (f === 'price') {
        restylePriceCell(el, lot.price);
        row.classList.toggle('lot-scratched', /^scratch$/i.test(lot.price));
      }
    });
  });

  // Header fields
  root.querySelectorAll('[data-hk]').forEach(el => {
    el.addEventListener('blur', () => {
      const k = el.dataset.hk;
      state.header[k] = extractEditableText(el);
      // Mirror to sidebar input
      const input = document.getElementById('h_' + k);
      if (input) input.value = state.header[k];
    });
  });
}

/** Get plain text from a contenteditable, preserving line breaks. */
function extractEditableText(el) {
  // Replace <br> with newlines, strip other HTML.
  const clone = el.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  // Keep the video icon out of the extracted text.
  clone.querySelectorAll('.video-icon').forEach(v => v.remove());
  return clone.textContent.replace(/\u00A0/g, ' ').trim();
}

function restylePriceCell(el, price) {
  el.classList.remove('price-po', 'price-scratch', 'price-numeric');
  const v = (price || '').trim();
  if (/^po$/i.test(v))           el.classList.add('price-po');
  else if (/^scratch$/i.test(v)) el.classList.add('price-scratch');
  else if (/\$?\d/.test(v))      el.classList.add('price-numeric');
}


/* ============================================================
 * 8. SIDEBAR CONTROLS
 * ============================================================ */

function initSidebar() {
  // Header inputs <-> state
  Object.keys(DEFAULT_HEADER).forEach(k => {
    const input = document.getElementById('h_' + k);
    if (!input) return;
    input.value = state.header[k];
    input.addEventListener('input', () => {
      state.header[k] = input.value;
      renderDocument();
    });
  });

  // Option toggles
  const bind = (id, optKey) => {
    const el = document.getElementById(id);
    el.checked = state.options[optKey];
    el.addEventListener('change', () => {
      state.options[optKey] = el.checked;
      renderDocument();
    });
  };
  bind('opt_video',          'showVideo');
  bind('opt_external_notes', 'showExternalNotes');
  bind('opt_internal_notes', 'showInternalNotes');
  bind('opt_zebra',          'zebra');

  // Logo upload
  const logoInput = document.getElementById('logoFile');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { state.logoDataUrl = reader.result; renderDocument(); };
      reader.readAsDataURL(f);
    });
  }
  const clearLogo = document.getElementById('clearLogoBtn');
  if (clearLogo) {
    clearLogo.addEventListener('click', () => {
      state.logoDataUrl = null;
      if (logoInput) logoInput.value = '';
      renderDocument();
    });
  }

  // Reset colors
  document.getElementById('resetColorsBtn').addEventListener('click', () => {
    state.colors = { ...DEFAULT_SECTION_COLORS };
    renderColorList();
    renderDocument();
  });

  // Reset edits
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!state.lastRawCsv) return;
    if (!confirm('Reset all edits and reparse the original CSV?')) return;
    loadCsvText(state.lastRawCsv);
  });

  // Regenerate
  document.getElementById('regenBtn').addEventListener('click', () => {
    renderDocument();
  });

  // Export buttons
  document.getElementById('exportPdfBtn').addEventListener('click', exportPdf);
  document.getElementById('exportHtmlBtn').addEventListener('click', exportHtml);
}

/** Render the per-Type color picker list based on the types present. */
function renderColorList() {
  const list = document.getElementById('colorList');
  const presentTypes = Array.from(new Set(state.lots.map(l => l.type)));

  // Ensure every present type has a color entry
  presentTypes.forEach(t => {
    if (!state.colors[t]) state.colors[t] = FALLBACK_SECTION_COLOR;
  });

  list.innerHTML = presentTypes.map(t => `
    <div class="color-row">
      <input type="color" value="${state.colors[t]}" data-type="${esc(t)}" />
      <span>${esc(t)}</span>
    </div>
  `).join('') || '<p class="muted">Upload a CSV to configure section colors.</p>';

  list.querySelectorAll('input[type=color]').forEach(inp => {
    inp.addEventListener('input', () => {
      state.colors[inp.dataset.type] = inp.value;
      renderDocument();
    });
  });
}

function renderSectionNav(sections) {
  const nav = document.getElementById('sectionNav');
  nav.innerHTML = sections.map((s, i) => `
    <a href="#section-${i}" data-i="${i}">${esc(s.type)} <span class="muted">(${s.lots.length})</span></a>
  `).join('');

  // Scroll to the page containing the first lot of that section
  nav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const i = parseInt(a.dataset.i, 10);
      const type = sections[i].type;
      const bar = [...document.querySelectorAll('.section-bar')]
        .find(b => b.dataset.sectionType === type);
      if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}


/* ============================================================
 * 9. CSV LOADING
 * ============================================================ */

function loadCsvText(csvText) {
  state.lastRawCsv = csvText;
  state.lots = parseCsv(csvText);
  renderColorList();
  renderDocument();

  // Enable action buttons
  ['regenBtn', 'resetBtn', 'exportPdfBtn', 'exportHtmlBtn'].forEach(id => {
    document.getElementById(id).disabled = false;
  });
}

function wireFileInputs() {
  const handler = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadCsvText(reader.result);
    reader.readAsText(file);
  };
  document.getElementById('csvFile').addEventListener('change', handler);
  document.getElementById('csvFile2').addEventListener('change', handler);
}


/* ============================================================
 * 10. EXPORTS
 * ============================================================ */

/**
 * Export to PDF via the browser's native print dialog.
 * The CSS @page rule forces landscape + zero margins and the
 * document already paginates itself into .doc-page elements.
 */
function exportPdf() {
  // One last render to be safe (captures any unsaved blur).
  renderDocument();
  window.print();
}

/**
 * Export the current edited document as a standalone HTML file.
 * We inline the stylesheet so the file is self-contained.
 */
async function exportHtml() {
  renderDocument();
  const docHtml = document.getElementById('docRoot').innerHTML;

  // Fetch current stylesheet text to inline it.
  let cssText = '';
  try {
    const res = await fetch('styles.css');
    cssText = await res.text();
  } catch {
    // Fallback: read rules from the live stylesheet
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) cssText += rule.cssText + '\n';
      } catch { /* cross-origin stylesheet, skip */ }
    }
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8" />
<title>${esc(state.header.title)} — ${esc(state.header.datetime)}</title>
<style>${cssText}
/* Lock the exported file to print-like presentation */
body { background: #fff; padding: 20px; }
.no-print, .empty-state { display: none !important; }
</style>
</head><body>
<div class="doc-root">${docHtml}</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CMS-Auction-${safeFileName(state.header.datetime)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(s) {
  return String(s).replace(/[^a-z0-9\-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'listing';
}


/* ============================================================
 * 11. BOOT
 * ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  wireFileInputs();
  renderDocument();  // shows empty state
});
