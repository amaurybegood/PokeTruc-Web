// Light i18n layer used by dynamically-rendered widgets (Pokédex grid, stats
// bar, search empty state). Static page content is already localised at build
// time, so most pages do NOT depend on this file beyond a few helpers.

function detectLang() {
  // The build script sets <html lang="..."> per page. Read from that so
  // the JS stays in sync with the HTML the user is actually viewing.
  const htmlLang = (document.documentElement.lang || 'en').toLowerCase();
  if (htmlLang.startsWith('fr')) return 'fr';
  if (htmlLang.startsWith('ja')) return 'ja';
  if (htmlLang.startsWith('ko')) return 'ko';
  if (htmlLang.startsWith('zh')) return 'zh';
  return 'en';
}

const lang = detectLang();

// Root-relative URL prefix for the current language tree
// ("" for /, "/fr" for /fr/, etc.). Used to build internal links from JS.
function langPathPrefix() {
  const body = document.body;
  if (body && body.dataset.langPrefix) return body.dataset.langPrefix;
  return lang === 'en' ? '/' : `/${lang}/`;
}

// Map UI lang to the Pokémon JSON name field (build-time payload uses jp for ja).
const nameField = { en: 'en', fr: 'fr', ja: 'jp', ko: 'ko', zh: 'zh' };

function pokemonName(pokemon) {
  return pokemon.name[nameField[lang]] || pokemon.name.en;
}

// Strings used by JS-rendered widgets only. Static page text is localised in
// the HTML, so this table is intentionally short.
const translations = {
  en: {
    'coming.soon':  'Coming soon',
    wip:            'WIP',
    'no.pokemon':   'No Pokémon found',
    'results.count': '{n} Pokémon shown',
    'no.card':      'No card',
    'generation':   'Generation {n}',
    'generation.unknown': 'Other Pokémon',
    'filter.all':   'All',
    'view.pokemon': 'Pokémon',
    'view.cards':   'Cards',
    'results.cards': '{n} cards shown',
    'no.cards':     'No card found',
    'card.artist':  'Artist',
    'card.note':    'Note',
    'card.source':  'source',
    'card.newtab':  'opens in new tab',
    'load.error':   'Failed to load data. Please try again later.',
    'retry':        'Retry',
    'theme.auto':   'Auto theme — click to switch',
    'theme.dark':   'Dark theme — click for light',
    'theme.light':  'Light theme — click for dark',
    'back.to.top':  'Back to top',
  },
  fr: {
    'coming.soon':  'Bientôt',
    wip:            'En cours',
    'no.pokemon':   'Aucun Pokémon trouvé',
    'results.count': '{n} Pokémon affichés',
    'no.card':      'Pas de carte',
    'generation':   'Génération {n}',
    'generation.unknown': 'Autres Pokémon',
    'filter.all':   'Tous',
    'view.pokemon': 'Pokémon',
    'view.cards':   'Cartes',
    'results.cards': '{n} cartes affichées',
    'no.cards':     'Aucune carte trouvée',
    'card.artist':  'Artiste',
    'card.note':    'Note',
    'card.source':  'source',
    'card.newtab':  'ouvre dans un nouvel onglet',
    'load.error':   'Impossible de charger les données. Veuillez réessayer.',
    'retry':        'Réessayer',
    'theme.auto':   'Thème auto — clic pour changer',
    'theme.dark':   'Thème sombre — clic pour clair',
    'theme.light':  'Thème clair — clic pour sombre',
    'back.to.top':  'Retour en haut',
  },
  ja: {
    'coming.soon':  '近日公開',
    wip:            '作業中',
    'no.pokemon':   'ポケモンが見つかりません',
    'results.count': '{n}匹のポケモンを表示中',
    'no.card':      'カードなし',
    'generation':   '第{n}世代',
    'generation.unknown': 'その他のポケモン',
    'filter.all':   'すべて',
    'view.pokemon': 'ポケモン',
    'view.cards':   'カード',
    'results.cards': 'カード{n}枚を表示中',
    'no.cards':     'カードが見つかりません',
    'card.artist':  'イラストレーター',
    'card.note':    'メモ',
    'card.source':  '出典',
    'card.newtab':  '新しいタブで開く',
    'load.error':   'データを読み込めませんでした。後でもう一度お試しください。',
    'retry':        '再試行',
    'theme.auto':   '自動テーマ — クリックで切替',
    'theme.dark':   'ダークテーマ — クリックでライト',
    'theme.light':  'ライトテーマ — クリックでダーク',
    'back.to.top':  'トップへ戻る',
  },
  ko: {
    'coming.soon':  '출시 예정',
    wip:            '진행 중',
    'no.pokemon':   '포켓몬을 찾을 수 없습니다',
    'results.count': '포켓몬 {n}마리 표시 중',
    'no.card':      '카드 없음',
    'generation':   '{n}세대',
    'generation.unknown': '기타 포켓몬',
    'filter.all':   '전체',
    'view.pokemon': '포켓몬',
    'view.cards':   '카드',
    'results.cards': '카드 {n}장 표시 중',
    'no.cards':     '카드를 찾을 수 없습니다',
    'card.artist':  '일러스트레이터',
    'card.note':    '메모',
    'card.source':  '출처',
    'card.newtab':  '새 탭에서 열기',
    'load.error':   '데이터를 불러올 수 없습니다. 나중에 다시 시도해 주세요.',
    'retry':        '다시 시도',
    'theme.auto':   '자동 테마 — 클릭하여 전환',
    'theme.dark':   '다크 테마 — 클릭하여 라이트로',
    'theme.light':  '라이트 테마 — 클릭하여 다크로',
    'back.to.top':  '맨 위로',
  },
  zh: {
    'coming.soon':  '即将推出',
    wip:            '进行中',
    'no.pokemon':   '未找到宝可梦',
    'results.count': '显示 {n} 只宝可梦',
    'no.card':      '无卡片',
    'generation':   '第 {n} 世代',
    'generation.unknown': '其他宝可梦',
    'filter.all':   '全部',
    'view.pokemon': '宝可梦',
    'view.cards':   '卡片',
    'results.cards': '显示 {n} 张卡片',
    'no.cards':     '未找到卡片',
    'card.artist':  '插画师',
    'card.note':    '备注',
    'card.source':  '来源',
    'card.newtab':  '在新标签页中打开',
    'load.error':   '无法加载数据，请稍后重试。',
    'retry':        '重试',
    'theme.auto':   '自动主题 — 点击切换',
    'theme.dark':   '深色主题 — 点击切换浅色',
    'theme.light':  '浅色主题 — 点击切换深色',
    'back.to.top':  '回到顶部',
  },
};

function t(key) {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

// Mirror of build.js STATS_LANG_LABEL: accessible name for each flag emoji
// used by the exclusivity filter chips and card language badges.
const FLAG_LABELS = {
  en: { '🇯🇵': 'Japanese',   '🇬🇧': 'English',   '🇨🇳': 'Chinese',   '🇰🇷': 'Korean',    '🇩🇪': 'German',      '🇪🇸': 'Spanish',     '🇫🇷': 'French',      '🇮🇹': 'Italian',      '🇵🇹': 'Portuguese',     '🇵🇱': 'Polish',       '🇮🇩': 'Indonesian',     '🇷🇺': 'Russian',        '🌍': 'Western',         '🏯': 'Asian'           },
  fr: { '🇯🇵': 'japonaise',  '🇬🇧': 'anglaise',  '🇨🇳': 'chinoise',  '🇰🇷': 'coréenne',  '🇩🇪': 'allemande',   '🇪🇸': 'espagnole',   '🇫🇷': 'française',   '🇮🇹': 'italienne',    '🇵🇹': 'portugaise',     '🇵🇱': 'polonaise',    '🇮🇩': 'indonésienne',   '🇷🇺': 'russe',          '🌍': 'occidentale',     '🏯': 'asiatique'       },
  ja: { '🇯🇵': '日本限定',    '🇬🇧': '英語限定',  '🇨🇳': '中国語限定', '🇰🇷': '韓国語限定', '🇩🇪': 'ドイツ語限定', '🇪🇸': 'スペイン語限定', '🇫🇷': 'フランス語限定', '🇮🇹': 'イタリア語限定', '🇵🇹': 'ポルトガル語限定', '🇵🇱': 'ポーランド語限定', '🇮🇩': 'インドネシア語限定', '🇷🇺': 'ロシア語限定',   '🌍': '欧米限定',        '🏯': 'アジア限定'       },
  ko: { '🇯🇵': '일본어 한정', '🇬🇧': '영어 한정', '🇨🇳': '중국어 한정', '🇰🇷': '한국어 한정', '🇩🇪': '독일어 한정',  '🇪🇸': '스페인어 한정', '🇫🇷': '프랑스어 한정', '🇮🇹': '이탈리아어 한정', '🇵🇹': '포르투갈어 한정', '🇵🇱': '폴란드어 한정',  '🇮🇩': '인도네시아어 한정', '🇷🇺': '러시아어 한정',  '🌍': '서양 한정',       '🏯': '아시아 한정'      },
  zh: { '🇯🇵': '日文独占',    '🇬🇧': '英文独占',  '🇨🇳': '中文独占',  '🇰🇷': '韩文独占',   '🇩🇪': '德文独占',    '🇪🇸': '西班牙文独占', '🇫🇷': '法文独占',     '🇮🇹': '意大利文独占',  '🇵🇹': '葡萄牙文独占',   '🇵🇱': '波兰文独占',    '🇮🇩': '印尼文独占',     '🇷🇺': '俄文独占',       '🌍': '西方独占',        '🏯': '亚洲独占'        },
};

function flagLabel(flag) {
  return FLAG_LABELS[lang]?.[flag] ?? FLAG_LABELS.en[flag] ?? flag;
}

// Scroll behavior for JS-driven scrolling: honour prefers-reduced-motion,
// which the CSS scroll-behavior kill-switch can't reach from JS calls.
function scrollBehavior() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

// Region name per generation (index = generation number; 0 unused). Used in the
// Pokédex generation headings and the jump-to-generation shortcut.
const REGION_NAMES = {
  en: ['', 'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'],
  fr: ['', 'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unys',  'Kalos', 'Alola', 'Galar', 'Paldea'],
  ja: ['', 'カントー', 'ジョウト', 'ホウエン', 'シンオウ', 'イッシュ', 'カロス', 'アローラ', 'ガラル', 'パルデア'],
  ko: ['', '관동', '성도', '호연', '신오', '하나', '칼로스', '알로라', '가라르', '팔데아'],
  zh: ['', '关都', '城都', '丰缘', '神奥', '合众', '卡洛斯', '阿罗拉', '伽勒尔', '帕底亚'],
};

function regionName(gen) {
  const arr = REGION_NAMES[lang] || REGION_NAMES.en;
  return arr[gen] || '';
}
