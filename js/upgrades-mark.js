// ── Upgrades für MARK (Datei des Mark-Auftrags) ──
// Hier trägt der Mark-Auftrag seine neuen Upgrades ein - nur in dieser Datei,
// der Figuren-Code (js/player.js, js/weapons.js) wird nicht angefasst.
//
// So kommt ein neues Upgrade hinein (genau ein registerUpgrade-Aufruf pro Extra):
//
//   registerUpgrade({
//       id: 'meinUpgrade',            // eindeutig, englisch, kein bestehender Id-Dieb
//       figur: 'mark',                // fest: 'mark'
//       name: 'Mein Extra',           // erscheint im Menü „Waffen" und im Shop
//       text: 'Was das Extra tut.',   // ein Satz für die Karte
//       emoji: '⚡',
//       where: 'Welt 12 schaffen',    // Hinweis auf der gesperrten Karte
//       istFrei: g => g.maxWorldUnlocked >= 13,   // oder: g.unlockedMeinUpgrade
//       apply(c) {                    // c = { game, welt, player, juri, croc, panda }
//           // einmal beim Weltstart, NUR wenn dieses Extra gewählt wurde.
//           // Hier die Haken anmelden - sie wirken dann die ganze Runde:
//           c.player.hooks.onUpdate.push(dt => { /* jeder Bild-Takt */ });
//           c.player.hooks.onMeleeHit.push((gegner, schaden) => { /* Nahkampf-Treffer */ });
//           c.player.hooks.onProjectileHit.push((gegner, geschoss) => { /* Ball-Treffer */ });
//           c.player.hooks.onThrow.push(geschoss => { /* gerade geworfen */ });
//           c.player.hooks.onDodge.push(() => { /* Ausweichen */ });
//           c.player.hooks.onDamaged.push(menge => menge * 0.5); // Menge ändern (Zahl zurückgeben)
//           c.player.hooks.onKill.push(gegner => { /* Gegner besiegt */ });
//           c.player.hooks.onDraw.push(ctx => { /* über Mark malen (Bildschirmmaße) */ });
//           // Runden-Haken (ganze Welt): game.roundHooks.onUpdate / onEnemyKilled / onDrawWorld
//       },
//   });
//
// Gemeinsame Helfer (stehen in js/upgrades.js, einfach aufrufen):
//   areaDamage(x, y, radius, schaden, except)       Flächenschaden um einen Punkt
//   knockBack(gegner, winkel, kraft)                Gegner wegschubsen
//   slowEnemy(gegner, sekunden, faktor)             Gegner zeitweise verlangsamen
//   spawnHelper(objektOderKlasse, x, y, sekunden)   zeitweiliger Begleiter
//   companionShoot(figur, winkel, tempo, schaden)   Schuss eines Begleiters (löst onShoot aus)
//     Achtung: companionShoot loest den onShoot-Haken derselben Figur aus. Ein onShoot-Haken,
//     der selbst companionShoot benutzt, loest sich damit immer wieder selbst - deshalb immer
//     erst pruefen (if (this._schon) return; this._schon = true; ... this._schon = false;),
//     sonst kappt das Geruest die Kette nach acht Runden (Meldung in der Konsole).
//
// Regeln: kein neuer Welt-Datei-Griff, keine APP_VERSION, kein ?v=. Pro Runde gilt
// genau EIN Extra - die Auswahl und das Kaufen im Shop übernimmt js/upgrades.js von selbst.

// ══════════════════════════════════════════════════════════════════════════
// ── Paket 1 (18.10.2026): zwölf Extra aus Leanders Liste ──
// Alle Wirkungen hängen an den Haken aus js/upgrades.js. Der kleine Werkzeugkasten
// unten (Zeichenhelfer, Suchhelfer) gehört zu dieser Datei und wird nicht angemeldet.
// Alle zwölf sind Shop-Artikel: `istFrei: () => false` hält die Karte gesperrt, bis
// der Kauf-Merker aus js/upgrades.js sie setzt (Preis: 850 Juwelen, Marks Figur).
// ══════════════════════════════════════════════════════════════════════════

const MarkExtras = (() => {

    // Flackernde Flamme. (x, y) = Fußpunkt in Bildschirmmaßen, s = Größe, t = eigene Phase
    function flamme(ctx, x, y, s, t) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(s, s * (1 + Math.sin(t * 13) * 0.15));
        Art.glow(ctx, 0, -3, 12, '#ff8a1f', 0.5);
        Art.shape(ctx, c => {
            c.moveTo(0, -8.6);
            c.quadraticCurveTo(4.2, -3.2, 2.4, 1.4);
            c.quadraticCurveTo(1.2, 4.2, 0, 4.4);
            c.quadraticCurveTo(-1.4, 4.2, -2.6, 1.4);
            c.quadraticCurveTo(-4.2, -3.2, 0, -8.6);
        }, { x: -4.2, y: -8.6, w: 8.4, h: 13 }, '#ff8a1f', { outline: '#e2481f' });
        Art.shape(ctx, c => {
            c.moveTo(0, -4.6);
            c.quadraticCurveTo(2.1, -1.4, 1.1, 1.6);
            c.quadraticCurveTo(0.5, 3.4, 0, 3.5);
            c.quadraticCurveTo(-0.6, 3.4, -1.2, 1.6);
            c.quadraticCurveTo(-2.1, -1.4, 0, -4.6);
        }, { x: -2.1, y: -4.6, w: 4.2, h: 8.1 }, '#ffe066', { outline: false });
        ctx.restore();
    }

    // Blitzstrahl zwischen zwei Bildschirmpositionen: gezackte Linie mit weißem Kern
    function blitz(ctx, ax, ay, bx, by, t, farbe) {
        const dx = bx - ax, dy = by - ay;
        const laenge = Math.hypot(dx, dy) || 1;
        const nx = -dy / laenge, ny = dx / laenge;   // senkrecht auf dem Strahl
        const pkt = [];
        for (let i = 1; i < 5; i++) {
            const anteil = i / 5;
            const aus = ((i % 2) ? 1 : -1) * 4.5 * (0.6 + 0.4 * Math.sin(t * 34 + i * 2));
            pkt.push({ x: ax + dx * anteil + nx * aus, y: ay + dy * anteil + ny * aus });
        }
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let k = 0; k < 2; k++) {
            ctx.strokeStyle = k ? '#ffffff' : (farbe || '#8fe8ff');
            ctx.lineWidth = k ? 1.3 : 3.4;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            for (const q of pkt) ctx.lineTo(q.x, q.y);
            ctx.lineTo(bx, by);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Wirbel aus drei Bögen (für Dreh- und Sog-Wirkungen), Bildschirmmaße
    function wirbel(ctx, x, y, r, t, farbe, dicke) {
        ctx.save();
        ctx.strokeStyle = farbe || 'rgba(255,210,63,0.9)';
        ctx.lineWidth = dicke || 2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const a = t * 9 + i * TAU / 3;
            ctx.beginPath();
            ctx.arc(x, y, Math.max(2, r), a, a + 1.15);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Ist das ein Ball von Marks Werfer? Krokodil-Spucke, Schlangen-Gift und die Panda-Pflanze
    // liegen in derselben Geschoss-Liste und sind nicht Marks Bälle.
    function marksBall(p) {
        return !!p && p.owner === 'player' && !p.dead && !p.crocSpit && !p.venom && !p.pandaPlant;
    }

    // Sammlt jeden Ball, den Marks Werfer neu in die Liste gelegt hat, genau einmal ein.
    // Nötig, weil der Werfer immer ein Zerleger-Wurf ist: die drei eigentlichen Bälle
    // entstehen später in Projectile.update (js/weapons.js) und laufen nicht durch onThrow.
    function frischeBaelle(marke) {
        const neu = [];
        if (!Game.projectiles) return neu;
        for (const p of Game.projectiles) {
            if (!marksBall(p) || p[marke]) continue;
            p[marke] = true;
            neu.push(p);
        }
        return neu;
    }

    // Die `anzahl` nächsten lebenden Gegner um (x, y) innerhalb von `reichweite`; `ausser` fällt weg
    function naechsteGegner(x, y, reichweite, ausser, anzahl) {
        const fund = [];
        if (!Game.enemies) return fund;
        for (const e of Game.enemies) {
            if (!e || e.dead || e === ausser) continue;
            const d = Math.hypot(e.centerX() - x, e.centerY() - y);
            if (d <= reichweite) fund.push({ e, d });
        }
        fund.sort((a, b) => a.d - b.d);
        return fund.slice(0, anzahl).map(o => o.e);
    }

    // Winkel von einem Punkt zu einem Gegner
    function winkelVon(x, y, e) {
        return Math.atan2(e.centerY() - y, e.centerX() - x);
    }

    // Kleiner Winkelunterschied zwischen zwei Richtungen (—PI bis PI)
    function winkelAbstand(a, b) {
        let d = a - b;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        return d;
    }

    // Liegt eine Bildschirmposition in der Ansicht? (zeichnet nur, was zu sehen ist)
    function sichtbar(s) {
        return s.x > -40 && s.y > -40 && s.x < Game.viewW + 40 && s.y < Game.viewH + 40;
    }

    // Ist Marks aktive Waffe der Schläger? (Sonst zählt kein Nahkampf-Haken)
    function schlaeger(p) {
        const w = p && p.activeWeapon;
        return w && w.type === 'melee' ? w : null;
    }

    return { flamme, blitz, wirbel, marksBall, frischeBaelle, naechsteGegner, winkelVon, winkelAbstand, sichtbar, schlaeger };
})();

// ── mark01 Feuerball: Würfe setzen Gegner kurz in Brand ──
(() => {
    const BRAND_ZEIT = 2.5;    // Sekunden brennt ein Getroffener
    const BRAND_TICK = 0.3;    // alle drei Zehntelsekunden zieht das Feuer Leben ab
    const BRAND_MENGE = 0.6;   // Leben pro Tick (macht 2 Leben je Sekunde)

    function entzuenden(e) {
        if (!e || e.dead) return;
        const b = e._markBrand || (e._markBrand = { rest: 0, tick: 0 });
        b.rest = Math.max(b.rest, BRAND_ZEIT);
        b.tick = Math.min(b.tick, 0.1);
        FX.burst(e.centerX(), e.centerY(), ['#ff8a1f', '#ffd23f', '#fff3b0'], 7, 85, 0.35, { kind: 'spark' });
    }

    registerUpgrade({
        id: 'mark01', figur: 'mark', name: 'Feuerball', emoji: '🔥',
        text: 'Marks Bälle stecken Gegner in Brand: die laufen kurz lichterloh und verlieren dabei Leben.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            c.game.roundHooks.onUpdate.push(dt => {
                MarkExtras.frischeBaelle('_feuerBall');   // jeder Ball ist ab jetzt ein Feuerball
                for (const e of Game.enemies) {
                    const b = e._markBrand;
                    if (!b) continue;
                    if (e.dead) { e._markBrand = null; continue; }
                    b.rest -= dt;
                    b.tick -= dt;
                    if (b.tick <= 0) {
                        b.tick = BRAND_TICK;
                        e.takeDamage(BRAND_MENGE);
                    }
                    if (b.rest <= 0) e._markBrand = null;
                    else if (Math.random() < 0.22) {
                        FX.burst(e.centerX(), e.y, ['#ff8a1f', '#ffd23f'], 1, 24, 0.45, { kind: 'smoke', size: 3 });
                    }
                }
            });
            c.player.hooks.onProjectileHit.push((e, p) => { if (MarkExtras.marksBall(p)) entzuenden(e); });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const p of Game.projectiles) {
                    if (!p._feuerBall || !MarkExtras.marksBall(p)) continue;
                    const s = camera.worldToScreen(p.x, p.y - 2);
                    if (MarkExtras.sichtbar(s)) MarkExtras.flamme(ctx, s.x, s.y, 0.85, Art.time + p.age * 3);
                }
                for (const e of Game.enemies) {
                    if (!e._markBrand || e.dead) continue;
                    const s = camera.worldToScreen(e.centerX(), e.y + 2);
                    if (!MarkExtras.sichtbar(s)) continue;
                    MarkExtras.flamme(ctx, s.x, s.y, Math.min(1.5, 0.72 + e.w / 60), Art.time + e.centerX() * 0.01);
                }
            });
        },
    });
})();

// ── mark03 Blitzball: ein Treffer springt auf drei Gegner daneben über ──
(() => {
    const SPRUNG_REICHWEITE = 165;   // px Umkreis, in dem die Blitze überspringen
    const SPRUNG_ZIELE = 3;
    const SPRUNG_SCHADEN = 2;
    const SPRUNG_PAUSE = 1.1;        // Abklingzeit: sonst löst jeder der drei Bälle eine Kette aus

    registerUpgrade({
        id: 'mark03', figur: 'mark', name: 'Blitzball', emoji: '🌩',
        text: 'Trifft ein Ball, springt der Blitz auf drei Gegner daneben über.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let pause = 0;
            const bolze = [];
            c.player.hooks.onProjectileHit.push((e, p) => {
                if (pause > 0 || p._blitzKette) return;
                p._blitzKette = true;
                pause = SPRUNG_PAUSE;
                const zx = e.centerX(), zy = e.centerY();
                const ziele = MarkExtras.naechsteGegner(zx, zy, SPRUNG_REICHWEITE, e, SPRUNG_ZIELE);
                for (const z of ziele) {
                    z.takeDamage(SPRUNG_SCHADEN, MarkExtras.winkelVon(zx, zy, z), 70);
                    bolze.push({ ax: zx, ay: zy, bx: z.centerX(), by: z.centerY(), rest: 0.2 });
                    FX.burst(z.centerX(), z.centerY(), ['#8fe8ff', '#ffffff', '#ffe066'], 6, 100, 0.3, { kind: 'spark' });
                }
                if (!ziele.length) { pause = 0.25; return; }
                FX.ring(zx, zy, '#8fe8ff', 26, 0.25, 3);
                Sound.hit();
            });
            c.game.roundHooks.onUpdate.push(dt => {
                if (pause > 0) pause -= dt;
                for (let i = bolze.length - 1; i >= 0; i--) {
                    bolze[i].rest -= dt;
                    if (bolze[i].rest <= 0) bolze.splice(i, 1);
                }
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const b of bolze) {
                    const a = camera.worldToScreen(b.ax, b.ay);
                    const q = camera.worldToScreen(b.bx, b.by);
                    if (!MarkExtras.sichtbar(q)) continue;
                    ctx.save();
                    ctx.globalAlpha = clamp(b.rest / 0.2, 0, 1);
                    MarkExtras.blitz(ctx, a.x, a.y, q.x, q.y, Art.time + b.ax * 0.01);
                    ctx.restore();
                }
            });
        },
    });
})();

// ── mark04 Bumerang-Ball: der Ball fliegt zurück und trifft dabei noch einmal ──
(() => {
    const WENDE_NACH = 0.45;         // Sekunden Hinflug, spätestens dann dreht der Ball um
    const WENDE_NACH_TREFFER = 0.18; // Sekunden nach einem Treffer, dann geht er heim
    const DREHRATE = 90;             // rad/s: enge Kehre (Wenderadius vier px), damit der Rückweg
                                     // fast auf dem Hinweg - dort liegt auch der zweite Treffer
    const DURCHSCHUSS = 2;           // Gegner, die ein Ball auf seinem Flug durchfliegen darf
    const FREIGABE_NACH = 0.22;      // Sekunden, dann darf derselbe Gegner erneut getroffen werden
                                     // (knapp ueber der Treffer-Schutzzeit der Gegner)
    const HEIM_KREIS = 22;           // px: hier ist der Ball bei Mark angekommen

    registerUpgrade({
        id: 'mark04', figur: 'mark', name: 'Bumerang-Ball', emoji: '🪃',
        text: 'Marks Ball fliegt hinaus, dreht um und trifft auf dem Heimweg noch einmal.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            c.game.roundHooks.onUpdate.push(dt => {
                const p = Game.player;
                const px = p.x + p.w / 2, py = p.y + p.h / 2;
                for (const b of Game.projectiles) {
                    if (!MarkExtras.marksBall(b)) continue;
                    // Flugzeit des Balles: die eigene der Engine (drei Sekunden), hier nur die Zeit
                    // seit dem Wurf mitzaehlen - der Bumerang laeuft also ganz normal ab.
                    b._bumiZeit = (b._bumiZeit || 0) + dt;
                    // Wann dreht der Ball um? Nach dem Treffer oder nach dem Hinflug
                    if (b._bumiHeim) {
                        b._bumiZiel = Math.atan2(py - b.y, px - b.x);   // er fliegt zu Mark heim
                    } else if (b._bumiWende !== undefined) {
                        b._bumiWende -= dt;
                        if (b._bumiWende <= 0) {
                            b._bumiHeim = true;
                            b._bumiZiel = Math.atan2(py - b.y, px - b.x);
                            FX.ring(b.x, b.y, '#ffd23f', 13, 0.22, 2);
                        }
                    } else if (b._bumiZeit >= WENDE_NACH) {
                        b._bumiWende = 0;
                    }
                    // Die Kehre: die Flugrichtung schwenkt in einem Ruck auf die Heimrichtung
                    if (b._bumiZiel !== undefined) {
                        const tempo = Math.hypot(b.vx, b.vy);
                        const aktuell = Math.atan2(b.vy, b.vx);
                        const d = MarkExtras.winkelAbstand(b._bumiZiel, aktuell);
                        const neu = aktuell + clamp(d, -DREHRATE * dt, DREHRATE * dt);
                        b.vx = Math.cos(neu) * tempo;
                        b.vy = Math.sin(neu) * tempo;
                    }
                    // Getroffene Gegner geben den Ball nach einer Frist wieder frei, damit er
                    // auf dem Heimweg noch einmal ansprechen kann (pierceHits setzt js/main.js)
                    if (b._bumiFrei) {
                        for (let i = b._bumiFrei.length - 1; i >= 0; i--) {
                            const f = b._bumiFrei[i];
                            f.rest -= dt;
                            if (f.rest > 0) continue;
                            const k = b.pierceHits ? b.pierceHits.indexOf(f.e) : -1;
                            if (k >= 0) b.pierceHits.splice(k, 1);
                            b._bumiFrei.splice(i, 1);
                        }
                    }
                    // Angekommen: Mark fängt den Bumerang und er löst sich in Funken auf
                    if (b._bumiHeim && !b._bumiFang && Math.hypot(b.x - px, b.y - py) < HEIM_KREIS) {
                        b._bumiFang = true;
                        b.dead = true;
                        FX.burst(b.x, b.y, ['#ffd23f', '#ffffff'], 5, 70, 0.28, { kind: 'spark' });
                    }
                }
            });
            c.player.hooks.onProjectileHit.push((e, b) => {
                if (!MarkExtras.marksBall(b)) return;
                // Der Ball stirbt beim Treffer nicht sofort. js/main.js setzt `pierce` erst NACH
                // diesem Haken herab, also hier einen Treffer vorzaehlen und eine weniger als
                // erlaubt eintragen: nach DURCHSCHUSS Gegnern ist der Flug zu Ende.
                b._bumiDurch = (b._bumiDurch || 0) + 1;
                b.pierce = Math.max(0, DURCHSCHUSS - b._bumiDurch);
                if (!b.pierceHits) b.pierceHits = [];
                (b._bumiFrei || (b._bumiFrei = [])).push({ e, rest: FREIGABE_NACH });
                if (b._bumiWende === undefined && !b._bumiHeim) b._bumiWende = WENDE_NACH_TREFFER;
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const b of Game.projectiles) {
                    if (!MarkExtras.marksBall(b)) continue;
                    const s = camera.worldToScreen(b.x, b.y);
                    if (!MarkExtras.sichtbar(s)) continue;
                    MarkExtras.wirbel(ctx, s.x, s.y, (b.radius || 5) + 4, Art.time * 2, 'rgba(255,210,63,0.9)', 2);
                }
            });
        },
    });
})();

// ── mark05 Riesenball: doppelt so groß, schubst Gegner weg ──
(() => {
    const GROESSE = 2;          // doppelter Ball-Durchmesser (Trefferkreis wächst mit)
    const SCHUB_KRAFT = 430;    // Wegschubsen beim Treffer (normale Gegner)
    const BOSS_SCHUB = 110;     // Bosse lassen sich von einem Ball kaum zurueckstossen

    registerUpgrade({
        id: 'mark05', figur: 'mark', name: 'Riesenball', emoji: '⚾',
        text: 'Marks Bälle sind doppelt so groß und schubsen getroffene Gegner weit weg.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            c.game.roundHooks.onUpdate.push(dt => {
                for (const p of MarkExtras.frischeBaelle('_riesen')) {
                    p.radius = (p.radius || 5) * GROESSE;
                    p.knockback = Math.max(p.knockback || 0, 240);
                }
            });
            c.player.hooks.onProjectileHit.push((e, p) => {
                if (!MarkExtras.marksBall(p)) return;
                const w = MarkExtras.winkelVon(p.x, p.y, e);
                knockBack(e, w, e.isBoss ? BOSS_SCHUB : SCHUB_KRAFT);
                FX.ring(p.x, p.y, '#ffe066', 20, 0.26, 3);
                FX.burst(e.centerX(), e.centerY(), ['#ffffff', '#ffd23f'], 6, 130, 0.3, { kind: 'spark' });
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const p of Game.projectiles) {
                    if (!p._riesen || !MarkExtras.marksBall(p)) continue;
                    const s = camera.worldToScreen(p.x, p.y);
                    if (!MarkExtras.sichtbar(s)) continue;
                    Art.ring(ctx, s.x, s.y, (p.radius || 10) + 2.5 + Math.sin(Art.time * 12) * 0.8,
                        'rgba(255,240,180,0.75)', 1.6, 0.8);
                }
            });
        },
    });
})();

// ── mark06 Doppelschlag: der Schläger trifft zweimal hintereinander ──
(() => {
    const ZWEIT_WARTEN = 0.26;   // Sekunden zwischen erstem und zweitem Schlag (Treffer-Schutz abwarten)
    const ZWEIT_ANTHEIL = 0.75;  // der zweite Schlag schlägt mit 75 % der Schlägerkraft an

    registerUpgrade({
        id: 'mark06', figur: 'mark', name: 'Doppelschlag', emoji: '🥊',
        text: 'Marks Schläger trifft zweimal hintereinander: direkt hinter dem ersten folgt der zweite Schlag.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let wartet = -1;    // >= 0: Sekunden bis zum zweiten Schlag
            let bogen = 0;      // Restzeit der sichtbaren Schwung-Spur
            let schwung = 0;    // Richtung des letzten Schlags
            c.player.hooks.onMeleeHit.push(() => {
                const w = MarkExtras.schlaeger(Game.player);
                if (w && w.swingAngle !== undefined) schwung = w.swingAngle;
                if (wartet < 0) wartet = ZWEIT_WARTEN;
            });
            c.game.roundHooks.onUpdate.push(dt => {
                if (bogen > 0) bogen -= dt;
                if (wartet < 0) return;
                wartet -= dt;
                if (wartet > 0) return;
                wartet = -1;
                const p = Game.player;
                const w = MarkExtras.schlaeger(p);
                if (!w || p.dead) return;
                const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
                const menge = Math.max(1, Math.round(w.damage * ZWEIT_ANTHEIL));
                let getroffen = 0;
                for (const e of Game.enemies) {
                    if (e.dead) continue;
                    const nx = clamp(cx, e.x, e.x + e.w), ny = clamp(cy, e.y, e.y + e.h);
                    const d = Math.hypot(nx - cx, ny - cy);
                    if (d > w.range + 4) continue;
                    if (d > 6 && Math.abs(MarkExtras.winkelAbstand(Math.atan2(ny - cy, nx - cx), schwung))
                        > w.arcWidth / 2 + 0.2) continue;
                    // Der zweite Schlag ueberspringt den kurzen Treffer-Schutz der Gegner,
                    // sonst fiele er genau in die Schutzzeit des ersten Schlags und verpuffte.
                    e.iFrames = 0;
                    e.takeDamage(menge, MarkExtras.winkelVon(cx, cy, e), w.knockback * 0.7);
                    getroffen++;
                }
                if (!getroffen) return;
                bogen = 0.24;
                Sound.swing();
                FX.ring(cx, cy, '#fff3b0', w.range, 0.24, 3);
                if (Game.camera && Game.camera.shake) Game.camera.shake(3, 0.12);
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                if (bogen <= 0) return;
                const p = Game.player;
                const w = MarkExtras.schlaeger(p);
                if (!w || p.dead) return;
                const s = camera.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (!MarkExtras.sichtbar(s)) return;
                const g = clamp(bogen / 0.24, 0, 1);
                ctx.save();
                ctx.globalAlpha = g * 0.85;
                ctx.strokeStyle = '#fff3b0';
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(s.x, s.y, w.range * (1.16 - 0.1 * g), schwung - w.arcWidth / 2, schwung + w.arcWidth / 2);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,159,28,0.9)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(s.x, s.y, w.range * (1.16 - 0.1 * g) + 3.5, schwung - w.arcWidth / 2, schwung + w.arcWidth / 2);
                ctx.stroke();
                ctx.restore();
            });
        },
    });
})();

// ── mark07 Home-Run-Schlag: ein aufgeladener Schlag schleudert Gegner weit weg ──
(() => {
    const LADE_ZEIT = 4;          // Sekunden, bis der Schlag aufgeladen ist
    const FLUG_TEMPO = 760;       // px pro Sekunde für normale Gegner
    const FLUG_ZEIT = 0.55;       // Sekunden lang fliegt der Getroffene
    const BOSS_TEMPO = 240;       // Bosse widerstehen: kurzer, schwacher Schub
    const BOSS_ZEIT = 0.16;

    registerUpgrade({
        id: 'mark07', figur: 'mark', name: 'Home-Run-Schlag', emoji: '💫',
        text: 'Ist Marks Schlag aufgeladen, schleudert er getroffene Gegner weit durch die Welt.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let ladung = 0;
            let schlagDa = false;   // der aufgeladene Schlag trifft gerade (gilt für den ganzen Schwung)
            const fluege = new Map();

            function schleuder(e) {
                if (!e || e.dead) return;
                const p = Game.player;
                const w = Math.atan2(e.centerY() - (p.y + p.h / 2), e.centerX() - (p.x + p.w / 2));
                const boss = !!e.isBoss;
                const tempo = boss ? BOSS_TEMPO : FLUG_TEMPO;
                fluege.set(e, { vx: Math.cos(w) * tempo, vy: Math.sin(w) * tempo, rest: boss ? BOSS_ZEIT : FLUG_ZEIT });
                knockBack(e, w, boss ? 130 : 260);
                FX.ring(e.centerX(), e.centerY(), '#ffd23f', 26, 0.3, 4);
                FX.burst(e.centerX(), e.centerY(), ['#ffd23f', '#ffffff', '#ff9f1c'], 10, 150, 0.4, { kind: 'spark' });
                if (!boss) FX.text(e.centerX(), e.y - 8, 'HOME RUN!', '#ffd23f', 11);
                Sound.hit();
                if (Game.camera && Game.camera.shake) Game.camera.shake(4, 0.16);
            }

            c.player.hooks.onMeleeHit.push(e => {
                if (!schlagDa) {
                    if (ladung < 1) return;
                    ladung = 0;
                    schlagDa = true;
                }
                schleuder(e);
            });
            c.player.hooks.onUpdate.push(dt => {
                if (ladung < 1) ladung = Math.min(1, ladung + dt / LADE_ZEIT);
                const p = Game.player;
                const w = p.activeWeapon;
                // Der aufgeladene Schwung ist abgelaufen, sobald nicht mehr geschlagen wird -
                // auch dann, wenn Mark in der Schwungphase auf den Werfer wechselt.
                if (!w || w.type !== 'melee' || !w.swinging) schlagDa = false;
                if (!fluege.size) return;
                for (const [e, f] of fluege) {
                    if (e.dead) { fluege.delete(e); continue; }
                    f.rest -= dt;
                    if (f.rest <= 0) { fluege.delete(e); continue; }
                    const d = Math.exp(-2.4 * dt);
                    f.vx *= d;
                    f.vy *= d;
                    moveWithCollision(e, f.vx * dt, f.vy * dt, Game.world);
                    if (Math.random() < 0.5) {
                        FX.burst(e.centerX(), e.centerY(), 'rgba(255,240,190,0.85)', 1, 28, 0.35, { kind: 'smoke', size: 4 });
                    }
                }
            });
            c.player.hooks.onDraw.push(ctx => {
                const cam = Game.camera;
                const p = Game.player;
                if (!cam || p.dead) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (ladung >= 1) {
                    Art.ring(ctx, s.x, s.y, 19 + Math.sin(Art.time * 8) * 1.3, '#ffd23f', 2, 0.9);
                    Art.sparkle(ctx, s.x - 15, s.y - 20, 3, '#ffe066', 0.9);
                    Art.sparkle(ctx, s.x + 16, s.y - 15, 2.4, '#ffe066', 0.8);
                } else {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,210,63,0.85)';
                    ctx.lineWidth = 2.4;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, 19, -Math.PI / 2, -Math.PI / 2 + TAU * ladung);
                    ctx.stroke();
                    ctx.restore();
                }
            });
        },
    });
})();

// ── mark08 Wirbelschläger: der Schwung kreist einmal um Mark herum ──
(() => {
    const UEBER_REICHWEITE = 8;   // px über die normale Schläger-Reichweite hinaus
    const BOSS_ANTHEIL = 0.4;     // Bosse stecken den Rundum-Wirbel deutlich besser weg

    registerUpgrade({
        id: 'mark08', figur: 'mark', name: 'Wirbelschläger', emoji: '🌀',
        text: 'Marks Schwung kreist einmal herum und trifft auch Gegner hinter und neben ihm.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let wirbelt = 0;   // Sekunden, die der Wirbel noch sichtbar bleibt

            c.player.hooks.onUpdate.push(dt => {
                const p = Game.player;
                const w = MarkExtras.schlaeger(p);
                if (!w || !w.swinging) { wirbelt = Math.max(0, wirbelt - dt); return; }
                wirbelt = 0.28;
                const px = p.x + p.w / 2, py = p.y + p.h / 2;
                let rundum = 0;
                for (const e of MarkExtras.naechsteGegner(px, py, w.range + UEBER_REICHWEITE, null, 12)) {
                    if (e.iFrames > 0) continue;
                    const winkel = MarkExtras.winkelVon(px, py, e);
                    // Was vor der Schläger-Front liegt, erledigt js/main.js selbst
                    if (Math.abs(MarkExtras.winkelAbstand(winkel, w.swingAngle)) <= w.arcWidth / 2) continue;
                    let menge = w.damage;
                    if (p.hasPowerUp('attack')) menge += 2;
                    if (e.isBoss) menge = Math.max(1, Math.round(menge * BOSS_ANTHEIL));
                    e.takeDamage(menge, winkel, w.knockback * 0.7);
                    FX.burst(e.centerX(), e.centerY(), ['#8fe8ff', '#ffffff'], 5, 120, 0.3, { kind: 'spark' });
                    rundum++;
                }
                if (rundum) {
                    p._markWirbel = rundum;
                    Sound.hit();
                }
            });

            c.player.hooks.onDraw.push(ctx => {
                const p = Game.player, cam = Game.camera;
                if (!cam || p.dead || wirbelt <= 0) return;
                const w = MarkExtras.schlaeger(p);
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (!MarkExtras.sichtbar(s)) return;
                const g = w && w.swinging ? 1 - w.swingTimer / (w.swingDuration || 0.2) : 1;
                ctx.save();
                ctx.globalAlpha = wirbelt / 0.28;
                MarkExtras.wirbel(ctx, s.x, s.y, (w ? w.range : 44) * (0.5 + 0.65 * g), Art.time, 'rgba(143,232,255,0.95)', 2.6);
                MarkExtras.wirbel(ctx, s.x, s.y, (w ? w.range : 44) * (0.3 + 0.6 * g), Art.time * -1.4, 'rgba(255,255,255,0.75)', 1.6);
                ctx.restore();
            });
        },
    });
})();

// ── mark09 Geisterfalle: eine Falle aus Geisterlicht hält einen Gegner fest ──
(() => {
    const WARTEN = 1.1;       // Sekunden, bis die nächste Falle gestellt ist
    const ERSTE_WARTEN = 0.3; // Sekunden gleich zu Rundenbeginn
    const HALTE_ZEIT = 1.2;   // Sekunden steht ein Gegner in der Falle still
    const FALLE_KREIS = 66;   // px: so weit schnappt die Falle zu
    const LEBEN = 5;          // Sekunden bleibt eine gestellte Falle liegen

    registerUpgrade({
        id: 'mark09', figur: 'mark', name: 'Geisterfalle', emoji: '👻',
        text: 'Mark stellt fallen aus Geisterlicht: ein Gegner darin hält eine Weile still.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let warte = ERSTE_WARTEN;
            let falle = null;   // { x, y, rest, frisch }

            c.player.hooks.onUpdate.push(dt => {
                const p = Game.player;
                if (falle) {
                    falle.rest -= dt;
                    falle.frisch = Math.max(0, (falle.frisch || 0) - dt);
                    for (const e of MarkExtras.naechsteGegner(falle.x, falle.y, FALLE_KREIS, null, 1)) {
                        // Enemy.freeze regelt den Boss-Widerstand selbst (max 0,6 s, alle 4 s)
                        if (e.freezeTimer > 0 || e.freezeCooldown > 0) continue;
                        if (!e.freeze(HALTE_ZEIT)) continue;
                        e._markFrostMax = Math.max(e._markFrostMax || 0, e.freezeTimer);
                        FX.ring(e.centerX(), e.centerY(), '#bfe9ff', 24, 0.4, 3);
                        FX.burst(e.centerX(), e.centerY(), ['#bfe9ff', '#ffffff'], 8, 70, 0.5, { kind: 'smoke', size: 5 });
                        FX.text(e.centerX(), e.y - 8, 'GEFANGEN!', '#bfe9ff', 10);
                        Sound.hit();
                        falle = null;
                        warte = WARTEN;
                        break;
                    }
                    if (falle && falle.rest <= 0) { falle = null; warte = WARTEN; }
                } else {
                    warte -= dt;
                    if (warte <= 0 && !p.dead) {
                        falle = { x: p.x + p.w / 2, y: p.y + p.h / 2, rest: LEBEN, frisch: 0.35 };
                        FX.ring(p.x + p.w / 2, p.y + p.h / 2, 'rgba(191,233,255,0.8)', FALLE_KREIS, 0.45, 2);
                    }
                }
            });

            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                if (!falle) return;
                const s = camera.worldToScreen(falle.x, falle.y);
                if (!MarkExtras.sichtbar(s)) return;
                const t = Art.time;
                const klang = Math.min(1, falle.rest / 1.2);
                ctx.save();
                ctx.globalAlpha = 0.35 + 0.45 * klang;
                ctx.strokeStyle = '#bfe9ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([7, 6]);
                ctx.lineDashOffset = -t * 22;
                ctx.beginPath();
                ctx.arc(s.x, s.y, FALLE_KREIS, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
                // drei Geisterlichter kreisen am Rand
                for (let i = 0; i < 3; i++) {
                    const a = t * 2.2 + i * TAU / 3;
                    Art.glow(ctx, s.x + Math.cos(a) * FALLE_KREIS, s.y + Math.sin(a) * FALLE_KREIS, 9, '#bfe9ff', 0.55);
                }
                ctx.restore();
                if ((falle.frisch || 0) > 0) {
                    ctx.save();
                    ctx.globalAlpha = falle.frisch / 0.35;
                    Art.ring(ctx, s.x, s.y, FALLE_KREIS * 0.6, '#eaf9ff', 2, 0.8);
                    ctx.restore();
                }
            });
        },
    });
})();

// ── mark10 Geistersauger: kleine Gegner werden zu Mark gezogen ──
(() => {
    const SAUG_KREIS = 150;   // px: ab hier greift der Sog
    const SAUG_ZUG = 430;     // px pro Sekunde Grundtempo des Sogs
    // 18 statt 12: seit dem schwereren Gegner-Leben (FOE_HP 1,5 in js/main.js) hat jeder Gegner
    // 1,5-mal so viele Herzen. 12 · 1,5 = 18, damit greift der Sog bei genau denselben Gegnern wie
    // vorher. Ausnahme Training (Welt 0): dort läuft die Hochrechnung nicht (js/main.js:1262), die
    // Gegner behalten ihr Klassenleben - beim Sog egal, dort hat kein Gegner 13 bis 18 Leben.
    const KLEIN_BEI = 18;     // Gegner mit so viel Leben oder weniger lässt der Sog greifen
    const BISS_KREIS = 34;    // px: ganz bei Mark packt der Sog zu
    const BISS_ZEIT = 0.25;   // Sekunden zwischen zwei Bissen
    const BISS_MENGE = 1.2;   // Leben, das ein Biss abzieht

    registerUpgrade({
        id: 'mark10', figur: 'mark', name: 'Geistersauger', emoji: '🌪',
        text: 'Ein Geisterstrudel zerrt kleine Gegner zu Mark herüber und zieht ihnen Leben ab.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let biss = 0;
            let saugend = 0;  // Sekunden: gerade greift der Sog (nur für den Glanz)

            c.player.hooks.onUpdate.push(dt => {
                const p = Game.player;
                saugend = Math.max(0, saugend - dt);
                biss = Math.max(0, biss - dt);
                if (p.dead || !Game.enemies) return;
                const px = p.x + p.w / 2, py = p.y + p.h / 2;
                const gebissen = [];
                for (const e of Game.enemies) {
                    // Bosse und schwere Gegner lassen sich nicht zerrennen
                    if (!e || e.dead || e.isBoss || (e.maxHp || 99) > KLEIN_BEI) continue;
                    const d = Math.hypot(px - e.centerX(), py - e.centerY());
                    if (d > SAUG_KREIS) continue;
                    saugend = 0.2;
                    if (d > BISS_KREIS) {
                        const w = Math.atan2(py - e.centerY(), px - e.centerX());
                        const tempo = SAUG_ZUG * (1 - 0.4 * d / SAUG_KREIS);
                        moveWithCollision(e, Math.cos(w) * tempo * dt, Math.sin(w) * tempo * dt, Game.world);
                    } else {
                        gebissen.push(e);
                    }
                }
                if (gebissen.length && biss <= 0) {
                    biss = BISS_ZEIT;
                    for (const e of gebissen) {
                        e.takeDamage(BISS_MENGE, MarkExtras.winkelVon(px, py, e), 0);
                        FX.burst(e.centerX(), e.centerY(), ['#c9b6ff', '#eaf9ff'], 4, 60, 0.4, { kind: 'smoke', size: 4 });
                    }
                }
            });

            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                if (saugend <= 0) return;
                const p = Game.player;
                const px = p.x + p.w / 2, py = p.y + p.h / 2;
                const s = camera.worldToScreen(px, py);
                if (!MarkExtras.sichtbar(s)) return;
                ctx.save();
                ctx.globalAlpha = Math.min(1, saugend / 0.2) * 0.9;
                MarkExtras.wirbel(ctx, s.x, s.y, 20 + Math.sin(Art.time * 7) * 2, Art.time, 'rgba(201,182,255,0.95)', 2.4);
                MarkExtras.wirbel(ctx, s.x, s.y, 32 + Math.sin(Art.time * 5) * 3, Art.time * -0.7, 'rgba(234,249,255,0.6)', 1.6);
                for (const e of Game.enemies || []) {
                    if (!e || e.dead || e.isBoss || (e.maxHp || 99) > KLEIN_BEI) continue;
                    const d = Math.hypot(px - e.centerX(), py - e.centerY());
                    if (d > SAUG_KREIS) continue;
                    const g = camera.worldToScreen(e.centerX(), e.centerY());
                    for (let i = 1; i <= 3; i++) {
                        const anteil = ((Art.time * 1.6 + i * 0.31) % 1);
                        ctx.globalAlpha = 0.7 * (1 - anteil);
                        Art.ring(ctx, g.x + (s.x - g.x) * anteil, g.y + (s.y - g.y) * anteil,
                            4.5 - 3 * anteil, '#c9b6ff', 1.4, 0.9);
                    }
                }
                ctx.restore();
            });
        },
    });
})();

// ── mark11 Magnet-Handschuh: Münzen aus großer Ferne fliegen von selbst zu Mark ──
(() => {
    const MAG_KREIS = 240;   // px: so weit greift der Handsch nach Münzen
    const MAG_KRAFT = 640;   // Sogkraft (die Engine selbst zieht nur bis 95 px)

    registerUpgrade({
        id: 'mark11', figur: 'mark', name: 'Magnet-Handschuh', emoji: '🧲',
        text: 'Marks Hand zieht Münzen schon aus großer Entfernung zu ihm herüber.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let greift = 0;

            c.game.roundHooks.onUpdate.push(dt => {
                const p = Game.player;
                greift = Math.max(0, greift - dt);
                if (p.dead || !Game.coinDrops) return;
                const px = p.x + p.w / 2, py = p.y + p.h / 2;
                for (const m of Game.coinDrops) {
                    if (!m || m.collected || (m.age || 0) <= 0.35) continue;
                    const cx = m.x + m.w / 2, cy = m.y + m.h / 2;
                    const d = Math.hypot(px - cx, py - cy);
                    if (d > MAG_KREIS || d < 1) continue;
                    greift = 0.2;
                    const zug = MAG_KRAFT * (1 - d / (MAG_KREIS + 60));
                    m.vx = (m.vx || 0) + (px - cx) / d * zug * dt * 6;
                    m.vy = (m.vy || 0) + (py - cy) / d * zug * dt * 6;
                }
            });

            c.player.hooks.onDraw.push(ctx => {
                const p = Game.player, cam = Game.camera;
                if (!cam || p.dead) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (!MarkExtras.sichtbar(s)) return;
                const t = Art.time;
                ctx.save();
                ctx.globalAlpha = greift > 0 ? 0.95 : 0.4;
                for (let i = 0; i < 2; i++) {
                    const a = t * (i ? -3.1 : 2.3) + i * Math.PI;
                    const r = 15 + (greift > 0 ? 4 * Math.sin(t * 12) : 0);
                    Art.sparkle(ctx, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, i ? 2.2 : 2.8, '#ffd23f', 0.85);
                }
                if (greift > 0) Art.ring(ctx, s.x, s.y, 24 + 3 * Math.sin(t * 10), 'rgba(255,210,63,0.8)', 1.6, 0.8);
                ctx.restore();
            });
        },
    });
})();

// ── mark12 Turbo-Schuhe: Mark läuft ein gutes Stück schneller ──
(() => {
    const SCHUB = 1.45;   // Faktor auf Marks Grundtempo

    registerUpgrade({
        id: 'mark12', figur: 'mark', name: 'Turbo-Schuhe', emoji: '👟',
        text: 'Turboschnelle Schuhe: Mark läuft deutlich schneller durch die Welt.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            const p = c.player;
            p.baseSpeed = Math.round(p.baseSpeed * SCHUB);
            let staub = 0;

            c.player.hooks.onUpdate.push(dt => {
                const dir = (typeof Input !== 'undefined' && Input.direction) || { x: 0, y: 0 };
                if (Math.abs(dir.x) + Math.abs(dir.y) < 0.2 || p.dead) return;
                staub = Math.max(0, staub - dt);
                if (staub <= 0) {
                    staub = 0.07;
                    FX.burst(p.x + p.w / 2 - dir.x * 8, p.y + p.h - 2, 'rgba(255,255,255,0.75)', 1, 40, 0.35,
                        { kind: 'smoke', size: 4 });
                }
            });

            c.player.hooks.onDraw.push(ctx => {
                const cam = Game.camera;
                if (!cam || p.dead) return;
                const dir = (typeof Input !== 'undefined' && Input.direction) || { x: 0, y: 0 };
                if (Math.abs(dir.x) + Math.abs(dir.y) < 0.2) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (!MarkExtras.sichtbar(s)) return;
                const w = Math.atan2(dir.y, dir.x) + Math.PI;   // hinter Mark
                ctx.save();
                ctx.strokeStyle = 'rgba(255,255,255,0.55)';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                for (let i = 0; i < 3; i++) {
                    const a = w + (i - 1) * 0.45;
                    const ab = 12 + ((Art.time * 90 + i * 9) % 14);
                    ctx.beginPath();
                    ctx.moveTo(s.x + Math.cos(a) * ab, s.y + Math.sin(a) * ab);
                    ctx.lineTo(s.x + Math.cos(a) * (ab + 8), s.y + Math.sin(a) * (ab + 8));
                    ctx.stroke();
                }
                ctx.restore();
            });
        },
    });
})();

// ── mark13 Doppel-Ausweichen: auf das erste Ausweichen folgt sofort ein zweites ──
(() => {
    const FRIST = 0.5;      // Sekunden Zeit für das zweite Ausweichen
    const REST = 0.3;       // Sekunden Abklingzeit, wenn das zweite ungenutzt verstreicht
    const RING_ZEIT = 0.45; // Sekunden bleibt der Hinweisring sichtbar

    registerUpgrade({
        id: 'mark13', figur: 'mark', name: 'Doppel-Ausweichen', emoji: '💨',
        text: 'Direkt nach dem Ausweichen kann Mark sofort ein zweites Mal ausweichen.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            // 0 = keine Kette, 1 = erstes Ausweichen läuft, 2 = zweites steht bereit, 3 = zweites läuft
            let stufe = 0;
            let frist = 0;
            let glanz = 0;

            c.player.hooks.onDodge.push(() => {
                if (stufe === 0) stufe = 1;
                else if (stufe === 2) { stufe = 3; glanz = RING_ZEIT; }
            });

            c.player.hooks.onUpdate.push(dt => {
                const p = Game.player;
                glanz = Math.max(0, glanz - dt);
                if (p.dead) { stufe = 0; return; }
                if (stufe === 1 && !p.dodging) {
                    p.dodgeCooldown = 0;      // das zweite Ausweichen steht sofort bereit
                    stufe = 2;
                    frist = FRIST;
                    FX.burst(p.x + p.w / 2, p.y + p.h - 2, 'rgba(191,233,255,0.9)', 5, 70, 0.4, { kind: 'smoke', size: 4 });
                } else if (stufe === 2) {
                    frist -= dt;
                    if (frist <= 0) {
                        p.dodgeCooldown = Math.max(p.dodgeCooldown, REST);
                        stufe = 0;
                    }
                } else if (stufe === 3 && !p.dodging) {
                    stufe = 0;
                }
            });

            c.player.hooks.onDraw.push(ctx => {
                const p = Game.player, cam = Game.camera;
                if (!cam || p.dead) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (!MarkExtras.sichtbar(s)) return;
                if (glanz > 0) {
                    ctx.save();
                    ctx.globalAlpha = glanz / RING_ZEIT;
                    Art.ring(ctx, s.x, s.y, 20 + (1 - glanz / RING_ZEIT) * 12, '#bfe9ff', 2.4, 0.9);
                    ctx.restore();
                }
                if (stufe !== 2) return;
                const q = 1 - frist / FRIST;
                ctx.save();
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = '#bfe9ff';
                ctx.lineWidth = 2.2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(s.x, s.y, 21, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - q));
                ctx.stroke();
                Art.sparkle(ctx, s.x + 16, s.y - 14, 2.6, '#eaf9ff', 0.9);
                ctx.restore();
            });
        },
    });
})();

// ══════════════════════════════════════════════════════════════════════════
// ── Paket 2 (18.10.2026): zwölf weitere Extra aus Leanders Liste (mark14–mark25) ──
// Wieder gilt: Wirkung nur über die Haken aus js/upgrades.js, Datei js/player.js
// und js/weapons.js bleiben unberührt. Alle sind Shop-Artikel (850 Juwelen),
// NUR mark23 „Klebeball" ist die Weltbelohnung 51 (`welt: 51`, nicht kaufbar).
// ══════════════════════════════════════════════════════════════════════════

// Kleines Herz in Bildschirmmaßen (zwei Lappen, Spitze nach unten)
function herz(ctx, x, y, s, farbe) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = farbe || '#ff4d6d';
    ctx.beginPath();
    ctx.arc(-2.6, -2.2, 2.9, 0, TAU);
    ctx.arc(2.6, -2.2, 2.9, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5.2, -0.6);
    ctx.lineTo(0, 5.6);
    ctx.lineTo(5.2, -0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(-2.9, -3.1, 1.1, 0, TAU);
    ctx.fill();
    ctx.restore();
}
MarkExtras.herz = herz;

// ── mark14 Herz-Sammler: besiegte Gegner lassen Herzen fallen ──
(() => {
    const CHANCE = 0.3;        // normaler Gegner lässt ein Herz fallen
    const CHANCE_TAFF = 0.55;  // Gegner mit viel Leben öfter
    const HEILUNG = 2;         // ein fallendes Herz ist ein halbes Herz
    const BOSS_HEILUNG = 4;    // der Boss lässt ein volles Herz fallen
    const LEBEN = 9;           // Sekunden bleibt ein Herz liegen

    registerUpgrade({
        id: 'mark14', figur: 'mark', name: 'Herz-Sammler', emoji: '💗',
        text: 'Besiegte Gegner lassen oft kleine Herzen fallen: lauf darüber und Mark heilt sich.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            const herzen = [];
            c.game._mark2Herzen = herzen;   // für die Messung von außen zählbar
            c.player.hooks.onKill.push(e => {
                if (!e) return;
                let fallen = null;
                if (e.isBoss) fallen = BOSS_HEILUNG;
                // 12 statt 8: dasselbe wie beim Sog - die Gegner haben seit dem schwereren Gegner-Leben
                // (FOE_HP 1,5) 1,5-mal so viele Herzen, 8 · 1,5 = 12. Es gilt also wie vorher ab 8 Leben.
                // Nur im Training (Welt 0) bleibt das Klassenleben nicht hochgerechnet: dort brauchen die
                // Gegner mit 8 bis 11 Leben die seltene Chance (30 %) statt der haeufigen (55 %).
                else if ((e.maxHp || 0) >= 12 && Math.random() < CHANCE_TAFF) fallen = HEILUNG;
                else if (Math.random() < CHANCE) fallen = HEILUNG;
                if (fallen === null) return;
                const a = randRange(0, TAU);
                herzen.push({
                    x: e.centerX() - 6, y: e.centerY() - 6, w: 12, h: 12,
                    vx: Math.cos(a) * randRange(40, 90), vy: Math.sin(a) * randRange(40, 90),
                    rest: LEBEN, heilung: fallen, bob: 0,
                });
                FX.burst(e.centerX(), e.centerY(), ['#ff4d6d', '#ffd23f', '#ffffff'], 6, 80, 0.45, { kind: 'spark' });
            });
            c.game.roundHooks.onUpdate.push(dt => {
                const p = Game.player;
                for (let i = herzen.length - 1; i >= 0; i--) {
                    const h = herzen[i];
                    h.rest -= dt;
                    h.bob += dt;
                    if (h.rest <= 0) { herzen.splice(i, 1); continue; }
                    const damp = Math.exp(-4.5 * dt);
                    h.vx *= damp;
                    h.vy *= damp;
                    if (!Game.world.isWall(h.x + h.vx * dt + 6, h.y + 6)) h.x += h.vx * dt; else h.vx *= -0.5;
                    if (!Game.world.isWall(h.x + 6, h.y + h.vy * dt + 6)) h.y += h.vy * dt; else h.vy *= -0.5;
                    if (p.dead) continue;
                    const d = Math.hypot(p.x + p.w / 2 - (h.x + 6), p.y + p.h / 2 - (h.y + 6));
                    if (d < 22) {
                        p.heal(h.heilung);
                        FX.burst(h.x + 6, h.y + 6, ['#ff4d6d', '#ffd23f', '#ffffff'], 8, 90, 0.5, { kind: 'star', size: 4 });
                        FX.text(h.x + 6, h.y - 4, h.heilung >= BOSS_HEILUNG ? 'VOLLES HERZ!' : 'HERZ! ❤️', '#ff8fa3', 10);
                        Sound.powerUp();
                        herzen.splice(i, 1);
                    }
                }
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const h of herzen) {
                    const s = camera.worldToScreen(h.x + 6, h.y + 6 + Math.sin(h.bob * 5) * 2);
                    if (!MarkExtras.sichtbar(s)) continue;
                    Art.glow(ctx, s.x, s.y, 11, '#ff4d6d', 0.45);
                    herz(ctx, s.x, s.y, 1 + Math.sin(h.bob * 6) * 0.08, h.rest < 2.4 && (h.rest * 6) % 2 < 1 ? 'rgba(255,77,109,0.5)' : '#ff4d6d');
                }
            });
        },
    });
})();

// ── mark15 Schutzhelm: alle 30 Sekunden fängt der Helm einen Treffer ab ──
(() => {
    const FRIST = 30;   // Sekunden, bis der Helm wieder einen Treffer blockt

    registerUpgrade({
        id: 'mark15', figur: 'mark', name: 'Schutzhelm', emoji: '⛑️',
        text: 'Alle 30 Sekunden macht ein Treffer dank Helm gar keinen Schaden.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let bereit = true;
            let warte = 0;
            let blink = 0;
            c.player.hooks.onDamaged.push(menge => {
                if (!bereit) return undefined;
                bereit = false;
                warte = FRIST;
                blink = 0.6;
                const p = Game.player;
                FX.ring(p.x + p.w / 2, p.y + p.h / 2, '#eaf9ff', 26, 0.4, 4);
                FX.burst(p.x + p.w / 2, p.y + p.h / 2, ['#eaf9ff', '#ffffff', '#bfe9ff'], 10, 120, 0.45, { kind: 'spark' });
                FX.text(p.x + p.w / 2, p.y - 10, 'HELM fängt das!', '#eaf9ff', 11);
                Sound.hit();
                return 0;   // die Menge wird auf null gesetzt - kein Schaden
            });
            c.player.hooks.onUpdate.push(dt => {
                blink = Math.max(0, blink - dt);
                if (bereit) return;
                warte -= dt;
                if (warte <= 0) {
                    bereit = true;
                    const p = Game.player;
                    if (!p.dead) {
                        FX.ring(p.x + p.w / 2, p.y + p.h / 2, '#bfe9ff', 20, 0.35, 2);
                        FX.text(p.x + p.w / 2, p.y - 8, 'Helm bereit!', '#bfe9ff', 9);
                    }
                }
            });
            c.player.hooks.onDraw.push(ctx => {
                const p = Game.player, cam = Game.camera;
                if (!cam || p.dead) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y - 6);
                if (!MarkExtras.sichtbar(s)) return;
                if (bereit || blink > 0) {
                    // Helm: weiße Kalotte mit rotem Kreuz
                    ctx.save();
                    ctx.globalAlpha = blink > 0 ? 1 : 0.9;
                    ctx.fillStyle = '#f4f8ff';
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, 6.5, Math.PI, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#e2481f';
                    ctx.fillRect(s.x - 1.2, s.y - 6, 2.4, 5);
                    ctx.fillRect(s.x - 3.4, s.y - 3.8, 6.8, 2.4);
                    ctx.restore();
                    if (blink > 0) Art.ring(ctx, s.x, s.y + 2, 10 + blink * 8, 'rgba(234,249,255,0.8)', 2, blink);
                } else {
                    // beim Nachladen: Kreis füllt sich, bis der Helm wieder bereit ist
                    const q = 1 - Math.max(0, warte) / FRIST;
                    ctx.save();
                    ctx.strokeStyle = 'rgba(191,233,255,0.8)';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, 6.5, -Math.PI / 2, -Math.PI / 2 + TAU * q);
                    ctx.stroke();
                    ctx.restore();
                }
            });
        },
    });
})();

// ── mark16 Spiegel-Schild: gegnerische Geschosse prallen manchmal zurück ──
(() => {
    const SCHILD_KREIS = 42;   // px: hier fängt das Schild Geschosse ab
    const RUHEPAUSE = 1.6;     // Sekunden, bis das Schild das nächste Geschoss spiegelt

    registerUpgrade({
        id: 'mark16', figur: 'mark', name: 'Spiegel-Schild', emoji: '🪞',
        text: 'Ein spiegelndes Schild um Mark: gegnerische Geschosse prallen manchmal zurück.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let pause = 0;
            c.player.hooks.onUpdate.push(dt => {
                pause = Math.max(0, pause - dt);
                const p = Game.player;
                if (p.dead || pause > 0 || !Game.projectiles) return;
                const px = p.x + p.w / 2, py = p.y + p.h / 2;
                for (const proj of Game.projectiles) {
                    if (!proj || proj.dead || proj.owner !== 'enemy' || proj._gespiegelt) continue;
                    const d = Math.hypot(proj.x - px, proj.y - py);
                    if (d > SCHILD_KREIS) continue;
                    // nur Geschosse, die gerade ANFLIEGEN, nicht die, die schon abdrehten
                    const anflug = (px - proj.x) * proj.vx + (py - proj.y) * proj.vy;
                    if (anflug <= 0) continue;
                    const w = Math.atan2(proj.y - py, proj.x - px);
                    const tempo = Math.max(260, Math.hypot(proj.vx, proj.vy));
                    proj.vx = Math.cos(w) * tempo;
                    proj.vy = Math.sin(w) * tempo;
                    proj.owner = 'player';
                    proj.damage = Math.min(2, proj.damage || 1);
                    proj.knockback = 90;
                    proj._gespiegelt = true;
                    pause = RUHEPAUSE;
                    FX.ring(px, py, '#cfe8ff', SCHILD_KREIS, 0.3, 3);
                    FX.burst(proj.x, proj.y, ['#cfe8ff', '#ffffff'], 7, 110, 0.35, { kind: 'spark' });
                    FX.text(proj.x, proj.y - 8, 'ZURÜCK!', '#cfe8ff', 10);
                    Sound.hit();
                    break;
                }
            });
            c.player.hooks.onDraw.push(ctx => {
                const p = Game.player, cam = Game.camera;
                if (!cam || p.dead) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (!MarkExtras.sichtbar(s)) return;
                const bereit = pause <= 0;
                ctx.save();
                ctx.globalAlpha = bereit ? 0.75 : 0.25;
                ctx.strokeStyle = '#cfe8ff';
                ctx.lineWidth = bereit ? 2.4 : 1.4;
                ctx.beginPath();
                ctx.arc(s.x, s.y, SCHILD_KREIS * 0.72 + Math.sin(Art.time * 4) * 1.2, Art.time * 1.6, Art.time * 1.6 + TAU * 0.72);
                ctx.stroke();
                if (bereit) {
                    const a = Art.time * 1.6 + TAU * 0.36;
                    Art.sparkle(ctx, s.x + Math.cos(a) * SCHILD_KREIS * 0.72, s.y + Math.sin(a) * SCHILD_KREIS * 0.72, 2.6, '#ffffff', 0.9);
                }
                ctx.restore();
            });
        },
    });
})();

// ── mark17 Rempler: wer beim Ausweichen angerempelt wird, fällt um ──
(() => {
    const HALTE = 0.9;     // Sekunden liegt ein normaler Gegner am Boden
    const AB_STAND = 1.4;  // Sekunden Schonzeit, damit derselbe Gegner nicht mehrfach umfällt

    registerUpgrade({
        id: 'mark17', figur: 'mark', name: 'Rempler', emoji: '😵',
        text: 'Rempelt Mark beim Ausweichen einen Gegner, fällt der Gegner um und hält kurz still.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            c.player.hooks.onUpdate.push(dt => {
                const p = Game.player;
                for (const e of Game.enemies) {
                    if (e._remplerCd) {
                        e._remplerCd -= dt;
                        if (e._remplerCd <= 0) e._remplerCd = 0;
                    }
                }
                if (p.dead || !p.dodging) return;
                const px = p.x + p.w / 2, py = p.y + p.h / 2;
                for (const e of Game.enemies) {
                    if (!e || e.dead || (e._remplerCd || 0) > 0) continue;
                    const d = Math.hypot(e.centerX() - px, e.centerY() - py);
                    if (d > (e.w + e.h + p.w + p.h) / 2.6) continue;
                    e._remplerCd = AB_STAND;
                    // Enemy.freeze kümmert sich selbst um den Boss-Widerstand (0,6 s / alle 4 s)
                    const hingefallen = e.freeze(HALTE);
                    knockBack(e, Math.atan2(e.centerY() - py, e.centerX() - px), e.isBoss ? 70 : 190);
                    for (let i = 0; i < 4; i++) {
                        FX.burst(e.centerX(), e.y - 4, ['#ffd23f', '#ffffff'], 1, 40, 0.6, { kind: 'star', size: 4 });
                    }
                    FX.text(e.centerX(), e.y - 12, hingefallen ? 'UMGEFALLEN!' : 'Angestoßen!', '#ffd23f', 10);
                    Sound.hit();
                }
            });
        },
    });
})();

// ── mark18 Regenbogen-Ball: jeder Wurf ist zufällig Feuer, Eis oder Blitz ──
(() => {
    const ARTEM = ['feuer', 'eis', 'blitz'];
    const BRAND_REST = 2.0;    // Sekunden brennt ein Feuer-Treffer
    const BRAND_TICK = 0.3;
    const BRAND_MENGE = 0.4;   // Leben pro Tick
    const EIS_ZEIT = 1.1;      // Sekunden friert ein Eis-Treffer ein (Boss: Enemy.freeze)
    const BLITZ_KREIS = 150;   // px: hierhin springt der Blitz weiter
    const BLITZ_ZIELE = 2;
    const BLITZ_MENGE = 2;

    registerUpgrade({
        id: 'mark18', figur: 'mark', name: 'Regenbogen-Ball', emoji: '🌈',
        text: 'Jeder Wurf ist zufällig Feuer, Eis oder Blitz: brennt, friert ein oder kocht über.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            const bolze = [];
            let letzterArt = ARTEM[0];
            c.game.roundHooks.onUpdate.push(dt => {
                // Der Zerleger eines Wurfs lost die Art aus; die Splitter im naechsten Bild
                // erben genau diese Art - so traegt ein ganzer Wurf immer EINE Art.
                const neu = MarkExtras.frischeBaelle('_regenBall');
                for (const p of neu) {
                    if (p.splitBurst) {
                        letzterArt = ARTEM[(Math.random() * ARTEM.length) | 0];
                        p._regenArt = letzterArt;
                    } else if (!p._regenArt) {
                        p._regenArt = letzterArt;
                    }
                }
                // Nachgluehen des Feuers
                for (const e of Game.enemies) {
                    const b = e._regenBrand;
                    if (!b) continue;
                    if (e.dead) { e._regenBrand = null; continue; }
                    b.rest -= dt;
                    b.tick -= dt;
                    if (b.tick <= 0) {
                        b.tick = BRAND_TICK;
                        e.takeDamage(BRAND_MENGE);
                    }
                    if (b.rest <= 0) e._regenBrand = null;
                    else if (Math.random() < 0.18) {
                        FX.burst(e.centerX(), e.y, ['#ff8a1f', '#ffd23f'], 1, 22, 0.4, { kind: 'smoke', size: 3 });
                    }
                }
            });
            c.player.hooks.onProjectileHit.push((e, p) => {
                if (!MarkExtras.marksBall(p) || !p._regenArt || e.dead) return;
                if (p._regenArt === 'feuer') {
                    const b = e._regenBrand || (e._regenBrand = { rest: 0, tick: 0 });
                    b.rest = Math.max(b.rest, BRAND_REST);
                    b.tick = Math.min(b.tick, 0.1);
                    FX.burst(e.centerX(), e.centerY(), ['#ff8a1f', '#ffd23f'], 5, 80, 0.35, { kind: 'spark' });
                } else if (p._regenArt === 'eis') {
                    if (e.freeze(EIS_ZEIT)) {
                        FX.burst(e.centerX(), e.centerY(), ['#bfe9ff', '#ffffff'], 7, 80, 0.45, { kind: 'smoke', size: 4 });
                    }
                } else if (!p._regenBlitz) {
                    p._regenBlitz = true;
                    const zx = e.centerX(), zy = e.centerY();
                    for (const z of MarkExtras.naechsteGegner(zx, zy, BLITZ_KREIS, e, BLITZ_ZIELE)) {
                        z.takeDamage(BLITZ_MENGE, MarkExtras.winkelVon(zx, zy, z), 60);
                        bolze.push({ ax: zx, ay: zy, bx: z.centerX(), by: z.centerY(), rest: 0.18 });
                        FX.burst(z.centerX(), z.centerY(), ['#ffe066', '#ffffff'], 5, 90, 0.3, { kind: 'spark' });
                    }
                    FX.ring(zx, zy, '#ffe066', 22, 0.22, 3);
                }
            });
            c.game.roundHooks.onUpdate.push(dt => {
                for (let i = bolze.length - 1; i >= 0; i--) {
                    bolze[i].rest -= dt;
                    if (bolze[i].rest <= 0) bolze.splice(i, 1);
                }
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const p of Game.projectiles) {
                    if (!p._regenArt || !MarkExtras.marksBall(p)) continue;
                    const s = camera.worldToScreen(p.x, p.y);
                    if (!MarkExtras.sichtbar(s)) continue;
                    if (p._regenArt === 'feuer') {
                        MarkExtras.flamme(ctx, s.x, s.y + 2, 0.7, Art.time + p.age * 3);
                    } else if (p._regenArt === 'eis') {
                        Art.ring(ctx, s.x, s.y, (p.radius || 5) + 3, 'rgba(191,233,255,0.85)', 1.6, 0.85);
                        Art.sparkle(ctx, s.x - 5, s.y - 5, 1.8, '#eaf9ff', 0.9);
                    } else {
                        Art.sparkle(ctx, s.x + 4, s.y - 4, 2.2, '#ffe066', 0.95);
                        Art.sparkle(ctx, s.x - 4, s.y + 3, 1.6, '#ffffff', 0.8);
                    }
                }
                for (const b of bolze) {
                    const a = camera.worldToScreen(b.ax, b.ay);
                    const q = camera.worldToScreen(b.bx, b.by);
                    if (!MarkExtras.sichtbar(q)) continue;
                    ctx.save();
                    ctx.globalAlpha = clamp(b.rest / 0.18, 0, 1);
                    MarkExtras.blitz(ctx, a.x, a.y, q.x, q.y, Art.time + b.ax * 0.01, '#ffe066');
                    ctx.restore();
                }
            });
        },
    });
})();

// ── mark19 Zielsucher-Ball: Bälle schwenken sanft zum nächsten Gegner ──
(() => {
    const SUCH_KREIS = 240;   // px: hier sucht der Ball sich ein Ziel
    const DREHRATE = 5.5;     // rad pro Sekunde - deutliche Kurve, aber kein Richtungsknick

    registerUpgrade({
        id: 'mark19', figur: 'mark', name: 'Zielsucher-Ball', emoji: '🎯',
        text: 'Marks Bälle fliegen von selbst um die Kurve: sie suchen sich den nächsten Gegner.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            c.game.roundHooks.onUpdate.push(dt => {
                for (const p of Game.projectiles) {
                    if (!MarkExtras.marksBall(p)) continue;
                    const tempo = Math.hypot(p.vx, p.vy);
                    if (!tempo) continue;
                    const ziel = MarkExtras.naechsteGegner(p.x, p.y, SUCH_KREIS, null, 1)[0];
                    if (!ziel) continue;
                    const ist = Math.atan2(p.vy, p.vx);
                    const d = MarkExtras.winkelAbstand(MarkExtras.winkelVon(p.x, p.y, ziel), ist);
                    const neu = ist + clamp(d, -DREHRATE * dt, DREHRATE * dt);
                    p.vx = Math.cos(neu) * tempo;
                    p.vy = Math.sin(neu) * tempo;
                }
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const p of Game.projectiles) {
                    if (!MarkExtras.marksBall(p)) continue;
                    const s = camera.worldToScreen(p.x, p.y);
                    if (!MarkExtras.sichtbar(s)) continue;
                    const w = Math.atan2(p.vy, p.vx);
                    Art.sparkle(ctx, s.x + Math.cos(w) * 9, s.y + Math.sin(w) * 9, 2, '#8fe8ff', 0.9);
                    Art.ring(ctx, s.x, s.y, (p.radius || 5) + 2.5 + Math.sin(Art.time * 14 + p.x) * 0.7,
                        'rgba(143,232,255,0.55)', 1.2, 0.7);
                }
            });
        },
    });
})();

// ── mark20 Dreifach-Bumm: jeder dritte Wurf knallt wie der Knallball ──
(() => {
    registerUpgrade({
        id: 'mark20', figur: 'mark', name: 'Dreifach-Bumm', emoji: '💣',
        text: 'Jeder dritte Wurf von Mark ist eine Bombe: er knallt beim Aufprall.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let wuerfe = 0;
            c.player.hooks.onThrow.push(p => {
                wuerfe++;
                if (wuerfe % 3 !== 0) return;
                // Die Bombe sitzt am Zerleger-Wurf: die Splitter erben das boom-Merkmal
                // und der Knall selbst läuft über die Engine (js/main.js, Knallball).
                p.boom = true;
                p._bumm = true;
                FX.burst(p.x, p.y, ['#8f98ad', '#ffd23f'], 5, 60, 0.35, { kind: 'smoke', size: 4 });
            });
            c.game.roundHooks.onUpdate.push(dt => {
                // neutrale Sammel-Marke: nur Bomben-Baelle (boom) bekommen den sichtbaren Kranz
                for (const p of MarkExtras.frischeBaelle('_bummGesehen')) {
                    if (p.boom) p._bumm = true;
                }
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const p of Game.projectiles) {
                    if (!p._bumm || !MarkExtras.marksBall(p)) continue;
                    const s = camera.worldToScreen(p.x, p.y);
                    if (!MarkExtras.sichtbar(s)) continue;
                    // dunkler Bombenkranz mit Zündfunke
                    ctx.save();
                    ctx.strokeStyle = 'rgba(60,50,70,0.85)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, (p.radius || 5) + 2.5, 0, TAU);
                    ctx.stroke();
                    ctx.restore();
                    Art.sparkle(ctx, s.x + 3, s.y - (p.radius || 5) - 4, 1.8 + Math.sin(Art.time * 16) * 0.5, '#ffd23f', 0.95);
                }
            });
        },
    });
})();

// ── mark21 Geisterbrille: Truhen und Schlüsselträger leuchten auf der Karte ──
(() => {
    const RAND_ABSTAND = 16;   // px Randabstand der Pfeile außerhalb der Ansicht

    registerUpgrade({
        id: 'mark21', figur: 'mark', name: 'Geisterbrille', emoji: '👓',
        text: 'Die Geisterbrille zeigt dir Truhen und den Träger des Schlüssels auch über den Rand hinaus.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            function amRand(x, y) {
                const r = RAND_ABSTAND + 10;
                const ax = clamp(x, r, Game.viewW - r);
                const ay = clamp(y, r, Game.viewH - r);
                return { x: ax, y: ay, aussen: ax !== x || ay !== y };
            }
            function truhenIcon(ctx, x, y, g) {
                ctx.save();
                ctx.globalAlpha = 0.55 + 0.4 * g;
                ctx.fillStyle = '#c98a3a';
                ctx.fillRect(x - 6, y - 4, 12, 8);
                ctx.fillStyle = '#ffd23f';
                ctx.fillRect(x - 6, y - 6, 12, 3);
                ctx.fillStyle = '#7a4a1c';
                ctx.fillRect(x - 1, y - 3, 2, 6);
                ctx.restore();
            }
            function schluesselIcon(ctx, x, y, g) {
                ctx.save();
                ctx.globalAlpha = 0.55 + 0.4 * g;
                ctx.fillStyle = '#ffd23f';
                ctx.beginPath();
                ctx.arc(x - 3, y, 3.4, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#0e0b1e';
                ctx.beginPath();
                ctx.arc(x - 3, y, 1.4, 0, TAU);
                ctx.fill();
                ctx.fillStyle = '#ffd23f';
                ctx.fillRect(x, y - 1, 7, 2);
                ctx.fillRect(x + 4, y + 1, 1.6, 3);
                ctx.fillRect(x + 6.4, y + 1, 1.6, 3);
                ctx.restore();
            }
            function zeiger(ctx, ziel, icon) {
                const p = amRand(ziel.x, ziel.y);
                const g = 0.55 + 0.45 * Math.sin(Art.time * 4);
                if (p.aussen) {
                    // Pfeil am Rand, auf das Ziel zeigen (Fallback nur bei exakt gleichem Punkt)
                    const dx = ziel.x - p.x, dy = ziel.y - p.y;
                    const w = (dx !== 0 || dy !== 0)
                        ? Math.atan2(dy, dx)
                        : Math.atan2(Game.viewH / 2 - p.y, Game.viewW / 2 - p.x);
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(w);
                    ctx.globalAlpha = 0.5 + 0.4 * g;
                    ctx.fillStyle = '#bfe9ff';
                    ctx.beginPath();
                    ctx.moveTo(10, 0);
                    ctx.lineTo(-4, -6);
                    ctx.lineTo(-4, 6);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                    icon(ctx, p.x - Math.cos(w) * 14, p.y - Math.sin(w) * 14, g);
                } else {
                    Art.glow(ctx, p.x, p.y, 13, 'rgba(191,233,255,0.5)', 0.5);
                    icon(ctx, p.x, p.y, g);
                }
            }
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                const p = Game.player;
                if (p.dead) return;
                for (const chest of Game.chests) {
                    if (chest.opened && chest.itemCollected) continue;
                    const s = camera.worldToScreen(chest.x + chest.w / 2, chest.y - 12);
                    zeiger(ctx, s, truhenIcon);
                }
                for (const e of Game.enemies) {
                    if (!e || e.dead || !e.isKeyGhost) continue;
                    const s = camera.worldToScreen(e.centerX(), e.y - 14);
                    zeiger(ctx, s, schluesselIcon);
                }
            });
            c.player.hooks.onDraw.push(ctx => {
                // die Brille selbst: zwei Geistergläser vor Marks Augen
                const p = Game.player, cam = Game.camera;
                if (!cam || p.dead) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + 5);
                if (!MarkExtras.sichtbar(s)) return;
                ctx.save();
                ctx.globalAlpha = 0.8;
                ctx.strokeStyle = '#bfe9ff';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.arc(s.x - 3.4, s.y, 2.8, 0, TAU);
                ctx.arc(s.x + 3.4, s.y, 2.8, 0, TAU);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(s.x - 0.7, s.y);
                ctx.lineTo(s.x + 0.7, s.y);
                ctx.stroke();
                ctx.restore();
            });
        },
    });
})();

// ── mark22 Mutkappe: mit wenig Leben trifft Mark deutlich härter ──
(() => {
    const MUT_BEI = 0.4;    // unter 40 % Leben gilt Mark als mutig
    const ANTHEIL = 0.5;    // ein halber Wurf-/Schlag-Schaden extra

    registerUpgrade({
        id: 'mark22', figur: 'mark', name: 'Mutkappe', emoji: '🦁',
        text: 'Hat Mark wenig Leben, wächst sein Mut: dann trifft er richtig hart.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            const mutig = () => {
                const p = Game.player;
                return !!p && !p.dead && p.hp > 0 && p.hp <= p.maxHp * MUT_BEI;
            };
            c.player.hooks.onProjectileHit.push((e, p) => {
                if (!mutig() || !MarkExtras.marksBall(p)) return;
                const extra = Math.max(1, Math.round(p.damage * ANTHEIL));
                e.takeDamage(extra, MarkExtras.winkelVon(p.x, p.y, e), 50);
                FX.text(e.centerX(), e.y - 10, 'MUT!' , '#ff6b3d', 10);
                FX.burst(e.centerX(), e.centerY(), ['#ff6b3d', '#ffd23f'], 5, 90, 0.35, { kind: 'spark' });
            });
            c.player.hooks.onMeleeHit.push((e, schaden) => {
                if (!mutig()) return;
                const extra = Math.max(1, Math.round(schaden * ANTHEIL));
                e.takeDamage(extra, MarkExtras.winkelVon(Game.player.x + Game.player.w / 2, Game.player.y + Game.player.h / 2, e), 50);
                FX.text(e.centerX(), e.y - 10, 'MUT!', '#ff6b3d', 10);
            });
            c.player.hooks.onDraw.push(ctx => {
                const p = Game.player, cam = Game.camera;
                if (!cam || p.dead) return;
                const s = cam.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
                if (!MarkExtras.sichtbar(s)) return;
                if (!mutig()) return;
                // Mut-Aura: flackernder Flammsaum um Mark
                ctx.save();
                ctx.globalAlpha = 0.55 + 0.25 * Math.sin(Art.time * 9);
                ctx.strokeStyle = '#ff6b3d';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 15 + Math.sin(Art.time * 7) * 1.4, 0, TAU);
                ctx.stroke();
                ctx.restore();
                Art.sparkle(ctx, s.x - 10, s.y - 14, 2.4, '#ffd23f', 0.9);
                Art.sparkle(ctx, s.x + 11, s.y - 11, 2, '#ff6b3d', 0.9);
            });
        },
    });
})();

// ── mark23 Klebeball: getroffene Gegner werden langsam (Weltbelohnung 51) ──
(() => {
    const KLEBE_ZEIT = 2.2;    // Sekunden klebt der Ball
    const KLEBE_FAKTOR = 0.45; // Tempo in der Zeit

    registerUpgrade({
        id: 'mark23', figur: 'mark', name: 'Klebeball', emoji: '🍯',
        text: 'Klebriger Ball: getroffene Gegner sinken Tempo und bewegen sich ganz langsam.',
        where: 'Welt 51 gewinnen',
        welt: 51,
        istFrei: g => !!g.unlockedStickyBall,
        apply(c) {
            c.player.hooks.onProjectileHit.push((e, p) => {
                if (!MarkExtras.marksBall(p)) return;
                slowEnemy(e, KLEBE_ZEIT, KLEBE_FAKTOR);
                e._klebe = KLEBE_ZEIT;
                FX.burst(p.x, p.y, ['#9ce86a', '#dfffb0'], 7, 85, 0.45, { kind: 'smoke', size: 5 });
            });
            c.game.roundHooks.onUpdate.push(dt => {
                for (const e of Game.enemies) {
                    if (!e._klebe) continue;
                    e._klebe -= dt;
                    if (e._klebe <= 0) e._klebe = 0;
                    else if (Math.random() < 0.05) {
                        FX.burst(e.centerX(), e.y + e.h - 2, '#9ce86a', 1, 20, 0.5, { kind: 'smoke', size: 3 });
                    }
                }
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const e of Game.enemies) {
                    if (!e._klebe || e.dead) continue;
                    const s = camera.worldToScreen(e.centerX(), e.y + 2);
                    if (!MarkExtras.sichtbar(s)) continue;
                    ctx.save();
                    ctx.globalAlpha = Math.min(1, e._klebe);
                    ctx.fillStyle = '#9ce86a';
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, Math.min(e.w, e.h) * 0.36, 0, Math.PI);
                    ctx.fill();
                    const tropf = (Math.sin(Art.time * 3 + e.centerX()) + 1) / 2;
                    ctx.beginPath();
                    ctx.arc(s.x + 3, s.y + 3 + tropf * 4, 1.8, 0, TAU);
                    ctx.fill();
                    ctx.restore();
                }
            });
        },
    });
})();

// ── mark24 Sternenregen: alle 20 Sekunden fallen Sterne auf die Gegner ──
(() => {
    const ERSTER_NACH = 2;   // Sekunden bis zum ersten Sternenregen
    const AB_STAND = 20;     // Sekunden bis zum nächsten
    const MAX_ZIELE = 4;     // höchstens so viele Gegner werden beschossen
    const FALL_ZEIT = 0.5;   // Sekunden fällt ein Stern
    const FALL_HOHE = 110;   // px Starthöhe über dem Gegner
    const MENGE = 6;         // Leben, die ein Einschlag kostet
    const BOSS_MENGE = 3;    // Bosse stecken halben Schaden ein

    registerUpgrade({
        id: 'mark24', figur: 'mark', name: 'Sternenregen', emoji: '🌠',
        text: 'Alle 20 Sekunden regnet es Sterne: sie fallen auf die Gegner und knallen dort.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let warte = ERSTER_NACH;
            const sterne = [];   // { e, x, y, rest } - x/y ist der Einschlagpunkt
            c.game._mark2Sterne = sterne;   // für die Messung von außen zählbar
            function regen() {
                const lebend = (Game.enemies || []).filter(e => e && !e.dead);
                for (let i = lebend.length - 1; i > 0; i--) {
                    const k = (Math.random() * (i + 1)) | 0;
                    const t = lebend[i]; lebend[i] = lebend[k]; lebend[k] = t;
                }
                for (const e of lebend.slice(0, MAX_ZIELE)) {
                    sterne.push({ e, x: e.centerX(), y: e.centerY(), hoehe: FALL_HOHE * (0.8 + Math.random() * 0.4), rest: FALL_ZEIT });
                }
                if (sterne.length) HUD.toast('Sternenregen! 🌠', '#ffe066', 1.4);
            }
            c.game.roundHooks.onUpdate.push(dt => {
                warte -= dt;
                if (warte <= 0) { warte = AB_STAND; regen(); }
                for (let i = sterne.length - 1; i >= 0; i--) {
                    const s = sterne[i];
                    s.rest -= dt;
                    if (s.rest > 0) {
                        // der Einschlagpunkt folgt dem Gegner leicht, solange er lebt
                        if (s.e && !s.e.dead) {
                            s.x += (s.e.centerX() - s.x) * Math.min(1, 2.4 * dt);
                            s.y += (s.e.centerY() - s.y) * Math.min(1, 2.4 * dt);
                        }
                        continue;
                    }
                    sterne.splice(i, 1);
                    const menge = s.e && s.e.isBoss ? BOSS_MENGE : MENGE;
                    if (s.e && !s.e.dead) s.e.takeDamage(menge);
                    FX.burst(s.x, s.y, ['#ffe066', '#ffffff', '#ffd23f'], 12, 130, 0.5, { kind: 'star', size: 5, gravity: 140 });
                    FX.ring(s.x, s.y, '#ffe066', 30, 0.35, 3);
                    Sound.hit();
                    if (Game.camera && Game.camera.shake) Game.camera.shake(3, 0.14);
                }
            });
            c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
                for (const s of sterne) {
                    const auf = clamp(s.rest / FALL_ZEIT, 0, 1);
                    const treffer = camera.worldToScreen(s.x, s.y);
                    const start = camera.worldToScreen(s.x, s.y - s.hoehe);
                    if (!MarkExtras.sichtbar(treffer)) continue;
                    // Warnkreis am Einschlagpunkt
                    ctx.save();
                    ctx.globalAlpha = 0.35 + 0.35 * (1 - auf);
                    ctx.strokeStyle = '#ffe066';
                    ctx.lineWidth = 1.8;
                    ctx.setLineDash([5, 4]);
                    ctx.lineDashOffset = -Art.time * 18;
                    ctx.beginPath();
                    ctx.arc(treffer.x, treffer.y, 16 + (1 - auf) * 6, 0, TAU);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                    // fallender Stern mit Leuchtspur
                    const sy = start.y + (treffer.y - start.y) * (1 - auf);
                    Art.glow(ctx, start.x, sy, 12, '#ffe066', 0.6);
                    ctx.save();
                    ctx.globalAlpha = 0.9;
                    ctx.fillStyle = '#ffe066';
                    ctx.beginPath();
                    for (let k = 0; k < 5; k++) {
                        const a = -Math.PI / 2 + k * TAU / 5;
                        const a2 = a + TAU / 10;
                        ctx.lineTo(start.x + Math.cos(a) * 6, sy + Math.sin(a) * 6);
                        ctx.lineTo(start.x + Math.cos(a2) * 2.6, sy + Math.sin(a2) * 2.6);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                    Art.ring(ctx, start.x, sy + 8, 2.5, 'rgba(255,224,102,0.5)', 1.2, 0.7);
                }
            });
        },
    });
})();

// ── mark25 Schatten-Doppelgänger: ein Schatten-Mark kämpft zehn Sekunden mit ──
(() => {
    const KAMPF_ZEIT = 10;    // Sekunden kämpft der Schatten mit
    const PAUSE = 15;         // Sekunden, bis ein neuer Schatten kommt
    const REICHWEITE = 230;   // px: von hier beschießt der Schatten Gegner
    const ABSTAND = 70;       // px: so nah geht er ran
    const TEMPO = 130;        // px pro Sekunde
    const SCHUSS_PAUSE = 0.7; // Sekunden zwischen zwei Schatten Würfen

    class SchattenMark {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.w = 14;
            this.h = 20;
            this.schussCd = 0.5;
            this.phase = Math.random() * 10;
            this.noShadow = true;
        }
        centerX() { return this.x + this.w / 2; }
        centerY() { return this.y + this.h / 2; }
        update(dt, world, player, enemies) {
            this.schussCd -= dt;
            let ziel = null, besteD = 1e9;
            for (const e of enemies || []) {
                if (!e || e.dead) continue;
                const d = Math.hypot(e.centerX() - this.centerX(), e.centerY() - this.centerY());
                if (d < besteD) { besteD = d; ziel = e; }
            }
            if (!ziel) return;
            if (besteD > ABSTAND + 14) {
                const w = Math.atan2(ziel.centerY() - this.centerY(), ziel.centerX() - this.centerX());
                moveWithCollision(this, Math.cos(w) * TEMPO * dt, Math.sin(w) * TEMPO * dt, world);
            } else if (besteD < ABSTAND - 18) {
                const w = Math.atan2(this.centerY() - ziel.centerY(), this.centerX() - ziel.centerX());
                moveWithCollision(this, Math.cos(w) * TEMPO * 0.7 * dt, Math.sin(w) * TEMPO * 0.7 * dt, world);
            }
            if (this.schussCd <= 0 && besteD < REICHWEITE) {
                this.schussCd = SCHUSS_PAUSE;
                const w = Math.atan2(ziel.centerY() - this.centerY(), ziel.centerX() - this.centerX());
                const p = new Projectile(this.centerX(), this.centerY(),
                    Math.cos(w) * 330, Math.sin(w) * 330, 2, 'player', 70);
                p.shadowCaster = true;   // Regenbogen-Schattenspur wie beim Schatten-Werfer
                p.radius = 4;
                Game.projectiles.push(p);
                FX.burst(this.centerX(), this.centerY(), ['#c9b6ff', '#8fe8ff'], 3, 50, 0.3, { kind: 'spark' });
            }
        }
        draw(ctx, camera) {
            const s = camera.worldToScreen(this.x + this.w / 2, this.y + this.h / 2);
            const t = Art.time + this.phase;
            ctx.save();
            // schemenhafter Mark: dunkle Silhouette mit leuchtenden Augen
            ctx.globalAlpha = 0.78 + Math.sin(t * 5) * 0.08;
            ctx.fillStyle = '#241b3e';
            ctx.beginPath();
            ctx.ellipse(s.x, s.y + 2, 7, 10, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#171029';
            ctx.beginPath();
            ctx.arc(s.x, s.y - 9, 5.6, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#5a3f8f';
            ctx.fillRect(s.x - 6.4, s.y - 14, 12.8, 2.6);   // Kappe
            ctx.fillStyle = '#8fe8ff';
            ctx.fillRect(s.x - 3.2, s.y - 10, 2, 2);
            ctx.fillRect(s.x + 1.2, s.y - 10, 2, 2);
            ctx.restore();
            Art.glow(ctx, s.x, s.y, 16, 'rgba(120,90,190,0.45)', 0.5);
            // Restzeit über dem Kopf
            const q = clamp((this.helperTimer || 0) / KAMPF_ZEIT, 0, 1);
            if (q > 0) {
                ctx.save();
                ctx.strokeStyle = 'rgba(201,182,255,0.9)';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(s.x, s.y - 18, 5, -Math.PI / 2, -Math.PI / 2 + TAU * q);
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    registerUpgrade({
        id: 'mark25', figur: 'mark', name: 'Schatten-Doppelgänger', emoji: '👥',
        text: 'Ein Schatten-Mark taucht auf und kämpft zehn Sekunden lang an Marks Seite mit.',
        where: 'im Shop kaufen',
        istFrei: () => false,
        apply(c) {
            let aktiv = null;
            let warte = 0;
            function ruf() {
                const p = c.player;
                if (p.dead) return;
                aktiv = spawnHelper(SchattenMark, p.x - 20, p.y, KAMPF_ZEIT);
                if (!aktiv) return;
                aktiv._schatten = true;   // für die Messung von außen erkennbar
                FX.burst(aktiv.centerX(), aktiv.centerY(), ['#c9b6ff', '#241b3e', '#8fe8ff'], 12, 110, 0.5, { kind: 'smoke', size: 6 });
                FX.text(aktiv.centerX(), aktiv.y - 10, 'Schatten-Mark!', '#c9b6ff', 10);
            }
            c.game.roundHooks.onUpdate.push(dt => {
                if (aktiv) {
                    if (aktiv.helperTimer === undefined || aktiv.helperTimer <= 0 ||
                        !Game.companions || Game.companions.indexOf(aktiv) < 0) {
                        FX.burst(aktiv.centerX(), aktiv.centerY(), ['#c9b6ff', '#8fe8ff'], 8, 90, 0.45, { kind: 'smoke', size: 5 });
                        aktiv = null;
                        warte = PAUSE;
                    }
                } else {
                    warte -= dt;
                    if (warte <= 0) ruf();
                }
            });
        },
    });
})();
