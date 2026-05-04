// Pokemon detail page — name localisation + fullscreen
// Depends on i18n.js (lang variable) being loaded first

document.addEventListener('DOMContentLoaded', () => {
  // Update Pokémon name to user's language
  const nameEl = document.querySelector('.pokemon-detail-name');
  if (nameEl) {
    const localName = nameEl.getAttribute(`data-name-${lang}`);
    if (localName) nameEl.textContent = localName;
  }

  // Swap the auto-generated stats paragraph to user's language. The HTML ships
  // with English visible (so Google indexes it); other locales come from
  // data-stats-{lang} attributes embedded at build time.
  const statsEl = document.querySelector('.pokemon-stats-text');
  if (statsEl) {
    const localStats = statsEl.getAttribute(`data-stats-${lang}`);
    if (localStats) statsEl.textContent = localStats;
  }

  // Fullscreen card viewer
  document.querySelectorAll('.card-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('fullscreen-img').src = item.dataset.img;
      document.getElementById('fullscreen').classList.remove('hidden');
    });
  });

  document.querySelector('.fullscreen-backdrop').addEventListener('click', () => {
    document.getElementById('fullscreen').classList.add('hidden');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('fullscreen').classList.add('hidden');
    }
  });
});
