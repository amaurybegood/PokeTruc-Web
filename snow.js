// Winter snow, 1 Nov – end of Feb: flakes fall over the page and settle a little on
// top of the hero panel, Pokémon tiles and card images; hovering a pile with
// the mouse shakes it off. The header snowflake button turns it off
// (remembered per browser). ?snow=1 forces it on outside the season, ?snow=0 off.
// Depends on i18n.js (t).
(() => {
  const now = new Date();
  const param = new URLSearchParams(location.search).get('snow');
  const m = now.getMonth();
  const season = m >= 10 || m <= 1; // November to the end of February
  if (param === '0' || (!season && param !== '1')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const LEDGES = '.hero-panel, .pk-tile, .card-open img, .card-zoom img, .news-item img';
  const COL = 3;   // px per pile column
  const MAX = 12;  // px, tallest pile
  const GROW = 0.45; // pile height added per landed flake, per px of flake radius

  const read = () => { try { return localStorage.getItem('snow'); } catch { return null; } };
  const save = v => { try { localStorage.setItem('snow', v); } catch {} };
  let on = param === '1' || read() !== 'off';

  const canvas = document.createElement('canvas');
  canvas.className = 'snow';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const flakes = [];
  const bits = []; // snow shaken off a pile

  const flake = (f = {}, top = true) => {
    const r = 0.9 + Math.random() * 2.2;
    return Object.assign(f, {
      x: Math.random() * W, y: top ? -8 : Math.random() * H, r,
      vy: 20 + r * 14 + Math.random() * 12, phase: Math.random() * 6.3, sway: 6 + Math.random() * 16,
    });
  };
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const n = Math.min(140, Math.round(W * H / 11000));
    while (flakes.length < n) flakes.push(flake({}, false));
    flakes.length = n;
  }

  // Piles live on the element (WeakMap), so snow is still there when you scroll back.
  const piles = new WeakMap();
  const visible = new Set();
  const io = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))));
  const scan = () => document.querySelectorAll(LEDGES).forEach(el => io.observe(el));

  // Taller in the middle, down to 0 over the rounded corners.
  const cap = (p, i) => MAX * Math.min(1, (Math.min(i, p.h.length - 1 - i) * COL + 1) / Math.max(4, p.r));
  function pileOf(el, w) {
    const n = Math.max(2, Math.round(w / COL));
    let p = piles.get(el);
    if (!p || p.h.length !== n) {
      // Seed an uneven thin layer, as if it had been snowing for a while.
      p = { h: new Float32Array(n), r: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
      const a = Math.random() * 6, b = Math.random() * 6;
      for (let i = 0; i < n; i++) p.h[i] = cap(p, i) * (0.5 + 0.15 * Math.sin(i * 0.21 + a) + 0.1 * Math.sin(i * 0.53 + b));
      piles.set(el, p);
    }
    return p;
  }
  function deposit(p, i, r) {
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j >= 0 && j < p.h.length) p.h[j] = Math.min(cap(p, j), p.h[j] + r * GROW * (1 - Math.abs(k) / 3));
    }
  }

  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => {
    const th = document.documentElement.dataset.theme;
    return th === 'dark' || (th !== 'light' && mqDark.matches);
  };

  let raf = 0, last = 0;
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    const dark = isDark();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const ledges = [];
    visible.forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width > 12 && b.bottom > 0 && b.top < H) ledges.push([b, pileOf(el, b.width)]);
    });

    // Falling flakes: a flake crossing a pile line lands on it (most of the time).
    ctx.fillStyle = dark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(150, 174, 202, 0.75)';
    ctx.beginPath();
    for (const f of flakes) {
      const y0 = f.y;
      f.y += f.vy * dt;
      f.phase += dt;
      const x = f.x + Math.sin(f.phase) * f.sway;
      if (f.y > H + 8) { flake(f); continue; }
      let landed = false;
      for (const [b, p] of ledges) {
        if (x < b.left || x >= b.right) continue;
        const i = Math.min(p.h.length - 1, ((x - b.left) / b.width * p.h.length) | 0);
        const line = b.top - p.h[i];
        if (y0 < line && f.y >= line) {
          if (Math.random() < 0.6) { deposit(p, i, f.r); landed = true; }
          break;
        }
      }
      if (landed) { flake(f); continue; }
      ctx.moveTo(x + f.r, f.y);
      ctx.arc(x, f.y, f.r, 0, 6.2832);
    }
    for (let k = bits.length - 1; k >= 0; k--) {
      const s = bits[k];
      s.vy += 700 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > H + 8) { bits.splice(k, 1); continue; }
      ctx.moveTo(s.x + s.r, s.y);
      ctx.arc(s.x, s.y, s.r, 0, 6.2832);
    }
    ctx.fill();

    // Piles: white caps; in light mode a cool outline keeps them readable on white tiles.
    ctx.fillStyle = dark ? '#F2F5FA' : '#FFFFFF';
    ctx.strokeStyle = 'rgba(110, 136, 168, 0.6)';
    ctx.lineWidth = 1;
    // A soft cool shadow under the cap gives it volume on light surfaces.
    ctx.shadowColor = dark ? 'transparent' : 'rgba(70, 95, 130, 0.22)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 1.5;
    for (const [b, p] of ledges) {
      const n = p.h.length, step = b.width / n;
      ctx.beginPath();
      ctx.moveTo(b.left, b.top + 1);
      for (let i = 0; i < n; i++) ctx.lineTo(b.left + (i + 0.5) * step, b.top + 1 - p.h[i]);
      ctx.lineTo(b.right, b.top + 1);
      ctx.fill();
      if (!dark) ctx.stroke();
    }
    ctx.shadowColor = 'transparent';
  }

  // Mouse over a pile: it falls off.
  document.addEventListener('pointerover', e => {
    if (!on || e.pointerType !== 'mouse') return;
    const el = e.target.closest?.(LEDGES);
    const p = el && piles.get(el);
    if (!p) return;
    const b = el.getBoundingClientRect(), step = b.width / p.h.length;
    for (let i = 0; i < p.h.length && bits.length < 400; i += 2) {
      if (p.h[i] < 1) continue;
      bits.push({ x: b.left + i * step, y: b.top - p.h[i] / 2, r: 0.8 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 70 });
    }
    p.h.fill(0);
  });

  function start() {
    if (raf || !on || document.hidden) return;
    canvas.hidden = false;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // Header toggle, next to the theme button (desktop) and the search button (mobile).
  const arm = a => {
    const c = Math.cos(a), s = Math.sin(a);
    const pt = (r, o) => `${(12 + r * c - o * s).toFixed(1)} ${(12 + r * s + o * c).toFixed(1)}`;
    return `M12 12L${pt(10, 0)}M${pt(6, -3)}L${pt(8.5, 0)}L${pt(6, 3)}`;
  };
  const icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${[0, 1, 2, 3, 4, 5].map(k => arm(Math.PI / 2 + k * Math.PI / 3)).join('')}"/></svg>`;
  const label = t('snow.toggle');
  const buttons = ['#theme-toggle', '#search-toggle'].map(sel => document.querySelector(sel)).filter(Boolean).map(ref => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn snow-toggle';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = icon;
    ref.before(b);
    b.addEventListener('click', () => {
      on = !on;
      save(on ? 'on' : 'off');
      sync();
    });
    return b;
  });
  function sync() {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(on)));
    if (on) start();
    else { stop(); canvas.hidden = true; }
  }

  resize();
  scan();
  setInterval(scan, 2000); // ponytail: periodic rescan picks up grids rendered later (infinite scroll); a MutationObserver if it ever lags
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  sync();
})();
