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

  // Mobile menu: Light / Dark / System radios.
  document.querySelectorAll('input[name="theme-choice"]').forEach((r) => {
    r.checked = (r.value === theme);
  });

  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  // Icon (moon / sun) is switched in CSS from data-theme. aria-label reflects
  // current state (depends on i18n.js being loaded first).
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

document.addEventListener('change', (e) => {
  if (e.target.name !== 'theme-choice') return;
  setTheme(e.target.value);
  applyTheme(e.target.value);
});

// Mobile menu (native <dialog>: Esc, inert page and focus return come free).
const siteMenu = document.getElementById('site-menu');
document.getElementById('menu-open')?.addEventListener('click', () => siteMenu?.showModal());
document.getElementById('menu-close')?.addEventListener('click', () => siteMenu?.close());

document.addEventListener('click', (e) => {
  document.querySelectorAll('.lang-picker[open]').forEach((picker) => {
    if (!picker.contains(e.target)) picker.open = false;
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const picker = document.querySelector('.lang-picker[open]');
  if (!picker) return;
  picker.open = false;
  picker.querySelector('summary')?.focus();
});

// Umami counts a pageview on every history.replaceState that changes the URL,
// i.e. each home filter click or search keystroke (app.js syncURL). Keep only
// the page load: every page is a real document, there is no client routing.
let umamiPageviewSent = false;
window.umamiBeforeSend = (type, payload) => {
  if (type !== 'event' || payload.name) return payload;
  if (umamiPageviewSent) return null;
  umamiPageviewSent = true;
  return payload;
};

// Umami: every link to another site (sources, marketplaces, Sketchdex, credits).
// They all open in a new tab, so the request goes out before anything unloads.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="http"]');
  if (!a || a.host === location.host || a.dataset.umamiEvent) return;
  window.umami?.track('outbound', { host: a.hostname.replace(/^www\./, ''), url: a.href });
});

// Seasonal in-page logo (favicon and og:image untouched): Halloween 15–31 Oct
// (Mimiqui), Christmas 1 Dec – 6 Jan (Santa hat). ?halloween=1 / ?christmas=1
// forces one on outside its season, =0 turns it off.
(() => {
  const now = new Date();
  const m = now.getMonth();
  const d = now.getDate();
  const params = new URLSearchParams(location.search);
  const pick = [['halloween', m === 9 && d >= 15], ['christmas', m === 11 || (m === 0 && d <= 6)]]
    .find(([name, season]) => params.get(name) === '1' || (season && params.get(name) !== '0'));
  if (!pick) return;
  document.querySelectorAll('img[src="/logo.webp"]').forEach((img) => { img.src = `/logo-${pick[0]}.webp`; });
})();
