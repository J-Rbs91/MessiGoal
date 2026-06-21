'use strict';

/**
 * Service worker MessiGoal — met l'application en cache pour un usage hors-ligne
 * et une installation en tant qu'application (PWA).
 *
 * Stratégie : RÉSEAU D'ABORD pour tout (HTML/CSS/JS comme les données), avec
 * repli sur le cache hors-ligne. Ainsi l'app et les buts sont toujours à jour
 * dès qu'on est en ligne, et restent disponibles hors connexion. (Une stratégie
 * « cache d'abord » figeait l'ancienne version de l'app sur les appareils.)
 */

const VERSION = 'messigoal-v8';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg',
];

// Permet à la page d'activer immédiatement une nouvelle version (voir app.js).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Réseau d'abord (toujours à jour), repli sur le cache (hors-ligne).
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
