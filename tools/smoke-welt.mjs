// Weltentest ohne Browser: lädt das Spiel in Node (Bildschirm, Ton, Eingabe und Menüs als Attrappen) und
// spielt Welten automatisch durch wie tools/test-welten.js: starten, Gegner laufen lassen, Schlüssel, Boss,
// kämpfen (Mark unverwundbar, mit Juri und Krokodil), Boss besiegen. Meldet jeden Laufzeitfehler.
// Aufruf: node tools/smoke-welt.mjs 31 32 …   (ohne Zahlen: alle Welten)
// Gedacht für Bauaufträge ohne Browser (z. B. Qwen auf dem KI-Server). Ersetzt NICHT das Ansehen der Bilder.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Attrappen ──
const noop = () => {};
const grad = { addColorStop: noop };
function makeCtx() {
    const state = { globalAlpha: 1, lineWidth: 1, fillStyle: '#000', strokeStyle: '#000', font: '10px sans-serif' };
    let calls = 0;
    return new Proxy(state, {
        get(t, k) {
            if (k === '__calls') return calls;
            if (k in t) return t[k];
            // eigene Zwischenspeicher der Zeichenhelfer (ctx.__artGrads usw.) sind anfangs leer
            if (typeof k !== 'string' || k.startsWith('_')) return undefined;
            if (k === 'canvas') return { width: 800, height: 400 };
            if (k === 'measureText') return s => ({ width: String(s).length * 6 });
            if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') return () => grad;
            if (k === 'createPattern') return () => ({ setTransform: noop });
            if (k === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)) });
            if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
            if (k === 'isPointInPath' || k === 'isPointInStroke') return () => false;
            if (k === 'getLineDash') return () => [];
            return (...a) => {
                calls++;
                for (const v of a) if (typeof v === 'number' && !Number.isFinite(v)) {
                    throw new Error(`Zeichenbefehl ${String(k)} mit ungültiger Zahl ${v}`);
                }
            };
        },
        set(t, k, v) { t[k] = v; return true; },
    });
}
function makeEl(tag) {
    const el = {
        tagName: (tag || 'div').toUpperCase(), style: { setProperty: noop }, width: 800, height: 400,
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
        children: [], dataset: {}, innerHTML: '', textContent: '',
        appendChild(c) { this.children.push(c); return c; }, removeChild: noop, remove: noop,
        addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
        querySelector: () => makeEl(), querySelectorAll: () => [], closest: () => null,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }),
        getContext: () => makeCtx(), toDataURL: () => '', focus: noop, blur: noop,
    };
    return el;
}
const deep = () => new Proxy(function () {}, {
    get(t, k) {
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === 'then') return undefined;
        return deep();
    },
    apply() { return deep(); },
    set() { return true; },
});

const store = new Map();
const gameErrors = [];
const fakeConsole = { ...console, error: (...a) => { gameErrors.push(a.map(x => (x && x.message) || String(x)).join(' ').slice(0, 300)); if (process.env.SMOKE_STACK) for (const x of a) if (x && x.stack) console.log(x.stack.split('\n').slice(0, 6).join('\n')); }, warn: noop };
const ctx = {
    console: fakeConsole, Math, JSON, Date, Number, String, Array, Object, Map, Set, WeakMap, Symbol, Promise, Error,
    Uint8ClampedArray, Float32Array, Int32Array, Uint8Array, Uint16Array, Float64Array, Int16Array, Proxy, Reflect,
    parseInt, parseFloat, isNaN, isFinite,
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 10)), clearTimeout, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
    performance: { now: () => performance.now() },
    navigator: { userAgent: 'node', maxTouchPoints: 0, vibrate: noop },
    location: { protocol: 'http:', search: '', href: 'http://localhost/' },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    devicePixelRatio: 1, innerWidth: 800, innerHeight: 400,
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    addEventListener: noop, removeEventListener: noop, getComputedStyle: () => ({ paddingTop: '0', paddingRight: '0', paddingBottom: '0', paddingLeft: '0', getPropertyValue: () => '' }),
    Image: function () { return makeEl('img'); },
    OffscreenCanvas: function (w, h) { const e = makeEl('canvas'); e.width = w; e.height = h; return e; },
    Path2D: function () { return { moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, closePath: noop, rect: noop, bezierCurveTo: noop, quadraticCurveTo: noop, addPath: noop, roundRect: noop, arcTo: noop }; },
    AudioContext: function () { return deep(); },
};
ctx.window = ctx;
ctx.self = ctx;
ctx.document = {
    getElementById: () => makeEl('canvas'), createElement: t => makeEl(t), addEventListener: noop, removeEventListener: noop,
    documentElement: makeEl('html'), body: makeEl('body'), hidden: false, querySelector: () => makeEl(), querySelectorAll: () => [],
};
ctx.screen = { orientation: { lock: () => Promise.resolve() } };
vm.createContext(ctx);

// Ton, Musik, Eingabe und Menüs als Attrappen (die echten brauchen Web-Audio und DOM)
vm.runInContext(`
    var Sound = new Proxy({}, { get: () => () => {} });
    var Music = new Proxy({}, { get: () => () => {} });
    var UI = new Proxy({ screens: {}, ext: [], current: null, _rewardText: r => (r && r.label) || '' },
        { get: (t, k) => (k in t ? t[k] : () => {}) });
`, ctx);

// Skripte in der Reihenfolge aus index.html, ohne die ersetzten
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const skip = new Set(['sound', 'music', 'ui', 'ui-box', 'ui-end', 'ui-progress']);
const scripts = [...html.matchAll(/<script src="js\/([\w-]+)\.js/g)].map(m => m[1]).filter(n => !skip.has(n));
for (const n of scripts) {
    const file = path.join(root, 'js', n + '.js');
    try {
        vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: 'js/' + n + '.js' });
    } catch (e) {
        console.log(`FEHLER beim Laden von js/${n}.js: ${e.message}`);
        process.exit(1);
    }
}

// Spiel aufsetzen wie Game.init, ohne DOM-Ereignisse und Schleife
vm.runInContext(`
    Game.canvas = document.getElementById('game');
    Game.ctx = Game.canvas.getContext('2d');
    Game.resize = function () {};
    Game.viewW = 760; Game.viewH = 360; Game.renderScale = 1; Game.hudScale = 1; Game.hudW = 760; Game.hudH = 360;
    Game.safe = { t: 0, r: 0, b: 0, l: 0 };
    Game.save = function () {};
    Game.loadSettings(); Game.loadSave(); Progress.load();
    Game.maxWorldUnlocked = LAST_WORLD;
`, ctx);

const all = vm.runInContext('LAST_WORLD', ctx);
const wanted = process.argv.slice(2).map(Number).filter(n => n >= 1 && n <= all);
const worlds = wanted.length ? wanted : Array.from({ length: all }, (_, i) => i + 1);
let failed = 0;
for (const n of worlds) {
    gameErrors.length = 0;
    const r = vm.runInContext(`(function (n) {
        const r = { welt: n, fehler: null, schritt: 'start' };
        // Wache: jede Figur mit ungültiger Position sofort melden (sonst nur ein späterer Folgefehler)
        const wache = wo => {
            for (const e of Game.enemies) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) {
                throw new Error('Position ungültig (NaN) bei ' + e.constructor.name + ' (Zustand ' + (e.state || '-') + ') ' + wo);
            }
        };
        const origStep = Game.debugStep.bind(Game);
        Game.debugStep = (n, ms, dr) => { for (let i = 0; i < n; i++) { origStep(1, ms, dr); wache('in Schritt ' + r.schritt); } };
        try {
            Game.startWorld(n);
            r.gegner = Game.enemies.length;
            r.arten = [...new Set(Game.enemies.map(e => e.constructor.name))].join(',');
            r.schritt = 'gegner laufen';
            Game.player.iFrames = 1e9;
            for (let i = 0; i < 600; i++) { Game.player.iFrames = 1e9; Game.debugStep(1, 1000 / 60, i % 4 === 0); }
            r.schritt = 'gegner besiegen';
            for (const e of Game.enemies.slice(0, 6)) { e.iFrames = 0; e.takeDamage(9999, 0, 0); }
            for (let i = 0; i < 60; i++) Game.debugStep(1, 1000 / 60, i % 4 === 0);
            r.schritt = 'zum boss';
            Game.hasKey = true; Game.world.openBossDoor();
            const d = Game.world.bossDoorTiles[0];
            Game.player.x = d.x * TILE_SIZE + TILE_SIZE / 2 - Game.player.w / 2;
            Game.player.y = (d.y - 1) * TILE_SIZE + TILE_SIZE / 2 - Game.player.h / 2;
            Game.debugStep(250, 1000 / 60, false);
            const boss = Game.enemies.find(e => e.isBoss);
            r.boss = boss ? boss.constructor.name : null;
            r.bossHp = boss ? boss.maxHp : null;
            r.schritt = 'bosskampf';
            const room = Game._bossRoomRect();
            r.imRaum = true; r.geschosseMax = 0; r.zustaende = new Set();
            for (let i = 0; i < 1500; i++) {
                Game.player.iFrames = 1e9;
                // Mark läuft im Kreis durch den Raum, damit die Angriffe auch zielen müssen
                Game.player.x = room.x + room.w / 2 + Math.cos(i / 40) * room.w * 0.35 - Game.player.w / 2;
                Game.player.y = room.y + room.h / 2 + Math.sin(i / 40) * room.h * 0.35 - Game.player.h / 2;
                const vorher = String(boss && (boss.state || boss.mode || ''));
                Game.debugStep(1, 1000 / 60, i % 3 === 0);
                if (!Number.isFinite(Game.player.x) || !Number.isFinite(Game.player.y)) {
                    throw new Error('Marks Position ungültig (NaN) im Boss-Zustand ' + vorher + ' -> ' + (boss && boss.state));
                }
                if (boss) {
                    r.zustaende.add(String(boss.state || boss.mode || boss.attack || ''));
                    if (i === 750) boss.hp = Math.ceil(boss.maxHp * 0.45);       // Phase 2 erzwingen
                    if (!boss.dead && !(boss.x >= room.x - 1 && boss.y >= room.y - 1 &&
                        boss.x + boss.w <= room.x + room.w + 1 && boss.y + boss.h <= room.y + room.h + 1)) r.imRaum = false;
                }
                r.geschosseMax = Math.max(r.geschosseMax, Game.projectiles.length);
            }
            r.zustaende = [...r.zustaende].join(',');
            r.schritt = 'boss besiegen';
            let guard = 0;
            while (boss && !boss.dead && guard++ < 2000) {
                boss.iFrames = 0; boss.takeDamage(10, 0, 0); Game.debugStep(2, 1000 / 60, false);
                if (!Number.isFinite(Game.player.x)) throw new Error('Marks Position ungültig (NaN) beim Besiegen, Boss-Zustand ' + boss.state);
            }
            for (let i = 0; i < 400; i++) {
                Game.debugStep(1, 1000 / 60, false);
                if (!Number.isFinite(Game.player.x)) throw new Error('Marks Position ungültig (NaN) nach dem Sieg, Bild ' + i + ', Zustand ' + Game.state);
            }
            r.ende = Game.state;
            r.schritt = 'fertig';
        } catch (e) {
            r.fehler = e.message + ' | ' + String(e.stack || '').split('\\n').slice(1, 3).join(' ').trim();
        }
        Game.debugStep = origStep;
        return r;
    })(${n})`, ctx);
    if (gameErrors.length) r.fehler = r.fehler || ('abgefangene Spielfehler: ' + [...new Set(gameErrors)].slice(0, 3).join(' || '));
    const ok = !r.fehler && r.boss && r.imRaum && /WORLD_CLEAR|WIN/.test(r.ende || '');
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FEHLER'} Welt ${n}: ${r.fehler ? 'bei „' + r.schritt + '“: ' + r.fehler
        : `Gegner ${r.gegner} (${r.arten}), Boss ${r.boss} ${r.bossHp} LP, im Raum ${r.imRaum}, Geschosse max ${r.geschosseMax}, Ende ${r.ende}, Zustände ${r.zustaende}`}`);
}
// ── Zustände Gift, Schlaf und Einschleimen: eigene Probe in Welt 51 (Mark, Juri, Krokodil, Panda) ──
// Gift zieht ein halbes Herz pro Sekunde ab, macht nicht langsamer und endet von selbst.
// Schlaf hält fest (kein Laufen, kein Angriff), danach 1,5 s Schonzeit. Die Freunde fallen nicht k.o.
// Einschleimen (Welt 51): drei Sekunden kleben – die Figur läuft nur mit ~20 % Tempo, danach 1,5 s Schonzeit.
gameErrors.length = 0;
const z = vm.runInContext(`(function () {
    const r = { fehl: null, schritt: 'start' };
    // Ein Bild vorspulen: Mark und die Freunde bleiben unverwundbar, Sprungfelder werfen ihn nicht.
    // Jedes vierte Bild wird gezeichnet, damit die neuen Anzeigen (Gift-Tropfen, Zzz) mitprüfen.
    const bild = n => { for (let i = 0; i < n; i++) {
        Game.player.iFrames = 1e9; Game.player.jumpPadCooldown = 1e9;
        for (const c of Game.companions) c.iFrames = 1e9;
        Game.debugStep(1, 1000 / 60, i % 4 === 0);
    } };
    const durch = sek => bild(Math.round(sek * 60));
    const inp = Input.update;
    try {
        Game.startWorld(51);
        Game.player.iFrames = 1e9;
        // Beute im Messlauf ausschalten: Mark läuft hier für die Tempo- und Schlafproben durch die Gegend und
        // öffnet dabei beim Berühren eine Truhe (js/main.js:1772). Nach 1,5 s sammelt js/loot.js:50 deren
        // Inhalt EIN – bei 20 % Würfelglück ein Tempo-Blitz, der Marks Tempo auf 150 % hebt. Die Schleimprobe
        // misst dann 45 statt 30 und meldet „Schleim: Tempo false“, obwohl das Schleimern in Ordnung ist.
        // Der Gegenfall bleibt aus, das Öffnen der Truhe selbst (und alles andere) unverändert.
        for (const c of Game.chests) c.itemCollected = true;
        Game.player.powerUps = {};
        bild(4);
        const p = Game.player;
        Input.update = () => {};   // Eingabe eingefroren: nichts läuft und nichts greift an

        // ── Gift bei Mark ──
        r.schritt = 'gift';
        // Schutz wie bei stun: Krone und Auto lassen Gift, Schlaf und Schleim gar nicht erst wirken
        p.autoActive = false; p.dodging = false;
        p.crownShieldTimer = 5;
        r.kroneSchuetzt = p.poison(3) === false && p.sleep(1) === false && p.slime(3) === false;
        p.crownShieldTimer = 0; p.autoActive = true;
        r.autoSchuetzt = p.poison(3) === false && p.sleep(1) === false && p.slime(3) === false;
        p.autoActive = false; p.slimeTimer = 0; p.slimeGuard = 0;
        p.autoActive = false;
        p.hp = p.maxHp; p.poisonTimer = 0; p.poisonTick = 0; p.sleepTimer = 0; p.sleepGuard = 0;
        r.giftSetzt = p.poison(3) === true;
        const lp0 = p.hp;
        durch(1.05); r.lpNach1s = lp0 - p.hp;
        durch(2); r.lpNach3s = lp0 - p.hp;
        r.giftWeg = p.poisonTimer <= 0 && p.poisonTick === 0;
        r.nichtLangsamer = p.slowTimer <= 0 && p.speed === p.baseSpeed;
        p.poison(2); const t1 = p.poisonTimer;
        p.poison(0.5); r.nurVerlaengert = p.poisonTimer === t1;
        r.totDurchGift = p.dead;

        // ── Belohnungs-Merker: jede im Lauf durchgespielte neue Welt muss ihren Merker gesetzt haben ──
        r.schritt = 'merker';
        const feld = {
            45: 'unlockedLaserBalls', 46: 'unlockedBoomBall', 47: 'unlockedPandaFriend',
            48: 'unlockedIceBall', 49: 'unlockedShadowCloud', 50: 'unlockedIceHammer',
            51: 'unlockedStickyBall', 52: 'unlockedDoubleHammer', 53: 'unlockedPoisonSpit',
            54: 'unlockedRubberHammer', 55: 'unlockedVineBind', 56: 'unlockedPoisonBlooms',
            57: 'unlockedCoconutTube',
        };
        // Der Lauf setzt das freigeschaltete Maximum vorab hoch, deshalb kommt die Weltenliste von außen here.
        const gespielt = [45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57].filter(w => (${JSON.stringify(worlds)}).includes(w));
        r.merker = gespielt.map(w => feld[w] + '=' + Game[feld[w]]).join(' ');
        r.merkerOk = gespielt.every(w => Game[feld[w]] === true);

        // Laufrichtung suchen, in der Mark frei läuft (sonst misst die Prüfung eine Wand)
        const freieRichtung = () => {
            for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
                Input.update = () => { Input.direction = d; };
                const ax = p.x, ay = p.y;
                durch(0.35);
                if (Math.hypot(p.x - ax, p.y - ay) > 10) return d;
            }
            return null;
        };
        r.schritt = 'schlaf';
        p.poisonTimer = 0; p.poisonTick = 0; p.sleepTimer = 0; p.sleepGuard = 0;
        const frei = freieRichtung();
        r.laeuftWach = !!frei;
        Input.update = () => { Input.direction = frei || { x: 1, y: 0 }; };
        p.sleepTimer = 0; p.sleepGuard = 0;
        r.schlafWirkte = p.sleep(1) === true;
        const sx = p.x, sy = p.y;
        durch(0.8);
        r.schlaeftNoch = p.sleepTimer > 0;
        r.haeltFest = Math.hypot(p.x - sx, p.y - sy) < 1;
        durch(0.4);
        r.aufgewacht = p.sleepTimer <= 0 && p.sleepGuard > 0;
        r.schonzeitWirkt = p.sleep(1) === false && p.sleepTimer <= 0;
        durch(1);
        r.schonzeitNoch = p.sleep(1) === false;
        durch(0.5);
        r.nachSchonzeit = p.sleep(1) === true && p.sleepTimer > 0;
        // wach läuft er wieder: von der jetzigen Position muss mindestens eine Richtung frei sein
        p.sleepTimer = 0; p.sleepGuard = 0;
        r.laeuftWieder = !!freieRichtung();

        // ── Juri und das Schattenkrokodil ──
        r.schritt = 'freunde';
        const j = Game.companions.find(c => c instanceof Juri);
        const k = Game.companions.find(c => c instanceof ShadowCrocodile);
        r.freundeDa = !!j && !!k;
        if (!r.freundeDa) throw new Error('Juri oder Schattenkrokodil nicht dabei');
        for (const c of [j, k]) {
            c.hp = c.maxHp; c.poisonTimer = 0; c.poisonTick = 0; c.sleepTimer = 0; c.sleepGuard = 0;
        }
        j.poison(6); k.poison(6);
        durch(3.05);
        r.freundeLP = (j.maxHp - j.hp) + '/' + (k.maxHp - k.hp);
        j.hp = 2; j.poison(3); k.hp = 2; k.poison(3);
        durch(3.05);
        r.keinKo = !j.dead && !k.dead && j.hp >= 1 && k.hp >= 1;
        r.giftWegFreunde = j.poisonTimer <= 0 && k.poisonTimer <= 0;
        for (const c of [j, k]) { c.sleepTimer = 0; c.sleepGuard = 0; }
        r.schlafFreunde = j.sleep(2) === true && k.sleep(2) === true;
        const jp = [j.x, j.y], kp = [k.x, k.y];
        durch(1);
        r.freundeRuhen = Math.hypot(j.x - jp[0], j.y - jp[1]) < 1 && Math.hypot(k.x - kp[0], k.y - kp[1]) < 1
            && !j.dead && !k.dead;
        durch(1.4);
        r.freundeAuf = j.sleepTimer <= 0 && j.sleepGuard > 0 && k.sleepTimer <= 0 && !j.dead && !k.dead;
        r.freundeSchonzeit = j.sleep(1) === false && k.sleep(1) === false;

        // ── Einschleimen (Welt 51): drei Sekunden kleben, nur ~20 % Tempo, danach 1,5 s Schonzeit ──
        r.schritt = 'schleim';
        p.slimeTimer = 0; p.slimeGuard = 0;
        const pb = Game.companions.find(c => c instanceof PandaBuddy);   // dabei, seit Welt 47 gespielt
        // Temptest: 0,5 s im Schleim kriechen, dann wach dieselbe Richtung laufen. Gewertet nur eine
        // Richtung mit mindestens 30 px freiem Boden – sonst misst die Prüfung eine Wand.
        const schleimMass = () => {
            for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
                Input.update = () => { Input.direction = d; };
                p.slimeTimer = 0; p.slimeGuard = 0;
                p.slime(3);
                const ax = p.x, ay = p.y;
                durch(0.5);
                const schleim = Math.hypot(p.x - ax, p.y - ay);
                const tempo = p.speed;
                // Wache: wäre doch ein Power-up dazugekommen, stimmt die Messung nicht – dann hier mit dem
                // wahren Grund abbrechen und nicht als „Schleim: Tempo false“, das das Schleimern anklagt.
                if (Object.keys(p.powerUps).length) {
                    throw new Error('Schleimprobe durch fremdes Power-up gestört: ' + Object.keys(p.powerUps).join('+'));
                }
                p.slimeTimer = 0; p.slimeGuard = 0;
                const bx = p.x, by = p.y;
                durch(0.5);
                const wach = Math.hypot(p.x - bx, p.y - by);
                if (wach > 30) return { schleim, wach, tempo };
            }
            return null;
        };
        const sm = schleimMass();
        r.schleimGemessen = !!sm;
        r.schleimLangsam = !!sm && sm.schleim < sm.wach * 0.5 && sm.schleim > 0.5;
        r.schleimTempo = !!sm && Math.abs(sm.tempo - p.baseSpeed * 0.2) < 0.01;
        p.slimeTimer = 0; p.slimeGuard = 0;
        r.schleimWirkte = p.slime(3) === true && p.slimeTimer === 3;
        p.slime(1); r.schleimNurVerlaengert = p.slimeTimer === 3;
        durch(3.05);
        r.schleimWeg = p.slimeTimer <= 0 && p.slimeGuard > 0;
        r.schleimSchonzeit = p.slime(2) === false && p.slimeTimer <= 0;
        durch(1.6);
        r.schleimFrisch = p.slime(2) === true && p.slimeTimer > 0;
        p.slimeTimer = 0; p.slimeGuard = 0;
        // Freunde: dasselbe Spiel – sie kleben, laufen aber weiter (kein k.o.), danach Schonzeit
        for (const c of [j, k, pb]) { if (c) { c.slimeTimer = 0; c.slimeGuard = 0; } }
        r.schleimFreunde = j.slime(3) === true && k.slime(3) === true && (!pb || pb.slime(3) === true);
        durch(1);
        r.freundeSchleim = j.slimeTimer > 0 && k.slimeTimer > 0 && !j.dead && !k.dead && (!pb || !pb.dead);
        durch(2.1);
        r.freundeSchleimWeg = j.slimeTimer <= 0 && j.slimeGuard > 0 && k.slimeTimer <= 0 && !j.dead && !k.dead;
        r.freundeSchleimSchon = j.slime(1) === false && k.slime(1) === false;
        durch(1.6);
        r.freundeSchleimFrisch = j.slime(2) === true && k.slime(2) === true && (!pb || pb.slime(2) === true);
        r.schritt = 'fertig';
    } catch (e) {
        r.fehl = e.message + ' | ' + String(e.stack || '').split('\\n').slice(1, 3).join(' ').trim();
    }
    Input.update = inp;
    return r;
})()`, ctx);
if (gameErrors.length) z.fehl = z.fehl || ('abgefangene Spielfehler: ' + [...new Set(gameErrors)].slice(0, 3).join(' || '));
if (z.fehl) {
    console.log(`FEHLER Zustände: bei „${z.schritt}“: ${z.fehl}`);
    failed++;
} else {
    const gut = z.merkerOk && z.kroneSchuetzt && z.autoSchuetzt && z.giftSetzt && z.lpNach1s === 2 && z.lpNach3s === 6 && z.giftWeg && z.nichtLangsamer
        && z.nurVerlaengert && z.schlafWirkte && z.schlaeftNoch && z.haeltFest && z.aufgewacht
        && z.schonzeitWirkt && z.schonzeitNoch && z.nachSchonzeit && z.laeuftWach && z.laeuftWieder
        && z.freundeDa && z.freundeLP === '6/6' && z.keinKo && z.giftWegFreunde && z.schlafFreunde
        && z.freundeRuhen && z.freundeAuf && z.freundeSchonzeit
        && z.schleimGemessen && z.schleimLangsam && z.schleimTempo && z.schleimWirkte && z.schleimNurVerlaengert
        && z.schleimWeg && z.schleimSchonzeit && z.schleimFrisch && z.schleimFreunde
        && z.freundeSchleim && z.freundeSchleimWeg && z.freundeSchleimSchon && z.freundeSchleimFrisch;
    if (!gut) failed++;
    console.log(`${gut ? 'OK  ' : 'FEHLER'} Zustände: Merker ${z.merker}; Schutz durch Krone ${z.kroneSchuetzt} und Auto ${z.autoSchuetzt}; `
        + `Gift ${z.lpNach1s} LP in gut 1 s und ${z.lpNach3s} LP in gut 3 s, danach weg ${z.giftWeg}, `
        + `nicht langsamer ${z.nichtLangsamer}, nur verlängern ${z.nurVerlaengert}; `
        + `Schlaf hält fest ${z.haeltFest}, Schonzeit ${z.schonzeitWirkt}/${z.schonzeitNoch}, danach wieder ${z.nachSchonzeit}, `
        + `wach läuft er ${z.laeuftWieder}; Freunde Gift ${z.freundeLP} LP ohne K.o. ${z.keinKo}, `
        + `Schlaf ohne K.o. ${z.freundeRuhen}/${z.freundeAuf}, Schonzeit ${z.freundeSchonzeit}; `
        + `Schleim: Tempo ${z.schleimTempo}, langsamer unterwegs ${z.schleimLangsam}, nur verlängern ${z.schleimNurVerlaengert}, `
        + `danach weg ${z.schleimWeg}, Schonzeit ${z.schleimSchonzeit}, danach wieder ${z.schleimFrisch}; `
        + `Freunde Schleim ${z.freundeSchleim}/${z.freundeSchleimWeg}, Schonzeit ${z.freundeSchleimSchon}, danach wieder ${z.freundeSchleimFrisch}`);
}
console.log(failed ? `${failed} von ${worlds.length} Welten mit Fehlern` : `Alle ${worlds.length} Welten in Ordnung`);
process.exitCode = failed ? 1 : 0;
