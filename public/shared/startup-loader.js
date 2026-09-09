/* =============================================================
 * CMS Auction Suite — Startup loading screen controller
 * -------------------------------------------------------------
 * Full-screen branded overlay for the one moment this really
 * matters: initial app load, while auth state (and, for an
 * approved session, the profile fetch renderShell() needs) is
 * still resolving. Not used for in-app navigation — see
 * shared/skeleton.js for that.
 *
 * Usage (shell.js's boot()):
 *   const loader = showStartupLoader();
 *   ... await whatever "essential initialization" means here ...
 *   dismissStartupLoader(loader);      // success — fades out over ~250ms
 *   // or, on a genuine failure:
 *   showStartupLoaderError(loader, message, onRetry);
 * ============================================================= */

const LOGO_SRC = 'shared/assets/cms-auction-suite-logo.png';

export function showStartupLoader() {
  const el = document.createElement('div');
  el.className = 'startup-loader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = `
    <div class="startup-loader-shape startup-loader-shape--tl" aria-hidden="true"></div>
    <div class="startup-loader-shape startup-loader-shape--tr" aria-hidden="true"></div>
    <div class="startup-loader-shape startup-loader-shape--bl" aria-hidden="true"></div>
    <div class="startup-loader-shape startup-loader-shape--br" aria-hidden="true"></div>
    <div class="startup-loader-content">
      <img class="startup-loader-logo" src="${LOGO_SRC}" alt="CMS Auction Suite" />
      <div class="startup-loader-track" aria-hidden="true"><div class="startup-loader-track-fill"></div></div>
      <div class="startup-loader-status">Loading your workspace&hellip;</div>
      <div class="startup-loader-error">
        <div class="startup-loader-error-message"></div>
        <button type="button" class="startup-loader-retry-btn">Retry</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // Nothing #root builds while still hidden behind this overlay should
  // be reachable by keyboard or a screen reader until the overlay is
  // actually gone — z-index alone hides it visually but doesn't remove
  // it from the tab order or accessibility tree.
  const root = document.getElementById('root');
  if (root) root.inert = true;

  return el;
}

/** Success path — fade out over ~250ms, then remove entirely. */
export function dismissStartupLoader(el) {
  if (!el || !el.isConnected) return;
  const root = document.getElementById('root');
  if (root) root.inert = false;

  el.setAttribute('aria-busy', 'false');
  el.classList.add('startup-loader-hide');
  const remove = () => el.remove();
  el.addEventListener('transitionend', remove, { once: true });
  // Fallback in case the transition never fires (e.g. the element was
  // already display:none via some other path, or reduced-motion
  // shortened the transition to ~0 and the event races the removal).
  setTimeout(remove, 400);
}

/**
 * A genuine startup failure (resolveAuthState()/getMyProfile() etc.
 * throwing) previously had no handling at all here — boot() would
 * just leave whatever was on screen hanging with an unhandled
 * rejection. Since this overlay now owns that moment, it owns
 * surfacing the failure too, with the one thing a stuck full-screen
 * loader absolutely needs: a way out.
 */
export function showStartupLoaderError(el, message, onRetry) {
  if (!el) return;
  el.setAttribute('aria-busy', 'false');
  el.classList.add('startup-loader-error-state');
  const msgEl = el.querySelector('.startup-loader-error-message');
  if (msgEl) msgEl.textContent = message || "Couldn't load — check your connection and try again.";
  const btn = el.querySelector('.startup-loader-retry-btn');
  if (btn) btn.addEventListener('click', () => {
    // Remove this element outright rather than resetting it in place —
    // the caller's retry path (shell.js's boot()) creates its own
    // fresh loader via showStartupLoader() on every call, so leaving
    // this one behind would stack two overlays instead of one.
    const root = document.getElementById('root');
    if (root) root.inert = false;
    el.remove();
    onRetry();
  }, { once: true });
}
