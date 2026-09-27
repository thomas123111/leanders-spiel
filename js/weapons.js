// ── Weapons ──

class BaseballBat {
    constructor() {
        this.name = 'Baseballschläger';
        this.type = 'melee';
        this.damage = 4; // kills a ghost in 1 hit (ghost HP = 4)
        this.range = 44;
        this.arcWidth = Math.PI * 0.6; // 108 degree arc
        this.cooldown = 0.35;
        this.cooldownTimer = 0;
        this.swinging = false;
        this.swingTimer = 0;
        this.swingDuration = 0.2;
        this.swingAngle = 0;
        this.knockback = 200;
    }

    canAttack() {
        return this.cooldownTimer <= 0;
    }

    attack(angle) {
        if (!this.canAttack()) return false;
        this.cooldownTimer = this.cooldown;
        this.swinging = true;
        this.swingTimer = this.swingDuration;
        this.swingAngle = angle;
        return true;
    }

    update(dt) {
        if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
        if (this.swingTimer > 0) {
            this.swingTimer -= dt;
            if (this.swingTimer <= 0) this.swinging = false;
        }
    }

    // Trifft alle Gegner, deren Hitbox den Schwungbogen berührt (nicht nur deren Mittelpunkt –
    // sonst waren große Bosse nur „von innen“ treffbar).
    getHitEntities(playerPos, enemies) {
        if (!this.swinging) return [];
        const hit = [];
        const cx = playerPos.x + playerPos.w / 2;
        const cy = playerPos.y + playerPos.h / 2;
        for (const enemy of enemies) {
            if (enemy.dead) continue;
            // nächster Punkt der Gegner-Box zu Mark
            const nx = clamp(cx, enemy.x, enemy.x + enemy.w);
            const ny = clamp(cy, enemy.y, enemy.y + enemy.h);
            const dist = Math.hypot(nx - cx, ny - cy);
            if (dist > this.range) continue;
            if (dist < 6) { hit.push(enemy); continue; }
            const ex = enemy.x + enemy.w / 2;
            const ey = enemy.y + enemy.h / 2;
            // Winkel zum nächsten Punkt oder zur Mitte – beides zählt
            if (pointInArc({ x: nx, y: ny }, { x: cx, y: cy }, this.swingAngle, this.arcWidth, this.range + 1) ||
                pointInArc({ x: ex, y: ey }, { x: cx, y: cy }, this.swingAngle, this.arcWidth, Infinity)) {
                hit.push(enemy);
            }
        }
        return hit;
    }

    // Schlägerwinkel im Schwung, weich beschleunigt – nur für die Darstellung.
    _swingAngle() {
        const p = clamp(1 - this.swingTimer / this.swingDuration, 0, 1);
        const e = 1 - Math.pow(1 - p, 2.2);
        return this.swingAngle - this.arcWidth / 2 + this.arcWidth * e;
    }

    // pose (optional, von Player.draw): Griffpunkt gx/gy, Körpermitte cx/cy, Haltung mode.
    draw(ctx, camera, playerPos, pose) {
        if (!this.swinging) {
            // In Ruhe liegt der Schläger auf Marks Schulter
            if (pose && pose.mode === 'bat') this._drawBat(ctx, pose.gx, pose.gy, pose.batAngle, 0.72);
            return;
        }
        let cx, cy;
        if (pose) {
            cx = pose.cx;
            cy = pose.cy + 1.6 + (pose.bob || 0);
        } else {
            const c = camera.worldToScreen(playerPos.x + playerPos.w / 2, playerPos.y + playerPos.h / 2);
            cx = c.x;
            cy = c.y;
        }
        const p = clamp(1 - this.swingTimer / this.swingDuration, 0, 1);
        const a0 = this.swingAngle - this.arcWidth / 2;
        const a = this._swingAngle();
        const fade = p > 0.7 ? (1 - p) / 0.3 : 1;
        const R = this.range;
        const soft = this.boneBat ? '#dcffd2' : '#fff4c9';
        const edge = this.boneBat ? '#a4ff8f' : '#ffd23f';
        const prev = ctx.globalAlpha;
        // Weicher Bogen-Schweif: breit und blass, dicht hinter dem Schläger heller
        ctx.fillStyle = soft;
        ctx.globalAlpha = prev * 0.22 * fade;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 1, a0, a);
        ctx.arc(cx, cy, 21, a, a0, true);
        ctx.closePath();
        ctx.fill();
        const aNear = Math.max(a0, a - 0.6);
        ctx.globalAlpha = prev * 0.42 * fade;
        ctx.beginPath();
        ctx.arc(cx, cy, R - 1, aNear, a);
        ctx.arc(cx, cy, 28, a, aNear, true);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev * 0.9 * fade;
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, R - 1.5, Math.max(a0, a - 0.9), a);
        ctx.stroke();
        ctx.globalAlpha = prev;
        const gx = pose ? pose.gx : cx + Math.cos(a) * 8.5;
        const gy = pose ? pose.gy : cy + Math.sin(a) * 6.2;
        this._drawBat(ctx, gx, gy, a, 1);
        // Funkeln an der Schlägerspitze
        if (p > 0.2 && p < 0.75) {
            Art.sparkle(ctx, gx + Math.cos(a) * 32, gy + Math.sin(a) * 32, 4.5, '#ffffff', 0.95);
        }
    }

    // Schläger entlang ang, Griff bei (gx, gy); s = Größe.
    _drawBat(ctx, gx, gy, ang, s) {
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(ang);
        if (s !== 1) ctx.scale(s, s);
        if (this.boneBat) {
            // Knochen-Schläger: Knochenschaft mit Knubbeln an beiden Enden
            const bone = '#f5edd6';
            const o = { highlight: false, lineWidth: 1.2, outline: '#8a7a55' };
            Art.body(ctx, -3.4, -1.5, 1.9, 1.9, bone, o);
            Art.body(ctx, -3.4, 1.5, 1.9, 1.9, bone, o);
            Art.box(ctx, -3.4, -1.8, 30, 3.6, 1.8, bone, { outline: '#8a7a55' });
            Art.body(ctx, 27.4, -2.7, 3.2, 3.2, bone, { outline: '#8a7a55', lineWidth: 1.3 });
            Art.body(ctx, 27.4, 2.7, 3.2, 3.2, bone, { outline: '#8a7a55', lineWidth: 1.3 });
            Art.box(ctx, -1.8, -2, 8, 4, 1.4, '#6b4a9e', { highlight: false, lineWidth: 1 });
            ctx.strokeStyle = 'rgba(138,122,85,0.6)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(14, -1.2);
            ctx.lineTo(16, 0.2);
            ctx.lineTo(18, -0.6);
            ctx.stroke();
        } else {
            // Holzschläger: Knauf, dünner Griff mit Griffband, dickes Schlagende (ein Pfad)
            Art.shape(ctx, c => {
                c.moveTo(-3, -1.15);
                c.lineTo(8, -1.3);
                c.quadraticCurveTo(18, -2, 27.2, -3.35);
                c.arc(27.4, 0, 3.35, -Math.PI / 2, Math.PI / 2);
                c.quadraticCurveTo(18, 2, 8, 1.3);
                c.lineTo(-3, 1.15);
                c.closePath();
                c.moveTo(-1.8, 0);
                c.ellipse(-3.7, 0, 1.9, 2.1, 0, 0, TAU);
            }, { x: -5.6, y: -3.4, w: 36.4, h: 6.8 }, '#e8b36c', { outline: '#6b3f14' });
            ctx.fillStyle = '#d8323c';
            ctx.beginPath();
            ctx.roundRect(-2.8, -1.5, 9, 3, 1.3);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            for (let x = -1.2; x < 6; x += 2.2) {
                ctx.moveTo(x, -1.3);
                ctx.lineTo(x + 1.1, 1.3);
            }
            ctx.stroke();
            Art.shine(ctx, 20, -1.6, 6, 0.8, 0, 0.5);
        }
        ctx.restore();
    }
}

class BaseballLauncher {
    constructor() {
        this.name = 'Baseball-Werfer';
        this.type = 'ranged';
        this.damage = 3;
        this.cooldown = 0.3;
        this.cooldownTimer = 0;
        this.projectileSpeed = 350;
        this.poison = false;
        this.knockback = 120;
        this.tripleShot = false;
    }

    canAttack() {
        return this.cooldownTimer <= 0;
    }

    attack(angle, playerPos, projectiles) {
        if (!this.canAttack()) return false;
        this.cooldownTimer = this.cooldown;
        const cx = playerPos.x + playerPos.w / 2;
        const cy = playerPos.y + playerPos.h / 2;

        const self = this;
        function spawnBall(a) {
            const p = new Projectile(
                cx, cy,
                Math.cos(a) * self.projectileSpeed,
                Math.sin(a) * self.projectileSpeed,
                self.damage, 'player', self.knockback
            );
            if (self.poison) p.poison = true;
            if (self.shadowCaster) p.shadowCaster = true;
            if (self.gamerPistol) p.gamerPistol = true;
            projectiles.push(p);
        }

        if (this.tripleShot) {
            const p = new Projectile(
                cx, cy,
                Math.cos(angle) * self.projectileSpeed,
                Math.sin(angle) * self.projectileSpeed,
                self.damage, 'player', self.knockback
            );
            if (self.poison) p.poison = true;
            if (self.shadowCaster) p.shadowCaster = true;
            if (self.gamerPistol) p.gamerPistol = true;
            p.splitBurst = {
                delay: 0.18,
                spread: 0.18,
                done: false
            };
            projectiles.push(p);
        } else {
            spawnBall(angle);
        }
        return true;
    }

    update(dt) {
        if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
    }

    // Ball-Werfer in Marks Hand. Zielrichtung = facingAngle des Spielers; pose (optional) liefert den Griffpunkt.
    draw(ctx, camera, playerPos, pose) {
        const a = playerPos && playerPos.facingAngle !== undefined ? playerPos.facingAngle : 0;
        let gx, gy;
        if (pose && pose.gx !== undefined) {
            gx = pose.gx;
            gy = pose.gy;
        } else {
            const c = camera.worldToScreen(playerPos.x + playerPos.w / 2, playerPos.y + playerPos.h / 2);
            gx = c.x + Math.cos(a) * 8;
            gy = c.y + 2.5 + Math.sin(a) * 5;
        }
        const k = this.cooldown > 0 ? clamp(this.cooldownTimer / this.cooldown, 0, 1) : 0;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(a);
        // nach oben/unten zielen wirkt verkürzt; nach links gespiegelt, damit der Ballbehälter oben bleibt
        ctx.scale(1 - 0.24 * Math.abs(Math.sin(a)), Math.cos(a) < 0 ? -1 : 1);
        ctx.translate(-k * k * 2.6, 0);          // Rückstoß
        if (this.gamerPistol) this._drawGamer(ctx, k);
        else if (this.shadowCaster) this._drawShadowCaster(ctx, k);
        else this._drawBasic(ctx, k);
        ctx.restore();
    }

    // Standard: blauer Werfer mit orangem Mündungsring und Glaskuppel voller Bälle.
    _drawBasic(ctx, k) {
        Art.shape(ctx, c => {
            c.moveTo(-3.8, 1);
            c.lineTo(0.4, 1);
            c.lineTo(-0.6, 6.4);
            c.lineTo(-4.6, 6.4);
            c.closePath();
        }, { x: -4.6, y: 1, w: 5, h: 5.4 }, '#2c2a4a', { flat: true });
        Art.box(ctx, 7, -2.3, 8, 4.6, 1.8, '#e3e9f3', { highlight: false });
        Art.box(ctx, 13.6, -3, 2.8, 6, 1.2, '#ff9f1c', { highlight: false });
        Art.box(ctx, -6.5, -3.3, 15, 6.2, 2.8, '#2f79e6');
        ctx.fillStyle = '#ff9f1c';
        ctx.beginPath();
        ctx.roundRect(-4.5, -0.5, 10.5, 1.3, 0.6);
        ctx.fill();
        Art.body(ctx, 0.2, -4.7, 3.8, 3.1, '#c9f1ff', { glossy: true, lineWidth: 1.2, outline: '#3a6f9a' });
        ctx.fillStyle = this.poison ? '#9dff72' : '#ffffff';
        ctx.beginPath();
        ctx.arc(0.5, -4.1, 1.9, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = this.poison ? '#1f8a3a' : '#e8323c';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(-0.9, -4.1, 1.3, -0.8, 0.8);
        ctx.stroke();
        if (k > 0.55) this._muzzle(ctx, 17.6, (k - 0.55) / 0.45, this.poison ? '#7dff6a' : '#ffe27a');
    }

    // Schattenwerfer: dunkellila, Regenbogenstreifen, schimmernde Mündung.
    _drawShadowCaster(ctx, k) {
        const h = Math.floor(Art.time * 6) * 30 % 360;
        const rain = `hsl(${h},90%,62%)`;
        Art.shape(ctx, c => {
            c.moveTo(-3.8, 1);
            c.lineTo(0.4, 1);
            c.lineTo(-0.6, 6.4);
            c.lineTo(-4.6, 6.4);
            c.closePath();
        }, { x: -4.6, y: 1, w: 5, h: 5.4 }, '#1e1236');
        Art.box(ctx, 7, -2.3, 8, 4.6, 1.8, '#2a1650');
        Art.box(ctx, 13.6, -3, 2.8, 6, 1.2, rain, { highlight: false });
        Art.box(ctx, -6.5, -3.3, 15, 6.2, 2.8, '#44267e');
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = `hsl(${(h + i * 120) % 360},95%,62%)`;
            ctx.fillRect(-4.6 + i * 3.4, -0.5, 3.4, 1.3);
        }
        Art.body(ctx, 0.2, -4.7, 3.8, 3.1, '#6f52d9', { glossy: true, lineWidth: 1.2, outline: '#24104e' });
        Art.glow(ctx, 0.5, -4.2, 4, rain, 0.8);
        Art.glow(ctx, 16.5, 0, 5 + Math.sin(Art.time * 9) * 1.2, '#9b6bff', 0.45);
        if (k > 0.55) this._muzzle(ctx, 17.6, (k - 0.55) / 0.45, rain);
    }

    // Gamer-Pistole: Pixel-Optik mit Neonkanten (nur Rechtecke, flach).
    _drawGamer(ctx, k) {
        const neon = '#2cf5ff';
        const pink = '#ff3df2';
        ctx.fillStyle = '#161a36';
        ctx.fillRect(-6, -3, 15, 6);
        ctx.fillRect(9, -2, 7, 4);
        ctx.fillRect(-4, 3, 4, 4);
        ctx.strokeStyle = '#0a0c1f';
        ctx.lineWidth = 0.9;
        ctx.strokeRect(-6, -3, 15, 6);
        ctx.strokeRect(9, -2, 7, 4);
        ctx.strokeRect(-4, 3, 4, 4);
        ctx.fillStyle = neon;
        ctx.fillRect(-6, -3, 15, 1);
        ctx.fillRect(9, -2, 7, 1);
        ctx.fillRect(16, -1.5, 2, 3);
        ctx.fillStyle = pink;
        ctx.fillRect(-6, 2, 15, 1);
        ctx.fillRect(-4, 3, 1, 4);
        const on = Math.floor(Art.time * 8) % 3;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = i === on ? '#ffffff' : neon;
            ctx.fillRect(-3.8 + i * 2.4, -1.1, 1.6, 1.6);
        }
        Art.glow(ctx, 17.5, 0, 4 + k * 7, neon, 0.35 + k * 0.6);
        if (k > 0.55) this._muzzle(ctx, 18.5, (k - 0.55) / 0.45, neon);
    }

    // Mündungsblitz direkt nach dem Wurf.
    _muzzle(ctx, x, s, color) {
        Art.glow(ctx, x, 0, 4 + s * 6, color, 0.9 * s);
        Art.sparkle(ctx, x + 1, 0, 2 + s * 4, '#ffffff', s);
    }
}

class Projectile {
    constructor(x, y, vx, vy, damage, owner, knockback) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.owner = owner;
        this.knockback = knockback || 100;
        this.radius = 5;
        this.dead = false;
        this.lifetime = 3;
        this.age = 0;
        this.bouncesLeft = owner === 'player' ? 2 : 0;
        this.splitBurst = null;
    }

    update(dt, world) {
        this.age += dt;
        if (this.owner === 'player' && this.splitBurst && !this.splitBurst.done && this.age >= this.splitBurst.delay) {
            this.splitBurst.done = true;
            if (typeof Game !== 'undefined') {
                const baseAngle = Math.atan2(this.vy, this.vx);
                const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                for (let i = -1; i <= 1; i++) {
                    const a = baseAngle + i * this.splitBurst.spread;
                    const p = new Projectile(this.x, this.y, Math.cos(a) * speed, Math.sin(a) * speed, this.damage, this.owner, this.knockback);
                    p.poison = this.poison;
                    p.shadowCaster = this.shadowCaster;
                    p.gamerPistol = this.gamerPistol;
                    p.bouncesLeft = this.bouncesLeft;
                    Game.projectiles.push(p);
                }
            }
            this.dead = true;
            return;
        }
        const newX = this.x + this.vx * dt;
        const newY = this.y + this.vy * dt;
        this.lifetime -= dt;
        if (this.lifetime <= 0) { this.dead = true; return; }

        if (world.isWall(newX, newY)) {
            if (this.bouncesLeft > 0) {
                this.bouncesLeft--;
                // Determine bounce direction
                const wallX = world.isWall(newX, this.y);
                const wallY = world.isWall(this.x, newY);
                if (wallX) this.vx = -this.vx;
                if (wallY) this.vy = -this.vy;
                if (!wallX && !wallY) { this.vx = -this.vx; this.vy = -this.vy; }
            } else {
                this.dead = true;
            }
        } else {
            this.x = newX;
            this.y = newY;
        }
    }

    // Aussehen nach Besitzer und Merkmalen. Spieler: Baseball (poison grün, shadowCaster Regenbogen,
    // gamerPistol Pixel-Strahl), Begleiter: fruit, venom, crocSpit. Gegner: Energiekugel
    // (isIce/slow eisblau, poison giftgrün, explosive Feuer, optional eigene Farbe über p.color).
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x;
        const y = pos.y;
        const r = this.radius || 5;
        const sp = Math.hypot(this.vx, this.vy);
        const dx = sp > 1 ? this.vx / sp : 1;
        const dy = sp > 1 ? this.vy / sp : 0;
        const age = this.age || 0;
        const t = Art.time;
        if (this.owner === 'player') {
            if (this.gamerPistol) {
                // blauer Pixel-Strahl
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.atan2(dy, dx));
                Art.glow(ctx, -r * 0.5, 0, r * 3.2, '#3d8bff', 0.75);
                ctx.fillStyle = 'rgba(61,139,255,0.4)';
                ctx.fillRect(-r * 3.6, -r * 0.35, r * 1.4, r * 0.7);
                ctx.fillStyle = 'rgba(61,139,255,0.7)';
                ctx.fillRect(-r * 2.1, -r * 0.5, r * 1.2, r);
                ctx.fillStyle = '#3d8bff';
                ctx.fillRect(-r * 0.9, -r * 0.75, r * 2.4, r * 1.5);
                ctx.fillStyle = '#e6fbff';
                ctx.fillRect(-r * 0.5, -r * 0.35, r * 1.8, r * 0.7);
                ctx.restore();
                return;
            }
            if (this.shadowCaster) {
                // Regenbogen-Ball mit bunter Spur
                const h0 = Math.floor(age * 10) * 36;
                const prev = ctx.globalAlpha;
                for (let i = 3; i >= 1; i--) {
                    ctx.globalAlpha = prev * (0.5 - i * 0.12);
                    ctx.fillStyle = `hsl(${(h0 - i * 40 + 3600) % 360},95%,65%)`;
                    ctx.beginPath();
                    ctx.arc(x - dx * i * r * 1.1, y - dy * i * r * 1.1, r * (1 - i * 0.18), 0, TAU);
                    ctx.fill();
                }
                ctx.globalAlpha = prev;
                const col = `hsl(${h0 % 360},95%,62%)`;
                Art.glow(ctx, x, y, r * 2.8, col, 0.65);
                Art.body(ctx, x, y, r, r, col, { glossy: true });
                return;
            }
            if (this.fruit) {
                // Obst vom Krokodil (dreht sich im Flug)
                if (this.explosive) Art.glow(ctx, x, y, r * 3.4, '#ff7a1f', 0.6);
                this._streak(ctx, x, y, dx, dy, r * 0.8, r * 2.6, '#fff0c9', 0.4);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(age * 9);
                const kind = this.fruitKind || 0;
                if (kind === 1) {
                    // Orange
                    Art.body(ctx, 0, 0, r * 1.05, r * 1.05, '#ff9a1f', { glossy: true });
                    ctx.fillStyle = '#4fbf3a';
                    ctx.beginPath();
                    ctx.ellipse(r * 0.35, -r * 0.95, r * 0.45, r * 0.22, -0.5, 0, TAU);
                    ctx.fill();
                } else if (kind === 2) {
                    // Melonenstück
                    Art.shape(ctx, c => {
                        c.moveTo(-r * 1.25, -r * 0.45);
                        c.quadraticCurveTo(0, r * 1.7, r * 1.25, -r * 0.45);
                        c.closePath();
                    }, { x: -r * 1.25, y: -r * 0.45, w: r * 2.5, h: r * 1.6 }, '#ff4d6d', { outline: '#1f7a3a', lineWidth: r * 0.34 });
                    ctx.fillStyle = '#2a1a14';
                    ctx.beginPath();
                    ctx.ellipse(-r * 0.45, 0, r * 0.14, r * 0.22, 0.3, 0, TAU);
                    ctx.ellipse(r * 0.45, 0, r * 0.14, r * 0.22, -0.3, 0, TAU);
                    ctx.ellipse(0, r * 0.42, r * 0.14, r * 0.22, 0, 0, TAU);
                    ctx.fill();
                } else {
                    // Apfel
                    Art.body(ctx, 0, r * 0.15, r * 1.05, r, '#ff3b4e', { glossy: true });
                    ctx.strokeStyle = '#6b3f14';
                    ctx.lineWidth = Math.max(0.8, r * 0.18);
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, -r * 0.7);
                    ctx.lineTo(r * 0.2, -r * 1.3);
                    ctx.stroke();
                    ctx.fillStyle = '#4fbf3a';
                    ctx.beginPath();
                    ctx.ellipse(r * 0.55, -r * 1.05, r * 0.42, r * 0.2, -0.4, 0, TAU);
                    ctx.fill();
                }
                ctx.restore();
                return;
            }
            if (this.explosive) {
                this._fireball(ctx, x, y, r, dx, dy, t, age);
                return;
            }
            if (this.venom) {
                // Gifttropfen der Schlange
                this._streak(ctx, x, y, dx, dy, r * 0.75, r * 3, '#9dff72', 0.45);
                Art.glow(ctx, x, y, r * 3, '#6bff4a', 0.6);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.atan2(dy, dx));
                Art.shape(ctx, c => {
                    c.moveTo(-r * 1.9, 0);
                    c.quadraticCurveTo(-r * 0.7, -r * 1.05, 0, -r);
                    c.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
                    c.quadraticCurveTo(-r * 0.7, r * 1.05, -r * 1.9, 0);
                    c.closePath();
                }, { x: -r * 1.9, y: -r, w: r * 2.9, h: r * 2 }, '#5fe84a', { glossy: true, outline: '#1f7a2a' });
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.beginPath();
                ctx.arc(r * 0.1, -r * 0.35, r * 0.3, 0, TAU);
                ctx.fill();
                ctx.restore();
                return;
            }
            if (this.crocSpit) {
                // Schattenkugel des Krokodils
                this._streak(ctx, x, y, dx, dy, r * 0.9, r * 3, '#b28cff', 0.45);
                Art.glow(ctx, x, y, r * 3.2, '#8a5cff', 0.7);
                Art.body(ctx, x, y, r * 1.05, r * 1.05, '#6a3fd6', { glossy: true, outline: '#2b1466' });
                ctx.fillStyle = '#b8ff9a';
                ctx.beginPath();
                ctx.arc(x + r * 0.15, y + r * 0.1, r * 0.35, 0, TAU);
                ctx.fill();
                return;
            }
            // Baseball (Gift-Bälle grün) mit mitrollenden Nähten
            const poison = !!this.poison;
            this._streak(ctx, x, y, dx, dy, r * 0.85, r * 2.8, poison ? '#9dff72' : '#ffffff', 0.38);
            Art.glow(ctx, x, y, r * 2.6, poison ? '#5dff3a' : '#fff2c0', poison ? 0.6 : 0.45);
            Art.body(ctx, x, y, r, r, poison ? '#a8ff7e' : '#ffffff', { glossy: true, outline: poison ? '#2a7a30' : '#8e9ab8' });
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(age * 14);
            ctx.strokeStyle = poison ? '#1f7a3a' : '#e8323c';
            ctx.lineWidth = Math.max(0.7, r * 0.16);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(-r * 0.95, 0, r * 0.62, -0.95, 0.95);
            ctx.moveTo(r * 0.95 + r * 0.62 * Math.cos(Math.PI - 0.95), r * 0.62 * Math.sin(Math.PI - 0.95));
            ctx.arc(r * 0.95, 0, r * 0.62, Math.PI - 0.95, Math.PI + 0.95);
            ctx.stroke();
            ctx.restore();
            return;
        }
        // ── Gegner-Geschosse ──
        if (this.shape && this._drawShape(ctx, x, y, r, dx, dy, age)) return;
        if (this.isIce || this.slow) {
            // eisblau mit Kristall
            this._streak(ctx, x, y, dx, dy, r * 0.85, r * 2.8, '#c9f2ff', 0.45);
            Art.glow(ctx, x, y, r * 3, '#6fd6ff', 0.7);
            Art.body(ctx, x, y, r, r, '#9fe6ff', { glossy: true, outline: '#2a6f9e' });
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(age * 3);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.7, r * 0.18);
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const a = i * Math.PI / 3;
                ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
                ctx.lineTo(-Math.cos(a) * r * 0.72, -Math.sin(a) * r * 0.72);
            }
            ctx.stroke();
            ctx.restore();
            return;
        }
        if (this.poison) {
            // giftgrüner Tropfen mit Bläschen
            this._streak(ctx, x, y, dx, dy, r * 0.8, r * 2.8, '#b6ff5a', 0.45);
            Art.glow(ctx, x, y, r * 3, '#7dff3a', 0.7);
            Art.body(ctx, x, y, r, r, '#8cff4a', { glossy: true, outline: '#2f7a12' });
            ctx.fillStyle = 'rgba(230,255,200,0.85)';
            ctx.beginPath();
            ctx.arc(x + r * 0.3, y + r * 0.25, r * 0.22, 0, TAU);
            ctx.moveTo(x - r * 0.05 + r * 0.14, y + r * 0.5);
            ctx.arc(x - r * 0.05, y + r * 0.5, r * 0.14, 0, TAU);
            ctx.fill();
            return;
        }
        if (this.explosive) {
            this._fireball(ctx, x, y, r, dx, dy, t, age);
            return;
        }
        // rot-orange Energiekugel (oder eigene Farbe)
        const col = this.color || '#ff4a2a';
        const pulse = 1 + Math.sin(t * 18 + age * 7) * 0.08;
        this._streak(ctx, x, y, dx, dy, r * 0.8, r * 2.6, this.color ? Art.light(col, 0.3) : '#ff8a3d', 0.45);
        Art.glow(ctx, x, y, r * 3.2 * pulse, col, 0.8);
        Art.body(ctx, x, y, r * pulse, r * pulse, this.color ? col : '#ff5a2e', { glossy: true, highlight: false });
        ctx.fillStyle = this.color ? Art.light(col, 0.65) : '#fff0b0';
        ctx.beginPath();
        ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.52, 0, TAU);
        ctx.fill();
    }

    // Besondere Gegner-Geschosse (Hinweis p.shape). Liefert false, wenn die Form unbekannt ist.
    _drawShape(ctx, x, y, r, dx, dy, age) {
        const s = this.shape;
        const col = this.color;
        const ang = Math.atan2(dy, dx);
        if (s === 'arrow') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            Art.limb(ctx, -r * 2.6, 0, r * 1.2, 0, Math.max(1.2, r * 0.32), '#c98a4b', { lineWidth: 1 });
            Art.shape(ctx, c => {
                c.moveTo(r * 2.1, 0);
                c.lineTo(r * 0.9, -r * 0.7);
                c.lineTo(r * 0.9, r * 0.7);
                c.closePath();
            }, { x: r * 0.9, y: -r * 0.7, w: r * 1.2, h: r * 1.4 }, col || '#d9dee8', { lineWidth: 1 });
            ctx.fillStyle = col ? Art.light(col, 0.2) : '#ff6b6b';
            ctx.beginPath();
            ctx.moveTo(-r * 2.6, 0);
            ctx.lineTo(-r * 3.4, -r * 0.8);
            ctx.lineTo(-r * 2.0, 0);
            ctx.lineTo(-r * 3.4, r * 0.8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            return true;
        }
        if (s === 'boomerang') {
            Art.glow(ctx, x, y, r * 2.6, col || '#fff2c0', 0.35);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(age * 16);
            const c1 = col || '#f3e3c3';
            Art.limb(ctx, 0, 0, r * 1.9, -r * 0.4, r * 0.75, c1, { lineWidth: 1.2 });
            Art.limb(ctx, 0, 0, -r * 0.4, r * 1.9, r * 0.75, c1, { lineWidth: 1.2 });
            ctx.restore();
            return true;
        }
        if (s === 'fruit') {
            this._streak(ctx, x, y, dx, dy, r * 0.8, r * 2.4, '#ffe0e6', 0.35);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(age * 8);
            Art.body(ctx, 0, r * 0.1, r * 1.05, r, col || '#ff3b4e', { glossy: true });
            ctx.fillStyle = '#4fbf3a';
            ctx.beginPath();
            ctx.ellipse(r * 0.5, -r * 0.95, r * 0.42, r * 0.2, -0.4, 0, TAU);
            ctx.fill();
            ctx.restore();
            return true;
        }
        if (s === 'seed') {
            Art.glow(ctx, x, y, r * 2.4, '#9dff5a', 0.4);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            Art.body(ctx, 0, 0, r * 1.2, r * 0.75, col || '#a8743a', { glossy: true, lineWidth: 1 });
            ctx.restore();
            return true;
        }
        if (s === 'pixel') {
            const c1 = col || '#39f0ff';
            Art.glow(ctx, x, y, r * 3, c1, 0.6);
            const q = Math.max(1.5, r * 0.8);
            ctx.fillStyle = Art.dark(c1, 0.35);
            ctx.fillRect(Math.round(x - q * 1.25), Math.round(y - q * 1.25), q * 2.5, q * 2.5);
            ctx.fillStyle = c1;
            ctx.fillRect(Math.round(x - q), Math.round(y - q), q * 2, q * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(Math.round(x - q), Math.round(y - q), q * 0.8, q * 0.8);
            return true;
        }
        // 'orb' und 'poison' zeichnen die normalen Zweige (Energiekugel bzw. Gifttropfen)
        return false;
    }

    // Kurzer, spitz zulaufender Schweif hinter dem Geschoss.
    _streak(ctx, x, y, dx, dy, w, len, color, a) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * a;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - dy * w, y + dx * w);
        ctx.lineTo(x - dx * len, y - dy * len);
        ctx.lineTo(x + dy * w, y - dx * w);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev;
    }

    // Feuerkugel mit flackerndem Flammenschweif.
    _fireball(ctx, x, y, r, dx, dy, t, age) {
        const fl = Math.sin(t * 40 + age * 13) * 0.2;
        const px = -dy, py = dx;
        Art.glow(ctx, x, y, r * 3.6, '#ff6a1f', 0.75);
        const L = r * (3.2 + fl * 3);
        ctx.fillStyle = '#ff7a1f';
        ctx.beginPath();
        ctx.moveTo(x + px * r, y + py * r);
        ctx.quadraticCurveTo(x - dx * L * 0.5 + px * r * 0.9, y - dy * L * 0.5 + py * r * 0.9, x - dx * L, y - dy * L);
        ctx.quadraticCurveTo(x - dx * L * 0.5 - px * r * 0.9, y - dy * L * 0.5 - py * r * 0.9, x - px * r, y - py * r);
        ctx.closePath();
        ctx.fill();
        const L2 = L * 0.6;
        ctx.fillStyle = '#ffc23d';
        ctx.beginPath();
        ctx.moveTo(x + px * r * 0.6, y + py * r * 0.6);
        ctx.quadraticCurveTo(x - dx * L2 * 0.5 + px * r * 0.5, y - dy * L2 * 0.5 + py * r * 0.5, x - dx * L2, y - dy * L2);
        ctx.quadraticCurveTo(x - dx * L2 * 0.5 - px * r * 0.5, y - dy * L2 * 0.5 - py * r * 0.5, x - px * r * 0.6, y - py * r * 0.6);
        ctx.closePath();
        ctx.fill();
        Art.body(ctx, x, y, r * 1.05, r * 1.05, '#ff8a1f', { glossy: true, highlight: false, outline: '#b3260d' });
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.5, 0, TAU);
        ctx.fill();
    }
}
