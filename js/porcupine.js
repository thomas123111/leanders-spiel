// ── Welt 43: Stachelwald (Idee von Leander) ──
// Stachelschweine mit Bogen. Sie zupfen sich selbst einen Stachel vom Rücken (an der Stelle fehlt er kurz),
//   legen ihn auf die Sehne und schießen ihn auf Mark oder einen seiner Freunde. Vor jedem Schuss zeigt eine
//   Warnlinie 0,6 s, wohin der Stachel fliegt, damit Kinder ausweichen können. Ab und zu kommen zwei Stacheln
//   kurz hintereinander. Ein Tier trägt den Schlüssel (isKeyGhost setzt main.js nach dem Erzeugen).
// Boss: RIESEN-STACHELSCHWEIN – Endgegner von Welt 43, bleibt im Boss-Raum, 132 LP, zwei Phasen.
//   Bogen­salve: zupft mehrere Stacheln und schießt sie als Fächer oder gezielt auf Mark und die Freunde.
//   Einroll-Sprung: rollt sich zur Stachelkugel ein (dreht sich), springt hoch (Schatten bleibt am Boden,
//     Warnkreis wandert zu Mark), landet und verspritzt die Stacheln im Kreis mit Lücken zum Draufhalten.
//     Danach rollt es sich aus und ist kurz kahl und erschöpft – Zeit zum Zurückhauen.
//   Phase 2 (halbe LP): Stacheln glühen, zwei Sprünge hintereinander, dichtere Ringe, schnellere Salven.
//   Gerufene Jungtiere: höchstens 4 gleichzeitig, nur im Boss-Raum, verpuffen beim Bosstod.
//   Freunde verschwinden nie: ein tödlicher Treffer haut Juri und das Krokodil nur um (knockOut).

const PorcuCfg = {
    fur: '#8a5a34',        // braunes Fell
    furDark: '#5b3a1f',
    belly: '#d9ab77',
    face: '#b07c4e',
    snout: '#e8c79a',
    quill: '#f7ead0',      // helle Stacheln …
    quillTip: '#33200f',   // … mit dunklen Spitzen
    quillHot: '#ffb03a',   // gluende Stacheln (Phase 2)
    bow: '#b47a35', bowInk: '#4a2c10', string: '#f2e6c8',
    warn: '#ff5a3d',
    cap: 54                // höchstens so viele Stacheln gleichzeitig unterwegs (Handy-Leistung)
};

const PorcuArt = {
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
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [PorcuCfg.quill, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse und gerufene Jungtiere verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    lineClear(world, ax, ay, bx, by) {
        if (typeof Juri !== 'undefined' && Juri.lineClear) return Juri.lineClear(world, ax, ay, bx, by);
        return true;
    },

    // Stachel vom Stapel – mit Obergrenze, damit auf dem Handy nie zu viele zugleich fliegen.
    quill(x, y, angle, speed, o) {
        const list = typeof Game !== 'undefined' ? Game.projectiles : null;
        if (!list) return null;
        let n = 0;
        for (let i = 0; i < list.length; i++) if (list[i] && list[i].isQuill && !list[i].dead) n++;
        if (n >= PorcuCfg.cap) return null;
        const p = new PorcuQuill(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, o);
        list.push(p);
        return p;
    },

    // Stachelborsten als Büschel: ein Pfad für die hellen Schäfte, einer für die dunklen Spitzen.
    bristles(ctx, cx, cy, r0, len, angles, gaps, o) {
        const lw = o.width || 3.4;
        const hot = o.hot || 0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < angles.length; i++) {
            if (gaps && gaps[i] > 0) continue;
            const a = angles[i];
            ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        }
        ctx.strokeStyle = Art.ink(o.color || PorcuCfg.quill);
        ctx.lineWidth = lw + 1.7;
        ctx.stroke();
        ctx.strokeStyle = hot > 0 ? Art.mix(PorcuCfg.quill, PorcuCfg.quillHot, hot) : (o.color || PorcuCfg.quill);
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i < angles.length; i++) {
            if (gaps && gaps[i] > 0) continue;
            const a = angles[i];
            ctx.moveTo(cx + Math.cos(a) * (r0 + len * 0.55), cy + Math.sin(a) * (r0 + len * 0.55));
            ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        }
        ctx.strokeStyle = hot > 0 ? Art.mix(PorcuCfg.quillTip, '#ff5a1f', hot) : (o.tip || PorcuCfg.quillTip);
        ctx.lineWidth = Math.max(1.4, lw * 0.62);
        ctx.stroke();
    },

    // Bogen: Biegebaum in Schussrichtung +x, Sehne mit Zug pull (0..1).
    bow(ctx, x, y, angle, s, pull) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(-pull * s * 0.55, 0);
        ctx.lineTo(0, s);
        ctx.strokeStyle = Art.ink(PorcuCfg.string);
        ctx.lineWidth = Math.max(1, s * 0.22);
        ctx.stroke();
        ctx.strokeStyle = PorcuCfg.string;
        ctx.lineWidth = Math.max(0.7, s * 0.12);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-s * 0.55, 0, s * 1.15, -1.12, 1.12);
        ctx.strokeStyle = PorcuCfg.bowInk;
        ctx.lineWidth = Math.max(1.6, s * 0.34);
        ctx.stroke();
        ctx.strokeStyle = PorcuCfg.bow;
        ctx.lineWidth = Math.max(1, s * 0.2);
        ctx.stroke();
        if (pull > 0.15) {
            ctx.beginPath();
            ctx.moveTo(-pull * s * 0.55, 0);
            ctx.lineTo(s * 0.55, 0);
            ctx.strokeStyle = PorcuCfg.quill;
            ctx.lineWidth = Math.max(1.2, s * 0.16);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(s * 0.25, 0);
            ctx.lineTo(s * 0.62, 0);
            ctx.strokeStyle = PorcuCfg.quillTip;
            ctx.lineWidth = Math.max(1, s * 0.13);
            ctx.stroke();
        }
        ctx.restore();
    },

    // Knopfaugen: kleine dunkle Knöpfe mit hellem Glanzpunkt (starr = besiegt).
    knobEyes(ctx, x, y, gap, r, look, dead, angry) {
        if (dead) { LateWorldArt.xEyes(ctx, x, y, r * 0.95, gap); return; }
        const lx = (look && look.x ? look.x : 0) * r * 0.4;
        const ly = (look && look.y ? look.y : 0) * r * 0.3;
        for (const s of [-1, 1]) {
            Art.body(ctx, x + s * gap + lx, y + ly, r, r, '#241408', { highlight: false, lineWidth: 0.8 });
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x + s * gap + lx - r * 0.32, y + ly - r * 0.34, Math.max(0.5, r * 0.3), 0, TAU);
            ctx.fill();
        }
        if (angry) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                ctx.moveTo(x + s * (gap + r * 1.5), y - r * 1.9);
                ctx.lineTo(x + s * (gap - r * 0.7), y - r * 1.0);
            }
            ctx.stroke();
        }
    }
};

// ══════════════════════════════════════════
// ── Stachelgeschoss (von Gegner UND Boss benutzt) ──
// ══════════════════════════════════════════

// Abgeschossener Stachel: heller Schaft, dunkle Spitze, dreht sich in Flugrichtung.
// Trafft auch die Freunde (hitsCompanions -> main.js betäubt sie kurz, sie verschwinden nie).
class PorcuQuill extends Projectile {
    constructor(x, y, vx, vy, o = {}) {
        super(x, y, vx, vy, o.damage || 1, 'enemy', o.knockback || 110);
        this.hitsCompanions = true;
        this.stunTime = o.stun || 1;
        this.radius = o.radius || 5;
        this.lifetime = o.life || 2.7;
        this.color = o.color || PorcuCfg.quill;
        this.tip = o.tip || PorcuCfg.quillTip;
        this.glowColor = o.glow || '#ffd9a0';
        this.strong = !!o.strong;   // Boss-Stachel: dicker und etwas länger
        this.isQuill = true;
        this.wob = Math.random() * TAU;
    }

    update(dt, world) {
        super.update(dt, world);
        this.wob += dt * 9;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const a = Math.atan2(this.vy, this.vx);
        const L = this.strong ? 15 : 11.5;
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(a);
        Art.glow(ctx, 0, 0, L * 1.6, this.glowColor, this.strong ? 0.55 : 0.38);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-L * 0.8, 0);
        ctx.lineTo(L * 0.4, 0);
        ctx.strokeStyle = Art.ink(this.color);
        ctx.lineWidth = this.strong ? 5.2 : 4.2;
        ctx.stroke();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.strong ? 3.1 : 2.3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(L * 0.12, 0);
        ctx.lineTo(L, 0);
        ctx.strokeStyle = this.tip;
        ctx.lineWidth = this.strong ? 3.4 : 2.5;
        ctx.stroke();
        // federartiger Ansatz, leicht flatternd
        const w = Math.sin(this.wob) * 1.2;
        ctx.beginPath();
        ctx.moveTo(-L * 0.85, w - 2.4);
        ctx.lineTo(-L * 0.3, 0);
        ctx.lineTo(-L * 0.85, w + 2.4);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Normales Stachelschwein ──
// ══════════════════════════════════════════

// Rundliches braunes Stachelschwein mit Holzbogen. Hält 95–165 Einheiten Abstand, zupft einen Stachel ab
//   (0,34 s Ausholen), legt ihn auf die Sehne (0,6 s Warnlinie) und schießt. Manchmal zwei kurz hintereinander.
//   Gerufene Jungtiere (this.summoner) verpuffen mit dem Boss und bleiben im Boss-Raum.
class Porcupine extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 26);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(40, 50);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.fxColor = PorcuCfg.quill;
        this.seed = Math.random() * 10;
        this.tint = randRange(-8, 10);            // eigene Fellnuance (nur Darstellung)
        this.detectionRange = 235;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.8, 2.2);
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.strafeT = randRange(0.9, 2);
        this.spikes = [-2.62, -2.05, -1.55, -1.05, -0.48];  // Blickwinkel der 5 Rückenstacheln
        this.gaps = [0, 0, 0, 0, 0];                        // > 0 = Stachel fehlt noch (Nachwachse-Zeit)
        this.aim = null;                                    // {x, y} festgelegtes Ziel (Warnlinie)
        this.aimK = 0;
        this.drawK = 0;
        this.pluckI = -1;
        this.second = false;
        this.summoner = null;
        this.moving = false;
        this._keyInit = false;
        this.step = 0;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): etwas zäher
            this._keyInit = true;
            this.hp = this.maxHp = 9;
        }
        // Gerufene Jungtiere verpuffen mit ihrem Boss
        if (this.summoner && this.summoner.dead) {
            PorcuArt.burst(this.centerX(), this.centerY(), [PorcuCfg.quill, '#ffffff'], 10, 110, 0.45, { kind: 'star' });
            this.dead = true;
            this.deathTimer = 0.3;
            return;
        }
        for (let i = 0; i < this.gaps.length; i++) if (this.gaps[i] > 0) this.gaps[i] -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.aimK = 0;
        this.drawK = 0;
        this.moving = false;
        if (this.state === 'aim') {
            this.aimK = this._k();
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this._fire(projectiles);
                if (this.second) {
                    this.second = false;
                    if (this._pluck()) this._set('aim', 0.45);
                    else this._set('rest', randRange(1.3, 2));
                } else {
                    this._set('rest', randRange(1.4, 2.3));
                }
            }
            this.look.x = dx / dist;
            this.look.y = dy / dist;
            if (this.aim) {
                this.drawK = 1;
                if (Math.abs(this.aim.x - mx) > 3) this.face = this.aim.x > mx ? 1 : -1;
            }
            if (this.summoner) PorcuArt.clampToRoom(this, world);
            return;
        }
        if (this.state === 'pluck') {
            this.drawK = this._k();
            this.stateT -= dt;
            this.look.x = dx / dist;
            this.look.y = dy / dist;
            if (this.stateT <= 0) {
                this.aim = this._pickTarget(world, player, px, py);
                this._set('aim', 0.6);
            }
            if (this.summoner) PorcuArt.clampToRoom(this, world);
            return;
        }
        if (this.state === 'rest') {
            this.stateT -= dt;
            this.drawK = Math.max(0, 1 - this._k() * 2.2);
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (this.stateT <= 0) this._set('walk', 0);
            if (this.summoner) PorcuArt.clampToRoom(this, world);
            return;
        }

        // ── walk: Abstand halten, Ziel suchen ──
        const engaged = !player.dead && (this.summoner || dist < this.detectionRange);
        if (engaged) {
            this.cool -= dt;
            let vx = 0, vy = 0;
            if (dist > 165) { vx = dx / dist; vy = dy / dist; }
            else if (dist < 95) { vx = -dx / dist; vy = -dy / dist; }
            else {
                this.strafeT -= dt;
                if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = randRange(0.9, 2); }
                vx = (-dy / dist) * this.strafe;
                vy = (dx / dist) * this.strafe;
            }
            this._moveWithCollision(vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 7;
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 8);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 8);
            if (this.cool <= 0 && dist < 215) {
                const t = this._pickTarget(world, player, px, py, true);
                if (t.clear) {
                    this.second = Math.random() < (this.isKeyGhost ? 0.55 : 0.3);
                    if (this._pluck()) this._set('pluck', 0.34);
                    else this.cool = 0.7;
                } else {
                    this.cool = 0.6;
                }
            }
        } else {
            this.cool = Math.max(this.cool, 0.5);
            this.strafeT -= dt;
            if (this.strafeT <= 0) {
                this.strafeT = randRange(1.4, 3);
                this.strafe = Math.random() < 0.5 ? 1 : -1;
            }
            this._moveWithCollision(this.strafe * this.speed * 0.3 * dt, Math.sin(this.step + this.seed) * 8 * dt, world);
            this.step += dt * 2.4;
        }
        if (this.summoner) PorcuArt.clampToRoom(this, world);
    }

    // Zupft einen wachsenden Stachel ab. true = hat geklappt.
    _pluck() {
        const free = [];
        for (let i = 0; i < this.gaps.length; i++) if (this.gaps[i] <= 0) free.push(i);
        if (!free.length) return false;
        this.pluckI = free[Math.floor(Math.random() * free.length)];
        this.gaps[this.pluckI] = randRange(2.2, 3.2);
        PorcuArt.burst(this.centerX() - this.face * 6, this.centerY() - 12, [PorcuCfg.quill, '#ffffff'], 4, 60, 0.3, { kind: 'spark' });
        return true;
    }

    // Ziel: meist Mark, manchmal ein Freund – aber nur, wenn eine klare Schussbahn frei ist.
    _pickTarget(world, player, px, py, checkOnly) {
        const mx = this.centerX(), my = this.centerY() - 6;
        const comps = PorcuArt.companions();
        let usePlayer = !player.dead && PorcuArt.lineClear(world, mx, my, px, py);
        if (usePlayer && comps.length) usePlayer = Math.random() < 0.6;
        if (usePlayer) {
            if (checkOnly) return { clear: true };
            return { x: px, y: py };
        }
        const order = comps.slice();
        for (let k = order.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            const tmp = order[k];
            order[k] = order[j];
            order[j] = tmp;
        }
        for (const c of order) {
            const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
            if (PorcuArt.lineClear(world, mx, my, cx, cy)) {
                if (checkOnly) return { clear: true };
                return { x: cx, y: cy };
            }
        }
        if (checkOnly) return { clear: false };
        return { x: px, y: py };
    }

    _hand() {
        return { x: this.centerX() + this.face * 11, y: this.centerY() - 3 };
    }

    _fire(projectiles) {
        const h = this._hand();
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!this.aim || !list) { this.aim = null; return; }
        let a = Math.atan2(this.aim.y - h.y, this.aim.x - h.x);
        const shots = this.isKeyGhost ? [-0.16, 0.16] : [0];
        for (const off of shots) PorcuArt.quill(h.x, h.y, a + off, 168, { stun: 0.9 });
        if (Math.abs(this.aim.x - this.centerX()) > 3) this.face = this.aim.x > this.centerX() ? 1 : -1;
        PorcuArt.burst(h.x + this.face * 6, h.y, [PorcuCfg.quill, '#ffffff'], 4, 90, 0.28, { kind: 'spark' });
        this.aim = null;
    }

    // Warnlinie am Boden: 0,6 s bevor der Stachel fliegt, genau dort entlang.
    drawUnder(ctx, camera) {
        if (this.dead || this.state !== 'aim' || !this.aim) return;
        const h = this._hand();
        const p = camera.worldToScreen(h.x, h.y);
        const q = camera.worldToScreen(this.aim.x, this.aim.y);
        const len = Math.hypot(q.x - p.x, q.y - p.y);
        if (len < 6) return;
        const a = Math.atan2(q.y - p.y, q.x - p.x);
        const prev = ctx.globalAlpha;
        ctx.strokeStyle = PorcuCfg.warn;
        ctx.lineCap = 'round';
        ctx.globalAlpha = prev * (0.16 + 0.14 * this.aimK);
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
        ctx.stroke();
        ctx.globalAlpha = prev * (0.45 + 0.45 * Math.abs(Math.sin(Art.time * 13)));
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let d = (Art.time * 90) % 18; d < len - 6; d += 18) {
            ctx.moveTo(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
            ctx.lineTo(p.x + Math.cos(a) * (d + 9), p.y + Math.sin(a) * (d + 9));
        }
        ctx.stroke();
        ctx.globalAlpha = prev;
        Art.ring(ctx, q.x, q.y, 8 + 5 * this.aimK, PorcuCfg.warn, 1.8, 0.5 + 0.4 * this.aimK);
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 12)) {
                ctx.translate(cx, foot);
                this._body(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 14 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Stachelschwein mit Fußpunkt (0, 0)
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const f = this.face;
        const aim = this.aimK;
        const pluck = this.state === 'pluck' ? this._k() : 0;
        const rest = this.state === 'rest' ? clamp(1 - this._k() * 1.4, 0, 1) : 0;
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? 0 : (this.moving ? Math.abs(walk) * 1.6 : Math.sin(t * 2.4) * 0.9);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.05 : Math.sin(t * 2.4) * 0.02) + rest * 0.08;
        const by = -13 - bob;
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        // Fußstapfen
        ctx.fillStyle = Art.dark(PorcuCfg.furDark, 0.25);
        ctx.beginPath();
        Kit915.oval(ctx, -6 + walk * 1.6, -1.4, 4, 2.1);
        Kit915.oval(ctx, 6 - walk * 1.6, -1.4, 4, 2.1);
        ctx.fill();
        ctx.scale(f, 1);
        // Stachelbüschel hinter dem Körper (5 Borsten, fehlende wachsen nach)
        PorcuArt.bristles(ctx, -2, by, 8.5, 13, this.spikes, this.gaps, { width: 3.6 });
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, by - 6, 22, '#ffd23f', 0.32 + 0.1 * Math.sin(t * 3));
        // Körper
        Art.body(ctx, 0, by, 14, 11, `hsl(${28 + this.tint}, 44%, ${dead ? 34 : 40}%)`, { glossy: true, lineWidth: 1.5 });
        Art.body(ctx, 1, by + 5.5, 8.5, 5, PorcuCfg.belly, { highlight: false, lineWidth: 1.1 });
        // Kopf mit Rüsselchen
        const hx = 10.5, hy = by - 2 + (pluck > 0 ? -1.5 * pluck : 0);
        Art.body(ctx, hx, hy, 6.6, 5.8, PorcuCfg.face, { lineWidth: 1.4 });
        Art.body(ctx, hx + 5.4, hy + 1.6, 4.2, 3.1, PorcuCfg.snout, { lineWidth: 1.2 });
        ctx.fillStyle = '#3a2312';
        ctx.beginPath();
        ctx.arc(hx + 8.4, hy + 1.2, 1, 0, TAU);
        ctx.fill();
        Art.body(ctx, hx - 3.6, hy - 5, 2.2, 2, PorcuCfg.face, { lineWidth: 1 });
        PorcuArt.knobEyes(ctx, hx + 1.4, hy - 1.4, 2.6, 1.9, { x: this.look.x * f, y: this.look.y }, dead, !dead);
        if (!dead) Art.mouth(ctx, hx + 3.4, hy + 3.4, 3.4, this.state === 'aim' ? 'o' : 'smile');
        // Vorderlauf mit Bogen (zielend in Schussrichtung), Hinterlaufgreift nach hinten zum Zupfen
        const aimA = this.aim ? Math.atan2(this.aim.y - (this.centerY() - 3), (this.aim.x - this.centerX()) * f) : (aim > 0 ? 0 : -0.35);
        const handX = 12 + pluck * -9 + aim * 2, handY = by + 2 - pluck * 3 - aim * 4;
        Art.limb(ctx, 3, by + 4, handX, handY, 3, PorcuCfg.face, { lineWidth: 1 });
        if (pluck > 0.1) {
            Art.limb(ctx, -3, by + 4, -12 - pluck * 3, by - 6 - pluck * 3, 2.6, PorcuCfg.face, { lineWidth: 1 });
            if (this.pluckI >= 0 && this.gaps[this.pluckI] > 2.2) {
                Art.body(ctx, -8, by - 9, 1.6, 1.6, PorcuCfg.snout, { lineWidth: 0.9 });
            }
        }
        PorcuArt.bow(ctx, handX, handY, aim > 0 || pluck > 0 ? aimA : -0.5, 10, Math.max(aim, pluck * 0.4));
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESEN-STACHELSCHWEIN (Endgegner Welt 43) ──
// ══════════════════════════════════════════

class BossGiantPorcupine extends Enemy {
    constructor(x, y) {
        super(x, y, 92, 82);
        this.hp = 132;
        this.maxHp = 132;
        this.speed = 30;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.phasesThroughWalls = false;
        this.shadow = { rx: 42, ry: 13, dy: 40, alpha: 0.32 };
        this.fxColor = PorcuCfg.quill;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 1.8;
        this.stateDur = 1.8;
        this.seq = 0;
        this.cool = 0.6;
        this.spikes = [];
        for (let i = 0; i < 16; i++) this.spikes.push(-Math.PI * 0.99 + (i * Math.PI * 1.08) / 15);
        this.gaps = new Array(16).fill(0);
        this.toPluck = 0;
        this.pluckTick = 0;
        this.shots = [];
        this.fan = false;
        this.spin = 0;
        this.spinRate = 0;
        this.lift = 0;
        this.landX = 0;
        this.landY = 0;
        this.fromX = 0;
        this.fromY = 0;
        this.ringOff = 0;
        this.leapPair = 0;
        this.landHit = [];
        this.summoned = [];
        this.summonT = 6;
        this.moving = false;
        this.step = 0;
        this.aimK = 0;
        this.hots = 0;   // 0..1 Glühen der Stacheln
    }

    static room(world) { return PorcuArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const p2 = this.phase === 2;
        this.hots += ((p2 ? 1 : 0) - this.hots) * Math.min(1, dt * 3);
        for (let i = 0; i < this.gaps.length; i++) if (this.gaps[i] > 0) this.gaps[i] -= dt;
        if (this.summonT > 0) this.summonT -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 44;
            PorcuArt.burst(mx, my - 10, [PorcuCfg.quillHot, '#ff5a1f', '#ffffff'], 22, 200, 0.7, { kind: 'star' });
            PorcuArt.ring(mx, my, PorcuCfg.quillHot, 96, 0.6, 6);
            PorcuArt.shake(7, 0.45);
        }
        // Helfer rufen: höchstens 4 Jungtiere gleichzeitig, nur im Boss-Raum, verpuffen mit dem Boss
        if (this.summonT <= 0 && enemies) {
            this.summonT = p2 ? 7 : 9.5;
            let alive = 0;
            for (const m of this.summoned) if (!m.dead) alive++;
            const want = Math.min(2, 4 - alive);
            for (let i = 0; i < want; i++) {
                const m = Kit915.summon(this, Porcupine, enemies, world, Math.random() * TAU, 66, 4);
                if (m) {
                    m.summoner = this;
                    m.hp = m.maxHp = 5;
                    this.summoned.push(m);
                }
            }
        }
        if (this.state !== 'intro' && this.state !== 'curl' && this.state !== 'leap') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.spin += this.spinRate * dt;
        this.aimK = this.state === 'aim' || this.state === 'volleyAim' ? this._k() : 0;
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, dist, dx, dy, player); break;
            case 'volleyAim': this._volleyAim(dt, player, list, world); break;
            case 'volley': this._volley(dt, list); break;
            case 'curl':
                this.spinRate = Math.min(p2 ? 22 : 15, this.spinRate + 34 * dt);
                if (this.stateT <= 0) this._startLeap(world, player);
                break;
            case 'leap': this._leap(dt, world, player); break;
            case 'land':
                this.spinRate *= Math.exp(-6 * dt);
                if (this.stateT <= 0) this._set('unroll', p2 ? 0.55 : 0.7);
                break;
            case 'unroll':
                this.spinRate = Math.max(0, this.spinRate - 22 * dt);
                if (this.stateT <= 0) this._set('tired', p2 ? 1.1 : 1.6);
                break;
            case 'tired':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default:
                this._set('walk', 0);
        }
        PorcuArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, Abstand halten ──
    _walk(dt, world, dist, dx, dy, player) {
        this.spinRate *= Math.exp(-5 * dt);
        this.moving = true;
        this.step += dt * 5;
        let vx = 0, vy = 0;
        if (dist > 150) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 66) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = -dy / dist * (this.seed > 5 ? 1 : -1); vy = dx / dist * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool <= 0 && !player.dead) this._nextAttack();
    }

    _nextAttack() {
        const cyc = this.phase === 2 ? BossGiantPorcupine.CYCLE2 : BossGiantPorcupine.CYCLE1;
        const what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'volley') { this._startVolley(); return; }
        if (what === 'walk') {
            this.cool = this.phase === 2 ? 0.6 : 1.1;   // bewusste Verschnaufpause
            return;
        }
        {
            this.leapPair = this.phase === 2 ? 1 : 0;
            this._set('curl', this.phase === 2 ? 0.8 : 1);
        }
    }

    // ── a) Bogen­salve ──
    _startVolley() {
        this.toPluck = this.phase === 2 ? 5 : 3;
        this.pluckTick = 0;
        this.shots = [];
        this.fan = Math.random() < 0.45;
        this._set('volleyAim', this.phase === 2 ? 0.75 : 0.95);
    }

    _muzzle() {
        return { x: this.centerX() + this.face * 26, y: this.centerY() - 12 };
    }

    _pluckOne() {
        const free = [];
        for (let i = 0; i < this.gaps.length; i++) if (this.gaps[i] <= 0) free.push(i);
        if (!free.length) return;
        const i = free[Math.floor(Math.random() * free.length)];
        this.gaps[i] = randRange(2.4, 3.6);
        const a = this.spikes[i];
        PorcuArt.burst(this.centerX() + Math.cos(a) * 26, this.centerY() - 18 + Math.sin(a) * 22,
            [PorcuCfg.quill, '#ffffff'], 4, 70, 0.3, { kind: 'spark' });
    }

    _volleyAim(dt, player, list, world) {
        this.pluckTick -= dt;
        if (this.pluckTick <= 0 && this.toPluck > 0) {
            this.pluckTick = 0.16;
            this.toPluck--;
            this._pluckOne();
        }
        if (this.stateT <= 0.34 && !this.shots.length) this._lockShots(world, player);
        if (this.stateT <= 0) this._set('volley', 0.3);
    }

    // Richtungen festlegen (Warnlinien stehen dann still – Kinder können ausweichen)
    _lockShots(world, player) {
        const m = this._muzzle();
        const out = [];
        const comps = PorcuArt.companions().slice(0, 2);
        const targets = [];
        if (!player.dead) targets.push({ x: player.x + player.w / 2, y: player.y + player.h / 2 });
        for (const c of comps) targets.push({ x: c.x + (c.w || 20) / 2, y: c.y + (c.h || 20) / 2 });
        if (this.fan || targets.length < 2) {
            const a0 = Math.atan2(targets.length ? targets[0].y - m.y : 0, targets.length ? targets[0].x - m.x : 1);
            const n = this.phase === 2 ? 7 : 5;
            for (let i = 0; i < n; i++) out.push({ a: a0 + (i - (n - 1) / 2) * 0.2 });
        } else {
            for (const tg of targets) {
                if (!PorcuArt.lineClear(world, m.x, m.y, tg.x, tg.y)) continue;
                out.push({ a: Math.atan2(tg.y - m.y, tg.x - m.x) });
            }
            if (!out.length) {
                const a0 = Math.atan2(targets[0].y - m.y, targets[0].x - m.x);
                out.push({ a: a0 - 0.1 }, { a: a0 + 0.1 });
            }
        }
        const room = PorcuArt.room(world);
        for (const s of out) {
            let d = 300;
            if (room) d = Math.min(d, Math.max(90, Math.hypot(room.w, room.h) * 0.6));
            s.len = d;
        }
        this.shots = out;
    }

    _volley(dt, list) {
        if (!this.shots.length) {
            this.cool = this.phase === 2 ? 0.7 : 1.2;
            this._set('walk', 0);
            return;
        }
        if (list && this.stateT > 0.15) {
            const m = this._muzzle();
            const sp = this.phase === 2 ? 165 : 148;
            for (const s of this.shots) {
                PorcuArt.quill(m.x, m.y, s.a, sp, { strong: true, stun: 1.1, life: 2.4 });
            }
            PorcuArt.burst(m.x + this.face * 8, m.y, [PorcuCfg.quill, '#ffffff'], 7, 120, 0.35, { kind: 'spark' });
            this.shots = [];
        }
        if (this.stateT <= 0) {
            this.cool = this.phase === 2 ? 0.75 : 1.25;   // Verschnaufpause zum Zurückhauen
            this._set('walk', 0);
        }
    }

    // ── b) Einroll-Sprung ──
    _startLeap(world, player) {
        const room = PorcuArt.room(world);
        this.fromX = this.x;
        this.fromY = this.y;
        let tx = player.x + player.w / 2 - this.w / 2;
        let ty = player.y + player.h / 2 - this.h / 2;
        // Ziel im Raum und in erreichbarer Entfernung
        const cx = this.centerX(), cy = this.centerY();
        let ax = tx + this.w / 2, ay = ty + this.h / 2;
        const d = Math.hypot(ax - cx, ay - cy) || 1;
        const want = clamp(d, 60, 190);
        ax = cx + ((ax - cx) / d) * want;
        ay = cy + ((ay - cy) / d) * want;
        if (room) {
            ax = clamp(ax, room.x + this.w / 2 + 6, room.x + room.w - this.w / 2 - 6);
            ay = clamp(ay, room.y + this.h / 2 + 6, room.y + room.h - this.h / 2 - 6);
        }
        this.landX = ax - this.w / 2;
        this.landY = ay - this.h / 2;
        this.ringOff = Math.random() * TAU;
        this.landHit = [];
        this._set('leap', this.phase === 2 ? 0.95 : 1.15);
    }

    _leap(dt, world, player) {
        const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
        this.lift = Math.sin(k * Math.PI) * 46;
        this.spinRate = Math.min(this.phase === 2 ? 26 : 19, this.spinRate + 26 * dt);
        // die Kugel wandert noch etwas zu Mark hin – Ausweichen bleibt möglich
        const room = PorcuArt.room(world);
        let tx = this.landX, ty = this.landY;
        const want = clamp(Math.hypot(player.x - this.landX, player.y - this.landY), 0, 1);
        if (!player.dead && want > 0.01) {
            const sp = 46 * dt;
            const ddx = player.x - this.landX, ddy = player.y - this.landY;
            const dd = Math.hypot(ddx, ddy) || 1;
            tx = this.landX + (ddx / dd) * Math.min(sp, dd);
            ty = this.landY + (ddy / dd) * Math.min(sp, dd);
        }
        if (room) {
            tx = clamp(tx, room.x + 4, room.x + room.w - this.w - 4);
            ty = clamp(ty, room.y + 4, room.y + room.h - this.h - 4);
        }
        const lerp = Math.min(1, dt * 3.2);
        this.landX = tx;
        this.landY = ty;
        this.x += (this.landX - this.x) * lerp * (0.3 + k * 0.9);
        this.y += (this.landY - this.y) * lerp * (0.3 + k * 0.9);
        if (this.stateT <= 0) {
            this.x = this.landX;
            this.y = this.landY;
            this.lift = 0;
            this._impact(world);
        }
    }

    _impact(world) {
        const mx = this.centerX(), my = this.centerY();
        const p2 = this.phase === 2;
        PorcuArt.shake(9, 0.4);
        PorcuArt.ring(mx, my, '#ffe6b8', p2 ? 120 : 96, 0.45, 7);
        PorcuArt.burst(mx, my + 16, [PorcuCfg.furDark, PorcuCfg.quill, '#ffffff'], 16, 190, 0.55);
        // Stachelring mit Lücken (Lücken = sicherer Schlupfwinkel für Kinder)
        const n = p2 ? 18 : 12;
        for (let i = 0; i < n; i++) {
            if (i % 4 === 3) continue;
            PorcuArt.quill(mx, my - 4, this.ringOff + (TAU * i) / n, p2 ? 150 : 132,
                { strong: true, stun: 1.1, life: 2.2 });
        }
        if (p2) {
            const n2 = 12;
            for (let i = 0; i < n2; i++) {
                if (i % 5 === 4) continue;
                PorcuArt.quill(mx, my - 4, this.ringOff + TAU / (2 * n) + (TAU * i) / n2, 104,
                    { strong: true, stun: 1.1, life: 2.4 });
            }
        }
        // Aufprallfläche: Mark und die Freunde
        const R = p2 ? 74 : 62;
        if (typeof Game !== 'undefined') {
            const P = Game.player;
            if (P && !P.dead && this.landHit.indexOf(P) < 0) {
                const px = P.x + P.w / 2, py = P.y + P.h / 2;
                if (Math.hypot(px - mx, py - my) < R + P.w / 2) {
                    this.landHit.push(P);
                    PorcuArt.hurt(P, 2, Math.atan2(py - my, px - mx), 230);
                }
            }
            for (const c of PorcuArt.companions()) {
                if (this.landHit.indexOf(c) >= 0) continue;
                const cw = c.w || 20, ch = c.h || 20;
                if (Math.hypot(c.x + cw / 2 - mx, c.y + ch / 2 - my) < R + Math.max(cw, ch) / 2) {
                    this.landHit.push(c);
                    PorcuArt.hitCompanion(c, 2);
                }
            }
        }
        this._set('land', p2 ? 0.3 : 0.36);
        if (p2 && this.leapPair > 0) {
            this.leapPair--;
            this._set('curl', 0.55);   // zweiter Sprung direkt hintereinander
        }
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        if (this.state === 'volleyAim') {
            const m = this._muzzle();
            const p = camera.worldToScreen(m.x, m.y);
            if (!this.shots.length) {
                LateWorldArt.warn(ctx, p.x, p.y, 30, this._k(), PorcuCfg.warn);
                return;
            }
            const k = this._k();
            const prev = ctx.globalAlpha;
            ctx.strokeStyle = PorcuCfg.warn;
            ctx.lineCap = 'round';
            ctx.globalAlpha = prev * (0.14 + 0.12 * k);
            ctx.lineWidth = 12;
            ctx.beginPath();
            for (const s of this.shots) {
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + Math.cos(s.a) * s.len, p.y + Math.sin(s.a) * s.len);
            }
            ctx.stroke();
            ctx.globalAlpha = prev * (0.4 + 0.45 * Math.abs(Math.sin(Art.time * 12)));
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            for (const s of this.shots) {
                const len = s.len * (0.35 + 0.65 * k);
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + Math.cos(s.a) * len, p.y + Math.sin(s.a) * len);
            }
            ctx.stroke();
            ctx.globalAlpha = prev;
            for (const s of this.shots) {
                const len = s.len * (0.35 + 0.65 * k);
                Art.ring(ctx, p.x + Math.cos(s.a) * len, p.y + Math.sin(s.a) * len, 7 + 4 * k, PorcuCfg.warn, 1.8, 0.6);
            }
            return;
        }
        if (this.state === 'curl') {
            const p = camera.worldToScreen(mx, my + 16);
            LateWorldArt.warn(ctx, p.x, p.y, this.phase === 2 ? 74 : 62, this._k(), PorcuCfg.warn);
            return;
        }
        if (this.state === 'leap') {
            const k = this._k();
            const p = camera.worldToScreen(this.landX + this.w / 2, this.landY + this.h - 10);
            const R = this.phase === 2 ? 74 : 62;
            LateWorldArt.warn(ctx, p.x, p.y, R, k, '#ff3d5a');
            const n = this.phase === 2 ? 18 : 12;
            LateWorldArt.rays(ctx, p.x, p.y, n, this.ringOff, R * 0.5, R * (0.7 + 0.5 * k), k, '#ffb03a');
            // Schatten der Kugel auf dem Boden
            const s = 1 - this.lift / 90;
            ctx.fillStyle = 'rgba(40,26,12,0.3)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 34 * s, 13 * s, 0, 0, TAU);
            ctx.fill();
            return;
        }
        if (this.state === 'land') {
            const p = camera.worldToScreen(mx, my + 14);
            Art.ring(ctx, p.x, p.y, 30 + (1 - this.stateT / 0.36) * 70, '#ffe6b8', 4, 0.7);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 30);
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
        const ball = st === 'curl' || st === 'leap' || st === 'land';
        if (ball) {
            this._ball(ctx, dead, k);
            return;
        }
        const tired = st === 'tired' || st === 'unroll';
        const aim = st === 'volleyAim' ? k : 0;
        const intro = st === 'intro' ? 1 : 0;
        const walk = this.moving && !tired && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? 0 : (this.moving ? Math.abs(walk) * 2.6 : Math.sin(t * 1.7) * 2.2);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.045 : Math.sin(t * 1.7) * 0.018) + (tired ? 0.07 : 0);
        const by = -44 - bob + (tired ? 8 : 0);
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        // Füße
        ctx.fillStyle = Art.dark(PorcuCfg.furDark, 0.3);
        ctx.beginPath();
        Kit915.oval(ctx, -18 + walk * 4, -3, 11, 5);
        Kit915.oval(ctx, 18 - walk * 4, -3, 11, 5);
        ctx.fill();
        ctx.scale(this.face, 1);
        // Stachelkranz (riesig, hinten)
        if (this.hots > 0.05 && !dead) Art.glow(ctx, -4, by - 4, 78, PorcuCfg.quillHot, 0.28 * this.hots + 0.08 * Math.sin(t * 6));
        PorcuArt.bristles(ctx, -6, by + 4, 26, 34, this.spikes, this.gaps, { width: 8.5, hot: this.hots });
        if (tired && !dead) Art.glow(ctx, 0, by, 40, '#8fe3ff', 0.2);
        // Körper
        Art.body(ctx, 0, by, 40, 33, `hsl(${p2 ? 22 : 28}, ${dead ? 20 : 46}%, ${dead ? 30 : (p2 ? 36 : 41)}%)`,
            { glossy: true, lineWidth: 2.4 });
        Art.body(ctx, 3, by + 16, 25, 14, PorcuCfg.belly, { highlight: false, lineWidth: 1.6 });
        // Gürtel mit Köchern (Endgegner-Ausrüstung)
        Art.box(ctx, -26, by + 6, 52, 8, 4, '#7a4a20', { lineWidth: 1.6 });
        Art.body(ctx, 0, by + 10, 4.6, 4.6, p2 ? '#ff4d3d' : '#ffd23f', { lineWidth: 1.2, glossy: true });
        // Kopf
        const hx = 30, hy = by - 12 + (aim > 0 ? -4 * aim : 0) + (tired ? 5 : 0);
        Art.body(ctx, hx, hy, 18, 16, PorcuCfg.face, { lineWidth: 2 });
        Art.body(ctx, hx + 15, hy + 6, 12, 8.5, PorcuCfg.snout, { lineWidth: 1.7 });
        ctx.fillStyle = '#3a2312';
        ctx.beginPath();
        ctx.arc(hx + 24, hy + 4, 2.4, 0, TAU);
        ctx.fill();
        Art.body(ctx, hx - 10, hy - 14, 5.6, 5, PorcuCfg.face, { lineWidth: 1.4 });
        Art.body(ctx, hx + 4, hy - 16, 5, 4.4, PorcuCfg.face, { lineWidth: 1.3 });
        PorcuArt.knobEyes(ctx, hx + 4, hy - 3, 7.5, 4.6, { x: this.look.x * this.face, y: this.look.y }, dead, !dead && !tired);
        if (dead) LateWorldArt.xEyes(ctx, hx + 4, hy - 3, 4.2, 7.5);
        else if (tired) Art.mouth(ctx, hx + 9, hy + 12, 8, 'o');
        else Art.mouth(ctx, hx + 9, hy + 13, 11, aim > 0 ? 'open' : 'angry');
        if (tired && !dead) Art.body(ctx, hx + 20, hy - 12 + ((t * 22) % 8), 3, 4.4, '#8fe3ff', { lineWidth: 1 });
        // Kleine Krone als Endgegner-Merkmal (rutscht, wenn erschöpft)
        ctx.save();
        ctx.translate(hx - 2, hy - 22);
        ctx.rotate(tired || dead ? 0.35 : Math.sin(t * 1.6) * 0.05);
        Art.shape(ctx, c => {
            c.moveTo(-13, 4);
            c.lineTo(-15, -10);
            c.lineTo(-6, -3);
            c.lineTo(0, -14);
            c.lineTo(6, -3);
            c.lineTo(15, -10);
            c.lineTo(13, 4);
            c.closePath();
        }, { x: -15, y: -14, w: 30, h: 18 }, '#ffd23f', { glossy: true, lineWidth: 1.8 });
        if (p2 && !dead) Art.glow(ctx, 0, -4, 22, '#ff4d3d', 0.4 + 0.25 * Math.sin(t * 8));
        Art.gem(ctx, 0, -3, 3.2, p2 ? '#ff4d3d' : '#39d5ff');
        ctx.restore();
        // Arme: vorn der Riesenbogen, hinten greift er sich Stacheln
        const handX = 40 + aim * 4, handY = by + 2 - aim * 10;
        const aimA = st === 'volleyAim' && this.shots.length
            ? Math.atan2(this.shots[0].len * Math.sin(this.shots[0].a), this.shots[0].len * Math.cos(this.shots[0].a)) : (aim > 0 ? -0.1 : -0.4);
        Art.limb(ctx, 12, by + 6, handX, handY, 8, PorcuCfg.face, { lineWidth: 1.6 });
        Art.body(ctx, handX, handY, 6.5, 6, PorcuCfg.snout, { lineWidth: 1.4 });
        PorcuArt.bow(ctx, handX, handY, aimA, 22, aim);
        if (this.toPluck > 0 && st === 'volleyAim') {
            Art.limb(ctx, -10, by + 8, -30, by - 12, 7, PorcuCfg.face, { lineWidth: 1.5 });
            Art.body(ctx, -31, by - 14, 6, 5.6, PorcuCfg.snout, { lineWidth: 1.4 });
        }
        ctx.restore();
        // Zorn-Dampf in Phase 2
        if (p2 && !tired && !dead) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.9 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.5;
                ctx.beginPath();
                ctx.arc((i - 1) * 22 + Math.sin(t * 3 + i) * 4, by - 70 - q * 22, 4 + q * 6, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
        if (st === 'tired' && !dead) LateWorldArt.dizzy(ctx, 0, by - 52, 26, 4.4);
        if (intro && !dead) Art.glow(ctx, 0, by, 90, PorcuCfg.quill, 0.2 + 0.1 * Math.sin(t * 7));
    }

    // Eingegerollt: drehende Stachelkugel, das Gesicht schaut kurz heraus
    _ball(ctx, dead, k) {
        const t = Art.time + this.seed;
        const R = 40;
        ctx.save();
        ctx.translate(0, -R - 2);
        ctx.rotate(this.spin);
        const angles = [];
        for (let i = 0; i < 20; i++) angles.push((TAU * i) / 20);
        PorcuArt.bristles(ctx, 0, 0, R - 10, 26, angles, null, { width: 9, hot: this.hots });
        Art.body(ctx, 0, 0, R - 6, R - 6, `hsl(${this.phase === 2 ? 20 : 26}, 44%, 38%)`, { glossy: true, lineWidth: 2.4 });
        ctx.strokeStyle = Art.dark(PorcuCfg.furDark, 0.4);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = (TAU * i) / 5 + 0.4;
            ctx.moveTo(Math.cos(a) * (R - 22), Math.sin(a) * (R - 22));
            ctx.lineTo(Math.cos(a + 0.9) * (R - 12), Math.sin(a + 0.9) * (R - 12));
        }
        ctx.stroke();
        ctx.restore();
        // Gesicht schaut heraus (dreht sich nicht mit)
        const peek = this.state === 'curl' ? clamp(k * 1.4, 0, 1) : 1;
        if (peek > 0.15) {
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * peek;
            ctx.save();
            ctx.translate(0, -R - 2);
            PorcuArt.knobEyes(ctx, 0, -3, 9, 4.6, { x: this.face * 0.4, y: 0.2 }, dead, true);
            ctx.restore();
            ctx.globalAlpha = prev;
        }
        if (this.state === 'land') Art.glow(ctx, 0, -R, 70, PorcuCfg.quillHot, 0.4);
        ctx.restore();
    }

}

// Der Spin wird in update() über spinRate gepflegt – in einem separaten Schritt, damit draw() nichts ändert.
BossGiantPorcupine.CYCLE1 = ['volley', 'leap', 'volley', 'walk'];
BossGiantPorcupine.CYCLE2 = ['leap', 'volley', 'leap', 'volley', 'walk'];
