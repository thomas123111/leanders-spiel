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

    // Gegner in sechs Stufen (wie worldInfo die Welten): spaete Stufen sind die kraeftigeren
    // Figuren aus den hinteren Welten. Fehlt eine Klasse, faellt die Stufe auf Geister zurueck.
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

    // Bosse in der Reihenfolge der Welten - dieselbe Zuordnung wie _spawnBoss in js/main.js.
    // Laesst sich die Klasse nicht laden (andere Paket-Reihenfolge), bleibt Geist uebrig.
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

    function bossName(weltNr) {
        const info = worldInfo(clamp(weltNr, 1, LAST_WORLD));
        return (info && info.boss) || 'ein Boss';
    }

    // ── die Welt-Auswahl fuer Modi, die eine Welt brauchen ──
    // Eigener Bildschirm (von ui.js nicht angefasst), aufgerufen aus Modes.start: der Modus ist
    // dann angelegt, aber die Welt laeuft noch nicht - die Uhr eines Rennens beginnt erst mit ihr.
    const WAHL_SCHIRM = 'modiawahl';
    const WAHL_MODI = Object.create(null);
    let wahlOffen = '';

    function bestzeitKey(id, weltNr) { return id + '@' + weltNr; }
    function Bestzeit(id, weltNr) { return Modes.rekord(bestzeitKey(id, weltNr)); }
    function merkeBestzeit(id, weltNr, zeit) {
        const alt = Bestzeit(id, weltNr);
        if (alt !== null && alt <= zeit) return false;
        Game.modeRecords = Game.modeRecords || {};
        Game.modeRecords[bestzeitKey(id, weltNr)] = Math.round(zeit * 10) / 10;
        return true;
    }

    function zeigeAuswahl(id) {
        const el = UI.screens && UI.screens[WAHL_SCHIRM];
        const eintrag = WAHL_MODI[id];
        if (!el || !eintrag) return false;
        wahlOffen = id;
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
        UI.show(WAHL_SCHIRM);
        return true;
    }

    UI.register({
        screens: { [WAHL_SCHIRM]: 'page' },
        onClick(act, btn) {
            if (act === 'modiawahl') {
                const eintrag = WAHL_MODI[wahlOffen];
                const nr = +btn.dataset.n;
                if (!eintrag || !(nr >= 1)) return true;
                const id = wahlOffen;
                wahlOffen = '';
                eintrag.aufWelt(clamp(nr, 1, LAST_WORLD));
                return true;
            }
            if (act === 'modiawahlzurueck') {
                wahlOffen = '';
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
            z.marathon = { besiegt: 0, anzahl: 0 };
            Modes.arena({ welt: halleWelt(g), herzen: 5, breite: 42, hoehe: 24 });
            const reihe = bossBis(weltBekannt(g));
            z.marathon.anzahl = reihe.length;
            Modes.bossReihe(reihe);
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
            return Modes.finish({ text: n ? n + ' Boss' + (n === 1 ? '' : 'e') + ' geschafft. Beim naechsten Mal mehr!'
                : 'Der erste Boss war zu stark. Staerker werfen!' });
        },
        belohnung({ punkte }) { return clamp(50 + Math.round(punkte / 100) * 45, 50, 500); },
        drawHud(ctx) { Modes.hudStatus(ctx); },
    });

    // ══════════════ 2: Ueberleben ══════════════
    registerMode({
        id: 'ueberleben',
        name: 'Ueberleben',
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
        t.etage++;
        t.laeuft = true;
        Modes.punkte(1);                                    // Punkte = Stockwerk (der Rekord)
        Modes.arena({
            welt: halleWelt(g, t.etage), herzen: 5,
            breite: 30 + (t.etage % 5) * 3, hoehe: 20 + (t.etage % 4) * 2,
        });
        welleScharf({
            gegner: gegnerFuer(t.etage),
            anzahl: Math.min(18, 3 + Math.round(t.etage * 0.5)),
            abstand: 230,
        }, t.etage);
        HUD.toast('Stockwerk ' + t.etage + ' von ' + TURM_ETAGEN, '#ffe38a', 1.8);
        return true;
    }

    registerMode({
        id: 'turm',
        name: 'Der Turm',
        emoji: '🏰',
        text: '50 Stockwerke, jedes voller Gegner und etwas schwerer.',
        frei: g => weltMax(g) >= 7,
        hinweis: 'Erst Welt 6 schaffen.',
        wertung: 'punkte',                   // Punkte = höchstes Stockwerk
        start(g) {
            const z = zustand();
            z.turm = { etage: 0, laeuft: false, wartet: 0 };
            turmEtage(g);
        },
        update(dt) {
            const z = zustand();
            const t = z && z.turm;
            if (!t) return;
            if (t.laeuft) {
                if (Modes.lebendeGegner() > 0) return;
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
            Modes.hudStatus(ctx, [
                '🏰 Stockwerk ' + (z && z.turm ? z.turm.etage : 0) + '/' + TURM_ETAGEN,
                '👹 ' + Modes.lebendeGegner() + ' Gegner',
            ]);
        },
    });

    // ══════════════ 5: Ein Herz ══════════════
    const HERZ_ID = 'ein-herz';
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
            // Doppelte Belohnung: zweimal das, was ein Modus-Lauf in dieser Welt wert ist.
            return Modes.finish({
                text: 'Ein Herz, ein Sieg – das ist doppelte Belohnung wert!',
                muenzen: clamp((60 + nr * 10) * 2, 50, 500),
            });
        },
        onPlayerDeath() {
            return ohneErgebnis('Das eine Herz ist weg – der nächste Lauf klappt bestimmt.');
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
            let gelegt = 0;
            while (Game.chests.length < 14 && gelegt < 12 && typeof Game._spawnChestAt === 'function') {
                Game.chests.push(Game._spawnChestAt());
                gelegt++;
            }
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
        belohnung({ punkte }) { return clamp(40 + punkte * 22, 50, 500); },
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
