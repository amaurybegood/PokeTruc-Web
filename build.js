const fs = require('fs');

const pokemons = JSON.parse(fs.readFileSync('data/pokemons.json', 'utf8'));
const cards    = JSON.parse(fs.readFileSync('data/pokemon_cards.json', 'utf8'));

const BASE_URL = 'https://poketruc.com';
const TODAY    = new Date().toISOString().split('T')[0];

function cardsFor(pokemonId) {
  return cards.filter(c => c.pokemonId === pokemonId).sort((a, b) => a.year - b.year);
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

function pad(id) {
  return String(id).padStart(3, '0');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Build the list of Pokémon that have cards (in id order). This is the chain
// used for prev/next navigation and for the static SEO index in index.html.
const pokemonsWithCards = pokemons
  .filter(p => cardsFor(p.id).length > 0)
  .sort((a, b) => a.id - b.id);

function generatePokemonPage(pokemon, index) {
  const pkCards = cardsFor(pokemon.id);
  if (pkCards.length === 0) return null;

  const slug  = slugify(pokemon.name.en);
  const dir   = `pokemon/${slug}`;
  const count = pkCards.length;
  const word  = count === 1 ? 'illustration' : 'illustrations';

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const cardsHTML = pkCards.map(card => `
        <div class="card-item" data-img="../../cards/${card.imageName}.avif">
          <img src="../../cards/${card.imageName}.avif" alt="${escapeHtml(card.name)} — ${escapeHtml(pokemon.name.en)} TCG card" loading="lazy">
          <div class="card-info">
            <div class="card-name">${escapeHtml(card.name)}</div>
            <div class="card-meta"><span class="lang-badge">${card.language}</span> ${card.year} · ${escapeHtml(card.rarity)}</div>
            ${card.artist ? `<div class="card-artist">Artist: ${escapeHtml(card.artist)}</div>` : ''}
          </div>
        </div>`).join('');

  // Prev / next chain over Pokémon that actually have a page
  const prev = pokemonsWithCards[index - 1] || null;
  const next = pokemonsWithCards[index + 1] || null;

  const prevHTML = prev
    ? `<a class="pokemon-nav-prev" href="../${slugify(prev.name.en)}/" rel="prev">← #${pad(prev.id)} ${escapeHtml(prev.name.en)}</a>`
    : `<span class="pokemon-nav-prev pokemon-nav-disabled" aria-hidden="true"></span>`;
  const nextHTML = next
    ? `<a class="pokemon-nav-next" href="../${slugify(next.name.en)}/" rel="next">#${pad(next.id)} ${escapeHtml(next.name.en)} →</a>`
    : `<span class="pokemon-nav-next pokemon-nav-disabled" aria-hidden="true"></span>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pokemon.name.en)} — Exclusive TCG Card Illustrations | PokéTruc</title>
  <meta name="description" content="${count} language-exclusive Pokémon TCG card ${word} for ${escapeHtml(pokemon.name.en)} (#${pad(pokemon.id)}). Unique artwork only available in one language (Japanese, English, Chinese, or other).">
  <meta name="robots" content="index, follow">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(pokemon.name.en)} — Exclusive TCG Card Illustrations | PokéTruc">
  <meta property="og:description" content="${count} language-exclusive TCG card ${word} for ${escapeHtml(pokemon.name.en)}. Unique artwork only available in one language.">
  <meta property="og:image" content="${BASE_URL}/logo.png">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE_URL}/pokemon/${slug}/">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(pokemon.name.en)} — Exclusive TCG Card Illustrations">
  <meta name="twitter:description" content="${count} language-exclusive TCG card ${word} for ${escapeHtml(pokemon.name.en)}.">
  <meta name="twitter:image" content="${BASE_URL}/logo.png">

  <link rel="canonical" href="${BASE_URL}/pokemon/${slug}/">
  <link rel="alternate" hreflang="x-default" href="${BASE_URL}/pokemon/${slug}/">
  ${prev ? `<link rel="prev" href="${BASE_URL}/pokemon/${slugify(prev.name.en)}/">` : ''}
  ${next ? `<link rel="next" href="${BASE_URL}/pokemon/${slugify(next.name.en)}/">` : ''}
  <link rel="icon" type="image/png" href="../../logo.png">
  <link rel="apple-touch-icon" href="../../logo.png">
  <link rel="stylesheet" href="../../style.css?v=8">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${escapeHtml(pokemon.name.en)} — Exclusive TCG Card Illustrations",
    "description": "Language-exclusive Pokémon TCG card illustrations for ${escapeHtml(pokemon.name.en)} (#${pad(pokemon.id)}). Unique artwork only available in one language.",
    "url": "${BASE_URL}/pokemon/${slug}/",
    "isPartOf": { "@id": "${BASE_URL}/#website" },
    "about": {
      "@type": "Thing",
      "name": "${escapeHtml(pokemon.name.en)}",
      "alternateName": ["${escapeHtml(pokemon.name.fr)}", "${escapeHtml(pokemon.name.jp)}"],
      "description": "Pokémon #${pokemon.id}"
    }
  }
  </script>
</head>
<body>

  <header>
    <a href="../../index.html"><img src="../../logo.webp" alt="PokéTruc" class="site-logo" width="80" height="80"></a>
    <h1>PokéTruc<span class="visually-hidden"> — Unique Pokémon TCG Artwork &amp; Exclusive Card Illustrations</span></h1>
    <p class="subtitle" data-i18n="subtitle">Unique Pokémon TCG artwork — exclusive card illustrations</p>
    <nav class="site-nav">
      <a href="../../index.html" data-i18n="dex">Pokédex</a>
      <a href="../../info.html" data-i18n="info">Info</a>
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode"></button>
    </nav>
  </header>

  <main class="pokemon-page">
    <div class="pokemon-hero">
      <a href="../../index.html" class="back-link">← <span data-i18n="dex">Pokédex</span></a>
      <img src="../../monsters/${pokemon.imageName}.png"
           alt="${escapeHtml(pokemon.name.en)}"
           class="pokemon-sprite"
           width="96" height="96">
      <div class="pokemon-hero-info">
        <span class="pokemon-hero-number">#${pad(pokemon.id)}</span>
        <h2 class="pokemon-detail-name"
            data-name-en="${escapeHtml(pokemon.name.en)}"
            data-name-fr="${escapeHtml(pokemon.name.fr)}"
            data-name-ja="${escapeHtml(pokemon.name.jp)}"
            data-name-ko="${escapeHtml(pokemon.name.ko)}"
            data-name-zh="${escapeHtml(pokemon.name.zh)}">${escapeHtml(pokemon.name.en)}</h2>
      </div>
    </div>

    <section class="cards-section">
      <p class="cards-section-title">${count} exclusive TCG card ${word}</p>
      <div class="cards-grid">
        ${cardsHTML}
      </div>
    </section>

    <nav class="pokemon-pager" aria-label="Browse Pokémon">
      ${prevHTML}
      <a class="pokemon-nav-up" href="../../index.html">↑ <span data-i18n="dex">Pokédex</span></a>
      ${nextHTML}
    </nav>
  </main>

  <footer>
    <p>© 2026 - 3590 PokéTruc — Fan-made, not affiliated with Nintendo / The Pokémon Company.</p>
  </footer>

  <!-- Fullscreen -->
  <div id="fullscreen" class="fullscreen hidden">
    <div class="fullscreen-backdrop"></div>
    <img id="fullscreen-img" src="" alt="">
  </div>

  <script data-goatcounter="https://poketruc.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
  <script src="../../i18n.js?v=10"></script>
  <script src="../../theme.js?v=10"></script>
  <script src="../../pokemon.js?v=2"></script>
</body>
</html>`;

  fs.writeFileSync(`${dir}/index.html`, html, 'utf8');
  return slug;
}

// Generate all pages
const generated = [];
pokemonsWithCards.forEach((pokemon, index) => {
  const slug = generatePokemonPage(pokemon, index);
  if (slug) generated.push({ pokemon, slug });
});

// Build static SEO index for index.html: a real <a> per Pokémon page so
// crawlers (and users without JS) can discover every detail page.
const indexNavHTML = generated.map(({ pokemon, slug }) => {
  const cardCount = cardsFor(pokemon.id).length;
  return `      <a href="pokemon/${slug}/" class="seo-pokedex-link" data-pokemon-id="${pokemon.id}">` +
         `<span class="seo-pokedex-num">#${pad(pokemon.id)}</span>` +
         `<span class="seo-pokedex-name">${escapeHtml(pokemon.name.en)}</span>` +
         `<span class="seo-pokedex-count">${cardCount}</span>` +
         `</a>`;
}).join('\n');

const indexNavBlock =
`<!-- BUILD:POKEMON_LINKS_START -->
  <nav class="seo-pokedex" aria-label="All Pokémon with exclusive cards">
    <h2 class="seo-pokedex-title">Browse all Pokémon with exclusive cards</h2>
    <div class="seo-pokedex-grid">
${indexNavHTML}
    </div>
  </nav>
  <!-- BUILD:POKEMON_LINKS_END -->`;

let indexHtml = fs.readFileSync('index.html', 'utf8');
const markerRe = /<!-- BUILD:POKEMON_LINKS_START -->[\s\S]*?<!-- BUILD:POKEMON_LINKS_END -->/;
if (markerRe.test(indexHtml)) {
  indexHtml = indexHtml.replace(markerRe, indexNavBlock);
  fs.writeFileSync('index.html', indexHtml, 'utf8');
  console.log(`✓ index.html : bloc SEO Pokédex injecté (${generated.length} liens)`);
} else {
  console.warn('⚠ Marqueurs <!-- BUILD:POKEMON_LINKS_START/END --> introuvables dans index.html — bloc SEO non injecté.');
}

// Update sitemap.xml
const urls = [
  `  <url>\n    <loc>${BASE_URL}/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>1.0</priority>\n  </url>`,
  `  <url>\n    <loc>${BASE_URL}/info.html</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>0.5</priority>\n  </url>`,
  ...generated.map(({ slug }) =>
    `  <url>\n    <loc>${BASE_URL}/pokemon/${slug}/</loc>\n    <lastmod>${TODAY}</lastmod>\n    <priority>0.8</priority>\n  </url>`
  )
];

fs.writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`, 'utf8');

console.log(`✓ ${generated.length} pages Pokémon générées`);
console.log(`✓ sitemap.xml mis à jour (${urls.length} URLs, lastmod ${TODAY})`);
