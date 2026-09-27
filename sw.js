// Service Worker: Spiel auch offline spielbar. Erst Netz (damit Updates sofort ankommen), sonst Speicher.
const VERSION = 'mark-9.0.0';
const CORE = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/game.css',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './js/utils.js', './js/art.js', './js/fx.js', './js/data.js', './js/sound.js', './js/music.js', './js/input.js',
    './js/camera.js', './js/world.js', './js/weapons.js', './js/loot.js', './js/entities.js',
    './js/entities2.js', './js/player.js', './js/hud.js', './js/ui.js', './js/main.js',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(CORE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    event.respondWith((async () => {
        const cache = await caches.open(VERSION);
        try {
            const net = await Promise.race([
                fetch(req),
                new Promise((_, reject) => setTimeout(() => reject(new Error('zu langsam')), 4000)),
            ]);
            if (net && net.ok) cache.put(req, net.clone());
            return net;
        } catch (e) {
            const hit = await cache.match(req, { ignoreSearch: true });
            if (hit) return hit;
            if (req.mode === 'navigate') {
                const page = await cache.match('./index.html');
                if (page) return page;
            }
            throw e;
        }
    })());
});
