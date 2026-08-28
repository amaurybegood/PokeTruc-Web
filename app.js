// Pokédex grid (index page) — dynamic search + grid render + exclusivity filter.
// Depends on i18n.js (t, lang, pokemonName, langPathPrefix).

const FLAG_TO_ISO = {
  '🇯🇵': 'ja', '🇬🇧': 'en', '🇨🇳': 'zh', '🇰🇷': 'ko', '🇩🇪': 'de',
  '🇪🇸': 'es', '🇫🇷': 'fr', '🇮🇹': 'it', '🇵🇹': 'pt', '🇵🇱': 'pl', '🇮🇩': 'id', '🇷🇺': 'ru',
  '🌍': 'west', '🏯': 'asia',
};
const ISO_TO_FLAG = Object.fromEntries(Object.entries(FLAG_TO_ISO).map(([f, i]) => [i, f]));
const FLAG_ORDER = ['🇯🇵', '🇬🇧', '🇨🇳', '🇰🇷', '🇩🇪', '🇪🇸', '🇫🇷', '🇮🇹', '🇵🇹', '🇵🇱', '🇮🇩', '🇷🇺', '🌍', '🏯'];

// Mirror of build.js exclusivityKey(). Region (if stored) wins; otherwise the
// card is keyed by its single language flag.
function exclusivityKey(card) {
  if (card.region === 'western') return '🌍';
  if (card.region === 'asian')   return '🏯';
  if (card.languages.length === 1) return card.languages[0];
  return null;
}

let pokemons = [];
let pokemonById = new Map();
let cards = [];
let searchQuery = '';
let langFilter = '';
let viewMode = 'pokemon'; // 'pokemon' | 'cards'

// Minimal HTML escaper for the few card fields rendered into innerHTML below.
// Mirrors build.js escapeHtml() for the subset of fields the card view shows.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function readURLFilter() {
  const params = new URL(window.location).searchParams;
  const param = params.get('lang');
  if (param && ISO_TO_FLAG[param]) langFilter = param;
  if (params.get('view') === 'cards') viewMode = 'cards';
  // ?q= lets detail pages link into a pre-filled search (artist names).
  const q = params.get('q');
  if (q) {
    searchQuery = q;
    const input = document.getElementById('search');
    if (input) input.value = q;
  }
}

function syncURL() {
  const url = new URL(window.location);
  if (langFilter) url.searchParams.set('lang', langFilter);
  else url.searchParams.delete('lang');
  if (viewMode === 'cards') url.searchParams.set('view', 'cards');
  else url.searchParams.delete('view');
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
    readURLFilter();
    renderLangFilter();
    renderViewToggle();
    applyFilter();
  } catch (e) {
    console.error('Data load failed:', e);
    loader.innerHTML = `
      <div role="alert" style="text-align:center;padding:24px;">
        <p style="color:var(--text);margin-bottom:16px;font-weight:500;">${t('load.error')}</p>
        <button type="button" id="retry-load" style="padding:8px 18px;border:1px solid var(--accent-fill);background:var(--accent-fill);color:var(--accent-contrast);border-radius:999px;cursor:pointer;font-size:0.9rem;font-weight:500;">${t('retry')}</button>
      </div>`;
    const btn = document.getElementById('retry-load');
    if (btn) btn.addEventListener('click', () => {
      loader.innerHTML = '<div class="loader-spinner" aria-label="Loading"></div>';
      loadData();
    });
  }
}

function cardsFor(pokemonId, flag) {
  return cards.filter(c => c.pokemonId === pokemonId && (!flag || exclusivityKey(c) === flag));
}

function renderLangFilter() {
  const container = document.getElementById('lang-filter');
  if (!container) return;

  const counts = {};
  for (const c of cards) { const k = exclusivityKey(c); counts[k] = (counts[k] || 0) + 1; }

  const total = cards.length;
  // Sort chips by card count (desc); FLAG_ORDER breaks ties (stable sort).
  const flags = FLAG_ORDER.filter(f => counts[f]).sort((a, b) => counts[b] - counts[a]);

  const chips = [
    `<button type="button" class="lang-filter-chip" data-iso="">${t('filter.all')} <span class="lang-filter-count">${total}</span></button>`,
    ...flags.map(f => {
      const iso = FLAG_TO_ISO[f];
      return `<button type="button" class="lang-filter-chip" data-iso="${iso}"><span class="lang-filter-flag" aria-hidden="true">${f}</span><span class="visually-hidden">${escapeHtml(flagLabel(f))}</span> <span class="lang-filter-count">${counts[f]}</span></button>`;
    }),
  ];

  container.innerHTML = chips.join('');

  container.querySelectorAll('.lang-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const iso = chip.dataset.iso;
      langFilter = (langFilter === iso) ? '' : iso;
      if (langFilter) window.umami?.track('lang-filter', { iso });
      syncURL();
      updateLangFilterActive();
      applyFilter();
    });
  });

  updateLangFilterActive();
}

function updateLangFilterActive() {
  const container = document.getElementById('lang-filter');
  if (!container) return;
  container.querySelectorAll('.lang-filter-chip').forEach(chip => {
    const active = chip.dataset.iso === langFilter;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
}

// Segmented toggle: switch the grid between Pokémon tiles and a flat card view.
function renderViewToggle() {
  const container = document.getElementById('view-toggle');
  if (!container) return;

  const modes = [
    { mode: 'pokemon', label: t('view.pokemon') },
    { mode: 'cards', label: t('view.cards') },
  ];
  container.innerHTML = modes.map(m =>
    `<button type="button" class="view-toggle-btn" data-mode="${m.mode}">${m.label}</button>`
  ).join('');

  container.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (viewMode === btn.dataset.mode) return;
      viewMode = btn.dataset.mode;
      syncURL();
      updateViewToggleActive();
      applyFilter();
    });
  });

  updateViewToggleActive();
}

function updateViewToggleActive() {
  const container = document.getElementById('view-toggle');
  if (!container) return;
  container.querySelectorAll('.view-toggle-btn').forEach(btn => {
    const active = btn.dataset.mode === viewMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function createTile(pokemon, flag, prefix) {
  const pkCards = cardsFor(pokemon.id, flag);
  const hasCards = pkCards.length > 0;

  // Tiles with cards are real links: keyboard-operable and middle-clickable
  // for free; tiles without cards stay inert divs.
  const div = document.createElement(hasCards ? 'a' : 'div');
  div.className = 'pokemon-card' + (hasCards ? '' : ' no-cards');
  if (hasCards) div.href = `${prefix}pokemon/${slugify(pokemon.name.en)}/`;

  const badgeClass = pokemon.researchStatus === 'in_progress' ? 'badge wip'
    : pokemon.researchStatus === 'coming_soon' ? 'badge coming-soon'
    : !hasCards ? 'badge no-card'
    : 'badge';

  const badgeLabel = pokemon.researchStatus === 'coming_soon' ? t('coming.soon')
    : pokemon.researchStatus === 'in_progress' ? `${pkCards.length} · ${t('wip')}`
    : hasCards ? String(pkCards.length)
    : t('no.card');

  div.innerHTML = `
    <span class="pokemon-number">#${pokemon.id}</span>
    <img src="/monsters/${pokemon.imageName}.webp" alt="${pokemonName(pokemon)}" loading="lazy" decoding="async" width="72" height="72">
    <div class="name">${pokemonName(pokemon)}</div>
    <span class="${badgeClass}">${badgeLabel}</span>
  `;

  if (hasCards) {
    // Prefetch the thumbs: that's what the detail-page grid renders.
    div.addEventListener('pointerenter', () => {
      pkCards.forEach(card => {
        const img = new Image();
        img.src = `/cards/thumbs/${card.imageName}.avif`;
      });
    }, { once: true });
  }

  return div;
}

function genLabel(gen) {
  return gen ? t('generation').replace('{n}', gen) : t('generation.unknown');
}

// Jump-to-generation shortcut chips. Shown only when 2+ generations are visible;
// clicking a chip smooth-scrolls to that generation's section heading.
function renderGenNav(gens) {
  const nav = document.getElementById('gen-nav');
  if (!nav) return;
  nav.innerHTML = '';
  if (gens.length <= 1) return;
  gens.forEach(gen => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gen-nav-chip';
    btn.textContent = (gen && regionName(gen)) || genLabel(gen);
    btn.addEventListener('click', () => {
      document.getElementById('gen-' + gen)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    });
    nav.appendChild(btn);
  });
}

// Announce filter/search results to screen readers (role="status" element).
function announceResults(count, kind = 'pokemon') {
  const status = document.getElementById('grid-status');
  if (!status) return;
  if (count === 0) {
    status.textContent = kind === 'cards' ? t('no.cards') : t('no.pokemon');
  } else {
    const key = kind === 'cards' ? 'results.cards' : 'results.count';
    status.textContent = t(key).replace('{n}', count);
  }
}

function renderGrid(list) {
  const grid = document.getElementById('pokemon-grid');
  grid.className = ''; // drop card-view layout if returning from the card view
  grid.innerHTML = '';
  announceResults(list.length);

  if (list.length === 0) {
    grid.innerHTML = `<p id="empty-state">${t('no.pokemon')}</p>`;
    renderGenNav([]);
    return;
  }

  const flag = activeFlag();
  const prefix = langPathPrefix();

  // Group into generation sections only when the dex actually spans more than
  // one generation; otherwise keep the original flat grid.
  const multiGen = new Set(pokemons.map(p => p.generation).filter(Boolean)).size > 1;

  if (!multiGen) {
    list.forEach(p => grid.appendChild(createTile(p, flag, prefix)));
    renderGenNav([]);
    return;
  }

  const gens = [...new Set(list.map(p => p.generation ?? 0))].sort((a, b) => a - b);
  const rendered = [];
  gens.forEach(gen => {
    const members = list.filter(p => (p.generation ?? 0) === gen);
    if (!members.length) return;
    const heading = document.createElement('h2');
    heading.className = 'gen-heading';
    heading.id = 'gen-' + gen;
    const region = gen ? regionName(gen) : '';
    heading.textContent = region ? `${genLabel(gen)} · ${region}` : genLabel(gen);
    grid.appendChild(heading);
    members.forEach(p => grid.appendChild(createTile(p, flag, prefix)));
    rendered.push(gen);
  });

  renderGenNav(rendered);
}

// Mirror of build.js linkifyDescription(): turn bare URLs in a note into a
// labelled "source ↗" link, keeping any trailing punctuation outside the anchor.
function linkifyDescription(text) {
  const escaped = escapeHtml(text);
  const linkText = escapeHtml(t('card.source'));
  const ariaLabel = escapeHtml(`${t('card.source')} (${t('card.newtab')})`);
  return escaped.replace(/https?:\/\/[^\s]+/g, (match) => {
    const trailMatch = match.match(/[.,;:!?]+$/);
    const trail = trailMatch ? trailMatch[0] : '';
    const url = trail ? match.slice(0, -trail.length) : match;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}">${linkText}<span aria-hidden="true"> ↗</span></a>${trail}`;
  });
}

// Client-side card tile. Mirrors the structure of build.js renderCard() (same
// .card-item / data-img / id so the fullscreen viewer and CSS work unchanged),
// but adds the Pokémon name line since the card view mixes all species, and
// drops the build-only rich alt text.
// Mirror of build.js cardDetailLines(): optional lines from the DexTCG
// enrichment (set number, type/stage/variants, release product + date).
function cardDetailLines(card) {
  const setLine = card.setNumber
    ? `<div class="card-set">${escapeHtml(card.setNumber)}${card.series ? ` · ${escapeHtml(card.series)}` : ''}</div>` : '';
  const traits = [card.energyType, card.stage, (card.variants || []).join(', ')].filter(Boolean);
  const traitsLine = traits.length
    ? `<div class="card-traits">${escapeHtml(traits.join(' · '))}</div>` : '';
  const date = card.releaseDate
    ? new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(card.releaseDate)) : '';
  const releaseLine = card.releaseProduct
    ? `<div class="card-release">${escapeHtml(card.releaseProduct)}${date ? ` — ${escapeHtml(date)}` : ''}</div>` : '';
  return setLine + traitsLine + releaseLine;
}

function renderCardClient(card) {
  const p = pokemonById.get(card.pokemonId);
  const pName = p ? pokemonName(p) : '';
  const year = card.year ? ` (${card.year})` : '';
  const alt = `${pName} — ${card.name}${year}`;
  return `
    <div class="card-item" id="${card.imageName}" data-img="/cards/${card.imageName}.avif">
      <button type="button" class="card-zoom">
        <img src="/cards/thumbs/${card.imageName}.avif" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">
      </button>
      <div class="card-info">
        ${pName ? `<div class="card-pokemon-name">${escapeHtml(pName)}</div>` : ''}
        <div class="card-name">${escapeHtml(card.name)}</div>
        ${cardDetailLines(card)}
        <div class="card-meta"><span class="lang-badge"><span aria-hidden="true">${card.languages.join(' ')}</span><span class="visually-hidden">${escapeHtml(card.languages.map(flagLabel).join(', '))}</span></span> ${card.year} · ${escapeHtml(card.rarity)}</div>
        ${card.artist ? `<div class="card-artist">${escapeHtml(t('card.artist'))}: ${escapeHtml(card.artist)}</div>` : ''}
        ${card.description ? `<details class="card-description">
          <summary class="card-description-toggle">${escapeHtml(t('card.note'))}</summary>
          <div class="card-description-body">${linkifyDescription(card.description)}</div>
        </details>` : ''}
      </div>
    </div>`;
}

// Flat card view: every card matching the current language filter + search,
// across all species, sorted by Pokédex number then year.
function renderCardGrid(list) {
  const grid = document.getElementById('pokemon-grid');
  grid.className = 'card-view';
  announceResults(list.length, 'cards');
  renderGenNav([]); // no generation sections in the card view

  if (list.length === 0) {
    grid.innerHTML = `<p id="empty-state">${t('no.cards')}</p>`;
    return;
  }

  grid.innerHTML = list.map(renderCardClient).join('');
}

function applyFilter() {
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = normalize(searchQuery);
  const flag = activeFlag();

  const pokemonMatches = p =>
    normalize(p.name.en).includes(q)
    || normalize(p.name.fr).includes(q)
    || normalize(pokemonName(p)).includes(q)
    || String(p.id).includes(q);

  // Cards also match on set name and artist (both shown in the card view).
  const cardMatches = c =>
    normalize(c.name).includes(q)
    || (c.artist && normalize(c.artist).includes(q));

  if (viewMode === 'cards') {
    let list = cards.filter(c => !flag || exclusivityKey(c) === flag);
    if (q) list = list.filter(c => {
      const p = pokemonById.get(c.pokemonId);
      return (p && pokemonMatches(p)) || cardMatches(c);
    });
    list = list.slice().sort((a, b) => a.pokemonId - b.pokemonId || (a.year || 0) - (b.year || 0));
    renderCardGrid(list);
    return;
  }

  let filtered = pokemons;
  if (flag) filtered = filtered.filter(p => cards.some(c => c.pokemonId === p.id && exclusivityKey(c) === flag));
  if (q) filtered = filtered.filter(p => pokemonMatches(p) || cards.some(c => c.pokemonId === p.id && cardMatches(c)));
  renderGrid(filtered);
}

document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value;
  applyFilter();
});

// Fullscreen card viewer for the card view (shared logic in viewer.js).
// Delegated from the grid because cards are re-rendered on every filter change.
initCardViewer(document.getElementById('pokemon-grid'));

loadData();
