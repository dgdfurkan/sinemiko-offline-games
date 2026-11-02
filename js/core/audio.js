// Tek AudioContext: müzik ve efekt yolları. Tüm sesler anında üretilir, dosya yok

import { save } from './save.js';

let ctx = null;
let master = null;
let musicBus = null;
let sfxBus = null;
let noise = null;

export function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -6;
    master.ratio.value = 8;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    syncVolumes();
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
  return ctx;
}

export const getCtx = () => ctx;
export const musicOut = () => musicBus;
export const sfxOut = () => sfxBus;

export function syncVolumes() {
  if (!ctx) return;
  musicBus.gain.value = save.get('music') ? 0.55 : 0;
  sfxBus.gain.value = save.get('sound') ? 0.9 : 0;
}

// iOS ses motorunu yalnızca dokunuşla açar; ilk dokunuşta ve kesintiden sonra açılır
export function bindUnlock() {
  const go = () => {
    const c = ensure();
    if (!c) return;
    // Sessiz kısa ses: bazı iOS sürümleri gerçek bir ses çalınmadan açılmaz
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  };
  window.addEventListener('pointerdown', go, { capture: true, passive: true });
  window.addEventListener('keydown', go, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function noiseBuffer() {
  if (!noise) {
    const len = Math.floor(ctx.sampleRate * 1.5);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

const live = () => (ctx && ctx.state === 'running' ? ctx : null);

export function tone({ type = 'sine', f, f2, t, dur = 0.12, vol = 0.2, attack = 0.004, dest }) {
  const c = live();
  if (!c) return;
  const at = t ?? c.currentTime;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(dest || sfxBus);
  o.start(at);
  o.stop(at + dur + 0.03);
}

export function hiss({ t, dur = 0.2, vol = 0.1, type = 'bandpass', f = 1500, f2, q = 0.8, attack = 0.004, dest }) {
  const c = live();
  if (!c) return;
  const at = t ?? c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, at);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(fl);
  fl.connect(g);
  g.connect(dest || sfxBus);
  src.start(at, Math.random() * 1.2, dur + 0.05);
}

const notes = (list, { type = 'triangle', gap = 0.08, dur = 0.26, vol = 0.13 } = {}) => {
  const c = live();
  if (!c) return;
  list.forEach((m, i) => tone({ type, f: mtof(m), t: c.currentTime + i * gap, dur, vol }));
};

export const sfx = {
  tap() { tone({ type: 'triangle', f: 880, f2: 620, dur: 0.06, vol: 0.1 }); },
  soft() { tone({ type: 'sine', f: 660, f2: 880, dur: 0.08, vol: 0.07 }); },
  pop(size = 1) {
    const b = (700 + Math.random() * 500) / Math.max(0.6, size);
    tone({ f: b, f2: b * 0.42, dur: 0.08, vol: 0.24, attack: 0.002 });
    tone({ f: b * 2.1, f2: b, dur: 0.04, vol: 0.05, attack: 0.001 });
  },
  ding(m = 84) { notes([m, m + 7], { gap: 0.05, dur: 0.3, vol: 0.1 }); },
  coin() { notes([88, 93], { type: 'square', gap: 0.06, dur: 0.12, vol: 0.05 }); },
  whoosh() { hiss({ dur: 0.28, vol: 0.13, f: 500, f2: 3000, q: 1, attack: 0.05 }); },
  good() { notes([72, 76, 79], { gap: 0.07, dur: 0.24, vol: 0.12 }); },
  bad() { tone({ type: 'sawtooth', f: 220, f2: 110, dur: 0.3, vol: 0.09 }); },
  fanfare() { notes([60, 64, 67, 72, 76, 79, 84], { gap: 0.09, dur: 0.4, vol: 0.13 }); },
  fail() { notes([67, 64, 60, 55], { type: 'sawtooth', gap: 0.14, dur: 0.3, vol: 0.06 }); },
  star(n = 0) { notes([79 + n * 3, 86 + n * 3], { gap: 0.06, dur: 0.3, vol: 0.12 }); },
  tick(n = 0) { tone({ type: 'square', f: 1000 + n * 80, dur: 0.03, vol: 0.05, attack: 0.001 }); },
  thud(p = 1) {
    tone({ f: 120 + 60 * p, f2: 50, dur: 0.14, vol: 0.16 + 0.2 * Math.min(1, p), attack: 0.002 });
    hiss({ dur: 0.08, vol: 0.07 * p, type: 'lowpass', f: 1200, attack: 0.002 });
  },
  boom() {
    tone({ f: 130, f2: 28, dur: 0.9, vol: 0.5, attack: 0.002 });
    hiss({ dur: 1, vol: 0.3, type: 'lowpass', f: 2600, f2: 180, q: 0.4, attack: 0.002 });
  },
  splat() {
    hiss({ dur: 0.2, vol: 0.28, type: 'lowpass', f: 1800, f2: 300, q: 0.7, attack: 0.002 });
    tone({ f: 240, f2: 70, dur: 0.15, vol: 0.26, attack: 0.002 });
  },
  zap() {
    tone({ type: 'sawtooth', f: 1800, f2: 220, dur: 0.16, vol: 0.08, attack: 0.002 });
    tone({ type: 'square', f: 900, f2: 120, dur: 0.12, vol: 0.04, attack: 0.002 });
  },
  sizzle(d = 0.25) { hiss({ dur: d, vol: 0.05, type: 'highpass', f: 4200, q: 0.4, attack: 0.01 }); },
  slice(power = 1) {
    const p = Math.max(0.4, Math.min(2.4, power));
    hiss({ dur: 0.06 + 0.05 / p, vol: 0.1 + p * 0.05, f: 1800 + p * 900, f2: 4200 + p * 1800, q: 2, attack: 0.003 });
    tone({ type: 'triangle', f: 240 * p, f2: 90, dur: 0.05, vol: 0.05, attack: 0.001 });
  },
  chop() {
    tone({ type: 'square', f: 300, f2: 110, dur: 0.05, vol: 0.09, attack: 0.001 });
    hiss({ dur: 0.05, vol: 0.1, f: 1800, q: 1, attack: 0.001 });
  },
  note(m, dur = 0.3, { type = 'triangle', vol = 0.13 } = {}) { tone({ type, f: mtof(m), dur, vol, attack: 0.008 }); },
  chime(m = 84) {
    tone({ f: mtof(m), dur: 0.7, vol: 0.09, attack: 0.002 });
    tone({ f: mtof(m) * 2.76, dur: 0.3, vol: 0.03, attack: 0.002 });
  },
  baa() {
    // Koyun: titrek, burundan bir "mee"
    const c = live();
    if (!c) return;
    const at = c.currentTime;
    const base = 300 + Math.random() * 120;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, at);
    o.frequency.linearRampToValueAtTime(base * 0.86, at + 0.5);
    const lfo = c.createOscillator();
    lfo.frequency.value = 17 + Math.random() * 6;
    const lg = c.createGain();
    lg.gain.value = base * 0.09;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const fl = c.createBiquadFilter();
    fl.type = 'bandpass';
    fl.frequency.value = 1100;
    fl.Q.value = 2.2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.16, at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
    o.connect(fl);
    fl.connect(g);
    g.connect(sfxBus);
    o.start(at);
    lfo.start(at);
    o.stop(at + 0.6);
    lfo.stop(at + 0.6);
  },
  bark() {
    tone({ type: 'square', f: 420, f2: 190, dur: 0.1, vol: 0.12, attack: 0.002 });
    hiss({ dur: 0.08, vol: 0.09, f: 900, q: 1, attack: 0.002 });
  },
  card() { hiss({ dur: 0.07, vol: 0.12, f: 3200, f2: 1600, q: 0.8, attack: 0.002 }); },
  tile() {
    tone({ type: 'square', f: 1400, f2: 900, dur: 0.03, vol: 0.05, attack: 0.001 });
    tone({ f: 500, f2: 300, dur: 0.05, vol: 0.1, attack: 0.001 });
  },
  dice() {
    const c = live();
    if (!c) return;
    for (let k = 0; k < 5; k++) hiss({ t: c.currentTime + k * 0.06 + Math.random() * 0.03, dur: 0.04, vol: 0.12, f: 2600, q: 2, attack: 0.001 });
  },
  bubble() { tone({ f: 500 + Math.random() * 400, f2: 1300, dur: 0.07, vol: 0.09, attack: 0.002 }); },
  squish() { tone({ type: 'triangle', f: 340, f2: 90, dur: 0.14, vol: 0.2, attack: 0.002 }); },
  merge(level = 0) {
    notes([60 + level * 2, 67 + level * 2, 72 + level * 2], { gap: 0.04, dur: 0.22, vol: 0.12 });
    tone({ f: 200, f2: 500, dur: 0.1, vol: 0.14, attack: 0.002 });
  },
  sting() { tone({ type: 'sawtooth', f: 900, f2: 1600, dur: 0.12, vol: 0.06, attack: 0.002 }); },
  // Retro bipler
  bleep(f = 880, d = 0.06) { tone({ type: 'square', f, dur: d, vol: 0.06, attack: 0.001 }); },
  blaster() { tone({ type: 'square', f: 1400, f2: 300, dur: 0.1, vol: 0.05, attack: 0.001 }); },
  explode8() { hiss({ dur: 0.25, vol: 0.16, type: 'lowpass', f: 1400, f2: 200, q: 0.5, attack: 0.001 }); },
};

// Sürekli ses: dökme, motor, cızırtı. set(hacim, frekans) ile değişir
export function steady({ type = 'bandpass', f = 800, q = 1.4 } = {}) {
  const c = ensure();
  if (!c || c.state !== 'running') return { set() {}, stop() {} };
  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = c.createGain();
  g.gain.value = 0;
  src.connect(fl);
  fl.connect(g);
  g.connect(sfxBus);
  src.start();
  let stopped = false;
  return {
    set(vol, freq) {
      if (stopped) return;
      const now = c.currentTime;
      g.gain.setTargetAtTime(vol, now, 0.03);
      if (freq) fl.frequency.setTargetAtTime(freq, now, 0.05);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      g.gain.setTargetAtTime(0, c.currentTime, 0.04);
      setTimeout(() => {
        try { src.stop(); } catch { /* bitmiş olabilir */ }
        src.disconnect();
        g.disconnect();
      }, 300);
    },
  };
}

export function buzz(ms = 12) {
  if (save.get('haptic') && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch { /* izin yok */ }
  }
}
