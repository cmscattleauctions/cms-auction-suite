/* =============================================================
 * CMS Auction Suite — Skeleton loading helper
 * -------------------------------------------------------------
 * Builds the HTML for each layout composition (table/grid/
 * dashboard/detail/form — see shared/skeleton.css) and manages the
 * "wait ~150-200ms before showing, so a near-instant load never
 * flashes a placeholder" delay every skeleton in this app should
 * use, whether it's the shell's own tab-switch skeleton or a
 * module's internal one.
 *
 * Usage:
 *   const handle = showSkeletonAfterDelay(container, 'table', { rows: 8 });
 *   // ... when real content (or an empty/error state) is ready:
 *   handle.cancel();   // safe to call whether or not it ever actually showed
 * ============================================================= */

const DEFAULT_DELAY_MS = 180; // spec's "~150-200ms" — the midpoint

/** Row count that reads as "a believable table", not empty or overwhelming. */
const DEFAULT_ROWS = 6;
const DEFAULT_CARDS = 6;

function buildTableSkeleton({ rows = DEFAULT_ROWS, columns = 4 } = {}) {
  const headCells = Array.from({ length: columns }, () => `<span class="skel-line skel-shimmer"></span>`).join('');
  const rowsHtml = Array.from({ length: rows }, () => `
    <div class="skel-row">
      <span class="skel-circle skel-shimmer"></span>
      <span class="skel-row-col">
        <span class="skel-line skel-shimmer"></span>
        <span class="skel-line skel-shimmer"></span>
      </span>
      <span class="skel-line skel-line--pill skel-shimmer"></span>
    </div>
  `).join('');
  return `
    <div class="skel-toolbar">
      <span class="skel-block skel-shimmer"></span>
      <span class="skel-block skel-shimmer"></span>
      <span class="skel-block skel-shimmer"></span>
    </div>
    <div class="skel-table">
      <div class="skel-table-head">${headCells}</div>
      ${rowsHtml}
    </div>
  `;
}

function buildGridSkeleton({ cards = DEFAULT_CARDS } = {}) {
  const cardsHtml = Array.from({ length: cards }, () => `
    <div class="skel-card">
      <div class="skel-card-thumb skel-block skel-shimmer"></div>
      <div class="skel-card-body">
        <span class="skel-line skel-shimmer"></span>
        <span class="skel-line skel-shimmer" style="width:60%"></span>
      </div>
    </div>
  `).join('');
  return `
    <div class="skel-toolbar">
      <span class="skel-block skel-shimmer"></span>
      <span class="skel-block skel-shimmer"></span>
    </div>
    <div class="skel-grid">${cardsHtml}</div>
  `;
}

function buildDashboardSkeleton({ cards = 4 } = {}) {
  const cardsHtml = Array.from({ length: cards }, () => `
    <div class="skel-summary-card">
      <span class="skel-line skel-shimmer"></span>
      <span class="skel-line skel-shimmer"></span>
    </div>
  `).join('');
  return `
    <div class="skel-summary-cards">${cardsHtml}</div>
    <div class="skel-table">
      <div class="skel-table-head">
        <span class="skel-line skel-shimmer"></span>
        <span class="skel-line skel-shimmer"></span>
        <span class="skel-line skel-shimmer"></span>
      </div>
      ${Array.from({ length: 4 }, () => `
        <div class="skel-row">
          <span class="skel-row-col"><span class="skel-line skel-shimmer"></span></span>
          <span class="skel-line skel-line--pill skel-shimmer"></span>
        </div>
      `).join('')}
    </div>
  `;
}

function buildDetailSkeleton({ sections = 3 } = {}) {
  const sectionsHtml = Array.from({ length: sections }, () => `
    <div class="skel-detail-section">
      <span class="skel-line skel-line--lg skel-shimmer"></span>
      <span class="skel-line skel-shimmer"></span>
      <span class="skel-line skel-shimmer" style="width:80%"></span>
      <span class="skel-line skel-shimmer" style="width:60%"></span>
    </div>
  `).join('');
  return `
    <div class="skel-detail-heading">
      <span class="skel-circle skel-shimmer"></span>
      <span class="skel-row-col">
        <span class="skel-line skel-line--lg skel-shimmer" style="width:220px"></span>
        <span class="skel-line skel-shimmer" style="width:140px"></span>
      </span>
    </div>
    ${sectionsHtml}
  `;
}

function buildFormSkeleton({ fields = 5 } = {}) {
  const fieldsHtml = Array.from({ length: fields }, () => `
    <div class="skel-form-field">
      <span class="skel-line skel-line--sm skel-shimmer"></span>
      <span class="skel-block skel-shimmer"></span>
    </div>
  `).join('');
  return `<div style="max-width:520px;">${fieldsHtml}</div>`;
}

const BUILDERS = {
  table: buildTableSkeleton,
  grid: buildGridSkeleton,
  dashboard: buildDashboardSkeleton,
  detail: buildDetailSkeleton,
  form: buildFormSkeleton,
};

/** Raw HTML for a given composition — for a caller that wants to manage insertion/timing itself. */
export function skeletonHtml(type, options) {
  const build = BUILDERS[type] || BUILDERS.table;
  return build(options || {});
}

/**
 * The full pattern: wait DEFAULT_DELAY_MS, then (if not cancelled by
 * then) insert the skeleton into `container` with aria-busy wired up.
 * Returns a handle whose .cancel() is always safe to call — before
 * the delay elapses (nothing ever shows), or after (removes it) —
 * so a caller never needs to know which case it's in, just call
 * cancel() the moment real content/empty/error state is ready.
 */
export function showSkeletonAfterDelay(container, type, options = {}) {
  const { delay = DEFAULT_DELAY_MS, label = 'Loading content' } = options;
  let cancelled = false;
  let mounted = false;
  const wrap = document.createElement('div');
  wrap.className = 'skel-wrap';
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-busy', 'true');
  wrap.setAttribute('aria-label', label);
  wrap.innerHTML = skeletonHtml(type, options);

  const timer = setTimeout(() => {
    if (cancelled || !container.isConnected) return;
    container.appendChild(wrap);
    mounted = true;
  }, delay);

  return {
    cancel() {
      cancelled = true;
      clearTimeout(timer);
      if (mounted && wrap.isConnected) wrap.remove();
      mounted = false;
    },
    get isShowing() { return mounted; },
  };
}
