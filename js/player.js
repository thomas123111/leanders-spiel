// ── Player ──

class Player {
    constructor(x, y) {
        this.x = x - 14;
        this.y = y - 14;
        this.w = 28;
        this.h = 28;
        this.baseSpeed = 150;
        this.speed = this.baseSpeed;
        this.hp = 20; // 5 hearts x 4 quarters
        this.maxHp = 20;
        this.facingAngle = 0;
        this.dead = false;

        // Weapons
        this.meleeWeapon = new BaseballBat();
        this.rangedWeapon = null;
        this.activeWeapon = this.meleeWeapon;

        // Dodge / roll
        this.dodging = false;
        this.dodgeTimer = 0;
        this.dodgeDuration = 0.3;
        this.dodgeCooldown = 0;
        this.dodgeCooldownTime = 0.8;
        this.dodgeSpeed = 400;
        this.dodgeDir = { x: 0, y: 0 };

        // Invincibility
        this.iFrames = 0;
        this.iFrameDuration = 1.0;

        // Power-ups
        this.powerUps = {}; // { speed: { timer: 10 }, attack: { timer: 15 } }

        // ── Unlockable abilities ──
        // Auto (unlocked after World 2): drive through walls for 15s
        this.hasAuto = false;
        this.autoActive = false;
        this.autoTimer = 0;
        this.autoDuration = 15;
        this.autoCharges = 0;    // World 3: must kill 5 slimes to charge
        this.autoChargesNeeded = 5;
        this.autoReady = true;   // true in W2, in W3 must be charged

        // Krone/Crown (unlocked after World 3): 5s shield at level start
        this.hasCrown = false;
        this.crownShieldTimer = 0;
        this.crownShieldDuration = 15;

        // Slow / sticky effects
        this.slowTimer = 0;
        this.slowFactor = 1;

        // Death
        this.deathTimer = 0;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    addPowerUp(type, duration) {
        this.powerUps[type] = { timer: duration };
    }

    hasPowerUp(type) {
        return this.powerUps[type] && this.powerUps[type].timer > 0;
    }

    takeDamage(amount, knockbackAngle, knockbackForce) {
        if (this.iFrames > 0 || this.dodging || this.dead) return;
        if (this.crownShieldTimer > 0) return;
        if (this.autoActive) return;
        this.hp -= amount;
        this.iFrames = this.iFrameDuration;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.deathTimer = 1.5;
        }
    }

    activateAuto() {
        if (!this.hasAuto || this.autoActive) return;
        if (!this.autoReady) return;
        this.autoActive = true;
        this.autoTimer = this.autoDuration;
        this.autoCharges = 0;
        this.autoReady = true; // will be set false in W3 after use
    }

    addAutoCharge() {
        if (!this.hasAuto) return;
        this.autoCharges++;
        if (this.autoCharges >= this.autoChargesNeeded) {
            this.autoReady = true;
        }
    }

    startCrownShield() {
        if (this.hasCrown) {
            this.crownShieldTimer = this.crownShieldDuration;
        }
    }

    applySlow(duration, factor) {
        this.slowTimer = Math.max(this.slowTimer, duration);
        this.slowFactor = Math.min(this.slowFactor, factor || 0.65);
    }

    switchWeapon() {
        if (this.rangedWeapon) {
            this.activeWeapon = this.activeWeapon === this.meleeWeapon
                ? this.rangedWeapon : this.meleeWeapon;
        }
    }

    update(dt, world) {
        if (this.dead) {
            this.deathTimer -= dt;
            return;
        }

        // Crown shield countdown
        if (this.crownShieldTimer > 0) this.crownShieldTimer -= dt;

        // Slow countdown
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.slowFactor = 1;
        }

        // Auto ability
        if (this.autoActive) {
            this.autoTimer -= dt;
            if (this.autoTimer <= 0) {
                this.autoActive = false;
            }
        }

        if (this.hasAuto && this.autoReady && !this.autoActive && Input.keyPressed('KeyE')) {
            this.activateAuto();
        }

        // Power-ups
        this.speed = this.baseSpeed;
        if (this.autoActive) this.speed = this.baseSpeed * 2; // Auto is fast!
        for (const key of Object.keys(this.powerUps)) {
            this.powerUps[key].timer -= dt;
            if (this.powerUps[key].timer <= 0) {
                delete this.powerUps[key];
            }
        }
        if (this.hasPowerUp('speed')) this.speed *= 1.5;

        // Invincibility
        if (this.iFrames > 0) this.iFrames -= dt;

        // Dodge cooldown
        if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;

        // Dodge
        if (this.dodging) {
            this.dodgeTimer -= dt;
            const dx = this.dodgeDir.x * this.dodgeSpeed * dt;
            const dy = this.dodgeDir.y * this.dodgeSpeed * dt;
            this._moveWithCollision(dx, dy, world);
            if (this.dodgeTimer <= 0) {
                this.dodging = false;
                this.dodgeCooldown = this.dodgeCooldownTime;
            }
            return; // No other movement during dodge
        }

        // Check for dodge input
        if (Input.dodgeTriggered && !this.dodging && this.dodgeCooldown <= 0) {
            const dir = Input.direction;
            if (dir.x !== 0 || dir.y !== 0) {
                this.dodging = true;
                this.dodgeTimer = this.dodgeDuration;
                this.dodgeDir = vecNormalize(dir);
                this.iFrames = this.dodgeDuration + 0.1;
                Sound.dodge();
            }
        }

        // Movement
        const dir = Input.direction;
        if (dir.x !== 0 || dir.y !== 0) {
            this.facingAngle = Math.atan2(dir.y, dir.x);
        }
        const dx = dir.x * this.speed * this.slowFactor * dt;
        const dy = dir.y * this.speed * this.slowFactor * dt;
        if (this.autoActive) {
            // Auto: drive through walls!
            this.x += dx;
            this.y += dy;
        } else {
            this._moveWithCollision(dx, dy, world);
        }

        // Aim angle (right joystick or mouse)
        this.facingAngle = Input.aimAngle;

        // Weapon update
        this.activeWeapon.update(dt);

        // Attack - triggered by click/tap or by holding the right aim joystick
        if ((Input.attackPressed || Input.attackHeld) && this.activeWeapon.canAttack()) {
            if (this.activeWeapon.type === 'melee') {
                this.activeWeapon.attack(this.facingAngle);
                Sound.swing();
            }
        }

        if (Input.keyPressed('KeyQ')) this.switchWeapon();
    }

    _moveWithCollision(dx, dy, world) {
        // Move X
        this.x += dx;
        const xCols = world.collideRect({ x: this.x, y: this.y, w: this.w, h: this.h });
        for (const wall of xCols) {
            if (rectOverlap({ x: this.x, y: this.y, w: this.w, h: this.h }, wall)) {
                if (dx > 0) this.x = wall.x - this.w;
                else if (dx < 0) this.x = wall.x + wall.w;
            }
        }
        // Move Y
        this.y += dy;
        const yCols = world.collideRect({ x: this.x, y: this.y, w: this.w, h: this.h });
        for (const wall of yCols) {
            if (rectOverlap({ x: this.x, y: this.y, w: this.w, h: this.h }, wall)) {
                if (dy > 0) this.y = wall.y - this.h;
                else if (dy < 0) this.y = wall.y + wall.h;
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const flash = this.iFrames > 0 && Math.floor(this.iFrames * 10) % 2;
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;

        if (this.dead) {
            // Death: Mark spins and fades
            const alpha = this.deathTimer / 1.5;
            const spin = (1 - alpha) * Math.PI * 4;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(cx, cy);
            ctx.rotate(spin);
            ctx.fillStyle = '#F44';
            ctx.beginPath();
            ctx.arc(0, 0, this.w / 2 + (1 - alpha) * 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FCA';
            ctx.beginPath();
            ctx.arc(0, -2, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Walk bob animation
        const walkBob = (Input.direction.x !== 0 || Input.direction.y !== 0)
            ? Math.sin(Date.now() / 80) * 2 : 0;

        // Dodge trail (afterimages)
        if (this.dodging) {
            for (let i = 1; i <= 3; i++) {
                ctx.globalAlpha = 0.15 / i;
                ctx.fillStyle = '#6BF';
                ctx.beginPath();
                ctx.arc(
                    cx - this.dodgeDir.x * i * 7,
                    cy - this.dodgeDir.y * i * 7,
                    this.w / 2 - 2, 0, Math.PI * 2
                );
                ctx.fill();
            }
            ctx.globalAlpha = flash ? 0.4 : 1;
        }

        // ── Shadow ──
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + this.h / 2 + 1, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // ── Body (torso - blue t-shirt) ──
        const bodyColor = this.hasPowerUp('attack') ? '#E85555' : (this.hasPowerUp('speed') ? '#5588EE' : '#4499AA');
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(cx - 9, cy - 4 + walkBob, 18, 14, 3);
        ctx.fill();

        // ── Legs (simple, animated) ──
        const legSwing = (Input.direction.x !== 0 || Input.direction.y !== 0)
            ? Math.sin(Date.now() / 100) * 3 : 0;
        ctx.fillStyle = '#3366AA';
        ctx.fillRect(cx - 6, cy + 9 + walkBob, 4, 6);
        ctx.fillRect(cx + 2, cy + 9 + walkBob, 4, 6);
        // Shoes
        ctx.fillStyle = '#553322';
        ctx.fillRect(cx - 7 - legSwing * 0.3, cy + 14 + walkBob, 6, 3);
        ctx.fillRect(cx + 1 + legSwing * 0.3, cy + 14 + walkBob, 6, 3);

        // ── Head ──
        ctx.fillStyle = '#FFCC88';
        ctx.beginPath();
        ctx.arc(cx, cy - 6 + walkBob, 9, 0, Math.PI * 2);
        ctx.fill();

        // ── Hair (short brown, visible below cap) ──
        ctx.fillStyle = '#663300';
        ctx.fillRect(cx - 9, cy - 4 + walkBob, 3, 4);
        ctx.fillRect(cx + 6, cy - 4 + walkBob, 3, 4);
        ctx.beginPath();
        ctx.arc(cx, cy - 6 + walkBob, 9, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.fill();

        // ── Red Baseball Cap ──
        const capY = cy - 8 + walkBob;
        ctx.fillStyle = '#DD2222';
        // Cap dome
        ctx.beginPath();
        ctx.arc(cx, capY, 10, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(cx - 10, capY - 1, 20, 4);
        // Cap brim (points in facing direction)
        ctx.fillStyle = '#BB1111';
        const brimAngle = this.facingAngle;
        ctx.beginPath();
        ctx.ellipse(
            cx + Math.cos(brimAngle) * 8,
            capY + 2 + Math.sin(brimAngle) * 3,
            7, 3, brimAngle, 0, Math.PI * 2
        );
        ctx.fill();
        // Cap button on top
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.arc(cx, capY - 3, 2, 0, Math.PI * 2);
        ctx.fill();

        // ── Eyes (normal boy eyes, follow facing) ──
        const eyeY = cy - 5 + walkBob;
        const eyeAngle1 = this.facingAngle - 0.4;
        const eyeAngle2 = this.facingAngle + 0.4;
        const eyeDist = 4.5;
        // Eye whites
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle1) * eyeDist, eyeY + Math.sin(eyeAngle1) * eyeDist, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle2) * eyeDist, eyeY + Math.sin(eyeAngle2) * eyeDist, 3, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#332211';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle1) * (eyeDist + 1), eyeY + Math.sin(eyeAngle1) * (eyeDist + 1), 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle2) * (eyeDist + 1), eyeY + Math.sin(eyeAngle2) * (eyeDist + 1), 1.5, 0, Math.PI * 2);
        ctx.fill();

        // ── Mouth (small smile) ──
        ctx.strokeStyle = '#884422';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const mouthX = cx + Math.cos(this.facingAngle) * 5;
        const mouthY = eyeY + Math.sin(this.facingAngle) * 5 + 3;
        ctx.arc(mouthX, mouthY, 2, 0.1, Math.PI - 0.1);
        ctx.stroke();

        // ── Arms (extend toward facing direction) ──
        const armAngle = this.facingAngle;
        ctx.strokeStyle = '#FFBB77';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        // Leading arm (toward aim)
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(armAngle + Math.PI / 2) * 7, cy + Math.sin(armAngle + Math.PI / 2) * 4 + walkBob);
        ctx.lineTo(cx + Math.cos(armAngle) * 14 + Math.cos(armAngle + Math.PI / 2) * 4,
                   cy + Math.sin(armAngle) * 14 + Math.sin(armAngle + Math.PI / 2) * 4 + walkBob);
        ctx.stroke();
        // Trailing arm
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(armAngle - Math.PI / 2) * 7, cy + Math.sin(armAngle - Math.PI / 2) * 4 + walkBob);
        ctx.lineTo(cx + Math.cos(armAngle) * 10 + Math.cos(armAngle - Math.PI / 2) * 5,
                   cy + Math.sin(armAngle) * 10 + Math.sin(armAngle - Math.PI / 2) * 5 + walkBob);
        ctx.stroke();

        // ── Power-up glow ──
        if (this.hasPowerUp('speed') || this.hasPowerUp('attack')) {
            ctx.globalAlpha = 0.12 + Math.sin(Date.now() / 200) * 0.05;
            ctx.fillStyle = this.hasPowerUp('attack') ? '#F44' : '#44F';
            ctx.beginPath();
            ctx.arc(cx, cy + walkBob, this.w * 0.8, 0, Math.PI * 2);
            ctx.fill();
            // Sparkles
            ctx.globalAlpha = 0.6;
            const sparkColor = this.hasPowerUp('attack') ? '#F88' : '#8BF';
            for (let i = 0; i < 3; i++) {
                const sa = Date.now() / 300 + i * Math.PI * 2 / 3;
                const sr = 16 + Math.sin(Date.now() / 200 + i) * 4;
                ctx.fillStyle = sparkColor;
                ctx.beginPath();
                ctx.arc(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr + walkBob, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // ── Crown Shield ──
        if (this.crownShieldTimer > 0) {
            const shieldAlpha = Math.min(1, this.crownShieldTimer) * 0.3;
            ctx.globalAlpha = shieldAlpha + Math.sin(Date.now() / 150) * 0.1;
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cx, cy + walkBob, this.w * 0.85, 0, Math.PI * 2);
            ctx.stroke();
            // Crown icon above head
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#FFD700';
            const crY = cy - 20 + walkBob;
            ctx.beginPath();
            ctx.moveTo(cx - 7, crY + 5);
            ctx.lineTo(cx - 7, crY);
            ctx.lineTo(cx - 4, crY + 3);
            ctx.lineTo(cx, crY - 2);
            ctx.lineTo(cx + 4, crY + 3);
            ctx.lineTo(cx + 7, crY);
            ctx.lineTo(cx + 7, crY + 5);
            ctx.closePath();
            ctx.fill();
            // Timer
            ctx.fillStyle = '#FFD700';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.crownShieldTimer) + 's', cx, crY - 5);
        }

        // ── Auto Mode Visual ──
        if (this.autoActive) {
            ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 100) * 0.1;
            ctx.strokeStyle = '#0FF';
            ctx.lineWidth = 2;
            // Car outline around player
            ctx.beginPath();
            ctx.roundRect(cx - 18, cy - 12 + walkBob, 36, 28, 6);
            ctx.stroke();
            // Wheels
            ctx.fillStyle = '#333';
            ctx.fillRect(cx - 18, cy - 8 + walkBob, 4, 6);
            ctx.fillRect(cx + 14, cy - 8 + walkBob, 4, 6);
            ctx.fillRect(cx - 18, cy + 8 + walkBob, 4, 6);
            ctx.fillRect(cx + 14, cy + 8 + walkBob, 4, 6);
            // Speed lines
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = '#0FF';
            ctx.lineWidth = 1;
            for (let i = 0; i < 4; i++) {
                const lx = cx - 22 - i * 8 - Math.cos(this.facingAngle) * 10;
                const ly = cy + (i - 1.5) * 6 + walkBob;
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(lx - 10, ly);
                ctx.stroke();
            }
            // Timer
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#0FF';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.autoTimer) + 's', cx, cy - 18 + walkBob);
        }

        // ── Weapon ──
        ctx.globalAlpha = 1;
        this.activeWeapon.draw(ctx, camera, this);

        ctx.restore();
    }
}
