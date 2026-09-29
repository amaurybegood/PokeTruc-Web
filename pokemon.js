// Pokémon page (DESIGN_HANDOFF 4.2): card click opens the detail panel
// (desktop) or the card details sheet (mobile), group accordions,
// jump chips, client-side sort and #<imageName> deep links; the Trainers
// gallery (viewer, chips, sort). Card data and dialogs live in viewer.js.

const CARD_FLASH_MS = 2000;
const WIDE = matchMedia('(min-width: 1024px)'); // side panel above, sheet below

const panel = document.getElementById('card-panel');
const content = document.querySelector('.pk-content');
const who = document.querySelector('.pk-name')?.textContent || '';

function groupLabel(item) {
  return item.closest('.card-group')?.querySelector('.group-title')?.textContent || '';
}

function openViewerAt(item) {
  const list = domGroupList(item);
  openCardViewer({
    list,
    index: Math.max(0, list.findIndex(c => c.imageName === item.id)),
    who: () => who,
    back: who,
    group: groupLabel(item),
    // Keep the panel in step with the card the viewer ended on (re-rendering
    // it drops the focus the dialog just restored, so put it back).
    onClose: card => {
      if (panel.hidden || selected?.id === card.imageName) return;
      selectCard(document.getElementById(card.imageName), false);
      panel.querySelector('[data-act="full"]').focus();
    },
  });
}

// Detail panel (desktop).
let selected = null;
function selectCard(item, track = true) {
  const card = item && pageCards.get(item.id);
  if (!card) return;
  if (track) window.umami?.track('card-details', { card: card.imageName });
  selected?.querySelector('.card-open').removeAttribute('aria-current');
  selected = item;
  item.querySelector('.card-open').setAttribute('aria-current', 'true');
  panel.setAttribute('aria-labelledby', 'details-title-panel');
  panel.innerHTML = cardDetailsHTML(card, who, 'panel');
  panel.hidden = false;
  content.classList.add('has-panel');
}

function closePanel() {
  const item = selected;
  selected?.querySelector('.card-open').removeAttribute('aria-current');
  selected = null;
  panel.hidden = true;
  content.classList.remove('has-panel');
  item?.querySelector('.card-open').focus();
}

// Opens the group (accordion) holding `item` if it was collapsed.
function reveal(item) {
  const toggle = item.closest('.card-group')?.querySelector('.group-toggle');
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
}

function initPokemonPage() {
  const groups = document.querySelector('.pk-groups');

  groups.addEventListener('click', e => {
    const link = e.target.closest('.card-open');
    if (link) {
      e.preventDefault();
      const item = link.closest('.card-item');
      if (WIDE.matches) selectCard(item);
      else openCardSheet(pageCards.get(item.id), { who, onFull: () => openViewerAt(item) });
      return;
    }
    const toggle = e.target.closest('.group-toggle');
    if (toggle) {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      document.getElementById(toggle.getAttribute('aria-controls')).hidden = !open;
    }
  });

  panel.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') closePanel();
    if (act === 'full') openViewerAt(selected);
    if (act === 'copy') copyCardLink(e.target.closest('button'), cardHref(pageCards.get(selected.id)));
  });

  // Jump chips: open the target group before the browser scrolls to it.
  document.querySelector('.jump-chips')?.addEventListener('click', e => {
    const chip = e.target.closest('a.chip');
    if (!chip) return;
    const section = document.querySelector(chip.getAttribute('href'));
    const toggle = section?.querySelector('.group-toggle');
    if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
    chip.parentElement.querySelectorAll('.chip').forEach(c => c.removeAttribute('aria-current'));
    chip.setAttribute('aria-current', 'true');
  });

  const price = c => { const p = marketPrices(c)[0]; return p ? p.value : -1; };
  const release = c => c.releaseDate || String(c.year);
  const SORTS = {
    oldest: (a, b) => release(a).localeCompare(release(b)),
    newest: (a, b) => release(b).localeCompare(release(a)),
    artist: (a, b) => (!a.artist - !b.artist) || (a.artist || '').localeCompare(b.artist || '', lang),
    price:  (a, b) => price(b) - price(a),
  };
  document.getElementById('pk-sort')?.addEventListener('change', e => {
    const cmp = SORTS[e.target.value];
    document.querySelectorAll('.pk-groups .cards-grid').forEach(grid => {
      [...grid.children]
        .sort((a, b) => cmp(pageCards.get(a.id), pageCards.get(b.id)))
        .forEach(el => grid.appendChild(el));
    });
  });
}

// #<imageName> (News block, "Copy card link"): open its group, scroll to the
// card, flash the ring and, on desktop, show it in the panel.
function followHash() {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target || !target.classList.contains('card-item')) return;
  if (panel) reveal(target);
  if (panel && WIDE.matches) selectCard(target, false);
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    target.classList.add('card-flash');
    setTimeout(() => target.classList.remove('card-flash'), CARD_FLASH_MS);
  });
}

// Trainers page (DESIGN_HANDOFF 4.8): a card opens the viewer on its group;
// exclusivity chips show one group, the sort reorders every grid.
function initTrainersPage() {
  document.querySelector('.tr-page').addEventListener('click', e => {
    const link = e.target.closest('.card-open');
    if (!link) return;
    e.preventDefault();
    const item = link.closest('.card-item');
    const list = domGroupList(item);
    openCardViewer({
      list,
      index: Math.max(0, list.findIndex(c => c.imageName === item.id)),
      who: c => c.cardName,
      back: document.querySelector('.tr-hero h1').textContent,
      group: item.closest('.tr-group').querySelector('h2').textContent,
    });
  });

  document.querySelectorAll('.tr-filters .chip').forEach(chip => chip.addEventListener('click', () => {
    const id = chip.dataset.group;
    document.querySelectorAll('.tr-filters .chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    document.querySelectorAll('.tr-group').forEach(g => { g.hidden = !!id && g.id !== id; });
  }));

  const release = c => c.releaseDate || String(c.year);
  const SORTS = {
    newest: (a, b) => release(b).localeCompare(release(a)),
    oldest: (a, b) => release(a).localeCompare(release(b)),
    name:   (a, b) => a.cardName.localeCompare(b.cardName, lang),
  };
  document.getElementById('tr-sort')?.addEventListener('change', e => {
    const cmp = SORTS[e.target.value];
    document.querySelectorAll('.tr-grid').forEach(grid => {
      [...grid.children]
        .sort((a, b) => cmp(pageCards.get(a.id), pageCards.get(b.id)))
        .forEach(el => grid.appendChild(el));
    });
  });
}

if (panel) initPokemonPage();
else if (document.querySelector('.tr-page')) initTrainersPage();
followHash();
window.addEventListener('hashchange', followHash);
