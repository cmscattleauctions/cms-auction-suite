# Monday.com → Video Manager migration (feasibility test)

Status: **Phase 1-4 infrastructure built, not yet run against the real
board.** Nothing has been imported. No Monday mutations exist anywhere
in this codebase — everything here is read-only by construction (see
`netlify/functions/lib/monday-client.mjs`, which refuses to send a
GraphQL `mutation` even if one were accidentally written).

## What exists right now

- `netlify/functions/lib/monday-client.mjs` — shared server-side GraphQL
  client. Reads `MONDAY_API_TOKEN` from the environment, never logs it,
  never returns it in a response.
- `netlify/functions/monday-migration-test.mjs` — the actual test
  endpoint, `GET /api/monday-migration?action=<name>`. Seven actions,
  one per phase below.
- `public/monday-migration-test.html` — a small internal page with a
  button per action. Not linked from the shell, sidebar, or Tools menu
  anywhere — reach it by URL directly (`/monday-migration-test.html`).
  It calls the function above and prints the raw JSON response.

## Running it

1. Set `MONDAY_API_TOKEN`:
   - **Locally**: create `.env` at the repo root (gitignored) with
     `MONDAY_API_TOKEN=...`, then `netlify dev`.
   - **Deployed**: Netlify dashboard → Site settings → Environment
     variables. Safe to set on a deploy-preview context first if you'd
     rather not touch production.
2. Open `/monday-migration-test.html` on whichever of those you used.
3. Run the actions **in order** — each one after "board schema" needs a
   board ID, which you get from step 2 (list boards).

## The seven actions

| # | Action | What it proves |
|---|---|---|
| 1 | `whoami` | Token authenticates; which Monday account it belongs to |
| 2 | `boards` | Every board the token can see, with a best-guess at which one is Video Manager (name contains "video") |
| 3 | `board-schema` | That board's real groups and columns — **real column ids**, not titles |
| 4 | `sample-items` | ~15 real items, every column's raw value *and* displayed text, plus which items have file attachments |
| 5 | `asset-test` | Full file/asset metadata, and an actual download of the smallest attached file to a temp path — verified, then deleted. Never touches Firebase Storage. |
| 6 | `pagination-probe` | Board's total item count, cursor pagination mechanics, and an estimate of how many requests a full pull would take |
| 7 | `dry-run-preview` | A migration-readiness summary (matched/missing Video ID, duplicates, clip counts, YouTube presence) — **only runs once `COLUMN_MAP` is filled in**, see below |

Each response is plain JSON — copy/paste it back into the conversation
with Claude (or wherever this is being reviewed) to move on to the
mapping/conflict analysis. None of it contains the token; it's safe to
share.

## Why `dry-run-preview` starts disabled

Action 7 depends on knowing which real Monday column holds Video ID,
Consignor, etc. Guessing those would violate the one rule this whole
test was built around ("do not guess field names; inspect the actual
board"). So `COLUMN_MAP` at the top of `monday-migration-test.mjs`
starts with every value `null`, and action 7 refuses to run until at
least one is filled in — it returns the current (empty) map and tells
you to run `board-schema` first.

Once `board-schema` (action 3) has run, fill in `COLUMN_MAP` with the
real `column_values[].id` values (not titles — titles can be renamed,
ids can't), e.g.:

```js
const COLUMN_MAP = {
  videoId: 'text_mkr2xyz1',
  consignor: 'text_mkr2abc2',
  // ...
};
```

## Proposed field mapping (Auction Suite side is confirmed; Monday side is a placeholder until Phase 2 runs)

The right-hand column below is the actual, current Video Manager record
shape (`public/video-manager/mock-data.js` → `buildRecord()` /
`public/video-manager/repository.js`). The left-hand column is what the
task description said to *expect* on the Monday side — **not
confirmed**. Treat every "Monday field" cell as a hypothesis to check
against action 3's real output, not a fact.

| Monday field (expected, unconfirmed) | Auction Suite field | Notes |
|---|---|---|
| Video ID | `baseVideoId` + `suffix` → `videoId` | Parse with `parseVideoId()` (`video-id.js`) if Monday stored it as the same `C.S.Sire.Dam.Wt.MMYY[-n]` format; otherwise this needs its own conversation before anything else — the whole app keys off this format |
| Consignor | `consignorCode` / `consignorName` | Monday almost certainly stores a name, not our numeric code — will need a name→code lookup against the real `CONSIGNORS` list (now the 69-consignor real list, see `mock-data.js`), flagging anything that does't match as `needsReview` |
| Sex | `sexCode` | Map text (Steers/Heifers/Steers & Heifers) → code via `SEX_TYPES` |
| Bull Breed / Sire Breed | `sireCode` | Map text → code via `SIRE_TYPES`; flag unrecognized breeds instead of inventing a code |
| Cow Breed / Dam Breed | `damCode` | Map text → code via `DAM_TYPES`, same as above |
| Base Weight | `weight` | `Number()`; flag non-numeric or absurd values (0, negative, >2000) as needing review rather than silently coercing |
| Video Month | `monthYear` | Needs to land in `MMYY` format (`video-id.js`'s `inputValueToMonthYear`/`formatMonthYear` show the shape); confirm what format Monday actually stores |
| Status | `status` (`'ready'\|'hold'\|'created'`) + `isDraft` | Monday's status/group values need an explicit lookup table once seen — do not assume the words line up |
| Video Maker | `videoMaker` | Direct if it's free text; if it's a Monday "person" column, use the display name |
| Preview Link / YouTube Link | `youtubeUrl` + `youtubeId` | Extract the id with the same regex already used everywhere (`(?:youtu\.be/\|v=\|embed/)([a-zA-Z0-9_-]{5,})`, see `parseYoutubeLink()` in `ui-drawer.js`) rather than trusting a possibly-stale id field |
| Embed Link | `embedUrl` / `embedCode` | Per the existing app convention, **derive this from the YouTube id** rather than importing Monday's stored embed link — production embeds need the `?mute=1&autoplay=1&playlist={id}&loop=1` params this app already standardizes on, and Monday's copy likely doesn't have them |
| Canva | `canvaLink` | Direct, if present. Per earlier product direction, most Monday-imported records won't have one yet — that's expected, not an error |
| Images | *(not imported)* | Task explicitly says Monday's image section isn't needed |
| Files / source clips | `clips[]` | This is the Phase 3 question — see `asset-test`. Each clip needs `filename`, `durationSec` (probably not available from Monday — clips may land with `durationSec: null` until someone opens the file), `sizeBytes`, `uploader`, `uploadedAt`, `isOriginal: true` |
| *(new)* | `hasTags: true` | Per prior product direction, every record migrated from Monday should default to `hasTags: true` (baked-in program/certification graphics assumed present until proven otherwise) |
| *(new)* | `mondayItemId` | **New field** — doesn't exist in the schema yet. Preserve Monday's item id for audit/idempotency (see below). Not shown prominently in the UI. |
| *(new)* | `migratedFrom: 'monday'`, `migratedAt` | **New fields** — same treatment as `mondayItemId` |

### Schema changes this implies

Only three *additive* fields on the video record — `mondayItemId`,
`migratedFrom`, `migratedAt`. Nothing existing changes shape. These
should stay out of the normal drawer UI (maybe a line in Activity, or
nowhere at all) per the task's own instruction not to surface them
prominently.

## Conflicts to expect (Phase 6) — mechanism only, not real numbers yet

`dry-run-preview` currently checks:
- missing Video ID
- duplicate Video ID (within the scanned batch)
- no clips/files attached
- no YouTube URL

Once real data comes back, extend this list to match whatever Phase 6
actually surfaces — the task also calls out duplicate-against-existing-
Auction-Suite records (this needs a `findByFinalId`-style check against
the live `VideoRepository`, not just within the Monday batch), invalid
weights, unusual sex/breed values, archived groups, and multiple
YouTube versions. Not built yet because there's nothing real to
validate the logic against.

## Migration architecture (for later — not built)

```
Monday API
  → retrieve board records (paginated, see pagination-probe numbers)
  → retrieve source clip metadata/files (asset-test)
  → normalize fields (COLUMN_MAP + the lookups above)
  → match on Video ID (findByFinalId)
  → migration preview (extend dry-run-preview with full Phase 6/7 rules)
  → explicit admin confirmation
  → create Video Manager records (VideoRepository.createVideo, extended
    with mondayItemId/migratedFrom/migratedAt)
  → upload source clips into Firebase Storage
  → verify imported record/file counts
```

Must be resumable/idempotent: re-running should never create a second
record for a Video ID that's already been migrated, and never
re-upload a clip that's already there. The natural key is `mondayItemId`
once it exists on a record (check for it before creating), with Video
ID as the human-facing match key per the task's instruction.

**None of the above is built.** It's the plan once Phase 1-4 confirm
the approach works against the real board.
