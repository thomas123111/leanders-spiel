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
        const gcx = pos.x + this.w / 2;
        const gcy = pos.y + this.h / 2;

        if (this.dead) {
            // Balloon POP! animation
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();

            // Expanding burst fragments
            const numFragments = 8;
            for (let i = 0; i < numFragments; i++) {
                const angle = (Math.PI * 2 * i) / numFragments + t * 0.5;
                const dist = t * 40;
                const fragAlpha = 1 - t;
                const fragSize = (1 - t) * 6;
                ctx.globalAlpha = fragAlpha * 0.8;
                ctx.fillStyle = `hsl(${this.hue + i * 20}, 80%, 65%)`;
                ctx.beginPath();
                ctx.arc(
                    gcx + Math.cos(angle) * dist,
                    gcy + Math.sin(angle) * dist,
                    fragSize, 0, Math.PI * 2
                );
                ctx.fill();
            }
            // Central flash
            ctx.globalAlpha = (1 - t) * 0.5;
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(gcx, gcy, (1 - t) * 15 + t * 25, 0, Math.PI * 2);
            ctx.fill();
            // "POP" text
            if (t < 0.6) {
                ctx.globalAlpha = (0.6 - t) * 1.5;
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('POP!', gcx, gcy - 10 - t * 20);
            }
            ctx.restore();
            return;
        }

        const bob = Math.sin(Date.now() / 300 + this.bobOffset) * 3;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        ctx.save();
        ctx.globalAlpha = flash ? 0.3 : this.alpha;

        // Glow underneath
        ctx.globalAlpha = (flash ? 0.1 : 0.15);
        ctx.fillStyle = `hsl(${this.hue}, 80%, 70%)`;
        ctx.beginPath();
        ctx.arc(gcx, gcy + bob, this.w * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = flash ? 0.3 : this.alpha;

        // Balloon-like body (rounder, shinier)
        const bodyGrad = ctx.createRadialGradient(
            gcx - 3, gcy + bob - 6, 2,
            gcx, gcy + bob - 2, this.w / 2 + 2
        );
        bodyGrad.addColorStop(0, `hsl(${this.hue}, 80%, 80%)`);
        bodyGrad.addColorStop(0.6, `hsl(${this.hue}, 70%, 60%)`);
        bodyGrad.addColorStop(1, `hsl(${this.hue}, 60%, 45%)`);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(gcx, gcy + bob - 4, this.w / 2 + 1, Math.PI, 0);
        ctx.lineTo(pos.x + this.w + 1, gcy + this.h / 2 + bob);

        // Wavy tentacle bottom
        const segments = 5;
        const segW = (this.w + 2) / segments;
        for (let i = segments; i > 0; i--) {
            const sx = pos.x - 1 + i * segW;
            const wave = Math.sin(Date.now() / 180 + i + this.bobOffset) * 4;
            ctx.lineTo(sx - segW / 2, gcy + this.h / 2 + bob - 2 + wave);
            ctx.lineTo(sx - segW, gcy + this.h / 2 + bob);
        }
        ctx.closePath();
        ctx.fill();

        // Shine highlight (balloon reflection)
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.ellipse(gcx - 4, gcy + bob - 8, 4, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // ── Funny Face ──
        const faceY = gcy + bob - 2;

        // Big round eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.ellipse(gcx - 5, faceY - 2, 5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(gcx + 5, faceY - 2, 5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris (looks toward player if chasing)
        const irisOff = this.chasing ? 1.5 : 0;
        ctx.fillStyle = `hsl(${this.hue + 60}, 70%, 35%)`;
        ctx.beginPath();
        ctx.arc(gcx - 5 + irisOff, faceY - 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gcx + 5 + irisOff, faceY - 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(gcx - 5 + irisOff, faceY - 0.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gcx + 5 + irisOff, faceY - 0.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
        // Eye shine
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(gcx - 6, faceY - 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gcx + 4, faceY - 3, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Goofy smile (wide, happy)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(gcx, faceY + 3, 5, 0.15, Math.PI - 0.15);
        ctx.stroke();
        // Tongue
        if (this.chasing) {
            ctx.fillStyle = '#F77';
            ctx.beginPath();
            ctx.ellipse(gcx + 2, faceY + 7, 2.5, 2, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Blush circles
        ctx.fillStyle = `hsla(${this.hue + 30}, 80%, 70%, 0.35)`;
        ctx.beginPath();
        ctx.arc(gcx - 9, faceY + 1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(gcx + 9, faceY + 1, 3, 0, Math.PI * 2);
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
        this.phasesThroughWalls = false; // key must not land in wall
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
            const dx = Math.cos(angle) * this.speed * dt;
            const dy = Math.sin(angle) * this.speed * dt;
            this._moveWithCollision(dx, dy, world);
        } else {
            this.alpha = lerp(this.alpha, 0.5, dt * 2);
        }
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
        const bcx = pos.x + this.w / 2;
        const bcy = pos.y + this.h / 2;
        const bob = Math.sin(Date.now() / 400) * 6;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        if (this.dead) {
            // Epic death: boss explodes in green fireworks
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            for (let i = 0; i < 16; i++) {
                const a = (Math.PI * 2 * i) / 16 + t;
                const dist = t * 80;
                ctx.globalAlpha = (1 - t) * 0.8;
                ctx.fillStyle = `hsl(${120 + i * 15}, 80%, ${50 + i * 2}%)`;
                ctx.beginPath();
                ctx.arc(bcx + Math.cos(a) * dist, bcy + Math.sin(a) * dist, (1 - t) * 12, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = (1 - t);
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(bcx, bcy, (1 - t) * 40 + t * 60, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.globalAlpha = flash ? 0.3 : this.alpha;

        // ── Ominous glow underneath ──
        ctx.globalAlpha = 0.12;
        const glowGrad = ctx.createRadialGradient(bcx, bcy + bob, 10, bcx, bcy + bob, this.w);
        glowGrad.addColorStop(0, '#0F0');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(bcx, bcy + bob, this.w, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = flash ? 0.3 : this.alpha;

        // ── Hands (always visible, oversize) ──
        const handY = bcy + bob;
        let leftHandX, rightHandX, handRot;

        if (this.state === 'clap') {
            const t = this.clapProgress / this.clapDuration;
            let spread;
            if (t < 0.45) spread = 1 - t / 0.45;
            else if (t < 0.55) spread = 0;
            else spread = (t - 0.55) / 0.45;
            leftHandX = bcx - 20 - spread * 60;
            rightHandX = bcx + 20 + spread * 60;
            handRot = (1 - spread) * 0.3;
        } else if (this.state === 'stunned') {
            // Hands droop down
            leftHandX = bcx - 55;
            rightHandX = bcx + 55;
            handRot = 0.5;
        } else {
            // Idle floating hands
            const idleWave = Math.sin(Date.now() / 600) * 8;
            leftHandX = bcx - 55 - idleWave;
            rightHandX = bcx + 55 + idleWave;
            handRot = Math.sin(Date.now() / 800) * 0.15;
        }

        this._drawHand(ctx, leftHandX, handY, 28, -handRot, false);
        this._drawHand(ctx, rightHandX, handY, 28, handRot, true);

        // ── Clap shockwave ──
        if (this.state === 'clap') {
            const t = this.clapProgress / this.clapDuration;
            // Warning zone
            if (t < 0.35) {
                ctx.globalAlpha = 0.08 + Math.sin(t * 40) * 0.06;
                ctx.fillStyle = '#F00';
                ctx.beginPath();
                ctx.arc(bcx, handY, this.clapRange, 0, Math.PI * 2);
                ctx.fill();
                // Pulsing ring
                ctx.globalAlpha = 0.3;
                ctx.strokeStyle = '#F44';
                ctx.lineWidth = 2;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(bcx, handY, this.clapRange, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // Impact shockwave
            if (t >= 0.45 && t <= 0.75) {
                const shockT = (t - 0.45) / 0.3;
                ctx.globalAlpha = (1 - shockT) * 0.8;
                // Outer ring
                ctx.strokeStyle = '#FF0';
                ctx.lineWidth = 5 - shockT * 3;
                ctx.beginPath();
                ctx.arc(bcx, handY, 20 + shockT * 130, 0, Math.PI * 2);
                ctx.stroke();
                // Inner ring
                ctx.strokeStyle = '#FFA500';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(bcx, handY, 10 + shockT * 90, 0, Math.PI * 2);
                ctx.stroke();
                // Flash at center
                if (shockT < 0.3) {
                    ctx.globalAlpha = (0.3 - shockT) * 2;
                    ctx.fillStyle = '#FFF';
                    ctx.beginPath();
                    ctx.arc(bcx, handY, 20, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.globalAlpha = flash ? 0.3 : this.alpha;
        }

        // ── Main body (massive ghost) ──
        const bodyGrad = ctx.createRadialGradient(bcx - 8, bcy + bob - 20, 5, bcx, bcy + bob, this.w / 2 + 5);
        bodyGrad.addColorStop(0, this.state === 'stunned' ? '#2A8' : '#4E4');
        bodyGrad.addColorStop(0.5, this.state === 'stunned' ? '#0A5' : '#0C0');
        bodyGrad.addColorStop(1, this.state === 'stunned' ? '#063' : '#080');
        ctx.fillStyle = bodyGrad;

        ctx.beginPath();
        ctx.arc(bcx, bcy + bob - 12, this.w / 2 + 2, Math.PI, 0);
        ctx.lineTo(pos.x + this.w + 2, pos.y + this.h + bob);
        const segments = 8;
        const segW = (this.w + 4) / segments;
        for (let i = segments; i > 0; i--) {
            const sx = pos.x - 2 + i * segW;
            const wave = Math.sin(Date.now() / 180 + i * 0.8) * 6;
            ctx.lineTo(sx - segW / 2, pos.y + this.h + bob - 4 + wave);
            ctx.lineTo(sx - segW, pos.y + this.h + bob);
        }
        ctx.closePath();
        ctx.fill();

        // Body shine
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath();
        ctx.ellipse(bcx - 12, bcy + bob - 22, 12, 18, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // ── Face ──
        const faceY = bcy + bob - 5;

        // Angry eyes (big, glowing)
        const eyeGlow = ctx.createRadialGradient(bcx - 14, faceY, 2, bcx - 14, faceY, 12);
        eyeGlow.addColorStop(0, '#FF0');
        eyeGlow.addColorStop(0.6, '#FA0');
        eyeGlow.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = eyeGlow;
        ctx.beginPath();
        ctx.arc(bcx - 14, faceY, 12, 0, Math.PI * 2);
        ctx.fill();

        const eyeGlow2 = ctx.createRadialGradient(bcx + 14, faceY, 2, bcx + 14, faceY, 12);
        eyeGlow2.addColorStop(0, '#FF0');
        eyeGlow2.addColorStop(0.6, '#FA0');
        eyeGlow2.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = eyeGlow2;
        ctx.beginPath();
        ctx.arc(bcx + 14, faceY, 12, 0, Math.PI * 2);
        ctx.fill();

        // Eye whites
        ctx.fillStyle = '#FF0';
        ctx.beginPath();
        ctx.ellipse(bcx - 14, faceY, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(bcx + 14, faceY, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (red, menacing)
        ctx.fillStyle = '#D00';
        ctx.beginPath();
        ctx.arc(bcx - 14, faceY + 1, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bcx + 14, faceY + 1, 4.5, 0, Math.PI * 2);
        ctx.fill();
        // Pupil core
        ctx.fillStyle = '#300';
        ctx.beginPath();
        ctx.arc(bcx - 14, faceY + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bcx + 14, faceY + 1, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows (thick)
        ctx.strokeStyle = '#060';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bcx - 25, faceY - 13);
        ctx.lineTo(bcx - 8, faceY - 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bcx + 25, faceY - 13);
        ctx.lineTo(bcx + 8, faceY - 8);
        ctx.stroke();

        // Mouth (wide angry grin in phase 2, scowl in phase 1)
        if (this.phase === 2) {
            // Wide menacing grin
            ctx.fillStyle = '#030';
            ctx.beginPath();
            ctx.arc(bcx, faceY + 14, 14, 0.1, Math.PI - 0.1);
            ctx.closePath();
            ctx.fill();
            // Teeth
            ctx.fillStyle = '#FFE';
            for (let i = -2; i <= 2; i++) {
                ctx.fillRect(bcx + i * 5 - 2, faceY + 14, 4, 5);
            }
        } else {
            // Scowl
            ctx.strokeStyle = '#040';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(bcx, faceY + 20, 10, Math.PI + 0.3, -0.3);
            ctx.stroke();
        }

        // Stunned indicator (stars)
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#FF0';
            ctx.font = '14px monospace';
            const starT = Date.now() / 300;
            for (let i = 0; i < 4; i++) {
                const sa = starT + i * Math.PI / 2;
                ctx.fillText('★', bcx + Math.cos(sa) * 30 - 5, pos.y - 8 + Math.sin(sa) * 8 + bob);
            }
        }

        // ── HP bar (wider, below boss name) ──
        ctx.globalAlpha = 1;
        const barW = this.w + 20;
        const barH = 8;
        const barX = bcx - barW / 2;
        const barY = pos.y - 24 + bob;

        // Boss name
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('K\u00d6NIG GEIST', bcx, barY - 4);
        ctx.textAlign = 'left';

        // Bar background
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 3);
        ctx.fill();
        // Bar fill
        const hpPct = this.hp / this.maxHp;
        const barColor = hpPct > 0.4 ? '#0F0' : hpPct > 0.2 ? '#FF0' : '#F00';
        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2, 2);
        ctx.fill();
        // Bar border
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 3);
        ctx.stroke();

        ctx.restore();
    }

    _drawHand(ctx, x, y, size, rotation, isRight) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Palm
        const palmGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, size);
        palmGrad.addColorStop(0, '#3E3');
        palmGrad.addColorStop(1, '#0A0');
        ctx.fillStyle = palmGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fingers (5 chunky fingers)
        const fingerDir = isRight ? 1 : -1;
        ctx.fillStyle = '#0B0';
        for (let i = -2; i <= 2; i++) {
            const angle = i * 0.35 + (isRight ? 0 : Math.PI);
            const fx = Math.cos(angle) * (size - 2);
            const fy = Math.sin(angle) * (size * 0.6) + i * 2;
            ctx.beginPath();
            ctx.ellipse(fx, fy, 8, 6, angle, 0, Math.PI * 2);
            ctx.fill();
        }

        // Knuckle highlights
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.ellipse(-4, -6, size * 0.4, size * 0.3, -0.2, 0, Math.PI * 2);
        ctx.fill();

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

// ══════════════════════════════════════════
// ── World 2: Roboter-Küken Enemies ──
// ══════════════════════════════════════════

class RoboChick extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 30);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = 45;
        this.damage = 1;
        this.detectionRange = 250;
        this.shootTimer = 0;
        this.shootCooldown = 2;
        this.spawnTimer = 10;
        this.spawnCooldown = 10;
        this.legAnim = 0;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        const dist = vecDist(
            { x: this.centerX(), y: this.centerY() },
            { x: player.x + player.w / 2, y: player.y + player.h / 2 }
        );

        if (dist < this.detectionRange) {
            const angle = angleBetween(
                { x: this.centerX(), y: this.centerY() },
                { x: player.x + player.w / 2, y: player.y + player.h / 2 }
            );
            const dx = Math.cos(angle) * this.speed * dt * 0.5;
            const dy = Math.sin(angle) * this.speed * dt * 0.5;
            this._moveWithCollision(dx, dy, world);
            this.legAnim += dt * 4;

            // Shoot
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && projectiles) {
                this.shootTimer = this.shootCooldown;
                const pSpeed = 180;
                projectiles.push(new Projectile(
                    this.centerX(), this.centerY(),
                    Math.cos(angle) * pSpeed, Math.sin(angle) * pSpeed,
                    1, 'enemy', 80
                ));
            }

            // Spawn mini
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && enemies) {
                this.spawnTimer = this.spawnCooldown;
                const sa = Math.random() * Math.PI * 2;
                enemies.push(new MiniRoboChick(
                    this.centerX() + Math.cos(sa) * 30,
                    this.centerY() + Math.sin(sa) * 30
                ));
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
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 * i) / 6 + t;
                ctx.globalAlpha = (1 - t) * 0.8;
                ctx.fillStyle = i % 2 ? '#F80' : '#888';
                ctx.fillRect(cx + Math.cos(a) * t * 30 - 3, cy + Math.sin(a) * t * 30 - 3, 6, 4);
            }
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Legs
        ctx.fillStyle = '#666';
        const lk = Math.sin(this.legAnim) * 3;
        ctx.fillRect(cx - 6, cy + 10, 3, 8 + lk);
        ctx.fillRect(cx + 3, cy + 10, 3, 8 - lk);
        ctx.fillStyle = '#F80';
        ctx.fillRect(cx - 8, cy + 17 + lk, 6, 3);
        ctx.fillRect(cx + 2, cy + 17 - lk, 6, 3);

        // Body (white robot chicken)
        ctx.fillStyle = '#EEE';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.ellipse(cx - 3, cy - 4, 6, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rivets
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(cx - 8, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 8, cy - 2, 2, 0, Math.PI * 2); ctx.fill();

        // Red comb
        ctx.fillStyle = '#F22';
        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.ellipse(cx + i * 5, cy - 14, 4, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Eye (glowing red)
        ctx.fillStyle = '#F00';
        ctx.beginPath();
        ctx.arc(cx + 4, cy - 3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx + 5, cy - 4, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#F80';
        ctx.beginPath();
        ctx.moveTo(cx + 12, cy - 2);
        ctx.lineTo(cx + 20, cy + 1);
        ctx.lineTo(cx + 12, cy + 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// ── Mini Robot Chick ──
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
        this.rollDir = { x: 0, y: 0 };
        this.spinAngle = 0;
        this.cooldownTimer = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);

        if (this.rollState === 'idle') {
            if (dist < this.detectionRange) {
                const angle = angleBetween(mc, pc);
                const dx = Math.cos(angle) * this.speed * 0.4 * dt;
                const dy = Math.sin(angle) * this.speed * 0.4 * dt;
                this._moveWithCollision(dx, dy, world);
                if (dist < 80) {
                    this.rollState = 'charging';
                    this.rollTimer = 0.5;
                    this.rollDir = vecNormalize(vecSub(pc, mc));
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
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;

        if (this.dead) {
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            ctx.globalAlpha = (1 - t);
            ctx.fillStyle = '#888';
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2 + t * 3;
                ctx.fillRect(cx + Math.cos(a) * t * 20 - 2, cy + Math.sin(a) * t * 20 - 2, 4, 4);
            }
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        if (this.rollState === 'rolling') {
            ctx.translate(cx, cy);
            ctx.rotate(this.spinAngle);
            ctx.translate(-cx, -cy);
            // Spark trail
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#FF0';
            ctx.beginPath();
            ctx.arc(cx - this.rollDir.x * 12, cy - this.rollDir.y * 12, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = flash ? 0.4 : 1;
        }

        // Ball body
        ctx.fillStyle = this.rollState === 'charging' ? '#FA0' : '#EEE';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, 4, 0, Math.PI * 2);
        ctx.fill();

        // Tiny beak
        ctx.fillStyle = '#F80';
        ctx.beginPath();
        ctx.moveTo(cx + 7, cy - 1);
        ctx.lineTo(cx + 12, cy + 1);
        ctx.lineTo(cx + 7, cy + 3);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = '#F00';
        ctx.beginPath();
        ctx.arc(cx + 3, cy - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ── Boss: Ghost Chick (World 2) ──
class BossGhostChick extends Enemy {
    constructor(x, y) {
        super(x, y, 90, 90);
        this.hp = 50;
        this.maxHp = 50;
        this.speed = 35;
        this.damage = 3;
        this.phasesThroughWalls = true;
        this.isBoss = true;
        this.contactDamage = false;
        this.phase = 1;
        this.alpha = 0.75;

        this.state = 'intro';
        this.introTimer = 2;
        this.stateTimer = 3;
        this.slamTarget = { x: 0, y: 0 };
        this.slamScale = 1;
        this.stunnedTimer = 0;
        this.spawnTimer = 12;
        this.spawnCooldown = 12;
        this.shadowAlpha = 0;
    }

    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        if (this.hp <= 25 && this.phase === 1) {
            this.phase = 2;
            this.speed = 50;
            this.spawnCooldown = 8;
        }

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };

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
            const angle = angleBetween(mc, pc);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
            this.stateTimer -= dt;

            // Spawn minis
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0 && enemies) {
                this.spawnTimer = this.spawnCooldown;
                const count = this.phase === 1 ? 2 : 3;
                for (let i = 0; i < count; i++) {
                    const a = (Math.PI * 2 * i) / count;
                    enemies.push(new MiniRoboChick(mc.x + Math.cos(a) * 50, mc.y + Math.sin(a) * 50));
                }
            }

            if (this.stateTimer <= 0) {
                this.state = 'rising';
                this.stateTimer = 1.5;
                this.slamTarget = { x: pc.x, y: pc.y };
            }
        }

        if (this.state === 'rising') {
            this.stateTimer -= dt;
            this.slamScale = 0.3 + 0.7 * (this.stateTimer / 1.5);
            this.shadowAlpha = 1 - this.stateTimer / 1.5;
            if (this.stateTimer <= 0) {
                this.state = 'slamming';
                this.stateTimer = 0.3;
                this.x = this.slamTarget.x - this.w / 2;
                this.y = this.slamTarget.y - this.h / 2;
            }
        }

        if (this.state === 'slamming') {
            this.stateTimer -= dt;
            this.slamScale = 1 + (0.3 - this.stateTimer) * 0.5;
            if (this.stateTimer <= 0) {
                this.slamScale = 1;
                this.shadowAlpha = 0;
                // Deal damage
                const dist = vecDist(mc, pc);
                if (dist < 100) {
                    player.takeDamage(this.damage, angleBetween(mc, pc), 300);
                }
                if (particles) {
                    for (let i = 0; i < 10; i++) {
                        const a = (Math.PI * 2 * i) / 10;
                        particles.push(new Particle(mc.x + Math.cos(a) * 30, mc.y + Math.sin(a) * 30, Math.cos(a) * 120, Math.sin(a) * 120, '#F80', 0.5));
                    }
                }
                this.state = 'stunned';
                this.stunnedTimer = 2;
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
            for (let i = 0; i < 12; i++) {
                ctx.globalAlpha = (1 - t) * 0.8;
                const a = (Math.PI * 2 * i) / 12 + t;
                ctx.fillStyle = i % 2 ? '#A4F' : '#F80';
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * t * 70, cy + Math.sin(a) * t * 70, (1 - t) * 10, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.globalAlpha = flash ? 0.3 : this.alpha;

        // Shadow during rise
        if (this.shadowAlpha > 0) {
            ctx.globalAlpha = this.shadowAlpha * 0.3;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 50, 40, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = flash ? 0.3 : this.alpha;
        }

        // Scale for rising/slamming
        ctx.translate(cx, cy);
        ctx.scale(this.slamScale, this.slamScale);
        ctx.translate(-cx, -cy);

        // Body (purple ghost-chicken)
        const grad = ctx.createRadialGradient(cx - 10, cy - 15, 5, cx, cy, 45);
        grad.addColorStop(0, '#C8A');
        grad.addColorStop(0.5, '#A6C');
        grad.addColorStop(1, '#648');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 40, Math.PI, 0);
        ctx.lineTo(cx + 40, cy + 30);
        for (let i = 8; i > 0; i--) {
            const sx = pos.x + i * (this.w / 8);
            const wave = Math.sin(Date.now() / 200 + i) * 5;
            ctx.lineTo(sx - this.w / 16, cy + 28 + wave);
            ctx.lineTo(sx - this.w / 8, cy + 30);
        }
        ctx.closePath();
        ctx.fill();

        // Wings
        ctx.fillStyle = '#A6C';
        ctx.beginPath();
        ctx.ellipse(cx - 38, cy, 15, 25, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 38, cy, 15, 25, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#F90';
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 5);
        ctx.lineTo(cx, cy + 8);
        ctx.lineTo(cx + 8, cy - 5);
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FF0';
        ctx.beginPath();
        ctx.ellipse(cx - 14, cy - 15, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 14, cy - 15, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F00';
        ctx.beginPath();
        ctx.arc(cx - 14, cy - 14, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 14, cy - 14, 4, 0, Math.PI * 2);
        ctx.fill();

        // Stunned stars
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#FF0';
            ctx.font = '12px monospace';
            for (let i = 0; i < 3; i++) {
                const sa = Date.now() / 300 + i * Math.PI * 2 / 3;
                ctx.fillText('★', cx + Math.cos(sa) * 30 - 4, cy - 35 + Math.sin(sa) * 6);
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale
        const bpos = camera.worldToScreen(this.x, this.y);
        const barW = 90;
        const barX = bpos.x + this.w / 2 - barW / 2;
        const barY = bpos.y - 25;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('RIESEN K\u00dcKEN', bpos.x + this.w / 2, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        ctx.fillStyle = this.hp > 20 ? '#A6F' : this.hp > 10 ? '#FA0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * (this.hp / this.maxHp), 5, 2); ctx.fill();

        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── World 3: Schleim-Arena Enemies ──
// ══════════════════════════════════════════

class Slime extends Enemy {
    constructor(x, y) {
        super(x, y, 28, 22);
        this.hp = 12; // 3 hearts (GDD: 3 hits from baseball launcher = 3 x 4dmg = 12)
        this.maxHp = 12;
        this.speed = 40;
        this.damage = 1;
        this.detectionRange = 180;
        this.squish = 0;
        this.hue = randInt(90, 150);
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        const dist = vecDist(
            { x: this.centerX(), y: this.centerY() },
            { x: player.x + player.w / 2, y: player.y + player.h / 2 }
        );

        if (dist < this.detectionRange) {
            const angle = angleBetween(
                { x: this.centerX(), y: this.centerY() },
                { x: player.x + player.w / 2, y: player.y + player.h / 2 }
            );
            const dx = Math.cos(angle) * this.speed * dt;
            const dy = Math.sin(angle) * this.speed * dt;
            this._moveWithCollision(dx, dy, world);
            this.squish = Math.sin(Date.now() / 150) * 3;
        } else {
            this.squish = Math.sin(Date.now() / 400) * 1.5;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;
        const sq = this.squish;

        if (this.dead) {
            // Splat
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            ctx.globalAlpha = (1 - t) * 0.7;
            ctx.fillStyle = `hsl(${this.hue}, 60%, 45%)`;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 5, 18 + t * 15, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 10, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body blob
        const grad = ctx.createRadialGradient(cx - 3, cy - 4 + sq, 3, cx, cy + sq, 14);
        grad.addColorStop(0, `hsl(${this.hue}, 65%, 65%)`);
        grad.addColorStop(0.6, `hsl(${this.hue}, 60%, 50%)`);
        grad.addColorStop(1, `hsl(${this.hue}, 55%, 35%)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy + sq * 0.5, 14 + sq, 11 - sq * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx - 4, cy - 5 + sq, 5, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Face
        ctx.fillStyle = '#222';
        // Half-closed eyes
        ctx.beginPath();
        ctx.ellipse(cx - 5, cy - 2 + sq, 3, 2, 0, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 5, cy - 2 + sq, 3, 2, 0, 0, Math.PI);
        ctx.fill();
        // Small smile
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy + 3 + sq, 3, 0.2, Math.PI - 0.2);
        ctx.stroke();

        // Mini HP hearts above
        const heartsTotal = 3;
        const heartsFull = Math.ceil(this.hp / 4);
        for (let i = 0; i < heartsTotal; i++) {
            const hx = cx - 10 + i * 10;
            const hy = pos.y - 8;
            ctx.fillStyle = i < heartsFull ? '#F44' : '#555';
            ctx.beginPath();
            ctx.arc(hx, hy, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

// ── Boss Slime (World 3) ──
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
        this.squish = 0;
        this.pauseTimer = 0;

        this.state = 'intro';
        this.introTimer = 2;
        this.jumpTimer = 6;
        this.jumpCooldown = 6;
        this.jumpState = 'none';
        this.jumpProgress = 0;
        this.splitAt25 = false;
        this.splitAt10 = false;
        this.stunnedTimer = 0;
    }

    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        if (this.hp <= 18 && this.phase === 1) {
            this.phase = 2;
            this.speed = 25;
            this.jumpCooldown = 4;
        }

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };

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

        // Pause mechanic - stops sometimes (gives player time to attack)
        this.pauseTimer -= dt;
        if (this.pauseTimer > 0) return;
        if (this.state === 'chase' && Math.random() < 0.003) {
            this.pauseTimer = 1.5;
            return;
        }

        // Split spawns (less frequent, lower thresholds)
        if (this.hp <= 25 && !this.splitAt25 && enemies) {
            this.splitAt25 = true;
            for (let i = 0; i < 2; i++) {
                const a = (Math.PI * 2 * i) / 2;
                enemies.push(new Slime(mc.x + Math.cos(a) * 60, mc.y + Math.sin(a) * 60));
            }
        }
        if (this.hp <= 10 && !this.splitAt10 && enemies) {
            this.splitAt10 = true;
            for (let i = 0; i < 2; i++) {
                const a = (Math.PI * 2 * i) / 2 + 0.5;
                enemies.push(new Slime(mc.x + Math.cos(a) * 60, mc.y + Math.sin(a) * 60));
            }
        }

        if (this.state === 'chase') {
            const angle = angleBetween(mc, pc);
            const dx = Math.cos(angle) * this.speed * dt;
            const dy = Math.sin(angle) * this.speed * dt;
            this._moveWithCollision(dx, dy, world);
            this.squish = Math.sin(Date.now() / 200) * 4;

            this.jumpTimer -= dt;
            if (this.jumpTimer <= 0) {
                this.state = 'jumping';
                this.jumpState = 'rising';
                this.jumpProgress = 0;
                this.jumpTimer = this.jumpCooldown;
            }
        }

        if (this.state === 'jumping') {
            this.jumpProgress += dt;
            if (this.jumpState === 'rising' && this.jumpProgress > 0.6) {
                this.jumpState = 'falling';
                this.jumpProgress = 0;
                // Move toward player but clamp to world bounds
                let targetX = pc.x - this.w / 2;
                let targetY = pc.y - this.h / 2;
                targetX = clamp(targetX, TILE_SIZE * 2, world.pixelWidth - this.w - TILE_SIZE * 2);
                targetY = clamp(targetY, TILE_SIZE * 2, world.pixelHeight - this.h - TILE_SIZE * 2);
                // Don't land inside walls - find nearest open spot
                if (!world.isWall(targetX + this.w / 2, targetY + this.h / 2)) {
                    this.x = targetX;
                    this.y = targetY;
                }
                // else stay where we are
            }
            if (this.jumpState === 'falling' && this.jumpProgress > 0.3) {
                const newMc = { x: this.centerX(), y: this.centerY() };
                const dist = vecDist(newMc, pc);
                if (dist < 120) {
                    player.takeDamage(2, angleBetween(newMc, pc), 250);
                }
                if (particles) {
                    for (let i = 0; i < 8; i++) {
                        const a = (Math.PI * 2 * i) / 8;
                        particles.push(new Particle(mc.x + Math.cos(a) * 40, mc.y + Math.sin(a) * 40, Math.cos(a) * 100, Math.sin(a) * 100, '#4D4', 0.5));
                    }
                }
                this.state = 'stunned';
                this.stunnedTimer = 1.5;
                this.jumpState = 'none';
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 20) % 2;
        const sq = this.squish;

        if (this.dead) {
            const t = 1 - this.deathTimer / 0.4;
            ctx.save();
            ctx.globalAlpha = (1 - t) * 0.6;
            ctx.fillStyle = '#4A4';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 50 + t * 30, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Jump scaling
        let scale = 1;
        if (this.jumpState === 'rising') {
            scale = 1 - this.jumpProgress * 0.5;
            // Shadow
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(cx, cy + 30, 40, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = flash ? 0.4 : 1;
        } else if (this.jumpState === 'falling') {
            scale = 0.5 + this.jumpProgress * 2;
        }

        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // Body
        const hue = this.phase === 2 ? 100 : 120;
        const grad = ctx.createRadialGradient(cx - 10, cy - 15, 5, cx, cy, 50);
        grad.addColorStop(0, `hsl(${hue}, 60%, 55%)`);
        grad.addColorStop(0.6, `hsl(${hue}, 55%, 40%)`);
        grad.addColorStop(1, `hsl(${hue}, 50%, 28%)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy + sq, 48 + sq, 38 - sq * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Crown bumps
        ctx.fillStyle = `hsl(${hue}, 50%, 35%)`;
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.arc(cx + i * 14, cy - 32 + sq + Math.abs(i) * 4, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx - 12, cy - 15 + sq, 15, 10, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Angry face
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(cx - 15, cy - 8 + sq, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 15, cy - 8 + sq, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx - 15, cy - 9 + sq, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 15, cy - 9 + sq, 3, 0, Math.PI * 2);
        ctx.fill();
        // Angry brows
        ctx.strokeStyle = `hsl(${hue}, 50%, 25%)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 25, cy - 18 + sq);
        ctx.lineTo(cx - 10, cy - 14 + sq);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 25, cy - 18 + sq);
        ctx.lineTo(cx + 10, cy - 14 + sq);
        ctx.stroke();
        // Wide angry mouth
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(cx, cy + 8 + sq, 12, 0.1, Math.PI - 0.1);
        ctx.closePath();
        ctx.fill();

        // Stunned
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#FF0';
            ctx.font = '14px monospace';
            for (let i = 0; i < 4; i++) {
                const sa = Date.now() / 250 + i * Math.PI / 2;
                ctx.fillText('★', cx + Math.cos(sa) * 35 - 5, cy - 38 + Math.sin(sa) * 6 + sq);
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const bpos = camera.worldToScreen(this.x, this.y);
        const barW = 100;
        const barX = bpos.x + this.w / 2 - barW / 2;
        const barY = bpos.y - 28;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('K\u00d6NIG SCHLEIM', bpos.x + this.w / 2, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.4 ? '#4D4' : hpPct > 0.2 ? '#FF0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, 5, 2); ctx.fill();

        ctx.restore();
    }
}

// ── Giant Egg (World 2 key mechanic - replaces KeyGhost) ──
class GiantEgg extends Enemy {
    constructor(x, y) {
        super(x, y, 36, 40);
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 0;
        this.damage = 0;
        this.contactDamage = false;
        this.isKeyGhost = true; // uses same key drop logic
        this.droppedKey = false;
        this.wobble = 0;
        this.crackLevel = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.crackLevel = 1 - (this.hp / this.maxHp);
        this.wobble = this.iFrames > 0 ? Math.sin(Date.now() / 30) * 5 : Math.sin(Date.now() / 800) * 1;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.isFlashing();

        if (this.dead) {
            const t = this.deathProgress();
            ctx.save();
            // Shell fragments
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 * i) / 8 + t;
                ctx.globalAlpha = (1 - t) * 0.8;
                ctx.fillStyle = '#FFEEDD';
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * t * 40, cy + Math.sin(a) * t * 40, 6 * (1 - t), 0, Math.PI * 2);
                ctx.fill();
            }
            // Golden key appears
            ctx.globalAlpha = t;
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(cx - 6, cy - 4, 12, 5);
            ctx.beginPath();
            ctx.arc(cx - 4, cy - 4, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 18, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Egg body (wobbles)
        ctx.translate(cx, cy);
        ctx.rotate(this.wobble * Math.PI / 180);
        ctx.translate(-cx, -cy);

        // Egg shape
        const grad = ctx.createRadialGradient(cx - 4, cy - 8, 3, cx, cy, 20);
        grad.addColorStop(0, '#FFFFF0');
        grad.addColorStop(0.5, '#FFEEDD');
        grad.addColorStop(1, '#DDC8AA');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 16, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cracks (increase with damage)
        if (this.crackLevel > 0) {
            ctx.strokeStyle = '#886644';
            ctx.lineWidth = 1.5;
            const numCracks = Math.floor(this.crackLevel * 6) + 1;
            for (let i = 0; i < numCracks; i++) {
                const startA = (Math.PI * 2 * i) / numCracks - 0.5;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(startA) * 8, cy + Math.sin(startA) * 10);
                ctx.lineTo(cx + Math.cos(startA + 0.3) * 14, cy + Math.sin(startA + 0.2) * 16);
                ctx.lineTo(cx + Math.cos(startA + 0.5) * 10, cy + Math.sin(startA + 0.6) * 14);
                ctx.stroke();
            }
        }

        // Glow (golden, pulses)
        ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 400) * 0.08;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 22, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // HP indicator
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.hp + '/' + this.maxHp, cx, pos.y - 6);

        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── World 4: Dunkle Ritterburg Enemies ──
// ══════════════════════════════════════════

// ── Shadow Crocodile Knight ──
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
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);

        if (this.slashing) {
            this.slashTimer -= dt;
            if (this.slashTimer <= 0) this.slashing = false;
            return;
        }

        if (dist < this.detectionRange) {
            const angle = angleBetween(mc, pc);
            this.slashAngle = angle;
            const dx = Math.cos(angle) * this.speed * dt;
            const dy = Math.sin(angle) * this.speed * dt;
            this._moveWithCollision(dx, dy, world);

            this.attackTimer -= dt;
            if (this.attackTimer <= 0 && dist < 45) {
                this.slashing = true;
                this.slashTimer = 0.3;
                this.attackTimer = this.attackCooldown;
                // Check hit
                if (dist < 50) {
                    player.takeDamage(this.damage, angle, 180);
                }
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.isFlashing();

        if (this.dead) {
            const t = this.deathProgress();
            ctx.save();
            ctx.globalAlpha = (1 - t) * 0.6;
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 14 + t * 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Shadow body (dark crocodile)
        ctx.fillStyle = '#2A3A2A';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 13, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        // Snout
        ctx.fillStyle = '#1E2E1E';
        const snoutAngle = this.slashAngle;
        ctx.beginPath();
        ctx.ellipse(
            cx + Math.cos(snoutAngle) * 10, cy + Math.sin(snoutAngle) * 8,
            8, 5, snoutAngle, 0, Math.PI * 2
        );
        ctx.fill();
        // Eyes (red glowing)
        ctx.fillStyle = '#F44';
        const ea1 = snoutAngle - 0.5;
        const ea2 = snoutAngle + 0.5;
        ctx.beginPath(); ctx.arc(cx + Math.cos(ea1) * 7, cy + Math.sin(ea1) * 5, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + Math.cos(ea2) * 7, cy + Math.sin(ea2) * 5, 3, 0, Math.PI * 2); ctx.fill();
        // Sword
        ctx.strokeStyle = '#AAA';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const swordLen = this.slashing ? 28 : 20;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(snoutAngle) * 12, cy + Math.sin(snoutAngle) * 10);
        ctx.lineTo(cx + Math.cos(snoutAngle) * (12 + swordLen), cy + Math.sin(snoutAngle) * (10 + swordLen * 0.7));
        ctx.stroke();
        // Sword guard
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        const gx = cx + Math.cos(snoutAngle) * 14;
        const gy = cy + Math.sin(snoutAngle) * 11;
        ctx.beginPath();
        ctx.moveTo(gx + Math.cos(snoutAngle + Math.PI/2) * 4, gy + Math.sin(snoutAngle + Math.PI/2) * 4);
        ctx.lineTo(gx + Math.cos(snoutAngle - Math.PI/2) * 4, gy + Math.sin(snoutAngle - Math.PI/2) * 4);
        ctx.stroke();

        // Slash arc
        if (this.slashing) {
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 30, snoutAngle - 0.6, snoutAngle + 0.6);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// ── Giant Bat ──
class GiantBat extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 20);
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 100;
        this.damage = 1;
        this.phasesThroughWalls = true;
        this.detectionRange = 220;
        this.wingAnim = 0;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.wingAnim += dt * 8;

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };
        const dist = vecDist(mc, pc);

        if (dist < this.detectionRange) {
            const angle = angleBetween(mc, pc);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        } else {
            // Idle circle
            this.x += Math.sin(Date.now() / 600) * 20 * dt;
            this.y += Math.cos(Date.now() / 500) * 15 * dt;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.isFlashing();

        if (this.dead) {
            const t = this.deathProgress();
            ctx.save();
            ctx.globalAlpha = (1 - t) * 0.7;
            ctx.fillStyle = '#422';
            ctx.beginPath();
            ctx.arc(cx, cy, 10 * (1 - t), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        const wingSpread = Math.sin(this.wingAnim) * 12;
        // Wings
        ctx.fillStyle = '#3A2233';
        ctx.beginPath();
        ctx.ellipse(cx - 14 - wingSpread * 0.5, cy - 2, 12 + wingSpread * 0.3, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 14 + wingSpread * 0.5, cy - 2, 12 + wingSpread * 0.3, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = '#4A2A3A';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyes (yellow)
        ctx.fillStyle = '#FF0';
        ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 3, cy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx - 3, cy - 1.5, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 3, cy - 1.5, 1, 0, Math.PI * 2); ctx.fill();
        // Fangs
        ctx.fillStyle = '#FFF';
        ctx.fillRect(cx - 2, cy + 3, 1.5, 3);
        ctx.fillRect(cx + 0.5, cy + 3, 1.5, 3);

        ctx.restore();
    }
}

// ── Key Knight (World 4 key holder) ──
class KeyKnight extends ShadowKnight {
    constructor(x, y) {
        super(x, y);
        this.hp = 16;
        this.maxHp = 16;
        this.speed = 40;
        this.isKeyGhost = true;
        this.droppedKey = false;
        this.detectionRange = 220;
    }

    draw(ctx, camera) {
        super.draw(ctx, camera);
        if (this.dead) return;
        // Golden glow + key icon
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        ctx.save();
        ctx.globalAlpha = 0.2 + Math.sin(Date.now() / 400) * 0.1;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(cx, cy, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Key above head
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(cx - 4, pos.y - 10, 8, 4);
        ctx.beginPath();
        ctx.arc(cx - 2, pos.y - 10, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ── Boss: Knight Bat (World 4) ──
class BossKnightBat extends Enemy {
    constructor(x, y) {
        super(x, y, 90, 80);
        this.hp = 55;
        this.maxHp = 55;
        this.speed = 45;
        this.damage = 3;
        this.phasesThroughWalls = true;
        this.isBoss = true;
        this.contactDamage = false;

        this.state = 'intro';
        this.introTimer = 2;
        this.swoopTimer = 3;
        this.swoopCooldown = 3;
        this.swooping = false;
        this.swoopDir = { x: 0, y: 0 };
        this.swoopProgress = 0;
        this.stunnedTimer = 0;
        this.wingAnim = 0;
        this.spawnTimer = 15;
        this.phase = 1;
    }

    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.wingAnim += dt * 5;

        if (this.hp <= 28 && this.phase === 1) {
            this.phase = 2;
            this.speed = 60;
            this.swoopCooldown = 2;
        }

        const pc = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        const mc = { x: this.centerX(), y: this.centerY() };

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
        if (this.state === 'swoop') {
            this.swoopProgress += dt;
            this.x += this.swoopDir.x * 300 * dt;
            this.y += this.swoopDir.y * 300 * dt;
            // Check hit
            const dist = vecDist(mc, pc);
            if (dist < 60) {
                player.takeDamage(this.damage, angleBetween(mc, pc), 250);
            }
            if (this.swoopProgress > 0.8) {
                this.state = 'stunned';
                this.stunnedTimer = 1.8;
            }
            return;
        }

        // Fly state - circle and approach
        const angle = angleBetween(mc, pc);
        this.x += Math.cos(angle) * this.speed * dt + Math.sin(Date.now() / 400) * 30 * dt;
        this.y += Math.sin(angle) * this.speed * dt + Math.cos(Date.now() / 350) * 20 * dt;

        // Spawn bats
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && enemies) {
            this.spawnTimer = this.phase === 1 ? 15 : 10;
            for (let i = 0; i < 2; i++) {
                const a = Math.random() * Math.PI * 2;
                enemies.push(new GiantBat(mc.x + Math.cos(a) * 50, mc.y + Math.sin(a) * 50));
            }
        }

        // Swoop attack
        this.swoopTimer -= dt;
        if (this.swoopTimer <= 0) {
            this.state = 'swoop';
            this.swoopDir = vecNormalize(vecSub(pc, mc));
            this.swoopProgress = 0;
            this.swoopTimer = this.swoopCooldown;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const flash = this.isFlashing();

        if (this.dead) {
            const t = this.deathProgress();
            ctx.save();
            for (let i = 0; i < 10; i++) {
                ctx.globalAlpha = (1 - t) * 0.7;
                const a = (Math.PI * 2 * i) / 10 + t * 2;
                ctx.fillStyle = i % 2 ? '#633' : '#FFD700';
                ctx.beginPath();
                ctx.arc(cx + Math.cos(a) * t * 60, cy + Math.sin(a) * t * 60, (1 - t) * 8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        ctx.save();
        ctx.globalAlpha = flash ? 0.3 : 0.9;

        const wingSpread = Math.sin(this.wingAnim) * 20;
        // Wings
        ctx.fillStyle = '#2A1525';
        ctx.beginPath();
        ctx.ellipse(cx - 40 - wingSpread, cy - 5, 30 + wingSpread * 0.5, 18, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 40 + wingSpread, cy - 5, 30 + wingSpread * 0.5, 18, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Body (dark armored)
        ctx.fillStyle = '#3A2030';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 30, 25, 0, 0, Math.PI * 2);
        ctx.fill();
        // Armor plates
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.ellipse(cx, cy - 5, 20, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Giant sword (always visible, points forward during swoop)
        const swordAngle = this.state === 'swoop' ? Math.atan2(this.swoopDir.y, this.swoopDir.x) : Math.sin(Date.now() / 500) * 0.3;
        ctx.strokeStyle = '#CCC';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy + 10);
        ctx.lineTo(cx + Math.cos(swordAngle) * 50, cy + 10 + Math.sin(swordAngle) * 40);
        ctx.stroke();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy + 10);
        ctx.lineTo(cx + 8, cy + 10);
        ctx.stroke();

        // Eyes (red, menacing)
        ctx.fillStyle = '#F00';
        ctx.beginPath(); ctx.arc(cx - 10, cy - 10, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 10, cy - 10, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#800';
        ctx.beginPath(); ctx.arc(cx - 10, cy - 9, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 10, cy - 9, 3, 0, Math.PI * 2); ctx.fill();

        // Stunned stars
        if (this.state === 'stunned') {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#FF0';
            ctx.font = '12px monospace';
            for (let i = 0; i < 4; i++) {
                const sa = Date.now() / 250 + i * Math.PI / 2;
                ctx.fillText('\u2605', cx + Math.cos(sa) * 35 - 4, pos.y - 10 + Math.sin(sa) * 6);
            }
        }

        // HP bar
        ctx.globalAlpha = 1;
        const barW = 90;
        const barX = cx - barW / 2;
        const barY = pos.y - 25;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SCHATTEN FLEDERMAUS', cx, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.4 ? '#A4F' : hpPct > 0.2 ? '#FA0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, 5, 2); ctx.fill();

        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Tutorial Robots ──
// ══════════════════════════════════════════

class TutorialRobotSmall extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 20);
        this.hp = 2; this.maxHp = 2; this.speed = 30; this.damage = 1;
        this.detectionRange = 120;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dist = vecDist({x:this.centerX(),y:this.centerY()}, {x:player.x+player.w/2,y:player.y+player.h/2});
        if (dist < this.detectionRange) {
            const a = angleBetween({x:this.centerX(),y:this.centerY()}, {x:player.x+player.w/2,y:player.y+player.h/2});
            this._moveWithCollision(Math.cos(a)*this.speed*dt, Math.sin(a)*this.speed*dt, world);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        if (this.dead) { const t=this.deathProgress(); ctx.save(); ctx.globalAlpha=(1-t); ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(cx,cy,10*(1-t),0,Math.PI*2); ctx.fill(); ctx.restore(); return; }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#AAA'; ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#F00'; ctx.beginPath(); ctx.arc(cx+3,cy-3,3,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class TutorialRobotMedium extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 4; this.maxHp = 4; this.speed = 0; this.damage = 0;
        this.contactDamage = false; this.isKeyGhost = true; this.droppedKey = false;
    }
    update(dt, world, player) { this.baseUpdate(dt, world); }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        if (this.dead) { const t=this.deathProgress(); ctx.save(); ctx.globalAlpha=(1-t); ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(cx,cy,13*(1-t),0,Math.PI*2); ctx.fill(); ctx.restore(); return; }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#999'; ctx.beginPath(); ctx.roundRect(cx-12,cy-12,24,24,4); ctx.fill();
        ctx.fillStyle='#FFD700'; ctx.fillRect(cx-3,cy-14,6,4);
        ctx.fillStyle='#F00'; ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class TutorialRobotBig extends Enemy {
    constructor(x, y) {
        super(x, y, 36, 36);
        this.hp = 6; this.maxHp = 6; this.speed = 0; this.damage = 0; this.contactDamage = false;
    }
    update(dt, world, player) { this.baseUpdate(dt, world); }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        if (this.dead) { const t=this.deathProgress(); ctx.save(); ctx.globalAlpha=(1-t); ctx.fillStyle='#666'; ctx.beginPath(); ctx.arc(cx,cy,18*(1-t),0,Math.PI*2); ctx.fill(); ctx.restore(); return; }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#777'; ctx.beginPath(); ctx.roundRect(cx-16,cy-16,32,32,6); ctx.fill();
        ctx.fillStyle='#555'; ctx.beginPath(); ctx.roundRect(cx-12,cy-12,24,24,4); ctx.fill();
        ctx.fillStyle='#F00'; ctx.beginPath(); ctx.arc(cx-5,cy-4,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+5,cy-4,4,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class ShieldRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 8; this.maxHp = 8; this.speed = 25; this.damage = 1; this.detectionRange = 100;
    }
    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const dist = vecDist({x:this.centerX(),y:this.centerY()}, {x:player.x+player.w/2,y:player.y+player.h/2});
        if (dist < this.detectionRange) {
            const a = angleBetween({x:this.centerX(),y:this.centerY()}, {x:player.x+player.w/2,y:player.y+player.h/2});
            this._moveWithCollision(Math.cos(a)*this.speed*dt, Math.sin(a)*this.speed*dt, world);
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        if (this.dead) { const t=this.deathProgress(); ctx.save(); ctx.globalAlpha=(1-t); ctx.fillStyle='#44F'; ctx.beginPath(); ctx.arc(cx,cy,12*(1-t),0,Math.PI*2); ctx.fill(); ctx.restore(); return; }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#66F'; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#88F'; ctx.beginPath(); ctx.arc(cx,cy-2,8,Math.PI,0); ctx.fill();
        ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(cx,cy-2,3,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class ShooterRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 3; this.maxHp = 3; this.speed = 35; this.damage = 1;
        this.detectionRange = 200; this.shootTimer = 0; this.shootCooldown = 1.5;
    }
    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const pc = {x:player.x+player.w/2,y:player.y+player.h/2};
        const mc = {x:this.centerX(),y:this.centerY()};
        const dist = vecDist(mc, pc);
        if (dist < this.detectionRange) {
            const a = angleBetween(mc, pc);
            this._moveWithCollision(Math.cos(a)*this.speed*0.3*dt, Math.sin(a)*this.speed*0.3*dt, world);
            this.shootTimer -= dt;
            if (this.shootTimer <= 0 && typeof Game !== 'undefined') {
                this.shootTimer = this.shootCooldown;
                Game.projectiles.push(new Projectile(mc.x,mc.y, Math.cos(a)*150, Math.sin(a)*150, 1, 'enemy', 60));
            }
        }
    }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        if (this.dead) { const t=this.deathProgress(); ctx.save(); ctx.globalAlpha=(1-t); ctx.fillStyle='#F44'; ctx.beginPath(); ctx.arc(cx,cy,11*(1-t),0,Math.PI*2); ctx.fill(); ctx.restore(); return; }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#C44'; ctx.beginPath(); ctx.arc(cx,cy,11,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#F66'; ctx.fillRect(cx+6,cy-2,8,4);
        ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(cx-2,cy-3,3,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

class StandRobot extends Enemy {
    constructor(x, y) {
        super(x, y, 22, 22);
        this.hp = 2; this.maxHp = 2; this.speed = 0; this.damage = 0; this.contactDamage = false;
    }
    update(dt, world, player) { this.baseUpdate(dt, world); }
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x+this.w/2, cy = pos.y+this.h/2;
        if (this.dead) { const t=this.deathProgress(); ctx.save(); ctx.globalAlpha=(1-t); ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(cx,cy,11*(1-t),0,Math.PI*2); ctx.fill(); ctx.restore(); return; }
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#AAA'; ctx.beginPath(); ctx.arc(cx,cy,11,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#666'; ctx.fillRect(cx-4,cy+6,3,6); ctx.fillRect(cx+1,cy+6,3,6);
        ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(cx-3,cy-2,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+3,cy-2,2,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

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

// ══════════════════════════════════════════
// ── World 5-8 Unique Bosses ──
// ══════════════════════════════════════════

class BossMushroomGiant extends Enemy {
    constructor(x,y) {
        super(x,y,90,100); this.hp=50; this.maxHp=50; this.speed=20;
        this.damage=2; this.isBoss=true; this.contactDamage=false;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.sporeTimer=3; this.vineTimer=6; this.phase=1;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return;
        if(this.hp<=25&&this.phase===1){this.phase=2;this.speed=30;}
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='chase';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='chase';return;}
        const a=angleBetween(mc,pc);
        this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
        this.sporeTimer-=dt;
        if(this.sporeTimer<=0){
            this.sporeTimer=this.phase===1?3:2;
            const n=this.phase===1?6:10;
            for(let i=0;i<n;i++){const sa=(Math.PI*2*i)/n;
                if(typeof Game!=='undefined')Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(sa)*120,Math.sin(sa)*120,1,'enemy',60));
            }
            this.state='stunned';this.stunnedTimer=2;
        }
        this.vineTimer-=dt;
        if(this.vineTimer<=0){
            this.vineTimer=this.phase===1?6:4;
            const dist=vecDist(mc,pc);
            if(dist<150)player.takeDamage(2,a,200);
            if(particles)for(let i=0;i<6;i++)particles.push(new Particle(mc.x+Math.cos(a)*i*20,mc.y+Math.sin(a)*i*20,0,-30,'#0A0',0.5));
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();for(let i=0;i<10;i++){ctx.globalAlpha=(1-t)*0.7;const a=(Math.PI*2*i)/10+t;ctx.fillStyle=i%2?'#F44':'#A84';ctx.beginPath();ctx.arc(cx+Math.cos(a)*t*60,cy+Math.sin(a)*t*60,(1-t)*8,0,Math.PI*2);ctx.fill();}ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        // Stem
        ctx.fillStyle='#DDB88C';ctx.fillRect(cx-15,cy,30,45);
        // Cap (red dome with white spots)
        ctx.fillStyle='#CC3333';ctx.beginPath();ctx.ellipse(cx,cy,42,30,0,Math.PI,0);ctx.fill();
        ctx.fillStyle='#FFF';
        ctx.beginPath();ctx.arc(cx-15,cy-15,6,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+12,cy-20,5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+5,cy-8,4,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx-20,cy-5,3,0,Math.PI*2);ctx.fill();
        // Face
        ctx.fillStyle='#000';
        ctx.beginPath();ctx.arc(cx-10,cy+15,4,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(cx+10,cy+15,4,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#000';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy+25,8,0.2,Math.PI-0.2);ctx.stroke();
        // Stunned
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='12px monospace';for(let i=0;i<3;i++){const sa=Date.now()/300+i*2;ctx.fillText('\u2605',cx+Math.cos(sa)*30,pos.y-10+Math.sin(sa)*6);}}
        // HP bar
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('RIESEN PILZ',cx,pos.y-15);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-10,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>20?'#A84':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-9,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

class BossMosquito extends Enemy {
    constructor(x,y) {
        super(x,y,80,60); this.hp=55; this.maxHp=55; this.speed=60;
        this.damage=2; this.isBoss=true; this.contactDamage=false; this.phasesThroughWalls=true;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.spinTimer=3; this.swoopDir={x:0,y:0}; this.swoopProgress=0;
        this.wingAnim=0; this.spawnTimer=12;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return; this.wingAnim+=dt*10;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='fly';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='fly';return;}
        if(this.state==='spin'){
            this.swoopProgress+=dt;this.x+=this.swoopDir.x*250*dt;this.y+=this.swoopDir.y*250*dt;
            if(vecDist(mc,pc)<50)player.takeDamage(2,angleBetween(mc,pc),200);
            if(this.swoopProgress>1){this.state='stunned';this.stunnedTimer=2;}return;
        }
        const a=angleBetween(mc,pc);
        this.x+=Math.cos(a)*this.speed*dt+Math.sin(Date.now()/300)*20*dt;
        this.y+=Math.sin(a)*this.speed*dt+Math.cos(Date.now()/250)*15*dt;
        this.spinTimer-=dt;
        if(this.spinTimer<=0){this.spinTimer=3;this.state='spin';this.swoopDir=vecNormalize(vecSub(pc,mc));this.swoopProgress=0;}
        this.spawnTimer-=dt;
        if(this.spawnTimer<=0&&enemies){this.spawnTimer=12;for(let i=0;i<2;i++){const sa=Math.random()*Math.PI*2;enemies.push(new GiantBat(mc.x+Math.cos(sa)*50,mc.y+Math.sin(sa)*50));}}
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#8A4';ctx.beginPath();ctx.arc(cx,cy,30*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        const ws=Math.sin(this.wingAnim)*15;
        // Wings
        ctx.fillStyle='rgba(200,220,255,0.4)';
        ctx.beginPath();ctx.ellipse(cx-25-ws,cy-5,20+ws*0.5,12,-0.2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx+25+ws,cy-5,20+ws*0.5,12,0.2,0,Math.PI*2);ctx.fill();
        // Body (striped)
        ctx.fillStyle='#554';ctx.beginPath();ctx.ellipse(cx,cy,20,14,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#443';for(let i=-1;i<=1;i++)ctx.fillRect(cx-18,cy+i*6-2,36,3);
        // Proboscis (needle)
        ctx.strokeStyle='#666';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx,cy+14);ctx.lineTo(cx,cy+35);ctx.stroke();
        // Eyes (compound, red)
        ctx.fillStyle='#F44';ctx.beginPath();ctx.arc(cx-8,cy-8,7,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+8,cy-8,7,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#800';ctx.beginPath();ctx.arc(cx-8,cy-7,3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx+8,cy-7,3,0,Math.PI*2);ctx.fill();
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='12px monospace';for(let i=0;i<3;i++){const sa=Date.now()/300+i*2;ctx.fillText('\u2605',cx+Math.cos(sa)*30,pos.y-10+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('RIESEN M\u00dcCKE',cx,pos.y-15);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-40,pos.y-10,80,7,3);ctx.fill();
        ctx.fillStyle=this.hp>25?'#8A4':'#F00';ctx.beginPath();ctx.roundRect(cx-39,pos.y-9,78*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

class BossSnowEagle extends Enemy {
    constructor(x,y) {
        super(x,y,100,80); this.hp=60; this.maxHp=60; this.speed=45;
        this.damage=2; this.isBoss=true; this.contactDamage=false; this.phasesThroughWalls=true;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.iceTimer=4; this.windTimer=7; this.wingAnim=0;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return; this.wingAnim+=dt*4;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='fly';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='fly';return;}
        const a=angleBetween(mc,pc);
        this.x+=Math.cos(a)*this.speed*dt+Math.sin(Date.now()/500)*25*dt;
        this.y+=Math.sin(a)*this.speed*dt+Math.cos(Date.now()/400)*20*dt;
        this.iceTimer-=dt;
        if(this.iceTimer<=0){
            this.iceTimer=4;
            for(let i=0;i<8;i++){const ix=mc.x-100+i*30;
                if(typeof Game!=='undefined')Game.projectiles.push(new Projectile(ix,mc.y-200,0,180,1,'enemy',40));
            }
            this.state='stunned';this.stunnedTimer=2;
        }
        this.windTimer-=dt;
        if(this.windTimer<=0){
            this.windTimer=7;const dist=vecDist(mc,pc);
            if(dist<200){const wa=angleBetween(mc,pc);player.takeDamage(0,wa,400);}
            if(particles)for(let i=0;i<8;i++)particles.push(new Particle(mc.x,mc.y,Math.cos(a)*200+randRange(-40,40),Math.sin(a)*200+randRange(-40,40),'#ADF',0.6));
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();for(let i=0;i<12;i++){ctx.globalAlpha=(1-t);const a=(Math.PI*2*i)/12+t*2;ctx.fillStyle=i%2?'#ADF':'#FFF';ctx.beginPath();ctx.arc(cx+Math.cos(a)*t*70,cy+Math.sin(a)*t*70,(1-t)*8,0,Math.PI*2);ctx.fill();}ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        const ws=Math.sin(this.wingAnim)*20;
        // Wings (white with ice-blue tips)
        ctx.fillStyle='#EEF';ctx.beginPath();ctx.ellipse(cx-35-ws,cy,25+ws*0.5,16,-0.15,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx+35+ws,cy,25+ws*0.5,16,0.15,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#8CF';
        ctx.beginPath();ctx.ellipse(cx-50-ws,cy-2,10,8,-0.2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx+50+ws,cy-2,10,8,0.2,0,Math.PI*2);ctx.fill();
        // Body
        ctx.fillStyle='#FFF';ctx.beginPath();ctx.ellipse(cx,cy,22,16,0,0,Math.PI*2);ctx.fill();
        // Head
        ctx.fillStyle='#FFF';ctx.beginPath();ctx.arc(cx,cy-18,12,0,Math.PI*2);ctx.fill();
        // Beak
        ctx.fillStyle='#FA0';ctx.beginPath();ctx.moveTo(cx,cy-16);ctx.lineTo(cx+10,cy-12);ctx.lineTo(cx,cy-8);ctx.closePath();ctx.fill();
        // Eyes (cold blue)
        ctx.fillStyle='#48F';ctx.beginPath();ctx.arc(cx-4,cy-20,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#003';ctx.beginPath();ctx.arc(cx-4,cy-19,2,0,Math.PI*2);ctx.fill();
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='12px monospace';for(let i=0;i<4;i++){const sa=Date.now()/250+i*Math.PI/2;ctx.fillText('\u2605',cx+Math.cos(sa)*35,pos.y-25+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('SCHNEE ADLER',cx,pos.y-30);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-25,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>25?'#8CF':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-24,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

class BossFirePhoenix extends Enemy {
    constructor(x,y) {
        super(x,y,100,90); this.hp=70; this.maxHp=70; this.speed=40;
        this.damage=3; this.isBoss=true; this.contactDamage=false; this.phasesThroughWalls=true;
        this.state='intro'; this.introTimer=2; this.stunnedTimer=0;
        this.fireTimer=3; this.waveTimer=6; this.wingAnim=0; this.phase=1;
    }
    update(dt,world,player,enemies,particles) {
        this.baseUpdate(dt,world); if(this.dead) return; this.wingAnim+=dt*6;
        if(this.hp<=35&&this.phase===1){this.phase=2;this.speed=55;}
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        if(this.state==='intro'){this.introTimer-=dt;if(this.introTimer<=0)this.state='fly';return;}
        if(this.state==='stunned'){this.stunnedTimer-=dt;if(this.stunnedTimer<=0)this.state='fly';return;}
        const a=angleBetween(mc,pc);
        this.x+=Math.cos(a)*this.speed*dt+Math.sin(Date.now()/400)*30*dt;
        this.y+=Math.sin(a)*this.speed*dt+Math.cos(Date.now()/350)*25*dt;
        if(particles&&Math.random()<0.3)particles.push(new Particle(mc.x+randRange(-20,20),mc.y+randRange(-10,20),randRange(-15,15),-40,'#F80',0.4));
        this.fireTimer-=dt;
        if(this.fireTimer<=0){
            this.fireTimer=this.phase===1?3:1.5;
            const targets=[pc,{x:pc.x+50,y:pc.y},{x:pc.x-50,y:pc.y}];
            for(const t of targets){const ta=angleBetween(mc,t);
                if(typeof Game!=='undefined')Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(ta)*200,Math.sin(ta)*200,2,'enemy',80));
            }
        }
        this.waveTimer-=dt;
        if(this.waveTimer<=0){
            this.waveTimer=this.phase===1?6:3;
            const n=12;for(let i=0;i<n;i++){const wa=(Math.PI*2*i)/n;
                if(typeof Game!=='undefined')Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(wa)*150,Math.sin(wa)*150,1,'enemy',60));
            }
            this.state='stunned';this.stunnedTimer=2;
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();for(let i=0;i<16;i++){ctx.globalAlpha=(1-t);const a=(Math.PI*2*i)/16+t*3;ctx.fillStyle=`hsl(${i*20},90%,55%)`;ctx.beginPath();ctx.arc(cx+Math.cos(a)*t*80,cy+Math.sin(a)*t*80,(1-t)*10,0,Math.PI*2);ctx.fill();}ctx.restore();return;}
        ctx.save();if(this.isFlashing())ctx.globalAlpha=0.4;
        const ws=Math.sin(this.wingAnim)*18;
        // Fire wings
        const wGrad=ctx.createRadialGradient(cx,cy,10,cx,cy,50);
        wGrad.addColorStop(0,'#FF0');wGrad.addColorStop(0.5,'#F80');wGrad.addColorStop(1,'rgba(255,0,0,0.3)');
        ctx.fillStyle=wGrad;
        ctx.beginPath();ctx.ellipse(cx-35-ws,cy,28+ws*0.5,18,-0.2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx+35+ws,cy,28+ws*0.5,18,0.2,0,Math.PI*2);ctx.fill();
        // Body
        const bGrad=ctx.createRadialGradient(cx-5,cy-10,5,cx,cy,30);
        bGrad.addColorStop(0,'#FF0');bGrad.addColorStop(0.4,'#F80');bGrad.addColorStop(1,'#C00');
        ctx.fillStyle=bGrad;ctx.beginPath();ctx.ellipse(cx,cy,25,18,0,0,Math.PI*2);ctx.fill();
        // Head
        ctx.fillStyle='#FA0';ctx.beginPath();ctx.arc(cx,cy-22,12,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#FF0';ctx.beginPath();ctx.arc(cx,cy-24,8,Math.PI,0);ctx.fill();
        // Beak
        ctx.fillStyle='#F60';ctx.beginPath();ctx.moveTo(cx+8,cy-22);ctx.lineTo(cx+18,cy-18);ctx.lineTo(cx+8,cy-16);ctx.closePath();ctx.fill();
        // Eyes (fierce red)
        ctx.fillStyle='#F00';ctx.beginPath();ctx.arc(cx-3,cy-24,3.5,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#800';ctx.beginPath();ctx.arc(cx-3,cy-23,1.5,0,Math.PI*2);ctx.fill();
        // Fire tail
        ctx.fillStyle='#F80';for(let i=0;i<5;i++){const tx=cx-10-i*8,ty=cy+15+Math.sin(Date.now()/100+i)*5;
            ctx.beginPath();ctx.arc(tx,ty,6-i,0,Math.PI*2);ctx.fill();}
        if(this.state==='stunned'){ctx.globalAlpha=0.7;ctx.fillStyle='#FF0';ctx.font='14px monospace';for(let i=0;i<4;i++){const sa=Date.now()/250+i*Math.PI/2;ctx.fillText('\u2605',cx+Math.cos(sa)*40,pos.y-30+Math.sin(sa)*6);}}
        ctx.globalAlpha=1;ctx.fillStyle='#FFF';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('FEUER PH\u00d6NIX',cx,pos.y-35);ctx.textAlign='left';
        ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(cx-45,pos.y-30,90,7,3);ctx.fill();
        ctx.fillStyle=this.hp>30?'#F84':'#F00';ctx.beginPath();ctx.roundRect(cx-44,pos.y-29,88*(this.hp/this.maxHp),5,2);ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── World-Specific Enemies (GDD accurate) ──
// ══════════════════════════════════════════

// W2: Drone (flies, throws wrenches)
class Drone extends Enemy {
    constructor(x,y) {
        super(x,y,20,16); this.hp=3; this.maxHp=3; this.speed=70; this.damage=1;
        this.phasesThroughWalls=true; this.detectionRange=200;
        this.shootTimer=0; this.shootCooldown=2; this.wingAnim=0;
    }
    update(dt,world,player,enemies,projectiles) {
        this.baseUpdate(dt,world); if(this.dead) return; this.wingAnim+=dt*12;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange) {
            const a=angleBetween(mc,pc);
            this.x+=Math.cos(a)*this.speed*dt; this.y+=Math.sin(a)*this.speed*dt;
            this.shootTimer-=dt;
            if(this.shootTimer<=0&&typeof Game!=='undefined') {
                this.shootTimer=this.shootCooldown;
                Game.projectiles.push(new Projectile(mc.x,mc.y,Math.cos(a)*140,Math.sin(a)*140,1,'enemy',50));
            }
        } else { this.x+=Math.sin(Date.now()/800)*20*dt; this.y+=Math.cos(Date.now()/600)*15*dt; }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#888';ctx.beginPath();ctx.arc(cx,cy,8*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        const ws=Math.sin(this.wingAnim)*4;
        ctx.fillStyle='#BBB'; ctx.beginPath(); ctx.ellipse(cx,cy,10,6,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(200,200,255,0.4)';
        ctx.beginPath(); ctx.ellipse(cx-8,cy-4-ws,6,3,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx+8,cy-4+ws,6,3,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#F00'; ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

// W5: Walking Mushroom (poison cloud on proximity)
class WalkingMushroom extends Enemy {
    constructor(x,y) {
        super(x,y,22,24); this.hp=5; this.maxHp=5; this.speed=30; this.damage=1;
        this.detectionRange=120; this.cloudTimer=0; this.cloudCooldown=3;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange) {
            const a=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
            this.cloudTimer-=dt;
            if(this.cloudTimer<=0&&dist<50) {
                this.cloudTimer=this.cloudCooldown;
                player.takeDamage(1, a, 80);
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#A84';ctx.beginPath();ctx.arc(cx,cy,11*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#DDB88C'; ctx.fillRect(cx-4,cy+2,8,12);
        ctx.fillStyle='#CC6644'; ctx.beginPath(); ctx.ellipse(cx,cy,12,8,0,Math.PI,0); ctx.fill();
        ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(cx-4,cy-3,3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+5,cy-1,2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(cx-3,cy+4,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+3,cy+4,2,0,Math.PI*2); ctx.fill();
        if(this.cloudTimer>this.cloudCooldown-0.5){ctx.globalAlpha=0.3;ctx.fillStyle='#A0F';ctx.beginPath();ctx.arc(cx,cy,20,0,Math.PI*2);ctx.fill();}
        ctx.restore();
    }
}

// W6: Swamp Mosquito (fast, dive attack)
class SwampMosquito extends Enemy {
    constructor(x,y) {
        super(x,y,18,14); this.hp=3; this.maxHp=3; this.speed=90; this.damage=1;
        this.phasesThroughWalls=true; this.detectionRange=200; this.wingAnim=0;
        this.diving=false; this.diveDir={x:0,y:0}; this.diveTimer=0;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return; this.wingAnim+=dt*15;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(this.diving) {
            this.x+=this.diveDir.x*180*dt; this.y+=this.diveDir.y*180*dt;
            this.diveTimer-=dt;
            if(dist<25) player.takeDamage(1,angleBetween(mc,pc),100);
            if(this.diveTimer<=0) this.diving=false;
            return;
        }
        if(dist<this.detectionRange) {
            const a=angleBetween(mc,pc);
            this.x+=Math.cos(a)*this.speed*0.3*dt+Math.sin(Date.now()/200)*30*dt;
            this.y+=Math.sin(a)*this.speed*0.3*dt+Math.cos(Date.now()/180)*25*dt;
            if(dist<80&&Math.random()<0.01) {
                this.diving=true; this.diveDir=vecNormalize(vecSub(pc,mc)); this.diveTimer=0.5;
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#8A4';ctx.beginPath();ctx.arc(cx,cy,7*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        const ws=Math.sin(this.wingAnim)*5;
        ctx.fillStyle='rgba(180,200,180,0.4)';
        ctx.beginPath();ctx.ellipse(cx-7,cy-3-ws,5,3,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx+7,cy-3+ws,5,3,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#665'; ctx.beginPath(); ctx.ellipse(cx,cy,7,5,0,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#554'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(cx,cy+5); ctx.lineTo(cx,cy+12); ctx.stroke();
        ctx.fillStyle='#F44'; ctx.beginPath(); ctx.arc(cx,cy-3,2,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

// W6: Crocodile Kid (gives key when helped/defeated)
class CrocodileKid extends Enemy {
    constructor(x,y) {
        super(x,y,24,20); this.hp=6; this.maxHp=6; this.speed=0; this.damage=0;
        this.contactDamage=false; this.isKeyGhost=true; this.droppedKey=false;
    }
    update(dt,world,player) { this.baseUpdate(dt,world); }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#FFD700';ctx.beginPath();ctx.arc(cx,cy,12*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.fillStyle='#5A5'; ctx.beginPath(); ctx.ellipse(cx,cy,11,8,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#6B6'; ctx.beginPath(); ctx.ellipse(cx+6,cy-2,6,4,0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(cx-2,cy-3,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+3,cy-3,2,0,Math.PI*2); ctx.fill();
        // Key icon above
        ctx.globalAlpha=0.3+Math.sin(Date.now()/400)*0.15;
        ctx.fillStyle='#FFD700'; ctx.beginPath(); ctx.arc(cx,pos.y-8,6,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

// W7: Ice Penguin (shoots ice beam that slows)
class IcePenguin extends Enemy {
    constructor(x,y) {
        super(x,y,22,24); this.hp=6; this.maxHp=6; this.speed=35; this.damage=1;
        this.detectionRange=180; this.shootTimer=0; this.shootCooldown=2.5;
    }
    update(dt,world,player,enemies,projectiles) {
        this.baseUpdate(dt,world); if(this.dead) return;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange) {
            const a=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
            this.shootTimer-=dt;
            if(this.shootTimer<=0&&typeof Game!=='undefined') {
                this.shootTimer=this.shootCooldown;
                const p=new Projectile(mc.x,mc.y,Math.cos(a)*120,Math.sin(a)*120,1,'enemy',30);
                p.isIce=true;
                Game.projectiles.push(p);
            }
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#8CF';ctx.beginPath();ctx.arc(cx,cy,11*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        // Body (black & white)
        ctx.fillStyle='#222'; ctx.beginPath(); ctx.ellipse(cx,cy,10,12,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.ellipse(cx,cy+2,7,9,0,0,Math.PI*2); ctx.fill();
        // Beak
        ctx.fillStyle='#F80'; ctx.beginPath(); ctx.moveTo(cx-2,cy-4); ctx.lineTo(cx,cy-8); ctx.lineTo(cx+2,cy-4); ctx.closePath(); ctx.fill();
        // Eyes
        ctx.fillStyle='#48F'; ctx.beginPath(); ctx.arc(cx-3,cy-6,2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+3,cy-6,2,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

// W8: Lava Ball (rolls toward player like bowling ball)
class LavaBall extends Enemy {
    constructor(x,y) {
        super(x,y,24,24); this.hp=4; this.maxHp=4; this.speed=65; this.damage=2;
        this.detectionRange=250; this.rollAngle=0;
    }
    update(dt,world,player) {
        this.baseUpdate(dt,world); if(this.dead) return;
        this.rollAngle+=dt*8;
        const pc={x:player.x+player.w/2,y:player.y+player.h/2}, mc={x:this.centerX(),y:this.centerY()};
        const dist=vecDist(mc,pc);
        if(dist<this.detectionRange) {
            const a=angleBetween(mc,pc);
            this._moveWithCollision(Math.cos(a)*this.speed*dt,Math.sin(a)*this.speed*dt,world);
        }
    }
    draw(ctx,camera) {
        const pos=camera.worldToScreen(this.x,this.y),cx=pos.x+this.w/2,cy=pos.y+this.h/2;
        if(this.dead){const t=this.deathProgress();ctx.save();ctx.globalAlpha=(1-t);ctx.fillStyle='#F80';ctx.beginPath();ctx.arc(cx,cy,12*(1-t),0,Math.PI*2);ctx.fill();ctx.restore();return;}
        ctx.save(); if(this.isFlashing()) ctx.globalAlpha=0.4;
        ctx.translate(cx,cy); ctx.rotate(this.rollAngle); ctx.translate(-cx,-cy);
        const g=ctx.createRadialGradient(cx-3,cy-3,2,cx,cy,12);
        g.addColorStop(0,'#FF0'); g.addColorStop(0.4,'#F80'); g.addColorStop(1,'#A00');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,12,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#F60'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(cx-6,cy-4); ctx.lineTo(cx+4,cy+6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+6,cy-6); ctx.lineTo(cx-2,cy+4); ctx.stroke();
        ctx.restore();
    }
}
