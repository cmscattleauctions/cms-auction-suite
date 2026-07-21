/* =============================================================
 * CMS Auction Suite — Shell controller
 * -------------------------------------------------------------
 * Owns:
 *   - Auth gate (login → pending → approved)
 *   - Tab state (which app is active)
 *   - URL hash sync
 *   - Iframe loading of sub-apps
 *   - Sign-out
 *
 * Boot sequence:
 *   1. Show loading state
 *   2. Resolve auth state from Firebase
 *   3a. signed-out → render login screen
 *   3b. pending    → render pending screen
 *   3c. approved   → render full shell
 *   3d. demo       → render full shell with demo banner (no real auth)
 * ============================================================= */

import * as Auth   from './auth.js';
import * as AuthUI from './auth-ui.js';
import { FIREBASE_CONFIGURED } from './firebase-config.js';

const TABS = [
  { id: 'listings',     label: 'Listings',     src: './listings/index.html',                ready: true },
  { id: 'lot-images',   label: 'Lot Images',   src: './lot-images/index.html',              ready: true },
  { id: 'banners',      label: 'Banners',      src: './banners/index.html',                 ready: true },
  { id: 'pre-auction',  label: 'Pre Auction',  src: './post-auction/index.html?mode=pre',   ready: true },
  { id: 'post-auction', label: 'Post Auction', src: './post-auction/index.html?mode=post',  ready: true },
];

const DEFAULT_TAB = 'listings';

let activeTabId = null;

/* =============================================================
 * Boot
 * ============================================================= */

async function boot() {
  const root = document.getElementById('root');
  root.innerHTML = `<div class="auth-loading">Loading…</div>`;

  const result = await Auth.resolveAuthState();

  if (result.state === 'signed-out') {
    showLogin(root);
  } else if (result.state === 'pending') {
    AuthUI.renderPending(root, {
      user: result.user,
      onSignOut: () => showLogin(root),
    });
  } else {
    // 'approved' or 'demo'
    renderShell(root);
  }
}

function showLogin(root) {
  AuthUI.renderLogin(root, {
    onSuccess: () => boot(),
    onSwitchToSignup: () => {
      AuthUI.renderSignup(root, {
        onSuccess: () => boot(),
        onSwitchToLogin: () => showLogin(root),
      });
    }
  });
}

/* =============================================================
 * Shell rendering
 * ============================================================= */

function renderShell(root) {
  const demoBanner = FIREBASE_CONFIGURED ? '' : `
    <div class="demo-banner no-print">
      Demo mode — Firebase not configured. Set values in
      <code>shared/firebase-config.js</code> to enable real auth.
    </div>`;

  root.innerHTML = `
    ${demoBanner}
    <header class="mobile-topbar">
      <div class="sidebar-brand" style="padding:0;border:0;">
        <span class="sidebar-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 L21 19 L3 19 Z"/></svg>
        </span>
        <span class="sidebar-brand-text">CMS Auction Suite</span>
      </div>
      <button class="signout-btn" type="button" data-signout>Sign out</button>
    </header>

    <div class="shell">
      <aside class="sidebar" aria-label="Primary navigation">
        <div class="sidebar-brand">
          <span class="sidebar-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 L21 19 L3 19 Z"/></svg>
          </span>
          <span class="sidebar-brand-text">CMS Auction Suite</span>
        </div>

        <nav class="sidebar-nav" id="sidebar-nav" aria-label="App tabs"></nav>

        <div class="sidebar-user">
          <div class="user-pill">
            <span class="user-dot" aria-hidden="true"></span>
            <span>Signed in</span>
          </div>
          <button class="signout-btn" type="button" data-signout>Sign out</button>
        </div>
      </aside>

      <main class="content" id="content"></main>
    </div>
  `;

  renderNav();
  wireSignOut();

  const hashTab = location.hash.replace(/^#/, '');
  const initial = TABS.some(t => t.id === hashTab) ? hashTab : DEFAULT_TAB;
  selectTab(initial);

  window.addEventListener('hashchange', () => {
    const hashTab = location.hash.replace(/^#/, '');
    if (hashTab && hashTab !== activeTabId) selectTab(hashTab);
  });
}

function renderNav() {
  const navContainer = document.getElementById('sidebar-nav');
  navContainer.innerHTML = TABS.map(tab => `
    <button class="nav-item" data-tab="${tab.id}" type="button">
      <span class="nav-item-icon">${iconFor(tab.id)}</span>
      <span>${tab.label}</span>
    </button>
  `).join('');

  navContainer.addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const tabId = btn.dataset.tab;
    if (tabId) selectTab(tabId);
  });
}

function iconFor(id) {
  switch (id) {
    case 'listings':
      return svg`<rect x="3" y="4" width="14" height="2" rx="0.5"/>
                 <rect x="3" y="9" width="14" height="2" rx="0.5"/>
                 <rect x="3" y="14" width="14" height="2" rx="0.5"/>`;
    case 'lot-images':
      return svg`<rect x="2.5" y="4.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <circle cx="14.8" cy="7.2" r="0.9" fill="currentColor"/>`;
    case 'banners':
      return svg`<rect x="2.5" y="3.5" width="15" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <circle cx="7" cy="8" r="1.3" fill="currentColor"/>
                 <path d="M3 14 L8 9 L13 13 L17 9.5" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
    case 'pre-auction':
      return svg`<rect x="3.5" y="3.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <path d="M6 8 H14 M6 11 H14 M6 14 H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                 <circle cx="14.5" cy="5.5" r="2" fill="currentColor"/>`;
    case 'post-auction':
      return svg`<rect x="3.5" y="3.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <path d="M6 8 H14 M6 11 H14 M6 14 H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                 <path d="M13 13 L15 15 L18 11" fill="none" stroke="var(--success, currentColor)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}
function svg(strings) {
  return `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">${strings.join('')}</svg>`;
}

/* =============================================================
 * Tab selection
 * ============================================================= */

function selectTab(tabId) {
  const tab = TABS.find(t => t.id === tabId);
  if (!tab) return;

  activeTabId = tabId;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabId);
  });

  if (location.hash !== `#${tabId}`) {
    history.replaceState(null, '', `#${tabId}`);
  }

  const contentEl = document.getElementById('content');
  if (tab.ready) {
    contentEl.innerHTML = `
      <iframe class="app-frame" src="${tab.src}" title="${tab.label}"
              referrerpolicy="no-referrer"></iframe>
    `;
  } else {
    contentEl.innerHTML = `
      <div class="placeholder">
        <div class="card placeholder-card">
          <div class="card-title">${tab.label}</div>
          <h2>Not yet wired up</h2>
          <p class="muted">This tab is in progress.</p>
        </div>
      </div>
    `;
  }
}

/* =============================================================
 * Sign-out
 * ============================================================= */

function wireSignOut() {
  document.querySelectorAll('[data-signout]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await Auth.logout();
      } catch (err) {
        console.error('[shell] Sign-out error:', err);
      }
      boot();
    });
  });
}

/* =============================================================
 * Init
 * ============================================================= */

document.addEventListener('DOMContentLoaded', boot);

window.__shell = { TABS };
