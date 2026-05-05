# CMS Auction Suite — Build summary

All six phases complete. This doc captures what was actually built and the
reasoning behind decisions that diverged from the original plan.

## Phase 1 — Repo + shell + theme ✅

- Monorepo at `cms-auction-suite/`
- `netlify.toml` configured, publish dir `public/`
- Light theme tokens in `shared/theme.css` (matches Auction Tracker reference)
- Shell layout: dark sidebar (desktop), bottom nav (mobile)
- URL hash routing (`/#listings`, `/#banners`, etc.)

## Phase 2 — Drop in three apps as-is ✅

- Each app copied into its tab folder
- Brand bars stripped (suite shell owns them)
- Functional toolbars preserved
- All four tabs flipped to `ready: true`

## Phase 3 — Auth ✅

- Firebase Auth wired up (config in `shared/firebase-config.js`)
- Login / sign-up / pending-approval / sign-out screens
- Approval gate via `approved` custom claim
- PIN gates removed from banners (auto-unlock) and post-auction (skip auth page)
- "Demo mode" banner shown when Firebase not yet configured, so the suite is
  usable for design review before you set up the Firebase project

## Phase 4 — Light theme on Banners + Post-Auction ✅

Approach: **CSS variable override** rather than editing the apps' originals.
- `banners/light-theme.css` — re-points `--bg`, `--surface`, etc. to light values
- `post-auction/light-theme.css` — same, plus overrides for hardcoded `radial-gradient` blue glows
- Each app's original CSS is untouched. Override files are loaded last so values win.

This means: **if you ever want to revert to dark mode for one app, delete that
app's `light-theme.css` link and you're back where you started.**

## Phase 5 — Pre/Post split ✅

**The plan changed during build.** The original proposal was Option B —
extract PDF builder modules from `post-auction/app.js` into a shared
`/post-auction-engine/` and have Pre and Post tabs each import only what
they need. While planning the refactor I found that the original developer
had already organized the UI into clean sections marked with `data-section="pre"`,
`"post"`, `"contracts"`, `"summaries"`. This made a much safer approach possible:

**What was actually built**: One `post-auction/index.html`, two URLs.
- Pre tab loads `post-auction/index.html?mode=pre`
- Post tab loads `post-auction/index.html?mode=post`
- A small inline script in the head sets `<html data-mode="pre|post">`
- CSS in `light-theme.css` hides the irrelevant sections based on the data attribute
- The Generate button's existing logic correctly handles "only pre selected" or
  "only post selected" — no logic changes needed

**Why this beat the original plan:**
- Zero JS refactoring of 4,300 lines of working PDF code
- One source of truth — no risk of two copies of helpers drifting
- PDF outputs are byte-identical to before (same code path)
- Reverting is trivial — just remove the `?mode=` and you're back

`_legacy/` folder not needed because nothing was rewritten.

## Phase 6 — Cleanup + dedup ✅

What was NOT done, and why:
- **CSV parsers were not consolidated** across apps. Each app has its own
  inline parser. Replacing working parsers carries risk with no user-visible
  benefit. `shared/csv.js` exists for new code; old code stays as-is.
- **Lot-number parsers were not consolidated** for the same reason.

What WAS done:
- `shared/csv.js` created with canonical column names, helpers, and
  documentation pointing future code there
- `docs/TODO.md` lists every typo, hardcoded path, and dead-code block
  I noticed during the migration
- README updated to describe what's where

## Decisions locked in

| Decision               | Choice                                            |
|------------------------|---------------------------------------------------|
| Repo shape             | Monorepo, three folders + 4 tabs (Pre = mode=pre) |
| Hosting                | Netlify, deploys from GitHub `main`               |
| Auth                   | Firebase Auth, sign-up + manual approval claim    |
| Theme                  | Light, Auction Tracker reference                  |
| PDF generation         | Both `window.print()` and pdf-lib retained        |
| Persistent data        | None (apps stay CSV-in / file-out)                |
| Sub-app rendering      | Iframes inside shell                              |
| Pre/Post split         | URL parameter (`?mode=pre|post`) + CSS hide       |
| Suite name             | CMS Auction Suite                                 |
| Tab order              | Listings → Banners → Pre Auction → Post Auction   |
| Email visible to user  | No                                                |
| Typo handling          | Listed in TODO.md, not auto-fixed                 |
