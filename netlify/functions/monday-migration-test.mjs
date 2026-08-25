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
 *   dry-run-preview   Phase 5-7 — needs COLUMN_MAP filled in first (see below)
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

/* =============================================================
 * Phase 5-7 config — DELIBERATELY EMPTY until Phase 1-2 has run
 * against the real board and we know the actual column IDs.
 * "Do not guess field names; inspect the actual Monday board" —
 * so dry-run-preview refuses to pretend a mapping exists until
 * this is filled in with real `column_values[].id` values from
 * a `board-schema`/`sample-items` call.
 *
 * Fill in the right-hand side with the Monday column id (NOT the
 * title — titles can be renamed, ids can't) once known, e.g.:
 *   videoId: 'text_mkr2xyz1'
 * ============================================================= */
const COLUMN_MAP = {
  videoId: null,      // expected Monday field: "Video ID"
  consignor: null,    // "Consignor"
  sex: null,           // "Sex"
  sireBreed: null,     // "Bull Breed" / "Sire Breed"
  damBreed: null,      // "Cow Breed" / "Dam Breed"
  weight: null,        // "Base Weight"
  videoMonth: null,    // "Video Month"
  status: null,        // "Status"
  videoMaker: null,    // "Video Maker"
  previewLink: null,   // "Preview Link" / "YouTube Link"
  embedLink: null,     // "Embed Link"
  canvaLink: null,     // "Canva Link"
};

function isColumnMapConfigured() {
  return Object.values(COLUMN_MAP).some(v => v);
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
    query ($assetIds: [ID!]) {
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
  const label = `${asset.name}${asset.file_extension ? '.' + asset.file_extension : ''}`;
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

/* =============================================================
 * Phase 5-7 — dry-run preview. Refuses to guess: only runs once
 * COLUMN_MAP above has real column ids in it.
 * ============================================================= */
async function actionDryRunPreview(params) {
  if (!isColumnMapConfigured()) {
    return jsonResponse({
      ok: false,
      error: 'COLUMN_MAP is not configured yet.',
      note: 'Run board-schema first, read the real column ids off the board, fill them into COLUMN_MAP at the top of netlify/functions/monday-migration-test.mjs, then call this action again. This is intentional — the task explicitly said not to guess field names.',
      currentColumnMap: COLUMN_MAP,
    });
  }
  const boardId = requireParam(params, 'boardId');
  const scan = clampInt(params.get('itemScan'), 100, 1, 500);

  const data = await mondayQuery(
    `
    query ($boardIds: [ID!], $limit: Int!) {
      boards (ids: $boardIds) {
        items_page (limit: $limit) {
          cursor
          items {
            id
            name
            group { title }
            column_values { id text value }
            assets { id }
          }
        }
      }
    }
  `,
    { boardIds: [boardId], limit: scan }
  );
  const page = (data.boards || [])[0]?.items_page || { items: [] };
  const items = page.items;

  const getVal = (item, key) => {
    const colId = COLUMN_MAP[key];
    if (!colId) return null;
    const cv = item.column_values.find(c => c.id === colId);
    return cv ? cv.text : null;
  };

  const videoIdCounts = new Map();
  const rows = items.map(item => {
    const videoId = getVal(item, 'videoId');
    if (videoId) videoIdCounts.set(videoId, (videoIdCounts.get(videoId) || 0) + 1);
    return {
      mondayItemId: item.id,
      mondayItemName: item.name,
      group: item.group ? item.group.title : null,
      videoId,
      consignor: getVal(item, 'consignor'),
      hasClips: (item.assets || []).length > 0,
      clipCount: (item.assets || []).length,
      hasYoutubeUrl: !!getVal(item, 'previewLink'),
    };
  });

  const missingVideoId = rows.filter(r => !r.videoId);
  const duplicateVideoIds = [...videoIdCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  const noClips = rows.filter(r => !r.hasClips);
  const noYoutube = rows.filter(r => !r.hasYoutubeUrl);

  return jsonResponse({
    ok: true,
    scanned: rows.length,
    hasMoreBeyondThisScan: !!page.cursor,
    summary: {
      readyLooking: rows.length - missingVideoId.length - duplicateVideoIds.length,
      missingVideoId: missingVideoId.length,
      duplicateVideoIds: duplicateVideoIds.length,
      withClips: rows.length - noClips.length,
      withoutClips: noClips.length,
      withYoutubeUrl: rows.length - noYoutube.length,
      withoutYoutubeUrl: noYoutube.length,
    },
    exceptions: {
      missingVideoId: missingVideoId.slice(0, 25),
      duplicateVideoIds,
      noClips: noClips.slice(0, 25),
    },
    note: 'This is a preview only — nothing was written anywhere. Increase itemScan and re-run to cover more of the board once the mapping looks right.',
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
