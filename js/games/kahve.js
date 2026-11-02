// Kahvehane: karşında Furkan var. İki masa kurulu: tavla ve pişti.
// Tavla tam kurallı (kırık pul, toplama, çift zar, mars). Pişti gerçek puanlamayla (pişti 10, vale pişti 20, koz 10'u 3, sinek 2'si 2).

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, randInt, shuffle, pick } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, rrect, label, inked, shake, pop, popIn } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, openSheet, toast, icon } from '../core/ui.js';
import { blob } from '../core/avatar.js';
import { ART } from '../art.js';

const SAYS = {
  basla: ['Hadi bakalım, kahveler benden.', 'Bu sefer kolay kurtulmazsın.', 'Zarlar bugün benden yana.'],
  iyi: ['Vay be, nereden öğrendin bunu?', 'Tamam tamam, gördüm seni.', 'Şansın mı var yoksa ustalık mı?'],
  kotu: ['Ooo, orası acıttı.', 'Yandık.', 'Bir dahakine.'],
  kazandi: ['Çaylar sende!', 'Ustana saygı.', 'İşte bu.'],
  kaybetti: ['Helal olsun, kazandın.', 'Rövanş isterim.', 'Bugün senin günün.'],
};

/* ================= TAVLA ================= */
// Noktalar 0..23. Sinem (0) 23'ten 0'a doğru gider ve 0..5 evine toplar.
// Furkan (1) 0'dan 23'e gider, 18..23 evine toplar. bar/off ayrı sayaçlar.
const startBoard = () => {
  const p = Array.from({ length: 24 }, () => ({ n: 0, o: -1 }));
  const set = (i, o, n) => { p[i] = { n, o }; };
  set(23, 0, 2); set(12, 0, 5); set(7, 0, 3); set(5, 0, 5);
  set(0, 1, 2); set(11, 1, 5); set(16, 1, 3); set(18, 1, 5);
  return { p, bar: [0, 0], off: [0, 0] };
};
const dirOf = (o) => (o === 0 ? -1 : 1);
const homeOf = (o) => (o === 0 ? [0, 5] : [18, 23]);
const entryOf = (o, d) => (o === 0 ? 24 - d : d - 1);
const allHome = (b, o) => {
  const [lo, hi] = homeOf(o);
  if (b.bar[o]) return false;
  for (let i = 0; i < 24; i++) if (b.p[i].o === o && b.p[i].n && (i < lo || i > hi)) return false;
  return true;
};
const pipOf = (b, o) => {
  let s = b.bar[o] * 25;
  for (let i = 0; i < 24; i++) if (b.p[i].o === o && b.p[i].n) s += b.p[i].n * (o === 0 ? i + 1 : 24 - i);
  return s;
};
const cloneB = (b) => ({ p: b.p.map((q) => ({ ...q })), bar: b.bar.slice(), off: b.off.slice() });

// Bir zarla yapılabilecek hamleler. from: -1 bar demek, to: -1 toplama demek
function movesFor(b, o, d) {
  const out = [];
  const dir = dirOf(o);
  if (b.bar[o]) {
    const to = entryOf(o, d);
    const t = b.p[to];
    if (t.o === o || t.n === 0 || t.n === 1) out.push({ from: -1, to, d });
    return out;
  }
  for (let i = 0; i < 24; i++) {
    const s = b.p[i];
    if (s.o !== o || !s.n) continue;
    const to = i + dir * d;
    if (to >= 0 && to < 24) {
      const t = b.p[to];
      if (t.o === o || t.n === 0 || t.n === 1) out.push({ from: i, to, d });
    }
  }
  if (allHome(b, o)) {
    const exact = o === 0 ? d - 1 : 24 - d;
    if (b.p[exact] && b.p[exact].o === o && b.p[exact].n) out.push({ from: exact, to: -1, d });
    else {
      // Daha uzaktaki pul yoksa daha yakın puldan toplanır
      const [lo, hi] = homeOf(o);
      let far = -1;
      for (let i = lo; i <= hi; i++) {
        const j = o === 0 ? hi - (i - lo) : i;
        if (b.p[j].o === o && b.p[j].n) { far = j; break; }
      }
      const farDist = far < 0 ? 0 : (o === 0 ? far + 1 : 24 - far);
      if (far >= 0 && farDist < d) out.push({ from: far, to: -1, d });
    }
  }
  return out;
}
function applyMove(b, o, m) {
  const nb = cloneB(b);
  if (m.from === -1) nb.bar[o] = Math.max(0, nb.bar[o] - 1);
  else {
    nb.p[m.from].n--;
    if (!nb.p[m.from].n) nb.p[m.from].o = -1;
  }
  if (m.to === -1) nb.off[o]++;
  else {
    const t = nb.p[m.to];
    if (t.o !== o && t.n === 1) {
      nb.bar[1 - o]++;
      t.n = 0;
      t.o = -1;
      nb.hit = true;
    }
    t.o = o;
    t.n++;
  }
  return nb;
}
// Kural: iki zar da oynanabiliyorsa ikisi de oynanmalı, tek oynanıyorsa büyüğü
function bestSequences(b, o, dice) {
  let best = [];
  let bestLen = 0;
  const walk = (bd, left, acc) => {
    if (acc.length > bestLen) { bestLen = acc.length; best = [acc.slice()]; } else if (acc.length === bestLen && acc.length) best.push(acc.slice());
    for (let i = 0; i < left.length; i++) {
      const d = left[i];
      const ms = movesFor(bd, o, d);
      for (const m of ms) {
        const rest = left.slice(0, i).concat(left.slice(i + 1));
        acc.push(m);
        walk(applyMove(bd, o, m), rest, acc);
        acc.pop();
      }
    }
  };
  walk(b, dice.slice(), []);
  if (!bestLen) return { len: 0, firstMoves: [] };
  // Tek hamle oynanabiliyorsa büyük zar tercih edilir
  if (bestLen === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(...dice);
    const hasBig = best.some((s) => s[0].d === big);
    if (hasBig) best = best.filter((s) => s[0].d === big);
  }
  return { len: bestLen, firstMoves: best.map((s) => s[0]) };
}

/* ================= PİŞTİ ================= */
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const newDeck = () => shuffle(SUITS.flatMap((s) => RANKS.map((r) => ({ s, r }))));
const cardPts = (c) => (c.r === 'A' || c.r === 'J' ? 1 : c.r === '10' && c.s === '♦' ? 3 : c.r === '2' && c.s === '♣' ? 2 : 0);

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ tavla: { w: 0, l: 0 }, pisti: { w: 0, l: 0 }, stars: [] });
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
      art: ART.kahve,
      sub: 'Furkan köşedeki masada bekliyor. Çay söylendi bile.',
      stats: [['Tavla', `${data.tavla.w} - ${data.tavla.l}`], ['Pişti', `${data.pisti.w} - ${data.pisti.l}`]],
      how: [
        'Tavla: zarını at, pulunu seç, gideceği yere dokun. Kırılan pul bardan girer.',
        'Tavla: bütün pulların eve girince toplamaya başlarsın. Rakip tek pul toplayamadan bitirirsen mars.',
        'Pişti: yerdeki kağıdın aynısını ya da vale at, deste senin olur. Yerde tek kağıt varken alırsan pişti.',
        'Pişti puanı: pişti 10, vale ile pişti 20, karo 10 üç puan, sinek 2 iki puan, as ve valeler birer puan, çok kağıt toplayana 3 puan.',
      ],
      buttons: [
        { label: 'Tavla', main: true, icon: 'play', act: () => tavla() },
        { label: 'Pişti', main: true, icon: 'play', act: () => pisti() },
      ],
    });
  }

  const sayBox = (text) => html`<div class="kh-say"><span class="kh-blob">${blob(0, { mood: 'happy', hands: false })}</span><p data-say>${text}</p></div>`;

  /* ---------------- TAVLA ---------------- */
  function tavla() {
    end();
    local = new Life();
    const my = local;
    const fx = makeFx();
    const game = {
      b: startBoard(), turn: 0, dice: [], used: [], sel: null, over: false, paused: false,
      rolling: 0, msg: '', anim: [], mode: 'tavla', moved: [0, 0], rolls: [0, 0], seq: 0,
    };
    st = game;
    f.setTitle('Tavla');
    f.main.innerHTML = toHTML(html`
      <div class="kh kh-tavla">
        ${sayBox(pick(SAYS.basla))}
        <canvas class="kh-cv"></canvas>
        <div class="kh-bar">
          <span class="kh-dice" data-dice></span>
          <button class="kh-b" data-act="roll">${icon('play')}Zar At</button>
          <span class="kh-pip" data-pip></span>
        </div>
      </div>`);
    const wrap = f.main.querySelector('.kh');
    const cv = wrap.querySelector('.kh-cv');
    const diceEl = wrap.querySelector('[data-dice]');
    const pipEl = wrap.querySelector('[data-pip]');
    const sayEl = wrap.querySelector('[data-say]');
    const rollBtn = wrap.querySelector('[data-act="roll"]');
    const stage = fitCanvas(cv, my);
    const say = (t) => { sayEl.textContent = t; pop(sayEl.parentElement, 1.04); };

    const live = () => game.dice.filter((d, i) => !game.used[i]);
    const syncHud = () => {
      diceEl.innerHTML = toHTML(html`${game.dice.map((d, i) => html`<i class="${game.used[i] ? 'off' : ''}">${d}</i>`)}`);
      pipEl.textContent = `${pipOf(game.b, 0)} - ${pipOf(game.b, 1)}`;
      rollBtn.disabled = game.turn !== 0 || game.dice.length > 0 || game.over;
      rollBtn.classList.toggle('glow', !rollBtn.disabled);
    };

    function rollDice(who) {
      if (game.over || game.turn !== who) return;
      game.rolls[who]++;
      const token = ++game.seq;
      const a = randInt(1, 6);
      const b = randInt(1, 6);
      game.dice = a === b ? [a, a, a, a] : [a, b];
      game.used = game.dice.map(() => false);
      game.rolling = 0.45;
      sfx.dice();
      buzz(14);
      syncHud();
      my.timeout(() => {
        if (!my.alive || game.over || game.seq !== token || game.turn !== who) return;
        const seq = bestSequences(game.b, who, live());
        if (!seq.len) {
          say(who === 0 ? 'Hamlen yok, sıra bende.' : 'Zarım tutmadı.');
          endTurn();
        } else if (who === 1) aiPlay();
      }, 440);
    }

    function endTurn() {
      game.seq++;
      game.dice = [];
      game.used = [];
      game.sel = null;
      game.turn = 1 - game.turn;
      syncHud();
      const token = game.seq;
      if (game.turn === 1 && !game.over) my.timeout(() => { if (game.seq === token && game.turn === 1) rollDice(1); }, 520);
    }

    function checkOver() {
      for (const o of [0, 1]) {
        if (game.b.off[o] === 15) {
          game.over = true;
          const mars = game.b.off[1 - o] === 0;
          const won = o === 0;
          data[won ? 'tavla' : 'tavla'][won ? 'w' : 'l']++;
          api.touch();
          const coins = won ? (mars ? 26 : 16) : 4;
          api.finish({ coins });
          say(won ? pick(SAYS.kaybetti) : pick(SAYS.kazandi));
          my.timeout(() => {
            resultSheet({
              won,
              title: won ? (mars ? 'Mars Ettin!' : 'Kazandın!') : mars ? 'Mars Oldun' : 'Furkan Kazandı',
              sub: won ? 'Çaylar Furkan\'dan.' : 'Bir daha dene, zarlar döner.',
              coins,
              stats: [['Senin Pulun', `${game.b.off[0]} / 15`], ['Furkan', `${game.b.off[1]} / 15`], ['Skor', `${data.tavla.w} - ${data.tavla.l}`]],
              buttons: [
                { label: 'Yeni Oyun', main: true, icon: 'replay', act: () => tavla() },
                { label: 'Pişti Oynayalım', icon: 'play', act: () => pisti() },
                { label: 'Masadan Kalk', icon: 'list', act: () => menu() },
              ],
            });
          }, 900);
          return true;
        }
      }
      return false;
    }

    function doMove(o, m) {
      if (game.over || !m) return;
      const legal = live().flatMap((d) => movesFor(game.b, o, d));
      const ok = legal.find((q) => q.from === m.from && q.to === m.to && q.d === m.d);
      if (!ok) {
        // Sıra değişmiş ya da tahta kaymış: elimizdeki hamleyi değil, şu an geçerli olanı oyna
        if (!legal.length) { if (o === 0) endTurn(); return; }
        m = legal[0];
      }
      game.b = applyMove(game.b, o, m);
      game.moved[o]++;
      const i = game.dice.findIndex((d, k) => d === m.d && !game.used[k]);
      if (i >= 0) game.used[i] = true;
      game.sel = null;
      sfx.tile();
      if (game.b.hit) {
        sfx.thud();
        buzz(26);
        shake(wrap, 6);
        say(o === 0 ? pick(SAYS.kotu) : 'Kırdım seni!');
        delete game.b.hit;
      }
      if (m.to === -1) {
        sfx.coin();
        fx.text(stage.W / 2, stage.H / 2, 'Topladın!', '#ffcd3c', 24);
      }
      syncHud();
      if (checkOver()) return;
      const seq = bestSequences(game.b, o, live());
      if (!seq.len) {
        if (o === 0) endTurn();
      }
    }

    // Furkan: hamleleri puanlar, en iyisini oynar
    function evalPos(b) {
      let s = (pipOf(b, 0) - pipOf(b, 1)) * 1.0 + b.off[1] * 14 - b.off[0] * 14 - b.bar[1] * 22 + b.bar[0] * 20;
      for (let i = 0; i < 24; i++) {
        const q = b.p[i];
        if (!q.n) continue;
        if (q.o === 1) {
          if (q.n === 1) s -= 9 - Math.abs(12 - i) * 0.3;
          if (q.n >= 2) s += 5 + (i >= 16 ? 3 : 0);
        } else if (q.n === 1) s += 5;
      }
      return s;
    }
    function aiPlay() {
      if (game.over || !my.alive || game.turn !== 1) return;
      const seq = bestSequences(game.b, 1, live());
      if (!seq.len) {
        const token = game.seq;
        my.timeout(() => { if (!game.over && game.seq === token) { say('Pas geçiyorum.'); endTurn(); } }, 500);
        return;
      }
      const token = game.seq;
      let best = null;
      for (const m of seq.firstMoves) {
        const v = evalPos(applyMove(game.b, 1, m));
        if (!best || v > best.v) best = { m, v };
      }
      my.timeout(() => {
        if (game.over || !my.alive || game.turn !== 1 || game.seq !== token) return;
        doMove(1, best.m);
        if (game.over) return;
        if (bestSequences(game.b, 1, live()).len) aiPlay();
        else my.timeout(() => { if (!game.over && game.seq === token && game.turn === 1) endTurn(); }, 400);
      }, game.moved[1] ? 340 : 560);
    }

    /* Yerleşim ve dokunma */
    let L = null;
    const layout = () => {
      const { W, H } = stage;
      const land = W > H;
      const bw = Math.min(W - 8, land ? W - 8 : W - 8);
      const bh = Math.min(H - 8, bw * (land ? 0.62 : 1.25));
      const x0 = (W - bw) / 2;
      const y0 = (H - bh) / 2;
      const barW = bw * 0.07;
      const colW = (bw - barW) / 12;
      L = { x0, y0, bw, bh, barW, colW, pr: Math.min(colW * 0.42, bh * 0.055) };
    };
    // Nokta i'nin ekrandaki yeri: alt sıra 0..11 sağdan sola, üst sıra 12..23 soldan sağa
    const ptRect = (i) => {
      const { x0, y0, bw, bh, barW, colW } = L;
      const bottom = i < 12;
      const k = bottom ? 11 - i : i - 12;
      const side = k < 6 ? 0 : 1;
      const x = x0 + k * colW + (side ? barW : 0);
      const y = bottom ? y0 + bh / 2 : y0;
      return { x, y, w: colW, h: bh / 2, bottom };
    };
    const pointAt = (px, py) => {
      for (let i = 0; i < 24; i++) {
        const r = ptRect(i);
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
      }
      return -2;
    };

    my.on(cv, 'pointerdown', (e) => {
      if (game.turn !== 0 || game.over || game.paused || !live().length) return;
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const i = pointAt(px, py);
      const offZone = px > L.x0 + L.bw - L.colW * 0.6 && py > L.y0 + L.bh * 0.44 && py < L.y0 + L.bh * 0.56;
      const opts = live().flatMap((d) => movesFor(game.b, 0, d));
      if (game.sel !== null) {
        const m = opts.find((q) => q.from === game.sel && (offZone ? q.to === -1 : q.to === i));
        if (m) { doMove(0, m); return; }
      }
      if (game.b.bar[0]) {
        const m = opts.find((q) => q.from === -1 && q.to === i);
        if (m) { doMove(0, m); return; }
        game.sel = -1;
        sfx.soft();
        return;
      }
      if (i >= 0 && game.b.p[i].o === 0 && game.b.p[i].n && opts.some((q) => q.from === i)) {
        game.sel = i;
        sfx.tap();
      } else {
        game.sel = null;
        sfx.soft();
      }
    });

    f.onBack = () => {
      if (game.over) { menu(); return; }
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => tavla(), onQuit: () => menu() });
    };

    my.on(wrap, 'click', (e) => {
      if (!e.target.closest('[data-act="roll"]')) return;
      if (game.turn !== 0 || game.dice.length || game.over) return;
      rollDice(0);
    });

    syncHud();
    my.raf((dt, t) => {
      const { W, H, g } = stage;
      stage.begin();
      layout();
      const { x0, y0, bw, bh, barW, colW, pr } = L;
      g.fillStyle = '#3a2416';
      g.fillRect(0, 0, W, H);
      rrect(g, x0 - 5, y0 - 5, bw + 10, bh + 10, 10);
      g.fillStyle = '#5d3a20';
      g.fill();
      g.fillStyle = '#c8a06a';
      g.fillRect(x0, y0, bw, bh);
      // Üçgenler
      for (let i = 0; i < 24; i++) {
        const r = ptRect(i);
        const dark = i % 2 === 0;
        g.beginPath();
        if (r.bottom) {
          g.moveTo(r.x + 1, r.y + r.h);
          g.lineTo(r.x + r.w - 1, r.y + r.h);
          g.lineTo(r.x + r.w / 2, r.y + r.h * 0.18);
        } else {
          g.moveTo(r.x + 1, r.y);
          g.lineTo(r.x + r.w - 1, r.y);
          g.lineTo(r.x + r.w / 2, r.y + r.h * 0.82);
        }
        g.closePath();
        g.fillStyle = dark ? '#8a4a2a' : '#f0dcb4';
        g.fill();
        if (game.sel !== null && game.sel !== -1) {
          const opts = live().flatMap((d) => movesFor(game.b, 0, d)).filter((q) => q.from === game.sel);
          if (opts.some((q) => q.to === i)) {
            g.fillStyle = 'rgba(80,255,160,.45)';
            g.fill();
          }
        }
      }
      // Orta bar
      g.fillStyle = '#5d3a20';
      g.fillRect(x0 + colW * 6, y0, barW, bh);
      // Pullar
      const drawChecker = (cx, cy, o, hi) => {
        g.beginPath();
        g.arc(cx, cy, pr, 0, Math.PI * 2);
        g.fillStyle = o === 0 ? '#fff6e8' : '#2a1636';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = hi ? '#2ee6a0' : o === 0 ? '#b89a72' : '#0f0820';
        g.stroke();
        g.beginPath();
        g.arc(cx, cy, pr * 0.55, 0, Math.PI * 2);
        g.strokeStyle = o === 0 ? '#e2cba8' : '#4a3a66';
        g.lineWidth = 2;
        g.stroke();
      };
      for (let i = 0; i < 24; i++) {
        const q = game.b.p[i];
        if (!q.n) continue;
        const r = ptRect(i);
        const n = Math.min(q.n, 5);
        for (let k = 0; k < n; k++) {
          const cy = r.bottom ? r.y + r.h - pr - k * pr * 1.75 : r.y + pr + k * pr * 1.75;
          drawChecker(r.x + r.w / 2, cy, q.o, game.sel === i && k === n - 1);
        }
        if (q.n > 5) label(g, r.x + r.w / 2, r.bottom ? r.y + r.h - pr * 9 : r.y + pr * 9, `${q.n}`, { size: pr, color: '#fff', stroke: '#2a1636' });
      }
      // Bar ve toplananlar
      for (const o of [0, 1]) {
        for (let k = 0; k < game.b.bar[o]; k++) {
          drawChecker(x0 + colW * 6 + barW / 2, y0 + bh / 2 + (o === 0 ? 1 : -1) * (pr + k * pr * 1.6 + 6), o, game.sel === -1 && o === 0);
        }
        for (let k = 0; k < game.b.off[o]; k++) {
          g.fillStyle = o === 0 ? '#fff6e8' : '#2a1636';
          g.fillRect(x0 + bw - colW * 0.5, o === 0 ? y0 + bh - 8 - k * 5 : y0 + 4 + k * 5, colW * 0.42, 4);
        }
      }
      if (allHome(game.b, 0) && game.turn === 0) {
        g.strokeStyle = 'rgba(80,255,160,.8)';
        g.lineWidth = 3;
        g.strokeRect(x0 + bw - colW * 0.62, y0 + bh * 0.44, colW * 0.6, bh * 0.12);
      }
      // Zarlar masanın ortasında
      if (game.rolling > 0) game.rolling -= dt;
      game.dice.forEach((d, i) => {
        const dx = x0 + bw * (game.turn === 0 ? 0.62 : 0.24) + i * (pr * 2.4);
        const dy = y0 + bh / 2 - pr;
        const v = game.rolling > 0 ? randInt(1, 6) : d;
        rrect(g, dx, dy, pr * 2, pr * 2, pr * 0.4);
        g.fillStyle = game.used[i] ? '#9a8f80' : '#fff';
        g.fill();
        g.lineWidth = 2.5;
        g.strokeStyle = '#2a1636';
        g.stroke();
        const pips = [[], [[0.5, 0.5]], [[0.28, 0.28], [0.72, 0.72]], [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
          [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
          [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
          [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]]][v];
        g.fillStyle = '#2a1636';
        for (const [ux, uy] of pips) {
          g.beginPath();
          g.arc(dx + ux * pr * 2, dy + uy * pr * 2, pr * 0.16, 0, Math.PI * 2);
          g.fill();
        }
      });
      fx.draw(g, game.paused ? 0 : dt);
      return undefined;
    });

    game.roll = () => { if (game.turn === 0 && !game.dice.length && !game.over) rollDice(0); };
    game.human = () => {
      if (game.turn !== 0 || game.over) return false;
      const opts = live().flatMap((d) => movesFor(game.b, 0, d));
      if (!opts.length) return false;
      const seq = bestSequences(game.b, 0, live());
      const m = seq.firstMoves[0] || opts[0];
      doMove(0, m);
      return true;
    };
  }

  /* ---------------- PİŞTİ ---------------- */
  function pisti() {
    end();
    local = new Life();
    const my = local;
    const fx = makeFx();
    const game = {
      deck: [], hands: [[], []], table: [], taken: [[], []], pts: [0, 0], pisti: [0, 0],
      turn: 0, last: -1, over: false, paused: false, mode: 'pisti', round: 1, anim: null,
    };
    st = game;
    f.setTitle('Pişti');
    f.main.innerHTML = toHTML(html`
      <div class="kh kh-pisti">
        ${sayBox('Dört kağıt sana, dört bana. Başla bakalım.')}
        <div class="ps-score"><span>Sen <b data-p0>0</b></span><span class="ps-deck" data-deck>52</span><span>Furkan <b data-p1>0</b></span></div>
        <div class="ps-foe" data-foe></div>
        <div class="ps-table" data-table></div>
        <div class="ps-hand" data-hand></div>
      </div>`);
    const wrap = f.main.querySelector('.kh');
    const sayEl = wrap.querySelector('[data-say]');
    const handEl = wrap.querySelector('[data-hand]');
    const tableEl = wrap.querySelector('[data-table]');
    const foeEl = wrap.querySelector('[data-foe]');
    const deckEl = wrap.querySelector('[data-deck]');
    const say = (t) => { sayEl.textContent = t; pop(sayEl.parentElement, 1.04); };

    const cardHTML = (c, cls = '') => html`<span class="pc ${cls} ${c.s === '♥' || c.s === '♦' ? 'red' : ''}"><b>${c.r}</b><i>${c.s}</i></span>`;
    const render = () => {
      handEl.innerHTML = toHTML(html`${game.hands[0].map((c, i) => html`<button class="pc-btn" data-card="${i}">${cardHTML(c)}</button>`)}`);
      foeEl.innerHTML = toHTML(html`${game.hands[1].map(() => html`<span class="pc back"></span>`)}`);
      const t = game.table;
      tableEl.innerHTML = toHTML(html`
        ${t.length ? html`<span class="ps-pile">${t.slice(-3).map((c, i) => html`<span class="pc-stack" style="--i:${i}">${cardHTML(c)}</span>`)}${t.length > 1 ? html`<i class="ps-count">${t.length}</i>` : ''}</span>` : html`<span class="ps-empty">Yer boş</span>`}`);
      wrap.querySelector('[data-p0]').textContent = game.pts[0];
      wrap.querySelector('[data-p1]').textContent = game.pts[1];
      deckEl.textContent = game.deck.length;
      handEl.querySelectorAll('.pc-btn').forEach((n, i) => popIn(n, i * 40));
    };

    function deal() {
      for (const o of [0, 1]) while (game.hands[o].length < 4 && game.deck.length) game.hands[o].push(game.deck.pop());
      render();
    }
    function start() {
      game.deck = newDeck();
      game.table = game.deck.splice(0, 4);
      // Açılışta yerdeki son kağıt vale olmasın
      let guard = 0;
      while (game.table[3].r === 'J' && guard++ < 20) {
        game.deck.push(game.table.pop());
        game.table.push(game.deck.shift());
      }
      deal();
    }
    start();

    function score(o, pistiKind) {
      const cards = game.taken[o];
      if (pistiKind) {
        game.pts[o] += pistiKind === 'J' ? 20 : 10;
        game.pisti[o]++;
        sfx.fanfare();
        fx.text(innerW() / 2, 90, pistiKind === 'J' ? 'Vale Pişti! +20' : 'Pişti! +10', '#ffcd3c', 26);
        buzz(40);
      }
      void cards;
    }
    const innerW = () => wrap.clientWidth;

    function take(o, withCard) {
      const n = game.table.length;
      const pistiKind = n === 1 ? (withCard.r === 'J' && game.table[0].r !== 'J' ? 'J' : 'normal') : null;
      game.taken[o].push(...game.table, withCard);
      game.table = [];
      game.last = o;
      let pts = 0;
      for (const c of game.taken[o].slice(-(n + 1))) pts += cardPts(c);
      game.pts[o] += pts;
      if (pistiKind) score(o, pistiKind === 'J' ? 'J' : 'normal');
      sfx.card ? sfx.card() : sfx.tile();
      buzz(12);
      if (!pistiKind && pts) fx.text(innerW() / 2, 110, `+${pts}`, '#2ee6a0', 22);
      say(o === 0 ? pick(SAYS.kotu) : pick(SAYS.iyi));
    }

    function playCard(o, idx) {
      const c = game.hands[o].splice(idx, 1)[0];
      const top = game.table[game.table.length - 1];
      const match = top && (c.r === top.r || c.r === 'J');
      if (match) take(o, c);
      else {
        game.table.push(c);
        sfx.tile();
      }
      render();
      game.turn = 1 - o;
      if (!game.hands[0].length && !game.hands[1].length) {
        if (game.deck.length) {
          my.timeout(() => { deal(); if (game.turn === 1) aiTurn(); }, 500);
          return;
        }
        my.timeout(finishGame, 600);
        return;
      }
      if (game.turn === 1) my.timeout(aiTurn, 800);
    }

    function aiTurn() {
      if (game.over || !my.alive || game.paused) return;
      const hand = game.hands[1];
      if (!hand.length) return;
      const top = game.table[game.table.length - 1];
      const tablePts = game.table.reduce((a, c) => a + cardPts(c), 0);
      let best = 0;
      let bestV = -99;
      hand.forEach((c, i) => {
        let v = -cardPts(c) * 2;
        if (top && c.r === top.r) v += 20 + tablePts * 3 + (game.table.length === 1 ? 14 : game.table.length * 2);
        else if (c.r === 'J' && game.table.length) v += 12 + tablePts * 3 + (game.table.length === 1 ? 10 : game.table.length * 2) - 6;
        else if (c.r === 'J') v -= 8;
        else if (game.table.length === 0) v += 4 - cardPts(c) * 3;
        if (v > bestV) { bestV = v; best = i; }
      });
      playCard(1, best);
    }

    function finishGame() {
      if (game.over) return;
      game.over = true;
      if (game.table.length && game.last >= 0) {
        for (const c of game.table) game.pts[game.last] += cardPts(c);
        game.taken[game.last].push(...game.table);
        game.table = [];
      }
      const c0 = game.taken[0].length;
      const c1 = game.taken[1].length;
      if (c0 > c1) game.pts[0] += 3; else if (c1 > c0) game.pts[1] += 3;
      const won = game.pts[0] > game.pts[1];
      data.pisti[won ? 'w' : 'l']++;
      api.touch();
      const coins = won ? 14 + game.pisti[0] * 4 : 4;
      api.finish({ coins });
      render();
      say(won ? pick(SAYS.kaybetti) : pick(SAYS.kazandi));
      my.timeout(() => {
        resultSheet({
          won,
          title: won ? 'Pişti Senin!' : game.pts[0] === game.pts[1] ? 'Berabere' : 'Furkan Topladı',
          sub: `${game.pts[0]} - ${game.pts[1]}`,
          coins,
          stats: [['Pişti', `${game.pisti[0]} - ${game.pisti[1]}`], ['Kağıt', `${c0} - ${c1}`], ['Skor', `${data.pisti.w} - ${data.pisti.l}`]],
          buttons: [
            { label: 'Yeni El', main: true, icon: 'replay', act: () => pisti() },
            { label: 'Tavla Oynayalım', icon: 'play', act: () => tavla() },
            { label: 'Masadan Kalk', icon: 'list', act: () => menu() },
          ],
        });
      }, 900);
    }

    my.on(wrap, 'click', (e) => {
      const b = e.target.closest('[data-card]');
      if (!b || game.turn !== 0 || game.over || game.paused) return;
      sfx.tap();
      playCard(0, Number(b.dataset.card));
    });

    f.onBack = () => {
      if (game.over) { menu(); return; }
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => pisti(), onQuit: () => menu() });
    };

    // Havaya uçuşan puan yazıları için küçük tuval
    const fxCv = document.createElement('canvas');
    fxCv.className = 'kh-fx';
    wrap.append(fxCv);
    const stage = fitCanvas(fxCv, my);
    my.raf((dt) => {
      stage.begin();
      fx.draw(stage.g, game.paused ? 0 : dt);
      return undefined;
    });

    game.play = (i) => playCard(0, i);
    render();
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
