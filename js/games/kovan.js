// Harf Kovanı: petekteki komşu harfleri parmağınla birleştir, kelime çıkar. Kelime bal olur, kavanoz dolar.
// Harf listesi 44 bin Türkçe kelime. Bulduğun harfler patlar, üstten yeni harf düşer, arılar balı taşır.

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, randInt, pick, trUpper, trLower, seeded, shuffle } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, rrect, label, shake, pop } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';

const LEVELS = 30;
// Türkçe metinde harflerin kabaca görülme sıklığı
const FREQ = [['a', 118], ['e', 88], ['i', 83], ['n', 73], ['r', 68], ['l', 58], ['ı', 51], ['k', 48], ['d', 46], ['m', 38], ['t', 35], ['y', 33], ['u', 32], ['s', 30], ['b', 26], ['o', 25], ['ü', 19], ['z', 15], ['ş', 14], ['g', 13], ['ç', 12], ['c', 11], ['h', 11], ['p', 9], ['v', 8], ['ğ', 7], ['ö', 7], ['f', 4], ['j', 1]];
const BAG = FREQ.flatMap(([c, n]) => Array(n).fill(c));
const VAL = { a: 1, e: 1, i: 1, ı: 1, n: 1, r: 1, l: 1, k: 1, d: 2, m: 2, t: 2, y: 2, u: 2, s: 2, b: 3, o: 2, ü: 3, z: 4, ş: 4, g: 3, ç: 4, c: 4, h: 4, p: 5, v: 5, ğ: 6, ö: 5, f: 6, j: 8 };
const VOWELS = 'aeıioöuü';

// Petek: 3-4-5-4-3 sıra, eksen koordinatlı altıgenler
const ROWS = [3, 4, 5, 4, 3];
const CELLS = [];
ROWS.forEach((n, r) => {
  for (let c = 0; c < n; c++) CELLS.push({ r, c, i: CELLS.length, off: (5 - n) / 2 });
});
const neighbors = (a, b) => {
  if (a.i === b.i) return false;
  const dr = Math.abs(a.r - b.r);
  if (dr > 1) return false;
  const ax = a.c + a.off;
  const bx = b.c + b.off;
  if (dr === 0) return Math.abs(a.c - b.c) === 1;
  return Math.abs(ax - bx) <= 0.51;
};
const NEI = CELLS.map((a) => CELLS.filter((b) => neighbors(a, b)).map((b) => b.i));

const goalOf = (li) => {
  const r = seeded(31 + li * 17);
  const kinds = li < 3 ? ['bal'] : li < 8 ? ['bal', 'kelime'] : ['bal', 'kelime', 'uzun', 'harf'];
  const kind = kinds[li % kinds.length];
  if (kind === 'kelime') return { kind, n: 6 + Math.floor(li / 3), text: (n) => `${n} kelime bul` };
  if (kind === 'uzun') return { kind, n: 2 + Math.floor(li / 10), len: li < 16 ? 5 : 6, text: (n, g) => `${n} tane ${g.len}+ harfli kelime` };
  if (kind === 'harf') {
    const letter = r.pick('aeiknrlstmd'.split(''));
    return { kind, n: 8 + Math.floor(li / 4), letter, text: (n, g) => `${n} tane ${trUpper(g.letter)} harfi kullan` };
  }
  return { kind, n: 280 + li * 140, text: (n) => `${n} bal topla` };
};
const movesOf = (li) => Math.max(10, 18 - Math.floor(li / 6));

let wordsP = null;
function loadWords() {
  if (!wordsP) {
    wordsP = fetch(new URL('../../data/words.txt', import.meta.url))
      .then((r) => r.text())
      .then((t) => new Set(t.split('\n').map((w) => w.trim()).filter(Boolean)));
  }
  return wordsP;
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], words: 0, best: 0, found: [] });
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
      art: ART.kovan,
      sub: 'Komşu harfleri birleştir, kelimeyi çıkar. Kovan bal dolsun.',
      stats: [['Bulunan Kelime', data.words], ['En İyi Kelime', data.best ? trUpper(data.best) : '-']],
      how: [
        'Parmağını harflerin üstünde gezdir: komşu olanlar birbirine bağlanır.',
        'Parmağını kaldırınca kelime kontrol edilir. Üç harften kısa olmaz.',
        'Uzun kelime daha çok bal yapar. Zor harfler (ğ, j, f) fazladan puandır.',
        'Her kelime bir hamle. Hamleler bitmeden hedefi tamamla.',
        'Sıkıştıysan Arı Yardımı bir kelime gösterir, ama bir hamle yer.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Kovanlar', onPick: (i) => play(i) },
    });
  }

  async function play(li) {
    end();
    local = new Life();
    const my = local;
    const goal = goalOf(li);
    const fx = makeFx();
    const rng = seeded(500 + li * 29);
    const game = {
      letters: [], sel: [], honey: 0, words: 0, prog: 0, moves: movesOf(li), done: false, paused: false,
      pops: [], bees: [], last: '', shakeCell: -1, hintCells: [], loading: true, goal,
      combo: 0, comboT: 0, jar: { x: 0, y: 0, r: 30 }, jarPulse: 0, flash: 0,
    };
    st = game;

    f.setTitle(`Kovan ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="kv">
        <div class="kv-top">
          <span class="kv-goal"><small>Hedef</small><b data-goal>${goal.text(goal.n, goal)}</b><i class="kv-pbar"><u data-pbar></u></i></span>
          <span class="kv-moves"><b data-moves>${game.moves}</b><small>hamle</small></span>
        </div>
        <canvas class="kv-cv"></canvas>
        <div class="kv-word" data-word></div>
        <div class="kv-banner" data-banner></div>
        <div class="kv-combo" data-combo></div>
        <div class="kv-bar">
          <span class="kv-honey"><svg viewBox="0 0 24 24"><path d="M6 9h12l1 11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" fill="#ffb31a" stroke="#2a1636" stroke-width="2.200" stroke-linejoin="round"/><path d="M5 6h14v3H5z" fill="#fff3cf" stroke="#2a1636" stroke-width="2.200"/></svg><b data-honey>0</b></span>
          <button class="kv-b" data-act="shuffle">${icon('replay')}Karıştır</button>
          <button class="kv-b" data-act="hint">${icon('hint')}Arı Yardımı</button>
        </div>
        <div class="kv-wait" data-wait>Kelime çuvalı açılıyor...</div>
      </div>`);
    const wrap = f.main.querySelector('.kv');
    const cv = wrap.querySelector('.kv-cv');
    const wordEl = wrap.querySelector('[data-word]');
    const bannerEl = wrap.querySelector('[data-banner]');
    const comboEl = wrap.querySelector('[data-combo]');
    const honeyEl = wrap.querySelector('[data-honey]');
    const movesEl = wrap.querySelector('[data-moves]');
    const pbar = wrap.querySelector('[data-pbar]');
    const stage = fitCanvas(cv, my);

    const WORDS = await loadWords().catch(() => null);
    if (!my.alive) return;
    if (!WORDS) {
      wrap.querySelector('[data-wait]').textContent = 'Kelime listesi yüklenemedi.';
      return;
    }
    wrap.querySelector('[data-wait]').remove();
    game.loading = false;

    // Harf dağıtımı: en az yedi sesli olsun ki kelime çıksın
    const drawLetter = () => BAG[rng.int(0, BAG.length - 1)];
    const RARE = 'jfğöçvpz';
    // Bir peteğin oynanabilirliği: kaç ayrı kelime çıkıyor, uzunu var mı
    const quality = (cap = 14) => {
      const found = scanWords(3, cap);
      let long = 0;
      for (const w of found) if (w.length >= 5) long++;
      return { n: found.size, long };
    };
    // Harfleri sesli uyumuna göre dağıt: her sesliyi ayrı yere koy, nadir harfi bir taneyle sınırla
    function deal() {
      const n = CELLS.length;
      const vCount = rng.int(7, 9);
      const letters = new Array(n).fill(null);
      const vowelBag = BAG.filter((c) => VOWELS.includes(c));
      const consBag = BAG.filter((c) => !VOWELS.includes(c));
      // Sesliler önce: birbirine fazla yapışmasın
      const spots = shuffle(CELLS.map((c) => c.i), () => rng());
      let placed = 0;
      for (const i of spots) {
        if (placed >= vCount) break;
        const near = NEI[i].filter((j) => letters[j] && VOWELS.includes(letters[j])).length;
        if (near > 1) continue;
        letters[i] = vowelBag[rng.int(0, vowelBag.length - 1)];
        placed++;
      }
      for (const i of spots) {
        if (placed >= vCount) break;
        if (!letters[i]) { letters[i] = vowelBag[rng.int(0, vowelBag.length - 1)]; placed++; }
      }
      let rare = 0;
      for (let i = 0; i < n; i++) {
        if (letters[i]) continue;
        let c = consBag[rng.int(0, consBag.length - 1)];
        let guard = 0;
        while (RARE.includes(c) && rare >= 1 && guard++ < 12) c = consBag[rng.int(0, consBag.length - 1)];
        if (RARE.includes(c)) rare++;
        letters[i] = c;
      }
      return letters;
    }
    function fill() {
      let best = null;
      for (let guard = 0; guard < 40; guard++) {
        game.letters = deal();
        const q = quality();
        if (!best || q.n > best.q.n) best = { letters: game.letters.slice(), q };
        if (q.n >= 9 && q.long >= 1) return;
      }
      game.letters = best.letters;
    }
    // Petekteki kelimeleri tara: bulunca durur, arayüz takılmasın
    function scanWords(minLen = 3, cap = 20) {
      const out = new Set();
      const seen = new Array(CELLS.length).fill(false);
      const walk = (i, word) => {
        if (out.size >= cap) return;
        const w = word + game.letters[i];
        if (w.length >= minLen && WORDS.has(w)) out.add(w);
        if (w.length >= 6) return;
        seen[i] = true;
        for (const j of NEI[i]) if (!seen[j]) walk(j, w);
        seen[i] = false;
      };
      for (let i = 0; i < CELLS.length && out.size < cap; i++) walk(i, '');
      return out;
    }
    // Petekte geçerli bir kelime var mı: kısa derinlikli arama
    function findWord(minLen = 3) {
      let best = null;
      const seen = new Array(CELLS.length).fill(false);
      const walk = (i, word, path) => {
        if (best && best.word.length >= 6) return;
        const w = word + game.letters[i];
        if (w.length >= minLen && WORDS.has(w) && (!best || w.length > best.word.length)) best = { word: w, path: [...path, i] };
        if (w.length >= 6) return;
        seen[i] = true;
        for (const j of NEI[i]) if (!seen[j]) walk(j, w, [...path, i]);
        seen[i] = false;
      };
      for (let i = 0; i < CELLS.length; i++) walk(i, '', []);
      return best;
    }
    fill();

    /* ---------- Yerleşim ---------- */
    let lay = { s: 40, x: 0, y: 0 };
    const cellPos = (c) => {
      const s = lay.s;
      const x = lay.x + (c.c + c.off) * s * 1.74 + s * 0.87;
      const y = lay.y + c.r * s * 1.5 + s;
      return { x, y };
    };
    const relayout = () => {
      const { W, H } = stage;
      const s = Math.min((W - 14) / (5 * 1.74), (H - 14) / (ROWS.length * 1.5 + 0.5));
      lay.s = s;
      lay.x = (W - 5 * 1.74 * s) / 2;
      lay.y = (H - (ROWS.length * 1.5 + 0.5) * s) / 2;
    };
    relayout();

    game.posOf = (i) => cellPos(CELLS[i]);
    game.quality = (cap) => quality(cap);
    game.reshuffle = () => fill();
    game.findWord = (n) => findWord(n);
    const cellAt = (px, py) => {
      let best = -1;
      let bd = lay.s * 0.92;
      for (const c of CELLS) {
        const p = cellPos(c);
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < bd) { bd = d; best = c.i; }
      }
      return best;
    };

    const curWord = () => game.sel.map((i) => game.letters[i]).join('');
    const scoreOf = (w) => w.split('').reduce((a, c) => a + (VAL[c] || 2), 0) * w.length;

    function syncWord() {
      const w = curWord();
      const ok = w.length >= 3 && WORDS.has(w);
      wordEl.textContent = w ? trUpper(w) : '';
      wordEl.className = `kv-word ${w ? 'on' : ''} ${ok ? 'ok' : w.length >= 3 ? 'no' : ''}`;
    }

    function setProg(add) {
      game.prog += add;
      pbar.style.width = `${clamp((game.prog / goal.n) * 100, 0, 100)}%`;
      if (game.prog >= goal.n && !game.done) finish(true);
    }

    function submit() {
      const w = curWord();
      const path = game.sel.slice();
      game.sel = [];
      syncWord();
      if (w.length < 3) return;
      if (!WORDS.has(w)) {
        game.combo = 0;
        comboEl.classList.remove('on');
        sfx.bad();
        buzz(30);
        game.shakeCell = path[path.length - 1];
        my.timeout(() => { game.shakeCell = -1; }, 300);
        wordEl.textContent = `${trUpper(w)} yok`;
        wordEl.className = 'kv-word on no';
        my.timeout(() => { if (!curWord()) { wordEl.textContent = ''; wordEl.className = 'kv-word'; } }, 700);
        return;
      }
      game.combo++;
      game.comboT = 2.6;
      const mult = 1 + Math.min(1.5, (game.combo - 1) * 0.25);
      const pts = Math.round(scoreOf(w) * mult);
      game.honey += pts;
      game.jarPulse = 1;
      game.flash = 0.5;
      bannerEl.textContent = `${trUpper(w)}  +${pts}`;
      bannerEl.className = `kv-banner on${w.length >= 6 ? ' big' : ''}`;
      my.timeout(() => bannerEl.classList.remove('on'), 1100);
      if (game.combo >= 2) {
        comboEl.textContent = `${game.combo} üst üste  x${mult.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
        comboEl.classList.add('on');
      }
      if (w.length >= 6) shake(wrap, 8);
      game.words++;
      data.words++;
      game.moves--;
      game.last = w;
      if (w.length > (data.best || '').length) data.best = w;
      if (!data.found.includes(w) && data.found.length < 200) data.found.push(w);
      api.touch();
      honeyEl.textContent = game.honey;
      movesEl.textContent = game.moves;
      sfx.good();
      tone({ type: 'triangle', f: 420 + w.length * 70, f2: 900, dur: 0.2, vol: 0.07 });
      buzz(16);
      // Harfler patlar, üstten yenisi düşer
      const sc = game.combo >= 3 ? 1.6 : 1;
      path.forEach((i, k) => {
        const p = cellPos(CELLS[i]);
        game.pops.push({ x: p.x, y: p.y, c: game.letters[i], t: 0, to: game.jar });
        fx.burst(p.x, p.y, { n: Math.round(10 * sc) + k, colors: ['#ffcd3c', '#fff3cf', '#ffa41a'], power: 220 * sc });
        game.drops = game.drops || {};
        game.drops[i] = 1;
      });
      // Yeni harfler: peteği oynanır tutacak şekilde seçilir
      const old = path.map((i) => game.letters[i]);
      let bestTry = null;
      for (let tryN = 0; tryN < 14; tryN++) {
        const cand = deal();
        path.forEach((i, k) => { game.letters[i] = cand[(i + k * 7) % cand.length]; });
        const q = quality(10);
        if (!bestTry || q.n > bestTry.q.n) bestTry = { letters: path.map((i) => game.letters[i]), q };
        if (q.n >= 5) break;
      }
      if (bestTry && bestTry.q.n < 2) path.forEach((i, k) => { game.letters[i] = old[k]; });
      else if (bestTry) path.forEach((i, k) => { game.letters[i] = bestTry.letters[k]; });
      for (let k = 0; k < Math.min(6, Math.ceil(w.length / 1.5)); k++) {
        game.bees.push({ x: rand(-40, stage.W * 0.3), y: rand(stage.H * 0.2, stage.H * 0.8), t: 0, w: rand(0, 6) });
      }
      fx.text(stage.W / 2, stage.H * 0.5, `+${pts}`, '#ffcd3c', 30);
      if (goal.kind === 'bal') setProg(pts);
      else if (goal.kind === 'kelime') setProg(1);
      else if (goal.kind === 'uzun') setProg(w.length >= goal.len ? 1 : 0);
      else setProg(w.split('').filter((c) => c === goal.letter).length);
      if (!game.done && game.moves <= 0) my.timeout(() => finish(false), 600);
      if (!findWord()) {
        my.timeout(() => {
          if (game.done) return;
          toast('Kelime kalmadı, petek karıştı.');
          fill();
          sfx.whoosh();
        }, 500);
      }
    }

    /* ---------- Dokunma ---------- */
    const pick2 = (e) => {
      const r = cv.getBoundingClientRect();
      return cellAt(e.clientX - r.left, e.clientY - r.top);
    };
    let dragging = false;
    my.on(cv, 'pointerdown', (e) => {
      if (game.paused || game.done) return;
      const i = pick2(e);
      if (i < 0) return;
      dragging = true;
      game.sel = [i];
      game.hintCells = [];
      sfx.tile();
      syncWord();
    });
    my.on(cv, 'pointermove', (e) => {
      if (!dragging) return;
      const i = pick2(e);
      if (i < 0) return;
      const n = game.sel.length;
      if (n && game.sel[n - 1] === i) return;
      if (n > 1 && game.sel[n - 2] === i) {
        game.sel.pop();
        sfx.soft();
        syncWord();
        return;
      }
      if (game.sel.includes(i)) return;
      if (n && !NEI[game.sel[n - 1]].includes(i)) return;
      game.sel.push(i);
      sfx.tile();
      buzz(5);
      syncWord();
    });
    const up = () => {
      if (!dragging) return;
      dragging = false;
      submit();
    };
    my.on(window, 'pointerup', up);
    my.on(window, 'pointercancel', up);

    my.on(wrap, 'click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || game.done) return;
      sfx.tap();
      if (b.dataset.act === 'shuffle') {
        fill();
        game.sel = [];
        syncWord();
        sfx.whoosh();
        toast('Petek karıştı.');
      } else {
        const w = findWord(4) || findWord(3);
        if (!w) { toast('Bu petekte kelime kalmamış.'); return; }
        game.hintCells = w.path;
        game.moves--;
        movesEl.textContent = game.moves;
        toast(`${w.word.length} harfli bir kelime var.`);
        my.timeout(() => { game.hintCells = []; }, 3200);
        if (game.moves <= 0 && !game.done) my.timeout(() => finish(false), 800);
      }
    });

    function finish(won) {
      if (game.done) return;
      game.done = true;
      const ratio = game.prog / goal.n;
      const stars = !won ? 0 : game.moves >= movesOf(li) * 0.4 ? 3 : game.moves >= 2 ? 2 : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = won ? 7 + stars * 6 + Math.floor(game.honey / 90) : 2 + Math.floor(game.honey / 140);
      api.finish({ coins });
      my.timeout(() => {
        resultSheet({
          won,
          title: won ? 'Kovan Doldu!' : 'Hamleler Bitti',
          sub: won ? `En güzel kelimen: ${trUpper(game.last || '')}` : `Hedefin %${Math.round(ratio * 100)}'ine geldin.`,
          stars,
          coins,
          stats: [['Kelime', game.words], ['Bal', game.honey], ['Kalan Hamle', Math.max(0, game.moves)]],
          buttons: [
            ...(stars && li + 1 < LEVELS ? [{ label: 'Sonraki Kovan', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', main: !stars, icon: 'replay', act: () => play(li) },
            { label: 'Kovanlar', icon: 'list', act: () => menu() },
          ],
        });
      }, 700);
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
    const hexPath = (g, x, y, s) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * s;
        const py = y + Math.sin(a) * s;
        if (k) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.closePath();
    };
    const bee = (g, x, y, s, t) => {
      g.save();
      g.translate(x, y);
      const flap = Math.sin(t / 28);
      g.globalAlpha = 0.85;
      for (const d of [-1, 1]) {
        g.beginPath();
        g.ellipse(d * s * 0.5, -s * 0.6, s * 0.55, s * 0.3 * (0.5 + Math.abs(flap) * 0.6), d * 0.5, 0, Math.PI * 2);
        g.fillStyle = '#eaf6ff';
        g.fill();
      }
      g.globalAlpha = 1;
      g.beginPath();
      g.ellipse(0, 0, s * 0.85, s * 0.6, 0, 0, Math.PI * 2);
      g.fillStyle = '#ffcd3c';
      g.fill();
      g.lineWidth = s * 0.16;
      g.strokeStyle = '#2a1636';
      g.stroke();
      g.fillStyle = '#2a1636';
      g.fillRect(-s * 0.18, -s * 0.52, s * 0.22, s * 1.04);
      g.fillRect(s * 0.26, -s * 0.42, s * 0.2, s * 0.84);
      g.beginPath();
      g.arc(-s * 0.52, -s * 0.12, s * 0.1, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };

    my.raf((dt, t) => {
      const { W, H, g } = stage;
      stage.begin();
      relayout();
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#ffe9a8');
      bg.addColorStop(1, '#ffb31a');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);

      // Arka plan peteği
      g.globalAlpha = 0.18;
      const bs = lay.s * 0.8;
      for (let r = -1; r < H / (bs * 1.5) + 1; r++) {
        for (let c = -1; c < W / (bs * 1.74) + 1; c++) {
          hexPath(g, c * bs * 1.74 + (r % 2 ? bs * 0.87 : 0), r * bs * 1.5, bs * 0.94);
          g.fillStyle = '#fff6d8';
          g.fill();
        }
      }
      g.globalAlpha = 1;

      const sel = game.sel;
      // Seçim ipi
      if (sel.length > 1) {
        g.beginPath();
        sel.forEach((i, k) => {
          const p = cellPos(CELLS[i]);
          if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
        });
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.strokeStyle = 'rgba(42,22,54,.4)';
        g.lineWidth = lay.s * 0.42;
        g.stroke();
        const okNow = curWord().length >= 3 && WORDS.has(curWord());
        g.strokeStyle = okNow ? 'rgba(46,230,160,.95)' : 'rgba(255,255,255,.7)';
        g.lineWidth = lay.s * 0.2;
        g.shadowColor = okNow ? '#2ee6a0' : '#fff6d8';
        g.shadowBlur = 14 + Math.sin(t / 120) * 5;
        g.stroke();
        g.shadowBlur = 0;
      }

      for (const c of CELLS) {
        const p = cellPos(c);
        const i = c.i;
        const on = sel.includes(i);
        const hint = game.hintCells.includes(i);
        const drop = game.drops && game.drops[i];
        if (drop) {
          game.drops[i] = Math.max(0, drop - dt * 3.4);
          if (!game.drops[i]) delete game.drops[i];
        }
        const dy = drop ? -drop * lay.s * 2.2 : 0;
        const sh = game.shakeCell === i ? Math.sin(t / 22) * 4 : 0;
        const s = lay.s * 0.92 * (on ? 1.08 : 1);
        g.save();
        g.translate(p.x + sh, p.y + dy);
        hexPath(g, 0, 4, s);
        g.fillStyle = 'rgba(42,22,54,.22)';
        g.fill();
        hexPath(g, 0, 0, s);
        g.fillStyle = on ? '#2ee6a0' : hint ? '#fff' : '#fff6d8';
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#2a1636';
        g.stroke();
        if (hint) {
          hexPath(g, 0, 0, s * (1.06 + Math.sin(t / 180) * 0.05));
          g.strokeStyle = '#ff5fa2';
          g.lineWidth = 3.5;
          g.stroke();
        }
        label(g, 0, s * 0.3, trUpper(game.letters[i]), { size: s * 0.92, color: '#2a1636', stroke: 'rgba(0,0,0,0)', sw: 0, font: '"Baloo 2", sans-serif' });
        label(g, s * 0.5, -s * 0.38, String(VAL[game.letters[i]] || 2), { size: s * 0.34, color: '#9a7a24', stroke: 'rgba(0,0,0,0)', sw: 0, font: '"Baloo 2", sans-serif' });
        g.restore();
      }

      // Bal kavanozu: hedefe göre dolar
      const jr = Math.max(26, Math.min(W, H) * 0.09);
      game.jar = { x: W - jr * 1.25, y: H - jr * 1.9, r: jr };
      const fillK = clamp(game.prog / goal.n, 0, 1);
      if (game.jarPulse > 0) game.jarPulse = Math.max(0, game.jarPulse - dt * 2.4);
      g.save();
      g.translate(game.jar.x, game.jar.y);
      const kp = 1 + game.jarPulse * 0.14;
      g.scale(kp, 2 - kp);
      rrect(g, -jr * 0.72, -jr * 0.9, jr * 1.44, jr * 1.8, jr * 0.3);
      g.fillStyle = 'rgba(255,255,255,.55)';
      g.fill();
      g.lineWidth = 3.5;
      g.strokeStyle = '#2a1636';
      g.stroke();
      g.save();
      rrect(g, -jr * 0.72, -jr * 0.9, jr * 1.44, jr * 1.8, jr * 0.3);
      g.clip();
      const hy = jr * 0.9 - fillK * jr * 1.8;
      g.fillStyle = '#f0a000';
      g.beginPath();
      g.moveTo(-jr * 0.8, hy);
      for (let x = -jr * 0.8; x <= jr * 0.8; x += 6) g.lineTo(x, hy + Math.sin(x / 9 + t / 260) * 2.6);
      g.lineTo(jr * 0.8, jr);
      g.lineTo(-jr * 0.8, jr);
      g.closePath();
      g.fill();
      g.restore();
      rrect(g, -jr * 0.5, -jr * 1.15, jr, jr * 0.34, jr * 0.14);
      g.fillStyle = '#c98b52';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = '#2a1636';
      g.stroke();
      g.restore();
      label(g, game.jar.x, game.jar.y + jr * 0.2, `%${Math.round(fillK * 100)}`, { size: jr * 0.46, color: '#fff', stroke: '#2a1636', sw: 0.3, font: '"Baloo 2", sans-serif' });

      // Toplanan harfler kavanoza akar
      game.pops = game.pops.filter((p) => {
        p.t += dt * 1.5;
        if (p.t >= 1) return false;
        const k = p.t * p.t * (3 - 2 * p.t);
        const x = lerp(p.x, game.jar.x, k);
        const y = lerp(p.y, game.jar.y, k) - Math.sin(p.t * Math.PI) * lay.s * 1.2;
        g.save();
        g.globalAlpha = 1 - p.t * 0.7;
        g.translate(x, y);
        label(g, 0, 0, trUpper(p.c), { size: lay.s * (0.9 - p.t * 0.45), color: '#fff', stroke: '#2a1636', font: '"Baloo 2", sans-serif' });
        g.restore();
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
        g.fillStyle = `rgba(255,255,255,${Math.max(0, game.flash) * 0.22})`;
        g.fillRect(0, 0, W, H);
      }

      // Bal taşıyan arılar
      game.bees = game.bees.filter((b) => {
        b.t += dt * 0.55;
        if (b.t >= 1) return false;
        const x = lerp(b.x, game.jar.x, b.t);
        const y = lerp(b.y, game.jar.y - game.jar.r, b.t) + Math.sin(t / 160 + b.w) * 12;
        bee(g, x, y, lay.s * 0.3, t);
        return true;
      });

      fx.draw(g, game.paused ? 0 : dt);
      return undefined;
    });
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
