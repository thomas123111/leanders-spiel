// ── Renderer / HUD ──

const Renderer = {
    drawHUD(ctx, player, game) {
        ctx.save();
        const mobile = Input.isMobile;

        // ── Hearts (quarter-step with gray for lost quarters) ──
        const heartSize = mobile ? 18 : 22;
        const heartSpacing = mobile ? 24 : 28;
        const startX = 14;
        const startY = mobile ? 14 : 16;
        const totalHearts = player.maxHp / 4;
        const fullHearts = Math.floor(player.hp / 4);
        const remainder = player.hp % 4;

        // Heart container background
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.roundRect(4, 5, totalHearts * heartSpacing + 6, mobile ? 20 : 22, 6);
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
        const worldNames = ['Trainingsplatz', 'Geisterschloss', 'Maschinen-Hof', 'Schleim-Arena', 'Schatten-Burg', 'Pilz-Wald', 'M\u00fccken-Sumpf', 'Antarktis', 'Vulkan-Insel', 'Schatten-Dim.', 'Obst-Paradies', 'Pixel-Welt', 'Sternen-Galaxie', 'Knochen-Tal', 'Gift-Sumpf', 'Steinwelt', 'Obst-Ninja', 'Dino-Welt'];
        const worldColors = ['#AAA', '#A6F', '#F80', '#4D4', '#C66', '#A84', '#8A4', '#8CF', '#F84', '#A0F', '#F80', '#48F', '#FA0', '#EEE', '#4F4', '#AAA', '#F88', '#9C6'];
        const worldIndex = Math.max(0, Math.min(worldNames.length - 1, game.currentWorld || 0));
        ctx.fillStyle = worldColors[worldIndex];
        ctx.font = mobile ? 'bold 10px monospace' : 'bold 11px monospace';
        ctx.textAlign = 'right';
        const worldLabel = game.currentWorld === 0 ? 'Training' : 'Welt ' + game.currentWorld;
        ctx.fillText(mobile ? worldLabel : (worldLabel + ': ' + worldNames[worldIndex]), ctx.canvas.width - 10, mobile ? 13 : 14);
        ctx.textAlign = 'left';

        // Coin counter
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(4, 34, mobile ? 88 : 96, mobile ? 24 : 28, 6);
        ctx.fill();
        this._drawCoinIcon(ctx, 18, mobile ? 46 : 48, mobile ? 10 : 11);
        ctx.fillStyle = '#FFF';
        ctx.font = mobile ? 'bold 12px monospace' : 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(String(game.coins || 0), 32, mobile ? 50 : 52);

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(4, mobile ? 62 : 66, mobile ? 88 : 96, mobile ? 24 : 28, 6);
        ctx.fill();
        this._drawJewelIcon(ctx, 18, mobile ? 74 : 78, mobile ? 9 : 10);
        ctx.fillStyle = '#FFF';
        ctx.font = mobile ? 'bold 12px monospace' : 'bold 14px monospace';
        ctx.fillText(String(game.jewels || 0), 32, mobile ? 78 : 82);

        if (game.currentWorld === 0) {
            this._drawButton(ctx, ctx.canvas.width - (mobile ? 104 : 118), 34, mobile ? 96 : 110, 24, 'STARTSEITE', mobile ? 10 : 11);
        }

        // ── Key indicator ──
        if (game.hasKey) {
            const kx = ctx.canvas.width - (mobile ? 28 : 40);
            const ky = mobile ? 28 : 30;
            ctx.fillStyle = '#FFD700';
            ctx.font = mobile ? 'bold 12px monospace' : 'bold 14px monospace';
            ctx.fillText('\uD83D\uDD11', kx, ky);
            ctx.fillRect(kx + 2, ky - 2, 12, 4);
        }

        // ── Boss door hint + arrow ──
        if (game.hasKey && !game.bossActive) {
            ctx.fillStyle = '#FFD700';
            ctx.font = mobile ? '10px monospace' : '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(mobile ? 'Schl\u00fcssel gefunden! Boss-T\u00fcr suchen!' : 'Schl\u00fcssel gefunden! Finde die Boss-T\u00fcr!', ctx.canvas.width / 2, mobile ? 19 : 20);
            ctx.textAlign = 'left';

            // Arrow pointing to boss door
            if (game.world.bossDoorTiles.length > 0) {
                const door = game.world.bossDoorTiles[0];
                const doorWX = door.x * 32 + 16;
                const doorWY = door.y * 32 + 16;
                const px = player.x + player.w / 2;
                const py = player.y + player.h / 2;
                const angle = Math.atan2(doorWY - py, doorWX - px);
                const dist = Math.sqrt((doorWX - px) ** 2 + (doorWY - py) ** 2);

                if (dist > 100) {
                    const arrowDist = 70;
                    const ax = ctx.canvas.width / 2 + Math.cos(angle) * arrowDist;
                    const ay = ctx.canvas.height / 2 + Math.sin(angle) * arrowDist;
                    ctx.save();
                    ctx.translate(ax, ay);
                    ctx.rotate(angle);
                    // Glow
                    ctx.globalAlpha = 0.2;
                    ctx.fillStyle = '#FFD700';
                    ctx.beginPath();
                    ctx.arc(0, 0, 18, 0, Math.PI * 2);
                    ctx.fill();
                    // Arrow
                    ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 200) * 0.25;
                    ctx.fillStyle = '#FFD700';
                    ctx.beginPath();
                    ctx.moveTo(18, 0);
                    ctx.lineTo(-6, -10);
                    ctx.lineTo(-2, 0);
                    ctx.lineTo(-6, 10);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }
            }
        }

        // ── Auto ability indicator ──
        if (player.hasAuto) {
            const autoX = ctx.canvas.width - (mobile ? 110 : 120);
            const autoY = mobile ? 42 : 45;
            if (player.autoActive) {
                ctx.fillStyle = '#0FF';
                ctx.font = mobile ? 'bold 10px monospace' : 'bold 11px monospace';
                ctx.fillText('AUTO: ' + Math.ceil(player.autoTimer) + 's', autoX, autoY);
            } else if (player.autoReady) {
                ctx.fillStyle = '#0FF';
                ctx.font = mobile ? '10px monospace' : '11px monospace';
                ctx.fillText('[E] Auto bereit!', autoX, autoY);
            } else {
                // Show charge progress
                ctx.fillStyle = '#666';
                ctx.font = mobile ? '9px monospace' : '10px monospace';
                ctx.fillText('Auto: ' + player.autoCharges + '/' + player.autoChargesNeeded, autoX, autoY);
            }
        }

        // ── Power-ups ──
        let puY = mobile ? 60 : 40;
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

        // ── Boss intro with unique names ──
        if (game.state === 'BOSS_INTRO') {
            const bossNames = {
                1: { name: 'K\u00d6NIG GEIST', color: '#A6F' },
                2: { name: 'RIESEN K\u00dcKEN', color: '#F80' },
                3: { name: 'K\u00d6NIG SCHLEIM', color: '#4D4' },
                4: { name: 'SCHATTEN FLEDERMAUS', color: '#C66' },
                5: { name: 'RIESEN PILZ', color: '#A84' },
                6: { name: 'RIESEN M\u00dcCKE', color: '#8A4' },
                7: { name: 'SCHNEE ADLER', color: '#8CF' },
                8: { name: 'FEUER PH\u00d6NIX', color: '#F84' },
                9: { name: 'SCHATTEN-MEISTER', color: '#A0F' },
                10: { name: 'OBST-K\u00d6NIG', color: '#F80' },
                11: { name: 'PIXEL-ROBOTER', color: '#48F' },
                12: { name: 'STERNEN-RITTER', color: '#FA0' },
                13: { name: 'KNOCHEN-REITER', color: '#EEE' },
                14: { name: 'HYDRA', color: '#4F4' },
                15: { name: 'STEIN-D\u00c4MON', color: '#AAA' },
                16: { name: 'FRUCHT-GIGANT', color: '#F88' },
                17: { name: 'STACHEL-T-REX', color: '#9C6' },
            };
            const boss = bossNames[game.currentWorld] || { name: 'BOSS', color: '#F00' };
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, ctx.canvas.height / 2 - 40, ctx.canvas.width, 80);
            // Boss name with glow
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = boss.color;
            ctx.font = 'bold 36px monospace';
            ctx.fillText(boss.name, ctx.canvas.width / 2 + 2, ctx.canvas.height / 2 + 12);
            ctx.globalAlpha = 1;
            ctx.fillStyle = boss.color;
            ctx.font = 'bold 32px monospace';
            ctx.fillText(boss.name, ctx.canvas.width / 2, ctx.canvas.height / 2 + 10);
            ctx.fillStyle = '#FFF';
            ctx.font = '14px monospace';
            ctx.fillText('Mach dich bereit!', ctx.canvas.width / 2, ctx.canvas.height / 2 + 30);
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

    _drawCoinIcon(ctx, x, y, size) {
        const s = size || 10;
        ctx.save();
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFEFA0';
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, s * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#B8960F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    },

    _drawJewelIcon(ctx, x, y, size) {
        const s = size || 10;
        ctx.save();
        ctx.fillStyle = '#4FD6FF';
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#D8FBFF';
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.7);
        ctx.lineTo(x + s * 0.35, y - s * 0.1);
        ctx.lineTo(x, y + s * 0.15);
        ctx.lineTo(x - s * 0.35, y - s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1A7A99';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - s * 0.9, y - s * 0.9, s * 1.8, s * 1.8);
        ctx.restore();
    },

    _drawStarFace(ctx, x, y, size, color) {
        const s = size || 10;
        ctx.save();
        ctx.fillStyle = color || '#FFD700';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
            const outerX = x + Math.cos(a) * s;
            const outerY = y + Math.sin(a) * s;
            const innerA = a + Math.PI / 5;
            const innerX = x + Math.cos(innerA) * (s * 0.45);
            const innerY = y + Math.sin(innerA) * (s * 0.45);
            if (i === 0) ctx.moveTo(outerX, outerY);
            else ctx.lineTo(outerX, outerY);
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(x - s * 0.25, y - s * 0.15, Math.max(1.5, s * 0.12), 0, Math.PI * 2);
        ctx.arc(x + s * 0.25, y - s * 0.15, Math.max(1.5, s * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y + s * 0.25, Math.max(1.5, s * 0.11), 0, Math.PI, false);
        ctx.fill();
        ctx.restore();
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

    _buttons: [],

    _drawButton(ctx, x, y, w, h, text, fontSize) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, w - 6, h / 2 - 3, 8);
        ctx.fill();
        ctx.strokeStyle = '#B8960F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
        ctx.stroke();
        const fs = fontSize || 18;
        ctx.fillStyle = '#000';
        ctx.font = 'bold ' + fs + 'px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, x + w / 2, y + h / 2 + Math.floor(fs / 3));
        this._buttons.push({ x, y, w, h, id: text });
    },

    getClickedButton(mx, my) {
        for (const b of this._buttons) {
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.id;
        }
        return null;
    },

    _drawMarkCharacter(ctx, x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 50, 20, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Legs
        ctx.fillStyle = '#3366AA';
        ctx.fillRect(-10, 20, 7, 14);
        ctx.fillRect(3, 20, 7, 14);
        ctx.fillStyle = '#553322';
        ctx.fillRect(-12, 32, 10, 5);
        ctx.fillRect(2, 32, 10, 5);
        // Body (blue shirt)
        ctx.fillStyle = '#4499AA';
        ctx.beginPath();
        ctx.roundRect(-14, -5, 28, 26, 5);
        ctx.fill();
        // Arms
        ctx.strokeStyle = '#FFBB77';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-14, 2);
        ctx.lineTo(-24, -12 + Math.sin(Date.now() / 300) * 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, 2);
        ctx.lineTo(24, 10);
        ctx.stroke();
        // Bat in right hand
        ctx.strokeStyle = '#C8A060';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(24, 10);
        ctx.lineTo(34, -10);
        ctx.stroke();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(24, 10);
        ctx.lineTo(26, 3);
        ctx.stroke();
        // Head
        ctx.fillStyle = '#FFCC88';
        ctx.beginPath();
        ctx.arc(0, -16, 14, 0, Math.PI * 2);
        ctx.fill();
        // Hair (short brown, visible below cap)
        ctx.fillStyle = '#663300';
        ctx.fillRect(-13, -12, 4, 6);
        ctx.fillRect(9, -12, 4, 6);
        // Red Baseball Cap
        ctx.fillStyle = '#DD2222';
        ctx.beginPath();
        ctx.arc(0, -20, 15, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-15, -21, 30, 5);
        // Brim (forward)
        ctx.fillStyle = '#BB1111';
        ctx.beginPath();
        ctx.ellipse(12, -18, 10, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Cap button
        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.arc(0, -25, 3, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(-5, -15, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -15, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#332211';
        ctx.beginPath(); ctx.arc(-4, -14, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6, -14, 2, 0, Math.PI * 2); ctx.fill();
        // Smile
        ctx.strokeStyle = '#884422';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -10, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.restore();
    },

    drawTitleScreen(ctx, game) {
        this._buttons = [];
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const mobile = Input.isMobile;

        const bg = ctx.createLinearGradient(0, 0, cw, ch);
        bg.addColorStop(0, '#090b14');
        bg.addColorStop(0.52, '#11172a');
        bg.addColorStop(1, '#08131f');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);

        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(12, 60, cw * 0.42, ch - 78, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        ctx.roundRect(cw * 0.54, 60, cw * 0.42, ch - 78, 18);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#4A9';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('Mark und die', cw - 12, 22);
        ctx.fillStyle = '#F88';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('geklauten Erfindungen', cw - 12, 40);

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MARK', cw * 0.15, 86);

        ctx.textAlign = 'left';
        this._drawCoinIcon(ctx, 22, 24, mobile ? 9 : 10);
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(String(game.coins || 0), 34, 28);
        this._drawJewelIcon(ctx, 68, 24, mobile ? 8 : 9);
        ctx.fillStyle = '#7FE7FF';
        ctx.fillText(String(game.jewels || 0), 80, 28);

        if (!this._markAngle) this._markAngle = 0;
        if (Input.mouse.down && Input.mouse.x < cw * 0.3) this._markAngle += 0.08;
        else if (Input.joystick.active && Input.joystick.baseX < cw * 0.3) this._markAngle += 0.08;
        else this._markAngle += 0.005;

        const flipX = Math.cos(this._markAngle);
        const markX = cw * 0.16;
        const markY = ch * 0.37;
        ctx.save();
        ctx.translate(markX, markY);
        ctx.scale(flipX < 0 ? -2.2 : 2.2, 2.2);
        this._drawMarkCharacter(ctx, 0, 0, 1);
        ctx.restore();
        ctx.fillStyle = '#8AA';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('? drehen', markX, ch * 0.58);

        ctx.fillStyle = '#B7C0D0';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        const bioLines = [
            'Mark ist ein',
            'Baseballspieler und',
            'Geisterj?ger. Seit er',
            'bestohlen wurde, hat',
            'er sich verwandelt...',
            'Findet es selbst heraus!'
        ];
        const bioX = cw * 0.23;
        for (let i = 0; i < bioLines.length; i++) {
            ctx.fillText(bioLines[i], bioX, ch * 0.23 + i * 15);
        }

        const tx = cw * 0.75;
        const btnW = mobile ? Math.min(220, cw * 0.36) : 180;
        const btnH = mobile ? 42 : 36;
        const startY = mobile ? ch * 0.32 : ch * 0.34;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#DDD';
        ctx.font = mobile ? 'bold 14px monospace' : 'bold 15px monospace';
        ctx.fillText('W?hle einen Startpunkt', tx, startY - 30);
        this._drawButton(ctx, tx - btnW / 2, startY, btnW, btnH, 'SHOP', mobile ? 15 : 16);
        this._drawButton(ctx, tx - btnW / 2, startY + (mobile ? 48 : 40), btnW, btnH, 'TRAININGSPLATZ', mobile ? 11 : 13);
        this._drawButton(ctx, tx - btnW / 2, startY + (mobile ? 96 : 80), btnW, btnH, 'EXTRA', mobile ? 15 : 16);
        this._drawButton(ctx, tx - btnW / 2, startY + (mobile ? 144 : 120), btnW, btnH, 'VOLLBILD', mobile ? 15 : 16);
        this._drawButton(ctx, tx - btnW / 2, startY + (mobile ? 192 : 160), btnW, btnH, 'PLAY', mobile ? 15 : 16);

        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        const infoY = mobile ? startY + 242 : startY + 210;
        ctx.fillText('PLAY ?ffnet die Weltauswahl', tx, infoY);
        ctx.fillText('EXTRA f?hrt zu den Spezial-Modi', tx, infoY + 16);
        ctx.fillText('VOLLBILD blendet die Browserleiste aus', tx, infoY + 32);
        ctx.fillText('SHOP enth?lt Sterne, Krone und Daily Reward', tx, infoY + 48);

        ctx.fillStyle = '#555';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        if (!Input.isMobile) {
            ctx.fillText('WASD = Bewegen | Maus = Zielen | Leertaste = Ausweichen | Q = Waffe', cw / 2, ch * 0.92);
        } else {
            ctx.fillText('Links = Bewegen | Rechts = Zielen & Angreifen', cw / 2, ch * 0.92);
        }

        ctx.fillStyle = '#444';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('v8.2.1', cw - 8, ch - 6);

        ctx.restore();
    },

    drawShopScreen(ctx, game) {
        this._buttons = [];
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const mobile = Input.isMobile;

        const bg = ctx.createLinearGradient(0, 0, cw, ch);
        bg.addColorStop(0, '#130f1f');
        bg.addColorStop(0.5, '#20142d');
        bg.addColorStop(1, '#0d171d');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);

        ctx.save();
        ctx.textAlign = 'left';

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('SHOP', 16, 28);
        ctx.fillStyle = '#AAA';
        ctx.font = '11px monospace';
        ctx.fillText('M\u00fcnzen: ' + (game.coins || 0), 16, 46);

        if (mobile) {
            const pad = 12;

            // Daily reward card
            const dailyY = 64;
            const dailyH = 68;
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.roundRect(pad, dailyY, cw - pad * 2, dailyH, 12);
            ctx.fill();
            ctx.strokeStyle = '#5C4D7A';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 13px monospace';
            ctx.fillText('Daily Reward', pad + 12, dailyY + 22);
            ctx.font = '10px monospace';
            const today = game._todayKey ? game._todayKey() : '';
            const claimed = game.dailyRewardClaimDate === today;
            ctx.fillStyle = claimed ? '#999' : '#DDD';
            ctx.fillText(claimed ? 'Heute schon geholt.' : 'Erster Klick gratis.', pad + 12, dailyY + 40);
            if (game.freeStarTier) {
                ctx.fillStyle = '#FFD700';
                ctx.fillText('Freier Stern: ' + game.freeStarTier.toUpperCase(), pad + 12, dailyY + 56);
            }
            this._drawButton(ctx, cw - 118, dailyY + 18, 104, 28, 'DAILY', 12);

            // Star market as 2x2 grid
            const marketY = 142;
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 13px monospace';
            ctx.fillText('Sternen-Markt', pad, marketY);

            const gap = 8;
            const colW = Math.floor((cw - pad * 2 - gap) / 2);
            const rowH = 68;
            const tiers = [
                { id: 'GREEN', key: 'green', name: 'Scharf', color: '#4D4', price: 50, x: pad, y: marketY + 16, desc: 'kleiner Bonus' },
                { id: 'YELLOW', key: 'yellow', name: 'Super Scharf', color: '#FD0', price: 150, x: pad + colW + gap, y: marketY + 16, desc: 'solider Bonus' },
                { id: 'ORANGE', key: 'orange', name: 'Mega Scharf', color: '#F80', price: 200, x: pad, y: marketY + 16 + rowH + 8, desc: 'starker Bonus' },
                { id: 'RED', key: 'red', name: 'Ultra Scharf', color: '#F44', price: 350, x: pad + colW + gap, y: marketY + 16 + rowH + 8, desc: 'maximaler Bonus' }
            ];
            for (const tier of tiers) {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.beginPath();
                ctx.roundRect(tier.x, tier.y, colW, rowH, 10);
                ctx.fill();
                ctx.strokeStyle = tier.color;
                ctx.lineWidth = 2;
                ctx.stroke();
                this._drawStarFace(ctx, tier.x + 16, tier.y + 18, 10, tier.color);
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 11px monospace';
                ctx.fillText(tier.name, tier.x + 30, tier.y + 16);
                ctx.fillStyle = '#AAA';
                ctx.font = '8px monospace';
                ctx.fillText(tier.desc, tier.x + 30, tier.y + 30);
                ctx.textAlign = 'right';
                ctx.fillStyle = game.freeStarTier === tier.key ? '#FFD700' : '#DDD';
                ctx.fillText(game.freeStarTier === tier.key ? 'FREE' : tier.price + ' M', tier.x + colW - 10, tier.y + 16);
                ctx.textAlign = 'left';
                this._drawButton(ctx, tier.x + 8, tier.y + 40, colW - 16, 20, tier.id, 9);
            }

            // Random star
            const rsY = 300;
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 13px monospace';
            ctx.fillText('Zufalls-Stern', pad, rsY);
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(pad, rsY + 18, cw - pad * 2, 58, 12);
            ctx.fill();
            ctx.strokeStyle = '#7AA';
            ctx.lineWidth = 2;
            ctx.stroke();
            const randomColors = ['#4D4', '#FD0', '#F80', '#F44'];
            const currentColor = randomColors[Math.min(game.shopRandomStarTier || 0, 3)];
            this._drawStarFace(ctx, pad + 18, rsY + 46, 13, currentColor);
            ctx.fillStyle = '#FFF';
            ctx.font = '11px monospace';
            ctx.fillText('Stufe: ' + ['Scharf', 'Super Scharf', 'Mega Scharf', 'Ultra Scharf'][Math.min(game.shopRandomStarTier || 0, 3)], pad + 36, rsY + 38);
            ctx.fillStyle = '#AAA';
            ctx.font = '9px monospace';
            ctx.fillText('5 Klicks bis Jackpot', pad + 36, rsY + 50);
            ctx.fillText('Versuche: ' + (game.shopRandomStarAttempts || 0), pad + 36, rsY + 62);
            this._drawButton(ctx, cw - 118, rsY + 26, 104, 26, 'BÖSE STERNE', 10);

            // Special item
            const crownY = 370;
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 13px monospace';
            ctx.fillText('Spezial-Item', pad, crownY);
            ctx.fillStyle = 'rgba(255,215,0,0.08)';
            ctx.beginPath();
            ctx.roundRect(pad, crownY + 18, cw - pad * 2, 50, 12);
            ctx.fill();
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('Goldene Krone', pad + 12, crownY + 35);
            ctx.fillStyle = '#DDD';
            ctx.font = '9px monospace';
            ctx.fillText('500 M: 15s Schild', pad + 12, crownY + 48);
            this._drawButton(ctx, cw - 118, crownY + 20, 104, 24, 'CROWN_ITEM', 10);

            this._drawButton(ctx, cw - 104, ch - 34, 92, 24, 'BACK', 10);

            ctx.restore();
            return;
        }

        // Daily reward card
        const cardX = 16;
        const cardY = 64;
        const cardW = cw - 32;
        const cardH = 82;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 12);
        ctx.fill();
        ctx.strokeStyle = '#5C4D7A';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('Daily Reward', cardX + 16, cardY + 24);
        ctx.font = '11px monospace';
        const today = game._todayKey ? game._todayKey() : '';
        const claimed = game.dailyRewardClaimDate === today;
        ctx.fillStyle = claimed ? '#999' : '#DDD';
        ctx.fillText(claimed ? 'Heute schon geholt. Klick nochmal f\u00fcr 5000 M\u00fcnzen.' : 'Erster Klick heute gratis.', cardX + 16, cardY + 42);
        if (game.freeStarTier) {
            ctx.fillStyle = '#FFD700';
            ctx.fillText('Freier Stern: ' + game.freeStarTier.toUpperCase(), cardX + 16, cardY + 60);
        }
        this._drawButton(ctx, cardX + cardW - 140, cardY + 20, 120, 36, 'DAILY', 14);

        // Star market
        const marketY = 160;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('Sternen-Markt', 16, marketY);

        const tiers = [
            { id: 'STAR_GREEN', key: 'green', name: 'Scharf', color: '#4D4', price: 50, y: marketY + 20, desc: 'kleiner Bonus' },
            { id: 'STAR_YELLOW', key: 'yellow', name: 'Super Scharf', color: '#FD0', price: 150, y: marketY + 62, desc: 'solider Bonus' },
            { id: 'STAR_ORANGE', key: 'orange', name: 'Mega Scharf', color: '#F80', price: 200, y: marketY + 104, desc: 'starker Bonus' },
            { id: 'STAR_RED', key: 'red', name: 'Ultra Scharf', color: '#F44', price: 350, y: marketY + 146, desc: 'maximaler Bonus' }
        ];
        for (const tier of tiers) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(16, tier.y, cw - 32, 34, 10);
            ctx.fill();
            ctx.strokeStyle = tier.color;
            ctx.lineWidth = 2;
            ctx.stroke();
            this._drawStarFace(ctx, 34, tier.y + 17, 11, tier.color);
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(tier.name, 58, tier.y + 16);
            ctx.fillStyle = '#AAA';
            ctx.font = '10px monospace';
            ctx.fillText(tier.desc, 58, tier.y + 29);
            ctx.textAlign = 'right';
            ctx.fillStyle = game.freeStarTier === tier.key ? '#FFD700' : '#DDD';
            ctx.fillText(game.freeStarTier === tier.key ? 'FREE' : tier.price + ' M', cw - 110, tier.y + 20);
            ctx.textAlign = 'left';
            this._drawButton(ctx, cw - 96, tier.y + 4, 80, 26, tier.id.replace('STAR_', ''), 11);
        }

        // Random star
        const rsY = 340;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('Zufalls-Stern', 16, rsY);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(16, rsY + 20, cw - 32, 54, 12);
        ctx.fill();
        ctx.strokeStyle = '#7AA';
        ctx.lineWidth = 2;
        ctx.stroke();
        const randomColors = ['#4D4', '#FD0', '#F80', '#F44'];
        const currentColor = randomColors[Math.min(game.shopRandomStarTier || 0, 3)];
        this._drawStarFace(ctx, 34, rsY + 46, 14, currentColor);
        ctx.fillStyle = '#FFF';
        ctx.font = '12px monospace';
        ctx.fillText('Stufe: ' + ['Scharf', 'Super Scharf', 'Mega Scharf', 'Ultra Scharf'][Math.min(game.shopRandomStarTier || 0, 3)], 58, rsY + 40);
        ctx.fillStyle = '#AAA';
        ctx.font = '10px monospace';
        ctx.fillText('5 Klicks, um die Farbe per Zufall zu steigern', 58, rsY + 54);
        ctx.fillText('Versuche: ' + (game.shopRandomStarAttempts || 0), 58, rsY + 67);
            this._drawButton(ctx, cw - 152, rsY + 28, 120, 28, 'BÖSE STERNE', 11);

        // Special item
        const crownY = 410;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('Spezial-Item', 16, crownY);
        ctx.fillStyle = 'rgba(255,215,0,0.08)';
        ctx.beginPath();
        ctx.roundRect(16, crownY + 18, cw - 32, 48, 12);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('Goldene Krone', 58, crownY + 36);
        ctx.fillStyle = '#DDD';
        ctx.font = '10px monospace';
        ctx.fillText('500 M: Startet jedes Level mit 15 Sekunden Schutzschild', 58, crownY + 50);
        this._drawButton(ctx, cw - 152, crownY + 28, 120, 26, 'CROWN_ITEM', 11);

        this._drawButton(ctx, cw - 126, ch - 38, 110, 24, 'BACK', 11);

        ctx.restore();
    },

    drawGameOver(ctx) {
        this._buttons = [];
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;
        ctx.save();
        ctx.textAlign = 'center';

        // GAME OVER
        ctx.fillStyle = '#F44';
        ctx.font = 'bold 36px monospace';
        ctx.fillText('GAME OVER', cx, cy - 55);

        // Encouraging text
        ctx.fillStyle = '#CCC';
        ctx.font = '16px monospace';
        ctx.fillText('Nicht so schlimm.', cx, cy - 18);
        ctx.fillText('Probiere es gleich noch mal aus!', cx, cy + 6);

        // Two yellow buttons
        const btnW = 180;
        const btnH = 45;
        const gap = 20;
        const startX = cx - (btnW * 2 + gap) / 2;
        const btnY = cy + 35;
        this._drawButton(ctx, startX, btnY, btnW, btnH, 'NOCHMAL');
        this._drawButton(ctx, startX + btnW + gap, btnY, btnW, btnH, 'STARTSEITE');

        ctx.restore();
    },

    drawWorldClearScreen(ctx, worldNum) {
        this._buttons = [];
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;

        ctx.save();
        ctx.textAlign = 'center';

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('WELT ' + worldNum + ' GESCHAFFT!', cx, cy - 60);

        // Reward box
        ctx.fillStyle = 'rgba(255,215,0,0.1)';
        ctx.beginPath();
        ctx.roundRect(cx - 180, cy - 40, 360, 70, 10);
        ctx.fill();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx - 180, cy - 40, 360, 70, 10);
        ctx.stroke();

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 18px monospace';
        const rewards = {
            1: { title: 'K\u00d6NIG GEIST besiegt!', desc: 'Weiter zum Maschinen-Hof!', color: '#A6F' },
            2: { title: 'BASEBALL-WERFER erhalten!', desc: '3-fach Gift-B\u00e4lle! Fernkampf freigeschaltet!', color: '#4F4' },
            3: { title: 'AUTO-F\u00c4HIGKEIT erhalten!', desc: '[E] dr\u00fccken: 15 Sekunden durch W\u00e4nde fahren!', color: '#0FF' },
            4: { title: 'GOLDENE KRONE erhalten!', desc: '15 Sekunden Schutzschild zu Beginn jedes Levels!', color: '#FFD700' },
            5: { title: 'RIESEN PILZ besiegt!', desc: 'Der M\u00fccken-Sumpf wartet...', color: '#A84' },
            6: { title: 'RIESEN M\u00dcCKE besiegt!', desc: 'Ab in die Antarktis! Juri schlie\u00dft sich an!', color: '#8A4' },
            7: { title: 'SCHNEE ADLER besiegt!', desc: 'Das Schatten-Krokodil k\u00e4mpft jetzt f\u00fcr euch!', color: '#8CF' },
            8: { title: 'FEUER PH\u00d6NIX besiegt!', desc: 'Weiter in die Schatten-Dimension!', color: '#F84' },
            9: { title: 'SCHATTENWERFER erhalten!', desc: 'Bunte Energie-Sch\u00fcsse! Mehr Schaden!', color: '#A0F' },
            10: { title: 'OBST-UPGRADES erhalten!', desc: 'Orangen-Explosion + Melonen-H\u00e4mmer + Fruchtfleisch-Patrone!', color: '#F80' },
            11: { title: 'GAMER-PISTOLE erhalten!', desc: 'Blaue Pixel-Strahlen! Maximaler Schaden!', color: '#48F' },
            12: { title: 'STERNEN-RITTER besiegt!', desc: 'Weiter ins Knochen-Tal!', color: '#FA0' },
            13: { title: 'KNOCHEN-UPGRADE erhalten!', desc: 'Der Schl\u00e4ger feuert Knochen-Projektile!', color: '#EEE' },
            14: { title: 'SCHLANGE erhalten!', desc: 'Die kleine Schlange sitzt auf Marks Schulter und spuckt Gift!', color: '#4F4' },
            15: { title: 'STEIN DES SHOGUNS!', desc: 'Die Schlange leuchtet violett - Versteinerungs-Gift!', color: '#A0F' },
            16: { title: 'FRUCHT-GIGANT besiegt!', desc: '1000 Münzen beim ersten Sieg!', color: '#F88' },
            17: { title: 'STACHEL-T-REX besiegt!', desc: '50 Juwelen beim ersten Sieg!', color: '#9C6' },
            18: { title: 'ZEITKUGEL besiegt!', desc: '1 Böser Stern beim ersten Sieg!', color: '#7EF' },
            19: { title: 'SCHATTEN-KROKODIL besiegt!', desc: '1 Schatten-Meister-Stern beim ersten Sieg!', color: '#8F8' },
            20: { title: 'FUSSBALL geknackt!', desc: '3 Böse Sterne beim ersten Sieg!', color: '#FA0' },
            21: { title: 'WASCHBAER besiegt!', desc: '500 Muenzen beim ersten Sieg!', color: '#BBB' },
        };
        const r = rewards[worldNum];
        if (r) {
            ctx.fillStyle = r.color;
            ctx.fillText(r.title, cx, cy - 12);
            ctx.fillStyle = '#AAA';
            ctx.font = '13px monospace';
            ctx.fillText(r.desc, cx, cy + 12);
        }

        // Two buttons: WEITER + STARTSEITE
        const btnW = 180;
        const btnH = 45;
        const gap = 20;
        const startX = cx - (btnW * 2 + gap) / 2;
        const btnY = cy + 50;
        this._drawButton(ctx, startX, btnY, btnW, btnH, 'WEITER');
        this._drawButton(ctx, startX + btnW + gap, btnY, btnW, btnH, 'STARTSEITE');

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
        ctx.fillText('ALLE 21 WELTEN GESCHAFFT!', cx, cy - 50);

        ctx.fillStyle = '#FFF';
        ctx.font = '16px monospace';
        ctx.fillText('Mark hat alle Erfindungen zur\u00fcckerobert!', cx, cy - 10);

        ctx.fillStyle = '#AAA';
        ctx.font = '13px monospace';
        ctx.fillText('Belohnung: Die goldene Schutzschild-Krone', cx, cy + 20);
        ctx.fillText('(15 Sekunden Unverwundbarkeit zu Beginn jedes Levels)', cx, cy + 38);

        ctx.fillStyle = '#888';
        ctx.font = '12px monospace';
        ctx.fillText('Mehr Inhalte folgen bald...', cx, cy + 70);

        const blink = Math.sin(Date.now() / 500) > 0;
        if (blink) {
            ctx.fillStyle = '#FFF';
            ctx.font = '14px monospace';
            ctx.fillText(Input.isMobile ? 'Tippen f\u00fcr Hauptmen\u00fc' : 'Enter = Hauptmen\u00fc', cx, cy + 100);
        }

        ctx.restore();
    }
};
