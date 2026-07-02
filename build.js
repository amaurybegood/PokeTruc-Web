// Static site generator for PokéTruc.
//
// Produces 5 fully-localised URL trees (en at root, fr/ja/ko/zh under /<lang>/)
// with cross-linked hreflang annotations, a per-Pokémon detail page in each
// language, and a sitemap.xml that declares every alternate.

const fs = require('fs');
const crypto = require('crypto');

const pokemons = JSON.parse(fs.readFileSync('data/pokemons.json', 'utf8'));
const cards    = JSON.parse(fs.readFileSync('data/pokemon_cards.json', 'utf8'));
// Trainer cards live in their own flat catalogue (no pokemonId). Optional file.
const trainerCards = (() => {
  try { return JSON.parse(fs.readFileSync('data/trainer_cards.json', 'utf8')); }
  catch { return []; }
})();
// Hand-curated "latest real-world exclusive releases" shown on the home page.
// Independent from the catalogue — entries need not exist in the site. Optional file.
const news = (() => {
  try { return JSON.parse(fs.readFileSync('data/news.json', 'utf8')); }
  catch { return []; }
})();

// Fail fast on malformed data: a typo in a JSON file should break the build
// loudly instead of silently dropping content from the site.
(function validateData() {
  const fail = (file, msg, entry) => {
    throw new Error(`${file}: ${msg} — ${JSON.stringify(entry).slice(0, 150)}`);
  };
  const pokemonIds = new Set();
  pokemons.forEach(p => {
    if (typeof p.id !== 'number') fail('pokemons.json', 'id must be a number', p);
    if (!p.name || !p.name.en)    fail('pokemons.json', 'missing name.en', p);
    if (!p.imageName)             fail('pokemons.json', 'missing imageName', p);
    pokemonIds.add(p.id);
  });
  cards.forEach(c => {
    if (!c.imageName)               fail('pokemon_cards.json', 'missing imageName', c);
    if (!Array.isArray(c.languages)) fail('pokemon_cards.json', 'languages must be an array', c);
    if (!c.name)                    fail('pokemon_cards.json', 'missing name', c);
    if (!pokemonIds.has(c.pokemonId)) fail('pokemon_cards.json', `unknown pokemonId ${c.pokemonId}`, c);
    if (!fs.existsSync(`cards/${c.imageName}.avif`)) fail('pokemon_cards.json', `image not found: cards/${c.imageName}.avif`, c);
  });
  trainerCards.forEach(c => {
    if (!c.imageName)               fail('trainer_cards.json', 'missing imageName', c);
    if (!Array.isArray(c.languages)) fail('trainer_cards.json', 'languages must be an array', c);
    if (!c.title)                   fail('trainer_cards.json', 'missing title', c);
    if (!fs.existsSync(`cards/${c.imageName}.avif`)) fail('trainer_cards.json', `image not found: cards/${c.imageName}.avif`, c);
  });
  news.forEach(n => {
    if (!n.title) fail('news.json', 'missing title', n);
    if (n.imageName && !fs.existsSync(`cards/${n.imageName}.avif`)) fail('news.json', `image not found: cards/${n.imageName}.avif`, n);
  });
  // Grid thumbnails are required (the client grid points at them blindly).
  const missingThumbs = [...cards, ...trainerCards]
    .map(c => c.imageName)
    .filter(n => !fs.existsSync(`cards/thumbs/${n}.avif`));
  if (missingThumbs.length) {
    throw new Error(`missing ${missingThumbs.length} card thumbnail(s) (e.g. cards/thumbs/${missingThumbs[0]}.avif) — run: python make-thumbs.py`);
  }
})();

const BASE_URL = 'https://poketruc.com';
const TODAY    = new Date().toISOString().split('T')[0];

// External profile credited on the Info page for help discovering
// language-exclusive cards.
const REDDIT_TWENTYFOUR7_URL = 'https://www.reddit.com/user/TwentyFour7/';
const REDDIT_QUUADOR_URL     = 'https://www.reddit.com/user/Quuador/';

// Author profile + project repo. Surfaced on the Info page (Contact + Source
// code sections) so the site has a couple of honest backlinks pointing out.
const REDDIT_BEGOODERRR_URL = 'https://www.reddit.com/user/Begooderrr/';
const GITHUB_REPO_URL       = 'https://github.com/amaurybegood/PokeTruc-Web';

// Persistent build state: maps URL paths to { hash, lastmod }. Used so that
// sitemap <lastmod> only advances when the actual rendered HTML changes —
// keeping the freshness signal trustworthy for crawlers.
const STATE_PATH = '.build-state.json';
let prevState = {};
try { prevState = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch {}
const newState = {};

let changedCount = 0;
let unchangedCount = 0;

function recordWrite(filePath, content, urlKey) {
  fs.writeFileSync(filePath, content, 'utf8');
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const prev = prevState[urlKey];
  const same = prev && prev.hash === hash;
  const lastmod = same ? prev.lastmod : TODAY;
  if (same) unchangedCount++; else changedCount++;
  newState[urlKey] = { hash, lastmod };
  return lastmod;
}

const CSS_V = 36;
const JS_V  = 22;

// Intrinsic image dimensions (AVIF ispe box / PNG IHDR), cached per file.
// Emitted as width/height attributes so browsers reserve space before the
// image loads (prevents layout shift).
const imageSizeCache = new Map();
function imageSize(relPath) {
  if (imageSizeCache.has(relPath)) return imageSizeCache.get(relPath);
  let size = null;
  try {
    const buf = fs.readFileSync(relPath);
    if (relPath.endsWith('.avif')) {
      const idx = buf.indexOf('ispe');
      if (idx >= 0) size = { w: buf.readUInt32BE(idx + 8), h: buf.readUInt32BE(idx + 12) };
    } else if (relPath.endsWith('.png')) {
      size = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
  } catch {}
  imageSizeCache.set(relPath, size);
  return size;
}
function imgSizeAttrs(relPath) {
  const s = imageSize(relPath);
  return s ? ` width="${s.w}" height="${s.h}"` : '';
}

// src/srcset/sizes/width/height for a card image shown in a grid. Grids render
// cards at ~140-250px CSS, so the 480px thumb (make-thumbs.py) covers every
// density; the original stays in srcset for wide picks and in the fullscreen
// viewer. Cards no wider than the thumb cap just use the original.
function cardSrcAttrs(imageName, sizes) {
  const full = `cards/${imageName}.avif`;
  const thumb = `cards/thumbs/${imageName}.avif`;
  const fullSize = imageSize(full);
  const thumbSize = imageSize(thumb);
  if (!thumbSize || !fullSize || thumbSize.w >= fullSize.w) {
    return `src="/${full}"${imgSizeAttrs(full)}`;
  }
  return `src="/${thumb}" srcset="/${thumb} ${thumbSize.w}w, /${full} ${fullSize.w}w" sizes="${sizes}"${imgSizeAttrs(full)}`;
}
const GRID_SIZES = '(max-width: 600px) 40vw, 200px';

// LCP preload target for the first grid card: what the srcset actually picks.
function cardPreloadHref(imageName) {
  return imageSize(`cards/thumbs/${imageName}.avif`)
    ? `/cards/thumbs/${imageName}.avif`
    : `/cards/${imageName}.avif`;
}

const LANGS = ['en', 'fr', 'ja', 'ko', 'zh'];

// HTML lang attribute (zh uses zh-Hans for simplified Chinese).
const HTML_LANG = { en: 'en', fr: 'fr', ja: 'ja', ko: 'ko', zh: 'zh-Hans' };

// hreflang values declared in <link rel="alternate"> tags. Same mapping.
const HREFLANG = HTML_LANG;

// Pokémon name field per UI lang (mirrors data/pokemons.json key naming).
const NAME_FIELD = { en: 'en', fr: 'fr', ja: 'jp', ko: 'ko', zh: 'zh' };

// Exclusivity categories, in the order they should appear on the page.
// First the single-language categories (a card with languages=[flag]),
// then the 2 macro region categories (Western / Asian multi-language).
const LANG_INFO = [
  { flag: '🇯🇵', key: 'langJapaneseHeading'   },
  { flag: '🇬🇧', key: 'langEnglishHeading'    },
  { flag: '🇨🇳', key: 'langChineseHeading'    },
  { flag: '🇰🇷', key: 'langKoreanHeading'     },
  { flag: '🇩🇪', key: 'langGermanHeading'     },
  { flag: '🇪🇸', key: 'langSpanishHeading'    },
  { flag: '🇫🇷', key: 'langFrenchHeading'     },
  { flag: '🇮🇹', key: 'langItalianHeading'    },
  { flag: '🇵🇹', key: 'langPortugueseHeading' },
  { flag: '🇵🇱', key: 'langPolishHeading'     },
  { flag: '🇮🇩', key: 'langIndonesianHeading' },
  { flag: '🇷🇺', key: 'langRussianHeading'    },
  { flag: '🌍', key: 'langWesternHeading'     },
  { flag: '🏯', key: 'langAsianHeading'       },
];

const STATS_LANG_LABEL = {
  en: { '🇯🇵': 'Japanese',   '🇬🇧': 'English',   '🇨🇳': 'Chinese',   '🇰🇷': 'Korean',    '🇩🇪': 'German',      '🇪🇸': 'Spanish',     '🇫🇷': 'French',      '🇮🇹': 'Italian',      '🇵🇹': 'Portuguese',     '🇵🇱': 'Polish',       '🇮🇩': 'Indonesian',     '🇷🇺': 'Russian',        '🌍': 'Western',         '🏯': 'Asian'           },
  fr: { '🇯🇵': 'japonaise',  '🇬🇧': 'anglaise',  '🇨🇳': 'chinoise',  '🇰🇷': 'coréenne',  '🇩🇪': 'allemande',   '🇪🇸': 'espagnole',   '🇫🇷': 'française',   '🇮🇹': 'italienne',    '🇵🇹': 'portugaise',     '🇵🇱': 'polonaise',    '🇮🇩': 'indonésienne',   '🇷🇺': 'russe',          '🌍': 'occidentale',     '🏯': 'asiatique'       },
  ja: { '🇯🇵': '日本限定',    '🇬🇧': '英語限定',  '🇨🇳': '中国語限定', '🇰🇷': '韓国語限定', '🇩🇪': 'ドイツ語限定', '🇪🇸': 'スペイン語限定', '🇫🇷': 'フランス語限定', '🇮🇹': 'イタリア語限定', '🇵🇹': 'ポルトガル語限定', '🇵🇱': 'ポーランド語限定', '🇮🇩': 'インドネシア語限定', '🇷🇺': 'ロシア語限定',   '🌍': '欧米限定',        '🏯': 'アジア限定'       },
  ko: { '🇯🇵': '일본어 한정', '🇬🇧': '영어 한정', '🇨🇳': '중국어 한정', '🇰🇷': '한국어 한정', '🇩🇪': '독일어 한정',  '🇪🇸': '스페인어 한정', '🇫🇷': '프랑스어 한정', '🇮🇹': '이탈리아어 한정', '🇵🇹': '포르투갈어 한정', '🇵🇱': '폴란드어 한정',  '🇮🇩': '인도네시아어 한정', '🇷🇺': '러시아어 한정',  '🌍': '서양 한정',       '🏯': '아시아 한정'      },
  zh: { '🇯🇵': '日文独占',    '🇬🇧': '英文独占',  '🇨🇳': '中文独占',  '🇰🇷': '韩文独占',   '🇩🇪': '德文独占',    '🇪🇸': '西班牙文独占', '🇫🇷': '法文独占',     '🇮🇹': '意大利文独占',  '🇵🇹': '葡萄牙文独占',   '🇵🇱': '波兰文独占',    '🇮🇩': '印尼文独占',     '🇷🇺': '俄文独占',       '🌍': '西方独占',        '🏯': '亚洲独占'        },
};

// ISO language code for each flag emoji used on a card. Used by JSON-LD
// inLanguage on the per-card VisualArtwork entries.
const FLAG_TO_ISO = {
  '🇯🇵': 'ja',
  '🇬🇧': 'en',
  '🇨🇳': 'zh-Hans',
  '🇰🇷': 'ko',
  '🇩🇪': 'de',
  '🇪🇸': 'es',
  '🇫🇷': 'fr',
  '🇮🇹': 'it',
  '🇵🇹': 'pt',
  '🇵🇱': 'pl',
  '🇮🇩': 'id',
  '🇷🇺': 'ru',
};

// Exclusivity key for grouping / filtering. Cards released in a single
// language are keyed by that flag; multi-language cards collapse into the
// macro region stored in `card.region` ("western" → 🌍, "asian" → 🏯).
function exclusivityKey(card) {
  if (card.region === 'western') return '🌍';
  if (card.region === 'asian')   return '🏯';
  if (card.languages.length === 1) return card.languages[0];
  return null;
}

const JOIN_RULES = {
  en: { sep: ', ', last: ' and ' },
  fr: { sep: ', ', last: ' et '  },
  ja: { sep: '、', last: '、'    },
  ko: { sep: ', ', last: ', '    },
  zh: { sep: '、', last: '、'    },
};

// All UI strings per language. Functions take dynamic values; everything else
// is a static localised string.
const LANG = {
  en: {
    siteName: 'PokéTruc',
    tagline: 'Pokémon TCG illustrations / artworks released in only one language or one region',
    pokedex: 'Pokédex',
    info: 'Info',
    searchPlaceholder: 'Search a Pokémon, set or artist...',
    langFilterAria: 'Filter by exclusivity category',
    genNavAria: 'Jump to a generation',
    viewToggleAria: 'Choose display: Pokémon or cards',
    skipToContent: 'Skip to main content',
    indexTitle: 'PokéTruc — Language-Exclusive Pokémon TCG Card Illustrations',
    indexDescription: 'Pokémon TCG illustrations / artworks released in only one language or region — Japanese, English, Chinese, Western-only, Asian-only and more. Free, fan-made, ad-free.',
    indexH1: 'Pokémon TCG illustrations / artworks released in only one language or one region',
    seoAbout: "Some Pokémon TCG cards feature artwork that was only ever printed in a single language; others were only ever released in a single region. A Japanese promo from a 1996 stamp magazine never released in English. A McDonald's Pokémon-e card distributed only in Japan in 2002. A Chinese-market exclusive from a recent set. A Call of Legends or My First Battle card that shipped across Western markets (English, German, French, Italian, Spanish) but never reached Japan. PokéTruc catalogs these language- and region-exclusive cards across the classic Generation 1 Pokémon — Bulbasaur, Charizard, Pikachu and every favourite — plus select Pokémon from later generations added on request, pulling artwork from Japanese Vending Machine expansion sheets, Black & White promos, DPt-P promos, McDonald's promos, Western-only trainer kits, and Chinese-exclusive releases by artists such as Ken Sugimori, Mitsuhiro Arita, Sumiyoshi Kizuki, Yuka Morii and many others. The goal is simple: help collectors discover the rare illustrations they may have never seen, organised by Pokémon, set, exclusivity and year — fully free, ad-free, and built by a fan.",
    seoPokedexHeading: 'Browse all Pokémon with exclusive cards',
    newsHeading: 'Latest exclusive cards released',
    infoTitle: 'PokéTruc — About',
    infoDescription: 'About PokéTruc: a fan-made catalog of Pokémon TCG cards with unique artwork exclusive to one language. Free, ad-free.',
    infoH1: 'About PokéTruc',
    aboutHeading: 'About',
    aboutBody: [
      "This site was developed for fun, and also for learning purposes (not being a developer, it's a bit of a challenge for me). That's why it is very simple and basic.",
      "Its purpose is to list all Pokémon TCG cards with unique illustrations. By unique, I mean artwork that is only available in one language (Japanese, English, Chinese, or other) or only released in a single region (e.g. Western-only sets like Call of Legends or My First Battle, never released in Japan). This is the kind of card I like to collect.",
      "It is completely free and ad-free.",
      "Despite the care taken, some information may be inaccurate. Please feel free to contact me by email if you notice an error or would like to provide feedback.",
      "Voilà, voilà :)",
    ],
    contactHeading: 'Contact',
    disclaimerBody: [
      'This site is unofficial and fan-made. Pokémon and Pokémon character names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.',
      'This site does not collect any personal data or require a user account. No information is transmitted or stored outside of your device.',
    ],
    creditsHeading: 'Credits',
    creditsBefore: 'A big thank you to Redditors ',
    creditsLinkText: 'u/TwentyFour7',
    creditsBetween: ' and ',
    creditsLinkText2: 'u/Quuador',
    creditsAfter: ' for their precious help in finding cards that only exist in a single language.',
    sourceCodeHeading: 'Source code',
    sourceCodeBefore: 'The source code of this site is open source on GitHub: ',
    emailLabel: 'Email:',
    redditLabel: 'Reddit:',
    opensInNewTab: 'opens in new tab',
    upToPokedex:   '↑ Pokédex',
    setsHeading: 'Sets featured',
    artistsHeading: 'Artists',
    artistPrefix: 'Artist',
    sourceLinkText: 'source',
    descriptionToggle: 'Note',
    langJapaneseHeading:   'Japanese-exclusive cards',
    langEnglishHeading:    'English-exclusive cards',
    langChineseHeading:    'Chinese-exclusive cards',
    langKoreanHeading:     'Korean-exclusive cards',
    langGermanHeading:     'German-exclusive cards',
    langSpanishHeading:    'Spanish-exclusive cards',
    langFrenchHeading:     'French-exclusive cards',
    langItalianHeading:    'Italian-exclusive cards',
    langPortugueseHeading: 'Portuguese-exclusive cards',
    langPolishHeading:     'Polish-exclusive cards',
    langIndonesianHeading: 'Indonesian-exclusive cards',
    langRussianHeading:    'Russian-exclusive cards',
    langWesternHeading:    'Western-exclusive cards',
    langAsianHeading:      'Asian-exclusive cards',
    cardsSection: (n) => `${n} exclusive TCG card ${n === 1 ? 'illustration' : 'illustrations'}`,
    detailTitle: (name, n) => `${name} — Exclusive TCG Card ${n === 1 ? 'Illustration' : 'Illustrations'} | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${n} exclusive Pokémon TCG card ${n === 1 ? 'illustration' : 'illustrations'} for ${name} (#${pad(id)}). Unique artwork only released in one language (Japanese, English, Chinese, or other) or one region (Western-only or Asian-only).`,
    detailOgDescription: (name, n) =>
      `${n} exclusive TCG card ${n === 1 ? 'illustration' : 'illustrations'} for ${name}. Unique artwork only released in one language or region.`,
    schemaDetailDescription: (name, id) =>
      `Exclusive Pokémon TCG card illustrations for ${name} (#${pad(id)}). Unique artwork only released in one language or region.`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: 'JavaScript is required for the live Pokédex grid above. You can still browse every Pokémon below.',
    footerCopyright: '© 2026 - 3590 PokéTruc — Fan-made, not affiliated with Nintendo / The Pokémon Company.',
    langSwitcherLabel: 'Language',
    themeToggleLabel: 'Toggle dark mode',
    trainers: 'Trainers',
    trainersTitle: 'PokéTruc — Exclusive Trainer Card Illustrations',
    trainersDescription: 'Pokémon TCG Trainer card illustrations released in only one language or one region — Japanese, English, Western-only and more. Free, fan-made, ad-free.',
    trainersH1: 'Trainer card illustrations released in only one language or one region',
    trainersIntro: (n) => `${n} exclusive Trainer card ${n === 1 ? 'illustration' : 'illustrations'}`,
    trainersEmpty: 'No Trainer cards yet — check back soon.',
  },
  fr: {
    siteName: 'PokéTruc',
    tagline: "Illustrations / artworks de cartes Pokémon TCG n'existant que dans une seule langue ou une seule région",
    pokedex: 'Pokédex',
    info: 'Info',
    searchPlaceholder: 'Rechercher un Pokémon, set ou artiste...',
    langFilterAria: "Filtrer par catégorie d'exclusivité",
    genNavAria: 'Aller à une génération',
    viewToggleAria: 'Choisir l\'affichage : Pokémon ou cartes',
    skipToContent: 'Aller au contenu',
    indexTitle: 'PokéTruc — Illustrations de cartes Pokémon TCG exclusives à une langue',
    indexDescription: "Illustrations / artworks de cartes Pokémon TCG n'existant que dans une seule langue ou région (japonais, anglais, chinois, occident, asie). Gratuit, sans pub, fait par un fan.",
    indexH1: "Illustrations / artworks de cartes Pokémon TCG n'existant que dans une seule langue ou une seule région",
    seoAbout: "Certaines cartes Pokémon TCG n'existent qu'en une seule langue ; d'autres ne sont sorties que dans une seule région. Une promo japonaise distribuée avec un magazine de timbres en 1996, jamais sortie en anglais. Une carte McDonald's Pokémon-e disponible uniquement au Japon en 2002. Une exclusivité du marché chinois sur un set récent. Une carte d'un set L'appel des légendes ou My First Battle distribuée en occident (anglais, allemand, français, italien, espagnol) mais jamais sortie au Japon. PokéTruc recense ces cartes en exclusivité linguistique ou régionale pour les Pokémon de la Génération 1 — Bulbizarre, Dracaufeu, Pikachu et tous les autres — ainsi que des Pokémon d'autres générations ajoutés à la demande, en piochant dans les feuilles Vending Machine japonaises, les promos Black & White, les promos DPt-P, les promos McDonald's, les decks d'initiation occidentaux et les sorties exclusives au marché chinois, illustrées par des artistes comme Ken Sugimori, Mitsuhiro Arita, Sumiyoshi Kizuki, Yuka Morii et bien d'autres. L'objectif : permettre aux collectionneurs de découvrir des illustrations rares qu'ils n'ont peut-être jamais vues, classées par Pokémon, set, exclusivité et année — entièrement gratuit, sans publicité, créé par un fan.",
    seoPokedexHeading: 'Tous les Pokémon avec des cartes exclusives',
    newsHeading: 'Dernières cartes exclusives sorties',
    infoTitle: 'PokéTruc — À propos',
    infoDescription: 'À propos de PokéTruc : un catalogue créé par un fan, recensant les cartes Pokémon TCG aux illustrations exclusives à une seule langue. Gratuit, sans publicité.',
    infoH1: 'À propos de PokéTruc',
    aboutHeading: 'À propos',
    aboutBody: [
      "Ce site est développé pour le fun, et aussi à des fins d'apprentissage (n'étant pas développeur, c'est un petit défi pour moi). C'est pour cela qu'il est très simple et basique.",
      "Son but est de répertorier toutes les cartes Pokémon TCG ayant des illustrations uniques. Par unique, j'entends qui n'est disponible que dans une seule langue (japonais, anglais, chinois ou autre) ou que dans une seule région (par exemple les sets occidentaux comme L'appel des légendes ou My First Battle, jamais sortis au Japon). C'est le genre de carte que j'aime bien collectionner.",
      "Il est entièrement gratuit et sans publicité.",
      "Malgré le soin apporté, certaines informations peuvent être inexactes. N'hésitez pas à me contacter par e-mail si vous constatez une erreur ou souhaitez faire un retour.",
      "Voilà, voilà :)",
    ],
    contactHeading: 'Contact',
    disclaimerBody: [
      'Ce site est non officiel et créé par un fan. Pokémon et les noms des personnages Pokémon sont des marques déposées de Nintendo / Creatures Inc. / GAME FREAK inc.',
      "Ce site ne collecte aucune donnée personnelle et ne nécessite aucun compte utilisateur. Aucune information n'est transmise ou stockée en dehors de votre appareil.",
    ],
    creditsHeading: 'Remerciements',
    creditsBefore: 'Un grand merci aux Redditeurs ',
    creditsLinkText: 'u/TwentyFour7',
    creditsBetween: ' et ',
    creditsLinkText2: 'u/Quuador',
    creditsAfter: ' pour leur aide précieuse à dénicher des cartes existant uniquement dans une seule langue.',
    sourceCodeHeading: 'Code source',
    sourceCodeBefore: 'Le code source de ce site est ouvert sur GitHub : ',
    emailLabel: 'E-mail :',
    redditLabel: 'Reddit :',
    opensInNewTab: 'ouvre dans un nouvel onglet',
    upToPokedex:   '↑ Pokédex',
    setsHeading: 'Sets présentés',
    artistsHeading: 'Artistes',
    artistPrefix: 'Artiste',
    sourceLinkText: 'source',
    descriptionToggle: 'Note',
    langJapaneseHeading:   'Cartes exclusives japonaises',
    langEnglishHeading:    'Cartes exclusives anglaises',
    langChineseHeading:    'Cartes exclusives chinoises',
    langKoreanHeading:     'Cartes exclusives coréennes',
    langGermanHeading:     'Cartes exclusives allemandes',
    langSpanishHeading:    'Cartes exclusives espagnoles',
    langFrenchHeading:     'Cartes exclusives françaises',
    langItalianHeading:    'Cartes exclusives italiennes',
    langPortugueseHeading: 'Cartes exclusives portugaises',
    langPolishHeading:     'Cartes exclusives polonaises',
    langIndonesianHeading: 'Cartes exclusives indonésiennes',
    langRussianHeading:    'Cartes exclusives russes',
    langWesternHeading:    'Cartes exclusives occidentales',
    langAsianHeading:      'Cartes exclusives asiatiques',
    cardsSection: (n) => `${n} illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes TCG`,
    detailTitle: (name, n) =>
      `${name} — Illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes TCG | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${n} illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes Pokémon TCG pour ${name} (#${pad(id)}). Artwork unique disponible dans une seule langue (japonais, anglais, chinois ou autre) ou une seule région (occidentale ou asiatique).`,
    detailOgDescription: (name, n) =>
      `${n} illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes TCG pour ${name}. Artwork unique disponible dans une seule langue ou région.`,
    schemaDetailDescription: (name, id) =>
      `Illustrations exclusives de cartes Pokémon TCG pour ${name} (#${pad(id)}). Artwork unique disponible dans une seule langue ou région.`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: "JavaScript est nécessaire pour la grille dynamique du Pokédex. Vous pouvez tout de même parcourir tous les Pokémon ci-dessous.",
    footerCopyright: '© 2026 - 3590 PokéTruc — Site fan, non affilié à Nintendo / The Pokémon Company.',
    langSwitcherLabel: 'Langue',
    themeToggleLabel: 'Basculer le mode sombre',
    trainers: 'Dresseurs',
    trainersTitle: 'PokéTruc — Illustrations exclusives de cartes Dresseur',
    trainersDescription: "Illustrations de cartes Dresseur Pokémon TCG n'existant que dans une seule langue ou une seule région (japonais, anglais, occident…). Gratuit, sans pub, fait par un fan.",
    trainersH1: "Illustrations de cartes Dresseur n'existant que dans une seule langue ou une seule région",
    trainersIntro: (n) => `${n} illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes Dresseur`,
    trainersEmpty: 'Aucune carte Dresseur pour le moment — revenez bientôt.',
  },
  ja: {
    siteName: 'PokéTruc',
    tagline: '1つの言語または1つの地域にしか存在しないポケモンTCGのイラスト / アートワーク',
    pokedex: '図鑑',
    info: '情報',
    searchPlaceholder: 'ポケモン・セット・イラストレーターを検索',
    langFilterAria: '限定カテゴリで絞り込む',
    genNavAria: '世代へジャンプ',
    viewToggleAria: '表示を選択：ポケモンまたはカード',
    skipToContent: 'メインコンテンツへスキップ',
    indexTitle: 'PokéTruc — 言語・地域限定のポケモンTCGカードイラスト',
    indexDescription: '1つの言語（日本語・英語・中国語・韓国語）または1つの地域（欧米・アジア）にしか存在しないポケモンTCGのイラスト／アートワーク。完全無料・広告なし・ファン制作。',
    indexH1: '1つの言語または1つの地域にしか存在しないポケモンTCGのイラスト / アートワーク',
    seoAbout: 'ポケモンTCGには、特定の言語でしか印刷されなかった限定イラストのカードや、特定の地域でしか発売されなかったカードが数多く存在します。1996年に切手雑誌の付録として配布された日本限定プロモ、2002年に日本でのみ配布されたマクドナルドのポケモン-e、最新セットの中国市場限定カード、欧米向けにのみ展開された Call of Legends や My First Battle のような日本未発売のセットなど。PokéTrucでは、フシギダネ、リザードン、ピカチュウをはじめとする第1世代のポケモン、さらにリクエストに応じて追加された他世代のポケモンについて、こうした言語限定・地域限定カードを収録しています。Vending Machine拡張シート、Black & Whiteプロモ、DPt-Pプロモ、マクドナルドプロモ、欧米限定のトレーナーキット、中国限定セットなど幅広く対象とし、Ken Sugimori、Mitsuhiro Arita、Sumiyoshi Kizuki、Yuka Moriiといった著名イラストレーターの作品も含まれます。ポケモン別・セット別・限定カテゴリ別・年代別に整理されたPokéTrucで、まだ見たことのない希少なイラストを見つけてください。完全無料・広告なし・ファン制作です。',
    seoPokedexHeading: '限定カードがあるポケモンをすべて見る',
    newsHeading: '最新の限定カード',
    infoTitle: 'PokéTruc — このサイトについて',
    infoDescription: 'PokéTrucについて：1つの言語にしか存在しないポケモンTCGカードの限定イラストを集めたファン制作のカタログです。無料・広告なし。',
    infoH1: 'PokéTrucについて',
    aboutHeading: 'このアプリについて',
    aboutBody: [
      'このサイトは楽しみのために、また学習目的で開発しました（開発者ではないので、私には少し挑戦です）。そのため、とてもシンプルで基本的な作りになっています。',
      'その目的は、独自のイラストを持つすべてのポケモンTCGカードをリストアップすることです。「独自」とは、1つの言語（日本語、英語、中国語、またはその他）でのみ入手可能なもの、または1つの地域でのみ発売されたもの（例：欧米限定の Call of Legends や My First Battle のような日本未発売セット）を意味します。これが私がコレクションしたいカードの種類です。',
      '完全無料、広告なしです。',
      '注意を払っていますが、一部の情報が不正確な場合があります。エラーを見つけた場合やフィードバックをお送りいただける場合は、メールでご連絡ください。',
      'それでは :)',
    ],
    contactHeading: 'お問い合わせ',
    disclaimerBody: [
      'このサイトは非公式のファン制作サイトです。ポケモンおよびポケモンキャラクター名はNintendo / Creatures Inc. / GAME FREAK inc.の商標です。',
      'このサイトは個人情報を収集せず、ユーザーアカウントも不要です。いかなる情報もデバイス外に送信・保存されません。',
    ],
    creditsHeading: 'クレジット',
    creditsBefore: '1つの言語にしか存在しないカードを見つける際にご協力いただいたRedditユーザー ',
    creditsLinkText: 'u/TwentyFour7',
    creditsBetween: ' さんと',
    creditsLinkText2: 'u/Quuador',
    creditsAfter: ' さんに心より感謝いたします。',
    sourceCodeHeading: 'ソースコード',
    sourceCodeBefore: 'このサイトのソースコードはGitHubで公開されています：',
    emailLabel: 'メール：',
    redditLabel: 'Reddit：',
    opensInNewTab: '新しいタブで開く',
    upToPokedex:   '↑ 図鑑',
    setsHeading: '収録セット',
    artistsHeading: 'イラストレーター',
    artistPrefix: 'イラストレーター',
    sourceLinkText: '出典',
    descriptionToggle: 'メモ',
    langJapaneseHeading:   '日本限定カード',
    langEnglishHeading:    '英語限定カード',
    langChineseHeading:    '中国語限定カード',
    langKoreanHeading:     '韓国語限定カード',
    langGermanHeading:     'ドイツ語限定カード',
    langSpanishHeading:    'スペイン語限定カード',
    langFrenchHeading:     'フランス語限定カード',
    langItalianHeading:    'イタリア語限定カード',
    langPortugueseHeading: 'ポルトガル語限定カード',
    langPolishHeading:     'ポーランド語限定カード',
    langIndonesianHeading: 'インドネシア語限定カード',
    langRussianHeading:    'ロシア語限定カード',
    langWesternHeading:    '欧米限定カード',
    langAsianHeading:      'アジア限定カード',
    cardsSection: (n) => `${n}枚の限定TCGカードイラスト`,
    detailTitle: (name, n) => `${name} — 限定TCGカードイラスト${n}枚 | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${name}（#${pad(id)}）の限定ポケモンTCGカードイラスト${n}枚。1つの言語（日本語、英語、中国語など）または1つの地域（欧米限定・アジア限定）でのみ発行された独自イラストを掲載しています。`,
    detailOgDescription: (name, n) =>
      `${name}の限定TCGカードイラスト${n}枚。1つの言語または地域でのみ発行された独自イラストを掲載しています。`,
    schemaDetailDescription: (name, id) =>
      `${name}（#${pad(id)}）の限定ポケモンTCGカードイラスト。1つの言語または地域でのみ発行された独自イラストです。`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: 'JavaScriptが無効です。動的なポケモン一覧は表示されませんが、下のリストからすべてのポケモンを閲覧できます。',
    footerCopyright: '© 2026 - 3590 PokéTruc — ファン制作、任天堂／株式会社ポケモンとは無関係です。',
    langSwitcherLabel: '言語',
    themeToggleLabel: 'ダークモードを切り替え',
    trainers: 'トレーナー',
    trainersTitle: 'PokéTruc — 言語・地域限定のトレーナーズカードイラスト',
    trainersDescription: '1つの言語または1つの地域にしか存在しないポケモンTCGのトレーナーズカードイラスト。完全無料・広告なし・ファン制作。',
    trainersH1: '1つの言語または1つの地域にしか存在しないトレーナーズカードのイラスト',
    trainersIntro: (n) => `${n}枚の限定トレーナーズカードイラスト`,
    trainersEmpty: 'トレーナーズカードはまだありません。またご覧ください。',
  },
  ko: {
    siteName: 'PokéTruc',
    tagline: '한 가지 언어 또는 한 지역에서만 존재하는 포켓몬 TCG 일러스트 / 아트워크',
    pokedex: '도감',
    info: '정보',
    searchPlaceholder: '포켓몬, 세트, 일러스트레이터 검색',
    langFilterAria: '한정 카테고리로 필터링',
    genNavAria: '세대로 이동',
    viewToggleAria: '표시 선택: 포켓몬 또는 카드',
    skipToContent: '본문으로 건너뛰기',
    indexTitle: 'PokéTruc — 언어·지역 한정 포켓몬 TCG 카드 일러스트',
    indexDescription: '한 가지 언어(일본어, 영어, 중국어, 한국어) 또는 한 지역(서양·아시아)에서만 존재하는 포켓몬 TCG 일러스트 / 아트워크. 무료, 광고 없음, 팬 제작.',
    indexH1: '한 가지 언어 또는 한 지역에서만 존재하는 포켓몬 TCG 일러스트 / 아트워크',
    seoAbout: '포켓몬 TCG에는 단 하나의 언어로만 인쇄된 한정 일러스트 카드, 또는 단 하나의 지역에서만 출시된 카드가 다수 존재합니다. 1996년 우표 잡지 부록으로 배포된 일본 한정 프로모, 2002년 일본에서만 배포된 맥도날드 포켓몬-e 카드, 최신 세트의 중국 시장 한정 카드, 일본에서는 출시되지 않은 서양 한정 세트인 Call of Legends나 My First Battle 등이 대표적입니다. PokéTruc은 이상해씨, 리자몽, 피카츄를 비롯한 1세대 포켓몬, 그리고 요청에 따라 추가된 다른 세대의 포켓몬에 대해 이러한 언어·지역 한정 카드를 정리합니다. 일본 자판기 익스팬션 시트, Black & White 프로모, DPt-P 프로모, 맥도날드 프로모, 서양 한정 트레이너 키트, 중국 한정 세트까지 폭넓게 다루며 Ken Sugimori, Mitsuhiro Arita, Sumiyoshi Kizuki, Yuka Morii 등 유명 일러스트레이터의 작품도 포함됩니다. 포켓몬·세트·한정 카테고리·연도별로 정리된 PokéTruc에서 한 번도 보지 못한 희귀 일러스트를 찾아보세요. 완전 무료, 광고 없음, 팬 제작.',
    seoPokedexHeading: '한정 카드가 있는 모든 포켓몬 둘러보기',
    newsHeading: '최신 한정 카드',
    infoTitle: 'PokéTruc — 사이트 소개',
    infoDescription: 'PokéTruc 소개: 하나의 언어로만 발매된 포켓몬 TCG 카드의 한정 일러스트를 모은 팬 제작 카탈로그입니다. 무료, 광고 없음.',
    infoH1: 'PokéTruc 소개',
    aboutHeading: '앱 소개',
    aboutBody: [
      "이 사이트는 재미를 위해, 그리고 학습 목적으로 개발되었습니다 (개발자가 아니기 때문에 저에게는 작은 도전입니다). 그래서 매우 단순하고 기본적입니다.",
      "그 목적은 독특한 일러스트를 가진 모든 포켓몬 TCG 카드를 나열하는 것입니다. '독특하다'는 것은 한 가지 언어(일본어, 영어, 중국어 또는 기타)로만 제공되거나, 한 지역에서만 출시된 것(예: 일본에서 출시되지 않은 Call of Legends나 My First Battle 같은 서양 한정 세트)을 의미합니다. 이것이 제가 수집하고 싶은 카드의 종류입니다.",
      "완전 무료이며 광고가 없습니다.",
      "주의를 기울였지만 일부 정보가 부정확할 수 있습니다. 오류를 발견하거나 피드백을 제공하고 싶으시면 이메일로 연락해 주세요.",
      "Voilà, voilà :)",
    ],
    contactHeading: '문의하기',
    disclaimerBody: [
      '이 사이트는 비공식 팬 제작 사이트입니다. 포켓몬 및 포켓몬 캐릭터 이름은 Nintendo / Creatures Inc. / GAME FREAK inc.의 상표입니다.',
      '이 사이트는 개인 정보를 수집하지 않으며 사용자 계정도 필요하지 않습니다. 어떠한 정보도 기기 외부로 전송되거나 저장되지 않습니다.',
    ],
    creditsHeading: '감사의 말',
    creditsBefore: '한 가지 언어로만 존재하는 카드를 찾는 데 큰 도움을 주신 Reddit 사용자 ',
    creditsLinkText: 'u/TwentyFour7',
    creditsBetween: ' 님과 ',
    creditsLinkText2: 'u/Quuador',
    creditsAfter: ' 님께 진심으로 감사드립니다.',
    sourceCodeHeading: '소스 코드',
    sourceCodeBefore: '이 사이트의 소스 코드는 GitHub에 공개되어 있습니다: ',
    emailLabel: '이메일:',
    redditLabel: 'Reddit:',
    opensInNewTab: '새 탭에서 열기',
    upToPokedex:   '↑ 도감',
    setsHeading: '수록 세트',
    artistsHeading: '일러스트레이터',
    artistPrefix: '일러스트레이터',
    sourceLinkText: '출처',
    descriptionToggle: '메모',
    langJapaneseHeading:   '일본어 한정 카드',
    langEnglishHeading:    '영어 한정 카드',
    langChineseHeading:    '중국어 한정 카드',
    langKoreanHeading:     '한국어 한정 카드',
    langGermanHeading:     '독일어 한정 카드',
    langSpanishHeading:    '스페인어 한정 카드',
    langFrenchHeading:     '프랑스어 한정 카드',
    langItalianHeading:    '이탈리아어 한정 카드',
    langPortugueseHeading: '포르투갈어 한정 카드',
    langPolishHeading:     '폴란드어 한정 카드',
    langIndonesianHeading: '인도네시아어 한정 카드',
    langRussianHeading:    '러시아어 한정 카드',
    langWesternHeading:    '서양 한정 카드',
    langAsianHeading:      '아시아 한정 카드',
    cardsSection: (n) => `${n}장의 한정 TCG 카드 일러스트`,
    detailTitle: (name, n) => `${name} — 한정 TCG 카드 일러스트 ${n}장 | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${name}(#${pad(id)})의 한정 포켓몬 TCG 카드 일러스트 ${n}장. 한 가지 언어(일본어, 영어, 중국어 등) 또는 한 지역(서양 한정·아시아 한정)으로만 발매된 독점 일러스트를 모았습니다.`,
    detailOgDescription: (name, n) =>
      `${name}의 한정 TCG 카드 일러스트 ${n}장. 한 가지 언어 또는 한 지역으로만 발매된 독점 일러스트입니다.`,
    schemaDetailDescription: (name, id) =>
      `${name}(#${pad(id)})의 한정 포켓몬 TCG 카드 일러스트. 한 가지 언어 또는 한 지역으로만 발매된 독점 일러스트입니다.`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: 'JavaScript가 비활성화되어 있어 동적 포켓몬 그리드는 표시되지 않습니다. 아래 목록에서 모든 포켓몬을 확인할 수 있습니다.',
    footerCopyright: '© 2026 - 3590 PokéTruc — 팬 제작, Nintendo / The Pokémon Company와 무관합니다.',
    langSwitcherLabel: '언어',
    themeToggleLabel: '다크 모드 전환',
    trainers: '트레이너',
    trainersTitle: 'PokéTruc — 언어·지역 한정 트레이너 카드 일러스트',
    trainersDescription: '한 가지 언어 또는 한 지역에서만 존재하는 포켓몬 TCG 트레이너 카드 일러스트. 무료, 광고 없음, 팬 제작.',
    trainersH1: '한 가지 언어 또는 한 지역에서만 존재하는 트레이너 카드 일러스트',
    trainersIntro: (n) => `${n}장의 한정 트레이너 카드 일러스트`,
    trainersEmpty: '아직 트레이너 카드가 없습니다. 곧 다시 확인해 주세요.',
  },
  zh: {
    siteName: 'PokéTruc',
    tagline: '仅在一种语言或一个地区中发行的宝可梦 TCG 插画 / 美术图',
    pokedex: '图鉴',
    info: '信息',
    searchPlaceholder: '搜索宝可梦、卡组或插画师',
    langFilterAria: '按独占类别筛选',
    genNavAria: '跳转到世代',
    viewToggleAria: '选择显示方式：宝可梦或卡片',
    skipToContent: '跳到主要内容',
    indexTitle: 'PokéTruc — 语言·地区独占的宝可梦 TCG 卡牌插画',
    indexDescription: '仅在一种语言（日文、英文、中文或韩文）或一个地区（西方·亚洲）中发行的宝可梦 TCG 插画 / 美术图。免费、无广告、由粉丝制作。',
    indexH1: '仅在一种语言或一个地区中发行的宝可梦 TCG 插画 / 美术图',
    seoAbout: '宝可梦 TCG 中有许多卡牌的插画仅以单一语言印刷发行，也有许多卡牌仅在单一地区发行。1996 年作为邮票杂志附录发行的日本限定促销卡，2002 年仅在日本麦当劳发行的宝可梦-e 卡，最新卡组中仅在中国市场推出的独占卡牌，以及只在西方地区发行（英文、德文、法文、意大利文、西班牙文）但从未在日本发行的 Call of Legends 或 My First Battle 等卡组。PokéTruc 收录了妙蛙种子、喷火龙、皮卡丘等第一世代宝可梦，以及应玩家请求添加的其他世代宝可梦的此类语言·地区独占卡牌，涵盖日本贩卖机扩展卡板、Black & White 促销卡、DPt-P 促销卡、麦当劳促销卡、西方限定训练家组以及中国独占卡组，作品由 Ken Sugimori、Mitsuhiro Arita、Sumiyoshi Kizuki、Yuka Morii 等知名插画师绘制。按宝可梦、卡组、独占类别和年份分类整理，让您能够找到从未见过的稀有插画。完全免费、无广告、由粉丝制作。',
    seoPokedexHeading: '查看所有拥有独占卡牌的宝可梦',
    newsHeading: '最新独占卡牌',
    infoTitle: 'PokéTruc — 关于本站',
    infoDescription: '关于 PokéTruc：一份由粉丝制作的目录，收录仅在单一语言中发行的宝可梦 TCG 独占卡牌插画。免费、无广告。',
    infoH1: '关于 PokéTruc',
    aboutHeading: '关于',
    aboutBody: [
      "这个网站是为了乐趣而开发的，也是出于学习目的（作为一名非开发者，这对我来说是一个小挑战）。这就是为什么它非常简单和基础。",
      "它的目的是列出所有具有独特插图的宝可梦 TCG 卡片。所谓「独特」，是指只在一种语言（日语、英语、中文或其他语言）中提供，或只在一个地区发行的卡片（例如未在日本发行的西方限定卡组，如 Call of Legends 或 My First Battle）。这就是我喜欢收藏的那种卡片。",
      "完全免费，无广告。",
      "尽管尽了一切努力，部分信息可能不准确。如果您发现错误或想提供反馈，请随时通过电子邮件联系我。",
      "Voilà, voilà :)",
    ],
    contactHeading: '联系我们',
    disclaimerBody: [
      '本网站是非官方的粉丝制作网站。宝可梦及宝可梦角色名称是 Nintendo / Creatures Inc. / GAME FREAK inc. 的商标。',
      '本网站不收集任何个人数据，也不需要用户账户。任何信息均不会在设备外部传输或存储。',
    ],
    creditsHeading: '鸣谢',
    creditsBefore: '特别感谢 Reddit 用户 ',
    creditsLinkText: 'u/TwentyFour7',
    creditsBetween: ' 和 ',
    creditsLinkText2: 'u/Quuador',
    creditsAfter: ' 协助寻找仅以单一语言发行的卡牌。',
    sourceCodeHeading: '源代码',
    sourceCodeBefore: '本站源代码已在 GitHub 上开源：',
    emailLabel: '邮箱：',
    redditLabel: 'Reddit：',
    opensInNewTab: '在新标签页中打开',
    upToPokedex:   '↑ 图鉴',
    setsHeading: '收录的卡组',
    artistsHeading: '插画师',
    artistPrefix: '插画师',
    sourceLinkText: '来源',
    descriptionToggle: '备注',
    langJapaneseHeading:   '日文独占卡牌',
    langEnglishHeading:    '英文独占卡牌',
    langChineseHeading:    '中文独占卡牌',
    langKoreanHeading:     '韩文独占卡牌',
    langGermanHeading:     '德文独占卡牌',
    langSpanishHeading:    '西班牙文独占卡牌',
    langFrenchHeading:     '法文独占卡牌',
    langItalianHeading:    '意大利文独占卡牌',
    langPortugueseHeading: '葡萄牙文独占卡牌',
    langPolishHeading:     '波兰文独占卡牌',
    langIndonesianHeading: '印尼文独占卡牌',
    langRussianHeading:    '俄文独占卡牌',
    langWesternHeading:    '西方独占卡牌',
    langAsianHeading:      '亚洲独占卡牌',
    cardsSection: (n) => `${n} 张独占 TCG 卡牌插画`,
    detailTitle: (name, n) => `${name} — ${n} 张独占 TCG 卡牌插画 | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${name}（#${pad(id)}）的 ${n} 张独占宝可梦 TCG 卡牌插画。仅在单一语言（日文、英文、中文或其他语言）或单一地区（西方独占·亚洲独占）发行的独家插画。`,
    detailOgDescription: (name, n) =>
      `${name}的 ${n} 张独占 TCG 卡牌插画。仅在单一语言或单一地区发行的独家插画。`,
    schemaDetailDescription: (name, id) =>
      `${name}（#${pad(id)}）的独占宝可梦 TCG 卡牌插画。仅在单一语言或单一地区发行的独家插画。`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: '您的浏览器已禁用 JavaScript，无法显示动态宝可梦网格。您仍可在下方浏览所有宝可梦。',
    footerCopyright: '© 2026 - 3590 PokéTruc — 粉丝制作，与任天堂／株式会社宝可梦无关。',
    langSwitcherLabel: '语言',
    themeToggleLabel: '切换深色模式',
    trainers: '训练家',
    trainersTitle: 'PokéTruc — 语言·地区独占的训练家卡牌插画',
    trainersDescription: '仅在一种语言或一个地区中发行的宝可梦 TCG 训练家卡牌插画。免费、无广告、由粉丝制作。',
    trainersH1: '仅在一种语言或一个地区中发行的训练家卡牌插画',
    trainersIntro: (n) => `${n} 张独占训练家卡牌插画`,
    trainersEmpty: '暂时还没有训练家卡牌，敬请期待。',
  },
};

function pad(id) { return String(id).padStart(3, '0'); }

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkifyDescription(text, L) {
  const escaped = escapeHtml(text);
  const linkText = escapeHtml(L.sourceLinkText);
  const ariaLabel = escapeHtml(`${L.sourceLinkText} (${L.opensInNewTab})`);
  return escaped.replace(/https?:\/\/[^\s]+/g, (match) => {
    const trailMatch = match.match(/[.,;:!?]+$/);
    const trail = trailMatch ? trailMatch[0] : '';
    const url = trail ? match.slice(0, -trail.length) : match;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${ariaLabel}">${linkText}<span aria-hidden="true"> ↗</span></a>${trail}`;
  });
}

function cardsFor(pokemonId) {
  return cards.filter(c => c.pokemonId === pokemonId).sort((a, b) => a.year - b.year);
}

function joinListLang(items, lang) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const r = JOIN_RULES[lang] || JOIN_RULES.en;
  if (items.length === 2) return items[0] + r.last + items[1];
  return items.slice(0, -1).join(r.sep) + r.last + items[items.length - 1];
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

// Build the "PokéTruc has catalogued N illustrations..." sentence per language.
const STATS_BUILDERS = {
  en: ({ name, count, minY, maxY, byLang, artists }) => {
    const wordP = count === 1 ? 'illustration' : 'illustrations';
    const yearPart = (minY === maxY) ? `published in ${minY}` : `spanning ${minY} to ${maxY}`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => {
      const n = byLang[l.flag];
      return `${n} ${STATS_LANG_LABEL.en[l.flag]}-exclusive ${n === 1 ? 'card' : 'cards'}`;
    });
    const langSentence = langParts.length ? `The collection includes ${joinListLang(langParts, 'en')}.` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = ` Illustrated by ${artists[0]}.`;
    else if (artists.length > 1) artistSentence = ` Illustrated by ${artists.length} different artists including ${joinListLang(artists.slice(0, 3), 'en')}.`;
    return `PokéTruc has catalogued ${count} exclusive ${name} TCG card ${wordP}, ${yearPart}. ${langSentence}${artistSentence}`;
  },
  fr: ({ name, count, minY, maxY, byLang, artists }) => {
    const s = count > 1 ? 's' : '';
    const yearPart = (minY === maxY) ? `publiée${s} en ${minY}` : `de ${minY} à ${maxY}`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => {
      const n = byLang[l.flag];
      const sn = n > 1 ? 's' : '';
      return `${n} carte${sn} ${STATS_LANG_LABEL.fr[l.flag]}${sn}`;
    });
    const langSentence = langParts.length ? `La collection comprend ${joinListLang(langParts, 'fr')}.` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = ` Illustrée${s} par ${artists[0]}.`;
    else if (artists.length > 1) artistSentence = ` Illustrées par ${artists.length} artistes différents dont ${joinListLang(artists.slice(0, 3), 'fr')}.`;
    return `PokéTruc recense ${count} illustration${s} de carte${s} TCG ${name} exclusive${s} à une seule langue ou région, ${yearPart}. ${langSentence}${artistSentence}`;
  },
  ja: ({ name, count, minY, maxY, byLang, artists }) => {
    const yearPart = (minY === maxY) ? `${minY}年発行` : `${minY}年から${maxY}年`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => `${STATS_LANG_LABEL.ja[l.flag]}${byLang[l.flag]}枚`);
    const langSentence = langParts.length ? `内訳は${joinListLang(langParts, 'ja')}です。` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = `イラストは${artists[0]}が担当しています。`;
    else if (artists.length > 1) artistSentence = `${artists.length}名のイラストレーター（${joinListLang(artists.slice(0, 3), 'ja')}など）が手がけています。`;
    return `PokéTrucでは、${name}の限定TCGカードイラスト${count}枚（${yearPart}）を収録しています。${langSentence}${artistSentence}`;
  },
  ko: ({ name, count, minY, maxY, byLang, artists }) => {
    const yearPart = (minY === maxY) ? `${minY}년 발행` : `${minY}년부터 ${maxY}년까지`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => `${STATS_LANG_LABEL.ko[l.flag]} ${byLang[l.flag]}장`);
    const langSentence = langParts.length ? `포함 내역: ${joinListLang(langParts, 'ko')}.` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = ` 일러스트는 ${artists[0]}이(가) 그렸습니다.`;
    else if (artists.length > 1) artistSentence = ` ${artists.length}명의 일러스트레이터가 참여했으며, ${joinListLang(artists.slice(0, 3), 'ko')} 등이 포함됩니다.`;
    return `PokéTruc에는 ${name}의 한정 TCG 카드 일러스트 ${count}장(${yearPart})이 수록되어 있습니다. ${langSentence}${artistSentence}`;
  },
  zh: ({ name, count, minY, maxY, byLang, artists }) => {
    const yearPart = (minY === maxY) ? `${minY} 年发行` : `${minY}–${maxY} 年`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => `${byLang[l.flag]} 张${STATS_LANG_LABEL.zh[l.flag]}`);
    const langSentence = langParts.length ? `包括${joinListLang(langParts, 'zh')}。` : '';
    let artistSentence = '';
    if (artists.length === 1) artistSentence = `由 ${artists[0]} 绘制。`;
    else if (artists.length > 1) artistSentence = `由 ${artists.length} 位插画师绘制，包括 ${joinListLang(artists.slice(0, 3), 'zh')} 等。`;
    return `PokéTruc 收录了 ${count} 张 ${name} 的独占 TCG 卡牌插画（${yearPart}）。${langSentence}${artistSentence}`;
  },
};

// Build the aggregate "PokéTruc has catalogued N illustrations across the whole
// collection..." sentence shown on the home page (no artist mention).
const HOME_STATS_BUILDERS = {
  en: ({ count, minY, maxY, byLang, pokemonCount }) => {
    const wordP = count === 1 ? 'illustration' : 'illustrations';
    const yearPart = (minY === maxY) ? `published in ${minY}` : `spanning ${minY} to ${maxY}`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => {
      const n = byLang[l.flag];
      return `${n} ${STATS_LANG_LABEL.en[l.flag]}-exclusive ${n === 1 ? 'card' : 'cards'}`;
    });
    const langSentence = langParts.length ? `The collection includes ${joinListLang(langParts, 'en')}.` : '';
    return `PokéTruc has catalogued ${count} exclusive Pokémon TCG card ${wordP} across ${pokemonCount} Pokémon, ${yearPart}. ${langSentence}`;
  },
  fr: ({ count, minY, maxY, byLang, pokemonCount }) => {
    const s = count > 1 ? 's' : '';
    const yearPart = (minY === maxY) ? `publiée${s} en ${minY}` : `de ${minY} à ${maxY}`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => {
      const n = byLang[l.flag];
      const sn = n > 1 ? 's' : '';
      return `${n} carte${sn} ${STATS_LANG_LABEL.fr[l.flag]}${sn}`;
    });
    const langSentence = langParts.length ? `La collection comprend ${joinListLang(langParts, 'fr')}.` : '';
    return `PokéTruc recense ${count} illustration${s} de carte${s} TCG Pokémon exclusive${s} à une seule langue ou région, réparties sur ${pokemonCount} Pokémon, ${yearPart}. ${langSentence}`;
  },
  ja: ({ count, minY, maxY, byLang, pokemonCount }) => {
    const yearPart = (minY === maxY) ? `${minY}年発行` : `${minY}年から${maxY}年`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => `${STATS_LANG_LABEL.ja[l.flag]}${byLang[l.flag]}枚`);
    const langSentence = langParts.length ? `内訳は${joinListLang(langParts, 'ja')}です。` : '';
    return `PokéTrucでは、${pokemonCount}匹のポケモンを対象に、限定TCGカードイラスト${count}枚（${yearPart}）を収録しています。${langSentence}`;
  },
  ko: ({ count, minY, maxY, byLang, pokemonCount }) => {
    const yearPart = (minY === maxY) ? `${minY}년 발행` : `${minY}년부터 ${maxY}년까지`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => `${STATS_LANG_LABEL.ko[l.flag]} ${byLang[l.flag]}장`);
    const langSentence = langParts.length ? `포함 내역: ${joinListLang(langParts, 'ko')}.` : '';
    return `PokéTruc에는 ${pokemonCount}마리 포켓몬의 한정 TCG 카드 일러스트 ${count}장(${yearPart})이 수록되어 있습니다. ${langSentence}`;
  },
  zh: ({ count, minY, maxY, byLang, pokemonCount }) => {
    const yearPart = (minY === maxY) ? `${minY} 年发行` : `${minY}–${maxY} 年`;
    const langParts = LANG_INFO.filter(l => byLang[l.flag]).sort((a, b) => byLang[b.flag] - byLang[a.flag]).map(l => `${byLang[l.flag]} 张${STATS_LANG_LABEL.zh[l.flag]}`);
    const langSentence = langParts.length ? `包括${joinListLang(langParts, 'zh')}。` : '';
    return `PokéTruc 收录了 ${pokemonCount} 只宝可梦的 ${count} 张独占 TCG 卡牌插画（${yearPart}）。${langSentence}`;
  },
};

function buildHomeStatsSentence(lang) {
  const count = cards.length;
  const years = cards.map(c => c.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  const byLangRaw = cards.reduce((a, c) => { const k = exclusivityKey(c); a[k] = (a[k] || 0) + 1; return a; }, {});
  const byLang = {};
  for (const l of LANG_INFO) if (byLangRaw[l.flag]) byLang[l.flag] = byLangRaw[l.flag];

  const pokemonCount = new Set(cards.map(c => c.pokemonId)).size;

  return HOME_STATS_BUILDERS[lang]({ count, minY, maxY, byLang, pokemonCount });
}

function buildStatsSentence(lang, pokemon, pkCards) {
  const count = pkCards.length;
  const years = pkCards.map(c => c.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  const byLangRaw = pkCards.reduce((a, c) => { const k = exclusivityKey(c); a[k] = (a[k] || 0) + 1; return a; }, {});
  const byLang = {};
  for (const l of LANG_INFO) if (byLangRaw[l.flag]) byLang[l.flag] = byLangRaw[l.flag];

  const artistCounts = pkCards.reduce((a, c) => {
    if (c.artist) a[c.artist] = (a[c.artist] || 0) + 1;
    return a;
  }, {});
  const artists = Object.keys(artistCounts)
    .sort((a, b) => artistCounts[b] - artistCounts[a])
    .map(escapeHtml);

  const localizedName = pokemon.name[NAME_FIELD[lang]] || pokemon.name.en;
  return STATS_BUILDERS[lang]({
    name: escapeHtml(localizedName),
    count, minY, maxY, byLang, artists,
  });
}

// URL helpers: EN sits at root, other languages under /<lang>/.
function langPathPrefix(lang) { return lang === 'en' ? '/' : `/${lang}/`; }
function urlForRoot(lang)     { return BASE_URL + langPathPrefix(lang); }
function urlForInfo(lang)     { return BASE_URL + langPathPrefix(lang) + 'info/'; }
function urlForPokemon(lang, slug) { return BASE_URL + langPathPrefix(lang) + 'pokemon/' + slug + '/'; }
function urlForTrainers(lang)  { return BASE_URL + langPathPrefix(lang) + 'trainers/'; }

// Path-style helpers for inter-page navigation within a language tree (root-relative).
function pathRoot(lang)     { return langPathPrefix(lang); }
function pathInfo(lang)     { return langPathPrefix(lang) + 'info/'; }
function pathTrainers(lang) { return langPathPrefix(lang) + 'trainers/'; }
// Legacy file path kept for redirect stubs at the old /info.html locations.
function legacyInfoFile(lang) { return lang === 'en' ? 'info.html' : `${lang}/info.html`; }
function pathPokemon(lang, slug) { return langPathPrefix(lang) + 'pokemon/' + slug + '/'; }

// hreflang block: one <link rel="alternate"> per language pointing to the
// equivalent page, plus x-default → English.
function hreflangBlock(urlsByLang) {
  const lines = LANGS.map(l =>
    `  <link rel="alternate" hreflang="${HREFLANG[l]}" href="${urlsByLang[l]}">`
  );
  lines.push(`  <link rel="alternate" hreflang="x-default" href="${urlsByLang.en}">`);
  return lines.join('\n');
}

// Common <head> head block (everything between <meta charset> and </head>).
function headBlock({ lang, title, description, canonical, urlsByLang, jsonLd, ogImage, twitterCard, preloadImage }) {
  const og = ogImage || `${BASE_URL}/logo.png`;
  const twCard = twitterCard || 'summary_large_image';
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>(function(){try{var c=document.createElement('canvas');c.width=c.height=16;var x=c.getContext('2d');x.textBaseline='top';x.font='16px sans-serif';x.fillText('\u{1F1E8}\u{1F1E6}',0,0);var d=x.getImageData(0,0,16,16).data,k=false;for(var i=0;i<d.length;i+=4){if(d[i]>150&&d[i+1]<100&&d[i+2]<100&&d[i+3]>0){k=true;break;}}if(!k)document.documentElement.classList.add('flags-need-font');}catch(e){document.documentElement.classList.add('flags-need-font');}})();</script>
  <script>(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
  <title>${t}</title>
  <meta name="description" content="${d}">
  <meta name="robots" content="index, follow">

  <link rel="preload" as="style" href="/style.css?v=${CSS_V}">
  <link rel="preload" as="image" href="/logo.webp" type="image/webp">${preloadImage ? `
  <link rel="preload" as="image" href="${escapeHtml(preloadImage)}" fetchpriority="high">` : ''}
  <link rel="dns-prefetch" href="//gc.zgo.at">
  <link rel="preconnect" href="//gc.zgo.at" crossorigin>

  <!-- Open Graph -->
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${og}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="${HTML_LANG[lang].replace('-', '_')}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${twCard}">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${og}">

  <link rel="canonical" href="${canonical}">
${hreflangBlock(urlsByLang)}
  <link rel="icon" type="image/png" href="/logo.png">
  <link rel="apple-touch-icon" href="/logo.png">
  <link rel="stylesheet" href="/style.css?v=${CSS_V}">

${jsonLd ? `  <script type="application/ld+json">${jsonLd}</script>` : ''}`;
}

// Site header (logo + brand wordmark + nav + language switcher).
// IMPORTANT: no <h1> here — H1 lives in the page-specific main content.
function headerBlock(lang, currentPath, kind) {
  const L = LANG[lang];
  const dexActive      = (kind === 'index')    ? ' aria-current="page"' : '';
  const trainersActive = (kind === 'trainers') ? ' aria-current="page"' : '';
  const infoActive     = (kind === 'info')     ? ' aria-current="page"' : '';

  // Build language-switcher links: switch to the SAME page kind in target lang.
  // currentPath: '' (index), 'info', or { slug: '<slug>' } (pokemon detail).
  function altPathFor(targetLang) {
    if (kind === 'index')    return pathRoot(targetLang);
    if (kind === 'info')     return pathInfo(targetLang);
    if (kind === 'trainers') return pathTrainers(targetLang);
    if (kind === 'pokemon')  return pathPokemon(targetLang, currentPath.slug);
    return pathRoot(targetLang);
  }

  const LANG_LABEL = { en: 'EN', fr: 'FR', ja: '日本語', ko: '한국어', zh: '中文' };
  const langItems = LANGS.map(l => {
    const label = LANG_LABEL[l];
    const isCurrent = (l === lang);
    const ariaCurrent = isCurrent ? ' aria-current="true"' : '';
    const activeClass = isCurrent ? ' active' : '';
    return `<li><a href="${altPathFor(l)}" hreflang="${HREFLANG[l]}" class="lang-link${activeClass}"${ariaCurrent}>${label}</a></li>`;
  }).join('');

  return `  <header>
    <a href="${pathRoot(lang)}" class="logo-link"><img src="/logo.webp" alt="${escapeHtml(L.siteName)}" class="site-logo" width="80" height="80"></a>
    <p class="site-name">${escapeHtml(L.siteName)}</p>
    <p class="site-tagline">${escapeHtml(L.tagline)}</p>
    <nav class="site-nav">
      <a href="${pathRoot(lang)}"${dexActive}>${escapeHtml(L.pokedex)}</a>
      <a href="${pathTrainers(lang)}"${trainersActive}>${escapeHtml(L.trainers)}</a>
      <a href="${pathInfo(lang)}"${infoActive}>${escapeHtml(L.info)}</a>
      <details class="lang-picker">
        <summary class="lang-picker-toggle" aria-label="${escapeHtml(L.langSwitcherLabel)}"><span class="lang-picker-code">${lang.toUpperCase()}</span><span class="lang-picker-caret" aria-hidden="true">▾</span></summary>
        <ul class="lang-picker-menu">${langItems}</ul>
      </details>
      <button class="theme-toggle" id="theme-toggle" aria-label="${escapeHtml(L.themeToggleLabel)}"></button>
    </nav>
  </header>`;
}

function footerBlock(lang) {
  return `  <footer>
    <p>${escapeHtml(LANG[lang].footerCopyright)}</p>
  </footer>`;
}

// Short content hash of the data files, exposed as window.DATA_V so client-side
// fetches of /data/*.json get a cache-busting query string that changes exactly
// when the data changes (GitHub Pages caches everything for 10 minutes).
const DATA_V = crypto.createHash('sha256')
  .update(fs.readFileSync('data/pokemons.json'))
  .update(fs.readFileSync('data/pokemon_cards.json'))
  .digest('hex').slice(0, 8);

// Fullscreen card viewer (accessible dialog). viewer.js holds the shared
// focus/Escape/alt logic; pokemon.js (detail + trainers) and app.js (index)
// initialise it with their own delegation root.
const CLOSE_LABEL = { en: 'Close', fr: 'Fermer', ja: '閉じる', ko: '닫기', zh: '关闭' };
const FULLSCREEN_LABEL = { en: 'Card image in fullscreen', fr: 'Image de la carte en plein écran', ja: 'カード画像の全画面表示', ko: '카드 이미지 전체 화면', zh: '卡牌图片全屏显示' };

function fullscreenBlock(lang) {
  return `  <!-- Fullscreen -->
  <div id="fullscreen" class="fullscreen hidden" role="dialog" aria-modal="true" aria-label="${FULLSCREEN_LABEL[lang]}">
    <div class="fullscreen-backdrop"></div>
    <button type="button" id="fullscreen-close" class="fullscreen-close" aria-label="${CLOSE_LABEL[lang]}">✕</button>
    <img id="fullscreen-img" src="" alt="">
  </div>`;
}

function scriptTags() {
  return `  <script data-goatcounter="https://poketruc.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
  <script>window.DATA_V='${DATA_V}';</script>
  <script src="/i18n.js?v=${JS_V}"></script>
  <script src="/theme.js?v=${JS_V}"></script>
  <script src="/viewer.js?v=${JS_V}"></script>
  <script src="/backtotop.js?v=${JS_V}"></script>`;
}

// -----------------------------------------------------------------------------
// Detail page (per Pokémon, per language)
// -----------------------------------------------------------------------------

// Card-language adjective per UI language, used in image alt-text.
const CARD_LANG_ADJ = {
  en: { '🇯🇵': 'Japanese-exclusive', '🇬🇧': 'English-exclusive', '🇨🇳': 'Chinese-exclusive', '🇰🇷': 'Korean-exclusive', '🇮🇩': 'Indonesian-exclusive', '🇩🇪': 'German-exclusive', '🇪🇸': 'Spanish-exclusive', '🇫🇷': 'French-exclusive', '🇮🇹': 'Italian-exclusive', '🇵🇹': 'Portuguese-exclusive', '🇵🇱': 'Polish-exclusive', '🇷🇺': 'Russian-exclusive', '🌍': 'Western-exclusive', '🏯': 'Asian-exclusive' },
  fr: { '🇯🇵': 'exclusivité japonaise', '🇬🇧': 'exclusivité anglaise', '🇨🇳': 'exclusivité chinoise', '🇰🇷': 'exclusivité coréenne', '🇮🇩': 'exclusivité indonésienne', '🇩🇪': 'exclusivité allemande', '🇪🇸': 'exclusivité espagnole', '🇫🇷': 'exclusivité française', '🇮🇹': 'exclusivité italienne', '🇵🇹': 'exclusivité portugaise', '🇵🇱': 'exclusivité polonaise', '🇷🇺': 'exclusivité russe', '🌍': 'exclusivité occidentale', '🏯': 'exclusivité asiatique' },
  ja: { '🇯🇵': '日本限定', '🇬🇧': '英語限定', '🇨🇳': '中国語限定', '🇰🇷': '韓国語限定', '🇮🇩': 'インドネシア語限定', '🇩🇪': 'ドイツ語限定', '🇪🇸': 'スペイン語限定', '🇫🇷': 'フランス語限定', '🇮🇹': 'イタリア語限定', '🇵🇹': 'ポルトガル語限定', '🇵🇱': 'ポーランド語限定', '🇷🇺': 'ロシア語限定', '🌍': '欧米限定', '🏯': 'アジア限定' },
  ko: { '🇯🇵': '일본어 한정', '🇬🇧': '영어 한정', '🇨🇳': '중국어 한정', '🇰🇷': '한국어 한정', '🇮🇩': '인도네시아어 한정', '🇩🇪': '독일어 한정', '🇪🇸': '스페인어 한정', '🇫🇷': '프랑스어 한정', '🇮🇹': '이탈리아어 한정', '🇵🇹': '포르투갈어 한정', '🇵🇱': '폴란드어 한정', '🇷🇺': '러시아어 한정', '🌍': '서양 한정', '🏯': '아시아 한정' },
  zh: { '🇯🇵': '日文独占', '🇬🇧': '英文独占', '🇨🇳': '中文独占', '🇰🇷': '韩文独占', '🇮🇩': '印尼文独占', '🇩🇪': '德文独占', '🇪🇸': '西班牙文独占', '🇫🇷': '法文独占', '🇮🇹': '意大利文独占', '🇵🇹': '葡萄牙文独占', '🇵🇱': '波兰文独占', '🇷🇺': '俄文独占', '🌍': '西方独占', '🏯': '亚洲独占' },
};

const CARD_ALT_SUFFIX = {
  en: 'Pokémon TCG card',
  fr: 'carte Pokémon TCG',
  ja: 'ポケモンTCGカード',
  ko: '포켓몬 TCG 카드',
  zh: '宝可梦 TCG 卡牌',
};

const CARD_ALT_BY_ARTIST = {
  en: (artist) => ` by ${artist}`,
  fr: (artist) => ` par ${artist}`,
  ja: (artist) => `（イラスト：${artist}）`,
  ko: (artist) => ` (일러스트: ${artist})`,
  zh: (artist) => `（插画师：${artist}）`,
};

function cardAltText(lang, card, localizedName) {
  const adj = (CARD_LANG_ADJ[lang] || CARD_LANG_ADJ.en)[exclusivityKey(card)] || '';
  const artistPart = card.artist ? CARD_ALT_BY_ARTIST[lang](card.artist) : '';
  const suffix = CARD_ALT_SUFFIX[lang];
  const year = card.year ? `, ${card.year}` : '';
  return `${localizedName} — ${card.name} (${adj}${year}) ${suffix}${artistPart}`;
}

function renderCard(card, pokemon, L, lang, localizedName, eager = false) {
  const alt = cardAltText(lang, card, localizedName);
  // First card on the page is the LCP candidate: fetch it eagerly with high
  // priority; everything below the fold stays lazy.
  const loadAttrs = eager ? ' fetchpriority="high"' : ' loading="lazy"';
  return `
        <div class="card-item" id="${card.imageName}" data-img="/cards/${card.imageName}.avif">
          <button type="button" class="card-zoom">
            <img ${cardSrcAttrs(card.imageName, GRID_SIZES)} alt="${escapeHtml(alt)}"${loadAttrs} decoding="async">
          </button>
          <div class="card-info">
            <div class="card-name">${escapeHtml(card.name)}</div>
            <div class="card-meta"><span class="lang-badge">${card.languages.join(' ')}</span> ${card.year} · ${escapeHtml(card.rarity)}</div>
            ${card.artist ? `<div class="card-artist">${escapeHtml(L.artistPrefix)}: ${escapeHtml(card.artist)}</div>` : ''}
            ${card.description ? `<details class="card-description">
              <summary class="card-description-toggle">${escapeHtml(L.descriptionToggle)}</summary>
              <div class="card-description-body">${linkifyDescription(card.description, L)}</div>
            </details>` : ''}
          </div>
        </div>`;
}

// Order exclusivity groups: known LANG_INFO flags first (then any unknown
// flag), re-sorted by group size desc — stable sort keeps the LANG_INFO order
// as the tie-breaker.
function orderExclusivityFlags(groups) {
  return [
    ...LANG_INFO.map(l => l.flag).filter(f => groups.has(f)),
    ...[...groups.keys()].filter(f => !LANG_INFO.some(l => l.flag === f)),
  ].sort((a, b) => groups.get(b).length - groups.get(a).length);
}

// Shared layout for the card sections (per-Pokémon detail + trainers gallery):
// one flat grid when there's a single exclusivity group, otherwise one open
// <details> per group. `intro` is the localised count line; `renderItem(card,
// eager)` renders a single card (the first card overall is the eager LCP one).
function buildCardSectionHTML(items, L, intro, renderItem) {
  const groups = groupBy(items, exclusivityKey);
  const orderedFlags = orderExclusivityFlags(groups);
  const headingByFlag = Object.fromEntries(LANG_INFO.map(l => [l.flag, L[l.key]]));
  const sectionTitle = `<p class="cards-section-title">${intro}</p>`;

  if (orderedFlags.length <= 1) {
    const onlyFlag = orderedFlags[0];
    const cs = (onlyFlag ? groups.get(onlyFlag) : items).slice().sort((a, b) => a.year - b.year);
    return `
    <section class="cards-section">
      ${sectionTitle}
      <div class="cards-grid">
        ${cs.map((c, i) => renderItem(c, i === 0)).join('')}
      </div>
    </section>`;
  }

  const groupsHTML = orderedFlags.map((flag, gi) => {
    const cs = groups.get(flag).slice().sort((a, b) => a.year - b.year);
    const heading = headingByFlag[flag] || 'Other-exclusive cards';
    return `
      <details class="cards-lang-group" open>
        <summary class="cards-lang-summary">
          <h2 class="cards-lang-title">${flag} ${escapeHtml(heading)} (${cs.length})</h2>
          <span class="cards-lang-caret" aria-hidden="true">▾</span>
        </summary>
        <div class="cards-grid">
          ${cs.map((c, i) => renderItem(c, gi === 0 && i === 0)).join('')}
        </div>
      </details>`;
  }).join('');

  return `
    <section class="cards-section">
      ${sectionTitle}
      ${groupsHTML}
    </section>`;
}

function buildCardsSectionHTML(pokemon, pkCards, L, lang, localizedName) {
  return buildCardSectionHTML(pkCards, L, L.cardsSection(pkCards.length),
    (c, eager) => renderCard(c, pokemon, L, lang, localizedName, eager));
}

// First card as rendered (largest exclusivity group, earliest year). It's the
// LCP candidate on detail pages, so the <head> preloads it. Mirrors the
// ordering in buildCardsSectionHTML / buildTrainersSectionHTML.
function firstDisplayedCard(items) {
  if (!items.length) return null;
  const groups = groupBy(items, exclusivityKey);
  const orderedFlags = orderExclusivityFlags(groups);
  const first = orderedFlags.length ? groups.get(orderedFlags[0]) : items;
  return first.slice().sort((a, b) => a.year - b.year)[0];
}

// --- Trainer cards (flat gallery, grouped by exclusivity) --------------------
// Trainer cards have no pokemonId; they carry a `title` (what the card depicts)
// instead of being named by a Pokémon. Everything else mirrors a Pokémon card.

function renderTrainerCard(card, L, lang, eager = false) {
  const alt = cardAltText(lang, card, card.title);
  const loadAttrs = eager ? ' fetchpriority="high"' : ' loading="lazy"';
  return `
        <div class="card-item" id="${card.imageName}" data-img="/cards/${card.imageName}.avif">
          <button type="button" class="card-zoom">
            <img ${cardSrcAttrs(card.imageName, GRID_SIZES)} alt="${escapeHtml(alt)}"${loadAttrs} decoding="async">
          </button>
          <div class="card-info">
            <div class="card-name">${escapeHtml(card.title)}</div>
            <div class="card-meta"><span class="lang-badge">${card.languages.join(' ')}</span> ${card.year} · ${escapeHtml(card.rarity)}</div>
            ${card.name ? `<div class="card-set">${escapeHtml(card.name)}</div>` : ''}
            ${card.artist ? `<div class="card-artist">${escapeHtml(L.artistPrefix)}: ${escapeHtml(card.artist)}</div>` : ''}
            ${card.description ? `<details class="card-description">
              <summary class="card-description-toggle">${escapeHtml(L.descriptionToggle)}</summary>
              <div class="card-description-body">${linkifyDescription(card.description, L)}</div>
            </details>` : ''}
          </div>
        </div>`;
}

function buildTrainersSectionHTML(items, L, lang) {
  return buildCardSectionHTML(items, L, L.trainersIntro(items.length),
    (c, eager) => renderTrainerCard(c, L, lang, eager));
}

function buildSetsAndArtistsHTML(pkCards, L) {
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
        <h3 class="meta-title">${escapeHtml(L.setsHeading)} (${setsList.length})</h3>
        <p class="meta-list">${setsList.map(escapeHtml).join(' · ')}</p>
      </div>`
    : '';
  const artistsHTML = artistsList.length > 0
    ? `<div class="meta-block">
        <h3 class="meta-title">${escapeHtml(L.artistsHeading)} (${artistsList.length})</h3>
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

function detailPageHTML(lang, pokemon, pkCards, prev, next) {
  const L = LANG[lang];
  const localizedName = pokemon.name[NAME_FIELD[lang]] || pokemon.name.en;
  const slug  = slugify(pokemon.name.en);
  const count = pkCards.length;

  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForPokemon(l, slug)]));
  const canonical  = urlsByLang[lang];

  const breadcrumbList = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": L.pokedex, "item": urlForRoot(lang) },
      { "@type": "ListItem", "position": 2, "name": localizedName, "item": canonical },
    ],
  };
  const collectionPage = {
    "@type": "CollectionPage",
    "@id": `${canonical}#collection`,
    "name": L.detailTitle(localizedName, count).replace(' | PokéTruc', ''),
    "description": L.schemaDetailDescription(localizedName, pokemon.id),
    "url": canonical,
    "inLanguage": HTML_LANG[lang],
    "isPartOf": { "@id": `${BASE_URL}/#website` },
    "about": {
      "@type": "Thing",
      "name": localizedName,
      "alternateName": LANGS.filter(l => l !== lang).map(l => pokemon.name[NAME_FIELD[l]] || pokemon.name.en),
      "description": `Pokémon #${pokemon.id}`,
    },
  };

  // Per-card structured data: each card → VisualArtwork, wrapped in an ItemList
  // so Google can index individual cards (e.g. "Bulbasaur Sumiyoshi Kizuki 1998").
  const itemList = {
    "@type": "ItemList",
    "@id": `${canonical}#cards`,
    "name": `${localizedName} — ${L.cardsSection(count)}`,
    "numberOfItems": count,
    "itemListOrder": "https://schema.org/ItemListOrderAscending",
    "isPartOf": { "@id": `${canonical}#collection` },
    "itemListElement": pkCards.map((card, i) => {
      const isos = card.languages.map(f => FLAG_TO_ISO[f]).filter(Boolean);
      // Slim per-card entity: name/image/date/creator/language is all Google
      // reads for a catalog page — the verbose graph tripled page weight.
      const artwork = {
        "@type": "VisualArtwork",
        "@id": `${BASE_URL}/cards/${card.imageName}`,
        "name": `${localizedName} — ${card.name}${card.year ? ` (${card.year})` : ''}`,
        "image": `${BASE_URL}/cards/${card.imageName}.avif`,
      };
      if (card.year)        artwork.datePublished = String(card.year);
      if (isos.length === 1) artwork.inLanguage = isos[0];
      else if (isos.length > 1) artwork.inLanguage = isos;
      if (card.artist)   artwork.creator = { "@type": "Person", "name": card.artist };
      return { "@type": "ListItem", "position": i + 1, "item": artwork };
    }),
  };

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [collectionPage, breadcrumbList, itemList],
  });

  const title = L.detailTitle(localizedName, count);
  const description = L.detailDescription(localizedName, pokemon.id, count);

  const ogImage = `${BASE_URL}/monsters/${pokemon.imageName}.png`;

  const firstCard = firstDisplayedCard(pkCards);
  const head = headBlock({
    lang,
    title,
    description,
    canonical,
    urlsByLang,
    jsonLd,
    ogImage,
    twitterCard: 'summary',
    preloadImage: firstCard ? cardPreloadHref(firstCard.imageName) : undefined,
  });

  // <link rel="prev/next"> for crawl chain
  const prevLinks = [];
  if (prev) prevLinks.push(`  <link rel="prev" href="${urlForPokemon(lang, slugify(prev.name.en))}">`);
  if (next) prevLinks.push(`  <link rel="next" href="${urlForPokemon(lang, slugify(next.name.en))}">`);
  const navLinks = prevLinks.join('\n');

  const cardsSectionHTML = buildCardsSectionHTML(pokemon, pkCards, L, lang, localizedName);
  const setsArtistsHTML  = buildSetsAndArtistsHTML(pkCards, L);
  const statsSentence    = buildStatsSentence(lang, pokemon, pkCards);

  const prevHTML = prev
    ? `<a class="pokemon-nav-prev" href="${pathPokemon(lang, slugify(prev.name.en))}" rel="prev">${escapeHtml(L.prevLabel(prev.id, prev.name[NAME_FIELD[lang]] || prev.name.en))}</a>`
    : `<span class="pokemon-nav-prev pokemon-nav-disabled" aria-hidden="true"></span>`;
  const nextHTML = next
    ? `<a class="pokemon-nav-next" href="${pathPokemon(lang, slugify(next.name.en))}" rel="next">${escapeHtml(L.nextLabel(next.id, next.name[NAME_FIELD[lang]] || next.name.en))}</a>`
    : `<span class="pokemon-nav-next pokemon-nav-disabled" aria-hidden="true"></span>`;

  return `<!DOCTYPE html>
<html lang="${HTML_LANG[lang]}">
<head>
${head}
${navLinks}
</head>
<body data-lang-prefix="${langPathPrefix(lang)}">
<a href="#main-content" class="skip-link">${escapeHtml(L.skipToContent)}</a>

${headerBlock(lang, { slug }, 'pokemon')}

  <main id="main-content" class="pokemon-page">
    <div class="pokemon-hero">
      <img src="/monsters/${pokemon.imageName}.webp"
           alt="${escapeHtml(localizedName)}"
           class="pokemon-sprite"
           width="96" height="96">
      <div class="pokemon-hero-info">
        <span class="pokemon-hero-number">#${pad(pokemon.id)}</span>
        <h1 class="pokemon-detail-name">${escapeHtml(localizedName)}</h1>
      </div>
    </div>

    <section class="pokemon-summary">
      <p class="pokemon-stats-text">${statsSentence}</p>
    </section>
${cardsSectionHTML}
${setsArtistsHTML}
    <nav class="pokemon-pager" aria-label="${escapeHtml(L.pokedex)}">
      ${prevHTML}
      <a class="pokemon-nav-up" href="${pathRoot(lang)}">${escapeHtml(L.upToPokedex)}</a>
      ${nextHTML}
    </nav>
  </main>

${footerBlock(lang)}

${fullscreenBlock(lang)}

${scriptTags()}
  <script src="/pokemon.js?v=${JS_V}"></script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// News block (home page) — hand-curated latest real-world exclusive releases.
// -----------------------------------------------------------------------------

function renderNewsItem(item, L, eager = false) {
  // Local card images get the thumbnail srcset (shown at 56px CSS); external
  // `image` URLs are used as-is.
  const srcAttrs = item.image ? `src="${escapeHtml(item.image)}"`
    : item.imageName ? cardSrcAttrs(item.imageName, '56px')
    : '';
  const flags = Array.isArray(item.languages) ? item.languages.join(' ') : '';
  const metaBits = [flags, item.year, item.set].filter(Boolean)
    .map(b => escapeHtml(String(b))).join(' · ');
  // First news card is likely the LCP element — load it eagerly.
  const loadAttrs = eager ? ' fetchpriority="high"' : ' loading="lazy"';
  const inner = `
        ${srcAttrs ? `<img ${srcAttrs} alt="${escapeHtml(item.title || '')}"${loadAttrs} decoding="async">` : ''}
        <div class="news-card-info">
          <div class="news-card-name">${escapeHtml(item.title || '')}</div>
          ${metaBits ? `<div class="news-card-meta">${metaBits}</div>` : ''}
          ${item.note ? `<div class="news-card-note">${escapeHtml(item.note)}</div>` : ''}
        </div>`;

  if (item.link) {
    const external = /^https?:\/\//.test(item.link);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `      <a class="news-card" href="${escapeHtml(item.link)}"${attrs}>${inner}
      </a>`;
  }
  return `      <div class="news-card">${inner}
      </div>`;
}

function buildNewsHTML(lang) {
  if (!news.length) return '';
  const L = LANG[lang];
  return `
    <section class="news-section" aria-label="${escapeHtml(L.newsHeading)}">
      <h2 class="news-heading">${escapeHtml(L.newsHeading)}</h2>
      <div class="news-grid">
${news.map((item, i) => renderNewsItem(item, L, i === 0)).join('\n')}
      </div>
    </section>`;
}

// -----------------------------------------------------------------------------
// Index page (per language)
// -----------------------------------------------------------------------------

function indexPageHTML(lang, pokemonsWithCards) {
  const L = LANG[lang];
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForRoot(l)]));
  const canonical  = urlsByLang[lang];

  const creatorSchema = {
    "@type": "Person",
    "@id": `${BASE_URL}/#creator`,
    "name": "Begooderrr",
    "url": REDDIT_BEGOODERRR_URL,
    "sameAs": [REDDIT_BEGOODERRR_URL],
  };
  const websiteSchema = {
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    "url": `${BASE_URL}/`,
    "name": "PokéTruc",
    "description": L.indexDescription,
    "inLanguage": LANGS.map(l => HTML_LANG[l]),
    "author":  { "@id": `${BASE_URL}/#creator` },
    "creator": { "@id": `${BASE_URL}/#creator` },
  };
  const collectionPage = {
    "@type": "CollectionPage",
    "@id": `${canonical}#collection`,
    "url": canonical,
    "name": L.indexTitle.replace(' | PokéTruc', ''),
    "description": L.indexDescription,
    "inLanguage": HTML_LANG[lang],
    "isPartOf": { "@id": `${BASE_URL}/#website` },
    "about": {
      "@type": "Thing",
      "name": "Pokémon Trading Card Game",
      "description": L.indexDescription,
    },
  };
  const breadcrumbList = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": L.pokedex, "item": urlForRoot(lang) },
    ],
  };
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": [creatorSchema, websiteSchema, collectionPage, breadcrumbList] });

  const head = headBlock({
    lang,
    title: L.indexTitle,
    description: L.indexDescription,
    canonical,
    urlsByLang,
    jsonLd,
    twitterCard: 'summary_large_image',
  });

  const homeStatsSentence = buildHomeStatsSentence(lang);
  const newsHTML = buildNewsHTML(lang);

  // Static SEO grid: one <a> per Pokémon with a detail page. Names localised.
  const seoLinks = pokemonsWithCards.map(p => {
    const slug = slugify(p.name.en);
    const cardCount = cardsFor(p.id).length;
    const displayName = p.name[NAME_FIELD[lang]] || p.name.en;
    return `      <a href="${pathPokemon(lang, slug)}" class="seo-pokedex-link" data-pokemon-id="${p.id}"><span class="seo-pokedex-num">#${pad(p.id)}</span><span class="seo-pokedex-name">${escapeHtml(displayName)}</span><span class="seo-pokedex-count">${cardCount}</span></a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="${HTML_LANG[lang]}">
<head>
${head}
  <noscript><style>
    #search, .search-row, #lang-filter, #view-toggle, #gen-nav, #loader, #pokemon-grid { display: none !important; }
    .noscript-fallback { display: block !important; }
  </style></noscript>
</head>
<body data-lang-prefix="${langPathPrefix(lang)}">
<a href="#main-content" class="skip-link">${escapeHtml(L.skipToContent)}</a>

${headerBlock(lang, '', 'index')}

  <main id="main-content">
    <h1 class="page-title visually-hidden">${escapeHtml(L.indexH1)}</h1>

    <section class="home-summary">
      <p class="home-stats-text">${homeStatsSentence}</p>
    </section>
${newsHTML}

    <div class="search-row">
      <input type="search" id="search" placeholder="${escapeHtml(L.searchPlaceholder)}" aria-label="${escapeHtml(L.searchPlaceholder)}" autocomplete="off">
    </div>

    <div id="lang-filter" class="lang-filter" role="group" aria-label="${escapeHtml(L.langFilterAria)}"></div>

    <div id="view-toggle" class="view-toggle" role="group" aria-label="${escapeHtml(L.viewToggleAria)}"></div>

    <div id="gen-nav" class="gen-nav" role="group" aria-label="${escapeHtml(L.genNavAria)}"></div>

    <div id="loader" class="loader">
      <div class="loader-spinner"></div>
    </div>
    <p id="grid-status" class="visually-hidden" role="status"></p>
    <div id="pokemon-grid"></div>

    <p class="noscript-fallback">${escapeHtml(L.noscript)}</p>
  </main>

  <section class="seo-about">
    <p>${escapeHtml(L.seoAbout)}</p>
  </section>

  <nav class="seo-pokedex" aria-label="${escapeHtml(L.seoPokedexHeading)}">
    <h2 class="seo-pokedex-title">${escapeHtml(L.seoPokedexHeading)}</h2>
    <div class="seo-pokedex-grid">
${seoLinks}
    </div>
  </nav>

${footerBlock(lang)}

${fullscreenBlock(lang)}

${scriptTags()}
  <script src="/app.js?v=${JS_V}"></script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Info page (per language)
// -----------------------------------------------------------------------------

// FAQ shown on the Info page and emitted as FAQPage JSON-LD. Question-shaped
// headings + short factual answers: the format Google FAQ rich results and AI
// engine citations both consume. Counts are computed from the live catalogue.
const FAQ_HEADING = { en: 'FAQ', fr: 'Questions fréquentes', ja: 'よくある質問', ko: '자주 묻는 질문', zh: '常见问题' };
function faqItems(lang) {
  const n = cards.length;
  const m = new Set(cards.map(c => c.pokemonId)).size;
  const years = cards.map(c => c.year);
  const minY = Math.min(...years), maxY = Math.max(...years);
  const FAQ = {
    en: [
      ['What is a language-exclusive Pokémon card?',
       'A Pokémon TCG card whose illustration was only ever printed in a single language. For example, a promo distributed only in Japanese magazines, or a card from a Chinese-market set that was never released in any other language.'],
      ['Why do some Pokémon cards only exist in Japanese?',
       'Japan gets many promotional cards tied to local magazines, vending machines, stores and events. Many of these promos were never reprinted for other markets, so their artwork exists only on the Japanese card.'],
      ['What do Western-exclusive and Asian-exclusive mean?',
       'A Western-exclusive card was released in Western languages (English, German, French, Italian, Spanish…) but never in Japan or Asia — for example the Call of Legends set. An Asian-exclusive card is the reverse: released in one or more Asian languages but never in the West.'],
      [`How many exclusive cards does PokéTruc catalogue?`,
       `PokéTruc currently catalogues ${n} language- and region-exclusive card illustrations across ${m} Pokémon, published from ${minY} to ${maxY}. The catalogue is updated as new exclusive cards are released or discovered.`],
      ['Is PokéTruc an official Pokémon website?',
       'No. PokéTruc is an unofficial, fan-made, free and ad-free catalogue. Pokémon and Pokémon character names are trademarks of Nintendo, Creatures Inc. and GAME FREAK inc.'],
      ['Can I help correct a mistake or add missing cards or Pokémon?',
       'Yes, contributions are very welcome. If you spot an error, know of an exclusive card that is missing, or want a Pokémon added to the catalogue, get in touch on Reddit (u/Begooderrr), by email (poketruc@icloud.com) or by opening an issue on the GitHub project — see the Contact and Source code sections below.'],
    ],
    fr: [
      ['Qu\'est-ce qu\'une carte Pokémon exclusive à une langue ?',
       'Une carte du JCC Pokémon dont l\'illustration n\'a été imprimée que dans une seule langue. Par exemple une promo distribuée uniquement dans des magazines japonais, ou une carte d\'un set du marché chinois jamais sortie ailleurs.'],
      ['Pourquoi certaines cartes Pokémon n\'existent-elles qu\'en japonais ?',
       'Le Japon reçoit de nombreuses cartes promotionnelles liées à des magazines, distributeurs automatiques, boutiques et événements locaux. Beaucoup de ces promos n\'ont jamais été rééditées pour d\'autres marchés : leur illustration n\'existe que sur la carte japonaise.'],
      ['Que signifient « exclusivité occidentale » et « exclusivité asiatique » ?',
       'Une carte en exclusivité occidentale est sortie dans des langues occidentales (anglais, allemand, français, italien, espagnol…) mais jamais au Japon ni en Asie — par exemple le set L\'appel des légendes. Une exclusivité asiatique, c\'est l\'inverse : sortie dans une ou plusieurs langues asiatiques mais jamais en occident.'],
      ['Combien de cartes exclusives PokéTruc recense-t-il ?',
       `PokéTruc recense actuellement ${n} illustrations de cartes exclusives à une langue ou une région, réparties sur ${m} Pokémon, publiées de ${minY} à ${maxY}. Le catalogue est mis à jour au fil des sorties et découvertes.`],
      ['PokéTruc est-il un site officiel Pokémon ?',
       'Non. PokéTruc est un catalogue non officiel, fait par un fan, gratuit et sans publicité. Pokémon et les noms des personnages Pokémon sont des marques de Nintendo, Creatures Inc. et GAME FREAK inc.'],
      ['Puis-je aider à corriger une erreur ou ajouter des cartes ou des Pokémon manquants ?',
       'Oui, toute aide est la bienvenue. Si vous repérez une erreur, connaissez une carte exclusive absente du catalogue ou souhaitez qu\'un Pokémon soit ajouté, contactez-moi sur Reddit (u/Begooderrr), par e-mail (poketruc@icloud.com) ou en ouvrant une issue sur le projet GitHub — voir les sections Contact et Code source ci-dessous.'],
    ],
    ja: [
      ['言語限定のポケモンカードとは何ですか？',
       'イラストが一つの言語でしか印刷されなかったポケモンTCGのカードです。例えば日本の雑誌付録として配布されたプロモや、中国市場限定セットのカードなどです。'],
      ['なぜ日本語でしか存在しないカードがあるのですか？',
       '日本では雑誌、自動販売機、店舗やイベントに関連した多くのプロモカードが配布されます。その多くは他の市場で再版されなかったため、そのイラストは日本語のカードにしか存在しません。'],
      ['「欧米限定」「アジア限定」とはどういう意味ですか？',
       '欧米限定カードは欧米の言語（英語・ドイツ語・フランス語・イタリア語・スペイン語など）で発売され、日本やアジアでは未発売のカードです（例：Call of Legends）。アジア限定はその逆で、アジアの言語でのみ発売されたカードです。'],
      ['PokéTrucには何枚の限定カードが収録されていますか？',
       `現在、${m}匹のポケモンにわたる${n}枚の言語・地域限定カードイラスト（${minY}年〜${maxY}年発行）を収録しています。新しい限定カードの発売や発見に応じて更新されます。`],
      ['PokéTrucは公式サイトですか？',
       'いいえ。PokéTrucは非公式のファンメイドサイトで、無料・広告なしで運営されています。ポケモンおよびポケモンのキャラクター名は任天堂・クリーチャーズ・ゲームフリークの商標です。'],
      ['誤りの修正や、カード・ポケモンの追加を手伝うことはできますか？',
       'はい、ご協力は大歓迎です。誤りを見つけた場合や、収録されていない限定カードをご存じの場合、追加してほしいポケモンがある場合は、Reddit（u/Begooderrr）、メール（poketruc@icloud.com）、またはGitHubプロジェクトのissueでご連絡ください。詳しくは下記のお問い合わせ・ソースコードのセクションをご覧ください。'],
    ],
    ko: [
      ['언어 한정 포켓몬 카드란 무엇인가요?',
       '일러스트가 단 하나의 언어로만 인쇄된 포켓몬 TCG 카드입니다. 예를 들어 일본 잡지 부록으로만 배포된 프로모 카드나, 다른 언어로는 출시되지 않은 중국 시장 한정 세트의 카드가 있습니다.'],
      ['왜 일본어로만 존재하는 카드가 있나요?',
       '일본에서는 잡지, 자판기, 매장, 이벤트와 연계된 프로모 카드가 많이 배포됩니다. 이 중 상당수는 다른 시장에서 재판되지 않아 그 일러스트는 일본어 카드에만 존재합니다.'],
      ['서양 한정과 아시아 한정은 무슨 뜻인가요?',
       '서양 한정 카드는 서양 언어(영어·독일어·프랑스어·이탈리아어·스페인어 등)로 출시되었지만 일본이나 아시아에서는 출시되지 않은 카드입니다(예: Call of Legends). 아시아 한정은 그 반대로, 아시아 언어로만 출시된 카드입니다.'],
      ['PokéTruc에는 몇 장의 한정 카드가 수록되어 있나요?',
       `현재 ${m}마리 포켓몬에 걸쳐 ${n}장의 언어·지역 한정 카드 일러스트(${minY}년~${maxY}년 발행)를 수록하고 있습니다. 새로운 한정 카드의 출시와 발견에 따라 업데이트됩니다.`],
      ['PokéTruc은 공식 사이트인가요?',
       '아니요. PokéTruc은 비공식 팬 사이트로, 무료이며 광고가 없습니다. 포켓몬 및 포켓몬 캐릭터 이름은 Nintendo, Creatures Inc., GAME FREAK inc.의 상표입니다.'],
      ['오류 수정이나 카드·포켓몬 추가를 도울 수 있나요?',
       '네, 어떤 도움이든 환영합니다. 오류를 발견했거나, 수록되지 않은 한정 카드를 알고 있거나, 추가되었으면 하는 포켓몬이 있다면 Reddit(u/Begooderrr), 이메일(poketruc@icloud.com) 또는 GitHub 프로젝트의 issue로 연락해 주세요. 자세한 내용은 아래의 연락처 및 소스 코드 섹션을 참고하세요.'],
    ],
    zh: [
      ['什么是语言独占的宝可梦卡牌？',
       '指插画仅以单一语言印刷过的宝可梦TCG卡牌。例如仅随日本杂志发放的促销卡，或从未以其他语言发行的中国市场独占卡组中的卡牌。'],
      ['为什么有些卡牌只有日文版？',
       '日本有大量与杂志、自动贩卖机、店铺和活动相关的促销卡牌。其中许多从未在其他市场再版，因此这些插画只存在于日文卡牌上。'],
      ['「西方独占」和「亚洲独占」是什么意思？',
       '西方独占卡牌以西方语言（英语、德语、法语、意大利语、西班牙语等）发行，但从未在日本或亚洲发行，例如 Call of Legends 卡组。亚洲独占则相反：仅以一种或多种亚洲语言发行。'],
      ['PokéTruc 收录了多少张独占卡牌？',
       `目前收录了 ${m} 只宝可梦的 ${n} 张语言·地区独占卡牌插画（${minY}–${maxY} 年发行）。目录会随着新独占卡牌的发行和发现而更新。`],
      ['PokéTruc 是官方网站吗？',
       '不是。PokéTruc 是非官方的粉丝网站，免费且无广告。宝可梦及宝可梦角色名称是任天堂、Creatures Inc. 和 GAME FREAK inc. 的商标。'],
      ['我可以帮忙纠正错误或添加缺失的卡牌、宝可梦吗？',
       '当然可以，非常欢迎任何帮助。如果您发现错误、知道目录中缺失的独占卡牌，或希望添加某只宝可梦，请通过 Reddit（u/Begooderrr）、电子邮件（poketruc@icloud.com）或在 GitHub 项目上提交 issue 与我联系——详见下方的联系方式和源代码部分。'],
    ],
  };
  return FAQ[lang];
}

function infoPageHTML(lang) {
  const L = LANG[lang];
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForInfo(l)]));
  const canonical  = urlsByLang[lang];

  const breadcrumbList = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": L.pokedex, "item": urlForRoot(lang) },
      { "@type": "ListItem", "position": 2, "name": L.info,    "item": canonical },
    ],
  };
  const faq = faqItems(lang);
  const faqPage = {
    "@type": "FAQPage",
    "inLanguage": HTML_LANG[lang],
    "mainEntity": faq.map(([q, a]) => ({
      "@type": "Question",
      "name": q,
      "acceptedAnswer": { "@type": "Answer", "text": a },
    })),
  };
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": [breadcrumbList, faqPage] });

  const head = headBlock({
    lang,
    title: L.infoTitle,
    description: L.infoDescription,
    canonical,
    urlsByLang,
    jsonLd,
    twitterCard: 'summary',
  });

  const aboutHTML = L.aboutBody.map(p => `<p>${escapeHtml(p)}</p>`).join('\n        ');
  const disclaimerHTML = L.disclaimerBody.map(p => `<p>${escapeHtml(p)}</p>`).join('\n        ');
  // Visible ↗ icon + screen-reader-only label appended inside every outbound
  // link, so both sighted and assistive-tech users know it opens a new tab.
  const extSuffix = `<span class="ext-icon" aria-hidden="true">↗</span><span class="visually-hidden"> (${escapeHtml(L.opensInNewTab)})</span>`;
  const creditsHTML =
    `<p>${escapeHtml(L.creditsBefore)}` +
    `<a href="${REDDIT_TWENTYFOUR7_URL}" class="info-link" target="_blank" rel="noopener noreferrer">${escapeHtml(L.creditsLinkText)}${extSuffix}</a>` +
    `${escapeHtml(L.creditsBetween)}` +
    `<a href="${REDDIT_QUUADOR_URL}" class="info-link" target="_blank" rel="noopener noreferrer">${escapeHtml(L.creditsLinkText2)}${extSuffix}</a>` +
    `${escapeHtml(L.creditsAfter)}</p>`;
  // Author backlinks intentionally use rel="noopener" (no "noreferrer") so the
  // Referer header is preserved — keeps GitHub/Reddit referral analytics honest
  // and avoids weakening the SEO signal on outbound links to the author profile.
  const sourceCodeHTML =
    `<p>${escapeHtml(L.sourceCodeBefore)}` +
    `<a href="${GITHUB_REPO_URL}" class="info-link" target="_blank" rel="noopener">github.com/amaurybegood/PokeTruc-Web${extSuffix}</a></p>`;

  return `<!DOCTYPE html>
<html lang="${HTML_LANG[lang]}">
<head>
${head}
</head>
<body data-lang-prefix="${langPathPrefix(lang)}">
<a href="#main-content" class="skip-link">${escapeHtml(L.skipToContent)}</a>

${headerBlock(lang, '', 'info')}

  <main id="main-content" class="info-page">
    <h1 class="page-title">${escapeHtml(L.infoH1)}</h1>

    <div class="info-card">
      <h2>${escapeHtml(L.aboutHeading)}</h2>
      <div>
        ${aboutHTML}
      </div>
    </div>

    <div class="info-card">
      <h2>${escapeHtml(FAQ_HEADING[lang])}</h2>
      <div>
        ${faq.map(([q, a]) => `<h3 class="faq-q">${escapeHtml(q)}</h3>
        <p>${escapeHtml(a)}</p>`).join('\n        ')}
      </div>
    </div>

    <div class="info-card">
      <h2>${escapeHtml(L.creditsHeading)}</h2>
      <div>
        ${creditsHTML}
      </div>
    </div>

    <div class="info-card">
      <h2>${escapeHtml(L.sourceCodeHeading)}</h2>
      <div>
        ${sourceCodeHTML}
      </div>
    </div>

    <div class="info-card">
      <h2>${escapeHtml(L.contactHeading)}</h2>
      <a href="mailto:poketruc@icloud.com?subject=Support%20%E2%80%93%20PokéTruc%20Web" class="info-link">${escapeHtml(L.emailLabel)} poketruc@icloud.com</a>
      <a href="${REDDIT_BEGOODERRR_URL}" class="info-link" target="_blank" rel="noopener">${escapeHtml(L.redditLabel)} u/Begooderrr${extSuffix}</a>
    </div>

    <div class="info-card disclaimer">
      <div>
        ${disclaimerHTML}
      </div>
    </div>
  </main>

${footerBlock(lang)}

${scriptTags()}
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Trainers page (flat gallery, per language)
// -----------------------------------------------------------------------------

function trainersPageHTML(lang) {
  const L = LANG[lang];
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForTrainers(l)]));
  const canonical  = urlsByLang[lang];

  const breadcrumbList = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": L.pokedex,  "item": urlForRoot(lang) },
      { "@type": "ListItem", "position": 2, "name": L.trainers, "item": canonical },
    ],
  };
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": [breadcrumbList] });

  const firstCard = firstDisplayedCard(trainerCards);
  const head = headBlock({
    lang,
    title: L.trainersTitle,
    description: L.trainersDescription,
    canonical,
    urlsByLang,
    jsonLd,
    twitterCard: 'summary',
    preloadImage: firstCard ? cardPreloadHref(firstCard.imageName) : undefined,
  });

  const sectionsHTML = trainerCards.length
    ? buildTrainersSectionHTML(trainerCards, L, lang)
    : `
    <section class="cards-section">
      <p class="cards-section-title">${escapeHtml(L.trainersEmpty)}</p>
    </section>`;

  return `<!DOCTYPE html>
<html lang="${HTML_LANG[lang]}">
<head>
${head}
</head>
<body data-lang-prefix="${langPathPrefix(lang)}">
<a href="#main-content" class="skip-link">${escapeHtml(L.skipToContent)}</a>

${headerBlock(lang, '', 'trainers')}

  <main id="main-content" class="pokemon-page">
    <h1 class="page-title">${escapeHtml(L.trainersH1)}</h1>
${sectionsHTML}
    <nav class="pokemon-pager" aria-label="${escapeHtml(L.pokedex)}">
      <a class="pokemon-nav-up" href="${pathRoot(lang)}">${escapeHtml(L.upToPokedex)}</a>
    </nav>
  </main>

${footerBlock(lang)}

${fullscreenBlock(lang)}

${scriptTags()}
  <script src="/pokemon.js?v=${JS_V}"></script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Generation driver
// -----------------------------------------------------------------------------

const pokemonsWithCards = pokemons
  .filter(p => cardsFor(p.id).length > 0)
  .sort((a, b) => a.id - b.id);

function langDir(lang) { return lang === 'en' ? '' : lang + '/'; }

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

let pageCount = 0;

// 1) Detail pages: 5 languages × N pokémon
for (const lang of LANGS) {
  pokemonsWithCards.forEach((pokemon, index) => {
    const pkCards = cardsFor(pokemon.id);
    const slug = slugify(pokemon.name.en);
    const dir = `${langDir(lang)}pokemon/${slug}`;
    ensureDir(dir);
    const prev = pokemonsWithCards[index - 1] || null;
    const next = pokemonsWithCards[index + 1] || null;
    const html = detailPageHTML(lang, pokemon, pkCards, prev, next);
    recordWrite(`${dir}/index.html`, html, pathPokemon(lang, slug));
    pageCount++;
  });
}

// 2) Index page per language
for (const lang of LANGS) {
  const dir = langDir(lang).replace(/\/$/, '') || '.';
  ensureDir(dir);
  const out = lang === 'en' ? 'index.html' : `${lang}/index.html`;
  recordWrite(out, indexPageHTML(lang, pokemonsWithCards), pathRoot(lang));
  pageCount++;
}

// 3) Info page per language at /info/index.html, plus a meta-refresh redirect
//    stub at the legacy /info.html path to preserve already-indexed inbound links.
for (const lang of LANGS) {
  const infoDir = lang === 'en' ? 'info' : `${lang}/info`;
  ensureDir(infoDir);
  recordWrite(`${infoDir}/index.html`, infoPageHTML(lang), pathInfo(lang));
  pageCount++;

  // Redirect stub at the old /info.html — points to the new /info/ canonical.
  // Not tracked in build state since it's static and never indexed.
  const dest = urlForInfo(lang);
  const redirectHTML = `<!DOCTYPE html>
<html lang="${HTML_LANG[lang]}">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(LANG[lang].infoTitle)}</title>
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="${dest}">
<meta http-equiv="refresh" content="0; url=${dest}">
</head>
<body>
<p>Redirecting to <a href="${dest}">${dest}</a>.</p>
<script>location.replace(${JSON.stringify(dest)});</script>
</body>
</html>`;
  fs.writeFileSync(legacyInfoFile(lang), redirectHTML, 'utf8');
}

// 3b) Trainers page per language at /trainers/index.html
for (const lang of LANGS) {
  const trainersDir = lang === 'en' ? 'trainers' : `${lang}/trainers`;
  ensureDir(trainersDir);
  recordWrite(`${trainersDir}/index.html`, trainersPageHTML(lang), pathTrainers(lang));
  pageCount++;
}

// 4) Sitemap with hreflang annotations. <lastmod> per URL comes from the
//    per-page hash tracker so it only changes when the rendered HTML changes.
const sitemapUrls = [];
function sitemapEntry(urlsByLang, lang, urlKey, { priority, changefreq, images = [] }) {
  const alt = LANGS.map(l =>
    `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${urlsByLang[l]}"/>`
  ).join('\n');
  const lastmod = newState[urlKey]?.lastmod || TODAY;
  // Google's image sitemap extension only reads <image:loc>; the other
  // sub-tags (caption, title…) were deprecated in 2022 and are ignored.
  // Emitted only on the en (x-default) entry — same images on all 5 language
  // URLs would just repeat the same discovery signal and 3× the file size.
  const imgs = (lang === 'en' ? images : []).map(u =>
    `    <image:image><image:loc>${u}</image:loc></image:image>`
  ).join('\n');
  return `  <url>
    <loc>${urlsByLang[lang]}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alt}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlsByLang.en}"/>${imgs ? '\n' + imgs : ''}
  </url>`;
}

// Index pages
{
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForRoot(l)]));
  for (const lang of LANGS) sitemapUrls.push(sitemapEntry(urlsByLang, lang, pathRoot(lang), { priority: '1.0', changefreq: 'weekly' }));
}
// Info pages
{
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForInfo(l)]));
  for (const lang of LANGS) sitemapUrls.push(sitemapEntry(urlsByLang, lang, pathInfo(lang), { priority: '0.7', changefreq: 'monthly' }));
}
// Trainers page
{
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForTrainers(l)]));
  const images = trainerCards.map(c => `${BASE_URL}/cards/${c.imageName}.avif`);
  for (const lang of LANGS) sitemapUrls.push(sitemapEntry(urlsByLang, lang, pathTrainers(lang), { priority: '0.7', changefreq: 'monthly', images }));
}
// Pokémon pages
for (const p of pokemonsWithCards) {
  const slug = slugify(p.name.en);
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForPokemon(l, slug)]));
  const images = cardsFor(p.id).map(c => `${BASE_URL}/cards/${c.imageName}.avif`);
  for (const lang of LANGS) sitemapUrls.push(sitemapEntry(urlsByLang, lang, pathPokemon(lang, slug), { priority: '0.8', changefreq: 'monthly', images }));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapUrls.join('\n')}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');

// 5) llms.txt — a concise, LLM-friendly map of the site (https://llmstxt.org/).
//    Regenerated each build so the stats and Pokémon list stay in sync.
{
  const byLangRaw = cards.reduce((a, c) => { const k = exclusivityKey(c); a[k] = (a[k] || 0) + 1; return a; }, {});
  const langBreakdown = LANG_INFO
    .filter(l => byLangRaw[l.flag])
    .sort((a, b) => byLangRaw[b.flag] - byLangRaw[a.flag])
    .map(l => `${byLangRaw[l.flag]} ${STATS_LANG_LABEL.en[l.flag]}-exclusive`)
    .join(', ');
  const years = cards.map(c => c.year);
  const minY = Math.min(...years), maxY = Math.max(...years);

  // Generations actually present in the catalogue (no longer hard-coded to Gen 1).
  const gens = [...new Set(pokemonsWithCards.map(p => p.generation).filter(Boolean))].sort((a, b) => a - b);
  const genLabel = gens.length === 0 ? 'multiple generations'
    : gens.length === 1 ? `Generation ${gens[0]}`
    : `Generations ${gens.join(', ')}`;

  const pokemonLines = pokemonsWithCards.map(p => {
    const n = cardsFor(p.id).length;
    const slug = slugify(p.name.en);
    return `- [${p.name.en}](${urlForPokemon('en', slug)}): ${n} exclusive card${n > 1 ? 's' : ''}`;
  }).join('\n');

  const trainersLine = trainerCards.length
    ? `\n- [Trainers](${urlForTrainers('en')}): flat gallery of ${trainerCards.length} language- and region-exclusive Trainer card illustrations, grouped by exclusivity category.`
    : `\n- [Trainers](${urlForTrainers('en')}): gallery of language- and region-exclusive Trainer card illustrations, grouped by exclusivity category.`;

  const llms = `# PokéTruc

> PokéTruc is a free, fan-made, ad-free catalogue of region- and language-exclusive Pokémon Trading Card Game (TCG) illustrations — cards whose artwork was only ever printed in a single language, or in a single region (Western-only or Asian-only). It lists ${cards.length} such cards across ${pokemonsWithCards.length} Pokémon (${genLabel}), published from ${minY} to ${maxY}.

The site has 5 interface languages (English, French, Japanese, Korean, Chinese). Each Pokémon has its own page listing its exclusive cards grouped by exclusivity category, with year, artist, and a source link (e.g. Bulbapedia, PokeBeach) where available. Exclusivity breakdown: ${langBreakdown}. Created by Begooderrr (${REDDIT_BEGOODERRR_URL}); source code at ${GITHUB_REPO_URL}.

## Main pages

- [Pokédex (home)](${urlForRoot('en')}): searchable grid of all catalogued Pokémon, filterable by exclusivity category.${trainersLine}
- [Info / About](${urlForInfo('en')}): what the project is, plus credits and sources.

## Pokémon (${genLabel})

${pokemonLines}

## Optional

- [XML sitemap](${BASE_URL}/sitemap.xml): every URL, in all 5 languages, with hreflang annotations.
`;

  fs.writeFileSync('llms.txt', llms, 'utf8');
}

// Clean up orphan /pokemon/<slug>/ directories from prior builds whose Pokémon
// were removed from data (e.g. all cards de-listed). Without this they linger
// on disk serving stale content that isn't in the sitemap.
const validSlugs = new Set(pokemonsWithCards.map(p => slugify(p.name.en)));
let orphanCount = 0;
for (const lang of LANGS) {
  const baseDir = (lang === 'en' ? '' : lang + '/') + 'pokemon';
  if (!fs.existsSync(baseDir)) continue;
  for (const d of fs.readdirSync(baseDir)) {
    if (!validSlugs.has(d)) {
      fs.rmSync(`${baseDir}/${d}`, { recursive: true, force: true });
      orphanCount++;
    }
  }
}

// Persist content hashes for the next build.
fs.writeFileSync(STATE_PATH, JSON.stringify(newState, null, 2), 'utf8');

console.log(`✓ ${pokemonsWithCards.length} Pokémon × ${LANGS.length} langues = ${pokemonsWithCards.length * LANGS.length} pages détail générées`);
console.log(`✓ ${LANGS.length} index + ${LANGS.length} info pages générés + ${LANGS.length} redirect stubs`);
console.log(`✓ sitemap.xml mis à jour (${sitemapUrls.length} URLs, hreflang inclus)`);
console.log(`✓ llms.txt généré (${pokemonsWithCards.length} Pokémon listés)`);
console.log(`✓ Contenu modifié : ${changedCount} pages · inchangé : ${unchangedCount} pages`);
console.log(`✓ Total : ${pageCount} fichiers HTML générés`);
if (orphanCount > 0) console.log(`✓ ${orphanCount} dossier(s) orphelin(s) supprimé(s)`);
