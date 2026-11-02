// Dönerci Sinem: 3B döner döner, kızarınca bıçakla kes. Müşterinin siparişini sar, sabrı bitmeden yetiştir.
// Her gün yeni malzeme ve daha çok müşteri. Kazandığın parayla dükkanı geliştir.

import { Life, html, raw, toHTML, drag, clamp, rand, pick, randInt } from '../core/dom.js';
import { sfx, buzz, steady } from '../core/audio.js';
import { shake, pop, popIn } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, openSheet, icon } from '../core/ui.js';
import { customer, setMood } from '../core/avatar.js';
import { loadThree, makeRenderer, toon, inkMaterial, frameGate } from '../core/three-kit.js';
import { ART } from '../art.js';

const DAYS = 30;
const S = 'stroke="#2a1636" stroke-width="2.600" stroke-linejoin="round" stroke-linecap="round"';
const ING = {
  lavas: { name: 'Lavaş', svg: `<circle cx="16" cy="16" r="13" fill="#f6dcae" ${S}/><circle cx="11" cy="12" r="2" fill="#c98f4a"/><circle cx="20" cy="20" r="2.400" fill="#c98f4a"/><circle cx="21" cy="11" r="1.500" fill="#c98f4a"/>` },
  ekmek: { name: 'Ekmek', svg: `<path d="M3 20 Q4 9 16 8 Q28 9 29 20 Q16 26 3 20 Z" fill="#e8b061" ${S}/><path d="M10 13l3 4M16 12l3 4M22 13l2 3" fill="none" stroke="#a5682a" stroke-width="2" stroke-linecap="round"/>` },
  et: { name: 'Et', svg: `<path d="M5 12 Q12 6 18 11 T28 11 L27 20 Q20 26 14 21 T4 21 Z" fill="#a8602c" ${S}/><path d="M9 15q6-3 13 0" fill="none" stroke="#6e3a17" stroke-width="2.200" stroke-linecap="round"/>` },
  domates: { name: 'Domates', svg: `<circle cx="16" cy="17" r="11" fill="#ff4f4f" ${S}/><path d="M16 6l-3 4 3-1 3 1z" fill="#2fbf71" ${S}/><path d="M16 12v10M11 17h10" stroke="#ffb0a0" stroke-width="2" stroke-linecap="round"/>` },
  sogan: { name: 'Soğan', svg: `<ellipse cx="16" cy="17" rx="11" ry="10" fill="#e9c6f2" ${S}/><ellipse cx="16" cy="17" rx="6.500" ry="5.500" fill="none" stroke="#a65fc7" stroke-width="2"/><ellipse cx="16" cy="17" rx="2.400" ry="2" fill="none" stroke="#a65fc7" stroke-width="2"/>` },
  marul: { name: 'Marul', svg: `<path d="M5 22 Q3 12 10 12 Q10 5 16 7 Q22 5 22 12 Q29 12 27 22 Q16 28 5 22 Z" fill="#7fd14f" ${S}/><path d="M16 11v12M10 17l6 4M22 17l-6 4" fill="none" stroke="#3f9a2f" stroke-width="1.800" stroke-linecap="round"/>` },
  tursu: { name: 'Turşu', svg: `<path d="M8 25 Q3 16 10 9 Q16 3 23 6 Q28 9 25 16 Q20 26 8 25 Z" fill="#9fbf3a" ${S}/><circle cx="13" cy="17" r="1.500" fill="#5f7f1a"/><circle cx="18" cy="12" r="1.500" fill="#5f7f1a"/>` },
  patates: { name: 'Patates', svg: `<path d="M9 28V10M14 28V6M19 28V9M24 28V12" stroke="#2a1636" stroke-width="6" stroke-linecap="round"/><path d="M9 28V10M14 28V6M19 28V9M24 28V12" stroke="#ffd24a" stroke-width="3.200" stroke-linecap="round"/>` },
  sos: { name: 'Acı Sos', svg: `<path d="M12 4h8v5l3 4v12q0 3-3 3h-8q-3 0-3-3V13l3-4z" fill="#e0301e" ${S}/><path d="M12 15h8" stroke="#ffcd3c" stroke-width="3"/>` },
  ayran: { name: 'Ayran', svg: `<path d="M9 7h14l-2 21h-10z" fill="#fff" ${S}/><path d="M9 12q7-3 14 0" fill="none" stroke="#9fdcff" stroke-width="2"/>` },
  kola: { name: 'Kola', svg: `<rect x="10" y="5" width="12" height="23" rx="3" fill="#c0202a" ${S}/><path d="M10 13h12" stroke="#fff" stroke-width="2.400"/><path d="M12 5h8" stroke="#dfe6ef" stroke-width="3"/>` },
  salgam: { name: 'Şalgam', svg: `<path d="M9 7h14l-2 21h-10z" fill="#b5205a" ${S}/><path d="M16 2l-2 8" stroke="#ff9f1c" stroke-width="3" stroke-linecap="round"/>` },
};
const svgOf = (id, cls = '') => raw(`<svg class="ing ${cls}" viewBox="0 0 32 32">${ING[id].svg}</svg>`);
const BREADS = ['lavas', 'ekmek'];
const TOPS = ['domates', 'sogan', 'marul', 'tursu', 'patates', 'sos'];
const DRINKS = ['ayran', 'kola', 'salgam'];
const UNLOCK = { lavas: 1, domates: 1, et: 1, ekmek: 2, sogan: 3, ayran: 4, marul: 5, tursu: 7, kola: 9, patates: 11, sos: 14, salgam: 17 };
const UPGRADES = [
  { id: 'blade', name: 'Keskin Bıçak', desc: 'Her kesişte daha çok et', cost: [120, 300], max: 2 },
  { id: 'tray', name: 'Geniş Tepsi', desc: 'Tepside 2 porsiyon daha', cost: [80, 200, 420], max: 3 },
  { id: 'tea', name: 'Çay İkramı', desc: 'Müşteriler daha sabırlı', cost: [100, 260, 520], max: 3 },
  { id: 'fire', name: 'Usta Ateş', desc: 'Altın kızarıklık daha uzun sürer', cost: [150, 380], max: 2 },
  { id: 'sign', name: 'Neon Tabela', desc: 'Bahşişler daha yüksek', cost: [180, 450], max: 2 },
];

function dayConfig(d) {
  const avail = Object.keys(UNLOCK).filter((k) => UNLOCK[k] <= d);
  return {
    avail,
    breads: BREADS.filter((b) => avail.includes(b)),
    tops: TOPS.filter((b) => avail.includes(b)),
    drinks: DRINKS.filter((b) => avail.includes(b)),
    total: Math.min(18, 4 + Math.floor(d * 0.55)),
    gap: Math.max(2.8, 7.5 - d * 0.17),
    patience: Math.max(15, 30 - d * 0.42),
    maxTops: Math.min(4, 1 + Math.floor(d / 5)),
    goal: 40 + d * 26,
  };
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], cash: 0, up: {}, total: 0, bestEndless: 0 });
  const f = api.frame({ onBack: () => api.exit() });
  let playLife = null;
  let st = null;

  function endPlay() {
    if (playLife) playLife.dispose();
    playLife = null;
    st = null;
  }

  function menu() {
    endPlay();
    f.onBack = () => api.exit();
    f.setTitle(api.game.title);
    menuScreen(f.main, api.game, {
      art: ART.doner,
      sub: 'Dönerin kızarınca kes, siparişi sar, müşteri kaçmadan yetiştir.',
      stats: [['Kasa', `${data.cash} ₺`], ['Toplam Satış', data.total]],
      how: [
        'Döner kızardıkça renk değiştirir. Gösterge yeşildeyken dönerin üstünde parmağını aşağı çek: et kesilir.',
        'Çiğ kesersen ya da yakarsan et çöpe gider. Tepside et kalmazsa sipariş hazırlayamazsın.',
        'Siparişe bak: ekmeği seç, eti ve malzemeleri ekle, içeceği ekle, sonra Sar düğmesine bas.',
        'Doğru sipariş kendi müşterisine gider. Hızlı olursan bahşiş artar. Üç müşteri kaçarsa gün biter.',
      ],
      buttons: [{ label: 'Dükkanı Geliştir', icon: 'plus', act: shop }],
      levels: { total: DAYS, stars: data.stars, title: 'Günler', onPick: (i) => startDay(i + 1) },
    });
  }

  function shop() {
    const render = () => toHTML(html`
      <h2 class="sh-title">Dükkan</h2>
      <p class="sh-text">Kasada <b>${data.cash} ₺</b> var.</p>
      <div class="shop-list">${UPGRADES.map((u) => {
        const lv = data.up[u.id] || 0;
        const done = lv >= u.max;
        const cost = u.cost[lv];
        return html`<div class="shop-row"><span class="shop-t"><b>${u.name}</b><small>${u.desc}</small><i>${Array.from({ length: u.max }, (_, k) => html`<em class="${k < lv ? 'on' : ''}"></em>`)}</i></span>${done ? html`<span class="shop-max">Tamam</span>` : html`<button class="btn btn-small ${data.cash >= cost ? 'btn-main' : ''}" data-buy="${u.id}" ${data.cash >= cost ? '' : raw('disabled')}>${cost} ₺</button>`}</div>`;
      })}</div>
      <button class="btn" data-act="ok">Kapat</button>`);
    const sh = openSheet(raw(render()), { actions: { ok: (c) => c() }, onClose: () => { if (!st) menu(); } });
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (!b || b.disabled) return;
      const u = UPGRADES.find((x) => x.id === b.dataset.buy);
      const lv = data.up[u.id] || 0;
      if (data.cash < u.cost[lv]) return;
      data.cash -= u.cost[lv];
      data.up[u.id] = lv + 1;
      api.touch();
      sfx.coin();
      sfx.good();
      buzz(20);
      sh.el.innerHTML = render();
    });
  }

  async function startDay(day) {
    endPlay();
    playLife = new Life();
    const local = playLife;
    const cfg = dayConfig(day);
    const up = (k) => data.up[k] || 0;
    f.setTitle(`${day}. Gün`);
    f.main.innerHTML = toHTML(html`
      <div class="dn">
        <div class="dn-street">
          <svg class="dn-bg" viewBox="0 0 390 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <rect x="0" y="70" width="90" height="190" fill="#2b1a42"/><rect x="90" y="110" width="70" height="150" fill="#24163a"/><rect x="160" y="60" width="110" height="200" fill="#2b1a42"/><rect x="270" y="100" width="120" height="160" fill="#24163a"/>
            ${raw([[14, 90], [50, 90], [14, 130], [50, 170], [104, 130], [130, 170], [176, 84], [212, 84], [240, 124], [176, 164], [212, 204], [288, 120], [330, 120], [360, 160], [300, 200]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="20" height="24" rx="2" fill="${i % 3 ? '#ffd76a' : '#3a2a56'}" opacity="${i % 3 ? 0.75 : 1}"/>`).join(''))}
            <path d="M0 44 Q100 76 195 48 T390 44" fill="none" stroke="#0e0818" stroke-width="2"/>
            ${raw(Array.from({ length: 12 }, (_, k) => { const x = 10 + k * 33; const y = 48 + Math.sin(k * 0.95 + 0.4) * 12 + 6; return `<circle class="dn-bulb" style="animation-delay:${(-k * 0.3).toFixed(1)}s" cx="${x}" cy="${y.toFixed(1)}" r="4" fill="${['#ffcd3c', '#ff5fa2', '#7fd6ff'][k % 3]}"/>`; }).join(''))}
            <rect x="0" y="244" width="390" height="16" fill="#1c1030"/>
          </svg>
          <div class="dn-sign">SİNEM USTA <span>DÖNER</span></div>
          <div class="dn-progress"><span data-money>0 ₺</span><i><b data-bar></b></i><span data-left></span></div>
          <div class="dn-queue" data-queue></div>
        </div>
        <div class="dn-mid">
          <div class="dn-cone" data-cone>
            <canvas class="dn-3d"></canvas>
            <div class="dn-gauge"><i data-gz></i><b data-gn></b></div>
            <div class="dn-hint" data-hint>Parmağını aşağı çek</div>
          </div>
          <div class="dn-tray"><span class="dn-tray-t">Tepsi</span><div class="dn-meats" data-meats></div><span class="dn-tray-n" data-tn></span></div>
        </div>
        <div class="dn-bench">
          <div class="dn-wrap" data-wrap></div>
          <div class="dn-btns" data-btns>
            ${cfg.breads.map((b) => html`<button class="ib ib-bread" data-ing="${b}">${svgOf(b)}<span>${ING[b].name}</span></button>`)}
            <button class="ib ib-meat" data-ing="et">${svgOf('et')}<span>Et</span></button>
            ${cfg.tops.map((b) => html`<button class="ib" data-ing="${b}">${svgOf(b)}<span>${ING[b].name}</span></button>`)}
            ${cfg.drinks.map((b) => html`<button class="ib ib-drink" data-ing="${b}">${svgOf(b)}<span>${ING[b].name}</span></button>`)}
          </div>
          <div class="dn-acts"><button class="btn" data-act="trash">${icon('trash')}Çöpe</button><button class="btn btn-main" data-act="wrap">${icon('check')}Sar ve Ver</button></div>
        </div>
      </div>`);
    const main = f.main.firstElementChild;
    const q = main.querySelector('[data-queue]');
    st = {
      day, cfg, money: 0, spawned: 0, served: 0, lost: 0, customers: [], nextIn: 1, paused: false, over: false,
      cook: 0.45, meats: 2, trayMax: 4 + up('tray') * 2, wrap: null, burnt: 0, raw: 0, perfect: 0, seed: randInt(0, 999), sliced: 0,
    };
    const game = st;
    const coneEl = main.querySelector('[data-cone]');

    f.onBack = () => {
      game.paused = true;
      pauseSheet({
        onResume: () => { game.paused = false; },
        onRestart: () => startDay(day),
        onQuit: () => menu(),
      });
    };

    // Tepsi ve hazırlık alanı
    const renderTray = () => {
      main.querySelector('[data-meats]').innerHTML = toHTML(html`${Array.from({ length: game.trayMax }, (_, k) => html`<i class="${k < game.meats ? 'on' : ''}"></i>`)}`);
      main.querySelector('[data-tn]').textContent = `${game.meats} porsiyon`;
    };
    const renderWrap = () => {
      const w = game.wrap;
      const el = main.querySelector('[data-wrap]');
      if (!w) {
        el.innerHTML = '<span class="dn-empty">Ekmek seç</span>';
      } else {
        el.innerHTML = toHTML(html`<div class="dn-bread">${svgOf(w.bread, 'big')}</div><div class="dn-stack">${w.items.map((id) => svgOf(id))}</div>${w.drink ? html`<div class="dn-dr">${svgOf(w.drink)}</div>` : ''}`);
      }
      main.querySelector('[data-act="wrap"]').disabled = !w || !w.items.includes('et');
      main.querySelectorAll('[data-ing]').forEach((b) => {
        const id = b.dataset.ing;
        const isBread = BREADS.includes(id);
        const isDrink = DRINKS.includes(id);
        b.classList.toggle('dim', !w && !isBread && !isDrink);
        b.classList.toggle('on', !!(w && (w.items.includes(id) || w.bread === id || w.drink === id)));
      });
    };
    renderTray();
    renderWrap();

    const money = (n) => {
      game.money += n;
      main.querySelector('[data-money]').textContent = `${game.money} ₺`;
      main.querySelector('[data-bar]').style.width = `${Math.min(100, (game.money / cfg.goal) * 100)}%`;
    };
    const updateLeft = () => {
      main.querySelector('[data-left]').textContent = `${Math.max(0, cfg.total - game.served - game.lost)} müşteri`;
    };
    money(0);
    updateLeft();

    // Müşteriler
    const makeOrder = () => {
      const r = rand(0, 1);
      const nTops = Math.min(cfg.tops.length, randInt(Math.min(1, cfg.tops.length), cfg.maxTops));
      const tops = cfg.tops.slice().sort(() => Math.random() - 0.5).slice(0, nTops);
      const drink = cfg.drinks.length && r < 0.45 ? pick(cfg.drinks) : null;
      return { bread: pick(cfg.breads), tops, drink };
    };
    const slotFree = () => {
      const used = new Set(game.customers.map((c) => c.slot));
      return [0, 1, 2].find((s) => !used.has(s));
    };
    const spawn = () => {
      const slot = slotFree();
      if (slot === undefined) return false;
      const order = makeOrder();
      const seed = game.seed + game.spawned * 3 + 1;
      const patience = cfg.patience * (1 + up('tea') * 0.16) * (1 + order.tops.length * 0.08);
      const node = document.createElement('div');
      node.className = 'cust-box';
      node.style.setProperty('--slot', slot);
      node.innerHTML = toHTML(html`
        <div class="bubble"><div class="bb-row">${svgOf(order.bread)}${svgOf('et')}${order.tops.map((t) => svgOf(t))}${order.drink ? svgOf(order.drink) : ''}</div><div class="bb-time"><i></i></div></div>
        ${customer(seed, { mood: 'happy' })}`);
      q.append(node);
      node.animate([{ transform: 'translateX(120%)' }, { transform: 'translateX(-6%)', offset: 0.8 }, { transform: 'none' }], { duration: 420, easing: 'ease-out' });
      game.customers.push({ slot, order, node, t: patience, max: patience, bar: node.querySelector('.bb-time i'), svg: node.querySelector('.blob') });
      game.spawned++;
      sfx.tick(2);
      return true;
    };
    const leave = (c, happy) => {
      game.customers = game.customers.filter((x) => x !== c);
      const n = c.node;
      setMood(c.svg, happy ? 'laugh' : 'sad', happy ? 'happy' : 'open');
      n.querySelector('.bubble').style.visibility = 'hidden';
      const a = n.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${happy ? -120 : 120}%) rotate(${happy ? -6 : 6}deg)`, opacity: 0 }], { duration: 620, delay: 220, easing: 'ease-in', fill: 'forwards' });
      a.finished.then(() => n.remove(), () => n.remove());
    };
    const flyMoney = (c, amount) => {
      const t = document.createElement('div');
      t.className = 'dn-fly';
      t.textContent = `+${amount} ₺`;
      c.node.append(t);
      t.animate([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-50px)', opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' });
    };
    const sameOrder = (o, w) => o.bread === w.bread && (o.drink || null) === (w.drink || null) && o.tops.length === w.items.filter((x) => x !== 'et').length && o.tops.every((x) => w.items.includes(x)) && w.items.includes('et');

    // Malzeme düğmeleri
    local.on(main.querySelector('[data-btns]'), 'click', (e) => {
      const b = e.target.closest('[data-ing]');
      if (!b || game.paused || game.over) return;
      tapIng(b.dataset.ing, b);
    });
    const tapIng = (id, b) => {
      buzz(8);
      if (BREADS.includes(id)) {
        if (game.wrap && game.wrap.items.includes('et')) game.meats = Math.min(game.trayMax, game.meats + 1);
        game.wrap = { bread: id, items: [], drink: game.wrap ? game.wrap.drink : null };
        sfx.tap();
      } else if (DRINKS.includes(id)) {
        if (!game.wrap) game.wrap = { bread: null, items: [], drink: id };
        else game.wrap.drink = game.wrap.drink === id ? null : id;
        sfx.tap();
      } else {
        if (!game.wrap || !game.wrap.bread) {
          sfx.bad();
          if (b) shake(b, 3);
          return;
        }
        if (game.wrap.items.includes(id)) {
          // Geri al
          game.wrap.items = game.wrap.items.filter((x) => x !== id);
          if (id === 'et') game.meats = Math.min(game.trayMax, game.meats + 1);
          sfx.soft();
        } else if (id === 'et') {
          if (game.meats <= 0) {
            sfx.bad();
            shake(main.querySelector('.dn-tray'), 4);
            return;
          }
          game.meats--;
          game.wrap.items.push('et');
          sfx.chop();
        } else {
          game.wrap.items.push(id);
          sfx.chop();
        }
      }
      if (b) pop(b, 1.12);
      renderTray();
      renderWrap();
    };
    local.on(main.querySelector('.dn-acts'), 'click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled || game.paused || game.over) return;
      if (b.dataset.act === 'trash') {
        if (game.wrap && game.wrap.items.includes('et')) game.meats = Math.min(game.trayMax, game.meats + 1);
        game.wrap = null;
        sfx.splat();
        renderTray();
        renderWrap();
      } else serve();
    });
    const serve = () => {
      const w = game.wrap;
      if (!w || !w.bread) return;
      const c = game.customers.filter((x) => sameOrder(x.order, w)).sort((a, b) => a.t - b.t)[0];
      const wrapEl = main.querySelector('[data-wrap]');
      if (!c) {
        sfx.bad();
        buzz(40);
        shake(wrapEl, 6);
        wrapEl.classList.add('wrong');
        local.timeout(() => wrapEl.classList.remove('wrong'), 500);
        return;
      }
      const k = c.t / c.max;
      const price = 12 + c.order.tops.length * 4 + (c.order.drink ? 6 : 0);
      const tip = Math.round(price * k * (0.6 + up('sign') * 0.25));
      const amount = price + tip;
      money(amount);
      game.served++;
      data.total++;
      flyMoney(c, amount);
      sfx.coin();
      sfx.good();
      buzz(20);
      leave(c, true);
      game.wrap = null;
      renderWrap();
      updateLeft();
      checkEnd();
    };

    const checkEnd = () => {
      if (game.over) return;
      if (game.lost >= 3) return finishDay(false);
      if (game.served + game.lost >= cfg.total) return finishDay(true);
      return null;
    };
    const finishDay = (ok) => {
      game.over = true;
      if (game.sizzle) game.sizzle.stop();
      const stars = !ok ? 0 : game.money >= cfg.goal * 1.5 ? 3 : game.money >= cfg.goal ? 2 : 1;
      const prev = data.stars[day - 1] || 0;
      if (stars > prev) data.stars[day - 1] = stars;
      data.cash += game.money;
      api.touch();
      const coins = ok ? 10 + stars * 8 + Math.floor(day / 2) : 4;
      api.finish({ coins });
      const hasNext = day < DAYS;
      resultSheet({
        won: ok,
        title: ok ? `${day}. Gün Bitti` : 'Dükkan Kapandı',
        sub: ok ? (stars === 3 ? 'Kuyruk köşeyi döndü, helal!' : 'Bugünlük kepenk iniyor.') : 'Üç müşteri kaçtı. Yarın daha iyi olur.',
        stars,
        coins,
        stats: [['Kazanç', `${game.money} ₺`], ['Hedef', `${cfg.goal} ₺`], ['Doyan Müşteri', game.served], ['Yanan Et', game.burnt]],
        buttons: [
          ...(ok && hasNext ? [{ label: 'Sonraki Gün', main: true, icon: 'arrow', act: () => startDay(day + 1) }] : []),
          { label: ok ? 'Bu Günü Tekrarla' : 'Tekrar Dene', main: !ok, icon: 'replay', act: () => startDay(day) },
          { label: 'Dükkan', icon: 'plus', act: () => { menu(); shop(); } },
          { label: 'Menü', icon: 'home', act: () => menu() },
        ],
      });
    };

    // 3B döner
    const THREE = await loadThree();
    if (!local.alive) return;
    const canvas = main.querySelector('.dn-3d');
    const { renderer, size, onResize } = makeRenderer(THREE, canvas, local, { alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0.25, 0.6, 9.6);
    camera.lookAt(0.25, 0.05, 0);
    onResize((sz) => {
      camera.aspect = sz.W / sz.H;
      camera.updateProjectionMatrix();
    });
    scene.add(new THREE.HemisphereLight(0xfff0e0, 0x553322, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 3, 4);
    scene.add(sun);
    // Et dokusu: katman katman yatay şeritler
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 256;
    texCanvas.height = 256;
    const tg = texCanvas.getContext('2d');
    const paintTex = () => {
      tg.fillStyle = '#fff';
      tg.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 9) {
        tg.fillStyle = `rgba(90,50,20,${rand(0.12, 0.42)})`;
        tg.fillRect(0, y + rand(-1, 1), 256, rand(2, 5));
      }
      for (let k = 0; k < 40; k++) {
        tg.fillStyle = `rgba(255,240,200,${rand(0.2, 0.5)})`;
        tg.beginPath();
        tg.ellipse(rand(0, 256), rand(0, 256), rand(4, 16), rand(1.5, 4), 0, 0, 7);
        tg.fill();
      }
    };
    paintTex();
    const tex = new THREE.CanvasTexture(texCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const v = k / 16;
      const r = 0.72 + (1 - v) * -0.0 + v * 0.46 + Math.sin(v * 40) * 0.018;
      pts.push(new THREE.Vector2(r, -1.5 + v * 3));
    }
    const coneGeo = new THREE.LatheGeometry(pts, 28);
    const coneMat = toon(THREE, 0xc98a5a, { map: tex });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    const coneInk = new THREE.Mesh(coneGeo, inkMaterial(THREE));
    coneInk.scale.set(1.05, 1.015, 1.05);
    const spit = new THREE.Group();
    spit.add(coneInk, cone);
    scene.add(spit);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 10), toon(THREE, 0xc8d0dc));
    scene.add(rod);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 24), toon(THREE, 0xb8c0cc));
    plate.position.y = -1.56;
    scene.add(plate);
    const plateInk = new THREE.Mesh(plate.geometry, inkMaterial(THREE));
    plateInk.scale.set(1.05, 1.5, 1.05);
    plateInk.position.copy(plate.position);
    scene.add(plateInk);
    // Arkadaki ateş paneli
    const heater = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.4), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55 }));
    heater.position.set(-0.1, 0.1, -2.4);
    scene.add(heater);
    // Bıçak
    const knife = new THREE.Group();
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(1.5, 0.06);
    bladeShape.lineTo(1.5, 0.34);
    bladeShape.quadraticCurveTo(0.5, 0.4, 0, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.03, bevelEnabled: false });
    knife.add(new THREE.Mesh(bladeGeo, toon(THREE, 0xe6ecf4)));
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.1), toon(THREE, 0x3a2d3f));
    grip.position.set(1.8, 0.2, 0);
    knife.add(grip);
    knife.position.set(1.0, 1.4, 1.15);
    knife.rotation.set(0.0, 0.25, -0.25);
    scene.add(knife);
    // Düşen et şeritleri
    const stripGeo = new THREE.BoxGeometry(0.34, 0.09, 0.06);
    const stripMat = toon(THREE, 0xa8602c);
    const strips = [];
    const hit = (burnt, power = 1) => {
      const n = burnt ? 4 : 5 + Math.round(power * 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(stripGeo, burnt ? toon(THREE, 0x2a1a12) : stripMat);
        m.position.set(knife.position.x - 0.5 + rand(-0.2, 0.2), knife.position.y + rand(-0.12, 0.12), 1);
        m.userData = { vy: rand(-0.4, 0.3) - power * 0.5, vx: rand(0.2, 0.9) + power * 0.5, r: rand(-7, 7) * power };
        scene.add(m);
        strips.push(m);
      }
    };

    // Kesim: dönerin üstünde parmağı aşağı çekmek
    const hintEl = main.querySelector('[data-hint]');
    let lastY = 0;
    let lastT = 0;
    let knifeY = 1.4;
    let pressing = false;
    let armed = true;
    let coneShock = 0;
    let cutSpeed = 1;
    // Et bandı: parmak bu çizgiyi aşağı doğru geçtiği anda bıçak eti alır
    const bandY = () => coneEl.clientHeight * 0.5;
    const armY = () => coneEl.clientHeight * 0.34;
    drag(coneEl, local, {
      down: (p) => {
        lastY = p.y;
        lastT = performance.now();
        pressing = true;
        armed = p.y < bandY();
        knifeY = clamp(1.5 - (p.y / coneEl.clientHeight) * 3.2, -1.2, 1.6);
      },
      move: (p) => {
        const now = performance.now();
        const dy = p.y - lastY;
        const ms = Math.max(8, now - lastT);
        knifeY = clamp(1.5 - (p.y / coneEl.clientHeight) * 3.2, -1.2, 1.6);
        const band = bandY();
        if (!armed && p.y < armY()) armed = true;
        if (armed && dy > 0 && lastY <= band && p.y > band) {
          armed = false;
          cutSpeed = clamp((dy / ms) * 0.6, 0.5, 2.4);
          slice(p);
        }
        lastY = p.y;
        lastT = now;
      },
      up: () => { pressing = false; armed = true; },
    });
    // Kesik izi: bıçağın geçtiği yerde bir anlık parıltı
    const slash = (p) => {
      const n = document.createElement('i');
      n.className = 'dn-slash';
      n.style.top = `${(p ? p.y : bandY()) - 3}px`;
      coneEl.append(n);
      n.animate([
        { transform: 'scaleX(.2) translateX(-30%)', opacity: 0 },
        { transform: 'scaleX(1) translateX(0)', opacity: 1, offset: 0.25 },
        { transform: 'scaleX(1.06) translateX(14%)', opacity: 0 },
      ], { duration: 240, easing: 'cubic-bezier(.2,.9,.3,1)' }).finished.then(() => n.remove(), () => n.remove());
    };
    const zone = () => ({ lo: 0.52, hi: 0.95 + up('fire') * 0.09 });
    const slice = (p = null) => {
      if (game.paused || game.over) return;
      coneShock = 1;
      const z = zone();
      const c = game.cook;
      hintEl.style.opacity = 0;
      if (game.meats >= game.trayMax && c >= z.lo && c <= z.hi) {
        sfx.tick(1);
        return;
      }
      if (c < z.lo) {
        game.raw++;
        game.cook = Math.max(0, c - 0.14);
        sfx.bad();
        floatText('Çiğ!', '#ff9fb0');
        buzz(30);
      } else if (c > z.hi) {
        game.burnt++;
        game.cook = Math.max(0.1, c - 0.55);
        sfx.sizzle(0.4);
        sfx.bad();
        floatText('Yandı!', '#ffb45a');
        hit(true, cutSpeed);
        slash(p);
        buzz(30);
      } else {
        const n = 1 + (up('blade') > 0 && Math.random() < 0.35 * up('blade') ? 1 : 0);
        game.meats = Math.min(game.trayMax, game.meats + n);
        game.cook = Math.max(0, c - 0.3);
        game.perfect++;
        game.sliced++;
        sfx.slice(cutSpeed);
        sfx.sizzle(0.12 + cutSpeed * 0.06);
        hit(false, cutSpeed);
        buzz(10 + Math.round(cutSpeed * 8));
        slash(p);
        pop(main.querySelector('.dn-tray'), 1.06);
        renderTray();
      }
    };
    const floatText = (t, c) => {
      const n = document.createElement('div');
      n.className = 'dn-float';
      n.textContent = t;
      n.style.color = c;
      coneEl.append(n);
      n.animate([{ transform: 'translate(-50%,0) scale(.7)', opacity: 1 }, { transform: 'translate(-50%,-44px) scale(1.1)', opacity: 0 }], { duration: 800, easing: 'ease-out', fill: 'forwards' }).finished.then(() => n.remove(), () => n.remove());
    };
    game.slice = slice;
    game.tapIng = tapIng;
    game.serve = serve;

    // Pişme rengi: çiğ pembe, altın, kömür
    const COL = [[0, [224, 150, 130]], [0.55, [208, 138, 74]], [0.95, [170, 96, 44]], [1.35, [46, 28, 20]]];
    const colorFor = (v) => {
      for (let k = 1; k < COL.length; k++) {
        if (v <= COL[k][0]) {
          const [a, ca] = COL[k - 1];
          const [b, cb] = COL[k];
          const t = (v - a) / (b - a);
          return ca.map((x, j) => Math.round(x + (cb[j] - x) * t));
        }
      }
      return COL[COL.length - 1][1];
    };
    const gz = main.querySelector('[data-gz]');
    const gn = main.querySelector('[data-gn]');
    const z0 = zone();
    gz.style.bottom = `${(z0.lo / 1.35) * 100}%`;
    gz.style.height = `${((z0.hi - z0.lo) / 1.35) * 100}%`;
    game.sizzle = steady({ type: 'highpass', f: 5200, q: 0.5 });
    local.add(() => game.sizzle.stop());
    const gate = frameGate();
    local.raf((dt, t) => {
      if (document.hidden) return true;
      const active = !game.paused && !game.over;
      if (active && dt > 0) {
        game.cook = Math.min(1.35, game.cook + dt * 0.14);
        game.nextIn -= dt;
        if (game.nextIn <= 0 && game.spawned < cfg.total) {
          if (spawn()) game.nextIn = cfg.gap * rand(0.8, 1.2);
          else game.nextIn = 0.5;
        }
        for (const c of game.customers.slice()) {
          c.t -= dt;
          const k = c.t / c.max;
          c.bar.style.transform = `scaleX(${Math.max(0, k)})`;
          c.bar.style.background = k > 0.5 ? '#2ed6a0' : k > 0.25 ? '#ffcd3c' : '#ff4f62';
          if (k < 0.33 && c.svg.dataset.mood !== 'sad') setMood(c.svg, 'sad');
          if (c.t <= 0) {
            game.lost++;
            sfx.bad();
            buzz(50);
            shake(main.querySelector('.dn-street'), 5);
            leave(c, false);
            updateLeft();
            checkEnd();
          }
        }
      }
      gn.style.bottom = `${(game.cook / 1.35) * 100}%`;
      const z = zone();
      gn.dataset.state = game.cook < z.lo ? 'raw' : game.cook > z.hi ? 'burn' : 'ok';
      const col = colorFor(game.cook);
      coneMat.color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255, THREE.SRGBColorSpace);
      spit.rotation.y += dt * 1.1;
      heater.material.opacity = 0.45 + Math.sin(t / 130) * 0.08;
      knife.position.y += ((pressing ? knifeY : 1.4) - knife.position.y) * Math.min(1, dt * (pressing ? 46 : 14));
      knife.rotation.z = -0.25 - clamp((knifeY - knife.position.y) * 0.5, -0.35, 0.35);
      if (coneShock > 0) {
        coneShock = Math.max(0, coneShock - dt * 4.5);
        const k = coneShock * coneShock;
        cone.position.x = Math.sin(t / 22) * 0.06 * k;
        cone.rotation.z = Math.sin(t / 26) * 0.05 * k;
      } else if (cone.position.x) {
        cone.position.x = 0;
        cone.rotation.z = 0;
      }
      for (let k = strips.length - 1; k >= 0; k--) {
        const m = strips[k];
        m.userData.vy -= 9 * dt;
        m.position.y += m.userData.vy * dt;
        m.position.x += m.userData.vx * dt;
        m.rotation.z += m.userData.r * dt;
        if (m.position.y < -2.6) {
          scene.remove(m);
          strips.splice(k, 1);
        }
      }
      if (gate()) renderer.render(scene, camera);
      return true;
    });
    popIn(coneEl);
  }

  menu();
  return {
    unmount() {
      endPlay();
      life.dispose();
      f.dispose();
    },
    get st() { return st; },
    startDay,
    data,
  };
}

