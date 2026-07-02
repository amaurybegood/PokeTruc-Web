// Shared fullscreen card viewer (accessible dialog). Used by pokemon.js
// (detail + trainers pages) and app.js (index card view). Clicks are
// delegated from `root` so re-rendered grids keep working.
function initCardViewer(root) {
  const overlay  = document.getElementById('fullscreen');
  const fsImg    = document.getElementById('fullscreen-img');
  const closeBtn = document.getElementById('fullscreen-close');
  if (!overlay || !fsImg || !closeBtn || !root) return;
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

  root.addEventListener('click', e => {
    // Let the <details> description toggle without opening the viewer.
    if (e.target.closest('.card-description')) return;
    const item = e.target.closest('.card-item');
    if (item) openViewer(item);
  });

  overlay.querySelector('.fullscreen-backdrop').addEventListener('click', closeViewer);
  closeBtn.addEventListener('click', closeViewer);

  // The close button is the dialog's only focusable element: keep Tab on it
  // so focus can't escape to the page behind the overlay.
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeViewer();
  });
}
