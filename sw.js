// 筆の間 — Service Worker
// バージョン文字列を変えるとクライアントのキャッシュが破棄される
const CACHE = 'fude-no-ma-v1.0.3';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/themes.css',
  './css/editor.css',
  './js/app.js',
  './js/store.js',
  './js/util.js',
  './js/editor.js',
  './js/search.js',
  './js/chart.js',
  './js/modal.js',
  './js/screens.js',
  './js/data/samples.js',
  './assets/icon.svg',
  './assets/icon-maskable.svg',
];

// PNG アイコンは存在すれば取りに行く（無くてもエラーにしない）
const OPTIONAL = [
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    // オプションは個別に。1つ失敗しても他は続行
    for (const url of OPTIONAL) {
      try { await cache.add(url); } catch (_) { /* ignore */ }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 旧キャッシュを削除
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 同一オリジン: キャッシュファースト、なければネットワーク
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) {
        // バックグラウンドで更新
        fetch(req).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      } catch (e) {
        // オフライン時のフォールバック
        if (req.mode === 'navigate') {
          const offlinePage = await caches.match('./index.html');
          if (offlinePage) return offlinePage;
        }
        throw e;
      }
    })());
    return;
  }

  // CDN（Chart.js など）: ネットワーク優先、失敗時にキャッシュ
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return res;
    } catch (e) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw e;
    }
  })());
});

// クライアントからのメッセージで即時更新
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
