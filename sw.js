// Service worker de Ma PFMP : l'appli s'ouvre même avec un réseau faible.
// Stratégie « réseau d'abord » : la dernière version publiée est toujours prise quand le réseau répond.
const CACHE = 'mapfmp-v1.3.0';
const COQUILLE = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/api.js', 'js/config.js', 'js/ui.js', 'js/eleve.js', 'js/prof.js', 'js/orga.js', 'js/rubriques.js', 'js/complet.js',
  'icones/icone-192.png', 'icones/icone-512.png', 'icones/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Les appels au serveur (api.ma-pfmp.fr) ne passent jamais par le cache.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); }
        return rep;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
