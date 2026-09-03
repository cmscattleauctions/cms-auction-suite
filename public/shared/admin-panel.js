/* =============================================================
 * CMS Auction Suite — Admin Settings panel
 * -------------------------------------------------------------
 * A modal, opened from a button the shell only renders for
 * jayton.h@cmslivestock.com (see shell.js), for approving accounts,
 * setting who's responsible for what (role + which tabs they can
 * open), adding new accounts, and setting passwords directly.
 *
 * UI-only gate — the real boundary is isSuiteAdmin() in
 * docs/firestore.rules (Firestore) and the matching check inside
 * functions/index.js's adminRunJob (Admin SDK ops). Every read/write
 * this file makes will simply be rejected server-side for anyone else.
 * ============================================================= */

import * as AdminData from './admin-data.js';

// Read via the existing window.__shell.TABS export (shell.js) rather than a
// direct ES import — shell.js is this module's own importer, and importing
// back from it would make a circular module dependency for no reason, since
// shell.js already exposes exactly this for other code to read.
function getTabs() {
  return (window.__shell && window.__shell.TABS) || [];
}

let overlayEl = null;
let bodyEl = null;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ensureDom() {
  if (overlayEl) return;
  overlayEl = document.createElement('div');
  overlayEl.className = 'admin-panel-overlay';
  overlayEl.innerHTML = `
    <div class="admin-panel" role="dialog" aria-modal="true" aria-label="Admin Settings">
      <div class="admin-panel-header">
        <h2>Admin Settings — User Management</h2>
        <button type="button" class="admin-panel-close" aria-label="Close">&times;</button>
      </div>
      <div class="admin-panel-body"></div>
    </div>
  `;
  document.body.appendChild(overlayEl);
  bodyEl = overlayEl.querySelector('.admin-panel-body');
  overlayEl.addEventListener('click', e => { if (e.target === overlayEl) closeAdminPanel(); });
  overlayEl.querySelector('.admin-panel-close').addEventListener('click', closeAdminPanel);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlayEl.classList.contains('open')) closeAdminPanel();
  });
}

export function closeAdminPanel() {
  if (overlayEl) overlayEl.classList.remove('open');
}

export async function openAdminPanel() {
  ensureDom();
  overlayEl.classList.add('open');
  await refresh();
}

async function refresh() {
  bodyEl.innerHTML = `<p class="muted">Loading users…</p>`;
  let users;
  try {
    users = await AdminData.listAllUsers();
  } catch (err) {
    bodyEl.innerHTML = `<p style="color:var(--danger);">Could not load users: ${esc(err.message)}</p>`;
    return;
  }
  renderUsers(users);
}

function tabCheckboxesHtml(idPrefix, allowedTabs) {
  const allowAll = allowedTabs == null;
  return getTabs().map(t => `
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;text-transform:none;font-weight:400;color:var(--text-primary);margin-bottom:4px;">
      <input type="checkbox" id="${idPrefix}-${esc(t.id)}" data-tab-id="${esc(t.id)}" ${allowAll || (allowedTabs || []).includes(t.id) ? 'checked' : ''}>
      ${esc(t.label)}
    </label>`).join('');
}

function collectCheckedTabs(row) {
  const boxes = Array.from(row.querySelectorAll('[data-tab-id]'));
  const checked = boxes.filter(b => b.checked).map(b => b.dataset.tabId);
  return checked.length === boxes.length ? null : checked; // all checked = null (every tab)
}

function renderUsers(users) {
  bodyEl.innerHTML = `
    <div class="admin-add-user card" style="margin-bottom:20px;">
      <div class="card-title">Add User</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div><label>Email</label><input type="email" id="newUserEmail" placeholder="name@cmslivestock.com"></div>
        <div><label>Password</label><input type="password" id="newUserPassword" placeholder="At least 6 characters"></div>
      </div>
      <div style="margin-top:12px;"><label>Role</label><input type="text" id="newUserRole" placeholder="e.g. Staff, Rep, Admin"></div>
      <div style="margin-top:12px;">
        <label>Tabs this person can open</label>
        <div id="newUserTabs">${tabCheckboxesHtml('newUser', null)}</div>
      </div>
      <button type="button" class="btn btn-accent" id="btnAddUser" style="margin-top:12px;">+ Add User</button>
      <p class="admin-msg muted" id="addUserMsg" style="margin-top:8px;min-height:16px;"></p>
    </div>

    <div class="card-title">Users (${users.length})</div>
    <div class="admin-user-list">
      ${users.map(u => userRowHtml(u)).join('') || '<p class="muted">No users yet.</p>'}
    </div>
  `;

  bodyEl.querySelector('#btnAddUser').addEventListener('click', onAddUser);
  users.forEach(u => wireUserRow(u));
}

function userRowHtml(u) {
  const approved = u.approved === true;
  return `
    <div class="admin-user-row card" data-uid="${esc(u.uid)}" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="min-width:0;">
          <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;">${esc(u.email || '(no email)')}</div>
          <div class="muted" style="font-size:11px;">${esc(u.uid)}</div>
        </div>
        <span class="admin-approved-chip ${approved ? 'approved' : 'pending'}">${approved ? 'Approved' : 'Pending'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
        <div><label>Role</label><input type="text" class="role-input" value="${esc(u.role || '')}" placeholder="e.g. Staff, Rep, Admin"></div>
        <div><label>Set New Password</label><input type="password" class="password-input" placeholder="Leave blank to skip"></div>
      </div>
      <div style="margin-top:10px;">
        <label>Tabs this person can open</label>
        <div class="tabs-wrap">${tabCheckboxesHtml('u-' + u.uid, u.allowedTabs)}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <button type="button" class="btn ${approved ? 'btn-ghost' : 'btn-accent'} btn-toggle-approved">${approved ? 'Unapprove' : 'Approve'}</button>
        <button type="button" class="btn btn-primary btn-save-row">Save Changes</button>
      </div>
      <p class="admin-msg muted row-msg" style="margin-top:8px;min-height:16px;"></p>
    </div>
  `;
}

function wireUserRow(u) {
  const row = bodyEl.querySelector(`.admin-user-row[data-uid="${CSS.escape(u.uid)}"]`);
  if (!row) return;
  const msg = row.querySelector('.row-msg');

  row.querySelector('.btn-toggle-approved').addEventListener('click', async () => {
    const btn = row.querySelector('.btn-toggle-approved');
    btn.disabled = true;
    try {
      await AdminData.setApproved(u.uid, u.approved !== true);
      await refresh();
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = 'var(--danger)';
      btn.disabled = false;
    }
  });

  row.querySelector('.btn-save-row').addEventListener('click', async () => {
    const btn = row.querySelector('.btn-save-row');
    btn.disabled = true;
    msg.style.color = '';
    msg.textContent = 'Saving…';
    try {
      const role = row.querySelector('.role-input').value.trim();
      const allowedTabs = collectCheckedTabs(row);
      await AdminData.setResponsibilities(u.uid, { role, allowedTabs });

      const newPassword = row.querySelector('.password-input').value;
      if (newPassword) {
        if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
        await AdminData.setUserPassword(u.uid, newPassword);
        row.querySelector('.password-input').value = '';
      }
      msg.textContent = 'Saved.';
    } catch (err) {
      msg.style.color = 'var(--danger)';
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

async function onAddUser() {
  const btn = bodyEl.querySelector('#btnAddUser');
  const msg = bodyEl.querySelector('#addUserMsg');
  const email = bodyEl.querySelector('#newUserEmail').value.trim();
  const password = bodyEl.querySelector('#newUserPassword').value;
  const role = bodyEl.querySelector('#newUserRole').value.trim();
  const allowedTabs = collectCheckedTabs(bodyEl.querySelector('#newUserTabs'));

  if (!email) { msg.style.color = 'var(--danger)'; msg.textContent = 'Email is required.'; return; }
  if (!password || password.length < 6) { msg.style.color = 'var(--danger)'; msg.textContent = 'Password must be at least 6 characters.'; return; }

  btn.disabled = true;
  msg.style.color = '';
  msg.textContent = 'Creating…';
  try {
    await AdminData.createUserAccount({ email, password, role, allowedTabs });
    msg.style.color = '';
    msg.textContent = '';
    await refresh();
  } catch (err) {
    msg.style.color = 'var(--danger)';
    msg.textContent = err.message;
    btn.disabled = false;
  }
}
