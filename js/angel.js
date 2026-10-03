// ── Welt 26: Wolkenfestung ── (Idee von Leander)
// Böse Engel: schweben über dem weißen Festungsboden, Flügel mit dunkel-violetten Spitzen, schiefer
//   Heiligenschein und böser Blick. Sie halten Abstand und schießen Lichtfedern auf Mark; vorher heben sie
//   den Arm, die Feder leuchtet auf (~0,5 s Ankündigung). Ein Engel trägt den Schlüssel (isKeyGhost, main.js).
// Schwert-Engel (Boss): großer Engel in Rüstung mit großen Flügeln und ZWEI goldenen Schwertern.
//   Drehattacke: hebt die Schwerter (Warnkreis am Boden), dreht sich wie ein Kreisel mit ausgestreckten
//     Schwertern und rutscht dabei auf Mark zu. Wer im Schwertkreis steht, wird getroffen (auch Juri und das
//     Krokodil). Danach ist er kurz schwindelig – Zeit zum Zurückhauen.
//   Schwertwurf: Warnlinien zeigen, wohin die Schwerter fliegen – eines auf Mark, eines auf einen Freund
//     (sonst beide auf Mark). Die Schwerter drehen sich im Flug und kommen wie ein Bumerang zurück
//     (auch auf dem Rückweg gefährlich). Ohne Schwerter kann er sich nicht drehen.
//   Phase 2 (halbe LP): Schwerter leuchten heller, Drehung schneller, Wurf und Drehung kombiniert
//     (Wurf direkt aus der Drehung heraus, und nach dem Fangen sofort eine Drehung).
//   Freunde verschwinden nie durch ihn: ein Treffer, der sie besiegen würde, haut sie nur um (knockOut).

const ANGEL_ROBES = ['#a066ff', '#ff5fa8', '#38c6d9', '#6f7bff'];
const ANGEL_WING = '#f7f3ff', ANGEL_TIP = '#5b2a8f', ANGEL_SKIN = '#ffe0cc', ANGEL_HAIR = '#ffd75e';
const ANGEL_GOLD = '#ffd23f', ANGEL_GOLD_INK = '#8a5200';
const ANGEL_WARN = 0.5;           // Feder-Ankündigung (Sekunden)

const SWORDANGEL_ARMOR = '#6c5ce7', SWORDANGEL_TUNIC = '#c04ad8';
const SWORDANGEL_SPIN_R = 64;     // Schwertkreis der Drehattacke (um die Mitte der Hitbox)
const SWORDANGEL_DMG = 2;         // halbes Herz pro Schwerttreffer
const SWORDANGEL_LOCK = 0.3;      // so lange vor dem Wurf steht die Richtung fest
const SWORDANGEL_THROW_WARN = 0.85; // Phase 2: Warnlinien so lange vor dem Wurf aus der Drehung
const SWORDANGEL_LEN = 46;        // Schwertlänge

const AngelArt = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine (Galerie) direkt.
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && typeof Game.hurtPlayer === 'function') {
            Game.hurtPlayer(amount, angle, force);
        } else if (player && player.takeDamage) {
            player.takeDamage(amount, angle, force);
        }
    },

    shake(strength, time) {
        if (typeof Game !== 'undefined' && Game.camera && Game.camera.shake) Game.camera.shake(strength, time);
    },

    burst(x, y, colors, n, speed, life, o) {
        if (typeof FX !== 'undefined') FX.burst(x, y, colors, n, speed, life, o || {});
    },

    ring(x, y, color, radius, life, width) {
        if (typeof FX !== 'undefined') FX.ring(x, y, color, radius, life, width);
    },

    // Begleiter treffen (Juri, Krokodil): nie verschwinden lassen, ein tödlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(8);
        else c.takeDamage(amount);
        this.burst(c.x + c.w / 2, c.y + c.h / 2, [ANGEL_GOLD, '#ffffff'], 10, 140, 0.45, { kind: 'star' });
    },

    // Wache, treffbare Begleiter (nicht die Schlange auf Marks Schulter)
    companions() {
        const out = [];
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Flügel an der Schulter (0, 0), zeigt nach Seite s (+1 rechts), Größe sz (1 ≈ 21 Einheiten Spannweite).
    // Weiße Federn mit drei dunkel-violetten Spitzen.
    wing(ctx, s, sz, lw, tip) {
        Art.shape(ctx, c => {
            c.moveTo(0, 0);
            c.quadraticCurveTo(s * 6 * sz, -14 * sz, s * 20 * sz, -16 * sz);
            c.quadraticCurveTo(s * 17 * sz, -10 * sz, s * 21 * sz, -7 * sz);
            c.quadraticCurveTo(s * 15 * sz, -5 * sz, s * 17 * sz, 0);
            c.quadraticCurveTo(s * 10 * sz, -1 * sz, s * 10 * sz, 4 * sz);
            c.quadraticCurveTo(s * 5 * sz, 1 * sz, 0, 4 * sz);
            c.closePath();
        }, { x: s > 0 ? 0 : -21 * sz, y: -16 * sz, w: 21 * sz, h: 20 * sz }, ANGEL_WING, { lineWidth: lw, outline: '#4a3a8a' });
        ctx.beginPath();
        ctx.ellipse(s * 18.6 * sz, -14.2 * sz, 3.2 * sz, 1.7 * sz, s * -0.25, 0, TAU);
        ctx.moveTo(s * 19.6 * sz + 3 * sz, -7.6 * sz);
        ctx.ellipse(s * 19 * sz, -7.6 * sz, 3 * sz, 1.6 * sz, s * 0.15, 0, TAU);
        ctx.moveTo(s * 15.6 * sz + 2.6 * sz, -1 * sz);
        ctx.ellipse(s * 15.4 * sz, -1 * sz, 2.6 * sz, 1.5 * sz, s * 0.5, 0, TAU);
        ctx.fillStyle = tip || ANGEL_TIP;
        ctx.fill();
        ctx.lineWidth = lw * 0.6;
        ctx.strokeStyle = '#2a1050';
        ctx.stroke();
        // Federlinien
        ctx.strokeStyle = 'rgba(120,100,190,0.55)';
        ctx.lineWidth = Math.max(0.6, lw * 0.5);
        ctx.beginPath();
        ctx.moveTo(s * 4 * sz, -2 * sz);
        ctx.quadraticCurveTo(s * 10 * sz, -8 * sz, s * 16 * sz, -10 * sz);
        ctx.moveTo(s * 5 * sz, 1.5 * sz);
        ctx.quadraticCurveTo(s * 10 * sz, -2 * sz, s * 14 * sz, -4 * sz);
        ctx.stroke();
    },

    // Schiefer Heiligenschein (Ellipse, gedreht)
    halo(ctx, x, y, rx, rot, lw, col) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.34, rot, 0, TAU);
        ctx.strokeStyle = ANGEL_GOLD_INK;
        ctx.lineWidth = lw + 1.6;
        ctx.stroke();
        ctx.strokeStyle = col || ANGEL_GOLD;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = lw * 0.4;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.34, rot, Math.PI * 1.1, Math.PI * 1.45);
        ctx.stroke();
    },

    // Goldenes Schwert entlang +x, Griff am Ursprung (Klinge 0..L). bright 0..1 = Leuchten.
    sword(ctx, L, bright) {
        const bw = Math.min(5, L * 0.11);
        if (bright > 0) {
            Art.glow(ctx, L * 0.55, 0, L * 0.62, '#ffe066', 0.35 + 0.5 * bright);
            Art.glow(ctx, L, 0, L * 0.3, '#ffffff', 0.4 * bright);
        }
        Art.limb(ctx, -1, 0, -L * 0.17, 0, bw * 1.1, '#7a3fd0', { lineWidth: 1 });
        Art.body(ctx, -L * 0.21, 0, bw * 0.85, bw * 0.85, ANGEL_GOLD, { lineWidth: 1, outline: ANGEL_GOLD_INK, highlight: false });
        Art.shape(ctx, c => {
            c.moveTo(1.5, -bw);
            c.lineTo(L - bw * 1.7, -bw);
            c.lineTo(L, 0);
            c.lineTo(L - bw * 1.7, bw);
            c.lineTo(1.5, bw);
            c.closePath();
        }, { x: 1.5, y: -bw, w: L - 1.5, h: bw * 2 }, ANGEL_GOLD, { lineWidth: 1.3, outline: ANGEL_GOLD_INK, glossy: true });
        ctx.strokeStyle = '#fff6c4';
        ctx.lineWidth = Math.max(0.8, bw * 0.35);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(4, -bw * 0.15);
        ctx.lineTo(L - bw * 2.2, -bw * 0.15);
        ctx.stroke();
        Art.box(ctx, -2.3, -bw * 2.5, 4.6, bw * 5, 1.6, '#ffb020', { lineWidth: 1.1, outline: '#7a4200', highlight: false });
        ctx.fillStyle = '#ff3d7a';
        ctx.beginPath();
        ctx.arc(0, 0, bw * 0.55, 0, TAU);
        ctx.fill();
        if (bright > 0.3) Art.sparkle(ctx, L * 0.7, -bw * 0.4, 2 + bright * 2.5, '#ffffff', 0.5 + 0.5 * Math.sin(Art.time * 9));
    },
};

// ══════════════════════════════════════════
// ── Böser Engel ──
// ══════════════════════════════════════════

// Kleiner Engel im bunten Gewand mit blonden Locken. Schwebt (flying), hält 100–160 Einheiten Abstand,
// fliegt seitwärts und schießt alle 2–3 s eine Lichtfeder (Schlüsselträger: drei im Fächer).
class EvilAngel extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(52, 62);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;   // Schlüsselträger darf nicht in der Wand landen
        this.flying = true;
        this.robe = ANGEL_ROBES[Math.floor(Math.random() * ANGEL_ROBES.length)];
        this.fxColor = this.robe;
        this.seed = Math.random() * 10;
        this.haloTilt = (Math.random() < 0.5 ? -1 : 1) * randRange(0.25, 0.45);
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.detectionRange = 240;
        this.engaged = false;
        this.shootT = randRange(1.4, 2.8);
        this.charge = 0;                  // 0..1 Ankündigung (nur Anzeige)
        this.throwT = 0;                  // Arm kurz vorgestreckt nach dem Schuss (nur Anzeige)
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.strafeT = randRange(0.8, 1.8);
        this.wanderT = 0;
        this.wx = 0;
        this.wy = 0;
        this._keyInit = false;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): etwas zäher
            this._keyInit = true;
            this.hp = this.maxHp = 9;
        }
        if (this.throwT > 0) this.throwT -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 70) this.engaged = false;

        this.charge = 0;
        if (this.engaged) {
            this.shootT -= dt;
            if (this.shootT <= ANGEL_WARN) {
                if (typeof Juri === 'undefined' || Juri.lineClear(world, mx, my - 6, px, py)) {
                    // Ankündigung: steht still, hebt den Arm, die Feder leuchtet
                    this.charge = clamp(1 - this.shootT / ANGEL_WARN, 0, 1);
                    if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
                    this._look(dx / dist, dy / dist, dt);
                    if (this.shootT <= 0) {
                        this._shoot(px, py, projectiles);
                        this.shootT = randRange(2.2, 3.3);
                    }
                    return;
                }
                this.shootT = ANGEL_WARN + 0.1;   // keine freie Sicht: später nochmal
            }
        }

        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            if (dist > 160) {
                vx = dx / dist; vy = dy / dist; sp = this.speed;
            } else if (dist < 100) {
                vx = -dx / dist; vy = -dy / dist; sp = this.speed * 0.9;
            } else {
                this.strafeT -= dt;
                if (this.strafeT <= 0) {
                    this.strafe = -this.strafe;
                    this.strafeT = randRange(0.9, 2);
                }
                vx = (-dy / dist) * this.strafe; vy = (dx / dist) * this.strafe; sp = this.speed * 0.6;
            }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.4, 3);
                const a = Math.random() * TAU;
                this.wx = Math.cos(a);
                this.wy = Math.sin(a);
            }
            vx = this.wx; vy = this.wy; sp = this.speed * 0.35;
        }
        if (sp > 0) {
            const ox = this.x, oy = this.y;
            this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
            if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) {
                if (this.engaged) this.strafe = -this.strafe;
                else this.wanderT = 0;
            }
        }
        if (this.engaged) {
            if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
            this._look(dx / dist, dy / dist, dt);
        } else {
            if (Math.abs(vx) > 0.2) this.face = vx > 0 ? 1 : -1;
            this._look(vx * 0.6, vy * 0.6 + 0.2, dt);
        }
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    _shoot(px, py, projectiles) {
        const sx = this.centerX() + this.face * 9, sy = this.y + this.h - 26;
        const a = Math.atan2(py - sy, px - sx);
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (list) {
            if (this.isKeyGhost) for (let i = -1; i <= 1; i++) list.push(new LightFeather(sx, sy, a + i * 0.26));
            else list.push(new LightFeather(sx, sy, a));
        }
        this.throwT = 0.25;
        AngelArt.burst(sx, sy, ['#fff1a8', '#ffffff'], 5, 80, 0.3, { kind: 'spark' });
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 14)) {
                ctx.translate(cx, by);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            this._drawDeathFeathers(ctx, cx, by - 14);
            return;
        }
        ctx.translate(cx, by);
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 20 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Engel mit Fußpunkt (0, 0); schwebt etwas darüber.
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const ch = dead ? 0 : this.charge;
        const hv = -5 + Math.sin(t * 3.1 + sd) * 2.4;
        const flap = dead ? 0 : Math.sin(t * 9 + sd) * 0.28 - ch * 0.35;
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, hv - 16, 24, '#ffd23f', 0.4 + 0.12 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(0, hv);
        // Flügel hinter dem Körper
        for (let s = -1; s <= 1; s += 2) {
            ctx.save();
            ctx.translate(s * 4, -15);
            ctx.rotate(s * flap);
            AngelArt.wing(ctx, s, 0.72, 1.1);
            ctx.restore();
        }
        // Gewand (Glocke mit Wellensaum)
        const sway = Math.sin(t * 2.4 + sd) * 1.2;
        Art.shape(ctx, c => {
            c.moveTo(-4.5, -16);
            c.lineTo(4.5, -16);
            c.quadraticCurveTo(8.5, -8, 9 + sway, -1);
            c.quadraticCurveTo(6, 1.5, 3, -0.5);
            c.quadraticCurveTo(0, 1.8, -3, -0.5);
            c.quadraticCurveTo(-6, 1.5, -9 + sway, -1);
            c.quadraticCurveTo(-8.5, -8, -4.5, -16);
            c.closePath();
        }, { x: -9, y: -16, w: 18, h: 17 }, this.robe, { lineWidth: 1.3 });
        // goldener Gürtel
        ctx.fillStyle = ANGEL_GOLD;
        ctx.fillRect(-5.6, -11.5, 11.2, 1.8);
        // Arm: beim Ankündigen hoch, mit leuchtender Feder
        const raise = ch > 0 ? 1 : (this.throwT > 0 ? 0.5 : 0);
        const hx = f * (7 + raise * 2), hy = -12 - raise * 10;
        Art.limb(ctx, f * 3.5, -13.5, hx, hy, 2.6, this.robe, { lineWidth: 1 });
        // Kopf mit Locken
        Art.body(ctx, 0, -22, 7.6, 7, ANGEL_SKIN, { lineWidth: 1.3 });
        ctx.fillStyle = ANGEL_HAIR;
        ctx.strokeStyle = '#a8761a';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(-4.6, -27.2, 3, 0, TAU);
        ctx.moveTo(2, -28.6);
        ctx.arc(-0.6, -28.6, 2.6, 0, TAU);
        ctx.moveTo(6.6, -27.4);
        ctx.arc(3.8, -27.4, 2.8, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (dead) LateWorldArt.xEyes(ctx, f * 0.8, -21.5, 1.5, 3);
        else Art.eyes(ctx, f * 0.8, -21.5, 2.5, { gap: 3, look: this.look, angry: true, iris: '#c0306a', seed: sd });
        Art.mouth(ctx, f * 0.8, -17.2, 4.2, dead ? 'o' : (ch > 0.3 ? 'grin' : 'angry'));
        // schiefer Heiligenschein
        AngelArt.halo(ctx, f * 1.5, -32 + Math.sin(t * 2 + sd) * 0.6, 6.4, this.haloTilt, 1.4);
        if (!dead && ch > 0) {
            Art.glow(ctx, hx, hy - 2, 6 + ch * 9, '#fff1a8', 0.4 + ch * 0.5);
            ctx.save();
            ctx.translate(hx, hy - 2);
            ctx.rotate(-Math.PI / 2 + f * 0.3);
            LightFeather.shape(ctx, 0.75);
            ctx.restore();
        }
        Art.body(ctx, hx, hy, 2, 2, ANGEL_SKIN, { lineWidth: 0.9, highlight: false });
        ctx.restore();
    }

    // ein paar Federn wirbeln beim Besiegen davon
    _drawDeathFeathers(ctx, x, y) {
        const k = clamp(this.deathProgress(), 0, 1);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (1 - k);
        for (let i = 0; i < 4; i++) {
            const a = (i * TAU) / 4 + this.seed;
            ctx.save();
            ctx.translate(x + Math.cos(a) * (4 + k * 18), y + Math.sin(a) * (4 + k * 12) - k * 6);
            ctx.rotate(a + k * 3);
            LightFeather.shape(ctx, 0.6);
            ctx.restore();
        }
        ctx.globalAlpha = a0;
    }
}

// Lichtfeder der bösen Engel: weiße Feder mit violetter Spitze, goldenes Leuchten und Schweif.
class LightFeather extends Projectile {
    constructor(x, y, angle) {
        super(x, y, Math.cos(angle) * 145, Math.sin(angle) * 145, 1, 'enemy', 60);
        this.radius = 5;
        this.lifetime = 2.6;
    }

    // Feder entlang +x (Spitze bei +x), Größe s
    static shape(ctx, s) {
        ctx.beginPath();
        ctx.moveTo(-9 * s, 0);
        ctx.quadraticCurveTo(-2 * s, -5 * s, 8 * s, -1 * s);
        ctx.lineTo(9.5 * s, 0);
        ctx.lineTo(8 * s, 1 * s);
        ctx.quadraticCurveTo(-2 * s, 5 * s, -9 * s, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#4a3a8a';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = ANGEL_TIP;
        ctx.beginPath();
        ctx.ellipse(6.5 * s, 0, 3 * s, 1.8 * s, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#c9b8ff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-10 * s, 0);
        ctx.lineTo(5 * s, 0);
        ctx.stroke();
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.35;
        ctx.fillStyle = '#fff1a8';
        ctx.beginPath();
        ctx.moveTo(p.x - dy * 4, p.y + dx * 4);
        ctx.lineTo(p.x - dx * 18, p.y - dy * 18);
        ctx.lineTo(p.x + dy * 4, p.y - dx * 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev;
        Art.glow(ctx, p.x, p.y, 14, '#ffe066', 0.7);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(dy, dx) + Math.sin(this.age * 18) * 0.12);
        LightFeather.shape(ctx, 0.9);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Fliegendes Schwert (Bumerang) ──
// ══════════════════════════════════════════

// Liegt in der Geschoss-Liste (owner 'bossfx': die Engine prüft keine Treffer, das macht das Schwert selbst).
// Hinflug zum festen Zielpunkt (bremst am Ende ab), dann Rückflug zur Hand des Engels (wird schneller).
// Trifft Mark und Begleiter je Flugrichtung höchstens einmal. Kommt immer zurück: ist der Engel weg,
// verschwindet es; dauert es zu lange, holt der Engel es selbst zurück (siehe BossSwordAngel._checkSwords).
class AngelSword {
    constructor(boss, idx, x, y, tx, ty) {
        this.boss = boss;
        this.idx = idx;
        this.x = x;
        this.y = y;
        this.x0 = x;
        this.y0 = y;
        this.tx = tx;
        this.ty = ty;
        this.owner = 'bossfx';
        this.damage = 0;
        this.radius = 13;
        this.dead = false;
        this.caught = false;
        this.age = 0;
        this.phase = 'out';
        this.t = 0;
        this.outDur = clamp(Math.hypot(tx - x, ty - y) / 250, 0.45, 1.35);
        this.speed = 40;
        this.rot = Math.atan2(ty - y, tx - x);
        this.spin = idx === 0 ? -1 : 1;
        this.hit = [];
    }

    update(dt) {
        this.age += dt;
        const b = this.boss;
        if (!b || b.dead) {
            this.dead = true;
            return;
        }
        this.rot += this.spin * 15 * dt;
        if (this.phase === 'out') {
            this.t += dt;
            const k = clamp(this.t / this.outDur, 0, 1);
            const e = Math.sin((k * Math.PI) / 2);
            this.x = this.x0 + (this.tx - this.x0) * e;
            this.y = this.y0 + (this.ty - this.y0) * e;
            if (k >= 1) {
                this.phase = 'back';
                this.hit.length = 0;     // auf dem Rückweg wieder gefährlich
            }
        } else {
            const h = b._hand(this.idx);
            const dx = h.x - this.x, dy = h.y - this.y;
            const d = Math.hypot(dx, dy);
            this.speed = Math.min(360, this.speed + 520 * dt);
            const step = this.speed * dt;
            if (d <= Math.max(16, step)) {
                this.dead = true;
                this.caught = true;
                b._catchSword(this);
                return;
            }
            this.x += (dx / d) * step;
            this.y += (dy / d) * step;
        }
        this._hits();
    }

    _hits() {
        if (typeof Game === 'undefined') return;
        const P = Game.player;
        if (P && !P.dead && this.hit.indexOf(P) < 0) {
            const px = P.x + P.w / 2, py = P.y + P.h / 2;
            if (Math.hypot(px - this.x, py - this.y) < this.radius + P.w / 2) {
                const before = P.hp;
                AngelArt.hurt(P, SWORDANGEL_DMG, Math.atan2(py - this.y, px - this.x), 200);
                if (P.hp < before) {
                    this.hit.push(P);
                    AngelArt.burst(px, py, [ANGEL_GOLD, '#ffffff'], 10, 140, 0.45, { kind: 'star' });
                }
            }
        }
        for (const c of AngelArt.companions()) {
            if (c.iFrames > 0 || this.hit.indexOf(c) >= 0) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - this.x, cy - this.y) > this.radius + Math.max(c.w, c.h) / 2) continue;
            this.hit.push(c);
            AngelArt.hitCompanion(c, SWORDANGEL_DMG);
        }
    }

    // Schatten am Boden (zeigt, wo das Schwert gerade ist)
    drawUnder(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y + 14);
        ctx.fillStyle = 'rgba(40,30,90,0.22)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 14, 4.5, 0, 0, TAU);
        ctx.fill();
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const p2 = this.boss && this.boss.phase === 2;
        // Wirbelscheibe
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.22;
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(p.x, p.y, SWORDANGEL_LEN * 0.55, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev;
        Art.ring(ctx, p.x, p.y, SWORDANGEL_LEN * 0.55, '#fff6c4', 1.6, 0.6);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.rot);
        ctx.translate(-SWORDANGEL_LEN * 0.4, 0);
        AngelArt.sword(ctx, SWORDANGEL_LEN, p2 ? 1 : 0.45);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 26: Schwert-Engel ──
// ══════════════════════════════════════════

// Großer Engel in violetter Rüstung mit goldenen Kanten, Helm mit Flügelchen, schiefer Heiligenschein,
// große weiße Flügel mit dunkel-violetten Spitzen, in jeder Hand ein goldenes Schwert.
// Hitbox 60×60, Zeichnung ~150 breit und ~110 hoch. Schwebt (mit Wandkollision) und hält Abstand.
// Ablauf Phase 1: Schweben → Drehattacke → Schweben → Schwertwurf → …
// Phase 2: Drehung mit Wurf am Ende → (Schwerter kommen zurück) → Wurf → sofort Drehung → …
class BossSwordAngel extends Enemy {
    constructor(x, y) {
        super(x, y, 60, 60);
        this.hp = 100;
        this.maxHp = 100;
        this.speed = 34;
        this.damage = 1;
        // Kein Berührungsschaden: gefährlich sind die Schwerter. So kann man ihn im Schwindel gefahrlos hauen.
        this.contactDamage = false;
        this.isBoss = true;
        this.flying = true;
        this.fxColor = '#ffd23f';
        this.shadow = { rx: 38, ry: 11, dy: 30 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.face = -1;
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.moving = false;
        this.inHand = [true, true];     // Schwert links (0) / rechts (1) in der Hand?
        this.thrown = [null, null];      // fliegende Schwerter
        this.throwClock = 0;             // wie lange die Schwerter schon fliegen
        this.combo = false;              // Phase 2: Wurf am Ende der Drehung
        this.comboAfter = false;         // Phase 2: nach dem Fangen sofort drehen
        this.aim = [{ x: 0, y: 0, a: 0, tg: null }, { x: 0, y: 0, a: 0, tg: null }];
        this.aiming = false;             // Warnlinien sichtbar
        this.spinAngle = 0;
        this.spinRate = 0;
        this._h = { x: 0, y: 0 };
        this._pz = {};
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    hasSwords() {
        return this.inHand[0] && this.inHand[1];
    }

    // Ein Riese in Rüstung lässt sich kaum wegschubsen.
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.2);
    }

    // Hand in Weltkoordinaten (Abwurf- und Fangpunkt), liegt in this._h
    _hand(i) {
        this._h.x = this.centerX() + (i === 0 ? -26 : 26);
        this._h.y = this.y + this.h - 50;
        return this._h;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._checkSwords(dt);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const p2 = this.phase === 2;
        if (this.state === 'spin') this.spinRate = Math.min(p2 ? 19 : 14, this.spinRate + 40 * dt);
        else this.spinRate *= Math.exp(-5 * dt);
        this.spinAngle = (this.spinAngle + this.spinRate * dt) % TAU;

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._toHover();
                break;
            case 'hover':
                this._hover(dt, world, px, py, 1);
                if (this.stateT <= 0) this._nextAttack(world, player);
                break;
            case 'spinWind':
                if (this.stateT <= 0) this._set('spin', p2 ? 2.6 : 2.9);
                break;
            case 'spin':
                this._spinMove(dt, world, px, py);
                this._spinHits(player);
                if (this.combo && this.stateT <= SWORDANGEL_THROW_WARN) {
                    this._aimTargets(world, player, this.aiming && this.stateT <= SWORDANGEL_LOCK);
                    this.aiming = true;
                }
                if (this.stateT <= 0) {
                    if (this.combo) this._throw(projectiles, world);
                    this._set('dizzy', p2 ? 1.35 : 1.75);
                }
                break;
            case 'throwAim':
                this._aimTargets(world, player, this.stateT <= SWORDANGEL_LOCK);
                if (this.stateT <= 0) {
                    this._throw(projectiles, world);
                    this._set('waitSwords', 8);
                }
                break;
            case 'waitSwords':
                this._hover(dt, world, px, py, 0.45);
                if (this.hasSwords() || this.stateT <= 0) {
                    if (!this.hasSwords()) this._forceReturn();
                    if (this.comboAfter) {
                        this.comboAfter = false;
                        this._startSpin(false, 0.75);
                    } else {
                        this._set('recover', 0.45);
                    }
                }
                break;
            case 'dizzy':
                if (this.stateT <= 0) {
                    if (!this.hasSwords()) this._set('waitSwords', 8);
                    else this._toHover();
                }
                break;
            default:            // recover, roar
                if (this.stateT <= 0) this._toHover();
        }
        this._lookAt(dt, px, py);
    }

    _lookAt(dt, px, py) {
        let tx = px, ty = py;
        if (this.aiming) {
            tx = (this.aim[0].x + this.aim[1].x) / 2;
            ty = (this.aim[0].y + this.aim[1].y) / 2;
        }
        const dx = tx - this.centerX(), dy = ty - (this.y + this.h - 75);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
        if (Math.abs(dx) > 14 && this.state !== 'spin') this.face = dx > 0 ? 1 : -1;
    }

    _toHover() {
        this.aiming = false;
        if (this.phase === 2 && !this.roared && this.hasSwords()) {
            // Wut beim Wechsel in Phase 2: Schwerter blitzen auf (kein Angriff, nicht unverwundbar)
            this.roared = true;
            this._set('roar', 1.0);
            const x = this.centerX(), y = this.y + this.h - 80;
            AngelArt.shake(6, 0.45);
            AngelArt.burst(x, y, [ANGEL_GOLD, '#ffffff', '#c9a8ff'], 18, 190, 0.6, { kind: 'star' });
            AngelArt.ring(x, y + 30, ANGEL_GOLD, 100, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('hover', this.phase === 2 ? randRange(0.75, 1.05) : randRange(1.2, 1.6));
    }

    // Schwebt: näher heran, wenn Mark weit weg ist, zurück, wenn er zu nah ist, sonst seitwärts
    _hover(dt, world, px, py, k) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        let vx, vy, sp = this.speed * k;
        if (d > 175) {
            vx = dx / d; vy = dy / d;
        } else if (d < 110) {
            vx = -dx / d; vy = -dy / d;
        } else {
            vx = (-dy / d) * this.strafe; vy = (dx / d) * this.strafe; sp *= 0.7;
        }
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
        if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) this.strafe = -this.strafe;
        this.moving = true;
    }

    _nextAttack(world, player) {
        if (!this.hasSwords()) {
            this._set('waitSwords', 8);
            return;
        }
        const n = this.seq++;
        if (this.phase === 1) {
            if (n % 2 === 0) this._startSpin(false);
            else this._startThrow(world, player, false);
        } else {
            if (n % 2 === 0) this._startSpin(true);
            else this._startThrow(world, player, true);
        }
    }

    // ── a) Drehattacke ──

    _startSpin(combo, wind) {
        this.combo = combo;
        this.aiming = false;
        // Ankündigung in Boss-Zeit (÷1,15 = echte Zeit): 0,95 → 0,83 s, Phase 2 0,8 → 0,7 s
        this._set('spinWind', wind || (this.phase === 2 ? 0.8 : 0.95));
    }

    // Rutscht beim Drehen auf Mark zu (mit Wandkollision)
    _spinMove(dt, world, px, py) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d < 6) return;
        const sp = (this.phase === 2 ? 82 : 64) * Math.min(1, (this.stateDur - this.stateT) / 0.4 + 0.2);
        this._moveWithCollision((dx / d) * sp * dt, (dy / d) * sp * dt, world);
        this.moving = true;
    }

    // Wer im Schwertkreis steht, wird getroffen (Schutzzeit verhindert Mehrfachtreffer)
    _spinHits(player) {
        const cx = this.centerX(), cy = this.centerY();
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - cx, py - cy) < SWORDANGEL_SPIN_R + player.w / 2 - 4) {
                const before = player.hp;
                AngelArt.hurt(player, SWORDANGEL_DMG, Math.atan2(py - cy, px - cx), 260);
                if (player.hp < before) AngelArt.burst(px, py, [ANGEL_GOLD, '#ffffff'], 10, 150, 0.45, { kind: 'star' });
            }
        }
        for (const c of AngelArt.companions()) {
            if (c.iFrames > 0) continue;
            const x = c.x + c.w / 2, y = c.y + c.h / 2;
            if (Math.hypot(x - cx, y - cy) < SWORDANGEL_SPIN_R + Math.max(c.w, c.h) / 2 - 4) AngelArt.hitCompanion(c, SWORDANGEL_DMG);
        }
    }

    // ── b) Schwertwurf ──

    _startThrow(world, player, comboAfter) {
        this.comboAfter = comboAfter;
        this.aim[0].tg = this.aim[1].tg = null;   // Freund neu auswählen
        this.aiming = true;
        this._aimTargets(world, player, false);
        this._set('throwAim', this.phase === 2 ? 0.85 : 1.05);
    }

    // Ziel 0: Mark, Ziel 1: ein Freund (sonst Mark, etwas daneben). Die letzten 0,3 s steht alles fest.
    _aimTargets(world, player, locked) {
        if (locked) return;
        const mx = this.centerX(), my = this.centerY();
        let friend = this.aim[0].tg !== player ? this.aim[0].tg : this.aim[1].tg;
        if (!this.aiming || !friend || friend === player || friend.dead || friend.koTimer > 0) {
            friend = null;
            const opts = [];
            for (const c of AngelArt.companions()) {
                const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
                if (Math.hypot(cx - mx, cy - my) > 420) continue;
                if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my, cx, cy)) continue;
                opts.push(c);
            }
            if (opts.length) friend = opts[Math.floor(Math.random() * opts.length)];
        }
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        // die Hand auf der Seite des Freundes wirft auf den Freund (Warnlinien kreuzen sich nicht)
        const fi = friend && friend.x + friend.w / 2 < px ? 0 : 1;
        for (let i = 0; i < 2; i++) {
            const A = this.aim[i];
            let tx = px, ty = py;
            A.tg = player;
            if (i === fi && friend) {
                A.tg = friend;
                tx = friend.x + friend.w / 2;
                ty = friend.y + friend.h / 2;
            }
            const h = this._hand(i);
            let a = Math.atan2(ty - h.y, tx - h.x);
            // beide auf Mark: leicht gefächert, sie streifen links und rechts an ihm entlang
            if (!friend) a += i === 0 ? -0.12 : 0.12;
            // etwas über das Ziel hinaus, höchstens 330 weit, im Boss-Raum
            const d = clamp(Math.hypot(tx - h.x, ty - h.y) + 40, 90, 330);
            let ex = h.x + Math.cos(a) * d, ey = h.y + Math.sin(a) * d;
            const room = this._room(world);
            if (room) {
                ex = clamp(ex, room.x + 14, room.x + room.w - 14);
                ey = clamp(ey, room.y + 14, room.y + room.h - 14);
            }
            A.x = ex;
            A.y = ey;
            A.a = Math.atan2(ey - h.y, ex - h.x);
        }
    }

    _room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    _throw(projectiles, world) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        this.aiming = false;
        if (!this.hasSwords()) return;
        for (let i = 0; i < 2; i++) {
            const h = this._hand(i);
            const s = new AngelSword(this, i, h.x, h.y, this.aim[i].x, this.aim[i].y);
            this.thrown[i] = s;
            this.inHand[i] = false;
            if (list) list.push(s);
            else { s.dead = true; this.inHand[i] = true; this.thrown[i] = null; }
        }
        this.throwClock = 0;
        AngelArt.burst(this.centerX(), this.y + this.h - 50, [ANGEL_GOLD, '#ffffff'], 10, 160, 0.35, { kind: 'spark' });
        AngelArt.shake(3, 0.15);
    }

    _catchSword(s) {
        const i = s.idx;
        if (this.thrown[i] === s) this.thrown[i] = null;
        this.inHand[i] = true;
        const h = this._hand(i);
        AngelArt.burst(h.x, h.y, [ANGEL_GOLD, '#ffffff'], 6, 90, 0.3, { kind: 'spark' });
    }

    // Sicherheitsnetz: Schwerter verschwinden nie dauerhaft. Wird ein fliegendes Schwert von außen entfernt
    // (z. B. aus der Geschoss-Liste geräumt) oder fliegt es zu lange, ist es sofort wieder in der Hand.
    _checkSwords(dt) {
        if (this.hasSwords()) return;
        this.throwClock += dt;
        let lost = this.throwClock > 7;
        for (let i = 0; i < 2; i++) {
            const s = this.thrown[i];
            if (this.inHand[i]) continue;
            if (!s || (s.dead && !s.caught)) lost = true;
            if (typeof Game !== 'undefined' && Game.projectiles && s && !s.dead && Game.projectiles.indexOf(s) < 0 && this.throwClock > 0.3) lost = true;
        }
        if (lost) this._forceReturn();
    }

    _forceReturn() {
        for (let i = 0; i < 2; i++) {
            const s = this.thrown[i];
            if (s) s.dead = true;
            this.thrown[i] = null;
            if (!this.inHand[i]) {
                this.inHand[i] = true;
                const h = this._hand(i);
                AngelArt.burst(h.x, h.y, [ANGEL_GOLD, '#ffffff'], 6, 90, 0.3, { kind: 'spark' });
            }
        }
    }

    // ── Zeichnen ──

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, by - 50);
            ctx.translate(cx, by);
            this._drawAngel(ctx, true);
        } else {
            ctx.translate(cx, by);
            this._drawAngel(ctx, false);
        }
        ctx.restore();
    }

    // Haltung aus dem Zustand (nur Darstellung): Hände, Schwertwinkel, Neigung, Leuchten
    _pose(p, dead) {
        const st = dead ? 'dead' : this.state, t = Art.time, f = this.face;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const p2 = this.phase === 2;
        p.hv = -12 + Math.sin(t * (p2 ? 2.8 : 2.1) + this.seed) * 3;
        p.flap = Math.sin(t * (p2 ? 5 : 3.6) + this.seed) * 0.16;
        p.tilt = 0;
        p.spin = false;
        p.behind = false;
        p.mouth = 'angry';
        p.dizzy = false;
        p.bright = p2 ? 0.85 : 0.2;
        const sw = Math.sin(t * 2 + this.seed) * 0.08;
        // Grundhaltung: Schwerter schräg nach unten-außen
        p.l = { x: -27, y: -42, a: Math.PI - 1.05 + sw };
        p.r = { x: 27, y: -42, a: 1.05 - sw };
        if (st === 'intro') {
            // hält beide Schwerter zum V nach oben gespreizt
            const v = Math.sin(t * 3) * 0.06;
            p.l = { x: -16, y: -46, a: Math.PI + 0.7 + v };
            p.r = { x: 16, y: -46, a: -0.7 - v };
            p.mouth = 'teeth';
        } else if (st === 'spinWind') {
            // hebt die Schwerter hoch über den Kopf, Flügel weit auf
            const e = Math.min(1, k * 2.2);
            p.l = { x: -20 - e * 4, y: -48 - e * 38, a: Math.PI + 1.0 + e * 0.2 };
            p.r = { x: 20 + e * 4, y: -48 - e * 38, a: -1.0 - e * 0.2 };
            p.hv += e * 4;
            p.flap = -0.3 * e + Math.sin(t * 18) * 0.05 * e;
            p.bright = Math.max(p.bright, 0.4 + 0.6 * k);
            p.mouth = 'teeth';
        } else if (st === 'spin') {
            p.spin = true;
            p.flap = -0.45;
            p.tilt = Math.sin(t * 13) * 0.05;
            p.mouth = 'grin';
        } else if (st === 'throwAim') {
            // holt mit beiden Schwertern hinter dem Kopf aus
            const e = Math.min(1, k * 2);
            p.l = { x: -16, y: -60 - e * 22, a: Math.PI + 1.25 + e * 0.6 };
            p.r = { x: 16, y: -60 - e * 22, a: -1.25 - e * 0.6 };
            p.behind = true;
            p.tilt = -f * 0.05 * e;
            p.bright = Math.max(p.bright, 0.3 + 0.5 * k);
            p.mouth = 'teeth';
        } else if (st === 'dizzy') {
            p.dizzy = true;
            p.tilt = Math.sin(t * 6) * 0.09;
            p.flap = 0.25;
            p.hv += 5;
            p.mouth = 'o';
            p.l = { x: -24, y: -36, a: Math.PI - 1.4 };
            p.r = { x: 24, y: -36, a: 1.4 };
        } else if (st === 'roar') {
            const e = Math.sin(k * Math.PI);
            p.l = { x: -22, y: -88, a: -1.2 };
            p.r = { x: 22, y: -88, a: Math.PI + 1.2 };
            p.flap = -0.35 * e + Math.sin(t * 14) * 0.08;
            p.bright = 1;
            p.mouth = 'open';
        } else if (st === 'dead') {
            p.flap = 0.35;
            p.mouth = 'o';
        }
        // ohne Schwerter: offene Hände nach vorn (ärgerlich), außer beim Drehen
        p.lHas = this.inHand[0];
        p.rHas = this.inHand[1];
        if (!p.lHas && !p.spin && st !== 'dizzy') p.l = { x: -25, y: -48 + Math.sin(t * 5) * 1.5, a: Math.PI - 0.4 };
        if (!p.rHas && !p.spin && st !== 'dizzy') p.r = { x: 25, y: -48 + Math.sin(t * 5 + 1) * 1.5, a: 0.4 };
        return p;
    }

    _drawAngel(ctx, dead) {
        const p = this._pose(this._pz, dead);
        const t = Art.time, f = this.face, p2 = this.phase === 2;
        ctx.save();
        ctx.translate(0, p.hv);
        if (p.tilt) {
            ctx.translate(0, -40);
            ctx.rotate(p.tilt);
            ctx.translate(0, 40);
        }
        // Phase 2: goldene Aura
        if (p2 && !dead) Art.glow(ctx, 0, -55, 70, '#ffe066', 0.22 + 0.08 * Math.sin(t * 4));
        // große Flügel
        for (let s = -1; s <= 1; s += 2) {
            ctx.save();
            ctx.translate(s * 9, -60);
            ctx.rotate(s * p.flap);
            AngelArt.wing(ctx, s, 2.9, 2.2);
            ctx.restore();
        }
        // Drehattacke: Wirbelscheibe hinter dem Körper
        if (p.spin) this._whirl(ctx, t, true);
        // Schwerter/Arme hinten (Drehung: Rückseite; Ausholen: hinter dem Kopf)
        if (p.spin) this._spinArms(ctx, p, false);
        else if (p.behind) this._arms(ctx, p);
        // Gewand (Rock) mit Wellensaum
        const sway = Math.sin(t * 2.2 + this.seed) * 2;
        Art.shape(ctx, c => {
            c.moveTo(-13, -36);
            c.lineTo(13, -36);
            c.quadraticCurveTo(20, -20, 22 + sway, -6);
            c.quadraticCurveTo(15, -1, 10, -5);
            c.quadraticCurveTo(5, 0, 0, -5);
            c.quadraticCurveTo(-5, 0, -10, -5);
            c.quadraticCurveTo(-15, -1, -22 + sway, -6);
            c.quadraticCurveTo(-20, -20, -13, -36);
            c.closePath();
        }, { x: -22, y: -36, w: 44, h: 34 }, SWORDANGEL_TUNIC, { lineWidth: 2 });
        // Rüstungsschurz (Platten)
        ctx.fillStyle = Art.light(SWORDANGEL_ARMOR, 0.15);
        ctx.strokeStyle = Art.ink(SWORDANGEL_ARMOR);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) ctx.roundRect(i * 8.6 - 4, -36, 8, 14, 2.5);
        ctx.fill();
        ctx.stroke();
        // Brustpanzer
        Art.shape(ctx, c => {
            c.moveTo(-17, -63);
            c.quadraticCurveTo(0, -68, 17, -63);
            c.quadraticCurveTo(18, -46, 13, -36);
            c.lineTo(-13, -36);
            c.quadraticCurveTo(-18, -46, -17, -63);
            c.closePath();
        }, { x: -17, y: -66, w: 34, h: 30 }, SWORDANGEL_ARMOR, { lineWidth: 2.2, glossy: true });
        // goldene Kante und Wappen (kleiner Flügel)
        ctx.strokeStyle = ANGEL_GOLD;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, -61.5);
        ctx.quadraticCurveTo(0, -66, 15, -61.5);
        ctx.moveTo(-12.5, -38.5);
        ctx.lineTo(12.5, -38.5);
        ctx.stroke();
        Art.star(ctx, 0, -50, 6, ANGEL_GOLD, { lineWidth: 1.3, outline: ANGEL_GOLD_INK });
        if (p2 && !dead) {
            // Risse in der Rüstung
            ctx.strokeStyle = '#2a1a5a';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(-12, -58);
            ctx.lineTo(-8, -53);
            ctx.lineTo(-10, -48);
            ctx.moveTo(10, -44);
            ctx.lineTo(7, -40);
            ctx.stroke();
        }
        // Schulterplatten
        Art.body(ctx, -18, -61, 8.5, 6, ANGEL_GOLD, { lineWidth: 1.8, outline: ANGEL_GOLD_INK });
        Art.body(ctx, 18, -61, 8.5, 6, ANGEL_GOLD, { lineWidth: 1.8, outline: ANGEL_GOLD_INK });
        // Kopf
        const hx = f * 1.5, hy = -79;
        Art.body(ctx, hx, hy, 13, 12, ANGEL_SKIN, { lineWidth: 2 });
        // Helm mit Flügelchen
        Art.shape(ctx, c => {
            c.moveTo(hx - 14, hy - 1);
            c.quadraticCurveTo(hx - 14, hy - 17, hx, hy - 17);
            c.quadraticCurveTo(hx + 14, hy - 17, hx + 14, hy - 1);
            c.lineTo(hx + 11, hy - 4);
            c.lineTo(hx - 11, hy - 4);
            c.closePath();
        }, { x: hx - 14, y: hy - 17, w: 28, h: 16 }, SWORDANGEL_ARMOR, { lineWidth: 2, glossy: true });
        ctx.fillStyle = ANGEL_GOLD;
        ctx.fillRect(hx - 12.5, hy - 6.5, 25, 2.4);
        for (let s = -1; s <= 1; s += 2) {
            ctx.save();
            ctx.translate(hx + s * 13, hy - 9);
            ctx.rotate(s * (0.15 + p.flap * 0.5));
            AngelArt.wing(ctx, s, 0.42, 1);
            ctx.restore();
        }
        // Gesicht
        if (dead) LateWorldArt.xEyes(ctx, hx + f * 1.2, hy + 1, 2.4, 5);
        else if (p.dizzy) {
            // Spiralaugen
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            for (let s = -1; s <= 1; s += 2) {
                const ex = hx + f * 1.2 + s * 5, ey = hy + 1;
                for (let j = 0; j <= 10; j++) {
                    const a = j * 0.9 + t * 8 * s, r = j * 0.32;
                    if (j === 0) ctx.moveTo(ex, ey);
                    else ctx.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
                }
            }
            ctx.stroke();
        } else {
            Art.eyes(ctx, hx + f * 1.2, hy + 1, 3.8, { gap: 5, look: this.look, angry: true, iris: p2 ? '#ff2d4a' : '#7a2fd0', seed: this.seed });
        }
        Art.mouth(ctx, hx + f * 1.2, hy + 7.5, 7, p.mouth);
        // schiefer Heiligenschein (Phase 2 flackert er)
        const hcol = p2 && !dead && Math.sin(t * 11) > 0.6 ? '#ffffff' : ANGEL_GOLD;
        AngelArt.halo(ctx, hx + f * 4, hy - 24 + Math.sin(t * 2 + this.seed) * 1.2, 14, -f * 0.5, 2.6, hcol);
        // Arme und Schwerter vorn
        if (p.spin) {
            this._spinArms(ctx, p, true);
            this._whirl(ctx, t, false);
        } else if (!p.behind) this._arms(ctx, p);
        if (p.dizzy) LateWorldArt.dizzy(ctx, hx, hy - 20, 18, 4);
        ctx.restore();
    }

    // Arme mit Schwertern (oder leeren Händen) in normaler Haltung
    _arms(ctx, p) {
        for (let i = 0; i < 2; i++) {
            const H = i === 0 ? p.l : p.r, s = i === 0 ? -1 : 1, has = i === 0 ? p.lHas : p.rHas;
            Art.limb(ctx, s * 18, -58, H.x, H.y, 6.5, SWORDANGEL_ARMOR, { lineWidth: 1.8 });
            if (has) {
                ctx.save();
                ctx.translate(H.x, H.y);
                ctx.rotate(H.a);
                AngelArt.sword(ctx, SWORDANGEL_LEN, p.bright);
                ctx.restore();
            }
            Art.body(ctx, H.x, H.y, 4.4, 4.4, ANGEL_GOLD, { lineWidth: 1.6, outline: ANGEL_GOLD_INK, highlight: false });
        }
    }

    // Drehattacke: Arme ausgestreckt, Schwerter kreisen um den Körper (Ellipse wegen der Draufsicht).
    // front = nur die vorderen (unteren) Schwerter, sonst die hinteren.
    _spinArms(ctx, p, front) {
        const R = 30, cy = -44;
        for (let i = 0; i < 2; i++) {
            const a = this.spinAngle + i * Math.PI;
            const ca = Math.cos(a), sa = Math.sin(a);
            if ((sa >= 0) !== front) continue;
            const hx = ca * R, hy = cy + sa * R * 0.4;
            const sx = 18 * (ca >= 0 ? 1 : -1);
            Art.limb(ctx, sx * Math.min(1, Math.abs(ca) + 0.3), -58, hx, hy, 6.5, SWORDANGEL_ARMOR, { lineWidth: 1.8 });
            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(Math.atan2(sa * 0.4, ca));
            ctx.scale(Math.max(0.35, Math.hypot(ca, sa * 0.4)), 1);
            AngelArt.sword(ctx, SWORDANGEL_LEN, p.bright);
            ctx.restore();
            Art.body(ctx, hx, hy, 4.4, 4.4, ANGEL_GOLD, { lineWidth: 1.6, outline: ANGEL_GOLD_INK, highlight: false });
        }
    }

    // Goldene Wirbelscheibe der Drehattacke (hintere bzw. vordere Hälfte)
    _whirl(ctx, t, back) {
        const prev = ctx.globalAlpha;
        const R = SWORDANGEL_SPIN_R + 6;
        ctx.strokeStyle = this.phase === 2 ? '#fff6c4' : '#ffe066';
        ctx.lineCap = 'round';
        // Schwertspitzen ziehen goldene Bögen hinter sich her (je Schwert ein Bogen pro Bahn)
        for (let i = 0; i < 2; i++) {
            const a1 = this.spinAngle + i * Math.PI;
            if (!back && Math.sin(a1) < 0.2) continue;
            for (let j = 0; j < 3; j++) {
                const rr = R - j * 10;
                ctx.globalAlpha = prev * (0.75 - 0.2 * j);
                ctx.lineWidth = 5 - j * 1.4;
                ctx.beginPath();
                ctx.ellipse(0, -44, rr, rr * 0.4, 0, a1 - (back ? 1.9 : 0.9), a1);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = prev;
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        const c = camera.worldToScreen(this.centerX(), this.centerY());
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        if (this.state === 'spinWind') {
            LateWorldArt.warn(ctx, c.x, c.y, SWORDANGEL_SPIN_R, k);
        } else if (this.state === 'spin') {
            // Gefahrenkreis während der Drehung
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.14;
            ctx.fillStyle = '#ff3d5a';
            ctx.beginPath();
            ctx.arc(c.x, c.y, SWORDANGEL_SPIN_R, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = prev;
            Art.ring(ctx, c.x, c.y, SWORDANGEL_SPIN_R, '#ff3d5a', 2.2, 0.55 + 0.35 * Math.abs(Math.sin(Art.time * 12)));
        }
        if (this.aiming) {
            const lk = this.state === 'spin'
                ? clamp(1 - this.stateT / SWORDANGEL_THROW_WARN, 0, 1) : k;
            const locked = this.stateT <= SWORDANGEL_LOCK;
            ctx.save();
            for (let i = 0; i < 2; i++) {
                const A = this.aim[i];
                const h = this._hand(i);
                const hs = camera.worldToScreen(h.x, h.y);
                const len = Math.hypot(A.x - h.x, A.y - h.y);
                LateWorldArt.lane(ctx, hs.x, hs.y, A.a, len, 22, lk, locked ? '#ff3d5a' : '#ff7a3d');
                // Pfeil über dem Ziel (Mark oder ein Freund)
                const tg = A.tg;
                if (tg && !tg.dead && !(tg.koTimer > 0) && (i === 0 || tg !== this.aim[0].tg)) {
                    const ap = camera.worldToScreen(tg.x + tg.w / 2, tg.y - 14 + Math.sin(Art.time * 9) * 2.5);
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = '#ff3d5a';
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.4;
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(ap.x - 5.5, ap.y - 6.5);
                    ctx.lineTo(ap.x + 5.5, ap.y - 6.5);
                    ctx.lineTo(ap.x, ap.y + 1);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
            ctx.restore();
        }
    }
}
