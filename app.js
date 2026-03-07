let pokemons = [];
let cards = [];
let filterCardsOnly = false;
let searchQuery = '';

const languageLabel = {
  '🇯🇵': 'JP',
  '🇬🇧': 'EN',
  '🇨🇳': 'CN',
  '🇺🇸': 'EN',
  '🇰🇷': 'KR',
};

async function loadData() {
  try {
    const [pkRes, cardRes] = await Promise.all([
      fetch('data/pokemons.json'),
      fetch('data/pokemon_cards.json')
    ]);
    pokemons = await pkRes.json();
    cards = await cardRes.json();
    document.getElementById('loader').classList.add('hidden');
    applyFilter();
  } catch {
    document.getElementById('loader').innerHTML =
      '<p style="color:var(--text-secondary);text-align:center">Failed to load data. Please try again later.</p>';
  }
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
      : 'badge';

    const badgeLabel = pokemon.researchStatus === 'coming_soon' ? t('coming.soon')
      : pokemon.researchStatus === 'in_progress' ? `${pkCards.length} · ${t('wip')}`
      : hasCards ? String(pkCards.length)
      : '';

    div.innerHTML = `
      <span class="pokemon-number">#${pokemon.id}</span>
      <img src="monsters/${pokemon.imageName}.png" alt="${pokemonName(pokemon)}" loading="lazy">
      <div class="name">${pokemonName(pokemon)}</div>
      ${badgeLabel ? `<span class="${badgeClass}">${badgeLabel}</span>` : ''}
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
  if (filterCardsOnly) filtered = filtered.filter(p => cardsFor(p.id).length > 0);
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

// Filter button
document.getElementById('filter-btn').addEventListener('click', () => {
  filterCardsOnly = !filterCardsOnly;
  const btn = document.getElementById('filter-btn');
  btn.textContent = t(filterCardsOnly ? 'filter.cards' : 'filter.all');
  btn.classList.toggle('active', filterCardsOnly);
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
            <div class="card-meta"><span class="lang-badge">${languageLabel[card.language] ?? card.language}</span> ${card.year} · ${card.rarity}</div>
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
  document.getElementById('modal').classList.add('hidden');
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
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
