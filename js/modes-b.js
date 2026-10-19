// ── Extra-Modi, Paket B ──
// Hier wohnen die sechs Modi dieses Pakets: Riesenmodus, Winzigmodus, Nachtmodus,
// Spiegelmodus, Freunde-Modus und Münzregen. Das Gerüst (registerMode, Rekorde, Bausteine)
// erklärt js/modes.js im Detail - dieser Datei tut nichts, außer Modi einzutragen.
// Kein Modus fasst main.js, ui.js oder eine Welt-Datei an; keine Weltbelohnung und keine
// Freischaltung wird dadurch berührt, alte Spielstände laden genau wie vorher.
//
// Allen sechs Modi gemeinsam: Emoji, Name, ein Satz für Kinder, eine sinnvolle
// Freischaltung mit Hinweis auf der Karte, ein eigener Rekord im Spielstand und eine
// maßvolle Belohnung in Münzen (50 bis 420).

const ModiB = {

    // Welt für einen Modus: höchstens die Welt, die man selbst schon erreicht hat -
    // kein Modus schickt ein Kind in eine Welt, die ihm eigentlich noch fremd ist.
    welt(g, ziel) {
        return clamp(Math.min(ziel, (g && g.maxWorldUnlocked) || 1), 1, LAST_WORLD);
    },

    // Größe der Gegner (Riesen- und Winzigmodus): Hitbox und Zeichnung wachsen zusammen,
    // denn die Gegner zeichnen sich über this.w/this.h. Die Füße bleiben auf dem Boden.
    // Bosse bleiben außen vor - ihr Raum ist fest gemauert, und ein 1,7-facher Boss passt
    // nicht hinein. Das wäre ein unfairer Kampf statt eines spaßigen Modi.
    groesse(faktor) {
        for (const e of Game.enemies) {
            if (!e || e.isBoss || e._mbGroesse === faktor) continue;
            const mitte = e.x + e.w / 2;
            const fuss = e.y + e.h;
            e._mbGroesse = faktor;
            e.w *= faktor;
            e.h *= faktor;
            e.x = mitte - e.w / 2;
            e.y = fuss - e.h;
        }
    },

    // Besiegte Gegner zählen (Punkte für Riesen-, Winzig- und Freunde-Modus). Jeder
    // besiegte Gegner zählt genau einmal, auch wenn er noch einen Moment in der Liste steht.
    tode() {
        let n = 0;
        for (const e of Game.enemies) {
            if (e && e.dead && !e._mbTot) { e._mbTot = true; n++; }
        }
        return n;
    },

    todeAlsPunkte() {
        const n = ModiB.tode();
        if (n) Modes.punkte(n);
    },

    // ══════════════ Nachtmodus: der Lichtkegel der Taschenlampe ══════════════
    // Das Gerüst malt die Dunkelheit als Vorratsbild über die Spielansicht (zeichneDunkelheit
    // in js/modes.js) und baut es nur neu, wenn Größe, Farbe und Stärke sich ändern. Ein
    // Lichtkegel zeigt aber in jede Richtung, deshalb baut diese Datei ihr eigenes Bild und
    // hält das Gerüst mit dem passenden Schlüssel ruhig. Die 24 Richtungen (15°-Schritte)
    // werden aufbewahrt, damit beim Drehen kein Bild gerechnet werden muss.
    taschen: Object.create(null),

    lichtkegel(vw, vh, farbe, staerke, winkel) {
        const stufe = Math.round(winkel / (Math.PI / 12));
        const schluessel = Math.round(vw) + 'x' + Math.round(vh) + 'x' + stufe;
        const fertig = ModiB.taschen[schluessel];
        if (fertig) return fertig;
        let n = 0;
        for (const k in ModiB.taschen) n++;
        // Nach häufigem Ändern der Fenstergröße wieder von vorn anfangen (das Bild ist winzig)
        if (n > 96) ModiB.taschen = Object.create(null);
        const cv = document.createElement('canvas');
        cv.width = 256;
        cv.height = Math.max(64, Math.round(256 * vh / Math.max(1, vw)));
        const g = cv.getContext('2d');
        const k = cv.width / (2 * vw);                       // Bildpunkte pro Ansichtspunkt
        const cx = cv.width / 2, cy = cv.height / 2;
        g.fillStyle = wcA(farbe, staerke);
        g.fillRect(0, 0, cv.width, cv.height);
        // Aus der Schwärze wird herausgeschnitten, was die Lampe zeigt
        g.globalCompositeOperation = 'destination-out';
        const naehe = Math.max(10, vw * 0.1 * k);
        const ring = g.createRadialGradient(cx, cy, 0, cx, cy, naehe);
        ring.addColorStop(0, 'rgba(0,0,0,1)');
        ring.addColorStop(0.6, 'rgba(0,0,0,0.8)');
        ring.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = ring;
        g.beginPath();
        g.arc(cx, cy, naehe, 0, TAU);
        g.fill();
        const laenge = Math.max(40, vw * 0.6 * k);
        g.save();
        g.translate(cx, cy);
        g.rotate(stufe * (Math.PI / 12));
        const kegel = g.createRadialGradient(0, 0, 0, 0, 0, laenge);
        kegel.addColorStop(0, 'rgba(0,0,0,0.95)');
        kegel.addColorStop(0.55, 'rgba(0,0,0,0.72)');
        kegel.addColorStop(1, 'rgba(0,0,0,0)');
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, laenge, -0.36, 0.36);
        g.closePath();
        g.fillStyle = kegel;
        g.fill();
        g.restore();
        ModiB.taschen[schluessel] = cv;
        return cv;
    },

    // Wohin die Lampe leuchtet: wohin Mark zielt, sonst wohin er läuft.
    zeichneLampe() {
        const run = Modes.run, g = Game, p = g.player;
        if (!run || !p) return;
        let winkel = p.facingAngle || 0;
        const dr = Input.direction;
        if (!Input.aiming && dr && (dr.x || dr.y)) winkel = Math.atan2(dr.y, dr.x);
        if (!Number.isFinite(winkel)) winkel = 0;
        run._licht = ModiB.lichtkegel(g.viewW, g.viewH, run.dunkelFarbe, run.dunkel, winkel);
        run._lichtSchluessel = Math.round(g.viewW) + 'x' + Math.round(g.viewH) + run.dunkelFarbe + run.dunkel;
    },

    // ══════════════ Freunde-Modus: Mark spielt als einer der Freunde ══════════════
    // Aussehen und Grundangriff kommen von der echten Figur: eine eigene Instanz der Figur
    // steht genau auf Marks Platz, lässt sich nicht verletzen (die Herzen trägt Mark) und
    // schlägt bzw. spuckt nach ihrer eigenen Datei. Marks eigener Schläger tritt zurück.
    freunde: [
        {
            id: 'juri', name: 'Juri', emoji: '🔨', abWelt: 7,
            klasse: () => (typeof Juri === 'function' ? Juri : null),
            text: 'haut mit dem Hammer auf alles ein, was ihm zu nahe kommt',
            hinweis: 'Erst Welt 7 schaffen - dort ist Juri deine Belohnung.'
        },
        {
            id: 'croc', name: 'Schatten-Krokodil', emoji: '🐊', abWelt: 8,
            klasse: () => (typeof ShadowCrocodile === 'function' ? ShadowCrocodile : null),
            text: 'spuckt auf jeden Gegner, der ihm nahe kommt',
            hinweis: 'Erst Welt 8 schaffen - dort ist das Krokodil deine Belohnung.'
        },
        {
            id: 'panda', name: 'Kleiner Panda', emoji: '🐼', abWelt: 47,
            klasse: () => (typeof PandaBuddy === 'function' ? PandaBuddy : null),
            text: 'rollt mit und spuckt giftige Bambus-Pflanzen',
            hinweis: 'Erst Welt 47 schaffen - dort zieht der Panda bei dir ein.'
        }
    ],

    freund(id) {
        for (const f of ModiB.freunde) if (f.id === id) return f;
        return null;
    },

    // Erste Figur, die das Kind schon hat - Notfall, wenn die Auswahlkarte nicht gezeigt
    // werden kann (z. B. in einer Testumgebung ohne Bildschirm).
    ersterFreund(g) {
        for (const f of ModiB.freunde) {
            if ((g.maxWorldUnlocked || 1) >= f.abWelt && typeof f.klasse() === 'function') return f;
        }
        return null;
    },

    // Die Auswahlkarte vor dem Start (Bildschirm und Knöpfe sind unten in dieser Datei angemeldet)
    zeigeAuswahl() {
        const el = UI.screens && UI.screens.modibfreunde;
        if (!el) return false;
        const g = Game;
        const x = (t) => Modes.sicher(t);
        const farben = ['#ff9f4d', '#7b4dff', '#69d26a'];
        const karten = ModiB.freunde.map((f, i) => {
            const frei = ((g.maxWorldUnlocked || 1) >= f.abWelt) && typeof f.klasse() === 'function';
            return `<div class="card" style="--a:${farben[i % farben.length]}">
                <div class="head"><span class="ico">${x(f.emoji)}</span>
                <div><h3>${x(f.name)}</h3><p>${x(frei ? f.text : f.hinweis)}</p></div></div>
                <div class="foot"><button class="btn small${frei ? ' green' : ''}" data-act="modibfreund"
                data-freund="${x(f.id)}"${frei ? '' : ' disabled'}>${frei ? 'Ich spiele!' : '🔒'}</button></div></div>`;
        }).join('');
        el.innerHTML = `<div class="dialog" style="max-height:88vh;overflow:auto">
            <h2>🐾 Wer spielt?</h2>
            <div class="sub">Such dir einen Freund aus - du spielst mit seinem Aussehen und seinem Angriff.</div>
            <div class="cards">${karten}</div>
            <div class="row"><button class="btn gray" data-act="modibzurueck">◀ Zurück</button></div></div>`;
        UI.show('modibfreunde');
        return true;
    },

    // Der Freund zieht Mark an: eine eigene Instanz, die ihn verdeckt und für ihn kämpft.
    kleideEin(p, Figur) {
        const look = new Figur(p.x, p.y);
        look.takeDamage = () => { };          // die Herzen trägt Mark - der Freund bleibt wach
        look.stunTimer = 0;
        look.koTimer = 0;
        p._mbFreund = look;
        p.draw = function (ctx, camera) {
            const f = p._mbFreund;
            if (!f) return;
            f.x = p.x + (p.w - f.w) / 2;
            f.y = p.y + p.h - f.h;            // die Füße bleiben auf Marks Boden
            const blinkt = p.iFrames > 0 && Math.floor(p.iFrames * 12) % 2 === 1;
            if (!blinkt) {
                f.draw(ctx, camera);
                return;
            }
            ctx.save();
            ctx.globalAlpha = 0.45;
            f.draw(ctx, camera);
            ctx.restore();
        };
        return look;
    },

    // Marks eigener Schläger und eigener Wurf treten zurück: es kämpft die gewählte Figur.
    stelleUm(p) {
        for (const w of [p.meleeWeapon, p.rangedWeapon]) {
            if (!w) continue;
            w.damage = 0;
            w.range = 0;
            w.knockback = 0;
            w.cooldownTimer = 9e5;            // canAttack() sagt damit für diese Runde nein
        }
        if (p.meleeWeapon) p.activeWeapon = p.meleeWeapon;
    },

    freundTakt(dt) {
        const p = Game.player;
        const f = p && p._mbFreund;
        if (!f || p.dead) return;
        f.x = p.x + (p.w - f.w) / 2;
        f.y = p.y + p.h - f.h;
        const dr = Input.direction;
        f.moving = !!(dr && (dr.x || dr.y));
        f.walkT = f.moving ? (f.walkT || 0) + dt : 0;
        f.faceX = Math.cos(p.facingAngle || 0) < 0 ? -1 : 1;
        f.update(dt, Game.world, p, Game.enemies);
    },

    // Die Runde mit der gewählten Figur: eine Halle, Gegnerwellen, kein eigener Schläger.
    freundeRunde(f, Figur) {
        const g = Game;
        ModibRunde.freund = f.id;
        Modes.arena({ welt: ModiB.welt(g, 4), herzen: 5, breite: 42, hoehe: 24 });
        const p = g.player;
        if (!p) return false;
        g.companions.length = 0;              // die echten Freunde bleiben in der Kiste: einer reicht
        ModiB.kleideEin(p, Figur);
        ModiB.stelleUm(p);
        Modes.dauerwellen({
            gegner: [Ghost, Slime, RoboChick].filter(k => typeof k === 'function'),
            pro: 4, interval: 4.5, erster: 1.6, maxLeben: 18,
        });
        HUD.toast(f.emoji + ' ' + f.name + ' spielt mit dir!', '#ffe38a', 2.6);
        return true;
    },

    // ══════════════ Münzregen: fallende Münzen ══════════════
    regen(dt) {
        const g = Game, run = Modes.run;
        if (!run || !run.arena || !g.world || run.ende) return;
        run._mbFall = (run._mbFall || 0) + dt;
        while (run._mbFall >= 0.13) {
            run._mbFall -= 0.13;
            ModiB.wirfMuenze(run);
        }
        for (const c of g.coinDrops) {
            if (!c || !c._mbRegen || c.collected) continue;
            c.vy = Math.min(240, (c.vy || 0) + 760 * dt);   // fällt nach und nach schneller
        }
    },

    wirfMuenze(run) {
        const g = Game;
        if (g.coinDrops.length > 110) return;
        const a = run.arena;
        const c = new CoinDrop(randRange(a.x + 12, a.x + a.w - 12), a.y + randRange(4, 18),
            Math.random() < 0.1 ? 3 : 1);
        c._mbRegen = true;
        c.age = 0;
        c.vx = randRange(-24, 24);
        c.vy = randRange(40, 90);
        // main.js räumt eingesammelte Münzen schon im selben Takt weg, diese Datei zählt
        // deshalb beim Einsammeln mit: die Münze meldet ihren eigenen Treffer.
        const urspruenglich = CoinDrop.prototype.update;
        c.update = function (dt, player) {
            const gesammelt = urspruenglich.call(this, dt, player);
            if (gesammelt && !this._mbNotiert) {
                this._mbNotiert = true;
                Modes.punkte(this.value || 1);
            }
            return gesammelt;
        };
        g.coinDrops.push(c);
    },

    // ══════════════ Spiegelmodus: die Steuerung dreht mit ══════════════
    // Die Kacheln spiegelt das Gerüst (starteWelt({ spiegel: true })). Damit die Welt sich
    // wirklich wie im Spiegel anfühlt, dreht die Eingabe horizontal mit: wer rechts tippt,
    // läuft links - und das Zielen genauso. Das Auto-Zielen auf dem Touchscreen bleibt
    // ungespiegelt, sonst würde es am Gegner vorbeizeigen und der Modus wäre nicht spielbar.
    spiegelLaeuft() {
        const run = Modes.run;
        return !!(run && run.mode.id === 'spiegel' && Game.state === 'PLAYING');
    },

    spiegelEingabe() {
        if (typeof Input === 'undefined' || Input._mbSpiegel || typeof Input.update !== 'function') return;
        const vorher = Input.update;
        Input.update = function (dt, pos) {
            vorher.call(this, dt, pos);
            if (!ModiB.spiegelLaeuft()) return;
            this.direction.x = -this.direction.x;
            this.aimDirection.x = -this.aimDirection.x;
            this.aimAngle = Math.PI - this.aimAngle;
        };
        Input._mbSpiegel = true;
    },
};

ModiB.spiegelEingabe();

// Welche Figur im Freunde-Modus gerade gespielt wird ('' = noch nie gewählt)
const ModibRunde = { freund: '' };

// ══════════════ 1. Riesenmodus ══════════════
registerMode({
    id: 'riese',
    name: 'Riesenmodus',
    emoji: '🦖',
    text: 'Mark ist riesig und haut doppelt so fest - die Gegner sind winzig klein.',
    frei: g => (g.maxWorldUnlocked || 1) >= 4,
    hinweis: 'Erst Welt 4 schaffen.',
    wertung: 'punkte',
    start(g) {
        Modes.starteWelt({ welt: ModiB.welt(g, 6), herzen: 6, groesse: 1.9 });
        const p = g.player;
        if (p.meleeWeapon) {
            p.meleeWeapon.damage *= 2;
            p.meleeWeapon.range += 14;
        }
        if (p.rangedWeapon) p.rangedWeapon.damage *= 2;
        ModiB.groesse(0.42);
    },
    update() {
        ModiB.groesse(0.42);
        ModiB.todeAlsPunkte();
    },
    onPlayerDeath() {
        ModiB.todeAlsPunkte();   // der letzte Treffer zahlte sonst nicht mehr mit
        Modes.finish({ text: 'Die kleinen Gegner waren zu flink für den großen Mark.' });
        return true;
    },
    onWorldClear() {
        ModiB.todeAlsPunkte();   // der letzte Treffer zahlte sonst nicht mehr mit
        return Modes.finish({ text: 'Der Boss war gar nicht so groß - Mark schon.' });
    },
    belohnung({ punkte }) {
        return clamp(60 + punkte * 2, 50, 300);
    },
});

// ══════════════ 2. Winzigmodus ══════════════
registerMode({
    id: 'winzig',
    name: 'Winzigmodus',
    emoji: '🐜',
    text: 'Mark ist zwergenhaft klein und die Gegner sind riesengroß.',
    frei: g => (g.maxWorldUnlocked || 1) >= 6,
    hinweis: 'Erst Welt 6 schaffen.',
    wertung: 'punkte',
    start(g) {
        Modes.starteWelt({ welt: ModiB.welt(g, 7), herzen: 3, groesse: 0.55 });
        ModiB.groesse(1.7);
    },
    update() {
        ModiB.groesse(1.7);
        ModiB.todeAlsPunkte();
    },
    onPlayerDeath() {
        ModiB.todeAlsPunkte();   // der letzte Treffer zahlte sonst nicht mehr mit
        Modes.finish({ text: 'Zwischen den großen Gegnern war kein Durchkommen.' });
        return true;
    },
    onWorldClear() {
        ModiB.todeAlsPunkte();   // der letzte Treffer zahlte sonst nicht mehr mit
        return Modes.finish({ text: 'Klein, aber oho: der Boss ist besiegt.' });
    },
    belohnung({ punkte }) {
        return clamp(90 + punkte * 2, 50, 350);
    },
});

// ══════════════ 3. Nachtmodus ══════════════
registerMode({
    id: 'nacht',
    name: 'Nachtmodus',
    emoji: '🔦',
    text: 'Alles ist stockdunkel - nur Marks Taschenlampe leuchtet in Blickrichtung.',
    frei: g => (g.maxWorldUnlocked || 1) >= 8,
    hinweis: 'Erst Welt 8 schaffen.',
    wertung: 'zeit',
    start(g) {
        Modes.starteWelt({ welt: ModiB.welt(g, 9), herzen: 5, dunkelheit: 0.97, dunkelFarbe: '#04020c' });
        ModiB.zeichneLampe();
    },
    update() {
        ModiB.zeichneLampe();
    },
    // Wer im Dunkeln stirbt, bekommt keine Bestzeit: es kommt die normale Endseite ohne Rekord.
    onPlayerDeath() { return false; },
    onWorldClear() {
        return Modes.finish({ text: 'Im Dunkeln durch - und der Boss liegt in Scherben.' });
    },
    belohnung({ zeit }) {
        return clamp(420 - Math.round(zeit * 1.6), 60, 420);
    },
});

// ══════════════ 4. Spiegelmodus ══════════════
registerMode({
    id: 'spiegel',
    name: 'Spiegelmodus',
    emoji: '🪞',
    text: 'Die ganze Welt ist seitenverkehrt - auch deine Finger drehen mit.',
    frei: g => (g.maxWorldUnlocked || 1) >= 10,
    hinweis: 'Erst Welt 10 schaffen.',
    wertung: 'zeit',
    start(g) {
        Modes.starteWelt({ welt: ModiB.welt(g, 5), herzen: 5, spiegel: true });
    },
    // Wie im Nachtmodus: die Zeit zählt nur, wenn Mark wirklich durchkommt.
    onPlayerDeath() { return false; },
    onWorldClear() {
        return Modes.finish({ text: 'Alles war anders herum - und du trotzdem ans Ziel.' });
    },
    belohnung({ zeit }) {
        return clamp(420 - Math.round(zeit * 1.6), 60, 420);
    },
    drawHud(ctx) {
        Modes.hudStatus(ctx, ['🪞 ' + Modes.zeitText(Modes.zeit())]);
    },
});

// ══════════════ 5. Freunde-Modus ══════════════
registerMode({
    id: 'freunde',
    name: 'Freunde-Modus',
    emoji: '🐾',
    text: 'Spiele als Juri, Schatten-Krokodil oder Panda - mit ihrem Aussehen und Angriff.',
    frei: g => (g.maxWorldUnlocked || 1) >= 7,
    hinweis: 'Erst Welt 7 schaffen - dann kannst du als Freund spielen.',
    wertung: 'punkte',
    // Vor dem Start kommt die Auswahl. „Nochmal“ und der Neustart aus der Pause nehmen
    // die zuletzt gewählte Figur - Kinder wollen nicht jedes Mal neu suchen.
    start(g) {
        const zuletzt = ModibRunde.freund ? ModiB.freund(ModibRunde.freund) : null;
        const Figur = zuletzt ? zuletzt.klasse() : null;
        if (Figur && g.state !== 'EXTRA_MENU') {
            ModiB.freundeRunde(zuletzt, Figur);
            return;
        }
        if (ModiB.zeigeAuswahl()) return;
        // Ohne Bildschirm (Testumgebung) nimmt der Modus die erste Figur, die das Kind hat.
        const ersatz = ModiB.ersterFreund(g);
        if (ersatz) ModiB.freundeRunde(ersatz, ersatz.klasse());
    },
    update(dt) {
        ModiB.freundTakt(dt);
        ModiB.todeAlsPunkte();
    },
    onPlayerDeath() {
        ModiB.todeAlsPunkte();   // der letzte Treffer zahlte sonst nicht mehr mit
        const f = ModiB.freund(ModibRunde.freund);
        Modes.finish({ text: (f ? f.name : 'Der Freund') + ' hat tapfer gekämpft.' });
        return true;
    },
    belohnung({ punkte }) {
        return clamp(50 + punkte * 2, 50, 400);
    },
});

// ══════════════ 6. Münzregen ══════════════
registerMode({
    id: 'muenzregen',
    name: 'Münzregen',
    emoji: '🌧️',
    text: '60 Sekunden lang regnet es Münzen - sammle so viele du kannst.',
    frei: () => true,
    hinweis: 'Immer offen.',
    wertung: 'punkte',
    start(g) {
        Modes.arena({ welt: ModiB.welt(g, 3), herzen: 5, breite: 30, hoehe: 17, zeitlimit: 60 });
    },
    update(dt) {
        ModiB.regen(dt);
    },
    onPlayerDeath() {
        Modes.finish({ text: 'Kein Schaden genommen - weiter gesammelt!' });
        return true;
    },
    belohnung({ punkte }) {
        return clamp(50 + Math.round(punkte / 2), 50, 260);
    },
    drawHud(ctx) {
        const run = Modes.run;
        Modes.hudStatus(ctx, ['🪙 ' + (run ? run.punkte : 0), '⏱ ' + Modes.zeitText(Modes.restzeit())]);
    },
});

// ── Anmeldung von Auswahlkarte und Knöpfen (Oberfläche meldet sich selbst an, js/ui.js) ──
UI.register({
    screens: { modibfreunde: 'overlay' },
    onClick(act, btn) {
        if (act === 'modibfreund') {
            const f = ModiB.freund(btn.dataset.freund);
            const Figur = f ? f.klasse() : null;
            if (!Figur) return true;
            UI.show(null);
            ModiB.freundeRunde(f, Figur);
            return true;
        }
        if (act === 'modibzurueck') {
            Game.clearMode();
            UI.show('extra');
            return true;
        }
        return false;
    },
});
