/* =============================================================
 * CMS Auction Suite — Auth UI
 * -------------------------------------------------------------
 * Renders login, sign-up, and pending-approval screens into a
 * given container element. The shell calls these when the auth
 * state requires them.
 * ============================================================= */

import * as Auth from './auth.js';
import { FIREBASE_CONFIGURED } from './firebase-config.js';

const BRAND_SVG = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3 L21 19 L3 19 Z"/>
  </svg>`;

const CLOCK_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 7 12 12 15 14"/>
  </svg>`;

function authShell(inner) {
  const banner = FIREBASE_CONFIGURED ? '' : `
    <div class="demo-banner">
      Demo mode — Firebase not configured. Set values in
      <code>shared/firebase-config.js</code> to enable real auth.
    </div>`;
  return `
    ${banner}
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="auth-brand-mark">${BRAND_SVG}</span>
          <span class="auth-brand-text">CMS Auction Suite</span>
        </div>
        ${inner}
      </div>
    </div>`;
}

/* =============================================================
 * Login screen
 * ============================================================= */
export function renderLogin(container, { onSuccess, onSwitchToSignup } = {}) {
  container.innerHTML = authShell(`
    <h1>Sign in</h1>
    <p class="auth-subtitle">Use your CMS account email and password.</p>

    <div class="auth-error" id="loginError"></div>

    <form class="auth-form" id="loginForm" novalidate>
      <div class="field">
        <label for="loginEmail">Email</label>
        <input type="email" id="loginEmail" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="loginPassword">Password</label>
        <input type="password" id="loginPassword" autocomplete="current-password" required />
      </div>

      <div class="auth-actions">
        <button class="btn btn-primary" type="submit" id="loginSubmit">Sign in</button>
        <button class="btn btn-ghost" type="button" id="loginForgot">
          Forgot password?
        </button>
      </div>
    </form>

    <div class="auth-switch">
      Don't have an account?
      <button class="auth-link" id="switchToSignup" type="button">Request access</button>
    </div>
  `);

  const form     = container.querySelector('#loginForm');
  const errorEl  = container.querySelector('#loginError');
  const submit   = container.querySelector('#loginSubmit');
  const forgot   = container.querySelector('#loginForgot');
  const switcher = container.querySelector('#switchToSignup');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = container.querySelector('#loginEmail').value.trim();
    const password = container.querySelector('#loginPassword').value;
    if (!email || !password) {
      showError(errorEl, 'Email and password are required.');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    try {
      await Auth.login(email, password);
      onSuccess && onSuccess();
    } catch (err) {
      showError(errorEl, Auth.authErrorMessage(err));
      submit.disabled = false;
      submit.textContent = 'Sign in';
    }
  });

  forgot.addEventListener('click', async () => {
    const email = container.querySelector('#loginEmail').value.trim();
    if (!email) {
      showError(errorEl, 'Enter your email above first, then click Forgot password.');
      return;
    }
    try {
      await Auth.resetPassword(email);
      showSuccess(errorEl, `Password reset link sent to ${email}.`);
    } catch (err) {
      showError(errorEl, Auth.authErrorMessage(err));
    }
  });

  switcher.addEventListener('click', () => {
    onSwitchToSignup && onSwitchToSignup();
  });

  container.querySelector('#loginEmail').focus();
}

/* =============================================================
 * Sign-up screen
 * ============================================================= */
export function renderSignup(container, { onSuccess, onSwitchToLogin } = {}) {
  container.innerHTML = authShell(`
    <h1>Request access</h1>
    <p class="auth-subtitle">
      Create an account. An admin will review and approve your access.
    </p>

    <div class="auth-error" id="signupError"></div>

    <form class="auth-form" id="signupForm" novalidate>
      <div class="field">
        <label for="signupEmail">Email</label>
        <input type="email" id="signupEmail" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="signupPassword">Password</label>
        <input type="password" id="signupPassword" autocomplete="new-password"
               required minlength="6" />
      </div>
      <div class="field">
        <label for="signupConfirm">Confirm password</label>
        <input type="password" id="signupConfirm" autocomplete="new-password"
               required minlength="6" />
      </div>

      <div class="auth-actions">
        <button class="btn btn-primary" type="submit" id="signupSubmit">Create account</button>
      </div>
    </form>

    <div class="auth-switch">
      Already have an account?
      <button class="auth-link" id="switchToLogin" type="button">Sign in</button>
    </div>
  `);

  const form     = container.querySelector('#signupForm');
  const errorEl  = container.querySelector('#signupError');
  const submit   = container.querySelector('#signupSubmit');
  const switcher = container.querySelector('#switchToLogin');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = container.querySelector('#signupEmail').value.trim();
    const password = container.querySelector('#signupPassword').value;
    const confirm  = container.querySelector('#signupConfirm').value;
    if (!email || !password) {
      showError(errorEl, 'Email and password are required.');
      return;
    }
    if (password.length < 6) {
      showError(errorEl, 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      showError(errorEl, 'Passwords do not match.');
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Creating account…';
    try {
      await Auth.signup(email, password);
      onSuccess && onSuccess();
    } catch (err) {
      showError(errorEl, Auth.authErrorMessage(err));
      submit.disabled = false;
      submit.textContent = 'Create account';
    }
  });

  switcher.addEventListener('click', () => {
    onSwitchToLogin && onSwitchToLogin();
  });

  container.querySelector('#signupEmail').focus();
}

/* =============================================================
 * Pending approval screen
 * ============================================================= */
export function renderPending(container, { user, onSignOut } = {}) {
  const email = user && user.email ? user.email : 'your account';
  container.innerHTML = authShell(`
    <div class="pending-content">
      <div class="pending-icon">${CLOCK_SVG}</div>
      <h1>Awaiting approval</h1>
      <p class="auth-subtitle">
        Your account has been created. An admin will approve access shortly.
      </p>
      <div class="user-email">${escapeHtml(email)}</div>
      <p class="muted" style="font-size:13px;">
        Once approved, refresh this page to enter the suite.
      </p>

      <div class="auth-actions" style="margin-top: var(--space-5);">
        <button class="btn" type="button" id="pendingRefresh">I've been approved — refresh</button>
        <button class="btn btn-ghost" type="button" id="pendingSignOut">Sign out</button>
      </div>
    </div>
  `);

  container.querySelector('#pendingRefresh').addEventListener('click', () => {
    location.reload();
  });
  container.querySelector('#pendingSignOut').addEventListener('click', async () => {
    await Auth.logout();
    onSignOut && onSignOut();
  });
}

/* =============================================================
 * Helpers
 * ============================================================= */
function showError(el, msg) {
  el.classList.remove('auth-success', 'visible');
  el.classList.add('auth-error', 'visible');
  el.textContent = msg;
}
function showSuccess(el, msg) {
  el.classList.remove('auth-error', 'visible');
  el.classList.add('auth-success', 'visible');
  el.textContent = msg;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
