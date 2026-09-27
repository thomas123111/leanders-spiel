// ── Welten 13–15 (Knochen-Tal, Gift-Sumpf, Steinwelt) ──
// Gemeinsame Helfer (Kit915) stehen am Ende von entities.js.

// ══════════════════════════════════════════
// ── Welt 13: Knochen-Tal ──
// ══════════════════════════════════════════

const BONE915 = '#fff4dc';

// Totenkopf mit Glutaugen (für Bogenschütze und Bumerang-Skelett).
function drawSkull915(ctx, x, y, r, eyeColor, look, dying, grin) {
    Art.body(ctx, x, y, r, r * 0.92, BONE915, { glossy: true, lineWidth: 1.5 });
    Art.box(ctx, x - r * 0.52, y + r * 0.5, r * 1.04, r * 0.5, r * 0.22, BONE915, { highlight: false, lineWidth: 1.3 });
    const lx = look ? look.x * r * 0.12 : 0;
    const ly = look ? look.y * r * 0.08 : 0;
    ctx.fillStyle = '#3a1d4a';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38 + lx, y - r * 0.05 + ly, r * 0.3, r * 0.34, 0, 0, TAU);
    ctx.ellipse(x + r * 0.38 + lx, y - r * 0.05 + ly, r * 0.3, r * 0.34, 0, 0, TAU);
    ctx.moveTo(x + lx, y + r * 0.26);
    ctx.lineTo(x - r * 0.1 + lx, y + r * 0.42);
    ctx.lineTo(x + r * 0.1 + lx, y + r * 0.42);
    ctx.fill();
    if (dying) {
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = Math.max(1, r * 0.13);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const s of [-1, 1]) {
            const ex = x + s * r * 0.38;
            const d = r * 0.16;
            ctx.moveTo(ex - d, y - d);
            ctx.lineTo(ex + d, y + d);
            ctx.moveTo(ex + d, y - d);
            ctx.lineTo(ex - d, y + d);
        }
        ctx.stroke();
    } else {
        Art.glow(ctx, x + lx, y + ly, r * 1.4, eyeColor, 0.45);
        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        Kit915.dot(ctx, x - r * 0.36 + lx * 1.6, y + ly * 1.6, r * 0.13);
        Kit915.dot(ctx, x + r * 0.4 + lx * 1.6, y + ly * 1.6, r * 0.13);
        ctx.fill();
    }
    // Zähne
    ctx.strokeStyle = '#8a6a9a';
    ctx.lineWidth = Math.max(0.7, r * 0.08);
    ctx.beginPath();
    const ty = y + r * 0.62;
    for (let i = -1; i <= 1; i++) {
        ctx.moveTo(x + i * r * 0.26, ty);
        ctx.lineTo(x + i * r * 0.26, ty + r * (grin ? 0.34 : 0.28));
    }
    ctx.stroke();
}

// Skelett-Bogenschütze: niedliches Skelett mit bunter Kapuze. Spannt sichtbar den Bogen, bevor es schießt.
class SkeletonArcher extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 24);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 35;
        this.damage = 1;
        this.detectionRange = 220;
        this.shootTimer = 0.6; // auch der erste Pfeil kommt mit Vorwarnung
        this.shootCooldown = 2;
        this.aim = 0;
        this.active = false;
        this.moving = false;
        this.look = { x: 1, y: 0 };
        this.seed = Math.random() * 10;
        this.hood = SkeletonArcher.HOODS[randInt(0, SkeletonArcher.HOODS.length - 1)];
        this.fxColor = '#fff1d6';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.active = dist < this.detectionRange;
        this.moving = false;
        if (!this.active) {
            this.shootTimer = Math.max(this.shootTimer, 0.55);
            return;
        }
        this.aim = Math.atan2(dy, dx);
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        if (dist > 100) {
            this._moveWithCollision((dx / dist) * this.speed * dt, (dy / dist) * this.speed * dt, world);
            this.moving = true;
        }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            Kit915.shoot(mx, my, (dx / dist) * 170, (dy / dist) * 170, 1, 50, '#fff1d6', 'arrow');
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
        const step = this.moving ? Math.sin(t * 11) : 0;
        const by = cy + (this.moving ? -Math.abs(step) * 1.2 : Math.sin(t * 2.5) * 0.5);
        const f = Math.cos(this.aim) < 0 ? -1 : 1;
        const pull = this.active && !dying ? clamp(1 - this.shootTimer / 0.55, 0, 1) : 0;
        // Köcher mit bunten Federn
        ctx.save();
        ctx.translate(cx - f * 6, by - 2);
        ctx.rotate(f * 0.5);
        Art.box(ctx, -2.6, -6, 5.2, 11, 2, '#ff9f43', { lineWidth: 1.2, highlight: false });
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(-2.4, -9, 1.6, 3.4);
        ctx.fillStyle = '#39d5ff';
        ctx.fillRect(0.8, -8.5, 1.6, 3);
        ctx.restore();
        // Beine
        Art.limb(ctx, cx - 3, by + 5, cx - 3 - step * 2, cy + 11.5, 2.4, BONE915, { lineWidth: 1.2 });
        Art.limb(ctx, cx + 3, by + 5, cx + 3 + step * 2, cy + 11.5, 2.4, BONE915, { lineWidth: 1.2 });
        // Rippen unter dem Umhang
        Art.body(ctx, cx, by + 2, 5.5, 5, BONE915, { highlight: false, lineWidth: 1.2 });
        // Kapuzenumhang
        Art.shape(ctx, c => {
            c.moveTo(cx - 9, by - 8);
            c.quadraticCurveTo(cx - 11, by + 2, cx - 9, by + 7);
            c.lineTo(cx - 4.5, by + 4);
            c.lineTo(cx - 5, by - 3);
            c.lineTo(cx + 5, by - 3);
            c.lineTo(cx + 4.5, by + 4);
            c.lineTo(cx + 9, by + 7);
            c.quadraticCurveTo(cx + 11, by + 2, cx + 9, by - 8);
            c.closePath();
        }, { x: cx - 11, y: by - 8, w: 22, h: 15 }, this.hood, { lineWidth: 1.3 });
        // Kapuze hinter dem Kopf, Totenkopf, Kapuzenrand
        Art.body(ctx, cx, by - 8, 10, 9.5, this.hood, { highlight: false, lineWidth: 1.4 });
        drawSkull915(ctx, cx, by - 8, 7.4, '#6cf0ff', this.look, dying, false);
        ctx.strokeStyle = Art.light(this.hood, 0.25);
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, by - 8, 8.6, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
        // Bogen mit Arm (seitlich vor dem Körper)
        const hx = cx + f * 7;
        const hy = by + 1;
        const ca = Math.cos(this.aim);
        const sa = Math.sin(this.aim);
        Art.limb(ctx, cx + f * 4, by - 3, hx + ca * 6, hy + sa * 6, 2.2, BONE915, { lineWidth: 1.1 });
        this._drawBow(ctx, hx, hy, pull);
    }

    _drawBow(ctx, hx, hy, pull) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(this.aim);
        const r = 10;
        ctx.lineCap = 'round';
        ctx.strokeStyle = Art.ink('#ff6b3d');
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.arc(-4, 0, r, -1.15, 1.15);
        ctx.stroke();
        ctx.strokeStyle = '#ff6b3d';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(-4, 0, r, -1.15, 1.15);
        ctx.stroke();
        const ex = -4 + Math.cos(1.15) * r;
        const ey = Math.sin(1.15) * r;
        const sx = ex - pull * 7;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(ex, -ey);
        ctx.lineTo(sx, 0);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (pull > 0) {
            // eingelegter Pfeil
            Art.limb(ctx, sx, 0, sx + 16, 0, 1.3, '#ffd9a0', { lineWidth: 0.8 });
            ctx.fillStyle = '#bff6ff';
            ctx.beginPath();
            ctx.moveTo(sx + 19.5, 0);
            ctx.lineTo(sx + 15, -2.4);
            ctx.lineTo(sx + 15, 2.4);
            ctx.fill();
            ctx.fillStyle = '#ff4d6d';
            ctx.beginPath();
            ctx.moveTo(sx + 3, 0);
            ctx.lineTo(sx - 1, -2.6);
            ctx.lineTo(sx + 1, 0);
            ctx.lineTo(sx - 1, 2.6);
            ctx.fill();
            if (pull > 0.7) Art.sparkle(ctx, sx + 19, 0, 2.5 + Math.sin(Art.time * 30), '#ffffff');
        }
        Art.body(ctx, -4 + r, 0, 2.2, 2.2, BONE915, { highlight: false, lineWidth: 1 });
        ctx.restore();
    }
}
SkeletonArcher.HOODS = ['#3ecf6e', '#3fa9ff', '#ff8a3d', '#b36bff'];

// Bumerang-Skelett (Schlüsselträger): lässiges Skelett mit Kopftuch und goldenem Schlüssel an der Kette.
class BoomerangSkeleton extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 30;
        this.damage = 2;
        this.detectionRange = 200;
        this.throwTimer = 0.6; // auch der erste Wurf kommt mit Vorwarnung
        this.throwCooldown = 3;
        this.isKeyGhost = true;
        this.droppedKey = false;
        this.aim = 0;
        this.active = false;
        this.moving = false;
        this.look = { x: 1, y: 0 };
        this.seed = Math.random() * 10;
        this.fxColor = '#ffb02e';
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.active = dist < this.detectionRange;
        this.moving = false;
        if (!this.active) {
            this.throwTimer = Math.max(this.throwTimer, 0.5);
            return;
        }
        this.aim = Math.atan2(dy, dx);
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this._moveWithCollision((dx / dist) * this.speed * dt, (dy / dist) * this.speed * dt, world);
        this.moving = true;
        this.throwTimer -= dt;
        if (this.throwTimer <= 0) {
            this.throwTimer = this.throwCooldown;
            const p = Kit915.shoot(mx, my, (dx / dist) * 140, (dy / dist) * 140, 2, 80, '#ff8a2b', 'boomerang');
            if (p) {
                p.bouncesLeft = 2;
                p.lifetime = 4;
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
        this._drawBody(ctx, cx, cy, false);
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const f = Math.cos(this.aim) < 0 ? -1 : 1;
        const step = this.moving ? Math.sin(t * 9) : 0;
        const by = cy + (this.moving ? -Math.abs(step) * 1.3 : Math.sin(t * 2.2) * 0.6);
        const wind = this.active && !dying ? clamp(1 - this.throwTimer / 0.45, 0, 1) : 0;
        const empty = this.active && !dying && this.throwTimer > this.throwCooldown - 1.2;
        Art.glow(ctx, cx, cy, 26, '#ffd23f', 0.22 + 0.06 * Math.sin(t * 3));
        // Kopftuch-Zipfel wehen hinter dem Kopf
        const flap = Math.sin(t * 8) * 2;
        Art.shape(ctx, c => {
            c.moveTo(cx - f * 7, by - 13);
            c.lineTo(cx - f * 16, by - 15 + flap);
            c.lineTo(cx - f * 14, by - 11);
            c.lineTo(cx - f * 17, by - 8 - flap);
            c.lineTo(cx - f * 7, by - 9);
            c.closePath();
        }, { x: cx - 17, y: by - 16, w: 34, h: 9 }, '#ff4d5e', { lineWidth: 1.2 });
        // Beine
        Art.limb(ctx, cx - 3.5, by + 6, cx - 3.5 - step * 2.2, cy + 12.5, 2.8, BONE915, { lineWidth: 1.2 });
        Art.limb(ctx, cx + 3.5, by + 6, cx + 3.5 + step * 2.2, cy + 12.5, 2.8, BONE915, { lineWidth: 1.2 });
        // Rumpf: Rippen und Hose
        Art.box(ctx, cx - 6, by + 3, 12, 5, 2, '#2fc4b2', { lineWidth: 1.3, highlight: false });
        Art.body(ctx, cx, by - 0.5, 6.5, 5.5, BONE915, { highlight: false, lineWidth: 1.3 });
        ctx.strokeStyle = '#8a6a9a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, by - 5);
        ctx.lineTo(cx, by + 4);
        ctx.moveTo(cx - 4.5, by - 2);
        ctx.quadraticCurveTo(cx, by - 0.5, cx + 4.5, by - 2);
        ctx.moveTo(cx - 4, by + 1);
        ctx.quadraticCurveTo(cx, by + 2.5, cx + 4, by + 1);
        ctx.stroke();
        // Freier Arm
        Art.limb(ctx, cx - f * 5, by - 3, cx - f * 9, by + 4 + step, 2.4, BONE915, { lineWidth: 1.1 });
        // Goldener Schlüssel an der Kette (Schlüsselträger)
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 4, by - 5);
        ctx.quadraticCurveTo(cx, by, cx + 4, by - 5);
        ctx.stroke();
        Art.glow(ctx, cx, by + 1, 9, '#ffd23f', 0.6);
        ctx.save();
        ctx.translate(cx, by);
        ctx.rotate(Math.PI / 2 + Math.sin(t * 3) * 0.2);
        Art.key(ctx, 0, 0, 4.2, '#ffd23f');
        ctx.restore();
        // Kopf mit Kopftuch
        drawSkull915(ctx, cx, by - 11, 9, '#7dff6a', this.look, dying, true);
        Art.shape(ctx, c => {
            c.moveTo(cx - 9, by - 13);
            c.quadraticCurveTo(cx, by - 25, cx + 9, by - 13);
            c.quadraticCurveTo(cx, by - 16, cx - 9, by - 13);
            c.closePath();
        }, { x: cx - 9, y: by - 21, w: 18, h: 8 }, '#ff4d5e', { lineWidth: 1.3 });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        Kit915.dot(ctx, cx - 3, by - 17, 0.9);
        Kit915.dot(ctx, cx + 2.5, by - 18, 0.9);
        Kit915.dot(ctx, cx + 6, by - 15.5, 0.8);
        ctx.fill();
        // Wurfarm mit Bumerang
        let hx;
        let hy;
        let spin;
        if (wind > 0) {
            hx = cx - f * (4 + wind * 5);
            hy = by - 12 - wind * 5;
            spin = Art.time * 22;
        } else {
            hx = cx + f * 10;
            hy = by + 1 + step;
            spin = f * 0.4;
        }
        Art.limb(ctx, cx + f * 5, by - 3, hx, hy, 2.4, BONE915, { lineWidth: 1.1 });
        if (!empty) {
            if (wind > 0) Art.glow(ctx, hx, hy, 12 + wind * 6, '#ff8a2b', 0.4 + wind * 0.4);
            BoomerangSkeleton.drawBoomerang(ctx, hx, hy, spin, 1);
        }
        Art.body(ctx, hx, hy, 2.2, 2.2, BONE915, { highlight: false, lineWidth: 1 });
    }

    static drawBoomerang(ctx, x, y, rot, s) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.scale(s, s);
        Art.shape(ctx, c => {
            c.moveTo(-10, 3);
            c.quadraticCurveTo(0, -9, 10, 3);
            c.lineTo(7.5, 5.5);
            c.quadraticCurveTo(0, -3, -7.5, 5.5);
            c.closePath();
        }, { x: -10, y: -6, w: 20, h: 12 }, '#ff8a2b', { lineWidth: 1.4 });
        ctx.strokeStyle = '#ffe14a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-8, 3);
        ctx.quadraticCurveTo(0, -5.5, 8, 3);
        ctx.stroke();
        ctx.restore();
    }
}

// W13-Boss: KNOCHEN-REITER – Skelett-Ritter mit Lanze auf einem Knochen-Ross mit Geisterfeuer-Mähne.
// Bäumt sich vor dem Ansturm auf (Warnbahn am Boden); prallt er gegen die Wand, ist er kurz benommen (G-03).
class BossSkeletonRider extends Enemy {
    constructor(x, y) {
        super(x, y, 100, 80);
        this.hp = 60;
        this.maxHp = 60;
        this.speed = 35;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stunnedTimer = 0;
        this.chargeTimer = 4;
        this.charging = false;
        this.chargeDir = { x: 1, y: 0 };
        this.chargeProgress = 0;
        this.phase = 1;
        this.windT = 0;
        this.windMax = 0.8;
        this.lane = 200;
        this.bonk = false;
        this.dustT = 0;
        this.face = 1;
        this.moving = false;
        this.look = { x: 0, y: 1 };
        this.seed = Math.random() * 10;
        this.fxColor = '#8fe8ff';
        this.shadow = { rx: 48, ry: 13, dy: 38 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 30 && this.phase === 1) {
            this.phase = 2;
            this.speed = 50;
            this.chargeTimer = 0.5;
            Kit915.burst(this.centerX(), this.centerY(), ['#ff5ad1', '#ffffff', '#fff4dc'], 18, 200, 0.7);
            Kit915.shake(6, 0.4);
        }
        const mx = this.centerX();
        const my = this.centerY();
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dx = px - mx;
        const dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.moving = false;
        this.charging = this.state === 'charge';
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) {
                this.state = 'chase';
                this.bonk = false;
            }
            return;
        }
        if (this.state === 'windup') {
            this.windT -= dt;
            // In der ersten Hälfte zielt er noch, danach steht die Richtung fest
            if (this.windT > this.windMax * 0.5) this._aim(dx / dist, dy / dist, world);
            if (this.windT <= 0) {
                this.state = 'charge';
                this.charging = true;
                this.chargeProgress = 0;
                Kit915.shake(3, 0.2);
            }
            return;
        }
        if (this.state === 'charge') {
            this.chargeProgress += dt;
            const hitWall = Kit915.rush(this, this.chargeDir.x * 300 * dt, this.chargeDir.y * 300 * dt, world);
            const c = this.center();
            if (Math.hypot(px - c.x, py - c.y) < 60) {
                const before = player.hp;
                Kit915.hurt(player, 3, Math.atan2(py - c.y, px - c.x), 300);
                if (player.hp < before) Kit915.burst(px, py, ['#fff4dc', '#ffffff'], 6, 120, 0.4);
            }
            this.dustT -= dt;
            if (this.dustT <= 0) {
                this.dustT = 0.07;
                Kit915.burst(c.x - this.chargeDir.x * 40, this.y + this.h - 4, 'rgba(235,225,255,0.9)', 2, 50, 0.45, { kind: 'smoke', size: 4 });
            }
            if (hitWall) {
                // gegen die Wand gerannt: benommen
                this.state = 'stunned';
                this.stunnedTimer = 2.5;
                this.bonk = true;
                this.charging = false;
                Kit915.shake(9, 0.4);
                const fx = c.x + this.chargeDir.x * 50;
                const fy = c.y + this.chargeDir.y * 40;
                Kit915.burst(fx, fy, ['#fff4dc', '#ffd23f', '#ffffff'], 14, 170, 0.6, { kind: 'star' });
                Kit915.ring(fx, fy, '#ffffff', 50, 0.4, 4);
            } else if (this.chargeProgress > 1) {
                this.state = 'stunned';
                this.stunnedTimer = 2.5;
                this.charging = false;
            }
            return;
        }
        if (Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.moving = true;
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) {
            // Aufbäumen zählt zur alten Pause – der Rhythmus bleibt wie bisher
            this.windMax = this.phase === 1 ? 0.8 : 0.6;
            this.chargeTimer = (this.phase === 1 ? 4 : 2.5) - this.windMax;
            this.windT = this.windMax;
            this.state = 'windup';
            this._aim(dx / dist, dy / dist, world);
        }
    }

    _aim(nx, ny, world) {
        this.chargeDir.x = nx;
        this.chargeDir.y = ny;
        if (Math.abs(nx) > 0.2) this.face = nx > 0 ? 1 : -1;
        this.lane = Kit915.laneLength(this, nx, ny, world, 300);
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        if (this.state === 'windup') {
            const k = 1 - this.windT / this.windMax;
            Kit915.warnLane(ctx, cx, cy + 6, Math.atan2(this.chargeDir.y, this.chargeDir.x), this.lane + 50, 112, k);
        }
        this._drawBody(ctx, cx, cy, false);
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const f = this.face;
        const X = d => cx + d * f;
        const p2 = this.phase === 2 || this.hp <= this.maxHp / 2;
        const fire = p2 ? '#ff5ad1' : '#6cf0ff';
        const eye = p2 ? '#ff3d5a' : '#6cf0ff';
        const tired = this.state === 'stunned' || dying;
        const windK = this.state === 'windup' ? 1 - this.windT / this.windMax : 0;
        const charging = this.state === 'charge';
        const gallop = charging ? t * 17 : (this.moving ? t * 9 : 0);
        const foot = cy + 40;
        const bob = charging || this.moving ? Math.sin(gallop * 2) * 1.8 : Math.sin(t * 2) * 0.8;
        const y = cy + bob + (tired ? 3 : 0);
        const rear = -windK * 0.3 + (charging ? 0.07 : 0) + (tired ? 0.05 : 0);
        ctx.save();
        const pvx = X(-26);
        ctx.translate(pvx, foot);
        ctx.rotate(rear * f);
        ctx.translate(-pvx, -foot);
        // Schweif aus Geisterfeuer
        this._flame(ctx, X(-38), y - 4, 7, fire, t, -f * (charging ? 1.4 : 0.8));
        this._flame(ctx, X(-42), y + 2, 5, fire, t + 2, -f * 1.2);
        // Hintere Beine (dunkler)
        const lift = windK;
        this._leg(ctx, X(-20), y + 10, gallop + Math.PI, f, foot, true, 0);
        this._leg(ctx, X(20), y + 8, gallop + Math.PI * 0.5, f, foot, true, lift);
        // Körper mit Rippen
        Art.body(ctx, X(-3), y + 1, 37, 18.5, BONE915, { lineWidth: 2.4 });
        ctx.strokeStyle = '#b89fd6';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const rx = X(-20 + i * 9);
            ctx.moveTo(rx, y - 8);
            ctx.quadraticCurveTo(rx + f * 4, y + 3, rx, y + 13);
        }
        ctx.stroke();
        Art.body(ctx, X(-31), y - 5, 8, 6.5, BONE915, { lineWidth: 1.8 });
        // Satteldecke
        Art.shape(ctx, c => {
            c.moveTo(X(-16), y - 13);
            c.lineTo(X(10), y - 13);
            c.lineTo(X(12), y + 3);
            c.quadraticCurveTo(X(-2), y + 7, X(-18), y + 3);
            c.closePath();
        }, { x: cx - 18, y: y - 13, w: 36, h: 20 }, '#e8434f', { lineWidth: 1.8 });
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(X(-17), y + 1.5);
        ctx.quadraticCurveTo(X(-2), y + 5, X(11), y + 1.5);
        ctx.stroke();
        // Vordere Beine
        this._leg(ctx, X(-13), y + 11, gallop, f, foot, false, 0);
        this._leg(ctx, X(26), y + 9, gallop + Math.PI * 1.5, f, foot, false, lift);
        // Hals mit Wirbeln und Mähne
        const hy = y - 22 + (tired ? 10 : 0) - windK * 4;
        Art.limb(ctx, X(20), y - 2, X(36), hy + 2, 11, BONE915, { lineWidth: 2 });
        for (let i = 0; i < 4; i++) this._flame(ctx, X(17 + i * 5.5), y - 7 - i * 5.5 + (tired ? i * 2 : 0), 5.5 - i * 0.4, fire, t + i * 1.7, -f * (charging ? 1.5 : 0.5));
        this._horseHead(ctx, X, f, hy, eye, tired, dying);
        // Reiter
        this._rider(ctx, X, f, cx, y, t, eye, tired, dying, windK, charging);
        ctx.restore();
        if (this.state === 'stunned') {
            Kit915.dizzy(ctx, X(-4), y - 74, 22, 3, 5);
            if (this.bonk) Kit915.dizzy(ctx, X(44), hy - 20, 12, 2, 3.5);
        }
    }

    _horseHead(ctx, X, f, hy, eye, tired, dying) {
        Art.shape(ctx, c => {
            c.moveTo(X(33), hy - 8);
            c.lineTo(X(36), hy - 17);
            c.lineTo(X(40), hy - 9);
            c.closePath();
        }, { x: Math.min(X(33), X(40)), y: hy - 17, w: 7, h: 9 }, BONE915, { lineWidth: 1.4 });
        Art.shape(ctx, c => {
            c.moveTo(X(31), hy - 7);
            c.quadraticCurveTo(X(40), hy - 14, X(49), hy - 7);
            c.lineTo(X(60), hy + 2);
            c.quadraticCurveTo(X(64), hy + 7, X(58), hy + 9);
            c.lineTo(X(41), hy + 9);
            c.quadraticCurveTo(X(29), hy + 7, X(31), hy - 7);
            c.closePath();
        }, { x: Math.min(X(29), X(64)), y: hy - 14, w: 35, h: 23 }, BONE915, { glossy: true, lineWidth: 2 });
        // Augenhöhle, Nüstern, Zähne
        ctx.fillStyle = '#2a1640';
        ctx.beginPath();
        Kit915.oval(ctx, X(40), hy - 3, 4.6, 4.2);
        Kit915.oval(ctx, X(57.5), hy + 2.5, 1.6, 1.1);
        ctx.fill();
        if (dying) {
            ctx.strokeStyle = eye;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(X(38), hy - 5);
            ctx.lineTo(X(42), hy - 1);
            ctx.moveTo(X(42), hy - 5);
            ctx.lineTo(X(38), hy - 1);
            ctx.stroke();
        } else if (!tired) {
            Art.glow(ctx, X(40), hy - 3, 9, eye, 0.7);
            ctx.fillStyle = eye;
            ctx.beginPath();
            ctx.arc(X(40.5), hy - 3, 1.6, 0, TAU);
            ctx.fill();
        } else {
            ctx.strokeStyle = eye;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(X(40), hy - 3, 2.2, 0, Math.PI * 1.5);
            ctx.stroke();
        }
        ctx.strokeStyle = '#8a6a9a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const tx = X(44 + i * 3);
            ctx.moveTo(tx, hy + 5.5);
            ctx.lineTo(tx, hy + 9);
        }
        ctx.moveTo(X(42), hy + 7);
        ctx.lineTo(X(59), hy + 7);
        ctx.stroke();
    }

    _rider(ctx, X, f, cx, y, t, eye, tired, dying, windK, charging) {
        const ry = y - 14;
        // Schild auf der anderen Seite
        Art.body(ctx, X(-11), ry - 10, 8.5, 9, '#3fa9ff', { lineWidth: 1.8 });
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(X(-11), ry - 10, 6.3, 6.8, 0, 0, TAU);
        ctx.stroke();
        Art.star(ctx, X(-11), ry - 10, 3.8, '#ffd23f', { lineWidth: 1 });
        // Bein mit Stiefel
        Art.limb(ctx, X(0), ry + 1, X(5), ry + 16, 3.6, BONE915, { lineWidth: 1.2 });
        Art.box(ctx, X(5) - 4, ry + 14, 8, 5, 2, '#5a3fa0', { lineWidth: 1.2, highlight: false });
        // Rumpf: Rüstung mit Orden
        Art.box(ctx, X(-1) - 10, ry - 25, 20, 25, 7, '#7a4dd8', { lineWidth: 2 });
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(X(-1) - 8, ry - 3);
        ctx.lineTo(X(-1) + 8, ry - 3);
        ctx.stroke();
        Art.body(ctx, X(-1), ry - 14, 4.2, 4.2, '#ffd23f', { lineWidth: 1.3 });
        Art.body(ctx, X(-1), ry - 14, 1.8, 1.8, '#ff4d5e', { highlight: false, lineWidth: 0.8 });
        // Kopf: Totenkopf mit Helm und Federbusch
        const hx = X(0);
        const hy = ry - 36 + (tired ? 3 : 0);
        const wave = Math.sin(t * (charging ? 16 : 6)) * 2;
        Art.shape(ctx, c => {
            c.moveTo(X(-2), hy - 10);
            c.quadraticCurveTo(X(-14), hy - 22 + wave, X(-26), hy - 12 + wave * 1.5);
            c.quadraticCurveTo(X(-16), hy - 11, X(-4), hy - 4);
            c.closePath();
        }, { x: Math.min(X(-26), X(-2)), y: hy - 22, w: 24, h: 18 }, '#ff4d5e', { lineWidth: 1.6 });
        const look = tired ? { x: 0, y: 0.6 } : { x: 0.5 * f, y: 0.3 };
        drawSkull915(ctx, hx, hy, 10, eye, look, dying, true);
        Art.shape(ctx, c => {
            c.moveTo(hx - 11, hy - 2);
            c.bezierCurveTo(hx - 11, hy - 16, hx + 11, hy - 16, hx + 11, hy - 2);
            c.quadraticCurveTo(hx, hy - 6, hx - 11, hy - 2);
            c.closePath();
        }, { x: hx - 11, y: hy - 14, w: 22, h: 12 }, '#8fb8ff', { glossy: true, lineWidth: 1.8 });
        // Arm mit Lanze
        let a = -0.45;
        if (windK > 0) a = -0.45 - windK * 0.5;
        if (charging) a = 0.04;
        if (tired) a = 0.55;
        const gx = X(10);
        const gy = ry - 12;
        Art.limb(ctx, X(8), ry - 21, gx, gy, 3.4, BONE915, { lineWidth: 1.1 });
        ctx.save();
        ctx.translate(gx, gy);
        ctx.scale(f, 1);
        ctx.rotate(a);
        Art.shape(ctx, c => {
            c.moveTo(-10, -3);
            c.lineTo(58, -0.8);
            c.lineTo(64, 0);
            c.lineTo(58, 0.8);
            c.lineTo(-10, 3);
            c.closePath();
        }, { x: -10, y: -3, w: 74, h: 6 }, '#fff4dc', { lineWidth: 1.4 });
        ctx.fillStyle = '#ff4d5e';
        ctx.fillRect(12, -2.3, 6, 4.6);
        ctx.fillRect(30, -1.7, 6, 3.4);
        ctx.fillRect(46, -1.2, 5, 2.4);
        Art.body(ctx, 5, 0, 3, 5, '#ffd23f', { lineWidth: 1.2, highlight: false });
        // Wimpel
        const flag = Math.sin(t * 10) * 2;
        Art.shape(ctx, c => {
            c.moveTo(40, -1);
            c.lineTo(30 - flag, -9);
            c.lineTo(28, -2);
            c.closePath();
        }, { x: 28, y: -9, w: 12, h: 8 }, '#ffd23f', { lineWidth: 1 });
        ctx.restore();
        Art.body(ctx, gx, gy, 2.6, 2.6, BONE915, { highlight: false, lineWidth: 1.1 });
    }

    // Knochenbein: Oberschenkel, Knie, Unterschenkel, Huf.
    _leg(ctx, hx, hy, phase, f, foot, far, lift) {
        const col = far ? '#e3d6c2' : BONE915;
        const sw = Math.sin(phase) * 7;
        const up = Math.max(0, Math.cos(phase)) * 5 + lift * 16;
        const kx = hx + (sw * 0.5 + lift * 6) * f;
        const ky = hy + 13 - up * 0.5;
        const fx = hx + (sw + lift * 12) * f;
        const fy = foot - 3 - up;
        Art.limb(ctx, hx, hy, kx, ky, 6.5, col, { lineWidth: 1.7 });
        Art.limb(ctx, kx, ky, fx, fy, 5.2, col, { lineWidth: 1.7 });
        Art.body(ctx, kx, ky, 3.9, 3.9, col, { highlight: false, lineWidth: 1.4 });
        Art.box(ctx, fx - 4.8, fy - 1.5, 9.6, 5, 2, '#5a3fa0', { highlight: false, lineWidth: 1.3 });
    }

    // Flamme aus Geisterfeuer; lean neigt die Spitze zur Seite.
    _flame(ctx, x, y, s, color, ph, lean) {
        const fl = Math.sin(Art.time * 12 + ph * 3) * 0.25;
        const tx = x + (lean + fl) * s;
        Art.glow(ctx, x, y - s * 0.7, s * 2.6, color, 0.45);
        Art.shape(ctx, c => {
            c.moveTo(x - s * 0.62, y);
            c.quadraticCurveTo(x - s * 0.75, y - s, tx, y - s * 2.1);
            c.quadraticCurveTo(x + s * 0.75, y - s, x + s * 0.62, y);
            c.quadraticCurveTo(x, y + s * 0.55, x - s * 0.62, y);
            c.closePath();
        }, { x: x - s, y: y - s * 2.1, w: s * 2, h: s * 2.6 }, color, { lineWidth: 1.2 });
    }
}

// ══════════════════════════════════════════
// ── Welt 14: Gift-Sumpf ──
// ══════════════════════════════════════════

// Giftschlange: aufgerichtete Schlange mit großen Augen. Bläht vor dem Spucken die Backen, Gift ist grün (G-16).
class PoisonSnake extends Enemy {
    constructor(x, y) {
        super(x, y, 18, 14);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 70;
        this.damage = 1;
        this.detectionRange = 150;
        this.spitTimer = 0.35;
        this.spitCooldown = 2.5;
        this.slither = 0;
        this.active = false;
        this.inRange = false;
        this.face = 1;
        this.look = { x: 1, y: 0 };
        this.seed = Math.random() * 10;
        this.pal = PoisonSnake.PALETTES[randInt(0, PoisonSnake.PALETTES.length - 1)];
        this.fxColor = this.pal.body;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.slither += dt * 8;
        const mx = this.centerX();
        const my = this.centerY();
        const dx = player.x + player.w / 2 - mx;
        const dy = player.y + player.h / 2 - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.look.x = dx / dist;
        this.look.y = dy / dist;
        this.active = dist < this.detectionRange;
        this.inRange = dist < 100;
        if (!this.active) return;
        if (Math.abs(dx) > 4) this.face = dx > 0 ? 1 : -1;
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.spitTimer -= dt;
        // Außer Reichweite wartet sie spuckbereit – beim Näherkommen bleibt Zeit für die Warnung
        if (!this.inRange && this.spitTimer < 0.35) this.spitTimer = 0.35;
        if (this.spitTimer <= 0) {
            this.spitTimer = this.spitCooldown;
            const p = Kit915.shoot(mx, my, this.look.x * 130, this.look.y * 130, 1, 40, '#6bff5a', 'poison');
            if (p) p.poison = true;
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
        const f = this.face;
        const P = this.pal;
        const w = Math.sin(this.slither + (this.active ? 0 : t * 3));
        const charge = this.inRange && this.active && !dying ? clamp(1 - this.spitTimer / 0.35, 0, 1) : 0;
        const ground = cy + 6;
        const nx = cx + f * (4 - charge * 3);
        const ny = cy - 3 + charge;
        // Körper als S-Kurve vom Schwanz zum aufgerichteten Hals
        const body = c => {
            c.beginPath();
            c.moveTo(cx - f * 13, ground - 1 + w);
            c.quadraticCurveTo(cx - f * 8, ground + 3 - w * 1.5, cx - f * 1, ground - 1 + w);
            c.quadraticCurveTo(cx + f * 8, ground - 3 - w, nx, ny);
        };
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // spitzer Schwanz
        ctx.beginPath();
        ctx.moveTo(cx - f * 11, ground - 1 + w);
        ctx.quadraticCurveTo(cx - f * 15, ground + 0.5 + w * 0.5, cx - f * 18, ground - 3.5 + w);
        ctx.strokeStyle = Art.ink(P.body);
        ctx.lineWidth = 5.2;
        ctx.stroke();
        ctx.strokeStyle = P.body;
        ctx.lineWidth = 2.6;
        ctx.stroke();
        body(ctx);
        ctx.strokeStyle = Art.ink(P.body);
        ctx.lineWidth = 8.6;
        ctx.stroke();
        ctx.strokeStyle = P.body;
        ctx.lineWidth = 6;
        ctx.stroke();
        body(ctx);
        ctx.strokeStyle = P.belly;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // Punkte auf dem Rücken
        ctx.fillStyle = P.spot;
        ctx.beginPath();
        Kit915.dot(ctx, cx - f * 9, ground + 0.5 - w * 0.4, 1.3);
        Kit915.dot(ctx, cx - f * 3.5, ground - 0.5 + w * 0.6, 1.3);
        Kit915.dot(ctx, cx + f * 3.5, ground - 3 - w * 0.4, 1.2);
        ctx.fill();
        // Kopf
        const hx = nx + f * 1.5;
        const hy = ny - 3.5;
        const puff = charge * 1.2;
        Art.body(ctx, hx, hy, 6 + puff, 5 + puff * 0.6, P.body, { glossy: true, lineWidth: 1.4 });
        if (dying) {
            ctx.strokeStyle = '#2a0b1e';
            ctx.lineWidth = 1.1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                const ex = hx + s * 2.6;
                ctx.moveTo(ex - 1.2, hy - 2.4);
                ctx.lineTo(ex + 1.2, hy);
                ctx.moveTo(ex + 1.2, hy - 2.4);
                ctx.lineTo(ex - 1.2, hy);
            }
            ctx.stroke();
        } else {
            Art.eyes(ctx, hx + f * 0.6, hy - 1.2, 2, { look: this.look, seed: this.seed, gap: 2.6, angry: this.active });
        }
        if (charge > 0) {
            // Backen blähen, Gift leuchtet im Maul
            Art.blush(ctx, hx, hy + 1.5, 1.8 + puff * 0.5, 4.2, '#ff4fd8');
            Art.glow(ctx, hx + f * 1, hy + 2.6, 5 + charge * 5, '#6bff5a', 0.5 + charge * 0.4);
            Art.mouth(ctx, hx + f * 1, hy + 2.6, 2.6 + charge * 1.6, 'o');
        } else {
            // Zunge schnellt ab und zu heraus
            if ((t * 0.7) % 1 < 0.15) {
                ctx.strokeStyle = '#ff4f7b';
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.moveTo(hx + f * 3, hy + 2.5);
                ctx.lineTo(hx + f * 7, hy + 3);
                ctx.moveTo(hx + f * 7, hy + 3);
                ctx.lineTo(hx + f * 8.5, hy + 1.8);
                ctx.moveTo(hx + f * 7, hy + 3);
                ctx.lineTo(hx + f * 8.5, hy + 4.2);
                ctx.stroke();
            }
            Art.mouth(ctx, hx + f * 0.8, hy + 2.4, 3, 'smile');
        }
    }
}
PoisonSnake.PALETTES = [
    { body: '#a45cff', spot: '#c6ff4a', belly: '#e6d3ff' },
    { body: '#ff8a2b', spot: '#2fe3c0', belly: '#ffe3c2' },
    { body: '#3fa9ff', spot: '#ffe14a', belly: '#d9eeff' },
];

// W14-Boss: HYDRA – dicke Sumpf-Hydra mit sieben schwankenden Köpfen.
// Vor dem Giftregen legen alle Köpfe den Kopf zurück und das Gift leuchtet im Maul.
class BossHydra extends Enemy {
    constructor(x, y) {
        super(x, y, 110, 90);
        this.hp = 65;
        this.maxHp = 65;
        this.speed = 20;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stunnedTimer = 0;
        this.rainTimer = 4;
        this.phase = 1;
        this.headCount = 7;
        this.castT = 0;
        this.castMax = 0.8;
        this.spitFx = 0;
        this.moving = false;
        this.look = { x: 0, y: 1 };
        this.seed = Math.random() * 10;
        this.fxColor = '#6bff5a';
        this.shadow = { rx: 52, ry: 14, dy: 43 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 33 && this.phase === 1) {
            this.phase = 2;
            this.speed = 30;
            Kit915.burst(this.centerX(), this.centerY(), ['#6bff5a', '#a45cff', '#ffffff'], 18, 200, 0.7);
            Kit915.shake(6, 0.4);
        }
        if (this.spitFx > 0) this.spitFx -= dt;
        const mx = this.centerX();
        const my = this.centerY();
        const pcx = player.x + player.w / 2;
        const pcy = player.y + player.h / 2;
        const dist = Math.hypot(pcx - mx, pcy - my) || 1;
        this.look.x = (pcx - mx) / dist;
        this.look.y = (pcy - my) / dist;
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
                // Giftregen: sieben Tropfen, Gift wirkt (G-16)
                for (let i = 0; i < this.headCount; i++) {
                    const ha = (Math.PI * 2 * i) / this.headCount;
                    const p = Kit915.shoot(
                        mx + Math.cos(ha) * 30, my + Math.sin(ha) * 30,
                        Math.cos(ha) * 100 + (pcx - mx) * 0.3, Math.sin(ha) * 100 + (pcy - my) * 0.3,
                        1, 40, '#6bff5a', 'poison'
                    );
                    if (p) p.poison = true;
                }
                Kit915.burst(mx, my - 30, ['#6bff5a', '#c6ff4a', '#ffffff'], 12, 120, 0.5);
                this.spitFx = 0.35;
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.moving = true;
        this.rainTimer -= dt;
        if (this.rainTimer <= 0) {
            // Anlauf zählt zur alten Pause – der Rhythmus bleibt wie bisher
            this.castMax = this.phase === 1 ? 0.8 : 0.6;
            this.rainTimer = (this.phase === 1 ? 4 : 2.5) - this.castMax;
            this.castT = this.castMax;
            this.state = 'cast';
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
        if (this.state === 'cast') {
            const k = 1 - this.castT / this.castMax;
            Kit915.warnCircle(ctx, cx, cy + 8, 62 + 20 * k, k, '#6bff5a');
        }
        this._drawBody(ctx, cx, cy, false);
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const p2 = this.phase === 2 || this.hp <= this.maxHp / 2;
        const tired = this.state === 'stunned' || dying;
        const castK = this.state === 'cast' ? 1 - this.castT / this.castMax : 0;
        const spit = this.spitFx > 0 ? this.spitFx / 0.35 : 0;
        const walk = this.moving ? Math.sin(t * 6) : 0;
        const foot = cy + 45;
        const by = cy + 14 + (this.moving ? -Math.abs(walk) * 1.5 : Math.sin(t * 1.6));
        const body = p2 ? '#7a3fd0' : '#8a4dd8';
        const belly = '#d4ff7a';
        // Schwanz mit Stacheln
        const tw = Math.sin(t * 2) * 3;
        Art.shape(ctx, c => {
            c.moveTo(cx + 36, by + 8);
            c.quadraticCurveTo(cx + 64, by + 12, cx + 62 + tw, by - 12);
            c.quadraticCurveTo(cx + 56, by + 2, cx + 32, by - 6);
            c.closePath();
        }, { x: cx + 32, y: by - 14, w: 34, h: 26 }, body, { lineWidth: 2 });
        Art.shape(ctx, c => {
            c.moveTo(cx + 50, by - 1);
            c.lineTo(cx + 55, by - 9);
            c.lineTo(cx + 56, by + 1);
            c.moveTo(cx + 59, by - 7 + tw * 0.3);
            c.lineTo(cx + 66 + tw, by - 14);
            c.lineTo(cx + 62 + tw * 0.6, by - 4);
        }, { x: cx + 50, y: by - 14, w: 16, h: 15 }, p2 ? '#ff4fd8' : '#c6ff4a', { lineWidth: 1.2 });
        // Stummelbeine mit Krallen
        for (const s of [-1, 1]) {
            const lift = this.moving && Math.sign(walk) === s ? 3 : 0;
            Art.body(ctx, cx + s * 34, foot - 6 - lift, 9.5, 7, body, { lineWidth: 2 });
            Art.body(ctx, cx + s * 16, foot - 4 - (lift ? 0 : 2), 9.5, 7, body, { lineWidth: 2 });
        }
        ctx.fillStyle = '#f3ffd6';
        ctx.beginPath();
        for (const x of [-38, -30, -20, -12, 12, 20, 30, 38]) {
            const fy = foot - (Math.abs(x) > 25 ? 1 : 0);
            ctx.moveTo(cx + x - 1.8, fy - 2);
            ctx.lineTo(cx + x, fy + 1.5);
            ctx.lineTo(cx + x + 1.8, fy - 2);
        }
        ctx.fill();
        // Körper mit Bauch und Flecken
        if (p2) Art.glow(ctx, cx, by - 10, 56, '#ff4fd8', 0.22 + 0.12 * Math.sin(t * 6));
        Art.body(ctx, cx, by, 49, 31, body, { glossy: true, lineWidth: 2.4 });
        Art.body(ctx, cx, by + 10, 31, 18, belly, { highlight: false, lineWidth: 1.8 });
        ctx.strokeStyle = Art.dark(belly, 0.3);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            ctx.moveTo(cx - 22 + Math.abs(i) * 4, by + 8 + i * 6);
            ctx.quadraticCurveTo(cx, by + 11 + i * 6, cx + 22 - Math.abs(i) * 4, by + 8 + i * 6);
        }
        ctx.stroke();
        ctx.fillStyle = '#c6ff4a';
        ctx.beginPath();
        Kit915.dot(ctx, cx - 36, by - 4, 3);
        Kit915.dot(ctx, cx + 37, by - 2, 2.6);
        Kit915.dot(ctx, cx - 40, by + 8, 2);
        Kit915.dot(ctx, cx + 41, by + 9, 2.2);
        ctx.fill();
        // Sieben Hälse mit Köpfen – außen zuerst, der große Mittelkopf zuletzt
        for (const i of BossHydra.ORDER) this._neckAndHead(ctx, cx, by, i, t, body, belly, tired, dying, castK, spit, p2);
        if (this.state === 'stunned') Kit915.dizzy(ctx, cx, by - 46, 34, 3, 5);
    }

    _neckAndHead(ctx, cx, by, i, t, body, belly, tired, dying, castK, spit, p2) {
        const H = BossHydra.HEADS[i];
        const dx = H[0];
        const mid = i === 3;
        const s = mid ? 1.35 : 1.15;
        let hx = cx + dx * (1 - castK * 0.08 + spit * 0.08) + Math.sin(t * 2 + i * 1.3) * 3;
        let hy = by + H[1] - castK * 8 + spit * 6 + Math.cos(t * 2.3 + i) * 2.5;
        if (tired) {
            // Köpfe hängen erschöpft über den Rand
            hx = cx + dx * 1.04;
            hy = by - 10 - (1 - Math.abs(dx) / 62) * 16 + Math.sin(t * 1.5 + i) * 1.5;
        }
        const bx = cx + dx * 0.4;
        const byy = by - 16 + Math.abs(dx) * 0.08;
        const sway = Math.sin(t * 1.7 + i) * 5;
        const w = mid ? 13 : 11;
        const neck = () => {
            ctx.beginPath();
            ctx.moveTo(bx, byy);
            ctx.bezierCurveTo(bx + dx * 0.05, byy - 16, hx - dx * 0.35 + sway, hy + 16, hx, hy + 3 * s);
        };
        ctx.lineCap = 'round';
        neck();
        ctx.strokeStyle = Art.ink(body);
        ctx.lineWidth = w + 4.4;
        ctx.stroke();
        ctx.strokeStyle = body;
        ctx.lineWidth = w;
        ctx.stroke();
        ctx.save();
        ctx.translate(1.8, 1.2);
        neck();
        ctx.restore();
        ctx.strokeStyle = belly;
        ctx.lineWidth = w * 0.24;
        ctx.stroke();
        this._head(ctx, hx, hy, s, i, t, body, tired, dying, castK, spit, p2);
    }

    _head(ctx, x, y, s, i, t, body, tired, dying, castK, spit, p2) {
        const head = i % 2 ? Art.light(body, 0.08) : body;
        // Hörnchen
        Art.shape(ctx, c => {
            c.moveTo(x - 6 * s, y - 4 * s);
            c.lineTo(x - 8 * s, y - 12 * s);
            c.lineTo(x - 2.5 * s, y - 6 * s);
            c.moveTo(x + 6 * s, y - 4 * s);
            c.lineTo(x + 8 * s, y - 12 * s);
            c.lineTo(x + 2.5 * s, y - 6 * s);
        }, { x: x - 8 * s, y: y - 12 * s, w: 16 * s, h: 8 * s }, '#c6ff4a', { lineWidth: 1.2 });
        Art.body(ctx, x, y, 9.5 * s, 8 * s, head, { glossy: true, lineWidth: 1.8 });
        // Schnauze mit Maul
        const open = dying ? 0.6 : Math.max(castK, spit, 0);
        Art.body(ctx, x, y + 4.8 * s, 6.8 * s, (4.2 + open * 2) * s, Art.light(head, 0.14), { highlight: false, lineWidth: 1.4 });
        if (open > 0.05) {
            ctx.fillStyle = '#3a0d3e';
            ctx.beginPath();
            ctx.ellipse(x, y + (6 + open) * s, 4.4 * s, (1 + open * 2.6) * s, 0, 0, TAU);
            ctx.fill();
            if (!dying) {
                Art.glow(ctx, x, y + 6 * s, (6 + castK * 8) * s, '#6bff5a', 0.5 + castK * 0.4);
                Art.body(ctx, x, y + (6 + open) * s, (1 + castK * 2) * s, (1 + castK * 2) * s, '#8dff6a', { lineWidth: 1 });
            }
        } else {
            ctx.fillStyle = '#3a0d3e';
            ctx.beginPath();
            Kit915.oval(ctx, x - 2 * s, y + 3.6 * s, 0.9 * s, 0.7 * s);
            Kit915.oval(ctx, x + 2 * s, y + 3.6 * s, 0.9 * s, 0.7 * s);
            ctx.fill();
        }
        // Schlitzaugen
        const ey = y - 2.2 * s;
        if (tired || dying) {
            ctx.strokeStyle = '#2a0b3e';
            ctx.lineWidth = 1.4 * s;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x - 6 * s, ey);
            ctx.lineTo(x - 2 * s, ey + 1 * s);
            ctx.moveTo(x + 2 * s, ey + 1 * s);
            ctx.lineTo(x + 6 * s, ey);
            ctx.stroke();
            return;
        }
        const lx = this.look.x * 0.8 * s;
        const ly = this.look.y * 0.6 * s;
        ctx.fillStyle = p2 ? '#ff5a3d' : '#ffe14a';
        ctx.beginPath();
        Kit915.oval(ctx, x - 3.6 * s, ey, 2.6 * s, 2.2 * s, 0.35);
        Kit915.oval(ctx, x + 3.6 * s, ey, 2.6 * s, 2.2 * s, -0.35);
        ctx.fill();
        ctx.fillStyle = '#1a0b2a';
        ctx.beginPath();
        Kit915.oval(ctx, x - 3.6 * s + lx, ey + ly, 0.7 * s, 1.8 * s);
        Kit915.oval(ctx, x + 3.6 * s + lx, ey + ly, 0.7 * s, 1.8 * s);
        ctx.fill();
        ctx.strokeStyle = '#2a0b3e';
        ctx.lineWidth = 1.3 * s;
        ctx.beginPath();
        ctx.moveTo(x - 6.4 * s, ey - 3.2 * s);
        ctx.lineTo(x - 1.6 * s, ey - 1.6 * s);
        ctx.moveTo(x + 6.4 * s, ey - 3.2 * s);
        ctx.lineTo(x + 1.6 * s, ey - 1.6 * s);
        ctx.stroke();
    }
}
BossHydra.ORDER = [0, 6, 1, 5, 2, 4, 3];
// Kopfpositionen (x/y relativ zur Körpermitte), von links nach rechts
BossHydra.HEADS = [[-60, -28], [-45, -48], [-24, -60], [0, -66], [24, -60], [45, -48], [60, -28]];

// ══════════════════════════════════════════
// ── Welt 15: Steinwelt ──
// ══════════════════════════════════════════

// Stein-Samurai: lebende Steinfigur mit roter Rüstung und Katana. Duckt sich und zeigt die Sprungbahn,
// bevor er vorschnellt (G-20); der Sprint stoppt an Wänden (G-08).
class StoneSamurai extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 26);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 60;
        this.damage = 2;
        this.detectionRange = 160;
        this.dashTimer = 0;
        this.dashCooldown = 2;
        this.dashing = false;
        this.dashDir = { x: 1, y: 0 };
        this.dashT = 0;
        this.ready = 0;
        this.lane = 60;
        this.facingA = 0;
        this.moving = false;
        this.seed = Math.random() * 10;
        this.fxColor = '#c9d1f0';
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
        if (this.dashing) {
            this.dashT -= dt;
            const hitWall = Kit915.rush(this, this.dashDir.x * 200 * dt, this.dashDir.y * 200 * dt, world);
            if (Math.hypot(px - this.centerX(), py - this.centerY()) < 30) Kit915.hurt(player, 2, this.facingA, 150);
            if (this.dashT <= 0 || hitWall) {
                this.dashing = false;
                if (hitWall) Kit915.burst(this.centerX() + this.dashDir.x * 12, this.centerY() + this.dashDir.y * 12, ['#c9d1f0', '#ffffff'], 6, 90, 0.35);
            }
            return;
        }
        if (this.ready > 0) {
            this.ready -= dt;
            if (this.ready <= 0) {
                this.dashing = true;
                this.dashT = 0.3;
            }
            return;
        }
        if (dist < this.detectionRange) {
            this.facingA = Math.atan2(py - my, px - mx);
            this._moveWithCollision(Math.cos(this.facingA) * this.speed * 0.4 * dt, Math.sin(this.facingA) * this.speed * 0.4 * dt, world);
            this.moving = true;
            this.dashTimer -= dt;
            if (this.dashTimer <= 0 && dist < 80) {
                // Ducken und Bahn zeigen, dann erst vorschnellen
                this.dashTimer = this.dashCooldown;
                this.ready = StoneSamurai.READY;
                this.dashDir.x = Math.cos(this.facingA);
                this.dashDir.y = Math.sin(this.facingA);
                this.lane = Kit915.laneLength(this, this.dashDir.x, this.dashDir.y, world, 60);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            this._drawCrumble(ctx, cx, cy, this.deathProgress());
            return;
        }
        if (this.ready > 0) {
            const k = 1 - this.ready / StoneSamurai.READY;
            Kit915.warnLane(ctx, cx, cy + 4, Math.atan2(this.dashDir.y, this.dashDir.x), this.lane + 18, 44, k);
        }
        if (this.dashing) {
            // Tempo-Striche hinter ihm
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.6;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                const ox = -this.dashDir.y * i * 7;
                const oy = this.dashDir.x * i * 7;
                ctx.moveTo(cx + ox - this.dashDir.x * 12, cy + oy - this.dashDir.y * 12);
                ctx.lineTo(cx + ox - this.dashDir.x * (26 + Math.abs(i) * -6), cy + oy - this.dashDir.y * (26 + Math.abs(i) * -6));
            }
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
        this._drawBody(ctx, cx, cy, false);
    }

    // Tod: zerfällt in Steinbrocken.
    _drawCrumble(ctx, cx, cy, t) {
        if (t >= 1) return;
        if (t < 0.3) {
            Kit915.drawDying(ctx, cx, cy, t, () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        const k = (t - 0.3) / 0.7;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * (1 - k);
        const cols = ['#8b93c9', '#ff4d5e', '#6c74ad', '#ffd23f'];
        for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + (i - 3) * 0.5;
            const d = k * (16 + (i % 3) * 6);
            const x = cx + Math.cos(a) * d;
            const y = cy - 6 + Math.sin(a) * d + k * k * 26;
            const s = 3.2 + (i % 2) * 1.6;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(k * (i - 3));
            Art.box(ctx, -s, -s, s * 2, s * 2, 1, cols[i % cols.length], { lineWidth: 1, highlight: false });
            ctx.restore();
        }
        ctx.globalAlpha = prev;
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const f = Math.cos(this.facingA) < 0 ? -1 : 1;
        const X = d => cx + d * f;
        const readyK = this.ready > 0 ? 1 - this.ready / StoneSamurai.READY : 0;
        const step = this.moving ? Math.sin(t * 9) : 0;
        const by = cy + readyK * 2.5 + (this.moving ? -Math.abs(step) : 0) + (this.dashing ? 1 : 0);
        const stone = '#8b93c9';
        const stoneDark = '#6c74ad';
        const red = '#ff4d5e';
        // Beine
        Art.limb(ctx, X(-4), by + 5, X(-4 - step * 2 - readyK * 2), cy + 11.5, 5, stoneDark, { lineWidth: 1.4 });
        Art.limb(ctx, X(4), by + 5, X(4 + step * 2 + readyK * 3), cy + 11.5, 5, stoneDark, { lineWidth: 1.4 });
        // Rüstungsrock
        Art.shape(ctx, c => {
            c.moveTo(cx - 8.5, by);
            c.lineTo(cx + 8.5, by);
            c.lineTo(cx + 11, by + 8);
            c.lineTo(cx - 11, by + 8);
            c.closePath();
        }, { x: cx - 11, y: by, w: 22, h: 8 }, red, { lineWidth: 1.4 });
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(cx - 10.2, by + 5.6, 20.4, 1.2);
        // Rumpf aus Stein mit Brustpanzer
        Art.box(ctx, cx - 8, by - 8, 16, 10, 4, stone, { lineWidth: 1.4 });
        Art.box(ctx, cx - 6, by - 7, 12, 7, 3, red, { lineWidth: 1.2 });
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 6, by - 3.5);
        ctx.lineTo(cx + 6, by - 3.5);
        ctx.stroke();
        // Schulterplatten
        for (const s of [-1, 1]) {
            Art.shape(ctx, c => {
                c.moveTo(cx + s * 6, by - 9);
                c.lineTo(cx + s * 12.5, by - 7);
                c.lineTo(cx + s * 12, by - 1);
                c.lineTo(cx + s * 6.5, by - 3);
                c.closePath();
            }, { x: cx + Math.min(s * 6, s * 12.5), y: by - 9, w: 6.5, h: 8 }, red, { lineWidth: 1.2 });
        }
        // Kopf: Steinmaske mit Glutaugen, Helm mit goldenem Sichel-Zierrat
        const hy = by - 14;
        Art.body(ctx, cx, hy, 7.6, 7.2, stone, { lineWidth: 1.4 });
        Art.shape(ctx, c => {
            c.moveTo(cx - 10, hy - 1);
            c.bezierCurveTo(cx - 10, hy - 13, cx + 10, hy - 13, cx + 10, hy - 1);
            c.lineTo(cx + 7.5, hy - 3);
            c.quadraticCurveTo(cx, hy - 6.5, cx - 7.5, hy - 3);
            c.closePath();
        }, { x: cx - 10, y: hy - 11, w: 20, h: 10 }, '#d93a4f', { glossy: true, lineWidth: 1.4 });
        Art.shape(ctx, c => {
            c.moveTo(cx, hy - 8);
            c.quadraticCurveTo(cx - 9, hy - 12, cx - 10, hy - 19);
            c.quadraticCurveTo(cx - 5, hy - 13, cx, hy - 11);
            c.quadraticCurveTo(cx + 5, hy - 13, cx + 10, hy - 19);
            c.quadraticCurveTo(cx + 9, hy - 12, cx, hy - 8);
            c.closePath();
        }, { x: cx - 10, y: hy - 19, w: 20, h: 11 }, '#ffd23f', { lineWidth: 1.2 });
        if (dying) {
            ctx.strokeStyle = '#ffb13b';
            ctx.lineWidth = 1.3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                ctx.moveTo(cx + s * 3 - 1.5, hy - 1.5);
                ctx.lineTo(cx + s * 3 + 1.5, hy + 1.5);
                ctx.moveTo(cx + s * 3 + 1.5, hy - 1.5);
                ctx.lineTo(cx + s * 3 - 1.5, hy + 1.5);
            }
            ctx.stroke();
        } else {
            const eye = readyK > 0 || this.dashing ? '#fff1a8' : '#ffb13b';
            Art.glow(ctx, cx + f, hy, 10, '#ff8a3d', 0.55 + readyK * 0.4);
            ctx.fillStyle = eye;
            ctx.beginPath();
            Kit915.oval(ctx, cx - 3 + f, hy, 2, 1.1, 0.35);
            Kit915.oval(ctx, cx + 3 + f, hy, 2, 1.1, -0.35);
            ctx.fill();
        }
        ctx.strokeStyle = '#3c3f73';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - 3, hy + 4);
        ctx.lineTo(cx + 3, hy + 4);
        ctx.stroke();
        this._drawKatana(ctx, X, f, by, readyK, dying);
    }

    _drawKatana(ctx, X, f, by, readyK, dying) {
        const hx = X(9);
        const hy = by - 2;
        let a = this.facingA + f * 0.8; // Ruhe: Klinge gesenkt
        if (readyK > 0) a = this.facingA + Math.PI - f * 0.35; // zurückgezogen, gleich geht es los
        if (this.dashing) a = this.facingA;
        if (dying) a = f > 0 ? 1.4 : Math.PI - 1.4;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        Art.limb(ctx, hx - ca * 5, hy - sa * 5, hx, hy, 2.4, '#3a2a6a', { lineWidth: 1 });
        Art.limb(ctx, hx + ca * 1.5, hy + sa * 1.5, hx + ca * 19, hy + sa * 19, 2.4, '#eef4ff', { outline: '#5a64a8', lineWidth: 1 });
        ctx.strokeStyle = '#8ff0ff';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(hx + ca * 3, hy + sa * 3 - 0.6);
        ctx.lineTo(hx + ca * 17, hy + sa * 17 - 0.6);
        ctx.stroke();
        Art.body(ctx, hx + ca * 1.2, hy + sa * 1.2, 2, 2, '#ffd23f', { highlight: false, lineWidth: 0.9 });
        if (readyK > 0) {
            const g = (Art.time * 3) % 1;
            Art.sparkle(ctx, hx + ca * (4 + g * 14), hy + sa * (4 + g * 14), 2.4 + readyK * 1.5, '#ffffff');
        }
    }
}
StoneSamurai.READY = 0.35;

// W15-Boss: STEIN-DÄMON – gewaltiger Steinriese mit sechs Schwertarmen, glühenden Rissen und Glutaugen.
// Wirbel: roter Warnkreis vorher. Ansturm: Warnbahn vorher, stoppt an Wänden und ist dann benommen (G-03).
class BossStoneDemon extends Enemy {
    constructor(x, y) {
        super(x, y, 110, 100);
        this.hp = 70;
        this.maxHp = 70;
        this.speed = 25;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stunnedTimer = 0;
        this.whirlTimer = 5;
        this.chargeTimer = 8;
        this.phase = 1;
        this.whirling = false;
        this.whirlT = 0;
        this.chargeDir = { x: 1, y: 0 };
        this.chargeT = 0;
        this.windT = 0;
        this.windMax = 0.6;
        this.windFor = 'whirl';
        this.lane = 200;
        this.bonk = false;
        this.moving = false;
        this.look = { x: 0, y: 1 };
        this.seed = Math.random() * 10;
        this.fxColor = '#ff8a3d';
        this.shadow = { rx: 54, ry: 15, dy: 48 };
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 35 && this.phase === 1) {
            this.phase = 2;
            this.speed = 40;
            Kit915.burst(this.centerX(), this.centerY(), ['#ff8a3d', '#ffd23f', '#8b86c9'], 20, 220, 0.8);
            Kit915.shake(8, 0.5);
        }
        const mx = this.centerX();
        const my = this.centerY();
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dist = Math.hypot(px - mx, py - my) || 1;
        this.look.x = (px - mx) / dist;
        this.look.y = (py - my) / dist;
        this.moving = false;
        this.whirling = this.state === 'whirl';
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'stunned') {
            this.stunnedTimer -= dt;
            if (this.stunnedTimer <= 0) {
                this.state = 'chase';
                this.bonk = false;
            }
            return;
        }
        if (this.state === 'windup') {
            this.windT -= dt;
            if (this.windFor === 'charge' && this.windT > this.windMax * 0.5) this._aim(world);
            if (this.windT <= 0) {
                if (this.windFor === 'whirl') {
                    this.state = 'whirl';
                    this.whirling = true;
                    this.whirlT = 0;
                } else {
                    this.state = 'charge';
                    this.chargeT = 0;
                    Kit915.shake(4, 0.2);
                }
            }
            return;
        }
        if (this.state === 'whirl') {
            this.whirlT += dt;
            if (dist < 80) {
                const before = player.hp;
                Kit915.hurt(player, 2, Math.atan2(py - my, px - mx), 200);
                if (player.hp < before) Kit915.burst(px, py, ['#c9d1f0', '#ffffff'], 5, 90, 0.3);
            }
            if (this.whirlT > 2) {
                this.state = 'stunned';
                this.stunnedTimer = 2.5;
                this.whirling = false;
            }
            return;
        }
        if (this.state === 'charge') {
            this.chargeT += dt;
            const hitWall = Kit915.rush(this, this.chargeDir.x * 250 * dt, this.chargeDir.y * 250 * dt, world);
            const c = this.center();
            if (Math.hypot(px - c.x, py - c.y) < 70) Kit915.hurt(player, 3, Math.atan2(py - c.y, px - c.x), 350);
            if (hitWall) {
                // gegen die Wand gerannt: benommen, Steine bröckeln
                this.state = 'stunned';
                this.stunnedTimer = 2;
                this.bonk = true;
                Kit915.shake(10, 0.45);
                const fx = c.x + this.chargeDir.x * 55;
                const fy = c.y + this.chargeDir.y * 50;
                Kit915.burst(fx, fy, ['#8b86c9', '#c9d1f0', '#ff8a3d'], 16, 190, 0.7);
                Kit915.ring(fx, fy, '#ffd23f', 60, 0.45, 5);
            } else if (this.chargeT > 1.2) {
                this.state = 'stunned';
                this.stunnedTimer = 2;
            }
            return;
        }
        this._moveWithCollision(this.look.x * this.speed * dt, this.look.y * this.speed * dt, world);
        this.moving = true;
        this.whirlTimer -= dt;
        this.chargeTimer -= dt;
        // Anlauf zählt zur alten Pause – der Rhythmus bleibt wie bisher.
        // Laufen beide Zeitgeber gleichzeitig ab, kommt der Ansturm etwas später (U-02).
        if (this.whirlTimer <= 0) {
            this.windMax = 0.6;
            this.whirlTimer = (this.phase === 1 ? 5 : 3) - this.windMax;
            if (this.chargeTimer <= 0) this.chargeTimer = 1.5;
            this._windup('whirl');
        } else if (this.chargeTimer <= 0) {
            this.windMax = 0.75;
            this.chargeTimer = (this.phase === 1 ? 8 : 5) - this.windMax;
            this._aim(world);
            this._windup('charge');
        }
    }

    _windup(kind) {
        this.state = 'windup';
        this.windFor = kind;
        this.windT = this.windMax;
    }

    _aim(world) {
        this.chargeDir.x = this.look.x;
        this.chargeDir.y = this.look.y;
        this.lane = Kit915.laneLength(this, this.chargeDir.x, this.chargeDir.y, world, 300);
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) {
            Kit915.drawDying(ctx, cx, cy, this.deathProgress(), () => this._drawBody(ctx, cx, cy, true));
            return;
        }
        if (this.state === 'windup') {
            const k = 1 - this.windT / this.windMax;
            if (this.windFor === 'whirl') Kit915.warnCircle(ctx, cx, cy, 80, k);
            else Kit915.warnLane(ctx, cx, cy + 8, Math.atan2(this.chargeDir.y, this.chargeDir.x), this.lane + 55, 132, k);
        } else if (this.state === 'whirl') {
            // Gefahrenzone bleibt sichtbar, solange er wirbelt
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.5;
            Art.ring(ctx, cx, cy, 80, '#ff3d5a', 2.4, 0.8);
            ctx.globalAlpha = prev;
        }
        this._drawBody(ctx, cx, cy, false);
    }

    _drawBody(ctx, cx, cy, dying) {
        const t = Art.time + this.seed;
        const p2 = this.phase === 2 || this.hp <= this.maxHp / 2;
        const tired = this.state === 'stunned' || dying;
        const windK = this.state === 'windup' ? 1 - this.windT / this.windMax : 0;
        const whirl = this.state === 'whirl';
        const charging = this.state === 'charge';
        const stomp = this.moving ? Math.sin(t * 5) : 0;
        const foot = cy + 50;
        const by = cy + 6 + (this.moving ? Math.abs(stomp) * -2 : 0) + (tired ? 4 : 0) + (charging ? 3 : 0)
            + (this.windFor === 'charge' ? Math.sin(windK * Math.PI * 3) * 1.5 : 0);
        const lava = p2 ? '#ffb13b' : '#ff8a3d';
        const pulse = p2 ? 0.8 + 0.2 * Math.sin(t * 7) : 0.75 + 0.1 * Math.sin(t * 3);
        Art.glow(ctx, cx, by - 10, 74, lava, tired ? 0.12 : 0.2 + (p2 ? 0.12 : 0));
        // Säulenbeine mit Krallenfüßen
        for (const s of [-1, 1]) {
            const lift = this.moving && Math.sign(stomp) === s ? 4 : 0;
            Art.shape(ctx, c => {
                c.moveTo(cx + s * 10, by + 16 - lift);
                c.lineTo(cx + s * 32, by + 16 - lift);
                c.lineTo(cx + s * 34, foot - 7 - lift);
                c.lineTo(cx + s * 9, foot - 7 - lift);
                c.closePath();
            }, { x: cx + Math.min(s * 9, s * 34), y: by + 16, w: 25, h: foot - by - 22 }, '#625da3', { lineWidth: 2.2 });
            Art.body(ctx, cx + s * 22, foot - 6 - lift, 16, 7, '#7d78bd', { lineWidth: 2.2 });
            ctx.fillStyle = '#f3e3c3';
            ctx.beginPath();
            for (let k = -1; k <= 1; k++) {
                const tx = cx + s * 22 + k * 8;
                ctx.moveTo(tx - 2.6, foot - 3 - lift);
                ctx.lineTo(tx, foot + 1.5 - lift);
                ctx.lineTo(tx + 2.6, foot - 3 - lift);
            }
            ctx.fill();
        }
        // Arme, die nach oben zeigen, liegen hinter dem Körper
        const spin = whirl ? this.whirlT * 10 : 0;
        const raise = this.windFor === 'whirl' ? windK : 0;
        this._arms(ctx, cx, by, t, spin, raise, tired, charging, p2, true);
        // Rumpf: klobiger Felsbrocken, oben breit
        Art.shape(ctx, c => {
            const B = BossStoneDemon.ROCK;
            const n = B.length;
            const pt = i => {
                const a = (i / n) * TAU - Math.PI / 2;
                const s = Math.sin(a);
                return [cx + Math.cos(a) * 46 * B[i % n] * (s > 0 ? 0.8 : 1.06), by - 4 + s * 34 * B[i % n]];
            };
            let p = pt(0);
            let q = pt(1);
            c.moveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
            for (let i = 1; i <= n; i++) {
                p = pt(i);
                q = pt(i + 1);
                c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
            }
            c.closePath();
        }, { x: cx - 48, y: by - 40, w: 96, h: 72 }, '#7d78bd', { glossy: true, lineWidth: 2.6 });
        // Gemeißelte Kanten
        ctx.strokeStyle = '#5a5598';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 34, by - 14);
        ctx.quadraticCurveTo(cx - 20, by - 22, cx - 8, by - 20);
        ctx.moveTo(cx + 34, by - 14);
        ctx.quadraticCurveTo(cx + 20, by - 22, cx + 8, by - 20);
        ctx.moveTo(cx - 22, by + 18);
        ctx.quadraticCurveTo(cx, by + 24, cx + 22, by + 18);
        ctx.stroke();
        // Steinsprenkel
        const S = BossStoneDemon.SPECKS;
        ctx.fillStyle = '#6a65ab';
        ctx.beginPath();
        for (let i = 0; i < S.length; i += 2) Kit915.dot(ctx, cx + S[i], by + S[i + 1], 1.7);
        ctx.fill();
        // Glühende Risse (in Phase 2 mehr und heller) und Rune auf der Brust
        this._cracks(ctx, cx, by, lava, pulse, p2);
        Art.glow(ctx, cx, by - 2, 18, lava, pulse * 0.7);
        ctx.strokeStyle = lava;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(cx, by - 2, 8.5, 0, TAU);
        ctx.moveTo(cx - 5, by - 5);
        ctx.lineTo(cx, by + 3);
        ctx.lineTo(cx + 5, by - 5);
        ctx.stroke();
        this._arms(ctx, cx, by, t, spin, raise, tired, charging, p2, false);
        // Schulterbrocken
        for (const s of [-1, 1]) Art.body(ctx, cx + s * 38, by - 24, 15, 12, '#8b86c9', { lineWidth: 2.2, rot: s * 0.3 });
        this._head(ctx, cx, by, t, lava, pulse, tired, dying, windK, charging, p2);
        if (whirl) {
            // Wirbel-Schlieren
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * 0.45;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const a = this.whirlT * 10 + (i * TAU) / 3;
                ctx.arc(cx, by - 6, 72, a, a + 0.9);
                ctx.moveTo(cx + Math.cos(a + TAU / 3) * 72, by - 6 + Math.sin(a + TAU / 3) * 72);
            }
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
        if (this.state === 'stunned') Kit915.dizzy(ctx, cx, by - 92, 30, 3, 5.5);
    }

    _cracks(ctx, cx, by, lava, pulse, p2) {
        const C = BossStoneDemon.CRACKS;
        const n = p2 ? C.length : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const p = C[i];
            ctx.moveTo(cx + p[0], by + p[1]);
            for (let j = 2; j < p.length; j += 2) ctx.lineTo(cx + p[j], by + p[j + 1]);
        }
        ctx.strokeStyle = '#2a1640';
        ctx.lineWidth = 4;
        ctx.stroke();
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * pulse;
        ctx.strokeStyle = lava;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        if (p2) {
            ctx.strokeStyle = '#fff1a8';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
        ctx.globalAlpha = prev;
        for (let i = 0; i < n; i++) Art.glow(ctx, cx + C[i][2], by + C[i][3], p2 ? 12 : 9, lava, 0.35 * pulse);
        if (!p2) return;
        // Lava tropft aus den Rissen
        const t = Art.time + this.seed;
        for (let i = 0; i < 3; i++) {
            const p = C[i * 2];
            const k = (t * 0.9 + i * 0.37) % 1;
            const x = cx + p[p.length - 2];
            const y = by + p[p.length - 1] + k * 16;
            Art.glow(ctx, x, y, 6, lava, (1 - k) * 0.6);
            ctx.globalAlpha = prev * (1 - k);
            ctx.fillStyle = '#ffd05a';
            ctx.beginPath();
            ctx.ellipse(x, y, 1.6, 2.4, 0, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = prev;
        }
    }

    // Sechs Schwertarme; back = nach oben zeigende Arme (hinter dem Körper), sonst die übrigen davor.
    _arms(ctx, cx, by, t, spin, raise, tired, charging, p2, back) {
        const base = BossStoneDemon.ARM_ANGLES;
        for (let i = 0; i < 6; i++) {
            const side = i < 3 ? -1 : 1;
            let a = base[i] + spin;
            if (!spin) {
                a += Math.sin(t * 2 + i) * 0.06;
                a -= side * raise * 0.5;
                if (tired) a += side * 0.45;
                if (charging) a += side * -0.25;
            }
            if ((Math.sin(a) < -0.35) !== back) continue;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const sx = cx + ca * 34;
            const sy = by - 6 + sa * 24;
            const hx = cx + ca * 62;
            const hy = by - 6 + sa * 44;
            Art.limb(ctx, sx, sy, hx, hy, 11, '#6a65ab', { lineWidth: 2 });
            Art.body(ctx, (sx + hx) / 2, (sy + hy) / 2, 7.5, 6.5, '#7d78bd', { lineWidth: 1.8, rot: a });
            this._sword(ctx, hx, hy, a, p2, raise > 0.5 && !spin);
            Art.body(ctx, hx, hy, 7.5, 7, '#8b86c9', { lineWidth: 1.8 });
        }
    }

    // Krummschwert in Armrichtung; die Klinge biegt sich immer nach oben.
    _sword(ctx, hx, hy, a, p2, glint) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(a);
        if (Math.cos(a) < 0) ctx.scale(1, -1);
        if (p2) Art.glow(ctx, 20, -3, 18, '#ff8a3d', 0.4);
        Art.shape(ctx, c => {
            c.moveTo(4, -2.8);
            c.quadraticCurveTo(20, -6.5, 37, -10);
            c.quadraticCurveTo(31, -1.5, 23, 3.6);
            c.quadraticCurveTo(13, 4.2, 4, 2.8);
            c.closePath();
        }, { x: 4, y: -10, w: 33, h: 14 }, p2 ? '#ffe7cf' : '#e8efff', { outline: '#4d56a0', lineWidth: 1.4 });
        ctx.strokeStyle = p2 ? '#ff8a3d' : '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(6, 1.6);
        ctx.quadraticCurveTo(16, 2.6, 24, 1.8);
        ctx.stroke();
        Art.limb(ctx, 4, -5.5, 4, 5.5, 2.8, '#ffd23f', { lineWidth: 1 });
        if (glint) Art.sparkle(ctx, 36, -9, 4 + Math.sin(Art.time * 25) * 1.2, '#ffffff');
        ctx.restore();
    }

    _head(ctx, cx, by, t, lava, pulse, tired, dying, windK, charging, p2) {
        const dip = (this.windFor === 'charge' ? windK * 7 : 0) + (charging ? 8 : 0) + (tired ? 6 : 0);
        const hx = cx + (tired ? 3 : 0);
        const hy = by - 42 + dip;
        ctx.save();
        Kit915.scaleAt(ctx, hx, hy + 8, 1.14, 1.14);
        // Hörner
        for (const s of [-1, 1]) {
            Art.shape(ctx, c => {
                c.moveTo(hx + s * 14, hy - 8);
                c.bezierCurveTo(hx + s * 34, hy - 10, hx + s * 44, hy - 26, hx + s * 40, hy - 46);
                c.bezierCurveTo(hx + s * 34, hy - 32, hx + s * 24, hy - 22, hx + s * 9, hy - 17);
                c.closePath();
            }, { x: hx + Math.min(s * 9, s * 44), y: hy - 46, w: 35, h: 38 }, '#f3e3c3', { lineWidth: 2 });
            if (p2) Art.glow(ctx, hx + s * 40, hy - 45, 9, lava, pulse * 0.8);
        }
        // Kopf
        Art.shape(ctx, c => {
            c.moveTo(hx - 20, hy - 14);
            c.quadraticCurveTo(hx, hy - 22, hx + 20, hy - 14);
            c.lineTo(hx + 24, hy + 4);
            c.quadraticCurveTo(hx + 22, hy + 16, hx + 12, hy + 20);
            c.lineTo(hx - 12, hy + 20);
            c.quadraticCurveTo(hx - 22, hy + 16, hx - 24, hy + 4);
            c.closePath();
        }, { x: hx - 24, y: hy - 22, w: 48, h: 42 }, '#8b86c9', { glossy: true, lineWidth: 2.4 });
        // Stirnwulst (böser Blick)
        Art.shape(ctx, c => {
            c.moveTo(hx - 21, hy - 11);
            c.lineTo(hx - 2, hy - 3);
            c.lineTo(hx + 2, hy - 3);
            c.lineTo(hx + 21, hy - 11);
            c.lineTo(hx + 19, hy - 16);
            c.lineTo(hx - 19, hy - 16);
            c.closePath();
        }, { x: hx - 21, y: hy - 16, w: 42, h: 13 }, '#5a5598', { lineWidth: 1.6 });
        // Glutaugen
        const ey = hy + 1;
        if (dying) {
            ctx.strokeStyle = '#ffb13b';
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const s of [-1, 1]) {
                ctx.moveTo(hx + s * 9 - 3.5, ey - 3.5);
                ctx.lineTo(hx + s * 9 + 3.5, ey + 3.5);
                ctx.moveTo(hx + s * 9 + 3.5, ey - 3.5);
                ctx.lineTo(hx + s * 9 - 3.5, ey + 3.5);
            }
            ctx.stroke();
        } else if (tired) {
            ctx.fillStyle = '#9a5a4a';
            ctx.beginPath();
            Kit915.oval(ctx, hx - 9, ey + 1, 4.5, 1.5);
            Kit915.oval(ctx, hx + 9, ey + 1, 4.5, 1.5);
            ctx.fill();
        } else {
            const hot = windK > 0 || charging || this.state === 'whirl';
            Art.glow(ctx, hx, ey, 30, lava, 0.55 + (hot ? 0.35 : 0));
            ctx.fillStyle = lava;
            ctx.beginPath();
            Kit915.oval(ctx, hx - 9, ey, 6, 4, 0.3);
            Kit915.oval(ctx, hx + 9, ey, 6, 4, -0.3);
            ctx.fill();
            ctx.fillStyle = p2 || hot ? '#ffffff' : '#fff1a8';
            ctx.beginPath();
            Kit915.oval(ctx, hx - 9 + this.look.x * 1.8, ey + this.look.y * 1.2, 2.6, 1.9);
            Kit915.oval(ctx, hx + 9 + this.look.x * 1.8, ey + this.look.y * 1.2, 2.6, 1.9);
            ctx.fill();
        }
        // Maul mit Glut und Hauern
        const open = charging || this.state === 'whirl' ? 1 : windK;
        const my = hy + 10;
        ctx.fillStyle = '#3a1630';
        ctx.beginPath();
        ctx.moveTo(hx - 14, my);
        for (let i = 1; i <= 7; i++) ctx.lineTo(hx - 14 + i * 4, my + (i % 2 ? 2.6 : 0));
        ctx.lineTo(hx + 14, my + 3 + open * 4);
        ctx.quadraticCurveTo(hx, my + 8 + open * 5, hx - 14, my + 3 + open * 4);
        ctx.closePath();
        ctx.fill();
        Art.glow(ctx, hx, my + 3, 16, lava, 0.35 + open * 0.45);
        for (const s of [-1, 1]) {
            Art.shape(ctx, c => {
                c.moveTo(hx + s * 10, my + 6 + open * 3);
                c.lineTo(hx + s * 13, my - 5);
                c.lineTo(hx + s * 6.5, my + 5 + open * 3);
                c.closePath();
            }, { x: hx + Math.min(s * 6.5, s * 13), y: my - 5, w: 6.5, h: 11 }, '#fff4dc', { lineWidth: 1.2 });
        }
        // Riss über dem Auge
        ctx.strokeStyle = '#2a1640';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx + 14, hy - 12);
        ctx.lineTo(hx + 17, hy - 6);
        ctx.lineTo(hx + 15, hy - 1);
        ctx.stroke();
        ctx.restore();
    }
}
// Winkel der sechs Arme (links oben, Mitte, unten; rechts oben, Mitte, unten)
BossStoneDemon.ARM_ANGLES = [
    Math.PI + 0.62, Math.PI - 0.02, Math.PI - 0.62,
    -0.62, 0.02, 0.62,
];
// Buckel des Felsrumpfs (Radius-Faktoren rundherum) und Sprenkel (x/y relativ zur Brustmitte)
BossStoneDemon.ROCK = [1, 0.93, 1.05, 0.96, 1.04, 0.92, 1.03, 0.95, 1.06, 0.94];
BossStoneDemon.SPECKS = [-30, 6, -18, 14, 26, -2, 18, 10, -8, 22, 36, -12, -38, -4, 8, -26];
// Risse im Fels (x/y-Punktfolgen relativ zur Brustmitte); die ersten drei gibt es immer
BossStoneDemon.CRACKS = [
    [-36, -12, -28, -6, -30, 4, -22, 10],
    [24, -26, 18, -16, 27, -8],
    [10, 12, 16, 20, 12, 27],
    [-14, -28, -10, -20, -16, -13],
    [32, 4, 24, 11, 31, 18],
    [-22, 15, -28, 23],
];

// â”€â”€ Training Arena Enemies â”€â”€

class TrainingTargetRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 3;
        this.maxHp = 3;
        this.contactDamage = false;
        this.damage = 0;
    }
    update(dt, world) {
        this.baseUpdate(dt, world);
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#999';
        ctx.fillRect(pos.x + 4, pos.y + 4, 16, 16);
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, this.w, this.h);
        ctx.restore();
    }
}

class TrainingPatrolRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 5;
        this.maxHp = 5;
        this.contactDamage = false;
        this.damage = 0;
        this.points = [
            { x: x - 30, y: y - 30 },
            { x: x + 30, y: y - 30 },
            { x: x + 30, y: y + 30 },
            { x: x - 30, y: y + 30 }
        ];
        this.targetIndex = 0;
    }
    update(dt, world) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const p = this.points[this.targetIndex];
        const a = Math.atan2(p.y - this.centerY(), p.x - this.centerX());
        this._moveWithCollision(Math.cos(a) * 55 * dt, Math.sin(a) * 55 * dt, world);
        if (vecDist(this.center(), p) < 10) this.targetIndex = (this.targetIndex + 1) % this.points.length;
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#7AF';
        ctx.fillRect(pos.x + 3, pos.y + 5, 20, 16);
        ctx.fillStyle = '#222';
        ctx.fillRect(pos.x + 7, pos.y + 10, 12, 5);
        ctx.strokeStyle = '#0AF';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, this.w, this.h);
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class TrainingShooterRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.contactDamage = false;
        this.damage = 0;
        this.shootTimer = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
        const dist = vecDist(mc, pc);
        this.shootTimer -= dt;
        if (dist < 260 && this.shootTimer <= 0 && typeof Game !== 'undefined') {
            this.shootTimer = 2.2;
            const a = angleBetween(mc, pc);
            Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(a) * 120, Math.sin(a) * 120, 1, 'enemy', 60));
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#FA7';
        ctx.fillRect(pos.x + 4, pos.y + 4, 16, 16);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(pos.x + 8, pos.y + 9, 8, 4);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx, cy - 4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F70';
        ctx.lineWidth = 2;
        ctx.strokeRect(pos.x, pos.y, this.w, this.h);
        ctx.restore();
    }
}

// â”€â”€ World 16: Fruit-Ninja enemies â”€â”€

class AppleNinja extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.contactDamage = true;
        this.rollTimer = 0;
        this.rollCooldown = 2.4;
        this.rolling = false;
        this.rollDir = { x: 0, y: 0 };
        this.facing = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
        const dist = vecDist(mc, pc);
        if (this.rolling) {
            this.x += this.rollDir.x * 220 * dt;
            this.y += this.rollDir.y * 220 * dt;
            this.rollTimer -= dt;
            if (this.rollTimer <= 0) this.rolling = false;
            return;
        }
        if (dist < 220) {
            this.facing = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(this.facing) * 55 * dt, Math.sin(this.facing) * 55 * dt, world);
            this.rollCooldown -= dt;
            if (this.rollCooldown <= 0) {
                this.rollCooldown = 2.2;
                this.rollTimer = 0.45;
                this.rolling = true;
                this.rollDir = vecNormalize(vecSub(pc, mc));
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = this.rolling ? '#D44' : '#E55';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2A2';
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 9);
        ctx.lineTo(cx, cy - 15);
        ctx.lineTo(cx + 5, cy - 9);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 4, cy - 1, 8, 3);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class KiwiNinja extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 3;
        this.maxHp = 3;
        this.contactDamage = false;
        this.spitTimer = 0;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
        const dist = vecDist(mc, pc);
        if (dist < 210) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * 35 * dt, Math.sin(a) * 35 * dt, world);
            this.spitTimer -= dt;
            if (this.spitTimer <= 0 && typeof Game !== 'undefined') {
                this.spitTimer = 2.7;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 130, Math.sin(a) * 130, 1, 'enemy', 50);
                p.slow = true;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#7DBD5B';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A7E27A';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 3, cy - 2, 6, 2);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 3, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BossFruitGiant extends Enemy {
    constructor(x, y) {
        super(x, y, 118, 100);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 18;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stompTimer = 3.5;
        this.explosionTimer = 0;
        this.triggeredExplosion = false;
        this.phase = 1;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = this.center();
        if (this.hp <= 28 && !this.triggeredExplosion) {
            this.triggeredExplosion = true;
            this.state = 'explode';
            this.explosionTimer = 1.1;
        }
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'explode') {
            this.explosionTimer -= dt;
            if (this.explosionTimer <= 0 && typeof Game !== 'undefined') {
                for (let i = 0; i < 12; i++) {
                    const a = (Math.PI * 2 * i) / 12;
                    Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(a) * 170, Math.sin(a) * 170, 1, 'enemy', 80));
                }
                if (particles) {
                    for (let i = 0; i < 12; i++) {
                        particles.push(new Particle(mc.x, mc.y, randRange(-80, 80), randRange(-80, 80), '#FFA', 0.6));
                    }
                }
                this.state = 'chase';
            }
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.stompTimer -= dt;
        if (this.stompTimer <= 0 && typeof Game !== 'undefined') {
            this.stompTimer = this.phase === 1 ? 3.8 : 2.7;
            for (let i = 0; i < 8; i++) {
                const sa = (Math.PI * 2 * i) / 8;
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 140, Math.sin(sa) * 140, 1, 'enemy', 70));
            }
            if (particles) {
                for (let i = 0; i < 6; i++) particles.push(new Particle(mc.x, mc.y, randRange(-60, 60), randRange(-60, 60), '#F70', 0.5));
            }
            this.state = 'stomp';
            this.stompTimer = this.phase === 1 ? 3.8 : 2.7;
        }
        if (this.hp <= 40) this.phase = 2;
        if (this.state === 'stomp') {
            this.state = 'chase';
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        ctx.fillStyle = '#E48';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 44, 36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7B3';
        ctx.beginPath();
        ctx.arc(cx - 28, cy - 18, 16, 0, Math.PI * 2);
        ctx.arc(cx + 18, cy - 22, 15, 0, Math.PI * 2);
        ctx.arc(cx + 30, cy + 10, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F90';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 8, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx - 11, cy - 2, 22, 4);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 6, cy - 6, 2, 0, Math.PI * 2);
        ctx.arc(cx + 6, cy - 6, 2, 0, Math.PI * 2);
        ctx.fill();
        if (this.state === 'explode') {
            ctx.strokeStyle = '#FF0';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, 42 + Math.sin(Date.now() / 70) * 4, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FRUCHT-GIGANT', cx, pos.y - 50);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 48, pos.y - 40, 96, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 40 ? '#F90' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 47, pos.y - 39, 94 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

// Extra standard enemies used by the late worlds

class Drone extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 18);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 58;
        this.damage = 1;
        this.contactDamage = true;
        this.detectionRange = 260;
        this.shootTimer = 0;
        this.hoverPhase = Math.random() * Math.PI * 2;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < this.detectionRange) {
            const a = angleBetween(mc, pc);
            const sway = Math.sin(this.hoverPhase) * 24;
            this.hoverPhase += dt * 5;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.cos(this.hoverPhase) * sway * dt,
                Math.sin(a) * this.speed * dt + Math.sin(this.hoverPhase * 0.7) * 8 * dt,
                world
            );
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && typeof Game !== 'undefined') {
                this.shootTimer = 2.2;
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(a) * 170, Math.sin(a) * 170, 1, 'enemy', 50));
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#778';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#AAB';
        ctx.beginPath();
        ctx.arc(cx, cy - 1, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 2, cy - 9, 4, 3);
        ctx.fillStyle = '#333';
        ctx.fillRect(cx - 8, cy + 5, 4, 2);
        ctx.fillRect(cx + 4, cy + 5, 4, 2);
        ctx.restore();
    }
}

class WalkingMushroom extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 22);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 28;
        this.damage = 1;
        this.contactDamage = true;
        this.sporeTimer = 0;
        this.wobble = Math.random() * Math.PI * 2;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 220) {
            const a = angleBetween(mc, pc);
            this.wobble += dt * 4;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.sin(this.wobble) * 8 * dt,
                Math.sin(a) * this.speed * dt,
                world
            );
            this.sporeTimer -= dt;
            if (this.sporeTimer <= 0 && typeof Game !== 'undefined' && dist < 120) {
                this.sporeTimer = 2.6;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 120, Math.sin(a) * 120, 1, 'enemy', 70);
                p.poison = true;
                Game.projectiles.push(p);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#6A4';
        ctx.beginPath();
        ctx.arc(cx, cy + 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A8C';
        ctx.beginPath();
        ctx.arc(cx, cy - 7, 9, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#DDD';
        ctx.fillRect(cx - 3, cy - 2, 6, 8);
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 6, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 6, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class SwampMosquito extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 16);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 72;
        this.damage = 1;
        this.contactDamage = true;
        this.detectionRange = 280;
        this.diveTimer = 0;
        this.wingPhase = Math.random() * Math.PI * 2;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < this.detectionRange) {
            const a = angleBetween(mc, pc);
            this.wingPhase += dt * 16;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.cos(this.wingPhase) * 10 * dt,
                Math.sin(a) * this.speed * dt + Math.sin(this.wingPhase * 1.2) * 6 * dt,
                world
            );
            this.diveTimer -= dt;
            if (this.diveTimer <= 0 && dist < 130) {
                this.diveTimer = 1.7;
                this._moveWithCollision(Math.cos(a) * 140 * dt, Math.sin(a) * 140 * dt, world);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#485';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#CFC';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B8E';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 4);
        ctx.lineTo(cx - 14, cy - 8);
        ctx.moveTo(cx + 8, cy - 4);
        ctx.lineTo(cx + 14, cy - 8);
        ctx.stroke();
        ctx.restore();
    }
}

class CrocodileKid extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 22);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 42;
        this.damage = 2;
        this.contactDamage = true;
        this.spitTimer = 0;
        this.isKeyGhost = true;
        this.droppedKey = false;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 220) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.spitTimer -= dt;
            if (this.spitTimer <= 0 && typeof Game !== 'undefined' && dist < 150) {
                this.spitTimer = 2.4;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 135, Math.sin(a) * 135, 1, 'enemy', 60);
                p.poison = true;
                Game.projectiles.push(p);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#3A6A3A';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 11, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5B8';
        ctx.beginPath();
        ctx.arc(cx + 6, cy - 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 4, cy - 3, 6, 2);
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 5, 1.5, 0, Math.PI * 2);
        ctx.arc(cx + 2, cy - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        if (this.isKeyGhost) {
            ctx.fillStyle = '#FFD700';
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(cx, cy - 14, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(cx - 1, cy - 10, 2, 6);
            ctx.fillRect(cx + 1, cy - 10, 5, 2);
        }
        ctx.restore();
    }
}

class IcePenguin extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 46;
        this.damage = 1;
        this.contactDamage = true;
        this.shootTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 240) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && typeof Game !== 'undefined') {
                this.shootTimer = 2.8;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 140, Math.sin(a) * 140, 1, 'enemy', 55);
                p.slow = true;
                Game.projectiles.push(p);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#DFF';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9CF';
        ctx.beginPath();
        ctx.arc(cx, cy - 8, 8, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 2, cy - 4, 4, 4);
        ctx.fillStyle = '#F90';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 1);
        ctx.lineTo(cx + 4, cy + 2);
        ctx.lineTo(cx, cy + 4);
        ctx.fill();
        ctx.restore();
    }
}

class LavaBall extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 20);
        this.hp = 3;
        this.maxHp = 3;
        this.speed = 62;
        this.damage = 1;
        this.contactDamage = true;
        this.burnTimer = 0;
        this.pulse = Math.random() * Math.PI * 2;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 240) {
            const a = angleBetween(mc, pc);
            this.pulse += dt * 10;
            this._moveWithCollision(
                Math.cos(a) * this.speed * dt + Math.cos(this.pulse) * 12 * dt,
                Math.sin(a) * this.speed * dt + Math.sin(this.pulse) * 12 * dt,
                world
            );
            this.burnTimer -= dt;
            if (this.burnTimer <= 0 && typeof Game !== 'undefined' && dist < 120) {
                this.burnTimer = 2.0;
                for (let i = 0; i < 4; i++) {
                    const sa = (Math.PI * 2 * i) / 4;
                    Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 110, Math.sin(sa) * 110, 1, 'enemy', 45));
                }
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#F60';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFB000';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFF0A0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 10 + Math.sin(Date.now() / 120 + this.pulse) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class MiniTRex extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 22);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 60;
        this.damage = 1;
        this.contactDamage = true;
        this.lungeTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        const a = angleBetween(mc, pc);
        if (dist < 220) {
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.lungeTimer -= dt;
            if (this.lungeTimer <= 0 && dist < 120) {
                this.lungeTimer = 2.5;
                this._moveWithCollision(Math.cos(a) * 130 * dt, Math.sin(a) * 130 * dt, world);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#7C5';
        ctx.beginPath();
        ctx.ellipse(cx - 2, cy + 1, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5A3';
        ctx.beginPath();
        ctx.arc(cx + 5, cy - 3, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 1, cy - 2, 5, 2);
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx + 3, cy - 4, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Triceratops extends Enemy {
    constructor(x, y) {
        super(x, y, 34, 24);
        this.hp = 9;
        this.maxHp = 9;
        this.speed = 38;
        this.damage = 2;
        this.contactDamage = true;
        this.chargeTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        const a = angleBetween(mc, pc);
        this.chargeTimer -= dt;
        if (dist < 240) {
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            if (this.chargeTimer <= 0 && dist < 160) {
                this.chargeTimer = 3.2;
                this._moveWithCollision(Math.cos(a) * 150 * dt, Math.sin(a) * 150 * dt, world);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#5A9';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 13, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7BC';
        ctx.beginPath();
        ctx.arc(cx + 8, cy - 2, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3A6';
        ctx.fillRect(cx - 14, cy + 1, 12, 4);
        ctx.fillRect(cx - 2, cy + 8, 14, 4);
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 1, cy - 2, 5, 2);
        ctx.fillRect(cx + 7, cy - 2, 5, 2);
        ctx.restore();
    }
}

class BossStingRex extends Enemy {
    constructor(x, y) {
        super(x, y, 120, 96);
        this.hp = 90;
        this.maxHp = 90;
        this.speed = 24;
        this.damage = 3;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 0;
        this.roarTimer = 4;
        this.tailTimer = 3;
        this.tailActive = 0;
        this.phase = 1;
    }

    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 45 && this.phase === 1) {
            this.phase = 2;
            this.speed = 32;
            this.tailTimer = 2.2;
        }

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const a = angleBetween(mc, pc);

        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }

        if (this.tailActive > 0) {
            this.tailActive -= dt;
            const tailX = this.centerX() - 30;
            const dist = vecDist({ x: tailX, y: this.centerY() }, pc);
            if (dist < 160) {
                player.takeDamage(3, angleBetween({ x: tailX, y: this.centerY() }, pc), 400);
                player.applySlow(1.2, 0.65);
            }
            return;
        }

        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);

        this.roarTimer -= dt;
        this.tailTimer -= dt;
        if (this.roarTimer <= 0) {
            this.roarTimer = this.phase === 1 ? 4.5 : 3.2;
            if (vecDist(mc, pc) < 220) {
                player.applySlow(2.0, 0.55);
                player.takeDamage(1, a, 120);
            }
            if (particles) {
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(mc.x, mc.y, randRange(-70, 70), randRange(-70, 70), '#FFDD88', 0.5));
                }
            }
        }

        if (this.tailTimer <= 0) {
            this.tailTimer = this.phase === 1 ? 3.5 : 2.5;
            this.tailActive = 0.8;
            if (typeof Game !== 'undefined') {
                Game.camera.shake(6, 0.2);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#7C4';
        ctx.beginPath();
        ctx.ellipse(cx - 8, cy + 6, 42, 24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5A3';
        ctx.beginPath();
        ctx.arc(cx + 28, cy - 6, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8DD';
        ctx.beginPath();
        ctx.arc(cx + 18, cy - 12, 6, 0, Math.PI * 2);
        ctx.arc(cx + 30, cy - 12, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 18, cy - 8, 5, 2);
        ctx.fillRect(cx + 30, cy - 8, 5, 2);
        ctx.strokeStyle = '#9F5';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 18, cy + 20);
        ctx.lineTo(cx - 70, cy + 10);
        ctx.stroke();
        if (this.tailActive > 0) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(cx - 20, cy + 20);
            ctx.lineTo(cx - 90, cy + 30);
            ctx.stroke();
        }
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STACHEL-T-REX', cx, pos.y - 46);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 36, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 45 ? '#7C4' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 35, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

class TimeClock extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 24, 24);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 52;
        this.contactDamage = true;
        this.detectionRange = 240;
        this.beamTimer = 0;
        this.spin = Math.random() * Math.PI * 2;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.spin += dt * 4;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < this.detectionRange) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.beamTimer -= dt;
            if (this.beamTimer <= 0 && typeof Game !== 'undefined') {
                this.beamTimer = 2.2;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 155, Math.sin(a) * 155, 1, 'enemy', 50);
                p.slow = true;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#CCD';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7EF';
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F90';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + Math.cos(this.spin) * 12, cy - 18);
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx + Math.cos(this.spin + Math.PI / 2) * 6, cy - 20);
        ctx.stroke();
        if (this.isKeyGhost) {
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(cx - 1, cy - 18, 2, 6);
            ctx.beginPath();
            ctx.arc(cx - 1, cy - 20, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class BossTimeSphere extends Enemy {
    constructor(x, y) {
        super(x, y, 110, 110);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 24;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.burstTimer = 2.5;
        this.rollTimer = 4;
        this.phase = 1;
        this.spin = 0;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 40) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        this.spin += dt * (this.phase === 1 ? 3 : 5);
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.burstTimer -= dt;
        if (this.burstTimer <= 0 && typeof Game !== 'undefined') {
            this.burstTimer = this.phase === 1 ? 2.5 : 1.6;
            const count = this.phase === 1 ? 8 : 14;
            for (let i = 0; i < count; i++) {
                const sa = (Math.PI * 2 * i) / count + this.spin;
                const p = new Projectile(mc.x, mc.y, Math.cos(sa) * 160, Math.sin(sa) * 160, 1, 'enemy', 55);
                if (this.phase === 2 && i % 3 === 0) p.slow = true;
                Game.projectiles.push(p);
            }
            if (particles) {
                for (let i = 0; i < 8; i++) particles.push(new Particle(mc.x, mc.y, randRange(-70, 70), randRange(-70, 70), '#7EF', 0.5));
            }
        }
        this.rollTimer -= dt;
        if (this.rollTimer <= 0) {
            this.rollTimer = this.phase === 1 ? 4 : 2.5;
            if (typeof Game !== 'undefined') Game.camera.shake(5, 0.15);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#CCD';
        ctx.beginPath();
        ctx.arc(cx, cy, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 12, cy - 10, 8, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx - 12, cy - 10, 3, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy - 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FF0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 46 + Math.sin(this.spin) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#F90';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ZEITKUGEL', cx, pos.y - 46);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 38, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 40 ? '#7EF' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 37, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

class ShadowCrocodileRunner extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 28, 22);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = 44;
        this.contactDamage = true;
        this.throwTimer = 0;
        this.spin = 0;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.spin += dt * 6;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 240) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.throwTimer -= dt;
            if (this.throwTimer <= 0 && typeof Game !== 'undefined') {
                this.throwTimer = 2.4;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 145, Math.sin(a) * 145, 1, 'enemy', 55);
                p.bouncesLeft = 1;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#244';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#556';
        ctx.beginPath();
        ctx.arc(cx + 7, cy - 3, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(cx + 5, cy - 4, 6, 2);
        ctx.fillStyle = '#9F9';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 5, 1.4, 0, Math.PI * 2);
        ctx.arc(cx + 2, cy - 5, 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (this.isKeyGhost) {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(cx, cy - 14, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class BossShadowCrocodile extends Enemy {
    constructor(x, y) {
        super(x, y, 118, 86);
        this.hp = 85;
        this.maxHp = 85;
        this.speed = 28;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.whirlTimer = 3.5;
        this.leapTimer = 6;
        this.phase = 1;
        this.whirlT = 0;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 42) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'whirl') {
            this.whirlT += dt;
            if (vecDist(mc, pc) < 100) player.takeDamage(2, angleBetween(mc, pc), 180);
            if (this.whirlT > 1.5) {
                this.state = 'chase';
                this.whirlT = 0;
            }
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.whirlTimer -= dt;
        this.leapTimer -= dt;
        if (this.whirlTimer <= 0 && typeof Game !== 'undefined') {
            this.whirlTimer = this.phase === 1 ? 3.5 : 2.4;
            for (let i = 0; i < 6; i++) {
                const sa = (Math.PI * 2 * i) / 6;
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 125, Math.sin(sa) * 125, 1, 'enemy', 50));
            }
            this.state = 'whirl';
            this.whirlT = 0;
        }
        if (this.leapTimer <= 0 && typeof Game !== 'undefined') {
            this.leapTimer = this.phase === 1 ? 6 : 4;
            this.x += Math.cos(a) * 140;
            this.y += Math.sin(a) * 140;
            Game.camera.shake(5, 0.15);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#345';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 40, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#567';
        ctx.beginPath();
        ctx.arc(cx + 20, cy - 6, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.arc(cx + 24, cy - 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9F9';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy + 10);
        ctx.lineTo(cx - 70, cy + 2);
        ctx.stroke();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCHATTEN-KROKODIL', cx, pos.y - 44);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 36, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 42 ? '#4F4' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 35, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

class FootballEnemy extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 22, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 60;
        this.rollT = 0;
        this.contactDamage = true;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 250) {
            const a = angleBetween(mc, pc);
            this.rollT += dt * 9;
            this._moveWithCollision(Math.cos(a) * this.speed * dt + Math.sin(this.rollT) * 10 * dt, Math.sin(a) * this.speed * dt, world);
            if (dist < 90 && typeof Game !== 'undefined') {
                player.takeDamage(1, a, 140);
                Game.camera.shake(2, 0.08);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#F90';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F55';
        ctx.beginPath();
        ctx.arc(cx, cy - 9, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.fillRect(cx - 4, cy - 2, 8, 2);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 2, 1.3, 0, Math.PI * 2);
        ctx.arc(cx + 3, cy - 2, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BossFootball extends Enemy {
    constructor(x, y) {
        super(x, y, 128, 92);
        this.hp = 90;
        this.maxHp = 90;
        this.speed = 20;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.popTimer = 2.8;
        this.rollTimer = 1.4;
        this.inflate = 1;
        this.phase = 1;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 45) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        if (this.state === 'pop') {
            this.inflate += dt * 3;
            if (this.inflate > 1.35) {
                this.state = 'chase';
                this.popTimer = this.phase === 1 ? 2.8 : 1.9;
            }
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt + Math.sin(Date.now() / 180) * 18 * dt, Math.sin(a) * this.speed * dt, world);
        this.rollTimer -= dt;
        this.popTimer -= dt;
        if (this.popTimer <= 0 && typeof Game !== 'undefined') {
            this.state = 'pop';
            this.inflate = 0.9;
            for (let i = 0; i < (this.phase === 1 ? 6 : 10); i++) {
                const sa = (Math.PI * 2 * i) / (this.phase === 1 ? 6 : 10);
                Game.projectiles.push(new Projectile(mc.x, mc.y, Math.cos(sa) * 150, Math.sin(sa) * 150, 1, 'enemy', 50));
            }
            if (particles) {
                for (let i = 0; i < 8; i++) particles.push(new Particle(mc.x, mc.y, randRange(-80, 80), randRange(-80, 80), '#F55', 0.4));
            }
        }
        if (this.rollTimer <= 0) {
            this.rollTimer = this.phase === 1 ? 1.4 : 0.9;
            this.x += randRange(-24, 24);
            this.y += randRange(-24, 24);
            if (typeof Game !== 'undefined') Game.camera.shake(4, 0.1);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#8B2';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 46 * this.inflate, 34 * this.inflate, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D22';
        ctx.beginPath();
        ctx.arc(cx, cy - 28, 16 * this.inflate, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.fillRect(cx - 14, cy - 2, 28, 4);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx - 8, cy - 6, 2, 0, Math.PI * 2);
        ctx.arc(cx + 8, cy - 6, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FUßBALL', cx, pos.y - 44);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 36, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 45 ? '#F90' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 35, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}

class ScrapRaccoon extends Enemy {
    constructor(x, y, keyHolder = false) {
        super(x, y, 24, 20);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 54;
        this.throwTimer = 0;
        this.contactDamage = true;
        this.isKeyGhost = !!keyHolder;
        this.droppedKey = false;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);
        if (dist < 260) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
            this.throwTimer -= dt;
            if (this.throwTimer <= 0 && typeof Game !== 'undefined') {
                this.throwTimer = 2.2;
                const p = new Projectile(mc.x, mc.y, Math.cos(a) * 155, Math.sin(a) * 155, 1, 'enemy', 50);
                p.bouncesLeft = 0;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#A98';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EEE';
        ctx.beginPath();
        ctx.arc(cx + 5, cy - 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(cx + 3, cy - 5, 4, 2);
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx - 3, cy - 4, 1.3, 0, Math.PI * 2);
        ctx.arc(cx + 1, cy - 4, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BossScrapRaccoon extends Enemy {
    constructor(x, y) {
        super(x, y, 120, 88);
        this.hp = 80;
        this.maxHp = 80;
        this.speed = 26;
        this.isBoss = true;
        this.contactDamage = false;
        this.state = 'intro';
        this.introTimer = 2;
        this.throwTimer = 2;
        this.rushTimer = 5;
        this.phase = 1;
    }
    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.hp <= 40) this.phase = 2;
        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        if (this.state === 'intro') {
            this.introTimer -= dt;
            if (this.introTimer <= 0) this.state = 'chase';
            return;
        }
        const a = angleBetween(mc, pc);
        this._moveWithCollision(Math.cos(a) * this.speed * dt, Math.sin(a) * this.speed * dt, world);
        this.throwTimer -= dt;
        this.rushTimer -= dt;
        if (this.throwTimer <= 0 && typeof Game !== 'undefined') {
            this.throwTimer = this.phase === 1 ? 2 : 1.3;
            for (let i = -1; i <= 1; i++) {
                const sa = a + i * 0.18;
                const p = new Projectile(mc.x, mc.y, Math.cos(sa) * 170, Math.sin(sa) * 170, 1, 'enemy', 55);
                Game.projectiles.push(p);
            }
            if (particles) {
                for (let i = 0; i < 8; i++) particles.push(new Particle(mc.x, mc.y, randRange(-70, 70), randRange(-70, 70), '#A98', 0.4));
            }
        }
        if (this.rushTimer <= 0) {
            this.rushTimer = this.phase === 1 ? 5 : 3.5;
            this.x += randRange(-60, 60);
            this.y += randRange(-40, 40);
            if (typeof Game !== 'undefined') Game.camera.shake(5, 0.15);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        if (this.dead) return;
        ctx.save();
        if (this.isFlashing()) ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#8A7';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 42, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#DCC';
        ctx.beginPath();
        ctx.arc(cx + 22, cy - 6, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WASCHBÄR', cx, pos.y - 42);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(cx - 50, pos.y - 34, 100, 7, 3);
        ctx.fill();
        ctx.fillStyle = this.hp > 40 ? '#A9F' : '#F44';
        ctx.beginPath();
        ctx.roundRect(cx - 49, pos.y - 33, 98 * (this.hp / this.maxHp), 5, 2);
        ctx.fill();
        ctx.restore();
    }
}
