# Netlify Functions — environment variables

Functions here run server-side only (Netlify's Node runtime), so this is
the one place in the project allowed to hold real secrets — nothing in
`public/` should ever reference a token directly, since everything under
`public/` ships to the browser.

## Setting a variable

**Deployed (Netlify dashboard):** Site settings → Environment variables →
Add a variable. It becomes available to every function as
`process.env.THE_NAME`.

**Local (`netlify dev`):** create a `.env` file at the **repo root**
(already gitignored — see `.gitignore`) with lines like:

```
MONDAY_API_TOKEN=paste-the-real-token-here
```

`netlify dev` reads `.env` from the site's base directory, not from
inside `netlify/functions/` — confirmed by testing both locations.

Never commit this file, never paste a real token into a commit message,
PR description, or code comment, and never `console.log` a token or any
header that carries one — if a function needs to prove auth worked, log
success/failure and a truncated fingerprint (last 4 chars) at most, never
the full value.

## Current variables

| Variable | Used by | Purpose |
|---|---|---|
| `MONDAY_API_TOKEN` | `monday-migration-test.mjs` | Monday.com GraphQL API v2 token for the read-only migration test (see that file's header comment) |
