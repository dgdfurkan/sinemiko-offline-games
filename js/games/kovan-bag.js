// Harf Kovanı'nın iki sürümünün ortak parçaları: harfler arası bağ (parmak takibi),
// kelime listeleri ve kovana ait çizimler.

export const INK = '#2a1636';

/* ---------- Kelime listeleri ---------- */

let listsP = null;
const readSet = (name) => fetch(new URL(`../../data/${name}`, import.meta.url))
  .then((r) => r.text())
  .then((t) => new Set(t.split('\n').map((w) => w.trim()).filter(Boolean)));

// common: insanların gerçekten kullandığı kelimeler, big: nadirler dahil bütün liste
export function loadLists() {
  if (!listsP) {
    listsP = Promise.all([readSet('yaygin.txt'), readSet('words.txt')]).then(([common, big]) => ({ common, big }));
    listsP.catch(() => { listsP = null; });
  }
  return listsP;
}

/* ---------- Parmak takibi: bağ kolay kopmasın ---------- */

const ADD = 0.8; // yeni harf için gözün iç bölgesine girmek yeter, yanından geçmek yetmez
const START = 1.05; // ilk dokunuş cömert
const BACK = 0.42; // geri almak için önceki harfin tam ortasına dönmek gerekir
const BACK_MS = 130; // ve orada kısa süre durmak
const GRACE_MS = 140; // parmak bir anlık kalkarsa bu kadar beklenir
const RESUME = 1.7; // aynı yerin yakınına dönerse iz sürer

// o: { game, cells(), radius(), canLink(a, b), valid(), onStart(i), onAdd(i), onPop(), onChange(), submit(), tap }
export function letterLink(my, cv, o) {
  const { game } = o;
  const finger = { on: false, x: 0, y: 0 };
  let id = null;
  let box = null;
  let moved = false;
  let backAt = 0;
  let graceId = 0;
  let nearI = -1;
  let nearD = 0;

  const nearest = (x, y) => {
    const list = o.cells();
    nearI = -1;
    nearD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const d = Math.hypot(list[i].x - x, list[i].y - y);
      if (d < nearD) { nearD = d; nearI = i; }
    }
  };

  function step(x, y, now) {
    const s = game.sel;
    const k = s.length;
    if (!k) return;
    const r = o.radius();
    nearest(x, y);
    if (nearI < 0 || nearI === s[k - 1]) { backAt = 0; return; }
    if (k > 1 && nearI === s[k - 2]) {
      if (nearD >= r * BACK) { backAt = 0; return; }
      if (!backAt) { backAt = now + BACK_MS; return; }
      if (now >= backAt) {
        s.pop();
        backAt = 0;
        moved = true;
        o.onPop();
        o.onChange();
      }
      return;
    }
    backAt = 0;
    if (nearD > r * ADD || s.includes(nearI) || !o.canLink(s[k - 1], nearI)) return;
    s.push(nearI);
    moved = true;
    game.tapped = false;
    o.onAdd(nearI);
    o.onChange();
  }

  // Hızlı sürüşlerde aradaki gözler kaçmasın diye yol parça parça yürünür
  function moveTo(x, y, now) {
    const dx = x - finger.x;
    const dy = y - finger.y;
    const n = Math.min(10, Math.max(1, Math.ceil(Math.hypot(dx, dy) / (o.radius() * 0.4))));
    for (let k = 1; k <= n; k++) step(finger.x + (dx * k) / n, finger.y + (dy * k) / n, now);
    finger.x = x;
    finger.y = y;
  }

  const hold = (e, x, y) => {
    id = e.pointerId;
    finger.on = true;
    finger.x = x;
    finger.y = y;
    backAt = 0;
    try { cv.setPointerCapture(e.pointerId); } catch { /* yapay olaylarda yakalama olmaz */ }
  };

  my.on(cv, 'pointerdown', (e) => {
    if (game.paused || game.done) return;
    // İkinci parmak ya da tableti tutan el seçimi bozmaz
    if (id !== null) return;
    box = cv.getBoundingClientRect();
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    if (graceId) {
      clearTimeout(graceId);
      graceId = 0;
      if (Math.hypot(x - finger.x, y - finger.y) < o.radius() * RESUME) {
        hold(e, x, y);
        return;
      }
      o.submit();
    }
    nearest(x, y);
    if (nearI < 0 || nearD > o.radius() * START) return;
    const i = nearI;
    hold(e, x, y);
    moved = false;
    if (o.tap && game.tapped && game.sel.length) {
      const s = game.sel;
      const last = s[s.length - 1];
      if (i === last) s.pop();
      else if (o.canLink(last, i) && !s.includes(i)) s.push(i);
      else game.sel = [i];
      o.onStart(i);
      o.onChange();
      return;
    }
    game.sel = [i];
    o.onStart(i);
    o.onChange();
  });

  my.on(cv, 'pointermove', (e) => {
    if (id === null || e.pointerId !== id) return;
    const now = performance.now();
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
    if (list && list.length) for (const p of list) moveTo(p.clientX - box.left, p.clientY - box.top, now);
    else moveTo(e.clientX - box.left, e.clientY - box.top, now);
  });

  const end = (e) => {
    if (id === null || e.pointerId !== id) return;
    id = null;
    finger.on = false;
    if (game.done) { game.sel = []; o.onChange(); return; }
    if (!moved && o.tap) {
      game.tapped = game.sel.length > 0;
      o.onChange();
      return;
    }
    // Geçerli kelime anında gider; eksik kelimede parmağın dönmesi için bir an beklenir
    if (!moved || game.sel.length < 2 || o.valid()) { o.submit(); return; }
    graceId = my.timeout(() => {
      graceId = 0;
      if (id === null) o.submit();
    }, GRACE_MS);
  };
  my.on(window, 'pointerup', end);
  my.on(window, 'pointercancel', end);
  my.on(cv, 'lostpointercapture', end);

  return {
    finger,
    // Geri alma süresi parmak dururken de işlesin
    tick() { if (finger.on && backAt) step(finger.x, finger.y, performance.now()); },
  };
}

/* ---------- Çizimler ---------- */

export const hexPath = (g, x, y, s) => {
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * s;
    const py = y + Math.sin(a) * s;
    if (k) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath();
};

// Harfler arasındaki ip: seçili gözlerden parmağa uzanır
export function drawRope(g, pts, finger, w, kind, t) {
  if (!pts.length || (pts.length < 2 && !finger.on)) return;
  g.beginPath();
  pts.forEach((p, k) => { if (k) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); });
  if (finger.on) g.lineTo(finger.x, finger.y);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(42,22,54,.38)';
  g.lineWidth = w * 0.42;
  g.stroke();
  g.strokeStyle = kind === 'ok' ? 'rgba(46,230,160,.95)' : kind === 'extra' ? 'rgba(130,220,255,.9)' : 'rgba(255,255,255,.78)';
  g.lineWidth = w * 0.2;
  g.shadowColor = kind === 'ok' ? '#2ee6a0' : kind === 'extra' ? '#8ad8ff' : '#fff6d8';
  g.shadowBlur = 14 + Math.sin(t / 120) * 5;
  g.stroke();
  g.shadowBlur = 0;
}

export const drawBee = (g, x, y, s, t, ang = 0) => {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const flap = Math.sin(t / 26);
  g.globalAlpha = 0.85;
  for (const d of [-1, 1]) {
    g.beginPath();
    g.ellipse(d * s * 0.5, -s * 0.6, s * 0.55, s * 0.3 * (0.5 + Math.abs(flap) * 0.6), d * 0.5, 0, Math.PI * 2);
    g.fillStyle = '#eaf6ff';
    g.fill();
  }
  g.globalAlpha = 1;
  g.beginPath();
  g.ellipse(0, 0, s * 0.85, s * 0.6, 0, 0, Math.PI * 2);
  g.fillStyle = '#ffcd3c';
  g.fill();
  g.lineWidth = s * 0.16;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = INK;
  g.fillRect(-s * 0.18, -s * 0.52, s * 0.22, s * 1.04);
  g.fillRect(s * 0.26, -s * 0.42, s * 0.2, s * 0.84);
  g.beginPath();
  g.arc(-s * 0.52, -s * 0.12, s * 0.1, 0, Math.PI * 2);
  g.fill();
  g.restore();
};

// Zemin bir kez çizilir, sonra her karede resim olarak basılır
export function combBackdrop(W, H, dpr, bs) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * dpr);
  c.height = Math.ceil(H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#ffe9a8');
  bg.addColorStop(1, '#ffb31a');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.16;
  g.fillStyle = '#fff6d8';
  for (let r = -1; r < H / (bs * 1.5) + 1; r++) {
    for (let col = -1; col < W / (bs * 1.74) + 1; col++) {
      hexPath(g, col * bs * 1.74 + (r % 2 ? bs * 0.87 : 0), r * bs * 1.5, bs * 0.94);
      g.fill();
    }
  }
  return c;
}

export function drawJar(g, x, y, jr, fillK, pulse, t, rrect) {
  g.save();
  g.translate(x, y);
  const kp = 1 + pulse * 0.14;
  g.scale(kp, 2 - kp);
  rrect(g, -jr * 0.72, -jr * 0.9, jr * 1.44, jr * 1.8, jr * 0.3);
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.fill();
  g.lineWidth = 3.5;
  g.strokeStyle = INK;
  g.stroke();
  g.save();
  rrect(g, -jr * 0.72, -jr * 0.9, jr * 1.44, jr * 1.8, jr * 0.3);
  g.clip();
  const hy = jr * 0.9 - fillK * jr * 1.8;
  g.fillStyle = '#f0a000';
  g.beginPath();
  g.moveTo(-jr * 0.8, hy);
  for (let px = -jr * 0.8; px <= jr * 0.8; px += 6) g.lineTo(px, hy + Math.sin(px / 9 + t / 260) * 2.6);
  g.lineTo(jr * 0.8, jr);
  g.lineTo(-jr * 0.8, jr);
  g.closePath();
  g.fill();
  g.restore();
  rrect(g, -jr * 0.5, -jr * 1.15, jr, jr * 0.34, jr * 0.14);
  g.fillStyle = '#c98b52';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.stroke();
  g.restore();
}
