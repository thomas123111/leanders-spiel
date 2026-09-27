// ── Kamera ──

class Camera {
    constructor(viewWidth, viewHeight) {
        this.x = 0;
        this.y = 0;
        this.width = viewWidth;
        this.height = viewHeight;
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
    }

    follow(target, worldWidth, worldHeight, dt) {
        const targetX = target.x + target.w / 2 - this.width / 2;
        const targetY = target.y + target.h / 2 - this.height / 2;
        const k = 1 - Math.exp(-5 * dt);
        this.x += (targetX - this.x) * k;
        this.y += (targetY - this.y) * k;
        this.clampTo(worldWidth, worldHeight);
        this.updateShake(dt);
    }

    // Innerhalb der Karte halten; ist die Karte kleiner als die Sicht, mittig zeigen.
    clampTo(worldWidth, worldHeight) {
        this.x = worldWidth <= this.width ? (worldWidth - this.width) / 2 : clamp(this.x, 0, worldWidth - this.width);
        this.y = worldHeight <= this.height ? (worldHeight - this.height) / 2 : clamp(this.y, 0, worldHeight - this.height);
    }

    // Wackeln läuft unabhängig vom Folgen ab (auch beim Tod oder im Siegesmoment).
    updateShake(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            const k = clamp(this.shakeTimer * 4, 0, 1);
            this.shakeX = randRange(-this.shakeIntensity, this.shakeIntensity) * k;
            this.shakeY = randRange(-this.shakeIntensity, this.shakeIntensity) * k;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
    }

    shake(intensity, duration) {
        this.shakeIntensity = Math.max(this.shakeTimer > 0 ? this.shakeIntensity : 0, intensity);
        this.shakeTimer = Math.max(this.shakeTimer, duration);
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
