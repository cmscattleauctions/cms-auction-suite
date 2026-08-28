/* =============================================================
 * Beta OBS Builder — Verification tag detection
 * -------------------------------------------------------------
 * Pure functions. No DOM, no Firebase. Parses the free-text
 * Description field (the source of truth — no structured ASV/NHTC/etc
 * fields are added to the data model) against a user-configured list
 * of verification tags loaded from Firestore.
 *
 * Two passes:
 *   1. Exact/alias match  — case-insensitive, punctuation-resilient,
 *      only against terms the user has explicitly configured. Applied
 *      automatically.
 *   2. Fuzzy suggestion    — near-misses that are NOT an approved alias
 *      are flagged for manual review, never auto-applied. Uses a small
 *      edit-distance check with a length-scaled threshold to keep
 *      suggestions rare and relevant (spec explicitly warns against
 *      flooding the operator with irrelevant fuzzy hits).
 *
 * Tag shape expected (see beta-tags-data.js):
 *   { id, name, enabled, detectionTerms: string[], sortOrder, ... }
 * ============================================================= */

/** Lowercase, collapse whitespace, and strip periods commonly used in acronyms (N.H.T.C. -> nhtc). */
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a description into candidate discrete tokens/phrases for fuzzy comparison. */
function splitCandidateTokens(description) {
  return String(description || '')
    .split(/[,;\n|/]|(?:\s+-\s+)|(?:\band\b)/i)
    .map(s => s.trim())
    .filter(Boolean);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word/phrase containment check on normalized text (avoids "ASVxyz" false positives). */
function containsTerm(normalizedText, normalizedTerm) {
  if (!normalizedTerm) return false;
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(normalizedTerm)}(?:$|[^a-z0-9])`, 'i');
  return re.test(` ${normalizedText} `);
}

/**
 * Exact/alias detection for one lot's Description text.
 * Returns [{ tagId, tagName, matchedTerm }], one entry per tag that hit
 * (a tag matches at most once per lot even if multiple aliases hit).
 */
export function detectExactTags(description, tags) {
  const normalizedDesc = normalize(description);
  if (!normalizedDesc) return [];
  const hits = [];
  for (const tag of tags) {
    if (!tag.enabled) continue;
    const terms = Array.isArray(tag.detectionTerms) ? tag.detectionTerms : [];
    const matchedTerm = terms.find(t => containsTerm(normalizedDesc, normalize(t)));
    if (matchedTerm) hits.push({ tagId: tag.id, tagName: tag.name, matchedTerm });
  }
  return hits;
}

/* =============================================================
 * Fuzzy suggestion (review-only, never auto-applied)
 * ============================================================= */

/**
 * Damerau-Levenshtein (optimal string alignment) edit distance — like
 * plain Levenshtein but also counts an adjacent transposition as a
 * single edit. That matters here: the spec's own worked example
 * ("NHCT" typo'd from "NHTC") is exactly an adjacent transposition,
 * which plain Levenshtein scores as distance 2 (two substitutions),
 * pushing it past a length-4 term's threshold and silently dropping a
 * suggestion the spec explicitly expects to surface.
 */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,        // deletion
        dp[i][j - 1] + 1,        // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost); // adjacent transposition
      }
    }
  }
  return dp[m][n];
}

/** Maximum edit distance we'll consider "close enough to flag", scaled by term length. */
function maxDistanceFor(len) {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

/** A token is even worth fuzzy-checking only if it looks tag-shaped (short, letters/digits/&). */
function looksTagShaped(token) {
  const t = token.trim();
  if (t.length < 2 || t.length > 24) return false;
  return /^[a-z0-9 &'.-]+$/i.test(t);
}

/**
 * Fuzzy-suggest possible tag matches for one lot's Description that are
 * NOT already exact-matched by `alreadyMatchedTagIds`. Returns:
 *   [{ foundText, suggestedTagId, suggestedTagName, distance }]
 * Deliberately conservative: exact matches (distance 0) are excluded —
 * those already came out of detectExactTags. Distance must be > 0 and
 * within maxDistanceFor(termLength) to be surfaced.
 */
export function detectFuzzyTagSuggestions(description, tags, alreadyMatchedTagIds = []) {
  const candidates = splitCandidateTokens(description).filter(looksTagShaped);
  if (!candidates.length) return [];

  const already = new Set(alreadyMatchedTagIds);
  const suggestions = [];
  const seenTextPerLot = new Set();

  for (const rawToken of candidates) {
    const normToken = normalize(rawToken);
    if (!normToken) continue;

    let best = null; // { tag, term, distance }
    for (const tag of tags) {
      if (!tag.enabled || already.has(tag.id)) continue;
      const terms = Array.isArray(tag.detectionTerms) ? tag.detectionTerms : [tag.name];
      for (const term of terms.length ? terms : [tag.name]) {
        const normTerm = normalize(term);
        if (!normTerm || normToken === normTerm) continue; // exact would've matched already
        const dist = editDistance(normToken, normTerm);
        if (dist === 0) continue;
        if (dist > maxDistanceFor(normTerm.length)) continue;
        if (!best || dist < best.distance) best = { tag, term, distance: dist };
      }
    }

    if (best) {
      const key = `${normToken}→${best.tag.id}`;
      if (seenTextPerLot.has(key)) continue;
      seenTextPerLot.add(key);
      suggestions.push({
        foundText: rawToken.trim(),
        suggestedTagId: best.tag.id,
        suggestedTagName: best.tag.name,
        distance: best.distance,
      });
    }
  }
  return suggestions;
}

/**
 * Run both passes for one lot. `resolutions` is an optional map of
 * `foundText.toLowerCase() -> 'use'|'ignore'` for fuzzy hits the operator
 * already resolved this build (Use This Time / Don't Use), so re-running
 * detection after a review decision doesn't re-prompt the same lot.
 */
export function detectTagsForLot(description, tags, resolutions = {}) {
  const exact = detectExactTags(description, tags);
  const exactIds = exact.map(h => h.tagId);
  let fuzzy = detectFuzzyTagSuggestions(description, tags, exactIds);

  const appliedFromFuzzy = [];
  const stillPending = [];
  for (const s of fuzzy) {
    const decision = resolutions[s.foundText.toLowerCase()];
    if (decision === 'use') {
      appliedFromFuzzy.push({ tagId: s.suggestedTagId, tagName: s.suggestedTagName, matchedTerm: s.foundText, fromFuzzy: true });
    } else if (decision === 'ignore') {
      // dropped — operator said don't use
    } else {
      stillPending.push(s);
    }
  }

  // A tag can be added at most once per lot even if both exact + fuzzy hit it.
  const finalTagIds = new Set(exactIds);
  const applied = [...exact];
  for (const a of appliedFromFuzzy) {
    if (finalTagIds.has(a.tagId)) continue;
    finalTagIds.add(a.tagId);
    applied.push(a);
  }

  return { applied, pendingFuzzy: stillPending };
}
