// ── Welt 41: Adlerhorst ── (Idee von Leander)
// Adler: braun mit weißem Kopf und gelbem Schnabel. Sie kreisen fliegend über Mark oder einem Freund,
//   ihr Schattenteller am Boden zeigt das Ziel (0,7 s Warnung, wird dunkler), dann stürzen sie mit
//   ausgestreckten Krallen herab und steigen wieder auf. Einer trägt den Schlüssel (isKeyGhost, main.js).
// Riesenadler (Boss, 130 LP): riesiger Adler mit goldenen Federspitzen.
//   Federhagel: breitet die Flügel (0,6–0,75 s Warnstrahlen), Fächer aus spitzen Federn auf Mark und
//     Freunde; Phase 2 schießt er danach drei rotierende Ringe hintereinander.
//   Picken: duckt sich (0,8 s Warnlinie am Boden), dann schneller Schnabel-Vorstoß zu Mark.
//   Krallen-Sturzflug: steigt hoch (verlässt kurz das Bild nach oben, nur sein Schatten folgt Mark),
//     stürzt mit Krallen herab; Phase 2 zweimal hintereinander.
//   Ruft bis zu 4 junge Adler in den Boss-Raum – sie verpuffen, wenn der Boss besiegt ist.
// Nach jedem großen Angriff keucht er unten (Verschnaufpause – Zeit zum Zurückhauen).
// Fairness: jeder Angriff wird angekündigt; Freunde verschwinden nie (tödlicher Treffer = K.o. über knockOut).

const EAGLE_BROWN = '#8a5a34', EAGLE_BROWN2 = '#7a4c2a', EAGLE_DARK = '#54341c';
const EAGLE_HEAD = '#f7f1e4', EAGLE_BEAK = '#ffb020', EAGLE_TALON = '#ffc23c';
const EAGLE_GOLD = '#ffd23f';
const EAGLE_WARN = 0.7;       // Zielmarkierung des normalen Adlers (Sekunden)
const EAGLE_DIVE = 0.34;      // Sturzflugdauer des normalen Adlers
const EAGLE_FEATHER_CAP = 50; // nie mehr als so viele Adler-Geschosse gleichzeitig (Handy)

const EagleArt = {
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
        this.burst(c.x + c.w / 2, c.y + c.h / 2, [EAGLE_TALON, '#ffffff'], 10, 140, 0.45, { kind: 'star' });
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

    // Fingerspitzen des Flügels (relativ zur Schulter, nach rechts gezeigt; links über s = -1).
    fingers: [[34, -40], [44, -26], [48, -10], [44, 4], [30, 12]],

    // Federflügel mit fünf Fingern: (0, 0) = Schulter, s = Seite (+1/-1), sz = Größe (1 ≈ 48 Einheiten lang).
    // tipCol = Farbe der Fingerspitzen (sonst dunkle Körperfarbe).
    wing(ctx, s, sz, col, lw, tipCol) {
        Art.shape(ctx, c => {
            c.moveTo(0, -8);
            c.quadraticCurveTo(s * 14, -30, s * 34, -40);
            c.quadraticCurveTo(s * 30, -28, s * 44, -26);
            c.quadraticCurveTo(s * 38, -18, s * 48, -10);
            c.quadraticCurveTo(s * 40, -6, s * 44, 4);
            c.quadraticCurveTo(s * 32, 2, s * 30, 12);
            c.quadraticCurveTo(s * 20, 8, s * 16, 16);
            c.quadraticCurveTo(s * 8, 10, 0, 14);
            c.closePath();
        }, { x: s > 0 ? 0 : -48 * sz, y: -40 * sz, w: 48 * sz, h: 56 * sz }, col, { lineWidth: lw });
        ctx.fillStyle = tipCol || Art.dark(col, 0.28);
        ctx.beginPath();
        for (const [fx, fy] of EagleArt.fingers) {
            ctx.moveTo(s * (fx - 3.6) * sz, fy * sz);
            ctx.ellipse(s * fx * sz, fy * sz, 3.6 * sz, 2.5 * sz, s * 0.5, 0, TAU);
        }
        ctx.fill();
        // Federlinien
        ctx.strokeStyle = Art.alpha(Art.ink(col), 0.5);
        ctx.lineWidth = Math.max(0.7, lw * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * 6, 2);
        ctx.quadraticCurveTo(s * 20, -14, s * 32, -22);
        ctx.moveTo(s * 6, 6);
        ctx.quadraticCurveTo(s * 18, -4, s * 30, -8);
        ctx.stroke();
    },

    // Krallenhand: drei gelbe Krallen von (x, y) in Richtung a; open = Spreizung 0..1, s = Größe.
    talon(ctx, x, y, a, open, s, lw) {
        const len = (6 + open * 4.5) * s;
        for (let i = -1; i <= 1; i++) {
            const ca = a + i * (0.28 + 0.34 * open);
            Art.limb(ctx, x, y, x + Math.cos(ca) * len, y + Math.sin(ca) * len, 1.6 * s, EAGLE_TALON, { lineWidth: lw });
        }
    },

    // Spitze Feder (Spitze zeigt nach +x), s = Größe, gold = Bossfeder.
    feather(ctx, s, gold) {
        ctx.beginPath();
        ctx.moveTo(-10 * s, 0);
        ctx.quadraticCurveTo(-2 * s, -3.4 * s, 8 * s, -1 * s);
        ctx.lineTo(10.5 * s, 0);
        ctx.lineTo(8 * s, 1 * s);
        ctx.quadraticCurveTo(-2 * s, 3.4 * s, -10 * s, 0);
        ctx.fillStyle = gold ? EAGLE_GOLD : '#efe4cf';
        ctx.fill();
        ctx.strokeStyle = EAGLE_DARK;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = Art.alpha(EAGLE_DARK, 0.55);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-9 * s, 0);
        ctx.lineTo(8 * s, 0);
        ctx.stroke();
    },
};

// ══════════════════════════════════════════
// ── Adler ──
// ══════════════════════════════════════════

// Brauner Adler mit weißem Kopf. Zustände: wander → circle (über dem Ziel kreisen) →
// warn (Schattenteller am Ziel wird dunkler, 0,7 s) → dive (Sturzflug mit Krallen) → climb → circle …
// Der Ziel-Schattenteller wird über drawUnder gezeichnet. Trifft Mark ODER einen Freund.
class Eagle extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 24);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(62, 74);
        this.damage = 1;
        this.contactDamage = false;  // gefährlich ist nur der Sturzflug
        this.phasesThroughWalls = false; // Schlüssel darf nicht in der Wand landen
        this.flying = true;
        this.detectionRange = 260;
        this.seed = Math.random() * 10;
        this.tint = Math.random() < 0.35 ? EAGLE_BROWN2 : EAGLE_BROWN;
        this.fxColor = this.tint;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.state = 'wander';
        this.stateT = randRange(0.3, 1);
        this.stateDur = this.stateT;
        this.height = 44;            // reine Darstellung: Schwebhöhe über dem Hitbox-Boden
        this.orbA = Math.random() * TAU;
        this.orbDir = Math.random() < 0.5 ? 1 : -1;
        this.attackT = randRange(1.2, 2.6);
        this.engaged = false;
        this.tgt = null;             // gewähltes Ziel (Mark oder Freund)
        this.aimTgt = null;          // fürs Warnen und den Sturzflug
        this.tx = x; this.ty = y;    // Ziel-/Aufprallpunkt
        this.sx = x; this.sy = y;    // Startpunkt des Sturzflugs
        this.wx = 0; this.wy = 0;
        this.summoner = null;        // gesetzt bei gerufenen jungen Adlern (Boss-Helfer)
        this.small = false;
        this._keyInit = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        // Gerufener junger Adler: verpufft mit seinem Boss und bleibt im Boss-Raum
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                EagleArt.burst(this.centerX(), this.centerY(), [EAGLE_GOLD, '#ffffff'], 8, 90, 0.4, { kind: 'star' });
                return;
            }
            const room = BossMushroomGiant.room(world);
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): etwas zäher
            this._keyInit = true;
            this.hp = this.maxHp = 9;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dist = Math.hypot(px - mx, py - my) || 1;
        if (player.dead) this.engaged = false;
        else if (this.summoner || dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 80) this.engaged = false;

        switch (this.state) {
            case 'wander': this._wander(dt, world); break;
            case 'circle': this._circle(dt, world, player, px, py); break;
            case 'warn': this._warn(dt, world, player, px, py); break;
            case 'dive': this._dive(dt, player); break;
            case 'climb': this._climb(dt, world); break;
            default: this._set('wander', 1);
        }
    }

    // Bewegung mit Wandkollision (vx, vy = Geschwindigkeit)
    _move(dt, world, vx, vy) {
        const sp = Math.hypot(vx, vy);
        if (sp < 1) return false;
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * dt, vy * dt, world);
        return Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3; // festgefahren?
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    _wander(dt, world) {
        this.stateT -= dt;
        if (this.stateT <= 0) {
            this.stateT = randRange(1.2, 2.6);
            const a = Math.random() * TAU;
            this.wx = Math.cos(a);
            this.wy = Math.sin(a);
        }
        this.height += (38 - this.height) * Math.min(1, dt * 2);
        if (this._move(dt, world, this.wx * 26, this.wy * 26)) this.stateT = 0;
        this._look(this.wx * 0.6, this.wy * 0.6 + 0.2, dt);
        if (Math.abs(this.wx) > 0.2) this.face = this.wx > 0 ? 1 : -1;
        if (this.engaged) {
            this.tgt = null;
            this._set('circle', 0);
        }
    }

    // Sucht sich ein Opfer: meistens Mark, manchmal ein Freund in der Nähe (mit freier Sicht)
    _pickTarget(player, world, px, py) {
        const opts = [];
        for (const c of EagleArt.companions()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - this.centerX(), cy - this.centerY()) > 240) continue;
            if (typeof Juri !== 'undefined' && !Juri.lineClear(world, this.centerX(), this.centerY() - 8, cx, cy)) continue;
            opts.push(c);
        }
        if (opts.length && Math.random() < 0.35) return opts[Math.floor(Math.random() * opts.length)];
        return player;
    }

    _circle(dt, world, player, px, py) {
        if (!this.engaged) {
            this.tgt = null;
            this._set('wander', randRange(0.8, 1.8));
            return;
        }
        if (!this.tgt) this.tgt = this._pickTarget(player, world, px, py);
        let tg = this.tgt;
        if (tg !== player && (tg.dead || tg.koTimer > 0)) { tg = this.tgt = player; }
        const tx = tg === player ? px : tg.x + tg.w / 2;
        const ty = tg === player ? py : tg.y + tg.h / 2;
        const R = this.small ? 55 : 78;
        this.orbA += this.orbDir * dt * 1.5;
        const dx = tx + Math.cos(this.orbA) * R - this.centerX();
        const dy = ty + Math.sin(this.orbA) * R * 0.7 - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (this._move(dt, world, (dx / d) * this.speed, (dy / d) * this.speed)) this.orbDir = -this.orbDir;
        this.height += ((this.small ? 40 : 48) - this.height) * Math.min(1, dt * 3);
        const lx = tx - this.centerX(), ly = ty - this.centerY();
        const ld = Math.hypot(lx, ly) || 1;
        this._look(lx / ld, ly / ld, dt);
        if (Math.abs(lx) > 3) this.face = lx > 0 ? 1 : -1;

        this.attackT -= dt;
        if (this.attackT <= 0) {
            if (ld < (this.small ? 150 : 200)) {
                this.aimTgt = tg;
                this.tx = tx;
                this.ty = ty;
                this._set('warn', EAGLE_WARN);
            } else {
                this.attackT = 0.4;
            }
        }
    }

    // Ankündigung: hält über dem Ziel, der Schattenteller (drawUnder) wird dunkler.
    // Die letzten 0,18 s steht der Aufprallpunkt fest, damit Kinder ausweichen können.
    _warn(dt, world, player, px, py) {
        this.stateT -= dt;
        let tg = this.aimTgt;
        if (tg !== player && (tg.dead || tg.koTimer > 0)) tg = this.aimTgt = player;
        if (player.dead && this.aimTgt === player) {
            this._set('climb', 0.4);
            return;
        }
        const tx = tg === player ? px : tg.x + tg.w / 2;
        const ty = tg === player ? py : tg.y + tg.h / 2;
        if (this.stateT > 0.18) { this.tx = tx; this.ty = ty; }
        // über das Ziel ziehen und dabei tiefer gehen
        const dx = this.tx - this.centerX(), dy = this.ty - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        const pull = Math.min(this.speed * 1.5, d * 2.4);
        this._move(dt, world, (dx / d) * pull, (dy / d) * pull);
        this.height += (58 - this.height) * Math.min(1, dt * 5);
        this._look(dx / d, dy / d, dt);
        if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
        if (this.stateT <= 0) {
            this.sx = this.centerX();
            this.sy = this.centerY();
            this.contactDamage = true;
            this._set('dive', EAGLE_DIVE);
        }
    }

    _dive(dt, player) {
        this.stateT -= dt;
        const k = clamp(1 - this.stateT / EAGLE_DIVE, 0, 1);
        const e = k * k; // wird nach unten schneller
        this.x = this.sx + (this.tx - this.sx) * e - this.w / 2;
        this.y = this.sy + (this.ty - this.sy) * e - this.h / 2;
        this.height = 58 * (1 - k);
        const dx = this.tx - this.sx, dy = this.ty - this.sy;
        const d = Math.hypot(dx, dy) || 1;
        this._look(dx / d, dy / d, dt);
        if (this.stateT <= 0) {
            this.contactDamage = false;
            this._impact(player);
            this.tgt = null;
            this.aimTgt = null;
            this.attackT = randRange(1.3, 2.2);
            this._set('climb', 0.55);
        }
    }

    // Aufprall: trifft Mark und Freunde im Krallenkreis
    _impact(player) {
        const tx = this.tx, ty = this.ty;
        const R = this.small ? 22 : 26;
        let hitAny = false;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - tx, py - ty) < R + player.w / 3) {
                const before = player.hp;
                EagleArt.hurt(player, 1, Math.atan2(py - ty, px - tx), 180);
                hitAny = player.hp < before;
            }
        }
        for (const c of EagleArt.companions()) {
            if (c.iFrames > 0) continue;
            if (Math.hypot(c.x + c.w / 2 - tx, c.y + c.h / 2 - ty) < R + Math.max(c.w, c.h) / 3) {
                EagleArt.hitCompanion(c, 1);
                hitAny = true;
            }
        }
        EagleArt.ring(tx, ty, '#ffffff', R + 8, 0.3, 3);
        EagleArt.burst(tx, ty, ['#efe4cf', '#ffffff', this.tint], hitAny ? 10 : 6, 110, 0.4, { kind: 'star' });
        EagleArt.burst(tx, ty + 8, ['rgba(180,160,120,0.8)', '#ffffff'], 5, 50, 0.5, { kind: 'smoke', size: 5 });
        if (hitAny) EagleArt.shake(3, 0.15);
    }

    _climb(dt, world) {
        this.stateT -= dt;
        this.height += (46 - this.height) * Math.min(1, dt * 4);
        const dx = this.centerX() - this.tx, dy = this.centerY() - this.ty;
        const d = Math.hypot(dx, dy) || 1;
        this._move(dt, world, (dx / d) * this.speed * 0.8, (dy / d) * this.speed * 0.8);
        if (this.stateT <= 0) this._set('circle', 0);
    }

    // Dunkler Schattenteller übers Ziel: wird während der Warnung dunkler (faire Kinder-Warnung)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st !== 'warn' && st !== 'dive') return;
        const p = camera.worldToScreen(this.tx, this.ty);
        const k = st === 'warn' ? clamp(1 - this.stateT / EAGLE_WARN, 0, 1) : 1;
        const prev = ctx.globalAlpha;
        ctx.fillStyle = '#2a1c0e';
        ctx.globalAlpha = prev * (0.1 + 0.34 * k);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, (this.small ? 13 : 16) + 6 * k, (this.small ? 4.5 : 5.5) + 2.2 * k, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev;
        if (k > 0.55) Art.ring(ctx, p.x, p.y, (this.small ? 20 : 26), '#ffe0a8', 2, 0.4 + 0.4 * Math.sin(Art.time * 20));
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 18)) {
                ctx.translate(cx, by - 14);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, by - this.height);
        if (this.small) ctx.scale(0.68, 0.68);
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) {
            LateWorldArt.keyBadge(ctx, cx, pos.y - this.height - 24 + Math.sin(Art.time * 3 + this.seed) * 2);
        }
    }

    // Adler mit Aufhängepunkt (0, 0) (Schwebhöhe schon abgezogen)
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const st = dead ? 'dead' : this.state;
        let flap = Math.sin(t * (this.engaged ? 7 : 4.5) + sd) * 0.3 - 0.1;
        let lean = 0, talon = 0, spread = 1;
        if (st === 'warn') {
            const k = clamp(1 - this.stateT / EAGLE_WARN, 0, 1);
            flap = -0.45 + Math.sin(t * 16 + sd) * 0.12;
            talon = 0.5 * k;
            lean = f * 0.12 * k;
        } else if (st === 'dive') {
            const k = clamp(1 - this.stateT / EAGLE_DIVE, 0, 1);
            flap = -0.95;
            talon = 1;
            lean = f * (0.25 + 0.5 * k);
        } else if (st === 'climb') {
            flap = 0.55 * clamp(this.stateT / 0.55, 0, 1);
            spread = 1.1;
            lean = -f * 0.14;
        } else if (st === 'dead') {
            flap = 0.6;
            lean = 0.35;
        }
        const bob = (st === 'dive' || st === 'dead') ? 0 : Math.sin(t * 3.2 + sd) * 1.6;
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -14, 24, EAGLE_GOLD, 0.35 + 0.1 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(0, bob);
        if (lean) {
            ctx.translate(0, -12);
            ctx.rotate(lean);
            ctx.translate(0, 12);
        }
        // Schwanzfedern hinter dem Körper
        const tx0 = f > 0 ? -19 : 8;
        Art.shape(ctx, c => {
            c.moveTo(-f * 8, -14);
            c.quadraticCurveTo(-f * 17, -12, -f * 19, -6);
            c.quadraticCurveTo(-f * 13, -7, -f * 9, -9);
            c.closePath();
        }, { x: tx0, y: -14, w: 11, h: 8 }, this.tint, { lineWidth: 1.2 });
        // Flügel hinter dem Körper
        for (let s = -1; s <= 1; s += 2) {
            ctx.save();
            ctx.translate(s * 4, -15);
            ctx.rotate(s * flap);
            ctx.scale(1, spread);
            EagleArt.wing(ctx, s, 0.5, this.tint, 1.2);
            ctx.restore();
        }
        // Körper mit heller Brust
        Art.body(ctx, 0, -12, 11, 9, this.tint, { glossy: true, lineWidth: 1.4 });
        Art.body(ctx, f * 3.5, -9, 5.5, 4.4, EAGLE_HEAD, { outline: false, highlight: false });
        // Krallen: vor dem Stoß angezogen, im Sturzflug ausgestreckt
        const ta = Math.PI / 2 + f * talon * 0.6;
        EagleArt.talon(ctx, -3, -5, ta - 0.12, talon, 1, 0.9);
        EagleArt.talon(ctx, 3, -5, ta + 0.12, talon, 1, 0.9);
        // Kopf
        const hx = f * 5, hy = -21;
        Art.body(ctx, hx, hy, 6.8, 6.2, EAGLE_HEAD, { lineWidth: 1.4 });
        // gelber Schnabel mit Haken
        Art.shape(ctx, c => {
            c.moveTo(hx + f * 3, hy - 1.5);
            c.quadraticCurveTo(hx + f * 10, hy - 1, hx + f * 12, hy + 2.5);
            c.quadraticCurveTo(hx + f * 9, hy + 2, hx + f * 8, hy + 4.5);
            c.quadraticCurveTo(hx + f * 5, hy + 4, hx + f * 3, hy + 3);
            c.closePath();
        }, { x: f > 0 ? hx + 3 : hx - 12, y: hy - 1.5, w: 9, h: 6 }, EAGLE_BEAK, { lineWidth: 1.2 });
        if (dead) LateWorldArt.xEyes(ctx, hx + f, hy - 1, 1.4, 2.6);
        else Art.eyes(ctx, hx + f, hy - 1, 2.1, { gap: 2.6, look: this.look, angry: true, iris: '#5a3413', seed: sd });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Adlerfeder (Geschoß des Riesenadlers) ──
// ══════════════════════════════════════════

// Spitz, golden, mit kurzem Schweif. Trifft Mark über die Engine; hitsCompanions + stunTime
// lässt die Engine auch Juri und das Krokodil treffen (die werden betäubt, nie besiegt).
class EagleFeather extends Projectile {
    constructor(x, y, angle, speed) {
        const sp = speed || randRange(150, 190);
        super(x, y, Math.cos(angle) * sp, Math.sin(angle) * sp, 1, 'enemy', 70);
        this.radius = 6;
        this.lifetime = 2.3;
        this.hitsCompanions = true;
        this.stunTime = 2;
        this.wob = Math.random() * 10;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.3;
        ctx.fillStyle = EAGLE_GOLD;
        ctx.beginPath();
        ctx.moveTo(p.x - dy * 4, p.y + dx * 4);
        ctx.lineTo(p.x - dx * 16, p.y - dy * 16);
        ctx.lineTo(p.x + dy * 4, p.y - dx * 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev;
        Art.glow(ctx, p.x, p.y, 12, EAGLE_GOLD, 0.5);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(dy, dx) + Math.sin(this.age * 14 + this.wob) * 0.3);
        EagleArt.feather(ctx, 0.85, true);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 41: Riesenadler ──
// ══════════════════════════════════════════

// Riesiger brauner Adler mit goldenen Federspitzen, 130 LP. Bleibt immer im Boss-Raum
// (die Engine klemmt ihn zusätzlich pro Bild ein). Ablauf Phase 1:
//   Schweben → Federhagel → Schweben → Picken → Schweben → Krallen-Sturzflug → Verschnaufpause …
// Phase 2 (halbe LP): Wutausbruch, schneller; Federhagel schießt zusätzlich rotierende Ringe,
//   der Sturzflug kommt zweimal hintereinander. Nach jedem großen Angriff: keuchende Pause.
class BossGiantEagle extends Enemy {
    constructor(x, y) {
        super(x, y, 92, 80);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 42;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false; // gefährlich sind Federn, Schnabel und Krallen
        this.phasesThroughWalls = false;
        this.flying = true;
        this.fxColor = '#e8c27a';
        this.shadow = { rx: 36, ry: 10, dy: 26 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.face = -1;
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.height = 130; // reine Darstellung (Steighöhe im Sturzflug)
        this.fade = 1;     // reine Darstellung (aus dem Bild heraus verblassen)
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.moving = false;
        this.fanA = 0;
        this.fanLock = false;
        this.fanFriend = null;
        this.ringLeft = 0;
        this.ringT = 0;
        this.ringA = 0;
        this.laneA = 0;
        this.laneLen = 120;
        this.laneLock = false;
        this.hitP = false;
        this.tx = x; this.ty = y; // Sturzflug-Ziel (Schatten folgt Mark)
        this.sx = x; this.sy = y; // Startpunkt des Sturzflugs
        this.diveRound = 0;
        this.summonT = 8;
        this.summoned = [];
        this._pz = {};
        this.noShadow = false; // im Sturzflug ersetzt der Ziel-Schattenteller den eigenen
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Ein Riese in Federn lässt sich kaum wegschubsen.
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.15);
    }

    _room(world) {
        return BossMushroomGiant.room(world);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this._roar();
        const p2 = this.phase === 2;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const mx = this.centerX(), my = this.centerY();
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        const kl = Math.min(1, dt * 6);
        this.look.x += (dx / dist - this.look.x) * kl;
        this.look.y += (dy / dist - this.look.y) * kl;
        if (this.state !== 'diveDrop' && Math.abs(dx) > 14) this.face = dx > 0 ? 1 : -1;
        this.moving = false;

        // Junge Adler rufen: nur im Boss-Raum, höchstens 4 gleichzeitig, verpuffen mit dem Boss
        this.summoned = this.summoned.filter(e => !e.dead);
        this.summonT -= dt;
        if (this.summonT <= 0) {
            this.summonT = p2 ? 10 : 13;
            this._summon(world, player);
        }

        switch (this.state) {
            case 'intro':
                this.stateT -= dt;
                this.height += (54 - this.height) * Math.min(1, dt * 2);
                if (this.stateT <= 0) this._set('hover', 1.1);
                break;
            case 'roar':
                this.stateT -= dt;
                this.height += (54 - this.height) * Math.min(1, dt * 3);
                if (this.stateT <= 0) this._set('hover', 0.5);
                break;
            case 'hover':
                this._hover(dt, world, px, py);
                this.stateT -= dt;
                if (this.stateT <= 0) this._nextAttack();
                break;
            case 'featherWind': this._featherWind(dt, px, py, mx, my, projectiles); break;
            case 'feathers2': this._feathers2(dt, mx, my, projectiles); break;
            case 'peckCrouch': this._peckCrouch(dt, px, py, mx, my, dist); break;
            case 'peckLunge': this._peckLunge(dt, world, player); break;
            case 'peckBack':
                this.stateT -= dt;
                this.height += (54 - this.height) * Math.min(1, dt * 4);
                this._move(dt, world, -Math.cos(this.laneA) * 60, -Math.sin(this.laneA) * 60);
                if (this.stateT <= 0) this._set('recover', 0.9);
                break;
            case 'diveRise': this._diveRise(dt, world, px, py); break;
            case 'diveDrop': this._diveDrop(dt, world, player, p2); break;
            case 'recover':
                this.stateT -= dt;
                this.noShadow = false;
                this.height += (54 - this.height) * Math.min(1, dt * 3);
                this.fade += (1 - this.fade) * Math.min(1, dt * 5);
                if (this.stateT <= 0) this._set('hover', p2 ? 0.7 : 1.1);
                break;
            default:
                this._set('hover', 1);
        }
    }

    _move(dt, world, vx, vy) {
        const sp = Math.hypot(vx, vy);
        if (sp < 1) return;
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * dt, vy * dt, world);
        this.moving = true;
        if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) this.strafe = -this.strafe;
    }

    // hält Abstand: näher wenn Mark weit weg, zurück wenn er zu nah ist, sonst seitwärts
    _hover(dt, world, px, py) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        const sp = this.speed * (this.phase === 2 ? 1.35 : 1);
        let vx, vy;
        if (d > 155) { vx = dx / d; vy = dy / d; }
        else if (d < 95) { vx = -dx / d; vy = -dy / d; }
        else { vx = (-dy / d) * this.strafe; vy = (dx / d) * this.strafe; }
        this._move(dt, world, vx * sp, vy * sp);
        this.height += (54 - this.height) * Math.min(1, dt * 3);
    }

    _roar() {
        this.phase = 2;
        this.speed = 52;
        this._set('roar', 0.9);
        const x = this.centerX(), y = this.centerY() - 40;
        EagleArt.shake(6, 0.45);
        EagleArt.burst(x, y, [EAGLE_GOLD, '#ffffff', '#ff8a5a'], 18, 190, 0.6, { kind: 'star' });
        EagleArt.ring(x, y + 30, EAGLE_GOLD, 110, 0.5, 5);
        if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
    }

    _nextAttack() {
        const n = this.seq++;
        if (this.phase === 1) {
            if (n % 3 === 0) this._startFeathers();
            else if (n % 3 === 1) this._startPeck();
            else this._startDive();
        } else {
            if (n % 4 === 0) this._startFeathers();
            else if (n % 4 === 1) this._startPeck();
            else this._startDive();
        }
    }

    // ── a) Federhagel ──

    _startFeathers() {
        this.fanLock = false;
        this.fanFriend = null;
        const opts = EagleArt.companions();
        if (opts.length && Math.random() < 0.7) this.fanFriend = opts[Math.floor(Math.random() * opts.length)];
        this._set('featherWind', this.phase === 2 ? 0.6 : 0.75);
    }

    _featherWind(dt, px, py, mx, my, projectiles) {
        this.stateT -= dt;
        if (!this.fanLock) {
            this.fanA = Math.atan2(py - my, px - mx);
            if (this.stateT <= 0.2) this.fanLock = true; // Richtung steht fest
        }
        this.height += (62 - this.height) * Math.min(1, dt * 4);
        if (this.stateT <= 0) {
            this._fireFan(projectiles, mx, my);
            if (this.phase === 2) {
                this.ringLeft = 3;
                this.ringT = 0.18;
                this.ringA = this.fanA;
                this._set('feathers2', 1.1);
            } else {
                this._set('recover', 1.5);
            }
        }
    }

    _fireFan(projectiles, mx, my) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const ox = mx, oy = my - 6;
        if (list.length > EAGLE_FEATHER_CAP) {
            EagleArt.burst(ox, oy, [EAGLE_GOLD, '#ffffff'], 6, 90, 0.35, { kind: 'spark' });
            return;
        }
        for (let i = -3; i <= 3; i++) list.push(new EagleFeather(ox, oy, this.fanA + i * 0.19));
        const fr = this.fanFriend;
        if (fr && !fr.dead && !(fr.koTimer > 0) && list.length <= EAGLE_FEATHER_CAP) {
            const a = Math.atan2(fr.y + fr.h / 2 - oy, fr.x + fr.w / 2 - ox);
            list.push(new EagleFeather(ox, oy, a));
        }
        EagleArt.burst(ox, oy, [EAGLE_GOLD, '#ffffff', '#efe4cf'], 12, 150, 0.4, { kind: 'spark' });
        EagleArt.shake(3, 0.15);
    }

    // Phase 2: drei rotierende Feder-Ringe kurz nacheinander
    _feathers2(dt, mx, my, projectiles) {
        this.stateT -= dt;
        this.ringT -= dt;
        this.height += (66 - this.height) * Math.min(1, dt * 4);
        if (this.ringT <= 0 && this.ringLeft > 0) {
            this.ringLeft--;
            this.ringT = 0.26;
            this.ringA += 0.35;
            const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
            if (list && list.length <= EAGLE_FEATHER_CAP) {
                for (let i = 0; i < 9; i++) list.push(new EagleFeather(mx, my - 6, this.ringA + (TAU * i) / 9, 150));
            }
            EagleArt.ring(mx, my, EAGLE_GOLD, 46, 0.3, 3);
        }
        if (this.stateT <= 0 || (this.ringLeft === 0 && this.ringT <= 0)) this._set('recover', 1.3);
    }

    // ── b) Picken ──

    _startPeck() {
        this.laneLock = false;
        this.hitP = false;
        this._set('peckCrouch', this.phase === 2 ? 0.65 : 0.8);
    }

    _peckCrouch(dt, px, py, mx, my, dist) {
        this.stateT -= dt;
        this.laneA = Math.atan2(py - my, px - mx);
        this.laneLen = clamp(dist + 34, 60, 300);
        if (this.stateT <= 0.22) this.laneLock = true; // Bahn steht fest
        this.height += (34 - this.height) * Math.min(1, dt * 6); // duckt sich
        if (this.stateT <= 0) this._set('peckLunge', 0.22);
    }

    _peckLunge(dt, world, player) {
        this.stateT -= dt;
        const sp = this.laneLen / 0.22;
        this._move(dt, world, Math.cos(this.laneA) * sp, Math.sin(this.laneA) * sp);
        const bx = this.centerX() + Math.cos(this.laneA) * (this.w / 2 + 16);
        const by = this.centerY() + Math.sin(this.laneA) * (this.h / 2 + 16);
        if (player && !player.dead && player.iFrames <= 0 && !this.hitP &&
            Math.hypot(player.x + player.w / 2 - bx, player.y + player.h / 2 - by) < 30 + player.w / 2) {
            this.hitP = true;
            EagleArt.hurt(player, 2, this.laneA, 260);
            EagleArt.burst(player.x + player.w / 2, player.y + player.h / 2, [EAGLE_GOLD, '#ffffff'], 10, 150, 0.45, { kind: 'star' });
        }
        for (const c of EagleArt.companions()) {
            if (c.iFrames > 0) continue;
            if (Math.hypot(c.x + c.w / 2 - bx, c.y + c.h / 2 - by) < 30 + Math.max(c.w, c.h) / 2) {
                EagleArt.hitCompanion(c, 2);
            }
        }
        if (this.stateT <= 0) this._set('peckBack', 0.35);
    }

    // ── c) Krallen-Sturzflug ──

    _startDive() {
        this.diveRound = 1;
        this._set('diveRise', 1.05);
    }

    // hoch steigen: der Boss verlässt kurz das Bild nach oben, nur sein Schatten folgt Mark
    _diveRise(dt, world, px, py) {
        this.stateT -= dt;
        this.noShadow = true;
        const second = this.diveRound === 2;
        this.height += ((second ? 150 : 235) - this.height) * Math.min(1, dt * 5);
        this.fade += (0.22 - this.fade) * Math.min(1, dt * 4);
        this.tx = px;
        this.ty = py;
        // ground-Position sanft nachziehen, damit der Sturzflug nicht von weit her kommen muss
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d > 30) this._move(dt, world, (dx / d) * 70, (dy / d) * 70);
        if (this.stateT <= 0) {
            const room = this._room(world);
            if (room) {
                this.tx = clamp(this.tx, room.x + 34, room.x + room.w - 34);
                this.ty = clamp(this.ty, room.y + 30, room.y + room.h - 30);
            }
            this.sx = this.centerX();
            this.sy = this.centerY();
            this._set('diveDrop', this.diveRound === 2 ? 0.34 : 0.42);
        }
    }

    _diveDrop(dt, world, player, p2) {
        this.stateT -= dt;
        const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
        const e = k * k;
        this.x = this.sx + (this.tx - this.sx) * e - this.w / 2;
        this.y = this.sy + (this.ty - this.sy) * e - this.h / 2;
        this.height = Math.max(4, (this.diveRound === 2 ? 150 : 235) * (1 - e));
        this.fade += (1 - this.fade) * Math.min(1, dt * 8);
        if (this.stateT <= 0) {
            this._slam(player);
            if (p2 && this.diveRound === 1) {
                this.diveRound = 2;
                this._set('diveRise', 0.5);
            } else {
                this.diveRound = 0;
                this.noShadow = false;
                this._set('recover', p2 ? 1.6 : 1.9);
            }
        }
    }

    // Aufprall mit den Krallen: trifft Mark und Freunde im großen Kreis
    _slam(player) {
        const tx = this.tx, ty = this.ty, R = 78;
        if (player && !player.dead &&
            Math.hypot(player.x + player.w / 2 - tx, player.y + player.h / 2 - ty) < R + player.w / 2 - 6) {
            const before = player.hp;
            EagleArt.hurt(player, 2, Math.atan2(player.y + player.h / 2 - ty, player.x + player.w / 2 - tx), 320);
            if (player.hp < before) {
                EagleArt.burst(player.x + player.w / 2, player.y + player.h / 2, [EAGLE_GOLD, '#ffffff'], 12, 160, 0.5, { kind: 'star' });
            }
        }
        for (const c of EagleArt.companions()) {
            if (c.iFrames > 0) continue;
            if (Math.hypot(c.x + c.w / 2 - tx, c.y + c.h / 2 - ty) < R + Math.max(c.w, c.h) / 2 - 6) {
                EagleArt.hitCompanion(c, 2);
            }
        }
        EagleArt.ring(tx, ty, '#ffe9a8', R, 0.5, 6);
        EagleArt.burst(tx, ty + 10, ['#efe4cf', '#ffffff', EAGLE_BROWN], 16, 190, 0.55, { kind: 'spark' });
        EagleArt.burst(tx, ty + 16, ['rgba(180,160,120,0.85)', '#ffffff'], 8, 60, 0.6, { kind: 'smoke', size: 7 });
        EagleArt.shake(7, 0.35);
    }

    // ── d) Junge Adler rufen (Helfer, max. 4, nur im Boss-Raum) ──

    _summon(world, player) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || !Game._bossRoomRect || !Game.enemies) return;
        const want = Math.min(4 - this.summoned.length, 2);
        if (want <= 0) return;
        const room = Game._bossRoomRect();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 24 + Math.random() * (room.w - 48);
                const y = room.y + 24 + Math.random() * (room.h - 48);
                if (Math.hypot(x - px, y - py) < 90 || Math.hypot(x - this.centerX(), y - this.centerY()) < 55) continue;
                if (world.isWall(x - 13, y - 12) || world.isWall(x + 13, y - 12) || world.isWall(x - 13, y + 12) || world.isWall(x + 13, y + 12)) continue;
                const e = new Eagle(x, y);
                e.summoner = this;
                e.small = true;
                e.hp = e.maxHp = 4;
                e.engaged = true;
                e.state = 'circle';
                e.stateT = 0;
                e.attackT = randRange(0.8, 1.6);
                e.height = 40;
                Game.enemies.push(e);
                this.summoned.push(e);
                EagleArt.burst(x, y, [EAGLE_GOLD, '#ffffff', EAGLE_BROWN], 12, 120, 0.5, { kind: 'star' });
                EagleArt.ring(x, y + 8, EAGLE_GOLD, 26, 0.4, 3);
                break;
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
            this._drawEagle(ctx, true);
        } else {
            ctx.translate(cx, by - this.height);
            if (this.fade < 1) ctx.globalAlpha *= this.fade;
            const pers = 1 - (Math.min(this.height, 240) / 240) * 0.18;
            if (pers < 1) ctx.scale(pers, pers);
            this._drawEagle(ctx, false);
        }
        ctx.restore();
    }

    // Haltung aus dem Zustand (nur Darstellung)
    _pose(p, dead) {
        const st = dead ? 'dead' : this.state, t = Art.time, f = this.face, p2 = this.phase === 2;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        p.flap = Math.sin(t * (p2 ? 5.5 : 4) + this.seed) * 0.2;
        p.lean = 0;
        p.talon = 0;
        p.open = 0;
        p.droop = false;
        p.squash = 0;
        switch (st) {
            case 'intro':
                p.flap = -0.3 + Math.sin(t * 8) * 0.15;
                p.open = 0.5;
                break;
            case 'roar':
                p.flap = -0.6 + Math.sin(t * 16) * 0.08;
                p.open = 1;
                p.lean = -f * 0.08;
                break;
            case 'featherWind':
                p.flap = -0.95 + Math.sin(t * 18) * 0.06;
                p.lean = -f * 0.1 * k;
                p.open = 0.6;
                break;
            case 'feathers2':
                p.flap = -0.7 + Math.sin(t * 20) * 0.1;
                p.open = 0.4;
                break;
            case 'peckCrouch':
                p.lean = f * (0.18 + 0.16 * k);
                p.flap = 0.35 * k;
                p.open = 0.3;
                break;
            case 'peckLunge':
                p.lean = f * 0.42;
                p.flap = -0.6;
                p.open = 1;
                break;
            case 'peckBack':
                p.lean = f * 0.15 * (1 - k);
                p.flap = 0.2;
                break;
            case 'diveRise':
                p.flap = Math.sin(t * 22) * 0.45;
                p.lean = -f * 0.1;
                p.talon = 0.4;
                break;
            case 'diveDrop':
                p.flap = -1.15;
                p.lean = f * 0.28;
                p.talon = 1;
                p.open = 0.5;
                break;
            case 'recover':
                p.droop = true;
                p.flap = 0.5 + Math.sin(t * 2) * 0.05;
                p.open = 0.3 + 0.2 * Math.sin(t * 6);
                p.squash = this.stateDur - this.stateT < 0.18 ? 1 - (this.stateDur - this.stateT) / 0.18 : 0;
                break;
            case 'dead':
                p.flap = 0.5;
                p.lean = 0.25;
                break;
            default: break;
        }
        return p;
    }

    // Riesenadler mit Fußpunkt (0, 0)
    _drawEagle(ctx, dead) {
        const p = this._pose(this._pz, dead);
        const t = Art.time, f = this.face, p2 = this.phase === 2;
        const body = EAGLE_BROWN;
        if (p.squash > 0) ctx.scale(1 + 0.18 * p.squash, 1 - 0.22 * p.squash);
        if (p.lean) {
            ctx.translate(0, -44);
            ctx.rotate(p.lean);
            ctx.translate(0, 44);
        }
        if (p2 && !dead) Art.glow(ctx, 0, -46, 78, '#ff4d3d', 0.16 + 0.07 * Math.sin(t * 5));
        // Fächer-Schwanz mit goldenen Spitzen
        const sx0 = -f * 16;
        Art.shape(ctx, c => {
            c.moveTo(sx0, -52);
            c.quadraticCurveTo(sx0 - f * 16, -50, sx0 - f * 26, -34);
            c.quadraticCurveTo(sx0 - f * 12, -36, sx0 - f * 6, -32);
            c.quadraticCurveTo(sx0 - f * 2, -34, sx0, -36);
            c.closePath();
        }, { x: f > 0 ? sx0 - 26 : sx0, y: -52, w: 26, h: 20 }, body, { lineWidth: 2.2 });
        ctx.fillStyle = EAGLE_GOLD;
        ctx.beginPath();
        ctx.ellipse(sx0 - f * 21, -38, 3.6, 2.4, f * 0.7, 0, TAU);
        ctx.fill();
        // große Flügel hinter dem Körper
        for (let s = -1; s <= 1; s += 2) {
            ctx.save();
            ctx.translate(s * 14, -58);
            ctx.rotate(s * p.flap + (p.droop ? s * 0.5 : 0));
            EagleArt.wing(ctx, s, 1.35, body, 2.2, EAGLE_GOLD);
            ctx.restore();
        }
        // Körper mit heller Brust
        Art.body(ctx, 0, -40, 24, 20, body, { glossy: true, lineWidth: 2.4 });
        Art.body(ctx, f * 8, -34, 12, 10, EAGLE_HEAD, { outline: false, highlight: false });
        if (p2 && !dead) {
            // Risse im Gefieder: der Adler ist richtig wütend
            ctx.strokeStyle = '#3a2410';
            ctx.lineWidth = 1.3;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-12, -52); ctx.lineTo(-8, -45); ctx.lineTo(-11, -39);
            ctx.moveTo(11, -30); ctx.lineTo(8, -25);
            ctx.stroke();
        }
        // Beine mit Krallen (angezogen oder zum Stoß ausgestreckt)
        const legY = -22;
        for (let s = -1; s <= 1; s += 2) {
            const lx = s * 8 + f * 3;
            const fy = p.talon > 0 ? legY + 8 + p.talon * 6 : legY + 4;
            Art.limb(ctx, lx, legY - 6, lx, fy, 4.4, '#f0a51f', { lineWidth: 1.6 });
            EagleArt.talon(ctx, lx, fy, Math.PI / 2 + f * p.talon * 0.55, p.talon, 1.7, 1.6);
        }
        // Kopf mit gelbem Hakenschnabel
        const hx = f * 12, hy = -66;
        Art.body(ctx, hx, hy, 13, 12, EAGLE_HEAD, { lineWidth: 2.2 });
        // Ober Schnabel
        Art.shape(ctx, c => {
            c.moveTo(hx + f * 8, hy - 4);
            c.quadraticCurveTo(hx + f * 22, hy - 3, hx + f * 26, hy + 4);
            c.quadraticCurveTo(hx + f * 20, hy + 4, hx + f * 17, hy + 9);
            c.quadraticCurveTo(hx + f * 13, hy + 6, hx + f * 8, hy + 5);
            c.closePath();
        }, { x: f > 0 ? hx + 8 : hx - 26, y: hy - 4, w: 18, h: 13 }, EAGLE_BEAK, { lineWidth: 2.2, glossy: true });
        // Unterschnabel (geht beim Angriff auf)
        if (p.open > 0.1) {
            const o = p.open * 5;
            Art.shape(ctx, c => {
                c.moveTo(hx + f * 8, hy + 5 + o * 0.6);
                c.quadraticCurveTo(hx + f * 16, hy + 8 + o, hx + f * 20, hy + 10 + o);
                c.quadraticCurveTo(hx + f * 12, hy + 11 + o, hx + f * 8, hy + 9 + o * 0.6);
                c.closePath();
            }, { x: f > 0 ? hx + 8 : hx - 20, y: hy + 5, w: 12, h: 8 + o }, '#e0951a', { lineWidth: 1.5 });
        }
        if (dead) LateWorldArt.xEyes(ctx, hx + f * 2, hy - 1, 3, 5.5);
        else Art.eyes(ctx, hx + f * 2, hy - 1, 4.2, { gap: 5.5, look: this.look, angry: true, iris: p2 ? '#ff2d3a' : '#ffb627', seed: this.seed });
        // goldene Stirnfedern (Phase 2 als Wut-Kamm)
        ctx.fillStyle = p2 ? '#ff8a5a' : EAGLE_GOLD;
        ctx.beginPath();
        ctx.ellipse(hx - f * 4, hy - 11, 3.4, 2, -f * 0.6, 0, TAU);
        ctx.moveTo(hx - f * 9 + 2.8, hy - 8);
        ctx.ellipse(hx - f * 9, hy - 8, 2.8, 1.8, -f * 0.8, 0, TAU);
        ctx.fill();
        if (p.droop) LateWorldArt.dizzy(ctx, hx, hy - 22, 20, 3.4);
        if (p2 && !dead) Art.sparkle(ctx, f * 52, -84 + Math.sin(t * 3 + this.seed) * 4, 3, EAGLE_GOLD, 0.5 + 0.5 * Math.sin(t * 6));
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        if (st === 'featherWind' || st === 'feathers2') {
            const p = camera.worldToScreen(this.centerX(), this.centerY() - 6);
            if (st === 'featherWind') {
                LateWorldArt.rays(ctx, p.x, p.y, 7, this.fanA - 3 * 0.19, 24, 150, k);
            } else {
                LateWorldArt.rays(ctx, p.x, p.y, 9, this.ringA, 20, 118, 0.6 + 0.4 * Math.sin(Art.time * 16));
            }
        } else if (st === 'peckCrouch') {
            const ox = this.centerX() + Math.cos(this.laneA) * 34;
            const oy = this.centerY() + Math.sin(this.laneA) * 34;
            const p = camera.worldToScreen(ox, oy);
            LateWorldArt.lane(ctx, p.x, p.y, this.laneA, this.laneLen, 30, k);
        } else if (st === 'diveRise' || st === 'diveDrop') {
            const p = camera.worldToScreen(this.tx, this.ty);
            if (st === 'diveRise') {
                // Der Schatten des Adlers folgt Mark und wird dunkler – die einzige Warnung dort oben.
                const prev = ctx.globalAlpha;
                ctx.fillStyle = '#241a0e';
                ctx.globalAlpha = prev * (0.12 + 0.3 * k);
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, 26 + 12 * k, 9 + 4 * k, 0, 0, TAU);
                ctx.fill();
                ctx.globalAlpha = prev;
                LateWorldArt.warn(ctx, p.x, p.y, 78, k * 0.85);
            } else {
                LateWorldArt.warn(ctx, p.x, p.y, 78, k);
            }
        }
    }
}
