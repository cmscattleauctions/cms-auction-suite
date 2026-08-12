/* Tiny shared toast helper — "Copied" feedback etc. */
export function showToast(message) {
  const root = document.getElementById('vm-toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'vm-toast';
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}
