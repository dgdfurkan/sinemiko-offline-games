// Bee Koyun: köpekle sürüyü ağıla götür. Koyunlar köpekten kaçar, birbirine sokulur, bazen otlamak için durur.
// Güneş batmadan hepsini içeri al. Sonraki günlerde çit, gölet ve aç kurtlar da işin içine girer.

import { Life, html, toHTML, clamp, rand, seeded, drag } from '../core/dom.js';
import { sfx, buzz } from '../core/audio.js';
import { pop } from '../core/fx.js';
import { menuScreen, resultSheet, pauseSheet, icon } from '../core/ui.js';
import { loadThree, makeRenderer, toon, inkMaterial, mergeGeos, shaped, disposeScene, frameGate } from '../core/three-kit.js';
import { ART } from '../art.js';

const W = 14;
const D = 24;
const LEVELS = 30;

// Her gün başka bir iş: yeni bir engel, yeni bir hedef. Bölümler elle kurulmuş kalıplardan gelir
const DAYS = [
  { n: 'İlk Gün', sheep: 5, lay: 'bos', tip: 'Köpeği koyunların arkasına geçir, ağıla doğru it.' },
  { n: 'Dar Geçit', sheep: 6, lay: 'gecit', tip: 'Tek kapı var. Sürüyü önce kapının önüne topla.' },
  { n: 'Ağaçlık', sheep: 7, lay: 'orman', tip: 'Ağaçlar yolu kapatır, sürü dağılır.' },
  { n: 'İki Sürü', sheep: 8, lay: 'ikili', tip: 'Koyunlar iki ayrı köşede. Önce birini getir.' },
  { n: 'Kara Koyun', sheep: 9, lay: 'gecit', black: 2, tip: 'Kara koyunlar inatçı. Üstlerine havla.' },
  { n: 'Çamurlu Tarla', sheep: 9, lay: 'camur', black: 1, tip: 'Çamurda hem sen hem koyun ağırlaşır.' },
  { n: 'Dere Kenarı', sheep: 11, lay: 'dere', black: 1, tip: 'Dereyi geçmenin tek yolu köprü.' },
  { n: 'Zikzak Çit', sheep: 12, lay: 'zikzak', black: 2, tip: 'İki kapı ters taraflarda.' },
  { n: 'İlk Kurt', sheep: 12, lay: 'orman', wolves: 1, black: 1, tip: 'Kurt gelince havla, kaçar.' },
  { n: 'Rüzgarlı Gün', sheep: 13, lay: 'gecit', wind: 1, black: 2, tip: 'Rüzgar sürüyü yana savurur.' },
  { n: 'Kuzulu Sürü', sheep: 12, lay: 'ikili', lambs: 4, tip: 'Kuzular annelerinin peşinden gider.' },
  { n: 'Altın Koyun', sheep: 13, lay: 'camur', golden: 1, black: 2, tip: 'Altın koyun hızlı ve ürkek. Onu da içeri al.' },
  { n: 'Kurt Sürüsü', sheep: 14, lay: 'dere', wolves: 2, black: 2, tip: 'İki kurt sırayla dener.' },
  { n: 'Fırtına', sheep: 15, lay: 'zikzak', wind: 2, lambs: 3, tip: 'Rüzgar sık ve sert.' },
  { n: 'Çamurda Kuzu', sheep: 15, lay: 'camur', lambs: 5, wolves: 1, tip: 'Kuzular çamurda iyice yavaşlar.' },
  { n: 'Kalabalık', sheep: 18, lay: 'orman', black: 3, golden: 1, tip: 'Büyük sürü, dar yollar.' },
  { n: 'Gece Yaklaşıyor', sheep: 18, lay: 'gecit', wolves: 2, wind: 1, tip: 'Süre kısa, acele et.' },
  { n: 'Çifte Dere', sheep: 19, lay: 'cifte', black: 2, lambs: 3, tip: 'İki dere, iki köprü.' },
  { n: 'Ada Çayırı', sheep: 19, lay: 'ada', wolves: 1, golden: 1, tip: 'Ortadaki gölün etrafından dolaş.' },
  { n: 'Rüzgarlı Dere', sheep: 20, lay: 'dere', wind: 2, wolves: 1, black: 2, tip: 'Rüzgar köprüde işini zorlaştırır.' },
  { n: 'Kuzu Bakıcısı', sheep: 20, lay: 'ikili', lambs: 7, wolves: 1, tip: 'Yarısı kuzu. Anneleri kaybetme.' },
  { n: 'Labirent', sheep: 21, lay: 'labirent', black: 3, tip: 'Üç sıra çit, üç kapı.' },
  { n: 'Aç Kurtlar', sheep: 21, lay: 'orman', wolves: 3, black: 2, tip: 'Üç kurt. Havlaman çabuk tükenir.' },
  { n: 'Çamur Denizi', sheep: 22, lay: 'camur2', lambs: 4, wind: 1, tip: 'Çayırın yarısı çamur.' },
  { n: 'Altın Sürü', sheep: 22, lay: 'ada', golden: 3, wolves: 2, tip: 'Üç altın koyun, hepsi ürkek.' },
  { n: 'Dar Köprü', sheep: 23, lay: 'cifte', wolves: 2, wind: 2, lambs: 4, tip: 'Köprüler daraldı.' },
  { n: 'Karanlık Orman', sheep: 24, lay: 'labirent', wolves: 2, black: 4, tip: 'Hem labirent hem kurt.' },
  { n: 'Büyük Fırtına', sheep: 25, lay: 'zikzak', wind: 3, lambs: 5, wolves: 1, tip: 'Rüzgar durmadan esiyor.' },
  { n: 'Son Çamur', sheep: 26, lay: 'camur2', wolves: 3, black: 4, golden: 1, tip: 'Her şey bir arada.' },
  { n: 'Uzun Gün', sheep: 26, lay: 'labirent', wolves: 3, wind: 2, lambs: 6, golden: 2, tip: 'Çobanlığın sınavı.' },
];
const LEVEL_NAMES = DAYS.map((d) => d.n);

function levelDef(i) {
  const d = DAYS[Math.min(i, DAYS.length - 1)];
  const r = seeded(i * 13 + 5);
  const def = {
    name: d.n, tip: d.tip, sheep: d.sheep, lambs: d.lambs || 0, golden: d.golden || 0, black: d.black || 0,
    wolves: d.wolves || 0, wind: d.wind || 0,
    trees: [], walls: [], ponds: [], mud: [],
    time: 50 + d.sheep * 3 + (d.wolves || 0) * 8 + (d.lambs || 0) * 2,
    need: i < 4 ? d.sheep : Math.max(3, Math.ceil(d.sheep * (i < 12 ? 0.85 : 0.75))),
    spots: [[0, D / 2 - 5, 4]],
  };
  const gap = Math.max(2.6, 4.4 - i * 0.05);
  const wallAt = (z, g = gap, cx = null) => {
    const c = cx === null ? r.range(-W / 2 + g / 2 + 0.9, W / 2 - g / 2 - 0.9) : cx;
    def.walls.push([-W / 2, z, c - g / 2, z], [c + g / 2, z, W / 2, z]);
    return c;
  };
  const river = (z, bridge = 3.2) => {
    const c = r.range(-3.5, 3.5);
    for (let x = -W / 2; x < W / 2; x += 1.1) {
      if (Math.abs(x - c) < bridge / 2) continue;
      def.ponds.push([x, z + r.range(-0.2, 0.2), 0.85]);
    }
    return c;
  };
  const trees = (n) => {
    for (let k = 0; k < n; k++) {
      const x = r.range(-W / 2 + 1, W / 2 - 1);
      const z = r.range(-D / 2 + 7, D / 2 - 5);
      const nearWall = def.walls.some(([x1, z1, x2]) => Math.abs(z - z1) < 1.9 && (x < x1 - 0.3 || x > x2 + 0.3));
      const nearPond = def.ponds.some(([px, pz, pr]) => Math.hypot(x - px, z - pz) < pr + 1.4);
      if (!nearWall && !nearPond) def.trees.push([x, z, r.range(0.8, 1.2)]);
    }
  };
  const mud = (n, size = 2.4) => {
    for (let k = 0; k < n; k++) def.mud.push([r.range(-W / 2 + 1.5, W / 2 - 1.5), r.range(-D / 2 + 7, D / 2 - 4), r.range(size * 0.7, size)]);
  };
  switch (d.lay) {
    case 'gecit': wallAt(1); trees(3); break;
    case 'orman': trees(10); wallAt(-3, gap + 0.6); break;
    case 'ikili':
      def.spots = [[-W / 2 + 3, D / 2 - 5, 2.2], [W / 2 - 3, 2, 2.2]];
      wallAt(-1);
      trees(5);
      break;
    case 'camur': wallAt(0); mud(3); trees(4); break;
    case 'camur2': mud(6, 3); wallAt(-2); trees(3); break;
    case 'dere': river(2); trees(5); break;
    case 'cifte': river(5, 2.8); river(-3, 2.8); trees(3); break;
    case 'zikzak': {
      const a = wallAt(4);
      wallAt(-2, gap, a > 0 ? -W / 4 : W / 4);
      trees(4);
      break;
    }
    case 'ada':
      def.ponds.push([0, 2, 3.4]);
      def.spots = [[-W / 2 + 3, D / 2 - 5, 2], [W / 2 - 3, D / 2 - 5, 2]];
      trees(6);
      mud(2);
      break;
    case 'labirent':
      wallAt(6, gap);
      wallAt(1, gap);
      wallAt(-4, gap);
      trees(3);
      break;
    default: trees(2);
  }
  return def;
}

// Noktanın doğru parçasına uzaklığı ve en yakın nokta
function segNear(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const t = clamp(((px - x1) * dx + (pz - z1) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  const nx = x1 + dx * t;
  const nz = z1 + dz * t;
  return { nx, nz, d: Math.hypot(px - nx, pz - nz) };
}

export function mount(root, api) {
  const life = new Life();
  const data = api.save({ stars: [], herded: 0 });
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
      art: ART.koyun,
      sub: 'Köpeğinle sürüyü ağıla götür. Güneş batarsa koyunlar dağılır.',
      stats: [['Eve Dönen Koyun', data.herded]],
      how: [
        'Çayırda parmağını gezdir: köpek oraya koşar.',
        'Koyunlar köpekten kaçar. Sürünün arkasına geçip ağıla doğru it.',
        'Hav düğmesi yakındaki koyunları hızlandırır ve kurtları kaçırır, sonra biraz dinlenmesi gerekir.',
        'Üstteki ağıla yeterince koyun girince gün biter. Güneş batmadan ne kadar erken bitirirsen o kadar yıldız.',
      ],
      levels: { total: LEVELS, stars: data.stars, title: 'Günler', onPick: (i) => play(i) },
    });
  }

  async function play(li) {
    end();
    local = new Life();
    const my = local;
    const def = levelDef(li);
    f.setTitle(`${li + 1}. Gün: ${def.name}`);
    f.main.innerHTML = toHTML(html`
      <div class="ky">
        <canvas class="ky-cv"></canvas>
        <div class="ky-hud">
          <span class="ky-chip"><b data-in>0</b> / ${def.need}</span>
          ${def.lambs ? html`<span class="ky-tag">${def.lambs} kuzu</span>` : ''}
          ${def.golden ? html`<span class="ky-tag gold">${def.golden} altın</span>` : ''}
          ${def.wolves ? html`<span class="ky-tag wolf">${def.wolves} kurt</span>` : ''}
          <span class="ky-sun"><i data-sun></i></span>
        </div>
        <div class="ky-wind" data-wind><i></i><i></i><i></i></div>
        <button class="btn btn-main ky-bark" data-bark>Hav!</button>
        <div class="ky-hint" data-hint>${def.tip}</div>
      </div>`);
    const main = f.main.firstElementChild;
    const game = { li, def, t: def.time, inPen: 0, lost: 0, over: false, paused: false, barkCd: 0, gust: 0, gustT: 6, gustX: 0, gustZ: 0, goldIn: 0, target: null, sheep: [], wolves: [], dog: { x: 0, z: D / 2 - 1.5, a: Math.PI, moving: 0 }, flash: 0 };
    st = game;
    f.onBack = () => {
      game.paused = true;
      pauseSheet({ onResume: () => { game.paused = false; }, onRestart: () => play(li), onQuit: () => menu() });
    };
    const THREE = await loadThree();
    if (!my.alive) return;
    const cv = main.querySelector('canvas');
    const { renderer, onResize } = makeRenderer(THREE, cv, my, { clear: 0x9fdcff, dprCap: 1.75 });
    const scene = new THREE.Scene();
    my.add(() => disposeScene(scene));
    const camera = new THREE.PerspectiveCamera(38, 0.5, 0.5, 120);
    onResize((sz) => {
      const asp = sz.W / sz.H;
      camera.aspect = asp;
      // Tüm çayır ekrana sığsın. Yan ekranda kamera döner: uzun kenar ekranın uzun kenarına oturur, ağıl sağda
      const tan = Math.tan((camera.fov * Math.PI) / 360);
      const land = asp > 1;
      const across = land ? D : W;
      const along = land ? W : D;
      const dist = Math.max((across + 1.2) / (2 * tan * Math.max(asp, 0.01)), ((along + 3) * 0.62) / tan / 1.05);
      if (land) camera.position.set(dist * 0.52, dist * 0.86, 0);
      else camera.position.set(0, dist * 0.86, dist * 0.52);
      camera.lookAt(land ? -0.2 : 0, 0, land ? 0 : -0.2);
      camera.updateProjectionMatrix();
    });
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6fae4a, 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.9);
    sun.position.set(-6, 14, 8);
    scene.add(sun);
    const skyDay = new THREE.Color(0x9fdcff);
    const skyDusk = new THREE.Color(0xff9d6a);
    const sunDay = new THREE.Color(0xfff2d6);
    const sunDusk = new THREE.Color(0xff8a4a);
    const ink = inkMaterial(THREE);

    // Çayır
    const groundMat = toon(THREE, 0x8fd65a);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W + 30, D + 30), groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const fieldEdge = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, D + 0.4), toon(THREE, 0x7cc94f));
    fieldEdge.rotation.x = -Math.PI / 2;
    fieldEdge.position.y = 0.01;
    scene.add(fieldEdge);
    // Çimen tutamları ve çiçekler
    const tuft = mergeGeos(THREE, [shaped(THREE, new THREE.ConeGeometry(0.08, 0.3, 4), { y: 0.15 }), shaped(THREE, new THREE.ConeGeometry(0.06, 0.22, 4), { x: 0.09, y: 0.11, rz: -0.3 }), shaped(THREE, new THREE.ConeGeometry(0.06, 0.22, 4), { x: -0.09, y: 0.11, rz: 0.3 })]);
    const tufts = new THREE.InstancedMesh(tuft, toon(THREE, 0x5fae3a), 70);
    const flower = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 5), toon(THREE, 0xffffff), 34);
    const m4 = new THREE.Matrix4();
    const rr = seeded(li + 3);
    for (let k = 0; k < 70; k++) {
      m4.makeTranslation(rr.range(-W / 2, W / 2), 0, rr.range(-D / 2, D / 2));
      tufts.setMatrixAt(k, m4);
    }
    const fCols = [0xffe27a, 0xffffff, 0xff9ec7, 0xd8c6ff];
    const tmpC = new THREE.Color();
    for (let k = 0; k < 34; k++) {
      m4.makeTranslation(rr.range(-W / 2, W / 2), 0.14, rr.range(-D / 2, D / 2));
      flower.setMatrixAt(k, m4);
      flower.setColorAt(k, tmpC.setHex(rr.pick(fCols)));
    }
    scene.add(tufts, flower);

    // Çit parçaları: tek bir örnekli model
    const woodMat = toon(THREE, 0xc98b52);
    const addFence = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.05) return;
      const n = Math.max(1, Math.round(len / 1.3));
      const a = Math.atan2(z2 - z1, x2 - x1);
      const g = new THREE.Group();
      const railG = new THREE.BoxGeometry(len, 0.12, 0.09);
      for (const y of [0.35, 0.68]) {
        const rail = new THREE.Mesh(railG, woodMat);
        rail.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
        rail.rotation.y = -a;
        const o = new THREE.Mesh(railG, ink);
        o.position.copy(rail.position);
        o.rotation.copy(rail.rotation);
        o.scale.set(1.01, 1.7, 1.9);
        g.add(o, rail);
      }
      const postG = new THREE.BoxGeometry(0.18, 0.95, 0.18);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = new THREE.Mesh(postG, woodMat);
        p.position.set(x1 + (x2 - x1) * t, 0.47, z1 + (z2 - z1) * t);
        const o = new THREE.Mesh(postG, ink);
        o.position.copy(p.position);
        o.scale.set(1.35, 1.08, 1.35);
        g.add(o, p);
      }
      scene.add(g);
    };
    // Ağıl: üstte, ağzı aşağıda
    const PEN = { x0: -4.6, x1: 4.6, z0: -D / 2 + 0.4, z1: -D / 2 + 5, gate: 5 };
    const walls = [
      [PEN.x0, PEN.z0, PEN.x1, PEN.z0], [PEN.x0, PEN.z0, PEN.x0, PEN.z1], [PEN.x1, PEN.z0, PEN.x1, PEN.z1],
      [PEN.x0, PEN.z1, -PEN.gate / 2 - 0.2, PEN.z1], [PEN.gate / 2 + 0.2, PEN.z1, PEN.x1, PEN.z1],
      ...def.walls,
    ];
    walls.forEach((w) => addFence(...w));
    const hay = new THREE.Mesh(new THREE.PlaneGeometry(PEN.x1 - PEN.x0, PEN.z1 - PEN.z0), toon(THREE, 0xe6cc7a));
    hay.rotation.x = -Math.PI / 2;
    hay.position.set(0, 0.02, (PEN.z0 + PEN.z1) / 2);
    scene.add(hay);
    // Ok: ağzın önünde hafif yanıp sönen işaret
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(0, 0.06, PEN.z1 + 1.2);
    arrow.scale.set(1, 1, 0.02);
    scene.add(arrow);
    // Ağaçlar
    const trunkG = new THREE.CylinderGeometry(0.16, 0.22, 0.9, 6);
    const leafG = mergeGeos(THREE, [shaped(THREE, new THREE.SphereGeometry(0.8, 8, 6), { y: 1.4 }), shaped(THREE, new THREE.SphereGeometry(0.55, 8, 6), { x: 0.5, y: 1.1 }), shaped(THREE, new THREE.SphereGeometry(0.5, 8, 6), { x: -0.5, y: 1.15 })]);
    const trunkM = toon(THREE, 0x8a5a36);
    const leafM = toon(THREE, 0x4fa858);
    for (const [x, z, s] of def.trees) {
      const g = new THREE.Group();
      const t = new THREE.Mesh(trunkG, trunkM);
      t.position.y = 0.45;
      const l = new THREE.Mesh(leafG, leafM);
      const lo = new THREE.Mesh(leafG, ink);
      lo.scale.setScalar(1.07);
      lo.position.y = -0.06;
      g.add(t, lo, l);
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      scene.add(g);
    }
    // Göletler
    for (const [x, z, r] of def.ponds) {
      const edge = new THREE.Mesh(new THREE.CircleGeometry(r + 0.18, 22), new THREE.MeshBasicMaterial({ color: 0x2a1636 }));
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.025, z);
      const p = new THREE.Mesh(new THREE.CircleGeometry(r, 22), toon(THREE, 0x6cc4ff));
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.03, z);
      scene.add(edge, p);
    }

    // Çamur: içinden geçilir ama ayak ağırlaşır
    for (const [x, z, r] of def.mud) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18), toon(THREE, 0x6b4a2a));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.022, z);
      const e = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 18), new THREE.MeshBasicMaterial({ color: 0x3e2a18 }));
      e.rotation.x = -Math.PI / 2;
      e.position.set(x, 0.023, z);
      scene.add(m, e);
    }

    // Koyunlar: örnekli çizim, 26 koyun birkaç çizim çağrısı
    const wool = mergeGeos(THREE, [
      shaped(THREE, new THREE.SphereGeometry(0.42, 8, 6), { y: 0.55, sx: 1.15, sy: 0.95, sz: 1 }),
      shaped(THREE, new THREE.SphereGeometry(0.26, 7, 5), { x: 0.28, y: 0.72 }),
      shaped(THREE, new THREE.SphereGeometry(0.26, 7, 5), { x: -0.28, y: 0.72 }),
      shaped(THREE, new THREE.SphereGeometry(0.25, 7, 5), { z: 0.26, y: 0.68 }),
      shaped(THREE, new THREE.SphereGeometry(0.25, 7, 5), { z: -0.26, y: 0.68 }),
    ]);
    const headG = mergeGeos(THREE, [
      shaped(THREE, new THREE.SphereGeometry(0.2, 7, 5), { x: 0.48, y: 0.62, sx: 1.1, sy: 1.05, sz: 0.95 }),
      shaped(THREE, new THREE.SphereGeometry(0.07, 5, 4), { x: 0.48, y: 0.72, z: 0.2, sx: 1, sy: 0.6, sz: 1.5 }),
      shaped(THREE, new THREE.SphereGeometry(0.07, 5, 4), { x: 0.48, y: 0.72, z: -0.2, sx: 1, sy: 0.6, sz: 1.5 }),
    ]);
    const legsG = mergeGeos(THREE, [[0.24, 0.16], [0.24, -0.16], [-0.24, 0.16], [-0.24, -0.16]].map(([x, z]) => shaped(THREE, new THREE.CylinderGeometry(0.06, 0.05, 0.34, 5), { x, y: 0.17, z })));
    const eyeG = mergeGeos(THREE, [shaped(THREE, new THREE.SphereGeometry(0.05, 5, 4), { x: 0.63, y: 0.67, z: 0.09 }), shaped(THREE, new THREE.SphereGeometry(0.05, 5, 4), { x: 0.63, y: 0.67, z: -0.09 })]);
    const N = def.sheep;
    const woolM = new THREE.InstancedMesh(wool, toon(THREE, 0xffffff), N);
    const woolI = new THREE.InstancedMesh(wool, ink, N);
    const headM = new THREE.InstancedMesh(headG, toon(THREE, 0x3a2d3f), N);
    const legsM = new THREE.InstancedMesh(legsG, new THREE.MeshBasicMaterial({ color: 0x2a1636 }), N);
    const eyesM = new THREE.InstancedMesh(eyeG, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
    scene.add(woolI, legsM, woolM, headM, eyesM);
    for (let k = 0; k < N; k++) {
      const black = k < def.black;
      const golden = !black && k >= N - def.golden;
      const lamb = !black && !golden && k >= N - def.golden - def.lambs;
      woolM.setColorAt(k, tmpC.setHex(golden ? 0xffcd3c : black ? 0x4a3f55 : 0xfffdf6));
      const [sx, sz, sr] = def.spots[k % def.spots.length];
      game.sheep.push({
        x: clamp(sx + rand(-sr, sr), -W / 2 + 1, W / 2 - 1), z: clamp(sz + rand(-sr, sr), -D / 2 + 1, D / 2 - 1),
        vx: 0, vz: 0, a: rand(0, 6), ph: rand(0, 6), graze: 0, home: false, dead: false,
        black, golden, lamb, size: lamb ? 0.62 : golden ? 1.05 : 1, scare: 0, hop: 0,
      });
    }
    // Köpek
    const dogG = new THREE.Group();
    const dogBody = mergeGeos(THREE, [
      shaped(THREE, new THREE.SphereGeometry(0.3, 7, 5), { y: 0.42, sx: 1.5, sy: 0.85, sz: 0.85 }),
      shaped(THREE, new THREE.SphereGeometry(0.24, 7, 5), { x: 0.42, y: 0.62 }),
      shaped(THREE, new THREE.SphereGeometry(0.11, 6, 4), { x: 0.64, y: 0.56, sx: 1.2 }),
    ]);
    dogG.add(new THREE.Mesh(dogBody, ink));
    dogG.children[0].scale.setScalar(1.09);
    dogG.children[0].position.y = -0.03;
    dogG.add(new THREE.Mesh(dogBody, toon(THREE, 0xd98b47)));
    const dogLegs = new THREE.Mesh(mergeGeos(THREE, [[0.28, 0.14], [0.28, -0.14], [-0.28, 0.14], [-0.28, -0.14]].map(([x, z]) => shaped(THREE, new THREE.CylinderGeometry(0.06, 0.05, 0.28, 5), { x, y: 0.14, z }))), new THREE.MeshBasicMaterial({ color: 0x2a1636 }));
    dogG.add(dogLegs);
    const ears = new THREE.Mesh(mergeGeos(THREE, [shaped(THREE, new THREE.ConeGeometry(0.09, 0.2, 4), { x: 0.36, y: 0.84, z: 0.14 }), shaped(THREE, new THREE.ConeGeometry(0.09, 0.2, 4), { x: 0.36, y: 0.84, z: -0.14 })]), toon(THREE, 0x8a5a2a));
    dogG.add(ears);
    const tail = new THREE.Mesh(shaped(THREE, new THREE.CylinderGeometry(0.04, 0.06, 0.34, 5), { y: 0.17 }), toon(THREE, 0xd98b47));
    tail.position.set(-0.42, 0.5, 0);
    tail.rotation.z = 0.6;
    dogG.add(tail);
    scene.add(dogG);
    // Dokunma halkası
    const ringM = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.52, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    ringM.rotation.x = -Math.PI / 2;
    ringM.position.y = 0.05;
    ringM.visible = false;
    scene.add(ringM);
    // Kurtlar
    const wolfBody = mergeGeos(THREE, [
      shaped(THREE, new THREE.SphereGeometry(0.34, 7, 5), { y: 0.5, sx: 1.6, sy: 0.85, sz: 0.85 }),
      shaped(THREE, new THREE.SphereGeometry(0.25, 7, 5), { x: 0.5, y: 0.72 }),
      shaped(THREE, new THREE.ConeGeometry(0.14, 0.34, 4), { x: 0.75, y: 0.66, rz: -Math.PI / 2 }),
      shaped(THREE, new THREE.ConeGeometry(0.09, 0.26, 4), { x: 0.44, y: 0.98, z: 0.13 }),
      shaped(THREE, new THREE.ConeGeometry(0.09, 0.26, 4), { x: 0.44, y: 0.98, z: -0.13 }),
    ]);
    const wolfLegs = mergeGeos(THREE, [[0.32, 0.15], [0.32, -0.15], [-0.32, 0.15], [-0.32, -0.15]].map(([x, z]) => shaped(THREE, new THREE.CylinderGeometry(0.06, 0.05, 0.34, 5), { x, y: 0.17, z })));
    for (let k = 0; k < def.wolves; k++) {
      const g = new THREE.Group();
      const o = new THREE.Mesh(wolfBody, ink);
      o.scale.setScalar(1.08);
      o.position.y = -0.03;
      g.add(o, new THREE.Mesh(wolfBody, toon(THREE, 0x6f7388)), new THREE.Mesh(wolfLegs, new THREE.MeshBasicMaterial({ color: 0x2a1636 })));
      g.visible = false;
      scene.add(g);
      game.wolves.push({ g, x: k % 2 ? W / 2 + 2 : -W / 2 - 2, z: rand(-4, 6), wait: 12 + k * 14 + rand(0, 6), scared: 0, a: 0, active: false });
    }

    // Dokunma: ekrandan çayıra ışın
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitP = new THREE.Vector3();
    const toWorld = (p) => {
      const r = cv.getBoundingClientRect();
      ray.setFromCamera({ x: (p.x / r.width) * 2 - 1, y: -(p.y / r.height) * 2 + 1 }, camera);
      if (ray.ray.intersectPlane(plane, hitP)) return { x: clamp(hitP.x, -W / 2, W / 2), z: clamp(hitP.z, -D / 2, D / 2) };
      return null;
    };
    const hintEl = main.querySelector('[data-hint]');
    drag(cv, my, {
      down: (p) => { game.target = toWorld(p); ringM.visible = true; hintEl.style.opacity = 0; },
      move: (p) => { const q = toWorld(p); if (q) game.target = q; },
      up: () => { game.target = null; ringM.visible = false; },
    });
    const barkBtn = main.querySelector('[data-bark]');
    const bark = () => {
      if (game.barkCd > 0 || game.over || game.paused) return;
      game.barkCd = 3.5;
      sfx.bark();
      setTimeout(() => sfx.bark(), 130);
      buzz(20);
      pop(barkBtn, 1.15);
      const { x, z } = game.dog;
      for (const s of game.sheep) {
        if (!s.home && !s.dead && Math.hypot(s.x - x, s.z - z) < 7) s.scare = 1.6;
      }
      for (const w of game.wolves) {
        if (w.active && Math.hypot(w.x - x, w.z - z) < 9) w.scared = 5;
      }
      game.shock = 1;
    };
    my.on(barkBtn, 'click', bark);
    game.bark = bark;

    const inMud = (o) => def.mud.some(([x, z, r]) => Math.hypot(o.x - x, o.z - z) < r);
    const collide = (o, r) => {
      for (const w of walls) {
        const { nx, nz, d } = segNear(o.x, o.z, w[0], w[1], w[2], w[3]);
        if (d < r) {
          const k = (r - d) / (d || 0.001);
          o.x += (o.x - nx) * k;
          o.z += (o.z - nz) * k;
        }
      }
      for (const [tx, tz, s] of def.trees) {
        const dx = o.x - tx;
        const dz = o.z - tz;
        const d = Math.hypot(dx, dz);
        const min = 0.5 * s + r;
        if (d < min) {
          o.x = tx + (dx / (d || 1)) * min;
          o.z = tz + (dz / (d || 1)) * min;
        }
      }
      for (const [px, pz, pr] of def.ponds) {
        const dx = o.x - px;
        const dz = o.z - pz;
        const d = Math.hypot(dx, dz);
        const min = pr + r;
        if (d < min) {
          o.x = px + (dx / (d || 1)) * min;
          o.z = pz + (dz / (d || 1)) * min;
        }
      }
      o.x = clamp(o.x, -W / 2 + 0.3, W / 2 - 0.3);
      o.z = clamp(o.z, -D / 2 + 0.3, D / 2 - 0.3);
    };
    const inPenBox = (s) => s.x > PEN.x0 && s.x < PEN.x1 && s.z > PEN.z0 && s.z < PEN.z1 - 0.2;
    const inEl = main.querySelector('[data-in]');
    const windEl = main.querySelector('[data-wind]');
    const sunEl = main.querySelector('[data-sun]');
    const finish = () => {
      if (game.over) return;
      game.over = true;
      const k = game.t / def.time;
      const all = game.inPen >= def.sheep - game.lost && game.lost === 0;
      const won = game.inPen >= def.need;
      const stars = !won ? 0 : (k > 0.4 && all ? 3 : k > 0.18 ? 2 : 1);
      const prev = data.stars[li] || 0;
      if (stars > prev) data.stars[li] = stars;
      data.herded += game.inPen;
      api.touch();
      const coins = won ? 8 + stars * 7 + Math.floor(li / 2) + game.goldIn * 10 : 3;
      api.finish({ coins });
      resultSheet({
        won,
        title: won ? `${def.name}: Sürü Evde` : 'Hava Karardı',
        sub: won ? (game.lost ? `${game.lost} koyun kurda gitti ama olsun.` : 'Hiç koyun kaybetmedin.') : `${def.need} koyun gerekiyordu, ${game.inPen} tanesi içeri girdi.`,
        stars,
        coins,
        stats: [['Ağıldaki Koyun', `${game.inPen} / ${def.sheep}`], ...(def.golden ? [['Altın Koyun', `${game.goldIn} / ${def.golden}`]] : []), ['Kalan Gün Işığı', `%${Math.round(k * 100)}`]],
        buttons: [
          ...(won && li + 1 < LEVELS ? [{ label: 'Sonraki Gün', main: true, icon: 'arrow', act: () => play(li + 1) }] : []),
          { label: 'Tekrar', main: !won, icon: 'replay', act: () => play(li) },
          { label: 'Menü', icon: 'home', act: () => menu() },
        ],
      });
    };

    const step = (dt) => {
      game.t -= dt;
      if (game.t <= 0) {
        game.t = 0;
        finish();
        return;
      }
      game.barkCd = Math.max(0, game.barkCd - dt);
      barkBtn.disabled = game.barkCd > 0;
      // Rüzgar: önce uyarı, sonra birkaç saniye savuruş
      if (def.wind) {
        game.gustT -= dt;
        if (game.gust > 0) {
          game.gust -= dt;
          if (game.gust <= 0) windEl.classList.remove('on');
        } else if (game.gustT <= 0) {
          game.gustT = Math.max(7, 18 - def.wind * 4) + rand(0, 5);
          game.gust = 1.6 + def.wind * 0.5;
          const a = rand(0, Math.PI * 2);
          game.gustX = Math.cos(a);
          game.gustZ = Math.sin(a);
          windEl.classList.add('on');
          windEl.style.setProperty('--deg', `${(a * 180) / Math.PI}deg`);
          sfx.whoosh();
          buzz(18);
        }
      }
      // Köpek hedefe koşar
      const dog = game.dog;
      let dogSp = 0;
      if (game.target) {
        const dx = game.target.x - dog.x;
        const dz = game.target.z - dog.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.2) {
          const sp = Math.min(d * 5, 8) * (inMud(dog) ? 0.5 : 1);
          dog.x += (dx / d) * sp * dt;
          dog.z += (dz / d) * sp * dt;
          dog.a = Math.atan2(dz, dx);
          dogSp = sp;
        }
      }
      collide(dog, 0.35);
      dog.moving = dogSp;
      // Koyunlar: sürü kuralları
      const list = game.sheep;
      for (const s of list) {
        if (s.dead) continue;
        let ax = 0;
        let az = 0;
        let cx = 0;
        let cz = 0;
        let n = 0;
        for (const o of list) {
          if (o === s || o.dead || o.home !== s.home) continue;
          const dx = s.x - o.x;
          const dz = s.z - o.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 36) {
            cx += o.x;
            cz += o.z;
            n++;
          }
          if (d2 < 1.1 && d2 > 0.0001) {
            const d = Math.sqrt(d2);
            ax += (dx / d) * (1.05 - d) * 9;
            az += (dz / d) * (1.05 - d) * 9;
          }
        }
        if (s.home) {
          // Ağılda: ortada dolaşır
          ax += ((0 - s.x) * 0.2 + rand(-0.4, 0.4));
          az += (((PEN.z0 + PEN.z1) / 2 - 0.4 - s.z) * 0.5 + rand(-0.4, 0.4));
          s.vx += ax * dt;
          s.vz += az * dt;
          const v = Math.hypot(s.vx, s.vz);
          if (v > 1) {
            s.vx *= 1 / v;
            s.vz *= 1 / v;
          }
          s.x += s.vx * dt;
          s.z += s.vz * dt;
          s.vx *= 1 - 1.5 * dt;
          s.vz *= 1 - 1.5 * dt;
          collide(s, 0.45);
          continue;
        }
        const ddx = s.x - dog.x;
        const ddz = s.z - dog.z;
        const dd = Math.hypot(ddx, ddz) || 0.01;
        let fleeing = false;
        const R = 4.4;
        if (dd < R) {
          const k = (1 - dd / R) * 14 * (s.golden ? 1.3 : 1);
          ax += (ddx / dd) * k;
          az += (ddz / dd) * k;
          fleeing = true;
        }
        for (const w of game.wolves) {
          if (!w.active) continue;
          const dx = s.x - w.x;
          const dz = s.z - w.z;
          const d = Math.hypot(dx, dz);
          if (d < 4) {
            ax += (dx / d) * (1 - d / 4) * 10;
            az += (dz / d) * (1 - d / 4) * 10;
            fleeing = true;
          }
        }
        if (s.scare > 0) {
          s.scare -= dt;
          fleeing = true;
          ax += (ddx / dd) * 7;
          az += (ddz / dd) * 7;
        }
        if (n) {
          ax += ((cx / n - s.x) * (fleeing ? 0.5 : 0.28));
          az += ((cz / n - s.z) * (fleeing ? 0.5 : 0.28));
        }
        // Ağzın önüne gelen koyun otu kokusunu alır: kapıya doğru süzülür
        const gx = 0 - s.x;
        const gz = PEN.z1 - 1 - s.z;
        const gd = Math.hypot(gx, gz) || 1;
        if (gd < 6.5) {
          const pull = (1 - gd / 6.5) * 7;
          ax += (gx / gd) * pull;
          az += (gz / gd) * pull;
        }
        if (!fleeing) {
          s.graze -= dt;
          if (s.graze <= 0) {
            s.graze = rand(1, 4);
            s.wx = rand(-1, 1);
            s.wz = rand(-1, 1);
          }
          ax += s.wx * 0.8;
          az += s.wz * 0.8;
        }
        // Kuzu en yakın büyük koyuna yapışır
        if (s.lamb) {
          let mum = null;
          let md = 99;
          for (const o of game.sheep) {
            if (o === s || o.lamb || o.home || o.dead) continue;
            const d = Math.hypot(o.x - s.x, o.z - s.z);
            if (d < md) { md = d; mum = o; }
          }
          if (mum && md > 1.2) {
            ax += ((mum.x - s.x) / md) * 4.5;
            az += ((mum.z - s.z) / md) * 4.5;
          }
        }
        if (game.gust > 0) {
          ax += game.gustX * 6.5;
          az += game.gustZ * 6.5;
        }
        s.vx += ax * dt;
        s.vz += az * dt;
        const near = Math.hypot(s.x, s.z - PEN.z1) < 6.5;
        let max = fleeing ? (s.scare > 0 ? 5.2 : 4.2) : near ? 2 : 0.7;
        if (s.golden) max *= 1.35;
        if (s.lamb) max *= 0.82;
        if (inMud(s)) max *= 0.45;
        const v = Math.hypot(s.vx, s.vz);
        if (v > max) {
          s.vx = (s.vx / v) * max;
          s.vz = (s.vz / v) * max;
        }
        s.vx *= 1 - 1.6 * dt;
        s.vz *= 1 - 1.6 * dt;
        s.x += s.vx * dt;
        s.z += s.vz * dt;
        collide(s, 0.45);
        if (inPenBox(s)) {
          s.home = true;
          if (s.golden) game.goldIn++;
          s.hop = 1;
          game.inPen++;
          inEl.textContent = game.inPen;
          sfx.baa();
          sfx.ding(79 + (game.inPen % 8) * 2);
          buzz(14);
          pop(inEl.parentElement, 1.2);
          if (game.inPen >= def.sheep - game.lost) {
            my.timeout(finish, 900);
          }
        }
        if (Math.random() < dt * 0.05) sfx.baa();
      }
      // Kurtlar
      for (const w of game.wolves) {
        if (!w.active) {
          w.wait -= dt;
          if (w.wait <= 0) {
            w.active = true;
            w.g.visible = true;
            sfx.sting();
          }
          continue;
        }
        const dd = Math.hypot(w.x - dog.x, w.z - dog.z);
        if (dd < 3.2) w.scared = Math.max(w.scared, 2.5);
        let tx;
        let tz;
        if (w.scared > 0) {
          w.scared -= dt;
          tx = w.x + (w.x - dog.x);
          tz = w.z + (w.z - dog.z);
        } else {
          const prey = list.filter((s) => !s.home && !s.dead).sort((a, b) => Math.hypot(a.x - w.x, a.z - w.z) - Math.hypot(b.x - w.x, b.z - w.z))[0];
          if (!prey) {
            tx = w.x > 0 ? W : -W;
            tz = w.z;
          } else {
            tx = prey.x;
            tz = prey.z;
            if (Math.hypot(prey.x - w.x, prey.z - w.z) < 0.7) {
              prey.dead = true;
              game.lost++;
              w.scared = 4;
              sfx.bad();
              sfx.baa();
              buzz(50);
              if (game.inPen >= def.sheep - game.lost && game.inPen > 0) my.timeout(finish, 700);
              else if (def.sheep - game.lost < def.need) my.timeout(finish, 700);
            }
          }
        }
        const dx = tx - w.x;
        const dz = tz - w.z;
        const d = Math.hypot(dx, dz) || 1;
        const sp = w.scared > 0 ? 5.5 : 2.4;
        w.x += (dx / d) * sp * dt;
        w.z += (dz / d) * sp * dt;
        w.a = Math.atan2(dz, dx);
        w.x = clamp(w.x, -W / 2 - 3, W / 2 + 3);
        w.z = clamp(w.z, -D / 2, D / 2);
      }
    };

    const dummy = new THREE.Object3D();
    const inkBump = new THREE.Vector3(1.37, 1.37, 1.37);
    const gate = frameGate();
    let frame = 0;
    my.raf((dt, t) => {
      if (document.hidden) return true;
      if (!game.paused && !game.over && dt > 0) step(dt);
      // Gün batımı: süre azaldıkça ışık altına döner
      const k = game.t / def.time;
      const dusk = clamp(1 - k, 0, 1);
      renderer.setClearColor(tmpC.copy(skyDay).lerp(skyDusk, dusk));
      sun.color.copy(sunDay).lerp(sunDusk, dusk);
      sun.intensity = 1.9 - dusk * 0.6;
      hemi.intensity = 1.25 - dusk * 0.5;
      sunEl.style.width = `${k * 100}%`;
      arrow.material.opacity = 0.25 + Math.sin(t / 240) * 0.2;
      // Koyunları yerleştir
      game.sheep.forEach((s, i) => {
        if (s.dead) {
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0.001);
          dummy.updateMatrix();
          woolM.setMatrixAt(i, dummy.matrix);
          woolI.setMatrixAt(i, dummy.matrix);
          headM.setMatrixAt(i, dummy.matrix);
          legsM.setMatrixAt(i, dummy.matrix);
          eyesM.setMatrixAt(i, dummy.matrix);
          return;
        }
        const v = Math.hypot(s.vx, s.vz);
        if (v > 0.25) {
          const want = Math.atan2(s.vz, s.vx);
          let da = want - s.a;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          s.a += da * Math.min(1, dt * 8);
        }
        s.hop = Math.max(0, s.hop - dt * 1.4);
        const jump = Math.abs(Math.sin(t / (v > 1.5 ? 90 : 220) + s.ph)) * Math.min(0.32, v * 0.11) + Math.sin(s.hop * Math.PI) * 0.7;
        dummy.position.set(s.x, jump, s.z);
        dummy.rotation.set(0, -s.a, 0);
        const sq = 1.26 * (1 + Math.sin(t / 180 + s.ph) * 0.015);
        dummy.scale.set(sq, 2.52 - sq, sq);
        dummy.updateMatrix();
        woolM.setMatrixAt(i, dummy.matrix);
        headM.setMatrixAt(i, dummy.matrix);
        legsM.setMatrixAt(i, dummy.matrix);
        eyesM.setMatrixAt(i, dummy.matrix);
        dummy.scale.copy(inkBump);
        dummy.position.y = jump - 0.035;
        dummy.updateMatrix();
        woolI.setMatrixAt(i, dummy.matrix);
      });
      woolM.instanceMatrix.needsUpdate = true;
      woolI.instanceMatrix.needsUpdate = true;
      headM.instanceMatrix.needsUpdate = true;
      legsM.instanceMatrix.needsUpdate = true;
      eyesM.instanceMatrix.needsUpdate = true;
      if (woolM.instanceColor) woolM.instanceColor.needsUpdate = frame < 2;
      frame++;
      // Köpek
      dogG.position.set(game.dog.x, Math.abs(Math.sin(t / 70)) * (game.dog.moving > 0.5 ? 0.16 : 0), game.dog.z);
      dogG.rotation.y = -game.dog.a;
      tail.rotation.x = Math.sin(t / 60) * 0.7;
      if (game.shock > 0) {
        game.shock -= dt * 3;
        const sc = 1.25 + Math.max(0, game.shock) * 0.35;
        dogG.scale.set(sc, sc, sc);
      } else dogG.scale.setScalar(1.25);
      if (game.target) ringM.position.set(game.target.x, 0.05, game.target.z);
      for (const w of game.wolves) {
        if (!w.active) continue;
        w.g.position.set(w.x, Math.abs(Math.sin(t / 80)) * 0.12, w.z);
        w.g.rotation.y = -w.a;
      }
      if (gate()) renderer.render(scene, camera);
      return true;
    });
  }

  menu();
  return {
    unmount() {
      end();
      life.dispose();
      f.dispose();
    },
    get st() { return st; },
    data,
    play,
  };
}
