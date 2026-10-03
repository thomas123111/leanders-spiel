// ── Welt 25: Vollmondwald ──
// Werwölfe (Wunsch von Leander): zottige grau-braune Wölfe auf zwei Beinen mit leuchtend ROTEN Augen
// und zerrissenen bunten Hosen. Sie schleichen auf Mark zu, ducken sich kurz (rote Sprungbahn am Boden,
// ~0,5 s) und springen ihn dann an.
// Riesen-Werwolf (Boss): heult den Mond an.
//   Pfotenschlag: richtet sich auf, hebt beide Pfoten (≈1 s, roter Warnkreis am Boden), schlägt auf den
//                 Boden → Schockwelle als wachsender Ring. Wer getroffen wird: 1 Schaden und 5 s betäubt
//                 (Mark über player.stun, Juri/Krokodil über ihr stun). Ausweichen über den Ring rettet.
//                 Erst wenn Marks Betäubung vorbei ist (+1,5 s), schlägt er wieder mit den Pfoten.
//   Sprung-Satz:  duckt sich (rote Bahn), springt auf Mark zu, verschnauft danach (Zeit zum Zurückhauen).
//   Krallenhieb:  holt aus (roter Fächer vor ihm), wischt mit der Pranke.
// Phase 2 (halbe Lebenspunkte): Heulen, glühendere Augen, zwei Schockwellen kurz nacheinander, größerer Ring.

const WOLF_FURS = ['#b89c84', '#a99a92', '#c2a68c', '#a296ac', '#b6a294'];   // grau-braun, leicht bunt
const WOLF_PANTS = ['#7a5cff', '#4d8bff', '#ff5d73', '#2fc4a0', '#ff9f1c'];
const WOLF_EYE = '#ff3b30';
const WOLF_GLOW = '#ff2a2a';
const WOLF_CREAM = '#f3e4cc';
const WOLF_CROUCH = 0.5;     // Ducken vor dem Sprung (Sekunden)
const WOLF_LEAP = 0.4;       // Sprungdauer
const WOLF_STUN = 5;         // Betäubung durch die Schockwelle (Sekunden, alle Schwierigkeiten)
const WOLF_SLAM_GRACE = 1.5; // Schonzeit nach Marks Betäubung bis zum nächsten Pfotenschlag

const WolfArt = {
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

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

    // Rote Leuchtaugen: Leuchten dahinter, rote Augäpfel mit dunkler Schlitzpupille, böse Brauen.
    eyes(ctx, x, y, r, gap, look, glow, seed, browColor) {
        Art.glow(ctx, x, y, r * 3.4 + glow * r * 2, WOLF_GLOW, 0.45 + glow * 0.45);
        Art.eyes(ctx, x, y, r, {
            gap, look, angry: true, seed, sclera: WOLF_EYE, pupil: '#2a0006', irisSize: 0.5,
            lid: '#4a0a10', brow: browColor,
        });
    },

    // Spitzes Ohr (Dreieck) mit rosa Innenseite; (x, y) = Ohrwurzel, s = Größe, lean = Neigung.
    ear(ctx, x, y, s, lean, fur) {
        const tx = x + lean * s, ty = y - s * 1.25;
        Art.shape(ctx, c => {
            c.moveTo(x - s * 0.55, y);
            c.lineTo(tx, ty);
            c.lineTo(x + s * 0.55, y);
            c.closePath();
        }, { x: x - s * 0.55, y: ty, w: s * 1.1, h: s * 1.25 }, fur, { lineWidth: Math.max(1, s * 0.16), highlight: false });
        ctx.fillStyle = '#ff9fb4';
        ctx.beginPath();
        ctx.moveTo(x - s * 0.28, y - s * 0.08);
        ctx.lineTo(tx * 0.8 + x * 0.2, ty * 0.8 + y * 0.2);
        ctx.lineTo(x + s * 0.28, y - s * 0.08);
        ctx.closePath();
        ctx.fill();
    },

    // Zottiger Fellkranz (Zickzack-Ellipse) um (x, y)
    mane(ctx, x, y, rx, ry, n, fur, lw) {
        Art.shape(ctx, c => {
            for (let i = 0; i <= n * 2; i++) {
                const a = (i / (n * 2)) * TAU;
                const rr = i % 2 === 0 ? 1.18 : 0.92;
                const px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr;
                if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
            }
            c.closePath();
        }, { x: x - rx, y: y - ry, w: rx * 2, h: ry * 2 }, fur, { lineWidth: lw });
    },
};

// ══════════════════════════════════════════
// ── Werwolf ──
// ══════════════════════════════════════════

// Grau-brauner Wolf auf zwei Beinen, zottig, mit buschigem Schwanz, zerrissener bunter Hose und
// leuchtend roten Augen. Zustände: wander → stalk (schleicht heran) → crouch (duckt sich, Bahn am Boden)
// → leap (Sprung mit Kontaktschaden) → land (verschnauft) → stalk …
class Werewolf extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 26);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(44, 54);      // schleicht (Mark läuft ~150)
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 240;
        this.seed = Math.random() * 10;
        this.fur = WolfArt.pick(WOLF_FURS);
        this.furDark = Art.dark(this.fur, 0.16);
        this.pants = WolfArt.pick(WOLF_PANTS);
        this.fxColor = this.fur;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.lookDir = { x: 0, y: 0.3 };
        this.state = 'wander';
        this.stateT = 0;
        this.engaged = false;
        this.moving = false;
        this.t = Math.random() * 10;
        this.walkT = Math.random() * 3;
        this.wanderT = randRange(0.3, 2);
        this.wx = 0;
        this.wy = 0;
        this.leapCD = randRange(0.6, 1.6);  // bis zum nächsten Sprung
        this.leapA = 0;
        this.leapV = 0;
        this.leapLen = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 60) this.engaged = false;
        this.moving = false;

        if (this.state === 'crouch') {
            // duckt sich: zielt mit, die letzten 0,2 s steht die Richtung fest (fair zum Ausweichen)
            this.stateT -= dt;
            if (this.stateT > 0.2) {
                this.leapA = Math.atan2(dy, dx);
                this.leapLen = clamp(dist + 26, 70, 150);
                if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
            }
            this._look(Math.cos(this.leapA), Math.sin(this.leapA), dt);
            if (this.stateT <= 0) {
                this.state = 'leap';
                this.stateT = WOLF_LEAP;
                this.leapV = this.leapLen / WOLF_LEAP;
                WolfArt.burst(mx, this.y + this.h, ['#cfd8e8', '#8aa0b8'], 5, 70, 0.35, { kind: 'smoke', size: 3 });
            }
            return;
        }
        if (this.state === 'leap') {
            this.stateT -= dt;
            this._moveWithCollision(Math.cos(this.leapA) * this.leapV * dt, Math.sin(this.leapA) * this.leapV * dt, world);
            if (this.stateT <= 0) {
                this.state = 'land';
                this.stateT = 0.5;
                this.leapCD = randRange(1.4, 2.3);
                WolfArt.burst(this.centerX(), this.y + this.h, ['#cfd8e8', '#8aa0b8', '#ffffff'], 6, 80, 0.4, { kind: 'smoke', size: 3 });
            }
            return;
        }
        if (this.state === 'land') {
            // verschnauft nach dem Sprung (Zeit zum Zurückhauen)
            this.stateT -= dt;
            if (this.stateT <= 0) this.state = this.engaged ? 'stalk' : 'wander';
            return;
        }

        this.state = this.engaged ? 'stalk' : 'wander';
        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            this.leapCD -= dt;
            if (this.leapCD <= 0 && dist < 135 &&
                (typeof Juri === 'undefined' || Juri.lineClear(world, mx, my, px, py))) {
                this.state = 'crouch';
                this.stateT = WOLF_CROUCH;
                this.leapA = Math.atan2(dy, dx);
                this.leapLen = clamp(dist + 26, 70, 150);
                return;
            }
            // schleicht heran, hält kurz vor Mark etwas Abstand zum Anspringen
            if (dist > 70) { vx = dx / dist; vy = dy / dist; sp = this.speed; }
            else { vx = -dy / dist; vy = dx / dist; sp = this.speed * 0.4; }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.3, 3);
                if (Math.random() < 0.35) { this.wx = 0; this.wy = 0; }
                else {
                    const a = Math.random() * TAU;
                    this.wx = Math.cos(a);
                    this.wy = Math.sin(a);
                }
            }
            vx = this.wx; vy = this.wy; sp = this.speed * 0.5;
        }
        this.moving = sp > 0 && (vx !== 0 || vy !== 0);
        if (this.moving) {
            this.walkT += dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
            if (!this.engaged && Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) this.wanderT = 0;
        }
        if (this.engaged) {
            if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
            this._look(dx / dist, dy / dist, dt);
        } else {
            if (Math.abs(vx) > 0.2) this.face = vx > 0 ? 1 : -1;
            this._look(vx * 0.6, vy * 0.6 + 0.2, dt);
        }
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.lookDir.x += (nx - this.lookDir.x) * k;
        this.lookDir.y += (ny - this.lookDir.y) * k;
    }

    // Rote Sprungbahn am Boden während des Duckens
    drawUnder(ctx, camera) {
        if (this.dead || this.state !== 'crouch') return;
        const p = camera.worldToScreen(this.centerX(), this.y + this.h - 4);
        const k = clamp(1 - this.stateT / WOLF_CROUCH, 0, 1);
        LateWorldArt.lane(ctx, p.x, p.y, this.leapA, this.leapLen + 12, 18, k);
    }

    // Für eine spätere Engine-Ebene über der Nacht-Abdunklung: nur die leuchtenden Augen.
    drawOverLight(ctx, camera) {
        if (this.dead) return;
        const pos = camera.worldToScreen(this.x + this.w / 2, this.y + this.h);
        const e = this._eyePos();
        const a = 0.35 + 0.15 * Math.sin(Art.time * 3 + this.seed) + (this.state === 'crouch' ? 0.35 : 0);
        Art.glow(ctx, pos.x + e.x, pos.y + e.y, 9, WOLF_GLOW, a);
    }

    // Augenmitte relativ zum Fußpunkt (nur Darstellung, grob)
    _eyePos() {
        const lift = this.state === 'leap' ? Math.sin((1 - this.stateT / WOLF_LEAP) * Math.PI) * 12 : 0;
        const low = this.state === 'crouch' ? 5 : 0;
        return { x: this.face * 4, y: -34 + low - lift };
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 14)) {
                ctx.translate(cx, by);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, by);
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 22);
    }

    // Wolf mit Füßen bei (0, 0), Blick in Richtung face.
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed, fur = this.fur, fd = this.furDark;
        const st = dead ? 'dead' : this.state;
        let lift = 0, sx = 1, sy = 1, lean = 0, step = 0, glow = 0;
        if (st === 'crouch') {
            const k = clamp(1 - this.stateT / WOLF_CROUCH, 0, 1);
            sx = 1 + 0.12 * k;
            sy = 1 - 0.18 * k;
            lean = f * 0.22 * k;
            glow = k;
        } else if (st === 'leap') {
            const q = clamp(1 - this.stateT / WOLF_LEAP, 0, 1);
            lift = Math.sin(q * Math.PI) * 12;
            sx = 0.9;
            sy = 1.1;
            lean = f * 0.4;
            glow = 1;
        } else if (st === 'land') {
            const q = clamp(this.stateT / 0.5, 0, 1);
            sx = 1 + 0.1 * q;
            sy = 1 - 0.1 * q;
        } else if (this.moving) {
            step = Math.sin(this.walkT * 9 + sd);
            lean = f * 0.1;
            lift = Math.abs(step) * 1.2;
        } else {
            const b = Math.sin(t * 2.4 + sd) * 0.025;
            sx = 1 + b;
            sy = 1 - b;
        }
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -16, 26, '#ffd23f', 0.42 + 0.12 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(0, -lift);
        ctx.scale(sx, sy);
        ctx.rotate(lean);
        // buschiger Schwanz (wedelt)
        const wag = Math.sin(t * 5 + sd) * 2.2;
        Art.shape(ctx, c => {
            c.moveTo(-f * 5, -12);
            c.quadraticCurveTo(-f * 15, -12 + wag * 0.4, -f * 17, -23 + wag);
            c.quadraticCurveTo(-f * 12, -18, -f * 6, -16);
            c.closePath();
        }, { x: -17, y: -23, w: 12, h: 11 }, fur, { lineWidth: 1.2, highlight: false });
        // Beine: hinten dunkler, beim Schleichen im Wechselschritt
        const leg = st === 'leap' ? 3 : step * 3;
        Art.limb(ctx, -f * 2, -12, -f * 3 - leg, -1.5, 4.6, fd, { lineWidth: 1.1 });
        Art.limb(ctx, f * 2.5, -12, f * 3.5 + leg, -1.5, 4.6, fur, { lineWidth: 1.1 });
        // zerrissene Hose
        Art.shape(ctx, c => {
            c.moveTo(-7.5, -17);
            c.lineTo(7.5, -17);
            c.lineTo(7.5, -11);
            c.lineTo(5, -9.5);
            c.lineTo(3, -11.5);
            c.lineTo(0.5, -9);
            c.lineTo(-2.5, -11.5);
            c.lineTo(-5, -9.5);
            c.lineTo(-7.5, -11);
            c.closePath();
        }, { x: -7.5, y: -17, w: 15, h: 8 }, this.pants, { lineWidth: 1.1, highlight: false });
        // Rumpf mit heller, zottiger Brust
        Art.body(ctx, f * 0.5, -21.5, 8.8, 7.8, fur, { lineWidth: 1.4 });
        ctx.fillStyle = WOLF_CREAM;
        ctx.beginPath();
        ctx.moveTo(f * 1, -27);
        ctx.lineTo(f * 6, -24);
        ctx.lineTo(f * 4.5, -21);
        ctx.lineTo(f * 6, -18.5);
        ctx.lineTo(f * 2, -16.5);
        ctx.lineTo(f * 2.5, -20);
        ctx.closePath();
        ctx.fill();
        // hinterer Arm
        const reach = st === 'leap' ? 1 : st === 'crouch' ? 0.6 : 0;
        Art.limb(ctx, -f * 3.5, -24, -f * 5 + f * reach * 9, -16 - reach * 4 + step * 1.2, 3.4, fd, { lineWidth: 1 });
        // Kopf mit zottigem Halskragen
        const hx = f * 2.5, hy = -32;
        WolfArt.mane(ctx, hx - f * 1.5, hy + 4.5, 7.5, 4.2, 6, fur, 1.2);
        WolfArt.ear(ctx, hx - f * 3.6, hy - 4.5, 4.4, -f * 0.25, fur);
        WolfArt.ear(ctx, hx + f * 2.6, hy - 5, 4.4, f * 0.2, fur);
        Art.body(ctx, hx, hy, 7.2, 6.6, fur, { lineWidth: 1.4 });
        // Wangenzotteln
        ctx.fillStyle = fur;
        ctx.beginPath();
        ctx.moveTo(hx - f * 6.5, hy + 1);
        ctx.lineTo(hx - f * 9.2, hy + 3.8);
        ctx.lineTo(hx - f * 5.8, hy + 3.4);
        ctx.lineTo(hx - f * 6.6, hy + 6);
        ctx.lineTo(hx - f * 3.5, hy + 4.5);
        ctx.closePath();
        ctx.fill();
        // Schnauze mit Nase
        const snx = hx + f * 6.2, sny = hy + 2;
        Art.body(ctx, snx, sny, 4.6, 3.2, WOLF_CREAM, { lineWidth: 1.1, highlight: false });
        ctx.fillStyle = '#2a1a2e';
        ctx.beginPath();
        ctx.ellipse(snx + f * 3.8, sny - 1.4, 1.5, 1.1, 0, 0, TAU);
        ctx.fill();
        // Augen
        if (dead) {
            LateWorldArt.xEyes(ctx, hx + f * 1.2, hy - 1.8, 1.5, 2.8);
        } else {
            WolfArt.eyes(ctx, hx + f * 1.2, hy - 1.8, 2.1, 2.8, this.lookDir, glow, sd, Art.ink(fur));
        }
        // Maul: frecher Reißzahn, beim Ducken/Springen offen mit Zähnen
        if (!dead && (st === 'crouch' || st === 'leap')) {
            Art.mouth(ctx, snx + f * 0.8, sny + 2.4, 5.4, 'teeth');
        } else {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 0.9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(snx - f * 2.5, sny + 2.4);
            ctx.quadraticCurveTo(snx + f * 0.5, sny + 3.6, snx + f * 3, sny + 2);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(snx + f * 0.4, sny + 2.9);
            ctx.lineTo(snx + f * 1.6, sny + 2.7);
            ctx.lineTo(snx + f * 1.1, sny + 4.8);
            ctx.closePath();
            ctx.fill();
        }
        // vorderer Arm mit Krallen
        const ax = f * 4 + f * reach * 9, ay = -16 - reach * 5 - step * 1.2;
        Art.limb(ctx, f * 3.5, -24, ax, ay, 3.6, fur, { lineWidth: 1 });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            ctx.moveTo(ax + f * 1.4, ay + i * 1.3 - 0.5);
            ctx.lineTo(ax + f * 3.4, ay + i * 1.5);
            ctx.lineTo(ax + f * 1.4, ay + i * 1.3 + 0.5);
        }
        ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 25: Riesen-Werwolf ──
// ══════════════════════════════════════════

// Riesiger, zottiger Werwolf mit mächtiger Mähne, zerrissener lila Hose, großen Pranken und leuchtend
// roten Augen. Hitbox 72×62, Zeichnung ~135 hoch.
// Ablauf: Heulen (Intro) → Laufen → Angriff (Pfotenschlag, Sprung-Satz, Krallenhieb, …) → Laufen …
class BossGiantWerewolf extends Enemy {
    constructor(x, y) {
        super(x, y, 72, 62);
        this.hp = 105;
        this.maxHp = 105;
        this.speed = 36;
        this.damage = 1;
        this.contactDamage = true;
        this.isBoss = true;
        this.fur = '#b29a86';
        this.furDark = Art.dark(this.fur, 0.18);
        this.pants = '#8a5cff';
        this.fxColor = this.fur;
        this.shadow = { rx: 40, ry: 12 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.face = -1;
        this.phase = 1;
        this.howled2 = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.state = 'howl';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.freeT = 99;          // echte Sekunden, seit Mark nicht mehr betäubt ist
        this.impX = 0;            // Aufschlagpunkt des Pfotenschlags
        this.impY = 0;
        this.waves = [];          // laufende Schockwellen
        this.slams = 0;           // Zähler (zum Prüfen)
        this.stuns = 0;
        this.leapA = 0;
        this.leapLen = 0;
        this.leapV = 0;
        this.clawHit = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() {
        return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
    }

    _waveMax() {
        return this.phase === 2 ? 205 : 170;
    }

    // Ein Riese lässt sich kaum wegschubsen.
    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.25);
        if (this.dead && !was) this.waves.length = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        // Marks Betäubung läuft in echter Zeit, der Boss evtl. schneller (tempo) → echte Zeit messen
        const realDt = dt / (this.tempo || 1);
        if (player && player.stunTimer > 0) this.freeT = 0;
        else this.freeT += realDt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._updateWaves(dt, player);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - this.centerX(), dy = py - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this._lookAt(dx, dy + 50, dt);

        switch (this.state) {
            case 'howl':
                if (this.stateT <= 0) this._set('walk', 0.6);
                break;
            case 'walk':
                this._walk(dt, world, dx, dy, dist);
                if (this.stateT <= 0 && !player.dead && this.freeT >= 0.6) this._nextAttack(world, player, dist);
                break;
            case 'rear':
                if (this.stateT <= 0) this._set('smash', 0.12);
                break;
            case 'smash':
                if (this.stateT <= 0) this._slam(player);
                break;
            case 'crouch':
                if (this.stateT > 0.25) this._aimLeap(dx, dy, dist);
                if (this.stateT <= 0) {
                    this.leapV = this.leapLen / 0.55;
                    this._set('leap', 0.55);
                    WolfArt.burst(this.centerX(), this.y + this.h, ['#cfd8e8', '#8aa0b8'], 8, 110, 0.4, { kind: 'smoke', size: 5 });
                }
                break;
            case 'leap':
                this._moveWithCollision(Math.cos(this.leapA) * this.leapV * dt, Math.sin(this.leapA) * this.leapV * dt, world);
                if (this.stateT <= 0) {
                    WolfArt.shake(4, 0.2);
                    WolfArt.burst(this.centerX(), this.y + this.h, ['#cfd8e8', '#8aa0b8', '#ffffff'], 12, 140, 0.5, { kind: 'smoke', size: 5 });
                    this._set('pant', this.phase === 2 ? 0.8 : 1.1);
                }
                break;
            case 'windup':
                if (this.stateT > 0.2 && Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
                if (this.stateT <= 0) {
                    this.clawHit = false;
                    this._set('swipe', 0.22);
                }
                break;
            case 'swipe':
                this._claw(player);
                if (this.stateT <= 0) this._set('pant', 0.7);
                break;
            default:            // stuck, pant, roar
                if (this.stateT <= 0) this._toWalk();
        }
    }

    _lookAt(dx, dy, dt) {
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    _toWalk() {
        if (this.phase === 2 && !this.howled2) {
            // Wut-Heulen beim Wechsel in Phase 2 (kein Angriff, nicht unverwundbar)
            this.howled2 = true;
            this._set('howl', 1.3);
            const hx = this.centerX() + this.face * 14, hy = this.y + this.h - 110;
            WolfArt.shake(6, 0.5);
            WolfArt.burst(hx, hy, ['#ff4a4a', '#ffffff', '#dfe8ff'], 14, 170, 0.6, { kind: 'star' });
            WolfArt.ring(hx, hy + 40, '#ff4a4a', 100, 0.5, 5);
            return;
        }
        if (this.state === 'stuck' && this.freeT === 0) {
            // Mark ist betäubt: der Riese heult triumphierend den Mond an (kein Angriff)
            this._set('howl', 1.6);
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.7, 1.0) : randRange(1.1, 1.5));
    }

    _walk(dt, world, dx, dy, d) {
        if (Math.abs(dx) > 16) this.face = dx > 0 ? 1 : -1;
        if (d < 90) return;
        this.walkT += dt;
        const v = this.speed * (this.phase === 2 ? 1.2 : 1);
        this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
        this.moving = true;
    }

    _nextAttack(world, player, dist) {
        const order = BossGiantWerewolf.ORDER;
        let a = order[this.seq % order.length];
        if (a === 'slam' && this.freeT < WOLF_SLAM_GRACE) {
            // erst wenn Mark wieder wach ist (+ Schonzeit) schlägt er wieder mit den Pfoten
            this.stateT = 0.15;
            return;
        }
        this.seq++;
        if (a === 'claw' && dist > 120) a = 'pounce';
        const px = player.x + player.w / 2;
        if (Math.abs(px - this.centerX()) > 8) this.face = px > this.centerX() ? 1 : -1;
        if (a === 'slam') {
            this.impX = this.centerX() + this.face * 18;
            this.impY = this.y + this.h - 6;
            this._set('rear', this.phase === 2 ? 0.85 : 1.05);
        } else if (a === 'pounce') {
            const py = player.y + player.h / 2;
            this._aimLeap(px - this.centerX(), py - this.centerY(), Math.hypot(px - this.centerX(), py - this.centerY()));
            this._set('crouch', this.phase === 2 ? 0.65 : 0.8);
        } else {
            this._set('windup', this.phase === 2 ? 0.5 : 0.62);
        }
    }

    _aimLeap(dx, dy, d) {
        this.leapA = Math.atan2(dy, dx);
        this.leapLen = clamp(d + 10, 80, 220);
        if (Math.abs(dx) > 8) this.face = dx > 0 ? 1 : -1;
    }

    // ── a) Pfotenschlag mit Schockwelle ──

    _slam() {
        const x = this.impX, y = this.impY;
        const max = this._waveMax();
        this.waves.push({ x, y, r: 18, max, delay: 0, hitP: false, hitC: [] });
        if (this.phase === 2) this.waves.push({ x, y, r: 18, max, delay: 0.5, hitP: false, hitC: [] });
        this.slams++;
        WolfArt.shake(this.phase === 2 ? 8 : 6.5, 0.35);
        WolfArt.burst(x, y, ['#d8e0f0', '#a8b4c8', '#ffffff'], 14, 160, 0.55, { kind: 'smoke', size: 6 });
        WolfArt.burst(x, y, ['#ff4a4a', '#ffd23f', '#ffffff'], 8, 200, 0.45, { kind: 'star' });
        WolfArt.ring(x, y, '#ffd0d0', 50, 0.3, 5);
        // danach stecken die Pranken kurz im Boden: Zeit zum Zurückhauen
        this._set('stuck', this.phase === 2 ? 0.9 : 1.1);
    }

    // Ringe wachsen über den Boden. Wer im Ring steht: 1 Schaden + 5 s betäubt (Ausweichen rettet).
    _updateWaves(dt, player) {
        if (!this.waves.length) return;
        const comps = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const w of this.waves) {
            if (w.delay > 0) {
                w.delay -= dt;
                if (w.delay <= 0) {
                    WolfArt.shake(5, 0.25);
                    WolfArt.ring(w.x, w.y, '#ffd0d0', 50, 0.3, 5);
                }
                continue;
            }
            w.r += 190 * dt;
            const band = 15;
            if (!w.hitP && player && !player.dead && !(player.stunTimer > 0)) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                const d = Math.hypot(px - w.x, py - w.y);
                if (Math.abs(d - w.r) < band + player.w / 2 && !player.dodging) {
                    w.hitP = true;
                    WolfArt.hurt(player, 1, Math.atan2(py - w.y, px - w.x), 120);
                    if (player.stun && player.stun(WOLF_STUN)) {
                        this.stuns++;
                        this.freeT = 0;
                        WolfArt.burst(px, py - 14, ['#ffe35a', '#ffffff'], 8, 90, 0.5, { kind: 'star' });
                    }
                }
            }
            for (const c of comps) {
                if (!c || c.dead || typeof c.stun !== 'function' || c.stunTimer > 0 || c.koTimer > 0) continue;
                if (w.hitC.includes(c)) continue;
                const cw = c.w || 20, ch = c.h || 20;
                const d = Math.hypot(c.x + cw / 2 - w.x, c.y + ch / 2 - w.y);
                if (Math.abs(d - w.r) < band + cw / 2) {
                    w.hitC.push(c);
                    c.stun(WOLF_STUN);
                    WolfArt.burst(c.x + cw / 2, c.y, ['#ffe35a', '#ffffff'], 6, 80, 0.45, { kind: 'star' });
                }
            }
        }
        compactInPlace(this.waves, w => w.r < w.max);
    }

    // ── b) Krallenhieb: Fächer vor dem Riesen ──

    _clawCenter() {
        return { x: this.centerX() + this.face * 20, y: this.y + this.h - 18 };
    }

    _claw(player) {
        if (this.clawHit || !player || player.dead) return;
        const c = this._clawCenter();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - c.x, dy = py - c.y;
        if (Math.hypot(dx, dy) < 80 + player.w / 2 && dx * this.face > -12) {
            this.clawHit = true;
            WolfArt.hurt(player, 1, Math.atan2(dy, dx), 230);
            WolfArt.burst(px, py, ['#ffffff', '#ff4a4a'], 6, 120, 0.3, { kind: 'spark' });
        }
    }

    // ── Zeichnen ──

    // Am Boden (unter allen Figuren): Warnkreis, Schockwellen, Sprungbahn, Krallen-Fächer
    drawUnder(ctx, camera) {
        if (this.dead) return;
        if (this.state === 'rear' || this.state === 'smash') {
            const p = camera.worldToScreen(this.impX, this.impY);
            LateWorldArt.warn(ctx, p.x, p.y, this._waveMax(), this.state === 'smash' ? 1 : this._k());
            if (this.phase === 2) Art.ring(ctx, p.x, p.y, this._waveMax() * 0.55, '#ff3d5a', 1.6, 0.5);
        } else if (this.state === 'crouch') {
            const p = camera.worldToScreen(this.centerX(), this.y + this.h - 10);
            LateWorldArt.lane(ctx, p.x, p.y, this.leapA, this.leapLen + 30, 40, this._k());
        } else if (this.state === 'windup') {
            const c = this._clawCenter();
            const p = camera.worldToScreen(c.x, c.y);
            const a0 = this.face > 0 ? 0 : Math.PI;
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ff3d5a';
            ctx.globalAlpha = prev * (0.14 + 0.22 * this._k());
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, 92, a0 - 1.45, a0 + 1.45);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = prev * (0.55 + 0.4 * Math.sin(Art.time * 16));
            ctx.strokeStyle = '#ff3d5a';
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.globalAlpha = prev;
        } else if (this.state === 'swipe') {
            // drei weiße Krallenspuren
            const c = this._clawCenter();
            const p = camera.worldToScreen(c.x, c.y);
            const a0 = this.face > 0 ? 0 : Math.PI, k = this._k();
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * (1 - k * 0.7);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const r = 52 + i * 12;
                ctx.moveTo(p.x + Math.cos(a0 - 1.2) * r, p.y + Math.sin(a0 - 1.2) * r);
                ctx.arc(p.x, p.y, r, a0 - 1.2, a0 - 1.2 + 2.4 * Math.min(1, k * 1.6), false);
            }
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
        for (const w of this.waves) {
            if (w.delay > 0) continue;
            const p = camera.worldToScreen(w.x, w.y);
            const fade = clamp((w.max - w.r) / 45, 0, 1);
            Art.ring(ctx, p.x, p.y, w.r, '#ff5a5a', 28, 0.4 * fade);
            Art.ring(ctx, p.x, p.y, w.r, '#fff4f4', 9, fade);
            Art.ring(ctx, p.x, p.y, w.r + 7, '#ff3d5a', 3.2, fade);
            Art.ring(ctx, p.x, p.y, w.r - 7, '#ff3d5a', 2, 0.7 * fade);
            // Erdbrocken auf dem Ring
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * fade;
            ctx.fillStyle = '#9aa6bc';
            ctx.beginPath();
            for (let i = 0; i < 14; i++) {
                const a = (i / 14) * TAU + w.max;
                const rx = p.x + Math.cos(a) * w.r, ry = p.y + Math.sin(a) * w.r - 3;
                ctx.moveTo(rx + 2.6, ry);
                ctx.arc(rx, ry, 2.6, 0, TAU);
            }
            ctx.fill();
            ctx.globalAlpha = prev;
        }
    }

    // Für eine spätere Engine-Ebene über der Nacht-Abdunklung: nur die leuchtenden Augen.
    drawOverLight(ctx, camera) {
        if (this.dead) return;
        const P = this._pose();
        const pos = camera.worldToScreen(this.x + this.w / 2, this.y + this.h);
        Art.glow(ctx, pos.x + P.headX + this.face * 9, pos.y + P.headY - 4 - P.lift, 22 + P.glow * 10, WOLF_GLOW, 0.4 + P.glow * 0.35);
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, by - 50);
        ctx.translate(cx, by);
        this._drawBody(ctx, this._pose());
        ctx.restore();
    }

    // Haltung aus dem Zustand (nur Darstellung): Rumpf, Kopf, beide Pranken, Maul, Augenleuchten.
    _pose() {
        const f = this.face, st = this.dead ? 'dead' : this.state, t = Art.time, k = this._k();
        const P = {
            lift: 0, sx: 1, sy: 1, lean: 0, step: 0, bodyY: -62, headX: f * 8, headY: -100, tilt: 0,
            mouth: 0, glow: this.phase === 2 ? 0.5 : 0, tongue: false,
            fx: f * 34, fy: -48, bx: -f * 28, by: -50,     // vordere / hintere Pranke
        };
        if (this.moving) {
            P.step = Math.sin(this.walkT * 6);
            P.lift = Math.abs(P.step) * 2.4;
            P.lean = f * 0.05;
            P.fy += P.step * 4;
            P.by -= P.step * 4;
        } else {
            const b = Math.sin(t * 2 + this.seed);
            P.sy = 1 + b * 0.015;
            P.fy += b;
            P.by += b;
        }
        if (st === 'howl') {
            // heult den Mond an: Kopf in den Nacken, Maul weit auf
            const q = Math.min(1, k * 4);
            P.tilt = -f * 0.75 * q;
            P.headY -= 4 * q;
            P.mouth = q;
            P.glow = Math.max(P.glow, 0.6);
            P.fx = f * 30; P.fy = -40;
            P.bx = -f * 30; P.by = -40;
        } else if (st === 'rear') {
            // richtet sich auf, hebt beide Pfoten über den Kopf
            const e = 1 - (1 - k) * (1 - k);
            P.sy = 1 + 0.08 * e;
            P.headY -= 6 * e;
            P.tilt = -f * 0.15 * e;
            P.mouth = 0.6 * e;
            P.glow = Math.max(P.glow, e);
            P.fx = f * (34 - 16 * e); P.fy = -48 - 82 * e;
            P.bx = -f * (28 - 6 * e); P.by = -50 - 80 * e;
            P.lift = Math.sin(t * 30) * 0.8 * e;      // zittert vor Kraft
        } else if (st === 'smash' || st === 'stuck') {
            // Pranken auf dem Boden, geduckt
            const s = st === 'smash' ? 1 - k * 0.6 : 0;
            P.sy = 0.88; P.sx = 1.08;
            P.headY += 12; P.bodyY += 6;
            P.lean = f * 0.12;
            P.mouth = st === 'smash' ? 1 : 0.35;
            P.fx = f * 36; P.fy = -4 - s * 60;
            P.bx = f * 4; P.by = -4 - s * 60;
            P.glow = Math.max(P.glow, 0.7);
        } else if (st === 'crouch') {
            P.sx = 1 + 0.12 * k; P.sy = 1 - 0.16 * k;
            P.lean = f * 0.25 * k;
            P.mouth = 0.5;
            P.glow = Math.max(P.glow, k);
            P.fx = f * 40; P.fy = -20;
            P.bx = f * 10; P.by = -18;
        } else if (st === 'leap') {
            P.lift = Math.sin(k * Math.PI) * 30;
            P.sx = 0.92; P.sy = 1.08;
            P.lean = f * 0.35;
            P.mouth = 1;
            P.glow = 1;
            P.fx = f * 50; P.fy = -66;
            P.bx = f * 30; P.by = -76;
        } else if (st === 'windup') {
            P.lean = -f * 0.1 * k;
            P.mouth = 0.4;
            P.glow = Math.max(P.glow, k);
            P.bx = -f * (30 + 8 * k); P.by = -70 - 45 * k;     // hintere Pranke holt hinter dem Kopf aus
            P.fx = f * 26; P.fy = -66;
        } else if (st === 'swipe') {
            P.lean = f * 0.15;
            P.mouth = 0.8;
            P.fx = f * (20 + 40 * k); P.fy = -120 + 100 * k;
        } else if (st === 'pant') {
            P.sy = 0.96;
            P.headY += 4;
            P.mouth = 0.45 + 0.15 * Math.sin(t * 12);
            P.tongue = true;
            P.fx = f * 30; P.fy = -34;
        }
        P.headX += Math.sin(P.lean) * 30;
        return P;
    }

    _drawBody(ctx, P) {
        const f = this.face, t = Art.time, fur = this.fur, fd = this.furDark, dead = this.dead;
        const p2 = this.phase === 2;
        const lw = 2.2;
        ctx.save();
        ctx.translate(0, -P.lift);
        ctx.scale(P.sx, P.sy);
        // Mondschein beim Heulen
        if (this.state === 'howl' && !dead) Art.glow(ctx, P.headX + f * 30, P.headY - 40, 46, '#dfe8ff', 0.35);
        // buschiger Schwanz
        const wag = Math.sin(t * 3 + this.seed) * 4;
        Art.shape(ctx, c => {
            c.moveTo(-f * 18, -40);
            c.quadraticCurveTo(-f * 50, -36 + wag * 0.4, -f * 56, -70 + wag);
            c.quadraticCurveTo(-f * 46, -58, -f * 42, -66);
            c.quadraticCurveTo(-f * 38, -52, -f * 20, -54);
            c.closePath();
        }, { x: -56, y: -70, w: 38, h: 34 }, fur, { lineWidth: lw, highlight: false });
        // Beine (Wolfsbeine mit Knick), hinten dunkler
        const st = P.step * 6;
        for (const s of [-1, 1]) {
            const col = s < 0 ? fd : fur;
            const hipX = s * f * 13, footX = s * f * 16 + s * st;
            Art.limb(ctx, hipX, -36, hipX + f * 9, -20, 13, col, { lineWidth: lw });
            Art.limb(ctx, hipX + f * 9, -20, footX, -4, 10, col, { lineWidth: lw });
            Art.body(ctx, footX + f * 4, -4, 10, 5, col, { lineWidth: lw, highlight: false });
            this._claws(ctx, footX + f * 12, -4, f, 2);
        }
        // hinterer Arm (hinter dem Rumpf)
        this._arm(ctx, -f * 20, P.bodyY - 16, P.bx, P.by, fd, f, lw);
        // zerrissene Hose
        Art.shape(ctx, c => {
            c.moveTo(-27, -52);
            c.lineTo(27, -52);
            c.lineTo(27, -32);
            for (let i = 0; i <= 8; i++) {
                const x = 27 - (54 * i) / 8;
                c.lineTo(x, -28 - (i % 2) * 6);
            }
            c.closePath();
        }, { x: -27, y: -52, w: 54, h: 24 }, this.pants, { lineWidth: lw, highlight: false });
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(-f * 14 - 4, -46, 8, 7);                      // Flicken
        // Rumpf
        Art.body(ctx, f * 2, P.bodyY, 30, 28, fur, { lineWidth: lw, rot: P.lean });
        // helle, zottige Brust
        ctx.fillStyle = WOLF_CREAM;
        ctx.beginPath();
        const cxB = f * 10, cyB = P.bodyY + 2;
        ctx.moveTo(cxB - f * 10, cyB - 18);
        ctx.lineTo(cxB + f * 14, cyB - 14);
        ctx.lineTo(cxB + f * 10, cyB - 6);
        ctx.lineTo(cxB + f * 15, cyB);
        ctx.lineTo(cxB + f * 9, cyB + 6);
        ctx.lineTo(cxB + f * 12, cyB + 14);
        ctx.lineTo(cxB - f * 4, cyB + 18);
        ctx.lineTo(cxB - f * 2, cyB + 6);
        ctx.closePath();
        ctx.fill();
        // wenig HP: Kratzer im Fell
        if (this.hp <= this.maxHp * 0.25 && !dead) {
            ctx.strokeStyle = '#7a2a3a';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                ctx.moveTo(-f * (16 - i * 4), P.bodyY - 10 + i * 2);
                ctx.lineTo(-f * (8 - i * 4), P.bodyY + 4 + i * 2);
            }
            ctx.stroke();
        }
        // Mähne um die Schultern
        WolfArt.mane(ctx, P.headX * 0.5, P.headY + 22, 30, 15, 9, p2 ? Art.mix(fur, '#ff6a6a', 0.18) : fur, lw);
        // Kopf
        ctx.save();
        ctx.translate(P.headX, P.headY);
        ctx.rotate(P.tilt);
        this._head(ctx, P, f, fur, lw, dead, p2);
        ctx.restore();
        // vorderer Arm (vor dem Rumpf)
        this._arm(ctx, f * 22, P.bodyY - 16, P.fx, P.fy, fur, f, lw);
        // Schlüssel? Bosse tragen keinen. Benommen-Sterne beim Tod gibt es nicht (bossDeath schrumpft).
        ctx.restore();
    }

    // Arm von der Schulter (sx, sy) zur Pranke (hx, hy), Ellbogen nach außen geknickt
    _arm(ctx, sx, sy, hx, hy, col, f, lw) {
        const mx = (sx + hx) / 2, my = (sy + hy) / 2;
        const dx = hx - sx, dy = hy - sy;
        const d = Math.hypot(dx, dy) || 1;
        const bend = Math.max(0, 52 - d) * 0.5;
        const ex = mx + (-dy / d) * bend * -f, ey = my + (dx / d) * bend * -f + bend * 0.3;
        Art.limb(ctx, sx, sy, ex, ey, 13, col, { lineWidth: lw });
        Art.limb(ctx, ex, ey, hx, hy, 11, col, { lineWidth: lw });
        Art.body(ctx, hx, hy, 9, 8, col, { lineWidth: lw });
        const ang = Math.atan2(hy - ey, hx - ex);
        this._clawsDir(ctx, hx + Math.cos(ang) * 7, hy + Math.sin(ang) * 7, ang);
    }

    // Drei weiße Krallen in Richtung ang
    _clawsDir(ctx, x, y, ang) {
        const ca = Math.cos(ang), sa = Math.sin(ang);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a3a52';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            const ox = -sa * i * 4.2, oy = ca * i * 4.2;
            ctx.moveTo(x + ox - sa * 1.6, y + oy + ca * 1.6);
            ctx.lineTo(x + ox + ca * 6, y + oy + sa * 6);
            ctx.lineTo(x + ox + sa * 1.6, y + oy - ca * 1.6);
        }
        ctx.fill();
        ctx.stroke();
    }

    _claws(ctx, x, y, f, n) {
        this._clawsDir(ctx, x - f * 3, y + 1, f > 0 ? 0.15 : Math.PI - 0.15);
    }

    // Kopf mit Ohren, Schnauze, roten Augen und Maul; Ursprung = Kopfmitte
    _head(ctx, P, f, fur, lw, dead, p2) {
        WolfArt.ear(ctx, -f * 10, -12, 11, -f * 0.3, fur);
        WolfArt.ear(ctx, f * 6, -14, 11, f * 0.2, fur);
        if (p2 && !dead) {
            // eingerissenes Ohr in Phase 2
            ctx.fillStyle = '#1d1433';
            ctx.beginPath();
            ctx.moveTo(f * 8, -24);
            ctx.lineTo(f * 12, -21);
            ctx.lineTo(f * 9, -19);
            ctx.closePath();
            ctx.fill();
        }
        // Wangenzotteln
        WolfArt.mane(ctx, -f * 4, 4, 20, 14, 7, fur, lw);
        Art.body(ctx, 0, 0, 20, 17, fur, { lineWidth: lw });
        // Schnauze mit Unterkiefer (öffnet sich)
        const snx = f * 18, sny = 6;
        const open = P.mouth * 9;
        if (open > 0.5) {
            ctx.fillStyle = '#3a0d1e';
            ctx.beginPath();
            ctx.moveTo(snx - f * 10, sny + 2);
            ctx.lineTo(snx + f * 13, sny + 1);
            ctx.lineTo(snx + f * 9, sny + 4 + open);
            ctx.lineTo(snx - f * 8, sny + 4 + open * 0.7);
            ctx.closePath();
            ctx.fill();
            if (P.tongue) {
                ctx.fillStyle = '#ff6f8e';
                ctx.beginPath();
                ctx.ellipse(snx + f * 6, sny + 6 + open, 3.4, 5, 0, 0, TAU);
                ctx.fill();
            }
            // Unterkiefer
            Art.body(ctx, snx, sny + 6 + open * 0.8, 10, 3.6, WOLF_CREAM, { lineWidth: 1.6, highlight: false });
        }
        Art.body(ctx, snx, sny, 13, 8, WOLF_CREAM, { lineWidth: lw });
        // Reißzähne
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a3a52';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (const ox of [-3, 7]) {
            const x = snx + f * ox, y = sny + 6;
            ctx.moveTo(x - 1.8, y);
            ctx.lineTo(x + 1.8, y);
            ctx.lineTo(x, y + 4.5 + (p2 ? 1.5 : 0));
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        // Nase
        Art.body(ctx, snx + f * 11, sny - 4, 4, 3, '#2a1a2e', { lineWidth: 1, outline: '#140c1c' });
        // Augen (rot leuchtend), Phase 2 mit Narbe
        const ex = f * 8, ey = -4;
        if (dead) {
            LateWorldArt.xEyes(ctx, ex, ey, 3.2, 6.5);
        } else {
            WolfArt.eyes(ctx, ex, ey, 4.4, 6.5, this.look, P.glow, this.seed, '#3a2a40');
            if (p2) {
                ctx.strokeStyle = '#7a2a3a';
                ctx.lineWidth = 1.6;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(ex - f * 11, ey - 9);
                ctx.lineTo(ex - f * 4, ey + 7);
                ctx.moveTo(ex - f * 10, ey - 3);
                ctx.lineTo(ex - f * 6, ey - 4.5);
                ctx.stroke();
            }
        }
    }
}

// Angriffsfolge: Pfotenschlag wechselt sich mit Sprung-Satz und Krallenhieb ab
BossGiantWerewolf.ORDER = ['slam', 'pounce', 'claw', 'slam', 'claw', 'pounce'];
