// Damar Bağla: aynı renkteki iki organı damarla birleştir. Damarlar birbirinin üstünden geçemez.
// Bütün çiftleri bağlayınca kan akmaya başlar; kabı baştan sona doldurursan üçüncü yıldız senin.

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, seeded, shuffle } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, rrect, label, shake, popIn } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';

const LEVELS = 50;
const COLORS = [
  { c: '#ff5468', d: '#a81230', n: 'Atardamar' },
  { c: '#4fb6ff', d: '#1f6ea8', n: 'Toplardamar' },
  { c: '#2ee6a0', d: '#13885c', n: 'Lenf' },
  { c: '#ffcd3c', d: '#c08e00', n: 'Sinir' },
  { c: '#b58aff', d: '#6a3fd0', n: 'Kılcal' },
  { c: '#ff9f43', d: '#c0631a', n: 'Safra' },
  { c: '#7ff2e2', d: '#239e92', n: 'Soluk' },
  { c: '#ff8cc0', d: '#c23a79', n: 'Hormon' },
];
const sizeOf = (li) => clamp(4 + Math.floor(li / 6), 4, 9);

// Bulmaca üretimi: ızgara baştan sona yollarla doldurulur, her yolun iki ucu bir çift olur.
// Böylece her bölümün kabı tamamen dolduran bir çözümü olduğu garanti.
function gen(li) {
  const N = sizeOf(li);
  const rng = seeded(8800 + li * 173);
  const idx = (x, y) => y * N + x;
  const nb = (i) => {
    const x = i % N;
    const y = (i / N) | 0;
    const out = [];
    if (x > 0) out.push(i - 1);
    if (x < N - 1) out.push(i + 1);
    if (y > 0) out.push(i - N);
    if (y < N - 1) out.push(i + N);
    return out;
  };
  for (let attempt = 0; attempt < 80; attempt++) {
    const owner = new Array(N * N).fill(-1);
    const paths = [];
    let ok = true;
    let guard = 0;
    while (guard++ < 400) {
      const empties = [];
      for (let i = 0; i < N * N; i++) if (owner[i] < 0) empties.push(i);
      if (!empties.length) break;
      // Köşeye sıkışmış hücreden başla: tek hücrelik artık kalmasın
      empties.sort((a, b) => nb(a).filter((j) => owner[j] < 0).length - nb(b).filter((j) => owner[j] < 0).length);
      const tight = empties.filter((i) => nb(i).filter((j) => owner[j] < 0).length === empties.length ? false : true);
      const start = tight.length ? tight[0] : empties[0];
      const pid = paths.length;
      const cells = [start];
      owner[start] = pid;
      const maxLen = rng.int(3, Math.max(4, Math.round(N * 1.7)));
      while (cells.length < maxLen) {
        const cur = cells[cells.length - 1];
        const free = nb(cur).filter((j) => owner[j] < 0);
        if (!free.length) break;
        // Düz gitmeyi biraz tercih et: yollar daha okunur olur
        const prev = cells.length > 1 ? cells[cells.length - 2] : -1;
        const straight = free.filter((j) => prev >= 0 && j - cur === cur - prev);
        const pickFrom = straight.length && rng.range(0, 1) < 0.55 ? straight : free;
        const next = pickFrom[rng.int(0, pickFrom.length - 1)];
        cells.push(next);
        owner[next] = pid;
      }
      if (cells.length < 2) {
        // Tek hücre kaldı: komşu bir yolun ucuna ekle
        const host = nb(start).find((j) => {
          const p = paths[owner[j]];
          return p && (p.cells[0] === j || p.cells[p.cells.length - 1] === j);
        });
        if (host === undefined) { ok = false; break; }
        const p = paths[owner[host]];
        if (p.cells[0] === host) p.cells.unshift(start); else p.cells.push(start);
        owner[start] = owner[host];
        continue;
      }
      paths.push({ cells });
    }
    if (!ok) continue;
    if (paths.length < 3 || paths.length > COLORS.length) continue;
    const order = shuffle(paths.map((_, i) => i), () => rng());
    const sol = order.map((i) => paths[i].cells);
    return { N, sol, pairs: sol.map((c) => [c[0], c[c.length - 1]]), idx };
  }
  return null;
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], solved: 0, full: 0 });
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
      art: ART.damar,
      sub: 'Aynı renkteki iki ucu damarla birleştir. Damarlar kesişmez.',
      stats: [['Bağlanan Kap', data.solved], ['Tam Dolu Biten', data.full]],
      how: [
        'Bir uca parmağını koy ve aynı renkli öbür uca kadar sürükle.',
        'Damarlar birbirinin üstünden geçemez. Başka damarın üstünden geçersen o damar kesilir.',
        'Kendi damarının üstünde geri gelirsen damar kısalır.',
        'Bütün çiftleri bağlayınca kan akar. Kabın her karesini doldurursan üç yıldız.',
        'Sıkışırsan İpucu bir çifti senin yerine bağlar.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Kaplar', onPick: (i) => play(i) },
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const puz = gen(li);
    if (!puz) {
      toast('Bu kap kurulamadı.');
      menu();
      return;
    }
    const N = puz.N;
    const fx = makeFx();
    const game = {
      N, owner: new Array(N * N).fill(-1), paths: puz.sol.map(() => []), done: false, paused: false,
      drag: null, moves: 0, hints: 0, flow: 0, sol: puz.sol, pairs: puz.pairs, win: false,
    };
    st = game;
    const ends = new Map();
    puz.pairs.forEach(([a, b], i) => {
      ends.set(a, i);
      ends.set(b, i);
    });
    // Uçlar kendi yollarının başlangıcı sayılır
    const resetPath = (i) => {
      for (let k = 0; k < game.owner.length; k++) if (game.owner[k] === i) game.owner[k] = -1;
      game.paths[i] = [];
    };
    const isEnd = (cell, i) => puz.pairs[i][0] === cell || puz.pairs[i][1] === cell;

    f.setTitle(`Kap ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="dm">
        <div class="dm-top">
          <span class="dm-chip"><b data-pairs>0</b> / ${puz.pairs.length} damar</span>
          <span class="dm-chip fill"><b data-fill>%0</b> dolu</span>
        </div>
        <div class="dm-boardwrap"><canvas class="dm-cv"></canvas></div>
        <div class="dm-bar">
          <span class="dm-moves"><b data-moves>0</b> hamle</span>
          <button class="dm-b" data-act="clear">${icon('trash')}Temizle</button>
          <button class="dm-b" data-act="hint">${icon('hint')}İpucu</button>
        </div>
      </div>`);
    const wrap = f.main.querySelector('.dm');
    const cv = wrap.querySelector('.dm-cv');
    const pairsEl = wrap.querySelector('[data-pairs]');
    const fillEl = wrap.querySelector('[data-fill]');
    const movesEl = wrap.querySelector('[data-moves]');
    const stage = fitCanvas(cv, my);

    let lay = { s: 40, x: 0, y: 0 };
    const relayout = () => {
      const { W, H } = stage;
      const s = Math.min((W - 10) / N, (H - 10) / N);
      lay = { s, x: (W - s * N) / 2, y: (H - s * N) / 2 };
    };
    relayout();
    const cellCenter = (i) => ({ x: lay.x + ((i % N) + 0.5) * lay.s, y: lay.y + (((i / N) | 0) + 0.5) * lay.s });
    const cellAt = (px, py) => {
      const cx = Math.floor((px - lay.x) / lay.s);
      const cy = Math.floor((py - lay.y) / lay.s);
      if (cx < 0 || cy < 0 || cx >= N || cy >= N) return -1;
      return cy * N + cx;
    };
    const adjacent = (a, b) => {
      const dx = Math.abs((a % N) - (b % N));
      const dy = Math.abs(((a / N) | 0) - ((b / N) | 0));
      return dx + dy === 1;
    };
    const pathDone = (i) => {
      const p = game.paths[i];
      if (p.length < 2) return false;
      const [a, b] = puz.pairs[i];
      const f2 = p[0];
      const l = p[p.length - 1];
      return (f2 === a && l === b) || (f2 === b && l === a);
    };

    function sync() {
      const done = game.paths.filter((_, i) => pathDone(i)).length;
      const filled = game.owner.filter((o) => o >= 0).length;
      pairsEl.textContent = done;
      fillEl.textContent = `%${Math.round((filled / (N * N)) * 100)}`;
      movesEl.textContent = game.moves;
      if (!game.done && done === puz.pairs.length) finish(filled === N * N ? 3 : filled >= N * N * 0.85 ? 2 : 1);
    }

    // Bir hücreye uzan: boşsa ekle, kendi yolunda geri gel, başka damarı kes
    function extend(i, cell) {
      const p = game.paths[i];
      if (!p.length) return;
      const last = p[p.length - 1];
      if (cell === last) return;
      if (!adjacent(cell, last)) return;
      const own = p.indexOf(cell);
      if (own >= 0) {
        // Geri gelindi: fazlasını sil
        for (let k = own + 1; k < p.length; k++) game.owner[p[k]] = -1;
        p.length = own + 1;
        sfx.soft();
        sync();
        return;
      }
      const o = game.owner[cell];
      if (o >= 0 && o !== i) {
        const other = game.paths[o];
        const at = other.indexOf(cell);
        for (let k = at; k < other.length; k++) game.owner[other[k]] = -1;
        other.length = at;
        sfx.tick();
      }
      // Başka bir çiftin ucuna basılamaz
      const e = ends.get(cell);
      if (e !== undefined && e !== i) return;
      p.push(cell);
      game.owner[cell] = i;
      sfx.tile();
      buzz(4);
      if (pathDone(i)) {
        const col = COLORS[i % COLORS.length];
        const c = cellCenter(cell);
        fx.burst(c.x, c.y, { n: 12, colors: [col.c, '#fff'], power: 190, gravity: 0 });
        tone({ type: 'triangle', f: 440 + i * 60, f2: 880 + i * 60, dur: 0.18, vol: 0.07 });
        sfx.good();
        buzz(14);
      }
      sync();
    }

    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return cellAt(e.clientX - r.left, e.clientY - r.top);
    };
    my.on(cv, 'pointerdown', (e) => {
      if (game.done || game.paused) return;
      const cell = pos(e);
      if (cell < 0) return;
      const e2 = ends.get(cell);
      if (e2 !== undefined) {
        // Uca basıldı: o damarı baştan çiz
        resetPath(e2);
        game.paths[e2] = [cell];
        game.owner[cell] = e2;
        game.drag = e2;
        game.moves++;
        sfx.tap();
        sync();
        return;
      }
      const o = game.owner[cell];
      if (o >= 0) {
        // Damarın ortasına basıldı: oradan devam et
        const p = game.paths[o];
        const at = p.indexOf(cell);
        for (let k = at + 1; k < p.length; k++) game.owner[p[k]] = -1;
        p.length = at + 1;
        game.drag = o;
        game.moves++;
        sfx.tap();
        sync();
      }
    });
    my.on(cv, 'pointermove', (e) => {
      if (game.drag === null || game.drag === undefined) return;
      const cell = pos(e);
      if (cell < 0) return;
      extend(game.drag, cell);
    });
    const up = () => { game.drag = null; };
    my.on(window, 'pointerup', up);
    my.on(window, 'pointercancel', up);

    my.on(wrap, 'click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || game.done) return;
      sfx.tap();
      if (b.dataset.act === 'clear') {
        game.owner.fill(-1);
        game.paths = puz.sol.map(() => []);
        game.moves++;
        sync();
        toast('Kap temizlendi.');
        return;
      }
      // İpucu: çözümden bir damarı olduğu gibi kurar
      const i = puz.sol.findIndex((_, k) => !pathDone(k));
      if (i < 0) return;
      for (let k = 0; k < game.paths.length; k++) {
        if (k === i) continue;
        const p = game.paths[k];
        for (const cell of p.slice()) {
          if (puz.sol[i].includes(cell)) { resetPath(k); break; }
        }
      }
      resetPath(i);
      game.paths[i] = puz.sol[i].slice();
      for (const cell of game.paths[i]) game.owner[cell] = i;
      game.hints++;
      game.moves++;
      sfx.zap();
      buzz(16);
      sync();
    });

    function finish(stars) {
      if (game.done) return;
      game.done = true;
      game.win = true;
      game.flow = 0.01;
      const s = Math.max(1, stars - (game.hints > 0 ? 1 : 0));
      if (s > (data.stars[li] || 0)) data.stars[li] = s;
      data.solved++;
      if (stars === 3) data.full++;
      api.touch();
      const coins = 6 + s * 6;
      api.finish({ coins });
      sfx.fanfare();
      my.timeout(() => {
        resultSheet({
          won: true,
          title: stars === 3 ? 'Kan Aktı!' : 'Damarlar Bağlandı',
          sub: stars === 3 ? 'Kabın her karesi dolu, akış kusursuz.' : 'Bağlandı ama boş kareler kaldı. Hepsini doldurursan üç yıldız.',
          stars: s,
          coins,
          stats: [['Damar', `${puz.pairs.length}`], ['Doluluk', `%${Math.round((game.owner.filter((o) => o >= 0).length / (N * N)) * 100)}`], ['Hamle', game.moves]],
          buttons: [
            ...(li + 1 < LEVELS ? [{ label: 'Sonraki Kap', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', icon: 'replay', act: () => play(li) },
            { label: 'Kaplar', icon: 'list', act: () => menu() },
          ],
        });
      }, 1100);
    }

    f.onBack = () => {
      if (game.done) { menu(); return; }
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => play(li), onQuit: () => menu() });
    };

    my.raf((dt0, t) => {
      const { W, H, g } = stage;
      const dt = game.paused ? 0 : dt0;
      stage.begin();
      relayout();
      const s = lay.s;
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#111c3a');
      bg.addColorStop(1, '#0a1226');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);

      // Kap: kareler
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          rrect(g, lay.x + x * s + 1.5, lay.y + y * s + 1.5, s - 3, s - 3, s * 0.16);
          g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.03)';
          g.fill();
          g.lineWidth = 1.5;
          g.strokeStyle = 'rgba(140,190,255,.12)';
          g.stroke();
        }
      }

      if (game.flow > 0) game.flow = Math.min(1, game.flow + dt * 0.8);

      // Damarlar
      game.paths.forEach((p, i) => {
        if (p.length < 2) return;
        const col = COLORS[i % COLORS.length];
        const done = pathDone(i);
        g.beginPath();
        p.forEach((cell, k) => {
          const c = cellCenter(cell);
          if (k) g.lineTo(c.x, c.y); else g.moveTo(c.x, c.y);
        });
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = col.d;
        g.lineWidth = s * 0.52;
        g.stroke();
        g.strokeStyle = col.c;
        g.lineWidth = s * 0.34;
        if (done) {
          g.shadowColor = col.c;
          g.shadowBlur = 14 + Math.sin(t / 240 + i) * 6;
        }
        g.stroke();
        g.shadowBlur = 0;
        // Akan kan: tamamlanan damarda hücreler yol alır
        if (done) {
          const total = p.length - 1;
          for (let k = 0; k < 3; k++) {
            const u = ((t / 1400 + k / 3 + i * 0.2) % 1) * total;
            const a = p[Math.floor(u)];
            const b = p[Math.min(total, Math.floor(u) + 1)];
            const ca = cellCenter(a);
            const cb = cellCenter(b);
            const f2 = u - Math.floor(u);
            g.beginPath();
            g.arc(lerp(ca.x, cb.x, f2), lerp(ca.y, cb.y, f2), s * 0.1, 0, Math.PI * 2);
            g.fillStyle = '#fff';
            g.globalAlpha = 0.85;
            g.fill();
            g.globalAlpha = 1;
          }
        }
      });

      // Uçlar
      puz.pairs.forEach(([a, b], i) => {
        const col = COLORS[i % COLORS.length];
        const done = pathDone(i);
        for (const cell of [a, b]) {
          const c = cellCenter(cell);
          const r = s * (done ? 0.3 : 0.26) * (1 + (done ? Math.sin(t / 300 + i) * 0.06 : 0));
          g.beginPath();
          g.arc(c.x, c.y, r + 2, 0, Math.PI * 2);
          g.fillStyle = '#0a1226';
          g.fill();
          g.beginPath();
          g.arc(c.x, c.y, r, 0, Math.PI * 2);
          const grd = g.createRadialGradient(c.x - r * 0.3, c.y - r * 0.35, r * 0.1, c.x, c.y, r);
          grd.addColorStop(0, '#fff');
          grd.addColorStop(0.4, col.c);
          grd.addColorStop(1, col.d);
          g.fillStyle = grd;
          g.fill();
          if (game.drag === i) {
            g.lineWidth = 3;
            g.strokeStyle = '#fff';
            g.stroke();
          }
        }
      });

      fx.draw(g, dt);
      return undefined;
    });

    sync();
    game.solveAll = () => {
      game.owner.fill(-1);
      game.paths = puz.sol.map((cells) => cells.slice());
      game.paths.forEach((p, i) => p.forEach((cell) => { game.owner[cell] = i; }));
      sync();
    };
    game.hintOnce = () => wrap.querySelector('[data-hint]').click();
    my.timeout(() => toast(`${puz.pairs.length} damar var. Uçları birleştir.`), 500);
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
