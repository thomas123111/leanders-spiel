// ── Welt 35: Krötensumpf ── (Idee von Leander)
// Böse dicke Frösche: grimmige grün gefleckte Frösche mit gelbem Bauch. Sie hüpfen in Sätzen auf Mark zu,
//   blähen vorher die Backen (0,5 s Warnung) und spucken einen Schleimklecks – auf Mark ODER einen Freund
//   (Juri/Krokodil). Der Schleim macht 1 Schaden und kurz langsam. Ein Frosch trägt den Schlüssel (isKeyGhost).
// Drei-Kopf-Kröte (Boss): riesige warzige Kröte mit DREI Köpfen nebeneinander (je andere Augen).
//   Zungenpeitsche: ein Kopf zielt (Warnlinie 0,8 s), die lange rosa Zunge schnellt ~200 Einheiten geradeaus
//     und peitscht zurück – wer getroffen wird (auch Freunde), fliegt kräftig weg (starker Rückstoß).
//   Schleimsalve: alle drei Köpfe spucken Schleimkugeln im Fächer (Vorwarnung: Strahlen + Aufplustern).
//   Phase 2 (halbe LP): heiseres Quaken, drei Zungen nacheinander auf drei Ziele, Schleimpfützen bleiben
//     kurz liegen und verlangsamen, und die Kröte ruft Kaulquappen-Helfer (höchstens 4, verpuffen mit ihr).
//   Nach jedem großen Angriff eine Verschnaufpause – Zeit zum Zurückhauen. Der Boss bleibt im Boss-Raum.

const TOAD_GREEN = '#57b84a', TOAD_GREEN_DARK = '#2e7a2f';
const TOAD_BELLY = '#ffd94a';
const TOAD_SLIME = '#9ff04b', TOAD_SLIME_DARK = '#4e9a1e', TOAD_SLIME_GLOW = '#b6ff5e';
const TOAD_TONGUE = '#ff6f92', TOAD_TONGUE_DARK = '#c23a63';
const TOAD_WARN = 0.5;              // Backen-Blähen vor dem Schleimspucken (Sekunden)
const TOAD_TONGUE_WARN = 0.8;       // Warnlinie der Zungenpeitsche (Sekunden)
const TOAD_TONGUE_LEN = 200;        // maximale Zungenlänge
const TOAD_MAX_SHOTS = 56;          // höchstens so viele Gegner-/Boss-Geschosse zugleich (Handy)

const ToadArt = {
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
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [TOAD_SLIME, '#ffffff'], 10, 140, 0.45, { kind: 'spark' });
    },

    // Geschossliste aus Argument oder Engine (in Galerie/Tests ohne Game: null)
    shotList(projectiles) {
        return projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
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

    // Boss-Raum, nur wenn wir wirklich im laufenden Bosskampf dieser Welt sind (Muster thunder.js)
    room(world) {
        if (typeof Game === 'undefined' || Game.world !== world || !Game.bossActive ||
            typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Warzen und Flecken gleichmäßig verteilen (nur im Konstruktor aufrufen, nie im draw)
    speckList(n, rx, ry, seed) {
        const out = [];
        for (let i = 0; i < n; i++) {
            const a = (i * 2.399963) + seed;                 // goldener Winkel = schöne Streuung
            const q = (0.28 + 0.62 * ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) / 2);
            out.push({ x: Math.cos(a) * rx * q, y: Math.sin(a) * ry * q, r: 1.1 + 1.5 * ((Math.sin(i * 78.233 + seed) * 12543.853) % 1 + 1) % 1 });
        }
        return out;
    },
};

// ══════════════════════════════════════════
// ── Schleimklecks (Geschoß) ──
// ══════════════════════════════════════════

// Wabbelnder grüner Schleimballen: trifft Mark (macht kurz langsam) oder einen Freund (kurz betäubt).
class ToadSlimeBall extends Projectile {
    constructor(x, y, angle, speed) {
        super(x, y, Math.cos(angle) * (speed || 175), Math.sin(angle) * (speed || 175), 1, 'enemy', 90);
        this.radius = 6;
        this.lifetime = 2.2;
        this.slow = true;              // Engine: player.applySlow nach Treffer
        this.hitsCompanions = true;
        this.stunTime = 1.2;
        this.seed = Math.random() * 10;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time * 9 + this.seed;
        const wq = 1 + Math.sin(t) * 0.16;
        // kurzer Schleim-Tropfen hinterher
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.4;
        ctx.fillStyle = TOAD_SLIME;
        ctx.beginPath();
        ctx.ellipse(p.x - (this.vx / sp) * 9, p.y - (this.vy / sp) * 9, 3.2, 2.4, Math.atan2(this.vy, this.vx), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev;
        Art.glow(ctx, p.x, p.y, 13, TOAD_SLIME_GLOW, 0.5);
        Art.body(ctx, p.x, p.y, 5.6 * wq, 5.6 / wq, TOAD_SLIME, { lineWidth: 1.3, outline: TOAD_SLIME_DARK });
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(p.x - 1.8, p.y - 2, 1.3, 0, TAU);
        ctx.fill();
    }
}

// ══════════════════════════════════════════
// ── Schleim-Frosch ──
// ══════════════════════════════════════════

// Dicker grimmiger Frosch: grünes Fell mit dunklen Flecken, gelber Bauch, dicke Backen.
// Zustände: wander → hop (hüpft in Sätzen) → inflate (Blähen 0,5 s) → spit (Spucke) → catch (verschnauft).
class SlimeFrog extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(42, 52);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 235;
        this.seed = Math.random() * 10;
        this.tone = randRange(-10, 10);                       // leichte Farbvarianz pro Frosch
        this.spots = ToadArt.speckList(5, 9, 6, this.seed);   // Fleckenlage steht fest (kein Zufall im draw)
        this.fxColor = TOAD_GREEN;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.state = 'wander';
        this.stateT = randRange(0.2, 0.8);
        this.hopCD = randRange(0.2, 0.9);
        this.shootT = randRange(1.6, 3);
        this.hopA = 0;
        this.target = null;
        this.engaged = false;
        this.moving = false;
        this.wanderT = randRange(0.4, 1.6);
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
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 70) this.engaged = false;
        this.moving = false;

        if (this.state === 'inflate') {
            // Backen blähen sich, die letzten 0,15 s steht die Richtung fest (fair zum Ausweichen)
            this.stateT -= dt;
            const tg = this.target;
            const tx = tg === player ? px : tg.x + (tg.w || 20) / 2;
            const ty = tg === player ? py : tg.y + (tg.h || 20) / 2;
            if (this.stateT > 0.15 && (!tg.dead && !(tg.koTimer > 0))) {
                this.aimA = Math.atan2(ty - (this.y + this.h - 16), tx - this.centerX());
            }
            this._look(Math.cos(this.aimA), Math.sin(this.aimA), dt);
            if (this.stateT <= 0) {
                this.state = 'spit';
                this.stateT = 0.18;
                this._spit(projectiles);
            }
            return;
        }
        if (this.state === 'spit') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'catch';
                this.stateT = 0.6;            // kurze Verschnaufpause nach dem Spucken
            }
            return;
        }
        if (this.state === 'catch') {
            this.stateT -= dt;
            if (this.stateT <= 0) this.state = this.engaged ? 'stalk' : 'wander';
            return;
        }
        if (this.state === 'hop') {
            // Satz geradeaus (Richtung steht seit dem Abdruck fest)
            this.stateT -= dt;
            this.moving = true;
            this._moveWithCollision(Math.cos(this.hopA) * 132 * dt, Math.sin(this.hopA) * 132 * dt, world);
            if (this.stateT <= 0) {
                this.state = 'land';
                this.stateT = randRange(0.22, 0.4);
            }
            return;
        }
        if (this.state === 'land') {
            this.stateT -= dt;
            if (this.stateT <= 0) this.state = this.engaged ? 'stalk' : 'wander';
            return;
        }

        // stalk / wander: heranschleichen, dann Abdruck zum Hüpfen; Spuck-Gelegenheit prüfen
        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            this.shootT -= dt;
            if (this.shootT <= 0 && dist < 250 &&
                (typeof Juri === 'undefined' || Juri.lineClear(world, mx, my - 8, px, py))) {
                this.target = this._pickTarget(player, world);
                this.state = 'inflate';
                this.stateT = TOAD_WARN;
                this.aimA = Math.atan2(py - (this.y + this.h - 16), px - mx);
                if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
                return;
            }
            if (dist > 85) { vx = dx / dist; vy = dy / dist; sp = this.speed; }
            else { vx = -dy / dist; vy = dx / dist; sp = this.speed * 0.4; }
            this.hopCD -= dt;
            if (this.hopCD <= 0 && dist > 45) {
                this.state = 'hop';
                this.stateT = 0.3;
                this.hopA = Math.atan2(vy, vx);
                this.hopCD = randRange(0.85, 1.6);
                ToadArt.burst(mx, this.y + this.h, ['#bfe8c8', '#8ac89a'], 4, 60, 0.3, { kind: 'smoke', size: 3 });
                this.moving = true;
                return;
            }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.2, 2.6);
                if (Math.random() < 0.4) { this.wx = 0; this.wy = 0; }
                else {
                    const a = Math.random() * TAU;
                    this.wx = Math.cos(a);
                    this.wy = Math.sin(a);
                }
            }
            vx = this.wx; vy = this.wy; sp = this.speed * 0.4;
        }
        this.moving = sp > 0 && (vx !== 0 || vy !== 0);
        if (this.moving) {
            const ox = this.x, oy = this.y;
            this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
            if (!this.engaged && Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) this.wanderT = 0;
            if (this.state !== 'hop') this.hopA = Math.atan2(vy, vx);
        }
        if (this.engaged) {
            if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
            this._look(dx / dist, dy / dist, dt);
        } else {
            if (Math.abs(vx) > 0.2) this.face = vx > 0 ? 1 : -1;
            this._look(vx * 0.6, vy * 0.6 + 0.2, dt);
        }
    }

    // Ziel: meist Mark, manchmal ein wacher Freund mit freier Sicht (Angriffe treffen "Mark und seine Freunde")
    _pickTarget(player, world) {
        if (Math.random() < 0.45) {
            const mx = this.centerX(), my = this.centerY();
            const opts = ToadArt.companions();
            const awake = [];
            for (const c of opts) {
                const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                if (Math.hypot(cx - mx, cy - my) > 260) continue;
                if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my - 8, cx, cy)) continue;
                awake.push(c);
            }
            if (awake.length) return awake[Math.floor(Math.random() * awake.length)];
        }
        return player;
    }

    _spit(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list || list.length > TOAD_MAX_SHOTS) return;
        const sx = this.centerX() + this.face * 6, sy = this.y + this.h - 17;
        list.push(new ToadSlimeBall(sx, sy, this.aimA));
        this.shootT = randRange(2.4, 3.6);
        ToadArt.burst(sx + Math.cos(this.aimA) * 8, sy + Math.sin(this.aimA) * 8, [TOAD_SLIME, TOAD_SLIME_GLOW], 5, 70, 0.3, { kind: 'spark' });
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    // Kleine Warnspitzen am Boden, solange die Backen gebläht sind (Richtung steht bald fest)
    drawUnder(ctx, camera) {
        if (this.dead || this.state !== 'inflate') return;
        const p = camera.worldToScreen(this.centerX() + Math.cos(this.aimA) * 14, this.y + this.h - 15 + Math.sin(this.aimA) * 10);
        LateWorldArt.chevrons(ctx, p.x, p.y, this.aimA, clamp(1 - this.stateT / TOAD_WARN, 0, 1));
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 12)) {
                ctx.translate(cx, by);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, by);
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 20 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Frosch mit Fußpunkt (0, 0); plump, mit dicken Backen und grimmigem Blick.
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const green = `hsl(${108 + this.tone}, 55%, 44%)`;
        let sx = 1, sy = 1, lift = 0, puff = 0;
        if (this.state === 'inflate') puff = clamp(1 - this.stateT / TOAD_WARN, 0, 1);
        else if (this.state === 'hop') {
            const q = clamp(1 - this.stateT / 0.3, 0, 1);
            lift = Math.sin(q * Math.PI) * 7;
            sx = 0.92; sy = 1.1;
        } else if (this.state === 'land') {
            const q = clamp(this.stateT / 0.3, 0, 1);
            sx = 1 + 0.14 * q; sy = 1 - 0.16 * q;
        } else if (this.state === 'catch' || this.state === 'spit') {
            sx = 1.05; sy = 0.95;
        } else if (this.moving) {
            const b = Math.sin(t * 8 + sd) * 0.03;
            sx = 1 + b; sy = 1 - b;
        } else {
            const b = Math.sin(t * 2.2 + sd) * 0.02;
            sx = 1 + b; sy = 1 - b;
        }
        sx += puff * 0.14;
        sy -= puff * 0.08;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -14, 26, '#ffd23f', 0.42 + 0.12 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(0, -lift);
        ctx.scale(sx, sy);
        // Hinterbeine (angesetzt, zum Satz gegrätscht)
        for (const s of [-1, 1]) {
            Art.shape(ctx, c => {
                c.moveTo(s * 6, -13);
                c.quadraticCurveTo(s * 15, -14 + (this.state === 'hop' ? -3 : 0), s * 13, -3);
                c.quadraticCurveTo(s * 10, -1, s * 6, -4);
                c.closePath();
            }, { x: s > 0 ? 6 : -15, y: -14, w: 9, h: 13 }, TOAD_GREEN_DARK, { lineWidth: 1.1, highlight: false });
        }
        // plumper Körper mit gelbem Bauch
        Art.body(ctx, 0, -10, 13, 9.5 + puff * 1.4, green, { lineWidth: 1.4 });
        Art.body(ctx, f * 2, -6.5, 8.5, 5, TOAD_BELLY, { lineWidth: 1.1, highlight: false });
        // dunkle Flecken (Lage im Konstruktor festgelegt)
        ctx.fillStyle = TOAD_GREEN_DARK;
        ctx.beginPath();
        for (const s of this.spots) {
            ctx.moveTo(s.x + s.r, -10 + s.y);
            ctx.arc(s.x, -10 + s.y * 0.8, s.r, 0, TAU);
        }
        ctx.fill();
        // aufgeblähte Backen leuchten schwach grün (Warnung)
        if (puff > 0) Art.glow(ctx, 0, -12, 16 + puff * 10, TOAD_SLIME_GLOW, 0.25 + puff * 0.3);
        // Augen auf Warsten oben drauf
        for (const s of [-1, 1]) {
            Art.body(ctx, s * 5.4, -18.5, 4.4, 4.2, green, { lineWidth: 1.2 });
        }
        if (dead) {
            LateWorldArt.xEyes(ctx, 0, -18.5, 1.6, 5.4);
        } else {
            Art.eyes(ctx, 0, -18.5, 2.2, { gap: 5.4, look: this.look, angry: true, iris: '#c26a12', seed: sd });
        }
        // breites grimmiges Maul, beim Blähen offen
        if (puff > 0.25 || this.state === 'spit') Art.mouth(ctx, f * 1.5, -12, 9, this.state === 'spit' ? 'open' : 'o');
        else {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(f * -3, -11.5);
            ctx.quadraticCurveTo(f * 2.5, -9.5, f * 7.5, -12.5);
            ctx.stroke();
        }
        // Nasenlöcher
        ctx.fillStyle = TOAD_GREEN_DARK;
        ctx.beginPath();
        ctx.arc(f * 6.5, -15, 0.8, 0, TAU);
        ctx.arc(f * 4, -15.6, 0.8, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Kaulquappen-Helfer (ruft die Drei-Kopf-Kröte) ──
// ══════════════════════════════════════════

// Kleine Quappe mit Buschelschwanz: hüpft auf Mark zu und verpufft, wenn die Kröte besiegt ist.
class ToadPup extends Enemy {
    constructor(x, y, summoner) {
        super(x, y, 18, 16);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = randRange(58, 70);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.summoner = summoner || null;
        this.seed = Math.random() * 10;
        this.fxColor = TOAD_GREEN;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.hopCD = randRange(0.2, 0.8);
        this.hopT = 0;
        this.hopA = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        // Gerufene Quappen verpuffen mit der Kröte und bleiben im Boss-Raum (Muster witch.js)
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                ToadArt.burst(this.centerX(), this.centerY(), [TOAD_SLIME, '#ffffff'], 8, 90, 0.4, { kind: 'spark' });
                return;
            }
            const room = ToadArt.room(world);
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - this.centerX(), dy = py - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        if (this.hopT > 0) {
            this.hopT -= dt;
            this._moveWithCollision(Math.cos(this.hopA) * 110 * dt, Math.sin(this.hopA) * 110 * dt, world);
        } else {
            this.hopCD -= dt;
            if (this.hopCD <= 0 && !player.dead) {
                this.hopT = 0.24;
                this.hopA = Math.atan2(dy, dx);
                this.hopCD = randRange(0.55, 1.1);
            }
        }
        if (dx > 2) this.face = 1; else if (dx < -2) this.face = -1;
        const k = Math.min(1, dt * 8);
        this.look.x += (dx / dist - this.look.x) * k;
        this.look.y += (dy / dist - this.look.y) * k;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 8)) {
                ctx.translate(cx, by);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            return;
        }
        const air = this.hopT > 0 ? Math.sin(clamp(1 - this.hopT / 0.24, 0, 1) * Math.PI) * 5 : 0;
        ctx.translate(cx, by - air);
        this._drawBody(ctx, false);
        ctx.restore();
    }

    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face;
        // buschiger Schwanz (wedelt)
        ctx.strokeStyle = TOAD_GREEN_DARK;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-f * 6, -7);
        ctx.quadraticCurveTo(-f * 12, -7 + Math.sin(t * 10 + this.seed) * 3, -f * 14, -11);
        ctx.stroke();
        // rundlicher Laich-Körper
        Art.body(ctx, 0, -8, 8, 7.4, TOAD_GREEN, { lineWidth: 1.3 });
        Art.body(ctx, f * 1.5, -5.5, 5, 3.4, TOAD_BELLY, { lineWidth: 1, highlight: false });
        if (dead) LateWorldArt.xEyes(ctx, f * 1.5, -10, 1.3, 3.2);
        else Art.eyes(ctx, f * 1.5, -10, 1.8, { gap: 3.2, look: this.look, angry: true, iris: '#c26a12', seed: this.seed });
        Art.mouth(ctx, f * 3.5, -6, 3.6, dead ? 'o' : 'angry');
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 35: Drei-Kopf-Kröte ──
// ══════════════════════════════════════════

// Riesige warzige Kröte mit drei Köpfen nebeneinander (orange, rote und violette Augen).
// Hitbox 86×72, Zeichnung ~150 breit und ~105 hoch. Bleibt immer im Boss-Raum.
// Ablauf Phase 1: Quaken (Intro) → Lauern → Zungenpeitsche → Verschnaufpause → Schleimsalve → …
// Phase 2 (halbe LP): Heulen, drei Zungen nacheinander auf drei Ziele, Schleimpfützen bleiben liegen,
// und sie ruft Kaulquappen (höchstens 4, verpuffen mit ihr). Alles sichtbar angekündigt.
class BossTripleToad extends Enemy {
    constructor(x, y) {
        super(x, y, 86, 72);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 40;
        this.damage = 1;
        // Kein Berührungsschaden: gefährlich sind Zungen und Schleim. So kann man in der
        // Verschnaufpause gefahrlos zurückschlagen (fair für Kinder).
        this.contactDamage = false;
        this.isBoss = true;
        this.flying = false;
        this.fxColor = TOAD_GREEN;
        this.shadow = { rx: 44, ry: 13 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.face = -1;
        this.phase = 1;
        this.roared = false;
        this.t = Math.random() * 10;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.moving = false;
        // Die drei Köpfe: seitlicher Abstand, iris-Farbe und eigener Blinzel-Samen
        this.heads = [
            { dx: -27, iris: '#ff9f1c', seed: this.seed + 1, blink: 0 },
            { dx: 0, iris: '#ff2d4a', seed: this.seed + 2, blink: 0 },
            { dx: 27, iris: '#9b5cff', seed: this.seed + 3, blink: 0 },
        ];
        this.specks = ToadArt.speckList(16, 33, 20, this.seed);
        this.tongue = { on: false, head: 1, bx: 0, by: 0, a: 0, len: 0, ext: 0, hit: [] };
        this.aimA = 0;
        this.aimLen = 0;
        this.aimHead = 1;
        this.aimTg = null;
        this.tQueue = [];
        this.salveWave = 0;
        this.salveClock = 0;
        this.puddles = [];
        this.pups = [];
        this._room = null;
        this._pz = {};
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() {
        return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
    }

    // Eine riesige Kröte lässt sich kaum wegschubsen.
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.15);
        if (this.dead && this.tongue.on) this.tongue.on = false;
    }

    // Kopf-Mund in Weltkoordinaten (Ursprung von Warnlinie und Zunge)
    _mouth(i) {
        const h = this.heads[i];
        return { x: this.centerX() + h.dx + this.face * 6, y: this.y + this.h - 52 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (!this._room) this._room = ToadArt.room(world);
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this._startRoar();
        this._updatePuddles(dt, player);
        this._updateTongue(dt, player);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - this.centerX(), dy = py - (this.y + this.h - 60);
        const dist = Math.hypot(dx, dy) || 1;
        this._lookAt(dx, dy, dt);

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._toIdle();
                break;
            case 'idle':
                this._hover(dt, world, px, py, dist, dx, dy);
                if (this.stateT <= 0) this._nextAttack(world, player, px, py, projectiles);
                break;
            case 'tongueAim':
                if (this.stateT > 0.3) this._aimTongue(world, player, px, py);
                if (this.stateT <= 0) this._launchTongue(world);
                break;
            case 'tongueStrike':
                // Zunge fliegt und peitscht zurück (Treffer in _updateTongue)
                if (this.stateT <= 0) {
                    this.tongue.on = false;
                    if (this.tQueue.length) {
                        this.aimTg = this.tQueue.shift();
                        this._set('tongueAim', 0.55);
                    } else {
                        this._set('rest', this.phase === 2 ? 1.0 : 1.4);
                    }
                }
                break;
            case 'salveCharge':
                if (this.stateT <= 0) {
                    this.salveWave = 0;
                    this.salveClock = 0;
                    this._set('salve', 0.62);
                }
                break;
            case 'salve': {
                this.salveClock -= dt;
                if (this.salveClock <= 0 && this.salveWave < 3) {
                    this._spitWave(projectiles, px, py, world);
                    this.salveWave++;
                    this.salveClock = 0.2;
                }
                if (this.stateT <= 0 && this.salveWave >= 3) this._set('rest', this.phase === 2 ? 1.0 : 1.5);
                break;
            }
            case 'summon':
                if (this.stateT <= 0) {
                    this._spawnPup(world);
                    this._set('rest', 1.1);
                }
                break;
            case 'roar':
                if (this.stateT <= 0) this._toIdle();
                break;
            default:            // rest
                if (this.stateT <= 0) this._toIdle();
        }
    }

    _lookAt(dx, dy, dt) {
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 6);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
        if (Math.abs(dx) > 14 && this.state !== 'tongueAim' && this.state !== 'tongueStrike') {
            this.face = dx > 0 ? 1 : -1;
        }
    }

    _toIdle() {
        this._set('idle', this.phase === 2 ? randRange(0.7, 1.0) : randRange(1.1, 1.5));
    }

    _startRoar() {
        // Wut beim Wechsel in Phase 2: alle drei Münder auf, grüner Schwall (kein Angriff)
        this.phase = 2;
        this.roared = true;
        this._set('roar', 1.2);
        const x = this.centerX(), y = this.y + this.h - 70;
        ToadArt.shake(6, 0.45);
        ToadArt.burst(x, y, [TOAD_SLIME, '#ffffff', TOAD_GREEN], 18, 190, 0.6, { kind: 'spark' });
        ToadArt.ring(x, y + 40, TOAD_SLIME, 110, 0.5, 5);
    }

    // hält 120-190 Abstand, sonst seitliches Ausweichen; bleibt stets im Boss-Raum
    _hover(dt, world, px, py, dist, dx, dy) {
        let vx, vy, sp = this.speed * (this.phase === 2 ? 1.25 : 1);
        if (dist > 190) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 120) { vx = -dx / dist; vy = -dy / dist; sp *= 0.8; }
        else { vx = -dy / dist; vy = dx / dist; sp *= 0.55; }
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
        if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) { /* Wand: einfach stehen */ }
        this.moving = true;
        this._stayInRoom();
    }

    _stayInRoom() {
        const r = this._room;
        if (!r) return;
        this.x = clamp(this.x, r.x, r.x + r.w - this.w);
        this.y = clamp(this.y, r.y, r.y + r.h - this.h);
    }

    _nextAttack(world, player, px, py, projectiles) {
        const order = this.phase === 2 ? ['tongue3', 'salve', 'tongue', 'summon'] : ['tongue', 'salve'];
        const kind = order[this.seq % order.length];
        this.seq++;
        if (kind === 'tongue') {
            this.tQueue.length = 0;
            this.aimTg = this._pickTongueTarget(player, world);
            this.aimHead = Math.floor(Math.random() * 3);
            this._aimTongue(world, player, px, py);
            this._set('tongueAim', TOAD_TONGUE_WARN);
        } else if (kind === 'tongue3') {
            // Phase 2: alle drei Zungen nacheinander auf drei Ziele (Mark zuerst, dann Freunde)
            this.tQueue.length = 0;
            this.aimTg = player;
            for (const c of ToadArt.companions()) {
                if (this.tQueue.length < 2) this.tQueue.push(c);
            }
            while (this.tQueue.length < 2) this.tQueue.push(player);
            this.aimHead = 0;
            this._aimTongue(world, player, px, py);
            this._set('tongueAim', TOAD_TONGUE_WARN);
        } else if (kind === 'salve') {
            this.salveA = Math.atan2(py - (this.y + this.h - 52), px - this.centerX());
            this._set('salveCharge', this.phase === 2 ? 0.6 : 0.75);
        } else {
            this._set('summon', 0.9);
            ToadArt.burst(this.centerX(), this.y + this.h - 20, [TOAD_SLIME, '#bfe8c8'], 10, 90, 0.5, { kind: 'smoke', size: 5 });
        }
    }

    // Ziel der Einzelzunge: meist Mark, manchmal ein Freund mit freier Sicht
    _pickTongueTarget(player, world) {
        if (Math.random() < 0.4) {
            const mx = this.centerX(), my = this.centerY();
            const opts = [];
            for (const c of ToadArt.companions()) {
                const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                if (Math.hypot(cx - mx, cy - my) > 320) continue;
                if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my, cx, cy)) continue;
                opts.push(c);
            }
            if (opts.length) return opts[Math.floor(Math.random() * opts.length)];
        }
        return player;
    }

    // Warnlinie: vom Kopf-Mund übers Ziel hinaus, höchstens 200, im Raum gequetscht
    _aimTongue(world, player, px, py) {
        const tg = this.aimTg && !this.aimTg.dead && !(this.aimTg.koTimer > 0) ? this.aimTg : player;
        this.aimTg = tg;
        const m = this._mouth(this.aimHead);
        const tx = tg === player ? px : tg.x + (tg.w || 20) / 2;
        const ty = tg === player ? py : tg.y + (tg.h || 20) / 2;
        let a = Math.atan2(ty - m.y, tx - m.x);
        let len = clamp(Math.hypot(tx - m.x, ty - m.y) + 26, 70, TOAD_TONGUE_LEN);
        let ex = m.x + Math.cos(a) * len, ey = m.y + Math.sin(a) * len;
        const r = this._room;
        if (r) {
            ex = clamp(ex, r.x + 12, r.x + r.w - 12);
            ey = clamp(ey, r.y + 12, r.y + r.h - 12);
            len = Math.max(60, Math.hypot(ex - m.x, ey - m.y));
            a = Math.atan2(ey - m.y, ex - m.x);
        }
        this.aimA = a;
        this.aimLen = len;
    }

    _launchTongue(world) {
        const m = this._mouth(this.aimHead);
        this.tongue.on = true;
        this.tongue.head = this.aimHead;
        this.tongue.bx = m.x;
        this.tongue.by = m.y;
        this.tongue.a = this.aimA;
        this.tongue.len = this.aimLen;
        this.tongue.ext = 0;
        this.tongue.hit.length = 0;
        this.face = Math.abs(Math.cos(this.aimA)) > 0.25 ? (Math.cos(this.aimA) > 0 ? 1 : -1) : this.face;
        ToadArt.burst(m.x, m.y, [TOAD_TONGUE, '#ffffff'], 6, 90, 0.3, { kind: 'spark' });
        ToadArt.shake(2.5, 0.12);
        this._set('tongueStrike', 0.5);
    }

    // Zunge ausfahren, zurückschlagen, Treffer prüfen (Mark und Freunde, je ein Mal je Angriff)
    _updateTongue(dt, player) {
        const g = this.tongue;
        if (!g.on || this.dead) return;
        const q = 1 - this.stateT / 0.5;
        g.ext = q < 0.36 ? q / 0.36 : 1 - clamp((q - 0.36) / 0.64, 0, 1);
        const tipX = g.bx + Math.cos(g.a) * g.len * g.ext;
        const tipY = g.by + Math.sin(g.a) * g.len * g.ext;
        g.tipX = tipX;
        g.tipY = tipY;
        if (g.ext < 0.35) return;
        // Mark: Segment-Abstand vom Zungenkörper
        if (player && !player.dead && g.hit.indexOf(player) < 0) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (this._segDist(px, py, g.bx, g.by, tipX, tipY) < 12 + player.w / 2) {
                g.hit.push(player);
                ToadArt.hurt(player, 1, Math.atan2(py - g.by, px - g.bx), 340);
                ToadArt.burst(px, py, [TOAD_TONGUE, '#ffffff'], 10, 160, 0.4, { kind: 'spark' });
            }
        }
        for (const c of ToadArt.companions()) {
            if (g.hit.indexOf(c) >= 0) continue;
            const cw = c.w || 20, ch = c.h || 20;
            const cx = c.x + cw / 2, cy = c.y + ch / 2;
            if (this._segDist(cx, cy, g.bx, g.by, tipX, tipY) < 12 + Math.max(cw, ch) / 2) {
                g.hit.push(c);
                ToadArt.hitCompanion(c, 1);
            }
        }
    }

    _segDist(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
        return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
    }

    // Eine Salven-Welle: alle drei Köpfe spucken 3 Schleimkugeln im Fächer auf Marks aktuelle Position
    _spitWave(projectiles, px, py, world) {
        const list = ToadArt.shotList(projectiles);
        if (!list) return;
        for (let i = 0; i < 3; i++) {
            const m = this._mouth(i);
            const a0 = Math.atan2(py - m.y, px - m.x);
            if (list.length > TOAD_MAX_SHOTS) break;
            for (let j = -1; j <= 1; j++) {
                if (list.length > TOAD_MAX_SHOTS) break;
                list.push(new ToadSlimeBall(m.x, m.y, a0 + j * (this.phase === 2 ? 0.3 : 0.26), 165));
            }
            ToadArt.burst(m.x, m.y, [TOAD_SLIME, TOAD_SLIME_GLOW], 4, 70, 0.25, { kind: 'spark' });
        }
        // Phase 2: vor der Kröte bleiben zwei Pfützen liegen (verlangsamen)
        if (this.phase === 2) {
            const bx = this.centerX(), by = this.centerY();
            const a = Math.atan2(py - by, px - bx);
            for (const s of [-0.5, 0.5]) {
                const d = randRange(85, 135);
                let x = bx + Math.cos(a + s) * d, y = by + Math.sin(a + s) * d;
                const r = this._room;
                if (r) {
                    x = clamp(x, r.x + 26, r.x + r.w - 26);
                    y = clamp(y, r.y + 26, r.y + r.h - 26);
                }
                if (this.puddles.length < 6) this.puddles.push({ x, y, r: 30, life: 5, seed: Math.random() * 10 });
            }
        }
    }

    // Pfützen: kurz sichtbar, verlangsamen Mark darin
    _updatePuddles(dt, player) {
        if (!this.puddles.length) return;
        for (const p of this.puddles) {
            p.life -= dt;
            if (player && !player.dead && typeof player.applySlow === 'function') {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                if (Math.hypot(px - p.x, py - p.y) < p.r + player.w / 3) player.applySlow(0.3, 0.6);
            }
        }
        compactInPlace(this.puddles, p => p.life > 0);
    }

    // Kaulquappen-Helfer: nur im Boss-Raum, höchstens 4 gleichzeitig, verpuffen mit der Kröte
    _spawnPup(world) {
        this.pups = this.pups.filter(p => !p.dead);
        if (this.pups.length >= 4) {
            ToadArt.burst(this.centerX(), this.y + this.h - 10, [TOAD_SLIME, '#ffffff'], 6, 80, 0.4, { kind: 'spark' });
            return;
        }
        const a = Math.random() * TAU;
        let x = this.centerX() + Math.cos(a) * 46, y = this.centerY() + Math.sin(a) * 34;
        const r = ToadArt.room(world);
        if (r) {
            x = clamp(x, r.x + 14, r.x + r.w - 32);
            y = clamp(y, r.y + 14, r.y + r.h - 30);
        }
        const pup = new ToadPup(x, y, this);
        this.pups.push(pup);
        if (typeof Game !== 'undefined' && Game.enemies) Game.enemies.push(pup);
        ToadArt.burst(x, y, [TOAD_SLIME, '#bfe8c8', '#ffffff'], 10, 110, 0.45, { kind: 'spark' });
    }

    // ── Bodenwarnungen und Pfützen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        const prev = ctx.globalAlpha;
        // Schleimpfützen: wabbelige grüne Flatten, die langsam verduften
        for (const p of this.puddles) {
            const s = camera.worldToScreen(p.x, p.y);
            const fade = clamp(p.life / 1.2, 0, 1);
            const wob = 1 + Math.sin(Art.time * 3 + p.seed) * 0.07;
            ctx.fillStyle = TOAD_SLIME_DARK;
            ctx.globalAlpha = prev * 0.38 * fade;
            ctx.beginPath();
            ctx.ellipse(s.x, s.y, p.r * wob, p.r * 0.5 * wob, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = prev * 0.55 * fade;
            ctx.strokeStyle = TOAD_SLIME;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = prev * 0.5 * fade;
            ctx.fillStyle = TOAD_SLIME_GLOW;
            ctx.beginPath();
            ctx.arc(s.x + Math.sin(Art.time * 2 + p.seed) * 9, s.y - 2, 2.4, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = prev;
        if (this.state === 'tongueAim') {
            // Warnlinie: genau dort schlägt die Zunge gleich ein
            const m = this._mouth(this.aimHead);
            const p = camera.worldToScreen(m.x, m.y);
            LateWorldArt.lane(ctx, p.x, p.y, this.aimA, this.aimLen + 14, 24, this._k());
        } else if (this.state === 'salveCharge') {
            // drei Fächer: aus jedem Kopf kommen gleich drei Kugeln
            const k = this._k();
            for (let i = 0; i < 3; i++) {
                const m = this._mouth(i);
                const p = camera.worldToScreen(m.x, m.y);
                LateWorldArt.rays(ctx, p.x, p.y, 3, (this.salveA || 0) - 0.26, 26, 190, k);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, by - 50);
        ctx.translate(cx, by);
        this._drawBody(ctx);
        ctx.restore();
    }

    // Welt → lokale Zeichenkoordinaten (Fußpunkt = 0,0; worldToScreen ist reine Verschiebung)
    _lx(wx) { return wx - this.centerX(); }
    _ly(wy) { return wy - (this.y + this.h); }

    // Haltung aus dem Zustand (nur Darstellung): Blähen, offenes Maul, Zunge
    _drawBody(ctx) {
        const t = Art.time, f = this.face, p2 = this.phase === 2, dead = this.dead;
        const st = dead ? 'dead' : this.state, k = this._k();
        let puff = 0, open = 0, openHead = -1;
        if (st === 'salveCharge') puff = k;
        else if (st === 'salve') puff = 1 - k * 0.6;
        else if (st === 'summon') puff = Math.sin(k * Math.PI) * 0.7;
        else if (st === 'intro') puff = 0.5 + 0.5 * Math.sin(t * 5);
        if (st === 'tongueAim') { open = this._k(); openHead = this.aimHead; }
        else if (st === 'tongueStrike') { open = this.tongue.on ? 1 : 0.4; openHead = this.tongue.head; }
        else if (st === 'roar') { open = Math.sin(k * Math.PI); openHead = -1; }
        const bs = Math.sin(t * (p2 ? 3.2 : 2.1) + this.seed);
        if (p2 && !dead) Art.glow(ctx, 0, -46, 84, TOAD_SLIME_GLOW, 0.15 + 0.06 * Math.sin(t * 4));
        ctx.save();
        ctx.scale(1 + bs * 0.02 + puff * 0.07, 1 - bs * 0.016 - puff * 0.04);
        // gespreizte Krötenbeine mit Zehenspitzen
        for (const s of [-1, 1]) {
            Art.body(ctx, s * 30, -8, 13, 8, Art.dark(TOAD_GREEN, 0.14), { lineWidth: 2, highlight: false });
            ctx.fillStyle = Art.dark(TOAD_GREEN, 0.22);
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) ctx.ellipse(s * 30 + i * 6, -2.5, 3.4, 2.4, 0, 0, TAU);
            ctx.fill();
        }
        // wuchtiger warziger Körper
        const green = p2 ? '#57a83e' : TOAD_GREEN;
        Art.body(ctx, 0, -23, 42, 23, green, { lineWidth: 2.4 });
        Art.body(ctx, f * 4, -15, 27, 12, TOAD_BELLY, { lineWidth: 1.8, highlight: false });
        // Warzen und Flecken (Lage im Konstruktor festgelegt)
        ctx.fillStyle = TOAD_GREEN_DARK;
        ctx.beginPath();
        for (const s of this.specks) {
            ctx.moveTo(s.x + s.r, -23 + s.y * 0.7);
            ctx.arc(s.x, -23 + s.y * 0.7, s.r, 0, TAU);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,70,30,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-20, -34);
        ctx.quadraticCurveTo(-14, -37, -8, -34);
        ctx.moveTo(12, -38);
        ctx.quadraticCurveTo(18, -41, 24, -38);
        ctx.stroke();
        // Zunge (hinter den Köpfen, aus dem Maul des Zielkopps)
        const g = this.tongue;
        if (g.on && !dead && g.ext > 0.02) {
            const mx = g.head * 0 + this.heads[g.head].dx + f * 6, my = -52;
            const tx = this._lx(g.tipX), ty = this._ly(g.tipY);
            Art.limb(ctx, mx, my, tx, ty, 5.5, TOAD_TONGUE, { lineWidth: 1.8, outline: TOAD_TONGUE_DARK });
            Art.body(ctx, tx, ty, 6.5, 5, TOAD_TONGUE, { lineWidth: 1.6, outline: TOAD_TONGUE_DARK });
            if (g.ext > 0.8) {
                ctx.fillStyle = 'rgba(255,200,220,0.8)';
                ctx.beginPath();
                ctx.arc(tx - 2, ty - 1.5, 1.8, 0, TAU);
                ctx.fill();
            }
        }
        // die drei Köpfe nebeneinander
        for (let i = 0; i < 3; i++) this._drawHead(ctx, i, green, openHead === -1 ? open : (openHead === i ? open : 0), f, dead, p2);
        // Phase 2: Dampfwölkchen aus den Nüstern
        if (p2 && !dead) {
            ctx.fillStyle = 'rgba(220,255,200,0.35)';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.7 + i * 0.33 + this.seed * 0.1) % 1;
                ctx.beginPath();
                ctx.arc(this.heads[i].dx + f * 6, -58 - q * 16, 2 + q * 4, 0, TAU);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Ein Krötenkopf: Kugel mit Augenwarsten, breitem Maul; offenes Maul zeigt Zähne-Flex und Zungenansatz
    _drawHead(ctx, i, green, open, f, dead, p2) {
        const hd = this.heads[i];
        const hx = hd.dx, hy = i === 1 ? -64 : -58;
        // Halswulst
        Art.body(ctx, hx * 0.92, hy + 9, 13, 8, Art.dark(green, 0.08), { lineWidth: 1.8, highlight: false });
        Art.body(ctx, hx, hy, 14.5, 12.5, green, { lineWidth: 2.2, glossy: i === 1 });
        // Augenwarsten
        for (const s of [-1, 1]) Art.body(ctx, hx + s * 6.4, hy - 8.6, 4.8, 4.4, green, { lineWidth: 1.6 });
        if (dead) {
            LateWorldArt.xEyes(ctx, hx, hy - 8.2, 1.7, 6.4);
        } else {
            Art.eyes(ctx, hx + f * 1, hy - 8.2, i === 1 ? 3.4 : 2.9, {
                gap: 6.4, look: this.look, angry: true, iris: hd.iris, seed: hd.seed,
                brow: p2 ? '#4a1a20' : Art.ink(green),
            });
        }
        // Maul: breit und grimmig, offen mit dunkler Höhle
        const mo = hx + f * 4, my = hy + 6.5;
        if (open > 0.12) {
            const oh = 3 + open * 6.5;
            ctx.fillStyle = '#3a1020';
            ctx.beginPath();
            ctx.ellipse(mo, my + oh * 0.3, 8.5, oh, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = Art.ink(green);
            ctx.lineWidth = 1.6;
            ctx.stroke();
            // Zungenansatz im offenen Maul
            ctx.fillStyle = TOAD_TONGUE;
            ctx.beginPath();
            ctx.ellipse(mo + f * 1, my + oh * 0.75, 4, 2 + open * 1.5, 0, 0, TAU);
            ctx.fill();
            // Unterkiefer
            Art.body(ctx, mo, my + oh * 0.9, 8, 2.6, Art.light(green, 0.12), { lineWidth: 1.4, highlight: false });
        } else {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(mo - 8, my);
            ctx.quadraticCurveTo(mo + f * 1, my + 2.6, mo + 8, my - 1);
            ctx.stroke();
        }
        // Nasenlöcher
        ctx.fillStyle = TOAD_GREEN_DARK;
        ctx.beginPath();
        ctx.arc(mo + f * 3.6, hy - 2.4, 0.9, 0, TAU);
        ctx.arc(mo + f * 1.2, hy - 3, 0.9, 0, TAU);
        ctx.fill();
    }
}

