// Çevrimdışı kalkan: ilk açılışta bütün oyun dosyaları telefona iner, sonra internet hiç gerekmez.
// Bu dosya tools/build.py ile üretilir, elle değiştirme.

const VERSION = '__VERSION__';
const CACHE = `sinemiko-yolda-${VERSION}`;
const ASSETS = __ASSETS__;

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
