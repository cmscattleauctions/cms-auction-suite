# Hardening checklist — security / performance / reliability / UI-UX

Working doc for the multi-phase hardening pass. Each item: finding →
what was verified against current code → what was implemented →
how it was verified → any remaining dependency (e.g. a deploy step
that needs your credentials, or a decision only you can make).

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` needs your input

## Phase 1 — Security

- [x] 1. Monday migration endpoint exposure — see detail below
- [ ] 2. Country Market role escalation (self-assigned admin)
- [ ] 3. Firebase authorization (allowedTabs, Country Market rules)
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

## Phase 2 — Performance

- [ ] Video/clip downloads must never happen on browse/Grid/clip-list open — only on explicit Download click; Preview (if kept) is a separate explicit click loading only that one clip

## Phase 3 — Reliability

(TBD after Phase 1/2)

## Phase 4 — UI/UX

(TBD after Phase 1/2/3)
