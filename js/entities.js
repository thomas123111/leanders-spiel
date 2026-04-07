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
        ctx.fillText('RIESEN-GEIST', bcx, barY - 4);
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
            this.x += Math.cos(angle) * this.speed * dt * 0.5;
            this.y += Math.sin(angle) * this.speed * dt * 0.5;
            this._moveWithCollision(0, 0, world);
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

        // Body
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#999';
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
                this.x += Math.cos(angle) * this.speed * 0.4 * dt;
                this.y += Math.sin(angle) * this.speed * 0.4 * dt;
                this._moveWithCollision(0, 0, world);
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
            this.x += this.rollDir.x * 200 * dt;
            this.y += this.rollDir.y * 200 * dt;
            this._moveWithCollision(0, 0, world);
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
        ctx.fillStyle = this.rollState === 'charging' ? '#FA0' : '#777';
        ctx.beginPath();
        ctx.arc(cx, cy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#999';
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
        ctx.fillText('GEISTER-KÜKEN', bpos.x + this.w / 2, barY - 4);
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
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
            this._moveWithCollision(0, 0, world);
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
        this.hp = 60;
        this.maxHp = 60;
        this.speed = 25;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = true;
        this.phase = 1;
        this.squish = 0;

        this.state = 'intro';
        this.introTimer = 2;
        this.jumpTimer = 5;
        this.jumpCooldown = 5;
        this.jumpState = 'none'; // none, rising, falling
        this.jumpProgress = 0;
        this.splitAt40 = false;
        this.splitAt20 = false;
        this.stunnedTimer = 0;
    }

    update(dt, world, player, enemies, particles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;

        if (this.hp <= 30 && this.phase === 1) {
            this.phase = 2;
            this.speed = 40;
            this.jumpCooldown = 3;
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

        // Split spawns
        if (this.hp <= 40 && !this.splitAt40 && enemies) {
            this.splitAt40 = true;
            for (let i = 0; i < 3; i++) {
                const a = (Math.PI * 2 * i) / 3;
                enemies.push(new Slime(mc.x + Math.cos(a) * 60, mc.y + Math.sin(a) * 60));
            }
        }
        if (this.hp <= 20 && !this.splitAt20 && enemies) {
            this.splitAt20 = true;
            for (let i = 0; i < 3; i++) {
                const a = (Math.PI * 2 * i) / 3 + 0.5;
                enemies.push(new Slime(mc.x + Math.cos(a) * 60, mc.y + Math.sin(a) * 60));
            }
        }

        if (this.state === 'chase') {
            const angle = angleBetween(mc, pc);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
            this._moveWithCollision(0, 0, world);
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
                // Move to player pos
                this.x = pc.x - this.w / 2;
                this.y = pc.y - this.h / 2;
            }
            if (this.jumpState === 'falling' && this.jumpProgress > 0.3) {
                // Impact!
                const dist = vecDist(mc, pc);
                if (dist < 120) {
                    player.takeDamage(2, angleBetween(mc, pc), 250);
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
        ctx.fillText('SCHLEIM-KÖNIG', bpos.x + this.w / 2, barY - 4);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 7, 3); ctx.fill();
        const hpPct = this.hp / this.maxHp;
        ctx.fillStyle = hpPct > 0.4 ? '#4D4' : hpPct > 0.2 ? '#FF0' : '#F00';
        ctx.beginPath(); ctx.roundRect(barX + 1, barY + 1, (barW - 2) * hpPct, 5, 2); ctx.fill();

        ctx.restore();
    }
}
