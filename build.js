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

// Card-language flags, in the order they should appear on the page.
const LANG_INFO = [
  { flag: '🇯🇵', i18nKey: 'cards.lang.japanese' },
  { flag: '🇬🇧', i18nKey: 'cards.lang.english'  },
  { flag: '🇨🇳', i18nKey: 'cards.lang.chinese'  },
  { flag: '🇰🇷', i18nKey: 'cards.lang.korean'   },
];

// English fallback labels (shown by default; swapped client-side via data-i18n).
const LANG_LABEL_EN = {
  '🇯🇵': 'Japanese-exclusive cards',
  '🇬🇧': 'English-exclusive cards',
  '🇨🇳': 'Chinese-exclusive cards',
  '🇰🇷': 'Korean-exclusive cards',
};

// Pokémon name field per UI lang (mirrors i18n.js: ja→jp).
const NAME_FIELD = { en: 'en', fr: 'fr', ja: 'jp', ko: 'ko', zh: 'zh' };

// Per-card-flag language adjective, by UI language. Used inside the stats
// paragraph (e.g. "7 Japanese-exclusive cards").
const STATS_LANG_LABEL = {
  en: { '🇯🇵': 'Japanese',   '🇬🇧': 'English',   '🇨🇳': 'Chinese',   '🇰🇷': 'Korean'    },
  fr: { '🇯🇵': 'japonaises', '🇬🇧': 'anglaises', '🇨🇳': 'chinoises', '🇰🇷': 'coréennes' },
  ja: { '🇯🇵': '日本限定',    '🇬🇧': '英語限定',  '🇨🇳': '中国語限定', '🇰🇷': '韓国語限定' },
  ko: { '🇯🇵': '일본어 한정', '🇬🇧': '영어 한정', '🇨🇳': '중국어 한정', '🇰🇷': '한국어 한정' },
  zh: { '🇯🇵': '日文独占',    '🇬🇧': '英文独占',  '🇨🇳': '中文独占',  '🇰🇷': '韩文独占'   },
};

// Per-language list joiners ("A, B and C", "A, B et C", "A、B、C", …).
const JOIN_RULES = {
  en: { sep: ', ', last: ' and ' },
  fr: { sep: ', ', last: ' et '  },
  ja: { sep: '、', last: '、'    },
  ko: { sep: ', ', last: ', '    },
  zh: { sep: '、', last: '、'    },
};

function joinListLang(items, lang) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const r = JOIN_RULES[lang] || JOIN_RULES.en;
  if (items.length === 2) return items[0] + r.last + items[1];
  return items.slice(0, -1).join(r.sep) + r.last + items[items.length - 1];
}

// Group an array by a key function (preserving first-seen order of keys).
function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

// Per-language stats sentence builders. Inputs are already HTML-escaped so the
// returned string is safe to embed in a body text node OR in a quoted HTML
// attribute (escapeHtml escapes both & < > ").
const STATS_BUILDERS = {
  en: ({ name, count, minY, maxY, byLang, artists }) => {
    const wordP = count === 1 ? 'illustration' : 'illustrations';
    const yearPart = (minY === maxY) ? `published in ${minY}` : `spanning ${minY} to ${maxY}`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).map(l => {
      const n = byLang[l.flag];
      return `${n} ${STATS_LANG_LABEL.en[l.flag]}-exclusive ${n === 1 ? 'card' : 'cards'}`;
    });
    const langSentence = langParts.length ? `The collection includes ${joinListLang(langParts, 'en')}.` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = ` Illustrated by ${artists[0]}.`;
    else if (artists.length > 1) artistSentence = ` Illustrated by ${artists.length} different artists including ${joinListLang(artists.slice(0, 3), 'en')}.`;
    return `PokéTruc has catalogued ${count} language-exclusive ${name} TCG card ${wordP}, ${yearPart}. ${langSentence}${artistSentence}`;
  },
  fr: ({ name, count, minY, maxY, byLang, artists }) => {
    const wordP = count === 1 ? 'illustration exclusive' : 'illustrations exclusives';
    const yearPart = (minY === maxY) ? `publiée${count > 1 ? 's' : ''} en ${minY}` : `de ${minY} à ${maxY}`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).map(l => {
      const n = byLang[l.flag];
      return `${n} carte${n > 1 ? 's' : ''} ${STATS_LANG_LABEL.fr[l.flag]}`;
    });
    const langSentence = langParts.length ? `La collection comprend ${joinListLang(langParts, 'fr')}.` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = ` Illustrée${count > 1 ? 's' : ''} par ${artists[0]}.`;
    else if (artists.length > 1) artistSentence = ` Illustrées par ${artists.length} artistes différents dont ${joinListLang(artists.slice(0, 3), 'fr')}.`;
    return `PokéTruc recense ${count} ${wordP} de cartes TCG ${name}, ${yearPart}. ${langSentence}${artistSentence}`;
  },
  ja: ({ name, count, minY, maxY, byLang, artists }) => {
    const yearPart = (minY === maxY) ? `${minY}年発行` : `${minY}年から${maxY}年`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).map(l => `${STATS_LANG_LABEL.ja[l.flag]}${byLang[l.flag]}枚`);
    const langSentence = langParts.length ? `内訳は${joinListLang(langParts, 'ja')}です。` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = `イラストは${artists[0]}が担当しています。`;
    else if (artists.length > 1) artistSentence = `${artists.length}名のイラストレーター（${joinListLang(artists.slice(0, 3), 'ja')}など）が手がけています。`;
    return `PokéTrucでは、${name}の言語限定TCGカードイラスト${count}枚（${yearPart}）を収録しています。${langSentence}${artistSentence}`;
  },
  ko: ({ name, count, minY, maxY, byLang, artists }) => {
    const yearPart = (minY === maxY) ? `${minY}년 발행` : `${minY}년부터 ${maxY}년까지`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).map(l => `${STATS_LANG_LABEL.ko[l.flag]} ${byLang[l.flag]}장`);
    const langSentence = langParts.length ? `포함 내역: ${joinListLang(langParts, 'ko')}.` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = ` 일러스트는 ${artists[0]}이(가) 그렸습니다.`;
    else if (artists.length > 1) artistSentence = ` ${artists.length}명의 일러스트레이터가 참여했으며, ${joinListLang(artists.slice(0, 3), 'ko')} 등이 포함됩니다.`;
    return `PokéTruc에는 ${name}의 언어 한정 TCG 카드 일러스트 ${count}장(${yearPart})이 수록되어 있습니다. ${langSentence}${artistSentence}`;
  },
  zh: ({ name, count, minY, maxY, byLang, artists }) => {
    const yearPart = (minY === maxY) ? `${minY} 年发行` : `${minY}–${maxY} 年`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).map(l => `${byLang[l.flag]} 张${STATS_LANG_LABEL.zh[l.flag]}`);
    const langSentence = langParts.length ? `包括${joinListLang(langParts, 'zh')}。` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = `由 ${artists[0]} 绘制。`;
    else if (artists.length > 1) artistSentence = `由 ${artists.length} 位插画师绘制，包括 ${joinListLang(artists.slice(0, 3), 'zh')} 等。`;
    return `PokéTruc 收录了 ${count} 张 ${name} 的语言独占 TCG 卡牌插画（${yearPart}）。${langSentence}${artistSentence}`;
  },
};

// Build the stats paragraph in all 5 UI languages. Each variant ends up in
// data-stats-{lang} attributes on the page; pokemon.js picks the right one.
function buildStatsAllLangs(pokemon, pkCards) {
  const count = pkCards.length;
  const years = pkCards.map(c => c.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  // Language counts ordered by LANG_INFO.
  const byLangRaw = pkCards.reduce((a, c) => { a[c.language] = (a[c.language] || 0) + 1; return a; }, {});
  const byLang = {};
  for (const l of LANG_INFO) if (byLangRaw[l.flag]) byLang[l.flag] = byLangRaw[l.flag];

  // Artist counts (sorted desc by frequency, escaped once for both attribute and body use).
  const artistCounts = pkCards.reduce((a, c) => {
    if (c.artist) a[c.artist] = (a[c.artist] || 0) + 1;
    return a;
  }, {});
  const artists = Object.keys(artistCounts)
    .sort((a, b) => artistCounts[b] - artistCounts[a])
    .map(escapeHtml);

  const out = {};
  for (const lang of ['en', 'fr', 'ja', 'ko', 'zh']) {
    const localizedName = pokemon.name[NAME_FIELD[lang]] || pokemon.name.en;
    out[lang] = STATS_BUILDERS[lang]({
      name: escapeHtml(localizedName),
      count, minY, maxY, byLang, artists,
    });
  }
  return out;
}

// Build "Sets featured" + "Artists" lists (Section B). Static labels are
// translated client-side via data-i18n; counts and content stay in HTML.
function buildSetsAndArtistsHTML(pkCards) {
  const setsSeen = new Map();
  const artistsSeen = new Map();
  for (const c of pkCards) {
    if (c.name)   setsSeen.set(c.name,   (setsSeen.get(c.name)   || 0) + 1);
    if (c.artist) artistsSeen.set(c.artist, (artistsSeen.get(c.artist) || 0) + 1);
  }
  const setsList = [...setsSeen.keys()];
  const artistsList = [...artistsSeen.keys()].sort((a, b) => artistsSeen.get(b) - artistsSeen.get(a));

  const setsHTML = setsList.length > 0
    ? `<div class="meta-block">
        <h3 class="meta-title"><span data-i18n="meta.sets">Sets featured</span> (${setsList.length})</h3>
        <p class="meta-list">${setsList.map(escapeHtml).join(' · ')}</p>
      </div>`
    : '';
  const artistsHTML = artistsList.length > 0
    ? `<div class="meta-block">
        <h3 class="meta-title"><span data-i18n="meta.artists">Artists</span> (${artistsList.length})</h3>
        <p class="meta-list">${artistsList.map(escapeHtml).join(' · ')}</p>
      </div>`
    : '';

  if (!setsHTML && !artistsHTML) return '';
  return `
    <aside class="pokemon-meta">
      ${setsHTML}
      ${artistsHTML}
    </aside>`;
}

// Render a single card. The "Artist" prefix is wrapped in a translatable span.
function renderCard(card, pokemon) {
  return `
        <div class="card-item" data-img="../../cards/${card.imageName}.avif">
          <img src="../../cards/${card.imageName}.avif" alt="${escapeHtml(card.name)} — ${escapeHtml(pokemon.name.en)} TCG card" loading="lazy">
          <div class="card-info">
            <div class="card-name">${escapeHtml(card.name)}</div>
            <div class="card-meta"><span class="lang-badge">${card.language}</span> ${card.year} · ${escapeHtml(card.rarity)}</div>
            ${card.artist ? `<div class="card-artist"><span data-i18n="artist">Artist</span>: ${escapeHtml(card.artist)}</div>` : ''}
          </div>
        </div>`;
}

// Section C: cards split by language with H3 sub-headings. The per-language
// label is translatable via data-i18n keys defined in i18n.js.
function buildCardsSectionHTML(pokemon, pkCards) {
  const count = pkCards.length;

  const groups = groupBy(pkCards, c => c.language);
  const orderedFlags = [
    ...LANG_INFO.map(l => l.flag).filter(f => groups.has(f)),
    ...[...groups.keys()].filter(f => !LANG_INFO.some(l => l.flag === f)),
  ];

  const sectionTitle = `<p class="cards-section-title">${count} <span data-i18n="cards.section.title">exclusive TCG card illustrations</span></p>`;

  // Single-language case: no sub-headings, single grid.
  if (orderedFlags.length === 1) {
    const onlyFlag = orderedFlags[0];
    const cards = groups.get(onlyFlag).slice().sort((a, b) => a.year - b.year);
    return `
    <section class="cards-section">
      ${sectionTitle}
      <div class="cards-grid">
        ${cards.map(c => renderCard(c, pokemon)).join('')}
      </div>
    </section>`;
  }

  const i18nKeyOf = Object.fromEntries(LANG_INFO.map(l => [l.flag, l.i18nKey]));

  const groupsHTML = orderedFlags.map(flag => {
    const cards = groups.get(flag).slice().sort((a, b) => a.year - b.year);
    const groupCount = cards.length;
    const i18nKey = i18nKeyOf[flag];
    const defaultLabel = LANG_LABEL_EN[flag] || 'Other-exclusive cards';
    const headingInner = i18nKey
      ? `<span data-i18n="${i18nKey}">${escapeHtml(defaultLabel)}</span>`
      : escapeHtml(defaultLabel);
    return `
      <h3 class="cards-lang-title">${flag} ${headingInner} (${groupCount})</h3>
      <div class="cards-grid">
        ${cards.map(c => renderCard(c, pokemon)).join('')}
      </div>`;
  }).join('');

  return `
    <section class="cards-section">
      ${sectionTitle}
      ${groupsHTML}
    </section>`;
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

  const statsByLang       = buildStatsAllLangs(pokemon, pkCards);
  const cardsSectionHTML  = buildCardsSectionHTML(pokemon, pkCards);
  const setsArtistsHTML   = buildSetsAndArtistsHTML(pkCards);
  const statsAttrs        = ['en','fr','ja','ko','zh']
    .map(l => `data-stats-${l}="${statsByLang[l]}"`).join('\n           ');

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
  <link rel="stylesheet" href="../../style.css?v=9">

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

    <section class="pokemon-summary">
      <p class="pokemon-stats-text"
         ${statsAttrs}>${statsByLang.en}</p>
    </section>
${cardsSectionHTML}
${setsArtistsHTML}
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
  <script src="../../i18n.js?v=11"></script>
  <script src="../../theme.js?v=11"></script>
  <script src="../../pokemon.js?v=3"></script>
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
