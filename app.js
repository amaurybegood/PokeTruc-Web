let pokemons = [];
let cards = [];
let searchQuery = '';

async function loadData() {
  try {
    const [pkRes, cardRes] = await Promise.all([
      fetch('data/pokemons.json'),
      fetch('data/pokemon_cards.json')
    ]);
    pokemons = await pkRes.json();
    cards = await cardRes.json();
    document.getElementById('loader').classList.add('hidden');
    renderStats();
    applyFilter();
  } catch {
    document.getElementById('loader').innerHTML =
      `<p style="color:var(--text-secondary);text-align:center">${t('load.error')}</p>`;
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
      <span class="legend-done">&#9632; ${done} <span data-i18n="stat.done"></span></span>
      <span class="legend-wip"> &#9632; ${wip}  <span data-i18n="stat.wip"></span></span>
      <span class="legend-soon">&#9632; ${soon} <span data-i18n="stat.soon"></span></span>
    </div>
  `;
  applyTranslations();

  const bar = document.querySelector('.progress-bar');
  void bar.offsetWidth; // force reflow
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
      <img src="monsters/${pokemon.imageName}.png" alt="${pokemonName(pokemon)}" loading="lazy">
      <div class="name">${pokemonName(pokemon)}</div>
      <span class="${badgeClass}">${badgeLabel}</span>
    `;

    if (hasCards) {
      div.addEventListener('pointerenter', () => {
        pkCards.forEach(card => {
          const img = new Image();
          img.src = `cards/${card.imageName}.avif`;
        });
      }, { once: true });
      div.addEventListener('click', () => openModal(pokemon, pkCards));
    }

    grid.appendChild(div);
  });
}

function applyFilter() {
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

// Search
document.getElementById('search').addEventListener('input', e => {
  searchQuery = e.target.value;
  applyFilter();
});

// Modal
function openModal(pokemon, pkCards) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modal-body');

  const count = pkCards.length;
  const cardWord = count === 1 ? t('card') : t('cards');
  body.innerHTML = `
    <div class="modal-header">
      <img src="monsters/${pokemon.imageName}.png" alt="${pokemonName(pokemon)}">
      <div>
        <h2>${pokemonName(pokemon)}</h2>
        <div class="card-count">${count} ${cardWord}</div>
      </div>
    </div>
    <div class="cards-grid">
      ${pkCards.map(card => `
        <div class="card-item" data-img="cards/${card.imageName}.avif">
          <img src="cards/${card.imageName}.avif" alt="${card.name}">
          <div class="card-info">
            <div class="card-name">${card.name}</div>
            <div class="card-meta"><span class="lang-badge">${card.language}</span> ${card.year} · ${card.rarity}</div>
            ${card.artist ? `<div class="card-artist">${t('artist')}: ${card.artist}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Card fullscreen
  body.querySelectorAll('.card-item').forEach(item => {
    item.addEventListener('click', () => openFullscreen(item.dataset.img));
  });

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
}

document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
document.querySelector('.modal-close').addEventListener('click', closeModal);

function closeModal() {
  const modal = document.getElementById('modal');
  const content = modal.querySelector('.modal-content');
  content.classList.add('closing');
  content.addEventListener('animationend', () => {
    content.classList.remove('closing');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }, { once: true });
}

// Fullscreen
function openFullscreen(src) {
  const fs = document.getElementById('fullscreen');
  document.getElementById('fullscreen-img').src = src;
  fs.classList.remove('hidden');
}

document.querySelector('.fullscreen-backdrop').addEventListener('click', () => {
  document.getElementById('fullscreen').classList.add('hidden');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('fullscreen').classList.add('hidden');
    closeModal();
  }
});

loadData();
