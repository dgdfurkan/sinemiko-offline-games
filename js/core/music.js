// Oyunlara özel, anında üretilen müzik. Her tema kendi enstrümanı ve kalıbıyla çalar.
// Küçük bir adım sıralayıcı: 16'lık adımlar, ileriye dönük zamanlama, kısa döngü yerine katmanlı kalıplar

import { ensure, getCtx, musicOut, mtof, noiseBuffer } from './audio.js';

let song = null;
let songId = null;
let timer = 0;
let step = 0;
let nextT = 0;
let bus = null;

function voice(type, f, t, dur, vol, { attack = 0.006, detune = 0, filter = 0, q = 0.7 } = {}) {
  const c = getCtx();
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = f;
  if (detune) o.detune.value = detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (filter) {
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = filter;
    fl.Q.value = q;
    o.connect(fl);
    fl.connect(g);
  } else o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseHit(t, { type = 'highpass', f = 7000, q = 0.6, vol = 0.04, dur = 0.05 } = {}) {
  const c = getCtx();
  const s = c.createBufferSource();
  s.buffer = noiseBuffer();
  const fl = c.createBiquadFilter();
  fl.type = type;
  fl.frequency.value = f;
  fl.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl);
  fl.connect(g);
  g.connect(bus);
  s.start(t, Math.random(), dur + 0.02);
}

const V = {
  pluck: (m, t, d = 0.4, v = 0.1) => {
    voice('triangle', mtof(m), t, d, v, { attack: 0.003 });
    voice('sine', mtof(m) * 2, t, d * 0.5, v * 0.25, { attack: 0.002 });
  },
  saz: (m, t, d = 0.35, v = 0.09) => {
    voice('sawtooth', mtof(m), t, d, v, { attack: 0.002, filter: 2400 });
    voice('square', mtof(m) * 2.01, t, d * 0.4, v * 0.14, { attack: 0.002, filter: 3200 });
  },
  bass: (m, t, d = 0.4, v = 0.16) => voice('sine', mtof(m), t, d, v, { attack: 0.01 }),
  sub: (m, t, d = 0.4, v = 0.12) => voice('triangle', mtof(m), t, d, v, { attack: 0.008, filter: 500 }),
  pad: (notes, t, d = 2, v = 0.022) => notes.forEach((m, i) => {
    voice('sawtooth', mtof(m), t, d, v, { attack: 0.35, detune: i % 2 ? 6 : -6, filter: 900 });
  }),
  rhodes: (m, t, d = 0.9, v = 0.06) => {
    voice('sine', mtof(m), t, d, v, { attack: 0.006 });
    voice('sine', mtof(m) * 3, t, d * 0.35, v * 0.2, { attack: 0.004 });
  },
  bell: (m, t, d = 1.1, v = 0.06) => {
    voice('sine', mtof(m), t, d, v, { attack: 0.002 });
    voice('sine', mtof(m) * 2.76, t, d * 0.4, v * 0.3, { attack: 0.002 });
  },
  flute: (m, t, d = 0.5, v = 0.06) => {
    voice('sine', mtof(m), t, d, v, { attack: 0.05 });
    voice('triangle', mtof(m) * 2, t, d * 0.8, v * 0.1, { attack: 0.08 });
  },
  marimba: (m, t, d = 0.28, v = 0.1) => {
    voice('sine', mtof(m), t, d, v, { attack: 0.002 });
    voice('sine', mtof(m) * 4, t, d * 0.25, v * 0.2, { attack: 0.001 });
  },
  chip: (m, t, d = 0.12, v = 0.035) => voice('square', mtof(m), t, d, v, { attack: 0.002 }),
  chipBass: (m, t, d = 0.14, v = 0.06) => voice('triangle', mtof(m), t, d, v, { attack: 0.002 }),
  synth: (m, t, d = 0.25, v = 0.03) => voice('sawtooth', mtof(m), t, d, v, { attack: 0.004, filter: 1800, q: 3 }),
  kick: (t, v = 0.3) => {
    const c = getCtx();
    const o = c.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = c.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.22);
  },
  snare: (t, v = 0.07) => noiseHit(t, { type: 'bandpass', f: 1800, vol: v, dur: 0.14 }),
  hat: (t, v = 0.022) => noiseHit(t, { vol: v, dur: 0.04 }),
  brush: (t, v = 0.016) => noiseHit(t, { type: 'bandpass', f: 4200, q: 0.4, vol: v, dur: 0.12 }),
  // Darbuka: tok "düm" ve ince "tek"
  dum: (t, v = 0.22) => voice('sine', 110, t, 0.2, v, { attack: 0.002 }),
  tek: (t, v = 0.05) => noiseHit(t, { type: 'bandpass', f: 2600, q: 2, vol: v, dur: 0.05 }),
  // Tren: raylardan gelen tıkır tıkır
  rail: (t, v = 0.03) => noiseHit(t, { type: 'bandpass', f: 900, q: 1.2, vol: v, dur: 0.06 }),
};

const at = (list, i) => list[((i % list.length) + list.length) % list.length];
const P = (s) => [...s].map((c) => (c === '.' ? null : parseInt(c, 36))); // kalıp: 0-z dizinler, nokta boşluk

const SONGS = {
  // Ana ekran: pencere kenarında lo-fi, altta rayların ritmi
  hub: {
    bpm: 78, swing: 0.1,
    run(s, b, t, sd) {
      const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 55, 59, 62]];
      const ch = at(chords, Math.floor(b / 2));
      if (s === 0 && b % 2 === 0) V.pad(ch, t, sd * 34, 0.02);
      if (s === 0 || s === 10) V.bass(ch[0] - 12, t, sd * 6, 0.11);
      if ([0, 3, 8, 11].includes(s)) V.rail(t, s % 8 === 0 ? 0.032 : 0.02);
      const mel = P('2.3.1...0..2.3..');
      const n = mel[s];
      if (n !== null && b % 4 > 1) V.rhodes(ch[n % 4] + 12, t, 0.8, 0.045);
      if (s === 14 && b % 4 === 3) V.rhodes(ch[3] + 24, t, 0.8, 0.03);
    },
  },
  // Dönerci: Hicaz dizisinde saz, darbuka
  doner: {
    bpm: 112, swing: 0,
    run(s, b, t, sd) {
      const hicaz = [57, 58, 61, 62, 64, 65, 68, 69, 70, 73];
      if ([0, 6].includes(s)) V.dum(t);
      if ([3, 4, 10, 12, 14].includes(s)) V.tek(t, s === 12 ? 0.06 : 0.04);
      const phrase = at([P('0.2.3.4.5.4.3.2.'), P('7.6.5.4.3.4.5.3.'), P('4.5.7.8.7.5.4.3.'), P('2.3.2.1.0...0...')], Math.floor(b / 2));
      const n = phrase[s];
      if (n !== null && (b % 8 < 6)) V.saz(hicaz[n], t, sd * 3, 0.07);
      if (s === 0 || s === 8) V.sub(45, t, sd * 6, 0.11);
    },
  },
  // Maraşlı: çanlı, oynak, zurna gibi ezgi
  dondurma: {
    bpm: 132, swing: 0,
    run(s, b, t, sd) {
      const sc = [62, 64, 65, 67, 69, 70, 72, 74, 76];
      if ([0, 3, 6, 10, 12].includes(s)) (s === 0 || s === 6 ? V.dum : V.tek)(t, s === 0 || s === 6 ? 0.2 : 0.05);
      const mel = at([P('4.5.4.3.2...4...'), P('7.6.5.4.3.4.5...'), P('4.5.7.8.7.5.4...'), P('2.3.2.1.0...0...')], b);
      if (mel[s] !== null) V.saz(sc[mel[s]], t, sd * 2.2, 0.055);
      if (s === 0 && b % 2 === 0) V.bell(98, t, 0.5, 0.025);
      if (s % 8 === 0) V.sub(38 + (b % 4 === 2 ? 5 : 0), t, sd * 5, 0.11);
    },
  },
  // Kafe: fırçalı davul, ılık akorlar
  kafe: {
    bpm: 92, swing: 0.2,
    run(s, b, t, sd) {
      const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65]];
      const ch = at(chords, b);
      if (s === 0) ch.forEach((m, i) => V.rhodes(m, t + i * 0.012, sd * 12, 0.04));
      if (s === 6 && b % 2) ch.slice(1).forEach((m) => V.rhodes(m, t, sd * 4, 0.03));
      if (s % 4 === 0) V.bass(ch[0] - 24 + (s === 8 ? 7 : 0), t, sd * 3.6, 0.1);
      if (s % 2 === 0) V.brush(t, s % 4 === 2 ? 0.02 : 0.012);
      const mel = at([P('....7...5.4.....'), P('..4.5...7.......')], b);
      if (mel[s] !== null && b % 4 >= 2) V.pluck(ch[mel[s] % 4] + 12, t, 0.5, 0.05);
    },
  },
  // Takı Atölyesi: müzik kutusu
  taki: {
    bpm: 72, swing: 0,
    run(s, b, t, sd) {
      const chords = [[64, 67, 72, 76], [62, 65, 69, 74], [60, 64, 67, 72], [59, 62, 67, 71]];
      const ch = at(chords, b);
      if (s % 2 === 0) V.bell(ch[at([0, 2, 1, 3, 2, 1, 3, 2], s / 2)] + 12, t, 1, 0.05);
      if (s === 0) V.pad([ch[0] - 12, ch[1] - 12, ch[2] - 12], t, sd * 16, 0.012);
    },
  },
  // Bee Koyun: kaval, parmak basma
  koyun: {
    bpm: 104, swing: 0.06,
    run(s, b, t, sd) {
      const sc = [67, 69, 71, 74, 76, 79, 81];
      const mel = at([P('0.2.3...4.3.2...'), P('3.4.5.4.3.2.0...'), P('5...4.3.2.3.4...'), P('2.3.2.0...1.0...')], b);
      if (mel[s] !== null) V.flute(sc[mel[s]], t, sd * 3.4, 0.06);
      if (s % 4 === 0) V.pluck(s % 8 === 0 ? 43 : 50, t, 0.3, 0.09);
      if (s % 4 === 2) [55, 59, 62].forEach((m) => V.pluck(m, t, 0.18, 0.03));
    },
  },
  // Laboratuvar: soğuk arpej, sakin
  lab: {
    bpm: 96, swing: 0,
    run(s, b, t, sd) {
      const ch = at([[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 59, 64]], Math.floor(b / 2));
      if (s === 0 && b % 2 === 0) V.pad(ch, t, sd * 34, 0.018);
      V.synth(ch[at([0, 2, 1, 3, 2, 3, 1, 2], s)] + 12, t, sd * 1.6, s % 4 === 0 ? 0.024 : 0.012);
      if (s === 0) V.sub(ch[0] - 24, t, sd * 8, 0.1);
      if (s === 12) V.hat(t, 0.02);
    },
  },
  // Nano Yolculuk: kalp atışı kick, hızlı arpej
  nano: {
    bpm: 128, swing: 0,
    run(s, b, t, sd) {
      const ch = at([[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 63], [45, 52, 57, 60]], Math.floor(b / 2));
      if (s === 0 || s === 3) V.kick(t, s ? 0.2 : 0.32);
      if (s === 8 || s === 11) V.kick(t, s === 8 ? 0.28 : 0.16);
      if (s % 4 === 2) V.hat(t, 0.03);
      V.synth(ch[at([0, 1, 2, 3, 2, 1], s)] + 12, t, sd * 0.9, 0.018);
      if (s % 4 === 0) V.sub(ch[0] - 12, t, sd * 2.4, 0.12);
    },
  },
  // Antikor Atışı: neşeli marimba
  antikor: {
    bpm: 120, swing: 0.08,
    run(s, b, t, sd) {
      const sc = [60, 62, 64, 67, 69, 72, 74, 76];
      const mel = at([P('0.2.3.4.5.4.3...'), P('5.4.3.2.3.4.5...'), P('7.6.5.3.4.3.2...'), P('3.4.3.2.0...1.0.')], b);
      if (mel[s] !== null) V.marimba(sc[mel[s]], t, 0.28, 0.1);
      if (s % 8 === 0) V.bass(at([36, 41, 43, 36], b), t, sd * 6, 0.12);
      if (s % 8 === 4) V.snare(t, 0.035);
      if (s % 2 === 0) V.hat(t, 0.012);
    },
  },
  // Petri Kabı: rüya gibi damlalar
  petri: {
    bpm: 66, swing: 0,
    run(s, b, t, sd) {
      const ch = at([[60, 64, 67, 71, 74], [57, 60, 64, 67, 71], [65, 69, 72, 76, 79], [55, 59, 62, 65, 69]], b);
      if (s === 0) V.pad(ch.slice(0, 3), t, sd * 16, 0.016);
      const seq = at([P('0..2..4...3..1..'), P('4..3..1...2..0..')], b);
      if (seq[s] !== null) V.bell(ch[seq[s]] + 12, t, 1.2, 0.045);
    },
  },
  // Harf Kovanı: arı gibi yumuşak marimba
  hive: {
    bpm: 100, swing: 0.12,
    run(s, b, t, sd) {
      const ch = at([[65, 69, 72], [62, 65, 69], [60, 64, 67], [58, 62, 65]], b);
      if (s % 4 === 0) V.bass(ch[0] - 24, t, sd * 3, 0.1);
      if (s % 4 === 2) ch.forEach((m) => V.marimba(m, t, 0.2, 0.035));
      const mel = at([P('2.1.0.......2.1.'), P('..0.1.2.......1.')], b);
      if (mel[s] !== null) V.marimba(ch[mel[s]] + 12, t, 0.3, 0.06);
    },
  },
  // Bulmaca: defter başında sakin piyano
  bulmaca: {
    bpm: 70, swing: 0.08,
    run(s, b, t, sd) {
      const ch = at([[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], b);
      if (s === 0) V.bass(ch[0] - 12, t, sd * 12, 0.06);
      const arp = P('0.1.2.1.0.2.1.2.');
      if (arp[s] !== null) V.rhodes(ch[arp[s]] + 12, t, 0.8, 0.032);
    },
  },
  // Atari Salonu: kare dalga
  retro: {
    bpm: 140, swing: 0,
    run(s, b, t, sd) {
      const ch = at([[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], b);
      V.chip(ch[s % 3] + 24, t, sd * 0.8, 0.018);
      if (s % 2 === 0) V.chipBass(ch[0] - (s % 4 ? 0 : 12), t, sd * 1.6, 0.075);
      if (s % 8 === 4) V.hat(t, 0.05);
      const mel = at([P('0...2...1.2.3...'), P('3...2...1...0...')], Math.floor(b / 2));
      if (mel[s] !== null) V.chip(ch[mel[s] % 3] + 36, t, sd * 2.5, 0.022);
    },
  },
  // Kahvehane: yavaş ud, uzaktan kaşık sesi
  kahve: {
    bpm: 76, swing: 0.06,
    run(s, b, t, sd) {
      const uss = [62, 63, 65, 67, 69, 70, 72, 74];
      const mel = at([P('4...3.2.1.2.0...'), P('2.3.4...6.5.4...'), P('5.4.3.2.3.1.0...'), P('0.1.2.3.2.1.0...')], b);
      if (mel[s] !== null) V.saz(uss[mel[s]] - 12, t, sd * 4, 0.05);
      if (s === 0 || s === 8) V.sub(38, t, sd * 6, 0.09);
      if (s === 12 && b % 2) V.tek(t, 0.018);
    },
  },
};

function tick() {
  const c = getCtx();
  if (!c || !song || c.state !== 'running') return;
  const sd = 60 / song.bpm / 4;
  if (nextT < c.currentTime - 0.3) nextT = c.currentTime + 0.05;
  while (nextT < c.currentTime + 0.18) {
    const s = step % 16;
    const t = nextT + (s % 2 ? song.swing * sd : 0);
    try {
      song.run(s, Math.floor(step / 16), t, sd);
    } catch (err) {
      console.error(err);
    }
    step++;
    nextT += sd;
  }
}

export const music = {
  play(id) {
    if (songId === id) return;
    const c = ensure();
    songId = id;
    if (!c) return;
    this.stopVoices();
    song = SONGS[id] || null;
    if (!song) return;
    bus = c.createGain();
    bus.gain.setValueAtTime(0.0001, c.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 0.8);
    bus.connect(musicOut());
    step = 0;
    nextT = c.currentTime + 0.1;
    clearInterval(timer);
    timer = setInterval(tick, 30);
  },
  stopVoices() {
    const c = getCtx();
    if (bus && c) {
      const old = bus;
      old.gain.cancelScheduledValues(c.currentTime);
      old.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
      setTimeout(() => old.disconnect(), 700);
    }
    bus = null;
    song = null;
  },
  stop() {
    songId = null;
    clearInterval(timer);
    timer = 0;
    this.stopVoices();
  },
  // İlk dokunuştan önce başlatılamayan müzik için
  retry() {
    const id = songId;
    if (id && !song) {
      songId = null;
      this.play(id);
    }
  },
  ids: Object.keys(SONGS),
};
