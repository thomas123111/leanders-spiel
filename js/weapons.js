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

    getHitEntities(playerPos, enemies) {
        if (!this.swinging) return [];
        const hit = [];
        const center = { x: playerPos.x + playerPos.w / 2, y: playerPos.y + playerPos.h / 2 };
        for (const enemy of enemies) {
            if (enemy.dead) continue;
            const eCenter = { x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2 };
            if (pointInArc(eCenter, center, this.swingAngle, this.arcWidth, this.range)) {
                hit.push(enemy);
            }
        }
        return hit;
    }

    draw(ctx, camera, playerPos) {
        if (!this.swinging) return;
        const center = camera.worldToScreen(
            playerPos.x + playerPos.w / 2,
            playerPos.y + playerPos.h / 2
        );
        const progress = 1 - (this.swingTimer / this.swingDuration);
        const startAngle = this.swingAngle - this.arcWidth / 2;
        const sweepAngle = this.arcWidth * progress;

        ctx.save();
        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        // Draw bat line at current sweep position
        const currentAngle = startAngle + sweepAngle;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(
            center.x + Math.cos(currentAngle) * this.range,
            center.y + Math.sin(currentAngle) * this.range
        );
        ctx.stroke();

        // Draw arc trail
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, this.range * 0.8, startAngle, startAngle + sweepAngle);
        ctx.stroke();

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
        this.knockback = 120;
    }

    canAttack() {
        return this.cooldownTimer <= 0;
    }

    attack(angle, playerPos, projectiles) {
        if (!this.canAttack()) return false;
        this.cooldownTimer = this.cooldown;
        const cx = playerPos.x + playerPos.w / 2;
        const cy = playerPos.y + playerPos.h / 2;
        projectiles.push(new Projectile(
            cx, cy,
            Math.cos(angle) * this.projectileSpeed,
            Math.sin(angle) * this.projectileSpeed,
            this.damage,
            'player',
            this.knockback
        ));
        return true;
    }

    update(dt) {
        if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
    }

    draw(ctx, camera, playerPos) {
        // Draw gun indicator on player
        const center = camera.worldToScreen(
            playerPos.x + playerPos.w / 2,
            playerPos.y + playerPos.h / 2
        );
        ctx.save();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const angle = Input.aimAngle;
        ctx.moveTo(center.x + Math.cos(angle) * 10, center.y + Math.sin(angle) * 10);
        ctx.lineTo(center.x + Math.cos(angle) * 22, center.y + Math.sin(angle) * 22);
        ctx.stroke();
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, vx, vy, damage, owner, knockback) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.owner = owner; // 'player' or 'enemy'
        this.knockback = knockback || 100;
        this.radius = 5;
        this.dead = false;
        this.lifetime = 3;
    }

    update(dt, world) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.dead = true;
        if (world.isWall(this.x, this.y)) this.dead = true;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        ctx.save();
        ctx.fillStyle = this.owner === 'player' ? '#FFF' : '#FF4444';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.owner === 'player') {
            // Baseball stitching
            ctx.strokeStyle = '#F44';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pos.x - 1, pos.y, 3, -0.5, 0.5);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(pos.x + 1, pos.y, 3, Math.PI - 0.5, Math.PI + 0.5);
            ctx.stroke();
        }
        ctx.restore();
    }
}
