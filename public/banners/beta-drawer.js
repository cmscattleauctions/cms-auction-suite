/* =============================================================
 * Banners — shared right-side drawer primitive
 * -------------------------------------------------------------
 * Used by both a classic (non-module) script — State Images, via
 * window.CMSDrawer — and Beta ES modules — Verification Tags, via a
 * direct import. Lives at public/banners/ (not under beta/) since
 * it's shared across both, mirroring the window.CMSBetaHooks bridge
 * pattern index.html already uses for Classic<->Beta calls.
 *
 * Deliberately minimal: this owns only open/close/title/body-inject.
 * All form markup and wiring belongs to the caller — grab elements
 * off the returned body element and wire them yourself. Not a
 * generic form-builder; sized to exactly its 2-3 current uses.
 *
 * CSS lives in index.html's inline <style> block (the app's one
 * canonical component-CSS location) since this same document hosts
 * both the classic script and every ES module here.
 * ============================================================= */

let backdrop = null;
let panel = null;
let titleEl = null;
let bodyEl = null;
let currentOnClose = null;

function ensureDom() {
  if (panel) return;
  backdrop = document.createElement('div');
  backdrop.id = 'cmsDrawerBackdrop';
  backdrop.className = 'drawer-backdrop';

  panel = document.createElement('aside');
  panel.id = 'cmsDrawer';
  panel.className = 'drawer-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="drawer-header">
      <h3 id="cmsDrawerTitle"></h3>
      <button type="button" id="cmsDrawerClose" class="drawer-close" aria-label="Close">&times;</button>
    </div>
    <div id="cmsDrawerBody" class="drawer-body"></div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  titleEl = panel.querySelector('#cmsDrawerTitle');
  bodyEl = panel.querySelector('#cmsDrawerBody');

  backdrop.addEventListener('click', closeDrawer);
  panel.querySelector('#cmsDrawerClose').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.classList.contains('open')) closeDrawer();
  });
}

/**
 * @param opts.title     drawer heading text
 * @param opts.bodyHtml   inner HTML for the drawer body — caller wires its
 *                        own inputs/buttons via the returned element
 * @param opts.onClose    optional callback fired whenever the drawer closes
 *                        (backdrop click, Escape, close button, or a caller
 *                        explicitly calling closeDrawer() after Save)
 * @returns the drawer's body element, for the caller to query/wire
 */
export function openDrawer({ title, bodyHtml, onClose } = {}) {
  ensureDom();
  titleEl.textContent = title || '';
  bodyEl.innerHTML = bodyHtml || '';
  currentOnClose = onClose || null;
  backdrop.classList.add('open');
  panel.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  return bodyEl;
}

export function closeDrawer() {
  if (!panel) return;
  backdrop.classList.remove('open');
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  const cb = currentOnClose;
  currentOnClose = null;
  if (cb) cb();
}

// Bridge for the classic (non-module) script — State Images — mirroring
// window.CMSBetaHooks' existing pattern for Classic<->Beta calls.
window.CMSDrawer = { openDrawer, closeDrawer };
