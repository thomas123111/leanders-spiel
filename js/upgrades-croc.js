// ── Upgrades für Schattenkrokodil (Datei des Schattenkrokodil-Auftrags) ──
// Hier trägt der Schattenkrokodil-Auftrag seine neuen Upgrades ein - nur in dieser Datei,
// der Figuren-Code (js/entities.js, Klasse ShadowCrocodile) wird nicht angefasst.
//
// So kommt ein neues Upgrade hinein (genau ein registerUpgrade-Aufruf pro Extra):
//
//   registerUpgrade({
//       id: 'meinUpgrade',            // eindeutig, englisch, kein bestehender Id-Dieb
//       figur: 'croc',                // fest: 'croc'
//       name: 'Mein Extra',           // erscheint im Menü „Waffen" und im Shop
//       text: 'Was das Extra tut.',   // ein Satz für die Karte
//       emoji: '🔥',
//       where: 'Welt 12 schaffen',    // Hinweis auf der gesperrten Karte
//       istFrei: g => g.maxWorldUnlocked >= 13,   // oder: g.unlockedMeinUpgrade
//       apply(c) {                    // c = { game, welt, player, juri, croc, panda }
//           // einmal beim Weltstart, NUR wenn dieses Extra gewählt wurde.
//           // Achtung: die eigene Figur kann in der Welt fehlen (c.croc ist dann null) -
//           // erst prüfen: if (!c.croc) return;
//           // Hier die Haken anmelden - sie wirken dann die ganze Runde:
//           c.croc.hooks.onUpdate.push(dt => { /* jeder Bild-Takt */ });
//           c.croc.hooks.onHit.push((gegner, schaden) => schaden);  // (Reserve; das Krokodil spuckt)
//           c.croc.hooks.onShoot.push(geschoss => { /* gerade gespuckt */ });
//           c.croc.hooks.onDamaged.push(menge => menge * 0.5); // Menge aendern (Zahl zurueckgeben)
//           c.croc.hooks.onDraw.push(ctx => { /* ueber dem Krokodil malen (Bildschirmmasse) */ });
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
//     der selbst companionShoot aufruft, loest sich damit immer wieder selbst - deshalb immer
//     erst pruefen (if (this._schon) return; this._schon = true; ... this._schon = false;),
//     sonst kappt das Geruest die Kette nach acht Runden (Meldung in der Konsole).
//
// Regeln: kein neuer Welt-Datei-Griff, keine APP_VERSION, kein ?v=. Pro Runde gilt
// genau EIN Extra - die Auswahl und das Kaufen im Shop übernimmt js/upgrades.js von selbst.

// ══════════════════════════════════════════════════════════════════════════
// ── Paket 1: die neuen Schattenkrokodil-Extras (Auftrag croc1, 18.10.2026) ──
// Alles läuft über die Haken aus js/upgrades.js; js/entities.js wird nicht angefasst.
// ══════════════════════════════════════════════════════════════════════════

const CROC_EIS_SEKUNDEN = 1.8;    // Eisspucke: Bosse kappt Enemy.freeze selbst auf 0,6 s (4 s Schonzeit)
const CROC_GIFT_SEKUNDEN = 4;     // Giftspucke: Gift brennt nach und zieht Leben ab
const CROC_GIFT_TREFFER = 1;      // Leben je Gift-Tropfen (1/4 Herz), Takt wie beim Panda-Freund

// Kurze Zeichenblöcke über der Welt (Blitzlinien, Schwung, Rolle, Schattenpfütze).
// Jede Wirkung bekommt ihre eigene Liste; sie verjährt von selbst und ist mit der Runde weg.
class CrocEffekte {
    constructor() { this.dinge = []; }
    _rein(ding) { if (this.dinge.length < 40) this.dinge.push(ding); }
    blitz(x1, y1, x2, y2, farbe) {
        const pkt = [{ x: x1, y: y1 }];
        const n = 4;
        const dx = (x2 - x1) / n, dy = (y2 - y1) / n;
        const senk = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        for (let i = 1; i < n; i++) {
            const aus = (i % 2 ? 1 : -1) * (4 + Math.random() * 5);
            pkt.push({ x: x1 + dx * i + Math.cos(senk) * aus, y: y1 + dy * i + Math.sin(senk) * aus });
        }
        pkt.push({ x: x2, y: y2 });
        this._rein({ art: 'blitz', pkt, farbe: farbe || '#ffe86b', t: 0, lived: 0.22 });
    }
    schwung(x, y, radius, dreh) { this._rein({ art: 'schwung', x, y, radius, dreh, t: 0, lived: 0.32 }); }
    rolle(x, y, radius) { this._rein({ art: 'rolle', x, y, radius, t: 0, lived: 0.2 }); }
    update(dt) {
        for (let i = this.dinge.length - 1; i >= 0; i--) {
            const d = this.dinge[i];
            d.t += dt;
            if (d.t >= d.lived) this.dinge.splice(i, 1);
        }
    }
    draw(ctx, camera) {
        if (!ctx || !camera) return;
        for (const d of this.dinge) {
            const k = 1 - d.t / d.lived;
            ctx.save();
            ctx.globalAlpha = Math.max(0, k);
            if (d.art === 'blitz') {
                ctx.strokeStyle = d.farbe;
                ctx.lineWidth = 2.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = 0; i < d.pkt.length; i++) {
                    const p = camera.worldToScreen(d.pkt[i].x, d.pkt[i].y);
                    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
                }
                ctx.stroke();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.stroke();
            } else if (d.art === 'schwung') {
                const p = camera.worldToScreen(d.x, d.y);
                const fort = d.t / d.lived;
                ctx.strokeStyle = '#6bf2a0';
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(p.x, p.y, d.radius * (0.55 + fort * 0.5), d.dreh - 1.5 + fort * 2.4, d.dreh + 0.6 + fort * 2.4);
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            } else if (d.art === 'rolle') {
                const p = camera.worldToScreen(d.x, d.y);
                ctx.strokeStyle = '#b28cff';
                ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    const a = d.t * 22 + i * 2.1;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, d.radius * (0.7 + i * 0.16), a, a + 1.5);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }
    }
}

// Gemeinsame Helfer der Krokodil-Extras
const CrocUp = {
    // Kann das Krokodil gerade handeln (nicht tot, benommen, eingeschlafen, k.o.)?
    handlungsfahig(k) {
        return !!k && !k.dead && !(k.koTimer > 0) && !(k.stunTimer > 0) && !(k.sleepTimer > 0);
    },
    // Nächster Gegner im Umkreis; `linie` verlangt ausserdem eine freie Schusslinie
    ziel(k, gegner, radius, linie) {
        const cx = k.centerX(), cy = k.centerY();
        let best = null, bester = radius;
        for (const e of (gegner || [])) {
            if (!e || e.dead) continue;
            const d = Math.hypot(e.centerX() - cx, e.centerY() - cy);
            if (d > bester) continue;
            if (linie && Game.world && !Juri.lineClear(Game.world, cx, cy, e.centerX(), e.centerY())) continue;
            best = e; bester = d;
        }
        return best;
    },
    // Nächster Gegner zu einem freien Punkt; `ausser` sind Gegner, die nicht gewählt werden dürfen
    zielVon(x, y, gegner, radius, ausser, sichtbar) {
        let best = null, bester = radius;
        for (const e of (gegner || [])) {
            if (!e || e.dead || (ausser && ausser.indexOf(e) >= 0)) continue;
            if (sichtbar && !sichtbar(e)) continue;
            const d = Math.hypot(e.centerX() - x, e.centerY() - y);
            if (d > bester) continue;
            best = e; bester = d;
        }
        return best;
    },
    // Ob ein Geschoss einen Gegner berührt - dieselbe Regel wie der Einschlag in js/main.js
    beruehrt(x, y, radius, gegner, extra) {
        let best = null, bester = Infinity;
        for (const e of (gegner || [])) {
            if (!e || e.dead) continue;
            const d = Math.hypot(e.centerX() - x, e.centerY() - y);
            if (d > radius + Math.max(e.w, e.h) / 2 + (extra || 0) || d >= bester) continue;
            best = e; bester = d;
        }
        return best;
    },
    // Freier Punkt im Abstand um eine Stelle (Auftauchen, Pfütze) - oder null
    freierPunktUm(welt, x, y, abstand) {
        const frei = (px, py) => !!welt && typeof welt.isWall === 'function' && !welt.isWall(px, py);
        const dreh = Math.random() * Math.PI;
        for (let i = 0; i < 8; i++) {
            const a = dreh + i * Math.PI / 4;
            const px = x + Math.cos(a) * abstand, py = y + Math.sin(a) * abstand;
            if (frei(px, py)) return { x: px, y: py };
        }
        return frei(x, y) ? { x: x, y: y } : null;
    },
    // Schlag um einen Punkt: Flächenschaden, Rundherum wird weggeschubst (Bosse stecken das besser weg)
    schlag(x, y, radius, schaden, kraft, hinweis) {
        const k = kraft || 220;
        const treffer = areaDamage(x, y, radius, schaden);
        for (const e of (Game.enemies || [])) {
            if (!e || e.dead) continue;
            const dx = e.centerX() - x, dy = e.centerY() - y;
            if (Math.hypot(dx, dy) > radius + Math.max(e.w, e.h) / 2) continue;
            knockBack(e, Math.atan2(dy, dx), e.isBoss ? Math.round(k * 0.3) : k);
        }
        if (typeof FX !== 'undefined') {
            FX.ring(x, y, '#8a5cff', radius + 6, 0.4, 3);
            FX.burst(x, y, ['#b8ff9a', '#8a5cff', '#ffffff'], 8, 120, 0.45, { kind: 'spark' });
            if (hinweis) FX.text(x, y - 16, hinweis, '#b8ff9a', 11, { life: 1.1 });
        }
        return treffer;
    },
    // Kleines Symbol über dem Krokodil: welches Extra gerade an ist
    abzeichen(ctx, k, emoji, farbe) {
        if (!ctx || !Game.camera || !emoji) return;
        const p = Game.camera.worldToScreen(k.x, k.y);
        const x = p.x + k.w / 2, y = p.y - 24;
        ctx.save();
        ctx.globalAlpha = 0.92;
        Art.body(ctx, x, y, 8, 8, 'rgba(16,10,34,0.78)', { outline: farbe || '#8a5cff', lineWidth: 1.4 });
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, x, y + 0.5);
        ctx.restore();
    },
};

// ── croc01 Eisspucke: die Spucke friert Gegner ein ──
registerUpgrade({
    id: 'croc01', figur: 'croc', name: 'Eisspucke', emoji: '❄️',
    text: 'Getroffene Gegner frieren ein und können sich nicht bewegen - Bosse halten nur kurz dicht.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const unterwegs = [];
        k.hooks.onShoot.push(p => {
            p.freeze = CROC_EIS_SEKUNDEN;   // Optik und Freeze-Regel sitzen schon in js/weapons.js und js/main.js
            unterwegs.push(p);
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '❄️', '#9fe6ff'));
        c.game.roundHooks.onUpdate.push(dt => {
            for (let i = unterwegs.length - 1; i >= 0; i--) if (unterwegs[i].dead) unterwegs.splice(i, 1);
        });
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            // Reif um die eiskalte Kugel
            for (const p of unterwegs) {
                const s = camera.worldToScreen(p.x, p.y);
                Art.glow(ctx, s.x, s.y, (p.radius || 4) * 3.4, '#c9f2ff', 0.55);
                Art.sparkle(ctx, s.x, s.y, (p.radius || 4) * 1.6, '#eafcff', 0.9);
            }
        });
    },
});

// ── croc02 Giftspucke: die Spucke vergiftet Gegner (Weltbelohnung 53, nicht im Shop) ──
registerUpgrade({
    id: 'croc02', figur: 'croc', name: 'Giftspucke', emoji: '🧪',
    text: 'Getroffene Gegner sind vergiftet und verlieren über ein paar Sekunden Leben.',
    where: 'Welt 53 schaffen',   // die Shop-Sperre ueber das Feld `welt` setzt der parallele Auftrag
    welt: 53,
    istFrei: g => !!g.unlockedPoisonSpit,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const unterwegs = [];
        k.hooks.onShoot.push(p => {
            // Gift-Tropfen wie beim Panda-Freund: js/main.js ruft PandaBuddy.poisonEnemy für dieses Geschoss auf
            p.crocSpit = false;
            p.poison = true;
            p.pandaPlant = true;
            p.poisonSeconds = CROC_GIFT_SEKUNDEN;
            p.poisonDamage = CROC_GIFT_TREFFER;
            unterwegs.push(p);
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🧪', '#7dff5a'));
        c.game.roundHooks.onUpdate.push(dt => {
            // Das Gift zählt sonst nur, wenn der Panda-Freund mitspielt (js/pandafreund.js ruft den
            // Tick allein in seinem Update auf) - ohne ihn übernimmt diese Runde das Nachzählen.
            if (typeof PandaBuddy !== 'undefined' &&
                !(Game.companions || []).some(cf => cf instanceof PandaBuddy)) {
                PandaBuddy.poisonTick(Game.enemies, dt);
            }
            for (let i = unterwegs.length - 1; i >= 0; i--) if (unterwegs[i].dead) unterwegs.splice(i, 1);
        });
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            // giftige Bläschen steigen aus der Spucke auf
            for (const p of unterwegs) {
                const s = camera.worldToScreen(p.x, p.y);
                Art.glow(ctx, s.x, s.y, (p.radius || 4) * 3.2, '#5dff3a', 0.5);
                for (let i = 0; i < 3; i++) {
                    const t = (Art.time * 2.4 + i * 0.33 + p.age) % 1;
                    Art.body(ctx, s.x + Math.sin(t * 6 + i) * 3, s.y - t * 9, 1.3, 1.3, 'rgba(180,255,140,0.8)');
                }
            }
        });
    },
});

// ── croc03 Blitzspucke: die Spucke springt auf weitere Gegner über ──
registerUpgrade({
    id: 'croc03', figur: 'croc', name: 'Blitzspucke', emoji: '⚡',
    text: 'Trifft die Spucke einen Gegner, springt ein Blitz auf die Gegner daneben über.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const effekte = new CrocEffekte();
        const unterwegs = [];
        const SPRUNGE = 2;          // höchstens so viele Gegner neben dem getroffenen
        const WEITE = 115;          // wie weit der Blitz hüpfen darf
        k.hooks.onShoot.push(p => unterwegs.push({ p: p, x: p.x, y: p.y }));
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '⚡', '#ffe86b'));
        // Sprungfolge von einem getroffenen Gegner weg nach außen
        const springe = (von, schaden) => {
            const getroffen = [von];
            for (let s = 0; s < SPRUNGE; s++) {
                const start = von;
                const naechster = CrocUp.zielVon(von.centerX(), von.centerY(), Game.enemies, WEITE, getroffen,
                    e => !Game.world || Juri.lineClear(Game.world, start.centerX(), start.centerY(),
                        e.centerX(), e.centerY()));
                if (!naechster) break;
                getroffen.push(naechster);
                effekte.blitz(von.centerX(), von.centerY(), naechster.centerX(), naechster.centerY(), '#ffe86b');
                naechster.takeDamage(Math.max(2, schaden - 1),
                    Math.atan2(naechster.centerY() - von.centerY(), naechster.centerX() - von.centerX()),
                    naechster.isBoss ? 40 : 130);
                von = naechster;
            }
        };
        c.game.roundHooks.onUpdate.push(dt => {
            effekte.update(dt);
            for (let i = unterwegs.length - 1; i >= 0; i--) {
                const e = unterwegs[i];
                const p = e.p;
                if (!p.dead) {
                    // noch unterwegs: letzte lebende Position merken, Einschlag selbst erkennen
                    const treffer = CrocUp.beruehrt(p.x, p.y, p.radius || 4, Game.enemies, 0);
                    if (treffer) {
                        unterwegs.splice(i, 1);
                        springe(treffer, p.damage);
                    } else {
                        e.x = p.x; e.y = p.y;
                    }
                    continue;
                }
                // von der Engine gestoppt (Treffer, Wand oder abgelaufen): von der letzten
                // lebenden Position aus blitzen - das ist die Stelle, an der die Kugel ankam
                unterwegs.splice(i, 1);
                const getroffener = CrocUp.beruehrt(e.x, e.y, p.radius || 4, Game.enemies, 6);
                if (getroffener) springe(getroffener, p.damage);
            }
        });
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => effekte.draw(ctx, camera));
    },
});

// ── croc04 Dreifachspucke: das Krokodil spuckt drei auf einmal ──
registerUpgrade({
    id: 'croc04', figur: 'croc', name: 'Dreifachspucke', emoji: '🔵',
    text: 'Das Krokodil spuckt drei Schattenkugeln auf einmal: eine gerade und zwei schräg.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        k.hooks.onShoot.push(p => {
            // eigene Schattenkugeln direkt einreihen (kein companionShoot: sonst lief der eigene Haken wieder)
            const basis = Math.atan2(p.vy, p.vx);
            const tempo = Math.hypot(p.vx, p.vy) || 250;
            for (const seite of [-1, 1]) {
                const a = basis + seite * 0.3;
                const extra = new Projectile(p.x, p.y, Math.cos(a) * tempo, Math.sin(a) * tempo,
                    Math.max(2, p.damage - 1), 'player', 80);
                extra.radius = 4;
                extra.crocSpit = true;
                Game.projectiles.push(extra);
                if (typeof FX !== 'undefined') {
                    FX.burst(extra.x, extra.y, '#b28cff', 3, 60, 0.3, { kind: 'spark' });
                }
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🔵', '#8a5cff'));
    },
});

// ── croc05 Dauerspucke: das Krokodil spuckt doppelt so schnell ──
registerUpgrade({
    id: 'croc05', figur: 'croc', name: 'Dauerspucke', emoji: '💨',
    text: 'Das Krokodil spuckt doppelt so schnell hintereinander.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        k.shootCooldown = Math.max(0.25, (k.shootCooldown || 1.2) * 0.5);
        if (k.shootTimer > k.shootCooldown) k.shootTimer = k.shootCooldown;
        let wehen = 0;
        k.hooks.onUpdate.push(dt => {
            if (!CrocUp.handlungsfahig(k)) return;
            wehen -= dt;
            if (wehen > 0 || !CrocUp.ziel(k, Game.enemies, 250, true)) return;
            wehen = 0.25;
            if (typeof FX !== 'undefined') {
                FX.burst(k.centerX() + Math.cos(k.facingAngle) * 8, k.centerY() + Math.sin(k.facingAngle) * 8,
                    'rgba(200,225,255,0.85)', 2, 55, 0.3, { kind: 'smoke', size: 3 });
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '💨', '#cfe6ff'));
    },
});

// ── croc06 Schattentauchen: taucht in den Schatten und kommt unter einem Gegner hoch ──
registerUpgrade({
    id: 'croc06', figur: 'croc', name: 'Schattentauchen', emoji: '🕳️',
    text: 'Das Krokodil taucht in den Schatten und kommt unter dem nächsten Gegner wieder hoch.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const effekte = new CrocEffekte();
        let bereit = 3;
        k.hooks.onUpdate.push(dt => {
            effekte.update(dt);
            if (!CrocUp.handlungsfahig(k)) return;
            bereit -= dt;
            if (bereit > 0) return;
            const ziel = CrocUp.ziel(k, Game.enemies, 340, false);
            if (!ziel) return;
            const punkt = CrocUp.freierPunktUm(Game.world, ziel.centerX(), ziel.centerY(), 18);
            if (!punkt) return;
            bereit = 7;   // Abklingzeit, sonst steht jeder Gegner dauerhaft unter Beschuss
            Juri.poof(k.centerX(), k.centerY(), true);
            k.x = punkt.x - k.w / 2; k.y = punkt.y - k.h / 2;
            k.stuckTimer = 0;
            effekte.schwung(punkt.x, punkt.y, 26, 0);
            effekte.schwung(punkt.x, punkt.y, 13, 0.5);
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🕳️', '#8a5cff'));
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => effekte.draw(ctx, camera));
    },
});

// ── croc07 Schnappbiss: ein kräftiger Biss gegen Gegner in der Nähe ──
registerUpgrade({
    id: 'croc07', figur: 'croc', name: 'Schnappbiss', emoji: '🦷',
    text: 'Von Zeit zu Zeit schnappt das Krokodil kräftig zu und haut den nächsten Gegner weg.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        let bereit = 2;
        k.hooks.onUpdate.push(dt => {
            if (!CrocUp.handlungsfahig(k)) return;
            bereit -= dt;
            if (bereit > 0) return;
            const ziel = CrocUp.ziel(k, Game.enemies, 46, false);
            if (!ziel) return;
            bereit = 3.2;                    // Abklingzeit
            k.mouthTimer = 0.35;             // das Maul geht sichtbar auf
            if (typeof FX !== 'undefined') {
                FX.burst(k.centerX() + Math.cos(k.facingAngle) * 12,
                    k.centerY() + Math.sin(k.facingAngle) * 12, '#ffffff', 6, 90, 0.3, { kind: 'spark' });
            }
            CrocUp.schlag(ziel.centerX(), ziel.centerY(), 13, 9, 280, 'Schnapp!');
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🦷', '#ffd23f'));
    },
});

// ── croc08 Schwanzpeitsche: ein Schwanzschlag haut Gegner rundherum um ──
registerUpgrade({
    id: 'croc08', figur: 'croc', name: 'Schwanzpeitsche', emoji: '🌀',
    text: 'Das Krokodil schlägt mit dem Schwanz: alle Gegner rundherum fallen um.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const effekte = new CrocEffekte();
        const KREIS = 44;
        let bereit = 2.5;
        k.hooks.onUpdate.push(dt => {
            effekte.update(dt);
            if (!CrocUp.handlungsfahig(k)) return;
            bereit -= dt;
            if (bereit > 0) return;
            if (!CrocUp.ziel(k, Game.enemies, KREIS, false)) return;
            bereit = 5;                      // Abklingzeit
            effekte.schwung(k.centerX(), k.centerY(), KREIS, k.facingAngle);
            CrocUp.schlag(k.centerX(), k.centerY(), KREIS - 8, 5, 320, 'Schwanzpeitsche!');
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🌀', '#6bf2a0'));
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => effekte.draw(ctx, camera));
    },
});

// ── croc09 Krokodilrolle: es rollt sich und walzt durch Gegner ──
registerUpgrade({
    id: 'croc09', figur: 'croc', name: 'Krokodilrolle', emoji: '💫',
    text: 'Das Krokodil rollt sich wie ein Ball und walzt eine Strecke weit durch die Gegner.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const effekte = new CrocEffekte();
        let bereit = 2, rollt = 0, winkel = 0;
        const getroffen = [];
        const CROC_ROLLE_TAKT = 250, CROC_ROLLE_DAUER = 0.45;
        const CROC_ROLLE_STRECKE = CROC_ROLLE_TAKT * CROC_ROLLE_DAUER;
        k.hooks.onUpdate.push(dt => {
            effekte.update(dt);
            if (!CrocUp.handlungsfahig(k)) { rollt = 0; return; }
            if (rollt > 0) {
                rollt -= dt;
                Juri.step(k, Math.cos(winkel) * CROC_ROLLE_TAKT * dt,
                    Math.sin(winkel) * CROC_ROLLE_TAKT * dt, Game.world);
                effekte.rolle(k.centerX(), k.centerY(), 18);
                for (const e of (Game.enemies || [])) {
                    if (!e || e.dead || getroffen.indexOf(e) >= 0) continue;
                    if (Math.hypot(e.centerX() - k.centerX(), e.centerY() - k.centerY()) >
                        18 + Math.max(e.w, e.h) / 2) continue;
                    getroffen.push(e);
                    e.takeDamage(7, winkel, e.isBoss ? 70 : 260);
                    if (typeof FX !== 'undefined') {
                        FX.burst(e.centerX(), e.centerY(), '#cfe6ff', 5, 90, 0.35, { kind: 'smoke', size: 4 });
                    }
                }
                if (rollt <= 0) { bereit = 6; getroffen.length = 0; }
                return;
            }
            bereit -= dt;
            if (bereit > 0) return;
            const ziel = CrocUp.ziel(k, Game.enemies, 210, true);
            if (!ziel) return;
            winkel = Math.atan2(ziel.centerY() - k.centerY(), ziel.centerX() - k.centerX());
            // nur so weit losrollen, wie die Strecke wirklich frei ist (sonst rollt es gegen die Wand)
            let dauer = 0;
            for (const Teil of [1, 0.5]) {
                const s = CROC_ROLLE_STRECKE * Teil;
                const wx = k.centerX() + Math.cos(winkel) * s, wy = k.centerY() + Math.sin(winkel) * s;
                dauer = (!Game.world || Juri.lineClear(Game.world, k.centerX(), k.centerY(), wx, wy))
                    ? CROC_ROLLE_DAUER * Teil : 0;
                if (dauer > 0) break;
            }
            if (dauer <= 0) return;
            rollt = dauer;
            getroffen.length = 0;
            k.facingAngle = winkel;
            if (typeof FX !== 'undefined') FX.text(k.centerX(), k.centerY() - 18, 'Krokodilrolle!', '#b28cff', 11, { life: 1.1 });
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '💫', '#b28cff'));
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => effekte.draw(ctx, camera));
    },
});

// ── croc10 Sumpfpfützen: Gegner in seinen Pfützen werden langsam ──
class Sumpfpuetze {
    constructor(x, y, radius) {
        this.x = x; this.y = y; this.radius = radius;
        this.leben = 9; this.alter = 0;
        this.tropfen = [];
        for (let i = 0; i < 4; i++) {
            this.tropfen.push({ w: Math.random() * TAU, a: 0.3 + Math.random() * 0.55, r: 0.4 + Math.random() * 0.35 });
        }
    }
    update(dt) { this.alter += dt; this.leben -= dt; return this.leben > 0; }
    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        const verblasst = Math.min(1, this.leben / 1.2);
        ctx.save();
        ctx.globalAlpha = 0.62 * verblasst;
        ctx.fillStyle = '#2f6b3a';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 0.55, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.85 * verblasst;
        ctx.fillStyle = '#3f8f4a';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 0.78, r * 0.42, 0, 0, TAU);
        ctx.fill();
        // Bläschen und Kreise auf dem Wasser
        for (const t of this.tropfen) {
            const ph = (this.alter * 0.8 + t.a) % 1;
            Art.ring(ctx, p.x + Math.cos(t.w) * r * 0.5 * t.r, p.y + Math.sin(t.w) * r * 0.28 * t.r,
                1 + ph * 5, 'rgba(190,255,180,0.7)', 1, 0.7 * (1 - ph));
        }
        ctx.restore();
    }
}

registerUpgrade({
    id: 'croc10', figur: 'croc', name: 'Sumpfpfützen', emoji: '💧',
    text: 'Das Krokodil hinterlässt Sumpfpfützen: Gegner darin kommen nur noch langsam voran.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const pfuetzen = [];
        let bereit = 1;
        k.hooks.onUpdate.push(dt => {
            for (let i = pfuetzen.length - 1; i >= 0; i--) if (!pfuetzen[i].update(dt)) pfuetzen.splice(i, 1);
            // Gegner in einer Pfütze werden langsam (Bosse bleiben etwas flinker)
            for (const pf of pfuetzen) {
                for (const e of (Game.enemies || [])) {
                    if (!e || e.dead) continue;
                    if (Math.hypot(e.centerX() - pf.x, e.centerY() - pf.y) > pf.radius * 0.9) continue;
                    slowEnemy(e, 0.3, e.isBoss ? 0.72 : 0.45);
                }
            }
            if (!CrocUp.handlungsfahig(k)) return;
            bereit -= dt;
            if (bereit > 0) return;
            const punkt = CrocUp.freierPunktUm(Game.world, k.centerX(), k.centerY() + 6, 12);
            if (!punkt) return;
            bereit = 4.5;                    // Abklingzeit zwischen zwei Pfützen
            pfuetzen.push(new Sumpfpuetze(punkt.x, punkt.y, 36));
            if (typeof FX !== 'undefined') {
                FX.burst(punkt.x, punkt.y, ['#3f8f4a', '#b8ff9a'], 7, 70, 0.45, { kind: 'bubble' });
                FX.text(punkt.x, punkt.y - 16, 'Sumpfpfütze!', '#8fe07a', 10, { life: 1 });
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '💧', '#8fe07a'));
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            // Pfützen liegen auf dem Boden: vor den Figuren wäre schöner, aber die Haken-Ebene liegt darüber -
            // deshalb sehr durchscheinend gezeichnet, damit alles dahinter zu sehen bleibt.
            for (const pf of pfuetzen) pf.draw(ctx, camera);
        });
    },
});

// ── croc12 Riesen-Krokodil: es wird größer und stärker ──
registerUpgrade({
    id: 'croc12', figur: 'croc', name: 'Riesen-Krokodil', emoji: '🦖',
    text: 'Das Krokodil wird riesengroß und trifft mit seiner Spucke viel härter.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        k.damage = 6;                        // stärker: die Spucke trifft härter
        // Größer: die eigene Zeichnung wird um das Krokodil herum skaliert (js/entities.js bleibt unverändert).
        // Der Haken onDraw läuft innerhalb der originalen Zeichnung mit - das Abzeichen deshalb hinterher.
        const original = ShadowCrocodile.prototype.draw;
        k.draw = function (ctx, camera) {
            const pos = camera.worldToScreen(this.x, this.y);
            const cx = pos.x + this.w / 2, cy = pos.y + this.h / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1.35, 1.35);
            ctx.translate(-cx, -cy);
            original.call(this, ctx, camera);
            ctx.restore();
        };
        if (typeof FX !== 'undefined') {
            FX.ring(k.centerX(), k.centerY(), '#4fd46a', 34, 0.6, 4);
            FX.text(k.centerX(), k.centerY() - 22, 'Riesen-Krokodil!', '#8fe07a', 11, { life: 1.4 });
        }
        k.hooks.onUpdate.push(dt => {
            // große Schritte: Staubschwaden, solange es läuft
            if (!k.moving || !CrocUp.handlungsfahig(k)) return;
            k._crocSchritt = (k._crocSchritt || 0) - dt;
            if (k._crocSchritt > 0) return;
            k._crocSchritt = 0.3;
            if (typeof FX !== 'undefined') {
                FX.burst(k.centerX(), k.centerY() + 11, 'rgba(190,220,190,0.7)', 3, 50, 0.35, { kind: 'smoke', size: 4 });
            }
        });
        // Das Abzeichen zeichnet innerhalb der Skala mit und wird deshalb genauso groß wie das Krokodil.
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🦖', '#4fd46a'));
    },
});

// ── croc13 Krokodil-Panzer: es hält doppelt so viel aus ──
registerUpgrade({
    id: 'croc13', figur: 'croc', name: 'Krokodil-Panzer', emoji: '🛡️',
    text: 'Ein harter Panzer: Das Krokodil hält doppelt so viel aus wie vorher.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        k.hooks.onDamaged.push(menge => menge * 0.5);   // die Hälfte jedes Treffers prallt ab
        k.hooks.onDraw.push(ctx => {
            // Panzerplatten über dem Rücken (Bildschirmmaße wie in js/entities.js)
            if (!Game.camera) return;
            const p = Game.camera.worldToScreen(k.x, k.y);
            const cx = p.x + k.w / 2, cy = p.y + k.h / 2;
            ctx.save();
            for (let i = -1; i <= 1; i++) {
                Art.body(ctx, cx + i * 6, cy - 6 + Math.abs(i), 4, 3, '#5f6f86',
                    { outline: '#26303f', lineWidth: 1.2 });
            }
            Art.ring(ctx, cx, cy, 15, 'rgba(150,200,255,0.55)', 1.6, 0.6 + 0.2 * Math.sin(Art.time * 3));
            ctx.restore();
            CrocUp.abzeichen(ctx, k, '🛡️', '#9ac8ff');
        });
    },
});

// ══════════════════════════════════════════════════════════════════════════
// ── Paket 2: die neuen Schattenkrokodil-Extras (Auftrag croc2, 18.10.2026) ──
// Wieder alles über die Haken aus js/upgrades.js; js/entities.js bleibt unberührt.
// ══════════════════════════════════════════════════════════════════════════

const CROC14_ZWILLING_SEKUNDEN = 10;   // wie lange ein Schattenzwilling mitkämpft
const CROC14_ZWILLING_TAKT = 16;       // Abklingzeit bis zum nächsten Zwilling
const CROC15_WEITE = 2;                // Weitspucke: die Spucke fliegt doppelt so weit
const CROC16_BOMBE_RADIUS = 62;        // Spuck-Bombe:Radius der Detonation
const CROC16_BOMBE_SCHADEN = 7;
const CROC16_BOMBE_TAKT = 4.5;         // Abklingzeit zwischen zwei Bomben
const CROC17_SPRINT_TAKT = 5;          // Schatten-Sprint: alle fünf Sekunden ein Satz
const CROC17_SPRINT_TAKT_KRAFT = 760;  // wie schnell es dabei über den Boden flitzt
const CROC17_SPRINT_DAUER = 0.22;
const CROC18_ZAHN_DURCH = 2;           // Zahnschuss: durch so viele Gegner hindurch (insgesamt drei)
const CROC18_ZAHN_SCHADEN = 5;
const CROC19_TAXI_TEMPO = 1.9;         // Krokodil-Taxi: Mark ist auf dem Krokodil so viel schneller
const CROC20_WAECHTER_BISS = 46;       // Wächter: so nah darf kein Gegner an Mark heran
const CROC20_WAECHTER_TAKT = 1.6;
const CROC21_HEILUNG_TAKT = 1.2;       // Schatten-Heilung: ein Herzchen alle 1,2 Sekunden im Sitzen
const CROC22_BRUELL_RADIUS = 96;       // Brüllwelle: so weit fliegt die Druckwelle
const CROC22_BRUELL_TAKT = 7;
const CROC22_BRUELL_KRAFT = 700;       // so kräftig fliegt ein Gegner vom Gebrüll weg
const CROC23_MUENZ_HUNGER = 0.7;       // Münzschlucker: so oft schnappt es sich eine Münze
const CROC23_MUENZ_WEITE = 230;
const CROC23_MUENZ_SATZ = 0.12;        // so schnell macht es seine Sätze zur Münze hin
const CROC24_SUMPF_DAUER = 9;          // Sumpfruf: so lange helfen die kleinen Sumpfkrokodile
const CROC24_SUMPF_TAKT = 18;
const CROC25_EXPLO_RADIUS = 150;       // Schatten-Explosion: trifft alle Gegner rundherum
const CROC25_EXPLO_SCHADEN = 10;
const CROC25_EXPLO_TAKT = 12;

// ── croc14 Schattenzwilling: ein zweites Schattenkrokodil kämpft mit ──
registerUpgrade({
    id: 'croc14', figur: 'croc', name: 'Schattenzwilling', emoji: '👥',
    text: 'Von Zeit zu Zeit taucht ein zweites Schattenkrokodil auf und kämpft eine Zeit lang mit.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const zwillinge = [];
        let bereit = 4;
        k.hooks.onUpdate.push(dt => {
            if (CrocUp.handlungsfahig(k)) {
                bereit -= dt;
                if (bereit <= 0) {
                    const punkt = CrocUp.freierPunktUm(Game.world, k.centerX(), k.centerY() + 6, 24);
                    if (punkt) {
                        bereit = CROC14_ZWILLING_TAKT;      // Abklingzeit
                        const z = spawnHelper(new ShadowCrocodile(punkt.x - 14, punkt.y - 13),
                            punkt.x, punkt.y, CROC14_ZWILLING_SEKUNDEN);
                        if (z) {
                            z.w = 28; z.h = 26;
                            setupHooks(z, 'croc');          // eigene Haken: damit sind auch SEINE Kugeln markierbar
                            z.hooks.onShoot.push(kugel => { kugel.spitOwner = z; });
                            if (zwillinge.length < 4) zwillinge.push(z);
                            Juri.poof(k.centerX(), k.centerY(), true);
                            Juri.poof(punkt.x, punkt.y, true);
                            if (typeof FX !== 'undefined') {
                                FX.text(punkt.x, punkt.y - 20, 'Schattenzwilling!', '#b28cff', 11, { life: 1.3 });
                            }
                        }
                    }
                }
            }
            // Fortgang: Zähler abgelaufen oder k.o. - die eigenen Schattenkugeln räumt es mit weg
            for (let i = zwillinge.length - 1; i >= 0; i--) {
                const z = zwillinge[i];
                if (!z.dead && z.helperTimer > 0) continue;
                zwillinge.splice(i, 1);
                if (Game.projectiles) {
                    for (let j = Game.projectiles.length - 1; j >= 0; j--) {
                        const p = Game.projectiles[j];
                        if (p && p.crocSpit && p.spitOwner) Game.projectiles.splice(j, 1);
                    }
                }
                if (!z.dead) Juri.poof(z.centerX(), z.centerY(), true);
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '👥', '#b28cff'));
    },
});

// ── croc15 Weitspucke: die Spucke fliegt doppelt so weit ──
registerUpgrade({
    id: 'croc15', figur: 'croc', name: 'Weitspucke', emoji: '🎯',
    text: 'Die Spucke fliegt doppelt so weit wie vorher.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const unterwegs = [];
        k.hooks.onShoot.push(p => {
            p.lifetime = (p.lifetime || 3) * CROC15_WEITE;   // drei Sekunden Flugzeit werden sechs: doppelte Weite
            unterwegs.push({ p: p, x0: p.x, y0: p.y, weiter: 0 });
            if (unterwegs.length > 40) unterwegs.shift();   // die Engine wirft Kugeln auch ohne dead=true hinaus
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🎯', '#9fe6ff'));
        c.game.roundHooks.onUpdate.push(dt => {
            // Leuchtspur hinter der weit fliegenden Kugel, damit man die Weite sehen kann
            for (let i = unterwegs.length - 1; i >= 0; i--) {
                const e = unterwegs[i];
                if (e.p.dead) { unterwegs.splice(i, 1); continue; }
                e.weiter += Math.hypot(e.p.vx, e.p.vy) * dt;
                if (typeof FX !== 'undefined' && (i % 2 === 0)) {
                    FX.burst(e.p.x, e.p.y, 'rgba(159,230,255,0.75)', 1, 18, 0.28, { kind: 'smoke', size: 2.6 });
                }
            }
        });
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const e of unterwegs) {
                if (e.p.dead) continue;
                const s = camera.worldToScreen(e.p.x, e.p.y);
                Art.glow(ctx, s.x, s.y, (e.p.radius || 4) * 3, '#9fe6ff', 0.5);
            }
        });
    },
});

// ── croc16 Spuck-Bombe: eine große Spuckblase explodiert in einem großen Kreis ──
class Spuckbombe {
    constructor(x, y, vx, vy, reichweite, radius, schaden) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.reichweite = reichweite; this.zurueck = 0;
        this.radius = radius; this.schaden = schaden;
        this.dead = false; this.alter = 0;
    }
    update(dt, welt) {
        this.alter += dt;
        const schritt = Math.hypot(this.vx, this.vy) * dt;
        // die ersten Zentimeter sind verschont: die Blase startet im Maul, und das sitzt manchmal an einer Wand
        if (this.zurueck > 16 && welt && welt.isWall(this.x + this.vx * dt, this.y + this.vy * dt)) { this.explodiert(); return; }
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.zurueck += schritt;
        if (typeof FX !== 'undefined' && this.alter > 0.04) {
            this.alter = 0;
            FX.burst(this.x, this.y, 'rgba(178,140,255,0.8)', 1, 26, 0.32, { kind: 'smoke', size: 4 });
        }
        // die ersten Zentimeter sind auch gegen Gegner verschont: sonst zündet die Blase
        // im eigenen Gesicht, wenn ein Gegner am Krokodil klebt
        if (this.zurueck > 20) {
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                if (Math.hypot(e.centerX() - this.x, e.centerY() - this.y) <=
                    this.blase() + Math.max(e.w, e.h) / 2) { this.explodiert(); return; }
            }
        }
        if (this.zurueck >= this.reichweite) this.explodiert();
    }
    blase() { return 9 + Math.sin(Art.time * 16) * 1.6; }
    draw(ctx, camera) {
        // die Engine wirft Geschosse ohne zeichnbare Blase still aus der Liste - also muss sie hier stehen
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.blase();
        ctx.save();
        Art.glow(ctx, p.x, p.y, r * 2.6, '#b28cff', 0.7);
        ctx.fillStyle = 'rgba(178,140,255,0.6)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r, r * 1.12, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,251,255,0.85)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(p.x - r * 0.3, p.y - r * 0.4, r * 0.26, r * 0.2, -0.5, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    explodiert() {
        if (this.dead) return;
        this.dead = true;
        CrocUp.schlag(this.x, this.y, this.radius, this.schaden, 340, 'Spuck-Bombe!');
        if (typeof FX !== 'undefined') {
            FX.ring(this.x, this.y, '#b28cff', this.radius, 0.5, 7);
            FX.ring(this.x, this.y, '#ffffff', this.radius * 0.55, 0.34, 4);
            FX.burst(this.x, this.y, ['#2b1466', '#8a5cff', '#b28cff', '#ffffff'], 20, 240, 0.6);
            if (Game.camera) Game.camera.shake(5, 0.22);
        }
    }
}

registerUpgrade({
    id: 'croc16', figur: 'croc', name: 'Spuck-Bombe', emoji: '💣',
    text: 'Das Krokodil spuckt eine große Spuckblase, die in einem großen Kreis explodiert.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        let bereit = 1.5;
        k.hooks.onUpdate.push(dt => {
            if (!CrocUp.handlungsfahig(k)) return;
            bereit -= dt;
            if (bereit > 0) return;
            const ziel = CrocUp.ziel(k, Game.enemies, 260, true);
            if (!ziel) return;
            bereit = CROC16_BOMBE_TAKT;              // Abklingzeit
            const a = Math.atan2(ziel.centerY() - k.centerY(), ziel.centerX() - k.centerX());
            Game.projectiles.push(new Spuckbombe(k.centerX() + Math.cos(a) * 8, k.centerY() + Math.sin(a) * 8,
                Math.cos(a) * 210, Math.sin(a) * 210,
                Math.max(60, Math.min(240, Math.hypot(ziel.centerX() - k.centerX(), ziel.centerY() - k.centerY()))),
                CROC16_BOMBE_RADIUS, CROC16_BOMBE_SCHADEN));
            k.mouthTimer = 0.35;
            if (typeof FX !== 'undefined') {
                FX.burst(k.centerX() + Math.cos(a) * 10, k.centerY() + Math.sin(a) * 10, '#b28cff', 6, 90, 0.35, { kind: 'bubble' });
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '💣', '#b28cff'));
    },
});

// ── croc17 Schatten-Sprint: es flitzt blitzschnell zu Gegnern ──
registerUpgrade({
    id: 'croc17', figur: 'croc', name: 'Schatten-Sprint', emoji: '💨',
    text: 'Von Zeit zu Zeit flitzt das Krokodil blitzschnell auf einen Gegner zu.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const effekte = new CrocEffekte();
        let bereit = 2, schluss = 0, winkel = 0, strecke = 0;
        k.hooks.onUpdate.push(dt => {
            effekte.update(dt);
            if (!CrocUp.handlungsfahig(k)) {              // abgebrochener Sprint kostet dieselbe Pause
                if (schluss > 0) { schluss = 0; bereit = CROC17_SPRINT_TAKT; }
                return;
            }
            if (schluss > 0) {
                schluss -= dt;
                const schritt = CROC17_SPRINT_TAKT_KRAFT * dt;
                strecke -= Juri.step(k, Math.cos(winkel) * schritt, Math.sin(winkel) * schritt, Game.world);
                effekte.schwung(k.centerX(), k.centerY(), 20, winkel);
                if (typeof FX !== 'undefined') {
                    FX.burst(k.centerX(), k.centerY() + 8, 'rgba(178,140,255,0.85)', 2, 70, 0.3, { kind: 'smoke', size: 4 });
                }
                if (schluss <= 0 || strecke <= 0) { schluss = 0; bereit = CROC17_SPRINT_TAKT; }
                return;
            }
            bereit -= dt;
            if (bereit > 0) return;
            const ziel = CrocUp.ziel(k, Game.enemies, 300, true);
            if (!ziel) return;
            winkel = Math.atan2(ziel.centerY() - k.centerY(), ziel.centerX() - k.centerX());
            let weg = Math.max(30, Math.hypot(ziel.centerX() - k.centerX(), ziel.centerY() - k.centerY()) - 26);
            const frei = (s) => !Game.world || Juri.lineClear(Game.world, k.centerX(), k.centerY(),
                k.centerX() + Math.cos(winkel) * s, k.centerY() + Math.sin(winkel) * s);
            if (!frei(weg)) weg = weg / 2;
            if (!frei(weg)) return;
            schluss = CROC17_SPRINT_DAUER;
            strecke = weg;
            k.facingAngle = winkel;
            Juri.poof(k.centerX(), k.centerY(), true);
            if (typeof FX !== 'undefined') FX.text(k.centerX(), k.centerY() - 18, 'Schatten-Sprint!', '#b28cff', 11, { life: 1 });
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '💨', '#b28cff'));
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => effekte.draw(ctx, camera));
    },
});

// ── croc18 Zahnschuss: es spuckt Zähne, die durch mehrere Gegner fliegen ──
registerUpgrade({
    id: 'croc18', figur: 'croc', name: 'Zahnschuss', emoji: '🦈',
    text: 'Das Krokodil spuckt Zähne, die durch mehrere Gegner hindurchfliegen.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        k.hooks.onShoot.push(p => {
            p.damage = Math.max(p.damage, CROC18_ZAHN_SCHADEN);
            p.pierce = CROC18_ZAHN_DURCH;          // die Engine zählt die Treffer ab (js/main.js)
            p.radius = 5;
            p.crocZahn = true;
            p.draw = function (ctx, camera) {
                const s = camera.worldToScreen(this.x - 5, this.y - 5);
                zahnZeichnen(ctx, s.x + 5, s.y + 5, Math.atan2(this.vy, this.vx), 6);
            };
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🦈', '#f2f6ff'));
    },
});

// Ein Zahn: weiße Spitze mit dunklem Rand, dreht sich in Flugrichtung
function zahnZeichnen(ctx, x, y, dreh, groesse) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dreh);
    ctx.beginPath();
    ctx.moveTo(groesse, 0);
    ctx.lineTo(-groesse * 0.7, -groesse * 0.62);
    ctx.lineTo(-groesse * 0.34, 0);
    ctx.lineTo(-groesse * 0.7, groesse * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#f7fbff';
    ctx.fill();
    ctx.strokeStyle = '#33406a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    Art.glow(ctx, x, y, groesse * 2.1, '#cfe6ff', 0.42);
}

// ── croc19 Krokodil-Taxi: Mark reitet auf dem Krokodil und ist schneller ──
registerUpgrade({
    id: 'croc19', figur: 'croc', name: 'Krokodil-Taxi', emoji: '🚕',
    text: 'Mark reitet auf dem Krokodil und ist damit deutlich schneller unterwegs.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        const p = c.player;
        const grund = p.baseSpeed || 150;
        const schritt = k.speed || 120;
        let staub = 0;
        // Reiten heisst hier: Mark und sein Krokodil sind zusammen viel schneller unterwegs.
        // Marks Position darf man ihm NICHT setzen: das Krokodil folgt erst ab 52 px Abstand
        // (js/entities.js), und ein Zuruecksetzen auf seinen Ruecken haette beide festgenagelt.
        k.speed = Math.round(schritt * 1.5);
        c.game.roundHooks.onUpdate.push(dt => {
            const faehrig = !p.dead && CrocUp.handlungsfahig(k);
            // Tempo ueber baseSpeed: player.js:311 macht jedes Bild `speed = baseSpeed`,
            // ein in `speed` gesetzter Wert waere vor jedem Schritt wieder weg
            p.baseSpeed = faehrig ? grund * CROC19_TAXI_TEMPO : grund;
            staub -= dt;
            const unterwegs = !!Input.direction && Math.hypot(Input.direction.x, Input.direction.y) > 0.1;
            if (faehrig && (k.moving || unterwegs) && staub <= 0) {
                staub = 0.14;
                if (typeof FX !== 'undefined') {
                    FX.burst((k.centerX() + p.x + p.w / 2) / 2, k.centerY() + 11,
                        'rgba(200,225,255,0.75)', 2, 70, 0.32, { kind: 'smoke', size: 4 });
                }
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🚕', '#ffd23f'));
    },
});

// ── croc20 Wächter: es bleibt bei Mark und beißt jeden, der zu nah kommt ──
registerUpgrade({
    id: 'croc20', figur: 'croc', name: 'Wächter', emoji: '🛡️',
    text: 'Das Krokodil bleibt dicht bei Mark und beißt jeden Gegner, der zu nah herankommt.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc, p = c.player;
        let bereit = 1;
        k.hooks.onUpdate.push(dt => {
            bereit -= dt;
            const mx = p.x + p.w / 2, my = p.y + p.h / 2;   // Mark hat keinen center-Helfer, selbst ausrechnen
            // Wächter halten: zu weit weg kommt das Krokodil zurück zu Mark
            const d = Math.hypot(k.centerX() - mx, k.centerY() - my);
            if (d > 64 && CrocUp.handlungsfahig(k)) {
                const punkt = CrocUp.freierPunktUm(Game.world, mx, my + 6, 20);
                if (punkt) {
                    k.x = punkt.x - k.w / 2; k.y = punkt.y - k.h / 2;
                    k.stuckTimer = 0;
                    Juri.poof(k.centerX(), k.centerY(), true);
                }
            }
            if (!CrocUp.handlungsfahig(k) || bereit > 0 || p.dead) return;
            const ziel = CrocUp.zielVon(mx, my, Game.enemies, CROC20_WAECHTER_BISS, null, false) ||
                CrocUp.ziel(k, Game.enemies, 62, false);
            if (!ziel) return;
            bereit = CROC20_WAECHTER_TAKT;          // Abklingzeit zwischen zwei Bissen
            k.mouthTimer = 0.32;
            CrocUp.schlag(ziel.centerX(), ziel.centerY(), 15, 7, 300, 'Wächterbiss!');
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🛡️', '#ffd23f'));
    },
});

// ── croc21 Schatten-Heilung: es heilt sich, wenn es still im Schatten liegt ──
registerUpgrade({
    id: 'croc21', figur: 'croc', name: 'Schatten-Heilung', emoji: '💚',
    text: 'Wenn das Krokodil still im Schatten liegt, heilt es sich langsam selbst.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        let ruhig = 0, takt = 0;
        k.hooks.onUpdate.push(dt => {
            if (!CrocUp.handlungsfahig(k) || k.hp >= k.maxHp || k.moving) { ruhig = 0; return; }
            ruhig += dt;
            if (ruhig < 0.7) return;               // erst eine Weile stillstehen, dann heilt es
            takt -= dt;
            if (takt > 0) return;
            takt = CROC21_HEILUNG_TAKT;
            k.hp = Math.min(k.maxHp, k.hp + 1);
            if (typeof FX !== 'undefined') {
                FX.burst(k.centerX(), k.centerY() - 6, '#7dff8a', 4, 45, 0.5, { kind: 'spark' });
                FX.ring(k.centerX(), k.centerY(), '#6bff9a', 17, 0.36, 2);
            }
        });
        k.hooks.onDraw.push(ctx => {
            if (ruhig > 0.7 && k.hp < k.maxHp && Game.camera) {
                const s = Game.camera.worldToScreen(k.centerX(), k.centerY());
                Art.glow(ctx, s.x, s.y, 19, '#4fd46a', 0.3 + 0.12 * Math.sin(Art.time * 4));
            }
            CrocUp.abzeichen(ctx, k, '💚', '#6bff9a');
        });
    },
});

// ── croc22 Brüllwelle: ein Gebrüll schubst alle Gegner weg ──
registerUpgrade({
    id: 'croc22', figur: 'croc', name: 'Brüllwelle', emoji: '📢',
    text: 'Von Zeit zu Zeit brüllt das Krokodil: ein Schwall schubst alle Gegner rundherum weg.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        let bereit = 3;
        k.hooks.onUpdate.push(dt => {
            if (!CrocUp.handlungsfahig(k)) return;
            bereit -= dt;
            if (bereit > 0) return;
            if (!CrocUp.ziel(k, Game.enemies, CROC22_BRUELL_RADIUS, false)) return;
            bereit = CROC22_BRUELL_TAKT;           // Abklingzeit
            k.mouthTimer = 0.45;                   // das Maul geht weit auf
            if (typeof FX !== 'undefined') {
                FX.ring(k.centerX(), k.centerY(), '#ffd23f', CROC22_BRUELL_RADIUS, 0.5, 8);
                FX.ring(k.centerX(), k.centerY(), '#ffffff', CROC22_BRUELL_RADIUS * 0.62, 0.36, 4);
                FX.ring(k.centerX(), k.centerY(), '#b28cff', CROC22_BRUELL_RADIUS * 0.34, 0.26, 3);
                FX.burst(k.centerX(), k.centerY(), ['#ffe86b', '#ffffff', '#b28cff'], 18, 250, 0.55, { kind: 'smoke', size: 5 });
                FX.text(k.centerX(), k.centerY() - 22, 'GRAAAR!', '#ffe86b', 13, { life: 1.2 });
                if (Game.camera) Game.camera.shake(6, 0.25);
            }
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                const dx = e.centerX() - k.centerX(), dy = e.centerY() - k.centerY();
                const dist = Math.hypot(dx, dy);
                if (dist > CROC22_BRUELL_RADIUS + Math.max(e.w, e.h) / 2) continue;
                const winkel = Math.atan2(dy, dx);
                // Bosse widerstehen: sie werden nur ein bisschen geschubst
                if (e.isBoss) { knockBack(e, winkel, 90); continue; }
                // Schaden und Schubs in einem Schritt: takeDamage überschreibt den eigenen Schwung
                e.takeDamage(2, winkel, CROC22_BRUELL_KRAFT);
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '📢', '#ffe86b'));
    },
});

// ── croc23 Münzschlucker: es sammelt Münzen ein und bringt sie Mark ──
registerUpgrade({
    id: 'croc23', figur: 'croc', name: 'Münzschlucker', emoji: '🪙',
    text: 'Das Krokodil schnappt sich Münzen im weiten Umkreis und bringt sie Mark.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc, p = c.player;
        let hungrig = 0.3, satz = 0;
        k.hooks.onUpdate.push(dt => {
            if (!CrocUp.handlungsfahig(k)) return;
            hungrig -= dt; satz -= dt;
            const troeg = (Game.coinDrops || []).filter(x => x && !x.collected);
            if (!troeg.length) return;
            let naechste = null, beste = CROC23_MUENZ_WEITE;
            for (const x of troeg) {
                const d = Math.hypot(x.x + x.w / 2 - k.centerX(), x.y + x.h / 2 - k.centerY());
                if (d < beste) { beste = d; naechste = x; }
            }
            if (!naechste) return;
            const zx = naechste.x + naechste.w / 2, zy = naechste.y + naechste.h / 2;
            const weg = Math.hypot(zx - k.centerX(), zy - k.centerY());
            if (weg > 26) {                      // noch weg: einen Satz dorthin (Schlucktakt bleibt frei)
                // Satz zur Münze hin (dasselbe Hüpfen, mit dem das Krokodil auch zu Mark kommt):
                // hinterherlaufen würde ständig gegen das Folgen kämpfen und käme nie an
                if (satz > 0 || !Game.world || Game.world.isWall(zx, zy)) return;
                satz = CROC23_MUENZ_SATZ;
                Juri.poof(k.centerX(), k.centerY(), true);
                k.x = zx - k.w / 2; k.y = zy - k.h / 2; k.stuckTimer = 0;
                if (typeof FX !== 'undefined') {
                    FX.burst(zx, zy + 5, 'rgba(178,140,255,0.8)', 5, 90, 0.32, { kind: 'smoke', size: 4 });
                }
                return;
            }
            if (hungrig > 0) return;               // erst schluckt es, dann eine kurze Pause
            hungrig = CROC23_MUENZ_HUNGER;         // Abklingzeit zwischen zwei Schluckern
            naechste.collected = true;
            Game.coins += naechste.value;
            Game.levelCoins += naechste.value;
            k.mouthTimer = 0.3;
            if (typeof FX !== 'undefined') {
                FX.text(k.centerX(), k.centerY() - 16, '+' + naechste.value, '#ffd23f', 10, { life: 0.7 });
                FX.burst(k.centerX(), k.centerY() - 4, '#ffd23f', 6, 80, 0.4, { kind: 'star' });
                FX.text(p.x + p.w / 2, p.y + p.h / 2 - 22, 'Münzen zu Mark!', '#ffe9a8', 10, { life: 0.9 });
                if (typeof Sound !== 'undefined') Sound.coin();
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🪙', '#ffd23f'));
    },
});

// ── croc24 Sumpfruf: kleine Sumpfkrokodile helfen kurz mit ──
class Sumpfkrokodil {
    constructor(x, y, saettigung) {
        this.x = x; this.y = y; this.w = 18; this.h = 15;
        this.hp = 6; this.maxHp = 6;
        this.dead = false; this.iFrames = 0; this.hitFlash = 0;
        this.koTimer = 0; this.stunTimer = 0; this.sleepTimer = 0;
        this.bissTimer = 0.4; this.seed = Math.random() * 10;
        this.faceX = 1; this.moving = false; this.walkT = 0;
        this.helperTimer = saettigung !== undefined ? saettigung : CROC24_SUMPF_DAUER;
        setupHooks(this, 'croc');
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }
    takeDamage(menge) {
        if (this.iFrames > 0 || this.dead || this.koTimer > 0) return;
        this.hp -= menge; this.iFrames = 0.8; this.hitFlash = 0.12;
        if (this.hp <= 0) { this.hp = 0; this.dead = true; Juri.poof(this.centerX(), this.centerY(), true); }
    }
    stun(sekunden) { if (this.koTimer > 0 || this.dead) return; this.stunTimer = Math.max(this.stunTimer, sekunden); }
    poison(sekunden) { return false; }
    sleep(sekunden) { return false; }
    knockOut(sekunden) { Juri.knockOutCompanion(this, sekunden); }
    update(dt, welt, spieler, gegner) {
        if (this.dead) return;
        if (this.iFrames > 0) this.iFrames -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (Juri.koUpdate(this, dt)) return;
        if (this.stunTimer > 0) { this.stunTimer -= dt; this.moving = false; return; }
        this.bissTimer -= dt;
        const ziel = CrocUp.ziel(this, gegner, 190, false);
        this.moving = false;
        if (ziel) {
            const dx = ziel.centerX() - this.centerX(), dy = ziel.centerY() - this.centerY();
            const weg = Math.hypot(dx, dy) || 1;
            this.facingAngle = Math.atan2(dy, dx);
            this.faceX = Math.cos(this.facingAngle) >= 0 ? 1 : -1;
            if (weg > 13) {
                this.moving = Juri.step(this, dx / weg * 95 * dt, dy / weg * 95 * dt, welt) > 0.04;
                if (this.moving) this.walkT += dt;
            } else if (this.bissTimer <= 0) {
                this.bissTimer = 1;                // alle Sekunde ein Biss
                ziel.takeDamage(3, this.facingAngle, ziel.isBoss ? 40 : 150);
                if (typeof FX !== 'undefined') {
                    FX.burst(this.centerX() + this.faceX * 7, this.centerY(), '#b8ff9a', 4, 80, 0.3, { kind: 'spark' });
                    FX.ring(this.centerX() + this.faceX * 7, this.centerY(), '#6bf2a0', 9, 0.24, 2);
                }
            }
        }
        Juri.bump(this, gegner);
    }
    draw(ctx, camera) {
        if (this.dead) return;
        const s = camera.worldToScreen(this.x, this.y);
        const cx = s.x + this.w / 2, cy = s.y + this.h / 2;
        const f = this.faceX || 1;
        const bob = this.moving ? -Math.abs(Math.sin(this.walkT * 13)) * 1.1 : Math.sin(Art.time * 2.6 + this.seed) * 0.4;
        Art.glow(ctx, cx, cy + 1, 14, '#3f8f4a', 0.24);
        Art.body(ctx, cx - f * 9, cy + 3 + bob, 5, 2.4, '#2f7a42', { outline: '#14472a', lineWidth: 1 });
        Art.body(ctx, cx, cy + bob, 8, 5.2, '#3f9a4e', { outline: '#14472a', lineWidth: 1.2 });
        Art.body(ctx, cx + f * 7, cy - 1 + bob, 4.4, 3.2, '#4fae5c', { outline: '#14472a', lineWidth: 1 });
        for (let i = -1; i <= 1; i++) {
            Art.body(ctx, cx + i * 4, cy - 5 + bob, 1.5, 1.9, '#8fe07a', { outline: '#2b6b34', lineWidth: 0.8 });
        }
        Art.eye(ctx, cx + f * 7.5, cy - 3 + bob, 1.7, { x: f, y: 0 });
        Art.sparkle(ctx, cx, cy - 11, 3, '#b8ff9a', 0.5 + 0.3 * Math.sin(Art.time * 3 + this.seed));
    }
}

registerUpgrade({
    id: 'croc24', figur: 'croc', name: 'Sumpfruf', emoji: '🐊',
    text: 'Das Krokodil ruft drei kleine Sumpfkrokodile, die eine Weile lang mithelfen.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        let bereit = 2;
        k.hooks.onUpdate.push(dt => {
            if (!CrocUp.handlungsfahig(k)) return;
            bereit -= dt;
            if (bereit > 0) return;
            const punkt = CrocUp.freierPunktUm(Game.world, k.centerX(), k.centerY() + 6, 20);
            if (!punkt) return;
            bereit = CROC24_SUMPF_TAKT;            // Abklingzeit bis zum nächsten Ruf
            for (let i = 0; i < 3; i++) {
                const ort = CrocUp.freierPunktUm(Game.world, punkt.x, punkt.y, 12 + i * 9) || punkt;
                spawnHelper(new Sumpfkrokodil(ort.x - 9, ort.y - 7), ort.x, ort.y, CROC24_SUMPF_DAUER);
                Juri.poof(ort.x, ort.y, true);
            }
            if (typeof FX !== 'undefined') {
                FX.text(punkt.x, punkt.y - 20, 'Sumpfruf!', '#8fe07a', 12, { life: 1.3 });
                FX.ring(punkt.x, punkt.y, '#8fe07a', 30, 0.45, 3);
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🐊', '#8fe07a'));
    },
});

// ── croc25 Schatten-Explosion: geht es k.o., trifft eine Schattenexplosion alle Gegner ──
registerUpgrade({
    id: 'croc25', figur: 'croc', name: 'Schatten-Explosion', emoji: '🌑',
    text: 'Geht das Krokodil k.o., geht eine Schattenexplosion über alle Gegner nieder.',
    where: 'im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.croc) return;
        const k = c.croc;
        let bereit = 2, warKo = false, warTod = false;
        c.game.roundHooks.onUpdate.push(dt => {
            bereit -= dt;
            const ko = k.dead || k.koTimer > 0;
            const neu = (k.koTimer > 0 && !warKo) || (k.dead && !warTod);
            warKo = k.koTimer > 0; warTod = k.dead;
            if (!neu || bereit > 0) return;
            bereit = CROC25_EXPLO_TAKT;            // Abklingzeit, damit nicht jede Welle explodes
            const x = k.centerX(), y = k.centerY();
            CrocUp.schlag(x, y, CROC25_EXPLO_RADIUS, CROC25_EXPLO_SCHADEN, 380, 'Schatten-Explosion!');
            if (typeof FX !== 'undefined') {
                FX.ring(x, y, '#8a5cff', CROC25_EXPLO_RADIUS, 0.6, 9);
                FX.ring(x, y, '#2b1466', CROC25_EXPLO_RADIUS * 0.7, 0.5, 7);
                FX.burst(x, y, ['#2b1466', '#6a3fd6', '#b28cff', '#ffffff'], 26, 280, 0.7);
                FX.screenFlash('#6a3fd6', 0.3);
                if (Game.camera) Game.camera.shake(8, 0.3);
            }
        });
        k.hooks.onDraw.push(ctx => CrocUp.abzeichen(ctx, k, '🌑', '#6a3fd6'));
    },
});
