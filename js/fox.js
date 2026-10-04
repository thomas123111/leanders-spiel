// ── Welt 42: Fuchsfestung (Idee von Leander) ──
// Fuchssoldaten in grüner Uniform halten Abstand, zielen mit Warnlinie und schießen kurze
// Feuerstöße auf Mark oder einen Freund; ab und zu werfen sie eine Bombe im Bogen (blinkende
// Lunte, Warnkreis am Landeplatz). Der Riesenfuchs (Endgegner) schießt dauerhaft mit zwei
// Gewehren und wirft Riesenbomben, aus denen kleine Füchse springen.

const FOX_ORANGE = '#ff8c32';
const FOX_CREAM = '#fff1dc';
const FOX_GREEN = '#3f9245';
const FOX_GREEN_DARK = '#2b6a31';
const FOX_CAP = '#2f5e9e';
const FOX_GOLD = '#ffd23f';

// Gemeinsame Helfer der Fuchsfiguren (Namensraum, wie AngelArt/WolfArt/ThunderKit)
const FoxKit = {
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

    // Wache, treffbare Begleiter (nicht die Schlange auf Marks Schulter), k.o.-Prüfung wie angel.js:58
    companions() {
        const out = [];
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Begleiter treffen: nie verschwinden lassen, ein tödlicher Treffer haut nur um (angel.js:51)
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(7);
        else if (c.takeDamage) c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [FOX_ORANGE, '#ffffff'], 8, 130, 0.4, { kind: 'star' });
    },

    // Freie Sicht? Nutzt die gemeinsame Linie der Begleiter-KI (entities.js:2670)
    clearLine(world, ax, ay, bx, by) {
        if (typeof Juri !== 'undefined' && Juri.lineClear) return Juri.lineClear(world, ax, ay, bx, by);
        if (!world || !world.isWall) return true;
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
        for (let i = 1; i < steps; i++) {
            if (world.isWall(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps)) return false;
        }
        return true;
    },

    // Noch lebende Gegnergeschosse zählen (Handy: höchstens ~60 gleichzeitig)
    enemyShots(list) {
        const l = list || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!l) return 0;
        let n = 0;
        for (const p of l) if (!p.dead && p.owner === 'enemy') n++;
        return n;
    },

    // Dünne Visierlinie vom Lauf zum anvisierten Punkt (dicker und weiß kurz vor dem Schuss)
    aimLine(ctx, camera, x, y, tx, ty, k, color) {
        const dx = tx - x, dy = ty - y;
        const d = Math.hypot(dx, dy) || 1;
        const kk = Math.min(1, k);
        const p = camera.worldToScreen(x, y);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (0.2 + 0.5 * kk) * (kk > 0.75 ? 0.75 + 0.25 * Math.sin(Art.time * 40) : 1);
        ctx.strokeStyle = kk > 0.75 ? '#ffffff' : color;
        ctx.lineWidth = kk > 0.75 ? 1.8 : 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x + (dx / d) * 10, p.y + (dy / d) * 10);
        ctx.lineTo(p.x + (dx / d) * Math.min(d + 8, 30 + 220 * kk), p.y + (dy / d) * Math.min(d + 8, 30 + 220 * kk));
        ctx.stroke();
        ctx.globalAlpha = a0;
    },

    // Ziel für Gewehr oder Wurfteller: meist Mark, manchmal ein Freund mit freier Sicht
    pickAim(world, mx, my, player, maxDist, friendChance) {
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        if (!player.dead && Math.hypot(px - mx, py - my) < maxDist && FoxKit.clearLine(world, mx, my, px, py)) {
            if (Math.random() < friendChance) {
                const cs = FoxKit.companions();
                const start = Math.floor(Math.random() * Math.max(1, cs.length));
                for (let k = 0; k < cs.length; k++) {
                    const c = cs[(start + k) % cs.length];
                    const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                    if (Math.hypot(cx - mx, cy - my) > maxDist) continue;
                    if (FoxKit.clearLine(world, mx, my, cx, cy)) return { x: cx, y: cy };
                }
            }
            return { x: px, y: py };
        }
        return null;
    },
};

// ── Gewehrkugel: klein, schnell, 1 Schaden. Trifft auch die Freunde (kurz betäubt). ──
class FoxBullet extends Projectile {
    constructor(x, y, angle, speed, color) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 70);
        this.radius = 3.6;
        this.lifetime = 1.9;
        this.color = color || FOX_GOLD;
        this.hitsCompanions = true;
        this.stunTime = 1.2;
        this.seed = Math.floor(Math.random() * 1000);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const ux = this.vx / sp, uy = this.vy / sp;
        Art.glow(ctx, p.x, p.y, 9, this.color, 0.6);
        ctx.strokeStyle = Art.alpha(this.color, 0.4);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - ux * 9, p.y - uy * 9);
        ctx.lineTo(p.x - ux * 2, p.y - uy * 2);
        ctx.stroke();
        Art.body(ctx, p.x, p.y, 2.6, 2.6, this.color, { lineWidth: 1 });
        ctx.fillStyle = '#fffbe8';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.1, 0, TAU);
        ctx.fill();
    }
}

// ── Bombe im Bogen: Landepunkt steht ab dem Wurf fest (fair), Warnkreis zeichnet der Werfer. ──
// Eigener owner: die Engine lässt sie bei den Trefferprüfungen in Ruhe, den Schaden macht sie selbst.
class FoxBomb {
    constructor(x0, y0, tx, ty, flight, big, onBoom) {
        this.x = x0; this.y = y0;
        this.x0 = x0; this.y0 = y0;
        this.tx = tx; this.ty = ty;
        this.t = 0;
        this.flight = flight;
        this.big = !!big;
        this.radius = this.big ? 13 : 8;
        this.range = this.big ? 88 : 52;
        this.damage = this.big ? 2 : 1;
        this.owner = 'foxbomb';
        this.dead = false;
        this.onBoom = onBoom || null;
        this.spin = Math.random() * TAU;
        this.seed = Math.random() * 10;
        this.liftMax = this.big ? 120 : 70;
    }

    update(dt, world) {
        this.t += dt;
        const e = Math.min(1, this.t / this.flight);
        this.x = this.x0 + (this.tx - this.x0) * e;
        this.y = this.y0 + (this.ty - this.y0) * e;
        if (this.t >= this.flight) this._explode(world);
    }

    _explode(world) {
        if (this.dead) return;
        this.dead = true;
        const x = this.tx, y = this.ty;
        FoxKit.ring(x, y, '#ffd8a8', this.range, 0.4, this.big ? 6 : 4);
        FoxKit.ring(x, y, '#ffffff', this.range * 0.55, 0.25, 3);
        FoxKit.burst(x, y, ['#ff9f1c', '#ff4d1f', '#ffd23f', '#ffffff'], this.big ? 26 : 14, this.big ? 240 : 160, 0.55, { kind: 'spark' });
        FoxKit.burst(x, y, 'rgba(120,110,100,0.8)', this.big ? 8 : 5, 60, 0.7, { kind: 'smoke', size: this.big ? 9 : 6 });
        FoxKit.shake(this.big ? 7 : 3.5, this.big ? 0.3 : 0.18);
        const player = typeof Game !== 'undefined' ? Game.player : null;
        if (player && !player.dead && !player.dodging && player.iFrames <= 0) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            const d = Math.hypot(px - x, py - y);
            if (d < this.range + player.w / 2) {
                FoxKit.hurt(player, this.damage, Math.atan2(py - y, px - x), this.big ? 300 : 190);
            }
        }
        for (const c of FoxKit.companions()) {
            const cw = c.w || 20, ch = c.h || 20;
            if (c.iFrames > 0) continue;
            if (Math.hypot(c.x + cw / 2 - x, c.y + ch / 2 - y) < this.range + cw / 2) FoxKit.hitCompanion(c, this.damage);
        }
        if (this.big && this.onBoom) this.onBoom(x, y);
    }

    draw(ctx, camera) {
        const e = Math.min(1, this.t / this.flight);
        const lift = Math.sin(Math.PI * e) * this.liftMax;
        const p = camera.worldToScreen(this.x, this.y);
        const s = this.big ? 1.9 : 1;
        // Schattenspunkt am Boden: Kinder sehen, wo sie herunterkommt
        ctx.fillStyle = 'rgba(30,20,10,0.35)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 6 * s * (0.6 + 0.4 * e), 2.6 * s * (0.6 + 0.4 * e), 0, 0, TAU);
        ctx.fill();
        const y = p.y - lift;
        ctx.save();
        ctx.translate(p.x, y);
        ctx.rotate(this.spin + e * 5.5);
        Art.body(ctx, 0, 0, 6.4 * s, 6.8 * s, '#3d3a46', { glossy: true, lineWidth: 1.6 });
        Art.shine(ctx, -2.4 * s, -2.8 * s, 1.8 * s, 1.3 * s, -0.5, 0.6);
        if (this.big) {
            ctx.strokeStyle = '#ff4d1f';
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.arc(0, 0, 6.6 * s, 0.5, 2.1);
            ctx.stroke();
        }
        // Zündschnur mit blinkender Funke
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 1.4 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(1.5 * s, -6 * s);
        ctx.quadraticCurveTo(4 * s, -9.5 * s, 2.5 * s, -11.5 * s);
        ctx.stroke();
        ctx.restore();
        const blink = Math.sin(Art.time * 18 + this.seed) > -0.2;
        const fx = p.x + 2.5 * s * Math.cos(this.spin + e * 5.5) + 2.5 * s, fy = y - 11.5 * s;
        if (blink) {
            Art.glow(ctx, fx, fy, 7 * s, '#ffd23f', 0.9);
            Art.sparkle(ctx, fx, fy, 3 * s, '#ffffff', 0.9);
        }
    }
}

// ══════════════════════════════════════════
// Fuchssoldat: hält Abstand, zielt (Warnlinie) und schießt Feuerstöße; wirft ab und zu Bomben
// ══════════════════════════════════════════

class FoxSoldier extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 62;
        this.damage = 1;
        this.phasesThroughWalls = false;
        this.fxColor = FOX_ORANGE;
        this.seed = Math.random() * 10;
        this.walkT = Math.random() * 6;
        this.lookDir = { x: 0, y: 0.3 };
        this.face = 1;
        this.engaged = false;
        this.hasLos = false;
        this.moving = 0;
        this.state = 'hold';      // hold, aim, burst, throw
        this.stateT = randRange(0.6, 1.6);
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.charge = 0;          // 0..1 Zielzeit (Warnlinie), letzte 0,15 s steht die Richtung
        this.aimX = 0;
        this.aimY = 0;
        this.burst = null;        // { n, i, t }
        this.shotFlash = 0;
        this.throwT = 0;
        this.bombCd = randRange(5, 9);
        this.bombs = [];          // eigene fliegende Bomben (nur für Warnkreise)
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.shotFlash > 0) this.shotFlash -= dt;
        if (this.dead) return;
        this.bombs = this.bombs.filter(b => !b.dead);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (dist < 250) this.engaged = true;
        else if (dist > 330) this.engaged = false;
        this.hasLos = this.engaged && FoxKit.clearLine(world, mx, my, px, py);
        if (this.engaged && Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;

        let mvx = 0, mvy = 0;
        this.stateT -= dt;
        if (this.state === 'hold') {
            this.charge = 0;
            if (this.engaged && this.hasLos) {
                if (dist > 205) { mvx = dx / dist; mvy = dy / dist; }
                else if (dist < 115) { mvx = -dx / dist; mvy = -dy / dist; }
                else { mvx = (-dy / dist) * this.strafe; mvy = (dx / dist) * this.strafe; }
                this.bombCd -= dt;
                if (this.stateT <= 0) {
                    this.strafe = Math.random() < 0.5 ? 1 : -1;
                    const tgt = FoxKit.pickAim(world, mx, my, player, 250, 0.32);
                    if (tgt && this.bombCd <= 0 && dist > 75) {
                        // Erst die Bombe, dann wieder Gewehr
                        this.aimX = tgt.x; this.aimY = tgt.y;
                        this.state = 'throw';
                        this.throwT = 0.55;
                        this.bombCd = randRange(6, 9.5);
                        this.stateT = randRange(1.4, 2.4);
                    } else if (tgt) {
                        this.aimX = tgt.x; this.aimY = tgt.y;
                        this.state = 'aim';
                        this.charge = 0.001;
                    } else {
                        this.stateT = randRange(0.4, 0.9);
                    }
                }
            } else {
                // Leerlauf: ein paar Schritte um den Standplatz
                mvx = Math.sin(this.t0() * 0.7 + this.seed) * 0.5;
                mvy = Math.cos(this.t0() * 0.5 + this.seed * 1.7) * 0.4;
            }
        } else if (this.state === 'aim') {
            this.charge += dt / 0.55;
            if (this.charge < 0.75) {
                const tgt = FoxKit.pickAim(world, mx, my, player, 280, 0.15);
                if (tgt) { this.aimX = tgt.x; this.aimY = tgt.y; }
            }
            if (this.charge >= 1) {
                this.charge = 0;
                this.state = 'burst';
                this.burst = { n: randInt(2, 3), i: 0, t: 0 };
            }
        } else if (this.state === 'burst') {
            const b = this.burst;
            b.t -= dt;
            if (b.t <= 0) {
                if (b.i < b.n) {
                    this._shot(projectiles);
                    b.i++;
                    b.t = 0.13;
                } else {
                    this.burst = null;
                    this.state = 'hold';
                    this.stateT = randRange(0.9, 1.9);
                }
            }
        } else if (this.state === 'throw') {
            this.throwT -= dt;
            if (this.throwT <= 0) {
                this._throwBomb(projectiles);
                this.state = 'hold';
                this.stateT = randRange(1.1, 2.1);
            }
        }

        const sp = this.speed * (this.state === 'hold' ? 1 : 0.45);
        const mlen = Math.hypot(mvx, mvy);
        if (mlen > 0.01) {
            this._moveWithCollision((mvx / mlen) * sp * dt, (mvy / mlen) * sp * dt, world);
            this.moving = Math.min(1, this.moving + dt * 6);
        } else {
            this.moving = Math.max(0, this.moving - dt * 6);
        }
        this.walkT += dt * (4 + this.moving * 7);
        // Blick: beim Zielen zur Waffe, sonst zu Mark
        const tx = this.state === 'hold' ? px : this.aimX;
        const ty = this.state === 'hold' ? py : this.aimY;
        const tdx = tx - mx, tdy = ty - my;
        const td = Math.hypot(tdx, tdy) || 1;
        const k = Math.min(1, dt * 8);
        this.lookDir.x += ((this.engaged ? tdx / td : 0) - this.lookDir.x) * k;
        this.lookDir.y += ((this.engaged ? tdy / td : 0.3) - this.lookDir.y) * k;
    }

    // Eigene Uhr für Leerlaufbewegung (darf keine Wanduhr sein)
    t0() { return this.walkT; }

    _shot(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        // Höchstens ~40 Kugeln aller Fuchssoldaten gleichzeitig (Handy)
        if (FoxKit.enemyShots(list) >= 40) return;
        const mx = this.centerX() + this.face * 12, my = this.centerY() - 3;
        const a = Math.atan2(this.aimY - my, this.aimX - mx);
        list.push(new FoxBullet(mx, my, a, 225, this.isKeyGhost ? '#ffe066' : FOX_GOLD));
        this.shotFlash = 0.09;
        FoxKit.burst(mx + Math.cos(a) * 8, my + Math.sin(a) * 8, ['#ffe9a8', '#ffffff'], 3, 70, 0.16, { kind: 'spark' });
    }

    _throwBomb(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const b = new FoxBomb(this.centerX(), this.centerY() - 12, this.aimX, this.aimY, 1.0, false, null);
        list.push(b);
        this.bombs.push(b);
    }

    // Warnungen am Boden: Visierlinie während des Zielens, Landekreise eigener Bomben
    drawUnder(ctx, camera) {
        if (this.dead) return;
        if (this.state === 'aim' && this.charge > 0) {
            FoxKit.aimLine(ctx, camera, this.centerX() + this.face * 10, this.centerY() - 3,
                this.aimX, this.aimY, this.charge, '#ffe14d');
        }
        for (const b of this.bombs) {
            if (b.dead) continue;
            const p = camera.worldToScreen(b.tx, b.ty);
            BossGhost.drawWarnZone(ctx, p.x, p.y, b.range, clamp(b.t / b.flight, 0, 1));
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        const t = Art.time;
        const face = this.face;
        const key = this.isKeyGhost;
        ctx.save();
        ctx.translate(cx, foot);
        if (this.dead) {
            const k = clamp(this.deathProgress(), 0, 1);
            ctx.rotate(k * 1.8 * face);
            ctx.scale(Math.max(0.02, 1 - k), Math.max(0.02, 1 - k));
        }
        const step = Math.sin(this.walkT * 2.1) * this.moving;
        const aim = this.state === 'aim' || this.state === 'burst';
        ctx.translate(0, -Math.abs(step) * 1.4);
        ctx.scale(face, 1);
        // Buschiger Schwanz hinter dem Körper (hinten = -x)
        const wag = Math.sin(t * 3 + this.seed) * 2 + step * 2;
        Art.shape(ctx, c => {
            c.moveTo(-6, -12);
            c.quadraticCurveTo(-17, -16 + wag, -21, -9 + wag);
            c.quadraticCurveTo(-15, -5 + wag, -6, -8);
            c.closePath();
        }, { x: -21, y: -17, w: 15, h: 12 }, FOX_ORANGE, { lineWidth: 1.5 });
        Art.body(ctx, -19.5, -9.5 + wag, 3.4, 2.8, FOX_CREAM, { highlight: false });
        // Beine mit Stiefeln
        Art.box(ctx, -7 - step * 2, -9, 5.4, 6.4, 2, FOX_GREEN_DARK, { lineWidth: 1.2 });
        Art.box(ctx, 2 + step * 2, -9, 5.4, 6.4, 2, FOX_GREEN_DARK, { lineWidth: 1.2 });
        Art.box(ctx, -8 - step * 2, -4, 7, 4, 1.6, '#5a4630', { lineWidth: 1.2 });
        Art.box(ctx, 1.4 + step * 2, -4, 7, 4, 1.6, '#5a4630', { lineWidth: 1.2 });
        // Uniform-Rock mit Gürtel und Knöpfen
        Art.box(ctx, -9.5, -25, 19, 17.5, 5.5, FOX_GREEN, { lineWidth: 1.5, glossy: true });
        Art.box(ctx, -9.5, -13.5, 19, 3.4, 1.2, '#6b4a2a', { lineWidth: 1.2 });
        ctx.fillStyle = FOX_GOLD;
        ctx.beginPath();
        ctx.arc(0, -11.8, 1.4, 0, TAU);
        ctx.arc(0, -21, 1.1, 0, TAU);
        ctx.moveTo(6.6, -21.6); ctx.arc(6, -21.6, 0.9, 0, TAU);
        ctx.fill();
        // Gewehr (läuft nach +x) mit beiden Pranken; zielt = etwas angehoben
        const gunY = aim ? -24.5 : -21;
        const recoil = this.shotFlash > 0 ? -2.2 : 0;
        ctx.save();
        ctx.translate(0, gunY);
        ctx.rotate(aim ? -0.08 : 0.05);
        Art.box(ctx, -6 + recoil, -1.6, 10, 3.2, 1.2, '#7a4f28', { lineWidth: 1.2 });
        Art.box(ctx, 3 + recoil, -1.1, 13, 2.2, 0.8, '#3a3a44', { lineWidth: 1.2 });
        Art.box(ctx, -1 + recoil, 1.2, 3.2, 4.6, 1, '#5a3a20', { lineWidth: 1 });
        ctx.restore();
        Art.body(ctx, 7 + recoil, gunY + 2.4, 2.2, 2.2, FOX_ORANGE, { highlight: false });
        Art.body(ctx, -3.5 + recoil, gunY + 2.6, 2.2, 2.2, FOX_ORANGE, { highlight: false });
        if (aim && this.shotFlash > 0) {
            Art.glow(ctx, 17 + recoil, gunY, 12, '#ffe066', 0.9);
            Art.star(ctx, 18 + recoil, gunY, 4, '#fffbe0', { lineWidth: 1 });
        }
        // Kopf mit Fang und Ohren
        Art.shape(ctx, c => {
            c.moveTo(-8, -34);
            c.lineTo(-9.5, -42.5);
            c.lineTo(-3, -37.5);
            c.closePath();
        }, { x: -9.5, y: -42.5, w: 6.5, h: 8.5 }, FOX_ORANGE, { lineWidth: 1.3 });
        Art.shape(ctx, c => {
            c.moveTo(1, -36.5);
            c.lineTo(2.5, -43);
            c.lineTo(6, -36);
            c.closePath();
        }, { x: 1, y: -43, w: 5, h: 7 }, FOX_ORANGE, { lineWidth: 1.3 });
        Art.body(ctx, 0, -31, 8.6, 8, FOX_ORANGE, { lineWidth: 1.5, glossy: true });
        Art.body(ctx, 5.5, -29.5, 5.2, 3.8, FOX_CREAM, { highlight: false });
        Art.body(ctx, 9, -30, 1.5, 1.2, '#3a2418', { highlight: false });
        // Helm mit Rand und Stern (Schlüsselträger: goldener Stern mit Glanz)
        Art.shape(ctx, c => {
            c.moveTo(-9, -34.5);
            c.arc(0, -34, 9, Math.PI, 0);
            c.lineTo(9, -34.5);
            c.closePath();
        }, { x: -9, y: -44, w: 18, h: 10 }, FOX_GREEN_DARK, { lineWidth: 1.4 });
        Art.box(ctx, -10, -35.6, 20, 2.8, 1.4, '#25552b', { lineWidth: 1.2 });
        if (key) Art.star(ctx, 0, -39.5, 3.4, FOX_GOLD, { lineWidth: 1.1 });
        else Art.star(ctx, 0, -39.5, 2.4, FOX_GOLD, { lineWidth: 1 });
        // Gesicht: frech-böse, blickt zum Ziel
        Art.eyes(ctx, 0, -33, 2.9, { look: { x: this.lookDir.x * face, y: this.lookDir.y }, angry: true, gap: 4.4, seed: this.seed });
        Art.mouth(ctx, 4.5, -27.5, 4, this.engaged ? 'angry' : 'smile');
        ctx.restore();
        if (key && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 16 + Math.sin(t * 3 + this.seed) * 2);
    }
}

// ══════════════════════════════════════════
// Kleiner Fuchs: springt aus einer Riesenbombe und kämpft für den General
// ══════════════════════════════════════════

class FoxPup extends Enemy {
    constructor(x, y, boss) {
        super(x, y, 20, 20);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 95;
        this.damage = 1;
        this.fxColor = '#ffb05e';
        this.boss = boss || null;
        this.seed = Math.random() * 10;
        this.walkT = Math.random() * 6;
        this.moving = 0;
        this.face = 1;
        this.lookDir = { x: 0, y: 0.3 };
        this.shotCd = randRange(1.6, 2.6);
        this.charge = 0;
        this.aimX = 0;
        this.aimY = 0;
        this.shotFlash = 0;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.shotFlash > 0) this.shotFlash -= dt;
        if (this.dead) return;
        // Der General ruft die Kleinen - besiegt verpuffen sie mit ihm (Muster witch.js:173)
        if (this.boss && this.boss.dead) {
            this.hp = 0;
            this.dead = true;
            this.deathTimer = 0.4;
            FoxKit.burst(this.centerX(), this.centerY(), [FOX_ORANGE, '#ffffff'], 8, 95, 0.4, { kind: 'star' });
            return;
        }
        // Bleibt im Boss-Raum (Muster witch.js:178)
        if (typeof Game !== 'undefined' && Game.bossActive && typeof Game._bossRoomRect === 'function') {
            const room = Game._bossRoomRect();
            this.x = clamp(this.x, room.x, room.x + room.w - this.w);
            this.y = clamp(this.y, room.y, room.y + room.h - this.h);
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) > 8) this.face = dx > 0 ? 1 : -1;
        let mvx = 0, mvy = 0;
        if (dist > 46) { mvx = dx / dist; mvy = dy / dist; }
        // Spielzeugpistole: anvisieren (kurze Warnlinie) und einzeln knallen; nahe beißt er (Kontaktschaden)
        if (this.charge > 0) {
            this.charge += dt / 0.5;
            if (this.charge < 0.7) {
                const tgt = FoxKit.pickAim(world, mx, my, player, 240, 0.25);
                if (tgt) { this.aimX = tgt.x; this.aimY = tgt.y; }
            }
            if (this.charge >= 1) {
                this.charge = 0;
                const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
                if (list && FoxKit.enemyShots(list) < 40) {
                    const gx = mx + this.face * 9, gy = my - 1;
                    list.push(new FoxBullet(gx, gy, Math.atan2(this.aimY - gy, this.aimX - gx), 165, '#ffb05e'));
                    this.shotFlash = 0.09;
                }
                this.shotCd = randRange(1.8, 2.8);
            }
        } else {
            this.shotCd -= dt;
            if (this.shotCd <= 0 && dist < 235) {
                const tgt = FoxKit.pickAim(world, mx, my, player, 240, 0.25);
                if (tgt) {
                    this.aimX = tgt.x; this.aimY = tgt.y;
                    this.charge = 0.001;
                } else {
                    this.shotCd = 0.3;
                }
            }
        }
        const sp = this.speed * (this.charge > 0 ? 0.4 : 1);
        if (mvx || mvy) {
            this._moveWithCollision(mvx * sp * dt, mvy * sp * dt, world);
            this.moving = Math.min(1, this.moving + dt * 7);
        } else {
            this.moving = Math.max(0, this.moving - dt * 7);
        }
        this.walkT += dt * (4 + this.moving * 9);
        const k = Math.min(1, dt * 9);
        this.lookDir.x += ((this.charge > 0 ? (this.aimX - mx) / 100 : dx / dist) - this.lookDir.x) * k;
        this.lookDir.y += ((this.charge > 0 ? (this.aimY - my) / 100 : dy / dist) - this.lookDir.y) * k;
    }

    drawUnder(ctx, camera) {
        if (this.dead || this.charge <= 0) return;
        FoxKit.aimLine(ctx, camera, this.centerX() + this.face * 8, this.centerY() - 1,
            this.aimX, this.aimY, this.charge, '#ffc98a');
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        const t = Art.time;
        ctx.save();
        ctx.translate(cx, foot);
        if (this.dead) {
            const k = clamp(this.deathProgress(), 0, 1);
            ctx.globalAlpha *= 1 - k;
            ctx.scale(Math.max(0.05, 1 - k * 0.9), Math.max(0.05, 1 - k * 0.9));
        }
        const step = Math.sin(this.walkT * 2.6) * this.moving;
        ctx.translate(0, -Math.abs(step) * 1.6);
        ctx.scale(this.face, 1);
        const wag = Math.sin(t * 6 + this.seed) * 2.5;
        Art.shape(ctx, c => {
            c.moveTo(-4, -8);
            c.quadraticCurveTo(-13, -12 + wag, -15.5, -6 + wag);
            c.quadraticCurveTo(-10, -3 + wag, -4, -5);
            c.closePath();
        }, { x: -15.5, y: -13, w: 11.5, h: 10 }, FOX_ORANGE, { lineWidth: 1.3 });
        Art.body(ctx, -14.4, -6.6 + wag, 2.4, 2, FOX_CREAM, { highlight: false });
        Art.body(ctx, -3.5 - step * 1.8, -3, 3, 3, FOX_GREEN_DARK, { highlight: false });
        Art.body(ctx, 3 + step * 1.8, -3, 3, 3, FOX_GREEN_DARK, { highlight: false });
        Art.body(ctx, 0, -9.5, 7, 6.6, FOX_ORANGE, { lineWidth: 1.4, glossy: true });
        Art.body(ctx, 2, -8, 4, 3.6, FOX_CREAM, { outline: false, highlight: false });
        // Spielzeugpistole (hellgrau mit orangem Griff)
        const gy = this.charge > 0 ? -12.5 : -10.5;
        Art.box(ctx, 4, gy - 1.4, 8.5, 2.4, 1, '#8d98ad', { lineWidth: 1.1 });
        Art.box(ctx, 4.6, gy + 0.6, 2.6, 3.4, 0.8, '#ff8c32', { lineWidth: 1 });
        if (this.shotFlash > 0) Art.glow(ctx, 13, gy, 9, '#ffe066', 0.85);
        // Kopf mit großen Ohren
        Art.shape(ctx, c => {
            c.moveTo(-6, -17);
            c.lineTo(-7.5, -24);
            c.lineTo(-1.5, -19.5);
            c.closePath();
        }, { x: -7.5, y: -24, w: 6, h: 7 }, FOX_ORANGE, { lineWidth: 1.2 });
        Art.shape(ctx, c => {
            c.moveTo(1.5, -19);
            c.lineTo(3, -24.5);
            c.lineTo(6, -18.5);
            c.closePath();
        }, { x: 1.5, y: -24.5, w: 4.5, h: 6 }, FOX_ORANGE, { lineWidth: 1.2 });
        Art.body(ctx, 0, -16, 6.6, 6, FOX_ORANGE, { lineWidth: 1.4, glossy: true });
        Art.body(ctx, 4, -14.8, 3.8, 2.8, FOX_CREAM, { highlight: false });
        Art.body(ctx, 6.8, -15.2, 1.2, 1, '#3a2418', { highlight: false });
        Art.eyes(ctx, 0, -17.5, 2.3, { look: { x: this.lookDir.x * this.face, y: this.lookDir.y }, angry: true, gap: 3.4, seed: this.seed });
        Art.mouth(ctx, 3.4, -13, 3, this.charge > 0 ? 'open' : 'angry');
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// Boss Welt 42: Riesenfuchs - General mit zwei Gewehren und Riesenbomben (Endgegner)
// ══════════════════════════════════════════

class BossGiantFox extends Enemy {
    constructor(x, y) {
        super(x, y, 96, 96);
        this.hp = 134;
        this.maxHp = 134;
        this.speed = 46;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = true;
        this.fxColor = FOX_ORANGE;
        this.phase = 1;
        this.state = 'intro';
        this.introT = 1.2;
        this.pantT = 0;                 // Verschnaufpause nach großen Angriffen (fair zurückschlagen)
        this.seed = Math.random() * 10;
        this.walkT = 0;
        this.moving = 0;
        this.face = 1;
        this.lookDir = { x: 0, y: 0.4 };
        // Dauerfeuer mit zwei Gewehren
        this.gunCd = randRange(1.3, 1.8);
        this.gunAim = 0;                // 0..1 kleine Warnlinie vor dem Stoß
        this.gunX = 0;
        this.gunY = 0;
        this.curGun = 1;                // beide Hände knallen abwechselnd
        this.burst = null;              // { n, i, t }
        this.flashA = 0;
        this.flashB = 0;
        this.shots = [];                // eigene Kugeln, für die Obergrenze
        // Riesenbomben
        this.bombCd = randRange(4.5, 6);
        this.tele = 0;                  // > 0: Ausholen, Landekreis steht fest
        this.teleMax = 1;
        this.teleX = 0;
        this.teleY = 0;
        this.teleCount = 1;
        this.bombs = [];
        this.pups = [];                 // höchstens 4 kleine Füchse gleichzeitig
        this.hatFly = 0;                // Phase 2: die Mütze fliegt weg
        this._world = null;             // für den Bomben-Aufruf (Welpen brauchen die Gegnerliste)
        this._foes = null;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.flashA > 0) this.flashA -= dt;
        if (this.flashB > 0) this.flashB -= dt;
        if (this.hatFly > 0) this.hatFly -= dt;
        this.shots = this.shots.filter(s => !s.dead);
        this.bombs = this.bombs.filter(b => !b.dead);
        this.pups = this.pups.filter(p => !p.dead);
        this._world = world || this._world;
        this._foes = enemies || this._foes;

        // Phase 2 ab halben Leben: wütender, schneller, Mütze fliegt, zwei Bomben
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.speed = 64;
            this.hatFly = 1.4;
            this.bombCd = Math.min(this.bombCd, 2.2);
            this.gunCd = Math.min(this.gunCd, 0.7);
            FoxKit.burst(this.centerX(), this.centerY() - 40, ['#ff4d1f', '#ffd23f', '#ffffff'], 22, 200, 0.6, { kind: 'spark' });
            FoxKit.shake(6, 0.35);
        }

        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        const kl = Math.min(1, dt * 6);
        this.lookDir.x += (dx / dist - this.lookDir.x) * kl;
        this.lookDir.y += (dy / dist - this.lookDir.y) * kl;
        if (Math.abs(dx) > 16) this.face = dx > 0 ? 1 : -1;

        if (this.introT > 0) {
            this.introT -= dt;
            this.state = 'intro';
            return;
        }
        if (this.pantT > 0) {
            // Verschnaufpause: steht keuchend, keine Angriffe - jetzt kann Mark ausholen
            this.pantT -= dt;
            this.state = 'pant';
            this.moving = Math.max(0, this.moving - dt * 6);
            return;
        }

        // ── Riesenbombe: Landepunkt wird festgelegt, 0,85-1,1 s großer Warnkreis, dann Wurf ──
        if (this.tele > 0) {
            this.state = 'bomb';
            this.tele -= dt;
            this.moving = Math.max(0, this.moving - dt * 6);
            if (this.tele <= 0) this._throwBombs(projectiles);
            return;
        }
        this.bombCd -= dt;
        if (this.bombCd <= 0 && !this.burst && this.gunAim <= 0) {
            const tgt = FoxKit.pickAim(world, mx, my, player, 430, 0.4);
            const room = (typeof Game !== 'undefined' && typeof Game._bossRoomRect === 'function') ? Game._bossRoomRect() : null;
            if (tgt || room) {
                const pt = { x: tgt ? tgt.x : px, y: tgt ? tgt.y : py };
                if (room) {
                    pt.x = clamp(pt.x, room.x + 40, room.x + room.w - 40);
                    pt.y = clamp(pt.y, room.y + 40, room.y + room.h - 40);
                }
                this.teleX = pt.x;
                this.teleY = pt.y;
                this.teleMax = this.phase === 2 ? 0.85 : 1.1;
                this.tele = this.teleMax;
                this.teleCount = this.phase === 2 ? 2 : 1;
                this.bombCd = this.phase === 2 ? randRange(4.5, 6) : randRange(6.5, 8.5);
                return;
            }
        }

        // ── Dauerfeuer: kleine Warnlinie, dann kurzer Stoß abwechselnd aus beiden Gewehren ──
        if (this.burst) {
            this.state = 'burst';
            const b = this.burst;
            b.t -= dt;
            if (b.t <= 0) {
                if (b.i < b.n) {
                    this._gunShot(projectiles);
                    b.i++;
                    b.t = 0.12;
                } else {
                    this.burst = null;
                }
            }
        } else if (this.gunAim > 0) {
            this.state = 'aim';
            this.gunAim += dt / 0.42;
            if (this.gunAim < 0.7 && !player.dead) {
                const tgt = FoxKit.pickAim(world, mx, my, player, 460, 0.2);
                if (tgt) { this.gunX = tgt.x; this.gunY = tgt.y; }
            }
            if (this.gunAim >= 1) {
                this.gunAim = 0;
                this.burst = { n: this.phase === 2 ? 3 : 2, i: 0, t: 0 };
                this.gunCd = this.phase === 2 ? randRange(0.8, 1.2) : randRange(1.4, 1.9);
            }
        } else {
            this.state = 'fight';
            this.gunCd -= dt;
            if (this.gunCd <= 0 && !player.dead) {
                const tgt = FoxKit.pickAim(world, mx, my, player, 460, 0.35);
                if (tgt) {
                    this.gunX = tgt.x;
                    this.gunY = tgt.y;
                    this.gunAim = 0.001;
                } else {
                    this.gunCd = 0.35;
                }
            }
        }

        // Laufen (auch während das Gewehr lädt): Abstand 150-280 halten, sonst seitlich ausgreifen
        let mvx = 0, mvy = 0;
        if (!player.dead) {
            if (dist > 280) { mvx = dx / dist; mvy = dy / dist; }
            else if (dist < 150) { mvx = -dx / dist; mvy = -dy / dist; }
            else if ((Math.floor(this.walkT) + this.seed) % 6 < 3) { mvx = -dy / dist; mvy = dx / dist; }
        }
        const firing = this.burst !== null;
        const sp = this.speed * (firing ? 0.55 : 1);
        if (mvx || mvy) {
            this._moveWithCollision(mvx * sp * dt, mvy * sp * dt, world);
            this.moving = Math.min(1, this.moving + dt * 5);
        } else {
            this.moving = Math.max(0, this.moving - dt * 5);
        }
        this.walkT += dt * (3 + this.moving * 5);
        // Sicher im Boss-Raum (die Engine clamps zusätzlich, main.js:1351)
        if (typeof Game !== 'undefined' && Game.bossActive && typeof Game._bossRoomRect === 'function') {
            const room = Game._bossRoomRect();
            this.x = clamp(this.x, room.x, room.x + room.w - this.w);
            this.y = clamp(this.y, room.y, room.y + room.h - this.h);
        }
    }

    _gunShot(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        // Kugeln begrenzt: eigene Obergrenze plus Gesamtzahl aller Fuchsgeschosse (Handy)
        if (this.shots.length >= (this.phase === 2 ? 20 : 15) || FoxKit.enemyShots(list) >= 44) return;
        const mx = this.centerX(), my = this.centerY() - 14;
        const gx = mx + this.face * (this.curGun === 1 ? 30 : -30);
        const a = Math.atan2(this.gunY - my, this.gunX - mx) + randRange(-0.05, 0.05);
        const p = new FoxBullet(gx + Math.cos(a) * 16, my + Math.sin(a) * 16, a, 240, this.phase === 2 ? '#ff8a3d' : FOX_GOLD);
        list.push(p);
        this.shots.push(p);
        if (this.curGun === 1) this.flashA = 0.09; else this.flashB = 0.09;
        this.curGun = this.curGun === 1 ? 2 : 1;
        FoxKit.burst(gx + Math.cos(a) * 20, my + Math.sin(a) * 20, ['#ffe9a8', '#ffffff'], 3, 80, 0.15, { kind: 'spark' });
    }

    _throwBombs(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const room = (typeof Game !== 'undefined' && typeof Game._bossRoomRect === 'function') ? Game._bossRoomRect() : null;
        const mx = this.centerX(), my = this.centerY() - 34;
        for (let i = 0; i < this.teleCount; i++) {
            if (!list) break;
            let tx = this.teleX, ty = this.teleY;
            if (i > 0) {
                tx = clamp(tx + randRange(-70, 70), room ? room.x + 36 : tx - 70, room ? room.x + room.w - 36 : tx + 70);
                ty = clamp(ty + randRange(-70, 70), room ? room.y + 36 : ty - 70, room ? room.y + room.h - 36 : ty + 70);
            }
            const b = new FoxBomb(mx + this.face * 18, my, tx, ty, 1.05 + i * 0.25, true,
                (x, y) => { this.pantT = Math.max(this.pantT, 1.6); this._spawnPups(x, y); });
            list.push(b);
            this.bombs.push(b);
        }
    }

    // Aus der Explosion springen 2-3 kleine Füchse - höchstens 4 gleichzeitig im Raum
    _spawnPups(x, y) {
        const foes = this._foes || (typeof Game !== 'undefined' ? Game.enemies : null);
        if (!foes) return;
        this.pups = this.pups.filter(p => !p.dead);
        const n = Math.min(randInt(2, 3), 4 - this.pups.length);
        for (let i = 0; i < n; i++) {
            const spot = BossGhost.freeSpot(this._world, x, y, 20, 20, 34, (TAU * i) / Math.max(1, n) + this.seed);
            const pup = new FoxPup(spot.x, spot.y, this);
            foes.push(pup);
            this.pups.push(pup);
            FoxKit.burst(spot.x, spot.y, ['#ffd8a8', '#ffffff', FOX_ORANGE], 7, 90, 0.4, { kind: 'smoke', size: 5 });
        }
    }

    // Bodenwarnungen (drawUnder, stil.md:39): Visierlinie, großer Landekreis beim Ausholen,
    // Landekreise der fliegenden Bomben - alle Kreise füllen sich bis zum Einschlag.
    drawUnder(ctx, camera) {
        if (this.dead) return;
        if (this.gunAim > 0) {
            const mx = this.centerX(), my = this.centerY() - 14;
            FoxKit.aimLine(ctx, camera, mx + this.face * 28, my, this.gunX, this.gunY,
                this.gunAim, this.phase === 2 ? '#ff8a3d' : '#ffe14d');
        }
        if (this.tele > 0) {
            const p = camera.worldToScreen(this.teleX, this.teleY);
            BossGhost.drawWarnZone(ctx, p.x, p.y, 88, clamp(1 - this.tele / this.teleMax, 0, 1));
        }
        for (const b of this.bombs) {
            if (b.dead) continue;
            const p = camera.worldToScreen(b.tx, b.ty);
            BossGhost.drawWarnZone(ctx, p.x, p.y, b.range, clamp(b.t / b.flight, 0, 1));
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        const t = Art.time;
        const rage = this.phase === 2;
        ctx.save();
        ctx.translate(cx, foot);
        if (this.dead) {
            const k = clamp(this.deathProgress(), 0, 1);
            ctx.translate(Math.sin(t * 47) * 1.6, 0);
            ctx.scale(Math.max(0.02, 1 - k * 0.7), Math.max(0.02, 1 - k * 0.7));
        }
        const step = Math.sin(this.walkT * 2) * this.moving;
        const pant = this.state === 'pant' ? Math.max(0, Math.sin(t * 9)) : 0;
        const teleK = this.tele > 0 ? 1 - this.tele / this.teleMax : 0;
        ctx.translate(0, -Math.abs(step) * 2 + pant * 2);
        ctx.scale(this.face, 1);
        if (rage && !this.dead) Art.glow(ctx, 0, -46, 74, '#ff4d1f', 0.22 + 0.08 * Math.sin(t * 6));
        // Rute
        const wag = Math.sin(t * 2.2 + this.seed) * 4 + step * 3;
        Art.shape(ctx, c => {
            c.moveTo(-16, -34);
            c.quadraticCurveTo(-42, -44 + wag, -52, -26 + wag);
            c.quadraticCurveTo(-36, -16 + wag, -16, -24);
            c.closePath();
        }, { x: -52, y: -46, w: 36, h: 32 }, FOX_ORANGE, { lineWidth: 2.2 });
        Art.body(ctx, -48, -26 + wag, 7, 5.6, FOX_CREAM, { highlight: false });
        // Stiefel und Uniformrock
        Art.box(ctx, -17 - step * 3, -12, 13, 12, 4, '#4a3423', { lineWidth: 2 });
        Art.box(ctx, 5 + step * 3, -12, 13, 12, 4, '#4a3423', { lineWidth: 2 });
        Art.box(ctx, -24, -58, 48, 48, 14, FOX_GREEN, { lineWidth: 2.4, glossy: true });
        Art.box(ctx, -24, -30, 48, 8, 3, '#6b4a2a', { lineWidth: 2 });
        Art.body(ctx, 0, -26, 4, 4, FOX_GOLD, { lineWidth: 1.4 });
        // Ordenreihe und Achselklappen
        const medals = ['#ff4d6d', '#39d5ff', '#ffd23f'];
        for (let i = 0; i < 3; i++) {
            Art.body(ctx, -15 + i * 8, -50, 3.4, 3.4, medals[i], { lineWidth: 1.2, highlight: false });
            ctx.strokeStyle = Art.ink(medals[i]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-15 + i * 8, -54);
            ctx.lineTo(-15 + i * 8, -52);
            ctx.stroke();
        }
        Art.body(ctx, -23, -55, 6, 4, FOX_GREEN_DARK, { highlight: false });
        Art.body(ctx, 23, -55, 6, 4, FOX_GREEN_DARK, { highlight: false });
        // Beide Pranken mit je einem Gewehr (curGun = 1: rechtes Gewehr vorn)
        const aimUp = (this.gunAim > 0 || this.burst) ? -3 : 0;
        const rRecoil = this.flashA > 0 ? -3.5 : 0;
        const lRecoil = this.flashB > 0 ? -3.5 : 0;
        this._drawRifle(ctx, 26, -40 + aimUp + rRecoil, rRecoil !== 0, this.flashA > 0);
        this._drawRifle(ctx, -26, -38 + aimUp * 0.6 + lRecoil, false, this.flashB > 0);
        Art.body(ctx, 24, -34 + aimUp, 4.6, 4.6, FOX_ORANGE, { highlight: false });
        Art.body(ctx, -24, -32 + aimUp * 0.6, 4.6, 4.6, FOX_ORANGE, { highlight: false });
        // Bombe über dem Kopf beim Ausholen
        if (this.tele > 0) {
            const q = Math.min(1, teleK);
            Art.body(ctx, 6, -78 - q * 8, 9, 9.6, '#3d3a46', { glossy: true, lineWidth: 1.8 });
            const blink = Math.sin(t * 18 + this.seed) > -0.2;
            if (blink) Art.glow(ctx, 9, -90 - q * 8, 8, '#ffd23f', 0.9);
        }
        // Kopf mit Fang, backigem Fell und Ohren
        Art.shape(ctx, c => {
            c.moveTo(-22, -74);
            c.quadraticCurveTo(-34, -70, -36, -60);
            c.quadraticCurveTo(-26, -62, -20, -66);
            c.closePath();
        }, { x: -36, y: -74, w: 16, h: 14 }, FOX_CREAM, { lineWidth: 1.6 });
        Art.shape(ctx, c => {
            c.moveTo(22, -74);
            c.quadraticCurveTo(34, -70, 36, -60);
            c.quadraticCurveTo(26, -62, 20, -66);
            c.closePath();
        }, { x: 20, y: -74, w: 16, h: 14 }, FOX_CREAM, { lineWidth: 1.6 });
        Art.shape(ctx, c => {
            c.moveTo(-16, -84);
            c.lineTo(-21, -102);
            c.lineTo(-5, -90);
            c.closePath();
        }, { x: -21, y: -102, w: 16, h: 18 }, FOX_ORANGE, { lineWidth: 1.8 });
        Art.shape(ctx, c => {
            c.moveTo(16, -84);
            c.lineTo(21, -102);
            c.lineTo(5, -90);
            c.closePath();
        }, { x: 5, y: -102, w: 16, h: 18 }, FOX_ORANGE, { lineWidth: 1.8 });
        Art.body(ctx, 0, -72, 21, 18, FOX_ORANGE, { lineWidth: 2.4, glossy: true });
        Art.body(ctx, 0, -62, 12, 8.5, FOX_CREAM, { outline: false, highlight: false });
        Art.body(ctx, 13, -66, 5, 7.5, FOX_CREAM, { highlight: false });
        Art.body(ctx, 16, -64.5, 2.2, 1.8, '#3a2418', { highlight: false });
        if (rage) {
            // Wutader auf der Stirn
            ctx.strokeStyle = '#c0162e';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-6, -84); ctx.lineTo(-3, -81); ctx.lineTo(-6, -78);
            ctx.stroke();
        }
        if (this.state === 'pant') Art.mouth(ctx, 8, -58, 12, 'open');
        else Art.mouth(ctx, 8, -58, rage ? 13 : 10, rage ? 'teeth' : 'angry');
        // Generalsmütze (Phase 1) bzw. blanke Ohren mit Kopfband (Phase 2)
        if (this.hatFly > 0) {
            const q = clamp(1 - this.hatFly / 1.4, 0, 1);
            ctx.save();
            ctx.translate(6 + q * 60, -96 - q * 70);
            ctx.rotate(-q * 5);
            ctx.globalAlpha *= 1 - Math.max(0, q - 0.6) / 0.4;
            this._drawCap(ctx, 1);
            ctx.restore();
            if (q > 0.1) Art.box(ctx, -16, -92, 32, 4, 2, '#c94f4f', { lineWidth: 1.4 });
        } else if (!rage) {
            this._drawCap(ctx, 1 + Math.sin(t * 2 + this.seed) * 0.02);
        } else {
            Art.box(ctx, -16, -92, 32, 4.6, 2.2, '#c94f4f', { lineWidth: 1.4 });
        }
        ctx.restore();
    }

    // Feldmütze mit goldenem Fuchsabzeichen (0,0 = Mitte Hügelbasis)
    _drawCap(ctx, s) {
        ctx.save();
        ctx.scale(s, s);
        Art.shape(ctx, c => {
            c.moveTo(-17, 0);
            c.quadraticCurveTo(-19, -12, -8, -15);
            c.lineTo(8, -15);
            c.quadraticCurveTo(19, -12, 17, 0);
            c.closePath();
        }, { x: -19, y: -15, w: 38, h: 15 }, FOX_CAP, { lineWidth: 1.8, glossy: true });
        Art.box(ctx, -18, -2.5, 36, 5, 2.4, '#20406e', { lineWidth: 1.4 });
        Art.box(ctx, 2, -1.5, 18, 4, 2, '#16304f', { lineWidth: 1.2 });
        Art.star(ctx, 0, -8.5, 4, FOX_GOLD, { lineWidth: 1.2 });
        ctx.restore();
    }

    // Gewehr der Generalshand (läuft nach +x), x,y = Schaft
    _drawRifle(ctx, x, y, aimHigh, flash) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(aimHigh ? -0.12 : 0.06);
        if (flash) Art.glow(ctx, 34, 0, 18, '#ffe066', 0.9);
        Art.box(ctx, 0, -2.6, 14, 5.2, 2, '#7a4f28', { lineWidth: 1.6 });
        Art.box(ctx, 13, -1.8, 22, 3.6, 1.4, '#3a3a44', { lineWidth: 1.6 });
        Art.box(ctx, 5, 2, 4.6, 7, 1.4, '#5a3a20', { lineWidth: 1.2 });
        if (flash) Art.star(ctx, 37, 0, 5.5, '#fffbe0', { lineWidth: 1.2 });
        ctx.restore();
    }
}
