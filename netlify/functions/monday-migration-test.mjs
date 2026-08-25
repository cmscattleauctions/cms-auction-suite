/* =============================================================
 * Monday.com → Video Manager migration test (READ-ONLY)
 * -------------------------------------------------------------
 * This is Phase 1-4 of a migration feasibility check, NOT the
 * migration itself. Every action here only ever sends a GraphQL
 * `query`, never a `mutation` (see monday-client.mjs, which
 * refuses to send a mutation even if one were constructed by
 * mistake). Nothing is written to Firebase or Monday. The one
 * "write" anywhere in this file is a single temp file used to
 * prove file download works (Phase 3) — it's written to /tmp and
 * deleted again before the response is sent; nothing persists.
 *
 * GET /api/monday-migration?action=<action>&...params
 *
 * Actions (see the `actions` map at the bottom for the full list
 * and their query params):
 *   whoami            Phase 1.2 — confirm the token authenticates
 *   boards            Phase 1.3-1.4 — list boards, guess which is Video Manager
 *   board-schema      Phase 1.5 / 2 — groups + columns for one board
 *   sample-items      Phase 2 — ~15 items with raw + text column values
 *   asset-test        Phase 3 — file/asset metadata + one real download test
 *   pagination-probe  Phase 4 — items_page/cursor behavior + item count
 *   dry-run-preview   Phase 5-7 — real mapping, confirmed against the actual board (see COLUMN_MAP below)
 *   export-records    Migration — one page of fully-resolved items for the real
 *                      import UI to consume (public/monday-migration-test.html).
 *                      Same field-resolution logic as dry-run-preview, paginated
 *                      via `cursor`, but does NOT assign duplicate suffixes —
 *                      that happens client-side once every page is combined.
 *
 * Auth: reads MONDAY_API_TOKEN from the environment (never hardcoded,
 * never logged — see netlify/functions/lib/monday-client.mjs and
 * netlify/functions/README.md). This function is server-side only;
 * nothing under public/ talks to Monday directly.
 * ============================================================= */

import { writeFile, unlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mondayQuery, jsonResponse, errorResponse, tokenFingerprint } from './lib/monday-client.mjs';
import { parseVideoId } from '../../public/video-manager/video-id.js';

/* =============================================================
 * Phase 5-7 config — confirmed against the real "Video Uploads"
 * board (id 5462086473) via board-schema on 2026-08-25. These are
 * real column ids, not guesses — re-verify with board-schema if
 * this ever points at a different board or the columns change.
 *
 * Notably NOT present as their own columns on the real board (see
 * docs/MONDAY-MIGRATION.md for the full writeup):
 *   - Video ID       — IS the item's `name`, not a column. Parsed
 *                       with the same parseVideoId() the rest of
 *                       the app uses, which also recovers weight
 *                       and video month from the id itself.
 *   - Status         — is the item's `group`, not a column. See
 *                       GROUP_STATUS_MAP below.
 *   - Base Weight / Video Month — embedded in the Video ID, see above.
 *   - Canva Link     — does not exist on this board (expected —
 *                       matches "none of the Monday videos will
 *                       have Canva links yet").
 * ============================================================= */
const COLUMN_MAP = {
  videoMaker: 'short_text',
  clips: 'upload_file8',
  consignor: 'single_select2',       // status column — resolve via labels, not .text (see resolveStatusValue)
  otherConsignor: 'short_text2',     // free-text fallback when Consignor isn't in the dropdown
  sex: 'single_select5',             // status column
  sireBreed: 'single_select3',       // status column ("Bull Breed")
  damBreed: 'single_select6',        // status column ("Cow Breed")
  previewLink: 'text_mm2kc6g8',      // YouTube watch link
  embedLink: 'text_mm2k7srm',        // YouTube embed link
};

const GROUP_STATUS_MAP = {
  topics: 'ready',            // "New requests"
  new_group42522: 'hold',     // "On Hold"
  new_group22247: 'created',  // "Created"
};

/** Monday "status"/dropdown columns often return a null `.text` for values
 * that were bulk-set rather than clicked through the UI — the real value
 * only comes through as `{"index": N}` in `.value`, resolved against that
 * column's own label list (from board-schema's `settings_str`). Confirmed
 * against real data: some rows had proper .text, most didn't. */
function parseStatusLabels(settingsStr) {
  try {
    return JSON.parse(settingsStr).labels || {};
  } catch {
    return {};
  }
}
function resolveStatusValue(cv, labelsByIndex) {
  if (!cv) return null;
  if (cv.text) return cv.text;
  try {
    const v = JSON.parse(cv.value);
    if (v && v.index != null) return labelsByIndex[String(v.index)] || null;
  } catch { /* not a status-shaped value */ }
  return null;
}

/* =============================================================
 * Phase 1.2 — whoami
 * ============================================================= */
async function actionWhoami() {
  const data = await mondayQuery(`
    query {
      complexity { query before after reset_in_x_seconds }
      me { id name email is_admin is_guest }
      account { id name slug plan { max_users tier } }
    }
  `);
  return jsonResponse({
    ok: true,
    tokenFingerprint: tokenFingerprint(),
    me: data.me,
    account: data.account,
    complexity: data.complexity,
  });
}

/* =============================================================
 * Phase 1.3-1.4 — list boards, guess the Video Manager one
 * ============================================================= */
async function actionBoards() {
  const data = await mondayQuery(`
    query {
      complexity { query before after reset_in_x_seconds }
      boards (limit: 100, order_by: used_at) {
        id
        name
        items_count
        state
        board_kind
      }
    }
  `);
  const boards = data.boards || [];
  const candidates = boards.filter(b => /video/i.test(b.name));
  return jsonResponse({
    ok: true,
    totalBoards: boards.length,
    boards,
    likelyVideoManagerBoards: candidates,
    note: candidates.length
      ? `${candidates.length} board(s) matched "video" in the name — check items_count and run board-schema on the one that looks right.`
      : 'No board name contained "video" — scan the full `boards` list above manually.',
    complexity: data.complexity,
  });
}

/* =============================================================
 * Phase 1.5 / 2 — one board's groups + columns
 * ============================================================= */
async function actionBoardSchema(params) {
  const boardId = requireParam(params, 'boardId');
  const data = await mondayQuery(
    `
    query ($boardIds: [ID!]) {
      complexity { query before after reset_in_x_seconds }
      boards (ids: $boardIds) {
        id
        name
        items_count
        state
        board_kind
        groups { id title }
        columns { id title type settings_str }
      }
    }
  `,
    { boardIds: [boardId] }
  );
  const board = (data.boards || [])[0] || null;
  return jsonResponse({
    ok: true,
    board,
    columnCount: board ? board.columns.length : 0,
    groupCount: board ? board.groups.length : 0,
    complexity: data.complexity,
  });
}

/* =============================================================
 * Phase 2 — sample items across groups, full raw + text values
 * ============================================================= */
async function actionSampleItems(params) {
  const boardId = requireParam(params, 'boardId');
  const limit = clampInt(params.get('limit'), 15, 1, 25);
  const data = await mondayQuery(
    `
    query ($boardIds: [ID!], $limit: Int!) {
      complexity { query before after reset_in_x_seconds }
      boards (ids: $boardIds) {
        items_page (limit: $limit) {
          cursor
          items {
            id
            name
            state
            group { id title }
            column_values {
              id
              text
              value
              type
            }
            assets {
              id
              name
              file_extension
              file_size
              created_at
            }
          }
        }
      }
    }
  `,
    { boardIds: [boardId], limit }
  );
  const page = (data.boards || [])[0]?.items_page || { items: [], cursor: null };
  const groupCounts = {};
  page.items.forEach(it => {
    const g = it.group ? it.group.title : '(no group)';
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  });
  return jsonResponse({
    ok: true,
    requested: limit,
    returned: page.items.length,
    hasMore: !!page.cursor,
    groupBreakdown: groupCounts,
    itemsWithAssets: page.items.filter(it => (it.assets || []).length > 0).length,
    items: page.items,
    complexity: data.complexity,
  });
}

/* =============================================================
 * Phase 3 — asset metadata + one real, small, test download
 * ============================================================= */
async function actionAssetTest(params) {
  const boardId = requireParam(params, 'boardId');
  const scan = clampInt(params.get('itemScan'), 25, 1, 50);

  // Find a handful of items that actually have files attached.
  const itemsData = await mondayQuery(
    `
    query ($boardIds: [ID!], $limit: Int!) {
      boards (ids: $boardIds) {
        items_page (limit: $limit) {
          items {
            id
            name
            assets { id }
          }
        }
      }
    }
  `,
    { boardIds: [boardId], limit: scan }
  );
  const items = (itemsData.boards || [])[0]?.items_page?.items || [];
  const itemsWithAssets = items.filter(it => (it.assets || []).length > 0);

  if (!itemsWithAssets.length) {
    return jsonResponse({
      ok: true,
      scanned: items.length,
      itemsWithAssets: 0,
      note: `Scanned ${items.length} items and none had attached files/assets. Try a larger --itemScan, or this board may store clips differently than expected (check a "Files"-type column in board-schema).`,
    });
  }

  const allAssetIds = itemsWithAssets.flatMap(it => it.assets.map(a => a.id));

  // Full metadata for every asset found, so we can pick the smallest
  // ("small/representative") for the actual download test.
  const assetData = await mondayQuery(
    `
    query ($assetIds: [ID!]!) {
      assets (ids: $assetIds) {
        id
        name
        file_extension
        file_size
        public_url
        created_at
        uploaded_by { id name }
      }
    }
  `,
    { assetIds: allAssetIds }
  );
  const assets = assetData.assets || [];
  const withSize = assets.filter(a => typeof a.file_size === 'number' && a.file_size > 0);
  const candidate = (withSize.length ? withSize : assets).slice().sort((a, b) => (a.file_size || 0) - (b.file_size || 0))[0];

  let downloadTest = { attempted: false };
  if (candidate && candidate.public_url) {
    downloadTest = await tryDownload(candidate);
  } else if (candidate) {
    downloadTest = { attempted: false, reason: 'This asset had no public_url in the API response.' };
  }

  return jsonResponse({
    ok: true,
    scannedItems: items.length,
    itemsWithAssets: itemsWithAssets.length,
    totalAssetsFound: assets.length,
    assets,
    downloadTest,
  });
}

async function tryDownload(asset) {
  // Monday's asset `name` is already the full filename (extension included).
  const label = asset.name || `asset-${asset.id}`;
  const CAP_BYTES = 20 * 1024 * 1024; // don't pull down anything huge for a feasibility test
  const tmpPath = join(tmpdir(), `monday-test-${randomUUID()}`);

  try {
    const res = await fetch(asset.public_url);
    if (!res.ok || !res.body) {
      return { attempted: true, ok: false, file: label, httpStatus: res.status, note: 'public_url did not resolve directly — Monday may require an auth header for this asset, or the signed URL expired.' };
    }

    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    let truncated = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > CAP_BYTES) { truncated = true; break; }
      chunks.push(value);
    }
    reader.cancel?.();
    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
    await writeFile(tmpPath, buf);
    const st = await stat(tmpPath);
    await unlink(tmpPath); // never persisted past this test

    return {
      attempted: true,
      ok: true,
      file: label,
      reportedFileSize: asset.file_size ?? null,
      bytesDownloaded: st.size,
      truncatedForTest: truncated,
      contentType: res.headers.get('content-type'),
      note: 'Downloaded to a temp file, verified, then deleted immediately. Nothing was written to Firebase Storage or kept on disk.',
    };
  } catch (err) {
    // Best-effort cleanup if something failed mid-write.
    try { await unlink(tmpPath); } catch { /* wasn't created */ }
    return { attempted: true, ok: false, file: label, error: err.message };
  }
}

/* =============================================================
 * Phase 4 — pagination / scale probe (walks a few pages, doesn't
 * scan the whole board)
 * ============================================================= */
async function actionPaginationProbe(params) {
  const boardId = requireParam(params, 'boardId');
  const pageSize = clampInt(params.get('pageSize'), 100, 10, 500);
  const maxPages = clampInt(params.get('maxPages'), 3, 1, 10);

  const countData = await mondayQuery(
    `query ($boardIds: [ID!]) { boards (ids: $boardIds) { items_count } }`,
    { boardIds: [boardId] }
  );
  const totalItems = (countData.boards || [])[0]?.items_count ?? null;

  const pages = [];
  let cursor = null;
  let complexityLast = null;
  for (let i = 0; i < maxPages; i++) {
    const query = cursor
      ? `query ($cursor: String!, $limit: Int!) {
           complexity { query before after reset_in_x_seconds }
           next_items_page (cursor: $cursor, limit: $limit) { cursor items { id } }
         }`
      : `query ($boardIds: [ID!], $limit: Int!) {
           complexity { query before after reset_in_x_seconds }
           boards (ids: $boardIds) { items_page (limit: $limit) { cursor items { id } } }
         }`;
    const variables = cursor ? { cursor, limit: pageSize } : { boardIds: [boardId], limit: pageSize };
    const data = await mondayQuery(query, variables);
    complexityLast = data.complexity;
    const page = cursor ? data.next_items_page : (data.boards || [])[0]?.items_page;
    if (!page) break;
    pages.push({ pageNumber: i + 1, itemsReturned: page.items.length, hadCursor: !!page.cursor });
    cursor = page.cursor;
    if (!cursor) break;
  }

  const estimatedTotalPages = totalItems ? Math.ceil(totalItems / pageSize) : null;

  return jsonResponse({
    ok: true,
    totalItemsOnBoard: totalItems,
    pageSizeUsed: pageSize,
    pagesWalkedInThisProbe: pages.length,
    pages,
    reachedEndOfBoard: pages.length > 0 && !pages[pages.length - 1].hadCursor,
    estimatedTotalPagesForFullBoard: estimatedTotalPages,
    estimatedRequestsForFullItemScan: estimatedTotalPages,
    note: 'This only walked a few pages to prove cursor pagination works — it did not scan the whole board. A full migration would need ~1 request per page above, plus 1 more `assets` query per batch of items that have files (see asset-test), so budget roughly 2x estimatedTotalPagesForFullBoard requests for a complete pull.',
    lastComplexity: complexityLast,
  });
}

/**
 * Some Monday item names are the clean Video ID; others have extra
 * human-written notes tacked on (pen numbers, a stray group letter) that
 * break strict parsing. Recovers the underlying id in the two patterns
 * actually observed on the real board, and returns whatever's left over
 * as a note — never silently drops information, and never guesses past
 * these two specific, confirmed patterns (anything else stays flagged
 * for manual review rather than being force-fit).
 *
 *  1. "6.1.2.3.000.1223 (3-1,2,3)"   -> id + trailing free text
 *  2. "56.2.0.0.750.G.0126"          -> id with one stray dot-segment
 */
function extractVideoIdAndNotes(rawName) {
  const trimmed = String(rawName || '').trim();
  const exact = parseVideoId(trimmed);
  if (exact.valid) {
    return { baseId: exact.baseId, notes: null, strategy: 'exact' };
  }

  // Pattern 1: a valid id followed by whitespace + anything else.
  const wsIdx = trimmed.search(/\s/);
  if (wsIdx > 0) {
    const lead = parseVideoId(trimmed.slice(0, wsIdx));
    if (lead.valid) {
      const extra = trimmed.slice(wsIdx).trim();
      return {
        baseId: lead.baseId,
        notes: `Imported from Monday — original item name was "${trimmed}".`,
        strategy: 'trailing-text',
        extra,
      };
    }
  }

  // Pattern 2: exactly one extra dot-segment inserted somewhere.
  const segs = trimmed.split('.');
  if (segs.length === 7) {
    for (let i = 0; i < segs.length; i++) {
      const candidate = segs.slice(0, i).concat(segs.slice(i + 1)).join('.');
      const p = parseVideoId(candidate);
      if (p.valid) {
        return {
          baseId: p.baseId,
          notes: `Imported from Monday — original item name was "${trimmed}".`,
          strategy: 'extra-segment',
          extra: segs[i],
        };
      }
    }
  }

  return { baseId: null, notes: null, strategy: 'unresolved', error: exact.error };
}

/* =============================================================
 * Phase 5-7 — dry-run preview against the real, confirmed mapping.
 * Still entirely read-only: nothing is written to Firebase or
 * Monday. Video ID comes from the item name (not a column) via
 * extractVideoIdAndNotes() above; Status comes from the item's group.
 *
 * Duplicate Video IDs (including new ones created by stripping notes
 * off two records that turn out to share a base id) get a suffix
 * auto-assigned by Monday creation date — earliest keeps the bare id,
 * each later one gets -2, -3, etc., matching the app's existing
 * suffix convention (see repository.js's nextAvailableSuffix usage).
 * ============================================================= */
async function actionDryRunPreview(params) {
  const boardId = requireParam(params, 'boardId');
  const scan = clampInt(params.get('itemScan'), 100, 1, 500);
  const neededColumnIds = Object.values(COLUMN_MAP);

  const data = await mondayQuery(
    `
    query ($boardIds: [ID!], $limit: Int!, $columnIds: [String!]) {
      boards (ids: $boardIds) {
        columns { id settings_str }
        items_page (limit: $limit) {
          cursor
          items {
            id
            name
            created_at
            group { id title }
            column_values (ids: $columnIds) { id text value }
            assets { id }
          }
        }
      }
    }
  `,
    { boardIds: [boardId], limit: scan, columnIds: neededColumnIds }
  );
  const board = (data.boards || [])[0];
  const page = board?.items_page || { items: [] };
  const items = page.items;

  const labelsByColumn = {};
  (board?.columns || []).forEach(c => { labelsByColumn[c.id] = parseStatusLabels(c.settings_str); });

  const rows = items.map(item => {
    const cvById = {};
    item.column_values.forEach(cv => { cvById[cv.id] = cv; });
    const getText = key => cvById[COLUMN_MAP[key]]?.text || null;
    const getStatus = key => resolveStatusValue(cvById[COLUMN_MAP[key]], labelsByColumn[COLUMN_MAP[key]] || {});

    const resolution = extractVideoIdAndNotes(item.name);
    const parsedBase = resolution.baseId ? parseVideoId(resolution.baseId) : null;
    const clipCount = (item.assets || []).length;

    return {
      mondayItemId: item.id,
      mondayItemName: item.name,
      mondayCreatedAt: item.created_at,
      group: item.group ? item.group.title : null,
      status: item.group ? (GROUP_STATUS_MAP[item.group.id] || null) : null,
      videoIdResolved: !!resolution.baseId,
      videoIdStrategy: resolution.strategy,
      videoIdError: resolution.error || null,
      baseVideoId: resolution.baseId,
      extractedNote: resolution.notes,
      extractedExtra: resolution.extra || null,
      // Filled in below, once duplicates within this batch are grouped.
      assignedSuffix: null,
      assignedVideoId: null,
      consignorCode: parsedBase ? parsedBase.consignorCode : null,
      consignorLabel: getStatus('consignor') || getText('otherConsignor'),
      sexCode: parsedBase ? parsedBase.sexCode : null,
      sexLabel: getStatus('sex'),
      sireCode: parsedBase ? parsedBase.sireCode : null,
      sireLabel: getStatus('sireBreed'),
      damCode: parsedBase ? parsedBase.damCode : null,
      damLabel: getStatus('damBreed'),
      weight: parsedBase ? Number(parsedBase.weight) : null,
      monthYear: parsedBase ? parsedBase.monthYear : null,
      videoMaker: getText('videoMaker'),
      previewLink: getText('previewLink'),
      embedLink: getText('embedLink'),
      clipCount,
      hasClips: clipCount > 0,
      hasYoutubeUrl: !!getText('previewLink'),
    };
  });

  // Group by resolved base id (post notes-stripping) and assign suffixes
  // in Monday creation-date order.
  const byBaseId = new Map();
  rows.forEach(r => {
    if (!r.baseVideoId) return;
    if (!byBaseId.has(r.baseVideoId)) byBaseId.set(r.baseVideoId, []);
    byBaseId.get(r.baseVideoId).push(r);
  });
  const duplicateGroups = [];
  byBaseId.forEach((group, baseId) => {
    if (group.length < 2) {
      group[0].assignedSuffix = null;
      group[0].assignedVideoId = baseId;
      return;
    }
    group.sort((a, b) => (a.mondayCreatedAt || '').localeCompare(b.mondayCreatedAt || ''));
    group.forEach((r, i) => {
      r.assignedSuffix = i === 0 ? null : i + 1; // 1st keeps base id, 2nd -> -2, 3rd -> -3, ...
      r.assignedVideoId = i === 0 ? baseId : `${baseId}-${i + 1}`;
    });
    duplicateGroups.push({
      baseVideoId: baseId,
      count: group.length,
      resolution: group.map(r => ({ mondayItemId: r.mondayItemId, mondayCreatedAt: r.mondayCreatedAt, assignedVideoId: r.assignedVideoId })),
    });
  });

  const unresolved = rows.filter(r => !r.videoIdResolved);
  const recoveredViaNotes = rows.filter(r => r.videoIdResolved && r.videoIdStrategy !== 'exact');
  const noClips = rows.filter(r => !r.hasClips);
  // Only "Created" records are expected to have a YouTube link already —
  // Ready/On Hold legitimately won't yet, so flagging those would just be noise.
  const createdWithoutYoutube = rows.filter(r => r.status === 'created' && !r.hasYoutubeUrl);

  return jsonResponse({
    ok: true,
    scanned: rows.length,
    hasMoreBeyondThisScan: !!page.cursor,
    summary: {
      videoIdResolvedExactly: rows.length - recoveredViaNotes.length - unresolved.length,
      videoIdRecoveredViaNotesStripping: recoveredViaNotes.length,
      videoIdUnresolved: unresolved.length,
      duplicateGroups: duplicateGroups.length,
      duplicateRecordsNeedingASuffix: duplicateGroups.reduce((sum, g) => sum + (g.count - 1), 0),
      withClips: rows.length - noClips.length,
      withoutClips: noClips.length,
      createdWithoutYoutube: createdWithoutYoutube.length,
      byStatus: {
        ready: rows.filter(r => r.status === 'ready').length,
        hold: rows.filter(r => r.status === 'hold').length,
        created: rows.filter(r => r.status === 'created').length,
        unrecognizedGroup: rows.filter(r => !r.status).length,
      },
    },
    exceptions: {
      unresolvedVideoId: unresolved.slice(0, 25).map(r => ({ mondayItemId: r.mondayItemId, name: r.mondayItemName, error: r.videoIdError })),
      recoveredViaNotesStripping: recoveredViaNotes.slice(0, 25).map(r => ({ mondayItemId: r.mondayItemId, originalName: r.mondayItemName, recoveredBaseId: r.baseVideoId, strategy: r.videoIdStrategy, notesFieldWillContain: r.extractedNote })),
      duplicateGroups: duplicateGroups.slice(0, 25),
      noClips: noClips.slice(0, 25).map(r => ({ mondayItemId: r.mondayItemId, name: r.mondayItemName, status: r.status })),
      createdWithoutYoutube: createdWithoutYoutube.slice(0, 25).map(r => ({ mondayItemId: r.mondayItemId, name: r.mondayItemName })),
    },
    sampleRows: rows.slice(0, 8),
    note: 'Read-only preview — nothing written anywhere. "already exists in Auction Suite" duplicate checking isn\'t included yet since the live app has no real backend to check against (video-manager is still mock-data-only) — that check gets added once this runs against real Firestore data. Increase itemScan (max 500) to cover more of the board; re-run repeatedly with cursor-following to eventually cover all 629 for a true final count.',
  });
}

/* =============================================================
 * export-records — one page of fully-resolved items, shaped for
 * the real import. Deliberately does NOT assign final duplicate
 * suffixes here: that needs to see every record across the whole
 * board first, which a single page can't guarantee. The import
 * page (monday-migration-test.html) calls this in a cursor loop to
 * pull every page, then does duplicate-grouping + creation-date
 * suffix assignment once across the complete combined set — same
 * algorithm as dry-run-preview's, just run client-side once
 * everything is in hand. Still entirely read-only against Monday;
 * nothing is written to Firestore from here.
 * ============================================================= */
async function actionExportRecords(params) {
  const boardId = requireParam(params, 'boardId');
  const cursor = params.get('cursor') || null;
  const pageSize = clampInt(params.get('pageSize'), 100, 10, 500);
  const neededColumnIds = Object.values(COLUMN_MAP);

  // Column labels (needed to resolve status-type columns) are fetched
  // alongside items on every page, not just the first — `next_items_page`
  // and `boards` are independent root fields, so both fit in one request.
  // This keeps each page self-contained instead of relying on the client
  // to carry state from page 1 forward, which would break if a caller
  // ever fetched pages out of order or resumed a partial import.
  const query = cursor
    ? `query ($boardIds: [ID!], $cursor: String!, $limit: Int!) {
         boards (ids: $boardIds) { columns { id settings_str } }
         next_items_page (cursor: $cursor, limit: $limit) {
           cursor
           items {
             id
             name
             created_at
             group { id title }
             column_values (ids: ${JSON.stringify(neededColumnIds)}) { id text value }
             assets { id }
           }
         }
       }`
    : `query ($boardIds: [ID!], $limit: Int!) {
         boards (ids: $boardIds) {
           columns { id settings_str }
           items_page (limit: $limit) {
             cursor
             items {
               id
               name
               created_at
               group { id title }
               column_values (ids: ${JSON.stringify(neededColumnIds)}) { id text value }
               assets { id }
             }
           }
         }
       }`;
  const variables = cursor
    ? { boardIds: [boardId], cursor, limit: pageSize }
    : { boardIds: [boardId], limit: pageSize };
  const data = await mondayQuery(query, variables);

  const columns = (data.boards || [])[0]?.columns || [];
  let items, nextCursor;
  if (cursor) {
    items = data.next_items_page?.items || [];
    nextCursor = data.next_items_page?.cursor || null;
  } else {
    const board = (data.boards || [])[0];
    items = board?.items_page?.items || [];
    nextCursor = board?.items_page?.cursor || null;
  }

  const labelsByColumn = {};
  columns.forEach(c => { labelsByColumn[c.id] = parseStatusLabels(c.settings_str); });

  const records = items.map(item => {
    const cvById = {};
    item.column_values.forEach(cv => { cvById[cv.id] = cv; });
    const getText = key => cvById[COLUMN_MAP[key]]?.text || null;
    const getStatus = key => resolveStatusValue(cvById[COLUMN_MAP[key]], labelsByColumn[COLUMN_MAP[key]] || {});

    const resolution = extractVideoIdAndNotes(item.name);
    const parsedBase = resolution.baseId ? parseVideoId(resolution.baseId) : null;

    return {
      mondayItemId: item.id,
      mondayItemName: item.name,
      mondayCreatedAt: item.created_at,
      status: item.group ? (GROUP_STATUS_MAP[item.group.id] || null) : null,
      videoIdResolved: !!resolution.baseId,
      videoIdStrategy: resolution.strategy,
      videoIdError: resolution.error || null,
      baseVideoId: resolution.baseId,
      extractedNote: resolution.notes,
      consignorCode: parsedBase ? parsedBase.consignorCode : null,
      consignorLabel: getStatus('consignor') || getText('otherConsignor'),
      sexCode: parsedBase ? parsedBase.sexCode : null,
      sexLabel: getStatus('sex'),
      sireCode: parsedBase ? parsedBase.sireCode : null,
      sireLabel: getStatus('sireBreed'),
      damCode: parsedBase ? parsedBase.damCode : null,
      damLabel: getStatus('damBreed'),
      weight: parsedBase ? Number(parsedBase.weight) : null,
      monthYear: parsedBase ? parsedBase.monthYear : null,
      videoMaker: getText('videoMaker'),
      previewLink: getText('previewLink'),
      clipCount: (item.assets || []).length,
    };
  });

  return jsonResponse({
    ok: true,
    returned: records.length,
    cursor: nextCursor,
    records,
  });
}

/* =============================================================
 * Plumbing
 * ============================================================= */
function requireParam(params, name) {
  const v = params.get(name);
  if (!v) throw new Error(`Missing required query param: ${name}`);
  return v;
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const actions = {
  'whoami': actionWhoami,
  'boards': actionBoards,
  'board-schema': actionBoardSchema,
  'sample-items': actionSampleItems,
  'asset-test': actionAssetTest,
  'pagination-probe': actionPaginationProbe,
  'dry-run-preview': actionDryRunPreview,
  'export-records': actionExportRecords,
};

export default async (req) => {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  if (!action) {
    return jsonResponse({
      ok: true,
      message: 'Monday migration test endpoint. Pass ?action=<name>.',
      availableActions: Object.keys(actions),
    });
  }
  const handler = actions[action];
  if (!handler) {
    return jsonResponse({ ok: false, error: `Unknown action "${action}". Available: ${Object.keys(actions).join(', ')}` }, 400);
  }
  try {
    return await handler(url.searchParams);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = { path: '/api/monday-migration' };
