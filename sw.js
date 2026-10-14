// Stamped service worker: keeps the app, map library, fonts and map tiles available offline.
const VERSION = 'stamped-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/store.js', 'js/util.js', 'js/services.js', 'js/globe.js', 'js/map.js',
  'vendor/d3-array.min.js', 'vendor/d3-geo.min.js',
  'data/airports.json', 'data/land110.json',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
const RUNTIME = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const TILES = 'tiles.openfreemap.org';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'stamped-tiles' && k !== 'stamped-runtime').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
async function shellFirst(req) {
  // App files: serve cached copy instantly, refresh in the background.
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(shellFirst(req)); return; }
  if (url.hostname === TILES && !url.pathname.endsWith('/planet')) { e.respondWith(cacheFirst(req, 'stamped-tiles')); return; }
  if (url.hostname === TILES) { e.respondWith(fetch(req).then((res) => { caches.open('stamped-runtime').then((c) => c.put(req, res.clone())); return res; }).catch(() => caches.match(req))); return; }
  if (RUNTIME.includes(url.hostname)) { e.respondWith(cacheFirst(req, 'stamped-runtime')); return; }
  // APIs (weather, currency, search) go straight to the network; the app keeps its own copies.
});
