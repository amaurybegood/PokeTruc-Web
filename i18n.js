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
    'tile.card': '1 card',
    'tile.cards': '{n} cards',
    'cards.count': '{n} illustrations',
    'cards.loadMore': 'Load {n} more',
    'cards.showing': 'Showing {n} of {total}',
    'region': 'Region',
    'card.number': 'Number',
    'card.released': 'Released',
    'card.rarity': 'Rarity',
    'card.type': 'Type',
    'card.market': 'Market',
    'card.asOf': 'as of {date}',
    'card.viewFull': 'View full size',
    'card.copyLink': 'Copy card link',
    'card.copied': 'Link copied',
    'card.close': 'Close card details',
    'card.details': 'Card details',
    'viewer.label': 'Card viewer: {name}',
    'viewer.close': 'Close viewer',
    'viewer.copy': 'Copy link',
    'viewer.share': 'Share card',
    'viewer.prev': 'Previous card',
    'viewer.next': 'Next card',
    'viewer.pos': '{i} of {n}',
    'viewer.open': 'Open on {market}',
    'viewer.hint': 'Use {prev} {next} to browse, {esc} to close',
    'viewer.strip': 'Cards in this group',
    'viewer.asOf': '{market}, as of {date}',
    'all.cards': 'All cards',
    'stage.basic': 'Basic',
    'stage.stage1': 'Stage 1',
    'stage.stage2': 'Stage 2',
    'search.pokemon': 'Pokémon',
    'search.artist': 'Artists',
    'search.set': 'Sets',
    'search.card': 'Cards',
    'search.pokemonCount': '{n} Pokémon',
    'search.seeAll': 'See all {n} cards for “{q}”',
    'search.none': 'No results for “{q}”',
    'search.results': 'Search results for {q}',
    'search.count': '{n} results',
    'search.navigate': 'navigate',
    'search.open': 'open',
    'search.close': 'close',
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
    'tile.card': '1 carte',
    'tile.cards': '{n} cartes',
    'cards.count': '{n} illustrations',
    'cards.loadMore': 'Afficher {n} de plus',
    'cards.showing': '{n} sur {total} affichées',
    'region': 'Région',
    'card.number': 'Numéro',
    'card.released': 'Sortie',
    'card.rarity': 'Rareté',
    'card.type': 'Type',
    'card.market': 'Marché',
    'card.asOf': 'au {date}',
    'card.viewFull': 'Voir en grand',
    'card.copyLink': 'Copier le lien de la carte',
    'card.copied': 'Lien copié',
    'card.close': 'Fermer les détails de la carte',
    'card.details': 'Détails de la carte',
    'viewer.label': 'Visionneuse : {name}',
    'viewer.close': 'Fermer la visionneuse',
    'viewer.copy': 'Copier le lien',
    'viewer.share': 'Partager la carte',
    'viewer.prev': 'Carte précédente',
    'viewer.next': 'Carte suivante',
    'viewer.pos': '{i} sur {n}',
    'viewer.open': 'Ouvrir sur {market}',
    'viewer.hint': '{prev} {next} pour naviguer, {esc} pour fermer',
    'viewer.strip': 'Cartes de ce groupe',
    'viewer.asOf': '{market}, au {date}',
    'all.cards': 'Toutes les cartes',
    'stage.basic': 'De base',
    'stage.stage1': 'Niveau 1',
    'stage.stage2': 'Niveau 2',
    'search.pokemon': 'Pokémon',
    'search.artist': 'Artistes',
    'search.set': 'Sets',
    'search.card': 'Cartes',
    'search.pokemonCount': '{n} Pokémon',
    'search.seeAll': 'Voir les {n} cartes pour « {q} »',
    'search.none': 'Aucun résultat pour « {q} »',
    'search.results': 'Résultats pour {q}',
    'search.count': '{n} résultats',
    'search.navigate': 'naviguer',
    'search.open': 'ouvrir',
    'search.close': 'fermer',
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
    'tile.card': '1枚',
    'tile.cards': '{n}枚',
    'cards.count': '{n}枚のイラスト',
    'cards.loadMore': 'さらに{n}枚表示',
    'cards.showing': '{total}枚中{n}枚を表示',
    'region': '地方',
    'card.number': '番号',
    'card.released': '発売日',
    'card.rarity': 'レアリティ',
    'card.type': 'タイプ',
    'card.market': '相場',
    'card.asOf': '{date}時点',
    'card.viewFull': '拡大表示',
    'card.copyLink': 'カードのリンクをコピー',
    'card.copied': 'リンクをコピーしました',
    'card.close': 'カード詳細を閉じる',
    'card.details': 'カード詳細',
    'viewer.label': 'カードビューア：{name}',
    'viewer.close': 'ビューアを閉じる',
    'viewer.copy': 'リンクをコピー',
    'viewer.share': 'カードを共有',
    'viewer.prev': '前のカード',
    'viewer.next': '次のカード',
    'viewer.pos': '{n}枚中{i}枚目',
    'viewer.open': '{market}で開く',
    'viewer.hint': '{prev} {next} で移動、{esc} で閉じる',
    'viewer.strip': 'このグループのカード',
    'viewer.asOf': '{market}（{date}時点）',
    'all.cards': 'すべてのカード',
    'stage.basic': 'たね',
    'stage.stage1': '1進化',
    'stage.stage2': '2進化',
    'search.pokemon': 'ポケモン',
    'search.artist': 'イラストレーター',
    'search.set': 'セット',
    'search.card': 'カード',
    'search.pokemonCount': '{n}匹',
    'search.seeAll': '「{q}」のカード{n}枚をすべて見る',
    'search.none': '「{q}」に一致する結果はありません',
    'search.results': '「{q}」の検索結果',
    'search.count': '{n}件の結果',
    'search.navigate': '移動',
    'search.open': '開く',
    'search.close': '閉じる',
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
    'tile.card': '1장',
    'tile.cards': '{n}장',
    'cards.count': '일러스트 {n}장',
    'cards.loadMore': '{n}장 더 보기',
    'cards.showing': '{total}장 중 {n}장 표시',
    'region': '지방',
    'card.number': '번호',
    'card.released': '발매일',
    'card.rarity': '레어도',
    'card.type': '타입',
    'card.market': '시세',
    'card.asOf': '{date} 기준',
    'card.viewFull': '크게 보기',
    'card.copyLink': '카드 링크 복사',
    'card.copied': '링크를 복사했습니다',
    'card.close': '카드 상세 닫기',
    'card.details': '카드 상세',
    'viewer.label': '카드 뷰어: {name}',
    'viewer.close': '뷰어 닫기',
    'viewer.copy': '링크 복사',
    'viewer.share': '카드 공유',
    'viewer.prev': '이전 카드',
    'viewer.next': '다음 카드',
    'viewer.pos': '{n}장 중 {i}번째',
    'viewer.open': '{market}에서 열기',
    'viewer.hint': '{prev} {next} 로 이동, {esc} 로 닫기',
    'viewer.strip': '이 그룹의 카드',
    'viewer.asOf': '{market}, {date} 기준',
    'all.cards': '모든 카드',
    'stage.basic': '기본',
    'stage.stage1': '1진화',
    'stage.stage2': '2진화',
    'search.pokemon': '포켓몬',
    'search.artist': '일러스트레이터',
    'search.set': '세트',
    'search.card': '카드',
    'search.pokemonCount': '포켓몬 {n}마리',
    'search.seeAll': '“{q}” 카드 {n}장 모두 보기',
    'search.none': '“{q}”에 대한 결과가 없습니다',
    'search.results': '“{q}” 검색 결과',
    'search.count': '결과 {n}개',
    'search.navigate': '이동',
    'search.open': '열기',
    'search.close': '닫기',
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
    'tile.card': '1 张',
    'tile.cards': '{n} 张',
    'cards.count': '{n} 张插画',
    'cards.loadMore': '再加载 {n} 张',
    'cards.showing': '显示 {n} / {total}',
    'region': '地区',
    'card.number': '编号',
    'card.released': '发行日期',
    'card.rarity': '稀有度',
    'card.type': '类型',
    'card.market': '市场价',
    'card.asOf': '截至 {date}',
    'card.viewFull': '查看大图',
    'card.copyLink': '复制卡牌链接',
    'card.copied': '链接已复制',
    'card.close': '关闭卡牌详情',
    'card.details': '卡牌详情',
    'viewer.label': '卡牌查看器：{name}',
    'viewer.close': '关闭查看器',
    'viewer.copy': '复制链接',
    'viewer.share': '分享卡牌',
    'viewer.prev': '上一张',
    'viewer.next': '下一张',
    'viewer.pos': '第 {i} / {n} 张',
    'viewer.open': '在 {market} 打开',
    'viewer.hint': '使用 {prev} {next} 浏览，{esc} 关闭',
    'viewer.strip': '本组卡牌',
    'viewer.asOf': '{market}，截至 {date}',
    'all.cards': '全部卡牌',
    'stage.basic': '基础',
    'stage.stage1': '1阶进化',
    'stage.stage2': '2阶进化',
    'search.pokemon': '宝可梦',
    'search.artist': '插画师',
    'search.set': '卡组',
    'search.card': '卡牌',
    'search.pokemonCount': '{n} 只宝可梦',
    'search.seeAll': '查看“{q}”的全部 {n} 张卡牌',
    'search.none': '没有“{q}”的结果',
    'search.results': '“{q}”的搜索结果',
    'search.count': '{n} 个结果',
    'search.navigate': '浏览',
    'search.open': '打开',
    'search.close': '关闭',
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

// Visible label of each exclusivity filter chip (a small flag precedes it).
const CHIP_LABELS = {
  en: { '🇯🇵': 'Japan',  '🇬🇧': 'English', '🇨🇳': 'China', '🇰🇷': 'Korea', '🇩🇪': 'German',   '🇪🇸': 'Spanish',   '🇫🇷': 'French',   '🇮🇹': 'Italian',   '🇵🇹': 'Portuguese', '🇵🇱': 'Polish',   '🇮🇩': 'Indonesia', '🇷🇺': 'Russian', '🌍': 'Western',  '🏯': 'Asia' },
  fr: { '🇯🇵': 'Japon',  '🇬🇧': 'Anglais', '🇨🇳': 'Chine', '🇰🇷': 'Corée', '🇩🇪': 'Allemand', '🇪🇸': 'Espagnol',  '🇫🇷': 'Français', '🇮🇹': 'Italien',   '🇵🇹': 'Portugais',  '🇵🇱': 'Polonais', '🇮🇩': 'Indonésie', '🇷🇺': 'Russe',   '🌍': 'Occident', '🏯': 'Asie' },
  ja: { '🇯🇵': '日本',   '🇬🇧': '英語',    '🇨🇳': '中国',  '🇰🇷': '韓国',  '🇩🇪': 'ドイツ語', '🇪🇸': 'スペイン語', '🇫🇷': 'フランス語', '🇮🇹': 'イタリア語', '🇵🇹': 'ポルトガル語', '🇵🇱': 'ポーランド語', '🇮🇩': 'インドネシア', '🇷🇺': 'ロシア語', '🌍': '欧米', '🏯': 'アジア' },
  ko: { '🇯🇵': '일본',   '🇬🇧': '영어',    '🇨🇳': '중국',  '🇰🇷': '한국',  '🇩🇪': '독일어',   '🇪🇸': '스페인어',   '🇫🇷': '프랑스어',  '🇮🇹': '이탈리아어', '🇵🇹': '포르투갈어',  '🇵🇱': '폴란드어',  '🇮🇩': '인도네시아', '🇷🇺': '러시아어', '🌍': '서양', '🏯': '아시아' },
  zh: { '🇯🇵': '日本',   '🇬🇧': '英文',    '🇨🇳': '中国',  '🇰🇷': '韩国',  '🇩🇪': '德文',     '🇪🇸': '西班牙文',   '🇫🇷': '法文',     '🇮🇹': '意大利文',   '🇵🇹': '葡萄牙文',    '🇵🇱': '波兰文',    '🇮🇩': '印尼',      '🇷🇺': '俄文',    '🌍': '西方', '🏯': '亚洲' },
};

function chipLabel(flag) {
  return CHIP_LABELS[lang]?.[flag] ?? CHIP_LABELS.en[flag] ?? flag;
}

// Mirror of build.js exclusivityKey() / exclusivityTag(): grouping key and the
// short tag shown on cards ("JP ONLY", "CN · TH", 日本限定…).
function exclusivityKey(card) {
  if (card.region === 'western') return '🌍';
  if (card.region === 'asian')   return '🏯';
  if (card.languages.length === 1) return card.languages[0];
  return null;
}

const FLAG_CODE = {
  '🇯🇵': 'JP', '🇬🇧': 'EN', '🇨🇳': 'CN', '🇰🇷': 'KR', '🇩🇪': 'DE', '🇪🇸': 'ES', '🇫🇷': 'FR',
  '🇮🇹': 'IT', '🇵🇹': 'PT', '🇵🇱': 'PL', '🇮🇩': 'ID', '🇷🇺': 'RU', '🇹🇭': 'TH', '🇹🇼': 'TW',
};
const EXCL_TAG_REGION = {
  en: { '🌍': 'WESTERN',  '🏯': 'ASIA' },
  fr: { '🌍': 'OCCIDENT', '🏯': 'ASIE' },
};

function exclusivityTag(card) {
  const key = exclusivityKey(card);
  const known = card.languages.every(f => FLAG_CODE[f]);
  if ((key === '🏯' || key === null) && card.languages.length <= 3 && known) {
    return card.languages.map(f => FLAG_CODE[f]).join(' · ');
  }
  if (lang === 'en' || lang === 'fr') {
    if (EXCL_TAG_REGION[lang][key]) return EXCL_TAG_REGION[lang][key];
    return lang === 'en' ? `${FLAG_CODE[key]} ONLY` : `EXCLU ${FLAG_CODE[key]}`;
  }
  return flagLabel(key);
}

// Year shown on cards: the release date's year when known, else the set year.
function cardYear(card) {
  return card.releaseDate ? Number(card.releaseDate.slice(0, 4)) : card.year;
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
