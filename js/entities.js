// ── Entities (Enemies) ──

class Enemy {
    constructor(x, y, w, h) {
        this.x = x - w / 2;
        this.y = y - h / 2;
        this.w = w;
        this.h = h;
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 60;
        this.damage = 1; // 1/4 heart
        this.dead = false;
        this.deathTimer = 0;
        this.iFrames = 0;
        this.knockbackVx = 0;
        this.knockbackVy = 0;
        this.phasesThroughWalls = false;
        this.contactDamage = true;
    }

    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }
    center() { return { x: this.centerX(), y: this.centerY() }; }
    rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
    isFlashing() { return this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2; }
    deathProgress() { return 1 - this.deathTimer / 0.4; }

    takeDamage(amount, knockbackAngle, knockbackForce) {
        if (this.iFrames > 0 || this.dead) return;
        this.hp -= amount;
        this.iFrames = 0.2;
        this.hitFlash = 0.12;
        if (typeof FX !== 'undefined' && amount > 0) {
            FX.text(this.centerX(), this.y - 2, Math.round(amount * 10) / 10, this.isBoss ? '#ffd23f' : '#ffffff', this.isBoss ? 13 : 10);
        }
        if (knockbackAngle !== undefined && knockbackForce) {
            this.knockbackVx = Math.cos(knockbackAngle) * knockbackForce;
            this.knockbackVy = Math.sin(knockbackAngle) * knockbackForce;
        }
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.deathTimer = 0.4;
        }
    }

    baseUpdate(dt, world) {
        if (this.iFrames > 0) this.iFrames -= dt;
        // Steckt ein Gegner (z. B. nach einem Ansturm) in einer Wand, befreien statt durchschieben
        if (!this.phasesThroughWalls && world && world.collideRect) escapeFromWalls(this, world);

        // Apply knockback (klingt pro Zeit ab, nicht pro Bild – gleich auf 60- und 120-Hz-Handys)
        if (Math.abs(this.knockbackVx) > 1 || Math.abs(this.knockbackVy) > 1) {
            if (!this.phasesThroughWalls) {
                this._moveWithCollision(this.knockbackVx * dt, this.knockbackVy * dt, world);
            } else {
                this.x += this.knockbackVx * dt;
                this.y += this.knockbackVy * dt;
            }
            const damp = Math.exp(-9.75 * dt);
            this.knockbackVx *= damp;
            this.knockbackVy *= damp;
        }
    }

    _moveWithCollision(dx, dy, world) {
        moveWithCollision(this, dx, dy, world);
    }
}

// ══════════════════════════════════════════
// ── Welt 1: Geisterschloss ──
// ══════════════════════════════════════════

// ── Geist: bunter Luftballon-Geist ──
class Ghost extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 55;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.bobOffset = Math.random() * TAU;
        this.hue = randInt(180, 340); // bunt: türkis, blau, lila, pink
        this.color = `hsl(${this.hue}, 90%, 66%)`;
        this.fxColor = this.color;
        this.glowColor = null;
        this.detectionRange = 200;
        this.chasing = false;
        this.t = Math.random() * 10; // eigene Uhr statt Wanduhr (G-22)
        this.lookDir = { x: 0, y: 0.3 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.chasing = dist < this.detectionRange;
        if (this.chasing) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        } else {
            // Schweben im Leerlauf
            this.x += Math.sin(this.t + this.bobOffset) * 15 * dt;
            this.y += Math.cos(this.t * 1.25 + this.bobOffset) * 10 * dt;
        }
        this._look(dx / dist, dy / dist, dt);
    }

    // Blickrichtung sanft nachführen (nur Darstellung)
    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.lookDir.x += ((this.chasing ? nx : 0) - this.lookDir.x) * k;
        this.lookDir.y += ((this.chasing ? ny : 0.3) - this.lookDir.y) * k;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const s = this.w / 24; // Schlüssel-Geist ist etwas größer
        const t = Art.time;
        const seed = this.bobOffset;
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h / 2 + Math.sin(t * 3.3 + seed) * 2.4);
        if (this.dead) {
            // Ballon-Plopp: ganz kurz aufblähen, dann platzen
            const k = this.deathProgress();
            if (k >= 0.2) {
                this._drawPop(ctx, s, (k - 0.2) / 0.8);
                ctx.restore();
                return;
            }
            ctx.scale(1 + k * 1.6, 1 + k * 1.3);
        }
        if (this.glowColor) Art.glow(ctx, 0, 0, 26 * s, this.glowColor, 0.5);
        Art.glow(ctx, 0, 0, 19 * s, this.color, 0.22);
        ctx.scale(s, s);
        Art.shape(ctx, c => {
            c.moveTo(-11.5, 6);
            c.arc(0, -1.5, 11.5, Math.PI, 0);
            c.lineTo(11.5, 6);
            for (let i = 0; i < 3; i++) {
                const x0 = 11.5 - i * 7.667;
                c.quadraticCurveTo(x0 - 3.83, 13.5 + Math.sin(t * 6 + i * 1.9 + seed) * 1.4, x0 - 7.667, 6);
            }
            c.closePath();
        }, { x: -11.5, y: -13, w: 23, h: 27 }, this.color, { glossy: true });
        Art.shine(ctx, -5, -7.5, 3, 4.6, -0.45, 0.55);
        Art.shine(ctx, -0.6, -10.8, 1.1, 1.1, 0, 0.75);
        Art.eyes(ctx, 0, -1.5, 3.6, { look: this.lookDir, seed, gap: 4.7 });
        Art.mouth(ctx, 0, 5, 5.2, this.dead ? 'o' : (this.chasing ? 'open' : 'smile'));
        Art.blush(ctx, 0, 3.4, 2.3, 7.6);
        ctx.restore();
    }

    // Geplatzter Ballon: Fetzen fliegen weg, weißer Ring (q = 0..1)
    _drawPop(ctx, s, q) {
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (1 - q);
        Art.ring(ctx, 0, 0, (10 + q * 18) * s, '#ffffff', 2.6 * (1 - q) + 0.5);
        ctx.fillStyle = this.color;
        for (let i = 0; i < 6; i++) {
            const a = (i * TAU) / 6 + this.bobOffset;
            const d = (6 + q * 22) * s;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 3.2 * s * (1 - q * 0.5), 1.6 * s, a + q * 4, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = a0;
    }
}

// ── Schlüssel-Geist: goldener Ballon-Geist mit Schlüssel ──
class KeyGhost extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 70;
        this.hue = 45; // golden
        this.color = '#ffc93c';
        this.fxColor = '#ffd23f';
        this.glowColor = '#ffe066';
        this.w = 28;
        this.h = 28;
        this.detectionRange = 250;
        this.isKeyGhost = true;
        this.droppedKey = false;
        this.phasesThroughWalls = false; // Schlüssel darf nicht in der Wand landen
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.chasing = dist < this.detectionRange;
        if (this.chasing) this._moveWithCollision((dx / dist) * this.speed * dt, (dy / dist) * this.speed * dt, world);
        this._look(dx / dist, dy / dist, dt);
    }

    draw(ctx, camera) {
        super.draw(ctx, camera);
        if (this.dead) return;
        const p = camera.worldToScreen(this.centerX(), this.y);
        KeyGhost.drawKeyMarker(ctx, p.x, p.y - 8 + Math.sin(Art.time * 3.3 + this.bobOffset) * 2.4, this.bobOffset);
    }

    // Schlüssel-Zeichen über Schlüsselträgern (auch Ei und Schlüssel-Ritter)
    static drawKeyMarker(ctx, x, y, seed) {
        const t = Art.time;
        const yy = y + Math.sin(t * 2.4 + seed) * 1.2;
        Art.glow(ctx, x, yy, 13, '#ffe066', 0.55);
        ctx.save();
        ctx.translate(x, yy);
        ctx.rotate(Math.sin(t * 2.2 + seed) * 0.2);
        Art.key(ctx, -1.8, 0, 6, '#ffd23f');
        ctx.restore();
        Art.sparkle(ctx, x + 7, yy - 5, 2.6, '#ffffff', 0.55 + 0.45 * Math.sin(t * 5 + seed));
    }
}

// ── Boss Welt 1: König Geist ──
class BossGhost extends Enemy {
    constructor(x, y) {
        super(x, y, 80, 80);
        this.hp = 40;
        this.maxHp = 40;
        this.speed = 40;
        this.damage = 2; // halbes Herz
        this.phasesThroughWalls = true;
        this.flying = true;
        this.isBoss = true;
        this.contactDamage = false; // trifft per Klatschen, nicht per Berührung
        this.phase = 1;
        this.fxColor = '#5fe08a';

        // Angriffe
        this.clapTimer = 0;
        this.clapCooldown = 3;
        this.clapping = false;
        this.clapProgress = 0;
        this.clapDuration = 1.4;
        this.clapDamageDealt = false;
        this.clapRange = 130; // weiter Klatsch-Kreis

        this.spawnTimer = 8;
        this.spawnCooldown = 8;
        this.minions = [];
        this.maxMinions = 8; // G-09: höchstens so viele Mini-Geister gleichzeitig

        this.state = 'intro'; // intro, chase, clap, stunned
        this.introTimer = 2;
        this.stunnedTimer = 0;
        this.impactT = 0;
        this.lookDir = { x: 0, y: 0.4 };
    }

    update(dt, world, player, enemies) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.impactT > 0) this.impactT -= dt;

        // Phase 2: schneller, ruft öfter Geister
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.speed = 60;
            this.spawnCooldown = 5;
        }

        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        const kl = Math.min(1, dt * 6);
        this.lookDir.x += (dx / dist - this.lookDir.x) * kl;
        this.lookDir.y += (dy / dist - this.lookDir.y) * kl;

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) this.state = 'chase';
            return;
        }

        if (this.state === 'clap') {
            this.clapProgress += dt;
            // Einschlag nach 0,7 s (vorher Warnkreis): Schaden im weiten Kreis
            if (this.clapProgress >= 0.7 && !this.clapDamageDealt) {
                this.clapDamageDealt = true;
                if (dist < this.clapRange) player.takeDamage(this.damage + 1, Math.atan2(dy, dx), 350);
                this.impactT = 0.35;
                if (typeof FX !== 'undefined') {
                    FX.ring(mx, my, '#fff3a0', this.clapRange, 0.45, 6);
                    FX.burst(mx, my + 12, ['#fff3a0', '#9dffb8', '#ffffff'], 14, 170, 0.5, { kind: 'spark' });
                }
                if (typeof Game !== 'undefined' && Game.camera) Game.camera.shake(5, 0.25);
            }
            if (this.clapProgress >= this.clapDuration) {
                this.state = 'stunned';
                this.stunnedTimer = 1.8;
                this.clapProgress = 0;
                this.clapping = false;
            }
            return;
        }

        // Verfolgen
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;

        // Klatschen: startet schon auf größere Entfernung
        this.clapTimer -= dt;
        if (this.clapTimer <= 0 && dist < 200) {
            this.state = 'clap';
            this.clapping = true;
            this.clapProgress = 0;
            this.clapDamageDealt = false;
            this.clapTimer = this.clapCooldown;
        }

        // Mini-Geister rufen – nur so viele, dass höchstens maxMinions leben (G-09)
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = this.spawnCooldown;
            this.minions = this.minions.filter(m => !m.dead);
            const count = Math.min(this.phase === 1 ? 2 : 3, this.maxMinions - this.minions.length);
            for (let i = 0; i < count; i++) {
                const a = (TAU * i) / count;
                const g = new Ghost(mx + Math.cos(a) * 60, my + Math.sin(a) * 60);
                g.hp = 2;
                g.maxHp = 2;
                g.detectionRange = 300;
                if (enemies) enemies.push(g);
                this.minions.push(g);
                if (typeof FX !== 'undefined') FX.burst(g.centerX(), g.centerY(), ['#d9ffe4', '#ffffff'], 6, 70, 0.45, { kind: 'smoke', size: 4 });
            }
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const cx = p.x + this.w / 2;
        const t = Art.time;
        const cy = p.y + this.h / 2 + Math.sin(t * 2.5) * 5;
        const rage = this.hp <= this.maxHp / 2;
        const clapK = this.state === 'clap' ? this.clapProgress / this.clapDuration : -1;
        const dizzy = this.state === 'stunned' || this.dead;
        const base = rage ? '#8fe04e' : '#5fe08a';
        const body = dizzy ? Art.light(base, 0.28) : base;

        // Warnkreis bis zum Einschlag
        if (clapK >= 0 && clapK < 0.5) BossGhost.drawWarnZone(ctx, cx, p.y + this.h / 2, this.clapRange, clapK / 0.5);

        ctx.save();
        ctx.translate(cx, cy);
        if (this.dead) {
            const k = this.deathProgress();
            ctx.translate(Math.sin(t * 47) * 1.6, 0);
            ctx.scale(1 - k * 0.7, 1 - k * 0.7);
        }
        Art.glow(ctx, 0, 6, 72, rage ? '#ff5a4d' : '#6dffa0', rage ? 0.3 + 0.1 * Math.sin(t * 6) : 0.18);

        // Hände: ausholen, zusammenklatschen, zurück
        let spread = 55 + Math.sin(t * 1.7) * 6;
        let handY = 12 + Math.sin(t * 2.1) * 3;
        let rot = Math.sin(t * 1.25) * 0.15;
        let charge = 0;
        if (clapK >= 0) {
            if (clapK < 0.3) {
                const q = clapK / 0.3;
                spread = 55 + q * 32; handY = 12 - q * 12; charge = q; rot = -0.3 * q;
            } else if (clapK < 0.5) {
                const q = (clapK - 0.3) / 0.2;
                spread = 87 - q * q * 67; handY = q * 12; charge = 1; rot = -0.3 + q * 0.3;
            } else if (clapK < 0.62) {
                spread = 20; handY = 12; rot = 0;
            } else {
                spread = 20 + ((clapK - 0.62) / 0.38) * 35; handY = 12; rot = 0;
            }
        } else if (dizzy) {
            spread = 58; handY = 28; rot = 0.6;
        }

        // Königsmantel hinter dem Körper
        const wv = Math.sin(t * 3) * 3;
        Art.shape(ctx, c => {
            c.moveTo(-28, 4);
            c.quadraticCurveTo(-48, 24, -46 + wv, 48);
            c.quadraticCurveTo(-24, 42, 0, 50);
            c.quadraticCurveTo(24, 42, 46 - wv, 48);
            c.quadraticCurveTo(48, 24, 28, 4);
            c.closePath();
        }, { x: -48, y: 4, w: 96, h: 46 }, '#e8364f', { lineWidth: 2.2 });

        // Körper: Kuppel mit fünf Zipfeln
        Art.shape(ctx, c => {
            c.moveTo(-37, 22);
            c.arc(0, -4, 37, Math.PI, 0);
            c.lineTo(37, 22);
            for (let i = 0; i < 5; i++) {
                const x0 = 37 - i * 14.8;
                c.quadraticCurveTo(x0 - 7.4, 42 + Math.sin(t * 5 + i * 1.3) * 3, x0 - 14.8, 22);
            }
            c.closePath();
        }, { x: -37, y: -41, w: 74, h: 84 }, body, { glossy: true, lineWidth: 2.4 });
        Art.shine(ctx, -17, -24, 8, 12, -0.5, 0.42);
        Art.shine(ctx, -7, -34, 2.6, 2.6, 0, 0.6);

        // Hermelinkragen mit Tupfen
        Art.shape(ctx, c => {
            c.moveTo(-36, 10);
            c.quadraticCurveTo(0, 21, 36, 10);
            c.quadraticCurveTo(40, 15, 35, 20);
            c.quadraticCurveTo(0, 31, -35, 20);
            c.quadraticCurveTo(-40, 15, -36, 10);
            c.closePath();
        }, { x: -40, y: 10, w: 80, h: 21 }, '#fff6ea', { lineWidth: 2 });
        ctx.fillStyle = '#3a2a55';
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
            const ex = i * 13;
            const ey = 21 - Math.abs(i) * 1.6;
            ctx.moveTo(ex + 1.5, ey);
            ctx.ellipse(ex, ey, 1.5, 2.2, 0, 0, TAU);
        }
        ctx.fill();

        // Gesicht
        const fy = -14;
        if (dizzy) BossGhost.drawDizzyEyes(ctx, 0, fy, 8.5, 13.5);
        else Art.eyes(ctx, 0, fy, 8.5, { look: this.lookDir, angry: true, gap: 13.5, iris: rage ? '#ff3b3b' : '#ffb627', seed: 1.3 });
        let mouth = rage ? 'teeth' : 'angry';
        if (dizzy) mouth = 'o';
        else if (clapK >= 0 && clapK < 0.55) mouth = 'open';
        Art.mouth(ctx, 0, fy + 18, rage ? 20 : 15, mouth);
        Art.blush(ctx, 0, fy + 11, 5, 22, rage ? '#ff3b3b' : '#ff7aa8');
        BossGhost.drawCrown(ctx, 0, -36, dizzy ? -0.42 : (rage ? -0.2 : Math.sin(t * 2.5 + 1) * 0.05), 1);

        // Hände vor dem Körper
        this._drawHand(ctx, -spread, handY, -1, rot, charge, body);
        this._drawHand(ctx, spread, handY, 1, rot, charge, body);
        if (this.impactT > 0) Art.glow(ctx, 0, 12, 46, '#fff6b0', this.impactT / 0.35);

        if (dizzy) BossGhost.drawStunStars(ctx, 0, -66, 30, 4, 0);
        else if (clapK >= 0 && clapK < 0.32) BossGhost.drawAlert(ctx, 0, -76 + Math.sin(t * 18) * 1.5, 1.3);
        ctx.restore();
    }

    // Goldene Krone (Ursprung = Mitte der Unterkante), auch für König Schleim
    static drawCrown(ctx, x, y, rot, s) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(s, s);
        Art.shape(ctx, c => {
            c.moveTo(-17, 0);
            c.lineTo(-20, -20);
            c.lineTo(-9, -10);
            c.lineTo(0, -25);
            c.lineTo(9, -10);
            c.lineTo(20, -20);
            c.lineTo(17, 0);
            c.closePath();
        }, { x: -20, y: -25, w: 40, h: 25 }, '#ffcf3a', { glossy: true, lineWidth: 2 });
        Art.box(ctx, -18, -8, 36, 8, 3, '#ffb81f', { lineWidth: 1.6 });
        Art.gem(ctx, 0, -4, 3.6, '#ff4d6d');
        Art.gem(ctx, -10, -4, 2.6, '#39d5ff');
        Art.gem(ctx, 10, -4, 2.6, '#39d5ff');
        Art.body(ctx, -20, -20, 2.8, 2.8, '#fff1a8', { highlight: false });
        Art.body(ctx, 0, -25, 3.2, 3.2, '#fff1a8', { highlight: false });
        Art.body(ctx, 20, -20, 2.8, 2.8, '#fff1a8', { highlight: false });
        ctx.restore();
    }

    // Geisterhand als Fäustling; dir = -1 links, 1 rechts; charge = Aufladen vor dem Klatschen
    _drawHand(ctx, x, y, dir, rot, charge, color) {
        if (charge > 0) Art.glow(ctx, x, y, 30, '#fff27a', 0.3 + charge * 0.45);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.rotate(rot);
        const hand = Art.light(color, 0.2);
        Art.body(ctx, -7, -10, 5, 7.5, hand, { rot: -0.45, highlight: false });
        Art.body(ctx, 0, 0, 15, 12.5, hand, { glossy: true, lineWidth: 2 });
        ctx.strokeStyle = Art.ink(hand);
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(8, -5); ctx.lineTo(13.5, -5.5);
        ctx.moveTo(9.5, 1); ctx.lineTo(15, 1);
        ctx.moveTo(8, 7); ctx.lineTo(12.5, 7.5);
        ctx.stroke();
        ctx.restore();
    }

    // ── Gemeinsame Helfer der Bosse und Helfer-Spawns (Welt 1–4, 11, 12) ──

    // Freier Platz für ein Wesen (w × h) im Abstand dist um (cx, cy), sonst die Mitte selbst (G-08)
    static freeSpot(world, cx, cy, w, h, dist, a0) {
        if (world && world.collideRect) {
            for (let i = 0; i < 8; i++) {
                const a = a0 + (i * TAU) / 8;
                const x = cx + Math.cos(a) * dist;
                const y = cy + Math.sin(a) * dist;
                if (!world.collideRect({ x: x - w / 2, y: y - h / 2, w, h }).length) return { x, y };
            }
        }
        return { x: cx, y: cy };
    }

    // Zielpunkt so begrenzen, dass ein Boss (halbe Größe hw × hh) ganz in den Boss-Raum passt
    static clampToRoom(world, pt, hw, hh) {
        const room = typeof Game !== 'undefined' && Game.world === world && typeof Game._bossRoomRect === 'function'
            ? Game._bossRoomRect() : null;
        if (room) {
            pt.x = clamp(pt.x, room.x + hw, Math.max(room.x + hw, room.x + room.w - hw));
            pt.y = clamp(pt.y, room.y + hh, Math.max(room.y + hh, room.y + room.h - hh));
        }
        return pt;
    }

    // Warnkreis am Boden; k = 0..1 bis zum Einschlag (der innere Ring füllt den Kreis)
    static drawWarnZone(ctx, x, y, r, k) {
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (0.14 + 0.14 * k);
        ctx.fillStyle = '#ff2e4d';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a0;
        Art.ring(ctx, x, y, r, '#ff4d63', 2.6, 0.65 + 0.35 * Math.sin(Art.time * 16));
        Art.ring(ctx, x, y, Math.max(1, r * k), '#ffe0e4', 1.8, 0.85);
    }

    // Sterne kreisen über dem Kopf (betäubt)
    static drawStunStars(ctx, x, y, rx, n, seed) {
        for (let i = 0; i < n; i++) {
            const a = Art.time * 3.4 + seed + (i * TAU) / n;
            Art.star(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * rx * 0.28, 4.6, '#ffe14d', { lineWidth: 1.2 });
        }
    }

    // Ausrufezeichen-Blase: gleich kommt ein Angriff
    static drawAlert(ctx, x, y, s) {
        Art.body(ctx, x, y, 6.5 * s, 7.5 * s, '#ffe14d', { outline: '#8a2b00', lineWidth: 1.4, highlight: false });
        ctx.fillStyle = '#c0162e';
        ctx.beginPath();
        ctx.roundRect(x - 1.3 * s, y - 5 * s, 2.6 * s, 6.2 * s, 1.3 * s);
        ctx.moveTo(x + 1.5 * s, y + 3.6 * s);
        ctx.arc(x, y + 3.6 * s, 1.5 * s, 0, TAU);
        ctx.fill();
    }

    // Kringel-Augen (schwindelig oder besiegt)
    static drawDizzyEyes(ctx, x, y, r, gap) {
        ctx.lineCap = 'round';
        for (let side = -1; side <= 1; side += 2) {
            const ex = x + side * gap;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = Math.max(0.8, r * 0.22);
            ctx.beginPath();
            ctx.ellipse(ex, y, r, r * 1.08, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            const rot = Art.time * 7 * side;
            for (let i = 0; i <= 12; i++) {
                const a = rot + i * 0.8;
                const rr = (r * 0.8 * i) / 12;
                if (i === 0) ctx.moveTo(ex + Math.cos(a) * rr, y + Math.sin(a) * rr);
                else ctx.lineTo(ex + Math.cos(a) * rr, y + Math.sin(a) * rr);
            }
            ctx.stroke();
        }
    }
}

// ══════════════════════════════════════════
// ── Welt 2: Maschinen-Hof ──
// ══════════════════════════════════════════

// ── Roboter-Küken: weißes Blech, roter Kamm, LED-Auge ──
class RoboChick extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 30);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 45;
        this.damage = 1;
        this.detectionRange = 250;
        this.shootTimer = 0.6; // erster Schuss mit Ankündigung
        this.shootCooldown = 2;
        this.spawnTimer = 10;
        this.spawnCooldown = 10;
        this.legAnim = 0;
        this.minis = []; // eigene Mini-Küken (G-09)
        this.active = false;
        this.seed = Math.random() * 10;
        this.fxColor = '#ff8a3d';
        this.lookDir = { x: 1, y: 0 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.active = dist < this.detectionRange;
        if (!this.active) return;
        const nx = dx / dist;
        const ny = dy / dist;
        this.lookDir.x = nx;
        this.lookDir.y = ny;
        this._moveWithCollision(nx * this.speed * dt * 0.5, ny * this.speed * dt * 0.5, world);
        this.legAnim += dt * 4;

        // Schießen
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && projectiles) {
            this.shootTimer = this.shootCooldown;
            projectiles.push(new Projectile(mx, my, nx * 180, ny * 180, 1, 'enemy', 80));
        }

        // Mini-Küken: höchstens 2 eigene gleichzeitig (G-09), nur auf freiem Boden (G-08)
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && enemies) {
            this.spawnTimer = this.spawnCooldown;
            this.minis = this.minis.filter(m => !m.dead);
            if (this.minis.length < 2) {
                const spot = BossGhost.freeSpot(world, mx, my, 18, 18, 30, Math.random() * TAU);
                const m = new MiniRoboChick(spot.x, spot.y);
                enemies.push(m);
                this.minis.push(m);
            }
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const face = this.lookDir.x < 0 ? -1 : 1;
        const walk = this.active ? Math.sin(this.legAnim * 2.2) : 0;
        const aim = this.active && this.shootTimer < 0.35 && !this.dead; // gleich kommt ein Schuss
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h / 2);
        if (this.dead) {
            const k = this.deathProgress();
            const g = Math.max(0.01, k < 0.2 ? 1 + k : 1.2 - (k - 0.2) * 1.5);
            ctx.rotate(k * 2.5 * face);
            ctx.scale(g, g);
        }
        ctx.scale(face, 1);
        const metal = '#8d98ad';
        // Metallbeine mit Füßen
        Art.limb(ctx, -5, 6, -5 - walk * 3, 15, 2.4, metal);
        Art.limb(ctx, 4, 6, 4 + walk * 3, 15, 2.4, metal);
        Art.body(ctx, -3.5 - walk * 3, 15.5, 3.6, 1.8, '#ff9f1c', { highlight: false });
        Art.body(ctx, 5.5 + walk * 3, 15.5, 3.6, 1.8, '#ff9f1c', { highlight: false });
        ctx.translate(0, this.active ? -Math.abs(walk) * 1.5 : Math.sin(t * 2 + this.seed) * 0.8);
        // Kamm (hinter dem Kopf)
        Art.body(ctx, -5, -10.5, 3.2, 3.6, '#ff4b4b');
        Art.body(ctx, 0.5, -12.5, 3.6, 4, '#ff4b4b');
        Art.body(ctx, 5.5, -11, 3.2, 3.6, '#ff4b4b');
        // Blechkörper mit Naht, Nieten und Bauchlampe
        Art.body(ctx, 0, 0, 12.5, 11, '#eef2f8', { glossy: true });
        ctx.strokeStyle = 'rgba(96,108,140,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -2, 10.5, 0.55, Math.PI - 0.55);
        ctx.stroke();
        ctx.fillStyle = '#9aa6bb';
        ctx.beginPath();
        ctx.moveTo(-6.9, 6.5);
        ctx.arc(-8, 6.5, 1.1, 0, TAU);
        ctx.moveTo(8.1, 6.5);
        ctx.arc(7, 6.5, 1.1, 0, TAU);
        ctx.fill();
        Art.glow(ctx, 2, 5.5, 5, '#ffd84a', 0.5);
        Art.body(ctx, 2, 5.5, 2.2, 2.2, '#ffd84a', { lineWidth: 1 });
        // Flügel-Blech (schlägt beim Laufen)
        ctx.save();
        ctx.translate(-4, 0);
        ctx.rotate(-0.25 + walk * 0.35);
        Art.shape(ctx, c => {
            c.moveTo(3, -4);
            c.quadraticCurveTo(-6, -5, -10, 1);
            c.quadraticCurveTo(-4, 5, 3, 3);
            c.closePath();
        }, { x: -10, y: -5, w: 13, h: 10 }, '#cfd7e6', { lineWidth: 1.3 });
        ctx.restore();
        // Visier mit LED-Auge (leuchtet vor dem Schuss hell auf)
        Art.box(ctx, 1, -7, 11.5, 6.5, 3, '#2b3350', { highlight: false });
        const ey = -3.8 + this.lookDir.y * 1.2;
        Art.glow(ctx, 8, ey, aim ? 14 : 6, '#ff3b30', aim ? 0.95 : 0.55);
        ctx.fillStyle = aim ? '#fff1ec' : '#ff5a4f';
        ctx.beginPath();
        ctx.arc(8, ey, aim ? 2.5 : 1.9, 0, TAU);
        ctx.fill();
        // Schnabel (klappt vor dem Schuss auf)
        if (aim) {
            ctx.fillStyle = '#3a0d1e';
            ctx.beginPath();
            ctx.ellipse(13, 2.6, 4, 2.4, 0, 0, TAU);
            ctx.fill();
            Art.shape(ctx, c => {
                c.moveTo(10.5, 3.5);
                c.quadraticCurveTo(15, 4.5, 18, 6.5);
                c.quadraticCurveTo(14, 7.5, 10.5, 6.5);
                c.closePath();
            }, { x: 10.5, y: 3.5, w: 7.5, h: 4 }, '#ff9a1a', { lineWidth: 1.2 });
        }
        Art.shape(ctx, c => {
            c.moveTo(10.5, -2.2);
            c.quadraticCurveTo(16, -1.8, 20.5, aim ? 0 : 1.5);
            c.quadraticCurveTo(16, 3.4, 10.5, 3.8);
            c.closePath();
        }, { x: 10.5, y: -2.2, w: 10, h: 6 }, '#ffb020', { lineWidth: 1.3 });
        ctx.restore();
    }
}

// ── Mini-Roboter-Küken: kleine Blechkugel, lädt auf und rollt los ──
class MiniRoboChick extends Enemy {
    constructor(x, y) {
        super(x, y, 18, 18);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 80;
        this.damage = 2;
        this.detectionRange = 150;
        this.rollState = 'idle'; // idle, charging, rolling, cooldown
        this.rollTimer = 0;
        this.rollDir = { x: 1, y: 0 };
        this.spinAngle = 0;
        this.cooldownTimer = 0;
        this.seed = Math.random() * 10;
        this.fxColor = '#ffb347';
        this.lookDir = { x: 1, y: 0 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;

        if (this.rollState === 'idle') {
            this.lookDir.x = dx / dist;
            this.lookDir.y = dy / dist;
            if (dist < this.detectionRange) {
                this._moveWithCollision((dx / dist) * this.speed * 0.4 * dt, (dy / dist) * this.speed * 0.4 * dt, world);
                if (dist < 80) {
                    this.rollState = 'charging';
                    this.rollTimer = 0.5;
                    this.rollDir = { x: dx / dist, y: dy / dist };
                }
            }
        } else if (this.rollState === 'charging') {
            this.rollTimer -= dt;
            if (this.rollTimer <= 0) {
                this.rollState = 'rolling';
                this.rollTimer = 0.8;
            }
        } else if (this.rollState === 'rolling') {
            this.spinAngle += dt * 20;
            this._moveWithCollision(this.rollDir.x * 200 * dt, this.rollDir.y * 200 * dt, world);
            this.rollTimer -= dt;
            if (this.rollTimer <= 0) {
                this.rollState = 'cooldown';
                this.cooldownTimer = 1.5;
            }
        } else if (this.rollState === 'cooldown') {
            this.cooldownTimer -= dt;
            if (this.cooldownTimer <= 0) this.rollState = 'idle';
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const st = this.rollState;
        const dir = st === 'charging' || st === 'rolling' ? this.rollDir : this.lookDir;
        const face = dir.x < 0 ? -1 : 1;
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h / 2);
        if (this.dead) {
            const k = this.deathProgress();
            const g = Math.max(0.01, 1 - k * 1.1);
            ctx.rotate(k * 6);
            ctx.scale(g, g);
        }
        if (st === 'charging' && !this.dead) {
            // Ankündigung: zittern, orange glühen, Pfeile zeigen die Rollrichtung
            ctx.translate(Math.sin(t * 75) * 0.9, 0);
            Art.glow(ctx, 0, 0, 17, '#ffb347', 0.65);
            MiniRoboChick._drawArrows(ctx, dir, t);
        } else if (st === 'rolling' && !this.dead) {
            // Tempo-Striche hinter dem Küken
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                const ox = -dir.y * i * 5;
                const oy = dir.x * i * 5;
                ctx.moveTo(ox - dir.x * 11, oy - dir.y * 11);
                ctx.lineTo(ox - dir.x * (17 + (i === 0 ? 5 : 0)), oy - dir.y * (17 + (i === 0 ? 5 : 0)));
            }
            ctx.stroke();
            ctx.rotate(this.spinAngle * face);
        } else if (st === 'cooldown' && !this.dead) {
            ctx.rotate(Math.sin(t * 9) * 0.12); // wackelt nach dem Rollen
        }
        ctx.scale(face, 1);
        const col = st === 'charging' ? '#ffb347' : '#eef2f8';
        if (st !== 'rolling') {
            Art.body(ctx, -3, 8.5, 2.8, 1.5, '#ff9f1c', { highlight: false });
            Art.body(ctx, 3.5, 8.5, 2.8, 1.5, '#ff9f1c', { highlight: false });
        }
        Art.body(ctx, -1.8, -8.2, 2.2, 2.6, '#ff4b4b', { highlight: false });
        Art.body(ctx, 1.8, -8.8, 2.4, 2.8, '#ff4b4b', { highlight: false });
        Art.body(ctx, 0, 0, 8.6, 8.6, col, { glossy: true });
        Art.glow(ctx, 4, -2.5, 5, '#ff3b30', 0.5);
        ctx.fillStyle = '#ff4a3d';
        ctx.beginPath();
        ctx.arc(4, -2.5, 1.7, 0, TAU);
        ctx.fill();
        Art.shape(ctx, c => {
            c.moveTo(7.5, -0.5);
            c.lineTo(12, 1.2);
            c.lineTo(7.5, 2.8);
            c.closePath();
        }, { x: 7.5, y: -0.5, w: 4.5, h: 3.3 }, '#ffb020', { lineWidth: 1 });
        ctx.restore();
    }

    // Zwei laufende Pfeilspitzen in Rollrichtung
    static _drawArrows(ctx, dir, t) {
        ctx.save();
        ctx.rotate(Math.atan2(dir.y, dir.x));
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const off = (t * 24) % 6;
        ctx.beginPath();
        for (let i = 0; i < 2; i++) {
            const x = 14 + i * 6 + off;
            ctx.moveTo(x - 3, -3.5);
            ctx.lineTo(x, 0);
            ctx.lineTo(x - 3, 3.5);
        }
        ctx.stroke();
        ctx.restore();
    }
}

// ── Boss Welt 2: Riesen-Küken (Geister-Küken mit Eierschalen-Helm) ──
class BossGhostChick extends Enemy {
    constructor(x, y) {
        super(x, y, 90, 90);
        this.hp = 50;
        this.maxHp = 50;
        this.speed = 35;
        this.damage = 3;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.isBoss = true;
        this.contactDamage = false;
        this.phase = 1;
        this.fxColor = '#b07cff';

        this.state = 'intro'; // intro, hover, rising, slamming, stunned
        this.introTimer = 2;
        this.stateTimer = 3;
        this.slamTarget = { x: 0, y: 0 };
        this.slamRange = 100;
        this.stunnedTimer = 0;
        this.spawnTimer = 12;
        this.spawnCooldown = 12;
        this.minions = [];
        this.maxMinions = 6; // G-09
        this.impactT = 0;
        this.lookDir = { x: 0, y: 0.4 };
    }

    update(dt, world, player, enemies) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.impactT > 0) this.impactT -= dt;

        // G-19: Phase 2 ab der Hälfte (Welt 11 hat 55 statt 50 Leben)
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.speed = 50;
            this.spawnCooldown = 8;
        }

        const mx = this.centerX();
        const my = this.centerY();
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dist = Math.hypot(px - mx, py - my) || 1;
        const kl = Math.min(1, dt * 6);
        this.lookDir.x += ((px - mx) / dist - this.lookDir.x) * kl;
        this.lookDir.y += ((py - my) / dist - this.lookDir.y) * kl;

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) { this.state = 'hover'; this.stateTimer = 3; }
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) { this.state = 'hover'; this.stateTimer = 3; }
            return;
        }

        if (this.state === 'hover') {
            this.x += ((px - mx) / dist) * this.speed * dt;
            this.y += ((py - my) / dist) * this.speed * dt;
            this.stateTimer -= dt;

            // Mini-Küken rufen: höchstens maxMinions leben (G-09), nur auf freien Boden (G-08)
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && enemies) {
                this.spawnTimer = this.spawnCooldown;
                this.minions = this.minions.filter(m => !m.dead);
                const count = Math.min(this.phase === 1 ? 2 : 3, this.maxMinions - this.minions.length);
                for (let i = 0; i < count; i++) {
                    const spot = BossGhost.freeSpot(world, mx, my, 18, 18, 50, (TAU * i) / count);
                    const m = new MiniRoboChick(spot.x, spot.y);
                    enemies.push(m);
                    this.minions.push(m);
                    if (typeof FX !== 'undefined') FX.burst(spot.x, spot.y, ['#ffffff', '#ffb347'], 6, 70, 0.4, { kind: 'smoke', size: 4 });
                }
            }

            if (this.stateTimer <= 0) {
                // Aufsteigen: Landeplatz steht ab jetzt fest und wird am Boden angezeigt
                this.state = 'rising';
                this.stateTimer = 1.5;
                this.slamTarget = BossGhost.clampToRoom(world, { x: px, y: py }, this.w / 2, this.h / 2);
            }
        }

        if (this.state === 'rising') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'slamming';
                this.stateTimer = 0.3;
                this.x = this.slamTarget.x - this.w / 2;
                this.y = this.slamTarget.y - this.h / 2;
            }
        }

        if (this.state === 'slamming') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                // Schaden genau im angezeigten Warnkreis
                const tx = this.slamTarget.x;
                const ty = this.slamTarget.y;
                if (Math.hypot(px - tx, py - ty) < this.slamRange) player.takeDamage(this.damage, Math.atan2(py - ty, px - tx), 300);
                this.impactT = 0.4;
                if (typeof FX !== 'undefined') {
                    FX.ring(tx, ty, '#fff3a0', this.slamRange, 0.45, 6);
                    FX.burst(tx, ty + 30, [this.fxColor, '#ffffff', '#ffd23f'], 14, 180, 0.5, { kind: 'spark' });
                }
                if (typeof Game !== 'undefined' && Game.camera) Game.camera.shake(6, 0.3);
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const st = this.dead ? 'dead' : this.state;
        const o = {
            t, st,
            rage: this.hp <= this.maxHp / 2,
            dizzy: st === 'stunned' || st === 'dead',
            charge: false,
            wing: Math.sin(t * 5) * 0.25,
        };
        // Warnkreis am Landeplatz
        if (st === 'rising' || st === 'slamming') {
            const k = st === 'rising' ? (1.5 - this.stateTimer) / 1.8 : (1.8 - this.stateTimer) / 1.8;
            const tp = camera.worldToScreen(this.slamTarget.x, this.slamTarget.y);
            BossGhost.drawWarnZone(ctx, tp.x, tp.y, this.slamRange, clamp(k, 0, 1));
        }
        // Höhe und Quetschen: ducken, abheben, herabstürzen, aufprallen
        let lift = 0, sx = 1, sy = 1, fade = 1;
        if (st === 'rising') {
            const k = 1 - this.stateTimer / 1.5;
            o.charge = k < 0.25;
            o.wing = Math.sin(t * 16) * 0.5;
            if (k < 0.2) {
                const q = k / 0.2;
                sx = 1 + q * 0.14; sy = 1 - q * 0.14;
            } else {
                const q = (k - 0.2) / 0.8;
                lift = q * q * 160; sx = 0.9; sy = 1.12; fade = 1 - q * 0.5;
            }
        } else if (st === 'slamming') {
            const q = 1 - this.stateTimer / 0.3;
            lift = (1 - q * q) * 160; sx = 0.86; sy = 1.18; o.wing = -0.7;
        } else if (o.dizzy) {
            o.wing = 0.6;
            if (st === 'stunned' && this.stunnedTimer > 1.7) {
                const q = (this.stunnedTimer - 1.7) / 0.3;
                sx = 1 + 0.3 * q; sy = 1 - 0.28 * q;
            }
        }
        const bob = st === 'hover' || st === 'intro' ? Math.sin(t * 2.2) * 4 : 0;
        const foot = this.h / 2;
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h / 2 + foot - lift + bob);
        if (st === 'dead') {
            const k = this.deathProgress();
            ctx.translate(Math.sin(t * 47) * 1.6, 0);
            sx *= 1 - k * 0.7;
            sy *= 1 - k * 0.7;
        }
        ctx.scale(sx, sy);
        ctx.translate(0, -foot);
        if (fade < 1) ctx.globalAlpha *= fade;
        this._drawBody(ctx, o);
        if (this.impactT > 0) Art.glow(ctx, 0, foot - 6, 60, '#fff6b0', (this.impactT / 0.4) * 0.8);
        ctx.restore();
    }

    // Geister-Küken (Mittelpunkt 0,0)
    _drawBody(ctx, o) {
        const t = o.t;
        const body = o.rage ? '#c46bff' : '#a57bff';
        const wing = Art.dark(body, 0.14);
        if (o.rage) Art.glow(ctx, 0, 4, 78, '#ff4d8d', 0.26 + 0.08 * Math.sin(t * 6));
        // Flügel hinter dem Körper
        for (let side = -1; side <= 1; side += 2) {
            ctx.save();
            ctx.translate(side * 30, 2);
            ctx.scale(side, 1);
            ctx.rotate(o.wing);
            // Federflügel mit drei runden Spitzen
            Art.shape(ctx, c => {
                c.moveTo(0, -12);
                c.quadraticCurveTo(20, -24, 31, -11);
                c.quadraticCurveTo(38, -4, 31, 0);
                c.quadraticCurveTo(36, 7, 27, 8);
                c.quadraticCurveTo(28, 16, 18, 14);
                c.quadraticCurveTo(8, 17, 0, 10);
                c.closePath();
            }, { x: 0, y: -22, w: 36, h: 38 }, wing, { lineWidth: 2 });
            ctx.strokeStyle = Art.alpha(Art.ink(wing), 0.55);
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(10, -6); ctx.quadraticCurveTo(20, -5, 27, -2);
            ctx.moveTo(9, 2); ctx.quadraticCurveTo(17, 4, 23, 8);
            ctx.stroke();
            ctx.restore();
        }
        // Körper: Kuppel mit Geister-Zipfeln
        Art.shape(ctx, c => {
            c.moveTo(-38, 22);
            c.arc(0, -6, 38, Math.PI, 0);
            c.lineTo(38, 22);
            for (let i = 0; i < 5; i++) {
                const x0 = 38 - i * 15.2;
                c.quadraticCurveTo(x0 - 7.6, 40 + Math.sin(t * 5 + i * 1.4) * 3, x0 - 15.2, 22);
            }
            c.closePath();
        }, { x: -38, y: -44, w: 76, h: 86 }, body, { glossy: true, lineWidth: 2.4 });
        Art.body(ctx, 0, 17, 21, 14, Art.light(body, 0.38), { outline: false, highlight: false });
        Art.shine(ctx, -18, -20, 7, 11, -0.5, 0.4);
        // Kamm schaut oben aus der Eierschale
        const hatRot = o.dizzy ? -0.3 : (o.rage ? -0.12 : 0);
        ctx.save();
        ctx.translate(0, -35);
        ctx.rotate(hatRot);
        Art.body(ctx, -6, -19, 5, 6.5, '#ff5a5f');
        Art.body(ctx, 2, -23, 5.5, 7.5, '#ff5a5f');
        Art.body(ctx, 9, -18, 4.5, 5.5, '#ff5a5f');
        // Eierschalen-Helm mit Zackenrand
        Art.shape(ctx, c => {
            c.moveTo(-33, 4);
            c.bezierCurveTo(-33, -14, -18, -20, 0, -20);
            c.bezierCurveTo(18, -20, 33, -14, 33, 4);
            for (let i = 1; i <= 8; i++) c.lineTo(33 - i * 8.25, i % 2 ? 11 : 4);
            c.closePath();
        }, { x: -33, y: -20, w: 66, h: 31 }, '#fff4dc', { lineWidth: 2 });
        ctx.fillStyle = '#e8cfa2';
        ctx.beginPath();
        ctx.ellipse(-17, -8, 2.6, 1.8, 0, 0, TAU);
        ctx.moveTo(14, -12);
        ctx.ellipse(12, -12, 2, 1.4, 0, 0, TAU);
        ctx.moveTo(22.6, -3);
        ctx.ellipse(21, -3, 1.6, 1.2, 0, 0, TAU);
        ctx.fill();
        if (o.rage) {
            // Risse in der Schale: das Küken ist richtig wütend
            ctx.strokeStyle = '#8a6238';
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-4, -19); ctx.lineTo(-8, -12); ctx.lineTo(-3, -7); ctx.lineTo(-7, 0);
            ctx.moveTo(16, -16); ctx.lineTo(19, -9); ctx.lineTo(15, -4);
            ctx.stroke();
        }
        ctx.restore();
        // Augen, Schnabel, Wangen
        const fy = -6;
        if (o.dizzy) BossGhost.drawDizzyEyes(ctx, 0, fy, 9, 14.5);
        else Art.eyes(ctx, 0, fy, 9, { look: this.lookDir, angry: true, gap: 14.5, iris: o.rage ? '#ff3b3b' : '#ffb627', seed: 2.1 });
        if (o.dizzy || o.charge) Art.mouth(ctx, 0, 13, 13, 'open');
        Art.shape(ctx, c => {
            c.moveTo(-10, 7);
            c.quadraticCurveTo(0, 3, 10, 7);
            c.quadraticCurveTo(4, 13, 0, 18);
            c.quadraticCurveTo(-4, 13, -10, 7);
            c.closePath();
        }, { x: -10, y: 3, w: 20, h: 15 }, '#ffa21f', { lineWidth: 2 });
        Art.blush(ctx, 0, 7, 5, 25, o.rage ? '#ff3b3b' : '#ff7aa8');
        if (o.dizzy) BossGhost.drawStunStars(ctx, 0, -72, 32, 4, 0);
        else if (o.charge) BossGhost.drawAlert(ctx, 0, -80 + Math.sin(t * 18) * 1.5, 1.3);
    }
}

// ══════════════════════════════════════════
// ── Welt 3: Schleim-Arena ──
// ══════════════════════════════════════════

// ── Schleim: glibberiger Glanz-Klecks mit Hüpf-Quetschen ──
class Slime extends Enemy {
    constructor(x, y) {
        super(x, y, 28, 22);
        this.hp = 12; // 3 Treffer mit dem Werfer
        this.maxHp = 12;
        this.speed = 40;
        this.damage = 1;
        this.detectionRange = 180;
        this.hue = randInt(85, 175); // limette bis türkis
        this.color = `hsl(${this.hue}, 80%, 56%)`;
        this.fxColor = this.color;
        this.seed = Math.random() * 10;
        this.moving = false;
        this.lookDir = { x: 0, y: 0.3 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = dist < this.detectionRange;
        if (this.moving) this._moveWithCollision((dx / dist) * this.speed * dt, (dy / dist) * this.speed * dt, world);
        const k = Math.min(1, dt * 8);
        this.lookDir.x += ((this.moving ? dx / dist : 0) - this.lookDir.x) * k;
        this.lookDir.y += ((this.moving ? dy / dist : 0.3) - this.lookDir.y) * k;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        let sx = 1, sy = 1, lift = 0;
        if (this.dead) {
            // Platsch: flach auseinanderlaufen
            const k = this.deathProgress();
            sx = 1 + k * 0.9;
            sy = Math.max(0.05, 1 - k * 0.9);
        } else if (this.moving) {
            const h = Math.sin(t * 7 + this.seed);
            lift = Math.max(0, h) * 3;
            sx = 1 - h * 0.1;
            sy = 1 + h * 0.12;
        } else {
            const b = Math.sin(t * 2.5 + this.seed) * 0.05;
            sx = 1 + b;
            sy = 1 - b;
        }
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h - lift);
        if (this.dead) ctx.globalAlpha *= 1 - Math.max(0, this.deathProgress() - 0.5) * 2;
        ctx.scale(sx, sy);
        Art.shape(ctx, c => {
            c.moveTo(-14, -3);
            c.bezierCurveTo(-15, -15, -8, -21, 0, -21);
            c.bezierCurveTo(8, -21, 15, -15, 14, -3);
            c.quadraticCurveTo(14.5, 1, 10, 0.5);
            c.quadraticCurveTo(0, 2, -10, 0.5);
            c.quadraticCurveTo(-14.5, 1, -14, -3);
            c.closePath();
        }, { x: -15, y: -21, w: 30, h: 22 }, this.color, { glossy: true });
        // Glibber-Glanz und Bläschen
        Art.shine(ctx, -6, -15, 3.8, 2.2, -0.5, 0.6);
        Art.shine(ctx, -1.5, -18.5, 1, 0.9, 0, 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        const by = -6 - ((t * 3 + this.seed) % 5);
        ctx.beginPath();
        ctx.moveTo(9.3, by);
        ctx.arc(8, by, 1.3, 0, TAU);
        ctx.moveTo(-8.1, -5);
        ctx.arc(-9, -5, 0.9, 0, TAU);
        ctx.fill();
        Art.eyes(ctx, 0, -11, 3.3, { look: this.lookDir, gap: 4.8, seed: this.seed });
        Art.mouth(ctx, 0, -4.8, 4.8, this.dead ? 'o' : (this.moving ? 'open' : 'smile'));
        Art.blush(ctx, 0, -6.5, 2, 8);
        ctx.restore();
    }
}

// ── Boss Welt 3: König Schleim ──
class BossSlime extends Enemy {
    constructor(x, y) {
        super(x, y, 100, 80);
        this.hp = 35;
        this.maxHp = 35;
        this.speed = 18;
        this.damage = 1;
        this.isBoss = true;
        this.contactDamage = true;
        this.phase = 1;
        this.pauseTimer = 0;
        this.fxColor = '#62e05a';

        this.state = 'intro';
        this.introTimer = 2;
        this.jumpTimer = 6;
        this.jumpCooldown = 6;
        this.jumpState = 'none'; // squat, rising, falling
        this.jumpProgress = 0;
        this.jumpTarget = { x: 0, y: 0 };
        this.slamRange = 120;
        this.splitAt25 = false;
        this.splitAt10 = false;
        this.stunnedTimer = 0;
        this.landT = 0;
        this.seed = Math.random() * 10;
        this.lookDir = { x: 0, y: 0.4 };
    }

    update(dt, world, player, enemies) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.landT > 0) this.landT -= dt;

        if (this.hp <= 18 && this.phase === 1) {
            this.phase = 2;
            this.speed = 25;
            this.jumpCooldown = 4;
        }

        const mx = this.centerX();
        const my = this.centerY();
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dist = Math.hypot(px - mx, py - my) || 1;
        const kl = Math.min(1, dt * 6);
        this.lookDir.x += ((px - mx) / dist - this.lookDir.x) * kl;
        this.lookDir.y += ((py - my) / dist - this.lookDir.y) * kl;

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) this.state = 'chase';
            return;
        }

        // Verschnaufpause (Zeit für Treffer); G-17: Wahrscheinlichkeit pro Zeit statt pro Bild
        this.pauseTimer -= dt;
        if (this.pauseTimer > 0) return;
        if (this.state === 'chase' && Math.random() < 1 - Math.pow(0.997, dt * 60)) {
            this.pauseTimer = 1.5;
            return;
        }

        // Teilung (G-08: kleine Schleime nur auf freien Boden)
        if (this.hp <= 25 && !this.splitAt25 && enemies) {
            this.splitAt25 = true;
            this._split(world, enemies, mx, my, 0);
        }
        if (this.hp <= 10 && !this.splitAt10 && enemies) {
            this.splitAt10 = true;
            this._split(world, enemies, mx, my, 0.5);
        }

        if (this.state === 'chase') {
            this._moveWithCollision(((px - mx) / dist) * this.speed * dt, ((py - my) / dist) * this.speed * dt, world);
            this.jumpTimer -= dt;
            if (this.jumpTimer <= 0) {
                // Sprung ankündigen: in die Hocke, Landeplatz wird am Boden markiert
                this.state = 'jumping';
                this.jumpState = 'squat';
                this.jumpProgress = 0;
                this.jumpTimer = this.jumpCooldown;
                this._pickJumpTarget(world, px, py);
            }
        }

        if (this.state === 'jumping') {
            this.jumpProgress += dt;
            if (this.jumpState === 'squat' && this.jumpProgress > 0.3) {
                this.jumpState = 'rising';
                this.jumpProgress = 0;
            } else if (this.jumpState === 'rising' && this.jumpProgress > 0.6) {
                this.jumpState = 'falling';
                this.jumpProgress = 0;
                this.x = this.jumpTarget.x - this.w / 2;
                this.y = this.jumpTarget.y - this.h / 2;
            } else if (this.jumpState === 'falling' && this.jumpProgress > 0.3) {
                // Landung: Schaden genau im angezeigten Warnkreis
                const tx = this.jumpTarget.x;
                const ty = this.jumpTarget.y;
                if (Math.hypot(px - tx, py - ty) < this.slamRange) player.takeDamage(2, Math.atan2(py - ty, px - tx), 250);
                this.landT = 0.35;
                if (typeof FX !== 'undefined') {
                    FX.ring(tx, ty, '#b8ff9a', this.slamRange, 0.45, 6);
                    FX.burst(tx, ty + 30, ['#62e05a', '#b8ff9a', '#ffffff'], 16, 190, 0.55);
                }
                if (typeof Game !== 'undefined' && Game.camera) Game.camera.shake(6, 0.3);
                this.state = 'stunned';
                this.stunnedTimer = 1.5;
                this.jumpState = 'none';
            }
        }
    }

    // Landeplatz: auf Mark zielen, aber nur wo der ganze Körper Platz hat (G-03)
    _pickJumpTarget(world, px, py) {
        const hw = this.w / 2;
        const hh = this.h / 2;
        const pt = BossGhost.clampToRoom(world, { x: px, y: py }, hw, hh);
        if (world.pixelWidth) {
            pt.x = clamp(pt.x, TILE_SIZE * 2 + hw, world.pixelWidth - TILE_SIZE * 2 - hw);
            pt.y = clamp(pt.y, TILE_SIZE * 2 + hh, world.pixelHeight - TILE_SIZE * 2 - hh);
        }
        const probe = { x: pt.x - hw, y: pt.y - hh, w: this.w, h: this.h };
        if (world.collideRect && world.collideRect(probe).length) {
            // Nächsten freien Platz suchen, sonst an Ort und Stelle hochspringen
            if (escapeFromWalls(probe, world, 3)) {
                pt.x = probe.x + hw;
                pt.y = probe.y + hh;
            } else {
                pt.x = this.centerX();
                pt.y = this.centerY();
            }
        }
        this.jumpTarget = pt;
    }

    _split(world, enemies, mx, my, a0) {
        for (let i = 0; i < 2; i++) {
            const spot = BossGhost.freeSpot(world, mx, my, 28, 22, 60, a0 + Math.PI * i);
            enemies.push(new Slime(spot.x, spot.y));
            if (typeof FX !== 'undefined') FX.burst(spot.x, spot.y, ['#62e05a', '#b8ff9a'], 8, 90, 0.4);
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const rage = this.hp <= this.maxHp / 2;
        const js = this.state === 'jumping' ? this.jumpState : 'none';
        const dizzy = this.state === 'stunned' || this.dead;

        // Warnkreis am Landeplatz (von der Hocke bis zur Landung)
        if (js !== 'none') {
            const done = js === 'squat' ? this.jumpProgress : (js === 'rising' ? 0.3 + this.jumpProgress : 0.9 + this.jumpProgress);
            const tp = camera.worldToScreen(this.jumpTarget.x, this.jumpTarget.y);
            BossGhost.drawWarnZone(ctx, tp.x, tp.y, this.slamRange, clamp(done / 1.2, 0, 1));
        }

        // Quetschen und Strecken um den Fußpunkt
        let lift = 0, sx = 1, sy = 1;
        if (js === 'squat') {
            const q = Math.min(1, this.jumpProgress / 0.3);
            sx = 1 + 0.2 * q; sy = 1 - 0.2 * q;
        } else if (js === 'rising') {
            const q = Math.min(1, this.jumpProgress / 0.6);
            lift = (1 - (1 - q) * (1 - q)) * 130; sx = 0.84; sy = 1.2;
        } else if (js === 'falling') {
            const q = Math.min(1, this.jumpProgress / 0.3);
            lift = (1 - q * q) * 130; sx = 0.86; sy = 1.18;
        } else if (this.landT > 0) {
            const q = this.landT / 0.35;
            sx = 1 + 0.32 * q; sy = 1 - 0.3 * q;
        } else {
            const w = Math.sin(t * (this.state === 'chase' ? 5 : 2.2) + this.seed) * (this.state === 'chase' ? 0.05 : 0.025);
            sx = 1 + w; sy = 1 - w;
        }
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h - lift);
        if (this.dead) {
            const k = this.deathProgress();
            ctx.translate(Math.sin(t * 47) * 1.6, 0);
            sx *= 1 + k * 0.5;
            sy *= Math.max(0.05, 1 - k * 0.85);
        }
        ctx.scale(sx, sy);
        const body = rage ? '#58d64a' : '#62e05a';
        if (rage) Art.glow(ctx, 0, -38, 80, '#ff4d4d', 0.28 + 0.08 * Math.sin(t * 6));

        // Glibber-Körper
        Art.shape(ctx, c => {
            c.moveTo(-50, -6);
            c.bezierCurveTo(-54, -50, -30, -78, 0, -78);
            c.bezierCurveTo(30, -78, 54, -50, 50, -6);
            c.quadraticCurveTo(52, 2, 40, 1);
            c.quadraticCurveTo(0, 5, -40, 1);
            c.quadraticCurveTo(-52, 2, -50, -6);
            c.closePath();
        }, { x: -52, y: -78, w: 104, h: 80 }, body, { glossy: true, lineWidth: 2.5 });
        // Bläschen steigen im Schleim auf
        ctx.fillStyle = 'rgba(235,255,225,0.4)';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const bx = -28 + i * 18 + Math.sin(t * 1.3 + i) * 3;
            const by = -10 - ((t * 12 + i * 19 + this.seed * 7) % 50);
            ctx.moveTo(bx + 2.5 + (i % 2), by);
            ctx.arc(bx, by, 2.5 + (i % 2), 0, TAU);
        }
        ctx.fill();
        Art.shine(ctx, -22, -54, 12, 7, -0.5, 0.5);
        Art.shine(ctx, -8, -66, 3, 2.4, -0.3, 0.7);
        // Tropfen am Rand
        ctx.fillStyle = body;
        ctx.strokeStyle = Art.ink(body);
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
            const dxp = -30 + i * 28;
            const len = 2 + ((t * 0.8 + i * 0.37 + this.seed) % 1) * 6;
            ctx.beginPath();
            ctx.moveTo(dxp - 4, 1);
            ctx.quadraticCurveTo(dxp - 3, 1 + len, dxp, 2 + len);
            ctx.quadraticCurveTo(dxp + 3, 1 + len, dxp + 4, 1);
            ctx.fill();
            ctx.stroke();
        }

        // Gesicht
        const fy = -44;
        if (dizzy) BossGhost.drawDizzyEyes(ctx, 0, fy, 9, 17);
        else Art.eyes(ctx, 0, fy, 9, { look: this.lookDir, angry: true, gap: 17, iris: rage ? '#ff3b3b' : null, seed: 0.7 });
        let mouth = rage ? 'teeth' : 'angry';
        if (dizzy) mouth = 'o';
        else if (js === 'squat' || js === 'rising') mouth = 'open';
        Art.mouth(ctx, 0, fy + 20, rage ? 26 : 20, mouth);
        Art.blush(ctx, 0, fy + 12, 6, 27, rage ? '#ff3b3b' : '#ff7aa8');
        if (rage && !dizzy) {
            // Dampfwölkchen: König Schleim kocht vor Wut
            const a0 = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 2; i++) {
                const q = (t * 0.9 + i * 0.5) % 1;
                ctx.globalAlpha = a0 * 0.6 * (1 - q);
                ctx.beginPath();
                ctx.arc((i ? 44 : -44) + (i ? 6 : -6) * q, -56 - q * 22, 4 + q * 5, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = a0;
        }
        // Krone (verrutscht bei Wut und Schwindel)
        BossGhost.drawCrown(ctx, dizzy ? -10 : (rage ? -6 : 0), -70, dizzy ? -0.45 : (rage ? -0.22 : Math.sin(t * 2.2) * 0.04), 1.1);
        if (dizzy) BossGhost.drawStunStars(ctx, 0, -104, 34, 4, 0);
        else if (js === 'squat') BossGhost.drawAlert(ctx, 0, -110 + Math.sin(t * 18) * 1.5, 1.3);
        ctx.restore();
    }
}

// ── Riesen-Ei (Schlüsselträger Welt 2): buntes Osterei, bekommt Risse ──
class GiantEgg extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 30); // G-05: Hitbox höchstens 30×30, die Zeichnung ist größer
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 0;
        this.damage = 0;
        this.contactDamage = false;
        this.isKeyGhost = true; // gleicher Schlüssel-Abwurf
        this.droppedKey = false;
        this.crackLevel = 0;
        this.hitT = 0;
        this.seed = Math.random() * 10;
        this.fxColor = '#ffe08a';
        this.shadow = { rx: 14, ry: 5, dy: 15 };
    }

    // G-05: kein Rückstoß – das Ei bleibt, wo es ist
    takeDamage(amount, knockbackAngle) {
        const before = this.hp;
        super.takeDamage(amount, knockbackAngle, 0);
        if (this.hp < before) this.hitT = 0.4;
    }

    update(dt, world) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.crackLevel = 1 - this.hp / this.maxHp;
        if (this.hitT > 0) this.hitT -= dt;
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const cx = p.x + this.w / 2;
        const t = Art.time;
        ctx.save();
        ctx.translate(cx, p.y + this.h + 1); // Fußpunkt
        if (this.dead) {
            this._drawBreak(ctx, this.deathProgress());
            ctx.restore();
            return;
        }
        let rot = Math.sin(t * 1.6 + this.seed) * 0.035;
        if (this.hitT > 0) rot += Math.sin(t * 42) * 0.2 * (this.hitT / 0.4);
        ctx.rotate(rot);
        this._drawShell(ctx, 1 - this.hp / this.maxHp);
        ctx.restore();
        KeyGhost.drawKeyMarker(ctx, cx, p.y - 16, this.seed);
    }

    // Tupfen (x, y, r, …) in einem Pfad
    static _dots(ctx, color, d) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < d.length; i += 3) {
            ctx.moveTo(d[i] + d[i + 2], d[i + 1]);
            ctx.arc(d[i], d[i + 1], d[i + 2], 0, TAU);
        }
        ctx.fill();
    }

    _eggPath(c) {
        c.moveTo(0, -38);
        c.bezierCurveTo(10, -38, 16, -19, 16, -11);
        c.bezierCurveTo(16, -3, 9, 0, 0, 0);
        c.bezierCurveTo(-9, 0, -16, -3, -16, -11);
        c.bezierCurveTo(-16, -19, -10, -38, 0, -38);
        c.closePath();
    }

    // Schale mit Zickzack-Band, Punkten und Rissen (crack = 0..1)
    _drawShell(ctx, crack) {
        Art.shape(ctx, c => this._eggPath(c), { x: -16, y: -38, w: 32, h: 38 }, '#fff4dc', { glossy: true });
        ctx.save();
        ctx.beginPath();
        this._eggPath(ctx);
        ctx.clip();
        ctx.fillStyle = '#ff6fb1';
        ctx.beginPath();
        ctx.moveTo(-17, -19);
        for (let i = 0; i <= 8; i++) ctx.lineTo(-17 + i * 4.25, i % 2 ? -14 : -19);
        for (let i = 8; i >= 0; i--) ctx.lineTo(-17 + i * 4.25, i % 2 ? -10 : -15);
        ctx.closePath();
        ctx.fill();
        GiantEgg._dots(ctx, '#4cc3ff', GiantEgg.DOTS_TOP);
        GiantEgg._dots(ctx, '#ffcf3a', GiantEgg.DOTS_BOTTOM);
        ctx.restore();
        Art.shine(ctx, -6, -28, 3.2, 5.5, -0.35, 0.55);
        // Risse wachsen mit dem Schaden, durch sie leuchtet es golden
        const n = Math.ceil(crack * 4 - 0.01);
        if (n > 0) {
            if (crack > 0.45) Art.glow(ctx, 0, -18, 16, '#ffe066', (crack - 0.45) * 1.4);
            ctx.strokeStyle = '#7a4a2a';
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const cr = GiantEgg.CRACKS[i];
                ctx.moveTo(cr[0], cr[1]);
                for (let j = 2; j < cr.length; j += 2) ctx.lineTo(cr[j], cr[j + 1]);
            }
            ctx.stroke();
        }
        ctx.lineWidth = Art.LINE;
        ctx.strokeStyle = Art.ink('#fff4dc');
        ctx.beginPath();
        this._eggPath(ctx);
        ctx.stroke();
    }

    // Tod: oberer Schalenteil fliegt weg, unten bleibt die halbe Schale, goldenes Licht
    _drawBreak(ctx, k) {
        const a0 = ctx.globalAlpha;
        Art.glow(ctx, 0, -18, 14 + k * 16, '#ffe066', 1 - k);
        ctx.globalAlpha = a0 * (1 - k * k);
        ctx.save();
        ctx.beginPath();
        ctx.rect(-20, -17, 40, 20);
        ctx.clip();
        this._drawShell(ctx, 1);
        ctx.restore();
        ctx.save();
        ctx.translate(k * 10, -k * 22);
        ctx.rotate(k * 1.2);
        ctx.beginPath();
        ctx.rect(-20, -42, 40, 25);
        ctx.clip();
        this._drawShell(ctx, 1);
        ctx.restore();
        ctx.globalAlpha = a0;
    }
}
// Tupfen der Osterei-Bemalung (x, y, r, …) und Risslinien (x, y, x, y, …) relativ zum Fußpunkt
GiantEgg.DOTS_TOP = [-7, -26, 2.2, 3, -29, 2.2, 9, -23, 1.8];
GiantEgg.DOTS_BOTTOM = [-8, -5, 2, 1, -4, 2.2, 10, -7, 1.8];
GiantEgg.CRACKS = [
    [-2, -37, -5, -31, -1, -27, -5, -22],
    [9, -30, 6, -25, 10, -21, 7, -16],
    [-14, -13, -10, -10, -12, -6],
    [4, -12, 7, -8, 3, -5, 6, -1],
];

// ══════════════════════════════════════════
// ── Welt 4: Schatten-Burg ──
// ══════════════════════════════════════════

// ── Schatten-Ritter: kleiner Krokodil-Ritter in Rüstung ──
class ShadowKnight extends Enemy {
    constructor(x, y) {
        super(x, y, 28, 28);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 50;
        this.damage = 2;
        this.detectionRange = 180;
        this.attackTimer = 0;
        this.attackCooldown = 1.5;
        this.slashing = false;
        this.slashTimer = 0;
        this.slashAngle = 0;
        this.windup = 0; // G-20: Ausholen vor dem Hieb
        this.walk = 0;
        this.armor = '#7b86ff';
        this.plume = '#ff4d6d';
        this.aura = null;
        this.seed = Math.random() * 10;
        this.fxColor = '#8f7bff';
        this.lookDir = { x: 1, y: 0 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;

        if (this.windup > 0) {
            // Ausholen (sichtbar), erst danach trifft der Hieb
            this.windup -= dt;
            if (this.windup <= 0) {
                this.slashing = true;
                this.slashTimer = 0.3;
                if (dist < 50) player.takeDamage(this.damage, this.slashAngle, 180);
            }
            return;
        }

        if (this.slashing) {
            this.slashTimer -= dt;
            if (this.slashTimer <= 0) this.slashing = false;
            return;
        }

        if (dist < this.detectionRange) {
            const nx = dx / dist;
            const ny = dy / dist;
            this.slashAngle = Math.atan2(dy, dx);
            this.lookDir.x = nx;
            this.lookDir.y = ny;
            this._moveWithCollision(nx * this.speed * dt, ny * this.speed * dt, world);
            this.walk += dt * 10;

            this.attackTimer -= dt;
            if (this.attackTimer <= 0 && dist < 45) {
                this.windup = 0.3;
                this.attackTimer = this.attackCooldown;
            }
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const cx = p.x + this.w / 2;
        const cy = p.y + this.h / 2;
        const face = this.lookDir.x < 0 ? -1 : 1;
        const step = Math.sin(this.walk);
        if (this.aura) Art.glow(ctx, cx, cy, 24, this.aura, 0.45 + 0.15 * Math.sin(t * 4 + this.seed));

        // Hieb-Sichel in Angriffsrichtung
        if (this.slashing && !this.dead) {
            const q = this.slashTimer / 0.3;
            const a0 = ctx.globalAlpha;
            ctx.globalAlpha = a0 * q;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(this.slashAngle);
            Art.shape(ctx, c => {
                c.arc(0, 0, 34, -1, 1);
                c.arc(4, 0, 26, 0.95, -0.95, true);
                c.closePath();
            }, { x: 0, y: -30, w: 34, h: 60 }, '#e9f3ff', { outline: '#8fb2ff', lineWidth: 1.2, flat: true });
            ctx.restore();
            ctx.globalAlpha = a0;
        }

        ctx.save();
        ctx.translate(cx, cy);
        if (this.dead) {
            const k = this.deathProgress();
            const g = Math.max(0.01, k < 0.2 ? 1 + k * 0.8 : 1.16 - (k - 0.2) * 1.4);
            ctx.rotate(-k * 1.5 * face);
            ctx.scale(g, g);
        }
        ctx.scale(face, 1);
        const armor = this.armor;
        const helm = Art.light(armor, 0.15);
        const croc = '#5fcf6e';
        // Schwanz und Füße
        Art.shape(ctx, c => {
            c.moveTo(-6, 4);
            c.quadraticCurveTo(-16, 6 + Math.sin(t * 5 + this.seed) * 2, -20, 12);
            c.quadraticCurveTo(-13, 11, -5, 10);
            c.closePath();
        }, { x: -20, y: 4, w: 15, h: 8 }, croc, { lineWidth: 1.3 });
        Art.body(ctx, -4 - step * 2, 12, 3.6, 2.4, Art.dark(armor, 0.35), { highlight: false });
        Art.body(ctx, 5 + step * 2, 12, 3.6, 2.4, Art.dark(armor, 0.35), { highlight: false });
        // Schild auf dem hinteren Arm
        Art.body(ctx, -9, 3, 5, 6.5, '#ffcf3a', { highlight: false });
        Art.body(ctx, -9, 3, 2, 2.6, Art.dark(armor, 0.1), { outline: false, highlight: false });
        // Rumpf und Helm
        Art.body(ctx, 0, 4, 9.5, 8.5, armor, { glossy: true });
        Art.body(ctx, 0, -6, 9, 8, helm, { glossy: true });
        // Federbusch
        Art.shape(ctx, c => {
            c.moveTo(-1, -13);
            c.quadraticCurveTo(-4, -21 + Math.sin(t * 6 + this.seed), -12, -19);
            c.quadraticCurveTo(-7, -15, -4, -11);
            c.closePath();
        }, { x: -12, y: -21, w: 12, h: 10 }, this.plume, { lineWidth: 1.2 });
        // Krokodil-Schnauze schaut aus dem Visier (mit Zähnchen)
        Art.body(ctx, 11, -3, 7.5, 3.8, croc);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(6.5, 0.2); ctx.lineTo(7.6, 2.4); ctx.lineTo(8.7, 0.3);
        ctx.moveTo(10.3, 0.5); ctx.lineTo(11.4, 2.7); ctx.lineTo(12.5, 0.5);
        ctx.moveTo(14, 0.2); ctx.lineTo(15, 2.2); ctx.lineTo(16, 0);
        ctx.fill();
        ctx.fillStyle = Art.ink(croc);
        ctx.beginPath();
        ctx.arc(16.2, -4.8, 0.8, 0, TAU);
        ctx.fill();
        // Visier-Schlitz mit glühenden Augen
        Art.box(ctx, 0, -9.5, 8.5, 4, 2, '#231a47', { outline: false, highlight: false });
        const eye = this.windup > 0 ? '#ffffff' : '#ffe45c';
        Art.glow(ctx, 5, -7.5, 7, '#ffcc33', 0.5);
        ctx.fillStyle = eye;
        ctx.beginPath();
        ctx.arc(3, -7.5, 1.2, 0, TAU);
        ctx.moveTo(7.7, -7.5);
        ctx.arc(6.5, -7.5, 1.2, 0, TAU);
        ctx.fill();
        // Schwert: Ruhe nach vorn, Ausholen über den Kopf, Hieb nach vorn unten
        let sa = -0.35 + Math.sin(t * 2 + this.seed) * 0.08;
        if (this.windup > 0) sa = -2.3 + Math.sin(t * 40) * 0.06;
        else if (this.slashing) sa = -2.3 + (1 - this.slashTimer / 0.3) * 3.2;
        ctx.save();
        ctx.translate(8, 6.5);
        ctx.rotate(sa);
        Art.limb(ctx, 3, 0, 16, 0, 3, '#e8eef9', { lineWidth: 1.2 });
        Art.limb(ctx, 3, -3.2, 3, 3.2, 2, '#ffcf3a', { lineWidth: 1 });
        Art.body(ctx, 0, 0, 2.5, 2.5, Art.dark(armor, 0.1), { highlight: false });
        if (this.windup > 0) Art.sparkle(ctx, 16, 0, 4.5, '#ffffff', 0.9);
        ctx.restore();
        ctx.restore();
        if (this.windup > 0 && !this.dead) BossGhost.drawAlert(ctx, cx, p.y - 12 + Math.sin(t * 20), 0.75);
    }
}

// ── Riesen-Fledermaus: lila, große Ohren, Flügelschlag ──
class GiantBat extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 20);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 100;
        this.damage = 1;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.detectionRange = 220;
        this.wingAnim = Math.random() * TAU;
        this.t = 0;
        this.idlePhase = Math.random() * TAU; // G-22: jede Fledermaus schwingt anders
        this.fxColor = '#a05cff';
        this.lookDir = { x: 0, y: 0.3 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.wingAnim += dt * 14;
        this.t += dt;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < this.detectionRange) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
            this.lookDir.x = dx / dist;
            this.lookDir.y = dy / dist;
        } else {
            // Kreisen im Leerlauf (eigene Uhr statt Wanduhr)
            this.x += Math.sin(this.t * 1.667 + this.idlePhase) * 20 * dt;
            this.y += Math.cos(this.t * 2 + this.idlePhase) * 15 * dt;
            this.lookDir.x *= 0.9;
            this.lookDir.y = this.lookDir.y * 0.9 + 0.03;
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const flap = Math.sin(this.wingAnim);
        ctx.save();
        ctx.translate(p.x + this.w / 2, p.y + this.h / 2 - flap * 1.5);
        if (this.dead) {
            const k = this.deathProgress();
            const g = Math.max(0.01, 1 - k * 0.9);
            ctx.rotate(k * 7);
            ctx.scale(g, g);
        }
        GiantBat.drawWing(ctx, -1, flap, 1, '#6f3fd6');
        GiantBat.drawWing(ctx, 1, flap, 1, '#6f3fd6');
        // Ohren
        for (let side = -1; side <= 1; side += 2) {
            Art.shape(ctx, c => {
                c.moveTo(side * 2, -5);
                c.lineTo(side * 7.5, -13);
                c.lineTo(side * 7, -3);
                c.closePath();
            }, { x: -8, y: -13, w: 16, h: 10 }, '#8a4ff0', { lineWidth: 1.3 });
            ctx.fillStyle = '#ff8fc4';
            ctx.beginPath();
            ctx.moveTo(side * 3.6, -5.5);
            ctx.lineTo(side * 6.8, -10.5);
            ctx.lineTo(side * 6.4, -5);
            ctx.fill();
        }
        Art.body(ctx, 0, 0, 7.5, 7, '#9b5cff', { glossy: true });
        Art.body(ctx, 0, 3, 4.2, 3.4, '#d6b8ff', { outline: false, highlight: false });
        Art.eyes(ctx, 0, -1.6, 2.7, { gap: 3.2, look: this.lookDir, sclera: '#fff06a', seed: this.idlePhase });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-2.4, 2.4); ctx.lineTo(-1.6, 5); ctx.lineTo(-0.8, 2.4);
        ctx.moveTo(0.8, 2.4); ctx.lineTo(1.6, 5); ctx.lineTo(2.4, 2.4);
        ctx.fill();
        ctx.restore();
    }

    // Fledermaus-Flügel mit Fingerknochen; dir = -1 links, 1 rechts; s = Größe
    static drawWing(ctx, dir, flap, s, color) {
        ctx.save();
        ctx.scale(dir * s, s);
        ctx.translate(5, -1);
        ctx.rotate(-flap * 0.45);
        const span = 13 + flap * 2;
        Art.shape(ctx, c => {
            c.moveTo(0, -2);
            c.quadraticCurveTo(span * 0.5, -9, span, -4);
            c.quadraticCurveTo(span * 0.85, 1, span * 0.7, 3);
            c.quadraticCurveTo(span * 0.55, 0.5, span * 0.4, 4);
            c.quadraticCurveTo(span * 0.25, 1, 0, 3);
            c.closePath();
        }, { x: 0, y: -8, w: span, h: 12 }, color, { lineWidth: 1.3 / s });
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.8 / s;
        ctx.beginPath();
        ctx.moveTo(0.5, -1); ctx.lineTo(span * 0.7, 2.5);
        ctx.moveTo(0.5, -1); ctx.lineTo(span * 0.4, 3.5);
        ctx.stroke();
        ctx.restore();
    }
}

// ── Schlüssel-Ritter (Welt 4): goldene Rüstung, Schlüssel über dem Kopf ──
class KeyKnight extends ShadowKnight {
    constructor(x, y) {
        super(x, y);
        this.hp = 16;
        this.maxHp = 16;
        this.speed = 40;
        this.isKeyGhost = true;
        this.droppedKey = false;
        this.detectionRange = 220;
        this.armor = '#ffc93c';
        this.plume = '#4cc9f0';
        this.aura = '#ffe066';
        this.fxColor = '#ffd23f';
    }

    draw(ctx, camera) {
        super.draw(ctx, camera);
        if (this.dead) return;
        const p = camera.worldToScreen(this.centerX(), this.y);
        KeyGhost.drawKeyMarker(ctx, p.x, p.y - 14, this.seed);
    }
}

// ── Boss Welt 4: Schatten-Fledermaus (Fledermaus-Ritter mit Riesenschwert) ──
class BossKnightBat extends Enemy {
    constructor(x, y) {
        super(x, y, 90, 80);
        this.hp = 55;
        this.maxHp = 55;
        this.speed = 45;
        this.damage = 3;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.isBoss = true;
        this.contactDamage = false;
        this.fxColor = '#8a4dff';

        this.state = 'intro'; // intro, fly, windup, swoop, stunned
        this.introTimer = 2;
        this.swoopTimer = 3;
        this.swoopCooldown = 3;
        this.swooping = false;
        this.swoopDir = { x: 1, y: 0 };
        this.swoopProgress = 0;
        this.swoopTime = 0.8;
        this.windupTimer = 0;
        this.stunnedTimer = 0;
        this.wingAnim = 0;
        this.spawnTimer = 15;
        this.minions = [];
        this.maxMinions = 6; // G-09
        this.phase = 1;
        this.t = 0; // eigene Uhr (G-22)
        this.lookDir = { x: 0, y: 0.4 };
    }

    update(dt, world, player, enemies) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.wingAnim += dt * 5;
        this.t += dt;

        // G-19: Phase 2 ab der Hälfte (Welt 12 hat 65 statt 55 Leben)
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.speed = 60;
            this.swoopCooldown = 2;
        }

        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        const kl = Math.min(1, dt * 6);
        this.lookDir.x += (nx - this.lookDir.x) * kl;
        this.lookDir.y += (ny - this.lookDir.y) * kl;

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'fly';
            return;
        }
        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) this.state = 'fly';
            return;
        }
        if (this.state === 'windup') {
            // Ankündigung: Richtung steht fest, die Warnbahn ist zu sehen
            this.windupTimer -= dt;
            if (this.windupTimer <= 0) {
                this.state = 'swoop';
                this.swooping = true;
                this.swoopProgress = 0;
            }
            return;
        }
        if (this.state === 'swoop') {
            this.swoopProgress += dt;
            this.x += this.swoopDir.x * 300 * dt;
            this.y += this.swoopDir.y * 300 * dt;
            if (dist < 60) player.takeDamage(this.damage, Math.atan2(dy, dx), 250);
            // G-15: der Sturzflug endet kurz hinter Mark – die Betäubung bleibt in Reichweite
            if (this.swoopProgress >= this.swoopTime) {
                this.state = 'stunned';
                this.swooping = false;
                this.stunnedTimer = 1.8;
                if (typeof FX !== 'undefined') FX.burst(mx, my + 30, 'rgba(235,225,255,0.9)', 8, 80, 0.5, { kind: 'smoke', size: 5 });
            }
            return;
        }

        // Fliegen: annähern und kreisen
        this.x += nx * this.speed * dt + Math.sin(this.t * 2.5) * 30 * dt;
        this.y += ny * this.speed * dt + Math.cos(this.t * 2.857) * 20 * dt;

        // Fledermäuse rufen: höchstens maxMinions leben (G-09)
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && enemies) {
            this.spawnTimer = this.phase === 1 ? 15 : 10;
            this.minions = this.minions.filter(m => !m.dead);
            const count = Math.min(2, this.maxMinions - this.minions.length);
            for (let i = 0; i < count; i++) {
                const a = Math.random() * TAU;
                const b = new GiantBat(mx + Math.cos(a) * 50, my + Math.sin(a) * 50);
                enemies.push(b);
                this.minions.push(b);
            }
        }

        // Sturzflug ankündigen: Richtung festlegen, Länge bis knapp hinter Mark
        this.swoopTimer -= dt;
        if (this.swoopTimer <= 0) {
            this.state = 'windup';
            this.windupTimer = 0.55;
            this.swoopDir = { x: nx, y: ny };
            this.swoopTime = clamp((dist + 60) / 300, 0.35, 0.8);
            this.swoopTimer = this.swoopCooldown;
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const cx = p.x + this.w / 2;
        const cy = p.y + this.h / 2;
        const st = this.dead ? 'dead' : this.state;
        const attack = st === 'windup' || st === 'swoop';
        const o = {
            t, st,
            rage: this.hp <= this.maxHp / 2,
            dizzy: st === 'stunned' || st === 'dead',
            windup: st === 'windup' ? 1 - this.windupTimer / 0.55 : -1,
            face: (attack ? this.swoopDir.x : this.lookDir.x) < 0 ? -1 : 1, // Schwert auf der Angriffsseite
        };
        if (st === 'windup') this._drawSwoopLane(ctx, cx, cy, o.windup);
        if (st === 'swoop') this._drawTrail(ctx, cx, cy);
        let ox = 0, oy = 0;
        if (st === 'windup') {
            // zurückziehen und Schwung holen
            ox = -this.swoopDir.x * 10 * o.windup;
            oy = -this.swoopDir.y * 10 * o.windup - 6 * o.windup;
        }
        const bob = st === 'fly' || st === 'intro' ? Math.sin(t * 3) * 4 : 0;
        ctx.save();
        ctx.translate(cx + ox, cy + oy + bob);
        if (st === 'dead') {
            const k = this.deathProgress();
            ctx.translate(Math.sin(t * 47) * 1.6, 0);
            ctx.scale(1 - k * 0.7, 1 - k * 0.7);
        }
        ctx.scale(o.face, 1);
        this._drawBody(ctx, o);
        ctx.restore();
    }

    // Rote Warnbahn: so weit und so breit trifft der Sturzflug
    _drawSwoopLane(ctx, cx, cy, k) {
        const len = this.swoopTime * 300;
        const a0 = ctx.globalAlpha;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(this.swoopDir.y, this.swoopDir.x));
        ctx.globalAlpha = a0 * (0.14 + 0.14 * k);
        ctx.fillStyle = '#ff2e4d';
        ctx.beginPath();
        ctx.roundRect(-30, -60, len + 90, 120, 60);
        ctx.fill();
        ctx.globalAlpha = a0 * (0.65 + 0.35 * Math.sin(Art.time * 16));
        ctx.strokeStyle = '#ff4d63';
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.globalAlpha = a0 * 0.9;
        ctx.strokeStyle = '#ffe0e4';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const off = (Art.time * 90) % 30;
        ctx.beginPath();
        for (let x = 30 + off; x < len + 30; x += 30) {
            ctx.moveTo(x - 9, -11);
            ctx.lineTo(x, 0);
            ctx.lineTo(x - 9, 11);
        }
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = a0;
    }

    // Luftschlieren hinter dem Sturzflug
    _drawTrail(ctx, cx, cy) {
        const bx = -this.swoopDir.x;
        const by = -this.swoopDir.y;
        Art.glow(ctx, cx + bx * 44, cy + by * 44, 44, '#b58cff', 0.4);
        ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
            const ox = -by * i * 26;
            const oy = bx * i * 26;
            const len = 92 - Math.abs(i) * 22;
            ctx.strokeStyle = i === 0 ? 'rgba(240,228,255,0.8)' : 'rgba(205,176,255,0.65)';
            ctx.lineWidth = i === 0 ? 5 : 3.5;
            ctx.beginPath();
            ctx.moveTo(cx + ox + bx * 30, cy + oy + by * 30);
            ctx.lineTo(cx + ox + bx * len, cy + oy + by * len);
            ctx.stroke();
        }
    }

    // Winkel des Schwerts (gespiegelt: +x = Blickseite): Ruhe schräg nach unten, Ausholen nach oben, Sturz in Flugrichtung
    _swordAngle(o) {
        if (o.dizzy) return 1.7;
        if (o.windup >= 0) return -2.1 + Math.sin(o.t * 40) * 0.05;
        if (o.st === 'swoop') return Math.atan2(this.swoopDir.y, Math.abs(this.swoopDir.x));
        return 0.8 + Math.sin(o.t * 2) * 0.15;
    }

    // Fledermaus-Ritter (Mittelpunkt 0,0)
    _drawBody(ctx, o) {
        const t = o.t;
        const fur = o.rage ? '#8b3fd6' : '#7a4ad8';
        const steel = '#c6d0e6';
        let flap = Math.sin(t * 5.5);
        if (o.dizzy) flap = -0.8;
        else if (o.st === 'swoop') flap = 0.9;
        else if (o.windup >= 0) flap = Math.sin(t * 14);
        if (o.rage) Art.glow(ctx, 0, 0, 90, '#ff3b6b', 0.26 + 0.08 * Math.sin(t * 6));
        // Flügel
        const wing = o.rage ? '#7c2fa8' : '#5f38c4';
        GiantBat.drawWing(ctx, -1, flap, 5.2, wing);
        GiantBat.drawWing(ctx, 1, flap, 5.2, wing);
        if (o.rage) {
            // eingerissene Flügel
            ctx.fillStyle = Art.dark(wing, 0.55);
            ctx.beginPath();
            ctx.ellipse(-58, -2 + flap * 4, 3.5, 2.2, 0, 0, TAU);
            ctx.moveTo(55, 4 + flap * 4);
            ctx.ellipse(52, 4 + flap * 4, 3, 2, 0, 0, TAU);
            ctx.fill();
        }
        // Füße mit Krallen
        Art.body(ctx, -10, 33, 5, 4, Art.dark(fur, 0.25), { highlight: false });
        Art.body(ctx, 10, 33, 5, 4, Art.dark(fur, 0.25), { highlight: false });
        // Pelzkörper und Brustpanzer
        Art.body(ctx, 0, 8, 27, 25, fur, { glossy: true, lineWidth: 2.2 });
        Art.shape(ctx, c => {
            c.moveTo(-18, -4);
            c.quadraticCurveTo(0, -9, 18, -4);
            c.quadraticCurveTo(19, 16, 0, 28);
            c.quadraticCurveTo(-19, 16, -18, -4);
            c.closePath();
        }, { x: -19, y: -9, w: 38, h: 37 }, steel, { glossy: true, lineWidth: 2 });
        ctx.strokeStyle = '#ffcf3a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.quadraticCurveTo(0, -4, 14, 0);
        ctx.stroke();
        Art.gem(ctx, 0, 9, 4.5, o.rage ? '#ff3b6b' : '#b36bff');
        // Fledermaus-Ohren durch den Helm
        for (let side = -1; side <= 1; side += 2) {
            Art.shape(ctx, c => {
                c.moveTo(side * 6, -30);
                c.lineTo(side * 19, -52);
                c.lineTo(side * 20, -26);
                c.closePath();
            }, { x: -20, y: -52, w: 40, h: 26 }, fur, { lineWidth: 2 });
            ctx.fillStyle = '#ff8fc4';
            ctx.beginPath();
            ctx.moveTo(side * 9, -31);
            ctx.lineTo(side * 18, -46);
            ctx.lineTo(side * 18, -30);
            ctx.fill();
        }
        // Helm mit goldenem Stirnreif und T-Visier
        ctx.save();
        ctx.translate(0, -16);
        if (o.dizzy) ctx.rotate(-0.22);
        Art.body(ctx, 0, 0, 20, 17, steel, { glossy: true, lineWidth: 2.2 });
        Art.box(ctx, -17, -12, 34, 5, 2.5, '#ffcf3a', { lineWidth: 1.4, highlight: false });
        for (let i = -1; i <= 1; i++) {
            Art.shape(ctx, c => {
                c.moveTo(i * 9 - 3.5, -11);
                c.lineTo(i * 9, -19 + Math.abs(i) * 3);
                c.lineTo(i * 9 + 3.5, -11);
                c.closePath();
            }, { x: i * 9 - 3.5, y: -19, w: 7, h: 8 }, '#ffcf3a', { lineWidth: 1.2 });
        }
        Art.box(ctx, -14, -3, 28, 6.5, 3, '#1c1238', { outline: false, highlight: false });
        Art.box(ctx, -3, 2, 6, 8, 2, '#1c1238', { outline: false, highlight: false });
        const eyeCol = o.rage ? '#ff3b3b' : '#ffe14d';
        if (o.dizzy) {
            ctx.strokeStyle = '#ffe14d';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let side = -1; side <= 1; side += 2) {
                ctx.moveTo(side * 7 - 2.4, -2);
                ctx.lineTo(side * 7 + 2.4, 2);
                ctx.moveTo(side * 7 + 2.4, -2);
                ctx.lineTo(side * 7 - 2.4, 2);
            }
            ctx.stroke();
        } else {
            const lx = Math.abs(this.lookDir.x) * 2;
            Art.glow(ctx, -7 + lx, 0, o.windup >= 0 ? 12 : 8, eyeCol, 0.8);
            Art.glow(ctx, 7 + lx, 0, o.windup >= 0 ? 12 : 8, eyeCol, 0.8);
            ctx.fillStyle = o.windup >= 0 ? '#ffffff' : eyeCol;
            ctx.beginPath();
            ctx.ellipse(-7 + lx, 0, 3, 1.8, 0, 0, TAU);
            ctx.moveTo(10 + lx, 0);
            ctx.ellipse(7 + lx, 0, 3, 1.8, 0, 0, TAU);
            ctx.fill();
        }
        // Reißzähne unter dem Helm
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = Art.INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, 15); ctx.lineTo(-5.5, 21); ctx.lineTo(-3, 15);
        ctx.moveTo(3, 15); ctx.lineTo(5.5, 21); ctx.lineTo(8, 15);
        ctx.fill();
        ctx.stroke();
        if (o.rage) {
            ctx.strokeStyle = '#5a6488';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(10, -14); ctx.lineTo(13, -8); ctx.lineTo(10, -4);
            ctx.stroke();
        }
        ctx.restore();
        // Riesenschwert
        ctx.save();
        ctx.translate(24, 14);
        ctx.rotate(this._swordAngle(o));
        Art.limb(ctx, 6, 0, 58, 0, 7, '#eef3fb', { lineWidth: 1.6 });
        Art.shine(ctx, 32, -1.5, 18, 1.2, 0, 0.6);
        Art.limb(ctx, 5, -9, 5, 9, 4, '#ffcf3a', { lineWidth: 1.4 });
        Art.body(ctx, -3, 0, 3.6, 3.6, o.rage ? '#ff3b6b' : '#b36bff', { highlight: false });
        if (o.windup >= 0) Art.sparkle(ctx, 58, 0, 8, '#ffffff', 0.9);
        ctx.restore();
        if (o.dizzy) BossGhost.drawStunStars(ctx, 0, -56, 32, 4, 0);
        else if (o.windup >= 0 && o.windup < 0.6) BossGhost.drawAlert(ctx, 0, -66 + Math.sin(t * 18) * 1.5, 1.3);
    }
}

// ══════════════════════════════════════════
// ── Boss-Varianten für Welt 11 und 12 ──
// ══════════════════════════════════════════

// ── Boss Welt 11: Pixel-Roboter (Angriffe wie das Riesen-Küken) ──
class BossPixelRobot extends BossGhostChick {
    constructor(x, y) {
        super(x, y);
        this.fxColor = '#39f0ff';
    }

    // Pixel-Roboter aus Neon-Klötzchen (Mittelpunkt 0,0)
    _drawBody(ctx, o) {
        const t = o.t;
        const P = 5; // Kantenlänge eines Pixels
        const ox = -9 * P;
        const oy = -9 * P;
        Art.glow(ctx, 0, 0, 82, o.rage ? '#ff3b8a' : '#3fc8ff', 0.3 + 0.08 * Math.sin(t * 5));
        // Düsenflammen (zwei Bilder im Wechsel)
        const fl = Math.floor(t * 12) % 2;
        this._px(ctx, ox + 5 * P, oy + 18 * P, P, 3, 1 + fl, '#ff9f1c');
        this._px(ctx, ox + 10 * P, oy + 18 * P, P, 3, 2 - fl, '#ff9f1c');
        this._px(ctx, ox + 6 * P, oy + 18 * P, P, 1, 1 + fl, '#ffe14d');
        this._px(ctx, ox + 11 * P, oy + 18 * P, P, 1, 2 - fl, '#ffe14d');
        // Körper (Pixel-Läufe, einmal vorberechnet)
        const glitch = o.rage && Math.floor(t * 6) % 5 === 0 ? ((Math.floor(t * 6) * 7) % 3) - 1 : 0;
        const pal = o.rage ? BossPixelRobot.RAGE : BossPixelRobot.PAL;
        const runs = BossPixelRobot._runs();
        for (let i = 0; i < runs.length; i++) {
            const r = runs[i];
            const gx = r[1] >= 5 && r[1] <= 10 ? glitch : 0;
            ctx.fillStyle = pal[r[3]];
            ctx.fillRect(ox + (r[0] + gx) * P, oy + r[1] * P, r[2] * P + 0.35, P + 0.35);
        }
        // Arme mit Greifern am Rumpf (wippen leicht)
        const arm = o.dizzy ? 1 : Math.round(Math.sin(t * 4));
        for (let side = -1; side <= 1; side += 2) {
            const ax = ox + (side < 0 ? 1 : 16) * P;
            const ay = oy + (12 + (side < 0 ? arm : -arm)) * P;
            ctx.fillStyle = pal.k;
            ctx.fillRect(ax - 1, ay - 1, 2 * P + 2, 4 * P + 2);
            this._px(ctx, ax, ay, P, 2, 3, pal.m);
            this._px(ctx, ax, ay + 3 * P, P, 2, 1, pal.p);
        }
        // Bildschirm-Gesicht (blickt ein Pixel nach links oder rechts)
        const face = o.dizzy ? BossPixelRobot.FACE_DIZZY : (o.charge ? BossPixelRobot.FACE_ALERT : (o.rage ? BossPixelRobot.FACE_RAGE : BossPixelRobot.FACE));
        const fc = o.dizzy ? '#ffe14d' : (o.charge ? '#ff4fd8' : (o.rage ? '#ff3b4e' : '#39f0ff'));
        const blink = face === BossPixelRobot.FACE && Art.blink(3.3) < 0.5;
        const look = o.dizzy ? 0 : Math.round(clamp(this.lookDir.x * 1.4, -1, 1));
        const sx = ox + (4 + look + glitch) * P;
        const sy = oy + 6 * P;
        ctx.fillStyle = fc;
        for (let y = 0; y < face.length; y++) {
            if (blink && y < 3) continue;
            const row = face[y];
            for (let x = 0; x < row.length; x++) {
                if (row[x] === 'c') ctx.fillRect(sx + x * P, sy + y * P, P + 0.35, P + 0.35);
            }
        }
        if (blink) {
            ctx.fillRect(sx + 1 * P, sy + 2 * P, 2 * P, P);
            ctx.fillRect(sx + 7 * P, sy + 2 * P, 2 * P, P);
        }
        Art.glow(ctx, sx + 5 * P, sy + 2.5 * P, 40, fc, 0.35);
        // Scanlinien und Glanz auf dem Bildschirm
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let y = 0; y < 5; y++) ctx.fillRect(ox + 3 * P, oy + (6 + y) * P + P * 0.7, 12 * P, P * 0.3);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(ox + 3 * P, oy + 6 * P, 2 * P, P * 0.6);
        // Antennen-Lampe blinkt
        if (Math.floor(t * 3) % 2 === 0 || o.charge) Art.glow(ctx, 0, oy + 1.5 * P, 16, '#ffe14d', 0.9);
        if (o.dizzy) BossGhost.drawStunStars(ctx, 0, oy - 8, 34, 4, 0);
        else if (o.charge) BossGhost.drawAlert(ctx, 0, oy - 16 + Math.sin(t * 18) * 1.5, 1.3);
    }

    // Rechteck aus w × h Pixeln
    _px(ctx, x, y, P, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w * P + 0.35, h * P + 0.35);
    }

    // Sprite einmal in waagerechte Läufe [x, y, länge, farbzeichen] zerlegen
    static _runs() {
        if (BossPixelRobot._cache) return BossPixelRobot._cache;
        const out = [];
        const rows = BossPixelRobot.SPRITE;
        for (let y = 0; y < rows.length; y++) {
            const row = rows[y];
            let x = 0;
            while (x < row.length) {
                const ch = row[x];
                let n = 1;
                while (x + n < row.length && row[x + n] === ch) n++;
                if (ch !== '.') out.push([x, y, n, ch]);
                x += n;
            }
        }
        BossPixelRobot._cache = out;
        return out;
    }
}
// k Umriss, l hell, b Blech, d dunkel, s Bildschirm, y gelb, p pink, g grün, m Arm
BossPixelRobot.SPRITE = [
    '........kk........',
    '.......kyyk.......',
    '.......kyyk.......',
    '........kk........',
    '..kkkkkkkkkkkkkk..',
    '.kllllllllllllllk.',
    'kklssssssssssssbkk',
    'kplssssssssssssbpk',
    'kplssssssssssssdpk',
    'kklssssssssssssdkk',
    '.klssssssssssssdk.',
    '.kbbbbbbbbbbbbbdk.',
    '..kkkkkkkkkkkkkk..',
    '...kdbbbbbbbbbdk..',
    '...kdbgbpbybbbdk..',
    '...kdbbbbbbbbbdk..',
    '....kkkkkkkkkkk...',
    '.....kddk.kddk....',
];
BossPixelRobot.PAL = { k: '#1c1446', l: '#9aa8ff', b: '#4f63ff', d: '#3443c4', s: '#10183a', y: '#ffe14d', p: '#ff4fd8', g: '#b6ff3b', m: '#aab4d4' };
BossPixelRobot.RAGE = { k: '#2a0c2e', l: '#ff9ad0', b: '#ff4f8b', d: '#c42f6a', s: '#1f0a1e', y: '#ffe14d', p: '#39f0ff', g: '#b6ff3b', m: '#ffc2dc' };
BossPixelRobot.FACE = [
    '..........',
    '.cc....cc.',
    '.cc....cc.',
    '..........',
    '...cccc...',
];
BossPixelRobot.FACE_RAGE = [
    'c........c',
    '.cc....cc.',
    '..cc..cc..',
    '..........',
    '..cccccc..',
];
BossPixelRobot.FACE_ALERT = [
    'ccc....ccc',
    'c.c....c.c',
    'ccc....ccc',
    '..........',
    '....cc....',
];
BossPixelRobot.FACE_DIZZY = [
    'c.c....c.c',
    '.c......c.',
    'c.c....c.c',
    '..........',
    '...cccc...',
];

// ── Boss Welt 12: Sternen-Ritter (Angriffe wie die Schatten-Fledermaus) ──
class BossStarKnight extends BossKnightBat {
    constructor(x, y) {
        super(x, y);
        this.fxColor = '#ffd23f';
    }

    // Goldener Kometenschweif im Sturzflug
    _drawTrail(ctx, cx, cy) {
        const bx = -this.swoopDir.x;
        const by = -this.swoopDir.y;
        const t = Art.time;
        for (let i = 1; i <= 5; i++) {
            const d = 22 + i * 16;
            Art.glow(ctx, cx + bx * d, cy + by * d, 34 - i * 4, i < 3 ? '#fff1a8' : '#ffb627', 0.7 - i * 0.1);
            Art.sparkle(ctx, cx + bx * d + Math.sin(t * 20 + i * 2) * 10 * -by, cy + by * d + Math.sin(t * 20 + i * 2) * 10 * bx, 4 - i * 0.5, '#ffffff', 0.9);
        }
    }

    // Ritter in Sternen-Rüstung mit wehendem Umhang (Mittelpunkt 0,0)
    _drawBody(ctx, o) {
        const t = o.t;
        const armor = o.rage ? '#6d4cff' : '#4f6dff';
        const gold = '#ffcf3a';
        const hot = o.rage ? '#ff6a3d' : gold;
        Art.glow(ctx, 0, 0, 100, o.rage ? '#ff5a3d' : '#7b5cff', 0.28 + 0.08 * Math.sin(t * 4));
        ctx.save();
        ctx.scale(1.18, 1.18);
        // Umhang weht hinter dem Ritter
        const wv = o.st === 'swoop' ? 1.8 : 1;
        const f1 = Math.sin(t * 3.2) * 6 * wv;
        const f2 = Math.sin(t * 3.2 + 1.5) * 7 * wv;
        const cape = o.rage ? '#8a2fb0' : '#5a3fe0';
        Art.shape(ctx, c => {
            c.moveTo(-20, -14);
            c.quadraticCurveTo(-40 + f1, 16, -36 + f2, 46);
            c.quadraticCurveTo(-24, 40 + f1 * 0.5, -12, 48);
            c.quadraticCurveTo(0, 42 - f2 * 0.4, 12, 48);
            c.quadraticCurveTo(24, 40 - f1 * 0.5, 36 - f2, 46);
            c.quadraticCurveTo(40 - f1, 16, 20, -14);
            c.closePath();
        }, { x: -40, y: -14, w: 80, h: 62 }, cape, { lineWidth: 2.2 });
        // Sterne im Umhang funkeln
        const stars = BossStarKnight.CAPE_STARS;
        for (let i = 0; i < stars.length; i += 2) {
            Art.sparkle(ctx, stars[i], stars[i + 1], 2.6, o.rage ? '#ffb38a' : '#fff1a8', 0.45 + 0.45 * Math.sin(t * 4 + i));
        }
        // Beine schweben, Stiefel mit Goldkappen, Sternenstaub darunter
        Art.box(ctx, -13, 20, 10, 15, 4, armor, { lineWidth: 2 });
        Art.box(ctx, 3, 20, 10, 15, 4, armor, { lineWidth: 2 });
        Art.body(ctx, -8, 36, 6, 3.6, gold, { lineWidth: 1.6 });
        Art.body(ctx, 8, 36, 6, 3.6, gold, { lineWidth: 1.6 });
        for (let i = 0; i < 3; i++) {
            const q = (t * 1.6 + i / 3) % 1;
            Art.sparkle(ctx, (i - 1) * 9, 42 + q * 14, 3 * (1 - q), '#ffe066', 1 - q);
        }
        // Brustpanzer mit Sternwappen
        Art.shape(ctx, c => {
            c.moveTo(-21, -10);
            c.quadraticCurveTo(0, -16, 21, -10);
            c.lineTo(18, 16);
            c.quadraticCurveTo(0, 30, -18, 16);
            c.closePath();
        }, { x: -21, y: -16, w: 42, h: 46 }, armor, { glossy: true, lineWidth: 2.2 });
        ctx.strokeStyle = gold;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-17, -8);
        ctx.quadraticCurveTo(0, -13, 17, -8);
        ctx.stroke();
        Art.star(ctx, 0, 6, 10, hot, { lineWidth: 1.6 });
        // Schulterplatten
        Art.body(ctx, -22, -9, 9, 7, gold, { glossy: true });
        Art.body(ctx, 22, -9, 9, 7, gold, { glossy: true });
        // Helm mit leuchtendem Visier und Sternkamm
        ctx.save();
        ctx.translate(0, -26);
        if (o.dizzy) ctx.rotate(-0.22);
        Art.star(ctx, 0, -17, 8, hot, { lineWidth: 1.6 });
        Art.body(ctx, 0, 0, 16, 15, armor, { glossy: true, lineWidth: 2.2 });
        Art.box(ctx, -13, -5, 26, 7, 3.5, '#120a2e', { outline: false, highlight: false });
        const visor = o.rage ? '#ff5a5a' : '#8ff7ff';
        if (o.dizzy) {
            ctx.strokeStyle = visor;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-9, -1.5); ctx.lineTo(9, -1.5);
            ctx.stroke();
        } else {
            const lx = Math.abs(this.lookDir.x) * 2.5;
            Art.glow(ctx, lx, -1.5, o.windup >= 0 ? 26 : 18, visor, 0.75);
            ctx.fillStyle = o.windup >= 0 ? '#ffffff' : visor;
            ctx.beginPath();
            ctx.roundRect(-9 + lx, -3, 18, 3, 1.5);
            ctx.fill();
        }
        ctx.restore();
        // Sternenschwert mit leuchtender Klinge
        ctx.save();
        ctx.translate(24, 8);
        const sa = this._swordAngle(o);
        ctx.rotate(sa);
        const blade = o.rage ? '#ffd0b8' : '#c9f7ff';
        Art.glow(ctx, 32, 0, 24, o.rage ? '#ff8a5a' : '#6ff0ff', 0.55);
        Art.limb(ctx, 7, 0, 50, 0, 6, blade, { lineWidth: 1.4, outline: '#3a6bd8' });
        Art.shine(ctx, 29, -1.2, 15, 1, 0, 0.7);
        Art.limb(ctx, 6, -8, 6, 8, 4, gold, { lineWidth: 1.4 });
        Art.body(ctx, 1.5, 0, 4.2, 3.8, armor, { highlight: false, lineWidth: 1.4 });
        Art.star(ctx, -4, 0, 4.5, gold, { lineWidth: 1.2 });
        if (o.windup >= 0) Art.sparkle(ctx, 50, 0, 9, '#ffffff', 0.95);
        ctx.restore();
        ctx.restore();
        if (o.dizzy) BossGhost.drawStunStars(ctx, 0, -70, 34, 5, 0);
        else if (o.windup >= 0 && o.windup < 0.6) BossGhost.drawAlert(ctx, 0, -78 + Math.sin(t * 18) * 1.5, 1.3);
    }
}
// Funkelsterne im Umhang (x, y, …)
BossStarKnight.CAPE_STARS = [-26, 12, -18, 34, 24, 20, 14, 38, -6, 40, 30, 38];

// ══════════════════════════════════════════
// ── Companion AI: Juri (Clown) ──
// ══════════════════════════════════════════

class Juri {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 24; this.h = 24;
        this.hp = 12; this.maxHp = 12; // 3 hearts
        this.speed = 130; this.damage = 3;
        this.dead = false; this.iFrames = 0;
        this.attackTimer = 0; this.attackCooldown = 0.8;
        this.hitCount = 0; this.fireCircle = false;
        this.target = null; this.swingAngle = 0;
        this.swinging = false; this.swingTimer = 0;
    }
    centerX() { return this.x + this.w/2; }
    centerY() { return this.y + this.h/2; }

    takeDamage(amount) {
        if (this.iFrames > 0 || this.dead) return;
        this.hp -= amount; this.iFrames = 1;
        if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    }

    update(dt, world, player, enemies) {
        if (this.dead) return;
        if (this.iFrames > 0) this.iFrames -= dt;

        // Follow player
        const px = player.x + player.w/2, py = player.y + player.h/2;
        const dist = vecDist({x:this.centerX(),y:this.centerY()}, {x:px,y:py});
        if (dist > 60) {
            const a = angleBetween({x:this.centerX(),y:this.centerY()}, {x:px,y:py});
            const dx = Math.cos(a) * this.speed * dt;
            const dy = Math.sin(a) * this.speed * dt;
            this.x += dx; this.y += dy;
        }

        // Find nearest enemy
        this.target = null;
        let minDist = 150;
        for (const e of enemies) {
            if (e.dead) continue;
            const d = vecDist({x:this.centerX(),y:this.centerY()}, {x:e.centerX(),y:e.centerY()});
            if (d < minDist) { minDist = d; this.target = e; }
        }

        // Attack
        this.attackTimer -= dt;
        if (this.swinging) { this.swingTimer -= dt; if (this.swingTimer <= 0) this.swinging = false; }
        if (this.target && this.attackTimer <= 0 && minDist < 50) {
            this.attackTimer = this.attackCooldown;
            this.swinging = true; this.swingTimer = 0.2;
            this.swingAngle = angleBetween({x:this.centerX(),y:this.centerY()}, {x:this.target.centerX(),y:this.target.centerY()});
            this.target.takeDamage(this.damage, this.swingAngle, 100);
            this.hitCount++;
            if (this.fireCircle && this.hitCount % 3 === 0) {
                // Fire circle around Juri
                for (const e of enemies) {
                    if (e.dead) continue;
                    const d = vecDist({x:this.centerX(),y:this.centerY()}, {x:e.centerX(),y:e.centerY()});
                    if (d < 80) e.takeDamage(4, angleBetween({x:this.centerX(),y:this.centerY()}, {x:e.centerX(),y:e.centerY()}), 150);
                }
            }
        }

        // Contact damage from enemies
        for (const e of enemies) {
            if (e.dead || !e.contactDamage) continue;
            if (rectOverlap({x:this.x,y:this.y,w:this.w,h:this.h}, {x:e.x,y:e.y,w:e.w,h:e.h})) {
                this.takeDamage(e.damage);
            }
        }
    }

    draw(ctx, camera) {
        if (this.dead) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames*10)%2;
        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Body (red with white stripes)
        ctx.fillStyle = '#D33';
        ctx.beginPath(); ctx.roundRect(cx-8,cy-4,16,14,3); ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.fillRect(cx-2,cy-4,4,14);

        // Head
        ctx.fillStyle = '#FCA';
        ctx.beginPath(); ctx.arc(cx,cy-10,8,0,Math.PI*2); ctx.fill();
        // Red nose
        ctx.fillStyle = '#F00';
        ctx.beginPath(); ctx.arc(cx,cy-8,3,0,Math.PI*2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(cx-3,cy-12,2.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+3,cy-12,2.5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx-3,cy-11.5,1,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+3,cy-11.5,1,0,Math.PI*2); ctx.fill();
        // Smile
        ctx.strokeStyle = '#800';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx,cy-7,4,0.2,Math.PI-0.2); ctx.stroke();

        // Hammers on chains
        if (this.swinging) {
            ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
            const hx = cx+Math.cos(this.swingAngle)*20, hy = cy+Math.sin(this.swingAngle)*18;
            ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(hx,hy); ctx.stroke();
            ctx.fillStyle = '#888';
            ctx.beginPath(); ctx.arc(hx,hy,6,0,Math.PI*2); ctx.fill();
        }

        // Fire circle effect
        if (this.fireCircle && this.hitCount > 0 && this.hitCount % 3 === 0 && this.swingTimer > 0) {
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#F80'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(cx,cy,40+Math.sin(Date.now()/100)*10,0,Math.PI*2); ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // HP bar above head
        ctx.globalAlpha = 1;
        const barW = 20, barH = 3;
        ctx.fillStyle = '#333';
        ctx.fillRect(cx-barW/2, pos.y-18, barW, barH);
        ctx.fillStyle = '#F44';
        ctx.fillRect(cx-barW/2, pos.y-18, barW*(this.hp/this.maxHp), barH);

        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Companion AI: Shadow Crocodile ──
// ══════════════════════════════════════════

class ShadowCrocodile {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 28; this.h = 26;
        this.hp = 20; this.maxHp = 20; // 5 hearts
        this.speed = 120; this.damage = 4;
        this.dead = false; this.iFrames = 0;
        this.shootTimer = 0; this.shootCooldown = 1.2;
        this.fireExplosion = false;
        this.target = null; this.facingAngle = 0;
    }
    centerX() { return this.x + this.w/2; }
    centerY() { return this.y + this.h/2; }

    takeDamage(amount) {
        if (this.iFrames > 0 || this.dead) return;
        this.hp -= amount; this.iFrames = 1;
        if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    }

    update(dt, world, player, enemies) {
        if (this.dead) return;
        if (this.iFrames > 0) this.iFrames -= dt;

        // Follow player
        const px = player.x+player.w/2, py = player.y+player.h/2;
        const dist = vecDist({x:this.centerX(),y:this.centerY()}, {x:px,y:py});
        if (dist > 70) {
            const a = angleBetween({x:this.centerX(),y:this.centerY()}, {x:px,y:py});
            this.x += Math.cos(a)*this.speed*dt;
            this.y += Math.sin(a)*this.speed*dt;
        }

        // Find nearest enemy
        this.target = null;
        let minDist = 250;
        for (const e of enemies) {
            if (e.dead) continue;
            const d = vecDist({x:this.centerX(),y:this.centerY()}, {x:e.centerX(),y:e.centerY()});
            if (d < minDist) { minDist = d; this.target = e; }
        }

        // Shoot at target
        this.shootTimer -= dt;
        if (this.target && this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            this.facingAngle = angleBetween({x:this.centerX(),y:this.centerY()}, {x:this.target.centerX(),y:this.target.centerY()});
            if (typeof Game !== 'undefined') {
                const p = new Projectile(this.centerX(), this.centerY(),
                    Math.cos(this.facingAngle)*250, Math.sin(this.facingAngle)*250,
                    this.damage, 'player', 80);
                p.radius = 4;
                if (this.fireExplosion) p.explosive = true;
                Game.projectiles.push(p);
            }
        }

        // Contact damage
        for (const e of enemies) {
            if (e.dead || !e.contactDamage) continue;
            if (rectOverlap({x:this.x,y:this.y,w:this.w,h:this.h}, {x:e.x,y:e.y,w:e.w,h:e.h})) {
                this.takeDamage(e.damage);
            }
        }
    }

    draw(ctx, camera) {
        if (this.dead) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames*10)%2;
        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Body (green croc with armor)
        ctx.fillStyle = '#3A6A3A';
        ctx.beginPath(); ctx.ellipse(cx,cy,13,10,0,0,Math.PI*2); ctx.fill();
        // Armor plates
        ctx.fillStyle = '#777';
        ctx.beginPath(); ctx.roundRect(cx-8,cy-6,16,12,3); ctx.fill();
        // Helmet
        ctx.fillStyle = '#888';
        ctx.beginPath(); ctx.arc(cx,cy-10,9,Math.PI,0); ctx.fill();
        ctx.fillStyle = '#666';
        ctx.fillRect(cx-8,cy-11,16,4);
        // Snout
        ctx.fillStyle = '#4A8A4A';
        ctx.beginPath(); ctx.ellipse(cx+Math.cos(this.facingAngle)*10,cy+Math.sin(this.facingAngle)*6,7,4,this.facingAngle,0,Math.PI*2); ctx.fill();
        // Eyes (red)
        ctx.fillStyle = '#F44';
        ctx.beginPath(); ctx.arc(cx-4,cy-8,2.5,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+4,cy-8,2.5,0,Math.PI*2); ctx.fill();
        // Weapon (Schattenspucker in right hand)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx+8,cy);
        ctx.lineTo(cx+Math.cos(this.facingAngle)*18+8, cy+Math.sin(this.facingAngle)*14);
        ctx.stroke();

        // HP bar above head
        ctx.globalAlpha = 1;
        const barW = 24, barH = 3;
        ctx.fillStyle = '#333';
        ctx.fillRect(cx-barW/2, pos.y-18, barW, barH);
        ctx.fillStyle = '#4D4';
        ctx.fillRect(cx-barW/2, pos.y-18, barW*(this.hp/this.maxHp), barH);

        ctx.restore();
    }
}


// ══════════════════════════════════════════════════════════════
// BossMushroomGiant - RIESEN PILZ (World 5)
// ══════════════════════════════════════════════════════════════
class BossMushroomGiant extends Enemy {
    constructor(x, y) {
        super(x, y, 90, 100);
        this.hp = 50;
        this.maxHp = 50;
        this.speed = 20;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.phase = 1;

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        // Spore cloud
        this.sporeCooldown = 4;
        this.sporeTimer = 3;

        // Vine attack
        this.vines = [];
        this.vineTimer = 0;
        this.vineCooldown = 5;

        // Spore ambient particles
        this.sporeParticles = [];
        for (let i = 0; i < 8; i++) {
            this.sporeParticles.push({
                ox: randRange(-50, 50),
                oy: randRange(-60, 20),
                phase: Math.random() * Math.PI * 2,
                speed: randRange(0.5, 1.5)
            });
        }
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        if (this.hp <= 25 && this.phase === 1) {
            this.phase = 2;
            this.sporeCooldown = 2.5;
            this.vineCooldown = 3.5;
        }

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) { this.state = 'wander'; this.stateTimer = 2; }
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) { this.state = 'wander'; this.stateTimer = 2; }
            return;
        }

        // Update vines
        for (const vine of this.vines) {
            vine.progress += dt * 2;
            if (vine.progress >= 1) {
                // Check damage at vine endpoint
                const ex = vine.sx + vine.dx * 1;
                const ey = vine.sy + vine.dy * 1;
                const dist = Math.sqrt((ex - pc.x) ** 2 + (ey - pc.y) ** 2);
                if (dist < 30 && !vine.hit) {
                    vine.hit = true;
                    player.takeDamage(2, angleBetween(mc, pc), 200);
                }
            }
        }
        this.vines = this.vines.filter(v => v.progress < 1.5);

        if (this.state === 'spore_cloud') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                // Fire spore projectiles
                const count = this.phase === 2 ? 10 : 6;
                if (projectiles) {
                    for (let i = 0; i < count; i++) {
                        const a = (Math.PI * 2 * i) / count;
                        const speed = 140;
                        projectiles.push(new Projectile(
                            mc.x, mc.y,
                            Math.cos(a) * speed, Math.sin(a) * speed,
                            1, 'enemy', 80
                        ));
                    }
                }
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        if (this.state === 'vine_attack') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                // Spawn vines
                const vineCount = this.phase === 2 ? 6 : 4;
                for (let i = 0; i < vineCount; i++) {
                    const spread = (i - (vineCount - 1) / 2) * 0.3;
                    const angle = angleBetween(mc, pc) + spread;
                    this.vines.push({
                        sx: mc.x, sy: mc.y + 30,
                        dx: Math.cos(angle) * 200,
                        dy: Math.sin(angle) * 200,
                        progress: 0, hit: false
                    });
                }
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        // Wander state - move slowly toward player
        const angle = angleBetween(mc, pc);
        const dx = Math.cos(angle) * this.speed * dt;
        const dy = Math.sin(angle) * this.speed * dt;
        this._moveWithCollision(dx, dy, world);

        // Attack timers
        this.sporeTimer -= dt;
        this.vineTimer -= dt;

        if (this.sporeTimer <= 0) {
            this.sporeTimer = this.sporeCooldown;
            this.state = 'spore_cloud';
            this.stateTimer = 0.8;
            return;
        }

        if (this.vineTimer <= 0) {
            this.vineTimer = this.vineCooldown;
            this.state = 'vine_attack';
            this.stateTimer = 0.6;
            return;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        if (this.dead) {
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            // Mushroom explodes into spore cloud
            for (let i = 0; i < 20; i++) {
                const a = (Math.PI * 2 * i) / 20 + t * 2;
                const dist = t * 100;
                ctx.globalAlpha = (1 - t) * 0.8;
                ctx.fillStyle = i % 3 === 0 ? '#A020F0' : i % 3 === 1 ? '#FF4444' : '#FFFFFF';
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, (1 - t) * (8 + i % 5), 0, Math.PI * 2);
                ctx.fill();
            }
            // Central flash
            ctx.globalAlpha = (1 - t);
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(cx, cy, (1 - t) * 50 + t * 80, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Draw vines
        for (const vine of this.vines) {
            const p = Math.min(vine.progress, 1);
            const vpos = camera.worldToScreen(vine.sx, vine.sy);
            ctx.strokeStyle = '#228B22';
            ctx.lineWidth = 4;
            ctx.globalAlpha = flash ? 0.4 : 0.8;
            ctx.beginPath();
            ctx.moveTo(vpos.x, vpos.y);
            ctx.lineTo(vpos.x + vine.dx * p, vpos.y + vine.dy * p);
            ctx.stroke();
            // Vine tip thorns
            if (p > 0.5) {
                ctx.fillStyle = '#32CD32';
                ctx.beginPath();
                ctx.arc(vpos.x + vine.dx * p, vpos.y + vine.dy * p, 6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = flash ? 0.4 : 1;
        }

        // Stem (thick beige trunk)
        const stemGrad = ctx.createLinearGradient(cx - 20, cy, cx + 20, cy);
        stemGrad.addColorStop(0, '#D2B48C');
        stemGrad.addColorStop(0.5, '#F5DEB3');
        stemGrad.addColorStop(1, '#D2B48C');
        ctx.fillStyle = stemGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 22, cy + 50);
        ctx.lineTo(cx - 18, cy - 10);
        ctx.lineTo(cx + 18, cy - 10);
        ctx.lineTo(cx + 22, cy + 50);
        ctx.closePath();
        ctx.fill();

        // Mushroom cap (red dome with white spots)
        const capGrad = ctx.createRadialGradient(cx - 10, cy - 35, 5, cx, cy - 20, 50);
        capGrad.addColorStop(0, '#FF4444');
        capGrad.addColorStop(0.7, '#CC0000');
        capGrad.addColorStop(1, '#880000');
        ctx.fillStyle = capGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 20, 48, 35, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();

        // White spots on cap
        ctx.fillStyle = '#FFF';
        const spots = [[-20, -35, 8], [10, -40, 6], [25, -28, 7], [-30, -25, 5], [0, -48, 5], [15, -20, 4]];
        for (const [sx, sy, sr] of spots) {
            ctx.beginPath();
            ctx.arc(cx + sx, cy + sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Cap rim
        ctx.fillStyle = '#AA0000';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, 50, 10, 0, 0, Math.PI);
        ctx.fill();

        // Angry face on stem
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(cx - 10, cy + 12, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 10, cy + 12, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Angry brows
        ctx.strokeStyle = '#4A3520';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy + 6);
        ctx.lineTo(cx - 6, cy + 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 18, cy + 6);
        ctx.lineTo(cx + 6, cy + 9);
        ctx.stroke();
        // Angry mouth
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(cx, cy + 25, 8, 0, Math.PI);
        ctx.fill();

        // Purple spore particles floating around
        const t = Date.now() / 1000;
        ctx.globalAlpha = flash ? 0.2 : 0.5;
        for (const sp of this.sporeParticles) {
            const fx = cx + sp.ox + Math.sin(t * sp.speed + sp.phase) * 12;
            const fy = cy + sp.oy + Math.cos(t * sp.speed * 0.7 + sp.phase) * 8;
            ctx.fillStyle = '#A020F0';
            ctx.beginPath();
            ctx.arc(fx, fy, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Stunned stars
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#FF0';
            ctx.font = '14px monospace';
            for (let i = 0; i < 5; i++) {
                const sa = Date.now() / 250 + i * Math.PI * 2 / 5;
                ctx.fillText('\u2605', cx + Math.cos(sa) * 40 - 5, cy - 55 + Math.sin(sa) * 8);
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        const barW = 100;
        const barX = cx - barW / 2;
        const barY = pos.y - 25;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RIESEN PILZ', cx, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.4 ? '#A020F0' : hpPct > 0.2 ? '#FA0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, 5, 2); ctx.fill();

        ctx.restore();
    }
}


// ══════════════════════════════════════════════════════════════
// BossMosquito - RIESEN MUECKE (World 6)
// ══════════════════════════════════════════════════════════════
class BossMosquito extends Enemy {
    constructor(x, y) {
        super(x, y, 80, 60);
        this.hp = 55;
        this.maxHp = 55;
        this.speed = 60;
        this.damage = 2;
        this.phasesThroughWalls = true;
        this.isBoss = true;
        this.contactDamage = false;

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        // Spin attack
        this.spinAngle = 0;
        this.spinVx = 0;
        this.spinVy = 0;
        this.spinDamageDealt = false;

        // Arrow ram
        this.ramTarget = { x: 0, y: 0 };
        this.ramPhase = 'none';
        this.ramTimer = 0;

        // Spawn timer
        this.spawnTimer = 12;
        this.spawnCooldown = 12;

        // Wing animation
        this.wingAnim = 0;
        this.bobTimer = 0;

        // Attack cooldown
        this.attackTimer = 3;
        this.attackCooldown = 3.5;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        this.wingAnim += dt * 25;
        this.bobTimer += dt;

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) { this.state = 'hover'; this.stateTimer = 2; }
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) { this.state = 'hover'; this.stateTimer = 2; }
            return;
        }

        if (this.state === 'spin') {
            this.stateTimer -= dt;
            this.x += this.spinVx * dt;
            this.y += this.spinVy * dt;
            this.spinAngle += dt * 15;
            // Check collision with player
            const dist = vecDist(mc, pc);
            if (dist < 50 && !this.spinDamageDealt) {
                this.spinDamageDealt = true;
                player.takeDamage(2, angleBetween(mc, pc), 300);
            }
            if (this.stateTimer <= 0) {
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        if (this.state === 'arrow_ram') {
            if (this.ramPhase === 'rise') {
                this.ramTimer -= dt;
                this.y -= 120 * dt;
                if (this.ramTimer <= 0) {
                    this.ramPhase = 'charge';
                    this.ramTimer = 0.5;
                    this.ramTarget = { x: pc.x, y: pc.y };
                    const angle = angleBetween(mc, this.ramTarget);
                    this.spinVx = Math.cos(angle) * 350;
                    this.spinVy = Math.sin(angle) * 350;
                    this.spinDamageDealt = false;
                }
            } else if (this.ramPhase === 'charge') {
                this.ramTimer -= dt;
                this.x += this.spinVx * dt;
                this.y += this.spinVy * dt;
                const dist = vecDist(mc, pc);
                if (dist < 50 && !this.spinDamageDealt) {
                    this.spinDamageDealt = true;
                    player.takeDamage(2, angleBetween(mc, pc), 350);
                }
                if (this.ramTimer <= 0) {
                    this.state = 'stunned';
                    this.stunnedTimer = 2;
                }
            }
            return;
        }

        // Hover state - buzzes side to side
        const angle = angleBetween(mc, pc);
        const buzzX = Math.sin(this.bobTimer * 4) * 30 * dt;
        this.x += Math.cos(angle) * this.speed * 0.5 * dt + buzzX;
        this.y += Math.sin(angle) * this.speed * 0.5 * dt;

        // Spawn minions
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && enemies) {
            this.spawnTimer = this.spawnCooldown;
            for (let i = 0; i < 2; i++) {
                const sa = (Math.PI * 2 * i) / 2 + Math.random();
                enemies.push(new GiantBat(
                    mc.x + Math.cos(sa) * 60,
                    mc.y + Math.sin(sa) * 60
                ));
            }
        }

        // Attack timer
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.attackCooldown;
            this.attackCycle++;
            if (this.attackCycle % 2 === 1) {
                // Spin attack
                this.state = 'spin';
                this.stateTimer = 1;
                const a = angleBetween(mc, pc);
                this.spinVx = Math.cos(a) * 250;
                this.spinVy = Math.sin(a) * 250;
                this.spinAngle = 0;
                this.spinDamageDealt = false;
            } else {
                // Arrow ram
                this.state = 'arrow_ram';
                this.ramPhase = 'rise';
                this.ramTimer = 0.6;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        if (this.dead) {
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            // Mosquito shatters into pieces
            for (let i = 0; i < 14; i++) {
                const a = (Math.PI * 2 * i) / 14 + t * 3;
                const dist = t * 90;
                ctx.globalAlpha = (1 - t) * 0.9;
                ctx.fillStyle = i % 2 === 0 ? '#666' : '#8B4513';
                ctx.beginPath();
                const size = (1 - t) * (5 + (i % 4) * 3);
                ctx.ellipse(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, size, size * 0.6, a, 0, Math.PI * 2);
                ctx.fill();
            }
            // Wing fragments
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 * i) / 6 + t;
                ctx.globalAlpha = (1 - t) * 0.4;
                ctx.fillStyle = 'rgba(200,220,255,0.5)';
                ctx.beginPath();
                ctx.ellipse(cx + Math.cos(a) * t * 70, cy + Math.sin(a) * t * 70, (1 - t) * 15, (1 - t) * 8, a, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Rotation for spin attack
        if (this.state === 'spin') {
            ctx.translate(cx, cy);
            ctx.rotate(this.spinAngle);
            ctx.translate(-cx, -cy);
        }

        // Translucent wings (flapping)
        const wingFlap = Math.sin(this.wingAnim) * 0.6;
        ctx.globalAlpha = flash ? 0.2 : 0.3;
        ctx.fillStyle = '#CCE0FF';
        ctx.strokeStyle = '#88AADD';
        ctx.lineWidth = 1;
        // Left wing
        ctx.beginPath();
        ctx.ellipse(cx - 30, cy - 15 + wingFlap * 10, 28, 14 + wingFlap * 5, -0.3 + wingFlap * 0.2, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Right wing
        ctx.beginPath();
        ctx.ellipse(cx + 30, cy - 15 - wingFlap * 10, 28, 14 - wingFlap * 5, 0.3 - wingFlap * 0.2, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.globalAlpha = flash ? 0.4 : 1;

        // Striped body
        const bodyGrad = ctx.createLinearGradient(cx, cy - 20, cx, cy + 25);
        bodyGrad.addColorStop(0, '#555');
        bodyGrad.addColorStop(0.3, '#777');
        bodyGrad.addColorStop(0.5, '#444');
        bodyGrad.addColorStop(0.7, '#777');
        bodyGrad.addColorStop(1, '#444');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 5, 22, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stripes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        for (let i = -2; i <= 3; i++) {
            const sy = cy + i * 8;
            ctx.beginPath();
            const sw = 20 - Math.abs(i) * 3;
            ctx.moveTo(cx - sw, sy);
            ctx.lineTo(cx + sw, sy);
            ctx.stroke();
        }

        // Head
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(cx, cy - 22, 14, 0, Math.PI * 2);
        ctx.fill();

        // Compound eyes (red, big)
        ctx.fillStyle = '#CC0000';
        ctx.beginPath();
        ctx.arc(cx - 10, cy - 25, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 10, cy - 25, 8, 0, Math.PI * 2);
        ctx.fill();
        // Eye facets
        ctx.fillStyle = '#FF3333';
        ctx.beginPath();
        ctx.arc(cx - 11, cy - 26, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 11, cy - 26, 3, 0, Math.PI * 2);
        ctx.fill();

        // Proboscis (long needle nose)
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 30);
        ctx.lineTo(cx, cy - 65);
        ctx.stroke();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 30);
        ctx.lineTo(cx, cy - 65);
        ctx.stroke();

        // Legs (thin)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 3; i++) {
                const ly = cy + i * 10;
                ctx.beginPath();
                ctx.moveTo(cx + side * 18, ly);
                ctx.lineTo(cx + side * 38, ly + 12 + i * 3);
                ctx.stroke();
            }
        }

        // Stunned stars
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#FF0';
            ctx.font = '12px monospace';
            for (let i = 0; i < 4; i++) {
                const sa = Date.now() / 250 + i * Math.PI / 2;
                ctx.fillText('\u2605', cx + Math.cos(sa) * 35 - 4, cy - 70 + Math.sin(sa) * 6);
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        const barW = 95;
        const barX = cx - barW / 2;
        const barY = pos.y - 30;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RIESEN MUECKE', cx, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.4 ? '#C44' : hpPct > 0.2 ? '#FA0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, 5, 2); ctx.fill();

        ctx.restore();
    }
}


// ══════════════════════════════════════════════════════════════
// BossSnowEagle - SCHNEE ADLER (World 7)
// ══════════════════════════════════════════════════════════════
class BossSnowEagle extends Enemy {
    constructor(x, y) {
        super(x, y, 100, 80);
        this.hp = 60;
        this.maxHp = 60;
        this.speed = 45;
        this.damage = 2;
        this.phasesThroughWalls = true;
        this.isBoss = true;
        this.contactDamage = false;

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        this.attackTimer = 3;
        this.attackCooldown = 3.5;

        // Wing animation
        this.wingAnim = 0;
        this.wingSpread = 1;

        // Frost particles trailing behind
        this.frostTrail = [];

        // Wind push
        this.windActive = false;
        this.windTimer = 0;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        this.wingAnim += dt * 3;

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };

        // Update frost trail
        if (Math.random() < 0.3) {
            this.frostTrail.push({
                x: mc.x + randRange(-40, 40),
                y: mc.y + randRange(-20, 20),
                life: 0.8,
                maxLife: 0.8,
                size: randRange(2, 5)
            });
        }
        for (const p of this.frostTrail) {
            p.life -= dt;
            p.y += 10 * dt;
        }
        this.frostTrail = this.frostTrail.filter(p => p.life > 0);

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) { this.state = 'soar'; this.stateTimer = 2.5; }
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            this.wingSpread = 0.5;
            if (this.stunnedTimer <= 0) { this.state = 'soar'; this.stateTimer = 2.5; this.wingSpread = 1; }
            return;
        }

        if (this.state === 'ice_rain') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                // Spawn ice feather projectiles from above
                if (projectiles) {
                    const count = 8;
                    for (let i = 0; i < count; i++) {
                        const spawnX = pc.x + (i - count / 2) * 40 + randRange(-15, 15);
                        const spawnY = mc.y - 200;
                        projectiles.push(new Projectile(
                            spawnX, spawnY,
                            randRange(-20, 20), randRange(150, 220),
                            1, 'enemy', 60
                        ));
                    }
                }
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        if (this.state === 'frost_wind') {
            this.stateTimer -= dt;
            this.windActive = true;
            // Push player away
            const angle = angleBetween(mc, pc);
            const pushForce = 400 * dt;
            player.x += Math.cos(angle) * pushForce;
            player.y += Math.sin(angle) * pushForce;

            if (this.stateTimer <= 0) {
                this.windActive = false;
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        // Soar state - circle around player
        this.wingSpread = 1;
        const dist = vecDist(mc, pc);
        const angle = angleBetween(mc, pc);
        const orbitAngle = angle + Math.PI / 2;
        if (dist > 180) {
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        } else if (dist < 120) {
            this.x -= Math.cos(angle) * this.speed * 0.5 * dt;
            this.y -= Math.sin(angle) * this.speed * 0.5 * dt;
        }
        this.x += Math.cos(orbitAngle) * this.speed * 0.6 * dt;
        this.y += Math.sin(orbitAngle) * this.speed * 0.6 * dt;

        // Attack timer
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.attackCooldown;
            this.attackCycle++;
            if (this.attackCycle % 2 === 1) {
                this.state = 'ice_rain';
                this.stateTimer = 0.8;
            } else {
                this.state = 'frost_wind';
                this.stateTimer = 1.5;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        if (this.dead) {
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            // Eagle dissolves into ice crystals
            for (let i = 0; i < 18; i++) {
                const a = (Math.PI * 2 * i) / 18 + t * 2;
                const dist = t * 110;
                ctx.globalAlpha = (1 - t) * 0.8;
                ctx.fillStyle = i % 3 === 0 ? '#ADE8FF' : i % 3 === 1 ? '#FFF' : '#78C8F0';
                ctx.save();
                ctx.translate(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
                ctx.rotate(a + t * 3);
                const s = (1 - t) * (4 + i % 6);
                ctx.fillRect(-s / 2, -s / 2, s, s);
                ctx.restore();
            }
            // Central ice burst
            ctx.globalAlpha = (1 - t) * 0.6;
            ctx.fillStyle = '#E0F0FF';
            ctx.beginPath();
            ctx.arc(cx, cy, (1 - t) * 50 + t * 70, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Frost trail particles
        for (const p of this.frostTrail) {
            const pp = camera.worldToScreen(p.x, p.y);
            ctx.globalAlpha = (p.life / p.maxLife) * 0.4;
            ctx.fillStyle = '#ADE8FF';
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = flash ? 0.4 : 1;

        const wingFlap = Math.sin(this.wingAnim) * 0.4 * this.wingSpread;

        // Wind visual effect
        if (this.windActive) {
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#ADE8FF';
            ctx.lineWidth = 3;
            for (let i = 0; i < 8; i++) {
                const wa = (Math.PI * 2 * i) / 8 + Date.now() / 200;
                const wr = 50 + i * 15;
                ctx.beginPath();
                ctx.arc(cx, cy, wr, wa, wa + 0.8);
                ctx.stroke();
            }
            ctx.globalAlpha = flash ? 0.4 : 1;
        }

        // Wings (majestic, white with ice-blue tips)
        for (let side = -1; side <= 1; side += 2) {
            const wingY = cy + wingFlap * 25 * side;
            // Outer wing (ice-blue tip)
            ctx.fillStyle = '#78C8F0';
            ctx.beginPath();
            ctx.moveTo(cx + side * 10, cy);
            ctx.quadraticCurveTo(cx + side * 45, wingY - 20, cx + side * 55, wingY + 5);
            ctx.quadraticCurveTo(cx + side * 40, cy + 15, cx + side * 10, cy + 10);
            ctx.closePath();
            ctx.fill();
            // Inner wing (white)
            ctx.fillStyle = '#F0F4FF';
            ctx.beginPath();
            ctx.moveTo(cx + side * 5, cy - 5);
            ctx.quadraticCurveTo(cx + side * 30, wingY - 15, cx + side * 42, wingY);
            ctx.quadraticCurveTo(cx + side * 25, cy + 10, cx + side * 5, cy + 8);
            ctx.closePath();
            ctx.fill();
            // Feather details
            ctx.strokeStyle = '#B0D4E8';
            ctx.lineWidth = 1;
            for (let f = 0; f < 4; f++) {
                const fx = cx + side * (15 + f * 10);
                ctx.beginPath();
                ctx.moveTo(fx, cy - 2);
                ctx.lineTo(fx + side * 5, wingY + f * 2);
                ctx.stroke();
            }
        }

        // Body (white, streamlined)
        const bodyGrad = ctx.createRadialGradient(cx, cy - 5, 3, cx, cy, 25);
        bodyGrad.addColorStop(0, '#FFFFFF');
        bodyGrad.addColorStop(0.7, '#E8EEF4');
        bodyGrad.addColorStop(1, '#C8D4E0');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 18, 25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#F8FCFF';
        ctx.beginPath();
        ctx.arc(cx, cy - 25, 14, 0, Math.PI * 2);
        ctx.fill();

        // Sharp yellow beak
        ctx.fillStyle = '#E8B000';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 28);
        ctx.lineTo(cx - 5, cy - 35);
        ctx.lineTo(cx + 5, cy - 35);
        ctx.closePath();
        ctx.fill();
        // Beak hook
        ctx.fillStyle = '#CC9500';
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy - 35);
        ctx.lineTo(cx, cy - 40);
        ctx.lineTo(cx + 3, cy - 35);
        ctx.closePath();
        ctx.fill();

        // Cold blue eyes
        ctx.fillStyle = '#2288CC';
        ctx.beginPath();
        ctx.arc(cx - 7, cy - 27, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 7, cy - 27, 4, 0, Math.PI * 2);
        ctx.fill();
        // Eye shine
        ctx.fillStyle = '#AAE4FF';
        ctx.beginPath();
        ctx.arc(cx - 8, cy - 28, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 28, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Tail feathers
        ctx.fillStyle = '#D0E0F0';
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(cx + i * 5, cy + 22);
            ctx.lineTo(cx + i * 8, cy + 40);
            ctx.lineTo(cx + i * 3, cy + 38);
            ctx.closePath();
            ctx.fill();
        }

        // Stunned stars
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#ADE8FF';
            ctx.font = '12px monospace';
            for (let i = 0; i < 5; i++) {
                const sa = Date.now() / 250 + i * Math.PI * 2 / 5;
                ctx.fillText('\u2744', cx + Math.cos(sa) * 42 - 5, cy - 40 + Math.sin(sa) * 7);
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        const barW = 100;
        const barX = cx - barW / 2;
        const barY = pos.y - 30;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCHNEE ADLER', cx, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.4 ? '#5AC8FA' : hpPct > 0.2 ? '#FA0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, 5, 2); ctx.fill();

        ctx.restore();
    }
}


// ══════════════════════════════════════════════════════════════
// BossFirePhoenix - FEUER PHOENIX (World 8)
// ══════════════════════════════════════════════════════════════
class BossFirePhoenix extends Enemy {
    constructor(x, y) {
        super(x, y, 100, 90);
        this.hp = 70;
        this.maxHp = 70;
        this.speed = 40;
        this.damage = 3;
        this.phasesThroughWalls = true;
        this.isBoss = true;
        this.contactDamage = false;
        this.phase = 1;

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        this.attackTimer = 3;
        this.attackCooldown = 3;

        // Wing flicker
        this.wingAnim = 0;

        // Ember particles
        this.embers = [];
        for (let i = 0; i < 12; i++) {
            this.embers.push({
                ox: randRange(-45, 45),
                oy: randRange(-40, 40),
                phase: Math.random() * Math.PI * 2,
                speed: randRange(1, 3),
                size: randRange(2, 5)
            });
        }

        // Flame tail particles
        this.tailParticles = [];
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        this.wingAnim += dt * 6;

        if (this.hp <= 35 && this.phase === 1) {
            this.phase = 2;
            this.attackCooldown = 2;
            this.speed = 50;
        }

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };

        // Update tail particles
        if (Math.random() < 0.5) {
            this.tailParticles.push({
                x: mc.x + randRange(-10, 10),
                y: mc.y + 35 + randRange(-5, 5),
                vx: randRange(-20, 20),
                vy: randRange(20, 60),
                life: randRange(0.3, 0.7),
                maxLife: 0.7,
                size: randRange(3, 7)
            });
        }
        for (const p of this.tailParticles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy -= 30 * dt;
            p.life -= dt;
        }
        this.tailParticles = this.tailParticles.filter(p => p.life > 0);

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) { this.state = 'fly'; this.stateTimer = 2; }
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) { this.state = 'fly'; this.stateTimer = 2; }
            return;
        }

        if (this.state === 'fireball') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                // Shoot 3 fireballs toward player, Juri position, and Crocodile position
                if (projectiles) {
                    const targets = [
                        { x: pc.x, y: pc.y },
                        { x: pc.x + 50, y: pc.y },
                        { x: pc.x - 50, y: pc.y }
                    ];
                    const multiplier = this.phase === 2 ? 2 : 1;
                    for (let m = 0; m < multiplier; m++) {
                        for (const tgt of targets) {
                            const a = angleBetween(mc, tgt);
                            const speed = 180 + m * 30;
                            projectiles.push(new Projectile(
                                mc.x, mc.y,
                                Math.cos(a) * speed, Math.sin(a) * speed,
                                2, 'enemy', 120
                            ));
                        }
                    }
                }
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        if (this.state === 'fire_wave') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                // Ring of projectiles expanding outward
                if (projectiles) {
                    const count = 12;
                    const multiplier = this.phase === 2 ? 2 : 1;
                    for (let m = 0; m < multiplier; m++) {
                        for (let i = 0; i < count; i++) {
                            const a = (Math.PI * 2 * i) / count + m * (Math.PI / count);
                            const speed = 160 + m * 40;
                            projectiles.push(new Projectile(
                                mc.x, mc.y,
                                Math.cos(a) * speed, Math.sin(a) * speed,
                                1, 'enemy', 80
                            ));
                        }
                    }
                }
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        // Fly state - circle and approach player
        const dist = vecDist(mc, pc);
        const angle = angleBetween(mc, pc);
        const orbitAngle = angle + Math.PI / 2;
        if (dist > 160) {
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        } else if (dist < 100) {
            this.x -= Math.cos(angle) * this.speed * 0.4 * dt;
            this.y -= Math.sin(angle) * this.speed * 0.4 * dt;
        }
        this.x += Math.cos(orbitAngle) * this.speed * 0.5 * dt;
        this.y += Math.sin(orbitAngle) * this.speed * 0.5 * dt;

        // Attack timer
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.attackCooldown;
            this.attackCycle++;
            if (this.attackCycle % 2 === 1) {
                this.state = 'fireball';
                this.stateTimer = 0.7;
            } else {
                this.state = 'fire_wave';
                this.stateTimer = 0.9;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        if (this.dead) {
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            // Phoenix death: massive fire explosion then rebirth sparkles
            for (let i = 0; i < 24; i++) {
                const a = (Math.PI * 2 * i) / 24 + t * 4;
                const dist = t * 120;
                ctx.globalAlpha = (1 - t) * 0.9;
                const hue = 20 + (i * 15) % 40;
                ctx.fillStyle = `hsl(${hue}, 100%, ${50 + i * 2}%)`;
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, (1 - t) * (6 + i % 8), 0, Math.PI * 2);
                ctx.fill();
            }
            // Inner white-hot core
            ctx.globalAlpha = (1 - t);
            const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, (1 - t) * 60);
            coreGrad.addColorStop(0, '#FFF');
            coreGrad.addColorStop(0.4, '#FFD700');
            coreGrad.addColorStop(1, '#FF4500');
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, (1 - t) * 60 + t * 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Tail fire particles (behind body)
        for (const p of this.tailParticles) {
            const pp = camera.worldToScreen(p.x, p.y);
            const lifeRatio = p.life / p.maxLife;
            ctx.globalAlpha = lifeRatio * 0.6;
            const hue = 20 + (1 - lifeRatio) * 30;
            ctx.fillStyle = `hsl(${hue}, 100%, ${50 + (1 - lifeRatio) * 20}%)`;
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, p.size * lifeRatio, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = flash ? 0.4 : 1;

        // Glow aura
        ctx.globalAlpha = 0.1;
        const auraGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70);
        auraGrad.addColorStop(0, '#FF6600');
        auraGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = flash ? 0.4 : 1;

        const wingFlap = Math.sin(this.wingAnim) * 0.5;

        // Flame wings
        for (let side = -1; side <= 1; side += 2) {
            const wingY = cy + wingFlap * 20 * side;
            // Outer wing (red-orange flame)
            const wingGrad = ctx.createLinearGradient(cx, cy, cx + side * 55, wingY);
            wingGrad.addColorStop(0, '#FF6600');
            wingGrad.addColorStop(0.5, '#FF4400');
            wingGrad.addColorStop(1, '#CC0000');
            ctx.fillStyle = wingGrad;
            ctx.beginPath();
            ctx.moveTo(cx + side * 8, cy - 10);
            ctx.quadraticCurveTo(cx + side * 40, wingY - 30, cx + side * 55, wingY - 5);
            ctx.quadraticCurveTo(cx + side * 45, wingY + 15, cx + side * 8, cy + 15);
            ctx.closePath();
            ctx.fill();
            // Inner wing (yellow-orange glow)
            ctx.fillStyle = '#FFaa22';
            ctx.globalAlpha = flash ? 0.3 : 0.7;
            ctx.beginPath();
            ctx.moveTo(cx + side * 5, cy - 5);
            ctx.quadraticCurveTo(cx + side * 30, wingY - 18, cx + side * 40, wingY);
            ctx.quadraticCurveTo(cx + side * 28, wingY + 10, cx + side * 5, cy + 10);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = flash ? 0.4 : 1;

            // Flame tips on wings
            const tipX = cx + side * 55;
            const tipY = wingY - 5;
            for (let f = 0; f < 3; f++) {
                const flicker = Math.sin(Date.now() / 80 + f * 2 + side) * 4;
                ctx.fillStyle = f === 0 ? '#FF0' : '#F80';
                ctx.globalAlpha = flash ? 0.3 : 0.6;
                ctx.beginPath();
                ctx.arc(tipX + side * (f * 5) + flicker, tipY - f * 3, 4 - f, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = flash ? 0.4 : 1;
        }

        // Body (orange/red/yellow gradient)
        const bodyGrad = ctx.createRadialGradient(cx - 5, cy - 10, 3, cx, cy, 28);
        bodyGrad.addColorStop(0, '#FFD700');
        bodyGrad.addColorStop(0.4, '#FF8C00');
        bodyGrad.addColorStop(0.8, '#FF4500');
        bodyGrad.addColorStop(1, '#CC2200');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 20, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        const headGrad = ctx.createRadialGradient(cx, cy - 28, 2, cx, cy - 25, 15);
        headGrad.addColorStop(0, '#FFD700');
        headGrad.addColorStop(1, '#FF6600');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(cx, cy - 25, 13, 0, Math.PI * 2);
        ctx.fill();

        // Head crest flames
        for (let i = -2; i <= 2; i++) {
            const flicker = Math.sin(Date.now() / 100 + i) * 3;
            ctx.fillStyle = i === 0 ? '#FF0' : '#F80';
            ctx.beginPath();
            ctx.moveTo(cx + i * 5, cy - 35);
            ctx.lineTo(cx + i * 3 + flicker, cy - 48 - Math.abs(i) * 3);
            ctx.lineTo(cx + i * 7, cy - 35);
            ctx.closePath();
            ctx.fill();
        }

        // Sharp beak
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(cx - 4, cy - 30);
        ctx.lineTo(cx, cy - 42);
        ctx.lineTo(cx + 4, cy - 30);
        ctx.closePath();
        ctx.fill();

        // Fierce red eyes
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(cx - 7, cy - 27, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 7, cy - 27, 4, 0, Math.PI * 2);
        ctx.fill();
        // Eye glow
        ctx.fillStyle = '#FF6';
        ctx.beginPath();
        ctx.arc(cx - 7, cy - 28, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 7, cy - 28, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Long fire tail
        ctx.fillStyle = '#FF6600';
        for (let i = 0; i < 5; i++) {
            const flicker = Math.sin(Date.now() / 120 + i * 1.3) * (3 + i);
            ctx.beginPath();
            ctx.moveTo(cx + (i - 2) * 5, cy + 25);
            ctx.lineTo(cx + (i - 2) * 7 + flicker, cy + 50 + i * 6);
            ctx.lineTo(cx + (i - 2) * 3, cy + 25);
            ctx.closePath();
            ctx.fill();
        }
        // Inner tail glow
        ctx.fillStyle = '#FFD700';
        ctx.globalAlpha = flash ? 0.3 : 0.6;
        for (let i = 0; i < 3; i++) {
            const flicker = Math.sin(Date.now() / 90 + i * 2) * 3;
            ctx.beginPath();
            ctx.moveTo(cx + (i - 1) * 4, cy + 26);
            ctx.lineTo(cx + (i - 1) * 4 + flicker, cy + 42 + i * 5);
            ctx.lineTo(cx + (i - 1) * 2, cy + 26);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = flash ? 0.4 : 1;

        // Floating ember particles
        const t = Date.now() / 1000;
        for (const em of this.embers) {
            const ex = cx + em.ox + Math.sin(t * em.speed + em.phase) * 8;
            const ey = cy + em.oy - Math.abs(Math.sin(t * em.speed * 0.5 + em.phase)) * 15;
            ctx.globalAlpha = flash ? 0.2 : 0.5;
            ctx.fillStyle = Math.random() > 0.5 ? '#FF6' : '#F80';
            ctx.beginPath();
            ctx.arc(ex, ey, em.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Stunned stars
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#FFD700';
            ctx.font = '14px monospace';
            for (let i = 0; i < 5; i++) {
                const sa = Date.now() / 250 + i * Math.PI * 2 / 5;
                ctx.fillText('\u2605', cx + Math.cos(sa) * 45 - 5, cy - 48 + Math.sin(sa) * 8);
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        const barW = 105;
        const barX = cx - barW / 2;
        const barY = pos.y - 30;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FEUER PHOENIX', cx, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.4 ? '#F60' : hpPct > 0.2 ? '#FA0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, 5, 2); ctx.fill();

        ctx.restore();
    }
}


// ══════════════════════════════════════════
// ── World 11: Pixel-Welt Enemies ──
// ══════════════════════════════════════════

class PixelGhost extends Enemy {
    constructor(x,y) {
        super(x,y,20,20); this.hp=4; this.maxHp=4; this.speed=55; this.damage=1;
        this.phasesThroughWalls=true; this.detectionRange=180;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const dist=vecDist({x:this.centerX(),y:this.centerY()},{x:player.x+player.w/2,y:player.y+player.h/2});
        if(dist<this.detectionRange){
            const a=angleBetween({x:this.centerX(),y:this.centerY()},{x:player.x+player.w/2,y:player.y+player.h/2});
            this.x+=Math.cos(a)*this.speed*dt; this.y+=Math.sin(a)*this.speed*dt;
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){
            // Blue pixel blood splatter
            const t=this.deathProgress(); ctx.save();
            for(let i=0;i<8;i++){ctx.globalAlpha=(1-t);ctx.fillStyle='#44F';
                const bx=cx+Math.cos(i*0.8+t)*t*25, by=cy+Math.sin(i*1.1+t)*t*25;
                ctx.fillRect(Math.floor(bx/4)*4,Math.floor(by/4)*4,4,4);
            }ctx.restore();return;
        }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        // Pixelated ghost (4px grid)
        ctx.fillStyle='#8AF';
        ctx.fillRect(cx-8,cy-8,4,4);ctx.fillRect(cx-4,cy-8,4,4);ctx.fillRect(cx,cy-8,4,4);ctx.fillRect(cx+4,cy-8,4,4);
        ctx.fillRect(cx-8,cy-4,4,4);ctx.fillRect(cx-4,cy-4,4,4);ctx.fillRect(cx,cy-4,4,4);ctx.fillRect(cx+4,cy-4,4,4);
        ctx.fillRect(cx-8,cy,4,4);ctx.fillRect(cx,cy,4,4);ctx.fillRect(cx+4,cy,4,4);
        ctx.fillRect(cx-8,cy+4,4,4);ctx.fillRect(cx-4,cy+4,4,4);ctx.fillRect(cx+4,cy+4,4,4);
        // Eyes
        ctx.fillStyle='#000';ctx.fillRect(cx-6,cy-6,4,4);ctx.fillRect(cx+2,cy-6,4,4);
        ctx.restore();
    }
}

class PixelRobot extends Enemy {
    constructor(x,y) {
        super(x,y,30,30); this.hp=12; this.maxHp=12; this.speed=40; this.damage=2;
        this.detectionRange=200; this.shootTimer=0; this.shootCooldown=1.5;
        this.isKeyGhost=true; this.droppedKey=false; // acts as key holder
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange){
            const a=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
            this.shootTimer-=dt;
            if(this.shootTimer<=0&&typeof Game!=='undefined'){
                this.shootTimer=this.shootCooldown;
                Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(a)*160,Math.sin(a)*160,1,'enemy',70));
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();for(let i=0;i<10;i++){ctx.globalAlpha=(1-t);ctx.fillStyle='#44F';ctx.fillRect(cx+Math.cos(i)*t*30-2,cy+Math.sin(i*1.3)*t*30-2,4,4);}ctx.restore();return;}
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        // Pixelated robot body
        ctx.fillStyle='#888';
        for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
            if(Math.abs(dx)+Math.abs(dy)<4) ctx.fillRect(cx+dx*6-3,cy+dy*6-3,6,6);
        }
        ctx.fillStyle='#F00';ctx.fillRect(cx-6,cy-9,6,6);ctx.fillRect(cx,cy-9,6,6);
        ctx.fillStyle='#0FF';ctx.fillRect(cx-3,cy-3,6,6);
        // Antenna
        ctx.fillStyle='#FF0';ctx.fillRect(cx-1,cy-18,2,8);ctx.beginPath();ctx.arc(cx,cy-18,3,0,Math.PI*2);ctx.fill();
        // Key glow
        ctx.globalAlpha=0.2+Math.sin(Date.now()/400)*0.1;ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(cx,cy,22,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── World 12: Sternen-Ritter-Galaxie ──
// ══════════════════════════════════════════

class StarKnight extends Enemy {
    constructor(x,y) {
        super(x,y,26,28); this.hp=8; this.maxHp=8; this.speed=50; this.damage=2;
        this.detectionRange=180; this.slashTimer=0; this.slashCooldown=1.2;
        this.slashing=false; this.slashT=0; this.facingA=0;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(this.slashing){this.slashT-=dt;if(this.slashT<=0)this.slashing=false;return;}
        if(dist<this.detectionRange){
            this.facingA=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(this.facingA)*this.speed*dt,Math.sin(this.facingA)*this.speed*dt,world);
            this.slashTimer-=dt;
            if(this.slashTimer<=0&&dist<40){
                this.slashing=true;this.slashT=0.3;this.slashTimer=this.slashCooldown;
                player.takeDamage(this.damage,this.facingA,150);
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){
            // Stardust shatter effect
            const t=this.deathProgress();ctx.save();
            for(let i=0;i<15;i++){
                ctx.globalAlpha=(1-t)*0.8;
                const a=(Math.PI*2*i)/15+t*2;
                ctx.fillStyle=`hsl(${i*24+Date.now()/10},80%,70%)`;
                ctx.beginPath();ctx.arc(cx+Math.cos(a)*t*40,cy+Math.sin(a)*t*40,(1-t)*3,0,Math.PI*2);ctx.fill();
            }ctx.restore();return;
        }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        // Glowing star suit
        ctx.globalAlpha=0.15;ctx.fillStyle=`hsl(${Date.now()/8%360},80%,60%)`;
        ctx.beginPath();ctx.arc(cx,cy,18,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=this.isFlashing()?0.4:1;
        // Body
        ctx.fillStyle=`hsl(${Date.now()/20%360},60%,50%)`;
        ctx.beginPath();ctx.roundRect(cx-10,cy-6,20,18,4);ctx.fill();
        // Helmet
        ctx.fillStyle=`hsl(${(Date.now()/20+60)%360},50%,40%)`;
        ctx.beginPath();ctx.arc(cx,cy-10,10,0,Math.PI*2);ctx.fill();
        // Visor
        ctx.fillStyle='#224';ctx.beginPath();ctx.ellipse(cx+Math.cos(this.facingA)*3,cy-10,6,4,0,0,Math.PI*2);ctx.fill();
        // Star emblem
        ctx.fillStyle='#FFD700';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('\u2605',cx,cy+4);
        // Sword slash
        if(this.slashing){ctx.strokeStyle='#FFF';ctx.lineWidth=2;ctx.globalAlpha=0.6;
            ctx.beginPath();ctx.arc(cx,cy,25,this.facingA-0.5,this.facingA+0.5);ctx.stroke();}
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── World 9: Schatten-Dimension Enemies ──
// ══════════════════════════════════════════

class ShadowGhost extends Enemy {
    constructor(x,y) {
        super(x,y,22,22); this.hp=6; this.maxHp=6; this.speed=50; this.damage=1;
        this.phasesThroughWalls=true; this.detectionRange=160;
        this.alpha=0.4; this.flickerTimer=0;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        this.flickerTimer+=dt;
        this.alpha=0.3+Math.sin(this.flickerTimer*3)*0.2;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(vecDist(mc,pc)<this.detectionRange){
            const a=angleBetween(mc,pc);
            this.x+=Math.cos(a)*this.speed*dt; this.y+=Math.sin(a)*this.speed*dt;
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t)*0.5;ctx.fillStyle='#408';ctx.beginPath();ctx.arc(cx,cy,11*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();ctx.globalAlpha=this.isFlashing()?0.15:this.alpha;
        ctx.fillStyle='#306';ctx.beginPath();ctx.arc(cx,cy-3,11,Math.PI,0);
        ctx.lineTo(cx+11,cy+8);
        for(let i=4;i>0;i--){const sx=cx-11+i*5.5;const w=Math.sin(Date.now()/200+i)*3;
            ctx.lineTo(sx-2.75,cy+6+w);ctx.lineTo(sx-5.5,cy+8);}
        ctx.closePath();ctx.fill();
        ctx.fillStyle='#F0F';ctx.beginPath();ctx.arc(cx-4,cy-3,2.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+4,cy-3,2.5,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}

class ShadowWraith extends Enemy {
    constructor(x,y) {
        super(x,y,28,28); this.hp=10; this.maxHp=10; this.speed=35; this.damage=2;
        this.phasesThroughWalls=true; this.detectionRange=200;
        this.teleportTimer=0; this.teleportCooldown=4;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange){
            const a=angleBetween(mc,pc);
            this.x+=Math.cos(a)*this.speed*dt; this.y+=Math.sin(a)*this.speed*dt;
            this.teleportTimer-=dt;
            if(this.teleportTimer<=0&&dist>80){
                this.teleportTimer=this.teleportCooldown;
                this.x=player.x+randRange(-60,60); this.y=player.y+randRange(-60,60);
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t)*0.4;ctx.fillStyle='#606';ctx.beginPath();ctx.arc(cx,cy,14*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();ctx.globalAlpha=this.isFlashing()?0.2:0.5;
        ctx.fillStyle='#404';ctx.beginPath();ctx.ellipse(cx,cy,14,12,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#808';ctx.beginPath();ctx.ellipse(cx,cy-4,10,8,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#F0F';ctx.beginPath();ctx.arc(cx-5,cy-6,3,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+5,cy-6,3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#FFF';ctx.beginPath();ctx.arc(cx-5,cy-7,1,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+5,cy-7,1,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}

// W9 Boss: SCHATTEN-MEISTER
class BossShadowMaster extends Enemy {
    constructor(x,y) {
        super(x,y,90,90); this.hp=55; this.maxHp=55; this.speed=30;
        this.damage=2; this.isBoss=true; this.contactDamage=false; this.phasesThroughWalls=true;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.darkTimer=3; this.spawnTimer=8; this.phase=1;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return;
        if(this.hp<=28&&this.phase===1){this.phase=2;this.speed=45;}
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='chase';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='chase';return;}
        const a=angleBetween(mc,pc);
        this.x+=Math.cos(a)*this.speed*dt;this.y+=Math.sin(a)*this.speed*dt;
        this.darkTimer-=dt;
        if(this.darkTimer<=0){this.darkTimer=this.phase===1?3:2;
            const n=this.phase===1?8:12;
            for(let i=0;i<n;i++){const sa=(Math.PI*2*i)/n;
                if(typeof Game!=='undefined')Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(sa)*130,Math.sin(sa)*130,1,'enemy',60));}
            this.state='stunned';this.stunnedTimer=2;}
        this.spawnTimer-=dt;
        if(this.spawnTimer<=0&&enemies){this.spawnTimer=8;
            for(let i=0;i<2;i++){const sa=Math.random()*Math.PI*2;enemies.push(new ShadowGhost(mc.x+Math.cos(sa)*50,mc.y+Math.sin(sa)*50));}}
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();for(let i=0;i<12;i++){ctx.globalAlpha=(1-t);const a=(Math.PI*2*i)/12+t*2;ctx.fillStyle=i%2?'#F0F':'#808';ctx.beginPath();ctx.arc(cx+Math.cos(a)*t*60,cy+Math.sin(a)*t*60,(1-t)*8,0,Math.PI*2);ctx.fill();}ctx.restore();return;}
        ctx.save();ctx.globalAlpha=this.isFlashing()?0.3:0.7;
        ctx.fillStyle='#303';ctx.beginPath();ctx.ellipse(cx,cy,42,36,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#505';ctx.beginPath();ctx.ellipse(cx,cy-8,30,25,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#F0F';ctx.beginPath();ctx.arc(cx-14,cy-15,8,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+14,cy-15,8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#FFF';ctx.beginPath();ctx.arc(cx-14,cy-16,4,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+14,cy-16,4,0,Math.PI*2);ctx.fill();
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='12px monospace';for(let i=0;i<4;i++){const sa=Date.now()/250+i*Math.PI/2;ctx.fillText('\u2605',cx+Math.cos(sa)*35,pos.y-10+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('SCHATTEN-MEISTER',cx,pos.y-20);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-15,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>25?'#A0F':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-14,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── World 10: Obst-Paradies Enemies ──
// ══════════════════════════════════════════

class AngryFruit extends Enemy {
    constructor(x,y) {
        super(x,y,20,20); this.hp=4; this.maxHp=4; this.speed=55; this.damage=1;
        this.detectionRange=150; this.fruitType=randInt(0,2); // 0=apple,1=orange,2=grape
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const dist=vecDist({x:this.centerX(),y:this.centerY()},{x:player.x+player.w/2,y:player.y+player.h/2});
        if(dist<this.detectionRange){const a=angleBetween({x:this.centerX(),y:this.centerY()},{x:player.x+player.w/2,y:player.y+player.h/2});
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);}
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle=['#F44','#F80','#A4F'][this.fruitType];ctx.beginPath();ctx.arc(cx,cy,10*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        const colors=['#F44','#F80','#A4F'];
        ctx.fillStyle=colors[this.fruitType];ctx.beginPath();ctx.arc(cx,cy,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#4A0';ctx.fillRect(cx-1,cy-13,2,5);
        ctx.fillStyle='#000';ctx.beginPath();ctx.arc(cx-3,cy-2,1.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+3,cy-2,1.5,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.beginPath();ctx.arc(cx,cy+3,3,0.3,Math.PI-0.3);ctx.stroke();
        ctx.restore();
    }
}

class GiantPlant extends Enemy {
    constructor(x,y) {
        super(x,y,30,30); this.hp=8; this.maxHp=8; this.speed=20; this.damage=1;
        this.detectionRange=140; this.shootTimer=0; this.shootCooldown=2;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange){
            const a=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
            this.shootTimer-=dt;
            if(this.shootTimer<=0&&typeof Game!=='undefined'){this.shootTimer=this.shootCooldown;
                Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(a)*100,Math.sin(a)*100,1,'enemy',50));}
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#4A0';ctx.beginPath();ctx.arc(cx,cy,15*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        ctx.fillStyle='#4A0';ctx.fillRect(cx-4,cy,8,14);
        ctx.fillStyle='#6C0';ctx.beginPath();ctx.arc(cx,cy-2,14,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#8E2';ctx.beginPath();ctx.arc(cx-4,cy-6,6,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#F44';ctx.beginPath();ctx.arc(cx,cy-2,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#000';ctx.beginPath();ctx.arc(cx-2,cy-3,1.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+2,cy-3,1.5,0,Math.PI*2);ctx.fill();
        ctx.restore();
    }
}

// W10 Boss: OBST-KÖNIG
class BossFruitKing extends Enemy {
    constructor(x,y) {
        super(x,y,100,90); this.hp=60; this.maxHp=60; this.speed=25;
        this.damage=2; this.isBoss=true; this.contactDamage=false;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.fruitTimer=3; this.vineTimer=5; this.phase=1;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return;
        if(this.hp<=30&&this.phase===1){this.phase=2;this.speed=35;}
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='chase';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='chase';return;}
        const a=angleBetween(mc,pc);
        this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
        this.fruitTimer-=dt;
        if(this.fruitTimer<=0){this.fruitTimer=this.phase===1?3:2;
            const n=this.phase===1?6:10;
            for(let i=0;i<n;i++){const sa=(Math.PI*2*i)/n;
                if(typeof Game!=='undefined')Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(sa)*120,Math.sin(sa)*120,1,'enemy',60));}
            this.state='stunned';this.stunnedTimer=2;}
        this.vineTimer-=dt;
        if(this.vineTimer<=0&&enemies){this.vineTimer=5;
            for(let i=0;i<3;i++){const sa=Math.random()*Math.PI*2;
                enemies.push(new AngryFruit(mc.x+Math.cos(sa)*60,mc.y+Math.sin(sa)*60));}}
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();for(let i=0;i<14;i++){ctx.globalAlpha=(1-t);const a=(Math.PI*2*i)/14+t*2;ctx.fillStyle=['#F44','#F80','#FF0','#4F4','#A4F'][i%5];ctx.beginPath();ctx.arc(cx+Math.cos(a)*t*60,cy+Math.sin(a)*t*60,(1-t)*8,0,Math.PI*2);ctx.fill();}ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        ctx.fillStyle='#6C0';ctx.beginPath();ctx.ellipse(cx,cy+5,45,35,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#8E2';ctx.beginPath();ctx.ellipse(cx,cy-10,35,30,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#F80';ctx.beginPath();ctx.arc(cx-15,cy-5,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#F44';ctx.beginPath();ctx.arc(cx+15,cy,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#FF0';ctx.beginPath();ctx.arc(cx,cy+10,8,0,Math.PI*2);ctx.fill();
        // Crown
        ctx.fillStyle='#FFD700';ctx.beginPath();ctx.moveTo(cx-15,cy-30);ctx.lineTo(cx-15,cy-38);ctx.lineTo(cx-8,cy-33);ctx.lineTo(cx,cy-40);ctx.lineTo(cx+8,cy-33);ctx.lineTo(cx+15,cy-38);ctx.lineTo(cx+15,cy-30);ctx.closePath();ctx.fill();
        // Face
        ctx.fillStyle='#000';ctx.beginPath();ctx.arc(cx-10,cy-15,5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+10,cy-15,5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#FFF';ctx.beginPath();ctx.arc(cx-10,cy-16,2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+10,cy-16,2,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy-5,10,0.2,Math.PI-0.2);ctx.stroke();
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='12px monospace';for(let i=0;i<4;i++){const sa=Date.now()/250+i*Math.PI/2;ctx.fillText('\u2605',cx+Math.cos(sa)*40,pos.y-25+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('OBST-K\u00d6NIG',cx,pos.y-25);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-20,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>25?'#F80':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-19,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}
