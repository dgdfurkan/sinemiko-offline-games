// Çevrimdışı kalkan: ilk açılışta bütün oyun dosyaları telefona iner, sonra internet hiç gerekmez.
// Bu dosya tools/build.py ile üretilir, elle değiştirme.

const VERSION = 'ca8c12bca271';
const CACHE = `sinemiko-yolda-${VERSION}`;
const ASSETS = [
  "./",
  "css/base.css",
  "css/fonts.css",
  "css/games.css",
  "css/hub.css",
  "data/words.txt",
  "fonts/baloo-2-600-latin-ext.woff2",
  "fonts/baloo-2-600-latin.woff2",
  "fonts/baloo-2-800-latin-ext.woff2",
  "fonts/baloo-2-800-latin.woff2",
  "fonts/bungee-400-latin-ext.woff2",
  "fonts/bungee-400-latin.woff2",
  "fonts/caveat-700-latin-ext.woff2",
  "fonts/caveat-700-latin.woff2",
  "fonts/exo-2-600-latin-ext.woff2",
  "fonts/exo-2-600-latin.woff2",
  "fonts/exo-2-800-latin-ext.woff2",
  "fonts/exo-2-800-latin.woff2",
  "fonts/jetbrains-mono-600-latin-ext.woff2",
  "fonts/jetbrains-mono-600-latin.woff2",
  "fonts/jetbrains-mono-800-latin-ext.woff2",
  "fonts/jetbrains-mono-800-latin.woff2",
  "fonts/nunito-600-latin-ext.woff2",
  "fonts/nunito-600-latin.woff2",
  "fonts/nunito-800-latin-ext.woff2",
  "fonts/nunito-800-latin.woff2",
  "fonts/pacifico-400-latin-ext.woff2",
  "fonts/pacifico-400-latin.woff2",
  "fonts/patrick-hand-400-latin-ext.woff2",
  "fonts/patrick-hand-400-latin.woff2",
  "fonts/paytone-one-400-latin-ext.woff2",
  "fonts/paytone-one-400-latin.woff2",
  "fonts/pixelify-sans-500-latin-ext.woff2",
  "fonts/pixelify-sans-500-latin.woff2",
  "fonts/playfair-display-700-latin-ext.woff2",
  "fonts/playfair-display-700-latin.woff2",
  "fonts/press-start-2p-400-latin-ext.woff2",
  "fonts/press-start-2p-400-latin.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "index.html",
  "js/art.js",
  "js/core/audio.js",
  "js/core/avatar.js",
  "js/core/dom.js",
  "js/core/fx.js",
  "js/core/music.js",
  "js/core/perf.js",
  "js/core/save.js",
  "js/core/three-kit.js",
  "js/core/ui.js",
  "js/data/questions.js",
  "js/games/antikor.js",
  "js/games/ciz.js",
  "js/games/dondurma.js",
  "js/games/doner.js",
  "js/games/fetih.js",
  "js/games/gen.js",
  "js/games/kafe.js",
  "js/games/kovan.js",
  "js/games/koyun.js",
  "js/games/nano.js",
  "js/games/petri.js",
  "js/games/taki.js",
  "js/hub.js",
  "js/main.js",
  "js/registry.js",
  "manifest.webmanifest",
  "vendor/matter.min.js",
  "vendor/three.module.min.js"
];

async function broadcast(msg) {
  const list = await self.clients.matchAll({ includeUncontrolled: true });
  list.forEach((c) => c.postMessage(msg));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let done = 0;
    // Parça parça indirilir; yarıda kopan bağlantıda bir sonraki açılışta kalan iner
    const queue = ASSETS.slice();
    const worker = async () => {
      while (queue.length) {
        const url = queue.shift();
        const hit = await cache.match(url);
        if (!hit) {
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) throw new Error(`${url} ${res.status}`);
          await cache.put(url, res);
        }
        done++;
        broadcast({ type: 'progress', done, total: ASSETS.length });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    broadcast({ type: 'cached', version: VERSION });
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('sinemiko-yolda-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    broadcast({ type: 'ready', version: VERSION });
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = (await cache.match('./index.html')) || (await cache.match('./'));
      if (page) return page;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return new Response('', { status: 504, statusText: 'cevrimdisi' });
    }
  })());
});
