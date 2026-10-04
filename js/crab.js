// ── Welt 40: Krebsstrand (Idee von Leander) ──
// Krebse: rote Strandkrebse mit Stielaugen und zwei Zangen. Sie laufen SEITWÄRTS (schlingernd zum Ziel),
//   die Zangen klappern im Takt der Schritte. Gefährlich sind nur die Zangen: Aus einem 30-Grad-Kneif-
//   vorhalt öffnen sich die Zangen 0,4 s sichtbar als Warnung (plus Warnkreis am Boden), dann schnappen
//   sie zu. Treffen Mark UND Juri bzw. das Krokodil (Freunde werden höchstens umgehauen, nie besiegt).
//   Ein Exemplar trägt den Schlüssel (goldenes Schlüsselzeichen über LateWorldArt.keyBadge).
// Mittelgroßer Krebs (CrabMid): die größere, kräftigere Art (10 LP) – lebt normalerweise tiefer im Sand;
//   der Riesenkrebs holt 2 bis 3 von ihnen an die Oberfläche. Sie kneifen wie die kleinen Krebse, bleiben
//   im Boss-Raum und verpuffen, sobald der Riesenkrebs besiegt ist.
// Riesenkrebs (Boss, 130 LP): riesiger Krebs mit Panzer voller Muscheln und zwei riesigen Zangen.
//   1. Zangenschnapp: läuft auf Mark zu, holt 0,9 s aus (Warnfächer am Boden, Zangen ganz offen),
//      dann schnappen beide Zangen in einem Fächer zu – 2 Schaden (Phase 2: 3). Danach 1,3 s
//      Verschnaufpause (hecheln), in der man gut zurückhauen kann.
//   2. Wasserspucken: eigener Zeitgeber – der Boss spuckt WASSERKUGELN auf Mark oder einen Freund,
//      und zwar ZWISCHENDURCH, auch beim Laufen und während anderer Angriffe (nur in der
//      Verschnaufpause pausiert er). Ankündigung: 0,5 s Warnlinie + aufleuchtender Mund.
//   3. Ruft mittelgroße Krebse: zu Beginn und immer wieder 2 bis 3 um sich herum (höchstens 4).
//   Phase 2 (ab halben Lebenspunkten): Brüllen, Panzer rostet wütender nach, Zangen glühen blau,
//   alles schneller, mehr Wasser. Der Boss verlässt den Boss-Raum nie.

const CrabCfg = {
    // Normaler Krebs
    skins: ['#f4512e', '#ff6a3c', '#e8452a', '#ff5a45', '#f0603a'],
    pinchWindup: 0.4,      // Zangen öffnen sich so lange als Warnung
    pinchSnap: 0.12,       // Schnapp-Dauer
    pinchRecover: 0.45,    // Zangen ruhen
    pinchReach: 18,        // Kneifpunkt vor dem Krebs
    dmg: 1,
    // Mittelgroßer Krebs
    midSkins: ['#d9402a', '#e35520', '#c93a26'],
    midDmg: 2,
    // Boss
    bossSkin: '#e8452a',
    bossDark: '#a3271a',
    water: '#4fc3f7',
    waterCore: '#d6f4ff',
    pinch2Dmg: 3,
    fanHalf: 0.62,         // halber Öffnungswinkel des Zangenfächers
    fanR: 88,              // Reichweite des Zangenschnapps
    shotCap: 52,           // höchstens so viele Gegnergeschosse gleichzeitig (Handy)
};

// Gemeinsame Helfer der Welt 40
const CrabKit = {
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

    // Freund treffen: Schaden, aber nie verschwinden – statt besiegt nur umgehauen (wie in welt 24/28)
    hitFriend(c, dmg) {
        if (!c || c.dead || c.koTimer > 0 || c.iFrames > 0) return false;
        if (c.hp - dmg <= 0) c.knockOut(6);
        else c.takeDamage(dmg);
        CrabKit.burst(c.x + c.w / 2, c.y + c.h / 2, [CrabCfg.water, '#ffffff'], 7, 110, 0.4, { kind: 'star' });
        return true;
    },

    // Nächstes Ziel: Mark oder ein wacher Freund
    pickTarget(owner, player) {
        const mx = owner.centerX(), my = owner.centerY();
        let best = player && !player.dead ? player : null;
        let bd = best ? Math.hypot(player.x + player.w / 2 - mx, player.y + player.h / 2 - my) : Infinity;
        for (const c of CrabKit.friends()) {
            const d = Math.hypot(c.x + c.w / 2 - mx, c.y + c.h / 2 - my);
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    },

    // Liegt (px, py) im Warnfächer um (cx, cy) mit Mittelwinkel a, halber Breite half, Radius r?
    inSector(px, py, cx, cy, a, half, r, pad) {
        const dx = px - cx, dy = py - cy;
        const d = Math.hypot(dx, dy);
        if (d > r + (pad || 0)) return false;
        let da = Math.atan2(dy, dx) - a;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        return Math.abs(da) <= half + (d < 14 ? Math.PI : 0);
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

    // Count der Gegnergeschosse auf dem Feld (Handy-Leistung)
    enemyShots(list) {
        if (!list) return 0;
        let n = 0;
        for (const p of list) if (p && p.owner === 'enemy' && !p.dead) n++;
        return n;
    },

    // Sand-/Schaubrisen beim Laufen und Spritzen
    foam(x, y, n) {
        CrabKit.burst(x, y, ['#ffffff', '#ffe9c9', CrabCfg.waterCore], n || 4, 70, 0.35, { kind: 'spark' });
    },

    // Zange in Zeichenkoordinaten: Handgelenk bei (0,0), Zange zeigt nach +x.
    // open 0..1 (geöffnet), s Größe, farbe Chitin, lw Linienbreite, hot 0..1 (blaues Leuchten, Phase 2)
    claw(ctx, open, s, farbe, lw, hot) {
        if (hot > 0) Art.glow(ctx, 7 * s, 0, 14 * s, CrabCfg.water, 0.4 * hot);
        const ink = Art.ink(farbe);
        // Handballen
        Art.body(ctx, 0, 0, 5 * s, 4.2 * s, farbe, { lineWidth: lw });
        // Ober- und Unterscheren: öffnen um open * 0.55 nach oben/unten
        const o = open * 0.55;
        for (const sg of [-1, 1]) {
            ctx.save();
            ctx.rotate(sg * o);
            Art.shape(ctx, c => {
                c.moveTo(2 * s, sg * 1.2 * s);
                c.quadraticCurveTo(9 * s, sg * 4.6 * s, 13.5 * s, sg * 1.1 * s);
                c.lineTo(8.5 * s, sg * 0.4 * s);
                c.closePath();
            }, { x: 2 * s, y: Math.min(sg * 4.6 * s, 0), w: 11.5 * s, h: 4.6 * s }, farbe, { lineWidth: lw, glossy: true });
            ctx.restore();
        }
        // Schließzähne bei geschlossener Zange
        if (open < 0.25) {
            ctx.fillStyle = ink;
            ctx.beginPath();
            ctx.rect(10.5 * s, -0.5 * s, 1.4 * s, 1 * s);
            ctx.fill();
        }
    },

    // Stielauge mit Blick nach look (Zeichenkoordinaten, Schaft von (bx,by) nach oben)
    stalkEye(ctx, bx, by, tilt, r, look, seed, angry) {
        const ex = bx + Math.sin(tilt) * r * 2.6, ey = by - Math.cos(tilt) * r * 2.6;
        Art.limb(ctx, bx, by, ex, ey, r * 0.8, CrabCfg.bossDark, { lineWidth: 1 });
        Art.eye(ctx, ex, ey, r, look, { seed, angry });
    },
};

// ══════════════════════════════════════════
// ── Krebs (normaler Gegner) ──
// ══════════════════════════════════════════

// Roter Strandkrebs (Hitbox 26×24), läuft seitwärts schlingernd zum Ziel.
// Zustände: walk → windup (Zangen offen, 0,4 s Warnung) → snap (Schnapp) → recover.
class Crab extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 24);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(48, 58);        // Mark läuft ~150
        this.damage = CrabCfg.dmg;
        this.contactDamage = false;            // gefährlich sind nur die Zangen
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 230;
        this.seed = Math.random() * 10;
        this.skin = CrabKit.pick(CrabCfg.skins);
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
        this.cooldown = randRange(0.3, 1);
        this.hitX = 0;                         // Kneifpunkt steht beim Ausholen fest
        this.hitY = 0;
        this.t = Math.random() * 10;
        this.walkT = Math.random() * 3;
        this.wanderT = randRange(0.3, 2);
        this.wx = 0;
        this.wy = 0;
        // Kneif-Maße (CrabMid überschreibt sie)
        this.reach = CrabCfg.pinchReach;
        this.hitR = 15;
        this.dmg = CrabCfg.dmg;
        this.summoner = null;                  // gesetzt vom Riesenkrebs (CrabMid)
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        // Gerufene Krebse (CrabMid) verpuffen mit dem Riesenkrebs und bleiben im Boss-Raum
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                CrabKit.foam(this.centerX(), this.centerY(), 9);
                return;
            }
            const room = typeof Game !== 'undefined' && Game.bossActive && Game._bossRoomRect ? Game._bossRoomRect() : null;
            if (room) {
                this.x = clamp(this.x, room.x + 2, room.x + room.w - this.w - 2);
                this.y = clamp(this.y, room.y + 2, room.y + room.h - this.h - 2);
            }
        }

        this.t += dt;
        if (this.cooldown > 0) this.cooldown -= dt;
        this.moving = false;

        // Ausholen und Schnappen laufen unabhängig vom Ziel weiter (Richtung steht beim Ausholen fest)
        if (this.state !== 'walk') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                if (this.state === 'windup') this._set('snap', CrabCfg.pinchSnap);
                else if (this.state === 'snap') { this._pinch(player); this._set('recover', CrabCfg.pinchRecover); }
                else { this._set('walk', 0); this.cooldown = randRange(0.5, 0.9); }
            }
            return;
        }

        this.retargetT -= dt;
        if (this.retargetT <= 0 || !this.target || this.target.dead || this.target.koTimer > 0) {
            this.target = CrabKit.pickTarget(this, player);
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
            if (dist < this.reach + 14 && this.cooldown <= 0) {
                // Kneifpunkt fixieren – wer rechtzeitig auswich, wird nicht getroffen
                this.hitX = this.centerX() + (dx / dist) * this.reach;
                this.hitY = this.centerY() + (dy / dist) * this.reach;
                if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
                this._set('windup', CrabCfg.pinchWindup);
                return;
            }
            if (dist > this.reach * 0.8) {
                // Seitwärts-Schlingern: gerade zum Ziel plus seitliches Ausweichen wie ein echter Krebs
                const wob = Math.sin(this.t * 4.2 + this.seed) * 0.7;
                const ax = dx / dist - (dy / dist) * wob;
                const ay = dy / dist + (dx / dist) * wob;
                const L = Math.hypot(ax, ay) || 1;
                this._step(ax / L, ay / L, this.speed, dt, world);
            }
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

    // Zangen schnappen zu: trifft Mark und Freunde am fixierten Kneifpunkt
    _pinch(player) {
        const x = this.hitX, y = this.hitY;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - x, py - y) < this.hitR + 6) {
                CrabKit.hurt(player, this.dmg, Math.atan2(py - this.centerY(), px - this.centerX()), 170);
            }
        }
        for (const c of CrabKit.friends()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - x, cy - y) < this.hitR + Math.max(c.w, c.h) * 0.3) CrabKit.hitFriend(c, this.dmg);
        }
        CrabKit.burst(x, y, [this.skin, '#ffffff'], 5, 90, 0.3, { kind: 'spark' });
        CrabKit.shake(1.2, 0.08);
    }

    // Warnkreis unter dem Kneifpunkt (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead || (this.state !== 'windup' && this.state !== 'snap')) return;
        const k = this.state === 'windup' ? clamp(1 - this.stateT / CrabCfg.pinchWindup, 0, 1) : 1;
        const p = camera.worldToScreen(this.hitX, this.hitY);
        LateWorldArt.warn(ctx, p.x, p.y, this.hitR, k, '#ff5a3c');
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (!LateWorldArt.deathPop(ctx, this, cx, by - 10)) { ctx.restore(); return; }
        }
        ctx.translate(cx, by);
        ctx.scale(this.face, 1);
        this._drawBody(ctx, this.dead);
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 12);
    }

    // Öffnung der Zangen 0..1 aus dem Zustand (Ausholen = Warnung, Schnappen = zu)
    _clawOpen() {
        if (this.state === 'windup') return 0.35 + 0.65 * CrabKit.ease(1 - this.stateT / Math.max(0.01, CrabCfg.pinchWindup));
        if (this.state === 'snap') return 0.15;
        if (this.state === 'recover') return 0.3;
        return 0.12 + 0.1 * Math.sin(Art.time * 6 + this.seed);
    }

    // Krebs mit Fußpunkt (0,0), Blick nach +x. s = Größenfaktor (CrabMid zeichnet größer).
    _drawBody(ctx, dead) {
        const t = Art.time, sd = this.seed, skin = this.skin, ink = Art.ink(skin);
        const s = this.w / 26;
        const mv = this.moving && !dead;
        const step = mv ? Math.sin(this.walkT * 15 + sd) : 0;
        const hop = mv ? Math.abs(step) * 1.1 : Math.sin(t * 2.6 + sd) * 0.5;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -11 * s, 22 * s, '#ffd23f', 0.4 + 0.12 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(0, -hop);
        // Sechs Beine (ein Pfad, seitwärts wuselnd)
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const px = -7 * s + i * 5.5 * s;
            const ph = Math.sin(this.walkT * 15 + sd + i * 1.7) * (mv ? 2.2 : 0.6) * s;
            ctx.moveTo(px, -8 * s);
            ctx.lineTo(px - 3 * s, -3 * s + ph);
            ctx.moveTo(px, -8 * s);
            ctx.lineTo(px + 3 * s, -3 * s - ph);
        }
        ctx.stroke();
        // Panzer
        Art.body(ctx, -1 * s, -12 * s, 12 * s, 8.5 * s, skin, { glossy: true, lineWidth: 1.5 });
        // Panzerrillen (zwei dünne Bögen)
        ctx.strokeStyle = Art.dark(skin, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-1 * s, -12 * s, 8 * s, Math.PI * 1.15, Math.PI * 1.85);
        ctx.arc(-1 * s, -12 * s, 5.2 * s, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        // Zwei Zangen vorn (oben), klappern im Schritt
        const open = this._clawOpen();
        const swing = mv ? step * 0.25 : Math.sin(t * 2.2 + sd) * 0.06;
        ctx.save();
        ctx.translate(8.5 * s, -13 * s);
        ctx.rotate(-0.5 + swing);
        CrabKit.claw(ctx, open, 0.85 * s, skin, 1.4, 0);
        ctx.restore();
        ctx.save();
        ctx.translate(7 * s, -8 * s);
        ctx.rotate(0.25 - swing);
        CrabKit.claw(ctx, open * 0.8, 0.7 * s, skin, 1.4, 0);
        ctx.restore();
        // Stielaugen (wippen)
        const tilt = Math.sin(t * 3.1 + sd) * 0.22;
        const look = { x: clamp(this.look.x, -1, 1), y: clamp(this.look.y - 0.4, -1, 1) };
        CrabKit.stalkEye(ctx, 4.5 * s, -17 * s, tilt, 2.6 * s, look, sd, this.engaged && !dead);
        CrabKit.stalkEye(ctx, 8 * s, -15 * s, -tilt * 0.8, 2.4 * s, look, sd + 1, this.engaged && !dead);
        // Gesicht
        if (dead) LateWorldArt.xEyes(ctx, 6 * s, -19 * s, 1.6 * s, 1.8 * s);
        else Art.mouth(ctx, 4 * s, -9 * s, 4.5 * s, this.state === 'windup' || this.state === 'snap' ? 'open' : 'grin');
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Mittelgroßer Krebs (Rufliner des Bosses) ──
// ══════════════════════════════════════════

// Größerer Krebs (Hitbox 34×30, 10 LP): kneift kräftiger (2 Schaden), wird vom Riesenkrebs gerufen.
// Bleibt im Boss-Raum (Clamp erbt aus Crab.update über summoner) und verpufft beim Bosstod.
class CrabMid extends Crab {
    constructor(x, y) {
        super(x, y);
        this.w = 34;
        this.h = 30;
        this.hp = 10;
        this.maxHp = 10;
        this.speed = randRange(40, 48);
        this.skin = CrabKit.pick(CrabCfg.midSkins);
        this.fxColor = this.skin;
        this.damage = CrabCfg.midDmg;
        this.dmg = CrabCfg.midDmg;
        this.reach = CrabCfg.pinchReach * 1.3;
        this.hitR = 20;
        this.detectionRange = 260;
    }
}

// ══════════════════════════════════════════
// ── Wasserkugel des Riesenkrebses ──
// ══════════════════════════════════════════

// Wasserblase: trifft Mark über die Engine (1 Schaden) und Freunde direkt (K.o. statt besiegt).
class CrabWaterBall extends Projectile {
    constructor(x, y, angle, speed, dmg) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, dmg, 'enemy', 110);
        this.radius = 6;
        this.lifetime = 2.4;
        this.seed = Math.random() * 10;
        this.splashed = false;
        this.spin = Math.random() * TAU;
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) {
            if (!this.splashed) {
                this.splashed = true;
                CrabKit.burst(this.x, this.y, [CrabCfg.water, CrabCfg.waterCore, '#ffffff'], 6, 90, 0.35, { kind: 'spark' });
            }
            return;
        }
        // Freunde selbst treffen (Wasser haut sie um, statt sie nur zu betäuben)
        for (const c of CrabKit.friends()) {
            const cw = c.w || 20, ch = c.h || 20;
            if (Math.hypot(this.x - (c.x + cw / 2), this.y - (c.y + ch / 2)) < this.radius + Math.max(cw, ch) / 2) {
                CrabKit.hitFriend(c, 1);
                this.dead = true;
                this.splashed = true;
                CrabKit.burst(this.x, this.y, [CrabCfg.water, '#ffffff'], 8, 110, 0.4, { kind: 'spark' });
                return;
            }
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        const sp = Math.hypot(this.vx, this.vy);
        const dx = sp > 1 ? this.vx / sp : 1;
        const dy = sp > 1 ? this.vy / sp : 0;
        Art.glow(ctx, p.x, p.y, r * 2.6, CrabCfg.water, 0.55);
        // kurzer Schaum-Schweif
        for (let i = 1; i <= 2; i++) {
            ctx.globalAlpha = 0.35 - i * 0.1;
            ctx.fillStyle = CrabCfg.water;
            ctx.beginPath();
            ctx.arc(p.x - dx * i * r * 1.2, p.y - dy * i * r * 1.2, r * (1 - i * 0.25), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        const wob = Math.sin(Art.time * 14 + this.seed) * 0.12;
        Art.body(ctx, p.x, p.y, r * (1 + wob), r * (1 - wob), CrabCfg.water, { glossy: true, lineWidth: 1.2 });
        Art.shine(ctx, p.x - r * 0.35, p.y - r * 0.4, r * 0.3, r * 0.22, -0.5, 0.8);
    }
}

// ══════════════════════════════════════════
// ── Riesenkrebs (Boss) ──
// ══════════════════════════════════════════

// Der Riese: 130 LP, bleibt im Boss-Raum, zwei Phasen. Angriffe laufen über eine Zustandsmaschine
// (walk → pinchWind → pinch → pant), das Wasserspucken hat einen EIGENEN Zeitgeber dazwischen,
// und mittelgroße Krebse werden über summonWind nachgerufen.
class BossGiantCrab extends Enemy {
    constructor(x, y) {
        super(x, y, 84, 68);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 42;
        this.damage = 2;
        this.contactDamage = false;            // gefährlich sind Zangen und Wasser
        this.phasesThroughWalls = false;
        this.flying = false;
        this.seed = Math.random() * 10;
        this.skin = CrabCfg.bossSkin;
        this.fxColor = this.skin;
        this.phase = 1;
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.t = Math.random() * 10;
        this.spawnT = 0;
        this.bodyA = Math.PI / 2;              // Blickwinkel (Zeichnung dreht mit)
        this.aim = { x: 0, y: 1 };
        this.moving = false;
        this.walkT = 0;
        // Zangenschnapp
        this.fanA = 0;                         // Mittelwinkel des angesagten Fächers
        this.cooldown = 1.2;
        // Wasserspucken (eigener Zeitgeber, läuft zwischendurch)
        this.spitClock = 2.2;
        this.spitPhase = 'idle';               // 'idle' | 'wind'
        this.spitT = 0;
        this.spitA = 0;
        this.spitTarget = null;
        // Rufliner
        this.summoned = [];
        this.refillClock = 4;
        // Fest im Konstruktor ausgeloste Muschel-Stellen auf dem Panzer (Zufall gehört nicht in draw())
        this.shells = [];
        for (let i = 0; i < 7; i++) {
            const a = Math.random() * TAU;
            const d = 10 + Math.random() * 16;
            this.shells.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.55 - 4, r: 3.4 + Math.random() * 2.6, rot: Math.random() * TAU, hue: i % 3 });
        }
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Innenraum des Boss-Raums (ohne Engine: null)
    _room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    _mouth() {
        return { x: this.centerX() + Math.cos(this.bodyA) * 34, y: this.centerY() + Math.sin(this.bodyA) * 34 };
    }

    _aliveSummoned() {
        let n = 0;
        for (const k of this.summoned) if (k && !k.dead) n++;
        return n;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        this.spawnT += dt;
        if (this.cooldown > 0) this.cooldown -= dt;
        this.moving = false;

        // Phase 2 ab halben Lebenspunkten: wütender und schneller
        if (this.phase === 1 && this.hp <= this.maxHp / 2) {
            this.phase = 2;
            this.speed = 58;
            this.spitClock = Math.min(this.spitClock, 0.8);
            CrabKit.shake(7, 0.4);
            CrabKit.burst(this.centerX(), this.centerY() - 20, [this.skin, '#ffd23f', '#ffffff'], 18, 170, 0.6, { kind: 'star' });
            CrabKit.ring(this.centerX(), this.centerY(), '#ff5a3c', 90, 0.45, 5);
        }

        // Der Boss verlässt den Boss-Raum nie
        const room = this._room(world);
        const clampRoom = o => {
            if (!room) return;
            o.x = clamp(o.x, room.x + 4, room.x + room.w - o.w - 4);
            o.y = clamp(o.y, room.y + 4, room.y + room.h - o.h - 4);
        };
        clampRoom(this);

        // ── Wasserspucken: eigener Zeitgeber, läuft auch beim Laufen und während des Zangenschnapps ──
        this._updateSpit(dt, world, player, projectiles);

        // Zustandsmaschine für Schnapp und Rufen
        if (this.state !== 'walk' && this.state !== 'summonWait') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                if (this.state === 'pinchWind') { this._snap(player); this._set('pinch', 0.16); }
                else if (this.state === 'pinch') this._set('pant', this.phase === 2 ? 1 : 1.3);
                else if (this.state === 'pant') { this._set('walk', 0); this.cooldown = this.phase === 2 ? 0.3 : 0.5; }
                else if (this.state === 'summonWind') { this._summon(world, player); this._set('pant', 0.8); }
            }
        }

        // Ziel und Blick
        const tg = CrabKit.pickTarget(this, player);
        let dx = 0, dy = 0, dist = Infinity;
        if (tg && !tg.dead) {
            dx = tg.x + tg.w / 2 - this.centerX();
            dy = tg.y + tg.h / 2 - this.centerY();
            dist = Math.hypot(dx, dy) || 1;
            this.aim = { x: dx / dist, y: dy / dist };
        }
        const wantA = Math.atan2(dy, dx);
        let da = wantA - this.bodyA;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        this.bodyA += da * Math.min(1, dt * (this.state === 'walk' ? 4 : 1.5));

        // Nachrufliner: erst 2 gleich, dann immer 2 bis 3 um den Boss (höchstens 4)
        if (this.spawnT > 1.6 && this.state === 'walk' && this._aliveSummoned() === 0 && this.summoned.length === 0) this._set('summonWind', 0.8);
        this.refillClock -= dt;
        if (this.refillClock <= 0) {
            this.refillClock = 5.5;
            const want = this.phase === 2 ? 3 : 2;
            if (this._aliveSummoned() < want && this.state === 'walk') this._set('summonWind', 0.8);
        }

        // Laufen und Zangenschnapp-Start nur im Zustand walk
        if (this.state === 'walk') {
            if (dist < 120 && this.cooldown <= 0) {
                // Fächer-Richtung steht jetzt fest – wer rechtzeitig seitlich ausbricht, entkommt
                this.fanA = Math.atan2(dy, dx);
                this._set('pinchWind', this.phase === 2 ? 0.7 : 0.9);
                clampRoom(this);
                return;
            }
            if (dist < 400 && dist > 70) {
                const sp = this.speed * (this.spitPhase === 'wind' ? 0.55 : 1);
                this.walkT += dt;
                this._moveWithCollision(this.aim.x * sp * dt, this.aim.y * sp * dt, world);
                this.moving = true;
            }
        }
        clampRoom(this);
    }

    // ── Wasserspucken (Zeitgeber) ──
    _updateSpit(dt, world, player, projectiles) {
        // In der Verschnaufpause wird nicht gespuckt – die Pause gehört dem Spieler
        if (this.state === 'pant' || this.state === 'summonWind') return;
        if (this.spitPhase === 'idle') {
            this.spitClock -= dt;
            if (this.spitClock > 0) return;
            this.spitTarget = CrabKit.pickTarget(this, player);
            if (!this.spitTarget || this.spitTarget.dead) { this.spitClock = 0.6; return; }
            this.spitPhase = 'wind';
            this.spitT = this.phase === 2 ? 0.45 : 0.55;
            return;
        }
        // wind: Mund lädt, Richtung folgt dem Ziel – getroffen wird erst beim Feuerstoß
        this.spitT -= dt;
        const tg = this.spitTarget;
        const m = this._mouth();
        if (tg && !tg.dead && !(tg.koTimer > 0)) {
            this.spitA = Math.atan2(tg.y + tg.h / 2 - m.y, tg.x + tg.w / 2 - m.x);
        }
        if (this.spitT > 0) return;
        this.spitPhase = 'idle';
        this.spitClock = this.phase === 2 ? 2 : 2.8;
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const n = this.phase === 2 ? 5 : 3;
        if (!list || CrabKit.enemyShots(list) + n > CrabCfg.shotCap + n) {
            if (list && CrabKit.enemyShots(list) >= CrabCfg.shotCap) return; // Feld voll: Spucken später
        }
        const spread = 0.2;
        const room = this._room(world);
        for (let i = 0; i < n; i++) {
            if (list && CrabKit.enemyShots(list) >= CrabCfg.shotCap) break;
            const a = this.spitA + (i - (n - 1) / 2) * spread;
            const b = new CrabWaterBall(m.x, m.y, a, this.phase === 2 ? 205 : 180, 1);
            if (room) { // nie direkt in eine Wand spucken
                if (world.isWall(m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 14)) continue;
            }
            if (list) list.push(b);
        }
        CrabKit.burst(m.x, m.y, [CrabCfg.water, CrabCfg.waterCore, '#ffffff'], 8, 130, 0.35, { kind: 'spark' });
    }

    // ── Zangenschnapp: Fächer steht fest, jetzt schnappen beide Zangen zu ──
    _snap(player) {
        const m = this._mouth();
        const half = CrabCfg.fanHalf;
        const r = CrabCfg.fanR;
        const dmg = this.phase === 2 ? CrabCfg.pinch2Dmg : 2;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (CrabKit.inSector(px, py, m.x, m.y, this.fanA, half, r, 12)) {
                CrabKit.hurt(player, dmg, Math.atan2(py - this.centerY(), px - this.centerX()), 240);
            }
        }
        for (const c of CrabKit.friends()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (CrabKit.inSector(cx, cy, m.x, m.y, this.fanA, half, r, 14)) CrabKit.hitFriend(c, dmg);
        }
        const hx = m.x + Math.cos(this.fanA) * 34, hy = m.y + Math.sin(this.fanA) * 34;
        CrabKit.burst(hx, hy, [this.skin, '#ffffff', '#ffd23f'], 12, 160, 0.4, { kind: 'star' });
        CrabKit.shake(this.phase === 2 ? 6 : 4.5, 0.22);
    }

    // ── Mittelgroße Krebse rufen (nur im Boss-Raum, höchstens 4 gesamt) ──
    _summon(world, player) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || !Game._bossRoomRect || !Game.enemies) return;
        const room = Game._bossRoomRect();
        const alive = this._aliveSummoned();
        const want = Math.min(4 - alive, randInt(2, 3));
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const a = Math.random() * TAU;
                const d = 55 + Math.random() * 60;
                const x = clamp(this.centerX() + Math.cos(a) * d, room.x + 20, room.x + room.w - 54);
                const y = clamp(this.centerY() + Math.sin(a) * d, room.y + 20, room.y + room.h - 50);
                if (Math.hypot(x - px, y - py) < 80 || Math.hypot(x - this.centerX(), y - this.centerY()) < 46) continue;
                if (world.isWall(x - 16, y - 14) || world.isWall(x + 16, y - 14) || world.isWall(x - 16, y + 14) || world.isWall(x + 16, y + 14)) continue;
                const kid = new CrabMid(x, y);
                kid.summoner = this;
                kid.engaged = true;
                Game.enemies.push(kid);
                this.summoned.push(kid);
                CrabKit.burst(x, y, [kid.skin, '#ffe9c9', '#ffffff'], 12, 120, 0.5, { kind: 'star' });
                CrabKit.ring(x, y + 8, '#ffe9c9', 26, 0.4, 3);
                break;
            }
        }
    }

    // ── Warnungen am Boden: Zangenfächer, Wasserlinie, Rufsiegel ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        // Zangenschnapp-Warnfächer (Fächer füllt sich, Zittern kurz vor dem Schnapp)
        if (this.state === 'pinchWind' || this.state === 'pinch') {
            const k = this.state === 'pinch' ? 1 : clamp(1 - this.stateT / Math.max(0.01, this.stateDur), 0, 1);
            const m = this._mouth();
            const p = camera.worldToScreen(m.x, m.y);
            const prev = ctx.globalAlpha;
            const pulse = 0.5 + 0.5 * Math.sin(Art.time * 15);
            const jitter = k > 0.75 ? Math.sin(Art.time * 55) * 0.02 : 0;
            const a0 = this.fanA - CrabCfg.fanHalf, a1 = this.fanA + CrabCfg.fanHalf;
            ctx.fillStyle = '#ff5a3c';
            ctx.globalAlpha = prev * (0.1 + 0.07 * pulse);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, CrabCfg.fanR, a0, a1);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = prev * (0.16 + 0.2 * k);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, CrabCfg.fanR * clamp(k, 0, 1), a0 + jitter, a1 - jitter);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = prev * (0.55 + 0.45 * pulse);
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.arc(p.x, p.y, CrabCfg.fanR, a0, a1);
            ctx.closePath();
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
        // Wasserlinie: wird während des Ladens länger und heller
        if (this.spitPhase === 'wind') {
            const k = clamp(1 - this.spitT / (this.phase === 2 ? 0.45 : 0.55), 0, 1);
            const m = this._mouth();
            const p = camera.worldToScreen(m.x, m.y);
            LateWorldArt.lane(ctx, p.x, p.y, this.spitA, 240, 16, k, CrabCfg.water);
        }
        // Rufsiegel: vier helle Ringe um den Boss, während er die Zangen hebt
        if (this.state === 'summonWind') {
            const k = clamp(1 - this.stateT / Math.max(0.01, this.stateDur), 0, 1);
            const c = camera.worldToScreen(this.centerX(), this.centerY());
            for (let i = 0; i < 4; i++) {
                const a = (i * TAU) / 4 + this.seed;
                LateWorldArt.warn(ctx, c.x + Math.cos(a) * 62, c.y + Math.sin(a) * 44, 20, k, '#ffe9c9');
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, cy);
        ctx.translate(cx, cy);
        ctx.rotate(this.bodyA - Math.PI / 2);   // Zeichnung zeigt nach "oben", Blick folgt bodyA
        const ph2 = this.phase === 2;
        if (ph2 && !this.dead) Art.glow(ctx, 0, 0, 70, '#ff3d2a', 0.3 + 0.12 * Math.sin(Art.time * 5 + this.seed));
        this._drawBody(ctx, this.dead);
        ctx.restore();
    }

    // Riesenkrebs mit Mitte (0,0), Blick nach oben (-y). Panzer voll Muscheln, riesige Zangen.
    _drawBody(ctx, dead) {
        const t = Art.time, sd = this.seed, skin = this.skin, ink = Art.ink(skin);
        const ph2 = this.phase === 2 && !dead;
        const mv = this.moving && !dead;
        const step = mv ? Math.sin(this.walkT * 11) : 0;
        const puff = this.state === 'pinchWind' ? CrabKit.ease(1 - this.stateT / Math.max(0.01, this.stateDur)) : 0;
        // Acht Beine (zwei Pfade: hinten dunkel, vorn Hautfarbe)
        for (const layer of [0, 1]) {
            ctx.strokeStyle = layer ? Art.dark(skin, 0.28) : ink;
            ctx.lineWidth = layer ? 3 : 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const py = -12 + i * 9;
                const ph = Math.sin(this.walkT * 11 + sd + i * 1.4) * (mv ? 3 : 1);
                if (layer) {
                    ctx.moveTo(-20, py); ctx.lineTo(-33, py + 6 + ph);
                    ctx.moveTo(20, py); ctx.lineTo(33, py + 6 - ph);
                } else {
                    ctx.moveTo(-20, py); ctx.lineTo(-30, py + 9 + ph);
                    ctx.moveTo(20, py); ctx.lineTo(30, py + 9 - ph);
                }
            }
            ctx.stroke();
        }
        // Riesige Zangen vorn (oben): beim Ausholen ganz weit öffnen und ausholen
        const open = dead ? 0.1 : (this.state === 'pinchWind' ? 0.5 + 0.5 * puff :
            this.state === 'pinch' ? 0.2 : this.state === 'pant' ? 0.35 : 0.2 + 0.08 * Math.sin(t * 3.4 + sd));
        const raise = puff * 8;
        for (const sg of [-1, 1]) {
            ctx.save();
            ctx.translate(sg * (24 + puff * 8), -22 - raise * 0.4);
            ctx.rotate(sg * (0.5 + puff * 0.35));
            if (mv) ctx.rotate(-sg * step * 0.15);
            CrabKit.claw(ctx, open, 2.3, ph2 ? Art.mix(skin, '#ff7a4a', 0.5) : skin, 2, ph2 ? 0.6 + 0.4 * Math.sin(t * 6 + sd) : 0);
            ctx.restore();
        }
        // Panzer
        const shellCol = ph2 ? Art.mix(skin, '#ff2d1a', 0.35) : skin;
        Art.body(ctx, 0, -2, 30, 24, shellCol, { glossy: true, lineWidth: 2.2 });
        // Muscheln und Seepocken auf dem Panzer
        for (const sh of this.shells) {
            const col = sh.hue === 0 ? '#8d6bb8' : sh.hue === 1 ? '#e8b06a' : '#7fa3c9';
            Art.body(ctx, sh.x, sh.y - 4, sh.r, sh.r * 0.8, col, { lineWidth: 1.1 });
            ctx.strokeStyle = Art.ink(col);
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(sh.x, sh.y - 4 + sh.r * 0.5, sh.r * 0.8, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
        }
        // Panzerrisse in Phase 2
        if (ph2) {
            ctx.strokeStyle = 'rgba(90,20,10,0.7)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-14, -12); ctx.lineTo(-8, -2); ctx.lineTo(-12, 8);
            ctx.moveTo(10, -14); ctx.lineTo(14, -4);
            ctx.stroke();
        }
        // Stielaugen vorn: in Phase 2 röter und wütender
        const look = { x: 0, y: -0.6 };
        const tilt = Math.sin(t * 2.6 + sd) * 0.18;
        for (const sg of [-1, 1]) {
            const bx = sg * 8, by = -22;
            const ex = bx + Math.sin(tilt * sg) * 12, ey = by - 14;
            Art.limb(ctx, bx, by, ex, ey, 3.4, Art.dark(skin, 0.25), { lineWidth: 1.2 });
            Art.glow(ctx, ex, ey, 9, ph2 ? '#ff3d2a' : '#ffd23f', ph2 ? 0.5 : 0.25);
            Art.eye(ctx, ex, ey, 4.4, look, { seed: sd + sg, angry: ph2 || this.state === 'pinchWind', iris: ph2 ? '#c81f14' : '#5a3a1a' });
        }
        // Mund: weit offen beim Spucken, sonst frech-grinsend
        const spitting = this.spitPhase === 'wind';
        if (spitting) Art.glow(ctx, 0, -26, 16, CrabCfg.water, 0.5 + 0.3 * Math.sin(t * 18));
        if (dead) LateWorldArt.xEyes(ctx, 0, -34, 3, 5);
        else Art.mouth(ctx, 0, -26, spitting ? 9 : 12, spitting ? 'o' : this.state === 'pinchWind' ? 'angry' : 'grin');
        if (!dead && !ph2) Art.blush(ctx, 0, -20, 3.4, 14);
    }
}
