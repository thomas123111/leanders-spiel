// ── Welt 33: Alienplanet ──
// Leanders Wunsch: „Aliens mit Pistolen, die auf Mark und seine Freunde schießen. Der Boss ist ein
// Raumschiff mit drei Blasterkanonen.“
//
//   AlienKit        gemeinsame Helfer: Farben, Sichtlinie, Boss-Geschosse zählen, Freunde treffen
//   AlienLaser      schneller Laserblitz der Alien-Schützen (trifft auch Juri und das Krokodil: kurz betäubt)
//   AlienVolleyBolt Einzelfeuers Bolzen der drei Blaster
//   AlienOrb        Laserkugel aus dem Phalanx-Ring des Bosses (Phase 2)
//   AlienGunner     kleines grünes Alien: hält Abstand, läuft seitlich, zielt (0,5 s Warnlinie) und schießt
//   AlienDrone      kleine Drohne, die der Boss ruft (nur im Boss-Raum, verpufft mit ihm)
//   BossAlienShip   „Blaster-Raumschiff“: fliegende Untertasse mit Pilot in der Glaskuppel und drei
//                   Blastern unten (links, Mitte, rechts). Dreifachfeuer auf Mark und die Freunde,
//                   schwenkender Strahl des Mittelblasters, Phase 2: Laserkugel-Ring mit Lücken, Lichter rot.
//
// Leistung: pro Bild weit unter 40 Pfadoperationen beim normalen Gegner; Boss-Geschosse höchstens 60
// gleichzeitig (AlienKit.BOSS_CAP); alle Zufallswerte liegen im Konstruktor.

const AlienKit = {
    GREEN: '#5ddb4a',      // Alien-Haut
    SKIN: '#8dff74',
    SUIT: '#c3ccdd',       // silberner Anzug
    DISC: '#b9c4d8',       // Untertassen-Hülle
    LASER: '#7dff6a',      // Lasergrün
    LASER_CORE: '#eafff0',
    CYAN: '#5ff2ff',
    PINK: '#ff5fd2',
    GOLD: '#ffd23f',
    DANGER: '#ff3d5a',
    BOSS_CAP: 60,          // höchstens so viele Boss-Geschosse gleichzeitig

    // Feste Lichterpositionen am Untertassenrand (liegen fest, kein Zufall im Bild)
    RIM: [
        { a: 0.18, c: '#5ff2ff' }, { a: 0.72, c: '#ffd23f' }, { a: 1.30, c: '#ff5fd2' },
        { a: 1.88, c: '#5ff2ff' }, { a: 2.46, c: '#ffd23f' }, { a: 3.14, c: '#ff5fd2' },
        { a: 3.82, c: '#5ff2ff' }, { a: 4.40, c: '#ffd23f' }, { a: 4.98, c: '#ff5fd2' },
        { a: 5.56, c: '#5ff2ff' },
    ],

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

    // Noch lebende Boss-Geschosse dieser Welt (gegen die Leistungsobergrenze)
    liveBossShots(list) {
        let n = 0;
        if (!list) return 0;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (p.fromBoss && !p.dead) n++;
        }
        return n;
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

    // Wache, treffbare Begleiter (Juri, Krokodil – nicht die Schlange auf Marks Schulter)
    companions() {
        const out = [];
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Freunde verschwinden nie: ein tödlicher Treffer haut sie nur um (wie in angel.js)
    hitCompanion(c, amount) {
        if (!c || c.dead) return;
        if (c.hp - amount <= 0) c.knockOut(8);
        else if (c.takeDamage) c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [AlienKit.LASER, '#ffffff'], 8, 130, 0.4, { kind: 'spark' });
    },

    // Mark verletzen (Engine kümmert sich um Herzchen, Wackeln und Schutzzeit)
    hurtMark(amount, angle, force) {
        if (typeof Game !== 'undefined' && typeof Game.hurtPlayer === 'function') Game.hurtPlayer(amount, angle, force);
    },

    // Kleinste Winkeldifferenz (für sanftes Nachdrehen der Blaster)
    angleTo(cur, want, k) {
        let d = (want - cur) % TAU;
        if (d > Math.PI) d -= TAU;
        if (d < -Math.PI) d += TAU;
        return cur + d * k;
    },

    // Kurzer Zielpfeil über einem Ziel (wie beim Schwert-Engel)
    targetArrow(ctx, x, y) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = AlienKit.DANGER;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 5.5, y - 6.5);
        ctx.lineTo(x + 5.5, y - 6.5);
        ctx.lineTo(x, y + 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
    },
};

// ══════════════════════════════════════════
// Geschosse
// ══════════════════════════════════════════

// Schneller Laserblitz des Alien-Schützen: 1 Schaden für Mark; trifft er Juri oder das Krokodil,
// sind sie kurz betäubt (main.js: hitsCompanions/stunTime). Dünne grüne Garbe mit weißem Kern.
class AlienLaser extends Projectile {
    constructor(x, y, angle, speed, o = {}) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 70);
        this.radius = o.radius || 4;
        this.lifetime = o.life || 1.5;
        this.hitsCompanions = true;
        this.stunTime = o.stun === undefined ? 1.2 : o.stun;
        this.color = o.color || AlienKit.LASER;
        this.ang = angle;
        this.gold = !!o.gold;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const fade = clamp(this.lifetime / 0.15, 0, 1);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * fade;
        const col = this.gold ? AlienKit.GOLD : this.color;
        const ux = Math.cos(this.ang), uy = Math.sin(this.ang);
        Art.glow(ctx, p.x, p.y, 11, col, 0.7);
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - ux * 10, p.y - uy * 10);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x - ux * 6, p.y - uy * 6);
        ctx.lineTo(p.x + ux * 2, p.y + uy * 2);
        ctx.stroke();
        ctx.globalAlpha = a0;
    }
}

// Einzelfeuers Bolzen eines Blasters: 1 Schaden, trifft auch die Freunde (kurz betäubt).
class AlienVolleyBolt extends Projectile {
    constructor(x, y, angle, speed) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 70);
        this.radius = 4.5;
        this.lifetime = 2.1;
        this.hitsCompanions = true;
        this.stunTime = 1.2;
        this.fromBoss = true;
        this.ang = angle;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const born = Math.min(1, this.age / 0.08);
        const fade = clamp(this.lifetime / 0.2, 0, 1);
        const a0 = ctx.globalAlpha;
        if (fade < 1) ctx.globalAlpha = a0 * fade;
        const r = 4.2 * (0.6 + 0.4 * born);
        Art.glow(ctx, p.x, p.y, 12, AlienKit.CYAN, 0.6);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.ang);
        Art.body(ctx, 0, 0, r * 1.7, r, AlienKit.CYAN, { lineWidth: 1.1, glossy: true });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r * 0.5, 0, r * 0.45, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = a0;
    }
}

// Laserkugel aus dem Phalanx-Ring (Phase 2): fliegt gerade, 1 Schaden, trifft auch Freunde.
// Lebt nur 2,6 s, damit die Arena nie volllaäuft (zusätzlich Kappe AlienKit.BOSS_CAP).
class AlienOrb extends Projectile {
    constructor(x, y, angle, speed) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 60);
        this.radius = 5;
        this.lifetime = 2.6;
        this.hitsCompanions = true;
        this.stunTime = 1;
        this.fromBoss = true;
        this.seed = Math.random() * 10;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const fade = clamp(this.lifetime / 0.25, 0, 1);
        const a0 = ctx.globalAlpha;
        if (fade < 1) ctx.globalAlpha = a0 * fade;
        const pulse = 0.85 + 0.15 * Math.sin(Art.time * 14 + this.seed * 3);
        Art.glow(ctx, p.x, p.y, 14 * pulse, AlienKit.PINK, 0.6);
        Art.body(ctx, p.x, p.y, 4.6, 4.6, AlienKit.PINK, { lineWidth: 1.2, glossy: true });
        Art.sparkle(ctx, p.x, p.y, 3.4, '#ffffff', 0.5 + 0.5 * Math.sin(Art.time * 10 + this.seed));
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// Gemeinsame Alien-Figur (Kopf, Augen, Antennen) – Schütze, Drohne und Pilot
// ══════════════════════════════════════════

function drawAlienFace(ctx, x, y, s, look, angry, glowCol, glowA, dead) {
    // großer Kopf
    Art.body(ctx, x, y - 2 * s, 9.6 * s, 8.6 * s, AlienKit.GREEN, { lineWidth: 1.5 * s });
    if (dead) {
        // besiegt: drei durchgestrichene Augen
        ctx.strokeStyle = '#141019';
        ctx.lineWidth = 1.3 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const ex of [-4.5, 0, 4.5]) {
            const ey = ex === 0 ? -4.4 : -3.2;
            ctx.moveTo(x + (ex - 1.9) * s, y + (ey - 1.9) * s);
            ctx.lineTo(x + (ex + 1.9) * s, y + (ey + 1.9) * s);
            ctx.moveTo(x + (ex + 1.9) * s, y + (ey - 1.9) * s);
            ctx.lineTo(x + (ex - 1.9) * s, y + (ey + 1.9) * s);
        }
        ctx.stroke();
        return;
    }
    // drei große schwarze Augen (Mitte etwas höher)
    ctx.fillStyle = '#141019';
    const eye = (ex, ey, r) => {
        ctx.beginPath();
        ctx.ellipse(x + ex * s, y + ey * s, 2.5 * r * s, 3.1 * r * s, 0, 0, TAU);
        ctx.fill();
    };
    eye(-4.5, -3.2, 1);
    eye(0, -4.4, 0.9);
    eye(4.5, -3.2, 1);
    ctx.fillStyle = '#ffffff';
    for (const e of [[-4.5, -4.3], [0, -5.5], [4.5, -4.3]]) {
        ctx.beginPath();
        ctx.arc(x + (e[0] + 0.8 * (look.x || 0)) * s, y + (e[1] + 0.6 * (look.y || 0)) * s, 0.95 * s, 0, TAU);
        ctx.fill();
    }
    if (glowCol) Art.glow(ctx, x, y - 3 * s, 11 * s, glowCol, glowA);
    // Mund: frech-grinzen oder böse offen
    ctx.strokeStyle = Art.INK;
    ctx.lineWidth = 1.15 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (angry) {
        ctx.moveTo(x - 3 * s, y + 3.6 * s);
        ctx.quadraticCurveTo(x, y + 2.2 * s, x + 3 * s, y + 3.6 * s);
    } else {
        ctx.moveTo(x - 2.6 * s, y + 2.6 * s);
        ctx.quadraticCurveTo(x, y + 4.4 * s, x + 2.6 * s, y + 2.6 * s);
    }
    ctx.stroke();
}

function drawAlienAntennae(ctx, x, y, s, t, seed, tipCol) {
    const sway = Math.sin(t * 2.6 + seed) * 1.4 * s;
    ctx.strokeStyle = Art.ink(AlienKit.GREEN);
    ctx.lineWidth = 1.1 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 3.4 * s, y - 9 * s);
    ctx.quadraticCurveTo(x - 6 * s + sway, y - 14 * s, x - 7 * s + sway, y - 16 * s);
    ctx.moveTo(x + 3.4 * s, y - 9 * s);
    ctx.quadraticCurveTo(x + 6 * s + sway, y - 14 * s, x + 7 * s + sway, y - 16 * s);
    ctx.stroke();
    const pulse = 0.6 + 0.4 * Math.sin(t * 5 + seed);
    ctx.fillStyle = tipCol;
    for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + sx * 7 * s + sway, y - 16 * s, 1.7 * s, 0, TAU);
        ctx.fill();
    }
    Art.glow(ctx, x + sway, y - 15.5 * s, 7 * s, tipCol, 0.25 * pulse);
}

// ══════════════════════════════════════════
// Alien-Schütze (normaler Gegner)
// ══════════════════════════════════════════

// Kleines grünes Alien mit Riesenkopf, drei schwarzen Augen, Antennen mit Leuchtkugeln, silbernem
// Anzug und Strahlenpistole. Hält 95–150 Abstand zu Mark und läuft seitlich um ihn herum. Alle
// 2,2–3,2 s (Schlüsselträger 1,7–2,5 s): 0,5 s Zielen – Pistole leuchtet, dünne Warnlinie zum Ziel,
// die letzten 0,15 s steht die Richtung fest –, dann ein schneller Laserblitz auf Mark oder einen
// Freund. Trifft der Blitz Juri/das Krokodil, sind sie 1,2 s benommen.
class AlienGunner extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = 58;
        this.damage = 1;
        this.flying = true;             // schwebt ein klein wenig über dem Boden
        this.fxColor = AlienKit.LASER;
        this.seed = Math.random() * 10;
        this.t = Math.random() * 10;
        this.look = { x: 0, y: 0.3 };
        this.face = 1;
        this.orbitR = randRange(95, 150);
        this.orbitDir = Math.random() < 0.5 ? -1 : 1;
        this.wanderA = Math.random() * TAU;
        this.flipCd = 0;
        this.engaged = false;
        this.state = 'walk';            // walk | aim | shot
        this.stateT = 0;
        this.shotTimer = randRange(1.2, 2.4);
        this.tgt = null;
        this.aimX = 0;
        this.aimY = 0;
        this.recoil = 0;
        this.isKeyGhost = false;        // setzt main.js beim Schlüsselträger
        this.droppedKey = false;
        this._keyReady = false;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        // main.js setzt isKeyGhost von außen: dann mehr Lebenspunkte und goldene Effekte
        if (this.isKeyGhost && !this._keyReady) {
            this._keyReady = true;
            this.hp = 8;
            this.maxHp = 8;
            this.fxColor = AlienKit.GOLD;
        }
        this.t += dt;
        if (this.flipCd > 0) this.flipCd -= dt;
        if (this.recoil > 0) this.recoil -= dt * 5;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        this.engaged = !player.dead && dist < (this.engaged ? 330 : 260);

        // Bewegung: Abstand halten + seitlich laufen (Richtung steht im Ziel-Moment still)
        let vx, vy;
        if (this.engaged) {
            const radial = clamp((dist - this.orbitR) / 45, -0.7, 1);
            const tang = this.state === 'aim' ? 0.12 : 0.6;
            vx = nx * radial - ny * tang * this.orbitDir;
            vy = ny * radial + nx * tang * this.orbitDir;
        } else {
            this.wanderA += Math.sin(this.t * 0.6 + this.seed) * dt * 1.4;
            vx = Math.cos(this.wanderA) * 0.45;
            vy = Math.sin(this.wanderA) * 0.45;
        }
        const sp = this.speed * (this.state === 'aim' ? 0.45 : 1);
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
        const want = (Math.abs(vx) + Math.abs(vy)) * sp * dt;
        if (want > 0.3 && Math.abs(this.x - ox) + Math.abs(this.y - oy) < want * 0.4 && this.flipCd <= 0) {
            this.orbitDir = -this.orbitDir;   // Wand im Weg: andere Richtung um Mark herum
            this.flipCd = 0.7;
        }
        if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;

        // Blick (nur Darstellung): im Zielen zur Waffe, sonst zu Mark
        let lx = nx, ly = ny;
        if (this.state === 'aim') {
            const ax = this.aimX - mx, ay = this.aimY - my, ad = Math.hypot(ax, ay) || 1;
            lx = ax / ad; ly = ay / ad;
        }
        const lk = Math.min(1, dt * 8);
        this.look.x += ((this.engaged ? lx : Math.cos(this.wanderA) * 0.5) - this.look.x) * lk;
        this.look.y += ((this.engaged ? ly : 0.3) - this.look.y) * lk;

        // Zustandsmaschine: walk → aim (0,5 s Warnlinie) → shot (0,18 s) → walk
        this.stateT -= dt;
        switch (this.state) {
            case 'aim':
                // Ziel verfolgen; die letzten 0,15 s steht die Richtung fest (fair zum Ausweichen)
                if (this.stateT > 0.15 && this.tgt && !this.tgt.dead) {
                    this.aimX = this.tgt.x + (this.tgt.w || 20) / 2;
                    this.aimY = this.tgt.y + (this.tgt.h || 20) / 2;
                }
                if (this.stateT <= 0) {
                    this._shoot(projectiles);
                    this.state = 'shot';
                    this.stateT = 0.18;
                }
                break;
            case 'shot':
                if (this.stateT <= 0) {
                    this.state = 'walk';
                    this.shotTimer = this.isKeyGhost ? randRange(1.7, 2.5) : randRange(2.2, 3.2);
                }
                break;
            default:
                if (this.engaged && dist < 280) {
                    this.shotTimer -= dt;
                    if (this.shotTimer <= 0) {
                        const tg = this._pickTarget(world, player, mx, my, px, py);
                        if (tg) {
                            this.tgt = tg;
                            this.aimX = tg.x + (tg.w || 20) / 2;
                            this.aimY = tg.y + (tg.h || 20) / 2;
                            this.state = 'aim';
                            this.stateT = 0.5;
                        } else {
                            this.shotTimer = 0.35;   // Wand dazwischen: gleich noch mal versuchen
                        }
                    }
                }
        }
    }

    // Meist Mark, manchmal (40 %) ein Freund in Reichweite mit freier Sicht
    _pickTarget(world, player, mx, my, px, py) {
        const markOk = AlienKit.clearLine(world, mx, my, px, py);
        if (Math.random() < 0.4) {
            const cs = AlienKit.companions();
            const start = Math.floor(Math.random() * Math.max(1, cs.length));
            for (let k = 0; k < cs.length; k++) {
                const c = cs[(start + k) % cs.length];
                const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                if (Math.hypot(cx - mx, cy - my) > 270) continue;
                if (AlienKit.clearLine(world, mx, my, cx, cy)) return c;
            }
        }
        return markOk ? player : null;
    }

    _shoot(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const mx = this.centerX(), my = this.centerY();
        const a = Math.atan2(this.aimY - my, this.aimX - mx);
        if (list) {
            list.push(new AlienLaser(mx + Math.cos(a) * 12, my + Math.sin(a) * 12, a, 320,
                { gold: this.isKeyGhost }));
        }
        this.recoil = 1;
        AlienKit.burst(mx + Math.cos(a) * 13, my + Math.sin(a) * 13,
            [this.isKeyGhost ? AlienKit.GOLD : AlienKit.LASER, '#ffffff'], 4, 110, 0.22, { kind: 'spark' });
    }

    // Warnlinie der Strahlenpistole (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead || this.state !== 'aim') return;
        const k = clamp(1 - this.stateT / 0.5, 0, 1);
        const mx = this.centerX(), my = this.centerY();
        const dx = this.aimX - mx, dy = this.aimY - my;
        const d = Math.hypot(dx, dy) || 1;
        const locked = this.stateT <= 0.15;
        const L = Math.min(d + 8, 40 + 230 * k);
        const p = camera.worldToScreen(mx, my);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (0.28 + 0.5 * k) * (locked ? 0.75 + 0.25 * Math.sin(Art.time * 40) : 1);
        ctx.strokeStyle = locked ? '#ffffff' : AlienKit.LASER;
        ctx.lineWidth = locked ? 1.9 : 1.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x + (dx / d) * 11, p.y + (dy / d) * 11);
        ctx.lineTo(p.x + (dx / d) * L, p.y + (dy / d) * L);
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2 + 2 + Math.sin(Art.time * 3.1 + this.seed) * 2.2;
        if (this.dead) {
            const d = clamp(this.deathProgress(), 0, 1);
            const a0 = ctx.globalAlpha;
            ctx.globalAlpha = a0 * (1 - d);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1 + d * 0.6, 1 + d * 0.6);
            ctx.translate(-cx, -cy);
            this._drawFigure(ctx, cx, cy, 0, 0, true);
            ctx.restore();
            ctx.globalAlpha = a0;
            return;
        }
        const aimK = this.state === 'aim' ? clamp(1 - this.stateT / 0.5, 0, 1) : 0;
        this._drawFigure(ctx, cx, cy, aimK, this.recoil > 0 ? this.recoil : 0, false);
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 14);
    }

    _drawFigure(ctx, cx, cy, aimK, recoil, dead) {
        const t = Art.time, f = this.face, key = this.isKeyGhost;
        const tipCol = key ? AlienKit.GOLD : AlienKit.CYAN;
        // Antennen hinter dem Kopf
        drawAlienAntennae(ctx, cx, cy - 6, 1, t, this.seed, tipCol);
        // silberner Anzug
        Art.box(ctx, cx - 7, cy + 1, 14, 11, 5, AlienKit.SUIT, { lineWidth: 1.4 });
        // Beine (winzig, das Alien schwebt)
        ctx.strokeStyle = Art.ink(AlienKit.SUIT);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy + 11); ctx.lineTo(cx - 4, cy + 14);
        ctx.moveTo(cx + 3, cy + 11); ctx.lineTo(cx + 4, cy + 14);
        ctx.stroke();
        // Control-Light auf der Brust
        ctx.fillStyle = Math.floor(t * 3 + this.seed) % 2 ? AlienKit.PINK : AlienKit.CYAN;
        ctx.beginPath();
        ctx.arc(cx, cy + 6, 1.5, 0, TAU);
        ctx.fill();
        // Strahlenpistole: im Zielen genau in Schussrichtung, sonst locker nach vorn unten
        const gx = cx + f * 7, gy = cy + 5 - aimK * 1.5;
        let ga = f * 0.5;
        if (aimK > 0) ga = Math.atan2(this.aimY - this.centerY(), this.aimX - this.centerX());
        const rc = recoil * 2.4;
        const px0 = gx - Math.cos(ga) * rc, py0 = gy - Math.sin(ga) * rc;
        ctx.fillStyle = key ? '#b8860b' : '#6f7890';
        ctx.beginPath();
        ctx.roundRect(px0 - 2.6, py0 - 1.9, 9, 4.2, 2);
        ctx.fill();
        ctx.strokeStyle = Art.ink('#6f7890');
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = AlienKit.PINK;
        ctx.beginPath();
        ctx.arc(px0 + 1, py0, 1, 0, TAU);
        ctx.fill();
        const mx2 = px0 + Math.cos(ga) * 6.4, my2 = py0 + Math.sin(ga) * 6.4;
        if (aimK > 0) Art.glow(ctx, mx2, my2, 6 + aimK * 8, key ? AlienKit.GOLD : AlienKit.LASER, 0.35 + 0.5 * aimK);
        if (recoil > 0) Art.sparkle(ctx, mx2, my2, 3 + recoil * 3, '#ffffff', recoil);
        // großer Kopf mit drei Augen
        drawAlienFace(ctx, cx, cy - 6, 1, this.look, dead || aimK > 0.5,
            aimK > 0 ? (key ? AlienKit.GOLD : AlienKit.LASER) : null, aimK * 0.5, dead);
    }
}

// ══════════════════════════════════════════
// Gerufene Drohne des Bosses
// ══════════════════════════════════════════

// Kleine Drohne, die das Blaster-Raumschiff ruft (höchstens 4 gleichzeitig, nur im Boss-Raum).
// Sie umschwebt Mark und feuert kurze Laserblitze. Stirbt der Boss, verpufft sie harmlos.
class AlienDrone extends Enemy {
    constructor(x, y, boss) {
        super(x, y, 18, 18);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 74;
        this.damage = 1;
        this.flying = true;
        this.fxColor = AlienKit.CYAN;
        this.boss = boss || null;
        this.seed = Math.random() * 10;
        this.t = Math.random() * 10;
        this.look = { x: 0, y: 0.3 };
        this.engaged = true;
        this.shotTimer = randRange(1.2, 2.2);
        this.aimT = 0;
        this.aimX = 0;
        this.aimY = 0;
        this.tgt = null;
        this._puffed = false;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        // Der Boss ist besiegt: die gerufene Drohne verpufft (wie Hexenkinder in witch.js)
        if (this.boss && this.boss.dead && !this._puffed) {
            this._puffed = true;
            this.dead = true;
            this.deathTimer = 0.01;
            AlienKit.burst(this.centerX(), this.centerY(), [AlienKit.CYAN, '#ffffff', AlienKit.PINK], 10, 120, 0.45, { kind: 'star' });
            AlienKit.ring(this.centerX(), this.centerY(), AlienKit.CYAN, 22, 0.35, 3);
            return;
        }
        this.t += dt;
        this.engaged = !player.dead;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        let vx, vy;
        if (this.boss && !this.boss.dead && dist > 240) {
            // zu weit vom Boss weg? zurück zum Boss
            const bx = this.boss.centerX() - mx, by = this.boss.centerY() - my;
            const bd = Math.hypot(bx, by) || 1;
            vx = bx / bd; vy = by / bd;
        } else {
            const radial = clamp((dist - 80) / 40, -0.8, 1);
            vx = nx * radial - ny * 0.7;
            vy = ny * radial + nx * 0.7;
        }
        const lk = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * lk;
        this.look.y += (ny - this.look.y) * lk;
        this._moveWithCollision(vx * this.speed * dt, vy * this.speed * dt, world);
        if (this.aimT > 0) {
            this.aimT -= dt;
            if (this.aimT > 0.12 && this.tgt && !this.tgt.dead) {
                this.aimX = this.tgt.x + (this.tgt.w || 20) / 2;
                this.aimY = this.tgt.y + (this.tgt.h || 20) / 2;
            }
            if (this.aimT <= 0) {
                const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
                const a = Math.atan2(this.aimY - my, this.aimX - mx);
                if (list) list.push(new AlienLaser(mx + Math.cos(a) * 9, my + Math.sin(a) * 9, a, 280, { life: 1.1, stun: 1 }));
                AlienKit.burst(mx + Math.cos(a) * 10, my + Math.sin(a) * 10, [AlienKit.CYAN, '#ffffff'], 3, 100, 0.2, { kind: 'spark' });
            }
        } else {
            this.shotTimer -= dt;
            if (this.shotTimer <= 0 && this.engaged && AlienKit.clearLine(world, mx, my, px, py)) {
                this.tgt = player;
                this.aimX = px;
                this.aimY = py;
                this.aimT = 0.4;
                this.shotTimer = randRange(1.6, 2.6);
            }
        }
    }

    drawUnder(ctx, camera) {
        if (this.dead || this.aimT <= 0) return;
        const k = clamp(1 - this.aimT / 0.4, 0, 1);
        const mx = this.centerX(), my = this.centerY();
        const dx = this.aimX - mx, dy = this.aimY - my;
        const d = Math.hypot(dx, dy) || 1;
        const p = camera.worldToScreen(mx, my);
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (0.22 + 0.4 * k);
        ctx.strokeStyle = k > 0.7 ? '#ffffff' : AlienKit.CYAN;
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x + (dx / d) * 8, p.y + (dy / d) * 8);
        ctx.lineTo(p.x + (dx / d) * Math.min(d + 6, 30 + 180 * k), p.y + (dy / d) * Math.min(d + 6, 30 + 180 * k));
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2 + Math.sin(Art.time * 4.2 + this.seed) * 2;
        const a0 = ctx.globalAlpha;
        if (this.dead) {
            const d = clamp(this.deathProgress(), 0, 1);
            ctx.globalAlpha = a0 * (1 - d);
            ctx.save();
            ctx.translate(cx, cy);
            const s = 1 - d * 0.6;
            ctx.scale(s, s);
            ctx.translate(-cx, -cy);
        }
        Art.glow(ctx, cx, cy, 13, AlienKit.CYAN, 0.3);
        // Silberschuesselchen
        Art.body(ctx, cx, cy + 1, 8, 4.4, AlienKit.DISC, { lineWidth: 1.2 });
        // Glashaube
        ctx.beginPath();
        ctx.ellipse(cx, cy - 0.5, 4.6, 4.2, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = Art.alpha(AlienKit.CYAN, 0.4);
        ctx.fill();
        ctx.strokeStyle = Art.ink(AlienKit.DISC);
        ctx.lineWidth = 1;
        ctx.stroke();
        drawAlienFace(ctx, cx, cy - 2.6, 0.42, this.look, false, null, 0, false);
        // Blinklichtchen
        ctx.fillStyle = Math.floor(Art.time * 4 + this.seed) % 2 ? AlienKit.PINK : AlienKit.GOLD;
        ctx.beginPath();
        ctx.arc(cx, cy + 4.6, 1.2, 0, TAU);
        ctx.fill();
        if (this.dead) ctx.restore();
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// Boss Welt 33: Blaster-Raumschiff
// ══════════════════════════════════════════

// Fliegende Untertasse (flying) mit Glaskuppel, darin ein Alien-Pilot, blinkende Lichter am Rand,
// unten drei Blaster (links, Mitte, rechts), die sich einzeln zum Ziel drehen. Bleibt immer im
// Boss-Raum. 130 Lebenspunkte, Phase 2 ab der Haelfte: Pilot wuetend, Lichter rot, schneller.
// Angriffe im Wechsel (nach jedem grossen Angriff 1,05–1,35 s Verschnaufpause):
//  a) Dreifachfeuer: jeder Blaster sucht ein Ziel (Mark, Juri, Krokodil; ohne Freunde alle auf Mark,
//     leicht gefaechert). 1 s Warnlinien, die letzten 0,15 s fest; dann drei Salven im Wechsel
//     (Phase 2: vier Salven im Sekunden-Takt).
//  b) Strahlschwenk: der mittlere Blaster haelt an, laedt 1 s (Warnlinie bis zur Wand) und schwenkt
//     einen Laserstrahl ueber die Arena (Phase 2 schwenkt schneller und weiter).
//  c) Phase 2 zusaetzlich Phalanx: 0,9 s Warnstrahlen, dann ein Ring Laserkugeln mit drei Luecken
//     (Phase 2: zwei Ringe).
// Dazu ruft das Schiff Alien-Drohnen (hoechstens 4 gleichzeitig, nur im Boss-Raum, verpuffen mit ihm).
// Boss-Geschosse insgesamt hoechstens 60 gleichzeitig (AlienKit.BOSS_CAP).
class BossAlienShip extends Enemy {
    constructor(x, y) {
        super(x, y, 76, 76);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 46;
        this.damage = 1;
        this.contactDamage = false;   // gefaehrlich sind die Blaster – so verschwinden die Freunde nie im Nahkampf
        this.isBoss = true;
        this.flying = true;
        this.shadow = { rx: 40, ry: 11, dy: 46, alpha: 0.22 };
        this.fxColor = AlienKit.CYAN;
        this.seed = Math.random() * 10;
        this.t = 0;
        this.look = { x: 0, y: 1 };
        this.phase = 1;
        this.roared = false;
        this.state = 'intro';
        this.stateT = 1.6;
        this.stateMax = 1.6;
        this.cycle = 0;
        this.vx = 0;
        this.vy = 0;
        this.tx = null;
        this.ty = null;
        this.retarget = 0;
        this.kick = [0, 0, 0];           // Rückstoß je Blaster (nur Darstellung)
        this.chargeK = 0;                // Aufladen 0..1 (nur Darstellung)
        this.beamK = 0;                  // Strahl aktiv 0..1
        this.beamA = 0;
        this.beamTo = 0;
        this.beamDir = 1;
        this.beamLen = 200;
        this._beamHit = new Set();
        this.ringK = 0;                  // Phalanx-Aufladen (nur Darstellung)
        this.gapA = 0;
        this.ringLeft = 0;
        this.ringN = 26;
        this.gapIdx = [0, 9, 17];        // drei Luecken im Kugelring (liegen fest, gleich wie die Warnung)
        this.aimT = 0;
        this.volleyLeft = 0;
        this._room = null;
        this.homeX = undefined;
        this.homeY = undefined;
        this._summonLeft = 2;
        this.summonCd = 4;
        this.summoned = [];
        // drei Blaster: links, Mitte, rechts (unten an der Untertasse)
        this.blaster = [];
        for (let i = 0; i < 3; i++) {
            this.blaster.push({
                ox: (i - 1) * 24,
                oy: 17,
                a: Math.PI / 2,
                aim: Math.PI / 2,
                tg: null,
                fired: false,
                tx: 0,
                ty: 0,
            });
        }
        this._set('intro', 1.6);
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateMax = dur;
    }

    static room(world) {
        if (typeof Game === 'undefined' || Game.world !== world || !Game.bossActive || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    // Eine fliegende Untertasse staubt man kaum ab
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, force ? force * 0.25 : force);
    }

    _bl(i) { return this.centerX() + this.blaster[i].ox; }
    _by() { return this.centerY() + 17; }
    _muzzleX(i) { return this._bl(i) + Math.cos(this.blaster[i].a) * 11; }
    _muzzleY(i) { return this._by() + Math.sin(this.blaster[i].a) * 11; }

    // Laengste freie Strecke in Richtung a (bis zur ersten Wand), in 8er-Schritten
    _lineLen(world, x0, y0, a, max) {
        if (!world || !world.isWall) return max;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let d = 10; d < max; d += 8) {
            if (world.isWall(x0 + ca * d, y0 + sa * d)) return d;
        }
        return max;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.homeX === undefined) {
            this.homeX = this.centerX();
            this.homeY = this.centerY();
        }
        if (!this._room) this._room = BossAlienShip.room(world);
        const room = this._room;
        const p2 = this.phase === 2;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) {
            this.phase = 2;
            this.roared = false;
        }
        const mx = this.centerX(), my = this.centerY();
        const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
        const dx = pcx - mx, dy = pcy - my;
        const dist = Math.hypot(dx, dy) || 1;
        const lk = 1 - Math.exp(-7 * dt);
        this.look.x += (dx / dist - this.look.x) * lk;
        this.look.y += (dy / dist - this.look.y) * lk;
        for (let i = 0; i < 3; i++) {
            if (this.kick[i] > 0) this.kick[i] -= dt * 4;
            this.blaster[i].a = AlienKit.angleTo(this.blaster[i].a, this.blaster[i].aim, 1 - Math.exp(-9 * dt));
        }
        if (this.summonCd > 0) this.summonCd -= dt;
        // Sanft ausklingende Anzeige-Werte (nur Darstellung)
        const wantGlow = (this.state === 'beamCharge' || this.state === 'beam') ? 1 :
            (this.state === 'ringCharge' ? 0.8 : 0);
        this.chargeK = wantGlow > this.chargeK ? Math.min(1, wantGlow) : Math.max(wantGlow, this.chargeK - dt * 2.2);
        this.ringK = this.state === 'ringCharge' ? clamp(1 - this.stateT / this.stateMax, 0, 1) :
            (this.state === 'ring' ? 1 : Math.max(0, this.ringK - dt * 3));

        // ── Bewegung: immer im Boss-Raum bleiben ──
        const still = this.state === 'tripleAim' || this.state === 'tripleFire' ||
            this.state === 'beamCharge' || this.state === 'beam' ||
            this.state === 'ringCharge' || this.state === 'ring' || this.state === 'awaken';
        this.retarget -= dt;
        if (!still && (this.tx === null || this.retarget <= 0)) this._pickSpot(pcx, pcy, dist);
        let wx = 0, wy = 0;
        if (!still && this.tx !== null) {
            const ddx = this.tx - mx, ddy = this.ty - my;
            const dd = Math.hypot(ddx, ddy);
            const relaxed = this.state === 'rest' || this.state === 'intro';
            const sp = Math.min(this.speed * (p2 ? 1.25 : 1) * (relaxed ? 1 : 0.5), dd * 3);
            if (dd > 2) { wx = (ddx / dd) * sp; wy = (ddy / dd) * sp; }
        }
        const k = 1 - Math.exp(-(still ? 8 : 3) * dt);
        this.vx += (wx - this.vx) * k;
        this.vy += (wy - this.vy) * k;
        const fl = still ? 0 : 1;
        const fx = Math.sin(this.t * 1.6 + this.seed) * 7 * fl;
        const fy = Math.cos(this.t * 2.1 + this.seed) * 5 * fl;
        this._moveWithCollision((this.vx + fx) * dt, (this.vy + fy) * dt, world);
        if (room) {
            this.x = clamp(this.x, room.x, room.x + room.w - this.w);
            this.y = clamp(this.y, room.y, room.y + room.h - this.h);
        }

        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);

        // ── Zustandsmaschine ──
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._toRest(0.5);
                break;
            case 'rest': {
                if (this.stateT <= 0) {
                    if (!this.roared && this.phase === 2) this._startAwaken();
                    else this._startAttack();
                }
                if (this.stateT > 0.2 && this.stateT < 0.8) this._maybeSummon(list);
                break;
            }
            case 'awaken':
                if (this.stateT <= 0) {
                    this.roared = true;
                    this._toRest(0.35);
                }
                break;
            case 'tripleAim': {
                if (this.stateT > 0.15) this._trackTargets(player, mx, my);
                if (this.stateT <= 0) {
                    this.state = 'tripleFire';
                    this.stateMax = 2;
                    this.stateT = 0;
                    this.aimT = 0;
                    this.volleyLeft = this.phase === 2 ? 4 : 3;
                }
                break;
            }
            case 'tripleFire':
                this.aimT -= dt;
                while (this.aimT <= 0 && this.volleyLeft > 0) {
                    this._fireVolley(list, this.volleyLeft);
                    this.aimT += this.phase === 2 ? 0.2 : 0.24;
                }
                if (this.volleyLeft <= 0 && this.aimT <= -0.1) this._toRest(this.phase === 2 ? 1.05 : 1.35);
                break;
            case 'beamCharge':
                if (this.stateT <= 0) {
                    this.state = 'beam';
                    this.stateMax = this.phase === 2 ? 2.3 : 1.9;
                    this.stateT = this.stateMax;
                    this.beamK = 0;
                    this._beamHit.clear();
                    this.beamTo = this.beamA + this.beamDir * (this.phase === 2 ? 2.1 : 1.5);
                    AlienKit.shake(3, 0.25);
                }
                break;
            case 'beam': {
                const k2 = 1 - Math.max(0, this.stateT) / this.stateMax;
                this.beamK = Math.min(1, this.beamK + dt * 8);
                const rate = (this.phase === 2 ? 1.25 : 0.85) * Math.min(1, k2 * 3);
                this.beamA += this.beamDir * rate * dt;
                this.beamLen = this._lineLen(world, mx, my, this.beamA, 460);
                this._beamDamage(world, player, mx, my);
                if (this.stateT <= 0) {
                    this.beamK = 0;
                    this._toRest(this.phase === 2 ? 1.05 : 1.3);
                }
                break;
            }
            case 'ringCharge':
                if (this.stateT <= 0) {
                    this.state = 'ring';
                    this.stateMax = 1;
                    this.stateT = 0;
                    this.ringLeft = this.phase === 2 ? 2 : 1;
                    this.aimT = 0;
                    AlienKit.shake(4, 0.3);
                }
                break;
            case 'ring':
                this.aimT -= dt;
                while (this.aimT <= 0 && this.ringLeft > 0) {
                    this._fireRing(list, mx, my);
                    this.aimT += 0.45;
                }
                if (this.ringLeft <= 0 && this.aimT <= -0.05) this._toRest(this.phase === 2 ? 1.1 : 1.3);
                break;
        }
    }

    // ── Bewegung und Kampftakt ──

    _toRest(dur) {
        this._set('rest', dur);
    }

    _pickSpot(pcx, pcy, dist) {
        const r = this._room;
        const cx = this.centerX(), cy = this.centerY();
        let bx = cx, by = cy, best = -Infinity;
        for (let i = 0; i < 7; i++) {
            const a = Math.random() * TAU;
            const d = randRange(110, 165);
            let x = pcx + Math.cos(a) * d, y = pcy + Math.sin(a) * d;
            if (r) {
                x = clamp(x, r.x + 46, r.x + r.w - 46);
                y = clamp(y, r.y + 40, r.y + r.h - 46);
            } else {
                x = clamp(x, this.homeX - 80, this.homeX + 80);
                y = clamp(y, this.homeY - 50, this.homeY + 50);
            }
            let score = -Math.abs(Math.hypot(x - pcx, y - pcy) - 135) - Math.hypot(x - cx, y - cy) * 0.12;
            if (r) score -= Math.max(0, y - (r.y + r.h * 0.6)) * 0.35;
            if (score > best) { best = score; bx = x; by = y; }
        }
        this.tx = bx;
        this.ty = by;
        this.retarget = randRange(1.7, 2.5);
    }

    _startAttack() {
        // alle Angriffe mindestens einmal pro Runde (Phalanx erst ab Phase 2)
        const p2 = this.phase === 2;
        const mode = p2 ? ['triple', 'beam', 'ring'][this.cycle++ % 3] : ['triple', 'beam'][this.cycle++ % 2];
        if (mode === 'triple') {
            for (const b of this.blaster) b.fired = false;
            this._trackTargets(null, this.centerX(), this.centerY(), true);
            this._set('tripleAim', this.phase === 2 ? 0.8 : 1.0);
        } else if (mode === 'beam') {
            this._startBeam();
        } else {
            this.gapA = Math.random() * TAU;
            this._set('ringCharge', this.phase === 2 ? 0.8 : 0.9);
        }
    }

    _startAwaken() {
        this._set('awaken', 1.0);
        const cx = this.centerX(), cy = this.centerY();
        AlienKit.shake(6, 0.45);
        AlienKit.burst(cx, cy, [AlienKit.DANGER, '#ffffff', AlienKit.PINK], 20, 200, 0.6, { kind: 'star' });
        AlienKit.ring(cx, cy + 20, AlienKit.DANGER, 110, 0.5, 5);
        if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
    }

    // ── a) Dreifachfeuer ──

    // Ziel je Blaster: erst Mark, dann die Freunde; sind alle vergeben, nochmal Mark (leicht
    // gefaechert). Die letzten 0,15 s (locked) steht alles fest – fair zum Ausweichen.
    _trackTargets(player, mx, my, force) {
        if (!player && !force) return;
        const opts = [];
        if (player && !player.dead) opts.push(player);
        for (const c of AlienKit.companions()) {
            const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
            if (Math.hypot(cx - mx, cy - my) <= 430) opts.push(c);
        }
        if (!opts.length) return;
        const used = [];
        for (let i = 0; i < 3; i++) {
            const b = this.blaster[i];
            if (!force && b.fired) continue;
            let tg = b.tg && opts.indexOf(b.tg) >= 0 && used.indexOf(b.tg) < 0 ? b.tg : null;
            if (!tg) {
                for (const o of opts) {
                    if (used.indexOf(o) >= 0) continue;
                    tg = o;
                    break;
                }
            }
            if (tg) {
                used.push(tg);
                b.tg = tg;
            } else {
                b.tg = opts[0];
            }
            b.tx = b.tg.x + (b.tg.w || 20) / 2;
            b.ty = b.tg.y + (b.tg.h || 20) / 2;
            // mehrere Blaster auf dasselbe Ziel: leicht gefaechert, sie streifen links und rechts vorbei
            if (opts.length < 3) {
                b.tx += (i - 1) * 26;
                b.ty += (i === 1 ? 12 : -8);
            }
            b.aim = Math.atan2(b.ty - this._by(), b.tx - this._bl(i));
        }
    }

    // Ein Salvenbild: der i-te Blaster (Reihenfolge 2, 0, 1, 2, …) feuert auf sein arretiertes Ziel
    _fireVolley(list, volleyLeft) {
        if (!list) { this.volleyLeft = 0; return; }
        const i = [2, 0, 1, 2][Math.max(0, 3 - volleyLeft)] || 1;
        const b = this.blaster[i];
        if (AlienKit.liveBossShots(list) >= AlienKit.BOSS_CAP) return;
        const mx2 = this._muzzleX(i), my2 = this._muzzleY(i);
        const a = Math.atan2(b.ty - my2, b.tx - mx2);
        b.a = a;
        b.aim = a;
        b.fired = true;
        list.push(new AlienVolleyBolt(mx2, my2, a, 250));
        this.kick[i] = 1;
        AlienKit.burst(mx2, my2, [AlienKit.CYAN, '#ffffff'], 4, 110, 0.2, { kind: 'spark' });
        this.volleyLeft--;
    }

    // ── b) Strahlschwenk des Mittelblasters ──

    _startBeam() {
        // Der Mitttelblaster holt seitlich neben Mark aus und schwenkt dann ueber die Arena
        const sx = this.centerX(), sy = this.centerY() + 17;
        let toMark = Math.PI / 2;
        if (this._lastPx !== undefined) toMark = Math.atan2(this._lastPy - sy, this._lastPx - sx);
        this.beamDir = Math.random() < 0.5 ? -1 : 1;
        this.beamA = toMark + this.beamDir * (this.phase === 2 ? 1.05 : 0.75);
        this.blaster[1].aim = this.beamA;
        this.blaster[1].a = this.beamA;
        this.beamLen = this._lineLen(typeof Game !== 'undefined' ? Game.world : null, sx, sy, this.beamA, 460);
        this._beamHit.clear();
        this.kick[1] = 1;
        this._set('beamCharge', 1.0);
    }

    // Ein Strahlstreif trifft jedes Ziel hoechstens einmal (wie der Drachenstrahl)
    _beamDamage(world, player, mx, my) {
        const ux = Math.cos(this.beamA), uy = Math.sin(this.beamA);
        const x0 = mx + ux * 8, y0 = my + 17 + uy * 8;
        const ex = mx + ux * this.beamLen, ey = my + 17 + uy * this.beamLen;
        const segDist = (px, py) => {
            const t = clamp(((px - x0) * (ex - x0) + (py - y0) * (ey - y0)) /
                Math.max(1, (ex - x0) * (ex - x0) + (ey - y0) * (ey - y0)), 0, 1);
            return Math.hypot(px - (x0 + (ex - x0) * t), py - (y0 + (ey - y0) * t));
        };
        const angle = this.beamA + Math.PI / 2;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (this._lastPx === undefined) this._lastPy = py;
            this._lastPx = px; this._lastPy = py;
            if (segDist(px, py) < 12 + player.w / 2 && !this._beamHit.has('p')) {
                this._beamHit.add('p');
                AlienKit.hurtMark(2, angle, 190);
                AlienKit.burst(px, py, [AlienKit.LASER, '#ffffff'], 10, 150, 0.4, { kind: 'spark' });
            }
        }
        for (const c of AlienKit.companions()) {
            const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
            if (c.iFrames > 0 || this._beamHit.has(c)) continue;
            if (segDist(cx, cy) < 12 + Math.max(c.w || 20, c.h || 20) / 2) {
                this._beamHit.add(c);
                AlienKit.hitCompanion(c, 2);
            }
        }
    }

    // ── c) Phalanx: Laserkugel-Ring mit Luecken (Phase 2) ──

    _fireRing(list, mx, my) {
        if (!list) { this.ringLeft = 0; return; }
        const n = this.ringN;
        // drei Luecken, mindestens 5 Kugeln dazwischen
        if (!this.gapIdx.length) {
            const g = [];
            while (g.length < 3) {
                const s = Math.floor(Math.random() * n);
                if (g.every(x => Math.min(Math.abs(x - s), n - Math.abs(x - s)) >= 5)) g.push(s);
            }
            this.gapIdx = g;
        }
        const room = this._room;
        for (let i = 0; i < n; i++) {
            let inGap = false;
            for (const g of this.gapIdx) {
                const d = Math.abs(i - g);
                if (Math.min(d, n - d) <= 1) { inGap = true; break; }
            }
            if (inGap) continue;
            if (AlienKit.liveBossShots(list) >= AlienKit.BOSS_CAP) break;
            const a = this.gapA + (TAU * i) / n;
            const x0 = mx + Math.cos(a) * 26, y0 = my + Math.sin(a) * 26;
            if (room && (x0 < room.x + 8 || x0 > room.x + room.w - 8 || y0 < room.y + 8 || y0 > room.y + room.h - 8)) continue;
            list.push(new AlienOrb(x0, y0, a, 120));
        }
        AlienKit.ring(mx, my, AlienKit.PINK, 34, 0.35, 4);
        this.ringLeft--;
    }

    // ── Gerufene Drohnen ──

    _maybeSummon(list) {
        const world = typeof Game !== 'undefined' ? Game.world : null;
        if (!world || this._summonLeft <= 0 || !Game.bossActive || !Game.enemies || !this._room) return;
        if (this.summonCd > 0) return;
        let alive = 0;
        for (let i = this.summoned.length - 1; i >= 0; i--) {
            if (!this.summoned[i].dead) alive++;
        }
        const room = this._room;
        const px = this.centerX(), py = this.centerY();
        let placed = 0;
        for (let i = 0; i < 2 && alive + placed < 4; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 24 + Math.random() * (room.w - 48);
                const y = room.y + 24 + Math.random() * (room.h - 48);
                if (Math.hypot(x - px, y - py) < 60) continue;
                if (worldIsWallNear(world, x, y)) continue;
                const d = new AlienDrone(x, y, this);
                Game.enemies.push(d);
                this.summoned.push(d);
                placed++;
                AlienKit.burst(x, y, [AlienKit.CYAN, '#ffffff', AlienKit.PINK], 10, 120, 0.45, { kind: 'star' });
                AlienKit.ring(x, y + 6, AlienKit.CYAN, 24, 0.4, 3);
                break;
            }
        }
        if (placed) {
            this._summonLeft -= placed;
            this.summonCd = 7;
        }
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        if (this.state === 'tripleAim') {
            const k = clamp(1 - this.stateT / this.stateMax, 0, 1);
            const locked = this.stateT <= 0.15;
            for (let i = 0; i < 3; i++) {
                const b = this.blaster[i];
                const sx = this._muzzleX(i), sy = this._muzzleY(i);
                const a = Math.atan2(b.ty - sy, b.tx - sx);
                const len = clamp(Math.hypot(b.tx - sx, b.ty - sy) + 24, 60, 440);
                const sp = camera.worldToScreen(sx, sy);
                LateWorldArt.lane(ctx, sp.x, sp.y, a, len, 20, k, locked ? AlienKit.DANGER : AlienKit.LASER);
                const tg = b.tg;
                if (tg && !tg.dead && !(tg.koTimer > 0)) {
                    const ap = camera.worldToScreen(tg.x + (tg.w || 20) / 2, tg.y - 14 + Math.sin(Art.time * 9) * 2.5);
                    AlienKit.targetArrow(ctx, ap.x, ap.y);
                }
            }
        }
        if (this.state === 'beamCharge' || this.state === 'beam') {
            const sx = mx, sy = my + 17;
            const a = this.state === 'beam' ? this.beamA : this.blaster[1].aim;
            const len = this.state === 'beam' ? this.beamLen :
                this._lineLen(typeof Game !== 'undefined' ? Game.world : null, sx, sy, a, 460);
            const p = camera.worldToScreen(sx, sy);
            const a0 = ctx.globalAlpha;
            if (this.state === 'beamCharge') {
                const k = clamp(1 - this.stateT / this.stateMax, 0, 1);
                LateWorldArt.lane(ctx, p.x, p.y, a, len, 24, k, k > 0.75 ? '#ffffff' : AlienKit.DANGER);
            } else {
                const pulse = 0.8 + 0.2 * Math.sin(Art.time * 30);
                ctx.strokeStyle = AlienKit.LASER;
                ctx.globalAlpha = a0 * 0.22 * pulse;
                ctx.lineCap = 'round';
                ctx.lineWidth = 20;
                ctx.beginPath();
                ctx.moveTo(p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8);
                ctx.lineTo(p.x + Math.cos(a) * this.beamLen, p.y + Math.sin(a) * this.beamLen);
                ctx.stroke();
            }
            ctx.globalAlpha = a0;
        }
        if (this.state === 'ringCharge') {
            const k = clamp(1 - this.stateT / this.stateMax, 0, 1);
            const p = camera.worldToScreen(mx, my);
            const p2 = this.phase === 2;
            const gaps = this.gapIdx.length ? this.gapIdx : [0, 9, 17];
            ctx.save();
            ctx.lineCap = 'round';
            ctx.strokeStyle = AlienKit.DANGER;
            for (const grow of [0.45, 1]) {
                ctx.globalAlpha = 0.12 + 0.25 * k * grow;
                ctx.lineWidth = 3;
                ctx.beginPath();
                for (let i = 0; i < this.ringN; i++) {
                    let inGap = false;
                    for (const g of gaps) {
                        const d = Math.abs(i - g);
                        if (Math.min(d, this.ringN - d) <= 1) { inGap = true; break; }
                    }
                    if (inGap) continue;
                    const a = this.gapA + (TAU * i) / this.ringN;
                    ctx.moveTo(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30);
                    ctx.lineTo(p.x + Math.cos(a) * (30 + (p2 ? 150 : 90) * k * grow), p.y + Math.sin(a) * (30 + (p2 ? 150 : 90) * k * grow));
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // ── Zeichnen ──

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2 + Math.sin(Art.time * 1.9 + this.seed) * 3;
        const t = Art.time, p2 = this.phase === 2, dead = this.dead;
        const k = dead ? clamp(this.deathProgress(), 0, 1) : 0;
        const tiltX = clamp((this.vx || 0) / 90, -1, 1) * 0.06;
        ctx.save();
        ctx.translate(cx, cy);
        if (dead) {
            ctx.rotate(t + this.seed);
            ctx.scale(1 - k * 0.85, 1 - k * 0.85);
        } else {
            ctx.rotate(tiltX + Math.sin(t * 1.3 + this.seed) * 0.035);
        }
        // Aura
        if (this.chargeK > 0.02 || this.ringK > 0.02) {
            Art.glow(ctx, 0, 4, 74, p2 ? AlienKit.DANGER : AlienKit.CYAN,
                0.18 + 0.35 * Math.max(this.chargeK, this.ringK));
        }
        const disc = p2 ? '#c9a6b4' : AlienKit.DISC;
        // hinterer Randwulst
        Art.body(ctx, 0, 2, 41, 11, Art.dark(disc, 0.25), { lineWidth: 2 });
        // drei Blaster (hinter der unteren Huelle)
        for (let i = 0; i < 3; i++) {
            const b = this.blaster[i];
            const bx = b.ox, by = b.oy;
            const kick = Math.max(0, this.kick[i]);
            const bx2 = bx - Math.cos(b.a) * kick * 2.5;
            const by2 = by - Math.sin(b.a) * kick * 2.5;
            ctx.save();
            ctx.translate(bx2, by2);
            ctx.rotate(b.a);
            Art.box(ctx, -4.5, -3.5, 16, 7, 3, '#6f7890', { lineWidth: 1.4 });
            const glowCol = this.state === 'beamCharge' && i === 1 ? AlienKit.DANGER :
                (p2 ? AlienKit.DANGER : AlienKit.CYAN);
            const ck = i === 1 && this.state === 'beamCharge' ? clamp(1 - this.stateT / this.stateMax, 0, 1) : 0;
            if (kick > 0 || ck > 0) Art.glow(ctx, 12, 0, 8 + 8 * Math.max(kick, ck), glowCol, 0.4 + 0.45 * Math.max(kick, ck));
            ctx.fillStyle = glowCol;
            ctx.beginPath();
            ctx.arc(11, 0, 1.8 + 1.4 * Math.max(kick, ck), 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        // Haupthuelle
        Art.body(ctx, 0, 0, 44, 14, disc, { lineWidth: 2.2 });
        // Unterseite (dunkler)
        ctx.beginPath();
        ctx.ellipse(0, 5, 34, 7, 0, 0, Math.PI);
        ctx.fillStyle = Art.alpha(Art.dark(disc, 0.35), 0.75);
        ctx.fill();
        Art.shine(ctx, -16, -6, 12, 3.4, -0.2, 0.4);
        // blinkende Lichter am Rand (Phase 2: alle rot)
        for (let i = 0; i < AlienKit.RIM.length; i++) {
            const L = AlienKit.RIM[i];
            const lx = Math.cos(L.a) * 38;
            const ly = Math.sin(L.a) * 11 + 3;
            const col = p2 ? AlienKit.DANGER : L.c;
            const on = Math.floor(t * 3 + i * 0.8 + this.seed) % 2 === 0;
            if (i % 2 === 0 && on) Art.glow(ctx, lx, ly, 8, col, 0.5);
            ctx.fillStyle = on ? col : Art.dark(col, 0.55);
            ctx.beginPath();
            ctx.arc(lx, ly, 2.3, 0, TAU);
            ctx.fill();
        }
        // Pilot (hinter dem Glas)
        const fear = (this.state === 'beamCharge' || this.state === 'ringCharge') ? 1 : 0;
        drawAlienFace(ctx, 0, -20, 1.15, this.look, p2 || fear,
            fear ? AlienKit.DANGER : null, fear * 0.5);
        drawAlienAntennae(ctx, 0, -20, 1.15, t, this.seed, p2 ? AlienKit.DANGER : AlienKit.CYAN);
        // Pilotensessel-Hinterriss
        ctx.fillStyle = Art.alpha('#39405c', 0.6);
        ctx.beginPath();
        ctx.ellipse(0, -12, 8, 4, 0, Math.PI, 0);
        ctx.fill();
        // Glaskuppel
        ctx.beginPath();
        ctx.ellipse(0, -11, 20, 18, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = Art.alpha(AlienKit.CYAN, 0.26);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = Art.ink(AlienKit.DISC);
        ctx.stroke();
        Art.shine(ctx, -9, -22, 6, 3.4, -0.6, 0.5);
        ctx.restore();
    }
}

// Hilft dem Boss beim Pruefen freier Drop-Punkte (world ist im _maybeSummon-Kontext erreichbar)
function worldIsWallNear(world, x, y) {
    if (!world || !world.isWall) return false;
    return world.isWall(x - 10, y - 10) || world.isWall(x + 10, y - 10) ||
        world.isWall(x - 10, y + 10) || world.isWall(x + 10, y + 10);
}
