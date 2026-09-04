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
import { openAdminPanel } from './admin-panel.js';
import { SUITE_ADMIN_EMAIL } from './admin-data.js';

const TABS = [
  { id: 'listings',     label: 'Listings',     src: './listings/index.html',                ready: true, section: 'Auction Management' },
  { id: 'lot-numbers',  label: "Lot #'s",      src: './lot-numbers/index.html',             ready: true, section: 'Auction Management' },
  { id: 'lot-images',   label: 'Lot Images',   src: './lot-images/index.html',              ready: true, section: 'Auction Management' },
  { id: 'banners',      label: 'Banners',      src: './banners/index.html',                 ready: true, section: 'Auction Management' },
  { id: 'pre-auction',  label: 'Pre Auction',  src: './post-auction/index.html?mode=pre',   ready: true, section: 'Auction Management' },
  { id: 'post-auction', label: 'Post Auction', src: './post-auction/index.html?mode=post',  ready: true, section: 'Auction Management' },
  { id: 'country-market', label: 'Country Market', src: './country-market/index.html',        ready: true, section: 'Country Market' },
  { id: 'video-manager', label: 'Video Manager', src: './video-manager/index.html',          ready: true, section: 'Video Management' },
];

const DEFAULT_TAB = 'listings';

let activeTabId = null;
// null = every tab (default for everyone until an admin restricts a
// specific account) — set from the current user's users/{uid}.allowedTabs
// in renderShell() below, via Admin Settings (admin-panel.js).
let allowedTabIds = null;

function isTabAllowed(tabId) {
  return allowedTabIds == null || allowedTabIds.includes(tabId);
}

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
    await renderShell(root, result.user);
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

async function renderShell(root, user) {
  const email = user?.email || '';
  const initial = email ? email[0].toUpperCase() : '?';
  const isSuiteAdmin = !!email && email.toLowerCase() === SUITE_ADMIN_EMAIL;
  const demoBanner = FIREBASE_CONFIGURED ? '' : `
    <div class="demo-banner no-print">
      Demo mode — Firebase not configured. Set values in
      <code>shared/firebase-config.js</code> to enable real auth.
    </div>`;

  // users/{uid}.allowedTabs (set via Admin Settings) — null/absent means
  // every tab, same as before this existed, so existing accounts are
  // unaffected until an admin explicitly restricts one.
  const profile = FIREBASE_CONFIGURED ? await Auth.getMyProfile(user) : null;
  allowedTabIds = profile && Array.isArray(profile.allowedTabs) ? profile.allowedTabs : null;

  root.innerHTML = `
    ${demoBanner}
    <header class="mobile-topbar">
      <button class="hamburger-btn" type="button" id="btnHamburger" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <div class="sidebar-brand" style="padding:0;border:0;">
        <img class="sidebar-brand-logo" src="shared/assets/cms-auction-suite-logo.png" alt="CMS Auction Suite" />
      </div>
      <div class="profile-menu">
        <button class="profile-btn" type="button" id="btnProfile" aria-label="Account menu" aria-expanded="false">
          <span class="user-avatar" aria-hidden="true">${initial}</span>
        </button>
        <div class="profile-dropdown" id="profileDropdown" hidden>
          <div class="profile-dropdown-email" title="${email}">${email || 'Signed in'}</div>
          ${isSuiteAdmin ? `<button class="profile-dropdown-item" type="button" id="btnOpenAdminSettingsMobile">Settings</button>` : ''}
          <button class="profile-dropdown-item" type="button" data-signout>Sign out</button>
        </div>
      </div>
    </header>

    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <div class="shell">
      <aside class="sidebar" id="sidebarDrawer" aria-label="Primary navigation">
        <div class="sidebar-brand">
          <img class="sidebar-brand-logo" src="shared/assets/cms-auction-suite-logo.png" alt="CMS Auction Suite" />
        </div>

        <nav class="sidebar-nav" id="sidebar-nav" aria-label="App tabs"></nav>

        <div class="sidebar-user">
          ${isSuiteAdmin ? `<button class="admin-settings-btn" type="button" id="btnOpenAdminSettings">Admin Settings</button>` : ''}
          <div class="user-pill">
            <span class="user-avatar" aria-hidden="true">${initial}</span>
            <span class="user-email" title="${email}">${email || 'Signed in'}</span>
          </div>
          <button class="signout-btn" type="button" data-signout>Sign out</button>
        </div>
      </aside>

      <main class="content" id="content"></main>
    </div>
  `;

  renderNav();
  wireSignOut();
  wireMobileChrome();
  if (isSuiteAdmin) {
    document.getElementById('btnOpenAdminSettings').addEventListener('click', () => openAdminPanel());
    document.getElementById('btnOpenAdminSettingsMobile').addEventListener('click', () => {
      closeProfileMenu();
      openAdminPanel();
    });
  }

  const hashTab = location.hash.replace(/^#/, '');
  const initialTab = TABS.some(t => t.id === hashTab) && isTabAllowed(hashTab) ? hashTab : DEFAULT_TAB;
  selectTab(initialTab);

  window.addEventListener('hashchange', () => {
    const hashTab = location.hash.replace(/^#/, '');
    if (hashTab && hashTab !== activeTabId) selectTab(hashTab);
  });
}

function renderNav() {
  const navContainer = document.getElementById('sidebar-nav');
  let html = '';
  let currentSection = null;
  for (const tab of TABS) {
    if (!isTabAllowed(tab.id)) continue;
    if (tab.section && tab.section !== currentSection) {
      currentSection = tab.section;
      html += `<div class="nav-section-title">${tab.section}</div>`;
    }
    html += `
    <button class="nav-item" data-tab="${tab.id}" type="button">
      <span class="nav-item-icon">${iconFor(tab.id)}</span>
      <span>${tab.label}</span>
    </button>`;
  }
  navContainer.innerHTML = html;

  navContainer.addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const tabId = btn.dataset.tab;
    if (tabId) selectTab(tabId);
    closeSidebarDrawer();
  });
}

/* =============================================================
 * Mobile chrome: hamburger drawer + profile dropdown
 * ============================================================= */

function closeSidebarDrawer() {
  document.getElementById('sidebarDrawer')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('open');
  document.getElementById('btnHamburger')?.setAttribute('aria-expanded', 'false');
}

function closeProfileMenu() {
  document.getElementById('profileDropdown')?.setAttribute('hidden', '');
  document.getElementById('btnProfile')?.setAttribute('aria-expanded', 'false');
}

function wireMobileChrome() {
  const hamburgerBtn = document.getElementById('btnHamburger');
  const drawer = document.getElementById('sidebarDrawer');
  const backdrop = document.getElementById('sidebarBackdrop');
  const profileBtn = document.getElementById('btnProfile');
  const profileDropdown = document.getElementById('profileDropdown');

  hamburgerBtn.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    backdrop.classList.toggle('open', open);
    hamburgerBtn.setAttribute('aria-expanded', String(open));
    closeProfileMenu();
  });

  backdrop.addEventListener('click', closeSidebarDrawer);

  profileBtn.addEventListener('click', () => {
    const open = profileDropdown.hasAttribute('hidden');
    if (open) profileDropdown.removeAttribute('hidden');
    else profileDropdown.setAttribute('hidden', '');
    profileBtn.setAttribute('aria-expanded', String(open));
    closeSidebarDrawer();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.profile-menu')) closeProfileMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSidebarDrawer();
      closeProfileMenu();
    }
  });
}

function iconFor(id) {
  switch (id) {
    case 'listings':
      return svg`<rect x="3" y="4" width="14" height="2" rx="0.5"/>
                 <rect x="3" y="9" width="14" height="2" rx="0.5"/>
                 <rect x="3" y="14" width="14" height="2" rx="0.5"/>`;
    case 'lot-numbers':
      return svg`<path d="M7.5 3.5 L5.5 16.5 M14.5 3.5 L12.5 16.5 M4 7.5 H16.5 M3.5 12.5 H16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`;
    case 'lot-images':
      return svg`<rect x="2.5" y="4.5" width="15" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <circle cx="14.8" cy="7.2" r="0.9" fill="currentColor"/>`;
    case 'banners':
      return svg`<rect x="2.5" y="3.5" width="15" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <circle cx="7" cy="8" r="1.3" fill="currentColor"/>
                 <path d="M3 14 L8 9 L13 13 L17 9.5" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
    case 'country-market':
      return svg`<path d="M3 9 L10 3.5 L17 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                 <path d="M4.5 8.5 V16 H15.5 V8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                 <path d="M8 16 V11.5 H12 V16" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
    case 'pre-auction':
      return svg`<rect x="3.5" y="3.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <path d="M6 8 H14 M6 11 H14 M6 14 H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                 <circle cx="14.5" cy="5.5" r="2" fill="currentColor"/>`;
    case 'post-auction':
      return svg`<rect x="3.5" y="3.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <path d="M6 8 H14 M6 11 H14 M6 14 H11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                 <path d="M13 13 L15 15 L18 11" fill="none" stroke="var(--success, currentColor)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'video-manager':
      return svg`<rect x="2.5" y="4.5" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                 <path d="M14.5 8.5 18.5 6v8l-4-2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`;
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
  // Defense in depth beyond renderNav()'s filtering — catches a disallowed
  // tab reached via a typed/bookmarked #hash, not just a click. Falls back
  // to this user's first allowed tab (own security rules inside each
  // sub-app remain the real data boundary; this is a workflow guard).
  if (!isTabAllowed(tabId)) {
    const fallback = TABS.find(t => isTabAllowed(t.id));
    if (!fallback || fallback.id === tabId) return;
    tabId = fallback.id;
  }
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
