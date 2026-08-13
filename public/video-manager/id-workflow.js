/* =============================================================
 * CMS Video Manager — Shared Video ID resolution workflow
 * -------------------------------------------------------------
 * Used by the table (fast inline entry), the full upload screen,
 * and the rep upload portal. Pure validation/lookup — callers
 * decide how to present the result (inline banner vs. modal).
 * ============================================================= */

import { parseVideoId, buildBaseId } from './video-id.js';

/**
 * @returns one of:
 *   { ok:false, reason:'invalid', error }
 *   { ok:false, reason:'unrecognized', missing:[{kind,code}], parsed }
 *   { ok:false, reason:'collision', existing, baseId, parsed }
 *   { ok:true, fields, baseId }
 */
export async function resolveVideoIdEntry(rawId, ctx) {
  const parsed = parseVideoId(rawId);
  if (!parsed.valid) {
    return { ok: false, reason: 'invalid', error: parsed.error };
  }

  const missing = [];
  if (!ctx.ref.findConsignor(parsed.consignorCode)) missing.push({ kind: 'consignor', code: parsed.consignorCode });
  if (!ctx.ref.sexLabel(parsed.sexCode)) missing.push({ kind: 'sex', code: parsed.sexCode });
  if (!ctx.ref.sireLabel(parsed.sireCode)) missing.push({ kind: 'sire', code: parsed.sireCode });
  if (!ctx.ref.damLabel(parsed.damCode)) missing.push({ kind: 'dam', code: parsed.damCode });
  if (missing.length) {
    return { ok: false, reason: 'unrecognized', missing, parsed };
  }

  const baseId = buildBaseId(parsed);
  const finalId = parsed.suffix ? `${baseId}-${parsed.suffix}` : baseId;
  const existing = await ctx.repo.findByFinalId(finalId);
  if (existing) {
    return { ok: false, reason: 'collision', existing, baseId, parsed };
  }

  return {
    ok: true,
    baseId,
    fields: {
      consignorCode: parsed.consignorCode,
      sexCode: parsed.sexCode,
      sireCode: parsed.sireCode,
      damCode: parsed.damCode,
      weight: parsed.weight,
      monthYear: parsed.monthYear,
      suffix: parsed.suffix,
    },
  };
}

export const CODE_KIND_LABELS = {
  consignor: 'Consignor', sex: 'Sex', sire: 'Sire Type', dam: 'Dam Type',
};

// Shorter form used in "X code 11 is not recognized" messages, where
// "Sire Type code 11" reads clunkier than "Sire code 11".
export const CODE_KIND_SHORT_LABELS = {
  consignor: 'Consignor', sex: 'Sex', sire: 'Sire', dam: 'Dam',
};
