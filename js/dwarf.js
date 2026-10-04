// ── Welt 36: Zwergengarten ── (Idee von Leander)
// Boese Gartenzwerge: rote Zipfelmuetze, weisser Rauschebart, Knollennase, blaue Jacke. Sie halten
//   Abstand und werfen im Wechsel Gartenwerkzeug (Schaufel, Rechen, Giesskanne, Blumentopf), das sich
//   im Flug dreht, auf Mark oder einen Freund (Ausholen 0,5 s, das Werkzeug leuchtet in der Hand).
//   Manchmal kommen drei Wuerfe kurz hintereinander. Einer traegt den Schluessel (isKeyGhost setzt
//   main.js; Abzeichen wie beim Drachenkind mit LateWorldArt.keyBadge). Gerufene Helfer des Bosses
//   verpuffen, sobald der Boss besiegt ist (Muster aus witch.js).
// Riesenzwerg (Boss): riesiger Zwerg mit Riesenhammer, bleibt immer im Boss-Raum, zwei Phasen
//   (Phase 2 ab halben LP: Muetze glueht, Augen rot, schneller und wuetender).
//   Hammerschlag: hebt den Hammer ueber den Kopf (Warnkreis 1 s), schlaegt auf den Boden →
//     Schockwelle als wachsender Ring. Wer getroffen wird, bekommt 1 Schaden und ist kurz betaeubt
//     (Game.player.stun / c.stun wie in werewolf.js). Freunde verschwinden nie: ein Treffer, der sie
//     besiegen wuerde, haut sie nur um (knockOut wie in angel.js).
//   Werkzeugsturm: Warnlinien zeigen zu Mark und jedem Freund; dann fliegt JEDEM aus Marks Team
//     eine Reihe Gartenwerkzeug entgegen (drei Stueck unterschiedliches Tempo).
//   Phase 2: nach dem Hammerschlag fliegen zusaetzlich Werkzeuge in einem Ring mit Luecken in alle
//     Richtungen (die Flugrichtungen werden im Ausholen als Strahlen gezeigt). Nach jedem grossen
//     Angriff schnauft der Riese kurz: Zeit fuer Mark, zurueckzuhauen.

const DWARF_HAT = '#e63946', DWARF_JACKET = '#3a7bd5', DWARF_SKIN = '#ffd9b8';
const DWARF_BEARD = '#f2eee4', DWARF_BOOT = '#54402c', DWARF_BELT = '#7a4a22';
const DWARF_TOOL_COLORS = ['#cfd6e6', '#e8a13c', '#3ec7d8', '#e0703a'];
const DWARF_WARN = 0.6;             // Ausholen des normalen Zwergs (Gegner-Zeit, ≈ 0,5 s echt)
const DWARF_CAP = 56;               // hochstens so viele Gegnergeschosse gleichzeitig (Handy)
const DWARF_SMASH_R = 96;           // Warnkreis des Hammerschlags
const DWARF_WAVE_MAX = 152;         // wie weit die Schockwelle rollt
const DWARF_STUN = 2.2;             // Betaeubung durch die Schockwelle (Sekunden)

const DwarfArt = {
    // Schaden an Mark ueber die Engine (Wackeln, Ton, roter Rand); ohne Engine (Galerie) direkt.
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

    // Begleiter treffen (Juri, Krokodil): nie verschwinden lassen, ein toedlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(8);
        else c.takeDamage(amount);
        this.burst(c.x + c.w / 2, c.y + c.h / 2, [DWARF_TOOL_COLORS[3], '#ffffff'], 10, 140, 0.45, { kind: 'star' });
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

    // Gartenwerkzeug, mittig um (0, 0), Schaft entlang +x, Groesse s.
    // kind: 0 Schaufel, 1 Rechen, 2 Giesskanne, 3 Blumentopf.
    tool(ctx, kind, s) {
        if (kind === 0) {
            Art.limb(ctx, -7 * s, 0, 3 * s, 0, 2.2 * s, '#a9743c', { lineWidth: 1 });
            Art.shape(ctx, c => {
                c.moveTo(2 * s, -3.6 * s);
                c.lineTo(7.5 * s, -3.6 * s);
                c.quadraticCurveTo(10.5 * s, 0, 7.5 * s, 3.6 * s);
                c.lineTo(2 * s, 3.6 * s);
                c.closePath();
            }, { x: 2 * s, y: -3.6 * s, w: 8.5 * s, h: 7.2 * s }, '#c9d3e4', { lineWidth: 1.1, glossy: true });
        } else if (kind === 1) {
            Art.limb(ctx, -7 * s, 0, 4 * s, 0, 2 * s, '#a9743c', { lineWidth: 1 });
            Art.box(ctx, 4 * s, -5 * s, 2.4 * s, 10 * s, 1.2 * s, '#9fb6cf', { lineWidth: 1 });
            ctx.strokeStyle = Art.ink('#9fb6cf');
            ctx.lineWidth = 1.2 * s;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                ctx.moveTo(4 * s, i * 3.4 * s);
                ctx.lineTo(8 * s, i * 4.6 * s);
            }
            ctx.stroke();
        } else if (kind === 2) {
            Art.box(ctx, -6.5 * s, -3.6 * s, 9 * s, 7.6 * s, 2.2 * s, '#2fa8bd', { lineWidth: 1.1, glossy: true });
            Art.shape(ctx, c => {
                c.moveTo(2 * s, -1 * s);
                c.lineTo(8 * s, -5 * s);
                c.lineTo(8.8 * s, -3 * s);
                c.lineTo(3 * s, 1.6 * s);
                c.closePath();
            }, { x: 2 * s, y: -5 * s, w: 7 * s, h: 6.6 * s }, '#3ec7d8', { lineWidth: 1 });
            ctx.strokeStyle = Art.ink('#2fa8bd');
            ctx.lineWidth = 1.4 * s;
            ctx.beginPath();
            ctx.arc(-2 * s, -4.6 * s, 3 * s, Math.PI * 1.05, Math.PI * 1.95);
            ctx.stroke();
        } else {
            Art.shape(ctx, c => {
                c.moveTo(-5 * s, -3 * s);
                c.lineTo(5 * s, -3 * s);
                c.lineTo(3.4 * s, 5.5 * s);
                c.lineTo(-3.4 * s, 5.5 * s);
                c.closePath();
            }, { x: -5 * s, y: -3 * s, w: 10 * s, h: 8.5 * s }, '#c65a2c', { lineWidth: 1.1, glossy: true });
            Art.box(ctx, -5.8 * s, -4.6 * s, 11.6 * s, 2.4 * s, 1.2 * s, '#e0703a', { lineWidth: 1, highlight: false });
            Art.limb(ctx, 0, -4.4 * s, 0, -7.6 * s, 1.2 * s, '#3fae4c', { lineWidth: 0.8 });
            ctx.fillStyle = '#ff5f9e';
            for (let i = 0; i < 4; i++) {
                const a = (i * TAU) / 4 + 0.6;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * 2 * s, -8.6 * s + Math.sin(a) * 2 * s, 1.5 * s, 0, TAU);
                ctx.fill();
            }
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.arc(0, -8.6 * s, 1.1 * s, 0, TAU);
            ctx.fill();
        }
    },

    // Riesenhammer: Stiel entlang +x von 0 bis len, schwerer Kopf quer am Ende. hot = gluehend (Phase 2).
    hammer(ctx, len, hot, lw) {
        if (hot > 0) Art.glow(ctx, len * 0.86, 0, len * 0.34, '#ff5a3c', 0.3 + 0.4 * hot);
        Art.limb(ctx, -2, 0, len * 0.8, 0, 5.5, '#8a5a30', { lineWidth: lw });
        Art.box(ctx, len * 0.66, -13, len * 0.34, 26, 4, hot > 0.4 ? '#8b93a8' : '#9aa5bb', { lineWidth: lw + 0.4, glossy: true });
        ctx.fillStyle = '#6d778d';
        ctx.fillRect(len * 0.66, -3.5, len * 0.34, 7);
        ctx.strokeStyle = Art.ink('#6d778d');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(len * 0.66, -3.5);
        ctx.lineTo(len * 1.0, -3.5);
        ctx.moveTo(len * 0.66, 3.5);
        ctx.lineTo(len * 1.0, 3.5);
        ctx.stroke();
        Art.box(ctx, len * 0.1, -3.4, 4, 6.8, 1.6, '#ffd23f', { lineWidth: 1, outline: '#8a5200', highlight: false });
    },
};

// ══════════════════════════════════════════
// ── Gartenwerkzeug-Geschoss ──
// ══════════════════════════════════════════

// Dreht sich im Flug und huepft (nur Darstellung: haeufiges Anheben aus sin(Alter)).
// hitsCompanions: die Engine betaeubt Juri und das Krokodil bei einem Treffer (main.js).
class DwarfTool extends Projectile {
    constructor(x, y, angle, speed, kind) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 110);
        this.radius = 7;
        this.lifetime = 3;
        this.kind = ((kind % 4) + 4) % 4;
        this.rot0 = angle;
        this.spin = (this.kind === 1 ? 9.5 : 7) * (Math.random() < 0.5 ? -1 : 1);
        this.hop = randRange(8, 15);
        this.color = DWARF_TOOL_COLORS[this.kind];
        this.hitsCompanions = true;
        this.stunTime = 1.2;
    }

    // Kleiner Bodenschatten unter dem fliegenden Werkzeug
    drawUnder(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y + 9);
        ctx.fillStyle = 'rgba(40,30,20,0.20)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 7, 2.6, 0, 0, TAU);
        ctx.fill();
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const lift = Math.abs(Math.sin(this.age * 3.2 + this.kind)) * this.hop;
        Art.glow(ctx, p.x, p.y - lift, 12, this.color, 0.3);
        ctx.save();
        ctx.translate(p.x, p.y - lift);
        ctx.rotate(this.rot0 + this.spin * this.age);
        DwarfArt.tool(ctx, this.kind, 0.85);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boiser Gartenzwerg ──
// ══════════════════════════════════════════

// Gartenzwerg (Hitbox 26×26, 7 LP, Schluesseltraeger 9 LP). Haelt 90–200 Abstand, holt 0,5 s aus
// (Werkzeug leuchtet in der Hand) und wirft dann Schaufel, Rechen, Giesskanne oder Blumentopf auf
// Mark oder einen Freund. Manchmal drei Wuerfe kurz hintereinander (Schluesseltraeger immer).
// Gerufene Helfer (this.summoner gesetzt) bleiben im Boss-Raum und verpuffen mit dem Boss.
class GardenDwarf extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(46, 56);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;   // Schluesseltraeger darf nicht in der Wand landen
        this.seed = Math.random() * 10;
        this.nextKind = Math.floor(Math.random() * 4);
        this.look = { x: 0, y: 0.3 };
        this.face = 1;
        this.detectionRange = 250;
        this.engaged = false;
        this.shootT = randRange(1.0, 2.4);
        this.aimT = 0;                     // >0: Ausholen laeuft
        this.castT = 0;                    // Arm kurz vorgestreckt nach dem Wurf
        this.charge = 0;                   // 0..1 Ausholen-Anzeige
        this.burstLeft = 0;                // Schnellfolge: noch offene Wuerfe
        this.burstT = 0;
        this.target = null;
        this.aimKind = 0;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.strafeT = randRange(0.8, 1.8);
        this.wanderT = 0;
        this.wx = 0;
        this.wy = 0;
        this.summoner = null;              // Riesenzwerg, der diesen Zwerg rief
        this._keyInit = false;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schluesseltraeger (Flag setzt main.js nach dem Erzeugen): etwas zaeh
            this._keyInit = true;
            this.hp = this.maxHp = 9;
        }
        // Gerufene Helfer verpuffen mit dem Boss und bleiben im Boss-Raum (Muster aus witch.js)
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                DwarfArt.burst(this.centerX(), this.centerY(), [DWARF_JACKET, '#ffffff', DWARF_HAT], 9, 100, 0.45, { kind: 'star' });
                return;
            }
            const room = typeof Game !== 'undefined' && Game.bossActive && typeof Game._bossRoomRect === 'function' ? Game._bossRoomRect() : null;
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }
        if (this.castT > 0) this.castT -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (this.summoner || dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 70) this.engaged = false;

        // Ziel gueltig? Sonst zurueck auf Mark
        const t = this.target;
        if (t && (t === player ? player.dead : (t.dead || t.koTimer > 0 || t.hp <= 0))) this.target = null;
        const tgt = this.target || player;
        const tx = tgt.x + tgt.w / 2, ty = tgt.y + tgt.h / 2;
        const tdx = tx - mx, tdy = ty - my;
        const tdist = Math.hypot(tdx, tdy) || 1;

        this.charge = 0;
        // a) Ausholen: steht still, Werkzeug ueber dem Kopf
        if (this.aimT > 0) {
            this.aimT -= dt;
            this.charge = clamp(1 - this.aimT / DWARF_WARN, 0, 1);
            if (Math.abs(tdx) > 3) this.face = tdx > 0 ? 1 : -1;
            this._look(tdx / tdist, tdy / tdist, dt);
            if (this.aimT <= 0) this._throw(projectiles, player);
            return;
        }
        // b) Schnellfolge: zwei weitere Wuerfe ohne neues Ausholen
        if (this.burstLeft > 0) {
            this.burstT -= dt;
            if (Math.abs(tdx) > 3) this.face = tdx > 0 ? 1 : -1;
            this._look(tdx / tdist, tdy / tdist, dt);
            if (this.burstT <= 0) this._throw(projectiles, player);
            return;
        }

        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            if (dist > 200) {
                vx = dx / dist; vy = dy / dist; sp = this.speed;
            } else if (dist < 90) {
                vx = -dx / dist; vy = -dy / dist; sp = this.speed * 0.9;
            } else {
                this.strafeT -= dt;
                if (this.strafeT <= 0) {
                    this.strafe = -this.strafe;
                    this.strafeT = randRange(0.9, 2);
                }
                vx = (-dy / dist) * this.strafe; vy = (dx / dist) * this.strafe; sp = this.speed * 0.55;
            }
            this.shootT -= dt;
            if (this.shootT <= 0 && !player.dead) {
                this._pickTarget(player, world, mx, my);
                this.aimKind = this.nextKind;
                this.aimT = DWARF_WARN;
                return;
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

    // Ziel: die Haelfte der Wuefe geht auf einen wachen Freund mit freier Sicht, sonst auf Mark.
    _pickTarget(player, world, mx, my) {
        this.target = null;
        if (Math.random() < 0.5) {
            const opts = [];
            for (const c of DwarfArt.companions()) {
                const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
                if (Math.hypot(cx - mx, cy - my) > 330) continue;
                if (typeof Juri !== 'undefined' && typeof Juri.lineClear === 'function' &&
                    !Juri.lineClear(world, mx, my - 6, cx, cy)) continue;
                opts.push(c);
            }
            if (opts.length) this.target = opts[Math.floor(Math.random() * opts.length)];
        }
    }

    _throw(projectiles, player) {
        const tgt = (this.target && !this.target.dead && !(this.target.koTimer > 0)) ? this.target : player;
        const sx = this.centerX() + this.face * 8, sy = this.y + 2;
        const a = Math.atan2(tgt.y + tgt.h / 2 - sy, tgt.x + tgt.w / 2 - sx);
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (list && list.length < DWARF_CAP) {
            list.push(new DwarfTool(sx, sy, a, randRange(150, 172), this.nextKind));
            this.nextKind = (this.nextKind + 1) % 4;
        }
        this.castT = 0.22;
        DwarfArt.burst(sx, sy - 8, ['#ffffff', DWARF_TOOL_COLORS[this.aimKind]], 4, 70, 0.25, { kind: 'spark' });
        if (this.burstLeft > 0) {
            this.burstLeft--;
            this.burstT = 0.18;
            if (this.burstLeft === 0) this.shootT = randRange(2.4, 3.4);
        } else {
            this.shootT = randRange(2.2, 3.4);
            // Schluesseltraeger wirft immer drei, die anderen manchmal
            if (this.isKeyGhost || Math.random() < 0.3) {
                this.burstLeft = 2;
                this.burstT = 0.18;
            }
        }
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 13)) {
                ctx.translate(cx, by);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, by);
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 16 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Zwerg mit Fusspunkt (0, 0). Wirft das Werkzeug mit der vorderen Hand ueber den Kopf.
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const ch = dead ? 0 : this.charge;
        const walking = !dead && this.engaged && this.aimT <= 0 && this.burstLeft <= 0;
        const bob = walking ? Math.abs(Math.sin(t * 9 + sd)) * 1.6 : Math.sin(t * 2.6 + sd) * 0.8;
        const raise = ch > 0 ? 1 : (this.castT > 0 ? 0.55 : 0);
        // Schuhe
        DwarfArtBlobPair(ctx, walking ? Math.sin(t * 9 + sd) * 1.6 : 0);
        // Jacke mit guertel
        Art.body(ctx, 0, -11 - bob, 11.5, 9.5, DWARF_JACKET, { lineWidth: 1.3 });
        Art.box(ctx, -9.5, -7.5 - bob, 19, 2.6, 1.2, DWARF_BELT, { lineWidth: 1, highlight: false });
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(0, -12 - bob, 1.3, 0, TAU);
        ctx.arc(0, -16.5 - bob, 1.3, 0, TAU);
        ctx.fill();
        // hinterer Arm
        Art.limb(ctx, -f * 6, -15 - bob, -f * 10.5, -10 - bob, 3, DWARF_JACKET, { lineWidth: 1 });
        // Kopf
        Art.body(ctx, f * 0.6, -25 - bob, 8.2, 7.4, DWARF_SKIN, { lineWidth: 1.3 });
        // Rauschebart (wellig, bedeckt Mund und Brust)
        const sway = Math.sin(t * 2.2 + sd) * 0.7;
        Art.shape(ctx, c => {
            c.moveTo(-7.2 + f * 0.6, -24 - bob);
            c.quadraticCurveTo(-8.5 + f * 0.6, -15 - bob, -6 + sway, -7 - bob);
            c.quadraticCurveTo(-3, -4.5 - bob, 0 + sway, -6.5 - bob);
            c.quadraticCurveTo(3, -4.5 - bob, 6 + sway, -7 - bob);
            c.quadraticCurveTo(8.5 + f * 0.6, -15 - bob, 7.2 + f * 0.6, -24 - bob);
            c.quadraticCurveTo(0, -21 - bob, -7.2 + f * 0.6, -24 - bob);
            c.closePath();
        }, { x: -8.5, y: -24 - bob, w: 17, h: 20 }, DWARF_BEARD, { lineWidth: 1.2 });
        // Schnurrbartbauch und Knollennase
        Art.body(ctx, f * 1.6, -23.5 - bob, 5.4, 2.6, '#faf7f0', { lineWidth: 1, highlight: false });
        Art.body(ctx, f * 2.6, -24.5 - bob, 3.4, 3.1, Art.light(DWARF_SKIN, 0.12), { lineWidth: 1.1 });
        // Augen und Muetze
        if (dead) LateWorldArt.xEyes(ctx, f * 1.2, -27.5 - bob, 1.5, 3);
        else Art.eyes(ctx, f * 1.2, -27.5 - bob, 2.2, { gap: 3.2, look: this.look, angry: true, iris: '#2a6b3f', seed: sd });
        const tipX = f * 6 + Math.sin(t * 2.4 + sd) * 1.6, tipY = -46 - bob;
        Art.shape(ctx, c => {
            c.moveTo(-8 + f * 0.6, -29.5 - bob);
            c.quadraticCurveTo(-6 + f * 0.6, -38 - bob, tipX, tipY);
            c.quadraticCurveTo(7 + f * 0.6, -37 - bob, 8 + f * 0.6, -29.5 - bob);
            c.closePath();
        }, { x: -9, y: tipY, w: 18, h: -29.5 - tipY + 2 }, DWARF_HAT, { lineWidth: 1.3, glossy: true });
        Art.box(ctx, -8.6 + f * 0.6, -31 - bob, 17.2, 3, 1.5, '#faf7f0', { lineWidth: 1, highlight: false });
        // Werfearm: beim Ausholen hoch ueber den Kopf, nach dem Wurf vorgestreckt
        const hx = f * (8 + raise * 3) - (raise > 0.7 ? f * 2 : 0), hy = -16 - bob - raise * 18;
        Art.limb(ctx, f * 6, -15 - bob, hx, hy, 3, DWARF_JACKET, { lineWidth: 1 });
        Art.body(ctx, hx, hy, 2.2, 2.2, DWARF_SKIN, { lineWidth: 0.9, highlight: false });
        if (!dead && ch > 0) {
            Art.glow(ctx, hx, hy - 2, 6 + ch * 9, DWARF_TOOL_COLORS[this.aimKind], 0.35 + ch * 0.45);
            ctx.save();
            ctx.translate(hx, hy - 2);
            ctx.rotate(-Math.PI / 2 + f * 0.35 + ch * f * 0.4);
            DwarfArt.tool(ctx, this.aimKind, 0.7 + ch * 0.25);
            ctx.restore();
        }
    }
}

// Zwei braune Schuhe (kleiner Helfer, haelt _drawBody guenstig)
function DwarfArtBlobPair(ctx, step) {
    for (let s = -1; s <= 1; s += 2) {
        ctx.beginPath();
        ctx.ellipse(s * 5.4 + s * step, -2, 4, 2.4, 0, 0, TAU);
        ctx.fillStyle = DWARF_BOOT;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = Art.ink(DWARF_BOOT);
        ctx.stroke();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 36: Riesenzwerg ──
// ══════════════════════════════════════════

// Riesiger Gartenzwerg (Hitbox 64×64, 130 LP) mit Riesenhammer. Bleibt immer im Boss-Raum.
// Ablauf Phase 1: Schnaufen → Hammerschlag (Warnkreis 1 s → Schockwelle) → Schnaufen →
//   Werkzeugsturm (Warnlinien auf Mark und jeden Freund, dann Reihen auf ALLE) → …
// Phase 2 (halbe LP): Wutheulen, Muetze glueht, Augen rot, alles etwas schneller. Nach jedem
//   Hammerschlag fliegt zusaetzlich ein Werkzeugring mit Luecken in alle Richtungen (Vorwarn-
//   strahlen im Ausholen). Ab und zu ruft er bis zu vier Gartenzwerge in den Raum.
class BossGiantDwarf extends Enemy {
    constructor(x, y) {
        super(x, y, 64, 64);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 40;
        this.damage = 1;
        // Kein Beruehrungsschaden: gefaehrlich sind Hammer und Werkzeug. So kann man in der
        // Schnaufpause gefahrlos hauen.
        this.contactDamage = false;
        this.shadow = { rx: 34, ry: 10, dy: 26 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.face = -1;
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.state = 'intro';
        this.stateT = 1.8;
        this.stateDur = 1.8;
        this.seq = 0;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.waves = [];                   // laufende Schockwellen
        this.aim = [];                     // Werkzeugsturm-Ziele
        this.aiming = false;               // Warnlinien sichtbar
        this.locked = false;               // letzte 0,3 s stehen die Wurfziele fest
        this.ringAngles = [];              // Phase 2: Richtungen des Werkzeugrings (mit Luecken)
        this.summoned = [];                // gerufene Gartenzwerge
        this.summonT = 6;
        this._pz = {};
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Ein Riese mit Zwergengruetz lässt sich kaum wegschubsen.
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.15);
    }

    _room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world ||
            typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    // Hammerhand in Weltkoordinaten (Abwurfpunkt der Werkzeugreihen)
    _handPos() {
        return { x: this.centerX() + this.face * 26, y: this.y + this.h - 64 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        this._updateWaves(dt, player);
        if (this.dead) return;
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        // Sicher ist sicher: der Riese bleibt immer im Boss-Raum (die Engine klemmt zusaetzlich)
        const room = this._room(world);
        if (room) {
            this.x = clamp(this.x, room.x, Math.max(room.x, room.x + room.w - this.w));
            this.y = clamp(this.y, room.y, Math.max(room.y, room.y + room.h - this.h));
        }
        this.stateT -= dt;
        const p2 = this.phase === 2;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._toHover();
                break;
            case 'hover':
                this._moveAround(dt, world, px, py, 1);
                if (this.stateT <= 0) this._nextAttack(world, player);
                if (p2) this._summonTick(dt, world);
                break;
            case 'smashWind': {
                const dx = px - this.centerX();
                if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
                if (this.stateT <= 0) this._smash(world, projectiles);
                break;
            }
            case 'smash':
                if (this.stateT <= 0) this._set('pant', p2 ? 1.15 : 1.6);
                break;
            case 'stormAim': {
                this._aimStorm(world, player, this.stateT <= 0.3);
                const dx = px - this.centerX();
                if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
                if (this.stateT <= 0) {
                    this._stormThrow(projectiles);
                    this._set('pant', p2 ? 1.2 : 1.6);
                }
                break;
            }
            case 'pant':
                if (this.stateT <= 0) this._toHover();
                if (p2) this._summonTick(dt, world);
                break;
            case 'roar':
                if (this.stateT <= 0) {
                    this._summon(world, 2, player);
                    this._toHover();
                }
                break;
            default:            // recover
                if (this.stateT <= 0) this._toHover();
        }
        this._lookAt(dt, px, py);
    }

    _toHover() {
        this.aiming = false;
        this.locked = false;
        if (this.phase === 2 && !this.roared) {
            // Wut beim Wechsel in Phase 2: Muetze glueht auf, dann ruft er erste Helfer
            this.roared = true;
            this._set('roar', 1.0);
            const x = this.centerX(), y = this.y + this.h - 80;
            DwarfArt.shake(6, 0.45);
            DwarfArt.burst(x, y, [DWARF_HAT, '#ffffff', '#ff9f1c'], 18, 190, 0.6, { kind: 'star' });
            DwarfArt.ring(x, y + 40, DWARF_HAT, 100, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('hover', this.phase === 2 ? randRange(0.75, 1.05) : randRange(1.2, 1.6));
    }

    _nextAttack(world, player) {
        const n = this.seq++;
        if (n % 2 === 0) this._startSmash();
        else this._startStorm(world, player);
    }

    // ── a) Hammerschlag mit Schockwelle ──

    _startSmash() {
        this.aiming = false;
        this.locked = false;
        this.ringAngles = [];
        if (this.phase === 2) {
            // Werkzeugring mit Luecken vorbereiten: 16 Richtungen, zwei zufaellige Luecken
            const gaps = new Set();
            gaps.add(Math.floor(Math.random() * 16));
            gaps.add(Math.floor(Math.random() * 16));
            const off = Math.random() * TAU;
            for (let i = 0; i < 16; i++) {
                if (gaps.has(i) || gaps.has((i + 1) % 16)) continue;
                this.ringAngles.push(off + (TAU * i) / 16);
            }
        }
        // Ankündigung in Boss-Zeit (÷1,15 = echte Zeit): 1,2 → gut 1,0 s Warnkreis
        this._set('smashWind', this.phase === 2 ? 1.05 : 1.2);
    }

    _smash(world, projectiles) {
        this._set('smash', 0.3);
        const x = this.centerX(), y = this.centerY() + 6;
        this.waves.push({ x, y, r: 22, max: DWARF_WAVE_MAX, hitP: false, hitC: [] });
        DwarfArt.shake(this.phase === 2 ? 8 : 6.5, 0.35);
        DwarfArt.burst(x, y, [DWARF_BOOT, '#d8cfc0', '#ffffff'], 14, 170, 0.55, { kind: 'smoke', size: 6 });
        DwarfArt.burst(x, y, [DWARF_HAT, '#ffd23f', '#ffffff'], 8, 200, 0.45, { kind: 'star' });
        DwarfArt.ring(x, y, '#ffd0d0', 52, 0.3, 5);
        if (this.phase === 2) this._ringThrow(projectiles);
    }

    // Phase 2: Werkzeuge fliegen in alle Richtungen – in zwei Luecken ist kein Werkzeug (Ausweg).
    _ringThrow(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const x = this.centerX(), y = this.centerY() + 6;
        for (const a of this.ringAngles) {
            if (list.length >= DWARF_CAP) break;
            list.push(new DwarfTool(x, y, a, 140, Math.floor(Math.random() * 4)));
        }
    }

    // Die Welle rollt ueber den Boden. Wer im Band steht: 1 Schaden + kurz betaeubt.
    _updateWaves(dt, player) {
        if (!this.waves.length) return;
        const comps = typeof Game !== 'undefined' ? DwarfArt.companions() : [];
        for (const w of this.waves) {
            w.r += 205 * dt;
            const band = 14;
            if (!w.hitP && player && !player.dead && !(player.stunTimer > 0)) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                const d = Math.hypot(px - w.x, py - w.y);
                if (Math.abs(d - w.r) < band + player.w / 2 && !player.dodging) {
                    w.hitP = true;
                    DwarfArt.hurt(player, 1, Math.atan2(py - w.y, px - w.x), 140);
                    if (typeof player.stun === 'function') player.stun(DWARF_STUN);
                    DwarfArt.burst(px, py - 14, ['#ffe35a', '#ffffff'], 8, 90, 0.5, { kind: 'star' });
                }
            }
            for (const c of comps) {
                if (c.dead || typeof c.stun !== 'function' || c.stunTimer > 0) continue;
                if (w.hitC.includes(c)) continue;
                const cw = c.w || 20, ch2 = c.h || 20;
                const d = Math.hypot(c.x + cw / 2 - w.x, c.y + ch2 / 2 - w.y);
                if (Math.abs(d - w.r) < band + cw / 2) {
                    w.hitC.push(c);
                    c.stun(DWARF_STUN);
                    DwarfArt.burst(c.x + cw / 2, c.y, ['#ffe35a', '#ffffff'], 6, 80, 0.45, { kind: 'star' });
                }
            }
        }
        for (let i = this.waves.length - 1; i >= 0; i--) {
            if (this.waves[i].r >= this.waves[i].max) this.waves.splice(i, 1);
        }
    }

    // ── b) Werkzeugsturm auf das ganze Team ──

    _startStorm(world, player) {
        this.aiming = true;
        this.locked = false;
        this.aim = [{ tg: player }];
        for (const c of DwarfArt.companions()) {
            if (this.aim.length >= 3) break;
            this.aim.push({ tg: c });
        }
        this._aimStorm(world, player, false);
        this._set('stormAim', this.phase === 2 ? 1.0 : 1.15);
    }

    // Warnbahnen zu Mark und jedem Freund; die letzten 0,3 s stehen alle Ziele fest.
    _aimStorm(world, player, locked) {
        if (this.locked) return;
        if (locked) this.locked = true;
        const h = this._handPos();
        const room = this._room(world);
        for (const A of this.aim) {
            let tg = A.tg;
            if (!tg || tg.dead || tg.hp <= 0 || tg !== player && (tg.koTimer > 0)) {
                tg = A.tg = player;
            }
            const tx = tg.x + tg.w / 2, ty = tg.y + tg.h / 2;
            const a = Math.atan2(ty - h.y, tx - h.x);
            const d = clamp(Math.hypot(tx - h.x, ty - h.y) + 34, 80, 340);
            let ex = h.x + Math.cos(a) * d, ey = h.y + Math.sin(a) * d;
            if (room) {
                ex = clamp(ex, room.x + 12, room.x + room.w - 12);
                ey = clamp(ey, room.y + 12, room.y + room.h - 12);
            }
            A.x = ex;
            A.y = ey;
            A.a = Math.atan2(ey - h.y, ex - h.x);
        }
    }

    // Je Ziel eine Reihe Werkzeug: drei Stueck mit unterschiedlichem Tempo hintereinanderher.
    _stormThrow(projectiles) {
        this.aiming = false;
        this.locked = false;
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const h = this._handPos();
        const speeds = [135, 175, 215];
        for (const A of this.aim) {
            for (let i = 0; i < 3; i++) {
                if (list.length >= DWARF_CAP) break;
                list.push(new DwarfTool(h.x, h.y, A.a, speeds[i], Math.floor(Math.random() * 4)));
            }
        }
        DwarfArt.burst(h.x, h.y, [DWARF_TOOL_COLORS[1], '#ffffff'], 10, 160, 0.35, { kind: 'spark' });
        DwarfArt.shake(3, 0.2);
    }

    // ── c) Helfer rufen (nur Phase 2, nur im Raum, hochstens 4 gleichzeitig) ──

    _aliveSummoned() {
        let n = 0;
        for (const k of this.summoned) if (!k.dead) n++;
        return n;
    }

    _summonTick(dt, world) {
        this.summonT -= dt;
        if (this.summonT > 0) return;
        this.summonT = 7;
        if (this._aliveSummoned() < 4 && this.state === 'hover') this._summon(world, 1, null);
    }

    _summon(world, want, player) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world ||
            !Game._bossRoomRect || !Game.enemies) return;
        const room = Game._bossRoomRect();
        want = Math.min(4 - this._aliveSummoned(), want);
        if (want <= 0) return;
        const px = player ? player.x + player.w / 2 : this.centerX();
        const py = player ? player.y + player.h / 2 : this.centerY();
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 24 + Math.random() * (room.w - 48);
                const y = room.y + 24 + Math.random() * (room.h - 48);
                if (Math.hypot(x - px, y - py) < 90 || Math.hypot(x - this.centerX(), y - this.centerY()) < 60) continue;
                if (world.isWall(x - 13, y - 13) || world.isWall(x + 13, y - 13) ||
                    world.isWall(x - 13, y + 13) || world.isWall(x + 13, y + 13)) continue;
                const kid = new GardenDwarf(x, y);
                kid.summoner = this;
                kid.engaged = true;
                kid.shootT = randRange(1.0, 2.0);
                Game.enemies.push(kid);
                this.summoned.push(kid);
                DwarfArt.burst(x, y, [DWARF_HAT, '#ffffff', DWARF_JACKET], 12, 120, 0.5, { kind: 'star' });
                DwarfArt.ring(x, y + 8, DWARF_HAT, 26, 0.4, 3);
                break;
            }
        }
        if (this.summoned.length > 8) this.summoned = this.summoned.filter(k => !k.dead);
    }

    // ── Bewegung und Blick ──

    _moveAround(dt, world, px, py, k) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        let vx, vy, sp = this.speed * k;
        if (d > 170) {
            vx = dx / d; vy = dy / d;
        } else if (d < 90) {
            vx = -dx / d; vy = -dy / d;
        } else {
            vx = (-dy / d) * this.strafe; vy = (dx / d) * this.strafe; sp *= 0.7;
        }
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
        if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) this.strafe = -this.strafe;
        if (Math.abs(dx) > 14) this.face = dx > 0 ? 1 : -1;
    }

    _lookAt(dt, px, py) {
        let tx = px, ty = py;
        if (this.aiming && this.aim.length) {
            tx = this.aim.reduce((s, A) => s + A.x, 0) / this.aim.length;
            ty = this.aim.reduce((s, A) => s + A.y, 0) / this.aim.length;
        }
        const dx = tx - this.centerX(), dy = ty - (this.y + this.h - 80);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    // ── Zeichnen ──

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, by - 55);
            ctx.translate(cx, by);
            this._drawDwarf(ctx, true);
        } else {
            ctx.translate(cx, by);
            this._drawDwarf(ctx, false);
        }
        ctx.restore();
    }

    // Haltung aus dem Zustand (nur Darstellung)
    _pose(p, dead) {
        const st = dead ? 'dead' : this.state, t = Art.time, f = this.face;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const p2 = this.phase === 2;
        p.hv = Math.sin(t * (p2 ? 2.6 : 2) + this.seed) * 2;
        p.tilt = 0;
        p.mouth = 'angry';
        p.hot = p2 ? 0.8 : 0.1;
        p.hatGlow = p2 ? 1 : 0;
        // Grundhaltung: Hammer rechts nach unten-außen
        p.hx = f * 26; p.hy = -46; p.ha = f > 0 ? 0.9 : Math.PI - 0.9;
        if (st === 'intro') {
            p.hx = f * 20; p.hy = -84; p.ha = f > 0 ? -0.5 : Math.PI + 0.5;
            p.mouth = 'teeth';
        } else if (st === 'smashWind') {
            // hebt den Hammer hoch ueber den Kopf, lehnt sich zurueck
            const e = Math.min(1, k * 1.8);
            p.hx = -f * 6; p.hy = -118 - e * 16; p.ha = -Math.PI / 2 - f * 0.25;
            p.tilt = -f * 0.06 * e;
            p.hv += e * 4;
            p.hot = Math.max(p.hot, 0.3 + 0.7 * k);
            p.mouth = 'teeth';
        } else if (st === 'smash') {
            // Hammer schlaegt vorn auf den Boden
            p.hx = f * 34; p.hy = -12; p.ha = f > 0 ? 1.35 : Math.PI - 1.35;
            p.tilt = f * 0.1;
            p.mouth = 'open';
        } else if (st === 'stormAim') {
            // Hammer auf der Schulter, die freie Hand zeigt auf die Ziele
            p.hx = -f * 22; p.hy = -92; p.ha = f > 0 ? Math.PI - 0.5 : 0.5;
            p.pointing = true;
            p.hot = Math.max(p.hot, 0.25 + 0.5 * k);
            p.mouth = 'teeth';
        } else if (st === 'pant') {
            // Schnaufen: Haende auf dem Stiel, Hammer steht am Boden – Zeit zum Zurueckhauen
            p.hx = f * 30; p.hy = -20; p.ha = f > 0 ? 1.5 : Math.PI - 1.5;
            p.hv += 3 + Math.sin(t * 8) * 1.2;
            p.mouth = 'o';
        } else if (st === 'roar') {
            const e = Math.sin(k * Math.PI);
            p.hx = -f * 10; p.hy = -124; p.ha = -Math.PI / 2 + f * 0.4;
            p.hot = 1;
            p.hatGlow = 1;
            p.mouth = 'open';
        } else if (st === 'dead') {
            p.hx = f * 30; p.hy = -10; p.ha = f > 0 ? 1.55 : Math.PI - 1.55;
            p.mouth = 'o';
        } else {
            p.pointing = false;
        }
        if (st !== 'stormAim') p.pointing = false;
        return p;
    }

    _drawDwarf(ctx, dead) {
        const p = this._pose(this._pz, dead);
        const t = Art.time, f = this.face, p2 = this.phase === 2;
        ctx.save();
        ctx.translate(0, p.hv);
        if (p.tilt) {
            ctx.translate(0, -50);
            ctx.rotate(p.tilt);
            ctx.translate(0, 50);
        }
        if (p2 && !dead) Art.glow(ctx, 0, -70, 78, '#ff5a3c', 0.16 + 0.07 * Math.sin(t * 4));
        // Beine und Stiefel
        for (let s = -1; s <= 1; s += 2) {
            Art.limb(ctx, s * 12, -30, s * 15, -8, 9, '#4a5f8a', { lineWidth: 1.8 });
            ctx.beginPath();
            ctx.ellipse(s * 16, -4, 10, 5.5, 0, 0, TAU);
            ctx.fillStyle = DWARF_BOOT;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = Art.ink(DWARF_BOOT);
            ctx.stroke();
        }
        // Hammer hinter dem Koerper hochhalten? (Ausholen/Bruellen: hinter dem Kopf)
        const hammerBack = this.state === 'smashWind' || this.state === 'roar' || dead ? false : this.state === 'stormAim';
        if (hammerBack) this._drawArmHammer(ctx, p);
        // blauer Rock/Jacke mit Guertel
        Art.shape(ctx, c => {
            c.moveTo(-24, -66);
            c.lineTo(24, -66);
            c.quadraticCurveTo(30, -40, 30, -18);
            c.quadraticCurveTo(20, -12, 12, -16);
            c.quadraticCurveTo(0, -10, -12, -16);
            c.quadraticCurveTo(-20, -12, -30, -18);
            c.quadraticCurveTo(-30, -40, -24, -66);
            c.closePath();
        }, { x: -30, y: -66, w: 60, h: 56 }, DWARF_JACKET, { lineWidth: 2.2, glossy: true });
        Art.box(ctx, -25, -30, 50, 7, 3, DWARF_BELT, { lineWidth: 1.6, highlight: false });
        Art.box(ctx, -6, -32.5, 12, 12, 3, '#ffd23f', { lineWidth: 1.6, outline: '#8a5200' });
        if (p2 && !dead) {
            // Risse in der Jacke (Phase 2)
            ctx.strokeStyle = '#1f3e6e';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-16, -52);
            ctx.lineTo(-12, -44);
            ctx.lineTo(-15, -38);
            ctx.moveTo(14, -34);
            ctx.lineTo(10, -28);
            ctx.stroke();
        }
        // Kopf
        const hx = f * 2, hy = -80;
        Art.body(ctx, hx, hy, 16, 14, DWARF_SKIN, { lineWidth: 2 });
        // weisser Rauschebart
        const sway = Math.sin(t * 2 + this.seed) * 1.6;
        Art.shape(ctx, c => {
            c.moveTo(hx - 14, hy + 2);
            c.quadraticCurveTo(hx - 17, hy + 20, hx - 11 + sway, hy + 34);
            c.quadraticCurveTo(hx - 5, hy + 40, hx + sway, hy + 35);
            c.quadraticCurveTo(hx + 5, hy + 40, hx + 11 + sway, hy + 34);
            c.quadraticCurveTo(hx + 17, hy + 20, hx + 14, hy + 2);
            c.quadraticCurveTo(hx, hy + 10, hx - 14, hy + 2);
            c.closePath();
        }, { x: hx - 17, y: hy + 2, w: 34, h: 38 }, DWARF_BEARD, { lineWidth: 1.8 });
        // Schnurrbart und Knollennase
        Art.body(ctx, hx + f * 3, hy + 4, 9, 4, '#faf7f0', { lineWidth: 1.4, highlight: false });
        Art.body(ctx, hx + f * 5, hy - 1, 6, 5.4, Art.light(DWARF_SKIN, 0.14), { lineWidth: 1.6 });
        // Augen (Phase 2 rot) und weisse Buschbrauen
        if (dead) LateWorldArt.xEyes(ctx, hx + f * 2, hy - 5, 2.6, 5.5);
        else {
            Art.eyes(ctx, hx + f * 2, hy - 5, 3.8, { gap: 5.5, look: this.look, angry: true, iris: p2 ? '#ff2d3a' : '#2a6b3f', seed: this.seed });
            ctx.strokeStyle = '#faf7f0';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(hx + f * 2 - 8, hy - 11.5);
            ctx.lineTo(hx + f * 2 - 2, hy - 9.5);
            ctx.moveTo(hx + f * 2 + 2, hy - 9.5);
            ctx.lineTo(hx + f * 2 + 8, hy - 11.5);
            ctx.stroke();
        }
        Art.mouth(ctx, hx + f * 2, hy + 11, 8, p.mouth);
        // rote Zipfelmuetze (Phase 2: Gluehen und Funken ueber der Spitze)
        const tipX = hx + f * 14 + Math.sin(t * 2 + this.seed) * 2.5, tipY = hy - 40;
        if (p.hatGlow && !dead) Art.glow(ctx, hx + f * 6, hy - 22, 30, '#ff5a3c', 0.4 + 0.25 * Math.sin(t * 6));
        Art.shape(ctx, c => {
            c.moveTo(hx - 15, hy - 10);
            c.quadraticCurveTo(hx - 10, hy - 26, tipX, tipY);
            c.quadraticCurveTo(hx + 12, hy - 24, hx + 15, hy - 10);
            c.closePath();
        }, { x: hx - 15, y: tipY, w: 32, h: 32 }, p.hatGlow && p2 ? '#f04a3a' : DWARF_HAT, { lineWidth: 2.2, glossy: true });
        Art.box(ctx, hx - 16, hy - 13, 32, 6, 3, '#faf7f0', { lineWidth: 1.6, highlight: false });
        if (p.hatGlow && !dead) {
            Art.sparkle(ctx, tipX + 3, tipY - 3, 3 + Math.sin(t * 7) * 1.2, '#ffd23f', 0.6 + 0.4 * Math.sin(t * 9));
            Art.sparkle(ctx, hx - 12, hy - 24, 2.4, '#ff9f1c', 0.5 + 0.5 * Math.sin(t * 6 + 2));
        }
        // freie Hand zeigt beim Sturm-Zielen zu den Zielen
        if (p.pointing && !dead) {
            const sx = -f * 16, sy = -64;
            Art.limb(ctx, sx, sy, sx - f * 8, sy - 8, 6.5, DWARF_JACKET, { lineWidth: 1.8 });
            Art.body(ctx, sx - f * 8, sy - 8, 5, 5, DWARF_SKIN, { lineWidth: 1.4 });
        }
        // Hammer vorn am Koerper
        if (!hammerBack) this._drawArmHammer(ctx, p);
        if (!dead && this.state === 'pant') LateWorldArt.dizzy(ctx, hx + f * 4, hy - 30, 14, 2.6);
        ctx.restore();
    }

    // Arm + Hammer (Hammerstiel greift die Hand an p.hx/p.hy, Hammerwinkel p.ha)
    _drawArmHammer(ctx, p) {
        const f = this.face;
        Art.limb(ctx, f * 14, -60, p.hx, p.hy, 7.5, DWARF_JACKET, { lineWidth: 2 });
        ctx.save();
        ctx.translate(p.hx, p.hy);
        ctx.rotate(p.ha);
        DwarfArt.hammer(ctx, 52, p.hot, 2);
        ctx.restore();
        Art.body(ctx, p.hx, p.hy, 5.5, 5.5, DWARF_SKIN, { lineWidth: 1.6 });
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        // Schockwellen (auch nach dem Tod noch zu Ende laufen lassen)
        for (const w of this.waves) {
            const s = camera.worldToScreen(w.x, w.y + 8);
            const a0 = ctx.globalAlpha;
            ctx.globalAlpha = a0 * 0.75;
            Art.ring(ctx, s.x, s.y, w.r, '#ff5a3c', 9, 0.4);
            Art.ring(ctx, s.x, s.y, w.r, '#ffd23f', 3, 0.85);
            ctx.globalAlpha = a0;
        }
        if (this.dead) return;
        const c = camera.worldToScreen(this.centerX(), this.centerY() + 8);
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        if (this.state === 'smashWind') {
            LateWorldArt.warn(ctx, c.x, c.y, DWARF_SMASH_R, k);
            if (this.phase === 2 && this.ringAngles.length) {
                // Vorwarnung des Werkzeugrings: Strahlen in alle Flugrichtungen (Luecken sieht man)
                const prev = ctx.globalAlpha;
                ctx.strokeStyle = '#ff9f1c';
                ctx.lineCap = 'round';
                ctx.lineWidth = 3.2;
                ctx.globalAlpha = prev * (0.3 + 0.3 * Math.abs(Math.sin(Art.time * 10)));
                ctx.beginPath();
                for (const a of this.ringAngles) {
                    ctx.moveTo(c.x + Math.cos(a) * 30, c.y + Math.sin(a) * 30);
                    ctx.lineTo(c.x + Math.cos(a) * 150, c.y + Math.sin(a) * 150);
                }
                ctx.stroke();
                ctx.globalAlpha = prev;
            }
        } else if (this.state === 'smash') {
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.14;
            ctx.fillStyle = '#ff3d5a';
            ctx.beginPath();
            ctx.arc(c.x, c.y, DWARF_SMASH_R, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = prev;
            Art.ring(ctx, c.x, c.y, DWARF_SMASH_R, '#ff3d5a', 2.4, 0.6);
        }
        if (this.aiming && this.aim.length) {
            const h = this._handPos();
            const hs = camera.worldToScreen(h.x, h.y);
            const lk = k;
            ctx.save();
            for (const A of this.aim) {
                const len = Math.hypot(A.x - h.x, A.y - h.y);
                LateWorldArt.lane(ctx, hs.x, hs.y, A.a, len, 26, lk, this.locked ? '#ff3d5a' : '#ff7a3d');
                // Pfeil ueber dem Ziel (Mark oder ein Freund)
                const tg = A.tg;
                if (tg && !tg.dead && !(tg.koTimer > 0)) {
                    const ap = camera.worldToScreen(tg.x + tg.w / 2, tg.y - 14 + Math.sin(Art.time * 9) * 2.5);
                    const prev = ctx.globalAlpha;
                    ctx.globalAlpha = prev * 0.95;
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
                    ctx.globalAlpha = prev;
                }
            }
            ctx.restore();
        }
    }
}
