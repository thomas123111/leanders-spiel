// ── Upgrades für Juri (Datei des Juri-Auftrags) ──
// Hier trägt der Juri-Auftrag seine neuen Upgrades ein - nur in dieser Datei,
// der Figuren-Code (js/entities.js, Klasse Juri) wird nicht angefasst.
//
// So kommt ein neues Upgrade hinein (genau ein registerUpgrade-Aufruf pro Extra):
//
//   registerUpgrade({
//       id: 'meinUpgrade',            // eindeutig, englisch, kein bestehender Id-Dieb
//       figur: 'juri',                // fest: 'juri'
//       name: 'Mein Extra',           // erscheint im Menü „Waffen" und im Shop
//       text: 'Was das Extra tut.',   // ein Satz für die Karte
//       emoji: '🔥',
//       where: 'Welt 12 schaffen',    // Hinweis auf der gesperrten Karte
//       istFrei: g => g.maxWorldUnlocked >= 13,   // oder: g.unlockedMeinUpgrade
//       apply(c) {                    // c = { game, welt, player, juri, croc, panda }
//           // einmal beim Weltstart, NUR wenn dieses Extra gewählt wurde.
//           // Achtung: die eigene Figur kann in der Welt fehlen (c.juri ist dann null) -
//           // erst prüfen: if (!c.juri) return;
//           // Hier die Haken anmelden - sie wirken dann die ganze Runde:
//           c.juri.hooks.onUpdate.push(dt => { /* jeder Bild-Takt */ });
//           c.juri.hooks.onHit.push((gegner, schaden) => schaden);  // Hammerschlag (Zahl = Schaden, darf geaendert werden)
//           c.juri.hooks.onShoot.push(geschoss => { /* nur mit companionShoot - Juri spuckt sonst nicht */ });
//           c.juri.hooks.onDamaged.push(menge => menge * 0.5); // Menge aendern (Zahl zurueckgeben)
//           c.juri.hooks.onDraw.push(ctx => { /* ueber Juri malen (Bildschirmmasse) */ });
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
//
// Paket 1 (Auftrag juri1, 18.10.2026): die zwolf Extras juri01 und juri03 bis juri13 aus
// Leanders Liste. Alle sind im Shop kaufbar (Preis 500 💎, steht in js/upgrades.js) - nur
// juri13 „Doppelhammer" ist die Weltbelohnung aus Welt 52 und deshalb mit `welt: 52`
// ausgezeichnet und nicht kaufbar.

// ══════════════════════════════════════════════════════════════
// ── Gemeinsame Helfer für Juris Upgrades (nur diese Datei) ──
// ══════════════════════════════════════════════════════════════

// Die Gegner um einen Punkt, der Reihe nach (nächster zuerst). Tote und `except` fallen weg.
function juriGegnerUm(x, y, radius, except) {
    const funde = [];
    if (!Game.enemies || !Number.isFinite(x) || !Number.isFinite(y)) return funde;
    for (const e of Game.enemies) {
        if (!e || e === except || e.dead) continue;
        const d = Math.hypot(e.centerX() - x, e.centerY() - y) - Math.max(e.w, e.h) / 2;
        if (d <= radius) funde.push({ e, d });
    }
    funde.sort((a, b) => a.d - b.d);
    return funde.map(f => f.e);
}

// Marks Mittelpunkt - der Spieler hat die centerX/centerY-Methoden der Begleiter nicht.
function juriMarkMitte(player) {
    return { x: player.x + player.w / 2, y: player.y + player.h / 2 };
}

// Bildschirmmittelpunkt einer Figur (die Haken von Juri kennen nur Bildschirmmasse).
function juriSchirm(camera, figur) {
    const p = camera.worldToScreen(figur.x, figur.y);
    return { x: p.x + figur.w / 2, y: p.y + figur.h / 2 };
}

// Der Winkel von Juris Hammer, genauso wie js/entities.js ihn zeichnet (für eigene Hammer-Bilder).
function juriHammerWinkel(juri) {
    const f = juri.faceX || 1;
    if (!juri.swinging || !(juri.swingTimer > 0)) return -Math.PI / 2 + f * 0.55;
    const sw = clamp(1 - juri.swingTimer / 0.28, 0, 1);
    const a0 = juri.swingAngle - f * 2.1, a1 = juri.swingAngle + f * 0.15;
    return a0 + (a1 - a0) * (sw < 0.4 ? Math.pow(sw / 0.4, 2) : 1);
}

// Ein Hammer als eigenes Bild (Stiel + Kopf), für Wurf, Wirbel und den doppelten Hammer.
function juriZeichneHammer(ctx, x, y, winkel, groesse) {
    const g = groesse || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(winkel);
    ctx.scale(g, g);
    Art.limb(ctx, -1.5, 0, 10.5, 0, 2.1, '#ffd23f', { lineWidth: 1, outline: '#8a5a00' });
    ctx.translate(13, 0);
    Art.box(ctx, -3.2, -4.6, 6.4, 9.2, 2, '#ff4d5e', { outline: '#7a1020', highlight: false });
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#8a5a00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-3.7, -5.8, 7.4, 2.4, 1);
    ctx.roundRect(-3.7, 3.4, 7.4, 2.4, 1);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

// Kleiner Wackel-Blitz zwischen zwei Punkten (Bodenschlag-Wellen des Donnerhammers).
function juriZeichneBlitz(ctx, camera, x1, y1, x2, y2, seed) {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return;
    const a = camera.worldToScreen(x1, y1), b = camera.worldToScreen(x2, y2);
    const dx = b.x - a.x, dy = b.y - a.y;
    const laenge = Math.hypot(dx, dy);
    if (laenge < 2) return;
    const stufen = Math.max(3, Math.round(laenge / 12));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let durchgang = 0; durchgang < 2; durchgang++) {
        ctx.strokeStyle = durchgang ? '#ffffff' : '#ffe35a';
        ctx.lineWidth = durchgang ? 1.2 : 3.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        for (let i = 1; i < stufen; i++) {
            const k = i / stufen;
            const wackel = Math.sin(seed + i * 2.7 + Art.time * 26) * (durchgang ? 2.2 : 4.4);
            ctx.lineTo(a.x + dx * k - dy / laenge * wackel, a.y + dy * k + dx / laenge * wackel);
        }
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    ctx.restore();
    Art.glow(ctx, b.x, b.y, 13, '#ffe35a', 0.5);
}

// Drei kleine Flammenzungen (Feuerhammer), t = Art.time
function juriZeichneFlammen(ctx, x, y, s, t) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    Art.glow(ctx, x, y - s * 0.4, s * 2.8, '#ff7a1f', 0.4);
    ctx.save();
    for (let i = 0; i < 3; i++) {
        const h = s * (1.5 + 0.5 * Math.sin(t * 11 + i * 1.7));
        const fx = x + (i - 1) * s * 0.8 + Math.sin(t * 8 + i * 2.1) * s * 0.22;
        ctx.beginPath();
        ctx.moveTo(fx, y - h);
        ctx.quadraticCurveTo(fx + s * 0.58, y - h * 0.32, fx, y + s * 0.4);
        ctx.quadraticCurveTo(fx - s * 0.58, y - h * 0.32, fx, y - h);
        ctx.closePath();
        ctx.fillStyle = i === 1 ? '#ffe066' : '#ff7a1f';
        ctx.fill();
    }
    ctx.restore();
}

// ── Brennen (Feuerhammer): zieht nach und nach Leben ab, Bosse kürzer ──
const JURI_BRAND = { dauer: 2.4, bossDauer: 1.2, schaden: 1, imAbstand: 0.6 };

function juriBrandStart(gegner) {
    if (!gegner || gegner.dead) return;
    gegner._juriBrand = { zeit: gegner.isBoss ? JURI_BRAND.bossDauer : JURI_BRAND.dauer, tick: 0 };
}

// Ein Takt Brennen: Schaden, Funken, und der Gegner hört von allein auf zu brennen.
function juriBrandTakt(dt) {
    if (!Game.enemies) return;
    for (const e of Game.enemies.slice()) {
        const b = e && e._juriBrand;
        if (!b) continue;
        if (e.dead) { e._juriBrand = null; continue; }
        b.zeit -= dt;
        b.tick += dt;
        while (b.tick >= JURI_BRAND.imAbstand) {
            b.tick -= JURI_BRAND.imAbstand;
            e.takeDamage(JURI_BRAND.schaden);
            if (typeof FX !== 'undefined') {
                FX.burst(e.centerX(), e.centerY(), ['#ffd23f', '#ff7a1f', '#ff4d1f'], 4, 60, 0.4, { kind: 'spark' });
            }
        }
        if (b.zeit <= 0) e._juriBrand = null;
    }
}

// Der Hammer, den Juri wirft (juri05): fliegt los, kommt zurück und trifft in beide Richtungen.
class JuriWurfhammer {
    constructor(juri, welt, winkel) {
        this.juri = juri;
        this.welt = welt;
        this.x = juri.centerX();
        this.y = juri.centerY();
        this.winkel = winkel;
        this.tempo = 360;
        this.hin = true;          // true = unterwegs, false = auf dem Rückweg
        this.zurueckgelegt = 0;
        this.weite = 150;
        this.drehung = 0;
        this.schaden = 4;
        this.getroffen = new Set();
        this.dead = false;
    }

    update(dt) {
        const j = this.juri;
        if (!j || j.dead) { this.dead = true; return; }
        if (this.hin) {
            this.x += Math.cos(this.winkel) * this.tempo * dt;
            this.y += Math.sin(this.winkel) * this.tempo * dt;
            this.zurueckgelegt += this.tempo * dt;
            // Gegen eine Wand fliegt der Hammer nicht - er dreht früher um
            if (this.zurueckgelegt >= this.weite || (this.welt && this.welt.isWall && this.welt.isWall(this.x, this.y))) {
                this.hin = false;
                this.getroffen.clear();
            }
        } else {
            const dx = j.centerX() - this.x, dy = j.centerY() - this.y;
            const d = Math.hypot(dx, dy) || 1;
            const schritt = Math.min(this.tempo * 1.2 * dt, d);
            this.x += dx / d * schritt;
            this.y += dy / d * schritt;
            // Auch zurück fliegt er nicht durch Wände: er fällt dort runter, wo er anstösst
            if (this.welt && this.welt.isWall && this.welt.isWall(this.x, this.y)) { this.dead = true; return; }
            if (d < 14) this.dead = true;
        }
        this.drehung += dt * 20;
        if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) { this.dead = true; return; }
        if (typeof FX !== 'undefined') FX.burst(this.x, this.y, ['#ffd23f', '#ff9f2e'], 2, 26, 0.28, { size: 2 });
        for (const e of juriGegnerUm(this.x, this.y, 12)) {
            if (this.getroffen.has(e) || e.iFrames > 0) continue;
            this.getroffen.add(e);
            const a = Math.atan2(e.centerY() - this.y, e.centerX() - this.x);
            e.takeDamage(this.schaden, a, 150);
            if (typeof FX !== 'undefined') {
                FX.burst(e.centerX(), e.centerY(), ['#fff6a8', '#ffd23f', '#ffffff'], 7, 120, 0.35, { kind: 'star' });
            }
        }
    }

    draw(ctx, camera) {
        if (!camera || !Number.isFinite(this.x) || !Number.isFinite(this.y)) return;
        const p = camera.worldToScreen(this.x, this.y);
        Art.glow(ctx, p.x, p.y, 15, '#ffd23f', 0.45);
        juriZeichneHammer(ctx, p.x, p.y, this.drehung, 1.15);
    }
}

// Die Blitzwelle des Donnerhammers: saust als Bodenschlag geradeaus über den Boden.
class JuriBlitzwelle {
    constructor(x, y, winkel, welt) {
        this.x0 = x; this.y0 = y;
        this.winkel = winkel;
        this.welt = welt;
        this.t = 0;
        this.lebensdauer = 0.42;
        this.tempo = 560;
        this.reichweite = 210;
        this.schaden = 4;
        this.keim = Math.random() * 10;
        this.getroffen = new Set();
        this.x = x; this.y = y;
        this.dead = false;
    }

    update(dt) {
        this.t += dt;
        const d = Math.min(this.reichweite, this.t * this.tempo);
        this.x = this.x0 + Math.cos(this.winkel) * d;
        this.y = this.y0 + Math.sin(this.winkel) * d;
        for (const e of juriGegnerUm(this.x, this.y, 14)) {
            if (this.getroffen.has(e) || e.iFrames > 0) continue;
            this.getroffen.add(e);
            e.takeDamage(this.schaden, this.winkel, 170);
            if (typeof FX !== 'undefined') {
                FX.burst(e.centerX(), e.centerY(), ['#ffe35a', '#ffffff', '#7fe0ff'], 8, 130, 0.4, { kind: 'spark' });
            }
        }
        if (this.t >= this.lebensdauer) this.dead = true;
        if (this.welt && this.welt.isWall && this.welt.isWall(this.x, this.y)) this.dead = true;
    }

    draw(ctx, camera) {
        if (!camera) return;
        const kopf = Math.min(this.reichweite, this.t * this.tempo);
        juriZeichneBlitz(ctx, camera,
            this.x0 + Math.cos(this.winkel) * Math.max(0, kopf - 46),
            this.y0 + Math.sin(this.winkel) * Math.max(0, kopf - 46),
            this.x, this.y, this.keim);
    }
}

// ══════════════════════════════════════════════════════════════
// ── Die zwolf Upgrades aus Leanders Liste ──
// ══════════════════════════════════════════════════════════════

// juri01 – Der Hammer setzt Gegner in Brand.
registerUpgrade({
    id: 'juri01', figur: 'juri', name: 'Feuerhammer', emoji: '🔥',
    text: 'Juris Hammer setzt getroffene Gegner in Brand.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        c.juri.hooks.onHit.push(tg => { juriBrandStart(tg); });
        c.game.roundHooks.onUpdate.push(dt => juriBrandTakt(dt));
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            for (const e of Game.enemies) {
                if (!e || e.dead || !e._juriBrand) continue;
                const p = juriSchirm(camera, e);
                juriZeichneFlammen(ctx, p.x, p.y - e.h / 2, Math.max(3.4, Math.min(e.w, e.h) * 0.32), Art.time);
            }
        });
    },
});

// juri03 – Ein Bodenschlag schickt eine Blitzwelle los.
registerUpgrade({
    id: 'juri03', figur: 'juri', name: 'Donnerhammer', emoji: '⚡',
    text: 'Juris Bodenschlag schickt eine Blitzwelle über den Boden.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        const wellen = [];
        let abklingzeit = 0;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            for (let i = wellen.length - 1; i >= 0; i--) {
                wellen[i].update(dt);
                if (wellen[i].dead) wellen.splice(i, 1);
            }
        });
        juri.hooks.onHit.push(tg => {
            if (abklingzeit > 0) return;
            abklingzeit = 1.6;
            const cx = juri.centerX(), cy = juri.centerY();
            const winkel = Math.atan2(tg.centerY() - cy, tg.centerX() - cx);
            wellen.push(new JuriBlitzwelle(cx, cy + 6, winkel, c.welt));
            if (typeof FX !== 'undefined') {
                FX.ring(cx, cy + 8, '#ffe35a', 26, 0.3, 3);
                FX.burst(cx, cy + 9, ['#ffe35a', '#fff6a8', '#ffffff'], 10, 120, 0.35, { kind: 'spark' });
            }
            if (Game.camera) Game.camera.shake(4, 0.18);
        });
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const w of wellen) w.draw(ctx, camera);
        });
    },
});

// juri04 – Der Hammer ist doppelt so groß und trifft mehr Gegner.
registerUpgrade({
    id: 'juri04', figur: 'juri', name: 'Riesenhammer', emoji: '🔨',
    text: 'Juris Hammer ist doppelt so groß und trifft auch die Gegner daneben.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        juri.hooks.onHit.push(tg => {
            const cx = juri.centerX(), cy = juri.centerY();
            for (const e of juriGegnerUm(tg.centerX(), tg.centerY(), 30, tg)) {
                const a = Math.atan2(e.centerY() - cy, e.centerX() - cx);
                e.takeDamage(3, a, 140);
                if (typeof FX !== 'undefined') {
                    FX.burst(e.centerX(), e.centerY(), ['#fff6a8', '#ffd23f'], 5, 100, 0.35, { kind: 'star' });
                }
            }
            if (typeof FX !== 'undefined') FX.ring(tg.centerX(), tg.centerY(), '#ffd23f', 34, 0.3, 4);
        });
        // derselbe Hammer, nur doppelt so groß über die echte Zeichnung gemalt
        juri.hooks.onDraw.push(ctx => {
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const f = juri.faceX || 1;
            ctx.save();
            ctx.globalAlpha = 0.66;
            juriZeichneHammer(ctx, p.x + f * 6.4, p.y + 1.8, juriHammerWinkel(juri), 2);
            ctx.restore();
            Art.glow(ctx, p.x, p.y, 22, '#ffd23f', 0.22);
        });
    },
});

// juri05 – Juri wirft den Hammer, und er kommt zurück.
registerUpgrade({
    id: 'juri05', figur: 'juri', name: 'Hammerwurf', emoji: '🪃',
    text: 'Juri wirft seinen Hammer weit weg, und er kommt zu ihm zurück.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        const hammer = [];
        let abklingzeit = 0.8;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            for (let i = hammer.length - 1; i >= 0; i--) {
                hammer[i].update(dt);
                if (hammer[i].dead) hammer.splice(i, 1);
            }
            if (abklingzeit > 0 || hammer.length) return;
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) return;
            const cx = juri.centerX(), cy = juri.centerY();
            for (const e of juriGegnerUm(cx, cy, 200)) {
                if (!Juri.lineClear(c.welt, cx, cy, e.centerX(), e.centerY())) continue;
                hammer.push(new JuriWurfhammer(juri, c.welt, Math.atan2(e.centerY() - cy, e.centerX() - cx)));
                abklingzeit = 2.4;
                if (typeof FX !== 'undefined') {
                    FX.burst(cx, cy, ['#ffd23f', '#ff9f2e', '#ffffff'], 6, 90, 0.3, { kind: 'spark' });
                }
                break;
            }
        });
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const h of hammer) h.draw(ctx, camera);
        });
    },
});

// juri06 – Juri dreht sich mit dem Hammer im Kreis.
const JURI_WIRBEL = { dauer: 1.0, abstand: 5, reichweite: 46, schaden: 3, trefferAlle: 0.25 };

registerUpgrade({
    id: 'juri06', figur: 'juri', name: 'Wirbel-Juri', emoji: '🌀',
    text: 'Juri dreht sich mit dem Hammer im Kreis und trifft alles rundherum.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let wirbel = 0, treffer = 0, abklingzeit = 1;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) { wirbel = 0; return; }
            const cx = juri.centerX(), cy = juri.centerY();
            if (wirbel <= 0) {
                if (abklingzeit > 0 || !juriGegnerUm(cx, cy, JURI_WIRBEL.reichweite + 16).length) return;
                wirbel = JURI_WIRBEL.dauer;
                treffer = 0;
                abklingzeit = JURI_WIRBEL.abstand;
                if (typeof FX !== 'undefined') FX.ring(cx, cy, '#7fe0ff', JURI_WIRBEL.reichweite, 0.4, 4);
                return;
            }
            wirbel -= dt;
            treffer -= dt;
            if (typeof FX !== 'undefined' && Math.random() < 0.6) {
                const a = Art.time * 14;
                FX.burst(cx + Math.cos(a) * JURI_WIRBEL.reichweite, cy + Math.sin(a) * JURI_WIRBEL.reichweite,
                    ['#7fe0ff', '#ffffff'], 2, 40, 0.3, { kind: 'spark' });
            }
            if (treffer > 0) return;
            treffer = JURI_WIRBEL.trefferAlle;
            for (const e of juriGegnerUm(cx, cy, JURI_WIRBEL.reichweite)) {
                if (e.iFrames > 0) continue;
                const a = Math.atan2(e.centerY() - cy, e.centerX() - cx);
                e.takeDamage(JURI_WIRBEL.schaden, a, 130);
            }
        });
        juri.hooks.onDraw.push(ctx => {
            if (wirbel <= 0) return;
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            Art.ring(ctx, p.x, p.y, JURI_WIRBEL.reichweite, '#7fe0ff', 2.5, 0.5 + 0.2 * Math.sin(Art.time * 12));
            const a = Art.time * 14;
            juriZeichneHammer(ctx, p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, a, 1.1);
            juriZeichneHammer(ctx, p.x - Math.cos(a) * 26, p.y - Math.sin(a) * 26, a + Math.PI, 1.1);
        });
    },
});

// juri07 – Ein großer Bodenschlag betäubt alle Gegner in der Nähe.
const JURI_ERDBEBEN = { abstand: 6, warnung: 0.4, reichweite: 110, schaden: 5, betaubung: 1.2 };

registerUpgrade({
    id: 'juri07', figur: 'juri', name: 'Erdbeben', emoji: '💥',
    text: 'Juri schlägt so fest auf den Boden, dass alle Gegner in der Nähe benommen umfallen.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let abklingzeit = 2, warnung = 0;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) { warnung = 0; return; }
            const cx = juri.centerX(), cy = juri.centerY();
            if (warnung > 0) {
                warnung -= dt;
                if (warnung > 0) return;
                // Der Schlag: alle Gegner im Kreis nehmen Schaden und werden benommen
                for (const e of juriGegnerUm(cx, cy, JURI_ERDBEBEN.reichweite)) {
                    const a = Math.atan2(e.centerY() - cy, e.centerX() - cx);
                    e.takeDamage(JURI_ERDBEBEN.schaden, a, 200);
                    if (e.freeze) e.freeze(JURI_ERDBEBEN.betaubung);   // Bosse: kürzer, regelt Enemy.freeze
                    // Bosse werden beim Wegschubsen ebenso gebremst wie bei der Betäubung
                    knockBack(e, a, e.isBoss ? 50 : 240);
                    // Sterne über dem Kopf: die Betäubung soll nicht wie eine Eiswirkung aussehen
                    if (typeof FX !== 'undefined') FX.burst(e.centerX(), e.centerY() - 14, ['#ffe35a', '#ffffff'], 5, 60, 0.55, { kind: 'star' });
                }
                if (typeof FX !== 'undefined') {
                    FX.ring(cx, cy, '#ffd8a8', JURI_ERDBEBEN.reichweite, 0.5, 6);
                    FX.ring(cx, cy, '#ff9f1c', JURI_ERDBEBEN.reichweite * 0.6, 0.4, 4);
                    FX.burst(cx, cy, ['#c9a26b', '#ffd8a8', '#8a5a3a'], 18, 190, 0.55, { gravity: 220 });
                }
                if (Game.camera) Game.camera.shake(9, 0.4);
                return;
            }
            if (abklingzeit > 0) return;
            if (!juriGegnerUm(cx, cy, JURI_ERDBEBEN.reichweite).length) return;
            warnung = JURI_ERDBEBEN.warnung;
            abklingzeit = JURI_ERDBEBEN.abstand;
        });
        // Warnkreis: deutlich sichtbar, bevor es bebt
        juri.hooks.onDraw.push(ctx => {
            if (warnung <= 0) return;
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const k = 1 - warnung / JURI_ERDBEBEN.warnung;
            Art.ring(ctx, p.x, p.y + 6, JURI_ERDBEBEN.reichweite * (0.35 + 0.65 * k), '#ff4d5e', 3, 0.35 + 0.45 * k);
            Art.ring(ctx, p.x, p.y + 6, 10 + 8 * k, '#ffd8a8', 2, 0.6);
        });
    },
});

// Ein freier Platz direkt neben einem Gegner (für Juris Sprung): erste Stelle ohne Wand.
function juriLandepunkt(welt, gegner, vonX, vonY) {
    const ab = Math.max(gegner.w, gegner.h) / 2 + 16;
    const grund = Math.atan2(vonY - gegner.centerY(), vonX - gegner.centerX());
    const vorschlaege = [];
    for (let i = 0; i < 8; i++) {
        const a = grund + (i * Math.PI) / 4;
        vorschlaege.push({ x: gegner.centerX() + Math.cos(a) * ab, y: gegner.centerY() + Math.sin(a) * ab });
    }
    for (const p of vorschlaege) {
        if (!welt || !welt.isWall) return p;
        if (!welt.isWall(p.x - 11, p.y - 11) && !welt.isWall(p.x + 11, p.y - 11) &&
            !welt.isWall(p.x - 11, p.y + 11) && !welt.isWall(p.x + 11, p.y + 11)) return p;
    }
    return vorschlaege[0];
}

// juri08 – Juri stellt sich vor Mark und fängt Geschosse ab.
const JURI_BESCHUERZER = { radius: 30, abstand: 200 };

registerUpgrade({
    id: 'juri08', figur: 'juri', name: 'Beschützer', emoji: '🛡️',
    text: 'Juri stellt sich vor Mark und fängt gegnerische Geschosse mit dem Hammer ab.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri || !c.player) return;
        const juri = c.juri, player = c.player;
        let schutzblitz = 0;
        juri.hooks.onUpdate.push(dt => {
            if (schutzblitz > 0) schutzblitz -= dt;
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) return;
            // Vor Mark stellen: genau zwischen ihn und den nächsten Gegner
            const mark = juriMarkMitte(player);
            const naechste = juriGegnerUm(mark.x, mark.y, JURI_BESCHUERZER.abstand);
            if (!juri.target && naechste.length) {
                const a = Math.atan2(juri.centerY() - naechste[0].centerY(), juri.centerX() - naechste[0].centerX());
                const zx = mark.x + Math.cos(a) * 26, zy = mark.y + Math.sin(a) * 26;
                const d = Math.hypot(zx - juri.centerX(), zy - juri.centerY());
                if (d > 8) {
                    const schritt = Math.min(juri.speed * 1.2 * dt, d - 8);
                    Juri.step(juri, (zx - juri.centerX()) / d * schritt, (zy - juri.centerY()) / d * schritt, c.welt);
                }
            }
            // Geschosse abfangen, die in Juris Bogenflugbahn ankommen
            if (!Game.projectiles) return;
            for (let i = Game.projectiles.length - 1; i >= 0; i--) {
                const p = Game.projectiles[i];
                if (!p || p.owner !== 'enemy' || !(p instanceof Projectile)) continue;
                if (Math.hypot(p.x - juri.centerX(), p.y - juri.centerY()) > JURI_BESCHUERZER.radius) continue;
                Game.projectiles.splice(i, 1);
                schutzblitz = 0.3;
                if (typeof FX !== 'undefined') {
                    FX.burst(p.x, p.y, ['#7fe0ff', '#ffffff', '#ffd23f'], 9, 130, 0.4, { kind: 'spark' });
                    FX.ring(juri.centerX(), juri.centerY(), '#7fe0ff', JURI_BESCHUERZER.radius, 0.25, 3);
                }
            }
        });
        // Schildbogen vor Juri: hell aufblitzend, wenn er etwas abfängt
        juri.hooks.onDraw.push(ctx => {
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const naechste = juriGegnerUm(juri.centerX(), juri.centerY(), JURI_BESCHUERZER.abstand);
            const a = naechste.length
                ? Math.atan2(naechste[0].centerY() - juri.centerY(), naechste[0].centerX() - juri.centerX())
                : (juri.faceX || 1) > 0 ? 0 : Math.PI;
            const stärke = schutzblitz > 0 ? 0.85 : 0.3;
            ctx.save();
            ctx.strokeStyle = '#7fe0ff';
            ctx.lineWidth = schutzblitz > 0 ? 4 : 2.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(p.x, p.y, JURI_BESCHUERZER.radius, a - 0.95, a + 0.95);
            ctx.stroke();
            ctx.restore();
            Art.glow(ctx, p.x + Math.cos(a) * JURI_BESCHUERZER.radius, p.y + Math.sin(a) * JURI_BESCHUERZER.radius,
                12, '#7fe0ff', stärke * 0.6);
        });
    },
});

// juri09 – Juri heilt Mark ab und zu ein halbes Herz.
const JURI_HEILUNG = { abstand: 7, naehe: 120, halbesHerz: 2 };

registerUpgrade({
    id: 'juri09', figur: 'juri', name: 'Heil-Hammer', emoji: '💗',
    text: 'Juri hämmert Wunden zu und heilt Mark alle paar Sekunden ein halbes Herz.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri || !c.player) return;
        const juri = c.juri, player = c.player;
        const herzen = [];
        let abklingzeit = 3;
        juri.hooks.onUpdate.push(dt => {
            for (let i = herzen.length - 1; i >= 0; i--) {
                herzen[i].t += dt;
                if (herzen[i].t > 1) herzen.splice(i, 1);
            }
            abklingzeit -= dt;
            if (abklingzeit > 0) return;
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0 || player.dead || player.hp >= player.maxHp) return;
            const mark = juriMarkMitte(player);
            if (Math.hypot(mark.x - juri.centerX(), mark.y - juri.centerY()) > JURI_HEILUNG.naehe) return;
            abklingzeit = JURI_HEILUNG.abstand;
            player.heal(JURI_HEILUNG.halbesHerz);
            herzen.push({ x: mark.x, y: mark.y - 10, t: 0 });
            if (typeof FX !== 'undefined') {
                FX.burst(mark.x, mark.y, ['#ff8aa8', '#ffffff', '#ffd23f'], 8, 90, 0.5, { kind: 'star' });
                FX.ring(juri.centerX(), juri.centerY(), '#ff8aa8', 22, 0.35, 3);
            }
        });
        // die aufsteigenden halben Herzen über Mark
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            for (const h of herzen) {
                const p = camera.worldToScreen(h.x, h.y - h.t * 22);
                ctx.save();
                ctx.globalAlpha = h.t < 0.15 ? h.t / 0.15 : Math.max(0, 1 - (h.t - 0.15) / 0.85);
                Art.heart(ctx, p.x, p.y, 5, '#ff5a7a', { outline: '#7a1020' });
                ctx.restore();
            }
        });
    },
});

// juri10 – Juri springt auf weit entfernte Gegner.
const JURI_SPRUNG = { abstand: 3.2, dauer: 0.28, von: 70, bis: 150, schaden: 4 };

registerUpgrade({
    id: 'juri10', figur: 'juri', name: 'Hammer-Sprung', emoji: '🦘',
    text: 'Juri springt weit weg stehende Gegner an und schlägt sofort zu.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let sprung = null, abklingzeit = 0.05;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            const cx = juri.centerX(), cy = juri.centerY();
            if (sprung) {
                sprung.t += dt;
                const k = clamp(sprung.t / sprung.dauer, 0, 1);
                juri.x = sprung.x0 + (sprung.x1 - sprung.x0) * k;
                juri.y = sprung.y0 + (sprung.y1 - sprung.y0) * k;
                juri.moving = true;
                if (typeof FX !== 'undefined') {
                    FX.burst(cx, cy + 8, 'rgba(240,235,255,0.8)', 2, 26, 0.3, { kind: 'smoke', size: 3 });
                }
                if (k < 1) return;
                // Ankunft: der Hammer saust auf alle Gegner um die Landestelle
                sprung = null;
                juri.stuckTimer = 0;
                const nx = juri.centerX(), ny = juri.centerY();
                for (const e of juriGegnerUm(nx, ny, 30)) {
                    const a = Math.atan2(e.centerY() - ny, e.centerX() - nx);
                    e.takeDamage(JURI_SPRUNG.schaden, a, 190);
                }
                if (typeof FX !== 'undefined') {
                    FX.ring(nx, ny + 6, '#ffd23f', 34, 0.35, 4);
                    FX.burst(nx, ny + 8, ['#c9a26b', '#fff6a8'], 10, 130, 0.4, { gravity: 200 });
                }
                if (Game.camera) Game.camera.shake(4, 0.16);
                return;
            }
            if (abklingzeit > 0 || juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) return;
            const mark = Game.player ? juriMarkMitte(Game.player) : { x: cx, y: cy };
            const px = mark.x, py = mark.y;
            for (const e of juriGegnerUm(cx, cy, JURI_SPRUNG.bis)) {
                const d = Math.hypot(e.centerX() - cx, e.centerY() - cy);
                if (d < JURI_SPRUNG.von) continue;
                if (Math.hypot(e.centerX() - px, e.centerY() - py) > 150) continue;   // bleibt in Marks Leine
                if (!Juri.lineClear(c.welt, cx, cy, e.centerX(), e.centerY())) continue;
                const ziel = juriLandepunkt(c.welt, e, cx, cy);
                sprung = {
                    t: 0, dauer: JURI_SPRUNG.dauer, x0: juri.x, y0: juri.y,
                    x1: ziel.x - juri.w / 2, y1: ziel.y - juri.h / 2,
                };
                abklingzeit = JURI_SPRUNG.abstand;
                juri.faceX = e.centerX() >= cx ? 1 : -1;
                if (typeof FX !== 'undefined') FX.burst(cx, cy + 8, 'rgba(240,235,255,0.9)', 8, 90, 0.35, { kind: 'smoke', size: 4 });
                break;
            }
        });
        // Sprungbahn: Strich von dort, wo Juri abgestoßen ist, bis zu ihm
        juri.hooks.onDraw.push(ctx => {
            if (!sprung) return;
            const camera = Game.camera;
            if (!camera) return;
            const a = camera.worldToScreen(sprung.x0 + juri.w / 2, sprung.y0 + juri.h / 2);
            const p = juriSchirm(camera, juri);
            ctx.save();
            ctx.strokeStyle = 'rgba(255,210,63,0.55)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.restore();
            Art.groundShadow(ctx, a.x, a.y + 10, 8, 3, 0.3);
        });
    },
});

// juri11 – Juri läuft und schlägt schneller.
const JURI_FLINK = { tempo: 1.4, schlag: 0.5 };

registerUpgrade({
    id: 'juri11', figur: 'juri', name: 'Flinker Juri', emoji: '💨',
    text: 'Juri läuft und schlägt viel schneller als sonst.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        juri.speed = juri.speed * JURI_FLINK.tempo;
        juri.attackCooldown = JURI_FLINK.schlag;
        let staub = 0;
        juri.hooks.onUpdate.push(dt => {
            staub -= dt;
            if (!juri.moving || staub > 0) return;
            staub = 0.12;
            if (typeof FX !== 'undefined') {
                FX.burst(juri.centerX() - (juri.faceX || 1) * 9, juri.centerY() + 9,
                    'rgba(240,235,255,0.85)', 2, 40, 0.28, { kind: 'smoke', size: 3 });
            }
        });
        // Fahrtwind: zwei Striche hinter ihm her
        juri.hooks.onDraw.push(ctx => {
            if (!juri.moving) return;
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const f = -(juri.faceX || 1);
            ctx.save();
            ctx.strokeStyle = '#7fe0ff';
            ctx.lineCap = 'round';
            for (let i = 0; i < 2; i++) {
                const laenge = 6 + Math.sin(Art.time * 18 + i * 1.4) * 2.5;
                ctx.lineWidth = 2 - i * 0.6;
                ctx.beginPath();
                ctx.moveTo(p.x + f * 11, p.y - 3 + i * 6);
                ctx.lineTo(p.x + f * (11 + laenge), p.y - 3 + i * 6);
                ctx.stroke();
            }
            ctx.restore();
        });
    },
});

// juri12 – Juri hält doppelt so viel aus.
registerUpgrade({
    id: 'juri12', figur: 'juri', name: 'Dicker Panzer', emoji: '🪖',
    text: 'Juri bekommt einen dicken Panzer und hält doppelt so viel aus.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        juri.maxHp = juri.maxHp * 2;      // 12 auf 24 Lebenspunkte = doppelt so viel
        juri.hp = Math.min(juri.maxHp, juri.hp * 2);
        // Helm und Panzerplatte, damit man es sofort sieht
        juri.hooks.onDraw.push(ctx => {
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const f = juri.faceX || 1;
            const hx = p.x + f * 0.8, hy = p.y - 7.4;
            ctx.save();
            ctx.fillStyle = '#8fa8d6';
            ctx.strokeStyle = '#33507f';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.arc(hx, hy - 1.2, 8.2, Math.PI, TAU);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.roundRect(hx - 9.4, hy - 2.6, 18.8, 2.8, 1.4);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            Art.sparkle(ctx, hx - 3.4, hy - 5.6, 1.7, '#ffffff', 0.8);
            Art.ring(ctx, p.x, p.y + 3, 12.5, '#8fa8d6', 1.6, 0.4);
        });
    },
});

// juri13 – Juri hat in jeder Hand einen Hammer (Weltbelohnung Welt 52, nicht im Shop kaufbar).
registerUpgrade({
    id: 'juri13', figur: 'juri', name: 'Doppelhammer', emoji: '⚒️', welt: 52,
    text: 'Juri hält in jeder Hand einen Hammer und trifft damit zwei Gegner auf einmal.',
    where: 'Welt 52 schaffen',
    istFrei: g => !!g.unlockedDoubleHammer,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        juri.hooks.onHit.push((tg, schaden) => {
            // der zweite Hammer erwischt den nächsten Gegner neben dem Ziel
            const zweiter = juriGegnerUm(tg.centerX(), tg.centerY(), 34, tg)[0];
            if (zweiter && !(zweiter.iFrames > 0)) {
                const a = Math.atan2(zweiter.centerY() - juri.centerY(), zweiter.centerX() - juri.centerX());
                zweiter.takeDamage(schaden, a, 120);
                if (typeof FX !== 'undefined') {
                    FX.burst(zweiter.centerX(), zweiter.centerY(), ['#fff6a8', '#ffd23f', '#ffffff'], 7, 120, 0.35, { kind: 'star' });
                }
            }
            return schaden;
        });
        // zweiter Hammer in der hinteren Hand, spiegelverkehrt zum Schwung
        juri.hooks.onDraw.push(ctx => {
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const f = juri.faceX || 1;
            const winkel = juriHammerWinkel(juri);
            ctx.save();
            ctx.globalAlpha = juri.swinging ? 1 : 0.92;
            juriZeichneHammer(ctx, p.x - f * 7.2, p.y + 3.2, Math.PI - winkel, 1);
            ctx.restore();
            Art.sparkle(ctx, p.x - f * 7.2, p.y - 1, 1.6 + Math.sin(Art.time * 5) * 0.4, '#ffffff', 0.7);
        });
    },
});

// ══════════════════════════════════════════════════════════════
// ── Paket 2 (Auftrag juri2, 18.10.2026): juri14 bis juri25 ──
// Keins davon ist eine Weltbelohnung, also trägt keins ein `welt:`-Feld -
// alle zwölf sind im Shop kaufbar (Preis 500 💎, steht in js/upgrades.js).
// ══════════════════════════════════════════════════════════════

// Gewollte Bewegung eines Gegners (Magnet-Sog, Feder-Sprung, Flucht): sitzt am Gegner und wird
// jeden Bild-Takt neu gesetzt, weil die Engine den Schub sonst in einer Zehntelsekunde dämpft.
// ziel: 'juri' = zu Juri hin, 'weg' = von Juri fort, sonst 'fix' = immer derselbe Winkel.
function juriSchubStart(gegner, sekunden, kraft, ziel, winkel) {
    if (!gegner || gegner.dead) return false;
    gegner._juriSchub = { zeit: sekunden, kraft, ziel, winkel };
    return true;
}

// Ein Takt der gewollten Bewegungen (melden sich Gegner, deren Gegner nicht mehr da sind, von allein ab).
function juriSchubTakt(dt, juri) {
    if (!Game.enemies || !juri) return;
    for (const e of Game.enemies) {
        const s = e && e._juriSchub;
        if (!s) continue;
        if (e.dead) { e._juriSchub = null; continue; }
        s.zeit -= dt;
        if (s.zeit <= 0) { e._juriSchub = null; continue; }
        if (juri.dead) continue;          // die Zähler laufen aus, geschubst wird aber nicht mehr
        const a = s.ziel === 'juri'
            ? Math.atan2(juri.centerY() - e.centerY(), juri.centerX() - e.centerX())
            : (s.ziel === 'weg'
                ? Math.atan2(e.centerY() - juri.centerY(), e.centerX() - juri.centerX())
                : s.winkel);
        knockBack(e, a, s.kraft);
    }
}

// Feder-Sprung hinter einem Gegner: ein zusammengeknallter Coil, aus dem er gerade geschossen wird.
function juriZeichneFeder(ctx, camera, gegner, winkel) {
    const p = camera.worldToScreen(gegner.centerX(), gegner.centerY());
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(winkel + Math.PI);
    ctx.strokeStyle = '#7fe0ff';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
        const x = 6 + i * 4;
        const y = (i % 2 ? 4.2 : -4.2) * (1 - i / 9);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    Art.glow(ctx, p.x, p.y, 16, '#7fe0ff', 0.35);
}

// juri14 – Der Hammer zieht die Gegner rundherum zu Juri (Bosse nur kurz und schwach).
const JURI_MAGNET = { abstand: 3.2, reichweite: 150, dauer: 0.8, kraft: 330, bossDauer: 0.25, bossKraft: 90 };

registerUpgrade({
    id: 'juri14', figur: 'juri', name: 'Magnet-Hammer', emoji: '🧲',
    text: 'Juris Hammer zieht die Gegner rundherum zu sich heran - Bosse wehren sich dagegen.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let abklingzeit = 1, sog = 0;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            if (sog > 0) sog -= dt;
            juriSchubTakt(dt, juri);
            if (abklingzeit > 0 || juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) return;
            const cx = juri.centerX(), cy = juri.centerY();
            const funde = juriGegnerUm(cx, cy, JURI_MAGNET.reichweite);
            if (!funde.length) return;
            abklingzeit = JURI_MAGNET.abstand;
            sog = JURI_MAGNET.dauer;
            for (const e of funde) {
                if (e.isBoss) juriSchubStart(e, JURI_MAGNET.bossDauer, JURI_MAGNET.bossKraft, 'juri');
                else juriSchubStart(e, JURI_MAGNET.dauer, JURI_MAGNET.kraft, 'juri');
                if (typeof FX !== 'undefined') {
                    FX.burst(e.centerX(), e.centerY(), ['#7fe0ff', '#ffffff'], 4, 70, 0.4, { kind: 'spark' });
                }
            }
            if (typeof FX !== 'undefined') FX.ring(cx, cy, '#7fe0ff', JURI_MAGNET.reichweite, 0.45, 3);
        });
        // Sichtbar: gestrichelte Linien laufen von den Gegnern in Juris Hammer, der Sog-Kreis schliesst sich
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            if (sog > 0) {
                const k = clamp(sog / JURI_MAGNET.dauer, 0, 1);
                Art.ring(ctx, p.x, p.y, 13 + 12 * (1 - k), '#7fe0ff', 2, 0.45 + 0.25 * k);
            }
            for (const e of Game.enemies) {
                const s = e && e._juriSchub;
                if (!e || e.dead || !s || s.ziel !== 'juri') continue;
                const q = juriSchirm(camera, e);
                ctx.save();
                ctx.strokeStyle = '#7fe0ff';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.7;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -Art.time * 42;
                ctx.beginPath();
                ctx.moveTo(q.x, q.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                ctx.restore();
            }
        });
    },
});

// juri15 – Getroffene Gegner fliegen weit weg (Bosse rutschen nur ein Stück).
const JURI_FEDER = { antritt: 300, dauer: 0.42, kraft: 470, bossAntritt: 130, bossDauer: 0.14, bossKraft: 150 };

registerUpgrade({
    id: 'juri15', figur: 'juri', name: 'Federhammer', emoji: '🪁',
    text: 'Vom Federhammer getroffene Gegner fliegen weit weg. Bosse lassen sich nicht so leicht wegschleudern.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        juri.hooks.onUpdate.push(dt => juriSchubTakt(dt, juri));
        juri.hooks.onHit.push(tg => {
            const a = Math.atan2(tg.centerY() - juri.centerY(), tg.centerX() - juri.centerX());
            if (tg.isBoss) {
                knockBack(tg, a, JURI_FEDER.bossAntritt);
                juriSchubStart(tg, JURI_FEDER.bossDauer, JURI_FEDER.bossKraft, 'fix', a);
            } else {
                knockBack(tg, a, JURI_FEDER.antritt);
                juriSchubStart(tg, JURI_FEDER.dauer, JURI_FEDER.kraft, 'fix', a);
            }
            if (typeof FX !== 'undefined') {
                FX.burst(tg.centerX(), tg.centerY(), ['#7fe0ff', '#ffffff', '#ffd23f'], 9, 150, 0.45, { kind: 'spark' });
                FX.text(tg.centerX(), tg.centerY() - tg.h / 2 - 12, 'Wusch!', '#7fe0ff', 10, { life: 0.6 });
            }
        });
        // Der Coil ist noch hinter jedem Gegner sichtbar, den die Feder gerade wegshot
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            for (const e of Game.enemies) {
                const s = e && e._juriSchub;
                if (!e || e.dead || !s || s.ziel !== 'fix') continue;
                juriZeichneFeder(ctx, camera, e, s.winkel);
            }
        });
    },
});

// juri16 – Jeder Hammerschlag sprüht Funken auf die Gegner daneben.
const JURI_FUNKEN = { abstand: 0.45, reichweite: 70, schaden: 2, max: 4, dauer: 0.26 };

registerUpgrade({
    id: 'juri16', figur: 'juri', name: 'Funkenregen', emoji: '✨',
    text: 'Jeder Hammerschlag sprüht Funken auf die Gegner daneben und macht ihnen Schaden.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        const bogen = [];
        let abklingzeit = 0;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            for (let i = bogen.length - 1; i >= 0; i--) {
                bogen[i].t += dt;
                if (bogen[i].t > JURI_FUNKEN.dauer) bogen.splice(i, 1);
            }
        });
        juri.hooks.onHit.push(tg => {
            if (abklingzeit > 0) return;
            abklingzeit = JURI_FUNKEN.abstand;
            const nachbarn = juriGegnerUm(tg.centerX(), tg.centerY(), JURI_FUNKEN.reichweite, tg).slice(0, JURI_FUNKEN.max);
            if (!nachbarn.length) {
                if (typeof FX !== 'undefined') {
                    FX.burst(tg.centerX(), tg.centerY(), ['#ffd23f', '#ff9f2e', '#ffffff'], 8, 130, 0.4, { kind: 'spark' });
                }
                return;
            }
            for (const e of nachbarn) {
                if (!(e.iFrames > 0)) e.takeDamage(JURI_FUNKEN.schaden,
                    Math.atan2(e.centerY() - tg.centerY(), e.centerX() - tg.centerX()), 70);
                bogen.push({ x1: tg.centerX(), y1: tg.centerY(), x2: e.centerX(), y2: e.centerY(), t: 0, keim: Math.random() * 10 });
                if (typeof FX !== 'undefined') {
                    FX.burst(e.centerX(), e.centerY(), ['#ffd23f', '#ff9f2e', '#ffffff'], 6, 110, 0.4, { kind: 'spark' });
                }
            }
            if (typeof FX !== 'undefined') FX.ring(tg.centerX(), tg.centerY(), '#ff9f2e', 26, 0.25, 3);
        });
        // Die Funkenbogen: kurze, wacklige Striche vom getroffenen Gegner weg
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            for (const b of bogen) {
                const a = camera.worldToScreen(b.x1, b.y1), z = camera.worldToScreen(b.x2, b.y2);
                const k = 1 - b.t / JURI_FUNKEN.dauer;
                ctx.save();
                ctx.strokeStyle = '#ff9f2e';
                ctx.lineWidth = 2.6 * k + 0.6;
                ctx.lineCap = 'round';
                ctx.globalAlpha = Math.max(0, k);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                const stufen = 3;
                for (let i = 1; i <= stufen; i++) {
                    const f = i / stufen;
                    const wackel = Math.sin(b.keim + i * 2.3 + Art.time * 30) * 4 * (i < stufen ? 1 : 0);
                    ctx.lineTo(a.x + (z.x - a.x) * f - (z.y - a.y) / 40 * wackel,
                        a.y + (z.y - a.y) * f + (z.x - a.x) / 40 * wackel);
                }
                ctx.stroke();
                ctx.restore();
                if (k > 0.5) Art.sparkle(ctx, z.x, z.y, 2.6, '#ffd23f', k);
            }
        });
    },
});

// juri17 – Wird Juri getroffen, schlägt er eine Zeit lang doppelt so fest zu.
const JURI_WUT = { dauer: 3, pause: 6, mehr: 2 };

registerUpgrade({
    id: 'juri17', figur: 'juri', name: 'Wutmodus', emoji: '😡',
    text: 'Wird Juri getroffen, wird er kurz wütend und schlägt so lange doppelt so fest zu.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let wut = 0, pause = 0;
        juri.hooks.onDamaged.push(menge => {
            if (pause <= 0 && !juri.dead) {
                wut = JURI_WUT.dauer;
                pause = JURI_WUT.dauer + JURI_WUT.pause;
                if (typeof FX !== 'undefined') {
                    FX.burst(juri.centerX(), juri.centerY() - 10, ['#ff4d5e', '#ff9f2e', '#ffffff'], 12, 140, 0.5, { kind: 'spark' });
                    FX.text(juri.centerX(), juri.centerY() - 20, 'WUT!', '#ff4d5e', 12, { life: 0.8 });
                    FX.ring(juri.centerX(), juri.centerY(), '#ff4d5e', 30, 0.35, 4);
                }
                if (Game.camera) Game.camera.shake(4, 0.18);
            }
            return menge;
        });
        juri.hooks.onUpdate.push(dt => {
            if (wut > 0) wut -= dt;
            if (pause > 0) pause -= dt;
            if (wut > 0 && Math.random() < 0.35 && typeof FX !== 'undefined') {
                FX.burst(juri.centerX() + randRange(-6, 6), juri.centerY() - 12, ['#ff4d5e', '#ff9f2e'], 2, 40, 0.35, { kind: 'spark' });
            }
        });
        juri.hooks.onHit.push((tg, schaden) => (wut > 0 ? schaden * JURI_WUT.mehr : schaden));
        // Wut-Anzeige: rote Zorn-Falte über den Augen, roter Schimmer, Hammer rot glühend
        juri.hooks.onDraw.push(ctx => {
            if (wut <= 0) return;
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const k = clamp(wut / JURI_WUT.dauer, 0, 1);
            Art.glow(ctx, p.x, p.y, 24, '#ff4d5e', 0.3 + 0.25 * k);
            ctx.save();
            ctx.strokeStyle = '#c8102e';
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            for (const seite of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(p.x + seite * 1.6, p.y - 9.4);
                ctx.lineTo(p.x + seite * 6.2, p.y - 7.2);
                ctx.stroke();
            }
            ctx.restore();
            const a = juriHammerWinkel(juri);
            Art.glow(ctx, p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 15, 14, '#ff4d5e', 0.5);
        });
    },
});

// juri18 – Juris Feuerkreis ist doppelt so groß (innen wie gehabt, außen kommt der Ring dazu).
const JURI_FEUERKREIS = { innen: 80, aussen: 160, schaden: 4 };

registerUpgrade({
    id: 'juri18', figur: 'juri', name: 'Großer Feuerkreis', emoji: '🌋',
    text: 'Juris Feuerkreis ist doppelt so groß und steckt auch die Gegner weit draußen in Brand.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        // Der Feuerkreis ist hier Teil des Extras: ohne ihn gäbe es nichts zu verdoppeln.
        juri.fireCircle = true;
        let gross = 0;
        juri.hooks.onUpdate.push(dt => { if (gross > 0) gross -= dt; });
        juri.hooks.onHit.push(tg => {
            // Der eigentliche Feuerkreis (js/entities.js) wirkt bei jedem dritten Schlag im Kreis von 80;
            // hier kommt der doppelte Ring dazu - alles, was weiter als 80 weg steht.
            if (!(juri.fireCircle && juri.hitCount % 3 === 0)) return;
            gross = 0.5;
            const cx = juri.centerX(), cy = juri.centerY();
            let getroffen = 0;
            for (const e of juriGegnerUm(cx, cy, JURI_FEUERKREIS.aussen, tg)) {
                const d = Math.hypot(e.centerX() - cx, e.centerY() - cy) - Math.max(e.w, e.h) / 2;
                if (d <= JURI_FEUERKREIS.innen - Math.max(e.w, e.h)) continue;   // im kleinen Kreis war es schon
                e.takeDamage(JURI_FEUERKREIS.schaden, Math.atan2(e.centerY() - cy, e.centerX() - cx), 150);
                if (typeof FX !== 'undefined') {
                    FX.burst(e.centerX(), e.centerY(), ['#ff5a1f', '#ffd23f', '#ff9f1c'], 6, 110, 0.45);
                }
                getroffen++;
            }
            if (typeof FX !== 'undefined') {
                FX.ring(cx, cy, '#ff5a1f', JURI_FEUERKREIS.aussen, 0.55, 6);
                FX.ring(cx, cy, '#ffd23f', JURI_FEUERKREIS.aussen * 0.75, 0.45, 4);
                FX.burst(cx, cy, ['#ff5a1f', '#ffd23f', '#ff9f1c'], 20, 240, 0.6);
            }
            if (getroffen && Game.camera) Game.camera.shake(5, 0.2);
        });
        // Der große Kreis steht als flammender Rand um Juri: schwach, wenn er sich auflädt, voll im Schlag
        juri.hooks.onDraw.push(ctx => {
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const geladen = juri.fireCircle && juri.hitCount % 3 === 2;
            if (gross > 0) {
                const k = gross / 0.5;
                Art.ring(ctx, p.x, p.y + 4, JURI_FEUERKREIS.aussen * (1.04 - 0.06 * k), '#ff5a1f', 4, 0.75 * k);
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU + Art.time * 1.4;
                    juriZeichneFlammen(ctx,
                        p.x + Math.cos(a) * JURI_FEUERKREIS.aussen * 0.98,
                        p.y + 4 + Math.sin(a) * JURI_FEUERKREIS.aussen * 0.55,
                        3.4, Art.time + i);
                }
            } else if (geladen) {
                ctx.save();
                ctx.strokeStyle = '#ff9f1c';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.5 + 0.2 * Math.sin(Art.time * 9);
                ctx.setLineDash([7, 8]);
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + 4, JURI_FEUERKREIS.aussen, JURI_FEUERKREIS.aussen * 0.55, 0, 0, TAU);
                ctx.stroke();
                ctx.restore();
            }
        });
    },
});

// juri19 – Juri wirbelt den Hammer um sich; gegnerische Geschosse prallen zurück.
const JURI_SCHILD = { radius: 30, tempo: 9 };

registerUpgrade({
    id: 'juri19', figur: 'juri', name: 'Hammer-Schild', emoji: '🔄',
    text: 'Juri wirbelt seinen Hammer im Kreis, und gegnerische Geschosse prallen an ihm zurück.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let abwehr = 0;
        const auswerfen = [];
        juri.hooks.onUpdate.push(dt => {
            if (abwehr > 0) abwehr -= dt;
            auswerfen.length = 0;
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0 || !Game.projectiles) return;
            const cx = juri.centerX(), cy = juri.centerY();
            for (const p of Game.projectiles) {
                if (!p || p.dead || p.owner !== 'enemy' || !(p instanceof Projectile) || p._juriAbwehr) continue;
                if (Math.hypot(p.x - cx, p.y - cy) > JURI_SCHILD.radius + (p.radius || 5)) continue;
                abwehr = 0.3;
                // Sondergeschosse (Giftstaude, Clownball, Schneeball ...) prüfen ihren Treffer in ihrem
                // eigenen update() selbst - ob Freund oder Feind. Die dreht man nicht um, die schlägt
                // Juri aus dem Feld; nur die normalen Geschosse (Kern-update) fliegen zurück.
                if (Object.getPrototypeOf(p).update !== Projectile.prototype.update) {
                    p.dead = true;
                    auswerfen.push(p);
                    if (typeof FX !== 'undefined') {
                        FX.burst(p.x, p.y, ['#7fe0ff', '#ffffff'], 9, 130, 0.4, { kind: 'spark' });
                        FX.ring(p.x, p.y, '#7fe0ff', 20, 0.28, 3);
                    }
                    Sound.hit();
                    continue;
                }
                // Zurück zum Abschusspunkt: gleiche Richtung, wie sie ankam, nur umgedreht.
                const tempo = Math.hypot(p.vx, p.vy) || 240;
                const a = Math.atan2(p.y - cy, p.x - cx);
                p.vx = Math.cos(a) * tempo;
                p.vy = Math.sin(a) * tempo;
                p.owner = 'player';
                p.damage = clamp(p.damage || 2, 2, 4);
                p.knockback = 140;
                p.bouncesLeft = 1;
                p.lifetime = Math.max(p.lifetime, 1.2);
                p.hitsCompanions = false;
                p.stunTime = 0;
                p.boom = false;
                p.splitBurst = null;
                p.freeze = 0;
                p.pierce = 0;
                p.pierceHits = null;
                p.laser = false;
                p.pandaPlant = false;
                p.slow = false;
                p.poison = false;
                p.explosive = false;
                p.big = false;
                p._juriAbwehr = true;
                if (typeof FX !== 'undefined') {
                    FX.burst(p.x, p.y, ['#7fe0ff', '#ffffff', '#ffd23f'], 10, 150, 0.4, { kind: 'spark' });
                    FX.ring(cx, cy, '#7fe0ff', JURI_SCHILD.radius, 0.25, 4);
                }
            }
            for (const p of auswerfen) {
                const i = Game.projectiles.indexOf(p);
                if (i >= 0) Game.projectiles.splice(i, 1);
            }
        });
        // Der Wirbel: Hammer kreist sichtbar um Juri, der Bogen leuchtet bei Abwehr hell auf
        juri.hooks.onDraw.push(ctx => {
            const camera = Game.camera;
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            const a = Art.time * JURI_SCHILD.tempo;
            const staerke = abwehr > 0 ? 0.9 : 0.35;
            ctx.save();
            ctx.strokeStyle = abwehr > 0 ? '#ffffff' : '#7fe0ff';
            ctx.lineWidth = abwehr > 0 ? 3.4 : 2;
            ctx.globalAlpha = staerke;
            ctx.beginPath();
            ctx.arc(p.x, p.y, JURI_SCHILD.radius, 0, TAU);
            ctx.stroke();
            ctx.restore();
            for (let i = 0; i < 3; i++) {
                const w = a - i * 0.5;
                ctx.save();
                ctx.globalAlpha = 1 - i * 0.3;
                juriZeichneHammer(ctx, p.x + Math.cos(w) * JURI_SCHILD.radius, p.y + Math.sin(w) * JURI_SCHILD.radius * 0.75, w + Math.PI / 2, 0.85);
                ctx.restore();
            }
            Art.glow(ctx, p.x + Math.cos(a) * JURI_SCHILD.radius, p.y + Math.sin(a) * JURI_SCHILD.radius * 0.75,
                13, '#7fe0ff', 0.45 + (abwehr > 0 ? 0.35 : 0));
        });
    },
});

// juri20 – Juri öffnet Truhen mit einem Schlag, und in ihnen stecken mehr Münzen.
const JURI_TRUHEN = { suche: 260,leine: 230, reichweite: 40, ausholen: 66, muenzen: 6, wartefrist: 1.6 };

registerUpgrade({
    id: 'juri20', figur: 'juri', name: 'Truhenknacker', emoji: '🔓',
    text: 'Juri öffnet Truhen mit einem einzigen Schlag, und darin stecken mehr Münzen als sonst.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri || !c.player) return;
        const juri = c.juri, player = c.player;
        let bester = JURI_TRUHEN.suche, blockiert = 0, letztes = null;   // kommt er nicht ran, gibt er die Truhe auf
        const chancen = new WeakMap();                 // Truhen hinter Mauern versucht er nicht ewig
        juri.hooks.onUpdate.push(dt => {
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) return;
            if (juri.target || !Game.chests) return;   // erst kämpfen, dann Truhen knacken
            const cx = juri.centerX(), cy = juri.centerY();
            const mark = juriMarkMitte(player);
            let ziel = null, abstand = JURI_TRUHEN.suche;
            for (const ch of Game.chests) {
                if (!ch || ch.opened || (chancen.get(ch) || 0) >= 3) continue;
                const mx = ch.x + ch.w / 2, my = ch.y + ch.h / 2;
                if (Math.hypot(mx - mark.x, my - mark.y) > JURI_TRUHEN.leine) continue;  // sonst holt ihn die Engine zurück
                const d = Math.hypot(mx - cx, my - cy);
                if (d < abstand) { abstand = d; ziel = ch; }
            }
            if (!ziel) return;
            const tx = ziel.x + ziel.w / 2, ty = ziel.y + ziel.h / 2;
            juri.faceX = tx >= cx ? 1 : -1;
            if (ziel !== letztes) { letztes = ziel; bester = abstand; blockiert = 0; }
            // kommt er nicht nah genug heran, holt er aus und haut aus größerer Entfernung drauf
            const ran = (chancen.get(ziel) || 0) > 0 ? JURI_TRUHEN.ausholen : JURI_TRUHEN.reichweite;
            if (abstand > ran) {
                if (abstand < bester - 0.4) { bester = abstand; blockiert = 0; } else blockiert += dt;
                if (blockiert > JURI_TRUHEN.wartefrist) {
                    bester = JURI_TRUHEN.suche; blockiert = 0;
                    chancen.set(ziel, Math.min(3, (chancen.get(ziel) || 0) + 1));
                    return;
                }
                // Tempo 2.6: Marks Rückholzug (1,5-faches Tempo) muss Juri dagegen auslaufen
                const len = Math.min(juri.speed * 2.6 * dt, abstand - ran + 8);
                Juri.step(juri, (tx - cx) / abstand * len, (ty - cy) / abstand * len, c.welt);
                juri.moving = true;
                if (typeof FX !== 'undefined' && Math.random() < 0.25) {
                    FX.burst(juri.centerX() - (juri.faceX || 1) * 9, juri.centerY() + 9,
                        'rgba(240,235,255,0.8)', 2, 30, 0.3, { kind: 'smoke', size: 3 });
                }
                return;
            }
            // Ein Schlag, und die Truhe geht auf - mit mehr Münzen als die normale Hand-Truhe (drei)
            juri.swinging = true;
            juri.swingTimer = 0.28;
            juri.swingAngle = Math.atan2(ty - cy, tx - cx);
            juri.attackTimer = Math.max(juri.attackTimer, 0.4);
            ziel.open();
            Progress.onChest();
            Sound.chest();
            for (let i = 0; i < JURI_TRUHEN.muenzen; i++) Game._dropCoin(tx, ty, randInt(2, 5), true);
            const namen = { heart: 'Herz! ❤️', halfheart: 'Halbes Herz! ❤️', speed: 'Tempo! ⚡', attack: 'Stärke! 💪' };
            HUD.toast(namen[(ziel.item || {}).type] || 'Truhe geknackt! 🔓', '#ffe38a', 1.8);
            if (typeof FX !== 'undefined') {
                FX.burst(tx, ty, ['#ffd23f', '#fff6a8', '#ff9f1c'], 18, 170, 0.7, { kind: 'star', gravity: 160 });
                FX.ring(tx, ty, '#ffd23f', 34, 0.4, 4);
                FX.text(tx, ty - 18, 'Knack!', '#ffd23f', 12, { life: 0.8 });
            }
            if (Game.camera) Game.camera.shake(3, 0.16);
        });
        // Merker über noch zu machenden Truhen: kleiner Hammer, der auf und ab wippt
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera || !Game.chests) return;
            for (const ch of Game.chests) {
                if (!ch || ch.opened) continue;
                const p = camera.worldToScreen(ch.x + ch.w / 2, ch.y - 6 + Math.sin(Art.time * 4) * 1.6);
                juriZeichneHammer(ctx, p.x + 9, p.y - 8, -Math.PI / 2 + Math.sin(Art.time * 4) * 0.35, 0.62);
            }
        });
    },
});

// juri21 – Juri läuft von selbst zum Gegner mit dem Schlüssel (und danach zum Schlüssel selbst).
const JURI_SPUR = { leash: 240, tempo: 2.6, wartefrist: 1.5 };   // 2,6: gegen Marks Rückholzug (1,5) anlaufen

registerUpgrade({
    id: 'juri21', figur: 'juri', name: 'Spürnase', emoji: '👃',
    text: 'Juri läuft von selbst zum Gegner mit dem Schlüssel und ihn niederschlagen lässt.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri || !c.player) return;
        const juri = c.juri, player = c.player;
        let schnueffeln = 0, letzte = Infinity, blockiert = 0;   // läuft er gegen eine Mauer, wartet er kurz
        // Das Ziel: der Träger, und wenn keiner mehr lebt, der gefallene Schlüssel
        const spaehAus = () => {
            if (Game.hasKey) return null;
            let best = null, beste = Infinity;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead || !e.isKeyGhost) continue;
                const d = Math.hypot(e.centerX() - juri.centerX(), e.centerY() - juri.centerY());
                if (d < beste) { beste = d; best = { x: e.centerX(), y: e.centerY(), gegner: e }; }
            }
            if (best) return best;
            beste = Infinity;
            for (const k of (Game.keyDrops || [])) {
                if (!k || k.collected) continue;
                const d = Math.hypot(k.x + k.w / 2 - juri.centerX(), k.y + k.h / 2 - juri.centerY());
                if (d < beste) { beste = d; best = { x: k.x + k.w / 2, y: k.y + k.h / 2 }; }
            }
            return best;
        };
        juri.hooks.onUpdate.push(dt => {
            if (schnueffeln > 0) schnueffeln -= dt;
            if (juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) return;
            const ziel = spaehAus();
            if (!ziel) return;
            if (juri.target === ziel.gegner) return;   // der Gegner ist sowieso sein Kampfziel
            const cx = juri.centerX(), cy = juri.centerY();
            const dx = ziel.x - cx, dy = ziel.y - cy;
            const d = Math.hypot(dx, dy);
            schnueffeln = 0.4;
            // nicht weiter als Marks Leine (sonst holt ihn die Engine ohnehin zurück)
            const mark = juriMarkMitte(player);
            if (Math.hypot(ziel.x - mark.x, ziel.y - mark.y) > JURI_SPUR.leash) return;
            const stop = ziel.gegner ? 14 + Math.max(ziel.gegner.w, ziel.gegner.h) / 2 : 10;
            if (d <= stop) return;
            if (d < letzte - 0.4) { letzte = d; blockiert = 0; } else blockiert += dt;
            if (blockiert > JURI_SPUR.wartefrist) { letzte = Infinity; blockiert = -1.2; return; }
            juri.faceX = dx >= 0 ? 1 : -1;
            const len = Math.min(juri.speed * JURI_SPUR.tempo * dt, d - stop);
            Juri.step(juri, dx / d * len, dy / d * len, c.welt);
            juri.moving = true;
            juri.stuckTimer = 0;
            if (typeof FX !== 'undefined' && Math.random() < 0.3) {
                FX.burst(cx + (juri.faceX || 1) * 6, cy - 2, 'rgba(255,246,168,0.9)', 2, 26, 0.4, { kind: 'smoke', size: 3 });
            }
        });
        // Sichtbar: Witterungslinie von Juri zum Ziel und ein Schlüssel über dem Träger
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            const ziel = spaehAus();
            if (!ziel) return;
            const p = juriSchirm(camera, juri), z = camera.worldToScreen(ziel.x - 8, ziel.y - 8);
            const zx = z.x + 8, zy = z.y + 8;
            ctx.save();
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 2.2;
            ctx.globalAlpha = 0.55 + (schnueffeln > 0 ? 0.3 : 0);
            ctx.setLineDash([6, 7]);
            ctx.lineDashOffset = -Art.time * 34;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 4);
            ctx.quadraticCurveTo((p.x + zx) / 2, Math.min(p.y, zy) - 26, zx, zy - 12);
            ctx.stroke();
            ctx.restore();
            Art.key(ctx, zx - 5, zy - 16 + Math.sin(Art.time * 5) * 1.8, 5.4, '#ffd23f');
            if (schnueffeln > 0) Art.sparkle(ctx, p.x + (juri.faceX || 1) * 6, p.y - 4, 2.2, '#fff6a8', 0.9);
        });
    },
});

// juri22 – Nach einem K.o. steht Juri doppelt so schnell wieder auf.
registerUpgrade({
    id: 'juri22', figur: 'juri', name: 'Stehaufmännchen', emoji: '🤸',
    text: 'Nach einem K.o. steht Juri doppelt so schnell wieder auf und kämpft weiter.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let lag = false;
        juri.hooks.onUpdate.push(() => {
            if (juri.koTimer > 0) {
                if (!lag) {
                    lag = true;
                    // die halbe Liegezeit - nie unter 0,3 s, damit die Engine ihn regulär aufstehen lässt
                    juri.koTimer = Math.max(0.3, juri.koTimer / 2);
                    if (typeof FX !== 'undefined') {
                        FX.burst(juri.centerX(), juri.centerY(), '#ffd23f', 10, 90, 0.5, { kind: 'star' });
                        FX.text(juri.centerX(), juri.centerY() - 18, 'Halbe Zeit!', '#ffd23f', 11, { life: 0.9 });
                    }
                }
                if (Math.random() < 0.25 && typeof FX !== 'undefined') {
                    FX.burst(juri.centerX() + randRange(-8, 8), juri.centerY() + 6, ['#ffd23f', '#ffffff'], 2, 40, 0.4, { kind: 'spark' });
                }
                return;
            }
            if (lag) {
                lag = false;
                if (typeof FX !== 'undefined') {
                    FX.ring(juri.centerX(), juri.centerY(), '#ffd23f', 30, 0.35, 4);
                    FX.text(juri.centerX(), juri.centerY() - 20, 'Auf!', '#6ee06e', 12, { life: 0.8 });
                }
            }
        });
        // Liegt er, federt unter ihm eine goldene Feder und ein Pfeil-Kreis sagt: er kommt gleich hoch
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera || !(juri.koTimer > 0)) return;
            const p = juriSchirm(camera, juri);
            const z = clamp(juri.koTimer / Math.max(0.001, juri.koDur), 0, 1);
            ctx.save();
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            for (let i = 0; i <= 6; i++) {
                const x = p.x - 10 + i * 4;
                const y = p.y + 11 + (i % 2 ? -2.6 : 2.6) * (0.4 + 0.6 * Math.sin(Art.time * 10 + i));
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(p.x, p.y - 17, 6.4, -Math.PI * 0.4, -Math.PI * 0.4 + TAU * 0.78);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p.x + 3.4, p.y - 23.6);
            ctx.lineTo(p.x + 6.6, p.y - 20.4);
            ctx.lineTo(p.x + 1.6, p.y - 19.4);
            ctx.closePath();
            ctx.fillStyle = '#ffd23f';
            ctx.fill();
            ctx.restore();
            Art.ring(ctx, p.x, p.y, 15 + 6 * (1 - z), '#6ee06e', 1.8, 0.3 + 0.4 * (1 - z));
        });
    },
});

// juri23 – Gegner in der Nähe erschrecken und laufen kurz weg (Bosse nur ein kurzer Schubs).
const JURI_SCHREI = { abstand: 7, reichweite: 120, dauer: 1.2, kraft: 250, antritt: 170, bossDauer: 0.3, bossKraft: 85 };

registerUpgrade({
    id: 'juri23', figur: 'juri', name: 'Kampfschrei', emoji: '📣',
    text: 'Juris Kampfschrei erschreckt die Gegner in der Nähe, und sie rennen kurz weg. Bosse lassen sich nicht erschrecken.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        let abklingzeit = 2, schrei = 0;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            if (schrei > 0) schrei -= dt;
            juriSchubTakt(dt, juri);
            for (const e of (Game.enemies || [])) {
                if (e && e._juriAngst > 0) e._juriAngst -= dt;
            }
            if (abklingzeit > 0 || juri.dead || juri.koTimer > 0 || juri.stunTimer > 0 || juri.sleepTimer > 0) return;
            const cx = juri.centerX(), cy = juri.centerY();
            const funde = juriGegnerUm(cx, cy, JURI_SCHREI.reichweite);
            if (!funde.length) return;
            abklingzeit = JURI_SCHREI.abstand;
            schrei = 0.45;
            for (const e of funde) {
                const a = Math.atan2(e.centerY() - cy, e.centerX() - cx);
                if (e.isBoss) {
                    knockBack(e, a, JURI_SCHREI.bossKraft);
                    juriSchubStart(e, JURI_SCHREI.bossDauer, JURI_SCHREI.bossKraft, 'weg');
                } else {
                    knockBack(e, a, JURI_SCHREI.antritt);
                    juriSchubStart(e, JURI_SCHREI.dauer, JURI_SCHREI.kraft, 'weg');
                    e._juriAngst = JURI_SCHREI.dauer;
                }
                if (typeof FX !== 'undefined') {
                    FX.burst(e.centerX(), e.centerY() - e.h / 2, ['#ffffff', '#ffe35a'], 4, 60, 0.4, { kind: 'star' });
                }
            }
            if (typeof FX !== 'undefined') {
                FX.ring(cx, cy, '#ffe35a', JURI_SCHREI.reichweite, 0.5, 5);
                FX.ring(cx, cy, '#ffffff', JURI_SCHREI.reichweite * 0.55, 0.35, 3);
                FX.text(cx, cy - 24, 'Raaaah!', '#ffe35a', 13, { life: 0.8 });
            }
            if (Game.camera) Game.camera.shake(5, 0.22);
        });
        // Sichtbar: Schallwellen aus Juris Mund und ein Ausrufezeichen über den Erschrockenen
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            const p = juriSchirm(camera, juri);
            if (schrei > 0) {
                const k = 1 - schrei / 0.45;
                for (let i = 0; i < 3; i++) {
                    const r = 14 + (k * 0.8 + i * 0.28) * 42;
                    ctx.save();
                    ctx.strokeStyle = '#ffe35a';
                    ctx.lineWidth = 2.6 - i * 0.6;
                    ctx.globalAlpha = Math.max(0, 0.85 - k * 0.7 - i * 0.12);
                    ctx.beginPath();
                    ctx.arc(p.x, p.y - 4, r, -0.85, 0.85);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            for (const e of Game.enemies) {
                if (!e || e.dead || !(e._juriAngst > 0)) continue;
                const q = juriSchirm(camera, e);
                const hoch = Math.abs(Math.sin(Art.time * 9 + (e.seed || 0))) * 2.5;
                Art.text(ctx, '!', q.x + e.w / 2 - 1, q.y - e.h / 2 - 9 - hoch,
                    { size: 13, color: '#ffe35a', outline: 'rgba(40,20,60,0.9)', lineWidth: 3 });
            }
        });
    },
});

// juri24 – Der Hammer springt von Gegner zu Gegner.
const JURI_GUMMI = { abstand: 1.5, reichweite: 90, spruenge: 3, schaden: 3, tempo: 780 };

// Der springende Gummihammer: hüpft von Gegner zu Gegner und trifft jeden beim Ankommen.
class JuriGummiHieb {
    constructor(juri, von) {
        this.juri = juri;
        this.x = von.centerX();
        this.y = von.centerY();
        this.vonX = this.x; this.vonY = this.y;
        this.getroffen = new Set([von]);
        this.spruenge = JURI_GUMMI.spruenge;
        this.schaden = JURI_GUMMI.schaden;
        this.ziel = null;
        this.dead = false;
        this.drehung = 0;
        this._suche();
        if (!this.ziel) this.dead = true;
    }

    // nächster Gegner in Sprungreichweite, den der Hammer noch nicht getroffen hat
    _suche() {
        let best = null, beste = JURI_GUMMI.reichweite;
        for (const e of juriGegnerUm(this.x, this.y, JURI_GUMMI.reichweite)) {
            if (this.getroffen.has(e)) continue;
            const d = Math.hypot(e.centerX() - this.x, e.centerY() - this.y);
            if (d < beste) { beste = d; best = e; }
        }
        this.ziel = best;
        this.vonX = this.x; this.vonY = this.y;
    }

    update(dt) {
        if (!this.ziel || this.ziel.dead) {
            this._suche();
            if (!this.ziel) { this.dead = true; return; }
        }
        const e = this.ziel;
        const dx = e.centerX() - this.x, dy = e.centerY() - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.drehung += dt * 22;
        const schritt = JURI_GUMMI.tempo * dt;
        if (d <= schritt + 6) {
            this.x = e.centerX(); this.y = e.centerY();
            if (!(e.iFrames > 0)) e.takeDamage(this.schaden, Math.atan2(dy, dx), 100);
            this.getroffen.add(e);
            if (typeof FX !== 'undefined') {
                FX.burst(this.x, this.y, ['#7dff5a', '#ffffff', '#ffd23f'], 7, 110, 0.4, { kind: 'spark' });
            }
            this.spruenge--;
            this.ziel = null;
            if (this.spruenge <= 0) { this.dead = true; return; }
            this._suche();
            if (!this.ziel) this.dead = true;
            return;
        }
        this.x += dx / d * schritt;
        this.y += dy / d * schritt;
        if (typeof FX !== 'undefined' && Math.random() < 0.5) {
            FX.burst(this.x, this.y, ['#7dff5a', '#ffffff'], 2, 40, 0.3, { size: 2 });
        }
    }

    draw(ctx, camera) {
        if (!camera) return;
        const a = camera.worldToScreen(this.vonX, this.vonY), p = camera.worldToScreen(this.x, this.y);
        // Gummiband von der letzten Sprungstelle
        ctx.save();
        ctx.strokeStyle = '#7dff5a';
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + p.x) / 2, Math.min(a.y, p.y) - 16, p.x, p.y);
        ctx.stroke();
        ctx.restore();
        Art.glow(ctx, p.x, p.y, 14, '#7dff5a', 0.45);
        juriZeichneHammer(ctx, p.x, p.y, this.drehung, 0.95);
    }
}

registerUpgrade({
    id: 'juri24', figur: 'juri', name: 'Gummihammer', emoji: '🪀',
    text: 'Juris Hammer springt nach einem Treffer von Gegner zu Gegner und trifft jeden.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const juri = c.juri;
        const hiebe = [];
        let abklingzeit = 0;
        juri.hooks.onUpdate.push(dt => {
            if (abklingzeit > 0) abklingzeit -= dt;
            for (let i = hiebe.length - 1; i >= 0; i--) {
                hiebe[i].update(dt);
                if (hiebe[i].dead) hiebe.splice(i, 1);
            }
        });
        juri.hooks.onHit.push(tg => {
            if (abklingzeit > 0) return;
            abklingzeit = JURI_GUMMI.abstand;
            hiebe.push(new JuriGummiHieb(juri, tg));
            if (typeof FX !== 'undefined') {
                FX.burst(tg.centerX(), tg.centerY(), ['#7dff5a', '#ffffff'], 8, 120, 0.4, { kind: 'spark' });
            }
        });
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const h of hiebe) h.draw(ctx, camera);
        });
    },
});

// juri25 – Jeder besiegte Gegner gibt extra Münzen.
const JURI_GOLD = { muenzen: 2, von: 1, bis: 3, bossMuenzen: 4, bossVon: 2, bossBis: 4 };

registerUpgrade({
    id: 'juri25', figur: 'juri', name: 'Goldhammer', emoji: '🪙',
    text: 'Mit dem Goldhammer gibt jeder besiegte Gegner extra Münzen - Bosse geben richtig viele.',
    where: 'Im Shop kaufen',
    istFrei: () => false,
    apply(c) {
        if (!c.juri) return;
        const glanz = [];
        c.game.roundHooks.onEnemyKilled.push(enemy => {
            if (!enemy || !Game._dropCoin) return;
            const cx = enemy.centerX(), cy = enemy.centerY();
            const n = enemy.isBoss ? JURI_GOLD.bossMuenzen : JURI_GOLD.muenzen;
            const lo = enemy.isBoss ? JURI_GOLD.bossVon : JURI_GOLD.von;
            const hi = enemy.isBoss ? JURI_GOLD.bossBis : JURI_GOLD.bis;
            for (let i = 0; i < n; i++) Game._dropCoin(cx, cy, randInt(lo, hi), true);
            glanz.push({ x: cx, y: cy - 8, t: 0, gross: !!enemy.isBoss });
            if (typeof FX !== 'undefined') {
                FX.burst(cx, cy, ['#ffd23f', '#fff6a8', '#ffffff'], enemy.isBoss ? 18 : 9, 130, 0.5, { kind: 'star', gravity: 140 });
            }
        });
        c.game.roundHooks.onUpdate.push(dt => {
            for (let i = glanz.length - 1; i >= 0; i--) {
                glanz[i].t += dt;
                if (glanz[i].t > 0.9) glanz.splice(i, 1);
            }
        });
        // Kurz über jedem besiegten Gegner: drei kullernde Goldmünzen als Zeichen für den extra Gewinn
        c.game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!camera) return;
            for (const g of glanz) {
                const p = camera.worldToScreen(g.x, g.y - g.t * 16);
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - g.t / 0.9);
                for (let i = 0; i < 3; i++) {
                    Art.coin(ctx, p.x + (i - 1) * 9 * (g.gross ? 1.4 : 1), p.y - Math.abs(Math.sin(g.t * 9 + i)) * 4,
                        g.gross ? 5.4 : 4.2, Math.abs(Math.cos(g.t * 11 + i * 1.3)));
                }
                ctx.restore();
            }
        });
    },
});
