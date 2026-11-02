// Çiz Geç: tahtaya tebeşirle ne çizersen o düşer. Çizgini topun altına koy, rampa yap, yuvarla, kalbe ulaştır.
// Tebeşirin sınırlı. Dikenlere değdirme. Her bölümün kendi düzeni var, çözümü senin elinde.

import { Life, html, toHTML, fitCanvas, clamp, rand, seeded } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, label, heartPath, shake } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';

const W0 = 900;
const H0 = 1200;
const LEVELS = 24;

let matterP = null;
function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  if (!matterP) {
    matterP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = new URL('../../vendor/matter.min.js', import.meta.url).href;
      s.onload = () => res(window.Matter);
      s.onerror = () => rej(new Error('matter'));
      document.head.appendChild(s);
    });
  }
  return matterP;
}

// Bölüm düzeni: top nerede başlar, kalp nerede, hangi engeller var
function makeLevel(li) {
  const rng = seeded(1700 + li * 41);
  const walls = [];
  const spikes = [];
  const movers = [];
  const ball = { x: 150, y: 180 };
  const goal = { x: W0 - 160, y: 300 + rng.int(0, 5) * 110 };
  const shelf = (x, y, w, a = 0) => walls.push({ x, y, w, h: 26, a });
  shelf(150, 300, 260);
  const bands = 1 + Math.min(3, Math.floor(li / 5));
  for (let b = 0; b < bands; b++) {
    const y = 480 + b * 230;
    const x = b % 2 ? W0 * 0.28 : W0 * 0.72;
    shelf(x, y, rng.range(200, 330), rng.range(-0.12, 0.12));
    if (li >= 4 && rng.range(0, 1) < 0.6) {
      const sx = x + (b % 2 ? 1 : -1) * rng.range(150, 260);
      spikes.push({ x: clamp(sx, 90, W0 - 90), y: y - 28, n: 4 });
    }
    if (li >= 9 && rng.range(0, 1) < 0.5) movers.push({ x: rng.range(220, W0 - 220), y: y - 150, w: rng.range(90, 150), amp: rng.range(80, 180), sp: rng.range(0.4, 0.9), ph: rng.range(0, 6) });
  }
  shelf(goal.x, goal.y + 70, 300);
  if (li >= 2) shelf(W0 * 0.5, goal.y - 180, 180, rng.range(-0.5, 0.5));
  const ink = Math.round(clamp(3000 - li * 45, 1700, 3000));
  return { ball, goal, walls, spikes, movers, ink, par: ink * 0.5 };
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], solved: 0, chalk: 0 });
  const f = api.frame({ onBack: () => api.exit() });
  let local = null;
  let st = null;
  const end = () => {
    if (local) local.dispose();
    local = null;
    st = null;
  };

  function menu() {
    end();
    f.onBack = () => api.exit();
    f.setTitle(api.game.title);
    menuScreen(f.main, api.game, {
      art: ART.ciz,
      sub: 'Tebeşirle çiz, çizdiğin düşer. Topu kalbe ulaştır.',
      stats: [['Çözülen Bölüm', data.solved], ['Harcanan Tebeşir', Math.round(data.chalk)]],
      how: [
        'Parmağını tahtada gezdir: tebeşir çizgisi çıkar ve gerçek bir cisim gibi düşer.',
        'Topun altına rampa çiz, yolunu kapat, sek. İstediğin şekli çizebilirsin.',
        'Tebeşirin sınırlı. Üstteki çubuk ne kadar kaldığını gösterir.',
        'Dikenlere değerse top kırılır. Sil düğmesiyle çizdiklerini kaldırıp baştan dene.',
        'Az tebeşirle bitirirsen üç yıldız.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Tahtalar', onPick: (i) => play(i) },
    });
  }

  async function play(li) {
    end();
    local = new Life();
    const my = local;
    const lv = makeLevel(li);
    const fx = makeFx();
    const game = { ink: lv.ink, used: 0, done: false, won: false, paused: false, drawing: null, strokes: [], tries: 0, loading: true };
    st = game;

    f.setTitle(`Tahta ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="cz">
        <canvas class="cz-cv"></canvas>
        <div class="cz-top">
          <span class="cz-ink"><small>Tebeşir</small><i><u data-ink></u></i></span>
          <button class="cz-b" data-act="undo">${icon('arrow')}Geri Al</button>
          <button class="cz-b" data-act="clear">${icon('trash')}Sil</button>
        </div>
        <div class="cz-wait" data-wait>Tahta siliniyor...</div>
      </div>`);
    const wrap = f.main.querySelector('.cz');
    const cv = wrap.querySelector('.cz-cv');
    const inkEl = wrap.querySelector('[data-ink]');
    const stage = fitCanvas(cv, my);

    const M = await loadMatter().catch(() => null);
    if (!my.alive) return;
    if (!M) {
      wrap.querySelector('[data-wait]').textContent = 'Fizik motoru yüklenemedi.';
      return;
    }
    wrap.querySelector('[data-wait]').remove();
    game.loading = false;

    const engine = M.Engine.create({ gravity: { x: 0, y: 1.3 } });
    const world = engine.world;
    my.add(() => {
      M.Composite.clear(world, false);
      M.Engine.clear(engine);
    });
    const add = (b) => { M.Composite.add(world, b); return b; };

    add(M.Bodies.rectangle(-40, H0 / 2, 80, H0 * 3, { isStatic: true }));
    add(M.Bodies.rectangle(W0 + 40, H0 / 2, 80, H0 * 3, { isStatic: true }));
    for (const w of lv.walls) add(M.Bodies.rectangle(w.x, w.y, w.w, w.h, { isStatic: true, angle: w.a, friction: 0.55, label: 'raf' }));
    const spikeBodies = lv.spikes.map((s) => add(M.Bodies.rectangle(s.x, s.y, s.n * 26, 26, { isStatic: true, isSensor: true, label: 'diken', plugin: { n: s.n } })));
    const moverBodies = lv.movers.map((m) => add(M.Bodies.rectangle(m.x, m.y, m.w, 24, { isStatic: true, label: 'asansor', plugin: { ...m } })));
    const goal = add(M.Bodies.circle(lv.goal.x, lv.goal.y, 42, { isStatic: true, isSensor: true, label: 'kalp' }));
    const ball = add(M.Bodies.circle(lv.ball.x, lv.ball.y, 26, { restitution: 0.42, friction: 0.03, density: 0.0018, label: 'top' }));
    game.ball = ball;
    game.goal = goal;

    M.Events.on(engine, 'collisionStart', (ev) => {
      for (const p of ev.pairs) {
        const labels = [p.bodyA.label, p.bodyB.label];
        if (labels.includes('top') && labels.includes('kalp') && !game.done) win();
        if (labels.includes('top') && labels.includes('diken') && !game.done) lose('diken');
      }
    });

    let view = { s: 1, x: 0, y: 0 };
    const fit = () => {
      const { W, H } = stage;
      const s = Math.min(W / W0, H / H0);
      view = { s, x: (W - W0 * s) / 2, y: (H - H0 * s) / 2 };
    };
    const toWorld = (x, y) => ({ x: (x - view.x) / view.s, y: (y - view.y) / view.s });
    fit();

    const setInk = () => { inkEl.style.width = `${clamp(((lv.ink - game.used) / lv.ink) * 100, 0, 100)}%`; };
    setInk();

    // Çizgi: noktalar seyreltilir, her parça bir dikdörtgen, hepsi tek cisim
    function commit(pts) {
      if (pts.length < 2) return;
      const parts = [];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < 1) continue;
        parts.push(M.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, d + 13, 13, { angle: Math.atan2(b.y - a.y, b.x - a.x) }));
      }
      if (!parts.length) return;
      const body = M.Body.create({ parts, friction: 0.5, frictionStatic: 0.9, restitution: 0.1, density: 0.0009, label: 'tebesir' });
      add(body);
      game.strokes.push(body);
      sfx.tick();
    }

    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      return toWorld(e.clientX - r.left, e.clientY - r.top);
    };
    my.on(cv, 'pointerdown', (e) => {
      if (game.paused || game.done || game.used >= lv.ink) return;
      game.drawing = { pts: [pos(e)] };
      sfx.soft();
    });
    my.on(cv, 'pointermove', (e) => {
      const d = game.drawing;
      if (!d) return;
      const p = pos(e);
      const last = d.pts[d.pts.length - 1];
      const dist = Math.hypot(p.x - last.x, p.y - last.y);
      if (dist < 16) return;
      if (game.used + dist > lv.ink) {
        endStroke();
        toast('Tebeşir bitti.');
        return;
      }
      game.used += dist;
      data.chalk += dist;
      d.pts.push(p);
      setInk();
      if (d.pts.length % 3 === 0) tone({ type: 'square', f: 2400 + Math.random() * 600, dur: 0.02, vol: 0.012 });
    });
    const endStroke = () => {
      if (!game.drawing) return;
      const pts = game.drawing.pts;
      game.drawing = null;
      commit(pts);
    };
    my.on(window, 'pointerup', endStroke);
    my.on(window, 'pointercancel', endStroke);

    my.on(wrap, 'click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || game.done) return;
      sfx.tap();
      if (b.dataset.act === 'undo') {
        const s = game.strokes.pop();
        if (s) M.Composite.remove(world, s);
      } else {
        for (const s of game.strokes) M.Composite.remove(world, s);
        game.strokes = [];
        reset();
      }
    });

    function reset() {
      M.Body.setPosition(ball, { x: lv.ball.x, y: lv.ball.y });
      M.Body.setVelocity(ball, { x: 0, y: 0 });
      M.Body.setAngularVelocity(ball, 0);
      game.tries++;
    }

    function lose(why) {
      if (game.done) return;
      game.broke = 0.9;
      sfx.splat();
      buzz(50);
      shake(wrap, 10);
      fx.burst(view.x + ball.position.x * view.s, view.y + ball.position.y * view.s, { n: 20, colors: ['#ff5fa2', '#fff'], power: 300 });
      my.timeout(() => {
        if (game.done) return;
        reset();
        toast(why === 'diken' ? 'Diken! Top baştan başladı.' : 'Top düştü, baştan.');
      }, 700);
    }

    function win() {
      if (game.done) return;
      game.done = true;
      game.won = true;
      data.solved++;
      const stars = game.used <= lv.par * 0.7 ? 3 : game.used <= lv.par ? 2 : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = 7 + stars * 6;
      api.finish({ coins });
      sfx.fanfare();
      fx.burst(view.x + goal.position.x * view.s, view.y + goal.position.y * view.s, { n: 36, colors: ['#ff5fa2', '#fff', '#ffcd3c'], power: 420, shape: 'heart' });
      my.timeout(() => {
        resultSheet({
          won: true,
          title: 'Kalbe Ulaştı!',
          sub: stars === 3 ? 'Bir avuç tebeşirle hallettin.' : 'Oldu. Daha az çizgiyle dene, üç yıldız gelsin.',
          stars,
          coins,
          stats: [['Tebeşir', `${Math.round(game.used)} / ${lv.ink}`], ['Çizgi', game.strokes.length], ['Deneme', game.tries + 1]],
          buttons: [
            ...(li + 1 < LEVELS ? [{ label: 'Sonraki Tahta', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', icon: 'replay', act: () => play(li) },
            { label: 'Tahtalar', icon: 'list', act: () => menu() },
          ],
        });
      }, 900);
    }

    f.onBack = () => {
      if (game.done) { menu(); return; }
      game.paused = true;
      pauseSheet({
        onResume: () => { game.paused = false; },
        onRestart: () => play(li),
        onQuit: () => menu(),
      });
    };

    // Silinmiş tebeşir izleri: bir kez üretilir, her karede aynı kalır
    const sr = seeded(li * 991 + 7);
    const smudges = Array.from({ length: 22 }, () => [sr.range(0, W0), sr.range(0, H0), sr.range(0, W0), sr.range(0, H0), sr.range(0, W0), sr.range(0, H0), sr.range(7, 26)]);

    const chalkLine = (g, verts, lw, color) => {
      g.beginPath();
      g.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) g.lineTo(verts[i].x, verts[i].y);
      g.strokeStyle = color;
      g.lineWidth = lw;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke();
    };

    my.raf((dt, t) => {
      const { W, H, g } = stage;
      stage.begin();
      fit();
      if (!game.paused && !game.done) {
        for (const b of moverBodies) {
          const p = b.plugin;
          M.Body.setPosition(b, { x: p.x + Math.sin(t / 1000 * p.sp + p.ph) * p.amp, y: p.y });
        }
        M.Engine.update(engine, Math.min(32, dt * 1000));
        if (ball.position.y > H0 + 120) lose('dustu');
      }
      if (game.broke > 0) game.broke -= dt;

      // Tahta
      g.fillStyle = '#20392e';
      g.fillRect(0, 0, W, H);
      g.save();
      g.translate(view.x, view.y);
      g.scale(view.s, view.s);
      g.fillStyle = '#2f4a3c';
      g.fillRect(0, 0, W0, H0);
      g.globalAlpha = 0.06;
      g.strokeStyle = '#fff';
      for (const m of smudges) {
        g.beginPath();
        g.moveTo(m[0], m[1]);
        g.quadraticCurveTo(m[2], m[3], m[4], m[5]);
        g.lineWidth = m[6];
        g.stroke();
      }
      g.globalAlpha = 1;

      // Raflar
      for (const b of M.Composite.allBodies(world)) {
        if (b.label === 'raf' || b.label === 'asansor') {
          g.save();
          g.translate(b.position.x, b.position.y);
          g.rotate(b.angle);
          const w = b.bounds.max.x - b.bounds.min.x;
          g.fillStyle = b.label === 'asansor' ? '#c9d8a0' : '#e8f3d8';
          g.fillRect(-w / 2, -13, w, 26);
          g.strokeStyle = 'rgba(32,57,46,.5)';
          g.lineWidth = 3;
          g.strokeRect(-w / 2, -13, w, 26);
          g.restore();
        }
      }
      // Dikenler
      for (const s of spikeBodies) {
        const n = s.plugin.n;
        const w = n * 26;
        g.beginPath();
        for (let k = 0; k < n; k++) {
          const x = s.position.x - w / 2 + k * 26;
          g.moveTo(x, s.position.y + 13);
          g.lineTo(x + 13, s.position.y - 15);
          g.lineTo(x + 26, s.position.y + 13);
        }
        g.closePath();
        g.fillStyle = '#ffd1dc';
        g.fill();
        g.strokeStyle = '#ff5fa2';
        g.lineWidth = 3;
        g.stroke();
      }
      // Kalp hedefi
      g.save();
      g.translate(goal.position.x, goal.position.y);
      const kb = 1 + Math.sin(t / 320) * 0.08;
      g.scale(kb, kb);
      heartPath(g, 0, 0, 46);
      g.fillStyle = 'rgba(255,95,162,.25)';
      g.fill();
      g.strokeStyle = '#ff9ec0';
      g.lineWidth = 5;
      g.stroke();
      g.restore();

      // Tebeşir çizgileri
      for (const b of game.strokes) {
        for (const part of (b.parts.length > 1 ? b.parts.slice(1) : b.parts)) {
          const v = part.vertices;
          g.beginPath();
          g.moveTo(v[0].x, v[0].y);
          for (let i = 1; i < v.length; i++) g.lineTo(v[i].x, v[i].y);
          g.closePath();
          g.fillStyle = '#f2f7e8';
          g.fill();
        }
      }
      if (game.drawing && game.drawing.pts.length > 1) chalkLine(g, game.drawing.pts, 13, 'rgba(242,247,232,.85)');

      // Top
      g.save();
      g.translate(ball.position.x, ball.position.y);
      g.rotate(ball.angle);
      g.beginPath();
      g.arc(0, 0, 26, 0, Math.PI * 2);
      g.fillStyle = game.broke > 0 ? '#ffd1dc' : '#ffcd3c';
      g.fill();
      g.lineWidth = 5;
      g.strokeStyle = '#20392e';
      g.stroke();
      g.fillStyle = '#20392e';
      g.beginPath();
      g.arc(-9, -4, 3.4, 0, Math.PI * 2);
      g.arc(9, -4, 3.4, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(0, 4, 9, 0.2, Math.PI - 0.2);
      g.lineWidth = 3.4;
      g.stroke();
      g.restore();
      g.restore();

      if (!game.strokes.length && !game.drawing && !game.done) label(g, W / 2, H - 26, 'Parmağınla tahtaya çiz', { size: 15, color: '#e8f3d8', stroke: '#20392e', font: '"Patrick Hand", sans-serif' });
      fx.draw(g, game.paused ? 0 : dt);
      return undefined;
    });
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
