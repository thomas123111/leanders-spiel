// ── Loot System ──

class Chest {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 24;
        this.h = 20;
        this.opened = false;
        this.interactRange = 40;
        this.item = null;
        this.itemFloatTimer = 0;
        this.itemCollected = false;
    }

    open() {
        if (this.opened) return;
        this.opened = true;
        // Random loot
        const roll = Math.random();
        if (roll < 0.35) {
            this.item = { type: 'heart', name: 'Herz', heal: 4 }; // 1 full heart
        } else if (roll < 0.55) {
            this.item = { type: 'halfheart', name: 'Halbes Herz', heal: 2 };
        } else if (roll < 0.75) {
            this.item = { type: 'speed', name: 'Geschwindigkeit+', duration: 10 };
        } else {
            this.item = { type: 'attack', name: 'Stärke+', duration: 15 };
        }
        this.itemFloatTimer = 1.5;
    }

    update(dt, player) {
        if (this.opened && this.item && !this.itemCollected) {
            this.itemFloatTimer -= dt;
            if (this.itemFloatTimer <= 0) {
                this._collectItem(player);
            }
        }
    }

    _collectItem(player) {
        if (this.itemCollected || !this.item) return;
        this.itemCollected = true;
        const item = this.item;

        if (item.type === 'heart' || item.type === 'halfheart') {
            player.heal(item.heal);
        } else if (item.type === 'speed') {
            player.addPowerUp('speed', item.duration);
        } else if (item.type === 'attack') {
            player.addPowerUp('attack', item.duration);
        }
    }

    canInteract(player) {
        if (this.opened) return false;
        const dist = vecDist(
            { x: this.x + this.w / 2, y: this.y + this.h / 2 },
            { x: player.x + player.w / 2, y: player.y + player.h / 2 }
        );
        return dist < this.interactRange;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);

        if (!this.opened) {
            // Closed chest
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(pos.x, pos.y, this.w, this.h);
            // Lid
            ctx.fillStyle = '#A0801C';
            ctx.fillRect(pos.x - 1, pos.y, this.w + 2, 6);
            // Lock
            ctx.fillStyle = '#FFD700';
            ctx.fillRect(pos.x + this.w / 2 - 3, pos.y + 6, 6, 5);
            // Border
            ctx.strokeStyle = '#5A4008';
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x, pos.y, this.w, this.h);

            // Interaction hint if player is near (handled in renderer)
        } else {
            // Open chest
            ctx.fillStyle = '#6B5010';
            ctx.fillRect(pos.x, pos.y + 4, this.w, this.h - 4);
            // Open lid (tilted back)
            ctx.fillStyle = '#8B6914';
            ctx.fillRect(pos.x - 1, pos.y, this.w + 2, 5);
            ctx.strokeStyle = '#5A4008';
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x, pos.y + 4, this.w, this.h - 4);

            // Floating item
            if (this.item && !this.itemCollected) {
                const floatY = pos.y - 10 - (1.5 - this.itemFloatTimer) * 15;
                const alpha = Math.min(1, this.itemFloatTimer);
                ctx.save();
                ctx.globalAlpha = alpha;

                if (this.item.type === 'heart' || this.item.type === 'halfheart') {
                    this._drawHeart(ctx, pos.x + this.w / 2, floatY, this.item.type === 'heart' ? 8 : 6);
                } else if (this.item.type === 'speed') {
                    ctx.fillStyle = '#4AF';
                    ctx.beginPath();
                    ctx.moveTo(pos.x + this.w / 2, floatY - 8);
                    ctx.lineTo(pos.x + this.w / 2 + 6, floatY);
                    ctx.lineTo(pos.x + this.w / 2 + 2, floatY);
                    ctx.lineTo(pos.x + this.w / 2 + 2, floatY + 8);
                    ctx.lineTo(pos.x + this.w / 2 - 2, floatY + 8);
                    ctx.lineTo(pos.x + this.w / 2 - 2, floatY);
                    ctx.lineTo(pos.x + this.w / 2 - 6, floatY);
                    ctx.closePath();
                    ctx.fill();
                } else if (this.item.type === 'attack') {
                    ctx.fillStyle = '#F44';
                    ctx.beginPath();
                    ctx.moveTo(pos.x + this.w / 2, floatY - 8);
                    ctx.lineTo(pos.x + this.w / 2 + 5, floatY + 2);
                    ctx.lineTo(pos.x + this.w / 2 + 2, floatY + 2);
                    ctx.lineTo(pos.x + this.w / 2 + 2, floatY + 8);
                    ctx.lineTo(pos.x + this.w / 2 - 2, floatY + 8);
                    ctx.lineTo(pos.x + this.w / 2 - 2, floatY + 2);
                    ctx.lineTo(pos.x + this.w / 2 - 5, floatY + 2);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
        }
    }

    _drawHeart(ctx, x, y, size) {
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y - size * 0.3, x - size, y - size * 0.3, x - size, y + size * 0.1);
        ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size, x, y + size);
        ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.6, x + size, y + size * 0.1);
        ctx.bezierCurveTo(x + size, y - size * 0.3, x, y - size * 0.3, x, y + size * 0.3);
        ctx.fill();
    }
}

// ── Key Drop ──
class KeyDrop {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 16;
        this.h = 16;
        this.collected = false;
        this.bobOffset = 0;
    }

    update(dt, player) {
        if (this.collected) return;
        this.bobOffset += dt;
        const dist = vecDist(
            { x: this.x + this.w / 2, y: this.y + this.h / 2 },
            { x: player.x + player.w / 2, y: player.y + player.h / 2 }
        );
        if (dist < 30) {
            this.collected = true;
            return true; // signal: key collected
        }
        return false;
    }

    draw(ctx, camera) {
        if (this.collected) return;
        const bob = Math.sin(this.bobOffset * 3) * 4;
        const pos = camera.worldToScreen(this.x, this.y + bob);

        // Glow
        ctx.save();
        ctx.globalAlpha = 0.3 + Math.sin(this.bobOffset * 4) * 0.1;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Key
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(pos.x + 4, pos.y + 6, 10, 4);
        ctx.fillRect(pos.x + 12, pos.y + 4, 3, 3);
        ctx.fillRect(pos.x + 12, pos.y + 9, 3, 3);
        ctx.beginPath();
        ctx.arc(pos.x + 5, pos.y + 8, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#B8960F';
        ctx.beginPath();
        ctx.arc(pos.x + 5, pos.y + 8, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}
