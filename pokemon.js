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

  document.querySelector('.fullscreen-backdrop').addEventListener('click', () => {
    document.getElementById('fullscreen').classList.add('hidden');
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('fullscreen').classList.add('hidden');
    }
  });
});
