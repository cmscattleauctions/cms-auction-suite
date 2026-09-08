# Hardening checklist — security / performance / reliability / UI-UX

Working doc for the multi-phase hardening pass. Each item: finding →
what was verified against current code → what was implemented →
how it was verified → any remaining dependency (e.g. a deploy step
that needs your credentials, or a decision only you can make).

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` needs your input

## Phase 1 — Security

- [x] 1. Monday migration endpoint exposure — see detail below
- [x] 2. Country Market role escalation (self-assigned admin) — see detail below
- [x] 3. Firebase authorization (allowedTabs, Country Market rules) — see detail below
- [x] 4. Public submission validation — see detail below
- [x] 5. Unsafe HTML rendering (XSS) — see detail below
- [x] 6. Passwords persisted in adminJobs documents — see detail below
- [x] 7. Server-side clip transfer hardening (SSRF) — see detail below

### 1. Monday migration endpoint exposure

**Finding:** `netlify/functions/monday-migration-test.mjs` (`GET /api/monday-migration`)
had zero server-side authentication — reachable by anyone on the internet
who found the URL. It's read-only against Monday (no mutations) but
returns real business data (consignor names, cattle attributes) and,
via `asset-test`/`clip-batch`, signed direct-download URLs to source
video files. `public/monday-migration-test.html` checked `isSignedIn()`
(any signed-in user, not specifically an admin) only for a UI label —
never blocked the actual requests, and the server never checked
anything at all.

**Verified against current code:** confirmed exactly as described above
by reading the function, its HTML page, and `docs/MONDAY-MIGRATION.md`.
Also confirmed this is NOT dead code to simply delete — the HTML page's
`export-records` + `clip-batch` flow is a real, idempotent (`mondayItemId`-
keyed) write path into the live `VideoRepository`/Firestore, not just a
read-only test.

**Implemented:**
- `netlify/functions/lib/verify-firebase-token.mjs` (new) — verifies a
  Firebase ID token's signature/issuer/audience/expiry using Google's
  public keys via the `jose` library. No Admin SDK / service account
  secret needed (Netlify Functions run outside the Firebase project).
- `netlify/functions/lib/require-migration-admin.mjs` (new) — requires
  an `Authorization: Bearer <idToken>` header, verifies it, and checks
  the token's email against the same suite-admin email used everywhere
  else in this app (`jayton.h@cmslivestock.com`). Every response —
  including the bare "what actions exist" discovery message — now goes
  through this gate first.
- Board allowlist: `ALLOWED_BOARD_IDS` restricts every `boardId`-taking
  action to the one confirmed Video Manager board; a different board id
  is rejected even for the authorized admin, since the Monday token
  itself has org-wide read access this tool has no reason to expose.
- `Cache-Control: no-store` added to every response (`monday-client.mjs`'s
  `jsonResponse`) — this data must never sit in a shared/CDN cache.
- Per-request size caps were already present (`clip-batch` ≤25 ids,
  `sample-items`/`pagination-probe`/`export-records`/`dry-run-preview`
  capped 500 or fewer) — left as-is, now layered under the auth gate.
- `public/monday-migration-test.html`: both script blocks now attach a
  fresh ID token to every request via a shared `authedFetch()` helper;
  the auth pill now specifically checks for the admin email (was: any
  signed-in user) and shows a distinct "signed in but not authorized"
  state.
- `public/video-manager/firestore-data.js`: added `getIdToken()` export
  (thin wrapper on `auth.currentUser.getIdToken()`).
- `netlify/functions/package.json` (new) — adds the `jose` dependency;
  ran `npm install` locally (`node_modules`/`package-lock.json` now
  present, gitignored per the existing `.gitignore` pattern for
  `functions/`).

**Verified:** every touched `.mjs`/`.js` file re-checked as a real ES
module (`.mjs` files directly; `.js` files via a `.mjs` copy — see the
project history note on why a plain `node --check foo.js` isn't
trustworthy here). Both inline `<script type="module">` blocks in the
HTML page extracted and syntax-checked individually. **Not verified
live** — no way to obtain a real Firebase ID token or hit the deployed
Netlify function from this environment. See "Remaining/deploy steps"
below for exactly what to check after deploy.

**Remaining/deploy steps (needs you):**
1. This is a **code-only** change until deployed — Netlify functions
   redeploy the same way the rest of the site does (push to `main`).
   No new environment variable is needed (`jose` verification doesn't
   need a service-account secret).
2. After deploy, sign in to the main suite as `jayton.h@cmslivestock.com`,
   open `/monday-migration-test.html` in another tab, confirm the pill
   reads "ready to import", and run the cheap `whoami` action to
   confirm the full round trip (token attached → verified → Monday
   query executes) actually works end-to-end.
3. Also confirm the negative case once: open the same page in a private/
   incognito window with no session (or curl the endpoint with no
   `Authorization` header) and confirm it now returns 401, not data.
4. If this tool is in fact fully retired (all Monday records already
   migrated), the cleanest next step is deleting it outright rather than
   maintaining an auth gate on unused code — that's a call only you can
   make; I hardened rather than removed because I can't confirm
   migration completion from the code alone.

### 2. Country Market role escalation

**Finding:** `docs/firestore.rules`' `profiles/{uid}` create rule had
no restriction on `role` at all (`allow create: if isApproved() &&
request.auth.uid == uid;`). The app's own client code
(`country-market/firestore-adapter.js`) only granted `role:'admin'`
to the first-ever profile, but that was JS logic, not a rule — any
approved suite user (any app, not just Country Market) could call the
Firestore SDK directly and create their own `profiles/{uid}` doc with
`role:'admin'`, becoming a Country Market admin (buyer visibility,
lot delete, settings, consignor management, editing other people's
roles) regardless of whether an admin already existed.

**Verified against current code:** confirmed exactly as described —
read both the rule and the client bootstrap code side by side.

**Implemented:**
- `docs/firestore.rules`: create rule now requires `request.resource.data.role == 'rep'` —
  a new profile can never be self-created as admin, full stop. `update`
  now also allows `isSuiteAdmin()` (not just `cmIsAdmin()`) as a
  bootstrap/recovery path if Country Market ever has zero admins,
  matching how `isSuiteAdmin()` is already the ultimate authority
  elsewhere in this rules file.
- `country-market/firestore-adapter.js`: `ensureProfile()` now always
  creates `role:'rep'` and no longer does a full collection scan to
  guess "am I first" (that scan is also gone — one fewer unnecessary
  broad read on every new sign-in).

**Verified:** `firebase deploy --only firestore:rules --dry-run`
compiled the updated rules successfully (this only checks the rules
file parses/compiles — it does not deploy or otherwise touch
production). `firestore-adapter.js` re-checked as a real ES module.
**Not verified against live data** — see deploy steps below.

**Remaining/deploy steps (needs you — explicit authorization required
before I run this):**
1. `firebase deploy --only firestore:rules` — deploys BOTH this fix and
   item 3's `cmLots` rule below in one rules file. I did not run this;
   say the word and I will, or run it yourself.
2. **Rollback:** `git show <prev-commit>:docs/firestore.rules >
   /tmp/rollback.rules && firebase deploy --only firestore:rules` using
   the pre-this-change file content (or `git revert` this commit, then
   redeploy) — rules deploys aren't versioned/undoable any other way.
3. **Validation after deploy:** confirm an existing Country Market
   admin can still do everything they could before (create/edit lots,
   manage consignors, edit profiles); confirm a rep account cannot
   create a second `profiles` doc with role admin (try it from the
   browser console: `setDoc(doc(db,'profiles','<their own uid>'),
   {..., role:'admin'})` should now fail with permission-denied — it's
   already their own existing doc so this actually exercises `update`,
   not `create`; to test `create` specifically you'd need a genuinely
   new account's first sign-in).
4. This does **not** affect any existing profile — only tightens what
   a *newly created* profile document can contain, so no current admin
   loses access.

### 3. Firebase authorization (allowedTabs, Country Market data rules)

**Finding:** two related gaps — (a) Country Market's Firestore rules
for `cmLots` allowed any approved suite user to write/delete/change-
status on any lot via direct SDK access, not just their own, despite
the app's own client logic (`canEditLot`/`canDeleteLot`/
`canChangeStatus`) already drawing exactly those lines; (b)
`allowedTabs` (the per-user tab restriction added via Admin Settings)
is navigation-only — hiding a tab does not restrict the underlying
Firestore collection, which (for nearly everything in this suite) is
gated by "any approved user" rather than per-account.

**Verified against current code:** read `country-market/app.js`'s
permission functions against `docs/firestore.rules`, and read every
collection's rule alongside `shell.js`'s `isTabAllowed()`/`allowedTabs`
plumbing.

**Implemented:**
- `docs/firestore.rules`: `cmLots` now splits `create`/`update`/`delete`
  (previously one blanket `write`). `update` requires either
  `cmIsAdmin()` or (own lot by `rep_name` match + status still
  Staged/Active + the update doesn't change `status` or `rep`) —
  matches `canEditLot()`/`canChangeStatus()` exactly. `delete` is now
  admin-only, matching `canDeleteLot()`.
- Clarifying copy in `shared/admin-panel.js` (the "Tabs this person can
  open" section) and a corrected comment in `shared/shell.js` — both
  now say plainly that this hides navigation, not data, since the
  previous shell.js comment claimed each sub-app's "own security rules
  remain the real data boundary," which isn't accurate for most
  collections in this app (they're gated by `isApproved()` alone).

**Explicitly NOT done — needs your decision:** making `allowedTabs`
into a real per-account data boundary would mean rewriting most of
`docs/firestore.rules` (every collection would need to check the
caller's own `allowedTabs` array, not just whether they're approved) —
a much larger, higher-risk change than a security patch pass, and it's
not clear from the code whether `allowedTabs` was ever meant to be a
security feature vs. a "declutter this person's sidebar" convenience.
If you want real enforcement, tell me and I'll scope it as its own
piece of work; for now the two collections that most plausibly
warrant it (`cmLots`/`cmConsignors`, if there are Country-Market-only
accounts who shouldn't see the rest of the suite's data) are already
covered by Country Market's own admin/rep role check, which **is**
enforced in rules independent of `allowedTabs`.

**Also flagged, not fixed (accepted gap, needs a schema change to
close):** `cmLots.buyer` is visible to any approved user with direct
SDK access even though the UI hides it from reps (`canViewBuyer()`).
Firestore rules can't filter individual fields out of a document read
— only whole-document access. Closing this needs moving `buyer` into
a separate `cmLots/{id}/private/buyer`-style document that only admins
can read/write, which changes the app's data shape and read patterns
enough that I did not do it in this pass. Flagging so it's a known,
deliberate gap rather than a silent one.

**Remaining/deploy steps:** same rules deploy as item 2 above (they're
the same file, one deploy covers both). Validation: as an existing
rep account, confirm you can still edit your own Staged/Active lots
and cannot edit someone else's or change a lot's status; as admin,
confirm everything still works as before.

### 4. Public submission validation

**Finding:** `videoRecords/{id}`'s anonymous-create rule (public
Cattle Video Upload page, `public/video-upload/`) had no field
allowlist, type checks, length caps, or array limits — it only
checked `createdBy=='Rep'` and `submittedByUid==request.auth.uid`.
The client (`repository.js`'s `createVideo()`) always constructs a
well-formed record, but that's browser JS; the real security boundary
is the rule, and it accepted literally any other field/value/shape.

**Verified against current code:** confirmed the create rule's actual
content, and cross-checked `createVideo()`'s real output shape so the
allowlist below matches what a legitimate submission actually looks
like (not a guess).

**Implemented:** `docs/firestore.rules`' new `isValidAnonVideoSubmission()`
function, used by the create rule:
- `keys().hasOnly([...])` — the exact field set `createVideo()`
  produces; anything else present makes the write fail closed.
- Pins the trust-sensitive fields to their only legitimate fresh-
  submission values: `status=='ready'`, `needsReview==true`,
  `workingOn==null`, `usage`/`videoIdHistory`/`previousYouTubeVideos`
  all empty, `youtubeId`/`youtubeUrl`/`embedUrl`/`embedCode` all null.
  A public submission can never plant a record that already looks
  reviewed, published, claimed, or used.
- Type + length/range caps on every free-text/URL/numeric field
  (names ≤200 chars, notes ≤2000, weight a plausible 0-20000 number,
  `monthYear` exactly 4 chars, `clips`/`activity` arrays capped at
  20/5 entries, etc.).

**Verified:** `firebase deploy --only firestore:rules --dry-run`
compiled successfully. Not verified against a live submission (no way
to exercise this from this environment) — see deploy steps below.

**Accepted gap, not fixed:** the rule validates the `clips` array's
*size* but not each item's internal shape (filename/storagePath/
sizeBytes types) — deep per-item validation is possible in Firestore
rules but adds significant complexity for a lower-severity gap (a
malformed clip entry could look strange in a staff view, but per
Finding #4/#5's other fixes, rendering code already falls back
gracefully on missing/unexpected fields rather than crashing —
spot-checked, not exhaustively audited across every render path).

**Remaining/deploy steps:** same rules deploy as items 2/3
(`firebase deploy --only firestore:rules`, not yet run — needs your
authorization). Validation after deploy: submit a real video through
`/video-upload` and confirm it still works end to end (this is the
one path most likely to break if the allowlist is missing a field
`createVideo()` actually sets — re-check against a real submission's
network payload if anything fails).

### 6. Passwords persisted in adminJobs documents

**Finding:** `shared/admin-data.js`'s `runAdminJob()` writes a plaintext
password into `adminJobs/{jobId}.params.password` for the `createUser`
and `setPassword` ops. `functions/index.js`'s `adminRunJob` reads and
acts on it, but the job document — password included — was left
sitting in Firestore indefinitely afterward, readable by anyone with
`isSuiteAdmin()` access (currently just the one admin account, but
also anyone with direct GCP/Firestore console access to the project).

**Business decision already made, not reversed here:** the
recommendation to "prefer invitation/password-reset flows" would mean
replacing "admin sets a password directly" with an email-based reset
flow — but that exact design choice (admin sets it directly, not a
reset email) was explicitly made earlier in this project's history
when the Admin Settings feature was first built, so I did not reverse
it. If you'd rather move to an invite/reset-email flow, that's a
larger, separate change (new Firebase Auth email templates, UI
changes) — say so and I'll scope it.

**Implemented (the part that doesn't require that larger decision):**
- `functions/index.js`: every terminal update to a job document
  (`status:'done'` on success, `status:'error'` on failure) now also
  strips `params.password` via `FieldValue.delete()` in the same
  atomic write. A password now exists in Firestore only for the few
  seconds between job creation and the function processing it — not
  indefinitely. The rest of the job doc (op, requestedBy, status,
  timestamps, result) is left in place as an audit trail.
- Confirmed nothing in `adminRunJob` ever logs `job`/`job.params`/the
  password (no `console.log`/`logger.log` of those anywhere in the
  function) — "prevent credentials from entering logs" was already
  true, verified rather than assumed.
- New `scripts/clear-adminjob-passwords.mjs` (local one-off script,
  same pattern as the existing `scripts/clear-bad-youtube-links.mjs`)
  — a controlled cleanup for jobs created *before* this fix shipped,
  which still have a real password sitting in them. Defaults to a dry
  run (reports what it would clear); `--apply` actually clears it.

**Verified:** `functions/index.js` re-checked as valid syntax; the new
script re-checked as valid syntax. **Not run** — needs your
credentials (`gcloud auth application-default login`, same as the
existing scripts) and is a write against production Firestore, so I
did not run it myself.

**Remaining/deploy steps (needs you):**
1. `firebase deploy --only functions:adminRunJob` — ships the "clear
   the password on every future job" fix. I did not run this.
2. Once deployed, run `node scripts/clear-adminjob-passwords.mjs`
   (dry run first, review the list, then `--apply`) to clean up any
   passwords from jobs already run before today.
3. **Rollback:** revert the `functions/index.js` commit and redeploy
   — the change is additive (an extra field-delete on writes that
   already happen), nothing about the create/setPassword behavior
   itself changes, so there's no functional behavior to roll back,
   only the "job docs keep their password" behavior to restore if
   for some reason you wanted that back.
4. **Retention limitation, documented as asked:** this does not touch
   Firestore's own backups/point-in-time-recovery snapshots, which may
   retain a copy of a job document (password included) taken before
   this fix ran, for whatever retention window your Firestore backup
   policy has. Clearing the live document does not purge those.

### 7. Server-side clip transfer hardening (SSRF)

**Finding:** `functions/index.js`'s `transferClip` fetches
`job.publicUrl` — a value the CLIENT supplies when creating a
`clipTransferJobs` document — with the Admin SDK's own network access,
then writes the response into Storage where any approved user can
read it back out. No protocol/host/IP validation, no requester
re-check (unlike the sibling `adminRunJob` function), no redirect
handling, no fetch deadline. A malicious or compromised approved
account could point `publicUrl` at an internal service or the cloud
metadata endpoint (`169.254.169.254`) and exfiltrate the response
through what looks like an ordinary "clip".

**Verified against current code:** confirmed the exact gap by reading
the function; confirmed via `grep` that `requestClipTransfer()` /
`uploadClipFromUrl()` (the only path that creates this job type) is
called *exclusively* from `public/monday-migration-test.html` — no
regular staff workflow uses it — which is what justified scoping this
to the migration admin specifically rather than every approved user.

**Implemented:**
- `functions/index.js`: new `assertSafeFetchTarget()` — parses the URL,
  requires `https:`, then resolves the hostname via DNS and rejects if
  ANY resolved address falls in a private/loopback/link-local/reserved
  range (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16 — which
  includes the cloud metadata address, plus the IPv6 equivalents and
  IPv4-mapped-IPv6). Checks the *resolved IP*, not just the hostname
  string, so a hostname crafted to look legitimate can't hide a
  private target.
- The fetch now uses `redirect: 'manual'` and handles at most one
  redirect hop, re-validating the redirect's target through the same
  check — `redirect:'follow'` (the old default) would have silently
  bypassed the whole check for wherever a redirect pointed.
- Added a 30s deadline on the initial fetch (connect+headers; body
  streaming into Storage is unaffected, still bounded by the
  function's own 540s timeout and the existing 2GB cap).
- Added the same requester re-verification `adminRunJob` already does
  (re-check the Auth record for `job.requestedBy` server-side, not
  just trusting the rules) — defense in depth, since this function
  runs with the Admin SDK and bypasses rules entirely.
- `docs/firestore.rules`: `clipTransferJobs` create/read narrowed from
  `isApproved()` (any staff) to `isSuiteAdmin()` (the migration admin
  only), matching the function's own new requester check and this job
  type's actual real-world usage.

**Verified:** unit-tested the private/reserved-IP classifier locally
against 18 known addresses across IPv4/IPv6 (public DNS servers,
`169.254.169.254`, `10.x`/`172.16-31.x`/`192.168.x`, loopback,
link-local, IPv4-mapped-IPv6) — all classified correctly. Confirmed
real DNS behavior locally: `localhost` resolves to `127.0.0.1`/`::1`
(would be rejected), `google.com` resolves to public IPs (would be
allowed). `functions/index.js` re-checked as valid syntax;
`firestore:rules --dry-run` compiled successfully. **Not verified
against a live Monday transfer** — no way to exercise the actual
`transferClip` function from this environment.

**Accepted residual gap, documented rather than silently left:** this
does not fully close a DNS-rebinding race — the hostname could
legitimately re-resolve to a different IP between this check and
`fetch()`'s own internal resolution moments later. Fully closing that
means pinning the checked IP into the actual socket connection, which
Node's global `fetch` doesn't expose a supported way to do. This
closes the realistic threat model for this app (a malicious/
compromised approved account pointing the job at a static internal
address) — not a network-level adversary who can manipulate DNS
resolution in real time.

**Remaining/deploy steps (needs you):**
1. `firebase deploy --only functions:transferClip` and
   `firebase deploy --only firestore:rules` (the same rules deploy as
   items 2/3/4 — one deploy covers all of them). Neither run by me.
2. **Rollback:** revert the `functions/index.js` and
   `docs/firestore.rules` commits, redeploy both. The function change
   is behavior-preserving for legitimate Monday URLs (https, public
   host, no redirect) — only URLs that were never legitimate to begin
   with now get rejected — so a rollback is only needed if the
   migration tool itself breaks in an unexpected way.
3. **Validation after deploy:** run an actual Monday clip transfer
   through `/monday-migration-test.html` (signed in as the migration
   admin) and confirm it still completes successfully — this is the
   one path most likely to reveal a wrong assumption about Monday's
   asset URLs (e.g. if they ever use plain http, or a multi-hop
   redirect chain longer than one hop).

### 5. Unsafe HTML rendering (XSS)

**Finding:** swept `record IDs, reference dictionaries, filters,
imported content, and saved Listings edits` across every app under
`public/` for `.innerHTML =` assignments interpolating unescaped
user-controlled or Firestore/CSV-sourced data.

**Verified against current code:** most of the codebase (country-
market, post-auction, shared, video-manager's table/drawer/modals,
lot-images, lot-numbers, results, banners) already consistently uses
an `escapeHtml`/`esc` helper — spot-checked broadly, confirmed clean.
Two real, confirmed gaps found and fixed:

**5a. `public/listings/index.html` — inconsistent escaping on
staff-typed inline cell edits (highest severity of the two).** The
sheet renderer's per-column value builder had the exact right pattern
(`esc(lotEdit(lot,field) ?? fallback)`) on 3 columns (head, delivery,
shrink) but NOT on 5 more (sex, basewt, slide, price, poPrice) or the
3 rich-text columns (desc, notes, seller) — same repeated pattern,
proving it was an oversight, not a design choice. A staff member's
typed `contenteditable` edit is stored verbatim in the shared
`listingProjects/{id}` Firestore doc (any approved user can open, edit,
and re-save a teammate's listing, per this repo's own README) and
rendered via `.innerHTML=` for whoever next opens that project.
- The 5 plain-value columns: fixed to match the already-correct
  pattern (`esc()` wraps the whole expression, not just the fallback
  branch) — straightforward, no behavior change for legitimate values.
- desc/notes/seller are different: `applyBoldRules()` deliberately
  produces `<strong>` markup, and `notesHTML` joins values with
  `<br>` — a blanket `esc()` would show literal `&lt;strong&gt;`
  instead of bold text, breaking real, intended formatting. New
  `sanitizeRichText()` (narrow allowlist: `strong/b/em/i/u/br`, zero
  attributes preserved even on allowed tags, everything else stripped
  but its *text content* kept) — matches the finding's own instruction
  to "sanitize rich text through a narrow allowlist where formatting
  must remain" rather than just escaping it away. Uses `DOMParser`
  (not `.innerHTML` on a live element) specifically because parsed
  DOMParser documents are inert — they never load resources or fire
  event handlers, so a crafted `<img onerror=...>` can't execute
  merely by being parsed.

**5b. Sire/dam reference-dictionary labels rendered unescaped in 3
files**, one of them the **public, unauthenticated** rep-upload page:
`video-upload/app.js`, `video-manager/app.js` (missing the
`escapeHtml` import entirely — added), `video-manager/ui-modals.js`.
`SIRE_TYPES`/`DAM_TYPES` are Firestore-backed and staff-editable (via
the Video ID Manager); `SEX_TYPES` is genuinely static/hardcoded
(confirmed absent from the mutable `REFERENCE_LISTS` map) so left
alone — was a real candidate, ruled out by tracing it, not assumed.

**Verified:** built a standalone test page (not committed) exercising
`sanitizeRichText()` against 9 payloads — `<img onerror>`, `<script>`,
`<svg onload>`, a `javascript:` link, an allowlisted tag carrying a
malicious `onclick` attribute, plain text with `&`/`<`/`"`, and
legitimate `<strong>`/`<br>`/nested-tag formatting — via a real
browser (Chrome, this session's `claude-in-chrome` tool). Every
malicious payload was stripped with **zero handler execution**
(explicitly checked, not just eyeballed the output string); every
legitimate formatting case rendered correctly. All 6 touched `.js`/
`.html` files re-checked as valid syntax.

**Not done — noted, not silently skipped:** per-item validation of
`clips`/`activity` array contents in the Video Manager's rendering
code (only top-level array size is validated in the Firestore rules
from item 4, not each item's shape) — lower severity, and this
codebase's rendering already showed a defensive fallback pattern
(`?? ''`, `escapeHtml(undefined)` safely coerces) everywhere spot-
checked, so this is a residual-gap note, not a known live bug.
`banners/index.html`'s classic (non-module) inline scripts were not
audited this pass — different code pattern than every other app's ES
modules, would need its own dedicated look if you want it covered.

**Remaining/deploy steps:** none — these are static-file changes with
no Firestore rules/Cloud Function component, so a normal push/PR/merge
(same as any other code change in this repo) ships them; no separate
deploy authorization needed for this item specifically.

## Phase 2 — Performance

- [x] Video/clip downloads must never happen on browse/Grid/clip-list open — only on explicit Download click; Preview (if kept) is a separate explicit click loading only that one clip — see detail below

### Original video/clip files must load only on an explicit click

**Finding (user-specified requirement, not from the source audit):**
browsing records, switching to Grid view, or opening a record's clip
list must never trigger a download of the original video file —
only an explicit Download click (or, for a kept Preview feature, a
separate explicit click loading only that one selected clip).

**Verified against current code:** found two real violations by
searching every `<video`/`.src =` site touching a clip's `downloadUrl`
across the Video Manager:

1. **Grid view (`ui-grid.js`)** — every card for a record with an
   uploaded-but-unpublished clip (no YouTube link yet) created a
   *hidden* `<video>`, set its `src` to the real Storage
   `downloadUrl`, and seeked it — purely to capture a static preview
   frame. This ran automatically, for every such record, the moment
   Grid view rendered — no click involved. Removed entirely; those
   cards now always show the existing neutral placeholder icon (same
   as before for a record with no clip at all). The YouTube-thumbnail
   path (a small `img` fetch from YouTube's CDN, not the source video)
   is untouched.
2. **Drawer Clips tab (`ui-drawer.js`)** — every clip card, for every
   clip, always rendered a real `<video preload="metadata" src="...">`
   pointing at that clip's actual file, the moment the Clips tab
   rendered (drawer open + Clips tab, or any drawer repaint while on
   that tab) — regardless of whether the user had clicked anything.
   Now the `<video>` element (and therefore its `src`) only exists for
   the ONE clip the user has explicitly clicked "Play"/"Preview" on;
   every other clip shows a plain placeholder box with the existing
   play-button overlay, and clicking it is what creates the `<video>`
   element and starts loading, for that clip only. The already-
   existing "Preview" menu item / play-button click flow is otherwise
   unchanged — this only changes *when* the byte transfer starts, not
   the interaction.

Also checked and confirmed already compliant, no changes needed:
Table view's clip-count cell (shows a number only) and its "N clips"
popover (filename/duration/icon only, with its own already-explicit
"Preview" button that `window.open()`s the file only on click); the
Compare modal (touches no clip/video src at all); the upload flow's
local-file duration read (`URL.createObjectURL` on a file the user
just picked from their own device — zero network transfer, opposite
direction of a download).

**Verified:** live browser test (not committed) importing the real,
unmodified `renderGrid()` directly from the fixed file, rendering a
card for a record with a real clip `downloadUrl`, and watching actual
network activity via `PerformanceObserver` for 1.5s after render —
**0 requests** to the clip URL; the card correctly showed the
placeholder + clip-count badge. The drawer fix was verified by direct
code inspection (the `<video>`/`src` markup is now conditional on
`isPlaying`, confirmed by re-reading the exact template output for
both branches) rather than a full live render, since mocking the
drawer's full `ctx.repo`/Firestore dependency chain wasn't worth the
setup for a straightforward conditional-template change of the same
shape already network-verified for Grid. Both touched files
re-checked as valid syntax.

**Remaining/deploy steps:** none — static-file changes only, ships via
the normal push/PR/merge like any other code change.

## Phase 3 — Reliability

(TBD after Phase 1/2)

## Phase 4 — UI/UX

(TBD after Phase 1/2/3)
