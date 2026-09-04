/* =============================================================
 * CMS Video Manager — App controller
 * -------------------------------------------------------------
 * Owns: state (tab/view/search/filters), toolbar wiring, and
 * delegates rendering to the view modules. Nothing here talks to
 * mock-data.js directly — everything goes through repository.js.
 * ============================================================= */

import { VideoRepository, ReferenceDataRepository, UsageRepository } from './repository.js';
import { renderTable } from './ui-table.js';
import { renderGrid } from './ui-grid.js';
import { openDrawer, closeDrawer } from './ui-drawer.js';
import { openUploadModal, openCsvImportModal, openVideoIdManagerModal, openStaffManagerModal, openTrashModal } from './ui-modals.js';
import { readInitialRoute, reportRoute } from '../shared/subapp-url.js';

const state = {
  statusTab: 'created', // "Completed" — the default view staff actually want first; boot() below overrides this from the URL when a reload is restoring a specific tab
  view: 'table',
  search: '',
  filters: {},
  draftsOnly: false,
  sort: 'added-desc',
  selectedId: null,
};

// The exact list currently on screen, in its current filtered/sorted order —
// so the drawer's Previous/Next can step through what the user is actually
// looking at rather than some other ordering.
let currentList = [];

const STATUS_TABS = [
  { id: 'ready', label: 'Ready to Make' },
  { id: 'hold', label: 'On Hold' },
  { id: 'created', label: 'Completed' },
];

/** MMYY -> YYMM, so delivery-date sort compares chronologically instead of by month digit first. */
function deliveryDateSortKey(monthYear) {
  if (!monthYear || monthYear.length !== 4) return '';
  return monthYear.slice(2) + monthYear.slice(0, 2);
}

const SORT_OPTIONS = [
  { id: 'updated-desc',    label: 'Updated — Newest' },
  { id: 'updated-asc',     label: 'Updated — Oldest' },
  { id: 'added-desc',      label: 'Added — Newest' },
  { id: 'added-asc',       label: 'Added — Oldest' },
  { id: 'consignor-asc',   label: 'Consignor — A to Z' },
  { id: 'consignor-desc',  label: 'Consignor — Z to A' },
  { id: 'video-id',        label: 'Video ID' },
  { id: 'delivery-date',   label: 'Delivery Date' },
  { id: 'clips-desc',      label: 'Clip Count — High to Low' },
  { id: 'clips-asc',       label: 'Clip Count — Low to High' },
];

const SORT_COMPARATORS = {
  'updated-desc':   (a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || ''),
  'updated-asc':    (a, b) => (a.lastUpdated || '').localeCompare(b.lastUpdated || ''),
  'added-desc':     (a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''),
  'added-asc':      (a, b) => (a.dateAdded || '').localeCompare(b.dateAdded || ''),
  'consignor-asc':  (a, b) => (a.consignorName || '').localeCompare(b.consignorName || ''),
  'consignor-desc': (a, b) => (b.consignorName || '').localeCompare(a.consignorName || ''),
  'video-id':       (a, b) => (a.videoId || '').localeCompare(b.videoId || '', undefined, { numeric: true }),
  'delivery-date':  (a, b) => deliveryDateSortKey(a.monthYear).localeCompare(deliveryDateSortKey(b.monthYear)),
  'clips-desc':     (a, b) => (b.clips?.length || 0) - (a.clips?.length || 0),
  'clips-asc':      (a, b) => (a.clips?.length || 0) - (b.clips?.length || 0),
};

export const ctx = {
  state,
  repo: VideoRepository,
  ref: ReferenceDataRepository,
  usage: UsageRepository,
  refresh,
  getCurrentList: () => currentList,
  openDrawer: id => { state.selectedId = id; paintSelectedRow(); openDrawer(id, ctx); },
  closeDrawer: () => { state.selectedId = null; paintSelectedRow(); closeDrawer(); },
};

/** Cheap DOM-only highlight update — avoids a full refresh() (and losing scroll position) just to show which row's drawer is open. */
function paintSelectedRow() {
  document.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.classList.toggle('is-selected', tr.dataset.id === state.selectedId);
  });
}

/* =============================================================
 * Boot
 * ============================================================= */
async function boot() {
  // Restore whichever status tab the shell was asked to reopen us on
  // (see shared/subapp-url.js) — otherwise a reload always drops back
  // to the hardcoded default above, discarding wherever staff actually
  // were. Falls back to the default for an unrecognized/absent route.
  const initialRoute = readInitialRoute();
  if (STATUS_TABS.some(t => t.id === initialRoute)) state.statusTab = initialRoute;
  reportRoute(state.statusTab); // keep the shell's URL in sync even when nothing changed

  // Reference dictionaries (consignors, sire/dam types) are read
  // synchronously everywhere below (renderFiltersPanel, the Video ID
  // Manager, the upload modal) — load them once before anything renders,
  // same as ReferenceDataRepository's own doc comments assume.
  await ReferenceDataRepository.preload();
  renderTabsShell();
  renderFiltersPanel();
  wireToolbar();
  VideoRepository.subscribe(evt => {
    if (evt && evt.type === 'reference-changed') refreshConsignorFilterOptions();
    refresh();
  });
  await refresh();
}

/* =============================================================
 * Core refresh: re-query + re-render whatever view is active
 * ============================================================= */
async function refresh() {
  const counts = await VideoRepository.getCounts();
  paintTabCounts(counts);

  const filters = { ...state.filters };
  if (state.draftsOnly) filters.isDraft = true;

  const list = await VideoRepository.getVideos({
    status: state.statusTab,
    search: state.search,
    filters,
    sort: SORT_COMPARATORS[state.sort] || SORT_COMPARATORS['updated-desc'],
  });

  const totalInTab = state.statusTab === 'ready' ? counts.ready
    : state.statusTab === 'hold' ? counts.hold
    : counts.created;

  const metaEl = document.getElementById('vm-meta');
  const hasActiveQuery = !!state.search.trim() || Object.keys(state.filters).length > 0 || state.draftsOnly;
  metaEl.textContent = hasActiveQuery
    ? `${list.length} of ${totalInTab} record${totalInTab === 1 ? '' : 's'}`
    : `${list.length} record${list.length === 1 ? '' : 's'}`;

  currentList = list;

  const content = document.getElementById('vm-content');
  if (!list.length) {
    content.innerHTML = `
      <div class="vm-empty">
        <div>
          <h3>No videos match</h3>
          <p>Try clearing search or filters, or add a new video.</p>
        </div>
      </div>`;
    return;
  }

  if (state.view === 'table') {
    renderTable(content, list, ctx);
  } else {
    renderGrid(content, list, ctx);
  }

  paintSelectedRow();
  renderActiveFilterChips();
}

/* =============================================================
 * Status tabs
 * ============================================================= */
function renderTabsShell() {
  const nav = document.getElementById('vm-tabs');
  nav.innerHTML = STATUS_TABS.map(t => `
    <button class="vm-tab" data-tab="${t.id}" type="button">
      <span>${t.label}</span>
      <span class="vm-tab-count" data-count="${t.id}">0</span>
    </button>
  `).join('');

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.vm-tab');
    if (!btn) return;
    state.statusTab = btn.dataset.tab;
    reportRoute(state.statusTab);
    paintActiveTab();
    refresh();
  });

  paintActiveTab();
}

function paintActiveTab() {
  document.querySelectorAll('.vm-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === state.statusTab);
  });
}

function paintTabCounts(counts) {
  document.querySelector('[data-count="ready"]').textContent = counts.ready;
  document.querySelector('[data-count="hold"]').textContent = counts.hold;
  document.querySelector('[data-count="created"]').textContent = counts.created;
  document.querySelector('[data-count="draft"]').textContent = counts.draft;
}

/* =============================================================
 * Toolbar: search, filters, view toggle, top actions
 * ============================================================= */
function wireToolbar() {
  wireSortMenu();

  const searchInput = document.getElementById('vm-search-input');
  let debounce;
  searchInput.addEventListener('input', e => {
    clearTimeout(debounce);
    const val = e.target.value;
    debounce = setTimeout(() => { state.search = val; refresh(); }, 120);
  });

  document.getElementById('vm-view-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.vm-view-btn');
    if (!btn) return;
    state.view = btn.dataset.view;
    document.querySelectorAll('.vm-view-btn').forEach(b => b.classList.toggle('active', b === btn));
    refresh();
  });

  const filtersBtn = document.getElementById('vm-btn-filters');
  const filtersPanel = document.getElementById('vm-filters-panel');
  filtersBtn.addEventListener('click', () => {
    filtersPanel.hidden = !filtersPanel.hidden;
  });
  document.addEventListener('click', e => {
    if (!filtersPanel.hidden && !filtersPanel.contains(e.target) && e.target !== filtersBtn && !filtersBtn.contains(e.target)) {
      filtersPanel.hidden = true;
    }
  });

  document.getElementById('vm-btn-upload').addEventListener('click', () => openUploadModal(ctx));

  const toolsBtn = document.getElementById('vm-btn-tools');
  const toolsMenu = document.getElementById('vm-tools-menu');
  toolsBtn.addEventListener('click', () => {
    const willOpen = toolsMenu.hidden;
    toolsMenu.hidden = !willOpen;
    toolsBtn.setAttribute('aria-expanded', String(willOpen));
  });
  document.addEventListener('click', e => {
    if (!toolsMenu.hidden && !toolsMenu.contains(e.target) && e.target !== toolsBtn && !toolsBtn.contains(e.target)) {
      toolsMenu.hidden = true;
      toolsBtn.setAttribute('aria-expanded', 'false');
    }
  });
  const closeTools = () => { toolsMenu.hidden = true; toolsBtn.setAttribute('aria-expanded', 'false'); };
  document.getElementById('vm-btn-idmanager').addEventListener('click', () => { closeTools(); openVideoIdManagerModal(ctx); });
  document.getElementById('vm-btn-staff').addEventListener('click', () => { closeTools(); openStaffManagerModal(ctx); });
  document.getElementById('vm-btn-import-csv').addEventListener('click', () => { closeTools(); openCsvImportModal(ctx); });
  document.getElementById('vm-btn-trash').addEventListener('click', () => { closeTools(); openTrashModal(ctx); });
}

/**
 * Sort — a proper dropdown menu instead of a native <select>, which
 * fought the shared theme.css select styling for width/centering no
 * matter how it was patched. The button always shows the active
 * option's label, so it's obvious the control actually did something.
 */
function wireSortMenu() {
  const btn = document.getElementById('vm-btn-sort');
  const label = document.getElementById('vm-sort-btn-label');
  const menu = document.getElementById('vm-sort-menu');

  function paintLabel() {
    const active = SORT_OPTIONS.find(o => o.id === state.sort);
    label.textContent = `Sort: ${active ? active.label : SORT_OPTIONS[0].label}`;
  }

  function paintMenu() {
    menu.innerHTML = SORT_OPTIONS.map(o => `
      <button class="vm-sort-option ${o.id === state.sort ? 'active' : ''}" data-sort="${o.id}" type="button">${o.label}</button>
    `).join('');
    menu.querySelectorAll('[data-sort]').forEach(opt => opt.addEventListener('click', () => {
      state.sort = opt.dataset.sort;
      paintLabel();
      paintMenu();
      closeMenu();
      refresh();
    }));
  }

  function openMenu() { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
  function closeMenu() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }

  btn.addEventListener('click', () => { menu.hidden ? openMenu() : closeMenu(); });
  document.addEventListener('click', e => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) closeMenu();
  });

  paintLabel();
  paintMenu();
}

function renderFiltersPanel() {
  const panel = document.getElementById('vm-filters-panel');
  const consignors = ReferenceDataRepository.getConsignors();
  const sexes = ReferenceDataRepository.getSexTypes();
  const sires = ReferenceDataRepository.getSireTypes();
  const dams = ReferenceDataRepository.getDamTypes();
  const makers = ReferenceDataRepository.getVideoMakers();

  panel.innerHTML = `
    <div class="vm-filters-panel-row">
      <label>Consignor</label>
      <select id="f-consignor"><option value="">All consignors</option>
        ${consignors.map(c => `<option value="${c.code}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="vm-filters-panel-row">
      <label>Sex</label>
      <select id="f-sex"><option value="">All</option>
        ${sexes.map(s => `<option value="${s.code}">${s.code}- ${s.label}</option>`).join('')}
      </select>
    </div>
    <div class="field-row vm-filters-panel-row">
      <div>
        <label>Sire</label>
        <select id="f-sire"><option value="">All</option>
          ${sires.map(s => `<option value="${s.code}">${s.code}- ${s.label}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>Dam</label>
        <select id="f-dam"><option value="">All</option>
          ${dams.map(s => `<option value="${s.code}">${s.code}- ${s.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field-row vm-filters-panel-row">
      <div>
        <label>Month / Year</label>
        <input type="text" id="f-monthyear" placeholder="e.g. 0826" maxlength="4" />
      </div>
      <div>
        <label>Video Maker</label>
        <select id="f-maker"><option value="">Anyone</option>
          ${makers.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field-row vm-filters-panel-row">
      <div>
        <label>Weight min</label>
        <input type="number" id="f-weight-min" placeholder="e.g. 400" />
      </div>
      <div>
        <label>Weight max</label>
        <input type="number" id="f-weight-max" placeholder="e.g. 900" />
      </div>
    </div>
    <div class="field-row vm-filters-panel-row">
      <div>
        <label>Date from</label>
        <input type="date" id="f-date-from" />
      </div>
      <div>
        <label>Date to</label>
        <input type="date" id="f-date-to" />
      </div>
    </div>
    <div class="vm-filter-toggle-row">
      <span class="switch-label">Has clips</span>
      <select id="f-has-clips" style="width:auto"><option value="">Any</option><option value="yes">Has clips</option><option value="no">No clips</option></select>
    </div>
    <div class="vm-filter-toggle-row">
      <span class="switch-label">Has YouTube video</span>
      <select id="f-has-youtube" style="width:auto"><option value="">Any</option><option value="yes">Yes</option><option value="no">No</option></select>
    </div>
    <div class="vm-filter-toggle-row">
      <span class="switch-label">Needs review</span>
      <label class="switch"><input type="checkbox" id="f-needs-review" /><span class="track"></span></label>
    </div>
    <div class="vm-filter-toggle-row">
      <span class="switch-label">Has auction usage</span>
      <select id="f-usage" style="width:auto"><option value="">Any</option><option value="yes">Used</option><option value="no">Never used</option></select>
    </div>
    <div class="vm-filter-toggle-row">
      <span class="switch-label">Drafts only <span class="vm-tab-count" data-count="draft">0</span></span>
      <label class="switch"><input type="checkbox" id="f-drafts-only" /><span class="track"></span></label>
    </div>
    <div class="vm-filters-panel-footer">
      <button class="btn btn-ghost btn-block" id="f-clear" type="button">Clear all</button>
      <button class="btn btn-primary btn-block" id="f-apply" type="button">Apply</button>
    </div>
  `;

  panel.querySelector('#f-clear').addEventListener('click', () => resetAllFilters());

  panel.querySelector('#f-apply').addEventListener('click', () => {
    const filters = {};
    const consignor = panel.querySelector('#f-consignor').value; if (consignor) filters.consignorCode = consignor;
    const sex = panel.querySelector('#f-sex').value; if (sex) filters.sexCode = sex;
    const sire = panel.querySelector('#f-sire').value; if (sire) filters.sireCode = sire;
    const dam = panel.querySelector('#f-dam').value; if (dam) filters.damCode = dam;
    const wMin = panel.querySelector('#f-weight-min').value; if (wMin) filters.weightMin = Number(wMin);
    const wMax = panel.querySelector('#f-weight-max').value; if (wMax) filters.weightMax = Number(wMax);
    const maker = panel.querySelector('#f-maker').value; if (maker) filters.videoMaker = maker;
    const dFrom = panel.querySelector('#f-date-from').value; if (dFrom) filters.dateFrom = dFrom;
    const dTo = panel.querySelector('#f-date-to').value; if (dTo) filters.dateTo = dTo + 'T23:59:59';
    const yt = panel.querySelector('#f-has-youtube').value; if (yt) filters.hasYoutube = yt === 'yes';
    const review = panel.querySelector('#f-needs-review').checked; if (review) filters.needsReview = true;
    const usage = panel.querySelector('#f-usage').value; if (usage) filters.hasUsage = usage === 'yes';
    const monthYear = panel.querySelector('#f-monthyear').value.trim(); if (monthYear) filters.monthYear = monthYear;
    const hasClips = panel.querySelector('#f-has-clips').value; if (hasClips) filters.hasClips = hasClips === 'yes';

    state.filters = filters;
    state.draftsOnly = panel.querySelector('#f-drafts-only').checked;
    updateFilterBadge();
    panel.hidden = true;
    refresh();
  });
}

function refreshConsignorFilterOptions() {
  const sel = document.getElementById('f-consignor');
  if (!sel) return;
  const current = sel.value;
  const consignors = ReferenceDataRepository.getConsignors();
  sel.innerHTML = `<option value="">All consignors</option>` +
    consignors.map(c => `<option value="${c.code}">${c.name}</option>`).join('');
  sel.value = current;
}

function updateFilterBadge() {
  const n = Object.keys(state.filters).length;
  const badge = document.getElementById('vm-filter-badge');
  badge.hidden = n === 0;
  badge.textContent = n;
}

const FILTER_LABELS = {
  consignorCode: code => `Consignor: ${ReferenceDataRepository.findConsignor(code)?.name || code}`,
  sexCode: code => `Sex: ${ReferenceDataRepository.sexLabel(code)}`,
  sireCode: code => `Sire: ${ReferenceDataRepository.sireLabel(code)}`,
  damCode: code => `Dam: ${ReferenceDataRepository.damLabel(code)}`,
  weightMin: v => `Weight ≥ ${v}`,
  weightMax: v => `Weight ≤ ${v}`,
  videoMaker: v => `Maker: ${v}`,
  dateFrom: v => `From ${v}`,
  dateTo: v => `To ${String(v).slice(0, 10)}`,
  hasYoutube: v => v ? 'Has YouTube' : 'No YouTube',
  needsReview: () => 'Needs review',
  hasUsage: v => v ? 'Used in auctions' : 'Never used',
  monthYear: v => `Month: ${v}`,
  hasClips: v => v ? 'Has clips' : 'No clips',
};

/** Full reset — filters, drafts-only, and the search box — used by both the filters panel's own "Clear all" and the toolbar-level Clear Filters button. */
function resetAllFilters() {
  const panel = document.getElementById('vm-filters-panel');
  if (panel) {
    panel.querySelectorAll('select').forEach(s => s.value = '');
    panel.querySelectorAll('input').forEach(i => i.type === 'checkbox' ? i.checked = false : i.value = '');
  }
  state.filters = {};
  state.draftsOnly = false;
  state.search = '';
  const searchInput = document.getElementById('vm-search-input');
  if (searchInput) searchInput.value = '';
  updateFilterBadge();
  refresh();
}

function renderActiveFilterChips() {
  const wrap = document.getElementById('vm-active-filters');
  const chips = Object.entries(state.filters).map(([key, val]) => {
    const label = FILTER_LABELS[key] ? FILTER_LABELS[key](val) : `${key}: ${val}`;
    return `<span class="vm-chip" data-key="${key}">${label} <button type="button" data-remove="${key}">&times;</button></span>`;
  });
  if (state.search.trim()) {
    chips.unshift(`<span class="vm-chip" data-key="__search">Search: "${state.search}" <button type="button" data-remove="__search">&times;</button></span>`);
  }
  const hasAny = chips.length > 0 || state.draftsOnly;
  wrap.innerHTML = hasAny
    ? chips.join('') + `<button class="vm-clear-filters-btn" id="vm-btn-clear-filters" type="button">Clear all filters</button>`
    : '';
  wrap.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.remove;
      if (key === '__search') {
        state.search = '';
        document.getElementById('vm-search-input').value = '';
      } else {
        delete state.filters[key];
        updateFilterBadge();
      }
      refresh();
    });
  });
  const clearBtn = document.getElementById('vm-btn-clear-filters');
  if (clearBtn) clearBtn.addEventListener('click', () => resetAllFilters());
}

document.addEventListener('DOMContentLoaded', boot);
