// ── Welt 39: Kürbisfeld (Idee von Leander) ──
// Kürbiskinder: kleine Kinder mit geschnitztem Kürbis auf dem Kopf (leuchtende Augen, Zackenmund) und
//   kleinem Umhang. Sie laufen auf Mark ODER Juri bzw. das Krokodil zu (wer näher ist) und wechseln zwei
//   Angriffe ab:
//     a) Kürbisreste – 0,6 s Zielen (drei Warnstrahlen, Richtung steht in den letzten 0,15 s fest),
//        dann drei Kerne/Stücke im kleinen Fächer (schnell, 1 Schaden).
//     b) Ganzer Kürbis im Bogen – 0,7 s Ausholen mit Kürbis über dem Kopf, dabei Warnteller am Landeplatz,
//        dann 0,85 s Flug, beim Aufschlag platscht er (2 Schaden im Umkreis, Freunde: K.o. statt besiegt).
//   Kein Berührungsschaden: gefährlich sind nur Kürbisse. Schlüsselträger trägt den goldenen Schlüssel.
// Kürbisvater (Boss): großer Körper mit RIESENGEM Kürbis als Kopf (glühendes geschnitztes Gesicht),
//   zwei Kürbisse als Hände, latzernes Schürzenhemd, Strohhut schief auf dem Stiel.
//     1) Zerschlagen: hebt beide Kürbishände (0,95 s, Warnteller auf Marks Platz und dem eines Freundes),
//        schlägt zu → platsch im Umkreis. Danach 1,1 s Verschnaufpause (zum Zurückschlagen).
//     2) Kürbisbeschuss: wirft 5 bis 8 Kürbisse im Bogen über die Arena (Warnteller bleiben sichtbar,
//        bis der Kürbis landet).
//     3) Phase 2 (halbe LP): Gebrüll, Gesicht glüht rot, Riss im Kürbis, beide Hände schlagen dreimal
//        zu, und die geworfenen Kürbisse platzen beim Aufschlag in kleine Stücke.
//   Gerufene Kürbiskinder bleiben im Boss-Raum (höchstens 4 gleichzeitig) und verpuffen, wenn der
//   Kürbisvater besiegt ist. Boss und Helfer verlassen den Boss-Raum nie.

const PUMPKIN_SKINS = ['#ff8b29', '#ffa038', '#f5741f', '#ff9430', '#e9701c'];
const PUMPKIN_ORANGE = '#ff8b29';   // Grundton der Kürbisse und Reste
const PUMPKIN_STEM = '#4f8f3a';
const PUMPKIN_CAPE = '#7b46c9';
const PUMPKIN_GLOW = '#ffd23f';
const PUMPKIN_WARN = '#ff5a1f';

const PUMPKIN_SEED_SPEED = 195;      // Kürbisreste
const PUMPKIN_WINDUP = 0.6;          // Ansage der Kürbisreste
const PUMPKIN_CARRY = 0.7;           // Ausholen mit dem Kürbis über dem Kopf
const PUMPKIN_FLIGHT = 0.85;         // Flugzeit des großen Kürbisses
const PUMPKIN_LOB_R = 26;            // Trefferumkreis beim Aufschlag
const PUMPKIN_DMG = 1;               // Kürbisreste: halbes Herz
const PUMPKIN_LOB_DMG = 2;           // ganzer Kürbis
const PUMPKIN_SHOT_CAP = 44;         // höchstens so viele Gegnergeschosse dieser Welt gleichzeitig

const PUMPK_SMASH_R = 34;            // Boss: Aufschlag um eine Kürbishand
const PUMPK_SMASH_DMG = 2;
const PUMPK_RAISE = 0.95;
const PUMPK_STUCK1 = 1.1;            // Verschnaufpause nach dem großen Schlag
const PUMPK_STUCK2 = 0.85;
const PUMPK_TRIPLE = 0.62;           // ein Handschlag in der Dreifach-Kombi
const PUMPK_BURST_BITS = 5;          // Stücke, wenn ein Bosskürbis platzt

// Gemeinsame Helfer der Welt 39
const PumpkinKit = {
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

    // Freund treffen: Schaden, aber nie verschwinden – statt besiegt nur umgehauen (wie in Welt 22/30)
    hitFriend(c, dmg) {
        if (!c || c.dead || c.koTimer > 0 || c.iFrames > 0) return false;
        if (c.hp - dmg <= 0) c.knockOut(6);
        else c.takeDamage(dmg);
        this.burst(c.x + c.w / 2, c.y + c.h / 2, [PUMPKIN_GLOW, '#ffffff', PUMPKIN_ORANGE], 8, 120, 0.4, { kind: 'star' });
        return true;
    },

    // Mark und die Freunde in einem Runden um (x, y) – wer zu weit weg ist, bleibt verschont
    splash(x, y, r, dmg) {
        const hit = [];
        if (typeof Game !== 'undefined' && Game.player && !Game.player.dead) {
            const p = Game.player;
            const px = p.x + p.w / 2, py = p.y + p.h / 2;
            if (Math.hypot(px - x, py - y) < r + 6) {
                PumpkinKit.hurt(p, dmg, Math.atan2(py - y, px - x), 170);
                hit.push(p);
            }
        }
        for (const c of PumpkinKit.friends()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - x, cy - y) < r + Math.max(c.w, c.h) * 0.3) PumpkinKit.hitFriend(c, dmg);
        }
        return hit;
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

    // Wie viele Gegnergeschosse dieser Welt fliegen gerade? (Leistungsdeckel fürs Handy)
    enemyShots() {
        if (typeof Game === 'undefined' || !Game.projectiles) return 0;
        let n = 0;
        for (const p of Game.projectiles) {
            if (!p.dead && p.owner !== 'player' && p.pumpkinWorld) n++;
        }
        return n;
    },

    room() {
        if (typeof Game !== 'undefined' && Game.bossActive && Game.world && typeof Game._bossRoomRect === 'function') {
            return Game._bossRoomRect();
        }
        return null;
    },

    // Kürbis mit Rillen und Stiel, Mittelpunkt (x, y), Radius r. face = geschnitztes Gesicht (oder null).
    // heat 0..1 lässt das Gesicht von Gelb nach Glutrot kippen (Phase 2, Treffer).
    pumpkin(ctx, x, y, r, skin, heat, lw, face) {
        const squish = 0.9;
        Art.body(ctx, x, y, r, r * squish, skin, { glossy: true, lineWidth: lw });
        // Rillen: drei dunkle Bögen
        ctx.strokeStyle = Art.alpha(Art.ink(skin), 0.5);
        ctx.lineWidth = Math.max(0.9, lw * 0.7);
        ctx.beginPath();
        ctx.moveTo(x, y - r * squish);
        ctx.quadraticCurveTo(x - r * 0.42, y, x, y + r * squish);
        ctx.moveTo(x, y - r * squish);
        ctx.quadraticCurveTo(x + r * 0.42, y, x, y + r * squish);
        ctx.moveTo(x - r * 0.62, y - r * squish * 0.62);
        ctx.quadraticCurveTo(x - r * 0.9, y, x - r * 0.62, y + r * squish * 0.62);
        ctx.moveTo(x + r * 0.62, y - r * squish * 0.62);
        ctx.quadraticCurveTo(x + r * 0.9, y, x + r * 0.62, y + r * squish * 0.62);
        ctx.stroke();
        PumpkinKit.stem(ctx, x, y - r * squish + 0.6, r * 0.34, lw);
        if (face) PumpkinKit.carved(ctx, x, y, r, heat, face);
    },

    stem(ctx, x, y, s, lw) {
        Art.limb(ctx, x, y, x + s * 0.35, y - s * 1.5, Math.max(1.6, s * 0.62), PUMPKIN_STEM, { lineWidth: lw * 0.7 });
    },

    // Geschnitztes Gesicht: Dreieckaugen, Zackenmund, hell von innen (heat verschiebt Gelb → Rot)
    carved(ctx, x, y, r, heat, big) {
        const col = heat > 0.05 ? Art.mix(PUMPKIN_GLOW, '#ff2a1a', clamp(heat, 0, 1)) : PUMPKIN_GLOW;
        const glow = big ? r * 1.5 : r * 1.9;
        Art.glow(ctx, x, y + r * 0.05, glow, col, (big ? 0.6 : 0.5) + 0.12 * Math.sin(Art.time * 7));
        ctx.fillStyle = col;
        const ex = r * 0.38, ey = y - r * 0.22, es = r * 0.26;
        ctx.beginPath();
        ctx.moveTo(x - ex - es, ey + es * 0.8);
        ctx.lineTo(x - ex, ey - es);
        ctx.lineTo(x - ex + es, ey + es * 0.8);
        ctx.moveTo(x + ex - es, ey + es * 0.8);
        ctx.lineTo(x + ex, ey - es);
        ctx.lineTo(x + ex + es, ey + es * 0.8);
        ctx.fill();
        // Zackenmund
        const my = y + r * 0.36, mw = r * 0.66, mh = r * 0.2;
        ctx.beginPath();
        ctx.moveTo(x - mw, my);
        for (let i = 0; i < 4; i++) {
            const x0 = x - mw + (2 * mw * i) / 4;
            const x1 = x - mw + (2 * mw * (i + 0.5)) / 4;
            const x2 = x - mw + (2 * mw * (i + 1)) / 4;
            ctx.lineTo(x1, my + (i % 2 === 0 ? mh : -mh));
            ctx.lineTo(x2, my);
        }
        ctx.closePath();
        ctx.fill();
    },

    // Kleine Kürbiskerne und Schalenstücke (Partikelregen beim Nachladen/Platschen)
    crumbs(x, y, n) {
        PumpkinKit.burst(x, y, [PUMPKIN_ORANGE, '#ffd9a0', PUMPKIN_STEM], n, 110, 0.4, { gravity: 240, size: 3 });
    },
};

// ══════════════════════════════════════════
// ── Geschosse der Welt 39 ──
// ══════════════════════════════════════════

// Kürbisreste: kleiner Kern/Schalensplitter, schnell, 1 Schaden. Trifft er Juri oder das Krokodil,
// sind die kurz benommen (main.js: hitsCompanions/stunTime).
class PumpkinSeed extends Projectile {
    constructor(x, y, angle, speed) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, PUMPKIN_DMG, 'enemy', 60);
        this.radius = 4.5;
        this.lifetime = 1.7;
        this.hitsCompanions = true;
        this.stunTime = 1.1;
        this.pumpkinWorld = true;
        this.seed = Math.floor(Math.random() * 900);
        this.kind = Math.random() < 0.5 ? 'seed' : 'bit';
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const ux = this.vx / sp, uy = this.vy / sp;
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * 0.4;
        ctx.strokeStyle = '#ffcf8a';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - ux * 13, p.y - uy * 13);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = a0;
        Art.glow(ctx, p.x, p.y, 11, PUMPKIN_GLOW, 0.55);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.age * 16 * (this.seed % 2 ? 1 : -1) + this.seed);
        if (this.kind === 'seed') {
            Art.body(ctx, 0, 0, 4.2, 2.7, '#ffe3b0', { lineWidth: 1, highlight: false });
        } else {
            Art.body(ctx, 0, 0, 4, 3.2, PUMPKIN_ORANGE, { lineWidth: 1 });
        }
        ctx.restore();
    }
}

// Winzige Schalenstücke, wenn ein Bosskürbis platzt: kurze Lebensdauer, 1 Schaden, wirbeln ab.
class PumpkinBit extends Projectile {
    constructor(x, y, angle, speed) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 70);
        this.radius = 4;
        this.lifetime = 0.62;
        this.hitsCompanions = true;
        this.stunTime = 0.8;
        this.pumpkinWorld = true;
        this.spin = randRange(-11, 11);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const fade = clamp(this.lifetime / 0.2, 0, 1);
        const a0 = ctx.globalAlpha;
        if (fade < 1) ctx.globalAlpha = a0 * fade;
        Art.glow(ctx, p.x, p.y, 10, PUMPKIN_ORANGE, 0.45);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.age * this.spin);
        Art.body(ctx, 0, 0, 4.4, 3, PUMPKIN_ORANGE, { lineWidth: 1 });
        ctx.restore();
        ctx.globalAlpha = a0;
    }
}

// Ganzer Kürbis im Bogen. Eigener Flug (fliegt über Mauern hinweg), deshalb owner 'lobber':
// die Engine prüft keine Treffer – getroffen wird erst beim Aufschlag (Platsch im Umkreis).
// big = Bosskürbis, burst = platzt in kleine Stücke (Phase 2).
class PumpkinLob extends Projectile {
    constructor(x, y, tx, ty, flight, big, burst) {
        super(x, y, 0, 0, PUMPKIN_LOB_DMG, 'lobber', 140);
        this.sx = x;
        this.sy = y;
        this.tx = tx;
        this.ty = ty;
        this.flight = flight;
        this.big = !!big;
        this.burstOnLand = !!burst;
        this.pumpkinWorld = true;
        this.radius = this.big ? 13 : 10;
        this.lifetime = flight + 0.25;
        const span = Math.hypot(tx - x, ty - y);
        this.height = (this.big ? 44 : 32) + span * 0.14;
        this.lift = 0;
        this.spin = randRange(-7, 7);
        this.skin = PumpkinKit.pick(PUMPKIN_SKINS);
    }

    update(dt) {
        this.age += dt;
        this.lifetime -= dt;
        const t = clamp(this.age / this.flight, 0, 1);
        this.x = lerp(this.sx, this.tx, t);
        this.y = lerp(this.sy, this.ty, t);
        this.lift = Math.sin(Math.PI * t) * this.height;
        if (t >= 1) {
            this._splash();
            this.dead = true;
        } else if (this.lifetime <= 0) {
            this.dead = true;
        }
    }

    // Aufschlag: platscht, trifft alles im Umkreis, Phase 2 wirft zusätzlich kleine Stücke
    _splash() {
        const r = this.big ? PUMPKIN_LOB_R + 6 : PUMPKIN_LOB_R;
        PumpkinKit.splash(this.tx, this.ty, r, PUMPKIN_LOB_DMG);
        PumpkinKit.burst(this.tx, this.ty, [PUMPKIN_ORANGE, '#ffd9a0', PUMPKIN_STEM, '#ffffff'],
            this.big ? 12 : 9, 150, 0.5, { gravity: 300, size: this.big ? 4 : 3.2 });
        PumpkinKit.ring(this.tx, this.ty + 3, '#ffd9a0', r, 0.28, 4);
        PumpkinKit.shake(this.big ? 3.4 : 2.2, 0.12);
        if (typeof Sound !== 'undefined' && Sound.explosion) Sound.explosion();
        if (!this.burstOnLand || typeof Game === 'undefined' || !Game.projectiles) return;
        for (let i = 0; i < PUMPK_BURST_BITS; i++) {
            if (PumpkinKit.enemyShots() >= PUMPKIN_SHOT_CAP) break;
            const a = (TAU * i) / PUMPK_BURST_BITS + randRange(-0.3, 0.3);
            Game.projectiles.push(new PumpkinBit(this.tx, this.ty, a, randRange(120, 175)));
        }
    }

    draw(ctx, camera) {
        const g = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        // Landepunkt-Merkur (nur der Bodenpunkt, der Warnteller kommt von der Figur darunter)
        ctx.globalAlpha = 0.28;
        Art.ring(ctx, g.x, g.y, r * 0.9, Art.ink(PUMPKIN_ORANGE), 1.4, 1);
        ctx.globalAlpha = 1;
        const y = g.y - this.lift;
        Art.glow(ctx, g.x, y, r * 2.1, PUMPKIN_GLOW, 0.35);
        ctx.save();
        ctx.translate(g.x, y);
        ctx.rotate(this.age * this.spin);
        PumpkinKit.pumpkin(ctx, 0, 0, r, this.skin, 0, 1.2, false);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Kürbiskind ──
// ══════════════════════════════════════════

// Kind mit geschnitztem Kürbis auf dem Kopf (Hitbox 22×26, Zeichnung ~44 hoch). Zustände:
// walk → aim (0,6 s Kürbisreste) → shoot → walk … bzw. walk → carry (0,7 s) → throw → walk.
// summoner = vom Kürbisvater gerufen: bleibt im Boss-Raum und verpufft mit ihm.
class PumpkinKid extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 26);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(50, 60);
        this.damage = PUMPKIN_DMG;
        this.contactDamage = false;           // gefährlich sind nur die Kürbisse
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 250;
        this.seed = Math.random() * 10;
        this.skin = PumpkinKit.pick(PUMPKIN_SKINS);
        this.cape = Math.random() < 0.5 ? PUMPKIN_CAPE : PumpkinKit.pick(['#2f9e6b', '#c2452f', '#2d6fd1']);
        this.fxColor = this.skin;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.seq = Math.random() < 0.5 ? 0 : 1;
        this.engaged = false;
        this.moving = false;
        this.target = null;
        this.retargetT = 0;
        this.cooldown = randRange(0.3, 1.1);
        this.aimA = 0;
        this.aimHold = 0;                     // letzte 0,15 s steht die Richtung
        this.lob = null;                      // { x, y, t, dur, r } Warnteller des fliegenden Kürbisses
        this.throwAt = null;
        this.t = Math.random() * 10;
        this.walkT = Math.random() * 3;
        this.wanderT = randRange(0.3, 2);
        this.wx = 0;
        this.wy = 0;
        this.summoner = null;
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
        for (const c of PumpkinKit.friends()) {
            const d = Math.hypot(c.x + c.w / 2 - mx, c.y + c.h / 2 - my);
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        // Gerufene Kinder verpuffen mit dem Kürbisvater und bleiben im Boss-Raum
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                PumpkinKit.burst(this.centerX(), this.centerY(), [PUMPKIN_ORANGE, '#ffffff'], 9, 95, 0.45, { kind: 'star' });
                return;
            }
            const room = PumpkinKit.room();
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }

        this.t += dt;
        if (this.cooldown > 0) this.cooldown -= dt;
        if (this.lob) {
            this.lob.t -= dt;
            if (this.lob.t <= 0) this.lob = null;
        }
        this.moving = false;

        // Angriffsablauf läuft unabhängig vom Ziel weiter (Richtung/Landepunkt stehen fest)
        if (this.state !== 'walk') {
            this.stateT -= dt;
            if (this.state === 'aim') {
                this.aimHold -= dt;
                if (this.aimHold <= 0 && this.target) {
                    const tx = this.target.x + this.target.w / 2, ty = this.target.y + this.target.h / 2;
                    this.aimA = Math.atan2(ty - this.centerY(), tx - this.centerX());
                }
            }
            if (this.stateT <= 0) {
                if (this.state === 'aim') this._shoot(projectiles);
                else if (this.state === 'shoot') { this._set('walk', 0); this.cooldown = randRange(0.5, 1.0); }
                else if (this.state === 'carry') this._throw(world);
                else if (this.state === 'throw') { this._set('walk', 0); this.cooldown = randRange(1.1, 1.8); }
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
        if (!tg || player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 70) this.engaged = false;

        if (this.engaged) {
            if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
            this._look(dx / dist, dy / dist, dt);
            if (this.cooldown <= 0 && dist < 230) {
                const useLob = this.seq++ % 3 === 2;
                if (useLob && dist > 55) {
                    // Landepunkt beim Ausholen festlegen → Kinder haben 1,5 s Zeit zum Ausweichen
                    let lx = tg.x + tg.w / 2, ly = tg.y + tg.h / 2;
                    const room = PumpkinKit.room();
                    if (room) {
                        lx = clamp(lx, room.x + 14, room.x + room.w - 14);
                        ly = clamp(ly, room.y + 14, room.y + room.h - 14);
                    }
                    this.throwAt = { x: lx, y: ly };
                    this.lob = { x: lx, y: ly, t: PUMPKIN_CARRY + PUMPKIN_FLIGHT, dur: PUMPKIN_CARRY + PUMPKIN_FLIGHT, r: PUMPKIN_LOB_R };
                    this._set('carry', PUMPKIN_CARRY);
                } else if (!useLob) {
                    this.aimA = Math.atan2(dy, dx);
                    this.aimHold = 0.15;
                    this._set('aim', PUMPKIN_WINDUP);
                } else if (dist > 30) {
                    this._step(dx / dist, dy / dist, this.speed, dt, world);
                }
                return;
            }
            if (dist > 120) this._step(dx / dist, dy / dist, this.speed, dt, world);
            else if (dist < 60) this._step(-dx / dist, -dy / dist, this.speed * 0.7, dt, world);
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.3, 3);
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
                this._step(this.wx, this.wy, this.speed * 0.45, dt, world);
                if (Math.abs(this.wx) > 0.2) this.face = this.wx > 0 ? 1 : -1;
            }
            this._look(this.wx * 0.6, this.wy * 0.6 + 0.2, dt);
        }
    }

    _step(nx, ny, sp, dt, world) {
        const ox = this.x, oy = this.y;
        this.walkT += dt;
        this._moveWithCollision(nx * sp * dt, ny * sp * dt, world);
        this.moving = Math.hypot(this.x - ox, this.y - oy) > 0.01;
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    // Kürbisreste: drei Stück im kleinen Fächer (nach dem Deckel der Welt, nicht mehr als nötig)
    _shoot(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const ox = this.centerX() + Math.cos(this.aimA) * 12;
        const oy = this.centerY() - 6 + Math.sin(this.aimA) * 12;
        if (list) {
            for (let i = -1; i <= 1; i++) {
                if (PumpkinKit.enemyShots() >= PUMPKIN_SHOT_CAP) break;
                list.push(new PumpkinSeed(ox, oy, this.aimA + i * 0.2, PUMPKIN_SEED_SPEED));
            }
        }
        PumpkinKit.crumbs(ox, oy, 5);
        if (typeof Sound !== 'undefined' && Sound.shoot) Sound.shoot();
        this._set('shoot', 0.16);
    }

    // Großer Kürbis im Bogen auf den gemerkten Landepunkt
    _throw(world) {
        const list = typeof Game !== 'undefined' ? Game.projectiles : null;
        const t = this.throwAt;
        if (list && t) list.push(new PumpkinLob(this.centerX(), this.centerY() - 18, t.x, t.y, PUMPKIN_FLIGHT, false, false));
        PumpkinKit.crumbs(this.centerX(), this.centerY() - 22, 4);
        this._set('throw', 0.2);
    }

    // Warnungen am Boden (unter allen Figuren): drei Strahlen für den Fächer, Teller für den Bogen
    drawUnder(ctx, camera) {
        if (this.dead) return;
        if (this.state === 'aim') {
            const k = clamp(1 - this.stateT / PUMPKIN_WINDUP, 0, 1);
            const p = camera.worldToScreen(this.centerX(), this.centerY() - 4);
            LateWorldArt.rays(ctx, p.x, p.y, 3, this.aimA, 16, 150, k, PUMPKIN_WARN);
        }
        if (this.lob) {
            const done = clamp(1 - this.lob.t / this.lob.dur, 0, 1);
            const p = camera.worldToScreen(this.lob.x, this.lob.y);
            LateWorldArt.warn(ctx, p.x, p.y, this.lob.r, clamp(done * 1.15, 0, 1), PUMPKIN_WARN);
        }
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
        this._drawKid(ctx, this.dead);
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 15);
    }

    // Haltung: tragen/werfen nur Darstellung, keine Spiellogik
    _pose() {
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const idle = { hx: 7, hy: -17, ha: 0.5, hold: 0, lean: 0, sq: 0, squash: 0 };
        if (this.state === 'aim') {
            const shake = k > 0.55 ? Math.sin(Art.time * 46 + this.seed) * 0.05 : 0;
            return { hx: lerp(7, 10, k), hy: lerp(-17, -19, k), ha: lerp(0.5, -0.12, PumpkinKit.ease(k)) + shake, hold: k, lean: -0.05 * k, sq: 0, squash: 0 };
        }
        if (this.state === 'shoot') {
            return { hx: 11, hy: -19, ha: -0.3, hold: 1 - k, lean: 0.1 * (1 - k), sq: 0, squash: 1 - k };
        }
        if (this.state === 'carry') {
            const e = PumpkinKit.ease(k);
            return { hx: lerp(7, -2, e), hy: lerp(-17, -40, e), ha: lerp(0.5, -1.1, e), hold: e, lean: -0.12 * e, sq: -0.05 * e, squash: 0 };
        }
        if (this.state === 'throw') {
            const e = k * k;
            return { hx: lerp(-2, 10, e), hy: lerp(-40, -20, e), ha: lerp(-1.1, 0.4, e), hold: 1 - k, lean: 0.18 * e, sq: 0.08 * e, squash: 1 - k };
        }
        return idle;
    }

    // Kürbiskind mit Fuß bei (0, 0), Blick nach +x
    _drawKid(ctx, dead) {
        const t = Art.time, sd = this.seed;
        const P = this._pose();
        const mv = this.moving && !dead;
        const step = mv ? Math.sin(this.walkT * 12) : 0;
        const hop = mv ? Math.abs(step) * 1.5 : Math.sin(t * 2.6 + sd) * 0.5;
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -14, 23, PUMPKIN_GLOW, 0.4 + 0.12 * Math.sin(t * 3 + sd));

        // Umhang (hinten), weht beim Laufen
        const flutter = mv ? 5 : 2;
        Art.shape(ctx, c => {
            c.moveTo(-5, -26);
            c.quadraticCurveTo(-14 - flutter * 0.4, -14, -12 + Math.sin(t * 4.2) * flutter * 0.5, -2);
            c.quadraticCurveTo(-4, 1, 4, -2);
            c.quadraticCurveTo(9, -14, 5, -26);
            c.closePath();
        }, { x: -15, y: -27, w: 25, h: 27 }, this.cape, { lineWidth: 1.3 });

        // Beine
        const l0 = mv ? Math.max(0, step) * 2 : 0, l1 = mv ? Math.max(0, -step) * 2 : 0;
        ctx.fillStyle = '#4b3050';
        ctx.beginPath();
        ctx.roundRect(-6.5, -7 - l0, 5, 7, 1.8);
        ctx.roundRect(1.5, -7 - l1, 5, 7, 1.8);
        ctx.fill();

        ctx.save();
        ctx.translate(0, -hop);
        ctx.rotate(P.lean);
        ctx.scale(1 + P.sq, 1 - P.sq);
        // Körper: latzernes Hemd
        Art.box(ctx, -8, -21, 16, 15, 5, '#6fc0e8', { lineWidth: 1.4 });
        Art.box(ctx, -6.5, -17.5, 13, 9, 3, '#4f9ecf', { lineWidth: 1.1, highlight: false });
        ctx.fillStyle = '#ffd9a0';
        ctx.beginPath();
        ctx.arc(-3.5, -19.5, 1.1, 0, TAU);
        ctx.arc(3.5, -19.5, 1.1, 0, TAU);
        ctx.fill();
        // Hände (hintere klein vorn am Körper, vordere hält den Kürbis)
        Art.limb(ctx, -4, -18, -8, -12 + Math.sin(t * 5 + sd) * (mv ? 2 : 0.5), 2.8, '#ffd9a0', { lineWidth: 1 });
        // Kopf: geschnitzter Kürbis statt Gesicht (leuchtende Augen, Zackenmund)
        PumpkinKit.pumpkin(ctx, 0, -28, 10.5, this.skin, 0, 1.4, true);
        // werfender Arm + Kürbis
        ctx.save();
        ctx.translate(P.hx, P.hy);
        ctx.rotate(P.ha);
        if (P.hold > 0.05) PumpkinKit.pumpkin(ctx, 6, 0, 5.6 + 1.2 * P.hold, this.skin, 0, 1.1, false);
        Art.limb(ctx, -6, 0, 4, 0, 2.8, '#ffd9a0', { lineWidth: 1 });
        ctx.restore();
        Art.limb(ctx, 4, -18, P.hx, P.hy, 2.9, '#ffd9a0', { lineWidth: 1 });
        ctx.restore();

        if (P.squash > 0.05) {
            // Staubwolke nach dem Wurf/Schuss
            ctx.globalAlpha = 0.4 * P.squash;
            Art.ring(ctx, 0, -3, 9 + 6 * (1 - P.squash), '#ffe3b0', 2, 1);
            ctx.globalAlpha = 1;
        }
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 39: Kürbisvater ──
// ══════════════════════════════════════════

// Hitbox 68×64, Zeichnung ~130 hoch und ~130 breit (mit den Kürbishänden). Bleibt immer im Boss-Raum.
// Ablauf: Intro → Laufen → Zerschlagen → Laufen → Kürbisbeschuss → … Phase 2 ab halben LP:
// Gebrüll, dann auch die Dreifach-Schlagkombi und platzende Kürbisse.
class BossPumpkinFather extends Enemy {
    constructor(x, y) {
        super(x, y, 68, 64);
        this.hp = 132;
        this.maxHp = 132;
        this.speed = 34;
        this.damage = 1;
        this.contactDamage = true;
        this.isBoss = true;
        this.fxColor = PUMPKIN_ORANGE;
        this.shadow = { rx: 44, ry: 13 };
        this.seed = Math.random() * 10;
        this.skin = '#f5741f';
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
        this.slamSide = 1;
        this.slamLeft = 0;
        this.throwLeft = 0;
        this.throwT = 0;
        this.throwRage = false;
        this.smash = null;        // { ax, ay, bx, by } Aufschlagpunkte beider Kürbishände
        this.lobbies = [];        // { x, y, t, dur, r } – Warnteller bis zur Landung
        this.summoned = [];
        this.summonT = 7;
        this._hand = [{ x: 0, y: 0, hot: 0 }, { x: 0, y: 0, hot: 0 }];
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    feetX() { return this.centerX(); }
    feetY() { return this.y + this.h - 6; }

    // Ein Kürbisvater lässt sich kaum wegschubsen. Besiegt: die gerufenen Kinder verpuffen,
    // die Warnteller verschwinden.
    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.22);
        if (this.dead && !was) {
            this.lobbies.length = 0;
            this.smash = null;
        }
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) {
            this._updateLobbies(dt);
            return;
        }
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._updateLobbies(dt);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        this._lookAt(px - this.centerX(), py - (this.centerY() - 52), dt);

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0.7);
                break;
            case 'walk':
                this._walk(dt, world, px, py, 76, 1);
                if (this.stateT <= 0) this._nextAttack();
                break;
            case 'raise':
                if (this.stateT <= 0) this._set('drop', 0.14);
                break;
            case 'drop':
                if (this.stateT <= 0) this._smashHit();
                break;
            case 'aim':
                if (this.stateT <= 0) {
                    this.throwLeft = this.phase === 2 ? randInt(6, 8) : randInt(5, 6);
                    this.throwRage = this.phase === 2;
                    this.throwT = 0;
                    this._set('barrage', 0.16 * this.throwLeft + 0.2);
                }
                break;
            case 'barrage':
                this.throwT -= dt;
                if (this.throwT <= 0 && this.throwLeft > 0) {
                    this._throwOne(projectiles);
                    this.throwLeft--;
                    this.throwT = 0.16;
                }
                if (this.stateT <= 0 && this.throwLeft <= 0) this._set('recover', this.phase === 2 ? PUMPK_STUCK2 : PUMPK_STUCK1);
                break;
            case 'triple':
                this._walk(dt, world, px, py, 64, 1.2);
                if (this.stateT <= 0) {
                    this._tripleHit();
                    this.slamLeft--;
                    this.slamSide = -this.slamSide;
                    if (this.slamLeft > 0) this._set('triple', PUMPK_TRIPLE);
                    else this._set('recover', this.phase === 2 ? 0.8 : 1.05);
                }
                break;
            default:            // stuck, recover, roar
                if (this.stateT <= 0) this._toWalk();
        }
        this._summonTick(dt, world, player);
    }

    _lookAt(dx, dy, dt) {
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    _toWalk() {
        if (this.phase === 2 && !this.roared) {
            // Wut-Gebrüll beim Phasenwechsel: Gesicht glüht rot, der Kürbis bekommt einen Riss
            this.roared = true;
            this._set('roar', 1.1);
            const x = this.centerX(), y = this.y + this.h - 92;
            PumpkinKit.shake(7, 0.5);
            PumpkinKit.burst(x, y, [PUMPKIN_ORANGE, PUMPKIN_GLOW, '#ffffff'], 20, 200, 0.65, { kind: 'star' });
            PumpkinKit.ring(x, y + 60, PUMPKIN_WARN, 104, 0.5, 5);
            this._summon(true);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.7, 1.0) : randRange(1.2, 1.6));
    }

    // Stapft auf Mark zu (mit Wandkollision), bleibt vor ihm stehen. Der Kürbisvater verlässt den
    // Boss-Raum nie – die Engine klemmt ihn zusätzlich an den Raum.
    _walk(dt, world, px, py, near, fast) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d < near) return;
        this.walkT += dt * fast;
        const s = Math.sin(this.walkT * 3.4);
        const v = this.speed * fast * (0.55 + 0.9 * s * s);
        this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
        this.moving = true;
    }

    // Angriffswahl: Phase 1 im Wechsel, Phase 2 zusätzlich die Dreifach-Kombi
    _nextAttack() {
        const order = this.phase === 2 ? ['smash', 'barrage', 'triple', 'smash', 'barrage', 'triple'] : ['smash', 'barrage', 'smash', 'barrage'];
        const a = order[this.seq++ % order.length];
        if (a === 'smash') this._beginSmash();
        else if (a === 'barrage') this._set('aim', this.phase === 2 ? 0.8 : 0.95);
        else {
            this.slamLeft = 3;
            this.slamSide = 1;
            this._set('triple', PUMPK_TRIPLE);
        }
    }

    // ── 1) Zerschlagen: beide Kürbishände auf Mark und einen Freund ──

    _beginSmash() {
        const room = PumpkinKit.room();
        const clip = (x, y) => (room
            ? { x: clamp(x, room.x + 18, room.x + room.w - 18), y: clamp(y, room.y + 16, room.y + room.h - 14) }
            : { x, y });
        const p = typeof Game !== 'undefined' && Game.player && !Game.player.dead ? Game.player : null;
        const a = p ? clip(p.x + p.w / 2, p.y + p.h / 2) : clip(this.centerX(), this.centerY() + 60);
        const friends = PumpkinKit.friends();
        let b;
        if (friends.length) {
            const c = friends[Math.floor(Math.random() * friends.length)];
            b = clip(c.x + c.w / 2, c.y + c.h / 2);
        } else {
            b = clip(this.centerX() - (a.x - this.centerX()), this.centerY() - (a.y - this.centerY()));
        }
        this.smash = { ax: a.x, ay: a.y, bx: b.x, by: b.y };
        this._set('raise', this.phase === 2 ? PUMPK_RAISE - 0.15 : PUMPK_RAISE);
    }

    _smashHit() {
        const s = this.smash;
        this.smash = null;
        if (!s) { this._set('stuck', PUMPK_STUCK1); return; }
        PumpkinKit.splash(s.ax, s.ay, PUMPK_SMASH_R, PUMPK_SMASH_DMG);
        PumpkinKit.splash(s.bx, s.by, PUMPK_SMASH_R, PUMPK_SMASH_DMG);
        for (const pt of [s, { ax: s.bx, ay: s.by }]) {
            PumpkinKit.burst(pt.ax, pt.ay + 4, [PUMPKIN_ORANGE, '#ffd9a0', PUMPKIN_STEM], 12, 175, 0.5, { gravity: 320, size: 4 });
            PumpkinKit.burst(pt.ax, pt.ay + 4, 'rgba(255,220,180,0.8)', 4, 60, 0.45, { kind: 'smoke', size: 5 });
            PumpkinKit.ring(pt.ax, pt.ay + 3, PUMPKIN_GLOW, PUMPK_SMASH_R, 0.3, 5);
        }
        PumpkinKit.shake(7, 0.3);
        if (typeof Sound !== 'undefined' && Sound.explosion) Sound.explosion();
        this._set('stuck', this.phase === 2 ? PUMPK_STUCK2 : PUMPK_STUCK1);
    }

    // ── 2) Kürbisbeschuss: 5 bis 8 Kürbisse im Bogen über die Arena ──

    _throwOne(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const room = PumpkinKit.room();
        const p = typeof Game !== 'undefined' && Game.player ? Game.player : null;
        // einer der Kürbisse zielt auf Mark, der Rest verteilt sich
        let x, y;
        if (this.throwLeft === 1 && p && !p.dead) {
            x = p.x + p.w / 2 + randRange(-14, 14);
            y = p.y + p.h / 2 + randRange(-14, 14);
        } else {
            const box = room || { x: this.x - 110, y: this.y - 60, w: this.w + 220, h: this.h + 130 };
            x = box.x + 24 + Math.random() * Math.max(30, box.w - 48);
            y = box.y + 20 + Math.random() * Math.max(30, box.h - 40);
        }
        const flight = randRange(0.95, 1.15);
        if (list && PumpkinKit.enemyShots() < PUMPKIN_SHOT_CAP) {
            list.push(new PumpkinLob(this.centerX(), this.centerY() - 60, x, y, flight, true, this.throwRage));
        }
        // Warnteller bleiben, bis der Kürbis landet
        this.lobbies.push({ x, y, t: flight, dur: flight, r: PUMPKIN_LOB_R + 6 });
        PumpkinKit.crumbs(this.centerX(), this.centerY() - 60, 3);
        if (typeof Sound !== 'undefined' && Sound.shoot) Sound.shoot();
    }

    _updateLobbies(dt) {
        if (!this.lobbies.length) return;
        for (const L of this.lobbies) L.t -= dt;
        compactInPlace(this.lobbies, L => L.t > 0);
    }

    // ── 3) Phase 2: beide Hände schlagen dreimal zu ──

    _triplePoint() {
        const p = typeof Game !== 'undefined' && Game.player && !Game.player.dead ? Game.player : null;
        let tx = this.centerX() + this.slamSide * 46;
        let ty = this.feetY() - 10;
        if (p) {
            tx = p.x + p.w / 2 + this.slamSide * 12;
            ty = p.y + p.h / 2;
        }
        const room = PumpkinKit.room();
        if (room) {
            tx = clamp(tx, room.x + 18, room.x + room.w - 18);
            ty = clamp(ty, room.y + 16, room.y + room.h - 14);
        }
        return { x: tx, y: ty };
    }

    _tripleHit() {
        const pt = this._triplePoint();
        PumpkinKit.splash(pt.x, pt.y, PUMPK_SMASH_R - 4, PUMPK_SMASH_DMG);
        PumpkinKit.burst(pt.x, pt.y + 4, [PUMPKIN_ORANGE, '#ffd9a0', PUMPKIN_STEM], 9, 160, 0.45, { gravity: 300, size: 3.6 });
        PumpkinKit.ring(pt.x, pt.y + 3, PUMPKIN_GLOW, PUMPK_SMASH_R - 4, 0.25, 4);
        PumpkinKit.shake(4, 0.14);
        if (typeof Sound !== 'undefined' && Sound.hit) Sound.hit();
    }

    // ── gerufene Kürbiskinder (nur im Boss-Raum, höchstens 4 gleichzeitig) ──

    _aliveSummoned() {
        let n = 0;
        for (const k of this.summoned) if (k && !k.dead) n++;
        return n;
    }

    _summonTick(dt, world, player) {
        if (this.phase !== 2) return;
        this.summonT -= dt;
        if (this.summonT <= 0) {
            this.summonT = 9;
            this._summon(false);
        }
    }

    _summon(now) {
        if (typeof Game === 'undefined' || !Game.bossActive || !Game._bossRoomRect || !Game.enemies || !Game.world) return;
        const room = Game._bossRoomRect();
        const want = Math.min(4 - this._aliveSummoned(), now ? 2 : 1);
        const p = Game.player;
        const px = p ? p.x + p.w / 2 : this.centerX();
        const py = p ? p.y + p.h / 2 : this.centerY();
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 22 + Math.random() * (room.w - 44);
                const y = room.y + 22 + Math.random() * (room.h - 44);
                if (Math.hypot(x - px, y - py) < 84 || Math.hypot(x - this.centerX(), y - this.centerY()) < 58) continue;
                if (Game.world.isWall(x - 11, y - 13) || Game.world.isWall(x + 11, y + 13)) continue;
                const kid = new PumpkinKid(x, y);
                kid.summoner = this;
                kid.engaged = true;
                kid.cooldown = randRange(0.8, 1.6);
                Game.enemies.push(kid);
                this.summoned.push(kid);
                PumpkinKit.burst(x, y, [PUMPKIN_ORANGE, '#ffffff', PUMPKIN_GLOW], 12, 130, 0.5, { kind: 'star' });
                PumpkinKit.ring(x, y + 8, PUMPKIN_GLOW, 26, 0.4, 3);
                break;
            }
        }
    }

    // ── Zeichnen ──

    // Warnkreise am Boden (unter allen Figuren), nur im Boss-Raum sichtbar
    drawUnder(ctx, camera) {
        const st = this.state;
        const raising = !this.dead && (st === 'raise' || st === 'drop');
        const tripling = !this.dead && st === 'triple';
        if (this.dead && !this.lobbies.length) return;
        if (!raising && !tripling && !this.lobbies.length && st !== 'aim') return;
        ctx.save();
        const room = PumpkinKit.room();
        if (room) {
            const a = camera.worldToScreen(room.x, room.y);
            ctx.beginPath();
            ctx.rect(a.x, a.y, room.w, room.h);
            ctx.clip();
        }
        if (raising && this.smash) {
            const k = st === 'raise' ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
            for (const pt of [this.smash, { ax: this.smash.bx, ay: this.smash.by }]) {
                const s = camera.worldToScreen(pt.ax, pt.ay);
                LateWorldArt.warn(ctx, s.x, s.y, PUMPK_SMASH_R, k, PUMPKIN_WARN);
            }
        }
        if (st === 'aim') {
            // der Kürbisvater hollt aus: Kreise um ihn selbst, woher die Kürbisse kommen
            const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
            const c = camera.worldToScreen(this.centerX(), this.feetY());
            Art.glow(ctx, c.x, c.y - 40, 66 + 16 * k, PUMPKIN_GLOW, 0.2 + 0.24 * k);
        }
        if (tripling) {
            const k = clamp(1 - this.stateT / PUMPK_TRIPLE, 0, 1);
            if (k > 0.2) {
                const pt = this._triplePoint();
                const s = camera.worldToScreen(pt.x, pt.y);
                LateWorldArt.warn(ctx, s.x, s.y, PUMPK_SMASH_R - 4, (k - 0.2) / 0.8, PUMPKIN_WARN);
            }
        }
        for (const L of this.lobbies) {
            const done = clamp(1 - L.t / L.dur, 0, 1);
            const s = camera.worldToScreen(L.x, L.y);
            LateWorldArt.warn(ctx, s.x, s.y, L.r, clamp(done * 1.1, 0, 1), PUMPKIN_WARN);
        }
        ctx.restore();
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, by - 56);
        ctx.translate(cx, by);
        this._drawFather(ctx, this.dead);
        ctx.restore();
    }

    // Haltung der beiden Kürbishände (nur Darstellung, aus dem Zustand abgeleitet)
    _hands() {
        const st = this.state, t = Art.time;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const A = this._hand;
        const upX = 26, upY = -126, dnY = -8;
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const swing = this.moving ? Math.sin(this.walkT * 3.4 + i * Math.PI) * 5 : Math.sin(t * 2 + this.seed + i) * 2;
            let x = s * 44, y = -40 + swing, hot = this.phase === 2 ? 0.35 : 0;
            let tx = this.smash ? (i === 0 ? this.smash.ax : this.smash.bx) : this.centerX() + s * 46;
            let ty = this.smash ? (i === 0 ? this.smash.ay : this.smash.by) : this.feetY();
            if (st === 'triple') {
                const tp = this._triplePoint();
                if (s === this.slamSide) { tx = tp.x; ty = tp.y; }
            }
            const sx = this.centerX(), sy = this.feetY();
            const dnX = clamp(tx - sx, -52, 52);
            if (this.dead) {
                x = s * 42; y = -14; hot = 0;
            } else if (st === 'raise') {
                const e = PumpkinKit.ease(k);
                x = lerp(s * 44, upX, e);
                y = lerp(-40 + swing, upY, e) + (k > 0.7 ? Math.sin(t * 48 + i) * 1.6 : 0);
                hot = Math.max(hot, e);
            } else if (st === 'drop') {
                const e = k * k;
                x = lerp(lerp(s * 44, upX, 1), dnX, e);
                y = lerp(upY, dnY, e);
                hot = 1;
            } else if (st === 'stuck') {
                const e = PumpkinKit.ease(Math.max(0, (k - 0.55) / 0.45));
                x = lerp(dnX, s * 44, e);
                y = lerp(dnY, -40, e);
                hot = Math.max(hot, 1 - k);
            } else if (st === 'triple') {
                if (s === this.slamSide) {
                    if (k < 0.66) {
                        const e = PumpkinKit.ease(k / 0.66);
                        x = lerp(s * 44, s * 30, e);
                        y = lerp(-40, upY + 6, e);
                        hot = Math.max(hot, e * 0.85);
                    } else {
                        const e = ((k - 0.66) / 0.34) ** 2;
                        x = lerp(s * 30, dnX, e);
                        y = lerp(upY + 6, dnY, e);
                        hot = 1;
                    }
                } else {
                    x = s * 44;
                    y = -46 + Math.sin(t * 5 + i) * 2;
                }
            } else if (st === 'aim' || st === 'barrage') {
                const c = Math.abs(Math.sin(t * (st === 'barrage' ? 11 : 5)));
                x = s * (30 + 12 * c);
                y = -74 - 12 * c;
                hot = Math.max(hot, 0.5);
            } else if (st === 'roar' || st === 'intro') {
                const c = Math.abs(Math.sin(t * (st === 'roar' ? 9 : 3.6)));
                x = s * (24 + 18 * c);
                y = -112 - 8 * c;
                hot = Math.max(hot, st === 'roar' ? 1 : 0.3);
            }
            A[i].x = x;
            A[i].y = y;
            A[i].hot = hot;
        }
        return A;
    }

    // Kürbisvater mit Füßen bei (0, 0), Blick zum Betrachter
    _drawFather(ctx, dead) {
        const t = Art.time, sd = this.seed, p2 = this.phase === 2 && !dead;
        const step = this.moving ? Math.sin(this.walkT * 3.4) : 0;
        const bob = this.moving ? -Math.abs(step) * 2.6 : Math.sin(t * 1.7 + sd) * 1.2;
        const lx = clamp(this.look.x, -1, 1) * 4;
        const hands = this._hands();
        const st = this.state;
        const heat = dead ? 0 : (p2 ? 0.75 + 0.2 * Math.sin(t * 6) : (st === 'raise' || st === 'drop' || st === 'roar' ? 0.4 : 0.12));

        // Heiligenschein aus Kürbisglut in Phase 2
        if (p2) Art.glow(ctx, 0, -70 + bob, 96, '#ff3b1a', 0.4 + 0.14 * Math.sin(t * 7));

        // ── Beine ──
        const l0 = this.moving ? Math.max(0, step) * 3.4 : 0, l1 = this.moving ? Math.max(0, -step) * 3.4 : 0;
        Art.box(ctx, -21, -24 - l0, 15, 24, 6, '#5c3a2c', { lineWidth: 2 });
        Art.box(ctx, 6, -24 - l1, 15, 24, 6, '#5c3a2c', { lineWidth: 2 });
        ctx.fillStyle = '#33231b';
        ctx.beginPath();
        ctx.roundRect(-21, -6 - l0, 15, 6, 2.5);
        ctx.roundRect(6, -6 - l1, 15, 6, 2.5);
        ctx.fill();

        ctx.save();
        ctx.translate(0, bob);
        // ── Rumpf: latzernes Schürzenhemd über rundem Bauch ──
        Art.body(ctx, 0, -50, 34, 31, '#f0a24a', { glossy: true, lineWidth: 2.4 });
        Art.shape(ctx, c => {
            c.moveTo(-19, -68);
            c.lineTo(19, -68);
            c.quadraticCurveTo(28, -42, 24, -22);
            c.quadraticCurveTo(0, -15, -24, -22);
            c.quadraticCurveTo(-28, -42, -19, -68);
            c.closePath();
        }, { x: -28, y: -68, w: 56, h: 54 }, '#3f7f4e', { lineWidth: 2 });
        // Träger + Tasche mit Mini-Kürbis
        ctx.strokeStyle = '#2c5c39';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-16, -68);
        ctx.lineTo(-10, -76);
        ctx.moveTo(16, -68);
        ctx.lineTo(10, -76);
        ctx.stroke();
        ctx.strokeStyle = '#2c5c39';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(-11, -40, 22, 11, 3);
        ctx.stroke();
        PumpkinKit.pumpkin(ctx, 0, -34, 5, '#ff9430', 0, 1, false);
        Art.sparkle(ctx, -22, -58, 2.4, '#fff3b0', 0.6 + 0.3 * Math.sin(t * 5 + sd));

        // ── Kopf: RIESENGER Kürbis mit glühendem Gesicht ──
        PumpkinKit.pumpkin(ctx, lx, -100 + bob * 0.2, 33, this.skin, heat, 2.6, true);
        // Riss in Phase 2 (und ab halben LP sichtbar)
        if (p2) {
            ctx.strokeStyle = Art.alpha('#5a2a10', 0.85);
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lx - 20, -124);
            ctx.lineTo(lx - 12, -114);
            ctx.lineTo(lx - 18, -106);
            ctx.lineTo(lx - 8, -96);
            ctx.stroke();
        }
        // strohiger Hut schief auf dem Stiel
        ctx.save();
        ctx.translate(lx + 6, -134);
        ctx.rotate(-0.18);
        Art.body(ctx, 0, 0, 26, 7, '#e8c46a', { lineWidth: 2, glossy: false });
        Art.shape(ctx, c => {
            c.moveTo(-12, 0);
            c.quadraticCurveTo(-9, -16, 0, -16);
            c.quadraticCurveTo(9, -16, 12, 0);
            c.closePath();
        }, { x: -12, y: -16, w: 24, h: 16 }, '#f2d483', { lineWidth: 1.8 });
        ctx.fillStyle = '#c2452f';
        ctx.beginPath();
        ctx.rect(-11, -5, 22, 4);
        ctx.fill();
        ctx.restore();
        if (dead) LateWorldArt.xEyes(ctx, lx, -108, 6, 13);
        ctx.restore();

        // ── Kürbishände (vorn): Arm = Liane, Hand = Kürbis ──
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const H = hands[i];
            const sx = s * 30, sy = -64 + bob;
            Art.limb(ctx, sx, sy, H.x, H.y, 11, '#4f8f3a', { lineWidth: 2.2 });
            // Ranke am Gelenk
            ctx.strokeStyle = '#67ad4c';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(sx - s * 8, sy - 8 + Math.sin(t * 4 + i) * 2, sx - s * 4, sy - 14);
            ctx.stroke();
            if (H.hot > 0) Art.glow(ctx, H.x, H.y, 34, p2 ? '#ff3b1a' : PUMPKIN_GLOW, 0.55 * H.hot);
            const r = 16;
            ctx.save();
            ctx.translate(H.x, H.y);
            ctx.rotate(Math.sin(t * 3 + i * 2) * 0.14 + (H.hot > 0.6 ? (t * 22 % TAU) * 0.1 * s : 0));
            PumpkinKit.pumpkin(ctx, 0, 0, r, i === 0 ? '#ff9430' : '#f5741f', H.hot * 0.7, 2, i === 0 || H.hot > 0.5);
            ctx.restore();
        }
    }
}
