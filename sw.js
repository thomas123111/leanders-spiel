// Service Worker: Spiel auch offline spielbar.
// Die Seite (index.html) kommt zuerst aus dem Netz, damit Updates sofort ankommen. Alle anderen
// Dateien sind über ?v=… versioniert und damit unveränderlich: sie kommen aus dem Speicher, sonst
// aus dem Netz. So entsteht nie eine Mischung aus alten und neuen Dateien.
// Bei jedem Update: APP_VERSION hier UND die ?v=-Angaben in index.html gemeinsam erhöhen.
const APP_VERSION = '9.10.0';
const CACHE = 'mark-' + APP_VERSION;
const V = '?v=' + APP_VERSION;
const CORE = [
    './',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    ...['game.css', 'box.css', 'rad.css', 'end.css', 'progress.css', 'waffen.css'].map(n => './css/' + n + V),
    './css/shop2.css' + V,     // Shop mit Abteilungen (eigens genannt, damit die Datei in CORE steht)
    './js/shop-felder.js' + V, // Fragezeichen-Felder im Coinshop (eigens genannt, damit die Datei in CORE steht)
    './js/shop-woche.js' + V,  // Wochenangebote in der Wochenbelohnung (eigens genannt, damit die Datei in CORE steht)
    // Jede Datei mit ihrer Endung genannt, damit der Tor-Lauf jede einzelne in CORE nachweisen kann
    ...['utils.js', 'art.js', 'fx.js', 'data.js', 'sound.js', 'music.js', 'input.js', 'camera.js', 'world.js',
        'weapons.js', 'loot.js', 'entities.js', 'entities2.js', 'pandafreund.js', 'zombie.js', 'butterfly.js',
        'dragon.js', 'werewolf.js', 'angel.js', 'mummy.js', 'firepig.js', 'thunder.js', 'witch.js',
        'bunny.js', 'devil.js', 'alien.js', 'spider.js', 'toad.js', 'dwarf.js', 'treemonster.js', 'golem.js',
        'pumpkin.js', 'crab.js', 'eagle.js', 'fox.js', 'porcupine.js', 'gorilla.js',
        'peacock.js', 'clown.js', 'panda.js', 'unicorn.js', 'vampire.js', 'snowman.js',
        'candy.js', 'rat.js', 'scorpion.js',
        'pudding.js', 'noodle.js', 'bee.js', 'monkey.js', 'player.js', 'hud.js', 'progress.js', 'ui.js',
        'ui-box.js', 'ui-rad.js', 'ui-end.js', 'ui-progress.js', 'ui-waffen.js', 'main.js', 'upgrades.js',
        'upgrades-mark.js', 'upgrades-juri.js', 'upgrades-croc.js', 'upgrades-panda.js',
        'modes.js', 'modes-a.js', 'modes-b.js', 'modes-c.js', 'modes-d.js'].map(n => './js/' + n + V),
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
