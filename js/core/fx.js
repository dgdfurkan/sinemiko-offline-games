// Tuval efektleri: parçacık, yazı, halka. Üst katmanda konfeti. Öğelere yay animasyonları

import { rand, pick } from './dom.js';

export function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 1.05, y - s * 0.35, x - s * 0.55, y - s * 1.05, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.55, y - s * 1.05, x + s * 1.05, y - s * 0.35, x, y + s * 0.35);
  g.closePath();
}

export function starPath(g, x, y, r, n = 5, inner = 0.48) {
  g.beginPath();
  for (let k = 0; k < n * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / n;
    const rr = k % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

export function rrect(g, x, y, w, h, r) {
  g.beginPath();
  const k = Math.min(r, w / 2, h / 2);
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

// Kalın konturlu dolu şekil
export function inked(g, fill, lw = 3, stroke = '#2a1636') {
  g.fillStyle = fill;
  g.fill();
  if (lw) {
    g.lineWidth = lw;
    g.strokeStyle = stroke;
    g.stroke();
  }
}

// Tuval üstünde konturlu yazı
export function label(g, x, y, text, { size = 18, color = '#fff', stroke = '#2a1636', font = '"Paytone One", sans-serif', align = 'center', sw = 0.24 } = {}) {
  g.font = `${/Nunito|Baloo|Exo|JetBrains/.test(font) ? 800 : 400} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (sw) {
    g.lineWidth = size * sw;
    g.strokeStyle = stroke;
    g.strokeText(text, x, y);
  }
  g.fillStyle = color;
  g.fillText(text, x, y);
}

export function makeFx({ font = '"Paytone One", sans-serif', stroke = '#2a1636' } = {}) {
  const bits = [];
  const texts = [];
  const rings = [];
  return {
    get busy() {
      return bits.length + texts.length + rings.length > 0;
    },
    burst(x, y, { n = 14, colors = ['#ffcd3c', '#fff'], power = 280, gravity = 700, size = [3, 7], shape = 'circle', up = 0 } = {}) {
      if (bits.length > 240) bits.splice(0, 60);
      for (let k = 0; k < n; k++) {
        const a = (Math.PI * 2 * k) / n + rand(-0.3, 0.3);
        const v = rand(power * 0.4, power);
        bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: 1, c: pick(colors), s: rand(size[0], size[1]), shape, gravity, rot: rand(0, 6) });
      }
    },
    text(x, y, text, color = '#fff', size = 22) {
      texts.push({ x, y, text, c: color, s: size, life: 1 });
    },
    ring(x, y, color = '#fff', r = 24) {
      rings.push({ x, y, c: color, r0: r, life: 1 });
    },
    clear() {
      bits.length = 0;
      texts.length = 0;
      rings.length = 0;
    },
    draw(g, dt) {
      for (let k = rings.length - 1; k >= 0; k--) {
        const r = rings[k];
        r.life -= dt * 2.4;
        if (r.life <= 0) { rings.splice(k, 1); continue; }
        g.globalAlpha = r.life;
        g.beginPath();
        g.arc(r.x, r.y, r.r0 * (1 + (1 - r.life) * 1.6), 0, Math.PI * 2);
        g.lineWidth = 5 * r.life + 1;
        g.strokeStyle = r.c;
        g.stroke();
      }
      for (let k = bits.length - 1; k >= 0; k--) {
        const p = bits[k];
        p.life -= dt * 1.7;
        if (p.life <= 0) { bits.splice(k, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        g.globalAlpha = Math.min(1, p.life * 1.4);
        const s = p.s * (0.5 + p.life * 0.5);
        g.fillStyle = p.c;
        if (p.shape === 'heart') { heartPath(g, p.x, p.y, s * 1.3); g.fill(); }
        else if (p.shape === 'star') { starPath(g, p.x, p.y, s * 1.4); g.fill(); }
        else if (p.shape === 'square') { g.fillRect(p.x - s / 2, p.y - s / 2, s, s); }
        else { g.beginPath(); g.arc(p.x, p.y, s, 0, Math.PI * 2); g.fill(); }
      }
      for (let k = texts.length - 1; k >= 0; k--) {
        const s = texts[k];
        s.life -= dt * 1.1;
        if (s.life <= 0) { texts.splice(k, 1); continue; }
        s.y -= 50 * dt;
        g.globalAlpha = Math.min(1, s.life * 2);
        label(g, s.x, s.y, s.text, { size: s.s * (1 + Math.max(0, s.life - 0.8) * 1.4), color: s.c, font, stroke });
      }
      g.globalAlpha = 1;
    },
  };
}

// Tam ekran konfeti: sonuç anları için. Kendi tuvalini açar, bitince kaldırır
export function confetti({ n = 90, colors = ['#ff5fa2', '#ffcd3c', '#2ed6a0', '#4fb6ff', '#a98bff'] } = {}) {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.append(c);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * dpr;
  c.height = H * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const bits = Array.from({ length: n }, (_, i) => ({
    x: i % 2 ? -10 : W + 10,
    y: H * rand(0.3, 0.7),
    vx: (i % 2 ? 1 : -1) * rand(120, 520),
    vy: rand(-720, -240),
    r: rand(0, 6),
    vr: rand(-8, 8),
    s: rand(5, 11),
    c: pick(colors),
  }));
  let last = performance.now();
  const t0 = last;
  const loop = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    g.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.vy += 900 * dt;
      b.vx *= 1 - 0.8 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.r += b.vr * dt;
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.r);
      g.fillStyle = b.c;
      g.fillRect(-b.s / 2, -b.s / 3, b.s, b.s * 0.66);
      g.restore();
    }
    if (t - t0 < 2600) requestAnimationFrame(loop);
    else c.remove();
  };
  requestAnimationFrame(loop);
}

export function shake(el, px = 8, ms = 320) {
  if (!el || !el.animate) return;
  el.animate([
    { transform: 'translate(0,0)' },
    { transform: `translate(${-px}px,${px * 0.6}px)` },
    { transform: `translate(${px * 0.8}px,${-px * 0.6}px)` },
    { transform: `translate(${-px * 0.4}px,${px * 0.3}px)` },
    { transform: 'translate(0,0)' },
  ], { duration: ms });
}

export function pop(el, s = 1.25) {
  if (!el || !el.animate) return;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${s})` }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}

export function popIn(el, delay = 0) {
  if (!el || !el.animate) return;
  el.animate([{ opacity: 0, transform: 'scale(.6) translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' });
}
