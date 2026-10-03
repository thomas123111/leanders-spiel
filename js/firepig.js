// ── Welt 28: Glutschmiede (Idee von Leander) ──
// Feuerschweine: runde rosa Schweinchen mit Flammen-Borsten auf dem Rücken, Rüssel, kleinen Hauern und einem
//   schweren Schmiedehammer. Sie laufen auf Mark ODER Juri bzw. das Krokodil zu (wer näher ist), holen sichtbar
//   aus (~0,5 s, Hammer glüht, Warnkreis am Boden) und hauen kurz vor sich auf den Boden. Kein Berührungsschaden:
//   gefährlich ist nur der Hammer. Freunde, die der Hammer besiegen würde, werden nur umgehauen (knockOut).
// Hammer-Schweinefrau (Boss): große Schweinefrau mit Krone, Schmiedeschürze und wehendem roten Umhang; statt
//   Händen hat sie zwei Hämmer an den Armen.
//   Feuerkreis-Schlag: hebt beide Hammerarme (~1 s, glühender Warnkreis unter ihr), schlägt auf den Boden →
//     ein dünner Feuerring wächst nach außen. Durch den Ring hindurch ausweichen oder ganz außen bleiben.
//     Am Rand brennt der Ring noch kurz, dann glimmt er harmlos aus. Trifft Mark und die Freunde.
//   Hammer-Stampfen: läuft auf Mark zu und hämmert abwechselnd links und rechts (Warnkreis vor jedem Schlag).
//   Phase 2 (halbe LP): Gebrüll, zwei Feuerringe nacheinander, der Umhang glüht, rote Augen, schnelleres Stampfen.

const FIREPIG_SKINS = ['#ff8fab', '#ff9a8c', '#ff83a0', '#ffa3bc', '#ff8f95'];
const FIREPIG_WINDUP = 0.5;       // Ausholen (Warnung) vor dem Hammerschlag
const FIREPIG_SMASH = 0.12;       // Schwung nach unten
const FIREPIG_RECOVER = 0.55;     // Hammer liegt kurz am Boden
const FIREPIG_REACH = 20;         // Aufschlagpunkt vor dem Schwein
const FIREPIG_HIT_R = 19;         // Trefferradius um den Aufschlagpunkt
const FIREPIG_DMG = 2;            // halbes Herz

const PIGQUEEN_RING_SPEED = 145;  // Feuerring (Boss-Zeit; ×1,15 echt)
const PIGQUEEN_RING_BAND = 10;    // halbe Breite des brennenden Rings
const PIGQUEEN_RING_DMG = 2;
const PIGQUEEN_BURN = 0.55;       // so lange brennt der Ring am äußeren Rand noch
const PIGQUEEN_GLIMMER = 1.1;     // danach glimmt er harmlos aus
const PIGQUEEN_SLAM_R = 58;       // Schaden direkt beim Aufschlag um die Füße
const PIGQUEEN_ARM_X = 44;        // Hammerköpfe am Boden: so weit links/rechts der Mitte
const PIGQUEEN_STOMP_R = 28;
const PIGQUEEN_ALIVE_RING = r => r.glim > 0 || r.burn > 0 || r.r < r.max;

// Gemeinsame Helfer der Welt 28
const PigArt = {
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

    ease(k) {
        k = clamp(k, 0, 1);
        return k * k * (3 - 2 * k);
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
        this.burst(c.x + c.w / 2, c.y + c.h / 2, ['#ffb020', '#ffffff', '#ff5a1f'], 8, 120, 0.4, { kind: 'star' });
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

    // Flammenzunge mit Fuß bei (x, y), Höhe ~ s * 1.8, neigt sich um lean
    flame(ctx, x, y, s, lean, flick) {
        const h = s * (1.7 + flick * 0.35);
        ctx.fillStyle = '#ff6a1f';
        ctx.beginPath();
        ctx.moveTo(x - s * 0.55, y);
        ctx.quadraticCurveTo(x - s * 0.7, y - h * 0.5, x + lean, y - h);
        ctx.quadraticCurveTo(x + s * 0.7, y - h * 0.5, x + s * 0.55, y);
        ctx.quadraticCurveTo(x, y + s * 0.3, x - s * 0.55, y);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(x - s * 0.3, y);
        ctx.quadraticCurveTo(x - s * 0.35, y - h * 0.35, x + lean * 0.6, y - h * 0.62);
        ctx.quadraticCurveTo(x + s * 0.35, y - h * 0.35, x + s * 0.3, y);
        ctx.closePath();
        ctx.fill();
    },

    // Schmiedehammer: Stiel entlang +x von 0 bis len, eiserner Kopf quer (dick hw, lang hl).
    // hot 0..1 lässt die Schlagflächen orange glühen.
    hammer(ctx, len, hw, hl, hot, lw) {
        Art.limb(ctx, 0, 0, len - hw * 0.3, 0, Math.max(2, hl * 0.22), '#b9773f', { lineWidth: lw * 0.75 });
        if (hot > 0) Art.glow(ctx, len, 0, hl * 1.15, '#ff7a1f', 0.55 * hot);
        Art.box(ctx, len - hw / 2, -hl / 2, hw, hl, Math.min(hw, hl) * 0.22, '#8f9bbd', { lineWidth: lw, highlight: false });
        // Schlagflächen an beiden Enden (glühen beim Ausholen)
        ctx.fillStyle = hot > 0.05 ? Art.mix('#5d6788', '#ff8a2a', hot) : '#5d6788';
        ctx.beginPath();
        ctx.rect(len - hw / 2 + lw * 0.4, -hl / 2 + lw * 0.4, hw - lw * 0.8, hl * 0.16);
        ctx.rect(len - hw / 2 + lw * 0.4, hl / 2 - lw * 0.4 - hl * 0.16, hw - lw * 0.8, hl * 0.16);
        ctx.fill();
        Art.shine(ctx, len - hw * 0.15, -hl * 0.12, hw * 0.16, hl * 0.18, 0, 0.4);
    },
};

// ══════════════════════════════════════════
// ── Feuerschwein ──
// ══════════════════════════════════════════

// Kugelrundes Schwein (Hitbox 26×24) mit Schmiedehammer. Zustände: walk → windup (0,5 s Ausholen) →
// smash (Schlag) → recover (Hammer am Boden). Ziel: Mark oder ein Freund, wer näher ist.
class FirePig extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 24);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(52, 62);       // Mark läuft ~150
        this.damage = FIREPIG_DMG;
        this.contactDamage = false;           // gefährlich ist nur der Hammer
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 240;
        this.seed = Math.random() * 10;
        this.skin = PigArt.pick(FIREPIG_SKINS);
        this.fxColor = this.skin;
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
        this.hitX = 0;                        // Aufschlagpunkt des laufenden Schlags (Welt)
        this.hitY = 0;
        this.t = Math.random() * 10;
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
        for (const c of PigArt.friends()) {
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

        // Ausholen und Zuhauen laufen unabhängig vom Ziel weiter (Richtung steht beim Ausholen fest)
        if (this.state !== 'walk') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                if (this.state === 'windup') this._set('smash', FIREPIG_SMASH);
                else if (this.state === 'smash') { this._smash(player); this._set('recover', FIREPIG_RECOVER); }
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
            if (dist < 34 && this.cooldown <= 0) {
                // Ausholen: Aufschlagpunkt liegt jetzt fest – wer rechtzeitig wegläuft, wird nicht getroffen
                this.hitX = this.centerX() + (dx / dist) * FIREPIG_REACH;
                this.hitY = this.centerY() + (dy / dist) * FIREPIG_REACH;
                if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
                this._set('windup', FIREPIG_WINDUP);
                return;
            }
            if (dist > 24) this._step(dx / dist, dy / dist, this.speed, dt, world);
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.3, 3);
                if (Math.random() < 0.35) {
                    this.wx = 0;
                    this.wy = 0;
                } else {
                    const a = Math.random() * TAU;
                    this.wx = Math.cos(a);
                    this.wy = Math.sin(a);
                }
            }
            if (this.wx || this.wy) {
                const moved = this._step(this.wx, this.wy, this.speed * 0.45, dt, world);
                if (moved < this.speed * 0.45 * dt * 0.3) this.wanderT = 0;
                if (Math.abs(this.wx) > 0.2) this.face = this.wx > 0 ? 1 : -1;
            }
            this._look(this.wx * 0.6, this.wy * 0.6 + 0.2, dt);
        }
    }

    _step(nx, ny, sp, dt, world) {
        const ox = this.x, oy = this.y;
        this.walkT += dt;
        this._moveWithCollision(nx * sp * dt, ny * sp * dt, world);
        const moved = Math.hypot(this.x - ox, this.y - oy);
        this.moving = moved > 0.01;
        return moved;
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    // Hammer kracht auf den Boden: trifft Mark und Freunde nahe am Aufschlagpunkt
    _smash(player) {
        const x = this.hitX, y = this.hitY;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - x, py - y) < FIREPIG_HIT_R + 6) {
                PigArt.hurt(player, FIREPIG_DMG, Math.atan2(py - this.centerY(), px - this.centerX()), 200);
            }
        }
        for (const c of PigArt.friends()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - x, cy - y) < FIREPIG_HIT_R + Math.max(c.w, c.h) * 0.3) PigArt.hitFriend(c, FIREPIG_DMG);
        }
        PigArt.burst(x, y + 4, ['#ffd23f', '#ff7a1f', '#ffffff'], 7, 120, 0.35, { kind: 'spark' });
        PigArt.burst(x, y + 4, 'rgba(255,220,190,0.8)', 3, 50, 0.35, { kind: 'smoke', size: 3.5 });
        PigArt.shake(1.6, 0.1);
    }

    // Warnkreis unter dem Aufschlagpunkt (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead || (this.state !== 'windup' && this.state !== 'smash')) return;
        const k = this.state === 'windup' ? clamp(1 - this.stateT / FIREPIG_WINDUP, 0, 1) : 1;
        const p = camera.worldToScreen(this.hitX, this.hitY + 4);
        LateWorldArt.warn(ctx, p.x, p.y, FIREPIG_HIT_R, k, '#ff5a1f');
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (!LateWorldArt.deathPop(ctx, this, cx, by - 12)) { ctx.restore(); return; }
        }
        ctx.translate(cx, by);
        ctx.scale(this.face, 1);
        this._drawBody(ctx, this.dead);
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 16);
    }

    // Haltung des Hammers (in Blickrichtung +x): Hand (hx, hy), Stielwinkel ha, Glühen, Rumpfneigung
    _pose() {
        const st = this.state;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const idle = { hx: 6, hy: -4, ha: 0.62 + Math.sin(Art.time * 2.4 + this.seed) * 0.04, hot: 0, lean: 0, sq: 0 };   // Hammer ruht vorn am Boden
        if (st === 'windup') {
            const e = PigArt.ease(k);
            const shake = k > 0.6 ? Math.sin(Art.time * 60 + this.seed) * 0.06 : 0;
            return { hx: lerp(6, 0, e), hy: lerp(-4, -18, e), ha: lerp(0.62, -2.8, e) + shake, hot: e, lean: -0.13 * e, sq: -0.06 * e };
        }
        if (st === 'smash') {
            const e = k * k;
            return { hx: lerp(0, 9, e), hy: lerp(-18, -6, e), ha: lerp(-2.8, 0.45, e), hot: 1, lean: 0.16 * e, sq: 0.08 * e };
        }
        if (st === 'recover') {
            const e = PigArt.ease(Math.max(0, (k - 0.45) / 0.55));
            return { hx: lerp(9, 6, e), hy: lerp(-6, -4, e), ha: lerp(0.45, 0.62, e), hot: 1 - k, lean: 0.16 * (1 - e), sq: 0.08 * (1 - e) };
        }
        return idle;
    }

    // Schwein mit Füßen bei (0, 0), Blick nach +x. dead = Kreuzaugen.
    _drawBody(ctx, dead) {
        const t = Art.time, sd = this.seed, skin = this.skin, ink = Art.ink(skin);
        const P = this._pose();
        const mv = this.moving && !dead;
        const step = mv ? Math.sin(this.walkT * 13) : 0;
        const hop = mv ? Math.abs(step) * 1.6 : Math.sin(t * 2.4 + sd) * 0.4;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -12, 24, '#ffd23f', 0.42 + 0.12 * Math.sin(t * 3 + sd));
        // Beine (hinten dunkler), Hufe
        const leg = Art.dark(skin, 0.12);
        const l0 = mv ? Math.max(0, step) * 2 : 0, l1 = mv ? Math.max(0, -step) * 2 : 0;
        ctx.fillStyle = Art.dark(skin, 0.3);
        ctx.beginPath();
        ctx.roundRect(-9.5, -6 - l1, 4.4, 6, 1.6);
        ctx.roundRect(1, -6 - l0, 4.4, 6, 1.6);
        ctx.fill();
        ctx.save();
        ctx.translate(0, -hop);
        ctx.rotate(P.lean);
        ctx.scale(1 + P.sq, 1 - P.sq);
        // Ringelschwanz
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-12, -13);
        ctx.quadraticCurveTo(-17, -15 + Math.sin(t * 6 + sd) * 1.2, -15.5, -18);
        ctx.quadraticCurveTo(-13.5, -19.5, -14.2, -16.5);
        ctx.stroke();
        // Flammen-Borsten auf dem Rücken
        Art.glow(ctx, -5, -24, 16, '#ff7a1f', 0.45 + 0.15 * Math.sin(t * 9 + sd));
        for (let i = 0; i < 3; i++) {
            const fx = -10 + i * 4.6, fy = -19.5 - Math.sin((i + 0.5) / 3 * Math.PI) * 2.5;
            PigArt.flame(ctx, fx, fy, 3.3 + (i === 1 ? 0.9 : 0), -1.6 + Math.sin(t * 11 + i * 2 + sd) * 1.2, Math.sin(t * 17 + i * 1.7 + sd));
        }
        // Körper
        Art.body(ctx, 0, -11.5, 13, 11.5, skin, { glossy: true, lineWidth: 1.5 });
        ctx.fillStyle = Art.light(skin, 0.35);
        ctx.beginPath();
        ctx.ellipse(1, -6, 7.5, 4.2, 0, 0, TAU);
        ctx.fill();
        // vordere Beine
        ctx.fillStyle = leg;
        ctx.beginPath();
        ctx.roundRect(-6.5, -5 - l0 + hop, 4.4, 5, 1.6);
        ctx.roundRect(4.5, -5 - l1 + hop, 4.4, 5, 1.6);
        ctx.fill();
        ctx.fillStyle = '#5a2a36';
        ctx.beginPath();
        ctx.rect(-6.5, -1.6 - l0 + hop, 4.4, 1.6);
        ctx.rect(4.5, -1.6 - l1 + hop, 4.4, 1.6);
        ctx.fill();
        // Ohren
        Art.shape(ctx, c => {
            c.moveTo(-1, -20);
            c.lineTo(1.5, -27);
            c.lineTo(5, -20.5);
            c.closePath();
            c.moveTo(5.5, -20);
            c.lineTo(9.5, -25.5);
            c.lineTo(10.5, -18);
            c.closePath();
        }, { x: -1, y: -27, w: 11.5, h: 9 }, Art.dark(skin, 0.08), { lineWidth: 1.2 });
        // Gesicht
        if (dead) LateWorldArt.xEyes(ctx, 4.6, -15, 1.9, 3.2);
        else Art.eyes(ctx, 4.6, -15.2, 2.5, { gap: 3.3, look: { x: this.look.x * this.face, y: this.look.y }, angry: true, seed: sd });
        Art.body(ctx, 11.2, -10.5, 3.8, 3.4, Art.dark(skin, 0.1), { lineWidth: 1.1, highlight: false });
        ctx.fillStyle = Art.ink(skin);
        ctx.beginPath();
        ctx.ellipse(10.2, -10.5, 0.8, 1.2, 0, 0, TAU);
        ctx.ellipse(12.6, -10.5, 0.8, 1.2, 0, 0, TAU);
        ctx.fill();
        // kleine Hauer
        ctx.fillStyle = '#fffbe8';
        ctx.beginPath();
        ctx.moveTo(7, -6.2);
        ctx.lineTo(8.2, -9);
        ctx.lineTo(9, -6);
        ctx.moveTo(11.5, -6);
        ctx.lineTo(12.6, -8.6);
        ctx.lineTo(13.4, -6.2);
        ctx.fill();
        // Arm mit Hammer
        ctx.save();
        ctx.translate(P.hx, P.hy);
        ctx.rotate(P.ha);
        PigArt.hammer(ctx, 15, 7, 11, P.hot, 1.3);
        ctx.restore();
        Art.limb(ctx, 1, -7, P.hx, P.hy, 3.4, skin, { lineWidth: 1.2 });
        Art.body(ctx, P.hx, P.hy, 2.3, 2.3, '#5a2a36', { lineWidth: 0.9, highlight: false });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 28: Hammer-Schweinefrau ──
// ══════════════════════════════════════════

// Hitbox 72×64, Zeichnung ~125 hoch und ~140 breit (mit Umhang und Hämmern).
// Ablauf: Intro → Laufen → Feuerkreis-Schlag → Laufen → Hammer-Stampfen → Laufen → …
class BossPigQueen extends Enemy {
    constructor(x, y) {
        super(x, y, 72, 64);
        this.hp = 100;
        this.maxHp = 100;
        this.speed = 34;
        this.damage = 1;
        this.contactDamage = true;
        this.isBoss = true;
        this.fxColor = '#ff8fb0';
        this.shadow = { rx: 44, ry: 13 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.stompSide = 1;       // welcher Arm als Nächstes zuhaut (-1 links, 1 rechts)
        this.stompLeft = 0;
        this.stompCycle = 0.58;
        this.rings = [];          // Feuerringe: {x, y, r, max, burn, glim, hit[]}
        this._arm = [{ x: 0, y: 0, hot: 0 }, { x: 0, y: 0, hot: 0 }];   // Haltung (nur Zeichnen)
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Eine Riesin lässt sich kaum wegschubsen. Besiegt: das Feuer geht aus.
    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.22);
        if (this.dead && !was) {
            for (const r of this.rings) {
                if (r.glim <= 0) r.glim = 0.5;
                r.burn = 0;
                r.max = r.r;
            }
        }
    }

    feetX() { return this.centerX(); }
    feetY() { return this.y + this.h - 6; }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) {
            this._updateRings(dt, null);
            return;
        }
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._updateRings(dt, player);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        this._lookAt(px - this.centerX(), py - (this.centerY() - 50), dt);

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0.6);
                break;
            case 'walk':
                this._walk(dt, world, px, py, 72, 1);
                if (this.stateT <= 0) this._nextAttack(px);
                break;
            case 'raise':
                if (this.stateT <= 0) this._set('swing', 0.12);
                break;
            case 'swing':
                if (this.stateT <= 0) this._slam(player, false);
                break;
            case 'raise2':
                if (this.stateT <= 0) this._set('swing2', 0.12);
                break;
            case 'swing2':
                if (this.stateT <= 0) this._slam(player, true);
                break;
            case 'stomp':
                this._walk(dt, world, px, py, 58, 1.25);
                if (this.stateT <= 0) {
                    this._stompHit(player);
                    this.stompLeft--;
                    this.stompSide = -this.stompSide;
                    if (this.stompLeft > 0) this._set('stomp', this.stompCycle);
                    else this._set('recover', this.phase === 2 ? 0.6 : 0.8);
                }
                break;
            default:            // stuck, recover, roar
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
        if (this.phase === 2 && !this.roared) {
            // Wut-Gebrüll beim Wechsel in Phase 2: der Umhang fängt Feuer (kein Angriff)
            this.roared = true;
            this._set('roar', 1.0);
            const x = this.centerX(), y = this.y + this.h - 70;
            PigArt.shake(7, 0.5);
            PigArt.burst(x, y, ['#ff5a1f', '#ffd23f', '#ffffff'], 18, 190, 0.6, { kind: 'star' });
            PigArt.ring(x, y + 40, '#ff6a1f', 100, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.8, 1.1) : randRange(1.2, 1.6));
    }

    // Stapft auf Mark zu (mit Wandkollision), bleibt vor ihm stehen
    _walk(dt, world, px, py, near, fast) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d < near) return;
        this.walkT += dt * fast;
        const s = Math.sin(this.walkT * 3.6);
        const v = this.speed * fast * (0.55 + 0.9 * s * s);
        this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
        this.moving = true;
    }

    _nextAttack(px) {
        const a = this.seq++ % 2 === 0 ? 'ring' : 'stomp';
        if (a === 'ring') {
            this._set('raise', this.phase === 2 ? 1.0 : 1.15);
        } else {
            this.stompLeft = this.phase === 2 ? 6 : 4;
            this.stompCycle = this.phase === 2 ? 0.46 : 0.58;
            this.stompSide = px >= this.centerX() ? 1 : -1;
            this._set('stomp', this.stompCycle);
        }
    }

    // ── a) Feuerkreis-Schlag ──

    _slam(player, second) {
        const x = this.feetX(), y = this.feetY();
        // direkt um die Füße kracht es
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - x, py - y) < PIGQUEEN_SLAM_R) PigArt.hurt(player, 2, Math.atan2(py - y, px - x), 220);
        }
        for (const c of PigArt.friends()) {
            if (Math.hypot(c.x + c.w / 2 - x, c.y + c.h / 2 - y) < PIGQUEEN_SLAM_R) PigArt.hitFriend(c, 2);
        }
        this.rings.push({ x, y, r: 30, max: second ? 168 : 150, burn: 0, glim: 0, hit: [] });
        PigArt.shake(this.phase === 2 ? 8 : 6.5, 0.35);
        for (const s of [-1, 1]) {
            const hx = x + s * PIGQUEEN_ARM_X;
            PigArt.burst(hx, y - 4, ['#ffd23f', '#ff7a1f', '#ffffff'], 10, 190, 0.45, { kind: 'spark' });
            PigArt.burst(hx, y - 4, 'rgba(255,215,185,0.85)', 5, 70, 0.5, { kind: 'smoke', size: 5 });
        }
        PigArt.ring(x, y, '#ffe08a', 52, 0.3, 5);
        if (typeof Sound !== 'undefined' && Sound.explosion) Sound.explosion();
        if (this.phase === 2 && !second) this._set('raise2', 0.55);
        else this._set('stuck', this.phase === 2 ? 0.95 : 1.15);
    }

    // Ringe wachsen, brennen kurz am Rand und glimmen aus. Jeder Ring trifft jeden höchstens einmal;
    // wer gerade ausweicht (unverwundbar), wird nicht als getroffen gezählt.
    _updateRings(dt, player) {
        if (!this.rings.length) return;
        for (const R of this.rings) {
            if (R.r < R.max) {
                R.r = Math.min(R.max, R.r + PIGQUEEN_RING_SPEED * dt);
                if (R.r >= R.max) R.burn = PIGQUEEN_BURN;
            } else if (R.burn > 0) {
                R.burn -= dt;
                if (R.burn <= 0) { R.burn = 0; R.glim = PIGQUEEN_GLIMMER; }
            } else {
                R.glim -= dt;
            }
            const hot = R.r < R.max || R.burn > 0;
            if (!hot || !player) continue;
            if (!player.dead && R.hit.indexOf(player) < 0) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                const d = Math.hypot(px - R.x, py - R.y);
                if (Math.abs(d - R.r) < PIGQUEEN_RING_BAND + 7) {
                    const before = player.hp;
                    PigArt.hurt(player, PIGQUEEN_RING_DMG, Math.atan2(py - R.y, px - R.x), 170);
                    if (player.hp < before) {
                        R.hit.push(player);
                        PigArt.burst(px, py, ['#ffb020', '#ffffff'], 8, 120, 0.4, { kind: 'star' });
                    }
                }
            }
            for (const c of PigArt.friends()) {
                if (R.hit.indexOf(c) >= 0) continue;
                const d = Math.hypot(c.x + c.w / 2 - R.x, c.y + c.h / 2 - R.y);
                if (Math.abs(d - R.r) < PIGQUEEN_RING_BAND + Math.max(c.w, c.h) * 0.3 && PigArt.hitFriend(c, PIGQUEEN_RING_DMG)) R.hit.push(c);
            }
        }
        compactInPlace(this.rings, PIGQUEEN_ALIVE_RING);
    }

    // ── b) Hammer-Stampfen ──

    _stompPoint(side) {
        return { x: this.feetX() + side * PIGQUEEN_ARM_X, y: this.feetY() - 4 };
    }

    _stompHit(player) {
        const p = this._stompPoint(this.stompSide);
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - p.x, py - p.y) < PIGQUEEN_STOMP_R + 10) {
                PigArt.hurt(player, 2, Math.atan2(py - this.centerY(), px - this.centerX()), 210);
            }
        }
        for (const c of PigArt.friends()) {
            if (Math.hypot(c.x + c.w / 2 - p.x, c.y + c.h / 2 - p.y) < PIGQUEEN_STOMP_R + 8) PigArt.hitFriend(c, 2);
        }
        PigArt.shake(3, 0.14);
        PigArt.burst(p.x, p.y, ['#ffd23f', '#ff7a1f', '#ffffff'], 8, 150, 0.35, { kind: 'spark' });
        PigArt.burst(p.x, p.y, 'rgba(255,215,185,0.8)', 3, 60, 0.4, { kind: 'smoke', size: 4 });
        PigArt.ring(p.x, p.y, '#ffb347', 30, 0.25, 4);
    }

    // ── Zeichnen ──

    // Warnkreise und Feuerringe am Boden (unter allen Figuren), nur im Boss-Raum
    drawUnder(ctx, camera) {
        const st = this.state;
        const charging = !this.dead && (st === 'raise' || st === 'swing' || st === 'raise2' || st === 'swing2');
        const stomping = !this.dead && st === 'stomp';
        if (!charging && !stomping && !this.rings.length) return;
        ctx.save();
        if (typeof Game !== 'undefined' && Game.bossActive && Game.world && typeof Game._bossRoomRect === 'function') {
            const room = Game._bossRoomRect();
            const a = camera.worldToScreen(room.x, room.y);
            ctx.beginPath();
            ctx.rect(a.x, a.y, room.w, room.h);
            ctx.clip();
        }
        const f = camera.worldToScreen(this.feetX(), this.feetY());
        if (charging) {
            const k = st === 'raise' || st === 'raise2' ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
            const pulse = 0.5 + 0.5 * Math.sin(Art.time * 14);
            Art.glow(ctx, f.x, f.y, 70 + 20 * k, '#ff6a1f', 0.25 + 0.3 * k);
            LateWorldArt.warn(ctx, f.x, f.y, PIGQUEEN_SLAM_R, k, '#ff5a1f');
            // so weit wird der Ring laufen
            Art.ring(ctx, f.x, f.y, st === 'raise2' || st === 'swing2' ? 168 : 150, '#ffb347', 2, 0.25 + 0.3 * pulse);
        }
        if (stomping) {
            const k = clamp(1 - this.stateT / this.stompCycle, 0, 1);
            if (k > 0.35) {
                const p = this._stompPoint(this.stompSide);
                const s = camera.worldToScreen(p.x, p.y);
                LateWorldArt.warn(ctx, s.x, s.y, PIGQUEEN_STOMP_R, (k - 0.35) / 0.65, '#ff5a1f');
            }
        }
        for (const R of this.rings) {
            const c = camera.worldToScreen(R.x, R.y);
            if (R.r < R.max || R.burn > 0) {
                const fade = R.burn > 0 ? 0.75 + 0.25 * (R.burn / PIGQUEEN_BURN) : 1;
                this._fireRing(ctx, c.x, c.y, R.r, fade, 1);
            } else {
                // glimmt harmlos aus: dunkelrote Glut, kleine Flämmchen sinken zusammen
                const g = clamp(R.glim / PIGQUEEN_GLIMMER, 0, 1);
                this._fireRing(ctx, c.x, c.y, R.r, g * 0.7, g * 0.35);
            }
        }
        ctx.restore();
    }

    // Brennender Ring: breites Leuchten, orange Band, gelber Kern, Flammenzungen rundherum
    _fireRing(ctx, x, y, r, a, flames) {
        if (a <= 0.01) return;
        const prev = ctx.globalAlpha;
        const t = Art.time;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.strokeStyle = '#ff4a12';
        ctx.globalAlpha = prev * a * 0.28;
        ctx.lineWidth = PIGQUEEN_RING_BAND * 2.6;
        ctx.stroke();
        ctx.strokeStyle = flames > 0.5 ? '#ff7a1f' : '#c8401a';
        ctx.globalAlpha = prev * a * 0.95;
        ctx.lineWidth = PIGQUEEN_RING_BAND * 1.1;
        ctx.stroke();
        if (flames > 0.5) {
            ctx.strokeStyle = '#ffe08a';
            ctx.lineWidth = 3.2;
            ctx.stroke();
        }
        // Flammenzungen zeigen nach oben (Bildschirm), sitzen auf dem Ring
        const n = clamp(Math.round(r / 6), 10, 34);
        ctx.fillStyle = flames > 0.5 ? '#ffb020' : '#ff6a1f';
        ctx.globalAlpha = prev * a;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const ang = (i / n) * TAU + this.seed;
            const fx = x + Math.cos(ang) * r, fy = y + Math.sin(ang) * r;
            const h = (5 + 3.5 * Math.sin(t * 13 + i * 2.1)) * (0.4 + flames * 0.9);
            const w = 3.2;
            ctx.moveTo(fx - w, fy + 1);
            ctx.quadraticCurveTo(fx - w * 0.4, fy - h * 0.6, fx + Math.sin(t * 9 + i) * 1.5, fy - h);
            ctx.quadraticCurveTo(fx + w * 0.4, fy - h * 0.6, fx + w, fy + 1);
            ctx.closePath();
        }
        ctx.fill();
        ctx.globalAlpha = prev;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, by - 50);
        ctx.translate(cx, by);
        this._drawQueen(ctx, this.dead);
        ctx.restore();
    }

    // Hammerarme: Handgelenk (Hammerkopf) je Seite aus dem Zustand (nur Darstellung)
    _arms() {
        const st = this.state, t = Art.time;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const A = this._arm;
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const sw = this.moving ? Math.sin(this.walkT * 3.6 + i * Math.PI) * 4 : Math.sin(t * 2 + this.seed + i) * 1.5;
            let x = s * 41, y = -36 + sw, hot = this.phase === 2 ? 0.35 : 0;
            const upX = s * 30, upY = -116, dnX = s * PIGQUEEN_ARM_X, dnY = -6;
            if (this.dead) {
                x = s * 40; y = -12;
                hot = 0;
            } else if (st === 'raise' || st === 'raise2') {
                const from = st === 'raise2';
                const e = PigArt.ease(k);
                x = lerp(from ? dnX : x, upX, e);
                y = lerp(from ? dnY : y, upY, e) + (k > 0.7 ? Math.sin(t * 50 + i) * 1.5 : 0);
                hot = Math.max(hot, e);
            } else if (st === 'swing' || st === 'swing2') {
                const e = k * k;
                x = lerp(upX, dnX, e);
                y = lerp(upY, dnY, e);
                hot = 1;
            } else if (st === 'stuck') {
                const e = PigArt.ease(Math.max(0, (k - 0.6) / 0.4));
                x = lerp(dnX, x, e);
                y = lerp(dnY, y, e);
                hot = Math.max(hot, 1 - k);
            } else if (st === 'stomp') {
                if (s === this.stompSide) {
                    if (k < 0.72) {
                        const e = PigArt.ease(k / 0.72);
                        x = lerp(x, s * 34, e);
                        y = lerp(y, -104, e);
                        hot = Math.max(hot, e * 0.8);
                    } else {
                        const e = ((k - 0.72) / 0.28) ** 2;
                        x = lerp(s * 34, dnX, e);
                        y = lerp(-104, dnY, e);
                        hot = 1;
                    }
                } else {
                    const e = PigArt.ease(k / 0.5);
                    x = lerp(dnX, x, e);
                    y = lerp(dnY, y, e);
                }
            } else if (st === 'roar' || st === 'intro') {
                // reckt die Hämmer und schlägt sie über dem Kopf zusammen
                const c = Math.abs(Math.sin(t * (st === 'roar' ? 9 : 4)));
                x = s * (18 + 16 * c);
                y = -104 - 6 * c;
                hot = Math.max(hot, st === 'roar' ? 1 : 0.3);
            }
            A[i].x = x;
            A[i].y = y;
            A[i].hot = hot;
        }
        return A;
    }

    // Schweinefrau mit Füßen bei (0, 0), Blick zum Betrachter
    _drawQueen(ctx, dead) {
        const t = Art.time, sd = this.seed, p2 = this.phase === 2 && !dead;
        const skin = '#ff8fb0', ink = Art.ink(skin);
        const step = this.moving ? Math.sin(this.walkT * 3.6) : 0;
        const bob = this.moving ? -Math.abs(step) * 2.4 : Math.sin(t * 1.8 + sd) * 1;
        const lx = clamp(this.look.x, -1, 1) * 3;
        const arms = this._arms();
        const st = this.state;
        const charging = st === 'raise' || st === 'raise2';

        // ── Umhang (hinten) ──
        const capeCol = p2 ? Art.mix('#e62e45', '#ff6a1f', 0.45 + 0.25 * Math.sin(t * 8)) : '#e62e45';
        if (p2) Art.glow(ctx, 0, -50 + bob, 95, '#ff5a1f', 0.45 + 0.15 * Math.sin(t * 7));
        const flutter = this.moving ? 7 : 3;
        Art.shape(ctx, c => {
            c.moveTo(-22, -76 + bob);
            c.quadraticCurveTo(-44 - flutter * 0.4, -40, -50 + Math.sin(t * 3.1) * flutter, -3);
            c.quadraticCurveTo(-38, 2 + Math.sin(t * 4 + 1) * 3, -25, -3);
            c.quadraticCurveTo(-12, 3 + Math.sin(t * 4 + 2) * 3, 0, -3);
            c.quadraticCurveTo(12, 3 + Math.sin(t * 4 + 3) * 3, 25, -3);
            c.quadraticCurveTo(38, 2 + Math.sin(t * 4 + 4) * 3, 50 + Math.sin(t * 3.1 + 1.3) * flutter, -3);
            c.quadraticCurveTo(44 + flutter * 0.4, -40, 22, -76 + bob);
            c.closePath();
        }, { x: -50, y: -78, w: 100, h: 78 }, capeCol, { lineWidth: 2.2 });
        // Futter innen und Faltenlinien
        ctx.strokeStyle = Art.alpha(Art.ink(capeCol), 0.55);
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-30, -52 + bob);
        ctx.quadraticCurveTo(-38, -28, -36, -6);
        ctx.moveTo(30, -52 + bob);
        ctx.quadraticCurveTo(38, -28, 36, -6);
        ctx.stroke();
        if (p2) {
            // der Saum brennt
            for (let i = 0; i < 7; i++) {
                const hx = -42 + i * 14;
                PigArt.flame(ctx, hx, -2 + Math.sin(t * 4 + i) * 2, 3.4, Math.sin(t * 10 + i * 1.9) * 2, Math.sin(t * 15 + i * 2.3));
            }
        }

        // ── Beine ──
        const l0 = this.moving ? Math.max(0, step) * 3 : 0, l1 = this.moving ? Math.max(0, -step) * 3 : 0;
        Art.box(ctx, -19, -22 - l0, 13, 22, 5, Art.dark(skin, 0.08), { lineWidth: 2 });
        Art.box(ctx, 6, -22 - l1, 13, 22, 5, Art.dark(skin, 0.08), { lineWidth: 2 });
        ctx.fillStyle = '#5a2a36';
        ctx.beginPath();
        ctx.roundRect(-19, -5 - l0, 13, 5, 2);
        ctx.roundRect(6, -5 - l1, 13, 5, 2);
        ctx.fill();

        ctx.save();
        ctx.translate(0, bob);
        // ── Rumpf mit Schmiedeschürze ──
        Art.body(ctx, 0, -44, 31, 29, skin, { glossy: true, lineWidth: 2.2 });
        Art.shape(ctx, c => {
            c.moveTo(-17, -60);
            c.lineTo(17, -60);
            c.quadraticCurveTo(25, -36, 22, -18);
            c.quadraticCurveTo(0, -12, -22, -18);
            c.quadraticCurveTo(-25, -36, -17, -60);
            c.closePath();
        }, { x: -25, y: -60, w: 50, h: 46 }, '#b8653c', { lineWidth: 1.8 });
        // Träger, Tasche, Flammen-Abzeichen
        ctx.strokeStyle = '#7a3a20';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-15, -60);
        ctx.lineTo(-9, -68);
        ctx.moveTo(15, -60);
        ctx.lineTo(9, -68);
        ctx.stroke();
        ctx.strokeStyle = '#8a4426';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(-10, -32, 20, 10, 2.5);
        ctx.stroke();
        Art.glow(ctx, 0, -46, 12, '#ffb020', 0.5);
        PigArt.flame(ctx, 0, -40, 4.2, Math.sin(t * 6) * 1.2, Math.sin(t * 11 + sd));

        // ── Kopf ──
        // Flammenhaar hinter der Krone
        Art.glow(ctx, lx, -104, 22, '#ff7a1f', 0.5 + 0.15 * Math.sin(t * 8));
        for (let i = 0; i < 5; i++) {
            const fx = lx - 12 + i * 6;
            PigArt.flame(ctx, fx, -95 - Math.sin((i / 4) * Math.PI) * 4, 3.4 + (i === 2 ? 1 : 0), Math.sin(t * 9 + i * 1.7) * 1.8, Math.sin(t * 14 + i * 2.1 + sd));
        }
        // Ohren
        Art.shape(ctx, c => {
            c.moveTo(lx - 20, -88);
            c.lineTo(lx - 26, -106);
            c.lineTo(lx - 9, -97);
            c.closePath();
            c.moveTo(lx + 20, -88);
            c.lineTo(lx + 26, -106);
            c.lineTo(lx + 9, -97);
            c.closePath();
        }, { x: lx - 26, y: -106, w: 52, h: 18 }, Art.dark(skin, 0.06), { lineWidth: 1.8 });
        Art.body(ctx, lx, -80, 22, 18.5, skin, { glossy: true, lineWidth: 2.2 });
        // Krone
        Art.shape(ctx, c => {
            c.moveTo(lx - 11, -95);
            c.lineTo(lx - 12, -105);
            c.lineTo(lx - 6, -100);
            c.lineTo(lx, -108);
            c.lineTo(lx + 6, -100);
            c.lineTo(lx + 12, -105);
            c.lineTo(lx + 11, -95);
            c.closePath();
        }, { x: lx - 12, y: -108, w: 24, h: 13 }, '#ffd23f', { lineWidth: 1.4, glossy: true });
        ctx.fillStyle = '#ff3d5a';
        ctx.beginPath();
        ctx.arc(lx, -99, 1.8, 0, TAU);
        ctx.fill();
        // Gesicht
        const fx = lx + clamp(this.look.x, -1, 1) * 2;
        if (dead) LateWorldArt.xEyes(ctx, fx, -85, 3.6, 8.5);
        else Art.eyes(ctx, fx, -85.5, 5, { gap: 8.5, look: this.look, angry: true, seed: sd, iris: p2 ? '#ff3b2f' : '#ffb020' });
        Art.blush(ctx, fx, -76, 4, 14);
        const mouthOpen = st === 'roar' || charging || st === 'intro';
        Art.mouth(ctx, fx, -67, 11, dead ? 'o' : (mouthOpen ? 'open' : 'teeth'));
        Art.body(ctx, fx, -75.5, 9, 6.8, '#ff6f96', { lineWidth: 1.6, highlight: false });
        ctx.fillStyle = '#7a1f3a';
        ctx.beginPath();
        ctx.ellipse(fx - 3.2, -75.5, 1.6, 2.4, 0, 0, TAU);
        ctx.ellipse(fx + 3.2, -75.5, 1.6, 2.4, 0, 0, TAU);
        ctx.fill();
        // Hauer
        ctx.fillStyle = '#fffbe8';
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(fx - 9.5, -64.5);
        ctx.lineTo(fx - 8.5, -71.5);
        ctx.lineTo(fx - 6, -64.5);
        ctx.moveTo(fx + 9.5, -64.5);
        ctx.lineTo(fx + 8.5, -71.5);
        ctx.lineTo(fx + 6, -64.5);
        ctx.fill();
        ctx.stroke();
        // Umhang-Spange am Hals
        Art.body(ctx, 0, -63, 4, 4, '#ffd23f', { lineWidth: 1.2 });
        if (dead) LateWorldArt.dizzy(ctx, lx, -112, 20, 4);
        ctx.restore();

        // ── Hammerarme (vorn): Arm ist der Stiel, statt einer Hand ein eiserner Hammerkopf ──
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const A = arms[i];
            const sx = s * 27, sy = -60 + bob;
            const ang = Math.atan2(A.y - sy, A.x - sx);
            Art.limb(ctx, sx, sy, A.x, A.y, 10, skin, { lineWidth: 2 });
            ctx.save();
            ctx.translate(A.x, A.y);
            ctx.rotate(ang);
            // Eisenmanschette am Handgelenk
            Art.box(ctx, -5, -6.5, 6, 13, 2, '#6f7a9c', { lineWidth: 1.5, highlight: false });
            if (A.hot > 0) Art.glow(ctx, 9, 0, 26, '#ff7a1f', 0.6 * A.hot);
            Art.box(ctx, 1, -15, 16, 30, 4, '#8f9bbd', { lineWidth: 2 });
            ctx.fillStyle = A.hot > 0.05 ? Art.mix('#5d6788', '#ff8a2a', A.hot) : '#5d6788';
            ctx.beginPath();
            ctx.rect(2.2, -13.8, 13.6, 4.5);
            ctx.rect(2.2, 9.3, 13.6, 4.5);
            ctx.fill();
            if (A.hot > 0.6) {
                ctx.fillStyle = Art.alpha('#ffe08a', (A.hot - 0.6) * 2);
                ctx.beginPath();
                ctx.rect(15.8, -15, 1.6, 30);
                ctx.fill();
            }
            Art.shine(ctx, 7, -6, 3, 6, 0, 0.4);
            ctx.restore();
        }
    }
}
