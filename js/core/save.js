// Kayıt: her şey bu cihazda. Bozuk ya da eksik kayıt oyunu durdurmaz

const KEY = 'sinemiko-yolda/v1';
const listeners = new Set();

const blank = () => ({
  coins: 0,
  sound: true,
  music: true,
  haptic: true,
  eco: false,
  games: {},
  wardrobe: { owned: [], worn: {} },
  days: {},
  seenInstall: false,
  welcomed: false,
});

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') return { ...blank(), ...s, wardrobe: { ...blank().wardrobe, ...(s.wardrobe || {}) } };
  } catch {
    // Bozuk kayıt: temiz başla
  }
  return blank();
}

let state = load();
let timer = 0;

function flush() {
  clearTimeout(timer);
  timer = 0;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Depolama doluysa oyun yine çalışır
  }
}
const persist = () => {
  if (!timer) timer = setTimeout(flush, 200);
};
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const save = {
  get: (k) => state[k],
  set(k, v) {
    state[k] = v;
    persist();
    listeners.forEach((fn) => fn(k, v));
  },
  // Oyuna ait kayıt: game(id) nesneyi döner, değişince touch() çağrılır
  game(id, defaults = {}) {
    if (!state.games[id]) state.games[id] = {};
    const g = state.games[id];
    for (const k of Object.keys(defaults)) if (g[k] === undefined) g[k] = structuredClone(defaults[k]);
    return g;
  },
  touch() {
    persist();
  },
  day() {
    const k = today();
    if (!state.days[k]) state.days[k] = { secs: 0, rounds: {}, earned: 0, claimed: [], stops: [] };
    // Eski günler birikmesin
    const keys = Object.keys(state.days);
    if (keys.length > 8) keys.sort().slice(0, keys.length - 8).forEach((d) => delete state.days[d]);
    return state.days[k];
  },
  addCoins(n) {
    state.coins = Math.max(0, state.coins + n);
    if (n > 0) this.day().earned += n;
    persist();
    listeners.forEach((fn) => fn('coins', state.coins));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset() {
    state = blank();
    flush();
  },
};
