// Kare bekçisi: kareler uzamaya başlarsa oyun kendiliğinden hafifler.
// Zayıf tablette de akıcı kalsın diye piksel yoğunluğu düşer, 3B tarafı kare atlar.

import { save } from './save.js';

const listeners = new Set();
const state = { light: !!save.get('eco'), auto: false, fps: 60 };

let n = 0;
let sum = 0;
let bad = 0;
let good = 0;
let last = 0;
let watching = false;

const emit = () => listeners.forEach((fn) => fn(state.light));

function setLight(on, auto) {
  if (state.light === on) return;
  state.light = on;
  state.auto = auto;
  emit();
}

function tick(t) {
  if (!watching) return;
  if (last) {
    const d = t - last;
    // Sekmeye geri dönüş ya da takılma: ölçüme katma
    if (d < 400) {
      n++;
      sum += d;
      if (n >= 50) {
        const avg = sum / n;
        state.fps = Math.round(1000 / avg);
        n = 0;
        sum = 0;
        if (avg > 23) {
          bad++;
          good = 0;
          if (bad >= 2 && !state.light) setLight(true, true);
        } else if (avg < 18) {
          good++;
          bad = 0;
          // Kendi açtıysa ve uzun süre rahatsa geri aç
          if (good >= 10 && state.light && state.auto && !save.get('eco')) setLight(false, false);
        }
      }
    }
  }
  last = t;
  requestAnimationFrame(tick);
}

export const perf = {
  get light() { return state.light; },
  get fps() { return state.fps; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  // Oyun değişince ölçüm sıfırlanır: açılış takılması modu düşürmesin
  reset() {
    n = 0;
    sum = 0;
    bad = 0;
    good = 0;
    last = 0;
  },
  start() {
    if (watching) return;
    watching = true;
    requestAnimationFrame(tick);
    save.subscribe((k) => {
      if (k !== 'eco') return;
      if (save.get('eco')) setLight(true, false);
      else setLight(false, false);
    });
  },
};
