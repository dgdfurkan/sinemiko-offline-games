// Ortak arayüz: üst çubuk, oyun menüsü, seviye ızgarası, sonuç penceresi, alt pencere, tost

import { html, raw, toHTML, el } from './dom.js';
import { save } from './save.js';
import { sfx, syncVolumes, buzz } from './audio.js';
import { music } from './music.js';
import { confetti, popIn } from './fx.js';

const IC = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M4 11.2 12 4l8 7.2V20h-5.2v-5.6H9.2V20H4z"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3.4"/>',
  play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" fill="currentColor"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 3.8v4.6h4.6"/>',
  arrow: '<path d="M5 12h13.5M13 6l6 6-6 6"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.6 4.5L19 7.2"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.9 2.2c-.9.6-1.4 1.1-1.4 2.3"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>',
  hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  ticket: '<path d="M3.5 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6.5v2M14 11v2M14 15.5v2"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M3.8 6.5l1 1 1.8-2M3.8 12l1 1 1.8-2M3.8 17.5l1 1 1.8-2"/>',
  shirt: '<path d="M8 4 3.5 7l2 4L8 10v10h8V10l2.5 1 2-4L16 4c-.6 1.6-2.2 2.6-4 2.6S8.600 5.600 8 4z"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.500h2"/>',
  share: '<path d="M12 15V4M8 7.500 12 3.500l4 4"/><path d="M7 11H5.500v9.500h13V11H17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13"/>',
};

export const icon = (name, cls = '') => raw(`<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name] || ''}</svg>`);

export const coinSVG = () => raw('<svg class="coin-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.500" fill="#ffcd3c" stroke="#2a1636" stroke-width="2.400"/><circle cx="12" cy="12" r="5.800" fill="none" stroke="#e29a10" stroke-width="1.800"/><path d="M12 8.500 13.100 11h2.600l-2.100 1.600.8 2.600L12 13.700l-2.300 1.500.8-2.600L8.400 11H11z" fill="#e29a10"/></svg>');

/* ---------- Alt pencere ve tost ---------- */

let sheets = 0;
const openCloses = new Set();
export const sheetOpen = () => sheets > 0;
// Oyun değişince açık kalan pencereler kapansın, yeni ekranın üstünde durmasın
export function closeSheets() {
  for (const fn of [...openCloses]) fn();
  openCloses.clear();
  sheets = 0;
  const root = document.getElementById('overlays');
  if (root) root.querySelectorAll('.sheet-back, .toast').forEach((n) => n.remove());
}

export function openSheet(tpl, { actions = {}, dismiss = true, onClose = null, cls = '' } = {}) {
  const back = el(html`<div class="sheet-back"><div class="sheet ${cls}" role="dialog" aria-modal="true">${tpl}</div></div>`);
  const sheet = back.firstElementChild;
  document.getElementById('overlays').append(back);
  sheets++;
  back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
  sheet.animate([{ transform: 'translateY(40px) scale(.94)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  let closed = false;
  const close = (value) => {
    if (closed) return;
    closed = true;
    openCloses.delete(close);
    sheets--;
    back.style.pointerEvents = 'none';
    const a = back.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' });
    a.finished.then(() => back.remove(), () => back.remove());
    if (onClose) onClose(value);
  };
  openCloses.add(close);
  back.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (t && sheet.contains(t)) {
      if (t.disabled) return;
      sfx.tap();
      buzz(8);
      const fn = actions[t.dataset.act];
      if (fn) fn(close, t, e);
      return;
    }
    if (e.target === back && dismiss) close();
  });
  return { el: sheet, close };
}

export function toast(text, { ms = 2400 } = {}) {
  const t = el(html`<div class="toast">${text}</div>`);
  document.getElementById('overlays').append(t);
  t.animate([{ transform: 'translate(-50%, 20px)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  setTimeout(() => {
    const a = t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    a.finished.then(() => t.remove(), () => t.remove());
  }, ms);
}

export function askSheet({ title, text, yes = 'Evet', no = 'Vazgeç', danger = false }) {
  return new Promise((resolve) => {
    openSheet(html`
      <h2 class="sh-title">${title}</h2>
      ${text ? html`<p class="sh-text">${text}</p>` : ''}
      <div class="sh-row">
        <button class="btn" data-act="no">${no}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-main'}" data-act="yes">${yes}</button>
      </div>`, {
      actions: {
        yes: (close) => { resolve(true); close(true); },
        no: (close) => { resolve(false); close(false); },
      },
      onClose: () => resolve(false),
    });
  });
}

/* ---------- Oyun çerçevesi ---------- */

// Üstte geri düğmesi, başlık, altın, ses. onBack: oyun içi geri davranışı
export function frame(root, game, { title = game.title, onBack } = {}) {
  root.innerHTML = toHTML(html`
    <section class="g g-${game.id}">
      <header class="g-top">
        <button class="rbtn" data-top="back" aria-label="Geri">${icon('back')}</button>
        <h1 class="g-title" data-title>${title}</h1>
        <span class="coin-chip" data-coins>${coinSVG()}<b>${save.get('coins')}</b></span>
        <button class="rbtn" data-top="sound" aria-label="Ses">${icon(save.get('sound') ? 'sound' : 'mute')}</button>
      </header>
      <main class="g-main"></main>
    </section>`);
  const sec = root.firstElementChild;
  const f = {
    root: sec,
    main: sec.querySelector('.g-main'),
    onBack,
    setTitle(t) { sec.querySelector('[data-title]').textContent = t; },
    setCoins() { sec.querySelector('[data-coins] b').textContent = save.get('coins'); },
  };
  sec.querySelector('.g-top').addEventListener('click', (e) => {
    const b = e.target.closest('[data-top]');
    if (!b) return;
    sfx.tap();
    if (b.dataset.top === 'back') {
      if (f.onBack) f.onBack();
    } else {
      const on = !save.get('sound');
      save.set('sound', on);
      save.set('music', on);
      syncVolumes();
      b.innerHTML = toHTML(icon(on ? 'sound' : 'mute'));
    }
  });
  const unsub = save.subscribe((k) => { if (k === 'coins') f.setCoins(); });
  f.dispose = unsub;
  return f;
}

export const starsHTML = (n, total = 3, cls = '') => html`<span class="stars ${cls}">${Array.from({ length: total }, (_, i) => html`<i class="${i < n ? 'on' : ''}">${icon('star')}</i>`)}</span>`;

/* ---------- Oyun menüsü: başlık, nasıl oynanır, seviyeler ---------- */

export function howSheet(game, lines) {
  openSheet(html`
    <h2 class="sh-title">Nasıl Oynanır?</h2>
    <ol class="how">${lines.map((t, i) => html`<li><b>${i + 1}</b><span>${t}</span></li>`)}</ol>
    <button class="btn btn-main" data-act="ok">Anladım</button>`, {
    actions: { ok: (close) => close() },
  });
}

// levels: { total, stars: [], onPick(i) } açık olan: son geçilenin bir fazlası
export function menuScreen(main, game, { art = '', sub = '', stats = [], how = null, buttons = [], levels = null, extra = '' }) {
  main.innerHTML = toHTML(html`
    <div class="menu ${levels ? '' : 'menu-solo'}">
      <div class="menu-head">
        ${art ? html`<div class="menu-art">${raw(art)}</div>` : ''}
        ${sub ? html`<p class="menu-sub">${sub}</p>` : ''}
      </div>
      ${stats.length ? html`<div class="menu-stats">${stats.map(([k, v]) => html`<span class="stat"><b>${v}</b>${k}</span>`)}</div>` : ''}
      ${extra}
      <div class="menu-btns">
        ${buttons.map((b, i) => html`<button class="btn ${b.main ? 'btn-main btn-big' : ''}" data-mb="${i}">${b.icon ? icon(b.icon) : ''}${b.label}</button>`)}
        ${how ? html`<button class="btn btn-ghost" data-how="1">${icon('help')}Nasıl Oynanır?</button>` : ''}
      </div>
      ${levels ? levelGridHTML(levels) : ''}
    </div>`);
  const root = main.firstElementChild;
  root.addEventListener('click', (e) => {
    const lv = e.target.closest('[data-level]');
    if (lv) {
      if (lv.classList.contains('locked')) {
        sfx.bad();
        buzz(20);
        return;
      }
      sfx.tap();
      levels.onPick(Number(lv.dataset.level));
      return;
    }
    const mb = e.target.closest('[data-mb]');
    if (mb) {
      sfx.tap();
      buttons[Number(mb.dataset.mb)].act();
      return;
    }
    if (e.target.closest('[data-how]')) {
      sfx.tap();
      howSheet(game, how);
    }
  });
  root.querySelectorAll('.lv').forEach((n, i) => { if (i < 24) popIn(n, i * 18); });
  // Sıradaki seviyeyi göster
  const cur = root.querySelector('.lv.current');
  if (cur && cur.offsetTop > root.clientHeight * 0.5) cur.scrollIntoView({ block: 'center' });
  return root;
}

export const levelGridHTML = ({ total, stars = [], unlocked = null, title = 'Seviyeler' }) => {
  const open = unlocked ?? Math.min(total - 1, stars.filter((s) => s > 0).length);
  return html`
    <div class="lv-wrap">
      <h3 class="lv-title">${title}</h3>
      <div class="lv-grid">${Array.from({ length: total }, (_, i) => {
        const locked = i > open;
        const s = stars[i] || 0;
        return html`<button class="lv ${locked ? 'locked' : ''} ${i === open ? 'current' : ''} ${s ? 'done' : ''}" data-level="${i}" aria-label="Seviye ${i + 1}">
          ${locked ? icon('lock') : html`<b>${i + 1}</b>`}
          ${locked ? '' : starsHTML(s)}
        </button>`;
      })}</div>
    </div>`;
};

/* ---------- Sonuç ---------- */

// Yıldızlar birer birer çakar, altın sayılır. buttons: [{label, act, main}]
export function resultSheet({ won = true, title, sub = '', stars = null, coins = 0, stats = [], buttons = [] }) {
  const { el: sheet, close } = openSheet(html`
    ${stars !== null ? html`<div class="res-stars">${[0, 1, 2].map((i) => html`<i data-s="${i}">${icon('star')}</i>`)}</div>` : ''}
    <h2 class="sh-title res-title">${title}</h2>
    ${sub ? html`<p class="sh-text">${sub}</p>` : ''}
    ${stats.length ? html`<div class="res-stats">${stats.map(([k, v]) => html`<div class="res-stat"><span>${k}</span><b>${v}</b></div>`)}</div>` : ''}
    ${coins ? html`<div class="res-coins">${coinSVG()}<b data-rc>+0</b></div>` : ''}
    <div class="sh-col">${buttons.map((b, i) => html`<button class="btn ${b.main ? 'btn-main btn-big' : ''}" data-act="b${i}">${b.icon ? icon(b.icon) : ''}${b.label}</button>`)}</div>`, {
    dismiss: false,
    cls: 'res',
    actions: Object.fromEntries(buttons.map((b, i) => [`b${i}`, (c) => { c(); b.act(); }])),
  });
  if (won) {
    sfx.fanfare();
    confetti();
  } else sfx.fail();
  buzz(won ? 30 : 60);
  if (stars !== null) {
    for (let i = 0; i < 3; i++) {
      const n = sheet.querySelector(`[data-s="${i}"]`);
      if (i < stars) {
        setTimeout(() => {
          n.classList.add('on');
          n.animate([{ transform: 'scale(2.4) rotate(-30deg)', opacity: 0 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          sfx.star(i);
          buzz(12);
        }, 320 + i * 260);
      }
    }
  }
  if (coins) {
    const n = sheet.querySelector('[data-rc]');
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0 - 500) / 700);
      if (k > 0) n.textContent = `+${Math.round(coins * k)}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  return { el: sheet, close };
}

// Oyun içi duraklatma
export function pauseSheet({ onResume, onRestart, onQuit, restartLabel = 'Baştan Başla', quitLabel = 'Menüye Dön' }) {
  return openSheet(html`
    <h2 class="sh-title">Mola</h2>
    <div class="sh-col">
      <button class="btn btn-main btn-big" data-act="go">${icon('play')}Devam Et</button>
      ${onRestart ? html`<button class="btn" data-act="re">${icon('replay')}${restartLabel}</button>` : ''}
      <button class="btn" data-act="quit">${icon('home')}${quitLabel}</button>
    </div>`, {
    actions: {
      go: (c) => { c(); },
      re: (c) => { c('re'); onRestart(); },
      quit: (c) => { c('quit'); onQuit(); },
    },
    onClose: (v) => { if (!v && onResume) onResume(); },
  });
}

export function setMusic(id) {
  music.play(id);
}
