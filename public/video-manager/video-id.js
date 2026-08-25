/* =============================================================
 * CMS Video Manager — Video ID logic
 * -------------------------------------------------------------
 * Pure functions for the human-facing CMS Video ID format:
 *
 *   Consignor.Sex.SireType.DamType.Weight.MMYY[-suffix]
 *
 *   e.g.  21.2.2.2.450.0826         (base id)
 *         21.2.2.2.450.0826-2       (suffixed — genuinely separate video,
 *                                    same underlying cattle classification)
 *
 * No Firebase, no DOM. Everything here is testable in isolation and
 * safe to import from both the staff app and the rep upload portal.
 * ============================================================= */

const MMYY_RE = /^(0[1-9]|1[0-2])\d{2}$/;

/**
 * Split "21.2.2.2.450.0826-2" into its base id and numeric suffix.
 * Returns { baseId, suffix } — suffix is null when there isn't one.
 */
export function splitSuffix(finalId) {
  const raw = String(finalId || '').trim();
  const m = raw.match(/^(.*?)(?:-(\d+))?$/);
  const baseId = m ? m[1] : raw;
  const suffix = m && m[2] ? Number(m[2]) : null;
  return { baseId, suffix };
}

/** Join a base id + optional numeric suffix back into a final id. */
export function joinSuffix(baseId, suffix) {
  return suffix ? `${baseId}-${suffix}` : baseId;
}

/**
 * Parse a raw Video ID string (with or without suffix) into its
 * component fields. Does NOT check codes against reference data —
 * that's the caller's job (so unrecognized-code handling can live
 * at the UI layer, where it can offer "add this code" inline).
 *
 * Returns:
 *   {
 *     valid: boolean,
 *     error: string|null,          // structural error, e.g. malformed
 *     baseId, suffix, finalId,
 *     consignorCode, sexCode, sireCode, damCode, weight, monthYear,
 *   }
 */
export function parseVideoId(raw) {
  const { baseId, suffix } = splitSuffix(raw);
  const tokens = baseId.split('.');

  if (tokens.length !== 6 || tokens.some(t => t.trim() === '')) {
    return {
      valid: false,
      error: 'Expected format Consignor.Sex.Sire.Dam.Weight.MMYY',
      baseId, suffix, finalId: joinSuffix(baseId, suffix),
      consignorCode: null, sexCode: null, sireCode: null, damCode: null,
      weight: null, monthYear: null,
    };
  }

  const [consignorCode, sexCode, sireCode, damCode, weight, monthYear] = tokens.map(t => t.trim());

  const errors = [];
  if (!/^\d+$/.test(consignorCode)) errors.push('Consignor code must be numeric');
  if (!/^\d+$/.test(sexCode)) errors.push('Sex code must be numeric');
  if (!/^\d+$/.test(sireCode)) errors.push('Sire code must be numeric');
  if (!/^\d+$/.test(damCode)) errors.push('Dam code must be numeric');
  if (!/^\d+$/.test(weight)) errors.push('Weight must be numeric');
  if (!MMYY_RE.test(monthYear)) errors.push('Month/Year must be MMYY, e.g. 0826');

  if (errors.length) {
    return {
      valid: false,
      error: errors.join('; '),
      baseId, suffix, finalId: joinSuffix(baseId, suffix),
      consignorCode, sexCode, sireCode, damCode, weight, monthYear,
    };
  }

  return {
    valid: true,
    error: null,
    baseId, suffix, finalId: joinSuffix(baseId, suffix),
    consignorCode, sexCode, sireCode, damCode, weight, monthYear,
  };
}

/** Build a base Video ID (no suffix) from discrete fields. */
export function buildBaseId({ consignorCode, sexCode, sireCode, damCode, weight, monthYear }) {
  const weightToken = Number(weight) === 0 ? '000' : weight;
  return [consignorCode, sexCode, sireCode, damCode, weightToken, monthYear].join('.');
}

/**
 * Given a base id and the set of currently-active final ids, find the
 * next unused suffix (2, 3, 4, ...). The unsuffixed base id itself is
 * implicitly "taken" if it's in the set — callers use this only when
 * the base id already collided.
 */
export function nextAvailableSuffix(baseId, existingFinalIds) {
  const taken = existingFinalIds instanceof Set ? existingFinalIds : new Set(existingFinalIds);
  let n = 2;
  while (taken.has(`${baseId}-${n}`)) n++;
  return n;
}

/** Format MMYY -> "Aug 2026" for display. */
export function formatMonthYear(mmyy) {
  if (!mmyy || mmyy.length !== 4) return mmyy || '—';
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mm = Number(mmyy.slice(0, 2));
  const yy = mmyy.slice(2);
  const label = months[mm] || mmyy.slice(0, 2);
  return `${label} 20${yy}`;
}

/** "0826" -> "2026-08" for an <input type="month"> control. */
export function monthYearToInputValue(mmyy) {
  if (!mmyy || mmyy.length !== 4) return '';
  return `20${mmyy.slice(2)}-${mmyy.slice(0, 2)}`;
}

/** "2026-08" (from <input type="month">) -> "0826". */
export function inputValueToMonthYear(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  return `${m[2]}${m[1].slice(2)}`;
}

/** Generate a short immutable internal record id, e.g. "vid_8k7x29a1". */
export function generateInternalId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `vid_${s}`;
}
