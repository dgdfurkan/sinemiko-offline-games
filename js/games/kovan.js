// Harf Kovanı iki sürümlü: "Harf Çiçeği" bu dosyada (elindeki harflerden bütün kelimeleri
// bul, bölümün kelimeleri baştan belli), "Petek Avı" kovan-petek.js içinde (19 gözlü petek,
// komşu harfler, yenilenen harfler). Menüden hangisi istenirse o oynanır.

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, trUpper, shuffle } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, rrect, label, shake, confetti } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';
import { PUZZLES } from '../data/kovan-levels.js';
import { petekMode, PETEK_LEVELS } from './kovan-petek.js';
import { INK, loadLists, letterLink, drawRope, drawBee, drawJar, hexPath, combBackdrop } from './kovan-bag.js';
import { noteSheet } from './kovan-notlar.js';

const LEVELS = PUZZLES.length;
const VAL = { a: 1, e: 1, i: 1, ı: 1, n: 1, r: 1, l: 1, k: 1, d: 2, m: 2, t: 2, y: 2, u: 2, s: 2, b: 3, o: 2, ü: 3, z: 4, ş: 4, g: 3, ç: 4, c: 4, h: 4, p: 5, v: 5, ğ: 6, ö: 5, f: 6, j: 8 };
const scoreOf = (w) => w.split('').reduce((a, c) => a + (VAL[c] || 2), 0) * w.length;
const ease = (t) => t * t * (3 - 2 * t);

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], starsC: [], words: 0, best: '', honey: 0, found: [], mode: 'cicek' });
  const f = api.frame({ onBack: () => api.exit() });
  let local = null;
  let st = null;
  let BIG = null;
  loadLists().then((l) => { BIG = l.big; }).catch(() => { BIG = null; });
  const petek = petekMode({ api, f, data, toMenu: () => menu() });
  const end = () => {
    petek.end();
    if (local) local.dispose();
    local = null;
    st = null;
  };

  const MODES = {
    cicek: {
      title: 'Harf Çiçeği',
      tag: 'Kelimeleri topla',
      sub: 'Çiçekteki harflerden kelime çıkar. Bölümün kelimeleri üstte boş gözlerde duruyor, hepsini bul.',
      list: 'Kovanlar',
      total: LEVELS,
      stars: () => data.starsC,
      how: [
        'Alttaki harflerin üstünde parmağını gezdir, kaldırınca kelime kontrol edilir.',
        'Üstteki boş gözler o bölümde çıkan kelimeleri gösterir. Hepsini bulunca bölüm biter.',
        'Hamle yok, acele yok. Sıkışınca Karıştır harfleri yeniden dizer.',
        'Arı Yardımı bir harfi uçurup peteğe bırakır, ama yıldızından olursun.',
        'Listede olmayan geçerli kelimeler de ekstra bal kazandırır.',
        'Bölümü bitirince arıcılıkla ilgili bir not açılır.',
      ],
      play: (i) => play(i),
    },
    petek: {
      title: 'Petek Avı',
      tag: 'Harfler yenilenir',
      sub: 'On dokuz gözlü kovanda komşu harfleri birleştir. Bulduğun harflerin yerine yenileri dolar, acele yok.',
      list: 'Petekler',
      total: PETEK_LEVELS,
      stars: () => data.stars,
      how: [
        'Parmağını komşu harflerin üstünde gezdir, kaldırınca kelime kontrol edilir.',
        'Harflere tek tek dokunarak da yazabilirsin: onaylamak için tik, silmek için geri tuşu.',
        'Hamle yok. Bölümün hedefini tamamlayınca kovan dolar, üstte şu an kaç kelime olduğu yazar.',
        'Uzun kelime daha çok bal yapar. Üst üste bulduğun kelimeler çarpanı büyütür.',
        'Sıkışınca Karıştır harfleri yeniden dizer, Arı Yardımı bir kelimenin üstünden uçarak yolunu gösterir.',
        'Yardım almadan bitirirsen üç yıldız.',
      ],
      play: (i) => petek.play(i),
    },
  };

  function menu() {
    end();
    f.onBack = () => api.exit();
    f.setTitle(api.game.title);
    const key = data.mode === 'petek' ? 'petek' : 'cicek';
    const m = MODES[key];
    menuScreen(f.main, api.game, {
      art: ART.kovan,
      sub: m.sub,
      stats: [['Bulunan Kelime', data.words], ['En Uzun Kelime', data.best ? trUpper(data.best) : '-'], ['Toplanan Bal', data.honey || 0]],
      how: m.how,
      extra: html`<div class="kv-modes">${Object.entries(MODES).map(([k, v]) => html`<button class="kv-mode ${k === key ? 'on' : ''}" data-mode="${k}"><b>${v.title}</b><small>${v.tag}</small></button>`)}</div>`,
      levels: { total: m.total, stars: m.stars(), title: m.list, onPick: (i) => m.play(i) },
    });
    f.main.querySelector('.kv-modes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b || b.dataset.mode === key) return;
      sfx.tap();
      data.mode = b.dataset.mode;
      api.touch();
      menu();
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const fx = makeFx();
    const puz = PUZZLES[li % LEVELS];
    const pool = puz.a.split('');
    const n = pool.length;
    // Kelimeler uzunluğa göre dizilir, aynı uzunlukta olanlar her oyunda başka sırada gelir
    const slots = shuffle(puz.w.map((w) => ({ w, found: false, show: 0, rev: 0, sweep: 0, cells: [] })))
      .sort((a, b) => a.w.length - b.w.length);
    const byWord = new Map(slots.map((s) => [s.w, s]));
    const game = {
      order: shuffle(pool.map((_, i) => i)), sel: [],
      honey: 0, combo: 0, comboT: 0, reveals: 0, extras: 0, last: '', found: 0,
      total: slots.length, done: false, paused: false,
      pops: [], flyers: [], bees: [], cellPop: new Array(n).fill(0),
      aT: 1, aFrom: [], aScale: false, hintWord: null, beeTask: null, flash: 0, jarPulse: 0,
      bee: { x: 0, y: 0, tx: 0, ty: 0, ang: 0 },
    };
    st = game;

    f.setTitle(`Kovan ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="kv">
        <div class="kv-top">
          <span class="kv-goal"><small>Hedef</small><b>${slots.length} kelimenin hepsini bul</b><i class="kv-pbar"><u data-pbar></u></i></span>
          <span class="kv-score"><b data-found>0/${slots.length}</b><small>kelime</small></span>
        </div>
        <canvas class="kv-cv"></canvas>
        <div class="kv-word" data-word><b data-cur></b></div>
        <div class="kv-banner" data-banner></div>
        <div class="kv-combo" data-combo></div>
        <div class="kv-bar">
          <span class="kv-honey"><svg viewBox="0 0 24 24"><path d="M6 9h12l1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="#ffb31a" stroke="#2a1636" stroke-width="2.2" stroke-linejoin="round"/><path d="M5 6h14v3H5z" fill="#fff3cf" stroke="#2a1636" stroke-width="2.2"/></svg><b data-honey>0</b></span>
          <button class="kv-b" data-act="shuffle">${icon('replay')}Karıştır</button>
          <button class="kv-b" data-act="hint">${icon('hint')}<span data-hint>Arı Yardımı</span></button>
        </div>
      </div>`);
    const wrap = f.main.querySelector('.kv');
    const cv = wrap.querySelector('.kv-cv');
    const wordEl = wrap.querySelector('[data-word]');
    const curEl = wrap.querySelector('[data-cur]');
    const bannerEl = wrap.querySelector('[data-banner]');
    const comboEl = wrap.querySelector('[data-combo]');
    const honeyEl = wrap.querySelector('[data-honey]');
    const foundEl = wrap.querySelector('[data-found]');
    const hintEl = wrap.querySelector('[data-hint]');
    const pbar = wrap.querySelector('[data-pbar]');
    const stage = fitCanvas(cv, my);

    /* ---------- Yerleşim ---------- */
    const lay = { ring: [], r: 24, cx: 0, cy: 0, hs: 12, jar: { x: 0, y: 0, r: 24 } };

    // Kelime petekleri: sütun sayısını deneyerek en büyük göz boyunu bul
    function packSlots(ax, ay, aw, ah) {
      let best = null;
      for (let cols = 1; cols <= 4; cols++) {
        const rows = Math.ceil(slots.length / cols);
        const colMax = [];
        for (let c = 0; c < cols; c++) {
          let m = 0;
          for (let k = c * rows; k < Math.min(slots.length, (c + 1) * rows); k++) m = Math.max(m, slots[k].w.length);
          colMax.push(m);
        }
        const letters = colMax.reduce((a, b) => a + b, 0);
        if (!letters) continue;
        const hs = Math.min(aw / (letters * 1.78 + (cols - 1) * 0.9), ah / (rows * 2.1));
        if (!best || hs > best.hs) best = { hs, cols, rows, colMax };
      }
      const hs = Math.min(best.hs, 30);
      lay.hs = hs;
      const { cols, rows, colMax } = best;
      const totalW = colMax.reduce((a, b) => a + b, 0) * 1.78 * hs + (cols - 1) * 0.9 * hs;
      const totalH = rows * 2.1 * hs;
      let x = ax + (aw - totalW) / 2;
      const y0 = ay + (ah - totalH) / 2 + hs;
      for (let c = 0; c < cols; c++) {
        const colW = colMax[c] * 1.78 * hs;
        for (let k = c * rows; k < Math.min(slots.length, (c + 1) * rows); k++) {
          const s = slots[k];
          const wW = s.w.length * 1.78 * hs;
          const sx = x + (colW - wW) / 2;
          const sy = y0 + (k - c * rows) * 2.1 * hs;
          s.cells = s.w.split('').map((_, i) => ({ x: sx + hs * 0.89 + i * 1.78 * hs, y: sy }));
          s.cy = sy;
          s.cx = sx + wW / 2;
        }
        x += colW + 0.9 * hs;
      }
    }

    function packRing(ax, ay, aw, ah) {
      const nRing = n;
      // Uzun bir sütuna düşerse çiçek kare bir alana oturur, tepeden tırnağa yayılmaz
      if (ah > aw * 1.25) {
        const side = aw * 1.25;
        ay += (ah - side) / 2;
        ah = side;
      }
      const avail = Math.min(aw, ah) / 2 - 4;
      const need = 1.06 / Math.sin(Math.PI / nRing);
      const r = Math.min(avail / (1 + need), avail * 0.44);
      const R = avail - r;
      lay.r = r;
      lay.cx = ax + aw / 2;
      lay.cy = ay + ah / 2;
      lay.ring = pool.map((_, i) => {
        const a = -Math.PI / 2 + (i / nRing) * Math.PI * 2;
        return { x: lay.cx + Math.cos(a) * R, y: lay.cy + Math.sin(a) * R };
      });
      const jr = Math.max(20, Math.min(aw, ah) * 0.12);
      lay.jar = { x: ax + aw - jr * 1.1, y: ay + ah - jr * 1.5, r: jr };
    }

    // Yerleşim yalnız ekran ölçüsü değişince kurulur, her karede değil
    let lastW = 0;
    let lastH = 0;
    let backdrop = null;
    function relayout() {
      const { W, H } = stage;
      if (W === lastW && H === lastH) return;
      lastW = W;
      lastH = H;
      const side = W / H > 1.25;
      const sw = side ? W * 0.58 : W;
      const sh = side ? H : H * 0.55;
      packSlots(8, 6, sw - 16, sh - 12);
      if (side) packRing(sw, 0, W - sw, H);
      else packRing(0, sh, W, H - sh);
      backdrop = combBackdrop(W, H, stage.dpr, Math.max(18, lay.r * 0.7));
    }
    relayout();

    const ringPos = (i) => {
      const p = lay.ring[i];
      if (game.aT >= 1) return p;
      const d = clamp((game.aT - i * 0.05) / 0.6, 0, 1);
      const e = ease(d);
      const fr = game.aFrom[i] || p;
      const dx = p.x - fr.x;
      const dy = p.y - fr.y;
      const bulge = Math.sin(e * Math.PI) * 0.16;
      return { x: lerp(fr.x, p.x, e) - dy * bulge, y: lerp(fr.y, p.y, e) + dx * bulge, s: game.aScale ? 0.25 + 0.75 * e : 1 };
    };
    const letterAt = (i) => pool[game.order[i]];
    const curWord = () => game.sel.map((i) => letterAt(i)).join('');

    // Giriş: harfler ortadan açılarak gelir
    const startAnim = (scale) => {
      game.aFrom = lay.ring.map(() => ({ x: lay.cx, y: lay.cy }));
      game.aScale = scale;
      game.aT = 0;
    };
    startAnim(true);

    /* ---------- Kelime kontrolü ---------- */

    function syncWord() {
      const w = curWord();
      const slot = byWord.get(w);
      const ok = w.length >= 3 && slot && !slot.found;
      const extra = w.length >= 3 && !slot && BIG && BIG.has(w);
      curEl.textContent = w ? trUpper(w) : '';
      wordEl.className = `kv-word ${w ? 'on' : ''} ${ok ? 'ok' : extra ? 'extra' : ''}`;
    }

    function setProg() {
      foundEl.textContent = `${game.found}/${game.total}`;
      pbar.style.width = `${(game.found / game.total) * 100}%`;
    }

    function addHoney(p) {
      game.honey += p;
      data.honey = (data.honey || 0) + p;
      honeyEl.textContent = game.honey;
    }

    function banner(text, cls = '') {
      bannerEl.textContent = text;
      bannerEl.className = `kv-banner on ${cls}`;
      my.timeout(() => bannerEl.classList.remove('on'), 1100);
    }

    function reject(w) {
      game.combo = 0;
      comboEl.classList.remove('on');
      sfx.bad();
      buzz(30);
      curEl.textContent = `${trUpper(w)} yok`;
      wordEl.className = 'kv-word on no';
      shake(wordEl, 6);
      my.timeout(() => { if (!game.sel.length) { curEl.textContent = ''; wordEl.className = 'kv-word'; } }, 760);
    }

    function submit() {
      const w = curWord();
      const path = game.sel.slice();
      game.sel = [];
      if (w.length < 3) { syncWord(); return; }
      const slot = byWord.get(w);
      if (slot && slot.found) {
        syncWord();
        curEl.textContent = `${trUpper(w)} zaten var`;
        wordEl.className = 'kv-word on';
        sfx.soft();
        my.timeout(() => { if (!game.sel.length) { curEl.textContent = ''; wordEl.className = 'kv-word'; } }, 700);
        return;
      }
      if (!slot) {
        if (BIG && BIG.has(w)) {
          const pts = Math.round(scoreOf(w) * 0.5);
          game.extras++;
          addHoney(pts);
          game.jarPulse = 1;
          banner(`Ekstra: ${trUpper(w)}  +${pts}`, 'extra');
          sfx.coin();
          tone({ type: 'sine', f: 520, f2: 760, dur: 0.16, vol: 0.06 });
          path.forEach((i) => {
            const p = ringPos(i);
            game.pops.push({ x: p.x, y: p.y, c: letterAt(i), t: 0, to: lay.jar });
            fx.burst(p.x, p.y, { n: 8, colors: ['#ffe27a', '#fff'], power: 150 });
          });
          syncWord();
          return;
        }
        reject(w);
        syncWord();
        return;
      }
      // Listedeki kelime bulundu
      slot.found = true;
      slot.show = 0;
      slot.sweep = 1;
      game.found++;
      game.combo++;
      game.comboT = 3.2;
      const mult = 1 + Math.min(1.5, (game.combo - 1) * 0.25);
      const pts = Math.round(scoreOf(w) * mult);
      addHoney(pts);
      game.jarPulse = 1;
      game.flash = 0.5;
      if (w.length > game.last.length) game.last = w;
      data.words++;
      if (w.length > (data.best || '').length) data.best = w;
      api.touch();
      setProg();
      banner(`${trUpper(w)}  +${pts}`, w.length >= 6 ? 'big' : '');
      if (game.combo >= 2) {
        comboEl.textContent = `${game.combo} üst üste  x${String(mult).replace(/\.?0+$/, '')}`;
        comboEl.classList.add('on');
      }
      if (w.length >= 6) shake(wrap, 7);
      sfx.good();
      tone({ type: 'triangle', f: 420 + w.length * 70, f2: 900, dur: 0.2, vol: 0.07 });
      buzz(16);
      if (game.hintWord === w) game.hintWord = null;
      // Harfler peteğin boş gözlerine uçar
      path.forEach((ci, k) => {
        const p = ringPos(ci);
        game.cellPop[ci] = 1;
        game.flyers.push({ slot, k, c: letterAt(ci), x: p.x, y: p.y, t: -k * 0.08 });
        fx.burst(p.x, p.y, { n: 9, colors: ['#ffcd3c', '#fff3cf', '#ffa41a'], power: 190 });
      });
      for (let k = 0; k < Math.min(5, w.length - 1); k++) {
        game.bees.push({ x: rand(0, stage.W), y: stage.H + rand(10, 60), t: 0, w: rand(0, 6) });
      }
      if (game.found >= game.total) my.timeout(() => finish(), 900);
      syncWord();
    }

    /* ---------- Dokunma ---------- */
    const link = letterLink(my, cv, {
      game,
      cells: () => lay.ring,
      radius: () => lay.r,
      canLink: () => true,
      valid: () => {
        const w = curWord();
        const slot = byWord.get(w);
        return w.length >= 3 && (slot ? !slot.found : !!(BIG && BIG.has(w)));
      },
      onStart: () => sfx.tile(),
      onAdd: () => {
        sfx.tile();
        buzz(5);
        tone({ type: 'sine', f: 300 + game.sel.length * 60, dur: 0.07, vol: 0.05 });
      },
      onPop: () => sfx.soft(),
      onChange: syncWord,
      submit,
    });

    function doShuffle() {
      const prev = game.order.slice();
      game.order = shuffle(game.order.slice());
      game.aFrom = game.order.map((inst, i) => lay.ring[prev.indexOf(inst)] || lay.ring[i]);
      game.aScale = false;
      game.aT = 0;
      game.sel = [];
      syncWord();
      sfx.whoosh();
    }

    // Arı, açılacak harfi kavanozdan alıp peteğin boş gözüne bırakır
    function doHint() {
      if (game.beeTask) return;
      const cur = game.hintWord ? byWord.get(game.hintWord) : null;
      const open = slots.filter((s) => !s.found && s.rev < s.w.length - 1);
      if (!open.length) {
        toast(slots.some((s) => !s.found) ? 'Kalan kelimelerde son harfi sen bulacaksın.' : 'Petek doldu.');
        return;
      }
      // Yarım kalan kelime varsa onu sürdür, yoksa en uzun kelimeye git
      const t = cur && !cur.found && cur.rev < cur.w.length - 1 ? cur : open.slice().sort((a, b) => b.w.length - a.w.length || b.rev - a.rev)[0];
      game.hintWord = t.w;
      game.reveals++;
      game.beeTask = { slot: t, k: t.rev, c: t.w[t.rev] };
      hintEl.textContent = 'Harf Getir';
      sfx.whoosh();
      buzz(10);
      tone({ type: 'sine', f: 440, f2: 660, dur: 0.14, vol: 0.05 });
    }

    my.on(wrap.querySelector('.kv-bar'), 'click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || game.done) return;
      sfx.tap();
      if (b.dataset.act === 'shuffle') doShuffle();
      else doHint();
    });

    function finish() {
      if (game.done) return;
      game.done = true;
      const stars = game.reveals === 0 ? 3 : game.reveals <= 2 ? 2 : 1;
      if (stars > (data.starsC[li] || 0)) data.starsC[li] = stars;
      api.touch();
      const coins = 8 + stars * 6 + game.extras * 2 + Math.floor(game.honey / 110);
      api.finish({ coins });
      confetti({ n: 70 });
      sfx.ding(88);
      my.timeout(() => {
        noteSheet(li, () => resultSheet({
          won: true,
          title: 'Kovan Doldu!',
          sub: `En uzun kelimen: ${trUpper(game.last || puz.a)}`,
          stars,
          coins,
          stats: [['Kelime', `${game.found}/${game.total}`], ['Bal', game.honey], ['Ekstra', game.extras]],
          buttons: [
            ...(li + 1 < LEVELS ? [{ label: 'Sonraki Kovan', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', icon: 'replay', act: () => play(li) },
            { label: 'Kovanlar', icon: 'list', act: () => menu() },
          ],
        }));
      }, 650);
    }

    f.onBack = () => {
      if (game.done) { menu(); return; }
      game.paused = true;
      pauseSheet({
        onResume: () => { game.paused = false; },
        onRestart: () => play(li),
        onQuit: () => menu(),
      });
    };

    /* ---------- Çizim ---------- */
    my.raf((dt, t) => {
      const { W, H, g } = stage;
      stage.begin();
      relayout();
      if (game.aT < 1) game.aT = Math.min(1, game.aT + dt * 1.9);
      link.tick();
      g.drawImage(backdrop, 0, 0, W, H);

      /* Kelime petekleri */
      const hs = lay.hs;
      for (const s of slots) {
        const lit = game.hintWord === s.w && !s.found;
        if (s.sweep > 0) s.sweep = Math.max(0, s.sweep - dt * 1.3);
        s.cells.forEach((p, k) => {
          const open = s.found ? k < s.show : k < s.rev;
          const pp = s.found && k === s.show - 1 ? 1 + s.sweep * 0.22 : 1;
          g.save();
          g.translate(p.x, p.y);
          g.scale(pp, pp);
          hexPath(g, 0, hs * 0.16, hs * 0.92);
          g.fillStyle = 'rgba(42,22,54,.16)';
          g.fill();
          hexPath(g, 0, 0, hs * 0.92);
          g.fillStyle = open ? (s.found ? '#ffcd3c' : '#fff') : 'rgba(255,255,255,.42)';
          g.fill();
          g.lineWidth = Math.max(1.6, hs * 0.14);
          g.strokeStyle = open ? INK : 'rgba(42,22,54,.45)';
          g.stroke();
          if (open) label(g, 0, hs * 0.06, trUpper(s.w[k]), { size: hs * 1.04, color: INK, stroke: 'rgba(0,0,0,0)', sw: 0, font: '"Baloo 2", sans-serif' });
          else {
            g.beginPath();
            g.arc(0, 0, hs * 0.14, 0, Math.PI * 2);
            g.fillStyle = 'rgba(42,22,54,.3)';
            g.fill();
          }
          g.restore();
        });
        if (lit) {
          const pulse = 1 + Math.sin(t / 170) * 0.06;
          g.save();
          g.beginPath();
          const x0 = s.cells[0].x - hs;
          const x1 = s.cells[s.cells.length - 1].x + hs;
          rrect(g, x0, s.cy - hs * 1.18 * pulse, x1 - x0, hs * 2.36 * pulse, hs * 0.7);
          g.strokeStyle = '#fff';
          g.lineWidth = 3;
          g.shadowColor = '#fff6d8';
          g.shadowBlur = 16 + Math.sin(t / 150) * 7;
          g.stroke();
          g.restore();
        }
        if (s.sweep > 0 && s.found) {
          const x0 = s.cells[0].x - hs;
          const x1 = s.cells[s.cells.length - 1].x + hs;
          const k = 1 - s.sweep;
          const gx = x0 + (x1 - x0 + hs * 3) * k - hs * 1.5;
          const gr = g.createLinearGradient(gx - hs, 0, gx + hs, 0);
          gr.addColorStop(0, 'rgba(255,255,255,0)');
          gr.addColorStop(0.5, `rgba(255,255,255,${s.sweep * 0.65})`);
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr;
          g.fillRect(gx - hs, s.cy - hs * 1.1, hs * 2, hs * 2.2);
        }
      }

      /* Bal kavanozu */
      const jr = lay.jar.r;
      const fillK = game.found / game.total;
      if (game.jarPulse > 0) game.jarPulse = Math.max(0, game.jarPulse - dt * 2.4);
      drawJar(g, lay.jar.x, lay.jar.y, jr, fillK, game.jarPulse, t, rrect);
      label(g, lay.jar.x, lay.jar.y + jr * 0.2, `%${Math.round(fillK * 100)}`, { size: jr * 0.44, color: '#fff', stroke: INK, sw: 0.3, font: '"Baloo 2", sans-serif' });

      /* Harf çiçeği: önce gözler, sonra ip, en üstte harfler */
      const sel = game.sel;
      const cs = lay.r * 0.5;
      hexPath(g, lay.cx, lay.cy, cs);
      g.fillStyle = 'rgba(255,255,255,.4)';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = 'rgba(42,22,54,.35)';
      g.stroke();
      drawBee(g, lay.cx, lay.cy, cs * 0.52, t, Math.sin(t / 420) * 0.3);
      for (let i = 0; i < n; i++) {
        const p = ringPos(i);
        const on = sel.includes(i);
        if (game.cellPop[i] > 0) game.cellPop[i] = Math.max(0, game.cellPop[i] - dt * 2.6);
        const s = lay.r * 0.94 * (p.s || 1) * (on ? 1.08 : 1) * (1 - game.cellPop[i] * 0.16);
        hexPath(g, p.x, p.y + lay.r * 0.1, s);
        g.fillStyle = 'rgba(42,22,54,.22)';
        g.fill();
        hexPath(g, p.x, p.y, s);
        g.fillStyle = on ? '#2ee6a0' : '#fff6d8';
        g.fill();
        g.lineWidth = Math.max(2.5, lay.r * 0.1);
        g.strokeStyle = INK;
        g.stroke();
        if (game.cellPop[i] > 0) {
          hexPath(g, p.x, p.y, s * (1 + (1 - game.cellPop[i]) * 0.5));
          g.strokeStyle = `rgba(255,255,255,${game.cellPop[i] * 0.8})`;
          g.lineWidth = 3;
          g.stroke();
        }
      }
      if (sel.length) {
        const w = curWord();
        const slot = byWord.get(w);
        const kind = w.length < 3 ? null : slot ? (slot.found ? null : 'ok') : BIG && BIG.has(w) ? 'extra' : null;
        drawRope(g, sel.map(ringPos), link.finger, lay.r, kind, t);
      }
      for (let i = 0; i < n; i++) {
        const p = ringPos(i);
        const s = lay.r * 0.94 * (p.s || 1) * (sel.includes(i) ? 1.08 : 1) * (1 - game.cellPop[i] * 0.16);
        label(g, p.x, p.y + s * 0.06, trUpper(letterAt(i)), { size: s * 0.95, color: INK, stroke: 'rgba(0,0,0,0)', sw: 0, font: '"Baloo 2", sans-serif' });
        label(g, p.x + s * 0.52, p.y - s * 0.42, String(VAL[letterAt(i)] || 2), { size: s * 0.3, color: '#9a7a24', stroke: 'rgba(0,0,0,0)', sw: 0, font: '"Baloo 2", sans-serif' });
      }

      /* Peteğe uçan harfler */
      game.flyers = game.flyers.filter((fl) => {
        fl.t += dt * 1.7;
        if (fl.t <= 0) return true;
        const target = fl.slot.cells[fl.k] || { x: lay.jar.x, y: lay.jar.y };
        if (fl.t >= 1) {
          fl.slot.show = Math.max(fl.slot.show, fl.k + 1);
          fl.slot.sweep = Math.max(fl.slot.sweep, 0.9);
          fx.burst(target.x, target.y, { n: 6, colors: ['#ffcd3c', '#fff'], power: 110 });
          tone({ type: 'sine', f: 620 + fl.k * 90, dur: 0.08, vol: 0.05 });
          return false;
        }
        const e = ease(fl.t);
        const x = lerp(fl.x, target.x, e);
        const y = lerp(fl.y, target.y, e) - Math.sin(fl.t * Math.PI) * lay.r * 1.6;
        const sc = lerp(lay.r * 0.9, hs * 0.95, e);
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(fl.t * Math.PI * 2) * 0.3);
        hexPath(g, 0, 0, sc * 0.9);
        g.fillStyle = '#ffcd3c';
        g.fill();
        g.lineWidth = 2.4;
        g.strokeStyle = INK;
        g.stroke();
        label(g, 0, 0, trUpper(fl.c), { size: sc * 0.95, color: INK, stroke: 'rgba(0,0,0,0)', sw: 0, font: '"Baloo 2", sans-serif' });
        g.restore();
        return true;
      });

      /* Ekstra kelimelerde kavanoza akan harfler */
      game.pops = game.pops.filter((p) => {
        p.t += dt * 1.5;
        if (p.t >= 1) return false;
        const k = ease(p.t);
        const x = lerp(p.x, lay.jar.x, k);
        const y = lerp(p.y, lay.jar.y, k) - Math.sin(p.t * Math.PI) * lay.r * 1.2;
        g.save();
        g.globalAlpha = 1 - p.t * 0.7;
        g.translate(x, y);
        label(g, 0, 0, trUpper(p.c), { size: lay.r * (0.8 - p.t * 0.4), color: '#fff', stroke: INK, font: '"Baloo 2", sans-serif' });
        g.restore();
        return true;
      });

      /* Yardım arısı: harfi taşıyıp boş göze bırakır */
      const bee2 = game.bee;
      const task = game.beeTask;
      if (task) {
        const p = task.slot.cells[task.k];
        bee2.tx = p ? p.x : lay.jar.x;
        bee2.ty = p ? p.y - hs * 1.5 : lay.jar.y;
      } else {
        bee2.tx = lay.jar.x;
        bee2.ty = lay.jar.y - jr * 1.55;
      }
      if (!bee2.x) { bee2.x = bee2.tx; bee2.y = bee2.ty; }
      const bdx = bee2.tx - bee2.x;
      const bdy = bee2.ty - bee2.y;
      const bk = Math.min(1, dt * (task ? 2.6 : 3.4));
      bee2.x += bdx * bk;
      bee2.y += bdy * bk;
      bee2.ang = lerp(bee2.ang, clamp(bdx * 0.004, -0.4, 0.4), Math.min(1, dt * 4));
      const bsz = Math.max(13, hs * 0.8);
      const bob = Math.sin(t / 150) * 3;
      if (task && Math.hypot(bdx, bdy) < hs * 0.5) {
        // Harf yerine kondu
        const p = task.slot.cells[task.k];
        task.slot.rev = Math.max(task.slot.rev, task.k + 1);
        task.slot.sweep = 0.8;
        game.beeTask = null;
        hintEl.textContent = 'Arı Yardımı';
        fx.ring(p.x, p.y, '#fff', hs * 2.4);
        fx.burst(p.x, p.y, { n: 12, colors: ['#fff', '#ffe27a', '#ffcd3c'], power: 150 });
        sfx.pop(0.7);
        tone({ type: 'sine', f: 820, f2: 1180, dur: 0.18, vol: 0.06 });
        buzz(12);
      }
      drawBee(g, bee2.x, bee2.y + bob, bsz, t, bee2.ang);
      if (task) {
        // Taşıdığı harf pençesinde sallanır
        g.save();
        g.translate(bee2.x, bee2.y + bob + bsz * 1.25);
        g.rotate(Math.sin(t / 180) * 0.16);
        hexPath(g, 0, 0, bsz * 0.78);
        g.fillStyle = '#ffcd3c';
        g.fill();
        g.lineWidth = 2.4;
        g.strokeStyle = INK;
        g.stroke();
        label(g, 0, 0, trUpper(task.c), { size: bsz * 0.85, color: INK, stroke: 'rgba(0,0,0,0)', sw: 0, font: '"Baloo 2", sans-serif' });
        g.restore();
      }

      /* Bal taşıyan arılar */
      game.bees = game.bees.filter((b) => {
        b.t += dt * 0.5;
        if (b.t >= 1) return false;
        const x = lerp(b.x, lay.jar.x, b.t);
        const y = lerp(b.y, lay.jar.y - jr, b.t) + Math.sin(t / 160 + b.w) * 12;
        drawBee(g, x, y, lay.r * 0.3, t);
        return true;
      });

      if (game.comboT > 0) {
        game.comboT -= dt;
        if (game.comboT <= 0) {
          game.combo = 0;
          comboEl.classList.remove('on');
        }
      }
      if (game.flash > 0) {
        game.flash -= dt;
        g.fillStyle = `rgba(255,255,255,${Math.max(0, game.flash) * 0.2})`;
        g.fillRect(0, 0, W, H);
      }
      fx.draw(g, game.paused ? 0 : dt);
      return undefined;
    });

    /* Bot ve hata ayıklama için */
    game.posOf = (i) => lay.ring[i];
    game.letterAt = letterAt;
    game.slots = slots;
    game.pathFor = (w) => {
      const need = w.split('');
      const used = new Array(n).fill(false);
      const out = [];
      for (const c of need) {
        let at = -1;
        for (let i = 0; i < n; i++) if (!used[i] && letterAt(i) === c) { at = i; break; }
        if (at < 0) return null;
        used[at] = true;
        out.push(at);
      }
      return out;
    };
    game.playWord = (w) => {
      const p = game.pathFor(w);
      if (!p) return false;
      game.sel = p;
      submit();
      return true;
    };
    game.shuffleNow = doShuffle;
    game.hintNow = doHint;
    setProg();
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return data.mode === 'petek' ? petek.st : st; },
    data,
  };
}
