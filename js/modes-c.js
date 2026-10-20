// ── Extra-Modi, Paket C ──
// Sechs echte Modi fuer das Extra-Menue: Fangen, Zufallswelt, Tages-Herausforderung,
// Wochen-Boss, Party-Modus und Nur-Schlaeger-Modus.
//
// Nur diese Datei wird dafuer gebaut. Das Geruest (registerMode, Rekorde, Bausteine,
// Ergebnis-Seite) erklaert js/modes.js im Detail. Alles hier steckt in einer eigenen
// Huelle, damit kein einziger Name in die anderen Modi-Pakete (js/modes-a/b/d.js) hineinlaeuft.

(function () {
    // ══════════════════════════ Helfer (nur in diesem Paket sichtbar) ══════════════════════════

    function zahl(bis) { return Math.floor(Math.random() * (bis + 1)); }
    function bereich(von, bis) { return von + zahl(bis - von); }
    function eins(aus) { return aus[zahl(aus.length - 1)]; }
    function mische(liste) {
        for (let i = liste.length - 1; i > 0; i--) {
            const j = zahl(i);
            const t = liste[i]; liste[i] = liste[j]; liste[j] = t;
        }
        return liste;
    }

    // Der heutige Tag (Jahr-Monat-Tag) - der Spielstand nutzt denselben Schluessel schon fuer
    // seine taegliche Belohnung, also passt beides zusammen.
    function heute(g) {
        if (g && typeof g._todayKey === 'function') {
            try { const k = g._todayKey(); if (typeof k === 'string' && k) return k; }
            catch (e) { /* eigene Rechnung unten */ }
        }
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
            '-' + String(d.getDate()).padStart(2, '0');
    }

    // Die laufende Kalenderwoche nach ISO 8601: gezaehlt wird von der Woche mit dem 4. Januar,
    // und der Donnerstag entscheidet, zu welcher Woche ein Tag gehoert.
    function donnerstagEinerWoche(von) {
        return new Date(von.getFullYear(), von.getMonth(), von.getDate() + 3 - ((von.getDay() + 6) % 7));
    }
    function dieseWoche() {
        const donnerstag = donnerstagEinerWoche(new Date());
        // Der 4. Januar steckt immer in Woche 1; sein Donnerstag ist der Anker des Jahres.
        const anker = donnerstagEinerWoche(new Date(donnerstag.getFullYear(), 0, 4));
        const woche = 1 + Math.round(((donnerstag - anker) / 86400000) / 7);
        return donnerstag.getFullYear() + '-W' + String(woche).padStart(2, '0');
    }

    // Immer derselbe Text gibt dieselbe Zahl - daraus waehlt die Tages- und die Wochenwelt
    // ihre Welt, ihren Boss und ihre Regel, ohne dass irgendwo ein Zufall steckt.
    function saat(text) {
        let h = 7;
        const t = String(text || '');
        for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 2147483647;
        return h;
    }

    // Merker "die Belohnung war schon" im Feld Game.modeRecords: der Spielstand haellt dort
    // schon Zahlen (die Rekorde), ein zusaetzlicher Eintrag ist fuer alte Staende einfach
    // eine weitere Zahl und veraendert nichts an ihnen.
    function merkerName(basis, schluessel) { return 'c-' + basis + '-' + schluessel; }
    function hatMerker(g, basis, schluessel) {
        return !!(g && g.modeRecords && g.modeRecords[merkerName(basis, schluessel)]);
    }
    function setzeMerker(g, basis, schluessel) {
        if (!g) return;
        if (!g.modeRecords || typeof g.modeRecords !== 'object') g.modeRecords = {};
        g.modeRecords[merkerName(basis, schluessel)] = 1;
    }

    // Eine Welt aus dem, was schon geschafft ist (nie ueber LAST_WORLD hinaus).
    function weltAus(g, unten) {
        const oben = Math.max(unten || 1, Math.min(LAST_WORLD, (g && g.maxWorldUnlocked) || 1));
        return bereich(unten || 1, oben);
    }
    function weltAusSaat(g, schluessel) {
        const oben = Math.max(1, Math.min(LAST_WORLD, (g && g.maxWorldUnlocked) || 1));
        return 1 + (saat(schluessel) % oben);
    }

    // Gegner, die Mark von sich aus verfolgen (alle aus den Welten, also wirklich vorhanden).
    function laeufer() {
        return [Ghost, Slime, WalkingMushroom, IcePenguin, AngryFruit, SwampMosquito,
            ShadowGhost, LavaBall, Zombie, MiniTRex, FootballEnemy, ScrapRaccoon];
    }
    function taenzer() {
        return [Ghost, Slime, WalkingMushroom, AngryFruit, SwampMosquito, IcePenguin, StarButterfly];
    }

    // Waffenruhe: Marks Schlaeger trifft nichts mehr und wirft nichts mehr. Die Methoden haengen
    // nur an Marks eigenem Schlaeger-Objekt (das wird in jeder Welt neu gebaut), keine gemeinsame
    // Klasse wird angefasst - in einer anderen Welt schlaegt Mark ganz normal zu.
    function waffenRuhe(g) {
        const p = g && g.player;
        if (!p) return;
        const schlaeger = p.meleeWeapon;
        if (!schlaeger) return;
        schlaeger.canAttack = () => false;
        schlaeger.attack = () => false;
        schlaeger.getHitEntities = () => [];
        p.activeWeapon = schlaeger;
        p.rangedWeapon = null;        // auch der Knopf "Waffe wechseln" findet nichts mehr
        p.autoAttack = false;
        p.hasAuto = false;
        p.autoActive = false;
        g.companions.length = 0;      // die Freunde wuerfen sonst fuer Mark mit
    }

    // Nur der Schlaeger: keine Wurfwaffe, kein Auto, keine Freunde, keine Upgrade-Wirkung.
    // Die Haken der gewaehlten Extras (js/upgrades.js) werden geleert, die Waffe auf den
    // Grundwert des Baseballschlaegers zurueckgesetzt. Gewaehlt bleibt es im Shop unveraendert.
    function nurSchlaeger(g) {
        const p = g && g.player;
        if (!p) return;
        const schlaeger = p.meleeWeapon;
        if (schlaeger) {
            schlaeger.damage = 4;             // Grundwert aus js/weapons.js (BaseballSchlaeger)
            schlaeger.boneBat = false;
            schlaeger.cooldown = 0.35;
            p.activeWeapon = schlaeger;
        }
        p.rangedWeapon = null;                // wie in Welt 1: es gibt nichts zu werfen
        p.autoAttack = false;
        p.hasAuto = false;
        p.autoActive = false;
        p.hasCrown = false;
        p.crownShieldTimer = 0;
        p.orangeExplosion = false;
        p.baseSpeed = 150;                    // Grundtempo aus js/player.js
        p.speed = p.baseSpeed;
        g.companions.length = 0;
        leereHaken(p.hooks);
        leereHaken(g.roundHooks);
    }

    function leereHaken(haken) {
        if (!haken || typeof haken !== 'object') return;
        for (const name in haken) if (Array.isArray(haken[name])) haken[name].length = 0;
    }

    // Bleibt dabei, jeden Takt: der Schlaeger bleibt Marks einzige Waffe, auch wenn das Spiel
    // zwischendurch (Auto, Krone, Begleiter) etwas an der Ausruestung drehen wollte.
    function schlaegerHalten(g) {
        const p = g && g.player;
        if (!p) return;
        if (p.meleeWeapon && p.activeWeapon !== p.meleeWeapon) p.activeWeapon = p.meleeWeapon;
        if (p.rangedWeapon) p.rangedWeapon = null;
        if (p.hasAuto || p.autoActive) { p.hasAuto = false; p.autoActive = false; }
        if (g.companions.length) g.companions.length = 0;
        leereHaken(p.hooks);
        leereHaken(g.roundHooks);
    }

    // Freie Bodenfelder und erreichbare Kacheln neu einsammeln - so wie main.js es beim
    // Weltstart macht (der Boss-Raum bleibt frei, damit dort keine Gegner zwischen den
    // Wänden stehen). Noetig, nachdem ein Modus die Karte ausgetauscht hat.
    function bodenMerk(g) {
        const w = g.world;
        if (!w || !w.tiles || !w.tiles.length) return;
        g._reach = reachableTiles(w.tiles,
            Math.floor(w.spawnPoint.x / TILE_SIZE), Math.floor(w.spawnPoint.y / TILE_SIZE));
        const liste = [];
        for (let y = 2; y < w.height - 2; y++) {
            for (let x = 2; x < w.width - 2; x++) {
                if (w.tiles[y][x] !== TILE_FLOOR) continue;
                if (typeof g._isBossRoomTile === 'function' && g._isBossRoomTile(x, y)) continue;
                liste.push({ x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 });
            }
        }
        g._floorTiles = mische(liste);
    }

    // Eine ganz neue Karte aus dem Karten-Baukasten des Spiels (Raeume, Gänge, Boss-Raum
    // mit Tür) und den ueblichen Dekor-Kacheln.
    function neueKarte() {
        const karte = generateLevel(bereich(46, 56), bereich(42, 50), bereich(12, 16), bereich(1000, 999999));
        if (typeof sprinkleSpecialTiles === 'function') sprinkleSpecialTiles(karte);
        return karte;
    }

    // Die neu gebaute Karte ueber die laufende Welt legen: Mark auf das neue Startfeld,
    // alte Gegner und Truhen weg, dann Inhalt und Gegner dieser Welt auf die neue Karte.
    function karteTauschen(g) {
        const w = g.world, p = g.player;
        if (!w || !p) return false;
        w.load(neueKarte());
        p.x = w.spawnPoint.x - p.w / 2;
        p.y = w.spawnPoint.y - p.h / 2;
        g.enemies.length = 0;
        g.projectiles.length = 0;
        g.chests.length = 0;
        g.keyDrops.length = 0;
        g.coinDrops.length = 0;
        g.props.length = 0;
        g.hasKey = false;
        g.bossActive = false;
        g.bossDefeated = false;
        if (g.camera) {
            g.camera.x = p.x + p.w / 2 - g.viewW / 2;
            g.camera.y = p.y + p.h / 2 - g.viewH / 2;
            g.camera.clampTo(w.pixelWidth, w.pixelHeight);
        }
        bodenMerk(g);
        if (typeof g._spawnWorldContent === 'function') g._spawnWorldContent(w.worldNum);
        return true;
    }

    // Gegner, die in diesem Modus gestorben sind, in Punkte umwandeln. Jeder Leichnam wird
    // genau einmal gezaehlt (Merker haelt an der Figur selbst, die Figur gehoert der Runde).
    function kopfeZaehlen(proKopf) {
        const run = Modes.run;
        if (!run) return 0;
        let n = 0;
        for (const e of Game.enemies) {
            if (e && e.dead && !e._cGeoerfelt) { e._cGeoerfelt = true; n++; }
        }
        if (n) Modes.punkte(n * proKopf);
        return n;
    }

    // Der Zustand der laufenden Runde (nur ein Modus laeuft gleichzeitig, alles hier ist
    // nach dem Start einer Runde gueltig und wird beim Start zurueckgesetzt).
    const zustand = {};

    // ══════════════ Modus 1: Fangen - 60 Sekunden rennen, nichts schlagen ══════════════
    const FANGEN_DAUER = 60;

    registerMode({
        id: 'fangen',
        name: 'Fangen',
        emoji: '🏃',
        text: 'Renn weg! 60 Sekunden überleben, ganz ohne Waffen.',
        frei: g => g.maxWorldUnlocked >= 3,
        hinweis: 'Erst Welt 3 schaffen, dann darfst du rennen.',
        wertung: 'punkte',

        start(g) {
            zustand.guthaben = 0;
            // Die Halle: viel Platz zum Ausweichen, drei Herzen, Gegner aus dem Haltbaren
            Modes.arena({ welt: weltAus(g, 1), herzen: 3, breite: 44, hoehe: 24 });
            waffenRuhe(g);            // erst steht die Welt, dann kann Marks Ausruestung stillgelegt werden
            Modes.dauerwellen({ gegner: laeufer(), pro: 3, interval: 4.5, erster: 0.8, maxLeben: 14 });
        },

        update(dt) {
            zustand.guthaben += dt;
            while (zustand.guthaben >= 1) {
                zustand.guthaben -= 1;
                Modes.punkte(10);     // zehn Punkte fuer jede Sekunde, die Mark nicht erwischt wird
            }
            if (Modes.zeit() >= FANGEN_DAUER) {
                Modes.finish({ text: 'Geschafft! ' + FANGEN_DAUER + ' Sekunden nicht erwischt.' });
            }
        },

        onPlayerDeath() {
            Modes.finish({ text: 'Erwischt nach ' + Math.floor(Modes.zeit()) + ' von ' + FANGEN_DAUER + ' Sekunden.' });
            return true;
        },

        drawHud(ctx) {
            Modes.hudStatus(ctx, [
                '⏱ ' + Modes.zeitText(Math.max(0, FANGEN_DAUER - Modes.zeit())),
                '🎯 ' + Modes.punkte(0),
                '🚫 Nur rennen',
            ]);
        },

        belohnung(o) { return clamp(50 + Math.round((o.punkte || 0) / 2), 50, 350); },
    });

    // ══════════════ Modus 2: Zufallswelt - jedes Mal eine neue Karte ══════════════
    const ZUFALL_FRIST = 200;

    registerMode({
        id: 'zufallswelt',
        name: 'Zufallswelt',
        emoji: '🎲',
        text: 'Jedes Mal eine ganz neu gebaute Karte, mit fremden Gegnern und ihrem Boss.',
        frei: g => g.maxWorldUnlocked >= 5,
        hinweis: 'Erst Welt 5 schaffen, dann würfelt die Welt.',
        wertung: 'punkte',

        start(g) {
            const welt = weltAus(g, 1);
            zustand.welt = welt;
            zustand.thema = worldInfo(welt).name;
            zustand.guthaben = 0;
            Modes.starteWelt({ welt, herzen: 4 });
            karteTauschen(g);         // Thema, Gegner und Boss der Welt bleiben, die Karte ist neu
        },

        update(dt) {
            kopfeZaehlen(8);
            zustand.guthaben += dt;
            while (zustand.guthaben >= 1) {
                zustand.guthaben -= 1;
                Modes.punkte(1);      // jede Sekunde in der neuen Karte zaehlt mit
            }
            if (Modes.zeit() >= ZUFALL_FRIST) {
                Modes.finish({ text: 'Die Zeit ist um - ' + zustand.thema + ' behält seinen Boss.' });
            }
        },

        onPlayerDeath() {
            Modes.finish({ text: zustand.thema + ' war zu stark. Die nächste Karte wird besser.' });
            return true;
        },

        onWorldClear() {
            Modes.punkte(200);        // der Boss dieser Welt ist das Ziel: er gibt den grossten Brocken
            return Modes.finish({ text: 'Neue Karte, neuer Boss: ' + zustand.thema + ' geschafft!' });
        },

        drawHud(ctx) {
            Modes.hudStatus(ctx, [
                '🎲 ' + zustand.thema,
                '⏳ ' + Modes.zeitText(Math.max(0, ZUFALL_FRIST - Modes.zeit())),
                '🎯 ' + Modes.punkte(0),
            ]);
        },

        belohnung(o) { return clamp(60 + Math.round((o.punkte || 0) / 3), 60, 420); },
    });

    // ══════════════ Modus 3: Tages-Herausforderung - eine Welt, eine Regel am Tag ══════════════
    // Die Regeln sind aus dem Datum gewaehlt: heute gilt ueberall dieselbe, morgen eine andere.
    const TAGES_REGELN = [
        { name: 'Turbo-Tag', opts: { tempo: 1.3 }, text: 'Alles ist eine Spur schneller.' },
        { name: 'Zwei-Herzen-Tag', opts: { herzen: 2 }, text: 'Mark hat nur zwei Herzen.' },
        { name: 'Spiegel-Tag', opts: { spiegel: true }, text: 'Die Welt ist seitenverkehrt.' },
        { name: 'Nebel-Tag', opts: { dunkelheit: 0.86, dunkelFarbe: '#0a1230' }, text: 'Dicker Nebel liegt über der Welt.' },
        { name: 'Besuchs-Tag', opts: { besuch: true }, text: 'Es kommen ständig Besucher dazu.' },
        { name: 'Zwergen-Tag', opts: { groesse: 0.7 }, text: 'Mark ist klein wie eine Maus.' },
    ];

    registerMode({
        id: 'tages-herausforderung',
        name: 'Tages-Herausforderung',
        emoji: '📅',
        text: 'Heute eine besondere Welt mit einer Regel, die nur heute gilt.',
        frei: g => g.maxWorldUnlocked >= 4,
        hinweis: 'Erst Welt 4 schaffen.',
        wertung: 'zeit',

        start(g) {
            const tag = heute(g);
            const zahltag = saat(tag);
            zustand.tag = tag;
            zustand.welt = weltAusSaat(g, tag);
            zustand.regel = TAGES_REGELN[zahltag % TAGES_REGELN.length];
            zustand.besuch = 0;
            const opts = Object.assign({ herzen: 4 }, zustand.regel.opts || {});
            const besuch = !!opts.besuch;
            delete opts.besuch;
            zustand.besuchRegel = besuch;
            Modes.starteWelt(Object.assign({ welt: zustand.welt }, opts));
        },

        update(dt) {
            if (zustand.besuchRegel) {
                zustand.besuch -= dt;
                if (zustand.besuch <= 0) {
                    zustand.besuch = 12;
                    Modes.welle({ gegner: laeufer(), anzahl: 3 });
                }
            }
        },

        // Verloren ist verloren: der Tag bekommt keine Bestzeit, dafuer zeigt das Spiel
        // seinen ueblichen "nochmal versuchen"-Bildschirm.
        onPlayerDeath() { return false; },

        onWorldClear() {
            const schon = hatMerker(Game, 'tag', zustand.tag);
            if (!schon) setzeMerker(Game, 'tag', zustand.tag);
            const munzen = schon ? 40 : clamp(140 + zustand.welt * 3, 140, 400);
            return Modes.finish({
                text: zustand.regel.name + ' in ' + worldInfo(zustand.welt).name + ' geschafft' +
                    (schon ? ' - die Tages-Belohnung gab es heute schon.' : '.'),
                muenzen: munzen,
            });
        },

        drawHud(ctx) {
            Modes.hudStatus(ctx, [
                '📅 ' + worldInfo(zustand.welt).name,
                '✨ ' + zustand.regel.name,
                '⏱ ' + Modes.zeitText(Modes.zeit()),
            ]);
        },
    });

    // ══════════════ Modus 4: Wochen-Boss - alle sieben Tage ein Superboss ══════════════
    // Derselbe Boss wie in seiner Welt, aber eine Stufe drueber: anderthalbmal so viel Leben und
    // 1,2-mal so zaehe wie ein Welt-Boss. Die Welt des Bosses
    // haelt sich die Woche ueber (aus der Wochennummer gewaehlt), damit alle Kinder
    // dieselbe Aufgabe haben.
    function superboss(g) {
        if (!g || typeof g._spawnBoss !== 'function') return false;
        g._spawnBoss();                                     // nimmt den Boss der laufenden Welt
        const boss = g.enemies.find(e => e && e.isBoss && !e.dead);
        if (!boss) return false;
        // Der Wochen-Boss bleibt eine Stufe ueber den normalen Bossen: auf deren neue Werte
        // (3,2-mal Leben, 1,4-mal zaeh) kommen darauf SUPERBOSS_HP-mal Leben und
        // SUPERBOSS_TOUGHNESS-mal Zaehigkeit (frueher 3,2 und 1,4 - auf der alten Boss-Basis).
        boss.maxHp = Math.round(boss.maxHp * SUPERBOSS_HP);
        boss.hp = boss.maxHp;
        boss._g1BossSkala = (boss._g1BossSkala || BOSS_HP) * SUPERBOSS_HP;
        boss.toughness = (boss.toughness || BOSS_TOUGHNESS) * SUPERBOSS_TOUGHNESS;
        boss.superboss = true;
        return true;
    }

    registerMode({
        id: 'wochen-boss',
        name: 'Wochen-Boss',
        emoji: '👑',
        text: 'Jede Woche ein Superboss: eine Stufe staerker als ein Welt-Boss, große Belohnung.',
        frei: g => g.maxWorldUnlocked >= 10,
        hinweis: 'Erst 10 Welten schaffen, dann kommt der Wochen-Boss.',
        wertung: 'zeit',

        start(g) {
            const woche = dieseWoche();
            zustand.woche = woche;
            zustand.welt = weltAusSaat(g, 'woche' + woche);
            const info = worldInfo(zustand.welt);
            zustand.bossName = info.boss || info.name;
            zustand.weltName = info.name;
            Modes.arena({ welt: zustand.welt, herzen: 6, breite: 42, hoehe: 24, thema: info.theme });
            if (!superboss(g)) throw new Error('Superboss nicht möglich');
        },

        // Der Wochen-Boss ist eine ehrliche Sache: wer verliert, bekommt keine Zeit
        // vorgemerkt, sondern sieht den ueblichen "nochmal versuchen"-Bildschirm.
        onPlayerDeath() { return false; },

        onWorldClear() {
            const schon = hatMerker(Game, 'woche', zustand.woche);
            if (!schon) setzeMerker(Game, 'woche', zustand.woche);
            return Modes.finish({
                text: zustand.bossName + ' (aus ' + zustand.weltName + ') als Superboss bezwungen' +
                    (schon ? ' - die Wochen-Belohnung gab es aber schon.' : '!'),
                muenzen: schon ? 60 : clamp(330 + zustand.welt * 3, 330, 500),
            });
        },

        drawHud(ctx) {
            const boss = Game.enemies.find(e => e && e.isBoss && !e.dead);
            Modes.hudStatus(ctx, [
                '👑 ' + zustand.bossName,
                boss ? '❤️ ' + Math.max(0, Math.ceil(boss.hp)) : '❤️ besiegt',
                '⏱ ' + Modes.zeitText(Modes.zeit()),
            ]);
        },
    });

    // ══════════════ Modus 5: Party-Modus ══════════════
    const PARTY_DAUER = 90;
    const PARTY_FARBEN = ['#ff5aa0', '#ffd23f', '#5fe0ff', '#9dff72', '#c08bff'];

    // Ein Bonbon faellt vom Himmel: eine Muenze auf einem freien Bodenfeld in Marks Naehe.
    function bonbon(g) {
        const p = g.player, felder = g._floorTiles;
        if (!p || !felder || !felder.length) return;
        const mx = p.x + p.w / 2, my = p.y + p.h / 2;
        for (let versuch = 0; versuch < 14; versuch++) {
            const f = eins(felder);
            if (Math.abs(f.x - mx) < g.viewW * 0.62 && Math.abs(f.y - my) < g.viewH * 0.62) {
                if (typeof g._dropCoin === 'function') g._dropCoin(f.x, f.y, 1, false);
                FX.burst(f.x, f.y - 8, ['#ff8ad8', '#ffe38a', '#7de3ff'], 6, 90, 0.4, { kind: 'spark' });
                return;
            }
        }
    }

    registerMode({
        id: 'party',
        name: 'Party-Modus',
        emoji: '🎉',
        text: 'Die Gegner tanzen, Bonbons regnen vom Himmel, bunte Lichter blinken.',
        frei: g => g.maxWorldUnlocked >= 2,
        hinweis: 'Erst Welt 2 schaffen, dann wird gefeiert.',
        wertung: 'punkte',

        start(g) {
            zustand.tanz = 0;
            zustand.bonbon = 0.4;
            zustand.guthaben = 0;
            zustand.musikAn = false;
            zustand.muenzenStand = 0;
            Modes.arena({ welt: 1, thema: 'candy', herzen: 4, breite: 46, hoehe: 26 });
            if (typeof FX.setAmbient === 'function') FX.setAmbient('candy', g.viewW, g.viewH);
            Modes.dauerwellen({ gegner: taenzer(), pro: 3, interval: 5, erster: 1, maxLeben: 16 });
            zustand.muenzenStand = g.levelCoins;
        },

        update(dt) {
            const g = Game;
            if (!zustand.musikAn) {
                zustand.musikAn = true;
                if (typeof Music !== 'undefined' && typeof Music.play === 'function') Music.play('happy');
            }
            kopfeZaehlen(2);
            zustand.guthaben += dt;
            while (zustand.guthaben >= 1) {
                zustand.guthaben -= 1;
                Modes.punkte(2);      // dabei sein zaehlt mit: zwei Punkte pro Sekunde Party
            }
            // eingesammelte Bonbons zaehlen
            const seit = (g.levelCoins || 0) - zustand.muenzenStand;
            if (seit > 0) {
                zustand.muenzenStand = g.levelCoins;
                Modes.punkte(seit * 5);
            }
            zustand.bonbon -= dt;
            if (zustand.bonbon <= 0) {
                zustand.bonbon = 0.7;
                bonbon(g);
            }
            // Die Gegner tanzen: ihr Tempo pendelt im Takt, dazu von Zeit zu Zeit Konfetti
            zustand.tanz += dt;
            for (let i = 0; i < g.enemies.length; i++) {
                const e = g.enemies[i];
                if (!e || e.dead || e.isBoss) continue;
                e.tempo = 1 + Math.sin(Art.time * 5 + i * 1.3) * 0.45;
            }
            if (Math.sin(Art.time * 2.6) > 0.99 && g.player) FX.confetti(g.player.x, g.player.y - 10, 16);
            if (Modes.zeit() >= PARTY_DAUER) {
                Modes.finish({ text: 'Party vorbei: ' + (g.levelCoins || 0) + ' Bonbons gesammelt.' });
            }
        },

        onPlayerDeath() {
            Modes.finish({ text: 'Die Party war zu wild - ' + (Game.levelCoins || 0) + ' Bonbons bleiben.' });
            return true;
        },

        drawHud(ctx) {
            const g = Game;
            // bunte Lichter ueber dem ganzen Bildschirm
            ctx.globalAlpha = 0.15;
            for (let i = 0; i < PARTY_FARBEN.length; i++) {
                const grund = (i + 1) * 0.7;
                const x = (Math.sin(Art.time * grund + i * 2.1) * 0.5 + 0.5) * g.hudW;
                const y = (Math.cos(Art.time * grund * 0.8 + i * 1.7) * 0.5 + 0.5) * g.hudH;
                const r = 70 + 26 * Math.sin(Art.time * 2 + i);
                ctx.fillStyle = PARTY_FARBEN[i];
                ctx.beginPath();
                ctx.arc(x, y, Math.max(20, r), 0, 6.2832);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            Modes.hudStatus(ctx, [
                '🎉 ' + Modes.zeitText(Math.max(0, PARTY_DAUER - Modes.zeit())),
                '🍬 ' + (Game.levelCoins || 0),
                '🎯 ' + Modes.punkte(0),
            ]);
        },

        belohnung(o) { return clamp(60 + Math.round((o.punkte || 0) / 3), 60, 320); },
    });

    // ══════════════ Modus 6: Nur-Schläger-Modus ══════════════
    registerMode({
        id: 'nur-schlaeger',
        name: 'Nur-Schläger-Modus',
        emoji: '🏏',
        text: 'Eine Welt nur mit dem Schläger: kein Wurf, kein Auto, keine Upgrades.',
        frei: g => g.maxWorldUnlocked >= 2,
        hinweis: 'Erst Welt 2 schaffen.',
        wertung: 'zeit',

        start(g) {
            zustand.welt = weltAus(g, 2);
            zustand.weltName = worldInfo(zustand.welt).name;
            Modes.starteWelt({ welt: zustand.welt, herzen: 4 });
            nurSchlaeger(g);
        },

        update() {
            schlaegerHalten(Game);      // bleibt so, bis die Runde um ist
        },

        onPlayerDeath() { return false; },

        onWorldClear() {
            return Modes.finish({ text: zustand.weltName + ' nur mit dem Schläger geschafft!' });
        },

        drawHud(ctx) {
            Modes.hudStatus(ctx, [
                '🏏 Nur Schläger',
                '🌍 ' + zustand.weltName,
                '⏱ ' + Modes.zeitText(Modes.zeit()),
            ]);
        },

        belohnung(o) { return clamp(320 - Math.round((o.zeit || 0) * 1.2), 80, 320); },
    });
})();
