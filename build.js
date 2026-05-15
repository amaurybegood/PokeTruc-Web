// Static site generator for PokéTruc.
//
// Produces 5 fully-localised URL trees (en at root, fr/ja/ko/zh under /<lang>/)
// with cross-linked hreflang annotations, a per-Pokémon detail page in each
// language, and a sitemap.xml that declares every alternate.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pokemons = JSON.parse(fs.readFileSync('data/pokemons.json', 'utf8'));
const cards    = JSON.parse(fs.readFileSync('data/pokemon_cards.json', 'utf8'));

const BASE_URL = 'https://poketruc.com';
const TODAY    = new Date().toISOString().split('T')[0];

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

const CSS_V = 15;
const JS_V  = 12;

const LANGS = ['en', 'fr', 'ja', 'ko', 'zh'];

// HTML lang attribute (zh uses zh-Hans for simplified Chinese).
const HTML_LANG = { en: 'en', fr: 'fr', ja: 'ja', ko: 'ko', zh: 'zh-Hans' };

// hreflang values declared in <link rel="alternate"> tags. Same mapping.
const HREFLANG = HTML_LANG;

// Pokémon name field per UI lang (mirrors data/pokemons.json key naming).
const NAME_FIELD = { en: 'en', fr: 'fr', ja: 'jp', ko: 'ko', zh: 'zh' };

// Card-language flags, in the order they should appear on the page.
const LANG_INFO = [
  { flag: '🇯🇵', key: 'langJapaneseHeading' },
  { flag: '🇬🇧', key: 'langEnglishHeading'  },
  { flag: '🇨🇳', key: 'langChineseHeading'  },
  { flag: '🇰🇷', key: 'langKoreanHeading'   },
];

const STATS_LANG_LABEL = {
  en: { '🇯🇵': 'Japanese',   '🇬🇧': 'English',   '🇨🇳': 'Chinese',   '🇰🇷': 'Korean'    },
  fr: { '🇯🇵': 'japonaises', '🇬🇧': 'anglaises', '🇨🇳': 'chinoises', '🇰🇷': 'coréennes' },
  ja: { '🇯🇵': '日本限定',    '🇬🇧': '英語限定',  '🇨🇳': '中国語限定', '🇰🇷': '韓国語限定' },
  ko: { '🇯🇵': '일본어 한정', '🇬🇧': '영어 한정', '🇨🇳': '중국어 한정', '🇰🇷': '한국어 한정' },
  zh: { '🇯🇵': '日文独占',    '🇬🇧': '英文独占',  '🇨🇳': '中文独占',  '🇰🇷': '韩文独占'   },
};

// ISO language code for each flag emoji used on a card. Used by JSON-LD
// inLanguage on the per-card VisualArtwork entries.
const FLAG_TO_ISO = {
  '🇯🇵': 'ja',
  '🇬🇧': 'en',
  '🇨🇳': 'zh-Hans',
  '🇰🇷': 'ko',
};

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
    tagline: 'Pokémon TCG illustrations / artworks that exist in only one language',
    pokedex: 'Pokédex',
    info: 'Info',
    searchPlaceholder: 'Search a Pokémon...',
    indexTitle: 'PokéTruc — Unique Pokémon TCG Card Illustrations',
    indexDescription: 'Discover Pokémon TCG cards with unique and exclusive artwork illustrations only available in one language (Japanese, English, Chinese or Korean). Free, ad-free, fan-made.',
    indexH1: 'Pokémon TCG illustrations / artworks that exist in only one language',
    seoAbout: "Some Pokémon TCG cards feature artwork that was only ever printed in a single language. A Japanese promo from a 1996 stamp magazine never released in English. A McDonald's Pokémon-e card distributed only in Japan in 2002. A Chinese-market exclusive from a recent set. PokéTruc catalogs these language-exclusive cards across all 151 Generation 1 Pokémon — Bulbasaur, Charizard, Pikachu and every classic — pulling artwork from Japanese Vending Machine expansion sheets, Black & White promos, DPt-P promos, McDonald's promos, and Chinese-exclusive releases by artists such as Ken Sugimori, Mitsuhiro Arita, Sumiyoshi Kizuki, Yuka Morii and many others. The goal is simple: help collectors discover the rare illustrations they may have never seen, organised by Pokémon, set, language and year — fully free, ad-free, and built by a fan.",
    seoPokedexHeading: 'Browse all Pokémon with exclusive cards',
    infoTitle: 'PokéTruc — About',
    infoDescription: 'About PokéTruc: a fan-made catalog of Pokémon TCG cards with unique artwork exclusive to one language. Free, ad-free.',
    infoH1: 'About PokéTruc',
    aboutHeading: 'About',
    aboutBody: [
      "This site was developed for fun, and also for learning purposes (not being a developer, it's a bit of a challenge for me). That's why it is very simple and basic.",
      "Its purpose is to list all Pokémon TCG cards with unique illustrations. By unique, I mean artwork that is only available in one language (Japanese, English, Chinese, or other). This is the kind of card I like to collect.",
      "It is completely free and ad-free.",
      "Despite the care taken, some information may be inaccurate. Please feel free to contact me by email if you notice an error or would like to provide feedback.",
      "Voilà, voilà :)",
    ],
    contactHeading: 'Contact',
    disclaimerBody: [
      'This site is unofficial and fan-made. Pokémon and Pokémon character names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.',
      'This site does not collect any personal data or require a user account. No information is transmitted or stored outside of your device.',
    ],
    backToPokedex: '← Pokédex',
    upToPokedex:   '↑ Pokédex',
    setsHeading: 'Sets featured',
    artistsHeading: 'Artists',
    artistPrefix: 'Artist',
    langJapaneseHeading: 'Japanese-exclusive cards',
    langEnglishHeading:  'English-exclusive cards',
    langChineseHeading:  'Chinese-exclusive cards',
    langKoreanHeading:   'Korean-exclusive cards',
    cardsSection: (n) => `${n} exclusive TCG card ${n === 1 ? 'illustration' : 'illustrations'}`,
    detailTitle: (name, n) => `${name} — Exclusive TCG Card ${n === 1 ? 'Illustration' : 'Illustrations'} | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${n} language-exclusive Pokémon TCG card ${n === 1 ? 'illustration' : 'illustrations'} for ${name} (#${pad(id)}). Unique artwork only available in one language (Japanese, English, Chinese, or other).`,
    detailOgDescription: (name, n) =>
      `${n} language-exclusive TCG card ${n === 1 ? 'illustration' : 'illustrations'} for ${name}. Unique artwork only available in one language.`,
    schemaDetailDescription: (name, id) =>
      `Language-exclusive Pokémon TCG card illustrations for ${name} (#${pad(id)}). Unique artwork only available in one language.`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: 'JavaScript is required for the live Pokédex grid above. You can still browse every Pokémon below.',
    footerCopyright: '© 2026 - 3590 PokéTruc — Fan-made, not affiliated with Nintendo / The Pokémon Company.',
    langSwitcherLabel: 'Language',
    themeToggleLabel: 'Toggle dark mode',
  },
  fr: {
    siteName: 'PokéTruc',
    tagline: "Illustrations / artworks de cartes Pokémon TCG n'existant que dans une seule langue",
    pokedex: 'Pokédex',
    info: 'Info',
    searchPlaceholder: 'Rechercher un Pokémon...',
    indexTitle: 'PokéTruc — Illustrations exclusives de cartes Pokémon TCG',
    indexDescription: 'Découvrez les cartes Pokémon TCG aux illustrations uniques et exclusives, disponibles dans une seule langue (japonais, anglais, chinois ou coréen). Gratuit, sans publicité, créé par un fan.',
    indexH1: "Illustrations / artworks de cartes Pokémon TCG n'existant que dans une seule langue",
    seoAbout: "Certaines cartes Pokémon TCG n'existent qu'en une seule langue. Une promo japonaise distribuée avec un magazine de timbres en 1996, jamais sortie en anglais. Une carte McDonald's Pokémon-e disponible uniquement au Japon en 2002. Une exclusivité du marché chinois sur un set récent. PokéTruc recense ces cartes en exclusivité linguistique pour les 151 Pokémon de la Génération 1 — Bulbizarre, Dracaufeu, Pikachu et tous les autres — en piochant dans les feuilles Vending Machine japonaises, les promos Black & White, les promos DPt-P, les promos McDonald's et les sorties exclusives au marché chinois, illustrées par des artistes comme Ken Sugimori, Mitsuhiro Arita, Sumiyoshi Kizuki, Yuka Morii et bien d'autres. L'objectif : permettre aux collectionneurs de découvrir des illustrations rares qu'ils n'ont peut-être jamais vues, classées par Pokémon, set, langue et année — entièrement gratuit, sans publicité, créé par un fan.",
    seoPokedexHeading: 'Tous les Pokémon avec des cartes exclusives',
    infoTitle: 'PokéTruc — À propos',
    infoDescription: 'À propos de PokéTruc : un catalogue créé par un fan, recensant les cartes Pokémon TCG aux illustrations exclusives à une seule langue. Gratuit, sans publicité.',
    infoH1: 'À propos de PokéTruc',
    aboutHeading: 'À propos',
    aboutBody: [
      "Ce site est développé pour le fun, et aussi à des fins d'apprentissage (n'étant pas développeur, c'est un petit défi pour moi). C'est pour cela qu'il est très simple et basique.",
      "Son but est de répertorier toutes les cartes Pokémon TCG ayant des illustrations uniques. Par unique, j'entends qui n'est disponible que dans une langue (japonais, anglais, chinois ou autre). C'est le genre de carte que j'aime bien collectionner.",
      "Il est entièrement gratuit et sans publicité.",
      "Malgré le soin apporté, certaines informations peuvent être inexactes. N'hésitez pas à me contacter par e-mail si vous constatez une erreur ou souhaitez faire un retour.",
      "Voilà, voilà :)",
    ],
    contactHeading: 'Contact',
    disclaimerBody: [
      'Ce site est non officiel et créé par un fan. Pokémon et les noms des personnages Pokémon sont des marques déposées de Nintendo / Creatures Inc. / GAME FREAK inc.',
      "Ce site ne collecte aucune donnée personnelle et ne nécessite aucun compte utilisateur. Aucune information n'est transmise ou stockée en dehors de votre appareil.",
    ],
    backToPokedex: '← Pokédex',
    upToPokedex:   '↑ Pokédex',
    setsHeading: 'Sets présentés',
    artistsHeading: 'Artistes',
    artistPrefix: 'Artiste',
    langJapaneseHeading: 'Cartes exclusives japonaises',
    langEnglishHeading:  'Cartes exclusives anglaises',
    langChineseHeading:  'Cartes exclusives chinoises',
    langKoreanHeading:   'Cartes exclusives coréennes',
    cardsSection: (n) => `${n} illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes TCG`,
    detailTitle: (name, n) =>
      `${name} — Illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes TCG | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${n} illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes Pokémon TCG pour ${name} (#${pad(id)}). Artwork unique disponible dans une seule langue (japonais, anglais, chinois ou autre).`,
    detailOgDescription: (name, n) =>
      `${n} illustration${n > 1 ? 's' : ''} exclusive${n > 1 ? 's' : ''} de cartes TCG pour ${name}. Artwork unique disponible dans une seule langue.`,
    schemaDetailDescription: (name, id) =>
      `Illustrations exclusives de cartes Pokémon TCG pour ${name} (#${pad(id)}). Artwork unique disponible dans une seule langue.`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: "JavaScript est nécessaire pour la grille dynamique du Pokédex. Vous pouvez tout de même parcourir tous les Pokémon ci-dessous.",
    footerCopyright: '© 2026 - 3590 PokéTruc — Site fan, non affilié à Nintendo / The Pokémon Company.',
    langSwitcherLabel: 'Langue',
    themeToggleLabel: 'Basculer le mode sombre',
  },
  ja: {
    siteName: 'PokéTruc',
    tagline: '1つの言語にしか存在しないポケモンTCGのイラスト / アートワーク',
    pokedex: '図鑑',
    info: '情報',
    searchPlaceholder: 'ポケモンをさがす',
    indexTitle: 'PokéTruc — 言語限定のポケモンTCGカードイラスト',
    indexDescription: 'PokéTrucでは、日本語・英語・中国語・韓国語など特定の言語でしか発行されていないポケモンTCGカードの限定イラストを掲載しています。完全無料・広告なし・ファン制作。',
    indexH1: '1つの言語にしか存在しないポケモンTCGのイラスト / アートワーク',
    seoAbout: 'ポケモンTCGには、特定の言語でしか印刷されなかった限定イラストのカードが数多く存在します。1996年に切手雑誌の付録として配布された日本限定プロモ、2002年に日本でのみ配布されたマクドナルドのポケモン-e、最新セットの中国市場限定カードなど。PokéTrucでは、フシギダネ、リザードン、ピカチュウをはじめとする第1世代の151匹すべてについて、こうした言語限定カードを収録しています。Vending Machine拡張シート、Black & Whiteプロモ、DPt-Pプロモ、マクドナルドプロモ、中国限定セットなど幅広く対象とし、Ken Sugimori、Mitsuhiro Arita、Sumiyoshi Kizuki、Yuka Moriiといった著名イラストレーターの作品も含まれます。ポケモン別・セット別・言語別・年代別に整理されたPokéTrucで、まだ見たことのない希少なイラストを見つけてください。完全無料・広告なし・ファン制作です。',
    seoPokedexHeading: '限定カードがあるポケモンをすべて見る',
    infoTitle: 'PokéTruc — このサイトについて',
    infoDescription: 'PokéTrucについて：1つの言語にしか存在しないポケモンTCGカードの限定イラストを集めたファン制作のカタログです。無料・広告なし。',
    infoH1: 'PokéTrucについて',
    aboutHeading: 'このアプリについて',
    aboutBody: [
      'このサイトは楽しみのために、また学習目的で開発しました（開発者ではないので、私には少し挑戦です）。そのため、とてもシンプルで基本的な作りになっています。',
      'その目的は、独自のイラストを持つすべてのポケモンTCGカードをリストアップすることです。「独自」とは、1つの言語（日本語、英語、中国語、またはその他）でのみ入手可能なものを意味します。これが私がコレクションしたいカードの種類です。',
      '完全無料、広告なしです。',
      '注意を払っていますが、一部の情報が不正確な場合があります。エラーを見つけた場合やフィードバックをお送りいただける場合は、メールでご連絡ください。',
      'それでは :)',
    ],
    contactHeading: 'お問い合わせ',
    disclaimerBody: [
      'このサイトは非公式のファン制作サイトです。ポケモンおよびポケモンキャラクター名はNintendo / Creatures Inc. / GAME FREAK inc.の商標です。',
      'このサイトは個人情報を収集せず、ユーザーアカウントも不要です。いかなる情報もデバイス外に送信・保存されません。',
    ],
    backToPokedex: '← 図鑑',
    upToPokedex:   '↑ 図鑑',
    setsHeading: '収録セット',
    artistsHeading: 'イラストレーター',
    artistPrefix: 'イラストレーター',
    langJapaneseHeading: '日本限定カード',
    langEnglishHeading:  '英語限定カード',
    langChineseHeading:  '中国語限定カード',
    langKoreanHeading:   '韓国語限定カード',
    cardsSection: (n) => `${n}枚の言語限定TCGカードイラスト`,
    detailTitle: (name, n) => `${name} — 言語限定TCGカードイラスト${n}枚 | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${name}（#${pad(id)}）の言語限定ポケモンTCGカードイラスト${n}枚。1つの言語（日本語、英語、中国語など）でのみ発行された独自イラストを掲載しています。`,
    detailOgDescription: (name, n) =>
      `${name}の言語限定TCGカードイラスト${n}枚。1つの言語でのみ発行された独自イラストを掲載しています。`,
    schemaDetailDescription: (name, id) =>
      `${name}（#${pad(id)}）の言語限定ポケモンTCGカードイラスト。1つの言語でのみ発行された独自イラストです。`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: 'JavaScriptが無効です。動的なポケモン一覧は表示されませんが、下のリストからすべてのポケモンを閲覧できます。',
    footerCopyright: '© 2026 - 3590 PokéTruc — ファン制作、任天堂／株式会社ポケモンとは無関係です。',
    langSwitcherLabel: '言語',
    themeToggleLabel: 'ダークモードを切り替え',
  },
  ko: {
    siteName: 'PokéTruc',
    tagline: '한 가지 언어로만 존재하는 포켓몬 TCG 일러스트 / 아트워크',
    pokedex: '도감',
    info: '정보',
    searchPlaceholder: '포켓몬 검색',
    indexTitle: 'PokéTruc — 언어 한정 포켓몬 TCG 카드 일러스트',
    indexDescription: 'PokéTruc은 일본어, 영어, 중국어, 한국어 등 하나의 언어로만 발매된 포켓몬 TCG 카드의 한정 일러스트를 정리합니다. 무료, 광고 없음, 팬 제작.',
    indexH1: '한 가지 언어로만 존재하는 포켓몬 TCG 일러스트 / 아트워크',
    seoAbout: '포켓몬 TCG에는 단 하나의 언어로만 인쇄된 한정 일러스트 카드가 다수 존재합니다. 1996년 우표 잡지 부록으로 배포된 일본 한정 프로모, 2002년 일본에서만 배포된 맥도날드 포켓몬-e 카드, 최신 세트의 중국 시장 한정 카드 등이 대표적입니다. PokéTruc은 이상해씨, 리자몽, 피카츄를 비롯한 1세대 151마리 전부에 대해 이러한 언어 한정 카드를 정리합니다. 일본 자판기 익스팬션 시트, Black & White 프로모, DPt-P 프로모, 맥도날드 프로모, 중국 한정 세트까지 폭넓게 다루며 Ken Sugimori, Mitsuhiro Arita, Sumiyoshi Kizuki, Yuka Morii 등 유명 일러스트레이터의 작품도 포함됩니다. 포켓몬·세트·언어·연도별로 정리된 PokéTruc에서 한 번도 보지 못한 희귀 일러스트를 찾아보세요. 완전 무료, 광고 없음, 팬 제작.',
    seoPokedexHeading: '한정 카드가 있는 모든 포켓몬 둘러보기',
    infoTitle: 'PokéTruc — 사이트 소개',
    infoDescription: 'PokéTruc 소개: 하나의 언어로만 발매된 포켓몬 TCG 카드의 한정 일러스트를 모은 팬 제작 카탈로그입니다. 무료, 광고 없음.',
    infoH1: 'PokéTruc 소개',
    aboutHeading: '앱 소개',
    aboutBody: [
      "이 사이트는 재미를 위해, 그리고 학습 목적으로 개발되었습니다 (개발자가 아니기 때문에 저에게는 작은 도전입니다). 그래서 매우 단순하고 기본적입니다.",
      "그 목적은 독특한 일러스트를 가진 모든 포켓몬 TCG 카드를 나열하는 것입니다. '독특하다'는 것은 한 가지 언어(일본어, 영어, 중국어 또는 기타)로만 제공된다는 의미입니다. 이것이 제가 수집하고 싶은 카드의 종류입니다.",
      "완전 무료이며 광고가 없습니다.",
      "주의를 기울였지만 일부 정보가 부정확할 수 있습니다. 오류를 발견하거나 피드백을 제공하고 싶으시면 이메일로 연락해 주세요.",
      "Voilà, voilà :)",
    ],
    contactHeading: '문의하기',
    disclaimerBody: [
      '이 사이트는 비공식 팬 제작 사이트입니다. 포켓몬 및 포켓몬 캐릭터 이름은 Nintendo / Creatures Inc. / GAME FREAK inc.의 상표입니다.',
      '이 사이트는 개인 정보를 수집하지 않으며 사용자 계정도 필요하지 않습니다. 어떠한 정보도 기기 외부로 전송되거나 저장되지 않습니다.',
    ],
    backToPokedex: '← 도감',
    upToPokedex:   '↑ 도감',
    setsHeading: '수록 세트',
    artistsHeading: '일러스트레이터',
    artistPrefix: '일러스트레이터',
    langJapaneseHeading: '일본어 한정 카드',
    langEnglishHeading:  '영어 한정 카드',
    langChineseHeading:  '중국어 한정 카드',
    langKoreanHeading:   '한국어 한정 카드',
    cardsSection: (n) => `${n}장의 언어 한정 TCG 카드 일러스트`,
    detailTitle: (name, n) => `${name} — 언어 한정 TCG 카드 일러스트 ${n}장 | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${name}(#${pad(id)})의 언어 한정 포켓몬 TCG 카드 일러스트 ${n}장. 한 가지 언어(일본어, 영어, 중국어 등)로만 발매된 독점 일러스트를 모았습니다.`,
    detailOgDescription: (name, n) =>
      `${name}의 언어 한정 TCG 카드 일러스트 ${n}장. 한 가지 언어로만 발매된 독점 일러스트입니다.`,
    schemaDetailDescription: (name, id) =>
      `${name}(#${pad(id)})의 언어 한정 포켓몬 TCG 카드 일러스트. 한 가지 언어로만 발매된 독점 일러스트입니다.`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: 'JavaScript가 비활성화되어 있어 동적 포켓몬 그리드는 표시되지 않습니다. 아래 목록에서 모든 포켓몬을 확인할 수 있습니다.',
    footerCopyright: '© 2026 - 3590 PokéTruc — 팬 제작, Nintendo / The Pokémon Company와 무관합니다.',
    langSwitcherLabel: '언어',
    themeToggleLabel: '다크 모드 전환',
  },
  zh: {
    siteName: 'PokéTruc',
    tagline: '仅在一种语言中发行的宝可梦 TCG 插画 / 美术图',
    pokedex: '图鉴',
    info: '信息',
    searchPlaceholder: '搜索宝可梦',
    indexTitle: 'PokéTruc — 语言独占的宝可梦 TCG 卡牌插画',
    indexDescription: 'PokéTruc 收录了仅在单一语言（日文、英文、中文或韩文）发行的宝可梦 TCG 独占插画。免费、无广告、由粉丝制作。',
    indexH1: '仅在一种语言中发行的宝可梦 TCG 插画 / 美术图',
    seoAbout: '宝可梦 TCG 中有许多卡牌的插画仅以单一语言印刷发行。1996 年作为邮票杂志附录发行的日本限定促销卡，2002 年仅在日本麦当劳发行的宝可梦-e 卡，以及最新卡组中仅在中国市场推出的独占卡牌等。PokéTruc 收录了妙蛙种子、喷火龙、皮卡丘等第一世代全 151 只宝可梦的此类语言独占卡牌，涵盖日本贩卖机扩展卡板、Black & White 促销卡、DPt-P 促销卡、麦当劳促销卡以及中国独占卡组，作品由 Ken Sugimori、Mitsuhiro Arita、Sumiyoshi Kizuki、Yuka Morii 等知名插画师绘制。按宝可梦、卡组、语言和年份分类整理，让您能够找到从未见过的稀有插画。完全免费、无广告、由粉丝制作。',
    seoPokedexHeading: '查看所有拥有独占卡牌的宝可梦',
    infoTitle: 'PokéTruc — 关于本站',
    infoDescription: '关于 PokéTruc：一份由粉丝制作的目录，收录仅在单一语言中发行的宝可梦 TCG 独占卡牌插画。免费、无广告。',
    infoH1: '关于 PokéTruc',
    aboutHeading: '关于',
    aboutBody: [
      "这个网站是为了乐趣而开发的，也是出于学习目的（作为一名非开发者，这对我来说是一个小挑战）。这就是为什么它非常简单和基础。",
      "它的目的是列出所有具有独特插图的宝可梦 TCG 卡片。所谓「独特」，是指只在一种语言（日语、英语、中文或其他语言）中提供的卡片。这就是我喜欢收藏的那种卡片。",
      "完全免费，无广告。",
      "尽管尽了一切努力，部分信息可能不准确。如果您发现错误或想提供反馈，请随时通过电子邮件联系我。",
      "Voilà, voilà :)",
    ],
    contactHeading: '联系我们',
    disclaimerBody: [
      '本网站是非官方的粉丝制作网站。宝可梦及宝可梦角色名称是 Nintendo / Creatures Inc. / GAME FREAK inc. 的商标。',
      '本网站不收集任何个人数据，也不需要用户账户。任何信息均不会在设备外部传输或存储。',
    ],
    backToPokedex: '← 图鉴',
    upToPokedex:   '↑ 图鉴',
    setsHeading: '收录的卡组',
    artistsHeading: '插画师',
    artistPrefix: '插画师',
    langJapaneseHeading: '日文独占卡牌',
    langEnglishHeading:  '英文独占卡牌',
    langChineseHeading:  '中文独占卡牌',
    langKoreanHeading:   '韩文独占卡牌',
    cardsSection: (n) => `${n} 张语言独占 TCG 卡牌插画`,
    detailTitle: (name, n) => `${name} — ${n} 张语言独占 TCG 卡牌插画 | PokéTruc`,
    detailDescription: (name, id, n) =>
      `${name}（#${pad(id)}）的 ${n} 张语言独占宝可梦 TCG 卡牌插画。仅在单一语言（日文、英文、中文或其他语言）发行的独家插画。`,
    detailOgDescription: (name, n) =>
      `${name}的 ${n} 张语言独占 TCG 卡牌插画。仅在单一语言发行的独家插画。`,
    schemaDetailDescription: (name, id) =>
      `${name}（#${pad(id)}）的语言独占宝可梦 TCG 卡牌插画。仅在单一语言发行的独家插画。`,
    nextLabel: (id, name) => `#${pad(id)} ${name} →`,
    prevLabel: (id, name) => `← #${pad(id)} ${name}`,
    noscript: '您的浏览器已禁用 JavaScript，无法显示动态宝可梦网格。您仍可在下方浏览所有宝可梦。',
    footerCopyright: '© 2026 - 3590 PokéTruc — 粉丝制作，与任天堂／株式会社宝可梦无关。',
    langSwitcherLabel: '语言',
    themeToggleLabel: '切换深色模式',
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

function buildStatsSentence(lang, pokemon, pkCards) {
  const count = pkCards.length;
  const years = pkCards.map(c => c.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  const byLangRaw = pkCards.reduce((a, c) => { a[c.language] = (a[c.language] || 0) + 1; return a; }, {});
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

// Path-style helpers for inter-page navigation within a language tree (root-relative).
function pathRoot(lang)     { return langPathPrefix(lang); }
function pathInfo(lang)     { return langPathPrefix(lang) + 'info/'; }
// Legacy path kept for redirect stubs at the old /info.html locations.
function legacyInfoPath(lang) { return langPathPrefix(lang) + 'info.html'; }
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
function headBlock({ lang, title, description, canonical, urlsByLang, jsonLd, ogImage, twitterCard }) {
  const og = ogImage || `${BASE_URL}/logo.png`;
  const twCard = twitterCard || 'summary_large_image';
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">

  <!-- Open Graph -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${og}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:locale" content="${HTML_LANG[lang].replace('-', '_')}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${twCard}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
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
  const dexActive  = (kind === 'index') ? ' aria-current="page"' : '';
  const infoActive = (kind === 'info')  ? ' aria-current="page"' : '';

  // Build language-switcher links: switch to the SAME page kind in target lang.
  // currentPath: '' (index), 'info', or { slug: '<slug>' } (pokemon detail).
  function altPathFor(targetLang) {
    if (kind === 'index')   return pathRoot(targetLang);
    if (kind === 'info')    return pathInfo(targetLang);
    if (kind === 'pokemon') return pathPokemon(targetLang, currentPath.slug);
    return pathRoot(targetLang);
  }

  const langLinks = LANGS.map(l => {
    const label = l === 'en' ? 'EN' : l === 'fr' ? 'FR' : l === 'ja' ? '日本語' : l === 'ko' ? '한국어' : '中文';
    const active = (l === lang) ? ' aria-current="true"' : '';
    return `<a href="${altPathFor(l)}" hreflang="${HREFLANG[l]}" class="lang-link${l === lang ? ' active' : ''}"${active}>${label}</a>`;
  }).join('');

  return `  <header>
    <a href="${pathRoot(lang)}" class="logo-link"><img src="/logo.webp" alt="${escapeHtml(L.siteName)}" class="site-logo" width="80" height="80"></a>
    <p class="site-name">${escapeHtml(L.siteName)}</p>
    <p class="site-tagline">${escapeHtml(L.tagline)}</p>
    <nav class="site-nav">
      <a href="${pathRoot(lang)}"${dexActive}>${escapeHtml(L.pokedex)}</a>
      <a href="${pathInfo(lang)}"${infoActive}>${escapeHtml(L.info)}</a>
      <button class="theme-toggle" id="theme-toggle" aria-label="${escapeHtml(L.themeToggleLabel)}"></button>
    </nav>
    <nav class="lang-switcher" aria-label="${escapeHtml(L.langSwitcherLabel)}">
      ${langLinks}
    </nav>
  </header>`;
}

function footerBlock(lang) {
  return `  <footer>
    <p>${escapeHtml(LANG[lang].footerCopyright)}</p>
  </footer>`;
}

function scriptTags() {
  return `  <script data-goatcounter="https://poketruc.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
  <script src="/i18n.js?v=${JS_V}"></script>
  <script src="/theme.js?v=${JS_V}"></script>`;
}

// -----------------------------------------------------------------------------
// Detail page (per Pokémon, per language)
// -----------------------------------------------------------------------------

// Card-language adjective per UI language, used in image alt-text.
const CARD_LANG_ADJ = {
  en: { '🇯🇵': 'Japanese-exclusive', '🇬🇧': 'English-exclusive', '🇨🇳': 'Chinese-exclusive', '🇰🇷': 'Korean-exclusive' },
  fr: { '🇯🇵': 'exclusivité japonaise', '🇬🇧': 'exclusivité anglaise', '🇨🇳': 'exclusivité chinoise', '🇰🇷': 'exclusivité coréenne' },
  ja: { '🇯🇵': '日本限定', '🇬🇧': '英語限定', '🇨🇳': '中国語限定', '🇰🇷': '韓国語限定' },
  ko: { '🇯🇵': '일본어 한정', '🇬🇧': '영어 한정', '🇨🇳': '중국어 한정', '🇰🇷': '한국어 한정' },
  zh: { '🇯🇵': '日文独占', '🇬🇧': '英文独占', '🇨🇳': '中文独占', '🇰🇷': '韩文独占' },
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
  const adj = (CARD_LANG_ADJ[lang] || CARD_LANG_ADJ.en)[card.language] || '';
  const artistPart = card.artist ? CARD_ALT_BY_ARTIST[lang](card.artist) : '';
  const suffix = CARD_ALT_SUFFIX[lang];
  const year = card.year ? `, ${card.year}` : '';
  return `${localizedName} — ${card.name} (${adj}${year}) ${suffix}${artistPart}`;
}

function renderCard(card, pokemon, L, lang, localizedName) {
  const alt = cardAltText(lang, card, localizedName);
  return `
        <div class="card-item" data-img="/cards/${card.imageName}.avif">
          <img src="/cards/${card.imageName}.avif" alt="${escapeHtml(alt)}" loading="lazy">
          <div class="card-info">
            <div class="card-name">${escapeHtml(card.name)}</div>
            <div class="card-meta"><span class="lang-badge">${card.language}</span> ${card.year} · ${escapeHtml(card.rarity)}</div>
            ${card.artist ? `<div class="card-artist">${escapeHtml(L.artistPrefix)}: ${escapeHtml(card.artist)}</div>` : ''}
          </div>
        </div>`;
}

function buildCardsSectionHTML(pokemon, pkCards, L, lang, localizedName) {
  const count = pkCards.length;
  const groups = groupBy(pkCards, c => c.language);
  const orderedFlags = [
    ...LANG_INFO.map(l => l.flag).filter(f => groups.has(f)),
    ...[...groups.keys()].filter(f => !LANG_INFO.some(l => l.flag === f)),
  ];
  const headingByFlag = Object.fromEntries(LANG_INFO.map(l => [l.flag, L[l.key]]));

  const sectionTitle = `<p class="cards-section-title">${L.cardsSection(count)}</p>`;

  if (orderedFlags.length === 1) {
    const onlyFlag = orderedFlags[0];
    const cs = groups.get(onlyFlag).slice().sort((a, b) => a.year - b.year);
    return `
    <section class="cards-section">
      ${sectionTitle}
      <div class="cards-grid">
        ${cs.map(c => renderCard(c, pokemon, L, lang, localizedName)).join('')}
      </div>
    </section>`;
  }

  const groupsHTML = orderedFlags.map(flag => {
    const cs = groups.get(flag).slice().sort((a, b) => a.year - b.year);
    const heading = headingByFlag[flag] || 'Other-exclusive cards';
    return `
      <h2 class="cards-lang-title">${flag} ${escapeHtml(heading)} (${cs.length})</h2>
      <div class="cards-grid">
        ${cs.map(c => renderCard(c, pokemon, L, lang, localizedName)).join('')}
      </div>`;
  }).join('');

  return `
    <section class="cards-section">
      ${sectionTitle}
      ${groupsHTML}
    </section>`;
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
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": L.pokedex, "item": urlForRoot(lang) },
      { "@type": "ListItem", "position": 2, "name": localizedName, "item": canonical },
    ],
  };
  const collectionPage = {
    "@context": "https://schema.org",
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
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${canonical}#cards`,
    "name": `${localizedName} — ${L.cardsSection(count)}`,
    "numberOfItems": count,
    "itemListOrder": "https://schema.org/ItemListOrderAscending",
    "isPartOf": { "@id": `${canonical}#collection` },
    "itemListElement": pkCards.map((card, i) => {
      const iso = FLAG_TO_ISO[card.language];
      const artwork = {
        "@type": "VisualArtwork",
        "@id": `${BASE_URL}/cards/${card.imageName}`,
        "name": `${localizedName} — ${card.name}${card.year ? ` (${card.year})` : ''}`,
        "image": `${BASE_URL}/cards/${card.imageName}.avif`,
        "url": canonical,
        "artform": "Trading card",
        "about": { "@type": "Thing", "name": localizedName },
        "isPartOf": { "@type": "CreativeWorkSeries", "name": card.name },
      };
      if (card.year)     artwork.datePublished = String(card.year);
      if (iso)           artwork.inLanguage = iso;
      if (card.artist)   artwork.creator = { "@type": "Person", "name": card.artist };
      if (card.rarity)   artwork.additionalType = card.rarity;
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

  const head = headBlock({
    lang,
    title: escapeHtml(title),
    description: escapeHtml(description),
    canonical,
    urlsByLang,
    jsonLd,
    ogImage,
    twitterCard: 'summary',
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

${headerBlock(lang, { slug }, 'pokemon')}

  <main class="pokemon-page">
    <div class="pokemon-hero">
      <a href="${pathRoot(lang)}" class="back-link">${escapeHtml(L.backToPokedex)}</a>
      <img src="/monsters/${pokemon.imageName}.png"
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

  <!-- Fullscreen -->
  <div id="fullscreen" class="fullscreen hidden">
    <div class="fullscreen-backdrop"></div>
    <img id="fullscreen-img" src="" alt="">
  </div>

${scriptTags()}
  <script src="/pokemon.js?v=${JS_V}"></script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Index page (per language)
// -----------------------------------------------------------------------------

function indexPageHTML(lang, pokemonsWithCards) {
  const L = LANG[lang];
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForRoot(l)]));
  const canonical  = urlsByLang[lang];

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    "url": `${BASE_URL}/`,
    "name": "PokéTruc",
    "description": L.indexDescription,
    "inLanguage": LANGS.map(l => HTML_LANG[l]),
  };
  const collectionPage = {
    "@context": "https://schema.org",
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
  const jsonLd = JSON.stringify({ "@context": "https://schema.org", "@graph": [websiteSchema, collectionPage] });

  const head = headBlock({
    lang,
    title: escapeHtml(L.indexTitle),
    description: escapeHtml(L.indexDescription),
    canonical,
    urlsByLang,
    jsonLd,
    twitterCard: 'summary_large_image',
  });

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
    #search, .search-row, #stats-bar, #loader, #pokemon-grid { display: none !important; }
    .noscript-fallback { display: block !important; }
  </style></noscript>
</head>
<body data-lang-prefix="${langPathPrefix(lang)}">

${headerBlock(lang, '', 'index')}

  <main>
    <h1 class="page-title visually-hidden">${escapeHtml(L.indexH1)}</h1>

    <div class="search-row">
      <input type="search" id="search" placeholder="${escapeHtml(L.searchPlaceholder)}" aria-label="${escapeHtml(L.searchPlaceholder)}" autocomplete="off">
    </div>

    <div id="stats-bar" class="stats-bar"></div>

    <div id="loader" class="loader">
      <div class="loader-spinner"></div>
    </div>
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

${scriptTags()}
  <script src="/app.js?v=${JS_V}"></script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Info page (per language)
// -----------------------------------------------------------------------------

function infoPageHTML(lang) {
  const L = LANG[lang];
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForInfo(l)]));
  const canonical  = urlsByLang[lang];

  const head = headBlock({
    lang,
    title: escapeHtml(L.infoTitle),
    description: escapeHtml(L.infoDescription),
    canonical,
    urlsByLang,
    twitterCard: 'summary',
  });

  const aboutHTML = L.aboutBody.map(p => `<p>${escapeHtml(p)}</p>`).join('\n        ');
  const disclaimerHTML = L.disclaimerBody.map(p => `<p>${escapeHtml(p)}</p>`).join('\n        ');

  return `<!DOCTYPE html>
<html lang="${HTML_LANG[lang]}">
<head>
${head}
</head>
<body data-lang-prefix="${langPathPrefix(lang)}">

${headerBlock(lang, '', 'info')}

  <main class="info-page">
    <h1 class="page-title">${escapeHtml(L.infoH1)}</h1>

    <div class="info-card">
      <h2>${escapeHtml(L.aboutHeading)}</h2>
      <div>
        ${aboutHTML}
      </div>
    </div>

    <div class="info-card">
      <h2>${escapeHtml(L.contactHeading)}</h2>
      <a href="mailto:poketruc@icloud.com?subject=Support%20%E2%80%93%20PokéTruc%20Web" class="info-link">poketruc@icloud.com</a>
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

// 4) Sitemap with hreflang annotations. <lastmod> per URL comes from the
//    per-page hash tracker so it only changes when the rendered HTML changes.
const sitemapUrls = [];
function sitemapEntry(urlsByLang, lang, urlKey) {
  const alt = LANGS.map(l =>
    `    <xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${urlsByLang[l]}"/>`
  ).join('\n');
  const lastmod = newState[urlKey]?.lastmod || TODAY;
  return `  <url>
    <loc>${urlsByLang[lang]}</loc>
    <lastmod>${lastmod}</lastmod>
${alt}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlsByLang.en}"/>
  </url>`;
}

// Index pages
{
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForRoot(l)]));
  for (const lang of LANGS) sitemapUrls.push(sitemapEntry(urlsByLang, lang, pathRoot(lang)));
}
// Info pages
{
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForInfo(l)]));
  for (const lang of LANGS) sitemapUrls.push(sitemapEntry(urlsByLang, lang, pathInfo(lang)));
}
// Pokémon pages
for (const p of pokemonsWithCards) {
  const slug = slugify(p.name.en);
  const urlsByLang = Object.fromEntries(LANGS.map(l => [l, urlForPokemon(l, slug)]));
  for (const lang of LANGS) sitemapUrls.push(sitemapEntry(urlsByLang, lang, pathPokemon(lang, slug)));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapUrls.join('\n')}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemap, 'utf8');

// Persist content hashes for the next build.
fs.writeFileSync(STATE_PATH, JSON.stringify(newState, null, 2), 'utf8');

console.log(`✓ ${pokemonsWithCards.length} Pokémon × ${LANGS.length} langues = ${pokemonsWithCards.length * LANGS.length} pages détail générées`);
console.log(`✓ ${LANGS.length} index + ${LANGS.length} info pages générés + ${LANGS.length} redirect stubs`);
console.log(`✓ sitemap.xml mis à jour (${sitemapUrls.length} URLs, hreflang inclus)`);
console.log(`✓ Contenu modifié : ${changedCount} pages · inchangé : ${unchangedCount} pages`);
console.log(`✓ Total : ${pageCount} fichiers HTML générés`);
