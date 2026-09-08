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
- [ ] 4. Public submission validation
- [ ] 5. Unsafe HTML rendering (XSS)
- [ ] 6. Passwords persisted in adminJobs documents
- [ ] 7. Server-side clip transfer hardening (SSRF)

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

## Phase 2 — Performance

- [ ] Video/clip downloads must never happen on browse/Grid/clip-list open — only on explicit Download click; Preview (if kept) is a separate explicit click loading only that one clip

## Phase 3 — Reliability

(TBD after Phase 1/2)

## Phase 4 — UI/UX

(TBD after Phase 1/2/3)
