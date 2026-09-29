// Card viewer, mobile card details sheet and the card facts shared with the
// Pokémon page panel (DESIGN_HANDOFF 4.3 / 4.4 / 4.2). The viewer and the sheet
// are native modal <dialog>s (#viewer, #card-sheet from build.js): the page
// behind is inert, Tab stays inside, Esc closes and focus returns to the opener.
// Used by pokemon.js (Pokémon + Trainers pages) and app.js (All cards view).
// Depends on i18n.js (t, lang, langPathPrefix, exclusivityTag, cardYear).

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MARKETS = [['cardmarket', 'Cardmarket', 'EUR'], ['tcgplayer', 'TCGplayer', 'USD'], ['ebay', 'eBay', 'USD']];
const STRIP_SIZE = 11; // filmstrip thumbnails around the current card

const ICON = {
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  prev:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  next:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  link:  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
};

// Card data embedded by build.js (<script id="cards-data">), keyed by imageName.
const pageCards = (() => {
  try { return new Map(JSON.parse(document.getElementById('cards-data').textContent).map(c => [c.imageName, c])); }
  catch { return new Map(); }
})();

// Dates in the data are plain days: format them in UTC so no timezone shifts them.
const fmtDate = (d, dateStyle = 'long') => new Intl.DateTimeFormat(lang, { dateStyle, timeZone: 'UTC' }).format(new Date(d));

function marketPrices(card) {
  return MARKETS.map(([key, name, currency]) => {
    const p = (card.prices || {})[key];
    if (!p || p.price == null) return null;
    return { name, url: p.url, value: p.price, amount: new Intl.NumberFormat(lang, { style: 'currency', currency }).format(p.price) };
  }).filter(Boolean);
}

const cardTitle = card => card.releaseProduct || card.name;
const cardAlt = (card, who) => [who, card.setNumber, cardTitle(card)].filter(Boolean).join(', ');
const cardHref = (card, url) => new URL((url || location.pathname) + '#' + card.imageName, location.origin).href;

function linkify(text) {
  const label = escapeHtml(`${t('card.source')} (${t('card.newtab')})`);
  return escapeHtml(text).replace(/https?:\/\/[^\s]+/g, m => {
    const trail = (m.match(/[.,;:!?]+$/) || [''])[0];
    const url = trail ? m.slice(0, -trail.length) : m;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${escapeHtml(t('card.source'))}<span aria-hidden="true"> ↗</span></a>${trail}`;
  });
}

// <dl> of card facts. The viewer shows the type and puts the price apart;
// the panel and the sheet list every market with the price date.
function cardFacts(card, { viewer = false } = {}) {
  const rows = [];
  if (card.setNumber) rows.push(['card.number', `<span class="mono">${escapeHtml(card.setNumber)}</span>`]);
  rows.push(['card.released', escapeHtml(card.releaseDate ? fmtDate(card.releaseDate) : card.year)]);
  if (card.artist) rows.push(['card.artist', `<a href="${langPathPrefix()}?q=${encodeURIComponent(card.artist)}&amp;view=cards">${escapeHtml(card.artist)}</a>`]);
  const rarity = [card.rarity, ...(card.variants || [])].filter(Boolean).join(' · ');
  if (rarity) rows.push(['card.rarity', escapeHtml(rarity)]);
  if (viewer) {
    const type = [card.energyType, card.stage && t('stage.' + card.stage)].filter(Boolean).join(' · ');
    if (type) rows.push(['card.type', escapeHtml(type)]);
  } else {
    const prices = marketPrices(card);
    if (prices.length) rows.push(['card.market', prices.map(p => p.url
      ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${p.name} ${escapeHtml(p.amount)}</a>`
      : `${p.name} ${escapeHtml(p.amount)}`).join(' · ')
      + (card.pricesDate ? ` <span class="facts-date">${escapeHtml(t('card.asOf').replace('{date}', fmtDate(card.pricesDate, 'medium')))}</span>` : '')]);
  }
  if (card.description) rows.push(['card.note', linkify(card.description)]);
  return `<dl class="facts">${rows.map(([k, v]) => `<dt>${escapeHtml(t(k))}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

// Panel (desktop, Pokémon page) and sheet (mobile) share this markup; buttons
// carry data-act="close" / "full" / "copy" for the container to handle.
function cardDetailsHTML(card, who, variant) {
  const tag = `<span class="tag">${escapeHtml(exclusivityTag(card))}</span>`;
  const close = `<button type="button" class="round-btn" data-act="close" aria-label="${escapeHtml(t('card.close'))}">${ICON.close}</button>`;
  const actions = `<div class="details-actions">
      <button type="button" class="btn btn-solid" data-act="full">${escapeHtml(t('card.viewFull'))}</button>
      <button type="button" class="btn btn-outline" data-act="copy">${escapeHtml(t('card.copyLink'))}</button>
    </div>`;
  const titleId = `details-title-${variant}`;
  if (variant === 'panel') {
    const sub = card.releaseProduct ? [card.name, card.series] : [card.series];
    return `<div class="details-row">${tag}${close}</div>
    <img class="details-img" src="/cards/${card.imageName}.avif" alt="${escapeHtml(cardAlt(card, who))}" width="480" height="671">
    <div class="details-id"><h2 class="details-title" id="${titleId}">${escapeHtml(cardTitle(card))}</h2>
      <p class="details-sub">${escapeHtml(sub.filter(Boolean).join(' · '))}</p></div>
    ${cardFacts(card)}
    ${actions}`;
  }
  return `<span class="sheet-grab" aria-hidden="true"></span>
    <div class="sheet-head">
      <img class="sheet-thumb" src="/cards/thumbs/${card.imageName}.avif" alt="${escapeHtml(cardAlt(card, who))}" width="480" height="671">
      <div class="details-id">
        <div class="details-row">${tag}${close}</div>
        <h2 class="details-title" id="${titleId}">${escapeHtml(cardTitle(card))}</h2>
        <p class="details-sub">${escapeHtml([who, card.releaseProduct ? card.name : card.series].filter(Boolean).join(' · '))}</p>
      </div>
    </div>
    ${cardFacts(card)}
    ${actions}`;
}

// Copies the card's link and says so on the button for 2 s.
function copyCardLink(btn, href) {
  navigator.clipboard?.writeText(href).then(() => {
    const label = btn.querySelector('span') || btn;
    const before = label.textContent;
    label.textContent = t('card.copied');
    setTimeout(() => { label.textContent = before; }, 2000);
  });
}

// Mobile card details sheet. opts: { who, url, onFull }.
function openCardSheet(card, opts) {
  const sheet = document.getElementById('card-sheet');
  if (!sheet) return;
  window.umami?.track('card-details', { card: card.imageName });
  sheet.setAttribute('aria-labelledby', 'details-title-sheet');
  sheet.innerHTML = `<div class="sheet-body">${cardDetailsHTML(card, opts.who, 'sheet')}</div>`;
  sheet.onclick = e => {
    if (e.target === sheet) return sheet.close(); // scrim tap
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') sheet.close();
    if (act === 'copy') copyCardLink(e.target.closest('button'), cardHref(card, opts.url));
    if (act === 'full') { sheet.close(); opts.onFull?.(); }
  };
  sheet.showModal();
}

// Viewer. opts: { list, index, who(card), url(card), back, group, onClose(card) }.
let vw = null; // { el, opts, index }

function buildViewer(el) {
  el.innerHTML = `<div class="vw">
    <div class="vw-top">
      <button type="button" class="vw-chip vw-back" data-act="close">${ICON.prev}<span class="vw-back-label"></span></button>
      <p class="vw-pos"></p>
      <button type="button" class="vw-chip vw-copy" data-act="copy">${ICON.link}<span>${escapeHtml(t('viewer.copy'))}</span></button>
      <button type="button" class="vw-round vw-share" data-act="share" aria-label="${escapeHtml(t('viewer.share'))}">${ICON.share}</button>
      <button type="button" class="vw-round vw-close" data-act="close" aria-label="${escapeHtml(t('viewer.close'))}">${ICON.close}</button>
    </div>
    <div class="vw-main">
      <div class="vw-stage">
        <button type="button" class="vw-round vw-nav" data-step="-1" aria-label="${escapeHtml(t('viewer.prev'))}">${ICON.prev}</button>
        <img class="vw-img" alt="" width="480" height="671" draggable="false">
        <button type="button" class="vw-round vw-nav" data-step="1" aria-label="${escapeHtml(t('viewer.next'))}">${ICON.next}</button>
      </div>
      <div class="vw-info"></div>
    </div>
    <div class="vw-bottom">
      <button type="button" class="vw-round vw-nav" data-step="-1" aria-label="${escapeHtml(t('viewer.prev'))}">${ICON.prev}</button>
      <button type="button" class="btn btn-solid vw-details" data-act="details">${escapeHtml(t('card.details'))}</button>
      <button type="button" class="vw-round vw-nav" data-step="1" aria-label="${escapeHtml(t('viewer.next'))}">${ICON.next}</button>
    </div>
    <nav class="vw-strip" aria-label="${escapeHtml(t('viewer.strip'))}"></nav>
  </div>`;

  el.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const card = vw.opts.list[vw.index];
    const url = vw.opts.url?.(card);
    if (btn.dataset.step) return showCard(vw.index + Number(btn.dataset.step));
    if (btn.dataset.goto) return showCard(Number(btn.dataset.goto), true);
    const act = btn.dataset.act;
    if (act === 'close') el.close();
    if (act === 'copy') copyCardLink(btn, cardHref(card, url));
    if (act === 'share') {
      if (navigator.share) navigator.share({ url: cardHref(card, url), title: document.title }).catch(() => {});
      else copyCardLink(btn, cardHref(card, url));
    }
    if (act === 'details') openCardSheet(card, { who: vw.opts.who?.(card), url });
  });

  el.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (document.getElementById('card-sheet')?.open) return;
    e.preventDefault();
    showCard(vw.index + (e.key === 'ArrowLeft' ? -1 : 1));
  });

  // Swipe left / right on the image (touch-action: pan-y keeps vertical scroll).
  let x0 = null, y0 = 0;
  const stage = el.querySelector('.vw-stage');
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; });
  stage.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showCard(vw.index + (dx < 0 ? 1 : -1));
  });

  el.addEventListener('close', () => {
    el.querySelector('.vw-img').removeAttribute('src');
    vw.opts.onClose?.(vw.opts.list[vw.index]);
  });
}

// Renders card `i` (wraps around at both ends). `fromStrip` moves focus to the
// new current thumbnail, since the strip is re-rendered.
function showCard(i, fromStrip = false) {
  const { el, opts } = vw;
  const n = opts.list.length;
  vw.index = (i + n) % n;
  const card = opts.list[vw.index];
  const who = opts.who?.(card) || '';
  const pos = t('viewer.pos').replace('{i}', `<span class="mono">${vw.index + 1}</span>`).replace('{n}', n);
  const tag = escapeHtml(exclusivityTag(card));

  el.setAttribute('aria-label', t('viewer.label').replace('{name}', cardAlt(card, who)));
  el.querySelector('.vw-back-label').textContent = opts.back || '';
  el.querySelector('.vw-pos').innerHTML = `<span class="vw-pos-d">${opts.group ? `${escapeHtml(opts.group)} · ` : ''}${pos}</span>`
    + `<span class="vw-pos-m"><span class="mono">${vw.index + 1}</span> / ${n} · ${tag}</span>`;
  const img = el.querySelector('.vw-img');
  img.src = `/cards/${card.imageName}.avif`;
  img.alt = cardAlt(card, who);
  el.querySelectorAll('.vw-nav, .vw-strip').forEach(b => { b.hidden = n < 2; });

  const [price] = marketPrices(card);
  const hint = t('viewer.hint').replace('{prev}', '<kbd>←</kbd>').replace('{next}', '<kbd>→</kbd>').replace('{esc}', '<kbd>Esc</kbd>');
  el.querySelector('.vw-info').innerHTML = `
    <div class="vw-id">
      <span class="tag">${tag}</span>
      <h2 class="vw-title">${escapeHtml(cardTitle(card))}</h2>
      <p class="vw-sub">${escapeHtml([who, card.releaseProduct ? card.name : card.series].filter(Boolean).join(' · '))}</p>
      <p class="vw-meta mono">${escapeHtml([card.setNumber, cardYear(card), card.artist].filter(Boolean).join(' · '))}</p>
    </div>
    ${cardFacts(card, { viewer: true })}
    ${price ? `<div class="vw-price"><span>${escapeHtml(card.pricesDate ? t('viewer.asOf').replace('{market}', price.name).replace('{date}', fmtDate(card.pricesDate, 'medium')) : price.name)}</span>
      <strong>${escapeHtml(price.amount)}</strong></div>
    ${price.url ? `<a class="btn btn-solid vw-market" href="${escapeHtml(price.url)}" target="_blank" rel="noopener">${escapeHtml(t('viewer.open').replace('{market}', price.name))} <span aria-hidden="true">↗</span></a>` : ''}` : ''}
    <p class="vw-hint">${hint}</p>`;

  const from = Math.max(0, Math.min(vw.index - (STRIP_SIZE >> 1), n - STRIP_SIZE));
  const strip = el.querySelector('.vw-strip');
  strip.innerHTML = opts.list.slice(from, from + STRIP_SIZE).map((c, k) => {
    const j = from + k;
    return `<button type="button" data-goto="${j}"${j === vw.index ? ' aria-current="true"' : ''} aria-label="${escapeHtml(`${j + 1}. ${cardAlt(c, opts.who?.(c))}`)}"><img src="/cards/thumbs/${c.imageName}.avif" alt="" width="56" height="78"></button>`;
  }).join('');
  if (fromStrip) strip.querySelector('[aria-current]')?.focus();

  // Warm the neighbours so browsing feels instant.
  [-1, 1].forEach(d => { if (n > 1) new Image().src = `/cards/${opts.list[(vw.index + d + n) % n].imageName}.avif`; });
}

function openCardViewer(opts) {
  const el = document.getElementById('viewer');
  if (!el || !opts.list.length) return;
  if (!vw) { vw = { el }; buildViewer(el); }
  vw.opts = opts;
  window.umami?.track('card-view', { card: opts.list[opts.index].imageName });
  showCard(opts.index);
  el.showModal();
}

// Cards of the same group as `item` (its section), in page order.
function domGroupList(item) {
  const scope = item.closest('.card-group, .tr-group') || document;
  return [...scope.querySelectorAll('.card-item')].map(el => pageCards.get(el.id)).filter(Boolean);
}

// All cards grid: the .card-zoom button opens the viewer.
// resolve(item) returns the viewer options for that card.
function initCardViewer(root, resolve) {
  root?.addEventListener('click', e => {
    const item = e.target.closest('.card-zoom')?.closest('.card-item');
    const opts = item && resolve(item);
    if (opts) openCardViewer(opts);
  });
}
