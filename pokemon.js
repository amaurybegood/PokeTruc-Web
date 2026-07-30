// Pokémon detail + trainers pages. All static content (Pokémon name, stats
// sentence, headings) is already localised in the HTML at build time, so this
// script only wires the shared fullscreen viewer (viewer.js) and the
// deep-link highlight.

const CARD_FLASH_MS = 2000;

document.addEventListener('DOMContentLoaded', () => {
  initCardViewer(document);

  // Deep-link: when arriving with #<imageName> (e.g. from the home News block),
  // scroll to that card and flash a highlight ring.
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const target = document.getElementById(hash);
    if (target && target.classList.contains('card-item')) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
        target.classList.add('card-flash');
        setTimeout(() => target.classList.remove('card-flash'), CARD_FLASH_MS);
      });
    }
  }
});
