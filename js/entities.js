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

// (Particle wohnt jetzt in js/fx.js)

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
        if (this.isKeyGhost) {
            ctx.fillStyle = '#FFD700';
            ctx.globalAlpha = 0.95;
            ctx.beginPath();
            ctx.arc(cx + 10, cy - 12, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(cx + 9, cy - 8, 2, 6);
            ctx.fillRect(cx + 11, cy - 8, 5, 2);
        }

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
