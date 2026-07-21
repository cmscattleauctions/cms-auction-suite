# CMS Auction Suite

Internal toolset for CMS Livestock Auction. Combines three previously
separate apps behind one shell with a single Firebase login.

## What's inside

| Tab | URL | What it does |
|-----|-----|--------------|
| **Listings** | `/#listings` | Build the auction master listing PDF from a CSV |
| **Lot #'s** | `/#lot-numbers` | Upload a working CSV and auto-assign lot numbers by auction month, with A/B/C option-lot handling |
| **Lot Images** | `/#lot-images` | Upload a working CSV → get a named image per lot (real video frames, not the logo thumbnail) + manifest CSV |
| **Banners** | `/#banners` | Generate OBS scene banners + scene collection from a working CSV |
| **Country Market** | `/#country-market` | CMS Country Page Manager — CSV lot import, lot management, Country Page template export with images. Runs on the suite Firebase/Firestore backend with the same login. |
| **Pre Auction** | `/#pre-auction` | Pre-auction listing confirmations + condensed listings |
| **Post Auction** | `/#post-auction` | Sales contracts, summaries, recaps |

Pre and Post Auction tabs both load the same underlying app
(`post-auction/index.html`) with different `?mode=` query params, which
hide the sections that don't apply.

## Stack

- Vanilla HTML / CSS / JS, no build step
- ES modules for the shell + auth code
- Firebase Auth (email + password) with manual approval via custom claim
- **Cloud Firestore** for shared saved data — listing projects, banner
  state images, and builder settings (see `shared/cms-data.js`)
- Hosted on Netlify, deployed from GitHub on push to `main`

## Shared data (Firestore)

`shared/cms-data.js` is a small ES module (exposed as `window.CMSData`)
that both the Listings and Banners apps use to read and write shared data,
so the whole team sees the same thing:

| Collection | Holds |
|------------|-------|
| `listingProjects/{id}` | Saved listing builds — name + full builder state. Anyone can open, edit, and re-save a teammate's listing. |
| `stateImages/{ABBR}` | Banner state images (PNG/SVG), stored as compressed data URLs. Uploaded straight from the Banners admin — no GitHub token. |
| `appSettings/{key}` | Listing builder settings/defaults. |

State images are kept in Firestore (not Firebase Storage) as data URLs;
large PNGs are downscaled to fit under the 1 MB document limit. This keeps
canvas exports from tainting and means there's no bucket/CORS setup. See
`docs/INSTALL.md` steps 3d–3e for enabling Firestore and the security rules.

## File layout

```
cms-auction-suite/
├── README.md
├── netlify.toml
├── .gitignore
├── .env.example                      ← Firebase config template
├── docs/
│   ├── PHASES.md                     ← what was built and why
│   └── TODO.md                       ← typos, dead code, future cleanup
└── public/                           ← Netlify publish directory
    ├── index.html                    ← shell entry
    ├── favicon.svg
    ├── shared/
    │   ├── theme.css                 ← light theme design tokens
    │   ├── shell.css                 ← sidebar + content layout
    │   ├── shell.js                  ← tab routing, auth gate (ES module)
    │   ├── auth.css                  ← login/signup/pending screens
    │   ├── auth.js                   ← Firebase Auth wrapper
    │   ├── auth-ui.js                ← renders auth screens
    │   ├── firebase-config.js        ← YOUR Firebase keys go here
    │   ├── cms-data.js               ← shared Firestore data layer (window.CMSData)
    │   └── csv.js                    ← shared CSV utilities (for new code)
    ├── listings/                     ← Listing Builder
    ├── banners/                      ← Banner Generator (with light-theme.css)
    └── post-auction/                 ← Post-Auction Portal (with light-theme.css)
```

## Local development

```bash
cd public
python3 -m http.server 8000
# open http://localhost:8000
```

Without Firebase configured, the app runs in **demo mode** — all auth
screens render but nothing actually authenticates, and a yellow banner
across the top reminds you to set values in `shared/firebase-config.js`.

## Deployment

Netlify reads `netlify.toml`. Push to `main`, deploy happens automatically.

See `docs/PHASES.md` for the full build history and `docs/TODO.md` for
known issues and small cleanup opportunities.

For the full first-time install (creating the Firebase project, deploying
to Netlify, approving the first user), see `docs/INSTALL.md`.
