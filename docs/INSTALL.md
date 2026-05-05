# Install Guide — CMS Auction Suite

End-to-end setup, from zip → live deployed app with working logins.

Estimated time: **30–45 minutes** for someone who's done a Firebase project
before. **60–90 minutes** if it's your first time with Firebase.

---

## What you'll do, in order

1. Create a GitHub repository for the suite
2. Push the code to it
3. Create a Firebase project and get its config values
4. Plug those values into `shared/firebase-config.js`
5. Push the change
6. Hook the GitHub repo up to Netlify
7. Wait for first deploy
8. Sign yourself up through the live app
9. Approve your own account in Firebase
10. Sign in for real

---

## Step 1 — Create the GitHub repo

1. Go to <https://github.com/new>
2. Repository name: `cms-auction-suite` (or whatever you want)
3. **Private** is recommended (the code references your business setup,
   even though it's nothing secret).
4. Don't check "Initialize with README" — the zip already has one.
5. Click **Create repository**.
6. GitHub will show you instructions for "...or push an existing repository
   from the command line." Keep that page open — you'll need the URL it
   gives you, which looks like `https://github.com/YOU/cms-auction-suite.git`.

---

## Step 2 — Push the code

In a terminal, from wherever you unzipped this:

```bash
cd cms-auction-suite

git init
git add .
git commit -m "Initial commit — CMS Auction Suite"
git branch -M main
git remote add origin https://github.com/YOU/cms-auction-suite.git
git push -u origin main
```

Refresh the GitHub page — the files should be there.

---

## Step 3 — Create the Firebase project

1. Go to <https://console.firebase.google.com>
2. Click **Add project** (or **Create a project**).
3. Project name: `cms-auction-suite` (or whatever — doesn't have to match
   the repo name).
4. **Disable Google Analytics** when it asks. You don't need it; it adds
   complexity. (You can always add it later.)
5. Click **Create project**, wait ~30 seconds, click **Continue**.

### 3a — Enable Email/Password authentication

1. Left sidebar → **Build → Authentication**.
2. Click **Get started**.
3. **Sign-in method** tab → **Email/Password**.
4. Toggle **Enable** ON for the first option (Email/Password). Leave
   "Email link (passwordless sign-in)" off.
5. Click **Save**.

### 3b — Add a Web App and grab the config

1. Project overview (home icon top-left) → click the **`</>`** Web icon
   ("Add app" → web platform).
2. App nickname: `Suite Web`. **Don't** check "Also set up Firebase Hosting"
   — we're using Netlify.
3. Click **Register app**.
4. Firebase shows you a code block that includes a `firebaseConfig` object
   with values like `apiKey`, `authDomain`, `projectId`, etc.
5. **Copy that whole config object somewhere safe** — you'll paste it into
   the next step.
6. Click **Continue to console**.

> **Heads-up about these values**: `apiKey` and friends look like secrets
> but they're not. Firebase explicitly publishes them in the client. Real
> security comes from (a) the auth approval gate we built and (b) Firebase
> auth domain restrictions. Don't post them on Twitter, but don't panic
> if they end up in your repo — they're meant to be there.

### 3c — Restrict the API key (recommended, optional for now)

This isn't strictly required but reduces abuse potential. You can skip it
on first install and come back later.

1. Open <https://console.cloud.google.com/apis/credentials>
   (same Google account as Firebase).
2. Pick the right project from the project dropdown at the top.
3. Find the **Browser key (auto created by Firebase)**, click it.
4. Under **Application restrictions** → **HTTP referrers (websites)**.
5. Add referrers:
   - `https://YOUR-NETLIFY-SITE.netlify.app/*`
   - `https://YOUR-CUSTOM-DOMAIN/*` (if you have one)
   - `http://localhost:8000/*` (so local dev still works)
6. Save.

---

## Step 4 — Plug Firebase values into the code

Open `public/shared/firebase-config.js`. It looks like this:

```js
export const firebaseConfig = {
  apiKey:            "REPLACE_ME_API_KEY",
  authDomain:        "REPLACE_ME.firebaseapp.com",
  projectId:         "REPLACE_ME_PROJECT_ID",
  storageBucket:     "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME_SENDER_ID",
  appId:             "REPLACE_ME_APP_ID",
};

export const FIREBASE_CONFIGURED = false;
```

Two changes:

1. Replace each `REPLACE_ME_*` value with the corresponding value from the
   Firebase config you copied in step 3b.
2. Change `FIREBASE_CONFIGURED = false` to `FIREBASE_CONFIGURED = true`.

Save the file.

---

## Step 5 — Push the change

```bash
git add public/shared/firebase-config.js
git commit -m "Wire up Firebase config"
git push
```

---

## Step 6 — Connect the repo to Netlify

If you have a Netlify site already that you want to point at this repo:

1. Netlify dashboard → that site → **Site configuration → Build & deploy
   → Continuous deployment**.
2. **Link site to Git** (or change the linked repo).
3. Pick GitHub, authorize if needed, choose `cms-auction-suite`.
4. **Build settings**:
   - Branch to deploy: `main`
   - Build command: *(leave empty)*
   - Publish directory: `public`
5. Click **Deploy site**.

If you want a fresh Netlify site:

1. Netlify dashboard → **Add new site → Import an existing project**.
2. Pick GitHub, authorize, choose `cms-auction-suite`.
3. Same build settings as above.
4. Click **Deploy**.

Either way, Netlify also reads `netlify.toml` from the repo, which
already specifies the right publish directory and the SPA-style
fallback for hash routes — so you don't have to enter those manually,
but it doesn't hurt to confirm.

---

## Step 7 — Wait for the deploy

Watch the Netlify build log. First deploy is usually 20–60 seconds since
there's no actual build step (Netlify just publishes `public/` as-is).

When it says **Published**, click the live URL.

You should see the **CMS Auction Suite login screen** — warm off-white
background, dark sidebar mark, "Sign in" form.

If you instead see a yellow demo-mode banner across the top, your
`firebase-config.js` change didn't get pushed — go back to Step 5.

---

## Step 8 — Sign yourself up

1. On the login screen, click **Request access**.
2. Enter your email and a password (6+ characters).
3. Click **Create account**.

You should land on a **"Awaiting approval"** screen with a clock icon and
your email in a code-style pill below it. That's expected.

---

## Step 9 — Approve yourself in Firebase

The new account exists in Firebase, but doesn't have the `approved` claim
yet. There are two ways to set it.

### Option A — One-line script (recommended, takes ~3 minutes)

This is faster than the manual Console approach and gives you a script
you can use forever for future user approvals.

Open a terminal **anywhere** (this runs locally, not in your repo):

```bash
mkdir -p ~/firebase-admin && cd ~/firebase-admin
npm init -y
npm install firebase-admin
```

Now you need a service-account key so the script can authenticate as an
admin to your Firebase project.

1. Firebase Console → ⚙️ next to "Project Overview" → **Project settings**.
2. **Service accounts** tab.
3. Click **Generate new private key** → **Generate key**.
4. A JSON file downloads. Move it to `~/firebase-admin/service-account.json`.
5. **Keep this file private** — it gives full admin access to your project.
   Don't commit it to git, don't share it.

Create a file `approve.js`:

```js
// approve.js — set the `approved` claim on a user.
// Usage:  node approve.js [email protected]

const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./service-account.json'))
});

const email = process.argv[2];
if (!email) { console.error('Usage: node approve.js <email>'); process.exit(1); }

admin.auth().getUserByEmail(email)
  .then(u => admin.auth().setCustomUserClaims(u.uid, { approved: true }))
  .then(() => console.log(`✓ Approved ${email}`))
  .catch(e => { console.error('✗', e.message); process.exit(1); });
```

Now approve yourself:

```bash
node approve.js [email protected]
```

You should see `✓ Approved [email protected]`.

### Option B — Manual via Firebase Console (no scripts)

Firebase Console doesn't have a UI for setting custom claims. You'd need
to use the Cloud Functions or Cloud Shell. **If you don't already use
those, just go with Option A** — it's actually simpler.

---

## Step 10 — Sign in for real

Go back to your live Netlify URL. The "Awaiting approval" screen should
still be open from before. Click **"I've been approved — refresh"**.

You should now see the **full suite** — dark sidebar with four tabs,
warm canvas, the Listings tab loaded by default.

Click each tab and confirm:

- **Listings** — the Listing Builder loads. Try uploading a test CSV.
- **Banners** — should be in light theme now (was dark before). Should
  go straight to the Builder/State Library tabs without a PIN prompt.
- **Pre Auction** — loads the post-auction app, but only shows the
  "Pre-Auction Outputs" section.
- **Post Auction** — loads the post-auction app with all sections except
  Pre-Auction visible.

---

## Approving more users later

Anyone can hit your URL and sign up. They'll create an account and land
on the "Awaiting approval" screen. Their account exists in Firebase but
they can't get past the gate.

To approve them:

```bash
cd ~/firebase-admin
node approve.js [email protected]
```

Tell them to refresh the page. They're in.

You can also see all signed-up users in **Firebase Console → Authentication
→ Users**. The list shows every email; people who have created accounts but
aren't yet approved are visible there too.

To **revoke** approval, change the `approve.js` script:

```js
.then(u => admin.auth().setCustomUserClaims(u.uid, { approved: false }))
```

Or delete the user entirely from the Firebase Console Users tab.

---

## Troubleshooting

**The login screen says "Email or password is incorrect" but I'm sure they're right.**
You may not have an account yet. Use the "Request access" link to create one.

**I signed up, but never see the "Awaiting approval" screen — I'm dropped back to login.**
Check the browser console for errors. Most likely Firebase isn't actually
reachable from your domain. In Firebase Console → Authentication →
**Settings** → **Authorized domains**, make sure your Netlify URL is listed
(it should be auto-added, but verify).

**I approved a user but they still see "Awaiting approval".**
The token claim is cached on their device for up to 1 hour by default,
but our code force-refreshes it on every check, so a hard refresh
(Ctrl/Cmd-Shift-R) should pick it up immediately. If it doesn't, have them
sign out and back in.

**Yellow demo-mode banner is showing on my live site.**
`FIREBASE_CONFIGURED` is still `false` in `firebase-config.js`. Edit, push,
let Netlify redeploy.

**The post-auction app shows the old dark theme.**
Hard refresh (Ctrl/Cmd-Shift-R). The browser is caching the old CSS. If
that doesn't fix it, check Netlify's deploy log to make sure the latest
commit deployed successfully.

**A tab loads but the iframe is blank / shows a loading spinner forever.**
Open the iframe URL directly (e.g. visit `https://your-site.netlify.app/listings/`).
If the page errors there too, check browser console for the actual error.
Most likely cause: a path mismatch in the original app's relative URLs.

---

## What to leave alone

- **`docs/TODO.md`** lists known typos in the banner generator (`Charloais`,
  `Hosltein`). **Do not silently fix these.** They match scene names
  in the OBS template, and fixing them in the code without updating OBS
  configurations would break the live show. Read the TODO file before
  making any changes there.

- **The `_legacy/` folder doesn't exist** — Phase 5 didn't need it because
  no code was rewritten, just URL-parameterized.

- **Each app's iframe is isolated.** If you want to change something inside
  one app, edit the files in that app's folder. Cross-app changes go in
  `shared/`.
