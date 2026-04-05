// Pokemon detail page — name localisation + fullscreen
// Depends on i18n.js (lang variable) being loaded first

document.addEventListener('DOMContentLoaded', () => {
  // Update Pokémon name to user's language
  const nameEl = document.querySelector('.pokemon-detail-name');
  if (nameEl) {
    const localName = nameEl.getAttribute(`data-name-${lang}`);
    if (localName) nameEl.textContent = localName;
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
