// ── Renderer / HUD ──

const Renderer = {
    drawHUD(ctx, player, game) {
        ctx.save();

        // ── Hearts ──
        const heartSize = 20;
        const heartSpacing = 26;
        const startX = 12;
        const startY = 12;
        const totalHearts = player.maxHp / 4;
        const fullHearts = Math.floor(player.hp / 4);
        const remainder = player.hp % 4;

        for (let i = 0; i < totalHearts; i++) {
            const x = startX + i * heartSpacing;
            const y = startY;
            // Background (empty heart)
            this._drawHeartIcon(ctx, x, y, heartSize, '#444');

            if (i < fullHearts) {
                // Full heart
                this._drawHeartIcon(ctx, x, y, heartSize, '#F44');
            } else if (i === fullHearts && remainder > 0) {
                // Partial heart - clip
                ctx.save();
                ctx.beginPath();
                ctx.rect(x - heartSize / 2, y - heartSize / 2, heartSize * (remainder / 4), heartSize);
                ctx.clip();
                this._drawHeartIcon(ctx, x, y, heartSize, '#F44');
                ctx.restore();
            }
            // Heart outline
            this._drawHeartIcon(ctx, x, y, heartSize, null, '#B22');
        }

        // ── Key indicator ──
        if (game.hasKey) {
            const kx = ctx.canvas.width - 40;
            const ky = 20;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('🔑', kx, ky);
            ctx.fillRect(kx + 2, ky - 2, 12, 4);
        }

        // ── Boss door hint ──
        if (game.hasKey && !game.world.bossDoorOpen) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Schlüssel gefunden! Finde die Boss-Tür!', ctx.canvas.width / 2, 20);
            ctx.textAlign = 'left';
        }

        // ── Power-ups ──
        let puY = 40;
        for (const [key, pu] of Object.entries(player.powerUps)) {
            ctx.fillStyle = key === 'speed' ? '#4AF' : '#F88';
            ctx.font = '11px monospace';
            ctx.fillText(`${key === 'speed' ? '⚡ Tempo' : '💪 Stärke'}: ${Math.ceil(pu.timer)}s`, 12, puY);
            puY += 16;
        }

        // ── Weapon indicator ──
        ctx.fillStyle = '#CCC';
        ctx.font = '11px monospace';
        ctx.fillText(player.activeWeapon.name, 12, ctx.canvas.height - 12);
        if (player.rangedWeapon) {
            ctx.fillStyle = '#888';
            ctx.fillText('[Q] Waffe wechseln', 12, ctx.canvas.height - 26);
        }

        // ── Mobile controls overlay ──
        if (Input.isMobile) {
            this._drawMobileControls(ctx);
        }

        // ── Boss intro ──
        if (game.state === 'BOSS_INTRO') {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, ctx.canvas.height / 2 - 30, ctx.canvas.width, 60);
            ctx.fillStyle = '#0F0';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('👻 RIESEN-GEIST 👻', ctx.canvas.width / 2, ctx.canvas.height / 2 + 8);
            ctx.textAlign = 'left';
        }

        ctx.restore();
    },

    _drawHeartIcon(ctx, x, y, size, fill, stroke) {
        const s = size / 2;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.2);
        ctx.bezierCurveTo(x, y - s * 0.5, x - s, y - s * 0.5, x - s, y + s * 0.05);
        ctx.bezierCurveTo(x - s, y + s * 0.5, x, y + s * 0.9, x, y + s);
        ctx.bezierCurveTo(x, y + s * 0.9, x + s, y + s * 0.5, x + s, y + s * 0.05);
        ctx.bezierCurveTo(x + s, y - s * 0.5, x, y - s * 0.5, x, y + s * 0.2);
        ctx.closePath();
        if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    },

    _drawMobileControls(ctx) {
        // Left joystick area hint
        if (!Input.joystick.active) {
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(100, ctx.canvas.height - 100, 50, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#FFF';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Bewegen', 100, ctx.canvas.height - 50);
            ctx.restore();
        } else {
            // Active joystick
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(Input.joystick.baseX, Input.joystick.baseY, 50, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#FFF';
            ctx.globalAlpha = 0.4;
            const stickDx = Input.joystick.stickX - Input.joystick.baseX;
            const stickDy = Input.joystick.stickY - Input.joystick.baseY;
            const stickDist = Math.min(50, Math.sqrt(stickDx * stickDx + stickDy * stickDy));
            const stickAngle = Math.atan2(stickDy, stickDx);
            ctx.beginPath();
            ctx.arc(
                Input.joystick.baseX + Math.cos(stickAngle) * stickDist,
                Input.joystick.baseY + Math.sin(stickAngle) * stickDist,
                18, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
        }

        // Right attack button
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#F44';
        ctx.beginPath();
        ctx.arc(ctx.canvas.width - 80, ctx.canvas.height - 100, 35, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#FFF';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Angriff', ctx.canvas.width - 80, ctx.canvas.height - 56);
        ctx.restore();
    },

    drawTitleScreen(ctx) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.save();
        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#4A9';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('Mark und die', ctx.canvas.width / 2, ctx.canvas.height / 2 - 60);
        ctx.fillStyle = '#F88';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('geklauten Erfindungen', ctx.canvas.width / 2, ctx.canvas.height / 2 - 25);

        // Subtitle
        ctx.fillStyle = '#888';
        ctx.font = '14px monospace';
        ctx.fillText('Welt 1: Das bunte Geisterschloss', ctx.canvas.width / 2, ctx.canvas.height / 2 + 15);

        // Start prompt
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) {
            ctx.fillStyle = '#FFF';
            ctx.font = '16px monospace';
            const text = Input.isMobile ? 'Tippen zum Starten' : 'Enter drücken zum Starten';
            ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2 + 60);
        }

        // Controls
        ctx.fillStyle = '#555';
        ctx.font = '11px monospace';
        if (!Input.isMobile) {
            ctx.fillText('WASD / Pfeiltasten = Bewegen', ctx.canvas.width / 2, ctx.canvas.height / 2 + 100);
            ctx.fillText('Mausklick = Angriff | Leertaste = Ausweichen', ctx.canvas.width / 2, ctx.canvas.height / 2 + 118);
        } else {
            ctx.fillText('Links = Bewegen | Rechts = Angriff', ctx.canvas.width / 2, ctx.canvas.height / 2 + 100);
            ctx.fillText('Joystick lang halten = Ausweichen', ctx.canvas.width / 2, ctx.canvas.height / 2 + 118);
        }

        ctx.restore();
    },

    drawGameOver(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#F44';
        ctx.font = 'bold 32px monospace';
        ctx.fillText('GAME OVER', ctx.canvas.width / 2, ctx.canvas.height / 2 - 10);
        ctx.fillStyle = '#FFF';
        ctx.font = '16px monospace';
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) {
            const text = Input.isMobile ? 'Tippen zum Neustarten' : 'Enter drücken zum Neustarten';
            ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2 + 30);
        }
        ctx.restore();
    },

    drawWinScreen(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('🏆 GEWONNEN! 🏆', ctx.canvas.width / 2, ctx.canvas.height / 2 - 30);
        ctx.fillStyle = '#FFF';
        ctx.font = '16px monospace';
        ctx.fillText('Du hast den Baseball-Werfer', ctx.canvas.width / 2, ctx.canvas.height / 2 + 10);
        ctx.fillText('zurückerobert!', ctx.canvas.width / 2, ctx.canvas.height / 2 + 30);
        ctx.fillStyle = '#4A9';
        ctx.font = '14px monospace';
        ctx.fillText('Welt 2 kommt bald...', ctx.canvas.width / 2, ctx.canvas.height / 2 + 65);
        ctx.restore();
    }
};
