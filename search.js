// Header search (DESIGN_HANDOFF 4.5): grouped results (Pokémon, artists, sets,
// cards) in a dropdown on desktop and a full-screen panel on mobile, using the
// combobox pattern (arrow keys move aria-activedescendant, Enter opens, Esc
// closes). Data is fetched on first focus. Depends on i18n.js (t, pokemonName,
// langPathPrefix, exclusivityTag, cardYear) and viewer.js (escapeHtml).
(function () {
  const form = document.getElementById('site-search');
  const input = document.getElementById('search');
  if (!form || !input) return;
  const header = form.closest('.site-header');
  const panel = document.getElementById('search-panel');
  const list = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const foot = panel.querySelector('.search-foot');
  const scrim = document.getElementById('search-scrim');
  const clearBtn = document.getElementById('search-clear');
  const toggle = document.getElementById('search-toggle');
  const MOBILE = matchMedia('(max-width: 859px)');
  const LIMIT = { pokemon: 3, artist: 3, set: 3, card: 5 };
  const prefix = langPathPrefix();

  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = s => s.toLowerCase().replace(/♀/g, 'f').replace(/♂/g, 'm').replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const release = c => c.releaseDate || String(c.year);
  const span = (a, b) => (a === b ? `${a}` : `${a}–${b}`);
  const countCards = n => (n === 1 ? t('tile.card') : t('tile.cards').replace('{n}', n));
  const initials = s => s.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  // A query is worth searching from 2 characters, or 1 non-Latin one (ピ, 皮…).
  const ready = q => q.length >= 2 || /[^\x00-\x7f]/.test(q);

  let data = null;
  let loading = null;
  let active = -1;

  // Pokémon (with cards), card list (Pokémon + Trainers) and the artist / set
  // aggregates shown in the dropdown, built once.
  function load() {
    if (loading) return loading;
    const v = window.DATA_V ? `?v=${window.DATA_V}` : '';
    const get = f => fetch(`/data/${f}${v}`).then(r => (r.ok ? r.json() : [])).catch(() => []);
    loading = Promise.all([get('pokemons.json'), get('pokemon_cards.json'), get('trainer_cards.json')])
      .then(([pokemons, cards, trainers]) => {
        const byId = new Map(pokemons.map(p => [p.id, p]));
        const all = [
          ...cards.map(c => {
            const p = byId.get(c.pokemonId);
            return { ...c, who: p ? pokemonName(p) : '', pokemon: c.pokemonId, href: p ? `${prefix}pokemon/${slug(p.name.en)}/#${c.imageName}` : '' };
          }),
          ...trainers.map(c => {
            const m = c.title.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
            return { ...c, who: m ? m[1] : c.title, setNumber: c.setNumber || (m && m[2]), href: `${prefix}trainers/#${c.imageName}` };
          }),
        ].sort((a, b) => release(b).localeCompare(release(a)));

        const agg = key => {
          const map = new Map();
          for (const c of all) {
            const k = c[key];
            if (!k) continue;
            const a = map.get(k) || { name: k, n: 0, pokemon: new Set(), min: Infinity, max: -Infinity };
            a.n++;
            if (c.pokemon) a.pokemon.add(c.pokemon);
            a.min = Math.min(a.min, cardYear(c));
            a.max = Math.max(a.max, cardYear(c));
            map.set(k, a);
          }
          return [...map.values()].sort((a, b) => b.n - a.n);
        };
        const counts = {};
        for (const c of cards) counts[c.pokemonId] = (counts[c.pokemonId] || 0) + 1;
        data = {
          cards: all,
          artists: agg('artist'),
          sets: agg('name'),
          pokemons: pokemons.filter(p => counts[p.id]).map(p => ({ ...p, n: counts[p.id] })).sort((a, b) => a.id - b.id),
        };
      });
    return loading;
  }

  // Escaped text with the matched part wrapped in <mark> (accent-insensitive).
  function mark(text, n) {
    let flat = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const c = norm(text[i]);
      for (let k = 0; k < c.length; k++) map.push(i);
      flat += c;
    }
    const at = n ? flat.indexOf(n) : -1;
    if (at < 0) return escapeHtml(text);
    const s = map[at], e = map[at + n.length - 1] + 1;
    return `${escapeHtml(text.slice(0, s))}<mark>${escapeHtml(text.slice(s, e))}</mark>${escapeHtml(text.slice(e))}`;
  }

  function render(q) {
    const n = norm(q);
    const has = s => s != null && norm(s).includes(n);
    const num = n.replace(/^#?0*/, '');
    const pokemon = data.pokemons.filter(p => Object.values(p.name).some(has) || String(p.id) === num);
    const artists = data.artists.filter(a => has(a.name));
    const sets = data.sets.filter(s => has(s.name));
    const cards = data.cards.filter(c => has(c.who) || has(c.name) || has(c.artist) || has(c.setNumber) || has(c.releaseProduct));
    const all = `${prefix}?q=${encodeURIComponent(q)}&amp;view=cards`;
    let i = 0;
    const opt = (href, body) => `<a class="search-opt" role="option" id="search-opt-${i++}" href="${href}" aria-selected="false" tabindex="-1">${body}</a>`;
    const group = (key, items, row) => items.length
      ? `<div class="search-group" role="group" aria-labelledby="search-g-${key}"><p class="search-group-label" id="search-g-${key}">${escapeHtml(t('search.' + key))}</p>${items.slice(0, LIMIT[key]).map(row).join('')}</div>`
      : '';

    list.setAttribute('aria-label', t('search.results').replace('{q}', q));
    list.innerHTML = [
      group('pokemon', pokemon, p => opt(`${prefix}pokemon/${slug(p.name.en)}/`,
        `<img class="search-sprite" src="/monsters/${p.imageName}.webp" alt="" width="44" height="44">
        <span class="search-main"><span class="search-name">${mark(pokemonName(p), n)}</span>
        <span class="search-meta">#${String(p.id).padStart(3, '0')} · ${escapeHtml(countCards(p.n))}</span></span>`)),
      group('artist', artists, a => opt(`${prefix}?q=${encodeURIComponent(a.name)}&amp;view=cards`,
        `<span class="search-avatar" aria-hidden="true">${escapeHtml(initials(a.name))}</span>
        <span class="search-main"><span class="search-name">${mark(a.name, n)}</span>
        <span class="search-meta">${escapeHtml([countCards(a.n), a.pokemon.size && t('search.pokemonCount').replace('{n}', a.pokemon.size), span(a.min, a.max)].filter(Boolean).join(' · '))}</span></span>`)),
      group('set', sets, s => opt(`${prefix}?q=${encodeURIComponent(s.name)}&amp;view=cards`,
        `<span class="search-avatar search-avatar-set" aria-hidden="true">${escapeHtml(initials(s.name))}</span>
        <span class="search-main"><span class="search-name">${mark(s.name, n)}</span>
        <span class="search-meta">${escapeHtml(`${countCards(s.n)} · ${span(s.min, s.max)}`)}</span></span>`)),
      group('card', cards, c => opt(c.href,
        `<img class="search-thumb" src="/cards/thumbs/${c.imageName}.avif" alt="" width="44" height="61">
        <span class="search-main"><span class="search-name">${mark(c.who, n)}</span>
        <span class="search-sub">${mark(c.releaseProduct || c.name, n)}</span>
        <span class="search-code">${escapeHtml([c.setNumber, cardYear(c)].filter(Boolean).join(' · '))}</span></span>
        <span class="tag">${escapeHtml(exclusivityTag(c))}</span>`)),
    ].join('') || `<p class="search-empty">${escapeHtml(t('search.none').replace('{q}', q))}</p>`;

    const kbd = k => `<kbd>${k}</kbd>`;
    foot.innerHTML = (cards.length ? `<a class="search-all" href="${all}">${escapeHtml(t('search.seeAll').replace('{n}', cards.length).replace('{q}', q))}</a>` : '<span></span>')
      + `<span class="search-keys" aria-hidden="true"><span>${kbd('↑↓')} ${escapeHtml(t('search.navigate'))}</span><span>${kbd('↵')} ${escapeHtml(t('search.open'))}</span><span>${kbd('Esc')} ${escapeHtml(t('search.close'))}</span></span>`;
    status.textContent = t('search.count').replace('{n}', i);
    active = -1;
    input.removeAttribute('aria-activedescendant');
  }

  function open() {
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    scrim.hidden = MOBILE.matches;
  }

  function close() {
    panel.hidden = true;
    scrim.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  async function update() {
    const q = input.value.trim();
    clearBtn.hidden = !input.value;
    if (!ready(q)) return close();
    await load();
    if (input.value.trim() !== q) return; // a newer keystroke took over
    render(q);
    open();
  }

  function setActive(i) {
    const opts = [...list.querySelectorAll('[role="option"]')];
    if (!opts.length) return;
    active = (i + opts.length) % opts.length;
    opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  }

  // Mobile: the form becomes a full-screen modal dialog over the page.
  function setModal(on) {
    header.classList.toggle('search-open', on);
    toggle?.setAttribute('aria-expanded', String(on));
    if (on) { form.setAttribute('role', 'dialog'); form.setAttribute('aria-modal', 'true'); }
    else { form.setAttribute('role', 'search'); form.removeAttribute('aria-modal'); }
    for (const el of document.body.children) if (el !== header && el.tagName !== 'SCRIPT') el.inert = on;
    for (const el of header.children) if (el !== form) el.inert = on;
  }
  const openMobile = () => { setModal(true); input.focus(); update(); };
  const closeMobile = () => { close(); setModal(false); toggle?.focus(); };

  input.addEventListener('input', update);
  input.addEventListener('focus', () => { load(); update(); });
  input.addEventListener('keydown', e => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !panel.hidden) {
      e.preventDefault();
      setActive(active + (e.key === 'ArrowDown' ? 1 : active < 0 ? 0 : -1));
    } else if (e.key === 'Enter') {
      if (active >= 0 && !panel.hidden) {
        e.preventDefault();
        list.querySelectorAll('[role="option"]')[active].click();
      } else {
        // Plain submit: the home page filters in place, other pages load it.
        close();
        if (header.classList.contains('search-open')) setModal(false);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      // First Esc closes the list; the browser only clears the field on the next one.
      if (!panel.hidden && !MOBILE.matches) { e.preventDefault(); close(); }
      else if (header.classList.contains('search-open')) closeMobile();
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  toggle?.addEventListener('click', openMobile);
  document.getElementById('search-cancel')?.addEventListener('click', closeMobile);
  scrim.addEventListener('click', close);
  // Clicking an option must not blur the field first (the dropdown would close).
  panel.addEventListener('mousedown', e => { if (e.target.closest('[role="option"]')) e.preventDefault(); });
  form.addEventListener('focusout', e => { if (!MOBILE.matches && !form.contains(e.relatedTarget)) close(); });

  // "/" focuses the search, unless the user is already typing somewhere.
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    e.preventDefault();
    if (MOBILE.matches) openMobile();
    else input.focus();
  });
})();
