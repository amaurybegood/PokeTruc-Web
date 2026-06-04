// Pokémon detail page — fullscreen card viewer.
// All static content (Pokémon name, stats sentence, headings) is already
// localised in the HTML at build time, so this script only handles the
// fullscreen viewer interaction.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.card-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('fullscreen-img').src = item.dataset.img;
      document.getElementById('fullscreen').classList.remove('hidden');
    });
  });

  document.querySelectorAll('.card-item .card-description').forEach(d => {
    d.addEventListener('click', e => e.stopPropagation());
  });

  document.querySelector('.fullscreen-backdrop').addEventListener('click', () => {
    document.getElementById('fullscreen').classList.add('hidden');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('fullscreen').classList.add('hidden');
    }
  });

  // Deep-link: when arriving with #<imageName> (e.g. from the home News block),
  // scroll to that card and flash a highlight ring.
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const target = document.getElementById(hash);
    if (target && target.classList.contains('card-item')) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('card-flash');
        setTimeout(() => target.classList.remove('card-flash'), 2000);
      });
    }
  }
});
