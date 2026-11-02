// Kafe Sinemiko: bardağa katman katman dök. Basılı tuttukça akış hızlanır, bırakınca da biraz süzülür.
// Çizgiye ne kadar yakın durursan o kadar yıldız. Taşırırsan bardak gider. Sonunda köpüğe kalp çizersin.

import { Life, html, toHTML, fitCanvas, drag, rand, seeded } from '../core/dom.js';
import { sfx, buzz, steady } from '../core/audio.js';
import { makeFx, inked, label, rrect, shake } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, icon } from '../core/ui.js';
import { customer } from '../core/avatar.js';
import { ART } from '../art.js';

const LIQ = {
  espresso: { name: 'Espresso', c: '#3e2212', c2: '#6a3d1f', foam: '#a9744a' },
  sut: { name: 'Süt', c: '#fff8ee', c2: '#fff', foam: '#ffffff' },
  kopuk: { name: 'Köpük', c: '#fff4e0', c2: '#fffdf8', foam: '#ffffff', thick: true },
  su: { name: 'Sıcak Su', c: '#c9a06f', c2: '#d8b78a', foam: '#efdcc0' },
  cikolata: { name: 'Çikolata', c: '#2e140a', c2: '#4e2612', foam: '#6a3a1e' },
  karamel: { name: 'Karamel', c: '#d98a1f', c2: '#f2a93a', foam: '#ffc76a' },
  cay: { name: 'Demli Çay', c: '#a8331a', c2: '#c9502a', foam: '#d97a4a' },
  cilek: { name: 'Çilek', c: '#ff5f8f', c2: '#ff8fb0', foam: '#ffc2d6' },
  matcha: { name: 'Matcha', c: '#7fb53a', c2: '#a0cf58', foam: '#c9e68a' },
  buz: { name: 'Buzlu Süt', c: '#eaf6ff', c2: '#fff', foam: '#ffffff' },
};

// Tarif: katman adı ve oran (toplam bardağın dolu kısmı); cup: şekil
const MENU = [
  { name: 'Sade Espresso', layers: [['espresso', 0.7]], cup: 'small' },
  { name: 'Americano', layers: [['espresso', 0.3], ['su', 0.55]], cup: 'mug' },
  { name: 'Sütlü Kahve', layers: [['espresso', 0.35], ['sut', 0.45]], cup: 'mug' },
  { name: 'Cappuccino', layers: [['espresso', 0.3], ['sut', 0.3], ['kopuk', 0.3]], cup: 'mug', art: true },
  { name: 'Latte', layers: [['espresso', 0.2], ['sut', 0.55], ['kopuk', 0.15]], cup: 'tall', art: true },
  { name: 'Macchiato', layers: [['sut', 0.5], ['kopuk', 0.15], ['espresso', 0.15]], cup: 'tall' },
  { name: 'Mocha', layers: [['cikolata', 0.2], ['espresso', 0.25], ['sut', 0.3], ['kopuk', 0.15]], cup: 'tall', art: true },
  { name: 'Karamel Latte', layers: [['karamel', 0.12], ['espresso', 0.2], ['sut', 0.45], ['kopuk', 0.13]], cup: 'tall', art: true },
  { name: 'Tavşan Kanı Çay', layers: [['cay', 0.75]], cup: 'ince' },
  { name: 'Açık Çay', layers: [['cay', 0.25], ['su', 0.55]], cup: 'ince' },
  { name: 'Çilekli Süt', layers: [['cilek', 0.25], ['sut', 0.55]], cup: 'wide' },
  { name: 'Matcha Latte', layers: [['matcha', 0.25], ['sut', 0.5], ['kopuk', 0.15]], cup: 'wide', art: true },
  { name: 'Buzlu Karamel', layers: [['karamel', 0.15], ['buz', 0.5], ['espresso', 0.2]], cup: 'tall' },
  { name: 'Üç Renkli', layers: [['cilek', 0.25], ['sut', 0.3], ['matcha', 0.25]], cup: 'wide' },
];

const LEVELS = (() => {
  const out = [];
  for (let i = 0; i < 36; i++) {
    const r = seeded(i + 11);
    const pool = MENU.slice(0, Math.min(MENU.length, 3 + Math.floor(i / 2)));
    const count = Math.min(5, 2 + Math.floor(i / 6));
    const orders = [];
    for (let k = 0; k < count; k++) {
      // Yeni açılan içecek ilk seviyesinde mutlaka gelir
      if (k === 0 && pool.length > 3 && i % 2 === 0) orders.push(MENU.indexOf(pool[pool.length - 1]));
      else orders.push(MENU.indexOf(r.pick(pool)));
    }
    out.push({ orders, seed: i * 7 + 2, tol: Math.max(0.02, 0.05 - i * 0.0008) });
  }
  return out;
})();

// Bardak profili: y (0 alt, 1 üst) için yarım genişlik (0-1)
const CUPS = {
  small: { w: 0.62, h: 0.62, prof: (y) => 0.72 + 0.28 * Math.pow(y, 0.7), handle: true, color: '#fff8ee' },
  mug: { w: 0.74, h: 0.74, prof: (y) => 0.88 + 0.12 * y, handle: true, color: '#fffdf6' },
  tall: { w: 0.56, h: 1, prof: (y) => 0.74 + 0.26 * y, handle: false, color: '#ffffff33', glass: true },
  wide: { w: 0.8, h: 0.8, prof: (y) => 0.64 + 0.36 * Math.sqrt(y), handle: false, color: '#ffffff33', glass: true },
  ince: { w: 0.5, h: 0.86, prof: (y) => (y < 0.5 ? 0.86 - y * 0.36 : 0.68 + (y - 0.5) * 0.64), handle: false, color: '#ffffff33', glass: true },
};

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], best: 0, served: 0, perfect: 0 });
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
      art: ART.kafe,
      sub: 'Tarifi oku, çizgisine kadar dök. Elin titrerse bardak taşar.',
      stats: [['Servis', data.served], ['Tam İsabet', data.perfect]],
      how: [
        'Bardağın üstündeki kesik çizgiler hedef. Her katman kendi çizgisine kadar dökülür.',
        'Sürahiye basılı tut: akış gittikçe hızlanır. Bıraktığında havada kalan damlalar da düşer, biraz önce bırak.',
        'Bir sonraki katmana geçmek için üstteki sıradaki malzeme kendiliğinden gelir. Çizgiyi geçersen yıldız azalır, taşırırsan bardak boşa gider.',
        'Köpüklü içeceklerde sonunda parmağınla kalbin üstünden geç: latte sanatı bahşiş getirir.',
      ],
      levels: { total: LEVELS.length, stars: data.stars, title: 'Vardiyalar', onPick: (i) => play(i) },
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const lv = LEVELS[li];
    f.setTitle(`${li + 1}. Vardiya`);
    f.main.innerHTML = toHTML(html`
      <div class="kf">
        <div class="kf-top"><div class="kf-cust" data-cust></div><div class="kf-order card" data-order></div></div>
        <canvas class="kf-cv"></canvas>
        <div class="kf-bar"><span data-count></span><span data-tip></span></div>
        <div class="kf-ctl">
          <button class="btn btn-main btn-big kf-pour" data-pour>${icon('play')}<span data-pl>Dök</span></button>
          <button class="btn kf-next" data-next>Yeter</button>
        </div>
      </div>`);
    const main = f.main.firstElementChild;
    const s = fitCanvas(main.querySelector('canvas'), my);
    const fx = makeFx({ font: '"Nunito", sans-serif' });
    const pourSnd = steady({ type: 'bandpass', f: 500, q: 1.1 });
    my.add(() => pourSnd.stop());
    st = {
      li, k: 0, scores: [], paused: false, tips: 0, phase: 'pour', fill: [], flow: 0, press: false, drops: [], layer: 0, wave: new Float32Array(40), waveV: new Float32Array(40), over: false, jug: 0, artDone: 0, spill: 0,
    };
    const game = st;
    f.onBack = () => {
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => play(li), onQuit: () => menu() });
    };

    const recipe = () => MENU[lv.orders[game.k]];
    const cupGeo = () => {
      const c = CUPS[recipe().cup];
      const maxH = s.H * 0.58;
      const maxW = Math.min(s.W * 0.52, maxH * 0.72);
      const H = maxH * c.h;
      const W = maxW * c.w * 1.3;
      return { c, H, W, cx: s.W / 2, bottom: s.H * 0.93, top: s.H * 0.93 - H };
    };
    // Katman hedefleri: birikimli doluluk (0-1)
    const targets = () => {
      let acc = 0;
      return recipe().layers.map(([id, v]) => {
        acc += v;
        return { id, v, at: acc };
      });
    };
    const startOrder = () => {
      const r = recipe();
      game.fill = r.layers.map(() => 0);
      game.layer = 0;
      game.flow = 0;
      game.press = false;
      game.drops = [];
      game.phase = 'pour';
      game.wave.fill(0);
      game.waveV.fill(0);
      main.querySelector('[data-cust]').innerHTML = toHTML(customer(lv.seed + game.k * 5, { mood: 'happy' }));
      main.querySelector('[data-cust]').firstElementChild.animate([{ transform: 'translateX(-80px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      main.querySelector('[data-count]').textContent = `Sipariş ${game.k + 1} / ${lv.orders.length}`;
      renderOrder();
      sfx.chime(84);
    };
    const renderOrder = () => {
      const r = recipe();
      main.querySelector('[data-order]').innerHTML = toHTML(html`<b>${r.name}</b><div class="kf-steps">${r.layers.map(([id], i) => html`<span class="kf-step ${i === game.layer ? 'cur' : ''} ${i < game.layer ? 'done' : ''}"><i style="background:${LIQ[id].c}"></i>${LIQ[id].name}</span>`)}</div>`);
      const b = main.querySelector('[data-pl]');
      const cur = r.layers[game.layer];
      if (cur) b.textContent = `${LIQ[cur[0]].name} Dök`;
    };
    const total = () => game.fill.reduce((a, b) => a + b, 0);

    const pourBtn = main.querySelector('[data-pour]');
    my.on(pourBtn, 'pointerdown', (e) => {
      e.preventDefault();
      if (game.phase === 'pour' && !game.paused) {
        game.press = true;
        try { pourBtn.setPointerCapture(e.pointerId); } catch { /* */ }
      }
    });
    const release = () => {
      if (!game.press) return;
      game.press = false;
      game.released = 0;
    };
    my.on(pourBtn, 'pointerup', release);
    my.on(pourBtn, 'pointercancel', release);
    game.setPress = (v) => { if (v && game.phase === 'pour') game.press = true; else release(); };
    game.recipe = recipe;
    game.targets = targets;
    my.on(main.querySelector('[data-next]'), 'click', () => {
      if (game.phase !== 'pour' || game.paused || game.press || game.flow > 0.05) return;
      if (game.fill[game.layer] <= 0.004) {
        sfx.bad();
        return;
      }
      sfx.tap();
      game.queue = 0;
      nextLayer();
    });

    // Bir katman dökülüp bırakılınca, damlalar bitince sonraki katmana geçilir
    const nextLayer = () => {
      const r = recipe();
      game.layer++;
      if (game.layer >= r.layers.length) {
        finishOrder();
        return;
      }
      renderOrder();
      sfx.soft();
    };

    const finishOrder = () => {
      const t = targets();
      let err = 0;
      let acc = 0;
      t.forEach((tg, i) => {
        acc += game.fill[i];
        err = Math.max(err, Math.abs(acc - tg.at));
      });
      game.lastErr = err;
      const r = recipe();
      if (r.art && total() < 1) {
        game.phase = 'art';
        game.artPts = [];
        game.artT = 6;
        game.artScore = 0;
        heartTargets();
        main.querySelector('[data-pl]').textContent = 'Kalbi Çiz';
        pourBtn.disabled = true;
        return;
      }
      serve(0);
    };

    // Köpük sanatı: kalbin üstündeki noktalardan geç
    const heartTargets = () => {
      const pts = [];
      for (let k = 0; k <= 17; k++) {
        const a = (k / 17) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(a), 3);
        const y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
        pts.push({ x: x / 17, y: y / 17, hit: false });
      }
      game.heart = pts;
    };
    const artCenter = () => ({ x: s.W / 2, y: s.H * 0.5, R: Math.min(s.W, s.H) * 0.26 });
    drag(main.querySelector('canvas'), my, {
      down: (p) => artTouch(p),
      move: (p) => artTouch(p),
    });
    const artTouch = (p) => {
      if (game.phase !== 'art' || game.paused) return;
      const a = artCenter();
      game.artPts.push({ x: p.x, y: p.y });
      if (game.artPts.length > 200) game.artPts.shift();
      for (const h of game.heart) {
        if (!h.hit && Math.hypot(a.x + h.x * a.R - p.x, a.y + h.y * a.R - p.y) < a.R * 0.2) {
          h.hit = true;
          sfx.bubble();
          buzz(5);
        }
      }
      const score = game.heart.filter((h) => h.hit).length / game.heart.length;
      if (score >= 1) endArt();
    };
    const endArt = () => {
      const score = game.heart.filter((h) => h.hit).length / game.heart.length;
      game.artDone = score;
      pourBtn.disabled = false;
      serve(score);
    };

    const serve = (art) => {
      const err = game.lastErr;
      const tol = lv.tol;
      // Hata payı: tam isabet 3 yıldız
      let stars = err <= tol ? 3 : err <= tol * 2.2 ? 2 : err <= tol * 4 ? 1 : 0;
      if (game.spill) stars = 0;
      const tip = (stars * 8 + Math.round(art * 12));
      game.scores.push(stars);
      game.tips += tip;
      data.served++;
      if (stars === 3) data.perfect++;
      api.touch();
      const cust = main.querySelector('[data-cust] .blob');
      if (cust) cust.dataset.mood = stars >= 2 ? 'laugh' : stars === 1 ? 'smirk' : 'sad';
      if (cust && stars >= 2) cust.dataset.eyes = 'happy';
      const msg = stars === 3 ? 'Tam Kıvamında!' : stars === 2 ? 'Güzel!' : stars === 1 ? 'İdare Eder' : game.spill ? 'Taştı!' : 'Olmamış';
      const g = cupGeo();
      fx.text(g.cx, g.top - 30, msg, stars >= 2 ? '#ffe27a' : '#ffb0b0', 28);
      if (stars >= 2) fx.burst(g.cx, g.top, { n: 22, colors: ['#ffcd3c', '#fff', '#ff8cc0'], shape: 'heart', power: 300 });
      if (stars === 3) sfx.good();
      else if (stars === 0) sfx.bad();
      else sfx.ding();
      main.querySelector('[data-tip]').textContent = `Bahşiş ${game.tips} ₺`;
      game.phase = 'served';
      game.servedAt = 1.7;
    };

    const nextOrder = () => {
      if (game.k + 1 >= lv.orders.length) {
        finishShift();
        return;
      }
      game.k++;
      startOrder();
    };
    const finishShift = () => {
      game.over = true;
      const avg = game.scores.reduce((a, b) => a + b, 0) / game.scores.length;
      const stars = avg >= 2.6 ? 3 : avg >= 1.8 ? 2 : avg >= 1 ? 1 : 0;
      const prev = data.stars[li] || 0;
      if (stars > prev) data.stars[li] = stars;
      api.touch();
      const coins = stars ? 8 + stars * 6 + Math.floor(game.tips / 6) : 3;
      api.finish({ coins });
      resultSheet({
        won: stars > 0,
        title: stars ? 'Vardiya Bitti' : 'Müşteriler Memnun Değil',
        sub: stars === 3 ? 'Sıraya girip fotoğraf çekiyorlar.' : '',
        stars,
        coins,
        stats: [['Bahşiş', `${game.tips} ₺`], ['Tam İsabet', game.scores.filter((x) => x === 3).length]],
        buttons: [
          ...(stars && li + 1 < LEVELS.length ? [{ label: 'Sonraki Vardiya', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
          { label: 'Tekrar', main: !stars, icon: 'replay', act: () => play(li) },
          { label: 'Menü', icon: 'home', act: () => menu() },
        ],
      });
    };

    const step = (dt) => {
      const r = recipe();
      const cur = r.layers[game.layer];
      if (game.phase === 'pour' && cur) {
        // Akış: basıldıkça artar. Dolum, sürahiden çıkan damlalarla gecikmeli olur
        const target = game.press ? 1 : 0;
        game.flow += (target - game.flow) * Math.min(1, dt * (game.press ? 2.2 : 12));
        if (game.press) game.hold = (game.hold || 0) + dt;
        else game.hold = 0;
        const rate = game.flow * (0.13 + Math.min(0.2, (game.hold || 0) * 0.08));
        if (game.flow > 0.02) {
          game.queue = (game.queue || 0) + rate * dt;
        }
      } else game.flow += (0 - game.flow) * Math.min(1, dt * 12);
      // Düşen sıvı: kısa gecikme
      if (game.queue > 0 && cur) {
        const n = Math.min(game.queue, dt * 0.55);
        game.delay = (game.delay || 0) + dt;
        if (game.delay > 0.16) {
          game.fill[game.layer] += n;
          game.queue -= n;
          const center = 20 + Math.floor(rand(-3, 3));
          game.waveV[center] -= 0.9 * n * 60;
        }
      } else game.delay = 0;
      // Bıraktıktan sonra sıvı bitti: sonraki katman
      // Bırakınca çizgiye geldiyse sıradaki katman; gelmediyse biraz daha dökebilir ya da "Yeter" der
      if (game.phase === 'pour' && !game.press && game.flow < 0.02 && (game.queue || 0) < 0.0005 && game.fill[game.layer] > 0.004) {
        game.queue = 0;
        const tgt = targets()[game.layer].at;
        if (total() >= tgt - lv.tol * 0.7) nextLayer();
      }
      if (total() >= 1 && !game.spill && game.phase !== 'served') {
        game.spill = 1;
        game.press = false;
        game.queue = 0;
        sfx.splat();
        buzz(60);
        shake(main, 7);
        const g = cupGeo();
        for (let k = 0; k < 18; k++) game.drops.push({ x: g.cx + rand(-g.W / 2, g.W / 2), y: g.top, vx: rand(-40, 40), vy: rand(-40, 20), c: LIQ[cur ? cur[0] : 'su'].c2 });
        game.lastErr = 1;
        serve(0);
      }
      // Yüzey dalgası
      const w = game.wave;
      const v = game.waveV;
      for (let k = 1; k < 39; k++) {
        v[k] += (w[k - 1] + w[k + 1] - 2 * w[k]) * 60 * dt - w[k] * 6 * dt;
        v[k] *= 1 - 2.6 * dt;
      }
      for (let k = 1; k < 39; k++) w[k] += v[k] * dt;
      // Dökme sesi: bardak doldukça ince ince yükselir
      const lvl = total();
      pourSnd.set(game.flow > 0.03 ? 0.16 * game.flow : 0, 420 + lvl * 1500);
      if (game.phase === 'art') {
        game.artT -= dt;
        if (game.artT <= 0) endArt();
      }
      if (game.phase === 'served') {
        game.servedAt -= dt;
        if (game.servedAt <= 0) {
          game.phase = 'wait';
          nextOrder();
        }
      }
    };

    const cupPath = (g, geo, inset = 0) => {
      const { c, W, H, cx, bottom } = geo;
      g.beginPath();
      const N = 24;
      for (let k = 0; k <= N; k++) {
        const y = k / N;
        const px = cx - (W / 2) * c.prof(y) + inset;
        const py = bottom - y * H - (inset ? -inset : 0);
        if (k) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      for (let k = N; k >= 0; k--) {
        const y = k / N;
        g.lineTo(cx + (W / 2) * c.prof(y) - inset, bottom - y * H - (inset ? -inset : 0));
      }
      g.closePath();
    };

    const draw = (dt, t) => {
      const { g } = s;
      s.begin();
      const geo = cupGeo();
      const { c, W, H, cx, bottom, top } = geo;
      // Duvar: krem fayans, raf, sarkan lamba
      g.fillStyle = '#f6e3c8';
      g.fillRect(0, 0, s.W, bottom);
      g.fillStyle = '#e9d0ac';
      for (let yy = 0; yy < bottom; yy += 34) {
        g.fillRect(0, yy, s.W, 2);
        for (let xx = (Math.floor(yy / 34) % 2) * 26; xx < s.W; xx += 52) g.fillRect(xx, yy, 2, 34);
      }
      g.fillStyle = '#8a5a36';
      g.fillRect(0, s.H * 0.13, s.W * 0.3, 7);
      g.fillRect(s.W * 0.72, s.H * 0.13, s.W * 0.28, 7);
      [[s.W * 0.05, '#ff8cc0'], [s.W * 0.16, '#7fd6ff'], [s.W * 0.78, '#ffcd3c'], [s.W * 0.9, '#a6e35a']].forEach(([x, col]) => {
        rrect(g, x, s.H * 0.13 - 22, 20, 22, 4);
        inked(g, col, 2.5);
      });
      const lampG = g.createRadialGradient(s.W / 2, 0, 10, s.W / 2, 0, s.H * 0.55);
      lampG.addColorStop(0, '#fff6c855');
      lampG.addColorStop(1, '#fff6c800');
      g.fillStyle = lampG;
      g.fillRect(0, 0, s.W, s.H);
      // Tezgah
      g.fillStyle = '#7a4a2a';
      g.fillRect(0, bottom - 2, s.W, s.H - bottom + 2);
      g.fillStyle = '#2a1636';
      g.fillRect(0, bottom - 2, s.W, 4);
      // Sürahi
      const r = recipe();
      const cur = r.layers[game.layer];
      const jugId = cur ? cur[0] : r.layers[r.layers.length - 1][0];
      const tilt = game.flow;
      const jx = cx + W * 0.42;
      const jy = top - 62 + (1 - tilt) * -6;
      g.save();
      g.translate(jx, jy);
      g.rotate(-0.25 - tilt * 0.7);
      rrect(g, -18, -30, 46, 56, 10);
      inked(g, '#dfe6ef', 3.5);
      rrect(g, -14, -14, 38, 36, 8);
      g.fillStyle = LIQ[jugId].c;
      g.fill();
      g.beginPath();
      g.moveTo(-18, -24);
      g.lineTo(-30, -30);
      g.lineTo(-18, -12);
      inked(g, '#dfe6ef', 3);
      g.beginPath();
      g.arc(30, -2, 12, -1.2, 1.2);
      g.lineWidth = 5;
      g.strokeStyle = '#2a1636';
      g.stroke();
      g.restore();
      // Akış çizgisi
      const lipX = jx - Math.cos(0.25 + tilt * 0.7) * 30 - 4;
      const lipY = jy - 16 + tilt * 18;
      if ((game.flow > 0.03 || (game.queue || 0) > 0.001) && cur) {
        const fillTop = bottom - Math.min(1, total()) * H;
        const wFlow = 2 + game.flow * 7;
        g.beginPath();
        g.moveTo(lipX, lipY);
        g.quadraticCurveTo(lipX - 6, (lipY + fillTop) / 2, cx, fillTop);
        g.lineWidth = wFlow + 3;
        g.strokeStyle = '#2a163655';
        g.stroke();
        g.lineWidth = wFlow;
        g.strokeStyle = LIQ[cur[0]].c2;
        g.stroke();
      }
      // Sıvı: bardağın şekliyle kesilir
      g.save();
      cupPath(g, geo, 3);
      g.clip();
      if (c.glass) {
        g.fillStyle = '#ffffff2e';
        g.fillRect(cx - W, top, W * 2, H);
      } else {
        g.fillStyle = '#fff';
        g.fillRect(cx - W, top, W * 2, H);
      }
      let acc = 0;
      r.layers.forEach(([id], i) => {
        const v = game.fill[i] || 0;
        if (v <= 0) return;
        const y0 = bottom - acc * H;
        const y1 = bottom - (acc + v) * H;
        const grad = g.createLinearGradient(0, y0, 0, y1);
        grad.addColorStop(0, LIQ[id].c);
        grad.addColorStop(1, LIQ[id].c2);
        g.fillStyle = grad;
        const isTop = i === game.layer || i === r.layers.length - 1;
        g.beginPath();
        g.moveTo(cx - W, y0 + 1);
        g.lineTo(cx - W, y1);
        const seg = (W * 2) / 39;
        for (let k = 0; k < 40; k++) g.lineTo(cx - W + k * seg, y1 + (isTop ? game.wave[k] * 3 : 0));
        g.lineTo(cx + W, y0 + 1);
        g.closePath();
        g.fill();
        if (LIQ[id].thick) {
          g.fillStyle = '#ffffffaa';
          for (let k = 0; k < 7; k++) {
            g.beginPath();
            g.arc(cx - W / 2 + (k * W) / 6, y1 + 5 + Math.sin(k * 2 + t / 500) * 2, 7, 0, 7);
            g.fill();
          }
        }
        acc += v;
      });
      g.restore();
      // Hedef çizgileri
      const tg = targets();
      tg.forEach((x, i) => {
        const y = bottom - x.at * H;
        const done = i < game.layer;
        const cur2 = i === game.layer;
        g.setLineDash([6, 5]);
        g.beginPath();
        const hw = (W / 2) * c.prof(x.at) + 10;
        g.moveTo(cx - hw, y);
        g.lineTo(cx + hw, y);
        g.lineWidth = cur2 ? 3.5 : 2;
        g.strokeStyle = cur2 ? '#ff5fa2' : done ? '#2a163655' : '#2a1636aa';
        g.stroke();
        g.setLineDash([]);
        if (cur2) label(g, Math.min(s.W - 70, cx + hw + 6), y - 11, LIQ[x.id].name, { size: 13, align: 'left', font: '"Nunito", sans-serif', color: '#fff', stroke: '#c9266e' });
      });
      // Bardak kenarı
      cupPath(g, geo);
      g.lineWidth = 5;
      g.strokeStyle = '#2a1636';
      g.stroke();
      if (c.handle) {
        g.beginPath();
        g.arc(cx + W / 2 + 6, bottom - H * 0.5, H * 0.22, -1.3, 1.3);
        g.lineWidth = 8;
        g.strokeStyle = '#2a1636';
        g.stroke();
        g.lineWidth = 3;
        g.strokeStyle = '#fff8ee';
        g.stroke();
      }
      if (c.glass) {
        g.fillStyle = '#ffffff55';
        g.fillRect(cx - W * 0.33, top + 10, 6, H * 0.7);
      }
      // Dökülen damlalar
      for (const d of game.drops) {
        d.vy += 800 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y < s.H) {
          g.beginPath();
          g.arc(d.x, d.y, 4, 0, 7);
          g.fillStyle = d.c;
          g.fill();
        }
      }
      // Köpük sanatı: üstten görünen fincan
      if (game.phase === 'art') {
        const a = artCenter();
        g.fillStyle = '#2a163688';
        g.fillRect(0, 0, s.W, s.H);
        g.beginPath();
        g.arc(a.x, a.y, a.R * 1.45, 0, 7);
        inked(g, '#fffdf6', 5);
        g.beginPath();
        g.arc(a.x, a.y, a.R * 1.28, 0, 7);
        const last = r.layers[r.layers.length - 1][0];
        g.fillStyle = LIQ[last].thick ? '#c58f5a' : LIQ[last].c;
        g.fill();
        g.setLineDash([3, 9]);
        g.beginPath();
        game.heart.forEach((h, i) => (i ? g.lineTo(a.x + h.x * a.R, a.y + h.y * a.R) : g.moveTo(a.x + h.x * a.R, a.y + h.y * a.R)));
        g.lineWidth = 3;
        g.strokeStyle = '#ffffff99';
        g.stroke();
        g.setLineDash([]);
        for (const h of game.heart) {
          g.beginPath();
          g.arc(a.x + h.x * a.R, a.y + h.y * a.R, h.hit ? 7 : 4, 0, 7);
          g.fillStyle = h.hit ? '#fff8ee' : '#ffffffaa';
          g.fill();
        }
        if (game.artPts.length > 1) {
          g.beginPath();
          game.artPts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.lineWidth = 11;
          g.strokeStyle = '#fff8ee';
          g.stroke();
        }
        label(g, a.x, a.y - a.R * 1.72, 'Kalbin üstünden geç', { size: 19, font: '"Pacifico", cursive', color: '#fff', sw: 0.2 });
        label(g, a.x, a.y + a.R * 1.72, `${Math.ceil(game.artT)} sn`, { size: 18, font: '"Nunito", sans-serif' });
      }
      fx.draw(g, dt);
    };

    startOrder();
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

