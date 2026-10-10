// Service Worker: Spiel auch offline spielbar.
// Die Seite (index.html) kommt zuerst aus dem Netz, damit Updates sofort ankommen. Alle anderen
// Dateien sind über ?v=… versioniert und damit unveränderlich: sie kommen aus dem Speicher, sonst
// aus dem Netz. So entsteht nie eine Mischung aus alten und neuen Dateien.
// Bei jedem Update: APP_VERSION hier UND die ?v=-Angaben in index.html gemeinsam erhöhen.
const APP_VERSION = '9.5.0';
const CACHE = 'mark-' + APP_VERSION;
const V = '?v=' + APP_VERSION;
const CORE = [
    './',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    ...['game', 'box', 'end', 'progress'].map(n => './css/' + n + '.css' + V),
    ...['utils', 'art', 'fx', 'data', 'sound', 'music', 'input', 'camera', 'world', 'weapons', 'loot',
        'entities', 'entities2', 'zombie', 'butterfly', 'dragon',
        'werewolf', 'angel', 'mummy', 'firepig', 'thunder', 'witch',
        'bunny', 'devil', 'alien', 'spider', 'toad', 'dwarf', 'treemonster', 'golem', 'pumpkin', 'crab', 'eagle', 'fox', 'porcupine', 'gorilla', 'player', 'hud', 'progress', 'ui',
        'ui-box', 'ui-end', 'ui-progress', 'main'].map(n => './js/' + n + '.js' + V),
    './frosty-burger/',
    './frosty-burger/styles.css?v=1.2.1',
    './frosty-burger/game.js?v=1.2.1',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            // cache: 'reload' umgeht den HTTP-Zwischenspeicher, damit wirklich die neue Fassung landet
            .then(cache => cache.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('mark-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    const isPage = req.mode === 'navigate' || req.destination === 'document';
    event.respondWith(isPage ? pageFirstNetwork(req) : assetFromCache(req));
});

// Seiten: Netz zuerst (mit Zeitlimit), sonst gespeicherte Fassung
async function pageFirstNetwork(req) {
    const cache = await caches.open(CACHE);
    try {
        const net = await Promise.race([
            fetch(req),
            new Promise((_, reject) => setTimeout(() => reject(new Error('zu langsam')), 5000)),
        ]);
        if (net && net.ok) cache.put(req, net.clone());
        return net;
    } catch (e) {
        return (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true })) ||
            (await cache.match('./')) || Response.error();
    }
}

// Versionierte Dateien: exakt passende Fassung aus dem Speicher, sonst aus dem Netz holen und merken
async function assetFromCache(req) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
        const net = await fetch(req);
        if (net && net.ok) cache.put(req, net.clone());
        return net;
    } catch (e) {
        // Letzter Ausweg offline: gleiche Datei ohne Versionsangabe
        return (await cache.match(req, { ignoreSearch: true })) || Response.error();
    }
}
