// Beden Fethi: vücut bir harita, organlar toprak. Doğru bilen organı alır, üsse üç kez vuran rakibi silip süpürür.
// Haritada canlı bir anatomi hologramı var: kalp atar, kan akar, tarama çizgisi geçer, EKG süre azaldıkça hızlanır.

import { Life, html, toHTML, raw, fitCanvas, clamp, lerp, rand, pick, shuffle } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, rrect, label, shake, popIn } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, icon } from '../core/ui.js';
import { blob } from '../core/avatar.js';
import { ART } from '../art.js';
import { Q, NUM } from '../data/questions.js';

const TEAM = {
  me: { name: 'Bağışıklık', c: '#2ee6c8', d: '#0b8f83' },
  v: { name: 'Virüs', c: '#ff5468', d: '#b81c3a' },
  b: { name: 'Bakteri', c: '#b58aff', d: '#6a3fd0' },
};

// Harita 400x640 birimlik. Sağ/sol hastanın sağı solu: ekranda solda duran karaciğer doğru yerde
const ORGANS = [
  { id: 'beyin', name: 'Beyin', x: 200, y: 50, to: ['tiroid'], p: 'M160 58C152 30 180 12 200 14C226 10 250 30 242 58C246 74 226 86 210 82C204 90 192 90 188 82C172 88 154 76 160 58Z', det: 'M200 18C196 34 206 42 200 60M176 34C186 38 188 48 182 56M224 34C214 38 212 48 218 56M172 66C182 62 188 66 192 72M228 66C218 62 212 66 208 72' },
  { id: 'tiroid', name: 'Tiroid', x: 200, y: 118, to: ['beyin', 'sagakc', 'solakc', 'kalp'], p: 'M200 112C190 102 176 106 176 118C176 130 192 130 200 122C208 130 224 130 224 118C224 106 210 102 200 112Z', det: '' },
  { id: 'sagakc', name: 'Sağ Akciğer', x: 142, y: 200, to: ['tiroid', 'kalp', 'karaciger', 'kolsag'], p: 'M176 140C150 136 116 166 110 222C108 246 136 252 160 244C172 240 176 230 176 212Z', det: 'M172 170C156 178 142 190 132 212M156 184C154 198 158 210 162 222M142 198C136 206 134 216 134 226' },
  { id: 'solakc', name: 'Sol Akciğer', x: 262, y: 200, to: ['tiroid', 'kalp', 'mide', 'kolsol'], p: 'M224 140C250 136 284 166 290 222C292 246 264 252 240 244C232 240 230 226 232 212Z', det: 'M230 170C246 178 260 190 270 212M248 186C250 198 248 210 244 222M260 198C266 206 268 216 268 226' },
  { id: 'kalp', name: 'Kalp', x: 204, y: 206, to: ['tiroid', 'sagakc', 'solakc', 'karaciger', 'mide'], p: 'M204 190C196 174 176 180 178 200C180 218 198 230 208 238C218 228 232 214 232 198C232 180 212 176 204 190Z', det: 'M204 190C206 202 200 212 208 228', pulse: true },
  { id: 'karaciger', name: 'Karaciğer', x: 158, y: 274, to: ['sagakc', 'kalp', 'pankreas', 'bobreksag', 'kolsag'], p: 'M112 262C140 244 206 246 210 260C214 276 188 292 166 300C146 308 110 300 110 280C110 272 110 268 112 262Z', det: 'M176 252C170 268 172 282 164 298' },
  { id: 'mide', name: 'Mide', x: 256, y: 284, to: ['solakc', 'kalp', 'pankreas', 'bobreksol', 'kolsol'], p: 'M232 254C248 246 284 258 286 282C288 308 258 322 234 314C220 310 222 296 234 292C246 288 242 276 232 270C226 266 226 258 232 254Z', det: 'M250 262C262 272 268 284 262 302M240 300C250 300 256 296 258 288' },
  { id: 'pankreas', name: 'Pankreas', x: 206, y: 328, to: ['karaciger', 'mide', 'bagirsak', 'bobreksag', 'bobreksol'], p: 'M168 322C180 312 216 314 240 318C254 322 254 332 240 332C216 334 200 336 184 342C166 346 158 332 168 322Z', det: 'M176 330C196 324 220 324 240 325' },
  { id: 'bobreksag', name: 'Sağ Böbrek', x: 132, y: 352, to: ['karaciger', 'pankreas', 'bagirsak', 'bacaksag'], p: 'M132 326C118 328 112 348 118 366C124 380 142 380 146 368C148 360 140 354 142 346C146 338 146 324 132 326Z', det: 'M128 340C124 350 126 360 132 368' },
  { id: 'bobreksol', name: 'Sol Böbrek', x: 268, y: 352, to: ['mide', 'pankreas', 'bagirsak', 'bacaksol'], p: 'M268 326C282 328 288 348 282 366C276 380 258 380 254 368C252 360 260 354 258 346C254 338 254 324 268 326Z', det: 'M272 340C276 350 274 360 268 368' },
  { id: 'bagirsak', name: 'Bağırsak', x: 200, y: 396, to: ['pankreas', 'bobreksag', 'bobreksol', 'mesane'], p: 'M158 354C180 344 220 344 242 354C254 372 254 420 240 438C222 450 178 450 160 438C146 420 146 372 158 354Z', det: 'M166 366C186 360 214 360 234 366C240 376 226 382 206 380C186 378 164 380 170 392C176 402 210 396 228 398C242 402 236 414 220 412C200 410 176 408 170 420C172 432 206 434 226 430' },
  { id: 'mesane', name: 'Mesane', x: 200, y: 464, to: ['bagirsak', 'bacaksag', 'bacaksol'], p: 'M200 442C186 442 178 452 180 464C182 476 192 486 200 486C208 486 218 476 220 464C222 452 214 442 200 442Z', det: 'M190 456C194 452 200 450 206 452' },
  { id: 'kolsag', name: 'Sağ Kol', x: 72, y: 290, to: ['sagakc', 'karaciger'], p: 'M96 170C84 190 76 240 64 296C58 326 48 360 40 392C38 410 30 420 32 430C36 440 44 436 48 426C58 398 72 358 84 318C92 290 100 240 102 200C104 180 102 166 96 170Z', det: 'M76 290C78 300 74 312 72 318' },
  { id: 'kolsol', name: 'Sol Kol', x: 328, y: 290, to: ['solakc', 'mide'], p: 'M304 170C316 190 324 240 336 296C342 326 352 360 360 392C362 410 370 420 368 430C364 440 356 436 352 426C342 398 328 358 316 318C308 290 300 240 298 200C296 180 298 166 304 170Z', det: 'M324 290C322 300 326 312 328 318' },
  { id: 'bacaksag', name: 'Sağ Bacak', x: 150, y: 560, to: ['mesane', 'bacaksol', 'bobreksag'], p: 'M112 470C114 510 114 540 118 570C120 590 122 606 122 612C122 626 140 630 162 627C172 626 176 620 174 606C174 570 180 530 188 504C176 480 132 462 112 470Z', det: 'M146 520C150 540 148 560 146 576' },
  { id: 'bacaksol', name: 'Sol Bacak', x: 250, y: 560, to: ['mesane', 'bacaksag', 'bobreksol'], p: 'M288 470C286 510 286 540 282 570C280 590 278 606 278 612C278 626 260 630 238 627C228 626 224 620 226 606C226 570 220 530 212 504C224 480 268 462 288 470Z', det: 'M254 520C250 540 252 560 254 576' },
];
const BY = Object.fromEntries(ORGANS.map((o) => [o.id, o]));
const BODY = new Path2D('M200 4C170 4 154 28 154 58C154 82 166 100 180 108L180 126C150 134 108 138 92 164C78 186 70 240 58 296C52 326 42 360 34 392C30 408 22 420 26 432C30 444 46 440 52 428C62 400 76 360 88 320C96 290 102 250 106 226C108 280 110 330 106 380C104 420 104 470 112 530C116 570 118 600 118 612C118 630 140 636 164 632C176 630 180 622 178 606C178 570 186 530 192 500L200 490L208 500C214 530 222 570 222 606C220 622 224 630 236 632C260 636 282 630 282 612C282 600 284 570 288 530C296 470 296 420 294 380C290 330 292 280 294 226C298 250 304 290 312 320C324 360 338 400 348 428C354 440 370 444 374 432C378 420 370 408 366 392C358 360 348 326 342 296C330 240 322 186 308 164C292 138 250 134 220 126L220 108C234 100 246 82 246 58C246 28 230 4 200 4Z');
const VEINS = [
  ['M204 236C204 300 190 340 196 490C186 530 160 570 150 610', '#ff7a8c'],
  ['M204 236C208 300 214 340 204 490C214 530 240 570 250 610', '#ff7a8c'],
  ['M196 160C150 150 110 170 96 210C84 260 68 330 44 410', '#6fb8ff'],
  ['M204 160C250 150 290 170 304 210C316 260 332 330 356 410', '#6fb8ff'],
  ['M200 180L200 110L200 70', '#ff7a8c'],
];
for (const o of ORGANS) o.path = new Path2D(o.p);
for (const o of ORGANS) o.detail = o.det ? new Path2D(o.det) : null;
const VEIN_PATHS = VEINS.map(([d, c]) => ({ path: new Path2D(d), c }));

const CASES = [
  ['Soğuk Algınlığı', 'v'], ['Bademcik İltihabı', 'b'], ['Grip', 'v'], ['Boğmaca', 'b'],
  ['Grip ve Zatürre', 'vb'], ['Su Çiçeği', 'v'], ['Verem', 'b'], ['Kızamık ve Orta Kulak', 'vb'],
  ['Kabakulak', 'v'], ['Kolera', 'b'], ['Hepatit ve Tifo', 'vb'], ['Kuduz', 'v'],
  ['Tetanoz', 'b'], ['Menenjit', 'vb'], ['Difteri', 'b'], ['Çocuk Felci', 'v'],
  ['Şarbon', 'b'], ['Karma Enfeksiyon', 'vb'], ['Çiçek Hastalığı', 'v'], ['Veba', 'b'],
  ['Yoğun Bakım', 'vb'], ['Çoklu Direnç', 'vb'], ['Büyük Salgın', 'vb'], ['Son Vaka', 'vb'],
];
const caseCfg = (i) => ({
  name: CASES[i][0],
  foes: CASES[i][1].split(''),
  acc: Math.min(0.86, 0.36 + i * 0.024),
  rounds: 7 + Math.floor(i / 6),
  time: Math.max(10, 14 - Math.floor(i / 8)),
});
const HOMES = { me: 'kalp', v: 'beyin', b: 'mesane' };
const HOMES_SOLO = { v: 'beyin', b: 'mesane' };

const virusSVG = () => raw('<svg class="ft-ic" viewBox="0 0 48 48"><g stroke="#2a1636" stroke-width="3" stroke-linecap="round"><path d="M24 3v8M24 37v8M3 24h8M37 24h8M9 9l6 6M33 33l6 6M9 39l6-6M33 15l6-6"/></g><circle cx="24" cy="24" r="14" fill="#ff5468" stroke="#2a1636" stroke-width="3"/><path d="M15 19l6 3M33 19l-6 3" stroke="#2a1636" stroke-width="3" stroke-linecap="round"/><circle cx="19" cy="25" r="2.400" fill="#2a1636"/><circle cx="29" cy="25" r="2.400" fill="#2a1636"/><path d="M19 32q5-4 10 0" fill="none" stroke="#2a1636" stroke-width="2.600" stroke-linecap="round"/></svg>');
const bacteriaSVG = () => raw('<svg class="ft-ic" viewBox="0 0 48 48"><path d="M38 14q6-6 4-11M41 24q6 0 6-6M10 36q-6 6-4 10" fill="none" stroke="#2a1636" stroke-width="3" stroke-linecap="round"/><rect x="5" y="13" width="38" height="22" rx="11" fill="#b58aff" stroke="#2a1636" stroke-width="3" transform="rotate(-22 24 24)"/><circle cx="18" cy="25" r="2.600" fill="#2a1636"/><circle cx="29" cy="21" r="2.600" fill="#2a1636"/><path d="M21 31q6-1 8-5" fill="none" stroke="#2a1636" stroke-width="2.600" stroke-linecap="round"/></svg>');
const teamIcon = (t) => (t === 'me' ? blob(1, { mood: 'happy', hands: false, cls: 'ft-ic' }) : t === 'v' ? virusSVG() : bacteriaSVG());

// Haritadaki minik birlikler
function drawCell(g, team, x, y, s, t, seed = 0) {
  g.save();
  g.translate(x, y);
  const wob = Math.sin(t / 240 + seed);
  if (team === 'me') {
    g.scale(1 + wob * 0.07, 1 - wob * 0.07);
    g.beginPath();
    g.arc(0, 0, s, 0, Math.PI * 2);
    g.fillStyle = '#eafffb';
    g.fill();
    g.lineWidth = s * 0.26;
    g.strokeStyle = '#0b5f5a';
    g.stroke();
    g.fillStyle = '#0b5f5a';
    g.beginPath();
    g.arc(-s * 0.36, -s * 0.1, s * 0.15, 0, Math.PI * 2);
    g.arc(s * 0.36, -s * 0.1, s * 0.15, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(0, s * 0.14, s * 0.32, 0.1, Math.PI - 0.1);
    g.lineWidth = s * 0.14;
    g.stroke();
  } else if (team === 'v') {
    g.rotate(t / 700 + seed);
    g.strokeStyle = '#2a1636';
    g.lineWidth = s * 0.26;
    g.lineCap = 'round';
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.moveTo(Math.cos(a) * s, Math.sin(a) * s);
      g.lineTo(Math.cos(a) * s * 1.55, Math.sin(a) * s * 1.55);
    }
    g.stroke();
    g.beginPath();
    g.arc(0, 0, s, 0, Math.PI * 2);
    g.fillStyle = TEAM.v.c;
    g.fill();
    g.stroke();
    g.rotate(-(t / 700 + seed));
    g.fillStyle = '#2a1636';
    g.beginPath();
    g.arc(-s * 0.34, -s * 0.05, s * 0.15, 0, Math.PI * 2);
    g.arc(s * 0.34, -s * 0.05, s * 0.15, 0, Math.PI * 2);
    g.fill();
  } else {
    g.rotate(-0.4 + wob * 0.2);
    g.strokeStyle = '#2a1636';
    g.lineWidth = s * 0.22;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s * 1.3, 0);
    g.quadraticCurveTo(s * 1.9, -s * 0.6 * wob, s * 2.3, 0);
    g.stroke();
    rrect(g, -s * 1.35, -s * 0.8, s * 2.7, s * 1.6, s * 0.8);
    g.fillStyle = TEAM.b.c;
    g.fill();
    g.stroke();
    g.fillStyle = '#2a1636';
    g.beginPath();
    g.arc(-s * 0.4, -s * 0.05, s * 0.15, 0, Math.PI * 2);
    g.arc(s * 0.4, -s * 0.05, s * 0.15, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

const heartbeat = (t) => {
  const p = (t % 900) / 900;
  return p < 0.09 ? Math.sin((p / 0.09) * Math.PI) : p > 0.16 && p < 0.27 ? Math.sin(((p - 0.16) / 0.11) * Math.PI) * 0.6 : 0;
};

// EKG eğrisi
const ecgY = (p) => {
  const q = p % 1;
  if (q < 0.1) return Math.sin((q / 0.1) * Math.PI) * 0.12;
  if (q < 0.16) return 0;
  if (q < 0.18) return -(q - 0.16) * 8;
  if (q < 0.21) return -0.16 + ((q - 0.18) / 0.03) * 1.16;
  if (q < 0.245) return 1 - ((q - 0.21) / 0.035) * 1.3;
  if (q < 0.27) return -0.3 + ((q - 0.245) / 0.025) * 0.3;
  if (q < 0.4) return 0;
  if (q < 0.54) return Math.sin(((q - 0.4) / 0.14) * Math.PI) * 0.24;
  return 0;
};

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], seen: [], numSeen: [], correct: 0, total: 0, taken: 0 });
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
    const pct = data.total ? Math.round((data.correct / data.total) * 100) : 0;
    menuScreen(f.main, api.game, {
      art: ART.fetih,
      sub: 'Bedeni sen savun. Doğru bilen organı alır, üssü düşen haritadan silinir.',
      stats: [['Doğru Cevap', data.correct], ['İsabet', `%${pct}`], ['Alınan Organ', data.taken]],
      how: [
        'Sıra sende olunca kendi organlarına komşu bir organa dokun.',
        'Boş organı almak için soruyu bil. Düşman organında rakip de cevaplar: sen bilip o bilemezse organ senin.',
        'İkiniz de bilirseniz sayı sorusu gelir, en yakın tahmin kazanır.',
        'Üslerin üç kalkanı var. Üç kez kırılan üs düşer ve bütün organları fatihe geçer.',
        'Antibiyotik iki yanlış şıkkı siler, Aşı süreyi uzatır. Dikkatli kullan, sayılıdır.',
        'Tur bitince puanı en yüksek olan kazanır. Haritanın yarısını al: iki yıldız. Üçte ikisini al: üç yıldız.',
      ],
      levels: { total: CASES.length, stars: data.stars, title: 'Vakalar', onPick: (i) => play(i) },
    });
  }

  function nextQuestion() {
    if (data.seen.length > Q.length * 0.85) data.seen = [];
    let i;
    do i = Math.floor(Math.random() * Q.length); while (data.seen.includes(i));
    data.seen.push(i);
    api.touch();
    const [cat, text, right, ...wrong] = Q[i];
    const opts = shuffle([right, ...wrong]);
    return { cat, text, right, opts, ci: opts.indexOf(right) };
  }
  function nextNumber() {
    if (data.numSeen.length > NUM.length * 0.8) data.numSeen = [];
    let i;
    do i = Math.floor(Math.random() * NUM.length); while (data.numSeen.includes(i));
    data.numSeen.push(i);
    api.touch();
    return { text: NUM[i][0], answer: NUM[i][1] };
  }

  function play(li) {
    end();
    local = new Life();
    const my = local;
    const cfg = caseCfg(li);
    const fx = makeFx();
    const teams = ['me', ...cfg.foes];
    const game = {
      phase: 'intro', paused: false, round: 1, turn: 'me', over: false,
      owner: {}, value: {}, shields: {}, flip: {}, alive: Object.fromEntries(teams.map((t) => [t, true])),
      selected: null, targets: [], flies: [], hint: '', q: null, score: {},
      jokers: { half: 2, time: 2 }, correct: 0, total: 0, won: 0,
      view: { s: 1, x: 0, y: 0 }, zoom: null, ecg: 0,
    };
    st = game;
    for (const o of ORGANS) { game.owner[o.id] = null; game.value[o.id] = 100; }
    for (const t of teams) {
      const h = t === 'me' ? HOMES.me : HOMES_SOLO[t];
      game.owner[h] = t;
      game.value[h] = 300;
      game.shields[h] = 3;
    }

    f.setTitle(cfg.name);
    f.main.innerHTML = toHTML(html`
      <div class="ft">
        <canvas class="ft-cv"></canvas>
        <div class="ft-hud">
          ${teams.map((t) => html`<div class="ft-chip" data-team="${t}" style="--c:${TEAM[t].c}"><span class="ft-chip-ic">${teamIcon(t)}</span><b data-score>0</b><small data-regions>1 organ</small></div>`)}
          <div class="ft-round"><small>Tur</small><b data-round>1/${cfg.rounds}</b></div>
        </div>
        <div class="ft-banner" data-banner></div>
        <div class="ft-card" data-card hidden></div>
      </div>`);
    const wrap = f.main.querySelector('.ft');
    const cv = wrap.querySelector('.ft-cv');
    const banner = wrap.querySelector('[data-banner]');
    const card = wrap.querySelector('[data-card]');
    const stage = fitCanvas(cv, my);

    const setBanner = (text, team = null) => {
      banner.textContent = text;
      banner.style.setProperty('--c', team ? TEAM[team].c : '#fff');
      banner.classList.toggle('on', !!text);
    };
    const wait = async (ms) => {
      let left = ms;
      while (left > 0) {
        await my.sleep(Math.min(left, 50));
        if (!game.paused) left -= 50;
      }
    };
    const scoreOf = (t) => ORGANS.reduce((s, o) => s + (game.owner[o.id] === t ? game.value[o.id] : 0), 0);
    const countOf = (t) => ORGANS.filter((o) => game.owner[o.id] === t).length;
    const refreshHud = () => {
      for (const t of teams) {
        const chip = wrap.querySelector(`[data-team="${t}"]`);
        chip.querySelector('[data-score]').textContent = scoreOf(t);
        chip.querySelector('[data-regions]').textContent = game.alive[t] ? `${countOf(t)} organ` : 'Yenildi';
        chip.classList.toggle('active', game.turn === t && !game.over);
        chip.classList.toggle('dead', !game.alive[t]);
      }
      wrap.querySelector('[data-round]').textContent = `${Math.min(game.round, cfg.rounds)}/${cfg.rounds}`;
    };
    const targetsOf = (t) => {
      const out = new Set();
      for (const o of ORGANS) if (game.owner[o.id] === t) for (const n of o.to) if (game.owner[n] !== t) out.add(n);
      return [...out];
    };
    const sourceFor = (t, id) => BY[id].to.map((n) => BY[n]).find((o) => game.owner[o.id] === t) || BY[id];

    /* ---------- Görünüm ---------- */

    function computeView() {
      const { W, H } = stage;
      const land = W > H * 1.05 && W >= 640;
      const q = !card.hidden;
      const top = 62;
      let boxX = 0;
      let boxW = W;
      let boxY = top;
      let boxH = H - top - 8;
      if (land) {
        boxW = W * 0.5;
      } else if (q) {
        boxH = Math.max(120, card.offsetTop - top - 4);
      }
      const fit = Math.min(boxW / 400, boxH / 640) * 0.98;
      if (q && game.zoom && !land) {
        const s = clamp(boxH / 240, fit, fit * 2.6);
        const o = BY[game.zoom];
        return { s, x: boxX + boxW / 2 - o.x * s, y: boxY + boxH / 2 - o.y * s };
      }
      return { s: fit, x: boxX + (boxW - 400 * fit) / 2, y: boxY + (boxH - 640 * fit) / 2 };
    }
    const toScreen = (x, y) => ({ x: game.view.x + x * game.view.s, y: game.view.y + y * game.view.s });
    game.view = computeView();

    /* ---------- Hareketler ---------- */

    function launch(team, from, to, n = 10, dur = 0.8) {
      for (let i = 0; i < n; i++) {
        game.flies.push({ team, x0: from.x + rand(-12, 12), y0: from.y + rand(-12, 12), x1: to.x, y1: to.y, t: -i * 0.06, dur, seed: rand(0, 6), bend: rand(-46, 46), o: rand(0, 6) });
      }
      sfx.whoosh();
    }

    function capture(id, team) {
      const o = BY[id];
      const prev = game.owner[id];
      game.owner[id] = team;
      game.flip[id] = { t: 0, from: prev };
      const p = toScreen(o.x, o.y);
      fx.burst(p.x, p.y, { n: 26, colors: [TEAM[team].c, '#fff'], power: 300, gravity: 240 });
      fx.ring(p.x, p.y, TEAM[team].c, 30);
      sfx.pop(1.2);
      if (team === 'me') { game.won++; data.taken++; tone({ type: 'triangle', f: 660, f2: 990, dur: 0.18, vol: 0.09 }); }
      game.flies = game.flies.filter((c) => c.t < 1 || c.x1 !== o.x);
      refreshHud();
    }

    // Saldırı tuttu: üs ise kalkan kırılır, son kalkanda bütün topraklar el değiştirir
    async function hit(id, team) {
      const def = game.owner[id];
      if (game.shields[id] > 0 && def) {
        game.shields[id]--;
        const o = BY[id];
        const p = toScreen(o.x, o.y);
        fx.burst(p.x, p.y, { n: 18, colors: ['#ffcd3c', '#fff'], power: 260 });
        shake(wrap, 7);
        sfx.thud();
        if (game.shields[id] > 0) {
          fx.text(p.x, p.y - 26, `Kalkan Kırıldı! ${game.shields[id]} kaldı`, '#ffcd3c', 20);
          await wait(800);
          return;
        }
        // Üs düştü
        sfx.boom();
        buzz(50);
        shake(wrap, 14, 600);
        fx.text(p.x, p.y - 30, 'Üs Düştü!', '#fff', 30);
        game.alive[def] = false;
        const lost = ORGANS.filter((q) => game.owner[q.id] === def && q.id !== id);
        capture(id, team);
        await wait(400);
        for (const q of lost) {
          capture(q.id, team);
          await wait(120);
        }
        game.value[id] = 300;
        refreshHud();
        await wait(500);
        return;
      }
      capture(id, team);
      await wait(600);
    }

    /* ---------- Soru kartı ---------- */

    function showCard(tpl, zoom) {
      card.innerHTML = toHTML(tpl);
      card.hidden = false;
      card.classList.remove('out');
      game.zoom = zoom;
    }
    function hideCard() {
      card.hidden = true;
      card.innerHTML = '';
      game.zoom = null;
    }

    // Çok seçenekli soru. foe: rakip takım (yoksa yalnız sen cevaplarsın). {me, foe} döner
    function ask({ title, foe = null, target, side }) {
      return new Promise((resolve) => {
        const q = nextQuestion();
        const foeRight = foe ? Math.random() < cfg.acc : false;
        const wrongIdx = q.opts.map((_, i) => i).filter((i) => i !== q.ci);
        const foePick = foe ? (foeRight ? q.ci : pick(wrongIdx)) : -1;
        showCard(html`
          <div class="ft-head" style="--c:${TEAM[side].c}">
            <span class="ft-vs"><i class="ft-vs-ic">${teamIcon('me')}</i>${foe ? html`<em>VS</em><i class="ft-vs-ic foe">${teamIcon(foe)}</i>` : ''}</span>
            <b class="ft-title">${title}</b>
            <span class="ft-timer"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18"/><circle data-ring cx="22" cy="22" r="18" pathLength="100"/></svg><b data-sec>${cfg.time}</b></span>
          </div>
          <span class="ft-cat">${q.cat}</span>
          <p class="ft-text">${q.text}</p>
          <div class="ft-ans">${q.opts.map((o, i) => html`<button class="ft-a" data-a="${i}"><i>${'ABCD'[i]}</i><span>${o}</span></button>`)}</div>
          <div class="ft-jok">
            <button class="ft-j" data-j="half" ${game.jokers.half ? '' : 'disabled'}><svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4" fill="#fff" stroke="#2a1636" stroke-width="2"/><path d="M12 8v8" stroke="#2a1636" stroke-width="2"/><path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#ff5468" stroke="#2a1636" stroke-width="2"/></svg>Antibiyotik <b>${game.jokers.half}</b></button>
            <button class="ft-j" data-j="time" ${game.jokers.time ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M14 4l6 6M12 6l6 6-8 8H6v-4zM3 21l3-3" fill="none" stroke="#2a1636" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 6l6 6-5 5-6-6z" fill="#4fb6ff"/></svg>Aşı <b>${game.jokers.time}</b></button>
          </div>`, target);
        card.querySelectorAll('.ft-a').forEach((b, i) => popIn(b, 60 + i * 50));
        const ring = card.querySelector('[data-ring]');
        const sec = card.querySelector('[data-sec]');
        let left = cfg.time;
        let total = cfg.time;
        let lastTick = 0;
        game.q = { ...q, left, answer: null, foePick };
        let done = false;
        const finish = (i) => {
          if (done) return;
          done = true;
          stopTimer();
          game.phase = 'reveal';
          const right = i === q.ci;
          game.total++;
          data.total++;
          if (right) { game.correct++; data.correct++; }
          api.touch();
          const btns = [...card.querySelectorAll('.ft-a')];
          btns.forEach((b) => { b.disabled = true; });
          btns[q.ci].classList.add('right');
          if (i >= 0 && !right) { btns[i].classList.add('wrong'); shake(btns[i], 6); }
          if (foe) {
            const chip = document.createElement('span');
            chip.className = 'ft-foe-pick';
            chip.innerHTML = toHTML(teamIcon(foe));
            btns[foePick].appendChild(chip);
            popIn(chip, 180);
          }
          if (right) { sfx.good(); buzz(14); } else { sfx.bad(); buzz(40); }
          if (i < 0) card.querySelector('.ft-title').textContent = 'Süre Bitti!';
          my.timeout(() => {
            game.q = null;
            resolve({ me: right, foe: foeRight });
          }, foe ? 1500 : 1100);
        };
        const stopTimer = my.raf((dt) => {
          if (game.paused || done) return undefined;
          left -= dt;
          game.q.left = left;
          game.ecg = 1 - left / total;
          ring.style.strokeDashoffset = 100 - clamp(left / total, 0, 1) * 100;
          sec.textContent = Math.max(0, Math.ceil(left));
          if (left < 5 && Math.ceil(left) !== lastTick) {
            lastTick = Math.ceil(left);
            sfx.tick();
            card.classList.toggle('alarm', true);
          }
          if (left <= 0) finish(-1);
          return undefined;
        });
        game.phase = 'q';
        game.answer = finish;
        card.onclick = (e) => {
          const a = e.target.closest('[data-a]');
          if (a) { sfx.tap(); finish(Number(a.dataset.a)); return; }
          const j = e.target.closest('[data-j]');
          if (!j || j.disabled || done) return;
          const kind = j.dataset.j;
          if (!game.jokers[kind]) return;
          game.jokers[kind]--;
          j.querySelector('b').textContent = game.jokers[kind];
          j.disabled = true;
          sfx.zap();
          if (kind === 'half') {
            shuffle(wrongIdx).slice(0, 2).forEach((i) => {
              const b = card.querySelector(`[data-a="${i}"]`);
              b.classList.add('gone');
              b.disabled = true;
            });
          } else {
            left += 8;
            total = Math.max(total, left);
            card.classList.remove('alarm');
          }
        };
      });
    }

    // Eşitlik: sayı sorusu. Sinem klavyeden yazar, rakip tahmin eder, en yakın kazanır. Eşitlikte savunan kalır
    function numberDuel({ foe, target, attackerIsMe }) {
      return new Promise((resolve) => {
        const q = nextNumber();
        const spread = q.answer >= 1000 && q.answer <= 2100 ? 40 * (1.1 - cfg.acc) : Math.max(1, q.answer * 0.32 * (1.05 - cfg.acc));
        const guess = Math.max(0, Math.round(q.answer + (Math.random() + Math.random() - 1) * spread * 2));
        let val = '';
        let left = 20;
        let done = false;
        showCard(html`
          <div class="ft-head" style="--c:#ffcd3c">
            <span class="ft-vs"><i class="ft-vs-ic">${teamIcon('me')}</i><em>VS</em><i class="ft-vs-ic foe">${teamIcon(foe)}</i></span>
            <b class="ft-title">Eşitlik! En Yakın Tahmin</b>
            <span class="ft-timer"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18"/><circle data-ring cx="22" cy="22" r="18" pathLength="100"/></svg><b data-sec>20</b></span>
          </div>
          <p class="ft-text">${q.text}</p>
          <div class="ft-disp" data-disp>?</div>
          <div class="ft-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'sil', '0', 'tamam'].map((k) => html`<button class="ft-k ${k === 'tamam' ? 'ok' : ''}" data-k="${k}">${k === 'sil' ? '←' : k === 'tamam' ? icon('check') : k}</button>`)}</div>`, target);
        const disp = card.querySelector('[data-disp]');
        const ring = card.querySelector('[data-ring]');
        const sec = card.querySelector('[data-sec]');
        const finish = async () => {
          if (done) return;
          done = true;
          stopTimer();
          game.phase = 'reveal';
          const mine = val === '' ? null : Number(val);
          const dm = mine == null ? Infinity : Math.abs(mine - q.answer);
          const df = Math.abs(guess - q.answer);
          const iWin = dm === df ? !attackerIsMe : dm < df;
          const pad = card.querySelector('.ft-pad');
          pad.outerHTML = toHTML(html`<div class="ft-num-res">
            <div class="ft-nr ${iWin ? 'win' : ''}"><i class="ft-vs-ic">${teamIcon('me')}</i><b>${mine ?? '-'}</b></div>
            <div class="ft-nr truth"><small>Doğrusu</small><b>${q.answer}</b></div>
            <div class="ft-nr ${iWin ? '' : 'win'}"><i class="ft-vs-ic foe">${teamIcon(foe)}</i><b>${guess}</b></div>
          </div>`);
          disp.remove();
          if (iWin) sfx.good(); else sfx.bad();
          card.querySelector('.ft-title').textContent = iWin ? 'Tahminin Daha Yakın!' : 'O Daha Yakındı';
          await wait(1700);
          resolve(iWin);
        };
        const stopTimer = my.raf((dt) => {
          if (game.paused || done) return undefined;
          left -= dt;
          ring.style.strokeDashoffset = 100 - clamp(left / 20, 0, 1) * 100;
          sec.textContent = Math.max(0, Math.ceil(left));
          if (left <= 0) finish();
          return undefined;
        });
        game.phase = 'num';
        game.numAnswer = (v) => { val = String(v); finish(); };
        game.numTruth = q.answer;
        card.onclick = (e) => {
          const b = e.target.closest('[data-k]');
          if (!b || done) return;
          const k = b.dataset.k;
          sfx.tile();
          if (k === 'sil') val = val.slice(0, -1);
          else if (k === 'tamam') { if (val) finish(); return; } else if (val.length < 6) val += k;
          disp.textContent = val || '?';
          disp.classList.toggle('on', !!val);
        };
      });
    }

    /* ---------- Sıralar ---------- */

    async function myTurn() {
      game.turn = 'me';
      refreshHud();
      const list = targetsOf('me');
      if (!list.length) return;
      game.targets = list;
      game.phase = 'pick';
      setBanner('Sıra Sende: Komşu Bir Organa Dokun', 'me');
      sfx.soft();
      const id = await new Promise((resolve) => { game.pick = resolve; });
      game.pick = null;
      game.targets = [];
      game.selected = id;
      game.phase = 'fly';
      setBanner('');
      const o = BY[id];
      launch('me', sourceFor('me', id), o);
      const foe = game.owner[id];
      await wait(420);
      if (!foe) {
        const r = await ask({ title: `${o.name} İçin`, target: id, side: 'me' });
        hideCard();
        game.selected = null;
        if (r.me) {
          const p = toScreen(o.x, o.y);
          fx.text(p.x, p.y - 30, '+100', TEAM.me.c, 24);
          await hit(id, 'me');
        } else {
          fizzle(o);
          await wait(500);
        }
        return;
      }
      const r = await ask({ title: `${o.name}: ${TEAM[foe].name}`, foe, target: id, side: 'me' });
      let won = r.me && !r.foe;
      if (r.me && r.foe) won = await numberDuel({ foe, target: id, attackerIsMe: true });
      hideCard();
      game.selected = null;
      if (won) {
        const p = toScreen(o.x, o.y);
        fx.text(p.x, p.y - 30, 'Senin!', TEAM.me.c, 26);
        await hit(id, 'me');
      } else {
        fizzle(o);
        game.value[id] += 50;
        refreshHud();
        await wait(500);
      }
    }

    function fizzle(o) {
      const p = toScreen(o.x, o.y);
      game.flies = game.flies.filter((c) => c.x1 !== o.x || c.y1 !== o.y);
      fx.text(p.x, p.y - 28, 'Tutmadı', '#fff', 20);
      fx.burst(p.x, p.y, { n: 10, colors: ['#9fd8ff', '#fff'], power: 140, gravity: 60 });
      sfx.soft();
    }

    function chooseTarget(team) {
      const cands = targetsOf(team);
      if (!cands.length) return null;
      const scored = cands.map((id) => {
        const def = game.owner[id];
        let s = rand(0, 60);
        if (!def) s += 55 - game.round * 3;
        else if (def === 'me') s += 30 + game.round * 5 + (game.shields[id] ? 18 : 0);
        else s += 16;
        return { id, s };
      });
      scored.sort((a, b) => b.s - a.s);
      return scored[0].id;
    }

    async function aiTurn(team) {
      game.turn = team;
      refreshHud();
      game.phase = 'ai';
      const id = chooseTarget(team);
      if (!id) return;
      const o = BY[id];
      const def = game.owner[id];
      setBanner(`${TEAM[team].name} ${o.name} Peşinde`, team);
      await wait(520);
      game.selected = id;
      launch(team, sourceFor(team, id), o, 9);
      await wait(760);
      if (def === 'me') {
        setBanner('');
        const home = game.shields[id] > 0;
        const r = await ask({ title: home ? `Kalbine Saldırı!` : `${o.name} Tehlikede!`, foe: team, target: id, side: team });
        let lost = r.foe && !r.me;
        if (r.foe && r.me) lost = !(await numberDuel({ foe: team, target: id, attackerIsMe: false }));
        hideCard();
        game.selected = null;
        if (lost) {
          const p = toScreen(o.x, o.y);
          fx.text(p.x, p.y - 30, `${TEAM[team].name} Aldı`, TEAM[team].c, 22);
          await hit(id, team);
        } else {
          const p = toScreen(o.x, o.y);
          game.value[id] += 50;
          fx.text(p.x, p.y - 30, 'Savundun! +50', TEAM.me.c, 24);
          fx.ring(p.x, p.y, TEAM.me.c, 34);
          game.flies = game.flies.filter((c) => c.x1 !== o.x || c.y1 !== o.y);
          sfx.good();
          refreshHud();
          await wait(700);
        }
      } else {
        const ok = Math.random() < (def ? cfg.acc * 0.6 : cfg.acc * 0.9 + 0.08);
        game.selected = null;
        if (ok) await hit(id, team);
        else {
          fizzle(o);
          await wait(360);
        }
      }
      setBanner('');
    }

    const onlyLeft = () => teams.filter((t) => game.alive[t]).length <= 1;

    async function run() {
      refreshHud();
      setBanner(`Vaka ${li + 1}: ${cfg.name}`);
      await wait(1100);
      setBanner('');
      for (game.round = 1; game.round <= cfg.rounds; game.round++) {
        refreshHud();
        for (const t of teams) {
          if (!game.alive[t]) continue;
          if (t === 'me') await myTurn();
          else await aiTurn(t);
          if (onlyLeft() || !game.alive.me) { finish(); return; }
          await wait(160);
        }
      }
      finish();
    }

    function finish() {
      game.over = true;
      game.phase = 'over';
      setBanner('');
      refreshHud();
      const mine = scoreOf('me');
      const best = Math.max(...teams.filter((t) => t !== 'me').map(scoreOf));
      const won = game.alive.me && mine > best;
      const n = countOf('me');
      const stars = won ? (n >= 11 || onlyLeft() ? 3 : n >= 8 ? 2 : 1) : 0;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = 8 + game.correct * 2 + stars * 8;
      api.finish({ coins });
      my.timeout(() => {
        resultSheet({
          won,
          title: won ? 'Beden Kurtuldu!' : game.alive.me ? 'Enfeksiyon Yayıldı' : 'Kalp Düştü',
          sub: won ? (stars === 3 ? 'Hasta taburcu oldu, doktor sana teşekkür ediyor.' : 'Temiz iş. Biraz daha organ alsan üç yıldız.') : 'Bir daha dene: komşu organları sırayla kapat, üssünü koru.',
          stars,
          coins,
          stats: [['Organ', `${n} / ${ORGANS.length}`], ['Doğru', `${game.correct} / ${game.total}`], ['Puan', mine]],
          buttons: [
            ...(stars && li + 1 < CASES.length ? [{ label: 'Sonraki Vaka', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', main: !stars, icon: 'replay', act: () => play(li) },
            { label: 'Vakalar', icon: 'list', act: () => menu() },
          ],
        });
      }, 700);
    }

    /* ---------- Dokunma ---------- */

    function pickAt(px, py) {
      if (game.phase !== 'pick' || game.paused || !game.pick) return;
      const x = (px - game.view.x) / game.view.s;
      const y = (py - game.view.y) / game.view.s;
      const g = stage.g;
      let hitId = null;
      for (const id of game.targets) if (g.isPointInPath(BY[id].path, x, y)) hitId = id;
      if (!hitId) {
        // Küçük organlara kolay dokunuş: en yakın hedef
        let bd = 34;
        for (const id of game.targets) {
          const d = Math.hypot(BY[id].x - x, BY[id].y - y);
          if (d < bd) { bd = d; hitId = id; }
        }
      }
      if (!hitId) {
        sfx.soft();
        return;
      }
      sfx.pop();
      buzz(12);
      game.pick(hitId);
    }
    my.on(cv, 'pointerdown', (e) => {
      const r = cv.getBoundingClientRect();
      pickAt(e.clientX - r.left, e.clientY - r.top);
    });
    game.choose = (id) => { if (game.phase === 'pick' && game.pick && game.targets.includes(id)) game.pick(id); };

    f.onBack = () => {
      if (game.over) { menu(); return; }
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
      if (!game.paused) game.ecg = card.hidden ? Math.max(0, game.ecg - dt) : game.ecg;
      // Yumuşak kamera
      const tv = computeView();
      const ka = 1 - Math.pow(0.002, dt);
      game.view.s = lerp(game.view.s, tv.s, ka);
      game.view.x = lerp(game.view.x, tv.x, ka);
      game.view.y = lerp(game.view.y, tv.y, ka);

      // Laboratuvar zemini
      const bg = g.createRadialGradient(W * 0.5, H * 0.45, 20, W * 0.5, H * 0.45, Math.max(W, H) * 0.75);
      bg.addColorStop(0, '#0f5560');
      bg.addColorStop(1, '#062430');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,240,230,.07)';
      g.lineWidth = 1;
      g.beginPath();
      const step = Math.max(26, W / 22);
      const off = (t / 90) % step;
      for (let x = -step + off; x < W; x += step) { g.moveTo(x, 0); g.lineTo(x, H); }
      for (let y = 0; y < H; y += step) { g.moveTo(0, y); g.lineTo(W, y); }
      g.stroke();

      // EKG: süre azaldıkça hızlanır
      const beat = heartbeat(t);
      const ey = H - 24;
      const speed = 1 + game.ecg * 2.4;
      g.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const y = ey - ecgY(x / 190 - (t / 1000) * speed) * 22;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = game.ecg > 0.7 ? 'rgba(255,90,110,.75)' : 'rgba(90,255,200,.45)';
      g.lineWidth = 2;
      g.stroke();

      const v = game.view;
      g.save();
      g.translate(v.x, v.y);
      g.scale(v.s, v.s);

      // Beden
      g.save();
      g.shadowColor = 'rgba(70,240,225,.6)';
      g.shadowBlur = 26 * v.s;
      g.fillStyle = 'rgba(120,235,225,.12)';
      g.fill(BODY);
      g.restore();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(150,255,245,.75)';
      g.stroke(BODY);

      // Kan damarları ve tarama çizgisi bedenin içinde
      g.save();
      g.clip(BODY);
      for (const n of VEIN_PATHS) {
        g.strokeStyle = n.c;
        g.globalAlpha = 0.28;
        g.lineWidth = 4;
        g.setLineDash([]);
        g.stroke(n.path);
        g.globalAlpha = 0.75;
        g.lineWidth = 3;
        g.setLineDash([3, 20]);
        g.lineDashOffset = -t / 26;
        g.stroke(n.path);
      }
      g.setLineDash([]);
      g.globalAlpha = 1;
      const sy = ((t / 3800) % 1) * 720 - 40;
      const scan = g.createLinearGradient(0, sy - 40, 0, sy + 10);
      scan.addColorStop(0, 'rgba(120,255,240,0)');
      scan.addColorStop(1, 'rgba(120,255,240,.28)');
      g.fillStyle = scan;
      g.fillRect(0, sy - 40, 400, 50);
      g.restore();

      // Organlar
      for (const o of ORGANS) {
        const own = game.owner[o.id];
        const isT = game.targets.includes(o.id);
        const sel = game.selected === o.id;
        g.save();
        if (o.pulse) {
          const k = 1 + beat * 0.09;
          g.translate(o.x, o.y);
          g.scale(k, k);
          g.translate(-o.x, -o.y);
        }
        if (isT || sel) {
          g.shadowColor = sel ? '#ffcd3c' : '#ffffff';
          g.shadowBlur = (10 + Math.sin(t / 170) * 7) * v.s;
        }
        g.fillStyle = own ? TEAM[own].c : 'rgba(205,250,245,.2)';
        const fl = game.flip[o.id];
        if (fl && fl.t < 1) {
          // Yeni renk organın ortasından yayılır
          g.fillStyle = fl.from ? TEAM[fl.from].c : 'rgba(205,250,245,.2)';
          g.fill(o.path);
          g.shadowBlur = 0;
          g.save();
          g.clip(o.path);
          g.beginPath();
          g.arc(o.x, o.y, fl.t * 110, 0, Math.PI * 2);
          g.fillStyle = TEAM[own].c;
          g.fill();
          g.restore();
          if (!game.paused) fl.t += dt * 2.2;
        } else {
          g.fill(o.path);
          g.shadowBlur = 0;
        }
        // Parıltı
        g.save();
        g.clip(o.path);
        g.globalAlpha = own ? 0.28 : 0.12;
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(o.x - 10, o.y - 14, 30, 12, -0.4, 0, Math.PI * 2);
        g.fill();
        g.restore();
        if (o.detail) {
          g.lineWidth = 2;
          g.lineCap = 'round';
          g.strokeStyle = own ? 'rgba(42,22,54,.32)' : 'rgba(180,250,245,.35)';
          g.stroke(o.detail);
        }
        g.lineWidth = isT || sel ? 3.2 : 2.4;
        g.strokeStyle = isT ? '#fff' : sel ? '#ffcd3c' : own ? '#2a1636' : 'rgba(180,250,245,.7)';
        g.stroke(o.path);
        g.restore();
      }

      // Hedef halkaları ve organ adları
      if (game.phase === 'pick') {
        for (const id of game.targets) {
          const o = BY[id];
          const r = 12 + ((t / 14) % 22);
          g.beginPath();
          g.arc(o.x, o.y, r, 0, Math.PI * 2);
          g.strokeStyle = `rgba(255,255,255,${0.75 * (1 - (r - 12) / 22)})`;
          g.lineWidth = 2.4;
          g.stroke();
        }
      }

      // Bayraklar: organda oturan birlikler, üslerde kalkan
      for (const o of ORGANS) {
        const own = game.owner[o.id];
        if (own) drawCell(g, own, o.x, o.y + Math.sin(t / 340 + o.x) * 2, o.id === 'tiroid' ? 6 : 8.5, t, o.y);
        const sh = game.shields[o.id];
        if (sh > 0) {
          for (let k = 0; k < sh; k++) {
            const a = -Math.PI / 2 + (k - (sh - 1) / 2) * 0.62;
            const sx = o.x + Math.cos(a) * 25;
            const sy2 = o.y + Math.sin(a) * 25;
            g.beginPath();
            g.moveTo(sx, sy2 - 7);
            g.lineTo(sx + 6, sy2 - 4);
            g.lineTo(sx + 5, sy2 + 3);
            g.lineTo(sx, sy2 + 7);
            g.lineTo(sx - 5, sy2 + 3);
            g.lineTo(sx - 6, sy2 - 4);
            g.closePath();
            g.fillStyle = '#ffcd3c';
            g.fill();
            g.lineWidth = 1.8;
            g.strokeStyle = '#2a1636';
            g.stroke();
          }
        }
      }

      // Giden birlikler
      for (const c of game.flies) {
        if (!game.paused) c.t += dt / c.dur;
        if (c.t < 0) continue;
        if (c.t >= 1) {
          // Hedefin etrafında döner
          c.o += dt * 3;
          const x = c.x1 + Math.cos(c.o) * 22;
          const y = c.y1 + Math.sin(c.o) * 22;
          drawCell(g, c.team, x, y, 5.5, t, c.seed);
          continue;
        }
        const k = c.t * c.t * (3 - 2 * c.t);
        const mx = (c.x0 + c.x1) / 2 + c.bend;
        const my2 = (c.y0 + c.y1) / 2 - 14;
        const x = (1 - k) * (1 - k) * c.x0 + 2 * (1 - k) * k * mx + k * k * c.x1;
        const y = (1 - k) * (1 - k) * c.y0 + 2 * (1 - k) * k * my2 + k * k * c.y1;
        drawCell(g, c.team, x, y, 5.5, t, c.seed);
      }
      if (game.selected === null && game.flies.length) game.flies.length = 0;
      g.restore();

      // Adlar en üstte, sabit boyutta okunsun
      if (game.phase === 'pick' || game.selected) {
        const list = game.phase === 'pick' ? game.targets : [game.selected];
        for (const id of list) {
          const o = BY[id];
          const p = toScreen(o.x, o.y);
          label(g, p.x, p.y + 20 * v.s + 7, o.name, { size: 13, color: '#fff', stroke: '#06303a', sw: 0.32, font: '"Exo 2", sans-serif' });
        }
      }
      fx.draw(g, game.paused ? 0 : dt);
      return undefined;
    });

    run();
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
