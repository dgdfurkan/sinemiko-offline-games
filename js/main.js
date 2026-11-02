// Uygulama kapısı: yönlendirme, tema, geçiş perdesi, çevrimdışı kurulum, oynama süresi

import { Life } from './core/dom.js';
import { save } from './core/save.js';
import { perf } from './core/perf.js';
import { bindUnlock, ensure, sfx } from './core/audio.js';
import { music } from './core/music.js';
import { frame, toast, sheetOpen, closeSheets } from './core/ui.js';
import { gameById } from './registry.js';
import { mountHub } from './hub.js';

const app = document.getElementById('app');
let current = null;
let currentLife = null;
let wiping = false;

perf.start();
bindUnlock();
window.addEventListener('pointerdown', () => { ensure(); music.retry(); }, { capture: true, passive: true });
// Çift dokunuşla yakınlaşma ve kaydırarak yenileme olmasın
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

export const offline = { state: 'wait', done: 0, total: 0, update: false };
let onUpdateIdle = null;
const offListeners = new Set();
export const onOffline = (fn) => { offListeners.add(fn); return () => offListeners.delete(fn); };
const offEmit = () => offListeners.forEach((fn) => fn(offline));

function setupSW() {
  if (!('serviceWorker' in navigator)) {
    offline.state = 'none';
    return;
  }
  navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'progress') {
      offline.done = m.done;
      offline.total = m.total;
      if (offline.state !== 'ready') offline.state = 'loading';
      offEmit();
    } else if (m.type === 'ready') {
      offline.state = 'ready';
      offEmit();
    }
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (navigator.serviceWorker.controller) {
      offline.state = 'ready';
      offEmit();
    }
    // Yeni sürüm: internet varken kendiliğinden alınır. Oyunun ortasında kesmez,
    // ana ekrandayken ya da bir sonraki açılışta sessizce uygulanır
    let applying = false;
    const apply = () => {
      if (applying || !reg.waiting) return;
      applying = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      reg.waiting.postMessage('skip-waiting');
    };
    const idle = () => !location.hash.startsWith('#/oyun') && !sheetOpen();
    const checkWaiting = () => {
      if (!reg.waiting || !navigator.serviceWorker.controller) return;
      offline.update = true;
      offline.applyUpdate = apply;
      offEmit();
      if (idle()) {
        toast('Yeni sürüm geldi, yükleniyor.');
        setTimeout(apply, 900);
      }
    };
    checkWaiting();
    onUpdateIdle = checkWaiting;
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', checkWaiting);
    });
    // Açılışta, sekmeye dönünce ve internet gelince yeni sürüm var mı diye bak
    const look = () => {
      if (navigator.onLine === false) return;
      reg.update().catch(() => {});
    };
    look();
    window.addEventListener('online', look);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) look(); });
    setInterval(look, 30 * 60 * 1000);
    navigator.serviceWorker.ready.then(() => {
      if (offline.state !== 'ready' && navigator.serviceWorker.controller) {
        offline.state = 'ready';
        offEmit();
      }
    });
  }).catch(() => {
    offline.state = 'error';
    offEmit();
  });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

// Oynama süresi: yalnızca ekran açıkken sayılır
setInterval(() => {
  if (document.hidden) return;
  const d = save.day();
  d.secs += 5;
  save.touch();
}, 5000);

function wipe(color, swap) {
  return new Promise((resolve) => {
    const c = document.createElement('div');
    c.className = 'wipe';
    c.style.background = color;
    document.body.append(c);
    const inA = c.animate([{ clipPath: 'circle(0% at 50% 60%)' }, { clipPath: 'circle(120% at 50% 60%)' }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    inA.finished.then(async () => {
      await swap();
      // Yeni ekran iki kare çizilsin, sonra perde açılsın
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const out = c.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
        out.finished.then(() => { c.remove(); resolve(); }, () => { c.remove(); resolve(); });
      }));
    }, () => { c.remove(); resolve(); });
  });
}

function teardown() {
  if (current && current.unmount) {
    try { current.unmount(); } catch (err) { console.error(err); }
  }
  current = null;
  if (currentLife) currentLife.dispose();
  currentLife = null;
  app.innerHTML = '';
}

async function route() {
  if (wiping) return;
  wiping = true;
  const hash = location.hash;
  const m = hash.match(/^#\/oyun\/(\w+)/);
  const game = m ? gameById(m[1]) : null;
  const color = game ? game.card : '#2a1636';
  try {
    await wipe(color, async () => {
      closeSheets();
      teardown();
      perf.reset();
      if (game) {
        document.body.dataset.theme = game.id;
        const mod = await game.load();
        music.play(game.music);
        currentLife = new Life();
        const api = makeApi(game);
        current = mod.mount(app, api) || {};
        if (window.__sgHook) window.__sgHook(game.id, current, api);
      } else {
        document.body.dataset.theme = 'hub';
        music.play('hub');
        current = mountHub(app, { offline, onOffline });
        if (window.__sgHook) window.__sgHook('hub', current);
      }
    });
  } catch (err) {
    console.error(err);
    toast('Oyun açılamadı, tekrar dene.');
    document.body.dataset.theme = 'hub';
    if (location.hash.startsWith('#/oyun')) location.hash = '#/';
  }
  wiping = false;
  if (location.hash !== hash) route();
  // Ana ekrana döndüysek bekleyen güncellemeyi şimdi al
  if (offline.update && onUpdateIdle) onUpdateIdle();
}

function makeApi(game) {
  const api = {
    game,
    exit: () => { location.hash = '#/'; },
    // Bir tur bitti: altın eklenir, günlük görevlere sayılır
    finish({ coins = 0 } = {}) {
      if (coins > 0) save.addCoins(Math.round(coins));
      const d = save.day();
      d.rounds[game.id] = (d.rounds[game.id] || 0) + 1;
      save.touch();
    },
    frame: (opts = {}) => frame(app, game, opts),
    save: (defaults) => save.game(game.id, defaults),
    touch: () => save.touch(),
  };
  return api;
}

window.addEventListener('hashchange', route);
setupSW();
route();

// Testler için
window.__sinemiko = { save, sheetOpen, sfx };
