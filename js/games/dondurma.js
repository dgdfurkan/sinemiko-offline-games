// Maraş Dondurmacısı: küreği doğru anda bırak, toplar külahın üstüne dizilsin. Kule yalpalar, fazla kayarsa devrilir.
// Sonra asıl eğlence: müşteri külahı almaya uzanır, sen ok yönünde kaydırıp kaçırırsın. Her numara bahşiş, her numara çan sesi.

import { Life, html, toHTML, fitCanvas, clamp, rand, pick, randInt } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, inked, rrect, label, shake } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast } from '../core/ui.js';
import { customer, setMood } from '../core/avatar.js';

const FLAVORS = [
  { id: 'vanilya', name: 'Sade', c: '#fff6df', d: '#e9d4a6' },
  { id: 'cilek', name: 'Çilek', c: '#ff9ec0', d: '#e0507f' },
  { id: 'cikolata', name: 'Çikolata', c: '#8a5230', d: '#55301a' },
  { id: 'fistik', name: 'Fıstık', c: '#b8d96a', d: '#7fa638' },
  { id: 'limon', name: 'Limon', c: '#ffe96a', d: '#e0bc20' },
  { id: 'karadut', name: 'Karadut', c: '#8a3f8f', d: '#5a1f60' },
  { id: 'kavun', name: 'Kavun', c: '#ffc27a', d: '#ec9440' },
];
const SHIFTS = 30;
const ARROWS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const shiftCfg = (i) => ({
  customers: Math.min(7, 3 + Math.floor(i / 5)),
  flavors: Math.min(FLAVORS.length, 3 + Math.floor(i / 3)),
  scoops: Math.min(5, 2 + Math.floor(i / 6)),
  speed: 1.05 + Math.min(1.25, i * 0.04),
  tricks: Math.min(4, 2 + Math.floor(i / 10)),
  goal: 50 + i * 14,
});

function bell() {
  tone({ type: 'triangle', f: 2100, dur: 0.5, vol: 0.09, attack: 0.002 });
  tone({ type: 'sine', f: 3380, dur: 0.3, vol: 0.05, attack: 0.002 });
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], cash: 0, best: 0, tricks: 0 });
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
      art: ART_DONDURMA,
      sub: 'Topları diz, müşteriyi kandır. Maraş dondurmacısı olmak kolay değil.',
      stats: [['Kasa', `${data.cash} ₺`], ['Yapılan Numara', data.tricks]],
      how: [
        'Sipariş kartındaki sırayla dondurma seç: aşağıdaki kazanlara dokun.',
        'Kürek gidip gelir. Külahın üstüne geldiğinde ekrana dokun: top düşer.',
        'Top ne kadar ortaya gelirse kule o kadar sağlam olur. Fazla kayarsa devrilir.',
        'Müşteri uzanınca ok yönünde parmağını kaydır: külah elinden kaçar, çan çalar, bahşiş artar!',
      ],
      levels: { total: SHIFTS, stars: data.stars, title: 'Vardiyalar', onPick: (i) => play(i) },
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const cfg = shiftCfg(li);
    f.setTitle(`${li + 1}. Vardiya`);
    const flavorIds = FLAVORS.slice(0, cfg.flavors);
    f.main.innerHTML = toHTML(html`
      <div class="dd">
        <canvas class="dd-cv"></canvas>
        <div class="dd-cust" data-cust></div>
        <div class="dd-order" data-order></div>
        <div class="dd-hud"><span data-money>0 ₺</span><span data-left></span></div>
        <div class="dd-tubs" data-tubs>${flavorIds.map((fl, i) => html`<button class="tub" data-f="${i}" style="--c:${fl.c};--d:${fl.d}"><i></i><span>${fl.name}</span></button>`)}</div>
      </div>`);
    const main = f.main.firstElementChild;
    const cv = main.querySelector('canvas');
    const s = fitCanvas(cv, my);
    const fx = makeFx();
    const game = {
      li, cfg, money: 0, n: 0, served: 0, fallen: 0, paused: false, over: false, phase: 'idle',
      order: [], stack: [], k: 0, hold: null, paddle: 0, falling: null, angle: 0, angVel: 0, lean: 0, splats: [], tricksDone: 0, trick: null, tip: 0, cone: { x: 0.5, y: 0 }, coneOff: { x: 0, y: 0, vx: 0, vy: 0 }, handK: 0, wiggle: 0,
    };
    st = game;
    f.onBack = () => {
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => play(li), onQuit: () => menu() });
    };
    const geo = () => {
      const u = Math.min(s.W, s.H * 0.62);
      return { u, r: u * 0.082, baseX: s.W / 2, baseY: s.H * 0.8, paddleY: s.H * 0.19 };
    };
    const money = (n) => {
      game.money += n;
      main.querySelector('[data-money]').textContent = `${game.money} ₺`;
    };
    const renderOrder = () => {
      const box = main.querySelector('[data-order]');
      const rows = game.order.map((fi, i) => html`<i class="${i < game.k ? 'done' : i === game.k ? 'cur' : ''}" style="--c:${FLAVORS[fi].c};--d:${FLAVORS[fi].d}"></i>`).reverse();
      box.innerHTML = toHTML(html`<b>Sipariş</b><div class="dd-mini">${rows}<em></em></div>`);
      main.querySelector('[data-left]').textContent = `Müşteri ${game.n + 1} / ${cfg.customers}`;
      main.querySelectorAll('.tub').forEach((t) => {
        const on = game.phase === 'scoop' && Number(t.dataset.f) === game.order[game.k] && !game.hold;
        t.classList.toggle('hint', on);
      });
    };
    const nextCustomer = () => {
      if (game.n >= cfg.customers) {
        finish();
        return;
      }
      const seed = li * 13 + game.n * 7 + 3;
      game.order = Array.from({ length: randInt(Math.max(2, cfg.scoops - 1), cfg.scoops) }, () => randInt(0, cfg.flavors - 1));
      game.stack = [];
      game.k = 0;
      game.hold = null;
      game.falling = null;
      game.angle = 0;
      game.angVel = 0;
      game.lean = 0;
      game.tip = 0;
      game.tricksDone = 0;
      game.trick = null;
      game.handK = 0;
      game.coneOff = { x: 0, y: 0, vx: 0, vy: 0 };
      game.phase = 'scoop';
      const c = main.querySelector('[data-cust]');
      c.innerHTML = toHTML(customer(seed, { mood: 'happy' }));
      c.firstElementChild.animate([{ transform: 'translateX(-120px) rotate(-10deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 440, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      renderOrder();
      bell();
    };
    const cust = () => main.querySelector('[data-cust] .blob');

    // Kazandan top alma
    my.on(main.querySelector('[data-tubs]'), 'click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b || game.paused || game.phase !== 'scoop' || game.hold || game.falling) return;
      takeScoop(Number(b.dataset.f));
    });
    const takeScoop = (fi) => {
      game.hold = { fi };
      game.paddle = rand(0, 6.28);
      sfx.squish();
      buzz(8);
      renderOrder();
    };
    const dropScoop = () => {
      if (!game.hold || game.falling) return;
      const g = geo();
      const x = g.baseX + Math.sin(game.paddle) * g.u * 0.34;
      game.falling = { fi: game.hold.fi, x, y: g.paddleY + g.r * 0.8, vy: 40 };
      game.hold = null;
      sfx.whoosh();
      renderOrder();
    };
    game.takeScoop = takeScoop;
    game.dropScoop = dropScoop;

    // Kule: taban üstünde sıralı toplar; açı yalpalama
    const towerTop = () => {
      const g = geo();
      const n = game.stack.length;
      let x = g.baseX;
      let y = g.baseY - g.r * 1.55;
      for (let k = 0; k < n; k++) {
        x += game.stack[k].dx;
        y -= g.r * 1.42;
      }
      return { x, y };
    };
    const land = (b) => {
      const g = geo();
      const top = towerTop();
      const dx = b.x - top.x;
      if (Math.abs(dx) > g.r * 1.25) {
        // Kenardan kaçtı
        game.fallen++;
        game.splats.push({ x: b.x, y: s.H * 0.86, fi: b.fi, s: 1 });
        sfx.splat();
        buzz(25);
        fx.burst(b.x, s.H * 0.86, { n: 12, colors: [FLAVORS[b.fi].c, FLAVORS[b.fi].d, '#fff'], power: 240 });
        fx.text(b.x, s.H * 0.8, 'Kaçtı!', '#ffb0b0', 22);
        setMood(cust(), 'wow');
        my.timeout(() => { if (cust() && game.phase === 'scoop') setMood(cust(), 'happy'); }, 700);
        game.tip = Math.max(-6, game.tip - 3);
        return;
      }
      const wrong = b.fi !== game.order[game.k];
      game.stack.push({ fi: b.fi, dx: dx * 0.8, squash: 1 });
      game.lean += dx / g.r;
      game.angVel += (dx / g.r) * 1.5;
      const perfect = Math.abs(dx) < g.r * 0.25;
      sfx.thud(0.5);
      buzz(10);
      if (perfect) {
        game.tip += 3;
        fx.text(b.x, top.y - g.r * 2, 'Tam Ortası!', '#ffe27a', 20);
        sfx.star(0);
        fx.burst(b.x, top.y, { n: 12, colors: ['#ffe27a', '#fff'], power: 180, shape: 'star', gravity: 200 });
      }
      if (wrong) {
        game.tip -= 4;
        fx.text(b.x, top.y - g.r * 2, 'O Değildi!', '#ffb0b0', 20);
        sfx.bad();
      }
      game.k++;
      renderOrder();
      if (game.k >= game.order.length) {
        game.phase = 'settle';
        my.timeout(startTricks, 650);
      }
    };
    const topple = () => {
      game.phase = 'toppled';
      game.fallen++;
      const g = geo();
      sfx.splat();
      sfx.boom();
      buzz(70);
      shake(main, 9);
      game.stack.forEach((sc, k) => {
        const x = g.baseX + (k + 1) * g.r * Math.sign(game.angle || 1) * 0.9;
        game.splats.push({ x, y: s.H * 0.86, fi: sc.fi, s: 1 });
        fx.burst(x, s.H * 0.86, { n: 8, colors: [FLAVORS[sc.fi].c, '#fff'], power: 260 });
      });
      game.stack = [];
      setMood(cust(), 'sad');
      toast('Kule devrildi!');
      my.timeout(() => {
        const c = main.querySelector('[data-cust] .blob');
        if (c) c.parentElement.firstElementChild.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-120px)', opacity: 0 }], { duration: 320, fill: 'forwards' });
        game.n++;
        my.timeout(nextCustomer, 340);
      }, 1200);
    };

    // Numara: müşteri uzanır, oku kaydırırsın
    const startTricks = () => {
      if (game.phase === 'toppled') return;
      game.phase = 'trick';
      bell();
      newTrick();
    };
    const newTrick = () => {
      if (game.tricksDone >= cfg.tricks) {
        giveCone();
        return;
      }
      const dir = pick(Object.keys(ARROWS));
      game.trick = { dir, t: 0, max: Math.max(0.75, 1.55 - li * 0.022 - game.tricksDone * 0.1), done: false };
      game.handK = 0;
    };
    const swipe = (dx, dy) => {
      const t = game.trick;
      if (!t || t.done || game.phase !== 'trick' || game.paused) return;
      const horiz = Math.abs(dx) > Math.abs(dy);
      const dir = horiz ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      t.done = true;
      if (dir === t.dir) {
        game.tricksDone++;
        data.tricks++;
        const [ax, ay] = ARROWS[dir];
        const g = geo();
        game.coneOff.vx += ax * g.u * 7;
        game.coneOff.vy += ay * g.u * 7;
        bell();
        setTimeout(bell, 110);
        sfx.whoosh();
        buzz(16);
        game.tip += 5;
        game.wiggle = 1;
        setMood(cust(), 'wow');
        fx.text(s.W / 2, s.H * 0.3, ['Hop!', 'Yakalayamadın!', 'Bir Daha!', 'Az Kaldı!', 'Maraş Usulü!'][randInt(0, 4)], '#ffe27a', 28);
        fx.burst(s.W / 2, s.H * 0.45, { n: 12, colors: ['#ffcd3c', '#fff', '#ff5fa2'], power: 280, shape: 'star', gravity: 300 });
        my.timeout(newTrick, 620);
      } else {
        sfx.bad();
        buzz(30);
        game.tip = Math.max(0, game.tip - 2);
        fx.text(s.W / 2, s.H * 0.3, 'Ters Yöne!', '#ffb0b0', 26);
        my.timeout(giveCone, 400);
      }
    };
    const giveCone = () => {
      if (game.phase === 'give') return;
      game.phase = 'give';
      game.trick = null;
      const base = 10 + game.order.length * 5;
      const pay = Math.max(4, base + game.tip);
      money(pay);
      game.served++;
      sfx.coin();
      sfx.good();
      setMood(cust(), 'laugh', 'happy');
      fx.text(s.W * 0.25, s.H * 0.24, `+${pay} ₺`, '#ffe27a', 30);
      my.timeout(() => {
        const n = main.querySelector('[data-cust]').firstElementChild;
        if (n) n.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateX(-130px) rotate(-8deg)', opacity: 0 }], { duration: 340, fill: 'forwards', easing: 'ease-in' });
        game.stack = [];
        game.phase = 'idle';
        game.n++;
        my.timeout(nextCustomer, 360);
      }, 900);
    };
    const finish = () => {
      game.over = true;
      const stars = game.money >= cfg.goal * 1.5 ? 3 : game.money >= cfg.goal ? 2 : game.served > 0 ? 1 : 0;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      data.cash += game.money;
      data.best = Math.max(data.best, game.money);
      api.touch();
      const coins = stars ? 8 + stars * 6 + Math.floor(game.money / 16) : 3;
      api.finish({ coins });
      resultSheet({
        won: stars > 0,
        title: 'Kepenk İndi',
        sub: stars === 3 ? 'Mahalle senden konuşuyor.' : '',
        stars,
        coins,
        stats: [['Kazanç', `${game.money} ₺`], ['Hedef', `${cfg.goal} ₺`], ['Düşen', game.fallen]],
        buttons: [
          ...(stars && li + 1 < SHIFTS ? [{ label: 'Sonraki Vardiya', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
          { label: 'Tekrar', main: !stars, icon: 'replay', act: () => play(li) },
          { label: 'Menü', icon: 'home', act: () => menu() },
        ],
      });
    };

    // Dokunma: küreği bırak ya da kaydır
    let sx = 0;
    let sy = 0;
    let swiped = false;
    my.on(cv, 'pointerdown', (e) => {
      if (game.paused) return;
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      sx = e.clientX - r.left;
      sy = e.clientY - r.top;
      swiped = false;
      if (game.phase === 'scoop' && game.hold) dropScoop();
    });
    my.on(cv, 'pointermove', (e) => {
      if (game.phase !== 'trick' || swiped || !(e.buttons || e.pressure)) return;
      const r = cv.getBoundingClientRect();
      const dx = e.clientX - r.left - sx;
      const dy = e.clientY - r.top - sy;
      if (Math.hypot(dx, dy) > 26) {
        swiped = true;
        swipe(dx, dy);
      }
    });
    game.swipe = swipe;

    const drawScoop = (g, x, y, r, fi, sq = 1) => {
      const fl = FLAVORS[fi];
      g.save();
      g.translate(x, y);
      g.scale(1 + (1 - sq) * 0.5, sq);
      g.beginPath();
      for (let k = 0; k <= 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        const rr = r * (a > 0.2 && a < Math.PI - 0.2 ? 1 + Math.sin(a * 7) * 0.07 : 1 + Math.sin(a * 3 + 1) * 0.025);
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.92);
      }
      g.closePath();
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
      gr.addColorStop(0, '#fff');
      gr.addColorStop(0.3, fl.c);
      gr.addColorStop(1, fl.d);
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = Math.max(2.5, r * 0.09);
      g.strokeStyle = '#2a1636';
      g.stroke();
      g.restore();
    };
    const drawCone = (g, x, y, r) => {
      g.beginPath();
      g.moveTo(x - r * 1.05, y - r * 0.5);
      g.lineTo(x + r * 1.05, y - r * 0.5);
      g.lineTo(x, y + r * 2.5);
      g.closePath();
      inked(g, '#e8b061', 3.5);
      g.save();
      g.clip();
      g.lineWidth = 2;
      g.strokeStyle = '#a5682a';
      for (let k = -6; k < 8; k++) {
        g.beginPath();
        g.moveTo(x - r * 2 + k * r * 0.5, y - r);
        g.lineTo(x - r * 0.4 + k * r * 0.5, y + r * 3);
        g.moveTo(x + r * 2 - k * r * 0.5, y - r);
        g.lineTo(x + r * 0.4 - k * r * 0.5, y + r * 3);
        g.stroke();
      }
      g.restore();
    };

    const step = (dt) => {
      const g = geo();
      if (game.hold) game.paddle += dt * cfg.speed * 2.1;
      if (game.falling) {
        const b = game.falling;
        b.vy += s.H * 3.2 * dt;
        b.y += b.vy * dt;
        const top = towerTop();
        if (b.y >= top.y - g.r * 1.2) {
          game.falling = null;
          land(b);
        }
      }
      // Yalpalama: yay ve eğim
      if (game.stack.length) {
        const load = 1 + game.stack.length * 0.14;
        game.angVel += (-game.angle * 34 + game.lean * 0.14 * load) * dt;
        game.angVel *= 1 - 3.2 * dt;
        game.angle += game.angVel * dt;
        if (game.phase === 'scoop' || game.phase === 'settle') {
          if (Math.abs(game.angle) > 0.42) topple();
          if (Math.abs(game.lean) > 2.4) topple();
        }
      }
      for (const sc of game.stack) sc.squash += (1 - sc.squash) * Math.min(1, dt * 10);
      // Külah kaçışı: yay
      const c = game.coneOff;
      c.vx += -c.x * 60 * dt;
      c.vy += -c.y * 60 * dt;
      c.vx *= 1 - 6 * dt;
      c.vy *= 1 - 6 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (game.trick && !game.trick.done && game.phase === 'trick') {
        game.trick.t += dt;
        game.handK = clamp(game.trick.t / game.trick.max, 0, 1);
        if (game.handK >= 1) {
          game.trick.done = true;
          sfx.pop(1.3);
          setMood(cust(), 'laugh', 'happy');
          fx.text(s.W / 2, s.H * 0.3, 'Yakaladı!', '#fff', 26);
          giveCone();
        }
      } else if (game.phase === 'trick') game.handK = Math.max(0, game.handK - dt * 3);
    };

    const draw = (dt, t) => {
      const { g, W, H } = s;
      const geoNow = geo();
      const { r, baseX, baseY, paddleY, u } = geoNow;
      s.begin();
      // Tezgah arkası: çini duvar
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#fff2d6');
      bg.addColorStop(1, '#ffdca6');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      const tile = 54;
      g.globalAlpha = 0.5;
      for (let y = 40; y < H * 0.8; y += tile) {
        for (let x = (Math.floor(y / tile) % 2) * (tile / 2); x < W; x += tile) {
          g.beginPath();
          g.moveTo(x, y - 14);
          g.lineTo(x + 14, y);
          g.lineTo(x, y + 14);
          g.lineTo(x - 14, y);
          g.closePath();
          g.fillStyle = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 ? '#3fa7c9' : '#e0603a';
          g.fill();
        }
      }
      g.globalAlpha = 1;
      // Tente
      const strip = W / 10;
      for (let k = 0; k < 10; k++) {
        g.beginPath();
        g.moveTo(k * strip, 0);
        g.lineTo((k + 1) * strip, 0);
        g.lineTo((k + 1) * strip, H * 0.07);
        g.quadraticCurveTo((k + 0.5) * strip, H * 0.1, k * strip, H * 0.07);
        g.closePath();
        g.fillStyle = k % 2 ? '#fff8ee' : '#e23b3b';
        g.fill();
        g.lineWidth = 2.5;
        g.strokeStyle = '#2a1636';
        g.stroke();
      }
      // Tezgah
      g.fillStyle = '#b5683a';
      g.fillRect(0, H * 0.86, W, H * 0.14);
      g.fillStyle = '#2a1636';
      g.fillRect(0, H * 0.86, W, 4);
      // Yere düşenler
      for (const sp of game.splats) {
        g.beginPath();
        g.ellipse(sp.x, sp.y, r * 1.1, r * 0.34, 0, 0, 7);
        inked(g, FLAVORS[sp.fi].c, 2.5);
      }
      if (game.splats.length > 14) game.splats.shift();
      const showCone = game.phase !== 'idle';
      if (showCone) {
        // Külah ve kule
        const c = game.coneOff;
        const liftY = game.phase === 'trick' || game.phase === 'give' ? -H * 0.14 : 0;
        const cx = baseX + c.x;
        const cy = baseY + liftY + c.y;
        g.save();
        g.translate(cx, cy);
        g.rotate(game.angle * 0.6);
        g.translate(-cx, -cy);
        if (game.phase === 'trick' || game.phase === 'give') {
          // Maraş küreği: uzun çubuk sağdan gelir
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(cx + r * 0.2, cy + r * 1.6);
          g.lineTo(W + 20, cy + r * 2.6);
          g.lineWidth = 11;
          g.strokeStyle = '#2a1636';
          g.stroke();
          g.lineWidth = 6;
          g.strokeStyle = '#dfe6ef';
          g.stroke();
        }
        drawCone(g, cx, cy, r);
        let x = cx;
        let y = cy - r * 1.3;
        game.stack.forEach((sc) => {
          x += sc.dx;
          y -= r * 1.42;
          g.save();
          g.translate(x, y + r * 1.42 * 0.5);
          g.rotate(game.angle * 1.1);
          g.translate(-x, -(y + r * 1.42 * 0.5));
          drawScoop(g, x, y + r * 0.72, r, sc.fi, sc.squash);
          g.restore();
        });
        g.restore();
      }
      // Kürek ve üstteki top
      if (game.phase === 'scoop') {
        const px = baseX + Math.sin(game.paddle) * u * 0.34;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(W + 10, paddleY - H * 0.04);
        g.lineTo(px + r * 0.4, paddleY);
        g.lineWidth = 10;
        g.strokeStyle = '#2a1636';
        g.stroke();
        g.lineWidth = 5;
        g.strokeStyle = '#dfe6ef';
        g.stroke();
        rrect(g, px - r * 0.8, paddleY - 4, r * 1.6, 10, 4);
        inked(g, '#dfe6ef', 3);
        if (game.hold) drawScoop(g, px, paddleY - r * 0.55, r * 0.98, game.hold.fi);
        // Hizalama çizgisi
        const top = towerTop();
        g.setLineDash([4, 8]);
        g.beginPath();
        g.moveTo(top.x, paddleY + r);
        g.lineTo(top.x, top.y - r * 1.2);
        g.lineWidth = 2.5;
        g.strokeStyle = '#2a163655';
        g.stroke();
        g.setLineDash([]);
        if (!game.hold && !game.falling) label(g, W / 2, paddleY + r * 1.4, 'Kazandan dondurma seç', { size: Math.max(16, u * 0.05), color: '#fff' });
        else if (game.hold) label(g, W / 2, H * 0.08 + r * 2.8 + (paddleY > 0 ? r : 0), 'Üstüne gelince dokun', { size: Math.max(14, u * 0.042), color: '#fff' });
      }
      if (game.falling) drawScoop(g, game.falling.x, game.falling.y, r, game.falling.fi);
      // Numara: uzanan el ve kocaman ok
      if (game.phase === 'trick' && game.trick) {
        const cx = baseX + game.coneOff.x;
        const cy = baseY - H * 0.14 + game.coneOff.y;
        const hx = -20 + (cx - r * 1.2 + 20) * game.handK;
        const hy = cy - r * 0.2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-20, cy + r);
        g.quadraticCurveTo(hx * 0.5, cy + r * 1.4, hx, hy);
        g.lineWidth = r * 1.1;
        g.strokeStyle = '#2a1636';
        g.stroke();
        g.lineWidth = r * 0.8;
        g.strokeStyle = '#ffd2a8';
        g.stroke();
        g.beginPath();
        g.arc(hx, hy, r * 0.62, 0, 7);
        inked(g, '#ffd2a8', 3);
        if (!game.trick.done) {
          const [ax, ay] = ARROWS[game.trick.dir];
          const bx = W / 2;
          const by = H * 0.33;
          const R = u * 0.1 * (1 + Math.sin(t / 90) * 0.06);
          g.save();
          g.translate(bx, by);
          g.rotate(Math.atan2(ay, ax));
          g.beginPath();
          g.moveTo(-R * 1.2, -R * 0.42);
          g.lineTo(R * 0.1, -R * 0.42);
          g.lineTo(R * 0.1, -R);
          g.lineTo(R * 1.25, 0);
          g.lineTo(R * 0.1, R);
          g.lineTo(R * 0.1, R * 0.42);
          g.lineTo(-R * 1.2, R * 0.42);
          g.closePath();
          inked(g, '#ff5fa2', 5);
          g.restore();
          label(g, bx, by - R * 1.5, 'Kaydır!', { size: Math.max(18, u * 0.06), color: '#fff' });
          // Süre şeridi
          const k = 1 - game.handK;
          rrect(g, W * 0.3, H * 0.115, W * 0.4, 12, 6);
          inked(g, '#fff', 2.5);
          rrect(g, W * 0.3, H * 0.115, W * 0.4 * k, 12, 6);
          g.fillStyle = k > 0.4 ? '#2ed6a0' : '#ff4f62';
          g.fill();
        }
      }
      fx.draw(g, dt);
    };

    nextCustomer();
    my.raf((dt, t) => {
      if (!s.W) return true;
      if (!game.paused && !game.over) step(dt);
      draw(game.paused ? 0 : dt, t);
      return true;
    });
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
  };
}

const ART_DONDURMA = `<svg class="art" viewBox="0 0 200 150"><path d="M74 88 L126 88 L100 146 Z" fill="#e8b061" stroke="#2a1636" stroke-width="4" stroke-linejoin="round"/><path d="M80 96l26 34M96 92l18 24M120 96l-26 34M104 92l-18 24" stroke="#a5682a" stroke-width="2.500"/><circle cx="100" cy="72" r="26" fill="#fff6df" stroke="#2a1636" stroke-width="4"/><circle cx="104" cy="42" r="22" fill="#ff9ec0" stroke="#2a1636" stroke-width="4"/><circle cx="98" cy="18" r="16" fill="#8a5230" stroke="#2a1636" stroke-width="4"/><path d="M196 110 L118 96" stroke="#2a1636" stroke-width="10" stroke-linecap="round"/><path d="M196 110 L118 96" stroke="#dfe6ef" stroke-width="5" stroke-linecap="round"/><g class="a-knife"><path d="M30 60c0-14 10-20 14-20s14 6 14 20l4 10H26z" fill="#ffcd3c" stroke="#2a1636" stroke-width="3.500" stroke-linejoin="round"/><circle cx="44" cy="76" r="5" fill="#c98a10" stroke="#2a1636" stroke-width="2.500"/></g></svg>`;
