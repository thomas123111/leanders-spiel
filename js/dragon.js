// ── Welt 24: Drachenberg ──
// Drachenkinder: kleine, tollpatschige Babydrachen in den Farben der drei Köpfe ihres Vaters (Feuer, Eis,
//   Diamant). Sie hüpfen, halten etwas Abstand und pusten alle paar Sekunden (vorher blähen sich die Backen).
// Schatten des Drachenvaters: gleitet ab und zu riesig über den Bildschirm (nur Stimmung, kein Schaden).
// Drachenvater (Boss): riesiger Drache mit drei Köpfen (Eis, Feuer, Diamant), der STRAHLEN verschießt.
//   Jeder Strahl wird angekündigt (Kopf leuchtet, Maul öffnet sich, Warnband am Boden, Richtung steht
//   ~0,3 s vorher fest) und macht 4 Schaden – ein ganzes Herz – bei Mark und bei Juri/Krokodil.
//   Freunde verschwinden dabei nie: ein Strahl, der sie besiegen würde, haut sie nur um (knockOut in
//   entities.js); nach 8 s stehen sie mit halben Lebenspunkten wieder auf.
//   Eis bremst Mark, Feuer ist breit und flackert, Diamant lässt Kristalle zurück, die als Funken zerplatzen.
//   Phase 2 (halbe LP): Gebrüll, alle drei Köpfe feuern zusammen, danach kurz erschöpft (Zeit zum Zurückhauen).

const DRAGON_KINDS = ['fire', 'ice', 'diamond'];

// Farben je Element (Drachenkinder und Köpfe des Vaters)
const DRAGON_PAL = {
    fire: { body: '#ff7043', belly: '#ffe08a', light: '#ffb896', horn: '#fff1c9', wing: '#ffc15e', iris: '#ffb020', glow: '#ff7a1f', core: '#fff3b0' },
    ice: { body: '#7fd0ff', belly: '#effaff', light: '#d8f3ff', horn: '#ffffff', wing: '#c6efff', iris: '#2f7fe0', glow: '#5fd8ff', core: '#ffffff' },
    diamond: { body: '#b47bff', belly: '#ffe6fa', light: '#ecd8ff', horn: '#ff9ae0', wing: '#ffc2f0', iris: '#ff3fa8', glow: '#ff6fd8', core: '#fff0fb' },
};

// Strahlen: Breite, Dauer in Sekunden, Farben (Band, Kern, Leuchten)
const DRAGON_BEAMS = {
    ice: { width: 16, dur: 0.8, color: '#7fd8ff', core: '#ffffff', glow: '#5fd8ff' },
    fire: { width: 24, dur: 0.9, color: '#ff7a1f', core: '#fff1a8', glow: '#ff5a1f' },
    diamond: { width: 14, dur: 0.75, color: '#ff8ae0', core: '#ffffff', glow: '#ff6fd8' },
};

// Köpfe des Vaters (Mitte, relativ zu den Füßen): links Eis, Mitte Feuer mit Krone, rechts Diamant
const DRAGON_HEADS = [
    { kind: 'ice', x: -50, y: -88 },
    { kind: 'fire', x: 0, y: -106 },
    { kind: 'diamond', x: 50, y: -88 },
];
const DRAGON_HEAD_SCALE = 1.18;   // Köpfe etwas größer zeichnen (gut lesbar im Spiel)
const DRAGON_NECKS = [-20, -56, 0, -62, 20, -56];     // Halsansätze (x, y) je Kopf
const DRAGON_BODY = '#3fbf95', DRAGON_DARK = '#2c9a78', DRAGON_BELLY = '#ffe6a8', DRAGON_WING = '#ffc861', DRAGON_GOLD = '#ffd23f';

const DRAGON_BEAM_DMG = 4;        // ein ganzes Herz
const DRAGON_BEAM_MAX = 460;      // längster Strahl (Boss-Raum diagonal)
const DRAGON_TRIPLE_GAP = 64;     // Abstand der Seitenstrahlen beim Dreifach-Strahl
const DRAGON_LOCK = 0.36;         // so lange vor dem Feuern steht die Richtung fest (Boss-Zeit, ~0,3 s echt)
const DRAGONKID_HOP = 0.36;       // Sprungzeit
const DRAGONKID_REST = 0.14;      // Pause zwischen zwei Hüpfern
const DRAGONKID_WARN = 0.4;       // Backen aufblasen vor dem Pusten
const DRAGON_TMP = { x: 0, y: 0 };

const DragonArt = {
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

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

    // Leises, fernes Brüllen aus den vorhandenen Ton-Bausteinen (kein eigener Ton in sound.js nötig)
    roar(vol) {
        if (typeof Sound === 'undefined' || typeof Sound._tone !== 'function') return;
        Sound._tone('sawtooth', 96, 46, 1.1, vol, 0, 'lin');
        if (typeof Sound._noiseBurst === 'function') Sound._noiseBurst(0.9, vol * 0.7, 'lowpass', 240);
    },

    // Abstand Punkt–Strecke; der nächste Punkt der Strecke landet in out.
    segDist(px, py, x0, y0, x1, y1, out) {
        const vx = x1 - x0, vy = y1 - y0;
        const l2 = vx * vx + vy * vy || 1;
        const k = clamp(((px - x0) * vx + (py - y0) * vy) / l2, 0, 1);
        const qx = x0 + vx * k, qy = y0 + vy * k;
        if (out) { out.x = qx; out.y = qy; }
        return Math.hypot(px - qx, py - qy);
    },

    // Länge eines Strahls bis zur ersten Wand (in 8er-Schritten). Ragt der Kopf über eine Wand, zählt
    // die Wand erst ab dem ersten freien Stück – sonst käme ein Strahl von ganz oben nie in den Raum.
    beamLength(world, x0, y0, a, max) {
        if (!world || !world.isWall) return max;
        const ca = Math.cos(a), sa = Math.sin(a);
        let free = false;
        for (let d = 0; d <= max; d += 8) {
            const wall = world.isWall(x0 + ca * d, y0 + sa * d);
            if (!free) {
                if (!wall) free = true;
                continue;
            }
            if (wall) return Math.max(0, d - 4);
        }
        return free ? max : 0;
    },

    // Schneeflocke um (0, 0): sechs Arme mit Ästchen, dunkler Rand, heller Kern
    snowflake(ctx, r, color, ink, lw) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * TAU) / 6;
            const ca = Math.cos(a), sa = Math.sin(a);
            ctx.moveTo(0, 0);
            ctx.lineTo(ca * r, sa * r);
            const bx = ca * r * 0.55, by = sa * r * 0.55;
            const b = r * 0.32;
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(a + 0.8) * b, by + Math.sin(a + 0.8) * b);
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(a - 0.8) * b, by + Math.sin(a - 0.8) * b);
        }
        ctx.lineCap = 'round';
        ctx.strokeStyle = ink;
        ctx.lineWidth = (lw || 1) * 2.4;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = (lw || 1) * 1.2;
        ctx.stroke();
    },

    // Kristall, der aus dem Boden ragt (Fuß bei x, y)
    crystal(ctx, x, y, w, h, color) {
        Art.shape(ctx, c => {
            c.moveTo(x, y - h);
            c.lineTo(x + w, y - h * 0.45);
            c.lineTo(x + w * 0.6, y);
            c.lineTo(x - w * 0.6, y);
            c.lineTo(x - w, y - h * 0.45);
            c.closePath();
        }, { x: x - w, y: y - h, w: w * 2, h }, color, { lineWidth: 1.2, glossy: true });
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x - w * 0.2, y - h * 0.4);
        ctx.lineTo(x, y);
        ctx.stroke();
    },
};

// ══════════════════════════════════════════
// ── Drachenkinder ──
// ══════════════════════════════════════════

// Kleiner Babydrache mit Kugelbauch, großen Augen, Hörnchen, Flügelchen und kurzem Schwanz.
// kind: 'fire' | 'ice' | 'diamond' (sonst zufällig). Hüpft (mit Wandkollision), hält Abstand und pustet:
// Feuer einen Feuerball, Eis eine Schneeflocke (bremst Mark), Diamant einen glitzernden Splitter.
class DragonKid extends Enemy {
    constructor(x, y, kind) {
        super(x, y, 24, 22);
        this.kind = DRAGON_KINDS.includes(kind) ? kind : DragonArt.pick(DRAGON_KINDS);
        this.pal = DRAGON_PAL[this.kind];
        this.scaleLine = Art.alpha(Art.ink(this.pal.body), 0.35);   // Bauchschuppen-Linien
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(50, 60);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 250;
        this.fxColor = this.pal.body;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.engaged = false;
        this.moving = false;
        this.t = Math.random() * 10;
        this.hopClock = Math.random() * DRAGONKID_HOP;
        this.puffTimer = randRange(1.2, 2.6);
        this.puffK = 0;             // 0..1 Backen aufblasen (nur Anzeige)
        this.mouthT = 0;            // Maul kurz offen nach dem Pusten
        this.trip = 0;              // stolpert beim Landen (nur Anzeige)
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.strafeT = randRange(0.8, 1.8);
        this.wanderT = randRange(0.3, 1.5);
        this.wx = 0;
        this.wy = 0;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.mouthT > 0) this.mouthT -= dt;
        if (this.trip > 0) this.trip -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 60) this.engaged = false;

        // Pusten: Backen blähen sich 0,4 s auf (steht still), dann fliegt der Puster auf Mark zu
        this.puffK = 0;
        if (this.engaged) {
            this.puffTimer -= dt;
            if (this.puffTimer <= DRAGONKID_WARN) {
                if (typeof Juri === 'undefined' || Juri.lineClear(world, mx, my - 4, px, py)) {
                    this.puffK = clamp(1 - this.puffTimer / DRAGONKID_WARN, 0, 1);
                    this.moving = false;
                    if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
                    this._look(dx / dist, dy / dist, dt);
                    if (this.puffTimer <= 0) {
                        this._puff(px, py, projectiles);
                        this.puffTimer = randRange(2.5, 3.5);
                    }
                    return;
                }
                this.puffTimer = DRAGONKID_WARN + 0.05;   // keine freie Sicht: später nochmal
            }
        }

        // Hüpfen: nah genug heran, aber nicht zu nah; dazwischen seitwärts
        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            if (dist > 140) {
                vx = dx / dist; vy = dy / dist; sp = this.speed;
            } else if (dist < 85) {
                vx = -dx / dist; vy = -dy / dist; sp = this.speed * 0.85;
            } else {
                this.strafeT -= dt;
                if (this.strafeT <= 0) {
                    this.strafe = -this.strafe;
                    this.strafeT = randRange(0.9, 1.9);
                }
                vx = (-dy / dist) * this.strafe; vy = (dx / dist) * this.strafe; sp = this.speed * 0.55;
            }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.2, 2.8);
                if (Math.random() < 0.35) {
                    this.wx = 0;
                    this.wy = 0;
                } else {
                    const a = Math.random() * TAU;
                    this.wx = Math.cos(a);
                    this.wy = Math.sin(a);
                }
            }
            vx = this.wx; vy = this.wy; sp = this.speed * 0.45;
        }
        this.moving = sp > 0 && (vx !== 0 || vy !== 0);
        if (this.moving) {
            const cyc = DRAGONKID_HOP + DRAGONKID_REST;
            const q0 = this.hopClock % cyc;
            this.hopClock += dt;
            const q = this.hopClock % cyc;
            // tollpatschig: stolpert ab und zu beim Landen (nur Aussehen)
            if (q0 < DRAGONKID_HOP && q >= DRAGONKID_HOP && Math.random() < 0.08) this.trip = 0.45;
            if (q < DRAGONKID_HOP) {
                const v = (sp * cyc) / DRAGONKID_HOP;   // im Mittel genau sp
                const ox = this.x, oy = this.y;
                this._moveWithCollision(vx * v * dt, vy * v * dt, world);
                if (Math.hypot(this.x - ox, this.y - oy) < v * dt * 0.3) {
                    if (this.engaged) this.strafe = -this.strafe;
                    else this.wanderT = 0;
                }
            }
        }
        if (this.engaged) {
            if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
            this._look(dx / dist, dy / dist, dt);
        } else {
            if (Math.abs(vx) > 0.2) this.face = vx > 0 ? 1 : -1;
            this._look(vx * 0.6, vy * 0.6 + 0.2, dt);
        }
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    _puff(px, py, projectiles) {
        const sx = this.centerX() + this.face * 9, sy = this.y + this.h - 16;
        const a = Math.atan2(py - sy, px - sx);
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (list) list.push(new DragonPuff(sx, sy, a, this.kind));
        this.mouthT = 0.28;
        DragonArt.burst(sx, sy, [this.pal.glow, '#ffffff'], 5, 80, 0.3, { kind: 'spark' });
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        ctx.save();
        ctx.translate(cx, pos.y + this.h);
        if (this.dead) {
            this._drawDeath(ctx);
            ctx.restore();
            return;
        }
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 14);
    }

    // Babydrache mit Füßen bei (0, 0). dead = Kreuzaugen, keine Bewegung.
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, P = this.pal, sd = this.seed;
        const mv = this.moving && !dead;
        let lift = 0, sx = 1, sy = 1;
        let flap = Math.sin(t * 5 + sd) * 0.25;
        if (mv) {
            const q = this.hopClock % (DRAGONKID_HOP + DRAGONKID_REST);
            if (q < DRAGONKID_HOP) {
                lift = Math.sin((q / DRAGONKID_HOP) * Math.PI) * 5;
                sx = 0.93;
                sy = 1.08;
                flap = Math.sin(t * 26 + sd) * 0.6;   // flattert wild beim Hüpfen
            } else {
                const s = Math.sin(((q - DRAGONKID_HOP) / DRAGONKID_REST) * Math.PI) * 0.13;
                sx = 1 + s;
                sy = 1 - s;
            }
        } else {
            const b = Math.sin(t * 2.6 + sd) * 0.025;
            sx = 1 + b;
            sy = 1 - b;
        }
        const puff = dead ? 0 : this.puffK;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -12, 24, '#ffd23f', 0.42 + 0.12 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(0, -lift);
        if (this.trip > 0 && !dead) {
            // stolpert nach vorn und fängt sich wieder
            ctx.translate(0, -8);
            ctx.rotate(f * Math.sin((this.trip / 0.45) * Math.PI) * 0.4);
            ctx.translate(0, 8);
        }
        ctx.scale(sx, sy);
        // Schwanz mit Spitze in der Elementfarbe
        const wag = Math.sin(t * 4 + sd) * 1.5;
        Art.shape(ctx, c => {
            c.moveTo(-f * 4, -4.5);
            c.quadraticCurveTo(-f * 11, -2.5 + wag * 0.3, -f * 14.5, -9 + wag);
            c.quadraticCurveTo(-f * 10, -7.5, -f * 4, -10);
            c.closePath();
        }, { x: -14.5, y: -11, w: 14.5, h: 8 }, P.body, { lineWidth: 1.1 });
        this._tailTip(ctx, -f * 15, -9.5 + wag, f, t);
        // Flügelchen auf dem Rücken (schlägt beim Hüpfen wild)
        ctx.save();
        ctx.translate(-f * 5, -13);
        ctx.rotate(-f * (0.35 + flap));
        Art.shape(ctx, c => {
            c.moveTo(0, 1);
            c.quadraticCurveTo(-f * 2, -9, -f * 11, -10);
            c.quadraticCurveTo(-f * 8.5, -5.5, -f * 10, -2);
            c.quadraticCurveTo(-f * 6.5, -3.5, -f * 6.5, 0.5);
            c.quadraticCurveTo(-f * 3.5, -1, 0, 2.5);
            c.closePath();
        }, { x: -11, y: -10, w: 11, h: 12.5 }, P.wing, { lineWidth: 1.1 });
        ctx.restore();
        // Füßchen
        ctx.beginPath();
        ctx.ellipse(-3.8 + f * 1.2, -1.7, 3.3, 2, 0, 0, TAU);
        ctx.moveTo(3.8 + f * 1.2 + 3.3, -1.7);
        ctx.ellipse(3.8 + f * 1.2, -1.7, 3.3, 2, 0, 0, TAU);
        ctx.fillStyle = Art.dark(P.body, 0.16);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = Art.ink(P.body);
        ctx.stroke();
        // Kugelbauch mit hellen Bauchschuppen
        Art.body(ctx, 0, -8.5, 8.4, 7.6, P.body, { lineWidth: 1.4 });
        ctx.fillStyle = P.belly;
        ctx.beginPath();
        ctx.ellipse(f * 1.8, -7.6, 5, 5.3, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = this.scaleLine;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(f * 1.8 - 3.8, -9);
        ctx.quadraticCurveTo(f * 1.8, -7.8, f * 1.8 + 3.8, -9);
        ctx.moveTo(f * 1.8 - 3.8, -6);
        ctx.quadraticCurveTo(f * 1.8, -4.8, f * 1.8 + 3.8, -6);
        ctx.stroke();
        // Schlüsselträger: goldener Schlüssel am Schleifenband
        if (key) {
            ctx.strokeStyle = '#ff4d8a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(f * 1.5 - 3.4, -14);
            ctx.lineTo(f * 2.2, -9);
            ctx.lineTo(f * 1.5 + 3.4, -14);
            ctx.stroke();
            ctx.save();
            ctx.translate(f * 2.2, -8.6);
            ctx.rotate(Math.PI / 2 + Math.sin(t * 3 + sd) * 0.2);
            Art.key(ctx, 1.4, 0, 3, '#ffd23f');
            ctx.restore();
        }
        // Ärmchen
        LateWorldArt.blob(ctx, f * 6.9, -9, 2, 1.6, P.body, 1);
        // Kopf mit Hörnchen und Elementschmuck
        const hx = f * 1.8, hy = -18.5;
        ctx.fillStyle = P.horn;
        ctx.strokeStyle = Art.ink(P.body);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx - 4.8, hy - 5);
        ctx.lineTo(hx - 5.8, hy - 11);
        ctx.lineTo(hx - 2.2, hy - 6.4);
        ctx.closePath();
        ctx.moveTo(hx + 2.2, hy - 6.4);
        ctx.lineTo(hx + 5.8, hy - 11);
        ctx.lineTo(hx + 4.8, hy - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        Art.body(ctx, hx, hy, 8.4, 7.4, P.body, { lineWidth: 1.4 });
        this._crest(ctx, hx, hy, f, t);
        // Backe bläht sich vor dem Pusten auf (hinter der Schnauze)
        const snx = hx + f * 6.2, sny = hy + 2.6;
        if (puff > 0) Art.body(ctx, hx + f * 2.6, hy + 3.4, 1.6 + puff * 2.2, 1.4 + puff * 1.9, Art.light(P.body, 0.28), { lineWidth: 1, highlight: false });
        // Schnauze (bläht sich beim Pusten mit auf)
        Art.body(ctx, snx, sny, 4.6 + puff * 0.8, 3.5 + puff * 0.5, P.light, { lineWidth: 1.2, highlight: false });
        ctx.fillStyle = Art.ink(P.body);
        ctx.beginPath();
        ctx.arc(snx + f * 2, sny - 1.4, 0.7, 0, TAU);
        ctx.moveTo(snx + f * 0.2 + 0.7, sny - 1.6);
        ctx.arc(snx + f * 0.2, sny - 1.6, 0.7, 0, TAU);
        ctx.fill();
        // Augen
        if (dead) LateWorldArt.xEyes(ctx, hx + f * 0.8, hy - 1.6, 1.6, 3.3);
        else Art.eyes(ctx, hx + f * 0.8, hy - 1.6, 2.8, { gap: 3.3, look: this.look, iris: P.iris, seed: sd });
        // vor dem Pusten leuchtet das Maul
        if (puff > 0) Art.glow(ctx, snx + f * 3, sny + 1, 5 + puff * 7, P.glow, 0.3 + puff * 0.5);
        // Mund: Lächeln, beim Pusten ein rundes „O"
        if (this.mouthT > 0 && !dead) {
            ctx.fillStyle = '#4a1030';
            ctx.beginPath();
            ctx.ellipse(snx + f * 1.2, sny + 1.6, 1.2, 1.6, 0, 0, TAU);
            ctx.fill();
        } else if (puff <= 0.2) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 0.9;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(snx - f * 0.6, sny + 0.4, 2, 0.3, Math.PI - 0.3);
            ctx.stroke();
        }
        Art.blush(ctx, hx + f * 0.5, hy + 2.6, 1.3, 4.4);
        ctx.restore();
    }

    // Elementschmuck auf dem Kopf: Flämmchen, Eiskristall oder Kristallzacken
    _crest(ctx, hx, hy, f, t) {
        if (this.kind === 'fire') {
            const fl = Math.sin(t * 14 + this.seed) * 1.2;
            ctx.fillStyle = '#ffb02e';
            ctx.strokeStyle = '#b3260d';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(hx - f * 2.6, hy - 6.4);
            ctx.quadraticCurveTo(hx - f * 3.4, hy - 10.5 - fl, hx - f * 0.6, hy - 13 - fl);
            ctx.quadraticCurveTo(hx - f * 0.2, hy - 10, hx + f * 1.4, hy - 11.5 + fl * 0.5);
            ctx.quadraticCurveTo(hx + f * 2.2, hy - 8, hx + f * 1.2, hy - 6.6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (this.kind === 'ice') {
            // drei Eiszacken (hell, gut erkennbar auch klein)
            ctx.fillStyle = '#f2fdff';
            ctx.strokeStyle = '#4aa6e0';
            ctx.lineWidth = 0.9;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                const x = hx - f * 0.6 + i * 2.6, y = hy - 6.8 + Math.abs(i) * 0.8;
                ctx.moveTo(x - 1.4, y);
                ctx.lineTo(x, y - (i === 0 ? 5.5 : 3.8));
                ctx.lineTo(x + 1.4, y);
                ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();
            Art.sparkle(ctx, hx - f * 0.6, hy - 11.5, 1.6, '#ffffff', 0.5 + 0.5 * Math.sin(t * 4 + this.seed));
        } else {
            ctx.fillStyle = '#ff9ae0';
            ctx.strokeStyle = '#8a2a8a';
            ctx.lineWidth = 0.9;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const x = hx - f * (5 + i * 3.4), y = hy - 3.5 + i * 3.6;
                ctx.moveTo(x + f * 1.4, y + 1.2);
                ctx.lineTo(x - f * 1.8, y - 3.6);
                ctx.lineTo(x - f * 1.2, y + 1.8);
                ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();
            Art.sparkle(ctx, hx - f * 7, hy - 7, 1.8, '#ffffff', 0.5 + 0.5 * Math.sin(t * 5 + this.seed));
        }
    }

    // Schwanzspitze: Flamme, Eiskristall oder Diamant (ohne Leuchten – das kostet bei vielen Kindern zu viel)
    _tailTip(ctx, x, y, f, t) {
        if (this.kind === 'fire') {
            const fl = Math.sin(t * 16 + this.seed) * 1;
            ctx.fillStyle = '#ffb02e';
            ctx.beginPath();
            ctx.moveTo(x - 2.2, y + 1.5);
            ctx.quadraticCurveTo(x - f * 1.5, y - 4 - fl, x - f * 0.5, y - 6 - fl);
            ctx.quadraticCurveTo(x + f * 1.5, y - 2, x + 2.2, y + 1.5);
            ctx.closePath();
            ctx.fill();
        } else if (this.kind === 'ice') {
            DragonArt.crystal(ctx, x, y + 2.5, 2.2, 6, '#d9f6ff');
        } else {
            DragonArt.crystal(ctx, x, y + 2.5, 2.2, 6, '#ff9ae0');
        }
    }

    // Tod (0,4 s): purzelt, schrumpft und verpufft in Rauch und Funkeln der Elementfarbe
    _drawDeath(ctx) {
        const k = clamp(this.deathProgress(), 0, 1);
        const a0 = ctx.globalAlpha;
        if (k < 0.55) {
            const q = k / 0.55;
            ctx.save();
            ctx.globalAlpha = a0 * (1 - q * 0.6);
            ctx.translate(0, -10);
            ctx.rotate(q * this.face * 2.4);
            ctx.scale(1 - q * 0.6, 1 - q * 0.6);
            ctx.translate(0, 10);
            this._drawBody(ctx, true);
            ctx.restore();
        }
        ctx.globalAlpha = a0 * (1 - k) * 0.85;
        ctx.fillStyle = '#f4efff';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = (i * TAU) / 5 + 0.4;
            const d = 4 + k * 12, r = 3 + k * 4;
            const x = Math.cos(a) * d, y = -10 + Math.sin(a) * d * 0.8;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
        ctx.globalAlpha = a0;
        for (let i = 0; i < 4; i++) {
            const a = (i * TAU) / 4 + k * 2;
            Art.sparkle(ctx, Math.cos(a) * (6 + k * 16), -10 + Math.sin(a) * (6 + k * 14), 3 * (1 - k) + 1, this.pal.glow, 1 - k);
        }
    }
}

// Puster der Drachenkinder und Funken der Diamant-Kristalle.
// kind: 'fire' (Feuerball), 'ice' (Schneeflocke, bremst Mark), 'diamond' (Splitter), 'spark' (Kristall-Funke).
class DragonPuff extends Projectile {
    constructor(x, y, angle, kind) {
        const speed = kind === 'ice' ? 125 : kind === 'diamond' ? 170 : kind === 'spark' ? 105 : 150;
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', kind === 'spark' ? 30 : 60);
        this.kind = kind;
        this.radius = kind === 'spark' ? 4 : 5.5;
        this.lifetime = kind === 'spark' ? 0.55 : 2.8;
        if (kind === 'ice') this.slow = true;
        this.spin = Math.random() < 0.5 ? 1 : -1;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const k = this.kind;
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        if (k === 'spark') {
            Art.glow(ctx, p.x, p.y, 10, '#ff6fd8', 0.65);
            Art.sparkle(ctx, p.x, p.y, 4.5, '#ffffff', 1);
            Art.sparkle(ctx, p.x, p.y, 2.4, '#ff9ae0', 1);
            return;
        }
        // Schweif
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.35;
        ctx.fillStyle = k === 'fire' ? '#ffb347' : (k === 'ice' ? '#d4f4ff' : '#ffc2f0');
        ctx.beginPath();
        ctx.moveTo(p.x - dy * 4, p.y + dx * 4);
        ctx.lineTo(p.x - dx * 16, p.y - dy * 16);
        ctx.lineTo(p.x + dy * 4, p.y - dx * 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev;
        ctx.save();
        ctx.translate(p.x, p.y);
        if (k === 'fire') {
            Art.glow(ctx, 0, 0, 14, '#ff7a1f', 0.7);
            ctx.rotate(Math.atan2(dy, dx));
            const fl = 1 + Math.sin(this.age * 30) * 0.15;
            ctx.beginPath();
            ctx.moveTo(-10 * fl, 0);
            ctx.quadraticCurveTo(-3, -5.5, 2, -4.6);
            ctx.arc(2, 0, 4.6, -Math.PI / 2, Math.PI / 2);
            ctx.quadraticCurveTo(-3, 5.5, -10 * fl, 0);
            ctx.closePath();
            ctx.fillStyle = '#ff8a2e';
            ctx.fill();
            ctx.strokeStyle = '#b3260d';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.fillStyle = '#ffe066';
            ctx.beginPath();
            ctx.arc(2, 0, 2.5, 0, TAU);
            ctx.fill();
        } else if (k === 'ice') {
            Art.glow(ctx, 0, 0, 14, '#5fd8ff', 0.7);
            ctx.rotate(this.age * 4 * this.spin);
            DragonArt.snowflake(ctx, 6, '#ffffff', '#2a7fc0', 1.1);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, 1.6, 0, TAU);
            ctx.fill();
        } else {
            Art.glow(ctx, 0, 0, 13, '#ff6fd8', 0.65);
            ctx.rotate(Math.atan2(dy, dx));
            Art.shape(ctx, c => {
                c.moveTo(7, 0);
                c.lineTo(0, -4);
                c.lineTo(-6, 0);
                c.lineTo(0, 4);
                c.closePath();
            }, { x: -6, y: -4, w: 13, h: 8 }, '#ff8ae0', { lineWidth: 1.2, glossy: true, outline: '#8a2a8a' });
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(7, 0);
            ctx.stroke();
            Art.sparkle(ctx, 1, -3, 2.4, '#ffffff', 0.5 + 0.5 * Math.sin(this.age * 20));
        }
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Strahl des Drachenvaters ──
// ══════════════════════════════════════════

// Liegt in der Geschoss-Liste, damit er über allen Figuren gezeichnet wird und beim Bosssieg mit
// verschwindet. owner 'bossfx': die Engine prüft keine Treffer, das macht der Strahl selbst.
// Treffer: Abstand Zielmitte–Strahl ≤ halbe Breite + Zielradius, jedes Ziel höchstens einmal.
class DragonBeam {
    constructor(kind, x0, y0, ang, len, width, dur) {
        this.kind = kind;
        this.x0 = x0;
        this.y0 = y0;
        this.ang = ang;
        this.len = len;
        this.width = width;
        this.dur = dur;
        this.t = 0;
        this.dead = false;
        this.owner = 'bossfx';
        this.damage = 0;
        this.radius = 0;
        this.x = x0;            // Punkt für die Bildschirm-Prüfung der Engine (wird auf Marks Nähe gesetzt)
        this.y = y0;
        this.hit = [];
        this.seed = Math.random() * 10;
    }

    // wächst in 0,08 s auf volle Länge
    curLen() {
        return this.len * Math.min(1, this.t / 0.08);
    }

    update(dt) {
        this.t += dt;
        if (this.t >= this.dur) {
            this.dead = true;
            return;
        }
        if (typeof Game === 'undefined') return;
        const L = this.curLen();
        const x1 = this.x0 + Math.cos(this.ang) * L, y1 = this.y0 + Math.sin(this.ang) * L;
        const P = Game.player;
        if (P) {
            const px = P.x + P.w / 2, py = P.y + P.h / 2;
            const d = DragonArt.segDist(px, py, this.x0, this.y0, x1, y1, DRAGON_TMP);
            this.x = DRAGON_TMP.x;
            this.y = DRAGON_TMP.y;
            if (!P.dead && this.hit.indexOf(P) < 0 && d <= this.width / 2 + P.w / 2) {
                const before = P.hp;
                // aus dem Strahl hinausschubsen
                const ang = d > 0.5 ? Math.atan2(py - DRAGON_TMP.y, px - DRAGON_TMP.x) : this.ang + Math.PI / 2;
                DragonArt.hurt(P, DRAGON_BEAM_DMG, ang, 230);
                if (P.hp < before) {
                    this.hit.push(P);
                    if (this.kind === 'ice' && P.applySlow) P.applySlow(2.5, 0.55);
                    DragonArt.burst(px, py, [DRAGON_BEAMS[this.kind].color, '#ffffff'], 10, 140, 0.45, { kind: 'star' });
                }
            }
        }
        const comps = Game.companions || [];
        for (const c of comps) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0 || c.iFrames > 0) continue;
            if (this.hit.indexOf(c) >= 0) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (DragonArt.segDist(cx, cy, this.x0, this.y0, x1, y1) > this.width / 2 + Math.max(c.w, c.h) / 2) continue;
            this.hit.push(c);
            // Freunde verschwinden nie durch einen Strahl: statt besiegt nur umgehauen
            if (c.hp - DRAGON_BEAM_DMG <= 0) c.knockOut(8);
            else c.takeDamage(DRAGON_BEAM_DMG);
            DragonArt.burst(cx, cy, [DRAGON_BEAMS[this.kind].color, '#ffffff'], 10, 140, 0.45, { kind: 'star' });
        }
    }

    draw(ctx, camera) {
        const cfg = DRAGON_BEAMS[this.kind];
        const L = this.curLen();
        if (L < 1) return;
        const t = Art.time;
        const fade = this.t > this.dur - 0.14 ? clamp((this.dur - this.t) / 0.14, 0, 1) : 1;
        let w = this.width * (0.45 + 0.55 * fade);
        if (this.kind === 'fire') w *= 1 + Math.sin(t * 46 + this.seed) * 0.12;   // heißes Flackern
        const p = camera.worldToScreen(this.x0, this.y0);
        const prev = ctx.globalAlpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.ang);
        ctx.fillStyle = cfg.glow;
        ctx.globalAlpha = prev * 0.26 * fade;
        ctx.beginPath();
        ctx.roundRect(-w * 0.2, -w * 0.95, L + w * 0.4, w * 1.9, w * 0.95);
        ctx.fill();
        ctx.fillStyle = cfg.color;
        ctx.globalAlpha = prev * 0.9 * fade;
        ctx.beginPath();
        ctx.roundRect(0, -w / 2, L, w, w / 2);
        ctx.fill();
        ctx.fillStyle = cfg.core;
        ctx.globalAlpha = prev * fade;
        ctx.beginPath();
        ctx.roundRect(0, -w * 0.2, L, w * 0.4, w * 0.2);
        ctx.fill();
        if (this.kind === 'fire') {
            // Flammenzungen am Rand wandern nach vorn
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const x = ((t * 1.8 + i / 6 + this.seed) % 1) * L, side = i % 2 ? 1 : -1;
                const fl = 3 + Math.sin(t * 30 + i) * 1.5;
                ctx.moveTo(x - 4, side * w * 0.45);
                ctx.quadraticCurveTo(x, side * (w * 0.5 + fl * 2), x + 5, side * w * 0.45);
            }
            ctx.fill();
        } else if (this.kind === 'ice') {
            // Eiskristalle ziehen im Strahl mit
            for (let i = 0; i < 4; i++) {
                const x = ((t * 1.2 + i / 4 + this.seed) % 1) * L;
                ctx.save();
                ctx.translate(x, Math.sin(i * 2.3 + t * 3) * w * 0.25);
                ctx.rotate(t * 3 + i);
                DragonArt.snowflake(ctx, 3.4, '#ffffff', '#3a8ac0', 0.8);
                ctx.restore();
            }
        } else {
            // Prisma: bunte Randlinien und Funkeln
            ctx.globalAlpha = prev * 0.85 * fade;
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = '#7ff0ff';
            ctx.beginPath();
            ctx.moveTo(0, -w / 2 - 1);
            ctx.lineTo(L, -w / 2 - 1);
            ctx.stroke();
            ctx.strokeStyle = '#ffe066';
            ctx.beginPath();
            ctx.moveTo(0, w / 2 + 1);
            ctx.lineTo(L, w / 2 + 1);
            ctx.stroke();
            ctx.globalAlpha = prev * fade;
            for (let i = 0; i < 5; i++) {
                const x = ((t * 0.9 + i / 5 + this.seed) % 1) * L;
                Art.sparkle(ctx, x, Math.sin(t * 7 + i * 1.7) * w * 0.3, 2.5 + 2 * Math.abs(Math.sin(t * 9 + i)), '#ffffff', 1);
            }
        }
        ctx.restore();
        ctx.globalAlpha = prev;
        const ex = p.x + Math.cos(this.ang) * L, ey = p.y + Math.sin(this.ang) * L;
        Art.glow(ctx, p.x, p.y, w * 1.4, cfg.glow, 0.8 * fade);
        Art.glow(ctx, ex, ey, w * 1.6, cfg.glow, 0.9 * fade);
        Art.sparkle(ctx, ex, ey, w * 0.55, cfg.core, fade);
    }
}

// ══════════════════════════════════════════
// ── Schatten des Drachenvaters (Welt 24) ──
// ══════════════════════════════════════════

// Der Vater bewacht seine Kinder: alle 20–35 s gleitet sein riesiger Schatten über den Bildschirm,
// die Kamera bebt leicht und von fern ist ein Brüllen zu hören. Kein Schaden, nicht im Bosskampf.
// Liegt in Game.props; onlyUnder = nur drawUnder (unter allen Figuren), nicht in der sortierten Figurenliste.
class DragonFatherShadow {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.w = 1;
        this.h = 1;
        this.onlyUnder = true;
        this.noShadow = true;
        this.wait = randRange(7, 12);   // der erste Überflug kommt bald, damit man ihn sieht
        this.pass = null;
    }

    update(dt) {
        if (typeof Game !== 'undefined' && (Game.bossActive || Game.bossDefeated)) {
            this.pass = null;
            return;
        }
        const p = this.pass;
        if (p) {
            p.t += dt;
            if (!p.shook && p.t > p.dur * 0.42) {
                p.shook = true;
                DragonArt.shake(2.2, 0.7);
            }
            if (p.t >= p.dur) {
                this.pass = null;
                this.wait = randRange(20, 35);
            }
            return;
        }
        this.wait -= dt;
        if (this.wait <= 0) this._start();
    }

    _start() {
        const cam = typeof Game !== 'undefined' ? Game.camera : null;
        if (!cam) {
            this.wait = 5;
            return;
        }
        // meist waagrecht, etwas schräg, von links oder rechts
        const ang = (Math.random() < 0.5 ? 0 : Math.PI) + randRange(-0.45, 0.45);
        const cx = cam.x + cam.width / 2, cy = cam.y + cam.height / 2;
        const reach = Math.hypot(cam.width, cam.height) / 2 + 190;
        this.pass = {
            ang, t: 0, dur: 3.4, shook: false, size: 1.3,
            x0: cx - Math.cos(ang) * reach, y0: cy - Math.sin(ang) * reach + randRange(-60, 60),
            x1: cx + Math.cos(ang) * reach, y1: cy + Math.sin(ang) * reach + randRange(-60, 60),
        };
        DragonArt.roar(0.13);
    }

    // Schatten als weiche, dunkle Form am Boden (vorgerendertes Bild, pro Bild nur ein drawImage)
    drawUnder(ctx, camera) {
        const p = this.pass;
        if (!p) return;
        const q = clamp(p.t / p.dur, 0, 1);
        const s = camera.worldToScreen(p.x0 + (p.x1 - p.x0) * q, p.y0 + (p.y1 - p.y0) * q);
        const fade = Math.min(1, q * 6, (1 - q) * 6);
        const flap = 1 + Math.sin(p.t * 3.4) * 0.12;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(p.ang);
        ctx.scale(p.size, p.size * flap);
        ctx.globalAlpha = 0.24 * fade;
        ctx.drawImage(DragonFatherShadow.sprite(), -128, -128, 256, 256);
        ctx.restore();
    }

    draw() {}

    // Umriss des fliegenden Vaters von oben (Flugrichtung +x), einmal in eine eigene Fläche gezeichnet
    static sprite() {
        if (DragonFatherShadow._sprite) return DragonFatherShadow._sprite;
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const g = c.getContext('2d');
        g.translate(128, 128);
        g.fillStyle = '#000000';
        g.strokeStyle = '#000000';
        g.lineCap = 'round';
        g.lineJoin = 'round';
        // Körper
        g.beginPath();
        g.ellipse(-4, 0, 44, 27, 0, 0, TAU);
        g.fill();
        // Flügel links und rechts der Flugrichtung, mit gezacktem Hinterrand
        for (let i = 0; i < 2; i++) {
            const s = i ? 1 : -1;
            g.beginPath();
            g.moveTo(20, s * 14);
            g.quadraticCurveTo(14, s * 72, -2, s * 120);
            g.quadraticCurveTo(-14, s * 100, -24, s * 96);
            g.quadraticCurveTo(-28, s * 74, -42, s * 70);
            g.quadraticCurveTo(-44, s * 48, -56, s * 42);
            g.quadraticCurveTo(-46, s * 26, -30, s * 16);
            g.closePath();
            g.fill();
        }
        // Schwanz mit Pfeilspitze
        g.beginPath();
        g.moveTo(-40, -9);
        g.quadraticCurveTo(-86, -6, -110, 6);
        g.lineTo(-100, 13);
        g.quadraticCurveTo(-78, 8, -40, 9);
        g.closePath();
        g.fill();
        g.beginPath();
        g.moveTo(-104, 0);
        g.lineTo(-124, 12);
        g.lineTo(-104, 20);
        g.closePath();
        g.fill();
        // drei Hälse und Köpfe nach vorn
        g.lineWidth = 15;
        g.beginPath();
        g.moveTo(28, -12);
        g.quadraticCurveTo(60, -24, 82, -40);
        g.moveTo(34, 0);
        g.lineTo(98, 0);
        g.moveTo(28, 12);
        g.quadraticCurveTo(60, 24, 82, 40);
        g.stroke();
        g.beginPath();
        g.ellipse(90, -44, 15, 11, -0.5, 0, TAU);
        g.fill();
        g.beginPath();
        g.ellipse(106, 0, 16, 11, 0, 0, TAU);
        g.fill();
        g.beginPath();
        g.ellipse(90, 44, 15, 11, 0.5, 0, TAU);
        g.fill();
        DragonFatherShadow._sprite = c;
        return c;
    }
}
DragonFatherShadow._sprite = null;

// ══════════════════════════════════════════
// ── Boss Welt 24: Drachenvater ──
// ══════════════════════════════════════════

// Riesiger, freundlich-majestätischer Drache: türkiser Kugelbauch, goldene Flügel, drei Köpfe auf langen
// Hälsen – links Eis (blau), in der Mitte Feuer (rot-orange, Hörnerkrone), rechts Diamant (lila-rosa).
// Hitbox 80×64, Zeichnung ~180 breit und ~135 hoch. Stampft langsam (mit Kollision) und hält Abstand.
// Ablauf: Intro → Laufen → Strahl eines Kopfes → Laufen → … ; Phase 2: Dreifach-Strahl, Strahl, Strahl, …
class BossDragonFather extends Enemy {
    constructor(x, y) {
        super(x, y, 80, 64);
        this.hp = 110;
        this.maxHp = 110;
        this.speed = 30;
        this.damage = 1;
        // Kein Berührungsschaden: seine Gefahr sind die Strahlen. So verschwinden Juri und das Krokodil
        // im Kampf nie (Strahlen hauen sie nur um), auch wenn sie ihn aus der Nähe hauen.
        this.contactDamage = false;
        this.isBoss = true;
        this.fxColor = '#4fd0a4';
        this.shadow = { rx: 50, ry: 14 };
        this.seed = Math.random() * 10;
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.stepSign = 1;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;                // Phase 2: jeder dritte Angriff ist der Dreifach-Strahl
        this.lastHead = -1;
        this.triple = false;
        this.target = null;          // Ziel des Strahls: Mark oder ein wacher Freund
        this.heads = [];
        for (let i = 0; i < 3; i++) this.heads.push({ on: false, a: Math.PI / 2, len: 0, look: { x: 0, y: 1 } });
        this.shards = [];            // Diamant-Kristalle am Boden
        this._m = { x: 0, y: 0 };
        this._hd = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];   // Kopfpositionen (nur Zeichnen)
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Ein Riese lässt sich kaum wegschubsen.
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.2);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._updateShards(dt, projectiles);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0.6);
                break;
            case 'walk':
                this._walk(dt, world, px, py);
                if (this.stateT <= 0) this._nextAttack(world, player);
                break;
            case 'charge':
                this._aimHeads(world, false);
                if (this.stateT <= 0) this._fire(world, projectiles);
                break;
            case 'beam':
                if (this.stateT <= 0) this._afterBeam();
                break;
            default:            // recover, weak, roar
                if (this.stateT <= 0) this._toWalk();
        }
        this._updateLooks(dt, px, py);
    }

    _toWalk() {
        if (this.phase === 2 && !this.roared) {
            // Wut-Gebrüll beim Wechsel in Phase 2 (kein Angriff, nicht unverwundbar)
            this.roared = true;
            this._set('roar', 1.0);
            const x = this.centerX(), y = this.y + this.h - 96;
            DragonArt.shake(7, 0.5);
            DragonArt.burst(x, y, ['#ff7a1f', '#7fd8ff', '#ff8ae0', '#ffffff'], 18, 190, 0.6, { kind: 'star' });
            DragonArt.ring(x, y + 40, '#ffd23f', 110, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.8, 1.1) : randRange(1.25, 1.65));
    }

    // Stampft langsam: näher heran, wenn Mark weit weg ist, zurück, wenn er zu nah kommt, sonst seitwärts
    _walk(dt, world, px, py) {
        const cx = this.centerX(), cy = this.centerY();
        const dx = px - cx, dy = py - cy;
        const d = Math.hypot(dx, dy) || 1;
        let vx, vy, sp = this.speed;
        if (d > 185) {
            vx = dx / d; vy = dy / d;
        } else if (d < 115) {
            vx = -dx / d; vy = -dy / d;
        } else {
            vx = (-dy / d) * this.strafe; vy = (dx / d) * this.strafe; sp *= 0.7;
        }
        this.walkT += dt;
        const s = Math.sin(this.walkT * 3.2);
        const v = sp * (0.55 + 0.9 * s * s);
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * v * dt, vy * v * dt, world);
        if (Math.hypot(this.x - ox, this.y - oy) < v * dt * 0.3) this.strafe = -this.strafe;
        this.moving = true;
        // Stampfen: bei jedem Schritt ein kleines Beben und etwas Staub
        const sign = s >= 0 ? 1 : -1;
        if (sign !== this.stepSign) {
            this.stepSign = sign;
            DragonArt.shake(1.4, 0.12);
            DragonArt.burst(cx + sign * 24, this.y + this.h - 2, 'rgba(235,225,255,0.85)', 4, 50, 0.4, { kind: 'smoke', size: 4 });
        }
    }

    _nextAttack(world, player) {
        this.target = this._pickTarget(world, player);
        let triple = false;
        if (this.phase === 2) {
            triple = this.seq % 3 === 0;
            this.seq++;
        }
        this.triple = triple;
        for (const h of this.heads) h.on = triple;
        if (!triple) {
            let i = randInt(0, 2);
            if (i === this.lastHead) i = (i + randInt(1, 2)) % 3;
            this.lastHead = i;
            this.heads[i].on = true;
        }
        this._aimHeads(world, true);
        // Ankündigung in Boss-Zeit (÷1,15 = echte Zeit): 1,12 → 0,97 s, dreifach 1,3 → 1,13 s
        this._set('charge', triple ? 1.3 : 1.12);
    }

    // Mark oder ein wacher, sichtbarer Freund (Juri, Krokodil – nicht die Schlange auf der Schulter)
    _pickTarget(world, player) {
        const list = [player];
        const comps = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        const mx = this.centerX(), my = this.centerY();
        for (const c of comps) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - mx, cy - my) > 420) continue;
            if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my, cx, cy)) continue;
            list.push(c);
        }
        return list[Math.floor(Math.random() * list.length)];
    }

    // Maul eines Kopfes in Weltkoordinaten (liegt in this._m); passt zur Zeichnung in _head
    _mouth(i) {
        const H = DRAGON_HEADS[i], a = this.heads[i].a, s = DRAGON_HEAD_SCALE;
        this._m.x = this.centerX() + H.x + Math.cos(a) * 6.5 * s;
        this._m.y = this.y + this.h + H.y + (8 + Math.sin(a) * 2.4) * s;
        return this._m;
    }

    // Köpfe zielen aufs Ziel (beim Dreifach-Strahl die Seitenköpfe links/rechts daneben); die letzten
    // ~0,3 s steht die Richtung fest, damit man ausweichen kann.
    _aimHeads(world, force) {
        if (!force && this.stateT <= DRAGON_LOCK) return;
        const tg = this.target;
        if (!tg || tg.dead) return;
        const tx = tg.x + tg.w / 2, ty = tg.y + tg.h / 2;
        const baseX = this.centerX(), baseY = this.y + this.h;
        // Querachse zur Blickrichtung des Mittelkopfs
        const mhx = baseX + DRAGON_HEADS[1].x, mhy = baseY + DRAGON_HEADS[1].y;
        const d = Math.hypot(tx - mhx, ty - mhy) || 1;
        const nx = -(ty - mhy) / d, ny = (tx - mhx) / d;
        const ax = tx + nx * DRAGON_TRIPLE_GAP, ay = ty + ny * DRAGON_TRIPLE_GAP;
        const bx = tx - nx * DRAGON_TRIPLE_GAP, by = ty - ny * DRAGON_TRIPLE_GAP;
        const aLeft = ax < bx - 0.5 || (Math.abs(ax - bx) <= 0.5 && ay < by);
        for (let i = 0; i < 3; i++) {
            const h = this.heads[i];
            if (!h.on) continue;
            let px = tx, py = ty;
            if (this.triple && i !== 1) {
                const useA = (i === 0) === aLeft;
                px = useA ? ax : bx;
                py = useA ? ay : by;
            }
            const hx = baseX + DRAGON_HEADS[i].x, hy = baseY + DRAGON_HEADS[i].y;
            h.a = Math.atan2(py - hy, px - hx);
            const m = this._mouth(i);
            h.a = Math.atan2(py - m.y, px - m.x);      // vom Maul aus genau aufs Ziel
            const m2 = this._mouth(i);
            h.len = DragonArt.beamLength(world, m2.x, m2.y, h.a, DRAGON_BEAM_MAX);
        }
    }

    _fire(world, projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        for (let i = 0; i < 3; i++) {
            const h = this.heads[i];
            if (!h.on) continue;
            const kind = DRAGON_HEADS[i].kind, cfg = DRAGON_BEAMS[kind];
            const m = this._mouth(i);
            const x0 = m.x, y0 = m.y;
            h.len = DragonArt.beamLength(world, x0, y0, h.a, DRAGON_BEAM_MAX);
            if (list && h.len > 4) list.push(new DragonBeam(kind, x0, y0, h.a, h.len, cfg.width, cfg.dur));
            if (kind === 'diamond' && h.len > 40) this._spawnShards(world, x0, y0, h.a, h.len);
            DragonArt.burst(x0, y0, [cfg.color, cfg.core], 8, 120, 0.35, { kind: 'spark' });
        }
        DragonArt.shake(this.triple ? 7 : 4, this.triple ? 0.45 : 0.3);
        this._set('beam', 0.95);
    }

    _afterBeam() {
        for (const h of this.heads) h.on = false;
        // nach dem Dreifach-Strahl erschöpft: ~1 s Zeit zum Zurückhauen
        if (this.triple) this._set('weak', 1.15);
        else this._set('recover', 0.35);
        this.triple = false;
    }

    // Diamantstrahl: 3–4 Kristalle bleiben am Boden und zerplatzen nach ~1,5 s in je 4 Funken
    _spawnShards(world, x0, y0, a, len) {
        const n = len > 260 ? 4 : 3;
        for (let i = 0; i < n; i++) {
            const d = len * (0.32 + (0.6 * (i + 0.5)) / n) + randRange(-8, 8);
            const x = x0 + Math.cos(a) * d + randRange(-5, 5), y = y0 + Math.sin(a) * d + randRange(-5, 5);
            if (world && world.isWall && world.isWall(x, y)) continue;
            this.shards.push({ x, y, t: 0, life: 1.75, rot: Math.random() * TAU, s: randRange(0.85, 1.15) });
        }
    }

    _updateShards(dt, projectiles) {
        for (let i = this.shards.length - 1; i >= 0; i--) {
            const s = this.shards[i];
            s.t += dt;
            if (s.t < s.life) continue;
            const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
            if (list) for (let j = 0; j < 4; j++) list.push(new DragonPuff(s.x, s.y - 4, s.rot + (j * TAU) / 4, 'spark'));
            DragonArt.burst(s.x, s.y - 4, ['#ff8ae0', '#ffffff', '#c07bff'], 8, 110, 0.4, { kind: 'star' });
            this.shards.splice(i, 1);
        }
    }

    // Blickrichtung je Kopf: beim Zielen in Strahlrichtung, sonst zu Mark (nur Anzeige)
    _updateLooks(dt, px, py) {
        const k = Math.min(1, dt * 6);
        const bx = this.centerX(), by = this.y + this.h;
        for (let i = 0; i < 3; i++) {
            const h = this.heads[i];
            let lx, ly;
            if (h.on && (this.state === 'charge' || this.state === 'beam')) {
                lx = Math.cos(h.a);
                ly = Math.sin(h.a);
            } else {
                const dx = px - (bx + DRAGON_HEADS[i].x), dy = py - (by + DRAGON_HEADS[i].y);
                const d = Math.hypot(dx, dy) || 1;
                lx = dx / d;
                ly = dy / d;
            }
            h.look.x += (lx - h.look.x) * k;
            h.look.y += (ly - h.look.y) * k;
        }
    }

    // ── Zeichnen ──

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        ctx.save();
        ctx.translate(pos.x + this.w / 2, pos.y + this.h);
        if (this.dead) this._drawDead(ctx);
        else this._drawAlive(ctx);
        ctx.restore();
    }

    _drawAlive(ctx) {
        const t = Art.time, st = this.state, p2 = this.phase === 2;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const step = this.moving ? Math.sin(this.walkT * 3.2) : 0;
        const bob = this.moving ? -Math.abs(step) * 3 : Math.sin(t * 1.6 + this.seed) * 1.3;
        const roar = st === 'roar' ? Math.sin(k * Math.PI) : 0;
        const weak = st === 'weak';
        const flap = roar > 0 ? 0.25 + Math.sin(t * 9) * 0.45 : (weak ? -0.35 : Math.sin(t * 2.2 + this.seed) * 0.15);
        this._tail(ctx, bob, t, weak);
        this._wings(ctx, bob, flap);
        this._legs(ctx, step);
        this._torso(ctx, bob, p2);
        for (let i = 0; i < 3; i++) this._headXY(i, this._hd[i], t, bob, st, k, roar);
        for (let i = 0; i < 3; i++) this._neck(ctx, i, this._hd[i], bob);
        this._arms(ctx, bob);
        for (let i = 0; i < 3; i++) this._head(ctx, i, this._hd[i], st, k, p2, roar, false);
        if (weak) {
            // erschöpft: Schweißtropfen an den Köpfen
            for (let i = 0; i < 3; i++) {
                const o = this._hd[i];
                const q = (t * 1.6 + i * 0.37) % 1;
                Art.body(ctx, o.x + (i - 1 || 1) * (14 + q * 6), o.y - 8 + q * 14, 2, 2.8, '#9fe0ff', { lineWidth: 1, outline: '#2a6f9e', highlight: false });
            }
        } else if (p2) {
            // Phase 2: Rauchwölkchen aus den Nasenlöchern des Mittelkopfs
            const o = this._hd[1];
            const prevA = ctx.globalAlpha;
            ctx.fillStyle = '#eceaf5';
            for (let i = 0; i < 2; i++) {
                const q = (t * 1.2 + i * 0.5) % 1;
                ctx.globalAlpha = prevA * (1 - q) * 0.6;
                ctx.beginPath();
                ctx.arc(o.x + (i ? 4 : -4) + (i ? 1 : -1) * q * 6, o.y - 2 - q * 18, 2.5 + q * 4, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prevA;
        }
    }

    // Kopfposition fürs Zeichnen: wiegen sich, zielende Köpfe stehen still (Strahl startet am Maul)
    _headXY(i, out, t, bob, st, k, roar) {
        const H = DRAGON_HEADS[i], h = this.heads[i];
        let x = H.x, y = H.y;
        const busy = h.on && (st === 'charge' || st === 'beam');
        if (!busy) {
            x += Math.sin(t * 1.4 + i * 2.1 + this.seed) * 2.6;
            y += Math.sin(t * 1.9 + i * 1.3 + this.seed) * 1.8 + bob * 1.1;
        }
        if (st === 'weak') {
            y += 12;
            x += (i - 1) * 3;
        }
        if (roar > 0) {
            y -= roar * 6;
            x += (i - 1) * roar * 6;
        }
        if (busy && st === 'charge') {
            x -= Math.cos(h.a) * 2.5 * k;
            y -= Math.sin(h.a) * 2.5 * k;
        } else if (busy) {
            x -= Math.cos(h.a) * 3;
            y -= Math.sin(h.a) * 3;
        }
        out.x = x;
        out.y = y;
    }

    // Schwanz nach rechts hinten mit goldener Pfeilspitze
    _tail(ctx, bob, t, calm) {
        const sw = Math.sin(t * 1.8 + this.seed) * (calm ? 1 : 4);
        const tx = 70 + sw * 0.3, ty = -24 + sw;
        Art.shape(ctx, c => {
            c.moveTo(18, -20 + bob);
            c.quadraticCurveTo(50, -6, tx, ty);
            c.quadraticCurveTo(50, 2, 20, -6);
            c.closePath();
        }, { x: 18, y: -30, w: 56, h: 30 }, DRAGON_BODY, { lineWidth: 2 });
        Art.shape(ctx, c => {
            c.moveTo(tx - 5, ty + 2);
            c.lineTo(tx + 1, ty - 10);
            c.lineTo(tx + 9, ty + 1);
            c.lineTo(tx + 1, ty + 1);
            c.closePath();
        }, { x: tx - 5, y: ty - 10, w: 14, h: 12 }, DRAGON_GOLD, { lineWidth: 1.6 });
    }

    // Goldene Fledermausflügel hinter dem Körper; flap hebt/senkt die Spitzen
    _wings(ctx, bob, flap) {
        for (let i = 0; i < 2; i++) {
            const s = i ? 1 : -1;
            const lift = flap * 24;
            const wx = s * 58, wy = -102 - lift + bob * 0.5;
            const tx = s * 80, ty = -90 - lift * 1.2;
            Art.shape(ctx, c => {
                c.moveTo(s * 22, -58 + bob);
                c.quadraticCurveTo(s * 40, -96 - lift * 0.6 + bob, wx, wy);
                c.lineTo(tx, ty);
                c.quadraticCurveTo(s * 76, -74, s * 75, -62 - lift * 0.3);
                c.quadraticCurveTo(s * 66, -67, s * 59, -53);
                c.quadraticCurveTo(s * 50, -59, s * 43, -45 + bob);
                c.quadraticCurveTo(s * 34, -50, s * 26, -38 + bob);
                c.closePath();
            }, { x: s > 0 ? 20 : -82, y: -114, w: 62, h: 78 }, DRAGON_WING, { lineWidth: 2 });
            ctx.strokeStyle = DRAGON_DARK;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(s * 22, -58 + bob);
            ctx.quadraticCurveTo(s * 40, -96 - lift * 0.6 + bob, wx, wy);
            ctx.lineTo(tx, ty);
            ctx.moveTo(wx, wy);
            ctx.lineTo(s * 75, -62 - lift * 0.3);
            ctx.moveTo(wx, wy);
            ctx.lineTo(s * 59, -53);
            ctx.moveTo(wx, wy);
            ctx.lineTo(s * 43, -45 + bob);
            ctx.stroke();
        }
    }

    _legs(ctx, step) {
        for (let i = 0; i < 2; i++) {
            const s = i ? 1 : -1;
            const lift = Math.max(0, s * step) * 5;
            Art.body(ctx, s * 22, -15 - lift, 12, 12, DRAGON_DARK, { lineWidth: 2 });
            Art.body(ctx, s * 25, -5.5 - lift, 13.5, 6, DRAGON_DARK, { lineWidth: 2 });
            ctx.fillStyle = '#fff6e0';
            ctx.beginPath();
            for (let j = -1; j <= 1; j++) {
                const cx = s * 25 + j * 7.5, cy = -1.4 - lift;
                ctx.moveTo(cx + 2, cy);
                ctx.ellipse(cx, cy, 2, 1.5, 0, 0, TAU);
            }
            ctx.fill();
        }
    }

    // Kugelbauch mit goldenen Bauchplatten (Phase 2: glüht vor Wut)
    _torso(ctx, bob, p2) {
        Art.body(ctx, 0, -36 + bob, 37, 31, DRAGON_BODY, { lineWidth: 2.6 });
        if (p2) Art.glow(ctx, 0, -30 + bob, 30, '#ffb13d', 0.22 + 0.1 * Math.sin(Art.time * 6));
        Art.body(ctx, 0, -30 + bob, 23, 23, DRAGON_BELLY, { lineWidth: 1.8, highlight: false });
        ctx.strokeStyle = 'rgba(176,120,40,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const yy = -45 + i * 8.5 + bob;
            const r = (yy - (-30 + bob)) / 23;
            const hw = Math.sqrt(Math.max(0, 1 - r * r)) * 21;
            ctx.moveTo(-hw, yy);
            ctx.quadraticCurveTo(0, yy + 3.5, hw, yy);
        }
        ctx.stroke();
    }

    // kurze Ärmchen seitlich am Bauch
    _arms(ctx, bob) {
        for (let i = 0; i < 2; i++) {
            const s = i ? 1 : -1;
            Art.limb(ctx, s * 33, -40 + bob, s * 31, -29 + bob, 7, DRAGON_BODY, { lineWidth: 2 });
            LateWorldArt.blob(ctx, s * 30, -27 + bob, 4.6, 3.8, DRAGON_BODY, 1.6);
        }
    }

    // Hals vom Körper zum Kopf: türkis mit hellem Kehlstreifen und goldenem Ring unter dem Kopf
    _neck(ctx, i, o, bob) {
        const bx = DRAGON_NECKS[i * 2], by = DRAGON_NECKS[i * 2 + 1] + bob;
        const hx = o.x, hy = o.y + 10;
        const cx = (bx + hx) / 2 + (i - 1) * 9, cy = (by + hy) / 2 + 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(cx, cy, hx, hy);
        ctx.strokeStyle = Art.ink(DRAGON_BODY);
        ctx.lineWidth = 17;
        ctx.stroke();
        ctx.strokeStyle = DRAGON_BODY;
        ctx.lineWidth = 13;
        ctx.stroke();
        ctx.strokeStyle = DRAGON_BELLY;
        ctx.lineWidth = 4.5;
        ctx.stroke();
        Art.body(ctx, hx, hy + 4.5, 7.8, 3.1, DRAGON_GOLD, { lineWidth: 1.3, highlight: false });
    }

    // Ein Kopf: Hörner je Element, Schnauze in Blickrichtung, Augen, Maul (beim Aufladen offen und leuchtend)
    _head(ctx, i, o, st, k, p2, roar, dead) {
        const H = DRAGON_HEADS[i], h = this.heads[i], P = DRAGON_PAL[H.kind];
        const t = Art.time;
        const busy = !dead && h.on && (st === 'charge' || st === 'beam');
        const ck = busy ? (st === 'beam' ? 1 : k) : 0;
        const lk = h.look;
        const lx = dead ? 0 : lk.x, ly = dead ? 0.4 : lk.y;
        if (ck > 0) Art.glow(ctx, o.x, o.y, 24 + ck * 18, P.glow, 0.22 + ck * 0.55);
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.scale(DRAGON_HEAD_SCALE, DRAGON_HEAD_SCALE);
        const x = 0, y = 0;
        this._horns(ctx, H.kind, x, y);
        Art.body(ctx, x, y, 13, 11.5, P.body, { lineWidth: 2 });
        // Schnauze mit Nasenlöchern
        const mx = x + lx * 5.5, my = y + 4.6 + ly * 2.4;
        Art.body(ctx, mx, my, 8.4, 6.2, P.light, { lineWidth: 1.6 });
        ctx.fillStyle = Art.ink(P.body);
        ctx.beginPath();
        ctx.ellipse(mx - 2.6 + lx * 1.2, my - 2.2, 1.1, 0.8, 0, 0, TAU);
        ctx.moveTo(mx + 2.6 + lx * 1.2 + 1.1, my - 2.2);
        ctx.ellipse(mx + 2.6 + lx * 1.2, my - 2.2, 1.1, 0.8, 0, 0, TAU);
        ctx.fill();
        // Maul
        const open = dead ? 0.5 : (busy ? (st === 'beam' ? 1 : clamp(k * 1.5, 0, 1)) : roar);
        const ox = mx + lx, oy = my + 3.4;
        if (open > 0.05) {
            ctx.fillStyle = '#4a1030';
            ctx.beginPath();
            ctx.ellipse(ox, oy, 4.3, 0.8 + open * 3, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            const ty = oy - 0.6 - open * 2.2;
            ctx.moveTo(ox - 3, ty);
            ctx.lineTo(ox - 2.1, ty + 1.8);
            ctx.lineTo(ox - 1.2, ty);
            ctx.moveTo(ox + 1.2, ty);
            ctx.lineTo(ox + 2.1, ty + 1.8);
            ctx.lineTo(ox + 3, ty);
            ctx.fill();
            if (ck > 0) {
                Art.glow(ctx, ox, oy, 5 + ck * 8, P.glow, 0.5 + ck * 0.5);
                ctx.fillStyle = P.core;
                ctx.beginPath();
                ctx.ellipse(ox, oy, 1.8 + ck * 1.6, 0.6 + open * 1.6, 0, 0, TAU);
                ctx.fill();
            }
        } else {
            ctx.strokeStyle = Art.ink(P.body);
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(ox, oy - 2.2, 3.4, 0.4, Math.PI - 0.4);
            ctx.stroke();
            if (st === 'weak') {
                // erschöpft: Zunge hängt heraus
                ctx.fillStyle = '#ff6f9c';
                ctx.beginPath();
                ctx.ellipse(ox + 1, oy + 2.4, 1.8, 2.6, 0.2, 0, TAU);
                ctx.fill();
            }
        }
        // Augen (besiegt: Spiralaugen)
        const ex = x + lx * 2, ey = y - 3.6 + ly;
        if (dead) {
            Juri.spiralEye(ctx, ex - 5.2, ey, 3.4, t * 7 + i);
            Juri.spiralEye(ctx, ex + 5.2, ey, 3.4, -t * 7 - i);
        } else {
            Art.eyes(ctx, ex, ey, 3.6, {
                gap: 5.2, look: lk, iris: P.iris, angry: p2 && st !== 'weak', seed: this.seed + i * 1.7,
                open: st === 'weak' ? 0.45 : 1,
            });
        }
        if (i === 1) this._crown(ctx, x, y - 10.5);
        ctx.restore();
    }

    // Hörner: Eiszapfen, geschwungene Feuerhörner oder Kristalle
    _horns(ctx, kind, x, y) {
        if (kind === 'ice') {
            Art.shape(ctx, c => {
                c.moveTo(x - 8, y - 6);
                c.lineTo(x - 14, y - 23);
                c.lineTo(x - 4, y - 9);
                c.closePath();
                c.moveTo(x + 4, y - 9);
                c.lineTo(x + 14, y - 23);
                c.lineTo(x + 8, y - 6);
                c.closePath();
            }, { x: x - 14, y: y - 23, w: 28, h: 17 }, '#e8fbff', { lineWidth: 1.4, outline: '#3a8ac0' });
        } else if (kind === 'fire') {
            Art.shape(ctx, c => {
                c.moveTo(x - 8, y - 7);
                c.quadraticCurveTo(x - 20, y - 12, x - 19, y - 22);
                c.quadraticCurveTo(x - 14, y - 14, x - 3, y - 10);
                c.closePath();
                c.moveTo(x + 3, y - 10);
                c.quadraticCurveTo(x + 14, y - 14, x + 19, y - 22);
                c.quadraticCurveTo(x + 20, y - 12, x + 8, y - 7);
                c.closePath();
            }, { x: x - 20, y: y - 22, w: 40, h: 15 }, '#fff1c9', { lineWidth: 1.4, outline: '#9a3a12' });
        } else {
            Art.shape(ctx, c => {
                c.moveTo(x - 5, y - 8);
                c.lineTo(x - 10, y - 13);
                c.lineTo(x - 12, y - 25);
                c.lineTo(x - 5, y - 15);
                c.closePath();
                c.moveTo(x + 5, y - 15);
                c.lineTo(x + 12, y - 25);
                c.lineTo(x + 10, y - 13);
                c.lineTo(x + 5, y - 8);
                c.closePath();
            }, { x: x - 12, y: y - 25, w: 24, h: 17 }, '#ff9ae0', { lineWidth: 1.4, glossy: true, outline: '#8a2a8a' });
            Art.sparkle(ctx, x + 10, y - 20, 2.4, '#ffffff', 0.5 + 0.5 * Math.sin(Art.time * 4 + this.seed));
        }
    }

    // Hörnerkrone aus Gold mit drei Edelsteinen (Eis, Feuer, Diamant)
    _crown(ctx, x, y) {
        Art.shape(ctx, c => {
            c.moveTo(x - 11, y + 2);
            c.lineTo(x - 12.5, y - 8);
            c.lineTo(x - 6, y - 3);
            c.lineTo(x, y - 11);
            c.lineTo(x + 6, y - 3);
            c.lineTo(x + 12.5, y - 8);
            c.lineTo(x + 11, y + 2);
            c.closePath();
        }, { x: x - 12.5, y: y - 11, w: 25, h: 13 }, DRAGON_GOLD, { lineWidth: 1.6, glossy: true });
        ctx.fillStyle = '#5fc8ff';
        ctx.beginPath();
        ctx.arc(x - 6, y - 0.8, 1.7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff4d3a';
        ctx.beginPath();
        ctx.arc(x, y - 1.6, 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ff7ad8';
        ctx.beginPath();
        ctx.arc(x + 6, y - 0.8, 1.7, 0, TAU);
        ctx.fill();
    }

    // Besiegt: setzt sich benommen hin (Spiralaugen, Sterne, ein Herz steigt auf), dann verwandelt er sich
    // in eine Wolke aus Funkeln. Beim epischen Stillstand bleibt er im ersten Bild (sitzt benommen da).
    _drawDead(ctx) {
        const k = clamp(this.deathProgress(), 0, 1);
        const t = Art.time, a0 = ctx.globalAlpha;
        const s = Math.max(0.05, 1 - k * k * 0.95);
        for (let i = 0; i < 3; i++) {
            const H = DRAGON_HEADS[i], o = this._hd[i];
            o.x = H.x + (i - 1) * 4 + Math.sin(t * 3 + i * 2) * 3;
            o.y = H.y + 16 + Math.cos(t * 3 + i * 2) * 2;
        }
        ctx.save();
        ctx.globalAlpha = a0 * clamp(1.25 - k * 1.2, 0, 1);
        ctx.scale(s, s);
        ctx.translate(0, 8);
        this._tail(ctx, 0, t, true);
        this._wings(ctx, 0, -0.45);
        this._legs(ctx, 0);
        this._torso(ctx, 0, false);
        for (let i = 0; i < 3; i++) this._neck(ctx, i, this._hd[i], 0);
        this._arms(ctx, 0);
        for (let i = 0; i < 3; i++) this._head(ctx, i, this._hd[i], 'dead', 0, false, 0, true);
        ctx.restore();
        // Sterne kreisen über jedem Kopf, ein Herz steigt auf
        for (let i = 0; i < 3; i++) {
            const o = this._hd[i];
            const hx = o.x * s, hy = (o.y + 8 - 22) * s;
            for (let j = 0; j < 2; j++) {
                const a = t * 4.5 + j * Math.PI + i;
                Art.star(ctx, hx + Math.cos(a) * 13 * s, hy + Math.sin(a) * 4 * s, 3 * s + 1.2, '#ffe35a', { lineWidth: 1.1, outline: '#a86a00' });
            }
        }
        const hq = (t * 0.55) % 1;
        ctx.globalAlpha = a0 * (1 - hq) * clamp(1.2 - k, 0, 1);
        Art.heart(ctx, Math.sin(t * 2) * 6 * s, (-128 - hq * 22) * s, (7 + hq * 2) * s, '#ff5d8f');
        ctx.globalAlpha = a0;
        if (k > 0.05) {
            // Wolke aus Funkeln und Sternen
            ctx.globalAlpha = a0 * (1 - k) * 0.8;
            ctx.fillStyle = '#f4efff';
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const a = Math.PI * (1.02 + i * 0.16);
                const d = 20 + k * 50, r = 9 + k * 14;
                const x = Math.cos(a) * d * 1.3, y = -40 + Math.sin(a) * d * 0.8;
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fill();
            ctx.globalAlpha = a0;
            for (let i = 0; i < 6; i++) {
                const a = i * 1.05 + k * 2;
                const col = i % 3 === 0 ? '#7fd8ff' : (i % 3 === 1 ? '#ffb13d' : '#ff8ae0');
                Art.sparkle(ctx, Math.cos(a) * (24 + k * 60), -50 + Math.sin(a) * (20 + k * 44), 5 * (1 - k) + 1.5, col, 1 - k);
            }
        }
        ctx.globalAlpha = a0;
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        ctx.save();
        for (const s of this.shards) this._drawShard(ctx, camera, s);
        if (this.state === 'charge') {
            const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
            const locked = this.stateT <= DRAGON_LOCK;
            for (let i = 0; i < 3; i++) {
                const h = this.heads[i];
                if (!h.on) continue;
                const cfg = DRAGON_BEAMS[DRAGON_HEADS[i].kind];
                const m = this._mouth(i);
                this._drawLane(ctx, camera, m.x, m.y, h.a, h.len, cfg.width, k, cfg.color, locked);
            }
            // Pfeil über dem Ziel (Mark oder ein Freund)
            const tg = this.target;
            if (tg && !tg.dead && !(tg.koTimer > 0)) {
                const ap = camera.worldToScreen(tg.x + tg.w / 2, tg.y - 14 + Math.sin(Art.time * 9) * 2.5);
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
            }
        }
        ctx.restore();
    }

    // Warnband: genau dort, wo der Strahl gleich entlanggeht; füllt sich, blinkt, wenn die Richtung feststeht
    _drawLane(ctx, camera, x0, y0, a, len, w, k, col, locked) {
        if (len < 2) return;
        const t = Art.time;
        const p = camera.worldToScreen(x0, y0);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.13;
        ctx.beginPath();
        ctx.roundRect(0, -w / 2, len, w, w / 2);
        ctx.fill();
        ctx.globalAlpha = 0.12 + 0.24 * k;
        ctx.beginPath();
        ctx.roundRect(0, -w / 2, Math.max(w, len * k), w, w / 2);
        ctx.fill();
        ctx.strokeStyle = '#ff3d5a';
        ctx.lineWidth = 2;
        ctx.globalAlpha = locked ? 0.6 + 0.4 * Math.abs(Math.sin(t * 22)) : 0.35 + 0.3 * Math.abs(Math.sin(t * 9));
        ctx.beginPath();
        ctx.roundRect(0, -w / 2, len, w, w / 2);
        ctx.stroke();
        const s = Math.min(9, w * 0.45);
        const gap = 38;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        for (let x = ((t * 90) % gap) + s; x < len - 4; x += gap) {
            ctx.moveTo(x - s, -s);
            ctx.lineTo(x, 0);
            ctx.lineTo(x - s, s);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Diamant-Kristall am Boden: wächst heraus, pulsiert vor dem Zerplatzen immer schneller
    _drawShard(ctx, camera, s) {
        const p = camera.worldToScreen(s.x, s.y);
        const grow = clamp(s.t / 0.25, 0, 1);
        const left = s.life - s.t;
        const warn = left < 0.55 ? 1 - left / 0.55 : 0;
        const pulse = warn > 0 ? 0.5 + 0.5 * Math.sin(Art.time * (18 + warn * 20)) : 0;
        Art.glow(ctx, p.x, p.y - 4, 10 + warn * 8, '#ff6fd8', 0.35 + 0.4 * pulse);
        ctx.save();
        ctx.translate(p.x, p.y);
        const sc = grow * s.s * (1 + pulse * 0.08);
        ctx.scale(sc, sc);
        DragonArt.crystal(ctx, -5, 1, 3.6, 8, '#c07bff');
        DragonArt.crystal(ctx, 5, 1.5, 3.4, 7, '#ffb8ef');
        DragonArt.crystal(ctx, 0, 0, 5, 12, '#ff8ae0');
        ctx.restore();
        if (warn > 0) Art.ring(ctx, p.x, p.y - 3, 8 + warn * 10, '#ff3d5a', 1.6, 0.4 + 0.5 * pulse);
    }
}
