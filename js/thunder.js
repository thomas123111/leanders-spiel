// ── Welt 29: Gewitterwolken ──
// Leanders Wunsch: „Blitzbälle als Gegner, die immer Blitze auf Marc und seine Freunde schießen.
// Der Boss ist ein Riesen-Blitzball mit 100 Augen; er kann ganz viele Blitzstacheln verschießen.“
//
//   ThunderKit       gemeinsame Helfer: Zufall aus Zahlen (für Zickzack ohne Zustand), Sichtlinie,
//                    Boss-Geschosse zählen, vorgerenderter Blitzstachel
//   BoltShot         Zickzack-Blitz der Blitzbälle (schnell, trifft auch Juri und das Krokodil: betäubt kurz)
//   SpikeShot        Blitzstachel des Bosses (vorgerendertes Bild + Leuchten)
//   ThunderBall      Blitzball: schwebt, flackert, hält Abstand, kündigt jeden Blitz an (Funke + Warnlinie)
//   BossThunderBall  Hundert-Augen-Blitzball: Stachel-Salve mit Lücken, gezielte Stachelreihen auf Mark und
//                    die Freunde, Phase 2 (halbe Lebenspunkte) rotierende Stachel-Spirale und rote Augen
//
// Leistung: Stachel-Bild einmal je Farbe vorgerendert; die 100 Augen liegen fest (im Konstruktor berechnet)
// und werden in wenigen gebündelten Pfaden gezeichnet (Weiß, Iris, Pupille, Glanz, Lider).

const ThunderKit = {
    PX: 4,              // Bildpunkte je Einheit im vorgerenderten Stachel
    BOSS_CAP: 66,       // höchstens so viele Boss-Stacheln gleichzeitig
    ZAP: '#ffe74a',     // Blitzgelb
    ZAP_CORE: '#fffbe0',
    _spikes: new Map(),

    // Fester „Zufall“ aus einer Zahl (0..1). Für Zickzack-Formen, die nur von der Zeit abhängen.
    hash(n) {
        const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return s - Math.floor(s);
    },

    shake(strength, time) {
        if (typeof Game !== 'undefined' && Game.camera && Game.camera.shake) Game.camera.shake(strength, time);
    },

    // Freie Sichtlinie (keine Wand) zwischen zwei Punkten, Stichproben alle 14 Einheiten.
    clearLine(world, x0, y0, x1, y1) {
        if (!world || !world.isWall) return true;
        const dx = x1 - x0, dy = y1 - y0;
        const n = Math.ceil(Math.hypot(dx, dy) / 14);
        for (let i = 1; i < n; i++) {
            if (world.isWall(x0 + (dx * i) / n, y0 + (dy * i) / n)) return false;
        }
        return true;
    },

    liveBossShots(list) {
        let n = 0;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (p.fromBoss && !p.dead) n++;
        }
        return n;
    },

    // Freund (Juri/Krokodil), der gerade getroffen werden kann
    companionOk(c) {
        return c && !c.dead && typeof c.stun === 'function' && !(c.stunTimer > 0) && !(c.koTimer > 0);
    },

    // Zickzack-Linie von (x0,y0) nach (x1,y1) an den aktuellen Pfad anhängen. key = ganze Zahl (Form).
    zigzag(ctx, x0, y0, x1, y1, n, amp, key) {
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        ctx.moveTo(x0, y0);
        for (let i = 1; i < n; i++) {
            const t = i / n;
            const off = (this.hash(key + i * 7.13) - 0.5) * 2 * amp * (i % 2 ? 1 : -1);
            ctx.lineTo(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
        }
        ctx.lineTo(x1, y1);
    },

    // ── Blitzstachel (vorgerendert je Farbe), zeigt nach +x ──
    SP_HALF_W: 10,
    SP_HALF_H: 5,
    spikeSprite(color) {
        let s = this._spikes.get(color);
        if (s) return s;
        const P = this.PX, HW = this.SP_HALF_W, HH = this.SP_HALF_H;
        s = document.createElement('canvas');
        s.width = 2 * HW * P;
        s.height = 2 * HH * P;
        const g = s.getContext('2d');
        g.scale(P, P);
        g.translate(HW, HH);
        g.lineJoin = 'round';
        Art.shape(g, c => {
            c.moveTo(9, 0);
            c.lineTo(0, -3.3);
            c.lineTo(-1.8, -1.3);
            c.lineTo(-7.5, -2.6);
            c.lineTo(-4.6, 0);
            c.lineTo(-7.5, 2.6);
            c.lineTo(-1.8, 1.3);
            c.lineTo(0, 3.3);
            c.closePath();
        }, { x: -7.5, y: -3.3, w: 16.5, h: 6.6 }, color, { lineWidth: 1, glossy: true });
        g.strokeStyle = 'rgba(255,255,255,0.95)';
        g.lineWidth = 1.2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-3.2, 0);
        g.lineTo(6.4, 0);
        g.stroke();
        if (this._spikes.size > 8) this._spikes.clear();
        this._spikes.set(color, s);
        return s;
    },
};

// ══════════════════════════════════════════
// Zickzack-Blitz der Blitzbälle
// ══════════════════════════════════════════

// Schneller Blitz: 1 Schaden für Mark. Trifft er Juri oder das Krokodil, sind sie kurz betäubt
// (main.js: hitsCompanions/stunTime). Gezeichnet als zuckende Zickzack-Linie hinter dem Kopf.
class BoltShot extends Projectile {
    constructor(x, y, angle, speed, o = {}) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 70);
        this.radius = o.radius || 5;
        this.lifetime = o.life || 1.5;
        this.hitsCompanions = true;
        this.stunTime = 1.5;
        this.color = o.color || ThunderKit.ZAP;
        this.trail = o.trail || 30;
        this.seed = Math.floor(Math.random() * 1000);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const ux = this.vx / sp, uy = this.vy / sp;
        const L = Math.min(this.trail, this.age * sp + 4);
        const key = Math.floor(this.age * 22) * 13 + this.seed;
        const a0 = ctx.globalAlpha;
        const fade = clamp(this.lifetime / 0.15, 0, 1);
        ctx.globalAlpha = a0 * fade;
        Art.glow(ctx, p.x, p.y, 13, this.color, 0.75);
        Art.glow(ctx, p.x - ux * L * 0.5, p.y - uy * L * 0.5, 11, '#7fb2ff', 0.35);
        ctx.beginPath();
        ThunderKit.zigzag(ctx, p.x, p.y, p.x - ux * L, p.y - uy * L, 5, 4.2, key);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3.6;
        ctx.stroke();
        ctx.strokeStyle = ThunderKit.ZAP_CORE;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        Art.sparkle(ctx, p.x, p.y, 4.5, '#ffffff', 1);
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// Blitzstachel des Bosses
// ══════════════════════════════════════════

// 1 Schaden; trifft auch die Freunde (kurz betäubt). fromBoss zählt zur Obergrenze ThunderKit.BOSS_CAP.
class SpikeShot extends Projectile {
    constructor(x, y, angle, speed, color, o = {}) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 60);
        this.radius = o.radius || 4.5;
        this.lifetime = o.life || 3.2;
        this.color = color || ThunderKit.ZAP;
        this.fromBoss = true;
        this.hitsCompanions = true;
        this.stunTime = o.stun || 0.7;   // Salve/Spirale nur kurz, die gezielte Reihe länger
        this.ang = angle;
        this.size = o.size || 1;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const born = Math.min(1, this.age / 0.1);
        const fade = clamp(this.lifetime / 0.2, 0, 1);
        const a0 = ctx.globalAlpha;
        if (fade < 1) ctx.globalAlpha = a0 * fade;
        const s = this.size * (0.6 + 0.4 * born);
        Art.glow(ctx, p.x, p.y, 12 * s, this.color, 0.55);
        const hw = ThunderKit.SP_HALF_W * s, hh = ThunderKit.SP_HALF_H * s;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.ang);
        ctx.drawImage(ThunderKit.spikeSprite(this.color), -hw, -hh, hw * 2, hh * 2);
        ctx.restore();
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// Blitzball (normaler Gegner)
// ══════════════════════════════════════════

// Schwebende blaue Kugel mit knisterndem gelbem Zackenkranz und zwei frechen Augen, flackert.
// Fliegt mit Wand-Kollision, hält 125–170 Einheiten Abstand zu Mark und kreist. Alle 2,1–3 s:
// 0,5 s Ankündigung (ein Funke zuckt, dünne Warnlinie zum Ziel, die Richtung steht in den letzten 0,15 s
// fest), dann ein schneller Zickzack-Blitz (250/s) auf Mark – oder manchmal auf Juri/das Krokodil.
class ThunderBall extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 62;
        this.damage = 1;
        this.contactDamage = true;
        this.flying = true;
        this.fxColor = ThunderKit.ZAP;
        this.seed = Math.random() * 10;
        this.t = Math.random() * 10;
        this.look = { x: 0, y: 0.3 };
        this.orbitR = randRange(125, 170);
        this.orbitDir = Math.random() < 0.5 ? -1 : 1;
        this.wanderA = Math.random() * TAU;
        this.flipCd = 0;
        this.engaged = false;
        this.hasLos = false;
        this.losT = Math.random() * 0.25;
        this.shotTimer = randRange(1.0, 2.6);
        this.charge = 0;            // 0 = ruhig, sonst Ankündigung 0..1
        this.tgt = null;            // Ziel (Mark oder ein Freund)
        this.aimX = 0;
        this.aimY = 0;
        this.isKeyGhost = false;    // setzt main.js beim Schlüsselträger
        this.droppedKey = false;
        this._keyReady = false;
    }

    _makeKeyCarrier() {
        this._keyReady = true;
        this.hp = 8;
        this.maxHp = 8;
        this.fxColor = '#ffd23f';
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyReady) this._makeKeyCarrier();
        this.t += dt;
        if (this.flipCd > 0) this.flipCd -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        this.engaged = !player.dead && dist < (this.engaged ? 330 : 250);
        this.losT -= dt;
        if (this.losT <= 0) {
            this.losT = 0.25;
            this.hasLos = this.engaged && ThunderKit.clearLine(world, mx, my, px, py);
        }
        // Blick (nur Darstellung): zum Ziel, sonst zu Mark
        let lx = nx, ly = ny;
        if (this.charge > 0) {
            const ax = this.aimX - mx, ay = this.aimY - my, ad = Math.hypot(ax, ay) || 1;
            lx = ax / ad; ly = ay / ad;
        }
        const lk = Math.min(1, dt * 8);
        this.look.x += ((this.engaged ? lx : Math.cos(this.wanderA) * 0.5) - this.look.x) * lk;
        this.look.y += ((this.engaged ? ly : 0.3) - this.look.y) * lk;

        let vx, vy;
        if (this.engaged && !this.hasLos) {
            vx = nx - ny * 0.3 * this.orbitDir;
            vy = ny + nx * 0.3 * this.orbitDir;
        } else if (this.engaged) {
            const radial = clamp((dist - this.orbitR) / 45, -0.6, 1);
            const tang = this.charge > 0 ? 0.1 : 0.55;
            vx = nx * radial - ny * tang * this.orbitDir;
            vy = ny * radial + nx * tang * this.orbitDir;
        } else {
            this.wanderA += Math.sin(this.t * 0.6 + this.seed) * dt * 1.4;
            vx = Math.cos(this.wanderA) * 0.45;
            vy = Math.sin(this.wanderA) * 0.45;
        }
        // Schwebebahn
        vx += Math.sin(this.t * 3.3 + this.seed) * 0.3;
        vy += Math.cos(this.t * 2.6 + this.seed * 1.7) * 0.3;
        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const o = enemies[i];
                if (o === this || o.dead || !(o instanceof ThunderBall)) continue;
                const ox = mx - (o.x + o.w / 2), oy = my - (o.y + o.h / 2);
                const d2 = ox * ox + oy * oy;
                if (d2 < 900 && d2 > 0.01) {
                    const d = Math.sqrt(d2);
                    vx += (ox / d) * (1 - d / 30) * 1.2;
                    vy += (oy / d) * (1 - d / 30) * 1.2;
                }
            }
        }
        const len = Math.hypot(vx, vy);
        if (len > 1) { vx /= len; vy /= len; }
        const sp = this.speed * (this.charge > 0 ? 0.3 : 1);
        const mvx = vx * sp * dt, mvy = vy * sp * dt;
        const ox = this.x, oy = this.y;
        this._moveWithCollision(mvx, mvy, world);
        const want = Math.abs(mvx) + Math.abs(mvy);
        if (want > 0.3 && Math.abs(this.x - ox) + Math.abs(this.y - oy) < want * 0.4 && this.flipCd <= 0) {
            this.orbitDir = -this.orbitDir;
            this.wanderA += Math.PI * 0.75;
            this.flipCd = 0.7;
        }

        // Schießen
        if (this.charge > 0) {
            this.charge += dt / 0.5;
            const tg = this.tgt;
            // Ziel verfolgen, in den letzten 0,15 s steht die Richtung fest (fair zum Ausweichen)
            if (tg && this.charge < 0.7 && !(tg.dead)) {
                this.aimX = tg.x + (tg.w || 20) / 2;
                this.aimY = tg.y + (tg.h || 20) / 2;
            }
            if (this.charge >= 1) {
                this.charge = 0;
                this._shoot(projectiles);
                this.shotTimer = randRange(2.1, 3.0);
            }
        } else if (this.engaged && dist < 280) {
            this.shotTimer -= dt;
            if (this.shotTimer <= 0) {
                const tg = this._pickTarget(world, player, mx, my, px, py);
                if (tg) {
                    this.tgt = tg;
                    this.aimX = tg.x + (tg.w || 20) / 2;
                    this.aimY = tg.y + (tg.h || 20) / 2;
                    this.charge = 0.001;
                } else {
                    this.shotTimer = 0.3;   // Wand dazwischen: gleich noch mal versuchen
                }
            }
        }
    }

    // Meist Mark, manchmal (40 %) ein Freund in Reichweite mit freier Sicht
    _pickTarget(world, player, mx, my, px, py) {
        const markOk = ThunderKit.clearLine(world, mx, my, px, py);
        if (Math.random() < 0.4 && typeof Game !== 'undefined' && Game.companions) {
            const cs = Game.companions;
            const start = Math.floor(Math.random() * Math.max(1, cs.length));
            for (let k = 0; k < cs.length; k++) {
                const c = cs[(start + k) % cs.length];
                if (!ThunderKit.companionOk(c)) continue;
                const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                if (Math.hypot(cx - mx, cy - my) > 270) continue;
                if (ThunderKit.clearLine(world, mx, my, cx, cy)) return c;
            }
        }
        return markOk ? player : null;
    }

    _shoot(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const mx = this.centerX(), my = this.centerY();
        const a = Math.atan2(this.aimY - my, this.aimX - mx);
        list.push(new BoltShot(mx + Math.cos(a) * 12, my + Math.sin(a) * 12, a, 250,
            { color: this.isKeyGhost ? '#ffd23f' : ThunderKit.ZAP }));
        if (typeof FX !== 'undefined') FX.burst(mx, my, [ThunderKit.ZAP, '#ffffff', '#7fb2ff'], 5, 90, 0.25, { kind: 'spark' });
    }

    // Warnlinie unter den Figuren: dünn, wird während der Ankündigung länger und kräftiger
    drawUnder(ctx, camera) {
        if (this.dead || this.charge <= 0) return;
        const ch = Math.min(1, this.charge);
        const mx = this.centerX(), my = this.centerY();
        const dx = this.aimX - mx, dy = this.aimY - my;
        const d = Math.hypot(dx, dy) || 1;
        const L = Math.min(d + 10, 40 + 240 * ch);
        const p = camera.worldToScreen(mx, my);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (0.25 + 0.5 * ch) * (ch > 0.7 ? 0.75 + 0.25 * Math.sin(Art.time * 40) : 1);
        ctx.strokeStyle = ch > 0.7 ? '#ffffff' : ThunderKit.ZAP;
        ctx.lineWidth = ch > 0.7 ? 1.8 : 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x + (dx / d) * 12, p.y + (dy / d) * 12);
        ctx.lineTo(p.x + (dx / d) * L, p.y + (dy / d) * L);
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2 + Math.sin(t * 2.8 + this.seed) * 2.4;
        const key = this.isKeyGhost;
        if (this.dead) {
            // Platzen: aufblähen, verblassen
            const d = clamp(this.deathProgress(), 0, 1);
            const a0 = ctx.globalAlpha;
            ctx.globalAlpha = a0 * (1 - d);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1 + d * 0.7, 1 + d * 0.7);
            ctx.translate(-cx, -cy);
            this._drawFigure(ctx, cx, cy, t, 0, key, true);
            ctx.restore();
            ctx.globalAlpha = a0;
            return;
        }
        this._drawFigure(ctx, cx, cy, t, Math.min(1, this.charge), key, false);
        if (key) LateWorldArt.keyBadge(ctx, cx, pos.y - 15);
    }

    _drawFigure(ctx, cx, cy, t, ch, key, dead) {
        const zap = key ? '#ffd23f' : ThunderKit.ZAP;
        const body = key ? '#ffb02e' : '#4c8dff';
        const fk = Math.floor(t * 14 + this.seed * 7);
        const flick = 0.7 + 0.3 * ThunderKit.hash(fk);
        Art.glow(ctx, cx, cy, 25 + ch * 10, zap, 0.3 * flick + ch * 0.45);
        // knisternder Zackenkranz (8 Zacken, zittert)
        ctx.beginPath();
        const rot = t * 0.9 + this.seed;
        for (let i = 0; i < 16; i++) {
            const a = rot + (i * TAU) / 16;
            const r = i % 2 ? 10.5 : 15.5 + (ThunderKit.hash(fk + i) - 0.5) * 3.5 + ch * 3;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = zap;
        ctx.fill();
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = Art.ink(zap);
        ctx.stroke();
        Art.body(ctx, cx, cy, 11.5, 11.5, body, { lineWidth: 1.5 });
        // kleiner Blitz über die Stirn
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 7.5);
        ctx.lineTo(cx - 2, cy - 5.5);
        ctx.lineTo(cx + 0.5, cy - 8.5);
        ctx.lineTo(cx + 5.5, cy - 6.5);
        ctx.strokeStyle = Art.alpha('#ffffff', 0.4 + 0.5 * flick);
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        ctx.stroke();
        const lk = this.look;
        if (dead) {
            Art.eyes(ctx, cx, cy, 3, { gap: 4.4, open: 0, blink: false });
            Art.mouth(ctx, cx, cy + 5, 5, 'o');
            return;
        }
        Art.eyes(ctx, cx + lk.x * 1.4, cy - 0.5 + lk.y * 1, 3.2, { gap: 4.4, look: lk, angry: true, seed: this.seed, iris: '#ffb300' });
        Art.mouth(ctx, cx + lk.x, cy + 5.4, 6, ch > 0.4 ? 'open' : 'grin');
        // Funke zuckt zum Ziel (Ankündigung)
        if (ch > 0) {
            const mx = this.centerX(), my = this.centerY();
            const dx = this.aimX - mx, dy = this.aimY - my, d = Math.hypot(dx, dy) || 1;
            const ux = dx / d, uy = dy / d;
            const L = 8 + 12 * ch;
            const sx = cx + ux * 13, sy = cy + uy * 13;
            ctx.beginPath();
            ThunderKit.zigzag(ctx, sx, sy, sx + ux * L, sy + uy * L, 3, 3, fk * 3);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.stroke();
            Art.sparkle(ctx, sx + ux * L, sy + uy * L, 2.5 + ch * 3, '#ffffff', 0.6 + 0.4 * flick);
        }
    }
}

// ══════════════════════════════════════════
// Boss: Hundert-Augen-Blitzball
// ══════════════════════════════════════════

// Riesige Gewitterkugel mit einer kleinen Wolkenfrisur, einem breiten Grinsen und 100 Augen, die einzeln
// blinzeln und alle zu Mark schauen. Schwebt mit Abstand zu Mark im Boss-Raum.
// Angriffe im Wechsel (Bossuhr, main.js lässt sie 1,15-mal schneller laufen):
//  a) Blitzstachel-Salve: fliegt in die Raummitte, lädt 0,8 s auf (Kugel wird heller, Stacheln fahren aus,
//     grüne Gassen am Boden), dann Ringe aus Stacheln in alle Richtungen mit drei Lücken
//     (Phase 1: 2 Ringe × 23, Phase 2: 3 Ringe × 21, alle 0,42 s)
//  b) Gezielte Stachelreihe: Warnlinien auf Mark und die Freunde (0,6 s, die letzten 0,15 s fest),
//     dann je Ziel eine Reihe aus 5 (Phase 2: 7) schnellen Stacheln
//  c) Phase 2 (halbe Lebenspunkte): kurzes Aufladen mit roten Augen, danach eine rotierende Spirale aus
//     4 Armen (3 Stacheln an, 2 aus), 2,4 s lang
// Höchstens 66 Boss-Stacheln gleichzeitig (ThunderKit.BOSS_CAP).
class BossThunderBall extends Enemy {
    constructor(x, y) {
        super(x, y, 84, 84);
        this.hp = 100;
        this.maxHp = 100;
        this.speed = 46;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.flying = true;
        this.shadow = { rx: 44, ry: 11, dy: 58, alpha: 0.22 };
        this.fxColor = ThunderKit.ZAP;
        this.seed = Math.random() * 10;
        this.t = 0;
        this.look = { x: 0, y: 1 };
        this.aimX = undefined;
        this.aimY = undefined;
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 0.9;
        this.stateMax = 0.9;
        this.cycle = 0;
        this.pending = 'salve';     // was nach dem Flug in die Mitte kommt
        this.vx = 0;
        this.vy = 0;
        this.tx = null;
        this.ty = null;
        this.retarget = 0;
        this.glowK = 0;             // Aufladen 0..1 (Darstellung: heller, Stacheln, Augen weit)
        this.fireK = 0;             // kurzer Rückstoß nach einem Schuss (Darstellung)
        this.spinShow = 0;          // Drehung des Stachelkranzes (Darstellung)
        this.gapA = 0;
        this.ringN = 32;
        this.gapW = 3;
        this.ringsTotal = 2;
        this.ringsFired = 0;
        this.ringGap = 0.42;
        this.laneFade = 0;
        this.laneX = 0;
        this.laneY = 0;
        this.spinA = 0;
        this.spinDir = 1;
        this.emitT = 0;
        this.emitN = 0;
        this.rowLeft = 0;
        this.rowT = 0;
        this.targets = [];
        this._tpool = [{ obj: null, a: 0, x: 0, y: 0 }, { obj: null, a: 0, x: 0, y: 0 }, { obj: null, a: 0, x: 0, y: 0 }];
        this._room = null;
        this.eyes = BossThunderBall.makeEyes(this.seed);
        this._eyeLook = new Float32Array(this.eyes.length * 2);
    }

    static get R() { return 44; }

    // 100 Augen auf der Vorderseite der Kugel (Fibonacci-Kugel), ohne Mund und Wolkenfrisur.
    // x, y in Einheiten relativ zur Mitte; r Augengröße (am Rand kleiner); Blinzeln je Auge eigen.
    static makeEyes(seed) {
        const R = BossThunderBall.R;
        let pts = [];
        for (let N = 200; N < 600; N += 10) {
            pts = [];
            for (let i = 0; i < N; i++) {
                const y = 1 - (2 * (i + 0.5)) / N;
                const rr = Math.sqrt(1 - y * y);
                const th = i * 2.399963;
                const x = Math.cos(th) * rr, z = Math.sin(th) * rr;
                if (z < 0.16) continue;
                if (y < -0.8) continue;                                       // Wolkenfrisur
                if (y > 0.36 && y < 0.8 && Math.abs(x) < 0.5) continue;       // Mund
                pts.push({ x, y, z });
            }
            if (pts.length >= 100) break;
        }
        pts.sort((a, b) => b.z - a.z);
        pts.length = Math.min(100, pts.length);
        const eyes = [];
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            const h = ThunderKit.hash(i * 3.7 + seed);
            eyes.push({
                x: p.x * R * 0.97, y: p.y * R * 0.97,
                r: 3.7 * (0.42 + 0.58 * p.z) * (0.85 + 0.3 * h),
                flat: 0.55 + 0.45 * p.z,                                     // seitlich gestaucht am Rand
                rate: 0.8 + 0.5 * ThunderKit.hash(i * 1.3 + 9),
                period: 3 + 3.5 * ThunderKit.hash(i * 2.1 + 4),
                ph: h * 10,
            });
        }
        return eyes;
    }

    static room(world) {
        if (typeof Game === 'undefined' || Game.world !== world || !Game.bossActive || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    takeDamage(amount, knockbackAngle, knockbackForce) {
        super.takeDamage(amount, knockbackAngle, knockbackForce ? knockbackForce * 0.3 : knockbackForce);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (!this._room) this._room = BossThunderBall.room(world);
        if (this.homeX === undefined) {
            this.homeX = this.centerX();
            this.homeY = this.centerY();
        }
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const mx = this.centerX(), my = this.centerY();
        const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
        this.aimX = pcx;
        this.aimY = pcy;
        const dx = pcx - mx, dy = pcy - my;
        const dist = Math.hypot(dx, dy) || 1;
        const lk = 1 - Math.exp(-7 * dt);
        this.look.x += (dx / dist - this.look.x) * lk;
        this.look.y += (dy / dist - this.look.y) * lk;
        this.fireK = Math.max(0, this.fireK - dt * 4);
        if (this.laneFade > 0) this.laneFade -= dt;
        this.spinShow += dt * (this.state === 'spiral' ? this.spinDir * 1.25 : (this.phase === 2 ? 0.5 : 0.25));
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this._startAwaken();
        this._drift(dt, world, pcx, pcy, dist);

        // Aufladen (nur Darstellung)
        let want = 0;
        const k = 1 - Math.max(0, this.stateT) / (this.stateMax || 1);
        switch (this.state) {
            case 'salveCharge': case 'spiralCharge': want = k; break;
            case 'salve': case 'spiral': case 'awaken': want = 1; break;
            case 'rowAim': want = 0.55 * k; break;
            case 'row': want = 0.55; break;
        }
        this.glowK = want > this.glowK ? want : Math.max(want, this.glowK - dt * 2.5);
        if (!list) return;

        switch (this.state) {
            case 'intro':
                this.stateT -= dt;
                if (this.stateT <= 0) this._toRest(0.35);
                break;
            case 'rest':
                this.stateT -= dt;
                if (this.stateT <= 0) this._startAttack(pcx, pcy);
                break;
            case 'toCenter':
                this.stateT -= dt;
                if (this.stateT <= 0 || Math.hypot(this.tx - mx, this.ty - my) < 10) this._startCharge(pcx, pcy);
                break;
            case 'awaken':
                this.stateT -= dt;
                if (this.stateT <= 0) {
                    this.pending = 'spiral';
                    this._startCenter(pcx, pcy);
                }
                break;
            case 'salveCharge':
                this.stateT -= dt;
                if (this.stateT <= 0) this._releaseSalve(mx, my);
                break;
            case 'salve':
                this.stateT -= dt;
                if (this.stateT <= 0) {
                    this._fireRing(list, mx, my);
                    this.ringsFired++;
                    if (this.ringsFired >= this.ringsTotal) {
                        this._toRest(this.phase === 2 ? 1.05 : 1.35);
                        this.laneFade = 0.9;
                    } else {
                        this.stateT += this.ringGap;
                    }
                }
                break;
            case 'spiralCharge':
                this.stateT -= dt;
                if (this.stateT <= 0) {
                    this.state = 'spiral';
                    this.stateT = this.stateMax = 2.4;
                    this.spinA = this.gapA;
                    this.emitT = 0;
                    this.emitN = 0;
                    ThunderKit.shake(3, 0.3);
                }
                break;
            case 'spiral':
                this.stateT -= dt;
                this.spinA += this.spinDir * 1.25 * dt;
                this.emitT -= dt;
                while (this.emitT <= 0 && this.stateT > 0) {
                    this._emitSpiral(list, mx, my);
                    this.emitT += 0.11;
                }
                if (this.stateT <= 0) this._toRest(1.2);
                break;
            case 'rowAim':
                this.stateT -= dt;
                if (this.stateT > 0.15) this._trackTargets(mx, my);
                if (this.stateT <= 0) {
                    this.state = 'row';
                    this.rowLeft = this.phase === 2 ? 7 : 5;
                    this.rowT = 0;
                }
                break;
            case 'row':
                this.rowT -= dt;
                while (this.rowT <= 0 && this.rowLeft > 0) {
                    this._emitRow(list, mx, my);
                    this.rowT += 0.075;
                }
                if (this.rowLeft <= 0) this._toRest(this.phase === 2 ? 0.75 : 1.0);
                break;
        }
    }

    // ── Bewegung ──

    _drift(dt, world, pcx, pcy, dist) {
        const st = this.state;
        const still = st === 'salveCharge' || st === 'salve' || st === 'spiralCharge' || st === 'spiral' ||
            st === 'awaken' || st === 'row';
        const rush = st === 'toCenter';
        this.retarget -= dt;
        if (!rush && (this.tx === null || this.retarget <= 0 || (dist < 80 && this.retarget < 1.2))) this._pickTarget(pcx, pcy);
        let wx = 0, wy = 0;
        if (!still) {
            const ddx = this.tx - this.centerX(), ddy = this.ty - this.centerY();
            const dd = Math.hypot(ddx, ddy);
            const relaxed = st === 'rest' || st === 'intro';
            const sp = Math.min(this.speed * (this.phase === 2 ? 1.2 : 1) * (rush ? 2 : (relaxed ? 1 : 0.4)), dd * 3);
            if (dd > 1) {
                wx = (ddx / dd) * sp;
                wy = (ddy / dd) * sp;
            }
        }
        const k = 1 - Math.exp(-(still ? 8 : 3) * dt);
        this.vx += (wx - this.vx) * k;
        this.vy += (wy - this.vy) * k;
        const fl = still ? 0 : 1;
        const fx = Math.sin(this.t * 1.7 + this.seed) * 8 * fl;
        const fy = Math.cos(this.t * 2.3 + this.seed) * 6 * fl;
        this._moveWithCollision((this.vx + fx) * dt, (this.vy + fy) * dt, world);
    }

    _pickTarget(pcx, pcy) {
        const r = this._room;
        const cx = this.centerX(), cy = this.centerY();
        let bx = cx, by = cy, best = -Infinity;
        for (let i = 0; i < 7; i++) {
            const a = Math.random() * TAU;
            const d = randRange(110, 160);
            let x = pcx + Math.cos(a) * d, y = pcy + Math.sin(a) * d;
            if (r) {
                x = clamp(x, r.x + 50, r.x + r.w - 50);
                y = clamp(y, r.y + 56, r.y + r.h - 50);
            } else {
                x = clamp(x, this.homeX - 80, this.homeX + 80);
                y = clamp(y, this.homeY - 50, this.homeY + 50);
            }
            let score = -Math.abs(Math.hypot(x - pcx, y - pcy) - 135) - Math.hypot(x - cx, y - cy) * 0.12;
            if (r) score -= Math.max(0, y - (r.y + r.h * 0.6)) * 0.4;
            if (score > best) { best = score; bx = x; by = y; }
        }
        this.tx = bx;
        this.ty = by;
        this.retarget = randRange(1.8, 2.6);
    }

    // ── Angriffe ──

    _toRest(time) {
        this.state = 'rest';
        this.stateT = time;
        this.stateMax = time;
    }

    _startAttack(pcx, pcy) {
        const C = this.phase === 2 ? BossThunderBall.CYCLE2 : BossThunderBall.CYCLE1;
        const kind = C[this.cycle % C.length];
        this.cycle++;
        if (kind === 'row') this._startRow();
        else {
            this.pending = kind;
            this._startCenter(pcx, pcy);
        }
    }

    // Vor Salve und Spirale in die Raummitte (mit Abstand zu Mark), dort ist am meisten Platz
    _startCenter(pcx, pcy) {
        const r = this._room;
        const mx = r ? r.x + r.w / 2 : this.homeX, my = r ? r.y + r.h / 2 : this.homeY;
        let bx = mx, by = my, best = -Infinity;
        const C = BossThunderBall.CENTER_SPOTS;
        for (let i = 0; i < C.length; i += 2) {
            const x = mx + C[i], y = my + C[i + 1];
            const score = Math.min(Math.hypot(x - pcx, y - pcy), 120) - 0.4 * Math.hypot(C[i], C[i + 1]);
            if (score > best) { best = score; bx = x; by = y; }
        }
        this.tx = bx;
        this.ty = by;
        this.state = 'toCenter';
        this.stateT = this.stateMax = 1.3;
        if (Math.hypot(bx - this.centerX(), by - this.centerY()) < 10) this._startCharge(pcx, pcy);
    }

    _startCharge(pcx, pcy) {
        const toMark = Math.atan2(pcy - this.centerY(), pcx - this.centerX());
        // Lücken so legen, dass Mark ein Stück laufen muss (die nächste liegt 20–50° neben ihm)
        this.gapA = toMark + (Math.random() < 0.5 ? -1 : 1) * randRange(0.35, 0.9);
        if (this.pending === 'spiral') {
            this.state = 'spiralCharge';
            this.stateT = this.stateMax = 0.7;
            this.spinDir = Math.random() < 0.5 ? -1 : 1;
        } else {
            this.state = 'salveCharge';
            this.stateT = this.stateMax = 0.8;
            this.ringN = this.phase === 2 ? 30 : 32;
            this.gapW = 3;
        }
    }

    _startAwaken() {
        this.phase = 2;
        this.state = 'awaken';
        this.stateT = this.stateMax = 0.9;
        this.rowLeft = 0;
        ThunderKit.shake(5, 0.4);
        if (typeof FX !== 'undefined') {
            const x = this.centerX(), y = this.centerY();
            FX.burst(x, y, ['#ff3d5a', ThunderKit.ZAP, '#ffffff'], 18, 200, 0.6, { kind: 'spark' });
            FX.ring(x, y, '#ff6b7a', 90, 0.5, 4);
        }
    }

    _releaseSalve(mx, my) {
        this.state = 'salve';
        this.ringsTotal = this.phase === 2 ? 3 : 2;
        this.ringGap = 0.42;
        this.ringsFired = 0;
        this.stateT = 0;
        this.laneX = mx;
        this.laneY = my;
        ThunderKit.shake(3, 0.3);
        if (typeof FX !== 'undefined') {
            FX.burst(mx, my, [ThunderKit.ZAP, '#ffffff', '#7fb2ff'], 14, 200, 0.5, { kind: 'spark' });
            FX.ring(mx, my, '#fff6a0', 70, 0.35, 4);
        }
    }

    // Ein Ring: N Plätze, an drei Stellen (gapA + k·120°) je gapW Plätze frei
    _fireRing(list, mx, my) {
        const N = this.ringN;
        const third = N / 3;
        const gw = this.gapW;
        const off = gw % 2 === 0 ? 0.5 : 0;
        let live = ThunderKit.liveBossShots(list);
        const col = this.ringsFired % 2 ? '#7fd8ff' : ThunderKit.ZAP;
        const speed = this.phase === 2 ? 112 : 102;
        for (let i = 0; i < N; i++) {
            const m = i % third;
            const d = Math.abs(m + off < third / 2 ? m + off : m + off - third);
            if (d < gw / 2) continue;
            if (live >= ThunderKit.BOSS_CAP) break;
            const a = this.gapA + ((i + off) * TAU) / N;
            list.push(new SpikeShot(mx + Math.cos(a) * 40, my + Math.sin(a) * 40, a, speed, col, { life: 3.4 }));
            live++;
        }
        this.fireK = 1;
    }

    // Spirale: 4 Arme, jeder Arm 3 Stacheln an, 2 aus (Lücken zum Durchschlüpfen)
    _emitSpiral(list, mx, my) {
        const n = this.emitN++;
        let live = ThunderKit.liveBossShots(list);
        for (let j = 0; j < 4; j++) {
            if ((n + j * 2) % 5 >= 3) continue;
            if (live >= ThunderKit.BOSS_CAP) break;
            const a = this.spinA + (j * TAU) / 4;
            list.push(new SpikeShot(mx + Math.cos(a) * 40, my + Math.sin(a) * 40, a, 100, j % 2 ? '#ff7a8a' : ThunderKit.ZAP, { life: 3.4 }));
            live++;
        }
        this.fireK = Math.max(this.fireK, 0.4);
    }

    // Gezielte Reihe: Ziele sammeln (Mark und bis zu zwei Freunde in der Nähe)
    _startRow() {
        this.state = 'rowAim';
        this.stateT = this.stateMax = 0.6;
        const T = this.targets;
        T.length = 0;
        const P = typeof Game !== 'undefined' ? Game.player : null;
        if (P && !P.dead) {
            const o = this._tpool[0];
            o.obj = P;
            T.push(o);
        }
        const cs = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        const mx = this.centerX(), my = this.centerY();
        for (let i = 0; i < cs.length && T.length < 3; i++) {
            const c = cs[i];
            if (!ThunderKit.companionOk(c)) continue;
            if (Math.hypot(c.x + (c.w || 20) / 2 - mx, c.y + (c.h || 20) / 2 - my) > 380) continue;
            const o = this._tpool[T.length];
            o.obj = c;
            T.push(o);
        }
        if (!T.length && this.aimX !== undefined) {
            // ohne Spiel (z. B. Galerie): auf den gemerkten Punkt
            const o = this._tpool[0];
            o.obj = { x: this.aimX - 10, y: this.aimY - 10, w: 20, h: 20 };
            T.push(o);
        }
        this._trackTargets(mx, my);
    }

    _trackTargets(mx, my) {
        for (const o of this.targets) {
            const b = o.obj;
            o.x = b.x + (b.w || 20) / 2;
            o.y = b.y + (b.h || 20) / 2;
            o.a = Math.atan2(o.y - my, o.x - mx);
        }
    }

    _emitRow(list, mx, my) {
        this.rowLeft--;
        let live = ThunderKit.liveBossShots(list);
        const speed = this.phase === 2 ? 195 : 180;
        for (const o of this.targets) {
            if (live >= ThunderKit.BOSS_CAP) break;
            list.push(new SpikeShot(mx + Math.cos(o.a) * 40, my + Math.sin(o.a) * 40, o.a, speed, '#fff27a', { life: 2.6, size: 1.1, stun: 1.2 }));
            live++;
        }
        this.fireK = Math.max(this.fireK, 0.5);
    }

    // ── Zeichnen ──

    // Bodenzeichen: grüne Gassen der Salve, Warnlinien der Stachelreihe
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const lanesAfter = st === 'rest' && this.laneFade > 0;
        if (st === 'salveCharge' || st === 'salve' || lanesAfter) {
            const c = st === 'salveCharge' ? camera.worldToScreen(this.centerX(), this.centerY()) : camera.worldToScreen(this.laneX, this.laneY);
            const k = st === 'salveCharge' ? 1 - Math.max(0, this.stateT) / this.stateMax : 1;
            const fade = lanesAfter ? 0.6 * Math.max(0, this.laneFade) : 1;
            const r = this._room;
            ctx.save();
            if (r) {
                const tl = camera.worldToScreen(r.x, r.y);
                ctx.beginPath();
                ctx.rect(tl.x, tl.y, r.w, r.h);
                ctx.clip();
            }
            this._drawLanes(ctx, c.x, c.y, k, fade);
            ctx.restore();
        }
        if (st === 'spiralCharge') {
            const c = camera.worldToScreen(this.centerX(), this.centerY());
            const k = 1 - Math.max(0, this.stateT) / this.stateMax;
            Art.ring(ctx, c.x, c.y, 56 + 30 * (1 - k), '#ff6b7a', 3, 0.25 + 0.5 * k);
        }
        if (st === 'rowAim' && this.targets.length) {
            const c = camera.worldToScreen(this.centerX(), this.centerY());
            const k = 1 - Math.max(0, this.stateT) / this.stateMax;
            const locked = this.stateT <= 0.15;
            const a0 = ctx.globalAlpha;
            ctx.beginPath();
            for (const o of this.targets) {
                const d = Math.min(420, Math.hypot(o.x - this.centerX(), o.y - this.centerY()) + 30);
                const L = 44 + (d - 44) * Math.min(1, k * 1.6);
                const ca = Math.cos(o.a), sa = Math.sin(o.a);
                ctx.moveTo(c.x + ca * 44, c.y + sa * 44);
                ctx.lineTo(c.x + ca * L, c.y + sa * L);
            }
            ctx.lineCap = 'round';
            ctx.strokeStyle = locked ? '#ffffff' : ThunderKit.ZAP;
            ctx.lineWidth = locked ? 3 : 1.8;
            ctx.globalAlpha = a0 * (0.3 + 0.5 * k) * (locked ? 0.75 + 0.25 * Math.sin(Art.time * 40) : 1);
            ctx.stroke();
            ctx.globalAlpha = a0;
        }
    }

    // Gefahrenring und drei grüne Gassen (die Lücken der Ringe) mit Pfeilen nach außen
    _drawLanes(ctx, x, y, k, fade) {
        const a0 = ctx.globalAlpha;
        const w = ((this.gapW / 2 - 0.3) * TAU) / this.ringN;
        const r0 = 58, r1 = 250;
        ctx.globalAlpha = a0 * (0.3 + 0.2 * Math.sin(Art.time * 14)) * fade;
        ctx.strokeStyle = ThunderKit.ZAP;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r0 - 8 + 12 * (1 - k), 0, TAU);
        ctx.stroke();
        // Gassen
        ctx.globalAlpha = a0 * (0.12 + 0.2 * k) * fade;
        ctx.fillStyle = '#5dff9a';
        ctx.beginPath();
        for (let g = 0; g < 3; g++) {
            const a = this.gapA + (g * TAU) / 3;
            ctx.moveTo(x + Math.cos(a - w) * r0, y + Math.sin(a - w) * r0);
            ctx.arc(x, y, r1, a - w, a + w);
            ctx.arc(x, y, r0, a + w, a - w, true);
            ctx.closePath();
        }
        ctx.fill();
        // Pfeile nach außen
        ctx.globalAlpha = a0 * (0.35 + 0.45 * k) * fade;
        ctx.strokeStyle = '#5dff9a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const run = (Art.time * 1.4) % 1;
        for (let g = 0; g < 3; g++) {
            const a = this.gapA + (g * TAU) / 3;
            const ca = Math.cos(a), sa = Math.sin(a);
            for (let j = 0; j < 2; j++) {
                const d = r0 + 20 + (run + j * 0.5) * 90;
                const tx = x + ca * d, ty = y + sa * d;
                ctx.moveTo(tx - ca * 8 - sa * 7, ty - sa * 8 + ca * 7);
                ctx.lineTo(tx, ty);
                ctx.lineTo(tx - ca * 8 + sa * 7, ty - sa * 8 - ca * 7);
            }
        }
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const cx = pos.x + this.w / 2;
        const bob = this.state === 'salve' || this.state === 'spiral' ? 0 : Math.sin(t * 1.8 + this.seed) * 3;
        const cy = pos.y + this.h / 2 + bob;
        const R = BossThunderBall.R;
        const dead = this.dead;
        const red = !dead && (this.phase === 2 || this.hp <= this.maxHp / 2);
        const ch = dead ? 0 : this.glowK;
        const fk = Math.floor(t * 12 + this.seed * 5);
        const flick = 0.75 + 0.25 * ThunderKit.hash(fk);
        // Leuchten
        Art.glow(ctx, cx, cy, R * 1.9 + ch * 22, ThunderKit.ZAP, (0.2 + ch * 0.35) * flick);
        if (red) Art.glow(ctx, cx, cy, R * 1.5, '#ff3d5a', 0.22 + 0.12 * Math.sin(t * 6));
        // Stachelkranz (fährt beim Aufladen aus)
        if (!dead) this._drawSpikes(ctx, cx, cy, R, ch, red);
        // Kugel: je heller, desto mehr aufgeladen (Farbe in Stufen, damit der Verlauf-Speicher klein bleibt)
        if (this.fireK > 0) Art.glow(ctx, cx, cy, R * 1.5, '#ffffff', this.fireK * 0.3);
        const lvl = Math.min(4, Math.floor(ch * 4.99));
        Art.body(ctx, cx, cy, R, R, BossThunderBall.BODY[lvl], { lineWidth: 2.4 });
        // Wolkenfrisur
        this._drawCloud(ctx, cx, cy - R * 0.9, t);
        // Blitze, die über die Kugel kriechen
        if (!dead) {
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const a = ThunderKit.hash(fk * 3 + i) * TAU;
                const a2 = a + 0.9 + ThunderKit.hash(fk * 5 + i) * 0.9;
                const r1 = R * 0.92;
                ThunderKit.zigzag(ctx, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
                    cx + Math.cos(a2) * r1 * 0.55, cy + Math.sin(a2) * r1 * 0.55, 4, 4, fk * 7 + i * 31);
            }
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = Art.alpha('#fff6a0', 0.35 + 0.35 * ch);
            ctx.lineWidth = 1.8;
            ctx.stroke();
        }
        this._drawEyes(ctx, cx, cy, t, ch, red, dead);
        // Mund: breites Grinsen, beim Aufladen und in Phase 2 mit Zähnen
        Art.mouth(ctx, cx, cy + R * 0.55, 26, dead ? 'o' : (red || ch > 0.5 ? 'teeth' : 'grin'));
    }

    _drawSpikes(ctx, cx, cy, R, ch, red) {
        const n = 18;
        const L = 5 + 17 * ch + this.fireK * 4;
        const rot = this.spinShow;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const a = rot + (i * TAU) / n;
            const ll = L * (0.85 + 0.3 * ThunderKit.hash(i + Math.floor(Art.time * 10) * 0.1));
            const ca = Math.cos(a), sa = Math.sin(a);
            const wa = 0.11;
            ctx.moveTo(cx + Math.cos(a - wa) * (R - 2), cy + Math.sin(a - wa) * (R - 2));
            ctx.lineTo(cx + ca * (R + ll), cy + sa * (R + ll));
            ctx.lineTo(cx + Math.cos(a + wa) * (R - 2), cy + Math.sin(a + wa) * (R - 2));
            ctx.closePath();
        }
        ctx.fillStyle = red ? '#ffd0a0' : ThunderKit.ZAP;
        ctx.fill();
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = red ? '#b3261e' : Art.ink(ThunderKit.ZAP);
        ctx.stroke();
    }

    _drawCloud(ctx, x, y, t) {
        const wob = Math.sin(t * 1.3 + this.seed) * 1.2;
        Art.body(ctx, x - 17, y + 5, 12, 9, '#cdd3ff', { lineWidth: 1.8, highlight: false });
        Art.body(ctx, x + 17, y + 5, 12, 9, '#cdd3ff', { lineWidth: 1.8, highlight: false });
        Art.body(ctx, x + wob, y - 2, 16, 12, '#e6e9ff', { lineWidth: 1.8 });
    }

    // 100 Augen in gebündelten Pfaden. Jedes Auge blinzelt für sich und schaut zu Mark.
    _drawEyes(ctx, cx, cy, t, ch, red, dead) {
        const E = this.eyes;
        const L = this._eyeLook;
        const wx = this.centerX(), wy = this.centerY();
        const hasAim = this.aimX !== undefined;
        const wide = 1 + ch * 0.12;
        const open = BossThunderBall._open || (BossThunderBall._open = new Float32Array(100));
        // Offenheit und Blickrichtung je Auge
        for (let i = 0; i < E.length; i++) {
            const e = E[i];
            let o = 1;
            if (dead) o = 0;
            else {
                const ph = (t * e.rate + e.ph) % e.period;
                if (ph < 0.16) o = Math.abs(ph - 0.08) / 0.08;
            }
            open[i] = o;
            let lx = this.look.x, ly = this.look.y;
            if (hasAim) {
                const dx = this.aimX - (wx + e.x), dy = this.aimY - (wy + e.y);
                const d = Math.hypot(dx, dy) || 1;
                lx = dx / d; ly = dy / d;
            }
            L[i * 2] = lx;
            L[i * 2 + 1] = ly;
        }
        // Weiß
        ctx.beginPath();
        for (let i = 0; i < E.length; i++) {
            if (open[i] < 0.2) continue;
            const e = E[i];
            const r = e.r * wide;
            const x = cx + e.x, y = cy + e.y;
            ctx.moveTo(x + r * e.flat, y);
            ctx.ellipse(x, y, r * e.flat, r * 1.05 * open[i], 0, 0, TAU);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = '#1a1a4a';
        ctx.stroke();
        // Iris
        ctx.beginPath();
        for (let i = 0; i < E.length; i++) {
            if (open[i] < 0.45) continue;
            const e = E[i];
            const r = e.r * wide;
            const x = cx + e.x + L[i * 2] * r * 0.36 * e.flat, y = cy + e.y + L[i * 2 + 1] * r * 0.32;
            const ir = r * 0.6;
            ctx.moveTo(x + ir, y);
            ctx.arc(x, y, ir, 0, TAU);
        }
        ctx.fillStyle = red ? '#ff2d3d' : '#ffb300';
        ctx.fill();
        // Pupille
        ctx.beginPath();
        for (let i = 0; i < E.length; i++) {
            if (open[i] < 0.45) continue;
            const e = E[i];
            const r = e.r * wide;
            const x = cx + e.x + L[i * 2] * r * 0.4 * e.flat, y = cy + e.y + L[i * 2 + 1] * r * 0.36;
            const pr = r * (red ? 0.26 : 0.34);
            ctx.moveTo(x + pr, y);
            ctx.arc(x, y, pr, 0, TAU);
        }
        ctx.fillStyle = '#150c24';
        ctx.fill();
        // Glanz (nur bei größeren Augen)
        ctx.beginPath();
        for (let i = 0; i < E.length; i++) {
            const e = E[i];
            if (open[i] < 0.45 || e.r < 2.6) continue;
            const r = e.r * wide;
            const x = cx + e.x + L[i * 2] * r * 0.36 * e.flat - r * 0.25, y = cy + e.y + L[i * 2 + 1] * r * 0.32 - r * 0.28;
            const gr = Math.max(0.5, r * 0.2);
            ctx.moveTo(x + gr, y);
            ctx.arc(x, y, gr, 0, TAU);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        // Geschlossene Augen: Lidstrich
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < E.length; i++) {
            if (open[i] >= 0.2) continue;
            const e = E[i];
            const r = e.r * e.flat;
            const x = cx + e.x, y = cy + e.y;
            ctx.moveTo(x - r, y);
            ctx.quadraticCurveTo(x, y + r * 0.5, x + r, y);
            any = true;
        }
        if (any) {
            ctx.lineCap = 'round';
            ctx.lineWidth = 1.1;
            ctx.strokeStyle = '#1a1a4a';
            ctx.stroke();
        }
        if (red) {
            // rote Augen glühen
            Art.glow(ctx, cx, cy - 4, BossThunderBall.R * 0.9, '#ff3d5a', 0.18 + 0.1 * Math.sin(t * 9));
        }
    }
}

// Kugelfarben je Aufladestufe (0 = ruhig … 4 = voll geladen)
BossThunderBall.BODY = ['#3d6bff', '#4f7bff', '#638bff', '#789cff', '#8eadff'];
BossThunderBall.CYCLE1 = ['salve', 'row', 'salve', 'row', 'row'];
BossThunderBall.CYCLE2 = ['spiral', 'row', 'salve', 'row', 'spiral', 'salve', 'row'];
// Plätze um die Raummitte (dx, dy) für Salve und Spirale
BossThunderBall.CENTER_SPOTS = [0, 0, -60, 0, 60, 0, 0, -40, 0, 40, -60, -40, 60, -40, -60, 40, 60, 40];
