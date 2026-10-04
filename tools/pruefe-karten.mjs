// Prüft alle Karten: Startfeld vorhanden, Boss-Tür erreichbar, keine abgeschnittenen Bodenflächen.
// Aufruf: node tools/pruefe-karten.mjs [durchläufe]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runs = Number(process.argv[2] || 200);
const src = ['js/utils.js', 'js/world.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const names = ['TUTORIAL_LEVEL', 'WORLD1_LEVEL', 'WORLD2_LEVEL', 'WORLD3_LEVEL', 'WORLD4_LEVEL', 'WORLD5_LEVEL',
    'WORLD6_LEVEL', 'WORLD7_LEVEL', 'WORLD8_LEVEL', 'W9', 'W10', 'WORLD11_LEVEL', 'WORLD12_LEVEL',
    'WORLD13_LEVEL', 'WORLD14_LEVEL', 'WORLD15_LEVEL', 'WORLD16_LEVEL', 'WORLD17_LEVEL', 'WORLD18_LEVEL',
    'WORLD19_LEVEL', 'WORLD20_LEVEL', 'WORLD21_LEVEL', 'WORLD22_LEVEL', 'WORLD23_LEVEL', 'WORLD24_LEVEL',
    'WORLD25_LEVEL', 'WORLD26_LEVEL', 'WORLD27_LEVEL', 'WORLD28_LEVEL', 'WORLD29_LEVEL', 'WORLD30_LEVEL',
    'WORLD31_LEVEL', 'WORLD32_LEVEL', 'WORLD33_LEVEL', 'WORLD34_LEVEL', 'WORLD35_LEVEL', 'WORLD36_LEVEL', 'WORLD37_LEVEL', 'WORLD38_LEVEL', 'WORLD39_LEVEL', 'WORLD40_LEVEL', 'WORLD41_LEVEL', 'WORLD42_LEVEL', 'WORLD43_LEVEL'];

const fails = {};
for (let run = 0; run < runs; run++) {
    const ctx = { Math, console };
    vm.createContext(ctx);
    vm.runInContext(src + `
        var W9 = generateLevel(50, 48, 14, 909), W10 = generateLevel(52, 48, 14, 1010);
        var __levels = [${names.join(',')}];
        var __check = (map, i) => {
            const probs = [];
            const s = findTile(map, TILE_SPAWN);
            if (!s) { probs.push('kein Start'); return probs; }
            if (i > 0) {
                if (!findTile(map, TILE_BOSS_DOOR)) probs.push('keine Boss-Tür');
                else if (!bossDoorReachable(map)) probs.push('Boss-Tür unerreichbar');
            }
            const seen = reachableTiles(map, s.x, s.y);
            const w = map[0].length, h = map.length;
            let cut = 0;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const inBoss = i > 0 && x >= w - 13 && x <= w - 3 && y >= h - 11 && y <= h - 3;
                if (!inBoss && map[y][x] === TILE_FLOOR && !seen[y * w + x]) cut++;
            }
            if (cut) probs.push(cut + ' Bodenfelder abgeschnitten');
            // Zweimal laden darf die Vorlage nicht verändern
            const a = new World(); a.load(map); const b = new World(); b.load(map);
            if (b.spawnPoint.x === 0 && b.spawnPoint.y === 0) probs.push('Vorlage wird beim Laden verändert');
            return probs;
        };
        var __result = __levels.map((m, i) => __check(m, i));
    `, ctx);
    ctx.__result.forEach((probs, i) => {
        for (const p of probs) {
            const key = `Welt ${i}: ${p}`;
            fails[key] = (fails[key] || 0) + 1;
        }
    });
}
const keys = Object.keys(fails);
if (!keys.length) console.log(`OK – alle ${names.length} Karten in ${runs} Durchläufen in Ordnung.`);
else for (const k of keys) console.log(`${k}  (${fails[k]} von ${runs})`);
process.exitCode = keys.length ? 1 : 0;
