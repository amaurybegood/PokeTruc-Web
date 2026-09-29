// Home page: "Browse the catalogue" (Pokémon tiles by region) and the All cards
// view (?view=cards), driven by the header search, exclusivity chips, region
// tabs, sort and load-more. Depends on viewer.js (escapeHtml, initCardViewer) and i18n.js (t, lang, pokemonName,
// langPathPrefix, flagLabel, chipLabel, regionName, exclusivityKey,
// exclusivityTag, cardYear, scrollBehavior).

const FLAG_TO_ISO = {
  '🇯🇵': 'ja', '🇬🇧': 'en', '🇨🇳': 'zh', '🇰🇷': 'ko', '🇩🇪': 'de',
  '🇪🇸': 'es', '🇫🇷': 'fr', '🇮🇹': 'it', '🇵🇹': 'pt', '🇵🇱': 'pl', '🇮🇩': 'id', '🇷🇺': 'ru',
  '🌍': 'west', '🏯': 'asia',
};
const ISO_TO_FLAG = Object.fromEntries(Object.entries(FLAG_TO_ISO).map(([f, i]) => [i, f]));
const FLAG_ORDER = ['🇯🇵', '🇬🇧', '🇨🇳', '🇰🇷', '🇩🇪', '🇪🇸', '🇫🇷', '🇮🇹', '🇵🇹', '🇵🇱', '🇮🇩', '🇷🇺', '🌍', '🏯'];
const PAGE_SIZE = 48;      // All cards: first page and each "Load more"
// Official national-dex range per generation, for the "#001–#151" label.
const GEN_RANGES = [null, [1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];

let pokemons = [];
let pokemonById = new Map();
let cards = [];
let searchQuery = '';
let langFilter = '';
let viewMode = 'pokemon'; // 'pokemon' | 'cards'
let jumpGen = 0;          // ?gen=N (Pokémon page breadcrumb): region to scroll to once
let cardList = [];        // All cards: current filtered + sorted list
let cardsShown = PAGE_SIZE;

const grid = document.getElementById('pokemon-grid');
const hideEmptyBox = document.getElementById('hide-empty');
const sortSelect = document.getElementById('card-sort');

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const pad3 = n => String(n).padStart(3, '0');

function readURLFilter() {
  const params = new URL(window.location).searchParams;
  const param = params.get('lang');
  if (param && ISO_TO_FLAG[param]) langFilter = param;
  if (params.get('view') === 'cards') viewMode = 'cards';
  jumpGen = Number(params.get('gen')) || 0;
  // ?q= lets detail pages link into a pre-filled search (artist names).
  const q = params.get('q');
  if (q) {
    searchQuery = q;
    document.getElementById('search').value = q;
  }
}

function syncURL() {
  const url = new URL(window.location);
  const set = (k, v) => v ? url.searchParams.set(k, v) : url.searchParams.delete(k);
  set('lang', langFilter);
  set('view', viewMode === 'cards' ? 'cards' : '');
  url.searchParams.delete('gen'); // one-shot jump, not a filter
  set('q', searchQuery.trim());
  history.replaceState(null, '', url);
}

function activeFlag() {
  return langFilter ? ISO_TO_FLAG[langFilter] : '';
}

async function loadData() {
  const loader = document.getElementById('loader');
  try {
    // window.DATA_V is a content hash injected at build time; it busts the
    // GitHub Pages cache (10 min) exactly when the data files change.
    const v = window.DATA_V ? `?v=${window.DATA_V}` : '';
    const [pkRes, cardRes] = await Promise.all([
      fetch(`/data/pokemons.json${v}`),
      fetch(`/data/pokemon_cards.json${v}`),
    ]);
    if (!pkRes.ok || !cardRes.ok) throw new Error('HTTP ' + (pkRes.status || cardRes.status));
    pokemons = (await pkRes.json()).sort((a, b) => a.id - b.id);
    pokemonById = new Map(pokemons.map(p => [p.id, p]));
    cards = await cardRes.json();
    loader.classList.add('hidden');
    renderLangFilter();
    applyFilter();
  } catch (e) {
    console.error('Data load failed:', e);
    loader.innerHTML = `
      <div role="alert" class="load-error">
        <p>${t('load.error')}</p>
        <button type="button" id="retry-load" class="btn btn-solid">${t('retry')}</button>
      </div>`;
    document.getElementById('retry-load').addEventListener('click', () => {
      loader.innerHTML = '<div class="loader-spinner" aria-label="Loading"></div>';
      loadData();
    });
  }
}

function cardsFor(pokemonId, flag) {
  return cards.filter(c => c.pokemonId === pokemonId && (!flag || exclusivityKey(c) === flag));
}

// Exclusivity chips: "All", then every group, largest first.
function renderLangFilter() {
  const container = document.getElementById('lang-filter');
  const counts = {};
  for (const c of cards) { const k = exclusivityKey(c); counts[k] = (counts[k] || 0) + 1; }
  // Sort by card count (desc); FLAG_ORDER breaks ties (stable sort).
  const flags = FLAG_ORDER.filter(f => counts[f]).sort((a, b) => counts[b] - counts[a]);

  const chip = (iso, label, n) =>
    `<button type="button" class="chip" data-iso="${iso}">${label} <span class="chip-count">${n}</span></button>`;
  container.innerHTML = [
    chip('', escapeHtml(t('filter.all')), cards.length),
    ...flags.map(f => chip(FLAG_TO_ISO[f],
      `<span class="chip-flag" aria-hidden="true">${f}</span>${escapeHtml(chipLabel(f))}`,
      counts[f])),
  ].join('');

  container.querySelectorAll('.chip[data-iso]').forEach(btn => {
    btn.addEventListener('click', () => {
      const iso = btn.dataset.iso;
      langFilter = (langFilter === iso) ? '' : iso;
      if (langFilter) window.umami?.track('lang-filter', { iso });
      cardsShown = PAGE_SIZE;
      syncURL();
      updateLangFilterActive();
      applyFilter();
    });
  });
  updateLangFilterActive();
}

function updateLangFilterActive() {
  const container = document.getElementById('lang-filter');
  container.querySelectorAll('.chip[data-iso]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.iso === langFilter));
  });
}

// "By Pokémon | All cards": real links (work without JS), switched in place.
document.querySelectorAll('.view-seg a[data-mode]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    if (viewMode === a.dataset.mode) return;
    viewMode = a.dataset.mode;
    cardsShown = PAGE_SIZE;
    syncURL();
    updateViewMode();
    applyFilter();
  });
});

function updateViewMode() {
  document.body.classList.toggle('view-cards', viewMode === 'cards');
  document.querySelectorAll('.view-seg a[data-mode]').forEach(a => {
    if (a.dataset.mode === viewMode) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const title = document.getElementById('browse-title');
  title.textContent = title.dataset[viewMode];
}

function genLabel(gen) {
  return gen ? t('generation').replace('{n}', gen) : t('generation.unknown');
}

// Region shortcuts: every region is listed below, the tabs (desktop) and the
// <select> (mobile) only jump to one. Hidden while searching.
function renderRegionNav(gens) {
  const nav = document.getElementById('gen-nav');
  if (gens.length <= 1 || searchQuery.trim()) { nav.innerHTML = ''; return; }
  nav.innerHTML = `
    <div class="region-tabs">${gens.map(g =>
      `<a href="#gen-${g}">${escapeHtml(regionName(g) || genLabel(g))}</a>`).join('')}</div>
    <label class="region-select">${escapeHtml(t('region'))}
      <select>${gens.map(g =>
        `<option value="${g}">${escapeHtml(regionName(g) ? `${regionName(g)} · ${genLabel(g)}` : genLabel(g))}</option>`).join('')}</select>
    </label>`;
  nav.querySelector('select').addEventListener('change', e => scrollToGen(Number(e.target.value)));
}

function scrollToGen(gen) {
  document.getElementById(`gen-${gen}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

// Announce filter/search results to screen readers (role="status" element).
function announceResults(count, kind = 'pokemon') {
  const status = document.getElementById('grid-status');
  if (count === 0) {
    status.textContent = kind === 'cards' ? t('no.cards') : t('no.pokemon');
  } else {
    const key = kind === 'cards' ? 'results.cards' : 'results.count';
    status.textContent = t(key).replace('{n}', count);
  }
}

function createTile(pokemon, flag, prefix) {
  const pkCards = cardsFor(pokemon.id, flag);
  const n = pkCards.length;
  // Tiles with cards are real links; tiles without cards stay inert divs.
  const el = document.createElement(n ? 'a' : 'div');
  el.className = 'pk-tile' + (n ? '' : ' no-cards');
  if (n) el.href = `${prefix}pokemon/${slugify(pokemon.name.en)}/`;

  const count = n === 1 ? t('tile.card') : t('tile.cards').replace('{n}', n);
  const badge = pokemon.researchStatus === 'coming_soon' ? ['soon', t('coming.soon')]
    : !n ? ['none', t('no.card')]
    : pokemon.researchStatus === 'in_progress' ? ['wip', `${count} · ${t('wip')}`]
    : ['', count];

  el.innerHTML = `
    <span class="pk-tile-art">
      <img src="/monsters/${pokemon.imageName}.webp" alt="" loading="lazy" decoding="async" width="92" height="92">
      <span class="pk-tile-no">#${pad3(pokemon.id)}</span>
    </span>
    <span class="pk-tile-body">
      <span class="pk-tile-name">${escapeHtml(pokemonName(pokemon))}</span>
      <span class="pk-tile-badge${badge[0] ? ' ' + badge[0] : ''}">${escapeHtml(badge[1])}</span>
    </span>`;

  if (n) {
    // Prefetch the thumbs: that's what the detail-page grid renders.
    el.addEventListener('pointerenter', () => {
      pkCards.forEach(card => { new Image().src = `/cards/thumbs/${card.imageName}.avif`; });
    }, { once: true });
  }
  return el;
}

function genSection(gen, members, flag, prefix) {
  const section = document.createElement('section');
  section.className = 'gen-section';
  const range = GEN_RANGES[gen];
  section.innerHTML = `<div class="gen-head">
      <h3 id="gen-${gen}">${escapeHtml(regionName(gen) ? `${genLabel(gen)} · ${regionName(gen)}` : genLabel(gen))}</h3>
      ${range ? `<span class="gen-range">#${pad3(range[0])}–#${pad3(range[1])}</span>` : ''}
    </div>`;
  const tiles = document.createElement('div');
  tiles.className = 'pk-grid';
  members.forEach(p => tiles.appendChild(createTile(p, flag, prefix)));
  section.appendChild(tiles);
  return section;
}

function renderGrid(list) {
  grid.className = 'browse-grid';
  grid.innerHTML = '';

  const gens = [...new Set(list.map(p => p.generation ?? 0))].sort((a, b) => a - b);
  renderRegionNav(gens);

  if (list.length === 0) {
    announceResults(0);
    grid.innerHTML = `<p id="empty-state">${t('no.pokemon')}</p>`;
    return;
  }

  const flag = activeFlag();
  const prefix = langPathPrefix();
  let count = 0;
  gens.forEach(gen => {
    const members = list.filter(p => (p.generation ?? 0) === gen);
    count += members.length;
    grid.appendChild(genSection(gen, members, flag, prefix));
  });
  announceResults(count);
  if (jumpGen) { scrollToGen(jumpGen); jumpGen = 0; }
}

function renderCardClient(card) {
  const p = pokemonById.get(card.pokemonId);
  const pName = p ? pokemonName(p) : '';
  const year = cardYear(card);
  const alt = `${pName} — ${card.name}${year ? ` (${year})` : ''}`;
  const code = [card.setNumber, year].filter(Boolean).join(' · ');
  return `
    <div class="card-item card-tile" id="${card.imageName}">
      <button type="button" class="card-zoom">
        <img src="/cards/thumbs/${card.imageName}.avif" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" width="480" height="671">
      </button>
      <div class="card-tile-cap">
        <div class="card-tile-top">
          <span class="card-tile-name">${escapeHtml(pName)}</span>
          <span class="tag" aria-hidden="true">${escapeHtml(exclusivityTag(card))}</span>
          <span class="visually-hidden">${escapeHtml(flagLabel(exclusivityKey(card)))}</span>
        </div>
        ${code ? `<span class="card-tile-code">${escapeHtml(code)}</span>` : ''}
        <span class="card-tile-set">${escapeHtml(card.name)}</span>
      </div>
    </div>`;
}

const SORTS = {
  newest: (a, b) => (b.releaseDate || String(b.year)).localeCompare(a.releaseDate || String(a.year)),
  oldest: (a, b) => (a.releaseDate || String(a.year)).localeCompare(b.releaseDate || String(b.year)),
  dex:    (a, b) => a.pokemonId - b.pokemonId || cardYear(a) - cardYear(b),
  // Uncredited cards go last.
  artist: (a, b) => (!a.artist - !b.artist) || (a.artist || '').localeCompare(b.artist || '', lang),
};

// All cards: first page, then "Load N more" appends the next slice.
function renderCardGrid(list) {
  grid.className = 'card-grid';
  cardList = list;
  document.getElementById('browse-count').textContent = t('cards.count').replace('{n}', list.length);
  announceResults(list.length, 'cards');
  document.getElementById('gen-nav').innerHTML = '';
  grid.innerHTML = list.length
    ? list.slice(0, cardsShown).map(renderCardClient).join('')
    : `<p id="empty-state">${t('no.cards')}</p>`;
  updateLoadMore();
}

function updateLoadMore() {
  const wrap = document.getElementById('load-more-wrap');
  const shown = Math.min(cardsShown, cardList.length);
  wrap.hidden = viewMode !== 'cards' || cardList.length === 0;
  const btn = document.getElementById('load-more');
  btn.hidden = shown >= cardList.length;
  btn.textContent = t('cards.loadMore').replace('{n}', Math.min(PAGE_SIZE, cardList.length - shown));
  document.getElementById('load-status').textContent =
    t('cards.showing').replace('{n}', shown).replace('{total}', cardList.length);
}

function loadMore() {
  const from = cardsShown;
  cardsShown += PAGE_SIZE;
  grid.insertAdjacentHTML('beforeend', cardList.slice(from, cardsShown).map(renderCardClient).join(''));
  updateLoadMore();
  return from;
}

document.getElementById('load-more').addEventListener('click', () => {
  // Keyboard users continue from the first newly loaded card.
  grid.querySelectorAll('.card-zoom')[loadMore()]?.focus();
});

// Infinite scroll: the next page loads as "Load more" nears the viewport (the
// button stays for keyboard users). Keeps loading while it is still in view,
// since the observer only fires again when visibility changes.
const loadMoreWrap = document.getElementById('load-more-wrap');
const AUTOLOAD_MARGIN = 800;
new IntersectionObserver(function autoLoad() {
  const btn = document.getElementById('load-more');
  if (viewMode !== 'cards' || loadMoreWrap.hidden || btn.hidden) return;
  if (loadMoreWrap.getBoundingClientRect().top > innerHeight + AUTOLOAD_MARGIN) return;
  loadMore();
  requestAnimationFrame(autoLoad);
}, { rootMargin: `${AUTOLOAD_MARGIN}px 0px` }).observe(loadMoreWrap);

function applyFilter() {
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = normalize(searchQuery.trim());
  const flag = activeFlag();
  // A search turns the home page into a results page (hero and news hidden).
  document.body.classList.toggle('searching', !!q);

  const pokemonMatches = p =>
    normalize(p.name.en).includes(q)
    || normalize(p.name.fr).includes(q)
    || normalize(pokemonName(p)).includes(q)
    || String(p.id).includes(q);

  // Cards also match on set name and artist.
  const cardMatches = c =>
    normalize(c.name).includes(q)
    || (c.artist && normalize(c.artist).includes(q));

  if (viewMode === 'cards') {
    let list = cards.filter(c => !flag || exclusivityKey(c) === flag);
    if (q) list = list.filter(c => {
      const p = pokemonById.get(c.pokemonId);
      return (p && pokemonMatches(p)) || cardMatches(c);
    });
    renderCardGrid(list.slice().sort(SORTS[sortSelect.value] || SORTS.newest));
    return;
  }

  updateLoadMore();
  let filtered = pokemons;
  if (flag) filtered = filtered.filter(p => cards.some(c => c.pokemonId === p.id && exclusivityKey(c) === flag));
  else if (hideEmptyBox.checked) filtered = filtered.filter(p => cards.some(c => c.pokemonId === p.id));
  if (q) filtered = filtered.filter(p => pokemonMatches(p) || cards.some(c => c.pokemonId === p.id && cardMatches(c)));
  renderGrid(filtered);
}

document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value;
  cardsShown = PAGE_SIZE;
  syncURL();
  applyFilter();
});
// Enter in the header field: stay on this page (results are already live).
document.getElementById('site-search').addEventListener('submit', e => e.preventDefault());
hideEmptyBox.addEventListener('change', applyFilter);
sortSelect.addEventListener('change', () => { cardsShown = PAGE_SIZE; applyFilter(); });

// Card viewer over the whole filtered list (viewer.js). Delegated from the grid
// because cards are re-rendered on every filter change.
initCardViewer(grid, item => {
  const p = c => pokemonById.get(c.pokemonId);
  return {
    list: cardList,
    index: Math.max(0, cardList.findIndex(c => c.imageName === item.id)),
    who: c => (p(c) ? pokemonName(p(c)) : ''),
    url: c => (p(c) ? `${langPathPrefix()}pokemon/${slugify(p(c).name.en)}/` : ''),
    back: t('all.cards'),
    group: t('all.cards'),
  };
});

readURLFilter();
updateViewMode();
loadData();
