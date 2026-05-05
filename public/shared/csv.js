/* =============================================================
 * CMS Auction Suite — Shared CSV utilities
 * -------------------------------------------------------------
 * IMPORTANT: This module is for FUTURE use. The three existing
 * apps (Listings, Banners, Post-Auction) currently keep their
 * own CSV parsers because rewriting working code carries risk
 * with no user-visible benefit.
 *
 * If you add a new feature that touches CSVs, prefer this module
 * over rolling your own. If you ever need to rename a column
 * across all apps, update COLUMN_NAMES here AND in the three
 * apps' inline configs (a TODO worth doing during the next
 * planned change).
 *
 * Currently duplicated in:
 *   listings/app.js        (~lines 1-50, hand-rolled)
 *   banners/index.html     (~lines 1040-1144, PapaParse-based)
 *   post-auction/app.js    (CONFIG.COLS at top, PapaParse-based)
 * ============================================================= */

/**
 * Canonical column names used across the suite.
 * Source of truth for any new code that reads auction CSVs.
 *
 * Column names are matched case-insensitively in the three
 * existing apps. New code should preserve that behavior.
 */
export const COLUMN_NAMES = {
  // Identification
  lotNumber:    "Lot Number",
  consignor:    "Consignor",
  seller:       "Seller",          // some files use Seller instead of Consignor
  buyer:        "Buyer",
  buyerNum:     "Buyer #",
  rep:          "Representative",
  repAlt:       "Rep",             // alternate name some files use

  // Quantity + cattle
  head:         "Head",
  description:  "Description",
  sex:          "Sex",
  baseWeight:   "Base Weight",
  baseWt:       "Base Wt",         // alternate

  // Logistics
  delivery:     "Delivery",
  location:     "Location",
  shrink:       "Shrink",
  slide:        "Slide",
  programs:     "Programs",        // alternate for Notes
  notes:        "Notes",

  // Money
  price:        "Price",
  highBid:      "Calculated High Bid",
  feederFutures:"Feeder Futures Price",
  basisVsFeeder:"Basis vs Feeder (¢/lb)",

  // Type / category (for grouping)
  type:         "Type",            // Black X Beef on Dairy / Charolais / Native / Holstein

  // Contract identifiers (post-auction)
  contract:     "Contract",
  contractNum:  "Contract #",
};

/**
 * Find a column key in a row, matching case-insensitively.
 * Returns the actual key as it appears in the CSV, or null.
 *
 * @param {object} row    one parsed CSV row
 * @param {string} target column name (e.g. "Lot Number")
 * @returns {string|null}
 */
export function findKey(row, target) {
  if (!row) return null;
  const wanted = String(target).toLowerCase().trim();
  for (const k of Object.keys(row)) {
    if (String(k).toLowerCase().trim() === wanted) return k;
  }
  return null;
}

/**
 * Get a value from a row by canonical column name. Tries the
 * primary key first, then falls back to alternates.
 *
 * @param {object}   row        one parsed CSV row
 * @param {string[]} candidates list of column names to try, in order
 * @returns {string} value or empty string
 */
export function getCol(row, candidates) {
  for (const name of candidates) {
    const key = findKey(row, name);
    if (key !== null) {
      const v = row[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        return String(v).trim();
      }
    }
  }
  return "";
}

/**
 * Parse a lot number into base + suffix.
 *   "401A"  → { base: 401, suffix: "A", raw: "401A" }
 *   "401"   → { base: 401, suffix: "",  raw: "401"  }
 *   "abc"   → { base: NaN, suffix: "",  raw: "abc"  }
 *
 * Currently duplicated in all three apps. Use this for new code.
 */
export function parseLotNumber(raw) {
  const s = String(raw == null ? "" : raw).trim();
  const m = s.match(/^(\d+)\s*([A-Za-z]*)\s*$/);
  if (!m) return { base: NaN, suffix: "", raw: s };
  return {
    base:   parseInt(m[1], 10),
    suffix: (m[2] || "").toUpperCase(),
    raw:    s,
  };
}

/**
 * Sort rows by lot number, with option-lot suffixes (A,B,C…)
 * grouped under their numeric base.
 */
export function sortByLot(rows, lotKey = COLUMN_NAMES.lotNumber) {
  return [...rows].sort((a, b) => {
    const la = parseLotNumber(a[lotKey]);
    const lb = parseLotNumber(b[lotKey]);
    if (la.base !== lb.base) return (la.base || 0) - (lb.base || 0);
    return la.suffix.localeCompare(lb.suffix);
  });
}

/**
 * Group consecutive option-lot rows together.
 *   [401A, 401B, 402, 403A, 403B] →
 *     [[401A, 401B], [402], [403A, 403B]]
 *
 * Useful for the listing layout where 401A/401B share a section.
 */
export function groupOptionLots(rows, lotKey = COLUMN_NAMES.lotNumber) {
  const groups = [];
  let current = [];
  let currentBase = null;
  for (const row of rows) {
    const lot = parseLotNumber(row[lotKey]);
    if (lot.base !== currentBase) {
      if (current.length) groups.push(current);
      current = [row];
      currentBase = lot.base;
    } else {
      current.push(row);
    }
  }
  if (current.length) groups.push(current);
  return groups;
}
