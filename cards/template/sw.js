/* THE CARD'S WORKER - what lets the icon on someone's home screen open
 * straight away, with or without a signal.
 *
 *   the page       network first. An edit to the card reaches every
 *                  installed copy the next time it is opened with a signal;
 *                  with none, the last copy it saw opens instead of an error.
 *   everything else  from the cache, fetched once and kept. Its code carries
 *                  a content hash and its art is renamed when it changes, so
 *                  a cached file is never a stale one.
 *
 * tools/card/build.js fills in the three tokens: the cache name (which moves
 * whenever anything on the card does), the prefix it clears old caches by,
 * and the list of files to hold from the first visit.
 */
var CACHE = '__CACHE__', PREFIX = '__PREFIX__', SHELL = __SHELL__;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;          /* analytics, the form service */

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./', copy); });
        return res;
      }).catch(function () {
        return caches.match('./', { cacheName: CACHE });
      })
    );
    return;
  }

  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res.ok && (url.pathname.indexOf(self.registration.scope.replace(location.origin, '')) === 0 ||
                     url.pathname.indexOf('/assets/fonts/') === 0)) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});
