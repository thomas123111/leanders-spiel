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
