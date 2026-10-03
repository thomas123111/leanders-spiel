// ── World / Level System ──

const TILE_SIZE = 32;

// Tile types
const TILE_EMPTY = 0;
const TILE_WALL = 1;
const TILE_FLOOR = 2;
const TILE_DOOR = 3;
const TILE_BOSS_DOOR = 4;
const TILE_WINDOW = 5;
const TILE_SPAWN = 6;
const TILE_BOSS_SPAWN = 7;
const TILE_BUSH = 8;
const TILE_WATER = 9;
const TILE_SKULL = 10;
const TILE_JUMP_PAD = 11;

// Undurchdringliche Kacheln (Fenster sitzen in Wänden und sind deshalb auch fest).
function isSolidTile(t) {
    return t === TILE_WALL || t === TILE_BOSS_DOOR || t === TILE_WATER || t === TILE_WINDOW;
}

// Breitensuche über begehbare Kacheln. Liefert ein Array „erreichbar“ (Index y * breite + x).
function reachableTiles(map, sx, sy) {
    const h = map.length;
    const w = map[0].length;
    const seen = new Uint8Array(w * h);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return seen;
    const q = [sy * w + sx];
    seen[sy * w + sx] = 1;
    while (q.length) {
        const i = q.pop();
        const x = i % w;
        const y = (i - x) / w;
        const next = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of next) {
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (seen[j] || isSolidTile(map[ny][nx])) continue;
            seen[j] = 1;
            q.push(j);
        }
    }
    return seen;
}

// ── Bewegung mit Wand-Kollision (für Spieler und Gegner gemeinsam) ──
// Löst nur Wände auf, in die die Figur in diesem Schritt hineinläuft (früher wurde nach Laufrichtung
// geschoben – Figuren in einer Wand flogen so durch Wände und aus der Karte). Große Schritte werden geteilt.
function moveWithCollision(e, dx, dy, world) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 12));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
        if (sx) _moveAxis(e, sx, 0, world);
        if (sy) _moveAxis(e, 0, sy, world);
    }
    if (world.pixelWidth) {
        e.x = clamp(e.x, 0, Math.max(0, world.pixelWidth - e.w));
        e.y = clamp(e.y, 0, Math.max(0, world.pixelHeight - e.h));
    }
}

function _moveAxis(e, dx, dy, world) {
    const bx = e.x;
    const by = e.y;
    e.x += dx;
    e.y += dy;
    const cols = world.collideRect({ x: e.x, y: e.y, w: e.w, h: e.h });
    if (!cols.length) return;
    const before = { x: bx, y: by, w: e.w, h: e.h };
    for (const wall of cols) {
        if (rectOverlap(before, wall)) continue; // steckte schon drin → nicht quer durchschieben
        if (dx > 0) e.x = Math.min(e.x, wall.x - e.w);
        else if (dx < 0) e.x = Math.max(e.x, wall.x + wall.w);
        if (dy > 0) e.y = Math.min(e.y, wall.y - e.h);
        else if (dy < 0) e.y = Math.max(e.y, wall.y + wall.h);
    }
}

// Steckt eine Figur in einer Wand, auf die nächste freie Position setzen (Suche in Kachelschritten).
function escapeFromWalls(e, world, maxRadius = 8) {
    if (!world.collideRect({ x: e.x, y: e.y, w: e.w, h: e.h }).length) return false;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    let best = null;
    let bestD = Infinity;
    const step = TILE_SIZE / 2;
    for (let r = 1; r <= maxRadius * 2 && !best; r++) {
        for (let ix = -r; ix <= r; ix++) {
            for (let iy = -r; iy <= r; iy++) {
                if (Math.max(Math.abs(ix), Math.abs(iy)) !== r) continue;
                const nx = cx + ix * step - e.w / 2;
                const ny = cy + iy * step - e.h / 2;
                if (nx < 0 || ny < 0 || nx + e.w > world.pixelWidth || ny + e.h > world.pixelHeight) continue;
                if (world.collideRect({ x: nx, y: ny, w: e.w, h: e.h }).length) continue;
                const d = ix * ix + iy * iy;
                if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
            }
        }
    }
    if (best) {
        e.x = best.x;
        e.y = best.y;
        return true;
    }
    return false;
}

// Mitte der nächsten freien Kachel (z. B. für Schlüssel, die sonst in der Wand liegen würden).
function nearestFreeTileCenter(world, px, py) {
    const sx = clamp(Math.floor(px / TILE_SIZE), 0, world.width - 1);
    const sy = clamp(Math.floor(py / TILE_SIZE), 0, world.height - 1);
    for (let r = 0; r < 12; r++) {
        for (let ix = -r; ix <= r; ix++) {
            for (let iy = -r; iy <= r; iy++) {
                if (Math.max(Math.abs(ix), Math.abs(iy)) !== r) continue;
                const x = sx + ix, y = sy + iy;
                if (x < 1 || y < 1 || x >= world.width - 1 || y >= world.height - 1) continue;
                if (!isSolidTile(world.tiles[y][x])) return { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
            }
        }
    }
    return { x: px, y: py };
}

function findTile(map, type) {
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[0].length; x++) if (map[y][x] === type) return { x, y };
    }
    return null;
}

// Anzahl der vom Start aus erreichbaren begehbaren Kacheln
function countReachable(map) {
    const s = findTile(map, TILE_SPAWN);
    if (!s) return 0;
    const seen = reachableTiles(map, s.x, s.y);
    let n = 0;
    for (let i = 0; i < seen.length; i++) n += seen[i];
    return n;
}

// Feste Kachel (z. B. Wasser) nur setzen, wenn dadurch kein Bereich abgeschnitten wird:
// die Zahl erreichbarer Kacheln darf nur um genau diese eine sinken.
function placeSolidSafely(map, x, y, type) {
    if (map[y][x] !== TILE_FLOOR) return false;
    const before = countReachable(map);
    map[y][x] = type;
    if (countReachable(map) !== before - 1 || !bossDoorReachable(map)) {
        map[y][x] = TILE_FLOOR;
        return false;
    }
    return true;
}

// Ist das Feld vor der Boss-Tür vom Start aus erreichbar?
function bossDoorReachable(map) {
    const s = findTile(map, TILE_SPAWN);
    const d = findTile(map, TILE_BOSS_DOOR);
    if (!s || !d) return false;
    const seen = reachableTiles(map, s.x, s.y);
    return !!seen[(d.y - 1) * map[0].length + d.x];
}

// ══ Welt-Grafik: Hilfen und Paletten ══
// Alles hier ist reine Darstellung. Kein DOM beim Laden (die Kartenprüfung läuft ohne Browser).

const WORLD_BLOCK = 6;      // Kacheln je vorgerendertem Block (Kantenlänge)
const WALL_FRONT = 11;      // Höhe der Wand-Vorderseite (unteres Drittel der Kachel)
const W_TAU = Math.PI * 2;
const W_POOL = [];          // freie Block-Leinwände (werden über Welten hinweg wiederverwendet)

// Farben ohne DOM: '#rgb'/'#rrggbb' mischen, aufhellen, abdunkeln (gecacht).
const _wcCache = new Map();
function wcRgb(c) {
    let v = _wcCache.get(c);
    if (v) return v;
    let h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    _wcCache.set(c, v);
    return v;
}
function wcMix(a, b, t) {
    t = Math.round(t * 50) / 50;
    const key = a + b + t;
    let v = _wcCache.get(key);
    if (v) return v;
    const p = wcRgb(a), q = wcRgb(b);
    const f = i => Math.round(p[i] + (q[i] - p[i]) * t).toString(16).padStart(2, '0');
    v = '#' + f(0) + f(1) + f(2);
    if (_wcCache.size > 4000) _wcCache.clear();
    _wcCache.set(key, v);
    return v;
}
function wcLight(c, t) { return wcMix(c, '#ffffff', t); }
function wcDark(c, t) { return wcMix(c, '#0c0618', t); }
function wcA(c, a) {
    a = Math.round(a * 100) / 100;
    const key = c + '/' + a;
    let v = _wcCache.get(key);
    if (v) return v;
    const p = wcRgb(c);
    v = `rgba(${p[0]},${p[1]},${p[2]},${a})`;
    _wcCache.set(key, v);
    return v;
}

// Deterministischer Zufall je Kachel (0..1)
function wHash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
// Kleiner Zufallsgenerator für mehrere Werte je Kachel
function wRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// Punkte auf weltfestem Raster streuen (nahtlos über Kachel- und Blockgrenzen)
function wScatter(x0, y0, w, h, cell, pad, seed, fn) {
    const gx0 = Math.floor((x0 - pad) / cell), gx1 = Math.floor((x0 + w + pad) / cell);
    const gy0 = Math.floor((y0 - pad) / cell), gy1 = Math.floor((y0 + h + pad) / cell);
    for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
            fn(gx * cell + wHash(gx, gy, seed) * cell, gy * cell + wHash(gy, gx, seed + 7) * cell, wHash(gx, gy, seed + 13), gx, gy);
        }
    }
}
// Abgerundetes Rechteck als Pfad (mit Ersatz für alte Browser); r = Zahl oder [lo, ro, ru, lu]
function wRound(c, x, y, w, h, r) {
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    const q = Array.isArray(r) ? r : [r, r, r, r];
    c.moveTo(x + q[0], y);
    c.arcTo(x + w, y, x + w, y + h, q[1]);
    c.arcTo(x + w, y + h, x, y + h, q[2]);
    c.arcTo(x, y + h, x, y, q[3]);
    c.arcTo(x, y, x + w, y, q[0]);
    c.closePath();
}

// Paletten je Thema. floor = Schachbrett-Töne, wall/wallF = Oberseite/Vorderseite,
// fs/ws = Boden-/Wandstil, water = Art des Wassers, deco = [Art, Gewicht], win = Fenster-Deko,
// dark = Stärke der Abdunklung (Lichtkreis um Mark), glow = Leuchtfarbe der Fenster.
const WORLD_THEMES = {
    training: {
        void: '#1c3a24', vignette: 0.3, shade: '#0c2a12', fs: 'grass', stripes: 2, floor: ['#5c9f4b', '#54944a'],
        ws: 'pads', wall: '#3d86df', wallF: '#2458aa', accent: '#ffe45c', lines: 'training', deepCol: '#10245a',
        bush: ['#23702f', '#3a9a3a', '#7ad65c'], bx: 'flowers', bxc: ['#ffffff', '#ffd0ea'],
        water: 'water', wc: ['#1d68c8', '#3a98ee', '#c4ecff'], bone: '#f6efdd', pad: '#ff9d2e',
        deco: [['tuft', 6], ['clover', 2], ['flower', 2], ['cone', 0.7], ['ball', 0.4]], rate: 0.32,
        flowers: ['#ffffff', '#ffe066', '#ffb3d9'], win: 'target',
    },
    castle: {
        void: '#150c2b', vignette: 0.42, shade: '#120a2c', fs: 'flag', stone: 32, floor: ['#5b4c93', '#4d4084'],
        ws: 'bricks', wall: '#8676c6', wallF: '#403282', accent: '#d2b0ff',
        bush: ['#1d6556', '#2f8f78', '#62c8a2'], bx: 'flowers', bxc: ['#ff9ee0', '#ffffff'],
        water: 'water', wc: ['#27479f', '#3d67d6', '#b7c8ff'], bone: '#efe6ff', pad: '#e05cff',
        deco: [['crack', 3], ['pebble', 2], ['star', 1.2], ['candle', 0.7], ['bone', 0.5]], rate: 0.24,
        cobweb: true, win: 'gothic', glow: '#ffc85a',
    },
    factory: {
        void: '#131a2b', vignette: 0.38, shade: '#0b1224', fs: 'plate', floor: ['#4d6180', '#475a77'],
        ws: 'metal', wall: '#e5843a', wallF: '#a84e1c', accent: '#ffd23f', hazard: true, deepCol: '#8a2c06', deep: 0.4,
        bush: ['#23704c', '#379a60', '#76d388'], bx: 'none',
        water: 'water', wc: ['#0f7c9c', '#1eb2d4', '#bff7ff'], bone: '#d4dde9', pad: '#ffd23f',
        deco: [['bolt', 3], ['oil', 1.1], ['grate', 1], ['hazard', 0.8], ['arrow', 0.7]], rate: 0.22,
        win: 'porthole', glow: '#58e6ff',
    },
    slime: {
        void: '#0b1d2c', vignette: 0.38, shade: '#06202a', fs: 'blotch', floor: ['#2f6d7c', '#2b6674'],
        ws: 'jelly', wall: '#66d85e', wallF: '#2f9a48', accent: '#b6ff5a',
        bush: ['#1b6e52', '#2c9870', '#6ce0a6'], bx: 'none',
        water: 'goo', wc: ['#3aae34', '#86ee48', '#eaffc0'], bone: '#ecf7e2', pad: '#ff6fb5',
        deco: [['splat', 3], ['bubble', 2], ['pebble', 2]], rate: 0.3,
        win: 'tank', glow: '#9dff6a',
    },
    shadowcastle: {
        void: '#10051a', vignette: 0.45, shade: '#12031c', fs: 'flag', stone: 16, floor: ['#56284b', '#4d2344'],
        ws: 'bricks', wall: '#80448e', wallF: '#3f1a4e', accent: '#ff5d8f',
        bush: ['#551b3a', '#842b54', '#e0527f'], bx: 'flowers', bxc: ['#ff5d8f', '#ffc2d6'],
        water: 'potion', wc: ['#4f1aa6', '#8a3cff', '#e8c6ff'], bone: '#f4e6ee', pad: '#ff4d6d',
        deco: [['crack', 2], ['glowcrack', 1.2], ['pebble', 1.5], ['bone', 1], ['chain', 0.6]], rate: 0.24,
        win: 'redglass', glow: '#ff4d6d', dark: 0.5, darkCol: '#14031e',
    },
    mushroom: {
        void: '#0b231d', vignette: 0.38, shade: '#06221a', fs: 'blotch', floor: ['#3c7b5b', '#377355'],
        ws: 'foliage', caps: true, wall: '#2f9258', wallF: '#1d5c45', accent: '#ffe38a',
        bush: ['#1b6639', '#319c4f', '#7bdb6f'], bx: 'none',
        water: 'water', wc: ['#1c78b0', '#33a2d6', '#c4f0ff'], bone: '#f2f0e6', pad: '#ff5a6e',
        deco: [['mushroom', 3], ['clover', 2], ['leaf', 2], ['tuft', 2], ['flower', 1], ['glowshroom', 0.8]], rate: 0.34,
        flowers: ['#ffd84a', '#ff8fd0', '#ffffff'], win: 'mushlamp', glow: '#6ff0ff',
    },
    swamp: {
        void: '#0c201a', vignette: 0.4, shade: '#071e18', fs: 'blotch', floor: ['#3f6c55', '#3a654f'],
        ws: 'reeds', wall: '#6aa53e', wallF: '#3a6a2c', accent: '#d8ff6a', deepCol: '#1c5a1a',
        bush: ['#2c6629', '#4b8c33', '#9ccc4a'], bx: 'cattail', bxc: ['#c8743a'],
        water: 'water', wc: ['#1a5f58', '#2c8a78', '#aee8cc'], lily: true, bone: '#eef0dc', pad: '#6fcf4a',
        deco: [['puddle', 2], ['reed', 2], ['tuft', 2], ['lily', 0.8], ['frog', 0.25], ['firefly', 0.6]], rate: 0.3,
        win: 'firefly', glow: '#e8ff7a',
    },
    ice: {
        void: '#0c1f3a', vignette: 0.3, shade: '#1a3c6c', fs: 'snow', floor: ['#abcce6', '#a4c5e0'],
        ws: 'ice', wall: '#cdeefe', wallF: '#6cb2e2', accent: '#7fe8ff', arena: '#2f7fe0', deep: 0.4, deepCol: '#2f86e0',
        bush: ['#1b5a48', '#2b7a5d', '#e8f6ff'], bx: 'snow',
        water: 'water', wc: ['#1a58a8', '#2a7ccc', '#d4f0ff'], floes: true, bone: '#eef6ff', pad: '#4fb6ff',
        deco: [['sparkle', 3], ['icecrack', 2], ['snowmound', 2], ['pebble', 1], ['fish', 0.25]], rate: 0.3,
        win: 'crystal', glow: '#8ff0ff',
    },
    volcano: {
        void: '#1a070c', vignette: 0.42, shade: '#1c0509', fs: 'rock', floor: ['#5b2d3b', '#542937'],
        ws: 'rock', lava: true, wall: '#9a4049', wallF: '#581c2b', accent: '#ff8a2b',
        bush: ['#1b6636', '#2d8c48', '#78cf68'], bx: 'none',
        water: 'lava', wc: ['#d62f1a', '#ff7a1f', '#ffe066'], bone: '#f0e0d6', pad: '#ffb02e',
        deco: [['glowcrack', 2], ['obsidian', 2], ['pebble', 2], ['ember', 1], ['ash', 1]], rate: 0.3,
        win: 'lava', glow: '#ff7a2b',
    },
    shadow: {
        void: '#06031a', vignette: 0.45, shade: '#06031a', fs: 'flag', stone: 32, runes: true, floor: ['#4a3886', '#43327b'],
        ws: 'void', wall: '#2b1f5e', wallF: '#1a1242', accent: '#c08cff',
        bush: ['#381d70', '#5835a6', '#a07cff'], bx: 'glow', bxc: ['#7ff0ff'],
        water: 'void', wc: ['#0c0624', '#241052', '#b48cff'], bone: '#e6dcff', pad: '#b36bff',
        deco: [['rune', 1.5], ['crack', 2], ['star', 2], ['crystal', 1]], rate: 0.24,
        win: 'rune', glow: '#b98cff', dark: 0.45, darkCol: '#0a0420',
    },
    orchard: {
        void: '#1e391a', vignette: 0.3, shade: '#163214', fs: 'grass', stripes: 0, floor: ['#75a74b', '#6e9f46'],
        ws: 'foliage', fruits: true, wall: '#3f9c45', wallF: '#2a6a35', accent: '#ffcf3d',
        bush: ['#2a7530', '#46a53e', '#8fdc5a'], bx: 'berries', bxc: ['#ff4a5a', '#6a7cff'],
        water: 'water', wc: ['#2786d0', '#48aef0', '#d4f4ff'], lily: true, bone: '#f6f0de', pad: '#ff7ab8',
        deco: [['flower', 4], ['tuft', 3], ['apple', 1.2], ['clover', 2], ['butterfly', 0.35]], rate: 0.38,
        flowers: ['#ffffff', '#ffe14a', '#ff9ad0', '#b58cff'], win: 'crate',
    },
    pixel: {
        void: '#07082a', vignette: 0.4, shade: '#04051c', fs: 'grid', floor: ['#292c70', '#25286a'],
        ws: 'pixel', wall: '#3a62e6', wallF: '#283ca8', accent: '#4cf0ff',
        bush: ['#1a7a34', '#2fbf4f', '#8fff6a'], bx: 'pixel',
        water: 'pixel', wc: ['#1d48c8', '#2f7fff', '#a4e4ff'], bone: '#f0f0ff', pad: '#ff4fd0',
        deco: [['pixel', 3], ['coin', 0.6], ['heart', 0.35]], rate: 0.22,
        win: 'qblock', glow: '#ffd23f',
    },
    space: {
        void: '#070520', vignette: 0.45, shade: '#05031a', fs: 'flag', stone: 32, seams: true, floor: ['#363b7c', '#313674'],
        ws: 'rock', crystals: true, wall: '#7060b6', wallF: '#443689', accent: '#ffd23f',
        bush: ['#176262', '#27978a', '#7ff0d0'], bx: 'glow', bxc: ['#ff7ad8'],
        water: 'plasma', wc: ['#3a1a8a', '#7a4cff', '#ff9ae6'], bone: '#e8e0ff', pad: '#4cf0ff',
        deco: [['star', 3], ['sparkle', 2], ['crater', 1], ['crystal', 0.8]], rate: 0.26,
        win: 'planet', glow: '#8fd0ff',
    },
    bones: {
        void: '#2a120a', vignette: 0.35, shade: '#3c1508', fs: 'sand', floor: ['#c98a50', '#c3844c'],
        ws: 'strata', wall: '#e07b4c', wallF: '#a8492e', accent: '#ffe7b0', arena: '#ff4f3a', deepCol: '#8a2410', deep: 0.4,
        bush: ['#46733a', '#6a9a42', '#b0d070'], bx: 'none',
        water: 'water', wc: ['#1a86a0', '#2cb4c6', '#cbf7ff'], bone: '#fbf1dc', pad: '#4ab0c8',
        deco: [['bone', 3], ['cactus', 1.2], ['pebble', 2], ['crack', 1.5], ['skullsmall', 0.5]], rate: 0.26,
        win: 'fossil',
    },
    poison: {
        void: '#12071c', vignette: 0.42, shade: '#10041c', fs: 'blotch', floor: ['#4c3663', '#46315c'],
        ws: 'bramble', wall: '#7d4c9e', wallF: '#4a2a6b', accent: '#8cff4a',
        bush: ['#381c58', '#5a3a88', '#9270c6'], bx: 'glow', bxc: ['#8cff4a'],
        water: 'goo', wc: ['#358f18', '#78f23a', '#e2ffb4'], bone: '#eef6e0', pad: '#8cff4a',
        deco: [['puddle', 2], ['bubble', 1.5], ['mushroom', 1.5], ['crack', 1]], rate: 0.28,
        pud: '#7ae83a', win: 'crystal', glow: '#8cff4a',
    },
    stone: {
        void: '#161b2c', vignette: 0.38, shade: '#131a32', fs: 'flag', stone: 32, moss: true, floor: ['#6a74a8', '#636ca0'],
        ftints: ['#9a7ad0', '#6aa8d0', '#c8a878', '#6a74a8'],
        ws: 'blocks', wall: '#a2acd8', wallF: '#6a73a8', accent: '#8fe06a', tints: ['#d2a8f0', '#8fd0f0', '#f0d09a', '#a2acd8'], deepCol: '#262a78',
        bush: ['#27663a', '#3c8c4a', '#7fcf6a'], bx: 'none',
        water: 'water', wc: ['#2566b8', '#3b8ae0', '#cbe8ff'], bone: '#f0f0ea', pad: '#8fe06a',
        deco: [['moss', 3], ['pebble', 2], ['crack', 1.5], ['flower', 1]], rate: 0.28,
        flowers: ['#ffe14a', '#ffffff', '#ff9ad0'], win: 'stonelantern', glow: '#ffcf6b',
    },
    dojo: {
        void: '#10240f', vignette: 0.3, shade: '#2a2410', fs: 'tatami', floor: ['#c6bc75', '#bfb56f'],
        ws: 'bamboo', wall: '#72b64c', wallF: '#3f8036', accent: '#ff6b8a', deepCol: '#154a1a',
        bush: ['#c0417a', '#ff7fb0', '#ffd6e8'], bx: 'sakura',
        water: 'koi', wc: ['#1b67a8', '#3b9ade', '#d0f0ff'], bone: '#f6f0e0', pad: '#e03c3c',
        deco: [['petal', 3]], rate: 0.2,
        win: 'paperlantern', glow: '#ff9a5a',
    },
    dino: {
        void: '#0c2410', vignette: 0.35, shade: '#08200b', fs: 'blotch', floor: ['#43704b', '#3f6a47'],
        ws: 'jungle', wall: '#40a03c', wallF: '#246b2c', accent: '#ffd23f',
        bush: ['#1b6628', '#379a3a', '#8fdc5a'], bx: 'flowers', bxc: ['#ff7a3a', '#ffd23f'],
        water: 'water', wc: ['#128a84', '#26b4a6', '#c4fff2'], bone: '#f6ecd8', pad: '#ff7a3a',
        deco: [['fern', 3], ['footprint', 1], ['pebble', 2], ['flower', 1.5], ['tuft', 2]], rate: 0.32,
        flowers: ['#ff7a3a', '#ffd23f', '#ff4a7a'], win: 'egg',
    },
    chrono: {
        void: '#060e26', vignette: 0.42, shade: '#040a22', fs: 'flag', stone: 32, inlay: true, floor: ['#2e4380', '#2a3d78'],
        ws: 'brass', wall: '#dcab3e', wallF: '#9a6826', accent: '#6fe7ff', deepCol: '#8a4a06', deep: 0.4,
        bush: ['#1a5476', '#2b7aa0', '#7fdcff'], bx: 'glow', bxc: ['#ffd23f'],
        water: 'time', wc: ['#155fa8', '#36c2ee', '#dcfbff'], bone: '#f2eee0', pad: '#ffd23f',
        deco: [['gear', 2], ['star', 1], ['clockmark', 1]], rate: 0.22,
        win: 'clock', glow: '#6fe7ff',
    },
    shadowswamp: {
        void: '#040f0c', vignette: 0.45, shade: '#020c09', fs: 'blotch', floor: ['#356558', '#305d51'],
        ws: 'darktree', wall: '#255244', wallF: '#142e27', accent: '#77f08d',
        bush: ['#143529', '#225843', '#4fb87a'], bx: 'glow', bxc: ['#9dff8a'],
        water: 'water', wc: ['#0e2c30', '#194848', '#80f0c2'], bone: '#e0f0e6', pad: '#77f08d',
        deco: [['puddle', 2], ['glowshroom', 1], ['reed', 1.5], ['firefly', 0.8]], rate: 0.28,
        pud: '#16333a', win: 'wisp', glow: '#77f08d', dark: 0.45, darkCol: '#03120d',
    },
    football: {
        void: '#141a2e', vignette: 0.3, shade: '#0c2a12', fs: 'grass', stripes: 2, floor: ['#4f9f45', '#47923e'],
        ws: 'stands', wall: '#2d4180', wallF: '#1c2a5a', accent: '#ffffff', lines: 'pitch', deepCol: '#0e1638',
        bush: ['#23702f', '#3a9a3a', '#7ad65c'], bx: 'none',
        water: 'water', wc: ['#1d68c8', '#3a98ee', '#c4ecff'], bone: '#f5eedc', pad: '#ffb020',
        deco: [['tuft', 3]], rate: 0.12,
        win: 'flood', glow: '#fff6c8',
    },
    scrap: {
        void: '#16131f', vignette: 0.38, shade: '#3a2208', fs: 'sand', floor: ['#c4975b', '#bd9156'],
        ws: 'cubes', wall: '#e0453c', wallF: '#9a2a24', accent: '#ffc46b', arena: '#3c6ae0', deepCol: '#161848', deep: 0.28,
        cars: ['#e0453c', '#3c7ae0', '#f0c63c', '#3cb86a', '#e6e8f0', '#ff8a3c', '#9a5ae0', '#3cc8d8'],
        bush: ['#2c6630', '#46963d', '#8fcf5a'], bx: 'none',
        water: 'oil', wc: ['#182838', '#27485a', '#9ae0ff'], bone: '#d8dee8', pad: '#3a3a4a',
        deco: [['bolt', 3], ['tire', 0.8], ['can', 1], ['spring', 1], ['oil', 1], ['cap', 1.5]], rate: 0.3,
        win: 'tv', glow: '#8fe8ff',
    },
    // Welt 22: Schule bei Nacht – Linoleum-Flur, Backstein mit Spinden, Schleim, Turnhalle als Boss-Arena.
    // edge = Streifen entlang der Wände, lockers = Spindfarben, sk = Aussehen der Schädel-Kachel, poolGlow = Leuchten der Becken
    zombie: {
        void: '#0d0a1f', vignette: 0.42, shade: '#0e0826', fs: 'lino', floor: ['#675d98', '#5c528c'], edge: '#8ee86a',
        ws: 'school', wall: '#704a6c', wallF: '#3b2d5e', accent: '#8ee86a', tints: ['#9a4a5a', '#5a4a9a', '#8a6a4a'],
        lockers: ['#3f9a8f', '#d6a93c', '#c9524f', '#4f73c8', '#9a62c8'], arena: '#8ee86a', arenaStyle: 'gym', deepCol: '#1a1030', deep: 0.45,
        bush: ['#23413f', '#355f55', '#6a9a78'], bx: 'eyes', bxc: ['#d8ff6a'],
        water: 'goo', wc: ['#2a6e2a', '#4cb838', '#a8f070'], poolGlow: [17, 0.15], bone: '#efeaf6', pad: '#3f78e0',
        deco: [['paper', 2.4], ['pencil', 1.4], ['book', 1.4], ['chalk', 0.8], ['slime', 0.9], ['sneaker', 0.4], ['tomb', 0.45], ['apple', 0.3]], rate: 0.22,
        sk: 'desk', win: 'school', glow: '#fff1a8', dark: 0.4, darkCol: '#0b0620',
    },
    // Welt 23: bunte Blumenwiese – Riesenblumen als Wände, Teich mit Seerosen, Blumenring als Boss-Arena.
    // blossoms = Blütchen im Gras, petals = Farben der Riesenblüten
    butterfly: {
        void: '#173a26', vignette: 0.22, shade: '#1a4a26', fs: 'grass', stripes: 0, floor: ['#5fb257', '#5aa952'],
        blossoms: ['#ffffff', '#ffb3e0', '#c9a8ff', '#9ad8ff'],
        ws: 'blooms', wall: '#3f9a4a', wallF: '#317a41', accent: '#ff8ad8', arena: '#ff8ad8', arenaStyle: 'meadow', deepCol: '#1b4a30', deep: 0.4,
        petals: ['#ff8ad8', '#ffb3e0', '#c9a8ff', '#ffe066', '#ffffff', '#8ad8ff', '#ffa07a'],
        bush: ['#2a7a3e', '#43a553', '#8fdc6a'], bx: 'flowers', bxc: ['#ff8ad8', '#ffe14a', '#ffffff', '#c9a8ff'],
        water: 'water', wc: ['#2a86c8', '#4cb2ec', '#dcf6ff'], lily: true, bone: '#fff6e8', pad: '#ff6fb5',
        deco: [['flower', 5], ['tuft', 3], ['clover', 2], ['daisy', 1.2], ['butterfly', 0.6], ['mushroom', 0.5], ['pebble', 0.6], ['ladybug', 0.35]], rate: 0.38,
        flowers: ['#ffffff', '#ffe14a', '#ff9ad0', '#c9a8ff', '#8ad8ff', '#ff8a6a'], sk: 'bloom', win: 'rainbow', glow: '#fff0c8',
    },
    // Welt 24: Drachenhort im Berg. zones = Element-Zonen (dragonZone: 0 Gold, 1 Feuer, 2 Eis, 3 Kristall),
    // zdeco = zusätzliche Deko je Zone, eggs = Dracheneier [Schale, Tupfen] in den Farben der Drachenkinder
    dragon: {
        void: '#140912', vignette: 0.4, shade: '#1a0914', fs: 'cave', floor: ['#5c3a4a', '#573646'], zones: true,
        ws: 'basalt', wall: '#57508a', wallF: '#322c58', accent: '#ff8a3d', arena: '#ffb03a', arenaStyle: 'nest', deepCol: '#120c2a', deep: 0.42,
        bush: ['#9a5c12', '#e3a52c', '#ffe27a'], bx: 'gold',
        water: 'lava', wc: ['#c42a1a', '#ff6a1f', '#ffd24a'], poolGlow: [22, 0.2], bone: '#f4ead8', pad: '#5a5486',
        eggs: [['#ff9e8e', '#d8403a'], ['#aee2ff', '#3a86d8'], ['#dab6ff', '#8a4ad8']],
        deco: [['gold', 3], ['gem', 1.3], ['scale', 1.2], ['pebble', 1.4], ['helmet', 0.22], ['shield', 0.22]], rate: 0.26,
        zdeco: [[['gold', 2]], [['glowcrack', 2.2], ['ember', 1.2], ['obsidian', 1]], [['frost', 2.6], ['icecrack', 1.2], ['snowmound', 0.5]], [['shard', 2.8]]],
        sk: 'nest', win: 'cave', glow: '#ffb86a', dark: 0.3, darkCol: '#12081c',
    },
    // Welt 25–30 (Gerüst aus vorhandenen Stilen, wird später verfeinert)
    // Welt 25: Wald bei Vollmond, dunkle Bäume, Nebelpfützen
    werewolf: {
        void: '#050914', vignette: 0.45, shade: '#030714', fs: 'blotch', floor: ['#2f4a52', '#2b444c'],
        ws: 'darktree', wall: '#22403c', wallF: '#122624', accent: '#ff4a4a',
        bush: ['#12302c', '#1e4a40', '#4a8a72'], bx: 'eyes', bxc: ['#ff3b3b'],
        water: 'water', wc: ['#0e2238', '#1a3a5a', '#bcd8ff'], bone: '#e6ecf2', pad: '#ff4a4a',
        deco: [['puddle', 1.5], ['tuft', 2], ['bone', 0.8], ['footprint', 1.2], ['firefly', 0.5], ['glowshroom', 0.5]], rate: 0.26,
        pud: '#1a2c44', win: 'wisp', glow: '#dfe8ff', dark: 0.5, darkCol: '#030616',
    },
    // Welt 26: Festung über den Wolken, weißer Stein mit Gold
    angel: {
        void: '#7fb4ec', vignette: 0.2, shade: '#5a7ab8', fs: 'flag', stone: 32, floor: ['#e8eaf6', '#dfe2f2'],
        ws: 'blocks', wall: '#fbf6e8', wallF: '#c8b27a', accent: '#ffd66b', tints: ['#fff2c8', '#e8eeff', '#ffe8f0', '#fbf6e8'], deepCol: '#4a78c8',
        bush: ['#e8f0ff', '#ffffff', '#ffe9a8'], bx: 'glow', bxc: ['#ffd66b'],
        water: 'water', wc: ['#6aa8f0', '#a4d0ff', '#ffffff'], bone: '#fffaf0', pad: '#ffd66b',
        deco: [['sparkle', 3], ['star', 1.5], ['crack', 0.8], ['flower', 0.8]], rate: 0.24,
        flowers: ['#ffffff', '#ffe14a', '#ffd0ea'], win: 'gothic', glow: '#fff1a8',
    },
    // Welt 27: Grabkammern in der Pyramide, Sandstein und Knochen
    mummy: {
        void: '#1e1206', vignette: 0.42, shade: '#2c1806', fs: 'sand', floor: ['#c9a466', '#c29d60'],
        ws: 'strata', wall: '#d8b06a', wallF: '#93682e', accent: '#e8c27a', arena: '#3ab0c8', deepCol: '#5a3008', deep: 0.4,
        bush: ['#6a7a3a', '#8a9a48', '#c0c870'], bx: 'none',
        water: 'water', wc: ['#1a7a90', '#2aa6b8', '#cbf3ff'], bone: '#fbf1dc', pad: '#3ab0c8',
        deco: [['bone', 2], ['skullsmall', 0.6], ['crack', 2], ['pebble', 2], ['cactus', 0.4]], rate: 0.26,
        win: 'fossil', glow: '#ffcf6b', dark: 0.3, darkCol: '#1a0e04',
    },
    // Welt 28: Schmiede im Vulkan, Metallwände und Glut
    firepig: {
        void: '#1a0806', vignette: 0.42, shade: '#1c0604', fs: 'rock', floor: ['#5a3430', '#53302c'],
        ws: 'metal', lava: true, wall: '#7a5a52', wallF: '#3e2622', accent: '#ff6b2e', hazard: true, deepCol: '#8a2006', deep: 0.4,
        bush: ['#5a2a1a', '#8a3a1a', '#ff7a2b'], bx: 'glow', bxc: ['#ffb02e'],
        water: 'lava', wc: ['#d62f1a', '#ff7a1f', '#ffe066'], poolGlow: [20, 0.18], bone: '#f0e0d6', pad: '#ffb02e',
        deco: [['glowcrack', 2], ['ember', 1.5], ['bolt', 1.5], ['obsidian', 1], ['ash', 1]], rate: 0.28,
        win: 'lava', glow: '#ff7a2b',
    },
    // Welt 29: dunkle Gewitterwolken mit Kristallen
    thunder: {
        void: '#0a0c1e', vignette: 0.42, shade: '#080a1c', fs: 'flag', stone: 32, seams: true, floor: ['#3a4064', '#353a5c'],
        ws: 'rock', crystals: true, wall: '#5c6488', wallF: '#30365a', accent: '#ffe74a',
        bush: ['#2a3058', '#3e4880', '#9aa8ff'], bx: 'glow', bxc: ['#ffe74a'],
        water: 'plasma', wc: ['#1a2a8a', '#4c7aff', '#fff6a0'], bone: '#eef0ff', pad: '#ffe74a',
        deco: [['sparkle', 2.5], ['crack', 1.5], ['crater', 0.8], ['crystal', 0.8]], rate: 0.24,
        win: 'crystal', glow: '#fff3a0', dark: 0.35, darkCol: '#060818',
    },
    // Welt 30: Hexenwald mit Dornen, Zaubertrank-Teichen und Pilzen
    witch: {
        void: '#0c0614', vignette: 0.45, shade: '#0a0414', fs: 'blotch', floor: ['#56447a', '#504072'],
        ws: 'bramble', wall: '#5a3a7a', wallF: '#2e1a46', accent: '#b884ff',
        bush: ['#2a1a48', '#4a2a7a', '#b884ff'], bx: 'glow', bxc: ['#7fffd0'],
        water: 'potion', wc: ['#4f1aa6', '#8a3cff', '#e8c6ff'], bone: '#f0e6ff', pad: '#7fffd0',
        deco: [['mushroom', 1.5], ['glowshroom', 1.2], ['candle', 0.7], ['rune', 0.8], ['bone', 0.5], ['crack', 1]], rate: 0.28,
        win: 'rune', glow: '#b884ff', dark: 0.28, darkCol: '#0a0418',
    },
};

// Welt 24: Die drei Elemente des Drachenvaters (und Gold dazwischen) liegen als Zonen über der Karte:
// Voronoi-Felder aus festen, zufällig versetzten Keimen (etwa 9 Kacheln groß). Kachelkoordinaten, auch gebrochen.
// Ergebnis: 0 = Gold, 1 = Feuer, 2 = Eis, 3 = Kristall. Wird von Grafik und Kartenbau gemeinsam benutzt.
function dragonZone(tx, ty) {
    const cell = 9, gx = Math.floor(tx / cell), gy = Math.floor(ty / cell);
    let best = Infinity, zone = 0;
    for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
            const cx = gx + i, cy = gy + j;
            const sx = (cx + 0.15 + wHash(cx, cy, 2401) * 0.7) * cell, sy = (cy + 0.15 + wHash(cy, cx, 2403) * 0.7) * cell;
            const d = (sx - tx) * (sx - tx) + (sy - ty) * (sy - ty);
            if (d < best) {
                best = d;
                zone = Math.floor(wHash(cx, cy, 2405) * 4);
            }
        }
    }
    return zone;
}

class World {
    constructor() {
        this.tiles = [];
        this.width = 0;
        this.height = 0;
        this.pixelWidth = 0;
        this.pixelHeight = 0;
        this.spawnPoint = { x: 0, y: 0 };
        this.bossSpawn = { x: 0, y: 0 };
        this.bossDoorTiles = [];
        this.bossDoorOpen = false;
        this.enemySpawns = [];
        this.chestPositions = [];
        this.theme = 'castle'; // Schlüssel in WORLD_THEMES, wird vor load() gesetzt
        this.worldNum = 0;
        this.palette = WORLD_THEMES.castle;
        this._blocks = new Map(); // vorgerenderte Blöcke (Schlüssel = Blocknummer)
        this._frameNo = 0;
    }

    load(levelData) {
        // Kopie, damit Änderungen (Startfeld, Boss-Tür) die Vorlage nicht zerstören –
        // sonst startet Mark beim zweiten Spielen in der Wand und die Boss-Tür fehlt.
        this.tiles = levelData.map(row => row.slice());
        this.height = levelData.length;
        this.width = levelData[0].length;
        this.pixelWidth = this.width * TILE_SIZE;
        this.pixelHeight = this.height * TILE_SIZE;
        this.bossDoorTiles = [];
        this.enemySpawns = [];
        this.chestPositions = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = this.tiles[y][x];
                if (t === TILE_SPAWN) {
                    this.spawnPoint = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
                    this.tiles[y][x] = TILE_FLOOR;
                }
                if (t === TILE_BOSS_SPAWN) {
                    this.bossSpawn = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
                    this.tiles[y][x] = TILE_FLOOR;
                }
                if (t === TILE_BOSS_DOOR) {
                    this.bossDoorTiles.push({ x, y });
                }
            }
        }
        // Darstellung: Palette des Themas, Zwischenspeicher leeren
        this.palette = WORLD_THEMES[this.theme] || WORLD_THEMES.castle;
        this.invalidateCache();
    }

    openBossDoor() {
        this.bossDoorOpen = true;
        for (const pos of this.bossDoorTiles) {
            this.setTile(pos.x, pos.y, TILE_DOOR);
        }
    }

    // Kachel ändern (z. B. Boss-Tür). Immer diese Methode benutzen, damit vorgerenderte Bereiche neu gezeichnet werden.
    setTile(x, y, type) {
        if (y < 0 || x < 0 || y >= this.height || x >= this.width) return;
        this.tiles[y][x] = type;
        this.invalidateCache(x, y);
    }

    // Vorgerenderte Bereiche verwerfen (ohne Koordinaten: alles). Wird auch bei Größenänderung aufgerufen.
    invalidateCache(x, y) {
        if (!this._blocks) return;
        if (x === undefined) {
            for (const key of [...this._blocks.keys()]) this._drop(key);
            return;
        }
        // Nachbarn zeichnen Schatten, Kanten und Wandtiefe abhängig von dieser Kachel (bis 3 Kacheln weit)
        const nbx = Math.ceil(this.width / WORLD_BLOCK);
        for (let dy = -3; dy <= 3; dy += 3) {
            for (let dx = -3; dx <= 3; dx += 3) {
                const tx = clamp(x + dx, 0, this.width - 1), ty = clamp(y + dy, 0, this.height - 1);
                this._drop(Math.floor(ty / WORLD_BLOCK) * nbx + Math.floor(tx / WORLD_BLOCK));
            }
        }
    }

    isWall(px, py) {
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
        return isSolidTile(this.tiles[ty][tx]);
    }

    isBush(px, py) {
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
        return this.tiles[ty][tx] === TILE_BUSH;
    }

    isJumpPad(px, py) {
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
        return this.tiles[ty][tx] === TILE_JUMP_PAD;
    }

    collideRect(rect) {
        // Check all tiles the rect overlaps
        // Gleiche Kantenregel wie rectOverlap: auch Überlappungen unter 1 Einheit zählen
        // (sonst „rutschten“ Figuren nach rechts/unten in Wände und sprangen dann zurück).
        const left = Math.floor(rect.x / TILE_SIZE);
        const top = Math.floor(rect.y / TILE_SIZE);
        const right = Math.ceil((rect.x + rect.w) / TILE_SIZE) - 1;
        const bottom = Math.ceil((rect.y + rect.h) / TILE_SIZE) - 1;

        const collisions = [];
        for (let ty = top; ty <= bottom; ty++) {
            for (let tx = left; tx <= right; tx++) {
                if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) {
                    collisions.push({ x: tx * TILE_SIZE, y: ty * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
                    continue;
                }
                if (isSolidTile(this.tiles[ty][tx])) {
                    collisions.push({ x: tx * TILE_SIZE, y: ty * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
                }
            }
        }
        return collisions;
    }

    // Kein Farbzyklus mehr (flimmerte und verhinderte das Vorrendern). Animationen laufen über Art.time.
    update(dt) {}

    // ── Zeichnen ──
    // Statisches wird blockweise (WORLD_BLOCK² Kacheln) in eigene Leinwände vorgerendert und nur noch kopiert.
    // Pro Bild kommen nur Animationen sichtbarer Kacheln dazu (Wasser, Sprungfelder, Tür, Leuchten).

    _tileAt(x, y) {
        return (x < 0 || y < 0 || x >= this.width || y >= this.height) ? TILE_WALL : this.tiles[y][x];
    }

    // Erhöhte Kacheln (Wand-Block mit Oberseite und Vorderseite)
    _raised(x, y) {
        const t = this._tileAt(x, y);
        return t === TILE_WALL || t === TILE_WINDOW || t === TILE_BOSS_DOOR;
    }

    _hasArena() {
        return this.bossDoorTiles.length > 0 && this.width > 16 && this.height > 14;
    }

    draw(ctx, camera) {
        if (!this.width) return;
        const rs = (typeof Game !== 'undefined' && Game.renderScale) || 1;
        const BW = WORLD_BLOCK * TILE_SIZE;
        const nbx = Math.ceil(this.width / WORLD_BLOCK);
        const nby = Math.ceil(this.height / WORLD_BLOCK);
        const vx = camera.x - (camera.shakeX || 0), vy = camera.y - (camera.shakeY || 0);
        const bx0 = Math.max(0, Math.floor(vx / BW)), by0 = Math.max(0, Math.floor(vy / BW));
        const bx1 = Math.min(nbx - 1, Math.floor((vx + camera.width) / BW));
        const by1 = Math.min(nby - 1, Math.floor((vy + camera.height) / BW));
        const frame = ++this._frameNo;
        let rendered = 0;
        const vis = this._visBlocks || (this._visBlocks = []);
        vis.length = 0;
        for (let by = by0; by <= by1; by++) {
            for (let bx = bx0; bx <= bx1; bx++) {
                const key = by * nbx + bx;
                let b = this._blocks.get(key);
                if (!b || b.scale !== rs) {
                    this._drop(key);
                    b = this._renderBlock(bx, by, rs);
                    rendered++;
                }
                b.used = frame;
                vis.push(b);
                const p = camera.worldToScreen(bx * BW, by * BW);
                ctx.drawImage(b.canvas, Math.round(p.x * rs) / rs, Math.round(p.y * rs) / rs,
                    b.canvas.width / rs, b.canvas.height / rs);
            }
        }
        this._drawAnims(ctx, camera, vis);
        // Einen Nachbarblock im Voraus rendern (zuerst in Laufrichtung), damit beim Laufen nichts ruckelt
        const mvx = this._lastVx === undefined ? 0 : vx - this._lastVx, mvy = this._lastVy === undefined ? 0 : vy - this._lastVy;
        this._lastVx = vx;
        this._lastVy = vy;
        if (!rendered) {
            const ax = vx + camera.width / 2 + clamp(mvx * 45, -BW, BW), ay = vy + camera.height / 2 + clamp(mvy * 45, -BW, BW);
            this._prefetch(bx0 - 1, by0 - 1, bx1 + 1, by1 + 1, nbx, nby, rs, frame, ax, ay);
        }
        // Sichtbare Blöcke plus ein Ring zum Vorrendern bleiben, der Rest wird freigegeben (Speicher)
        const keep = Math.max(16, (bx1 - bx0 + 3) * (by1 - by0 + 3) + 2);
        if (this._blocks.size > keep) this._evict(keep, frame);
    }

    // Block freigeben; wenige Leinwände werden zur Wiederverwendung aufgehoben
    _drop(key) {
        const b = this._blocks.get(key);
        if (!b) return;
        if (W_POOL.length < 6) W_POOL.push(b.canvas);
        this._blocks.delete(key);
    }

    // Fehlenden Block im Ring um die Sicht rendern, der dem Vorausschau-Punkt (lx, ly) am nächsten liegt
    _prefetch(ax0, ay0, ax1, ay1, nbx, nby, rs, frame, lx, ly) {
        const BW = WORLD_BLOCK * TILE_SIZE;
        let best = -1, bestD = Infinity, bbx = 0, bby = 0;
        for (let by = Math.max(0, ay0); by <= Math.min(nby - 1, ay1); by++) {
            for (let bx = Math.max(0, ax0); bx <= Math.min(nbx - 1, ax1); bx++) {
                const b = this._blocks.get(by * nbx + bx);
                if (b && b.scale === rs) continue;
                const dx = (bx + 0.5) * BW - lx, dy = (by + 0.5) * BW - ly;
                const d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; best = by * nbx + bx; bbx = bx; bby = by; }
            }
        }
        if (best < 0) return;
        this._drop(best);
        this._renderBlock(bbx, bby, rs).used = frame - 1;
    }

    // Am längsten ungenutzte Blöcke freigeben
    _evict(keep, frame) {
        while (this._blocks.size > keep) {
            let oldKey = -1, oldUsed = Infinity;
            for (const [k, b] of this._blocks) {
                if (b.used < oldUsed && b.used < frame - 1) { oldUsed = b.used; oldKey = k; }
            }
            if (oldKey < 0) return;
            this._drop(oldKey);
        }
    }

    _renderBlock(bx, by, rs) {
        const T = TILE_SIZE;
        // Inhalt auf ganze Pixel strecken: bei krummen Maßstäben (z. B. 2,04) wäre die letzte Pixelspalte
        // sonst nur teilweise bemalt und mit dem Hintergrund gemischt -> feine Linien alle 6 Kacheln.
        // Die Streckung ist kleiner als ein Pixel pro Block und nicht zu sehen.
        const px = Math.ceil(WORLD_BLOCK * T * rs);
        const sc = px / (WORLD_BLOCK * T);
        const size = px + 1;
        const canvas = W_POOL.pop() || document.createElement('canvas');
        if (canvas.width !== size || canvas.height !== size) {
            canvas.width = size;
            canvas.height = size;
        }
        const c = canvas.getContext('2d');
        c.clearRect(0, 0, size, size);
        const x0 = bx * WORLD_BLOCK, y0 = by * WORLD_BLOCK;
        const x1 = Math.min(this.width, x0 + WORLD_BLOCK), y1 = Math.min(this.height, y0 + WORLD_BLOCK);
        const b = { canvas, scale: rs, used: this._frameNo, anim: [] };
        c.save();
        c.scale(sc, sc);
        c.translate(-x0 * T, -y0 * T);
        try {
            WorldPaint.block(this, c, b, x0, y0, x1, y1);
        } catch (err) {
            if (!World._paintErr) { World._paintErr = true; console.error('Welt-Zeichenfehler:', err); }
        }
        c.restore();
        this._blocks.set(by * Math.ceil(this.width / WORLD_BLOCK) + bx, b);
        return b;
    }

    // Animierte Teile der sichtbaren Blöcke (Welt-Einheiten, über den Blöcken)
    _drawAnims(ctx, camera, vis) {
        const x0 = camera.x - 40, y0 = camera.y - 40;
        const x1 = camera.x + camera.width + 40, y1 = camera.y + camera.height + 40;
        for (const b of vis) {
            for (const a of b.anim) {
                if (a.px < x0 || a.py < y0 || a.px > x1 || a.py > y1) continue;
                WorldPaint.anim(this, ctx, camera, a);
            }
        }
        if (this._hasArena()) WorldPaint.arenaAnim(this, ctx, camera);
    }

    // Vordergrund (nach den Figuren): Ladering des Sprungfelds, auf dem Mark gerade steht
    drawOverlay(ctx, camera) {
        if (typeof Game === 'undefined' || !Game.player) return;
        const pl = Game.player;
        if (pl.dead || !(pl.jumpPadStandTimer > 0)) return;
        const tx = Math.floor((pl.x + pl.w / 2) / TILE_SIZE), ty = Math.floor((pl.y + pl.h / 2) / TILE_SIZE);
        if (this._tileAt(tx, ty) !== TILE_JUMP_PAD) return;
        WorldPaint.padRing(ctx, camera, tx, ty, clamp(pl.jumpPadStandTimer / 5, 0, 1));
    }

    // Dunkle Welten: sanfte Abdunklung mit Lichtkreis um Mark, danach leuchtende Lichtquellen.
    drawLighting(ctx, camera, viewW, viewH) {
        const P = this.palette;
        if (!P || !P.dark || typeof Game === 'undefined' || !Game.player) return;
        const key = Math.round(viewW) + 'x' + Math.round(viewH) + P.darkCol + P.dark;
        if (this._lightKey !== key) {
            this._lightKey = key;
            this._lightImg = WorldPaint.lightSprite(viewW, viewH, P.darkCol, P.dark);
        }
        const pl = Game.player;
        const p = camera.worldToScreen(pl.x + pl.w / 2, pl.y + pl.h / 2);
        ctx.drawImage(this._lightImg, p.x - viewW, p.y - viewH, viewW * 2, viewH * 2);
        // Lichtquellen scheinen durch die Dunkelheit
        if (this._visBlocks) {
            for (const b of this._visBlocks) {
                for (const a of b.anim) {
                    if (a.k !== 'glow' || !a.light || a.r < 14) continue; // nur größere Lichtquellen
                    const q = camera.worldToScreen(a.px, a.py);
                    if (q.x < -60 || q.y < -60 || q.x > viewW + 60 || q.y > viewH + 60) continue;
                    Art.glow(ctx, q.x, q.y, a.r * 1.6, a.col, 0.28 + 0.06 * Math.sin(Art.time * 3 + a.ph));
                }
            }
        }
    }
}

// ══ WorldPaint: zeichnet Blöcke (einmalig) und Animationen (pro Bild) ══
// Koordinaten immer in Welt-Einheiten (Kachel = 32). Licht kommt von oben links.

const WorldPaint = {
    block(w, c, b, x0, y0, x1, y1) {
        const P = w.palette, T = TILE_SIZE;
        const seed = (w.worldNum | 0) * 7919 + 17;
        // Grundfläche: verhindert durchscheinende Haarlinien zwischen Kacheln (Kantenglättung)
        c.fillStyle = P.floor[0];
        c.fillRect(x0 * T, y0 * T, (x1 - x0) * T, (y1 - y0) * T);
        this._margin(w, c, P, x0, y0, x1, y1, seed);
        // A: Bodenfarbe (auch unter Wänden mit runden Ecken)
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                if (w._raised(x, y) && (w._raised(x, y - 1) || (w._raised(x - 1, y) && w._raised(x + 1, y)))) continue;
                c.fillStyle = this.floorColor(P, x, y, seed);
                c.fillRect(x * T, y * T, T, T);
            }
        }
        // B: Bodentextur (nur auf Bodenflächen)
        c.save();
        c.beginPath();
        let any = false;
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                if (w._raised(x, y)) continue;
                c.rect(x * T, y * T, T, T);
                any = true;
            }
        }
        if (any) {
            c.clip();
            this.floorTex(w, c, P, x0, y0, x1, y1, seed);
        }
        c.restore();
        // C: große Muster (Spielfeldlinien, Arena, Teppich vor der Boss-Tür)
        this.patterns(w, c, P, x0, y0, x1, y1, seed);
        // D: Wasser
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) if (w.tiles[y][x] === TILE_WATER) this.water(w, c, P, b, x, y, seed);
        }
        // E/F: Deko, Objekte, Schatten an Wänden
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const t = w.tiles[y][x];
                if (t === TILE_FLOOR) this.deco(w, c, P, b, x, y, seed);
                else if (t === TILE_BUSH) this.bush(w, c, P, x, y, seed);
                else if (t === TILE_SKULL) this.skull(w, c, P, x, y, seed);
                else if (t === TILE_JUMP_PAD) this.pad(w, c, P, b, x, y);
                else if (t === TILE_DOOR) this.openDoor(w, c, P, b, x, y);
            }
        }
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) if (!w._raised(x, y)) this.ao(w, c, P, x, y);
        }
        // H: Wände (Oberseite, Vorderseite, Kanten, Fenster, Boss-Tür)
        this.walls(w, c, P, b, x0, y0, x1, y1, seed);
    },

    // 1 Pixel Überstand rechts/unten mit ungefährer Farbe füllen (verhindert Nähte zwischen Blöcken)
    _margin(w, c, P, x0, y0, x1, y1, seed) {
        const T = TILE_SIZE;
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                if (x < x1 && y < y1) continue;
                if (x >= w.width || y >= w.height) continue;
                c.fillStyle = w._raised(x, y) ? (w._raised(x, y + 1) ? P.wall : P.wallF) : this.floorColor(P, x, y, seed);
                c.fillRect(x * T, y * T, x < x1 ? T : 3, y < y1 ? T : 3);
            }
        }
    },

    floorColor(P, x, y, seed) {
        // Natürliche Böden ohne Kachelraster (sonst sieht man Quadrate), gebaute Böden im Schachbrett
        const fs = P.fs;
        if (fs === 'blotch' || fs === 'sand' || fs === 'snow' || fs === 'rock' || fs === 'cave') return P.floor[0];
        if (fs === 'grass') return P.stripes ? P.floor[Math.floor(x / P.stripes) & 1] : P.floor[0];
        const base = P.floor[(x + y) & 1];
        const j = wHash(x, y, seed + 1) - 0.5;
        return j > 0 ? wcLight(base, j * 0.08) : wcDark(base, -j * 0.08);
    },

    // ── Bodentexturen (Clip = Bodenfläche des Blocks) ──
    floorTex(w, c, P, x0, y0, x1, y1, seed) {
        const T = TILE_SIZE;
        const X = x0 * T, Y = y0 * T, W = (x1 - x0) * T, H = (y1 - y0) * T;
        const f = P.floor[0];
        switch (P.fs) {
            case 'grass': {
                if (P.stripes === 0) {
                    // Sonnenflecken statt Mähstreifen
                    c.fillStyle = wcA(wcLight(f, 0.3), 0.16);
                    c.beginPath();
                    wScatter(X, Y, W, H, 30, 22, seed + 29, (px, py, r) => { c.moveTo(px + 12 + r * 10, py); c.ellipse(px, py, 12 + r * 10, 8 + r * 6, r * 2, 0, W_TAU); });
                    c.fill();
                    c.fillStyle = wcA(wcDark(f, 0.25), 0.14);
                    c.beginPath();
                    wScatter(X, Y, W, H, 34, 20, seed + 27, (px, py, r) => { c.moveTo(px + 10 + r * 8, py); c.ellipse(px, py, 10 + r * 8, 7 + r * 5, r * 2, 0, W_TAU); });
                    c.fill();
                }
                const lt = wcA(wcLight(f, 0.35), 0.5), dk = wcA(wcDark(f, 0.3), 0.45);
                c.lineWidth = 1.1;
                c.lineCap = 'round';
                for (const col of [dk, lt]) {
                    c.strokeStyle = col;
                    c.beginPath();
                    wScatter(X, Y, W, H, 6, 2, seed + (col === lt ? 31 : 37), (px, py, r) => {
                        if (r > 0.5) return;
                        const d = (r - 0.25) * 8;
                        c.moveTo(px, py);
                        c.lineTo(px + d, py - 3 - r * 3);
                    });
                    c.stroke();
                }
                if (P.blossoms) this._blossomField(w, c, P, X, Y, W, H, seed);
                break;
            }
            case 'lino': this._lino(c, P, X, Y, W, H, seed); break;
            case 'cave': this._caveFloor(w, c, P, X, Y, W, H, seed); break;
            case 'flag': this._flagstones(c, P, X, Y, W, H, seed); break;
            case 'plate': this._plates(c, P, X, Y, W, H, seed); break;
            case 'sand': {
                c.strokeStyle = wcA(wcLight(f, 0.3), 0.35);
                c.lineWidth = 1.3;
                c.beginPath();
                for (let ry = Math.floor(Y / 13) - 1; ry <= Math.ceil((Y + H) / 13) + 1; ry++) {
                    for (let px = X - 8; px <= X + W + 8; px += 6) {
                        const py = ry * 13 + 3 * Math.sin(px * 0.06 + ry * 1.7) + 2 * Math.sin(px * 0.021 + ry);
                        if (px === X - 8) c.moveTo(px, py); else c.lineTo(px, py);
                    }
                }
                c.stroke();
                this._specks(c, X, Y, W, H, 8, seed + 5, wcA(wcDark(f, 0.35), 0.4), wcA(wcLight(f, 0.4), 0.45));
                break;
            }
            case 'snow': {
                c.fillStyle = wcA('#ffffff', 0.22);
                c.beginPath();
                wScatter(X, Y, W, H, 22, 14, seed + 11, (px, py, r) => {
                    c.moveTo(px + 6 + r * 7, py);
                    c.ellipse(px, py, 6 + r * 7, 4 + r * 4, 0, 0, W_TAU);
                });
                c.fill();
                c.fillStyle = wcA('#ffffff', 0.85);
                c.beginPath();
                wScatter(X, Y, W, H, 11, 2, seed + 12, (px, py, r) => {
                    if (r > 0.22) return;
                    const s = 1.2 + r * 5;
                    c.moveTo(px, py - s); c.lineTo(px + 0.5, py - 0.5); c.lineTo(px + s, py); c.lineTo(px + 0.5, py + 0.5);
                    c.lineTo(px, py + s); c.lineTo(px - 0.5, py + 0.5); c.lineTo(px - s, py); c.lineTo(px - 0.5, py - 0.5);
                    c.closePath();
                });
                c.fill();
                break;
            }
            case 'tatami': this._tatami(c, P, X, Y, W, H, seed); break;
            case 'grid': {
                c.fillStyle = wcA(P.accent, 0.07);
                for (let gx = Math.floor(X / 8) * 8; gx < X + W; gx += 8) c.fillRect(gx, Y, 0.6, H);
                for (let gy = Math.floor(Y / 8) * 8; gy < Y + H; gy += 8) c.fillRect(X, gy, W, 0.6);
                c.fillStyle = wcA(P.accent, 0.32);
                for (let gx = X; gx <= X + W; gx += T) c.fillRect(gx - 0.6, Y, 1.2, H);
                for (let gy = Y; gy <= Y + H; gy += T) c.fillRect(X, gy - 0.6, W, 1.2);
                c.fillStyle = wcA(P.accent, 0.8);
                for (let gx = X; gx <= X + W; gx += T) for (let gy = Y; gy <= Y + H; gy += T) c.fillRect(gx - 1.5, gy - 1.5, 3, 3);
                break;
            }
            case 'rock': this._rockFloor(c, P, X, Y, W, H, seed); break;
            default: { // 'blotch': weiche Flecken + Krümel
                const d = wcA(wcDark(f, 0.3), 0.22), l = wcA(wcLight(f, 0.18), 0.2);
                for (const col of [d, l]) {
                    c.fillStyle = col;
                    c.beginPath();
                    wScatter(X, Y, W, H, 19, 12, seed + (col === d ? 41 : 43), (px, py, r) => {
                        const rx = 5 + r * 8;
                        c.moveTo(px + rx, py);
                        c.ellipse(px, py, rx, rx * 0.62, r * 3, 0, W_TAU);
                    });
                    c.fill();
                }
                this._specks(c, X, Y, W, H, 9, seed + 45, wcA(wcDark(f, 0.4), 0.35), wcA(wcLight(f, 0.3), 0.3));
            }
        }
    },

    // Feine Krümel in zwei Tönen
    _specks(c, X, Y, W, H, cell, seed, dark, light) {
        for (const col of [dark, light]) {
            c.fillStyle = col;
            c.beginPath();
            wScatter(X, Y, W, H, cell, 1, seed + (col === dark ? 0 : 3), (px, py, r) => {
                if (r > 0.45) return;
                c.moveTo(px + 0.7 + r, py);
                c.arc(px, py, 0.7 + r, 0, W_TAU);
            });
            c.fill();
        }
    },

    // Blumenwiese: überall ein paar Blütchen, in weichen, weltfesten Flecken viele (klein, damit Geschosse gut
    // sichtbar bleiben). Die Boss-Arena bleibt frei – dort fliegt im Kampf am meisten.
    _blossomField(w, c, P, X, Y, W, H, seed) {
        const T = TILE_SIZE, cols = P.blossoms, pts = [];
        const ax = w._hasArena() ? (w.width - 13) * T - 4 : Infinity, ay = (w.height - 11) * T - 4;
        const dense = (px, py) => Math.sin(px * 0.019 + Math.sin(py * 0.011) * 2.2) * Math.sin(py * 0.017 + Math.sin(px * 0.013) * 1.7) > 0.22;
        wScatter(X, Y, W, H, 9, 3, seed + 33, (px, py, r, gx, gy) => {
            if (r > (dense(px, py) ? 0.5 : 0.1) || (px > ax && py > ay)) return;
            pts.push(px, py, Math.floor(wHash(gx, gy, seed + 35) * cols.length), 0.85 + wHash(gy, gx, seed + 39) * 0.5);
        });
        if (!pts.length) return;
        c.fillStyle = wcA(wcDark(P.floor[0], 0.35), 0.45);
        c.beginPath();
        for (let i = 0; i < pts.length; i += 4) {
            c.moveTo(pts[i] + 3.8, pts[i + 1] + 1.4);
            c.ellipse(pts[i] + 1.8, pts[i + 1] + 1.4, 2, 0.9, 0.5, 0, W_TAU);
        }
        c.fill();
        cols.forEach((col, k) => {
            c.fillStyle = col;
            c.beginPath();
            for (let i = 0; i < pts.length; i += 4) {
                if (pts[i + 2] !== k) continue;
                const s = pts[i + 3];
                for (let q = 0; q < 5; q++) this._dot(c, pts[i] + Math.cos(q * 1.2566) * 1.3 * s, pts[i + 1] + Math.sin(q * 1.2566) * 1.3 * s, s);
            }
            c.fill();
        });
        c.fillStyle = '#ffb627';
        c.beginPath();
        for (let i = 0; i < pts.length; i += 4) this._dot(c, pts[i], pts[i + 1], 0.65 * pts[i + 3]);
        c.fill();
    },

    // Schul-Linoleum: glatte Platten mit feinen Fugen, Glanzstreifen und Schuhabrieb
    _lino(c, P, X, Y, W, H, seed) {
        const T = TILE_SIZE, f = P.floor[0];
        c.fillStyle = wcA('#ffffff', 0.05);
        c.beginPath();
        const n0 = Math.floor((X + Y) / 150) - 2, n1 = Math.ceil((X + W + Y + H) / 150) + 1;
        for (let n = n0; n <= n1; n++) {
            const r = wHash(n, 3, seed + 61);
            if (r > 0.6) continue;
            const o = n * 150 + r * 60, bw = 10 + r * 34;
            c.moveTo(o - Y, Y);
            c.lineTo(o + bw - Y, Y);
            c.lineTo(o + bw - Y - H, Y + H);
            c.lineTo(o - Y - H, Y + H);
            c.closePath();
        }
        c.fill();
        const gx0 = Math.floor(X / T) * T, gy0 = Math.floor(Y / T) * T;
        c.fillStyle = wcA(wcDark(f, 0.5), 0.45);
        for (let gx = gx0; gx <= X + W; gx += T) c.fillRect(gx - 0.5, Y, 1, H);
        for (let gy = gy0; gy <= Y + H; gy += T) c.fillRect(X, gy - 0.5, W, 1);
        c.fillStyle = wcA('#ffffff', 0.1);
        for (let gx = gx0; gx <= X + W; gx += T) c.fillRect(gx + 0.5, Y, 0.8, H);
        for (let gy = gy0; gy <= Y + H; gy += T) c.fillRect(X, gy + 0.5, W, 0.8);
        this._line(c, wcA(wcDark(f, 0.55), 0.3), 1.1);
        c.beginPath();
        wScatter(X, Y, W, H, 23, 10, seed + 63, (px, py, r) => {
            if (r > 0.4) return;
            const a = r * 15, l = 3 + r * 9;
            c.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l);
            c.quadraticCurveTo(px + Math.sin(a) * 2, py - Math.cos(a) * 2, px + Math.cos(a) * l, py + Math.sin(a) * l);
        });
        c.stroke();
        this._specks(c, X, Y, W, H, 10, seed + 65, wcA(wcDark(f, 0.4), 0.3), wcA(wcLight(f, 0.35), 0.25));
    },

    // Element-Zone einer Kachel (Welt 24), je Karte einmal für alle Kacheln berechnet
    _zone(w, x, y) {
        if (x < 0 || y < 0 || x >= w.width || y >= w.height) return dragonZone(x + 0.5, y + 0.5);
        let g = w._zoneGrid;
        if (!g || g.length !== w.width * w.height) {
            g = w._zoneGrid = new Uint8Array(w.width * w.height);
            for (let ty = 0; ty < w.height; ty++) for (let tx = 0; tx < w.width; tx++) g[ty * w.width + tx] = dragonZone(tx + 0.5, ty + 0.5);
        }
        return g[y * w.width + x];
    },

    // Deko-Liste einer Kachel: Welten mit Element-Zonen mischen gemeinsame und zonentypische Deko
    _decoList(w, P, x, y) {
        if (!P.zones) return P.deco;
        const cache = this._zdc || (this._zdc = new Map());
        let lists = cache.get(P);
        if (!lists) cache.set(P, lists = P.zdeco.map(z => P.deco.concat(z)));
        return lists[this._zone(w, x, y)];
    },

    // Drachenhöhle: warmer, dunkler Fels. Große weiche Flecken tönen die Element-Zonen, ein feines Rissnetz
    // wird stellenweise zu Adern in Zonenfarbe (Gold, glühende Lava, Reif, Kristall); dazu Krümel und Goldflitter.
    _caveFloor(w, c, P, X, Y, W, H, seed) {
        const T = TILE_SIZE, f = P.floor[0];
        const zoneAt = (px, py) => this._zone(w, Math.floor(px / T), Math.floor(py / T));
        const tints = [['#ffc24a', 0.06], ['#ff5a1f', 0.09], ['#8fd8ff', 0.09], ['#c070ff', 0.09]];
        const blobs = [[], [], [], []];
        wScatter(X, Y, W, H, 30, 34, seed + 71, (px, py, r) => blobs[zoneAt(px, py)].push(px, py, 18 + r * 16, r * 3));
        blobs.forEach((l, z) => {
            if (!l.length) return;
            c.fillStyle = wcA(tints[z][0], tints[z][1]);
            c.beginPath();
            for (let i = 0; i < l.length; i += 4) {
                c.moveTo(l[i] + l[i + 2] * Math.cos(l[i + 3]), l[i + 1] + l[i + 2] * Math.sin(l[i + 3]));
                c.ellipse(l[i], l[i + 1], l[i + 2], l[i + 2] * 0.7, l[i + 3], 0, W_TAU);
            }
            c.fill();
        });
        // Felsflecken
        for (const [col, sd] of [[wcA(wcDark(f, 0.3), 0.2), 41], [wcA(wcLight(f, 0.16), 0.15), 43]]) {
            c.fillStyle = col;
            c.beginPath();
            wScatter(X, Y, W, H, 21, 12, seed + sd, (px, py, r) => {
                const rx = 5 + r * 8;
                c.moveTo(px + rx * Math.cos(r * 3), py + rx * Math.sin(r * 3));
                c.ellipse(px, py, rx, rx * 0.62, r * 3, 0, W_TAU);
            });
            c.fill();
        }
        // Rissnetz; ein Teil der Risse wird zur farbigen Ader der Zone
        const cell = 24, pt = (gx, gy) => [gx * cell + wHash(gx, gy, seed + 73) * cell * 0.8, gy * cell + wHash(gy, gx, seed + 75) * cell * 0.8];
        const gx0 = Math.floor(X / cell) - 1, gx1 = Math.ceil((X + W) / cell) + 1;
        const gy0 = Math.floor(Y / cell) - 1, gy1 = Math.ceil((Y + H) / cell) + 1;
        const veins = [[], [], [], []];
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (const pass of [0, 1]) {
            c.strokeStyle = pass ? wcA(wcDark(f, 0.55), 0.55) : wcA(wcLight(f, 0.2), 0.25);
            c.lineWidth = pass ? 1.2 : 1;
            c.beginPath();
            for (let gy = gy0; gy <= gy1; gy++) {
                for (let gx = gx0; gx <= gx1; gx++) {
                    const [ax, ay] = pt(gx, gy), o = pass ? 0 : 1;
                    for (let k = 0; k < 2; k++) {
                        if (wHash(gx, gy, seed + 77 + k * 2) > 0.44) continue;
                        const [bx2, by2] = k ? pt(gx, gy + 1) : pt(gx + 1, gy);
                        c.moveTo(ax + o, ay + o);
                        c.lineTo(bx2 + o, by2 + o);
                        if (pass && wHash(gy, gx, seed + 81 + k) < 0.2) veins[zoneAt((ax + bx2) / 2, (ay + by2) / 2)].push(ax, ay, bx2, by2);
                    }
                }
            }
            c.stroke();
        }
        const vc = [['#f0b83a', 0.7, 1.2], ['#ff8a2b', 0.8, 1.5], ['#d8f4ff', 0.55, 1.1], ['#e08cff', 0.7, 1.3]];
        veins.forEach((l, z) => {
            if (!l.length) return;
            this._line(c, wcA(vc[z][0], vc[z][1]), vc[z][2]);
            c.beginPath();
            for (let i = 0; i < l.length; i += 4) {
                c.moveTo(l[i], l[i + 1]);
                c.lineTo(l[i + 2], l[i + 3]);
            }
            c.stroke();
        });
        this._specks(c, X, Y, W, H, 9, seed + 83, wcA(wcDark(f, 0.45), 0.35), wcA(wcLight(f, 0.3), 0.28));
        c.fillStyle = '#ffd24a';
        c.beginPath();
        wScatter(X, Y, W, H, 10, 1, seed + 85, (px, py, r) => {
            if (r < 0.14 && zoneAt(px, py) === 0) this._dot(c, px, py, 0.6 + r * 3);
        });
        c.fill();
    },

    _flagstones(c, P, X, Y, W, H, seed) {
        const s = P.stone || 32, f = P.floor[0];
        c.fillStyle = wcDark(f, 0.28);
        c.fillRect(X, Y, W, H);
        const g = s < 32 ? 1 : 1.3;
        // Steine nach Farbe gruppiert zeichnen (wenige Füllaufrufe)
        const groups = new Map(), stones = [];
        for (let sy = Math.floor(Y / s) * s; sy < Y + H; sy += s) {
            const off = s < 32 && ((sy / s) & 1) ? s / 2 : 0;
            for (let sx = Math.floor((X - off) / s) * s + off; sx < X + W; sx += s) {
                const v = wHash(sx, sy, seed + 9) - 0.5;
                const base = P.floor[(Math.floor(sx / s) + Math.floor(sy / s)) & 1];
                let col = v > 0 ? wcLight(base, v * 0.12) : wcDark(base, -v * 0.12);
                if (P.ftints) col = wcMix(col, P.ftints[Math.floor(wHash(sy, sx, seed + 11) * P.ftints.length)], 0.14);
                let list = groups.get(col);
                if (!list) groups.set(col, list = []);
                list.push(sx, sy);
                stones.push(sx, sy, v);
            }
        }
        for (const [col, list] of groups) {
            c.fillStyle = col;
            c.beginPath();
            for (let i = 0; i < list.length; i += 2) wRound(c, list[i] + g * 0.5, list[i + 1] + g * 0.5, s - g, s - g, s < 32 ? 2 : 3);
            c.fill();
        }
        c.fillStyle = wcA('#ffffff', 0.1);
        c.beginPath();
        for (let i = 0; i < stones.length; i += 3) c.rect(stones[i] + 2, stones[i + 1] + g * 0.5, s - 4, 1.2);
        c.fill();
        c.fillStyle = wcA(wcDark(f, 0.5), 0.35);
        c.beginPath();
        for (let i = 0; i < stones.length; i += 3) c.rect(stones[i] + 2, stones[i + 1] + s - g * 0.5 - 1.2, s - 4, 1.2);
        c.fill();
        if (!P.seams && !P.inlay && !P.moss) return;
        for (let i = 0; i < stones.length; i += 3) {
            const sx = stones[i], sy = stones[i + 1], v = stones[i + 2];
            {
                if (P.seams && v > 0.1) {
                    // Raumstation: Nieten und Leuchtfuge
                    c.fillStyle = wcA(P.accent, 0.35);
                    c.fillRect(sx + 6, sy + s / 2 - 0.5, s - 12, 1);
                    c.fillStyle = wcA('#ffffff', 0.25);
                    for (const [a, bb] of [[4, 4], [s - 4, 4], [4, s - 4], [s - 4, s - 4]]) c.fillRect(sx + a - 1, sy + bb - 1, 2, 2);
                }
                if (P.inlay && v < -0.4) {
                    // Chrono: goldenes Ziffernblatt im Boden
                    c.strokeStyle = wcA('#ffd23f', 0.45);
                    c.lineWidth = 1.2;
                    c.beginPath();
                    c.arc(sx + s / 2, sy + s / 2, s * 0.32, 0, W_TAU);
                    for (let i = 0; i < 12; i++) {
                        const a = i * W_TAU / 12;
                        c.moveTo(sx + s / 2 + Math.cos(a) * s * 0.24, sy + s / 2 + Math.sin(a) * s * 0.24);
                        c.lineTo(sx + s / 2 + Math.cos(a) * s * 0.3, sy + s / 2 + Math.sin(a) * s * 0.3);
                    }
                    c.stroke();
                } else if (P.inlay && v > 0.42) {
                    c.fillStyle = wcA('#ffd23f', 0.35);
                    c.beginPath();
                    c.moveTo(sx + s / 2, sy + 7); c.lineTo(sx + s - 7, sy + s / 2);
                    c.lineTo(sx + s / 2, sy + s - 7); c.lineTo(sx + 7, sy + s / 2);
                    c.closePath();
                    c.fill();
                }
                if (P.moss && v < -0.15) {
                    c.fillStyle = wcA('#6fcf5a', 0.55);
                    c.beginPath();
                    const mx = sx + (v < -0.3 ? 2 : s - 10);
                    for (let i = 0; i < 4; i++) {
                        const r = 1.6 + ((i * 7 + sx) % 3) * 0.8;
                        c.moveTo(mx + i * 2.5 + r, sy + s - 2);
                        c.arc(mx + i * 2.5, sy + s - 2 - (i & 1) * 1.5, r, 0, W_TAU);
                    }
                    c.fill();
                }
            }
        }
    },

    _plates(c, P, X, Y, W, H, seed) {
        const T = TILE_SIZE, f = P.floor[0];
        // Riffelblech: schräge Striche im Wechsel
        c.strokeStyle = wcA(wcLight(f, 0.25), 0.28);
        c.lineWidth = 1.2;
        c.lineCap = 'round';
        c.beginPath();
        for (let gy = Math.floor(Y / 6) * 6; gy < Y + H; gy += 6) {
            for (let gx = Math.floor(X / 6) * 6; gx < X + W; gx += 6) {
                const odd = ((gx + gy) / 6) & 1;
                c.moveTo(gx + 1.5, gy + (odd ? 1.5 : 4.5));
                c.lineTo(gx + 4.5, gy + (odd ? 4.5 : 1.5));
            }
        }
        c.stroke();
        // Fugen und Nieten je Platte
        c.fillStyle = wcA(wcDark(f, 0.5), 0.55);
        for (let gx = X; gx <= X + W; gx += T) c.fillRect(gx - 0.8, Y, 1.6, H);
        for (let gy = Y; gy <= Y + H; gy += T) c.fillRect(X, gy - 0.8, W, 1.6);
        c.fillStyle = wcA('#ffffff', 0.12);
        for (let gy = Y; gy < Y + H; gy += T) c.fillRect(X, gy + 0.8, W, 1);
        for (const k of [0, 1]) {
            c.fillStyle = k ? wcLight(f, 0.35) : wcDark(f, 0.35);
            c.beginPath();
            for (let gy = Y; gy < Y + H; gy += T) {
                for (let gx = X; gx < X + W; gx += T) {
                    for (const [a, bb] of [[4, 4], [T - 4, 4], [4, T - 4], [T - 4, T - 4]]) {
                        const cx = gx + a + (k ? -0.3 : 0.4), cy = gy + bb + (k ? -0.3 : 0.4), r = k ? 1.1 : 1.5;
                        c.moveTo(cx + r, cy);
                        c.arc(cx, cy, r, 0, W_TAU);
                    }
                }
            }
            c.fill();
        }
    },

    _tatami(c, P, X, Y, W, H, seed) {
        const T = TILE_SIZE;
        const mats = [];
        for (let by = Math.floor(Y / (2 * T)) * 2 * T; by < Y + H; by += 2 * T) {
            for (let bx = Math.floor(X / (2 * T)) * 2 * T; bx < X + W; bx += 2 * T) {
                const horiz = ((bx + by) / (2 * T)) & 1;
                for (let i = 0; i < 2; i++) {
                    const mx = horiz ? bx : bx + i * T, my = horiz ? by + i * T : by;
                    mats.push(mx, my, horiz ? 2 * T : T, horiz ? T : 2 * T, horiz);
                }
            }
        }
        c.fillStyle = wcDark(P.floor[1], 0.3);
        c.fillRect(X, Y, W, H);
        for (const k of [0, 1]) {
            c.fillStyle = k ? P.floor[0] : wcDark(P.floor[1], 0.04);
            c.beginPath();
            for (let i = 0; i < mats.length; i += 5) {
                if ((wHash(mats[i], mats[i + 1], seed + 21) < 0.5) !== !!k) continue;
                c.rect(mats[i] + 0.6, mats[i + 1] + 0.6, mats[i + 2] - 1.2, mats[i + 3] - 1.2);
            }
            c.fill();
        }
        // Webmuster längs der Matte
        c.fillStyle = wcA(wcDark(P.floor[0], 0.35), 0.16);
        c.beginPath();
        for (let i = 0; i < mats.length; i += 5) {
            const mx = mats[i], my = mats[i + 1], mw = mats[i + 2], mh = mats[i + 3];
            if (mats[i + 4]) for (let k = my + 3; k < my + mh - 2; k += 3) c.rect(mx + 3, k, mw - 6, 0.8);
            else for (let k = mx + 3; k < mx + mw - 2; k += 3) c.rect(k, my + 3, 0.8, mh - 6);
        }
        c.fill();
        // Randstreifen an den Längsseiten
        c.fillStyle = '#3d5c35';
        c.beginPath();
        for (let i = 0; i < mats.length; i += 5) {
            const mx = mats[i], my = mats[i + 1], mw = mats[i + 2], mh = mats[i + 3];
            if (mats[i + 4]) { c.rect(mx + 0.6, my + 0.6, mw - 1.2, 2.6); c.rect(mx + 0.6, my + mh - 3.2, mw - 1.2, 2.6); }
            else { c.rect(mx + 0.6, my + 0.6, 2.6, mh - 1.2); c.rect(mx + mw - 3.2, my + 0.6, 2.6, mh - 1.2); }
        }
        c.fill();
    },

    _rockFloor(c, P, X, Y, W, H, seed) {
        const cell = 17, pts = (gx, gy) => [gx * cell + wHash(gx, gy, seed + 51) * cell * 0.8, gy * cell + wHash(gy, gx, seed + 53) * cell * 0.8];
        const f = P.floor[0];
        c.lineCap = 'round';
        c.lineJoin = 'round';
        const gx0 = Math.floor(X / cell) - 1, gx1 = Math.ceil((X + W) / cell) + 1;
        const gy0 = Math.floor(Y / cell) - 1, gy1 = Math.ceil((Y + H) / cell) + 1;
        for (const pass of [0, 1]) {
            c.strokeStyle = pass ? wcA(wcDark(f, 0.55), 0.7) : wcA(wcLight(f, 0.2), 0.35);
            c.lineWidth = pass ? 1.3 : 1;
            c.beginPath();
            for (let gy = gy0; gy <= gy1; gy++) {
                for (let gx = gx0; gx <= gx1; gx++) {
                    const [ax, ay] = pts(gx, gy);
                    const o = pass ? 0 : 1;
                    if (wHash(gx, gy, seed + 55) < 0.8) { const [bx2, by2] = pts(gx + 1, gy); c.moveTo(ax + o, ay + o); c.lineTo(bx2 + o, by2 + o); }
                    if (wHash(gx, gy, seed + 57) < 0.8) { const [bx2, by2] = pts(gx, gy + 1); c.moveTo(ax + o, ay + o); c.lineTo(bx2 + o, by2 + o); }
                }
            }
            c.stroke();
        }
        // Einige Risse glühen (Lava darunter)
        c.strokeStyle = wcA('#ff8a2b', 0.75);
        c.lineWidth = 1.4;
        c.beginPath();
        for (let gy = gy0; gy <= gy1; gy++) {
            for (let gx = gx0; gx <= gx1; gx++) {
                if (wHash(gx, gy, seed + 59) > 0.13) continue;
                const [ax, ay] = pts(gx, gy), [bx2, by2] = pts(gx + 1, gy);
                c.moveTo(ax, ay);
                c.lineTo(bx2, by2);
            }
        }
        c.stroke();
    },

    // Weicher Schatten auf dem Boden an Wandkanten (Umgebungsverdeckung)
    _grads(c, P) {
        const cache = c.__wg || (c.__wg = new Map());
        let g = cache.get(P.shade);
        if (g) return g;
        g = {};
        if (cache.size > 8) cache.clear();
        cache.set(P.shade, g);
        g.lin = c.createLinearGradient(0, 0, 0, 1);
        g.lin.addColorStop(0, wcA(P.shade, 1));
        g.lin.addColorStop(0.45, wcA(P.shade, 0.45));
        g.lin.addColorStop(1, wcA(P.shade, 0));
        g.rad = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.rad.addColorStop(0, wcA(P.shade, 1));
        g.rad.addColorStop(1, wcA(P.shade, 0));
        return g;
    },

    ao(w, c, P, x, y) {
        const up = w._raised(x, y - 1), lf = w._raised(x - 1, y), rt = w._raised(x + 1, y), dn = w._raised(x, y + 1);
        const ul = !up && !lf && w._raised(x - 1, y - 1), ur = !up && !rt && w._raised(x + 1, y - 1);
        if (!up && !lf && !rt && !dn && !ul && !ur) return;
        const g = this._grads(c, P), px = x * TILE_SIZE, py = y * TILE_SIZE, T = TILE_SIZE;
        const band = (a, b, cc, d, e, f, alpha, grad) => {
            c.save();
            c.transform(a, b, cc, d, e, f);
            c.globalAlpha = alpha;
            c.fillStyle = grad;
            c.fillRect(0, 0, 1, 1);
            c.restore();
        };
        if (up) band(T, 0, 0, 13, px, py, 0.55, g.lin);
        if (lf) band(0, T, 9, 0, px, py, 0.4, g.lin);
        if (rt) band(0, T, -5, 0, px + T, py, 0.22, g.lin);
        if (dn) band(T, 0, 0, -4, px, py + T, 0.16, g.lin);
        if (ul) band(9, 0, 0, 13, px, py, 0.4, g.rad);
        if (ur) band(-5, 0, 0, 13, px + T, py, 0.28, g.rad);
    },

    // ── Große Muster: Spielfeldlinien, Boss-Arena, Teppich zur Boss-Tür ──
    patterns(w, c, P, x0, y0, x1, y1, seed) {
        const T = TILE_SIZE;
        if (P.lines === 'training') this._trainingLines(w, c);
        else if (P.lines === 'pitch') this._pitchLines(w, c, P, x0, y0, x1, y1, seed);
        if (P.edge) {
            // Farbiger Streifen am Wandfuß (Schulflur)
            this._line(c, wcA(P.edge, 0.34), 2.6);
            c.beginPath();
            this._edgePath(w, c, x0, y0, x1, y1, 4.5);
            c.stroke();
        }
        if (w._hasArena()) {
            const ax = (w.width - 13) * T, ay = (w.height - 11) * T;
            if (x1 * T > ax - 8 && y1 * T > ay - 8) this._arena(w, c, P);
        }
        for (const d of w.bossDoorTiles) {
            if (d.x < x0 - 1 || d.x > x1 || d.y - 5 > y1 || d.y < y0) continue;
            this._carpet(c, P, d.x * T, (d.y - 4) * T, 4 * T);
        }
    },

    _line(c, col, lw) {
        c.strokeStyle = col;
        c.lineWidth = lw;
        c.lineCap = 'round';
        c.lineJoin = 'round';
    },

    _trainingLines(w, c) {
        const T = TILE_SIZE, W = w.width * T, H = w.height * T;
        this._line(c, 'rgba(255,255,255,0.72)', 2.4);
        c.beginPath();
        c.rect(1.5 * T, 1.5 * T, W - 3 * T, H - 3 * T);
        c.moveTo(W / 2, 1.5 * T);
        c.lineTo(W / 2, H - 1.5 * T);
        c.moveTo(W / 2 + 2 * T, H / 2);
        c.arc(W / 2, H / 2, 2 * T, 0, W_TAU);
        c.rect(1.5 * T, H / 2 - 3 * T, 3 * T, 6 * T);
        c.rect(W - 4.5 * T, H / 2 - 3 * T, 3 * T, 6 * T);
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.beginPath();
        c.arc(W / 2, H / 2, 3, 0, W_TAU);
        c.fill();
    },

    // Fußball: weiße Linien laufen parallel zu allen Wänden, dazu einige Mittelkreise
    _pitchLines(w, c, P, x0, y0, x1, y1, seed) {
        const T = TILE_SIZE;
        const floorish = (x, y) => !w._raised(x, y) && w._tileAt(x, y) !== TILE_WATER;
        this._line(c, 'rgba(255,255,255,0.7)', 2.2);
        c.beginPath();
        this._edgePath(w, c, x0, y0, x1, y1, 5);
        c.stroke();
        // Mittelkreise in offenen Flächen (auch aus Nachbarblöcken, damit nichts abgeschnitten wird)
        for (let y = y0 - 2; y < y1 + 2; y++) {
            for (let x = x0 - 2; x < x1 + 2; x++) {
                if (wHash(x, y, seed + 71) > 0.05) continue;
                let open = true;
                for (let dy = -2; dy <= 2 && open; dy++) for (let dx = -2; dx <= 2 && open; dx++) if (!floorish(x + dx, y + dy)) open = false;
                if (!open || (w._hasArena() && x >= w.width - 15 && y >= w.height - 13)) continue;
                const cx = x * T + T / 2, cy = y * T + T / 2;
                c.beginPath();
                c.arc(cx, cy, 40, 0, W_TAU);
                c.stroke();
                c.fillStyle = 'rgba(255,255,255,0.75)';
                c.beginPath();
                c.arc(cx, cy, 3, 0, W_TAU);
                c.fill();
            }
        }
    },

    // Pfad aus Linien parallel zu allen Wänden im Abstand i vom Wandfuß (Ecken geschlossen)
    _edgePath(w, c, x0, y0, x1, y1, i) {
        const T = TILE_SIZE, o = T - i;
        const floorish = (x, y) => !w._raised(x, y) && w._tileAt(x, y) !== TILE_WATER;
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                if (!floorish(x, y)) continue;
                const px = x * T, py = y * T;
                const up = w._raised(x, y - 1), dn = w._raised(x, y + 1), lf = w._raised(x - 1, y), rt = w._raised(x + 1, y);
                const ax = lf ? px + i : px, bx = rt ? px + o : px + T;
                const ay = up ? py + i : py, by = dn ? py + o : py + T;
                if (up) { c.moveTo(ax, py + i); c.lineTo(bx, py + i); }
                if (dn) { c.moveTo(ax, py + o); c.lineTo(bx, py + o); }
                if (lf) { c.moveTo(px + i, ay); c.lineTo(px + i, by); }
                if (rt) { c.moveTo(px + o, ay); c.lineTo(px + o, by); }
                if (!up && !lf && w._raised(x - 1, y - 1)) { c.moveTo(px + i, py); c.lineTo(px + i, py + i); c.lineTo(px, py + i); }
                if (!up && !rt && w._raised(x + 1, y - 1)) { c.moveTo(px + o, py); c.lineTo(px + o, py + i); c.lineTo(px + T, py + i); }
                if (!dn && !lf && w._raised(x - 1, y + 1)) { c.moveTo(px + i, py + T); c.lineTo(px + i, py + o); c.lineTo(px, py + o); }
                if (!dn && !rt && w._raised(x + 1, y + 1)) { c.moveTo(px + o, py + T); c.lineTo(px + o, py + o); c.lineTo(px + T, py + o); }
            }
        }
    },

    // Boss-Arena: Leuchtkreis, Rahmen und Krone in der Mitte (gut erkennbar für Kinder)
    _arena(w, c, P) {
        if (P.arenaStyle === 'gym') { this._gymArena(w, c, P); return; }
        if (P.arenaStyle === 'meadow') { this._meadowArena(w, c, P); return; }
        if (P.arenaStyle === 'nest') { this._nestArena(w, c, P); return; }
        const T = TILE_SIZE, a = P.arena || P.accent;
        const ix = (w.width - 13) * T, iy = (w.height - 11) * T, iw = 11 * T, ih = 9 * T;
        const cx = (w.width - 8) * T + T / 2, cy = (w.height - 7) * T + T / 2;
        c.fillStyle = wcA(a, 0.08);
        c.fillRect(ix, iy, iw, ih);
        this._line(c, wcA(a, 0.62), 3);
        c.strokeRect(ix + 7, iy + 7, iw - 14, ih - 14);
        c.setLineDash([7, 7]);
        this._line(c, wcA(a, 0.28), 1.3);
        c.strokeRect(ix + 13, iy + 13, iw - 26, ih - 26);
        c.setLineDash([]);
        // Ecken-Pfeile zur Mitte
        c.fillStyle = wcA(a, 0.5);
        c.beginPath();
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const ex = sx > 0 ? ix + 18 : ix + iw - 18, ey = sy > 0 ? iy + 18 : iy + ih - 18;
            c.moveTo(ex, ey);
            c.lineTo(ex + sx * 14, ey);
            c.lineTo(ex, ey + sy * 14);
            c.closePath();
        }
        c.fill();
        // Kreise und Speichen
        c.fillStyle = wcA(a, 0.13);
        c.beginPath();
        c.arc(cx, cy, 130, 0, W_TAU);
        c.fill();
        this._line(c, wcA(a, 0.75), 4);
        c.beginPath();
        c.arc(cx, cy, 130, 0, W_TAU);
        c.stroke();
        this._line(c, 'rgba(255,255,255,0.35)', 1.2);
        c.beginPath();
        c.arc(cx, cy, 130, 0, W_TAU);
        c.stroke();
        this._line(c, wcA(a, 0.3), 1.3);
        c.beginPath();
        c.arc(cx, cy, 117, 0, W_TAU);
        for (let k = 0; k < 8; k++) {
            const ang = k * W_TAU / 8 + W_TAU / 16;
            c.moveTo(cx + Math.cos(ang) * 48, cy + Math.sin(ang) * 48);
            c.lineTo(cx + Math.cos(ang) * 110, cy + Math.sin(ang) * 110);
        }
        c.stroke();
        c.fillStyle = wcA(a, 0.12);
        c.beginPath();
        c.arc(cx, cy, 40, 0, W_TAU);
        c.fill();
        this._line(c, wcA(a, 0.5), 2);
        c.beginPath();
        c.arc(cx, cy, 40, 0, W_TAU);
        c.stroke();
        // Krone
        c.fillStyle = wcA('#ffd23f', 0.42);
        c.beginPath();
        c.moveTo(cx - 15, cy + 9);
        c.lineTo(cx - 17, cy - 8);
        c.lineTo(cx - 8, cy);
        c.lineTo(cx, cy - 13);
        c.lineTo(cx + 8, cy);
        c.lineTo(cx + 17, cy - 8);
        c.lineTo(cx + 15, cy + 9);
        c.closePath();
        c.fill();
    },

    // Zombie Academy: Turnhalle mit Parkett, Spielfeldlinien und Schulwappen „ZA“
    _gymArena(w, c, P) {
        const T = TILE_SIZE, a = P.arena || P.accent;
        const ix = (w.width - 13) * T, iy = (w.height - 11) * T, iw = 11 * T, ih = 9 * T;
        const cx = (w.width - 8) * T + T / 2, cy = (w.height - 7) * T + T / 2;
        c.save();
        c.beginPath();
        c.rect(ix, iy, iw, ih);
        c.clip();
        // Parkett: Dielenreihen mit versetzten Stößen, nach Farbe gruppiert
        const woods = ['#dca25e', '#d09657', '#e6b06c', '#c98e50'];
        const pl = [];
        for (let ry = 0; ry < ih; ry += 8) {
            let px = -Math.floor(wHash(ry, 1, 91) * 48);
            while (px < iw) {
                const len = 40 + Math.floor(wHash(px + 999, ry, 93) * 5) * 12;
                pl.push(px, ry, len, Math.floor(wHash(px + 999, ry, 95) * woods.length));
                px += len;
            }
        }
        woods.forEach((col, k) => {
            c.fillStyle = col;
            c.beginPath();
            for (let i = 0; i < pl.length; i += 4) if (pl[i + 3] === k) c.rect(ix + pl[i], iy + pl[i + 1], pl[i + 2], 8);
            c.fill();
        });
        c.fillStyle = 'rgba(255,238,205,0.3)';
        c.beginPath();
        for (let i = 0; i < pl.length; i += 4) c.rect(ix + pl[i] + 1, iy + pl[i + 1] + 0.7, pl[i + 2] - 2, 1);
        c.fill();
        c.fillStyle = 'rgba(100,46,20,0.45)';
        c.beginPath();
        for (let i = 0; i < pl.length; i += 4) {
            c.rect(ix + pl[i], iy + pl[i + 1] + 7.3, pl[i + 2], 0.8);
            c.rect(ix + pl[i] - 0.4, iy + pl[i + 1], 0.8, 8);
        }
        c.fill();
        // Glanz der frisch versiegelten Halle
        c.fillStyle = 'rgba(255,255,255,0.07)';
        c.beginPath();
        for (const [o, bw] of [[60, 34], [170, 16], [300, 44], [390, 20]]) {
            c.moveTo(ix + o, iy); c.lineTo(ix + o + bw, iy);
            c.lineTo(ix + o + bw - ih * 0.7, iy + ih); c.lineTo(ix + o - ih * 0.7, iy + ih);
            c.closePath();
        }
        c.fill();
        // Farbige Zonen und Mittelkreis
        const L = ix + 12, R = ix + iw - 12, Tp = iy + 12, B = iy + ih - 12;
        c.fillStyle = wcA(a, 0.3);
        c.beginPath();
        c.rect(L, cy - 36, 62, 72);
        c.rect(R - 62, cy - 36, 62, 72);
        c.moveTo(cx + 40, cy);
        c.arc(cx, cy, 40, 0, W_TAU);
        c.fill();
        // Spielfeldlinien (Basketball)
        this._line(c, 'rgba(255,255,255,0.85)', 2);
        c.beginPath();
        c.rect(L, Tp, R - L, B - Tp);
        c.moveTo(cx, Tp); c.lineTo(cx, B);
        c.moveTo(cx + 40, cy);
        c.arc(cx, cy, 40, 0, W_TAU);
        for (const s of [-1, 1]) {
            const ex = s < 0 ? L : R, kx = ex - s * 62, hx = ex - s * 16, a0 = s < 0 ? -Math.PI / 2 : Math.PI / 2;
            c.moveTo(ex, cy - 36); c.lineTo(kx, cy - 36); c.lineTo(kx, cy + 36); c.lineTo(ex, cy + 36);
            c.moveTo(kx + Math.cos(a0) * 28, cy + Math.sin(a0) * 28);
            c.arc(kx, cy, 28, a0, a0 + Math.PI);
            c.moveTo(ex, cy - 88); c.lineTo(hx, cy - 88);
            c.arc(hx, cy, 88, -Math.PI / 2, Math.PI / 2, s > 0);
            c.lineTo(ex, cy + 88);
        }
        c.stroke();
        // Schulwappen „ZA“ im Mittelkreis
        const za = () => {
            c.beginPath();
            c.moveTo(cx - 13, cy - 8); c.lineTo(cx - 3, cy - 8); c.lineTo(cx - 13, cy + 8); c.lineTo(cx - 3, cy + 8);
            c.moveTo(cx + 2, cy + 8); c.lineTo(cx + 7.5, cy - 8); c.lineTo(cx + 13, cy + 8);
            c.moveTo(cx + 4.4, cy + 2.5); c.lineTo(cx + 10.6, cy + 2.5);
        };
        this._line(c, wcDark(a, 0.55), 5);
        za();
        c.stroke();
        this._line(c, '#ffffff', 2.4);
        za();
        c.stroke();
        c.restore();
    },

    // Schmetterlingwelt: Lichtung mit Blumenring, Pilzkreis und Schmetterlings-Wappen
    _meadowArena(w, c, P) {
        const T = TILE_SIZE, a = P.arena || P.accent, f = P.floor[0];
        const ix = (w.width - 13) * T, iy = (w.height - 11) * T, iw = 11 * T, ih = 9 * T;
        const cx = (w.width - 8) * T + T / 2, cy = (w.height - 7) * T + T / 2;
        c.save();
        c.beginPath();
        c.rect(ix, iy, iw, ih);
        c.clip();
        // Lichtung: etwas hellere Wiese, weiche Mitte und ein ausgetretener Pfad, auf dem der Leuchtring läuft
        c.fillStyle = wcA(wcLight(f, 0.3), 0.12);
        c.fillRect(ix, iy, iw, ih);
        for (const [r, al] of [[104, 0.13], [66, 0.12]]) {
            c.fillStyle = wcA(wcLight(f, 0.45), al);
            c.beginPath();
            c.arc(cx, cy, r, 0, W_TAU);
            c.fill();
        }
        this._line(c, wcA(wcLight(f, 0.55), 0.32), 14);
        c.beginPath();
        c.arc(cx, cy, 130, 0, W_TAU);
        c.stroke();
        this._line(c, wcA(wcDark(f, 0.35), 0.3), 1.2);
        c.beginPath();
        c.arc(cx, cy, 137.5, 0, W_TAU);
        c.moveTo(cx + 122.5, cy);
        c.arc(cx, cy, 122.5, 0, W_TAU);
        c.stroke();
        // Blumenring innen am Pfad, Blumenbüsche in den Ecken, Pilze außen
        const cols = P.petals, fl = [];
        for (let k = 0; k < 44; k++) {
            const ang = k * W_TAU / 44 + (wHash(k, 5, 97) - 0.5) * 0.06, rr = 110 + (wHash(k, 9, 99) - 0.5) * 6;
            fl.push(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 4.4 + wHash(k, 3, 101) * 1.6, k % cols.length, ang);
        }
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const ex = sx > 0 ? ix + 24 : ix + iw - 24, ey = sy > 0 ? iy + 24 : iy + ih - 22;
            for (const [dx, dy, r] of [[0, 0, 6.5], [11, 3, 5], [3, 11, 5], [13, 14, 4], [-3, -4, 4]]) {
                fl.push(ex + dx * sx, ey + dy * sy, r, Math.floor(wHash(ex + dx, ey + dy, 103) * cols.length), wHash(dx, dy, 105) * 1.26);
            }
        }
        c.fillStyle = wcDark(f, 0.3);
        c.beginPath();
        for (let i = 0; i < fl.length; i += 5) {
            for (const d of [0.7, -0.9]) {
                const a2 = fl[i + 4] + d, lx = fl[i] + Math.cos(a2) * fl[i + 2] * 1.1, ly = fl[i + 1] + Math.sin(a2) * fl[i + 2] * 1.1;
                c.moveTo(lx + Math.cos(a2) * 3.8, ly + Math.sin(a2) * 3.8);
                c.ellipse(lx, ly, 3.8, 1.6, a2, 0, W_TAU);
            }
        }
        c.fill();
        this._petalPass(c, fl, cols);
        for (let k = 0; k < 16; k++) {
            const ang = (k + 0.5) * W_TAU / 16, mx = cx + Math.cos(ang) * 152, my = cy + Math.sin(ang) * 152;
            if (my < iy + 10 || my > iy + ih - 8) continue;
            this.decoItem(c, P, null, 'mushroom', mx, my, wRng(k * 7 + 3));
        }
        // Schmetterlings-Wappen in der Mitte
        for (const [cc, al, o] of [[wcDark(a, 0.35), 0.45, 1.2], [a, 0.5, 0]]) {
            c.fillStyle = wcA(cc, al);
            c.beginPath();
            for (const [dx, dy, rx, ry, rot] of [[-17, -9, 18, 13, -0.5], [17, -9, 18, 13, 0.5], [-13, 12, 12, 9, 0.45], [13, 12, 12, 9, -0.45]]) {
                c.moveTo(cx + dx + o + Math.cos(rot) * rx, cy + dy + o + Math.sin(rot) * rx);
                c.ellipse(cx + dx + o, cy + dy + o, rx, ry, rot, 0, W_TAU);
            }
            c.fill();
        }
        c.fillStyle = wcA('#ffffff', 0.4);
        c.beginPath();
        for (const [dx, dy, r] of [[-19, -10, 6], [19, -10, 6], [-14, 13, 3.8], [14, 13, 3.8]]) this._dot(c, cx + dx, cy + dy, r);
        c.fill();
        c.fillStyle = wcA(wcDark(a, 0.65), 0.55);
        c.beginPath();
        c.ellipse(cx, cy + 1, 3, 15, 0, 0, W_TAU);
        c.fill();
        this._line(c, wcA(wcDark(a, 0.65), 0.55), 1.5);
        c.beginPath();
        c.moveTo(cx - 1, cy - 13); c.quadraticCurveTo(cx - 5, cy - 23, cx - 11, cy - 26);
        c.moveTo(cx + 1, cy - 13); c.quadraticCurveTo(cx + 5, cy - 23, cx + 11, cy - 26);
        c.stroke();
        c.restore();
    },

    // Drachenberg: das große Nest des Drachenvaters – Ring aus geflochtenen Ästen mit Eiern am Rand, Stroh,
    // überall Gold und in der Mitte das Wappen der drei Elemente (Feuer, Eis, Diamant)
    _nestArena(w, c, P) {
        const T = TILE_SIZE, a = P.arena || P.accent;
        const ix = (w.width - 13) * T, iy = (w.height - 11) * T, iw = 11 * T, ih = 9 * T;
        const cx = (w.width - 8) * T + T / 2, cy = (w.height - 7) * T + T / 2;
        c.save();
        c.beginPath();
        c.rect(ix, iy, iw, ih);
        c.clip();
        for (const [r, al] of [[152, 0.06], [104, 0.08]]) {
            c.fillStyle = wcA('#ffb03a', al);
            c.beginPath();
            c.arc(cx, cy, r, 0, W_TAU);
            c.fill();
        }
        // Stroh im Nest
        c.fillStyle = wcA('#c8903a', 0.2);
        c.beginPath();
        c.arc(cx, cy, 106, 0, W_TAU);
        c.fill();
        for (const [col, sd] of [[wcA('#8a5a2a', 0.35), 11], [wcA('#f0c870', 0.4), 13]]) {
            this._line(c, col, 1);
            c.beginPath();
            wScatter(ix, iy, iw, ih, 8, 0, sd, (px, py, r) => {
                if ((px - cx) * (px - cx) + (py - cy) * (py - cy) > 98 * 98) return;
                const an = r * 9, l = 2.5 + r * 3;
                c.moveTo(px - Math.cos(an) * l, py - Math.sin(an) * l);
                c.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l);
            });
            c.stroke();
        }
        // Gold überall: im Nest um das Wappen herum dicht, außerhalb des Rings lockerer
        const coins = [];
        wScatter(ix, iy, iw, ih, 15, 0, 17, (px, py, r) => {
            const d = Math.hypot(px - cx, py - cy);
            if (!((d > 46 && d < 98 && r < 0.55) || (d > 128 && r < 0.3))) return;
            coins.push(px, py, (r - 0.3) * 2);
            if (r < 0.25) coins.push(px + 3.4, py + 1.2, r * 2);
        });
        this._coinPass(c, coins);
        // Ring aus geflochtenen Ästen (der Leuchtring läuft knapp außen herum)
        this._line(c, wcA('#2a1608', 0.4), 26);
        c.beginPath();
        c.arc(cx + 2, cy + 3, 112, 0, W_TAU);
        c.stroke();
        this._line(c, '#4a2a12', 18);
        c.beginPath();
        c.arc(cx, cy, 112, 0, W_TAU);
        c.stroke();
        for (const [col, lw, sd] of [['#2e1a0a', 3.4, 21], ['#7a4a22', 2.6, 23], ['#b07a3e', 1.4, 25]]) {
            this._line(c, col, lw);
            c.beginPath();
            for (let k = 0; k < 110; k++) {
                const an = k * W_TAU / 110 + (wHash(k, sd, 27) - 0.5) * 0.1;
                const r1 = 112 + (wHash(k, sd, 29) - 0.5) * 18, r2 = 112 + (wHash(sd, k, 31) - 0.5) * 18, rc = 112 + (wHash(k, k, sd) - 0.5) * 24;
                c.moveTo(cx + Math.cos(an - 0.17) * r1, cy + Math.sin(an - 0.17) * r1);
                c.quadraticCurveTo(cx + Math.cos(an) * rc, cy + Math.sin(an) * rc, cx + Math.cos(an + 0.17) * r2, cy + Math.sin(an + 0.17) * r2);
            }
            c.stroke();
        }
        this._line(c, '#8a5a2a', 1.2);
        c.beginPath();
        for (let k = 0; k < 26; k++) {
            const an = k * W_TAU / 26 + wHash(k, 3, 33), out = k & 1 ? 1 : -1, r0 = 112 + out * 9;
            c.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0);
            c.lineTo(cx + Math.cos(an + 0.05 * out) * (r0 + out * 7), cy + Math.sin(an + 0.05 * out) * (r0 + out * 7));
        }
        c.stroke();
        // Eier am Nestrand
        for (let k = 0; k < 7; k++) {
            const an = k * W_TAU / 7 - Math.PI / 2 + 0.35;
            this._egg(c, P, cx + Math.cos(an) * 110, cy + Math.sin(an) * 104, 1.5, k, (wHash(k, 7, 35) - 0.5) * 0.5);
        }
        // Wappen der drei Elemente
        c.fillStyle = wcA('#2a1020', 0.35);
        c.beginPath();
        c.arc(cx, cy, 32, 0, W_TAU);
        c.fill();
        this._line(c, wcA(a, 0.65), 3);
        c.beginPath();
        c.arc(cx, cy, 32, 0, W_TAU);
        c.stroke();
        const sym = (k, sx, sy) => {
            if (k === 0) {
                // Feuer
                for (const [col, s] of [['#ff5a2a', 1], ['#ffc23a', 0.55]]) {
                    c.fillStyle = wcA(col, 0.85);
                    c.beginPath();
                    c.moveTo(sx, sy - 7.5 * s);
                    c.quadraticCurveTo(sx + 5.5 * s, sy + 0.5 * s, sx, sy + 5 * s);
                    c.quadraticCurveTo(sx - 5.5 * s, sy + 0.5 * s, sx, sy - 7.5 * s);
                    c.fill();
                }
            } else if (k === 1) {
                // Eis
                this._line(c, wcA('#aeeaff', 0.9), 1.8);
                c.beginPath();
                for (let i = 0; i < 3; i++) {
                    const an = i * Math.PI / 3;
                    c.moveTo(sx - Math.cos(an) * 6, sy - Math.sin(an) * 6);
                    c.lineTo(sx + Math.cos(an) * 6, sy + Math.sin(an) * 6);
                }
                c.stroke();
            } else {
                // Diamant
                c.fillStyle = wcA('#c77dff', 0.9);
                c.beginPath();
                c.moveTo(sx, sy - 6.5); c.lineTo(sx + 5, sy - 1.5); c.lineTo(sx, sy + 6); c.lineTo(sx - 5, sy - 1.5); c.closePath();
                c.fill();
                c.fillStyle = wcA('#f0d8ff', 0.9);
                c.beginPath();
                c.moveTo(sx, sy - 6.5); c.lineTo(sx - 5, sy - 1.5); c.lineTo(sx, sy - 0.5); c.closePath();
                c.fill();
            }
        };
        for (let k = 0; k < 3; k++) {
            const an = -Math.PI / 2 + k * W_TAU / 3;
            sym(k, cx + Math.cos(an) * 16, cy + Math.sin(an) * 16);
        }
        c.restore();
    },

    // Flach liegende Goldmünzen (x, y, Drehung je 3 Einträge) in vier Füllaufrufen
    _coinPass(c, cs) {
        for (const [col, ox, oy, rx, ry] of [['rgba(30,8,20,0.3)', 0.6, 1.1, 2.7, 1.8], ['#9a5c12', 0.3, 0.5, 2.6, 1.7], ['#f2b72e', 0, 0, 2.3, 1.5], ['#ffe58a', -0.6, -0.4, 1.1, 0.6]]) {
            c.fillStyle = col;
            c.beginPath();
            for (let i = 0; i < cs.length; i += 3) {
                c.moveTo(cs[i] + ox + rx * Math.cos(cs[i + 2]), cs[i + 1] + oy + rx * Math.sin(cs[i + 2]));
                c.ellipse(cs[i] + ox, cs[i + 1] + oy, rx, ry, cs[i + 2], 0, W_TAU);
            }
            c.fill();
        }
    },

    _carpet(c, P, x, y, h) {
        const cx = x + 16;
        c.fillStyle = 'rgba(20,6,30,0.25)';
        c.fillRect(cx - 12, y + 2, 25, h);
        c.fillStyle = '#c8324a';
        c.fillRect(cx - 12, y, 24, h);
        c.fillStyle = '#e04a5e';
        c.fillRect(cx - 12, y, 24, 2);
        c.fillStyle = '#ffd23f';
        c.fillRect(cx - 10, y + 3, 2, h - 3);
        c.fillRect(cx + 8, y + 3, 2, h - 3);
        c.beginPath();
        for (let k = y + 12; k < y + h - 6; k += 18) {
            c.moveTo(cx, k - 5); c.lineTo(cx + 4, k); c.lineTo(cx, k + 5); c.lineTo(cx - 4, k); c.closePath();
        }
        c.fill();
        c.fillStyle = '#ffe89a';
        for (let k = cx - 11; k < cx + 12; k += 3) c.fillRect(k, y - 2, 1.4, 3);
    },

    // ── Wasser (und Lava, Schleim, Leere …): Becken mit Uferkante oben ──
    water(w, c, P, b, x, y, seed) {
        const T = TILE_SIZE, px = x * T, py = y * T;
        const is = (tx, ty) => w._tileAt(tx, ty) === TILE_WATER;
        const u = is(x, y - 1), d = is(x, y + 1), l = is(x - 1, y), r = is(x + 1, y);
        const [deep, mid, light] = P.wc;
        const kind = P.water;
        const rad = [!u && !l ? 8 : 0, !u && !r ? 8 : 0, !d && !r ? 8 : 0, !d && !l ? 8 : 0];
        // Zu Nachbarbecken leicht überlappen, sonst schimmert an der Kachelgrenze der Boden durch
        const bx0 = l ? px - 0.6 : px + 1, bx1 = r ? px + T + 0.6 : px + T - 1;
        const by0 = u ? py - 0.6 : py + 1, by1 = d ? py + T + 0.6 : py + T - 1;
        c.save();
        c.beginPath();
        wRound(c, bx0, by0, bx1 - bx0, by1 - by0, rad);
        c.clip();
        c.fillStyle = mid;
        c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
        const rnd = wRng(Math.floor(wHash(x, y, seed + 201) * 1e9));
        // Farbflecken im Becken
        c.fillStyle = wcA(deep, 0.55);
        c.beginPath();
        for (let k = 0; k < 3; k++) {
            const ex = px + 4 + rnd() * 24, ey = py + 6 + rnd() * 22, er = 4 + rnd() * 6;
            c.moveTo(ex + er, ey);
            c.ellipse(ex, ey, er, er * 0.7, 0, 0, W_TAU);
        }
        c.fill();
        // Ufer oben: Kante des Bodens fällt ins Becken ab
        if (!u) {
            c.fillStyle = wcDark(kind === 'lava' ? '#5a2030' : P.floor[0], 0.42);
            c.fillRect(px, py, T, 6);
            c.fillStyle = wcA(deep, 0.75);
            c.fillRect(px, py + 6, T, 4);
        }
        if (kind === 'void' || kind === 'plasma') {
            c.fillStyle = wcA('#ffffff', 0.85);
            for (let k = 0; k < 4; k++) c.fillRect(px + 3 + rnd() * 26, py + 9 + rnd() * 20, 1.3, 1.3);
        } else if (kind === 'oil') {
            const cols = ['#ff6ad5', '#ffd23f', '#5affa0', '#5ab4ff'];
            for (let k = 0; k < 4; k++) {
                this._line(c, wcA(cols[k], 0.35), 1.4);
                c.beginPath();
                c.arc(px + 14 + rnd() * 4, py + 18 + rnd() * 4, 5 + k * 2.2, Math.PI * 1.1, Math.PI * 1.9);
                c.stroke();
            }
        } else if (kind === 'pixel') {
            c.fillStyle = wcA(light, 0.6);
            for (let k = 0; k < 3; k++) c.fillRect(px + 4 + Math.floor(rnd() * 5) * 4, py + 12 + Math.floor(rnd() * 4) * 5, 8, 2);
        } else if (P.floes && rnd() < 0.5) {
            c.fillStyle = '#eef8ff';
            c.beginPath();
            const fx = px + 8 + rnd() * 12, fy = py + 14 + rnd() * 8;
            c.moveTo(fx, fy); c.lineTo(fx + 9, fy - 2); c.lineTo(fx + 12, fy + 5); c.lineTo(fx + 3, fy + 8); c.closePath();
            c.fill();
            c.fillStyle = 'rgba(40,90,160,0.35)';
            c.fillRect(fx + 2, fy + 7, 9, 1.5);
        } else if (P.lily && rnd() < 0.55) {
            const lx = px + 9 + rnd() * 14, ly = py + 14 + rnd() * 10;
            c.fillStyle = '#3f9a3a';
            c.beginPath();
            c.moveTo(lx, ly);
            c.arc(lx, ly, 5.5, 0.4, W_TAU - 0.1);
            c.closePath();
            c.fill();
            c.fillStyle = '#ff9ad0';
            c.beginPath();
            c.arc(lx - 1, ly - 1, 1.8, 0, W_TAU);
            c.fill();
        }
        c.restore();
        // Schaum/Lichtkante an den Ufern
        this._line(c, wcA(light, kind === 'lava' ? 0.9 : 0.6), 1.4);
        c.beginPath();
        if (!u) { c.moveTo(px + (l ? 0 : 5), py + 10.5); c.lineTo(px + T - (r ? 0 : 5), py + 10.5); }
        if (!d) { c.moveTo(px + (l ? 0 : 6), py + T - 2.5); c.lineTo(px + T - (r ? 0 : 6), py + T - 2.5); }
        if (!l) { c.moveTo(px + 2.5, py + (u ? 0 : 12)); c.lineTo(px + 2.5, py + T - (d ? 0 : 7)); }
        if (!r) { c.moveTo(px + T - 2.5, py + (u ? 0 : 12)); c.lineTo(px + T - 2.5, py + T - (d ? 0 : 7)); }
        c.stroke();
        b.anim.push({ k: 'water', px: px + 16, py: py + 16, x, y, top: !u, ph: wHash(x, y, seed + 5) * 6 });
        if (kind === 'lava' || kind === 'goo' || kind === 'plasma' || kind === 'time') {
            // poolGlow = [Radius, Stärke] (dunkle Welten: kleiner, sonst überstrahlt das Becken mit dem Lichtkreis)
            const pg = P.poolGlow || [26, 0.22];
            b.anim.push({ k: 'glow', px: px + 16, py: py + 18, r: pg[0], col: light, ph: wHash(x, y, 9) * 6, light: true, a: pg[1] });
        }
    },

    _inArena(w, x, y) {
        return w._hasArena() && x >= w.width - 13 && x <= w.width - 3 && y >= w.height - 11 && y <= w.height - 3;
    },

    _onCarpet(w, x, y) {
        for (const d of w.bossDoorTiles) if (x === d.x && y >= d.y - 4 && y < d.y) return true;
        return false;
    },

    // ── Deko auf Bodenkacheln (deterministisch je Kachel, rein optisch) ──
    deco(w, c, P, b, x, y, seed) {
        const T = TILE_SIZE, px = x * T, py = y * T;
        const h0 = wHash(x, y, seed + 101);
        if (P.cobweb && h0 < 0.5 && w._raised(x - 1, y) && w._raised(x, y - 1)) {
            this._line(c, 'rgba(235,228,255,0.45)', 0.8);
            c.beginPath();
            for (let k = 0; k < 4; k++) {
                const a = k * Math.PI / 6;
                c.moveTo(px, py);
                c.lineTo(px + Math.cos(a) * 15, py + Math.sin(a) * 15);
            }
            for (const r of [6, 10.5, 14]) {
                c.moveTo(px + r, py);
                for (let k = 1; k <= 3; k++) {
                    const a = k * Math.PI / 6;
                    c.quadraticCurveTo(px + Math.cos(a - 0.26) * r * 0.8, py + Math.sin(a - 0.26) * r * 0.8, px + Math.cos(a) * r, py + Math.sin(a) * r);
                }
            }
            c.stroke();
            return;
        }
        if (h0 > P.rate || this._inArena(w, x, y) || this._onCarpet(w, x, y)) return;
        const list = this._decoList(w, P, x, y);
        let tot = 0;
        for (const d of list) tot += d[1];
        let pick = wHash(x, y, seed + 103) * tot, kind = list[0][0];
        for (const d of list) {
            if (pick < d[1]) { kind = d[0]; break; }
            pick -= d[1];
        }
        const rnd = wRng(Math.floor(wHash(x, y, seed + 107) * 4294967295));
        this.decoItem(c, P, b, kind, px + 8 + rnd() * 16, py + 9 + rnd() * 15, rnd);
    },

    _glow(b, px, py, r, col, a, light) {
        b.anim.push({ k: 'glow', px, py, r, col, a: a || 0.35, ph: (px * 0.37 + py * 0.11) % 6.28, light: !!light });
    },

    _dot(c, x, y, r) {
        c.moveTo(x + r, y);
        c.arc(x, y, r, 0, W_TAU);
    },

    decoItem(c, P, b, kind, cx, cy, rnd) {
        const f = P.floor[0];
        const dk = wcDark(f, 0.4), lt = wcLight(f, 0.3);
        switch (kind) {
            case 'tuft': case 'reed': {
                const reed = kind === 'reed';
                const g1 = reed ? '#3f7a2a' : wcDark(f, 0.22), g2 = reed ? '#7fbf4a' : wcLight(f, 0.28);
                for (const [col, lw, off] of [[g1, 1.8, 0], [g2, 1, -0.5]]) {
                    this._line(c, col, lw);
                    c.beginPath();
                    for (let i = -1.5; i <= 1.5; i++) {
                        const hgt = (reed ? 9 : 5) - Math.abs(i) * 1.2;
                        c.moveTo(cx + i * 1.8 + off, cy + 3);
                        c.quadraticCurveTo(cx + i * 2.2 + off, cy - hgt * 0.5, cx + i * 3.4 + off, cy - hgt);
                    }
                    c.stroke();
                }
                if (reed) {
                    c.fillStyle = '#b8652e';
                    c.beginPath();
                    c.ellipse(cx + 0.5, cy - 8, 1.6, 3.2, 0.1, 0, W_TAU);
                    c.fill();
                }
                break;
            }
            case 'clover': {
                c.fillStyle = wcLight(f, 0.22);
                c.beginPath();
                for (let k = 0; k < 3; k++) this._dot(c, cx + Math.cos(k * 2.1 - 1.6) * 2.2, cy + Math.sin(k * 2.1 - 1.6) * 2.2, 2);
                c.fill();
                c.fillStyle = wcA('#ffffff', 0.25);
                c.beginPath();
                this._dot(c, cx - 0.8, cy - 2.5, 0.8);
                c.fill();
                break;
            }
            case 'flower': {
                const cols = P.flowers || ['#ffffff', '#ffe066'];
                c.fillStyle = cols[Math.floor(rnd() * cols.length)];
                c.beginPath();
                for (let k = 0; k < 5; k++) this._dot(c, cx + Math.cos(k * 1.2566) * 2.3, cy + Math.sin(k * 1.2566) * 2.3, 1.8);
                c.fill();
                c.fillStyle = '#ffc53d';
                c.beginPath();
                this._dot(c, cx, cy, 1.3);
                c.fill();
                break;
            }
            case 'cone': {
                c.fillStyle = 'rgba(10,30,10,0.25)';
                c.beginPath();
                c.ellipse(cx + 1, cy + 5, 6, 2.2, 0, 0, W_TAU);
                c.fill();
                c.fillStyle = '#ff7a1f';
                c.beginPath();
                c.moveTo(cx, cy - 7); c.lineTo(cx + 4.5, cy + 4); c.lineTo(cx - 4.5, cy + 4); c.closePath();
                c.fill();
                c.fillStyle = '#ffffff';
                c.fillRect(cx - 2.6, cy - 1.5, 5.2, 2);
                c.fillStyle = '#c24a12';
                c.fillRect(cx - 5.5, cy + 3.5, 11, 2);
                break;
            }
            case 'ball': {
                c.fillStyle = '#ffffff';
                c.strokeStyle = '#2a2a3a';
                c.lineWidth = 0.9;
                c.beginPath();
                c.arc(cx, cy, 3.6, 0, W_TAU);
                c.fill();
                c.stroke();
                c.fillStyle = '#2a2a3a';
                c.beginPath();
                this._dot(c, cx, cy, 1.1);
                this._dot(c, cx + 2.3, cy - 1.8, 0.8);
                this._dot(c, cx - 2.3, cy + 1.6, 0.8);
                c.fill();
                break;
            }
            case 'crack': case 'icecrack': case 'glowcrack': {
                const glowing = kind === 'glowcrack';
                const col = kind === 'icecrack' ? 'rgba(255,255,255,0.8)' : (glowing ? '#ffb347' : wcA(dk, 0.75));
                const pts = [[cx - 6, cy - 3]];
                for (let k = 0; k < 3; k++) pts.push([pts[k][0] + 3 + rnd() * 3, pts[k][1] + (rnd() - 0.35) * 6]);
                if (kind === 'icecrack') {
                    this._line(c, 'rgba(60,120,190,0.5)', 1.6);
                    c.beginPath();
                    pts.forEach((p, i) => i ? c.lineTo(p[0] + 0.6, p[1] + 0.6) : c.moveTo(p[0] + 0.6, p[1] + 0.6));
                    c.stroke();
                }
                this._line(c, col, glowing ? 1.6 : 1.2);
                c.beginPath();
                pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
                c.moveTo(pts[1][0], pts[1][1]);
                c.lineTo(pts[1][0] + 1, pts[1][1] + 4);
                c.stroke();
                if (glowing) this._glow(b, cx, cy, 11, '#ff7a2b', 0.35, true);
                break;
            }
            case 'pebble': case 'obsidian': case 'ash': {
                const n = 2 + Math.floor(rnd() * 2);
                for (let k = 0; k < n; k++) {
                    const ex = cx + (rnd() - 0.5) * 10, ey = cy + (rnd() - 0.5) * 8, er = 1.6 + rnd() * 2;
                    const col = kind === 'obsidian' ? '#2a1438' : (kind === 'ash' ? '#8a7a8e' : wcMix(f, k & 1 ? '#ffffff' : '#9aa0b8', 0.35));
                    c.fillStyle = wcDark(col, 0.35);
                    c.beginPath();
                    c.ellipse(ex + 0.5, ey + 0.6, er, er * 0.75, 0, 0, W_TAU);
                    c.fill();
                    c.fillStyle = col;
                    c.beginPath();
                    c.ellipse(ex, ey, er, er * 0.72, 0, 0, W_TAU);
                    c.fill();
                    c.fillStyle = kind === 'obsidian' ? 'rgba(200,150,255,0.7)' : 'rgba(255,255,255,0.35)';
                    c.beginPath();
                    this._dot(c, ex - er * 0.35, ey - er * 0.3, er * 0.3);
                    c.fill();
                }
                break;
            }
            case 'star': case 'sparkle': case 'pixel': {
                const col = kind === 'star' ? wcA(P.accent, 0.55) : (kind === 'pixel' ? ['#4cf0ff', '#ff4fd0', '#ffd23f', '#7dff6a'][Math.floor(rnd() * 4)] : 'rgba(255,255,255,0.9)');
                c.fillStyle = col;
                if (kind === 'pixel') {
                    c.fillRect(cx - 1, cy - 4, 2, 8);
                    c.fillRect(cx - 4, cy - 1, 8, 2);
                    break;
                }
                const s = kind === 'star' ? 3.5 : 2.6;
                c.beginPath();
                c.moveTo(cx, cy - s); c.quadraticCurveTo(cx, cy, cx + s, cy); c.quadraticCurveTo(cx, cy, cx, cy + s);
                c.quadraticCurveTo(cx, cy, cx - s, cy); c.quadraticCurveTo(cx, cy, cx, cy - s);
                c.fill();
                break;
            }
            case 'candle': {
                c.fillStyle = '#f3e6c8';
                c.fillRect(cx - 1.8, cy - 4, 3.6, 7);
                c.fillStyle = '#d8c49a';
                c.fillRect(cx + 0.8, cy - 4, 1, 7);
                c.fillStyle = '#ffb02e';
                c.beginPath();
                c.ellipse(cx, cy - 6.3, 1.5, 2.4, 0, 0, W_TAU);
                c.fill();
                c.fillStyle = '#fff3b0';
                c.beginPath();
                this._dot(c, cx, cy - 5.8, 0.8);
                c.fill();
                this._glow(b, cx, cy - 6, 12, '#ffb347', 0.45, true);
                break;
            }
            case 'bone': this._bone(c, cx, cy, 6, rnd() * 3, P.bone); break;
            case 'skullsmall': this._skullShape(c, cx, cy, 4.2, P.bone, rnd() - 0.5); break;
            case 'bolt': {
                c.fillStyle = '#5d6a86';
                c.beginPath();
                for (let k = 0; k < 6; k++) c.lineTo(cx + 0.5 + Math.cos(k * 1.047) * 3.4, cy + 0.6 + Math.sin(k * 1.047) * 3.4);
                c.fill();
                c.fillStyle = '#b7c3da';
                c.beginPath();
                for (let k = 0; k < 6; k++) c.lineTo(cx + Math.cos(k * 1.047) * 3.2, cy + Math.sin(k * 1.047) * 3.2);
                c.fill();
                c.fillStyle = '#4d5670';
                c.beginPath();
                this._dot(c, cx, cy, 1.3);
                c.fill();
                break;
            }
            case 'oil': case 'puddle': {
                const oil = kind === 'oil';
                c.fillStyle = oil ? 'rgba(20,24,40,0.55)' : (P.pud ? wcA(P.pud, 0.8) : wcA(wcDark(f, 0.35), 0.6));
                c.beginPath();
                c.ellipse(cx, cy, 7 + rnd() * 3, 3.6 + rnd() * 1.5, rnd() * 0.5, 0, W_TAU);
                c.fill();
                this._line(c, oil ? 'rgba(255,120,220,0.5)' : wcA(P.pud ? wcLight(P.pud, 0.5) : lt, 0.6), 1);
                c.beginPath();
                c.ellipse(cx - 1, cy - 0.5, 4, 1.8, 0, Math.PI * 1.1, Math.PI * 1.8);
                c.stroke();
                if (oil) {
                    this._line(c, 'rgba(120,255,200,0.4)', 1);
                    c.beginPath();
                    c.ellipse(cx, cy, 5.5, 2.5, 0, Math.PI * 1.15, Math.PI * 1.7);
                    c.stroke();
                }
                break;
            }
            case 'grate': {
                c.fillStyle = '#28324a';
                c.fillRect(cx - 6, cy - 4, 12, 8);
                c.fillStyle = '#6a7894';
                for (let k = -4; k <= 4; k += 2.6) c.fillRect(cx + k - 0.5, cy - 3, 1, 6);
                c.strokeStyle = '#8a98b4';
                c.lineWidth = 0.8;
                c.strokeRect(cx - 6, cy - 4, 12, 8);
                break;
            }
            case 'hazard': case 'arrow': {
                c.save();
                c.translate(cx, cy);
                c.rotate(Math.floor(rnd() * 4) * Math.PI / 2);
                c.fillStyle = 'rgba(255,210,63,0.55)';
                if (kind === 'arrow') {
                    c.beginPath();
                    c.moveTo(-5, -1.5); c.lineTo(1, -1.5); c.lineTo(1, -4.5); c.lineTo(6, 0);
                    c.lineTo(1, 4.5); c.lineTo(1, 1.5); c.lineTo(-5, 1.5); c.closePath();
                    c.fill();
                } else {
                    c.fillRect(-6, -6, 12, 12);
                    c.fillStyle = 'rgba(40,36,60,0.6)';
                    c.beginPath();
                    for (let k = -8; k < 8; k += 4.5) { c.moveTo(k, -6); c.lineTo(k + 2.2, -6); c.lineTo(k + 2.2 + 12, 6); c.lineTo(k + 12, 6); c.closePath(); }
                    c.save();
                    c.clip();
                    c.fillRect(-6, -6, 12, 12);
                    c.restore();
                }
                c.restore();
                break;
            }
            case 'splat': case 'bubble': {
                const col = kind === 'splat' ? (P.water === 'goo' ? P.wc[1] : '#9dff5a') : wcLight(f, 0.45);
                if (kind === 'splat') {
                    c.fillStyle = wcA(col, 0.75);
                    c.beginPath();
                    c.ellipse(cx, cy, 5 + rnd() * 2, 3.5, rnd(), 0, W_TAU);
                    for (let k = 0; k < 3; k++) this._dot(c, cx + (rnd() - 0.5) * 16, cy + (rnd() - 0.5) * 10, 1 + rnd() * 1.3);
                    c.fill();
                    c.fillStyle = 'rgba(255,255,255,0.55)';
                    c.beginPath();
                    this._dot(c, cx - 2, cy - 1.2, 1);
                    c.fill();
                } else {
                    this._line(c, wcA(col, 0.7), 0.9);
                    c.beginPath();
                    for (let k = 0; k < 3; k++) this._dot(c, cx + (rnd() - 0.5) * 9, cy + (rnd() - 0.5) * 7, 1.2 + rnd() * 1.8);
                    c.stroke();
                }
                break;
            }
            case 'chain': {
                this._line(c, '#8a8aa4', 1.2);
                c.beginPath();
                for (let k = 0; k < 3; k++) c.ellipse(cx - 5 + k * 4.2, cy + (k & 1) * 0.8, 2.4, 1.5, 0.2, 0, W_TAU);
                c.stroke();
                break;
            }
            case 'mushroom': case 'glowshroom': {
                const glow = kind === 'glowshroom';
                const cap = glow ? '#5ff0ff' : ['#ff4d5a', '#ff9a2e', '#c86bff', '#ff6fb5'][Math.floor(rnd() * 4)];
                c.fillStyle = '#f6ecd6';
                c.fillRect(cx - 1.2, cy - 1, 2.4, 4.5);
                c.fillStyle = wcDark(cap, 0.3);
                c.beginPath();
                c.ellipse(cx, cy - 1, 4.6, 3.2, 0, Math.PI, 0);
                c.fill();
                c.fillStyle = cap;
                c.beginPath();
                c.ellipse(cx, cy - 1.4, 4.2, 3, 0, Math.PI, 0);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.9)';
                c.beginPath();
                this._dot(c, cx - 1.6, cy - 2.8, 0.9);
                this._dot(c, cx + 1.4, cy - 3.2, 0.7);
                c.fill();
                if (glow) this._glow(b, cx, cy - 2, 12, '#5ff0ff', 0.4, true);
                break;
            }
            case 'leaf': case 'petal': {
                const n = kind === 'petal' ? 3 : 1;
                for (let k = 0; k < n; k++) {
                    const col = kind === 'petal' ? ['#ffb3cf', '#ff8fb8', '#ffd6e6'][k] : ['#f0a23a', '#e8643a', '#ffd23f'][Math.floor(rnd() * 3)];
                    const ex = cx + (k ? (rnd() - 0.5) * 12 : 0), ey = cy + (k ? (rnd() - 0.5) * 9 : 0), a = rnd() * 3;
                    c.fillStyle = col;
                    c.beginPath();
                    c.ellipse(ex, ey, kind === 'petal' ? 2.2 : 3.8, kind === 'petal' ? 1.3 : 2, a, 0, W_TAU);
                    c.fill();
                    if (kind === 'leaf') {
                        this._line(c, wcDark(col, 0.3), 0.6);
                        c.beginPath();
                        c.moveTo(ex - Math.cos(a) * 3.4, ey - Math.sin(a) * 3.4);
                        c.lineTo(ex + Math.cos(a) * 3.4, ey + Math.sin(a) * 3.4);
                        c.stroke();
                    }
                }
                break;
            }
            case 'lily': {
                c.fillStyle = wcA('#1f5f58', 0.7);
                c.beginPath();
                c.ellipse(cx, cy, 8, 4.5, 0, 0, W_TAU);
                c.fill();
                c.fillStyle = '#4fae45';
                c.beginPath();
                c.moveTo(cx, cy);
                c.ellipse(cx, cy, 4.5, 3, 0, 0.5, W_TAU);
                c.closePath();
                c.fill();
                break;
            }
            case 'frog': {
                c.fillStyle = '#3f9a3a';
                c.beginPath();
                c.ellipse(cx, cy, 3.8, 3, 0, 0, W_TAU);
                this._dot(c, cx - 2, cy - 2.6, 1.5);
                this._dot(c, cx + 2, cy - 2.6, 1.5);
                c.fill();
                c.fillStyle = '#1b1b2a';
                c.beginPath();
                this._dot(c, cx - 2, cy - 2.8, 0.6);
                this._dot(c, cx + 2, cy - 2.8, 0.6);
                c.fill();
                c.fillStyle = '#9ce07a';
                c.beginPath();
                c.ellipse(cx, cy + 0.8, 2.2, 1.3, 0, 0, W_TAU);
                c.fill();
                break;
            }
            case 'firefly': case 'ember': {
                const col = kind === 'ember' ? '#ff8a2b' : '#eaff7a';
                c.fillStyle = col;
                c.beginPath();
                this._dot(c, cx, cy, 1.3);
                c.fill();
                this._glow(b, cx, cy, 9, col, 0.5, true);
                break;
            }
            case 'snowmound': case 'moss': {
                const col = kind === 'moss' ? '#5fbf4f' : '#f2fbff';
                c.fillStyle = kind === 'moss' ? 'rgba(20,50,20,0.25)' : 'rgba(60,110,170,0.25)';
                c.beginPath();
                c.ellipse(cx + 1, cy + 2, 7, 3, 0, 0, W_TAU);
                c.fill();
                c.fillStyle = col;
                c.beginPath();
                this._dot(c, cx - 3, cy, 3);
                this._dot(c, cx + 2, cy - 1, 3.6);
                this._dot(c, cx + 5, cy + 1, 2.4);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.45)';
                c.beginPath();
                this._dot(c, cx + 1, cy - 2.5, 1.3);
                c.fill();
                break;
            }
            case 'fish': {
                c.fillStyle = '#5aa8ff';
                c.beginPath();
                c.ellipse(cx, cy, 4, 2.2, 0, 0, W_TAU);
                c.moveTo(cx + 3, cy); c.lineTo(cx + 7, cy - 2.5); c.lineTo(cx + 7, cy + 2.5); c.closePath();
                c.fill();
                c.fillStyle = '#ffffff';
                c.beginPath();
                this._dot(c, cx - 2, cy - 0.5, 0.8);
                c.fill();
                break;
            }
            case 'rune': case 'crystal': {
                const col = P.accent;
                if (kind === 'rune') {
                    this._line(c, wcA(col, 0.65), 1.2);
                    c.beginPath();
                    c.arc(cx, cy, 6, 0, W_TAU);
                    c.moveTo(cx, cy - 4); c.lineTo(cx + 3.5, cy + 2.5); c.lineTo(cx - 3.5, cy + 2.5); c.closePath();
                    c.stroke();
                    this._glow(b, cx, cy, 13, col, 0.3, true);
                } else {
                    for (const [ox, h, wd] of [[-2.5, 7, 2.4], [1.5, 10, 2.8], [4.5, 6, 2]]) {
                        c.fillStyle = wcDark(col, 0.1);
                        c.beginPath();
                        c.moveTo(cx + ox - wd, cy + 2); c.lineTo(cx + ox, cy + 2 - h); c.lineTo(cx + ox + wd, cy + 2); c.closePath();
                        c.fill();
                        c.fillStyle = wcLight(col, 0.45);
                        c.beginPath();
                        c.moveTo(cx + ox - wd * 0.6, cy + 1); c.lineTo(cx + ox, cy + 2 - h); c.lineTo(cx + ox, cy + 1); c.closePath();
                        c.fill();
                    }
                    this._glow(b, cx + 1, cy - 3, 11, col, 0.35, true);
                }
                break;
            }
            case 'apple': {
                c.fillStyle = '#e8323c';
                c.beginPath();
                this._dot(c, cx, cy, 3.3);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.55)';
                c.beginPath();
                this._dot(c, cx - 1.2, cy - 1.2, 1);
                c.fill();
                c.fillStyle = '#3f9a3a';
                c.beginPath();
                c.ellipse(cx + 1.8, cy - 3.6, 1.8, 0.9, -0.5, 0, W_TAU);
                c.fill();
                break;
            }
            case 'butterfly': {
                const col = ['#ff8ad8', '#8ad8ff', '#ffd23f'][Math.floor(rnd() * 3)];
                c.fillStyle = col;
                c.beginPath();
                c.ellipse(cx - 2.4, cy - 1, 2.4, 1.8, -0.5, 0, W_TAU);
                c.ellipse(cx + 2.4, cy - 1, 2.4, 1.8, 0.5, 0, W_TAU);
                c.ellipse(cx - 1.8, cy + 1.6, 1.6, 1.2, 0.4, 0, W_TAU);
                c.ellipse(cx + 1.8, cy + 1.6, 1.6, 1.2, -0.4, 0, W_TAU);
                c.fill();
                c.fillStyle = '#2a1a3a';
                c.fillRect(cx - 0.5, cy - 2.5, 1, 5);
                break;
            }
            case 'coin': case 'heart': {
                c.fillStyle = kind === 'coin' ? '#ffd23f' : '#ff4d6d';
                if (kind === 'coin') {
                    c.fillRect(cx - 2, cy - 4, 4, 8);
                    c.fillRect(cx - 3.5, cy - 2.5, 7, 5);
                    c.fillStyle = '#fff3a0';
                    c.fillRect(cx - 1, cy - 2.5, 1.2, 4);
                } else {
                    c.fillRect(cx - 4, cy - 2, 3, 3);
                    c.fillRect(cx + 1, cy - 2, 3, 3);
                    c.fillRect(cx - 3, cy + 1, 6, 2);
                    c.fillRect(cx - 1.5, cy + 3, 3, 1.5);
                }
                break;
            }
            case 'crater': {
                c.fillStyle = wcA(dk, 0.5);
                c.beginPath();
                c.ellipse(cx, cy, 5.5, 3.8, 0, 0, W_TAU);
                c.fill();
                this._line(c, wcA(lt, 0.6), 1.2);
                c.beginPath();
                c.ellipse(cx, cy + 0.4, 5.5, 3.8, 0, 0.1, Math.PI - 0.1);
                c.stroke();
                break;
            }
            case 'cactus': {
                c.fillStyle = 'rgba(80,30,10,0.25)';
                c.beginPath();
                c.ellipse(cx + 2, cy + 5, 6, 2, 0, 0, W_TAU);
                c.fill();
                this._line(c, '#2f7a3a', 4.4);
                c.beginPath();
                c.moveTo(cx, cy + 5); c.lineTo(cx, cy - 6);
                c.moveTo(cx - 4, cy - 3); c.lineTo(cx - 4, cy); c.lineTo(cx, cy + 1);
                c.stroke();
                this._line(c, '#5fbf5a', 1.6);
                c.beginPath();
                c.moveTo(cx - 0.8, cy + 3); c.lineTo(cx - 0.8, cy - 5);
                c.stroke();
                c.fillStyle = '#ff7ab8';
                c.beginPath();
                this._dot(c, cx, cy - 7.5, 1.4);
                c.fill();
                break;
            }
            case 'fern': {
                const ang = rnd() * W_TAU;
                c.save();
                c.translate(cx, cy);
                c.rotate(ang);
                this._line(c, '#2f7a2a', 1);
                c.beginPath();
                c.moveTo(-7, 0); c.lineTo(7, 0);
                c.stroke();
                c.fillStyle = '#4fae3f';
                c.beginPath();
                for (let k = -5; k <= 5; k += 2.5) {
                    const l = 4 - Math.abs(k) * 0.4;
                    c.ellipse(k, -l * 0.5, 1, l * 0.55, 0.4, 0, W_TAU);
                    c.ellipse(k, l * 0.5, 1, l * 0.55, -0.4, 0, W_TAU);
                }
                c.fill();
                c.restore();
                break;
            }
            case 'footprint': {
                c.fillStyle = wcA(dk, 0.45);
                c.beginPath();
                c.ellipse(cx, cy + 2, 3.5, 3, 0, 0, W_TAU);
                for (const [ox, oy] of [[-4, -3], [0, -5], [4, -3]]) c.ellipse(cx + ox, cy + oy, 1.3, 2.4, ox * 0.12, 0, W_TAU);
                c.fill();
                break;
            }
            case 'gear': this._gear(c, cx, cy, 5.5, wcA('#ffd23f', 0.5), 8); break;
            case 'clockmark': {
                c.fillStyle = wcA('#ffd23f', 0.55);
                c.fillRect(cx - 5, cy - 3, 1.3, 6);
                c.fillRect(cx - 2.5, cy - 3, 1.3, 6);
                c.fillRect(cx, cy - 3, 5.5, 1.1);
                c.fillRect(cx, cy + 2, 5.5, 1.1);
                c.fillRect(cx + 2.2, cy - 3, 1.1, 6);
                break;
            }
            case 'tire': {
                c.fillStyle = '#2b2b38';
                c.beginPath();
                c.arc(cx, cy, 5.5, 0, W_TAU);
                c.fill();
                c.fillStyle = '#8a8aa0';
                c.beginPath();
                c.arc(cx, cy, 2.4, 0, W_TAU);
                c.fill();
                this._line(c, '#44445a', 1);
                c.beginPath();
                c.arc(cx, cy, 4.2, 0, W_TAU);
                c.stroke();
                break;
            }
            case 'can': case 'cap': {
                const col = ['#e0453c', '#3c7ae0', '#3cb86a', '#f0c63c'][Math.floor(rnd() * 4)];
                if (kind === 'can') {
                    c.save();
                    c.translate(cx, cy);
                    c.rotate(rnd() * 3);
                    c.fillStyle = col;
                    c.fillRect(-4, -2, 8, 4);
                    c.fillStyle = '#d8dce6';
                    c.fillRect(3.2, -2, 1.3, 4);
                    c.fillStyle = 'rgba(255,255,255,0.45)';
                    c.fillRect(-3.5, -1.5, 6, 1);
                    c.restore();
                } else {
                    c.fillStyle = wcDark(col, 0.3);
                    c.beginPath();
                    this._dot(c, cx, cy, 2.6);
                    c.fill();
                    c.fillStyle = col;
                    c.beginPath();
                    this._dot(c, cx - 0.3, cy - 0.3, 2);
                    c.fill();
                }
                break;
            }
            case 'spring': {
                this._line(c, '#a8b4c8', 1.2);
                c.beginPath();
                c.moveTo(cx - 6, cy);
                for (let k = 0; k < 6; k++) c.lineTo(cx - 5 + k * 2, cy + (k & 1 ? 2.5 : -2.5));
                c.stroke();
                break;
            }
            // ── Zombie Academy ──
            case 'paper': {
                if (rnd() < 0.25) {
                    // zerknülltes Blatt
                    c.fillStyle = 'rgba(20,10,40,0.28)';
                    c.beginPath();
                    this._dot(c, cx + 0.8, cy + 1, 3.6);
                    c.fill();
                    c.fillStyle = '#f2eefc';
                    c.beginPath();
                    this._dot(c, cx, cy, 3.4);
                    c.fill();
                    this._line(c, 'rgba(120,110,170,0.65)', 0.7);
                    c.beginPath();
                    c.moveTo(cx - 2, cy - 1); c.lineTo(cx, cy + 0.5); c.lineTo(cx + 1.5, cy - 1.5);
                    c.moveTo(cx - 1, cy + 2); c.lineTo(cx + 1.8, cy + 1);
                    c.stroke();
                    break;
                }
                c.save();
                c.translate(cx, cy);
                c.rotate((rnd() - 0.5) * 1.4);
                c.fillStyle = 'rgba(20,10,40,0.28)';
                c.fillRect(-3.2, -4, 8, 10);
                c.fillStyle = '#f4f1ff';
                c.fillRect(-4, -5, 8, 10);
                c.fillStyle = '#8fb4ff';
                for (let k = 0; k < 4; k++) c.fillRect(-3, -2.6 + k * 2, 6.2, 0.5);
                c.fillStyle = '#ff7a8a';
                c.fillRect(-2.4, -5, 0.5, 10);
                c.restore();
                break;
            }
            case 'pencil': {
                c.save();
                c.translate(cx, cy);
                c.rotate(rnd() * Math.PI);
                c.fillStyle = 'rgba(20,10,40,0.28)';
                c.fillRect(-7, -0.2, 14, 2.4);
                c.fillStyle = '#ffc93c';
                c.fillRect(-5, -1.2, 9, 2.4);
                c.fillStyle = '#e39a22';
                c.fillRect(-5, 0.4, 9, 0.8);
                c.fillStyle = '#f2d4a8';
                c.beginPath(); c.moveTo(4, -1.2); c.lineTo(7.4, 0); c.lineTo(4, 1.2); c.closePath(); c.fill();
                c.fillStyle = '#3a3050';
                c.beginPath(); c.moveTo(6.2, -0.45); c.lineTo(7.4, 0); c.lineTo(6.2, 0.45); c.closePath(); c.fill();
                c.fillStyle = '#c8c8d8';
                c.fillRect(-6.4, -1.2, 1.4, 2.4);
                c.fillStyle = '#ff8fa8';
                c.fillRect(-7.6, -1.2, 1.2, 2.4);
                c.restore();
                break;
            }
            case 'book': {
                const col = ['#e0453c', '#3c7ae0', '#3cb86a', '#f0a63c', '#9a5ae0'][Math.floor(rnd() * 5)];
                c.save();
                c.translate(cx, cy);
                c.rotate((rnd() - 0.5) * 1.2);
                c.fillStyle = 'rgba(20,10,40,0.3)';
                c.fillRect(-4.6, -2.8, 11, 8.4);
                if (rnd() < 0.3) {
                    // aufgeschlagen
                    c.fillStyle = wcDark(col, 0.2);
                    c.fillRect(-6, -4.3, 12, 8.6);
                    c.fillStyle = '#f6f2ff';
                    c.fillRect(-5.4, -3.8, 5.1, 7.6);
                    c.fillRect(0.3, -3.8, 5.1, 7.6);
                    c.fillStyle = '#b8b0d0';
                    for (let k = 0; k < 3; k++) { c.fillRect(-4.6, -2.4 + k * 2, 3.6, 0.5); c.fillRect(1.1, -2.4 + k * 2, 3.6, 0.5); }
                } else {
                    c.fillStyle = '#f4ecd8';
                    c.fillRect(-4.5, -3.4, 9.6, 7.6);
                    c.fillStyle = col;
                    c.fillRect(-5, -4, 9, 7.2);
                    c.fillStyle = wcDark(col, 0.3);
                    c.fillRect(-5, -4, 1.6, 7.2);
                    c.fillStyle = 'rgba(255,255,255,0.55)';
                    c.fillRect(-1.8, -2.2, 4.4, 1.3);
                }
                c.restore();
                break;
            }
            case 'chalk': {
                // Kreidekritzelei auf dem Boden
                const v = Math.floor(rnd() * 5);
                this._line(c, ['rgba(255,255,255,0.5)', 'rgba(255,224,130,0.55)', 'rgba(255,170,215,0.55)', 'rgba(150,220,255,0.55)'][Math.floor(rnd() * 4)], 0.9);
                c.beginPath();
                if (v === 0) {
                    c.moveTo(cx + 5.5, cy);
                    c.arc(cx, cy, 5.5, 0, W_TAU);
                    c.moveTo(cx - 2, cy - 2); c.lineTo(cx - 2, cy - 0.8);
                    c.moveTo(cx + 2, cy - 2); c.lineTo(cx + 2, cy - 0.8);
                    c.moveTo(cx - 3, cy + 1.4); c.quadraticCurveTo(cx, cy + 4.2, cx + 3, cy + 1.4);
                } else if (v === 1) {
                    for (let k = 0; k <= 5; k++) {
                        const a = -Math.PI / 2 + k * 2 * W_TAU / 5;
                        if (k) c.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); else c.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
                    }
                } else if (v === 2) {
                    c.rect(cx - 3, cy - 7, 6, 4.6); c.rect(cx - 6, cy - 2.4, 6, 4.6); c.rect(cx, cy - 2.4, 6, 4.6); c.rect(cx - 3, cy + 2.2, 6, 4.6);
                } else if (v === 3) {
                    // Zombie-Gesicht mit Kreuzaugen und Naht-Mund
                    c.moveTo(cx + 5.5, cy);
                    c.arc(cx, cy, 5.5, 0, W_TAU);
                    c.moveTo(cx - 3, cy - 2.6); c.lineTo(cx - 1, cy - 0.6); c.moveTo(cx - 1, cy - 2.6); c.lineTo(cx - 3, cy - 0.6);
                    c.moveTo(cx + 1, cy - 2.6); c.lineTo(cx + 3, cy - 0.6); c.moveTo(cx + 3, cy - 2.6); c.lineTo(cx + 1, cy - 0.6);
                    c.moveTo(cx - 3, cy + 2.4); c.lineTo(cx + 3, cy + 2.4);
                    for (let k = -2; k <= 2; k += 2) { c.moveTo(cx + k, cy + 1.4); c.lineTo(cx + k, cy + 3.4); }
                } else {
                    c.moveTo(cx, cy + 5);
                    c.bezierCurveTo(cx - 7, cy, cx - 5, cy - 6, cx, cy - 2.4);
                    c.bezierCurveTo(cx + 5, cy - 6, cx + 7, cy, cx, cy + 5);
                }
                c.stroke();
                break;
            }
            case 'sneaker': {
                // verlorener Turnschuh
                const col = ['#ff5a5a', '#4cb2ff', '#9aff5a'][Math.floor(rnd() * 3)];
                c.save();
                c.translate(cx, cy);
                c.rotate((rnd() - 0.5) * 2.4);
                c.fillStyle = 'rgba(20,10,40,0.3)';
                c.beginPath(); c.ellipse(0.8, 1.2, 6.5, 3.4, 0, 0, W_TAU); c.fill();
                c.fillStyle = '#f4f2fa';
                c.beginPath(); c.ellipse(0, 0, 6.5, 3.3, 0, 0, W_TAU); c.fill();
                c.fillStyle = col;
                c.beginPath(); c.ellipse(-0.6, -0.2, 5.3, 2.5, 0, 0, W_TAU); c.fill();
                c.fillStyle = '#2a1f3a';
                c.beginPath(); c.ellipse(-2.8, -0.2, 1.8, 1.3, 0, 0, W_TAU); c.fill();
                c.fillStyle = '#ffffff';
                for (let k = 0; k < 3; k++) c.fillRect(-0.2 + k * 1.5, -1.5, 0.6, 2.6);
                c.restore();
                break;
            }
            case 'tomb': {
                // kleiner Grabstein mit „ZA“
                const st = '#a39cc4', ink = wcDark(st, 0.45);
                c.fillStyle = 'rgba(20,10,40,0.3)';
                c.beginPath(); c.ellipse(cx + 1, cy + 5, 6.5, 2.2, 0, 0, W_TAU); c.fill();
                c.fillStyle = ink;
                c.beginPath(); wRound(c, cx - 5, cy - 7.4, 10, 12.6, [5, 5, 1, 1]); c.fill();
                c.fillStyle = st;
                c.beginPath(); wRound(c, cx - 4.3, cy - 6.8, 8.6, 11, [4.3, 4.3, 1, 1]); c.fill();
                c.fillStyle = 'rgba(255,255,255,0.35)';
                c.fillRect(cx - 3.3, cy - 4.4, 1, 6.5);
                this._line(c, ink, 0.8);
                c.beginPath();
                c.moveTo(cx - 3, cy - 3.2); c.lineTo(cx - 0.7, cy - 3.2); c.lineTo(cx - 3, cy + 0.8); c.lineTo(cx - 0.7, cy + 0.8);
                c.moveTo(cx + 0.3, cy + 0.8); c.lineTo(cx + 1.7, cy - 3.2); c.lineTo(cx + 3.1, cy + 0.8);
                c.moveTo(cx + 0.8, cy - 0.6); c.lineTo(cx + 2.6, cy - 0.6);
                c.stroke();
                c.fillStyle = '#6fbf5a';
                c.beginPath();
                for (const [dx, r] of [[-4.5, 1.5], [-2.5, 1.1], [3, 1.4], [4.8, 1]]) this._dot(c, cx + dx, cy + 4.6, r);
                c.fill();
                break;
            }
            case 'slime': {
                // leuchtende Schleimpfütze
                const col = P.wc ? P.wc[1] : '#9dff5a';
                c.fillStyle = wcA(wcDark(col, 0.35), 0.7);
                c.beginPath(); c.ellipse(cx + 0.6, cy + 0.9, 6.6, 3.9, 0, 0, W_TAU); c.fill();
                c.fillStyle = col;
                c.beginPath();
                c.ellipse(cx, cy, 6, 3.4, rnd() * 0.4 - 0.2, 0, W_TAU);
                for (let k = 0; k < 3; k++) this._dot(c, cx + (rnd() - 0.5) * 17, cy + (rnd() - 0.5) * 10, 0.9 + rnd() * 1.2);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.6)';
                c.beginPath(); c.ellipse(cx - 2, cy - 1.2, 1.8, 0.8, -0.3, 0, W_TAU); c.fill();
                if (b) this._glow(b, cx, cy, 11, col, 0.3, true);
                break;
            }
            // ── Schmetterlingwelt ──
            case 'daisy': {
                c.fillStyle = wcA(wcDark(f, 0.35), 0.5);
                c.beginPath();
                this._dot(c, cx + 0.8, cy + 1, 4.6);
                c.fill();
                c.fillStyle = '#ffffff';
                c.beginPath();
                for (let k = 0; k < 8; k++) {
                    const a = k * W_TAU / 8 + 0.2, ex = cx + Math.cos(a) * 2.8, ey = cy + Math.sin(a) * 2.8;
                    c.moveTo(ex + Math.cos(a) * 2, ey + Math.sin(a) * 2);
                    c.ellipse(ex, ey, 2, 1, a, 0, W_TAU);
                }
                c.fill();
                c.fillStyle = '#ffc53d';
                c.beginPath();
                this._dot(c, cx, cy, 1.6);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.6)';
                c.beginPath();
                this._dot(c, cx - 0.5, cy - 0.5, 0.6);
                c.fill();
                break;
            }
            case 'ladybug': {
                c.save();
                c.translate(cx, cy);
                c.rotate(rnd() * W_TAU);
                c.fillStyle = 'rgba(20,40,20,0.3)';
                c.beginPath(); c.ellipse(0.6, 0.8, 3.8, 3, 0, 0, W_TAU); c.fill();
                c.fillStyle = '#2a1a2a';
                c.beginPath(); this._dot(c, 3, 0, 1.6); c.fill();
                c.fillStyle = '#ff3d4a';
                c.beginPath(); c.ellipse(0, 0, 3.4, 2.8, 0, 0, W_TAU); c.fill();
                c.fillStyle = '#2a1a2a';
                c.fillRect(-3.4, -0.25, 6.8, 0.5);
                c.beginPath();
                for (const [dx, dy] of [[-1.5, -1.3], [1, -1.5], [-1.3, 1.3], [1.2, 1.3]]) this._dot(c, dx, dy, 0.6);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.6)';
                c.beginPath(); this._dot(c, -1.4, -1.8, 0.6); c.fill();
                c.restore();
                break;
            }
            // ── Drachenberg ──
            case 'gold': {
                // flach liegende Goldmünzen, manchmal ein kleiner Stapel (matt, ohne Leuchten: keine Sammelmünzen)
                if (rnd() < 0.3) {
                    const h = 3 + Math.floor(rnd() * 3);
                    c.fillStyle = 'rgba(30,8,20,0.32)';
                    c.beginPath();
                    c.ellipse(cx + 0.8, cy + 1.6, 3.6, 2, 0, 0, W_TAU);
                    c.fill();
                    for (let k = 0; k < h; k++) {
                        const yy = cy - k * 1.3;
                        c.fillStyle = '#9a5c12';
                        c.beginPath(); c.ellipse(cx, yy + 0.7, 3, 1.7, 0, 0, W_TAU); c.fill();
                        c.fillStyle = k === h - 1 ? '#f2b72e' : '#d8961e';
                        c.beginPath(); c.ellipse(cx, yy, 3, 1.6, 0, 0, W_TAU); c.fill();
                    }
                    c.fillStyle = '#ffe58a';
                    c.beginPath(); c.ellipse(cx - 0.8, cy - (h - 1) * 1.3 - 0.4, 1.3, 0.6, 0, 0, W_TAU); c.fill();
                    break;
                }
                const n = 2 + Math.floor(rnd() * 3), cs = [];
                for (let k = 0; k < n; k++) cs.push(cx + (rnd() - 0.5) * 13, cy + (rnd() - 0.5) * 8, (rnd() - 0.5) * 0.8);
                this._coinPass(c, cs);
                break;
            }
            case 'gem': {
                const col = ['#ff4d6d', '#4cc9f0', '#3ddc97', '#b36bff', '#ffd23f'][Math.floor(rnd() * 5)], s = 2.8 + rnd() * 1.2;
                const gem = (o, k) => {
                    c.beginPath();
                    c.moveTo(cx + o, cy - s * k + o);
                    c.lineTo(cx + s * 0.95 * k + o, cy - s * 0.3 * k + o);
                    c.lineTo(cx + s * 0.6 * k + o, cy + s * 0.85 * k + o);
                    c.lineTo(cx - s * 0.6 * k + o, cy + s * 0.85 * k + o);
                    c.lineTo(cx - s * 0.95 * k + o, cy - s * 0.3 * k + o);
                    c.closePath();
                };
                c.fillStyle = 'rgba(30,8,20,0.3)';
                gem(1, 1.05); c.fill();
                c.fillStyle = wcDark(col, 0.4);
                gem(0, 1.12); c.fill();
                c.fillStyle = col;
                gem(0, 0.92); c.fill();
                c.fillStyle = wcLight(col, 0.55);
                c.beginPath();
                c.moveTo(cx, cy - s * 0.85); c.lineTo(cx - s * 0.75, cy - s * 0.28); c.lineTo(cx, cy + s * 0.1); c.closePath();
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.85)';
                c.beginPath(); this._dot(c, cx - s * 0.3, cy - s * 0.45, 0.6); c.fill();
                break;
            }
            case 'scale': {
                // abgefallene Drachenschuppe, glänzend wie ein kleiner Schild
                const col = ['#e8453a', '#3fb8b0', '#9a5ae0', '#ff9a2e'][Math.floor(rnd() * 4)];
                const path = k => {
                    c.beginPath();
                    c.moveTo(0, -4.6 * k);
                    c.quadraticCurveTo(4.6 * k, -4.2 * k, 4 * k, 0.6 * k);
                    c.quadraticCurveTo(3 * k, 4.2 * k, 0, 5.6 * k);
                    c.quadraticCurveTo(-3 * k, 4.2 * k, -4 * k, 0.6 * k);
                    c.quadraticCurveTo(-4.6 * k, -4.2 * k, 0, -4.6 * k);
                };
                c.save();
                c.translate(cx, cy);
                c.rotate((rnd() - 0.5) * 1.6);
                c.fillStyle = 'rgba(30,8,20,0.3)';
                c.translate(0.8, 1);
                path(1); c.fill();
                c.translate(-0.8, -1);
                c.fillStyle = wcDark(col, 0.4);
                path(1); c.fill();
                c.fillStyle = col;
                c.translate(0, -0.4);
                path(0.82); c.fill();
                this._line(c, wcA(wcDark(col, 0.45), 0.7), 0.8);
                c.beginPath(); c.moveTo(0, -3); c.lineTo(0, 3.6); c.stroke();
                c.fillStyle = 'rgba(255,255,255,0.5)';
                c.beginPath(); c.ellipse(-1.6, -1.6, 1.2, 2, 0.3, 0, W_TAU); c.fill();
                c.restore();
                break;
            }
            case 'helmet': {
                // alter Ritterhelm mit rotem Federbusch (lustiges Beutestück)
                c.save();
                c.translate(cx, cy);
                c.rotate((rnd() - 0.5) * 0.9);
                c.fillStyle = 'rgba(30,8,20,0.32)';
                c.beginPath(); c.ellipse(1, 5, 7, 2.4, 0, 0, W_TAU); c.fill();
                c.fillStyle = '#b8283a';
                c.beginPath(); c.ellipse(-0.5, -6.4, 2.6, 3.4, -0.5, 0, W_TAU); c.fill();
                c.fillStyle = '#ff5a6a';
                c.beginPath(); c.ellipse(-1, -6.8, 1.6, 2.4, -0.5, 0, W_TAU); c.fill();
                c.fillStyle = '#4a5068';
                c.beginPath(); c.arc(0, -0.6, 6, Math.PI, 0); c.lineTo(6, 4.4); c.lineTo(-6, 4.4); c.closePath(); c.fill();
                c.fillStyle = '#a8b2cc';
                c.beginPath(); c.arc(0, -0.6, 5, Math.PI, 0); c.lineTo(5, 3.6); c.lineTo(-5, 3.6); c.closePath(); c.fill();
                c.fillStyle = '#2a2e40';
                c.fillRect(-3.8, 0.2, 7.6, 1);
                c.fillRect(-3.8, 2, 7.6, 0.8);
                c.fillStyle = '#6a7490';
                c.fillRect(-0.4, -5.2, 0.8, 5);
                c.fillStyle = 'rgba(255,255,255,0.6)';
                c.beginPath(); c.ellipse(-2.4, -3, 1.2, 1.9, 0.5, 0, W_TAU); c.fill();
                c.restore();
                break;
            }
            case 'shield': {
                // kleiner Ritterschild mit goldenem Rand und Wappenstreifen
                const base = rnd() < 0.5 ? '#c8323c' : '#3a6ad8';
                const path = () => {
                    c.beginPath();
                    c.moveTo(-5, -5);
                    c.lineTo(5, -5);
                    c.lineTo(5, 0);
                    c.quadraticCurveTo(4.6, 4.4, 0, 6.6);
                    c.quadraticCurveTo(-4.6, 4.4, -5, 0);
                    c.closePath();
                };
                c.save();
                c.translate(cx, cy);
                c.rotate((rnd() - 0.5) * 1.4);
                c.fillStyle = 'rgba(30,8,20,0.32)';
                c.translate(1, 1.2);
                path(); c.fill();
                c.translate(-1, -1.2);
                c.fillStyle = base;
                path(); c.fill();
                c.save();
                c.clip();
                c.fillStyle = '#ffd23f';
                c.beginPath();
                c.moveTo(-6, -2); c.lineTo(-2, -6); c.lineTo(6, 2); c.lineTo(2, 6); c.closePath();
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.28)';
                c.fillRect(-5, -5, 10, 2.4);
                c.restore();
                this._line(c, '#d8a93a', 1.2);
                path(); c.stroke();
                c.restore();
                break;
            }
            case 'frost': {
                // Reif auf dem Fels mit einer kleinen Eisblume
                c.fillStyle = 'rgba(176,222,255,0.2)';
                c.beginPath();
                for (let k = 0; k < 3; k++) {
                    const ex = cx + (rnd() - 0.5) * 9, ey = cy + (rnd() - 0.5) * 6, rx = 5 + rnd() * 4, a = rnd() * 3;
                    c.moveTo(ex + rx * Math.cos(a), ey + rx * Math.sin(a));
                    c.ellipse(ex, ey, rx, rx * 0.6, a, 0, W_TAU);
                }
                c.fill();
                const rot = rnd();
                this._line(c, 'rgba(236,250,255,0.55)', 0.8);
                c.beginPath();
                for (let k = 0; k < 6; k++) {
                    const a = rot + k * Math.PI / 3, dx = Math.cos(a), dy = Math.sin(a);
                    c.moveTo(cx, cy);
                    c.lineTo(cx + dx * 4.6, cy + dy * 4.6);
                    for (const s of [-1, 1]) {
                        const b2 = a + s * 1.05;
                        c.moveTo(cx + dx * 2.6, cy + dy * 2.6);
                        c.lineTo(cx + dx * 2.6 + Math.cos(b2) * 1.5, cy + dy * 2.6 + Math.sin(b2) * 1.5);
                    }
                }
                c.stroke();
                break;
            }
            case 'shard': {
                // kleine Kristallspitzen in den Farben des Diamant-Kopfes
                const col = ['#c77dff', '#ff8ad8', '#6ff0ff'][Math.floor(rnd() * 3)];
                this.decoItem(c, { ...P, accent: col }, b, 'crystal', cx, cy, rnd);
                break;
            }
        }
    },

    _bone(c, cx, cy, len, ang, col) {
        const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
        const ink = wcDark(col, 0.45);
        for (const [cc, extra] of [[ink, 1.2], [col, 0]]) {
            this._line(c, cc, 2.2 + extra * 1.4);
            c.beginPath();
            c.moveTo(cx - dx, cy - dy);
            c.lineTo(cx + dx, cy + dy);
            c.stroke();
            c.fillStyle = cc;
            c.beginPath();
            const nx = -dy / (len / 2) * 1.4, ny = dx / (len / 2) * 1.4;
            for (const s of [-1, 1]) {
                this._dot(c, cx + s * dx + nx, cy + s * dy + ny, 1.6 + extra * 0.6);
                this._dot(c, cx + s * dx - nx, cy + s * dy - ny, 1.6 + extra * 0.6);
            }
            c.fill();
        }
    },

    // Niedlicher Schädel (Deko). s = Radius des Kopfes.
    _skullShape(c, cx, cy, s, col, rot) {
        const ink = wcDark(col, 0.5);
        c.save();
        c.translate(cx, cy);
        c.rotate(rot || 0);
        c.fillStyle = ink;
        c.beginPath();
        c.arc(0, -s * 0.15, s + 1, 0, W_TAU);
        wRound(c, -s * 0.62 - 1, s * 0.35, s * 1.24 + 2, s * 0.7 + 1.2, 2);
        c.fill();
        c.fillStyle = col;
        c.beginPath();
        c.arc(0, -s * 0.15, s, 0, W_TAU);
        wRound(c, -s * 0.62, s * 0.35, s * 1.24, s * 0.72, 1.5);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath();
        c.ellipse(-s * 0.38, -s * 0.62, s * 0.3, s * 0.18, -0.5, 0, W_TAU);
        c.fill();
        c.fillStyle = '#2a1636';
        c.beginPath();
        c.ellipse(-s * 0.4, -s * 0.05, s * 0.27, s * 0.3, 0, 0, W_TAU);
        c.ellipse(s * 0.4, -s * 0.05, s * 0.27, s * 0.3, 0, 0, W_TAU);
        c.fill();
        c.fillStyle = ink;
        c.beginPath();
        c.moveTo(0, s * 0.25); c.lineTo(s * 0.12, s * 0.45); c.lineTo(-s * 0.12, s * 0.45); c.closePath();
        c.fill();
        c.fillRect(-s * 0.3, s * 0.72, s * 0.1, s * 0.35);
        c.fillRect(s * 0.2, s * 0.72, s * 0.1, s * 0.35);
        c.restore();
    },

    _gear(c, cx, cy, r, col, teeth) {
        c.fillStyle = col;
        c.beginPath();
        for (let k = 0; k < teeth * 2; k++) {
            const a = k * Math.PI / teeth, rr = k & 1 ? r * 0.78 : r;
            c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        }
        c.closePath();
        c.moveTo(cx + r * 0.35, cy);
        c.arc(cx, cy, r * 0.35, 0, W_TAU, true);
        c.fill('evenodd');
    },

    // ── Busch (Versteck, begehbar) ──
    bush(w, c, P, x, y, seed) {
        const T = TILE_SIZE, px = x * T, py = y * T;
        const is = (tx, ty) => w._tileAt(tx, ty) === TILE_BUSH;
        const [dk, md, lt] = P.bush;
        const rnd = wRng(Math.floor(wHash(x, y, seed + 301) * 4294967295));
        const blobs = [[10, 19, 9.5], [22, 19, 9.5], [16, 11, 10.5], [8, 12, 7], [24, 12, 7]];
        if (is(x + 1, y)) blobs.push([31, 16, 9]);
        if (is(x - 1, y)) blobs.push([1, 16, 9]);
        if (is(x, y - 1)) blobs.push([16, 2, 9]);
        if (is(x, y + 1)) blobs.push([16, 29, 8]);
        for (const bl of blobs) { bl[0] += (rnd() - 0.5) * 2; bl[1] += (rnd() - 0.5) * 2; }
        // Schatten am Boden
        c.fillStyle = wcA(P.shade, 0.35);
        c.beginPath();
        c.ellipse(px + 16, py + 27, 15, 5, 0, 0, W_TAU);
        c.fill();
        if (P.bx === 'pixel') {
            for (const [col, o] of [[dk, 1.5], [md, 0], [lt, -2]]) {
                c.fillStyle = col;
                for (const [bx, by, r] of blobs) {
                    const s = Math.round((r + o) / 2) * 2;
                    c.fillRect(px + bx - s, py + by - s + (o < 0 ? -2 : 0), s * 2 * (o < 0 ? 0.5 : 1), s * 2 * (o < 0 ? 0.5 : 1));
                }
            }
            return;
        }
        for (const [col, o] of [[wcDark(dk, 0.25), 1.6], [dk, 0], [md, -2.2]]) {
            c.fillStyle = col;
            c.beginPath();
            for (const [bx, by, r] of blobs) this._dot(c, px + bx + (o < 0 ? -1 : 0), py + by + (o < 0 ? -1.4 : 0), r + o);
            c.fill();
        }
        // Blätter-Glanz oben links
        c.fillStyle = lt;
        c.beginPath();
        for (const [bx, by, r] of blobs) this._dot(c, px + bx - r * 0.35, py + by - r * 0.4, r * 0.34);
        c.fill();
        // Blatt-Striche
        this._line(c, wcA(wcDark(dk, 0.35), 0.5), 0.9);
        c.beginPath();
        for (let k = 0; k < 5; k++) {
            const lx = px + 6 + rnd() * 20, ly = py + 8 + rnd() * 16;
            c.moveTo(lx, ly);
            c.quadraticCurveTo(lx + 1.5, ly + 1, lx + 3, ly + 0.5);
        }
        c.stroke();
        const ex = P.bx, cols = P.bxc || ['#ffffff'];
        if (ex === 'flowers' || ex === 'berries' || ex === 'sakura') {
            for (let k = 0; k < 4; k++) {
                const fx = px + 7 + rnd() * 18, fy = py + 7 + rnd() * 15;
                const col = ex === 'sakura' ? '#ffffff' : cols[k % cols.length];
                c.fillStyle = col;
                c.beginPath();
                if (ex === 'berries') this._dot(c, fx, fy, 1.9);
                else for (let q = 0; q < 5; q++) this._dot(c, fx + Math.cos(q * 1.2566) * 1.6, fy + Math.sin(q * 1.2566) * 1.6, 1.2);
                c.fill();
                c.fillStyle = ex === 'berries' ? 'rgba(255,255,255,0.7)' : '#ffd23f';
                c.beginPath();
                this._dot(c, fx - (ex === 'berries' ? 0.6 : 0), fy - (ex === 'berries' ? 0.6 : 0), 0.7);
                c.fill();
            }
        } else if (ex === 'snow') {
            c.fillStyle = '#f4fbff';
            c.beginPath();
            for (const [bx, by, r] of blobs) c.ellipse(px + bx - 1, py + by - r * 0.55, r * 0.7, r * 0.34, 0, Math.PI, 0);
            c.fill();
        } else if (ex === 'glow') {
            c.fillStyle = cols[0];
            c.beginPath();
            for (let k = 0; k < 4; k++) this._dot(c, px + 7 + rnd() * 18, py + 6 + rnd() * 16, 1.3);
            c.fill();
        } else if (ex === 'cattail') {
            this._line(c, '#4f7a2a', 1.2);
            c.beginPath();
            for (let k = 0; k < 3; k++) { c.moveTo(px + 10 + k * 6, py + 12); c.lineTo(px + 9 + k * 6.5, py + 1); }
            c.stroke();
            c.fillStyle = cols[0];
            c.beginPath();
            for (let k = 0; k < 3; k++) c.ellipse(px + 9 + k * 6.5, py + 3, 1.6, 3.2, 0, 0, W_TAU);
            c.fill();
        } else if (ex === 'eyes') {
            // Welke Hecke: kahle Zweige, manchmal schaut ein neugieriges Augenpaar heraus
            this._line(c, '#5a4658', 1.3);
            c.beginPath();
            for (let k = 0; k < 3; k++) {
                const tx = px + 9 + k * 7 + (rnd() - 0.5) * 4, ty = py + 8 + rnd() * 4;
                const a = -Math.PI / 2 + (rnd() - 0.5) * 1.3;
                const ex2 = tx + Math.cos(a) * 8, ey2 = ty + Math.sin(a) * 8;
                c.moveTo(tx, ty);
                c.lineTo(ex2, ey2);
                c.moveTo(tx + (ex2 - tx) * 0.5, ty + (ey2 - ty) * 0.5);
                c.lineTo(ex2 + (k - 1) * 2 + 1, ey2 + 1.5);
            }
            c.stroke();
            if (rnd() < 0.4) {
                const ex3 = px + 11 + rnd() * 10, ey3 = py + 15 + rnd() * 5;
                c.fillStyle = cols[0];
                c.beginPath();
                c.ellipse(ex3 - 2.5, ey3, 2, 1.5, 0, 0, W_TAU);
                c.moveTo(ex3 + 4.5, ey3);
                c.ellipse(ex3 + 2.5, ey3, 2, 1.5, 0, 0, W_TAU);
                c.fill();
                c.fillStyle = '#1a1030';
                c.beginPath();
                this._dot(c, ex3 - 2, ey3 + 0.2, 0.8);
                this._dot(c, ex3 + 3, ey3 + 0.2, 0.8);
                c.fill();
            }
        } else if (ex === 'gold') {
            // Goldhaufen: Münzen auf dem Haufen, ein paar Edelsteine, manchmal eine Krone oder ein Kelch
            const cs = [];
            for (let k = 0; k < 10; k++) cs.push(px + 6 + rnd() * 20, py + 5 + rnd() * 17, (rnd() - 0.5) * 0.9);
            for (const [col, ox, oy, rx, ry] of [['#8a520e', 0.3, 0.6, 2.7, 1.8], ['#ffd24a', 0, 0, 2.4, 1.5], ['#fff2b8', -0.7, -0.4, 1.1, 0.55]]) {
                c.fillStyle = col;
                c.beginPath();
                for (let i = 0; i < cs.length; i += 3) {
                    c.moveTo(cs[i] + ox + rx * Math.cos(cs[i + 2]), cs[i + 1] + oy + rx * Math.sin(cs[i + 2]));
                    c.ellipse(cs[i] + ox, cs[i + 1] + oy, rx, ry, cs[i + 2], 0, W_TAU);
                }
                c.fill();
            }
            for (let k = 0; k < 2; k++) {
                const gx = px + 8 + rnd() * 16, gy = py + 8 + rnd() * 12, gc = ['#ff4d6d', '#4cc9f0', '#3ddc97', '#b36bff'][Math.floor(rnd() * 4)];
                c.fillStyle = wcDark(gc, 0.35);
                c.beginPath(); c.moveTo(gx, gy - 3); c.lineTo(gx + 2.6, gy); c.lineTo(gx, gy + 3); c.lineTo(gx - 2.6, gy); c.closePath(); c.fill();
                c.fillStyle = gc;
                c.beginPath(); c.moveTo(gx, gy - 2.2); c.lineTo(gx + 1.9, gy); c.lineTo(gx, gy + 2.2); c.lineTo(gx - 1.9, gy); c.closePath(); c.fill();
                c.fillStyle = 'rgba(255,255,255,0.8)';
                c.beginPath(); this._dot(c, gx - 0.6, gy - 0.8, 0.55); c.fill();
            }
            const extra = rnd();
            if (extra < 0.2) {
                // Krone
                const kx = px + 16, ky = py + 9;
                c.fillStyle = '#9a5c12';
                c.beginPath();
                c.moveTo(kx - 6, ky + 3.6); c.lineTo(kx - 6.4, ky - 3); c.lineTo(kx - 3, ky); c.lineTo(kx, ky - 4.4);
                c.lineTo(kx + 3, ky); c.lineTo(kx + 6.4, ky - 3); c.lineTo(kx + 6, ky + 3.6); c.closePath();
                c.fill();
                c.fillStyle = '#ffd24a';
                c.beginPath();
                c.moveTo(kx - 5.2, ky + 2.8); c.lineTo(kx - 5.5, ky - 1.8); c.lineTo(kx - 2.8, ky + 0.8); c.lineTo(kx, ky - 3.2);
                c.lineTo(kx + 2.8, ky + 0.8); c.lineTo(kx + 5.5, ky - 1.8); c.lineTo(kx + 5.2, ky + 2.8); c.closePath();
                c.fill();
                c.fillStyle = '#e8323c';
                c.beginPath(); this._dot(c, kx, ky + 1.3, 1.1); c.fill();
            } else if (extra < 0.32) {
                // Kelch
                const kx = px + 18, ky = py + 8;
                c.fillStyle = '#9a5c12';
                c.fillRect(kx - 0.8, ky, 1.6, 5);
                c.fillRect(kx - 3, ky + 4.6, 6, 1.4);
                c.beginPath(); c.ellipse(kx, ky - 1, 4, 3.4, 0, 0, Math.PI); c.fill();
                c.fillStyle = '#ffd24a';
                c.beginPath(); c.ellipse(kx, ky - 1.2, 3.3, 2.7, 0, 0, Math.PI); c.fill();
                c.fillStyle = '#b8761a';
                c.beginPath(); c.ellipse(kx, ky - 1.2, 3.3, 1, 0, 0, W_TAU); c.fill();
            }
        }
    },

    // ── Schädel-Kachel (Deko, begehbar) ──
    skull(w, c, P, x, y, seed) {
        if (P.sk === 'desk') { this._schoolDesk(w, c, P, x, y, seed); return; }
        if (P.sk === 'bloom') { this._flowerBed(w, c, P, x, y, seed); return; }
        if (P.sk === 'nest') { this._eggNest(c, P, x * TILE_SIZE + 16, y * TILE_SIZE + 17, wRng(Math.floor(wHash(x, y, seed + 431) * 4294967295)), 1); return; }
        const T = TILE_SIZE, px = x * T, py = y * T;
        const r = wHash(x, y, seed + 401);
        c.fillStyle = wcA(P.shade, 0.3);
        c.beginPath();
        c.ellipse(px + 17, py + 25, 10, 3.5, 0, 0, W_TAU);
        c.fill();
        if (r < 0.6) this._bone(c, px + 16, py + 22, 13, 0.4 + r, P.bone);
        if (P.ws === 'pixel') {
            const s = 2, bx = px + 9, by = py + 7;
            const rows = ['0111110', '1111111', '1001001', '1111111', '0110110', '0101010'];
            c.fillStyle = P.bone;
            rows.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '1') c.fillRect(bx + i * s, by + j * s, s, s); });
            c.fillStyle = '#2a1636';
            c.fillRect(bx + 2, by + 4, 2, 2);
            c.fillRect(bx + 8, by + 4, 2, 2);
            return;
        }
        this._skullShape(c, px + 16, py + 15, 7, P.bone, (r - 0.5) * 0.5);
    },

    // Zombie Academy: Schulbank mit Stuhl (in Reihen immer), einzeln auch Bücherstapel oder Schulranzen
    _schoolDesk(w, c, P, x, y, seed) {
        const T = TILE_SIZE, px = x * T, py = y * T;
        const row = w._tileAt(x - 1, y) === TILE_SKULL || w._tileAt(x + 1, y) === TILE_SKULL;
        const r = wHash(x, y, seed + 411), rnd = wRng(Math.floor(wHash(x, y, seed + 413) * 4294967295));
        c.fillStyle = wcA(P.shade, 0.4);
        c.beginPath();
        c.ellipse(px + 17, py + 25, 13, 4.5, 0, 0, W_TAU);
        c.fill();
        if (row || r < 0.4) {
            // Stuhl (Sitz und Lehne), darüber die Bank mit Holzplatte und Kante
            const chair = r < 0.5 ? '#4f73c8' : '#3f9a8f';
            c.fillStyle = wcDark(chair, 0.35);
            c.beginPath(); wRound(c, px + 9.5, py + 19, 13, 9, 2); c.fill();
            c.fillStyle = chair;
            c.beginPath(); wRound(c, px + 10, py + 19, 12, 7, 2); c.fill();
            c.fillStyle = wcDark(chair, 0.2);
            c.beginPath(); wRound(c, px + 9.5, py + 26, 13, 3.6, 1.2); c.fill();
            c.fillStyle = 'rgba(255,255,255,0.3)';
            c.fillRect(px + 11.5, py + 26.6, 9, 0.9);
            c.fillStyle = '#4a4a66';
            c.fillRect(px + 5, py + 17, 2, 6);
            c.fillRect(px + 25, py + 17, 2, 6);
            c.fillStyle = '#a8703e';
            c.fillRect(px + 3.5, py + 16, 25, 3.4);
            c.fillStyle = '#d9a563';
            c.beginPath(); wRound(c, px + 3.5, py + 5, 25, 11.5, 1.5); c.fill();
            c.fillStyle = '#f0c98a';
            c.fillRect(px + 4.5, py + 5.6, 23, 1.1);
            c.fillStyle = 'rgba(120,70,30,0.25)';
            c.fillRect(px + 6, py + 11, 20, 0.6);
            const item = Math.floor(wHash(x, y, seed + 415) * 5);
            if (item === 0) this.decoItem(c, P, null, 'pencil', px + 16, py + 10, rnd);
            else if (item === 1) this.decoItem(c, P, null, 'apple', px + 23, py + 10, rnd);
            else if (item === 2) {
                c.fillStyle = '#f6f2ff';
                c.fillRect(px + 8, py + 7, 6, 7.5);
                c.fillRect(px + 14.6, py + 7, 6, 7.5);
                c.fillStyle = '#b8b0d0';
                for (let k = 0; k < 3; k++) { c.fillRect(px + 9, py + 9 + k * 1.8, 4, 0.5); c.fillRect(px + 15.6, py + 9 + k * 1.8, 4, 0.5); }
            } else if (item === 3) {
                c.fillStyle = '#f4f1ff';
                c.fillRect(px + 11, py + 7, 7, 8);
                c.fillStyle = '#8fb4ff';
                for (let k = 0; k < 3; k++) c.fillRect(px + 12, py + 9 + k * 1.8, 5, 0.5);
            }
            return;
        }
        if (r < 0.75) {
            // Bücherstapel
            const cols = ['#e0453c', '#3c7ae0', '#3cb86a', '#f0a63c', '#9a5ae0'];
            for (let k = 0; k < 3; k++) {
                const col = cols[Math.floor(rnd() * cols.length)], bx = px + 8 + (rnd() - 0.5) * 3, by = py + 17 - k * 4.2;
                c.fillStyle = wcDark(col, 0.35);
                c.fillRect(bx, by + 3, 16, 3);
                c.fillStyle = '#f4ecd8';
                c.fillRect(bx + 1.5, by + 3.2, 13, 2.4);
                c.fillStyle = col;
                c.fillRect(bx, by, 16, 3.2);
                c.fillStyle = 'rgba(255,255,255,0.35)';
                c.fillRect(bx + 1, by + 0.6, 14, 0.8);
            }
            return;
        }
        // Schulranzen
        const col = ['#e0453c', '#3cb8a8', '#f0a63c'][Math.floor(rnd() * 3)];
        c.fillStyle = wcDark(col, 0.4);
        c.beginPath(); wRound(c, px + 8.5, py + 8.5, 16, 17, 4); c.fill();
        c.fillStyle = col;
        c.beginPath(); wRound(c, px + 9, py + 9, 15, 15, 3.5); c.fill();
        c.fillStyle = wcDark(col, 0.18);
        c.beginPath(); wRound(c, px + 9, py + 9, 15, 8, [3.5, 3.5, 2, 2]); c.fill();
        c.fillStyle = '#ffd23f';
        c.fillRect(px + 15, py + 15, 3, 3);
        c.fillStyle = '#f4f2fa';
        c.fillRect(px + 11, py + 20.5, 11, 1.4);
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.fillRect(px + 11, py + 10, 8, 1.2);
    },

    // Gepunktetes Drachenei (Farben aus P.eggs), oben schmaler als unten; s = Größe
    _egg(c, P, x, y, s, ci, rot) {
        const [shell, spot] = P.eggs[ci % P.eggs.length];
        const egg = (ox, oy, k) => {
            c.beginPath();
            c.ellipse(ox, oy, 4 * k, 6 * k, 0, Math.PI, W_TAU);
            c.ellipse(ox, oy, 4 * k, 4.6 * k, 0, 0, Math.PI);
            c.closePath();
        };
        c.save();
        c.translate(x, y);
        c.rotate(rot || 0);
        c.fillStyle = wcDark(shell, 0.45);
        egg(0.3, 0.4, s * 1.1);
        c.fill();
        c.fillStyle = shell;
        egg(0, 0, s);
        c.fill();
        c.fillStyle = spot;
        c.beginPath();
        for (const [dx, dy, r] of [[-1.4, -1.8, 0.9], [1.6, -0.4, 1.1], [-0.8, 2, 0.8], [1.3, 2.6, 0.6], [0.3, -4, 0.6]]) this._dot(c, dx * s, dy * s, r * s);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.beginPath();
        c.ellipse(-1.5 * s, -2.6 * s, 0.9 * s, 1.7 * s, 0.3, 0, W_TAU);
        c.fill();
        c.restore();
    },

    // Nest aus Zweigen mit 1–3 gepunkteten Dracheneiern (Schädel-Kachel in Welt 24); s = Größe
    _eggNest(c, P, cx, cy, rnd, s) {
        const twigs = (ox, oy, rx, ry, a0, a1, n, cols) => {
            for (const [col, lw, o] of cols) {
                this._line(c, col, lw * s);
                c.beginPath();
                for (let k = 0; k < n; k++) {
                    const a = a0 + (a1 - a0) * (k + wHash(k, n, 433) * 0.6) / n, a2 = a + 0.5, j = (wHash(n, k, 435) - 0.5) * 2;
                    c.moveTo(ox + Math.cos(a) * (rx + j) * s + o, oy + Math.sin(a) * (ry + j * 0.6) * s + o);
                    c.quadraticCurveTo(ox + Math.cos(a + 0.25) * (rx + 2) * s + o, oy + Math.sin(a + 0.25) * (ry + 1.5) * s + o,
                        ox + Math.cos(a2) * (rx - j) * s + o, oy + Math.sin(a2) * (ry - j * 0.6) * s + o);
                }
                c.stroke();
            }
        };
        c.fillStyle = wcA(P.shade, 0.45);
        c.beginPath();
        c.ellipse(cx + 1, cy + 5 * s, 14.5 * s, 5.5 * s, 0, 0, W_TAU);
        c.fill();
        c.fillStyle = '#5a3418';
        c.beginPath();
        c.ellipse(cx, cy + 2 * s, 13 * s, 8 * s, 0, 0, W_TAU);
        c.fill();
        twigs(cx, cy + 2 * s, 11, 6.6, Math.PI, W_TAU, 9, [['#3a200e', 2.2, 0.5], ['#a8703a', 1.2, 0]]);
        c.fillStyle = '#34200e';
        c.beginPath();
        c.ellipse(cx, cy + 1.2 * s, 8.6 * s, 4.8 * s, 0, 0, W_TAU);
        c.fill();
        const n = 1 + Math.floor(rnd() * 3);
        const pos = n === 1 ? [[0, -2.2]] : (n === 2 ? [[-3.6, -2], [3.4, -1.4]] : [[0, -3.6], [-4.4, -1.2], [4.2, -0.8]]);
        for (let k = 0; k < n; k++) this._egg(c, P, cx + pos[k][0] * s, cy + pos[k][1] * s, s * 0.85, Math.floor(rnd() * 3), (rnd() - 0.5) * 0.5);
        twigs(cx, cy + 1.6 * s, 10, 5.6, 0.1, Math.PI - 0.3, 8, [['#4a2a12', 2.6, 0.6], ['#8a5a2a', 1.8, 0], ['#c8904a', 0.9, -0.4]]);
    },

    // Schmetterlingwelt: begehbares Blumenbeet (manchmal mit rastendem Schmetterling)
    _flowerBed(w, c, P, x, y, seed) {
        const T = TILE_SIZE, cx = x * T + 16, cy = y * T + 16;
        const rnd = wRng(Math.floor(wHash(x, y, seed + 421) * 4294967295));
        c.fillStyle = wcA(P.shade, 0.3);
        c.beginPath();
        c.ellipse(cx + 1.5, cy + 6, 14, 6, 0, 0, W_TAU);
        c.fill();
        const leaves = [];
        for (let k = 0; k < 7; k++) {
            const a = k * W_TAU / 7 + rnd() * 0.5;
            leaves.push(cx + Math.cos(a) * 8, cy + Math.sin(a) * 6 + 1, 4.5 + rnd() * 2);
        }
        leaves.push(cx, cy, 7);
        for (const [col, o] of [['#23703a', 1.2], ['#3f9a4a', 0], ['#6fcf5f', -1.5]]) {
            c.fillStyle = col;
            c.beginPath();
            for (let i = 0; i < leaves.length; i += 3) this._dot(c, leaves[i] + (o < 0 ? -0.8 : o * 0.5), leaves[i + 1] + (o < 0 ? -1.2 : o), o < 0 ? leaves[i + 2] * 0.45 : leaves[i + 2]);
            c.fill();
        }
        const fl = [];
        for (let k = 0; k < 6; k++) {
            const a = k * W_TAU / 6 + rnd() * 0.6, d = k ? 5.5 + rnd() * 3 : 0;
            fl.push([cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d - 1, 2.6 + rnd() * 1.2, P.petals[Math.floor(rnd() * P.petals.length)]]);
        }
        fl.sort((p, q) => p[1] - q[1]);
        for (const [fx, fy, s, col] of fl) {
            c.fillStyle = wcDark(col, 0.3);
            c.beginPath();
            for (let q = 0; q < 5; q++) this._dot(c, fx + 0.5 + Math.cos(q * 1.2566) * s * 0.7, fy + 0.7 + Math.sin(q * 1.2566) * s * 0.7, s * 0.6);
            c.fill();
            c.fillStyle = col;
            c.beginPath();
            for (let q = 0; q < 5; q++) this._dot(c, fx + Math.cos(q * 1.2566) * s * 0.7, fy + Math.sin(q * 1.2566) * s * 0.7, s * 0.6);
            c.fill();
            c.fillStyle = col === '#ffe066' ? '#ff9a2e' : '#ffc53d';
            c.beginPath();
            this._dot(c, fx, fy, s * 0.36);
            c.fill();
        }
        if (rnd() < 0.3) this.decoItem(c, P, null, 'butterfly', cx + 5, cy - 7, rnd);
    },

    // ── Sprungfeld (statischer Teil; Pfeil und Ladering sind animiert) ──
    pad(w, c, P, b, x, y) {
        const T = TILE_SIZE, cx = x * T + 16, cy = y * T + 16;
        const col = P.pad, th = w.theme;
        c.fillStyle = wcA(P.shade, 0.35);
        c.beginPath();
        c.ellipse(cx + 1.5, cy + 3, 14, 12, 0, 0, W_TAU);
        c.fill();
        if (th === 'scrap') {
            // Reifen als Trampolin
            c.fillStyle = '#23232e';
            c.beginPath();
            c.arc(cx, cy, 13.5, 0, W_TAU);
            c.fill();
            this._line(c, '#44445a', 2);
            c.beginPath();
            for (let k = 0; k < 16; k++) {
                const a = k * W_TAU / 16;
                c.moveTo(cx + Math.cos(a) * 10.5, cy + Math.sin(a) * 10.5);
                c.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
            }
            c.stroke();
            c.fillStyle = '#ffb347';
            c.beginPath();
            c.arc(cx, cy, 8.5, 0, W_TAU);
            c.fill();
        } else if (th === 'zombie') {
            // Trampolin aus der Turnhalle: blauer Rahmen, Federn, schwarzes Sprungtuch
            c.fillStyle = '#1d2f6e';
            c.beginPath();
            c.arc(cx, cy, 13.8, 0, W_TAU);
            c.fill();
            c.fillStyle = col;
            c.beginPath();
            c.arc(cx - 0.3, cy - 0.6, 12.8, 0, W_TAU);
            c.fill();
            c.fillStyle = '#1b1828';
            c.beginPath();
            c.arc(cx, cy - 0.4, 10.2, 0, W_TAU);
            c.fill();
            this._line(c, '#c8cce0', 1.1);
            c.beginPath();
            for (let k = 0; k < 16; k++) {
                const a = k * W_TAU / 16;
                c.moveTo(cx + Math.cos(a) * 8.2, cy - 0.4 + Math.sin(a) * 8.2);
                c.lineTo(cx + Math.cos(a) * 11.4, cy - 0.4 + Math.sin(a) * 11.4);
            }
            c.stroke();
            c.fillStyle = '#2c2940';
            c.beginPath();
            c.arc(cx, cy - 0.4, 7.8, 0, W_TAU);
            c.fill();
            this._line(c, wcA(P.accent, 0.7), 1.2);
            c.beginPath();
            c.arc(cx, cy - 0.4, 4.2, 0, W_TAU);
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.28)';
            c.beginPath();
            c.ellipse(cx - 3.5, cy - 4.5, 3.2, 1.3, -0.6, 0, W_TAU);
            c.fill();
        } else if (th === 'butterfly') {
            // Hüpfblume: große Blütenblätter um eine federnde Mitte
            for (const [cc, o, s] of [[wcDark(col, 0.4), 0.8, 1.05], [col, 0, 1], [wcLight(col, 0.35), -0.8, 0.55]]) {
                c.fillStyle = cc;
                c.beginPath();
                for (let k = 0; k < 8; k++) {
                    const a = k * W_TAU / 8 + 0.2, ex = cx + Math.cos(a) * 9.5 + o * 0.5, ey = cy + Math.sin(a) * 9 + o;
                    c.moveTo(ex + Math.cos(a) * 5 * s, ey + Math.sin(a) * 5 * s);
                    c.ellipse(ex, ey, 5 * s, 3.6 * s, a, 0, W_TAU);
                }
                c.fill();
            }
            c.fillStyle = '#c8861a';
            c.beginPath();
            c.arc(cx, cy, 7.8, 0, W_TAU);
            c.fill();
            c.fillStyle = '#ffd23f';
            c.beginPath();
            c.arc(cx - 0.4, cy - 0.7, 7, 0, W_TAU);
            c.fill();
            c.fillStyle = '#e8a52a';
            c.beginPath();
            for (let k = 0; k < 7; k++) this._dot(c, cx + Math.cos(k * 0.9) * 3.8, cy - 0.5 + Math.sin(k * 0.9) * 3.8, 0.8);
            c.fill();
            c.fillStyle = 'rgba(255,255,255,0.5)';
            c.beginPath();
            c.ellipse(cx - 3, cy - 3.6, 2.8, 1.3, -0.6, 0, W_TAU);
            c.fill();
        } else if (th === 'dragon') {
            // Dampfschlot: Basaltring, darunter glüht Magma, weiße Dampfwölkchen
            c.fillStyle = '#231d3c';
            c.beginPath();
            c.arc(cx, cy, 13.8, 0, W_TAU);
            c.fill();
            c.fillStyle = col;
            c.beginPath();
            for (let k = 0; k < 9; k++) {
                const a = k * W_TAU / 9, r = 11.6 + (k & 1) * 0.8;
                this._dot(c, cx + Math.cos(a) * 8.6, cy - 0.6 + Math.sin(a) * 8.6, 4.4 + (r - 11.6));
            }
            c.fill();
            c.fillStyle = wcLight(col, 0.3);
            c.beginPath();
            for (let k = 0; k < 9; k++) {
                const a = k * W_TAU / 9;
                this._dot(c, cx + Math.cos(a) * 8.6 - 1, cy - 1.8 + Math.sin(a) * 8.6, 1.6);
            }
            c.fill();
            c.fillStyle = '#1a0a10';
            c.beginPath();
            c.arc(cx, cy - 0.4, 6.6, 0, W_TAU);
            c.fill();
            c.fillStyle = '#e8501a';
            c.beginPath();
            c.arc(cx, cy, 5, 0, W_TAU);
            c.fill();
            c.fillStyle = '#ffc23a';
            c.beginPath();
            c.arc(cx + 0.4, cy + 0.6, 2.8, 0, W_TAU);
            c.fill();
            c.fillStyle = 'rgba(255,255,255,0.42)';
            c.beginPath();
            this._dot(c, cx - 3, cy - 6.5, 2.6);
            this._dot(c, cx + 0.5, cy - 8, 2.2);
            this._dot(c, cx + 3.5, cy - 6, 1.8);
            c.fill();
        } else {
            const rim = th === 'dojo' ? '#b22a2a' : col;
            c.fillStyle = wcDark(rim, 0.45);
            c.beginPath();
            c.arc(cx, cy, 13.5, 0, W_TAU);
            c.fill();
            c.fillStyle = rim;
            c.beginPath();
            c.arc(cx, cy - 0.8, 12.3, 0, W_TAU);
            c.fill();
            const skin = th === 'dojo' ? '#f3e2c0' : (th === 'swamp' ? '#5fbf4a' : wcLight(col, 0.55));
            c.fillStyle = wcDark(skin, 0.15);
            c.beginPath();
            c.arc(cx, cy - 0.5, 9, 0, W_TAU);
            c.fill();
            c.fillStyle = skin;
            c.beginPath();
            c.arc(cx - 0.5, cy - 1.2, 8.2, 0, W_TAU);
            c.fill();
            if (th === 'mushroom' || th === 'dojo') {
                c.fillStyle = th === 'dojo' ? 'rgba(178,42,42,0.55)' : '#ffffff';
                c.beginPath();
                for (let k = 0; k < 5; k++) this._dot(c, cx + Math.cos(k * 1.2566 + 0.3) * 10.8, cy - 0.8 + Math.sin(k * 1.2566 + 0.3) * 10.8, 1.3);
                c.fill();
            }
            // Federring
            this._line(c, wcA(wcDark(skin, 0.4), 0.45), 1);
            c.beginPath();
            c.arc(cx - 0.5, cy - 1.2, 5.5, 0, W_TAU);
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.55)';
            c.beginPath();
            c.ellipse(cx - 5, cy - 6.5, 4, 1.8, -0.6, 0, W_TAU);
            c.fill();
        }
        b.anim.push({ k: 'pad', px: cx, py: cy, x, y });
    },

    // ── Geöffnete Boss-Tür: Torbogen mit goldenem Licht ──
    openDoor(w, c, P, b, x, y) {
        const T = TILE_SIZE, px = x * T, py = y * T;
        c.fillStyle = 'rgba(255,210,63,0.22)';
        c.fillRect(px + 4, py, 24, T);
        c.fillStyle = '#ffd23f';
        c.fillRect(px + 3, py + T - 4, 26, 3);
        c.fillStyle = '#b8860b';
        c.fillRect(px + 3, py + T - 1.5, 26, 1.5);
        // aufgeschwungene Torflügel
        for (const s of [-1, 1]) {
            const ex = s < 0 ? px + 1 : px + T - 1;
            c.fillStyle = wcDark(P.accent, 0.55);
            c.beginPath();
            c.moveTo(ex, py + 2);
            c.lineTo(ex - s * 6, py + 7);
            c.lineTo(ex - s * 6, py + 30);
            c.lineTo(ex, py + 26);
            c.closePath();
            c.fill();
            c.fillStyle = '#ffd23f';
            c.beginPath();
            this._dot(c, ex - s * 3.2, py + 12, 1);
            this._dot(c, ex - s * 3.2, py + 22, 1);
            c.fill();
        }
        b.anim.push({ k: 'door', px: px + 16, py: py + 16, x, y });
    },

    // ── Wände: Oberseite (flächig, nahtlos), Vorderseite (unteres Drittel, nur über Boden), Kanten ──
    walls(w, c, P, b, x0, y0, x1, y1, seed) {
        const T = TILE_SIZE, F = WALL_FRONT;
        const list = [];
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                if (!w._raised(x, y)) continue;
                list.push({
                    x, y, px: x * T, py: y * T, t: w.tiles[y][x], front: !w._raised(x, y + 1),
                    up: !w._raised(x, y - 1), lf: !w._raised(x - 1, y), rt: !w._raised(x + 1, y),
                });
            }
        }
        if (!list.length) return;
        for (const q of list) q.h = q.front ? T - F : T;
        // Oberseite
        c.save();
        c.beginPath();
        for (const q of list) {
            if (q.up && (q.lf || q.rt)) wRound(c, q.px, q.py, T, q.h, [q.lf ? 5 : 0, q.rt ? 5 : 0, 0, 0]);
            else c.rect(q.px, q.py, T, q.h);
        }
        c.fillStyle = P.wall;
        c.fill();
        c.clip();
        this.wallTop(w, c, P, b, list, seed);
        // Tiefe: das Innere großer Wandflächen wird dunkler, Räume treten hervor.
        // Auch Kacheln knapp außerhalb des Blocks zählen, sonst entstehen helle Nähte an Blockgrenzen.
        const g = this._grads(c, P.deepCol ? { shade: P.deepCol } : P), deep = P.deep === undefined ? 0.34 : P.deep;
        for (let y = y0 - 1; y <= y1; y++) {
            for (let x = x0 - 1; x <= x1; x++) {
                if (!w._raised(x, y)) continue;
                const d = this._depth(w, x, y);
                if (d < 2) continue;
                c.save();
                c.transform(34, 0, 0, 34, x * T + 16, y * T + 16);
                c.globalAlpha = d === 2 ? deep * 0.5 : deep;
                c.fillStyle = g.rad;
                c.fillRect(-1, -1, 2, 2);
                c.restore();
            }
        }
        // Kanten: Lichtkante oben/links, Schattenkante rechts, außen ein dunkler Umriss
        const glowRim = P.ws === 'void';
        c.fillStyle = glowRim ? wcA(P.accent, 0.85) : wcA(wcLight(P.wall, 0.5), 0.6);
        c.beginPath();
        for (const q of list) {
            if (q.up) c.rect(q.px, q.py + 1.2, T, 2.2);
            if (q.lf) c.rect(q.px + 1.2, q.py, 2, q.h);
        }
        c.fill();
        c.fillStyle = glowRim ? wcA(P.accent, 0.5) : wcA(wcDark(P.wall, 0.4), 0.4);
        c.beginPath();
        for (const q of list) if (q.rt) c.rect(q.px + T - 3.2, q.py, 2, q.h);
        c.fill();
        c.fillStyle = wcA(wcDark(P.wall, 0.65), 0.85);
        c.beginPath();
        for (const q of list) {
            if (q.up) c.rect(q.px, q.py, T, 1.2);
            if (q.lf) c.rect(q.px, q.py, 1.2, q.h);
            if (q.rt) c.rect(q.px + T - 1.2, q.py, 1.2, q.h);
        }
        c.fill();
        c.restore();
        // Vorderseiten
        const fr = list.filter(q => q.front);
        if (fr.length) {
            c.save();
            c.beginPath();
            for (const q of fr) c.rect(q.px, q.py + T - F, T, F);
            c.fillStyle = P.wallF;
            c.fill();
            c.clip();
            this.wallFront(w, c, P, b, fr, seed);
            c.fillStyle = glowRim ? wcA(P.accent, 0.9) : wcA(wcLight(P.wallF, 0.45), 0.7);
            c.beginPath();
            for (const q of fr) c.rect(q.px, q.py + T - F, T, 1.5);
            c.fill();
            c.fillStyle = wcA(wcDark(P.wallF, 0.55), 0.7);
            c.beginPath();
            for (const q of fr) {
                c.rect(q.px, q.py + T - 1.8, T, 1.8);
                if (q.lf) c.rect(q.px, q.py + T - F, 1.5, F);
                if (q.rt) c.rect(q.px + T - 1.5, q.py + T - F, 1.5, F);
            }
            c.fill();
            c.restore();
        }
        // Einzelstücke: Fenster, Boss-Tür, Aufsätze
        for (const q of list) {
            if (q.t === TILE_WINDOW) this.window(w, c, P, b, q, seed);
            else if (q.t === TILE_BOSS_DOOR) this.bossDoor(w, c, P, b, q);
            else this.wallExtra(w, c, P, b, q, seed);
        }
    },

    // Abstand einer Wandkachel zur nächsten Nicht-Wand (1, 2 oder 3 = tief)
    _depth(w, x, y) {
        for (let r = 1; r <= 2; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    if (!w._raised(x + dx, y + dy)) return r;
                }
            }
        }
        return 3;
    },

    // Umhüllendes Rechteck aller Wandkacheln
    _bounds(list) {
        let ax = Infinity, ay = Infinity, bx = -Infinity, by = -Infinity;
        for (const q of list) {
            ax = Math.min(ax, q.px); ay = Math.min(ay, q.py);
            bx = Math.max(bx, q.px + TILE_SIZE); by = Math.max(by, q.py + TILE_SIZE);
        }
        return [ax, ay, bx - ax, by - ay];
    },

    // Kreise in drei Tönen streuen (Laub, Glibber, Wolken) – ein Füllaufruf je Ton
    _clumps(c, X, Y, W, H, cell, rMin, rMax, seed, cols) {
        const pts = [];
        wScatter(X, Y, W, H, cell, rMax + 2, seed, (px, py, r) => pts.push(px, py, rMin + r * (rMax - rMin)));
        cols.forEach((col, k) => {
            c.fillStyle = col;
            c.beginPath();
            for (let i = 0; i < pts.length; i += 3) {
                const r = pts[i + 2];
                if (k === 0) this._dot(c, pts[i] + 1, pts[i + 1] + 1.6, r + 1);
                else if (k === 1) this._dot(c, pts[i], pts[i + 1], r);
                else this._dot(c, pts[i] - r * 0.3, pts[i + 1] - r * 0.36, r * 0.42);
            }
            c.fill();
        });
    },

    wallTop(w, c, P, b, list, seed) {
        const [X, Y, W, H] = this._bounds(list);
        const T = TILE_SIZE, col = P.wall;
        switch (P.ws) {
            case 'bricks': case 'blocks': {
                // Große Steinquader im Verband, leicht unterschiedlich getönt, mit Lichtkante
                const bw = 32, bh = P.ws === 'blocks' ? 32 : 16;
                c.fillStyle = wcDark(col, 0.3);
                c.fillRect(X, Y, W, H);
                const groups = new Map(), stones = [];
                for (let gy = Math.floor(Y / bh) * bh; gy < Y + H; gy += bh) {
                    const off = ((gy / bh) & 1) * bw / 2;
                    for (let gx = Math.floor((X - off) / bw) * bw + off; gx < X + W; gx += bw) {
                        const v = wHash(gx, gy, seed + 501) - 0.5;
                        let cc = v > 0 ? wcLight(col, v * 0.16) : wcDark(col, -v * 0.16);
                        if (P.tints) cc = wcMix(cc, P.tints[Math.floor(wHash(gy, gx, seed + 507) * P.tints.length)], 0.2);
                        let l = groups.get(cc);
                        if (!l) groups.set(cc, l = []);
                        l.push(gx, gy);
                        stones.push(gx, gy);
                    }
                }
                for (const [cc, l] of groups) {
                    c.fillStyle = cc;
                    c.beginPath();
                    for (let i = 0; i < l.length; i += 2) wRound(c, l[i] + 0.9, l[i + 1] + 0.9, bw - 1.8, bh - 1.8, 2.5);
                    c.fill();
                }
                c.fillStyle = wcA(wcLight(col, 0.55), 0.45);
                c.beginPath();
                for (let i = 0; i < stones.length; i += 2) c.rect(stones[i] + 2.5, stones[i + 1] + 1.4, bw - 5, 1.3);
                c.fill();
                c.fillStyle = wcA(wcDark(col, 0.45), 0.4);
                c.beginPath();
                for (let i = 0; i < stones.length; i += 2) c.rect(stones[i] + 2.5, stones[i + 1] + bh - 2.6, bw - 5, 1.3);
                c.fill();
                this._specks(c, X, Y, W, H, 8, seed + 503, wcA(wcDark(col, 0.4), 0.3), wcA(wcLight(col, 0.45), 0.3));
                break;
            }
            case 'school': {
                // Backstein der Schule bei Nacht: ruhiger Ziegelverband, nur einzelne Steine heller, dunkler oder getönt
                const bw = 16, bh = 8, groups = new Map();
                const gy0 = Math.floor(Y / bh) * bh;
                for (let gy = gy0; gy < Y + H; gy += bh) {
                    const off = ((gy / bh) & 1) * bw / 2;
                    for (let gx = Math.floor((X - off) / bw) * bw + off; gx < X + W; gx += bw) {
                        const v = wHash(gx, gy, seed + 501);
                        let cc = null;
                        if (v < 0.12) cc = wcDark(col, 0.16);
                        else if (v > 0.9) cc = wcLight(col, 0.1);
                        else if (v > 0.8 && P.tints) cc = wcMix(col, P.tints[Math.floor(v * 97) % P.tints.length], 0.3);
                        if (!cc) continue;
                        let l = groups.get(cc);
                        if (!l) groups.set(cc, l = []);
                        l.push(gx, gy);
                    }
                }
                for (const [cc, l] of groups) {
                    c.fillStyle = cc;
                    c.beginPath();
                    for (let i = 0; i < l.length; i += 2) c.rect(l[i], l[i + 1], bw, bh);
                    c.fill();
                }
                c.fillStyle = wcA(wcDark(col, 0.5), 0.55);
                c.beginPath();
                for (let gy = gy0; gy < Y + H; gy += bh) {
                    c.rect(X, gy - 0.5, W, 1);
                    const off = ((gy / bh) & 1) * bw / 2;
                    for (let gx = Math.floor((X - off) / bw) * bw + off; gx < X + W; gx += bw) c.rect(gx - 0.5, gy, 1, bh);
                }
                c.fill();
                c.fillStyle = wcA(wcLight(col, 0.35), 0.16);
                c.beginPath();
                for (let gy = gy0; gy < Y + H; gy += bh) c.rect(X, gy + 0.6, W, 0.8);
                c.fill();
                this._specks(c, X, Y, W, H, 9, seed + 503, wcA(wcDark(col, 0.4), 0.25), wcA(wcLight(col, 0.4), 0.18));
                break;
            }
            case 'strata': {
                for (let k = 0; k < 2; k++) {
                    this._line(c, k ? wcA(wcLight(col, 0.3), 0.55) : wcA(wcDark(col, 0.25), 0.5), k ? 1.4 : 2.2);
                    c.beginPath();
                    for (let ry = Math.floor(Y / 9) - 1; ry <= Math.ceil((Y + H) / 9) + 1; ry++) {
                        for (let px = X - 6; px <= X + W + 6; px += 6) {
                            const py = ry * 9 + k * 3 + 2.5 * Math.sin(px * 0.05 + ry * 2.1);
                            if (px === X - 6) c.moveTo(px, py); else c.lineTo(px, py);
                        }
                    }
                    c.stroke();
                }
                break;
            }
            case 'metal': case 'brass': {
                c.fillStyle = wcA(wcDark(col, 0.5), 0.5);
                for (let gx = X; gx <= X + W; gx += T) c.fillRect(gx - 0.8, Y, 1.6, H);
                for (let gy = Y; gy <= Y + H; gy += T) c.fillRect(X, gy - 0.8, W, 1.6);
                c.fillStyle = wcA(wcLight(col, 0.55), 0.5);
                for (let gy = Y; gy < Y + H; gy += T) c.fillRect(X, gy + 0.9, W, 1.2);
                for (const k of [0, 1]) {
                    c.fillStyle = k ? wcLight(col, 0.5) : wcDark(col, 0.4);
                    c.beginPath();
                    for (const q of list) for (const [a, bb] of [[4, 4.5], [T - 4, 4.5]]) this._dot(c, q.px + a - k * 0.4, q.py + bb - k * 0.4, k ? 1.1 : 1.6);
                    c.fill();
                }
                for (const q of list) {
                    const r = wHash(q.x, q.y, seed + 511);
                    if (P.ws === 'brass' && r < 0.45) this._gear(c, q.px + 16, q.py + q.h / 2 + 1, 7 + r * 6, wcA(wcDark(col, 0.35), 0.5), 9);
                    else if (P.ws === 'metal' && r < 0.3) {
                        c.fillStyle = wcA(wcDark(col, 0.55), 0.6);
                        for (let k = 0; k < 3; k++) c.fillRect(q.px + 9, q.py + 6 + k * 4, 14, 2);
                    }
                }
                break;
            }
            case 'jelly': {
                c.fillStyle = wcA(wcDark(col, 0.25), 0.35);
                c.beginPath();
                wScatter(X, Y, W, H, 17, 9, seed + 521, (px, py, r) => { this._dot(c, px, py, 4 + r * 5); });
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.32)';
                c.beginPath();
                wScatter(X, Y, W, H, 17, 9, seed + 521, (px, py, r) => { c.moveTo(px, py); c.ellipse(px - 1.5, py - 2, 2.2 + r * 2, 1.2 + r, -0.5, 0, W_TAU); });
                c.fill();
                this._line(c, 'rgba(255,255,255,0.5)', 0.9);
                c.beginPath();
                wScatter(X, Y, W, H, 12, 3, seed + 523, (px, py, r) => { if (r < 0.4) this._dot(c, px, py, 1 + r * 2.5); });
                c.stroke();
                break;
            }
            case 'foliage': case 'darktree':
                this._clumps(c, X, Y, W, H, 11, 5, 8.5, seed + 531, [wcDark(col, 0.32), col, wcLight(col, 0.3)]);
                if (P.ws === 'darktree') {
                    c.fillStyle = wcA(P.accent, 0.8);
                    c.beginPath();
                    wScatter(X, Y, W, H, 13, 1, seed + 533, (px, py, r) => { if (r < 0.18) this._dot(c, px, py, 1.1); });
                    c.fill();
                }
                break;
            case 'jungle': {
                const cols = [wcDark(col, 0.3), col, wcLight(col, 0.22)];
                cols.forEach((cc, k) => {
                    c.fillStyle = cc;
                    c.beginPath();
                    wScatter(X, Y, W, H, 17, 14, seed + 541 + k, (px, py, r) => {
                        c.moveTo(px, py);
                        c.ellipse(px, py, 12 - k * 2, 4.8 - k * 0.7, r * W_TAU, 0, W_TAU);
                    });
                    c.fill();
                });
                this._line(c, wcA(wcLight(col, 0.45), 0.55), 0.8);
                c.beginPath();
                wScatter(X, Y, W, H, 17, 14, seed + 543, (px, py, r) => {
                    const a = r * W_TAU;
                    c.moveTo(px - Math.cos(a) * 6, py - Math.sin(a) * 6);
                    c.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6);
                });
                c.stroke();
                break;
            }
            case 'bramble': {
                this._clumps(c, X, Y, W, H, 11, 4.5, 7.5, seed + 551, [wcDark(col, 0.35), col, wcLight(col, 0.22)]);
                this._line(c, wcDark(col, 0.55), 1.3);
                c.beginPath();
                wScatter(X, Y, W, H, 17, 12, seed + 555, (px, py, r) => {
                    c.moveTo(px - 8, py + 2);
                    c.quadraticCurveTo(px, py - 6 + r * 4, px + 8, py + 1);
                    c.moveTo(px - 2.5, py - 1.2); c.lineTo(px - 3.5, py - 4.2);
                    c.moveTo(px + 3, py - 0.8); c.lineTo(px + 4.8, py - 3.4);
                });
                c.stroke();
                c.fillStyle = P.accent;
                c.beginPath();
                wScatter(X, Y, W, H, 12, 2, seed + 557, (px, py, r) => { if (r < 0.2) this._dot(c, px, py, 1.3); });
                c.fill();
                break;
            }
            case 'reeds': {
                // Schilf von oben: dunkle Büschel, drei Lagen Halme, Rohrkolben
                c.fillStyle = wcA(wcDark(col, 0.35), 0.6);
                c.beginPath();
                wScatter(X, Y, W, H, 14, 10, seed + 551, (px, py, r) => { this._dot(c, px, py, 5 + r * 4); });
                c.fill();
                for (let k = 0; k < 3; k++) {
                    this._line(c, [wcDark(col, 0.2), col, wcLight(col, 0.3)][k], 1.6);
                    c.beginPath();
                    wScatter(X, Y, W, H, 7, 8, seed + 553 + k, (px, py, r) => {
                        c.moveTo(px, py + 4);
                        c.lineTo(px + (r - 0.5) * 5, py - 4);
                    });
                    c.stroke();
                }
                c.fillStyle = '#b8652e';
                c.beginPath();
                wScatter(X, Y, W, H, 11, 3, seed + 557, (px, py, r) => {
                    if (r > 0.3) return;
                    c.moveTo(px, py);
                    c.ellipse(px, py, 1.5, 3, 0.2, 0, W_TAU);
                });
                c.fill();
                break;
            }
            case 'ice': {
                this._line(c, 'rgba(255,255,255,0.75)', 1.6);
                c.beginPath();
                wScatter(X, Y, W, H, 16, 8, seed + 561, (px, py, r) => {
                    if (r > 0.55) return;
                    c.moveTo(px - 4, py + 4);
                    c.lineTo(px + 4, py - 4);
                    c.moveTo(px - 1, py + 5);
                    c.lineTo(px + 3, py + 1);
                });
                c.stroke();
                this._line(c, wcA(P.wallF, 0.45), 1);
                c.beginPath();
                wScatter(X, Y, W, H, 21, 6, seed + 563, (px, py, r) => {
                    if (r > 0.35) return;
                    c.moveTo(px, py);
                    c.lineTo(px + 5, py + 2);
                    c.lineTo(px + 7, py + 7);
                    c.moveTo(px + 5, py + 2);
                    c.lineTo(px + 10, py);
                });
                c.stroke();
                break;
            }
            case 'rock': case 'void': {
                const v = P.ws === 'void';
                c.fillStyle = v ? wcA(P.accent, 0.12) : wcA(wcDark(col, 0.3), 0.35);
                c.beginPath();
                wScatter(X, Y, W, H, 18, 10, seed + 571, (px, py, r) => { c.moveTo(px + 6 + r * 6, py); c.ellipse(px, py, 6 + r * 6, 4 + r * 4, r * 3, 0, W_TAU); });
                c.fill();
                c.fillStyle = v ? 'rgba(255,255,255,0.9)' : wcA(wcLight(col, 0.3), 0.4);
                c.beginPath();
                wScatter(X, Y, W, H, v ? 9 : 12, 4, seed + 573, (px, py, r) => {
                    if (r > (v ? 0.4 : 0.5)) return;
                    if (v) this._dot(c, px, py, 0.5 + r * 1.4);
                    else { c.moveTo(px + 4, py); c.ellipse(px, py, 4, 2.4, 0, Math.PI, W_TAU); }
                });
                c.fill();
                if (!v) {
                    this._line(c, wcA(wcDark(col, 0.45), 0.55), 1.1);
                    c.beginPath();
                    wScatter(X, Y, W, H, 20, 6, seed + 575, (px, py, r) => {
                        if (r > 0.4) return;
                        c.moveTo(px - 5, py); c.lineTo(px, py + 2); c.lineTo(px + 4, py - 1);
                    });
                    c.stroke();
                }
                break;
            }
            case 'pixel': {
                for (const k of [0, 1]) {
                    c.fillStyle = k ? wcA(wcDark(col, 0.4), 0.5) : wcA(wcLight(col, 0.4), 0.45);
                    c.beginPath();
                    for (let gy = Y; gy < Y + H; gy += 8) {
                        for (let gx = X; gx < X + W; gx += 8) {
                            if (k) { c.rect(gx, gy + 6, 8, 2); c.rect(gx + 6, gy, 2, 8); } else { c.rect(gx, gy, 8, 2); c.rect(gx, gy, 2, 8); }
                        }
                    }
                    c.fill();
                }
                c.fillStyle = wcA(P.accent, 0.55);
                c.beginPath();
                for (let gy = Y; gy < Y + H; gy += 8) for (let gx = X; gx < X + W; gx += 8) if (wHash(gx, gy, seed + 581) < 0.05) c.rect(gx + 2, gy + 2, 4, 4);
                c.fill();
                break;
            }
            case 'stands': {
                // Sitzreihen und bunte Fans (gedämpft, damit die Fläche ruhig bleibt)
                c.fillStyle = wcA(wcLight(col, 0.12), 0.7);
                for (let gy = Math.floor(Y / 8) * 8; gy < Y + H; gy += 8) c.fillRect(X, gy, W, 3.5);
                c.fillStyle = wcA(wcDark(col, 0.4), 0.6);
                for (let gy = Math.floor(Y / 8) * 8; gy < Y + H; gy += 8) c.fillRect(X, gy + 6.5, W, 1.5);
                const fans = ['#ff4d5e', '#ffd23f', '#ffffff', '#4cc9f0', '#ff9f1c', '#7ddc6a'].map(f => wcMix(f, col, 0.3));
                const pts = [];
                wScatter(X, Y, W, H, 6.5, 0, seed + 591, (px, py, r) => { if (r < 0.8) pts.push(px, Math.floor(py / 8) * 8 + 4, r / 0.8); });
                fans.forEach((fc, k) => {
                    c.fillStyle = fc;
                    c.beginPath();
                    for (let i = 0; i < pts.length; i += 3) if (Math.floor(pts[i + 2] * fans.length) === k) this._dot(c, pts[i], pts[i + 1], 1.9);
                    c.fill();
                });
                c.fillStyle = '#f2c49a';
                c.beginPath();
                for (let i = 0; i < pts.length; i += 3) this._dot(c, pts[i], pts[i + 1] - 1.6, 1.1);
                c.fill();
                break;
            }
            case 'cubes': {
                for (const q of list) {
                    const car = P.cars[Math.floor(wHash(q.x, q.y, seed + 601) * P.cars.length)];
                    c.fillStyle = car;
                    c.fillRect(q.px + 0.5, q.py + 0.5, T - 1, q.h - 0.5);
                    // zusammengepresste Blechlagen, Beulen
                    c.fillStyle = wcA(wcDark(car, 0.4), 0.5);
                    c.beginPath();
                    for (let k = 7; k < q.h - 3; k += 7) {
                        c.moveTo(q.px + 2, q.py + k);
                        c.lineTo(q.px + 12, q.py + k + 1.8);
                        c.lineTo(q.px + T - 2, q.py + k - 0.6);
                        c.lineTo(q.px + T - 2, q.py + k + 0.6);
                        c.lineTo(q.px + 12, q.py + k + 3);
                        c.lineTo(q.px + 2, q.py + k + 1.2);
                        c.closePath();
                    }
                    c.fill();
                    c.fillStyle = 'rgba(255,255,255,0.35)';
                    c.fillRect(q.px + 3, q.py + 2.5, T - 12, 1.6);
                    const r = wHash(q.x, q.y, seed + 603);
                    const my = q.py + Math.min(q.h - 7, 13);
                    if (r < 0.28) {
                        c.fillStyle = '#23232e';
                        c.beginPath();
                        this._dot(c, q.px + 9 + r * 45, my, 4.2);
                        c.fill();
                        c.fillStyle = '#9a9ab0';
                        c.beginPath();
                        this._dot(c, q.px + 9 + r * 45, my, 1.7);
                        c.fill();
                    } else if (r < 0.46) {
                        c.fillStyle = '#fff6c8';
                        c.beginPath();
                        this._dot(c, q.px + 8, my, 2.4);
                        this._dot(c, q.px + 24, my, 2.4);
                        c.fill();
                    } else if (r < 0.62) {
                        c.fillStyle = '#a8ddff';
                        c.beginPath();
                        wRound(c, q.px + 7, my - 4, 18, 7, 2);
                        c.fill();
                        c.fillStyle = 'rgba(255,255,255,0.8)';
                        c.fillRect(q.px + 9, my - 3, 5, 1.3);
                    }
                    c.fillStyle = 'rgba(20,10,30,0.35)';
                    c.fillRect(q.px, q.py, 0.8, q.h);
                    c.fillRect(q.px, q.py, T, 0.8);
                }
                break;
            }
            case 'bamboo': {
                // Bambushain von oben: dunkles Laub, darauf die runden Halmköpfe
                c.fillStyle = wcDark(col, 0.35);
                c.fillRect(X, Y, W, H);
                [wcDark(col, 0.2), col].forEach((cc, k) => {
                    c.fillStyle = cc;
                    c.beginPath();
                    wScatter(X, Y, W, H, 14, 9, seed + 611 + k, (px, py, r) => {
                        c.moveTo(px, py);
                        c.ellipse(px, py, 8 - k * 1.5, 2.1, r * 3 - 1.5, 0, W_TAU);
                    });
                    c.fill();
                });
                const tops = [];
                wScatter(X, Y, W, H, 12.5, 5, seed + 617, (px, py, r) => { if (r < 0.75) tops.push(px, py, 2.6 + r * 1.6); });
                for (const [cc, dr, ox] of [['#2f5f24', 0.9, 0.6], ['#a8dc6a', 0, 0], ['#5f9a3a', -1.4, 0]]) {
                    c.fillStyle = cc;
                    c.beginPath();
                    for (let i = 0; i < tops.length; i += 3) this._dot(c, tops[i] + ox, tops[i + 1] + ox, Math.max(0.6, tops[i + 2] + dr));
                    c.fill();
                }
                c.fillStyle = 'rgba(255,255,255,0.55)';
                c.beginPath();
                for (let i = 0; i < tops.length; i += 3) this._dot(c, tops[i] - 1, tops[i + 1] - 1, 0.7);
                c.fill();
                break;
            }
            case 'pads': {
                for (const q of list) {
                    c.fillStyle = wcLight(col, 0.12);
                    c.beginPath();
                    wRound(c, q.px + 2, q.py + 2, T - 4, q.h - 3, 4);
                    c.fill();
                    c.setLineDash([2.5, 2]);
                    this._line(c, 'rgba(255,255,255,0.6)', 0.9);
                    c.beginPath();
                    wRound(c, q.px + 4.5, q.py + 4.5, T - 9, q.h - 8, 2.5);
                    c.stroke();
                    c.setLineDash([]);
                    c.fillStyle = 'rgba(255,255,255,0.3)';
                    c.beginPath();
                    c.ellipse(q.px + 11, q.py + 7, 6, 2, -0.2, 0, W_TAU);
                    c.fill();
                }
                break;
            }
            case 'blooms': {
                // Riesenblumen von oben: Blattwerk, darauf große Blüten in Regenbogenfarben
                this._clumps(c, X, Y, W, H, 13, 6, 9.5, seed + 531, [wcDark(col, 0.35), col, wcLight(col, 0.22)]);
                const cols = P.petals, bl = [];
                wScatter(X, Y, W, H, 18, 12, seed + 591, (px, py, r, gx, gy) => {
                    if (r > 0.62) return;
                    bl.push(px, py, 5.5 + r * 4.5, Math.floor(wHash(gx, gy, seed + 593) * cols.length), wHash(gy, gx, seed + 595) * 1.26);
                });
                c.fillStyle = wcA(wcDark(col, 0.55), 0.5);
                c.beginPath();
                for (let i = 0; i < bl.length; i += 5) this._dot(c, bl[i] + 1.3, bl[i + 1] + 1.8, bl[i + 2]);
                c.fill();
                this._petalPass(c, bl, cols);
                break;
            }
            case 'basalt': {
                // Basaltsäulen von oben: sechseckige Säulenköpfe mit dunklen Fugen, je Element-Zone leicht getönt
                const R = 9, sx = R * 1.5, sy = R * Math.sqrt(3), tint = [null, '#c0503a', '#b0e0f4', '#a060e0'];
                c.fillStyle = wcDark(col, 0.45);
                c.fillRect(X, Y, W, H);
                const groups = new Map(), hexes = [];
                for (let gx = Math.floor((X - R) / sx); gx <= Math.ceil((X + W + R) / sx); gx++) {
                    const oy = (gx & 1) ? sy / 2 : 0;
                    for (let gy = Math.floor((Y - oy - R) / sy); gy <= Math.ceil((Y + H - oy + R) / sy); gy++) {
                        const hx = gx * sx, hy = gy * sy + oy, v = wHash(gx, gy, seed + 881) - 0.5;
                        const z = this._zone(w, Math.floor(hx / T), Math.floor(hy / T));
                        let cc = v > 0 ? wcLight(col, v * 0.2) : wcDark(col, -v * 0.2);
                        if (z) cc = wcMix(cc, tint[z], 0.2);
                        let l = groups.get(cc);
                        if (!l) groups.set(cc, l = []);
                        l.push(hx, hy);
                        hexes.push(hx, hy);
                    }
                }
                const hex = (hx, hy, r) => {
                    c.moveTo(hx + r, hy);
                    for (let k = 1; k < 6; k++) c.lineTo(hx + Math.cos(k * Math.PI / 3) * r, hy + Math.sin(k * Math.PI / 3) * r);
                    c.closePath();
                };
                for (const [cc, l] of groups) {
                    c.fillStyle = cc;
                    c.beginPath();
                    for (let i = 0; i < l.length; i += 2) hex(l[i], l[i + 1], R - 1);
                    c.fill();
                }
                // Lichtkante oben links, Schattenkante unten rechts
                for (const [cc, s] of [[wcA(wcLight(col, 0.45), 0.5), -1], [wcA(wcDark(col, 0.5), 0.45), 1]]) {
                    this._line(c, cc, 1);
                    c.beginPath();
                    for (let i = 0; i < hexes.length; i += 2) {
                        const hx = hexes[i], hy = hexes[i + 1], r = R - 1.7;
                        c.moveTo(hx + s * r, hy);
                        c.lineTo(hx + s * r / 2, hy + s * r * 0.866);
                        c.lineTo(hx - s * r / 2, hy + s * r * 0.866);
                    }
                    c.stroke();
                }
                break;
            }
        }
    },

    // Blüten (x, y, Radius, Farbnummer, Drehung je 5 Einträge) mit Rand, Farbe, Glanz und Mitte – ein Füllaufruf je Ton
    _petalPass(c, bl, cols) {
        const used = new Set();
        for (let i = 3; i < bl.length; i += 5) used.add(bl[i]);
        cols.forEach((pc, k) => {
            if (!used.has(k)) return;
            for (const [cc, o, s] of [[wcDark(pc, 0.3), 0, 1], [pc, -0.5, 0.84]]) {
                c.fillStyle = cc;
                c.beginPath();
                for (let i = 0; i < bl.length; i += 5) {
                    if (bl[i + 3] !== k) continue;
                    const R = bl[i + 2];
                    for (let q = 0; q < 5; q++) {
                        const a = bl[i + 4] + q * 1.2566;
                        this._dot(c, bl[i] + o + Math.cos(a) * R * 0.52, bl[i + 1] + o + Math.sin(a) * R * 0.52, R * 0.5 * s);
                    }
                }
                c.fill();
            }
        });
        c.fillStyle = 'rgba(255,255,255,0.45)';
        c.beginPath();
        for (let i = 0; i < bl.length; i += 5) this._dot(c, bl[i] - bl[i + 2] * 0.42, bl[i + 1] - bl[i + 2] * 0.45, bl[i + 2] * 0.2);
        c.fill();
        c.fillStyle = '#e8961e';
        c.beginPath();
        for (let i = 0; i < bl.length; i += 5) this._dot(c, bl[i], bl[i + 1], bl[i + 2] * 0.3);
        c.fill();
        c.fillStyle = '#ffd23f';
        c.beginPath();
        for (let i = 0; i < bl.length; i += 5) this._dot(c, bl[i] - 0.4, bl[i + 1] - 0.5, bl[i + 2] * 0.2);
        c.fill();
    },

    wallFront(w, c, P, b, fr, seed) {
        const T = TILE_SIZE, F = WALL_FRONT, col = P.wallF;
        const [X, Y0, W] = this._bounds(fr);
        const dk = wcA(wcDark(col, 0.45), 0.55), lt = wcA(wcLight(col, 0.35), 0.4);
        switch (P.ws) {
            case 'bricks': case 'blocks': {
                const bw = P.ws === 'blocks' ? 16 : 12, rows = P.ws === 'blocks' ? 1 : 2;
                c.fillStyle = dk;
                c.beginPath();
                for (const q of fr) {
                    const top = q.py + T - F;
                    for (let r = 0; r < rows; r++) {
                        const ry = top + r * F / rows;
                        c.rect(q.px, ry + F / rows - 1, T, 1);
                        const off = ((q.y + r) & 1) * bw / 2;
                        for (let jx = Math.floor((q.px - off) / bw) * bw + off; jx < q.px + T; jx += bw) if (jx > q.px) c.rect(jx, ry, 1, F / rows);
                    }
                }
                c.fill();
                c.fillStyle = lt;
                c.beginPath();
                for (const q of fr) for (let r = 0; r < rows; r++) c.rect(q.px, q.py + T - F + r * F / rows + 1.6, T, 0.9);
                c.fill();
                if (P.moss) {
                    c.fillStyle = '#5fbf4f';
                    c.beginPath();
                    for (const q of fr) {
                        if (wHash(q.x, q.y, seed + 621) > 0.45) continue;
                        const mx = q.px + 4 + wHash(q.y, q.x, seed) * 16;
                        c.moveTo(mx, q.py + T - F);
                        c.lineTo(mx + 10, q.py + T - F);
                        c.quadraticCurveTo(mx + 7, q.py + T - F + 7, mx + 5, q.py + T - F + 4);
                        c.quadraticCurveTo(mx + 3, q.py + T - F + 6, mx, q.py + T - F);
                    }
                    c.fill();
                }
                break;
            }
            case 'strata': {
                c.fillStyle = wcA(wcLight(col, 0.25), 0.7);
                c.beginPath();
                for (const q of fr) c.rect(q.px, q.py + T - F + 3.5 + Math.sin(q.x * 1.3) * 0.8, T, 2.5);
                c.fill();
                c.fillStyle = wcA(wcDark(col, 0.3), 0.6);
                c.beginPath();
                for (const q of fr) c.rect(q.px, q.py + T - 4, T, 2);
                c.fill();
                break;
            }
            case 'metal': {
                if (P.hazard) {
                    c.fillStyle = '#ffcf3f';
                    c.beginPath();
                    for (const q of fr) c.rect(q.px, q.py + T - F + 2, T, F - 4);
                    c.fill();
                    c.fillStyle = '#35304d';
                    c.beginPath();
                    for (const q of fr) {
                        const top = q.py + T - F + 2;
                        for (let sx = Math.floor(q.px / 8) * 8 - 8; sx < q.px + T; sx += 8) {
                            c.moveTo(sx, top + F - 4); c.lineTo(sx + 4, top + F - 4); c.lineTo(sx + 4 + F - 4, top); c.lineTo(sx + F - 4, top); c.closePath();
                        }
                    }
                    c.fill();
                }
                break;
            }
            case 'brass': {
                c.fillStyle = '#e8a45a';
                c.beginPath();
                for (const q of fr) c.rect(q.px, q.py + T - F + 3, T, 4);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.45)';
                c.beginPath();
                for (const q of fr) c.rect(q.px, q.py + T - F + 3.6, T, 1);
                c.fill();
                c.fillStyle = '#8a4a1a';
                c.beginPath();
                for (const q of fr) for (let jx = q.px + 8; jx < q.px + T; jx += 16) c.rect(jx, q.py + T - F + 2, 2.5, 6);
                c.fill();
                break;
            }
            case 'jelly': {
                c.fillStyle = wcLight(P.wall, 0.08);
                c.beginPath();
                for (const q of fr) {
                    const top = q.py + T - F;
                    c.rect(q.px, top, T, 2.5);
                    for (let k = 0; k < 3; k++) {
                        const dx = q.px + 4 + k * 10 + wHash(q.x, k, seed + 631) * 4, len = 3 + wHash(q.x, q.y + k, seed + 633) * 6;
                        c.moveTo(dx - 2.2, top + 2);
                        c.lineTo(dx - 2.2, top + len);
                        c.arc(dx, top + len, 2.2, Math.PI, 0, true);
                        c.lineTo(dx + 2.2, top + 2);
                    }
                }
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.35)';
                c.beginPath();
                for (const q of fr) c.rect(q.px + 2, q.py + T - F + 1, T - 4, 1);
                c.fill();
                break;
            }
            case 'foliage': case 'darktree': case 'jungle': case 'bramble': {
                this._clumps(c, X, Y0 + T - F - 4, W, this._bounds(fr)[3], 7, 2.5, 4.5, seed + 641,
                    [wcDark(col, 0.35), col, wcLight(col, 0.18)]);
                if (P.ws !== 'bramble') {
                    c.fillStyle = P.ws === 'darktree' ? '#2a1f33' : '#7a4f2e';
                    c.beginPath();
                    for (const q of fr) {
                        if (wHash(q.x, q.y, seed + 643) > 0.5) continue;
                        const tx = q.px + 8 + wHash(q.y, q.x, seed + 645) * 14;
                        c.rect(tx, q.py + T - 6, 4, 6);
                    }
                    c.fill();
                }
                break;
            }
            case 'reeds': case 'bamboo': {
                const bam = P.ws === 'bamboo';
                const step = bam ? 5.5 : 3.2;
                for (const q of fr) {
                    const top = q.py + T - F;
                    for (let sx = Math.floor(q.px / step) * step; sx < q.px + T; sx += step) {
                        const r = wHash(Math.round(sx * 10), q.y, seed + 651);
                        c.fillStyle = r < 0.5 ? wcLight(col, bam ? 0.15 : 0.1) : wcDark(col, 0.12);
                        c.fillRect(sx + 0.4, top, step - 0.8, F);
                        if (bam) {
                            c.fillStyle = wcDark(col, 0.35);
                            c.fillRect(sx + 0.4, top + 3 + r * 4, step - 0.8, 1.2);
                            c.fillStyle = 'rgba(255,255,255,0.3)';
                            c.fillRect(sx + 1, top, 1, F);
                        }
                    }
                }
                break;
            }
            case 'ice': {
                c.fillStyle = 'rgba(255,255,255,0.35)';
                c.beginPath();
                for (const q of fr) {
                    const top = q.py + T - F;
                    c.rect(q.px, top, T, 3);
                    for (let k = 0; k < 3; k++) c.rect(q.px + 5 + k * 9 + wHash(q.x, k, seed) * 3, top + 3, 1.3, F - 5);
                }
                c.fill();
                c.fillStyle = '#f4fcff';
                c.beginPath();
                for (const q of fr) {
                    const top = q.py + T - F + 1.5;
                    for (let k = 0; k < 3; k++) {
                        if (wHash(q.x, q.y + k, seed + 661) > 0.6) continue;
                        const ix = q.px + 4 + k * 10 + wHash(q.y, q.x + k, seed) * 4, len = 4 + wHash(q.x + k, q.y, seed) * 5;
                        c.moveTo(ix - 1.8, top); c.lineTo(ix + 1.8, top); c.lineTo(ix, top + len); c.closePath();
                    }
                }
                c.fill();
                break;
            }
            case 'rock': case 'void': {
                c.fillStyle = P.ws === 'void' ? wcA(P.accent, 0.25) : dk;
                c.beginPath();
                for (const q of fr) {
                    const top = q.py + T - F;
                    c.rect(q.px, top + 4 + Math.sin(q.x * 2.1) * 1.2, T, 1.2);
                    c.rect(q.px, top + 8 + Math.sin(q.x * 1.3 + 1) * 1, T, 1);
                }
                c.fill();
                if (P.lava) {
                    this._line(c, '#ff8a2b', 1.4);
                    c.beginPath();
                    for (const q of fr) {
                        if (wHash(q.x, q.y, seed + 671) > 0.35) continue;
                        const sx = q.px + 6 + wHash(q.y, q.x, seed + 673) * 18, top = q.py + T - F;
                        c.moveTo(sx, top + 1); c.lineTo(sx + 2, top + 5); c.lineTo(sx - 1, top + 8); c.lineTo(sx + 1, top + F);
                        this._glow(b, sx, top + 6, 10, '#ff7a2b', 0.4, true);
                    }
                    c.stroke();
                }
                break;
            }
            case 'pixel': {
                c.fillStyle = wcA(wcDark(col, 0.45), 0.8);
                c.beginPath();
                for (const q of fr) {
                    const top = q.py + T - F;
                    c.rect(q.px, top + 5, T, 1.2);
                    for (let jx = q.px + ((q.x & 1) ? 4 : 0); jx < q.px + T; jx += 8) c.rect(jx, top, 1.2, 5);
                    for (let jx = q.px + ((q.x & 1) ? 0 : 4); jx < q.px + T; jx += 8) c.rect(jx, top + 6, 1.2, 5);
                }
                c.fill();
                break;
            }
            case 'stands': {
                const ads = ['#ff4d5e', '#ffd23f', '#4cc9f0', '#ffffff', '#7ddc6a', '#ff9f1c'];
                for (const q of fr) {
                    const top = q.py + T - F;
                    for (let k = 0; k < 2; k++) {
                        const ax = q.px + k * 16;
                        const ac = ads[Math.floor(wHash(Math.floor(ax / 16), q.y, seed + 681) * ads.length)];
                        c.fillStyle = ac;
                        c.fillRect(ax + 0.6, top + 2, 14.8, F - 4);
                        c.fillStyle = ac === '#ffffff' ? '#ff4d5e' : 'rgba(255,255,255,0.85)';
                        c.beginPath();
                        c.ellipse(ax + 8, top + F / 2, 4.5, 1.8, 0, 0, W_TAU);
                        c.fill();
                    }
                }
                break;
            }
            case 'cubes': {
                for (const q of fr) {
                    const car = P.cars[Math.floor(wHash(q.x, q.y, seed + 601) * P.cars.length)];
                    c.fillStyle = wcDark(car, 0.3);
                    c.fillRect(q.px, q.py + T - F, T, F);
                    c.fillStyle = wcA(wcDark(car, 0.55), 0.6);
                    c.fillRect(q.px + 1, q.py + T - F + 4 + Math.sin(q.x) * 1.2, T - 2, 1.2);
                    c.fillRect(q.px + 1, q.py + T - 4, T - 2, 1);
                    c.fillStyle = '#f2f2f7';
                    if (wHash(q.x, q.y, seed + 691) < 0.3) c.fillRect(q.px + 11, q.py + T - F + 5, 10, 4);
                }
                break;
            }
            case 'pads': {
                c.fillStyle = '#ffd23f';
                c.beginPath();
                for (const q of fr) c.rect(q.px, q.py + T - F + 3.5, T, 3.5);
                c.fill();
                break;
            }
            case 'school': {
                // Spinde (je Kachel zwei, paarweise gleiche Farbe), dazwischen Pinnwände aus Kork
                const lk = P.lockers, notes = ['#fff3a0', '#9ad8ff', '#ffb3d0', '#ffffff', '#b8ff9a'];
                for (const q of fr) {
                    const top = q.py + T - F;
                    if (wHash(q.x, q.y, seed + 681) < 0.14) {
                        c.fillStyle = '#5a3a24';
                        c.fillRect(q.px + 1.5, top + 1.2, T - 3, F - 2.6);
                        c.fillStyle = '#c8905a';
                        c.fillRect(q.px + 2.5, top + 2, T - 5, F - 4.2);
                        for (let k = 0; k < 3; k++) {
                            const nx = q.px + 4 + k * 8.2 + wHash(q.x, k, seed + 685) * 2, ny = top + 2.6 + wHash(k, q.y, seed + 687) * 1.4;
                            c.fillStyle = notes[Math.floor(wHash(q.x + k, q.y, seed + 689) * notes.length)];
                            c.fillRect(nx, ny, 6, 4.4);
                            c.fillStyle = '#e8323c';
                            c.fillRect(nx + 2.4, ny - 0.3, 1.2, 1.2);
                        }
                        continue;
                    }
                    const col = lk[Math.floor(wHash(q.x >> 1, q.y, seed + 683) * lk.length)];
                    c.fillStyle = wcDark(col, 0.45);
                    c.fillRect(q.px, top, T, F);
                    for (let k = 0; k < 2; k++) {
                        const lx = q.px + k * 16;
                        c.fillStyle = col;
                        c.fillRect(lx + 0.8, top + 0.6, 14.4, F - 1.2);
                        c.fillStyle = wcLight(col, 0.3);
                        c.fillRect(lx + 0.8, top + 0.6, 1, F - 1.2);
                        c.fillStyle = wcDark(col, 0.4);
                        for (let v = 0; v < 3; v++) c.fillRect(lx + 4, top + 2.6 + v * 1.4, 7, 0.7);
                        c.fillStyle = '#e8e4f4';
                        c.fillRect(lx + 12, top + 5.4, 1.4, 2.8);
                    }
                }
                break;
            }
            case 'blooms': {
                // Stängel und Blätter der Riesenblumen, oben der Schatten der Blütenkrone
                const stems = [wcLight(col, 0.22), wcLight(col, 0.08), wcDark(col, 0.12)];
                for (const q of fr) {
                    const top = q.py + T - F;
                    for (let k = 0; k < 6; k++) {
                        c.fillStyle = stems[(k + q.x) % 3];
                        c.fillRect(q.px + 1.5 + k * 5.3 + (wHash(q.x * 7 + k, q.y, seed + 695) - 0.5) * 1.6, top, 2.2, F);
                    }
                }
                c.fillStyle = wcLight(col, 0.32);
                c.beginPath();
                for (const q of fr) {
                    const top = q.py + T - F;
                    for (let k = 0; k < 3; k++) {
                        const s = (k + q.x) & 1 ? 1 : -1;
                        const lx = q.px + 5 + k * 10 + wHash(q.x, q.y + k, seed + 697) * 4 + s * 3, ly = top + 4 + wHash(q.y, q.x + k, seed + 699) * 3;
                        c.moveTo(lx + Math.cos(-s * 0.5) * 3.4, ly + Math.sin(-s * 0.5) * 3.4);
                        c.ellipse(lx, ly, 3.4, 1.4, -s * 0.5, 0, W_TAU);
                    }
                }
                c.fill();
                c.fillStyle = wcA(wcDark(col, 0.55), 0.55);
                for (const q of fr) c.fillRect(q.px, q.py + T - F, T, 3);
                break;
            }
            case 'basalt': {
                // Säulen von der Seite; je Zone glühende Risse (Feuer), Reif und Eiszapfen (Eis),
                // Kristallspitzen (Kristall) oder eine Goldader (Gold)
                const zq = [[], [], [], []];
                for (const q of fr) {
                    const top = q.py + T - F;
                    for (let k = 0; k < 4; k++) {
                        const v = wHash(q.x * 4 + k, q.y, seed + 891);
                        c.fillStyle = v < 0.33 ? wcLight(col, 0.14) : (v < 0.66 ? wcLight(col, 0.04) : wcDark(col, 0.12));
                        c.fillRect(q.px + k * 8 + 0.6, top, 6.8, F);
                    }
                    zq[this._zone(w, q.x, q.y)].push(q);
                }
                c.fillStyle = wcA(wcLight(col, 0.4), 0.3);
                c.beginPath();
                for (const q of fr) for (let k = 0; k < 4; k++) c.rect(q.px + k * 8 + 0.6, q.py + T - F, 1, F);
                c.fill();
                // Gold: Ader quer über die Säulen
                this._line(c, wcA('#f0b83a', 0.85), 1.1);
                c.beginPath();
                for (const q of zq[0]) {
                    if (wHash(q.x, q.y, seed + 693) > 0.5) continue;
                    const y0 = q.py + T - F + 3 + wHash(q.y, q.x, seed + 695) * 4;
                    c.moveTo(q.px + 0.5, y0); c.lineTo(q.px + 9, y0 + 1.5); c.lineTo(q.px + 17, y0 - 1); c.lineTo(q.px + 25, y0 + 1); c.lineTo(q.px + 31.5, y0);
                }
                c.stroke();
                // Feuer: glühende Risse
                this._line(c, '#ff8a2b', 1.4);
                c.beginPath();
                for (const q of zq[1]) {
                    if (wHash(q.x, q.y, seed + 671) > 0.55) continue;
                    const sx = q.px + 6 + wHash(q.y, q.x, seed + 673) * 18, top = q.py + T - F;
                    c.moveTo(sx, top + 1); c.lineTo(sx + 2, top + 5); c.lineTo(sx - 1, top + 8); c.lineTo(sx + 1, top + F);
                    this._glow(b, sx, top + 6, 10, '#ff7a2b', 0.4, true);
                }
                c.stroke();
                // Eis: Reif an der Oberkante und Eiszapfen
                c.fillStyle = 'rgba(226,246,255,0.55)';
                for (const q of zq[2]) c.fillRect(q.px, q.py + T - F, T, 2.2);
                for (const [cc, sh] of [['#e8f8ff', 0], ['rgba(110,180,235,0.5)', 1]]) {
                    c.fillStyle = cc;
                    c.beginPath();
                    for (const q of zq[2]) {
                        const top = q.py + T - F + 1.5;
                        for (let k = 0; k < 4; k++) {
                            if (wHash(q.x, q.y + k, seed + 661) > 0.72) continue;
                            const ix = q.px + 3.5 + k * 7.5 + wHash(q.y, q.x + k, seed + 663) * 2.5, len = 3.5 + wHash(q.x + k, q.y, seed + 665) * 5;
                            if (sh) { c.moveTo(ix, top); c.lineTo(ix + 1.8, top); c.lineTo(ix, top + len); }
                            else { c.moveTo(ix - 1.8, top); c.lineTo(ix + 1.8, top); c.lineTo(ix, top + len); }
                            c.closePath();
                        }
                    }
                    c.fill();
                }
                // Kristall: Spitzen wachsen aus der Wand
                for (const q of zq[3]) {
                    if (wHash(q.x, q.y, seed + 675) > 0.6) continue;
                    const sx = q.px + 7 + wHash(q.y, q.x, seed + 677) * 18, bot = q.py + T - 1.5;
                    const cc = ['#c77dff', '#ff8ad8', '#6ff0ff'][Math.floor(wHash(q.x, q.y, seed + 679) * 3)];
                    for (const [ox, hgt, wd] of [[-2.6, 7, 2.2], [1.2, 9, 2.6], [4.2, 5, 1.8]]) {
                        c.fillStyle = wcDark(cc, 0.2);
                        c.beginPath(); c.moveTo(sx + ox - wd, bot); c.lineTo(sx + ox, bot - hgt); c.lineTo(sx + ox + wd, bot); c.closePath(); c.fill();
                        c.fillStyle = wcLight(cc, 0.45);
                        c.beginPath(); c.moveTo(sx + ox - wd * 0.6, bot - 0.5); c.lineTo(sx + ox, bot - hgt); c.lineTo(sx + ox, bot - 0.5); c.closePath(); c.fill();
                    }
                    this._glow(b, sx + 1, bot - 5, 11, cc, 0.4, true);
                }
                break;
            }
        }
    },

    // Einzelne Aufsätze auf Wand-Oberseiten (Pilzhüte, Früchte, Kristalle …)
    wallExtra(w, c, P, b, q, seed) {
        // Feuerschalen links und rechts der Boss-Tür (weithin sichtbar)
        const nl = w._tileAt(q.x - 1, q.y), nr = w._tileAt(q.x + 1, q.y);
        if (nl === TILE_BOSS_DOOR || nl === TILE_DOOR || nr === TILE_BOSS_DOOR || nr === TILE_DOOR) {
            const bx = q.px + 16, by = q.py + q.h / 2 + 3;
            c.fillStyle = 'rgba(20,6,30,0.35)';
            c.beginPath(); c.ellipse(bx + 1, by + 3, 8.5, 3, 0, 0, W_TAU); c.fill();
            c.fillStyle = '#7a4210';
            c.beginPath(); c.ellipse(bx, by, 8, 4.4, 0, 0, W_TAU); c.fill();
            c.fillStyle = '#ffc23d';
            c.beginPath(); c.ellipse(bx, by - 0.6, 7, 3.4, 0, 0, W_TAU); c.fill();
            c.fillStyle = '#4a1a08';
            c.beginPath(); c.ellipse(bx, by - 1.2, 5, 1.8, 0, 0, W_TAU); c.fill();
            b.anim.push({ k: 'fire', px: bx, py: by - 1, ph: q.x * 1.7 });
            this._glow(b, bx, by - 5, 20, '#ff9a3c', 0.18, true);
            return;
        }
        const r = wHash(q.x, q.y, seed + 701);
        const cx = q.px + 10 + wHash(q.y, q.x, seed + 703) * 12, cy = q.py + 6 + wHash(q.x + 5, q.y, seed + 705) * (q.h - 12);
        if (P.caps && r < 0.2) {
            const col = ['#ff4d5a', '#ff8a3d', '#ff6fb5', '#b56bff'][Math.floor(r * 20) % 4];
            c.fillStyle = 'rgba(10,30,20,0.3)';
            c.beginPath();
            c.ellipse(cx + 1.5, cy + 2.5, 11, 7.5, 0, 0, W_TAU);
            c.fill();
            c.fillStyle = wcDark(col, 0.45);
            c.beginPath();
            c.ellipse(cx, cy, 11, 8, 0, 0, W_TAU);
            c.fill();
            c.fillStyle = col;
            c.beginPath();
            c.ellipse(cx - 0.4, cy - 0.5, 9.8, 6.9, 0, 0, W_TAU);
            c.fill();
            c.fillStyle = '#fff7ec';
            c.beginPath();
            for (const [dx, dy, rr] of [[-4, -2, 2], [3, -3, 1.6], [5, 2, 1.4], [-2, 3, 1.3], [0, -0.5, 1]]) this._dot(c, cx + dx, cy + dy, rr);
            c.fill();
            c.fillStyle = 'rgba(255,255,255,0.4)';
            c.beginPath();
            c.ellipse(cx - 4, cy - 4, 3.5, 1.5, -0.4, 0, W_TAU);
            c.fill();
        } else if (P.fruits && r < 0.5) {
            const fruits = ['#e8323c', '#ff9a1f', '#ffd23f', '#8a4ae0'];
            for (let k = 0; k < 3; k++) {
                const fx = q.px + 6 + wHash(q.x, q.y + k, seed + 707) * 20, fy = q.py + 5 + wHash(q.y, q.x + k, seed + 709) * (q.h - 10);
                const col = fruits[Math.floor(wHash(q.x + k, q.y, seed + 711) * fruits.length)];
                c.fillStyle = wcDark(col, 0.4);
                c.beginPath();
                this._dot(c, fx + 0.5, fy + 0.6, 3.2);
                c.fill();
                c.fillStyle = col;
                c.beginPath();
                this._dot(c, fx, fy, 2.8);
                c.fill();
                c.fillStyle = 'rgba(255,255,255,0.6)';
                c.beginPath();
                this._dot(c, fx - 1, fy - 1, 0.9);
                c.fill();
            }
        } else if (P.crystals && r < 0.16) {
            this.decoItem(c, { ...P, accent: r < 0.08 ? '#ff7ad8' : '#6ff0ff' }, b, 'crystal', cx, cy + 3, wRng(q.x * 31 + q.y));
        } else if ((P.ws === 'bramble' || P.ws === 'darktree') && r < 0.12) {
            c.fillStyle = P.accent;
            c.beginPath();
            this._dot(c, cx, cy, 2);
            c.fill();
            this._glow(b, cx, cy, 10, P.accent, 0.4, true);
        } else if (P.ws === 'blocks' && r < 0.3) {
            c.fillStyle = '#5fbf4f';
            c.beginPath();
            for (let k = 0; k < 4; k++) this._dot(c, cx - 5 + k * 3.5, cy + Math.sin(k * 2) * 2, 2.6 + (k & 1));
            c.fill();
            c.fillStyle = '#8fe06a';
            c.beginPath();
            for (let k = 0; k < 4; k++) this._dot(c, cx - 5.6 + k * 3.5, cy - 0.8 + Math.sin(k * 2) * 2, 1.2);
            c.fill();
        } else if (P.ws === 'school') {
            this._schoolExtra(c, P, b, q, r, seed);
        } else if (P.ws === 'blooms') {
            this._bloomExtra(c, P, b, q, r, cx, cy, seed);
        } else if (P.ws === 'basalt') {
            this._basaltExtra(w, c, P, b, q, r, cx, q.py + clamp(cy - q.py, 10, q.h - 10), seed);
        }
    },

    // Drachenberg: Aufsätze auf den Säulen je Element-Zone (bleiben innerhalb der eigenen Kachel)
    _basaltExtra(w, c, P, b, q, r, cx, cy, seed) {
        const z = this._zone(w, q.x, q.y);
        if (z === 3 && r < 0.26) {
            // Kristallgruppe in Violett, Rosa und Türkis, leuchtet im Dunkeln
            const cols = ['#c77dff', '#ff8ad8', '#6ff0ff'], main = cols[Math.floor(r * 17) % 3];
            c.fillStyle = 'rgba(10,6,24,0.35)';
            c.beginPath(); c.ellipse(cx + 1, cy + 4, 8, 3, 0, 0, W_TAU); c.fill();
            for (const [ox, hgt, wd, k] of [[-5, 9, 2.6, 1], [5, 8, 2.4, 2], [-1.5, 13, 3.2, 0], [2.5, 10, 2.8, 0]]) {
                const cc = k ? cols[(Math.floor(r * 17) + k) % 3] : main;
                c.fillStyle = wcDark(cc, 0.25);
                c.beginPath(); c.moveTo(cx + ox - wd, cy + 4); c.lineTo(cx + ox, cy + 4 - hgt); c.lineTo(cx + ox + wd, cy + 4); c.closePath(); c.fill();
                c.fillStyle = cc;
                c.beginPath(); c.moveTo(cx + ox - wd * 0.2, cy + 4); c.lineTo(cx + ox, cy + 4 - hgt); c.lineTo(cx + ox + wd, cy + 4); c.closePath(); c.fill();
                c.fillStyle = wcLight(cc, 0.55);
                c.beginPath(); c.moveTo(cx + ox - wd * 0.7, cy + 3.5); c.lineTo(cx + ox, cy + 4 - hgt); c.lineTo(cx + ox - wd * 0.1, cy + 3.5); c.closePath(); c.fill();
            }
            // nur jede dritte Gruppe leuchtet auch durch die Dunkelheit (spart Leuchtpunkte pro Bild)
            this._glow(b, cx, cy - 2, r < 0.09 ? 15 : 12, main, 0.42, true);
        } else if (z === 2 && r < 0.22) {
            // Reif auf den Säulenköpfen: flacher, bläulich-weißer Belag mit einer Eisblume
            const s = 0.7 + wHash(q.y, q.x, seed + 721) * 0.35;
            c.fillStyle = 'rgba(214,242,255,0.42)';
            c.beginPath();
            for (let k = 0; k < 3; k++) {
                const ex = cx + (k - 1) * 4 * s, ey = cy + (k & 1 ? 2 : -1) * s, rx = (5 - (k & 1) * 1.2) * s;
                c.moveTo(ex + rx, ey);
                c.ellipse(ex, ey, rx, rx * 0.55, 0, 0, W_TAU);
            }
            c.fill();
            this._line(c, 'rgba(246,252,255,0.8)', 0.8);
            c.beginPath();
            for (let k = 0; k < 3; k++) {
                const a = k * Math.PI / 3 + r * 5;
                c.moveTo(cx - Math.cos(a) * 3.6 * s, cy - Math.sin(a) * 3.6 * s);
                c.lineTo(cx + Math.cos(a) * 3.6 * s, cy + Math.sin(a) * 3.6 * s);
            }
            c.stroke();
        } else if (z === 1 && r < 0.13) {
            // glühende Spalte zwischen den Säulen (Richtung je Kachel verschieden)
            const a = wHash(q.y, q.x, seed + 719) * Math.PI, ux = Math.cos(a), uy = Math.sin(a) * 0.8;
            this._line(c, '#3a1210', 3.4);
            c.beginPath();
            c.moveTo(cx - ux * 8, cy - uy * 8);
            c.lineTo(cx - ux * 2.5 - uy * 2, cy - uy * 2.5 + ux * 2);
            c.lineTo(cx + ux * 2.5 + uy * 2, cy + uy * 2.5 - ux * 2);
            c.lineTo(cx + ux * 8, cy + uy * 8);
            c.stroke();
            this._line(c, '#ff8a2b', 1.6);
            c.stroke();
            this._line(c, '#ffe066', 0.6);
            c.stroke();
            this._glow(b, cx, cy, 12, '#ff7a2b', 0.4, true);
        } else if (z === 0 && r < 0.22) {
            // Goldmünzen, zwischen den Säulen eingeklemmt
            this.decoItem(c, P, b, 'gold', cx, cy, wRng(q.x * 97 + q.y * 31));
        }
    },

    // Zombie Academy: Schleim tropft über Mauerkanten, hier und da eine Efeuranke
    _schoolExtra(c, P, b, q, r, seed) {
        if (q.front && r < 0.16) {
            const sx = q.px + 7 + wHash(q.y, q.x, seed + 713) * 16, top = q.py + q.h;
            const col = P.wc[1];
            for (const [cc, o] of [[wcDark(col, 0.4), 0.7], [col, 0]]) {
                c.fillStyle = cc;
                c.beginPath();
                c.ellipse(sx + o, top - 1 + o, 6, 2.6, 0, 0, W_TAU);
                for (const [dx, len] of [[-3, 5 + r * 20], [2.2, 3 + r * 12]]) {
                    const lx = sx + dx + o;
                    c.moveTo(lx - 1.4, top);
                    c.lineTo(lx - 1.4, top + len);
                    c.arc(lx, top + len, 1.4, Math.PI, 0, true);
                    c.lineTo(lx + 1.4, top);
                }
                c.fill();
            }
            c.fillStyle = 'rgba(255,255,255,0.6)';
            c.beginPath();
            c.ellipse(sx - 2, top - 1.8, 2, 0.8, 0, 0, W_TAU);
            c.fill();
            this._glow(b, sx, top + 2, 12, col, 0.35, true);
        } else if (r > 0.93) {
            const ex = q.px + 10 + wHash(q.y, q.x, seed + 715) * 12, ey = q.py + 6 + wHash(q.x, q.y, seed + 717) * Math.max(1, q.h - 13);
            this._line(c, '#2f5a2a', 1);
            c.beginPath();
            c.moveTo(ex - 7, ey + 4);
            c.quadraticCurveTo(ex, ey - 5, ex + 7, ey + 2);
            c.stroke();
            for (const [col, o] of [['#2f6a2a', 0.6], ['#5fb04a', 0]]) {
                c.fillStyle = col;
                c.beginPath();
                for (let k = 0; k < 5; k++) {
                    const t = k / 4, lx = ex - 7 + 14 * t, ly = ey + 4 - 9 * t * (1 - t) * 1.6 - 2 * t + (k & 1 ? 2 : -1.5);
                    c.moveTo(lx + 2.2 + o, ly + o);
                    c.ellipse(lx + o, ly + o, 2.2, 1.6, k, 0, W_TAU);
                }
                c.fill();
            }
        }
    },

    // Schmetterlingwelt: Blüten hängen über die Kante, manchmal eine Sonnenblume oder ein rastender Schmetterling
    _bloomExtra(c, P, b, q, r, cx, cy, seed) {
        // Alles bleibt innerhalb der eigenen Kachel (Nachbarblöcke zeichnen diese Aufsätze nicht mit)
        cy = q.py + clamp(cy - q.py, 10, q.h - 10);
        if (q.front) {
            const bl = [];
            for (let k = 0; k < 2; k++) {
                if (wHash(q.x * 3 + k, q.y, seed + 721) > 0.6) continue;
                bl.push(q.px + 9 + k * 14 + (wHash(q.y, q.x + k, seed + 723) - 0.5) * 4, q.py + q.h + 0.5,
                    4.2 + wHash(q.x, k, seed + 725) * 1.4, Math.floor(wHash(q.x + k, q.y, seed + 727) * P.petals.length), k * 0.6 + 0.3);
            }
            if (bl.length) this._petalPass(c, bl, P.petals);
        }
        if (r < 0.045) {
            // rastender Schmetterling
            const col = ['#ff8ad8', '#8ad8ff', '#ffd23f', '#c9a8ff'][Math.floor(r * 89) % 4];
            for (const [cc, o, s] of [[wcDark(col, 0.45), 0.6, 1.12], [col, 0, 1]]) {
                c.fillStyle = cc;
                c.beginPath();
                for (const [dx, dy, rx, ry, rot] of [[-4.2, -1.6, 4.4, 3.3, -0.5], [4.2, -1.6, 4.4, 3.3, 0.5], [-3, 2.8, 2.9, 2.2, 0.4], [3, 2.8, 2.9, 2.2, -0.4]]) {
                    c.moveTo(cx + dx + o + Math.cos(rot) * rx * s, cy + dy + o + Math.sin(rot) * rx * s);
                    c.ellipse(cx + dx + o, cy + dy + o, rx * s, ry * s, rot, 0, W_TAU);
                }
                c.fill();
            }
            c.fillStyle = 'rgba(255,255,255,0.7)';
            c.beginPath();
            this._dot(c, cx - 4.8, cy - 2.2, 1.2);
            this._dot(c, cx + 4.8, cy - 2.2, 1.2);
            c.fill();
            c.fillStyle = '#3a2248';
            c.beginPath();
            c.ellipse(cx, cy + 0.5, 1, 4.2, 0, 0, W_TAU);
            c.fill();
            this._line(c, '#3a2248', 0.7);
            c.beginPath();
            c.moveTo(cx - 0.4, cy - 3.4); c.lineTo(cx - 2.2, cy - 6.4);
            c.moveTo(cx + 0.4, cy - 3.4); c.lineTo(cx + 2.2, cy - 6.4);
            c.stroke();
        } else if (r < 0.11) {
            // Sonnenblume
            const R = 9.5;
            c.fillStyle = 'rgba(10,40,20,0.3)';
            c.beginPath();
            this._dot(c, cx + 1.5, cy + 2, R + 1);
            c.fill();
            for (const [cc, o] of [['#d8961a', 0.7], ['#ffd23f', 0]]) {
                c.fillStyle = cc;
                c.beginPath();
                for (let k = 0; k < 12; k++) {
                    const a = k * W_TAU / 12, ex = cx + o + Math.cos(a) * R * 0.62, ey = cy + o + Math.sin(a) * R * 0.62;
                    c.moveTo(ex + Math.cos(a) * R * 0.42, ey + Math.sin(a) * R * 0.42);
                    c.ellipse(ex, ey, R * 0.42, R * 0.2, a, 0, W_TAU);
                }
                c.fill();
            }
            c.fillStyle = '#6a3a14';
            c.beginPath();
            this._dot(c, cx, cy, R * 0.4);
            c.fill();
            c.fillStyle = '#a8662a';
            c.beginPath();
            for (let k = 0; k < 6; k++) this._dot(c, cx + Math.cos(k * 1.05) * R * 0.2, cy + Math.sin(k * 1.05) * R * 0.2, 0.7);
            c.fill();
            c.fillStyle = 'rgba(255,255,255,0.35)';
            c.beginPath();
            c.ellipse(cx - 2, cy - 2.2, 1.6, 0.8, -0.6, 0, W_TAU);
            c.fill();
        }
    },

    // ── Fenster-Kacheln: fest, sitzen in der Wand; je Thema eigene Deko auf der Oberseite ──
    window(w, c, P, b, q, seed) {
        const cx = q.px + 16, cy = q.py + q.h / 2 + 0.5;
        const glow = P.glow;
        const frame = wcLight(P.wall, 0.25), ink = wcDark(P.wall, 0.55);
        const arch = (x0, y0, ww, hh) => {
            c.beginPath();
            c.moveTo(x0, y0 + hh);
            c.lineTo(x0, y0 + ww / 2);
            c.arc(x0 + ww / 2, y0 + ww / 2, ww / 2, Math.PI, 0);
            c.lineTo(x0 + ww, y0 + hh);
            c.closePath();
        };
        const disc = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); this._dot(c, x, y, r); c.fill(); };
        switch (P.win) {
            case 'gothic': case 'redglass': {
                const gc = P.win === 'gothic' ? '#ffcf6b' : '#ff4d6d';
                const hh = Math.min(17, q.h - 4), y0 = cy - hh / 2;
                c.fillStyle = ink; arch(cx - 8, y0 - 1, 16, hh + 2); c.fill();
                c.fillStyle = frame; arch(cx - 7, y0, 14, hh); c.fill();
                c.fillStyle = gc; arch(cx - 5, y0 + 2, 10, hh - 3); c.fill();
                c.fillStyle = wcLight(gc, 0.5); arch(cx - 3, y0 + 3.5, 4, hh - 7); c.fill();
                c.fillStyle = ink;
                c.fillRect(cx - 0.6, y0 + 2, 1.2, hh - 3);
                c.fillRect(cx - 5, y0 + hh * 0.55, 10, 1.2);
                this._glow(b, cx, cy, 18, glow, 0.4, true);
                break;
            }
            case 'porthole': case 'planet': {
                const r = Math.min(8.5, q.h / 2 - 1.5);
                disc(cx + 0.6, cy + 0.8, r + 1.6, ink);
                disc(cx, cy, r + 1.2, wcLight('#9aa8c4', 0.2));
                disc(cx, cy, r - 1, P.win === 'planet' ? '#120a3a' : '#1c6f9a');
                if (P.win === 'planet') {
                    disc(cx - 1, cy + 0.5, 3.6, '#ff9a4a');
                    this._line(c, '#ffe0a0', 1);
                    c.beginPath();
                    c.ellipse(cx - 1, cy + 0.5, 6, 1.8, -0.35, 0, W_TAU);
                    c.stroke();
                    c.fillStyle = '#ffffff';
                    c.fillRect(cx + 3.5, cy - 4, 1, 1);
                    c.fillRect(cx - 5, cy - 3, 0.9, 0.9);
                } else {
                    disc(cx, cy + 1, r - 2.5, '#58e6ff');
                    c.fillStyle = 'rgba(255,255,255,0.7)';
                    c.beginPath();
                    c.ellipse(cx - 2.5, cy - 2.5, 2.5, 1.3, -0.7, 0, W_TAU);
                    c.fill();
                }
                c.fillStyle = ink;
                for (let k = 0; k < 6; k++) c.fillRect(cx + Math.cos(k * 1.047) * (r + 0.2) - 0.6, cy + Math.sin(k * 1.047) * (r + 0.2) - 0.6, 1.2, 1.2);
                this._glow(b, cx, cy, 16, glow, 0.35, true);
                break;
            }
            case 'tank': {
                const hh = q.h - 5;
                c.fillStyle = ink;
                c.beginPath(); wRound(c, cx - 8, cy - hh / 2 - 1, 16, hh + 2, 4); c.fill();
                c.fillStyle = 'rgba(200,255,230,0.5)';
                c.beginPath(); wRound(c, cx - 7, cy - hh / 2, 14, hh, 3.5); c.fill();
                c.fillStyle = '#7dea4a';
                c.beginPath(); wRound(c, cx - 6, cy - hh / 2 + hh * 0.35, 12, hh * 0.65 - 1, 3); c.fill();
                this._line(c, 'rgba(255,255,255,0.8)', 0.8);
                c.beginPath();
                this._dot(c, cx - 2, cy + 2, 1.3); this._dot(c, cx + 2, cy - 1, 1);
                c.stroke();
                c.fillStyle = 'rgba(255,255,255,0.6)';
                c.fillRect(cx - 5.5, cy - hh / 2 + 1.5, 1.5, hh - 4);
                this._glow(b, cx, cy + 2, 16, glow, 0.4, true);
                break;
            }
            case 'mushlamp': {
                for (const [dx, dy, s] of [[-5, 2, 0.8], [4, 3, 0.7], [0, -2, 1]]) {
                    c.fillStyle = '#f6ecd6';
                    c.fillRect(cx + dx - 1.2 * s, cy + dy, 2.4 * s, 5 * s);
                    c.fillStyle = '#2a8aa8';
                    c.beginPath(); c.ellipse(cx + dx, cy + dy, 6 * s, 4.2 * s, 0, Math.PI, 0); c.fill();
                    c.fillStyle = '#6ff0ff';
                    c.beginPath(); c.ellipse(cx + dx, cy + dy - 0.5, 5.2 * s, 3.6 * s, 0, Math.PI, 0); c.fill();
                    c.fillStyle = '#e8ffff';
                    c.beginPath(); this._dot(c, cx + dx - 1.5 * s, cy + dy - 2 * s, 0.9 * s); c.fill();
                }
                this._glow(b, cx, cy, 18, glow, 0.45, true);
                break;
            }
            case 'firefly': case 'wisp': case 'stonelantern': case 'paperlantern': {
                const fl = P.win === 'wisp' ? '#77f08d' : (P.win === 'firefly' ? '#eaff7a' : '#ffcf6b');
                if (P.win === 'paperlantern') {
                    c.fillStyle = '#5a1a1a';
                    c.fillRect(cx - 0.6, cy - 10, 1.2, 4);
                    disc(cx, cy, 7.5, '#8a1f24');
                    c.fillStyle = '#e8373c';
                    c.beginPath(); c.ellipse(cx, cy, 6.8, 7, 0, 0, W_TAU); c.fill();
                    c.fillStyle = '#ff9a5a';
                    c.beginPath(); c.ellipse(cx - 1, cy, 3, 5, 0, 0, W_TAU); c.fill();
                    c.fillStyle = '#2a1414';
                    c.fillRect(cx - 4.5, cy - 7.5, 9, 2);
                    c.fillRect(cx - 4.5, cy + 5.5, 9, 2);
                } else if (P.win === 'stonelantern') {
                    c.fillStyle = ink;
                    c.fillRect(cx - 6, cy + 3, 12, 4);
                    c.fillStyle = '#c4ccdd';
                    c.fillRect(cx - 4.5, cy - 4, 9, 8);
                    c.fillStyle = fl;
                    c.fillRect(cx - 2.5, cy - 2.5, 5, 4.5);
                    c.fillStyle = '#9aa4ba';
                    c.beginPath(); c.moveTo(cx - 8, cy - 4); c.lineTo(cx, cy - 9); c.lineTo(cx + 8, cy - 4); c.closePath(); c.fill();
                } else {
                    c.fillStyle = '#3a2a1a';
                    c.fillRect(cx - 4, cy - 8, 8, 2.5);
                    c.fillStyle = 'rgba(210,255,230,0.35)';
                    c.beginPath(); wRound(c, cx - 5, cy - 6, 10, 12, 3); c.fill();
                    c.fillStyle = fl;
                    for (const [dx, dy] of [[-2, -2], [2, 1], [-1, 3], [1.5, -3.5]]) c.fillRect(cx + dx - 0.8, cy + dy - 0.8, 1.6, 1.6);
                    if (P.win === 'wisp') { c.beginPath(); c.ellipse(cx, cy, 2.5, 3.5, 0, 0, W_TAU); c.fill(); }
                }
                this._glow(b, cx, cy, 17, glow || fl, 0.5, true);
                break;
            }
            case 'crystal': case 'rune': {
                if (P.win === 'rune') {
                    c.fillStyle = ink;
                    c.beginPath(); wRound(c, cx - 7, cy - 8, 14, 16, 3); c.fill();
                    c.fillStyle = wcLight(P.wall, 0.12);
                    c.beginPath(); wRound(c, cx - 6, cy - 7, 12, 14, 2.5); c.fill();
                    this._line(c, glow, 1.4);
                    c.beginPath();
                    c.moveTo(cx, cy - 5); c.lineTo(cx, cy + 5);
                    c.moveTo(cx - 3.5, cy - 2); c.lineTo(cx, cy + 1); c.lineTo(cx + 3.5, cy - 2);
                    c.stroke();
                } else {
                    this.decoItem(c, { ...P, accent: glow }, b, 'crystal', cx - 1, cy + 4, wRng(q.x * 13 + q.y * 7));
                }
                this._glow(b, cx, cy, 16, glow, 0.45, true);
                break;
            }
            case 'lava': {
                c.fillStyle = '#2a0c14';
                c.beginPath(); c.ellipse(cx, cy, 9, Math.min(7.5, q.h / 2 - 1), 0, 0, W_TAU); c.fill();
                c.fillStyle = '#ff5a1f';
                c.beginPath(); c.ellipse(cx, cy + 0.5, 7, Math.min(5.5, q.h / 2 - 2.5), 0, 0, W_TAU); c.fill();
                c.fillStyle = '#ffd23f';
                c.beginPath(); c.ellipse(cx - 1, cy, 3.5, 2.5, 0.3, 0, W_TAU); c.fill();
                this._glow(b, cx, cy, 18, glow, 0.55, true);
                break;
            }
            case 'crate': {
                c.fillStyle = '#7a4a24';
                c.beginPath(); wRound(c, cx - 9, cy - 7, 18, 14, 2); c.fill();
                c.fillStyle = '#c8874a';
                c.fillRect(cx - 8, cy - 6, 16, 3);
                c.fillRect(cx - 8, cy + 3, 16, 3);
                for (const [dx, dy, col] of [[-4, -1, '#e8323c'], [0, -2, '#ff9a1f'], [4, -1, '#e8323c'], [-2, 1, '#ffd23f'], [2.5, 1, '#e8323c']]) {
                    disc(cx + dx, cy + dy, 2.4, col);
                }
                break;
            }
            case 'qblock': {
                c.fillStyle = '#7a4a10';
                c.fillRect(cx - 8, cy - 8, 16, 16);
                c.fillStyle = '#ffc21f';
                c.fillRect(cx - 7, cy - 7, 14, 14);
                c.fillStyle = '#ffe680';
                c.fillRect(cx - 7, cy - 7, 14, 2);
                c.fillRect(cx - 7, cy - 7, 2, 14);
                c.fillStyle = '#b86a10';
                for (const [dx, dy] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) c.fillRect(cx + dx, cy + dy, 1.4, 1.4);
                c.fillStyle = '#7a4a10';
                c.fillRect(cx - 2.5, cy - 4.5, 5, 1.6);
                c.fillRect(cx + 1.2, cy - 3.5, 1.6, 3);
                c.fillRect(cx - 0.8, cy - 1, 2.2, 1.6);
                c.fillRect(cx - 0.8, cy + 0.2, 1.6, 1.8);
                c.fillRect(cx - 0.8, cy + 3, 1.6, 1.6);
                this._glow(b, cx, cy, 15, glow, 0.3, false);
                break;
            }
            case 'fossil': this._skullShape(c, cx, cy - 1, 6.5, P.bone, 0.15); break;
            case 'egg': {
                c.fillStyle = '#8a5a2a';
                c.beginPath(); c.ellipse(cx, cy + 3, 10, 5, 0, 0, W_TAU); c.fill();
                c.fillStyle = '#c8904a';
                c.beginPath(); c.ellipse(cx, cy + 2.5, 8, 3.6, 0, 0, W_TAU); c.fill();
                for (const [dx, s] of [[-3.5, 0.9], [3, 1]]) {
                    c.fillStyle = '#f4ecd6';
                    c.beginPath(); c.ellipse(cx + dx, cy - 1, 3.6 * s, 4.8 * s, 0, 0, W_TAU); c.fill();
                    c.fillStyle = '#6fbf4a';
                    c.beginPath(); this._dot(c, cx + dx - 1, cy - 2, 0.9); this._dot(c, cx + dx + 1.2, cy + 0.5, 0.8); c.fill();
                }
                break;
            }
            case 'clock': {
                disc(cx + 0.6, cy + 0.8, 9.2, ink);
                disc(cx, cy, 8.8, '#ffd23f');
                disc(cx, cy, 7.2, '#fffaf0');
                c.fillStyle = '#2a3a6a';
                for (let k = 0; k < 12; k++) {
                    const a = k * W_TAU / 12;
                    c.fillRect(cx + Math.cos(a) * 5.6 - 0.5, cy + Math.sin(a) * 5.6 - 0.5, 1, 1);
                }
                b.anim.push({ k: 'clock', px: cx, py: cy, ph: wHash(q.x, q.y, 5) * 6 });
                this._glow(b, cx, cy, 15, glow, 0.25, false);
                break;
            }
            case 'flood': {
                c.fillStyle = '#23283a';
                c.beginPath(); wRound(c, cx - 9, cy - 7, 18, 14, 2); c.fill();
                c.fillStyle = '#fffbe0';
                for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { c.beginPath(); this._dot(c, cx - 5 + k * 5, cy - 2.5 + j * 5, 1.8); c.fill(); }
                this._glow(b, cx, cy, 20, glow, 0.5, true);
                break;
            }
            case 'tv': {
                c.fillStyle = '#3a3f55';
                c.beginPath(); wRound(c, cx - 9, cy - 7.5, 18, 15, 3); c.fill();
                const bars = ['#ffffff', '#ffd23f', '#4cf0ff', '#5aff7a', '#ff5ad8', '#ff4d4d'];
                bars.forEach((bc, k) => { c.fillStyle = bc; c.fillRect(cx - 7 + k * 2.2, cy - 5.5, 2.2, 9); });
                c.fillStyle = '#8a90a8';
                c.fillRect(cx + 6.5, cy - 4, 1.5, 1.5);
                c.fillRect(cx + 6.5, cy - 1, 1.5, 1.5);
                b.anim.push({ k: 'tv', px: cx, py: cy, ph: wHash(q.x, q.y, 7) * 6 });
                this._glow(b, cx, cy, 15, glow, 0.3, true);
                break;
            }
            case 'target': {
                for (const [r, col] of [[8.5, '#b8202a'], [7.5, '#ff3d4a'], [5.5, '#ffffff'], [3.5, '#ff3d4a'], [1.6, '#ffd23f']]) disc(cx, cy, r, col);
                break;
            }
            case 'school': {
                if (wHash(q.x, q.y, seed + 811) < 0.34) {
                    // Tafel mit Kreide: „1+1=“ und ein Gehirn (Zombie-Mathe)
                    c.fillStyle = '#5a3a20';
                    c.beginPath(); wRound(c, cx - 11, cy - 7.5, 22, 15, 2); c.fill();
                    c.fillStyle = '#2f6a4c';
                    c.fillRect(cx - 9.5, cy - 6, 19, 11);
                    c.fillStyle = 'rgba(255,255,255,0.08)';
                    c.fillRect(cx - 9.5, cy - 6, 19, 3);
                    this._line(c, 'rgba(255,255,255,0.85)', 0.8);
                    c.beginPath();
                    c.moveTo(cx - 8, cy - 2.6); c.lineTo(cx - 7, cy - 3.6); c.lineTo(cx - 7, cy + 1);
                    c.moveTo(cx - 5.6, cy - 1.3); c.lineTo(cx - 3, cy - 1.3); c.moveTo(cx - 4.3, cy - 2.6); c.lineTo(cx - 4.3, cy);
                    c.moveTo(cx - 2, cy - 2.6); c.lineTo(cx - 1, cy - 3.6); c.lineTo(cx - 1, cy + 1);
                    c.moveTo(cx + 0.5, cy - 2); c.lineTo(cx + 3, cy - 2); c.moveTo(cx + 0.5, cy - 0.6); c.lineTo(cx + 3, cy - 0.6);
                    c.stroke();
                    c.fillStyle = '#ff9ad0';
                    c.beginPath();
                    for (const [dx, dy, r] of [[5.2, -1.8, 1.6], [7, -2.2, 1.7], [6.2, -0.6, 1.6], [7.8, -0.9, 1.3]]) this._dot(c, cx + dx, cy + dy, r);
                    c.fill();
                    this._line(c, '#d85a9a', 0.5);
                    c.beginPath();
                    c.moveTo(cx + 4.6, cy - 1.4); c.quadraticCurveTo(cx + 6, cy - 2.6, cx + 7.4, cy - 1.2);
                    c.stroke();
                    c.fillStyle = '#c8a070';
                    c.fillRect(cx - 9.5, cy + 5, 19, 1.4);
                    c.fillStyle = '#ffffff';
                    c.fillRect(cx + 4, cy + 4.4, 3, 0.9);
                    break;
                }
                // Hohes Schulfenster: Nachthimmel mit Vollmond und Sternen
                const hh = Math.min(19, q.h - 3), y0 = cy - hh / 2;
                c.fillStyle = ink; arch(cx - 8.5, y0 - 1, 17, hh + 2); c.fill();
                c.fillStyle = frame; arch(cx - 7.5, y0, 15, hh); c.fill();
                c.fillStyle = '#1c2766'; arch(cx - 6.3, y0 + 1.2, 12.6, hh - 2.2); c.fill();
                c.save();
                arch(cx - 6.3, y0 + 1.2, 12.6, hh - 2.2);
                c.clip();
                disc(cx + 1.4, y0 + 7, 6, wcA('#fff6c8', 0.18));
                disc(cx + 1.4, y0 + 7, 4.4, '#fff3b0');
                c.fillStyle = 'rgba(214,190,110,0.6)';
                c.beginPath();
                this._dot(c, cx + 0.2, y0 + 6.2, 1);
                this._dot(c, cx + 2.8, y0 + 8.4, 0.7);
                this._dot(c, cx + 2.2, y0 + 5.4, 0.5);
                c.fill();
                c.fillStyle = '#ffffff';
                c.fillRect(cx - 4.6, y0 + 11, 0.9, 0.9);
                c.fillRect(cx - 3, y0 + 4.5, 0.8, 0.8);
                c.fillRect(cx + 3.6, y0 + 14, 0.8, 0.8);
                c.restore();
                c.fillStyle = frame;
                c.fillRect(cx - 0.5, y0 + 1.2, 1, hh - 2.2);
                c.fillRect(cx - 6.3, y0 + hh * 0.6, 12.6, 1);
                c.fillStyle = wcLight(frame, 0.35);
                c.fillRect(cx - 8, y0 + hh - 1.2, 16, 1.6);
                // Mondlicht: schwächer als Laternen, damit der Mond sichtbar bleibt
                this._glow(b, cx + 1.4, y0 + 7, 14, glow, 0.24, true);
                break;
            }
            case 'rainbow': {
                if (wHash(q.x, q.y, seed + 821) < 0.5) {
                    // Regenbogen mit zwei Wölkchen
                    const by = cy + 5;
                    ['#ff5a6a', '#ffa03a', '#ffe14a', '#6ad86a', '#4cb2ff', '#a78cff'].forEach((col, k) => {
                        this._line(c, col, 1.8);
                        c.beginPath();
                        c.arc(cx, by, 10.5 - k * 1.6, Math.PI, 0);
                        c.stroke();
                    });
                    for (const s of [-1, 1]) {
                        c.fillStyle = 'rgba(60,90,140,0.25)';
                        c.beginPath();
                        this._dot(c, cx + s * 8.6 + 0.6, by + 1, 3);
                        c.fill();
                        c.fillStyle = '#ffffff';
                        c.beginPath();
                        this._dot(c, cx + s * 9.5, by, 2.6);
                        this._dot(c, cx + s * 7, by + 0.6, 2.2);
                        this._dot(c, cx + s * 11.6, by + 0.8, 1.8);
                        c.fill();
                    }
                } else {
                    // Rundes Blütenfenster mit Himmel
                    const pc = P.petals[Math.floor(wHash(q.y, q.x, seed + 823) * 4)];
                    for (const [cc, o] of [[wcDark(pc, 0.35), 0.6], [pc, 0]]) {
                        c.fillStyle = cc;
                        c.beginPath();
                        for (let k = 0; k < 8; k++) this._dot(c, cx + o + Math.cos(k * W_TAU / 8) * 7.6, cy + o + Math.sin(k * W_TAU / 8) * 7.6, 3.6);
                        c.fill();
                    }
                    disc(cx, cy, 7, wcDark(pc, 0.3));
                    disc(cx, cy, 6.2, '#8fd4ff');
                    disc(cx - 1.5, cy + 2, 2.2, '#ffffff');
                    disc(cx + 1, cy + 2.4, 1.8, '#ffffff');
                    disc(cx + 2.8, cy + 2, 1.3, '#ffffff');
                    c.fillStyle = 'rgba(255,255,255,0.7)';
                    c.beginPath();
                    c.ellipse(cx - 2.4, cy - 3, 2.2, 1, -0.6, 0, W_TAU);
                    c.fill();
                }
                this._glow(b, cx, cy, 16, glow, 0.22, false);
                break;
            }
            case 'cave': {
                if (this._zone(w, q.x, q.y) === 3 || wHash(q.x, q.y, seed + 831) < 0.25) {
                    // Leuchtendes Kristallfenster: großer Kristall in einer dunklen Nische
                    const cc = ['#c77dff', '#ff8ad8', '#6ff0ff'][Math.floor(wHash(q.y, q.x, seed + 833) * 3)];
                    const hh = Math.min(8, q.h / 2 - 1.5), base = cy + hh * 0.8;
                    c.fillStyle = ink;
                    c.beginPath(); c.ellipse(cx, cy + 1, 9.5, hh + 1, 0, 0, W_TAU); c.fill();
                    c.fillStyle = '#140a24';
                    c.beginPath(); c.ellipse(cx, cy + 1, 8, hh, 0, 0, W_TAU); c.fill();
                    for (const [ox, hgt, wd] of [[-3.5, hh * 1.3, 2.6], [3.4, hh * 1.1, 2.4], [0, hh * 1.75, 3.4]]) {
                        c.fillStyle = wcDark(cc, 0.2);
                        c.beginPath();
                        c.moveTo(cx + ox - wd, base); c.lineTo(cx + ox - wd * 0.6, base - hgt * 0.8); c.lineTo(cx + ox, base - hgt);
                        c.lineTo(cx + ox + wd * 0.6, base - hgt * 0.8); c.lineTo(cx + ox + wd, base); c.closePath();
                        c.fill();
                        c.fillStyle = wcLight(cc, 0.35);
                        c.beginPath();
                        c.moveTo(cx + ox - wd * 0.55, base); c.lineTo(cx + ox - wd * 0.35, base - hgt * 0.78); c.lineTo(cx + ox, base - hgt); c.lineTo(cx + ox, base); c.closePath();
                        c.fill();
                    }
                    this._glow(b, cx, cy, 17, cc, 0.45, true);
                    break;
                }
                // Höhlenöffnung: Abendhimmel mit Bergen, ganz weit weg fliegt ein kleiner Drache
                const hh = Math.min(17, q.h - 4), ww = 19, x0 = cx - ww / 2, y0 = cy - hh / 2;
                const hole = g => {
                    c.beginPath();
                    c.moveTo(x0 + 2 - g, y0 + hh + g);
                    c.lineTo(x0 - g, y0 + hh * 0.5);
                    c.quadraticCurveTo(x0 - g, y0 - g, x0 + ww * 0.45, y0 - g);
                    c.quadraticCurveTo(x0 + ww + g, y0 - g * 0.5, x0 + ww + g, y0 + hh * 0.55);
                    c.lineTo(x0 + ww - 1.5 + g, y0 + hh + g);
                    c.closePath();
                };
                c.fillStyle = ink;
                hole(1.4);
                c.fill();
                c.save();
                hole(0);
                c.clip();
                ['#2c2466', '#5a3486', '#b0507e', '#ff9a64'].forEach((bc, k) => {
                    c.fillStyle = bc;
                    c.fillRect(x0 - 2, y0 - 2 + k * (hh + 4) / 4, ww + 4, (hh + 4) / 4 + 0.5);
                });
                c.fillStyle = '#ffffff';
                c.fillRect(x0 + 4, y0 + 2.5, 0.9, 0.9);
                c.fillRect(x0 + 15, y0 + 3.5, 0.8, 0.8);
                this._line(c, '#2a1a3e', 0.8);
                c.beginPath();
                c.moveTo(x0 + 8.5, y0 + 5.5); c.quadraticCurveTo(x0 + 9.7, y0 + 4.4, x0 + 10.7, y0 + 5.6);
                c.quadraticCurveTo(x0 + 11.7, y0 + 4.4, x0 + 12.9, y0 + 5.5);
                c.stroke();
                c.fillStyle = '#3a2350';
                c.beginPath();
                c.moveTo(x0 - 2, y0 + hh + 2); c.lineTo(x0 - 2, y0 + hh * 0.72); c.lineTo(x0 + 4, y0 + hh * 0.45); c.lineTo(x0 + 8, y0 + hh * 0.68);
                c.lineTo(x0 + 13, y0 + hh * 0.35); c.lineTo(x0 + ww + 2, y0 + hh * 0.75); c.lineTo(x0 + ww + 2, y0 + hh + 2); c.closePath();
                c.fill();
                c.fillStyle = '#f2f4ff';
                c.beginPath();
                c.moveTo(x0 + 13, y0 + hh * 0.35); c.lineTo(x0 + 15.2, y0 + hh * 0.46); c.lineTo(x0 + 13.9, y0 + hh * 0.43);
                c.lineTo(x0 + 12.8, y0 + hh * 0.49); c.lineTo(x0 + 11.2, y0 + hh * 0.47); c.closePath();
                c.fill();
                c.fillStyle = '#26183a';
                c.beginPath();
                c.moveTo(x0 - 2, y0 + hh + 2); c.lineTo(x0 - 2, y0 + hh * 0.86); c.lineTo(x0 + 6, y0 + hh * 0.78); c.lineTo(x0 + 11, y0 + hh * 0.9);
                c.lineTo(x0 + ww + 2, y0 + hh * 0.8); c.lineTo(x0 + ww + 2, y0 + hh + 2); c.closePath();
                c.fill();
                c.restore();
                this._line(c, wcA(wcLight(P.wall, 0.35), 0.7), 1);
                hole(0.6);
                c.stroke();
                this._glow(b, cx, cy + 3, 16, glow, 0.3, true);
                break;
            }
        }
    },

    // ── Verschlossene Boss-Tür: schweres Tor, Siegel wird pro Bild animiert ──
    bossDoor(w, c, P, b, q) {
        const T = TILE_SIZE, px = q.px, py = q.py, h = q.h;
        c.fillStyle = '#3a1030';
        c.fillRect(px, py, T, h);
        c.fillStyle = '#7a1f4a';
        c.beginPath(); wRound(c, px + 2.5, py + 2, T - 5, h - 3, 3); c.fill();
        c.fillStyle = '#9a2f5e';
        c.fillRect(px + 4, py + 3.5, T - 8, 2);
        this._line(c, '#ffd23f', 1.6);
        c.beginPath(); wRound(c, px + 3.5, py + 3, T - 7, h - 5, 2.5); c.stroke();
        c.fillStyle = '#ffd23f';
        c.beginPath();
        for (const [dx, dy] of [[6.5, 6], [T - 6.5, 6], [6.5, h - 5], [T - 6.5, h - 5]]) this._dot(c, px + dx, py + dy, 1.3);
        c.fill();
        if (q.front) {
            c.fillStyle = '#4a1238';
            c.fillRect(px, py + h, T, WALL_FRONT);
            c.fillStyle = '#ffd23f';
            c.fillRect(px, py + h, T, 1.5);
            c.fillRect(px + 15, py + h + 2, 2, WALL_FRONT - 4);
        }
        b.anim.push({ k: 'seal', px: px + 16, py: py + h / 2 + 0.5 });
    },

    // ── Pro Bild: Animationen (nur sichtbare Kacheln) ──
    anim(w, ctx, camera, a) {
        const P = w.palette, t = Art.time;
        const p = camera.worldToScreen(a.px, a.py);
        switch (a.k) {
            case 'glow':
                Art.glow(ctx, p.x, p.y, a.r, a.col, a.a * (0.75 + 0.25 * Math.sin(t * 2.2 + a.ph)));
                break;
            case 'water': {
                const kind = P.water, [, , light] = P.wc;
                const tt = t + a.ph;
                if (kind === 'lava' || kind === 'goo') {
                    for (let k = 0; k < 2; k++) {
                        const ph = (tt * 0.7 + k * 0.5) % 1;
                        const bx = p.x - 8 + ((k * 13 + Math.floor(tt * 0.7 + k * 0.5) * 7) % 16), by = p.y + 2 - k * 4;
                        ctx.globalAlpha = 1 - ph;
                        ctx.strokeStyle = light;
                        ctx.lineWidth = 1.2;
                        ctx.beginPath();
                        ctx.arc(bx, by, 1 + ph * 3.5, 0, W_TAU);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                } else if (kind === 'void' || kind === 'plasma') {
                    for (let k = 0; k < 2; k++) {
                        const s = 0.5 + 0.5 * Math.sin(tt * 3 + k * 2.4);
                        Art.sparkle(ctx, p.x - 7 + k * 13, p.y - 3 + k * 7, 1.5 + s * 2, light, s);
                    }
                } else {
                    ctx.strokeStyle = wcA(light, 0.6);
                    ctx.lineWidth = 1.2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    for (let k = 0; k < 2; k++) {
                        const xx = p.x - 12 + ((tt * 5 + k * 11) % 18), yy = p.y - 2 + k * 8 + (a.top ? 2 : 0);
                        ctx.moveTo(xx, yy);
                        ctx.quadraticCurveTo(xx + 3, yy - 2, xx + 6, yy);
                    }
                    ctx.stroke();
                    if (kind === 'koi' && ((a.x * 7 + a.y * 3) % 3) === 0) {
                        const ang = tt * 0.9, fx = p.x + Math.cos(ang) * 7, fy = p.y + 2 + Math.sin(ang) * 5;
                        ctx.save();
                        ctx.translate(fx, fy);
                        ctx.rotate(ang + Math.PI / 2);
                        ctx.fillStyle = '#ff8a2e';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, 3.6, 1.8, 0, 0, W_TAU);
                        ctx.moveTo(-3, 0); ctx.lineTo(-6, -2); ctx.lineTo(-6, 2); ctx.closePath();
                        ctx.fill();
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, -1, 1.5, 1);
                        ctx.restore();
                    }
                }
                break;
            }
            case 'pad': {
                const bounce = Math.abs(Math.sin(t * 3.2)) * 3;
                Art.glow(ctx, p.x, p.y, 16, P.accent, 0.18 + 0.08 * Math.sin(t * 4));
                for (let k = 0; k < 2; k++) {
                    const yy = p.y - 1 - bounce - k * 4.5;
                    ctx.strokeStyle = 'rgba(40,20,60,0.7)';
                    ctx.lineWidth = 3.4;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(p.x - 4, yy + 3); ctx.lineTo(p.x, yy - 1); ctx.lineTo(p.x + 4, yy + 3);
                    ctx.stroke();
                    ctx.strokeStyle = k ? '#ffffff' : '#ffe45c';
                    ctx.lineWidth = 1.8;
                    ctx.stroke();
                }
                break;
            }
            case 'seal': {
                // Leuchtendes Siegel mit Schlüssel: „Hier brauchst du den Schlüssel!“
                const s = 0.5 + 0.5 * Math.sin(t * 3);
                Art.glow(ctx, p.x, p.y, 24 + s * 6, '#ffd23f', 0.4 + s * 0.3);
                ctx.fillStyle = '#4a1240';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 9.6, 0, W_TAU);
                ctx.fill();
                ctx.strokeStyle = '#ffd23f';
                ctx.lineWidth = 1.8;
                ctx.stroke();
                ctx.save();
                ctx.strokeStyle = wcA('#ffe89a', 0.8);
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2.4]);
                ctx.lineDashOffset = -t * 5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 7.2, 0, W_TAU);
                ctx.stroke();
                ctx.restore();
                this._keyIcon(ctx, p.x + 0.3, p.y, 1 + s * 0.08);
                break;
            }
            case 'fire': {
                const f = Math.sin(t * 9 + a.ph) * 0.5 + Math.sin(t * 13.7 + a.ph) * 0.5;
                Art.glow(ctx, p.x, p.y - 3, 15 + f * 2, '#ff9a3c', 0.45);
                const h = 7.5 + f * 1.4;
                ctx.fillStyle = '#ff6a1f';
                ctx.beginPath();
                ctx.moveTo(p.x - 3.8, p.y);
                ctx.quadraticCurveTo(p.x - 3.5, p.y - h * 0.6, p.x + f * 0.8, p.y - h);
                ctx.quadraticCurveTo(p.x + 3.5, p.y - h * 0.6, p.x + 3.8, p.y);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffe066';
                ctx.beginPath();
                ctx.moveTo(p.x - 2, p.y);
                ctx.quadraticCurveTo(p.x - 1.8, p.y - h * 0.4, p.x + f * 0.5, p.y - h * 0.65);
                ctx.quadraticCurveTo(p.x + 1.8, p.y - h * 0.4, p.x + 2, p.y);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'door': {
                const s = 0.5 + 0.5 * Math.sin(t * 2.5);
                Art.glow(ctx, p.x, p.y, 26 + s * 6, '#ffd23f', 0.35 + s * 0.2);
                for (let k = 0; k < 3; k++) {
                    const ph = (t * 0.6 + k / 3) % 1;
                    Art.sparkle(ctx, p.x - 8 + k * 8, p.y + 10 - ph * 22, 1.6 + (1 - ph) * 1.4, '#fff6c8', 1 - ph);
                }
                ctx.strokeStyle = '#fff3b0';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.globalAlpha = 0.5 + s * 0.5;
                ctx.beginPath();
                const yy = p.y - 2 + s * 3;
                ctx.moveTo(p.x - 4, yy); ctx.lineTo(p.x, yy + 4); ctx.lineTo(p.x + 4, yy);
                ctx.stroke();
                ctx.globalAlpha = 1;
                break;
            }
            case 'clock': {
                const ang = t * 1.4 + a.ph, ang2 = t * 0.12 + a.ph;
                ctx.strokeStyle = '#1b2a55';
                ctx.lineCap = 'round';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(ang) * 5.2, p.y + Math.sin(ang) * 5.2);
                ctx.stroke();
                ctx.lineWidth = 1.7;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(ang2) * 3.4, p.y + Math.sin(ang2) * 3.4);
                ctx.stroke();
                ctx.fillStyle = '#ff4d6d';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1, 0, W_TAU);
                ctx.fill();
                break;
            }
            case 'tv': {
                const yy = p.y - 5.5 + ((t * 9 + a.ph) % 9);
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.fillRect(p.x - 7, yy, 13.2, 1.2);
                break;
            }
        }
    },

    // Ladering um das Sprungfeld, auf dem Mark steht (über den Figuren, damit man ihn sieht)
    padRing(ctx, camera, tx, ty, k) {
        const p = camera.worldToScreen(tx * TILE_SIZE + 16, ty * TILE_SIZE + 16);
        const r = 19;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(30,10,50,0.6)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, W_TAU);
        ctx.stroke();
        ctx.strokeStyle = k > 0.8 && Math.sin(Art.time * 20) > 0 ? '#ffffff' : '#ffe45c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + k * W_TAU);
        ctx.stroke();
        ctx.restore();
    },

    // Goldener Schlüssel mit dunklem Umriss (Siegel der Boss-Tür)
    _keyIcon(ctx, x, y, s) {
        const path = () => {
            ctx.beginPath();
            ctx.arc(x - 3.3 * s, y, 2.8 * s, 0, W_TAU);
            ctx.moveTo(x - 3.3 * s + 1.1 * s, y);
            ctx.arc(x - 3.3 * s, y, 1.1 * s, 0, W_TAU, true);
            ctx.rect(x - 0.9 * s, y - 0.95 * s, 5.8 * s, 1.9 * s);
            ctx.rect(x + 2.4 * s, y + 0.9 * s, 1.1 * s, 1.9 * s);
            ctx.rect(x + 3.9 * s, y + 0.9 * s, 1.1 * s, 1.4 * s);
        };
        path();
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#5a2a00';
        ctx.stroke();
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(x - 4.1 * s, y - 1.2 * s, 0.8 * s, 0, W_TAU);
        ctx.fill();
    },

    // Boss-Arena: laufender Leuchtring (nur wenn sichtbar)
    arenaAnim(w, ctx, camera) {
        const T = TILE_SIZE;
        const cx = (w.width - 8) * T + T / 2, cy = (w.height - 7) * T + T / 2;
        if (cx + 150 < camera.x || cx - 150 > camera.x + camera.width || cy + 150 < camera.y || cy - 150 > camera.y + camera.height) return;
        const p = camera.worldToScreen(cx, cy), t = Art.time, col = w.palette.arena || w.palette.accent;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2.2);
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 14]);
        ctx.lineDashOffset = -t * 22;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 130, 0, W_TAU);
        ctx.stroke();
        ctx.restore();
    },

    // Abdunklung für dunkle Welten: großes Bild (doppelte Sichtgröße) mit hellem Kreis in der Mitte
    lightSprite(viewW, viewH, col, strength) {
        const cv = document.createElement('canvas');
        cv.width = 256;
        cv.height = Math.max(64, Math.round(256 * viewH / viewW));
        const g = cv.getContext('2d');
        const k = cv.width / (2 * viewW);
        const grad = g.createRadialGradient(cv.width / 2, cv.height / 2, viewH * 0.2 * k, cv.width / 2, cv.height / 2, viewW * 0.8 * k);
        grad.addColorStop(0, wcA(col, 0));
        grad.addColorStop(0.35, wcA(col, strength * 0.5));
        grad.addColorStop(1, wcA(col, strength));
        g.fillStyle = grad;
        g.fillRect(0, 0, cv.width, cv.height);
        return cv;
    },
};

// ── Procedural Level Generator ──
// Generates large, explorable maps with rooms, corridors, and special areas

function generateLevel(width, height, numRooms, seed) {
    const W = TILE_WALL, F = TILE_FLOOR, D = TILE_DOOR, B = TILE_BOSS_DOOR;
    const S = TILE_SPAWN, BS = TILE_BOSS_SPAWN, WN = TILE_WINDOW;

    // Simple seeded random
    let s = seed || 42;
    function rand() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }
    function randI(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }

    // Start with all walls
    const map = [];
    for (let y = 0; y < height; y++) {
        map[y] = [];
        for (let x = 0; x < width; x++) map[y][x] = W;
    }

    // Carve a room
    function carveRoom(rx, ry, rw, rh) {
        for (let y = ry; y < ry + rh && y < height - 1; y++) {
            for (let x = rx; x < rx + rw && x < width - 1; x++) {
                if (x > 0 && y > 0) map[y][x] = F;
            }
        }
    }

    // Add windows to room walls
    function addWindows(rx, ry, rw, rh) {
        // Top and bottom walls
        for (let x = rx + 2; x < rx + rw - 2; x += randI(3, 5)) {
            if (ry > 0 && map[ry - 1] && map[ry - 1][x] === W) map[ry - 1][x] = WN;
            if (ry + rh < height && map[ry + rh] && map[ry + rh][x] === W) map[ry + rh][x] = WN;
        }
        // Left and right walls
        for (let y = ry + 2; y < ry + rh - 2; y += randI(3, 5)) {
            if (rx > 0 && map[y][rx - 1] === W) map[y][rx - 1] = WN;
            if (rx + rw < width && map[y][rx + rw] === W) map[y][rx + rw] = WN;
        }
    }

    // Carve corridor between two points
    function carveCorridor(x1, y1, x2, y2) {
        let x = x1, y = y1;
        while (x !== x2) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                map[y][x] = F;
                if (y + 1 < height - 1) map[y + 1][x] = F;
            }
            x += x < x2 ? 1 : -1;
        }
        while (y !== y2) {
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                map[y][x] = F;
                if (x + 1 < width - 1) map[y][x + 1] = F;
            }
            y += y < y2 ? 1 : -1;
        }
    }

    // Generate rooms
    const rooms = [];
    for (let i = 0; i < numRooms; i++) {
        const rw = randI(5, 10);
        const rh = randI(5, 8);
        const rx = randI(2, width - rw - 2);
        const ry = randI(2, height - rh - 2);
        carveRoom(rx, ry, rw, rh);
        addWindows(rx, ry, rw, rh);
        rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2) });
    }

    // Sort rooms by position for corridor connection
    rooms.sort((a, b) => a.cx + a.cy - b.cx - b.cy);

    // Connect rooms with corridors
    for (let i = 0; i < rooms.length - 1; i++) {
        carveCorridor(rooms[i].cx, rooms[i].cy, rooms[i + 1].cx, rooms[i + 1].cy);
    }
    // Extra corridors for loops
    for (let i = 0; i < Math.floor(rooms.length / 3); i++) {
        const a = randI(0, rooms.length - 1);
        const b = randI(0, rooms.length - 1);
        if (a !== b) carveCorridor(rooms[a].cx, rooms[a].cy, rooms[b].cx, rooms[b].cy);
    }

    // Place spawn in first room
    map[rooms[0].cy][rooms[0].cx] = S;

    // ── Boss room: FIXED position at bottom-right, fully isolated ──
    const bossW = 12, bossH = 10;
    const bx1 = width - bossW - 2;
    const by1 = height - bossH - 2;
    const bx2 = width - 2;
    const by2 = height - 2;
    const bossCx = bx1 + Math.floor(bossW / 2);
    const bossCy = by1 + Math.floor(bossH / 2);

    // Clear entire boss area + wall border (overwrite everything)
    for (let y = by1 - 1; y <= by2 + 1; y++) {
        for (let x = bx1 - 1; x <= bx2 + 1; x++) {
            if (y < 0 || y >= height || x < 0 || x >= width) continue;
            if (y <= by1 || y >= by2 || x <= bx1 || x >= bx2) {
                map[y][x] = W;
            } else {
                map[y][x] = F;
            }
        }
    }

    // Windows on boss room walls
    for (let x = bx1 + 3; x < bx2 - 2; x += 3) {
        map[by1][x] = WN;
        map[by2][x] = WN;
    }
    for (let y = by1 + 3; y < by2 - 2; y += 3) {
        map[y][bx1] = WN;
        map[y][bx2] = WN;
    }

    // Boss spawn in center
    map[bossCy][bossCx] = BS;

    // Boss door: single entry on the TOP wall
    const doorX = bossCx;
    const doorY = by1;
    map[doorY][doorX] = B;

    // Antechamber: small room above boss door
    for (let y = doorY - 4; y < doorY; y++) {
        for (let x = doorX - 3; x <= doorX + 3; x++) {
            if (y >= 0 && x >= 0 && x < width) map[y][x] = F;
        }
    }

    // Corridor from nearest regular room to antechamber.
    // Räume, deren Mitte im Boss-Bereich liegt, zählen nicht: ihr Gang würde beim
    // Nachziehen der Bossraum-Wände wieder zugemauert (so war Welt 21 unschaffbar).
    const inBossArea = r => r.cx >= bx1 - 1 && r.cx <= bx2 + 1 && r.cy >= by1 - 1 && r.cy <= by2 + 1;
    let nearestRoom = rooms.find(r => !inBossArea(r)) || rooms[0];
    let nearestDist = 99999;
    for (const r of rooms) {
        if (inBossArea(r)) continue;
        const d = Math.abs(r.cx - doorX) + Math.abs(r.cy - (doorY - 3));
        if (d < nearestDist) { nearestDist = d; nearestRoom = r; }
    }
    carveCorridor(nearestRoom.cx, nearestRoom.cy, doorX, doorY - 3);

    const enforceBossRoom = () => {
        // Re-enforce boss door and spawn (corridor may have overwritten them)
        map[doorY][doorX] = B;
        map[bossCy][bossCx] = BS;
        // Re-enforce boss room walls (corridor may have broken through)
        for (let y = by1; y <= by2; y++) {
            for (let x = bx1; x <= bx2; x++) {
                if (y === by1 || y === by2 || x === bx1 || x === bx2) {
                    if (map[y][x] !== B) map[y][x] = W;
                } else if (map[y][x] !== BS) {
                    map[y][x] = F;
                }
            }
        }
    };
    enforceBossRoom();

    // Sicherheitsnetz: ist die Boss-Tür vom Start aus nicht erreichbar, direkten Gang vom
    // Startraum zur Vorkammer graben (am Boss-Raum vorbei über dessen Oberkante).
    if (!bossDoorReachable(map)) {
        carveCorridor(rooms[0].cx, rooms[0].cy, doorX, Math.max(1, by1 - 3));
        carveCorridor(doorX, Math.max(1, by1 - 3), doorX, doorY - 1);
        map[rooms[0].cy][rooms[0].cx] = S;
        enforceBossRoom();
    }

    return map;
}

// ── Level Data ──

function sprinkleSpecialTiles(map) {
    const height = map.length;
    const width = map[0].length;
    const randI = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const door = findTile(map, TILE_BOSS_DOOR);
    const place = (type, count, edgeSafe) => {
        let placed = 0;
        let guard = 0;
        while (placed < count && guard < count * 60) {
            guard++;
            const x = randI(2, width - 3);
            const y = randI(2, height - 3);
            if (x > width - 14 && y > height - 12) continue;
            if (x < 6 && y < 6) continue;
            if (edgeSafe && (x < 4 || y < 4 || x > width - 5 || y > height - 5)) continue;
            // Vorkammer der Boss-Tür frei lassen
            if (door && Math.abs(x - door.x) <= 4 && y >= door.y - 6 && y < door.y) continue;
            if (map[y][x] !== TILE_FLOOR) continue;
            // Feste Kacheln (Wasser) dürfen keinen Weg und keine Bodenfläche abschneiden
            if (isSolidTile(type)) {
                if (!placeSolidSafely(map, x, y, type)) continue;
            } else {
                map[y][x] = type;
            }
            placed++;
        }
    };
    place(TILE_BUSH, 5, false);
    place(TILE_WATER, 2, true);
    place(TILE_SKULL, 3, false);
    place(TILE_JUMP_PAD, 2, false);
}

function createTrainingLevel() {
    const width = 24;
    const height = 18;
    const map = Array.from({ length: height }, () => Array(width).fill(TILE_FLOOR));
    for (let x = 0; x < width; x++) {
        map[0][x] = TILE_WALL;
        map[height - 1][x] = TILE_WALL;
    }
    for (let y = 0; y < height; y++) {
        map[y][0] = TILE_WALL;
        map[y][width - 1] = TILE_WALL;
    }
    for (let x = 4; x < 8; x++) map[4][x] = TILE_BUSH;
    for (let x = 16; x < 20; x++) map[13][x] = TILE_BUSH;
    map[8][10] = TILE_WATER;
    map[8][11] = TILE_WATER;
    map[9][10] = TILE_WATER;
    map[9][11] = TILE_WATER;
    map[10][6] = TILE_SKULL;
    map[10][17] = TILE_SKULL;
    map[15][3] = TILE_SPAWN;
    return map;
}

function createFruitLevel() {
    const map = generateLevel(56, 50, 16, 1616);
    sprinkleSpecialTiles(map);
    return map;
}

function createDinoLevel() {
    const map = generateLevel(58, 50, 17, 1717);
    sprinkleSpecialTiles(map);
    return map;
}

// Begehbare Sonderkacheln nur auf Boden setzen (sonst würden Wände zu Durchgängen)
function placeOnFloor(map, x, y, type) {
    if (map[y] && map[y][x] === TILE_FLOOR) map[y][x] = type;
}

function createChronoLevel() {
    const map = generateLevel(56, 48, 16, 1818);
    sprinkleSpecialTiles(map);
    for (let x = 6; x < 12; x++) placeOnFloor(map, x, 9, TILE_JUMP_PAD);
    return map;
}

function createShadowSwampLevel() {
    const map = generateLevel(56, 48, 16, 1919);
    // Feste Wasserlinie zuerst und nur dort, wo sie nichts abschneidet
    for (let y = 7; y < 11; y++) placeSolidSafely(map, 14, y, TILE_WATER);
    sprinkleSpecialTiles(map);
    return map;
}

function createFootballArenaLevel() {
    const map = generateLevel(58, 46, 15, 2020);
    sprinkleSpecialTiles(map);
    for (let x = 8; x < 16; x++) placeOnFloor(map, x, 12, TILE_JUMP_PAD);
    return map;
}

function createScrapYardLevel() {
    const map = generateLevel(56, 48, 16, 2121);
    sprinkleSpecialTiles(map);
    for (let x = 7; x < 13; x++) placeOnFloor(map, x, 11, TILE_SKULL);
    return map;
}

// Freie Rechtecke (rw × rh, nur Boden) für Einrichtung suchen: nicht im Boss-Block, nicht in der Vorkammer,
// nicht am Start; untereinander mit Abstand. Liefert bis zu count Positionen (links oben), zufällig gewählt.
// accept(x, y) kann Kandidaten zusätzlich ausschließen (z. B. nur in einer Element-Zone).
function findFloorRects(map, rw, rh, count, rnd, taken, accept) {
    const h = map.length, w = map[0].length;
    const door = findTile(map, TILE_BOSS_DOOR), spawn = findTile(map, TILE_SPAWN);
    const cands = [];
    for (let y = 1; y + rh < h; y++) {
        for (let x = 1; x + rw < w; x++) {
            if (x + rw - 1 >= w - 15 && y + rh - 1 >= h - 13) continue;
            if (door && x <= door.x + 4 && x + rw - 1 >= door.x - 4 && y <= door.y && y + rh - 1 >= door.y - 6) continue;
            if (spawn && x <= spawn.x + 2 && x + rw - 1 >= spawn.x - 2 && y <= spawn.y + 2 && y + rh - 1 >= spawn.y - 2) continue;
            let ok = true;
            for (let yy = y; yy < y + rh && ok; yy++) for (let xx = x; xx < x + rw && ok; xx++) if (map[yy][xx] !== TILE_FLOOR) ok = false;
            if (ok && (!accept || accept(x, y))) cands.push([x, y]);
        }
    }
    for (let i = cands.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    const out = [];
    for (const [x, y] of cands) {
        if (out.length >= count) break;
        if (taken.some(r => x < r.x + r.w + 1 && x + rw + 1 > r.x && y < r.y + r.h + 1 && y + rh + 1 > r.y)) continue;
        const r = { x, y, w: rw, h: rh };
        taken.push(r);
        out.push(r);
    }
    return out;
}

// Welt 22: Zombie Academy – Klassenzimmer mit Bankreihen, Schleimpfützen, welke Hecken, Trampoline
function createZombieAcademyLevel() {
    const map = generateLevel(56, 48, 16, 2222);
    const rnd = wRng(2222), taken = [];
    // Klassenzimmer: je vier Zweiertische in zwei Reihen (Schädel-Kachel = Schulbank in diesem Thema)
    for (const r of findFloorRects(map, 8, 5, 4, rnd, taken)) {
        for (const dy of [1, 3]) for (const dx of [1, 2, 5, 6]) placeOnFloor(map, r.x + dx, r.y + dy, TILE_SKULL);
    }
    // Schleimpfützen (fest, nur wo sie nichts abschneiden)
    for (const r of findFloorRects(map, 4, 4, 3, rnd, taken)) {
        for (const [dx, dy] of [[1, 1], [2, 1], [1, 2], [2, 2]]) placeSolidSafely(map, r.x + dx, r.y + dy, TILE_WATER);
    }
    // Welke Hecken und eine Trampolin-Reihe aus der Turnhalle
    for (const r of findFloorRects(map, 5, 3, 2, rnd, taken)) {
        for (let dx = 1; dx < 4; dx++) placeOnFloor(map, r.x + dx, r.y + 1, TILE_BUSH);
    }
    for (const r of findFloorRects(map, 5, 3, 1, rnd, taken)) {
        for (let dx = 1; dx < 4; dx++) placeOnFloor(map, r.x + dx, r.y + 1, TILE_JUMP_PAD);
    }
    sprinkleSpecialTiles(map);
    return map;
}

// Welt 23: Schmetterlingwelt – Blumenbeete, Seerosenteiche, Blütenhecken, Hüpfblumen
function createButterflyLevel() {
    const map = generateLevel(56, 48, 16, 2323);
    const rnd = wRng(2323), taken = [];
    // Blumenbeete als Plus (Schädel-Kachel = Blumenbeet in diesem Thema)
    for (const r of findFloorRects(map, 5, 5, 6, rnd, taken)) {
        for (const [dx, dy] of [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]]) placeOnFloor(map, r.x + dx, r.y + dy, TILE_SKULL);
    }
    // Teiche mit Seerosen (fest, nur wo sie nichts abschneiden)
    for (const r of findFloorRects(map, 5, 4, 2, rnd, taken)) {
        for (let dy = 1; dy < 3; dy++) for (let dx = 1; dx < 4; dx++) placeSolidSafely(map, r.x + dx, r.y + dy, TILE_WATER);
    }
    // Blütenhecken und ein Feld Hüpfblumen
    for (const r of findFloorRects(map, 6, 3, 3, rnd, taken)) {
        for (let dx = 1; dx < 5; dx++) placeOnFloor(map, r.x + dx, r.y + 1, TILE_BUSH);
    }
    for (const r of findFloorRects(map, 4, 4, 1, rnd, taken)) {
        for (const [dx, dy] of [[1, 1], [2, 1], [1, 2], [2, 2]]) placeOnFloor(map, r.x + dx, r.y + dy, TILE_JUMP_PAD);
    }
    sprinkleSpecialTiles(map);
    return map;
}

// Welt 24: Drachenberg – Lavabecken in Feuer-Zonen, Goldhaufen in Schatz-Zonen, Eiernester, Dampfschlote
function createDragonLevel() {
    const map = generateLevel(58, 50, 17, 2424);
    const rnd = wRng(2424), taken = [];
    const inZone = (z, rw, rh) => (x, y) => dragonZone(x + rw / 2, y + rh / 2) === z;
    // Lavabecken (fest, nur wo sie nichts abschneiden)
    for (const r of findFloorRects(map, 5, 4, 3, rnd, taken, inZone(1, 5, 4))) {
        for (let dy = 1; dy < 3; dy++) for (let dx = 1; dx < 4; dx++) placeSolidSafely(map, r.x + dx, r.y + dy, TILE_WATER);
    }
    // Goldhaufen-Reihen (Busch-Kachel = Goldhaufen in diesem Thema)
    for (const r of findFloorRects(map, 6, 3, 3, rnd, taken, inZone(0, 6, 3))) {
        for (let dx = 1; dx < 5; dx++) placeOnFloor(map, r.x + dx, r.y + 1, TILE_BUSH);
    }
    // Eiernester in kleinen Gruppen (Schädel-Kachel = Nest in diesem Thema)
    for (const r of findFloorRects(map, 4, 4, 5, rnd, taken)) {
        for (const [dx, dy] of [[1, 1], [2, 1], [1, 2]]) placeOnFloor(map, r.x + dx, r.y + dy, TILE_SKULL);
    }
    // Dampfschlote in einer Reihe
    for (const r of findFloorRects(map, 5, 3, 1, rnd, taken)) {
        for (let dx = 1; dx < 4; dx++) placeOnFloor(map, r.x + dx, r.y + 1, TILE_JUMP_PAD);
    }
    sprinkleSpecialTiles(map);
    return map;
}

// Welt 25–30: gemeinsamer Kartenbau. pools = Becken (Wasser/Lava/Trank), bushes = Buschreihen,
// skulls = Deko-Gruppen (Schädel-Kachel), pads = Sprungfelder. Alles nur dort, wo es nichts abschneidet.
function createLateLevel(w, h, rooms, seed, pools, bushes, skulls, pads) {
    const map = generateLevel(w, h, rooms, seed);
    const rnd = wRng(seed), taken = [];
    for (const r of findFloorRects(map, 5, 4, pools, rnd, taken)) {
        for (let dy = 1; dy < 3; dy++) for (let dx = 1; dx < 4; dx++) placeSolidSafely(map, r.x + dx, r.y + dy, TILE_WATER);
    }
    for (const r of findFloorRects(map, 6, 3, bushes, rnd, taken)) {
        for (let dx = 1; dx < 5; dx++) placeOnFloor(map, r.x + dx, r.y + 1, TILE_BUSH);
    }
    for (const r of findFloorRects(map, 4, 4, skulls, rnd, taken)) {
        for (const [dx, dy] of [[1, 1], [2, 1], [1, 2]]) placeOnFloor(map, r.x + dx, r.y + dy, TILE_SKULL);
    }
    for (const r of findFloorRects(map, 4, 4, pads, rnd, taken)) {
        for (const [dx, dy] of [[1, 1], [2, 1], [1, 2], [2, 2]]) placeOnFloor(map, r.x + dx, r.y + dy, TILE_JUMP_PAD);
    }
    sprinkleSpecialTiles(map);
    return map;
}

const TUTORIAL_LEVEL = createTrainingLevel();
const WORLD1_LEVEL = generateLevel(50, 45, 12, 101);
const WORLD2_LEVEL = generateLevel(55, 45, 14, 202);
const WORLD3_LEVEL = generateLevel(50, 42, 13, 303);
const WORLD4_LEVEL = generateLevel(55, 50, 15, 404);
const WORLD5_LEVEL = generateLevel(52, 48, 14, 505);
const WORLD6_LEVEL = generateLevel(55, 45, 13, 606);
const WORLD7_LEVEL = generateLevel(50, 50, 15, 707);
const WORLD8_LEVEL = generateLevel(55, 52, 16, 808);
const WORLD11_LEVEL = generateLevel(52, 48, 14, 1111);
const WORLD12_LEVEL = generateLevel(55, 50, 15, 1212);
const WORLD13_LEVEL = generateLevel(52, 48, 14, 1313);
const WORLD14_LEVEL = generateLevel(50, 45, 13, 1414);
const WORLD15_LEVEL = generateLevel(55, 50, 15, 1515);
const WORLD16_LEVEL = createFruitLevel();
const WORLD17_LEVEL = createDinoLevel();
const WORLD18_LEVEL = createChronoLevel();
const WORLD19_LEVEL = createShadowSwampLevel();
const WORLD20_LEVEL = createFootballArenaLevel();
const WORLD21_LEVEL = createScrapYardLevel();
const WORLD22_LEVEL = createZombieAcademyLevel();
const WORLD23_LEVEL = createButterflyLevel();
const WORLD24_LEVEL = createDragonLevel();
const WORLD25_LEVEL = createLateLevel(58, 50, 17, 2525, 3, 5, 3, 1);
const WORLD26_LEVEL = createLateLevel(58, 50, 17, 2626, 3, 4, 2, 2);
const WORLD27_LEVEL = createLateLevel(60, 50, 18, 2727, 2, 2, 5, 1);
const WORLD28_LEVEL = createLateLevel(58, 52, 18, 2828, 4, 2, 3, 1);
const WORLD29_LEVEL = createLateLevel(60, 52, 18, 2929, 3, 3, 2, 3);
const WORLD30_LEVEL = createLateLevel(62, 54, 19, 3030, 4, 4, 4, 1);
