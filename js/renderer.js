// ── Renderer / HUD ──

const Renderer = {
    drawHUD(ctx, player, game) {
        ctx.save();

        // ── Hearts (quarter-step with gray for lost quarters) ──
        const heartSize = 22;
        const heartSpacing = 28;
        const startX = 14;
        const startY = 16;
        const totalHearts = player.maxHp / 4;
        const fullHearts = Math.floor(player.hp / 4);
        const remainder = player.hp % 4;

        // Heart container background
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(4, 2, totalHearts * heartSpacing + 8, 30, 6);
        ctx.fill();

        for (let i = 0; i < totalHearts; i++) {
            const x = startX + i * heartSpacing;
            const y = startY;

            // Empty/gray heart background
            this._drawHeartIcon(ctx, x, y, heartSize, '#555');

            if (i < fullHearts) {
                // Full red heart with gradient
                this._drawHeartIcon(ctx, x, y, heartSize, '#F44', null, true);
            } else if (i === fullHearts && remainder > 0) {
                // Quarter-step damage: draw filled portion, gray rest
                // Draw each quarter as a vertical stripe
                const quarterW = heartSize / 4;
                for (let q = 0; q < 4; q++) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(x - heartSize / 2 + q * quarterW, y - heartSize / 2, quarterW, heartSize);
                    ctx.clip();
                    if (q < remainder) {
                        this._drawHeartIcon(ctx, x, y, heartSize, '#F44', null, true);
                    } else {
                        this._drawHeartIcon(ctx, x, y, heartSize, '#666');
                    }
                    ctx.restore();
                }
                // Divider lines for quarters (subtle)
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 0.5;
                for (let q = 1; q < 4; q++) {
                    ctx.beginPath();
                    ctx.moveTo(x - heartSize / 2 + q * quarterW, y - heartSize / 2 + 3);
                    ctx.lineTo(x - heartSize / 2 + q * quarterW, y + heartSize / 2 - 3);
                    ctx.stroke();
                }
            }
            // Outline
            this._drawHeartIcon(ctx, x, y, heartSize, null, '#D33');
            // Shine highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.ellipse(x - 2, y - 3, 4, 3, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── World indicator ──
        const worldNames = [null, 'Geisterschloss', 'Roboter-Fabrik', 'Schleim-Arena'];
        const worldColors = [null, '#A6F', '#F80', '#4D4'];
        ctx.fillStyle = worldColors[game.currentWorld];
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('Welt ' + game.currentWorld + ': ' + worldNames[game.currentWorld], ctx.canvas.width - 10, 14);
        ctx.textAlign = 'left';

        // ── Key indicator ──
        if (game.hasKey) {
            const kx = ctx.canvas.width - 40;
            const ky = 30;
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('\uD83D\uDD11', kx, ky);
            ctx.fillRect(kx + 2, ky - 2, 12, 4);
        }

        // ── Boss door hint ──
        if (game.hasKey && !game.world.bossDoorOpen) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Schl\u00fcssel gefunden! Finde die Boss-T\u00fcr!', ctx.canvas.width / 2, 20);
            ctx.textAlign = 'left';
        }

        // ── Auto ability indicator ──
        if (player.hasAuto) {
            const autoX = ctx.canvas.width - 120;
            const autoY = 45;
            if (player.autoActive) {
                ctx.fillStyle = '#0FF';
                ctx.font = 'bold 11px monospace';
                ctx.fillText('AUTO: ' + Math.ceil(player.autoTimer) + 's', autoX, autoY);
            } else if (player.autoReady) {
                ctx.fillStyle = '#0FF';
                ctx.font = '11px monospace';
                ctx.fillText('[E] Auto bereit!', autoX, autoY);
            } else {
                // Show charge progress
                ctx.fillStyle = '#666';
                ctx.font = '10px monospace';
                ctx.fillText('Auto: ' + player.autoCharges + '/' + player.autoChargesNeeded, autoX, autoY);
            }
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

    _drawHeartIcon(ctx, x, y, size, fill, stroke, useGradient) {
        const s = size / 2;
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.2);
        ctx.bezierCurveTo(x, y - s * 0.5, x - s, y - s * 0.5, x - s, y + s * 0.05);
        ctx.bezierCurveTo(x - s, y + s * 0.5, x, y + s * 0.9, x, y + s);
        ctx.bezierCurveTo(x, y + s * 0.9, x + s, y + s * 0.5, x + s, y + s * 0.05);
        ctx.bezierCurveTo(x + s, y - s * 0.5, x, y - s * 0.5, x, y + s * 0.2);
        ctx.closePath();
        if (fill) {
            if (useGradient) {
                const grad = ctx.createRadialGradient(x - 2, y - 2, 1, x, y + 2, s);
                grad.addColorStop(0, '#FF8888');
                grad.addColorStop(0.4, fill);
                grad.addColorStop(1, '#AA1111');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = fill;
            }
            ctx.fill();
        }
        if (stroke) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    },

    _drawMobileControls(ctx) {
        const joystickRadius = 50;
        const knobRadius = 20;

        // ── Left Joystick (Movement) ──
        this._drawJoystick(ctx, Input.joystick, 100, ctx.canvas.height - 100, joystickRadius, knobRadius, '#FFF', 'Bewegen');

        // ── Right Joystick (Aim & Attack) ──
        this._drawJoystick(ctx, Input.aimJoystick, ctx.canvas.width - 100, ctx.canvas.height - 100, joystickRadius, knobRadius, '#F66', 'Zielen & Hauen');
    },

    _drawJoystick(ctx, joystickState, defaultX, defaultY, radius, knobRadius, color, label) {
        if (!joystickState.active) {
            // Inactive hint
            ctx.save();
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(defaultX, defaultY, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#FFF';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(label, defaultX, defaultY + radius + 14);
            ctx.restore();
        } else {
            // Active: base circle
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(joystickState.baseX, joystickState.baseY, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Knob
            const dx = joystickState.stickX - joystickState.baseX;
            const dy = joystickState.stickY - joystickState.baseY;
            const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
            const angle = Math.atan2(dy, dx);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(
                joystickState.baseX + Math.cos(angle) * dist,
                joystickState.baseY + Math.sin(angle) * dist,
                knobRadius, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
        }
    },

    drawTitleScreen(ctx) {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;

        ctx.save();
        ctx.textAlign = 'center';

        // Title
        ctx.fillStyle = '#4A9';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('Mark und die', cx, cy - 80);
        ctx.fillStyle = '#F88';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('geklauten Erfindungen', cx, cy - 45);

        // World list
        const worlds = [
            { name: 'Welt 1: Das bunte Geisterschloss', icon: '\uD83D\uDC7B', color: '#A6F' },
            { name: 'Welt 2: Die Roboter-K\u00fcken', icon: '\uD83E\uDD16', color: '#F80' },
            { name: 'Welt 3: Die Schleim-Arena', icon: '\uD83D\uDFE2', color: '#4D4' },
        ];
        for (let i = 0; i < worlds.length; i++) {
            ctx.fillStyle = worlds[i].color;
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 600 + i) * 0.2;
            ctx.font = '12px monospace';
            ctx.fillText(worlds[i].icon + ' ' + worlds[i].name, cx, cy - 5 + i * 20);
        }
        ctx.globalAlpha = 1;

        // Start/Continue prompt
        const blink = Math.sin(Date.now() / 500) > 0;
        if (Game.currentWorld > 1) {
            ctx.fillStyle = '#4A9';
            ctx.font = '13px monospace';
            ctx.fillText('Gespeicherter Fortschritt: Welt ' + Game.currentWorld, cx, cy + 62);
        }
        if (blink) {
            ctx.fillStyle = '#FFF';
            ctx.font = '16px monospace';
            const label = Game.currentWorld > 1 ? 'Fortfahren' : 'Starten';
            ctx.fillText(Input.isMobile ? 'Tippen zum ' + label : 'Enter = ' + label, cx, cy + 82);
        }

        // Controls
        ctx.fillStyle = '#555';
        ctx.font = '11px monospace';
        if (!Input.isMobile) {
            ctx.fillText('WASD = Bewegen | Maus = Zielen & Angriff | Leertaste = Ausweichen | Q = Waffe wechseln', cx, cy + 115);
        } else {
            ctx.fillText('Links = Bewegen | Rechts = Zielen & Angreifen', cx, cy + 115);
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
        ctx.fillText('GAME OVER', ctx.canvas.width / 2, ctx.canvas.height / 2 - 20);
        ctx.fillStyle = '#AAA';
        ctx.font = '14px monospace';
        const worldNames = [null, 'Geisterschloss', 'Roboter-Fabrik', 'Schleim-Arena'];
        ctx.fillText('Welt ' + Game.currentWorld + ': ' + worldNames[Game.currentWorld], ctx.canvas.width / 2, ctx.canvas.height / 2 + 8);
        ctx.fillStyle = '#FFF';
        ctx.font = '16px monospace';
        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) {
            ctx.fillText(Input.isMobile ? 'Tippen zum Neustarten' : 'Enter = Neustarten', ctx.canvas.width / 2, ctx.canvas.height / 2 + 40);
        }
        ctx.restore();
    },

    drawWorldClearScreen(ctx, worldNum) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;

        ctx.save();
        ctx.textAlign = 'center';

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('WELT ' + worldNum + ' GESCHAFFT!', cx, cy - 40);

        // Reward
        ctx.fillStyle = '#FFF';
        ctx.font = '16px monospace';
        if (worldNum === 1) {
            ctx.fillText('Belohnung: Baseball-Werfer!', cx, cy + 5);
            ctx.fillStyle = '#AAA';
            ctx.font = '12px monospace';
            ctx.fillText('Du kannst jetzt Baseballs auf Gegner schie\u00dfen! [Q] zum Wechseln', cx, cy + 28);
        } else if (worldNum === 2) {
            ctx.fillText('Belohnung: Auto-F\u00e4higkeit!', cx, cy + 5);
            ctx.fillStyle = '#0FF';
            ctx.font = '12px monospace';
            ctx.fillText('[E] dr\u00fccken: 15 Sekunden durch W\u00e4nde fahren!', cx, cy + 28);
        }

        // Next world preview
        ctx.fillStyle = '#4A9';
        ctx.font = '14px monospace';
        const nextName = worldNum === 1 ? 'Weiter zu: Die Roboter-K\u00fcken' : 'Weiter zu: Die Schleim-Arena';
        ctx.fillText(nextName, cx, cy + 60);

        const blink = Math.sin(Date.now() / 400) > 0;
        if (blink) {
            ctx.fillStyle = '#FFF';
            ctx.font = '13px monospace';
            ctx.fillText(Input.isMobile ? 'Tippen zum Fortfahren' : 'Enter = Weiter', cx, cy + 90);
        }

        ctx.restore();
    },

    drawFinalWinScreen(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;

        ctx.save();
        ctx.textAlign = 'center';

        // Confetti-like particles
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 20; i++) {
            const t = Date.now() / 1000 + i * 0.5;
            const px = cx + Math.sin(t * 1.3 + i) * 200;
            const py = cy + Math.cos(t * 0.8 + i * 2) * 100;
            ctx.fillStyle = `hsl(${(i * 40 + Date.now() / 10) % 360}, 80%, 60%)`;
            ctx.fillRect(px - 3, py - 3, 6, 6);
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 32px monospace';
        ctx.fillText('ALLE 3 WELTEN GESCHAFFT!', cx, cy - 50);

        ctx.fillStyle = '#FFF';
        ctx.font = '16px monospace';
        ctx.fillText('Mark hat alle Erfindungen zur\u00fcckerobert!', cx, cy - 10);

        ctx.fillStyle = '#AAA';
        ctx.font = '13px monospace';
        ctx.fillText('Belohnung: Die goldene Schutzschild-Krone', cx, cy + 20);
        ctx.fillText('(5 Sekunden Unverwundbarkeit zu Beginn jedes Levels)', cx, cy + 38);

        ctx.fillStyle = '#888';
        ctx.font = '12px monospace';
        ctx.fillText('Welt 4 kommt bald...', cx, cy + 70);

        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) {
            ctx.fillStyle = '#FFF';
            ctx.font = '14px monospace';
            ctx.fillText(Input.isMobile ? 'Tippen f\u00fcr Hauptmen\u00fc' : 'Enter = Hauptmen\u00fc', cx, cy + 100);
        }

        ctx.restore();
    }
};
