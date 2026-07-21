/* =============================================================
 * CMS Country Market — Firestore adapter
 * -------------------------------------------------------------
 * Data layer for the Country Market app: the suite's Firebase
 * project (same login, same Firestore database as the rest of
 * the suite). Exposed as `window.CMSCountryDB` with the query
 * and auth API shape that app.js calls.
 *
 * Data lives in these Firestore collections:
 *   cmLots/{id}            lot documents (id = numeric, as string doc id)
 *   cmConsignors/{name}    consignor profiles (doc id = encoded name)
 *   cmSettings/{key}       key/value settings
 *   cmActivityLog/{id}     activity entries
 *   profiles/{uid}         user profile: role ('admin'|'rep'),
 *                          rep_name, full_name, email
 *
 * First sign-in bootstrap: if a user has no profile document,
 * one is created automatically — role 'admin' if the profiles
 * collection is empty (first user), otherwise 'rep'. Admins can
 * change roles from the app's Admin page afterwards.
 * ============================================================= */

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut as fbSignOut,
  onAuthStateChanged, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "../shared/firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const COLL = {
  lots: "cmLots",
  consignors: "cmConsignors",
  settings: "cmSettings",
  activity_log: "cmActivityLog",
  profiles: "profiles",
};

/* ---------- helpers ---------- */

const nowIso = () => new Date().toISOString();
const newNumericId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);
const nameToDocId = (name) => encodeURIComponent(String(name).trim());
const mapUser = (u) => (u ? { id: u.uid, email: u.email || "" } : null);
const errObj = (e) => ({ message: e?.message || String(e) });

// Resolves once Firebase has restored (or ruled out) a session
const authReady = new Promise((resolve) => {
  const un = onAuthStateChanged(auth, (u) => {
    un();
    resolve(u);
  });
});
let authResolved = false;
authReady.then(() => (authResolved = true));

async function ensureProfile(user) {
  const ref = doc(db, COLL.profiles, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  // First user in the system becomes admin; everyone after is a rep
  const all = await getDocs(collection(db, COLL.profiles));
  const role = all.empty ? "admin" : "rep";
  await setDoc(ref, {
    id: user.uid,
    email: user.email || "",
    full_name: (user.email || "").split("@")[0],
    rep_name: "",
    role,
    created_at: nowIso(),
  });
}

/* ---------- query builder (mimics the chains app.js uses) ---------- */

class Query {
  constructor(table) {
    this.table = table;
    this.op = "select";
    this.filters = [];   // [field, value]
    this.orderSpec = null;
    this.wantSingle = false;
    this.payload = null;
    this.upsertOpts = null;
  }
  select() { return this; }
  eq(field, value) { this.filters.push([field, value]); return this; }
  order(field, opts = {}) {
    this.orderSpec = { field, ascending: opts.ascending !== false };
    return this;
  }
  single() { this.wantSingle = true; return this; }
  insert(rows) { this.op = "insert"; this.payload = Array.isArray(rows) ? rows[0] : rows; return this; }
  update(changes) { this.op = "update"; this.payload = changes; return this; }
  upsert(row, opts) { this.op = "upsert"; this.payload = row; this.upsertOpts = opts || {}; return this; }
  delete() { this.op = "delete"; return this; }

  then(onFulfilled, onRejected) { return this._run().then(onFulfilled, onRejected); }

  async _run() {
    try {
      const collRef = collection(db, COLL[this.table] || this.table);
      switch (this.op) {
        case "select": {
          const snap = await getDocs(collRef);
          let rows = snap.docs.map((d) => d.data());
          for (const [f, v] of this.filters) rows = rows.filter((r) => r[f] === v);
          if (this.orderSpec) {
            const { field, ascending } = this.orderSpec;
            rows.sort((a, b) => {
              const av = a[field], bv = b[field];
              if (av == null && bv == null) return 0;
              if (av == null) return 1;
              if (bv == null) return -1;
              const cmp = av < bv ? -1 : av > bv ? 1 : 0;
              return ascending ? cmp : -cmp;
            });
          }
          if (this.wantSingle) {
            return rows.length
              ? { data: rows[0], error: null }
              : { data: null, error: { message: "No rows found" } };
          }
          return { data: rows, error: null };
        }
        case "insert": {
          const row = { ...this.payload };
          if (row.id === undefined) row.id = newNumericId();
          if (row.created_at === undefined) row.created_at = nowIso();
          if (this.table === "lots" && row.updated_at === undefined) row.updated_at = nowIso();
          await setDoc(doc(collRef, String(row.id)), row);
          return { data: this.wantSingle ? row : [row], error: null };
        }
        case "update": {
          const idFilter = this.filters.find(([f]) => f === "id");
          if (!idFilter) throw new Error("update requires .eq('id', …)");
          const ref = doc(collRef, String(idFilter[1]));
          await updateDoc(ref, { ...this.payload });
          if (this.wantSingle) {
            const snap = await getDoc(ref);
            return { data: snap.exists() ? snap.data() : null, error: null };
          }
          return { data: null, error: null };
        }
        case "upsert": {
          const row = { ...this.payload, updated_at: nowIso() };
          let docId;
          if (this.upsertOpts?.onConflict === "name") docId = nameToDocId(row.name);
          else if (this.upsertOpts?.onConflict === "key") docId = String(row.key);
          else docId = String(row.id ?? newNumericId());
          row.id = row.id ?? docId;
          const ref = doc(collRef, docId);
          const existing = await getDoc(ref);
          if (!existing.exists()) row.created_at = nowIso();
          await setDoc(ref, row, { merge: true });
          const snap = await getDoc(ref);
          return { data: this.wantSingle ? snap.data() : [snap.data()], error: null };
        }
        case "delete": {
          const idFilter = this.filters.find(([f]) => f === "id");
          if (!idFilter) throw new Error("delete requires .eq('id', …)");
          await deleteDoc(doc(collRef, String(idFilter[1])));
          return { data: null, error: null };
        }
        default:
          throw new Error("Unsupported operation: " + this.op);
      }
    } catch (e) {
      console.error("[firestore-adapter]", this.table, this.op, e);
      return { data: null, error: errObj(e) };
    }
  }
}

/* ---------- realtime channel (lots) ---------- */

class Channel {
  constructor() { this._cb = null; this._unsub = null; this._table = "lots"; }
  on(_type, filter, cb) {
    this._cb = cb;
    if (filter?.table) this._table = filter.table;
    return this;
  }
  subscribe() {
    let first = true; // Skip the initial snapshot — it replays all existing docs, which the app already loaded
    this._unsub = onSnapshot(
      collection(db, COLL[this._table] || this._table),
      (snap) => {
        if (first) { first = false; return; }
        for (const change of snap.docChanges()) {
          const data = change.doc.data();
          if (!this._cb) continue;
          if (change.type === "added") {
            this._cb({ eventType: "INSERT", new: data, old: null });
          } else if (change.type === "modified") {
            this._cb({ eventType: "UPDATE", new: data, old: null });
          } else if (change.type === "removed") {
            this._cb({ eventType: "DELETE", new: null, old: { id: data.id } });
          }
        }
      },
      (err) => console.warn("[firestore-adapter] realtime error:", err)
    );
    return this;
  }
  _teardown() { if (this._unsub) { this._unsub(); this._unsub = null; } }
}

/* ---------- the client shim ---------- */

const client = {
  auth: {
    async signInWithPassword({ email, password }) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await ensureProfile(cred.user);
        return { data: { user: mapUser(cred.user) }, error: null };
      } catch (e) {
        const friendly = /invalid-credential|wrong-password|user-not-found/.test(String(e?.code))
          ? "Invalid email or password"
          : e?.message || "Sign-in failed";
        return { data: { user: null }, error: { message: friendly } };
      }
    },
    async signOut() {
      try { await fbSignOut(auth); return { error: null }; }
      catch (e) { return { error: errObj(e) }; }
    },
    async getSession() {
      const user = authResolved ? auth.currentUser : await authReady;
      if (user) {
        try { await ensureProfile(user); } catch (e) { console.warn("[firestore-adapter] profile:", e); }
      }
      return { data: { session: user ? { user: mapUser(user) } : null } };
    },
    onAuthStateChange(cb) {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (u) cb("TOKEN_REFRESHED", { user: mapUser(u) });
        else cb("SIGNED_OUT", null);
      });
      return { data: { subscription: { unsubscribe } } };
    },
    async resetPasswordForEmail(email, _opts) {
      try { await sendPasswordResetEmail(auth, email); return { data: {}, error: null }; }
      catch (e) { return { data: null, error: errObj(e) }; }
    },
  },
  from(table) { return new Query(table); },
  channel(_name) { return new Channel(); },
  removeChannel(ch) { try { ch?._teardown(); } catch (e) { /* noop */ } },
};

// Expose the client for app.js
window.CMSCountryDB = client;
