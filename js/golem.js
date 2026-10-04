// ── Welt 38: Glutberg (Idee von Leander) ──
// Feuergolems: gedrungen Golems aus dunklem Fels mit glühenden Lavaritzen, großen Steinfäusten und
//   leuchtenden Augen. Sie tappen langsam auf Mark ODER Juri bzw. das Krokodil zu (wer näher ist), holen
//   sichtbar mit einem Arm aus (~0,6 s, Faust glüht, Warnkreis am Boden) und schlagen mit der Faust auf den
//   Boden. Kein Berührungsschaden: gefährlich ist nur der Fausthieb. Freunde, die der Hieb besiegen würde,
//   werden nur umgehauen (knockOut) – sie verschwinden nie.
// Riesen-Feuergolem (Boss, 135 LP): riesiger Lavagolem mit Flammen auf Schultern und Kopf, glühende Ritzen
//   im Fels. Stampfen: hebt den Fuß (Warnkreis, ~0,8 s), stampft → Schockwelle über den Boden und kurz
//   brennende Bodenflecken. Feuerspucken: lädt (Maul glüht, Warnkegel 0,9 s), spuckt einen Feuerkegel in
//   Richtung Mark, der leicht mitschwenkt. Nach jedem großen Angriff eine deutliche Verschnaufpause.
//   Phase 2 (halbe LP): Gebrüll, die Ritzen glühen heller, alles wird schneller; das Stampfen kommt
//   zweimal, das Feuerspucken trifft zwei Ziele, und der Golem ruft Lavaknollen herbei (höchstens vier
//   gleichzeitig, nur im Boss-Raum – sie verpuffen, wenn der Boss besiegt ist).

// Alle Konstanten und Helfer der Welt 38 stecken in Namen mit Präfix „Golem“, damit es mit keinen
// anderen Welten kracht.
const GolemCfg = {
    // normaler Feuergolem
    G_HP: 8,                    // etwas zäher als andere Gegner
    G_SPEED_MIN: 38, G_SPEED_MAX: 46,
    G_WINDUP: 0.6,              // Ausholen (Warnung) vor dem Faustschlag
    G_SMASH: 0.14,              // Schwung nach unten
    G_RECOVER: 0.6,             // Faust liegt kurz am Boden
    G_REACH: 22,                // Aufschlagpunkt vor dem Golem
    G_HIT_R: 20,                // Trefferradius um den Aufschlagpunkt
    G_DMG: 2,                   // halbes Herz
    //_shared Fels und Lava
    ROCK: '#5b5163',
    ROCK_DARK: '#413949',
    LAVA: '#ff7a1f',
    LAVA_CORE: '#ffd23f',
    // Boss
    B_HP: 135,
    B_SPEED: 30,
    B_SLAM_R: 56,               // Schaden direkt beim Aufstampfen um den Fuß
    B_FOOT_X: 34,               // Fuß seitlich der Mitte
    B_WAVE_SPEED: 200,
    B_WAVE_BAND: 12,            // halbe Breite der Schockwelle
    B_DMG: 2,
    B_SPIT_CHARGE: 0.9,         // Warnkegel-Ladezeit
    B_SPIT_TIME: 0.95,          // Dauer des Flammenstroms
    B_SPIT_RANGE: 150,
    B_SPIT_ARC: 0.7,            // volle Öffnung des Kegels (Radiant)
    B_SPIT_SWEEP: 0.55,         // rad/s – der Strahl schwenkt nur leicht mit
    B_BURN_TIME: 2.2,           // Bodenflecken brennen kurz
    B_BURN_R: 16,
    B_MAX_HELPERS: 4,           // Lavaknollen gleichzeitig
};

// Gemeinsame Helfer der Welt 38 (nur Lese-/Wirk-Helfer, keine Zeichen-Verbote)
const GolemArt = {
    ease(k) {
        k = clamp(k, 0, 1);
        return k * k * (3 - 2 * k);
    },

    // Winkel sanft zum Zielwinkel schieben (kürzeste Drehung, höchstens max Schrittweite)
    angStep(a, b, max) {
        let d = b - a;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        return a + clamp(d, -max, max);
    },

    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine (Galerie) direkt.
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && typeof Game.hurtPlayer === 'function') {
            Game.hurtPlayer(amount, angle, force);
        } else if (player && player.takeDamage) {
            player.takeDamage(amount, angle, force);
        }
    },

    // Begleiter, die getroffen werden können (Juri, Krokodil – nicht die Schlange auf Marks Schulter)
    friends() {
        const out = [];
        const comps = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of comps) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Freund treffen: Schaden, aber nie verschwinden – statt besiegt nur umgehauen (wie beim Drachenstrahl)
    hitFriend(c, dmg) {
        if (!c || c.dead || c.koTimer > 0 || c.iFrames > 0) return false;
        if (c.hp - dmg <= 0) c.knockOut(6);
        else c.takeDamage(dmg);
        GolemArt.burst(c.x + c.w / 2, c.y + c.h / 2, ['#ffb020', '#ffffff', '#ff5a1f'], 8, 120, 0.4, { kind: 'star' });
        return true;
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

    // Flammenzunge mit Fuß bei (x, y), Höhe ~ s * 1.8, neigt sich um lean (Stil der Glutschmiede)
    flame(ctx, x, y, s, lean, flick) {
        const h = s * (1.7 + flick * 0.35);
        ctx.fillStyle = GolemCfg.LAVA;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.55, y);
        ctx.quadraticCurveTo(x - s * 0.7, y - h * 0.5, x + lean, y - h);
        ctx.quadraticCurveTo(x + s * 0.7, y - h * 0.5, x + s * 0.55, y);
        ctx.quadraticCurveTo(x, y + s * 0.3, x - s * 0.55, y);
        ctx.fill();
        ctx.fillStyle = GolemCfg.LAVA_CORE;
        ctx.beginPath();
        ctx.moveTo(x - s * 0.3, y);
        ctx.quadraticCurveTo(x - s * 0.35, y - h * 0.35, x + lean * 0.6, y - h * 0.62);
        ctx.quadraticCurveTo(x + s * 0.35, y - h * 0.35, x + s * 0.3, y);
        ctx.closePath();
        ctx.fill();
    },

    // Warn- bzw. Feuerkegel am Boden (für drawUnder): Sektor von (x,y) in Richtung a
    cone(ctx, x, y, a, arc, len, k, color, fillAlpha, edgePulse) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        const prev = ctx.globalAlpha;
        ctx.fillStyle = color;
        ctx.globalAlpha = prev * fillAlpha;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, Math.max(6, len), -arc / 2, arc / 2);
        ctx.closePath();
        ctx.fill();
        if (edgePulse > 0) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.2;
            ctx.globalAlpha = prev * edgePulse;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, Math.max(6, len), -arc / 2, arc / 2);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.globalAlpha = prev;
        ctx.restore();
    },

    // Glühende Lavaritzen: ein Pfad, dreifach überstrichen (glimmend, Lava, heller Kern)
    cracks(ctx, segs, glow) {
        const draw = (w, col, alpha) => {
            ctx.beginPath();
            for (const s of segs) {
                ctx.moveTo(s[0], s[1]);
                for (let i = 2; i < s.length; i += 2) ctx.lineTo(s[i], s[i + 1]);
            }
            ctx.lineWidth = w;
            ctx.strokeStyle = col;
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * alpha;
            ctx.stroke();
            ctx.globalAlpha = prev;
        };
        draw(5, '#c8401a', 0.55 + 0.35 * glow);
        draw(2.4, GolemCfg.LAVA, 0.8);
        draw(1, GolemCfg.LAVA_CORE, 0.55 + 0.4 * glow);
    },
};

// ══════════════════════════════════════════
// ── Lavabrocken-Geschoss (Lavaknollen werfen gelegentlich) ──
// ══════════════════════════════════════════

// Langsamer Brocken: 1 Schaden für Mark, fliegt an Juri und dem Krokodil vorbei (wie die Salven in
// Welt 29 – sonst lägen die Freunde ständig benommen herum).
class GolemLavaBit extends Projectile {
    constructor(x, y, angle, speed, o = {}) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 80);
        this.radius = o.radius || 5.5;
        this.lifetime = o.life || 2.3;
        this.fromBoss = !!o.fromBoss;
        this.seed = Math.floor(Math.random() * 100);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const born = Math.min(1, this.age * 8);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * clamp(this.lifetime / 0.25, 0, 1);
        Art.glow(ctx, p.x, p.y, 14 * born, GolemCfg.LAVA, 0.7);
        ctx.fillStyle = '#ff6a1f';
        ctx.beginPath();
        const t = Art.time * 9 + this.seed;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            const r = this.radius * born * (0.85 + 0.3 * Math.sin(t + i * 2.3));
            const px = p.x + Math.cos(a) * r, py = p.y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = GolemCfg.LAVA_CORE;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.radius * 0.45 * born, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// ── Feuergolem ──
// ══════════════════════════════════════════

// Gedrungener Fels-Golem (Hitbox 28×26) mit großen Steinfäusten. Zustände: walk → windup (0,6 s Ausholen,
// Faust glüht, Warnkreis) → smash (Faustschlag) → recover. Ziel: Mark oder ein Freund, wer näher ist.
class FireGolem extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.w = 28;
        this.h = 26;
        this.hp = GolemCfg.G_HP;
        this.maxHp = GolemCfg.G_HP;
        this.speed = randRange(GolemCfg.G_SPEED_MIN, GolemCfg.G_SPEED_MAX);
        this.damage = GolemCfg.G_DMG;
        this.contactDamage = false;           // gefährlich ist nur der Faustschlag
        this.phasesThroughWalls = false;      // Golems laufen am Boden, durch keine Wand
        this.flying = false;
        this.detectionRange = 240;
        this.fxColor = GolemCfg.LAVA;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.engaged = false;
        this.moving = false;
        this.target = null;
        this.retargetT = 0;
        this.cooldown = randRange(0.2, 0.8);
        this.hitX = 0;                        // Aufschlagpunkt des laufenden Schlages (Welt)
        this.hitY = 0;
        this.walkT = Math.random() * 3;
        this.wanderT = randRange(0.3, 2);
        this.wx = 0;
        this.wy = 0;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Nächstes Ziel: Mark oder ein wacher Freund
    _pickTarget(player) {
        const mx = this.centerX(), my = this.centerY();
        let best = player && !player.dead ? player : null;
        let bd = best ? Math.hypot(player.x + player.w / 2 - mx, player.y + player.h / 2 - my) : Infinity;
        for (const c of GolemArt.friends()) {
            const d = Math.hypot(c.x + c.w / 2 - mx, c.y + c.h / 2 - my);
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.cooldown > 0) this.cooldown -= dt;
        this.moving = false;

        // Ausholen und Zuschlagen laufen unabhängig vom Ziel weiter (Richtung steht beim Ausholen fest)
        if (this.state !== 'walk') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                if (this.state === 'windup') this._set('smash', GolemCfg.G_SMASH);
                else if (this.state === 'smash') { this._smash(player); this._set('recover', GolemCfg.G_RECOVER); }
                else { this._set('walk', 0); this.cooldown = randRange(0.35, 0.7); }
            }
            return;
        }

        this.retargetT -= dt;
        if (this.retargetT <= 0 || !this.target || this.target.dead || this.target.koTimer > 0) {
            this.target = this._pickTarget(player);
            this.retargetT = 0.4;
        }
        const tg = this.target;
        let dist = Infinity, dx = 0, dy = 0;
        if (tg) {
            dx = tg.x + tg.w / 2 - this.centerX();
            dy = tg.y + tg.h / 2 - this.centerY();
            dist = Math.hypot(dx, dy) || 1;
        }
        if (!tg) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 60) this.engaged = false;

        if (this.engaged) {
            if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
            this._look(dx / dist, dy / dist, dt);
            if (dist < 36 && this.cooldown <= 0) {
                // Ausholen: Aufschlagpunkt steht jetzt fest – wer rechtzeitig wegläuft, wird nicht getroffen
                this.hitX = this.centerX() + (dx / dist) * GolemCfg.G_REACH;
                this.hitY = this.centerY() + (dy / dist) * GolemCfg.G_REACH;
                if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
                this._set('windup', GolemCfg.G_WINDUP);
                return;
            }
            if (dist > 26) {
                const ox = this.x, oy = this.y;
                this.walkT += dt;
                this._moveWithCollision((dx / dist) * this.speed * dt, (dy / dist) * this.speed * dt, world);
                this.moving = Math.hypot(this.x - ox, this.y - oy) > 0.01;
            }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.4, 3.2);
                if (Math.random() < 0.4) {
                    this.wx = 0;
                    this.wy = 0;
                } else {
                    const a = Math.random() * TAU;
                    this.wx = Math.cos(a);
                    this.wy = Math.sin(a);
                }
            }
            if (this.wx || this.wy) {
                const ox = this.x, oy = this.y;
                this.walkT += dt;
                this._moveWithCollision(this.wx * this.speed * 0.4 * dt, this.wy * this.speed * 0.4 * dt, world);
                this.moving = Math.hypot(this.x - ox, this.y - oy) > 0.01;
                if (Math.abs(this.wx) > 0.2) this.face = this.wx > 0 ? 1 : -1;
            }
            this._look(this.wx * 0.6, this.wy * 0.6 + 0.2, dt);
        }
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    // Faust kracht auf den Boden: trifft Mark und Freunde nahe am Aufschlagpunkt
    _smash(player) {
        const x = this.hitX, y = this.hitY;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - x, py - y) < GolemCfg.G_HIT_R + 6) {
                GolemArt.hurt(player, GolemCfg.G_DMG, Math.atan2(py - this.centerY(), px - this.centerX()), 210);
            }
        }
        for (const c of GolemArt.friends()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - x, cy - y) < GolemCfg.G_HIT_R + Math.max(c.w, c.h) * 0.3) GolemArt.hitFriend(c, GolemCfg.G_DMG);
        }
        GolemArt.burst(x, y + 4, [GolemCfg.LAVA_CORE, GolemCfg.LAVA, '#ffffff'], 8, 130, 0.35, { kind: 'spark' });
        GolemArt.burst(x, y + 4, 'rgba(255,220,190,0.8)', 3, 50, 0.35, { kind: 'smoke', size: 3.5 });
        GolemArt.shake(1.8, 0.1);
    }

    // Warnkreis unter dem Aufschlagpunkt (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead || (this.state !== 'windup' && this.state !== 'smash')) return;
        const k = this.state === 'windup' ? clamp(1 - this.stateT / GolemCfg.G_WINDUP, 0, 1) : 1;
        const p = camera.worldToScreen(this.hitX, this.hitY + 4);
        LateWorldArt.warn(ctx, p.x, p.y, GolemCfg.G_HIT_R, k, '#ff5a1f');
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (!LateWorldArt.deathPop(ctx, this, cx, by - 13)) { ctx.restore(); return; }
        }
        ctx.translate(cx, by);
        ctx.scale(this.face, 1);
        this._drawBody(ctx, this.dead);
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 14);
    }

    // Haltung der Schlagfaust (in Blickrichtung +x): Hand (hx, hy), Glühen, Rumpfneigung – nur Darstellung
    _pose() {
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const idle = { hx: 12, hy: -10, hot: 0.12, lean: 0, sq: 0 };
        if (this.state === 'windup') {
            const e = GolemArt.ease(k);
            const shake = k > 0.6 ? Math.sin(Art.time * 46 + this.seed) * 0.8 : 0;
            return { hx: lerp(12, 2, e) + shake, hy: lerp(-10, -24, e), hot: e, lean: -0.12 * e, sq: -0.06 * e };
        }
        if (this.state === 'smash') {
            const e = k * k;
            return { hx: lerp(2, 20, e), hy: lerp(-24, -3, e), hot: 1, lean: 0.16 * e, sq: 0.09 * e };
        }
        if (this.state === 'recover') {
            const e = GolemArt.ease(Math.max(0, (k - 0.45) / 0.55));
            return { hx: lerp(20, 12, e), hy: lerp(-3, -10, e), hot: 1 - k, lean: 0.16 * (1 - e), sq: 0.09 * (1 - e) };
        }
        return idle;
    }

    // Golem mit Füßen bei (0, 0), Blick nach +x. dead = Kreuzaugen.
    _drawBody(ctx, dead) {
        const t = Art.time, sd = this.seed, rock = GolemCfg.ROCK;
        const P = this._pose();
        const glow = this.state === 'windup' || this.state === 'smash' ? P.hot : 0.25 + 0.15 * Math.sin(t * 2.6 + sd);
        const mv = this.moving && !dead;
        const step = mv ? Math.sin(this.walkT * 9) : 0;
        const hop = mv ? Math.abs(step) * 1.2 : Math.sin(t * 2 + sd) * 0.5;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -14, 26, '#ffd23f', 0.4 + 0.12 * Math.sin(t * 3 + sd));
        // Beißen die Ritzen im Takt, leuchtet der ganze Golem schwach warm
        Art.glow(ctx, 0, -14, 22, GolemCfg.LAVA, 0.18 + 0.12 * glow);
        // Füße (Felsklötze)
        const l0 = mv ? Math.max(0, step) * 2 : 0, l1 = mv ? Math.max(0, -step) * 2 : 0;
        ctx.fillStyle = GolemCfg.ROCK_DARK;
        ctx.beginPath();
        ctx.roundRect(-11, -6 - l1, 7, 6, 2);
        ctx.roundRect(4, -6 - l0, 7, 6, 2);
        ctx.fill();
        ctx.save();
        ctx.translate(0, -hop);
        ctx.rotate(P.lean);
        ctx.scale(1 + P.sq, 1 - P.sq);
        // hintere Faust
        LateWorldArt.blob(ctx, -9, -12, 4.4, 4.4, GolemCfg.ROCK_DARK, 1.2);
        // Rumpf: Felsblock mit Lavaritzen
        Art.body(ctx, 0, -14, 13.5, 12, rock, { glossy: true, lineWidth: 1.6, rot: 0.15 });
        GolemArt.cracks(ctx, [
            [-7, -22, -3, -16, -6, -9],
            [2, -24, 5, -17, 2, -10],
            [-9, -13, -1, -11, 6, -14],
        ], glow);
        // Schultern
        LateWorldArt.blob(ctx, -7, -23, 5, 4, Art.dark(rock, 0.06), 1.3);
        LateWorldArt.blob(ctx, 7, -24, 5.4, 4.4, Art.light(rock, 0.06), 1.3);
        // Kopf aus Fels, glühende Augen
        Art.body(ctx, 5, -29, 7.5, 6.4, Art.light(rock, 0.04), { lineWidth: 1.5 });
        Art.glow(ctx, 6.6, -30, 8, GolemCfg.LAVA_CORE, dead ? 0.15 : 0.55 + 0.2 * Math.sin(t * 5 + sd));
        if (dead) LateWorldArt.xEyes(ctx, 6.4, -30, 1.8, 2.9);
        else {
            ctx.fillStyle = GolemCfg.LAVA_CORE;
            ctx.beginPath();
            ctx.ellipse(5, -30.4, 1.5, 1.7, -0.2, 0, TAU);
            ctx.ellipse(8, -30.2, 1.5, 1.7, -0.2, 0, TAU);
            ctx.fill();
        }
        // frech-böser Mund (Zähne aus hellerem Stein)
        ctx.strokeStyle = Art.INK;
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(2.5, -25.4);
        ctx.lineTo(9, -25.4);
        ctx.stroke();
        // Schlagarm mit großer Steinfistel vorn: wird beim Ausholen heiß und schlägt zu
        Art.limb(ctx, 5, -16, P.hx, P.hy, 4.4, rock, { lineWidth: 1.3 });
        if (P.hot > 0.05) Art.glow(ctx, P.hx, P.hy, 14, GolemCfg.LAVA, 0.65 * P.hot);
        Art.body(ctx, P.hx, P.hy, 6, 5.6, Art.light(rock, 0.08), {
            lineWidth: 1.5,
            flat: false,
        });
        if (P.hot > 0.4) {
            // die Faust glüht durch
            ctx.fillStyle = Art.alpha(GolemCfg.LAVA, (P.hot - 0.4) * 1.2);
            ctx.beginPath();
            ctx.arc(P.hx, P.hy, 4.2, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Lavaknolle (ruft der Boss herbei) ──
// ══════════════════════════════════════════

// Kleine glühende Gesteinsknolle, hüpft auf Mark oder einen Freund zu. Verpufft, wenn der Boss besiegt
// ist (wie die gerufenen Hexenkinder, Welt 30), und bleibt stets im Boss-Raum.
class GolemCinder extends Enemy {
    constructor(x, y) {
        super(x, y, 18, 16);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 66;
        this.damage = 1;                    // Berührung brennt kurz
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = GolemCfg.LAVA;
        this.seed = Math.random() * 10;
        this.summoner = null;
        this.t = Math.random() * 10;
        this.throwT = randRange(1.6, 3.2);   // wirft gelegentlich einen Lavabrocken
        this.look = { x: 0, y: 0.4 };
    }

    _aliveFriendOrPlayer(player) {
        let best = player && !player.dead ? player : null;
        let bd = best ? 1e9 : Infinity;
        const mx = this.centerX(), my = this.centerY();
        if (best) bd = Math.hypot(best.x + best.w / 2 - mx, best.y + best.h / 2 - my);
        for (const c of GolemArt.friends()) {
            const d = Math.hypot(c.x + c.w / 2 - mx, c.y + c.h / 2 - my);
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        // Die Knolle gehört zum Boss: besiegt er sie nicht selbst, verpufft sie mit ihm
        if (this.summoner && this.summoner.dead) {
            this.hp = 0;
            this.dead = true;
            this.deathTimer = 0.4;
            GolemArt.burst(this.centerX(), this.centerY(), [GolemCfg.LAVA, '#ffffff'], 8, 90, 0.4, { kind: 'star' });
            return;
        }
        this.t += dt;
        // Bleibt immer im Boss-Raum
        if (typeof Game !== 'undefined' && Game.bossActive && Game._bossRoomRect) {
            const room = Game._bossRoomRect();
            this.x = clamp(this.x, room.x, room.x + room.w - this.w);
            this.y = clamp(this.y, room.y, room.y + room.h - this.h);
        }
        const tg = this._aliveFriendOrPlayer(player);
        if (tg) {
            const dx = tg.x + tg.w / 2 - this.centerX();
            const dy = tg.y + tg.h / 2 - this.centerY();
            const d = Math.hypot(dx, dy) || 1;
            // Hüpfen: mal flott, mal kurz Luft holen
            const v = this.speed * (0.45 + 0.95 * Math.abs(Math.sin(this.t * 5 + this.seed)));
            this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
            const k = Math.min(1, dt * 8);
            this.look.x += (dx / d - this.look.x) * k;
            this.look.y += (dy / d - this.look.y) * k;
            // Brocken nur aus mittlerer Entfernung und nie bei vollem Geschoss-Feld (Handy-last)
            this.throwT -= dt;
            if (this.throwT <= 0 && d > 60 && d < 170 &&
                typeof Game !== 'undefined' && Game.projectiles && Game.projectiles.length < 55) {
                Game.projectiles.push(new GolemLavaBit(
                    this.centerX(), this.centerY() - 8, Math.atan2(dy, dx) + randRange(-0.12, 0.12), 95));
                this.throwT = randRange(2.4, 4);
            } else if (this.throwT <= -1) {
                this.throwT = 0.4;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (!LateWorldArt.deathPop(ctx, this, cx, by - 8)) { ctx.restore(); return; }
        }
        const t = Art.time;
        const hop = this.dead ? 0 : Math.abs(Math.sin(t * 5 + this.seed)) * 2;
        ctx.translate(cx, by - hop);
        Art.glow(ctx, 0, -7, 15, GolemCfg.LAVA, 0.5);
        LateWorldArt.blob(ctx, 0, -7, 8.4, 7, GolemCfg.ROCK, 1.4);
        GolemArt.cracks(ctx, [[-4, -12, -1, -7, -4, -3], [3, -12, 5, -7]], 0.8);
        // Dochtflamm auf dem Kopf
        GolemArt.flame(ctx, 0, -14, 3.4, Math.sin(t * 9 + this.seed) * 1.4, Math.sin(t * 14 + this.seed));
        if (this.dead) LateWorldArt.xEyes(ctx, 0, -8, 1.6, 2.6);
        else Art.eyes(ctx, 0, -8.2, 2.1, { gap: 2.8, look: this.look, angry: true, seed: this.seed, iris: '#ff8a2a' });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 38: Riesen-Feuergolem ──
// ══════════════════════════════════════════

// Hitbox 68×60, Zeichnung ~125 hoch und ~115 breit. Ablauf: Intro → Laufen → Stampfen (Schockwelle +
// brennende Flecken) → Laufen → Feuerspucken → … Phase 2 (halbe LP): alles schneller, Stampfen zweimal,
// Feuerspucken auf zwei Ziele, Lavaknollen werden gerufen.
class BossFireGolem extends Enemy {
    constructor(x, y) {
        super(x, y, 68, 60);
        this.hp = GolemCfg.B_HP;
        this.maxHp = GolemCfg.B_HP;
        this.speed = GolemCfg.B_SPEED;
        this.damage = 1;
        this.contactDamage = true;
        this.isBoss = true;
        this.fxColor = GolemCfg.LAVA;
        this.shadow = { rx: 42, ry: 13 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.state = 'intro';
        this.stateT = 1.8;
        this.stateDur = 1.8;
        this.seq = 0;
        this.stompLeft = 0;
        this.stompSide = 1;
        this.waves = [];          // Schockwellen: {x, y, r, max, hitP, hitC[]}
        this.burns = [];          // brennende Bodenflecken: {x, y, r, t, cd}
        this.spits = [];          // laufende Flammenstrahlen: {ang, target, cd}
        this.spitTargets = [];
        this.spitFx = 0;
        this.cinders = [];        // gerufene Lavaknollen (für die Höchstzahl)
        this._arm = [{ x: 0, y: 0, hot: 0 }, { x: 0, y: 0, hot: 0 }];   // Haltung (nur Zeichnen)
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Ein Riese lässt sich kaum wegschubsen. Besiegt: die Glut erlischt, die Wellen brechen ab.
    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.18);
        if (this.dead && !was) {
            this.waves.length = 0;
            this.burns.length = 0;
            this.spits.length = 0;
        }
    }

    feetX() { return this.centerX(); }
    feetY() { return this.y + this.h - 6; }
    // Ursprung der Feuerkegel (Brustmitte)
    _mouth() { return { x: this.centerX(), y: this.y + 16 }; }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) {
            this._updateHazards(dt, null);
            return;
        }
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._updateHazards(dt, player);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        this._lookAt(px - this.centerX(), py - (this.centerY() - 40), dt);

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', this.phase === 2 ? 0.7 : 1.1);
                break;
            case 'walk':
                this._walk(dt, world, px, py);
                if (this.stateT <= 0) this._nextAttack(player);
                break;
            case 'lift':
                if (this.stateT <= 0) this._set('slam', 0.12);
                break;
            case 'slam':
                if (this.stateT <= 0) {
                    this._stompHit(player);
                    this.stompLeft--;
                    this.stompSide = -this.stompSide;
                    if (this.stompLeft > 0) this._set('lift', this.phase === 2 ? 0.6 : 0.8);
                    else this._set('recover', this.phase === 2 ? 0.7 : 0.95);
                }
                break;
            case 'spitCharge': {
                this._trackAims(dt);
                if (this.stateT <= 0) {
                    this.spits = [];
                    for (const tg of this.spitTargets) this.spits.push({ ang: tg.a2, target: tg.t, cd: 0 });
                    this._set('spit', GolemCfg.B_SPIT_TIME);
                    if (typeof Sound !== 'undefined' && Sound.shoot) Sound.shoot();
                }
                break;
            }
            case 'spit':
                this._updateSpits(dt, player);
                if (this.stateT <= 0) {
                    this.spits.length = 0;
                    this._set('recover', this.phase === 2 ? 0.75 : 1.1);
                }
                break;
            case 'summon':
                if (this.stateT <= 0) {
                    this._summonCinders(world, player);
                    this._set('recover', 0.9);
                }
                break;
            default:            // recover, roar
                if (this.stateT <= 0) this._toWalk();
        }
    }

    _lookAt(dx, dy, dt) {
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 6);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    _toWalk() {
        if (this.phase === 2 && !this.roared) {
            // Wut-Gebrüll beim Wechsel in Phase 2: alle Ritzen glühen hell auf (kein Angriff)
            this.roared = true;
            this._set('roar', 1.0);
            const x = this.centerX(), y = this.y + 20;
            GolemArt.shake(8, 0.55);
            GolemArt.burst(x, y, ['#ff5a1f', GolemCfg.LAVA_CORE, '#ffffff'], 20, 200, 0.6, { kind: 'star' });
            GolemArt.ring(x, this.feetY(), '#ff6a1f', 110, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.7, 1.0) : randRange(1.1, 1.5));
    }

    _aliveCinders() {
        let n = 0;
        for (const c of this.cinders) if (!c.dead) n++;
        return n;
    }

    _nextAttack(player) {
        const p2 = this.phase === 2;
        this.seq++;
        if (p2 && this.seq % 3 === 0 && this._aliveCinders() < GolemCfg.B_MAX_HELPERS) {
            this._set('summon', 0.7);
            return;
        }
        if (this.seq % 2 === 1) {
            // Stampfen: Warnkreis unter dem gehobenen Fuß, Phase 2 tritt zweimal
            this.stompLeft = p2 ? 2 : 1;
            this.stompSide = player && player.x + player.w / 2 >= this.centerX() ? 1 : -1;
            this._set('lift', p2 ? 0.6 : 0.85);
        } else {
            this._beginSpit(player);
        }
    }

    // Stapft auf Mark zu (mit Wandkollision), bleibt stets im Boss-Raum und auf Abstand
    _walk(dt, world, px, py) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d < 96) return;
        this.walkT += dt * (this.phase === 2 ? 1.3 : 1);
        const s = Math.sin(this.walkT * 3.2);
        const v = this.speed * (this.phase === 2 ? 1.35 : 1) * (0.55 + 0.9 * s * s);
        this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
        this._clampToRoom();
        this.moving = true;
    }

    _clampToRoom() {
        if (typeof Game === 'undefined' || !Game.bossActive || !Game._bossRoomRect) return;
        const room = Game._bossRoomRect();
        this.x = clamp(this.x, room.x + 4, Math.max(room.x + 4, room.x + room.w - 4 - this.w));
        this.y = clamp(this.y, room.y + 4, Math.max(room.y + 4, room.y + room.h - 4 - this.h));
    }

    // ── a) Stampfen ──

    _stompPoint(side) {
        return { x: this.feetX() + side * GolemCfg.B_FOOT_X, y: this.feetY() - 2 };
    }

    _stompHit(player) {
        const p = this._stompPoint(this.stompSide);
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - p.x, py - p.y) < GolemCfg.B_SLAM_R + 8) {
                GolemArt.hurt(player, GolemCfg.B_DMG, Math.atan2(py - this.centerY(), px - this.centerX()), 230);
            }
        }
        for (const c of GolemArt.friends()) {
            if (Math.hypot(c.x + c.w / 2 - p.x, c.y + c.h / 2 - p.y) < GolemCfg.B_SLAM_R + 8) GolemArt.hitFriend(c, GolemCfg.B_DMG);
        }
        // Schockwelle über den Boden
        this.waves.push({
            x: this.feetX(), y: this.feetY(), r: 30,
            max: this.phase === 2 ? 175 : 150, hitP: false, hitC: [],
        });
        // kurz brennende Bodenflecken rund um den Aufprall
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * TAU + this.seed + this.t;
            const dd = randRange(58, 105);
            this.burns.push({
                x: this.feetX() + Math.cos(a) * dd,
                y: this.feetY() + Math.sin(a) * dd * 0.7,
                r: GolemCfg.B_BURN_R, t: GolemCfg.B_BURN_TIME, cd: 0.35,
            });
        }
        this.burns.push({ x: p.x, y: p.y + 6, r: GolemCfg.B_BURN_R, t: GolemCfg.B_BURN_TIME, cd: 0.35 });
        GolemArt.shake(this.phase === 2 ? 8 : 6.5, 0.32);
        GolemArt.burst(p.x, p.y, [GolemCfg.LAVA_CORE, GolemCfg.LAVA, '#ffffff'], 12, 190, 0.45, { kind: 'spark' });
        GolemArt.burst(p.x, p.y, 'rgba(255,215,185,0.85)', 5, 70, 0.5, { kind: 'smoke', size: 5 });
        GolemArt.ring(p.x, p.y, '#ffb347', 52, 0.3, 5);
        if (typeof Sound !== 'undefined' && Sound.explosion) Sound.explosion();
    }

    // Wellen wachsen und treffen jeden höchstens einmal; Flecken brennen periodisch.
    _updateHazards(dt, player) {
        for (const w of this.waves) {
            w.r = Math.min(w.max, w.r + GolemCfg.B_WAVE_SPEED * dt);
            if (!player) continue;
            const band = GolemCfg.B_WAVE_BAND;
            if (!w.hitP && !player.dead && player.iFrames <= 0) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                if (Math.abs(Math.hypot(px - w.x, py - w.y) - w.r) < band + player.w / 2) {
                    w.hitP = true;
                    GolemArt.hurt(player, 1, Math.atan2(py - w.y, px - w.x), 170);
                }
            }
            for (const c of GolemArt.friends()) {
                if (w.hitC.indexOf(c) >= 0) continue;
                const d = Math.hypot(c.x + c.w / 2 - w.x, c.y + c.h / 2 - w.y);
                if (Math.abs(d - w.r) < band + Math.max(c.w, c.h) / 2 && GolemArt.hitFriend(c, 1)) w.hitC.push(c);
            }
        }
        compactInPlace(this.waves, w => w.r < w.max);
        for (const b of this.burns) {
            b.t -= dt;
            b.cd -= dt;
            if (!player || b.cd > 0) continue;
            let burnt = false;
            if (!player.dead && player.iFrames <= 0) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                if (Math.hypot(px - b.x, py - b.y) < b.r + 6) {
                    GolemArt.hurt(player, 1, Math.atan2(py - b.y, px - b.x), 60);
                    burnt = true;
                }
            }
            for (const c of GolemArt.friends()) {
                if (Math.hypot(c.x + c.w / 2 - b.x, c.y + c.h / 2 - b.y) < b.r + Math.max(c.w, c.h) * 0.3) {
                    if (GolemArt.hitFriend(c, 1)) burnt = true;
                }
            }
            if (burnt) b.cd = 0.5;
        }
        compactInPlace(this.burns, b => b.t > 0);
    }

    // ── b) Feuerspucken ──

    // Ziele: Mark und (Phase 2) der nächste wache Freund; Ladezeit = Warnzeit für Kinder
    _beginSpit(player) {
        this.spitTargets = [];
        const m = this._mouth();
        const add = (t, off) => {
            if (!t || t.dead || t.koTimer > 0) return;
            const a = Math.atan2(t.y + t.h / 2 - m.y, t.x + t.w / 2 - m.x);
            this.spitTargets.push({ t, off, a2: a + off });
        };
        add(player, 0);
        if (this.phase === 2) {
            const fs = GolemArt.friends();
            if (fs.length) add(fs[0], 0);
            else if (player && !player.dead) {
                // kein Freund wach: zwei Strahlen treffen Mark als Fächer
                this.spitTargets[0].off = -0.5;
                this.spitTargets[0].a2 -= 0.5;
                const a = this.spitTargets[0].a2 + 1.0;
                this.spitTargets.push({ t: player, off: 0.5, a2: a });
            }
        }
        if (!this.spitTargets.length) { this._set('recover', 0.6); return; }
        this._set('spitCharge', GolemCfg.B_SPIT_CHARGE);
    }

    // Während des Ladens folgt jeder Zielwinkel weich seinem Ziel (Vorwarnung, noch gefahrlos)
    _trackAims(dt) {
        const m = this._mouth();
        for (const s of this.spitTargets) {
            const tg = s.t;
            if (tg && !tg.dead && !(tg.koTimer > 0)) {
                const a = Math.atan2(tg.y + tg.h / 2 - m.y, tg.x + tg.w / 2 - m.x) + (s.off || 0);
                s.a2 = GolemArt.angStep(s.a2, a, dt * 6);
            }
        }
    }

    _updateSpits(dt, player) {
        const m = this._mouth();
        this.spitFx -= dt;
        const spawn = this.spitFx <= 0;
        if (spawn) this.spitFx = 0.05;
        for (const s of this.spits) {
            // der Strahl schwenkt nur leicht mit (kinderfreundlich ausweichbar)
            if (s.target && !s.target.dead && !(s.target.koTimer > 0)) {
                const a = Math.atan2(s.target.y + s.target.h / 2 - m.y, s.target.x + s.target.w / 2 - m.x);
                s.ang = GolemArt.angStep(s.ang, a, GolemCfg.B_SPIT_SWEEP * dt);
            }
            s.cd -= dt;
            if (spawn) {
                const d = randRange(18, GolemCfg.B_SPIT_RANGE * 0.95);
                const fa = s.ang + randRange(-0.3, 0.3);
                GolemArt.burst(m.x + Math.cos(fa) * d, m.y + Math.sin(fa) * d,
                    [GolemCfg.LAVA_CORE, GolemCfg.LAVA, '#ff4a12'], 2, 60, 0.3, { kind: 'spark' });
            }
            if (!player || s.cd > 0) continue;
            let hit = false;
            if (!player.dead && player.iFrames <= 0 &&
                pointInArc({ x: player.x + player.w / 2, y: player.y + player.h / 2 }, m, s.ang, GolemCfg.B_SPIT_ARC, GolemCfg.B_SPIT_RANGE + 10)) {
                GolemArt.hurt(player, 1, s.ang, 120);
                hit = true;
            }
            for (const c of GolemArt.friends()) {
                if (pointInArc({ x: c.x + c.w / 2, y: c.y + c.h / 2 }, m, s.ang, GolemCfg.B_SPIT_ARC, GolemCfg.B_SPIT_RANGE + 12)) {
                    if (GolemArt.hitFriend(c, 1)) hit = true;
                }
            }
            if (hit) s.cd = 0.5;
        }
    }

    // ── c) Lavaknollen rufen (nur Phase 2, nur im Boss-Raum, höchstens vier gleichzeitig) ──

    _summonCinders(world, player) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || !Game._bossRoomRect || !Game.enemies) return;
        const room = Game._bossRoomRect();
        const want = Math.min(GolemCfg.B_MAX_HELPERS - this._aliveCinders(), randInt(1, 2));
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 20 + Math.random() * (room.w - 40);
                const y = room.y + 20 + Math.random() * (room.h - 40);
                if (Math.hypot(x - px, y - py) < 90 || Math.hypot(x - this.centerX(), y - this.centerY()) < 60) continue;
                if (world.isWall(x - 10, y - 9) || world.isWall(x + 10, y - 9) || world.isWall(x - 10, y + 9) || world.isWall(x + 10, y + 9)) continue;
                const kid = new GolemCinder(x, y);
                kid.summoner = this;
                Game.enemies.push(kid);
                this.cinders.push(kid);
                GolemArt.burst(x, y, [GolemCfg.LAVA, '#ffffff', GolemCfg.LAVA_CORE], 12, 130, 0.5, { kind: 'star' });
                GolemArt.ring(x, y + 6, GolemCfg.LAVA, 26, 0.4, 3);
                break;
            }
        }
    }

    // ── Warnungen und Gefahren am Boden (unter allen Figuren), nur im Boss-Raum ──

    drawUnder(ctx, camera) {
        const st = this.state;
        const lifting = !this.dead && (st === 'lift' || st === 'slam');
        const charging = !this.dead && st === 'spitCharge';
        const spitting = !this.dead && st === 'spit';
        if (!lifting && !charging && !spitting && !this.waves.length && !this.burns.length) return;
        ctx.save();
        if (typeof Game !== 'undefined' && Game.bossActive && Game.world && typeof Game._bossRoomRect === 'function') {
            const room = Game._bossRoomRect();
            const a = camera.worldToScreen(room.x, room.y);
            ctx.beginPath();
            ctx.rect(a.x, a.y, room.w, room.h);
            ctx.clip();
        }
        if (lifting) {
            const k = st === 'lift' ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
            const p = this._stompPoint(this.stompSide);
            const s = camera.worldToScreen(p.x, p.y);
            LateWorldArt.warn(ctx, s.x, s.y, GolemCfg.B_SLAM_R, k, '#ff5a1f');
        }
        if (charging) {
            const k = clamp(1 - this.stateT / GolemCfg.B_SPIT_CHARGE, 0, 1);
            const m = camera.worldToScreen(this._mouth().x, this._mouth().y);
            for (const s of this.spitTargets) {
                GolemArt.cone(ctx, m.x, m.y, s.a2, GolemCfg.B_SPIT_ARC, GolemCfg.B_SPIT_RANGE, k, '#ff5a1f',
                    0.1 + 0.12 * k, 0.35 + 0.45 * k);
            }
        }
        if (spitting) {
            const m = camera.worldToScreen(this._mouth().x, this._mouth().y);
            const flick = 0.24 + 0.1 * Math.sin(Art.time * 30 + this.seed);
            for (const s of this.spits) {
                GolemArt.cone(ctx, m.x, m.y, s.ang, GolemCfg.B_SPIT_ARC, GolemCfg.B_SPIT_RANGE, 1, '#ff8a2a', flick, 0.5);
                Art.glow(ctx, m.x + Math.cos(s.ang) * 26, m.y + Math.sin(s.ang) * 26, 30, GolemCfg.LAVA_CORE, 0.5);
            }
        }
        // Schockwellen: breites glühendes Band
        for (const w of this.waves) {
            const c = camera.worldToScreen(w.x, w.y);
            const prev = ctx.globalAlpha;
            ctx.beginPath();
            ctx.arc(c.x, c.y, w.r, 0, TAU);
            ctx.strokeStyle = '#ff4a12';
            ctx.globalAlpha = prev * 0.25;
            ctx.lineWidth = GolemCfg.B_WAVE_BAND * 2.4;
            ctx.stroke();
            ctx.strokeStyle = GolemCfg.LAVA;
            ctx.globalAlpha = prev * 0.9;
            ctx.lineWidth = GolemCfg.B_WAVE_BAND;
            ctx.stroke();
            ctx.strokeStyle = '#ffe08a';
            ctx.globalAlpha = prev * 0.8;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
        // brennende Bodenflecken
        for (const b of this.burns) {
            const c = camera.worldToScreen(b.x, b.y);
            const life = clamp(b.t / 0.5, 0, 1);
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#c8401a';
            ctx.globalAlpha = prev * 0.3 * life;
            ctx.beginPath();
            ctx.arc(c.x, c.y, b.r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = GolemCfg.LAVA;
            ctx.globalAlpha = prev * 0.45 * life;
            ctx.beginPath();
            ctx.arc(c.x, c.y, b.r * 0.62, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = prev;
            for (let i = 0; i < 3; i++) {
                const fx = c.x - 6 + i * 6;
                GolemArt.flame(ctx, fx, c.y + 2, 3 + (i === 1 ? 1 : 0), Math.sin(Art.time * 10 + i * 2 + this.seed) * 1.4,
                    Math.sin(Art.time * 15 + i * 2.4) * life);
            }
        }
        ctx.restore();
    }

    // ── Zeichnen ──

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, by - 52);
        ctx.translate(cx, by);
        this._drawGolem(ctx, this.dead);
        ctx.restore();
    }

    // Fußhaltung fürs Stampfen (nur Darstellung): hebt die aktive Seite an und knallt sie runter
    _footPose() {
        const st = this.state;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        let up = 0, down = 0;
        if (st === 'lift') up = GolemArt.ease(clamp((k - 0.15) / 0.85, 0, 1));
        else if (st === 'slam') down = k * k;
        return { up, down };
    }

    // Arme: Felsfäuste (x, y = Faustmittelpunkt), hot = Glühen. Nur aus dem Zustand abgeleitet.
    _arms() {
        const st = this.state, t = Art.time;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const A = this._arm;
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const sw = this.moving ? Math.sin(this.walkT * 3.2 + i * Math.PI) * 5 : Math.sin(t * 1.8 + this.seed + i) * 2;
            let x = s * 44, y = -40 + sw, hot = this.phase === 2 ? 0.3 : 0;
            if (this.dead) {
                x = s * 42; y = -14; hot = 0;
            } else if (st === 'intro' || st === 'roar' || st === 'summon') {
                // reckt die Fäuste und schlägt sie über der Brust zusammen
                const c = Math.abs(Math.sin(t * (st === 'roar' ? 9 : st === 'summon' ? 11 : 4)));
                x = s * (16 + 18 * c);
                y = -96 - 6 * c;
                hot = Math.max(hot, st === 'intro' ? 0.35 : 0.9);
            } else if (st === 'spitCharge') {
                // Fäuste hängen tief, die Brust öffnet sich zum Spucken
                x = s * (40 + 4 * k);
                y = -30 + 4 * k;
                hot = Math.max(hot, GolemArt.ease(k));
            } else if (st === 'spit') {
                x = s * 44;
                y = -26 + Math.sin(t * 22 + i) * 1.5;
                hot = 1;
            } else if (st === 'lift' || st === 'slam') {
                // gegen den gehobenen Fuß streckt sich der Arm der gleichen Seite
                const F = this._footPose();
                if (s === this.stompSide) {
                    y = -40 - 14 * F.up + 6 * F.down;
                    hot = Math.max(hot, 0.5 * F.up + 0.5 * F.down);
                }
            } else if (st === 'recover') {
                const e = GolemArt.ease(Math.max(0, (k - 0.5) / 0.5));
                y = lerp(-28, -40 + sw, e);
                hot = Math.max(hot, (1 - k) * 0.6);
            }
            A[i].x = x;
            A[i].y = y;
            A[i].hot = hot;
        }
        return A;
    }

    // Riesen-Golem mit Füßen bei (0, 0), Blick zum Betrachter. dead = Kreuzaugen, Flammen aus.
    _drawGolem(ctx, dead) {
        const t = Art.time, sd = this.seed, p2 = this.phase === 2 && !dead;
        const rock = GolemCfg.ROCK;
        const st = this.state;
        const step = this.moving ? Math.sin(this.walkT * 3.2) : 0;
        const bob = this.moving ? -Math.abs(step) * 2.6 : Math.sin(t * 1.6 + sd) * 1.2;
        const lx = clamp(this.look.x, -1, 1) * 4;
        const F = this._footPose();
        const glowHot = dead ? 0 : (p2 ? 0.85 : 0.45) + 0.15 * Math.sin(t * 6 + sd) +
            (st === 'spit' ? 0.3 : 0) + (st === 'spitCharge' ? 0.3 * clamp(1 - this.stateT / this.stateDur, 0, 1) : 0);
        // Warmes Leuchten vom ganzen Leib
        if (!dead) Art.glow(ctx, 0, -56 + bob, 90, GolemCfg.LAVA, 0.16 + 0.2 * glowHot);

        // ── Beine (Felsklötze); beim Stampfen hebt sich der aktive Fuß ──
        const l0 = this.moving ? Math.max(0, step) * 3 : 0, l1 = this.moving ? Math.max(0, -step) * 3 : 0;
        const liftL = this.stompSide === -1 ? F : null, liftR = this.stompSide === 1 ? F : null;
        const upL = liftL ? liftL.up * 16 : 0, upR = liftR ? liftR.up * 16 : 0;
        const slamL = liftL ? liftL.down : 0, slamR = liftR ? liftR.down : 0;
        const sq = 1 + (slamL > 0.5 ? 0.1 : 0) + (slamR > 0.5 ? 0.1 : 0);
        ctx.save();
        ctx.scale(1 / sq, sq);
        Art.box(ctx, -26, -26 - l0 - upL, 17, 26 + upL, 6, Art.dark(rock, 0.08), { lineWidth: 2.2 });
        Art.box(ctx, 9, -26 - l1 - upR, 17, 26 + upR, 6, Art.dark(rock, 0.08), { lineWidth: 2.2 });
        // glühende Sohle am gehobenen Fuß
        if (!dead && (upL > 4 || upR > 4)) {
            const sx = upL > upR ? -17.5 : 17.5;
            const sy = -26 - Math.max(upL, upR);
            Art.glow(ctx, sx, sy + 2, 20, GolemCfg.LAVA_CORE, 0.6);
        }
        ctx.fillStyle = GolemCfg.ROCK_DARK;
        ctx.beginPath();
        ctx.roundRect(-26, -6 - l0, 17, 6, 2.5);
        ctx.roundRect(9, -6 - l1, 17, 6, 2.5);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(0, bob);
        // ── Rumpf: großer Felsblock mit Lavaritzen ──
        Art.body(ctx, 0, -52, 33, 30, rock, { glossy: true, lineWidth: 2.4, rot: 0.2 });
        if (!dead) {
            Art.glow(ctx, 0, -52, 46, GolemCfg.LAVA, 0.2 + 0.25 * glowHot);
            GolemArt.cracks(ctx, [
                [-20, -70, -12, -56, -18, -40],
                [4, -76, 10, -60, 3, -44, 8, -32],
                [-14, -50, 0, -46, 14, -52],
                [-26, -34, -16, -28, -4, -30],
            ], glowHot);
        }
        // Brustplatte heller Stein
        Art.body(ctx, 0, -58, 14, 10, Art.light(rock, 0.1), { lineWidth: 1.6, highlight: false });

        // ── Kopf mit Flammen ──
        if (!dead) {
            Art.glow(ctx, lx, -104, 26, GolemCfg.LAVA, 0.5 + 0.2 * Math.sin(t * 8));
            for (let i = 0; i < 4; i++) {
                const fx = lx - 9 + i * 6;
                GolemArt.flame(ctx, fx, -96 - Math.sin((i / 3) * Math.PI) * 3, 3.6 + (i === 1 || i === 2 ? 1 : 0),
                    Math.sin(t * 9 + i * 1.8) * 1.8, Math.sin(t * 14 + i * 2.2 + sd));
            }
        }
        Art.body(ctx, lx, -84, 19, 16, Art.light(rock, 0.04), { glossy: true, lineWidth: 2.2 });
        // Augen: glühende Höhlen
        const ex = lx + clamp(this.look.x, -1, 1) * 2;
        if (dead) {
            LateWorldArt.xEyes(ctx, ex, -88, 3.4, 7.5);
        } else {
            Art.glow(ctx, ex, -88, 16, p2 ? '#ff3b2f' : GolemCfg.LAVA_CORE, 0.65);
            ctx.fillStyle = p2 ? '#ff5140' : GolemCfg.LAVA_CORE;
            ctx.beginPath();
            ctx.ellipse(ex - 6.5, -88, 3.4, 2.7, 0.25, 0, TAU);
            ctx.ellipse(ex + 6.5, -88, 3.4, 2.7, -0.25, 0, TAU);
            ctx.fill();
        }
        // Maul: beim Spucken weit offen mit Glut
        const open = !dead && (st === 'spitCharge' || st === 'spit' || st === 'roar' || st === 'intro');
        if (open) {
            const kk = st === 'spitCharge' ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
            Art.glow(ctx, ex, -74, 20 * (0.5 + kk), GolemCfg.LAVA_CORE, 0.7);
            ctx.fillStyle = '#40120a';
            ctx.beginPath();
            ctx.ellipse(ex, -74, 7, 5 * (0.5 + 0.5 * kk), 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = Art.mix('#ff4a12', GolemCfg.LAVA_CORE, kk);
            ctx.beginPath();
            ctx.ellipse(ex, -73, 4.6 * kk + 1, 3 * kk + 0.6, 0, 0, TAU);
            ctx.fill();
        } else {
            Art.mouth(ctx, ex, -73, 11, dead ? 'o' : 'teeth');
        }
        if (dead) LateWorldArt.dizzy(ctx, lx, -106, 20, 4);
        ctx.restore();

        // ── Arme mit riesigen Felsfäusten (vorn) ──
        const arms = this._arms();
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const A = arms[i];
            const sx = s * 27, sy = -66 + bob;
            const ang = Math.atan2(A.y - sy, A.x - sx);
            Art.limb(ctx, sx, sy, A.x, A.y, 12, rock, { lineWidth: 2.2 });
            // Schulter mit Flamme
            LateWorldArt.blob(ctx, sx, sy, 9.5, 8, Art.dark(rock, 0.04), 1.8);
            if (!dead) GolemArt.flame(ctx, sx, sy - 7, 3.8 + (p2 ? 1.2 : 0), Math.sin(t * 10 + i * 2.4 + sd) * 1.6, Math.sin(t * 16 + i * 2 + sd));
            if (!dead) Art.glow(ctx, sx, sy - 10, 14, GolemCfg.LAVA, 0.4 + 0.2 * Math.sin(t * 9 + i * 2));
            // Faust: unregelmäßiger Felsbrocken mit Rissen
            ctx.save();
            ctx.translate(A.x, A.y);
            ctx.rotate(ang * 0.25);
            if (A.hot > 0.05) Art.glow(ctx, 0, 0, 26, GolemCfg.LAVA, 0.6 * A.hot);
            ctx.beginPath();
            const rr = 12.5;
            for (let v = 0; v < 7; v++) {
                const a2 = (v / 7) * TAU;
                const rad = rr * (0.86 + 0.16 * Math.sin(v * 2.7 + i * 1.9 + sd));
                const px = Math.cos(a2) * rad, py = Math.sin(a2) * rad;
                if (v === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = Art.light(rock, 0.06);
            ctx.fill();
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = Art.ink(rock);
            ctx.stroke();
            Art.shine(ctx, -3.5, -4.5, 3.4, 3.4, 0, 0.35);
            if (A.hot > 0.15) {
                GolemArt.cracks(ctx, [[-6, -7, -1, -1, -5, 6], [4, -7, 7, 0, 3, 6]], A.hot);
            }
            ctx.restore();
        }
    }
}
