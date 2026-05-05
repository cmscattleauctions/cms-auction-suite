# TODO Registry — typos, dead code, and oddities

This is a list of small issues I noticed while building the suite but
did not fix because:
- You said "flag and ask first" for typos
- Fixing some of them would break things in production
- They're not blocking anything

You can review and decide what to clean up later.

## Typos in the Banner Generator

The names `'Charloais Transition'` and `'Hosltein Transition'` appear in
multiple places. These should presumably be `Charolais` and `Holstein`.

**Locations:**

- `banners/index.html:1013` — string returned by breed-transition matcher
- `banners/index.html:1015` — string returned by breed-transition matcher
- `banners/index.html:1209` — array of valid transition scene names
- `banners/index.html:1347` — array used when building OBS scene collection
- `banners/template.json:511`   — OBS scene name
- `banners/template.json:739`   — OBS scene name
- `banners/template.json:17968` — OBS scene name (referenced by another scene)
- `banners/template.json:18552` — OBS scene name (referenced by another scene)

**⚠️ DO NOT silently fix these.** If anyone has imported the OBS template
into their existing OBS setup, their scene collection contains scenes named
`Charloais Transition` and `Hosltein Transition`. Fixing the code without
re-importing the template would break their show: the code would look for
scenes named `Charolais` / `Holstein` that don't exist in OBS.

**Recommended fix:** in a single coordinated change, fix both the code AND
the template, then have the user re-import the template into OBS. Possibly
also rename matching scenes in their existing OBS scene collection.

## Dead code

### `post-auction/styles.css` (258 lines, completely unreferenced)

The post-auction app's `index.html` only uses an inline `<style>` block —
the external `styles.css` file is never linked. It's an old version of the
design that got replaced when the inline "Premium Dark Theme" was added.
Safe to delete. I left it alone because deleting working files mid-migration
is the kind of change that creates needle-in-haystack bugs.

### `post-auction/app.js:8` — `PIN: "0623"`

The post-auction app's `CONFIG.PIN` constant is no longer read by anything
(the auth gate that used it is bypassed in Phase 3). Safe to delete the
line, or leave as a future-reminder of the old gate.

### `banners/index.html:393` — `const ADMIN_PIN = '0623'`

Same situation. The PIN constant isn't read anymore — `unlockAdmin()` is
called directly on init.

### Unused PIN session-storage key

`banners/index.html:398` defines `PIN_KEY = 'cms_admin_pin_ok_v1'`. Still
referenced in `lockAdmin()` (called nowhere visible) and in the (gated-off)
`checkAdminPin()`. Delete-able when you remove the gate HTML.

## Hardcoded paths

### `banners/index.html:402`
```js
const DROPBOX_BANNER_PATH = '/Users/brysonmurray/Library/CloudStorage/Dropbox/Auction OBS/Lot Banners/';
```
This is one specific person's machine. The path is used in OBS scene-source
file references the generator writes into the OBS scene collection JSON.
Anyone else running the banner generator and importing the result into OBS
on a different machine will see broken file references.

**Recommended:** make this configurable in the UI, or detect the OBS-default
location, or document that this is single-machine and have non-Bryson users
edit the path themselves before downloading.

## Cosmetic things I noticed but didn't touch

- The Listings app has a default subtitle of "April DairyX, Holstein and
  Native Auction" baked into the input fields. Fine for now since it's
  user-editable, but a less date-locked default might be cleaner.
- The banner generator's `ALPS_BANNER_PATH` (or the variable referenced in
  the OBS export) and the breed-transition strings are interrelated; any
  rename should be coordinated.
- The post-auction app's main heading is "CMS Auction Reporting" which
  doesn't match the suite naming. The mode-filter rewrites it on load to
  "Pre Auction Files" / "Post Auction Files" so this is moot inside the
  suite, but if anyone hits the URL directly without `?mode=` they'll see
  the original name.
