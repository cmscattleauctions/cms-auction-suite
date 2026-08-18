/* Shared formatting/escaping helpers used across the view modules. */

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatDuration(sec) {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function sexShort(label) {
  if (!label) return '—';
  if (label === 'Steers & Heifers') return 'S&H';
  if (label === 'Steers') return 'STR';
  if (label === 'Heifers') return 'HFR';
  return label;
}

/** "0826" -> "Aug 26" (compact, for the one-line cattle summary / dense table). */
export function formatMonthYearShort(mmyy) {
  if (!mmyy || mmyy.length !== 4) return mmyy || '—';
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mm = Number(mmyy.slice(0, 2));
  const yy = mmyy.slice(2);
  const label = months[mm] || mmyy.slice(0, 2);
  return `${label} ${yy}`;
}

/** One-line cattle summary: "HFR · Angus × Jersey · 450 lb · Aug 26" */
export function cattleSummaryLine({ sexLabel, sireLabel, damLabel, weight, monthYear }) {
  return `${sexShort(sexLabel)} · ${sireLabel} × ${damLabel} · ${weight} lb · ${formatMonthYearShort(monthYear)}`;
}
