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
        this.hp -= amount;
        this.iFrames = this.iFrameDuration;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.deathTimer = 1.5;
        }
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

        // Power-ups
        this.speed = this.baseSpeed;
        for (const key of Object.keys(this.powerUps)) {
            this.powerUps[key].timer -= dt;
            if (this.powerUps[key].timer <= 0) {
                delete this.powerUps[key];
            }
        }
        if (this.hasPowerUp('speed')) this.speed = this.baseSpeed * 1.5;

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
            }
        }

        // Movement
        const dir = Input.direction;
        if (dir.x !== 0 || dir.y !== 0) {
            this.facingAngle = Math.atan2(dir.y, dir.x);
        }
        const dx = dir.x * this.speed * dt;
        const dy = dir.y * this.speed * dt;
        this._moveWithCollision(dx, dy, world);

        // Aim angle (right joystick or mouse)
        this.facingAngle = Input.aimAngle;

        // Weapon update
        this.activeWeapon.update(dt);

        // Attack - triggered by click/tap or by holding the right aim joystick
        if ((Input.attackPressed || Input.attackHeld) && this.activeWeapon.canAttack()) {
            if (this.activeWeapon.type === 'melee') {
                this.activeWeapon.attack(this.facingAngle);
            }
        }

        // Weapon switch (Q key)
        if (Input._key('KeyQ')) {
            if (!this._qWasDown) {
                this.switchWeapon();
                this._qWasDown = true;
            }
        } else {
            this._qWasDown = false;
        }
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

        if (this.dead) {
            const alpha = this.deathTimer / 1.5;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#F44';
            ctx.beginPath();
            ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2, this.w * (2 - alpha), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.save();
        if (flash) ctx.globalAlpha = 0.4;

        // Dodge trail
        if (this.dodging) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#88F';
            ctx.fillRect(pos.x - this.dodgeDir.x * 8, pos.y - this.dodgeDir.y * 8, this.w, this.h);
            ctx.globalAlpha = flash ? 0.4 : 1;
        }

        // Body
        ctx.fillStyle = this.hasPowerUp('attack') ? '#F88' : (this.hasPowerUp('speed') ? '#88F' : '#4A9');
        ctx.fillRect(pos.x + 2, pos.y + 2, this.w - 4, this.h - 4);

        // Face direction indicator
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(
            cx + Math.cos(this.facingAngle) * 8,
            cy + Math.sin(this.facingAngle) * 8,
            4, 0, Math.PI * 2
        );
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFF';
        const eyeOffset = 5;
        const eyeAngle1 = this.facingAngle - 0.4;
        const eyeAngle2 = this.facingAngle + 0.4;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle1) * eyeOffset, cy + Math.sin(eyeAngle1) * eyeOffset, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle2) * eyeOffset, cy + Math.sin(eyeAngle2) * eyeOffset, 3, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle1) * (eyeOffset + 1), cy + Math.sin(eyeAngle1) * (eyeOffset + 1), 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAngle2) * (eyeOffset + 1), cy + Math.sin(eyeAngle2) * (eyeOffset + 1), 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Power-up glow
        if (this.hasPowerUp('speed') || this.hasPowerUp('attack')) {
            ctx.globalAlpha = 0.15 + Math.sin(Date.now() / 200) * 0.05;
            ctx.fillStyle = this.hasPowerUp('attack') ? '#F00' : '#44F';
            ctx.beginPath();
            ctx.arc(cx, cy, this.w * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }

        // Weapon
        this.activeWeapon.draw(ctx, camera, this);

        ctx.restore();
    }
}
