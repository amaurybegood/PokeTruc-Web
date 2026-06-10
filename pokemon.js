// Pokémon detail page — fullscreen card viewer.
// All static content (Pokémon name, stats sentence, headings) is already
// localised in the HTML at build time, so this script only handles the
// fullscreen viewer interaction.

const CARD_FLASH_MS = 2000;

document.addEventListener('DOMContentLoaded', () => {
  const overlay  = document.getElementById('fullscreen');
  const fsImg    = document.getElementById('fullscreen-img');
  const closeBtn = document.getElementById('fullscreen-close');
  let opener = null; // element to give focus back to when the viewer closes

  function openViewer(item) {
    const thumb = item.querySelector('img');
    fsImg.src = item.dataset.img;
    fsImg.alt = thumb ? thumb.alt : '';
    overlay.classList.remove('hidden');
    opener = item.querySelector('.card-zoom') || item;
    closeBtn.focus();
  }

  function closeViewer() {
    if (overlay.classList.contains('hidden')) return;
    overlay.classList.add('hidden');
    fsImg.src = '';
    fsImg.alt = '';
    if (opener) { opener.focus(); opener = null; }
  }

  document.querySelectorAll('.card-item').forEach(item => {
    item.addEventListener('click', () => openViewer(item));
  });

  document.querySelectorAll('.card-item .card-description').forEach(d => {
    d.addEventListener('click', e => e.stopPropagation());
  });

  document.querySelector('.fullscreen-backdrop').addEventListener('click', closeViewer);
  closeBtn.addEventListener('click', closeViewer);

  // The close button is the dialog's only focusable element: keep Tab on it
  // so focus can't escape to the page behind the overlay.
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      closeBtn.focus();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeViewer();
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
        setTimeout(() => target.classList.remove('card-flash'), CARD_FLASH_MS);
      });
    }
  }
});
