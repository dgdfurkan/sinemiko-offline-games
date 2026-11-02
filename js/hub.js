// Ana ekran: tren penceresi, oyun biletleri, günlük görevler, dolap, ayarlar

import { html, raw, toHTML, Life, seeded, fitCanvas, rand, pick } from './core/dom.js';
import { save, today } from './core/save.js';
import { sfx, syncVolumes, buzz } from './core/audio.js';
import { icon, coinSVG, openSheet, toast, askSheet } from './core/ui.js';
import { blob, ITEMS, SLOT_NAMES, DEFAULT_WORN, setMood } from './core/avatar.js';
import { confetti, popIn, pop } from './core/fx.js';
import { GAMES, GROUPS, gameById } from './registry.js';
import { ART } from './art.js';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

/* ---------- Görevler ---------- */

const STOPS = [
  { mins: 20, name: 'Çay Durağı', coins: 30 },
  { mins: 60, name: 'Simit Molası', coins: 50 },
  { mins: 120, name: 'Yarı Yol Köprüsü', coins: 80 },
  { mins: 180, name: 'Manzara Virajı', coins: 110 },
  { mins: 240, name: 'Son Durak', coins: 200 },
];

function dailyTasks() {
  const r = seeded(Number(today().replace(/-/g, '')));
  const games = r.shuffle(GAMES.slice());
  return [
    { id: 'g1', kind: 'round', game: games[0].id, n: 1, coins: 40, text: `${games[0].title}: bir tur bitir` },
    { id: 'g2', kind: 'round', game: games[1].id, n: 2, coins: 60, text: `${games[1].title}: iki tur bitir` },
    { id: 'c', kind: 'coins', n: r.pick([80, 120, 160]), coins: 50, text: null },
    { id: 'g3', kind: 'round', game: games[2].id, n: 1, coins: 40, text: `${games[2].title}: bir tur bitir` },
  ];
}
const taskValue = (t, d) => (t.kind === 'round' ? d.rounds[t.game] || 0 : d.earned || 0);

const fmtTime = (secs) => {
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} dk`;
  return `${Math.floor(m / 60)} sa ${m % 60} dk`;
};

/* ---------- Pencere manzarası ---------- */

function skyColors(h) {
  // Gerçek saate göre gökyüzü
  if (h < 5 || h >= 21) return { top: '#141338', mid: '#2a2560', low: '#4a3a7a', hill: ['#2a2556', '#1f1c45', '#16143a'], star: 1, sun: null, moon: true };
  if (h < 7.5) return { top: '#5a4b9a', mid: '#ff9d8a', low: '#ffd59a', hill: ['#7a6fa8', '#5f5a94', '#46437c'], star: 0.2, sun: '#ffdf8a' };
  if (h < 17) return { top: '#6cc4ff', mid: '#a8e0ff', low: '#e6f8ff', hill: ['#8fd68a', '#6cc46a', '#4fa858'], star: 0, sun: '#fff2a8' };
  if (h < 19.5) return { top: '#6f6bc4', mid: '#ff9f7a', low: '#ffd27a', hill: ['#c98f7a', '#a06f7a', '#7a5478'], star: 0.1, sun: '#ffb45a' };
  return { top: '#2a2560', mid: '#6a4a8f', low: '#c9708f', hill: ['#5a4a7f', '#433a6c', '#2f2a58'], star: 0.6, sun: null, moon: true };
}

function windowScene(canvas, life) {
  const s = fitCanvas(canvas, life, null, 1.5);
  const now = new Date();
  const c = skyColors(now.getHours() + now.getMinutes() / 60);
  const stars = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: rand(0.5, 1.6), t: rand(0, 6) }));
  const clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 0.3 + rand(0, 0.2), y: rand(0.08, 0.34), k: rand(0.7, 1.3) }));
  const props = Array.from({ length: 7 }, (_, i) => ({ x: i / 7 + rand(-0.04, 0.04), kind: pick(['tree', 'tree', 'bush', 'house']) }));
  let off = 0;
  let acc = 0;
  const hill = (x, a, b, c1) => Math.sin(x * a + c1) * 0.6 + Math.sin(x * b + c1 * 2) * 0.4;
  life.raf((dt, t) => {
    // Ana ekranda pil için saniyede 20 kare yeter
    acc += dt;
    if (acc < 0.05) return true;
    const step = acc;
    acc = 0;
    off += step;
    const { g, W, H } = s;
    if (!W) return true;
    s.begin();
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, c.top);
    sky.addColorStop(0.6, c.mid);
    sky.addColorStop(1, c.low);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    if (c.star) {
      g.fillStyle = '#fff';
      for (const st of stars) {
        g.globalAlpha = c.star * (0.5 + 0.5 * Math.sin(t / 700 + st.t));
        g.beginPath();
        g.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (c.sun) {
      g.fillStyle = c.sun;
      g.beginPath();
      g.arc(W * 0.76, H * 0.3, H * 0.13, 0, Math.PI * 2);
      g.fill();
    }
    if (c.moon) {
      g.fillStyle = '#fff6d6';
      g.beginPath();
      g.arc(W * 0.76, H * 0.26, H * 0.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c.top;
      g.beginPath();
      g.arc(W * 0.79, H * 0.23, H * 0.085, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffffb0';
    for (const cl of clouds) {
      const x = ((cl.x - off * 0.006 * cl.k) % 1.3 + 1.3) % 1.3 - 0.15;
      const px = x * W;
      const py = cl.y * H;
      const r = H * 0.05 * cl.k;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.arc(px + r * 1.2, py + r * 0.2, r * 0.8, 0, Math.PI * 2);
      g.arc(px - r * 1.2, py + r * 0.25, r * 0.7, 0, Math.PI * 2);
      g.fill();
    }
    // Üç kat tepe: yakındaki hızlı akar
    [[0.62, 0.012, 0.03, 0.04], [0.74, 0.03, 0.05, 0.1], [0.86, 0.07, 0.035, 0.28]].forEach(([base, amp, freq, speed], li) => {
      g.fillStyle = c.hill[li];
      g.beginPath();
      g.moveTo(0, H);
      const o = off * speed * 60;
      for (let x = 0; x <= W; x += 6) g.lineTo(x, H * (base - amp * 2 * hill(x + o, freq / 3, freq, li * 1.7)));
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    });
    // Yakın ağaçlar ve evler
    const speed = 0.22;
    for (const p of props) {
      const x = (((p.x - off * speed) % 1.2) + 1.2) % 1.2 - 0.1;
      const px = x * W;
      const py = H * 0.9;
      const u = H * 0.09;
      if (p.kind === 'house') {
        g.fillStyle = c.star ? '#2a2556' : '#fff0d6';
        g.fillRect(px - u * 0.7, py - u * 0.9, u * 1.4, u * 0.9);
        g.fillStyle = c.star ? '#16143a' : '#e0663a';
        g.beginPath();
        g.moveTo(px - u, py - u * 0.9);
        g.lineTo(px, py - u * 1.6);
        g.lineTo(px + u, py - u * 0.9);
        g.fill();
        g.fillStyle = c.star ? '#ffd76a' : '#7ec8ff';
        g.fillRect(px - u * 0.2, py - u * 0.65, u * 0.4, u * 0.35);
      } else {
        g.fillStyle = c.hill[2];
        g.fillRect(px - 2, py - u * 0.5, 4, u * 0.5);
        g.beginPath();
        g.arc(px, py - u * (p.kind === 'tree' ? 1 : 0.4), u * (p.kind === 'tree' ? 0.6 : 0.42), 0, Math.PI * 2);
        g.fill();
      }
    }
    // Telgraf direkleri çok hızlı geçer
    const pole = ((off * 0.75) % 1.4) * W * 1.1 - W * 0.15;
    g.fillStyle = '#2a1636';
    g.fillRect(W - pole, H * 0.22, 5, H * 0.78);
    g.fillRect(W - pole - 12, H * 0.28, 29, 4);
    return true;
  });
}

/* ---------- Sekmeler ---------- */

function gamesTab() {
  return html`
    <div class="tab-games">
      ${GROUPS.map(([gid, gname]) => html`
        <h2 class="grp-title">${gname}</h2>
        <div class="grp-grid">${GAMES.filter((g) => g.group === gid).map((g) => {
          const gs = save.get('games')[g.id] || {};
          const best = gs.stars ? gs.stars.reduce((a, b) => a + (b || 0), 0) : 0;
          return html`<button class="ticket ${g.dark ? 'ticket-dark' : ''}" data-game="${g.id}" style="--tc:${g.card}">
            <span class="tk-art">${raw(ART[g.id] || '')}</span>
            <span class="tk-title">${g.title}</span>
            <span class="tk-tag">${g.tag}</span>
            ${best ? html`<span class="tk-stars">${icon('star')}${best}</span>` : ''}
          </button>`;
        })}</div>`)}
    </div>`;
}

function tasksTab() {
  const d = save.day();
  const tasks = dailyTasks();
  const mins = d.secs / 60;
  return html`
    <div class="tab-tasks">
      <section class="card route-card">
        <h2 class="card-h">Bugünkü Yolculuk</h2>
        <p class="route-time"><b>${fmtTime(d.secs)}</b> oynadın</p>
        <div class="route">
          <div class="route-line"><i style="width:${Math.min(100, (mins / 240) * 100)}%"></i></div>
          ${STOPS.map((s) => {
            const reached = mins >= s.mins;
            const claimed = d.stops.includes(s.mins);
            return html`<div class="stop ${reached ? 'on' : ''} ${claimed ? 'claimed' : ''}" style="left:${(s.mins / 240) * 100}%"><i></i></div>`;
          })}
        </div>
        <div class="stop-list">${STOPS.map((s) => {
          const reached = mins >= s.mins;
          const claimed = d.stops.includes(s.mins);
          return html`<div class="task-row ${claimed ? 'done' : ''}">
            <span class="task-text"><b>${s.name}</b><small>${s.mins < 60 ? `${s.mins} dakika` : `${s.mins / 60} saat`}</small></span>
            ${claimed ? html`<span class="task-ok">${icon('check')}</span>` : html`<button class="btn btn-small ${reached ? 'btn-main' : ''}" data-stop="${s.mins}" ${reached ? '' : raw('disabled')}>${coinSVG()}${s.coins}</button>`}
          </div>`;
        })}</div>
      </section>
      <section class="card">
        <h2 class="card-h">Bugünün Görevleri</h2>
        ${tasks.map((t) => {
          const v = taskValue(t, d);
          const ok = v >= t.n;
          const claimed = d.claimed.includes(t.id);
          const text = t.text || `Bugün ${t.n} altın kazan`;
          return html`<div class="task-row ${claimed ? 'done' : ''}">
            <span class="task-text"><b>${text}</b><small>${Math.min(v, t.n)} / ${t.n}</small></span>
            ${claimed ? html`<span class="task-ok">${icon('check')}</span>` : html`<button class="btn btn-small ${ok ? 'btn-main' : ''}" data-task="${t.id}" ${ok ? '' : raw('disabled')}>${coinSVG()}${t.coins}</button>`}
          </div>`;
        })}
      </section>
    </div>`;
}

function wardrobeTab(slot) {
  const w = save.get('wardrobe');
  const worn = { ...DEFAULT_WORN, ...w.worn };
  const owned = new Set(w.owned);
  return html`
    <div class="tab-ward">
      <div class="ward-stage">${blob(1, { mood: 'happy', worn, cls: 'ward-blob' })}</div>
      <div class="ward-slots">${Object.entries(SLOT_NAMES).map(([k, v]) => html`<button class="chip ${k === slot ? 'on' : ''}" data-slot="${k}">${v}</button>`)}</div>
      <div class="ward-grid">${ITEMS[slot].map((it) => {
        const has = it.price === 0 || owned.has(it.id);
        const on = worn[slot] === it.id;
        return html`<button class="ward-item ${on ? 'on' : ''}" data-item="${it.id}">
          <span class="wi-prev">${blob(1, { mood: 'happy', worn: { ...worn, [slot]: it.id }, hands: false })}</span>
          <span class="wi-name">${it.name}</span>
          ${has ? html`<span class="wi-tag">${on ? 'Takılı' : 'Tak'}</span>` : html`<span class="wi-price">${coinSVG()}${it.price}</span>`}
        </button>`;
      })}</div>
    </div>`;
}

const toggle = (key, label, sub = '') => html`
  <div class="set-row"><span class="set-text"><b>${label}</b>${sub ? html`<small>${sub}</small>` : ''}</span>
    <button class="switch ${save.get(key) ? 'on' : ''}" data-set="${key}" role="switch" aria-checked="${String(!!save.get(key))}" aria-label="${label}"><i></i></button>
  </div>`;

function settingsTab(off) {
  const st = off.state;
  return html`
    <div class="tab-set">
      <section class="card">
        <h2 class="card-h">Ses ve His</h2>
        ${toggle('sound', 'Ses Efektleri')}
        ${toggle('music', 'Müzik')}
        ${toggle('haptic', 'Titreşim', 'Destekleyen telefonlarda')}
        ${toggle('eco', 'Pil Dostu', 'Uzun yolda şarjı korur: 3B çizimi hafifletir')}
      </section>
      <section class="card">
        <h2 class="card-h">İnternetsiz Oynama</h2>
        <p class="set-status" data-off>${offlineText(off)}</p>
        <button class="btn" data-install="1">${icon('phone')}Ana Ekrana Ekleme Rehberi</button>
        ${st === 'error' ? html`<p class="set-note">Dosyalar inemedi. İnternete bağlıyken sayfayı yenile.</p>` : ''}
      </section>
      <section class="card">
        <h2 class="card-h">Kayıt</h2>
        <p class="set-note">İlerlemen yalnızca bu telefonda saklanır. Uygulamayı ana ekrandan silersen kayıt da silinir.</p>
        <button class="btn btn-danger-ghost" data-reset="1">${icon('trash')}İlerlemeyi Sıfırla</button>
      </section>
    </div>`;
}

const offlineText = (off) => {
  if (off.state === 'ready') return 'Hazır: bütün oyunlar telefona indi, internet gerekmez.';
  if (off.state === 'loading' && off.total) return `Oyunlar iniyor: %${Math.round((off.done / off.total) * 100)}. Bitene kadar internet açık kalsın.`;
  if (off.state === 'none') return 'Bu tarayıcı çevrimdışı kurulumu desteklemiyor. Safari ya da Chrome ile aç.';
  if (off.state === 'error') return 'İndirme tamamlanamadı.';
  return 'Oyunlar hazırlanıyor...';
};

function installSheet() {
  const ios = isIOS();
  const steps = ios
    ? ['Bu sayfayı Safari ile aç.', html`Alttaki Paylaş düğmesine dokun ${icon('share', 'ic-inline')}.`, html`Listeden <b>Ana Ekrana Ekle</b> seçeneğini bul.`, html`Sağ üstteki <b>Ekle</b>'ye dokun. Artık Sinemiko Yolda ana ekranında.`, 'İlk açılışta "Hazır" yazısını gördüysen internet kapalıyken de açılır.']
    : ['Bu sayfayı Chrome ile aç.', 'Sağ üstteki üç noktaya dokun.', html`<b>Ana ekrana ekle</b> ya da <b>Uygulamayı yükle</b> seçeneğini seç.`, 'Ana ekrandaki simgeden aç. "Hazır" yazısını gördüysen internet kapalıyken de açılır.'];
  openSheet(html`
    <h2 class="sh-title">Ana Ekrana Ekle</h2>
    <ol class="how">${steps.map((t, i) => html`<li><b>${i + 1}</b><span>${t}</span></li>`)}</ol>
    ${deferredPrompt ? html`<button class="btn btn-main btn-big" data-act="native">${icon('plus')}Şimdi Ekle</button>` : ''}
    <button class="btn" data-act="ok">Tamam</button>`, {
    actions: {
      ok: (c) => c(),
      native: async (c) => {
        c();
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt = null;
        }
      },
    },
  });
}

function welcomeSheet() {
  openSheet(html`
    <div class="wel-blob">${blob(1, { mood: 'laugh', eyes: 'happy' })}</div>
    <h2 class="sh-title">Hoş Geldin Sinem</h2>
    <p class="sh-text">Trende sıkılma diye bu kutuyu hazırladım. Bir kere ana ekrana ekleyince internet istemez, tüneller umurunda olmaz. Kazandığın altınlarla dolaptan yeni şeyler alırsın.</p>
    <p class="wel-sign">Furkan</p>
    <button class="btn btn-main btn-big" data-act="ok">Yola Çıkalım</button>
    ${isStandalone() ? '' : html`<button class="btn" data-act="add">${icon('phone')}Ana Ekrana Nasıl Eklerim?</button>`}`, {
    dismiss: false,
    actions: {
      ok: (c) => c(),
      add: (c) => { c(); installSheet(); },
    },
  });
}

export function mountHub(root, { offline, onOffline }) {
  const life = new Life();
  let tab = 'games';
  let slot = 'hat';
  const worn = () => ({ ...DEFAULT_WORN, ...save.get('wardrobe').worn });
  root.innerHTML = toHTML(html`
    <section class="hub">
      <header class="hub-top">
        <div class="hub-window">
          <canvas class="hub-sky"></canvas>
          <div class="win-frame"></div>
          <div class="hub-brand"><b>Sinemiko</b><span>Yolda</span></div>
          <div class="hub-sinem" data-sinem>${blob(1, { mood: 'happy', worn: worn() })}</div>
          <div class="hub-cup"><svg viewBox="0 0 40 44"><path d="M8 14h20l-2 26H10z" fill="#ffffffcc" stroke="#2a1636" stroke-width="2.500"/><path d="M10 20h16l-1.500 18h-13z" fill="#b5331e"/><path d="M14 8q-3-3 0-6M22 8q-3-3 0-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg></div>
        </div>
        <div class="hub-bar">
          <span class="coin-chip" data-coins>${coinSVG()}<b>${save.get('coins')}</b></span>
          <button class="off-chip" data-offchip>${offChip(offline)}</button>
        </div>
      </header>
      <main class="hub-main" data-main></main>
      <nav class="hub-nav">
        ${[['games', 'ticket', 'Oyunlar'], ['tasks', 'list', 'Görevler'], ['ward', 'shirt', 'Dolap'], ['set', 'gear', 'Ayarlar']].map(([id, ic, t]) => html`<button class="nav-b ${id === 'games' ? 'on' : ''}" data-tab="${id}">${icon(ic)}<span>${t}</span></button>`)}
      </nav>
    </section>`);
  const sec = root.firstElementChild;
  const main = sec.querySelector('[data-main]');
  windowScene(sec.querySelector('.hub-sky'), life);

  const pending = () => {
    const d = save.day();
    const mins = d.secs / 60;
    const a = STOPS.filter((s) => mins >= s.mins && !d.stops.includes(s.mins)).length;
    const b = dailyTasks().filter((t) => taskValue(t, d) >= t.n && !d.claimed.includes(t.id)).length;
    return a + b;
  };
  const updateBadge = () => {
    const n = pending();
    const b = sec.querySelector('[data-tab="tasks"]');
    let dot = b.querySelector('.nav-dot');
    if (n && !dot) {
      dot = document.createElement('i');
      dot.className = 'nav-dot';
      b.append(dot);
    }
    if (dot) {
      if (n) dot.textContent = n;
      else dot.remove();
    }
  };

  function render() {
    const scroll = main.scrollTop;
    const tpl = tab === 'games' ? gamesTab() : tab === 'tasks' ? tasksTab() : tab === 'ward' ? wardrobeTab(slot) : settingsTab(offline);
    main.innerHTML = toHTML(tpl);
    main.scrollTop = scroll;
    updateBadge();
  }
  function switchTab(next) {
    tab = next;
    main.scrollTop = 0;
    sec.querySelectorAll('.nav-b').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    render();
    main.firstElementChild.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22,1,.36,1)' });
    if (tab === 'games') main.querySelectorAll('.ticket').forEach((n, i) => popIn(n, i * 22));
  }

  life.on(sec, 'click', async (e) => {
    const nav = e.target.closest('[data-tab]');
    if (nav) {
      sfx.tap();
      buzz(8);
      switchTab(nav.dataset.tab);
      return;
    }
    const card = e.target.closest('[data-game]');
    if (card) {
      sfx.tap();
      buzz(8);
      location.hash = `#/oyun/${card.dataset.game}`;
      return;
    }
    if (e.target.closest('[data-offchip]') || e.target.closest('[data-install]')) {
      sfx.tap();
      if (offline.update && e.target.closest('[data-offchip]') && offline.applyUpdate) {
        offline.applyUpdate();
        return;
      }
      installSheet();
      return;
    }
    const sinem = e.target.closest('[data-sinem]');
    if (sinem) {
      const b = sinem.querySelector('.blob');
      setMood(b, 'laugh', 'happy');
      sfx.pop(1.2);
      pop(sinem, 1.12);
      life.timeout(() => setMood(b, 'happy', 'open'), 1200);
      return;
    }
    const stop = e.target.closest('[data-stop]');
    if (stop && !stop.disabled) {
      const m = Number(stop.dataset.stop);
      const s = STOPS.find((x) => x.mins === m);
      const d = save.day();
      if (!d.stops.includes(m)) {
        d.stops.push(m);
        save.addCoins(s.coins);
        sfx.coin();
        sfx.good();
        confetti({ n: 50 });
        render();
      }
      return;
    }
    const task = e.target.closest('[data-task]');
    if (task && !task.disabled) {
      const t = dailyTasks().find((x) => x.id === task.dataset.task);
      const d = save.day();
      if (t && !d.claimed.includes(t.id)) {
        d.claimed.push(t.id);
        // Görev ödülü, altın görevini kendisi ilerletmesin diye earned'e eklenmez
        const before = d.earned;
        save.addCoins(t.coins);
        d.earned = before;
        save.touch();
        sfx.coin();
        sfx.good();
        render();
      }
      return;
    }
    const sl = e.target.closest('[data-slot]');
    if (sl) {
      sfx.tap();
      slot = sl.dataset.slot;
      render();
      return;
    }
    const item = e.target.closest('[data-item]');
    if (item) {
      const it = ITEMS[slot].find((x) => x.id === item.dataset.item);
      const w = save.get('wardrobe');
      const has = it.price === 0 || w.owned.includes(it.id);
      if (!has) {
        if (save.get('coins') < it.price) {
          sfx.bad();
          buzz(30);
          toast(`${it.price - save.get('coins')} altın daha lazım. Oyunlardan kazanabilirsin.`);
          return;
        }
        const yes = await askSheet({ title: it.name, text: `${it.price} altına alınsın mı?`, yes: 'Satın Al' });
        if (!yes || !life.alive) return;
        save.addCoins(-it.price);
        w.owned.push(it.id);
        sfx.coin();
      }
      w.worn = { ...w.worn, [slot]: it.id };
      save.set('wardrobe', w);
      sfx.pop(1.3);
      render();
      sec.querySelector('[data-sinem]').innerHTML = toHTML(blob(1, { mood: 'laugh', eyes: 'happy', worn: worn() }));
      pop(sec.querySelector('.ward-blob'), 1.1);
      pop(sec.querySelector('[data-sinem]'), 1.15);
      return;
    }
    const set = e.target.closest('[data-set]');
    if (set) {
      const k = set.dataset.set;
      const v = !save.get(k);
      save.set(k, v);
      syncVolumes();
      sfx.tap();
      set.classList.toggle('on', v);
      set.setAttribute('aria-checked', String(v));
      return;
    }
    if (e.target.closest('[data-reset]')) {
      sfx.tap();
      const yes = await askSheet({ title: 'Her Şey Silinsin mi?', text: 'Altınlar, yıldızlar ve dolap sıfırlanır. Geri alınamaz.', yes: 'Sil', danger: true });
      if (yes) {
        save.reset();
        location.reload();
      }
    }
  });

  const unsub = save.subscribe((k) => {
    if (k === 'coins') sec.querySelector('[data-coins] b').textContent = save.get('coins');
  });
  life.add(unsub);
  life.add(onOffline((o) => {
    sec.querySelector('[data-offchip]').innerHTML = toHTML(offChip(o));
    if (tab === 'set') {
      const n = main.querySelector('[data-off]');
      if (n) n.textContent = offlineText(o);
    }
  }));
  life.interval(updateBadge, 15000);

  render();
  main.querySelectorAll('.ticket').forEach((n, i) => popIn(n, i * 22));
  // Kart çizimleri sırayla canlanır; hepsi aynı anda oynamaz, pil gitmesin
  life.interval(() => {
    const list = [...main.querySelectorAll('.ticket:not(.play)')];
    if (!list.length) return;
    const c = pick(list);
    c.classList.add('play');
    life.timeout(() => c.classList.remove('play'), 3600);
  }, 1400);
  if (!save.get('welcomed')) {
    save.set('welcomed', true);
    life.timeout(welcomeSheet, 600);
  }
  return { unmount: () => life.dispose(), gameById };
}

function offChip(o) {
  if (o.update) return html`${icon('replay')}<span>Yenilik Var</span>`;
  if (o.state === 'ready') return html`<i class="dot ok"></i><span>İnternetsiz Hazır</span>`;
  if (o.state === 'loading' && o.total) return html`<i class="dot"></i><span>%${Math.round((o.done / o.total) * 100)} İniyor</span>`;
  return html`<i class="dot"></i><span>Hazırlanıyor</span>`;
}

