# Country Market tab — setup (Firestore)

The Country Market tab runs entirely on the suite's Firebase project —
same login accounts, same Firestore database as the rest of the suite.
No Supabase, no second backend, no extra services.

## Data

Everything lives in these Firestore collections (created automatically
as you use the app — nothing to pre-create):

| Collection | Holds |
|------------|-------|
| `cmLots/{id}` | Country market lots |
| `cmConsignors/{name}` | Consignor profiles (breeds, sexes, locations, etc.) |
| `cmSettings/{key}` | App settings (sale types, categories, company info) |
| `cmActivityLog/{id}` | Per-lot activity history |
| `profiles/{uid}` | Country Market role per user: `admin` or `rep` |

## Sign-in and roles

Users sign in to the Country Market tab with their **existing suite
Firebase account** (same email + password as the shell login).

First-user bootstrap: the **first person to sign in gets the `admin`
role automatically**; everyone after that starts as `rep`. Admins can
change anyone's role from the app's Admin page. So: sign in yourself
first, then invite the team.

## Security rules

Append this inside your existing `match /databases/{database}/documents`
block in Firestore rules (Console → Firestore Database → Rules). It uses
the same `approved` gate as the rest of the suite:

```
// ── Country Market ─────────────────────────────────────────
function cmApproved() {
  return request.auth != null && (
    request.auth.token.approved == true ||
    (exists(/databases/$(database)/documents/users/$(request.auth.uid))
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true)
  );
}
function cmIsAdmin() {
  return exists(/databases/$(database)/documents/profiles/$(request.auth.uid))
    && get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role == 'admin';
}

match /cmLots/{id}        { allow read, write: if cmApproved(); }
match /cmConsignors/{id}  { allow read: if cmApproved(); allow write: if cmApproved() && cmIsAdmin(); }
match /cmSettings/{id}    { allow read: if cmApproved(); allow write: if cmApproved() && cmIsAdmin(); }
match /cmActivityLog/{id} { allow read, write: if cmApproved(); }
match /profiles/{uid} {
  // Anyone approved can read; you can create your own profile
  // (first-login bootstrap); only admins can edit roles.
  allow read: if cmApproved();
  allow create: if cmApproved() && request.auth.uid == uid;
  allow update: if cmApproved() && cmIsAdmin();
}
```

## Country Page export reminder

The "Country Page CSV + Images" export pulls lot images through the
suite's `/api/thumb` Netlify function, so it works on the deployed site
(or `netlify dev` locally), not on a plain local file server.
