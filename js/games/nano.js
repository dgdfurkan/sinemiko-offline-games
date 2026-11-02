// Nano Yolculuk: Sinem'in nano denizaltısı damarın içinde ilerler. Parmağını sürükle, kapsül onu takip etsin.
// Alyuvarlara ve pıhtıya çarpma, oksijen kabarcıklarını topla, damar daralınca ortada kal.
// Kalp atışı duvarları nabızla sıkar: ritmi tuttur, yolu açılsın.

import { Life, html, toHTML, fitCanvas, clamp, lerp, rand, randInt, pick } from '../core/dom.js';
import { sfx, buzz, tone, steady } from '../core/audio.js';
import { makeFx, label, shake } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, toast, icon } from '../core/ui.js';
import { loadThree, makeRenderer, toon, outlined, inkMaterial, disposeScene, frameGate, shaped, mergeGeos } from '../core/three-kit.js';
import { ART } from '../art.js';

const LEVELS = 30;
const RAD = 7.2;
const SPEED0 = 26;

const levelCfg = (i) => ({
  len: 900 + i * 110,
  speed: SPEED0 + i * 1.3,
  cells: 0.5 + Math.min(1.5, i * 0.06),
  clots: i >= 2 ? 0.1 + Math.min(0.55, i * 0.022) : 0,
  virus: i >= 6 ? 0.06 + Math.min(0.34, (i - 6) * 0.018) : 0,
  squeeze: i >= 4 ? 0.1 + Math.min(0.42, (i - 4) * 0.02) : 0,
  need: Math.min(34, 10 + i),
});

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], best: 0, oxy: 0, dist: 0 });
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
      art: ART.nano,
      sub: 'Damarın içinde minik bir denizaltısın. Oksijeni topla, pıhtıya takılma.',
      stats: [['Toplanan Oksijen', Number(data.oxy) || 0], ['En Uzun Yol', `${Math.round(Number(data.best) || 0)} m`]],
      how: [
        'Parmağını ekranda gezdir: kapsül parmağını takip eder. Bırakınca olduğu yerde kalır.',
        'Mavi kabarcıklar oksijen. Hedefi doldurursan damarın sonunda kalkan kazanırsın.',
        'Alyuvarlar seni savurur, pıhtı ve virüs can götürür. Üç canın var.',
        'Damar daralan yerlerde ortaya çekil. Kalp attıkça duvarlar nefes alır.',
        'Yolun sonuna kadar gidersen seviye biter. Ne kadar çok oksijen, o kadar yıldız.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Damarlar', onPick: (i) => play(i) },
    });
  }

  async function play(li) {
    end();
    local = new Life();
    const my = local;
    const cfg = levelCfg(li);
    const fx = makeFx();
    const game = {
      z: 0, hp: 3, oxy: 0, combo: 0, best: 0, speed: cfg.speed, boost: 0,
      done: false, paused: false, loading: true, hit: 0, shield: 0, pos: { x: 0, y: 0 }, aim: null,
    };
    st = game;

    f.setTitle(`Damar ${li + 1}`);
    f.main.innerHTML = toHTML(html`
      <div class="nn">
        <canvas class="nn-cv"></canvas>
        <canvas class="nn-ui"></canvas>
        <div class="nn-hud">
          <span class="nn-hp" data-hp>${[0, 1, 2].map(() => html`<i></i>`)}</span>
          <span class="nn-oxy"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.500" fill="#6fd8ff" stroke="#2a1636" stroke-width="2.400"/><path d="M8 10a4 4 0 0 1 3-2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg><b data-oxy>0</b><small>/ ${cfg.need}</small></span>
          <span class="nn-dist"><b data-dist>0</b><small>m</small></span>
        </div>
        <div class="nn-bar"><i data-prog></i></div>
        <div class="nn-wait" data-wait>Damara giriliyor...</div>
      </div>`);
    const wrap = f.main.querySelector('.nn');
    const cv = wrap.querySelector('.nn-cv');
    const uiCv = wrap.querySelector('.nn-ui');
    const waitEl = wrap.querySelector('[data-wait]');
    const oxyEl = wrap.querySelector('[data-oxy]');
    const distEl = wrap.querySelector('[data-dist]');
    const progEl = wrap.querySelector('[data-prog]');
    const hpEl = wrap.querySelector('[data-hp]');
    const stage = fitCanvas(uiCv, my);

    // Parmak takibi: ekranın neresindeysen kapsül oraya yönelir
    const aimFrom = (e) => {
      const r = cv.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      game.aim = { x: clamp(nx * RAD * 1.15, -RAD, RAD), y: clamp(-ny * RAD * 1.15, -RAD, RAD) };
    };
    my.on(wrap, 'pointerdown', (e) => { if (!game.paused) aimFrom(e); });
    my.on(wrap, 'pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') { if (!game.paused) aimFrom(e); } });
    my.on(wrap, 'pointerup', () => { game.aim = null; });
    my.on(wrap, 'pointercancel', () => { game.aim = null; });

    const THREE = await loadThree();
    if (!my.alive) return;
    waitEl.remove();
    game.loading = false;

    const { renderer, onResize } = makeRenderer(THREE, cv, my, { clear: 0x40060f, dprCap: 1.6 });
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x5c0a18, 40, 140);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 200);
    onResize(({ W, H }) => {
      camera.aspect = Math.max(0.1, W / Math.max(1, H));
      camera.fov = W > H ? 66 : 78;
      camera.updateProjectionMatrix();
    });
    scene.add(new THREE.HemisphereLight(0xfff0f0, 0x5a1020, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(3, 6, 8);
    scene.add(key);
    my.add(() => disposeScene(scene));

    // Damar: içten görünen uzun boru, nabızla soluk alır
    const tubeGeo = new THREE.CylinderGeometry(RAD + 1.6, RAD + 1.6, 260, 26, 40, true);
    tubeGeo.rotateX(Math.PI / 2);
    const tubeMat = new THREE.MeshToonMaterial({ color: 0xc8324a, side: THREE.BackSide });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tube);
    const basePos = tubeGeo.attributes.position.array.slice();

    // Damar duvarındaki halkalar: hız hissi
    const ringGeo = new THREE.TorusGeometry(RAD + 1.1, 0.26, 6, 22);
    const ringMat = toon(THREE, 0xff8fa0);
    const rings = new THREE.InstancedMesh(ringGeo, ringMat, 22);
    rings.frustumCulled = false;
    scene.add(rings);

    // Kapsül: Sinem'in nano denizaltısı
    const subGroup = new THREE.Group();
    const hull = mergeGeos(THREE, [
      shaped(THREE, new THREE.CapsuleGeometry(0.52, 1.1, 4, 14), { rx: Math.PI / 2 }),
      shaped(THREE, new THREE.ConeGeometry(0.38, 0.8, 12), { z: 1.1, rx: Math.PI / 2 }),
    ]);
    const sub = outlined(THREE, hull, toon(THREE, 0x2ee6c8), 1.12);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), new THREE.MeshToonMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.85 }));
    dome.position.set(0, 0.36, 0.05);
    const finGeo = mergeGeos(THREE, [
      shaped(THREE, new THREE.BoxGeometry(0.1, 0.52, 0.62), { x: 0.56, z: -0.5 }),
      shaped(THREE, new THREE.BoxGeometry(0.1, 0.52, 0.62), { x: -0.56, z: -0.5 }),
      shaped(THREE, new THREE.BoxGeometry(0.5, 0.1, 0.62), { y: -0.5, z: -0.5 }),
    ]);
    const fins = new THREE.Mesh(finGeo, toon(THREE, 0x12b7a6));
    subGroup.add(sub, dome, fins);
    subGroup.scale.setScalar(0.62);
    scene.add(subGroup);
    const glow = new THREE.PointLight(0x7ff2e2, 2.2, 14);
    subGroup.add(glow);

    // Engeller ve toplananlar: havuzdan gelir, arkada kalınca geri döner
    const cellGeo = (() => {
      const g = new THREE.SphereGeometry(1, 14, 10);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const r = Math.hypot(p.getX(i), p.getZ(i));
        p.setY(i, y * (0.34 + 0.3 * r * r));
      }
      g.computeVertexNormals();
      return g;
    })();
    const kinds = {
      cell: { geo: cellGeo, mat: toon(THREE, 0xff6f80, { emissive: 0x5a0d1a }), r: 1.5, n: 26 },
      clot: { geo: new THREE.DodecahedronGeometry(1.5, 0), mat: toon(THREE, 0x4a0a1c, { emissive: 0x220208 }), r: 1.6, n: 12 },
      virus: { geo: mergeGeos(THREE, [new THREE.IcosahedronGeometry(0.9, 0), ...Array.from({ length: 8 }, (_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return shaped(THREE, new THREE.ConeGeometry(0.16, 0.6, 5), { x: Math.cos(a) * 1.05, y: Math.sin(a) * 1.05, rz: -a + Math.PI / 2 });
      })]), mat: toon(THREE, 0xb58aff), r: 1.2, n: 10 },
      oxy: { geo: new THREE.IcosahedronGeometry(0.66, 1), mat: new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.94 }), r: 0.9, n: 30 },
    };
    const pools = {};
    for (const [k, v] of Object.entries(kinds)) {
      const m = new THREE.InstancedMesh(v.geo, v.mat, v.n);
      m.frustumCulled = false;
      m.count = v.n;
      scene.add(m);
      pools[k] = { mesh: m, items: Array.from({ length: v.n }, () => ({ live: false, x: 0, y: 0, z: -999, s: 1, rx: 0, ry: 0, spin: 0 })), r: v.r };
    }
    const dummy = new THREE.Object3D();
    const hide = (o) => { o.live = false; o.z = -9999; };

    function spawnAhead(kind, z) {
      const pool = pools[kind];
      const o = pool.items.find((q) => !q.live);
      if (!o) return;
      const a = rand(0, Math.PI * 2);
      const rr = kind === 'oxy' ? rand(0, RAD * 0.8) : rand(RAD * 0.12, RAD * 0.88);
      o.live = true;
      o.x = Math.cos(a) * rr;
      o.y = Math.sin(a) * rr;
      o.z = z;
      o.s = kind === 'cell' ? rand(0.85, 1.25) : kind === 'clot' ? rand(0.9, 1.5) : 1;
      o.rx = rand(0, 6);
      o.ry = rand(0, 6);
      o.spin = rand(-1.6, 1.6);
      o.wob = rand(0, 6);
    }

    // Yol boyunca ne çıkacağı önceden kurulur: zorluk düzgün artsın
    let nextZ = 40;
    function feed() {
      while (nextZ < game.z + 160) {
        const r = Math.random();
        if (r < cfg.cells * 0.42) spawnAhead('cell', nextZ);
        else if (r < cfg.cells * 0.42 + cfg.clots * 0.5) spawnAhead('clot', nextZ);
        else if (r < cfg.cells * 0.42 + cfg.clots * 0.5 + cfg.virus) spawnAhead('virus', nextZ);
        if (Math.random() < 0.55) {
          const a = rand(0, Math.PI * 2);
          const rr = rand(0, RAD * 0.72);
          for (let k = 0; k < randInt(3, 6); k++) {
            const o = pools.oxy.items.find((q) => !q.live);
            if (!o) break;
            o.live = true;
            o.x = Math.cos(a + k * 0.22) * rr;
            o.y = Math.sin(a + k * 0.22) * rr;
            o.z = nextZ + k * 3.2;
            o.s = 1;
            o.wob = rand(0, 6);
          }
        }
        nextZ += rand(7, 13);
      }
    }
    feed();

    const engine = steady({ type: 'sawtooth', f: 70, q: 6 });
    my.add(() => engine.stop());
    const gate = frameGate();

    const setHp = () => {
      [...hpEl.children].forEach((n, i) => n.classList.toggle('off', i >= game.hp));
    };
    setHp();

    function damage(kind) {
      if (game.hit > 0 || game.done) return;
      if (game.shield > 0) {
        game.shield = 0;
        game.hit = 0.7;
        sfx.zap();
        fx.text(stage.W / 2, stage.H * 0.4, 'Kalkan Gitti', '#6fd8ff', 24);
        return;
      }
      game.hp--;
      game.hit = 1.2;
      game.combo = 0;
      setHp();
      sfx.splat();
      buzz(60);
      shake(wrap, 12, 420);
      fx.burst(stage.W / 2, stage.H / 2, { n: 24, colors: ['#ff5f72', '#8a0f22'], power: 420, gravity: 0 });
      fx.text(stage.W / 2, stage.H * 0.38, kind === 'clot' ? 'Pıhtı!' : kind === 'virus' ? 'Virüs!' : 'Alyuvar!', '#ff9aa6', 26);
      if (game.hp <= 0) finish(false);
    }

    function collect(o) {
      hide(o);
      game.oxy++;
      game.combo++;
      data.oxy++;
      oxyEl.textContent = game.oxy;
      sfx.bubble ? sfx.bubble() : sfx.pop(0.8);
      tone({ type: 'sine', f: 520 + Math.min(8, game.combo) * 60, dur: 0.1, vol: 0.06 });
      buzz(6);
      const sx = stage.W / 2;
      const sy = stage.H / 2;
      fx.burst(sx, sy, { n: 6, colors: ['#6fd8ff', '#fff'], power: 160, gravity: 0 });
      if (game.combo === 8) {
        game.shield = 1;
        fx.text(sx, sy - 40, 'Kalkan!', '#6fd8ff', 26);
        sfx.star(1);
      }
      if (game.oxy === cfg.need) {
        fx.text(sx, sy - 60, 'Oksijen Tamam!', '#2ee6c8', 26);
        sfx.fanfare();
      }
    }

    function finish(won) {
      if (game.done) return;
      game.done = true;
      engine.set(0, 60);
      const dist = Math.round(game.z);
      if (dist > data.best) data.best = dist;
      data.dist += dist;
      const stars = !won ? 0 : game.oxy >= cfg.need ? (game.hp === 3 ? 3 : 2) : 1;
      if (stars > (data.stars[li] || 0)) data.stars[li] = stars;
      api.touch();
      const coins = won ? 6 + stars * 6 + Math.floor(game.oxy / 3) : 2 + Math.floor(game.oxy / 5);
      api.finish({ coins });
      my.timeout(() => {
        resultSheet({
          won,
          title: won ? 'Damarın Sonu!' : 'Kapsül Dağıldı',
          sub: won ? (stars === 3 ? 'Tek çizik almadan, oksijen dolu geçtin.' : 'Geçtin. Oksijeni tamamla, canını koru.') : 'Yeniden dal: dar yerlerde ortada kal.',
          stars,
          coins,
          stats: [['Oksijen', `${game.oxy} / ${cfg.need}`], ['Yol', `${dist} m`], ['Kalan Can', Math.max(0, game.hp)]],
          buttons: [
            ...(stars && li + 1 < LEVELS ? [{ label: 'Sonraki Damar', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
            { label: 'Tekrar', main: !stars, icon: 'replay', act: () => play(li) },
            { label: 'Damarlar', icon: 'list', act: () => menu() },
          ],
        });
      }, 800);
    }

    f.onBack = () => {
      if (game.done) { menu(); return; }
      game.paused = true;
      engine.set(0, 60);
      pauseSheet({
        onResume: () => { game.paused = false; },
        onRestart: () => play(li),
        onQuit: () => menu(),
      });
    };

    const vel = { x: 0, y: 0 };
    my.raf((dt, t) => {
      if (game.paused) return undefined;
      const beat = Math.max(0, Math.sin((t / 820) * Math.PI * 2)) ** 3;
      if (!game.done) {
        game.z += game.speed * dt * (1 + game.boost);
        game.boost = Math.max(0, game.boost - dt * 0.6);
        if (game.z >= cfg.len) finish(true);
      }
      feed();

      // Kapsül parmağa yumuşak gider, duvara yaklaşınca itilir
      const target = game.aim || { x: 0, y: 0 };
      const squeeze = cfg.squeeze * (0.5 + 0.5 * Math.sin(game.z * 0.035));
      const limit = RAD * (1 - squeeze * (0.35 + beat * 0.3));
      vel.x = lerp(vel.x, (target.x - game.pos.x) * 7, 1 - Math.pow(0.001, dt));
      vel.y = lerp(vel.y, (target.y - game.pos.y) * 7, 1 - Math.pow(0.001, dt));
      game.pos.x = clamp(game.pos.x + vel.x * dt, -limit, limit);
      game.pos.y = clamp(game.pos.y + vel.y * dt, -limit, limit);
      const wallGap = limit - Math.hypot(game.pos.x, game.pos.y);
      if (wallGap < 0.6 && !game.done && game.hit <= 0) {
        const k = 1 / Math.max(0.1, Math.hypot(game.pos.x, game.pos.y));
        game.pos.x *= Math.max(0.1, (limit - 0.6) * k);
        game.pos.y *= Math.max(0.1, (limit - 0.6) * k);
        engine.set(0.05, 120);
      }
      if (game.hit > 0) game.hit -= dt;

      subGroup.position.set(game.pos.x, game.pos.y, 0);
      subGroup.rotation.z = lerp(subGroup.rotation.z, clamp(-vel.x * 0.05, -0.6, 0.6), 0.15);
      subGroup.rotation.x = lerp(subGroup.rotation.x, clamp(vel.y * 0.04, -0.5, 0.5), 0.15);
      subGroup.scale.setScalar(0.62 * (game.hit > 0 ? 1 + Math.sin(t / 40) * 0.08 : 1));
      sub.body.material.color.setHex(game.hit > 0 ? 0xff9aa6 : game.shield ? 0x9ff6ff : 0x2ee6c8);
      camera.position.set(game.pos.x * 0.42, game.pos.y * 0.42 + 0.75, -7.6);
      camera.lookAt(game.pos.x * 0.7, game.pos.y * 0.7, 11);

      // Duvar nabzı
      const p = tubeGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const zz = basePos[i * 3 + 2];
        const w = 1 - squeeze * (0.34 + beat * 0.3) * (0.5 + 0.5 * Math.sin((zz + game.z) * 0.035));
        const pulse = 1 + beat * 0.035 + Math.sin((zz + game.z) * 0.12) * 0.02;
        p.setX(i, basePos[i * 3] * w * pulse);
        p.setY(i, basePos[i * 3 + 1] * w * pulse);
      }
      p.needsUpdate = true;
      tube.position.z = game.z % 6.5;
      tubeMat.color.setHex(game.hit > 0 ? 0xe85a6e : 0xc8324a);

      for (let i = 0; i < 22; i++) {
        const z = ((i * 7 - game.z) % 154 + 154) % 154 - 12;
        dummy.position.set(0, 0, z);
        const w = 1 - squeeze * (0.34 + beat * 0.3) * (0.5 + 0.5 * Math.sin((z + game.z) * 0.035));
        dummy.scale.setScalar(w);
        dummy.rotation.z = z * 0.02;
        dummy.updateMatrix();
        rings.setMatrixAt(i, dummy.matrix);
      }
      rings.instanceMatrix.needsUpdate = true;

      // Nesneler: çarpışma kapsülün hemen önünde ölçülür
      for (const [kind, pool] of Object.entries(pools)) {
        let any = false;
        pool.items.forEach((o, i) => {
          if (!o.live) {
            dummy.position.set(0, 0, -9999);
            dummy.scale.setScalar(0.001);
            dummy.updateMatrix();
            pool.mesh.setMatrixAt(i, dummy.matrix);
            return;
          }
          any = true;
          const rz = o.z - game.z;
          if (rz < -8) { hide(o); return; }
          const wob = Math.sin(t / 420 + o.wob) * 0.5;
          const x = o.x + (kind === 'oxy' ? Math.sin(t / 500 + o.wob) * 0.4 : wob * 0.4);
          const y = o.y + (kind === 'oxy' ? Math.cos(t / 600 + o.wob) * 0.4 : wob * 0.3);
          if (rz > -1.6 && rz < 1.6) {
            const d = Math.hypot(x - game.pos.x, y - game.pos.y);
            if (kind === 'oxy') {
              if (d < 1.5) { collect(o); return; }
            } else if (d < pool.r * o.s + 0.55) {
              hide(o);
              damage(kind);
              return;
            }
          }
          dummy.position.set(x, y, rz);
          dummy.rotation.set(o.rx + t * 0.0004 * o.spin, o.ry + t * 0.0006 * o.spin, kind === 'oxy' ? t * 0.001 : 0);
          dummy.scale.setScalar(o.s * (kind === 'oxy' ? 1 + Math.sin(t / 220 + o.wob) * 0.12 : 1));
          dummy.updateMatrix();
          pool.mesh.setMatrixAt(i, dummy.matrix);
        });
        pool.mesh.instanceMatrix.needsUpdate = true;
        pool.mesh.visible = any;
      }

      engine.set(game.done ? 0 : 0.035 + game.boost * 0.03, 62 + game.speed * 1.4 + beat * 20);
      distEl.textContent = Math.round(game.z);
      progEl.style.width = `${clamp((game.z / cfg.len) * 100, 0, 100)}%`;
      if (gate()) renderer.render(scene, camera);

      // Üstteki iki boyutlu katman: hız çizgileri, yazılar, parçacıklar
      const { W, H, g } = stage;
      stage.begin();
      // Hız çizgileri: merkezden dışa doğru akar
      const sp = clamp(game.speed / 60 + game.boost, 0.25, 1.4);
      g.save();
      g.translate(W / 2 + game.pos.x * 6, H / 2 + game.pos.y * -6);
      g.strokeStyle = `rgba(255,220,225,${0.1 + sp * 0.12})`;
      g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + (i % 3) * 0.4;
        const ph = ((t / (900 / sp) + i * 0.137) % 1);
        const r0 = 40 + ph * Math.max(W, H) * 0.6;
        const r1 = r0 + 26 + sp * 40;
        g.beginPath();
        g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        g.stroke();
      }
      g.restore();
      if (beat > 0.25) {
        g.beginPath();
        g.arc(W / 2, H / 2, Math.min(W, H) * (0.3 + beat * 0.16), 0, Math.PI * 2);
        g.strokeStyle = `rgba(255,140,160,${0.08 * beat})`;
        g.lineWidth = 26;
        g.stroke();
      }
      if (game.hit > 0) {
        g.fillStyle = `rgba(255,40,70,${0.22 * clamp(game.hit, 0, 1)})`;
        g.fillRect(0, 0, W, H);
      }
      if (game.combo >= 3) label(g, W / 2, H - 54, `${game.combo} kabarcık üst üste`, { size: 15, color: '#9ff0ff', stroke: '#30020c', font: '"Exo 2", sans-serif' });
      fx.draw(g, dt);
      return undefined;
    });

    my.timeout(() => toast('Parmağını ekranda gezdir, kapsül seni takip eder.'), 400);
  }

  menu();
  return {
    unmount() { end(); life.dispose(); f.dispose(); },
    get st() { return st; },
    data,
  };
}
