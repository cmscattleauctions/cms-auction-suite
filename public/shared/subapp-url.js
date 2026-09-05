/* =============================================================
 * CMS Auction Suite — Sub-app deep-linking
 * -------------------------------------------------------------
 * Sub-apps run inside the shell's iframe with a fixed `src`, so on a
 * page reload the shell rebuilds the iframe from scratch — any
 * internal navigation state a sub-app was tracking on its own (which
 * status tab, which sub-page) is lost, and the sub-app reopens on
 * whatever it treats as its hardcoded default. That's the "refresh
 * throws me into a different tab" bug this exists to fix.
 *
 * The fix is a small two-way contract with the shell (shell.js):
 *   - readInitialRoute() — call once on boot to recover whatever
 *     route the shell was handed at load time (from the URL), so you
 *     can restore state before your first render instead of after.
 *   - reportRoute(route) — call whenever your internal nav state
 *     changes; the shell mirrors it into the outer URL as
 *     "#<tab>/<route>" so a later reload can hand it back via
 *     readInitialRoute().
 *
 * `route` is just a string — this file doesn't parse it. Keep it to
 * one simple token (a tab id, a view mode) unless you need more;
 * anything more structured is on you to encode/decode.
 * ============================================================= */

const NS = 'cms-subapp-route';

/** Call once on boot, before your first render, to recover the route
 *  the shell handed this iframe at load time. Returns null if there
 *  wasn't one (fresh visit, or this page opened outside the shell). */
export function readInitialRoute() {
  try {
    return new URLSearchParams(window.location.search).get('route');
  } catch {
    return null;
  }
}

/** Call whenever your internal nav state changes, so a later reload
 *  can restore it. No-op if this page isn't running inside the shell
 *  (e.g. opened directly for local testing). */
export function reportRoute(route) {
  try {
    if (window.parent === window) return; // not in an iframe
    window.parent.postMessage({ ns: NS, route: route || null }, window.location.origin);
  } catch {
    /* opened cross-origin/standalone — nothing to report to */
  }
}
