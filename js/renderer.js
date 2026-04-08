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
        const worldNames = [null, 'Geisterschloss', 'Maschinen-Hof', 'Schleim-Arena', 'Schatten-Burg', 'Pilz-Wald', 'M\u00fccken-Sumpf', 'Antarktis', 'Vulkan-Insel'];
        const worldColors = [null, '#A6F', '#F80', '#4D4', '#C66', '#A84', '#8A4', '#8CF', '#F84'];
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

        // ── Boss door hint + arrow ──
        if (game.hasKey && !game.bossActive) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Schl\u00fcssel gefunden! Finde die Boss-T\u00fcr!', ctx.canvas.width / 2, 20);
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

    drawTitleScreen(ctx) {
        this._buttons = [];
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        ctx.save();

        // Mark on the left
        this._drawMarkCharacter(ctx, cw * 0.18, ch * 0.5, 2.5);

        // Title
        const tx = cw * 0.58;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#4A9';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('Mark und die', tx, ch * 0.18);
        ctx.fillStyle = '#F88';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('geklauten Erfindungen', tx, ch * 0.28);

        // Worlds
        const worlds = [
            { name: 'Welt 1: Geisterschloss', color: '#A6F' },
            { name: 'Welt 2: Roboter-K\u00fcken', color: '#F80' },
            { name: 'Welt 3: Schleim-Arena', color: '#4D4' },
            { name: 'Welt 4: Schatten-Burg', color: '#C66' },
            { name: 'Welt 5: Pilz-Wald', color: '#A84' },
            { name: 'Welt 6: M\u00fccken-Sumpf', color: '#8A4' },
            { name: 'Welt 7: Antarktis', color: '#8CF' },
            { name: 'Welt 8: Vulkan-Insel', color: '#F84' },
        ];

        // World select buttons (big, easy to tap)
        const btnW = 260;
        const btnH = 42;
        const startY = ch * 0.34;
        for (let i = 0; i < worlds.length; i++) {
            const unlocked = i + 1 <= Game.maxWorldUnlocked;
            const bx = tx - btnW / 2;
            const by = startY + i * 50;
            if (unlocked) {
                this._drawButton(ctx, bx, by, btnW, btnH, worlds[i].name, 14);
            } else {
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.roundRect(bx, by, btnW, btnH, 10);
                ctx.fill();
                ctx.strokeStyle = '#555';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(bx, by, btnW, btnH, 10);
                ctx.stroke();
                ctx.fillStyle = '#666';
                ctx.font = '14px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('\uD83D\uDD12 ' + worlds[i].name, tx, by + btnH / 2 + 5);
            }
        }

        // Controls
        ctx.fillStyle = '#555';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        if (!Input.isMobile) {
            ctx.fillText('WASD = Bewegen | Maus = Zielen | Leertaste = Ausweichen | Q = Waffe', tx, ch * 0.92);
        } else {
            ctx.fillText('Links = Bewegen | Rechts = Zielen & Angreifen', tx, ch * 0.92);
        }

        // Version number
        ctx.fillStyle = '#444';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('v3.0.0', cw - 8, ch - 6);

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
            4: { title: 'GOLDENE KRONE erhalten!', desc: '5 Sekunden Schutzschild zu Beginn jedes Levels!', color: '#FFD700' },
            5: { title: 'RIESEN PILZ besiegt!', desc: 'Der M\u00fccken-Sumpf wartet...', color: '#A84' },
            6: { title: 'RIESEN M\u00dcCKE besiegt!', desc: 'Ab in die Antarktis! Juri schlie\u00dft sich an!', color: '#8A4' },
            7: { title: 'SCHNEE ADLER besiegt!', desc: 'Das Schatten-Krokodil k\u00e4mpft jetzt f\u00fcr euch!', color: '#8CF' },
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
