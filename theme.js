function getTheme() {
  return localStorage.getItem('theme') || 'auto';
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  else if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');

  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '🌓';
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark')
    : current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
}

applyTheme(getTheme());
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
