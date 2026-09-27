// ── HUD: Anzeige im Spiel + Touch-Steuerung (Koordinaten in CSS-Pixeln / uiZoom) ──

const HUD = {
    controls: {},
    _worldBanner: 0,
    _toast: null,
    _coinShown: 0,
    _jewelShown: 0,
    _bossHpShown: 1,
    _heartsShown: 20,
    _keyPulse: 0,

    // Wird bei Weltstart aufgerufen
    onWorldStart() {
        this._worldBanner = 3.2;
        this._toast = null;
        this._bossHpShown = 1;
        this._heartsShown = Game.player ? Game.player.hp : 20;
        this._coinShown = Game.coins;
        this._jewelShown = Game.jewels;
    },

    toast(text, color = '#ffe066', time = 2.6) {
        this._toast = { text, color, time, max: time };
    },

    update(dt) {
        if (this._worldBanner > 0) this._worldBanner -= dt;
        if (this._toast) {
            this._toast.time -= dt;
            if (this._toast.time <= 0) this._toast = null;
        }
        const k = 1 - Math.exp(-dt * 8);
        this._coinShown += (Game.coins - this._coinShown) * k;
        this._jewelShown += (Game.jewels - this._jewelShown) * k;
        if (Game.player) this._heartsShown += (Game.player.hp - this._heartsShown) * (1 - Math.exp(-dt * 5));
        this._keyPulse += dt;
    },

    layout(w, h) {
        const c = this.controls;
        const p = Game.player;
        const touch = Input.lastInput === 'touch' || Input.isMobile;
        const s = Game.safe || { l: 0, r: 0, t: 0, b: 0 };
        const R = Math.max(0, s.r - 4);
        const T = Math.max(0, s.t - 4);
        c.pause = { x: w - 30 - R, y: 28 + T, r: 20, show: true };
        c.ability = { x: w - 38 - R, y: 88 + T, r: 24, show: !!(p && p.hasAuto) && touch };
        c.swap = { x: w - 38 - R, y: (c.ability.show ? 146 : 88) + T, r: 24, show: !!(p && p.rangedWeapon) && touch };
        c.dodge = { x: w - 112 - R, y: h - 48 - Math.max(0, s.b - 4), r: 29, show: touch };
    },

    hitTest(x, y) {
        if (Game.state !== 'PLAYING' || Game.paused) return null;
        for (const id of ['pause', 'ability', 'swap', 'dodge']) {
            const b = this.controls[id];
            if (b && b.show && Math.hypot(x - b.x, y - b.y) <= b.r + 8) return id;
        }
        return null;
    },

    draw(ctx, game) {
        const w = Game.hudW;
        const h = Game.hudH;
        const p = game.player;
        if (!p) return;
        this.layout(w, h);
        const s = Game.safe || { l: 0, t: 0 };
        ctx.save();
        ctx.translate(Math.max(0, s.l - 4), Math.max(0, s.t - 4));
        this._drawHearts(ctx, p);
        this._drawWallet(ctx, game);
        this._drawStatus(ctx, p, game);
        ctx.restore();
        this._drawBossBar(ctx, game, w);
        this._drawPointers(ctx, game, w, h);
        this._drawBanner(ctx, game, w, h);
        this._drawToast(ctx, w, h);
        this._drawControls(ctx, p, w, h);
        if (game.state === 'BOSS_INTRO') this._drawBossIntro(ctx, game, w, h);
    },

    // ── Herzen ──
    _drawHearts(ctx, p) {
        const total = Math.round(p.maxHp / 4);
        const size = 10.5;
        const gap = 25;
        const x0 = 22;
        const y0 = 22;
        const hpNow = Math.max(0, p.hp);
        const lowHp = hpNow <= 4 && !p.dead;
        for (let i = 0; i < total; i++) {
            const x = x0 + i * gap;
            const pulse = lowHp && i === Math.floor(Math.max(0, hpNow - 0.01) / 4) ? 1 + Math.sin(Art.time * 10) * 0.08 : 1;
            ctx.save();
            ctx.translate(x, y0);
            ctx.scale(pulse, pulse);
            // Leeres Herz
            Art.heart(ctx, 0, 0, size, '#4a3a5e', { highlight: false, outline: '#1d1433' });
            const fill = clamp(hpNow - i * 4, 0, 4) / 4;
            if (fill > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(-size * 1.3, -size * 1.2 + size * 2.3 * (1 - fill), size * 2.6, size * 2.4);
                ctx.clip();
                Art.heart(ctx, 0, 0, size, '#ff3d5a', { outline: '#6b0f22' });
                ctx.restore();
            }
            ctx.restore();
        }
    },

    _pill(ctx, x, y, w, h) {
        ctx.fillStyle = 'rgba(18,8,38,0.55)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, h / 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
    },

    _drawWallet(ctx, game) {
        const y = 44;
        const coins = Math.round(this._coinShown);
        const jewels = Math.round(this._jewelShown);
        ctx.font = Art.font(13);
        const cw = Math.max(46, ctx.measureText(String(coins)).width + 34);
        const jw = Math.max(40, ctx.measureText(String(jewels)).width + 32);
        this._pill(ctx, 10, y, cw, 22);
        Art.coin(ctx, 22, y + 11, 7, Math.cos(Art.time * 2.2));
        Art.text(ctx, String(coins), 33, y + 11.5, { size: 13, align: 'left', color: '#ffe38a', lineWidth: 3 });
        this._pill(ctx, 16 + cw, y, jw, 22);
        Art.gem(ctx, 28 + cw, y + 11, 7);
        Art.text(ctx, String(jewels), 39 + cw, y + 11.5, { size: 13, align: 'left', color: '#aef0ff', lineWidth: 3 });
    },

    // Kleine Zustandsanzeigen: Kraft, Tempo, Krone, Auto, Schlüssel
    _drawStatus(ctx, p, game) {
        let x = 12;
        const y = 76;
        const chip = (icon, color, text, frac) => {
            ctx.font = Art.font(11);
            const tw = ctx.measureText(text).width;
            const w = tw + 30;
            this._pill(ctx, x, y, w, 20);
            if (frac !== undefined) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(x + 11, y + 10, 7, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0, 1));
                ctx.stroke();
            }
            Art.text(ctx, icon, x + 11, y + 10.5, { size: 10, outline: false, color });
            Art.text(ctx, text, x + 22, y + 10.5, { size: 11, align: 'left', color, lineWidth: 2.5 });
            x += w + 6;
        };
        if (p.hasPowerUp && p.hasPowerUp('attack')) chip('✦', '#ff7a7a', 'Stärke ' + Math.ceil(p.powerUps.attack.timer), p.powerUps.attack.timer / 15);
        if (p.hasPowerUp && p.hasPowerUp('speed')) chip('»', '#74c7ff', 'Tempo ' + Math.ceil(p.powerUps.speed.timer), p.powerUps.speed.timer / 10);
        if (p.crownShieldTimer > 0) chip('♛', '#ffd23f', 'Schild ' + Math.ceil(p.crownShieldTimer), p.crownShieldTimer / (p.crownShieldDuration || 15));
        if (p.autoActive) chip('🚗', '#5ff2ff', 'Auto ' + Math.ceil(p.autoTimer), p.autoTimer / (p.autoDuration || 15));
        if (p.slowTimer > 0) chip('❄', '#bfe8ff', 'Langsam', undefined);
        if (game.hasKey && !game.bossActive) chip('🔑', '#ffd23f', 'Schlüssel!', undefined);
    },

    _drawBossBar(ctx, game, w) {
        if (!game.bossActive || game.bossDefeated) return;
        const boss = game.enemies.find(e => e.isBoss);
        if (!boss) return;
        const k = clamp(boss.hp / boss.maxHp, 0, 1);
        this._bossHpShown += (k - this._bossHpShown) * 0.12;
        const bw = Math.min(360, w * 0.46);
        const x = w / 2 - bw / 2;
        const y = 16;
        const info = worldInfo(game.currentWorld);
        Art.text(ctx, info.boss || 'Boss', w / 2, y + 2, { size: 14, color: info.accent, lineWidth: 4 });
        ctx.fillStyle = 'rgba(18,8,38,0.75)';
        ctx.beginPath();
        ctx.roundRect(x - 3, y + 12, bw + 6, 16, 8);
        ctx.fill();
        // verzögerter Balken (weiß) + echter Balken
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.roundRect(x, y + 15, Math.max(4, bw * this._bossHpShown), 10, 5);
        ctx.fill();
        const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
        grad.addColorStop(0, '#ff3d5a');
        grad.addColorStop(1, '#ff9f1c');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y + 15, Math.max(4, bw * k), 10, 5);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + 4, y + 16, Math.max(0, bw * k - 8), 2.5);
    },

    // Pfeile zu Schlüssel-Träger und Boss-Tür
    _drawPointers(ctx, game, w, h) {
        if (!game.camera || game.state !== 'PLAYING') return;
        const p = game.player;
        const pc = game.camera.worldToScreen(p.x + p.w / 2, p.y + p.h / 2);
        const ph = Input.viewToHud(pc.x, pc.y);
        let target = null;
        let color = '#ffd23f';
        let label = '';
        if (game.hasKey && !game.bossActive && game.world.bossDoorTiles.length) {
            const d = game.world.bossDoorTiles[0];
            target = { x: d.x * TILE_SIZE + TILE_SIZE / 2, y: d.y * TILE_SIZE + TILE_SIZE / 2 };
            color = '#ff5d73';
            label = 'Boss';
        } else if (!game.hasKey && !game.bossActive && game.currentWorld > 0 && (game.levelTime || 0) > 20) {
            const carrier = game.enemies.find(e => e.isKeyGhost && !e.dead);
            const drop = game.keyDrops.find(k => !k.collected);
            if (drop) target = { x: drop.x + drop.w / 2, y: drop.y + drop.h / 2 };
            else if (carrier) target = { x: carrier.centerX(), y: carrier.centerY() };
            label = '🔑';
        }
        if (!target) return;
        const tc = game.camera.worldToScreen(target.x, target.y);
        const th = Input.viewToHud(tc.x, tc.y);
        const dist = Math.hypot(th.x - ph.x, th.y - ph.y);
        if (dist < 70) return;
        const a = Math.atan2(th.y - ph.y, th.x - ph.x);
        // Am Bildschirmrand, wenn Ziel außerhalb, sonst im Kreis um Mark
        const onScreen = th.x > 20 && th.x < w - 20 && th.y > 20 && th.y < h - 20;
        let ax, ay;
        if (onScreen) {
            ax = ph.x + Math.cos(a) * 58;
            ay = ph.y + Math.sin(a) * 58;
        } else {
            const m = 34;
            const tx = Math.cos(a), ty = Math.sin(a);
            const sx = tx > 0 ? (w - m - ph.x) / tx : (m - ph.x) / tx;
            const sy = ty > 0 ? (h - m - ph.y) / ty : (m - 70 - ph.y + 70) / ty;
            const s = Math.min(Math.abs(sx), Math.abs(sy));
            ax = clamp(ph.x + tx * s, m, w - m);
            ay = clamp(ph.y + ty * s, m + 60, h - m);
        }
        const bob = Math.sin(Art.time * 6) * 3;
        ctx.save();
        ctx.translate(ax + Math.cos(a) * bob, ay + Math.sin(a) * bob);
        Art.glow(ctx, 0, 0, 22, color, 0.45);
        ctx.rotate(a);
        Art.shape(ctx, c => {
            c.moveTo(14, 0);
            c.lineTo(-7, -10);
            c.lineTo(-2, 0);
            c.lineTo(-7, 10);
            c.closePath();
        }, { x: -8, y: -10, w: 22, h: 20 }, color, { lineWidth: 2 });
        ctx.restore();
        if (!onScreen && label) Art.text(ctx, label, ax - Math.cos(a) * 20, ay - Math.sin(a) * 20, { size: 11, color });
    },

    _drawBanner(ctx, game, w, h) {
        if (this._worldBanner <= 0 || game.state !== 'PLAYING') return;
        const t = this._worldBanner;
        const a = Math.min(1, t / 0.6, (3.2 - t) / 0.3);
        const info = worldInfo(game.currentWorld);
        const title = game.currentWorld === 0 ? 'Training' : 'Welt ' + game.currentWorld;
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 1);
        const y = h * 0.3;
        const slide = (1 - clamp((3.2 - t) / 0.35, 0, 1)) * 40;
        Art.text(ctx, title, w / 2, y - 16 - slide, { size: 15, color: '#ffffff', lineWidth: 4 });
        Art.text(ctx, info.name, w / 2, y + 10 - slide, { size: 30, color: info.accent, lineWidth: 7 });
        if (game.currentWorld > 0 && !game.hasKey) {
            Art.text(ctx, 'Finde den Schlüssel-Träger 🔑', w / 2, y + 38 - slide, { size: 13, color: '#ffe38a', lineWidth: 3.5 });
        } else if (game.currentWorld === 0) {
            Art.text(ctx, 'Probier alles aus – links laufen, rechts zielen!', w / 2, y + 38 - slide, { size: 13, color: '#ffe38a', lineWidth: 3.5 });
        }
        ctx.restore();
    },

    _drawToast(ctx, w, h) {
        const t = this._toast;
        if (!t) return;
        const a = Math.min(1, t.time / 0.4, (t.max - t.time) / 0.2);
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 1);
        const y = 118;
        ctx.font = Art.font(15);
        const tw = ctx.measureText(t.text).width + 36;
        ctx.fillStyle = 'rgba(18,8,38,0.72)';
        ctx.beginPath();
        ctx.roundRect(w / 2 - tw / 2, y - 16, tw, 32, 16);
        ctx.fill();
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        Art.text(ctx, t.text, w / 2, y + 0.5, { size: 15, color: t.color, lineWidth: 3.5 });
        ctx.restore();
    },

    // ── Touch-Steuerung ──
    _drawStick(ctx, j, defX, defY, color, label) {
        const R = Input.STICK_RADIUS;
        const bx = j.active ? j.baseX : defX;
        const by = j.active ? j.baseY : defY;
        ctx.save();
        ctx.globalAlpha = j.active ? 0.9 : 0.42;
        ctx.fillStyle = 'rgba(18,8,38,0.35)';
        ctx.beginPath();
        ctx.arc(bx, by, R, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2;
        ctx.stroke();
        let kx = bx, ky = by;
        if (j.active) {
            const dx = j.stickX - bx, dy = j.stickY - by;
            const d = Math.hypot(dx, dy);
            const m = Math.min(d, R);
            if (d > 0) { kx = bx + dx / d * m; ky = by + dy / d * m; }
        }
        Art.body(ctx, kx, ky, R * 0.42, R * 0.42, color, { outline: 'rgba(255,255,255,0.7)', lineWidth: 2 });
        if (!j.active && label) {
            ctx.globalAlpha = 0.55;
            Art.text(ctx, label, bx, by + R + 12, { size: 10, color: '#ffffff', lineWidth: 2.5 });
        }
        ctx.restore();
    },

    _drawButton(ctx, b, color, icon, o = {}) {
        if (!b || !b.show) return;
        const pressed = Object.values(Input.buttonsDown).includes(o.id);
        ctx.save();
        ctx.translate(b.x, b.y);
        if (pressed) ctx.scale(0.9, 0.9);
        ctx.globalAlpha = o.dim ? 0.45 : 0.92;
        if (o.glow) Art.glow(ctx, 0, 0, b.r * 1.9, color, 0.35 + Math.sin(Art.time * 5) * 0.15);
        Art.body(ctx, 0, 0, b.r, b.r, color, { outline: 'rgba(255,255,255,0.85)', lineWidth: 2.2 });
        if (o.frac !== undefined) {
            ctx.strokeStyle = 'rgba(18,8,38,0.7)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, b.r - 3, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - clamp(o.frac, 0, 1)), false);
            ctx.stroke();
        }
        if (typeof icon === 'function') icon(ctx, b.r);
        else Art.text(ctx, icon, 0, 1, { size: b.r * 0.85, color: '#ffffff', lineWidth: 3 });
        if (o.label) Art.text(ctx, o.label, 0, b.r + 9, { size: 9, color: '#ffffff', lineWidth: 2.5 });
        ctx.restore();
    },

    _drawControls(ctx, p, w, h) {
        const c = this.controls;
        // Pause (immer)
        this._drawButton(ctx, c.pause, '#5b4c8a', (g, r) => {
            g.fillStyle = '#ffffff';
            g.beginPath();
            g.roundRect(-r * 0.32, -r * 0.4, r * 0.22, r * 0.8, 2);
            g.roundRect(r * 0.1, -r * 0.4, r * 0.22, r * 0.8, 2);
            g.fill();
        }, { id: 'pause' });

        if (Game.state !== 'PLAYING' && Game.state !== 'BOSS_INTRO') return;
        const touch = Input.lastInput === 'touch' || Input.isMobile;
        if (!touch) {
            Art.text(ctx, 'WASD laufen · Maus zielen · Klick angreifen · Leertaste ausweichen' +
                (p.rangedWeapon ? ' · Q Waffe' : '') + (p.hasAuto ? ' · E Auto' : '') + ' · P Pause',
                w / 2, h - 12, { size: 10, color: 'rgba(255,255,255,0.7)', lineWidth: 2.5 });
            return;
        }
        const s = Game.safe || { l: 0, r: 0 };
        this._drawStick(ctx, Input.joystick, 92 + s.l, h - 88, '#7bd3ff', 'Laufen');
        this._drawStick(ctx, Input.aimJoystick, w - 190 - s.r, h - 96, '#ff7a59', p.activeWeapon && p.activeWeapon.type === 'ranged' ? 'Zielen & Werfen' : 'Zielen & Hauen');

        // Ausweichen
        const dodgeCd = p.dodgeCooldown > 0 ? p.dodgeCooldown / p.dodgeCooldownTime : 0;
        this._drawButton(ctx, c.dodge, '#3fa7ff', (g, r) => {
            g.strokeStyle = '#ffffff';
            g.lineWidth = 3;
            g.lineCap = 'round';
            g.lineJoin = 'round';
            g.beginPath();
            g.moveTo(-r * 0.45, r * 0.15);
            g.quadraticCurveTo(-r * 0.1, -r * 0.55, r * 0.4, -r * 0.2);
            g.moveTo(r * 0.12, -r * 0.42);
            g.lineTo(r * 0.42, -r * 0.2);
            g.lineTo(r * 0.2, r * 0.08);
            g.stroke();
        }, { id: 'dodge', frac: dodgeCd > 0 ? 1 - dodgeCd : undefined, dim: dodgeCd > 0, label: 'Ausweichen' });

        // Waffe wechseln
        if (c.swap.show) {
            const ranged = p.activeWeapon && p.activeWeapon.type === 'ranged';
            this._drawButton(ctx, c.swap, ranged ? '#ff9f1c' : '#9b6bff', (g, r) => {
                if (ranged) {
                    // Schläger-Symbol = wechsle zum Schläger
                    Art.limb(g, -r * 0.35, r * 0.35, r * 0.35, -r * 0.35, r * 0.2, '#e8c07a', { lineWidth: 1.2 });
                } else {
                    Art.body(g, 0, 0, r * 0.3, r * 0.3, '#ffffff', { lineWidth: 1.2 });
                    g.strokeStyle = '#e04848';
                    g.lineWidth = 1.2;
                    g.beginPath();
                    g.arc(-r * 0.28, 0, r * 0.22, -0.9, 0.9);
                    g.arc(r * 0.28, 0, r * 0.22, Math.PI - 0.9, Math.PI + 0.9);
                    g.stroke();
                }
            }, { id: 'swap', label: ranged ? 'Schläger' : 'Werfer' });
        }

        // Auto
        if (c.ability.show) {
            const ready = p.autoReady && !p.autoActive;
            const frac = p.autoActive ? p.autoTimer / (p.autoDuration || 15)
                : (p.autoReady ? undefined : p.autoCharges / (p.autoChargesNeeded || 5));
            this._drawButton(ctx, c.ability, '#12c2d6', '🚗', {
                id: 'ability', glow: ready, dim: !ready && !p.autoActive, frac,
                label: p.autoActive ? Math.ceil(p.autoTimer) + ' s' : (ready ? 'Auto!' : p.autoCharges + '/' + p.autoChargesNeeded),
            });
        }
    },

    _drawBossIntro(ctx, game, w, h) {
        const info = worldInfo(game.currentWorld);
        const t = game.bossIntroTime || 0;
        const k = clamp(t / 0.35, 0, 1);
        ctx.save();
        ctx.fillStyle = 'rgba(8,2,20,0.75)';
        const bar = 56 * k;
        ctx.fillRect(0, 0, w, bar);
        ctx.fillRect(0, h - bar, w, bar);
        const s = 1 + (1 - k) * 0.6;
        ctx.translate(w / 2, h / 2);
        ctx.scale(s, s);
        ctx.globalAlpha = k;
        Art.text(ctx, 'BOSS', 0, -26, { size: 16, color: '#ffffff', lineWidth: 4 });
        Art.text(ctx, (info.boss || 'Boss').toUpperCase(), 0, 6, { size: 34, color: info.accent, lineWidth: 8 });
        Art.text(ctx, 'Mach dich bereit!', 0, 38, { size: 14, color: '#ffe38a', lineWidth: 3.5 });
        ctx.restore();
    },
};
