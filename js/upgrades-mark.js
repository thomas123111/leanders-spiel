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
                    ctx.globalAlpha = clamp(b.rest / 0.2, 0, 1);
                    MarkExtras.blitz(ctx, a.x, a.y, q.x, q.y, Art.time + b.ax * 0.01);
                    ctx.globalAlpha = 1;
                }
            });
        },
    });
})();

// ── mark04 Bumerang-Ball: der Ball fliegt zurück und trifft dabei noch einmal ──
(() => {
    const WENDE_NACH = 0.45;         // Sekunden Hinflug, spätestens dann dreht der Ball um
    const WENDE_NACH_TREFFER = 0.13; // Sekunden nach einem Treffer, dann geht er heim
    const DREHRATE = 60;             // rad/s: die Kehre dauert fünf Hundertstel, der Rückweg liegt
                                     // fast auf dem Hinweg - dort liegt auch der zweite Treffer
    const DURCHSCHUSS = 2;           // Gegner, die ein Ball auf seinem Flug durchfliegen darf
    const FREIGABE_NACH = 0.22;      // Sekunden, dann darf derselbe Gegner erneut getroffen werden
                                     // (knapp ueber der Treffer-Schutzzeit der Gegner)
    const FLUG_DAUER = 1.6;          // Sekunden, länger bleibt ein Bumerang nicht in der Luft
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
                    if (b.lifetime < FLUG_DAUER) b.lifetime = FLUG_DAUER;
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
                // Der Ball stirbt beim Treffer nicht, sondern fliegt durch hindurch
                if (b.pierce < DURCHSCHUSS) b.pierce = DURCHSCHUSS;
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
    const SCHUB_KRAFT = 430;    // Wegschubsen beim Treffer

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
                knockBack(e, w, SCHUB_KRAFT);
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
                if (w && w.type === 'melee' && !w.swinging) schlagDa = false;
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
    const KLEIN_BEI = 12;     // Gegner mit so viel Leben oder weniger lässt der Sog greifen
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
