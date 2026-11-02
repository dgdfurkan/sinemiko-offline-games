// Harf Kovanı'nın Petek Avı sürümü: 19 gözlü kovanda komşu harfleri birleştir, kelime çıkar.
// Hamle yok, bölüm hedefi var. Tahta rastgele harflerle değil tanıdık kelimelerle kurulur:
// sözlükten seçilen kelimeler komşu gözlere yerleştirilir, bulunan kelimenin yerine gelen
// harfler de yeni kelimeler çıkacak şekilde seçilir. Arı yalnız bu kelimeleri gösterir.

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, pick, trUpper, shuffle } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, rrect, label, shake, confetti } from '../core/fx.js';
import { resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { SOZLUK } from '../data/kovan-sozluk.js';
import { INK, loadLists, letterLink, drawRope, drawBee, drawJar, hexPath, combBackdrop } from './kovan-bag.js';
import { noteSheet } from './kovan-notlar.js';

export const PETEK_LEVELS = 30;
const VAL = { a: 1, e: 1, i: 1, ı: 1, n: 1, r: 1, l: 1, k: 1, d: 2, m: 2, t: 2, y: 2, u: 2, s: 2, b: 3, o: 2, ü: 3, z: 4, ş: 4, g: 3, ç: 4, c: 4, h: 4, p: 5, v: 5, ğ: 6, ö: 5, f: 6, j: 8 };
const scoreOf = (w) => w.split('').reduce((a, c) => a + (VAL[c] || 2), 0) * w.length;
const VOWELS = 'aeıioöuü';
const FILL_V = 'aaaaeeeeıııiiioouu';
const FILL_C = 'kkkrrrlllnnnmmttssddyybz';
const ease = (t) => t * t * (3 - 2 * t);
const backOut = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const NONE = 'rgba(0,0,0,0)';
const FONT = '"Baloo 2", sans-serif';

// Petek: 3-4-5-4-3 sıra, eksen koordinatlı altıgenler
const ROWS = [3, 4, 5, 4, 3];
const CELLS = [];
ROWS.forEach((n, r) => {
  for (let c = 0; c < n; c++) CELLS.push({ r, c, i: CELLS.length, off: (5 - n) / 2 });
});
const COUNT = CELLS.length;
const neighbors = (a, b) => {
  if (a.i === b.i) return false;
  const dr = Math.abs(a.r - b.r);
  if (dr > 1) return false;
  if (dr === 0) return Math.abs(a.c - b.c) === 1;
  return Math.abs(a.c + a.off - (b.c + b.off)) <= 0.51;
};
const NEI = CELLS.map((a) => CELLS.filter((b) => neighbors(a, b)).map((b) => b.i));
const ALL = CELLS.map((c) => c.i);

/* ---------- Sözlük ve tahta kurma ---------- */

const SOZ = new Set(SOZLUK);
const PREFIX = new Set();
const BY_LEN = { 3: [], 4: [], 5: [], 6: [], 7: [] };
for (const w of SOZLUK) {
  BY_LEN[w.length].push(w);
  for (let k = 1; k <= w.length; k++) PREFIX.add(w.slice(0, k));
}
// Sözlük sıklığa göre dizili: öndeki kelimeler daha sık seçilir
const biased = (list) => list[Math.floor(Math.random() ** 1.6 * list.length)];

// Tahtada şu an çıkan sözlük kelimeleri ve yolları
function scanBoard(letters, used) {
  const out = new Map();
  const seen = new Array(COUNT).fill(false);
  const path = [];
  const walk = (i, pre) => {
    const w = pre + letters[i];
    if (!PREFIX.has(w)) return;
    seen[i] = true;
    path.push(i);
    if (w.length >= 3 && SOZ.has(w) && !used.has(w) && !out.has(w)) out.set(w, path.slice());
    if (w.length < 7) for (const j of NEI[i]) if (!seen[j]) walk(j, w);
    seen[i] = false;
    path.pop();
  };
  for (let i = 0; i < COUNT; i++) if (letters[i]) walk(i, '');
  return out;
}

// Kelimeyi komşu gözlere yerleştirir: boş gözü en çok dolduran yolu seçer, aynı harfi paylaşabilir
function placeWord(letters, w, order, starts) {
  let best = null;
  let bestE = 0;
  let visits = 0;
  const seen = new Array(COUNT).fill(false);
  const path = [];
  const walk = (i, k, e) => {
    if (visits++ > 500) return;
    const c = letters[i];
    if (c !== null && c !== w[k]) return;
    const ne = e + (c === null ? 1 : 0);
    seen[i] = true;
    path.push(i);
    if (k === w.length - 1) {
      if (ne > bestE) { bestE = ne; best = path.slice(); }
    } else {
      for (const j of order[i]) if (!seen[j]) walk(j, k + 1, ne);
    }
    seen[i] = false;
    path.pop();
  };
  for (const i of starts) walk(i, 0, 0);
  return best;
}

function fillHoles(letters) {
  for (let i = 0; i < COUNT; i++) {
    if (letters[i] !== null) continue;
    let v = 0;
    let c = 0;
    for (const j of NEI[i]) {
      if (!letters[j]) continue;
      if (VOWELS.includes(letters[j])) v++; else c++;
    }
    const vowel = v === 0 ? true : c === 0 ? false : Math.random() < 0.4;
    letters[i] = pick(vowel ? FILL_V : FILL_C);
  }
}

// Bölüm tasarımı: önce kısa hedefler, sonra uzun kelime ve harf hedefleri
const SEQ = ['kelime', 'bal', 'kelime', 'uzun', 'bal', 'harf'];
function goalOf(li) {
  const kind = li < 2 ? 'kelime' : SEQ[li % SEQ.length];
  if (kind === 'kelime') {
    const n = 5 + Math.floor(li / 2.5);
    return { kind, n, text: `${n} kelime bul` };
  }
  if (kind === 'uzun') {
    const n = 2 + Math.floor(li / 8);
    const len = li < 12 ? 5 : 6;
    return { kind, n, len, text: `${n} tane ${len} harfli ya da daha uzun kelime` };
  }
  if (kind === 'harf') {
    const n = 7 + Math.floor(li / 3);
    const letter = pick('aeiknrlstmd'.split(''));
    return { kind, n, letter, text: `Kelimelerinde ${n} tane ${trUpper(letter)} harfi kullan` };
  }
  const n = 180 + li * 30;
  return { kind, n, text: `${n} bal topla` };
}
const lengthsOf = (li) => {
  if (li < 5) return [3, 3, 4, 4, 4, 5];
  if (li < 12) return [3, 4, 4, 4, 5, 5, 6];
  if (li < 20) return [3, 4, 4, 5, 5, 5, 6, 6];
  return [4, 4, 5, 5, 5, 6, 6, 7];
};

export function petekMode({ api, f, data, toMenu }) {
  let local = null;
  let st = null;
  let lists = null;
  loadLists().then((l) => { lists = l; }).catch(() => { lists = null; });
  const end = () => {
    if (local) local.dispose();
    local = null;
    st = null;
  };

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const goal = goalOf(li);
    const fx = makeFx();
    const mix = lengthsOf(li);
    const focus = goal.kind === 'uzun' ? SOZLUK.filter((w) => w.length >= goal.len)
      : goal.kind === 'harf' ? SOZLUK.filter((w) => w.includes(goal.letter)) : null;
    const focusSet = focus ? new Set(focus) : null;
    const game = {
      letters: new Array(COUNT).fill(''), sel: [], tapped: false, used: new Set(), avail: new Map(),
      honey: 0, words: 0, extras: 0, prog: 0, hints: 0, last: '', done: false, paused: false,
      pops: [], bees: [], born: new Array(COUNT).fill(null), shakeCell: -1, goal,
      combo: 0, comboT: 0, jarPulse: 0, flash: 0,
      aT: 1, aFrom: [], hint: null, fly: null, bee: { x: 0, y: 0, ang: 0 },
    };
    st = game;

    f.setTitle(`Petek ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="kv">
        <div class="kv-top">
          <span class="kv-goal"><small>Hedef</small><b>${goal.text}</b><i class="kv-pbar"><u data-pbar></u></i></span>
          <span class="kv-score"><b data-avail>0</b><small>kelime var</small></span>
        </div>
        <canvas class="kv-cv"></canvas>
        <div class="kv-word" data-word>
          <button class="kv-x" data-act="del" aria-label="Sil">${icon('back')}</button>
          <b data-cur></b>
          <button class="kv-x kv-ok" data-act="ok" aria-label="Onayla">${icon('check')}</button>
        </div>
        <div class="kv-banner" data-banner></div>
        <div class="kv-combo" data-combo></div>
        <div class="kv-bar">
          <span class="kv-honey"><svg viewBox="0 0 24 24"><path d="M6 9h12l1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="#ffb31a" stroke="#2a1636" stroke-width="2.2" stroke-linejoin="round"/><path d="M5 6h14v3H5z" fill="#fff3cf" stroke="#2a1636" stroke-width="2.2"/></svg><b data-honey>0</b></span>
          <button class="kv-b" data-act="shuffle">${icon('replay')}Karıştır</button>
          <button class="kv-b" data-act="hint">${icon('hint')}Arı Yardımı</button>
        </div>
      </div>`);
    const wrap = f.main.querySelector('.kv');
    const cv = wrap.querySelector('.kv-cv');
    const wordEl = wrap.querySelector('[data-word]');
    const curEl = wrap.querySelector('[data-cur]');
    const bannerEl = wrap.querySelector('[data-banner]');
    const comboEl = wrap.querySelector('[data-combo]');
    const honeyEl = wrap.querySelector('[data-honey]');
    const availEl = wrap.querySelector('[data-avail]');
    const pbar = wrap.querySelector('[data-pbar]');
    const stage = fitCanvas(cv, my);

    /* ---------- Tahta ---------- */

    function candidates(n) {
      const out = [];
      const seen = new Set();
      for (let guard = 0; out.length < n && guard < n * 6; guard++) {
        const list = focus && Math.random() < 0.55 ? focus : BY_LEN[pick(mix)];
        const w = biased(list);
        if (seen.has(w) || game.used.has(w)) continue;
        seen.add(w);
        out.push(w);
      }
      return out;
    }

    function plant(letters, words, maxWords) {
      const order = NEI.map((a) => shuffle(a.slice()));
      const starts = shuffle(ALL.slice());
      let holes = letters.reduce((a, c) => a + (c === null ? 1 : 0), 0);
      let count = 0;
      for (const w of words) {
        if (!holes || count >= maxWords) break;
        const p = placeWord(letters, w, order, starts);
        if (!p) continue;
        p.forEach((c, k) => {
          if (letters[c] === null) holes--;
          letters[c] = w[k];
        });
        count++;
      }
    }

    function evaluate(letters) {
      const m = scanBoard(letters, game.used);
      let s = m.size;
      let good = 0;
      for (const w of m.keys()) {
        if (w.length >= 5) { s += 2; good++; }
        if (focusSet && focusSet.has(w)) s += 3;
      }
      return { letters, m, s, good };
    }

    // Süre sınırı var: kelime bulununca oyun bir kare bile takılmasın
    function search(make, budget, enough) {
      const t0 = performance.now();
      let best = null;
      do {
        const e = evaluate(make());
        if (!best || e.s > best.s) best = e;
      } while (performance.now() - t0 < budget && !enough(best));
      return best;
    }

    function setBoard(e) {
      game.letters = e.letters;
      game.avail = e.m;
      availEl.textContent = e.m.size;
    }

    const freshBoard = () => search(() => {
      const trial = new Array(COUNT).fill(null);
      plant(trial, candidates(30), 8);
      fillHoles(trial);
      return trial;
    }, 30, (b) => b.m.size >= 14 && b.good >= 2);

    // Aynı harflerle yeni diziliş: yine sözlük kelimeleri çıksın diye önce kelime yerleştirilir
    function arrange(multiset) {
      const counts = {};
      for (const c of multiset) counts[c] = (counts[c] || 0) + 1;
      const fits = SOZLUK.filter((w) => {
        if (game.used.has(w)) return false;
        const need = {};
        for (const c of w) {
          need[c] = (need[c] || 0) + 1;
          if (need[c] > (counts[c] || 0)) return false;
        }
        return true;
      });
      return search(() => {
        const trial = new Array(COUNT).fill(null);
        const rem = { ...counts };
        const order = NEI.map((a) => shuffle(a.slice()));
        const starts = shuffle(ALL.slice());
        for (let k = 0; k < 24 && fits.length; k++) {
          const w = biased(fits);
          const p = placeWord(trial, w, order, starts);
          if (!p) continue;
          const need = {};
          p.forEach((c, x) => { if (trial[c] === null) need[w[x]] = (need[w[x]] || 0) + 1; });
          if (Object.keys(need).some((c) => (rem[c] || 0) < need[c])) continue;
          p.forEach((c, x) => {
            if (trial[c] === null) rem[w[x]]--;
            trial[c] = w[x];
          });
        }
        const left = shuffle(Object.keys(rem).flatMap((c) => new Array(rem[c]).fill(c)));
        for (let i = 0; i < COUNT; i++) if (trial[i] === null) trial[i] = left.pop();
        return trial;
      }, 12, (b) => b.m.size >= 10 && b.good >= 1);
    }

    // Bulunan kelimenin yerine gelecek harfler: önce yeni kelime yerleştir, kalan gözü dengeli doldur
    function refill(path) {
      const base = game.letters.slice();
      path.forEach((i) => { base[i] = null; });
      const e = search(() => {
        const trial = base.slice();
        plant(trial, candidates(24), 3);
        fillHoles(trial);
        return trial;
      }, 5, (b) => b.m.size >= 9 && b.good >= 1);
      setBoard(e);
    }

    setBoard(freshBoard());

    /* ---------- Yerleşim ---------- */
    const lay = { s: 40, x: 0, y: 0, pos: [], jar: { x: 0, y: 0, r: 26 } };
    let lastW = 0;
    let lastH = 0;
    let backdrop = null;
    const relayout = () => {
      const { W, H } = stage;
      if (W === lastW && H === lastH) return;
      lastW = W;
      lastH = H;
      const s = Math.min((W - 14) / (5 * 1.74), (H - 14) / (ROWS.length * 1.5 + 0.5));
      lay.s = s;
      lay.x = (W - 5 * 1.74 * s) / 2;
      lay.y = (H - (ROWS.length * 1.5 + 0.5) * s) / 2;
      lay.pos = CELLS.map((c) => ({ x: lay.x + (c.c + c.off) * s * 1.74 + s * 0.87, y: lay.y + c.r * s * 1.5 + s }));
      // Kavanoz alt köşedeki boşluğa oturur, harfleri örtmez
      const jr = clamp(s * 0.62, 18, 44);
      lay.jar = { x: Math.min(W - jr * 0.95, lay.x + 7.85 * s), y: Math.min(H - jr * 1.1, lay.y + 7.25 * s), r: jr };
      backdrop = combBackdrop(W, H, stage.dpr, s * 0.8);
    };
    relayout();
    // Petek ortadan dışa doğru dolar
    const midP = lay.pos[9];
    ALL.forEach((i) => { game.born[i] = -(Math.hypot(lay.pos[i].x - midP.x, lay.pos[i].y - midP.y) / lay.s) * 0.045 - rand(0, 0.05); });

    const curWord = () => game.sel.map((i) => game.letters[i]).join('');
    const kindOf = (w) => {
      if (w.length < 3) return null;
      if (game.used.has(w)) return 'used';
      if (SOZ.has(w) || (lists && lists.common.has(w))) return 'ok';
      if (lists && lists.big.has(w)) return 'extra';
      return null;
    };

    /* ---------- Kelime kontrolü ---------- */

    function syncWord() {
      const w = curWord();
      const kind = kindOf(w);
      curEl.textContent = w ? trUpper(w) : '';
      wordEl.className = `kv-word ${w ? 'on' : ''} ${game.tapped ? 'tap' : ''} ${kind === 'ok' ? 'ok' : kind === 'extra' ? 'extra' : ''}`;
    }

    function clearLater(ms) {
      my.timeout(() => { if (!game.sel.length) { curEl.textContent = ''; wordEl.className = 'kv-word'; } }, ms);
    }

    function banner(text, cls = '') {
      bannerEl.textContent = text;
      bannerEl.className = `kv-banner on ${cls}`;
      my.timeout(() => bannerEl.classList.remove('on'), 1100);
    }

    function setProg(add) {
      game.prog += add;
      pbar.style.width = `${clamp((game.prog / goal.n) * 100, 0, 100)}%`;
      if (game.prog >= goal.n && !game.done) my.timeout(finish, 650);
    }

    function addHoney(p) {
      game.honey += p;
      data.honey = (data.honey || 0) + p;
      honeyEl.textContent = game.honey;
    }

    // Harfler kavanoza uçar, yerlerine yenileri dolar
    function popCells(path, power) {
      path.forEach((i, k) => {
        const p = lay.pos[i];
        game.pops.push({ x: p.x, y: p.y, c: game.letters[i], t: -k * 0.05 });
        fx.burst(p.x, p.y, { n: 10 + k, colors: ['#ffcd3c', '#fff3cf', '#ffa41a'], power });
        fx.ring(p.x, p.y, '#fff6d8', lay.s * 1.3);
      });
      if (game.hint && game.hint.path.some((i) => path.includes(i))) {
        game.hint = null;
        game.fly = null;
      }
      refill(path);
      path.forEach((i, k) => { game.born[i] = -(0.16 + k * 0.06); });
      if (game.avail.size === 0 && !game.done) {
        my.timeout(() => {
          if (game.done) return;
          toast('Kelime kalmadı, petek karıştı.');
          doShuffle();
        }, 700);
      }
    }

    function submit() {
      const w = curWord();
      const path = game.sel.slice();
      game.sel = [];
      game.tapped = false;
      syncWord();
      if (w.length < 3 || game.done) return;
      const kind = kindOf(w);
      if (kind === 'used') {
        curEl.textContent = `${trUpper(w)} zaten bulundu`;
        wordEl.className = 'kv-word on';
        sfx.soft();
        clearLater(800);
        return;
      }
      if (kind === 'extra') {
        // Nadir kelime kabul edilir ama hedefe sayılmaz
        const pts = Math.round(scoreOf(w) * 0.3);
        game.extras++;
        game.used.add(w);
        addHoney(pts);
        game.jarPulse = 1;
        banner(`Ekstra: ${trUpper(w)}  +${pts}`, 'extra');
        sfx.coin();
        popCells(path, 150);
        if (goal.kind === 'bal') setProg(pts);
        return;
      }
      if (kind !== 'ok') {
        game.combo = 0;
        comboEl.classList.remove('on');
        sfx.bad();
        buzz(30);
        game.shakeCell = path[path.length - 1];
        my.timeout(() => { game.shakeCell = -1; }, 300);
        curEl.textContent = `${trUpper(w)} yok`;
        wordEl.className = 'kv-word on no';
        shake(wordEl, 6);
        clearLater(760);
        return;
      }
      game.used.add(w);
      game.combo++;
      game.comboT = 3.2;
      const mult = 1 + Math.min(1.5, (game.combo - 1) * 0.25);
      const pts = Math.round(scoreOf(w) * mult);
      addHoney(pts);
      game.jarPulse = 1;
      game.flash = 0.5;
      game.words++;
      data.words++;
      if (w.length > game.last.length) game.last = w;
      if (w.length > (data.best || '').length) data.best = w;
      api.touch();
      banner(`${trUpper(w)}  +${pts}`, w.length >= 6 ? 'big' : '');
      if (game.combo >= 2) {
        comboEl.textContent = `${game.combo} üst üste  x${String(mult).replace(/\.?0+$/, '')}`;
        comboEl.classList.add('on');
      }
      if (w.length >= 6) shake(wrap, 8);
      sfx.good();
      tone({ type: 'triangle', f: 420 + w.length * 70, f2: 900, dur: 0.2, vol: 0.07 });
      buzz(16);
      popCells(path, game.combo >= 3 ? 340 : 220);
      for (let k = 0; k < Math.min(6, Math.ceil(w.length / 1.5)); k++) {
        game.bees.push({ x: rand(-40, stage.W * 0.3), y: rand(stage.H * 0.2, stage.H * 0.8), t: 0, w: rand(0, 6) });
      }
      if (goal.kind === 'bal') setProg(pts);
      else if (goal.kind === 'kelime') setProg(1);
      else if (goal.kind === 'uzun') setProg(w.length >= goal.len ? 1 : 0);
      else setProg(w.split('').filter((c) => c === goal.letter).length);
    }

    /* ---------- Dokunma: parmağını gezdir ya da tek tek dokun ---------- */
    const link = letterLink(my, cv, {
      game,
      tap: true,
      cells: () => lay.pos,
      radius: () => lay.s,
      canLink: (a, b) => NEI[a].includes(b),
      valid: () => { const k = kindOf(curWord()); return k === 'ok' || k === 'extra'; },
      onStart: () => { sfx.tile(); buzz(5); },
      onAdd: () => {
        sfx.tile();
        buzz(5);
        tone({ type: 'sine', f: 300 + game.sel.length * 60, dur: 0.07, vol: 0.05 });
      },
      onPop: () => sfx.soft(),
      onChange: syncWord,
      submit,
    });

    my.on(wordEl, 'click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || game.done) return;
      sfx.tap();
      if (b.dataset.act === 'ok') submit();
      else {
        game.sel.pop();
        if (!game.sel.length) game.tapped = false;
        syncWord();
      }
    });

    // Karıştır: aynı harfler, gözler birbirinin üstünden geçerek yer değiştirir
    function doShuffle() {
      const old = game.letters.slice();
      setBoard(arrange(old));
      const buckets = {};
      for (const j of shuffle(ALL.slice())) (buckets[old[j]] = buckets[old[j]] || []).push(j);
      const from = new Array(COUNT);
      for (const i of shuffle(ALL.slice())) {
        const b = buckets[game.letters[i]];
        let at = b.findIndex((j) => j !== i);
        if (at < 0) at = 0;
        from[i] = lay.pos[b.splice(at, 1)[0]];
      }
      game.aFrom = from;
      game.aT = 0;
      game.born.fill(null);
      game.sel = [];
      game.tapped = false;
      game.hint = null;
      game.fly = null;
      syncWord();
      sfx.whoosh();
      buzz(10);
    }

    // Arı Yardımı: arı kovandan kalkar, kelimenin harflerinin üstünden sırayla geçer
    function doHint() {
      if (game.fly) return;
      if (game.hint) {
        // Aynı kelimeyi yeniden göstermek yıldız yemez
        game.hint.lit = 0;
        game.fly = { k: 0 };
        sfx.whoosh();
        return;
      }
      const m = scanBoard(game.letters, game.used);
      if (!m.size) {
        toast('Petek karıştı, yeniden dene.');
        doShuffle();
        return;
      }
      const words = [...m.keys()];
      const pool = focusSet && words.some((w) => focusSet.has(w)) ? words.filter((w) => focusSet.has(w)) : words;
      pool.sort((a, b) => b.length - a.length);
      const word = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
      game.hint = { word, path: m.get(word), lit: 0 };
      game.fly = { k: 0 };
      game.hints++;
      sfx.whoosh();
      buzz(10);
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
      game.sel = [];
      syncWord();
      const stars = game.hints === 0 ? 3 : game.hints <= 2 ? 2 : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = 7 + stars * 6 + game.extras + Math.floor(game.honey / 90);
      api.finish({ coins });
      confetti({ n: 70 });
      sfx.ding(88);
      my.timeout(() => {
        noteSheet(li + 7, () => resultSheet({
          won: true,
          title: 'Kovan Doldu!',
          sub: game.last ? `En uzun kelimen: ${trUpper(game.last)}` : '',
          stars,
          coins,
          stats: [['Kelime', game.words], ['Bal', game.honey], ['Arı Yardımı', game.hints]],
          buttons: [
            ...(li + 1 < PETEK_LEVELS ? [{ label: 'Sonraki Petek', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', icon: 'replay', act: () => play(li) },
            { label: 'Petekler', icon: 'list', act: () => toMenu() },
          ],
        }));
      }, 650);
    }

    f.onBack = () => {
      if (game.done) { toMenu(); return; }
      game.paused = true;
      pauseSheet({
        onResume: () => { game.paused = false; },
        onRestart: () => play(li),
        onQuit: () => toMenu(),
      });
    };

    /* ---------- Çizim ---------- */

    // Göz yeri: karışırken yay çizerek yeni yerine gider
    const drawPos = (i) => {
      const p = lay.pos[i];
      if (game.aT >= 1) return p;
      const e = ease(clamp((game.aT - i * 0.018) / 0.62, 0, 1));
      const fr = game.aFrom[i] || p;
      const bulge = Math.sin(e * Math.PI);
      return {
        x: lerp(fr.x, p.x, e) - (p.y - fr.y) * bulge * 0.18,
        y: lerp(fr.y, p.y, e) + (p.x - fr.x) * bulge * 0.18,
        lift: bulge,
      };
    };
    const hollow = (g, x, y, s) => {
      hexPath(g, x, y, s);
      g.fillStyle = 'rgba(158,96,8,.5)';
      g.fill();
      g.lineWidth = Math.max(2, s * 0.05);
      g.strokeStyle = 'rgba(42,22,54,.35)';
      g.stroke();
    };

    my.raf((dt, t) => {
      const { W, H, g } = stage;
      stage.begin();
      relayout();
      link.tick();
      if (game.aT < 1) game.aT = Math.min(1, game.aT + dt * 1.5);
      g.drawImage(backdrop, 0, 0, W, H);

      const sel = game.sel;
      const base = lay.s * 0.92;
      const hint = game.hint;
      // Karışırken boş kalan gözler görünsün
      if (game.aT < 1) for (let i = 0; i < COUNT; i++) hollow(g, lay.pos[i].x, lay.pos[i].y, base);

      /* Gözler */
      const shown = [];
      for (let i = 0; i < COUNT; i++) {
        const p = drawPos(i);
        const on = sel.includes(i);
        const sh = game.shakeCell === i ? Math.sin(t / 22) * 4 : 0;
        let b = game.born[i];
        let sc = 1;
        if (b !== null) {
          b += dt;
          game.born[i] = b >= 0.5 ? null : b;
        }
        const x = p.x + sh;
        const y = p.y;
        let letterK = 1;
        if (b !== null) {
          // Boş göz, içine bal dolar, üstüne mum kapak büyür, harf çıkar
          hollow(g, x, y, base);
          if (b > 0) {
            const rise = clamp(b / 0.22, 0, 1);
            g.save();
            hexPath(g, x, y, base);
            g.clip();
            g.fillStyle = '#f0a000';
            const top = y + base - rise * base * 2;
            g.beginPath();
            g.moveTo(x - base, top);
            for (let px = -base; px <= base; px += base / 4) g.lineTo(x + px, top + Math.sin(px / (base * 0.28) + t / 90) * base * 0.06);
            g.lineTo(x + base, y + base);
            g.lineTo(x - base, y + base);
            g.closePath();
            g.fill();
            g.restore();
          }
          letterK = b > 0.22 ? backOut(clamp((b - 0.22) / 0.28, 0, 1)) : 0;
          sc = letterK;
        } else if (p.lift) {
          sc = 1 + p.lift * 0.14;
        }
        const s = base * (on ? 1.08 : 1) * sc;
        shown.push({ x, y, s, letterK });
        if (sc <= 0.01) continue;
        const litNow = hint && hint.path.indexOf(i) >= 0 && hint.path.indexOf(i) < hint.lit;
        hexPath(g, x, y + 4, s);
        g.fillStyle = 'rgba(42,22,54,.22)';
        g.fill();
        hexPath(g, x, y, s);
        g.fillStyle = on ? '#2ee6a0' : litNow ? '#fff' : '#fff6d8';
        g.fill();
        g.lineWidth = Math.max(2.5, lay.s * 0.09);
        g.strokeStyle = INK;
        g.stroke();
        if (litNow) {
          hexPath(g, x, y, s * (1.04 + Math.sin(t / 170) * 0.03));
          g.strokeStyle = '#ff5fa2';
          g.lineWidth = Math.max(3, lay.s * 0.1);
          g.stroke();
        }
      }

      /* Arının yolu */
      if (hint && hint.lit > 0) {
        g.beginPath();
        for (let k = 0; k < hint.lit; k++) {
          const p = lay.pos[hint.path[k]];
          if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
        }
        if (game.fly) g.lineTo(game.bee.x, game.bee.y);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(255,95,162,.55)';
        g.lineWidth = lay.s * 0.2;
        g.stroke();
      }

      /* Seçim ipi */
      if (sel.length) {
        const k = kindOf(curWord());
        drawRope(g, sel.map((i) => shown[i]), link.finger, lay.s, k === 'ok' || k === 'extra' ? k : null, t);
      }

      /* Harfler */
      for (let i = 0; i < COUNT; i++) {
        const c = shown[i];
        if (c.letterK <= 0.01) continue;
        const ls = c.s;
        label(g, c.x, c.y + ls * 0.06, trUpper(game.letters[i]), { size: ls * 0.92, color: INK, stroke: NONE, sw: 0, font: FONT });
        label(g, c.x + ls * 0.5, c.y - ls * 0.42, String(VAL[game.letters[i]] || 2), { size: ls * 0.32, color: '#9a7a24', stroke: NONE, sw: 0, font: FONT });
        const order = hint ? hint.path.indexOf(i) : -1;
        if (order >= 0 && order < hint.lit) {
          // Arının geçiş sırası
          const nx = c.x - ls * 0.5;
          const ny = c.y - ls * 0.42;
          g.beginPath();
          g.arc(nx, ny, ls * 0.2, 0, Math.PI * 2);
          g.fillStyle = '#ff5fa2';
          g.fill();
          label(g, nx, ny + ls * 0.01, String(order + 1), { size: ls * 0.28, color: '#fff', stroke: NONE, sw: 0, font: FONT });
        }
      }

      /* Bal kavanozu */
      const jr = lay.jar.r;
      const fillK = clamp(game.prog / goal.n, 0, 1);
      if (game.jarPulse > 0) game.jarPulse = Math.max(0, game.jarPulse - dt * 2.4);
      drawJar(g, lay.jar.x, lay.jar.y, jr, fillK, game.jarPulse, t, rrect);
      label(g, lay.jar.x, lay.jar.y + jr * 0.2, `%${Math.round(fillK * 100)}`, { size: jr * 0.46, color: '#fff', stroke: INK, sw: 0.3, font: FONT });

      /* Kavanoza uçan harfler */
      game.pops = game.pops.filter((p) => {
        p.t += dt * 1.6;
        if (p.t <= 0) return true;
        if (p.t >= 1) return false;
        const k = ease(p.t);
        const x = lerp(p.x, lay.jar.x, k);
        const y = lerp(p.y, lay.jar.y, k) - Math.sin(p.t * Math.PI) * lay.s * 1.3;
        const s = lay.s * (0.8 - p.t * 0.5);
        hexPath(g, x, y, s);
        g.fillStyle = '#ffcd3c';
        g.fill();
        g.lineWidth = 2.4;
        g.strokeStyle = INK;
        g.stroke();
        label(g, x, y, trUpper(p.c), { size: s * 0.95, color: INK, stroke: NONE, sw: 0, font: FONT });
        return true;
      });

      /* Yardım arısı: kavanozdan kalkar, kelimenin üstünden geçer, geri döner */
      const bee = game.bee;
      const bsz = Math.max(13, lay.s * 0.42);
      if (!bee.x) { bee.x = lay.jar.x; bee.y = lay.jar.y - jr * 1.6; }
      let bdx = 0;
      if (game.fly && hint) {
        const p = lay.pos[hint.path[game.fly.k]];
        const dx = p.x - bee.x;
        const dy = p.y - bee.y;
        const d = Math.hypot(dx, dy);
        const v = lay.s * (game.fly.k === 0 ? 11 : 4.8) * dt;
        bdx = dx;
        if (d <= v + 0.5) {
          bee.x = p.x;
          bee.y = p.y;
          hint.lit = Math.max(hint.lit, game.fly.k + 1);
          fx.ring(p.x, p.y, '#ff5fa2', lay.s * 1.2);
          tone({ type: 'sine', f: 520 + game.fly.k * 90, dur: 0.1, vol: 0.06 });
          buzz(6);
          game.fly.k++;
          if (game.fly.k >= hint.path.length) game.fly = null;
        } else {
          bee.x += (dx / d) * v;
          bee.y += (dy / d) * v;
        }
      } else {
        const hx = lay.jar.x;
        const hy = lay.jar.y - jr * 1.6;
        bdx = hx - bee.x;
        const k = Math.min(1, dt * 3);
        bee.x += (hx - bee.x) * k;
        bee.y += (hy - bee.y) * k;
      }
      bee.ang = lerp(bee.ang, clamp(bdx * 0.012, -0.5, 0.5), Math.min(1, dt * 6));
      drawBee(g, bee.x, bee.y + Math.sin(t / 150) * 3 - (game.fly ? bsz * 0.9 : 0), bsz, t, bee.ang);

      /* Bal taşıyan arılar */
      game.bees = game.bees.filter((b) => {
        b.t += dt * 0.55;
        if (b.t >= 1) return false;
        const x = lerp(b.x, lay.jar.x, b.t);
        const y = lerp(b.y, lay.jar.y - jr, b.t) + Math.sin(t / 160 + b.w) * 12;
        drawBee(g, x, y, lay.s * 0.3, t);
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
    game.posOf = (i) => lay.pos[i];
    game.scan = () => scanBoard(game.letters, game.used);
    game.hintNow = doHint;
    game.shuffleNow = doShuffle;
    game.freshBoard = () => freshBoard();
  }

  return { play, end, get st() { return st; } };
}
