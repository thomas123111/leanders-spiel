// ── Extra-Modi, Paket A: sechs echte Modi fuer das Extra-Menue ──
// Boss-Marathon, Ueberleben, Zeitrennen, Turm, Ein Herz und Schatzsuche.
// Das Geruest (registerMode, Rekorde, Bausteine, Ergebnis-Seite) erklaert js/modes.js.
//
// Zusammenhaltendes Prinzip ueber alle sechs Modi:
//   - jeder Modus traegt sich nur hier ein und fasst main.js, ui.js oder eine Welt-Datei nicht an
//   - keine Welt wird freigeschaltet und keine Welt-Belohnung kassiert (main.js hielt das fest),
//     ausgezahlt wird nur die eigene Münz-Belohnung (50 bis 500, nach Leistung)
//   - der Rekord steht im Spielstand unter der Modus-Id (Game.modeRecords), alte Spielstaende
//     haben einfach keinen und laden unveraendert
//   - drei Modi brauchen eine Welt: die sucht sich Mark in einer eigenen Auswahl-Seite
//     (unten angemeldet mit UI.register), damit das Extra-Menue unveraendert bleibt
//
// Freischaltungen (sinnvolle Welt, Hinweis steht auf der gesperrten Karte):
//   Schatzsuche ab Welt 3, Ueberleben ab Welt 5, Turm ab Welt 7, Ein Herz ab Welt 8,
//   Boss-Marathon und Zeitrennen ab Welt 10 - Werfer, Auto und Krone sind dann da,
//   und Bosse bzw. ganze Welten sind Mark nicht mehr fremd.

// Alles in einer Klammer: die Helfer dieses Pakets bleiben privat, damit die Pakete B, C und D
// in js/modes-b.js bis js/modes-d.js dieselben Namen benutzen koennen.
(() => {
    // ── kleine Helfer ──
    const hat = K => (typeof K === 'function' ? K : null);
    const weltMax = g => clamp((g && g.maxWorldUnlocked) || 1, 1, LAST_WORLD);
    // Welten, die Mark schon durch hat - die kennt er, deshalb kann man sie auch rennen
    const weltBekannt = g => clamp(weltMax(g) - 1, 1, LAST_WORLD);
    // Die Halle sieht aus wie seine neueste Welt; die Etage dreht das Aussehen durch.
    const halleWelt = (g, nr) => clamp(1 + ((nr || weltMax(g)) - 1) % weltMax(g), 1, LAST_WORLD);

    // Der eigene Zustand des laufenden Modus haengt an Modes.run (das Geruest wirft die Runde
    // weg, wenn der Modus endet) - so bleibt kein Zustand aus einer frueheren Runde stehen.
    function zustand() {
        const run = Modes.run;
        if (!run) return null;
        if (!run.modiA) run.modiA = {};
        return run.modiA;
    }

    // `hat` haelt nichts von einer Klassen-Pruefung ab, die der Aufrufer schon ausgewertet hat
    // (ein fehlender Name wirft frueher) - es haelt nur Nicht-Klassen aus der Liste, damit eine
    // Stufe nie mit einem Wert gefuellt ist, den Modes.welle nicht bauen kann.
    // Gegner in sechs Stufen (wie worldInfo die Welten): spaete Stufen sind die kraeftigeren
    // Figuren aus den hinteren Welten. Ohne gueltige Klasse faellt alles auf Geister zurueck.
    function gegnerStufen() {
        const stufen = [
            [hat(Ghost), hat(Slime), hat(GiantBat)],
            [hat(WalkingMushroom), hat(IcePenguin), hat(AngryFruit)],
            [hat(PoisonSpider), hat(Zombie), hat(Mummy)],
            [hat(Werewolf), hat(Vampire), hat(Scorpion)],
            [hat(GolemCinder), hat(EvilAngel), hat(AlienGunner)],
            [hat(StoneSamurai), hat(SlimeFrog), hat(ArmorRat)],
        ];
        const gut = stufen.map(r => r.filter(Boolean)).filter(r => r.length);
        return gut.length ? gut : [[Ghost]];
    }

    function gegnerFuer(stufe) {
        const s = gegnerStufen();
        return s[clamp(Math.floor(Math.max(1, stufe) / 2), 0, s.length - 1)];
    }

    // Eine Welle Gegner, danach etwas zaeher und schneller als die vorherige (nur feldarbeit,
    // Modes.welle setzt die Gegner selbst in freie Bodenfelder).
    function welleScharf(opts, stufe) {
        const g = Game;
        const vorher = g.enemies.length;
        const n = Modes.welle(opts);
        const zaeh = Math.min(5, 1 + stufe * 0.15);
        const tempo = Math.min(1.7, 1 + stufe * 0.03);
        for (let i = vorher; i < g.enemies.length; i++) {
            const e = g.enemies[i];
            if (!e || e.isBoss) continue;
            e.toughness = zaeh;
            e.tempo = (e.tempo || 1) * tempo;
        }
        return n;
    }

    // Zusatz-Truhen nur auf freie Felder, die Mark auch erreichen kann (Game._reach ist die
    // Reichweiten-Karte der Engine, dieselbe wie fuer den Schluessel). Die Engine selbst prueft
    // beim Truhen-Setzen nur den Abstand zum Start - eine Truhe auf einer unerreichbaren Plattform
    // waere ein Such-Ziel, das kein Kind finden kann.
    function truhenLegen(bis) {
        const g = Game, w = g.world;
        if (!w || !Array.isArray(g._floorTiles)) return;
        for (let i = g._floorTiles.length - 1; i >= 0 && g.chests.length < bis; i--) {
            const f = g._floorTiles[i];
            const feld = Math.floor(f.y / TILE_SIZE) * w.width + Math.floor(f.x / TILE_SIZE);
            if (g._reach && !g._reach[feld]) continue;
            g._floorTiles.splice(i, 1);           // das Feld ist jetzt eine Truhe, kein Gegnerfeld
            g.chests.push(new Chest(f.x - 12, f.y - 10));
        }
    }

    // Bosse in der Reihenfolge der Welten - dieselbe Zuordnung wie _spawnBoss in js/main.js.
    // (Die Tabelle in main.js ist eine lokale Konstante in dieser Funktion und von aussen nicht
    // zu lesen; eine eigene Liste ist hier der einzige Weg, ohne main.js anzufassen.)
    function alleBosse() {
        const liste = [
            BossGhost, BossGhostChick, BossSlime, BossKnightBat, BossMushroomGiant,
            BossMosquito, BossSnowEagle, BossFirePhoenix, BossShadowMaster, BossFruitKing,
            BossGhostChick, BossKnightBat, BossSkeletonRider, BossHydra, BossStoneDemon,
            BossFruitGiant, BossStingRex, BossTimeSphere, BossShadowCrocodile, BossFootball,
            BossScrapRaccoon, BossGiantZombie, BossTripleButterfly, BossDragonFather, BossGiantWerewolf,
            BossSwordAngel, BossTripleMummy, BossPigQueen, BossThunderBall, BossOldWitch,
            BossGiantBunny, BossFourArmDevil, BossAlienShip, BossGiantSpider, BossTripleToad,
            BossGiantDwarf, BossGiantTree, BossFireGolem, BossPumpkinFather, BossGiantCrab,
            BossGiantEagle, BossGiantFox, BossGiantPorcupine, BossGiantGorilla, BossGiantPeacock,
            BossGiantClown, BossGiantPanda, BossGiantUnicorn, BossGiantVampire, BossGiantSnowman,
            BossGiantGummyBear, BossGiantRat, BossGiantScorpion, BossGiantPudding, BossGiantNoodle,
            BossBeeQueen, BossGiantMonkey,
        ].map(hat);
        // Welten 11 und 12 haben eigene Boss-Varianten (wie in js/main.js)
        if (typeof BossPixelRobot === 'function') liste[10] = BossPixelRobot;
        if (typeof BossStarKnight === 'function') liste[11] = BossStarKnight;
        return liste.map(K => K || BossGhost);
    }

    function bossBis(bisWelt) {
        return alleBosse().slice(0, clamp(bisWelt, 1, LAST_WORLD));
    }

    // ── die Welt-Auswahl fuer Modi, die eine Welt brauchen ──
    // Eigener Bildschirm (von ui.js nicht angefasst), aufgerufen aus Modes.start: der Modus ist
    // dann angelegt, aber die Welt laeuft noch nicht - die Uhr eines Rennens beginnt erst mit ihr.
    const WAHL_SCHIRM = 'modiawahl';
    const WAHL_MODI = Object.create(null);

    // Welcher Modus gerade eine Welt sucht, steht am Lauf (run.modiA.wahl) und nicht in einer
    // Modul-Variable: wirft das Geruest den Lauf weg (Abbruch, Flucht ins Menue), ist auch die
    // Auswahl weg - ein Klick auf eine Welt-Karte kann dann keinen Modus mehr starten, der
    // laengst vorbei ist.
    function wahlId() {
        const z = zustand();
        return z && z.wahl ? z.wahl : '';
    }

    function bestzeitKey(id, weltNr) { return id + '@' + weltNr; }
    function Bestzeit(id, weltNr) { return Modes.rekord(bestzeitKey(id, weltNr)); }
    function merkeBestzeit(id, weltNr, zeit) {
        const alt = Bestzeit(id, weltNr);
        if (alt !== null && alt <= zeit) return false;
        Modes.setRekord(bestzeitKey(id, weltNr), zeit);   // schreibt auch in den Spielstand
        return true;
    }

    function zeigeAuswahl(id) {
        const el = UI.screens && UI.screens[WAHL_SCHIRM];
        const eintrag = WAHL_MODI[id];
        if (!el || !eintrag) return false;
        const z = zustand();
        if (z) z.wahl = id;
        const max = eintrag.bekannteWelten ? weltBekannt(Game) : weltMax(Game);
        const farben = ['#ff5d7b', '#69d26a', '#6db8ff', '#ffd23f', '#b26bff', '#4cc9f0'];
        let karten = '';
        for (let n = 1; n <= max; n++) {
            const info = worldInfo(n);
            const zeit = Bestzeit(id, n);
            karten += `<div class="card" style="--a:${farben[n % farben.length]}">
                <div class="head"><span class="ico">${Modes.sicher(info.emoji)}</span><div><h3>Welt ${n}</h3>
                <p>${Modes.sicher(info.name)}</p></div></div>
                <div class="foot">${zeit !== null ? `<span class="owned">${Modes.sicher(Modes.zeitText(zeit))}</span>`
                    : '<span class="where">noch keine Zeit</span>'}
                <button class="btn small" data-act="modiawahl" data-n="${n}">Los!</button></div></div>`;
        }
        el.innerHTML = `<div class="page-head">
            <button class="btn small gray" data-act="modiawahlzurueck">◀ Zurück</button>
            <h2>${Modes.sicher(eintrag.emoji)} ${Modes.sicher(eintrag.frage)}</h2>${UI._chips()}</div>
            <div class="page-body"><div class="cards">${karten}</div></div>`;
        // Der Stand bleibt ein Menue-Stand (kein Rennen, keine Ergebnis-Seite): so bleiben
        // Tasten und Flucht-Weg sich genau so verhalten wie im Extra-Menue. UI.onState zeigt
        // dabei das Extra-Menue - die Auswahl kommt erst danach, sonst ueberdeckt sie sich selbst.
        Game.setState('EXTRA_MENU');
        UI.show(WAHL_SCHIRM);
        return true;
    }

    UI.register({
        screens: { [WAHL_SCHIRM]: 'page' },
        onClick(act, btn) {
            const id = wahlId();
            if (act === 'modiawahl') {
                const eintrag = WAHL_MODI[id];
                const nr = +btn.dataset.n;
                if (!eintrag || !(nr >= 1)) return true;
                eintrag.aufWelt(clamp(nr, 1, LAST_WORLD));
                return true;
            }
            if (act === 'modiawahlzurueck') {
                Game.openExtraMode();       // nimmt den Modus (clearMode), die Karte bleibt wie sie war
                return true;
            }
            return false;
        },
    });

    // Ergebnis-Seite OHNE Rekord und ohne Münzen: fuer einen Versuch, der abgebrochen ist
    // (Rennen verloren, ein Herz verloren). Modes.finish wuerde die Versuchszahl als
    // Bestmarke speichern - eine zwei Sekunden lange Panne waere auf ewig die "Bestzeit".
    function ohneErgebnis(text) {
        const run = Modes.run;
        if (!run || run.ende) return false;
        run.ende = true;
        const m = run.mode;
        Modes.lastModeId = m.id;
        Modes.lastReward = 0;
        const bild = {
            id: m.id, name: m.name, emoji: m.emoji, wertung: m.wertung, text,
            punkte: 0, zeit: Modes.zeit(), alt: Modes.rekord(m.id), neu: false, munzen: 0,
        };
        Modes.zuruecksetzen();
        Modes.zeigeErgebnis(bild);
        return true;
    }

    // ══════════════ 1: Boss-Marathon ══════════════
    registerMode({
        id: 'boss-marathon',
        name: 'Boss-Marathon',
        emoji: '👹',
        text: 'Alle Bosse hintereinander, ohne Pause.',
        frei: g => weltMax(g) >= 10,
        hinweis: 'Erst Welt 9 schaffen.',
        wertung: 'punkte',                   // 100 Punkte je besiegttem Boss
        start(g) {
            const z = zustand();
            z.marathon = { besiegt: 0 };
            // Halle und Boss-Reihe müssen stehen - ohne sie ist der Modus nicht spielbar, und
            // das Geruest nimmt ihn sauber zurueck (Modus-Start fehlgeschlagen), statt eine
            // leere Halle ohne Boss laufen zu lassen.
            if (!Modes.arena({ welt: halleWelt(g), herzen: 5, breite: 42, hoehe: 24 })) {
                throw new Error('Boss-Marathon: Halle nicht gebaut');
            }
            if (!Modes.bossReihe(bossBis(weltBekannt(g)))) {
                throw new Error('Boss-Marathon: keine Bosse bekannt');
            }
        },
        onWorldClear() {
            const z = zustand();
            if (z && z.marathon) z.marathon.besiegt++;
            Modes.punkte(100);
            // Ohne Pause: der naechste Boss kommt sofort, Marks Herzen bleiben wie sie sind.
            if (Modes.naechsterBoss()) return true;
            return Modes.finish({ text: 'Alle Bosse besiegt - du bist der Star!' });
        },
        onPlayerDeath() {
            const z = zustand();
            const n = z && z.marathon ? z.marathon.besiegt : 0;
            return Modes.finish({ text: n ? n + ' Boss' + (n === 1 ? '' : 'e') + ' geschafft. Beim nächsten Mal mehr!'
                : 'Der erste Boss war zu stark. Stärker werfen!' });
        },
        belohnung({ punkte }) { return clamp(50 + Math.round(punkte / 100) * 45, 50, 500); },
        drawHud(ctx) { Modes.hudStatus(ctx); },
    });

    // ══════════════ 2: Ueberleben ══════════════
    registerMode({
        id: 'ueberleben',
        name: 'Überleben',
        emoji: '🛡️',
        text: 'Gegnerwellen in einer Arena, jede Welle ist stärker.',
        frei: g => weltMax(g) >= 5,
        hinweis: 'Erst Welt 4 schaffen.',
        wertung: 'punkte',                   // Punkte = erreichte Welle (der Rekord)
        start(g) {
            const z = zustand();
            z.wellen = { nr: 0, laeuft: false, wartet: 2 };
            Modes.arena({ welt: halleWelt(g), herzen: 6, breite: 46, hoehe: 26 });
        },
        update(dt) {
            const z = zustand();
            const w = z && z.wellen;
            if (!w) return;
            if (w.laeuft) {
                if (Modes.lebendeGegner() > 0) return;
                w.laeuft = false;
                w.wartet = 3;                 // kurze Luft holen, dann kommt die naechste Welle
            }
            w.wartet -= dt;
            if (w.wartet > 0) return;
            w.nr++;
            w.laeuft = true;
            welleScharf({
                gegner: gegnerFuer(w.nr),
                anzahl: Math.min(20, 4 + Math.round(w.nr * 1.3)),
                abstand: 240,
            }, w.nr);
            Modes.punkte(1);
            HUD.toast('Welle ' + w.nr, '#ffe38a', 1.6);
        },
        onPlayerDeath() {
            const z = zustand();
            const n = z && z.wellen ? z.wellen.nr : 0;
            return Modes.finish({ text: n <= 1 ? 'Die erste Welle war zu doll.' : 'Durchgehalten bis Welle ' + n + '.' });
        },
        belohnung({ punkte }) { return clamp(50 + punkte * 12, 50, 400); },
        drawHud(ctx) {
            const z = zustand();
            Modes.hudStatus(ctx, [
                '🛡️ Welle ' + (z && z.wellen ? z.wellen.nr : 0),
                '👹 ' + Modes.lebendeGegner() + ' Gegner',
            ]);
        },
    });

    // ══════════════ 3: Zeitrennen ══════════════
    const RENN_ID = 'zeitrennen';
    WAHL_MODI[RENN_ID] = {
        emoji: '⏱️',
        frage: 'Welche Welt willst du rennen?',
        bekannteWelten: true,
        aufWelt(nr) {
            const z = zustand();
            if (!z || !z.renn || z.renn.welt) return;
            z.renn.welt = nr;
            Modes.starteWelt({ welt: nr });
        },
    };
    registerMode({
        id: RENN_ID,
        name: 'Zeitrennen',
        emoji: '⏱️',
        text: 'Eine Welt so schnell wie möglich: Schlüssel holen, Boss besiegen.',
        frei: g => weltBekannt(g) >= 3,
        hinweis: 'Erst Welt 3 schaffen.',
        wertung: 'zeit',
        start(g) {
            const z = zustand();
            z.renn = { welt: 0 };
            // Ohne Auswahl-Seite (anderes Geraet) faellt das Rennen auf die neueste bekannte Welt.
            if (!zeigeAuswahl(RENN_ID)) WAHL_MODI[RENN_ID].aufWelt(weltBekannt(g));
        },
        onWorldClear() {
            const z = zustand();
            const nr = z && z.renn ? z.renn.welt : 0;
            const zeit = Modes.zeit();
            const neuWelt = nr ? merkeBestzeit(RENN_ID, nr, zeit) : false;
            const text = neuWelt ? 'Neue Bestzeit in ' + (worldInfo(nr) || {}).name + '!'
                : (nr ? 'Geschafft! In Welt ' + nr + ' warst du schon mal schneller.' : 'Geschafft!');
            return Modes.finish({ text });
        },
        onPlayerDeath() {
            return ohneErgebnis('Kaputt – die Zeit zählt nur, wenn du die Welt auch schaffst.');
        },
        belohnung({ zeit }) { return clamp(300 - Math.round(zeit * 2.5), 50, 300); },
        drawHud(ctx) {
            const z = zustand();
            const nr = z && z.renn ? z.renn.welt : 0;
            const alt = nr ? Bestzeit(RENN_ID, nr) : null;
            Modes.hudStatus(ctx, [
                '⏱️ ' + Modes.zeitText(Modes.zeit()),
                '🏁 ' + (nr ? 'Welt ' + nr : 'Los geht es!'),
                alt !== null ? 'Bestzeit ' + Modes.zeitText(alt) : 'Noch keine Zeit',
            ]);
        },
    });

    // ══════════════ 4: Der Turm ══════════════
    const TURM_ETAGEN = 50;

    // Werte (Thomas, 20.10.2026): Stockwerk 1 mit mindestens 20 Gegnern, je Stockwerk 3 mehr -
    // Stockwerk 10: 47, Stockwerk 30: 107, Stockwerk 50: 167. Alle Gegner laufen fünffach so
    // schnell wie normal (TURM_TEMPO); das ersetzt das frühere stufenweise Tempo (max 1,7).
    const turmAnzahl = nr => 17 + clamp(nr, 1, TURM_ETAGEN) * 3;
    const TURM_TEMPO = 5;

    // Bildrate gemessen (Chrome headless, 844x390 wie ein Handy quer, Stockwerk mit fünffach
    // schnellen Gegner): 100 gleichzeitig = 60 Bilder/s, 140 = 48,8, 167 = 35,8 - unter der
    // Marke von etwa 40. Deshalb kommt ein Stockwerk in Wellen: nie mehr als 60 gleichzeitig
    // (60 Bilder/s, großer Puffer), die Gesamtzahl des Stockwerks bleibt - der Rest rückt nach,
    // sobald die Hälfte der laufenden Welle gefallen ist.
    const TURM_GLEICHZEITIG = 60;

    // Fünffach Tempo heißt: js/main.js ruft enemy.update(dt * 5) auf, und dt ist bis 0,05 s
    // groß - ein einzelner Bild darf den Gegner damit bis zu 25 px weit tragen, durch eine
    // 32-px-Wand hindurch. Deshalb jeder Turm-Gegner in Teilschritte zerlegt: kein Schritt
    // über ~6 px, der Wandtest (baseUpdate/escapeFromWalls, moveWithCollision) wirkt in
    // jedem Teilschritt. Läuft das Spiel mit 60 Bildern, bleibt es bei einem Aufruf.
    function turmTeilschritte(e) {
        const original = e.update;
        if (typeof original !== 'function' || original.turmTeilschritte) return;
        function geteilt(dt, world, player, enemies, projectiles) {
            let rest = dt, n = 0;
            const hMax = 6 / Math.max(10, e.speed || 60);
            while (rest > 1e-4 && n++ < 32) {
                const h = Math.min(rest, hMax);
                original.call(e, h, world, player, enemies, projectiles);
                rest -= h;
            }
        }
        geteilt.turmTeilschritte = true;
        e.update = geteilt;
    }

    // Eine Welle des Stockwerks scharf machen: fünffach Tempo statt der stufenweisen
    // Steigerung von welleScharf (Zähheit bleibt) und jede Bewegung in Teilschritten
    // gegen das Wandrutschen.
    function turmWelle(nr, anzahl) {
        const g = Game;
        const vorher = g.enemies.length;
        const n = welleScharf({ gegner: gegnerFuer(nr), anzahl, abstand: 230 }, nr);
        for (let i = vorher; i < g.enemies.length; i++) {
            const e = g.enemies[i];
            if (!e || e.isBoss) continue;
            e.tempo = TURM_TEMPO;
            turmTeilschritte(e);
        }
        return n;
    }

    // Eine Etage ist ein eigener Raum: neue Halle, neues Aussehen, frische Herzen,
    // aber mehr und zähere Gegner als eine Etage tiefer.
    function turmEtage(g) {
        const z = zustand();
        const t = z && z.turm;
        if (!t) return false;
        if (t.etage >= TURM_ETAGEN) {
            t.laeuft = false;
            return Modes.finish({ text: 'Der Turm ist geschafft – 50 Stockwerke!' });
        }
        const nr = t.etage + 1;
        // Neue Halle zuerst: bleibt sie aus, war es die letzte Etage - sonst zaele ein Stockwerk,
        // das es nie gab, und die Halle ohne Gegner ist in zwei Sekunden "geschafft".
        if (!Modes.arena({
            welt: halleWelt(g, nr), herzen: 5,
            breite: 30 + (nr % 5) * 3, hoehe: 20 + (nr % 4) * 2,
        })) {
            return Modes.finish({ text: 'Der Turm macht gleich wieder auf.' });
        }
        t.etage = nr;
        t.laeuft = true;
        Modes.punkte(1);                                    // Punkte = Stockwerk (der Rekord)
        // Gesamtzahl in Wellen von höchstens TURM_GLEICHZEITIG aufteilen (bleibt gleich groß,
        // nur nicht alles gleichzeitig): Stockwerk 50 = drei Wellen zu 56, 56, 55.
        const gesamt = turmAnzahl(nr);
        t.wellenGroesse = Math.ceil(gesamt / Math.ceil(gesamt / TURM_GLEICHZEITIG));
        const n = turmWelle(nr, t.wellenGroesse);
        t.rest = Math.max(0, gesamt - n);
        t.wartet = 1.2;                                     // kurze Luft zwischen den Wellen
        HUD.toast('Stockwerk ' + t.etage + ' von ' + TURM_ETAGEN, '#ffe38a', 1.8);
        return true;
    }

    registerMode({
        id: 'turm',
        name: 'Der Turm',
        emoji: '🏰',
        text: '50 Stockwerke, jede Halle voller Gegner – und die rennen fünffach schnell.',
        frei: g => weltMax(g) >= 7,
        hinweis: 'Erst Welt 6 schaffen.',
        wertung: 'punkte',                   // Punkte = höchstes Stockwerk
        start(g) {
            const z = zustand();
            z.turm = { etage: 0, laeuft: false, wartet: 0, rest: 0, wellenGroesse: 0 };
            turmEtage(g);
        },
        update(dt) {
            const z = zustand();
            const t = z && z.turm;
            if (!t) return;
            if (t.laeuft) {
                if (Modes.lebendeGegner() > 0) return;
                if (t.rest > 0) {
                    // Die Welle ist gefallen - nach kurzer Luft rückt die nächste nach,
                    // bis das Stockwerk seine Gesamtzahl verloren hat.
                    t.wartet -= dt;
                    if (t.wartet <= 0) {
                        const n = turmWelle(t.etage, Math.min(t.rest, t.wellenGroesse));
                        t.rest = Math.max(0, t.rest - n);
                        if (!n) t.rest = 0;                 // Pool leer: nie in der Endlosschleife stehn
                        t.wartet = 1.2;
                        if (t.rest > 0) HUD.toast('Die nächste Welle!', '#ffb27a', 1.4);
                    }
                    return;
                }
                t.laeuft = false;
                t.wartet = 2.2;              // Luft holen, dann geht es eine Etage höher
            }
            t.wartet -= dt;
            if (t.wartet > 0) return;
            turmEtage(Game);
        },
        onPlayerDeath() {
            const z = zustand();
            const n = z && z.turm ? z.turm.etage : 0;
            return Modes.finish({
                text: n <= 1 ? 'Schon im ersten Stock war Endstation.' : 'Stockwerk ' + n + ' erreicht.',
            });
        },
        belohnung({ punkte }) { return clamp(40 + punkte * 9, 50, 490); },
        drawHud(ctx) {
            const z = zustand();
            const t = z && z.turm;
            Modes.hudStatus(ctx, [
                '🏰 Stockwerk ' + (t ? t.etage : 0) + '/' + TURM_ETAGEN,
                '👹 ' + Modes.lebendeGegner() + ' Gegner' + (t && t.rest > 0 ? ' (+' + t.rest + ')' : ''),
            ]);
        },
    });

    // ══════════════ 5: Ein Herz ══════════════
    const HERZ_ID = 'ein-herz';
    // Doppelte Belohnung: zweimal das, was ein Modus-Lauf in dieser Welt wert ist.
    function herzBelohnung(nr) { return clamp((60 + clamp(nr || 1, 1, LAST_WORLD) * 10) * 2, 50, 500); }
    WAHL_MODI[HERZ_ID] = {
        emoji: '❤️',
        frage: 'Welche Welt schaffst du mit nur einem Herz?',
        bekannteWelten: false,
        aufWelt(nr) {
            const z = zustand();
            if (!z || !z.herz || z.herz.welt) return;
            z.herz.welt = nr;
            Modes.starteWelt({ welt: nr, herzen: 1 });
        },
    };
    registerMode({
        id: HERZ_ID,
        name: 'Ein Herz',
        emoji: '❤️',
        text: 'Eine Welt mit nur einem einzigen Leben – doppelte Belohnung.',
        frei: g => weltMax(g) >= 8,
        hinweis: 'Erst Welt 7 schaffen.',
        wertung: 'zeit',                     // Rekord = schnellster Sieg mit nur einem Herzen
        start(g) {
            const z = zustand();
            z.herz = { welt: 0 };
            if (!zeigeAuswahl(HERZ_ID)) WAHL_MODI[HERZ_ID].aufWelt(weltMax(g));
        },
        onWorldClear() {
            const z = zustand();
            const nr = z && z.herz ? z.herz.welt : 1;
            return Modes.finish({
                text: 'Ein Herz, ein Sieg – das ist doppelte Belohnung wert!',
                muenzen: herzBelohnung(nr),
            });
        },
        onPlayerDeath() {
            return ohneErgebnis('Das eine Herz ist weg – der nächste Lauf klappt bestimmt.');
        },
        // Faellt der Weg über onWorldClear je weg (etwa weil der Boss-Sieg woanders endete),
        // nimmt das Geruest diese Formel - ohne sie griffe die Geruest-Formel und zahlte 25.
        belohnung() {
            const z = zustand();
            return herzBelohnung(z && z.herz ? z.herz.welt : 1);
        },
        drawHud(ctx) {
            const z = zustand();
            const nr = z && z.herz ? z.herz.welt : 0;
            Modes.hudStatus(ctx, [
                '❤️ Nur ein Herz',
                '⏱️ ' + Modes.zeitText(Modes.zeit()),
                '🏁 ' + (nr ? 'Welt ' + nr : 'Los geht es!'),
            ]);
        },
    });

    // ══════════════ 6: Schatzsuche ══════════════
    const SUCHE_ID = 'schatzsuche';
    const SUCHE_ZEIT = 120;                  // zwei Minuten
    WAHL_MODI[SUCHE_ID] = {
        emoji: '💎',
        frage: 'In welcher Welt suchst du die Truhen?',
        bekannteWelten: false,
        aufWelt(nr) {
            const z = zustand();
            if (!z || !z.suche || z.suche.welt) return;
            z.suche.welt = nr;
            Modes.starteWelt({ welt: nr, zeitlimit: SUCHE_ZEIT });
            // Eine Welt hat sechs bis elf Truhen – für eine echte Suche kommen welche dazu.
            truhenLegen(14);
            z.suche.total = Game.chests.length;
        },
    };
    registerMode({
        id: SUCHE_ID,
        name: 'Schatzsuche',
        emoji: '💎',
        text: 'Truhen finden in einer Welt, bevor die Uhr von zwei Minuten abläuft.',
        frei: g => weltMax(g) >= 3,
        hinweis: 'Erst Welt 2 schaffen.',
        wertung: 'punkte',                   // Punkte = Truhen (der Rekord)
        start(g) {
            const z = zustand();
            z.suche = { welt: 0, offen: 0, total: 0 };
            if (!zeigeAuswahl(SUCHE_ID)) WAHL_MODI[SUCHE_ID].aufWelt(weltMax(g));
        },
        update() {
            const z = zustand();
            const s = z && z.suche;
            if (!s) return;
            let offen = 0;
            for (const c of Game.chests) if (c && c.opened) offen++;
            if (offen > s.offen) {
                Modes.punkte(offen - s.offen);
                s.offen = offen;
                HUD.toast('Truhe! ' + offen + ' von ' + s.total, '#ffe38a', 1.5);
            }
            if (s.total && offen >= s.total) {
                return Modes.finish({ text: 'Alle ' + s.total + ' Truhen gefunden – Schatzmeister!' });
            }
        },
        onWorldClear() {
            return Modes.finish({ text: 'Boss besiegt – die Suche ist beendet.' });
        },
        onPlayerDeath() {
            const z = zustand();
            const n = z && z.suche ? z.suche.offen : 0;
            return Modes.finish({ text: n ? n + ' Truhen gefunden.' : 'Keine Truhe erwischt.' });
        },
        // Die Truhen der Welt werfen wie sonst auch Munzen ab - die Modus-Belohnung bleibt
        // deshalb bewusst unter der Obergrenze der anderen Modi (14 Truhen = 226).
        belohnung({ punkte }) { return clamp(30 + punkte * 14, 50, 350); },
        drawHud(ctx) {
            const z = zustand();
            const s = z && z.suche;
            Modes.hudStatus(ctx, [
                '⏱️ noch ' + Modes.zeitText(Modes.restzeit()),
                '💎 ' + (s ? s.offen : 0) + ' / ' + (s ? s.total : 0) + ' Truhen',
            ]);
        },
    });
})();
