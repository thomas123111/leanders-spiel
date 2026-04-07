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
    rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

    takeDamage(amount, knockbackAngle, knockbackForce) {
        if (this.iFrames > 0 || this.dead) return;
        this.hp -= amount;
        this.iFrames = 0.2;
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

        // Apply knockback
        if (Math.abs(this.knockbackVx) > 1 || Math.abs(this.knockbackVy) > 1) {
            if (!this.phasesThroughWalls) {
                this._moveWithCollision(this.knockbackVx * dt, this.knockbackVy * dt, world);
            } else {
                this.x += this.knockbackVx * dt;
                this.y += this.knockbackVy * dt;
            }
            this.knockbackVx *= 0.85;
            this.knockbackVy *= 0.85;
        }
    }

    _moveWithCollision(dx, dy, world) {
        // Move X
        this.x += dx;
        const xCols = world.collideRect(this.rect());
        for (const wall of xCols) {
            if (rectOverlap(this.rect(), wall)) {
                if (dx > 0) this.x = wall.x - this.w;
                else if (dx < 0) this.x = wall.x + wall.w;
            }
        }
        // Move Y
        this.y += dy;
        const yCols = world.collideRect(this.rect());
        for (const wall of yCols) {
            if (rectOverlap(this.rect(), wall)) {
                if (dy > 0) this.y = wall.y - this.h;
                else if (dy < 0) this.y = wall.y + wall.h;
            }
        }
    }
}

// ── Ghost ──
class Ghost extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 55;
        this.phasesThroughWalls = true;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.hue = randInt(180, 340); // colorful
        this.detectionRange = 200;
        this.chasing = false;
        this.alpha = 0.6;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        const dist = vecDist(
            { x: this.centerX(), y: this.centerY() },
            { x: player.x + player.w / 2, y: player.y + player.h / 2 }
        );

        this.chasing = dist < this.detectionRange;
        if (this.chasing) {
            this.alpha = lerp(this.alpha, 0.9, dt * 3);
            const angle = angleBetween(
                { x: this.centerX(), y: this.centerY() },
                { x: player.x + player.w / 2, y: player.y + player.h / 2 }
            );
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        } else {
            this.alpha = lerp(this.alpha, 0.5, dt * 2);
            // Idle floating
            this.x += Math.sin(Date.now() / 1000 + this.bobOffset) * 15 * dt;
            this.y += Math.cos(Date.now() / 800 + this.bobOffset) * 10 * dt;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);

        if (this.dead) {
            // Death poof
            const alpha = this.deathTimer / 0.4;
            const scale = 1 + (1 - alpha) * 0.5;
            ctx.save();
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillStyle = `hsl(${this.hue}, 70%, 70%)`;
            ctx.beginPath();
            ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2, this.w * scale / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        const bob = Math.sin(Date.now() / 300 + this.bobOffset) * 3;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        ctx.save();
        ctx.globalAlpha = flash ? 0.3 : this.alpha;

        // Ghost body
        ctx.fillStyle = `hsl(${this.hue}, 70%, 65%)`;
        ctx.beginPath();
        ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2 + bob - 4, this.w / 2, Math.PI, 0);
        ctx.lineTo(pos.x + this.w, pos.y + this.h + bob);
        // Wavy bottom
        const segments = 4;
        const segW = this.w / segments;
        for (let i = segments; i > 0; i--) {
            const sx = pos.x + i * segW;
            const wave = Math.sin(Date.now() / 200 + i) * 3;
            ctx.lineTo(sx - segW / 2, pos.y + this.h + bob - 4 + wave);
            ctx.lineTo(sx - segW, pos.y + this.h + bob);
        }
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(pos.x + this.w * 0.35, pos.y + this.h * 0.35 + bob, 4, 0, Math.PI * 2);
        ctx.arc(pos.x + this.w * 0.65, pos.y + this.h * 0.35 + bob, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(pos.x + this.w * 0.35, pos.y + this.h * 0.35 + bob + 1, 2, 0, Math.PI * 2);
        ctx.arc(pos.x + this.w * 0.65, pos.y + this.h * 0.35 + bob + 1, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ── Key Ghost ──
class KeyGhost extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 70;
        this.hue = 45; // golden
        this.w = 28;
        this.h = 28;
        this.detectionRange = 250;
        this.isKeyGhost = true;
        this.droppedKey = false;
    }

    draw(ctx, camera) {
        super.draw(ctx, camera);
        if (this.dead) return;

        // Golden glow
        const pos = camera.worldToScreen(this.centerX(), this.centerY());
        const bob = Math.sin(Date.now() / 300 + this.bobOffset) * 3;
        ctx.save();
        ctx.globalAlpha = 0.2 + Math.sin(Date.now() / 500) * 0.1;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + bob, this.w * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Key icon
        const keyPos = camera.worldToScreen(this.x + this.w / 2 - 4, this.y - 12);
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(keyPos.x, keyPos.y + bob, 8, 5);
        ctx.fillRect(keyPos.x + 6, keyPos.y + bob + 1, 4, 3);
        ctx.beginPath();
        ctx.arc(keyPos.x + 3, keyPos.y + bob, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ── Boss Ghost (Welt 1) ──
class BossGhost extends Enemy {
    constructor(x, y) {
        super(x, y, 80, 80);
        this.hp = 40;
        this.maxHp = 40;
        this.speed = 40;
        this.damage = 2; // 1/2 heart
        this.phasesThroughWalls = true;
        this.isBoss = true;
        this.contactDamage = false; // Boss hurts via clap, not contact
        this.phase = 1;
        this.bobOffset = 0;
        this.alpha = 0.8;

        // Attack patterns
        this.clapTimer = 0;
        this.clapCooldown = 3;
        this.clapping = false;
        this.clapProgress = 0;
        this.clapDuration = 1.4;
        this.clapDamageDealt = false;
        this.clapRange = 130; // wide clap range

        this.spawnTimer = 8;
        this.spawnCooldown = 8;

        this.state = 'intro'; // 'intro', 'chase', 'clap', 'stunned'
        this.introTimer = 2;
        this.stunnedTimer = 0;
    }

    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        // Phase transition
        if (this.hp <= 20 && this.phase === 1) {
            this.phase = 2;
            this.speed = 60;
            this.spawnCooldown = 5;
        }

        const playerCenter = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const myCenter = { x: this.centerX(), y: this.centerY() };

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
            // At clap moment (0.7s into animation), deal damage in wide area
            if (this.clapProgress >= 0.7 && !this.clapDamageDealt) {
                this.clapDamageDealt = true;
                const dist = vecDist(myCenter, playerCenter);
                if (dist < this.clapRange) {
                    player.takeDamage(this.damage + 1, angleBetween(myCenter, playerCenter), 350);
                    if (particles) {
                        for (let i = 0; i < 12; i++) {
                            const a = (Math.PI * 2 * i) / 12;
                            particles.push(new Particle(
                                myCenter.x + Math.cos(a) * 40,
                                myCenter.y + Math.sin(a) * 40,
                                Math.cos(a) * 150, Math.sin(a) * 150,
                                '#FF0', 0.6
                            ));
                        }
                    }
                }
                // Shockwave particles even if miss (visual feedback)
                if (particles) {
                    for (let i = 0; i < 8; i++) {
                        const a = (Math.PI * 2 * i) / 8;
                        particles.push(new Particle(
                            myCenter.x + Math.cos(a) * 20,
                            myCenter.y + Math.sin(a) * 20,
                            Math.cos(a) * 100, Math.sin(a) * 100,
                            '#0F0', 0.4
                        ));
                    }
                }
            }
            if (this.clapProgress >= this.clapDuration) {
                this.state = 'stunned';
                this.stunnedTimer = 1.8;
                this.clapProgress = 0;
                this.clapping = false;
            }
            return;
        }

        // Chase
        const dist = vecDist(myCenter, playerCenter);
        const angle = angleBetween(myCenter, playerCenter);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;

        // Clap attack - triggers at wider range
        this.clapTimer -= dt;
        if (this.clapTimer <= 0 && dist < 200) {
            this.state = 'clap';
            this.clapping = true;
            this.clapProgress = 0;
            this.clapDamageDealt = false;
            this.clapTimer = this.clapCooldown;
        }

        // Spawn mini ghosts
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = this.spawnCooldown;
            const count = this.phase === 1 ? 2 : 3;
            for (let i = 0; i < count; i++) {
                const spawnAngle = (Math.PI * 2 * i) / count;
                const g = new Ghost(
                    this.centerX() + Math.cos(spawnAngle) * 60,
                    this.centerY() + Math.sin(spawnAngle) * 60
                );
                g.hp = 2;
                g.maxHp = 2;
                g.detectionRange = 300;
                enemies.push(g);
            }
            if (particles) {
                for (let i = 0; i < 6; i++) {
                    particles.push(new Particle(
                        this.centerX(), this.centerY(),
                        randRange(-80, 80), randRange(-80, 80),
                        '#0F0', 0.6
                    ));
                }
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const bob = Math.sin(Date.now() / 400) * 5;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        if (this.dead) {
            const alpha = this.deathTimer / 0.4;
            ctx.save();
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillStyle = '#0F0';
            ctx.beginPath();
            ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2, this.w * (1 + (1 - alpha)), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.globalAlpha = flash ? 0.3 : this.alpha;

        // Body
        ctx.fillStyle = this.state === 'stunned' ? '#0a5' : '#0C0';
        ctx.beginPath();
        ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2 + bob - 10, this.w / 2, Math.PI, 0);
        ctx.lineTo(pos.x + this.w, pos.y + this.h + bob);
        const segments = 6;
        const segW = this.w / segments;
        for (let i = segments; i > 0; i--) {
            const sx = pos.x + i * segW;
            const wave = Math.sin(Date.now() / 200 + i) * 5;
            ctx.lineTo(sx - segW / 2, pos.y + this.h + bob - 6 + wave);
            ctx.lineTo(sx - segW, pos.y + this.h + bob);
        }
        ctx.closePath();
        ctx.fill();

        // Eyes (angry)
        ctx.fillStyle = '#FF0';
        const eyeY = pos.y + this.h * 0.3 + bob;
        ctx.beginPath();
        ctx.arc(pos.x + this.w * 0.35, eyeY, 8, 0, Math.PI * 2);
        ctx.arc(pos.x + this.w * 0.65, eyeY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F00';
        ctx.beginPath();
        ctx.arc(pos.x + this.w * 0.35, eyeY + 1, 4, 0, Math.PI * 2);
        ctx.arc(pos.x + this.w * 0.65, eyeY + 1, 4, 0, Math.PI * 2);
        ctx.fill();

        // Eyebrow (angry)
        ctx.strokeStyle = '#080';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pos.x + this.w * 0.2, eyeY - 10);
        ctx.lineTo(pos.x + this.w * 0.45, eyeY - 6);
        ctx.moveTo(pos.x + this.w * 0.8, eyeY - 10);
        ctx.lineTo(pos.x + this.w * 0.55, eyeY - 6);
        ctx.stroke();

        // Clap animation - two big hands coming together
        if (this.state === 'clap') {
            const t = this.clapProgress / this.clapDuration;
            let handSpread;
            if (t < 0.45) handSpread = 1 - t / 0.45; // hands wind up and come together
            else if (t < 0.55) handSpread = 0; // CLAP moment
            else handSpread = (t - 0.55) / 0.45; // hands pull back

            const spreadDist = handSpread * 55;
            const leftX = pos.x - 15 - spreadDist;
            const rightX = pos.x + this.w + 15 + spreadDist;
            const handY = pos.y + this.h * 0.45 + bob;
            const handSize = 22;

            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#0C0';

            // Left hand (palm shape)
            ctx.beginPath();
            ctx.ellipse(leftX, handY, handSize, handSize * 0.7, 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0A0';
            // Fingers left
            for (let f = -1; f <= 1; f++) {
                ctx.beginPath();
                ctx.arc(leftX + 10, handY + f * 8, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Right hand
            ctx.fillStyle = '#0C0';
            ctx.beginPath();
            ctx.ellipse(rightX, handY, handSize, handSize * 0.7, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#0A0';
            for (let f = -1; f <= 1; f++) {
                ctx.beginPath();
                ctx.arc(rightX - 10, handY + f * 8, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Shockwave on clap impact
            if (t >= 0.45 && t <= 0.7) {
                const shockT = (t - 0.45) / 0.25;
                ctx.globalAlpha = (1 - shockT) * 0.7;
                ctx.strokeStyle = '#FF0';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(pos.x + this.w / 2, handY, 30 + shockT * 120, 0, Math.PI * 2);
                ctx.stroke();
                // Inner ring
                ctx.strokeStyle = '#FFA500';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pos.x + this.w / 2, handY, 15 + shockT * 80, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Warning indicator before clap
            if (t < 0.3) {
                ctx.globalAlpha = 0.15 + Math.sin(t * 30) * 0.1;
                ctx.fillStyle = '#F00';
                ctx.beginPath();
                ctx.arc(pos.x + this.w / 2, handY, this.clapRange || 130, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        const barW = this.w;
        const barH = 6;
        const barX = pos.x;
        const barY = pos.y - 14 + bob;
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = this.hp > 15 ? '#0F0' : this.hp > 8 ? '#FF0' : '#F00';
        ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.restore();
    }
}

// ── Particle ──
class Particle {
    constructor(x, y, vx, vy, color, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.lifetime = lifetime || 0.5;
        this.maxLifetime = this.lifetime;
        this.radius = randRange(2, 5);
        this.dead = false;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.dead = true;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const alpha = this.lifetime / this.maxLifetime;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.radius * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
