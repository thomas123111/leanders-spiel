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
