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
    chest: '#9c8168',
    keyFur: '#9aa0ae',        // Schluesseltraeger: graues Fell
    keyMid: '#7e8492',
    keyDark: '#616674',
    keySaddle: '#c6cad6',
    keyChest: '#cfd3dd',
    skin: '#b09074',          // Gesicht, Handteller, Fußsohlen
    skinDark: '#8a6c54',
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
        const room = this.room(world);
        if (room) {
            x = clamp(x, room.x + e.w / 2 + 6, room.x + room.w - e.w / 2 - 6);
            y = clamp(y, room.y + e.h / 2 + 6, room.y + room.h - e.h / 2 - 6);
        }
        const r = Math.min(e.w, e.h) * 0.45;
        if (!this.free(world, x, y, r)) return null;
        return { x, y };
    },

    // Rumpf mit Silberrücken und ein, zwei Blättern im Fell
    torso(ctx, by, rx, ry, c, lw, leaves) {
        Art.body(ctx, 0, by, rx, ry, c.fur, { glossy: true, lineWidth: lw });
        Art.body(ctx, -rx * 0.22, by - ry * 0.38, rx * 0.62, ry * 0.5, c.saddle, { highlight: false, lineWidth: lw * 0.7 });
        if (leaves > 0) {
            Art.body(ctx, rx * 0.5, by - ry * 0.72, 2.2 * leaves, 1.5 * leaves, GorillaCfg.leaf, { lineWidth: 0.9 });
            Art.body(ctx, -rx * 0.55, by - ry * 0.2, 1.9 * leaves, 1.3 * leaves, GorillaCfg.leaf, { lineWidth: 0.9 });
        }
    },

    // Gorilla-Kopf: Überaugenwulst, Schnauze mit Nasenlöchern, Knopfaugen.
    // mood: 'angry' | 'open' (Angriff) | 'tired' | 'dizzy' | 'dead'
    face(ctx, hx, hy, s, look, mood) {
        Art.body(ctx, hx, hy, 6.2 * s, 5.4 * s, GorillaCfg.skin, { lineWidth: 1.2 * s });
        Art.body(ctx, hx + 4.4 * s, hy + 2.4 * s, 3.6 * s, 2.6 * s, GorillaCfg.skinDark, { highlight: false, lineWidth: 1 * s });
        ctx.fillStyle = GorillaCfg.furDark;
        for (const dx of [2, 4.8]) {
            ctx.beginPath();
            ctx.arc(hx + dx * s, hy + 2.2 * s, 0.7 * s, 0, TAU);
            ctx.fill();
        }
        ctx.strokeStyle = Art.ink(GorillaCfg.fur);
        ctx.lineWidth = 2 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx - 4.6 * s, hy - 2.2 * s);
        ctx.quadraticCurveTo(hx + 1 * s, hy - 4.4 * s, hx + 6.4 * s, hy - 2 * s);
        ctx.stroke();
        const dead = mood === 'dead';
        if (dead) LateWorldArt.xEyes(ctx, hx + 0.8 * s, hy - 1 * s, 1.7 * s, 2.1 * s);
        else if (mood === 'dizzy') {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.2 * s;
            for (const dx of [-1.2, 2.8]) {
                ctx.beginPath();
                ctx.arc(hx + dx * s, hy - 1 * s, 1.5 * s, 0.25, Math.PI - 0.25);
                ctx.stroke();
            }
        } else {
            for (const dx of [-1.2, 2.8]) {
                Art.eye(ctx, hx + dx * s, hy - 1 * s, 1.7 * s, { x: look.x, y: look.y },
                    {
                        angry: mood !== 'tired', side: dx < 0 ? 'left' : 'right', iris: '#5a3418',
                        open: mood === 'tired' ? 0.5 : 1,
                    });
            }
        }
        Art.mouth(ctx, hx + 2.6 * s, hy + 5.6 * s, 5.4 * s,
            dead ? 'angry' : mood === 'open' ? 'teeth' : mood === 'dizzy' || mood === 'tired' ? 'o' : 'angry');
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
        this.summoner = null;
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
        if (this.summoner && this.summoner.dead) {
            GorillaArt.burst(this.centerX(), this.centerY(), [GorillaCfg.saddle, '#ffffff'], 10, 110, 0.45, { kind: 'star' });
            this.dead = true;
            this.deathTimer = 0.3;
            return;
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
        if (this.summoner) GorillaArt.clampToRoom(this, world);
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

    _punchHit() {
        const a = this.aim || { x: this.centerX() + this.face * 30, y: this.centerY() };
        const f = { x: this.centerX() + this.face * 24, y: a.y };
        GorillaArt.areaHit(f.x, f.y, 26, this.damage + 1, 190, this.landHit);
        GorillaArt.shake(2.6, 0.12);
        GorillaArt.burst(f.x, f.y, [GorillaCfg.skin, '#ffffff', GorillaCfg.leaf], 8, 150, 0.34, { kind: 'spark' });
        GorillaArt.ring(f.x, f.y, GorillaCfg.skin, 26, 0.22, 3.4);
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

    // Gorilla mit Fußpunkt (0, 0)
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const f = this.face;
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const crouch = st === 'leapCrouch' ? Math.sin(k * Math.PI) * 5 : 0;
        const land = st === 'land' ? Math.sin(k * Math.PI) * 4 : 0;
        const wind = st === 'punchWind' ? k : 0;
        const punch = st === 'punch' ? 1 : 0;
        const beat = st === 'beat' ? Math.abs(Math.sin(t * 17)) : 0;
        const walk = this.moving ? Math.sin(this.step * 2) : 0;
        const air = st === 'leapAir' ? Math.sin(clamp(k, 0, 1) * Math.PI) : 0;
        const bob = dead ? 0 : (this.moving ? Math.abs(walk) * 1.8 : Math.sin(t * 2) * 1) - crouch - land + air * 3;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.05 : Math.sin(t * 2) * 0.02) + (crouch + land) * 0.02;
        const by = -17 - bob;
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        // Fußsohlen
        ctx.fillStyle = Art.dark(c.furDark, 0.25);
        ctx.beginPath();
        Kit915.oval(ctx, -7 + walk * 1.8, -1.6, 4.6, 2.4);
        Kit915.oval(ctx, 7 - walk * 1.8, -1.6, 4.6, 2.4);
        ctx.fill();
        ctx.scale(f, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, by - 4, 24, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        // Hinterer Arm (lang, Knöchel am Boden)
        const bk = { x: -11 - wind * 3, y: by + 12 - beat * 3 };
        Art.limb(ctx, -6, by + 2, bk.x, bk.y, 5.2, c.furMid, { lineWidth: 1 });
        Art.body(ctx, bk.x, bk.y, 4, 3.4, GorillaCfg.skinDark, { lineWidth: 1 });
        // Rumpf mit Silberrücken und Brust
        GorillaArt.torso(ctx, by, 15, 12, c, 1.5, dead ? 0 : 1);
        Art.body(ctx, 5, by + 4, 8, 6, c.chest, { highlight: false, lineWidth: 1.1 });
        // Kopf mit Scheitelkamm und Ohr
        const hx = 9, hy = by - 10 + wind * 1.5 - punch * 1.5;
        Art.body(ctx, hx - 1, hy - 5.4, 3.4, 2.4, c.furMid, { lineWidth: 1.1 });
        Art.body(ctx, hx - 6.6, hy - 1, 2.6, 2.6, GorillaCfg.skinDark, { lineWidth: 1 });
        Art.body(ctx, hx, hy, 7.6, 6.8, c.fur, { glossy: true, lineWidth: 1.4 });
        const mood = dead ? 'dead' : (st === 'punch' || st === 'punchWind' || st === 'leapCrouch' || st === 'leapAir') ? 'open'
            : tired ? 'tired' : 'angry';
        GorillaArt.face(ctx, hx + 1.4, hy + 1, 1.15, { x: this.look.x * f, y: this.look.y }, mood);
        // Vorderer Arm: Faust zum Boxen, an die Brust beim Trommeln
        const hand = punch ? { x: 24, y: by + 1 }
            : wind ? { x: 3 - wind * 9, y: by - 3 - wind * 6 }
                : beat ? { x: 4, y: by + 2 - beat * 7 }
                    : { x: 12, y: by + 11 - air * 6 };
        Art.limb(ctx, 6, by + 2, hand.x, hand.y, 5.6, c.fur, { lineWidth: 1.1 });
        Art.body(ctx, hand.x, hand.y, 4.6, 4, GorillaCfg.skin, { lineWidth: 1.2 });
        if (beat > 0.4) Art.ring(ctx, 5, by + 2, 6 + beat * 5, '#ffffff', 1.4, 0.55);
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
        if (typeof Sound !== 'undefined' && Sound.explosion) Sound.explosion();
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

    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const c = C_BLACK;
        const crouch = st === 'leapCrouch' ? Math.sin(k * Math.PI) * 13 : 0;
        const land = st === 'land' ? Math.sin(k * Math.PI) * 9 : 0;
        const air = st === 'leapAir' ? Math.sin(clamp(k, 0, 1) * Math.PI) : 0;
        const wind = st === 'punchWind' ? k : 0;
        const punch = st === 'punch' ? 1 : 0;
        const stompK = st === 'stomp' || st === 'stompWind' ? k : 0;
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const beat = st === 'intro' ? Math.abs(Math.sin(t * 13)) : 0;
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? 0 : (this.moving ? Math.abs(walk) * 2.8 : Math.sin(t * 1.6) * 2.4) - crouch - land + air * 6;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.04 : Math.sin(t * 1.6) * 0.015) + (crouch + land) * 0.012;
        const by = -52 - bob;
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        // Füße: Ferse, helle Fußsohle, Zehen (der stampfende Fuß hebt an und knallt runter)
        for (const s of [-1, 1]) {
            const active = (st === 'stompWind' || st === 'stomp') && s === this.stompSide;
            const lift = active ? (st === 'stomp' ? 0 : 10 * stompK) : 0;
            const fx = s * 21 + walk * 5 * s;
            Art.body(ctx, fx, -6 - lift, 13, 6.5, c.furDark, { lineWidth: 1.8 });
            Art.body(ctx, fx + s * 4, -4 - lift, 8, 4, GorillaCfg.skinDark, { highlight: false, lineWidth: 1.2 });
            ctx.fillStyle = GorillaCfg.skin;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                ctx.moveTo(fx + s * (11 + i * 2.2), -7 - lift - i * 0.4);
                ctx.arc(fx + s * (9.6 + i * 2.2), -7 - lift - i * 0.4, 1.9, 0, TAU);
            }
            ctx.fill();
        }
        ctx.scale(this.face, 1);
        if (p2 && !dead) Art.glow(ctx, 0, by, 84, GorillaCfg.leaf, 0.2 * this.angry + 0.06 * Math.sin(t * 6));
        // Hinterer Arm (lange Pranke, Knöchel am Boden)
        const bk = this._backHand(by, st, stompK, beat);
        Art.limb(ctx, -14, by + 6, bk.x, bk.y, 15, c.furMid, { lineWidth: 1.6 });
        Art.body(ctx, bk.x, bk.y, 11, 9, GorillaCfg.skinDark, { lineWidth: 1.5 });
        // Rumpf mit Silberrücken und Brust
        GorillaArt.torso(ctx, by, 40, 33, c, 2.4, dead ? 0 : 1.8);
        Art.body(ctx, 13, by + 12, 22, 16, GorillaCfg.chest, { highlight: false, lineWidth: 1.6 });
        // Liane als Band mit Edelstein – Merkmal des Endgegners
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-30, by - 6);
        ctx.quadraticCurveTo(0, by + 16 + Math.sin(t * 2) * 1.5, 32, by - 2);
        ctx.strokeStyle = Art.ink(GorillaCfg.vine);
        ctx.lineWidth = 8.5;
        ctx.stroke();
        ctx.strokeStyle = GorillaCfg.vine;
        ctx.lineWidth = 6;
        ctx.stroke();
        Art.body(ctx, 2, by + 13, 5.4, 5.4, p2 ? '#ff4d3d' : GorillaCfg.gem, { lineWidth: 1.2, glossy: true });
        if (!dead && p2) Art.glow(ctx, 2, by + 13, 24, '#ff4d3d', 0.4 + 0.25 * Math.sin(t * 8));
        // Blätter im Fell (Dschungel)
        Art.body(ctx, -22, by - 24, 3.4, 2.2, GorillaCfg.leaf, { lineWidth: 1 });
        Art.body(ctx, -6, by - 32, 3, 2, GorillaCfg.leaf, { lineWidth: 1 });
        // Kopf
        const hx = 22 - wind * 3 + punch * 3, hy = by - 32 + wind * 4 - punch * 2 + (dizzy ? 6 : 0);
        Art.body(ctx, hx - 3, hy - 20, 9, 6, c.furMid, { lineWidth: 1.6 });       // Scheitelkamm
        Art.body(ctx, hx - 20, hy - 2, 7, 7, GorillaCfg.skinDark, { lineWidth: 1.4 });  // Ohr
        Art.body(ctx, hx, hy, 19, 17, c.fur, { glossy: true, lineWidth: 2.1 });
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (punch || st === 'punchWind' || st === 'leapCrouch' || st === 'leapAir') ? 'open'
                : rest ? 'tired' : 'angry';
        GorillaArt.face(ctx, hx + 4, hy + 3, 3, { x: this.look.x * this.face, y: this.look.y }, mood);
        if (p2 && !dead && !dizzy) Art.glow(ctx, hx + 4, hy - 1, 22, '#ff3b5c', 0.35 + 0.25 * Math.sin(t * 9));
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, hx + 2, hy - 28, 24, 4.6);
        // Vorderer Arm (Schlag-, Stampf- und Trommelhaltung)
        const fh = this._frontHand(by, st, stompK, wind, beat, punch);
        Art.limb(ctx, 16, by + 4, fh.x, fh.y, 16, c.fur, { lineWidth: 1.8 });
        Art.body(ctx, fh.x, fh.y, 13, 11, GorillaCfg.skin, { lineWidth: 1.6 });
        if (punch && !dead) Art.glow(ctx, fh.x, fh.y, 40, '#ffe6b8', 0.4);
        if (beat > 0.05 && !dead) Art.ring(ctx, 8, by + 6, 12 + beat * 14, '#ffffff', 2, 0.5);
        ctx.restore();
        // Zorn-Dampf in Phase 2
        if (p2 && !dizzy && !dead) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.85 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.5;
                ctx.beginPath();
                ctx.arc((i - 1) * 24 + Math.sin(t * 3 + i) * 4, by - 84 - q * 24, 4 + q * 7, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
    }

    // Hintere Faust (Knöchel am Boden; hebt beim Stampfen und Trommeln an)
    _backHand(by, st, stompK, beat) {
        if (st === 'stomp' || st === 'stompWind') return { x: -26, y: by + 2 - 14 * stompK };
        if (st === 'leapCrouch' || st === 'leapAir') return { x: -30, y: by + 18 };
        if (beat > 0.05) return { x: -8, y: by + 6 - beat * 16 };
        return { x: -26, y: by + 32 };
    }

    // Vordere Faust: holt aus, schlägt nach vorn, trommelt auf die Brust
    _frontHand(by, st, stompK, wind, beat, punch) {
        if (st === 'leapCrouch' || st === 'leapAir') return { x: 30, y: by + 20 };
        if (st === 'punchWind') return { x: 14 - wind * 26, y: by - 16 - wind * 14 };
        if (punch) return { x: 62, y: by + 8 };
        if (st === 'stomp' || st === 'stompWind') return { x: 26, y: by + 2 - 12 * stompK };
        if (beat > 0.05) return { x: 12, y: by + 4 - beat * 18 };
        return { x: 26, y: by + 34 };
    }
}

BossGiantGorilla.CYCLE1 = ['leap', 'punch', 'stomp', 'walk'];
BossGiantGorilla.CYCLE2 = ['leap', 'stomp', 'punch', 'leap', 'walk'];
