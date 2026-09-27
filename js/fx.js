// ── Effekte: Partikel, schwebende Zahlen, Schockwellen, Bildschirm-Effekte ──

const MAX_FLOATERS = 40;
const MAX_RINGS = 24;

// Partikel. Signatur wie früher: new Particle(x, y, vx, vy, farbe, lebensdauer)
// Optional danach setzbar: .gravity, .drag, .size, .kind ('dot' | 'spark' | 'smoke' | 'confetti' | 'star'), .glow
class Particle {
    constructor(x, y, vx, vy, color, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.lifetime = lifetime || 0.5;
        this.maxLifetime = this.lifetime;
        this.radius = randRange(2.2, 4.8);
        this.dead = false;
        this.gravity = 0;
        this.drag = 3; // Abbremsung pro Sekunde (bildratenunabhängig)
        this.kind = 'dot';
        this.glow = true;
        this.spin = randRange(0, TAU);
        this.spinSpeed = randRange(-8, 8);
    }

    update(dt) {
        const damp = Math.exp(-this.drag * dt);
        this.vx *= damp;
        this.vy = this.vy * damp + this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.spin += this.spinSpeed * dt;
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.dead = true;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const k = clamp(this.lifetime / this.maxLifetime, 0, 1);
        const prev = ctx.globalAlpha;
        if (this.kind === 'smoke') {
            ctx.globalAlpha = prev * k * 0.45;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, this.radius * (2.2 - k), 0, TAU);
            ctx.fill();
        } else if (this.kind === 'confetti') {
            ctx.globalAlpha = prev * Math.min(1, k * 2);
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(this.spin);
            ctx.scale(1, Math.cos(this.spin * 1.7));
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.radius, -this.radius * 0.5, this.radius * 2, this.radius);
            ctx.restore();
        } else if (this.kind === 'star') {
            ctx.globalAlpha = prev * Math.min(1, k * 1.6);
            Art.sparkle(ctx, pos.x, pos.y, this.radius * (0.6 + k * 0.8), this.color);
        } else {
            const r = this.radius * (0.35 + k * 0.65);
            if (this.glow && r > 1.4) Art.glow(ctx, pos.x, pos.y, r * 3.2, this.color, k * 0.55);
            ctx.globalAlpha = prev * Math.min(1, k * 1.5);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            if (this.kind === 'spark') {
                const sp = Math.hypot(this.vx, this.vy) || 1;
                const len = Math.min(10, sp * 0.03) + r;
                ctx.lineCap = 'round';
                ctx.strokeStyle = this.color;
                ctx.lineWidth = r;
                ctx.moveTo(pos.x, pos.y);
                ctx.lineTo(pos.x - (this.vx / sp) * len, pos.y - (this.vy / sp) * len);
                ctx.stroke();
            } else {
                ctx.arc(pos.x, pos.y, r, 0, TAU);
                ctx.fill();
                if (r > 2.2) {
                    ctx.fillStyle = 'rgba(255,255,255,0.65)';
                    ctx.beginPath();
                    ctx.arc(pos.x - r * 0.3, pos.y - r * 0.3, r * 0.35, 0, TAU);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = prev;
    }
}

const FX = {
    floaters: [],
    rings: [],
    ambient: [],
    ambientKind: null,
    flash: 0,
    flashColor: '#ffffff',
    _scratch: null,
    _vignette: null,
    _vignetteKey: '',

    reset() {
        this.floaters.length = 0;
        this.rings.length = 0;
        this.ambient.length = 0;
        this.flash = 0;
    },

    _push(list, item, max) {
        list.push(item);
        if (list.length > max) list.splice(0, list.length - max);
    },

    _particles() {
        return (typeof Game !== 'undefined' && Game.particles) ? Game.particles : null;
    },

    // Explosion aus Partikeln.
    burst(x, y, color, count = 10, speed = 140, life = 0.55, o = {}) {
        const list = this._particles();
        if (!list) return;
        const colors = Array.isArray(color) ? color : [color];
        for (let i = 0; i < count; i++) {
            const a = (TAU * i) / count + randRange(-0.3, 0.3);
            const s = speed * randRange(0.45, 1.05);
            const p = new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, colors[i % colors.length], life * randRange(0.7, 1.15));
            if (o.kind) p.kind = o.kind;
            if (o.gravity) p.gravity = o.gravity;
            if (o.size) p.radius = o.size * randRange(0.7, 1.2);
            if (o.drag !== undefined) p.drag = o.drag;
            list.push(p);
        }
        this._capParticles();
    },

    confetti(x, y, count = 40) {
        const colors = ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0', '#b980ff', '#ff9f1c'];
        const list = this._particles();
        if (!list) return;
        for (let i = 0; i < count; i++) {
            const a = randRange(-Math.PI * 0.95, -Math.PI * 0.05);
            const s = randRange(120, 320);
            const p = new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, colors[i % colors.length], randRange(1.2, 2.2));
            p.kind = 'confetti';
            p.gravity = 360;
            p.drag = 1.6;
            p.radius = randRange(2.5, 4);
            list.push(p);
        }
        this._capParticles();
    },

    _capParticles() {
        const list = this._particles();
        if (list && list.length > MAX_PARTICLES) list.splice(0, list.length - MAX_PARTICLES);
    },

    // Schwebender Text (Schaden, +Münzen). size in Einheiten.
    text(x, y, str, color = '#ffffff', size = 11, o = {}) {
        this._push(this.floaters, {
            x: x + randRange(-4, 4), y, str: String(str), color, size,
            life: o.life || 0.8, max: o.life || 0.8, vy: o.vy || -46, pop: 0,
        }, MAX_FLOATERS);
    },

    ring(x, y, color = '#ffffff', radius = 40, life = 0.35, width = 3) {
        this._push(this.rings, { x, y, color, radius, life, max: life, width }, MAX_RINGS);
    },

    screenFlash(color = '#ffffff', strength = 0.35) {
        this.flashColor = color;
        this.flash = Math.max(this.flash, strength);
    },

    update(dt) {
        for (const f of this.floaters) {
            f.life -= dt;
            f.y += f.vy * dt;
            f.vy *= Math.exp(-2.5 * dt);
            f.pop = Math.min(1, f.pop + dt * 9);
        }
        compactInPlace(this.floaters, f => f.life > 0);
        for (const r of this.rings) r.life -= dt;
        compactInPlace(this.rings, r => r.life > 0);
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    },

    // Welt-Ebene: Ringe (unter Figuren gezeichnet).
    drawRings(ctx, camera) {
        for (const r of this.rings) {
            const k = 1 - r.life / r.max;
            const p = camera.worldToScreen(r.x, r.y);
            Art.ring(ctx, p.x, p.y, r.radius * (0.25 + k * 0.75), r.color, r.width * (1 - k) + 0.5, (1 - k) * 0.9);
        }
    },

    // Welt-Ebene: Texte (über Figuren).
    drawFloaters(ctx, camera) {
        for (const f of this.floaters) {
            const p = camera.worldToScreen(f.x, f.y);
            const a = Math.min(1, f.life / f.max * 2.5);
            const s = f.size * (0.6 + 0.55 * Math.sin(f.pop * Math.PI * 0.75));
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * a;
            Art.text(ctx, f.str, p.x, p.y, { size: s, color: f.color });
            ctx.globalAlpha = prev;
        }
    },

    // Treffer-Blitz: Figur wird weiß überblendet. Zeichnet die Figur in eine Hilfsfläche und färbt sie dort ein.
    drawFlashing(ctx, e, camera, scale, strength = 0.75, color = '#ffffff') {
        const margin = Math.max(e.w, e.h) * 0.75 + 12;
        const lw = e.w + margin * 2;
        const lh = e.h + margin * 2;
        const pw = Math.ceil(lw * scale);
        const ph = Math.ceil(lh * scale);
        if (pw > 2048 || ph > 2048) {
            e.draw(ctx, camera);
            return;
        }
        if (!this._scratch) this._scratch = document.createElement('canvas');
        const s = this._scratch;
        if (s.width < pw || s.height < ph) {
            s.width = Math.max(s.width, pw);
            s.height = Math.max(s.height, ph);
        }
        const sc = s.getContext('2d');
        sc.setTransform(1, 0, 0, 1, 0, 0);
        sc.globalCompositeOperation = 'source-over';
        sc.globalAlpha = 1;
        sc.clearRect(0, 0, pw, ph);
        sc.setTransform(scale, 0, 0, scale, 0, 0);
        const ox = e.x - margin;
        const oy = e.y - margin;
        const fake = {
            x: ox, y: oy, width: lw, height: lh, shakeX: 0, shakeY: 0,
            worldToScreen(x, y) { return { x: x - ox, y: y - oy }; },
            screenToWorld(x, y) { return { x: x + ox, y: y + oy }; },
            shake() {}, follow() {},
        };
        try {
            e.draw(sc, fake);
        } catch (err) {
            e.draw(ctx, camera);
            return;
        }
        sc.setTransform(1, 0, 0, 1, 0, 0);
        sc.globalCompositeOperation = 'source-atop';
        sc.globalAlpha = strength;
        sc.fillStyle = color;
        sc.fillRect(0, 0, pw, ph);
        sc.globalAlpha = 1;
        sc.globalCompositeOperation = 'source-over';
        const p = camera.worldToScreen(ox, oy);
        ctx.drawImage(s, 0, 0, pw, ph, p.x, p.y, lw, lh);
    },

    // ── Umgebungspartikel je Thema (Bildschirmraum, leichte Parallaxe) ──
    AMBIENT: {
        training: { color: '#fff3b0', kind: 'mote', n: 14 },
        castle: { color: '#c9b8ff', kind: 'mote', n: 22 },
        factory: { color: '#ffb347', kind: 'spark', n: 16 },
        slime: { color: '#9dff8a', kind: 'bubble', n: 20 },
        shadowcastle: { color: '#ff7a9c', kind: 'ember', n: 20 },
        cave: { color: '#8ff7d4', kind: 'mote', n: 20 },
        dark: { color: '#b28cff', kind: 'mote', n: 26 },
        mushroom: { color: '#ffe38a', kind: 'mote', n: 26 },
        swamp: { color: '#b6ff7a', kind: 'bubble', n: 18 },
        ice: { color: '#ffffff', kind: 'snow', n: 40 },
        volcano: { color: '#ff8a3d', kind: 'ember', n: 34 },
        shadow: { color: '#c08cff', kind: 'mote', n: 30 },
        orchard: { color: '#ffd6f2', kind: 'petal', n: 22 },
        pixel: { color: '#6cf0ff', kind: 'pixel', n: 22 },
        space: { color: '#ffffff', kind: 'twinkle', n: 34 },
        bones: { color: '#ffe7b8', kind: 'mote', n: 16 },
        poison: { color: '#9dff5a', kind: 'bubble', n: 24 },
        stone: { color: '#dfe7f5', kind: 'mote', n: 14 },
        dojo: { color: '#ffc2dc', kind: 'petal', n: 26 },
        fruit: { color: '#ffd6f2', kind: 'petal', n: 22 },
        dino: { color: '#e9ff9a', kind: 'mote', n: 20 },
        chrono: { color: '#7ff0ff', kind: 'twinkle', n: 26 },
        shadowswamp: { color: '#7dff9e', kind: 'mote', n: 26 },
        football: { color: '#ffffff', kind: 'confetti', n: 22 },
        scrap: { color: '#ffc46b', kind: 'spark', n: 18 },
        // mix = weitere Partikelarten desselben Themas (colors: Farben reihum)
        zombie: {
            color: '#c8ff8a', kind: 'mote', n: 12,
            mix: [{ kind: 'mist', color: '#7ee85a', n: 7 }, { kind: 'paper', color: '#f2eefc', n: 4 }],
        },
        butterfly: {
            color: '#ffc8ec', kind: 'petal', n: 10,
            mix: [
                { kind: 'petal', colors: ['#fff3b0', '#e4d4ff', '#ffffff'], n: 6 },
                { kind: 'pollen', color: '#fff3a0', n: 12 },
                { kind: 'flutter', colors: ['#ff8ad8', '#8ad8ff', '#ffd23f', '#c9a8ff'], n: 4 },
            ],
        },
    },

    setAmbient(theme, w, h) {
        const cfg = this.AMBIENT[theme] || this.AMBIENT.castle;
        this.ambientKind = cfg.kind;
        this.ambient.length = 0;
        for (let i = 0; i < cfg.n; i++) {
            this.ambient.push({
                x: Math.random() * w, y: Math.random() * h,
                z: randRange(0.4, 1.2), s: randRange(0.6, 1.4),
                ph: Math.random() * TAU, color: cfg.color,
            });
        }
        for (const m of cfg.mix || []) {
            for (let i = 0; i < m.n; i++) {
                this.ambient.push({
                    x: Math.random() * w, y: Math.random() * h,
                    z: randRange(0.4, 1.2), s: randRange(0.6, 1.4),
                    ph: Math.random() * TAU, color: m.colors ? m.colors[i % m.colors.length] : m.color, kind: m.kind,
                });
            }
        }
    },

    updateAmbient(dt, w, h, camDx, camDy) {
        for (const a of this.ambient) {
            const k = a.kind || this.ambientKind;
            a.ph += dt;
            let vx = 0, vy = 0;
            if (k === 'snow') { vx = Math.sin(a.ph * 0.8) * 12; vy = 26 * a.z; }
            else if (k === 'ember') { vx = Math.sin(a.ph * 1.3) * 10; vy = -32 * a.z; }
            else if (k === 'bubble') { vx = Math.sin(a.ph * 2) * 6; vy = -18 * a.z; }
            else if (k === 'petal' || k === 'confetti') { vx = 14 * a.z; vy = 18 * a.z; }
            else if (k === 'spark') { vx = Math.sin(a.ph) * 8; vy = 10 * a.z; }
            else if (k === 'mist') { vx = 7 * a.z + Math.sin(a.ph * 0.3) * 4; vy = Math.cos(a.ph * 0.25) * 3; }
            else if (k === 'paper') { vx = 9 * a.z + Math.sin(a.ph * 1.1) * 14; vy = 7 * a.z + Math.sin(a.ph * 2.2) * 6; }
            else if (k === 'pollen') { vx = Math.sin(a.ph * 0.9) * 6; vy = -5 * a.z + Math.cos(a.ph * 1.3) * 4; }
            else if (k === 'flutter') { vx = Math.sin(a.ph * 0.7 + a.s * 3) * 20; vy = Math.cos(a.ph * 0.9 + a.s * 5) * 12 - 3; }
            else { vx = Math.sin(a.ph * 0.6) * 8; vy = Math.cos(a.ph * 0.5) * 6; }
            a.x += vx * dt - camDx * a.z * 0.35;
            a.y += vy * dt - camDy * a.z * 0.35;
            if (a.x < -10) a.x += w + 20; else if (a.x > w + 10) a.x -= w + 20;
            if (a.y < -10) a.y += h + 20; else if (a.y > h + 10) a.y -= h + 20;
        }
    },

    drawAmbient(ctx) {
        const prev = ctx.globalAlpha;
        for (const a of this.ambient) {
            const k = a.kind || this.ambientKind;
            const tw = 0.55 + 0.45 * Math.sin(a.ph * 2.3);
            if (k === 'mist' || k === 'paper' || k === 'pollen' || k === 'flutter') {
                this._drawAmbientExtra(ctx, a, k, tw, prev);
                continue;
            }
            if (k === 'snow') {
                ctx.globalAlpha = prev * 0.75;
                ctx.fillStyle = a.color;
                ctx.beginPath();
                ctx.arc(a.x, a.y, 1.3 * a.s * a.z + 0.4, 0, TAU);
                ctx.fill();
            } else if (k === 'twinkle') {
                ctx.globalAlpha = prev * tw * 0.8;
                Art.sparkle(ctx, a.x, a.y, 2.2 * a.s, a.color);
            } else if (k === 'pixel') {
                ctx.globalAlpha = prev * tw * 0.5;
                ctx.fillStyle = a.color;
                ctx.fillRect(Math.round(a.x), Math.round(a.y), 2.5 * a.s, 2.5 * a.s);
            } else if (k === 'bubble') {
                ctx.globalAlpha = prev * 0.45;
                Art.ring(ctx, a.x, a.y, 2.4 * a.s * a.z, a.color, 0.8, 1);
            } else if (k === 'petal' || k === 'confetti') {
                ctx.globalAlpha = prev * 0.6;
                ctx.save();
                ctx.translate(a.x, a.y);
                ctx.rotate(a.ph * 2);
                ctx.fillStyle = k === 'confetti' ? ['#ff4d6d', '#ffd23f', '#3ddc97', '#4cc9f0'][Math.floor(a.s * 10) % 4] : a.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, 2.6 * a.s, 1.3 * a.s, 0, 0, TAU);
                ctx.fill();
                ctx.restore();
            } else {
                // mote / ember / spark: leuchtende Punkte
                ctx.globalAlpha = prev;
                Art.glow(ctx, a.x, a.y, 5 * a.s * a.z, a.color, tw * (k === 'ember' ? 0.9 : 0.5));
            }
        }
        ctx.globalAlpha = prev;
    },

    // Flügel der Umgebungs-Schmetterlinge: x, y, Radius x, Radius y, Drehung (fest, damit pro Bild nichts angelegt wird)
    _wings: [-2.2, -1, 2.4, 1.9, -0.4, 2.2, -1, 2.4, 1.9, 0.4, -1.6, 1.5, 1.5, 1.2, 0.3, 1.6, 1.5, 1.5, 1.2, -0.3],

    // Umgebungspartikel der Welten 22/23: Nebelschwaden, Heftblätter, Blütenstaub, kleine Schmetterlinge
    _drawAmbientExtra(ctx, a, k, tw, prev) {
        if (k === 'mist') {
            ctx.globalAlpha = prev;
            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.scale(2.4, 1);
            Art.glow(ctx, 0, 0, 16 * a.s * a.z + 6, a.color, 0.11 + 0.06 * tw);
            ctx.restore();
        } else if (k === 'paper') {
            const s = a.s * 1.25;
            ctx.globalAlpha = prev * 0.85;
            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.rotate(Math.sin(a.ph * 1.3) * 0.7);
            ctx.scale(Math.cos(a.ph * 1.9), 1);
            ctx.fillStyle = a.color;
            ctx.fillRect(-3 * s, -3.8 * s, 6 * s, 7.6 * s);
            ctx.fillStyle = '#8fb4ff';
            for (let i = 0; i < 3; i++) ctx.fillRect(-2.2 * s, (-1.9 + i * 1.8) * s, 4.6 * s, 0.5);
            ctx.restore();
        } else if (k === 'pollen') {
            ctx.globalAlpha = prev * tw * 0.85;
            Art.sparkle(ctx, a.x, a.y, 1.5 * a.s + 0.4, a.color);
        } else {
            // flatternder, leise leuchtender Schmetterling
            const s = a.s * 0.9, f = 0.25 + 0.75 * Math.abs(Math.sin(a.ph * 11));
            ctx.globalAlpha = prev;
            Art.glow(ctx, a.x, a.y, 9 * s + 3, a.color, 0.3);
            ctx.globalAlpha = prev * 0.9;
            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.rotate(Math.sin(a.ph * 0.8) * 0.4);
            ctx.fillStyle = a.color;
            ctx.beginPath();
            const wg = this._wings;
            for (let i = 0; i < wg.length; i += 5) {
                const ex = wg[i] * f * s, ey = wg[i + 1] * s, erx = wg[i + 2] * f * s, rot = wg[i + 4];
                ctx.moveTo(ex + Math.cos(rot) * erx, ey + Math.sin(rot) * erx);
                ctx.ellipse(ex, ey, erx, wg[i + 3] * s, rot, 0, TAU);
            }
            ctx.fill();
            ctx.fillStyle = '#3a2248';
            ctx.fillRect(-0.4, -2 * s, 0.8, 4 * s);
            ctx.restore();
        }
    },

    // Vignette (vorgerendert je Größe).
    drawVignette(ctx, w, h, strength = 0.5) {
        const key = Math.round(w) + 'x' + Math.round(h);
        if (this._vignetteKey !== key) {
            const c = document.createElement('canvas');
            c.width = 256;
            c.height = Math.max(64, Math.round(256 * h / w));
            const g = c.getContext('2d');
            const grad = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.35, c.width / 2, c.height / 2, c.width * 0.62);
            grad.addColorStop(0, 'rgba(8,2,20,0)');
            grad.addColorStop(1, 'rgba(8,2,20,1)');
            g.fillStyle = grad;
            g.fillRect(0, 0, c.width, c.height);
            this._vignette = c;
            this._vignetteKey = key;
        }
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * strength;
        ctx.drawImage(this._vignette, 0, 0, w, h);
        ctx.globalAlpha = prev;
    },

    drawScreenFlash(ctx, w, h) {
        if (this.flash <= 0) return;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * this.flash;
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = prev;
    },
};
