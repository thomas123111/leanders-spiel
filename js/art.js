// ── Art: gemeinsamer Zeichenstil „Cartoon-Glanz" ──
// Alle Figuren nutzen diese Helfer, damit das Spiel wie aus einem Guss aussieht.
// Regeln (Kurzfassung, ausführlich in tasks/stil.md):
//  - Licht kommt von oben links: Körper hell oben links, dunkler unten rechts, weißer Glanzpunkt.
//  - Dunkler, farbiger Umriss (nie reines Schwarz), Breite Art.LINE.
//  - Bodenschatten zeichnet die Engine, NICHT die Figur.
//  - Kein ctx.shadowBlur, kein ctx.filter; Leuchten über Art.glow().
//  - Zeit über Art.time (Sekunden, pausiert mit dem Spiel), nicht Date.now().

const TAU = Math.PI * 2;

// Ersatz für ctx.roundRect auf älteren Browsern (vor Chrome 99 / Safari 16) – sonst fehlte dort das HUD.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        let rad = Array.isArray(r) ? (r[0] || 0) : (+r || 0);
        rad = Math.max(0, Math.min(rad, Math.abs(w) / 2, Math.abs(h) / 2));
        this.moveTo(x + rad, y);
        this.arcTo(x + w, y, x + w, y + h, rad);
        this.arcTo(x + w, y + h, x, y + h, rad);
        this.arcTo(x, y + h, x, y, rad);
        this.arcTo(x, y, x + w, y, rad);
        this.closePath();
        return this;
    };
}

const Art = {
    LINE: 1.6,
    INK: '#1d1433',
    time: 0,
    _colorCache: new Map(),
    _probe: null,
    _glowCache: new Map(),
    _shadowSprite: null,

    // ── Farben ──

    // Wandelt jede CSS-Farbe in [r, g, b, a] (0–255, a 0–1). Ergebnis wird gecacht.
    rgba(color) {
        let hit = this._colorCache.get(color);
        if (hit) return hit;
        if (!this._probe) {
            const c = document.createElement('canvas');
            c.width = c.height = 1;
            this._probe = c.getContext('2d');
        }
        const p = this._probe;
        p.fillStyle = '#000';
        p.fillStyle = color;
        const norm = p.fillStyle;
        let out;
        if (norm[0] === '#') {
            const n = parseInt(norm.slice(1), 16);
            out = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
        } else {
            const m = norm.match(/[\d.]+/g) || [0, 0, 0, 1];
            out = [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
        }
        if (this._colorCache.size > 2000) this._colorCache.clear();
        this._colorCache.set(color, out);
        return out;
    },

    _css(r, g, b, a) {
        r = Math.round(clamp(r, 0, 255));
        g = Math.round(clamp(g, 0, 255));
        b = Math.round(clamp(b, 0, 255));
        return a === undefined || a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${+a.toFixed(3)})`;
    },

    mix(c1, c2, t) {
        const key = c1 + '|' + c2 + '|' + t;
        let hit = this._colorCache.get(key);
        if (hit) return hit;
        const a = this.rgba(c1), b = this.rgba(c2);
        hit = this._css(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t);
        this._colorCache.set(key, hit);
        return hit;
    },

    light(c, t = 0.3) { return this.mix(c, '#ffffff', t); },
    dark(c, t = 0.3) { return this.mix(c, '#12081f', t); },
    alpha(c, a) {
        const v = this.rgba(c);
        return this._css(v[0], v[1], v[2], a);
    },
    // Umrissfarbe: dunkle, satte Variante der Füllfarbe.
    ink(c) { return this.mix(c, this.INK, 0.72); },

    // ── Grundformen mit Schattierung ──

    // Zwischengespeicherter Einheits-Verlauf (Radius 1 um 0,0), wird per Transformation skaliert.
    _bodyGrad(ctx, color, glossy) {
        const cache = ctx.__artGrads || (ctx.__artGrads = new Map());
        const key = color + (glossy ? '|g' : '');
        let g = cache.get(key);
        if (!g) {
            g = ctx.createRadialGradient(-0.38, -0.45, 0.05, 0, 0, 1.12);
            g.addColorStop(0, this.light(color, glossy ? 0.5 : 0.34));
            g.addColorStop(0.5, color);
            g.addColorStop(1, this.dark(color, 0.32));
            if (cache.size > 400) cache.clear();
            cache.set(key, g);
        }
        return g;
    },

    _linGrad(ctx, color) {
        const cache = ctx.__artGrads || (ctx.__artGrads = new Map());
        const key = color + '|lin';
        let g = cache.get(key);
        if (!g) {
            g = ctx.createLinearGradient(0, -1, 0, 1);
            g.addColorStop(0, this.light(color, 0.3));
            g.addColorStop(0.55, color);
            g.addColorStop(1, this.dark(color, 0.3));
            if (cache.size > 400) cache.clear();
            cache.set(key, g);
        }
        return g;
    },

    // Füllt den aktuellen Pfad mit Schattierung. Der Pfad muss im Koordinatensystem von
    // (cx, cy) als Mittelpunkt gebaut sein; rx/ry = halbe Ausdehnung für den Verlauf.
    _shadeFill(ctx, cx, cy, rx, ry, color, o) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(Math.max(0.01, rx), Math.max(0.01, ry));
        ctx.fillStyle = o.flat ? color : (o.linear ? this._linGrad(ctx, color) : this._bodyGrad(ctx, color, o.glossy));
        ctx.fill();
        ctx.restore();
    },

    _finish(ctx, color, o) {
        if (o.outline !== false) {
            ctx.lineWidth = o.lineWidth || this.LINE;
            ctx.strokeStyle = o.outline || this.ink(color);
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    },

    // Ellipsen-Körper: schattiert, Umriss, Glanzlicht.
    // o: { outline: Farbe|false, lineWidth, rot, highlight: false, glossy, flat, alpha }
    body(ctx, x, y, rx, ry, color, o = {}) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, o.rot || 0, 0, TAU);
        this._shadeFill(ctx, x, y, rx, ry, color, o);
        this._finish(ctx, color, o);
        if (o.highlight !== false) this.shine(ctx, x - rx * 0.36, y - ry * 0.42, rx * 0.34, ry * 0.22, o.rot || -0.5);
    },

    // Abgerundetes Rechteck (x, y = links oben).
    box(ctx, x, y, w, h, r, color, o = {}) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
        this._shadeFill(ctx, x + w / 2, y + h / 2, w / 2, h / 2, color, { linear: true, ...o });
        this._finish(ctx, color, o);
        if (o.highlight !== false && w > 6 && h > 6) {
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath();
            ctx.roundRect(x + w * 0.12, y + h * 0.1, w * 0.76, Math.min(h * 0.28, 6), Math.min(r, 3));
            ctx.fill();
        }
    },

    // Beliebiger Pfad: build(ctx) baut den Pfad; bbox = {x, y, w, h} für den Verlauf.
    shape(ctx, build, bbox, color, o = {}) {
        ctx.beginPath();
        build(ctx);
        this._shadeFill(ctx, bbox.x + bbox.w / 2, bbox.y + bbox.h / 2, bbox.w / 2, bbox.h / 2, color, o);
        this._finish(ctx, color, o);
    },

    // Glanzlicht (weiße, weiche Ellipse).
    shine(ctx, x, y, rx, ry, rot = -0.5, a = 0.42) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU);
        ctx.fill();
    },

    // Dicke Linie mit Umriss (Arme, Beine, Stiele). Zeichnet erst Umriss, dann Farbe.
    limb(ctx, x1, y1, x2, y2, width, color, o = {}) {
        ctx.lineCap = 'round';
        if (o.outline !== false) {
            ctx.strokeStyle = o.outline || this.ink(color);
            ctx.lineWidth = width + (o.lineWidth || this.LINE) * 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    },

    // ── Gesicht ──

    // Blinzeln: 1 = offen, 0 = zu. seed verteilt die Blinzelzeitpunkte.
    blink(seed = 0) {
        const t = (this.time + seed * 1.37) % 3.4;
        return t < 0.12 ? Math.abs(t - 0.06) / 0.06 : 1;
    },

    // Ein Auge. look = {x, y} Blickrichtung (-1..1). o: { iris, angry, sad, open(0..1), pupil }
    eye(ctx, x, y, r, look = { x: 0, y: 0 }, o = {}) {
        const open = o.open === undefined ? 1 : o.open;
        if (open < 0.15) {
            ctx.strokeStyle = o.lid || this.INK;
            ctx.lineWidth = Math.max(1, r * 0.35);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x - r * 0.9, y);
            ctx.quadraticCurveTo(x, y + r * 0.35, x + r * 0.9, y);
            ctx.stroke();
            return;
        }
        const ry = r * (o.tall || 1.08) * open;
        ctx.fillStyle = o.sclera || '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, r, ry, 0, 0, TAU);
        ctx.fill();
        ctx.lineWidth = Math.max(0.8, r * 0.22);
        ctx.strokeStyle = o.lid || this.INK;
        ctx.stroke();
        // Iris + Pupille
        const lx = clamp(look.x || 0, -1, 1) * r * 0.38;
        const ly = clamp(look.y || 0, -1, 1) * r * 0.32;
        const ir = r * (o.irisSize || 0.62);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, y, r, ry, 0, 0, TAU);
        ctx.clip();
        if (o.iris) {
            ctx.fillStyle = o.iris;
            ctx.beginPath();
            ctx.arc(x + lx, y + ly, ir, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = o.pupil || '#150c24';
        ctx.beginPath();
        ctx.arc(x + lx, y + ly, o.iris ? ir * 0.55 : ir * 0.8, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + lx - ir * 0.35, y + ly - ir * 0.4, Math.max(0.6, ir * 0.32), 0, TAU);
        ctx.fill();
        ctx.restore();
        // Böse / traurige Augenbraue
        if (o.angry || o.sad) {
            const dir = o.side === 'right' ? -1 : 1;
            ctx.strokeStyle = o.brow || this.INK;
            ctx.lineWidth = Math.max(1.1, r * 0.42);
            ctx.lineCap = 'round';
            ctx.beginPath();
            const tilt = (o.angry ? 1 : -1) * r * 0.55;
            ctx.moveTo(x - r * 1.05 * dir, y - ry - r * 0.35 - tilt * 0.3);
            ctx.lineTo(x + r * 0.95 * dir, y - ry - r * 0.35 + tilt * 0.7);
            ctx.stroke();
        }
    },

    // Augenpaar. o: { gap, look, angry, sad, iris, seed (Blinzeln), blink: false }
    eyes(ctx, x, y, r, o = {}) {
        const gap = o.gap === undefined ? r * 1.25 : o.gap;
        const open = o.blink === false ? 1 : this.blink(o.seed || 0);
        const e = { ...o, open: Math.min(open, o.open === undefined ? 1 : o.open) };
        this.eye(ctx, x - gap, y, r, o.look, { ...e, side: 'left' });
        this.eye(ctx, x + gap, y, r, o.look, { ...e, side: 'right' });
    },

    // Mund. type: 'smile' | 'grin' | 'open' | 'angry' | 'o' | 'teeth'
    mouth(ctx, x, y, w, type = 'smile', o = {}) {
        const ink = o.color || this.INK;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (type === 'smile') {
            ctx.strokeStyle = ink;
            ctx.lineWidth = Math.max(1, w * 0.18);
            ctx.beginPath();
            ctx.arc(x, y - w * 0.35, w * 0.6, 0.35, Math.PI - 0.35);
            ctx.stroke();
        } else if (type === 'angry') {
            ctx.strokeStyle = ink;
            ctx.lineWidth = Math.max(1, w * 0.18);
            ctx.beginPath();
            ctx.arc(x, y + w * 0.45, w * 0.55, Math.PI + 0.5, TAU - 0.5);
            ctx.stroke();
        } else if (type === 'o') {
            ctx.fillStyle = '#3a0d1e';
            ctx.beginPath();
            ctx.ellipse(x, y, w * 0.28, w * 0.34, 0, 0, TAU);
            ctx.fill();
        } else {
            // grin / open / teeth: gefüllter Mund
            const h = type === 'grin' ? w * 0.45 : w * 0.6;
            ctx.fillStyle = '#3a0d1e';
            ctx.beginPath();
            ctx.moveTo(x - w / 2, y - h * 0.25);
            ctx.quadraticCurveTo(x, y - h * 0.05, x + w / 2, y - h * 0.25);
            ctx.quadraticCurveTo(x + w * 0.3, y + h, x, y + h);
            ctx.quadraticCurveTo(x - w * 0.3, y + h, x - w / 2, y - h * 0.25);
            ctx.fill();
            if (type === 'teeth' || type === 'grin') {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(x - w * 0.38, y - h * 0.18);
                ctx.quadraticCurveTo(x, y - h * 0.02, x + w * 0.38, y - h * 0.18);
                ctx.lineTo(x + w * 0.3, y + h * 0.18);
                ctx.lineTo(x - w * 0.3, y + h * 0.18);
                ctx.fill();
            } else {
                ctx.fillStyle = '#ff6f8e';
                ctx.beginPath();
                ctx.ellipse(x, y + h * 0.65, w * 0.2, h * 0.22, 0, 0, TAU);
                ctx.fill();
            }
        }
    },

    // Rosige Wangen.
    blush(ctx, x, y, r, gap, color = '#ff7aa8') {
        ctx.fillStyle = this.alpha(color, 0.45);
        ctx.beginPath();
        ctx.ellipse(x - gap, y, r, r * 0.6, 0, 0, TAU);
        ctx.ellipse(x + gap, y, r, r * 0.6, 0, 0, TAU);
        ctx.fill();
    },

    // ── Licht und Effekte ──

    _glowSprite(color) {
        let s = this._glowCache.get(color);
        if (s) return s;
        const size = 64;
        s = document.createElement('canvas');
        s.width = s.height = size;
        const g = s.getContext('2d');
        const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, this.alpha(this.light(color, 0.4), 1));
        grad.addColorStop(0.25, this.alpha(color, 0.75));
        grad.addColorStop(0.6, this.alpha(color, 0.22));
        grad.addColorStop(1, this.alpha(color, 0));
        g.fillStyle = grad;
        g.fillRect(0, 0, size, size);
        if (this._glowCache.size > 120) this._glowCache.clear();
        this._glowCache.set(color, s);
        return s;
    },

    // Weiches Leuchten (additiv). Günstig: vorgerendertes Bild.
    glow(ctx, x, y, r, color, a = 1) {
        if (a <= 0 || r <= 0) return;
        const prevOp = ctx.globalCompositeOperation;
        const prevA = ctx.globalAlpha;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = prevA * clamp(a, 0, 1);
        ctx.drawImage(this._glowSprite(color), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = prevA;
        ctx.globalCompositeOperation = prevOp;
    },

    // Bodenschatten (weiche Ellipse, vorgerendert).
    groundShadow(ctx, x, y, rx, ry, a = 0.32) {
        if (!this._shadowSprite) {
            const s = document.createElement('canvas');
            s.width = 64;
            s.height = 32;
            const g = s.getContext('2d');
            g.translate(32, 16);
            g.scale(1, 0.5);
            const grad = g.createRadialGradient(0, 0, 0, 0, 0, 32);
            grad.addColorStop(0, 'rgba(10,4,24,0.85)');
            grad.addColorStop(0.55, 'rgba(10,4,24,0.55)');
            grad.addColorStop(1, 'rgba(10,4,24,0)');
            g.fillStyle = grad;
            g.beginPath();
            g.arc(0, 0, 32, 0, TAU);
            g.fill();
            this._shadowSprite = s;
        }
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * a;
        ctx.drawImage(this._shadowSprite, x - rx, y - ry, rx * 2, ry * 2);
        ctx.globalAlpha = prev;
    },

    ring(ctx, x, y, r, color, width = 2, a = 1) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * a;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = prev;
    },

    // Funkeln (vierzackiger Stern).
    sparkle(ctx, x, y, r, color = '#ffffff', a = 1) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * a;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.quadraticCurveTo(x, y, x, y + r);
        ctx.quadraticCurveTo(x, y, x - r, y);
        ctx.quadraticCurveTo(x, y, x, y - r);
        ctx.fill();
        ctx.globalAlpha = prev;
    },

    starPath(ctx, x, y, r, points = 5, inner = 0.48, rot = -Math.PI / 2) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const rr = i % 2 === 0 ? r : r * inner;
            const a = rot + (i * Math.PI) / points;
            if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
    },

    star(ctx, x, y, r, color = '#ffd23f', o = {}) {
        this.shape(ctx, c => {
            const pts = o.points || 5;
            const inner = o.inner || 0.48;
            for (let i = 0; i < pts * 2; i++) {
                const rr = i % 2 === 0 ? r : r * inner;
                const a = (o.rot || -Math.PI / 2) + (i * Math.PI) / pts;
                if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
                else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            }
            c.closePath();
        }, { x: x - r, y: y - r, w: r * 2, h: r * 2 }, color, o);
    },

    heartPath(ctx, x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.95);
        ctx.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.95, y - s * 1.0, x, y - s * 0.38);
        ctx.bezierCurveTo(x + s * 0.95, y - s * 1.0, x + s * 1.25, y + s * 0.05, x, y + s * 0.95);
        ctx.closePath();
    },

    heart(ctx, x, y, s, color = '#ff3d5a', o = {}) {
        this.shape(ctx, c => {
            c.moveTo(x, y + s * 0.95);
            c.bezierCurveTo(x - s * 1.25, y + s * 0.05, x - s * 0.95, y - s * 1.0, x, y - s * 0.38);
            c.bezierCurveTo(x + s * 0.95, y - s * 1.0, x + s * 1.25, y + s * 0.05, x, y + s * 0.95);
            c.closePath();
        }, { x: x - s, y: y - s, w: s * 2, h: s * 2 }, color, o);
        if (o.highlight !== false) this.shine(ctx, x - s * 0.42, y - s * 0.3, s * 0.26, s * 0.18, -0.6, 0.55);
    },

    coin(ctx, x, y, r, spin = 1) {
        const w = Math.max(0.15, Math.abs(spin));
        this.body(ctx, x, y, r * w, r, '#ffc93c', { outline: '#8a5a00', highlight: false, glossy: true });
        if (w > 0.45) {
            ctx.strokeStyle = 'rgba(138,90,0,0.55)';
            ctx.lineWidth = Math.max(0.8, r * 0.14);
            ctx.beginPath();
            ctx.ellipse(x, y, r * w * 0.62, r * 0.62, 0, 0, TAU);
            ctx.stroke();
        }
        this.shine(ctx, x - r * w * 0.3, y - r * 0.38, r * w * 0.25, r * 0.16, -0.5, 0.7);
    },

    gem(ctx, x, y, r, color = '#39d5ff') {
        this.shape(ctx, c => {
            c.moveTo(x, y - r);
            c.lineTo(x + r * 0.9, y - r * 0.25);
            c.lineTo(x, y + r);
            c.lineTo(x - r * 0.9, y - r * 0.25);
            c.closePath();
        }, { x: x - r, y: y - r, w: r * 2, h: r * 2 }, color, { glossy: true });
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.8);
        ctx.lineTo(x + r * 0.45, y - r * 0.25);
        ctx.lineTo(x, y + r * 0.1);
        ctx.lineTo(x - r * 0.45, y - r * 0.25);
        ctx.closePath();
        ctx.fill();
    },

    key(ctx, x, y, s, color = '#ffd23f') {
        ctx.save();
        ctx.translate(x, y);
        this.limb(ctx, -s * 0.1, 0, s * 1.1, 0, s * 0.32, color);
        this.limb(ctx, s * 0.75, 0, s * 0.75, s * 0.42, s * 0.26, color);
        this.limb(ctx, s * 1.02, 0, s * 1.02, s * 0.32, s * 0.26, color);
        this.body(ctx, -s * 0.45, 0, s * 0.55, s * 0.55, color, { glossy: true });
        ctx.fillStyle = this.dark(color, 0.45);
        ctx.beginPath();
        ctx.arc(-s * 0.45, 0, s * 0.2, 0, TAU);
        ctx.fill();
        ctx.restore();
    },

    // ── Text ──
    FONT: '"Nunito", "Baloo 2", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
    font(size, weight = 900) {
        return `${weight} ${size}px ${this.FONT}`;
    },

    // Text mit Umriss (für Zahlen und Hinweise in der Welt).
    text(ctx, str, x, y, o = {}) {
        const size = o.size || 12;
        ctx.font = this.font(size, o.weight || 900);
        ctx.textAlign = o.align || 'center';
        ctx.textBaseline = o.baseline || 'middle';
        ctx.lineJoin = 'round';
        if (o.outline !== false) {
            ctx.strokeStyle = o.outline || 'rgba(20,8,40,0.9)';
            ctx.lineWidth = o.lineWidth || Math.max(2, size * 0.28);
            ctx.strokeText(str, x, y);
        }
        ctx.fillStyle = o.color || '#ffffff';
        ctx.fillText(str, x, y);
        ctx.textBaseline = 'alphabetic';
    },

    // Kleine Welle für Wackel-Animationen (0..1 Phase, Sekunden).
    wave(speed = 1, seed = 0) {
        return Math.sin(this.time * speed * TAU + seed);
    },
};
