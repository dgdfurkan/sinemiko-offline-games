// Gen Makası: laboratuvar bulmacası. DNA şeridindeki bazları çevirip hedef proteini yazdırmaya çalışırsın.
// Üç baz bir kodon, her kodon bir aminoasit. Makas yalnız açık bölgede çalışır, kilitli bazlara dokunamazsın.
// Bazı şeritlerde fazladan ya da eksik baz vardır: okuma çerçevesi kayar, önce onu düzeltmen gerekir.

import { Life, html, toHTML, fitCanvas, clamp, seeded } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, label, shake, pop, popIn } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';

const BASE_C = { A: '#39d98a', T: '#ff5f72', G: '#ffcd3c', C: '#4fb6ff' };
const COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };
const NEXT = { A: 'T', T: 'G', G: 'C', C: 'A' };
const ORDER = 'TCAG';
const CODE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
const AA3 = { F: 'Fen', L: 'Lös', S: 'Ser', Y: 'Tir', C: 'Sis', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'İle', M: 'Met', T: 'Tre', N: 'Asn', K: 'Liz', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gli', '*': 'DUR' };
const AA_C = { A: '#ffb45e', V: '#ffb45e', L: '#ffb45e', I: '#ffb45e', M: '#ffb45e', F: '#ffb45e', W: '#ffb45e', P: '#ffb45e', G: '#9fe86b', S: '#7fe7c4', T: '#7fe7c4', C: '#7fe7c4', Y: '#7fe7c4', N: '#7fe7c4', Q: '#7fe7c4', K: '#6fb8ff', R: '#6fb8ff', H: '#6fb8ff', D: '#ff7a9c', E: '#ff7a9c', '*': '#8a7fa8' };
const POOL = 'AGSTVLIPFYHKRDENQM'.split('');

const CODONS = {};
for (let i = 0; i < 64; i++) {
  const c = ORDER[(i >> 4) & 3] + ORDER[(i >> 2) & 3] + ORDER[i & 3];
  const aa = CODE[i];
  (CODONS[aa] = CODONS[aa] || []).push(c);
}
const aaOf = (c) => CODE[ORDER.indexOf(c[0]) * 16 + ORDER.indexOf(c[1]) * 4 + ORDER.indexOf(c[2])] || '?';
const translate = (arr) => {
  let out = '';
  for (let i = 0; i + 2 < arr.length; i += 3) out += aaOf(arr[i] + arr[i + 1] + arr[i + 2]);
  return out;
};
// Kilitli bazlara dokunulamaz: o kodonu hedefe çevirmenin en ucuz yolu kaç değişiklik?
function codonCost(arr, i, aa, locked) {
  let best = Infinity;
  for (const c of CODONS[aa] || []) {
    let d = 0;
    let ok = true;
    for (let k = 0; k < 3; k++) {
      if (arr[i + k] === c[k]) continue;
      if (locked[i + k]) { ok = false; break; }
      d++;
    }
    if (ok && d < best) best = d;
  }
  return best;
}
function bestCodon(arr, i, aa, locked) {
  let best = null;
  let bd = Infinity;
  for (const c of CODONS[aa] || []) {
    let d = 0;
    let ok = true;
    for (let k = 0; k < 3; k++) {
      if (arr[i + k] === c[k]) continue;
      if (locked[i + k]) { ok = false; break; }
      d++;
    }
    if (ok && d < bd) { bd = d; best = c; }
  }
  return best ? { codon: best, dist: bd } : null;
}
function costAll(arr, target, locked) {
  if (arr.length !== target.length * 3) return Infinity;
  let s = 0;
  for (let i = 0; i < target.length; i++) {
    const d = codonCost(arr, i * 3, target[i], locked);
    if (d === Infinity) return Infinity;
    s += d;
  }
  return s;
}

const WORDS = { 6: 'SİNEM', 13: 'KEDİ', 20: 'SEVGİ', 27: 'KALP', 34: 'LİMAN' };
const TR = { 'İ': 'I' };
const letters = (w) => [...w].map((c) => TR[c] || c);
const LEVELS = 40;

// Şerit kurulumu: önce çözüm yazılır, sonra açık bölgede bozulur
function makeLevel(li) {
  const rng = seeded(7001 + li * 131);
  const word = WORDS[li] || null;
  const target = word ? letters(word) : Array.from({ length: clamp(3 + Math.floor(li / 5), 3, 7) }, () => rng.pick(POOL));
  const arr = [];
  for (const aa of target) arr.push(...rng.pick(CODONS[aa]));
  const n = arr.length;
  const locked = new Array(n).fill(false);
  let a = 0;
  let b = n;
  if (li >= 5) {
    const w = clamp(6 + Math.floor(li / 7) * 3, 6, n);
    a = rng.int(0, n - w);
    b = a + w;
    for (let i = 0; i < n; i++) locked[i] = i < a || i >= b;
  }
  const kind = li >= 11 && li % 6 === 5 ? 'ins' : li >= 14 && li % 6 === 2 ? 'del' : 'edit';
  const muts = clamp(1 + Math.floor(li / 6), 1, 4);
  const spots = rng.shuffle(Array.from({ length: b - a }, (_, k) => a + k)).slice(0, muts);
  for (const i of spots) {
    let c = arr[i];
    const times = rng.int(1, 3);
    for (let k = 0; k < times; k++) c = NEXT[c];
    arr[i] = c;
  }
  let par = costAll(arr, target, locked);
  if (kind === 'ins') {
    const at = rng.int(a + 1, b - 1);
    arr.splice(at, 0, rng.pick(['A', 'T', 'G', 'C']));
    locked.splice(at, 0, false);
    par += 2;
  } else if (kind === 'del') {
    const at = rng.int(a + 1, b - 2);
    arr.splice(at, 1);
    locked.splice(at, 1);
    par += 2;
  }
  return { target, bases: arr, locked, kind, par: Math.max(1, par), win: [a, b] };
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], solved: 0, edits: 0 });
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
      art: ART.gen,
      sub: 'Üç baz bir kodon, her kodon bir aminoasit. Şeridi düzelt, hedef protein çıksın.',
      stats: [['Çözülen Gen', data.solved], ['Toplam Düzenleme', data.edits]],
      how: [
        'Üstteki şerit DNA. Bir baza dokununca A, T, G, C sırasıyla döner. Alt iplik kendiliğinden eşleşir.',
        'Her üç baz bir kodondur ve bir aminoasit yazar. Aşağıdaki zincir hedefle aynı olunca gen tamamlanır.',
        'Gri bazlar kilitli, makas oraya ulaşmıyor. Yalnız açık bölgede çalışabilirsin.',
        'Şerit kısa ya da uzunsa okuma çerçevesi kaymıştır: Kes ile fazlalığı al, Ekle ile boşluğu doldur.',
        'Ne kadar az dokunuşla bitirirsen o kadar çok yıldız. Sıkışırsan Makas Yardımı bir kodonu düzeltir.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Genler', onPick: (i) => play(i) },
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const lv = makeLevel(li);
    const fx = makeFx();
    const game = {
      target: lv.target, locked: lv.locked.slice(), bases: lv.bases.slice(), kind: lv.kind, par: lv.par,
      edits: 0, tool: null, done: false, paused: false, sel: -1, pulse: 0,
      tools: { cut: lv.kind === 'ins' ? 2 : 1, add: lv.kind === 'del' ? 2 : 1 },
    };
    st = game;

    f.setTitle(`Gen ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="gn">
        <canvas class="gn-cv"></canvas>
        <div class="gn-prot">
          <div class="gn-plabel">Hedef Protein</div>
          <div class="gn-row" data-target></div>
          <div class="gn-plabel">Şeridin Yazdığı</div>
          <div class="gn-row gn-cur" data-cur></div>
        </div>
        <div class="gn-stripwrap"><div class="gn-strip" data-strip></div></div>
        <div class="gn-bar">
          <span class="gn-count"><b data-edits>0</b><small>dokunuş<br>hedef ${game.par}</small></span>
          <button class="gn-t" data-tool="cut"><svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2.200"/><circle cx="18" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="2.200"/><path d="M8 16 19 4M16 16 5 4" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round"/></svg>Kes<b data-n="cut">${game.tools.cut}</b></button>
          <button class="gn-t" data-tool="add"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round"/></svg>Ekle<b data-n="add">${game.tools.add}</b></button>
          <button class="gn-t gn-hint" data-hint>${icon('hint')}Yardım</button>
        </div>
      </div>`);
    const wrap = f.main.querySelector('.gn');
    const cv = wrap.querySelector('.gn-cv');
    const strip = wrap.querySelector('[data-strip]');
    const rowT = wrap.querySelector('[data-target]');
    const rowC = wrap.querySelector('[data-cur]');
    const editsEl = wrap.querySelector('[data-edits]');
    const stage = fitCanvas(cv, my);

    rowT.innerHTML = toHTML(html`${game.target.map((a) => html`<span class="aa" style="--c:${AA_C[a]}"><b>${a}</b><small>${AA3[a]}</small></span>`)}`);

    function syncTools() {
      for (const k of ['cut', 'add']) {
        const b = wrap.querySelector(`[data-tool="${k}"]`);
        b.querySelector('[data-n]').textContent = game.tools[k];
        b.classList.toggle('on', game.tool === k);
        b.disabled = !game.tools[k];
      }
    }

    function render() {
      const cur = translate(game.bases);
      const need = game.target.length * 3;
      const extra = game.bases.length - need;
      strip.innerHTML = toHTML(html`${Array.from({ length: Math.ceil(game.bases.length / 3) }, (_, c) => {
        const i0 = c * 3;
        const full = i0 + 2 < game.bases.length;
        const aa = full ? cur[c] : null;
        const want = game.target[c];
        const ok = full && aa === want;
        return html`<div class="gn-cod ${ok ? 'ok' : full && want ? 'bad' : 'part'}">
          <div class="gn-bs">${game.bases.slice(i0, i0 + 3).map((b, k) => html`<button class="gn-b ${game.locked[i0 + k] ? 'lk' : ''}" data-i="${i0 + k}" style="--c:${BASE_C[b]}">${b}<i>${COMP[b]}</i></button>`)}</div>
          <span class="gn-aa">${full ? (aa === '*' ? 'DUR' : AA3[aa]) : '?'}</span>
        </div>`;
      })}`);
      rowC.innerHTML = toHTML(html`${game.target.map((want, i) => {
        const a = cur[i];
        const has = i * 3 + 2 < game.bases.length;
        return html`<span class="aa ${!has ? 'empty' : a === want ? 'ok' : 'bad'}" style="--c:${has ? AA_C[a] || '#8a7fa8' : '#3a3560'}"><b>${has ? a : '-'}</b><small>${has ? AA3[a] || '?' : ''}</small></span>`;
      })}`);
      editsEl.textContent = game.edits;
      wrap.classList.toggle('frame', extra !== 0);
      syncTools();
      if (!game.done && extra === 0 && cur === game.target.join('')) win();
    }

    function bump(i) {
      const n = strip.querySelector(`[data-i="${i}"]`);
      if (n) pop(n.closest('.gn-cod'), 1.1);
    }

    function cycle(i) {
      if (game.done || game.locked[i]) {
        sfx.bad();
        buzz(20);
        shake(strip.querySelector(`[data-i="${i}"]`) || strip, 5);
        toast('Burası kilitli, makas ulaşmıyor.');
        return;
      }
      game.bases[i] = NEXT[game.bases[i]];
      game.edits++;
      data.edits++;
      game.sel = i;
      game.pulse = 1;
      sfx.tile();
      buzz(8);
      render();
      bump(i);
    }

    function useTool(i) {
      const k = game.tool;
      if (!game.tools[k]) return;
      if (game.locked[i]) {
        sfx.bad();
        toast('Kilitli bölgede makas çalışmaz.');
        return;
      }
      if (k === 'cut') {
        game.bases.splice(i, 1);
        game.locked.splice(i, 1);
        sfx.chop();
      } else {
        game.bases.splice(i, 0, 'A');
        game.locked.splice(i, 0, false);
        sfx.pop();
      }
      game.tools[k]--;
      game.edits++;
      data.edits++;
      game.tool = null;
      game.pulse = 1;
      buzz(16);
      render();
    }

    // Makas yardımı: çerçeve bozuksa önce onu, değilse en soldaki yanlış kodonu düzeltir
    function hint() {
      if (game.done) return;
      const need = game.target.length * 3;
      if (game.bases.length !== need) {
        const grow = game.bases.length < need;
        let best = null;
        for (let i = 0; i < game.bases.length + (grow ? 1 : 0); i++) {
          if (game.locked[Math.min(i, game.locked.length - 1)]) continue;
          const opts = grow ? ['A', 'T', 'G', 'C'] : [null];
          for (const b of opts) {
            const arr = game.bases.slice();
            const lk = game.locked.slice();
            if (grow) { arr.splice(i, 0, b); lk.splice(i, 0, false); } else { arr.splice(i, 1); lk.splice(i, 1); }
            const c = costAll(arr, game.target, lk);
            if (c < (best ? best.c : Infinity)) best = { c, arr, lk, i };
          }
        }
        if (!best) return;
        game.bases = best.arr;
        game.locked = best.lk;
        game.tools[grow ? 'add' : 'cut'] = Math.max(0, game.tools[grow ? 'add' : 'cut'] - 1);
        game.edits += 3;
        sfx.zap();
        game.sel = best.i;
        game.pulse = 1;
        render();
        toast(grow ? 'Eksik baz eklendi, çerçeve düzeldi.' : 'Fazla baz kesildi, çerçeve düzeldi.');
        return;
      }
      const cur = translate(game.bases);
      for (let c = 0; c < game.target.length; c++) {
        if (cur[c] === game.target[c]) continue;
        const b = bestCodon(game.bases, c * 3, game.target[c], game.locked);
        if (!b) continue;
        for (let k = 0; k < 3; k++) game.bases[c * 3 + k] = b.codon[k];
        game.edits += b.dist + 2;
        game.sel = c * 3;
        game.pulse = 1;
        sfx.zap();
        buzz(14);
        render();
        bump(c * 3);
        return;
      }
    }

    my.on(wrap, 'click', (e) => {
      if (game.paused) return;
      const b = e.target.closest('[data-i]');
      if (b) {
        const i = Number(b.dataset.i);
        if (game.tool) useTool(i); else cycle(i);
        return;
      }
      const t = e.target.closest('[data-tool]');
      if (t) {
        const k = t.dataset.tool;
        if (!game.tools[k]) return;
        game.tool = game.tool === k ? null : k;
        sfx.tap();
        toast(game.tool === 'cut' ? 'Kesmek istediğin baza dokun.' : game.tool === 'add' ? 'Yeni bazın gireceği yere dokun.' : 'Makas kapandı.');
        syncTools();
        return;
      }
      if (e.target.closest('[data-hint]')) {
        sfx.tap();
        hint();
      }
    });

    function win() {
      game.done = true;
      const stars = game.edits <= game.par ? 3 : game.edits <= game.par + 3 ? 2 : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      data.solved++;
      api.touch();
      const coins = 6 + stars * 6;
      api.finish({ coins });
      sfx.fanfare();
      tone({ type: 'triangle', f: 520, f2: 1040, dur: 0.5, vol: 0.08 });
      const { W, H } = stage;
      for (let k = 0; k < 4; k++) my.timeout(() => fx.burst(W * (0.2 + k * 0.2), H * 0.3, { n: 22, colors: ['#7fe7c4', '#ffcd3c', '#6fb8ff'], power: 320 }), k * 120);
      rowC.querySelectorAll('.aa').forEach((n, i) => popIn(n, i * 70));
      my.timeout(() => {
        resultSheet({
          won: true,
          title: 'Gen Tamam!',
          sub: `${game.target.map((a) => AA3[a]).join(' ')} zinciri katlandı.`,
          stars,
          coins,
          stats: [['Dokunuş', game.edits], ['En Az', game.par], ['Protein', game.target.join('')]],
          buttons: [
            ...(li + 1 < LEVELS ? [{ label: 'Sonraki Gen', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', icon: 'replay', act: () => play(li) },
            { label: 'Genler', icon: 'list', act: () => menu() },
          ],
        });
      }, 1100);
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

    // Dönen sarmal: şeritteki gerçek bazları taşır, seçilen baz parlar
    my.raf((dt, t) => {
      const { W, H, g } = stage;
      stage.begin();
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#120b35');
      bg.addColorStop(1, '#1d1150');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 0.5;
      for (let k = 0; k < 18; k++) {
        const x = ((k * 97 + t / 40) % (W + 40)) - 20;
        const y = (k * 53) % H;
        g.beginPath();
        g.arc(x, y, 1.6, 0, Math.PI * 2);
        g.fillStyle = '#7fe7c4';
        g.fill();
      }
      g.globalAlpha = 1;
      const n = game.bases.length;
      const cy = H * 0.5;
      const amp = H * 0.26;
      const step = Math.min(34, (W - 26) / Math.max(1, n - 1));
      const x0 = (W - step * Math.max(0, n - 1)) / 2;
      const ph = t / 620;
      if (game.pulse > 0) game.pulse = Math.max(0, game.pulse - dt * 1.6);
      // İki şeker fosfat omurgası: sarmalı birbirine bağlar
      for (const dir of [1, -1]) {
        g.beginPath();
        for (let i = 0; i < n; i++) {
          const x = x0 + i * step;
          const y = cy - dir * Math.sin(i * 0.56 + ph) * amp;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = dir > 0 ? 'rgba(190,175,255,.95)' : 'rgba(130,115,210,.75)';
        g.lineWidth = Math.max(3, Math.min(6, step * 0.3));
        g.lineJoin = 'round';
        g.stroke();
      }
      for (let i = 0; i < n; i++) {
        const x = x0 + i * step;
        const s = Math.sin(i * 0.56 + ph);
        const y1 = cy - s * amp;
        const y2 = cy + s * amp;
        const depth = 0.45 + 0.55 * (Math.cos(i * 0.56 + ph) * 0.5 + 0.5);
        const sel = i === game.sel;
        g.globalAlpha = depth * (game.locked[i] ? 0.4 : 1);
        g.lineWidth = Math.max(2, Math.min(13, step * 0.42) * depth);
        g.lineCap = 'round';
        const grd = g.createLinearGradient(x, y1, x, y2);
        grd.addColorStop(0, BASE_C[game.bases[i]]);
        grd.addColorStop(1, BASE_C[COMP[game.bases[i]]]);
        g.strokeStyle = grd;
        if (sel) {
          g.shadowColor = '#fff';
          g.shadowBlur = 14 + game.pulse * 18;
        }
        g.beginPath();
        g.moveTo(x, y1);
        g.lineTo(x, y2);
        g.stroke();
        g.shadowBlur = 0;
        g.globalAlpha = depth;
        for (const y of [y1, y2]) {
          g.beginPath();
          g.arc(x, y, Math.max(2.6, Math.min(9, step * 0.3)), 0, Math.PI * 2);
          g.fillStyle = y === y1 ? BASE_C[game.bases[i]] : BASE_C[COMP[game.bases[i]]];
          g.fill();
        }
      }
      g.globalAlpha = 1;
      if (n && step > 13) {
        for (let i = 0; i < n; i++) {
          const x = x0 + i * step;
          const s = Math.sin(i * 0.56 + ph);
          label(g, x, cy - s * amp + 4, game.bases[i], { size: Math.min(13, step * 0.6), color: '#15093a', stroke: 'rgba(0,0,0,0)', sw: 0, font: '800 "JetBrains Mono", monospace' });
        }
      }
      fx.draw(g, game.paused ? 0 : dt);
      return undefined;
    });

    render();
    strip.querySelectorAll('.gn-cod').forEach((n, i) => popIn(n, i * 60));
    if (game.kind !== 'edit') my.timeout(() => toast(game.kind === 'ins' ? 'Şeritte fazladan bir baz var: Kes.' : 'Şeritte bir baz eksik: Ekle.'), 700);
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
