// ── Camera ──

class Camera {
    constructor(canvasWidth, canvasHeight) {
        this.x = 0;
        this.y = 0;
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
    }

    follow(target, worldWidth, worldHeight, dt) {
        const targetX = target.x + target.w / 2 - this.width / 2;
        const targetY = target.y + target.h / 2 - this.height / 2;
        this.x = lerp(this.x, targetX, 5 * dt);
        this.y = lerp(this.y, targetY, 5 * dt);

        // Clamp to world bounds
        this.x = clamp(this.x, 0, Math.max(0, worldWidth - this.width));
        this.y = clamp(this.y, 0, Math.max(0, worldHeight - this.height));

        // Screen shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shakeX = randRange(-this.shakeIntensity, this.shakeIntensity);
            this.shakeY = randRange(-this.shakeIntensity, this.shakeIntensity);
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
    }

    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    worldToScreen(x, y) {
        return {
            x: x - this.x + this.shakeX,
            y: y - this.y + this.shakeY
        };
    }

    screenToWorld(sx, sy) {
        return {
            x: sx + this.x - this.shakeX,
            y: sy + this.y - this.shakeY
        };
    }
}
