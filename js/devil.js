// ── Welt 32: Teufelsschlucht ── (Idee von Leander)
// Schattenteufel (ShadowDevil): kleiner, fast schwarzer violetter Teufel mit Hörnchen, rot glühenden
//   Augen und Schwänzchen mit Pfeilspitze. Hält Abstand, zielt 0,6 s (rote Warnlinie über drawUnder) und
//   wirft dann einen Speer auf Mark ODER einen seiner Freunde (Juri/Krokodil). Der Speer trifft auch die
//   Freunde und betäubt sie kurz; ein Exemplar trägt den Schlüssel (LateWorldArt.keyBadge). Danach hält er
//   kurz einen frischen Speer in der Hand.
// Vier-Arm-Teufel (BossFourArmDevil): großer Teufel mit vier Armen (zwei je Seite), in jeder Hand ein
//   Speer. Bleibt immer im Boss-Raum. Angriffe (alle vorher angekündigt):
//     1) Speerhagel: alle vier Speere gleichzeitig auf Mark und die Freunde (Warnlinien), sie kehren wie
//        beim Schwert-Engel als Bumerang zurück. In Phase 2 zweimal hintereinander.
//     2) Drehattacke: hebt die Speere (Warnkreis), dreht sich mit ausgestreckten Speeren und rutscht auf
//        Mark zu; danach schwindelig (Zeit zum Zurückhauen).
//     3) Speerstoß in den Boden: hebt alle vier Speere (1 s Warnkreis), rammt sie in den Boden → Schockwelle.
//        Wer getroffen wird, steht 2,5 s fest (player.stun / c.stun). Ausweichen schützt. Kommt erst wieder,
//        wenn Mark wieder frei ist (+1,5 s).
//   Phase 2 (halbe LP): Flammenaura, schneller, Speerhagel zweimal, ruft bis zu vier kleine Schattenteufel
//   in den Boss-Raum (höchstens 4 gleichzeitig, verpuffen, wenn er besiegt ist).

// Heller als zuerst (#241038/#4a2570): auf dem dunkelroten Boden der Teufelsschlucht gingen die Teufel unter
const DEVIL_BODY = '#40206a';        // dunkles Violett
const DEVIL_SHADE = '#7a46b4';       // Schattenschimmer (Brust/Bauch)
const DEVIL_HORN = '#efe0c2', DEVIL_HORN_INK = '#7a5a2a';
const DEVIL_EYE = '#ff3350';         // rot glühende Augen
const DEVIL_TAIL = '#ff3350';
const DEVIL_SHAFT = '#6b4a2a', DEVIL_TIP = '#c7cede';
const DEVIL_FIRE = '#ff7a1f', DEVIL_FIRE2 = '#ffd23f';
// Der Boss wird 1,5-fach gezeichnet (vorher nur ~80 hoch, kleiner als die anderen Bosse); Trefferzonen bleiben.
const BOSS_DEVIL_DRAW_SCALE = 1.5;
const DEVIL_WARN = 0.6;              // Ziel-Ankündigung des Schattenteufels (Sekunden)
const DEVIL_LOCK = 0.16;             // die letzten so vielen Sekunden steht die Wurfrichtung fest

const DevilArt = {
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

    // Wache, treffbare Begleiter (Juri, Krokodil; die Schlange auf Marks Schulter hat kein knockOut)
    companions() {
        const out = [];
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Begleiter treffen: nie verschwinden lassen – ein tödlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(8);
        else c.takeDamage(amount);
        this.burst(c.x + c.w / 2, c.y + c.h / 2, [DEVIL_TIP, DEVIL_FIRE], 9, 130, 0.4, { kind: 'spark' });
    },

    // Speer entlang +x, Griff am Ursprung, Klinge reicht bis +L. glow 0..1 = Glühen der Spitze.
    spear(ctx, L, glow) {
        const hw = Math.max(1.5, L * 0.05);
        if (glow > 0) Art.glow(ctx, L, 0, L * 0.36, DEVIL_FIRE, 0.4 + 0.4 * glow);
        Art.limb(ctx, -L * 0.2, 0, L * 0.74, 0, hw, DEVIL_SHAFT, { lineWidth: 1 });
        // Wickel am Schaft
        ctx.strokeStyle = Art.dark(DEVIL_SHAFT, 0.3);
        ctx.lineWidth = Math.max(0.6, hw * 0.5);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const x = L * (0.3 + i * 0.13);
            ctx.moveTo(x, -hw * 0.9);
            ctx.lineTo(x + hw, hw * 0.9);
        }
        ctx.stroke();
        // Stahlspitze (Pfeil)
        Art.shape(ctx, c => {
            c.moveTo(L * 0.72, -hw * 1.7);
            c.lineTo(L, 0);
            c.lineTo(L * 0.72, hw * 1.7);
            c.closePath();
        }, { x: L * 0.72, y: -hw * 1.7, w: L * 0.28, h: hw * 3.4 }, DEVIL_TIP, { lineWidth: 1, glossy: true });
        if (glow > 0.3) Art.sparkle(ctx, L, 0, 2 + glow * 2, DEVIL_FIRE2, 0.5 + 0.5 * Math.sin(Art.time * 10));
    },

    // Paar gekrümmte Hörner am Kopf (y nach oben negativ), Größe s
    horns(ctx, s, ink) {
        for (let side = -1; side <= 1; side += 2) {
            Art.shape(ctx, c => {
                c.moveTo(side * 3.4 * s, 0);
                c.quadraticCurveTo(side * 6.4 * s, -5 * s, side * 4.6 * s, -8.6 * s);
                c.quadraticCurveTo(side * 4.2 * s, -4 * s, side * 1.2 * s, -1 * s);
                c.closePath();
            }, { x: side > 0 ? 1.2 * s : -6.4 * s, y: -8.6 * s, w: 5.2 * s, h: 8.6 * s }, DEVIL_HORN, { lineWidth: 1, outline: ink || DEVIL_HORN_INK });
        }
    },

    // Geschwungener Teufelsschwanz mit Pfeilspitze; Basis (bx,by), wedelt mit w (-1..1)
    tail(ctx, bx, by, s, w) {
        const tx = bx - 10 * s, ty = by - 4 * s + w * 3;
        Art.limb(ctx, bx, by, tx - 3 * s, ty - 4 * s, 2.4 * s, DEVIL_SHADE, { lineWidth: 1 });
        Art.shape(ctx, c => {
            c.moveTo(tx - 6 * s, ty - 3 * s);
            c.lineTo(tx - 1 * s, ty - 7 * s);
            c.lineTo(tx + 1 * s, ty - 1 * s);
            c.closePath();
        }, { x: tx - 6 * s, y: ty - 7 * s, w: 7 * s, h: 6 * s }, DEVIL_TAIL, { lineWidth: 1 });
    },
};

// ══════════════════════════════════════════
// ── Speer des Schattenteufels (Geschoß) ──
// ══════════════════════════════════════════

// Fliegender Speer: dreht sich nicht (spitze voraus), rotes Glühen + kurzer Schweif. Trifft auch die
// Freunde (hitsCompanions) und betäubt sie kurz. Besitzt 'enemy' → die Engine prüft Marks Treffer selbst.
class DevilSpear extends Projectile {
    constructor(x, y, angle) {
        super(x, y, Math.cos(angle) * 168, Math.sin(angle) * 168, 1, 'enemy', 90);
        this.radius = 5;
        this.lifetime = 2.4;
        this.hitsCompanions = true;
        this.stunTime = 1.5;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.4;
        ctx.strokeStyle = DEVIL_FIRE;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - dx * 16, p.y - dy * 16);
        ctx.stroke();
        ctx.globalAlpha = prev;
        Art.glow(ctx, p.x, p.y, 12, DEVIL_FIRE, 0.6);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(dy, dx));
        DevilArt.spear(ctx, 15, 0.5);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Schattenteufel (normaler Gegner) ──
// ══════════════════════════════════════════

// Kleiner Schatten-Teufel. Hält 96-158 Einheiten Abstand, zielt 0,6 s auf Mark oder einen Freund
// (Warnlinie), wirft dann einen Speer, lädt kurz nach. Schlüsselträger trägt den Schlüssel und ist zäher.
class ShadowDevil extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(52, 62);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;   // Schlüsselträger darf nicht in der Wand landen
        this.flying = false;
        this.fxColor = DEVIL_SHADE;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.detectionRange = 250;
        this.engaged = false;
        this.shootT = randRange(1.6, 3);
        this.aiming = false;
        this.aimT = 0;
        this.aimA = 0;
        this.aimLen = 0;
        this.target = null;
        this.reloadT = 0;                  // >0: greift nach neuem Speer (leere Hand)
        this.charge = 0;                   // 0..1 Ankündigung (nur Anzeige)
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
            this._keyInit = true;          // Schlüsselträger (Flag setzt main.js): etwas zäher
            this.hp = this.maxHp = 9;
        }
        if (this.reloadT > 0) this.reloadT -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 80) this.engaged = false;

        // Zielen: steht still, Speer senkt sich Richtung Ziel, Warnlinie am Boden (0,6 s)
        this.charge = 0;
        if (this.aiming) {
            this.aimT -= dt;
            const tg = this.target;
            if (!tg || tg.dead || tg.koTimer > 0 || !this.engaged) {
                this.aiming = false;
                this.shootT = randRange(0.5, 1.1);
            } else {
                const tx = tg.x + tg.w / 2, ty = tg.y + tg.h / 2;
                const ax = tx - mx, ay = ty - my;
                this.charge = clamp(1 - this.aimT / DEVIL_WARN, 0, 1);
                if (this.aimT > DEVIL_LOCK) {
                    this.aimA = Math.atan2(ay, ax);
                    this.aimLen = clamp(Math.hypot(ax, ay) + 20, 40, 300);
                }
                if (Math.abs(ax) > 3) this.face = ax > 0 ? 1 : -1;
                this._look(Math.cos(this.aimA), Math.sin(this.aimA), dt);
                if (this.aimT <= 0) {
                    this._fire(tx, ty, projectiles);
                    this.aiming = false;
                    this.shootT = randRange(2.0, 3.2);
                }
                return;
            }
        }

        if (this.engaged) {
            this.shootT -= dt;
            if (this.shootT <= 0 && this.reloadT <= 0) {
                const tg = this._pickTarget(world, player, mx, my);
                if (tg) {
                    this.target = tg;
                    this.aiming = true;
                    this.aimT = DEVIL_WARN;
                    const tx = tg.x + tg.w / 2, ty = tg.y + tg.h / 2;
                    this.aimA = Math.atan2(ty - my, tx - mx);
                    this.aimLen = clamp(Math.hypot(tx - mx, ty - my) + 20, 40, 300);
                    return;
                }
                this.shootT = 0.4;         // kein freies Ziel: kurz warten
            }
        }

        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            if (dist > 158) { vx = dx / dist; vy = dy / dist; sp = this.speed; }
            else if (dist < 96) { vx = -dx / dist; vy = -dy / dist; sp = this.speed * 0.9; }
            else {
                this.strafeT -= dt;
                if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = randRange(0.9, 2); }
                vx = (-dy / dist) * this.strafe; vy = (dx / dist) * this.strafe; sp = this.speed * 0.6;
            }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.4, 3);
                const a = Math.random() * TAU;
                this.wx = Math.cos(a); this.wy = Math.sin(a);
            }
            vx = this.wx; vy = this.wy; sp = this.speed * 0.34;
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

    // Ziel: Mark oder ein Freund mit freier Sicht (nicht der Riese in Reichweite)
    _pickTarget(world, player, mx, my) {
        const opts = [];
        if (!player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (typeof Juri === 'undefined' || Juri.lineClear(world, mx, my, px, py)) opts.push(player);
        }
        for (const c of DevilArt.companions()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - mx, cy - my) > 300) continue;
            if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my, cx, cy)) continue;
            opts.push(c);
        }
        if (!opts.length) return null;
        return opts[Math.floor(Math.random() * opts.length)];
    }

    _fire(tx, ty, projectiles) {
        const sx = this.centerX() + this.face * 10, sy = this.centerY() - 2;
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (list) list.push(new DevilSpear(sx, sy, Math.atan2(ty - sy, tx - sx)));
        this.reloadT = 0.55;               // Speer geflogen → kurz leer, neuer Speer kommt
        DevilArt.burst(sx, sy, [DEVIL_TIP, DEVIL_FIRE], 5, 90, 0.3, { kind: 'spark' });
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    // Rote Warnlinie zum Ziel, während er anlegt
    drawUnder(ctx, camera) {
        if (this.dead || !this.aiming) return;
        const p = camera.worldToScreen(this.centerX() + this.face * 10, this.centerY() - 2);
        const k = clamp(1 - this.aimT / DEVIL_WARN, 0, 1);
        LateWorldArt.lane(ctx, p.x, p.y, this.aimA, this.aimLen, 14, k, this.aimT <= DEVIL_LOCK ? '#ff3d5a' : '#ff7a3d');
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
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 16 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Schattenteufel mit Fußpunkt (0, 0)
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const ch = dead ? 0 : this.charge;
        const idle = Math.sin(t * 3 + sd) * 1.4;
        const squash = 1 + Math.sin(t * 6 + sd) * 0.03;
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -16 + idle, 20, DEVIL_EYE, 0.22 + 0.08 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(0, idle - 12);
        ctx.scale(squash, 2 - squash);
        // Schwänzchen hinter dem Körper
        DevilArt.tail(ctx, -f * 6, 4, 1, Math.sin(t * 4 + sd));
        // Körper (eilinig, Kopf geht in den Rumpf über)
        Art.body(ctx, 0, -6, 10, 11, DEVIL_BODY, { lineWidth: 1.3 });
        Art.body(ctx, f * 1.2, -3, 6, 7, DEVIL_SHADE, { lineWidth: 1, highlight: false, flat: true });
        // Hörnchen
        DevilArt.horns(ctx, 1.15, DEVIL_HORN_INK);
        // Gesicht: rot glühende Augen
        if (dead) LateWorldArt.xEyes(ctx, f * 1.4, -8, 1.7, 3.1);
        else {
            Art.eyes(ctx, f * 1.4, -8, 2.6, { gap: 3.2, look: this.look, angry: true, iris: DEVIL_EYE, seed: sd });
            Art.glow(ctx, f * 1.4, -8, 6, DEVIL_EYE, 0.28 + 0.12 * Math.sin(t * 5 + sd));
        }
        Art.mouth(ctx, f * 1.4, -3.4, 4.4, dead ? 'o' : (ch > 0.3 ? 'grin' : 'angry'));
        // Freier Arm (Schwanzseite)
        Art.limb(ctx, -f * 4, -7, -f * 9, -2, 2.4, DEVIL_BODY, { lineWidth: 1 });
        ctx.restore();
        // Speerarm vorn (unabhaengig vom Wippen des Körpers)
        const has = this.reloadT <= 0 && !dead;
        const raise = ch > 0 ? 1 : 0;
        const hx = f * (9 + raise * 2), hy = -12 - raise * 6 + idle;
        Art.limb(ctx, f * 3, -14 + idle, hx, hy, 2.4, DEVIL_BODY, { lineWidth: 1 });
        if (has) {
            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(this.aiming ? this.aimA : (f > 0 ? -0.5 : Math.PI + 0.5));
            DevilArt.spear(ctx, 16, ch);
            ctx.restore();
        } else {
            Art.body(ctx, hx, hy, 2, 2, DEVIL_SHADE, { lineWidth: 0.9, highlight: false });
        }
    }
}

// ══════════════════════════════════════════
// ── Kleiner Schattenteufel (vom Boss gerufener Helfer) ──
// ══════════════════════════════════════════

// Winziger handlicher Schattenteufel. Bleibt im Boss-Raum, läuft auf Mark zu und rempelt ihn an.
// Verpufft, wenn der Vier-Arm-Teufel besiegt ist (Muster WitchKid).
class DevilImp extends Enemy {
    constructor(x, y) {
        super(x, y, 18, 18);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = randRange(66, 78);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = DEVIL_SHADE;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.t = Math.random() * 10;
        this.hopT = Math.random() * 2;
        this.summoner = null;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.summoner) {
            if (this.summoner.dead) {                 // verpufft mit dem Boss
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                DevilArt.burst(this.centerX(), this.centerY(), [DEVIL_FIRE, '#ffffff'], 8, 90, 0.4, { kind: 'star' });
                return;
            }
            const room = typeof Game !== 'undefined' && Game.bossActive && Game._bossRoomRect ? Game._bossRoomRect() : null;
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }
        this.t += dt;
        this.hopT += dt;
        const mx = this.centerX(), my = this.centerY();
        const dx = player.x + player.w / 2 - mx, dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        const sp = this.speed * (0.7 + 0.3 * Math.abs(Math.sin(this.hopT * 6)));
        this._moveWithCollision((dx / dist) * sp * dt, (dy / dist) * sp * dt, world);
        if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
        const k = Math.min(1, dt * 8);
        this.look.x += (dx / dist - this.look.x) * k;
        this.look.y += (dy / dist - this.look.y) * k;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 9)) { ctx.translate(cx, by); this._draw(ctx, true); }
            ctx.restore();
            return;
        }
        ctx.translate(cx, by);
        this._draw(ctx, false);
        ctx.restore();
    }

    _draw(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const hop = -Math.abs(Math.sin(this.hopT * 6)) * 3;
        ctx.save();
        ctx.translate(0, hop - 8);
        DevilArt.tail(ctx, -f * 4, 2, 0.8, Math.sin(t * 6 + sd));
        Art.body(ctx, 0, -4, 8, 8.5, DEVIL_BODY, { lineWidth: 1.2 });
        DevilArt.horns(ctx, 0.9, DEVIL_HORN_INK);
        if (dead) LateWorldArt.xEyes(ctx, f * 1.2, -6, 1.4, 2.5);
        else Art.eyes(ctx, f * 1.2, -6, 2.2, { gap: 2.6, look: this.look, angry: true, iris: DEVIL_EYE, seed: sd });
        Art.mouth(ctx, f * 1.2, -2.4, 3.6, dead ? 'o' : 'angry');
        Art.limb(ctx, f * 3, -3, f * 8, 1, 2, DEVIL_BODY, { lineWidth: 1 });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Geworfener Speer des Bosses (Bumerang) ──
// ══════════════════════════════════════════

// Liegt in der Geschoss-Liste (owner 'bossfx': die Engine prüft keine Treffer – das macht der Speer
// selbst). Hinflug zum Zielpunkt, dann Rückflug in die Hand des Bosses. Trifft Mark und die Freunde auf
// beiden Flügen je Richtung höchstens einmal. Ist der Boss weg, verschwindet der Speer.
class DevilThrowSpear {
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
        this.phase = 'out';
        this.t = 0;
        this.outDur = clamp(Math.hypot(tx - x, ty - y) / 240, 0.42, 1.25);
        this.speed = 40;
        this.rot = Math.atan2(ty - y, tx - x);
        this.hit = [];
    }

    update(dt) {
        const b = this.boss;
        if (!b || b.dead) { this.dead = true; return; }
        this.rot += 12 * dt;
        if (this.phase === 'out') {
            this.t += dt;
            const k = clamp(this.t / this.outDur, 0, 1);
            const e = Math.sin((k * Math.PI) / 2);
            this.x = this.x0 + (this.tx - this.x0) * e;
            this.y = this.y0 + (this.ty - this.y0) * e;
            if (k >= 1) { this.phase = 'back'; this.hit.length = 0; }
        } else {
            const h = b._hand(this.idx);
            const dx = h.x - this.x, dy = h.y - this.y;
            const d = Math.hypot(dx, dy);
            this.speed = Math.min(380, this.speed + 540 * dt);
            const step = this.speed * dt;
            if (d <= Math.max(16, step)) { this.dead = true; this.caught = true; b._catchSpear(this); return; }
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
                DevilArt.hurt(P, 1, Math.atan2(py - this.y, px - this.x), 210);
                if (P.hp < before) { this.hit.push(P); DevilArt.burst(px, py, [DEVIL_TIP, DEVIL_FIRE], 10, 140, 0.4, { kind: 'spark' }); }
            }
        }
        for (const c of DevilArt.companions()) {
            if (c.iFrames > 0 || this.hit.indexOf(c) >= 0) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - this.x, cy - this.y) > this.radius + Math.max(c.w, c.h) / 2) continue;
            this.hit.push(c);
            DevilArt.hitCompanion(c, 1);
        }
    }

    drawUnder(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y + 12);
        ctx.fillStyle = 'rgba(40,16,60,0.24)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 12, 4, 0, 0, TAU);
        ctx.fill();
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.2;
        ctx.fillStyle = DEVIL_FIRE;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.rot);
        DevilArt.spear(ctx, 34, this.boss && this.boss.phase === 2 ? 0.9 : 0.5);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 32: Vier-Arm-Teufel ──
// ══════════════════════════════════════════

const BOSS_DEVIL_SPIN_R = 66;   // Speerkreis der Drehattacke
const BOSS_DEVIL_SLAM_R = 128;  // Radius der Schockwelle (Speerstoß)
const BOSS_DEVIL_STUN = 2.5;    // Festsetzen durch die Schockwelle (Sekunden)
const BOSS_DEVIL_HANDS = 4;

class BossFourArmDevil extends Enemy {
    constructor(x, y) {
        super(x, y, 62, 62);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 36;
        this.damage = 1;
        this.contactDamage = false;        // gefährlich sind die Speere – so kann man im Schwindel hauen
        this.isBoss = true;
        this.flying = false;
        this.fxColor = DEVIL_FIRE;
        this.shadow = { rx: 34, ry: 10, dy: 26 };
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
        this.atkIdx = 0;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.moving = false;
        this.inHand = [true, true, true, true];
        this.thrown = [null, null, null, null];
        this.throwClock = 0;
        this.hailTwice = false;
        this.hailSecond = false;
        this.aim = [{ x: 0, y: 0, a: 0, tg: null }, { x: 0, y: 0, a: 0, tg: null }, { x: 0, y: 0, a: 0, tg: null }, { x: 0, y: 0, a: 0, tg: null }];
        this.aiming = false;
        this.spinAngle = 0;
        this.spinRate = 0;
        this.freeT = 99;                   // echte Sekunden, seit Mark nicht mehr feststeht
        this.slamX = 0;
        this.slamY = 0;
        this.waves = [];                   // laufende Schockwellen
        this.summoned = [];
        this._handPt = { x: 0, y: 0 };      // Hilfspunkt der Hand (nicht this.h: das ist die Höhe der Hitbox!)
    }

    _set(state, dur) { this.state = state; this.stateT = dur; this.stateDur = dur; }
    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }
    hasSpears() { return this.inHand[0] && this.inHand[1] && this.inHand[2] && this.inHand[3]; }

    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.2);
        if (this.dead && !was) { this.waves.length = 0; for (const s of this.thrown) if (s) s.dead = true; }
    }

    // Hand i in Weltkoordinaten (Abwurf-/Fangpunkt) → this._handPt
    _hand(i) {
        const side = i < 2 ? -1 : 1, row = i % 2;
        this._handPt.x = this.centerX() + side * (24 + row * 3);
        this._handPt.y = this.centerY() + (row ? 12 : -10);
        return this._handPt;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        const realDt = dt / (this.tempo || 1);
        if (player && player.stunTimer > 0) this.freeT = 0; else this.freeT += realDt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._checkSpears(dt);
        this._updateWaves(dt, player);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const p2 = this.phase === 2;
        if (this.state === 'spin') this.spinRate = Math.min(p2 ? 20 : 15, this.spinRate + 42 * dt);
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
                if (this.stateT <= 0) this._set('spin', p2 ? 2.4 : 2.8);
                break;
            case 'spin':
                this._spinMove(dt, world, px, py);
                this._roomClamp(world);
                this._spinHits(player);
                if (this.stateT <= 0) this._set('dizzy', p2 ? 1.25 : 1.7);
                break;
            case 'hailAim':
                this._aimHail(world, player, this.stateT <= 0.3);
                if (this.stateT <= 0) { this._throwHail(projectiles, world); this._set('waitSpears', 8); }
                break;
            case 'waitSpears':
                this._hover(dt, world, px, py, 0.4);
                if (this.hasSpears() || this.stateT <= 0) {
                    if (!this.hasSpears()) this._forceReturn();
                    if (this.hailTwice && !this.hailSecond) { this.hailSecond = true; this._startHail(false); }
                    else this._toHover();
                }
                break;
            case 'slamRaise':
                this.slamX = this.centerX(); this.slamY = this.centerY();
                if (this.stateT <= 0) this._slam();
                break;
            case 'slam':
                if (this.stateT <= 0) this._set('stuck', p2 ? 0.8 : 1.1);
                break;
            case 'dizzy':
                if (this.stateT <= 0) { if (!this.hasSpears()) this._set('waitSpears', 8); else this._toHover(); }
                break;
            default:            // stuck, recover, roar
                if (this.stateT <= 0) this._toHover();
        }
        this._lookAt(dt, px, py);
    }

    _roomClamp(world) {
        const room = this._room(world);
        if (room) {
            this.x = clamp(this.x, room.x, Math.max(room.x, room.x + room.w - this.w));
            this.y = clamp(this.y, room.y, Math.max(room.y, room.y + room.h - this.h));
        }
    }

    _lookAt(dt, px, py) {
        let tx = px, ty = py;
        if (this.aiming) {
            let sx = 0, sy = 0;
            for (const A of this.aim) { sx += A.x; sy += A.y; }
            tx = sx / BOSS_DEVIL_HANDS; ty = sy / BOSS_DEVIL_HANDS;
        }
        const dx = tx - this.centerX(), dy = ty - (this.centerY() - 10);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
        if (Math.abs(dx) > 14 && this.state !== 'spin') this.face = dx > 0 ? 1 : -1;
    }

    _toHover() {
        this.aiming = false;
        if (this.phase === 2 && !this.roared) {
            this.roared = true;
            this._set('roar', 1.0);
            const x = this.centerX(), y = this.centerY() - 10;
            DevilArt.shake(6, 0.45);
            DevilArt.burst(x, y, [DEVIL_FIRE, DEVIL_FIRE2, '#ffffff'], 20, 190, 0.6, { kind: 'star' });
            DevilArt.ring(x, y, DEVIL_FIRE, 110, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('hover', this.phase === 2 ? randRange(0.7, 1.0) : randRange(1.2, 1.6));
    }

    _hover(dt, world, px, py, k) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        let vx, vy, sp = this.speed * k * (this.phase === 2 ? 1.35 : 1);
        if (d > 165) { vx = dx / d; vy = dy / d; }
        else if (d < 96) { vx = -dx / d; vy = -dy / d; }
        else { vx = (-dy / d) * this.strafe; vy = (dx / d) * this.strafe; sp *= 0.7; }
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
        this._roomClamp(world);
        if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) this.strafe = -this.strafe;
        this.moving = true;
    }

    _nextAttack(world, player) {
        if (!this.hasSpears()) { this._set('waitSpears', 8); return; }
        this._maybeSummon(world, player);
        const opts = ['hail', 'spin'];
        if (this.freeT >= 1.5) opts.push('slam');   // erst wieder, wenn Mark frei ist (+1,5 s)
        const pick = opts[this.atkIdx++ % opts.length];
        if (pick === 'hail') this._startHail(true);
        else if (pick === 'spin') this._startSpin();
        else this._startSlam();
    }

    // ── a) Speerhagel ──

    _startHail(reset) {
        if (reset) this.hailSecond = false;
        for (const A of this.aim) A.tg = null;
        this.aiming = true;
        this._aimHail(null, null, false, true);
        this._set('hailAim', this.phase === 2 ? 0.8 : 1.0);
    }

    // Ziele: Mark + Freunde (max 4 Speere). Die letzten 0,3 s steht alles fest.
    _aimHail(world, player, locked, init) {
        if (locked && !init) return;
        const P = player || (typeof Game !== 'undefined' ? Game.player : null);
        if (!P) return;
        const mx = this.centerX(), my = this.centerY();
        const comps = DevilArt.companions();
        const targets = [];
        if (!P.dead) targets.push({ o: P });
        for (const c of comps) targets.push({ o: c });
        const px = P.x + P.w / 2, py = P.y + P.h / 2;
        for (let i = 0; i < BOSS_DEVIL_HANDS; i++) {
            const A = this.aim[i];
            let o, tx = px, ty = py;
            if (i < targets.length) { o = targets[i].o; tx = o.x + o.w / 2; ty = o.y + o.h / 2; }
            else { o = P; tx = px + (i % 2 ? 26 : -26); ty = py + 10; }   // überzählige Speere fächern um Mark
            A.tg = o;
            const h = this._hand(i);
            const d = clamp(Math.hypot(tx - h.x, ty - h.y) + 40, 90, 340);
            let a = Math.atan2(ty - h.y, tx - h.x);
            let ex = h.x + Math.cos(a) * d, ey = h.y + Math.sin(a) * d;
            const room = this._room(world);
            if (room) { ex = clamp(ex, room.x + 12, room.x + room.w - 12); ey = clamp(ey, room.y + 12, room.y + room.h - 12); }
            A.x = ex; A.y = ey; A.a = Math.atan2(ey - h.y, ex - h.x);
        }
    }

    _throwHail(projectiles, world) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        this.aiming = false;
        if (!this.hasSpears()) return;
        for (let i = 0; i < BOSS_DEVIL_HANDS; i++) {
            const h = this._hand(i);
            const s = new DevilThrowSpear(this, i, h.x, h.y, this.aim[i].x, this.aim[i].y);
            this.thrown[i] = s;
            this.inHand[i] = false;
            if (list) list.push(s);
            else { s.dead = true; this.inHand[i] = true; this.thrown[i] = null; }
        }
        this.throwClock = 0;
        DevilArt.burst(this.centerX(), this.centerY() - 10, [DEVIL_TIP, DEVIL_FIRE], 12, 170, 0.35, { kind: 'spark' });
        DevilArt.shake(3, 0.15);
    }

    _catchSpear(s) {
        const i = s.idx;
        if (this.thrown[i] === s) this.thrown[i] = null;
        this.inHand[i] = true;
        const h = this._hand(i);
        DevilArt.burst(h.x, h.y, [DEVIL_TIP, '#ffffff'], 6, 90, 0.3, { kind: 'spark' });
    }

    _checkSpears(dt) {
        if (this.hasSpears()) return;
        this.throwClock += dt;
        let lost = this.throwClock > 7;
        for (let i = 0; i < BOSS_DEVIL_HANDS; i++) {
            const s = this.thrown[i];
            if (this.inHand[i]) continue;
            if (!s || (s.dead && !s.caught)) lost = true;
            if (typeof Game !== 'undefined' && Game.projectiles && s && !s.dead && Game.projectiles.indexOf(s) < 0 && this.throwClock > 0.3) lost = true;
        }
        if (lost) this._forceReturn();
    }

    _forceReturn() {
        for (let i = 0; i < BOSS_DEVIL_HANDS; i++) {
            const s = this.thrown[i];
            if (s) s.dead = true;
            this.thrown[i] = null;
            if (!this.inHand[i]) { this.inHand[i] = true; const h = this._hand(i); DevilArt.burst(h.x, h.y, [DEVIL_TIP, '#ffffff'], 6, 90, 0.3, { kind: 'spark' }); }
        }
    }

    // ── b) Drehattacke ──

    _startSpin() {
        this.aiming = false;
        this._set('spinWind', this.phase === 2 ? 0.8 : 0.95);
    }

    _spinMove(dt, world, px, py) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d < 6) return;
        const sp = (this.phase === 2 ? 86 : 66) * Math.min(1, (this.stateDur - this.stateT) / 0.4 + 0.2);
        this._moveWithCollision((dx / d) * sp * dt, (dy / d) * sp * dt, world);
        this.moving = true;
    }

    _spinHits(player) {
        const cx = this.centerX(), cy = this.centerY();
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - cx, py - cy) < BOSS_DEVIL_SPIN_R + player.w / 2 - 4) {
                const before = player.hp;
                DevilArt.hurt(player, 1, Math.atan2(py - cy, px - cx), 250);
                if (player.hp < before) DevilArt.burst(px, py, [DEVIL_TIP, DEVIL_FIRE], 10, 150, 0.45, { kind: 'spark' });
            }
        }
        for (const c of DevilArt.companions()) {
            if (c.iFrames > 0) continue;
            const x = c.x + c.w / 2, y = c.y + c.h / 2;
            if (Math.hypot(x - cx, y - cy) < BOSS_DEVIL_SPIN_R + Math.max(c.w, c.h) / 2 - 4) DevilArt.hitCompanion(c, 1);
        }
    }

    // ── c) Speerstoß in den Boden (Schockwelle) ──

    _startSlam() {
        this.aiming = false;
        this.slamX = this.centerX(); this.slamY = this.centerY();
        this._set('slamRaise', 1.0);
    }

    _slam() {
        const x = this.slamX, y = this.slamY;
        this.waves.push({ x, y, r: 20, max: BOSS_DEVIL_SLAM_R, hitP: false, hitC: [] });
        DevilArt.shake(8, 0.4);
        DevilArt.burst(x, y, [DEVIL_BODY, DEVIL_SHADE, '#ffffff'], 16, 170, 0.55, { kind: 'smoke', size: 6 });
        DevilArt.burst(x, y, [DEVIL_FIRE, DEVIL_FIRE2, '#ffffff'], 10, 210, 0.45, { kind: 'star' });
        DevilArt.ring(x, y, DEVIL_FIRE, 60, 0.3, 5);
        this._set('slam', 0.14);
    }

    _updateWaves(dt, player) {
        if (!this.waves.length) return;
        for (const w of this.waves) {
            w.r += 230 * dt;
            const band = 16;
            if (!w.hitP && player && !player.dead && !(player.stunTimer > 0)) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                const d = Math.hypot(px - w.x, py - w.y);
                if (Math.abs(d - w.r) < band + player.w / 2 && !player.dodging) {
                    w.hitP = true;
                    DevilArt.hurt(player, 1, Math.atan2(py - w.y, px - w.x), 90);
                    if (player.stun && player.stun(BOSS_DEVIL_STUN))
                        DevilArt.burst(px, py - 14, [DEVIL_FIRE, '#ffffff'], 8, 90, 0.5, { kind: 'star' });
                }
            }
            for (const c of DevilArt.companions()) {
                if (!c || c.dead || typeof c.stun !== 'function' || c.stunTimer > 0 || c.koTimer > 0) continue;
                if (w.hitC.includes(c)) continue;
                const cw = c.w || 20, ch = c.h || 20;
                const d = Math.hypot(c.x + cw / 2 - w.x, c.y + ch / 2 - w.y);
                if (Math.abs(d - w.r) < band + cw / 2) {
                    w.hitC.push(c);
                    c.stun(BOSS_DEVIL_STUN);
                    DevilArt.burst(c.x + cw / 2, c.y, [DEVIL_FIRE, '#ffffff'], 6, 80, 0.45, { kind: 'star' });
                }
            }
        }
        compactInPlace(this.waves, w => w.r < w.max);
    }

    // ── Helfer rufen (nur Phase 2, nur im Boss-Raum, max 4 gleichzeitig) ──

    _aliveImps() { let n = 0; for (const k of this.summoned) if (!k.dead) n++; return n; }

    _maybeSummon(world, player) {
        if (this.phase !== 2) return;
        if (this._aliveImps() >= 3 && Math.random() < 0.6) return;   // selten nachfüllen, max 4
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || !Game._bossRoomRect || !Game.enemies) return;
        const want = Math.min(4 - this._aliveImps(), randInt(1, 2));
        if (want <= 0) return;
        const room = Game._bossRoomRect();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 22 + Math.random() * (room.w - 44);
                const y = room.y + 22 + Math.random() * (room.h - 44);
                if (Math.hypot(x - px, y - py) < 90 || Math.hypot(x - this.centerX(), y - this.centerY()) < 55) continue;
                if (world.isWall(x - 9, y - 10) || world.isWall(x + 9, y - 10) || world.isWall(x - 9, y + 10) || world.isWall(x + 9, y + 10)) continue;
                const imp = new DevilImp(x, y);
                imp.summoner = this;
                Game.enemies.push(imp);
                this.summoned.push(imp);
                DevilArt.burst(x, y, [DEVIL_FIRE, '#ffffff', DEVIL_SHADE], 12, 120, 0.5, { kind: 'star' });
                DevilArt.ring(x, y + 6, DEVIL_FIRE, 24, 0.4, 3);
                break;
            }
        }
    }

    _room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    // ── Zeichnen ──

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, by - 34);
            ctx.translate(cx, by);
            ctx.scale(BOSS_DEVIL_DRAW_SCALE, BOSS_DEVIL_DRAW_SCALE);
            this._drawBody(ctx, true);
        } else {
            ctx.translate(cx, by);
            ctx.scale(BOSS_DEVIL_DRAW_SCALE, BOSS_DEVIL_DRAW_SCALE);
            this._drawBody(ctx, false);
        }
        ctx.restore();
    }

    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, p2 = this.phase === 2;
        const st = dead ? 'dead' : this.state;
        const k = this._k();
        const bob = Math.sin(t * (p2 ? 2.8 : 2.1) + this.seed) * 2;
        ctx.save();
        ctx.translate(0, bob);
        // Phase 2: Flammenaura
        if (p2 && !dead) Art.glow(ctx, 0, -30, 62, DEVIL_FIRE, 0.22 + 0.09 * Math.sin(t * 5));
        // Schwanz hinter dem Körper
        DevilArt.tail(ctx, -f * 10, -8, 2.2, Math.sin(t * 3 + this.seed));
        // Beine
        for (let s = -1; s <= 1; s += 2) {
            const step = this.moving ? Math.sin(t * 8 + (s > 0 ? 0 : Math.PI)) * 3 : 0;
            Art.limb(ctx, s * 9, -18, s * 12, 0 - Math.max(0, step), 8, DEVIL_BODY, { lineWidth: 2 });
            Art.body(ctx, s * 13, -1, 6.5, 4, DEVIL_SHADE, { lineWidth: 1.6 });
        }
        // Drehattacke: hintere Arme/Speere vor dem Körper
        if (st === 'spin') this._spinArms(ctx, false);
        else this._arms(ctx, st, k, false);
        // Rumpf
        Art.body(ctx, 0, -34, 24, 26, DEVIL_BODY, { lineWidth: 2.2 });
        Art.body(ctx, f * 2, -30, 15, 17, DEVIL_SHADE, { lineWidth: 1.2, highlight: false, flat: true });
        // Risse/Bauchmuskeln (Phase 2)
        if (p2 && !dead) {
            ctx.strokeStyle = Art.dark(DEVIL_BODY, 0.4);
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(-12, -44); ctx.lineTo(-8, -36); ctx.lineTo(-11, -28);
            ctx.moveTo(12, -30); ctx.lineTo(8, -24);
            ctx.stroke();
        }
        // Kopf
        const hx = f * 2, hy = -60;
        Art.body(ctx, hx, hy, 17, 15, DEVIL_BODY, { lineWidth: 2.2 });
        DevilArt.horns(ctx, 2.4, DEVIL_HORN_INK);
        // Gesicht
        if (dead) LateWorldArt.xEyes(ctx, hx + f * 1.5, hy + 1, 2.8, 6);
        else if (st === 'dizzy') this._dizzyEyes(ctx, hx + f * 1.5, hy + 1);
        else {
            Art.eyes(ctx, hx + f * 1.5, hy + 1, 4, { gap: 5.4, look: this.look, angry: true, iris: p2 ? '#ff2038' : DEVIL_EYE, seed: this.seed });
            Art.glow(ctx, hx + f * 1.5, hy + 1, 10, p2 ? '#ff2038' : DEVIL_EYE, 0.3 + 0.12 * Math.sin(t * 4));
        }
        Art.mouth(ctx, hx + f * 1.5, hy + 8.5, 8, dead ? 'o' : (st === 'slamRaise' || st === 'roar' ? 'open' : (st === 'spin' ? 'grin' : 'angry')));
        if (!dead && st !== 'dizzy') {
            // Eckzähne
            ctx.fillStyle = '#f4f1ff';
            ctx.beginPath();
            ctx.moveTo(hx - 3, hy + 6); ctx.lineTo(hx - 1, hy + 10); ctx.lineTo(hx + 1, hy + 6);
            ctx.moveTo(hx + 3, hy + 6); ctx.lineTo(hx + 5, hy + 10); ctx.lineTo(hx + 7, hy + 6);
            ctx.fill();
        }
        // Vordere Arme/Speere nach der Drehung; sonst regulär vorn
        if (st === 'spin') this._spinArms(ctx, true);
        else this._arms(ctx, st, k, true);
        if (st === 'dizzy') LateWorldArt.dizzy(ctx, hx, hy - 22, 20, 4.5);
        ctx.restore();
    }

    _dizzyEyes(ctx, x, y) {
        ctx.strokeStyle = Art.INK;
        ctx.lineWidth = 1.4;
        const t = Art.time;
        ctx.beginPath();
        for (let s = -1; s <= 1; s += 2) {
            const ex = x + s * 5.4, ey = y;
            for (let j = 0; j <= 10; j++) {
                const a = j * 0.9 + t * 8 * s, r = j * 0.34;
                if (j === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
            }
        }
        ctx.stroke();
    }

    // Arme in Normalhaltung. back = die hintere Paarkante (beidseits), front = vordere.
    // Zustände: Speere hoch (slamRaise/roar), Ausholen (spinWind), sonst spielbar.
    _arms(ctx, st, k, front) {
        const f = this.face;
        const up = (st === 'slamRaise' || st === 'roar');
        const wind = st === 'spinWind';
        const stuck = st === 'stuck' || st === 'slam';
        for (let i = 0; i < BOSS_DEVIL_HANDS; i++) {
            const side = i < 2 ? -1 : 1, row = i % 2;
            if ((side < 0) !== front) continue;   // beide Arme einer Seite in einem Durchgang
            const shX = side * 16, shY = -44 + row * 12;
            let hx, hy, sa;
            if (up) { const e = stuck ? Math.min(1, k * 4) : Math.min(1, k * 2.2); hx = side * (16 + row * 4); hy = -54 - e * 44 + (stuck ? 40 : 0); sa = -Math.PI / 2 + (stuck ? 1.3 : 0); }
            else if (wind) { const e = Math.min(1, k * 2); hx = side * (22 + e * 6); hy = -46 - e * 30; sa = -Math.PI / 2 + side * (0.5 + e * 0.5); }
            else if (st === 'dizzy') { hx = side * 26; hy = -28; sa = side > 0 ? 1.3 : Math.PI - 1.3; }
            else { hx = side * (24 + row * 3); hy = -34 + row * 12; sa = side > 0 ? (row ? 0.5 : -0.5) : (row ? Math.PI - 0.5 : Math.PI + 0.5); }
            Art.limb(ctx, shX, shY, hx, hy, 6.5, DEVIL_BODY, { lineWidth: 1.8 });
            if (this.inHand[i]) {
                ctx.save();
                ctx.translate(hx, hy);
                ctx.rotate(sa);
                DevilArt.spear(ctx, 40, (this.phase === 2 ? 0.6 : 0.3) + (up || wind ? 0.4 : 0));
                ctx.restore();
            }
            Art.body(ctx, hx, hy, 5, 5, DEVIL_SHADE, { lineWidth: 1.6 });
        }
    }

    // Drehattacke: alle vier Speere kreisen um den Körper. front = nur vordere (untere) Hälfte.
    _spinArms(ctx, front) {
        const R = 42, cy = -34;
        for (let i = 0; i < BOSS_DEVIL_HANDS; i++) {
            const a = this.spinAngle + (i * TAU) / BOSS_DEVIL_HANDS;
            const ca = Math.cos(a), sa = Math.sin(a);
            if ((sa >= 0) !== front) continue;
            const hx = ca * R, hy = cy + sa * R * 0.4;
            Art.limb(ctx, ca >= 0 ? 12 : -12, -40, hx, hy, 6.5, DEVIL_BODY, { lineWidth: 1.8 });
            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(Math.atan2(sa * 0.4, ca));
            ctx.scale(Math.max(0.4, Math.hypot(ca, sa * 0.4)), 1);
            DevilArt.spear(ctx, 44, this.phase === 2 ? 0.9 : 0.5);
            ctx.restore();
            Art.body(ctx, hx, hy, 5, 5, DEVIL_SHADE, { lineWidth: 1.6 });
        }
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        const c = camera.worldToScreen(this.centerX(), this.centerY());
        const k = this._k();
        if (this.state === 'spinWind') {
            LateWorldArt.warn(ctx, c.x, c.y, BOSS_DEVIL_SPIN_R, k);
        } else if (this.state === 'spin') {
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.14;
            ctx.fillStyle = '#ff3d5a';
            ctx.beginPath();
            ctx.arc(c.x, c.y, BOSS_DEVIL_SPIN_R, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = prev;
            Art.ring(ctx, c.x, c.y, BOSS_DEVIL_SPIN_R, '#ff3d5a', 2.2, 0.55 + 0.35 * Math.abs(Math.sin(Art.time * 12)));
        } else if (this.state === 'slamRaise') {
            const p = camera.worldToScreen(this.slamX, this.slamY);
            LateWorldArt.warn(ctx, p.x, p.y, BOSS_DEVIL_SLAM_R, k);
            Art.ring(ctx, p.x, p.y, BOSS_DEVIL_SLAM_R * 0.55, '#ff3d5a', 1.6, 0.5);
        }
        // Speerhagel: Warnlinien von den Händen zu den Zielen + Ziel-Pfeile
        if (this.aiming) {
            const lk = k;
            const locked = this.state === 'hailAim' && this.stateT <= 0.3;
            ctx.save();
            for (let i = 0; i < BOSS_DEVIL_HANDS; i++) {
                const A = this.aim[i];
                const h = this._hand(i);
                const hs = camera.worldToScreen(h.x, h.y);
                const len = Math.hypot(A.x - h.x, A.y - h.y);
                LateWorldArt.lane(ctx, hs.x, hs.y, A.a, len, 18, lk, locked ? '#ff3d5a' : '#ff7a3d');
                const tg = A.tg;
                if (tg && !tg.dead && !(tg.koTimer > 0)) {
                    const ap = camera.worldToScreen(tg.x + tg.w / 2, tg.y - 12 + Math.sin(Art.time * 9) * 2.5);
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
        // Wachsende Schockwellen des Speerstoßes
        for (const w of this.waves) {
            const p = camera.worldToScreen(w.x, w.y);
            const frac = clamp(w.r / w.max, 0, 1);
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.5 * (1 - frac);
            ctx.strokeStyle = DEVIL_FIRE;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, w.r, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = prev * 0.7 * (1 - frac);
            ctx.strokeStyle = DEVIL_FIRE2;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
    }
}
