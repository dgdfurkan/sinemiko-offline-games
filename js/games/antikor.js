// Antikor Atışı: aşağıdaki fırlatıcıyı geri çek, bırak. Antikor yukarı uçar, duvarlardan seker.
// Üstteki platformlarda mikroplar oturuyor. Ya sert vurup patlat ya da altlarını boşaltıp asit havuzuna düşür.
// Uçarken ekrana dokununca her merminin kendi numarası var: makrofaj ağırlaşır, enzim üçe bölünür, komplеman patlar.

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, randInt, seeded } from '../core/dom.js';
import { sfx, buzz, tone } from '../core/audio.js';
import { makeFx, rrect, label, inked, shake } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { ART } from '../art.js';

const W0 = 760;
const H0 = 1180;
const POOL_Y = H0 - 70;
const LAUNCH = { x: W0 / 2, y: H0 - 150 };
const LEVELS = 30;

const AMMO = {
  antikor: { name: 'Antikor', c: '#8ccf3e', r: 17, den: 0.0026, tip: 'Dokun: en yakın mikroba kilitlenir' },
  makrofaj: { name: 'Makrofaj', c: '#ffcd3c', r: 25, den: 0.0062, tip: 'Dokun: ağırlaşıp aşağı çakılır' },
  enzim: { name: 'Enzim', c: '#4fb6ff', r: 15, den: 0.0022, tip: 'Dokun: üçe bölünür' },
  komple: { name: 'Komplеman', c: '#ff5fa2', r: 16, den: 0.003, tip: 'Dokun: patlar' },
};
const MAT = {
  tahta: { c: '#c98b52', d: '#8a5a2c', hp: 26, den: 0.0012 },
  cam: { c: '#9fe8ff', d: '#4fa8c8', hp: 10, den: 0.0008 },
  tas: { c: '#9aa3b2', d: '#5d6675', hp: 60, den: 0.0035 },
};

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

// Bölüm kurulumu: platformlar, üstlerinde yığınlar, yığınlarda mikroplar
function makeLevel(li) {
  const rng = seeded(991 + li * 53);
  const kinds = ['antikor'];
  if (li >= 3) kinds.push('komple');
  if (li >= 6) kinds.push('enzim');
  if (li >= 10) kinds.push('makrofaj');
  const rows = clamp(2 + Math.floor(li / 7), 2, 4);
  const platforms = [];
  const blocks = [];
  const microbes = [];
  for (let r = 0; r < rows; r++) {
    const y = 200 + r * 210;
    const n = r === 0 ? 1 : rng.int(1, 2);
    const slots = rng.shuffle([0, 1, 2]).slice(0, n);
    for (const sl of slots) {
      const cx = 150 + sl * 230 + rng.range(-24, 24);
      const w = rng.range(150, 215);
      platforms.push({ x: cx, y, w, h: 22 });
      const mat = li < 4 ? 'tahta' : rng.pick(li < 12 ? ['tahta', 'cam'] : ['tahta', 'cam', 'tas']);
      const cols = rng.int(2, 3);
      const bh = rng.range(54, 78);
      for (let c = 0; c < cols; c++) {
        const bx = cx - (w / 2) + (w / (cols + 1)) * (c + 1);
        blocks.push({ x: bx, y: y - 11 - bh / 2, w: 30, h: bh, mat });
      }
      const topY = y - 11 - bh - 11;
      blocks.push({ x: cx, y: topY, w: w * 0.86, h: 22, mat });
      const mn = rng.int(1, li >= 8 ? 2 : 1);
      for (let k = 0; k < mn; k++) {
        microbes.push({ x: cx + (k - (mn - 1) / 2) * 56, y: topY - 34, kind: li >= 14 && rng.range(0, 1) < 0.35 ? 'spor' : 'mikrop' });
      }
      if (li >= 9 && rng.range(0, 1) < 0.45) {
        blocks.push({ x: cx - w * 0.36, y: topY - 34, w: 24, h: 48, mat: 'cam' });
        blocks.push({ x: cx + w * 0.36, y: topY - 34, w: 24, h: 48, mat: 'cam' });
      }
    }
  }
  const ammo = [];
  const total = clamp(microbes.length + 1, 3, 6);
  for (let i = 0; i < total; i++) ammo.push(kinds[i % kinds.length]);
  return { platforms, blocks, microbes, ammo, par: Math.max(1, microbes.length) };
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], killed: 0, shots: 0 });
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
      art: ART.antikor,
      sub: 'Fırlatıcıyı ger, bırak. Yukarıdaki mikropları ya patlat ya da asit havuzuna düşür.',
      stats: [['Temizlenen Mikrop', data.killed], ['Atış', data.shots]],
      how: [
        'Ekranda aşağı doğru sürükle: lastik gerilir. Bıraktığın anda mermi yukarı fırlar.',
        'Mermi yan duvarlardan seker. Açıyı duvara göre ayarlamayı öğrenirsen her yere ulaşırsın.',
        'Uçarken ekrana dokun: her merminin kendi numarası var. Altta hangi mermi olduğu yazar.',
        'Mikrop sert darbe yerse patlar. Platformu yıkıp aşağıdaki asit havuzuna düşürmek de sayılır.',
        'Az mermiyle bitir, üç yıldız senin.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Bölümler', onPick: (i) => play(i) },
    });
  }

  async function play(li) {
    end();
    local = new Life();
    const my = local;
    const lv = makeLevel(li);
    const fx = makeFx();
    const game = {
      shots: 0, left: lv.ammo.length, killed: 0, total: lv.microbes.length,
      done: false, paused: false, loading: true, drag: null, flying: null, used: false,
      shake: 0, settle: 0, ammo: lv.ammo.slice(),
    };
    st = game;

    f.setTitle(`Bölüm ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="ak">
        <canvas class="ak-cv"></canvas>
        <div class="ak-hud">
          <span class="ak-left"><b data-left>${game.left}</b><small>mermi</small></span>
          <span class="ak-mic"><b data-mic>0</b><small>/ ${game.total} mikrop</small></span>
        </div>
        <div class="ak-ammo" data-ammo></div>
        <div class="ak-wait" data-wait>Laboratuvar kuruluyor...</div>
      </div>`);
    const wrap = f.main.querySelector('.ak');
    const cv = wrap.querySelector('.ak-cv');
    const leftEl = wrap.querySelector('[data-left]');
    const micEl = wrap.querySelector('[data-mic]');
    const ammoEl = wrap.querySelector('[data-ammo]');
    const stage = fitCanvas(cv, my);

    const M = await loadMatter().catch(() => null);
    if (!my.alive) return;
    if (!M) {
      wrap.querySelector('[data-wait]').textContent = 'Fizik motoru yüklenemedi.';
      return;
    }
    wrap.querySelector('[data-wait]').remove();
    game.loading = false;

    const engine = M.Engine.create({ gravity: { x: 0, y: 1.6 } });
    const world = engine.world;
    my.add(() => {
      M.Composite.clear(world, false);
      M.Engine.clear(engine);
    });
    const add = (b) => { M.Composite.add(world, b); return b; };
    const wallOpts = { isStatic: true, restitution: 0.72, friction: 0.04, label: 'duvar' };
    add(M.Bodies.rectangle(-30, H0 / 2, 60, H0 * 2, wallOpts));
    add(M.Bodies.rectangle(W0 + 30, H0 / 2, 60, H0 * 2, wallOpts));
    add(M.Bodies.rectangle(W0 / 2, -30, W0 * 2, 60, wallOpts));
    const pool = add(M.Bodies.rectangle(W0 / 2, POOL_Y + 60, W0, 140, { isStatic: true, isSensor: true, label: 'havuz' }));
    const floor = add(M.Bodies.rectangle(W0 / 2, H0 + 40, W0 * 2, 80, { isStatic: true, label: 'taban' }));

    for (const p of lv.platforms) add(M.Bodies.rectangle(p.x, p.y, p.w, p.h, { isStatic: true, friction: 0.9, label: 'platform', plugin: { kind: 'platform' } }));
    for (const b of lv.blocks) {
      const m = MAT[b.mat];
      add(M.Bodies.rectangle(b.x, b.y, b.w, b.h, { density: m.den, friction: 0.6, restitution: 0.08, label: 'blok', plugin: { kind: 'blok', mat: b.mat, hp: m.hp, max: m.hp } }));
    }
    for (const q of lv.microbes) {
      const spor = q.kind === 'spor';
      add(M.Bodies.circle(q.x, q.y, spor ? 26 : 22, { density: 0.0012, friction: 0.5, restitution: 0.2, label: 'mikrop', plugin: { kind: 'mikrop', hp: spor ? 26 : 13, max: spor ? 26 : 13, spor, wob: rand(0, 6) } }));
    }

    const micLeft = () => M.Composite.allBodies(world).filter((b) => b.plugin && b.plugin.kind === 'mikrop').length;

    function kill(b, byPool) {
      if (!b.plugin || b.plugin.dead) return;
      b.plugin.dead = true;
      M.Composite.remove(world, b);
      game.killed++;
      data.killed++;
      micEl.textContent = game.killed;
      fx.burst(...toScreen(b.position.x, b.position.y), { n: 22, colors: ['#8ccf3e', '#eaffd0', '#ffcd3c'], power: 300 });
      if (byPool) sfx.sizzle ? sfx.sizzle() : sfx.splat(); else sfx.splat();
      tone({ type: 'triangle', f: 420 + game.killed * 70, f2: 900, dur: 0.16, vol: 0.08 });
      buzz(22);
      game.shake = 7;
      if (micLeft() === 0) my.timeout(() => finish(true), 700);
    }

    function hurt(b, amount, at) {
      const p = b.plugin;
      if (!p || p.dead || amount < 2) return;
      p.hp -= amount;
      if (p.kind === 'mikrop') {
        if (p.hp <= 0) { kill(b, false); return; }
        p.ouch = 0.4;
        sfx.squish ? sfx.squish() : sfx.thud();
      } else if (p.kind === 'blok') {
        if (p.hp <= 0) {
          p.dead = true;
          M.Composite.remove(world, b);
          fx.burst(...toScreen(at.x, at.y), { n: 14, colors: [MAT[p.mat].c, MAT[p.mat].d], power: 230, shape: 'square' });
          sfx[p.mat === 'cam' ? 'zap' : 'thud']();
        } else sfx.tick();
      }
    }

    M.Events.on(engine, 'collisionStart', (ev) => {
      for (const pair of ev.pairs) {
        for (const [a, b] of [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]]) {
          if (a.label === 'havuz' && b.plugin && (b.plugin.kind === 'mikrop' || b.plugin.kind === 'blok')) {
            if (b.plugin.kind === 'mikrop') kill(b, true);
            else { b.plugin.dead = true; M.Composite.remove(world, b); fx.burst(...toScreen(b.position.x, POOL_Y), { n: 10, colors: ['#8ccf3e', '#fff'], power: 170 }); }
            continue;
          }
          if (a.label === 'havuz' && b.plugin && b.plugin.kind === 'mermi') {
            b.plugin.dead = true;
            M.Composite.remove(world, b);
            if (game.flying === b) game.flying = null;
            fx.burst(...toScreen(b.position.x, POOL_Y), { n: 12, colors: ['#8ccf3e', '#dfffb0'], power: 180 });
            sfx.bubble();
          }
        }
        const sp = Math.hypot(pair.bodyA.velocity.x - pair.bodyB.velocity.x, pair.bodyA.velocity.y - pair.bodyB.velocity.y);
        if (sp < 4) continue;
        const at = pair.collision ? pair.collision.supports[0] || pair.bodyA.position : pair.bodyA.position;
        for (const [a, b] of [[pair.bodyA, pair.bodyB], [pair.bodyB, pair.bodyA]]) {
          if (!a.plugin || !a.plugin.kind || a.isStatic) continue;
          const mass = b.plugin && b.plugin.kind === 'mermi' ? b.mass * 900 : b.mass * 240;
          hurt(a, sp * clamp(mass, 0.4, 14) * 0.5, at);
        }
      }
    });

    /* ---------- Ölçek ---------- */
    let view = { s: 1, x: 0, y: 0 };
    const fit = () => {
      const { W, H } = stage;
      const s = Math.min(W / W0, H / H0);
      view = { s, x: (W - W0 * s) / 2, y: (H - H0 * s) / 2 };
    };
    const toScreen = (x, y) => [view.x + x * view.s, view.y + y * view.s];
    const toWorld = (x, y) => ({ x: (x - view.x) / view.s, y: (y - view.y) / view.s });
    fit();

    /* ---------- Atış ---------- */
    const kindNow = () => game.ammo[game.shots] || null;
    function syncAmmo() {
      const k = kindNow();
      leftEl.textContent = game.left;
      ammoEl.innerHTML = toHTML(k ? html`
        <span class="ak-pill" style="--c:${AMMO[k].c}"><i></i><b>${AMMO[k].name}</b><small>${AMMO[k].tip}</small></span>
        <span class="ak-next">${game.ammo.slice(game.shots + 1).map((q) => html`<i style="--c:${AMMO[q].c}"></i>`)}</span>` : html`<span class="ak-pill empty"><b>Mermi Bitti</b></span>`);
    }
    syncAmmo();

    function shoot(vx, vy) {
      const kind = kindNow();
      if (!kind || game.flying || game.done) return;
      const a = AMMO[kind];
      const b = M.Bodies.circle(LAUNCH.x, LAUNCH.y - 26, a.r, {
        density: a.den, restitution: 0.55, friction: 0.02, frictionAir: 0.002,
        label: 'mermi', plugin: { kind: 'mermi', type: kind, hp: 999, born: performance.now() },
      });
      M.Body.setVelocity(b, { x: vx, y: vy });
      M.Body.setAngularVelocity(b, rand(-0.3, 0.3));
      add(b);
      game.flying = b;
      game.shots++;
      game.left--;
      game.used = false;
      data.shots++;
      api.touch();
      syncAmmo();
      sfx.whoosh();
      buzz(18);
      game.shake = 4;
      fx.burst(...toScreen(LAUNCH.x, LAUNCH.y - 26), { n: 10, colors: [a.c, '#fff'], power: 200 });
    }

    // Uçarken ekrana dokunmak merminin numarasını çalıştırır
    function ability() {
      const b = game.flying;
      if (!b || game.used) return;
      game.used = true;
      const t = b.plugin.type;
      const [sx, sy] = toScreen(b.position.x, b.position.y);
      if (t === 'makrofaj') {
        M.Body.setDensity(b, 0.02);
        M.Body.setVelocity(b, { x: b.velocity.x * 0.4, y: Math.max(26, b.velocity.y + 18) });
        fx.ring(sx, sy, '#ffcd3c', 40);
        sfx.thud(1.4);
      } else if (t === 'enzim') {
        for (const d of [-0.6, 0.6]) {
          const c = M.Bodies.circle(b.position.x + d * 26, b.position.y, 11, { density: AMMO.enzim.den, restitution: 0.6, label: 'mermi', plugin: { kind: 'mermi', type: 'enzim', born: performance.now() } });
          M.Body.setVelocity(c, { x: b.velocity.x + d * 9, y: b.velocity.y * 0.9 });
          add(c);
        }
        fx.burst(sx, sy, { n: 16, colors: ['#4fb6ff', '#fff'], power: 260 });
        sfx.chop();
      } else if (t === 'komple') {
        const R = 170;
        for (const o of M.Composite.allBodies(world)) {
          if (o.isStatic || o === b) continue;
          const dx = o.position.x - b.position.x;
          const dy = o.position.y - b.position.y;
          const d = Math.hypot(dx, dy);
          if (d > R) continue;
          const k = (1 - d / R) * 0.26 * o.mass;
          M.Body.applyForce(o, o.position, { x: (dx / (d || 1)) * k, y: (dy / (d || 1)) * k });
          hurt(o, (1 - d / R) * 22, o.position);
        }
        b.plugin.dead = true;
        M.Composite.remove(world, b);
        game.flying = null;
        fx.ring(sx, sy, '#ff5fa2', 60);
        fx.burst(sx, sy, { n: 34, colors: ['#ff5fa2', '#ffcd3c', '#fff'], power: 420 });
        sfx.boom();
        buzz(60);
        game.shake = 14;
      } else {
        // Antikor: en yakın mikroba kilitlenir
        const tg = M.Composite.allBodies(world).filter((o) => o.plugin && o.plugin.kind === 'mikrop')
          .sort((p, q) => M.Vector.magnitude(M.Vector.sub(p.position, b.position)) - M.Vector.magnitude(M.Vector.sub(q.position, b.position)))[0];
        if (tg) {
          const dir = M.Vector.normalise(M.Vector.sub(tg.position, b.position));
          const sp = Math.max(22, M.Vector.magnitude(b.velocity));
          M.Body.setVelocity(b, { x: dir.x * sp, y: dir.y * sp });
          fx.ring(...toScreen(tg.position.x, tg.position.y), '#8ccf3e', 36);
          sfx.zap();
        }
      }
    }

    my.on(wrap, 'pointerdown', (e) => {
      if (game.paused || game.done) return;
      if (game.flying) { ability(); return; }
      if (!kindNow()) return;
      const w = toWorld(...(() => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; })());
      game.drag = { x: w.x, y: w.y };
    });
    my.on(wrap, 'pointermove', (e) => {
      if (!game.drag) return;
      const r = cv.getBoundingClientRect();
      const w = toWorld(e.clientX - r.left, e.clientY - r.top);
      game.drag = { x: w.x, y: w.y };
    });
    const release = () => {
      if (!game.drag) return;
      const dx = LAUNCH.x - game.drag.x;
      const dy = LAUNCH.y - game.drag.y;
      game.drag = null;
      const d = Math.hypot(dx, dy);
      if (d < 26) { sfx.soft(); return; }
      const power = Math.min(d, 280) / 280;
      const ang = Math.atan2(Math.min(dy, -12), dx);
      const sp = 22 + power * 32;
      shoot(Math.cos(ang) * sp, Math.sin(ang) * sp);
    };
    my.on(wrap, 'pointerup', release);
    my.on(wrap, 'pointercancel', release);

    function finish(won) {
      if (game.done) return;
      game.done = true;
      const stars = won ? (game.shots <= lv.par ? 3 : game.shots <= lv.par + 1 ? 2 : 1) : 0;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = won ? 7 + stars * 6 : 2;
      api.finish({ coins });
      my.timeout(() => {
        resultSheet({
          won,
          title: won ? 'Ortam Temiz!' : 'Mikroplar Kaldı',
          sub: won ? (stars === 3 ? 'Tek fazla mermi harcamadın.' : 'Temizledin. Daha az mermiyle dene.') : 'Mermin bitti. Alttaki blokları vurup yığını devirmeyi dene.',
          stars,
          coins,
          stats: [['Mikrop', `${game.killed} / ${game.total}`], ['Atış', game.shots], ['Hedef', lv.par]],
          buttons: [
            ...(stars && li + 1 < LEVELS ? [{ label: 'Sonraki Bölüm', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', main: !stars, icon: 'replay', act: () => play(li) },
            { label: 'Bölümler', icon: 'list', act: () => menu() },
          ],
        });
      }, 800);
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

    /* ---------- Çizim ---------- */
    const drawBody = (g, b, fill, stroke, lw) => {
      g.beginPath();
      const v = b.vertices;
      g.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) g.lineTo(v[i].x, v[i].y);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      if (lw) {
        g.lineWidth = lw;
        g.strokeStyle = stroke;
        g.stroke();
      }
    };

    my.raf((dt, t) => {
      const { W, H, g } = stage;
      stage.begin();
      fit();
      if (!game.paused && !game.loading) {
        M.Engine.update(engine, Math.min(32, dt * 1000));
        if (game.flying && (game.flying.plugin.dead || game.flying.position.y > H0 + 200 || performance.now() - game.flying.plugin.born > 9000)) {
          M.Composite.remove(world, game.flying);
          game.flying = null;
        }
        if (!game.flying && !game.done && !kindNow()) {
          game.settle += dt;
          if (game.settle > 2.6) finish(false);
        } else game.settle = 0;
      }
      if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 26);

      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0e2b1c');
      bg.addColorStop(1, '#06160f');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);

      g.save();
      g.translate(view.x + rand(-game.shake, game.shake), view.y + rand(-game.shake, game.shake));
      g.scale(view.s, view.s);

      // Petri duvarları ve ızgara
      g.fillStyle = 'rgba(140,207,62,.06)';
      g.fillRect(0, 0, W0, H0);
      g.strokeStyle = 'rgba(160,230,120,.1)';
      g.lineWidth = 2;
      for (let y = 0; y < H0; y += 80) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W0, y);
        g.stroke();
      }
      g.lineWidth = 10;
      g.strokeStyle = '#2a1636';
      g.strokeRect(0, 0, W0, H0);

      // Asit havuzu
      const py = POOL_Y + Math.sin(t / 420) * 3;
      g.beginPath();
      g.moveTo(0, py);
      for (let x = 0; x <= W0; x += 20) g.lineTo(x, py + Math.sin(x / 60 + t / 300) * 7);
      g.lineTo(W0, H0);
      g.lineTo(0, H0);
      g.closePath();
      g.fillStyle = 'rgba(140,207,62,.55)';
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#b6f05a';
      g.stroke();
      for (let k = 0; k < 7; k++) {
        const bx = ((k * 137 + t / 10) % W0);
        const by = POOL_Y + 40 + Math.sin(t / 300 + k) * 18;
        g.beginPath();
        g.arc(bx, by, 5 + (k % 3) * 2, 0, Math.PI * 2);
        g.fillStyle = 'rgba(230,255,180,.5)';
        g.fill();
      }

      for (const b of M.Composite.allBodies(world)) {
        const p = b.plugin || {};
        if (p.kind === 'platform' || b.label === 'platform') {
          drawBody(g, b, '#6b4a2a', '#2a1636', 4);
          continue;
        }
        if (p.kind === 'blok') {
          const m = MAT[p.mat];
          const k = p.hp / p.max;
          drawBody(g, b, k > 0.6 ? m.c : k > 0.3 ? m.d : '#58412c', '#2a1636', 4);
          if (k < 0.7) {
            g.save();
            g.translate(b.position.x, b.position.y);
            g.rotate(b.angle);
            g.strokeStyle = 'rgba(42,22,54,.6)';
            g.lineWidth = 2.4;
            g.beginPath();
            g.moveTo(-8, -14);
            g.lineTo(2, 0);
            g.lineTo(-6, 10);
            g.stroke();
            g.restore();
          }
          continue;
        }
        if (p.kind === 'mikrop') {
          const r = b.circleRadius;
          g.save();
          g.translate(b.position.x, b.position.y);
          g.rotate(b.angle);
          const hurtK = p.ouch > 0 ? 1 : 0;
          if (!game.paused && p.ouch > 0) p.ouch -= dt;
          g.beginPath();
          g.arc(0, 0, r, 0, Math.PI * 2);
          g.fillStyle = hurtK ? '#ffd1d8' : p.spor ? '#b58aff' : '#ff5468';
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#2a1636';
          g.stroke();
          if (p.spor) {
            for (let k = 0; k < 9; k++) {
              const a = (k / 9) * Math.PI * 2;
              g.beginPath();
              g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
              g.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9));
              g.lineWidth = 4;
              g.stroke();
            }
          }
          g.fillStyle = '#2a1636';
          g.beginPath();
          g.arc(-r * 0.32, -r * 0.12, r * 0.15, 0, Math.PI * 2);
          g.arc(r * 0.32, -r * 0.12, r * 0.15, 0, Math.PI * 2);
          g.fill();
          g.beginPath();
          const hp = p.hp / p.max;
          if (hp > 0.6) g.arc(0, r * 0.18, r * 0.34, 0.15, Math.PI - 0.15);
          else g.arc(0, r * 0.42, r * 0.34, Math.PI + 0.2, -0.2);
          g.lineWidth = 3.4;
          g.stroke();
          g.restore();
          continue;
        }
        if (p.kind === 'mermi') {
          const a = AMMO[p.type];
          const r = b.circleRadius;
          g.save();
          g.translate(b.position.x, b.position.y);
          g.rotate(b.angle);
          g.beginPath();
          g.arc(0, 0, r, 0, Math.PI * 2);
          g.fillStyle = a.c;
          g.fill();
          g.lineWidth = 4;
          g.strokeStyle = '#2a1636';
          g.stroke();
          if (p.type === 'antikor') {
            g.lineWidth = 5;
            g.beginPath();
            g.moveTo(0, r * 0.7);
            g.lineTo(0, -r * 0.1);
            g.moveTo(0, -r * 0.1);
            g.lineTo(-r * 0.7, -r * 0.75);
            g.moveTo(0, -r * 0.1);
            g.lineTo(r * 0.7, -r * 0.75);
            g.stroke();
          } else if (p.type === 'makrofaj') {
            g.fillStyle = '#2a1636';
            g.beginPath();
            g.arc(-r * 0.3, -r * 0.1, r * 0.16, 0, Math.PI * 2);
            g.arc(r * 0.3, -r * 0.1, r * 0.16, 0, Math.PI * 2);
            g.fill();
            g.beginPath();
            g.arc(0, r * 0.1, r * 0.42, 0.1, Math.PI - 0.1);
            g.lineWidth = 4;
            g.stroke();
          } else if (p.type === 'komple') {
            g.lineWidth = 4;
            for (let k = 0; k < 6; k++) {
              const ang = (k / 6) * Math.PI * 2;
              g.beginPath();
              g.moveTo(Math.cos(ang) * r * 0.4, Math.sin(ang) * r * 0.4);
              g.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
              g.stroke();
            }
          } else {
            g.fillStyle = '#2a1636';
            g.beginPath();
            g.ellipse(0, 0, r * 0.5, r * 0.22, 0.6, 0, Math.PI * 2);
            g.fill();
          }
          g.restore();
        }
      }

      // Fırlatıcı ve lastik
      const kind = kindNow();
      const lx = LAUNCH.x;
      const ly = LAUNCH.y;
      g.save();
      g.translate(lx, ly);
      rrect(g, -46, -10, 92, 54, 14);
      inked(g, '#3f6f2a', 5);
      rrect(g, -30, -40, 60, 40, 10);
      inked(g, '#6b4a2a', 5);
      g.restore();
      if (game.drag && kind) {
        const dx = lx - game.drag.x;
        const dy = Math.min(-12, ly - game.drag.y);
        const d = Math.min(Math.hypot(dx, dy), 280);
        const ang = Math.atan2(dy, dx);
        const bx = lx - Math.cos(ang) * d * 0.35;
        const by = ly - Math.sin(ang) * d * 0.35;
        g.lineWidth = 9;
        g.lineCap = 'round';
        g.strokeStyle = '#2a1636';
        g.beginPath();
        g.moveTo(lx - 26, ly - 30);
        g.lineTo(bx, by);
        g.lineTo(lx + 26, ly - 30);
        g.stroke();
        g.beginPath();
        g.arc(bx, by, AMMO[kind].r, 0, Math.PI * 2);
        g.fillStyle = AMMO[kind].c;
        g.fill();
        g.lineWidth = 4;
        g.stroke();
        // Yol tahmini
        const sp = 22 + (d / 280) * 32;
        let px = lx;
        let py2 = ly - 26;
        let vx = Math.cos(ang) * sp;
        let vy = Math.sin(ang) * sp;
        g.fillStyle = 'rgba(255,255,255,.55)';
        for (let i = 0; i < 26; i++) {
          for (let k = 0; k < 3; k++) {
            vy += 1.6 * 0.55;
            px += vx * 0.55;
            py2 += vy * 0.55;
            if (px < 12 || px > W0 - 12) vx = -vx * 0.72;
          }
          if (py2 > POOL_Y) break;
          g.beginPath();
          g.arc(px, py2, Math.max(2, 7 - i * 0.2), 0, Math.PI * 2);
          g.fill();
        }
      } else if (kind && !game.flying && !game.done) {
        g.beginPath();
        g.arc(lx, ly - 26, AMMO[kind].r, 0, Math.PI * 2);
        g.fillStyle = AMMO[kind].c;
        g.fill();
        g.lineWidth = 4;
        g.strokeStyle = '#2a1636';
        g.stroke();
        const pull = 22 + Math.sin(t / 420) * 8;
        g.strokeStyle = 'rgba(255,255,255,.75)';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(lx, ly + 24);
        g.lineTo(lx, ly + 24 + pull);
        g.moveTo(lx - 10, ly + 14 + pull);
        g.lineTo(lx, ly + 26 + pull);
        g.lineTo(lx + 10, ly + 14 + pull);
        g.stroke();
      }
      g.restore();
      if (game.flying && !game.used) label(g, W / 2, H - 92, AMMO[game.flying.plugin.type].tip, { size: 14, color: '#eaffd0', stroke: '#06160f', font: '"Baloo 2", sans-serif' });
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
