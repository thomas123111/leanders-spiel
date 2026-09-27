// ── Welt 22: Zombie Academy ──
// Zombie-Schüler: verschlafene, sehr langsame Schulkinder (Wunsch von Leander), die mit ausgestreckten
// Armen auf Mark zuschlurfen. Beim Besiegen verpuffen sie zu Staub, und eine kleine Blume wächst.
// Riesen-Zombie: der Direktor der Akademie mit Doktorhut, Glubschauge, Monokel und Riesen-Holzhammer.
//   Hammer-Schuss: zielt auf Mark ODER auf Juri bzw. das Krokodil (roter Zielkreis unter dem Ziel);
//                  getroffene Begleiter sind ein paar Sekunden betäubt (stun, siehe entities.js).
//   Hammer-Schlag: Schockwelle über den Boden, danach steckt der Hammer kurz fest (Zeit zum Zurückhauen).
//   Schulglocke:   läutet, zwei Schüler krabbeln aus dem Boden (höchstens drei gleichzeitig).
// Phase 2 (halbe Lebenspunkte): rote Augen, Zornesader, schnellere Folge, mehr Hämmer, größere Welle.

const ZOMBIE_SKINS = ['#9fe3a8', '#b8d98c', '#c3ec72', '#8fd0c4', '#a5e8cf'];          // Minze, Salbei, Limette, Graugrün
const ZOMBIE_CLOTHES = ['#ff5d73', '#4d8bff', '#b06bff', '#ff9f1c', '#ffcd3c', '#ff7ab8', '#3cc8d8'];
const ZOMBIE_HAIRS = ['#7a4520', '#3b3470', '#ff8a3c', '#ffd35a', '#8a5cff', '#e04a5a'];
const ZOMBIE_FLOWERS = ['#ff7ab8', '#ffd23f', '#ffffff', '#b58cff', '#ff9f43', '#6fd0ff'];
const ZOMBIE_STEP = 4.4;     // Schlurf-Takt (Bogenmaß pro Sekunde Laufzeit)
const ZOMBIE_RISE = 0.9;     // so lange krabbelt ein gerufener Schüler aus dem Boden (Sekunden)
const ZOMBIE_ALIVE = m => !m.dead;

// Frisuren in Kopf-Koordinaten (+x = Blickrichtung): Startpunkt, dann je Kontroll- und Endpunkt einer Kurve.
const ZOMBIE_HAIRDOS = [
    // wild verstrubbelt
    [-8.4, -1, -10.6, -7.2, -5.6, -7.6, -5.2, -12.8, -1, -9.2, 1.4, -13.8, 3.6, -8.8, 7.6, -11.2, 7.2, -5.6,
        9.2, -4.4, 8.4, -2.4, 3, -6.4, -2, -5, -6, -4.2, -8.4, -1],
    // Wuschelkopf mit Locken
    [-8.8, 0.5, -11, -4, -8, -6.5, -8.5, -10.5, -4.2, -9.4, -2.5, -13, 0.8, -9.8, 3.2, -12.8, 5.6, -8.6,
        9.4, -9.4, 8.8, -4.6, 9.8, -2.2, 7.6, -2.6, 5.5, -5.6, 2.5, -4.6, 0, -6.2, -2.6, -4.8, -5.6, -3.6, -8.8, 0.5],
    // Strubbel mit hoher Tolle
    [-8.5, -1, -12.5, -5.5, -7.5, -6.8, -7, -11, -2.5, -8.6, -1.5, -16.5, 3.2, -9.2, 7.8, -12, 7.6, -6.4,
        10.6, -5.6, 8.6, -2.8, 4.2, -6.2, 0, -5.2, -4.5, -4.8, -8.5, -1],
];

// Gemeinsame Helfer der Welt 22
const ZombieArt = {
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

    // Winkel weich überblenden (kürzester Weg)
    lerpAngle(a, b, k) {
        let d = b - a;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        return a + d * k;
    },

    smooth(k) {
        k = clamp(k, 0, 1);
        return k * k * (3 - 2 * k);
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

    // Kleine Blume, die nach dem Verpuffen eines Zombies aus dem Boden wächst (lebt als Partikel weiter)
    flower(x, y) {
        if (typeof Game !== 'undefined' && Game.particles) Game.particles.push(new ZombieFlower(x, y));
    },

    // Holzhammer: Stiel entlang +x von x0 bis zum Kopf bei x1, Kopf quer dazu (Dicke hw, Länge hl), zwei Metallringe.
    mallet(ctx, x0, x1, hw, hl, lw) {
        Art.limb(ctx, x0, 0, x1 - hw * 0.4, 0, Math.max(1.6, hl * 0.16), '#c98a4b', { lineWidth: lw * 0.8 });
        Art.box(ctx, x1 - hw / 2, -hl / 2, hw, hl, Math.min(hw, hl) * 0.28, '#e8a95e', { lineWidth: lw, highlight: false });
        const bh = hl * 0.12;
        ctx.beginPath();
        ctx.rect(x1 - hw / 2 - lw * 0.3, -hl * 0.34, hw + lw * 0.6, bh);
        ctx.rect(x1 - hw / 2 - lw * 0.3, hl * 0.34 - bh, hw + lw * 0.6, bh);
        ctx.fillStyle = '#b3c2de';
        ctx.fill();
        ctx.strokeStyle = '#4a5578';
        ctx.lineWidth = lw * 0.55;
        ctx.stroke();
        Art.shine(ctx, x1 - hw * 0.18, -hl * 0.04, hw * 0.13, hl * 0.2, 0, 0.35);
    },

    // Wappen der Akademie: goldenes Schild mit „ZA" (als Striche, kein Text – bleibt beim Umdrehen lesbar)
    crest(ctx, x, y) {
        Art.shape(ctx, c => {
            c.moveTo(x - 6.5, y - 7);
            c.lineTo(x + 6.5, y - 7);
            c.lineTo(x + 6.5, y + 1);
            c.quadraticCurveTo(x + 6, y + 6.5, x, y + 8.5);
            c.quadraticCurveTo(x - 6, y + 6.5, x - 6.5, y + 1);
            c.closePath();
        }, { x: x - 6.5, y: y - 7, w: 13, h: 15.5 }, '#ffd23f', { lineWidth: 1.4, glossy: true });
        ctx.strokeStyle = '#5b2a8a';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 3.8);
        ctx.lineTo(x - 1.2, y - 3.8);
        ctx.lineTo(x - 5, y + 2.2);
        ctx.lineTo(x - 1.2, y + 2.2);
        ctx.moveTo(x + 0.6, y + 2.2);
        ctx.lineTo(x + 2.8, y - 3.8);
        ctx.lineTo(x + 5, y + 2.2);
        ctx.moveTo(x + 1.5, y + 0.2);
        ctx.lineTo(x + 4.1, y + 0.2);
        ctx.stroke();
    },

    // Dunkles Erdloch (hinter der Figur)
    hole(ctx, x, y, rx) {
        ctx.fillStyle = '#2a1a2e';
        ctx.beginPath();
        ctx.ellipse(x, y, rx, rx * 0.38, 0, 0, TAU);
        ctx.fill();
    },

    // Vorderer Erdwall mit Krümeln (vor der Figur)
    rim(ctx, x, y, rx) {
        Art.shape(ctx, c => {
            c.moveTo(x - rx - 2, y);
            c.quadraticCurveTo(x, y + rx * 0.75, x + rx + 2, y);
            c.quadraticCurveTo(x, y + rx * 0.3, x - rx - 2, y);
            c.closePath();
        }, { x: x - rx - 2, y, w: rx * 2 + 4, h: rx * 0.6 }, '#a8743f', { lineWidth: 1.1 });
        ctx.fillStyle = '#7a4a26';
        ctx.beginPath();
        ctx.arc(x - rx * 0.95, y - 1.2, 1.4, 0, TAU);
        ctx.moveTo(x + rx * 0.85 + 1.2, y - 0.8);
        ctx.arc(x + rx * 0.85, y - 0.8, 1.2, 0, TAU);
        ctx.fill();
    },
};

// ══════════════════════════════════════════
// ── Zombie-Schüler ──
// ══════════════════════════════════════════

// Grünlicher Schüler in Pulli mit Kragen und Krawatte, Schulranzen oder Buch, verstrubbelte Haare,
// ein großes und ein verschlafenes Auge, Pflaster oder Naht. Schlurft sehr langsam (Schritt – Nachziehen).
// minion = vom Riesen-Zombie gerufen: etwas kleiner, schwächer, krabbelt erst aus dem Boden.
class Zombie extends Enemy {
    constructor(x, y, minion = false) {
        const size = minion ? 20 : 24;
        super(x, y, size, size);
        this.minion = !!minion;
        this.hp = minion ? 4 : 6;
        this.maxHp = this.hp;
        this.speed = minion ? randRange(22, 26) : randRange(18, 24);   // Mark läuft ~150
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = minion ? 600 : 220;
        this.seed = Math.random() * 10;
        this.skin = ZombieArt.pick(ZOMBIE_SKINS);
        this.cloth = ZombieArt.pick(ZOMBIE_CLOTHES);
        do { this.pack = ZombieArt.pick(ZOMBIE_CLOTHES); } while (this.pack === this.cloth);
        this.tie = ['#4d8bff', '#b06bff', '#3cc8d8'].includes(this.cloth) ? '#ff4d5e' : '#4d8bff';
        this.hair = ZombieArt.pick(ZOMBIE_HAIRS);
        this.hairStyle = randInt(0, ZOMBIE_HAIRDOS.length - 1);
        this.gear = Math.random() < 0.65 ? 'pack' : 'book';
        this.mark = Math.random() < 0.5 ? 'plaster' : 'stitch';
        this.headTilt = randRange(-0.14, 0.14);
        this.fxColor = this.skin;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.lookDir = { x: 0, y: 0.3 };
        this.chasing = false;
        this.moving = false;
        this.t = Math.random() * 10;       // eigene Uhr (Stöhnen, Wackeln)
        this.walkT = Math.random() * 3;    // Laufzeit für den Schlurf-Takt
        this.wanderT = randRange(0.3, 2);
        this.wx = 0;
        this.wy = 0;
        this.riseT = 0;                    // > 0: krabbelt gerade aus dem Boden
        this.moundT = 0;                   // Erdhäufchen nach dem Aufkrabbeln
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.moundT > 0) this.moundT -= dt;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;

        if (this.riseT > 0) {
            // krabbelt aus dem Boden: steht still, tut noch niemandem weh
            this.riseT -= dt;
            this.moving = false;
            this.noShadow = true;
            if (Math.abs(dx) > 4) this.face = dx > 0 ? 1 : -1;
            this._look(dx / dist, dy / dist, dt, true);
            if (this.riseT <= 0) {
                this.riseT = 0;
                this.noShadow = false;
                this.contactDamage = true;
                this.moundT = 0.6;
            }
            return;
        }

        // Verfolgen mit Abstands-Puffer (kein Hin- und Herschalten am Rand)
        if (player.dead) this.chasing = false;
        else if (dist < this.detectionRange) this.chasing = true;
        else if (dist > this.detectionRange + 60) this.chasing = false;

        let mx = 0, my = 0, sp = 0;
        if (this.chasing) {
            mx = dx / dist;
            my = dy / dist;
            sp = this.speed;
        } else {
            // Herumtrödeln: mal ein paar Schritte, mal stehen bleiben
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.4, 3.2);
                if (Math.random() < 0.35) {
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
            this.walkT += dt * (this.chasing ? 1 : 0.75);
            // Schlurfen: Schritt – Nachziehen – Schritt (im Mittel genau sp)
            const s = Math.sin(this.walkT * ZOMBIE_STEP);
            const v = sp * (0.45 + 1.1 * s * s);
            const ox = this.x, oy = this.y;
            this._moveWithCollision(mx * v * dt, my * v * dt, world);
            // gegen die Wand getrödelt: neue Richtung suchen
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

    // Blickrichtung sanft nachführen (nur Darstellung)
    _look(nx, ny, dt, full) {
        const k = Math.min(1, dt * 8);
        const tx = full ? nx : nx * 0.6, ty = full ? ny : clamp(ny, -1, 1) * 0.6;
        this.lookDir.x += (tx - this.lookDir.x) * k;
        this.lookDir.y += (ty - this.lookDir.y) * k;
    }

    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, force);
        if (this.dead && !was) ZombieArt.flower(this.centerX(), this.y + this.h - 1);
    }

    // Verpuffen ohne Treffer (wenn der Riesen-Zombie besiegt ist). Keine Blume: während des
    // epischen Stillstands steht der Schüler noch da, eine wachsende Blume daneben wirkt falsch.
    vanish() {
        if (this.dead) return;
        this.hp = 0;
        this.dead = true;
        this.deathTimer = 0.4;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const by = pos.y + this.h;
        const sc = this.minion ? 0.86 : 1;
        ctx.save();
        ctx.translate(cx, by);
        if (this.dead) {
            this._drawDeath(ctx, sc);
            ctx.restore();
            return;
        }
        if (this.riseT > 0) {
            // krabbelt aus dem Erdloch: nur der Teil über dem Boden ist zu sehen
            const k = clamp(1 - this.riseT / ZOMBIE_RISE, 0, 1);
            const e = 1 - (1 - k) * (1 - k);
            ZombieArt.hole(ctx, 0, -1, 11 * sc);
            ctx.save();
            ctx.beginPath();
            ctx.rect(-26, -50, 52, 49.5);
            ctx.clip();
            ctx.translate(Math.sin(this.t * 22) * 1.3 * (1 - k), (1 - e) * 32 * sc);
            ctx.scale(sc, sc);
            this._drawBody(ctx, true, false);
            ctx.restore();
            ZombieArt.rim(ctx, 0, -1, 11 * sc);
        } else {
            ctx.save();
            ctx.scale(sc, sc);
            this._drawBody(ctx, false, false);
            ctx.restore();
            if (this.moundT > 0) {
                const a0 = ctx.globalAlpha;
                ctx.globalAlpha = a0 * clamp(this.moundT / 0.6, 0, 1);
                ZombieArt.rim(ctx, 0, -0.5, 10 * sc);
                ctx.globalAlpha = a0;
            }
        }
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 16 * sc);
    }

    // Figur mit Füßen bei (0, 0). still = kein Laufen (Aufkrabbeln), dead = Kreuzaugen.
    _drawBody(ctx, still, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const mv = this.moving && !still;
        const ph = this.walkT * ZOMBIE_STEP;
        const step = mv ? Math.sin(ph) : 0;
        const bob = mv ? -Math.abs(step) * 1.4 : Math.sin(t * 2.1 + sd) * 0.45;
        const lean = f * (mv ? 0.07 + step * 0.06 : 0.03 + Math.sin(t * 1.3 + sd) * 0.025);
        const skin = this.skin, cloth = this.cloth;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -15, 26, '#ffd23f', 0.42 + 0.12 * Math.sin(t * 3 + sd));
        // Schuhe (bleiben am Boden)
        const l0 = mv ? Math.max(0, step) * 2.2 : 0;
        const l1 = mv ? Math.max(0, -step) * 2.2 : 0;
        ctx.beginPath();
        ctx.ellipse(-4 + f * 1.4, -1.8 - l0, 3.7, 2.1, 0, 0, TAU);
        ctx.moveTo(4 + f * 1.4 + 3.7, -1.8 - l1);
        ctx.ellipse(4 + f * 1.4, -1.8 - l1, 3.7, 2.1, 0, 0, TAU);
        ctx.fillStyle = '#4b3b78';
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = '#231a40';
        ctx.stroke();
        // Ab hier schwankt der Körper beim Schlurfen (Drehpunkt an den Füßen)
        ctx.save();
        ctx.rotate(lean);
        const y0 = bob;
        // Schulranzen auf dem Rücken
        if (this.gear === 'pack') {
            const px = -f * 8.2;
            Art.box(ctx, px - 4, -17.5 + y0, 8, 10.5, 2.8, this.pack, { lineWidth: 1.2, highlight: false });
            ctx.strokeStyle = Art.ink(this.pack);
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(px - 4, -13.8 + y0);
            ctx.lineTo(px + 4, -13.8 + y0);
            ctx.stroke();
        }
        // Arme weit nach vorn gestreckt, schlenkern leicht (hinterer Arm zuerst)
        const reach = this.chasing ? 1 : 0.6;
        const ly = clamp(this.lookDir.y, -1, 1) * 1.8;
        const s1 = Math.sin(t * 3.1 + sd) * 1.3;
        const s2 = Math.sin(t * 3.1 + sd + 1.8) * 1.3;
        const bx = f * (9 + 3 * reach), bhy = -16.2 + y0 + s2 + ly;
        Art.limb(ctx, -f * 1.2, -13.6 + y0, bx, bhy, 3.1, Art.dark(cloth, 0.14), { lineWidth: 1 });
        LateWorldArt.blob(ctx, bx + f * 0.9, bhy, 2, 1.7, Art.dark(skin, 0.1), 1);
        // Pulli
        Art.body(ctx, 0, -9.6 + y0, 7.4, 6.6, cloth, { lineWidth: 1.4 });
        // Hemdkragen und Krawatte
        const nx = f * 1.2, ny = -15.3 + y0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(nx - 3.3, ny);
        ctx.lineTo(nx, ny + 3.4);
        ctx.lineTo(nx + 3.3, ny);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = this.tie;
        ctx.beginPath();
        ctx.moveTo(nx - 1, ny + 0.6);
        ctx.lineTo(nx + 1, ny + 0.6);
        ctx.lineTo(nx + 1.4, ny + 5.4);
        ctx.lineTo(nx, ny + 6.8);
        ctx.lineTo(nx - 1.4, ny + 5.4);
        ctx.closePath();
        ctx.fill();
        // Buch unter den Arm geklemmt
        if (this.gear === 'book') {
            ctx.save();
            ctx.translate(-f * 4.8, -9.2 + y0);
            ctx.rotate(-0.35 * f);
            Art.box(ctx, -2.9, -3.6, 5.8, 7.2, 1.1, this.pack, { lineWidth: 1, highlight: false });
            ctx.fillStyle = '#fff6dc';
            ctx.fillRect(f > 0 ? -2.3 : 1.3, -3, 1, 6);
            ctx.restore();
        }
        // Schlüsselträger: goldener Schlüssel am roten Band
        if (key) {
            ctx.strokeStyle = '#ff4d5e';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(nx - 3.1, ny + 0.2);
            ctx.lineTo(nx + f * 0.6, ny + 6.6);
            ctx.lineTo(nx + 3.1, ny + 0.2);
            ctx.stroke();
            ctx.save();
            ctx.translate(nx + f * 0.6, ny + 7);
            ctx.rotate(Math.PI / 2 + Math.sin(t * 3 + sd) * 0.2);
            Art.key(ctx, 1.4, 0, 3, '#ffd23f');
            ctx.restore();
        }
        // vorderer Arm
        const fx = f * (10.5 + 3 * reach), fy = -13.4 + y0 + s1 + ly;
        Art.limb(ctx, f * 3.6, -12.8 + y0, fx, fy, 3.1, cloth, { lineWidth: 1 });
        LateWorldArt.blob(ctx, fx + f * 0.9, fy, 2.1, 1.8, skin, 1);
        // Kopf (schief)
        ctx.translate(f * 1.3, -21.8 + y0);
        ctx.rotate(this.headTilt * f + (mv ? step * 0.05 : 0));
        this._drawHead(ctx, f, dead);
        ctx.restore();
    }

    // Kopf um (0, 0): Frisur, großes + verschlafenes Auge, Mund, Pflaster/Naht, eine rosa Wange
    _drawHead(ctx, f, dead) {
        const skin = this.skin;
        Art.body(ctx, 0, 0, 8.6, 8, skin, { lineWidth: 1.4 });
        const h = ZOMBIE_HAIRDOS[this.hairStyle];
        Art.shape(ctx, c => {
            c.moveTo(h[0] * f, h[1]);
            for (let i = 2; i < h.length; i += 4) c.quadraticCurveTo(h[i] * f, h[i + 1], h[i + 2] * f, h[i + 3]);
            c.closePath();
        }, { x: -10.5, y: -14, w: 21, h: 15 }, this.hair, { lineWidth: 1.2 });
        // Pflaster oder Naht auf der hinteren Wange
        if (this.mark === 'plaster') {
            ctx.save();
            ctx.translate(-f * 5.3, 3.4);
            ctx.rotate(-0.55 * f);
            ctx.fillStyle = '#ffd9b0';
            ctx.beginPath();
            ctx.roundRect(-2.7, -1.05, 5.4, 2.1, 1);
            ctx.fill();
            ctx.strokeStyle = '#c98a5a';
            ctx.lineWidth = 0.6;
            ctx.stroke();
            ctx.fillStyle = '#e8b78a';
            ctx.fillRect(-0.9, -0.7, 1.8, 1.4);
            ctx.restore();
        } else {
            ctx.strokeStyle = Art.ink(skin);
            ctx.lineWidth = 0.75;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-f * 6.4, 1.2);
            ctx.lineTo(-f * 4.6, 5.6);
            for (let i = 0; i < 3; i++) {
                const q = 0.2 + i * 0.3;
                const x = -f * (6.4 - 1.8 * q), y = 1.2 + 4.4 * q;
                ctx.moveTo(x - 1.1, y - 0.3);
                ctx.lineTo(x + 1.1, y + 0.3);
            }
            ctx.stroke();
        }
        // Augen: vorn groß und wach, hinten schwer verschlafen
        const ex = f * 3.5, ey = -0.6, sx = -f * 2.9, sy = -0.2;
        if (dead) {
            LateWorldArt.xEyes(ctx, f * 0.3, -0.4, 1.7, 3.2);
        } else {
            const look = this.lookDir;
            Art.eye(ctx, ex, ey, 3.3, look, { open: Art.blink(this.seed) });
            Art.eye(ctx, sx, sy, 2.7, look, {});
            ctx.fillStyle = Art.dark(skin, 0.12);
            ctx.beginPath();
            ctx.ellipse(sx, sy, 3.25, 3.35, -0.14 * f, Math.PI, TAU);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = Art.ink(skin);
            ctx.lineWidth = 0.9;
            ctx.stroke();
        }
        // Mund: beim Verfolgen ab und zu ein langgezogenes „Uuuh"
        const mx = f * 1.3, my = 4.5;
        const g = this.chasing && !dead ? clamp(Math.sin(this.t * 2.4 + this.seed) * 2 - 0.3, 0, 1) : 0;
        if (dead || g > 0.05) {
            ctx.fillStyle = '#4a1030';
            ctx.beginPath();
            ctx.ellipse(mx, my + 0.4, 1.6 + g * 0.4, dead ? 1.3 : 0.8 + g * 1.6, 0, 0, TAU);
            ctx.fill();
        } else {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(mx - f * 2.6, my - 0.4);
            ctx.quadraticCurveTo(mx, my + 1.5, mx + f * 2.8, my - 0.3);
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(mx + f * 0.8 - 0.65, my + 0.35, 1.3, 1.4);
        }
        // rosa Wange vorn
        ctx.fillStyle = 'rgba(255,122,168,0.45)';
        ctx.beginPath();
        ctx.ellipse(f * 5.9, 2.8, 1.5, 0.95, 0, 0, TAU);
        ctx.fill();
    }

    // Tod (0,4 s): sackt zusammen und verpufft zu einer Staubwolke (die Blume wächst als Partikel)
    _drawDeath(ctx, sc) {
        const k = clamp(this.deathProgress(), 0, 1);
        const a0 = ctx.globalAlpha;
        // (noch im Erdloch besiegt: nur die Staubwolke)
        if (k < 0.62 && this.riseT <= 0) {
            const q = k / 0.62;
            ctx.save();
            ctx.globalAlpha = a0 * (1 - q * 0.75);
            ctx.scale(sc * (1 + q * 0.5), sc * (1 - q * 0.82));
            this._drawBody(ctx, true, true);
            ctx.restore();
        }
        ctx.globalAlpha = a0 * (1 - k) * 0.9;
        ctx.fillStyle = '#f1ecff';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = Math.PI * (1.05 + i * 0.225);
            const d = (5 + k * 11) * sc;
            const r = (2.6 + k * 4) * sc;
            const x = Math.cos(a) * d * 1.35, y = -4 + Math.sin(a) * d * 0.75;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
        ctx.globalAlpha = a0;
    }
}

// Blume, die aus dem Staub eines besiegten Zombies wächst (Partikel in Game.particles, ~1,5 s).
class ZombieFlower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.age = 0;
        this.life = 1.5;
        this.dead = false;
        this.color = ZombieArt.pick(ZOMBIE_FLOWERS);
        this.seed = Math.random() * 10;
    }

    update(dt) {
        this.age += dt;
        if (this.age >= this.life) this.dead = true;
    }

    draw(ctx, camera) {
        const a = this.age - 0.12;            // wächst kurz nach dem Staub
        if (a <= 0) return;
        const g = Math.min(1, a / 0.25);
        const pop = g < 1 ? g + Math.sin(g * Math.PI) * 0.35 : 1;
        const out = clamp((this.life - this.age) / 0.3, 0, 1);
        const s = pop * out;
        if (s < 0.03) return;
        const p = camera.worldToScreen(this.x, this.y);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(s, s);
        ctx.rotate(Math.sin(Art.time * 3 + this.seed) * 0.14);
        Art.limb(ctx, 0, 0, 0, -8.5, 1.3, '#4fbf3a', { lineWidth: 0.8, outline: '#1f6a2a' });
        ctx.fillStyle = '#5fd04a';
        ctx.beginPath();
        ctx.ellipse(2.3, -3.6, 2.4, 1.1, -0.5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const ang = (i * TAU) / 5 - Math.PI / 2;
            const px = Math.cos(ang) * 2.4, py = -10 + Math.sin(ang) * 2.4;
            ctx.moveTo(px + 2.1, py);
            ctx.arc(px, py, 2.1, 0, TAU);
        }
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = Art.ink(this.color);
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.fillStyle = this.color === '#ffd23f' ? '#ff9f43' : '#ffd23f';
        ctx.beginPath();
        ctx.arc(0, -10, 1.6, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Hammer-Geschoss des Riesen-Zombies ──
// ══════════════════════════════════════════

// Fliegender Mini-Hammer (big = großer, langsamer Hammerkopf). Trifft auch Begleiter (hitsCompanions):
// die sind dann stunTime Sekunden betäubt. Mark bekommt 1 (groß: 2) Schaden.
class HammerShot extends Projectile {
    constructor(x, y, angle, speed, big) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, big ? 2 : 1, 'enemy', big ? 120 : 70);
        this.big = !!big;
        this.radius = big ? 11 : 6;
        this.lifetime = big ? 3.6 : 3;
        this.hitsCompanions = true;
        this.stunTime = 3;
        this.spin = Math.cos(angle) >= 0 ? 1 : -1;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const big = this.big;
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        // Schweif
        const prev = ctx.globalAlpha;
        const w = big ? 9 : 4.5, len = big ? 30 : 18;
        ctx.globalAlpha = prev * 0.35;
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.moveTo(p.x - dy * w, p.y + dx * w);
        ctx.lineTo(p.x - dx * len, p.y - dy * len);
        ctx.lineTo(p.x + dy * w, p.y - dx * w);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev;
        Art.glow(ctx, p.x, p.y, big ? 27 : 15, '#ffb13d', big ? 0.75 : 0.62);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.age * (big ? 7 : 13) * this.spin);
        if (big) ZombieArt.mallet(ctx, -14, 8, 13, 23, 1.8);
        else ZombieArt.mallet(ctx, -7, 4, 6.5, 11.5, 1.1);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 22: Riesen-Zombie ──
// ══════════════════════════════════════════

// Direktor der Zombie Academy: riesiger grüner Kopf mit Doktorhut, ein Glubschauge und ein kleines Auge
// mit Monokel, Unterbiss mit stumpfen Zähnen, geflickter Pullunder mit Wappen „ZA", genähte Arme,
// Riesen-Holzhammer vorn und Schulglocke hinten. Hitbox 64×64, Zeichnung ~110 hoch.
// Ablauf: Intro → Laufen → Angriff (Schuss, Schlag, Schuss, Glocke, …) → Laufen …
class BossGiantZombie extends Enemy {
    constructor(x, y) {
        super(x, y, 64, 64);
        this.hp = 95;
        this.maxHp = 95;
        this.speed = 35;
        this.damage = 1;
        this.contactDamage = true;
        this.isBoss = true;
        this.fxColor = '#8ee86a';
        this.shadow = { rx: 38, ry: 12 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.face = -1;
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;             // Stelle in BossGiantZombie.ORDER
        this.shotNo = 0;          // wechselt Fächer / großer Hammerkopf
        this.pattern = 'fan';
        this.target = null;       // Ziel des Hammer-Schusses: Mark oder ein Begleiter
        this.aimA = Math.PI / 2;
        this.aimTX = 0;
        this.aimTY = 0;
        this.slamDX = 54;         // Aufschlagpunkt vor dem Riesen (waagrecht, in Blickrichtung)
        this.waveOn = false;
        this.waveX = 0;
        this.waveY = 0;
        this.waveR = 0;
        this.waveMax = 140;
        this.waveHit = false;
        this.spots = [];          // wo die gerufenen Schüler herauskrabbeln
        this.minions = [];
        this._pz = {};            // Haltung (nur Zeichnen)
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Ein Riese lässt sich kaum wegschubsen. Besiegt: die gerufenen Schüler verpuffen mit.
    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.25);
        if (this.dead && !was) {
            this.waveOn = false;
            for (const m of this.minions) m.vanish();
        }
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        if (this.minions.length) compactInPlace(this.minions, ZOMBIE_ALIVE);
        this._updateWave(dt, player);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        // Blick: beim Zielen aufs Ziel, sonst auf Mark
        const aiming = this.state === 'aim';
        this._lookAt((aiming ? this.aimTX : px) - this.centerX(), (aiming ? this.aimTY : py) - (this.centerY() - 42), dt);

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0.5);
                break;
            case 'walk':
                this._walk(dt, world, px, py);
                if (this.stateT <= 0) this._nextAttack(world, player);
                break;
            case 'aim':
                this._aim(false);
                if (this.stateT <= 0) this._fire(projectiles, world);
                break;
            case 'raise':
                if (this.stateT <= 0) this._set('swing', 0.13);
                break;
            case 'swing':
                if (this.stateT <= 0) this._slam(player);
                break;
            case 'bell':
                if (this.stateT <= 0) {
                    this._ring(enemies);
                    this._set('recover', 0.45);
                }
                break;
            default:            // fire, stuck, recover, roar
                if (this.stateT <= 0) this._toWalk();
        }
    }

    _lookAt(dx, dy, dt) {
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    _toWalk() {
        if (this.phase === 2 && !this.roared) {
            // Wut-Gebrüll beim Wechsel in Phase 2 (kein Angriff, nicht unverwundbar)
            this.roared = true;
            this._set('roar', 0.9);
            const hx = this.centerX() + this.face * 3, hy = this.y + this.h - 74;
            ZombieArt.shake(6, 0.45);
            ZombieArt.burst(hx, hy, ['#ff4d6d', '#ffffff', '#ffd23f'], 14, 170, 0.55, { kind: 'star' });
            ZombieArt.ring(hx, hy + 30, '#ff4d6d', 90, 0.45, 5);
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.75, 1.05) : randRange(1.15, 1.55));
    }

    // Schlurft auf Mark zu (mit Wandkollision), bleibt in Hammer-Nähe stehen
    _walk(dt, world, px, py) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) > 16) this.face = dx > 0 ? 1 : -1;
        if (d < 84) return;
        this.walkT += dt;
        const s = Math.sin(this.walkT * 3.4);
        const v = this.speed * (0.55 + 0.9 * s * s);
        this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
        this.moving = true;
    }

    _nextAttack(world, player) {
        const order = BossGiantZombie.ORDER;
        let a = order[this.seq % order.length];
        this.seq++;
        if (a === 'bell' && !this._startBell(world, player)) a = 'shot';
        if (a === 'shot') this._startAim(world, player);
        else if (a === 'slam') this._startSlam(world, player);
    }

    // ── a) Hammer-Schuss: Ziel auswürfeln (Mark oder ein Begleiter), zielen, feuern ──

    _startAim(world, player) {
        this.target = this._pickTarget(world, player);
        this.pattern = this.shotNo++ % 2 === 0 ? 'fan' : 'big';
        this._set('aim', this.phase === 2 ? 0.75 : 1.0);
        this._aim(true);
    }

    // Mark oder ein Begleiter, der betäubt werden kann (Juri, Krokodil – nicht die Schlange auf der Schulter),
    // wach ist und vom Riesen gesehen wird.
    _pickTarget(world, player) {
        const list = [player];
        const comps = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        const mx = this.centerX(), my = this.centerY() - 18;
        for (const c of comps) {
            if (!c || c.dead || typeof c.stun !== 'function' || c.stunTimer > 0) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - mx, cy - my) > 380) continue;
            if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my, cx, cy)) continue;
            list.push(c);
        }
        return list[Math.floor(Math.random() * list.length)];
    }

    // Richtung zum Ziel nachführen; die letzten 0,3 s steht sie fest (fair zum Ausweichen)
    _aim(force) {
        if (!force && this.stateT <= 0.3) return;
        const tg = this.target;
        if (!tg || tg.dead) return;
        const tx = tg.x + tg.w / 2, ty = tg.y + tg.h / 2;
        if (Math.abs(tx - this.centerX()) > 12) this.face = tx > this.centerX() ? 1 : -1;
        const sx = this.centerX() + this.face * 19, sy = this.y + this.h - 50;
        this.aimA = Math.atan2(ty - sy, tx - sx);
        this.aimTX = tx;
        this.aimTY = ty;
    }

    _fire(projectiles, world) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const a = this.aimA;
        const sx = this.centerX() + this.face * 19, sy = this.y + this.h - 50;
        // aus dem Hammerkopf – bei sehr nahem Ziel etwas davor, damit der Hammer nicht über das Ziel hinaus schießt;
        // steht der Riese an einer Wand, nicht in der Wand starten (sonst wäre der Schuss sofort weg)
        let reach = clamp(Math.hypot(this.aimTX - sx, this.aimTY - sy) - 16, 18, 60);
        while (reach > 10 && world && world.isWall && world.isWall(sx + Math.cos(a) * reach, sy + Math.sin(a) * reach)) reach -= 6;
        const x = sx + Math.cos(a) * reach, y = sy + Math.sin(a) * reach;
        const p2 = this.phase === 2;
        if (list) {
            if (this.pattern === 'big') {
                list.push(new HammerShot(x, y, a, 108, true));
                if (p2) {
                    list.push(new HammerShot(x, y, a - 0.4, 150, false));
                    list.push(new HammerShot(x, y, a + 0.4, 150, false));
                }
            } else {
                const n = p2 ? 5 : 3;
                const spread = p2 ? 0.19 : 0.24;
                for (let i = 0; i < n; i++) list.push(new HammerShot(x, y, a + (i - (n - 1) / 2) * spread, 150, false));
            }
        }
        ZombieArt.burst(x, y, ['#ffd23f', '#ffffff', '#ff9f43'], 10, 150, 0.35, { kind: 'star' });
        ZombieArt.shake(this.pattern === 'big' ? 4 : 2.5, 0.14);
        this._set('fire', 0.45);
    }

    // ── b) Hammer-Schlag mit Schockwelle ──

    _startSlam(world, player) {
        const px = player.x + player.w / 2;
        if (Math.abs(px - this.centerX()) > 8) this.face = px > this.centerX() ? 1 : -1;
        const gy = this.y + this.h - 8;
        let dxs = 54;
        // Aufschlagpunkt nicht in eine Wand legen
        while (dxs > 28 && world && world.isWall && world.isWall(this.centerX() + this.face * dxs, gy)) dxs -= 6;
        this.slamDX = dxs;
        this._set('raise', this.phase === 2 ? 0.8 : 1.05);
    }

    _slam(player) {
        const x = this.centerX() + this.face * this.slamDX, y = this.y + this.h - 8;
        this.waveX = x;
        this.waveY = y;
        this.waveR = 16;
        this.waveMax = this.phase === 2 ? 175 : 140;
        this.waveOn = true;
        this.waveHit = false;
        // direkt unter dem Hammer
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - x, py - y) < 36) {
                this.waveHit = true;
                ZombieArt.hurt(player, 1, Math.atan2(py - y, px - x), 190);
            }
        }
        ZombieArt.shake(this.phase === 2 ? 8 : 6.5, 0.35);
        ZombieArt.burst(x, y, ['#f3e6c8', '#d6c29a', '#ffffff'], 12, 150, 0.55, { kind: 'smoke', size: 5 });
        ZombieArt.burst(x, y, ['#ffd23f', '#ffffff'], 8, 200, 0.45, { kind: 'star' });
        ZombieArt.ring(x, y, '#fff3c4', 46, 0.3, 5);
        // danach steckt der Hammer kurz im Boden fest: Zeit zum Zurückhauen
        this._set('stuck', this.phase === 2 ? 1.0 : 1.2);
    }

    // Die Welle läuft über den Boden; Mark wird höchstens einmal pro Welle getroffen.
    _updateWave(dt, player) {
        if (!this.waveOn) return;
        this.waveR += 150 * dt;
        if (!this.waveHit && player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            const d = Math.hypot(px - this.waveX, py - this.waveY);
            if (Math.abs(d - this.waveR) < 13) {
                this.waveHit = true;
                ZombieArt.hurt(player, 1, Math.atan2(py - this.waveY, px - this.waveX), 150);
            }
        }
        if (this.waveR >= this.waveMax) this.waveOn = false;
    }

    // ── c) Schulglocke: zwei Schüler krabbeln aus dem Boden (höchstens drei gleichzeitig) ──

    _startBell(world, player) {
        const free = 3 - this.minions.length;
        if (free <= 0) return false;
        this.spots = this._pickSpots(world, player, Math.min(2, free));
        if (!this.spots.length) return false;
        const px = player.x + player.w / 2;
        if (Math.abs(px - this.centerX()) > 8) this.face = px > this.centerX() ? 1 : -1;
        this._set('bell', this.phase === 2 ? 0.85 : 1.1);
        return true;
    }

    // Freie Stellen im Boss-Raum, nicht direkt neben Mark, in Sichtweite des Riesen (also im selben Raum)
    _pickSpots(world, player, n) {
        const out = [];
        const room = typeof Game !== 'undefined' && Game.bossActive && typeof Game._bossRoomRect === 'function' && Game.world
            ? Game._bossRoomRect() : null;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        for (let i = 0; i < 40 && out.length < n; i++) {
            const a = Math.random() * TAU, d = randRange(60, 130);
            const x = mx + Math.cos(a) * d, y = my + Math.sin(a) * d;
            if (room && (x < room.x + 16 || x > room.x + room.w - 16 || y < room.y + 16 || y > room.y + room.h - 16)) continue;
            if (!LateWorldArt.free(world, x - 10, y - 10, 20, 20)) continue;
            if (Math.hypot(x - px, y - py) < 60) continue;
            if (out.some(s => Math.hypot(s.x - x, s.y - y) < 40)) continue;
            if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my, x, y)) continue;
            out.push({ x, y });
        }
        return out;
    }

    _ring(enemies) {
        for (const s of this.spots) {
            const m = new Zombie(s.x, s.y, true);
            m.riseT = ZOMBIE_RISE;
            m.contactDamage = false;
            m.noShadow = true;
            if (enemies) enemies.push(m);
            this.minions.push(m);
            ZombieArt.burst(s.x, s.y + 9, ['#a8743f', '#c9a06a', '#6b4a2a'], 8, 90, 0.45, { gravity: 220 });
        }
        this.spots = [];
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

    // Haltung aus dem Zustand (nur Darstellung, ändert keine Spiellogik): Hand (hx, hy), Stielwinkel ha
    // und -länge hl des Hammers, Glocke (bx, by, ba), Rumpf (bob, step, lean), Mund (0..1), Leuchten.
    _pose(p) {
        const f = this.face, st = this.state, t = Art.time;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const ph = this.walkT * 3.4;
        p.step = this.moving ? Math.sin(ph) : 0;
        p.bob = this.moving ? -Math.abs(p.step) * 2.6 : Math.sin(t * 1.9 + this.seed) * 1.1;
        p.lean = this.moving ? f * (0.03 + p.step * 0.025) : 0;
        p.tilt = 0;
        p.mouth = 0;
        p.glow = 0;
        p.glowCol = '#ffb13d';
        p.stuck = false;
        // Grundhaltung: Hammer aufrecht vor dem Bauch, Glocke hängt in der hinteren Hand
        p.hx = f * 37;
        p.hy = -24 + p.bob * 0.5;
        p.ha = -Math.PI / 2 + f * 0.2;
        p.hl = 38;
        p.bx = -f * 29;
        p.by = -30 + p.bob;
        p.bUp = false;
        p.ba = Math.sin(t * 2.2 + this.seed) * 0.12;
        const sx = f * 19, sy = -50 + p.bob;
        if (st === 'intro') {
            // klopft sich ungeduldig den Hammer in die Hand
            const tap = Math.max(0, Math.sin(t * 5));
            p.ha -= f * tap * 0.3;
            p.hy -= tap * 3;
        } else if (st === 'aim') {
            const a = this.aimA;
            const ext = 21 - k * 5;                 // holt beim Aufladen etwas aus
            p.hx = sx + Math.cos(a) * ext;
            p.hy = sy + Math.sin(a) * ext;
            p.ha = a;
            p.glow = k;
            p.mouth = 0.15 + 0.2 * k;
        } else if (st === 'fire') {
            // Rückstoß, dann zurück in die Grundhaltung
            const a = this.aimA;
            const kick = k < 0.3 ? Math.sin((k / 0.3) * Math.PI) : 0;
            const aa = a - f * kick * 0.45;
            const ext = 21 - kick * 7;
            const e = ZombieArt.smooth((k - 0.3) / 0.7);
            p.hx = lerp(sx + Math.cos(aa) * ext, p.hx, e);
            p.hy = lerp(sy + Math.sin(aa) * ext, p.hy, e);
            p.ha = ZombieArt.lerpAngle(aa, p.ha, e);
            p.glow = Math.max(0, 1 - k * 4);
            p.mouth = 0.7 * (1 - e);
        } else if (st === 'raise' || st === 'swing' || st === 'stuck') {
            const rx = f * 27, ry = -80 + p.bob, ra = -Math.PI / 2 + f * 0.15;   // hoch über dem Kopf
            const ix = f * this.slamDX, iy = -8;                                  // Aufschlagpunkt
            const ia = Math.PI / 2 - f * 0.9;
            const ihx = ix - Math.cos(ia) * 38, ihy = iy - Math.sin(ia) * 38;
            p.glowCol = '#ff7a3d';
            if (st === 'raise') {
                const e = ZombieArt.smooth(k / 0.35);
                const shiver = k > 0.35 ? Math.sin(t * 38) * 0.035 : 0;
                p.hx = lerp(p.hx, rx, e);
                p.hy = lerp(p.hy, ry, e);
                p.ha = ZombieArt.lerpAngle(p.ha, ra, e) + shiver;
                p.glow = k * 0.9;
                p.lean = -f * 0.05 * e;
                p.tilt = -f * 0.06 * e;
            } else if (st === 'swing') {
                const e = k * k;
                p.hx = lerp(rx, ihx, e);
                p.hy = lerp(ry, ihy, e);
                p.ha = ZombieArt.lerpAngle(ra, ia, e);
                p.glow = 0.9;
                p.lean = f * 0.06 * e;
                p.mouth = 1;
            } else {
                // Hammer steckt fest: zerrt am Stiel, der Kopf bleibt im Boden
                const tug = Math.sin(t * 12);
                p.hx = ihx - f * Math.max(0, tug) * 3.5;
                p.hy = ihy - Math.abs(tug) * 1.5;
                p.ha = Math.atan2(iy - p.hy, ix - p.hx);
                p.hl = Math.hypot(ix - p.hx, iy - p.hy);
                p.lean = -f * (0.02 + Math.max(0, tug) * 0.04);
                p.stuck = true;
            }
        } else if (st === 'bell') {
            p.bUp = true;
            p.bx = -f * 36;
            p.by = -84 + p.bob;
            p.ba = Math.sin(t * 17) * 0.55;
            p.mouth = 0.45 + 0.5 * Math.abs(Math.sin(t * 8.5));   // ruft „Pause vorbei!"
        } else if (st === 'roar') {
            const r = Math.sin(k * Math.PI);
            p.mouth = r;
            p.tilt = -f * 0.12 * r;
            p.ha -= f * 0.25 * r;
            p.hy -= 6 * r;
        }
        this._shoulders(p, f, sx, sy);
        return p;
    }

    // Schulterpunkte, mitgedreht mit der Rumpf-Neigung (Arme bleiben so am Körper)
    _shoulders(p, f, sx, sy) {
        const c = Math.cos(p.lean), s = Math.sin(p.lean);
        p.sfx = sx * c - sy * s;
        p.sfy = sx * s + sy * c;
        const bx = -sx, by = sy + 1;
        p.sbx = bx * c - by * s;
        p.sby = bx * s + by * c;
    }

    _drawAlive(ctx) {
        const p = this._pose(this._pz);
        const f = this.face;
        const t = Art.time;
        const p2 = this.phase === 2;
        this._backArm(ctx, f, p);
        this._legs(ctx, f, p);
        ctx.save();
        ctx.rotate(p.lean);
        this._torso(ctx, f, p, p2);
        this._head(ctx, f, p, p2, false);
        ctx.restore();
        if (p.bUp) this._bellRing(ctx, p);
        this._frontArm(ctx, f, p);
        this._hammer(ctx, p);
        Art.body(ctx, p.hx, p.hy, 6.6, 6, '#9edc7c', { lineWidth: 2 });   // Faust um den Stiel
        if (p.stuck) {
            // Schweißtropfen und Staub, während er am Hammer zerrt
            for (let i = 0; i < 2; i++) {
                const q = (t * 1.7 + i * 0.5) % 1;
                const side = i ? f : -f;
                const x = f * 3 + side * (22 + q * 12), y = -92 + q * 20 + p.bob;
                Art.body(ctx, x, y, 2.1, 3, '#9fe0ff', { lineWidth: 1, outline: '#2a6f9e', highlight: false });
            }
            const ix = f * this.slamDX;
            Art.sparkle(ctx, ix - 13, -6 + Math.sin(t * 9) * 2, 3.2, '#fff6c8', 0.8);
            Art.sparkle(ctx, ix + 12, -10 + Math.cos(t * 7) * 2, 2.6, '#fff6c8', 0.7);
        }
    }

    _legs(ctx, f, p) {
        const l0 = Math.max(0, p.step) * 5, l1 = Math.max(0, -p.step) * 5;
        this._leg(ctx, -f * 13, l0, f);
        this._leg(ctx, f * 13, l1, f);
    }

    _leg(ctx, x, lift, f) {
        Art.box(ctx, x - 8.5, -25 - lift, 17, 18, 6, '#4a5aa8', { lineWidth: 2, highlight: false });
        Art.body(ctx, x + f * 3.5, -5.5 - lift, 12.5, 6, '#7a4a2a', { lineWidth: 2 });
    }

    // Pullunder mit V-Ausschnitt, Krawatte, Knöpfen, Wappen „ZA" und Flicken
    _torso(ctx, f, p, p2) {
        const y = -36 + p.bob;
        const VEST = '#8a5cd6';
        Art.body(ctx, 0, y, 28.5, 25.5, VEST, { lineWidth: 2.4 });
        const nx = -f * 3;
        ctx.fillStyle = '#f4f0ff';
        ctx.beginPath();
        ctx.moveTo(nx - 12, y - 25);
        ctx.lineTo(nx, y - 5);
        ctx.lineTo(nx + 12, y - 25);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = Art.ink(VEST);
        ctx.lineWidth = 1.8;
        ctx.stroke();
        // Krawatte, rot-gelb gestreift
        ctx.fillStyle = '#ff4d5e';
        ctx.beginPath();
        ctx.moveTo(nx - 2.4, y - 21);
        ctx.lineTo(nx + 2.4, y - 21);
        ctx.lineTo(nx + 3.4, y - 9);
        ctx.lineTo(nx, y - 5.5);
        ctx.lineTo(nx - 3.4, y - 9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(nx - 2.2, y - 17.5);
        ctx.lineTo(nx + 2.4, y - 15.5);
        ctx.moveTo(nx - 2.9, y - 12.5);
        ctx.lineTo(nx + 3, y - 10.5);
        ctx.stroke();
        // Knöpfe
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(nx, y + 2, 1.8, 0, TAU);
        ctx.moveTo(nx + f * 0.5 + 1.8, y + 10);
        ctx.arc(nx + f * 0.5, y + 10, 1.8, 0, TAU);
        ctx.fill();
        ZombieArt.crest(ctx, f * 11.5, y - 3.5);
        this._patch(ctx, -f * 15, y + 9, 0.25 * f, '#ff9f1c');
        if (p2) this._patch(ctx, f * 10, y + 15, -0.3 * f, '#3cc8d8');   // in Phase 2 ein zweiter Flicken
    }

    _patch(ctx, x, y, rot, col) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        Art.box(ctx, -5.5, -4.5, 11, 9, 2, col, { lineWidth: 1.4, highlight: false });
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([1.6, 1.6]);
        ctx.strokeRect(-3.8, -2.8, 7.6, 5.6);
        ctx.setLineDash([]);
        ctx.restore();
    }

    // Riesiger grüner Kopf: Ohr, graue Haare, Naht, Pflaster, Nase, Unterbiss, Glubschauge + Monokel-Auge,
    // buschige Brauen, Doktorhut mit Quaste. dead = Spiralaugen.
    _head(ctx, f, p, p2, dead) {
        const SKIN = '#9edc7c';
        const t = Art.time;
        ctx.save();
        ctx.translate(f * 3, -74 + p.bob * 1.15);
        ctx.rotate(p.tilt);
        // Ohr hinten
        Art.body(ctx, -f * 25, 3, 5.5, 7.5, SKIN, { lineWidth: 2, highlight: false });
        // Kopf
        Art.body(ctx, 0, 0, 26, 22, SKIN, { lineWidth: 2.5 });
        // ein paar graue Haare stehen hinten ab
        ctx.strokeStyle = '#d4d8ee';
        ctx.lineWidth = 1.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-f * 17, -14);
        ctx.quadraticCurveTo(-f * 26, -18, -f * 27, -11);
        ctx.moveTo(-f * 20, -10);
        ctx.quadraticCurveTo(-f * 30, -10, -f * 29.5, -3);
        ctx.moveTo(-f * 13, -17);
        ctx.quadraticCurveTo(-f * 20, -25, -f * 25, -21);
        ctx.stroke();
        // Naht an der Schläfe
        ctx.strokeStyle = Art.ink(SKIN);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(f * 19.5, -8);
        ctx.lineTo(f * 22.5, 5);
        for (let i = 0; i < 4; i++) {
            const q = 0.12 + i * 0.25;
            const x = f * (19.5 + 3 * q), y = -8 + 13 * q;
            ctx.moveTo(x - 2.2, y + 0.4);
            ctx.lineTo(x + 2.2, y - 0.4);
        }
        ctx.stroke();
        // Pflaster auf der hinteren Wange
        ctx.save();
        ctx.translate(-f * 16, 8);
        ctx.rotate(0.5 * f);
        ctx.fillStyle = '#ffd9b0';
        ctx.beginPath();
        ctx.roundRect(-4.6, -1.8, 9.2, 3.6, 1.8);
        ctx.fill();
        ctx.strokeStyle = '#c98a5a';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.fillStyle = '#e8b78a';
        ctx.fillRect(-1.5, -1.1, 3, 2.2);
        ctx.restore();
        // Mund mit Unterbiss: dunkle Öffnung, drei stumpfe Zähne, vorgeschobener Unterkiefer
        const mx = f * 4, my = 13.5;
        const open = p.mouth;
        ctx.fillStyle = '#4a1030';
        ctx.beginPath();
        ctx.ellipse(mx, my, 12.5, 3.6 + open * 5, 0, 0, TAU);
        ctx.fill();
        const jy = my + 4 + open * 4.5;
        ctx.fillStyle = '#fffbea';
        ctx.strokeStyle = '#6b5a3a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            const th = i === 0 ? 7.6 : 6.4;
            ctx.roundRect(mx + i * 7.5 - 2.7, jy - 1.6 - th, 5.4, th + 2, 1.6);
        }
        ctx.fill();
        ctx.stroke();
        Art.shape(ctx, c => {
            c.moveTo(mx - 14.5, jy - 1.5);
            c.quadraticCurveTo(mx, jy - 4.5, mx + 14.5, jy - 1.5);
            c.quadraticCurveTo(mx + 13, jy + 6.5, mx, jy + 6.5);
            c.quadraticCurveTo(mx - 13, jy + 6.5, mx - 14.5, jy - 1.5);
            c.closePath();
        }, { x: mx - 14.5, y: jy - 4.5, w: 29, h: 11 }, SKIN, { lineWidth: 2 });
        // Augen: großes Glubschauge vorn, kleines Auge mit Monokel hinten
        const e1x = f * 10, e1y = -5, e2x = -f * 8.5, e2y = -3;
        if (dead) {
            Juri.spiralEye(ctx, e1x, e1y, 7.5, t * 7);
            Juri.spiralEye(ctx, e2x, e2y, 5, -t * 8);
        } else {
            const lk = this.look;
            const iris = p2 ? '#ff2d55' : '#ffd23f';
            if (p2) Art.glow(ctx, e1x, e1y, 19, '#ff2d55', 0.5 + 0.15 * Math.sin(t * 9));
            Art.eye(ctx, e1x, e1y, 7.8, lk, { iris, irisSize: 0.5, open: Art.blink(this.seed) });
            Art.eye(ctx, e2x, e2y, 5, lk, { iris, irisSize: 0.55, open: Math.min(0.85, Art.blink(this.seed + 0.4)) });
        }
        // Knollennase
        Art.body(ctx, f * 1.2, 4.2, 3.6, 3, Art.dark(SKIN, 0.08), { lineWidth: 1.6 });
        // Monokel mit Kettchen
        ctx.strokeStyle = '#8a5a00';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(e2x, e2y, 7, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e2x - f * 2, e2y + 6.8);
        ctx.quadraticCurveTo(e2x - f * 7, e2y + 16, e2x - f * 3, e2y + 22);
        ctx.stroke();
        // buschige graue Brauen (Phase 2: böse zusammengezogen)
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (p2 && !dead) {
            ctx.moveTo(f * 3, -12.5);
            ctx.lineTo(f * 17.5, -17);
            ctx.moveTo(-f * 3.5, -9.5);
            ctx.lineTo(-f * 13, -13);
        } else {
            ctx.moveTo(f * 3, -15.4);
            ctx.lineTo(f * 17.5, -16.2);
            ctx.moveTo(-f * 3.5, -11);
            ctx.lineTo(-f * 13, -13.2);
        }
        ctx.strokeStyle = '#4a4f70';
        ctx.lineWidth = 5.4;
        ctx.stroke();
        ctx.strokeStyle = '#dfe3f5';
        ctx.lineWidth = 3.4;
        ctx.stroke();
        // Doktorhut: Kappe, schräges Brett, Knopf und Quaste
        Art.shape(ctx, c => {
            c.moveTo(-17, -16);
            c.quadraticCurveTo(-17, -27, 0, -27.5);
            c.quadraticCurveTo(17, -27, 17, -16);
            c.quadraticCurveTo(0, -19.5, -17, -16);
            c.closePath();
        }, { x: -17, y: -27.5, w: 34, h: 11.5 }, '#3b3570', { lineWidth: 2 });
        const bx = f * 1.5, byy = -28;
        Art.shape(ctx, c => {
            c.moveTo(bx - 27, byy);
            c.lineTo(bx, byy - 7.5);
            c.lineTo(bx + 27, byy);
            c.lineTo(bx, byy + 7.5);
            c.closePath();
        }, { x: bx - 27, y: byy - 7.5, w: 54, h: 15 }, '#3b3570', { lineWidth: 2, glossy: true });
        const sw = Math.sin(t * 2.6 + this.seed) * 0.18 + p.step * 0.2 - p.tilt;
        const qx = bx + f * 21, qy = byy + 1;
        const tx = qx + Math.sin(sw) * 12, ty = qy + Math.cos(sw) * 12;
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bx, byy);
        ctx.quadraticCurveTo(bx + f * 12, byy - 2, qx, qy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        Art.body(ctx, tx, ty + 2.5, 2.8, 4, '#ffd23f', { lineWidth: 1.3, highlight: false });
        Art.body(ctx, bx, byy, 2.6, 1.8, '#ffd23f', { lineWidth: 1, highlight: false });
        // Phase 2: rote Zornesader neben dem Kopf
        if (p2 && !dead) {
            const vx = f * 26, vy = -21;
            const s = 1 + 0.15 * Math.sin(t * 10);
            ctx.strokeStyle = '#ff2d55';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = i * (Math.PI / 2) + Math.PI / 4;
                const cx = vx + Math.cos(a) * 3.4 * s, cy = vy + Math.sin(a) * 3.4 * s;
                ctx.moveTo(cx + Math.cos(a + 2.2) * 2.4 * s, cy + Math.sin(a + 2.2) * 2.4 * s);
                ctx.arc(cx, cy, 2.4 * s, a + 2.2, a + 4.1);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    // Vorderer Arm: Hemdsärmel bis zum Ellbogen, grüner Unterarm mit Naht
    _frontArm(ctx, f, p) {
        const SKIN = '#9edc7c';
        const sx = p.sfx, sy = p.sfy, hx = p.hx, hy = p.hy;
        const dx = hx - sx, dy = hy - sy;
        const len = Math.hypot(dx, dy) || 1;
        const bend = Math.max(0, 32 - len) * 0.4 + 3;
        const ex = (sx + hx) / 2 - (dy / len) * bend * f, ey = (sy + hy) / 2 + (dx / len) * bend * f;
        Art.limb(ctx, sx, sy, ex, ey, 10, '#f4f0ff', { lineWidth: 2 });
        Art.limb(ctx, ex, ey, hx, hy, 8, SKIN, { lineWidth: 2 });
        const l2 = Math.hypot(hx - ex, hy - ey) || 1;
        const ux = (hx - ex) / l2, uy = (hy - ey) / l2;
        const qx = (ex + hx) / 2, qy = (ey + hy) / 2;
        ctx.strokeStyle = Art.ink(SKIN);
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(qx - ux * 5, qy - uy * 5);
        ctx.lineTo(qx + ux * 5, qy + uy * 5);
        for (let i = -1; i <= 1; i++) {
            const cx = qx + ux * i * 3.4, cy = qy + uy * i * 3.4;
            ctx.moveTo(cx - uy * 2.4, cy + ux * 2.4);
            ctx.lineTo(cx + uy * 2.4, cy - ux * 2.4);
        }
        ctx.stroke();
    }

    // Hinterer Arm mit der Schulglocke (hängt, beim Läuten hoch erhoben)
    _backArm(ctx, f, p) {
        Art.limb(ctx, p.sbx, p.sby, p.bx, p.by, 9, '#dcd6f0', { lineWidth: 2 });
        ctx.save();
        ctx.translate(p.bx, p.by);
        ctx.rotate(p.ba);
        Art.limb(ctx, 0, 0, 0, 6, 3.2, '#8a5a2a', { lineWidth: 1.4 });
        Art.shape(ctx, c => {
            c.moveTo(-3.5, 6);
            c.quadraticCurveTo(-4.5, 11, -8.5, 16.5);
            c.quadraticCurveTo(0, 19, 8.5, 16.5);
            c.quadraticCurveTo(4.5, 11, 3.5, 6);
            c.closePath();
        }, { x: -8.5, y: 6, w: 17, h: 13 }, '#ffd23f', { lineWidth: 1.8, glossy: true });
        Art.body(ctx, 0, 18, 2.4, 2.4, '#c98a1a', { lineWidth: 1.2, highlight: false });
        ctx.restore();
        Art.body(ctx, p.bx, p.by, 5.8, 5.4, Art.dark('#9edc7c', 0.1), { lineWidth: 2, highlight: false });
    }

    // Klingel-Wellen um die erhobene Glocke
    _bellRing(ctx, p) {
        const x = p.bx, y = p.by + 12;
        const prev = ctx.globalAlpha;
        ctx.strokeStyle = '#fff3a8';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            const q = (Art.time * 2.6 + i * 0.5) % 1;
            const r = 13 + q * 14;
            ctx.globalAlpha = prev * (1 - q);
            ctx.beginPath();
            ctx.arc(x, y, r, -0.55, 0.55);
            ctx.moveTo(x + Math.cos(Math.PI - 0.55) * r, y + Math.sin(Math.PI - 0.55) * r);
            ctx.arc(x, y, r, Math.PI - 0.55, Math.PI + 0.55);
            ctx.stroke();
        }
        ctx.globalAlpha = prev;
    }

    // Riesen-Holzhammer; der Kopf leuchtet, wenn ein Angriff kommt
    _hammer(ctx, p) {
        ctx.save();
        ctx.translate(p.hx, p.hy);
        ctx.rotate(p.ha);
        const L = p.hl;
        if (p.glow > 0) Art.glow(ctx, L, 0, 22 + p.glow * 18, p.glowCol, 0.25 + p.glow * 0.6);
        ZombieArt.mallet(ctx, -11, L, 21, 36, 2.2);
        // Griffband
        ctx.strokeStyle = '#6b3a1a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-2, -3);
        ctx.lineTo(-4, 3);
        ctx.moveTo(3, -3);
        ctx.lineTo(1, 3);
        ctx.stroke();
        if (p.glow > 0.35) {
            const g = (p.glow - 0.35) / 0.65;
            Art.glow(ctx, L, 0, 17, '#fff6c8', g * 0.6);
            Art.sparkle(ctx, L + Math.cos(Art.time * 9) * 13, Math.sin(Art.time * 11) * 16, 2.5 + g * 3, '#ffffff', 0.4 + g * 0.6);
        }
        ctx.restore();
    }

    // Besiegt: Hammer fällt herunter, der Riese dreht sich benommen (Spiralaugen, Sterne),
    // sackt dann zusammen und verpufft in einer Wolke. Beim epischen Stillstand bleibt er im ersten Bild.
    _drawDead(ctx) {
        const k = clamp(this.deathProgress(), 0, 1);
        const t = Art.time;
        const f = this.face;
        const a0 = ctx.globalAlpha;
        ctx.save();
        ctx.globalAlpha = a0 * clamp(1.4 - k * 1.4, 0, 1);
        ctx.translate(f * 30, -5);
        ctx.rotate(f > 0 ? -0.12 : Math.PI + 0.12);
        ZombieArt.mallet(ctx, -8, 40, 21, 36, 2.2);
        ctx.restore();
        const spin = Math.cos(t * 8);
        const fs = spin >= 0 ? f : -f;
        const s = Math.max(0.05, 1 - k * k * 0.95);
        const p = this._deadPose(this._pz, fs, t);
        ctx.save();
        ctx.globalAlpha = a0 * clamp(1.25 - k * 1.2, 0, 1);
        ctx.scale((0.4 + 0.6 * Math.abs(spin)) * s, s);
        this._backArm(ctx, fs, p);
        this._legs(ctx, fs, p);
        this._torso(ctx, fs, p, this.phase === 2);
        this._head(ctx, fs, p, false, true);
        this._frontArm(ctx, fs, p);
        Art.body(ctx, p.hx, p.hy, 6.6, 6, '#9edc7c', { lineWidth: 2 });
        ctx.restore();
        // Sterne kreisen über dem Kopf
        for (let i = 0; i < 4; i++) {
            const a = t * 4 + (i * TAU) / 4;
            Art.star(ctx, Math.cos(a) * 26 * s, -118 * s + Math.sin(a) * 7 * s, 4 * s + 1.5, '#ffe35a', { lineWidth: 1.4, outline: '#a86a00' });
        }
        // Staubwolke mit Funkeln, sobald er zusammensackt
        if (k > 0.05) {
            ctx.globalAlpha = a0 * (1 - k) * 0.85;
            ctx.fillStyle = '#f1ecff';
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const a = Math.PI * (1.02 + i * 0.16);
                const d = 18 + k * 40;
                const r = 8 + k * 12;
                const x = Math.cos(a) * d * 1.3, y = -20 + Math.sin(a) * d * 0.8;
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fill();
            ctx.globalAlpha = a0;
            for (let i = 0; i < 5; i++) {
                const a = i * 1.26 + k * 2;
                Art.sparkle(ctx, Math.cos(a) * (20 + k * 50), -40 + Math.sin(a) * (16 + k * 36), 4 * (1 - k) + 1, '#fff6a8', 1 - k);
            }
        }
        ctx.globalAlpha = a0;
    }

    _deadPose(p, f, t) {
        p.step = 0;
        p.bob = 0;
        p.lean = 0;
        p.tilt = Math.sin(t * 3 + this.seed) * 0.1;
        p.mouth = 0.4;
        p.glow = 0;
        p.stuck = false;
        p.hx = f * 30;
        p.hy = -26;
        p.bx = -f * 29;
        p.by = -30;
        p.bUp = false;
        p.ba = Math.sin(t * 5) * 0.3;
        this._shoulders(p, f, f * 19, -50);
        return p;
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        ctx.save();
        if (this.waveOn) this._drawWave(ctx, camera);
        const st = this.state;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        if (st === 'aim') this._drawAim(ctx, camera, k);
        else if (st === 'raise' || st === 'swing') this._drawSlamWarn(ctx, camera, st === 'raise' ? k : 1);
        else if (st === 'bell') this._drawSpots(ctx, camera, k);
        ctx.restore();
    }

    // Ziellinien vom Hammer und roter Zielkreis unter dem ausgewählten Ziel (Mark oder Begleiter)
    _drawAim(ctx, camera, k) {
        const t = Art.time;
        const a = this.aimA;
        const sx = this.centerX() + this.face * 19, sy = this.y + this.h - 50;
        const s = camera.worldToScreen(sx + Math.cos(a) * 40, sy + Math.sin(a) * 40);
        const len = Math.max(60, Math.hypot(this.aimTX - sx, this.aimTY - sy) - 24);
        if (this.pattern === 'big') {
            LateWorldArt.lane(ctx, s.x, s.y, a, len, 26, k, '#ff3d5a');
        } else {
            const n = this.phase === 2 ? 5 : 3;
            const spread = this.phase === 2 ? 0.19 : 0.24;
            ctx.strokeStyle = '#ff3d5a';
            ctx.lineCap = 'round';
            ctx.lineWidth = 2.6;
            ctx.setLineDash([7, 6]);
            ctx.lineDashOffset = -t * 30;
            ctx.globalAlpha = 0.3 + 0.5 * k;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const ai = a + (i - (n - 1) / 2) * spread;
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x + Math.cos(ai) * len, s.y + Math.sin(ai) * len);
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }
        const tg = this.target;
        if (!tg || tg.dead) return;
        const fp = camera.worldToScreen(tg.x + tg.w / 2, tg.y + tg.h - 1);
        const r = Math.max(tg.w, 22) * 0.8 + 7 * (1 - k) + Math.sin(t * 14) * 1.2;
        ctx.fillStyle = '#ff3d5a';
        ctx.globalAlpha = 0.16 + 0.2 * k;
        ctx.beginPath();
        ctx.ellipse(fp.x, fp.y, r, r * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 16);
        ctx.strokeStyle = '#ff3d5a';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(fp.x, fp.y, r, r * 0.5, 0, 0, TAU);
        ctx.moveTo(fp.x + r * 0.45, fp.y);
        ctx.ellipse(fp.x, fp.y, r * 0.45, r * 0.22, 0, 0, TAU);
        ctx.moveTo(fp.x - r - 6, fp.y);
        ctx.lineTo(fp.x - r + 5, fp.y);
        ctx.moveTo(fp.x + r + 6, fp.y);
        ctx.lineTo(fp.x + r - 5, fp.y);
        ctx.moveTo(fp.x, fp.y - r * 0.5 - 4);
        ctx.lineTo(fp.x, fp.y - r * 0.5 + 3);
        ctx.moveTo(fp.x, fp.y + r * 0.5 + 4);
        ctx.lineTo(fp.x, fp.y + r * 0.5 - 3);
        ctx.stroke();
        // Pfeil über dem Kopf des Ziels
        const ap = camera.worldToScreen(tg.x + tg.w / 2, tg.y - 14 + Math.sin(t * 9) * 2.5);
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

    // Aufschlag-Warnkreis und gestrichelte Reichweite der Schockwelle
    _drawSlamWarn(ctx, camera, k) {
        const x = this.centerX() + this.face * this.slamDX, y = this.y + this.h - 8;
        const c = camera.worldToScreen(x, y);
        const R = this.phase === 2 ? 175 : 140;
        ctx.strokeStyle = '#ff9f43';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 7]);
        ctx.lineDashOffset = Art.time * 20;
        ctx.globalAlpha = 0.25 + 0.4 * k;
        ctx.beginPath();
        ctx.arc(c.x, c.y, R, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        const q = (Art.time * 1.6) % 1;
        ctx.globalAlpha = (0.15 + 0.35 * k) * (1 - q);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 30 + q * (R - 30), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        LateWorldArt.warn(ctx, c.x, c.y, 34, k, '#ff3d5a');
    }

    // Die Schockwelle: heller Rand mit orangem Saum
    _drawWave(ctx, camera) {
        const c = camera.worldToScreen(this.waveX, this.waveY);
        const r = this.waveR;
        const a = 1 - clamp(r / this.waveMax, 0, 1) * 0.6;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, TAU);
        ctx.globalAlpha = 0.45 * a;
        ctx.strokeStyle = '#ff8a2e';
        ctx.lineWidth = 22;
        ctx.stroke();
        ctx.globalAlpha = 0.95 * a;
        ctx.strokeStyle = '#ffe89a';
        ctx.lineWidth = 5;
        ctx.stroke();
        // dunkle Kanten, damit die Welle auch auf hellem Boden klar zu sehen ist
        ctx.globalAlpha = 0.6 * a;
        ctx.strokeStyle = '#a8401a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r + 11, 0, TAU);
        ctx.moveTo(c.x + Math.max(1, r - 11), c.y);
        ctx.arc(c.x, c.y, Math.max(1, r - 11), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Aufbrechende Erde, wo gleich Schüler herauskrabbeln (am Ende winken schon grüne Finger)
    _drawSpots(ctx, camera, k) {
        const t = Art.time;
        for (const s of this.spots) {
            const c = camera.worldToScreen(s.x, s.y + 9);
            const rr = 8 + k * 5;
            ctx.globalAlpha = 0.4 + 0.45 * k;
            ctx.fillStyle = '#5a3a22';
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, rr, rr * 0.4, 0, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = '#3a2414';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = i * 1.6 + 0.4;
                ctx.moveTo(c.x + Math.cos(a) * 4, c.y + Math.sin(a) * 2);
                ctx.lineTo(c.x + Math.cos(a) * (10 + k * 8), c.y + Math.sin(a) * (4 + k * 3));
            }
            ctx.stroke();
            ctx.globalAlpha = 0.55 + 0.4 * Math.sin(t * 12);
            ctx.strokeStyle = '#ff3d5a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 17, 7.5, 0, 0, TAU);
            ctx.stroke();
            if (k > 0.5) {
                const q = (k - 0.5) / 0.5;
                ctx.globalAlpha = 1;
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let i = -1; i <= 1; i++) {
                    const wig = Math.sin(t * 14 + i * 1.3) * 1.5;
                    ctx.moveTo(c.x + i * 3, c.y);
                    ctx.lineTo(c.x + i * 3.6 + wig, c.y - q * (4.5 + (i === 0 ? 2 : 0)));
                }
                ctx.strokeStyle = '#2f6b2a';
                ctx.lineWidth = 3.4;
                ctx.stroke();
                ctx.strokeStyle = '#8fdc6a';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }
}
// Angriffsfolge (wiederholt sich): Schuss, Schlag, Schuss, Glocke
BossGiantZombie.ORDER = ['shot', 'slam', 'shot', 'bell'];
