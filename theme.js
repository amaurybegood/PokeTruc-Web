function getTheme() {
  try { return localStorage.getItem('theme') || 'auto'; }
  catch { return 'auto'; }
}

function setTheme(value) {
  try { localStorage.setItem('theme', value); } catch {}
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');

  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.textContent = theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '🌓';
  // aria-label reflects current state (depends on i18n.js being loaded first).
  const label = (typeof t === 'function')
    ? t('theme.' + theme)
    : ({ dark: 'Dark theme', light: 'Light theme', auto: 'Auto theme' })[theme];
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(theme === 'dark'));
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark')
    : current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  applyTheme(next);
}

applyTheme(getTheme());
const themeBtn = document.getElementById('theme-toggle');
if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
