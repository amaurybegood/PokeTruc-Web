// Pokédex grid (index page) — dynamic search + grid render + exclusivity filter.
// Depends on i18n.js (t, lang, pokemonName, langPathPrefix).

const FLAG_TO_ISO = {
  '🇯🇵': 'ja', '🇬🇧': 'en', '🇨🇳': 'zh', '🇰🇷': 'ko', '🇩🇪': 'de',
  '🇪🇸': 'es', '🇫🇷': 'fr', '🇮🇹': 'it', '🇵🇹': 'pt', '🇵🇱': 'pl', '🇮🇩': 'id',
  '🌍': 'west', '🏯': 'asia',
};
const ISO_TO_FLAG = Object.fromEntries(Object.entries(FLAG_TO_ISO).map(([f, i]) => [i, f]));
const FLAG_ORDER = ['🇯🇵', '🇬🇧', '🇨🇳', '🇰🇷', '🇩🇪', '🇪🇸', '🇫🇷', '🇮🇹', '🇵🇹', '🇵🇱', '🇮🇩', '🌍', '🏯'];

// Mirror of build.js exclusivityKey(). Region (if stored) wins; otherwise the
// card is keyed by its single language flag.
function exclusivityKey(card) {
  if (card.region === 'western') return '🌍';
  if (card.region === 'asian')   return '🏯';
  if (card.languages.length === 1) return card.languages[0];
  return null;
}

let pokemons = [];
let cards = [];
let searchQuery = '';
let langFilter = '';

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
  const param = new URL(window.location).searchParams.get('lang');
  if (param && ISO_TO_FLAG[param]) langFilter = param;
}

function syncURL() {
  const url = new URL(window.location);
  if (langFilter) url.searchParams.set('lang', langFilter);
  else url.searchParams.delete('lang');
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
    cards = await cardRes.json();
    loader.classList.add('hidden');
    readURLFilter();
    renderLangFilter();
    applyFilter();
  } catch (e) {
    console.error('Data load failed:', e);
    loader.innerHTML = `
      <div role="alert" style="text-align:center;padding:24px;">
        <p style="color:var(--text);margin-bottom:16px;font-weight:500;">${t('load.error')}</p>
        <button type="button" id="retry-load" style="padding:8px 18px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:999px;cursor:pointer;font-size:0.9rem;font-weight:500;">${t('retry')}</button>
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
      return `<button type="button" class="lang-filter-chip" data-iso="${iso}"><span class="lang-filter-flag">${f}</span> <span class="lang-filter-count">${counts[f]}</span></button>`;
    }),
  ];

  container.innerHTML = chips.join('');

  container.querySelectorAll('.lang-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const iso = chip.dataset.iso;
      langFilter = (langFilter === iso) ? '' : iso;
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
    <img src="/monsters/${pokemon.imageName}.png" alt="${pokemonName(pokemon)}" loading="lazy" decoding="async" width="72" height="72">
    <div class="name">${pokemonName(pokemon)}</div>
    <span class="${badgeClass}">${badgeLabel}</span>
  `;

  if (hasCards) {
    div.addEventListener('pointerenter', () => {
      pkCards.forEach(card => {
        const img = new Image();
        img.src = `/cards/${card.imageName}.avif`;
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
      document.getElementById('gen-' + gen)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(btn);
  });
}

// Announce filter/search results to screen readers (role="status" element).
function announceResults(count) {
  const status = document.getElementById('grid-status');
  if (!status) return;
  status.textContent = count === 0
    ? t('no.pokemon')
    : t('results.count').replace('{n}', count);
}

function renderGrid(list) {
  const grid = document.getElementById('pokemon-grid');
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

function applyFilter() {
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = normalize(searchQuery);
  const flag = activeFlag();
  let filtered = pokemons;
  if (flag) filtered = filtered.filter(p => cards.some(c => c.pokemonId === p.id && exclusivityKey(c) === flag));
  if (q) filtered = filtered.filter(p =>
    normalize(p.name.en).includes(q)
    || normalize(p.name.fr).includes(q)
    || normalize(pokemonName(p)).includes(q)
    || String(p.id).includes(q)
  );
  renderGrid(filtered);
}

document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value;
  applyFilter();
});

loadData();
