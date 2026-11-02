// 3B oyunların ortak parçaları: three.js yalnızca gerektiğinde yüklenir. Çizgi film ışığı, konturlu nesneler

import { save } from './save.js';

let mod = null;
export async function loadThree() {
  if (!mod) mod = await import('../../vendor/three.module.min.js');
  return mod;
}

export function makeRenderer(THREE, canvas, life, { dprCap = 2, clear = 0x000000, alpha = false, antialias = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias, alpha, powerPreference: 'high-performance' });
  const cap = save.get('eco') ? 1 : dprCap;
  renderer.setPixelRatio(Math.min(cap, window.devicePixelRatio || 1));
  if (!alpha) renderer.setClearColor(clear, 1);
  else renderer.setClearColor(0x000000, 0);
  const size = { W: 0, H: 0 };
  const listeners = [];
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    size.W = r.width;
    size.H = r.height;
    renderer.setSize(r.width, r.height, false);
    listeners.forEach((fn) => fn(size));
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  life.add(() => {
    ro.disconnect();
    renderer.dispose();
    renderer.forceContextLoss();
  });
  return { renderer, size, onResize: (fn) => { listeners.push(fn); fn(size); } };
}

// Üç kademeli çizgi film ışığı
let ramp = null;
export function toon(THREE, color, opts = {}) {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...opts });
}

// Ters yüzlü büyütülmüş kopya: mürekkep konturu
export function inkMaterial(THREE, color = 0x2a1636) {
  return new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
}

export function outlined(THREE, geometry, material, thickness = 1.08, inkMat = null) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geometry, material);
  const o = new THREE.Mesh(geometry, inkMat || inkMaterial(THREE));
  o.scale.setScalar(thickness);
  g.add(o, m);
  g.body = m;
  return g;
}

// Sahneye ait her şeyi siler; bellek telefonda sınırlı
export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
  });
}

// Pil dostu modda kare atlama
export function frameGate() {
  const eco = save.get('eco');
  let skip = false;
  return () => {
    if (!eco) return true;
    skip = !skip;
    return !skip;
  };
}

// Birkaç geometriyi tek parçada birleştirir: çizim çağrısı azalır
export function mergeGeos(THREE, list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  parts.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  parts.forEach((g) => {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// Kısayol: dönüştürülmüş geometri
export function shaped(THREE, geo, { x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(m);
  return geo;
}
