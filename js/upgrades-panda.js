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
    // 18 px: die Figur ragt mit Rohr und Blatt bis ~17 px aus ihrer Mitte, die Kugel muss sie ganz verdecken
    const r = 18 + Math.max(0, Math.min(54, zusatz || 0)) * 0.05;
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
    id: 'panda06', figur: 'panda', name: 'Giftblüten', emoji: '🌸', welt: 56,
    text: 'Er pflanzt Blumen, die Gegner in der Nähe langsam vergiften.',
    where: 'Welt 56 schaffen',
    // Weltbelohnung (nicht im Shop): wer sie schon gekauft hat, behaelt sie ueber boughtUpgrades frei
    istFrei: g => !!g.unlockedPoisonBlooms,
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
    id: 'panda09', figur: 'panda', name: 'Rankenfessel', emoji: '🌿', welt: 55,
    text: 'Ranken kriechen aus dem Boden und halten Gegner ein paar Sekunden fest.',
    where: 'Welt 55 schaffen',
    // Weltbelohnung (nicht im Shop): wer sie schon gekauft hat, behaelt sie ueber boughtUpgrades frei
    istFrei: g => !!g.unlockedVineBind,
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

// ══════════════════════════════════════════════════════════════════════════
// ── Paket panda2 (18.10.2026): dreizehn weitere Upgrades fuer den Panda ──
// Wieder nur Haken und apply() aus js/upgrades.js, die Figur bleibt unangetastet.
// Neue Hilfsklassen: Wurf von oben, Panda-Baby, Bambuspfeil, Dornenteppich.
// Zu starke Wirkungen haben eine Abklingzeit; wo eine Wirkung Gegner festhaelt
// oder bremst, bekommen Bosse davon nur eine kurze, abgeschwaechte Version
// (Enemy.freeze kuemmert sich selbst um Bosse, slowEnemy nicht - das macht hier
// der Aufrufer).
// ══════════════════════════════════════════════════════════════════════════

// Ein kleiner runder Panda: sitzt oben auf dem Bambus (panda13) und ist ein
// Pandababy (panda15). Dieselben Farben wie die grosse Figur, damit man ihn
// sofort als Panda erkennt.
function pandaMiniZeichnen(ctx, x, y, r, dreh) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dreh || 0);
    // Ohren und Pfoten zuerst - der weisse Koerper deckt sie unten ab
    ctx.fillStyle = '#2b2734';
    for (let i = -1; i <= 1; i += 2) {
        ctx.beginPath();
        ctx.arc(i * r * 0.7, -r * 0.68, r * 0.34, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(i * r * 0.78, r * 0.62, r * 0.3, r * 0.22, i * 0.4, 0, TAU);
        ctx.fill();
    }
    Art.body(ctx, 0, 0, r * 0.92, r, '#f7f5ff', { outline: '#4a4560' });
    // Augenflecken mit hellem Punkt, Näschen, fröhliches Maul
    for (let i = -1; i <= 1; i += 2) {
        ctx.fillStyle = '#2b2734';
        ctx.beginPath();
        ctx.ellipse(i * r * 0.36, -r * 0.08, r * 0.23, r * 0.29, i * 0.32, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(i * r * 0.36, -r * 0.12, Math.max(0.7, r * 0.09), 0, TAU);
        ctx.fill();
    }
    ctx.fillStyle = '#2b2734';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.26, Math.max(0.8, r * 0.15), Math.max(0.6, r * 0.1), 0, 0, TAU);
    ctx.fill();
    // grünes Halstuch wie bei der grossen Figur
    Art.body(ctx, 0, r * 0.52, r * 0.66, r * 0.2, '#4fbf3a', { outline: '#2a8f3a' });
    ctx.restore();
}

// ── panda13: Kletterpanda ──
// Der Wurf von oben: trifft in der Weltkarte auf dem Boden, gesehen faellt er
// aus der Kletterhoehe herunter (deshalb Bodenschatten + sinkende Zeichenhoehe).
class PandaThrow extends Projectile {
    constructor(x, y, a, hoehe) {
        super(x, y, Math.cos(a) * 290, Math.sin(a) * 290, 4, 'player', 150);
        this.radius = 5;
        this.hoehe = hoehe || 40;     // Bildschirmpixel ueber dem Aufschlagpunkt
        this.startHoehe = this.hoehe;
        this.wurf = true;             // daran erkennt die Probe diesen Wurf
        this.seed = Math.random() * 10;
    }
    update(dt, world) {
        this.age += dt;
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (world && world.isWall(nx, ny)) { this.dead = true; return; }
        this.x = nx; this.y = ny;
        // er sinkt gleichmaessig Richtung Boden: nach gut der Haelfte der Flugzeit ankommen
        this.hoehe = Math.max(0, this.startHoehe * (1 - this.age / 0.75));
        if (this.age > 1.6) this.dead = true;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = '#120e1c';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, 5, 2.3, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        const x = pos.x, y = pos.y - this.hoehe;
        Art.glow(ctx, x, y, 12, '#a8d95c', 0.5);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.age * 14 + this.seed);
        pandaStrich(ctx, -7, 0, 7, 0, 4, '#a8d95c', '#5f9a2e');
        pandaStrich(ctx, 0, -5.5, 0, 5.5, 3, '#8fc94a', '#5f9a2e');
        ctx.restore();
    }
}

registerUpgrade({
    id: 'panda13', figur: 'panda', name: 'Kletterpanda', emoji: '🪜',
    text: 'Er klettert auf einen Bambus und wirft von oben runter - dort trifft ihn kein Gegner.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 3, klett = null;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (klett) {
                p.iFrames = 1;                          // oben trifft ihn keiner
                p.x = klett.x; p.y = klett.y;           // er bleibt auf seinem Halm sitzen
                klett.t += dt;
                klett.wurf -= dt;
                if (klett.wurf <= 0 && klett.hoehe > 20) {
                    klett.wurf = 0.85;
                    const z = pandaNextEnemy(p.centerX(), p.centerY(), 300);
                    if (z) {
                        const a = Math.atan2(z.centerY() - p.centerY(), z.centerX() - p.centerX());
                        Game.projectiles.push(new PandaThrow(p.centerX(), p.centerY(), a, klett.hoehe));
                        FX.burst(p.centerX(), p.centerY() - klett.hoehe, ['#c8f07a', '#ffffff'], 4, 60, 0.35, { kind: 'spark' });
                        Sound.shoot();
                    }
                }
                const hoch = Math.min(1, klett.t / 0.45);
                const runter = Math.min(1, Math.max(0, (klett.dauer - klett.t) / 0.45));
                klett.hoehe = 44 * Math.min(hoch, runter);
                if (klett.t >= klett.dauer) {
                    klett = null;
                    p._klettert = 0;
                    escapeFromWalls(p, c.welt, 3);
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 260)) return;
            cd = 15;
            klett = { x: p.x, y: p.y, t: 0, dauer: 5.4, hoehe: 0, wurf: 0.6 };
            p._klettert = 1;                        // Merker fuer die Messung: er sitzt oben
            FX.burst(p.centerX(), p.centerY(), ['#a8d95c', '#5f9a2e', '#eaffd0'], 10, 95, 0.5, { kind: 'spark' });
            Sound.powerUp();
        });
        // der Bambushalm, auf den er klettert (unter den Figuren)
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!klett) return;
            const fuss = camera.worldToScreen(klett.x, klett.y + p.h);
            const h = 30 + klett.hoehe;
            pandaStrich(ctx, fuss.x, fuss.y, fuss.x, fuss.y - h, 7, '#a8d95c', '#5f9a2e');
            for (let i = 1; i * 12 < h; i++) {
                pandaStrich(ctx, fuss.x - 3.4, fuss.y - i * 12, fuss.x + 3.4, fuss.y - i * 12, 1.4, '#5f9a2e');
            }
            for (let i = 0; i < 3; i++) {
                const a = -Math.PI / 2 + (i - 1) * 0.9 + Math.sin(Art.time * 2.4 + i) * 0.12;
                const tx = fuss.x + Math.cos(a) * 15, ty = fuss.y - h + Math.sin(a) * 9;
                pandaStrich(ctx, fuss.x, fuss.y - h, tx, ty, 3.4, '#5fe04a', '#1f7a2a');
            }
        });
        p.hooks.onDraw.push(ctx => {
            if (!klett) return;
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            // unten deckt ein Bambushaufen die stehende Figur ab, oben sitzt der kleine Panda
            Art.glow(ctx, cx, cy, 22, '#6bff5a', 0.4);
            for (let i = -1; i <= 1; i++) {
                pandaStrich(ctx, cx + i * 8, cy + 14, cx + i * 8, cy - 12, 7, i % 2 ? '#8fc94a' : '#a8d95c', '#5f9a2e');
            }
            for (let i = 0; i < 4; i++) {
                const a = -Math.PI / 2 + (i - 1.5) * 0.75;
                pandaStrich(ctx, cx, cy - 12, cx + Math.cos(a) * 16, cy - 12 + Math.sin(a) * 11, 3.6, '#5fe04a', '#1f7a2a');
            }
            Art.glow(ctx, cx, cy - klett.hoehe, 16, '#9dff72', 0.4);
            pandaMiniZeichnen(ctx, cx, cy - klett.hoehe, 11, Math.sin(Art.time * 2.6) * 0.09);
        });
    },
});

// ── panda14: Riesenpanda ──
registerUpgrade({
    id: 'panda14', figur: 'panda', name: 'Riesenpanda', emoji: '🦣',
    text: 'Zehn Sekunden lang ist er so groß wie ein Boss und räumt mit dem Bauch alles beiseite.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 4, riesig = 0, wuchs = 0;
        const KLEIN = { w: p.w, h: p.h };
        const GROSS = { w: 56, h: 52 };    // Bosse sind 92 x 86 - gemalt wird er in Bossgroesse
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (riesig > 0) {
                riesig -= dt;
                wuchs = Math.min(1, wuchs + dt * 2.2);
                if (c.welt) escapeFromWalls(p, c.welt, 2);   // in der Groesse nicht in der Wand stecken bleiben
                if (riesig <= 0) {
                    p._riesig = 0;
                    // wieder klein: Mitte halten, damit er nicht seitwaerts springt
                    p.x += (p.w - KLEIN.w) / 2; p.y += (p.h - KLEIN.h) / 2;
                    p.w = KLEIN.w; p.h = KLEIN.h;
                    FX.burst(p.centerX(), p.centerY(), ['#c8ffb0', '#ffffff'], 9, 90, 0.45, { kind: 'smoke', size: 4 });
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 240)) return;
            cd = 26;
            riesig = 10;                       // Leander: zehn Sekunden
            p._riesig = 1;                     // Merker fuer die Messung
            wuchs = 0;
            p.x -= (GROSS.w - p.w) / 2; p.y -= (GROSS.h - p.h) / 2;
            p.w = GROSS.w; p.h = GROSS.h;
            escapeFromWalls(p, c.welt, 3);
            // mit dem Bauch werden die Gegner zur Seite geschubst (Bosse bekommen die halbe Kraft ab)
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                const d = Math.hypot(e.centerX() - p.centerX(), e.centerY() - p.centerY());
                if (d > 96) continue;
                e._riese = (e._riese || 0) + 1;
                knockBack(e, Math.atan2(e.centerY() - p.centerY(), e.centerX() - p.centerX()), e.isBoss ? 150 : 300);
            }
            FX.ring(p.centerX(), p.centerY(), '#a8d95c', 96, 0.5, 6);
            FX.burst(p.centerX(), p.centerY(), ['#a8d95c', '#eaffd0', '#ffffff'], 16, 150, 0.6, { kind: 'smoke', size: 5 });
            Game.camera.shake(7, 0.3);
            Sound.powerUp();
        });
        // der Riese wird ueber die eigene Figur gemalt (feste Art-Masse der Figur, deshalb zuskalieren)
        p.hooks.onDraw.push(ctx => {
            if (riesig <= 0) return;
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            // beim Wachsen zuerst die Schockwelle, dann der grosse Koerper
            const s = 1 + 1.9 * wuchs * (wuchs * (2 - wuchs));
            Art.glow(ctx, cx, cy, 44 * s, '#9dff72', 0.35);
            ctx.save();
            ctx.translate(cx, cy + 6);
            ctx.scale(s, s);
            pandaMiniZeichnen(ctx, 0, 0, 17, 0);
            ctx.restore();
        });
    },
});

// ── panda15: Pandababys ──
// Ein Baby ist ein zeitweiliger Helfer (spawnHelper): es folgt Mark und wirft
// kleine Pflanzen. Eigene Haken hat es nicht - main.js reicht nur update und draw durch.
class PandaBaby {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 16; this.h = 15;
        this.speed = 165;
        this.shootTimer = 0.5 + Math.random(); this.shootCooldown = 1.7;
        this.schuesse = 0;                // zaehlt fuer die Probe mit
        this.faceX = 1; this.walkT = 0;
        this.seed = Math.random() * 10;
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }
    update(dt, world, player, enemies) {
        const cx = this.centerX(), cy = this.centerY();
        this.shootTimer -= dt;
        // nah an Mark dran bleiben (mit Wandkollision wie die grossen Begleiter)
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const d = Math.hypot(px - cx, py - cy);
        if (d > 34) {
            const len = Math.min(this.speed * dt, d - 34);
            if (typeof Juri !== 'undefined') Juri.step(this, (px - cx) / d * len, (py - cy) / d * len, world);
            else { this.x += (px - cx) / d * len; this.y += (py - cy) / d * len; }
            this.walkT += dt;
            this.faceX = (px - cx) >= 0 ? 1 : -1;
        }
        if (this.shootTimer > 0 || typeof PandaPlant === 'undefined' || !Game.projectiles) return;
        const ziel = pandaNextEnemy(cx, cy, 190);
        if (!ziel) return;
        this.shootTimer = this.shootCooldown;
        const a = Math.atan2(ziel.centerY() - cy, ziel.centerX() - cx);
        const pf = new PandaPlant(cx, cy - 4, Math.cos(a) * 230, Math.sin(a) * 230, 2);
        pf.pandaBaby = true;              // damit die Probe die Wurfchen der Babys zaehlen kann
        Game.projectiles.push(pf);
        this.schuesse++;
        FX.burst(cx, cy - 4, ['#9dff72', '#c8ffb0'], 3, 55, 0.3, { kind: 'smoke', size: 3 });
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const wippen = Math.sin(Art.time * 9 + this.seed) * 1.2;
        pandaMiniZeichnen(ctx, pos.x + this.w / 2, pos.y + this.h / 2 + wippen, 8, Math.sin(Art.time * 3 + this.seed) * 0.12);
    }
}

registerUpgrade({
    id: 'panda15', figur: 'panda', name: 'Pandababys', emoji: '🍼',
    text: 'Drei kleine Pandas kommen dazu und helfen eine Weile lang mit.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 3, babys = [];
        p.hooks.onUpdate.push(dt => {
            for (let i = babys.length - 1; i >= 0; i--) {
                const b = babys[i];
                // die Engine hebt den Helfer am Zähler auf - kurz vorher poofen sie weg
                if (b.helperTimer <= 0.3 && !b._poof) {
                    b._poof = true;
                    FX.burst(b.centerX(), b.centerY(), 'rgba(240,235,255,0.9)', 7, 70, 0.4, { kind: 'smoke', size: 4 });
                }
                if (b.helperTimer <= 0) babys.splice(i, 1);
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p) || babys.length) return;
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 260)) return;
            cd = 24;
            for (let i = 0; i < 3; i++) {
                const a = (TAU * i) / 3 + Math.random() * 0.6;
                const b = spawnHelper(PandaBaby, p.centerX() + Math.cos(a) * 14, p.centerY() + Math.sin(a) * 14, 14);
                if (b) {
                    b.seed = i * 3.3 + Math.random();
                    babys.push(b);
                    FX.burst(b.centerX(), b.centerY(), ['#ffffff', '#c8ffb0', '#ffd23f'], 9, 100, 0.5, { kind: 'star' });
                }
            }
            if (Game.roundHooks) Game.roundHooks.__babys = babys;   // fuer die Messung erreichbar
            if (babys.length) { Sound.powerUp(); FX.ring(p.centerX(), p.centerY(), '#ffd23f', 40, 0.5, 4); }
        });
    },
});

// ── panda16: Teepause ──
registerUpgrade({
    id: 'panda16', figur: 'panda', name: 'Teepause', emoji: '🍵',
    text: 'Er kocht Tee: Mark, Juri und das Krokodil heilen eine Zeit lang langsam von selbst.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda, spieler = c.player;
        if (!p || !spieler) return;
        let cd = 5, pause = 0, tropf = 0, dampf = 0;
        const freunde = () => [spieler, c.juri, c.croc].filter(f => f && !f.dead && f.hp < f.maxHp);
        p.hooks.onUpdate.push(dt => {
            if (pause <= 0) {
                cd -= dt;
                if (cd > 0 || !pandaKann(p)) return;
                if (!freunde().length) { cd = 0.8; return; }
                pause = 8;
                cd = 26;
                FX.text(p.centerX(), p.y - 12, '🍵', '#8fd6a0', 15, { life: 1.6 });
                FX.ring(p.centerX(), p.centerY(), '#8fd6a0', 44, 0.6, 4);
                Sound.powerUp();
            }
            pause -= dt;
            tropf -= dt;
            dampf -= dt;
            if (dampf <= 0) {
                dampf = 0.35;
                for (const f of (Game.companions || []).concat([spieler])) {
                    if (!f || f.dead || f === p || (f !== spieler && f !== c.juri && f !== c.croc)) continue;
                    FX.burst(f.x + f.w / 2, f.y + f.h / 2 - 14,
                        'rgba(220,255,235,0.85)', 2, 26, 0.7, { kind: 'smoke', size: 3 });
                }
            }
            if (tropf > 0) return;
            tropf = 1;
            for (const f of freunde()) {
                f.hp = Math.min(f.maxHp, f.hp + 1);          // ein Punkt pro Sekunde = langsam
                const fx = f.x + f.w / 2, fy = f.y + f.h / 2;   // der Held hat kein centerX(), die Begleiter schon
                FX.text(fx, f.y - 8, '+ 🍵', '#8fd6a0', 11, { life: 1 });
                FX.burst(fx, fy, ['#8fd6a0', '#dfffe9', '#ffffff'], 5, 55, 0.5, { kind: 'star' });
            }
            if (pause <= 0) FX.ring(p.centerX(), p.centerY(), '#8fd6a0', 30, 0.4, 3);
        });
    },
});

// ── panda17: Kampfkunst-Panda ──
registerUpgrade({
    id: 'panda17', figur: 'panda', name: 'Kampfkunst-Panda', emoji: '🥋',
    text: 'Er tritt und schlägt blitzschnell um sich, solange Gegner in der Nähe sind.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, kombination = null;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (kombination) {
                kombination.t += dt;
                kombination.schlag -= dt;
                if (kombination.schlag <= 0) {
                    kombination.schlag = 0.18;              // blitzschnell: alle achtzehntel Sekunden
                    kombination.tritt = !kombination.tritt; // Tritt und Schlag im Wechsel
                    const winkel = kombination.ziel
                        ? Math.atan2(kombination.ziel.centerY() - p.centerY(), kombination.ziel.centerX() - p.centerX())
                        : p.facingAngle;
                    kombination.winkel = winkel;
                    FX.ring(p.centerX(), p.centerY(), kombination.tritt ? '#ffd23f' : '#c8f07a', 46, 0.22, 3);
                    for (const e of (Game.enemies || [])) {
                        if (!e || e.dead) continue;
                        if (Math.hypot(e.centerX() - p.centerX(), e.centerY() - p.centerY()) > 52 + Math.max(e.w, e.h) / 2) continue;
                        e._kampfkunst = (e._kampfkunst || 0) + 1;
                        e.takeDamage(3, winkel, 170);
                        FX.burst(e.centerX(), e.centerY(), ['#ffffff', '#ffd23f', '#c8f07a'], 6, 120, 0.35, { kind: 'spark' });
                    }
                    Sound.swing();
                }
                if (kombination.t >= kombination.dauer) kombination = null;
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 62);
            if (!z) return;
            cd = 6;
            kombination = { t: 0, dauer: 1.1, schlag: 0, tritt: false, ziel: z, winkel: 0 };
            FX.burst(p.centerX(), p.centerY(), ['#ffd23f', '#ffffff'], 8, 110, 0.4, { kind: 'spark' });
        });
        p.hooks.onDraw.push(ctx => {
            if (!kombination) return;
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            const schwenk = (kombination.t / 0.18) % 1;
            const a = kombination.winkel + (kombination.tritt ? 0.7 : -0.7) * (1 - schwenk);
            const r = kombination.tritt ? 24 : 20;
            const hx = cx + Math.cos(a) * r, hy = cy + Math.sin(a) * r;
            // Armen-/Fußspur: vom Körper zur schnellen Pfote
            ctx.strokeStyle = kombination.tritt ? 'rgba(255,210,63,0.55)' : 'rgba(200,240,122,0.55)';
            ctx.lineWidth = kombination.tritt ? 6 : 4.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy, r, a - 1.1, a);
            ctx.stroke();
            Art.limb(ctx, cx, cy + (kombination.tritt ? 6 : -2), hx, hy, kombination.tritt ? 5.4 : 4.2,
                kombination.tritt ? '#2b2734' : '#f7f5ff', { lineWidth: 1.2, outline: '#4a4560' });
            Art.glow(ctx, hx, hy, 11, kombination.tritt ? '#ffd23f' : '#9dff72', 0.6);
            // der Gegenangriff: die freie Pfote halten Deckung
            Art.glow(ctx, cx - Math.cos(a) * 12, cy - Math.sin(a) * 12, 7, '#c8f07a', 0.4);
        });
    },
});

// ── panda18: Bambuspfeile ──
// Spitzer Bambuspfeil: durchfliegt bis zu drei Gegner (main.js zaelt pro Pfeil
// ab, pierce/pierceHits sind die vorhandene Engine-Schnittstelle dafuer).
class BambooArrow extends Projectile {
    constructor(x, y, a) {
        super(x, y, Math.cos(a) * 430, Math.sin(a) * 430, 4, 'player', 130);
        this.radius = 5;
        this.pierce = 2;                // durch diesen Pfeil hindurch: zwei weitere Gegner
        this.pierceHits = [];
        this.arrow = true;              // daran erkennt die Probe den Pfeil
        this.seed = Math.random() * 10;
    }
    update(dt, world) {
        this.age += dt;
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (world && world.isWall(nx, ny)) {
            FX.burst(this.x, this.y, ['#a8d95c', '#eaffd0'], 5, 70, 0.3, { kind: 'spark' });
            this.dead = true;
            return;
        }
        this.x = nx; this.y = ny;
        if (this.age > 1.5) this.dead = true;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const a = Math.atan2(this.vy, this.vx);
        Art.glow(ctx, pos.x, pos.y, 13, '#a8d95c', 0.5);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(a);
        pandaStrich(ctx, -11, 0, 6, 0, 3.4, '#a8d95c', '#5f9a2e');
        for (let i = -1; i <= 1; i++) pandaStrich(ctx, i * 4 - 1, -2.6, i * 4 + 1, 2.6, 0.9, '#5f9a2e');
        // Spitze
        ctx.fillStyle = '#eaffd0';
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(5, -3.4); ctx.lineTo(5, 3.4); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5f9a2e'; ctx.lineWidth = 0.9; ctx.stroke();
        // Befiederung
        ctx.fillStyle = '#8fc94a';
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.moveTo(-11 + i * 3, 0);
            ctx.lineTo(-14 + i * 3, -3.6);
            ctx.lineTo(-9 + i * 3, -1);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-11 + i * 3, 0);
            ctx.lineTo(-14 + i * 3, 3.6);
            ctx.lineTo(-9 + i * 3, 1);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}

registerUpgrade({
    id: 'panda18', figur: 'panda', name: 'Bambuspfeile', emoji: '🏹',
    text: 'Spitze Bambuspfeile fliegen durch mehrere Gegner hindurch.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 1.5, pfeile = [];
        p.hooks.onUpdate.push(dt => {
            for (let i = pfeile.length - 1; i >= 0; i--) {
                // main.js aktualisiert jedes Geschoss selbst - hier nur den Tod abholen
                if (pfeile[i].dead) {
                    if ((pfeile[i].pierceHits || []).length && Game.roundHooks) {
                        Game.roundHooks.__pfeilTreffer = Math.max(Game.roundHooks.__pfeilTreffer || 0, pfeile[i].pierceHits.length);
                    }
                    pfeile.splice(i, 1);
                }
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 320);
            if (!z) return;
            if (c.welt && typeof Juri !== 'undefined' &&
                !Juri.lineClear(c.welt, p.centerX(), p.centerY(), z.centerX(), z.centerY())) return;
            cd = 2.4;
            const m = p.muzzle();
            const pf = new BambooArrow(m.x, m.y, Math.atan2(z.centerY() - m.y, z.centerX() - m.x));
            Game.projectiles.push(pf);
            pfeile.push(pf);
            if (Game.roundHooks) Game.roundHooks.__pfeile = pfeile;   // fuer die Messung erreichbar
            p.puffTimer = 0.3;
            FX.burst(m.x, m.y, ['#eaffd0', '#9dff72'], 5, 90, 0.3, { kind: 'smoke', size: 3 });
            Sound.shoot();
        });
    },
});

// ── panda19: Dornenteppich ──
class ThornCarpet {
    constructor(x, y, sekunden) {
        this.x = x; this.y = y;
        this.life = sekunden; this.dauer = sekunden;
        this.tick = 0.3;
        this.spread = 0;
        this.dead = false;
        this.seed = Math.random() * 10;
        this.dornen = [];
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU, d = Math.sqrt(Math.random());
            this.dornen.push({
                x: Math.cos(a) * d, y: Math.sin(a) * d * 0.62,
                la: 8 + Math.random() * 6, dreh: randRange(-0.4, 0.4),
            });
        }
    }
    update(dt) {
        this.life -= dt;
        this.spread = Math.min(1, this.spread + dt * 2.6);
        this.tick -= dt;
        if (this.tick <= 0) {
            this.tick = 0.6;
            let traf = 0;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                if (Math.hypot(e.centerX() - this.x, e.centerY() - this.y) > 46 + Math.max(e.w, e.h) / 2) continue;
                e._dornen = (e._dornen || 0) + 1;
                e.takeDamage(1, Math.atan2(e.centerY() - this.y, e.centerX() - this.x), 40);
                traf++;
            }
            if (traf) {
                FX.burst(this.x, this.y - 4, ['#8ad24a', '#d6ff8a', '#2a8f3a'], 5, 70, 0.4, { kind: 'spark' });
                Sound.hit();
            }
        }
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x, y = pos.y, k = this.spread;
        const welk = this.life < 1.2 ? Math.max(0, this.life / 1.2) : 1;
        ctx.save();
        ctx.globalAlpha *= 0.55 + 0.45 * welk;
        // Moosiger Teppich, darueber die Dornen
        ctx.fillStyle = '#2f7a34';
        ctx.beginPath();
        ctx.ellipse(x, y, 48 * k, 30 * k, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(122,207,90,0.5)';
        ctx.beginPath();
        ctx.ellipse(x - 8 * k, y - 5 * k, 26 * k, 14 * k, 0, 0, TAU);
        ctx.fill();
        for (const d of this.dornen) {
            const dx = x + d.x * 46 * k, dy = y + d.y * 30 * k;
            const la = d.la * k * (0.85 + 0.15 * Math.sin(Art.time * 4 + this.seed + d.x * 6));
            ctx.strokeStyle = '#3f7a1f';
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx + d.dreh * 6, dy - la);
            ctx.stroke();
            ctx.strokeStyle = '#eaffb0';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(dx + d.dreh * 4, dy - la * 0.55);
            ctx.lineTo(dx + d.dreh * 6, dy - la);
            ctx.stroke();
        }
        ctx.restore();
    }
}

registerUpgrade({
    id: 'panda19', figur: 'panda', name: 'Dornenteppich', emoji: '🌵',
    text: 'Auf dem Boden wächst ein Dornenteppich, der Gegner verletzt, die darüber laufen.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, teppiche = [];
        p.hooks.onUpdate.push(dt => {
            for (let i = teppiche.length - 1; i >= 0; i--) {
                teppiche[i].update(dt);
                if (teppiche[i].dead) teppiche.splice(i, 1);
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p) || teppiche.length >= 2) return;
            // der Teppich wächst dorthin, wo die meisten Gegner stehen
            let ziel = null, beste = 0;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                const d = Math.hypot(e.centerX() - p.centerX(), e.centerY() - p.centerY());
                if (d > 220) continue;
                let n = 0;
                for (const o of (Game.enemies || [])) {
                    if (o && !o.dead && Math.hypot(o.centerX() - e.centerX(), o.centerY() - e.centerY()) < 60) n++;
                }
                if (n > beste) { beste = n; ziel = e; }
            }
            if (!ziel) return;
            const x = ziel.centerX(), y = ziel.centerY();
            if (c.welt && c.welt.isWall(x, y)) return;
            cd = 11;
            teppiche.push(new ThornCarpet(x, y, 8));
            if (Game.roundHooks) Game.roundHooks.__dornen = teppiche;   // fuer die Messung erreichbar
            FX.burst(x, y, ['#8ad24a', '#2a8f3a', '#d6ff8a'], 12, 90, 0.55, { kind: 'spark' });
            Sound.powerUp();
        });
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            for (const t of teppiche) t.draw(ctx, camera);
        });
    },
});

// ── panda20: Bambustrommel ──
// Die Angriffstakt-Felder, die das Trommeln schneller macht (kein Feld wird
// erfunden: alle Werte gibt es an den Figuren schon).
function pandaTaktFelder(c, p) {
    const felder = [];
    const spieler = c.player;
    if (spieler) {
        for (const w of [spieler.rangedWeapon, spieler.meleeWeapon]) {
            if (w && typeof w.cooldown === 'number' && w.cooldown > 0) {
                felder.push({ obj: w, feld: 'cooldown', takt: 'cooldownTimer' });
            }
        }
    }
    if (c.juri && typeof c.juri.attackCooldown === 'number') felder.push({ obj: c.juri, feld: 'attackCooldown', takt: 'attackTimer' });
    if (c.croc && typeof c.croc.shootCooldown === 'number') felder.push({ obj: c.croc, feld: 'shootCooldown', takt: 'shootTimer' });
    if (p && typeof p.shootCooldown === 'number') felder.push({ obj: p, feld: 'shootCooldown', takt: 'shootTimer' });
    return felder;
}

registerUpgrade({
    id: 'panda20', figur: 'panda', name: 'Bambustrommel', emoji: '🥁',
    text: 'Er trommelt Takt, und alle Freunde schlagen und schießen eine Weile viel schneller.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 4, trommel = 0, schlag = 0, felder = [];
        const TAKT = 0.55;                      // so schnell wie im Takt = knapp halb so lange warten
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (trommel > 0) {
                trommel -= dt;
                schlag -= dt;
                if (schlag <= 0) {
                    schlag = 0.34;
                    FX.ring(p.centerX(), p.centerY(), '#ffd23f', 34, 0.3, 3);
                    FX.burst(p.centerX(), p.y - 6, ['#ffd23f', '#ffffff', '#ff9f2e'], 3, 60, 0.6, { kind: 'star' });
                    Game.camera.shake(1.6, 0.08);
                    Sound.hit();
                }
                if (trommel <= 0) {
                    // Takt wieder zuruecknehmen, damit nichts fuer immer schneller bleibt
                    for (const f of felder) f.obj[f.feld] = f.alt;
                    felder = [];
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 320)) return;
            felder = pandaTaktFelder(c, p);
            if (!felder.length) { cd = 1; return; }
            cd = 22;
            trommel = 8;
            schlag = 0;
            for (const f of felder) {
                f.alt = f.obj[f.feld];
                f.obj[f.feld] = Math.max(0.08, f.alt * TAKT);
                if (f.takt && typeof f.obj[f.takt] === 'number') {
                    f.obj[f.takt] = Math.min(f.obj[f.takt], f.obj[f.feld] * 0.4);   // der naechste Schwung kommt sofort
                }
            }
            FX.ring(p.centerX(), p.centerY(), '#ffd23f', 60, 0.55, 5);
            FX.text(p.centerX(), p.y - 14, '🥁', '#ffd23f', 15, { life: 1.4 });
            Sound.powerUp();
        });
        // Trommel vor seinen Pfoten, Schaeller wellt sich im Takt
        p.hooks.onDraw.push(ctx => {
            if (trommel <= 0) return;
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            const x = cx + 11, y = cy + 9;
            const welle = Math.max(0, 1 - ((0.34 - Math.max(0, 0.34 - schlag)) * 3));
            Art.glow(ctx, x, y - 4, 15, '#ffd23f', 0.4 + 0.2 * welle);
            Art.body(ctx, x, y + 3, 8.4, 6.2, '#c9552e', { outline: '#7a2c17' });
            Art.body(ctx, x, y - 2.6, 8.4, 3.2, '#f7e6c8', { outline: '#7a2c17' });
            Art.ring(ctx, x, y - 2.6, 8.4 - welle * 1.2, '#ffd23f', 1.2, 0.9);
            for (let i = -1; i <= 1; i += 2) {
                const a = -1.15 + i * 0.5 + Math.sin(Art.time * 18 + i) * 0.35;
                pandaStrich(ctx, x + i * 5, y - 4, x + i * 5 + Math.cos(a) * 9, y - 4 + Math.sin(a) * 9, 1.8, '#e8c48a', '#8a5a2a');
            }
        });
        // ueber jedem Freund, der schneller wird, ein kleiner Wirbel
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (trommel <= 0) return;
            for (const f of [c.player, c.juri, c.croc, p]) {
                if (!f || f.dead) continue;
                const pos = camera.worldToScreen(f.x, f.y);
                const cx = pos.x + f.w / 2, cy = pos.y + f.h / 2;
                const a = Art.time * 7 + (f === p ? 0 : 1.4);
                for (let i = 0; i < 2; i++) {
                    const d = a + i * Math.PI;
                    ctx.fillStyle = i ? '#ffd23f' : '#ff9f2e';
                    ctx.beginPath();
                    ctx.arc(cx + Math.cos(d) * 15, cy - 12 + Math.sin(d) * 5, 2.4, 0, TAU);
                    ctx.fill();
                }
            }
        });
    },
});

// ── panda21: Schwarz-Weiß-Blitz ──
registerUpgrade({
    id: 'panda21', figur: 'panda', name: 'Schwarz-Weiß-Blitz', emoji: '⚡',
    text: 'Er wird kurz schwarz-weiß unsichtbar und taucht hinter den Gegnern wieder auf.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda, spieler = c.player;
        if (!p || !spieler) return;
        let cd = 3, blitz = null;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (blitz) {
                p.iFrames = 1;                      // waehrend des Blitzes trifft ihn nichts
                blitz.t += dt;
                if (blitz.t >= blitz.phase1 && !blitz.gesprungen) {
                    blitz.gesprungen = true;
                    p.x = blitz.zielX; p.y = blitz.zielY;
                    if (c.welt) escapeFromWalls(p, c.welt, 3);
                    FX.burst(p.centerX(), p.centerY(), ['#ffffff', '#2b2734', '#c9d6ff'], 12, 120, 0.45, { kind: 'spark' });
                    FX.ring(p.centerX(), p.centerY(), '#ffffff', 26, 0.35, 3);
                }
                if (blitz.t >= blitz.phase1 + blitz.phase2) blitz = null;
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 260);
            if (!z) return;
            // hinter dem Gegner landen - von Mark aus gesehen die andere Seite
            const weg = Math.atan2(z.centerY() - (spieler.y + spieler.h / 2), z.centerX() - (spieler.x + spieler.w / 2));
            const radius = Math.max(z.w, z.h) / 2 + 16;
            let sx = null, sy = null;
            for (let versuch = 0; versuch < 8 && sx === null; versuch++) {
                const a = weg + (versuch ? (versuch % 2 ? 1 : -1) * Math.ceil(versuch / 2) * 0.5 : 0);
                const x = z.centerX() + Math.cos(a) * radius - p.w / 2;
                const y = z.centerY() + Math.sin(a) * radius - p.h / 2;
                if (c.welt && c.welt.isWall(x + p.w / 2, y + p.h / 2)) continue;
                sx = x; sy = y;
            }
            if (sx === null) return;
            cd = 9;
            blitz = {
                t: 0, phase1: 0.32, phase2: 0.26, gesprungen: false,
                altX: p.centerX(), altY: p.centerY(), zielX: sx, zielY: sy,
            };
            FX.burst(p.centerX(), p.centerY(), ['#ffffff', '#2b2734'], 12, 120, 0.45, { kind: 'spark' });
            Sound.dodge();
        });
        // der Schwarz-Weiß-Wirbel: am alten Ort, solange er dort noch steht
        p.hooks.onDraw.push(ctx => {
            if (!blitz || blitz.gesprungen) return;
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            const k = Math.min(1, blitz.t / blitz.phase1);
            const decke = 19 * (1 - k * 0.35);
            for (let i = 0; i < 6; i++) {
                const a = Art.time * 22 + (TAU * i) / 6;
                ctx.fillStyle = i % 2 ? '#f7f5ff' : '#2b2734';
                ctx.beginPath();
                ctx.ellipse(cx + Math.cos(a) * decke * 0.45, cy + Math.sin(a) * decke * 0.45,
                    decke * 0.55, decke * 0.42, a, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = 0.9 - k * 0.55;
            Art.glow(ctx, cx, cy, 24, '#c9d6ff', 0.8);
            ctx.globalAlpha = 1;
        });
    },
});

// ── panda22: Giftnebel ──
class PoisonCloud {
    constructor(x, y, sekunden) {
        this.x = x; this.y = y;
        this.life = sekunden; this.dauer = sekunden;
        this.radius = 104;
        this.tick = 0.4;
        this.dead = false;
        this.seed = Math.random() * 10;
        this.bloben = [];
        for (let i = 0; i < 7; i++) {
            this.bloben.push({ a: (TAU * i) / 7, d: 0.42 + Math.random() * 0.4, r: 30 + Math.random() * 18, ph: Math.random() * 6 });
        }
    }
    update(dt) {
        this.life -= dt;
        this.tick -= dt;
        if (this.tick <= 0) {
            this.tick = 0.7;
            let traf = 0;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                if (Math.hypot(e.centerX() - this.x, e.centerY() - this.y) > this.radius + Math.max(e.w, e.h) / 2) continue;
                if (PandaBuddy.poisonEnemy(e, 3, 1)) { e._nebel = (e._nebel || 0) + 1; traf++; }
            }
            if (traf) FX.burst(this.x, this.y - 10, ['#b980ff', '#7dff5a'], 6, 60, 0.6, { kind: 'bubble' });
        }
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x, y = pos.y;
        const k = Math.min(1, (this.dauer - this.life) * 1.6) * (this.life < 1 ? Math.max(0.15, this.life) : 1);
        ctx.save();
        ctx.globalAlpha *= 0.3 * k;
        ctx.fillStyle = '#7a3fd6';
        ctx.beginPath();
        ctx.arc(x, y, this.radius * k, 0, TAU);
        ctx.fill();
        ctx.restore();
        for (const b of this.bloben) {
            const a = b.a + Art.time * 0.35 + Math.sin(Art.time * 1.3 + b.ph) * 0.2;
            const bx = x + Math.cos(a) * b.d * this.radius * k;
            const by = y + Math.sin(a) * b.d * this.radius * k * 0.75;
            ctx.save();
            ctx.globalAlpha *= 0.36 * k;
            ctx.fillStyle = '#9b5cff';
            ctx.beginPath();
            ctx.arc(bx, by, b.r * k, 0, TAU);
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.globalAlpha *= 0.2 * k;
            ctx.fillStyle = '#7dff5a';
            ctx.beginPath();
            ctx.arc(bx - b.r * 0.25, by - b.r * 0.3, b.r * 0.55 * k, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        if (Math.random() < 0.25) {
            const a = Math.random() * TAU, d = Math.random() * this.radius * k;
            FX.burst(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.75, ['#b980ff', '#7dff5a'], 1, 18, 0.8, { kind: 'bubble' });
        }
    }
}

registerUpgrade({
    id: 'panda22', figur: 'panda', name: 'Giftnebel', emoji: '🌫️',
    text: 'Eine große Giftwolke legt sich über die Gegner und macht sie krank.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 3, wolke = null;
        p.hooks.onUpdate.push(dt => {
            if (wolke) {
                wolke.update(dt);
                if (wolke.dead) wolke = null;
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            // die Wolke kommt ueber die hoechste Gegnergruppe
            let ziel = null, beste = 0;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                if (Math.hypot(e.centerX() - p.centerX(), e.centerY() - p.centerY()) > 300) continue;
                let n = 0;
                for (const o of (Game.enemies || [])) {
                    if (o && !o.dead && Math.hypot(o.centerX() - e.centerX(), o.centerY() - e.centerY()) < 110) n++;
                }
                if (n > beste) { beste = n; ziel = e; }
            }
            if (!ziel) return;
            const x = ziel.centerX(), y = ziel.centerY();
            if (c.welt && c.welt.isWall(x, y)) return;
            cd = 17;
            wolke = new PoisonCloud(x, y, 6);
            if (Game.roundHooks) Game.roundHooks.__nebel = wolke;   // fuer die Messung erreichbar
            FX.ring(x, y, '#9b5cff', 104, 0.6, 6);
            FX.burst(x, y, ['#9b5cff', '#b980ff', '#7dff5a'], 16, 130, 0.7, { kind: 'bubble' });
            Sound.powerUp();
        });
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => { if (wolke) wolke.draw(ctx, camera); });
    },
});

// ── panda23: Seerosen-Sprung ──
registerUpgrade({
    id: 'panda23', figur: 'panda', name: 'Seerosen-Sprung', emoji: '🪷',
    text: 'Er hüpft auf einem Seerosenblatt weit über die Gegner hinweg.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, sprung = null;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (sprung) {
                p.iFrames = 1;                      // in der Luft greift ihn nichts
                sprung.t += dt / sprung.dauer;
                const k = Math.min(1, sprung.t);
                sprung.bx = sprung.vonX + (sprung.x - sprung.vonX) * k;
                sprung.by = sprung.vonY + (sprung.y - sprung.vonY) * k;
                sprung.hoehe = Math.sin(Math.PI * k) * 46;
                p.x = sprung.bx - p.w / 2; p.y = sprung.by - p.h / 2;
                if (sprung.t >= 1) {
                    FX.ring(sprung.x, sprung.y, '#8fd6ff', 30, 0.45, 3);
                    FX.ring(sprung.x, sprung.y, '#dff4ff', 46, 0.6, 2);
                    FX.burst(sprung.x, sprung.y, ['#8fd6ff', '#dff4ff', '#ffffff'], 10, 110, 0.5, { kind: 'smoke', size: 4 });
                    Sound.dodge();
                    if (c.welt) escapeFromWalls(p, c.welt, 3);
                    sprung = null;
                }
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), 300);
            if (!z) return;
            // weit ueber den Gegner hinweg: immer an ihm vorbei, nie in die Wand
            const a = Math.atan2(z.centerY() - p.centerY(), z.centerX() - p.centerX());
            let ziel = null;
            for (const d of [240, 200, 170, 140, 110]) {
                const x = p.centerX() + Math.cos(a) * d, y = p.centerY() + Math.sin(a) * d;
                if (c.welt && c.welt.isWall(x, y)) continue;
                ziel = { x, y };
                break;
            }
            if (!ziel) return;
            sprung = {
                vonX: p.centerX(), vonY: p.centerY(), x: ziel.x, y: ziel.y,
                bx: p.centerX(), by: p.centerY(), hoehe: 0, t: 0, dauer: 0.62,
                weite: Math.hypot(ziel.x - p.centerX(), ziel.y - p.centerY()),
            };
            if (Game.roundHooks) Game.roundHooks.__sprung = sprung;   // fuer die Messung erreichbar
            cd = 7;
            FX.burst(p.centerX(), p.centerY(), ['#8fd6ff', '#dff4ff'], 9, 100, 0.45, { kind: 'smoke', size: 4 });
            FX.ring(p.centerX(), p.centerY(), '#8fd6ff', 26, 0.4, 3);
        });
        // das Seerosenblatt unter seinen Fussen (unter den Figuren) plus der Abdruck am Boden
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => {
            if (!sprung) return;
            const schatten = camera.worldToScreen(sprung.bx, sprung.by);
            ctx.globalAlpha = 0.26;
            ctx.fillStyle = '#120e1c';
            ctx.beginPath();
            ctx.ellipse(schatten.x + p.w / 2, schatten.y + p.h / 2, Math.max(5, 14 - sprung.hoehe * 0.09), 5, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            const x = schatten.x + p.w / 2, y = schatten.y + p.h / 2;
            const blatt = 15 - sprung.hoehe * 0.05;
            Art.glow(ctx, x, y, blatt * 1.6, '#6bff9a', 0.35);
            ctx.fillStyle = '#3fa63f';
            ctx.beginPath();
            ctx.ellipse(x, y, blatt, blatt * 0.52, 0, 0.42, TAU + 0.2);
            ctx.fill();
            ctx.strokeStyle = '#1f7a2a';
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.fillStyle = 'rgba(160,235,150,0.55)';
            ctx.beginPath();
            ctx.ellipse(x - blatt * 0.25, y - blatt * 0.14, blatt * 0.5, blatt * 0.2, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ff9ab0';
            ctx.beginPath();
            ctx.arc(x + blatt * 0.45, y - blatt * 0.1, 2.4, 0, TAU);
            ctx.fill();
        });
    },
});

// ── panda24: Glückskeks ──
registerUpgrade({
    id: 'panda24', figur: 'panda', name: 'Glückskeks', emoji: '🥠',
    text: 'Er knabbert Glückskekse und findet dabei manchmal Juwelen.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda, game = c.game;
        if (!p || !game) return;
        let cd = 5, kauen = 0;
        p.hooks.onDraw.unshift(() => pandaZeichenReset(p, c.game && c.game.camera));
        p.hooks.onUpdate.push(dt => {
            if (kauen > 0) kauen -= dt;
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            cd = 9;
            kauen = 1.1;
            if (Math.random() < 0.55) {
                // Glückskeks gefunden: Juwelen dazu (dasselbe Konto wie die Welt-Belohnungen)
                const n = 3 + Math.floor(Math.random() * 6);
                // derselbe Weg wie die Welt-Belohnungen: ueber die Konto-Buchhaltung der Engine
                if (typeof game._grantJewels === 'function') game._grantJewels(n);
                else game.jewels = (game.jewels || 0) + n;
                if (typeof game.save === 'function') game.save();
                p._keksFund = (p._keksFund || 0) + n;      // fuer die Messung
                FX.text(p.centerX(), p.y - 12, '+' + n + ' 💎', '#ffd23f', 13, { life: 1.5 });
                FX.burst(p.centerX(), p.centerY(), ['#ffd23f', '#ffffff', '#39d5ff'], 14, 130, 0.7, { kind: 'star' });
                FX.ring(p.centerX(), p.centerY(), '#ffd23f', 30, 0.45, 3);
                Sound.coin();
            } else {
                FX.burst(p.centerX(), p.centerY() - 6, ['#e8c48a', '#c9a05a'], 5, 60, 0.5);
                FX.text(p.centerX(), p.y - 10, 'leider leer', '#c9a05a', 10, { life: 1 });
            }
        });
        // der Keks, an dem er knabbert, liegt vor ihm
        p.hooks.onDraw.push(ctx => {
            const pos = p._pandaPos;
            if (!pos) return;
            const cx = pos.x + p.w / 2, cy = pos.y + p.h / 2;
            const x = cx - 13, y = cy + 8;
            const k = kauen > 0 ? 1 : 0.75;
            Art.glow(ctx, x, y, 12 * k, '#ffd23f', 0.4);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-0.35);
            ctx.fillStyle = '#e8c48a';
            ctx.beginPath();
            ctx.ellipse(0, 0, 8 * k, 5 * k, 0, Math.PI * 0.05, Math.PI * 1.05);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#a8762f';
            ctx.lineWidth = 1.1;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-8 * k, 0);
            ctx.quadraticCurveTo(0, -5 * k, 8 * k, 0);
            ctx.stroke();
            ctx.restore();
            if (kauen > 0 && Math.random() < 0.3) {
                FX.burst(x, y, ['#e8c48a', '#fff3d0'], 1, 40, 0.4);
            }
        });
    },
});

// ── panda25: Mini-Bambuswald ──
class BambooGrove {
    constructor(x, y, sekunden) {
        this.x = x; this.y = y;
        this.life = sekunden; this.dauer = sekunden;
        this.radius = 74;
        this.tick = 0.4;
        this.dead = false;
        this.seed = Math.random() * 10;
        this.halme = [];
        for (let i = 0; i < 9; i++) {
            const a = (TAU * i) / 9 + Math.random() * 0.5;
            const d = i === 0 ? 0 : 0.45 + Math.random() * 0.55;
            this.halme.push({
                x: Math.cos(a) * d, y: Math.sin(a) * d * 0.62,
                h: 34 + Math.random() * 26, dreh: randRange(-0.16, 0.16),
            });
        }
    }
    update(dt) {
        this.life -= dt;
        this.tick -= dt;
        if (this.tick <= 0) {
            this.tick = 0.5;
            for (const e of (Game.enemies || [])) {
                if (!e || e.dead) continue;
                if (Math.hypot(e.centerX() - this.x, e.centerY() - this.y) > this.radius + Math.max(e.w, e.h) / 2) continue;
                // Bosse stemmen sich gegen das Dickicht: kurz und nur ein bisschen langsamer
                if (e.isBoss) slowEnemy(e, 0.5, 0.8);
                else slowEnemy(e, 1.1, 0.45);
                e._wald = (e._wald || 0) + 1;
            }
        }
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const k = Math.min(1, (this.dauer - this.life) * 2.4);
        const welk = this.life < 1.2 ? Math.max(0, this.life / 1.2) : 1;
        ctx.save();
        ctx.globalAlpha *= 0.5 + 0.5 * welk;
        // weicher Untergrund, damit das Dickicht als Wald-Stueck zu sehen ist
        ctx.fillStyle = 'rgba(47,122,52,0.4)';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, this.radius * k, this.radius * 0.6 * k, 0, 0, TAU);
        ctx.fill();
        for (const s of this.halme) {
            const x = pos.x + s.x * this.radius * k, y = pos.y + s.y * this.radius * k;
            const h = s.h * k;
            const sway = Math.sin(Art.time * 2 + s.x * 5 + this.seed) * 2.4;
            pandaStrich(ctx, x, y, x + s.dreh * 14 + sway, y - h, 5.6, '#a8d95c', '#5f9a2e');
            for (let i = 1; i * 12 < h; i++) {
                pandaStrich(ctx, x - 2.8 + sway * (i / 3), y - i * 12, x + 2.8 + sway * (i / 3), y - i * 12, 1.2, '#5f9a2e');
            }
            if (k > 0.6) {
                for (let i = 0; i < 2; i++) {
                    const a = -Math.PI / 2 + (i ? 1 : -1) * 0.85;
                    pandaStrich(ctx, x + sway, y - h, x + sway + Math.cos(a) * 11, y - h + Math.sin(a) * 7, 3, '#5fe04a', '#1f7a2a');
                }
            }
        }
        ctx.restore();
    }
}

registerUpgrade({
    id: 'panda25', figur: 'panda', name: 'Mini-Bambuswald', emoji: '🌳',
    text: 'Ein kleiner Bambuswald wächst aus dem Boden; darin kommen Gegner nur langsam voran.',
    where: 'im Shop kaufen',
    istFrei: () => false,               // erst kaufbar, dann frei - sonst waere das Extra von Anfang an an
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 2, waeldchen = null;
        p.hooks.onUpdate.push(dt => {
            if (waeldchen) {
                waeldchen.update(dt);
                if (waeldchen.dead) waeldchen = null;
                return;
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            if (!pandaNextEnemy(p.centerX(), p.centerY(), 260)) return;
            // der Wald wächst um den Panda herum, damit Mark dahinter Deckung hat
            const x = p.centerX(), y = p.centerY();
            cd = 18;
            waeldchen = new BambooGrove(x, y, 11);
            if (Game.roundHooks) Game.roundHooks.__wald = waeldchen;   // fuer die Messung erreichbar
            FX.burst(x, y, ['#a8d95c', '#5fe04a', '#eaffd0'], 16, 120, 0.6, { kind: 'spark' });
            FX.ring(x, y, '#5fe04a', 74, 0.6, 4);
            Sound.powerUp();
        });
        if (Game.roundHooks) Game.roundHooks.onDrawWorld.push((ctx, camera) => { if (waeldchen) waeldchen.draw(ctx, camera); });
    },
});

// ══════════════════════════════════════════════════════════════════════════
// ── panda26: Kokosnuss-Rohr (Weltbelohnung Welt 57, Leander 19.10.2026) ──
// Neue Idee, nicht aus der Liste der 100: der Panda schießt Kokosnüsse aus seinem
// Bambusrohr. Als Weltbelohnung ausgezeichnet (`welt: 57`) - der Shop verkauft sie
// nicht, frei wird sie über den Merker Game.unlockedCoconutTube (js/main.js).
// ══════════════════════════════════════════════════════════════════════════
const PANDA_KOKOS = { abstand: 2.1, reichweite: 300, schaden: 5, schub: 230, tempo: 330 };

// Die fliegende Kokosnuss: rund, braun, dreht sich beim Fliegen. Schaden und der kurze
// Schub sitzen am Geschoss selbst (knockback) - main.js reicht ihn an takeDamage weiter.
class CoconutShot extends Projectile {
    constructor(x, y, winkel) {
        super(x, y, Math.cos(winkel) * PANDA_KOKOS.tempo, Math.sin(winkel) * PANDA_KOKOS.tempo,
            PANDA_KOKOS.schaden, 'player', PANDA_KOKOS.schub);
        this.radius = 7;
        this.kokos = true;                  // daran erkennt die Probe die Kokosnuss
        this.drehung = Math.random() * TAU;
        this.seed = Math.random() * 10;
    }
    update(dt, welt) {
        this.age += dt;
        const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
        if (welt && welt.isWall(nx, ny)) {
            FX.burst(this.x, this.y, ['#8a5a2a', '#c8904a', '#f4e2c0'], 7, 90, 0.35, { kind: 'spark' });
            this.dead = true;
            return;
        }
        this.x = nx; this.y = ny;
        this.drehung += dt * 8;
        if (this.age > 1.6) this.dead = true;
    }
    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = 6.4 + Math.sin(this.seed) * 0.5;
        Art.glow(ctx, p.x, p.y, 15, '#c8904a', 0.45);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.drehung);
        ctx.fillStyle = '#7a4a22';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        // helle Faserstreifen um die Schale
        ctx.strokeStyle = '#a8703a';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, r - 1.2 - i * 1.5, 0.4 + i, 2.3 + i);
            ctx.stroke();
        }
        // die drei dunklen Keimloche, die eine Kokosnuss aussehen
        ctx.fillStyle = '#3a2410';
        for (let i = 0; i < 3; i++) {
            const a = (TAU * i) / 3 - 1.1;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42 - r * 0.18, 1.15, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        Art.shine(ctx, p.x - r * 0.45, p.y - r * 0.5, 2.4, 1.5, -0.5, 0.7);
    }
}

registerUpgrade({
    id: 'panda26', figur: 'panda', name: 'Kokosnuss-Rohr', emoji: '🥥', welt: 57,
    text: 'Er schießt runde Kokosnüsse aus seinem Bambusrohr: die schlagen Schaden ein und schubsen Gegner kurz weg.',
    where: 'Welt 57 schaffen',
    // Weltbelohnung (nicht im Shop): frei nur ueber den Merker aus Welt 57
    istFrei: g => !!g.unlockedCoconutTube,
    apply(c) {
        const p = c.panda;
        if (!p) return;
        let cd = 1.2, nuesse = [];
        p.hooks.onUpdate.push(dt => {
            for (let i = nuesse.length - 1; i >= 0; i--) {
                // main.js aktualisiert jedes Geschoss selbst - hier nur den Tod abholen
                if (nuesse[i].dead) nuesse.splice(i, 1);
            }
            cd -= dt;
            if (cd > 0 || !pandaKann(p)) return;
            const z = pandaNextEnemy(p.centerX(), p.centerY(), PANDA_KOKOS.reichweite);
            if (!z) return;
            if (c.welt && typeof Juri !== 'undefined' &&
                !Juri.lineClear(c.welt, p.centerX(), p.centerY(), z.centerX(), z.centerY())) return;
            cd = PANDA_KOKOS.abstand;
            const m = p.muzzle();
            const nuss = new CoconutShot(m.x, m.y, Math.atan2(z.centerY() - m.y, z.centerX() - m.x));
            Game.projectiles.push(nuss);
            nuesse.push(nuss);
            if (Game.roundHooks) Game.roundHooks.__kokos = nuesse;   // fuer die Messung erreichbar
            p.puffTimer = 0.35;
            FX.burst(m.x, m.y, ['#c8904a', '#f4e2c0'], 6, 90, 0.35, { kind: 'smoke', size: 3 });
            Sound.shoot();
        });
    },
});
