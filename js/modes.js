// ── Extra-Modi: das Gerüst (registerMode) und die Bausteine, die jeder Modus braucht ──
// Ein Modus wohnt in einer eigenen Datei (js/modes-a.js bis js/modes-d.js) und trägt sich dort
// mit registerMode({...}) ein. Kein Modus fasst main.js, ui.js oder eine Welt-Datei an.
//
// Vorlage:
//   registerMode({
//       id: 'boss-marathon',                 // eindeutig, nur a-z, 0-9 und Bindestrich
//       name: 'Boss-Marathon',
//       emoji: '👹',
//       text: 'Alle Bosse hintereinander, ohne Pause.',   // EIN Satz, für Kinder geschrieben
//       frei: g => g.maxWorldUnlocked >= 10,              // ab wann die Karte „Los!“ zeigt
//       hinweis: 'Erst Welt 10 schaffen.',                // Text auf der gesperrten Karte
//       wertung: 'punkte',                                // 'punkte' (mehr besser) | 'zeit' (weniger besser)
//       start(g) {
//           Modes.arena({ welt: 12, herzen: 5, breite: 44, hoehe: 24 });
//           Modes.bossReihe([BossGhost, BossSlime, BossKnightBat]);
//       },
//       update(dt) { ... },                     // optional, jeder Takt während des Spielens
//       onPlayerDeath(g) { Modes.finish({ text: 'Mark schafft nicht mehr.' }); return true; },
//       onWorldClear(g) { return Modes.naechsterBoss() ? true : Modes.finish({ text: 'Alle Bosse besiegt!' }); },
//       drawHud(ctx) { Modes.hudStatus(ctx); },  // eigene Anzeige (ohne Haken zeigt Modes Zeit und Punkte)
//   });
//
// Was ein Modus NICHT tut (bewusst, damit kein Modus das Spiel unterlaeuft):
//   - er schaltet keine Welt frei und kassiert keine Welt-Belohnung (main.js haelt das fest)
//   - er zaehlt nicht auf Tagesaufgaben und Fortschrittszaehler (Progress bleibt zu)
// Er zahlt nur seine eigenen Muinzen aus und fuehrt seinen eigenen Rekord im Spielstand.
//
// Die Bausteine nehmen jedem Modus die Routine ab:
//   Modes.starteWelt({ welt, herzen, tempo, groesse, dunkelheit, spiegel, zeitlimit })
//   Modes.arena({ welt, breite, hoehe, ... })     große Halle aus einem einzigen Raum
//   Modes.welle({ gegner, anzahl })              einmal eine Welle Gegner nachschieben
//   Modes.dauerwellen({ gegner, pro, interval }) Wellen von allein nachschieben
//   Modes.bossReihe([Klasse, ...]) + Modes.naechsterBoss()   nur Bosse nacheinander
//   Modes.punkte(n) / Modes.zeit() / Modes.restzeit()        Punkte und Uhr
//   Modes.hudStatus(ctx)                         Zeit- und Punkteanzeige im HUD
//   Modes.finish({ punkte, text, muenzen })       Ergebnis-Seite mit Rekord und Münz-Berg
// Ein fehlerhafter Modus hält das Spiel nie an: jeder Aufruf läuft in sicherem Schutz.

const MODES = [];
const MODE_BY_ID = Object.create(null);

// Fehler im Modus-Code: melden, aber nie einfrieren. Eigener Zaehler und eigener Name -
// ein Modus-Problem ist kein Upgrade-Problem, die Konsole soll das hergeben koennen.
let modeErrorCount = 0;
const modeMeldeBudget = { haken: 5 };
function modeProblem(where, e) {
    modeErrorCount++;
    if (typeof console !== 'undefined' && console.error && modeMeldeBudget.haken > 0) {
        modeMeldeBudget.haken--;
        console.error('Modus ' + where + ':', e && e.message ? e.message : e);
    }
}

// Text aus einer Modus-Datei fuer die Oberflaeche: spitze Klammern und & sind dort Text,
// nie Layout - sonst zerlegt ein Modus-Text das Menue.
function modusText(t) {
    return String(t === undefined || t === null ? '' : t)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Anmelden: ein Modus aus seiner eigenen Datei ──
function registerMode(eintrag) {
    if (!eintrag || typeof eintrag.id !== 'string' || !eintrag.id) {
        modeProblem('registerMode (Id fehlt)', new Error('Eintrag ohne id'));
        return false;
    }
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(eintrag.id)) {
        modeProblem('registerMode (Id-Form)', new Error(eintrag.id));
        return false;
    }
    if (Object.prototype.hasOwnProperty.call(MODE_BY_ID, eintrag.id)) {
        modeProblem('registerMode (doppelte Id)', new Error(eintrag.id));
        return false;
    }
    if (typeof eintrag.start !== 'function') {
        modeProblem('registerMode (start fehlt)', new Error(eintrag.id));
        return false;
    }
    if (typeof eintrag.name !== 'string' || !eintrag.name ||
        typeof eintrag.text !== 'string' || !eintrag.text) {
        modeProblem('registerMode (name/text)', new Error(eintrag.id));
        return false;
    }
    const m = Object.assign({ emoji: '🎮', hinweis: 'Noch nicht frei.', wertung: 'punkte' }, eintrag);
    if (typeof m.frei !== 'function') m.frei = () => true;
    if (typeof m.hinweis !== 'string' || !m.hinweis) m.hinweis = 'Noch nicht frei.';
    // 'zeit' = kleine Zeit ist besser (Zeitrennen), alles andere zählt Punkte
    if (m.wertung !== 'zeit') m.wertung = 'punkte';
    for (const h of ['update', 'onPlayerDeath', 'onWorldClear', 'drawHud', 'belohnung']) {
        if (m[h] !== undefined && typeof m[h] !== 'function') delete m[h];
    }
    MODES.push(m);
    // defineProperty statt bloßer Zuweisung: der Schlüssel bleibt ein eigener Eintrag
    Object.defineProperty(MODE_BY_ID, m.id, { value: m, enumerable: true, writable: true, configurable: true });
    return true;
}

function modeKnown(id) {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(MODE_BY_ID, id) ? MODE_BY_ID[id] : null;
}

const Modes = {
    run: null,               // läuft gerade ein Modus? (Zeit, Punkte, Wellen, Bosse, Dunkelheit)
    keepNextWorldStart: false, // true, während ein Modus die Welt selbst startet (sonst wäre der Modus aus)
    lastReward: 0,           // Münzen der letzten Ergebnis-Seite (für den Berg davor)
    lastModeId: '',          // welcher Modus die Ergebnis-Seite zeigt (für „Nochmal“)

    liste() { return MODES; },

    istFrei(m) {
        if (!m) return false;
        try { return !!m.frei(Game); }
        catch (e) { modeProblem('frei ' + m.id, e); return false; }
    },

    // ── Rekorde im Spielstand (Game.modeRecords, alte Spielstände haben einfach keinen) ──
    rekord(id) {
        const v = Game.modeRecords && Game.modeRecords[id];
        return Number.isFinite(+v) && +v > 0 ? +v : null;
    },

    setRekord(id, wert) {
        if (!Game.modeRecords) Game.modeRecords = {};
        Game.modeRecords[id] = Math.round(wert * 10) / 10;
        Game.save();
    },

    zeitText(sec) {
        const s = Math.max(0, Math.round((+sec || 0) * 10) / 10);
        const m = Math.floor(s / 60);
        const r = s - m * 60;
        return m > 0 ? m + ':' + (r < 10 ? '0' : '') + r.toFixed(1) : r.toFixed(1) + ' s';
    },

    // Hilft auch js/ui.js beim Bauen der Karten
    sicher(t) { return modusText(t); },

    rekordText(m) {
        const r = Modes.rekord(m.id);
        if (r === null) return '';
        return m.wertung === 'zeit' ? 'Bestzeit ' + Modes.zeitText(r) : 'Rekord ' + r + ' Punkte';
    },

    // ── Modus starten und beenden ──
    start(id) {
        const m = modeKnown(id);
        if (!m) {
            modeProblem('start (unbekannt)', new Error(String(id)));
            return false;
        }
        if (!Modes.istFrei(m)) {
            HUD.toast('Gesperrt: ' + m.hinweis, '#ffd0d0', 2.6);
            return false;
        }
        Modes.zuruecksetzen();
        Game.activeMode = m;
        Modes.run = {
            mode: m, zeit: 0, limit: 0, punkte: 0, tempo: 1,
            dunkel: 0, dunkelFarbe: '#06030f', _licht: null, _lichtSchluessel: '',
            wellen: null, bossReihe: null, wellenZahl: 0, ende: false,
        };
        try { m.start(Game); }
        catch (e) {
            modeProblem('start ' + m.id, e);
            HUD.toast('Dieser Modus geht gerade nicht.', '#ffd0d0', 2.6);
            // Der halbfertige Aufbau (Herzen, Tempo, Groesse) darf nicht im Spiel bleiben
            Modes.zuruecksetzen();
            Game.returnToTitle();
            return false;
        }
        return true;
    },

    // Modus fallen lassen (Knopf „Zurück“, Weltkarte, Startseite, normale Welt starten)
    zuruecksetzen() {
        Modes.run = null;
        Modes.keepNextWorldStart = false;
        Game.levelMirror = false;
        if (Game.activeMode) Game.activeMode = null;
    },

    // ── Takt für Takt (von main.js während des Spielens) ──
    takt(dt) {
        const run = Modes.run;
        if (!run || Game.state !== 'PLAYING') return;
        run.zeit += dt;
        if (run.limit > 0 && run.zeit >= run.limit) {
            run.zeit = run.limit;
            Modes.finish({ text: 'Die Zeit ist um.' });
            return;
        }
        const w = run.wellen;
        if (w) {
            w.timer -= dt;
            const leben = Modes.lebendeGegner();
            if (w.timer <= 0 && (!w.maxLeben || leben < w.maxLeben)) {
                Modes.welle({ gegner: w.gegner, anzahl: w.pro });
                w.index++;
                w.timer = w.interval;
                if (w.maxWellen && w.index >= w.maxWellen) run.wellen = null;
            }
        }
        if (typeof run.mode.update === 'function') {
            try { run.mode.update(dt); }
            catch (e) { modeProblem('update ' + run.mode.id, e); run.mode.update = null; }
        }
    },

    lebendeGegner() {
        let n = 0;
        for (const e of Game.enemies) if (e && !e.dead) n++;
        return n;
    },

    // ══════════════ Baustein 1: eine Welt mit Änderungen starten ══════════════
    // { welt, herzen, tempo, groesse, dunkelheit, dunkelFarbe, spiegel, zeitlimit }
    starteWelt(opts) {
        const o = opts || {};
        const run = Modes.run;
        if (!run) {
            modeProblem('starteWelt (kein Modus)', new Error('ohne Modes.start'));
            return false;
        }
        Game.levelMirror = !!o.spiegel;
        Modes.keepNextWorldStart = true;
        try { Game.startWorld(clamp(+o.welt || 1, 1, LAST_WORLD)); }
        finally {
            Modes.keepNextWorldStart = false;
            Game.levelMirror = false;
        }
        const p = Game.player;
        if (!p) return false;

        if (Number.isFinite(+o.tempo) && +o.tempo > 0) run.tempo = +o.tempo;
        if (run.tempo !== 1) {
            // Marks Tempo über die Grundgeschwindigkeit (sie wird jeden Takt neu abgelesen),
            // Gegner über den Zeitfaktor, den die Engine schon für alle Figuren kennt.
            p.baseSpeed *= run.tempo;
            for (const e of Game.enemies) if (e && !e.dead) e.tempo = (e.tempo || 1) * run.tempo;
        }
        if (o.herzen) {
            const n = clamp(Math.round(+o.herzen), 1, 12);
            p.maxHp = n * 4;               // ein Herz sind vier Viertel (wie in js/hud.js)
            p.hp = p.maxHp;
            HUD.onWorldStart();
        }
        if (o.groesse && typeof p.setSize === 'function') p.setSize(+o.groesse);
        if (Number.isFinite(+o.zeitlimit) && +o.zeitlimit > 0) run.limit = +o.zeitlimit;
        if (Number.isFinite(+o.dunkelheit) && +o.dunkelheit > 0) {
            run.dunkel = clamp(+o.dunkelheit, 0.05, 1);
            if (typeof o.dunkelFarbe === 'string') run.dunkelFarbe = o.dunkelFarbe;
        }
        return true;
    },

    // Seitenverkehrt: nur die Kacheln und die Startpunkte, bevor Spieler und Gegner gesetzt werden.
    // main.js ruft das in startWorld direkt nach world.load().
    spiegleWelt(w) {
        if (!w || !w.tiles || !w.tiles.length) return;
        for (const row of w.tiles) row.reverse();
        w.spawnPoint.x = w.pixelWidth - w.spawnPoint.x;
        w.bossSpawn.x = w.pixelWidth - w.bossSpawn.x;
        for (const d of w.bossDoorTiles) d.x = w.width - 1 - d.x;
        // Der Boss-Raum liegt in der unveraenderten Welt unten rechts (main.js) und muss
        // gespiegelt werden, sonst zieht main.js Boss und Mark in die falsche Ecke.
        const raum = Game._bossRoomRect();
        if (raum) w.bossRoomRect = { x: w.pixelWidth - (raum.x + raum.w), y: raum.y, w: raum.w, h: raum.h };
        if (typeof w.invalidateCache === 'function') w.invalidateCache();
    },

    // Freie Bodenfelder und erreichbare Kacheln neu einsammeln (nach Arena oder Spiegelung)
    merkeBoden() {
        const w = Game.world;
        if (!w || !w.tiles || !w.tiles.length) return;
        Game._reach = reachableTiles(w.tiles,
            Math.floor(w.spawnPoint.x / TILE_SIZE), Math.floor(w.spawnPoint.y / TILE_SIZE));
        const list = [];
        for (let y = 2; y < w.height - 2; y++) {
            for (let x = 2; x < w.width - 2; x++) {
                if (w.tiles[y][x] === TILE_FLOOR) {
                    list.push({ x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 });
                }
            }
        }
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = list[i]; list[i] = list[j]; list[j] = t;
        }
        Game._floorTiles = list;
    },

    // ══════════════ Baustein 2: eine Arena aus einem großen Raum ══════════════
    baueArena(opts) {
        const o = opts || {};
        const w = clamp(Math.round(+o.breite || 46), 14, 90);
        const h = clamp(Math.round(+o.hoehe || 26), 14, 60);
        const level = [];
        for (let y = 0; y < h; y++) {
            const row = new Array(w).fill(TILE_WALL);
            if (y > 0 && y < h - 1) {
                for (let x = 1; x < w - 1; x++) row[x] = TILE_FLOOR;
            }
            level.push(row);
        }
        level[Math.floor(h / 2)][Math.floor(w / 2)] = TILE_SPAWN;
        level[2][w - 3] = TILE_BOSS_SPAWN;   // oben rechts: Platz für Modus-Bosse
        return level;
    },

    // Startet erst die normale Welt (Ausrüstung, Begleiter, Kamera), dann liegt die Halle darauf.
    arena(opts) {
        const o = opts || {};
        const run = Modes.run;
        if (!run) {
            modeProblem('arena (kein Modus)', new Error('ohne Modes.start'));
            return false;
        }
        if (!Modes.starteWelt(o)) return false;
        const g = Game, w = g.world;
        if (typeof o.thema === 'string' && WORLD_THEMES[o.thema]) w.theme = o.thema;
        w.load(Modes.baueArena(o));
        const p = g.player;
        p.x = w.spawnPoint.x - p.w / 2;
        p.y = w.spawnPoint.y - p.h / 2;
        g.enemies.length = 0;
        g.projectiles.length = 0;
        g.chests.length = 0;
        g.keyDrops.length = 0;
        g.props.length = 0;
        g.coinDrops.length = 0;
        g.hasKey = false;
        g.bossActive = false;
        g.bossDefeated = false;
        g.epicFreezeActive = false;
        g.epicFreezeBoss = null;
        for (const c of g.companions) {
            c.x = w.spawnPoint.x + 24;
            c.y = w.spawnPoint.y + 20;
        }
        g.camera.x = p.x + p.w / 2 - g.viewW / 2;
        g.camera.y = p.y + p.h / 2 - g.viewH / 2;
        g.camera.clampTo(w.pixelWidth, w.pixelHeight);
        Modes.merkeBoden();
        run.arena = {
            x: TILE_SIZE, y: TILE_SIZE,
            w: w.pixelWidth - 2 * TILE_SIZE, h: w.pixelHeight - 2 * TILE_SIZE,
        };
        // main.js haelt Boss und Mark im Boss-Raum - in der Arena ist das die ganze Halle,
        // sonst würde Mark jeden Frame in die untere rechte Ecke zurueckgezogen.
        w.bossRoomRect = { x: run.arena.x, y: run.arena.y, w: run.arena.w, h: run.arena.h };
        return true;
    },

    // ══════════════ Baustein 3: Gegnerwellen nachschieben ══════════════
    // Einmal: Modes.welle({ gegner: Ghost oder [Ghost, KeyGhost], anzahl: 6, abstand: 260 })
    welle(opts) {
        const o = opts || {};
        const g = Game, run = Modes.run;
        if (!run || !g.world || !g._floorTiles || !g._floorTiles.length) return 0;
        const klassen = (Array.isArray(o.gegner) ? o.gegner : [o.gegner]).filter(k => typeof k === 'function');
        if (!klassen.length) {
            modeProblem('welle (kein Gegner)', new Error('gegner fehlt'));
            return 0;
        }
        const anzahl = Math.max(1, Math.round(+o.anzahl || 1));
        let n = 0;
        for (let i = 0; i < anzahl; i++) {
            const e = g._spawnAt(klassen[i % klassen.length], +o.abstand || 260);
            if (!e) continue;
            if (run.tempo !== 1) e.tempo = (e.tempo || 1) * run.tempo;
            g.enemies.push(e);
            n++;
        }
        if (n) run.wellenZahl++;
        return n;
    },

    // Automatisch: Modes.dauerwellen({ gegner, pro: 4, interval: 6, erster: 2, maxWellen: 0, maxLeben: 18 })
    dauerwellen(opts) {
        const o = opts || {};
        const run = Modes.run;
        if (!run) {
            modeProblem('dauerwellen (kein Modus)', new Error('ohne Modes.start'));
            return false;
        }
        const klassen = (Array.isArray(o.gegner) ? o.gegner : [o.gegner]).filter(k => typeof k === 'function');
        if (!klassen.length) {
            modeProblem('dauerwellen (kein Gegner)', new Error('gegner fehlt'));
            return false;
        }
        const erster = Number.isFinite(+o.erster) && +o.erster >= 0 ? +o.erster : 2;
        run.wellen = {
            gegner: klassen,
            pro: Math.max(1, Math.round(+o.pro || 3)),
            interval: Math.max(0.5, +o.interval || 8),
            timer: erster,
            index: 0,
            maxWellen: Math.max(0, Math.round(+o.maxWellen || 0)),
            maxLeben: Math.max(0, Math.round(+o.maxLeben || 0)),
        };
        return true;
    },

    // ══════════════ Baustein 4: nur Bosse nacheinander ══════════════
    bossReihe(liste) {
        const run = Modes.run;
        const l = (Array.isArray(liste) ? liste : [liste]).filter(k => typeof k === 'function');
        if (!run || !l.length) {
            modeProblem('bossReihe (leer)', new Error('keine Bosse'));
            return false;
        }
        run.bossReihe = { liste: l, index: -1 };
        return Modes.naechsterBoss();
    },

    naechsterBoss() {
        const run = Modes.run, g = Game;
        if (!run || !run.bossReihe || !g.world) return false;
        const q = run.bossReihe;
        if (q.index >= q.liste.length - 1) return false;   // alle waren schon da
        q.index++;
        // Ein besiegter Boss bleibt als Leiche in der Gegnerliste stehen (KEEP_ENEMY lässt Bosse drin).
        // Ohne ihn herauszunehmen würde die Boss-Logik in main.js ihn noch einmal sterben lassen.
        g.enemies = g.enemies.filter(e => !(e && e.isBoss && e.dead));
        g.epicFreezeActive = false;
        g.epicFreezeBoss = null;
        g.epicFreezeTimer = 0;
        const K = q.liste[q.index];
        const ort = g.world.bossSpawn || { x: g.world.pixelWidth / 2, y: g.world.pixelHeight / 2 };
        const boss = new K(ort.x, ort.y);
        boss.isBoss = true;
        boss.toughness = BOSS_TOUGHNESS;
        boss.tempo = BOSS_TEMPO * (run.tempo || 1);
        g.enemies.push(boss);
        g.bossActive = true;
        g.bossDefeated = false;
        g.bossIntroTime = 0;
        g.setState('BOSS_INTRO');
        Sound.bossIntro();
        g.vibrate(200);
        return true;
    },

    // ══════════════ Baustein 5: Zeit und Punkte ══════════════
    punkte(n) {
        const run = Modes.run;
        if (!run) return 0;
        run.punkte = Math.max(0, run.punkte + (+n || 0));
        return run.punkte;
    },

    zeit() { return Modes.run ? Modes.run.zeit : 0; },

    restzeit() {
        const run = Modes.run;
        if (!run) return 0;
        return run.limit > 0 ? Math.max(0, run.limit - run.zeit) : run.zeit;
    },

    // Zeilen für die Standardanzeige (Zeit, Punkte, Welle, Boss)
    statusText() {
        const run = Modes.run;
        if (!run) return [];
        const out = ['⏱ ' + Modes.zeitText(run.limit > 0 ? Math.max(0, run.limit - run.zeit) : run.zeit),
            '🎯 ' + run.punkte];
        if (run.wellen) out.push('Welle ' + (run.wellen.index + 1));
        if (run.wellenZahl && !run.wellen) out.push('Welle ' + run.wellenZahl);
        if (run.bossReihe) out.push('Boss ' + Math.max(1, run.bossReihe.index + 1) + '/' + run.bossReihe.liste.length);
        return out;
    },

    // Kleine Pillenzeile oben mittig (unter der Boss-Leiste). Koordinaten wie im HUD.
    hudStatus(ctx, zeilen) {
        const texte = (Array.isArray(zeilen) ? zeilen : Modes.statusText()).filter(t => typeof t === 'string' && t);
        if (!texte.length || !ctx || typeof ctx.roundRect !== 'function') return;
        ctx.font = Art.font(14);
        const breiten = texte.map(t => ctx.measureText(t).width + 22);
        let x = Game.hudW / 2 - (breiten.reduce((a, b) => a + b + 8, -8)) / 2;
        const y = 58;
        for (let i = 0; i < texte.length; i++) {
            ctx.fillStyle = 'rgba(18,8,38,0.62)';
            ctx.beginPath();
            ctx.roundRect(x, y, breiten[i], 26, 13);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.14)';
            ctx.lineWidth = 1;
            ctx.stroke();
            Art.text(ctx, texte[i], x + breiten[i] / 2, y + 13.5, { size: 14, color: '#ffe38a', lineWidth: 3 });
            x += breiten[i] + 8;
        }
    },

    // Von main.js nach HUD.draw (Koordinaten wie das HUD)
    zeichneHud(ctx) {
        const run = Modes.run;
        if (!run || (Game.state !== 'PLAYING' && Game.state !== 'BOSS_INTRO')) return;
        if (typeof run.mode.drawHud === 'function') {
            try { run.mode.drawHud(ctx); }
            catch (e) { modeProblem('drawHud ' + run.mode.id, e); run.mode.drawHud = null; }
            return;
        }
        Modes.hudStatus(ctx);
    },

    // Von main.js vor dem HUD (Koordinaten der Spielansicht): Dunkelheit mit Licht um Mark
    zeichneDunkelheit(ctx, camera) {
        const run = Modes.run, g = Game;
        if (!run || !run.dunkel || !g.player || !camera) return;
        const vw = g.viewW, vh = g.viewH;
        const schluessel = Math.round(vw) + 'x' + Math.round(vh) + run.dunkelFarbe + run.dunkel;
        if (run._lichtSchluessel !== schluessel) {
            run._lichtSchluessel = schluessel;
            run._licht = WorldPaint.lightSprite(vw, vh, run.dunkelFarbe, run.dunkel);
        }
        if (!run._licht) return;
        const p = camera.worldToScreen(g.player.x + g.player.w / 2, g.player.y + g.player.h / 2);
        ctx.drawImage(run._licht, p.x - vw, p.y - vh, vw * 2, vh * 2);
    },

    // Von main.js beim Tod von Mark. true = der Modus hat übernommen (eigene Ergebnis-Seite).
    spielerGestorben() {
        const run = Modes.run;
        if (!run || typeof run.mode.onPlayerDeath !== 'function') return false;
        try {
            const uebernommen = run.mode.onPlayerDeath(Game) !== false;
            // Uebernommen heisst: der Modus hat die Runde beendet. Tut er es nicht, wuerde
            // main.js den Tod jeden Takt erneut melden - also beendet ihn hier das Geruest.
            if (uebernommen && Game.state !== 'MODE_RESULT') Modes.finish({ text: 'Runde vorbei.' });
            return uebernommen;
        }
        catch (e) { modeProblem('onPlayerDeath ' + run.mode.id, e); return false; }
    },

    // Von main.js beim Boss-Sieg, bevor Welt-Belohnung und Freischaltungen kommen.
    // true = der Modus übernimmt (dann gibt es keine Welt-Belohnung und keine Freischaltung).
    bossBesiegt() {
        const run = Modes.run;
        if (!run || typeof run.mode.onWorldClear !== 'function') return false;
        try { return run.mode.onWorldClear(Game) !== false; }
        catch (e) { modeProblem('onWorldClear ' + run.mode.id, e); return false; }
    },

    // Münzen nach Leistung (ein Modus kann das mit `belohnung` überschreiben)
    belohnung(run, punkte, zeit) {
        const m = run.mode;
        if (typeof m.belohnung === 'function') {
            try { return Math.max(0, Math.round(+m.belohnung({ punkte, zeit, modus: m }) || 0)); }
            catch (e) { modeProblem('belohnung ' + m.id, e); }
        }
        if (m.wertung === 'zeit') return clamp(300 - Math.round(zeit * 3), 25, 300);
        return clamp(20 + Math.round(punkte / 8), 20, 400);
    },

    // ══════════════ Baustein 6: die Ergebnis-Seite des Modus ══════════════
    // { punkte, zeit, text, muenzen }  - Punkte/Zeit fehlen → nimmt der Modus hat angesammelte Werte
    finish(info) {
        const run = Modes.run;
        if (!run || run.ende) return false;
        run.ende = true;
        const m = run.mode;
        const i = info || {};
        const punkte = Math.max(0, Math.round(+i.punkte || run.punkte || 0));
        const zeit = Math.max(0, Math.round((Number.isFinite(+i.zeit) && +i.zeit > 0 ? +i.zeit : run.zeit) * 10) / 10);
        const zeitModus = m.wertung === 'zeit';
        const wert = zeitModus ? zeit : punkte;
        const alt = Modes.rekord(m.id);
        // null wird im Spielstand nicht gehalten (main.js verwirft 0) - also auch nicht versprechen
        const neu = wert > 0 && (alt === null || (zeitModus ? wert < alt : wert > alt));
        if (neu) Modes.setRekord(m.id, wert);
        let munzen = Number.isFinite(+i.muenzen) ? +i.muenzen : Modes.belohnung(run, punkte, zeit);
        munzen = Math.max(0, Math.round(munzen));
        if (munzen) Game._grantCoins(munzen);
        Game.save();
        Modes.lastReward = munzen;
        const bild = {
            id: m.id, name: m.name, emoji: m.emoji, wertung: m.wertung,
            text: typeof i.text === 'string' ? i.text : (zeitModus ? 'Durchgespielt.' : 'Runde vorbei.'),
            punkte, zeit, alt, neu, munzen,
        };
        Modes.lastModeId = m.id;      // zuruecksetzen nimmt den Modus, die Seite braucht ihn noch
        Modes.zuruecksetzen();
        Modes.zeigeErgebnis(bild);
        return true;
    },

    zeigeErgebnis(b) {
        const el = UI.screens.mode;
        if (!el) { Game.returnToTitle(); return; }
        const zeitText = b.wertung === 'zeit' ? 'Zeit ' + Modes.zeitText(b.zeit) : b.punkte + ' Punkte';
        const altText = b.wertung === 'zeit' ? 'Bestzeit ' + Modes.zeitText(b.alt) : 'Rekord ' + b.alt + ' Punkte';
        el.innerHTML = `<div class="dialog">
            <h2>${b.emoji} ${modusText(b.name)}</h2>
            <div class="sub">${modusText(b.text)}</div>
            <div class="reward-box">
                <span class="big">${b.wertung === 'zeit' ? '⏱️' : '🎯'}</span><span>${zeitText}</span>
                ${b.alt !== null ? `<span>🏅 ${altText}</span>` : ''}
                ${b.neu ? '<span class="big">🌟</span><span>Neue Bestmarke!</span>' : ''}
                ${b.munzen ? `<span class="big">🪙</span><span>+${b.munzen} Belohnung</span>` : ''}
            </div>
            <div class="row">
                <button class="btn big green pulse" data-act="moderetry" data-id="${b.id}">↻ Nochmal</button>
                <button class="btn gray" data-act="modemenu">🎮 Zurück</button>
            </div></div>`;
        Game.setState('MODE_RESULT');
        UI.show('mode');
        // Kurz sperren, damit wildes Weitertippen aus dem Kampf nicht sofort einen Knopf trifft
        const dlg = el.querySelector('.dialog');
        if (dlg) {
            dlg.classList.add('locked');
            setTimeout(() => dlg.classList.remove('locked'), 650);
        }
    },

    // Erst der Münz-Berg (wie alle Belohnungen ohne Zähler), dann weiter
    _danach(aktion) {
        const munzen = Modes.lastReward || 0;
        Modes.lastReward = 0;
        const weiter = () => {
            UI.show(null);
            // Klappt das Weiterkommen nicht (Modus inzwischen gesperrt), nicht im Nichts stehen
            if (!aktion()) Game.openExtraMode();
        };
        if (munzen > 0 && typeof BoxUI !== 'undefined' &&
            BoxUI.showRewards([{ coins: munzen }], weiter, { head: 'Modus-Belohnung' })) {
            return true;
        }
        weiter();
        return true;
    },

    // Von den Knöpfen auf der Ergebnis-Seite und von Enter/Escape in main.js
    neuStarten() {
        const run = Modes.run;
        const id = run ? run.mode.id : (Game.activeMode ? Game.activeMode.id : Modes.lastModeId);
        return Modes._danach(() => (id ? Modes.start(id) : false));
    },

    insMenue() {
        return Modes._danach(() => { Game.openExtraMode(); return true; });
    },

    ext: {
        screens: { mode: 'overlay' },
        onClick(act, btn) {
            if (act === 'moderetry') return Modes.neuStarten();
            if (act === 'modemenu') return Modes.insMenue();
            return false;
        },
    },
};

// Bildschirm und Knöpfe der Ergebnis-Seite bei der Oberfläche anmelden
UI.register(Modes.ext);
