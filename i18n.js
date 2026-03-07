function detectLang() {
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

const lang = detectLang();
document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;

// Map UI lang code to Pokémon name field
const nameField = { en: 'en', fr: 'fr', ja: 'jp', ko: 'ko', zh: 'zh' };

function pokemonName(pokemon) {
  return pokemon.name[nameField[lang]] || pokemon.name.en;
}

const translations = {
  en: {
    subtitle:       'Exclusive Pokémon card illustrations',
    dex:            'Pokédex',
    info:           'Info',
    'search.placeholder': 'Search a Pokémon...',
    'coming.soon':  'Coming soon',
    wip:            'WIP',
    'no.pokemon':   'No Pokémon found',
    'no.card':      'No card',
    'stat.cards':   'cards referenced',
    'stat.done':    'Pkm complete',
    'stat.wip':     'Pkm in progress',
    'stat.soon':    'Pkm coming soon',
    'filter.all':   'All',
    'filter.cards': 'With cards',
    'artist':       'Artist',

    card:           'card',
    cards:          'cards',
    about:          'About',
    contact:        'Contact',
    purpose:        "This site was developed for fun, and also for learning purposes (not being a developer, it's a bit of a challenge for me). That's why it is very simple and basic.\n\nIts purpose is to list all cards with unique illustrations. By unique, I mean that they are only available in one language (Japanese, English, Chinese, or other). This is the kind of card I like to collect.\n\nIt is completely free and ad-free.\n\nDespite the care taken, some information may be inaccurate. Please feel free to contact me by email if you notice an error or would like to provide feedback.\n\nVoilà, voilà :)",
    disclaimer:     "This app is an unofficial, fan-made application. Pokémon and Pokémon character names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc.\nThis app does not collect any personal data, use any third-party services, or require a user account.\nNo information is transmitted or stored outside of your device.",
  },
  fr: {
    subtitle:       'Illustrations exclusives de cartes Pokémon',
    dex:            'Pokédex',
    info:           'Info',
    'search.placeholder': 'Rechercher un Pokémon...',
    'coming.soon':  'Bientôt',
    wip:            'En cours',
    'no.pokemon':   'Aucun Pokémon trouvé',
    'no.card':      'Pas de carte',
    'stat.cards':   'cartes référencées',
    'stat.done':    'Pkm complets',
    'stat.wip':     'Pkm en cours',
    'stat.soon':    'Pkm à venir',
    'filter.all':   'Tous',
    'filter.cards': 'Avec cartes',
    'artist':       'Artiste',
    card:           'carte',
    cards:          'cartes',
    about:          'À propos',
    contact:        'Contact',
    purpose:        "Ce site est développé pour le fun, et aussi à des fins d'apprentissage (n'étant pas développeur, c'est un petit défi pour moi). C'est pour cela qu'il est très simple et basique.\n\nSon but est de répertorier toutes les cartes ayant des illustrations uniques. Par unique, j'entends qui n'est disponible que dans une langue (japonais, anglais, chinois, ou autre). C'est le genre de carte que j'aime bien collectionner.\n\nIl est entièrement gratuit et sans publicité.\n\nMalgré le soin apporté, certaines informations peuvent être inexactes. N'hésitez pas à me contacter par e-mail si vous constatez une erreur ou souhaitez faire un retour.\n\nVoilà, voilà :)",
    disclaimer:     "Cette application est une application non officielle créée par un fan.\nPokémon et les noms des personnages Pokémon sont des marques déposées de Nintendo / Creatures Inc. / GAME FREAK inc.\nCette application ne collecte aucune donnée personnelle, n'utilise aucun service tiers et ne nécessite aucun compte utilisateur.\nAucune information n'est transmise ou stockée en dehors de votre appareil.",
  },
  ja: {
    subtitle:       '限定ポケモンカードイラスト',
    dex:            '図鑑',
    info:           '情報',
    'search.placeholder': 'ポケモンをさがす',
    'coming.soon':  '近日公開',
    wip:            '作業中',
    'no.pokemon':   'ポケモンが見つかりません',
    'no.card':      'カードなし',
    'stat.cards':   '枚のカード',
    'stat.done':    'ポケモン完了',
    'stat.wip':     'ポケモン作業中',
    'stat.soon':    'ポケモン近日公開',
    'filter.all':   'すべて',
    'filter.cards': 'カードあり',
    'artist':       'イラストレーター',
    card:           '枚',
    cards:          '枚',
    about:          'このアプリについて',
    contact:        'お問い合わせ',
    purpose:        "このサイトは楽しみのために、また学習目的で開発しました（開発者ではないので、私には少し挑戦です）。そのため、とてもシンプルで基本的な作りになっています。\n\nその目的は、独自のイラストを持つすべてのカードをリストアップすることです。「独自」とは、1つの言語（日本語、英語、中国語、またはその他）でのみ入手可能なものを意味します。これが私がコレクションしたいカードの種類です。\n\n完全無料、広告なしです。\n\n注意を払っていますが、一部の情報が不正確な場合があります。エラーを見つけた場合やフィードバックをお送りいただける場合は、メールでご連絡ください。\n\nそれでは :)",
    disclaimer:     "このアプリは非公式のファン制作アプリです。ポケモンおよびポケモンキャラクター名はNintendo / Creatures Inc. / GAME FREAK inc.の商標です。\nこのアプリは個人情報を収集せず、サードパーティサービスを使用せず、ユーザーアカウントも不要です。\nいかなる情報もデバイス外に送信・保存されません。",
  },
  ko: {
    subtitle:       '독점 포켓몬 카드 일러스트',
    dex:            '도감',
    info:           '정보',
    'search.placeholder': '포켓몬 검색',
    'coming.soon':  '출시 예정',
    wip:            '진행 중',
    'no.pokemon':   '포켓몬을 찾을 수 없습니다',
    'no.card':      '카드 없음',
    'stat.cards':   '장 카드',
    'stat.done':    '포켓몬 완료',
    'stat.wip':     '포켓몬 진행 중',
    'stat.soon':    '포켓몬 출시 예정',
    'filter.all':   '전체',
    'filter.cards': '카드 있음',
    'artist':       '일러스트레이터',
    card:           '장',
    cards:          '장',
    about:          '앱 소개',
    contact:        '문의하기',
    purpose:        "이 사이트는 재미를 위해, 그리고 학습 목적으로 개발되었습니다 (개발자가 아니기 때문에 저에게는 작은 도전입니다). 그래서 매우 단순하고 기본적입니다.\n\n그 목적은 독특한 일러스트를 가진 모든 카드를 나열하는 것입니다. '독특하다'는 것은 한 가지 언어(일본어, 영어, 중국어 또는 기타)로만 제공된다는 의미입니다. 이것이 제가 수집하고 싶은 카드의 종류입니다.\n\n완전 무료이며 광고가 없습니다.\n\n주의를 기울였지만 일부 정보가 부정확할 수 있습니다. 오류를 발견하거나 피드백을 제공하고 싶으시면 이메일로 연락해 주세요.\n\nVoilà, voilà :)",
    disclaimer:     "이 앱은 비공식 팬 제작 앱입니다. 포켓몬 및 포켓몬 캐릭터 이름은 Nintendo / Creatures Inc. / GAME FREAK inc.의 상표입니다.\n이 앱은 개인 정보를 수집하지 않으며, 제3자 서비스를 사용하지 않고, 사용자 계정도 필요하지 않습니다.\n어떠한 정보도 기기 외부로 전송되거나 저장되지 않습니다.",
  },
  zh: {
    subtitle:       '独家宝可梦卡牌插图',
    dex:            '图鉴',
    info:           '信息',
    'search.placeholder': '搜索宝可梦',
    'coming.soon':  '即将推出',
    wip:            '进行中',
    'no.pokemon':   '未找到宝可梦',
    'no.card':      '无卡片',
    'stat.cards':   '张卡片',
    'stat.done':    '宝可梦已完成',
    'stat.wip':     '宝可梦进行中',
    'stat.soon':    '宝可梦即将推出',
    'filter.all':   '全部',
    'filter.cards': '有卡片',
    'artist':       '插画师',
    card:           '张',
    cards:          '张',
    about:          '关于',
    contact:        '联系我们',
    purpose:        "这个网站是为了乐趣而开发的，也是出于学习目的（作为一名非开发者，这对我来说是一个小挑战）。这就是为什么它非常简单和基础。\n\n它的目的是列出所有具有独特插图的卡片。所谓「独特」，是指只在一种语言（日语、英语、中文或其他语言）中提供的卡片。这就是我喜欢收藏的那种卡片。\n\n完全免费，无广告。\n\n尽管尽了一切努力，部分信息可能不准确。如果您发现错误或想提供反馈，请随时通过电子邮件联系我。\n\nVoilà, voilà :)",
    disclaimer:     "本应用是非官方的粉丝制作应用。宝可梦及宝可梦角色名称是Nintendo / Creatures Inc. / GAME FREAK inc.的商标。\n本应用不收集任何个人数据，不使用任何第三方服务，也不需要用户账户。\n任何信息均不会在设备外部传输或存储。",
  },
};

function t(key) {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

// Apply data-i18n attributes to the DOM
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const text = t(el.dataset.i18nHtml);
    el.innerHTML = text.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

// Apply immediately for static elements
document.addEventListener('DOMContentLoaded', applyTranslations);
