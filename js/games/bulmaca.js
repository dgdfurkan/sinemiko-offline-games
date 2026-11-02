// Biyo Bulmaca: laboratuvar defterine çizilmiş kare bulmaca. Tanımı oku, harfleri kendi klavyenden yaz.
// Bulmaca her seferinde yeniden kurulur: kelimeler birbirine geçene kadar denenir.

import { Life, html, toHTML, clamp, trUpper, seeded, shuffle } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { shake, pop, popIn, confetti } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';

const LEVELS = 20;
const ALPHA = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');

// [kelime, tanım]
const BANK = [
  ['HÜCRE', 'Canlının en küçük yapı birimi'], ['MİTOZ', 'Vücut hücrelerinin bölünmesi'], ['MAYOZ', 'Üreme hücrelerini oluşturan bölünme'],
  ['RİBOZOM', 'Protein üreten organel'], ['LİZOZOM', 'Hücre içi sindirim organeli'], ['KOFUL', 'Hücrede depo görevli kesecik'],
  ['ÇEKİRDEK', 'Hücrenin yönetim merkezi'], ['SİTOPLAZMA', 'Hücre zarı ile çekirdek arası sıvı'], ['KLOROPLAST', 'Fotosentezin yapıldığı organel'],
  ['ENZİM', 'Tepkimeyi hızlandıran protein'], ['HORMON', 'Bezlerin kana saldığı haberci'], ['İNSÜLİN', 'Kan şekerini düşüren hormon'],
  ['GLUKAGON', 'Kan şekerini yükselten hormon'], ['ADRENALİN', 'Korkunca salgılanan hormon'], ['TİROKSİN', 'Tiroidin salgıladığı hormon'],
  ['MELATONİN', 'Uykuyu düzenleyen hormon'], ['GEN', 'Kalıtım biriminin adı'], ['KROMOZOM', 'Genlerin dizildiği yapı'],
  ['MUTASYON', 'Gen diziliminde değişiklik'], ['KODON', 'Üç bazlık şifre birimi'], ['ADENİN', 'DNA bazı, timinle eşleşir'],
  ['TİMİN', 'DNA bazı, adeninle eşleşir'], ['GUANİN', 'DNA bazı, sitozinle eşleşir'], ['SİTOZİN', 'DNA bazı, guaninle eşleşir'],
  ['URASİL', 'RNA bazı, timinin yerine geçer'], ['PROTEİN', 'Aminoasit zinciri'], ['ALYUVAR', 'Oksijen taşıyan kan hücresi'],
  ['AKYUVAR', 'Vücudu savunan kan hücresi'], ['PLAZMA', 'Kanın sıvı kısmı'], ['TROMBOSİT', 'Pıhtılaşmayı sağlayan hücre parçacığı'],
  ['HEMOGLOBİN', 'Alyuvardaki demirli protein'], ['ANTİKOR', 'Mikroba karşı üretilen savunma proteini'], ['ANTİJEN', 'Bağışıklığı uyandıran madde'],
  ['AŞI', 'Hastalığa karşı önceden bağışıklık'], ['VİRÜS', 'Konak hücresiz çoğalamayan etken'], ['BAKTERİ', 'Tek hücreli, çekirdeksiz canlı'],
  ['MANTAR', 'Küf ve mayanın ait olduğu âlem'], ['MAKROFAJ', 'Mikropları yutan büyük hücre'], ['LENFOSİT', 'Bağışıklıkta görevli akyuvar'],
  ['NEFRON', 'Böbreğin süzme birimi'], ['NÖRON', 'Sinir hücresi'], ['AKSON', 'Nöronun uzun uzantısı'],
  ['SİNAPS', 'İki nöron arasındaki bağlantı'], ['MİYELİN', 'Aksonu saran yalıtkan kılıf'], ['BEYİN', 'Düşünmenin merkezi'],
  ['OMURİLİK', 'Refleksin merkezi, sırtta uzanır'], ['KALP', 'Kanı pompalayan organ'], ['ATARDAMAR', 'Kanı kalpten götüren damar'],
  ['TOPLARDAMAR', 'Kanı kalbe getiren damar'], ['KILCAL', 'En ince damar çeşidi'], ['ALVEOL', 'Akciğerde gaz değişim kesesi'],
  ['DİYAFRAM', 'Soluk almayı sağlayan kas'], ['BRONŞ', 'Soluk borusunun akciğerdeki kolu'], ['MİDE', 'Proteinin sindirime başladığı organ'],
  ['KARACİĞER', 'Safra üreten büyük organ'], ['PANKREAS', 'İnsülin üreten bez'], ['BAĞIRSAK', 'Besin emiliminin yapıldığı organ'],
  ['BÖBREK', 'Kanı süzüp idrar yapan organ'], ['DALAK', 'Kan hücrelerini ayıklayan organ'], ['TİMÜS', 'T hücrelerinin olgunlaştığı organ'],
  ['SAFRA', 'Yağları parçalayan sarı salgı'], ['AMİLAZ', 'Nişastayı parçalayan enzim'], ['PEPSİN', 'Midedeki protein enzimi'],
  ['LİPAZ', 'Yağları parçalayan enzim'], ['GLİKOZ', 'Kandaki basit şeker'], ['NİŞASTA', 'Bitkilerin depo şekeri'],
  ['SELÜLOZ', 'Bitki hücre duvarının maddesi'], ['KİTİN', 'Mantar duvarının maddesi'], ['LAKTOZ', 'Süt şekeri'],
  ['KOLLAJEN', 'Vücutta en bol bulunan protein'], ['KERATİN', 'Saç ve tırnağın proteini'], ['AKTİN', 'Kas kasılmasında görevli protein'],
  ['MİYOZİN', 'Aktinle birlikte kası kasan protein'], ['ATP', 'Hücrenin enerji parası'], ['DNA', 'Kalıtım molekülü'],
  ['RNA', 'Tek zincirli kalıtım molekülü'], ['PLAZMİT', 'Bakterideki halkasal küçük DNA'], ['KLON', 'Genetik olarak birebir kopya'],
  ['DOKU', 'Aynı işi yapan hücre topluluğu'], ['ORGAN', 'Dokuların oluşturduğu yapı'], ['OSMOZ', 'Suyun zardan geçişi'],
  ['DİFÜZYON', 'Moleküllerin çoktan aza yayılması'], ['FOTOSENTEZ', 'Bitkinin ışıkla besin yapması'], ['SOLUNUM', 'Besinden enerji elde etme'],
  ['FERMANTASYON', 'Oksijensiz enerji yolu'], ['LAKTİK', 'Kasta biriken asidin adı'], ['PETRİ', 'Kültür yapılan yuvarlak kap'],
  ['MİKROSKOP', 'Küçük şeyleri büyüten alet'], ['OTOKLAV', 'Basınçlı buharla sterilize eden cihaz'], ['SANTRİFÜJ', 'Dönerek ayıran laboratuvar cihazı'],
  ['PİPET', 'Sıvı çeken ince laboratuvar aleti'], ['KÜLTÜR', 'Hücrelerin kapta üretilmesi'], ['STERİL', 'Mikropsuz hale getirilmiş'],
  ['TİTANYUM', 'İmplantlarda kullanılan metal'], ['PROTEZ', 'Eksik organın yapay karşılığı'], ['SENSÖR', 'Ölçüm yapan algılayıcı'],
  ['DİYALİZ', 'Böbrek yerine kanı temizleme'], ['İSKELE', 'Doku mühendisliğinde hücre taşıyıcı'], ['BİYOPSİ', 'Dokudan örnek alma işlemi'],
];

const sizeOf = (li) => clamp(7 + Math.floor(li / 4), 7, 11);
const countOf = (li) => clamp(5 + Math.floor(li / 2), 5, 12);

// Kelimeleri birbirine geçirerek yerleştir
function buildPuzzle(li) {
  const rng = seeded(321 + li * 97);
  const N = sizeOf(li);
  const want = countOf(li);
  const pool = shuffle(BANK.filter(([w]) => w.length <= N && w.length >= 3).slice(), () => rng()).slice(0, 60);
  for (let attempt = 0; attempt < 30; attempt++) {
    const grid = Array.from({ length: N }, () => Array(N).fill(null));
    const placed = [];
    const fits = (w, r, c, dir) => {
      const dr = dir === 'd' ? 1 : 0;
      const dc = dir === 'a' ? 1 : 0;
      if (r < 0 || c < 0 || r + dr * (w.length - 1) >= N || c + dc * (w.length - 1) >= N) return -1;
      let cross = 0;
      // Başı ve sonu boş kalmalı
      const br = r - dr;
      const bc = c - dc;
      if (br >= 0 && bc >= 0 && grid[br][bc]) return -1;
      const ar = r + dr * w.length;
      const ac = c + dc * w.length;
      if (ar < N && ac < N && grid[ar][ac]) return -1;
      for (let i = 0; i < w.length; i++) {
        const rr = r + dr * i;
        const cc = c + dc * i;
        const cur = grid[rr][cc];
        if (cur) {
          if (cur !== w[i]) return -1;
          cross++;
        } else {
          // Yan komşular dolu olamaz, yoksa iki kelime yan yana yapışır
          const sr = dir === 'a' ? 1 : 0;
          const sc = dir === 'a' ? 0 : 1;
          if (rr - sr >= 0 && cc - sc >= 0 && grid[rr - sr][cc - sc]) return -1;
          if (rr + sr < N && cc + sc < N && grid[rr + sr][cc + sc]) return -1;
        }
      }
      return cross;
    };
    const put = (w, clue, r, c, dir) => {
      const dr = dir === 'd' ? 1 : 0;
      const dc = dir === 'a' ? 1 : 0;
      for (let i = 0; i < w.length; i++) grid[r + dr * i][c + dc * i] = w[i];
      placed.push({ w, clue, r, c, dir });
    };
    const first = pool[attempt % pool.length];
    const fw = first[0];
    put(fw, first[1], Math.floor(N / 2), Math.max(0, Math.floor((N - fw.length) / 2)), 'a');
    for (const [w, clue] of pool) {
      if (placed.length >= want) break;
      if (placed.some((p) => p.w === w)) continue;
      let best = null;
      for (const p of placed) {
        for (let i = 0; i < p.w.length; i++) {
          for (let j = 0; j < w.length; j++) {
            if (p.w[i] !== w[j]) continue;
            const dir = p.dir === 'a' ? 'd' : 'a';
            const r = p.dir === 'a' ? p.r - j : p.r + i;
            const c = p.dir === 'a' ? p.c + i : p.c - j;
            const cross = fits(w, r, c, dir);
            if (cross > 0 && (!best || cross > best.cross)) best = { r, c, dir, cross };
          }
        }
      }
      if (best) put(w, clue, best.r, best.c, best.dir);
    }
    if (placed.length >= Math.max(4, want - 2)) {
      // Satır ve sütunları kırp
      let minR = N;
      let maxR = -1;
      let minC = N;
      let maxC = -1;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c]) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
      const words = placed.map((p) => ({ ...p, r: p.r - minR, c: p.c - minC }));
      const rows = maxR - minR + 1;
      const cols = maxC - minC + 1;
      // Numaralandırma: yukarıdan aşağı, soldan sağa
      const starts = new Map();
      words.sort((a, b) => (a.r - b.r) || (a.c - b.c));
      let num = 0;
      for (const w of words) {
        const k = `${w.r},${w.c}`;
        if (!starts.has(k)) starts.set(k, ++num);
        w.no = starts.get(k);
      }
      return { rows, cols, words };
    }
  }
  return null;
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], solved: 0, letters: 0 });
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
      art: ART.bulmaca,
      sub: 'Laboratuvar defterindeki kare bulmaca. Tanımı oku, harfi yaz.',
      stats: [['Çözülen Bulmaca', data.solved], ['Yazılan Harf', data.letters]],
      how: [
        'Bir kareye dokun: o kelimenin tanımı üstte belirir. Aynı kareye tekrar dokunursan yön değişir.',
        'Alttaki klavyeden harfi yaz, imleç kendiliğinden ilerler.',
        'Kelime doğru tamamlanınca kareler yeşile döner.',
        'Takıldığın yerde İpucu bir harf açar, ama yıldızdan götürür.',
        'Bütün kelimeleri ipucusuz bitir, üç yıldız senin.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Sayfalar', onPick: (i) => play(i) },
    });
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const puz = buildPuzzle(li);
    if (!puz) {
      toast('Bu sayfa kurulamadı, başka sayfayı dene.');
      menu();
      return;
    }
    const cells = new Map();
    for (const w of puz.words) {
      for (let i = 0; i < w.w.length; i++) {
        const r = w.r + (w.dir === 'd' ? i : 0);
        const c = w.c + (w.dir === 'a' ? i : 0);
        const k = `${r},${c}`;
        const cell = cells.get(k) || { r, c, sol: w.w[i], val: '', words: [], no: null };
        cell.words.push(w);
        if (i === 0) cell.no = w.no;
        cells.set(k, cell);
      }
    }
    const game = { cur: puz.words[0], idx: 0, hints: 0, done: false, paused: false, solvedWords: new Set(), filled: 0 };
    st = game;
    const total = [...cells.values()].length;

    f.setTitle(`Sayfa ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="bm">
        <div class="bm-clue"><span class="bm-no" data-no>1</span><p data-clue></p></div>
        <div class="bm-gridwrap"><div class="bm-grid" data-grid style="--n:${puz.cols};--rows:${puz.rows}"></div></div>
        <div class="bm-bar">
          <span class="bm-prog"><b data-left>${total}</b> harf kaldı</span>
          <button class="bm-b" data-act="dir">${icon('replay')}Yön</button>
          <button class="bm-b" data-act="hint">${icon('hint')}İpucu</button>
        </div>
        <div class="bm-kb" data-kb>
          ${ALPHA.map((a) => html`<button class="bm-k" data-k="${a}">${a}</button>`)}
          <button class="bm-k wide" data-k="del">${icon('back')}</button>
        </div>
      </div>`);
    const wrap = f.main.querySelector('.bm');
    const gridEl = wrap.querySelector('[data-grid]');
    const clueEl = wrap.querySelector('[data-clue]');
    const noEl = wrap.querySelector('[data-no]');
    const leftEl = wrap.querySelector('[data-left]');

    gridEl.innerHTML = toHTML(html`${Array.from({ length: puz.rows }, (_, r) => Array.from({ length: puz.cols }, (_, c) => {
      const cell = cells.get(`${r},${c}`);
      return cell
        ? html`<button class="bm-c" data-rc="${r},${c}">${cell.no ? html`<i>${cell.no}</i>` : ''}<b></b></button>`
        : html`<span class="bm-x"></span>`;
    }))}`);

    const cellEl = (r, c) => gridEl.querySelector(`[data-rc="${r},${c}"]`);
    const wordCells = (w) => Array.from({ length: w.w.length }, (_, i) => cells.get(`${w.r + (w.dir === 'd' ? i : 0)},${w.c + (w.dir === 'a' ? i : 0)}`));

    function paint() {
      for (const cell of cells.values()) {
        const el = cellEl(cell.r, cell.c);
        el.querySelector('b').textContent = cell.val;
        el.classList.toggle('on', game.cur && wordCells(game.cur).includes(cell));
        el.classList.toggle('cursor', game.cur && wordCells(game.cur)[game.idx] === cell);
        el.classList.toggle('ok', cell.words.some((w) => game.solvedWords.has(w)));
      }
      noEl.textContent = game.cur ? game.cur.no : '';
      clueEl.textContent = game.cur ? `${game.cur.dir === 'a' ? 'Soldan sağa' : 'Yukarıdan aşağı'}: ${game.cur.clue}` : '';
      const left = [...cells.values()].filter((q) => !q.val).length;
      leftEl.textContent = left;
    }

    function checkWord(w) {
      const cs = wordCells(w);
      if (cs.every((q) => q.val === q.sol)) {
        if (!game.solvedWords.has(w)) {
          game.solvedWords.add(w);
          sfx.good();
          buzz(16);
          cs.forEach((q, i) => {
            const el = cellEl(q.r, q.c);
            setTimeout(() => pop(el, 1.2), i * 50);
          });
          tone({ type: 'triangle', f: 520, f2: 1040, dur: 0.22, vol: 0.07 });
        }
        return true;
      }
      return false;
    }

    function type(letter) {
      if (!game.cur || game.done) return;
      const cs = wordCells(game.cur);
      const cell = cs[game.idx];
      if (!cell) return;
      if (cell.val !== letter) data.letters++;
      cell.val = letter;
      game.idx = Math.min(cs.length - 1, game.idx + 1);
      sfx.tile();
      buzz(5);
      for (const w of cell.words) checkWord(w);
      paint();
      if ([...cells.values()].every((q) => q.val === q.sol)) win();
      else if (cs.every((q) => q.val) && game.solvedWords.has(game.cur)) {
        // Kelime bitti: sıradaki boş kelimeye geç
        const next = puz.words.find((w) => !game.solvedWords.has(w));
        if (next) {
          game.cur = next;
          game.idx = wordCells(next).findIndex((q) => !q.val);
          if (game.idx < 0) game.idx = 0;
          paint();
        }
      }
    }

    function del() {
      if (!game.cur) return;
      const cs = wordCells(game.cur);
      if (cs[game.idx] && cs[game.idx].val && !game.solvedWords.has(game.cur)) cs[game.idx].val = '';
      else {
        game.idx = Math.max(0, game.idx - 1);
        if (cs[game.idx] && !game.solvedWords.has(game.cur)) cs[game.idx].val = '';
      }
      sfx.soft();
      paint();
    }

    function hint() {
      if (!game.cur || game.done) return;
      const cs = wordCells(game.cur);
      const i = cs.findIndex((q) => q.val !== q.sol);
      if (i < 0) { toast('Bu kelime zaten doğru.'); return; }
      cs[i].val = cs[i].sol;
      game.hints++;
      game.idx = Math.min(cs.length - 1, i + 1);
      sfx.zap();
      for (const w of cs[i].words) checkWord(w);
      paint();
      if ([...cells.values()].every((q) => q.val === q.sol)) win();
    }

    function win() {
      if (game.done) return;
      game.done = true;
      data.solved++;
      const stars = game.hints === 0 ? 3 : game.hints <= 2 ? 2 : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = 8 + stars * 6;
      api.finish({ coins });
      confetti();
      sfx.fanfare();
      my.timeout(() => {
        resultSheet({
          won: true,
          title: 'Sayfa Tamam!',
          sub: stars === 3 ? 'Tek ipucu bile almadın.' : 'Bitti. İpucusuz bitirirsen üç yıldız.',
          stars,
          coins,
          stats: [['Kelime', puz.words.length], ['İpucu', game.hints], ['Kare', total]],
          buttons: [
            ...(li + 1 < LEVELS ? [{ label: 'Sonraki Sayfa', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', icon: 'replay', act: () => play(li) },
            { label: 'Sayfalar', icon: 'list', act: () => menu() },
          ],
        });
      }, 800);
    }

    my.on(wrap, 'click', (e) => {
      const c = e.target.closest('[data-rc]');
      if (c) {
        const [r, cc] = c.dataset.rc.split(',').map(Number);
        const cell = cells.get(`${r},${cc}`);
        if (game.cur && wordCells(game.cur).includes(cell) && cell.words.length > 1) {
          game.cur = cell.words.find((w) => w !== game.cur) || game.cur;
        } else game.cur = cell.words[0];
        game.idx = wordCells(game.cur).indexOf(cell);
        sfx.tap();
        paint();
        return;
      }
      const k = e.target.closest('[data-k]');
      if (k) {
        if (k.dataset.k === 'del') del(); else type(k.dataset.k);
        return;
      }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      sfx.tap();
      if (a.dataset.act === 'hint') hint();
      else if (game.cur) {
        const cell = wordCells(game.cur)[game.idx];
        const other = cell.words.find((w) => w !== game.cur);
        if (other) {
          game.cur = other;
          game.idx = wordCells(other).indexOf(cell);
          paint();
        } else toast('Bu karede tek kelime var.');
      }
    });
    my.on(window, 'keydown', (e) => {
      if (game.paused || game.done) return;
      if (e.key === 'Backspace') { del(); return; }
      const up = trUpper(e.key);
      if (ALPHA.includes(up)) type(up);
    });

    f.onBack = () => {
      if (game.done) { menu(); return; }
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => play(li), onQuit: () => menu() });
    };

    paint();
    gridEl.querySelectorAll('.bm-c').forEach((n, i) => popIn(n, Math.min(i, 30) * 12));
    game.type = type;
    game.solveAll = () => {
      for (const cell of cells.values()) cell.val = cell.sol;
      for (const w of puz.words) checkWord(w);
      paint();
      win();
    };
    game.puz = puz;
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
