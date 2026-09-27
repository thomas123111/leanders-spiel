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
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }

    takeDamage(amount) {
        if (this.iFrames > 0 || this.dead) return;
        this.hp -= amount; this.iFrames = 1; this.hitFlash = 0.12;
        if (this.hp <= 0) {
            this.hp = 0; this.dead = true;
            Juri.poof(this.centerX(), this.centerY());
        }
    }

    // ── gemeinsame Helfer für alle Begleiter ──

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
        for (const e of enemies) {
            if (e.dead || !e.contactDamage) continue;
            if (rectOverlap(this, e)) this.takeDamage(e.damage);
        }
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
        Art.eyes(ctx, hx + f * 1.5, hy - 1.1, 2.1, { gap: 2.9, look: { x: lx, y: ly }, seed: this.seed });
        Art.mouth(ctx, hx + f * 1.7, hy + 4.3, 4.8, sw >= 0 ? 'open' : 'grin');
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
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }

    takeDamage(amount) {
        if (this.iFrames > 0 || this.dead) return;
        this.hp -= amount; this.iFrames = 1; this.hitFlash = 0.12;
        if (this.hp <= 0) {
            this.hp = 0; this.dead = true;
            Juri.poof(this.centerX(), this.centerY());
        }
    }

    update(dt, world, player, enemies) {
        if (this.dead) return;
        if (this.iFrames > 0) this.iFrames -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.mouthTimer > 0) this.mouthTimer -= dt;
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
        for (const e of enemies) {
            if (e.dead || !e.contactDamage) continue;
            if (rectOverlap(this, e)) this.takeDamage(e.damage);
        }
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
        Art.eye(ctx, e0, ey - 0.2, 2.1, look, { iris: '#ffd23f', irisSize: 0.72, open: blink, lid: INK });
        Art.eye(ctx, e1, ey - 0.2, 2.1, look, { iris: '#ffd23f', irisSize: 0.72, open: blink, lid: INK });
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
