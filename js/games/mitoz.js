// Mitoz Fırtınası: bir hücreye dokun, ikiye bölünsün. Çıkan yavrular başka hücrelere çarpar, onlar da bölünür.
// Tek dokunuşla bütün kabı uyandırmak mümkün. Az dokunuşla çok bölünme: yıldız oradan geliyor.

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, randInt, seeded } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, label, shake, pop } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';

const LEVELS = 40;
const KINDS = {
  hucre: { c: '#7fe7c4', d: '#2aa88a', r: 27, hp: 1, kids: 4, push: 1 },
  spor: { c: '#b58aff', d: '#6a3fd0', r: 31, hp: 2, kids: 5, push: 1.1 },
  kist: { c: '#ff9f43', d: '#d2641a', r: 36, hp: 1, kids: 8, push: 1.5 },
  virus: { c: '#ff5468', d: '#b81c3a', r: 22, hp: 1, kids: 3, push: 1.25 },
  altin: { c: '#ffcd3c', d: '#d19b00', r: 29, hp: 1, kids: 6, push: 1.2 },
};

const levelDef = (li) => {
  const r = seeded(4400 + li * 37);
  const n = Math.min(54, 10 + li);
  const cells = [];
  for (let k = 0; k < n; k++) {
    const t = r.range(0, 1);
    let kind = 'hucre';
    if (li >= 3 && t < 0.14 + Math.min(0.14, li * 0.004)) kind = 'spor';
    else if (li >= 6 && t < 0.3) kind = 'virus';
    else if (li >= 2 && t > 0.93) kind = 'kist';
    else if (li >= 4 && t > 0.88) kind = 'altin';
    cells.push({ kind, x: r.range(0.08, 0.92), y: r.range(0.1, 0.9), vx: r.range(-1, 1), vy: r.range(-1, 1), seed: r.range(0, 6) });
  }
  const taps = li < 2 ? 3 : Math.max(1, 3 - Math.floor(li / 14));
  const need = Math.ceil(n * clamp(0.45 + li * 0.012, 0.45, 0.85));
  return { cells, taps, need, n };
};

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], popped: 0, best: 0 });
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
      art: ART.mitoz,
      sub: 'Bir hücreye dokun, zincir başlasın. Az dokunuşla bütün kabı uyandır.',
      stats: [['Bölünen Hücre', data.popped], ['En Uzun Zincir', data.best]],
      how: [
        'Bir hücreye dokun: şişer, ikiye bölünür ve yavrularını fırlatır.',
        'Yavrular başka hücreye çarparsa o da bölünür. Zincir kendiliğinden büyür.',
        'Mor spor iki vuruş ister. Turuncu kist büyük patlar. Kırmızı virüs hızlı kaçar.',
        'Altın hücre fazladan altın verir, zinciri de güçlendirir.',
        'Dokunuş sayın sınırlı. Hepsini tek dokunuşta götürürsen üç yıldız.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Kaplar', onPick: (i) => play(i) },
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const def = levelDef(li);
    const fx = makeFx();
    const game = {
      cells: [], kids: [], taps: def.taps, popped: 0, chain: 0, bestChain: 0, gold: 0,
      done: false, paused: false, idle: 0, slow: 0, over: false, shock: 0,
    };
    st = game;

    f.setTitle(`Kap ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="mz">
        <canvas class="mz-cv"></canvas>
        <div class="mz-top">
          <span class="mz-goal"><small>Hedef</small><b><u data-pop>0</u> / ${def.need}</b><i><u data-bar></u></i></span>
          <span class="mz-taps"><b data-taps>${def.taps}</b><small>dokunuş</small></span>
        </div>
        <div class="mz-chain" data-chain></div>
      </div>`);
    const wrap = f.main.querySelector('.mz');
    const cv = wrap.querySelector('.mz-cv');
    const popEl = wrap.querySelector('[data-pop]');
    const tapEl = wrap.querySelector('[data-taps]');
    const barEl = wrap.querySelector('[data-bar]');
    const chainEl = wrap.querySelector('[data-chain]');
    const stage = fitCanvas(cv, my);

    const S = () => Math.min(stage.W, stage.H) / 380;
    for (const c of def.cells) {
      const k = KINDS[c.kind];
      game.cells.push({ ...c, kind: c.kind, hp: k.hp, r: k.r, state: 0, t: 0, dead: false, wob: c.seed });
    }

    const sync = () => {
      popEl.textContent = game.popped;
      tapEl.textContent = game.taps;
      barEl.style.width = `${clamp((game.popped / def.need) * 100, 0, 100)}%`;
    };
    sync();

    function burst(c, depth) {
      const k = KINDS[c.kind];
      c.dead = true;
      game.popped++;
      game.chain++;
      game.idle = 0;
      if (game.chain > game.bestChain) game.bestChain = game.chain;
      data.popped++;
      if (c.kind === 'altin') game.gold++;
      const sc = S();
      const px = c.x * stage.W;
      const py = c.y * stage.H;
      fx.burst(px, py, { n: c.kind === 'kist' ? 26 : 14, colors: [k.c, '#fff', k.d], power: 240 * k.push, gravity: 0 });
      fx.ring(px, py, k.c, c.r * sc);
      const n = k.kids;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
        game.kids.push({ x: c.x, y: c.y, vx: Math.cos(a) * 0.52 * k.push, vy: Math.sin(a) * 0.52 * k.push, life: 2.6, c: k.c, r: 9 });
      }
      const pitch = 240 + Math.min(28, game.chain) * 42;
      tone({ type: 'triangle', f: pitch, f2: pitch * 1.6, dur: 0.12, vol: 0.06, attack: 0.002 });
      if (c.kind === 'kist') { sfx.boom(); game.shock = 1; shake(wrap, 10); } else sfx.pop(0.8 + Math.min(1, game.chain / 14));
      buzz(c.kind === 'kist' ? 26 : 8);
      if (game.chain > 1) {
        chainEl.textContent = `${game.chain}. bölünme`;
        chainEl.classList.add('on');
        chainEl.style.setProperty('--k', String(Math.min(1, game.chain / 24)));
      }
      if (c.kind === 'kist') {
        // Kist büyük bir dalga yollar
        for (const o of game.cells) {
          if (o.dead || o === c) continue;
          const d = Math.hypot((o.x - c.x) * stage.W, (o.y - c.y) * stage.H);
          if (d < 130 * sc) my.timeout(() => { if (!o.dead && !game.done) hit(o, depth + 1); }, 60 + d * 0.8);
        }
      }
      void depth;
    }

    function hit(c, depth = 0) {
      if (c.dead || game.done) return;
      c.hp--;
      c.flash = 0.35;
      if (c.hp > 0) {
        sfx.tick();
        c.r *= 0.86;
        return;
      }
      burst(c, depth);
    }

    function finish(won) {
      if (game.done) return;
      game.done = true;
      if (game.bestChain > (data.best || 0)) data.best = game.bestChain;
      const used = def.taps - game.taps;
      const stars = !won ? 0 : used <= 1 ? 3 : used <= def.taps - 1 ? 2 : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = won ? 6 + stars * 6 + game.gold * 5 : 2 + Math.floor(game.popped / 8);
      api.finish({ coins });
      my.timeout(() => {
        resultSheet({
          won,
          title: won ? (stars === 3 ? 'Tek Dokunuş!' : 'Kap Uyandı!') : 'Zincir Söndü',
          sub: won ? `En uzun zincirin ${game.bestChain} bölünme.` : `${def.need} hücre gerekiyordu, ${game.popped} tanesi bölündü.`,
          stars,
          coins,
          stats: [['Bölünen', `${game.popped} / ${def.n}`], ['En Uzun Zincir', game.bestChain], ['Kalan Dokunuş', game.taps]],
          buttons: [
            ...(stars && li + 1 < LEVELS ? [{ label: 'Sonraki Kap', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', main: !stars, icon: 'replay', act: () => play(li) },
            { label: 'Kaplar', icon: 'list', act: () => menu() },
          ],
        });
      }, 800);
    }

    my.on(cv, 'pointerdown', (e) => {
      if (game.done || game.paused || !game.taps) return;
      const r = cv.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const sc = S();
      let best = null;
      let bd = 40 * sc;
      for (const c of game.cells) {
        if (c.dead) continue;
        const d = Math.hypot((c.x - px) * stage.W, (c.y - py) * stage.H);
        if (d < c.r * sc + bd * 0.4 && d < bd) { bd = d; best = c; }
      }
      if (!best) {
        sfx.soft();
        return;
      }
      game.taps--;
      game.chain = 0;
      chainEl.classList.remove('on');
      sync();
      hit(best, 0);
    });

    f.onBack = () => {
      if (game.done) { menu(); return; }
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => play(li), onQuit: () => menu() });
    };

    my.raf((dt0, t) => {
      const { W, H, g } = stage;
      const dt = game.paused ? 0 : Math.min(dt0, 0.05);
      stage.begin();
      const sc = S();

      // Kap: koyu cam zemin, hafif ızgara
      const bg = g.createRadialGradient(W * 0.5, H * 0.42, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
      bg.addColorStop(0, '#163a4a');
      bg.addColorStop(1, '#07202c');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(130,240,230,.06)';
      g.lineWidth = 1;
      const step = 34 * sc;
      g.beginPath();
      for (let x = 0; x < W; x += step) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = 0; y < H; y += step) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();

      // Yavru hücreler: çarptıkları hücreyi uyandırır
      for (let i = game.kids.length - 1; i >= 0; i--) {
        const k = game.kids[i];
        k.life -= dt;
        k.x += (k.vx * dt * 300) / W;
        k.y += (k.vy * dt * 300) / H;
        if (k.x < 0 || k.x > 1) { k.vx = -k.vx; k.x = clamp(k.x, 0.001, 0.999); }
        if (k.y < 0 || k.y > 1) { k.vy = -k.vy; k.y = clamp(k.y, 0.001, 0.999); }
        if (k.life <= 0) { game.kids.splice(i, 1); continue; }
        for (const c of game.cells) {
          if (c.dead) continue;
          const d = Math.hypot((c.x - k.x) * W, (c.y - k.y) * H);
          if (d < c.r * sc + k.r * sc * 0.6) {
            hit(c, 1);
            game.kids.splice(i, 1);
            break;
          }
        }
      }

      // Hücreler
      for (const c of game.cells) {
        if (c.dead) continue;
        if (!game.done) {
          const sp = c.kind === 'virus' ? 0.055 : 0.016;
          c.x += c.vx * dt * sp;
          c.y += c.vy * dt * sp;
          if (c.x < 0.05 || c.x > 0.95) c.vx = -c.vx;
          if (c.y < 0.06 || c.y > 0.94) c.vy = -c.vy;
          c.x = clamp(c.x, 0.05, 0.95);
          c.y = clamp(c.y, 0.06, 0.94);
        }
        if (c.flash > 0) c.flash -= dt;
        const k = KINDS[c.kind];
        const x = c.x * W;
        const y = c.y * H;
        const wob = 1 + Math.sin(t / 420 + c.wob) * 0.05;
        const r = c.r * sc * wob * (c.flash > 0 ? 1.18 : 1);
        g.save();
        g.translate(x, y);
        // Zar
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        const grd = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.35, k.c);
        grd.addColorStop(1, k.d);
        g.fillStyle = c.flash > 0 ? '#fff' : grd;
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#07202c';
        g.stroke();
        // Çekirdek
        g.beginPath();
        g.arc(Math.sin(t / 600 + c.wob) * r * 0.12, Math.cos(t / 700 + c.wob) * r * 0.12, r * 0.3, 0, Math.PI * 2);
        g.fillStyle = 'rgba(7,32,44,.45)';
        g.fill();
        if (c.kind === 'spor') {
          g.strokeStyle = '#07202c';
          g.lineWidth = 3;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + t / 2200;
            g.beginPath();
            g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            g.lineTo(Math.cos(a) * (r + 6 * sc), Math.sin(a) * (r + 6 * sc));
            g.stroke();
          }
          if (c.hp > 1) {
            g.beginPath();
            g.arc(0, 0, r * 0.62, 0, Math.PI * 2);
            g.strokeStyle = 'rgba(255,255,255,.6)';
            g.lineWidth = 2.5;
            g.stroke();
          }
        } else if (c.kind === 'virus') {
          g.fillStyle = '#07202c';
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - t / 900;
            g.beginPath();
            g.arc(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.14, 0, Math.PI * 2);
            g.fill();
          }
        } else if (c.kind === 'kist') {
          g.strokeStyle = 'rgba(255,255,255,.5)';
          g.lineWidth = 2.5;
          g.beginPath();
          g.arc(0, 0, r * 0.74, 0, Math.PI * 2);
          g.stroke();
        } else if (c.kind === 'altin') {
          g.fillStyle = 'rgba(255,255,255,.75)';
          g.beginPath();
          g.arc(-r * 0.3, -r * 0.3, r * 0.16, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }

      // Uçan yavrular
      for (const k of game.kids) {
        g.beginPath();
        g.arc(k.x * W, k.y * H, k.r * sc * clamp(k.life, 0.3, 1), 0, Math.PI * 2);
        g.fillStyle = k.c;
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = '#07202c';
        g.stroke();
      }

      if (game.shock > 0) {
        game.shock -= dt * 2;
        g.fillStyle = `rgba(255,200,120,${Math.max(0, game.shock) * 0.12})`;
        g.fillRect(0, 0, W, H);
      }

      // Zincir bittiğinde karar
      if (!game.done && !game.paused) {
        const quiet = game.kids.length === 0;
        if (quiet) {
          game.idle += dt;
          if (game.idle > 0.7) {
            if (game.chain) {
              game.chain = 0;
              chainEl.classList.remove('on');
              sync();
            }
            if (game.popped >= def.need) finish(true);
            else if (!game.taps) finish(false);
          }
        } else game.idle = 0;
      }
      sync();
      fx.draw(g, dt);
      return undefined;
    });

    game.tapCell = (i) => {
      const c = game.cells.filter((q) => !q.dead)[i];
      if (!c || !game.taps) return;
      game.taps--;
      game.chain = 0;
      sync();
      hit(c, 0);
    };
    my.timeout(() => toast(def.taps === 1 ? 'Tek dokunuşun var. İyi seç.' : `${def.taps} dokunuş hakkın var.`), 500);
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
