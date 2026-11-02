// DOM ve zamanlama yardımcıları

import { perf } from './perf.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// Güvenli şablon: değerler kaçışlanır, raw() ile işaretlenenler olduğu gibi kalır
export const raw = (s) => ({ __html: String(s) });

function part(v) {
  if (v == null || v === false || v === true) return '';
  if (Array.isArray(v)) return v.map(part).join('');
  if (typeof v === 'object' && '__html' in v) return v.__html;
  return esc(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return raw(out);
}

export const toHTML = (tpl) => part(tpl);

export function el(tpl) {
  const t = document.createElement('template');
  t.innerHTML = part(tpl).trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export const trUpper = (s) => String(s).toLocaleUpperCase('tr');
export const trLower = (s) => String(s).toLocaleLowerCase('tr');

// Tohumlu rastgele: aynı seviye her açılışta aynı kurulur
export function seeded(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const next = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  next.range = (a, b) => a + next() * (b - a);
  next.int = (a, b) => Math.floor(next.range(a, b + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  return next;
}

// Bir ekranın ömrü: zamanlayıcılar, olaylar, döngüler ekran kapanınca kendiliğinden temizlenir
export class Life {
  constructor() {
    this.alive = true;
    this.cleanups = [];
  }
  add(fn) {
    if (!this.alive) { fn(); return fn; }
    this.cleanups.push(fn);
    return fn;
  }
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.add(() => target.removeEventListener(type, fn, opts));
  }
  timeout(fn, ms) {
    const id = setTimeout(() => { if (this.alive) fn(); }, ms);
    this.add(() => clearTimeout(id));
    return id;
  }
  interval(fn, ms) {
    const id = setInterval(() => { if (this.alive) fn(); }, ms);
    this.add(() => clearInterval(id));
    return id;
  }
  sleep(ms) {
    return new Promise((resolve) => this.timeout(resolve, ms));
  }
  // Çizim döngüsü: sayfa gizliyken durur (pil), fn false dönerse biter. fn(dt, t)
  raf(fn) {
    let id = 0;
    let last = 0;
    const loop = (t) => {
      if (!this.alive) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (fn(dt, t) === false) return;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    const stop = () => cancelAnimationFrame(id);
    this.add(stop);
    return stop;
  }
  dispose() {
    if (!this.alive) return;
    this.alive = false;
    const list = this.cleanups.splice(0).reverse();
    for (const fn of list) {
      try { fn(); } catch (err) { console.error(err); }
    }
  }
}

// Tuvali kabının boyutuna oturtur; çizim CSS pikseliyle yapılır
export function fitCanvas(canvas, life, onResize, dprCap = 2) {
  const g = canvas.getContext('2d');
  const size = { W: 0, H: 0, dpr: 1, g };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    size.dpr = Math.min(dprCap, perf.light ? 1.35 : 9, window.devicePixelRatio || 1);
    size.W = r.width;
    size.H = r.height;
    canvas.width = Math.round(r.width * size.dpr);
    canvas.height = Math.round(r.height * size.dpr);
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    if (onResize) onResize(size);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  life.add(() => ro.disconnect());
  life.add(perf.onChange(resize));
  size.begin = () => {
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.clearRect(0, 0, size.W, size.H);
  };
  return size;
}

// Tek parmak: basma, sürükleme, bırakma. Koordinatlar öğeye göre
export function drag(target, life, { down, move, up } = {}) {
  let active = null;
  const pos = (e) => {
    const r = target.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  life.on(target, 'pointerdown', (e) => {
    if (active !== null) return;
    active = e.pointerId;
    try { target.setPointerCapture(e.pointerId); } catch { /* bazı tarayıcılar */ }
    e.preventDefault();
    if (down) down(pos(e), e);
  });
  life.on(target, 'pointermove', (e) => {
    if (e.pointerId !== active) return;
    e.preventDefault();
    if (move) move(pos(e), e);
  });
  const end = (e) => {
    if (e.pointerId !== active) return;
    active = null;
    if (up) up(pos(e), e);
  };
  life.on(target, 'pointerup', end);
  life.on(target, 'pointercancel', end);
}
