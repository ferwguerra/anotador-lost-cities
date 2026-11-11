// Deja la app disponible sin conexión. Primero intenta la red (así llegan las actualizaciones)
// y, si no hay, responde con la última copia guardada.
var CACHE = 'anotador-v5';
var FILES = ['./', 'index.html', 'style.css', 'logic.js', 'app.js', 'manifest.webmanifest', 'icon-v2-180.png', 'icon-v2-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
