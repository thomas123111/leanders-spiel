// ── Upgrades für Panda-Freund (Datei des Panda-Freund-Auftrags) ──
// Hier trägt der Panda-Freund-Auftrag seine neuen Upgrades ein - nur in dieser Datei,
// der Figuren-Code (js/pandafreund.js, Klasse PandaBuddy) wird nicht angefasst.
//
// So kommt ein neues Upgrade hinein (genau ein registerUpgrade-Aufruf pro Extra):
//
//   registerUpgrade({
//       id: 'meinUpgrade',            // eindeutig, englisch, kein bestehender Id-Dieb
//       figur: 'panda',                // fest: 'panda'
//       name: 'Mein Extra',           // erscheint im Menü „Waffen" und im Shop
//       text: 'Was das Extra tut.',   // ein Satz für die Karte
//       emoji: '🔥',
//       where: 'Welt 12 schaffen',    // Hinweis auf der gesperrten Karte
//       istFrei: g => g.maxWorldUnlocked >= 13,   // oder: g.unlockedMeinUpgrade
//       apply(c) {                    // c = { game, welt, player, juri, croc, panda }
//           // einmal beim Weltstart, NUR wenn dieses Extra gewählt wurde.
//           // Achtung: die eigene Figur kann in der Welt fehlen (c.panda ist dann null) -
//           // erst prüfen: if (!c.panda) return;
//           // Hier die Haken anmelden - sie wirken dann die ganze Runde:
//           c.panda.hooks.onUpdate.push(dt => { /* jeder Bild-Takt */ });
//           c.panda.hooks.onHit.push((gegner, schaden) => schaden);  // (Reserve; der Panda schießt Pflanzen)
//           c.panda.hooks.onShoot.push(geschoss => { /* nur mit companionShoot - die Pflanzen laufen anders */ });
//           c.panda.hooks.onDamaged.push(menge => menge * 0.5); // Menge aendern (Zahl zurueckgeben)
//           c.panda.hooks.onDraw.push(ctx => { /* ueber dem Panda malen (Bildschirmmasse) */ });
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
// ── Paket panda1 (18.10.2026): zwelf Upgrades fuer den kleinen Panda ──
// Alle Wirkungen haengen an den Haken aus dem Geruest (js/upgrades.js); die
// Figur selbst (js/pandafreund.js) ist unangetastet. Neue Hilfsklassen
// (Stange, Bumerang, Rolle, Blume, Sprosse, Wand) stehen hier unten.
// Sichtbarkeit: jede Wirkung hat Partikel, eine eigene Form und eine Farbe
// im Bambus-Gruen des Pandas; zu starke Wirkungen haben eine Abklingzeit.
// ══════════════════════════════════════════════════════════════════════════

// Vor jedem eigenen onDraw-Haken: der Panda meldet Bildschirmlage und ist wieder sichtbar.
// Seine eigene Zeichnung laeuft vor den Haken (js/pandafreund.js), camera bekommt der Haken
// als zweiten Parameter - main.js uebergibt ihn nicht, deshalb steht sie in c.game.camera.
function pandaZeichenReset(p, camera) {
    const cam = camera || Game.camera;
    if (cam && typeof cam.worldToScreen === 'function') p._pandaPos = cam.worldToScreen(p.x, p.y);
}

// Die Figur darf nur ueber ihre Masse veraendert werden (ihr Code wird nicht angefasst):
// fuer Rolle und Sprung schrumpft sie auf Kugelgroesse, die eigene Zeichnung uebernimmt dann.
function pandaKugelForm(p, kugel) {
    if (kugel) {
        if (p.w > 14) { p._pandaW = p.w; p._pandaH = p.h; }
        p.w = 14; p.h = 14;
    } else if (p._pandaW) {
        p.w = p._pandaW; p.h = p._pandaH;
        p._pandaW = 0; p._pandaH = 0;
    }
}

// Der rollende bzw. springende Panda: die Kugel wird DECKEND ueber die eigene Figur gemalt (in ihren
// onDraw-Haken, die nach dem Koerper laufen), damit nicht Figur und Kugel gleichzeitig zu sehen sind.
function pandaKugelZeichnen(ctx, pos, p, dreh, zusatz) {
    const x = pos.x + p.w / 2, y = pos.y + p.h / 2;
    const r = 15 + Math.max(0, Math.min(54, zusatz || 0)) * 0.05;
    Art.glow(ctx, x, y, r * 1.8, '#9dff72', 0.42);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dreh);
    Art.body(ctx, 0, 0, r, r * 0.96, '#f7f5ff', { outline: '#4a4560' });
    ctx.fillStyle = '#2b2734';
    for (let i = 0; i < 3; i++) {
        const a = (TAU * i) / 3;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.34, r * 0.28, a, 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}

// Naechster lebender Gegner um einen Punkt, oder null (max = Entfernung in Pixeln)
function pandaNextEnemy(x, y, max) {
    if (!Game.enemies) return null;
    let best = null, bd = max || 1e9;
    for (const e of Game.enemies) {
        if (!e || e.dead) continue;
        const d = Math.hypot(e.centerX() - x, e.centerY() - y);
        if (d < bd) { bd = d; best = e; }
    }
    return best;
}

// Der Panda koennte in einer Welt fehlen oder k.o. sein - dann wirkt kein Extra.
function pandaKann(p) {
    return !!p && !p.dead && p.koTimer <= 0 && p.stunTimer <= 0 && p.sleepTimer <= 0;
}

// Ein Strich (Wege, Ranken, Stangen) - der runde Bambus-Stil der Figur
function pandaStrich(ctx, x1, y1, x2, y2, w, farbe, rand) {
    ctx.strokeStyle = farbe;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (rand) {
        ctx.strokeStyle = rand;
        ctx.lineWidth = Math.max(0.6, w * 0.28);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}

// ── panda01: Bambus-Peitsche ──
registerUpgrade({
    id: 'panda01', figur: 'panda', name: 'Bambus-Peitsche', emoji: '🎋',
    text: 'Der Panda schwingt einen langen Bambusstock im Kreis und haut alle Gegner rundherum weg.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 0, schwung = 0, winkel = 0;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            cd -= dt;
            if (schwung > 0) {
                schwung -= dt;
                if (schwung <= 0 && !p.dead) {
                    // der Hieb trifft alles, was der Stock im Kreis streift
                    areaDamage(p.centerX(), p.centerY(), 70, 5);
                    for (const e of (Game.enemies || [])) {
                        if (e && !e.dead &&
                            Math.hypot(e.centerX() - p.centerX(), e.centerY() - p.centerY()) <= 76) {
                            e._peitsche = (e._peitsche || 0) + 1;
                            knockBack(e, Math.atan2(e.centerY() - p.centerY(), e.centerX() - p.centerX()), 240);
                        }
                    }
                    FX.ring(p.centerX(), p.centerY(), '#a8d95c', 70, 0.3, 4);
                    Sound.hit();
                }
                return;
            }
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 78);
            if (!z) return;
            cd = 2.4;
            schwung = 0.3;
            winkel = Math.atan2(z.centerY() - p.centerY(), z.centerX() - p.centerX());
        });
        p.hooks.onDraw.push(ctx => {
            if (schwung <= 0) return;
            const pos = p._pandaPos, w = 66;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            const a = winkel + (1 - schwung / 0.3) * TAU;
            const sx = cx + Math.cos(a) * 10, sy = cy + Math.sin(a) * 10;
            const ex = cx + Math.cos(a) * w, ey = cy + Math.sin(a) * w;
            Art.glow(ctx, ex, ey, 12, '#c8f07a', 0.55);
            pandaStrich(ctx, sx, sy, ex, ey, 5, '#a8d95c', '#5f9a2e');
            for (let i = 1; i <= 2; i++) {
                const k = i / 3;
                const rx = sx + (ex - sx) * k, ry = sy + (ey - sy) * k;
                pandaStrich(ctx, rx - 2.6, ry + 1.4, rx + 2.6, ry - 1.4, 1.2, '#5f9a2e');
            }
            ctx.strokeStyle = 'rgba(200,240,122,0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy, w, a - 1.5, a - 0.15);
            ctx.stroke();
        });
    },
});

// ── panda02: Bambus-Fontaene ──
class BambooPole {
    constructor(x, y, delay) {
        this.x = x; this.y = y;
        this.delay = delay || 0;      // wartet kurz, damit die Fontaene stuftweise steigt
        this.age = 0;
        this.dur = 0.75;              // oben stehen bleiben
        this.h = 0;                   // aktuelle Hoehe
        this.maxH = 46 + Math.random() * 16;
        this.hit = false;
        this.dead = false;
        this.seed = Math.random() * 10;
    }
    update(dt, world) {
        // im Warten laeuft seine Zeit nicht mit: sonst bleibt den spaeten Stangen fast nichts zum Stehen
        if (this.delay > 0) { this.delay -= dt; return; }
        this.age += dt;
        const k = Math.min(1, this.age / 0.18);
        this.h = this.maxH * (k * (2 - k));           // schnell raus, sanft bremsen
        if (!this.hit && this.age >= 0.1) {
            this.hit = true;
            // die Stange schleudert Gegner hoch, die darauf stehen
            let traf = false;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                if (Math.hypot(e.centerX() - this.x, e.centerY() - this.y) <= 26 + Math.max(e.w, e.h) / 2) {
                    e.takeDamage(4, -Math.PI / 2, 0);
                    e._stange = (e._stange || 0) + 1;
                    knockBack(e, -Math.PI / 2 + randRange(-0.4, 0.4), 300);
                    traf = true;
                }
            }
            if (traf) {
                FX.ring(this.x, this.y, '#a8d95c', 30, 0.35, 3);
                this.maxH += 14;
            }
            FX.burst(this.x, this.y, ['#a8d95c', '#c8f07a', '#eaffd0'], 8, 120, 0.5, { kind: 'spark' });
        }
        if (this.age > this.dur) this.dead = true;
    }
    draw(ctx, camera) {
        if (this.h < 1) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x, y = pos.y, h = this.h;
        ctx.save();
        ctx.globalAlpha *= 0.92;
        pandaStrich(ctx, x, y + 3, x, y - h, 7, '#a8d95c', '#5f9a2e');
        for (let i = 1; i * 13 < h; i++) {
            pandaStrich(ctx, x - 3.4, y - i * 13, x + 3.4, y - i * 13, 1.4, '#5f9a2e');
        }
        // Blattbusch obendrauf
        Art.glow(ctx, x, y - h, 12, '#6bff5a', 0.45);
        for (let i = 0; i < 3; i++) {
            const a = -Math.PI / 2 + (i - 1) * 0.8 + Math.sin(Art.time * 3 + this.seed) * 0.12;
            Art.shape(ctx, cf => {
                cf.moveTo(0, 0);
                cf.quadraticCurveTo(Math.cos(a + 0.4) * 9, Math.sin(a + 0.4) * 9, Math.cos(a) * 15, Math.sin(a) * 15);
                cf.quadraticCurveTo(Math.cos(a - 0.4) * 9, Math.sin(a - 0.4) * 9, 0, 0);
                cf.closePath();
            }, { x: x - 15, y: y - h - 15, w: 30, h: 30 }, '#5fe04a', { outline: '#1f7a2a', lineWidth: 0.9, flat: true });
        }
        ctx.restore();
    }
}

registerUpgrade({
    id: 'panda02', figur: 'panda', name: 'Bambus-Fontaene', emoji: '⛲',
    text: 'Bambusstangen schießen aus dem Boden und schleudern Gegner hoch in die Luft.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 1.2;
        p.hooks.onUpdate.push(dt => {
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 200)) return;
            cd = 5.5;
            const cx = p.centerX(), cy = p.centerY();
            for (let i = 0; i < 5; i++) {
                const a = (TAU * i) / 5 + Math.random() * 0.7;
                const d = 30 + Math.random() * 95;
                const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
                if (c.welt && c.welt.isWall(x, y)) continue;
                Game.projectiles.push(new BambooPole(x, y, i * 0.09));
            }
            Game.camera.shake(4, 0.18);
            Sound.shoot();
        });
    },
});

// ── panda03: Panda-Rolle ──
class RollBall {
    constructor(x, y, vx, vy) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = 12;
        this.life = 0.9;
        this.age = 0;
        this.hitList = [];
        this.dead = false;
    }
    update(dt, world) {
        this.age += dt;
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (!world || !world.isWall(nx, ny)) { this.x = nx; this.y = ny; }
        else this.dead = true;
    }
    // der Ball trifft selbst: jeder Gegner liegt hoechstens einmal im Weg
    treffe(enemies) {
        for (const e of enemies) {
            if (!e || e.dead || this.hitList.indexOf(e) >= 0) continue;
            if (Math.hypot(e.centerX() - this.x, e.centerY() - this.y) <= this.radius + Math.max(e.w, e.h) / 2) {
                this.hitList.push(e);
                e._rolle = (e._rolle || 0) + 1;
                e.takeDamage(6, Math.atan2(this.vy, this.vx), 240);
                FX.burst(e.centerX(), e.centerY(), ['#c8f07a', '#ffffff'], 7, 130, 0.4, { kind: 'spark' });
                Sound.hit();
            }
        }
    }
    // wird ueber die Figur gemalt (bildschirmlage), nicht als Ding unter ihr
    aufSchirm(ctx, pos, p) { pandaKugelZeichnen(ctx, pos, p, this.age * 16, 0); }
}

registerUpgrade({
    id: 'panda03', figur: 'panda', name: 'Panda-Rolle', emoji: '🟢',
    text: 'Er rollt wie eine Kugel durch die Gegner und haut sie rechts und links um.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 1.6, ball = null;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (ball) {
                p.iFrames = 1;                       // die Kugel rollt durch Gegner hindurch
                ball.update(dt, c.welt);
                ball.treffe(Game.enemies || []);
                p.x = ball.x - p.w / 2; p.y = ball.y - p.h / 2;
                if (ball.dead) {
                    FX.burst(ball.x, ball.y, ['#a8d95c', '#c8f07a'], 9, 110, 0.45);
                    ball = null;
                    pandaKugelForm(p, false);
                    escapeFromWalls(p, c.welt, 4);
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 240);
            if (!z) return;
            const a = Math.atan2(z.centerY() - p.centerY(), z.centerX() - p.centerX());
            pandaKugelForm(p, true);              // er macht sich zur Kugel
            ball = new RollBall(p.centerX(), p.centerY(), Math.cos(a) * 300, Math.sin(a) * 300);
            ball.treffe(Game.enemies || []);
            cd = 5;
            FX.burst(p.centerX(), p.centerY(), ['#9dff72', '#c8ffb0'], 8, 100, 0.4);
            Game.camera.shake(3, 0.12);
        });
        p.hooks.onDraw.push(ctx => {
            if (ball && p._pandaPos) ball.aufSchirm(ctx, p._pandaPos, p);
        });
    },
});

// ── panda04: Kuschelschild ──
registerUpgrade({
    id: 'panda04', figur: 'panda', name: 'Kuschelschild', emoji: '🤗',
    text: 'Er umarmt Mark, und Mark bekommt kurz keinen Schaden.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda, spieler = c.player;
        if (!p || !spieler) return;
        let cd = 4, umarmt = false, herzen = 0;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            herzen -= dt;
            cd -= dt;
            if (umarmt) {
                // er bleibt bei Mark sitzen, bis die Umarmung vorbei ist
                const d = Math.hypot(spieler.x + spieler.w / 2 - p.centerX(), spieler.y + spieler.h / 2 - p.centerY());
                if (d > 16 && !p.dead) {
                    const a = Math.atan2(spieler.y + spieler.h / 2 - p.centerY(), spieler.x + spieler.w / 2 - p.centerX());
                    p.x += Math.cos(a) * 190 * dt;
                    p.y += Math.sin(a) * 190 * dt;
                }
                if (spieler.crownShieldTimer <= 0 || spieler.dead || p.dead) umarmt = false;
                return;
            }
            if (cd > 0 || !pandaKann(p) || spieler.dead) return;
            if (spieler.hp >= spieler.maxHp && spieler.crownShieldTimer > 0) return;
            // er haelt nur, wenn es weh tun koennte: ein Gegner ist in der Naehe
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 230)) return;
            cd = 18;
            umarmt = true;
            herzen = 3.2;
            spieler.crownShieldTimer = Math.max(spieler.crownShieldTimer, 3.2);
            FX.ring(spieler.x + spieler.w / 2, spieler.y + spieler.h / 2, '#ff9ab0', 34, 0.5, 4);
            FX.text(spieler.x + spieler.w / 2, spieler.y - 8, '🤗', '#ff9ab0', 14, { life: 1.2 });
        });
        p.hooks.onDraw.push(ctx => {
            if (herzen <= 0) return;
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            for (let i = 0; i < 3; i++) {
                const k = (Art.time * 0.9 + i / 3) % 1;
                ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
                Art.heart(ctx, cx + Math.sin(k * 6 + i * 2) * 11, cy - 12 - k * 22, 4 + k * 2, '#ff5a7a');
                ctx.globalAlpha = 1;
            }
            Art.ring(ctx, cx, cy, 20 + Math.sin(Art.time * 6) * 2, '#ffb3c4', 2, 0.7);
        });
    },
});

// ── panda05: Bambus-Wand ──
class PandaWall {
    constructor(welt, game, tx, ty, sekunden) {
        this.welt = welt; this.game = game;
        this.tx = tx; this.ty = ty;
        this.alt = welt.tiles[ty][tx];
        this.life = sekunden;
        this.dauer = sekunden;
        welt.setTile(tx, ty, TILE_WALL);  // echte Kachel - ueber setTile, damit der vorgerenderte Block neu gemalt wird
        this.dead = false;
        this.seed = Math.random() * 10;
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.abbau();
    }
    abbau() {
        if (this.dead) return;
        this.dead = true;
        if (this.welt.tiles[this.ty] && this.welt.tiles[this.ty][this.tx] === TILE_WALL) {
            this.welt.setTile(this.tx, this.ty, this.alt);  // nur zurueck, wenn nichts anderes sie umbaute
        }
        const p = this.mitte();
        FX.burst(p.x, p.y, ['#a8d95c', '#5f9a2e'], 10, 90, 0.5);
    }
    mitte() {
        return { x: this.tx * TILE_SIZE + TILE_SIZE / 2, y: this.ty * TILE_SIZE + TILE_SIZE / 2 };
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.tx * TILE_SIZE, this.ty * TILE_SIZE);
        const x = pos.x, y = pos.y, s = TILE_SIZE;
        const welk = this.life < 1 ? this.life : 1;
        ctx.save();
        ctx.globalAlpha *= 0.55 + 0.45 * welk;
        for (let i = 0; i < 4; i++) {
            const sx = x + 4 + i * 8;
            // direkt nach dem Bauen schnell heraus, in der letzten Sekunde welk er wieder ein
            const wuch = Math.max(0, Math.min(1, (this.dauer - this.life) * 4 + 0.35));
            pandaStrich(ctx, sx, y + s, sx, y + s - s * wuch, 6, i % 2 ? '#a8d95c' : '#8fc94a', '#5f9a2e');
            for (let k = 1; k * 11 < s * wuch; k++) {
                pandaStrich(ctx, sx - 2.8, y + s - k * 11, sx + 2.8, y + s - k * 11, 1.2, '#5f9a2e');
            }
            if (wuch > 0.8) {
                Art.shape(ctx, cf => {
                    cf.moveTo(sx, y + s - s * wuch);
                    cf.quadraticCurveTo(sx + 6, y + s - s * wuch - 5, sx + 9, y + s - s * wuch - 1);
                    cf.quadraticCurveTo(sx + 5, y + s - s * wuch + 3, sx, y + s - s * wuch);
                    cf.closePath();
                }, { x: sx - 2, y: y + s - s * wuch - 6, w: 13, h: 9 }, '#5fe04a', { outline: '#1f7a2a', lineWidth: 0.8, flat: true });
            }
        }
        ctx.restore();
    }
}

registerUpgrade({
    id: 'panda05', figur: 'panda', name: 'Bambus-Wand', emoji: '🎍',
    text: 'Er baut eine Bambuswand, die Gegnergeschosse aufhält.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda, welt = c.welt, game = c.game;
        if (!p || !welt || !game) return;
        let cd = 2.5, wand = null;
        p.hooks.onUpdate.push(dt => {
            if (wand) {
                wand.update(dt);
                if (wand.dead) {
                    wand = null;
                    if (Game.roundHooks) Game.roundHooks.__wand = null;
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const gefahr = pandaNextEnemy(p.centerX(), p.centerY(), 260);
            if (!gefahr) return;
            // die Wand kommt zwischen Mark und die Gefahr
            const px = c.player.x + c.player.w / 2, py = c.player.y + c.player.h / 2;
            const a = Math.atan2(gefahr.centerY() - py, gefahr.centerX() - px);
            let gesetzt = false;
            for (let r = 2; r >= 1 && !gesetzt; r--) {
                for (let k = -1; k <= 1 && !gesetzt; k++) {
                    const tx = Math.floor((px + Math.cos(a) * r * TILE_SIZE) / TILE_SIZE);
                    const ty = Math.floor((py + Math.sin(a) * r * TILE_SIZE + k * TILE_SIZE * 0.8) / TILE_SIZE);
                    if (tx < 1 || ty < 1 || tx >= welt.width - 1 || ty >= welt.height - 1) continue;
                    if (welt.tiles[ty][tx] !== TILE_FLOOR) continue;
                    if (game._isBossRoomTile && game._isBossRoomTile(tx, ty)) continue;
                    const mx = tx * TILE_SIZE + TILE_SIZE / 2, my = ty * TILE_SIZE + TILE_SIZE / 2;
                    // niemand steht auf der Kachel, sonst steckte er in der Wand fest
                    let frei = Math.hypot(px - mx, py - my) > TILE_SIZE * 0.9;
                    for (const e of (Game.enemies || [])) {
                        if (e && !e.dead && Math.hypot(e.centerX() - mx, e.centerY() - my) < TILE_SIZE * 0.8) frei = false;
                    }
                    for (const cf of (Game.companions || [])) {
                        if (cf && Math.hypot(cf.centerX() - mx, cf.centerY() - my) < TILE_SIZE * 0.8) frei = false;
                    }
                    if (!frei) continue;
                    wand = new PandaWall(welt, game, tx, ty, 6);
                    if (Game.roundHooks) Game.roundHooks.__wand = wand;   // fuer die Messung erreichbar
                    FX.burst(mx, my, ['#a8d95c', '#eaffd0'], 12, 110, 0.5, { kind: 'spark' });
                    Sound.powerUp();
                    gesetzt = true;
                }
            }
            if (gesetzt) cd = 9; else cd = 0.8;
        });
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => { if (wand) wand.draw(ctx, camera); });
    },
});

// ── panda06: Giftblueten ──
class PandaFlower {
    constructor(x, y, sekunden) {
        this.x = x; this.y = y;
        this.life = sekunden;
        this.tick = 0.35;              // erster Hauch bald nach dem Pflanzen
        this.dead = false;
        this.seed = Math.random() * 10;
        this.oefnet = 0;
    }
    update(dt, welt) {
        this.life -= dt;
        this.oefnet = Math.min(1, this.oefnet + dt * 2.5);
        if (welt && welt.isWall(this.x, this.y)) this.life = Math.min(this.life, 0.3);
        this.tick -= dt;
        if (this.tick <= 0) {
            this.tick = 0.55;
            let traf = false;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                if (Math.hypot(e.centerX() - this.x, e.centerY() - this.y) <= 52 + Math.max(e.w, e.h) / 2) {
                    PandaBuddy.poisonEnemy(e, 3, 1);
                    traf = true;
                }
            }
            if (traf) FX.burst(this.x, this.y - 6, ['#b980ff', '#7dff5a'], 4, 45, 0.5, { kind: 'bubble' });
        }
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x, y = pos.y, k = this.oefnet;
        const aura = 52 * k;
        ctx.save();
        ctx.globalAlpha *= 0.16 + 0.08 * Math.sin(Art.time * 3 + this.seed);
        ctx.fillStyle = '#9b5cff';
        ctx.beginPath();
        ctx.arc(x, y, aura, 0, TAU);
        ctx.fill();
        ctx.restore();
        pandaStrich(ctx, x, y + 6, x, y - 6, 2.4, '#4fbf3a');
        Art.glow(ctx, x, y - 9, 10 * k, '#b980ff', 0.5);
        for (let i = 0; i < 6; i++) {
            const a = (TAU * i) / 6 + Art.time * 0.6;
            ctx.fillStyle = i % 2 ? '#b980ff' : '#e2c4ff';
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(a) * 5.4 * k, y - 9 + Math.sin(a) * 5.4 * k, 3.2 * k, 2.4 * k, a, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = '#7dff5a';
        ctx.beginPath();
        ctx.arc(x, y - 9, 2.4 * k, 0, TAU);
        ctx.fill();
    }
}

registerUpgrade({
    id: 'panda06', figur: 'panda', name: 'Giftblüten', emoji: '🌸',
    text: 'Er pflanzt Blumen, die Gegner in der Nähe langsam vergiften.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, blumen = [];
        p.hooks.onUpdate.push(dt => {
            for (let i = blumen.length - 1; i >= 0; i--) {
                blumen[i].update(dt, c.welt);
                if (blumen[i].dead) blumen.splice(i, 1);
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 200)) return;
            cd = 6;
            for (let i = 0; i < 3; i++) {
                const a = Math.random() * TAU, d = 26 + Math.random() * 66;
                const x = p.centerX() + Math.cos(a) * d, y = p.centerY() + Math.sin(a) * d;
                if (c.welt && c.welt.isWall(x, y)) continue;
                blumen.push(new PandaFlower(x, y, 6));
            }
            FX.burst(p.centerX(), p.centerY(), ['#b980ff', '#e2c4ff'], 8, 90, 0.5, { kind: 'star' });
        });
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const b of blumen) b.draw(ctx, camera);
        });
    },
});

// ── panda07: Heil-Sprossen ──
class PandaSprout {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.life = 12;               // so lange bleibt sie stehen
        this.wuchs = 0;
        this.dead = false;
        this.seed = Math.random() * 10;
    }
    update(dt, welt, spieler) {
        this.life -= dt;
        this.wuchs = Math.min(1, this.wuchs + dt * 2.2);
        if (welt && welt.isWall(this.x, this.y)) this.life = Math.min(this.life, 0.25);
        if (spieler && !spieler.dead &&
            Math.hypot(spieler.x + spieler.w / 2 - this.x, spieler.y + spieler.h / 2 - this.y) < 24) this.heile(spieler);
        if (this.life <= 0) this.dead = true;
    }
    heile(spieler) {
        if (this.dead) return false;
        if (spieler.hp >= spieler.maxHp) return false;
        this.dead = true;
        spieler.heal(2);                              // 2 von 20 Punkten = ein halbes Herz
        FX.text(this.x, this.y - 12, '+ ❤️', '#ff6b81', 12, { life: 1.1 });
        FX.burst(this.x, this.y - 6, ['#7dff5a', '#ffd0dc', '#ffffff'], 10, 90, 0.6, { kind: 'star' });
        Sound.powerUp();
        return true;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x, y = pos.y, k = this.wuchs;
        const wippen = Math.sin(Art.time * 3 + this.seed) * 1.6;
        Art.glow(ctx, x, y - 8, 14 * k, '#8dff6a', 0.4 + 0.15 * Math.sin(Art.time * 4 + this.seed));
        pandaStrich(ctx, x, y + 5, x + wippen * 0.4, y - 7 * k, 3, '#4fbf3a');
        for (let i = 0; i < 2; i++) {
            const seite = i ? 1 : -1;
            Art.shape(ctx, cf => {
                cf.moveTo(x, y - 4 * k);
                cf.quadraticCurveTo(x + seite * 9 * k, y - 10 * k, x + seite * 12 * k + wippen, y - 5 * k);
                cf.quadraticCurveTo(x + seite * 7 * k, y - 2 * k, x, y - 4 * k);
                cf.closePath();
            }, { x: Math.min(x, x + seite * 12 * k) - 2, y: y - 12 * k - 2, w: 16, h: 14 }, '#7dff5a',
                { outline: '#2a8f3a', lineWidth: 0.9, flat: true });
        }
        Art.heart(ctx, x + wippen * 0.5, y - 12 * k, 4.4 * k, '#ff3d5a');
        if (this.life < 3) {
            ctx.globalAlpha = 0.35 + 0.35 * Math.sin(Art.time * 8);
            Art.ring(ctx, x, y - 4, 11, '#ffd0dc', 1.4, 1);
            ctx.globalAlpha = 1;
        }
    }
}

registerUpgrade({
    id: 'panda07', figur: 'panda', name: 'Heil-Sprossen', emoji: '🌱',
    text: 'Bambussprossen heilen Mark ein halbes Herz, wenn er sie einsammelt.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda, spieler = c.player;
        if (!p || !spieler) return;
        let cd = 3, sprossen = [];
        p.hooks.onUpdate.push(dt => {
            for (let i = sprossen.length - 1; i >= 0; i--) {
                sprossen[i].update(dt, c.welt, spieler);
                if (sprossen[i].dead) sprossen.splice(i, 1);
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p) || sprossen.length >= 2) return;
            if (spieler.hp >= spieler.maxHp) { cd = 0.6; return; }
            // freie Stelle in Marks Naehe suchen (nie in einer Wand, nie im Boss-Raum)
            let ziel = null;
            for (let versuch = 0; versuch < 14 && !ziel; versuch++) {
                const a = Math.random() * TAU, d = 20 + Math.random() * 46;
                const x = spieler.x + spieler.w / 2 + Math.cos(a) * d, y = spieler.y + spieler.h / 2 + Math.sin(a) * d;
                const tx = Math.floor(x / TILE_SIZE), ty = Math.floor(y / TILE_SIZE);
                if (!c.welt || tx < 1 || ty < 1 || tx >= c.welt.width - 1 || ty >= c.welt.height - 1) continue;
                if (c.welt.tiles[ty][tx] !== TILE_FLOOR) continue;
                if (c.game._isBossRoomTile && c.game._isBossRoomTile(tx, ty)) continue;
                ziel = { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
            }
            if (!ziel) { cd = 1; return; }
            cd = 9;
            const spross = new PandaSprout(ziel.x, ziel.y);
            spross.sprosse = true;
            sprossen.push(spross);
            if (Game.roundHooks) Game.roundHooks.__sprossen = sprossen;   // fuer die Messung erreichbar
            FX.burst(ziel.x, ziel.y, ['#7dff5a', '#c8ffb0'], 7, 70, 0.5, { kind: 'spark' });
        });
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const s of sprossen) s.draw(ctx, camera);
        });
    },
});

// ── panda08: Doppelrohr ──
registerUpgrade({
    id: 'panda08', figur: 'panda', name: 'Doppelrohr', emoji: '🎐',
    text: 'Er schießt aus zwei Bambusrohren gleichzeitig: immer zwei Pflanzen hintereinander.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let folge = 0, folgeZiel = null, vorherTakt = 0;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            // Der Panda hat in diesem Bild abgezogen, wenn sein Takt wieder voll oben steht.
            const abgezogen = p.shootTimer >= p.shootCooldown - 0.001 && vorherTakt < p.shootCooldown - 0.001;
            vorherTakt = p.shootTimer;
            if (abgezogen && p.target && pandaKann(p)) {
                folge = 0.16;
                folgeZiel = p.target;
                p._pandaDoppel = 1;                // ein zweites Rohr ist sichtbar, solange die Folge läuft
            }
            if (folge > 0) {
                folge -= dt;
                if (folge <= 0) {
                    p._pandaDoppel = 0;
                    if (folgeZiel && !folgeZiel.dead && pandaKann(p) && typeof PandaPlant !== 'undefined') {
                        const m = p.muzzle();
                        const a = Math.atan2(folgeZiel.centerY() - m.y, folgeZiel.centerX() - m.x);
                        // das zweite Rohr liegt quer zur Schussrichtung
                        const qx = Math.cos(a + Math.PI / 2) * 7, qy = Math.sin(a + Math.PI / 2) * 7;
                        Game.projectiles.push(new PandaPlant(m.x + qx, m.y + qy,
                            Math.cos(a) * 250, Math.sin(a) * 250, p.damage));
                        FX.burst(m.x + qx, m.y + qy, ['#9dff72', '#c8ffb0'], 5, 70, 0.35, { kind: 'smoke', size: 4 });
                    }
                    folgeZiel = null;
                }
            }
        });
        p.hooks.onDraw.push(ctx => {
            if (!p._pandaDoppel) return;
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2, f = p.faceX || 1;
            const mx = cx - 9 * f + p.aimX * 2.2, my = cy - 15.5 + p.aimY * 2.2;
            Art.limb(ctx, cx - 2.4 * f, cy + 11.4, mx, my, 4.6, '#8fc94a', { lineWidth: 1.2, outline: '#5f9a2e' });
            Art.glow(ctx, mx, my, 6, '#6bff5a', 0.5);
            ctx.fillStyle = '#22331a';
            ctx.beginPath();
            ctx.ellipse(mx, my, 2, 1.4, -0.9 * f, 0, TAU);
            ctx.fill();
        });
    },
});

// ── panda09: Rankenfessel ──
registerUpgrade({
    id: 'panda09', figur: 'panda', name: 'Rankenfessel', emoji: '🌿',
    text: 'Ranken kriechen aus dem Boden und halten Gegner ein paar Sekunden fest.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, gefangene = [];
        p.hooks.onUpdate.push(dt => {
            gefangene = gefangene.filter(e => e && !e.dead && e.freezeTimer > 0);
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const naechste = [];
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead || e.freezeTimer > 0) continue;
                if (Math.hypot(e.centerX() - p.centerX(), e.centerY() - p.centerY()) <= 160) naechste.push(e);
            }
            if (!naechste.length) return;
            cd = 8;
            naechste.sort((a, b) =>
                Math.hypot(a.centerX() - p.centerX(), a.centerY() - p.centerY()) -
                Math.hypot(b.centerX() - p.centerX(), b.centerY() - p.centerY()));
            for (const e of naechste.slice(0, 3)) {
                // Boss-Abschwachung steckt in Enemy.freeze: dort bleibt nur ein kurzer Rest
                if (e.freeze(1.4)) {
                    gefangene.push(e);
                    FX.burst(e.centerX(), e.centerY(), ['#3fbf4f', '#7dff5a'], 7, 60, 0.55, { kind: 'spark' });
                }
            }
            if (gefangene.length) {
                FX.ring(p.centerX(), p.centerY(), '#5fe04a', 150, 0.45, 3);
                Sound.powerUp();
            }
        });
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const e of gefangene) {
                const pos = camera.worldToScreen(e.centerX(), e.centerY());
                const r = Math.max(e.w, e.h) * 0.62 + 5;
                for (let i = 0; i < 4; i++) {
                    const a0 = (TAU * i) / 4 + Art.time * 1.6;
                    ctx.strokeStyle = i % 2 ? '#3fbf4f' : '#7dff5a';
                    ctx.lineWidth = 2.4;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, r, a0, a0 + 1.25);
                    ctx.stroke();
                    const tx = pos.x + Math.cos(a0 + 1.25) * r, ty = pos.y + Math.sin(a0 + 1.25) * r;
                    ctx.fillStyle = '#5fe04a';
                    ctx.beginPath();
                    ctx.ellipse(tx + 2, ty - 2, 3, 1.8, a0, 0, TAU);
                    ctx.fill();
                }
            }
        });
    },
});

// ── panda10: Panda-Plumps ──
registerUpgrade({
    id: 'panda10', figur: 'panda', name: 'Panda-Plumps', emoji: '🪂',
    text: 'Er springt hoch und plumpst auf die Gegner darunter.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, sprung = null;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (sprung) {
                p.iFrames = 1;                       // im Flug greift ihn nichts
                sprung.t += dt / sprung.dauer;
                const k = Math.min(1, sprung.t);
                sprung.bx = sprung.vonX + (sprung.x - sprung.vonX) * k;
                sprung.by = sprung.vonY + (sprung.y - sprung.vonY) * k;
                sprung.hoehe = Math.sin(Math.PI * k) * 54;
                p.x = sprung.bx - p.w / 2; p.y = sprung.by - p.h / 2;   // er fliegt mit
                if (sprung.t >= 1) {
                    // Plumps: alles im Umkreis wird getroffen und weggeschubst
                    areaDamage(sprung.x, sprung.y, 62, 8, null, 0);
                    for (const e of (Game.enemies || [])) {
                        if (e && !e.dead && Math.hypot(e.centerX() - sprung.x, e.centerY() - sprung.y) <= 68) {
                            e._plumps = (e._plumps || 0) + 1;
                        }
                    }
                    FX.ring(sprung.x, sprung.y, '#c8f07a', 62, 0.4, 5);
                    FX.burst(sprung.x, sprung.y, ['#a8d95c', '#eaffd0', '#ffffff'], 14, 150, 0.5, { kind: 'smoke', size: 5 });
                    Game.camera.shake(6, 0.22);
                    Sound.hit();
                    pandaKugelForm(p, false);
                    sprung = null;
                    escapeFromWalls(p, c.welt, 4);
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 200);
            if (!z) return;
            pandaKugelForm(p, true);
            sprung = {
                vonX: p.centerX(), vonY: p.centerY(), x: z.centerX(), y: z.centerY(),
                bx: p.centerX(), by: p.centerY(), hoehe: 0, t: 0, dauer: 0.55,
            };
            cd = 6;
            FX.burst(p.centerX(), p.centerY(), ['#c8ffb0', '#ffffff'], 8, 90, 0.4, { kind: 'smoke', size: 4 });
        });
        // der Schatten bleibt auf dem Boden und wird in der Flughoehe kleiner - das ist der Hoehenhinweis
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!sprung) return;
            const ground = camera.worldToScreen(sprung.bx, sprung.by);
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#120e1c';
            ctx.beginPath();
            ctx.ellipse(ground.x + p.w / 2, ground.y + p.h / 2, Math.max(5, 13 - sprung.hoehe * 0.08), 5, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
        });
        // die Kugel sitzt auf der Figur (deckend), damit nicht Panda und Ball doppelt stehen
        p.hooks.onDraw.push(ctx => {
            if (sprung && p._pandaPos) pandaKugelZeichnen(ctx, p._pandaPos, p, sprung.t * 14, sprung.hoehe);
        });
    },
});

// ── panda11: Nickerchen ──
registerUpgrade({
    id: 'panda11', figur: 'panda', name: 'Nickerchen', emoji: '😴',
    text: 'Er macht ein Schläfchen und ist danach wieder ganz gesund.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 6, schlaeft = false, weckzeit = 0;
        p.hooks.onUpdate.push(dt => {
            cd -= dt;
            if (!schlaeft) {
                if (cd > 0 || p.dead || p.koTimer > 0 || p.stunTimer > 0 || p.sleepTimer > 0) return;
                if (p.hp >= p.maxHp) return;                       // gesund: er braucht kein Schlaefchen
                if (pandaNextEnemy(p.centerX(), p.centerY(), 120)) return;  // erst wenn es ruhig genug ist
                cd = 14;
                schlaeft = true;
                weckzeit = 3;
                p.sleep(3);
                FX.text(p.centerX(), p.y - 10, '😴', '#c9b6ff', 13, { life: 1.4 });
                return;
            }
            weckzeit -= dt;
            if (Math.random() < dt * 3) {
                FX.burst(p.centerX(), p.y - 6, ['#c9b6ff', '#ffffff'], 2, 30, 0.8, { kind: 'star' });
            }
            if (weckzeit > 0) return;
            schlaeft = false;
            if (!p.dead) {
                p.hp = p.maxHp;                                    // aufgewacht und wieder ganz gesund
                p.poisonTimer = 0;
                FX.text(p.centerX(), p.y - 12, 'ganz gesund! 💤', '#7dff5a', 12, { life: 1.4 });
                FX.ring(p.centerX(), p.centerY(), '#c9b6ff', 30, 0.5, 4);
                FX.burst(p.centerX(), p.centerY(), ['#c9b6ff', '#ffffff', '#7dff5a'], 14, 120, 0.7, { kind: 'star' });
                Sound.powerUp();
            }
        });
    },
});

// ── panda12: Bambus-Bumerang ──
class BambooBoomerang extends Projectile {
    constructor(x, y, a) {
        super(x, y, Math.cos(a) * 340, Math.sin(a) * 340, 5, 'player', 150);
        this.radius = 7;
        this.bouncesLeft = 0;
        this.dauer = 0.85;              // so lange raus, dann zurück
        this.alt = { x, y };            // Startpunkt (der Panda fängt ihn wieder)
        this.zurueck = false;
        this.tot = false;
        this.pierce = 99;               // er darf auf dem Hin- und Rückweg durch Gegner fliegen
        this.pierceHits = [];
        this.bumerang = true;           // daran erkennt die Probe den Bumerang
        this.seed = Math.random() * 10;
    }
    update(dt, world) {
        this.age += dt;
        if (this.tot) { this.dead = true; return; }
        if (!this.zurueck && this.age >= this.dauer) { this.zurueck = true; this.pierceHits = []; }
        if (this.zurueck) {
            const a = Math.atan2(this.alt.y - this.y, this.alt.x - this.x);
            const sp = 360;
            this.vx = Math.cos(a) * sp;
            this.vy = Math.sin(a) * sp;
            if (Math.hypot(this.alt.x - this.x, this.alt.y - this.y) < 16) this.tot = true;
        }
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (world && world.isWall(nx, ny)) {
            if (!this.zurueck) { this.zurueck = true; this.pierceHits = []; }   // an der Wand dreht er um
            else this.tot = true;
        } else {
            this.x = nx; this.y = ny;
        }
        if (this.age > this.dauer + 2.4) this.tot = true;
        this.markiere();
    }
    // Merker fuer die Messskripte: welche Gegner hat dieser Bumerang schon gestreift
    markiere() {
        for (const e of (Game.enemies || [])) {
            if (!e || e.dead) continue;
            if ((this.pierceHits || []).indexOf(e) >= 0) e._bumerang = 1;
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x, y = pos.y, dreh = this.age * 22;
        Art.glow(ctx, x, y, 14, '#a8d95c', 0.45);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(dreh);
        pandaStrich(ctx, -11, 0, 11, 0, 4.6, '#a8d95c', '#5f9a2e');
        pandaStrich(ctx, -11, -4.5, 11, -4.5, 3, '#8fc94a', '#5f9a2e');
        for (let i = -1; i <= 1; i++) {
            pandaStrich(ctx, i * 6 - 1.6, -6, i * 6 + 1.6, -3, 1, '#5f9a2e');
        }
        ctx.restore();
    }
}

registerUpgrade({
    id: 'panda12', figur: 'panda', name: 'Bambus-Bumerang', emoji: '🥍',
    text: 'Ein Bambusstab fliegt raus, trifft Gegner und kommt zu ihm zurück.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, stab = null;
        p.hooks.onUpdate.push(dt => {
            if (stab) {
                // js/main.js aktualisiert jedes Geschoss in seiner eigenen Schleife - hier nur den Tod abholen
                if (stab.dead) {
                    FX.burst(stab.x, stab.y, ['#a8d95c', '#eaffd0'], 7, 80, 0.4, { kind: 'spark' });
                    stab = null;
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 260);
            if (!z) return;
            const m = p.muzzle();
            stab = new BambooBoomerang(m.x, m.y,
                Math.atan2(z.centerY() - m.y, z.centerX() - m.x));
            Game.projectiles.push(stab);
            cd = 4.5;
            Sound.shoot();
        });
    },
});

