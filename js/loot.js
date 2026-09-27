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

    // Holztruhe mit Goldbeschlägen. Zu: wippt ab und zu und glitzert. Offen: Deckel hinten,
    // Lichtstrahl und der schwebende Gegenstand (Herz, halbes Herz, Tempo-Blitz, Stärke-Faust).
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const cx = pos.x + this.w / 2;
        const by = pos.y + this.h;                                   // Bodenlinie
        const ph = Math.abs(this.x * 0.071 + this.y * 0.113) % 7;    // eigener Takt je Truhe
        const WOOD = '#c97c3a';
        const INK = '#5a2f10';
        const GOLD = '#ffc933';
        const GINK = '#8a5a00';
        // Kontaktschatten (die Engine beschattet nur Figuren mit centerX)
        Art.groundShadow(ctx, cx, by - 0.5, 14.5, 4.2, 0.36);
        if (!this.opened) {
            const u = (t + ph) % 2.8;
            const hop = u < 0.42 ? Math.sin(u / 0.42 * Math.PI) : 0;
            ctx.save();
            ctx.translate(cx, by);
            ctx.rotate(Math.sin(u / 0.42 * TAU) * 0.06 * hop);
            ctx.translate(0, -hop * 2.2);
            Art.box(ctx, -12, -12, 24, 12, 2.4, WOOD, { outline: INK });
            ctx.strokeStyle = 'rgba(90,47,16,0.45)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(-11, -5.5);
            ctx.lineTo(11, -5.5);
            ctx.stroke();
            Art.shape(ctx, c => {
                c.moveTo(-12.8, -11);
                c.lineTo(-12.8, -16);
                c.quadraticCurveTo(-12.8, -21.5, -7, -21.5);
                c.lineTo(7, -21.5);
                c.quadraticCurveTo(12.8, -21.5, 12.8, -16);
                c.lineTo(12.8, -11);
                c.closePath();
            }, { x: -12.8, y: -21.5, w: 25.6, h: 10.5 }, '#e0914a', { glossy: true, outline: INK });
            // Goldbeschläge (ein Pfad) und Schloss
            ctx.beginPath();
            ctx.roundRect(-9.8, -21.3, 3.2, 21.3, 1);
            ctx.roundRect(6.6, -21.3, 3.2, 21.3, 1);
            ctx.roundRect(-13.2, -12.7, 26.4, 2.8, 1.2);
            ctx.fillStyle = GOLD;
            ctx.fill();
            ctx.strokeStyle = GINK;
            ctx.lineWidth = 1.1;
            ctx.stroke();
            Art.box(ctx, -3.2, -14.8, 6.4, 6.8, 1.8, GOLD, { outline: GINK, lineWidth: 1.1 });
            ctx.fillStyle = '#4a2a08';
            ctx.beginPath();
            ctx.arc(0, -12.3, 1.1, 0, TAU);
            ctx.moveTo(-0.6, -12);
            ctx.lineTo(0.6, -12);
            ctx.lineTo(0.9, -9.6);
            ctx.lineTo(-0.9, -9.6);
            ctx.closePath();
            ctx.fill();
            Art.shine(ctx, -4, -19.2, 5, 1, -0.1, 0.45);
            ctx.restore();
            // Glitzern an wechselnden Stellen
            const g = (t * 0.8 + ph * 0.37) % 1.7;
            if (g < 0.55) {
                const s = Math.sin(g / 0.55 * Math.PI);
                const sx = cx - 8 + ((ph * 3 + Math.floor((t * 0.8 + ph * 0.37) / 1.7) * 5.3) % 16);
                Art.sparkle(ctx, sx, by - 18 - hop * 2.2, 3.4 * s, '#fff7cf', 0.95);
            }
            return;
        }
        const has = this.item && !this.itemCollected;
        const fade = has ? Math.min(1, this.itemFloatTimer) : 0;
        ctx.save();
        ctx.translate(cx, by);
        // Deckel nach hinten geklappt: man sieht seine Innenseite
        Art.shape(ctx, c => {
            c.moveTo(-12.4, -15.5);
            c.lineTo(-11.4, -27.5);
            c.quadraticCurveTo(-11.2, -30, -8, -30);
            c.lineTo(8, -30);
            c.quadraticCurveTo(11.2, -30, 11.4, -27.5);
            c.lineTo(12.4, -15.5);
            c.closePath();
        }, { x: -12.4, y: -30, w: 24.8, h: 14.5 }, '#9a5424', { outline: INK });
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-10.4, -28);
        ctx.lineTo(10.4, -28);
        ctx.stroke();
        // Innenraum, leuchtet solange die Beute darin liegt
        Art.box(ctx, -11.6, -17.5, 23.2, 7.5, 2.2, '#3b1f0e', { highlight: false, outline: INK });
        if (fade > 0) Art.glow(ctx, 0, -14, 16, '#ffd86b', 0.85 * fade);
        Art.box(ctx, -12, -11.5, 24, 11.5, 2.4, WOOD, { outline: INK });
        ctx.beginPath();
        ctx.roundRect(-9.8, -11.5, 3.2, 11.5, 1);
        ctx.roundRect(6.6, -11.5, 3.2, 11.5, 1);
        ctx.roundRect(-13.2, -12.6, 26.4, 2.6, 1.2);
        ctx.roundRect(-3, -10.4, 6, 5.4, 1.6);
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.strokeStyle = GINK;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.restore();
        if (!has) return;
        // Lichtsäule und Strahlen
        const k = 1.5 - this.itemFloatTimer;                   // Sekunden seit dem Öffnen
        ctx.save();
        ctx.translate(cx, by - 15);
        ctx.scale(0.45, 1.6);
        Art.glow(ctx, 0, -11, 20, '#fff2b0', 0.6 * fade);
        ctx.restore();
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * 0.22 * fade;
        ctx.fillStyle = '#fff3b8';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            const sw = Math.sin(t * 1.6 + i) * 1.5;
            ctx.moveTo(cx + i * 5 - 1.6, by - 15);
            ctx.lineTo(cx + i * 11 - 3.5 + sw, by - 48);
            ctx.lineTo(cx + i * 11 + 3.5 + sw, by - 48);
            ctx.lineTo(cx + i * 5 + 1.6, by - 15);
        }
        ctx.fill();
        ctx.globalAlpha = a0;
        // schwebender Gegenstand: springt heraus, steigt, verblasst
        const q = Math.min(1, k / 0.25);
        const pop = 1 + 2.2 * Math.pow(q - 1, 3) + 1.2 * Math.pow(q - 1, 2);
        const iy = by - 24 - k * 11 + Math.sin(t * 4) * 1.2;
        const type = this.item.type;
        const glowCol = type === 'speed' ? '#5cc8ff' : (type === 'attack' ? '#ff7a3c' : '#ff5a7a');
        ctx.save();
        ctx.globalAlpha = a0 * fade;
        ctx.translate(cx, iy);
        ctx.scale(pop, pop);
        ctx.rotate(Math.sin(t * 3) * 0.08);
        Art.glow(ctx, 0, 0, 14, glowCol, 0.65);
        if (type === 'heart' || type === 'halfheart') {
            this._drawHeart(ctx, 0, 0.5, type === 'heart' ? 7.5 : 7, type === 'halfheart');
        } else if (type === 'speed') {
            // Tempo-Blitz
            Art.shape(ctx, c => {
                c.moveTo(1.4, -9);
                c.lineTo(-5, 1.4);
                c.lineTo(-0.6, 1.4);
                c.lineTo(-2.2, 9);
                c.lineTo(5.2, -2);
                c.lineTo(0.8, -2);
                c.lineTo(3.4, -9);
                c.closePath();
            }, { x: -5, y: -9, w: 10.2, h: 18 }, '#4cc9ff', { glossy: true, outline: '#12507a' });
            Art.shine(ctx, 0.2, -3.5, 1.2, 3, 0.55, 0.6);
        } else {
            // Stärke-Faust (roter Boxhandschuh)
            Art.box(ctx, -4.6, 3.2, 9.2, 4.2, 1.6, '#ffffff', { outline: '#8e9ab8' });
            Art.body(ctx, 0.6, -1.4, 6.2, 5.6, '#ff3b4e', { glossy: true, outline: '#7a0a1a' });
            Art.body(ctx, -4.6, 0.6, 2.3, 3.2, '#ff3b4e', { highlight: false, outline: '#7a0a1a' });
            ctx.strokeStyle = 'rgba(122,10,26,0.55)';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(-1.5, -5.5);
            ctx.quadraticCurveTo(0.5, -4.2, 3.5, -5.2);
            ctx.stroke();
        }
        ctx.restore();
        for (let i = 0; i < 3; i++) {
            const g = t * 2.4 + i * 2.1;
            const tw = Math.sin(t * 7 + i * 2);
            if (tw > 0) Art.sparkle(ctx, cx + Math.cos(g) * 11, iy + Math.sin(g) * 8, 2.8 * tw * fade, '#ffffff', 0.95);
        }
    }

    // Herz; half = nur die linke Hälfte gefüllt (halbes Herz).
    _drawHeart(ctx, x, y, size, half) {
        if (!half) {
            Art.heart(ctx, x, y, size, '#ff3d5a');
            return;
        }
        Art.heart(ctx, x, y, size, '#ffd3dc', { highlight: false });
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - size * 2, y - size * 2, size * 2, size * 4);
        ctx.clip();
        Art.heart(ctx, x, y, size, '#ff3d5a');
        ctx.restore();
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

    // Goldener Schlüssel: schwebt, leuchtet pulsierend, sendet Ringwellen, funkelt.
    draw(ctx, camera) {
        if (this.collected) return;
        const t = Art.time;
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const bob = Math.sin(t * 3) * 2.6 - 3;
        Art.groundShadow(ctx, cx, cy + 8, 7.5 + bob * 0.4, 2.6, 0.3);
        const pulse = 0.5 + 0.5 * Math.sin(t * 4);
        Art.glow(ctx, cx, cy + bob, 18 + pulse * 5, '#ffd23f', 0.5 + pulse * 0.25);
        const w = (t * 0.9) % 1;
        Art.ring(ctx, cx, cy + bob, 7 + w * 15, '#fff1a8', 1.5, (1 - w) * 0.75);
        ctx.save();
        ctx.translate(cx, cy + bob);
        ctx.rotate(-0.62 + Math.sin(t * 2) * 0.12);
        Art.key(ctx, -0.6, 0, 7.4, '#ffcf2e');
        ctx.restore();
        for (let i = 0; i < 3; i++) {
            const g = t * 1.8 + i * 2.1;
            const tw = Math.sin(t * 6 + i * 1.7);
            if (tw > 0) Art.sparkle(ctx, cx + Math.cos(g) * 12, cy + bob + Math.sin(g) * 8, 2.8 * tw, '#ffffff', 0.9);
        }
    }
}

// ── Münze ──
class CoinDrop {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.w = 14;
        this.h = 14;
        this.value = value || 1;
        this.collected = false;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt, player) {
        if (this.collected) return false;
        this.bobOffset += dt;
        const dist = vecDist(
            { x: this.x + this.w / 2, y: this.y + this.h / 2 },
            { x: player.x + player.w / 2, y: player.y + player.h / 2 }
        );
        if (dist < 30) {
            this.collected = true;
            return true;
        }
        return false;
    }

    // Drehende Goldmünze mit Glanz (ohne Zahl).
    draw(ctx, camera) {
        if (this.collected) return;
        const t = Art.time + (this.bobOffset || 0) - (this.age || 0);   // eigene Phase je Münze
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const bob = Math.sin(t * 4) * 1.8 - 2.5;
        Art.groundShadow(ctx, cx, cy + 6.5, 5.2, 1.9, 0.28);
        Art.glow(ctx, cx, cy + bob, 11, '#ffd23f', 0.32);
        const spin = Math.cos(t * 5);
        Art.coin(ctx, cx, cy + bob, 5.4, spin);
        if (spin > 0.9) Art.sparkle(ctx, cx + 2.6, cy + bob - 3, 3 * (spin - 0.9) / 0.1, '#ffffff', 0.9);
    }
}

// ── Deko-Schädel (rollt, wenn man ihn anstößt) ──
class SkullProp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 16;
        this.h = 16;
        this.vx = randRange(-20, 20);
        this.vy = randRange(-20, 20);
        this.spin = randRange(0, Math.PI * 2);
    }

    update(dt, world, player, enemies) {
        this.spin += dt * 4;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.985;
        this.vy *= 0.985;

        if (world && world.isWall(this.x + this.w / 2, this.y + this.h / 2)) {
            this.vx *= -0.7;
            this.vy *= -0.7;
        }

        const bumpTargets = [];
        if (player) bumpTargets.push({ x: player.x + player.w / 2, y: player.y + player.h / 2, w: player.w, h: player.h, push: 50 });
        if (enemies) {
            for (const e of enemies) {
                if (e.dead) continue;
                bumpTargets.push({ x: e.centerX(), y: e.centerY(), w: e.w, h: e.h, push: 30 });
            }
        }
        for (const t of bumpTargets) {
            const dist = vecDist({ x: this.x + this.w / 2, y: this.y + this.h / 2 }, { x: t.x, y: t.y });
            if (dist < 24) {
                const a = angleBetween({ x: t.x, y: t.y }, { x: this.x + this.w / 2, y: this.y + this.h / 2 });
                this.vx += Math.cos(a) * t.push * dt;
                this.vy += Math.sin(a) * t.push * dt;
            }
        }
    }

    // Niedlicher Deko-Schädel: rund, große Augenhöhlen mit Glanzpunkt, wackelt beim Rollen.
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const wob = Math.sin(this.spin);
        const BONE = '#f7f1e3';
        const INK = '#8a7e66';
        Art.groundShadow(ctx, cx, cy + 7, 7.2, 2.4, 0.3);
        ctx.save();
        ctx.translate(cx, cy - 1 + wob * 0.8);
        ctx.rotate(wob * 0.22);
        Art.box(ctx, -3.8, 1.4, 7.6, 4.6, 2, BONE, { highlight: false, outline: INK, lineWidth: 1.2 });
        Art.body(ctx, 0, -1.6, 6.9, 6.2, BONE, { outline: INK, lineWidth: 1.3 });
        ctx.fillStyle = '#3a2a4a';
        ctx.beginPath();
        ctx.ellipse(-2.6, -0.8, 2.1, 2.5, 0.12, 0, TAU);
        ctx.moveTo(4.7, -0.8);
        ctx.ellipse(2.6, -0.8, 2.1, 2.5, -0.12, 0, TAU);
        ctx.moveTo(0, 1.6);
        ctx.lineTo(-0.9, 3);
        ctx.lineTo(0.9, 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-3.1, -1.8, 0.8, 0, TAU);
        ctx.moveTo(2.9, -1.8);
        ctx.arc(2.1, -1.8, 0.8, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            ctx.moveTo(i * 1.4, 3.6);
            ctx.lineTo(i * 1.4, 5.6);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,140,170,0.35)';
        ctx.beginPath();
        ctx.ellipse(-4.6, 2, 1.3, 0.8, 0, 0, TAU);
        ctx.moveTo(5.9, 2);
        ctx.ellipse(4.6, 2, 1.3, 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
}
