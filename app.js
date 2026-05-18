// Pokédex grid (index page) — dynamic search + grid render.
// Depends on i18n.js (t, lang, pokemonName, langPathPrefix).

let pokemons = [];
let cards = [];
let searchQuery = '';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function loadData() {
  const loader = document.getElementById('loader');
  try {
    const [pkRes, cardRes] = await Promise.all([
      fetch('/data/pokemons.json'),
      fetch('/data/pokemon_cards.json'),
    ]);
    if (!pkRes.ok || !cardRes.ok) throw new Error('HTTP ' + (pkRes.status || cardRes.status));
    pokemons = await pkRes.json();
    cards = await cardRes.json();
    loader.classList.add('hidden');
    renderStats();
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

function renderStats() {
  const total = pokemons.length;
  const done  = pokemons.filter(p => p.researchStatus === 'done').length;
  const wip   = pokemons.filter(p => p.researchStatus === 'in_progress').length;
  const soon  = pokemons.filter(p => p.researchStatus === 'coming_soon').length;

  const pDone = (done / total * 100).toFixed(1);
  const pWip  = (wip  / total * 100).toFixed(1);
  const pSoon = (soon / total * 100).toFixed(1);

  document.getElementById('stats-bar').innerHTML = `
    <div class="progress-row">
      <span class="gen-badge">Gen 1</span>
      <div class="progress-bar">
        <div class="progress-done" style="width:0"></div>
        <div class="progress-wip"  style="width:0"></div>
        <div class="progress-soon" style="width:0"></div>
      </div>
    </div>
    <div class="progress-legend">
      <span class="legend-done">&#9632; ${done} ${t('stat.done')}</span>
      <span class="legend-wip"> &#9632; ${wip}  ${t('stat.wip')}</span>
      <span class="legend-soon">&#9632; ${soon} ${t('stat.soon')}</span>
    </div>
  `;

  const bar = document.querySelector('.progress-bar');
  void bar.offsetWidth;
  setTimeout(() => {
    document.querySelector('.progress-done').style.width = `${pDone}%`;
    document.querySelector('.progress-wip').style.width  = `${pWip}%`;
    document.querySelector('.progress-soon').style.width = `${pSoon}%`;
  }, 50);
}

function cardsFor(pokemonId) {
  return cards.filter(c => c.pokemonId === pokemonId);
}

function renderGrid(list) {
  const grid = document.getElementById('pokemon-grid');
  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = `<p id="empty-state">${t('no.pokemon')}</p>`;
    return;
  }

  const prefix = langPathPrefix();

  list.forEach(pokemon => {
    const pkCards = cardsFor(pokemon.id);
    const hasCards = pkCards.length > 0;

    const div = document.createElement('div');
    div.className = 'pokemon-card' + (hasCards ? '' : ' no-cards');

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
      <img src="/monsters/${pokemon.imageName}.png" alt="${pokemonName(pokemon)}" loading="lazy">
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
      div.addEventListener('click', () => {
        window.location.href = `${prefix}pokemon/${slugify(pokemon.name.en)}/`;
      });
    }

    grid.appendChild(div);
  });
}

function applyFilter() {
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = normalize(searchQuery);
  let filtered = pokemons;
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
