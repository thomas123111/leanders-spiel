// ── Welt 44: Dschungelfelsen (Idee von Leander) ──
// Starke Gorillas mit schwarzem Fell – der mit dem Schlüssel hat graues Fell, alle anderen sind schwarz.
//   Von weitem springen sie auf Mark oder einen seiner Freunde: 0,5 s vorher zieht sich am Ziel ein roter
//   Kreis zusammen, dann fliegen sie drüber und landen darauf. Aus der Nähe boxen sie mit der Pranke.
// Boss: RIESEN-GORILLA – Endgegner von Welt 44, bleibt im Boss-Raum (Felsplateau), 135 LP, zwei Phasen.
//   Hochsprung: holt tief aus, springt sehr hoch auf Mark oder die Freunde. Die Landung lässt den Boden
//     beben: Bildschirmwackeln, Schockwelle, Schaden im Kreis für Mark, Juri und das Schattenkrokodil.
//   Schlag: weite Pranke von oben nach vorn. Stampfen: zwei bis vier Tritte, jeder mit Schockwelle.
//   Phase 2 (halbe LP): schneller, jeder zweite Sprung kommt direkt zweimal – und nach großen Angriffen
//     wird er schwindelig (Sterne um den Kopf, kurz wehrlos, wie Schwert-Engel und Vierarm-Teufel).
//     Das ist Marks Zeit zum Zurückhauen.
//   Freunde verschwinden nie: ein tödlicher Treffer haut Juri und das Krokodil nur um (knockOut).

const GorillaCfg = {
    fur: '#3b3b47',           // schwarzes Fell: hellster Ton, damit es auf dem grünen Boden zu sehen ist
    furMid: '#2c2c36',
    furDark: '#1e1e26',
    saddle: '#5f5f72',        // Silberrücken (heller Rückenstreifen)
    chest: '#6c6c7c',         // Brust und Bauch (heller als das Fell)
    keyFur: '#9aa0ae',        // Schluesseltraeger: graues Fell
    keyMid: '#7e8492',
    keyDark: '#616674',
    keySaddle: '#c6cad6',
    keyChest: '#d8dbe4',
    skin: '#5e5047',          // Gesicht, Fäuste, Fußsohlen (dunkle Gorillahaut)
    skinDark: '#463b35',
    muzzle: '#8d7a6e',        // helle Schnauze, damit das Gesicht auf dem dunklen Fell lesbar bleibt
    leaf: '#6fd44a',          // Blätter im Fell
    vine: '#3f9c46',
    gem: '#ffd23f',
    warn: '#ff5a3d',
};

// Zwei Fellpaletten: schwarz (alle) und grau (Schlüsselträger)
const C_BLACK = { fur: GorillaCfg.fur, furMid: GorillaCfg.furMid, furDark: GorillaCfg.furDark, saddle: GorillaCfg.saddle, chest: GorillaCfg.chest };
const C_KEY = { fur: GorillaCfg.keyFur, furMid: GorillaCfg.keyMid, furDark: GorillaCfg.keyDark, saddle: GorillaCfg.keySaddle, chest: GorillaCfg.keyChest };

const GorillaArt = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine direkt.
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

    // Begleiter treffen: nie verschwinden lassen, ein tödlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(7);
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [GorillaCfg.furDark, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    // Freier Punkt in der Welt (für Landeziele)?
    free(world, x, y, r) {
        if (!world || !world.collideRect) return true;
        return world.collideRect({ x: x - r, y: y - r, w: r * 2, h: r * 2 }).length === 0;
    },

    // Alle treffbaren Ziele (Mark zuerst, dann die Freunde)
    targets(player) {
        const out = [];
        if (player && !player.dead) {
            out.push({ ref: player, x: player.x + player.w / 2, y: player.y + player.h / 2, w: player.w, h: player.h, isPlayer: true });
        }
        for (const c of this.companions()) {
            out.push({ ref: c, x: c.x + (c.w || 20) / 2, y: c.y + (c.h || 20) / 2, w: c.w || 20, h: c.h || 20 });
        }
        return out;
    },

    // Flächenschaden: trifft Mark und die Freunde innerhalb von R, jeder höchstens einmal (hit-Liste).
    areaHit(x, y, R, amount, force, hit) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (hit) hit.push(t.ref);
            if (t.isPlayer) this.hurt(t.ref, amount, Math.atan2(t.y - y, t.x - x), force);
            else this.hitCompanion(t.ref, amount);
        }
    },

    // Sprungziel: Mark oder der nächste Freund, in erreichbarer Entfernung, auf freiem Boden, im Boss-Raum.
    // null = kein brauchbares Ziel (dann lieber nicht springen).
    leapTarget(world, e, player, minD, maxD) {
        const cx = e.centerX(), cy = e.centerY();
        let best = null;
        for (const t of this.targets(player)) {
            const d = Math.hypot(t.x - cx, t.y - cy);
            if (d < 24) continue;
            if (!best || d < best.d) best = { t, d };
        }
        if (!best) return null;
        const want = clamp(best.d, minD, maxD);
        let x = cx + ((best.t.x - cx) / best.d) * want;
        let y = cy + ((best.t.y - cy) / best.d) * want;
        const room = e.isBoss ? this.room(world) : null;
        if (room) {
            x = clamp(x, room.x + e.w / 2 + 6, room.x + room.w - e.w / 2 - 6);
            y = clamp(y, room.y + e.h / 2 + 6, room.y + room.h - e.h / 2 - 6);
        }
        const r = Math.min(e.w, e.h) * 0.45;
        if (!this.free(world, x, y, r)) return null;
        return { x, y };
    },

    // ── Ganze Figur (Claude, 10.10.2026): von vorn, leicht in Blickrichtung gedreht, Fußpunkt (0, 0).
    // Eine Einheit = normaler Gorilla, der Boss zeichnet dieselbe Figur größer (ctx.scale vorher).
    // Breite Schultern, lange Arme mit Fäusten am Boden, kurze Beine, Scheitelkamm, dicker Stirnwulst.
    // p = { c, lw, t, bob, walk, hands: { b: {x, y}, f: {x, y} }, legLift: [hinten, vorn], mood, look,
    //       headDy, silver (Schulterfell des Bosses), leaves, scar, red (rote Augen) }
    figure(ctx, p) {
        const c = p.c, lw = p.lw;
        const hip = -8 - p.bob;                 // Hüfthöhe (Oberkörper hebt und senkt sich)
        // Beine und Füße (s = -1 hinten, +1 vorn; der Schritt hebt abwechselnd einen Fuß)
        for (const s of [-1, 1]) {
            const lift = ((p.legLift && p.legLift[s > 0 ? 1 : 0]) || 0) + Math.max(0, s * (p.walk || 0)) * 2.2;
            const fx = s * 7;
            Art.limb(ctx, s * 5, hip - 1, fx, -2.6 - lift, 6.6, c.furMid, { lineWidth: lw });
            Art.body(ctx, fx + s * 0.6, -1.8 - lift, 5.2, 2.6, c.furDark, { lineWidth: lw });
            Art.body(ctx, fx + s * 0.6, -1.1 - lift, 3.4, 1.1, GorillaCfg.skin, { highlight: false, outline: false });
        }
        // Rumpf: breit an den Schultern, schmaler an der Hüfte
        const top = hip - 24;
        Art.shape(ctx, g => {
            g.moveTo(-8.5, hip + 1);
            g.bezierCurveTo(-11.5, hip - 5, -17, hip - 11, -15.5, hip - 18);
            g.bezierCurveTo(-14.5, top + 1, -7, top - 0.5, 0, top);
            g.bezierCurveTo(7, top - 0.5, 14.5, top + 1, 15.5, hip - 18);
            g.bezierCurveTo(17, hip - 11, 11.5, hip - 5, 8.5, hip + 1);
            g.quadraticCurveTo(0, hip + 3.5, -8.5, hip + 1);
            g.closePath();
        }, { x: -17, y: top, w: 34, h: 28 }, c.fur, { glossy: true, lineWidth: lw });
        if (p.silver) {
            // Silbernes Schulterfell des alten Anführers
            for (const s of [-1, 1]) Art.body(ctx, s * 10.5, hip - 19.5, 5.4, 2.8, c.saddle, { highlight: false, outline: false, rot: s * 0.35 });
        }
        // Brust (zwei Platten) und Bauch
        for (const s of [-1, 1]) Art.body(ctx, s * 4.7, hip - 15.5, 5, 3.6, c.chest, { highlight: false, lineWidth: lw * 0.75 });
        Art.body(ctx, 0, hip - 6.8, 6, 4.8, c.chest, { highlight: false, lineWidth: lw * 0.75 });
        if (p.leaves) {
            Art.body(ctx, -12, hip - 21, 2.2, 1.4, GorillaCfg.leaf, { lineWidth: lw * 0.6, rot: -0.5 });
            Art.body(ctx, 10.5, hip - 3.5, 1.9, 1.2, GorillaCfg.leaf, { lineWidth: lw * 0.6, rot: 0.4 });
        }
        // Arme: Oberarm dick, Unterarm etwas dünner, Faust mit Knöcheln
        const arm = (s, h, col) => {
            const sx = s * 12.5, sy = hip - 18;
            const mx = (sx + h.x) / 2 + s * 3.8, my = (sy + h.y) / 2;
            Art.limb(ctx, sx, sy, mx, my, 7.4, col, { lineWidth: lw });
            Art.limb(ctx, mx, my, h.x, h.y, 6.4, col, { lineWidth: lw });
            Art.body(ctx, h.x, h.y, 4.5, 3.9, GorillaCfg.skin, { lineWidth: lw });
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
            ctx.lineWidth = lw * 0.7;
            ctx.beginPath();
            for (const d of [-1.6, 0, 1.6]) { ctx.moveTo(h.x + d, h.y - 2.4); ctx.lineTo(h.x + d, h.y - 0.8); }
            ctx.stroke();
        };
        arm(-1, p.hands.b, c.furMid);
        arm(1, p.hands.f, c.fur);
        // Kopf sitzt tief zwischen den Schultern (kein Hals)
        const hx = 1.6, hy = top - 2 + (p.headDy || 0);
        for (const s of [-1, 1]) Art.body(ctx, hx + s * 8.8, hy + 0.5, 2, 2.4, GorillaCfg.skin, { lineWidth: lw * 0.8 });
        Art.shape(ctx, g => {                                     // Scheitelkamm
            g.moveTo(hx - 6.8, hy - 3);
            g.quadraticCurveTo(hx - 3.5, hy - 11.5, hx + 0.8, hy - 11.2);
            g.quadraticCurveTo(hx + 5.5, hy - 10, hx + 6.8, hy - 3);
            g.closePath();
        }, { x: hx - 7, y: hy - 14, w: 14, h: 11 }, c.fur, { lineWidth: lw });
        Art.body(ctx, hx, hy, 9, 8.2, c.fur, { glossy: true, lineWidth: lw });
        // Gesicht: dunkle Maske, helle Schnauze mit Nasenlöchern
        Art.body(ctx, hx, hy + 1.7, 6.9, 5.9, GorillaCfg.skin, { highlight: false, lineWidth: lw * 0.8 });
        Art.body(ctx, hx, hy + 3.9, 5, 3.2, GorillaCfg.muzzle, { highlight: false, lineWidth: lw * 0.75 });
        ctx.fillStyle = GorillaCfg.skinDark;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * 1.3, hy + 2.9, 1.05, 0.75, s * 0.4, 0, TAU); ctx.fill(); }
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        if (mood === 'dead') LateWorldArt.xEyes(ctx, hx, hy - 0.4, 1.7, 2.8);
        else if (mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.8;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + (p.t || 0) * 6 * s, r = 0.2 + i * 0.11;
                    const x = hx + s * 2.8 + Math.cos(a) * r, y = hy - 0.4 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, hx + s * 2.8, hy - 0.3, 1.9, { x: look.x, y: look.y },
                    { angry: mood !== 'tired', side: s < 0 ? 'left' : 'right', iris: p.red ? '#ff3b3b' : '#6a3a14',
                      open: mood === 'tired' ? 0.5 : 1 });
            }
        }
        ctx.lineCap = 'round';                                    // Stirnwulst über den Augen
        ctx.strokeStyle = GorillaCfg.skinDark;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(hx - 5.6, hy - 2.2);
        ctx.quadraticCurveTo(hx, hy - (mood === 'tired' || mood === 'dizzy' ? 3.6 : 2.4), hx + 5.6, hy - 2.2);
        ctx.stroke();
        if (p.scar) {
            ctx.strokeStyle = '#d9c3b5';
            ctx.lineWidth = lw * 0.7;
            ctx.beginPath();
            ctx.moveTo(hx + 4.6, hy - 4.2); ctx.lineTo(hx + 2.2, hy + 1.6);
            ctx.moveTo(hx + 4.4, hy - 2); ctx.lineTo(hx + 2.6, hy - 2.6);
            ctx.stroke();
        }
        Art.mouth(ctx, hx, hy + 5.7, 4.4, mood === 'open' ? 'teeth' : (mood === 'dizzy' || mood === 'tired') ? 'o' : 'angry');
        return { hx, hy };
    },
};

// ══════════════════════════════════════════
// ── Normaler Gorilla ──
// ══════════════════════════════════════════

// Kräftiger Gorilla (schwarz, Schlüsselträger grau). Hält 45–150 Einheiten Abstand, springt dann mit
//   angesagtem Zielkreis auf das Ziel oder boxt aus der Nähe. Bei wenig Leben grimmiges Gesicht.
class Gorilla extends Enemy {
    constructor(x, y) {
        super(x, y, 34, 30);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(44, 54);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.fxColor = GorillaCfg.saddle;
        this.seed = Math.random() * 10;
        this.detectionRange = 245;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2.1);
        this.step = 0;
        this.moving = false;
        this.gray = false;              // graues Fell (Schlüsselträger)
        this.aim = null;                // {x, y} Lande- oder Schlagpunkt
        this.lift = 0;
        this.landHit = [];
        this._keyInit = false;
        this._engaged = false;
        this._jumpFrom = null;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.gray ? C_KEY : C_BLACK; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): graues Fell, etwas zäher
            this._keyInit = true;
            this.gray = true;
            this.hp = this.maxHp = 10;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        const air = this.state === 'leapCrouch' || this.state === 'leapAir' || this.state === 'land';
        this.contactDamage = !air;
        if (this.state !== 'leapAir') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('beat', 0.85);   // Drohgebärde (Brusttrommeln), damit Kinder ihn erst einmal sehen
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'beat':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'punchWind':
                if (this.stateT <= 0) {
                    this._punchHit();
                    this._set('punch', 0.18);
                }
                break;
            case 'punch':
                if (this.stateT <= 0) {
                    this.cool = this.gray ? randRange(1, 1.6) : randRange(1.4, 2.2);
                    this._set('walk', 0);
                }
                break;
            case 'leapCrouch':
                if (this.stateT <= 0) {
                    this._jumpFrom = { x: this.x, y: this.y };
                    this._set('leapAir', 0.56);
                }
                break;
            case 'leapAir': this._leap(dt); break;
            case 'land':
                if (this.stateT <= 0) {
                    this.lift = 0;
                    this.cool = randRange(1.3, 2);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, Angriff auswählen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.2;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.25 * dt, Math.cos(this.step * 0.7) * this.speed * 0.25 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 150) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 46) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 6.4;
        } else this.step += dt * 1.6;
        if (this.cool > 0) return;
        if (dist < 74) { this._startPunch(player); return; }
        if (dist > 78 && dist < 205 && this._startLeap(world, player)) return;
        this.cool = 0.55;
    }

    _startPunch(player) {
        const mx = this.centerX(), my = this.centerY();
        let best = null;
        for (const q of GorillaArt.targets(player)) {
            const d = Math.hypot(q.x - mx, q.y - my);
            if (d < 86 && (!best || d < best.d)) best = { q, d };
        }
        this.aim = best ? { x: best.q.x, y: best.q.y } : { x: mx + this.face * 34, y: my };
        if (Math.abs(this.aim.x - mx) > 3) this.face = this.aim.x > mx ? 1 : -1;
        this.landHit = [];
        this._set('punchWind', this.gray ? 0.3 : 0.42);
    }

    // Der Schlag landet genau dort, wo der rote Zielkreis war – er reicht also bis an den Kreis heran.
    _punchHit() {
        const a = this.aim || { x: this.centerX() + this.face * 30, y: this.centerY() };
        GorillaArt.areaHit(a.x, a.y, 28, this.damage + 1, 190, this.landHit);
        GorillaArt.shake(2.6, 0.12);
        GorillaArt.burst(a.x, a.y, [GorillaCfg.skin, '#ffffff', GorillaCfg.leaf], 8, 150, 0.34, { kind: 'spark' });
        GorillaArt.ring(a.x, a.y, GorillaCfg.skin, 28, 0.22, 3.4);
    }

    // true = Sprung angesetzt
    _startLeap(world, player) {
        const t = GorillaArt.leapTarget(world, this, player, 62, 150);
        if (!t) return false;
        this.aim = { x: t.x, y: t.y };
        this.landHit = [];
        this.lift = 0;
        this._set('leapCrouch', this.gray ? 0.4 : 0.52);
        return true;
    }

    _leap(dt) {
        const k = this._k();
        const from = this._jumpFrom || { x: this.x, y: this.y };
        const toX = this.aim.x - this.w / 2, toY = this.aim.y - this.h / 2;
        const e = k * k * (3 - 2 * k);
        this.x = from.x + (toX - from.x) * e;
        this.y = from.y + (toY - from.y) * e;
        this.lift = Math.sin(k * Math.PI) * 34;
        if (Math.abs(toX - this.x) > 3) this.face = toX > this.x ? 1 : -1;
        if (this.stateT <= 0) {
            this.x = toX;
            this.y = toY;
            this.lift = 0;
            this._landHit();
        }
    }

    _landHit() {
        const x = this.centerX(), y = this.y + this.h - 6;
        const R = this.gray ? 40 : 34;
        GorillaArt.areaHit(x, y, R, this.damage + 1, 210, this.landHit);
        GorillaArt.shake(this.gray ? 5.4 : 4.2, 0.2);
        GorillaArt.ring(x, y + 4, '#ffe6b8', R + 12, 0.28, 4.4);
        GorillaArt.burst(x, y, [GorillaCfg.skin, '#e8d8b0', '#ffffff'], 11, 150, 0.42, { kind: 'spark' });
        GorillaArt.burst(x, y, 'rgba(226,212,180,0.8)', 4, 70, 0.45, { kind: 'smoke', size: 5 });
        this._set('land', 0.24);
    }

    // Ansagen am Boden: Zielkreis für Sprung und Schlag (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st === 'leapCrouch' || st === 'leapAir') {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            const R = this.gray ? 40 : 34;
            LateWorldArt.warn(ctx, p.x, p.y, R, this._k(), st === 'leapAir' ? '#ff3d5a' : GorillaCfg.warn);
            if (st === 'leapAir') {
                // Schatten des springenden Gorillas auf dem Boden
                const s = 1 - this.lift / 60;
                ctx.fillStyle = 'rgba(30,26,14,0.3)';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, 15 * s, 6 * s, 0, 0, TAU);
                ctx.fill();
            }
            return;
        }
        if (st === 'punchWind' && this.aim) {
            const p = camera.worldToScreen(this.centerX() + this.face * 24, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 26, this._k(), GorillaCfg.warn);
            return;
        }
        if (st === 'land') {
            const p = camera.worldToScreen(this.centerX(), this.y + this.h - 6);
            Art.ring(ctx, p.x, p.y, 20 + this._k() * 42, '#ffe6b8', 4, 0.7);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 14)) {
                ctx.translate(cx, foot);
                this._body(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot - this.lift);
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 15 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Gorilla mit Fußpunkt (0, 0); Zeichnung in GorillaArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const f = this.face;
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const crouch = st === 'leapCrouch' ? Math.sin(k * Math.PI) * 4 : 0;
        const land = st === 'land' ? Math.sin(k * Math.PI) * 3 : 0;
        const wind = st === 'punchWind' ? k : 0;
        const punch = st === 'punch';
        const beat = st === 'beat' ? Math.sin(t * 17) : 0;
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const air = st === 'leapAir' ? Math.sin(clamp(k, 0, 1) * Math.PI) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.2 : Math.sin(t * 2) * 0.6) - crouch - land + air * 2;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.04 : Math.sin(t * 2) * 0.015) + (crouch + land) * 0.025;
        const hip = -8 - bob;
        // Fäuste: am Boden (Knöchelgang), beim Ausholen über dem Kopf, beim Schlag weit vorn
        let hb = { x: -18, y: -2.5 - Math.max(0, -walk) * 2.5 };
        let hf = { x: 18, y: -2.5 - Math.max(0, walk) * 2.5 };
        if (st === 'leapCrouch' || st === 'land') { hb = { x: -21, y: -2 }; hf = { x: 21, y: -2 }; }
        else if (st === 'leapAir') { hb = { x: -12, y: hip - 34 }; hf = { x: 14, y: hip - 34 }; }
        else if (wind) hf = { x: 9 - wind * 8, y: hip - 26 - wind * 8 };
        else if (punch) hf = { x: 29, y: hip - 14 };
        else if (st === 'beat') { hb = { x: -4.5, y: hip - 16 + beat * 2.5 }; hf = { x: 5.5, y: hip - 16 - beat * 2.5 }; }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(f, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, hip - 12, 26, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (punch || wind || st === 'leapCrouch' || st === 'leapAir') ? 'open'
            : tired ? 'tired' : 'angry';
        GorillaArt.figure(ctx, { c, lw: 1.2, t, bob, walk, hands: { b: hb, f: hf }, mood,
            look: { x: this.look.x * f, y: this.look.y }, leaves: !dead && !this.gray });
        if (punch && !dead) Art.glow(ctx, hf.x, hf.y, 14, '#ffe6b8', 0.45);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESEN-GORILLA (Endgegner Welt 44) ──
// ══════════════════════════════════════════

class BossGiantGorilla extends Enemy {
    constructor(x, y) {
        super(x, y, 96, 88);
        this.hp = 135;
        this.maxHp = 135;
        this.speed = 32;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.phasesThroughWalls = false;
        this.shadow = { rx: 44, ry: 14, dy: 42, alpha: 0.32 };
        this.fxColor = GorillaCfg.saddle;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 1.9;
        this.stateDur = 1.9;
        this.seq = 0;
        this.cool = 0.7;
        this.step = 0;
        this.moving = false;
        this.lift = 0;
        this.aim = null;                // {x, y} Landepunkt des Sprungs
        this._jumpFrom = null;
        this.punchAim = null;           // {x, y} Ziel der Riesenpranke
        this.landHit = [];
        this.waves = [];                // Schockwellen (Landung und Stampfen)
        this.stompLeft = 0;
        this.stompSide = 1;
        this.leapPair = 0;              // zweiter Sprung direkt hintereinander (Phase 2)
        this.bigHits = 0;               // große Angriffe seit dem Phasenwechsel (Schwindel-Pausen)
        this.angry = 0;                 // 0..1 Glühen in Phase 2
    }

    static room(world) { return GorillaArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        this._updateWaves(dt);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 46;
            this.bigHits = 0;
            GorillaArt.burst(mx, my - 16, [GorillaCfg.leaf, '#ffffff', GorillaCfg.saddle], 22, 200, 0.7, { kind: 'star' });
            GorillaArt.ring(mx, my, GorillaCfg.leaf, 104, 0.6, 6);
            GorillaArt.shake(8, 0.45);
        }
        const air = this.state === 'leapCrouch' || this.state === 'leapAir' || this.state === 'land';
        if (!air && this.state !== 'intro') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'leapCrouch':
                if (this.stateT <= 0) {
                    this._jumpFrom = { x: this.x, y: this.y };
                    this._set('leapAir', this.phase === 2 ? 0.82 : 1);
                }
                break;
            case 'leapAir': this._leap(dt, world, player); break;
            case 'land':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'punchWind':
                if (this.stateT <= 0) {
                    this._punchHit();
                    this._set('punch', 0.18);
                }
                break;
            case 'punch':
                if (this.stateT <= 0) {
                    this.punchAim = null;
                    this.cool = this.phase === 2 ? 0.55 : 0.85;
                    this._set('pant', this.cool + 0.3);
                }
                break;
            case 'stompWind':
                if (this.stateT <= 0) this._set('stomp', 0.16);
                break;
            case 'stomp':
                if (this.stateT <= 0) {
                    this._stompHit();
                    this.stompLeft--;
                    this.stompSide = -this.stompSide;
                    if (this.stompLeft > 0) this._set('stompWind', this.phase === 2 ? 0.32 : 0.4);
                    else this._afterBig();
                }
                break;
            case 'dizzy':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        GorillaArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 4.6;
        let vx = 0, vy = 0;
        if (dist > 132) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 72) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool <= 0) this._nextAttack(world, player, dist);
    }

    _nextAttack(world, player, dist) {
        const cyc = this.phase === 2 ? BossGiantGorilla.CYCLE2 : BossGiantGorilla.CYCLE1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'punch' && dist > 104) what = 'leap';       // die Pranke reicht nur von nah
        if (what === 'leap') { if (!this._startLeap(world, player)) this.cool = 0.6; }
        else if (what === 'punch') this._startPunch(player);
        else if (what === 'stomp') this._startStomp();
        else this.cool = this.phase === 2 ? 0.5 : 0.95;          // bewusste Verschnaufpause
    }

    // ── a) Hochsprung mit bebenender Landung ──
    _startLeap(world, player) {
        const t = GorillaArt.leapTarget(world, this, player, 70, 205);
        if (!t) return false;
        this.aim = { x: t.x, y: t.y };
        this.landHit = [];
        this.lift = 0;
        this.leapPair = this.phase === 2 && this.seq % 2 === 0 ? 1 : 0;
        this._set('leapCrouch', this.phase === 2 ? 0.6 : 0.76);
        return true;
    }

    _leap(dt, world, player) {
        const k = this._k();
        const from = this._jumpFrom || { x: this.x, y: this.y };
        // Er zieht unterwegs noch etwas zu Mark hin – der Zielkreis bleibt dabei lesbar.
        if (!player.dead && k < 0.72) {
            const tx = player.x + player.w / 2, ty = player.y + player.h / 2;
            const sp = (this.phase === 2 ? 56 : 42) * dt;
            const ddx = tx - this.aim.x, ddy = ty - this.aim.y;
            const dd = Math.hypot(ddx, ddy) || 1;
            this.aim.x += (ddx / dd) * Math.min(sp, dd);
            this.aim.y += (ddy / dd) * Math.min(sp, dd);
            const room = GorillaArt.room(world);
            if (room) {
                this.aim.x = clamp(this.aim.x, room.x + this.w / 2 + 6, room.x + room.w - this.w / 2 - 6);
                this.aim.y = clamp(this.aim.y, room.y + this.h / 2 + 6, room.y + room.h - this.h / 2 - 6);
            }
        }
        const toX = this.aim.x - this.w / 2, toY = this.aim.y - this.h / 2;
        const e = k * k * (3 - 2 * k);
        this.x = from.x + (toX - from.x) * e;
        this.y = from.y + (toY - from.y) * e;
        this.lift = Math.sin(k * Math.PI) * (this.phase === 2 ? 118 : 102);
        if (Math.abs(toX - this.x) > 4) this.face = toX > this.x ? 1 : -1;
        if (this.stateT <= 0) {
            this.x = toX;
            this.y = toY;
            this.lift = 0;
            this._impact();
        }
    }

    // Landung: Beben, Schaden im Kreis und eine Schockwelle, die nach außen läuft
    _impact() {
        const mx = this.centerX(), my = this.y + this.h - 12;
        const p2 = this.phase === 2;
        const R = p2 ? 74 : 62;
        GorillaArt.shake(11, 0.45);
        GorillaArt.ring(mx, my, '#ffe6b8', R + 34, 0.45, 7);
        GorillaArt.burst(mx, my, [GorillaCfg.furDark, '#e8d8b0', '#ffffff'], 18, 200, 0.55, { kind: 'spark' });
        GorillaArt.burst(mx, my, 'rgba(224,208,176,0.85)', 8, 90, 0.6, { kind: 'smoke', size: 6 });
        GorillaArt.burst(mx, my - 30, [GorillaCfg.leaf, '#9ae86a'], 7, 120, 0.6, { kind: 'star' });
        this.landHit = [];
        GorillaArt.areaHit(mx, my, R, 2, 240, this.landHit);
        this.waves.push({ x: mx, y: my, r: R * 0.7, max: p2 ? 176 : 152, hitP: false, hitC: [] });
        this._set('land', p2 ? 0.3 : 0.38);
        if (this.leapPair > 0) {
            this.leapPair--;
            this._set('leapCrouch', 0.4);       // zweiter Sprung direkt hintereinander
        }
    }

    // ── b) Schlag mit der Riesenpranke ──
    _startPunch(player) {
        const mx = this.centerX(), my = this.centerY();
        let best = null;
        for (const q of GorillaArt.targets(player)) {
            const d = Math.hypot(q.x - mx, q.y - my);
            if (d < 130 && (!best || d < best.d)) best = { q, d };
        }
        const a = best ? Math.atan2(best.q.y - my, best.q.x - mx) : Math.atan2(this.look.y, this.look.x || 1);
        this.punchAim = { x: mx + Math.cos(a) * 62, y: my + Math.sin(a) * 62 };
        if (Math.abs(Math.cos(a)) > 0.2) this.face = Math.cos(a) > 0 ? 1 : -1;
        this.landHit = [];
        this._set('punchWind', this.phase === 2 ? 0.42 : 0.56);
    }

    _punchHit() {
        const p = this.punchAim;
        if (!p) return;
        GorillaArt.areaHit(p.x, p.y, 44, 2, 250, this.landHit);
        GorillaArt.shake(5, 0.18);
        GorillaArt.burst(p.x, p.y, [GorillaCfg.skin, '#ffffff', GorillaCfg.leaf], 12, 180, 0.4, { kind: 'spark' });
        GorillaArt.ring(p.x, p.y, '#ffe6b8', 46, 0.26, 5);
    }

    // ── c) Stampfen mit Schockwelle ──
    _startStomp() {
        this.stompLeft = this.phase === 2 ? 4 : 2;
        this.stompSide = this.face;
        this.landHit = [];
        this._set('stompWind', this.phase === 2 ? 0.36 : 0.48);
    }

    _stompPoint() {
        return { x: this.centerX() + this.stompSide * 30, y: this.y + this.h - 8 };
    }

    _stompHit() {
        const p = this._stompPoint();
        GorillaArt.areaHit(p.x, p.y, 40, 2, 210, this.landHit);
        GorillaArt.shake(6, 0.2);
        GorillaArt.burst(p.x, p.y, [GorillaCfg.furDark, '#e8d8b0', '#ffffff'], 11, 165, 0.4, { kind: 'spark' });
        GorillaArt.ring(p.x, p.y, '#ffb03a', 40, 0.28, 4.4);
        this.waves.push({ x: p.x, y: p.y, r: 26, max: this.phase === 2 ? 148 : 126, hitP: false, hitC: [] });
    }

    // Nach großen Angriffen: Verschnaufpause – und in Phase 2 wird er zwischendurch schwindelig.
    _afterBig() {
        this.bigHits++;
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', this.hp <= this.maxHp * 0.3 ? 2 : 1.6);
            GorillaArt.burst(this.centerX(), this.y + 22, ['#ffe35a', '#ffffff'], 10, 90, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.6 : 0.95;
        this._set('pant', this.cool + 0.4);
    }

    // Schockwellen wachsen nach außen; jeder höchstens einmal, Mark zusätzlich nur ohne Ausweichrolle
    _updateWaves(dt) {
        if (!this.waves.length) return;
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const w of this.waves) {
            w.r += 210 * dt;
            const band = 15;
            for (const t of GorillaArt.targets(player)) {
                if (t.isPlayer) {
                    if (w.hitP || t.ref.stunTimer > 0 || t.ref.dodging) continue;
                    if (Math.abs(Math.hypot(t.x - w.x, t.y - w.y) - w.r) < band + t.w / 2) {
                        w.hitP = true;
                        GorillaArt.hurt(t.ref, 2, Math.atan2(t.y - w.y, t.x - w.x), 190);
                    }
                } else {
                    if (w.hitC.indexOf(t.ref) >= 0 || t.ref.koTimer > 0) continue;
                    if (Math.abs(Math.hypot(t.x - w.x, t.y - w.y) - w.r) < band + Math.max(t.w, t.h) / 2) {
                        w.hitC.push(t.ref);
                        GorillaArt.hitCompanion(t.ref, 2);
                    }
                }
            }
        }
        this.waves = this.waves.filter(w => w.r < w.max);
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const mx = this.centerX(), my = this.centerY();
        this._drawWaves(ctx, camera);
        if (st === 'leapCrouch' || st === 'leapAir') {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            const R = this.phase === 2 ? 74 : 62;
            LateWorldArt.warn(ctx, p.x, p.y, R, this._k(), st === 'leapAir' ? '#ff3d5a' : GorillaCfg.warn);
            if (st === 'leapAir') {
                LateWorldArt.rays(ctx, p.x, p.y, 10, this.seed, R * 0.6, R * (0.75 + 0.45 * this._k()), this._k(), '#ffb03a');
                // Schlagschatten des Riesen auf dem Fels – kleiner, je höher er fliegt
                const s = 1 - this.lift / 240;
                ctx.fillStyle = 'rgba(24,20,10,0.32)';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, 40 * s, 15 * s, 0, 0, TAU);
                ctx.fill();
            }
            return;
        }
        if (st === 'punchWind' && this.punchAim) {
            const p = camera.worldToScreen(this.punchAim.x, this.punchAim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 44, this._k(), GorillaCfg.warn);
            return;
        }
        if (st === 'stompWind') {
            const q = this._stompPoint();
            const p = camera.worldToScreen(q.x, q.y);
            LateWorldArt.warn(ctx, p.x, p.y, 40, this._k(), GorillaCfg.warn);
            Art.ring(ctx, p.x, p.y, this.phase === 2 ? 148 : 126, '#ffb03a', 2, 0.3);
            return;
        }
        if (st === 'land' || st === 'punch' || st === 'stomp') {
            const q = st === 'land' ? { x: mx, y: my + 30 }
                : st === 'punch' ? (this.punchAim || { x: mx, y: my })
                    : this._stompPoint();
            const p = camera.worldToScreen(q.x, q.y);
            Art.ring(ctx, p.x, p.y, 26 + this._k() * 60, '#ffe6b8', 4, 0.7);
        }
    }

    // Die Wellen liegen auf dem Fels und treffen noch, während der Riese schon zum nächsten Sprung
    // oder Schlag ausholt – deshalb zeichnet er sie vor allen frühen Ausstiegen, nie danach.
    _drawWaves(ctx, camera) {
        if (!this.waves.length) return;
        for (const w of this.waves) {
            const c = camera.worldToScreen(w.x, w.y);
            const a = clamp(1 - w.r / w.max, 0.15, 1);
            const prev = ctx.globalAlpha;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(c.x, c.y, w.r, 0, TAU);
            ctx.strokeStyle = '#c8b48a';
            ctx.globalAlpha = prev * a * 0.3;
            ctx.lineWidth = 30;
            ctx.stroke();
            ctx.strokeStyle = '#ffd23f';
            ctx.globalAlpha = prev * a;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 34);
            ctx.translate(cx, foot);
            this._body(ctx, true);
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot - this.lift);
        this._body(ctx, false);
        ctx.restore();
    }

    // Riesen-Gorilla: dieselbe Figur wie die normalen Gorillas, 2,6-mal so groß, mit silbernem
    // Schulterfell und Narbe; Phase 2 mit roten Augen, grünem Zornleuchten und Dampf.
    _body(ctx, dead) {
        const S = 2.6;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const c = C_BLACK;
        const crouch = st === 'leapCrouch' ? Math.sin(k * Math.PI) * 5 : 0;
        const land = st === 'land' ? Math.sin(k * Math.PI) * 3.5 : 0;
        const air = st === 'leapAir' ? Math.sin(clamp(k, 0, 1) * Math.PI) : 0;
        const wind = st === 'punchWind' ? k : 0;
        const punch = st === 'punch';
        const stompK = st === 'stompWind' ? k : (st === 'stomp' ? 1 : 0);
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const beat = st === 'intro' ? Math.sin(t * 13) : 0;
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 1.6) * 0.9) - crouch - land + air * 2.4
            - (rest ? 1.5 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.035 : Math.sin(t * 1.6) * 0.015) + (crouch + land) * 0.02;
        const hip = -8 - bob;
        // Fäuste je Zustand (Einheiten der kleinen Figur)
        const sway = dizzy ? Math.sin(t * 5) * 2 : 0;
        let hb = { x: -18, y: -2.5 - Math.max(0, -walk) * 2.5 };
        let hf = { x: 18, y: -2.5 - Math.max(0, walk) * 2.5 };
        if (st === 'leapCrouch' || st === 'land') { hb = { x: -21, y: -2 }; hf = { x: 21, y: -2 }; }
        else if (st === 'leapAir') { hb = { x: -11, y: hip - 36 }; hf = { x: 13, y: hip - 36 }; }
        else if (wind) hf = { x: 8 - wind * 9, y: hip - 26 - wind * 9 };
        else if (punch) hf = { x: 27, y: hip - 13 };
        else if (st === 'stompWind') { hb = { x: -14, y: hip - 18 - stompK * 14 }; hf = { x: 15, y: hip - 18 - stompK * 14 }; }
        else if (st === 'stomp') { hb = { x: -20, y: -2 }; hf = { x: 20, y: -2 }; }
        else if (st === 'intro') { hb = { x: -4.5, y: hip - 16 + beat * 2.5 }; hf = { x: 5.5, y: hip - 16 - beat * 2.5 }; }
        else if (dizzy) { hb = { x: -17 + sway, y: -4 }; hf = { x: 17 + sway, y: -4 }; }
        // Stampfender Fuß (stompSide ist die Bildschirmseite, die Figur ist nach this.face gespiegelt)
        const legLift = [0, 0];
        if (st === 'stompWind') legLift[this.stompSide * this.face > 0 ? 1 : 0] = 5 * stompK;
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, hip - 16, 32, GorillaCfg.leaf, 0.2 * this.angry + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (punch || wind || st === 'leapCrouch' || st === 'leapAir' || st === 'stompWind') ? 'open'
                : rest ? 'tired' : 'angry';
        const h = GorillaArt.figure(ctx, { c, lw: 0.75, t, bob, walk, hands: { b: hb, f: hf }, legLift, mood,
            look: { x: this.look.x * this.face, y: this.look.y }, headDy: dizzy ? 1.5 : 0,
            silver: true, leaves: !dead, scar: true, red: p2 });
        if (p2 && !dead && !dizzy) Art.glow(ctx, h.hx, h.hy - 0.5, 9, '#ff3b5c', 0.3 + 0.2 * Math.sin(t * 9));
        if (punch && !dead) Art.glow(ctx, hf.x, hf.y, 15, '#ffe6b8', 0.45);
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 1.6 * S * this.face, (hip - 36) * S, 24, 4.6);
        // Zorn-Dampf in Phase 2
        if (p2 && !dizzy && !dead) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.85 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.5;
                ctx.beginPath();
                ctx.arc((i - 1) * 24 + Math.sin(t * 3 + i) * 4, (hip - 46) * S - q * 24, 4 + q * 7, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
    }
}

BossGiantGorilla.CYCLE1 = ['leap', 'punch', 'stomp', 'walk'];
BossGiantGorilla.CYCLE2 = ['leap', 'stomp', 'punch', 'leap', 'walk'];
