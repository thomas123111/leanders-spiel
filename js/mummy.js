// ── Welt 27: Pyramidengrab ──
// Mumien (Wunsch von Leander): in helle Binden gewickelt, lose flatternde Bindenenden, leuchtende Augen
// im Sehschlitz. Sie wanken langsam mit ausgestreckten Armen auf Mark zu. Etwa jede dritte hat sich schon
// ein Stück abgewickelt und wirft ab und zu eine Binde (vorher Ausholen + „!“): wer getroffen wird, ist
// kurz langsamer (proj.slow → main.js ruft Game.player.applySlow auf).
// Drei-Kopf-Mumie (Boss): riesig, drei Köpfe (Pharaonen-Kopftuch, Türkis-Stirnband, Sonnenscheibe), jeder
// schaut woandershin und leuchtet in einer eigenen Farbe, vier Arme (zwei je Seite), goldener Kragen.
//   Sandsturm:  Ankündigung (~1 s, Sand wirbelt um den Boss, alle Köpfe pusten, Pfeile zeigen die
//               Windrichtung), dann ~6 s Sturm: Bildschirm sandig-trüb (Mark bleibt im klaren Fleck),
//               sanfter Wind schiebt Mark zur Seite, Sandkörner fliegen in Wellen quer durch den Raum –
//               in jeder Welle bleibt eine Gasse frei, die langsam wandert.
//   Armschläge: die vier Arme schlagen nacheinander dorthin, wo Mark gerade steht (roter Warnkreis am Boden).
// Phase 2 (halbe Lebenspunkte): Wutanfall, rötlichere Augen, Sturm länger/dichter, Arme schneller.

const MUMMY_WRAPS = ['#fff4dc', '#fbeccb', '#f4f1e8', '#fff0d2'];
const MUMMY_EYES = ['#3ff0ff', '#7dff6a', '#ff5ad8', '#ffd23f', '#9a7bff'];
const MUMMY_GEMS = ['#20c3d8', '#3a6cf0', '#ff4d6d', '#ffb02e', '#2ed68a'];
const MUMMY_STEP = 3.4;          // Wank-Takt (Bogenmaß pro Sekunde Laufzeit)
const MUMMY_GRAIN_CAP = 55;      // höchstens so viele Sandkörner des Bosses gleichzeitig
const MUMMY_ALIVE = g => !g.dead;

// Gemeinsame Helfer der Welt 27
const MummyArt = {
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

    smooth(k) {
        k = clamp(k, 0, 1);
        return k * k * (3 - 2 * k);
    },

    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && typeof Game._hurtPlayer === 'function') {
            Game._hurtPlayer(amount, angle, force);
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

    // Lose Binde: gebogenes Band mit dunklem Rand (zwei Striche, ein Pfad)
    ribbon(ctx, x0, y0, cx, cy, x1, y1, width, color) {
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.strokeStyle = Art.ink(color);
        ctx.lineWidth = width + 1.6;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    },

    // Bindenstreifen quer über einen Arm/ein Bein: gestrichelte dicke Linie entlang des Glieds
    wraps(ctx, x0, y0, x1, y1, width, color, dash) {
        ctx.setLineDash(dash || [1.3, 4.2]);
        ctx.lineCap = 'butt';
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.setLineDash([]);
    },
};

// ══════════════════════════════════════════
// ── Mumie ──
// ══════════════════════════════════════════

class Mummy extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(28, 34);      // Mark läuft ~150: langsames Wanken
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 230;
        this.isKeyGhost = false;              // setzt main.js beim Schlüsselträger
        this.seed = Math.random() * 10;
        this.wrap = MummyArt.pick(MUMMY_WRAPS);
        this.eyeCol = MummyArt.pick(MUMMY_EYES);
        this.gem = MummyArt.pick(MUMMY_GEMS);
        this.thrower = Math.random() < 1 / 3; // hat sich schon abgewickelt und wirft Binden
        this.fxColor = this.wrap;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.lookDir = { x: 0, y: 0.3 };
        this.chasing = false;
        this.moving = false;
        this.t = Math.random() * 10;
        this.walkT = Math.random() * 3;
        this.wanderT = randRange(0.3, 2);
        this.wx = 0;
        this.wy = 0;
        this.throwT = randRange(1.5, 3.5);    // bis zum nächsten Wurf
        this.windup = 0;                      // > 0: holt gerade aus
        this.windupMax = 0.7;
        this.aimA = 0;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;

        if (player.dead) this.chasing = false;
        else if (dist < this.detectionRange) this.chasing = true;
        else if (dist > this.detectionRange + 60) this.chasing = false;

        // Binden-Wurf: ausholen (steht still), Richtung bis kurz vor dem Wurf nachführen, dann werfen
        if (this.windup > 0) {
            this.windup -= dt;
            this.moving = false;
            if (Math.abs(dx) > 4) this.face = dx > 0 ? 1 : -1;
            if (this.windup > 0.22) this.aimA = Math.atan2(dy, dx);
            this._look(dx / dist, dy / dist, dt, true);
            if (this.windup <= 0) this._throw(projectiles, world);
            return;
        }
        if (this.thrower && this.chasing) {
            this.throwT -= dt;
            if (this.throwT <= 0) {
                const clear = typeof Juri === 'undefined' || !Juri.lineClear ||
                    Juri.lineClear(world, this.centerX(), this.centerY() - 6, dx + this.centerX(), dy + this.centerY());
                if (dist > 50 && dist < 210 && clear) {
                    this.windup = this.windupMax;
                    this.aimA = Math.atan2(dy, dx);
                    this.throwT = randRange(3.6, 5.6);
                    return;
                }
                this.throwT = 0.6;              // gerade kein freier Wurf: gleich nochmal schauen
            }
        }

        let mx = 0, my = 0, sp = 0;
        if (this.chasing) {
            mx = dx / dist;
            my = dy / dist;
            sp = this.speed;
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.5, 3.4);
                if (Math.random() < 0.4) {
                    this.wx = 0;
                    this.wy = 0;
                } else {
                    const a = Math.random() * TAU;
                    this.wx = Math.cos(a);
                    this.wy = Math.sin(a);
                }
            }
            mx = this.wx;
            my = this.wy;
            sp = this.speed * 0.5;
        }
        this.moving = sp > 0 && (mx !== 0 || my !== 0);
        if (this.moving) {
            this.walkT += dt * (this.chasing ? 1 : 0.7);
            // Wanken: schwerfälliger Schritt, im Mittel genau sp
            const s = Math.sin(this.walkT * MUMMY_STEP);
            const v = sp * (0.5 + s * s);
            const ox = this.x, oy = this.y;
            this._moveWithCollision(mx * v * dt, my * v * dt, world);
            if (!this.chasing && Math.hypot(this.x - ox, this.y - oy) < v * dt * 0.3) this.wanderT = 0;
            if (this.chasing) {
                if (dx > 4) this.face = 1; else if (dx < -4) this.face = -1;
            } else if (Math.abs(mx) > 0.2) {
                this.face = mx > 0 ? 1 : -1;
            }
        }
        if (this.chasing) this._look(dx / dist, dy / dist, dt, true);
        else this._look(mx, my + 0.3, dt, false);
    }

    _look(nx, ny, dt, full) {
        const k = Math.min(1, dt * 8);
        const tx = full ? nx : nx * 0.6, ty = full ? ny : clamp(ny, -1, 1) * 0.6;
        this.lookDir.x += (tx - this.lookDir.x) * k;
        this.lookDir.y += (ty - this.lookDir.y) * k;
    }

    _throw(projectiles, world) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const a = this.aimA;
        let x = this.centerX() + Math.cos(a) * 12, y = this.centerY() - 4 + Math.sin(a) * 12;
        if (world && world.isWall && world.isWall(x, y)) { x = this.centerX(); y = this.centerY() - 4; }
        if (list) list.push(new BandageShot(x, y, a, this.wrap));
        MummyArt.burst(x, y, [this.wrap, '#ffffff', this.eyeCol], 6, 90, 0.3, { kind: 'spark' });
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        ctx.save();
        ctx.translate(cx, pos.y + this.h);
        if (this.dead) this._drawDeath(ctx);
        else this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 14);
        if (this.windup > 0 && !this.dead) BossGhost.drawAlert(ctx, cx + this.face * 3, pos.y - 13 + Math.sin(Art.time * 20), 0.7);
    }

    // Figur mit Füßen bei (0, 0). dead = Kreuzaugen.
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const mv = this.moving;
        const ph = this.walkT * MUMMY_STEP;
        const step = mv ? Math.sin(ph) : 0;
        const bob = mv ? -Math.abs(step) * 1.2 : Math.sin(t * 1.8 + sd) * 0.4;
        // Wanken von einer Seite zur anderen
        const lean = mv ? Math.sin(ph * 0.5) * 0.13 + f * 0.04 : Math.sin(t * 1.2 + sd) * 0.05;
        const wrap = this.wrap, ink = Art.ink(wrap), line = Art.dark(wrap, 0.22);
        const key = this.isKeyGhost && !dead;
        const wind = this.windup > 0 ? clamp(1 - this.windup / this.windupMax, 0, 1) : 0;
        if (key) Art.glow(ctx, 0, -14, 25, '#ffd23f', 0.42 + 0.12 * Math.sin(t * 3 + sd));
        // Füße (bleiben am Boden)
        const l0 = mv ? Math.max(0, step) * 2 : 0, l1 = mv ? Math.max(0, -step) * 2 : 0;
        ctx.beginPath();
        ctx.ellipse(-4 + f, -1.8 - l0, 3.6, 2.2, 0, 0, TAU);
        ctx.moveTo(4 + f + 3.6, -1.8 - l1);
        ctx.ellipse(4 + f, -1.8 - l1, 3.6, 2.2, 0, 0, TAU);
        ctx.fillStyle = line;
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = ink;
        ctx.stroke();
        ctx.save();
        ctx.rotate(lean);
        const y0 = bob;
        const swing = Math.sin(t * 2.6 + sd) * 1.2;
        const ly = clamp(this.lookDir.y, -1, 1) * 1.6;
        // hinterer Arm, weit nach vorn gestreckt
        const bx = f * 11.5, by = -15.5 + y0 - swing + ly;
        Art.limb(ctx, -f * 1.5, -14 + y0, bx, by, 3.4, line, { lineWidth: 1 });
        // Körper und Kopf
        Art.box(ctx, -7.2, -19 + y0, 14.4, 16.5, 6, wrap, { lineWidth: 1.4, highlight: false });
        Art.body(ctx, f * 0.8, -23.5 + y0, 7.8, 7.2, wrap, { lineWidth: 1.4 });
        // Bindenstreifen (schräg, ein Pfad)
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-6.4, -15.5 + y0); ctx.lineTo(6.4, -13.2 + y0);
        ctx.moveTo(-6.6, -11 + y0); ctx.lineTo(6.6, -8.4 + y0);
        ctx.moveTo(-6, -6.5 + y0); ctx.lineTo(5.8, -4.6 + y0);
        ctx.moveTo(f * 0.8 - 6.6, -27.6 + y0); ctx.lineTo(f * 0.8 + 6.2, -29.6 + y0);
        ctx.moveTo(f * 0.8 - 6.8, -19.4 + y0); ctx.lineTo(f * 0.8 + 6.6, -18 + y0);
        ctx.stroke();
        // Amulett (Schlüsselträger: goldenes Ankh-Amulett)
        Art.body(ctx, f * 1.2, -11.5 + y0, 2.2, 2.2, key ? '#ffd23f' : this.gem, { lineWidth: 0.9, highlight: false });
        // Sehschlitz mit leuchtenden Augen
        const hx = f * 0.8, hy = -23.4 + y0;
        ctx.fillStyle = '#2a170c';
        ctx.beginPath();
        ctx.roundRect(hx - 6.2, hy - 2.3, 12.4, 4.6, 2.2);
        ctx.fill();
        if (dead) {
            LateWorldArt.xEyes(ctx, hx, hy, 1.4, 2.8);
        } else {
            const lx = clamp(this.lookDir.x, -1, 1) * 1.3 + f * 0.6;
            const eye = wind > 0 ? Art.mix(this.eyeCol, '#ffffff', wind * 0.5) : this.eyeCol;
            Art.glow(ctx, hx + lx, hy, 11 + wind * 5, this.eyeCol, 0.5 + wind * 0.3);
            ctx.fillStyle = eye;
            ctx.beginPath();
            ctx.ellipse(hx - 2.8 + lx, hy, 1.7, 1.4 * Art.blink(sd), 0, 0, TAU);
            ctx.ellipse(hx + 2.8 + lx, hy, 1.7, 1.4 * Art.blink(sd), 0, 0, TAU);
            ctx.fill();
        }
        // loses Bindenende am Hinterkopf, flattert
        const fl = Math.sin(t * 6 + sd) * 2.4;
        MummyArt.ribbon(ctx, hx - f * 6, hy - 3, hx - f * 11, hy - 5 + fl, hx - f * 11.5, hy + 4 - fl * 0.6, 1.8, wrap);
        // vorderer Arm (Werfer: beim Ausholen nach hinten oben)
        let fx = f * 12.5, fy = -12.8 + y0 + swing + ly;
        if (wind > 0) {
            const e = MummyArt.smooth(wind / 0.7);
            fx = lerp(fx, -f * 4, e);
            fy = lerp(fy, -30 + y0, e);
        }
        Art.limb(ctx, f * 3.6, -13.4 + y0, fx, fy, 3.4, wrap, { lineWidth: 1 });
        LateWorldArt.blob(ctx, fx + f * 0.8, fy, 2.2, 1.9, wrap, 1);
        if (this.thrower) {
            // abgewickelte Binde hängt aus der Hand (beim Ausholen wirbelt sie und leuchtet)
            const sw = wind > 0 ? Math.sin(t * 22) * 5 : Math.sin(t * 3.2 + sd) * 2;
            if (wind > 0) Art.glow(ctx, fx, fy, 10, this.eyeCol, 0.5 * wind);
            MummyArt.ribbon(ctx, fx + f, fy + 1, fx + f * 6 + sw, fy + 6, fx + f * 3 - sw * 0.6, fy + 11 + wind * 2, 1.9, wrap);
        }
        ctx.restore();
    }

    // Tod (0,4 s): fällt in sich zusammen, Binden fliegen davon, Sandwölkchen
    _drawDeath(ctx) {
        const k = clamp(this.deathProgress(), 0, 1);
        const a0 = ctx.globalAlpha;
        if (k < 0.65) {
            const q = k / 0.65;
            ctx.save();
            ctx.globalAlpha = a0 * (1 - q * 0.7);
            ctx.scale(1 + q * 0.4, 1 - q * 0.8);
            this._drawBody(ctx, true);
            ctx.restore();
        }
        ctx.globalAlpha = a0 * (1 - k);
        const d = 6 + k * 16;
        MummyArt.ribbon(ctx, -2, -10, -d, -14 - d * 0.6, -d * 1.3, -6 - d * 0.3, 1.8, this.wrap);
        MummyArt.ribbon(ctx, 2, -12, d, -18 - d * 0.5, d * 1.4, -10 - d * 0.2, 1.8, this.wrap);
        ctx.fillStyle = '#ffe6a8';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = Math.PI * (1.1 + i * 0.27);
            const r = 2.5 + k * 3.5;
            const x = Math.cos(a) * d * 1.2, y = -4 + Math.sin(a) * d * 0.6;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// ── Geworfene Binde ──
// ══════════════════════════════════════════

// Flatterndes Bindenstück. Wie jedes Gegnergeschoss 1 Schaden (main.js); slow = Mark ist danach kurz langsamer.
class BandageShot extends Projectile {
    constructor(x, y, angle, color) {
        super(x, y, Math.cos(angle) * 150, Math.sin(angle) * 150, 1, 'enemy', 50);
        this.radius = 6;
        this.lifetime = 1.9;
        this.slow = true;
        this.color = color || '#fff4dc';
        this.seed = Math.random() * TAU;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const nx = -dy, ny = dx;
        const w = Math.sin(this.age * 18 + this.seed) * 4;
        Art.glow(ctx, p.x, p.y, 14, '#ffe9b0', 0.45);
        // Band, das sich hinter dem Knoten her schlängelt
        MummyArt.ribbon(ctx, p.x, p.y,
            p.x - dx * 10 + nx * w, p.y - dy * 10 + ny * w,
            p.x - dx * 20 - nx * w * 0.6, p.y - dy * 20 - ny * w * 0.6, 3, this.color);
        Art.body(ctx, p.x, p.y, 4.2, 3.6, this.color, { lineWidth: 1.1, rot: Math.atan2(dy, dx) });
    }
}

// ══════════════════════════════════════════
// ── Sandkorn des Sandsturms ──
// ══════════════════════════════════════════

// Kleiner Sandbrocken, fliegt quer durch den Boss-Raum (leicht wellig). 1 Schaden, kleiner Rückstoß.
// Billig gezeichnet: ein Strich als Schweif und ein Kreis.
class SandGrain extends Projectile {
    constructor(x, y, vx, phase) {
        super(x, y, vx, 0, 1, 'enemy', 40);
        this.radius = 3.6;
        this.lifetime = 3.6;
        this.baseY = y;
        this.wobble = randRange(4, 8);
        this.phase = phase || 0;
        this.col = Math.random() < 0.5 ? '#ffd27a' : '#ffbf5a';
    }

    update(dt, world) {
        // leichte Wellenbewegung quer zum Wind (über vy, damit main.js die Richtung kennt)
        this.vy = Math.cos(this.age * 4 + this.phase) * this.wobble * 4 * 0.5;
        super.update(dt, world);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const s = Math.sign(this.vx) || 1;
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * 0.55;
        ctx.strokeStyle = '#fff1c8';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - s * 3, p.y);
        ctx.lineTo(p.x - s * 13, p.y - this.vy * 0.04);
        ctx.stroke();
        ctx.globalAlpha = a0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4, 0, TAU);
        ctx.fillStyle = this.col;
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = '#8a4f12';
        ctx.stroke();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 27: Drei-Kopf-Mumie ──
// ══════════════════════════════════════════

// Hitbox 80×64, Zeichnung ~130 hoch. Bleibt im Boss-Raum (wird jedes Bild hineingeklemmt).
// Ablauf: Intro → Laufen → Angriff (Sandsturm, Armschläge, Armschläge, …) → Laufen …
class BossTripleMummy extends Enemy {
    constructor(x, y) {
        super(x, y, 80, 64);
        this.hp = 110;
        this.maxHp = 110;
        this.speed = 30;
        this.damage = 1;
        this.contactDamage = true;
        this.isBoss = true;
        this.fxColor = '#fff0d2';
        this.shadow = { rx: 46, ry: 13 };
        this.seed = Math.random() * 10;
        this.wrap = '#fff0d2';
        this.look = { x: 0, y: 1 };
        this.phase = 1;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.state = 'intro';
        this.stateT = 1.4;
        this.stateDur = 1.4;
        this.seq = 0;
        // Sandsturm
        this.windDir = 1;           // +1 = Wind nach rechts
        this.hazeK = 0;             // Trübung 0..1 (in update geführt, draw liest nur)
        this.stormT = 0;
        this.emitT = 0;
        this.grains = [];
        this.markX = 0;
        this.markY = 0;
        // Armschläge
        this.slams = [];            // { arm, x, y, age, warn, hit }
        this.armOrder = [0, 1, 2, 3];
        this.armIdx = 0;
        this.armNext = 0;
        this._room = null;
        this._pz = { hands: [{}, {}, {}, {}] };
    }

    static room(world) {
        if (typeof Game === 'undefined' || Game.world !== world || !Game.bossActive || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Kaum wegzuschubsen. Besiegt: Sturm, Körner und Schläge sofort weg.
    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.2);
        if (this.dead && !was) this._stopAll();
    }

    _stopAll() {
        for (const g of this.grains) g.dead = true;
        this.grains.length = 0;
        this.slams.length = 0;
        this.hazeK = 0;
        this.state = 'dead';
    }

    // Wo die Mitte der Füße liegt (Welt)
    _feetX() { return this.x + this.w / 2; }
    _feetY() { return this.y + this.h; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (!this._room) this._room = BossTripleMummy.room(world);
        if (this.homeX === undefined) {
            this.homeX = this.centerX();
            this.homeY = this.centerY();
        }
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
        this.markX = pcx;
        this.markY = pcy;
        const dx = pcx - this.centerX(), dy = pcy - (this.centerY() - 50);
        const d = Math.hypot(dx, dy) || 1;
        const lk = Math.min(1, dt * 6);
        this.look.x += (dx / d - this.look.x) * lk;
        this.look.y += (dy / d - this.look.y) * lk;
        if (this.grains.length) compactInPlace(this.grains, MUMMY_ALIVE);
        this._updateSlams(dt, player, world);
        this.moving = false;

        if (this.phase === 1 && this.hp <= this.maxHp / 2 && this.state !== 'storm' && this.state !== 'stormCharge') {
            this.phase = 2;
            this._set('rage', 1.0);
            this.slams.length = 0;
            const hx = this._feetX(), hy = this._feetY() - 110;
            MummyArt.shake(6, 0.45);
            MummyArt.burst(hx, hy, ['#ff4d6d', '#ffd23f', '#fff0d2', '#ffffff'], 16, 190, 0.6, { kind: 'star' });
            MummyArt.ring(hx, hy + 40, '#ff4d6d', 100, 0.45, 5);
        }

        this.stateT -= dt;
        const p2 = this.phase === 2;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0.6);
                break;
            case 'walk':
                this._walk(dt, world, pcx, pcy);
                if (this.stateT <= 0) this._nextAttack();
                break;
            case 'rage':
                if (this.stateT <= 0) this._set('walk', 0.5);
                break;
            case 'stormCharge':
                this.hazeK = Math.max(this.hazeK, 0.35 * (1 - this.stateT / this.stateDur));
                if (this.stateT <= 0) {
                    this._set('storm', p2 ? 7.5 : 6);
                    this.stormT = 0;
                    this.emitT = 0.15;
                    MummyArt.shake(3, 0.3);
                }
                break;
            case 'storm':
                this.stormT += dt;
                this.hazeK = Math.min(1, this.hazeK + dt * 2.2);
                this._wind(dt, world, player);
                this.emitT -= dt;
                while (this.emitT <= 0) {
                    this._emitWave(list);
                    this.emitT += p2 ? 0.3 : 0.42;
                }
                if (this.stateT <= 0) this._set('stormEnd', 0.7);
                break;
            case 'stormEnd':
                if (this.stateT <= 0) this._set('walk', p2 ? 0.8 : 1.2);
                break;
            case 'arms':
                this.armNext -= dt;
                if (this.armNext <= 0 && this.armIdx < 4) {
                    this._startSlam(this.armOrder[this.armIdx], pcx, pcy, world);
                    this.armIdx++;
                    this.armNext += p2 ? 0.36 : 0.55;
                }
                if (this.armIdx >= 4 && !this.slams.length) this._set('walk', p2 ? 0.8 : 1.3);
                break;
        }
        // Trübung klingt außerhalb des Sturms wieder ab
        if (this.state !== 'storm' && this.state !== 'stormCharge') this.hazeK = Math.max(0, this.hazeK - dt * 1.6);
        this._keepInRoom();
        if (this.state === 'stormCharge' || this.state === 'storm' || this.hazeK > 0) {
            if (typeof BossMushroomGiant !== 'undefined' && BossMushroomGiant.overlay) BossMushroomGiant.overlay(this, pcx, pcy);
        }
    }

    _nextAttack() {
        const order = BossTripleMummy.ORDER;
        const a = order[this.seq % order.length];
        this.seq++;
        if (a === 'storm') {
            this.windDir = Math.random() < 0.5 ? -1 : 1;
            this._set('stormCharge', this.phase === 2 ? 0.9 : 1.05);
        } else {
            this._set('arms', 99);
            this.armIdx = 0;
            this.armNext = 0;
            // abwechselnd links/rechts, mal oben, mal unten anfangen
            this.armOrder = Math.random() < 0.5 ? [0, 1, 2, 3] : [3, 2, 1, 0];
            if (Math.random() < 0.5) this.armOrder = [this.armOrder[1], this.armOrder[0], this.armOrder[3], this.armOrder[2]];
        }
    }

    // Langsam auf Mark zu, aber Abstand halten (~90–150)
    _walk(dt, world, pcx, pcy) {
        const dx = pcx - this.centerX(), dy = pcy - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        let dir = 0;
        if (d > 150) dir = 1;
        else if (d < 90) dir = -0.6;
        if (!dir) return;
        this.walkT += dt;
        const s = Math.sin(this.walkT * 3);
        const v = this.speed * (this.phase === 2 ? 1.2 : 1) * (0.55 + 0.9 * s * s) * dir;
        this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
        this.moving = true;
    }

    // Innenraum mit Rand; außerhalb des Spiels (Galerie) nahe der Startstelle
    _bounds() {
        const r = this._room;
        if (r) return { x0: r.x + 4, x1: r.x + r.w - this.w - 4, y0: r.y + 36, y1: r.y + r.h - this.h - 4 };
        const hx = (this.homeX || this.centerX()) - this.w / 2, hy = (this.homeY || this.centerY()) - this.h / 2;
        return { x0: hx - 60, x1: hx + 60, y0: hy - 40, y1: hy + 40 };
    }

    _keepInRoom() {
        const b = this._bounds();
        this.x = clamp(this.x, b.x0, Math.max(b.x0, b.x1));
        this.y = clamp(this.y, b.y0, Math.max(b.y0, b.y1));
    }

    // Fläche, über die der Sturm fegt (Boss-Raum oder Ersatz um die Startstelle)
    _arena() {
        const r = this._room;
        if (r) return r;
        const hx = this.homeX || this.centerX(), hy = this.homeY || this.centerY();
        return { x: hx - 176, y: hy - 144, w: 352, h: 288 };
    }

    // ── a) Sandsturm ──

    // Sanfter Wind: schiebt Mark langsam (Mark läuft ~150, der Wind ~40), nicht beim Ausweichen/im Auto
    _wind(dt, world, player) {
        if (!player || player.dead || player.autoActive || player.dodging || !player._moveWithCollision) return;
        const ws = (this.phase === 2 ? 46 : 38) * clamp(this.stormT / 0.6, 0, 1);
        player._moveWithCollision(this.windDir * ws * dt, 0, world);
    }

    // Eine Welle Sandkörner vom Rand auf der Windseite. 12 Spuren, eine wandernde Gasse bleibt frei.
    _emitWave(list) {
        if (!list) return;
        const p2 = this.phase === 2;
        const r = this._arena();
        const slots = 12, sh = r.h / slots;
        const gapC = slots / 2 + Math.sin(this.stormT * 0.8 + this.seed) * (slots / 2 - 2);
        const gapHalf = p2 ? 1.1 : 1.6;
        const free = [];
        for (let i = 0; i < slots; i++) if (Math.abs(i + 0.5 - gapC) > gapHalf) free.push(i);
        let n = Math.min(p2 ? 7 : 6, MUMMY_GRAIN_CAP - this.grains.length, free.length);
        const x = this.windDir > 0 ? r.x + 6 : r.x + r.w - 6;
        while (n-- > 0) {
            const j = Math.floor(Math.random() * free.length);
            const i = free[j];
            free.splice(j, 1);
            const y = r.y + (i + 0.5) * sh + randRange(-5, 5);
            const sp = p2 ? randRange(142, 152) : randRange(128, 138);
            const g = new SandGrain(x, y, this.windDir * sp, Math.random() * TAU);
            list.push(g);
            this.grains.push(g);
        }
    }

    // ── b) Armschläge ──

    // Schulter (Welt) je Arm: 0 links oben, 1 rechts oben, 2 links unten, 3 rechts unten
    _shoulder(i) {
        const side = i % 2 === 0 ? -1 : 1;
        const upper = i < 2;
        return { x: this._feetX() + side * (upper ? 31 : 35), y: this._feetY() - (upper ? 80 : 54), side };
    }

    _startSlam(arm, pcx, pcy, world) {
        const s = this._shoulder(arm);
        let tx = pcx, ty = pcy;
        // Reichweite begrenzen (die Binden-Arme dehnen sich bis ~165)
        const ddx = tx - s.x, ddy = ty - s.y;
        const dd = Math.hypot(ddx, ddy) || 1;
        if (dd > 165) { tx = s.x + ddx / dd * 165; ty = s.y + ddy / dd * 165; }
        const r = this._room;
        if (r) {
            tx = clamp(tx, r.x + 18, r.x + r.w - 18);
            ty = clamp(ty, r.y + 18, r.y + r.h - 18);
        }
        // nicht in eine Wand schlagen: zur Schulter hin nachrücken
        for (let k = 0; k < 8 && world && world.isWall && world.isWall(tx, ty); k++) {
            tx += (s.x - tx) * 0.2;
            ty += (s.y - ty) * 0.2;
        }
        const p2 = this.phase === 2;
        this.slams.push({ arm, x: tx, y: ty, age: 0, warn: p2 ? 0.62 : 0.85, hit: false });
    }

    _updateSlams(dt, player, world) {
        if (!this.slams.length) return;
        for (const s of this.slams) {
            s.age += dt;
            if (!s.hit && s.age >= s.warn) {
                s.hit = true;
                if (player && !player.dead) {
                    const px = player.x + player.w / 2, py = player.y + player.h / 2;
                    if (Math.hypot(px - s.x, py - s.y) < 34) MummyArt.hurt(player, 1, Math.atan2(py - s.y, px - s.x), 170);
                }
                MummyArt.shake(this.phase === 2 ? 5 : 4, 0.2);
                MummyArt.burst(s.x, s.y, ['#ffe2a0', '#e8c27a', '#fff6dc'], 10, 140, 0.5, { kind: 'smoke', size: 5 });
                MummyArt.ring(s.x, s.y, '#fff1c4', 40, 0.3, 4);
            }
        }
        compactInPlace(this.slams, s => s.age < s.warn + 0.62);
    }

    // ── Zeichnen ──

    // Warnkreise der Armschläge (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead || !this.slams.length) return;
        const A = ctx.globalAlpha;
        for (const s of this.slams) {
            if (s.age > s.warn + 0.15) continue;
            const k = clamp(s.age / s.warn, 0, 1);
            const p = camera.worldToScreen(s.x, s.y);
            ctx.globalAlpha = A * (0.16 + 0.16 * k);
            ctx.fillStyle = '#ff3d6e';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 34, 25, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = A * (0.55 + 0.4 * k);
            ctx.strokeStyle = '#ff3d6e';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.globalAlpha = A * 0.5;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 34 * k, 25 * k, 0, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = A;
    }

    // Sandsturm über allen Figuren (über BossMushroomGiant.overlay): Trübung mit klarem Fleck um Mark,
    // Sandschlieren, leuchtende Boss-Augen durch den Sand, Windpfeile in der Ankündigung.
    _drawOverlay(ctx, camera) {
        if (this.dead) return;
        const W = camera.width || 800, H = camera.height || 450;
        const t = Art.time, A = ctx.globalAlpha;
        const hz = this.hazeK;
        const m = camera.worldToScreen(this.markX, this.markY);
        ctx.save();
        if (hz > 0.01) {
            // Trübung in drei Lagen: außen dicht, um Mark herum klar
            ctx.fillStyle = '#f2d189';
            const holes = [[92, 0.2], [64, 0.14], [44, 0.1]];
            for (const h of holes) {
                ctx.globalAlpha = A * hz * h[1] * (this.phase === 2 ? 1.15 : 1);
                ctx.beginPath();
                ctx.rect(-40, -40, W + 80, H + 80);
                ctx.moveTo(m.x + h[0], m.y);
                ctx.arc(m.x, m.y, h[0], 0, TAU);
                ctx.fill('evenodd');
            }
            // Schlieren und Körnchen (berechnet aus der Zeit, ein Pfad je Sorte)
            const dir = this.windDir, span = W + 120;
            ctx.globalAlpha = A * hz * 0.6;
            ctx.strokeStyle = '#fff2cc';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 34; i++) {
                const sp = 260 + (i * 37) % 140;
                let x = ((i * 97.3 + t * sp) % span) - 60;
                if (dir < 0) x = W - x;
                const y = (i * 53.7 + 13) % (H + 20) - 10 + Math.sin(t * 2 + i) * 6;
                const len = 12 + (i * 7) % 14;
                ctx.moveTo(x, y);
                ctx.lineTo(x - dir * len, y + 1.5);
            }
            ctx.stroke();
            ctx.fillStyle = '#c98a3a';
            ctx.globalAlpha = A * hz * 0.55;
            ctx.beginPath();
            for (let i = 0; i < 40; i++) {
                const sp = 300 + (i * 53) % 160;
                let x = ((i * 71.9 + t * sp) % span) - 60;
                if (dir < 0) x = W - x;
                const y = (i * 41.3 + 7) % (H + 20) - 10 + Math.sin(t * 3 + i * 1.7) * 8;
                ctx.rect(x, y, 2.2, 1.6);
            }
            ctx.fill();
            // Augen des Bosses leuchten durch den Sand
            ctx.globalAlpha = A;
            const hp = this._headPositions();
            const cols = this._eyeCols();
            for (let i = 0; i < 3; i++) {
                const q = camera.worldToScreen(this._feetX() + hp[i * 2], this._feetY() + hp[i * 2 + 1]);
                Art.glow(ctx, q.x, q.y, 20, cols[i], 0.55 * hz);
            }
        }
        if (this.state === 'stormCharge') {
            // Windpfeile: zeigen, wohin der Wind gleich bläst
            const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
            const dir = this.windDir;
            ctx.globalAlpha = A * (0.35 + 0.35 * Math.abs(Math.sin(t * 8)));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let j = 0; j < 3; j++) {
                const y = H * (0.25 + j * 0.25);
                for (let i = 0; i < 3; i++) {
                    const x = W / 2 + dir * ((i - 1) * 34 + k * 30);
                    ctx.moveTo(x - dir * 12, y - 16);
                    ctx.lineTo(x + dir * 6, y);
                    ctx.lineTo(x - dir * 12, y + 16);
                }
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    // Kopfmitten relativ zu den Füßen: Mitte, links, rechts (x, y, …), ohne Wippen
    _headPositions() {
        return BossTripleMummy.HEADS;
    }

    _eyeCols() {
        const c = BossTripleMummy.EYE_COLS;
        if (this.phase !== 2) return c;
        return this._eyesP2 || (this._eyesP2 = c.map(x => Art.mix(x, '#ff3d4d', 0.35)));
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        ctx.save();
        ctx.translate(pos.x + this.w / 2, pos.y + this.h);
        if (this.dead) {
            const k = clamp(this.deathProgress(), 0, 1);
            const a0 = ctx.globalAlpha;
            ctx.globalAlpha = a0 * (1 - k * 0.8);
            ctx.scale(1 + k * 0.25, 1 - k * 0.7);
            this._drawAlive(ctx, true);
            ctx.globalAlpha = a0;
        } else {
            this._drawAlive(ctx, false);
        }
        ctx.restore();
    }

    // Haltung aus dem Zustand (nur Darstellung): Hände der vier Arme, Pusten, Wippen
    _pose(dead) {
        const p = this._pz, t = Art.time, st = this.state;
        const k = this.stateDur > 0 && this.stateDur < 90 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 0;
        p.step = this.moving ? Math.sin(this.walkT * 3) : 0;
        p.bob = this.moving ? -Math.abs(p.step) * 2.4 : Math.sin(t * 1.7 + this.seed) * 1.2;
        p.puff = 0;
        p.angry = this.phase === 2 || st === 'arms' || st === 'rage';
        p.shakeX = 0;
        p.swirl = 0;
        if (st === 'stormCharge') { p.puff = MummyArt.smooth(k * 1.4); p.swirl = k; }
        else if (st === 'storm') { p.puff = 0.75 + 0.25 * Math.sin(t * 9); p.swirl = 1; }
        else if (st === 'stormEnd') { p.swirl = clamp(this.stateT / this.stateDur, 0, 1); }
        else if (st === 'rage') { p.shakeX = Math.sin(t * 45) * 2.2 * (1 - k); }
        else if (st === 'intro') { p.bob -= Math.sin(k * Math.PI) * 3; }
        if (dead) { p.puff = 0; p.swirl = 0; }
        const fx = this._feetX(), fy = this._feetY();
        for (let i = 0; i < 4; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const upper = i < 2;
            const sx = side * (upper ? 31 : 35), sy = -(upper ? 80 : 54) + p.bob;
            const h = p.hands[i];
            h.sx = sx;
            h.sy = sy;
            // Ruhehaltung: obere Arme drohend erhoben, untere zur Seite
            const ph = t * 2.2 + i * 1.3 + this.seed;
            h.x = sx + side * (upper ? 30 : 24) + Math.sin(ph) * 2.5;
            h.y = sy + (upper ? -14 : 16) + Math.cos(ph) * 2.5;
            h.fist = false;
            h.glow = 0;
            if (p.swirl > 0) {
                // im Sturm alle Arme hoch, sie kreisen und „dirigieren“ den Sand
                const e = MummyArt.smooth(p.swirl * 1.5);
                const a = t * 5 + i * 1.6;
                h.x = lerp(h.x, sx + side * 26 + Math.cos(a) * 7, e);
                h.y = lerp(h.y, sy - 30 + Math.sin(a) * 6, e);
            } else if (st === 'rage') {
                h.y -= 12 * Math.sin(k * Math.PI);
                h.fist = true;
            }
        }
        // Armschläge: ausholen, zuschlagen, zurückziehen
        for (const s of this.slams) {
            const h = p.hands[s.arm];
            const lx = s.x - fx, ly = s.y - fy;
            const side = s.arm % 2 === 0 ? -1 : 1;
            const rx = h.sx + side * 18, ry = h.sy - 42;      // hoch über der Schulter
            h.fist = true;
            if (s.age < s.warn - 0.12) {
                const e = MummyArt.smooth(s.age / Math.max(0.1, s.warn - 0.12));
                h.x = lerp(h.x, rx, e) + (e > 0.9 ? Math.sin(t * 40) * 1.2 : 0);
                h.y = lerp(h.y, ry, e);
                h.glow = e;
            } else if (s.age < s.warn) {
                const e = (s.age - (s.warn - 0.12)) / 0.12;
                h.x = lerp(rx, lx, e * e);
                h.y = lerp(ry, ly, e * e);
                h.glow = 1;
            } else if (s.age < s.warn + 0.3) {
                h.x = lx;
                h.y = ly;
            } else {
                const e = MummyArt.smooth((s.age - s.warn - 0.3) / 0.32);
                h.x = lerp(lx, h.x, e);
                h.y = lerp(ly, h.y, e);
            }
        }
        return p;
    }

    _drawAlive(ctx, dead) {
        const p = this._pose(dead);
        const t = Art.time;
        const W = this.wrap, line = Art.dark(W, 0.2), ink = Art.ink(W);
        const p2 = this.phase === 2;
        const cols = this._eyeCols();
        ctx.save();
        ctx.translate(p.shakeX, 0);
        // Sandwirbel hinten
        if (p.swirl > 0) this._swirl(ctx, p, true);
        // Beine (gewickelt)
        const l0 = Math.max(0, p.step) * 4, l1 = Math.max(0, -p.step) * 4;
        for (let s = -1; s <= 1; s += 2) {
            const lift = s < 0 ? l0 : l1;
            Art.box(ctx, s * 15 - 8.5, -36 - lift, 17, 30, 7, line, { lineWidth: 2.2, highlight: false });
            MummyArt.wraps(ctx, s * 15, -34 - lift, s * 15, -8 - lift, 15, Art.dark(W, 0.34), [1.6, 4.4]);
            LateWorldArt.blob(ctx, s * 15 + s * 2, -5 - lift, 11, 5.5, line, 2);
        }
        // Rumpf mit Bindenstreifen
        const ty = -60 + p.bob;
        Art.body(ctx, 0, ty, 35, 31, W, { lineWidth: 2.4 });
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, ty, 34, 30, 0, 0, TAU);
        ctx.clip();
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const y = ty - 26 + i * 7.5;
            ctx.moveTo(-36, y + (i % 2 ? 4 : -2));
            ctx.lineTo(36, y + (i % 2 ? -3 : 5));
        }
        ctx.stroke();
        ctx.restore();
        // Gürtel und gestreifter Schurz (blau-gold)
        Art.shape(ctx, c => {
            c.moveTo(-17, ty + 26);
            c.lineTo(17, ty + 26);
            c.lineTo(21, ty + 48);
            c.lineTo(-21, ty + 48);
            c.closePath();
        }, { x: -21, y: ty + 26, w: 42, h: 22 }, '#3a72e8', { lineWidth: 2 });
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
            ctx.moveTo(i * 7, ty + 28);
            ctx.lineTo(i * 8.4, ty + 46);
        }
        ctx.stroke();
        Art.box(ctx, -30, ty + 19, 60, 9, 4, '#ffc83a', { lineWidth: 2 });
        Art.gem(ctx, 0, ty + 23.5, 4.4, '#20c3d8');
        // vier Arme
        for (let i = 3; i >= 0; i--) this._arm(ctx, p.hands[i], i, W, line);
        // drei Hälse, Kragen, drei Köpfe
        const H = BossTripleMummy.HEADS;
        const hb = [Math.sin(t * 2.1 + this.seed) * 1.6, Math.sin(t * 1.7 + this.seed + 2) * 2, Math.sin(t * 2.4 + this.seed + 4) * 1.8];
        for (let i = 1; i < 3; i++) {
            const s = i === 1 ? -1 : 1;
            Art.limb(ctx, s * 12, ty - 22, H[i * 2], H[i * 2 + 1] + p.bob + hb[i] + 6, 11, line, { lineWidth: 2 });
        }
        Art.limb(ctx, 0, ty - 22, 0, H[1] + p.bob + hb[0] + 8, 13, line, { lineWidth: 2 });
        this._collar(ctx, ty - 26);
        // Blickrichtungen: Mitte auf Mark, links lauert zur Seite, rechts rollt mit den Augen
        const lookC = this.look;
        const lookL = { x: -0.75 + Math.sin(t * 0.9 + this.seed) * 0.3, y: 0.15 + Math.cos(t * 1.3) * 0.25 };
        const lookR = { x: Math.sin(t * 1.6 + this.seed) * 0.8, y: -0.5 + Math.cos(t * 1.6 + this.seed) * 0.4 };
        if (p.puff > 0) {
            const wl = { x: this.windDir, y: 0 };
            lookL.x = lerp(lookL.x, wl.x, p.puff);
            lookR.x = lerp(lookR.x, wl.x, p.puff);
        }
        const tilt = [Math.sin(t * 1.1) * 0.05, -0.16 + Math.sin(t * 0.8) * 0.06, 0.14 + Math.sin(t * 1.4) * 0.08];
        this._head(ctx, H[2], H[3] + p.bob + hb[1], 13.5, cols[1], lookL, 'band', p, tilt[1], dead, 1);
        this._head(ctx, H[4], H[5] + p.bob + hb[2], 13.5, cols[2], lookR, 'sun', p, tilt[2], dead, 2);
        this._head(ctx, H[0], H[1] + p.bob + hb[0], 16, cols[0], lookC, 'nemes', p, tilt[0], dead, 0);
        // Phase 2: lose, zerrissene Binden flattern zusätzlich
        if (p2 && !dead) {
            const fl = Math.sin(t * 7) * 4;
            MummyArt.ribbon(ctx, -24, ty + 8, -40, ty + 4 + fl, -50, ty + 14 - fl, 3, W);
            MummyArt.ribbon(ctx, 22, ty - 12, 40, ty - 18 - fl, 52, ty - 8 + fl, 3, W);
        }
        // Sandwirbel vorn
        if (p.swirl > 0) this._swirl(ctx, p, false);
        ctx.restore();
    }

    // Arm aus Schulter → Ellbogen → Hand, gewickelt (dehnbar wie ein Gummiband)
    _arm(ctx, h, i, W, line) {
        const side = i % 2 === 0 ? -1 : 1;
        const mx = (h.sx + h.x) / 2, my = (h.sy + h.y) / 2;
        const len = Math.hypot(h.x - h.sx, h.y - h.sy) || 1;
        const bend = Math.min(14, 260 / len);
        const ex = mx + side * bend * 0.6, ey = my - bend;
        const col = i < 2 ? W : Art.dark(W, 0.06);
        const wcol = Art.dark(W, 0.3);
        Art.limb(ctx, h.sx, h.sy, ex, ey, 11, col, { lineWidth: 2 });
        Art.limb(ctx, ex, ey, h.x, h.y, 10, col, { lineWidth: 2 });
        MummyArt.wraps(ctx, h.sx, h.sy, ex, ey, 9, wcol, [1.4, 4.6]);
        MummyArt.wraps(ctx, ex, ey, h.x, h.y, 8, wcol, [1.4, 4.6]);
        if (h.glow > 0) Art.glow(ctx, h.x, h.y, 20, '#ffcf6b', 0.6 * h.glow);
        // Hand: offen mit drei Fingern oder Faust
        if (h.fist) {
            Art.body(ctx, h.x, h.y, 8.5, 7.5, col, { lineWidth: 2 });
        } else {
            ctx.strokeStyle = Art.ink(col);
            ctx.lineWidth = 6.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let f = -1; f <= 1; f++) {
                const a = (side > 0 ? 0 : Math.PI) + f * 0.55 - side * 0.3;
                ctx.moveTo(h.x, h.y);
                ctx.lineTo(h.x + Math.cos(a) * 9, h.y + Math.sin(a) * 9);
            }
            ctx.stroke();
            ctx.strokeStyle = col;
            ctx.lineWidth = 3.4;
            ctx.stroke();
            Art.body(ctx, h.x, h.y, 6.5, 6, col, { lineWidth: 2, highlight: false });
        }
        // loses Bindenende am Ellbogen
        const fl = Math.sin(Art.time * 6 + i * 1.7) * 3;
        MummyArt.ribbon(ctx, ex, ey, ex + side * 8, ey + 6 + fl, ex + side * 5, ey + 15 - fl, 2.4, W);
    }

    // Goldener Pharaonen-Kragen mit Türkis- und Lapis-Reihen und Perlen
    _collar(ctx, y) {
        Art.shape(ctx, c => {
            c.ellipse(0, y, 33, 19, 0, 0, Math.PI);
            c.ellipse(0, y, 14, 7, 0, Math.PI, 0, true);
            c.closePath();
        }, { x: -33, y, w: 66, h: 19 }, '#ffc83a', { lineWidth: 2.2, glossy: true });
        ctx.lineCap = 'butt';
        ctx.lineWidth = 3.4;
        ctx.strokeStyle = '#20c3d8';
        ctx.beginPath();
        ctx.ellipse(0, y, 27, 15, 0, 0.08, Math.PI - 0.08);
        ctx.stroke();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#2f55d4';
        ctx.beginPath();
        ctx.ellipse(0, y, 20.5, 10.8, 0, 0.1, Math.PI - 0.1);
        ctx.stroke();
        // Perlen am Rand
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
            const a = 0.16 + i * (Math.PI - 0.32) / 8;
            const x = Math.cos(a) * 32, yy = y + Math.sin(a) * 18.5;
            ctx.moveTo(x + 2.3, yy);
            ctx.arc(x, yy, 2.3, 0, TAU);
        }
        ctx.fill();
        ctx.strokeStyle = '#8a1a30';
        ctx.lineWidth = 0.9;
        ctx.stroke();
    }

    // Ein Kopf. kind: 'nemes' (Pharaonen-Kopftuch), 'band' (Türkis-Stirnband), 'sun' (Sonnenscheibe)
    _head(ctx, hx, hy, r, eyeCol, look, kind, p, tilt, dead, idx) {
        const W = this.wrap, line = Art.dark(W, 0.2);
        const t = Art.time;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(tilt);
        const puff = p.puff;
        if (kind === 'nemes') {
            // Kopftuch-Flügel hinter dem Kopf
            Art.shape(ctx, c => {
                c.moveTo(-r * 0.9, -r * 0.7);
                c.lineTo(r * 0.9, -r * 0.7);
                c.lineTo(r * 1.45, r * 1.15);
                c.lineTo(r * 0.7, r * 1.25);
                c.lineTo(0, r * 0.6);
                c.lineTo(-r * 0.7, r * 1.25);
                c.lineTo(-r * 1.45, r * 1.15);
                c.closePath();
            }, { x: -r * 1.45, y: -r * 0.7, w: r * 2.9, h: r * 1.95 }, '#3a72e8', { lineWidth: 2 });
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const y = r * (0.05 + i * 0.36);
                ctx.moveTo(-r * (1.05 + i * 0.12), y);
                ctx.lineTo(-r * 0.75, y);
                ctx.moveTo(r * (1.05 + i * 0.12), y);
                ctx.lineTo(r * 0.75, y);
            }
            ctx.stroke();
        }
        // Kopf (beim Pusten mit dicken Backen)
        const rx = r * (1 + puff * 0.14), ry = r * (0.96 - puff * 0.03);
        Art.body(ctx, 0, 0, rx, ry, W, { lineWidth: 2 });
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, 0, rx - 1, ry - 1, 0, 0, TAU);
        ctx.clip();
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const y = -r * 0.85 + i * r * 0.55;
            ctx.moveTo(-r * 1.2, y + (i % 2 ? r * 0.18 : -r * 0.1));
            ctx.lineTo(r * 1.2, y + (i % 2 ? -r * 0.12 : r * 0.16));
        }
        ctx.stroke();
        ctx.restore();
        // Kopfschmuck vorn
        if (kind === 'nemes') {
            Art.shape(ctx, c => {
                c.moveTo(-r * 1.02, -r * 0.18);
                c.quadraticCurveTo(-r * 1.05, -r * 1.25, 0, -r * 1.22);
                c.quadraticCurveTo(r * 1.05, -r * 1.25, r * 1.02, -r * 0.18);
                c.quadraticCurveTo(0, -r * 0.62, -r * 1.02, -r * 0.18);
                c.closePath();
            }, { x: -r * 1.05, y: -r * 1.25, w: r * 2.1, h: r * 1.1 }, '#ffc83a', { lineWidth: 2, glossy: true });
            ctx.strokeStyle = '#3a72e8';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(-r * 0.55, -r * 0.42);
            ctx.lineTo(-r * 0.62, -r * 1.05);
            ctx.moveTo(r * 0.55, -r * 0.42);
            ctx.lineTo(r * 0.62, -r * 1.05);
            ctx.moveTo(0, -r * 0.6);
            ctx.lineTo(0, -r * 1.2);
            ctx.stroke();
            // Kobra auf der Stirn
            Art.body(ctx, 0, -r * 0.82, r * 0.17, r * 0.3, '#ffd23f', { lineWidth: 1.2, highlight: false });
            Art.body(ctx, 0, -r * 1.06, r * 0.15, r * 0.13, '#ff4d6d', { lineWidth: 1, highlight: false });
        } else if (kind === 'band') {
            ctx.strokeStyle = '#11738a';
            ctx.lineWidth = 6;
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.ellipse(0, -r * 0.32, r * 0.98, r * 0.42, 0, Math.PI * 1.05, Math.PI * 1.95);
            ctx.stroke();
            ctx.strokeStyle = '#2ee0f0';
            ctx.lineWidth = 3.6;
            ctx.stroke();
            Art.gem(ctx, 0, -r * 0.72, r * 0.26, '#ff4d6d');
        } else {
            // Sonnenscheibe zwischen zwei kleinen Hörnern
            ctx.strokeStyle = '#8a5a1a';
            ctx.lineWidth = 4.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-r * 0.75, -r * 0.7);
            ctx.quadraticCurveTo(-r * 1.15, -r * 1.35, -r * 0.55, -r * 1.55);
            ctx.moveTo(r * 0.75, -r * 0.7);
            ctx.quadraticCurveTo(r * 1.15, -r * 1.35, r * 0.55, -r * 1.55);
            ctx.stroke();
            ctx.strokeStyle = '#ffe9b0';
            ctx.lineWidth = 2.4;
            ctx.stroke();
            if (!dead) Art.glow(ctx, 0, -r * 1.3, r * 1.2, '#ff6a3d', 0.35 + 0.1 * Math.sin(t * 3));
            Art.body(ctx, 0, -r * 1.25, r * 0.52, r * 0.52, '#ff5a3a', { lineWidth: 1.6 });
        }
        // Sehschlitz mit leuchtenden Augen (jeder Kopf eigene Farbe)
        const sy = -r * 0.06;
        ctx.fillStyle = '#2a170c';
        ctx.beginPath();
        ctx.roundRect(-r * 0.85, sy - r * 0.27, r * 1.7, r * 0.54, r * 0.27);
        ctx.fill();
        if (dead) {
            LateWorldArt.xEyes(ctx, 0, sy, r * 0.17, r * 0.36);
        } else {
            const lx = clamp(look.x, -1, 1) * r * 0.18, ly = clamp(look.y, -1, 1) * r * 0.05;
            const big = this.phase === 2 ? 1.15 : 1;
            Art.glow(ctx, lx, sy, r * 1.6 * big, eyeCol, 0.6);
            const open = Art.blink(this.seed + idx * 1.9);
            ctx.fillStyle = eyeCol;
            ctx.beginPath();
            ctx.ellipse(-r * 0.36 + lx, sy + ly, r * 0.19 * big, r * 0.16 * open, 0, 0, TAU);
            ctx.ellipse(r * 0.36 + lx, sy + ly, r * 0.19 * big, r * 0.16 * open, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-r * 0.36 + lx, sy + ly, r * 0.07, 0, TAU);
            ctx.arc(r * 0.36 + lx, sy + ly, r * 0.07, 0, TAU);
            ctx.fill();
            if (p.angry) {
                // böse Brauen aus Binden über dem Schlitz
                ctx.strokeStyle = line;
                ctx.lineWidth = 2.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-r * 0.7, sy - r * 0.5);
                ctx.lineTo(-r * 0.12, sy - r * 0.33);
                ctx.moveTo(r * 0.7, sy - r * 0.5);
                ctx.lineTo(r * 0.12, sy - r * 0.33);
                ctx.stroke();
            }
        }
        // Mund: Pusten = runder Mund mit Sandwolke, sonst schmaler Bindenspalt
        if (puff > 0.05 && !dead) {
            const mx = this.windDir * r * 0.18;
            ctx.fillStyle = '#3a0d1e';
            ctx.beginPath();
            ctx.ellipse(mx, r * 0.5, r * 0.18 * (0.6 + puff * 0.4), r * 0.2 * (0.6 + puff * 0.4), 0, 0, TAU);
            ctx.fill();
            // Sandwölkchen aus dem Mund in Windrichtung
            ctx.fillStyle = '#ffe2a0';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const q = (t * 2.2 + i / 3 + idx * 0.27) % 1;
                const x = mx + this.windDir * (r * 0.4 + q * r * 1.6), y = r * 0.5 + Math.sin(q * 6 + idx) * 2;
                const rr = r * (0.12 + q * 0.2) * puff;
                ctx.moveTo(x + rr, y);
                ctx.arc(x, y, rr, 0, TAU);
            }
            ctx.fill();
        } else {
            ctx.strokeStyle = '#3a0d1e';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (p.angry && !dead) {
                ctx.moveTo(-r * 0.36, r * 0.55);
                ctx.lineTo(-r * 0.12, r * 0.45);
                ctx.lineTo(r * 0.12, r * 0.55);
                ctx.lineTo(r * 0.36, r * 0.45);
            } else {
                ctx.moveTo(-r * 0.3, r * 0.5);
                ctx.quadraticCurveTo(0, r * 0.62, r * 0.3, r * 0.48);
            }
            ctx.stroke();
        }
        // loses Bindenende am Kopf
        const s = idx === 1 ? -1 : 1;
        const fl = Math.sin(t * 6.5 + idx * 2) * 3;
        MummyArt.ribbon(ctx, s * r * 0.9, r * 0.2, s * r * 1.5, r * 0.3 + fl, s * r * 1.9, r * 0.85 - fl, 2.4, W);
        ctx.restore();
    }

    // Wirbelnder Sand um den Boss (back = hintere Hälfte des Rings)
    _swirl(ctx, p, back) {
        const t = Art.time, k = p.swirl;
        const cy = -62 + p.bob;
        const A = ctx.globalAlpha;
        ctx.globalAlpha = A * 0.35 * k;
        ctx.strokeStyle = '#ffe2a0';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const a0 = t * 4;
        if (back) ctx.ellipse(0, cy, 74, 30, 0, Math.PI + a0 % 0.6, TAU - 0.3);
        else ctx.ellipse(0, cy, 74, 30, 0, 0.2 + a0 % 0.6, Math.PI - 0.2);
        ctx.stroke();
        ctx.globalAlpha = A * k;
        ctx.fillStyle = back ? '#e8b660' : '#ffd27a';
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
            const a = t * (3 + (i % 3) * 0.6) + i * 0.9;
            const s = Math.sin(a);
            if ((s < 0) !== back) continue;
            const rr = 60 + (i * 13) % 26;
            const x = Math.cos(a) * rr, y = cy + s * rr * 0.4 - 10 + (i % 4) * 8;
            const g = 1.6 + (i % 3) * 0.7;
            ctx.moveTo(x + g, y);
            ctx.arc(x, y, g, 0, TAU);
        }
        ctx.fill();
        ctx.globalAlpha = A;
    }
}

// Angriffsfolge: Sandsturm ist der große Angriff, dazwischen zweimal Armschläge
BossTripleMummy.ORDER = ['storm', 'arms', 'arms'];
// Kopfmitten relativ zu den Füßen: Mitte, links, rechts
BossTripleMummy.HEADS = [0, -124, -36, -110, 36, -110];
// Augenfarben: Mitte gold, links türkis, rechts pink
BossTripleMummy.EYE_COLS = ['#ffd23f', '#3ff0ff', '#ff5ad8'];
