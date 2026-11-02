// Takı Atölyesi: müşteri ne istediğini söyler, sen boncukları dizersin. Zincir fizikle sallanır,
// her taş kendi notasını çalar. İstekler bir bulmaca: ayna gibi, ortada inci, yan yana aynı olmasın...

import { Life, html, toHTML, fitCanvas, seeded, clamp } from '../core/dom.js';
import { sfx, buzz } from '../core/audio.js';
import { makeFx, inked, starPath, confetti } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, icon } from '../core/ui.js';
import { customer, setMood } from '../core/avatar.js';
import { ART } from '../art.js';

const BEADS = [
  { id: 'inci', name: 'İnci', c: '#fff8ee', d: '#d9c9b0', note: 72, shape: 'round' },
  { id: 'yakut', name: 'Yakut', c: '#ff3d5c', d: '#a8122e', note: 76, shape: 'diamond' },
  { id: 'safir', name: 'Safir', c: '#3d8bff', d: '#1a4fb0', note: 79, shape: 'hex' },
  { id: 'zumrut', name: 'Zümrüt', c: '#2ed67a', d: '#11824a', note: 81, shape: 'octa' },
  { id: 'altin', name: 'Altın', c: '#ffcd3c', d: '#c98a10', note: 84, shape: 'round' },
  { id: 'ametist', name: 'Ametist', c: '#b76bff', d: '#6a2bb0', note: 88, shape: 'drop' },
];
const LEVELS = 40;

// Taş çizimi: gölge, parlak yüz, kontur
function drawBead(g, b, x, y, r, t = 0) {
  g.save();
  g.translate(x, y);
  const path = () => {
    g.beginPath();
    if (b.shape === 'round') g.arc(0, 0, r, 0, 7);
    else if (b.shape === 'diamond') { g.moveTo(0, -r * 1.1); g.lineTo(r, 0); g.lineTo(0, r * 1.1); g.lineTo(-r, 0); g.closePath(); }
    else if (b.shape === 'hex') { for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05); } g.closePath(); }
    else if (b.shape === 'octa') { for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; g.lineTo(Math.cos(a) * r * 1.03, Math.sin(a) * r * 1.03); } g.closePath(); }
    else { g.moveTo(0, -r * 1.2); g.bezierCurveTo(r * 1.1, -r * 0.2, r * 0.9, r, 0, r); g.bezierCurveTo(-r * 0.9, r, -r * 1.1, -r * 0.2, 0, -r * 1.2); g.closePath(); }
  };
  path();
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.28, b.c);
  gr.addColorStop(1, b.d);
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = Math.max(1.6, r * 0.13);
  g.strokeStyle = '#2a1636';
  g.stroke();
  if (b.shape !== 'round') {
    // Kesim çizgileri
    g.globalAlpha = 0.35;
    g.lineWidth = Math.max(1, r * 0.06);
    g.strokeStyle = '#fff';
    g.beginPath();
    g.moveTo(-r * 0.5, -r * 0.15);
    g.lineTo(0, -r * 0.55);
    g.lineTo(r * 0.5, -r * 0.15);
    g.lineTo(0, r * 0.55);
    g.closePath();
    g.stroke();
    g.globalAlpha = 1;
  }
  // Işıltı
  const tw = Math.max(0, Math.sin(t / 700 + x * 0.3));
  if (tw > 0.85) {
    g.fillStyle = '#fff';
    starPath(g, r * 0.4, -r * 0.45, r * 0.34 * (tw - 0.85) * 6.6, 4, 0.2);
    g.fill();
  }
  g.restore();
}

// Arayüz için taş resmi
const beadImg = (() => {
  const cache = {};
  return (b) => {
    if (cache[b.id]) return cache[b.id];
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    drawBead(c.getContext('2d'), b, 48, 48, 34);
    cache[b.id] = c.toDataURL();
    return cache[b.id];
  };
})();
const beadTag = (i, cls = '') => html`<img class="bd ${cls}" src="${beadImg(BEADS[i])}" alt="${BEADS[i].name}">`;

/* ---------- Kurallar ---------- */

const RULES = {
  mirror: {
    test(seq) {
      let open = false;
      for (let k = 0; k < seq.length / 2; k++) {
        const a = seq[k];
        const b = seq[seq.length - 1 - k];
        if (a == null || b == null) open = true;
        else if (a !== b) return 'bad';
      }
      return open ? 'open' : 'ok';
    },
    chip: () => html`<i class="ri ri-mirror"></i>Ayna gibi`,
  },
  center: {
    test(seq, r) {
      const v = seq[(seq.length - 1) / 2];
      return v == null ? 'open' : v === r.a ? 'ok' : 'bad';
    },
    chip: (r) => html`${beadTag(r.a)}Ortada`,
  },
  ends: {
    test(seq, r) {
      const x = seq[0];
      const y = seq[seq.length - 1];
      if ((x != null && x !== r.a) || (y != null && y !== r.a)) return 'bad';
      return x == null || y == null ? 'open' : 'ok';
    },
    chip: (r) => html`${beadTag(r.a)}İki uçta`,
  },
  noAdj: {
    test(seq) {
      let open = false;
      for (let k = 0; k < seq.length; k++) {
        if (seq[k] == null) open = true;
        if (k && seq[k] != null && seq[k] === seq[k - 1]) return 'bad';
      }
      return open ? 'open' : 'ok';
    },
    chip: () => html`<i class="ri ri-noadj"></i>Yan yana aynı olmaz`,
  },
  near: {
    test(seq, r) {
      let open = false;
      for (let k = 0; k < seq.length; k++) {
        if (seq[k] !== r.a) {
          if (seq[k] == null) open = true;
          continue;
        }
        const L = seq[k - 1];
        const R = seq[k + 1];
        if (L === r.b || R === r.b) continue;
        const canL = k > 0 && L == null;
        const canR = k < seq.length - 1 && R == null;
        if (!canL && !canR) return 'bad';
        open = true;
      }
      return open ? 'open' : 'ok';
    },
    chip: (r) => html`${beadTag(r.a)}<i class="ri-link"></i>${beadTag(r.b)}Yan yana`,
  },
  pos: {
    test(seq, r) {
      const v = seq[r.i];
      return v == null ? 'open' : v === r.a ? 'ok' : 'bad';
    },
    chip: (r) => html`${beadTag(r.a)}Soldan ${r.i + 1}.`,
  },
  order: {
    test(seq, r) {
      let lastA = -1;
      let firstB = 99;
      seq.forEach((v, k) => {
        if (v === r.a) lastA = Math.max(lastA, k);
        if (v === r.b) firstB = Math.min(firstB, k);
      });
      if (lastA > firstB) return 'bad';
      return seq.includes(null) ? 'open' : 'ok';
    },
    chip: (r) => html`${beadTag(r.a)}<i class="ri-arrow"></i>${beadTag(r.b)}Önce, sonra`,
  },
};

function evalRules(rules, seq) {
  return rules.map((r) => RULES[r.type].test(seq, r));
}

// Çözümden kurallar üret; rastgele dizilimlerin çoğu sağlamasın diye gerekirse kural ekle
function makePuzzle(seed, level) {
  const r = seeded(seed);
  const types = ['kolye', 'bileklik', 'kupe'];
  const kind = level < 2 ? 'kolye' : types[seed % 3];
  const n = kind === 'kupe' ? Math.min(6, 3 + Math.floor(level / 8)) : Math.min(11, 5 + Math.floor(level / 4));
  const colors = Math.min(6, Math.max(2, 2 + Math.floor(level / 5)), n - 1);
  const pal = r.shuffle([0, 1, 2, 3, 4, 5]).slice(0, Math.max(2, colors));
  const wantMirror = kind !== 'kupe' && (level < 3 || r() < 0.4);
  const sol = Array(n).fill(0);
  if (wantMirror) {
    for (let k = 0; k < Math.ceil(n / 2); k++) {
      const v = r.pick(pal);
      sol[k] = v;
      sol[n - 1 - k] = v;
    }
  } else {
    for (let k = 0; k < n; k++) sol[k] = r.pick(pal);
  }
  // Her renk en az bir kere geçsin
  pal.forEach((c, i) => {
    if (!sol.includes(c)) {
      const k = i % Math.ceil(n / 2);
      sol[k] = c;
      if (wantMirror) sol[n - 1 - k] = c;
    }
  });
  const pool = [];
  const isMirror = sol.every((v, k) => v === sol[n - 1 - k]);
  const noAdj = sol.every((v, k) => !k || v !== sol[k - 1]);
  if (isMirror) pool.push({ type: 'mirror' });
  if (n % 2) pool.push({ type: 'center', a: sol[(n - 1) / 2] });
  if (sol[0] === sol[n - 1]) pool.push({ type: 'ends', a: sol[0] });
  if (noAdj) pool.push({ type: 'noAdj' });
  pal.forEach((a) => pal.forEach((b) => {
    if (a === b) return;
    let ok = sol.includes(a);
    sol.forEach((v, k) => { if (v === a && sol[k - 1] !== b && sol[k + 1] !== b) ok = false; });
    if (ok) pool.push({ type: 'near', a, b });
    if (Math.max(...sol.map((v, k) => (v === a ? k : -1))) < Math.min(...sol.map((v, k) => (v === b ? k : 99)))) pool.push({ type: 'order', a, b });
  }));
  for (let k = 0; k < n; k++) pool.push({ type: 'pos', i: k, a: sol[k] });
  r.shuffle(pool);
  // Önce yapısal kurallar öne gelsin
  pool.sort((x, y) => (x.type === 'pos' ? 1 : 0) - (y.type === 'pos' ? 1 : 0));
  const rules = [];
  const inv = {};
  sol.forEach((v) => { inv[v] = (inv[v] || 0) + 1; });
  const bag = sol.slice();
  const passRate = (rs) => {
    let pass = 0;
    const R = seeded(seed + 99);
    for (let k = 0; k < 160; k++) {
      const s = R.shuffle(bag.slice());
      if (evalRules(rs, s).every((v) => v === 'ok')) pass++;
    }
    return pass / 160;
  };
  const target = level < 3 ? 0.3 : level < 10 ? 0.14 : 0.05;
  for (const c of pool) {
    if (rules.length >= 5) break;
    const before = passRate(rules);
    if (rules.length && before <= target) break;
    const after = passRate([...rules, c]);
    if (after < before || !rules.length) rules.push(c);
  }
  return { kind, n, sol, rules, inv, pal };
}

const PEOPLE = ['Annesine hediye alıyor', 'Düğüne gidecek', 'Mezuniyet için', 'Kendine sürpriz', 'Yıldönümü hediyesi', 'İlk maaşıyla', 'Sahne için', 'Arkadaşına doğum günü'];

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], made: 0, box: [] });
  const f = api.frame({ onBack: () => api.exit() });
  let local = null;
  let st = null;
  const end = () => {
    if (local) local.dispose();
    local = null;
    st = null;
  };

  function menu() {
    end();
    f.onBack = () => api.exit();
    f.setTitle(api.game.title);
    menuScreen(f.main, api.game, {
      art: ART.taki,
      sub: 'Müşteri kuralları söyler, sen taşları dizersin. Yaptığın her takı mücevher kutuna girer.',
      stats: [['Yapılan Takı', data.made]],
      how: [
        'Alttaki taşa dokun: sıradaki boş yere dizilir. Bir yere dokunup seçebilir, dizili taşa dokunup geri alabilirsin.',
        'Üstteki istek kartları kurallardır. Uyan kart yeşil yanar, bozulan kart kırmızı olur.',
        'Bütün taşlar dizilip bütün kartlar yeşil olunca takı hazır. Az hamleyle bitirirsen bahşiş artar.',
      ],
      extra: data.box.length ? html`<div class="tk-box"><b>Mücevher Kutusu</b><div>${data.box.slice(-14).map((seq) => html`<span class="tk-mini">${seq.map((i) => beadTag(i))}</span>`)}</div></div>` : '',
      levels: { total: LEVELS, stars: data.stars, title: 'Siparişler', onPick: (i) => play(i) },
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const custCount = li < 4 ? 1 : li < 16 ? 2 : 3;
    f.setTitle(`${li + 1}. Sipariş`);
    f.main.innerHTML = toHTML(html`
      <div class="tk">
        <div class="tk-top"><div class="tk-cust" data-cust></div><div class="tk-req"><span class="tk-who" data-who></span><div class="tk-rules" data-rules></div></div></div>
        <canvas class="tk-cv"></canvas>
        <div class="tk-bottom"><div class="tk-pal" data-pal></div><div class="tk-acts"><button class="btn btn-small" data-undo>${icon('replay')}Geri Al</button><button class="btn btn-small" data-clear>${icon('trash')}Temizle</button><span class="tk-count" data-count></span></div></div>
      </div>`);
    const main = f.main.firstElementChild;
    const s = fitCanvas(main.querySelector('canvas'), my);
    const fx = makeFx();
    const game = { li, k: 0, count: custCount, moves: 0, scores: [], paused: false, puzzle: null, seq: [], sel: 0, nodes: [], history: [], over: false, done: 0, wait: 0 };
    st = game;
    f.onBack = () => {
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => play(li), onQuit: () => menu() });
    };

    // Zincir: düğümler ve kısıtlar (Verlet)
    const buildChain = () => {
      const { kind } = game.puzzle;
      const W = s.W;
      const H = s.H;
      const nodes = [];
      const segs = 26;
      if (kind === 'kolye') {
        const x0 = W * 0.2;
        const x1 = W * 0.8;
        const y0 = H * 0.1;
        for (let k = 0; k <= segs; k++) {
          const t = k / segs;
          nodes.push({ x: x0 + (x1 - x0) * t, y: y0 + Math.sin(t * Math.PI) * H * 0.4, px: 0, py: 0, pin: k === 0 || k === segs });
        }
        game.rest = (Math.hypot(x1 - x0, H * 0.82) * 1.0) / segs;
        game.pins = [[x0, y0], [x1, y0]];
      } else if (kind === 'bileklik') {
        const cx = W / 2;
        const cy = H * 0.5;
        const R = Math.min(W, H) * 0.36;
        for (let k = 0; k <= segs; k++) {
          const a = -Math.PI / 2 + (k / segs) * Math.PI * 2;
          nodes.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, px: 0, py: 0, pin: k === 0 || k === segs });
        }
        game.rest = (2 * Math.PI * R) / segs;
        game.pins = [[cx, cy - R]];
        game.closed = true;
      } else {
        // Küpe: iki kısa sarkaç; biri öbürünün aynısı
        const x = W * 0.3;
        const y0 = H * 0.14;
        const L = H * 0.68;
        for (let k = 0; k <= segs; k++) nodes.push({ x, y: y0 + (k / segs) * L, px: 0, py: 0, pin: k === 0 });
        game.rest = L / segs;
        game.pins = [[x, y0], [W * 0.7, y0]];
      }
      nodes.forEach((n) => { n.px = n.x; n.py = n.y; });
      game.nodes = nodes;
    };
    const slotPos = (k) => {
      const { n, kind } = game.puzzle;
      const N = game.nodes;
      const pad = kind === 'kupe' ? 0.16 : 0.14;
      const t = n === 1 ? 0.5 : pad + (k / (n - 1)) * (1 - pad * 2);
      const u = t * (N.length - 1);
      const i = Math.min(N.length - 2, Math.floor(u));
      const f2 = u - i;
      return { x: N[i].x + (N[i + 1].x - N[i].x) * f2, y: N[i].y + (N[i + 1].y - N[i].y) * f2, i };
    };
    const kick = (k, power = 7) => {
      if (!game.nodes.length) return;
      const { i } = slotPos(k);
      for (let j = Math.max(0, i - 2); j <= Math.min(game.nodes.length - 1, i + 2); j++) {
        const nd = game.nodes[j];
        if (!nd.pin) nd.py -= power * (0.5 + Math.random());
      }
    };
    const beadR = () => {
      const { n, kind } = game.puzzle;
      const base = kind === 'kupe' ? Math.min(s.W, s.H) * 0.07 : Math.min(s.W, s.H) * 0.056;
      return clamp(base * (n > 9 ? 0.82 : 1), 11, 40);
    };

    const renderReq = () => {
      const p = game.puzzle;
      const stat = evalRules(p.rules, game.seq);
      main.querySelector('[data-rules]').innerHTML = toHTML(html`${p.rules.map((r, i) => html`<span class="rule ${stat[i]}">${RULES[r.type].chip(r)}</span>`)}`);
      const used = {};
      game.seq.forEach((v) => { if (v != null) used[v] = (used[v] || 0) + 1; });
      main.querySelector('[data-pal]').innerHTML = toHTML(html`${p.pal.map((c) => {
        const left = (p.inv[c] || 0) - (used[c] || 0);
        return html`<button class="pal ${left <= 0 ? 'empty' : ''}" data-b="${c}">${beadTag(c)}<b>×${left}</b></button>`;
      })}`);
      main.querySelector('[data-count]').textContent = `Müşteri ${game.k + 1} / ${game.count}`;
    };
    const check = () => {
      const p = game.puzzle;
      const stat = evalRules(p.rules, game.seq);
      const full = !game.seq.includes(null);
      if (full && stat.every((v) => v === 'ok')) win();
      else if (full) {
        sfx.bad();
        buzz(30);
        for (let k = 0; k < p.n; k++) kick(k, 5);
      }
    };
    const startCustomer = () => {
      const seed = li * 37 + game.k * 11 + 7;
      game.puzzle = makePuzzle(seed, li);
      game.seq = Array(game.puzzle.n).fill(null);
      game.sel = 0;
      game.history = [];
      game.moves = 0;
      game.done = 0;
      game.closed = false;
      buildChain();
      const name = { kolye: 'Kolye', bileklik: 'Bileklik', kupe: 'Küpe' }[game.puzzle.kind];
      main.querySelector('[data-who]').textContent = `${name}: ${PEOPLE[seed % PEOPLE.length]}`;
      main.querySelector('[data-cust]').innerHTML = toHTML(customer(seed, { mood: 'happy' }));
      main.querySelector('[data-cust]').firstElementChild.animate([{ transform: 'translateX(-90px) rotate(-8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      renderReq();
      sfx.chime(88);
    };
    const place = (c) => {
      if (game.done || game.paused) return;
      const p = game.puzzle;
      const used = game.seq.filter((v) => v === c).length;
      if (used >= (p.inv[c] || 0)) {
        sfx.bad();
        return;
      }
      let k = game.sel;
      if (game.seq[k] != null) k = game.seq.indexOf(null);
      if (k < 0) return;
      game.history.push(game.seq.slice());
      game.seq[k] = c;
      game.moves++;
      const next = game.seq.indexOf(null, k + 1);
      game.sel = next >= 0 ? next : game.seq.indexOf(null);
      const pos = slotPos(k);
      fx.ring(pos.x, pos.y, BEADS[c].c, beadR());
      fx.burst(pos.x, pos.y, { n: 6, colors: [BEADS[c].c, '#fff'], power: 120, gravity: 200, size: [1.5, 3.5] });
      sfx.chime(BEADS[c].note);
      buzz(6);
      kick(k);
      renderReq();
      check();
    };
    my.on(main.querySelector('[data-pal]'), 'click', (e) => {
      const b = e.target.closest('[data-b]');
      if (b) place(Number(b.dataset.b));
    });
    my.on(main.querySelector('[data-undo]'), 'click', () => {
      if (game.done || !game.history.length) return;
      game.seq = game.history.pop();
      game.sel = Math.max(0, game.seq.indexOf(null));
      sfx.soft();
      renderReq();
    });
    my.on(main.querySelector('[data-clear]'), 'click', () => {
      if (game.done) return;
      game.history.push(game.seq.slice());
      game.seq = game.seq.map(() => null);
      game.sel = 0;
      sfx.whoosh();
      for (let k = 0; k < game.puzzle.n; k++) kick(k, 8);
      renderReq();
    });
    my.on(main.querySelector('canvas'), 'pointerdown', (e) => {
      if (game.done || game.paused) return;
      const rc = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rc.left;
      const y = e.clientY - rc.top;
      let best = -1;
      let bd = beadR() * 1.7;
      for (let k = 0; k < game.puzzle.n; k++) {
        const q = slotPos(k);
        const dd = Math.hypot(q.x - x, q.y - y);
        if (dd < bd) {
          bd = dd;
          best = k;
        }
        if (game.puzzle.kind === 'kupe') {
          const d2 = Math.hypot(s.W - q.x - x, q.y - y);
          if (d2 < bd) {
            bd = d2;
            best = k;
          }
        }
      }
      if (best < 0) return;
      if (game.seq[best] != null) {
        game.history.push(game.seq.slice());
        game.seq[best] = null;
        sfx.soft();
        kick(best);
        renderReq();
      } else sfx.tap();
      game.sel = best;
    });

    const win = () => {
      game.done = 1;
      const p = game.puzzle;
      const perfect = game.moves <= p.n + 1;
      const score = perfect ? 3 : game.moves <= p.n + 4 ? 2 : 1;
      game.scores.push(score);
      data.made++;
      data.box.push(game.seq.slice());
      if (data.box.length > 30) data.box.shift();
      api.touch();
      const svg = main.querySelector('[data-cust] .blob');
      setMood(svg, 'laugh', 'happy');
      sfx.fanfare();
      buzz(30);
      confetti({ n: 40, colors: ['#ffcd3c', '#fff', '#ff5fa2', '#b76bff'] });
      game.seq.forEach((v, k) => my.timeout(() => {
        const q = slotPos(k);
        sfx.chime(BEADS[v].note);
        fx.burst(q.x, q.y, { n: 12, colors: [BEADS[v].c, '#fff', '#ffe27a'], power: 240, gravity: 120, shape: 'star' });
        kick(k, 6);
      }, 100 + k * 110));
      my.timeout(() => {
        if (game.k + 1 < game.count) {
          game.k++;
          startCustomer();
        } else finish();
      }, 1100 + p.n * 110 + 600);
    };
    const finish = () => {
      game.over = true;
      const avg = game.scores.reduce((a, b) => a + b, 0) / game.scores.length;
      const stars = avg >= 2.6 ? 3 : avg >= 1.7 ? 2 : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = 10 + stars * 6 + game.count * 3;
      api.finish({ coins });
      resultSheet({
        won: true,
        title: 'Vitrin Parlıyor',
        sub: 'Hepsi mücevher kutuna girdi.',
        stars,
        coins,
        buttons: [
          ...(li + 1 < LEVELS ? [{ label: 'Sonraki Sipariş', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
          { label: 'Tekrar', icon: 'replay', act: () => play(li) },
          { label: 'Menü', icon: 'home', act: () => menu() },
        ],
      });
    };

    const physics = (dt) => {
      const N = game.nodes;
      if (!N.length) return;
      const G = 1500;
      const d2 = dt * dt;
      for (const n of N) {
        if (n.pin) continue;
        const vx = (n.x - n.px) * 0.985;
        const vy = (n.y - n.py) * 0.985;
        n.px = n.x;
        n.py = n.y;
        n.x += vx;
        n.y += vy + G * d2;
      }
      const L = game.rest;
      for (let it = 0; it < 14; it++) {
        for (let k = 1; k < N.length; k++) {
          const a = N[k - 1];
          const b = N[k];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const diff = (d - L) / d;
          const ka = a.pin ? 0 : b.pin ? 1 : 0.5;
          const kb = b.pin ? 0 : a.pin ? 1 : 0.5;
          a.x += dx * diff * ka;
          a.y += dy * diff * ka;
          b.x -= dx * diff * kb;
          b.y -= dy * diff * kb;
        }
      }
    };

    const drawChainPath = (g, mirror = false) => {
      const N = game.nodes;
      g.beginPath();
      N.forEach((n, k) => {
        const x = mirror ? s.W - n.x : n.x;
        if (k) g.lineTo(x, n.y);
        else g.moveTo(x, n.y);
      });
    };
    const draw = (dt, t) => {
      const { g, W, H } = s;
      s.begin();
      // Kadife fon
      const bg = g.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.5, Math.max(W, H) * 0.8);
      bg.addColorStop(0, '#6a2f7f');
      bg.addColorStop(1, '#2b1036');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.07;
      g.fillStyle = '#fff';
      for (let k = 0; k < 18; k++) {
        const x = ((k * 97) % 100) / 100 * W;
        const y = ((k * 53) % 100) / 100 * H;
        starPath(g, x, y, 5 + (k % 3) * 2, 4, 0.25);
        g.fill();
      }
      g.globalAlpha = 1;
      const p = game.puzzle;
      if (p.kind === 'kolye') {
        // Kadife boyun manken
        g.beginPath();
        g.moveTo(W * 0.32, 0);
        g.quadraticCurveTo(W * 0.31, H * 0.2, W * 0.12, H * 0.34);
        g.quadraticCurveTo(W * 0.02, H * 0.44, W * 0.04, H);
        g.lineTo(W * 0.96, H);
        g.quadraticCurveTo(W * 0.98, H * 0.44, W * 0.88, H * 0.34);
        g.quadraticCurveTo(W * 0.69, H * 0.2, W * 0.68, 0);
        g.closePath();
        g.fillStyle = '#1f0a28';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#ffffff14';
        g.stroke();
      } else if (p.kind === 'bileklik') {
        g.beginPath();
        g.ellipse(W / 2, H * 0.5, Math.min(W, H) * 0.25, Math.min(W, H) * 0.31, 0, 0, 7);
        g.fillStyle = '#1f0a28';
        g.fill();
      } else {
        // Küpe standı
        g.fillStyle = '#c9a23a';
        g.fillRect(W * 0.14, H * 0.08, W * 0.72, 7);
        g.fillRect(W * 0.5 - 4, H * 0.08, 8, H * 0.92);
      }
      // Zincir
      const drawOne = (mirror) => {
        drawChainPath(g, mirror);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.lineWidth = 6;
        g.strokeStyle = '#2a1636';
        g.stroke();
        drawChainPath(g, mirror);
        g.lineWidth = 3;
        g.strokeStyle = '#ffd76a';
        g.setLineDash([5, 4]);
        g.stroke();
        g.setLineDash([]);
      };
      drawOne(false);
      if (p.kind === 'kupe') drawOne(true);
      for (const [x, y] of game.pins) {
        g.beginPath();
        g.arc(x, y, 7, 0, 7);
        inked(g, '#ffd76a', 2.5);
      }
      // Taşlar ve yuvalar
      const r = beadR();
      for (let k = 0; k < p.n; k++) {
        const q = slotPos(k);
        const v = game.seq[k];
        const twoSides = p.kind === 'kupe' ? [q.x, W - q.x] : [q.x];
        for (const x of twoSides) {
          if (v == null) {
            g.beginPath();
            g.arc(x, q.y, r * 0.62, 0, 7);
            g.fillStyle = '#2a163699';
            g.fill();
            const sel = k === game.sel && !game.done;
            g.lineWidth = sel ? 3.5 : 2;
            g.strokeStyle = sel ? `rgba(255,226,122,${0.6 + 0.4 * Math.sin(t / 180)})` : '#ffffff55';
            g.setLineDash(sel ? [] : [3, 4]);
            g.stroke();
            g.setLineDash([]);
          } else drawBead(g, BEADS[v], x, q.y, r, t);
        }
      }
      // Bitiş parıltısı
      if (game.done) {
        game.done += dt;
        const sweep = (game.done * 1.4) % 2;
        if (sweep < 1) {
          const x = sweep * W * 1.4 - W * 0.2;
          const gr = g.createLinearGradient(x - 60, 0, x + 60, 0);
          gr.addColorStop(0, '#ffffff00');
          gr.addColorStop(0.5, '#ffffff33');
          gr.addColorStop(1, '#ffffff00');
          g.fillStyle = gr;
          g.fillRect(0, 0, W, H);
        }
      }
      fx.draw(g, dt);
    };

    startCustomer();
    let settle = 40;
    my.raf((dt, t) => {
      if (!s.W) return true;
      if (!game.paused) {
        const sub = Math.min(dt || 0.016, 0.03);
        physics(sub);
        while (settle > 0) {
          physics(0.016);
          settle--;
        }
      }
      draw(game.paused ? 0 : dt, t);
      return true;
    });
    game.place = place;
  }

  menu();
  return {
    unmount() {
      end();
      life.dispose();
      f.dispose();
    },
    get st() { return st; },
    data,
    makePuzzle,
    evalRules,
  };
}
