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
        // Zähe Gegner (alle Bosse, siehe BOSS_TOUGHNESS in main.js) stecken Treffer besser weg
        if (this.toughness > 1) amount /= this.toughness;
        this.hp -= amount;
        this.iFrames = 0.2;
        this.hitFlash = 0.12;
        if (typeof FX !== 'undefined' && amount > 0) {
            const shown = this.toughness > 1 ? Math.max(1, Math.round(amount)) : Math.round(amount * 10) / 10;
            FX.text(this.centerX(), this.y - 2, shown, this.isBoss ? '#ffd23f' : '#ffffff', this.isBoss ? 13 : 10);
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
        // Schutzzeit nach Treffern in echter Zeit, auch wenn der Gegner schneller läuft (tempo, siehe main.js)
        if (this.iFrames > 0) this.iFrames -= dt / (this.tempo || 1);
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
// ── Begleiter: Juri (Clown) ──
// ══════════════════════════════════════════

class Juri {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 24; this.h = 24;
        this.hp = 12; this.maxHp = 12; // 3 Herzen
        this.speed = 130; this.damage = 3;
        this.dead = false; this.iFrames = 0; this.hitFlash = 0;
        this.attackTimer = 0; this.attackCooldown = 0.8;
        this.hitCount = 0; this.fireCircle = false; this.melonHammers = false;
        this.target = null; this.swingAngle = 0;
        this.swinging = false; this.swingTimer = 0;
        // Anzeige: Blickrichtung, Laufen, Feuerkreis-Aufblitzen
        this.faceX = 1; this.moving = false; this.walkT = 0;
        this.fireFlash = 0; this.stuckTimer = 0;
        this.seed = Math.random() * 10;
        this.stunTimer = 0;   // > 0: betäubt (z. B. vom Hammer des Riesen-Zombies)
        this.koTimer = 0;     // > 0: k.o. am Boden (Drachenstrahl), steht danach mit halben LP auf
        this.koDur = 0;
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }

    takeDamage(amount) {
        if (this.iFrames > 0 || this.dead || this.koTimer > 0) return;
        this.hp -= amount; this.iFrames = 1; this.hitFlash = 0.12;
        if (this.hp <= 0) {
            this.hp = 0; this.dead = true;
            Juri.poof(this.centerX(), this.centerY());
        }
    }

    // Betäuben: steht ein paar Sekunden benommen da (Engine: Gegnergeschosse mit hitsCompanions)
    stun(seconds) {
        if (this.koTimer > 0) return;
        this.stunTimer = Math.max(this.stunTimer, seconds);
    }

    // K.o. statt verschwinden (Drachenstrahl, der ihn besiegen würde): liegt am Boden, kann nicht
    // getroffen werden, bewegt sich nicht und steht nach `seconds` mit halben Lebenspunkten wieder auf.
    knockOut(seconds) { Juri.knockOutCompanion(this, seconds); }

    // ── gemeinsame Helfer für alle Begleiter ──

    static knockOutCompanion(c, seconds) {
        if (c.dead || c.koTimer > 0) return;
        c.koTimer = seconds;
        c.koDur = seconds;
        c.hp = 0;
        c.stunTimer = 0;
        c.hitFlash = 0.12;
        c.moving = false;
        c.target = null;
        Juri.poof(c.centerX(), c.centerY(), true);
    }

    // K.o.-Zeit abzählen; true = liegt noch. Beim Aufstehen: halbe LP und kurz unverwundbar.
    static koUpdate(c, dt) {
        if (!(c.koTimer > 0)) return false;
        c.koTimer -= dt;
        c.moving = false;
        c.stuckTimer = 0;
        c.target = null;
        if (c.koTimer <= 0) {
            c.koTimer = 0;
            c.hp = Math.ceil(c.maxHp / 2);
            c.iFrames = 1.5;
            if (typeof FX !== 'undefined') {
                FX.burst(c.centerX(), c.centerY(), ['#ffd23f', '#ffffff', '#7fe0ff'], 10, 120, 0.5, { kind: 'star' });
            }
        }
        return true;
    }

    // Liegt am Boden: Figur um die Füße gekippt (Aufrufer klammert mit save/restore). Kurz vor dem Aufstehen zappelt sie.
    static koPose(ctx, c, x, y, f) {
        const wig = c.koTimer < 0.7 ? Math.sin(Art.time * 30) * 0.08 : 0;
        ctx.translate(x, y);
        ctx.rotate(-f * (1.45 + wig));
        ctx.translate(-x, -y);
    }

    // „Zzz" steigt auf (schläft sich gesund).
    static zzz(ctx, x, y, seed) {
        const prev = ctx.globalAlpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < 3; i++) {
            const q = (Art.time * 0.55 + seed * 0.13 + i / 3) % 1;
            const s = 1.6 + q * 2.2;
            const zx = x + i * 2.2 + Math.sin(q * 6 + i) * 2, zy = y - q * 15;
            ctx.globalAlpha = prev * (q < 0.2 ? q / 0.2 : 1 - (q - 0.2) / 0.8);
            ctx.beginPath();
            ctx.moveTo(zx - s, zy - s);
            ctx.lineTo(zx + s, zy - s);
            ctx.lineTo(zx - s, zy + s);
            ctx.lineTo(zx + s, zy + s);
            ctx.strokeStyle = '#2a2458';
            ctx.lineWidth = 2.6;
            ctx.stroke();
            ctx.strokeStyle = '#eef3ff';
            ctx.lineWidth = 1.3;
            ctx.stroke();
        }
        ctx.globalAlpha = prev;
    }

    // Freie Sicht zwischen zwei Punkten (keine Wand dazwischen)?
    static lineClear(world, ax, ay, bx, by) {
        if (!world || !world.isWall) return true;
        const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 10);
        for (let i = 1; i < n; i++) {
            const k = i / n;
            if (world.isWall(ax + (bx - ax) * k, ay + (by - ay) * k)) return false;
        }
        return true;
    }

    // Laufen mit Wandkollision; liefert die tatsächlich zurückgelegte Strecke.
    static step(e, dx, dy, world) {
        const ox = e.x, oy = e.y;
        if (world && world.collideRect) moveWithCollision(e, dx, dy, world);
        else { e.x += dx; e.y += dy; }
        return Math.hypot(e.x - ox, e.y - oy);
    }

    // Zu weit weg oder festgesteckt: mit einer Rauchwolke neben Mark auftauchen.
    static hopTo(e, player, world, side) {
        const ox = e.x + e.w / 2, oy = e.y + e.h / 2;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        e.x = px + side * 22 - e.w / 2;
        e.y = py + 8 - e.h / 2;
        if (world && world.collideRect && world.collideRect(e).length) {
            e.x = px - e.w / 2;
            e.y = py - e.h / 2;
            escapeFromWalls(e, world, 4);
        }
        e.stuckTimer = 0;
        Juri.poof(ox, oy, true);
        Juri.poof(e.x + e.w / 2, e.y + e.h / 2, true);
    }

    static poof(x, y, small) {
        if (typeof FX === 'undefined') return;
        FX.burst(x, y, 'rgba(240,235,255,0.9)', small ? 6 : 10, 70, 0.45, { kind: 'smoke', size: small ? 4 : 5 });
        if (!small) FX.burst(x, y, ['#ffd23f', '#ffffff'], 8, 130, 0.5, { kind: 'star' });
    }

    // Berührungsschaden durch Gegner (auch betäubt kann ein Begleiter angerempelt werden).
    static bump(c, enemies) {
        for (const e of enemies) {
            if (e.dead || !e.contactDamage) continue;
            if (rectOverlap(c, e)) c.takeDamage(e.damage);
        }
    }

    // Spiralauge (benommen); rot dreht die Spirale.
    static spiralEye(ctx, x, y, r, rot) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.lineWidth = Math.max(0.7, r * 0.22);
        ctx.strokeStyle = Art.INK;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 1; i <= 12; i++) {
            const k = i / 12;
            const a = rot + k * TAU * 1.75;
            ctx.lineTo(x + Math.cos(a) * r * 0.78 * k, y + Math.sin(a) * r * 0.78 * k);
        }
        ctx.lineWidth = Math.max(0.6, r * 0.26);
        ctx.strokeStyle = '#3a2a6a';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    // Drei Sterne kreisen über dem Kopf (benommen).
    static dizzyStars(ctx, x, y, rx, seed) {
        for (let i = 0; i < 3; i++) {
            const a = Art.time * 4.2 + seed + (i * TAU) / 3;
            const s = Math.sin(a);
            Art.star(ctx, x + Math.cos(a) * rx, y + s * rx * 0.35, 2.4 + s * 0.6, '#ffe35a', { lineWidth: 0.9, outline: '#a86a00' });
        }
    }

    // Kleine Lebensleiste (nur wenn verletzt, gleicher Stil wie bei Gegnern).
    static hpBar(ctx, x, y, hp, maxHp) {
        if (hp >= maxHp) return;
        const w = 18, k = clamp(hp / maxHp, 0, 1);
        ctx.fillStyle = 'rgba(20,8,40,0.75)';
        ctx.beginPath();
        ctx.roundRect(x - w / 2 - 1, y - 1, w + 2, 5, 2.5);
        ctx.fill();
        ctx.fillStyle = k > 0.5 ? '#6ee06e' : (k > 0.25 ? '#ffc23d' : '#ff4d5e');
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y, Math.max(1.5, w * k), 3, 1.5);
        ctx.fill();
    }

    update(dt, world, player, enemies) {
        if (this.dead) return;
        if (this.iFrames > 0) this.iFrames -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.fireFlash > 0) this.fireFlash -= dt;
        if (this.swingTimer > 0) {
            this.swingTimer -= dt;
            if (this.swingTimer <= 0) this.swinging = false;
        }
        // K.o.: liegt am Boden (nicht treffbar), haut nicht, springt nicht zu Mark
        if (Juri.koUpdate(this, dt)) return;
        // Betäubt: steht still, haut nicht, springt nicht zu Mark
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            this.moving = false;
            this.stuckTimer = 0;
            this.target = null;
            Juri.bump(this, enemies);
            return;
        }
        this.attackTimer -= dt;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        if (Math.hypot(px - this.centerX(), py - this.centerY()) > 260 || this.stuckTimer > 1.2) {
            Juri.hopTo(this, player, world, -this.faceX || 1);
        }
        const cx = this.centerX(), cy = this.centerY();

        // Ziel: nächster Gegner nahe bei Mark (Leine 150), den Juri auch sehen kann
        this.target = null;
        let best = Infinity;
        for (const e of enemies) {
            if (e.dead) continue;
            const ex = e.centerX(), ey = e.centerY();
            if (Math.hypot(ex - px, ey - py) - Math.max(e.w, e.h) / 2 > 150) continue;
            const d = Math.hypot(ex - cx, ey - cy);
            if (d < best && Juri.lineClear(world, cx, cy, ex, ey)) { best = d; this.target = e; }
        }
        const tg = this.target;

        // Laufen: zum Ziel bis knapp vor Hammer-Reichweite, sonst in Marks Nähe bleiben
        let gx = px, gy = py, stop = 38;
        if (tg) { gx = tg.centerX(); gy = tg.centerY(); stop = 15 + Math.max(tg.w, tg.h) / 2; }
        const gd = Math.hypot(gx - cx, gy - cy);
        this.moving = false;
        if (gd > stop) {
            const sp = this.speed * (tg ? 1.25 : (gd > 110 ? 1.5 : 1));
            const len = Math.min(sp * dt, gd - stop);
            const moved = Juri.step(this, (gx - cx) / gd * len, (gy - cy) / gd * len, world);
            this.stuckTimer = moved < len * 0.3 ? this.stuckTimer + dt : 0;
            this.moving = moved > 0.05;
            if (Math.abs(gx - cx) > 2) this.faceX = gx > cx ? 1 : -1;
        } else {
            this.stuckTimer = 0;
        }
        if (this.moving) this.walkT += dt;
        if (tg) this.faceX = tg.centerX() >= this.centerX() ? 1 : -1;

        // Hammerschlag, sobald das Ziel in Reichweite ist (und gerade treffbar)
        if (tg && this.attackTimer <= 0 && !(tg.iFrames > 0)) {
            const reach = 21 + Math.max(tg.w, tg.h) / 2;
            if (Math.hypot(tg.centerX() - this.centerX(), tg.centerY() - this.centerY()) <= reach) this._bonk(tg, enemies);
        }

        // Berührungsschaden durch Gegner
        Juri.bump(this, enemies);
    }

    _bonk(tg, enemies) {
        const cx = this.centerX(), cy = this.centerY();
        const tx = tg.centerX(), ty = tg.centerY();
        const ang = Math.atan2(ty - cy, tx - cx);
        this.attackTimer = this.attackCooldown;
        this.swinging = true;
        this.swingTimer = 0.28;
        this.swingAngle = ang;
        this.hitCount++;
        const fire = this.fireCircle && this.hitCount % 3 === 0;
        // Melonen-Hämmer (Obst-Upgrade aus Welt 10) hauen fester
        let dmg = this.damage + (this.melonHammers ? 2 : 0);
        // Der Feuerkreis zählt beim Hauptziel mit – sonst verschluckt dessen Unverwundbarkeit den Feuerschaden
        if (fire) dmg += 4;
        tg.takeDamage(dmg, ang, this.melonHammers ? 170 : 120);
        const r = Math.max(tg.w, tg.h) * 0.35;
        const ix = tx - Math.cos(ang) * r, iy = ty - Math.sin(ang) * r;
        if (typeof FX !== 'undefined') {
            if (this.melonHammers) {
                // Melonen-Stückchen und Kerne
                FX.burst(ix, iy, ['#ff4d6d', '#ff8fa3', '#3ddc6e', '#1f8a3a'], 10, 150, 0.55, { gravity: 260 });
                FX.burst(ix, iy, '#2a1a14', 4, 120, 0.45, { size: 1.4, gravity: 260 });
            } else {
                FX.burst(ix, iy, ['#fff6a8', '#ffd23f', '#ffffff'], 6, 120, 0.35, { kind: 'star' });
            }
        }
        if (fire) {
            this.fireFlash = 0.45;
            for (const e of enemies) {
                if (e === tg || e.dead) continue;
                const ex = e.centerX(), ey = e.centerY();
                if (Math.hypot(ex - cx, ey - cy) < 80 + Math.max(e.w, e.h) / 2) e.takeDamage(4, Math.atan2(ey - cy, ex - cx), 150);
            }
            if (typeof FX !== 'undefined') {
                FX.ring(cx, cy, '#ff9f1c', 80, 0.45, 5);
                FX.burst(cx, cy, ['#ff5a1f', '#ffd23f', '#ff9f1c'], 16, 180, 0.5);
            }
        }
    }

    // Juri: fröhlicher Clown mit orangen Locken, roter Nase, rot-weiß gestreiftem Anzug,
    // Clownsschuhen und Quietsch-Hammer (mit Obst-Upgrade: Melonen-Hammer).
    draw(ctx, camera) {
        if (this.dead) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const f = this.faceX || 1;
        const ph = this.walkT * 12;
        const bob = this.moving ? -Math.abs(Math.sin(ph)) * 1.6 : Math.sin(t * 2.6 + this.seed) * 0.45;
        const sw = this.swinging ? clamp(1 - this.swingTimer / 0.28, 0, 1) : -1;
        const charged = this.fireCircle && this.hitCount % 3 === 2;
        // Blick zum Ziel, sonst in Laufrichtung
        let lx = f * 0.7, ly = 0.3;
        const tg = this.target;
        if (tg && !tg.dead) {
            const dx = tg.centerX() - this.centerX(), dy = tg.centerY() - this.centerY();
            const d = Math.hypot(dx, dy) || 1;
            lx = dx / d;
            ly = dy / d;
        }
        // Betäubt: schwankt um die Füße, Spiralaugen, Sterne über dem Kopf.
        // K.o.: liegt am Boden, erst benommen (Spiralaugen, Sterne), dann schlafend („Zzz").
        const ko = this.koTimer > 0;
        const stunned = !ko && this.stunTimer > 0;
        const dizzy = stunned || (ko && this.koTimer > this.koDur - 2.5);
        if (ko || stunned) {
            ctx.save();
            if (ko) {
                Juri.koPose(ctx, this, cx, cy + 8, f);
            } else {
                ctx.translate(cx, cy + 12);
                ctx.rotate(Math.sin(t * 5 + this.seed) * 0.09);
                ctx.translate(-cx, -(cy + 12));
            }
        }
        if (this.fireFlash > 0) Art.glow(ctx, cx, cy, 36, '#ff7a1f', Math.min(1, this.fireFlash * 2.2));
        // Hammer: in Ruhe über der Schulter, beim Schlag saust er über den Kopf aufs Ziel
        let ha = -Math.PI / 2 + f * (0.55 + Math.sin(t * 2 + this.seed) * 0.08);
        if (sw >= 0) {
            const a0 = this.swingAngle - f * 2.1, a1 = this.swingAngle + f * 0.15;
            const e = sw < 0.4 ? Math.pow(sw / 0.4, 2) : 1;
            ha = a0 + (a1 - a0) * e;
        }
        const handX = cx + f * 6.4, handY = cy + 1.8 + bob;
        const hammerBack = sw < 0 || Math.sin(ha) < -0.45;
        if (hammerBack) this._drawHammer(ctx, handX, handY, ha, charged, sw);
        // Clownsschuhe (ein Pfad)
        const l0 = this.moving ? Math.max(0, Math.sin(ph)) * 2 : 0;
        const l1 = this.moving ? Math.max(0, Math.sin(ph + Math.PI)) * 2 : 0;
        Art.shape(ctx, c => {
            c.ellipse(cx - 4.3 + f * 1.8, cy + 10.4 - l0, 4.6, 2.5, 0, 0, TAU);
            c.moveTo(cx + 8.9 + f * 1.8, cy + 10.4 - l1);
            c.ellipse(cx + 4.3 + f * 1.8, cy + 10.4 - l1, 4.6, 2.5, 0, 0, TAU);
        }, { x: cx - 8.9 + f * 1.8, y: cy + 6, w: 17.8, h: 7 }, '#ff3b52', { lineWidth: 1.3, outline: '#7a1020' });
        // Anzug: bauchig, rot-weiß gestreift
        const by = cy + 3 + bob;
        Art.body(ctx, cx, by, 8, 7.2, '#ffffff', { outline: false, highlight: false });
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, by, 8, 7.2, 0, 0, TAU);
        ctx.clip();
        ctx.fillStyle = '#ff4d5e';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) ctx.rect(cx + i * 4.8 - 1.3, by - 8, 2.6, 16);
        ctx.fill();
        Art.shine(ctx, cx - 3, by - 3.2, 2.6, 1.4, -0.5, 0.35);
        ctx.restore();
        ctx.strokeStyle = '#7a1f2c';
        ctx.lineWidth = Art.LINE;
        ctx.beginPath();
        ctx.ellipse(cx, by, 8, 7.2, 0, 0, TAU);
        ctx.stroke();
        // Bommel-Knöpfe
        ctx.fillStyle = '#3aa7ff';
        ctx.beginPath();
        ctx.arc(cx + f * 1.6, by - 1.6, 1.7, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(cx + f * 1.9, by + 2.8, 1.7, 0, TAU);
        ctx.fill();
        // hintere Hand (weißer Handschuh)
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6b6f8a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx - f * 7.2, cy + 3.2 + bob, 2.3, 2.2, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        // Rüschenkragen
        const ky = cy - 2.6 + bob;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const x = cx + (i - 2) * 2.9;
            ctx.moveTo(x + 2.1, ky);
            ctx.arc(x, ky, 2.1, 0, TAU);
        }
        ctx.fillStyle = '#7fe0ff';
        ctx.fill();
        ctx.strokeStyle = '#1d6f8f';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        // Kopf mit Locken
        const hx = cx + f * 0.8, hy = cy - 7.4 + bob;
        Art.shape(ctx, c => {
            for (let i = 0; i < JURI_CURLS.length; i += 3) {
                const x = hx + JURI_CURLS[i] * f, y = hy + JURI_CURLS[i + 1], r = JURI_CURLS[i + 2];
                c.moveTo(x + r, y);
                c.arc(x, y, r, 0, TAU);
            }
        }, { x: hx - 12, y: hy - 12, w: 24, h: 17 }, '#ff8a1f', { outline: '#8a3a00', lineWidth: 1.2 });
        Art.body(ctx, hx, hy, 7.6, 7.2, '#ffe6cc', { outline: '#8a4a2a' });
        Art.blush(ctx, hx + f * 1.4, hy + 2.8, 1.5, 4.6, '#ff8aa8');
        if (dizzy) {
            Juri.spiralEye(ctx, hx + f * 1.5 - 2.9, hy - 1.1, 2.1, t * 7);
            Juri.spiralEye(ctx, hx + f * 1.5 + 2.9, hy - 1.1, 2.1, -t * 7);
        } else if (ko) {
            Art.eyes(ctx, hx + f * 1.5, hy - 1.1, 2.1, { gap: 2.9, open: 0.05, blink: false });
        } else {
            Art.eyes(ctx, hx + f * 1.5, hy - 1.1, 2.1, { gap: 2.9, look: { x: lx, y: ly }, seed: this.seed });
        }
        Art.mouth(ctx, hx + f * 1.7, hy + 4.3, 4.8, stunned || ko ? 'o' : (sw >= 0 ? 'open' : 'grin'));
        Art.body(ctx, hx + f * 3.4, hy + 1.7, 2.5, 2.3, '#ff2d3f', { glossy: true, lineWidth: 1.1, outline: '#7a0a1a' });
        if (!hammerBack) this._drawHammer(ctx, handX, handY, ha, charged, sw);
        // vordere Hand hält den Hammer
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6b6f8a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(handX, handY, 2.4, 2.3, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        if (ko) {
            ctx.restore();
            if (dizzy) Juri.dizzyStars(ctx, cx - f * 11, cy - 1, 8, this.seed);
            else Juri.zzz(ctx, cx - f * 9, cy - 2, this.seed);
        } else if (stunned) {
            ctx.restore();
            Juri.dizzyStars(ctx, cx, pos.y - 6, 10, this.seed);
        }
        Juri.hpBar(ctx, cx, pos.y - 13, this.hp, this.maxHp);
    }

    _drawHammer(ctx, x, y, ang, charged, sw) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        Art.limb(ctx, -1.5, 0, 10.5, 0, 2.1, '#ffd23f', { lineWidth: 1, outline: '#8a5a00' });
        // kurzes Stauchen beim Aufprall
        const squash = sw >= 0.4 && sw < 0.7 ? Math.sin((sw - 0.4) / 0.3 * Math.PI) * 0.22 : 0;
        ctx.translate(13, 0);
        ctx.scale(1 - squash, 1 + squash);
        if (this.melonHammers) {
            Art.body(ctx, 0, 0, 3.9, 5.8, '#3ddc6e', { glossy: true, outline: '#1f6a34' });
            ctx.strokeStyle = '#1f8a3a';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.ellipse(0, 0, 1.4, 5.5, 0, 0, TAU);
            ctx.moveTo(0, -5.6);
            ctx.lineTo(0, 5.6);
            ctx.stroke();
        } else {
            Art.box(ctx, -3, -4.4, 6, 8.8, 2, '#ff4d5e', { outline: '#7a1020', highlight: false });
            ctx.fillStyle = '#ffd23f';
            ctx.strokeStyle = '#8a5a00';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(-3.5, -5.6, 7, 2.4, 1);
            ctx.roundRect(-3.5, 3.2, 7, 2.4, 1);
            ctx.fill();
            ctx.stroke();
        }
        if (charged) {
            // nächster Schlag wird ein Feuerkreis: Hammer glüht und brennt
            const fl = Math.sin(Art.time * 16) * 0.8;
            Art.glow(ctx, 0, 0, 10, '#ff7a1f', 0.6 + fl * 0.15);
            ctx.fillStyle = '#ffb02e';
            ctx.beginPath();
            ctx.moveTo(-3, -1.5);
            ctx.quadraticCurveTo(-8.5 - fl, 0, -3, 1.5);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}

// Locken von Juri: je [x, y, Radius], x zeigt nach vorn (wird gespiegelt).
const JURI_CURLS = [-7.6, -3.4, 3.4, -8.3, 1.2, 3, 7.4, -3.6, 3.3, 8, 1, 2.8, -3.4, -7.8, 3.1, 1.2, -8.8, 3.2, 5, -7.2, 2.7];

// ══════════════════════════════════════════
// ── Begleiter: Schatten-Krokodil ──
// ══════════════════════════════════════════

class ShadowCrocodile {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 28; this.h = 26;
        this.hp = 20; this.maxHp = 20; // 5 Herzen
        this.speed = 120; this.damage = 4;
        this.dead = false; this.iFrames = 0; this.hitFlash = 0;
        this.shootTimer = 0; this.shootCooldown = 1.2;
        this.fireExplosion = false; this.fruitAmmo = false;
        this.target = null; this.facingAngle = 0;
        // Anzeige: Blickrichtung, Laufen, Maul nach dem Spucken
        this.faceX = 1; this.moving = false; this.walkT = 0;
        this.mouthTimer = 0; this.stuckTimer = 0;
        this.seed = Math.random() * 10;
        this.stunTimer = 0;   // > 0: betäubt (z. B. vom Hammer des Riesen-Zombies)
        this.koTimer = 0;     // > 0: k.o. am Boden (Drachenstrahl), steht danach mit halben LP auf
        this.koDur = 0;
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }

    takeDamage(amount) {
        if (this.iFrames > 0 || this.dead || this.koTimer > 0) return;
        this.hp -= amount; this.iFrames = 1; this.hitFlash = 0.12;
        if (this.hp <= 0) {
            this.hp = 0; this.dead = true;
            Juri.poof(this.centerX(), this.centerY());
        }
    }

    // Betäuben: steht ein paar Sekunden benommen da (Engine: Gegnergeschosse mit hitsCompanions)
    stun(seconds) {
        if (this.koTimer > 0) return;
        this.stunTimer = Math.max(this.stunTimer, seconds);
    }

    // K.o. statt verschwinden (Drachenstrahl): liegt am Boden, steht nach `seconds` mit halben LP auf.
    knockOut(seconds) { Juri.knockOutCompanion(this, seconds); }

    update(dt, world, player, enemies) {
        if (this.dead) return;
        if (this.iFrames > 0) this.iFrames -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.mouthTimer > 0) this.mouthTimer -= dt;
        // K.o.: liegt am Boden (nicht treffbar), spuckt nicht, springt nicht zu Mark
        if (Juri.koUpdate(this, dt)) return;
        // Betäubt: steht still, spuckt nicht, springt nicht zu Mark
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            this.moving = false;
            this.stuckTimer = 0;
            this.target = null;
            Juri.bump(this, enemies);
            return;
        }
        this.shootTimer -= dt;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        if (Math.hypot(px - this.centerX(), py - this.centerY()) > 260 || this.stuckTimer > 1.2) {
            Juri.hopTo(this, player, world, this.faceX > 0 ? 1 : -1);   // andere Seite als Juri
        }
        const cx = this.centerX(), cy = this.centerY();

        // Ziel: nächster Gegner in Schussweite, den das Krokodil sehen kann
        this.target = null;
        let best = 250;
        for (const e of enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.centerX() - cx, e.centerY() - cy);
            if (d < best && Juri.lineClear(world, cx, cy, e.centerX(), e.centerY())) { best = d; this.target = e; }
        }

        // Mark folgen (mit Wandkollision), Abstand halten
        const gd = Math.hypot(px - cx, py - cy);
        this.moving = false;
        if (gd > 52) {
            const len = Math.min(this.speed * (gd > 120 ? 1.5 : 1) * dt, gd - 52);
            const moved = Juri.step(this, (px - cx) / gd * len, (py - cy) / gd * len, world);
            this.stuckTimer = moved < len * 0.3 ? this.stuckTimer + dt : 0;
            this.moving = moved > 0.05;
            if (!this.target) this.facingAngle = Math.atan2(py - cy, px - cx);
        } else {
            this.stuckTimer = 0;
        }
        if (this.moving) this.walkT += dt;
        if (this.target) this.facingAngle = Math.atan2(this.target.centerY() - cy, this.target.centerX() - cx);
        const fc = Math.cos(this.facingAngle);
        if (Math.abs(fc) > 0.15) this.faceX = fc > 0 ? 1 : -1;

        // Spucken: Schattenkugel (ab Welt 9 explosiv), mit Obst-Upgrade Obst mit mehr Schaden
        if (this.target && this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            this.mouthTimer = 0.3;
            if (typeof Game !== 'undefined' && Game.projectiles) {
                const a = this.facingAngle;
                const p = new Projectile(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6,
                    Math.cos(a) * 250, Math.sin(a) * 250,
                    this.damage + (this.fruitAmmo ? 2 : 0), 'player', 80);
                p.radius = 4;
                p.crocSpit = true;
                if (this.fireExplosion) p.explosive = true;
                if (this.fruitAmmo) {
                    p.fruit = true;
                    p.fruitKind = randInt(0, 2);
                    p.radius = 4.5;
                }
                Game.projectiles.push(p);
            }
        }

        // Berührungsschaden durch Gegner
        Juri.bump(this, enemies);
    }

    // Schatten-Krokodil: kleines, aufrechtes Krokodil mit lila Rückenzacken und Schatten-Aura.
    // Kündigt das Spucken mit leuchtendem Maul an. Mit Obst-Upgrade hält es einen Apfel.
    draw(ctx, camera) {
        if (this.dead) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const f = this.faceX || 1;
        const X = dx => cx + dx * f;
        const ph = this.walkT * 11;
        const bob = this.moving ? -Math.abs(Math.sin(ph)) * 1.4 : Math.sin(t * 2.2 + this.seed) * 0.4;
        const open = this.mouthTimer > 0 ? Math.min(1, this.mouthTimer / 0.12) : 0;
        const charge = this.target && this.shootTimer < 0.3 ? clamp(1 - this.shootTimer / 0.3, 0, 1) : 0;
        const G = '#2fb36d', GD = '#1f8a52', INK = '#0f4a2c', SPIKE = '#8a5cff';
        // Betäubt: schwankt um die Füße, Spiralaugen, Sterne über dem Kopf.
        // K.o.: liegt am Boden, erst benommen (Spiralaugen, Sterne), dann schlafend („Zzz").
        const ko = this.koTimer > 0;
        const stunned = !ko && this.stunTimer > 0;
        const dizzy = stunned || (ko && this.koTimer > this.koDur - 2.5);
        if (ko || stunned) {
            ctx.save();
            if (ko) {
                Juri.koPose(ctx, this, cx, cy + 9, f);
            } else {
                ctx.translate(cx, cy + 13);
                ctx.rotate(Math.sin(t * 5 + this.seed) * 0.08);
                ctx.translate(-cx, -(cy + 13));
            }
        }
        // Schatten-Aura und aufsteigende Schattenwölkchen
        Art.glow(ctx, cx, cy + 2, 26, '#8a5cff', 0.24 + 0.06 * Math.sin(t * 3 + this.seed));
        const wu = (t * 0.8 + this.seed) % 1;
        Art.glow(ctx, X(-5), cy - 2 - wu * 14, 4 * (1 - wu) + 1.5, '#a47bff', (1 - wu) * 0.6);
        // Schwanz, wedelt
        const sway = Math.sin(t * 3.2 + this.seed) * 2.2;
        const tx0 = Math.min(X(-19), X(-4));
        Art.shape(ctx, c => {
            c.moveTo(X(-4), cy + 1 + bob);
            c.quadraticCurveTo(X(-13), cy + 1 + sway * 0.5 + bob, X(-19.5), cy + 5 + sway);
            c.quadraticCurveTo(X(-12), cy + 9.5 + sway * 0.4, X(-4), cy + 8.5 + bob);
            c.closePath();
        }, { x: tx0, y: cy, w: 16, h: 10 }, G, { outline: INK });
        // Füße (ein Pfad)
        const l0 = this.moving ? Math.max(0, Math.sin(ph)) * 1.8 : 0;
        const l1 = this.moving ? Math.max(0, Math.sin(ph + Math.PI)) * 1.8 : 0;
        ctx.beginPath();
        ctx.ellipse(X(-3), cy + 10.8 - l0, 3.4, 2.2, 0, 0, TAU);
        ctx.moveTo(X(5) + 3.4, cy + 10.8 - l1);
        ctx.ellipse(X(5), cy + 10.8 - l1, 3.4, 2.2, 0, 0, TAU);
        ctx.fillStyle = GD;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Körper mit hellem Bauch und lila Rückenzacken
        const by = cy + 3 + bob;
        ctx.fillStyle = SPIKE;
        ctx.strokeStyle = '#3b1f7a';
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const a = Math.PI * (1.02 + i * 0.2);
            const bx = cx + Math.cos(a) * 8 * f, byy = by + Math.sin(a) * 7.6;
            ctx.moveTo(bx - 2.2 * f, byy + 1);
            ctx.lineTo(bx + Math.cos(a) * 3.4 * f, byy + Math.sin(a) * 3.4);
            ctx.lineTo(bx + 2.2 * f, byy - 0.6);
        }
        ctx.fill();
        ctx.stroke();
        Art.body(ctx, cx, by, 8.6, 8, G, { outline: INK });
        ctx.fillStyle = '#e6f7b3';
        ctx.beginPath();
        ctx.ellipse(X(1.8), by + 1.5, 5, 5.6, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,150,60,0.55)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(X(-1.5), by + 0.4);
        ctx.lineTo(X(5), by + 0.4);
        ctx.moveTo(X(-1.4), by + 3.4);
        ctx.lineTo(X(4.8), by + 3.4);
        ctx.stroke();
        // Ärmchen (mit Obst-Upgrade: ein Apfel in der Hand)
        Art.limb(ctx, X(4.5), by - 1, X(8.2), by + 1.6, 2.6, G, { lineWidth: 1.1, outline: INK });
        if (this.fruitAmmo) {
            Art.body(ctx, X(9.2), by + 2.6, 2.3, 2.2, '#ff3b4e', { lineWidth: 0.9, outline: '#7a0a1a' });
            ctx.fillStyle = '#4fbf3a';
            ctx.beginPath();
            ctx.ellipse(X(9.8), by - 0.1, 1, 0.5, -0.5 * f, 0, TAU);
            ctx.fill();
        }
        // Kopf mit langer Schnauze
        const hx = X(1.2), hy = cy - 6.5 + bob;
        const jx = X(3.8), jy = hy + 0.6;
        ctx.save();
        ctx.translate(jx, jy);
        ctx.scale(f, 1);
        Art.shape(ctx, c => {
            c.moveTo(-1, 0.6);
            c.lineTo(10.2, 0.9);
            c.quadraticCurveTo(13.2, 1.2, 12.4, 2.8);
            c.quadraticCurveTo(11.4, 4.2, 8, 4);
            c.lineTo(-1, 3.6);
            c.closePath();
        }, { x: -1, y: 0.6, w: 14, h: 3.6 }, '#bfe98a', { outline: INK, lineWidth: 1.2, flat: true });
        if (open > 0) {
            ctx.fillStyle = '#7a1f3a';
            ctx.beginPath();
            ctx.ellipse(6, 0.8, 5, 0.6 + open * 2, 0, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        Art.body(ctx, hx, hy, 8, 6.8, G, { outline: INK });
        ctx.save();
        ctx.translate(jx, jy);
        ctx.scale(f, 1);
        ctx.rotate(-open * 0.45);
        Art.shape(ctx, c => {
            c.moveTo(-1.5, -4.2);
            c.lineTo(8.8, -3.4);
            c.quadraticCurveTo(13.4, -3, 13.4, -0.6);
            c.quadraticCurveTo(13.4, 1.3, 9, 1.3);
            c.lineTo(-1.5, 1.3);
            c.closePath();
        }, { x: -1.5, y: -4.2, w: 15, h: 5.5 }, G, { outline: INK });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const zx = 3.4 + i * 2.8;
            ctx.moveTo(zx - 0.9, 1.1);
            ctx.lineTo(zx, 2.6);
            ctx.lineTo(zx + 0.9, 1.1);
        }
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(11.6, -1.9, 0.6, 0, TAU);
        ctx.moveTo(10.3, -2.2);
        ctx.arc(9.7, -2.2, 0.6, 0, TAU);
        ctx.fill();
        ctx.restore();
        // Maul leuchtet kurz vor und beim Spucken
        if (charge > 0 || open > 0) {
            Art.glow(ctx, X(16), jy + 0.6, 5 + charge * 4, this.fruitAmmo ? '#ffb02e' : '#b28cff', 0.35 + Math.max(charge, open) * 0.5);
        }
        // Augen auf Hügeln oben auf dem Kopf, gelbe Iris, schauen zum Ziel
        let lx = f * 0.8, ly = 0.2;
        const tg = this.target;
        if (tg && !tg.dead) {
            const dx = tg.centerX() - this.centerX(), dy = tg.centerY() - this.centerY();
            const d = Math.hypot(dx, dy) || 1;
            lx = dx / d;
            ly = dy / d;
        }
        const look = { x: lx, y: ly };
        const blink = Art.blink(this.seed);
        const e0 = X(-2), e1 = X(3.4), ey = hy - 5.2;
        ctx.beginPath();
        ctx.ellipse(e0, ey, 3.2, 3, 0, 0, TAU);
        ctx.moveTo(e1 + 3.2, ey);
        ctx.ellipse(e1, ey, 3.2, 3, 0, 0, TAU);
        ctx.fillStyle = G;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = Art.LINE;
        ctx.stroke();
        if (dizzy) {
            Juri.spiralEye(ctx, e0, ey - 0.2, 2.1, t * 7);
            Juri.spiralEye(ctx, e1, ey - 0.2, 2.1, -t * 7);
        } else if (ko) {
            Art.eye(ctx, e0, ey - 0.2, 2.1, look, { open: 0.05, lid: INK });
            Art.eye(ctx, e1, ey - 0.2, 2.1, look, { open: 0.05, lid: INK });
        } else {
            Art.eye(ctx, e0, ey - 0.2, 2.1, look, { iris: '#ffd23f', irisSize: 0.72, open: blink, lid: INK });
            Art.eye(ctx, e1, ey - 0.2, 2.1, look, { iris: '#ffd23f', irisSize: 0.72, open: blink, lid: INK });
        }
        if (ko) {
            ctx.restore();
            if (dizzy) Juri.dizzyStars(ctx, cx - f * 12, cy - 1, 8, this.seed);
            else Juri.zzz(ctx, cx - f * 10, cy - 2, this.seed);
        } else if (stunned) {
            ctx.restore();
            Juri.dizzyStars(ctx, cx, pos.y - 7, 10, this.seed);
        }
        Juri.hpBar(ctx, cx, pos.y - 14, this.hp, this.maxHp);
    }
}

// ══════════════════════════════════════════
// ── Begleiter: Schlange auf Marks Schulter (Belohnung Welt 14) ──
// ══════════════════════════════════════════

class SnakeBuddy {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 14; this.h = 14;
        this.noShadow = true;
        this.dead = false;
        this.hidden = false;
        this.spitTimer = 1.2; this.spitCooldown = 1.8; this.range = 180;
        this.mouthTimer = 0;
        this.aimX = 1; this.aimY = 0.3;
        this.lift = 13;            // wird so viel höher gezeichnet (Schulter statt Boden)
        this.seed = Math.random() * 10;
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }
    takeDamage() {}                // sitzt auf der Schulter, wird nicht getroffen

    update(dt, world, player, enemies) {
        if (!player) return;
        this.hidden = !!player.dead;
        // Auf Marks Schulter (im Bild rechts). Der Sortierpunkt liegt knapp unter Marks Füßen,
        // damit die Schlange über Mark gezeichnet wird.
        this.x = player.x + player.w / 2 + 8.5 - this.w / 2;
        this.y = player.y + player.h - this.h + 0.5;
        if (this.mouthTimer > 0) this.mouthTimer -= dt;
        if (this.hidden) return;
        this.spitTimer -= dt;
        let hx = this.centerX() + 1, hy = this.centerY() - this.lift - 6;   // Kopf
        if (world && world.isWall && world.isWall(hx, hy)) {
            hx = player.x + player.w / 2;
            hy = player.y + player.h / 2;
        }
        let target = null;
        let best = this.range;
        for (const e of enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.centerX() - hx, e.centerY() - hy);
            if (d < best && Juri.lineClear(world, hx, hy, e.centerX(), e.centerY())) { best = d; target = e; }
        }
        if (!target) {
            if (this.spitTimer < 0) this.spitTimer = 0;
            return;
        }
        const dx = target.centerX() - hx, dy = target.centerY() - hy;
        const d = Math.hypot(dx, dy) || 1;
        this.aimX = dx / d;
        this.aimY = dy / d;
        if (this.spitTimer <= 0) {
            this.spitTimer = this.spitCooldown;
            this.mouthTimer = 0.3;
            if (typeof Game !== 'undefined' && Game.projectiles) {
                const p = new Projectile(hx, hy, this.aimX * 240, this.aimY * 240, 2, 'player', 40);
                p.poison = true;
                p.venom = true;
                p.radius = 3.5;
                Game.projectiles.push(p);
            }
        }
    }

    // Kleine grüne Schlange, zusammengeringelt auf der Schulter; wiegt sich, züngelt, spuckt Gift.
    draw(ctx, camera) {
        if (this.hidden || this.dead) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const bx = pos.x + this.w / 2;
        const by = pos.y + this.h / 2 - this.lift;
        const G = '#52d96a', INK = '#1d6b2e';
        const sway = Math.sin(t * 2.4 + this.seed);
        const spit = this.mouthTimer > 0 ? this.mouthTimer / 0.3 : 0;
        const bobY = Math.sin(t * 3.1 + this.seed) * 0.5;
        // zwei Windungen
        Art.body(ctx, bx, by + 3.4, 6.4, 3.3, G, { outline: INK, lineWidth: 1.3 });
        Art.body(ctx, bx - 0.6, by + 0.6 + bobY * 0.5, 4.9, 2.8, G, { outline: INK, lineWidth: 1.3 });
        ctx.fillStyle = '#e3ff9a';
        ctx.beginPath();
        ctx.ellipse(bx + 1.5, by + 4.6, 2.6, 0.9, 0, 0, TAU);
        ctx.fill();
        // Hals und Kopf (stößt beim Spucken nach vorn)
        const nx = bx + 1.2 + sway * 1.3 + this.aimX * spit * 2.4;
        const ny = by - 5.6 + bobY + this.aimY * spit * 1.6;
        Art.limb(ctx, bx + 0.4, by - 0.2, nx - this.aimX * 0.8, ny + 1.8, 3, G, { outline: INK, lineWidth: 1.2 });
        // Zunge (schnellt ab und zu heraus)
        if ((t * 1.3 + this.seed) % 2 < 0.22 || spit > 0.3) {
            const tx = nx + this.aimX * 3.2, ty = ny + 1 + this.aimY * 2;
            ctx.strokeStyle = '#ff4d7a';
            ctx.lineWidth = 0.7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(nx + this.aimX * 1.5, ny + 0.8);
            ctx.lineTo(tx, ty);
            ctx.lineTo(tx + this.aimX * 1.2 - this.aimY * 0.8, ty + this.aimY * 1.2 + 0.6);
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + this.aimX * 1.2 + this.aimY * 0.8, ty + this.aimY * 1.2 - 0.6);
            ctx.stroke();
        }
        Art.body(ctx, nx, ny, 3.5, 3, G, { outline: INK, lineWidth: 1.2 });
        if (spit > 0) {
            ctx.fillStyle = '#7a1f3a';
            ctx.beginPath();
            ctx.ellipse(nx + this.aimX * 1.8, ny + 1.2, 1.4, 0.4 + spit * 1, 0, 0, TAU);
            ctx.fill();
            Art.glow(ctx, nx + this.aimX * 3, ny + 1, 4, '#7dff5a', spit * 0.8);
        }
        Art.eyes(ctx, nx + this.aimX * 0.7, ny - 0.6, 1.3, { gap: 1.55, look: { x: this.aimX, y: this.aimY }, seed: this.seed });
    }
}


// ══════════════════════════════════════════════════════════════
// BossMushroomGiant – Riesen-Pilz (Welt 5)
// Roter Fliegenpilz mit Wurzelarmen und Sporenwolken.
// Sporenring: Hut bläht sich auf, Sporen sammeln sich, Warnring mit Pfeilen (Ankündigung).
// Ranken: Arme recken sich hoch, Warnlinien und rote Kreise zeigen, wo die Ranken zuschlagen.
// Phase 2: dunklerer Hut mit leuchtenden Tupfen, rote Augen; Risse bei wenig HP.
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
        this.fxColor = '#ff3b4f';

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        // Sporenring
        this.sporeCooldown = 4;
        this.sporeTimer = 3;

        // Ranken: vinePlan = Richtungen während der Ankündigung, vines = wachsende Ranken
        this.vines = [];
        this.vinePlan = [];
        this.vineOx = 0;
        this.vineOy = 0;
        this.vineTimer = 0;
        this.vineCooldown = 5;

        this.look = { x: 0, y: 1 };
        this.walk = 0;
        // Tupfen auf dem Hut: x, y (zur Hutmitte), rx, ry
        this.spots = [[-30, -4, 7.5, 5.5], [-6, -19, 6, 4.5], [20, -11, 8, 6], [40, 6, 5.5, 4.2],
            [-44, 11, 4.5, 3.6], [6, 3, 5, 3.8], [-19, 12, 4, 3]];
        // Schwebende Sporen um den Hut (Werte fest, Bewegung über Art.time)
        this.sporeParticles = [];
        for (let i = 0; i < 7; i++) {
            this.sporeParticles.push({
                ox: randRange(-58, 58),
                oy: randRange(-122, -54),
                phase: Math.random() * Math.PI * 2,
                speed: randRange(0.5, 1.3),
            });
        }
    }

    // ── Gemeinsame Hilfen der Bosse aus Welt 5–8 ──

    // Warnungen, Ranken und Windlinien liegen oft weit weg vom Boss. Beim Treffer-Blitz zeichnet die
    // Engine den Boss in eine Hilfsfläche knapp um ihn herum – dort würden sie abgeschnitten.
    // Darum legt update() ein Zeichen-Objekt in Game.particles, das genau ein Bild lebt und
    // boss._drawOverlay() über den Figuren aufruft. (x, y) = Mark, damit es immer sichtbar ist.
    static overlay(boss, x, y) {
        if (typeof Game === 'undefined' || !Game.particles) return;
        Game.particles.push({
            x, y, dead: false, age: 0,
            update() { if (this.age++ > 0) this.dead = true; },
            draw(ctx, camera) { boss._drawOverlay(ctx, camera); },
        });
    }

    // Schaden an Mark mit Rückmeldung (Wackeln, Ton, roter Rand); außerhalb des Spiels direkt.
    static hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && Game._hurtPlayer) Game._hurtPlayer(amount, angle, force);
        else player.takeDamage(amount, angle, force);
    }

    // Innenraum des Boss-Raums (nur im Spiel bekannt, sonst null).
    static room(world) {
        if (typeof Game === 'undefined' || Game.world !== world || !Game.bossActive || !Game._bossRoomRect) return null;
        return Game._bossRoomRect();
    }

    // Drei kreisende Sterne (betäubt).
    static dizzy(ctx, x, y, rx, color) {
        const t = Art.time;
        for (let i = 0; i < 3; i++) {
            const a = t * 4 + i * TAU / 3;
            const s = 0.8 + 0.2 * Math.sin(a);
            Art.star(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * rx * 0.32, 5.5 * s, color, { lineWidth: 1.2, rot: a });
        }
    }

    // Kringel-Augen (betäubt).
    static spiralEyes(ctx, x, y, r, gap) {
        const t = Art.time;
        for (let s = -1; s <= 1; s += 2) {
            const ex = x + s * gap;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = Math.max(1, r * 0.2);
            ctx.beginPath();
            ctx.ellipse(ex, y, r, r * 1.08, 0, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            for (let i = 0; i <= 12; i++) {
                const a = i * 0.95 + t * 7 * s;
                const rr = r * (0.08 + i * 0.058);
                if (i === 0) ctx.moveTo(ex + Math.cos(a) * rr, y + Math.sin(a) * rr);
                else ctx.lineTo(ex + Math.cos(a) * rr, y + Math.sin(a) * rr);
            }
            ctx.lineWidth = Math.max(1, r * 0.18);
            ctx.stroke();
        }
    }

    // Kreuz-Augen (besiegt).
    static xEyes(ctx, x, y, r, gap) {
        ctx.strokeStyle = Art.INK;
        ctx.lineWidth = Math.max(1.2, r * 0.32);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let s = -1; s <= 1; s += 2) {
            const ex = x + s * gap;
            ctx.moveTo(ex - r * 0.7, y - r * 0.7); ctx.lineTo(ex + r * 0.7, y + r * 0.7);
            ctx.moveTo(ex + r * 0.7, y - r * 0.7); ctx.lineTo(ex - r * 0.7, y + r * 0.7);
        }
        ctx.stroke();
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        if (this.hp <= 25 && this.phase === 1) {
            this.phase = 2;
            this.sporeCooldown = 2.5;
            this.vineCooldown = 3.5;
        }

        const pcx = player.x + player.w / 2;
        const pcy = player.y + player.h / 2;
        const mcx = this.centerX();
        const mcy = this.centerY();
        const dx = pcx - mcx;
        const dy = pcy - mcy;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;

        // Ranken wachsen in jedem Zustand weiter (früher froren sie in der Betäubung ein, G-10)
        for (const v of this.vines) {
            v.progress += dt * 2;
            if (v.progress >= 1 && !v.hit) {
                const ex = v.sx + v.dx - pcx;
                const ey = v.sy + v.dy - pcy;
                if (ex * ex + ey * ey < 900) {
                    v.hit = true;
                    BossMushroomGiant.hurt(player, 2, Math.atan2(dy, dx), 200);
                }
            }
        }
        if (this.vines.length) this.vines = this.vines.filter(v => v.progress < 1.5);
        if (this.vines.length || this.state === 'vine_attack' || this.state === 'spore_cloud') {
            BossMushroomGiant.overlay(this, pcx, pcy);
        }

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'wander';
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) this.state = 'wander';
            return;
        }

        if (this.state === 'spore_cloud') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                // Giftsporen im Ring
                const count = this.phase === 2 ? 10 : 6;
                if (projectiles) {
                    for (let i = 0; i < count; i++) {
                        const a = (Math.PI * 2 * i) / count;
                        const p = new Projectile(mcx, mcy, Math.cos(a) * 140, Math.sin(a) * 140, 1, 'enemy', 80);
                        p.poison = true;
                        projectiles.push(p);
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
                // Ranken genau entlang der angekündigten Linien
                for (let i = 0; i < this.vinePlan.length; i++) {
                    const a = this.vinePlan[i];
                    this.vines.push({
                        sx: this.vineOx, sy: this.vineOy,
                        dx: Math.cos(a) * 200, dy: Math.sin(a) * 200,
                        progress: 0, hit: false, seed: i,
                    });
                }
                this.vinePlan.length = 0;
                if (typeof Game !== 'undefined' && Game.camera) Game.camera.shake(4, 0.25);
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        // Wandern: langsam auf Mark zu
        this.walk += dt * 3;
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);

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
            // Richtungen schon jetzt festlegen, damit die Warnlinien genau stimmen
            const n = this.phase === 2 ? 6 : 4;
            this.vineOx = mcx;
            this.vineOy = mcy + 30;
            const base = Math.atan2(pcy - this.vineOy, pcx - this.vineOx);
            this.vinePlan.length = 0;
            for (let i = 0; i < n; i++) this.vinePlan.push(base + (i - (n - 1) / 2) * 0.3);
        }
    }

    // Wurzelarm von der Schulter zur Hand (s = Seite: -1 links, 1 rechts)
    _arm(ctx, s, hx, hy, col) {
        const x0 = 22 * s;
        const y0 = -46;
        const x1 = hx * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2 + 9 * s, (y0 + hy) / 2 - 3, x1, hy);
        ctx.strokeStyle = Art.ink(col);
        ctx.lineWidth = 11.5;
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 7;
        ctx.stroke();
        Art.body(ctx, x1, hy, 7.2, 6.6, col, { lineWidth: 2 });
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const fy = pos.y + this.h;
        const t = Art.time;
        const dead = this.dead;
        const p2 = this.phase === 2 || this.hp <= this.maxHp / 2;
        const stunned = !dead && this.state === 'stunned';
        const sleepy = !dead && this.state === 'intro' && this.introTimer > 1.1;
        const sporeK = !dead && this.state === 'spore_cloud' ? clamp(1 - this.stateTimer / 0.8, 0, 1) : 0;
        const vineK = !dead && this.state === 'vine_attack' ? clamp(1 - this.stateTimer / 0.6, 0, 1) : 0;
        const walking = !dead && this.state === 'wander';
        const cap = p2 ? '#e3243f' : '#ff3b4f';
        const armCol = '#f3d2a2';

        // Haltung: Watscheln, Hochrecken und Stampfen, Zusammensacken
        let sx = 1, sy = 1, tilt = 0;
        if (dead) {
            // Besiegt: steht erstarrt (Engine-Stillstand), danach schnell zusammenschrumpfen
            const d = this.deathProgress();
            const k = d < 0.2 ? 1 + d * 0.5 : Math.max(0.01, 1.1 * (1 - (d - 0.2) / 0.8));
            sx = k * 1.06;
            sy = k * 0.94;
            tilt = -0.08;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        } else if (walking) {
            const s = Math.sin(this.walk * 2) * 0.025;
            sx = 1 + s;
            sy = 1 - s;
            tilt = Math.sin(this.walk) * 0.035;
        } else if (stunned) {
            sx = 1.05;
            sy = 0.94;
            tilt = Math.sin(t * 2.5) * 0.04;
        } else if (vineK > 0) {
            const s = vineK < 0.75 ? -vineK * 0.07 : 0.1 * Math.sin((vineK - 0.75) / 0.25 * Math.PI);
            sx = 1 + s;
            sy = 1 - s;
        } else if (sporeK > 0) {
            sx = 1 + Math.sin(t * 40) * 0.012;
            sy = 1 + sporeK * 0.04;
        } else {
            const s = Math.sin(t * 2) * 0.015;
            sx = 1 + s;
            sy = 1 - s;
        }
        ctx.save();
        ctx.translate(cx, fy);
        ctx.rotate(tilt);
        ctx.scale(sx, sy);

        // Füße
        const st = walking ? Math.sin(this.walk) : 0;
        Art.body(ctx, -19, -6 - Math.max(0, st) * 5, 13, 7.5, '#f0cc98', { highlight: false, lineWidth: 2 });
        Art.body(ctx, 19, -6 - Math.max(0, -st) * 5, 13, 7.5, '#f0cc98', { highlight: false, lineWidth: 2 });

        // Stiel
        Art.shape(ctx, c => {
            c.moveTo(-23, -62);
            c.bezierCurveTo(-31, -46, -35, -14, -25, -5);
            c.quadraticCurveTo(0, 1.5, 25, -5);
            c.bezierCurveTo(35, -14, 31, -46, 23, -62);
            c.closePath();
        }, { x: -33, y: -64, w: 66, h: 64 }, '#fff0d2', { lineWidth: 2.2 });

        // Hände: hängen, recken sich vor den Ranken hoch und stampfen, spreizen sich vor dem Sporenring
        let hx = 41, hyR = -20, hyL = -20;
        if (vineK > 0) {
            const u = vineK < 0.75 ? vineK / 0.75 : 1 - (vineK - 0.75) / 0.25;
            hx = 41 + u * 7;
            hyR = hyL = -20 - u * 64;
        } else if (sporeK > 0) {
            hx = 50;
            hyR = hyL = -44 - sporeK * 12 + Math.sin(t * 30) * 1.5;
        } else if (stunned || dead) {
            hx = 37;
            hyR = hyL = -10;
        } else {
            const sw = walking ? Math.sin(this.walk) * 5 : Math.sin(t * 1.6) * 2;
            hyR = -20 + sw;
            hyL = -20 - sw;
        }
        const armsUp = hyR < -58;
        if (!armsUp) {
            this._arm(ctx, -1, hx, hyL, armCol);
            this._arm(ctx, 1, hx, hyR, armCol);
        }

        // Lamellen unter dem Hut
        Art.body(ctx, 0, -58, 46, 10.5, '#f7d4a8', { highlight: false, lineWidth: 2 });
        ctx.strokeStyle = 'rgba(170,110,60,0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
            const a = 0.35 + i * 0.4;
            ctx.moveTo(Math.cos(a) * 16, -58 + Math.sin(a) * 3.5);
            ctx.lineTo(Math.cos(a) * 42, -58 + Math.sin(a) * 9);
        }
        ctx.stroke();

        // Gesicht auf dem Stiel (nach den Lamellen, damit die bösen Brauen sichtbar bleiben)
        const ey = -38;
        if (dead) BossMushroomGiant.xEyes(ctx, 0, ey, 6.5, 9.5);
        else if (stunned) BossMushroomGiant.spiralEyes(ctx, 0, ey, 7, 9.5);
        else if (sleepy) Art.eyes(ctx, 0, ey, 7.2, { gap: 9.5, open: 0.1 });
        else Art.eyes(ctx, 0, ey, 7.2, { gap: 9.5, look: this.look, angry: true, iris: p2 ? '#ff2e4d' : '#8b5cf6', seed: 2.3 });
        Art.mouth(ctx, 0, -22, 17, dead || sporeK > 0 ? 'o' : (stunned ? 'open' : (sleepy ? 'smile' : 'teeth')));
        Art.blush(ctx, 0, -29, 4.6, 18);

        // Hut (bläht sich vor dem Sporenring auf)
        ctx.save();
        ctx.translate(0, -84);
        const cs = 1 + sporeK * 0.1;
        ctx.scale(cs * (1 + Math.sin(t * 34) * 0.012 * sporeK), cs);
        if (p2 || sporeK > 0) Art.glow(ctx, 0, -4, 74, '#c77dff', (p2 ? 0.22 : 0) + sporeK * 0.55);
        Art.shape(ctx, c => {
            c.moveTo(-53, 24);
            c.bezierCurveTo(-57, -14, -31, -30, 0, -30);
            c.bezierCurveTo(31, -30, 57, -14, 53, 24);
            c.quadraticCurveTo(0, 31, -53, 24);
            c.closePath();
        }, { x: -55, y: -30, w: 110, h: 58 }, cap, { lineWidth: 2.5 });
        const spotGlow = (p2 ? 0.3 + 0.2 * Math.sin(t * 4) : 0) + sporeK * 0.6;
        if (spotGlow > 0 && !dead) {
            for (const s of this.spots) Art.glow(ctx, s[0], s[1], s[2] * 2.6, '#d59bff', spotGlow);
        }
        ctx.fillStyle = '#fff3dd';
        ctx.beginPath();
        for (const s of this.spots) {
            ctx.moveTo(s[0] + s[2], s[1]);
            ctx.ellipse(s[0], s[1], s[2], s[3], 0, 0, TAU);
        }
        ctx.fill();
        Art.shine(ctx, -24, -17, 13, 4.5, -0.35, 0.32);
        // Risse bei wenig HP
        if (this.hp <= this.maxHp * 0.3) {
            ctx.strokeStyle = '#7a0d22';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-40, 17); ctx.lineTo(-33, 9); ctx.lineTo(-36, 3); ctx.lineTo(-29, -4);
            ctx.moveTo(34, 18); ctx.lineTo(29, 11); ctx.lineTo(33, 5);
            ctx.moveTo(-6, -29); ctx.lineTo(-2, -22); ctx.lineTo(-7, -16);
            ctx.stroke();
        }
        ctx.restore();

        if (armsUp) {
            this._arm(ctx, -1, hx, hyL, armCol);
            this._arm(ctx, 1, hx, hyR, armCol);
        }

        // Sporen schweben um den Hut; vor dem Sporenring strömen sie zusammen
        if (!dead) {
            ctx.fillStyle = '#f3dcff';
            ctx.beginPath();
            for (const sp of this.sporeParticles) {
                const x = sp.ox + Math.sin(t * sp.speed + sp.phase) * 10;
                const y = sp.oy + Math.cos(t * sp.speed * 0.7 + sp.phase) * 7;
                Art.glow(ctx, x, y, 7, '#c77dff', 0.6);
                ctx.moveTo(x + 1.6, y);
                ctx.arc(x, y, 1.6, 0, TAU);
            }
            ctx.fill();
        }
        if (sporeK > 0) {
            for (let i = 0; i < 8; i++) {
                const a = i * TAU / 8 + sporeK * 2.5;
                const r = 100 * (1 - sporeK) + 14;
                Art.glow(ctx, Math.cos(a) * r, -84 + Math.sin(a) * r * 0.7, 9, '#b6ff5a', 0.5 + sporeK * 0.5);
            }
        }
        if (stunned) BossMushroomGiant.dizzy(ctx, 0, -124, 34, '#ffd23f');
        ctx.restore();
    }

    // Warnungen und Ranken (über allen Figuren, siehe overlay)
    _drawOverlay(ctx, camera) {
        if (this.dead) return;
        const t = Art.time;
        ctx.save();
        const A = ctx.globalAlpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Sporenring: gestrichelter Kreis, Pfeile genau in Flugrichtung der Sporen
        if (this.state === 'spore_cloud') {
            const k = clamp(1 - this.stateTimer / 0.8, 0, 1);
            const c = camera.worldToScreen(this.centerX(), this.centerY());
            const n = this.phase === 2 ? 10 : 6;
            const r = 60 + k * 10;
            ctx.globalAlpha = A * (0.35 + 0.5 * k);
            ctx.setLineDash([6, 7]);
            ctx.lineDashOffset = -t * 30;
            ctx.strokeStyle = '#b6ff5a';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = '#eaffd0';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const a = TAU * i / n;
                const ca = Math.cos(a);
                const sa = Math.sin(a);
                const tip = r + 13 + k * 8;
                const bx = c.x + ca * tip;
                const by = c.y + sa * tip;
                ctx.moveTo(bx - ca * 8 - sa * 6, by - sa * 8 + ca * 6);
                ctx.lineTo(bx, by);
                ctx.lineTo(bx - ca * 8 + sa * 6, by - sa * 8 - ca * 6);
            }
            ctx.stroke();
        }

        // Ranken-Warnung: gestrichelte Bahnen und rote Kreise dort, wo die Rankenspitzen treffen
        if (this.state === 'vine_attack' && this.vinePlan.length) {
            const k = clamp(1 - this.stateTimer / 0.6, 0, 1);
            const o = camera.worldToScreen(this.vineOx, this.vineOy);
            ctx.globalAlpha = A * (0.4 + 0.5 * k);
            ctx.setLineDash([6, 8]);
            ctx.lineDashOffset = -t * 40;
            ctx.strokeStyle = '#b6ff7a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (const a of this.vinePlan) {
                // vom Boden an den Füßen bis zum Rand des Gefahrenkreises
                const ex = o.x + Math.cos(a) * 200;
                const ey = o.y + Math.sin(a) * 200;
                const bx = o.x + Math.cos(a) * 14;
                const by = o.y + 16 + Math.sin(a) * 10;
                const l = Math.hypot(ex - bx, ey - by) || 1;
                ctx.moveTo(bx, by);
                ctx.lineTo(ex - (ex - bx) / l * 30, ey - (ey - by) / l * 30);
            }
            ctx.stroke();
            ctx.setLineDash([]);
            const pr = 30 * (0.9 + 0.1 * Math.sin(t * 14));
            ctx.beginPath();
            for (const a of this.vinePlan) {
                const ex = o.x + Math.cos(a) * 200;
                const ey = o.y + Math.sin(a) * 200;
                ctx.moveTo(ex + pr, ey);
                ctx.arc(ex, ey, pr, 0, TAU);
            }
            ctx.fillStyle = '#ff3d6e';
            ctx.globalAlpha = A * (0.14 + 0.2 * k);
            ctx.fill();
            ctx.strokeStyle = '#ff3d6e';
            ctx.lineWidth = 2;
            ctx.globalAlpha = A * (0.55 + 0.4 * k);
            ctx.stroke();
        }

        for (const v of this.vines) this._drawVine(ctx, camera, v, A);
        ctx.restore();
    }

    // Eine Ranke: bricht an den Füßen aus dem Boden, dornige Knospe an der Spitze
    _drawVine(ctx, camera, v, A) {
        const p = Math.min(v.progress, 1);
        const fade = v.progress > 1.3 ? Math.max(0, (1.5 - v.progress) / 0.2) : 1;
        const o = camera.worldToScreen(v.sx, v.sy);
        const ex = o.x + v.dx * p;
        const ey = o.y + v.dy * p;
        const sx = o.x + v.dx * 0.07;
        const sy = o.y + 16 + v.dy * 0.05;
        const bend = Math.sin(v.seed * 2.3 + Art.time * 4) * 12 * p;
        const mx = (sx + ex) / 2 - v.dy / 200 * bend;
        const my = (sy + ey) / 2 + v.dx / 200 * bend;
        ctx.globalAlpha = A * fade;
        // aufgewühlte Erde am Austritt
        ctx.fillStyle = 'rgba(70,40,20,0.55)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 7, 3.5, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.strokeStyle = '#1f5f2a';
        ctx.lineWidth = 8.5;
        ctx.stroke();
        ctx.strokeStyle = '#43c552';
        ctx.lineWidth = 5.5;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200,255,170,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // zwei Blätter
        if (p > 0.35) {
            const base = Math.atan2(v.dy, v.dx);
            for (let i = 1; i <= 2; i++) {
                const s = i * 0.33;
                const bx = (1 - s) * (1 - s) * sx + 2 * (1 - s) * s * mx + s * s * ex;
                const by = (1 - s) * (1 - s) * sy + 2 * (1 - s) * s * my + s * s * ey;
                const la = base + (i === 1 ? -1 : 1);
                Art.body(ctx, bx + Math.cos(la) * 6, by + Math.sin(la) * 6, 6, 2.8, '#5fd86a', { rot: la, highlight: false, lineWidth: 1.2 });
            }
        }
        // Dornen-Knospe
        const r = 4 + p * 3;
        Art.star(ctx, ex, ey, r * 1.75, '#2f9a3c', { points: 6, inner: 0.5, rot: Art.time * 3 + v.seed, lineWidth: 1.2 });
        Art.body(ctx, ex, ey, r, r, '#ff5ca8', { lineWidth: 1.6 });
    }
}


// ══════════════════════════════════════════════════════════════
// BossMosquito – Riesen-Mücke (Welt 6)
// Große lila Mücke mit Rüssel, Streifen-Hinterleib und schwirrenden Flügeln.
// Wirbel: zittert und zielt, eine rote Bahn zeigt vorher genau die Flugbahn.
// Sturzflug: steigt auf, Ziel und Bahn werden markiert, dann Sturz.
// An der Raumwand endet jeder Flug mit Betäubung (G-15). Höchstens 4 eigene Fledermäuse (G-09).
// Phase 2 (halbe HP, nur Aussehen): glühender Hinterleib, rote Augen.
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
        this.flying = true;
        this.fxColor = '#a45cff';

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        // Wirbel und Sturzflug
        this.spinAngle = 0;
        this.spinVx = 0;
        this.spinVy = 0;
        this.spinDamageDealt = false;
        this.dashA = 0;
        this.ramTarget = { x: 0, y: 0 };
        this.ramPhase = 'none';
        this.ramTimer = 0;

        // Fledermäuse rufen (mit Obergrenze)
        this.spawnTimer = 12;
        this.spawnCooldown = 12;
        this.minions = [];

        this.bobTimer = 0;
        this.attackTimer = 3;
        this.attackCooldown = 3.5;
        this.look = { x: 0.3, y: 0.8 };   // Blickrichtung im Körper-System (x > 0 = nach vorn)
        this.face = 1;
        this._room = undefined;
    }

    // Hält die Mücke im Boss-Raum; true, wenn sie an die Wand gestoßen ist.
    _keepInRoom() {
        const r = this._room;
        if (!r) return false;
        const nx = clamp(this.x, r.x, r.x + r.w - this.w);
        const ny = clamp(this.y, r.y, r.y + r.h - this.h);
        const hit = Math.abs(nx - this.x) > 0.01 || Math.abs(ny - this.y) > 0.01;
        this.x = nx;
        this.y = ny;
        return hit;
    }

    // Flug mit Gleiten an der Raumwand; true, wenn die Mücke frontal gegen die Wand fliegt
    _dashMove(dt) {
        const bx = this.x;
        const by = this.y;
        this.x += this.spinVx * dt;
        this.y += this.spinVy * dt;
        this._keepInRoom();
        const want = Math.hypot(this.spinVx, this.spinVy) * dt;
        return Math.hypot(this.x - bx, this.y - by) < want * 0.5;
    }

    // Vorausberechnete Flugbahn nach derselben Regel, als Punktliste [x0, y0, x1, y1, …] für die Warnbahn
    _dashPath(a, len) {
        const pts = this._pts || (this._pts = []);
        pts.length = 0;
        let x = this.centerX();
        let y = this.centerY();
        pts.push(x, y);
        const r = this._room;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        for (let d = 0; d < len; d += 8) {
            let nx = x + ca * 8;
            let ny = y + sa * 8;
            if (r) {
                nx = clamp(nx, r.x + this.w / 2, r.x + r.w - this.w / 2);
                ny = clamp(ny, r.y + this.h / 2, r.y + r.h - this.h / 2);
            }
            if (Math.hypot(nx - x, ny - y) < 4) break;
            x = nx;
            y = ny;
            pts.push(x, y);
        }
        return pts;
    }

    // Flug zu Ende: betäubt; an der Wand mit Sternen und Wackeln
    _endDash(bump) {
        this.state = 'stunned';
        this.stunnedTimer = 2;
        this.ramPhase = 'none';
        if (bump && typeof FX !== 'undefined' && typeof Game !== 'undefined' && Game.particles) {
            FX.burst(this.centerX(), this.centerY(), ['#ffffff', '#ffd23f', '#d6b8ff'], 10, 150, 0.45, { kind: 'star' });
            if (Game.camera) Game.camera.shake(4, 0.2);
        }
    }

    _dashHit(player, pcx, pcy, force) {
        if (this.spinDamageDealt) return;
        const ex = pcx - this.centerX();
        const ey = pcy - this.centerY();
        if (ex * ex + ey * ey < 2500) {
            this.spinDamageDealt = true;
            BossMushroomGiant.hurt(player, 2, Math.atan2(ey, ex), force);
        }
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this._room === undefined) this._room = BossMushroomGiant.room(world);
        this.bobTimer += dt;

        const pcx = player.x + player.w / 2;
        const pcy = player.y + player.h / 2;
        const mcx = this.centerX();
        const mcy = this.centerY();
        const dx = pcx - mcx;
        const dy = pcy - mcy;
        const dist = Math.hypot(dx, dy) || 1;
        const dashing = this.state === 'spin' || (this.state === 'arrow_ram' && this.ramPhase === 'charge');
        if (!dashing) {
            if (dx > dist * 0.2) this.face = 1;
            else if (dx < -dist * 0.2) this.face = -1;
            this.look.x = dx / dist * this.face;
            this.look.y = dy / dist;
        }

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'hover';
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) this.state = 'hover';
            return;
        }

        if (this.state === 'spin_wind') {
            // Ankündigung: zittert, Rüssel glüht, Warnbahn am Boden
            this.stateTimer -= dt;
            BossMushroomGiant.overlay(this, pcx, pcy);
            if (this.stateTimer <= 0) {
                this.state = 'spin';
                this.stateTimer = 1;
                this.spinVx = Math.cos(this.dashA) * 250;
                this.spinVy = Math.sin(this.dashA) * 250;
                this.spinAngle = 0;
                this.spinDamageDealt = false;
                if (Math.abs(this.spinVx) > 1) this.face = this.spinVx > 0 ? 1 : -1;
            }
            return;
        }

        if (this.state === 'spin') {
            this.stateTimer -= dt;
            const blocked = this._dashMove(dt);
            this.spinAngle += dt * 15;
            this._dashHit(player, pcx, pcy, 300);
            if (blocked) this._endDash(true);
            else if (this.stateTimer <= 0) this._endDash(false);
            return;
        }

        if (this.state === 'arrow_ram') {
            if (this.ramPhase === 'rise') {
                this.ramTimer -= dt;
                this.y -= 120 * dt;
                this._keepInRoom();
                BossMushroomGiant.overlay(this, pcx, pcy);
                if (this.ramTimer <= 0) {
                    this.ramPhase = 'charge';
                    this.ramTimer = 0.5;
                    const a = Math.atan2(this.ramTarget.y - this.centerY(), this.ramTarget.x - this.centerX());
                    this.dashA = a;
                    this.spinVx = Math.cos(a) * 350;
                    this.spinVy = Math.sin(a) * 350;
                    this.spinDamageDealt = false;
                    if (Math.abs(this.spinVx) > 1) this.face = this.spinVx > 0 ? 1 : -1;
                }
            } else if (this.ramPhase === 'charge') {
                this.ramTimer -= dt;
                const blocked = this._dashMove(dt);
                this._dashHit(player, pcx, pcy, 350);
                if (blocked) this._endDash(true);
                else if (this.ramTimer <= 0) this._endDash(false);
            } else {
                this.state = 'hover';
            }
            return;
        }

        // Schweben: summt hin und her, langsam auf Mark zu
        const buzzX = Math.sin(this.bobTimer * 4) * 30 * dt;
        this.x += dx / dist * this.speed * 0.5 * dt + buzzX;
        this.y += dy / dist * this.speed * 0.5 * dt;
        this._keepInRoom();

        // Fledermäuse rufen: höchstens 4 eigene gleichzeitig, insgesamt höchstens 40 Gegner (G-09)
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && enemies) {
            this.spawnTimer = this.spawnCooldown;
            this.minions = this.minions.filter(m => !m.dead);
            const n = Math.min(2, 4 - this.minions.length, 40 - enemies.length);
            for (let i = 0; i < n; i++) {
                const sa = Math.PI * i + Math.random();
                let bx = mcx + Math.cos(sa) * 60;
                let by = mcy + Math.sin(sa) * 60;
                if (this._room) {
                    bx = clamp(bx, this._room.x + 16, this._room.x + this._room.w - 16);
                    by = clamp(by, this._room.y + 16, this._room.y + this._room.h - 16);
                }
                const bat = new GiantBat(bx, by);
                enemies.push(bat);
                this.minions.push(bat);
            }
        }

        // Angriffe abwechselnd
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.attackCooldown;
            this.attackCycle++;
            if (this.attackCycle % 2 === 1) {
                // Wirbel: Richtung jetzt festlegen und 0,55 s lang anzeigen
                this.state = 'spin_wind';
                this.stateTimer = 0.55;
                this.dashA = Math.atan2(dy, dx);
            } else {
                // Sturzflug: Ziel jetzt merken und während des Aufstiegs markieren
                this.state = 'arrow_ram';
                this.ramPhase = 'rise';
                this.ramTimer = 0.6;
                this.ramTarget.x = pcx;
                this.ramTarget.y = pcy;
            }
        }
    }

    // Durchsichtiger Flügel mit Adern (Flügelwurzel im Ursprung, Winkel a)
    _wing(ctx, a, alpha) {
        const A = ctx.globalAlpha;
        const wx = Math.cos(a) * 21;
        const wy = Math.sin(a) * 21;
        ctx.globalAlpha = A * alpha;
        ctx.fillStyle = 'rgba(222,246,255,0.8)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(wx, wy, 25, 9, a, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(150,120,230,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(wx * 2, wy * 2);
        ctx.moveTo(wx * 0.6, wy * 0.6);
        ctx.lineTo(wx * 1.5 - Math.sin(a) * 6, wy * 1.5 + Math.cos(a) * 6);
        ctx.stroke();
        ctx.globalAlpha = A;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const dead = this.dead;
        const p2 = this.hp <= this.maxHp / 2;
        const stunned = !dead && this.state === 'stunned';
        const rising = !dead && this.state === 'arrow_ram' && this.ramPhase === 'rise';
        const winding = !dead && (this.state === 'spin_wind' || rising);
        const charging = !dead && this.state === 'arrow_ram' && this.ramPhase === 'charge';
        const body = '#9b5cff';
        const dark = '#7440d8';
        let k = 1, rot = 0, jx = 0, jy = Math.sin(t * 3.4) * 4;
        if (dead) {
            // Besiegt: erstarrt, dann schnell zusammenschrumpfen
            const d = this.deathProgress();
            k = d < 0.2 ? 1 + d * 0.5 : Math.max(0.01, 1.1 * (1 - (d - 0.2) / 0.8));
            rot = 0.3 + d * 4;
            jy = 0;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        } else if (this.state === 'spin') {
            rot = this.spinAngle;
        } else if (charging) {
            rot = clamp(Math.atan2(this.spinVy, Math.abs(this.spinVx)), -0.8, 0.8);
        } else if (winding) {
            jx = Math.sin(t * 70) * 1.6;
            rot = rising ? -0.3 : Math.sin(t * 24) * 0.1;
        } else if (stunned) {
            rot = Math.sin(t * 2.2) * 0.14;
            jy = 6 + Math.sin(t * 2.2) * 2;
        }
        const flap = stunned ? 9 : (winding || charging || this.state === 'spin' ? 66 : 42);
        const fa = -1.95 + Math.sin(t * flap) * (stunned ? 0.18 : 0.42);
        const A = ctx.globalAlpha;
        ctx.save();
        ctx.translate(cx + jx, cy + jy);
        ctx.scale(this.face * k, k);
        ctx.rotate(rot);

        // Unschärfe-Fächer und hinterer Flügel
        if (!stunned && !dead) {
            ctx.globalAlpha = A * 0.16;
            ctx.fillStyle = '#e4f8ff';
            ctx.beginPath();
            ctx.moveTo(-3, -14);
            ctx.arc(-3, -14, 46, -2.55, -1.3);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = A;
        }
        ctx.save();
        ctx.translate(-8, -15);
        this._wing(ctx, fa - 0.3, 0.55);
        ctx.restore();

        // Beine hinten
        const sw = Math.sin(t * 3 + 1) * 1.5;
        ctx.strokeStyle = '#4a2396';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, 8); ctx.lineTo(-16 + sw, 20); ctx.lineTo(-20 + sw, 31);
        ctx.moveTo(0, 10); ctx.lineTo(-4 + sw, 23); ctx.lineTo(-7 + sw, 35);
        ctx.moveTo(7, 9); ctx.lineTo(11 + sw, 21); ctx.lineTo(13 + sw, 33);
        ctx.stroke();

        // Hinterleib mit Streifen (glüht in Phase 2)
        if (p2 && !dead) Art.glow(ctx, -26, 10, 42, '#ff4d8a', 0.7 + Math.sin(t * 5) * 0.2);
        Art.body(ctx, -25, 9, 23, 12.5, body, { rot: 0.42, lineWidth: 2.2 });
        ctx.strokeStyle = p2 ? '#ffb3dc' : '#ead6ff';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-39.5, 12.1); ctx.quadraticCurveTo(-34.6, 4.9, -32.4, -3.9);
        ctx.moveTo(-31.9, 17.1); ctx.quadraticCurveTo(-26.4, 8.6, -23.6, -1.5);
        ctx.moveTo(-23.6, 20.5); ctx.quadraticCurveTo(-18.2, 12.2, -15.5, 2.4);
        ctx.stroke();

        // Brust
        Art.body(ctx, 0, -2, 16, 14, dark, { lineWidth: 2.2 });

        // Beine vorn
        ctx.strokeStyle = '#4a2396';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-4, 10); ctx.lineTo(-11 - sw, 23); ctx.lineTo(-13 - sw, 34);
        ctx.moveTo(4, 11); ctx.lineTo(3 - sw, 25); ctx.lineTo(1 - sw, 37);
        ctx.moveTo(11, 8); ctx.lineTo(18 - sw, 20); ctx.lineTo(22 - sw, 30);
        ctx.stroke();

        // Kopf mit Fühlern
        ctx.strokeStyle = '#4a2396';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(15, -22); ctx.quadraticCurveTo(15, -34, 22, -39);
        ctx.moveTo(24, -22); ctx.quadraticCurveTo(28, -32, 35, -35);
        ctx.stroke();
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(24.8, -39); ctx.arc(22, -39, 2.8, 0, TAU);
        ctx.moveTo(37.8, -35); ctx.arc(35, -35, 2.8, 0, TAU);
        ctx.fill();
        Art.body(ctx, 20, -13, 14, 12.5, body, { lineWidth: 2.2 });

        // Rüssel zeigt zu Mark, glüht vor Wirbel und Sturz
        const na = charging || this.state === 'spin' ? 0.25 : clamp(Math.atan2(this.look.y, Math.max(0.25, this.look.x)), -0.7, 1.25);
        const nx = 30 + Math.cos(na) * 34;
        const ny = -7 + Math.sin(na) * 34;
        Art.limb(ctx, 30, -7, nx, ny, 3.2, '#7a2446', { lineWidth: 1.6 });
        ctx.strokeStyle = 'rgba(255,170,200,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(30 + Math.cos(na) * 4, -8 + Math.sin(na) * 4);
        ctx.lineTo(30 + Math.cos(na) * 26, -8 + Math.sin(na) * 26);
        ctx.stroke();
        if (winding) Art.glow(ctx, nx, ny, 12, '#ff3d6e', 0.7 + Math.sin(t * 30) * 0.25);

        // Augen
        if (dead) BossMushroomGiant.xEyes(ctx, 21, -16, 5.4, 6.6);
        else if (stunned) BossMushroomGiant.spiralEyes(ctx, 21, -16, 6, 6.6);
        else Art.eyes(ctx, 21, -16, 6.2, { gap: 6.6, look: this.look, angry: true, iris: p2 ? '#ff2244' : '#ff6a3d', seed: 4.2 });

        // vorderer Flügel
        ctx.save();
        ctx.translate(-3, -14);
        this._wing(ctx, fa, 0.8);
        ctx.restore();
        ctx.restore();

        if (stunned) BossMushroomGiant.dizzy(ctx, cx + this.face * 18, cy + jy - 44, 26, '#ffd23f');
    }

    // Warnbahn vor Wirbel und Sturzflug (über allen Figuren, siehe BossMushroomGiant.overlay)
    _drawOverlay(ctx, camera) {
        if (this.dead) return;
        const t = Art.time;
        let a, len, k;
        const ram = this.state === 'arrow_ram' && this.ramPhase === 'rise';
        if (this.state === 'spin_wind') {
            a = this.dashA;
            len = 250;
            k = clamp(1 - this.stateTimer / 0.55, 0, 1);
        } else if (ram) {
            a = Math.atan2(this.ramTarget.y - this.centerY(), this.ramTarget.x - this.centerX());
            len = 175;
            k = clamp(1 - this.ramTimer / 0.6, 0, 1);
        } else {
            return;
        }
        // Flugbahn wie im Update (gleitet an der Wand, endet frontal an ihr)
        const pts = this._dashPath(a, len);
        const n = pts.length / 2;
        const o = camera.worldToScreen(0, 0);
        ctx.save();
        const A = ctx.globalAlpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(pts[0] + o.x, pts[1] + o.y);
        for (let i = 1; i < n; i++) ctx.lineTo(pts[i * 2] + o.x, pts[i * 2 + 1] + o.y);
        if (n === 1) ctx.lineTo(pts[0] + o.x + 0.1, pts[1] + o.y);
        // Gefahrenbahn so breit wie der Trefferbereich (50 um die Mitte), dazu eine Mittellinie
        ctx.strokeStyle = '#ff3d6e';
        ctx.lineWidth = 100;
        ctx.globalAlpha = A * (0.13 + 0.15 * k);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.globalAlpha = A * (0.5 + 0.4 * k);
        ctx.stroke();
        // wandernde Pfeile entlang der Bahn
        const total = (n - 1) * 8;
        if (total > 16) {
            ctx.beginPath();
            const cnt = Math.max(1, Math.round(total / 55));
            for (let i = 0; i < cnt; i++) {
                const s = (t * 110 + i * total / cnt) % total;
                const seg = Math.min(n - 2, Math.floor(s / 8));
                const f = (s - seg * 8) / 8;
                const x0 = pts[seg * 2], y0 = pts[seg * 2 + 1];
                const x1 = pts[seg * 2 + 2], y1 = pts[seg * 2 + 3];
                const l = Math.hypot(x1 - x0, y1 - y0) || 1;
                const ux = (x1 - x0) / l, uy = (y1 - y0) / l;
                const px = x0 + (x1 - x0) * f + o.x, py = y0 + (y1 - y0) * f + o.y;
                ctx.moveTo(px - ux * 10 - uy * 13, py - uy * 10 + ux * 13);
                ctx.lineTo(px + ux * 3, py + uy * 3);
                ctx.lineTo(px - ux * 10 + uy * 13, py - uy * 10 - ux * 13);
            }
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.globalAlpha = A * (0.6 + 0.4 * k);
            ctx.stroke();
        }
        ctx.restore();
        // Zielkreuz am gemerkten Ziel des Sturzflugs
        if (ram) {
            const p = camera.worldToScreen(this.ramTarget.x, this.ramTarget.y);
            const r = 16 - k * 4;
            ctx.save();
            ctx.globalAlpha = A * (0.6 + 0.4 * k);
            ctx.strokeStyle = '#ff3d6e';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, TAU);
            ctx.moveTo(p.x - r - 6, p.y); ctx.lineTo(p.x - r + 4, p.y);
            ctx.moveTo(p.x + r + 6, p.y); ctx.lineTo(p.x + r - 4, p.y);
            ctx.moveTo(p.x, p.y - r - 6); ctx.lineTo(p.x, p.y - r + 4);
            ctx.moveTo(p.x, p.y + r + 6); ctx.lineTo(p.x, p.y + r - 4);
            ctx.stroke();
            ctx.restore();
        }
    }
}


// ══════════════════════════════════════════════════════════════
// BossSnowEagle – Schnee-Adler (Welt 7)
// Weißer Adler mit eisblauen Frost-Flügeln, Federhaube, goldenem Hakenschnabel und Eiskristallen.
// Eisregen: Flügel hoch, blaue Warnpunkte und Bahnen zeigen, wo die Eisfedern fallen –
// nur auf freien Stellen im Raum (G-11).
// Frostwind: erst Windlinien als Ankündigung, dann schiebt eine schwache Böe Mark mit
// Wandkollision (G-04: früher 400/s ohne Kollision, Mark flog aus der Karte).
// Phase 2 (halbe HP, nur Aussehen): stärkere Frost-Aura, tiefblaue Federn, Eisspitzen.
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
        this.flying = true;
        this.fxColor = '#7fd8ff';

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        this.attackTimer = 3;
        this.attackCooldown = 3.5;

        this.wingAnim = 0;         // zusätzlicher Flügelschlag in der Böe
        this.trailAcc = 0;         // Frostspur: Partikel pro Zeit statt Zufall pro Bild (G-17)
        this.rainSpots = [];       // geplante Eisfedern {x, y, vx, vy}
        this.windUp = 0;           // Ankündigung des Frostwinds (Sekunden)
        this.windAngle = 0;
        this.windActive = false;
        this.windPx = 0;           // Mark (für die Windpfeile)
        this.windPy = 0;
        this.look = { x: 0, y: 1 };
        this._room = undefined;
        // Federn eines Flügels: x, y, rx (Länge/2), ry, Drehung (Schulter im Ursprung).
        // Lange „Finger“ am Handgelenk wie beim echten Adler, darunter kurze Armfedern.
        this.primaries = [[40.5, -35, 13, 4.4, -1.05], [46.8, -31.9, 15, 4.4, -0.62], [50.2, -25.5, 15.5, 4.3, -0.2],
            [49.2, -18.7, 14.5, 4.2, 0.2], [45.1, -14.1, 12.5, 4, 0.58],
            [27, -3, 9, 3.8, 0.85], [20, 2, 9.5, 3.8, 1.1], [13, 5, 9.5, 3.7, 1.3], [6, 6, 9, 3.6, 1.45]];
        // Schwanzfedern: x, y, rx, ry, Drehung
        this.tailFeathers = [[-12, 32, 4, 12, 0.55], [-6, 35, 4.2, 13, 0.27], [0, 36.5, 4.4, 13.5, 0],
            [6, 35, 4.2, 13, -0.27], [12, 32, 4, 12, -0.55]];
    }

    // Schnee-Glitzer aus den Flügeln (Partikel mit gemeinsamer Obergrenze)
    _emitSnow(mcx, mcy) {
        if (typeof Game === 'undefined' || !Game.particles || typeof Particle === 'undefined') return;
        const side = Math.random() < 0.5 ? -1 : 1;
        const p = new Particle(mcx + side * randRange(20, 62), mcy + randRange(-6, 14),
            randRange(-12, 12), randRange(10, 30), Math.random() < 0.5 ? '#ffffff' : '#bdefff', randRange(0.6, 1));
        p.radius = randRange(1.2, 2.4);
        p.drag = 1;
        p.gravity = 16;
        Game.particles.push(p);
    }

    // Eisregen planen: acht Eisfedern über Mark, nur auf freien Stellen im Raum (G-11)
    _planIceRain(world, pcx, pcy) {
        this.rainSpots.length = 0;
        const room = this._room;
        for (let i = 0; i < 8; i++) {
            const x = pcx + (i - 3.5) * 40 + randRange(-12, 12);
            if (room && (x < room.x + 8 || x > room.x + room.w - 8)) continue;
            // Start 160 über Mark; liegt dort eine Wand, weiter unten die erste freie Stelle
            let y = pcy - 160;
            if (room) y = Math.max(y, room.y + 10);
            while (y < pcy && world.isWall(x, y)) y += 8;
            if (world.isWall(x, y)) continue;
            this.rainSpots.push({ x, y, vx: randRange(-20, 20), vy: randRange(150, 220) });
        }
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this._room === undefined) this._room = BossMushroomGiant.room(world);

        const pcx = player.x + player.w / 2;
        const pcy = player.y + player.h / 2;
        const mcx = this.centerX();
        const mcy = this.centerY();
        const dx = pcx - mcx;
        const dy = pcy - mcy;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;

        // Frostspur: zeitbasiert (G-17), in der Böe dichter
        this.trailAcc += dt * (this.windActive ? 16 : 8);
        while (this.trailAcc >= 1) {
            this.trailAcc -= 1;
            this._emitSnow(mcx, mcy);
        }

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'soar';
            return;
        }

        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) this.state = 'soar';
            return;
        }

        if (this.state === 'ice_rain') {
            this.stateTimer -= dt;
            BossMushroomGiant.overlay(this, pcx, pcy);
            if (this.stateTimer <= 0) {
                if (projectiles) {
                    for (const s of this.rainSpots) {
                        const p = new Projectile(s.x, s.y, s.vx, s.vy, 1, 'enemy', 60);
                        p.isIce = true;
                        projectiles.push(p);
                    }
                }
                this.rainSpots.length = 0;
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        if (this.state === 'frost_wind') {
            this.windAngle = Math.atan2(dy, dx);
            this.windPx = pcx;
            this.windPy = pcy;
            BossMushroomGiant.overlay(this, pcx, pcy);
            if (this.windUp > 0) {
                // Ankündigung: nur Windlinien, noch kein Schub
                this.windUp -= dt;
                return;
            }
            this.windActive = true;
            this.wingAnim += dt * 11;
            this.stateTimer -= dt;
            // Böe: schiebt Mark vom Adler weg, mit Wandkollision und deutlich schwächer als früher (G-04)
            if (!player.dead && !player.autoActive && player._moveWithCollision) {
                player._moveWithCollision(Math.cos(this.windAngle) * 130 * dt, Math.sin(this.windAngle) * 130 * dt, world);
            }
            if (this.stateTimer <= 0) {
                this.windActive = false;
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        // Kreisen um Mark
        const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
        if (dist > 180) {
            this.x += this.look.x * this.speed * dt;
            this.y += this.look.y * this.speed * dt;
        } else if (dist < 120) {
            this.x -= this.look.x * this.speed * 0.5 * dt;
            this.y -= this.look.y * this.speed * 0.5 * dt;
        }
        this.x += Math.cos(orbitAngle) * this.speed * 0.6 * dt;
        this.y += Math.sin(orbitAngle) * this.speed * 0.6 * dt;

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.attackCooldown;
            this.attackCycle++;
            if (this.attackCycle % 2 === 1) {
                this.state = 'ice_rain';
                this.stateTimer = 0.9;
                this._planIceRain(world, pcx, pcy);
            } else {
                this.state = 'frost_wind';
                this.windUp = 0.9;
                this.stateTimer = 1.5;
                this.windAngle = Math.atan2(dy, dx);
                this.windPx = pcx;
                this.windPy = pcy;
            }
        }
    }

    // Ein Flügel (s = Seite: -1 links, 1 rechts). flap/lift: Flügelschlag und Anheben (Bogenmaß)
    _wing(ctx, s, flap, lift, p2, glowK) {
        const t = Art.time;
        ctx.save();
        ctx.translate(14 * s, -8);
        ctx.scale(s * 0.82, 0.82);
        ctx.rotate(-(flap * 0.3 + lift));
        // Schwung- und Armfedern (eisblau)
        const feathers = this.primaries;
        Art.shape(ctx, c => {
            for (const f of feathers) {
                c.moveTo(f[0] + f[2] * Math.cos(f[4]), f[1] + f[2] * Math.sin(f[4]));
                c.ellipse(f[0], f[1], f[2], f[3], f[4], 0, TAU);
            }
        }, { x: 0, y: -46, w: 66, h: 62 }, p2 ? '#2fa4ff' : '#5cc4ff', { outline: '#1d4f8c', lineWidth: 1.8 });
        // Deckfedern (weiß) mit gewelltem Unterrand
        Art.shape(ctx, c => {
            c.moveTo(-4, -8);
            c.quadraticCurveTo(10, -30, 30, -30);
            c.quadraticCurveTo(41, -29, 39, -19);
            c.quadraticCurveTo(35, -10, 29, -8);
            c.quadraticCurveTo(26, -2, 21, -4);
            c.quadraticCurveTo(17, 1, 12, -1);
            c.quadraticCurveTo(7, 3, 2, 1);
            c.quadraticCurveTo(-2, 3, -4, 4);
            c.closePath();
        }, { x: -4, y: -30, w: 45, h: 34 }, '#f5f9ff', { outline: '#2e4f86', lineWidth: 2.2 });
        // Federlinie
        ctx.strokeStyle = 'rgba(80,150,220,0.5)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(6, -12); ctx.quadraticCurveTo(18, -20, 31, -20);
        ctx.stroke();
        // Eisspitzen auf der Vorderkante (Phase 2)
        if (p2) {
            ctx.fillStyle = '#c9f4ff';
            ctx.strokeStyle = '#2f7fd0';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(8, -22); ctx.lineTo(10, -33); ctx.lineTo(15, -25);
            ctx.moveTo(17, -27); ctx.lineTo(21, -39); ctx.lineTo(25, -29);
            ctx.moveTo(27, -30); ctx.lineTo(33, -40); ctx.lineTo(35, -29);
            ctx.fill();
            ctx.stroke();
        }
        // Eiskristall funkelt an der Flügelspitze
        const tw = 0.5 + 0.5 * Math.sin(t * 5 + s);
        Art.sparkle(ctx, 60, -38, 2.5 + tw * 3 + glowK * 3, '#ffffff', 0.55 + tw * 0.45);
        if (glowK > 0) Art.glow(ctx, 46, -24, 30, '#7fe3ff', glowK * 0.7);
        ctx.restore();
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const dead = this.dead;
        const p2 = this.hp <= this.maxHp / 2;
        const stunned = !dead && this.state === 'stunned';
        const rainK = !dead && this.state === 'ice_rain' ? clamp(1 - this.stateTimer / 0.9, 0, 1) : 0;
        const windUpK = !dead && this.state === 'frost_wind' && this.windUp > 0 ? clamp(1 - this.windUp / 0.9, 0, 1) : 0;
        const gust = !dead && this.state === 'frost_wind' && this.windUp <= 0;
        const white = '#f5f9ff';
        const line = '#2e4f86';
        let k = 1;
        let bob = Math.sin(t * 2.2) * 4;
        if (dead) {
            // Besiegt: erstarrt, dann schnell zusammenschrumpfen
            const d = this.deathProgress();
            k = d < 0.2 ? 1 + d * 0.5 : Math.max(0.01, 1.1 * (1 - (d - 0.2) / 0.8));
            bob = 0;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        }
        // Flügel: ruhiger Schlag, Böe schnell, erhoben vor Angriffen, hängend wenn betäubt
        let flap = Math.sin(t * 2.6 + this.wingAnim);
        let lift = 0;
        if (stunned || dead) {
            flap = Math.sin(t * 1.5) * 0.2;
            lift = -0.35;
        } else if (rainK > 0) {
            lift = 0.2 + rainK * 0.45;
            flap *= 0.3;
        } else if (windUpK > 0) {
            lift = 0.25 + windUpK * 0.45;
            flap = Math.sin(t * 20) * 0.08;
        }
        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.scale(k, k);

        // Frost-Aura
        if (!dead) Art.glow(ctx, 0, 0, 80, '#9fe6ff', (p2 ? 0.42 : 0.24) + rainK * 0.3 + (gust ? 0.2 : 0));

        // Schwanzfedern: blaue Spitzen, darüber weiß
        const tail = this.tailFeathers;
        Art.shape(ctx, c => {
            for (const f of tail) {
                c.moveTo(f[0] + f[2] * Math.cos(f[4]), f[1] + f[2] * Math.sin(f[4]));
                c.ellipse(f[0], f[1], f[2], f[3], f[4], 0, TAU);
            }
        }, { x: -20, y: 22, w: 40, h: 30 }, p2 ? '#2fa4ff' : '#5cc4ff', { outline: '#1d4f8c', lineWidth: 1.6 });
        Art.shape(ctx, c => {
            for (const f of tail) {
                const oy = f[1] - 3.5;
                c.moveTo(f[0] + f[2] * Math.cos(f[4]), oy + f[2] * Math.sin(f[4]));
                c.ellipse(f[0], oy, f[2], f[3] * 0.72, f[4], 0, TAU);
            }
        }, { x: -20, y: 20, w: 40, h: 24 }, white, { outline: false });

        // Flügel
        this._wing(ctx, -1, flap, lift, p2, rainK);
        this._wing(ctx, 1, flap, lift, p2, rainK);

        // Körper mit Brustfedern
        Art.body(ctx, 0, 6, 21, 26, white, { outline: line, lineWidth: 2.2 });
        ctx.strokeStyle = 'rgba(80,150,220,0.55)';
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-4, 5); ctx.lineTo(0, 8); ctx.lineTo(4, 5);
        ctx.moveTo(-10, 13); ctx.lineTo(-6, 16); ctx.lineTo(-2, 13);
        ctx.moveTo(2, 13); ctx.lineTo(6, 16); ctx.lineTo(10, 13);
        ctx.stroke();

        // Krallen
        Art.body(ctx, -8, 30, 4.5, 3, '#ffc233', { highlight: false, lineWidth: 1.4 });
        Art.body(ctx, 8, 30, 4.5, 3, '#ffc233', { highlight: false, lineWidth: 1.4 });
        ctx.strokeStyle = '#6b4a00';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-10.5, 32); ctx.lineTo(-11.5, 35.5);
        ctx.moveTo(-5.5, 32); ctx.lineTo(-4.5, 35.5);
        ctx.moveTo(5.5, 32); ctx.lineTo(4.5, 35.5);
        ctx.moveTo(10.5, 32); ctx.lineTo(11.5, 35.5);
        ctx.stroke();

        // Federhaube, Kopf, Augen, Hakenschnabel
        Art.shape(ctx, c => {
            c.moveTo(-7 + 3.2 * Math.cos(-0.55), -36 + 3.2 * Math.sin(-0.55)); c.ellipse(-7, -36, 3.2, 9, -0.55, 0, TAU);
            c.moveTo(3.4, -39); c.ellipse(0, -39, 3.4, 10, 0, 0, TAU);
            c.moveTo(7 + 3.2 * Math.cos(0.55), -36 + 3.2 * Math.sin(0.55)); c.ellipse(7, -36, 3.2, 9, 0.55, 0, TAU);
        }, { x: -12, y: -49, w: 24, h: 20 }, p2 ? '#2fa4ff' : '#5cc4ff', { outline: '#1d4f8c', lineWidth: 1.6 });
        Art.body(ctx, 0, -24, 14, 13, white, { outline: line, lineWidth: 2.2 });
        if (dead) BossMushroomGiant.xEyes(ctx, 0, -26.5, 4.2, 6);
        else if (stunned) BossMushroomGiant.spiralEyes(ctx, 0, -26.5, 4.6, 6);
        else Art.eyes(ctx, 0, -26, 4.6, { gap: 6, look: this.look, angry: true, iris: p2 ? '#0f7fff' : '#28a8ff', seed: 1.7 });
        // kräftiger Hakenschnabel mit dunkler Spitze
        Art.shape(ctx, c => {
            c.moveTo(-6, -20.5);
            c.quadraticCurveTo(0, -23.5, 6, -20.5);
            c.quadraticCurveTo(6.2, -12, 1.6, -6.5);
            c.quadraticCurveTo(0, -4.8, -1.2, -7.6);
            c.quadraticCurveTo(-5.6, -12, -6, -20.5);
            c.closePath();
        }, { x: -6, y: -23.5, w: 12.4, h: 19 }, '#ffc233', { lineWidth: 1.6 });
        ctx.fillStyle = '#d18a00';
        ctx.beginPath();
        ctx.moveTo(2.6, -9.5); ctx.quadraticCurveTo(1.6, -6.5, 0, -5.4); ctx.quadraticCurveTo(-0.8, -6.8, -0.9, -8.6);
        ctx.fill();

        // Vor dem Eisregen bildet sich Eis über dem Kopf
        if (rainK > 0) {
            for (let i = 0; i < 3; i++) {
                const a = t * 3 + i * TAU / 3;
                Art.sparkle(ctx, Math.cos(a) * 20, -52 + Math.sin(a) * 5, 3 + rainK * 4, '#ffffff', 0.5 + rainK * 0.5);
            }
            Art.glow(ctx, 0, -52, 18 + rainK * 12, '#7fe3ff', rainK * 0.8);
        }
        ctx.restore();

        if (stunned) {
            for (let i = 0; i < 3; i++) {
                const a = t * 4 + i * TAU / 3;
                Art.sparkle(ctx, cx + Math.cos(a) * 26, cy + bob - 50 + Math.sin(a) * 8, 5 + Math.sin(a) * 1.5, '#dff8ff', 0.95);
            }
        }
    }

    // Warnpunkte für den Eisregen und Windlinien (über allen Figuren, siehe BossMushroomGiant.overlay)
    _drawOverlay(ctx, camera) {
        if (this.dead) return;
        const t = Art.time;
        ctx.save();
        const A = ctx.globalAlpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (this.state === 'ice_rain' && this.rainSpots.length) {
            const k = clamp(1 - this.stateTimer / 0.9, 0, 1);
            // Fallbahnen der Eisfedern
            ctx.beginPath();
            for (const s of this.rainSpots) {
                const p = camera.worldToScreen(s.x, s.y);
                const l = 130 / Math.hypot(s.vx, s.vy);
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + s.vx * l, p.y + s.vy * l);
            }
            ctx.strokeStyle = '#1f6fd6';
            ctx.lineWidth = 12;
            ctx.globalAlpha = A * (0.2 + 0.22 * k);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
            ctx.globalAlpha = A * (0.45 + 0.45 * k);
            ctx.stroke();
            // Startpunkte: pulsierende Eiskreise mit Kristall
            ctx.globalAlpha = A;
            const pr = 9 + Math.sin(t * 12) * 1.5;
            for (const s of this.rainSpots) {
                const p = camera.worldToScreen(s.x, s.y);
                Art.glow(ctx, p.x, p.y, 16, '#7fd8ff', 0.5 + 0.4 * k);
                Art.ring(ctx, p.x, p.y, pr, '#e8fbff', 2, 0.6 + 0.4 * k);
                Art.sparkle(ctx, p.x, p.y, 4 + k * 3, '#ffffff', 0.95);
            }
        }

        if (this.state === 'frost_wind') {
            const gust = this.windUp <= 0;
            const k = gust ? 1 : clamp(1 - this.windUp / 0.9, 0, 1);
            const a = this.windAngle;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const o = camera.worldToScreen(this.centerX(), this.centerY());
            const speed = gust ? 420 : 170;
            const len = gust ? 46 : 26;
            // Windlinien vom Adler weg, an Mark vorbei
            ctx.beginPath();
            for (let i = 0; i < 14; i++) {
                const lane = ((i * 5) % 14 - 6.5) * 11;
                const along = 40 + ((t * speed + i * 83) % 400);
                const wob = Math.sin(t * 5 + i * 1.7) * 5;
                const x0 = o.x + ca * along - sa * (lane + wob);
                const y0 = o.y + sa * along + ca * (lane + wob);
                ctx.moveTo(x0, y0);
                ctx.quadraticCurveTo(x0 + ca * len * 0.5 - sa * 4, y0 + sa * len * 0.5 + ca * 4, x0 + ca * len, y0 + sa * len);
            }
            ctx.strokeStyle = '#1f6fd6';
            ctx.lineWidth = gust ? 5.5 : 4.5;
            ctx.globalAlpha = A * (gust ? 0.6 : 0.3 + 0.35 * k);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = gust ? 2.2 : 1.8;
            ctx.globalAlpha = A * (gust ? 0.95 : 0.45 + 0.45 * k);
            ctx.stroke();
            // große Pfeile an Mark zeigen, wohin der Wind schiebt
            const p = camera.worldToScreen(this.windPx, this.windPy);
            const pulse = (t * (gust ? 3 : 1.6)) % 1;
            ctx.beginPath();
            for (let i = 0; i < 2; i++) {
                const d = 24 + i * 18 + pulse * 10;
                const bx = p.x + ca * d;
                const by = p.y + sa * d;
                ctx.moveTo(bx - ca * 11 - sa * 13, by - sa * 11 + ca * 13);
                ctx.lineTo(bx, by);
                ctx.lineTo(bx - ca * 11 + sa * 13, by - sa * 11 - ca * 13);
            }
            ctx.strokeStyle = '#1f6fd6';
            ctx.lineWidth = 8;
            ctx.globalAlpha = A * (0.45 + 0.4 * k);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.globalAlpha = A * (0.6 + 0.4 * k);
            ctx.stroke();
        }
        ctx.restore();
    }
}


// ══════════════════════════════════════════════════════════════
// BossFirePhoenix – Feuer-Phönix (Welt 8)
// Feuervogel mit Flammengefieder, Flammenschweif, Flammenkrone und Glut-Aura.
// Feuerbälle: vor dem Schnabel wächst ein Feuerball, Ziellinien zeigen die drei Flugbahnen.
// Feuerring: der Körper lodert auf, ein Warnring mit Pfeilen zeigt die Flugrichtungen.
// Phase 2 (halbe HP): heißere, hellere Flammen, größere Aura, doppelte Angriffe.
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
        this.flying = true;
        this.fxColor = '#ff7a1a';

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.stunnedTimer = 0;
        this.attackCycle = 0;

        this.attackTimer = 3;
        this.attackCooldown = 3;

        this.emberAcc = 0;         // Glut aus dem Schweif: Partikel pro Zeit statt Zufall pro Bild (G-17)
        this.aimX = 0;             // Ziel der Feuerbälle, bei der Ankündigung festgelegt
        this.aimY = 0;
        this.look = { x: 0, y: 1 };

        // Glutfunken um den Körper (Werte fest, Bewegung über Art.time)
        this.embers = [];
        for (let i = 0; i < 10; i++) {
            this.embers.push({
                ox: randRange(-52, 52),
                oy: randRange(-30, 40),
                phase: Math.random() * Math.PI * 2,
                speed: randRange(0.4, 0.9),
                size: randRange(3, 5.5),
            });
        }
    }

    // Glut aus dem Schweif (Partikel mit gemeinsamer Obergrenze)
    _emitEmber(mcx, mcy) {
        if (typeof Game === 'undefined' || !Game.particles || typeof Particle === 'undefined') return;
        const r = Math.random();
        const color = r < 0.4 ? '#ffd23f' : (r < 0.8 ? '#ff8a1f' : '#ff4a1f');
        const p = new Particle(mcx + randRange(-14, 14), mcy + randRange(30, 50),
            randRange(-25, 25), randRange(10, 45), color, randRange(0.4, 0.8));
        p.radius = randRange(1.6, 3.2);
        p.drag = 2;
        p.gravity = -70;
        Game.particles.push(p);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        if (this.hp <= 35 && this.phase === 1) {
            this.phase = 2;
            this.attackCooldown = 2;
            this.speed = 50;
        }

        const pcx = player.x + player.w / 2;
        const pcy = player.y + player.h / 2;
        const mcx = this.centerX();
        const mcy = this.centerY();
        const dx = pcx - mcx;
        const dy = pcy - mcy;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;

        // Glut aus dem Schweif: zeitbasiert (G-17)
        this.emberAcc += dt * (this.phase === 2 ? 22 : 14);
        while (this.emberAcc >= 1) {
            this.emberAcc -= 1;
            this._emitEmber(mcx, mcy);
        }

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

        if (this.state === 'fireball') {
            this.stateTimer -= dt;
            BossMushroomGiant.overlay(this, pcx, pcy);
            if (this.stateTimer <= 0) {
                // Drei Feuerbälle: auf das gemerkte Ziel und je 50 daneben; Phase 2 doppelt
                if (projectiles) {
                    const multiplier = this.phase === 2 ? 2 : 1;
                    for (let m = 0; m < multiplier; m++) {
                        for (let i = -1; i <= 1; i++) {
                            const a = Math.atan2(this.aimY - mcy, this.aimX + i * 50 - mcx);
                            const speed = 180 + m * 30;
                            projectiles.push(new Projectile(mcx, mcy, Math.cos(a) * speed, Math.sin(a) * speed, 2, 'enemy', 120));
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
            BossMushroomGiant.overlay(this, pcx, pcy);
            if (this.stateTimer <= 0) {
                // Feuerring nach außen; Phase 2 ein zweiter, versetzter Ring
                if (projectiles) {
                    const count = 12;
                    const multiplier = this.phase === 2 ? 2 : 1;
                    for (let m = 0; m < multiplier; m++) {
                        for (let i = 0; i < count; i++) {
                            const a = (Math.PI * 2 * i) / count + m * (Math.PI / count);
                            const speed = 160 + m * 40;
                            projectiles.push(new Projectile(mcx, mcy, Math.cos(a) * speed, Math.sin(a) * speed, 1, 'enemy', 80));
                        }
                    }
                }
                if (typeof Game !== 'undefined' && Game.camera) Game.camera.shake(3, 0.2);
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }

        // Fliegen: kreist um Mark und nähert sich
        const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
        if (dist > 160) {
            this.x += this.look.x * this.speed * dt;
            this.y += this.look.y * this.speed * dt;
        } else if (dist < 100) {
            this.x -= this.look.x * this.speed * 0.4 * dt;
            this.y -= this.look.y * this.speed * 0.4 * dt;
        }
        this.x += Math.cos(orbitAngle) * this.speed * 0.5 * dt;
        this.y += Math.sin(orbitAngle) * this.speed * 0.5 * dt;

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.attackCooldown;
            this.attackCycle++;
            if (this.attackCycle % 2 === 1) {
                this.state = 'fireball';
                this.stateTimer = 0.7;
                this.aimX = pcx;
                this.aimY = pcy;
            } else {
                this.state = 'fire_wave';
                this.stateTimer = 0.9;
            }
        }
    }

    // Flammenflügel als Pfad (rechte Seite, Schulter im Ursprung); f = Flackern je Spitze
    _wingPath(c, f0, f1, f2, f3, f4) {
        c.moveTo(0, -8);
        c.quadraticCurveTo(6, -28, 24 + f0, -44 + f0);
        c.quadraticCurveTo(26, -31, 33, -28);
        c.quadraticCurveTo(38, -40, 46 + f1, -40 + f1 * 0.5);
        c.quadraticCurveTo(43, -27, 49, -21);
        c.quadraticCurveTo(57, -26, 62 + f2, -22);
        c.quadraticCurveTo(54, -14, 56, -9);
        c.quadraticCurveTo(64, -8, 67 + f3, -3);
        c.quadraticCurveTo(57, 0, 54, 5);
        c.quadraticCurveTo(58, 9, 59 + f4, 13);
        c.quadraticCurveTo(40, 13, 22, 12);
        c.quadraticCurveTo(10, 12, 0, 8);
        c.closePath();
    }

    // Ein Flügel aus drei Flammenschichten (s = Seite)
    _wing(ctx, s, lift, flare, hot) {
        const t = Art.time;
        ctx.save();
        ctx.translate(12 * s, -6);
        ctx.scale(s * 0.8 * flare, 0.8 * flare);
        ctx.rotate(-lift);
        const w = i => Math.sin(t * 11 + i * 1.7 + s) * 2.5;
        Art.shape(ctx, c => this._wingPath(c, w(0), w(1), w(2), w(3), w(4)),
            { x: 0, y: -44, w: 67, h: 57 }, hot ? '#ff5a1f' : '#ff3d1f', { lineWidth: 2.2 });
        ctx.scale(0.72, 0.72);
        Art.shape(ctx, c => this._wingPath(c, w(2), w(3), w(4), w(0), w(1)),
            { x: 0, y: -44, w: 67, h: 57 }, hot ? '#ffb21f' : '#ff8c1a', { outline: false, flat: true });
        // innerste Glut als einfache Flamme
        const f = w(3);
        ctx.fillStyle = hot ? '#fff6b8' : '#ffd84a';
        ctx.beginPath();
        ctx.moveTo(2, 4);
        ctx.quadraticCurveTo(10, -22, 30 + f, -30 + f);
        ctx.quadraticCurveTo(26, -8, 40, -4);
        ctx.quadraticCurveTo(22, 8, 2, 4);
        ctx.fill();
        ctx.restore();
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const dead = this.dead;
        const hot = this.phase === 2 || this.hp <= this.maxHp / 2;
        const stunned = !dead && this.state === 'stunned';
        const ballK = !dead && this.state === 'fireball' ? clamp(1 - this.stateTimer / 0.7, 0, 1) : 0;
        const waveK = !dead && this.state === 'fire_wave' ? clamp(1 - this.stateTimer / 0.9, 0, 1) : 0;
        let k = 1;
        let bob = Math.sin(t * 2.4) * 4;
        if (dead) {
            // Besiegt: erstarrt, dann schnell zusammenschrumpfen
            const d = this.deathProgress();
            k = d < 0.2 ? 1 + d * 0.5 : Math.max(0.01, 1.1 * (1 - (d - 0.2) / 0.8));
            bob = 0;
            ctx.globalAlpha *= Math.min(1, 2.5 - d * 2.5);
        }
        // Flügel: Schlag, vor den Angriffen erhoben, betäubt hängend
        let lift = Math.sin(t * 5) * 0.22;
        if (stunned || dead) lift = -0.3 + Math.sin(t * 1.5) * 0.05;
        else if (ballK > 0) lift = 0.25 + ballK * 0.2;
        else if (waveK > 0) lift = 0.35 + Math.sin(t * 30) * 0.05;
        const flare = 1 + waveK * 0.14;
        const fl = stunned || dead ? 0.6 : 1;     // Flammen kleiner, wenn betäubt
        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.scale(k, k);

        // Glut-Aura
        if (!dead) {
            Art.glow(ctx, 0, 0, 88 + waveK * 30, '#ff5a1a', (hot ? 0.5 : 0.36) + Math.sin(t * 6) * 0.06 + waveK * 0.3);
            if (hot) Art.glow(ctx, 0, -4, 56, '#ffd23f', 0.28);
        }

        // Flammenschweif
        Art.shape(ctx, c => {
            for (let i = -1; i <= 1; i++) {
                const sway = Math.sin(t * 5 + i * 1.3) * 5;
                const len = (34 + (i === 0 ? 8 : 0) + Math.sin(t * 9 + i) * 3) * fl;
                c.moveTo(i * 8 - 7, 20);
                c.quadraticCurveTo(i * 12 - 9 + sway * 0.5, 20 + len * 0.55, i * 17 + sway, 20 + len);
                c.quadraticCurveTo(i * 12 + 9 + sway * 0.5, 20 + len * 0.55, i * 8 + 7, 20);
            }
        }, { x: -28, y: 18, w: 56, h: 46 }, hot ? '#ff5a1f' : '#ff3d1f', { lineWidth: 1.8 });
        ctx.fillStyle = hot ? '#fff6b8' : '#ffd84a';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            const sway = Math.sin(t * 5 + i * 1.3) * 5;
            const len = (22 + (i === 0 ? 6 : 0) + Math.sin(t * 11 + i) * 2) * fl;
            ctx.moveTo(i * 8 - 3.5, 22);
            ctx.quadraticCurveTo(i * 10 - 4 + sway * 0.4, 22 + len * 0.55, i * 13 + sway * 0.8, 22 + len);
            ctx.quadraticCurveTo(i * 10 + 4 + sway * 0.4, 22 + len * 0.55, i * 8 + 3.5, 22);
        }
        ctx.fill();

        // Flügel
        this._wing(ctx, -1, lift, flare * (0.85 + 0.15 * fl), hot);
        this._wing(ctx, 1, lift, flare * (0.85 + 0.15 * fl), hot);

        // Körper mit goldener Brustflamme
        Art.body(ctx, 0, 4, 19, 25, '#ff8a1f', { lineWidth: 2.2 });
        Art.shape(ctx, c => {
            c.moveTo(0, -6);
            c.quadraticCurveTo(11, 8, 0, 22);
            c.quadraticCurveTo(-11, 8, 0, -6);
            c.closePath();
        }, { x: -8, y: -6, w: 16, h: 28 }, hot ? '#fff3a0' : '#ffd23f', { outline: false, highlight: false });

        // Flammenkrone
        const cr = i => Math.sin(t * 13 + i * 2) * 2 * fl;
        Art.shape(ctx, c => {
            c.moveTo(-9, -32);
            c.quadraticCurveTo(-14, -36 - 6 * fl, -12 + cr(0), -32 - 20 * fl);
            c.quadraticCurveTo(-6, -36 - 8 * fl, -4, -36);
            c.quadraticCurveTo(-4, -36 - 12 * fl, 1 + cr(1), -32 - 26 * fl);
            c.quadraticCurveTo(5, -36 - 10 * fl, 4, -36);
            c.quadraticCurveTo(8, -36 - 8 * fl, 13 + cr(2), -32 - 18 * fl);
            c.quadraticCurveTo(13, -36 - 4 * fl, 9, -32);
            c.closePath();
        }, { x: -14, y: -58, w: 28, h: 26 }, hot ? '#ff5a1f' : '#ff3d1f', { lineWidth: 1.8 });

        // Kopf, Augen, Schnabel
        Art.body(ctx, 0, -24, 14, 13, '#ff9a24', { lineWidth: 2.2 });
        if (dead) BossMushroomGiant.xEyes(ctx, 0, -26, 4.2, 6.2);
        else if (stunned) BossMushroomGiant.spiralEyes(ctx, 0, -26, 4.6, 6.2);
        else Art.eyes(ctx, 0, -25.5, 4.8, { gap: 6.2, look: this.look, angry: true, iris: hot ? '#fff3a0' : '#ffd23f', seed: 5.5 });
        Art.shape(ctx, c => {
            c.moveTo(-4.5, -19.5);
            c.quadraticCurveTo(0, -21, 4.5, -19.5);
            c.quadraticCurveTo(2, -14, 0, -11);
            c.quadraticCurveTo(-2, -14, -4.5, -19.5);
            c.closePath();
        }, { x: -5, y: -21, w: 10, h: 10 }, '#ffe08a', { lineWidth: 1.4 });

        // Feuerball wächst vor dem Schnabel (Ankündigung)
        if (ballK > 0) {
            const bx = this.look.x * 26;
            const by = -14 + this.look.y * 20;
            Art.glow(ctx, bx, by, 14 + ballK * 18, '#ff8a1f', 0.6 + ballK * 0.4);
            Art.body(ctx, bx, by, 2.5 + ballK * 6, 2.5 + ballK * 6, '#ffe066', { outline: '#ff5a1f', lineWidth: 1.6 });
            Art.glow(ctx, bx, by, 4 + ballK * 5, '#ffffff', 0.9);
        }
        ctx.restore();

        // Glutfunken steigen um den Phönix auf
        if (!dead) {
            for (const em of this.embers) {
                const ph = (t * em.speed * 0.5 + em.phase) % 1;
                const ex = cx + em.ox + Math.sin(t * em.speed * 3 + em.phase) * 6;
                const ey = cy + em.oy - ph * 30;
                Art.glow(ctx, ex, ey, em.size * 1.6, ph < 0.5 ? '#ffd23f' : '#ff8a1f', Math.sin(ph * Math.PI) * 0.9);
            }
        }
        if (stunned) BossMushroomGiant.dizzy(ctx, cx, cy + bob - 62, 30, '#ffd23f');
    }

    // Ziellinien und Warnring (über allen Figuren, siehe BossMushroomGiant.overlay)
    _drawOverlay(ctx, camera) {
        if (this.dead) return;
        const t = Art.time;
        const mcx = this.centerX();
        const mcy = this.centerY();
        const c = camera.worldToScreen(mcx, mcy);
        ctx.save();
        const A = ctx.globalAlpha;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (this.state === 'fireball') {
            const k = clamp(1 - this.stateTimer / 0.7, 0, 1);
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                const a = Math.atan2(this.aimY - mcy, this.aimX + i * 50 - mcx);
                ctx.moveTo(c.x + Math.cos(a) * 40, c.y + Math.sin(a) * 40);
                ctx.lineTo(c.x + Math.cos(a) * 320, c.y + Math.sin(a) * 320);
            }
            ctx.setLineDash([10, 9]);
            ctx.lineDashOffset = -t * 60;
            ctx.strokeStyle = '#ff5a1f';
            ctx.lineWidth = 5;
            ctx.globalAlpha = A * (0.25 + 0.35 * k);
            ctx.stroke();
            ctx.strokeStyle = '#ffe066';
            ctx.lineWidth = 2;
            ctx.globalAlpha = A * (0.45 + 0.5 * k);
            ctx.stroke();
            ctx.setLineDash([]);
            // Zielkreuz am gemerkten Ziel
            const p = camera.worldToScreen(this.aimX, this.aimY);
            const r = 15 - k * 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, TAU);
            ctx.moveTo(p.x - r - 6, p.y); ctx.lineTo(p.x - r + 4, p.y);
            ctx.moveTo(p.x + r + 6, p.y); ctx.lineTo(p.x + r - 4, p.y);
            ctx.moveTo(p.x, p.y - r - 6); ctx.lineTo(p.x, p.y - r + 4);
            ctx.moveTo(p.x, p.y + r + 6); ctx.lineTo(p.x, p.y + r - 4);
            ctx.strokeStyle = '#ff3d1f';
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = A * (0.6 + 0.4 * k);
            ctx.stroke();
        }

        if (this.state === 'fire_wave') {
            // Warnring mit Pfeilen genau in Flugrichtung der Feuerkugeln
            const k = clamp(1 - this.stateTimer / 0.9, 0, 1);
            const n = this.phase === 2 ? 24 : 12;
            const r = 62 + k * 12;
            ctx.setLineDash([7, 7]);
            ctx.lineDashOffset = t * 40;
            ctx.beginPath();
            ctx.arc(c.x, c.y, r, 0, TAU);
            ctx.strokeStyle = '#ff5a1f';
            ctx.lineWidth = 3;
            ctx.globalAlpha = A * (0.35 + 0.5 * k);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const a = n === 24 ? (Math.PI * 2 * (i >> 1)) / 12 + (i & 1) * (Math.PI / 12) : (Math.PI * 2 * i) / 12;
                const ca = Math.cos(a);
                const sa = Math.sin(a);
                const tip = r + 12 + k * 8;
                const bx = c.x + ca * tip;
                const by = c.y + sa * tip;
                ctx.moveTo(bx - ca * 7 - sa * 5, by - sa * 7 + ca * 5);
                ctx.lineTo(bx, by);
                ctx.lineTo(bx - ca * 7 + sa * 5, by - sa * 7 - ca * 5);
            }
            ctx.strokeStyle = '#ffe066';
            ctx.lineWidth = 3;
            ctx.globalAlpha = A * (0.45 + 0.5 * k);
            ctx.stroke();
        }
        ctx.restore();
    }
}


// ══════════════════════════════════════════
// ── Welten 9–15: gemeinsame Helfer ──
// ══════════════════════════════════════════

// Werkzeuge für die Gegner der Welten 9–15: Schaden mit Rückmeldung, faire Warnungen, Pixel-Bilder.
const Kit915 = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine direkt.
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

    // Gegner-Geschoss. color und shape ('arrow', 'boomerang', 'fruit', 'seed', 'pixel', 'orb', 'poison')
    // sind Hinweise für die Geschoss-Zeichnung.
    shoot(x, y, vx, vy, damage, knockback, color, shape) {
        if (typeof Game === 'undefined' || !Game.projectiles) return null;
        const p = new Projectile(x, y, vx, vy, damage, 'enemy', knockback);
        if (color) p.color = color;
        if (shape) p.shape = shape;
        Game.projectiles.push(p);
        return p;
    },

    free(world, x, y, w, h) {
        return !world || !world.collideRect || world.collideRect({ x, y, w, h }).length === 0;
    },

    // Minion rufen: höchstens max eigene gleichzeitig (G-09) und nie in eine Wand (G-08).
    summon(boss, K, enemies, world, angle, dist, max) {
        boss.minions = (boss.minions || []).filter(m => !m.dead);
        if (!enemies || boss.minions.length >= max) return null;
        const cx = boss.centerX();
        const cy = boss.centerY();
        const m = new K(cx, cy);
        for (const d of [dist, dist * 0.6, dist * 0.3, 0]) {
            const x = cx + Math.cos(angle) * d - m.w / 2;
            const y = cy + Math.sin(angle) * d - m.h / 2;
            if (m.phasesThroughWalls || d === 0 || this.free(world, x, y, m.w, m.h)) {
                m.x = x;
                m.y = y;
                break;
            }
        }
        boss.minions.push(m);
        enemies.push(m);
        const col = boss.fxColor || '#ffffff';
        this.burst(m.centerX(), m.centerY(), [col, '#ffffff'], 8, 80, 0.4, { kind: 'star' });
        this.ring(m.centerX(), m.centerY(), col, 24, 0.35, 2.5);
        return m;
    },

    // Ansturm-Schritt mit Wandkollision (G-03). true = gegen die Wand gerannt.
    rush(e, dx, dy, world) {
        const bx = e.x;
        const by = e.y;
        e._moveWithCollision(dx, dy, world);
        // Bündig an der Wand kann die Kollision einen Schritt „durchrutschen“ – dann zurück und stoppen
        if (world && world.collideRect && world.collideRect(e.rect()).length) {
            e.x = bx;
            e.y = by;
            return true;
        }
        const len = Math.hypot(dx, dy);
        if (len < 0.5) return false;
        const hitX = Math.abs(dx) > len * 0.35 && Math.abs(e.x - bx) < Math.abs(dx) * 0.5;
        const hitY = Math.abs(dy) > len * 0.35 && Math.abs(e.y - by) < Math.abs(dy) * 0.5;
        return hitX || hitY;
    },

    // Wie weit kommt ein Ansturm bis zur Wand? (Länge der Warnbahn)
    laneLength(e, dirX, dirY, world, max) {
        if (!world || !world.collideRect) return max;
        for (let d = 8; d <= max; d += 8) {
            if (!this.free(world, e.x + dirX * d, e.y + dirY * d, e.w, e.h)) return d - 8;
        }
        return max;
    },

    // Tod: kurz aufblähen, dann zusammenschnurren (t = 0..1).
    pop(t) {
        return t < 0.25 ? 1 + t * 0.7 : Math.max(0, 1.175 * (1 - (t - 0.25) / 0.75));
    },

    scaleAt(ctx, x, y, sx, sy) {
        ctx.translate(x, y);
        ctx.scale(sx, sy);
        ctx.translate(-x, -y);
    },

    // Zeichnet body() als kurze, knackige Todesanimation (G-23).
    drawDying(ctx, x, y, t, body) {
        const s = this.pop(t);
        if (s <= 0.02) return;
        const prev = ctx.globalAlpha;
        ctx.save();
        ctx.globalAlpha = prev * clamp((1 - t) * 2.2, 0, 1);
        this.scaleAt(ctx, x, y, s, s);
        body();
        ctx.restore();
    },

    // Pixel-Tod: Quadrate fliegen auseinander.
    pixelShatter(ctx, cx, cy, cell, t, colors, seed) {
        if (t >= 1) return;
        const prev = ctx.globalAlpha;
        if (t < 0.35) Art.glow(ctx, cx, cy, 22 * (1 - t * 2), colors[0], 0.7);
        ctx.globalAlpha = prev * (1 - t * t);
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * TAU + seed;
            const d = 3 + t * (18 + (i % 3) * 8);
            const s = cell * (i % 4 === 0 ? 2 : 1.3) * (1 - t * 0.5);
            const x = Math.round((cx + Math.cos(a) * d) / cell) * cell;
            const y = Math.round((cy + Math.sin(a) * d - t * 6) / cell) * cell;
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
        ctx.globalAlpha = prev;
    },

    // Betäubt: Sterne kreisen über dem Kopf.
    dizzy(ctx, x, y, rx, n = 3, size = 4.5) {
        const t = Art.time * 3.2;
        for (let i = 0; i < n; i++) {
            const a = t + (i * TAU) / n;
            Art.star(ctx, x + Math.cos(a) * rx, y + Math.sin(a) * rx * 0.3, size, '#ffd23f', { lineWidth: 1.2, rot: a });
        }
    },

    // Warnkreis am Boden. k = 0..1: je voller, desto näher der Angriff.
    warnCircle(ctx, x, y, r, k, color = '#ff3d5a') {
        const prev = ctx.globalAlpha;
        const pulse = 0.5 + 0.5 * Math.sin(Art.time * (10 + k * 16));
        ctx.fillStyle = color;
        ctx.globalAlpha = prev * (0.1 + 0.1 * k);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev * (0.16 + 0.18 * k);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, r * k), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev * (0.45 + 0.5 * pulse);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = prev;
    },

    // Warnbahn am Boden für einen Ansturm; Pfeile laufen in Stoßrichtung.
    warnLane(ctx, x, y, angle, len, width, k, color = '#ff3d5a') {
        const prev = ctx.globalAlpha;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.globalAlpha = prev * (0.12 + 0.14 * k);
        ctx.beginPath();
        ctx.roundRect(-width * 0.3, -width / 2, Math.max(width, len + width * 0.3), width, width / 2);
        ctx.fill();
        ctx.globalAlpha = prev * (0.4 + 0.5 * k);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const s = Math.min(width * 0.3, 10);
        ctx.beginPath();
        for (let d = (Art.time * 70) % 24 + width * 0.2; d < len - s; d += 24) {
            ctx.moveTo(d, -s);
            ctx.lineTo(d + s * 0.9, 0);
            ctx.lineTo(d, s);
        }
        ctx.stroke();
        ctx.restore();
    },

    // Kreis bzw. Ellipse als eigener Teilpfad – mehrere davon in einem Pfad ohne Verbindungslinien.
    dot(ctx, x, y, r) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
    },

    oval(ctx, x, y, rx, ry, rot = 0) {
        ctx.moveTo(x + Math.cos(rot) * rx, y + Math.sin(rot) * rx);
        ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    },

    // Blatt von (x, y) in Richtung angle.
    leaf(ctx, x, y, len, angle, color, width = 0.42) {
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const w = len * width;
        const tx = x + ca * len;
        const ty = y + sa * len;
        const mx = x + ca * len * 0.5;
        const my = y + sa * len * 0.5;
        Art.shape(ctx, c => {
            c.moveTo(x, y);
            c.quadraticCurveTo(mx - sa * w, my + ca * w, tx, ty);
            c.quadraticCurveTo(mx + sa * w, my - ca * w, x, y);
            c.closePath();
        }, { x: Math.min(x, tx) - w / 2, y: Math.min(y, ty) - w / 2, w: Math.abs(tx - x) + w, h: Math.abs(ty - y) + w }, color, { lineWidth: 1.2 });
        if (len < 10) return; // kleine Blätter ohne Ader
        ctx.strokeStyle = Art.light(color, 0.4);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + ca * len * 0.12, y + sa * len * 0.12);
        ctx.lineTo(x + ca * len * 0.78, y + sa * len * 0.78);
        ctx.stroke();
    },

    // Pixel-Bild aus Textzeilen (einmal bauen, dann nur noch füllen). '.' = leer.
    // Ebenen: Umriss 'O' (Rand um alle Pixel), Grundfarbe base, danach jede weitere Farbe.
    pixelSprite(rows, base) {
        const h = rows.length;
        const w = Math.max(...rows.map(r => r.length));
        const at = (x, y) => (y >= 0 && y < h && x >= 0 && x < rows[y].length ? rows[y][x] : '.');
        const on = (x, y) => at(x, y) !== '.';
        const layer = (key, test) => {
            const path = new Path2D();
            for (let y = -1; y <= h; y++) {
                let x0 = null;
                for (let x = -1; x <= w + 1; x++) {
                    const hit = x <= w && test(x, y);
                    if (hit && x0 === null) x0 = x;
                    else if (!hit && x0 !== null) {
                        path.rect(x0, y, x - x0, 1);
                        x0 = null;
                    }
                }
            }
            return { key, path };
        };
        const layers = [
            layer('O', (x, y) => on(x, y) || on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)),
            layer(base, on),
        ];
        const keys = new Set(rows.join('').replace(/\./g, '').split(''));
        keys.delete(base);
        for (const key of keys) layers.push(layer(key, (x, y) => at(x, y) === key));
        return { w, h, layers };
    },

    fillSprite(ctx, spr, pal) {
        for (const l of spr.layers) {
            ctx.fillStyle = pal[l.key] || '#ff00ff';
            ctx.fill(l.path);
        }
    },
};

// ══════════════════════════════════════════
// ── Welt 11: Pixel-Welt ──
// ══════════════════════════════════════════

// Pixel-Geist: knalliger 8-Bit-Geist mit echten Pixelkanten und wackelndem Rocksaum.
class PixelGhost extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 20);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 55;
        this.damage = 1;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.detectionRange = 180;
        this.chasing = false;
        this.look = { x: 0, y: 0 };
        this.seed = Math.random() * 10;
        this.pal = PixelGhost.PALETTES[randInt(0, PixelGhost.PALETTES.length - 1)];
        this.fxColor = this.pal.X;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.chasing = dist < this.detectionRange;
        if (this.chasing) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }

    static sprites() {
        if (!PixelGhost._spr) {
            const top = [
                '....LLXX....',
                '..LLXXXXXX..',
                '.LWXXXXXXXD.',
                '.LXXXXXXXXD.',
                'LXXXXXXXXXXD',
                'LXXXXXXXXXXD',
                'XXXXXXXXXXXD',
                'XXXXXXXXXXXD',
                'XXXXXXXXXXXD',
                'XXXXXXXXXXXD',
                'XXXXXXXXXXDD',
            ];
            PixelGhost._spr = [
                Kit915.pixelSprite(top.concat(['XX.XXXXXX.XD', 'X...XXXX...D']), 'X'),
                Kit915.pixelSprite(top.concat(['XXXXX..XXXXD', '.XXX....XXD.']), 'X'),
            ];
        }
        return PixelGhost._spr;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const C = 1.8; // ein Pixel in Welt-Einheiten
        if (this.dead) {
            Kit915.pixelShatter(ctx, cx, cy, C, this.deathProgress(), [this.pal.X, this.pal.L, '#ffffff'], this.seed);
            return;
        }
        const t = Art.time + this.seed;
        const spr = PixelGhost.sprites()[Math.floor(t * 4) % 2];
        const bob = Math.round(Math.sin(t * 3)) * C;
        Art.glow(ctx, cx, cy + bob, 22, this.pal.X, 0.45);
        ctx.save();
        ctx.translate(cx - (spr.w * C) / 2, cy - (spr.h * C) / 2 - 1 + bob);
        ctx.scale(C, C);
        // Glitch: alle paar Sekunden kurz farbige Doppelbilder
        if ((t * 0.37) % 1 < 0.05) {
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.6;
            ctx.fillStyle = '#ff3bd4';
            ctx.translate(-1, 0);
            ctx.fill(spr.layers[0].path);
            ctx.fillStyle = '#2ff3ff';
            ctx.translate(2, 0);
            ctx.fill(spr.layers[0].path);
            ctx.translate(-1, 0);
            ctx.globalAlpha = prev;
        }
        Kit915.fillSprite(ctx, spr, this.pal);
        // Augen blicken in ganzen Pixeln zu Mark
        const lx = this.look.x < -0.4 ? -1 : (this.look.x > 0.4 ? 1 : 0);
        const ly = this.look.y > 0.5 ? 1 : 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(2 + lx, 3 + ly, 3, 4);
        ctx.fillRect(7 + lx, 3 + ly, 3, 4);
        ctx.fillStyle = this.pal.P;
        const px = this.look.x < 0 ? 0 : 1;
        const py = this.look.y < -0.4 ? 0 : (this.look.y > 0.4 ? 2 : 1);
        ctx.fillRect(2 + lx + px, 3 + ly + py, 2, 2);
        ctx.fillRect(7 + lx + px, 3 + ly + py, 2, 2);
        // Mund: frech grinsend beim Jagen, sonst Lächeln
        ctx.fillStyle = this.pal.M;
        if (this.chasing) {
            ctx.fillRect(4, 8, 4, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(4, 8, 1, 1);
            ctx.fillRect(7, 8, 1, 1);
        } else {
            ctx.fillRect(4, 8, 1, 1);
            ctx.fillRect(7, 8, 1, 1);
            ctx.fillRect(5, 9, 2, 1);
        }
        ctx.restore();
    }
}
PixelGhost.PALETTES = [
    { O: '#1a0b33', X: '#ff3b6b', L: '#ff9ab3', D: '#c21d4f', W: '#ffffff', P: '#1f1a6e', M: '#3a0a2a' },
    { O: '#1a0b33', X: '#ff6fe0', L: '#ffbdf2', D: '#c93fb0', W: '#ffffff', P: '#1f1a6e', M: '#3a0a2a' },
    { O: '#0b1640', X: '#27d9ff', L: '#a3f1ff', D: '#1497c9', W: '#ffffff', P: '#1f1a6e', M: '#0b1640' },
    { O: '#2a1208', X: '#ffae2b', L: '#ffd98f', D: '#d9781a', W: '#ffffff', P: '#1f1a6e', M: '#3a1608' },
    { O: '#0b2a14', X: '#6bff5a', L: '#c4ffb9', D: '#2fc23a', W: '#ffffff', P: '#1f1a6e', M: '#0b2a14' },
];

// Pixel-Roboter (Schlüsselträger): kantiger 8-Bit-Roboter mit Blaster und goldenem Schlüssel.
class PixelRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 30);
        this.hp = 12;
        this.maxHp = 12;
        this.speed = 40;
        this.damage = 2;
        this.detectionRange = 200;
        this.shootTimer = 0.6; // auch der erste Schuss kommt mit Vorwarnung
        this.shootCooldown = 1.5;
        this.isKeyGhost = true;
        this.droppedKey = false;
        this.fxColor = '#35d6ff';
        this.seed = Math.random() * 10;
        this.look = { x: 1, y: 0 };
        this.face = 1;
        this.moving = false;
        this.active = false;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.active = dist < this.detectionRange;
        this.moving = false;
        if (!this.active) {
            this.shootTimer = Math.max(this.shootTimer, 0.45); // nie ohne Vorwarnung schießen
            return;
        }
        if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        this._moveWithCollision((dx / dist) * this.speed * dt, (dy / dist) * this.speed * dt, world);
        this.moving = true;
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            Kit915.shoot(mx + this.face * 12, my + 2, (dx / dist) * 160, (dy / dist) * 160, 1, 70, '#ff4fd8', 'pixel');
        }
    }

    static sprites() {
        if (!PixelRobot._spr) {
            const top = [
                '......GG.......',
                '......GG.......',
                '......KK.......',
                '..LLLLXXXXXX...',
                '..LVVVVVVVVD...',
                '..XVVVVVVVVD...',
                '..XVVVVVVVVD...',
                '..XXXXXXXXXD...',
                '...DDDDDDDD....',
                '.....KKKK......',
                '.LLLXXXXXXXD...',
                'LXXXCCCCCCXDBBB',
                'LXXXCCCCCCXDBBB',
                'XX.XXXXXXXXD.B.',
                '...XXXXXXXXD...',
            ];
            PixelRobot._spr = [
                Kit915.pixelSprite(top.concat(['...KKK..KKK....', '..KKKK..KKKK...']), 'X'),
                Kit915.pixelSprite(top.concat(['....KK..KK.....', '...KKK..KKK....']), 'X'),
            ];
            PixelRobot._key = Kit915.pixelSprite(['GGG.....', 'GLGGGGGG', 'GGG..G.G'], 'G');
        }
        return PixelRobot._spr;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const C = 2;
        const P = PixelRobot.PAL;
        if (this.dead) {
            Kit915.pixelShatter(ctx, cx, cy, C, this.deathProgress(), [P.X, P.C, P.B, P.G], this.seed);
            return;
        }
        const t = Art.time + this.seed;
        const walk = this.moving ? Math.floor(t * 6) % 2 : 0;
        const spr = PixelRobot.sprites()[walk];
        const w = spr.w * C;
        const h = spr.h * C;
        const ox = cx - w / 2;
        const oy = cy + this.h / 2 - h + (walk ? -C : 0); // Füße auf der Hitbox-Unterkante
        const flip = this.face < 0;
        const charge = this.active ? clamp(1 - this.shootTimer / 0.45, 0, 1) : 0;
        Art.glow(ctx, cx, cy, 30, '#ffd23f', 0.2 + 0.08 * Math.sin(t * 3));
        ctx.save();
        ctx.translate(flip ? ox + w : ox, oy);
        ctx.scale(flip ? -C : C, C);
        Kit915.fillSprite(ctx, spr, P);
        // LED-Augen im Visier (blicken in Laufrichtung)
        const ex = this.look.x * this.face > 0.3 ? 1 : 0;
        const ey = this.look.y > 0.45 ? 1 : 0;
        ctx.fillStyle = charge > 0.5 ? '#fff4b0' : '#ff3b5c';
        ctx.fillRect(4 + ex, 4 + ey, 2, 2);
        ctx.fillRect(8 + ex, 4 + ey, 2, 2);
        // Brust-Lämpchen blinken der Reihe nach
        const on = Math.floor(t * 5) % 3;
        const lamps = ['#ff4fd8', '#ffd23f', '#6bff5a'];
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i === on ? lamps[i] : '#1f7f9a';
            ctx.fillRect(5 + i * 2, 12, 1, 1);
        }
        ctx.restore();
        // Blaster lädt: Mündung leuchtet auf
        if (charge > 0) {
            const mx = flip ? ox + w - 15 * C : ox + 15 * C;
            const my = oy + 12 * C;
            Art.glow(ctx, mx, my, 8 + charge * 10, '#ff4fd8', 0.4 + charge * 0.5);
            ctx.fillStyle = '#ffffff';
            const s = C * (0.6 + charge);
            ctx.fillRect(mx - s / 2, my - s / 2, s, s);
        }
        // Goldener Schlüssel über dem Kopf (Schlüsselträger)
        const key = PixelRobot._key;
        const kc = 1.4;
        const ky = oy - 9 + Math.round(Math.sin(t * 3)) * kc;
        Art.glow(ctx, cx, ky + 2, 12, '#ffd23f', 0.5);
        ctx.save();
        ctx.translate(cx - (key.w * kc) / 2, ky);
        ctx.scale(kc, kc);
        Kit915.fillSprite(ctx, key, P);
        ctx.restore();
    }
}
PixelRobot.PAL = {
    O: '#0d0b2e', X: '#35d6ff', L: '#b5f3ff', D: '#1d8fd0', V: '#16123a',
    C: '#2ff3ff', B: '#ff4fd8', G: '#ffd23f', K: '#3b3f86', W: '#ffffff',
};

// ══════════════════════════════════════════
// ── Welt 12: Sternen-Galaxie ──
// ══════════════════════════════════════════

// Sternen-Ritter: kleiner Weltraum-Ritter mit Leuchtschwert. Holt sichtbar aus, bevor er zuschlägt (G-20).
class StarKnight extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 28);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 50;
        this.damage = 2;
        this.detectionRange = 180;
        this.slashTimer = 0;
        this.slashCooldown = 1.2;
        this.windup = 0;
        this.slashing = false;
        this.slashT = 0;
        this.facingA = 0;
        this.moving = false;
        this.seed = Math.random() * 10;
        this.armor = StarKnight.ARMOR[randInt(0, StarKnight.ARMOR.length - 1)];
        this.fxColor = '#ffd23f';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const mx = this.centerX();
        const my = this.centerY();
        const dist = Math.hypot(px - mx, py - my);
        this.moving = false;
        if (this.slashing) {
            this.slashT -= dt;
            if (this.slashT <= 0) this.slashing = false;
            return;
        }
        // Erst ausholen (Warnfächer am Boden), dann der Hieb – wer rechtzeitig ausweicht, bleibt heil
        if (this.windup > 0) {
            this.windup -= dt;
            if (this.windup <= 0) {
                this.slashing = true;
                this.slashT = 0.3;
                this._moveWithCollision(Math.cos(this.facingA) * 5, Math.sin(this.facingA) * 5, world);
                const c = { x: this.centerX(), y: this.centerY() };
                if (pointInArc({ x: px, y: py }, c, this.facingA, 2.2, StarKnight.REACH)) {
                    Kit915.hurt(player, this.damage, this.facingA, 150);
                }
            }
            return;
        }
        if (dist < this.detectionRange) {
            this.facingA = Math.atan2(py - my, px - mx);
            this._moveWithCollision(Math.cos(this.facingA) * this.speed * dt, Math.sin(this.facingA) * this.speed * dt, world);
            this.moving = true;
            this.slashTimer -= dt;
            if (this.slashTimer <= 0 && dist < 40) {
                this.windup = StarKnight.WINDUP;
                this.slashTimer = this.slashCooldown;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy));
            return;
        }
        if (this.windup > 0) this._drawWarning(ctx, cx, cy);
        this._drawBody(ctx, cx, cy);
    }

    // Warnfächer: genau dort trifft der Hieb.
    _drawWarning(ctx, cx, cy) {
        const k = 1 - this.windup / StarKnight.WINDUP;
        const a = this.facingA;
        const prev = ctx.globalAlpha;
        ctx.fillStyle = '#ff3d5a';
        ctx.globalAlpha = prev * (0.14 + 0.24 * k);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, StarKnight.REACH * (0.55 + 0.45 * k), a - 1.1, a + 1.1);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev * (0.55 + 0.4 * Math.sin(Art.time * 30));
        ctx.strokeStyle = '#ff3d5a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, StarKnight.REACH, a - 1.1, a + 1.1);
        ctx.stroke();
        ctx.globalAlpha = prev;
    }

    _drawBody(ctx, cx, cy) {
        const t = Art.time + this.seed;
        const A = this.armor;
        const f = Math.cos(this.facingA) < 0 ? -1 : 1;
        const step = this.moving ? Math.sin(t * 13) : 0;
        const by = cy + (this.moving ? -Math.abs(step) * 1.4 : Math.sin(t * 2.4) * 0.6);
        const wave = Math.sin(t * 5) * 1.5;
        // Umhang
        Art.shape(ctx, c => {
            c.moveTo(cx - 6, by - 5);
            c.quadraticCurveTo(cx - 12 - wave, by + 4, cx - 11 - wave * 0.5, by + 12);
            c.quadraticCurveTo(cx - 5, by + 10, cx, by + 12.5 + wave * 0.4);
            c.quadraticCurveTo(cx + 5, by + 10, cx + 11 + wave * 0.5, by + 12);
            c.quadraticCurveTo(cx + 12 + wave, by + 4, cx + 6, by - 5);
            c.closePath();
        }, { x: cx - 12, y: by - 5, w: 24, h: 18 }, A.cape);
        // Beine
        Art.limb(ctx, cx - 3.5, by + 6, cx - 3.5 - step * 2.2, cy + 12, 4.4, A.dark);
        Art.limb(ctx, cx + 3.5, by + 6, cx + 3.5 + step * 2.2, cy + 12, 4.4, A.dark);
        // Rumpf mit Sternen-Wappen
        Art.box(ctx, cx - 8, by - 5, 16, 12.5, 5, A.main);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(cx - 7.5, by + 3.6, 15, 1.8);
        Art.sparkle(ctx, cx, by + 0.2, 3.6, '#ffd23f');
        // Helm mit Glasvisier
        Art.body(ctx, cx, by - 11, 9.2, 8.6, A.main, { glossy: true });
        const lx = Math.cos(this.facingA) * 1.6;
        const ly = Math.sin(this.facingA);
        Art.body(ctx, cx + lx * 0.6, by - 10, 6.6, 4.4, '#1a1c4f', { highlight: false, lineWidth: 1.2 });
        const eye = this.windup > 0 ? '#ff5a6e' : '#7ff6ff';
        Art.glow(ctx, cx + lx, by - 10 + ly, 9, eye, 0.55);
        ctx.fillStyle = eye;
        ctx.beginPath();
        Kit915.oval(ctx, cx - 2.6 + lx, by - 10 + ly, 1.3, 1.7);
        Kit915.oval(ctx, cx + 2.6 + lx, by - 10 + ly, 1.3, 1.7);
        ctx.fill();
        Art.shine(ctx, cx - 3 + lx * 0.6, by - 12, 2.2, 0.8, -0.3, 0.5);
        // Stern auf dem Helm
        const tw = 0.85 + 0.15 * Math.sin(t * 5);
        Art.glow(ctx, cx, by - 21, 9, '#ffd23f', 0.5 * tw);
        Art.star(ctx, cx, by - 21, 3.8 * tw, '#ffd23f', { lineWidth: 1 });
        this._drawSword(ctx, cx, cy, cx + f * 8.5, by + 1, f);
    }

    _drawSword(ctx, cx, cy, hx, hy, f) {
        let a = this.facingA + f * 0.9; // Ruhe: Schwert gesenkt nach vorn
        let glow = 0.3;
        if (this.windup > 0) {
            const k = 1 - this.windup / StarKnight.WINDUP;
            a = this.facingA - f * (1.4 + 1.0 * k); // weit ausholen
            glow = 0.45 + 0.5 * k;
        } else if (this.slashing) {
            const k = Math.min(1, (1 - this.slashT / 0.3) * 1.6);
            a = this.facingA - f * 2.4 + f * 3.4 * k;
            glow = 0.7;
        }
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const tipX = hx + ca * 16;
        const tipY = hy + sa * 16;
        Art.glow(ctx, hx + ca * 10, hy + sa * 10, 14, '#6cf0ff', glow);
        Art.limb(ctx, hx + ca * 3, hy + sa * 3, tipX, tipY, 3, '#dcfdff', { outline: '#2a8fd4', lineWidth: 1.1 });
        Art.limb(ctx, hx + ca * 2.6 - sa * 3.2, hy + sa * 2.6 + ca * 3.2, hx + ca * 2.6 + sa * 3.2, hy + sa * 2.6 - ca * 3.2, 1.8, '#ffd23f', { lineWidth: 1 });
        Art.body(ctx, hx, hy, 2.8, 2.8, this.armor.dark, { highlight: false, lineWidth: 1.2 });
        if (this.windup > 0) Art.sparkle(ctx, tipX, tipY, 3 + Math.sin(Art.time * 25) * 1.2, '#ffffff');
        // Hieb-Spur
        if (this.slashing) {
            const k = 1 - this.slashT / 0.3;
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * (1 - k) * 0.9;
            ctx.strokeStyle = '#e8fdff';
            ctx.lineWidth = 6 * (1 - k) + 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx, cy, 27, this.facingA - 1.0, this.facingA + 1.0);
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
    }
}
StarKnight.WINDUP = 0.4;
StarKnight.REACH = 46;
StarKnight.ARMOR = [
    { main: '#5b7cff', dark: '#3a4fc4', cape: '#ff5da8' },
    { main: '#9b6bff', dark: '#6a3fd6', cape: '#3fe0c8' },
    { main: '#2ec4b6', dark: '#1e8a80', cape: '#ff8a3d' },
    { main: '#ff6b9a', dark: '#c9406b', cape: '#5b7cff' },
];

// ══════════════════════════════════════════
// ── Welt 9: Schatten-Dimension ──
// ══════════════════════════════════════════

// Schatten-Geist: violett leuchtender Geist mit Glutaugen, zieht Schattenfetzen hinter sich her.
class ShadowGhost extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 50;
        this.damage = 1;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.detectionRange = 160;
        this.chasing = false;
        this.look = { x: 0, y: 0 };
        this.seed = Math.random() * 10;
        this.fxColor = '#b36bff';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.chasing = dist < this.detectionRange;
        if (this.chasing) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        this._drawBody(ctx, cx, cy, false);
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const y = cy + Math.sin(t * 3.1) * 2.5;
        const flick = 0.86 + 0.14 * Math.sin(t * 9) * Math.sin(t * 3.7);
        const prev = ctx.globalAlpha;
        Art.glow(ctx, cx, y, 26, '#b36bff', 0.5 * flick);
        // Schattenfetzen ziehen hinterher
        ctx.fillStyle = '#5a2fc0';
        for (let i = 0; i < 3; i++) {
            const k = (t * 0.9 + i / 3) % 1;
            const d = 9 + k * 12;
            ctx.globalAlpha = prev * (1 - k) * 0.55;
            ctx.beginPath();
            ctx.arc(cx - this.look.x * d + Math.sin(t * 4 + i) * 2, y + 5 - this.look.y * d + k * 3, 3.4 * (1 - k * 0.5), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = prev * flick;
        const col = '#7a4dff';
        // Ärmchen
        const wv = Math.sin(t * 6) * 1.5;
        Art.body(ctx, cx - 13, y + 2 + wv, 3.4, 2.6, col, { highlight: false, lineWidth: 1.2 });
        Art.body(ctx, cx + 13, y + 2 - wv, 3.4, 2.6, col, { highlight: false, lineWidth: 1.2 });
        // Körper: Kuppel mit Wellensaum und Zipfel oben
        Art.shape(ctx, c => {
            c.moveTo(cx - 12.5, y + 3);
            c.bezierCurveTo(cx - 12.5, y - 11, cx - 5, y - 15, cx + 1, y - 15);
            c.quadraticCurveTo(cx + 4, y - 19 + wv * 0.5, cx + 7, y - 16);
            c.bezierCurveTo(cx + 12, y - 12, cx + 12.5, y - 6, cx + 12.5, y + 3);
            for (let i = 0; i < 4; i++) {
                const x1 = cx + 12.5 - (i + 0.5) * 6.25;
                const x2 = cx + 12.5 - (i + 1) * 6.25;
                c.quadraticCurveTo(x1, y + 15 + Math.sin(t * 7 + i * 1.7) * 2, x2, y + 10);
            }
            c.closePath();
        }, { x: cx - 12.5, y: y - 16, w: 25, h: 29 }, col, { glossy: true });
        // Gesicht
        Art.glow(ctx, cx, y - 2, 13, '#ff4fd8', 0.4);
        if (dying) {
            this._xEyes(ctx, cx, y - 2);
        } else {
            Art.eyes(ctx, cx, y - 2, 3.9, { look: this.look, angry: this.chasing, iris: '#ff4fd8', seed: this.seed, gap: 4.9 });
        }
        if (this.chasing || dying) Art.mouth(ctx, cx, y + 5, 6.5, 'grin');
        else Art.mouth(ctx, cx, y + 5, 4.4, 'o');
        ctx.globalAlpha = prev;
    }

    _xEyes(ctx, x, y) {
        ctx.strokeStyle = '#fff2ff';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const s of [-1, 1]) {
            const ex = x + s * 4.9;
            ctx.moveTo(ex - 2.2, y - 2.2);
            ctx.lineTo(ex + 2.2, y + 2.2);
            ctx.moveTo(ex + 2.2, y - 2.2);
            ctx.lineTo(ex - 2.2, y + 2.2);
        }
        ctx.stroke();
    }
}

// Schatten-Umhang: Kapuzengestalt mit Glutaugen. Springt durch ein Schattentor neben Mark –
// das Tor erscheint vorher am Boden, damit man ausweichen kann.
class ShadowWraith extends Enemy {
    constructor(x, y) {
        super(x, y, 28, 28);
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 35;
        this.damage = 2;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.detectionRange = 200;
        this.teleportTimer = 0;
        this.teleportCooldown = 4;
        this.state = 'float';
        this.stateT = 0;
        this.portal = null;
        this.look = { x: 0, y: 1 };
        this.seed = Math.random() * 10;
        this.fxColor = '#9b6bff';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dx = px - this.centerX();
        const dy = py - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (this.state === 'vanish') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.x = this.portal.x - this.w / 2;
                this.y = this.portal.y - this.h / 2;
                this.state = 'appear';
                this.stateT = 0.4;
            }
            return;
        }
        if (this.state === 'appear') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                this.state = 'float';
                this.contactDamage = true;
                this.portal = null;
            }
            return;
        }
        if (dist < this.detectionRange) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
            this.teleportTimer -= dt;
            if (this.teleportTimer <= 0 && dist > 80) {
                this.teleportTimer = this.teleportCooldown;
                // Ziel neben Mark, aber nie direkt auf ihm
                const a = Math.random() * Math.PI * 2;
                const r = randRange(44, 70);
                this.portal = { x: px + Math.cos(a) * r, y: py + Math.sin(a) * r };
                if (world && world.pixelWidth) {
                    this.portal.x = clamp(this.portal.x, 20, world.pixelWidth - 20);
                    this.portal.y = clamp(this.portal.y, 20, world.pixelHeight - 20);
                }
                this.state = 'vanish';
                this.stateT = 0.45;
                this.contactDamage = false;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        if (this.state === 'float') {
            this._drawBody(ctx, cx, cy, false);
            return;
        }
        // Teleport: Tor am Ziel, Gestalt versinkt bzw. steigt auf
        const k = this.state === 'vanish' ? 1 - this.stateT / 0.45 : 1 - this.stateT / 0.4;
        if (this.portal) {
            const p = camera.worldToScreen(this.portal.x, this.portal.y);
            this._drawPortal(ctx, p.x, p.y + 10, this.state === 'vanish' ? k : 1 - k * 0.7);
        }
        const s = this.state === 'vanish' ? 1 - k * 0.85 : 0.25 + 0.75 * k;
        const prev = ctx.globalAlpha;
        ctx.save();
        ctx.globalAlpha = prev * (this.state === 'vanish' ? 1 - k * 0.7 : 0.3 + 0.7 * k);
        Kit915.scaleAt(ctx, cx, cy + 14, s * (this.state === 'vanish' ? 1 + k * 0.3 : 1), s);
        this._drawBody(ctx, cx, cy, false);
        ctx.restore();
    }

    _drawPortal(ctx, x, y, k) {
        if (k <= 0) return;
        Art.glow(ctx, x, y, 32 * k, '#b36bff', 0.9 * k);
        ctx.fillStyle = '#1b0d3d';
        ctx.beginPath();
        ctx.ellipse(x, y, 17 * k, 10.5 * k, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#b36bff';
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = '#e9d9ff';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        const r = Art.time * 7;
        ctx.beginPath();
        ctx.ellipse(x, y, 12 * k, 7 * k, 0, r, r + 2.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x, y, 8 * k, 4.6 * k, 0, r + Math.PI, r + Math.PI + 2);
        ctx.stroke();
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const y = cy + Math.sin(t * 2.2) * 2;
        Art.glow(ctx, cx, y, 30, '#9b6bff', 0.42);
        // Hände (hinter dem Umhang)
        const reach = Math.sin(t * 3) * 1.5;
        Art.body(ctx, cx - 14, y + 3 + reach, 3.4, 3, '#d7c4ff', { highlight: false, lineWidth: 1.2 });
        Art.body(ctx, cx + 14, y + 3 - reach, 3.4, 3, '#d7c4ff', { highlight: false, lineWidth: 1.2 });
        // Umhang mit Kapuze und zerfetztem Saum
        Art.shape(ctx, c => {
            c.moveTo(cx + 1, y - 18);
            c.quadraticCurveTo(cx + 12, y - 16, cx + 12, y - 4);
            c.quadraticCurveTo(cx + 15, y + 6, cx + 13, y + 13);
            for (let i = 0; i < 4; i++) {
                const x0 = cx + 13 - (i + 0.5) * 6.5;
                const x1 = cx + 13 - (i + 1) * 6.5;
                c.lineTo(x0, y + 18 + Math.sin(t * 5 + i * 1.3) * 2);
                c.lineTo(x1, y + 12);
            }
            c.quadraticCurveTo(cx - 15, y + 6, cx - 12, y - 4);
            c.quadraticCurveTo(cx - 12, y - 16, cx + 1, y - 18);
            c.closePath();
        }, { x: cx - 15, y: y - 18, w: 30, h: 36 }, '#6a3fe0');
        // Heller Kapuzenrand und dunkles Gesicht
        ctx.fillStyle = '#a58bff';
        ctx.beginPath();
        ctx.ellipse(cx, y - 5, 9.4, 8.8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#140a2e';
        ctx.beginPath();
        ctx.ellipse(cx, y - 4.5, 8, 7.4, 0, 0, TAU);
        ctx.fill();
        // Glutaugen
        const ex = this.look.x * 1.6;
        const ey = this.look.y * 1.2 - 5;
        Art.glow(ctx, cx + ex, y + ey, 13, '#ffe45c', 0.55);
        if (dying) {
            ctx.strokeStyle = '#fff45c';
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                const x = cx + s * 3.2;
                ctx.moveTo(x - 1.6, y - 6.6);
                ctx.lineTo(x + 1.6, y - 3.4);
                ctx.moveTo(x + 1.6, y - 6.6);
                ctx.lineTo(x - 1.6, y - 3.4);
            }
            ctx.stroke();
        } else {
            ctx.fillStyle = '#fff45c';
            ctx.beginPath();
            Kit915.oval(ctx, cx - 3.3 + ex, y + ey, 1.9, 2.7, 0.45);
            Kit915.oval(ctx, cx + 3.3 + ex, y + ey, 1.9, 2.7, -0.45);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            Kit915.dot(ctx, cx - 3.8 + ex, y + ey - 1, 0.7);
            Kit915.dot(ctx, cx + 2.8 + ex, y + ey - 1, 0.7);
            ctx.fill();
        }
        // Schließe mit Juwel
        Art.body(ctx, cx, y + 5, 2.2, 2.2, '#ff4fd8', { lineWidth: 1, glossy: true });
    }
}

// W9-Boss: SCHATTEN-MEISTER – schwebender Magier mit Spitzhut, Umhang, Stab und Schattenaugen.
// Kündigt den Kugelring mit leuchtenden Bahnen an und ruft höchstens 8 Schatten-Geister.
class BossShadowMaster extends Enemy {
    constructor(x, y) {
        super(x, y, 90, 90);
        this.hp = 55;
        this.maxHp = 55;
        this.speed = 30;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.phasesThroughWalls = true;
        this.flying = true;
        this.shadow = { rx: 40, ry: 12, dy: 50, alpha: 0.3 };
        this.state = 'intro';
        this.introTimer = 2;
        this.stunnedTimer = 0;
        this.darkTimer = 3;
        this.spawnTimer = 8;
        this.phase = 1;
        this.castT = 0;
        this.castMax = 0.8;
        this.castN = 8;
        this.summonFx = 0;
        this.minions = [];
        this.look = { x: 0, y: 1 };
        this.seed = Math.random() * 10;
        this.fxColor = '#b36bff';
    }

    update(dt, world, player, enemies) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 28 && this.phase === 1) {
            this.phase = 2;
            this.speed = 45;
            Kit915.burst(this.centerX(), this.centerY(), ['#ff4fd8', '#b36bff', '#ffffff'], 18, 200, 0.7);
            Kit915.ring(this.centerX(), this.centerY(), '#ff4fd8', 90, 0.6, 5);
            Kit915.shake(6, 0.4);
        }
        if (this.summonFx > 0) this.summonFx -= dt;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
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
        if (this.state === 'cast') {
            this.castT -= dt;
            if (this.castT <= 0) {
                for (let i = 0; i < this.castN; i++) {
                    const a = (Math.PI * 2 * i) / this.castN;
                    Kit915.shoot(mx, my, Math.cos(a) * 130, Math.sin(a) * 130, 1, 60, '#b36bff', 'orb');
                }
                Kit915.ring(mx, my, '#d9b8ff', 70, 0.4, 4);
                Kit915.shake(4, 0.2);
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }
        this.x += this.look.x * this.speed * dt;
        this.y += this.look.y * this.speed * dt;
        this.darkTimer -= dt;
        if (this.darkTimer <= 0) {
            // Ausholen zählt zur alten Pause – der Rhythmus bleibt wie bisher
            this.castMax = this.phase === 1 ? 0.8 : 0.65;
            this.darkTimer = (this.phase === 1 ? 3 : 2) - this.castMax;
            this.castN = this.phase === 1 ? 8 : 12;
            this.castT = this.castMax;
            this.state = 'cast';
            return;
        }
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = 8;
            for (let i = 0; i < 2; i++) {
                if (Kit915.summon(this, ShadowGhost, enemies, world, Math.random() * Math.PI * 2, 50, 8)) this.summonFx = 0.7;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        if (this.state === 'cast') this._drawCastWarning(ctx, cx, cy);
        this._drawBody(ctx, cx, cy, false);
    }

    // Leuchtende Bahnen am Boden: genau dort fliegen gleich die Schattenkugeln.
    _drawCastWarning(ctx, cx, cy) {
        const k = 1 - this.castT / this.castMax;
        const prev = ctx.globalAlpha;
        const col = this.phase === 2 ? '#ff4fd8' : '#c08cff';
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.globalAlpha = prev * (0.2 + 0.35 * k);
        ctx.beginPath();
        for (let i = 0; i < this.castN; i++) {
            const a = (TAU * i) / this.castN;
            ctx.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
            ctx.lineTo(cx + Math.cos(a) * (60 + 90 * k), cy + Math.sin(a) * (60 + 90 * k));
        }
        ctx.stroke();
        ctx.globalAlpha = prev;
        for (let i = 0; i < this.castN; i++) {
            const a = (TAU * i) / this.castN;
            const x = cx + Math.cos(a) * 50;
            const y = cy + Math.sin(a) * 50;
            Art.glow(ctx, x, y, 8 + 8 * k, col, 0.5 + 0.4 * k);
            Art.body(ctx, x, y, 2 + 3 * k, 2 + 3 * k, '#2a1466', { outline: col, lineWidth: 1.4, highlight: false });
        }
    }

    _drawOrbs(ctx, cx, y, t, back) {
        const n = this.phase === 2 || this.hp <= 28 ? 6 : 4;
        for (let i = 0; i < n; i++) {
            const a = t * 1.3 + (i * TAU) / n;
            const s = Math.sin(a);
            if ((s < 0) !== back) continue;
            const ox = cx + Math.cos(a) * 58;
            const oy = y + 4 + s * 18;
            const r = 4.2 + s * 1.2;
            Art.glow(ctx, ox, oy, r * 3.4, n === 6 ? '#ff4fd8' : '#b36bff', 0.55);
            Art.body(ctx, ox, oy, r, r, '#3a1a8a', { outline: '#d9b8ff', lineWidth: 1.2, glossy: true });
        }
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const p2 = this.phase === 2 || this.hp <= 28;
        const tired = this.state === 'stunned' || dying;
        const castK = this.state === 'cast' ? 1 - this.castT / this.castMax : 0;
        const y = cy - 4 + (tired ? 3 : Math.sin(t * 1.8) * 4);
        const aura = p2 ? '#ff4fd8' : '#b36bff';
        Art.glow(ctx, cx, y, 80 + castK * 24, aura, (tired ? 0.2 : 0.34) + castK * 0.3);
        if (!tired) this._drawOrbs(ctx, cx, y, t, true);
        // Umhang (hinten), Saum weht
        const flap = Math.sin(t * 2.6) * 3;
        Art.shape(ctx, c => {
            c.moveTo(cx - 18, y - 28);
            c.quadraticCurveTo(cx - 44 - flap, y - 6, cx - 50 - flap, y + 36);
            for (let i = 1; i <= 6; i++) {
                const xm = cx - 50 - flap + (i - 0.5) * ((100 + flap * 2) / 6);
                const xe = cx - 50 - flap + i * ((100 + flap * 2) / 6);
                c.lineTo(xm, y + 45 + Math.sin(t * 4 + i) * 3);
                c.lineTo(xe, y + 36);
            }
            c.quadraticCurveTo(cx + 44 + flap, y - 6, cx + 18, y - 28);
            c.closePath();
        }, { x: cx - 52, y: y - 28, w: 104, h: 76 }, '#7a45f0', { lineWidth: 2.2 });
        // Hoher Kragen hinter dem Kopf
        Art.shape(ctx, c => {
            c.moveTo(cx - 14, y - 24);
            c.lineTo(cx - 30, y - 48);
            c.lineTo(cx - 18, y - 40);
            c.lineTo(cx - 12, y - 54);
            c.lineTo(cx, y - 42);
            c.lineTo(cx + 12, y - 54);
            c.lineTo(cx + 18, y - 40);
            c.lineTo(cx + 30, y - 48);
            c.lineTo(cx + 14, y - 24);
            c.closePath();
        }, { x: cx - 30, y: y - 54, w: 60, h: 30 }, '#9d62ff', { lineWidth: 2 });
        // Robe mit wehenden Schattenzipfeln
        Art.shape(ctx, c => {
            c.moveTo(cx - 15, y - 26);
            c.quadraticCurveTo(cx - 30, y + 8, cx - 34, y + 36);
            for (let i = 1; i <= 5; i++) {
                const xm = cx - 34 + (i - 0.5) * 13.6;
                const xe = cx - 34 + i * 13.6;
                c.quadraticCurveTo(xm, y + 48 + Math.sin(t * 5 + i * 1.4) * 3, xe, y + 38);
            }
            c.quadraticCurveTo(cx + 30, y + 8, cx + 15, y - 26);
            c.closePath();
        }, { x: cx - 34, y: y - 26, w: 68, h: 72 }, '#4a2ab8', { lineWidth: 2.2 });
        // Goldborte und Gürtel mit Juwel
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, y - 18);
        ctx.lineTo(cx, y + 40);
        ctx.stroke();
        Art.box(ctx, cx - 22, y + 2, 44, 6, 3, '#ffd23f', { lineWidth: 1.4 });
        const gem = p2 ? '#ff3d5a' : '#ff4fd8';
        Art.glow(ctx, cx, y + 5, 12, gem, 0.5 + castK * 0.4);
        Art.gem(ctx, cx, y + 5, 5, gem);
        // Arme mit weiten Ärmeln: links der Stab, rechts eine Schattenkugel
        const raise = castK * 18 + (this.summonFx > 0 ? 10 : 0);
        const hlx = cx - 34;
        const hly = y + 4 - castK * 22;
        const hrx = cx + 34;
        const hry = y + 2 - raise * 0.6;
        Art.shape(ctx, c => {
            c.moveTo(cx - 14, y - 22);
            c.quadraticCurveTo(cx - 30, y - 18, hlx - 2, hly - 6);
            c.lineTo(hlx + 7, hly + 6);
            c.quadraticCurveTo(cx - 20, y - 2, cx - 12, y - 8);
            c.closePath();
        }, { x: hlx - 4, y: Math.min(hly - 6, y - 22), w: 32, h: 30 }, '#5733c4', { lineWidth: 1.8 });
        Art.shape(ctx, c => {
            c.moveTo(cx + 14, y - 22);
            c.quadraticCurveTo(cx + 30, y - 18, hrx + 2, hry - 6);
            c.lineTo(hrx - 7, hry + 6);
            c.quadraticCurveTo(cx + 20, y - 2, cx + 12, y - 8);
            c.closePath();
        }, { x: cx + 8, y: Math.min(hry - 6, y - 22), w: 32, h: 30 }, '#5733c4', { lineWidth: 1.8 });
        // Stab mit Mondsichel und Kristall
        const sx = hlx - 2;
        Art.limb(ctx, sx + 3, hly + 26, sx - 2, hly - 34, 3.4, '#6a3fb0');
        const orbY = hly - 40;
        Art.glow(ctx, sx - 2, orbY, 18 + castK * 16, aura, 0.55 + castK * 0.4);
        Art.shape(ctx, c => {
            c.arc(sx - 2, orbY, 9, Math.PI * 0.2, Math.PI * 1.8);
            c.arc(sx + 1, orbY, 7, Math.PI * 1.75, Math.PI * 0.25, true);
            c.closePath();
        }, { x: sx - 11, y: orbY - 9, w: 18, h: 18 }, '#ffd23f', { lineWidth: 1.2 });
        Art.body(ctx, sx - 2, orbY, 4.2 + castK * 1.5, 4.2 + castK * 1.5, '#f0d8ff', { outline: '#8a4dff', lineWidth: 1.2, glossy: true });
        Art.body(ctx, hlx, hly, 4.6, 4.2, '#e6dcff', { lineWidth: 1.4 });
        // Rechte Hand mit wirbelnder Schattenkugel
        Art.glow(ctx, hrx, hry - 8, 14 + raise * 0.4, aura, 0.5);
        Art.body(ctx, hrx, hry - 8, 5 + raise * 0.12, 5 + raise * 0.12, '#2a1466', { outline: '#d9b8ff', lineWidth: 1.2, glossy: true });
        Art.body(ctx, hrx, hry, 4.6, 4.2, '#e6dcff', { lineWidth: 1.4 });
        // Kopf: Schattengesicht unter dem Spitzhut
        const hy = y - 30;
        Art.body(ctx, cx, hy, 16.5, 14, '#2c1666', { highlight: false, lineWidth: 2 });
        ctx.fillStyle = '#0e0624';
        ctx.beginPath();
        ctx.ellipse(cx, hy + 2, 13.5, 11, 0, 0, TAU);
        ctx.fill();
        this._drawEyes(ctx, cx, hy + 1, tired, dying, castK, p2);
        // Spitzhut (kippt, wenn erschöpft)
        const tilt = tired ? -0.35 : Math.sin(t * 1.4) * 0.06;
        ctx.save();
        ctx.translate(cx, hy - 9);
        ctx.rotate(tilt);
        Art.body(ctx, 0, 0, 26, 6.8, '#3d2399', { lineWidth: 2 });
        Art.shape(ctx, c => {
            c.moveTo(-15, -2);
            c.quadraticCurveTo(-8, -26, 4, -40);
            c.quadraticCurveTo(12, -46, 20, -42);
            c.quadraticCurveTo(10, -38, 9, -30);
            c.quadraticCurveTo(12, -14, 15, -2);
            c.closePath();
        }, { x: -15, y: -46, w: 35, h: 44 }, '#4a2ab8', { lineWidth: 2 });
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-14, -5);
        ctx.quadraticCurveTo(0, -1, 14.5, -5);
        ctx.stroke();
        Art.shape(ctx, c => {
            c.arc(-2, -20, 5.5, Math.PI * 0.35, Math.PI * 1.65);
            c.arc(0, -20, 4.2, Math.PI * 1.6, Math.PI * 0.4, true);
            c.closePath();
        }, { x: -8, y: -26, w: 12, h: 12 }, '#ffd23f', { lineWidth: 1 });
        Art.sparkle(ctx, 6, -28, 2.2, '#fff6a8');
        Art.sparkle(ctx, -6, -12, 1.6, '#fff6a8');
        ctx.restore();
        if (!tired) this._drawOrbs(ctx, cx, y, t, false);
        if (this.state === 'stunned') Kit915.dizzy(ctx, cx, hy - 26, 26, 3, 5);
    }

    _drawEyes(ctx, cx, y, tired, dying, castK, p2) {
        const col = p2 ? '#ff5a3d' : '#ff6bf0';
        if (dying) {
            ctx.strokeStyle = '#fbe2ff';
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                const x = cx + s * 5.5;
                ctx.moveTo(x - 2.6, y - 2.6);
                ctx.lineTo(x + 2.6, y + 2.6);
                ctx.moveTo(x + 2.6, y - 2.6);
                ctx.lineTo(x - 2.6, y + 2.6);
            }
            ctx.stroke();
            return;
        }
        if (tired) {
            ctx.strokeStyle = col;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx - 8.5, y);
            ctx.lineTo(cx - 3, y + 1);
            ctx.moveTo(cx + 3, y + 1);
            ctx.lineTo(cx + 8.5, y);
            ctx.stroke();
            return;
        }
        const ex = this.look.x * 2;
        const ey = this.look.y * 1.4;
        Art.glow(ctx, cx + ex, y + ey, 16 + castK * 8, col, 0.6 + castK * 0.3);
        ctx.fillStyle = col;
        ctx.beginPath();
        for (const s of [-1, 1]) {
            ctx.moveTo(cx + s * 10.5 + ex, y - 3.6 + ey);
            ctx.quadraticCurveTo(cx + s * 5.5 + ex, y - 1.2 + ey, cx + s * 2.4 + ex, y + 1.2 + ey);
            ctx.quadraticCurveTo(cx + s * 7 + ex, y + 5.2 + ey, cx + s * 10.5 + ex, y - 3.6 + ey);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        Kit915.dot(ctx, cx - 6 + ex, y + 0.8 + ey, 1.3);
        Kit915.dot(ctx, cx + 6 + ex, y + 0.8 + ey, 1.3);
        ctx.fill();
        // Beim Zaubern grinst der Schatten
        if (castK > 0) {
            ctx.strokeStyle = col;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(cx, y + 3, 5.5, 0.3, Math.PI - 0.3);
            ctx.stroke();
        }
    }
}

// ══════════════════════════════════════════
// ── Welt 10: Obst-Paradies ──
// ══════════════════════════════════════════

// Wütende Frucht: Apfel, Orange oder Traube mit grimmigem Gesicht, hüpft auf Mark zu.
class AngryFruit extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 20);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 55;
        this.damage = 1;
        this.detectionRange = 150;
        this.fruitType = randInt(0, 2); // 0 = Apfel, 1 = Orange, 2 = Traube
        this.fxColor = ['#ff4d4d', '#ff9a1f', '#a45cff'][this.fruitType];
        this.chasing = false;
        this.look = { x: 0, y: 0 };
        this.seed = Math.random() * 10;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dx = player.x + player.w / 2 - this.centerX();
        const dy = player.y + player.h / 2 - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.chasing = dist < this.detectionRange;
        if (this.chasing) {
            this._moveWithCollision((dx / dist) * this.speed * dt, (dy / dist) * this.speed * dt, world);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            // Platsch: flach drücken und verschwinden
            const t = this.deathProgress();
            if (t >= 1) return;
            const prev = ctx.globalAlpha;
            ctx.save();
            ctx.globalAlpha = prev * (1 - t);
            Kit915.scaleAt(ctx, cx, cy + 10, 1 + t * 0.7, Math.max(0.05, 1 - t * 0.9));
            this._drawBody(ctx, cx, cy, true);
            ctx.restore();
            return;
        }
        this._drawBody(ctx, cx, cy, false);
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const hopT = (t * 5.5) % 1;
        const hop = this.chasing && !dying ? Math.sin(hopT * Math.PI) * 4 : 0;
        const land = this.chasing && !dying ? Math.max(0, 1 - hopT * 5) * 0.16 : Math.sin(t * 3) * 0.03;
        const foot = cy + 10;
        // Füßchen
        ctx.fillStyle = '#5a1f3a';
        ctx.beginPath();
        Kit915.oval(ctx, cx - 5.2, foot - 1, 3.4, 2);
        Kit915.oval(ctx, cx + 5.2, foot - 1 - (hop > 1 ? 1 : 0), 3.4, 2);
        ctx.fill();
        ctx.save();
        Kit915.scaleAt(ctx, cx, foot, 1.15 * (1 + land), 1.15 * (1 - land)); // etwas größer als die Hitbox
        ctx.translate(0, -hop);
        if (this.fruitType === 0) this._apple(ctx, cx, cy);
        else if (this.fruitType === 1) this._orange(ctx, cx, cy);
        else this._grape(ctx, cx, cy);
        // Grimmiges Gesicht
        const fy = this.fruitType === 2 ? cy + 1 : cy;
        if (dying) {
            ctx.strokeStyle = '#2a0b1e';
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                ctx.moveTo(cx + s * 3.6 - 1.6, fy - 2);
                ctx.lineTo(cx + s * 3.6 + 1.6, fy + 1);
                ctx.moveTo(cx + s * 3.6 + 1.6, fy - 2);
                ctx.lineTo(cx + s * 3.6 - 1.6, fy + 1);
            }
            ctx.stroke();
        } else {
            Art.eyes(ctx, cx, fy - 0.5, 2.7, { look: this.look, angry: true, seed: this.seed, gap: 3.6 });
        }
        if (this.chasing || dying) Art.mouth(ctx, cx, fy + 4.6, 5.5, 'teeth');
        else Art.mouth(ctx, cx, fy + 4.2, 4.5, 'angry');
        ctx.restore();
    }

    _apple(ctx, cx, cy) {
        Art.body(ctx, cx, cy + 1, 10, 9.5, '#ff4d4d', { glossy: true });
        ctx.strokeStyle = '#a3182f';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 3, 0.5, Math.PI - 0.5);
        ctx.stroke();
        Art.limb(ctx, cx, cy - 7.5, cx + 1.4, cy - 12, 1.8, '#9c5a2e', { lineWidth: 1 });
        Kit915.leaf(ctx, cx + 1.4, cy - 11, 7, -0.5, '#5fd35a');
    }

    _orange(ctx, cx, cy) {
        Art.body(ctx, cx, cy + 1, 10, 9.8, '#ff9a1f', { glossy: true });
        ctx.fillStyle = '#e0700f';
        ctx.beginPath();
        Kit915.dot(ctx, cx - 6, cy + 5, 0.8);
        Kit915.dot(ctx, cx + 6.5, cy + 3, 0.8);
        Kit915.dot(ctx, cx + 4, cy + 7.5, 0.8);
        Kit915.dot(ctx, cx - 3, cy + 8, 0.8);
        ctx.fill();
        Art.body(ctx, cx, cy - 8.4, 2, 1.4, '#4fb33a', { highlight: false, lineWidth: 1 });
        Kit915.leaf(ctx, cx + 0.5, cy - 9, 6.5, -2.4, '#5fd35a');
    }

    _grape(ctx, cx, cy) {
        const g = '#9b59ff';
        Art.body(ctx, cx - 6.5, cy - 5, 4.4, 4.4, g, { lineWidth: 1.3 });
        Art.body(ctx, cx + 6.5, cy - 5, 4.4, 4.4, g, { lineWidth: 1.3 });
        Art.body(ctx, cx, cy - 7.5, 4.4, 4.4, g, { lineWidth: 1.3 });
        Art.body(ctx, cx - 8, cy + 2, 4, 4, g, { lineWidth: 1.3 });
        Art.body(ctx, cx + 8, cy + 2, 4, 4, g, { lineWidth: 1.3 });
        Art.body(ctx, cx, cy + 1.5, 8, 8, '#b06bff', { glossy: true });
        Art.limb(ctx, cx, cy - 11, cx + 1, cy - 14.5, 1.6, '#6b9a2a', { lineWidth: 1 });
        Kit915.leaf(ctx, cx + 1, cy - 13.5, 6, -0.3, '#5fd35a');
    }
}

// Fleischfressende Riesenpflanze: Klappmaul mit Zähnen, reißt vor dem Spucken das Maul auf.
class GiantPlant extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 30);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 20;
        this.damage = 1;
        this.detectionRange = 140;
        this.shootTimer = 0.6; // auch der erste Samen kommt mit Vorwarnung
        this.shootCooldown = 2;
        this.active = false;
        this.look = { x: 0, y: 1 };
        this.seed = Math.random() * 10;
        this.fxColor = '#7bdc3a';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.active = dist < this.detectionRange;
        if (!this.active) {
            this.shootTimer = Math.max(this.shootTimer, 0.5); // nie ohne Vorwarnung spucken
            return;
        }
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            Kit915.shoot(mx, my, this.look.x * 100, this.look.y * 100, 1, 50, '#b8ff3a', 'seed');
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        this._drawBody(ctx, cx, cy, false);
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const foot = cy + 15;
        const sway = Math.sin(t * 2) * 1.5;
        const charge = this.active && !dying ? clamp(1 - this.shootTimer / 0.5, 0, 1) : 0;
        const snap = this.active && !dying && this.shootTimer > this.shootCooldown - 0.15;
        // Wurzelfüße und Blätter
        const wig = this.active ? Math.sin(t * 9) * 1.5 : 0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 3, foot - 5);
        ctx.lineTo(cx - 9 - wig, foot);
        ctx.moveTo(cx + 3, foot - 5);
        ctx.lineTo(cx + 9 + wig, foot);
        ctx.strokeStyle = Art.ink('#3f9a3a');
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = '#3f9a3a';
        ctx.lineWidth = 2.6;
        ctx.stroke();
        Kit915.leaf(ctx, cx - 2, foot - 6, 14, Math.PI + 0.45 + sway * 0.04, '#48c94a');
        Kit915.leaf(ctx, cx + 2, foot - 6, 14, -0.45 - sway * 0.04, '#48c94a');
        // Stiel
        const hx = cx + sway + this.look.x * 2;
        const hy = cy - 5 - charge * 2 + (snap ? 2 : 0);
        Art.limb(ctx, cx, foot - 5, hx, hy + 6, 4.6, '#5ccf4a', { lineWidth: 1.4 });
        // Maul: öffnet sich im Takt, vor dem Schuss weit
        const open = dying ? 0.9 : (snap ? 0.05 : (charge > 0 ? 0.3 + charge * 0.7 : 0.2 + 0.14 * Math.sin(t * 4)));
        const gap = 1.5 + open * 8;
        const inner = '#ff8fb0';
        Art.body(ctx, hx, hy + 1, 11, 1.5 + gap * 0.6, '#7a1036', { highlight: false, lineWidth: 1.4 });
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.ellipse(hx, hy + 1 + gap * 0.15, 8.5, Math.max(0.5, gap * 0.45), 0, 0, TAU);
        ctx.fill();
        if (charge > 0) {
            Art.glow(ctx, hx, hy + 1, 8 + charge * 8, '#b8ff3a', 0.5 + charge * 0.4);
            Art.body(ctx, hx, hy + 1, 1.5 + charge * 2.2, 1.5 + charge * 2.2, '#d8ff6a', { lineWidth: 1 });
        }
        // Unterkiefer mit Zähnen
        const ly = hy + 1 + gap * 0.5;
        Art.shape(ctx, c => {
            c.moveTo(hx - 13, ly - 1);
            c.quadraticCurveTo(hx, ly + 1, hx + 13, ly - 1);
            c.quadraticCurveTo(hx + 12, ly + 9, hx, ly + 9);
            c.quadraticCurveTo(hx - 12, ly + 9, hx - 13, ly - 1);
            c.closePath();
        }, { x: hx - 13, y: ly - 1, w: 26, h: 10 }, '#ff3d6e', { lineWidth: 1.4 });
        this._teeth(ctx, hx, ly - 0.5, -1);
        // Oberkiefer (Kuppel) mit Punkten und Augen
        const uy = hy + 1 - gap * 0.5;
        Art.shape(ctx, c => {
            c.moveTo(hx - 14, uy + 1);
            c.bezierCurveTo(hx - 14, uy - 17, hx + 14, uy - 17, hx + 14, uy + 1);
            c.quadraticCurveTo(hx, uy - 1, hx - 14, uy + 1);
            c.closePath();
        }, { x: hx - 14, y: uy - 13, w: 28, h: 14 }, '#ff3d6e', { glossy: true, lineWidth: 1.4 });
        this._teeth(ctx, hx, uy + 0.5, 1);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        Kit915.dot(ctx, hx - 9.5, uy - 3.5, 2.1);
        Kit915.dot(ctx, hx + 10, uy - 4, 1.8);
        Kit915.dot(ctx, hx + 5.5, uy - 10.5, 1.4);
        ctx.fill();
        if (dying) {
            ctx.strokeStyle = '#1f3a12';
            ctx.lineWidth = 1.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                ctx.moveTo(hx + s * 4.5 - 2, uy - 9);
                ctx.lineTo(hx + s * 4.5 + 2, uy - 5);
                ctx.moveTo(hx + s * 4.5 + 2, uy - 9);
                ctx.lineTo(hx + s * 4.5 - 2, uy - 5);
            }
            ctx.stroke();
        } else {
            Art.eyes(ctx, hx, uy - 7, 3, { look: this.look, angry: true, seed: this.seed, gap: 4.4 });
        }
    }

    // Zahnreihe am Kieferrand (dir = 1: zeigt nach unten, -1: nach oben)
    _teeth(ctx, x, y, dir) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x - 10.8, y);
        for (let i = 0; i < 4; i++) {
            const tx = x - 8.1 + i * 5.4;
            ctx.lineTo(tx, y + dir * 3.6);
            ctx.lineTo(tx + 2.7, y);
        }
        ctx.closePath();
        ctx.fill();
    }
}

// W10-Boss: OBST-KÖNIG – dicker Erdbeer-König mit Blattkragen, Krone, Königsmantel und Orangen-Zepter.
// Zeigt die Fruchtbahnen vorher an und ruft höchstens 8 wütende Früchte.
class BossFruitKing extends Enemy {
    constructor(x, y) {
        super(x, y, 100, 90);
        this.hp = 60;
        this.maxHp = 60;
        this.speed = 25;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stunnedTimer = 0;
        this.fruitTimer = 3;
        this.vineTimer = 5;
        this.phase = 1;
        this.castT = 0;
        this.castMax = 0.8;
        this.castN = 6;
        this.summonFx = 0;
        this.minions = [];
        this.moving = false;
        this.look = { x: 0, y: 1 };
        this.seed = Math.random() * 10;
        this.fxColor = '#ff4d6d';
        this.shadow = { rx: 44, ry: 13, dy: 44 };
    }

    update(dt, world, player, enemies) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 30 && this.phase === 1) {
            this.phase = 2;
            this.speed = 35;
            Kit915.burst(this.centerX(), this.y + 10, ['#ff4d6d', '#ffd23f', '#ffffff'], 16, 180, 0.6);
            Kit915.shake(6, 0.4);
        }
        if (this.summonFx > 0) this.summonFx -= dt;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.moving = false;
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
        if (this.state === 'cast') {
            this.castT -= dt;
            if (this.castT <= 0) {
                const cols = ['#ff4d4d', '#ff9a1f', '#a45cff', '#ffd23f'];
                for (let i = 0; i < this.castN; i++) {
                    const a = (Math.PI * 2 * i) / this.castN;
                    Kit915.shoot(mx, my, Math.cos(a) * 120, Math.sin(a) * 120, 1, 60, cols[i % cols.length], 'fruit');
                }
                Kit915.burst(mx, my - 30, ['#ffd23f', '#ff9a1f', '#ffffff'], 10, 150, 0.5, { kind: 'star' });
                Kit915.shake(4, 0.2);
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.moving = true;
        this.fruitTimer -= dt;
        if (this.fruitTimer <= 0) {
            // Ausholen zählt zur alten Pause – der Rhythmus bleibt wie bisher
            this.castMax = this.phase === 1 ? 0.8 : 0.65;
            this.fruitTimer = (this.phase === 1 ? 3 : 2) - this.castMax;
            this.castN = this.phase === 1 ? 6 : 10;
            this.castT = this.castMax;
            this.state = 'cast';
            return;
        }
        this.vineTimer -= dt;
        if (this.vineTimer <= 0) {
            this.vineTimer = 5;
            for (let i = 0; i < 3; i++) {
                if (Kit915.summon(this, AngryFruit, enemies, world, Math.random() * Math.PI * 2, 60, 8)) this.summonFx = 0.6;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        if (this.state === 'cast') this._drawCastWarning(ctx, cx, cy);
        this._drawBody(ctx, cx, cy, false);
    }

    // Früchte erscheinen im Kreis – dort entlang fliegen sie gleich.
    _drawCastWarning(ctx, cx, cy) {
        const k = 1 - this.castT / this.castMax;
        const prev = ctx.globalAlpha;
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.globalAlpha = prev * (0.15 + 0.3 * k);
        ctx.beginPath();
        for (let i = 0; i < this.castN; i++) {
            const a = (TAU * i) / this.castN;
            ctx.moveTo(cx + Math.cos(a) * 62, cy + Math.sin(a) * 62);
            ctx.lineTo(cx + Math.cos(a) * (70 + 80 * k), cy + Math.sin(a) * (70 + 80 * k));
        }
        ctx.stroke();
        ctx.globalAlpha = prev;
        const cols = ['#ff4d4d', '#ff9a1f', '#a45cff', '#ffd23f'];
        for (let i = 0; i < this.castN; i++) {
            const a = (TAU * i) / this.castN;
            const x = cx + Math.cos(a) * 58;
            const y = cy + Math.sin(a) * 58;
            const r = 1.5 + 4 * k;
            Art.glow(ctx, x, y, r * 3, cols[i % 4], 0.4 + 0.3 * k);
            Art.body(ctx, x, y, r, r, cols[i % 4], { lineWidth: 1.2 });
            if (k > 0.4) Kit915.leaf(ctx, x + 0.5, y - r + 0.5, 2 + 3 * k, -0.7, '#5fd35a');
        }
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const p2 = this.phase === 2 || this.hp <= 30;
        const tired = this.state === 'stunned' || dying;
        const castK = this.state === 'cast' ? 1 - this.castT / this.castMax : 0;
        const foot = cy + 45;
        const waddle = this.moving ? Math.sin(t * 7) : 0;
        const sit = tired ? 5 : 0;
        const by = cy + 4 + sit - (this.moving ? Math.abs(waddle) * 2 : Math.sin(t * 2) * 1);
        const tilt = waddle * 0.05;
        const berry = p2 ? '#ec2548' : '#ff3d5a';
        // Königsmantel (hinten)
        Art.shape(ctx, c => {
            c.moveTo(cx - 30, by - 30);
            c.quadraticCurveTo(cx - 60, by, cx - 56, foot - 2);
            c.quadraticCurveTo(cx, foot + 4, cx + 56, foot - 2);
            c.quadraticCurveTo(cx + 60, by, cx + 30, by - 30);
            c.closePath();
        }, { x: cx - 60, y: by - 30, w: 120, h: foot - by + 32 }, '#8a3dd8', { lineWidth: 2.2 });
        // Hermelin-Saum
        ctx.strokeStyle = '#fff6ea';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 55, foot - 4);
        ctx.quadraticCurveTo(cx, foot + 2, cx + 55, foot - 4);
        ctx.stroke();
        ctx.fillStyle = '#2a1a3a';
        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.ellipse(cx + i * 15, foot - 2 + Math.abs(i) * -0.6, 1.1, 1.8, 0, 0, TAU);
            ctx.fill();
        }
        // Beinchen mit goldenen Schuhen
        for (const s of [-1, 1]) {
            const lift = this.moving && Math.sign(waddle) === s ? 3 : 0;
            Art.limb(ctx, cx + s * 14, by + 30, cx + s * 16, foot - 4 - lift, 6, '#3fb34a');
            Art.body(ctx, cx + s * 18, foot - 3 - lift, 7, 4, '#ffd23f', { lineWidth: 1.6 });
        }
        ctx.save();
        ctx.translate(cx, by);
        ctx.rotate(tilt);
        ctx.translate(-cx, -by);
        // Erdbeer-Körper
        Art.shape(ctx, c => {
            c.moveTo(cx, by - 38);
            c.bezierCurveTo(cx + 34, by - 42, cx + 50, by - 16, cx + 40, by + 10);
            c.bezierCurveTo(cx + 30, by + 34, cx + 10, by + 40, cx, by + 40);
            c.bezierCurveTo(cx - 10, by + 40, cx - 30, by + 34, cx - 40, by + 10);
            c.bezierCurveTo(cx - 50, by - 16, cx - 34, by - 42, cx, by - 38);
            c.closePath();
        }, { x: cx - 46, y: by - 40, w: 92, h: 80 }, berry, { glossy: true, lineWidth: 2.4 });
        // Samen
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        const seeds = BossFruitKing.SEEDS;
        for (let i = 0; i < seeds.length; i += 2) {
            ctx.moveTo(cx + seeds[i] + 1.3, by + seeds[i + 1]);
            ctx.ellipse(cx + seeds[i], by + seeds[i + 1], 1.3, 2, 0, 0, TAU);
        }
        ctx.fill();
        // Arme: links in die Hüfte, rechts das Zepter
        const lhx = cx - 44;
        const lhy = by + 6;
        const rhx = cx + 44;
        const rhy = by - 2 - castK * 26 - (this.summonFx > 0 ? 8 : 0);
        Art.limb(ctx, cx - 34, by - 6, lhx, lhy, 5, '#3fb34a');
        Art.limb(ctx, cx + 34, by - 8, rhx, rhy, 5, '#3fb34a');
        Art.body(ctx, lhx, lhy, 4.6, 4.2, '#5fd35a', { lineWidth: 1.4 });
        // Zepter mit glänzender Orange
        const topY = rhy - 34;
        Art.limb(ctx, rhx, rhy + 12, rhx + 2, topY + 6, 3.6, '#ffd23f', { lineWidth: 1.4 });
        Art.glow(ctx, rhx + 2, topY, 14 + castK * 16, '#ff9a1f', 0.35 + castK * 0.5);
        Art.body(ctx, rhx + 2, topY, 7.5 + castK * 1.5, 7.5 + castK * 1.5, '#ff9a1f', { glossy: true, lineWidth: 1.6 });
        Kit915.leaf(ctx, rhx + 2, topY - 7, 7, -0.6, '#5fd35a');
        Art.body(ctx, rhx + 2, topY + 8, 4, 2, '#ffd23f', { lineWidth: 1.2 });
        Art.body(ctx, rhx, rhy, 4.6, 4.2, '#5fd35a', { lineWidth: 1.4 });
        // Blattkragen (flacher Stern, die vorderen Blätter hängen über)
        Art.shape(ctx, c => {
            const n = 9;
            for (let i = 0; i < n * 2; i++) {
                const a = (i * Math.PI) / n + 0.17;
                const o = i % 2 === 0;
                const x = cx + Math.cos(a) * (o ? 40 : 22);
                const y = by - 32 + Math.sin(a) * (o ? 13 : 7) + (o && Math.sin(a) > 0 ? 5 : 0);
                if (i === 0) c.moveTo(x, y);
                else c.lineTo(x, y);
            }
            c.closePath();
        }, { x: cx - 40, y: by - 45, w: 80, h: 32 }, '#4cd35a', { lineWidth: 2 });
        // Gesicht
        const fy = by - 10;
        if (dying) {
            this._xEyes(ctx, cx, fy);
        } else if (tired) {
            ctx.strokeStyle = '#3a0d1e';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(cx - 11, fy - 1, 4.5, 0.2, Math.PI - 0.2);
            ctx.moveTo(cx + 15.5, fy - 1);
            ctx.arc(cx + 11, fy - 1, 4.5, 0.2, Math.PI - 0.2);
            ctx.stroke();
        } else {
            Art.eyes(ctx, cx, fy - 2, 6.5, { look: this.look, angry: true, seed: this.seed, gap: 11, iris: '#3fb34a' });
        }
        Art.blush(ctx, cx, fy + 8, 5, 20);
        // Blatt-Schnurrbart und Mund
        Kit915.leaf(ctx, cx - 1, fy + 8, 12, Math.PI - 0.3, '#3fb34a', 0.5);
        Kit915.leaf(ctx, cx + 1, fy + 8, 12, 0.3, '#3fb34a', 0.5);
        if (castK > 0 || dying) Art.mouth(ctx, cx, fy + 14, 10, 'open');
        else if (tired) Art.mouth(ctx, cx, fy + 14, 6, 'o');
        else Art.mouth(ctx, cx, fy + 15, 9, 'angry');
        if (tired && !dying) {
            Art.body(ctx, cx + 30, fy - 8 + ((t * 20) % 6), 2.2, 3.2, '#8fe3ff', { lineWidth: 1 });
        }
        // Krone (verrutscht, wenn erschöpft)
        ctx.save();
        ctx.translate(cx, by - 38);
        ctx.rotate(tired ? 0.3 : Math.sin(t * 2) * 0.04);
        Art.shape(ctx, c => {
            c.moveTo(-20, 4);
            c.lineTo(-23, -16);
            c.lineTo(-12, -6);
            c.lineTo(0, -22);
            c.lineTo(12, -6);
            c.lineTo(23, -16);
            c.lineTo(20, 4);
            c.closePath();
        }, { x: -23, y: -22, w: 46, h: 26 }, '#ffd23f', { glossy: true, lineWidth: 2 });
        const gemGlow = p2 ? 0.5 + 0.3 * Math.sin(t * 8) : 0;
        if (gemGlow) Art.glow(ctx, 0, -4, 20, '#ff4d6d', gemGlow);
        Art.gem(ctx, 0, -5, 4, '#ff3d5a');
        Art.gem(ctx, -13, -3, 3, '#39d5ff');
        Art.gem(ctx, 13, -3, 3, '#6bff5a');
        Art.body(ctx, -23, -16, 2.2, 2.2, '#fff6a8', { lineWidth: 1 });
        Art.body(ctx, 0, -22, 2.4, 2.4, '#fff6a8', { lineWidth: 1 });
        Art.body(ctx, 23, -16, 2.2, 2.2, '#fff6a8', { lineWidth: 1 });
        ctx.restore();
        ctx.restore();
        // Zorn-Dampf in Phase 2
        if (p2 && !tired) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const k = (t * 0.8 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - k) * 0.6;
                ctx.beginPath();
                ctx.arc(cx + (i - 1) * 16 + Math.sin(t * 3 + i) * 3, by - 62 - k * 18, 3 + k * 4, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
        if (this.state === 'stunned') Kit915.dizzy(ctx, cx, by - 66, 28, 3, 5);
    }

    _xEyes(ctx, x, y) {
        ctx.strokeStyle = '#3a0d1e';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const s of [-1, 1]) {
            const ex = x + s * 11;
            ctx.moveTo(ex - 4, y - 5);
            ctx.lineTo(ex + 4, y + 3);
            ctx.moveTo(ex + 4, y - 5);
            ctx.lineTo(ex - 4, y + 3);
        }
        ctx.stroke();
    }
}
// Samen-Punkte auf der Erdbeere (x, y relativ zur Mitte)
BossFruitKing.SEEDS = [
    -24, -18, -8, -24, 10, -22, 26, -16,
    -32, -2, 30, 0,
    -24, 12, -8, 18, 8, 20, 24, 12,
    -14, 30, 2, 33, 16, 28,
];
