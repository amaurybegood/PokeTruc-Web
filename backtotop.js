// Floating "back to top" button — injected on every page (loaded after i18n.js,
// so the t() helper is available for the localised label). Appears once the user
// has scrolled down, smooth-scrolls to the top on click.

(function () {
  function init() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', typeof t === 'function' ? t('back.to.top') : 'Back to top');
    btn.textContent = '↑';
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: typeof scrollBehavior === 'function' ? scrollBehavior() : 'smooth' }));
    document.body.appendChild(btn);

    const toggle = () => btn.classList.toggle('visible', window.scrollY > 400);
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
