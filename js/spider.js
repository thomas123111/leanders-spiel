// ── Welt 34: Spinnenhöhle ── (Idee von Leander)
// Giftspinnen: schwarz-violette Spinnen mit giftgrünem Muster, acht tippelnde Beine, viele Augen.
//   Sie krabbeln schnell in Zickzack auf Mark zu, bleiben stehen, der Hinterleib pulsiert (0,5 s Warnung)
//   und spucken einen grünen Giftklecks auf Mark oder einen Freund (Schaden + Mark kurz verlangsamt).
//   Eine Spinne trägt den Schlüssel (isKeyGhost, main.js).
// Riesenspinne (Boss, 130 LP, bleibt immer im Boss-Raum):
//   Netzschuss: Warnlinie, dann ein großes Netz – wer getroffen wird, ist 2 s eingesponnen und kann sich
//     nicht bewegen (Mark über player.stun, Juri/Krokodil über c.stun). Das Netz bleibt als eigenes Objekt
//     in Game.props um den Getroffenen liegen (wie DragonFatherShadow, mit Lebensdauer).
//   Riesengiftstrahl: lädt 1,2 s (Giftblasen am Maul, grüne Warnlinie), dann ein breiter grüner Strahl,
//     der langsam schwenkt. Danach schnauft sie kurz – Zeit zum Zurückhauen.
//   Phase 2 (halbe LP): wütender (rote Augen, Aura, schnellere Beine): zwei Netze gleichzeitig
//     (eines auf Mark, eines auf einen Freund) und kleine Spinnen fallen von der Decke (höchstens 3,
//     verpuffen, sobald die Riesenspinne besiegt ist).
// Freunde verschwinden nie: ein Treffer, der sie besiegen würde, haut sie nur um (knockOut).

const SpiderHide = '#3b2454';      // schwarz-violetter Körper
const SpiderHideDark = '#241536';  // Beine, Schattenseite
const SpiderHead = '#4a2e68';
const SpiderVenom = '#8cff3a';     // Giftgrün (Welt 34 Akzent)
const SpiderVenomDeep = '#3fae1c';
const SpiderWeb = '#e8ecff';
const SpiderWarn = 0.55;           // Warnzeit der kleinen Spinne vor dem Spucken (Sekunden)
const SpiderGlobSpeed = 150;

const SpiderArt = {
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },

    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine (Galerie) direkt.
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

    // Wache, treffbare Begleiter (nicht die Schlange auf Marks Schulter)
    companions() {
        const out = [];
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || typeof c.stun !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Ein Freund wird nicht besiegt, sondern nur umgehauen (wie in angel.js)
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(8);
        else if (c.takeDamage) c.takeDamage(amount);
        SpiderArt.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [SpiderVenom, '#ffffff'], 9, 130, 0.4, { kind: 'spark' });
    },

    // Kürzeste Entfernung Punkt → Strecke
    segDist(px, py, x0, y0, x1, y1) {
        const dx = x1 - x0, dy = y1 - y0;
        const L = dx * dx + dy * dy;
        const t = L > 0 ? clamp(((px - x0) * dx + (py - y0) * dy) / L, 0, 1) : 0;
        return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
    },

    // Wie weit kommt ein Strahl, bevor eine Wand kommt (in Welt-Einheiten)
    rayLength(world, x, y, a, max) {
        if (!world || !world.isWall) return max;
        const ca = Math.cos(a), sa = Math.sin(a);
        for (let d = 12; d <= max; d += 10) {
            if (world.isWall(x + ca * d, y + sa * d)) return Math.max(24, d - 8);
        }
        return max;
    },

    // Netzt ein Opfer ein: 1 Schaden, 2 s eingesponnen, Netz-Objekt in Game.props. Gibt true zurück,
    // wenn das Opfer wirklich fängt (Ausweichen/Auto/Krone blockieren Marks Betäubung).
    snare(o, fromX, fromY, boss) {
        if (!o || o.dead) return false;
        const cx = o.x + (o.w || 20) / 2, cy = o.y + (o.h || 20) / 2;
        const isPlayer = typeof Game !== 'undefined' && Game.player === o;
        if (isPlayer) SpiderArt.hurt(o, 1, Math.atan2(cy - fromY, cx - fromX), 130);
        else SpiderArt.hitCompanion(o, 1);
        let stuck = false;
        if (typeof o.stun === 'function') {
            const r = o.stun(2);
            stuck = r !== false;
        }
        if (stuck && typeof Game !== 'undefined' && Game.props) {
            Game.props.push(new SpiderCocoon(o, 2));
            SpiderArt.burst(cx, cy - 10, [SpiderWeb, SpiderVenom, '#ffffff'], 10, 110, 0.5, { kind: 'spark' });
        }
        if (stuck && boss) boss.snared = 1.4;
        return stuck;
    },

    // Spannt ein spinntes Netz (Rahmen + Radialfäden + Spiralen) um (x, y), Größe s, a = Drehung
    web(ctx, x, y, s, a, alpha) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * alpha;
        ctx.strokeStyle = SpiderWeb;
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const r = a + (i * TAU) / 8;
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(r) * 15 * s, y + Math.sin(r) * 15 * s * 0.82);
        }
        for (let ring = 1; ring <= 3; ring++) {
            const rr = ring * 5 * s;
            for (let i = 0; i <= 8; i++) {
                const r = a + (i * TAU) / 8;
                const wob = 1 - 0.13 * Math.abs(Math.sin(i * 2.1 + ring));
                const px = x + Math.cos(r) * rr * wob, py = y + Math.sin(r) * rr * wob * 0.82;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
        }
        ctx.stroke();
        ctx.globalAlpha = prev;
    },
};

// ══════════════════════════════════════════
// ── Giftklecks (Geschoß der kleinen Spinne) ──
// ══════════════════════════════════════════

// Grüner Giftklecks: trifft Mark (Schaden + kurz verlangsamt, main.js über proj.poison) und mit
// hitsCompanions auch Juri und das Krokodil (kurz betäubt, main.js über proj.stunTime).
class SpiderGlob extends Projectile {
    constructor(x, y, angle) {
        super(x, y, Math.cos(angle) * SpiderGlobSpeed, Math.sin(angle) * SpiderGlobSpeed, 1, 'enemy', 90);
        this.radius = 6;
        this.lifetime = 2.3;
        this.poison = true;
        this.hitsCompanions = true;
        this.stunTime = 1.2;
        this.seed = Math.random() * 10;
    }

    update(dt, world) {
        const was = this.dead;
        super.update(dt, world);
        if (!was && this.dead) {
            // an der Wand: platscht grün auseinander
            SpiderArt.burst(this.x, this.y, [SpiderVenom, SpiderVenomDeep, '#d9ffb0'], 6, 80, 0.35, { kind: 'spark' });
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const t = Art.time * 9 + this.seed;
        Art.glow(ctx, p.x, p.y, 13, SpiderVenom, 0.55);
        // schleimiger Schweif
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.3;
        ctx.fillStyle = SpiderVenom;
        ctx.beginPath();
        ctx.moveTo(p.x - dy * 3.4, p.y + dx * 3.4);
        ctx.lineTo(p.x - dx * 15, p.y - dy * 15);
        ctx.lineTo(p.x + dy * 3.4, p.y - dx * 3.4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev;
        // wabbeliger Klecks
        ctx.fillStyle = SpiderVenomDeep;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 6 + Math.sin(t) * 0.8, 5 - Math.sin(t) * 0.7, Math.atan2(dy, dx), 0, TAU);
        ctx.fill();
        ctx.fillStyle = SpiderVenom;
        ctx.beginPath();
        ctx.ellipse(p.x - dx, p.y - dy, 4, 3.3, Math.atan2(dy, dx), 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#eaffce';
        ctx.beginPath();
        ctx.arc(p.x - 1.4, p.y - 1.6, 1.3, 0, TAU);
        ctx.fill();
    }
}

// ══════════════════════════════════════════
// ── Giftspinne ──
// ══════════════════════════════════════════

// Schwarz-violette Spinne mit grünem Muster: krabbelt in Zickzack-Bursts heran, tippt mit den acht
// Beinen, bleibt stehen (Hinterleib pulsiert, grüne Warnlinie) und spuckt einen Giftklecks.
// Zustände: scurry (Zickzack) → coil (kurz abgetippt) → wind (0,55 s Warnung) → spit (Kurzpause) → …
class PoisonSpider extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 50;
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = SpiderVenom;
        this.body = SpiderHide;
        this.legDark = SpiderHideDark;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.lookDir = { x: 0, y: 0.3 };
        this.detectionRange = 230;
        this.engaged = false;
        this.moving = false;
        this.t = Math.random() * 10;
        this.walkT = Math.random() * 3;
        this.state = 'scurry';
        this.stateT = randRange(0.4, 0.9);
        this.zigT = 0.3;
        this.zig = Math.random() < 0.5 ? 1 : -1;
        this.wx = 0;
        this.wy = 1;
        this.shootT = randRange(1.4, 2.6);
        this.aimA = 0;
        this.tg = null;
        this._keyInit = false;
    }

    _mouth() {
        return { x: this.centerX() + this.face * 9, y: this.centerY() - 4 };
    }

    // Ziel: Mark oder ein wacher Freund mit freier Sicht, nächster zuerst
    _pickTarget(world, player) {
        const m = this._mouth();
        let best = null, bestD = Infinity;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (typeof Juri === 'undefined' || Juri.lineClear(world, m.x, m.y, px, py)) {
                best = player;
                bestD = Math.hypot(px - m.x, py - m.y);
            }
        }
        for (const c of SpiderArt.companions()) {
            const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
            const d = Math.hypot(cx - m.x, cy - m.y);
            if (d < bestD && d < 300 && (typeof Juri === 'undefined' || Juri.lineClear(world, m.x, m.y, cx, cy))) {
                best = c;
                bestD = d;
            }
        }
        return best;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): etwas zäher
            this._keyInit = true;
            this.hp = this.maxHp = 9;
        }
        this.t += dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 70) this.engaged = false;
        this.moving = false;

        if (this.state === 'wind') {
            // steht, Hinterleib pulsiert; die letzten 0,2 s steht die Wurfrichtung fest
            this.stateT -= dt;
            if (this.stateT > 0.2) {
                this.tg = this._pickTarget(world, player) || player;
                const m = this._mouth();
                const tx = this.tg.x + (this.tg.w || 20) / 2, ty = this.tg.y + (this.tg.h || 20) / 2;
                this.aimA = Math.atan2(ty - m.y, tx - m.x);
            }
            this._look(Math.cos(this.aimA), Math.sin(this.aimA), dt);
            if (Math.abs(Math.cos(this.aimA)) > 0.25) this.face = Math.cos(this.aimA) > 0 ? 1 : -1;
            if (this.stateT <= 0) {
                const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
                const m = this._mouth();
                // Leistung: Gegnergeschosse begrenzen
                if (list && (!list.length || list.length < 55)) {
                    list.push(new SpiderGlob(m.x, m.y, this.aimA));
                    SpiderArt.burst(m.x, m.y, [SpiderVenom, '#d9ffb0'], 4, 70, 0.3, { kind: 'spark' });
                }
                this.state = 'spit';
                this.stateT = 0.22;
                this.shootT = randRange(2.0, 3.0);
            }
            return;
        }
        if (this.state === 'spit') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'coil';
                this.stateT = randRange(0.18, 0.3);
            }
            return;
        }
        if (this.state === 'coil') {
            // kurz abgetippt, dann Zickzack-Burst
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'scurry';
                this.stateT = randRange(0.4, 0.75);
                this.zig = -this.zig;
            }
            return;
        }

        // scurry
        this.stateT -= dt;
        this.shootT -= dt;
        if (this.engaged) {
            if (this.shootT <= 0 && dist < 240) {
                this.tg = this._pickTarget(world, player);
                if (this.tg) {
                    this.state = 'wind';
                    this.stateT = SpiderWarn;
                    const m = this._mouth();
                    const tx = this.tg.x + (this.tg.w || 20) / 2, ty = this.tg.y + (this.tg.h || 20) / 2;
                    this.aimA = Math.atan2(ty - m.y, tx - m.x);
                    return;
                }
                this.shootT = 0.4;   // keine freie Sicht: gleich wieder versuchen
            }
            if (this.stateT <= 0) {
                this.state = 'coil';
                this.stateT = randRange(0.2, 0.4);
            }
        } else if (this.stateT <= 0) {
            this.stateT = randRange(0.6, 1.4);
            const a = Math.random() * TAU;
            this.wx = Math.cos(a);
            this.wy = Math.sin(a);
        }

        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            const tx = dx / dist, ty = dy / dist;
            vx = tx + (-ty) * this.zig * 0.9;
            vy = ty + tx * this.zig * 0.9;
            const l = Math.hypot(vx, vy) || 1;
            vx /= l; vy /= l;
            sp = this.speed * (dist < 60 ? 0.55 : 1.35);
        } else {
            vx = this.wx; vy = this.wy; sp = this.speed * 0.45;
        }
        this.moving = sp > 0;
        if (this.moving) {
            this.walkT += dt;
            const ox = this.x, oy = this.y;
            this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
            if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) {
                if (this.engaged) this.zig = -this.zig;
                else this.stateT = 0;
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
        this.lookDir.x += (nx - this.lookDir.x) * k;
        this.lookDir.y += (ny - this.lookDir.y) * k;
    }

    // Grüne Warnlinie in Wurfrichtung, solange der Hinterleib pulsiert
    drawUnder(ctx, camera) {
        if (this.dead || this.state !== 'wind') return;
        const m = this._mouth();
        const p = camera.worldToScreen(m.x, m.y);
        const k = clamp(1 - this.stateT / SpiderWarn, 0, 1);
        LateWorldArt.lane(ctx, p.x, p.y, this.aimA, 96, 14, k, SpiderVenomDeep);
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 10)) {
                ctx.translate(cx, by);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, by);
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 20 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Spinne mit Fußpunkt (0, 0); Blick in Richtung face. Acht Beine tippen im Wechsel.
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const windK = !dead && this.state === 'wind' ? clamp(1 - this.stateT / SpiderWarn, 0, 1) : 0;
        const moving = this.moving && !dead;
        const step = moving ? Math.sin(this.walkT * 13 + sd) : 0;
        const bodyY = -11 + (moving ? Math.abs(step) * 0.9 : Math.sin(t * 2.6 + sd) * 0.6) + windK * 1.5;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -12, 24, '#ffd23f', 0.4 + 0.12 * Math.sin(t * 3 + sd));
        // acht Beine (hintere dunkler), Knie hoch, Füße tippen
        for (let s = -1; s <= 1; s += 2) {
            for (let i = 0; i < 4; i++) {
                const ph = this.walkT * 13 + i * 1.6 + (s > 0 ? 0 : Math.PI);
                const lift = moving ? Math.max(0, Math.sin(ph)) * 2.6 : Math.sin(t * 2 + i) * 0.4;
                const swing = moving ? Math.cos(ph) * 1.7 : 0;
                const kx = s * (8.5 + i * 1.4), ky = bodyY - 7 - i * 0.8;
                const fx = s * (11.5 + i * 2.4) + swing - f * 1.5;
                const col = i > 1 ? this.legDark : this.body;
                Art.limb(ctx, s * 2 + f * 1, bodyY - 2, kx, ky, 1.9, col, { lineWidth: 0.9 });
                Art.limb(ctx, kx, ky, fx, -lift, 1.6, col, { lineWidth: 0.9 });
            }
        }
        // Hinterleib groß hinten, mit grüner Fleckenzeichnung; beim Warnen pulsierend
        const pulse = 1 + windK * 0.14 * (0.6 + 0.4 * Math.sin(t * 24));
        const abdX = -f * 6.5;
        if (windK > 0) Art.glow(ctx, abdX - f * 3, bodyY - 5, 12 + windK * 9, SpiderVenom, 0.25 + windK * 0.45);
        Art.body(ctx, abdX, bodyY - 5, 9.5 * pulse, 8.2 * pulse, this.body, { lineWidth: 1.4 });
        ctx.fillStyle = SpiderVenom;
        ctx.beginPath();
        ctx.moveTo(abdX - f * 1, bodyY - 11.5);
        ctx.lineTo(abdX + f * 2.5, bodyY - 7);
        ctx.lineTo(abdX - f * 1, bodyY - 2.5);
        ctx.lineTo(abdX - f * 4.5, bodyY - 7);
        ctx.closePath();
        ctx.arc(abdX - f * 5.5, bodyY - 10.5, 1.3, 0, TAU);
        ctx.moveTo(abdX - f * 0.5 + 1.1, bodyY - 1.5);
        ctx.arc(abdX - f * 0.5, bodyY - 1.5, 1.1, 0, TAU);
        ctx.fill();
        // Kopf vorn mit Kiefer
        Art.body(ctx, f * 6.5, bodyY - 3, 6.6, 5.4, SpiderHead, { lineWidth: 1.3 });
        // viele Augen: zwei große vorn + vier kleine Punkte obendrauf
        if (dead) {
            LateWorldArt.xEyes(ctx, f * 8, bodyY - 4, 1.4, 2.4);
        } else {
            Art.eyes(ctx, f * 7.8, bodyY - 4, 1.9, { gap: 2.4, look: this.lookDir, angry: true, iris: '#5ecf1c', seed: sd });
            ctx.fillStyle = SpiderVenom;
            ctx.beginPath();
            ctx.arc(f * 4.5, bodyY - 7.5, 1.1, 0, TAU);
            ctx.moveTo(f * 7 + 1, bodyY - 8.2);
            ctx.arc(f * 7, bodyY - 8.2, 1, 0, TAU);
            ctx.moveTo(f * 9.5 + 0.9, bodyY - 7.4);
            ctx.arc(f * 9.5, bodyY - 7.4, 0.9, 0, TAU);
            ctx.arc(f * 3.5, bodyY - 1.5, 0.8, 0, TAU);
            ctx.fill();
        }
        // Kiefer mit Giftzähnen: beim Warnen weit auf, grünlich schimmernd
        const jaw = windK > 0 ? 1 : (dead ? 0 : 0.25);
        Art.body(ctx, f * 11, bodyY + 0.5, 2.4, 2 + jaw, SpiderHideDark, { lineWidth: 1, highlight: false });
        ctx.fillStyle = '#f2ffd9';
        ctx.strokeStyle = Art.ink(SpiderHideDark);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(f * 10, bodyY + 2);
        ctx.lineTo(f * 12.4, bodyY + 2);
        ctx.lineTo(f * 11.4, bodyY + 5.2 + jaw * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}

// ══════════════════════════════════════════
// ── Netz, Kokon und kleine Spinnen (Boss) ──
// ══════════════════════════════════════════

// Großes Wurfnetz der Riesenspinne. Liegt in der Geschoss-Liste (owner 'bossfx': die Engine prüft
// keine Treffer, das macht das Netz selbst). Fliegt auf einen festen Punkt und fängt unterwegs
// Mark oder einen Freund – das Opfer ist 2 s eingesponnen (SpiderArt.snare).
class SpiderNet {
    constructor(boss, x, y, tx, ty) {
        this.boss = boss;
        this.x = x;
        this.y = y;
        this.x0 = x;
        this.y0 = y;
        this.tx = tx;
        this.ty = ty;
        this.owner = 'bossfx';
        this.damage = 0;
        this.radius = 17;
        this.dead = false;
        this.age = 0;
        this.dur = clamp(Math.hypot(tx - x, ty - y) / 330, 0.35, 0.95);
        this.rot = Math.random() * TAU;
        this.spin = Math.random() < 0.5 ? -9 : 9;
        this.hit = [];
    }

    update(dt) {
        const b = this.boss;
        if (!b || b.dead) {
            this.dead = true;
            return;
        }
        this.age += dt;
        this.rot += this.spin * dt;
        const k = clamp(this.age / this.dur, 0, 1);
        const e = Math.sin((k * Math.PI) / 2);
        this.x = this.x0 + (this.tx - this.x0) * e;
        this.y = this.y0 + (this.ty - this.y0) * e;
        if (this._hits()) {
            this.dead = true;
            return;
        }
        if (k >= 1) {
            this.dead = true;
            SpiderArt.burst(this.x, this.y, [SpiderWeb, SpiderVenom], 6, 70, 0.35, { kind: 'spark' });
        }
    }

    _hits() {
        if (typeof Game === 'undefined') return false;
        const P = Game.player;
        if (P && !P.dead && this.hit.indexOf(P) < 0) {
            const px = P.x + P.w / 2, py = P.y + P.h / 2;
            if (Math.hypot(px - this.x, py - this.y) < this.radius + P.w / 2) {
                this.hit.push(P);
                if (SpiderArt.snare(P, this.x, this.y, this.boss)) return true;
            }
        }
        for (const c of SpiderArt.companions()) {
            if (c.iFrames > 0 || this.hit.indexOf(c) >= 0) continue;
            const cw = c.w || 20, ch = c.h || 20;
            if (Math.hypot(c.x + cw / 2 - this.x, c.y + ch / 2 - this.y) > this.radius + Math.max(cw, ch) / 2) continue;
            this.hit.push(c);
            SpiderArt.snare(c, this.x, this.y, this.boss);
            return true;
        }
        return false;
    }

    // Schatten am Boden (zeigt, wo das Netz gerade fliegt)
    drawUnder(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y + 12);
        ctx.fillStyle = 'rgba(20,10,40,0.22)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 15, 5, 0, 0, TAU);
        ctx.fill();
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        Art.glow(ctx, p.x, p.y, 22, SpiderWeb, 0.22);
        SpiderArt.web(ctx, p.x, p.y, 1.15, this.rot, 0.95);
        // kleiner giftiger Klecks in der Netzmitte
        ctx.fillStyle = SpiderVenomDeep;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4, 0, TAU);
        ctx.fill();
    }
}

// Eingesponnener Freund oder Mark: ein Netz um die Figur, solange die Betäubung läuft.
// Liegt in Game.props (wie DragonFatherShadow) und entfernt sich selbst, wenn die Lebensdauer um ist.
class SpiderCocoon {
    constructor(target, life) {
        this.tg = target;
        this.life = life;
        this.max = life;
        this.w = 1;
        this.h = 1;
        this.x = target.x;
        this.y = target.y;
        this.noShadow = true;
        this.removed = false;
        this.seed = Math.random() * 10;
    }

    update(dt) {
        this.life -= dt;
        const tg = this.tg;
        if (tg && !tg.dead) {
            this.x = tg.x + (tg.w || 20) / 2;
            this.y = tg.y + (tg.h || 20) / 2;
        }
        if (this.life <= 0 && !this.removed && typeof Game !== 'undefined' && Game.props) {
            this.removed = true;
            const i = Game.props.indexOf(this);
            if (i >= 0) Game.props.splice(i, 1);
            SpiderArt.burst(this.x, this.y - 8, [SpiderWeb, '#ffffff'], 8, 90, 0.4, { kind: 'spark' });
        }
    }

    draw(ctx, camera) {
        const tg = this.tg;
        if (this.life <= 0 || !tg || tg.dead) return;
        const p = camera.worldToScreen(this.x, this.y - 10);
        const k = Math.min(1, this.life * 2.5, (this.max - this.life) * 5);
        const wob = Math.sin(Art.time * 14 + this.seed) * 0.05;
        SpiderArt.web(ctx, p.x, p.y, 1.25 + wob, this.seed, 0.55 + 0.35 * k);
        Art.sparkle(ctx, p.x + 10, p.y - 8, 2, SpiderWeb, 0.4 + 0.4 * k);
    }
}

// Kleine Spinne, die in Phase 2 von der Decke fällt. Verpufft, sobald die Riesenspinne besiegt ist
// (Muster wie die gerufenen Hexenkinder), und bleibt im Boss-Raum.
class SpiderKid extends Enemy {
    constructor(x, y) {
        super(x, y, 16, 16);
        this.hp = 2;
        this.maxHp = 2;
        this.speed = 66;
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = SpiderVenom;
        this.summoner = null;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.lookDir = { x: 0, y: 0.3 };
        this.state = 'fall';
        this.fallT = randRange(0.45, 0.6);
        this.lift = 130;
        this.moving = false;
        this.walkT = Math.random() * 3;
        this.t = Math.random() * 10;
        this.burstDone = false;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        // gerufene Spinnen verpuffen mit ihrer Riesenspinne und bleiben im Boss-Raum
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                SpiderArt.burst(this.centerX(), this.centerY(), [SpiderWeb, SpiderVenom, '#ffffff'], 8, 90, 0.45, { kind: 'spark' });
                return;
            }
            const room = typeof Game !== 'undefined' && Game.bossActive && typeof Game._bossRoomRect === 'function' ? Game._bossRoomRect() : null;
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }
        if (this.state === 'fall') {
            // an einem Faden herabgelassen (nur Darstellung; der Fußpunkt steht schon fest)
            this.fallT -= dt;
            this.lift = clamp(this.fallT / 0.5, 0, 1) * 130;
            if (this.fallT <= 0) {
                this.lift = 0;
                this.state = 'scuttle';
                if (!this.burstDone) {
                    this.burstDone = true;
                    SpiderArt.burst(this.centerX(), this.y + this.h, [SpiderWeb, '#c9c4e0'], 4, 60, 0.3, { kind: 'smoke', size: 2 });
                }
            }
            return;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        // flinkes, leicht schlängelndes Krabbeln
        const wob = Math.sin(this.t * 7 + this.seed) * 0.5;
        const ca = Math.cos(wob), sa = Math.sin(wob);
        const vx = (dx / dist) * ca - (dy / dist) * sa;
        const vy = (dx / dist) * sa + (dy / dist) * ca;
        this.moving = true;
        this.walkT += dt;
        this._moveWithCollision(vx * this.speed * dt, vy * this.speed * dt, world);
        if (dx > 2) this.face = 1; else if (dx < -2) this.face = -1;
        const k = Math.min(1, dt * 8);
        this.lookDir.x += (dx / dist - this.lookDir.x) * k;
        this.lookDir.y += (dy / dist - this.lookDir.y) * k;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 7)) {
                ctx.translate(cx, by);
                this._drawBody(ctx, true);
            }
            ctx.restore();
            return;
        }
        // Spinnenfaden beim Herablassen
        if (this.state === 'fall' && this.lift > 1) {
            ctx.strokeStyle = 'rgba(232,236,255,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, by - this.lift - 90);
            ctx.lineTo(cx, by - this.lift + 2);
            ctx.stroke();
            ctx.translate(0, -this.lift);
        }
        ctx.translate(cx, by);
        this._drawBody(ctx, false);
        ctx.restore();
    }

    // Mini-Spinne mit Fußpunkt (0, 0)
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face;
        const step = this.moving ? Math.sin(this.walkT * 16 + this.seed) : 0;
        const bodyY = -7 + (this.moving ? Math.abs(step) * 0.6 : 0);
        for (let s = -1; s <= 1; s += 2) {
            for (let i = 0; i < 3; i++) {
                const ph = this.walkT * 16 + i * 1.9 + (s > 0 ? 0 : Math.PI);
                const lift = this.moving ? Math.max(0, Math.sin(ph)) * 1.8 : 0;
                const kx = s * (5 + i * 0.9), ky = bodyY - 4 - i * 0.6;
                const fx = s * (7 + i * 1.7) + (this.moving ? Math.cos(ph) * 1.2 : 0);
                Art.limb(ctx, s * 1.4, bodyY - 1, kx, ky, 1.3, SpiderHideDark, { lineWidth: 0.8 });
                Art.limb(ctx, kx, ky, fx, -lift, 1.1, SpiderHideDark, { lineWidth: 0.8 });
            }
        }
        Art.body(ctx, -f * 3.5, bodyY - 4, 5.6, 4.8, SpiderHide, { lineWidth: 1.1 });
        ctx.fillStyle = SpiderVenom;
        ctx.beginPath();
        ctx.arc(-f * 4, bodyY - 6, 1.1, 0, TAU);
        ctx.moveTo(-f * 2 + 0.9, bodyY - 2.5);
        ctx.arc(-f * 2, bodyY - 2.5, 0.9, 0, TAU);
        ctx.fill();
        Art.body(ctx, f * 3.2, bodyY - 2.4, 3.8, 3.2, SpiderHead, { lineWidth: 1 });
        if (dead) LateWorldArt.xEyes(ctx, f * 4, bodyY - 3, 1, 1.7);
        else {
            ctx.fillStyle = SpiderVenom;
            ctx.beginPath();
            ctx.arc(f * 3.6, bodyY - 3.4, 1.1, 0, TAU);
            ctx.moveTo(f * 5.4 + 0.8, bodyY - 2.6);
            ctx.arc(f * 5.4, bodyY - 2.6, 0.8, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = '#f2ffd9';
        ctx.beginPath();
        ctx.moveTo(f * 5.6, bodyY - 0.6);
        ctx.lineTo(f * 7.2, bodyY - 0.6);
        ctx.lineTo(f * 6.5, bodyY + 1.8);
        ctx.closePath();
        ctx.fill();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 34: Riesenspinne ──
// ══════════════════════════════════════════

// Riesige, behaarte Höhlenspinne: schwarz-violetter Panzer, giftgrünes Muster, acht leuchtende Augen,
// gewaltige Giftzähne. Hitbox 76×64, Zeichnung ~150 breit und ~110 hoch.
// Ablauf Phase 1: Intro → laufen → Netzschuss → laufen → Riesengiftstrahl → schnaufen → …
// Phase 2 (halbe LP): Wut-Heulen, rote Augen, zwei Netze (Mark + ein Freund), kleine Spinnen von der
// Decke, der Strahl schwenkt weiter und schneller. Nach jedem großen Angriff schnauft sie kurz.
class BossGiantSpider extends Enemy {
    constructor(x, y) {
        super(x, y, 76, 64);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 36;
        this.damage = 1;
        // Kein Berührungsschaden: gefährlich sind Netze und Strahl. So kann man in der Schnaufpause
        // gefahrlos hauen (fair für Kinder).
        this.contactDamage = false;
        this.isBoss = true;
        this.fxColor = SpiderVenom;
        this.shadow = { rx: 44, ry: 13, dy: 26 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.face = -1;
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.state = 'intro';
        this.stateT = 2.0;
        this.stateDur = 2.0;
        this.seq = 0;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.snared = 0;            // > 0: gerade jemand eingesponnen → kurz warten
        this.kids = [];             // gerufene Mini-Spinnen (verpuffen beim Bosstod)
        // Netz-Ziele (Phase 2: zwei Netze)
        this.aim = [{ x: 0, y: 0, a: 0, len: 0 }, { x: 0, y: 0, a: 0, len: 0 }];
        this.nets = 1;
        // Strahl
        this.beamFrom = 0;
        this.beamTo = 0;
        this.beamA = 0;
        this.beamLen = 0;
        this.beamW = 44;
        this.beamHit = [];
        this.dropSpots = [];
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() {
        return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
    }

    // Maul in Weltkoordinaten (Netzabwurf und Strahlanfang)
    _mouth() {
        return { x: this.centerX() + this.face * 26, y: this.y + this.h - 44 };
    }

    _room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    // Eine Riesenspinne lässt sich kaum wegschubsen.
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.2);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.snared > 0) this.snared -= dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        // tote Mini-Spinnen aus der Liste werfen
        if (this.kids.length) this.kids = this.kids.filter(k => !k.dead);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - this.centerX(), dy = py - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) > 14 && this.state !== 'beam') this.face = dx > 0 ? 1 : -1;
        this._lookAt(dt, px, py);

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._toWalk();
                break;
            case 'walk':
                this._walk(dt, world, dx, dy, dist);
                if (this.stateT <= 0 && !player.dead) this._nextAttack(world, player);
                break;
            case 'netAim': {
                // Ziele bis kurz vor dem Wurf verfolgen (die letzten 0,3 s steht alles fest)
                if (this.stateT > 0.3) this._aimNets(world, player);
                if (this.stateT <= 0) {
                    this._throwNets(projectiles, world);
                    this._set('walk', this.phase === 2 ? 0.55 : 0.8);
                }
                break;
            }
            case 'beamCharge': {
                const m = this._mouth();
                if (this.stateT > 0.35) {
                    this.beamFrom = Math.atan2(py - m.y, px - m.x);
                    this.beamA = this.beamFrom;
                }
                this.beamLen = SpiderArt.rayLength(world, m.x, m.y, this.beamFrom, 460);
                if (this.stateT <= 0) this._startBeam(world);
                break;
            }
            case 'beam':
                this._updateBeam(dt, world, player);
                if (this.stateT <= 0) {
                    this.beamLen = 0;
                    this._set('pant', this.phase === 2 ? 0.85 : 1.2);
                }
                break;
            case 'dropKids':
                if (this.stateT <= 0) {
                    this._summonKids(world);
                    this._set('walk', 0.6);
                }
                break;
            default:            // pant, roar
                if (this.stateT <= 0) this._toWalk();
        }
    }

    _lookAt(dt, px, py) {
        const m = this._mouth();
        let tx = px, ty = py;
        if (this.state === 'beam' || this.state === 'beamCharge') {
            tx = m.x + Math.cos(this.beamA) * 100;
            ty = m.y + Math.sin(this.beamA) * 100;
        }
        const dx = tx - m.x, dy = ty - m.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    _toWalk() {
        if (this.phase === 2 && !this.roared) {
            // Wut beim Wechsel in Phase 2: Augen glühen rot, Beine stemmen sich (kein Angriff)
            this.roared = true;
            this._set('roar', 1.15);
            const x = this.centerX(), y = this.y + this.h - 60;
            SpiderArt.shake(6, 0.5);
            SpiderArt.burst(x, y, ['#ff2d4a', '#ffffff', SpiderVenom], 18, 190, 0.6, { kind: 'star' });
            SpiderArt.ring(x, this.y + this.h - 8, '#ff2d4a', 105, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.6, 0.9) : randRange(1.0, 1.4));
    }

    // Läuft auf Mark zu bis knapp vor Abstand, sonst seitwärts; bleibt im Boss-Raum (Engine klemmt zusätzlich)
    _walk(dt, world, dx, dy, d) {
        if (d < 84) return;
        let vx, vy;
        if (d > 150) {
            vx = dx / d; vy = dy / d;
        } else {
            this.strafeT = (this.strafeT || 0) - dt;
            if (this.strafeT <= 0) {
                this.strafe = -this.strafe;
                this.strafeT = randRange(0.9, 1.8);
            }
            vx = (-dy / d) * this.strafe + (dx / d) * 0.35;
            vy = (dx / d) * this.strafe + (dy / d) * 0.35;
        }
        const v = this.speed * (this.phase === 2 ? 1.25 : 1);
        this.walkT += dt;
        this.moving = true;
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * v * dt, vy * v * dt, world);
        if (Math.hypot(this.x - ox, this.y - oy) < v * dt * 0.3) this.strafe = -this.strafe;
    }

    _nextAttack(world, player) {
        // Ist gerade jemand eingesponnen, wartet die Spinne kurz – Fairness für Kinder
        if (this.snared > 0 || (player.stunTimer > 0)) {
            this.stateT = 0.15;
            return;
        }
        const n = this.seq++;
        if (this.phase === 1) {
            if (n % 2 === 0) this._startNet(world, player, 1);
            else this._startBeamCharge();
        } else if (n % 3 === 2 && this.kids.length < 3 && typeof Game !== 'undefined' && Game.bossActive) {
            this.dropSpots = this._pickDropSpots(world, player);
            this._set('dropKids', 0.7);
        } else if (n % 2 === 0) {
            this._startNet(world, player, 2);
        } else {
            this._startBeamCharge();
        }
    }

    // ── a) Netzschuss ──

    _startNet(world, player, count) {
        this.nets = count;
        this._aimNets(world, player);
        this._set('netAim', this.phase === 2 ? 0.8 : 0.95);
    }

    // Netz 0 fliegt auf Mark, Netz 1 auf einen Freund (sonst neben Mark). Ziele auf Raumbreite geklemmt.
    _aimNets(world, player) {
        const m = this._mouth();
        const room = this._room(world);
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        let friend = this.aim[1].friend;
        if (!friend || friend.dead || (friend.koTimer || 0) > 0) {
            friend = null;
            const opts = [];
            for (const c of SpiderArt.companions()) {
                const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                if (Math.hypot(cx - m.x, cy - m.y) > 430) continue;
                if (typeof Juri !== 'undefined' && !Juri.lineClear(world, m.x, m.y, cx, cy)) continue;
                opts.push(c);
            }
            if (opts.length) friend = opts[Math.floor(Math.random() * opts.length)];
        }
        this.aim[1].friend = friend;
        for (let i = 0; i < 2; i++) {
            const A = this.aim[i];
            let tx = px, ty = py;
            if (i === 1 && friend) {
                tx = friend.x + (friend.w || 20) / 2;
                ty = friend.y + (friend.h || 20) / 2;
            } else if (i === 1) {
                tx = px + 26;   // ohne Freund: daneben, damit die Bahn nicht doppelt gleich ist
                ty = py + 10;
            }
            let a = Math.atan2(ty - m.y, tx - m.x);
            let len = SpiderArt.rayLength(world, m.x, m.y, a, 420);
            let ex = m.x + Math.cos(a) * len, ey = m.y + Math.sin(a) * len;
            if (room) {
                ex = clamp(ex, room.x + 12, room.x + room.w - 12);
                ey = clamp(ey, room.y + 12, room.y + room.h - 12);
                a = Math.atan2(ey - m.y, ex - m.x);
                len = Math.hypot(ex - m.x, ey - m.y);
            }
            A.x = ex;
            A.y = ey;
            A.a = a;
            A.len = len;
        }
    }

    _throwNets(projectiles, world) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const m = this._mouth();
        SpiderArt.shake(3, 0.15);
        SpiderArt.burst(m.x, m.y, [SpiderWeb, SpiderVenom], 8, 120, 0.35, { kind: 'spark' });
        if (!list || list.length > 55) return;
        for (let i = 0; i < this.nets; i++) {
            list.push(new SpiderNet(this, m.x, m.y, this.aim[i].x, this.aim[i].y));
        }
    }

    // ── b) Riesengiftstrahl ──

    _startBeamCharge() {
        this._set('beamCharge', this.phase === 2 ? 1.0 : 1.2);
        this.beamHit = [];
        this.beamLen = 0;
    }

    _startBeam(world) {
        const swing = this.phase === 2 ? 0.85 : 0.55;
        this.beamTo = this.beamFrom + (Math.random() < 0.5 ? -swing : swing);
        // schwenkt gern zur Raummitte statt in die Wand
        const room = this._room(world);
        if (room) {
            const toMid = Math.atan2(room.y + room.h / 2 - this._mouth().y, room.x + room.w / 2 - this._mouth().x);
            let d = toMid - this.beamFrom;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            if (Math.abs(d) < swing) this.beamTo = this.beamFrom + d * 0.7;
        }
        this.beamA = this.beamFrom;
        this.beamW = this.phase === 2 ? 52 : 44;
        this.beamHit = [];
        this._set('beam', this.phase === 2 ? 1.3 : 1.5);
        SpiderArt.shake(5, 0.3);
        if (typeof Sound !== 'undefined' && Sound._play) {
            Sound._play(() => {
                Sound._tone('sawtooth', 140, 320, 0.6, 0.1, 0, 'lin');
                Sound._noiseBurst(0.7, 0.1, 'bandpass', 700);
            }, 'spiderBeam', 450);
        }
    }

    _beamAngle() {
        const k = clamp(this._k(), 0, 1);
        const e = k * k * (3 - 2 * k);
        return this.beamFrom + (this.beamTo - this.beamFrom) * e;
    }

    _updateBeam(dt, world, player) {
        const m = this._mouth();
        this.beamA = this._beamAngle();
        const full = SpiderArt.rayLength(world, m.x, m.y, this.beamA, 460);
        const grow = Math.min(1, (this.stateDur - this.stateT) / 0.12);
        this.beamLen = full * grow;
        if (typeof Game === 'undefined' || Game.world !== world) return;
        const x1 = m.x + Math.cos(this.beamA) * this.beamLen;
        const y1 = m.y + Math.sin(this.beamA) * this.beamLen;
        const half = this.beamW / 2;
        const P = Game.player;
        if (P && !P.dead && this.beamHit.indexOf(P) < 0) {
            const px = P.x + P.w / 2, py = P.y + P.h / 2;
            if (SpiderArt.segDist(px, py, m.x, m.y, x1, y1) <= half + P.w / 2) {
                this.beamHit.push(P);
                const before = P.hp;
                SpiderArt.hurt(P, 1, this.beamA, 230);
                if (P.applySlow) P.applySlow(1.4, 0.65);
                if (P.hp < before) SpiderArt.burst(px, py, [SpiderVenom, '#d9ffb0'], 10, 140, 0.4, { kind: 'spark' });
            }
        }
        for (const c of SpiderArt.companions()) {
            if (c.iFrames > 0 || this.beamHit.indexOf(c) >= 0) continue;
            const cw = c.w || 20, ch = c.h || 20;
            const cx = c.x + cw / 2, cy = c.y + ch / 2;
            if (SpiderArt.segDist(cx, cy, m.x, m.y, x1, y1) <= half + Math.max(cw, ch) / 2) {
                this.beamHit.push(c);
                SpiderArt.hitCompanion(c, 1);
                if (typeof c.stun === 'function') c.stun(1.2);
            }
        }
    }

    // ── c) Kleine Spinnen von der Decke (Phase 2) ──

    // Fallen für die Kleinen: freie Punkte im Boss-Raum, nicht zu nah an Mark und Boss (höchstens 2 je Wurf)
    _pickDropSpots(world, player) {
        const room = this._room(world);
        if (!room) return [];
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const out = [];
        const want = Math.min(3 - this.kids.length, randInt(1, 2));
        for (let n = 0; n < want; n++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 24 + Math.random() * (room.w - 48);
                const y = room.y + 24 + Math.random() * (room.h - 48);
                if (Math.hypot(x - px, y - py) < 80 || Math.hypot(x - this.centerX(), y - this.centerY()) < 55) continue;
                if (world.isWall(x - 8, y - 8) || world.isWall(x + 8, y + 8)) continue;
                let taken = false;
                for (const sp of out) if (Math.hypot(sp.x - x, sp.y - y) < 40) taken = true;
                if (taken) continue;
                out.push({ x, y });
                break;
            }
        }
        return out;
    }

    _summonKids(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || !Game.enemies) return;
        const spots = this.dropSpots;
        this.dropSpots = [];
        if (!spots || !spots.length) return;
        for (const sp of spots) {
            const kid = new SpiderKid(sp.x, sp.y);
            kid.summoner = this;
            this.kids.push(kid);
            Game.enemies.push(kid);
        }
        SpiderArt.burst(this.centerX(), this.y + this.h - 70, [SpiderWeb, '#c9c4e0'], 10, 110, 0.5, { kind: 'spark' });
    }

    // ── Bodenwarnungen (unter allen Figuren) ──

    drawUnder(ctx, camera) {
        if (this.dead) return;
        const m = this._mouth();
        const ms = camera.worldToScreen(m.x, m.y);
        const k = this._k();
        if (this.state === 'netAim') {
            const locked = this.stateT <= 0.3;
            const col = locked ? '#ff3d5a' : SpiderVenomDeep;
            for (let i = 0; i < this.nets; i++) {
                const A = this.aim[i];
                if (i === 1 && !this.aim[1].friend && this.nets > 1) continue;
                LateWorldArt.lane(ctx, ms.x, ms.y, A.a, Math.max(40, A.len), 30, k, col);
            }
        } else if (this.state === 'beamCharge') {
            const locked = this.stateT <= 0.35;
            LateWorldArt.lane(ctx, ms.x, ms.y, this.beamFrom, Math.max(60, this.beamLen), this.beamW, k, locked ? '#ff3d5a' : SpiderVenomDeep);
        } else if (this.state === 'beam' && this.beamLen > 4) {
            // der schwenkende grüne Strahl selbst (unter den Figuren)
            const fade = Math.min(1, this.stateT / 0.2, this._k() * 6);
            const x1 = ms.x + Math.cos(this.beamA) * this.beamLen;
            const y1 = ms.y + Math.sin(this.beamA) * this.beamLen;
            const prev = ctx.globalAlpha;
            ctx.lineCap = 'round';
            ctx.strokeStyle = SpiderVenomDeep;
            ctx.globalAlpha = prev * 0.28 * fade;
            ctx.lineWidth = this.beamW + 10;
            ctx.beginPath();
            ctx.moveTo(ms.x, ms.y);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.strokeStyle = SpiderVenom;
            ctx.globalAlpha = prev * 0.6 * fade;
            ctx.lineWidth = this.beamW;
            ctx.beginPath();
            ctx.moveTo(ms.x, ms.y);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.strokeStyle = '#eaffc0';
            ctx.globalAlpha = prev * (0.75 + 0.2 * Math.sin(Art.time * 22)) * fade;
            ctx.lineWidth = this.beamW * 0.36;
            ctx.beginPath();
            ctx.moveTo(ms.x, ms.y);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            // Spritzer vorn am Strahlende
            ctx.fillStyle = SpiderVenom;
            ctx.globalAlpha = prev * 0.5 * fade;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const a = this.beamA + (i - 1) * 0.5 + Math.sin(Art.time * 13 + i) * 0.2;
                const d = this.beamLen * (0.86 + i * 0.05);
                const sx = ms.x + Math.cos(a) * d, sy = ms.y + Math.sin(a) * d;
                ctx.moveTo(sx + 3, sy);
                ctx.arc(sx, sy, 3, 0, TAU);
            }
            ctx.fill();
            ctx.globalAlpha = prev;
        } else if (this.state === 'dropKids') {
            // helle Flecke, an denen die Kleinen an Fäden fallen werden
            for (const sp of this.dropSpots) {
                const p = camera.worldToScreen(sp.x, sp.y);
                LateWorldArt.warn(ctx, p.x, p.y, 16, k, SpiderWeb);
                ctx.strokeStyle = 'rgba(232,236,255,0.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - 110);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, by - 52);
        ctx.translate(cx, by);
        this._drawBody(ctx, this.dead);
        ctx.restore();
    }

    // Haltung aus dem Zustand (nur Darstellung): Beine, Höhe, Maul, Blasen, Leuchten
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, p2 = this.phase === 2, sd = this.seed;
        const st = dead ? 'dead' : this.state;
        const k = this._k();
        let hv = 0, lean = 0, liftFront = 0, jaw = 0.25, bubble = 0, legSpeed = 1;
        if (this.moving) {
            const step = Math.sin(this.walkT * 9 + sd);
            hv = Math.abs(step) * 2.2;
            lean = f * 0.04;
            legSpeed = p2 ? 1.5 : 1.15;
        } else {
            hv = Math.sin(t * 2.2 + sd) * 1.2;
        }
        if (st === 'intro') {
            liftFront = Math.sin(k * Math.PI) * 14;
            jaw = 0.8;
        } else if (st === 'netAim') {
            lean = -f * 0.05 * k;
            jaw = 0.5;
            liftFront = k * 6;
        } else if (st === 'beamCharge') {
            bubble = k;
            jaw = 0.5 + 0.5 * k;
            lean = -f * 0.06;
            hv -= 2 * k;
        } else if (st === 'beam') {
            bubble = 1;
            jaw = 1;
            lean = f * 0.05;
        } else if (st === 'pant') {
            const q = Math.sin(k * Math.PI * 2) * 0.5 + 0.5;
            hv += 2 + q * 2;
            jaw = 0.4 + q * 0.25;
        } else if (st === 'roar') {
            const e = Math.sin(k * Math.PI);
            liftFront = e * 20;
            jaw = 1;
            lean = -f * 0.06 * e;
        } else if (st === 'dropKids') {
            liftFront = Math.sin(k * Math.PI) * 8;
            jaw = 0.7;
        }
        const bodyY = -40 - hv;
        ctx.save();
        ctx.translate(0, 0);
        if (lean) {
            ctx.translate(0, -30);
            ctx.rotate(lean);
            ctx.translate(0, 30);
        }
        // Phase 2: rot glühende Aura
        if (p2 && !dead) Art.glow(ctx, 0, bodyY, 74, '#ff2d4a', 0.18 + 0.07 * Math.sin(t * 4));
        // acht behaarte Beine (hinten dunkler), beim Laufen hoch steigend
        for (let s = -1; s <= 1; s += 2) {
            for (let i = 0; i < 4; i++) {
                const ph = this.walkT * 9 * legSpeed + i * 1.5 + (s > 0 ? 0 : Math.PI);
                const lift = this.moving ? Math.max(0, Math.sin(ph)) * 7 : Math.sin(t * 2 + i) * 1.2;
                const swing = this.moving ? Math.cos(ph) * 5 : 0;
                const front = 1 - i * 0.32;
                const hx = s * 9 + f * (12 - i * 9);
                const hy = bodyY + 6 + i * 3;
                const kx = s * (30 + i * 3) + f * (9 - i * 7);
                const ky = bodyY - 22 - front * 10 - lift * 0.7;
                const fx = s * (40 + i * 7) + f * (5 - i * 5) + swing;
                const fy = -lift;
                const col = i > 1 || s < 0 ? SpiderHideDark : Art.mix(SpiderHide, '#150b26', 0.35);
                Art.limb(ctx, hx, hy, kx, ky, 7, col, { lineWidth: 2 });
                Art.limb(ctx, kx, ky, fx, fy, 4.6, col, { lineWidth: 1.6 });
                if (s > 0) {
                    // Haarbusch am Knie (Phase 2 Igelborsten)
                    ctx.strokeStyle = p2 ? '#4a2036' : '#503a70';
                    ctx.lineWidth = 1.1;
                    ctx.beginPath();
                    ctx.moveTo(kx - 3, ky - 1);
                    ctx.lineTo(kx - 6, ky - 5);
                    ctx.moveTo(kx + 2, ky - 2);
                    ctx.lineTo(kx + 1, ky - 7);
                    ctx.stroke();
                }
            }
        }
        // Vorderbeine beim Intro/Brüllen in die Höhe gestreckt
        if (liftFront > 1) {
            for (let s = -1; s <= 1; s += 2) {
                Art.limb(ctx, s * 12, bodyY + 2, s * 26 + f * 12, bodyY - 34 - liftFront, 6.5, SpiderHideDark, { lineWidth: 2 });
                Art.limb(ctx, s * 26 + f * 12, bodyY - 34 - liftFront, s * 34 + f * 14, bodyY - 52 - liftFront, 4.4, SpiderHideDark, { lineWidth: 1.6 });
            }
        }
        // Hinterteil (Hinterleib) groß hinten mit großem grünem Totenkopf-Muster
        const abdX = -f * 24, abdY = bodyY - 10;
        Art.body(ctx, abdX, abdY, 30, 26, SpiderHide, { lineWidth: 2.2, rot: lean });
        ctx.fillStyle = SpiderVenom;
        ctx.beginPath();
        ctx.moveTo(abdX - f * 4, abdY - 16);
        ctx.lineTo(abdX + f * 8, abdY - 6);
        ctx.lineTo(abdX + f * 2, abdY + 9);
        ctx.lineTo(abdX - f * 12, abdY + 2);
        ctx.closePath();
        ctx.moveTo(abdX - f * 18, abdY - 12);
        ctx.arc(abdX - f * 18, abdY - 12, 3.4, 0, TAU);
        ctx.moveTo(abdX - f * 6, abdY + 14);
        ctx.arc(abdX - f * 6, abdY + 14, 2.6, 0, TAU);
        ctx.fill();
        if (p2 && !dead) {
            // Risse im Panzer (Phase 2)
            ctx.strokeStyle = '#1c0e2c';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(abdX - f * 10, abdY - 20);
            ctx.lineTo(abdX - f * 4, abdY - 12);
            ctx.lineTo(abdX - f * 8, abdY - 4);
            ctx.moveTo(abdX + f * 12, abdY + 8);
            ctx.lineTo(abdX + f * 6, abdY + 16);
            ctx.stroke();
        }
        // vordere Beine (Kiefertaster)
        for (let s = -1; s <= 1; s += 2) {
            const reach = st === 'netAim' ? k : 0;
            Art.limb(ctx, f * 26, bodyY + 12, f * (38 + reach * 8), bodyY + 4 - reach * 10, 5, SpiderHideDark, { lineWidth: 1.6 });
        }
        // Kopf/Panzer vorn
        const hx = f * 16, hy = bodyY + 2;
        Art.body(ctx, hx, hy, 21, 17, SpiderHead, { lineWidth: 2.2 });
        // acht leuchtende Augen: zwei große vorn + sechs kleine
        const eyeGlow = p2 ? '#ff2d4a' : SpiderVenom;
        if (!dead) {
            Art.glow(ctx, hx + f * 5, hy - 3, 17 + bubble * 6, eyeGlow, 0.35 + (p2 ? 0.2 : 0.08) + 0.1 * Math.sin(t * 3 + sd));
        }
        if (dead) {
            LateWorldArt.xEyes(ctx, hx + f * 6, hy - 2, 3, 5.5);
        } else {
            Art.eyes(ctx, hx + f * 6, hy - 2, 4, { gap: 5, look: this.look, angry: true, iris: p2 ? '#ff2d4a' : '#5ecf1c', sclera: p2 ? '#2a0612' : '#1d2b12', pupil: p2 ? '#ffd23f' : '#0c1608', seed: sd });
            ctx.fillStyle = eyeGlow;
            ctx.beginPath();
            ctx.arc(hx - f * 1, hy - 10, 2, 0, TAU);
            ctx.moveTo(hx + f * 6 + 1.8, hy - 11.4);
            ctx.arc(hx + f * 6, hy - 11.4, 1.8, 0, TAU);
            ctx.moveTo(hx + f * 13 + 1.6, hy - 10);
            ctx.arc(hx + f * 13, hy - 10, 1.6, 0, TAU);
            ctx.moveTo(hx - f * 3 + 1.4, hy + 1);
            ctx.arc(hx - f * 3, hy + 1, 1.4, 0, TAU);
            ctx.moveTo(hx + f * 14 + 1.3, hy + 2);
            ctx.arc(hx + f * 14, hy + 2, 1.3, 0, TAU);
            ctx.moveTo(hx + f * 1, hy + 4.5);
            ctx.arc(hx + f * 1, hy + 4.5, 1.2, 0, TAU);
            ctx.fill();
            // zornige Braue
            ctx.strokeStyle = Art.ink(SpiderHead);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(hx + f * 1, hy - 8);
            ctx.lineTo(hx + f * 12, hy - 5);
            ctx.stroke();
        }
        // Kiefer (Cheliceren) mit Giftzähnen; beim Aufladen weichen die Klappen zurück
        const jx = hx + f * 15, jy = hy + 10;
        const open = jaw * 7;
        Art.body(ctx, jx, jy - 2 - open * 0.3, 6.5, 5.5, SpiderHideDark, { lineWidth: 1.6 });
        if (open > 1) {
            ctx.fillStyle = '#20102e';
            ctx.beginPath();
            ctx.ellipse(jx + f * 1, jy + 2, 5, 1.5 + open * 0.5, 0, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = '#f2ffd9';
        ctx.strokeStyle = Art.ink(SpiderHideDark);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const o of [-2.5, 4]) {
            const fx2 = jx + f * o;
            ctx.moveTo(fx2 - 2, jy + 4);
            ctx.lineTo(fx2 + 2, jy + 4);
            ctx.lineTo(fx2 + (o > 0 ? f * 2 : 0), jy + 11 + open);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
        // Giftblasen am Maul während des Aufladens
        if (bubble > 0.05 && !dead) {
            Art.glow(ctx, jx + f * 2, jy + 2, 8 + bubble * 12, SpiderVenom, 0.3 + bubble * 0.35);
            ctx.fillStyle = SpiderVenom;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = t * 5 + i * 1.7;
                const r = (1.5 + i * 0.9) * bubble * (1 + 0.2 * Math.sin(a));
                const bx = jx + f * (4 + Math.sin(a) * 4 + i * 1.5);
                const byy = jy + 2 - ((t * 26 + i * 9) % 18) * bubble;
                ctx.moveTo(bx + r, byy);
                ctx.arc(bx, byy, Math.max(0.4, r), 0, TAU);
            }
            ctx.fill();
        }
        ctx.restore();
    }
}
