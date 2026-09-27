// ── Welt 23: Schmetterlingwelt ──
// Leanders Wunsch: „In der Schmetterlingwelt soll es bunte Schmetterlinge, die Sternstaub schießen, als
// Feinde geben. Der Boss ist ein Schmetterling mit drei Köpfen und er kann extrem viel Sternstaub auf
// einmal schießen.“
//
//   FalterKit            gemeinsame Helfer: Farbschemata, vorgerenderte Flügel und Sterne, Sichtlinie
//   StardustShot         Sternstaub-Geschoss (Unterklasse von Projectile): funkelnder Stern mit Leuchten
//                        und kurzem Schweif; Varianten Welle, Zerplatzen und Himmelsfall (Glitzer-Regen)
//   StarButterfly        Sternstaub-Falter: bunte Falter, halten Abstand, kreisen, kündigen jeden Schuss an
//   BossTripleButterfly  Drei-Kopf-Schmetterling (letzter Boss): rosa (fröhlich), blau (verschlafen),
//                        gold (grummelig); Sternstaub-Sturm, Kopf-Salven, Glitzer-Regen, Phase 2
//   ButterflySwarm       Siegesbild: die Flügel zerfallen zu Glitzer, kleine Falter fliegen davon
//
// Leistung: Flügel der kleinen Falter und alle Sterne werden einmal je Farbe vorgerendert (FalterKit);
// ein Stern kostet pro Bild ein Leuchten, ein Bild und einen Schweif-Pfad.

const FalterKit = {
    PX: 4,              // Bildpunkte je Einheit in den vorgerenderten Bildern (scharf auf Handys)
    BOSS_CAP: 120,      // höchstens so viele Boss-Sterne gleichzeitig
    _stars: new Map(),
    _wings: new Map(),

    // Farbschemata. fore/hind = Flügel, band = inneres Band, spot = Augenfleck, dot = Tupfen,
    // body/head = Körper/Kopf, iris = Augenfarbe, dust = Sternstaub (hebt sich von Wiese und Nacht ab).
    // pat 0: Augenflecken vorn, Tupfen hinten; pat 1: Augenflecken hinten, Tupfen am Vorderrand.
    SCHEMES: [
        { key: 'regenbogen', fore: '#ff4d6d', hind: '#3ddc97', band: '#ffd23f', spot: '#4c6bff', dot: '#ffffff', body: '#4b2a8c', head: '#ffe3f1', iris: '#6a3fd6', dust: '#ff9f1c', pat: 0 },
        { key: 'rosa', fore: '#ff6fcf', hind: '#a86bff', band: '#ffc2ec', spot: '#5b2bd6', dot: '#ffffff', body: '#5a2379', head: '#ffe8fb', iris: '#c2187a', dust: '#ff4fb0', pat: 1 },
        { key: 'tuerkis', fore: '#22d3c5', hind: '#ffd23f', band: '#c2fff8', spot: '#ff7a1c', dot: '#ffffff', body: '#12545f', head: '#e3fffb', iris: '#0f8a7e', dust: '#ffe14a', pat: 0 },
        { key: 'orange', fore: '#ff9f1c', hind: '#3d7bff', band: '#ffe08a', spot: '#1d2a6b', dot: '#ffffff', body: '#3b2461', head: '#fff0d9', iris: '#d05a00', dust: '#6fd8ff', pat: 1 },
        { key: 'limette', fore: '#9ee84a', hind: '#ff6f9f', band: '#f4ffb0', spot: '#8a2be2', dot: '#ffffff', body: '#2f5a1c', head: '#f3ffe0', iris: '#4a8a1c', dust: '#fff4d6', pat: 0 },
        { key: 'himmel', fore: '#4cb8ff', hind: '#b98cff', band: '#d6f1ff', spot: '#ffd23f', dot: '#ffffff', body: '#253a8a', head: '#e8f6ff', iris: '#2566d6', dust: '#c49cff', pat: 1 },
    ],
    // Schlüsselträger: goldene Flügel
    GOLD: { key: 'gold', fore: '#ffd23f', hind: '#ffae1f', band: '#fff6a8', spot: '#ff7a1c', dot: '#ffffff', body: '#7a4a00', head: '#fff5d0', iris: '#c77800', dust: '#ffe066', pat: 0 },

    _canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.ceil(w);
        c.height = Math.ceil(h);
        return c;
    },

    shake(strength, time) {
        if (typeof Game !== 'undefined' && Game.camera && Game.camera.shake) Game.camera.shake(strength, time);
    },

    // Freie Sichtlinie (keine Wand) zwischen zwei Punkten, Stichproben alle 14 Einheiten.
    clearLine(world, x0, y0, x1, y1) {
        if (!world || !world.isWall) return true;
        const dx = x1 - x0, dy = y1 - y0;
        const n = Math.ceil(Math.hypot(dx, dy) / 14);
        for (let i = 1; i < n; i++) {
            if (world.isWall(x0 + (dx * i) / n, y0 + (dy * i) / n)) return false;
        }
        return true;
    },

    // Lebende Boss-Sterne (für die Obergrenze).
    liveBossShots(list) {
        let n = 0;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (p.fromBoss && !p.dead) n++;
        }
        return n;
    },

    // ── Stern (vorgerendert je Farbe): Füllung mit Verlauf, dunkler Umriss, weißer Kern, Glanz ──
    STAR_R: 6.4,        // Zacken-Radius im Bild (Einheiten)
    STAR_HALF: 9,       // halbe Bildgröße (Einheiten)
    starSprite(color) {
        let s = this._stars.get(color);
        if (s) return s;
        const H = this.STAR_HALF, P = this.PX;
        s = this._canvas(2 * H * P, 2 * H * P);
        const g = s.getContext('2d');
        g.scale(P, P);
        g.translate(H, H);
        Art.star(g, 0, 0, this.STAR_R, color, { inner: 0.52, lineWidth: 1.5, outline: Art.ink(color), glossy: true });
        Art.starPath(g, 0, 0.4, 2.5, 5, 0.5);
        g.fillStyle = 'rgba(255,255,255,0.92)';
        g.fill();
        Art.shine(g, -2, -2.7, 1.5, 0.9, -0.6, 0.75);
        if (this._stars.size > 40) this._stars.clear();
        this._stars.set(color, s);
        return s;
    },

    // ── Flügel der Sternstaub-Falter (vorgerendert je Schema, Flügelschlag = waagerechtes Stauchen) ──
    WING_HALF: 21,      // halbe Bildbreite (Einheiten)
    WING_TOP: 19,       // Bildoberkante über der Körpermitte
    WING_H: 36,

    // Vorderflügel; side = 1 rechts, -1 links; s = Größe um die Flügelwurzel (für Rand und Band)
    forePath(c, side, s) {
        const x0 = 1.2 * side, y0 = -2.5, k = side * s;
        c.moveTo(x0, y0);
        c.bezierCurveTo(x0 + 2 * k, y0 - 12 * s, x0 + 13 * k, y0 - 16.5 * s, x0 + 17.5 * k, y0 - 11 * s);
        c.bezierCurveTo(x0 + 20.5 * k, y0 - 7 * s, x0 + 16 * k, y0 + 1.5 * s, x0 + 0.5 * k, y0 + 2.8 * s);
        c.closePath();
    },
    hindPath(c, side, s) {
        const x0 = 1.2 * side, y0 = 0, k = side * s;
        c.moveTo(x0, y0);
        c.bezierCurveTo(x0 + 9 * k, y0 - 1.5 * s, x0 + 15.5 * k, y0 + 4 * s, x0 + 13 * k, y0 + 9.5 * s);
        c.bezierCurveTo(x0 + 10.5 * k, y0 + 14.5 * s, x0 + 3 * k, y0 + 12.5 * s, x0 + 0.2 * k, y0 + 4.5 * s);
        c.closePath();
    },

    wingSprite(sc) {
        let s = this._wings.get(sc.key);
        if (s) return s;
        const P = this.PX;
        s = this._canvas(2 * this.WING_HALF * P, this.WING_H * P);
        const g = s.getContext('2d');
        g.scale(P, P);
        g.translate(this.WING_HALF, this.WING_TOP);
        g.lineJoin = 'round';
        g.lineCap = 'round';
        const both = (fn, sz) => c => { fn(c, 1, sz); fn(c, -1, sz); };
        const HB = { x: -15, y: -2, w: 30, h: 16 };
        const FB = { x: -20, y: -17, w: 40, h: 21 };
        // Hinterflügel: dunkler Rand, schattierte Fläche, helles Band
        Art.shape(g, both(this.hindPath, 1), HB, Art.mix(sc.hind, Art.INK, 0.45), { flat: true, outline: false });
        Art.shape(g, both(this.hindPath, 0.82), HB, sc.hind, { outline: false, linear: true });
        Art.shape(g, both(this.hindPath, 0.46), HB, Art.light(sc.hind, 0.45), { flat: true, outline: false });
        // Vorderflügel
        Art.shape(g, both(this.forePath, 1), FB, Art.mix(sc.fore, Art.INK, 0.45), { flat: true, outline: false });
        Art.shape(g, both(this.forePath, 0.84), FB, sc.fore, { outline: false, linear: true });
        Art.shape(g, both(this.forePath, 0.5), FB, sc.band, { flat: true, outline: false });
        // Adern
        g.strokeStyle = Art.alpha(Art.INK, 0.22);
        g.lineWidth = 0.45;
        g.beginPath();
        for (const side of [-1, 1]) {
            g.moveTo(side * 1.5, -2.5); g.lineTo(side * 15, -12.5);
            g.moveTo(side * 1.5, -2.2); g.lineTo(side * 17.5, -6.5);
            g.moveTo(side * 1.5, -1.5); g.lineTo(side * 12, 0.5);
            g.moveTo(side * 1.5, 0.5); g.lineTo(side * 12.5, 7.5);
            g.moveTo(side * 1.2, 1); g.lineTo(side * 7, 11);
        }
        g.stroke();
        // Muster
        const spots = sc.pat === 0 ? [11, -9.5, 2.9] : [8.6, 6.4, 2.6];
        g.beginPath();
        for (const side of [-1, 1]) {
            g.moveTo(side * spots[0] + spots[2], spots[1]);
            g.arc(side * spots[0], spots[1], spots[2], 0, TAU);
        }
        g.fillStyle = sc.spot;
        g.fill();
        g.lineWidth = 0.7;
        g.strokeStyle = Art.ink(sc.spot);
        g.stroke();
        g.beginPath();
        for (const side of [-1, 1]) {
            g.moveTo(side * spots[0] + spots[2] * 0.52, spots[1]);
            g.arc(side * spots[0], spots[1], spots[2] * 0.52, 0, TAU);
        }
        g.fillStyle = sc.band;
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        for (const side of [-1, 1]) {
            g.moveTo(side * spots[0] - 0.45 + 0.7, spots[1] - 0.6);
            g.arc(side * spots[0] - 0.45, spots[1] - 0.6, 0.7, 0, TAU);
        }
        g.fill();
        const dots = sc.pat === 0
            ? [[9, 6.8, 1.3], [5.8, 10.2, 1], [11.6, 3.6, 0.8]]
            : [[16.6, -11.4, 1.1], [17.6, -7.4, 0.95], [14.8, -3.6, 0.8], [12.6, -14.6, 0.8]];
        g.fillStyle = sc.dot;
        g.beginPath();
        for (const side of [-1, 1]) {
            for (const d of dots) {
                g.moveTo(side * d[0] + d[2], d[1]);
                g.arc(side * d[0], d[1], d[2], 0, TAU);
            }
        }
        g.fill();
        // Umriss obenauf, dann Glanz
        g.beginPath();
        this.hindPath(g, 1, 1); this.hindPath(g, -1, 1);
        g.lineWidth = 1.3;
        g.strokeStyle = Art.ink(sc.hind);
        g.stroke();
        g.beginPath();
        this.forePath(g, 1, 1); this.forePath(g, -1, 1);
        g.strokeStyle = Art.ink(sc.fore);
        g.stroke();
        Art.shine(g, -9.5, -12, 3.4, 1.4, -0.45, 0.45);
        Art.shine(g, 7.5, -12.5, 2.6, 1.1, 0.35, 0.3);
        if (this._wings.size > 20) this._wings.clear();
        this._wings.set(sc.key, s);
        return s;
    },

    // Kleiner Falter (Sieges-Schwarm): vier Flügel-Ellipsen und ein Körperstrich; ph = Flügelschlag-Phase
    tiny(ctx, x, y, s, col, ph) {
        const k = 0.28 + 0.72 * Math.abs(Math.cos(ph));
        const fw = 3 * s * k, fh = 2.3 * s, hw = 2 * s * k, hh = 1.6 * s;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x - fw * 2, y - 1.2 * s);
        ctx.ellipse(x - fw, y - 1.2 * s, fw, fh, 0, Math.PI, Math.PI + TAU);
        ctx.moveTo(x + fw * 2, y - 1.2 * s);
        ctx.ellipse(x + fw, y - 1.2 * s, fw, fh, 0, 0, TAU);
        ctx.moveTo(x - hw * 2, y + 1.6 * s);
        ctx.ellipse(x - hw, y + 1.6 * s, hw, hh, 0, Math.PI, Math.PI + TAU);
        ctx.moveTo(x + hw * 2, y + 1.6 * s);
        ctx.ellipse(x + hw, y + 1.6 * s, hw, hh, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#2a1640';
        ctx.lineWidth = 1.1 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y - 2.4 * s);
        ctx.lineTo(x, y + 2.6 * s);
        ctx.stroke();
    },
};

// ══════════════════════════════════════════
// Sternstaub-Geschoss
// ══════════════════════════════════════════

// Funkelnder Stern. Wie jedes Gegner-Geschoss: 1 Schaden, stirbt an Wänden, main.js prüft den Treffer.
// o: { radius, size (Zeichengröße), life, drag, minSpeed, turn (rad/s), wave (Ausschlag quer), waveFreq,
//      split: { at, n, speed } (zerplatzt nach at Sekunden in n kleine Sterne),
//      fall (Sekunden bis zum Einschlag vom Himmel; so lange harmlos), boss (zählt zur Boss-Obergrenze) }
class StardustShot extends Projectile {
    constructor(x, y, angle, speed, color, o = {}) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', o.knockback || 60);
        this.color = color || '#ffd23f';
        this.radius = o.radius || 5;
        this.size = o.size || this.radius * 1.3;
        this.lifetime = o.life || 3;
        this.seed = Math.random() * TAU;
        this.spin = (Math.random() < 0.5 ? -1 : 1) * randRange(2.4, 4.2);
        this.drag = o.drag || 0;
        this.minSpeed = o.minSpeed || 0;
        this.turn = o.turn || 0;
        this.fromBoss = !!o.boss;
        this.split = o.split || null;
        this.mode = 'fly';
        this.wave = o.wave || 0;
        if (this.wave) {
            // Welle: der Stern schlängelt sich quer zur Flugrichtung um eine gerade Grundbahn
            this.waveFreq = o.waveFreq || 6;
            this.wavePhase = o.wavePhase || 0;
            this.bx = x;
            this.by = y;
        }
        if (o.fall) {
            // Glitzer-Regen: fällt vom Himmel auf eine Bodenmarkierung und ist bis zum Einschlag harmlos
            this.mode = 'fall';
            this.fall = o.fall;
            this.fallMax = o.fall;
            this.hitR = this.radius;
            this.radius = -999;     // solange er fällt, kann er Mark nicht treffen (main.js: Abstand < radius + 14)
            this.lifetime = o.fall + 0.2;
        }
    }

    update(dt, world) {
        if (this.mode === 'fall') {
            this.age += dt;
            this.fall -= dt;
            if (this.fall <= 0) {
                // Einschlag: kurz gefährlich (Radius 8 + Mark 14 = Markierung 22)
                this.mode = 'boom';
                this.radius = this.hitR;
                this.lifetime = 0.14;
                this.boomT = 0;
                if (typeof FX !== 'undefined') {
                    FX.burst(this.x, this.y, [this.color, '#ffffff', '#fff6a8'], 6, 110, 0.4, { kind: 'star' });
                    FX.ring(this.x, this.y, '#fff6a8', 30, 0.3, 3);
                }
            }
            return;
        }
        if (this.mode === 'boom') {
            this.age += dt;
            this.boomT += dt;
            this.lifetime -= dt;
            if (this.lifetime <= 0) this.dead = true;
            return;
        }
        if (this.drag > 0) {
            const sp = Math.hypot(this.vx, this.vy);
            if (sp > this.minSpeed && sp > 0) {
                const ns = Math.max(this.minSpeed, sp * Math.exp(-this.drag * dt));
                this.vx *= ns / sp;
                this.vy *= ns / sp;
            }
        }
        if (this.turn) {
            const c = Math.cos(this.turn * dt), s = Math.sin(this.turn * dt);
            const vx = this.vx * c - this.vy * s;
            this.vy = this.vx * s + this.vy * c;
            this.vx = vx;
        }
        if (this.wave) {
            this.age += dt;
            this.lifetime -= dt;
            if (this.lifetime <= 0) { this.dead = true; return; }
            this.bx += this.vx * dt;
            this.by += this.vy * dt;
            const sp = Math.hypot(this.vx, this.vy) || 1;
            const off = this.wave * Math.sin(this.age * this.waveFreq + this.wavePhase);
            const nx = this.bx - (this.vy / sp) * off;
            const ny = this.by + (this.vx / sp) * off;
            if (world.isWall(nx, ny)) { this.dead = true; return; }
            this.x = nx;
            this.y = ny;
        } else {
            super.update(dt, world);
        }
        if (this.split && !this.dead && this.age >= this.split.at) this._burst();
    }

    // Großer Stern zerplatzt in einen Ring kleiner Sterne. Der Ring ist so gedreht,
    // dass Mark genau zwischen zwei Sternen steht (fair, wenn er nicht zu nah ist).
    _burst() {
        const sp = this.split;
        this.dead = true;
        const list = typeof Game !== 'undefined' && Game.projectiles ? Game.projectiles : null;
        if (!list) return;
        let a0 = Math.random() * TAU;
        const pl = typeof Game !== 'undefined' ? Game.player : null;
        if (pl && !pl.dead) a0 = Math.atan2(pl.y + pl.h / 2 - this.y, pl.x + pl.w / 2 - this.x) + Math.PI / sp.n;
        for (let i = 0; i < sp.n; i++) {
            list.push(new StardustShot(this.x, this.y, a0 + (i * TAU) / sp.n, sp.speed, sp.color || this.color,
                { radius: 4.5, size: 5.6, life: 2.4, boss: this.fromBoss }));
        }
        if (typeof FX !== 'undefined') {
            FX.burst(this.x, this.y, [this.color, '#ffffff'], 8, 130, 0.35, { kind: 'star' });
            FX.ring(this.x, this.y, Art.light(this.color, 0.3), 32, 0.3, 3);
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        if (this.mode === 'fall') { this._drawFalling(ctx, p.x, p.y); return; }
        if (this.mode === 'boom') {
            const k = 1 - this.boomT / 0.14;
            Art.glow(ctx, p.x, p.y, 30, this.color, 0.9 * k);
            Art.sparkle(ctx, p.x, p.y, 14 * k + 4, '#ffffff', k);
            return;
        }
        const a0 = ctx.globalAlpha;
        const age = this.age;
        const born = Math.min(1, age / 0.12);
        const fade = clamp(this.lifetime / 0.25, 0, 1);
        let s = this.size * (0.55 + 0.45 * born) * (1 + 0.13 * Math.sin(age * 12 + this.seed));
        if (this.split) {
            // pulsiert schneller, kurz bevor er zerplatzt
            const left = this.split.at - age;
            if (left < 0.5) s *= 1 + 0.2 * Math.abs(Math.sin(age * 28)) * (1 - left / 0.5);
        }
        if (fade < 1) ctx.globalAlpha = a0 * fade;
        // Schweif: zwei verblassende Tupfen gegen die Flugrichtung
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 20) {
            const ux = this.vx / sp, uy = this.vy / sp;
            const g = Math.min(1, sp / 120) * s;
            const x1 = p.x - ux * g * 1.35, y1 = p.y - uy * g * 1.35;
            const x2 = p.x - ux * g * 2.5, y2 = p.y - uy * g * 2.5;
            ctx.globalAlpha = a0 * fade * 0.45;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(x1 + s * 0.46, y1);
            ctx.arc(x1, y1, s * 0.46, 0, TAU);
            ctx.moveTo(x2 + s * 0.28, y2);
            ctx.arc(x2, y2, s * 0.28, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = a0 * fade;
        }
        Art.glow(ctx, p.x, p.y, s * 2.4, this.color, 0.5);
        const h = (FalterKit.STAR_HALF * s) / FalterKit.STAR_R;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.seed + age * this.spin);
        ctx.drawImage(FalterKit.starSprite(this.color), -h, -h, h * 2, h * 2);
        ctx.restore();
        // gelegentliches Funkeln an der Spitze
        const tw = Math.sin(age * 7 + this.seed * 3);
        if (tw > 0.72) Art.sparkle(ctx, p.x + s * 0.6, p.y - s * 0.65, s * (tw - 0.62) * 1.6, '#ffffff', 0.95);
        ctx.globalAlpha = a0;
    }

    // Himmelsfall: erst ist nur die Bodenmarkierung zu sehen (zeichnet der Boss), in den letzten
    // 0,42 s stürzt der Stern von oben herab.
    _drawFalling(ctx, x, y) {
        const drop = 0.42;
        if (this.fall > drop) return;
        const q = 1 - this.fall / drop;
        const hgt = 140 * (1 - q * q);
        const yy = y - hgt;
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * 0.5;
        ctx.strokeStyle = this.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, yy - 6);
        ctx.lineTo(x, yy - 6 - 26 * q);
        ctx.stroke();
        ctx.globalAlpha = a0;
        Art.glow(ctx, x, yy, 18, this.color, 0.7);
        const h = (FalterKit.STAR_HALF * 8) / FalterKit.STAR_R;
        ctx.save();
        ctx.translate(x, yy);
        ctx.rotate(this.seed + this.age * 5);
        ctx.drawImage(FalterKit.starSprite(this.color), -h, -h, h * 2, h * 2);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// Sternstaub-Falter
// ══════════════════════════════════════════

// Bunter Falter mit großem Kopf, Fühlern mit Sternstaub-Kugeln und gemusterten Flügeln.
// Fliegt mit Wand-Kollision (der Schläger kommt immer heran), hält 120–170 Einheiten Abstand zu Mark
// und kreist. Alle 2,2–3 s: 0,4 s Ankündigung (Flügel leuchten, Funken sammeln sich, bremst ab),
// dann ein gezielter Stern (125/s) oder ein Fächer aus drei (108/s). Nur mit freier Sichtlinie.
class StarButterfly extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 22);
        this.hp = 4;
        this.maxHp = 4;
        this.speed = 70;
        this.damage = 1;
        this.contactDamage = true;
        this.flying = true;
        this.scheme = FalterKit.SCHEMES[Math.floor(Math.random() * FalterKit.SCHEMES.length)];
        this.fxColor = this.scheme.fore;
        this.seed = Math.random() * 10;
        this.t = Math.random() * 10;            // eigene Uhr (G-22)
        this.look = { x: 0, y: 0.35 };
        this.orbitR = randRange(120, 170);      // Wunschabstand zu Mark
        this.orbitDir = Math.random() < 0.5 ? -1 : 1;
        this.wanderA = Math.random() * TAU;
        this.flipCd = 0;
        this.engaged = false;
        this.hasLos = false;
        this.losT = Math.random() * 0.25;
        this.shotTimer = randRange(1.2, 2.8);
        this.charge = 0;                        // 0 = ruhig, sonst Ankündigung 0..1
        this.pattern = 1;                       // 1 = gezielter Stern, 3 = Fächer
        this.flapExtra = 0;                     // schnellerer Flügelschlag beim Aufladen
        this.isKeyGhost = false;                // setzt main.js beim Schlüsselträger
        this.droppedKey = false;
        this._keyReady = false;
    }

    // Schlüsselträger (main.js setzt isKeyGhost nach dem Erzeugen): goldene Flügel, etwas zäher
    _makeKeyCarrier() {
        this._keyReady = true;
        this.hp = 6;
        this.maxHp = 6;
        this.fxColor = '#ffd23f';
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyReady) this._makeKeyCarrier();
        this.t += dt;
        if (this.flipCd > 0) this.flipCd -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        this.engaged = !player.dead && dist < (this.engaged ? 330 : 250);
        // Sichtlinie alle 0,25 s prüfen (Wände dazwischen: direkt auf Mark zu, um die Ecke herum)
        this.losT -= dt;
        if (this.losT <= 0) {
            this.losT = 0.25;
            this.hasLos = this.engaged && FalterKit.clearLine(world, mx, my, px, py);
        }
        // Blick sanft nachführen (nur Darstellung)
        const lk = Math.min(1, dt * 8);
        this.look.x += ((this.engaged ? nx : Math.cos(this.wanderA) * 0.5) - this.look.x) * lk;
        this.look.y += ((this.engaged ? ny : 0.35) - this.look.y) * lk;

        let vx, vy;
        if (this.engaged && !this.hasLos) {
            vx = nx - ny * 0.3 * this.orbitDir;
            vy = ny + nx * 0.3 * this.orbitDir;
        } else if (this.engaged) {
            // Abstand halten (heran oder zurück, zurück nur langsam: Mark holt sie ein) und kreisen
            const radial = clamp((dist - this.orbitR) / 45, -0.6, 1);
            const tang = this.charge > 0 ? 0.15 : 0.6;
            vx = nx * radial - ny * tang * this.orbitDir;
            vy = ny * radial + nx * tang * this.orbitDir;
        } else {
            this.wanderA += Math.sin(this.t * 0.6 + this.seed) * dt * 1.4;
            vx = Math.cos(this.wanderA) * 0.45;
            vy = Math.sin(this.wanderA) * 0.45;
        }
        // Flatterbahn
        vx += Math.sin(this.t * 5.1 + this.seed) * 0.4;
        vy += Math.cos(this.t * 3.7 + this.seed * 1.7) * 0.35;
        // nicht aufeinanderhocken
        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const o = enemies[i];
                if (o === this || o.dead || !(o instanceof StarButterfly)) continue;
                const ox = mx - (o.x + o.w / 2), oy = my - (o.y + o.h / 2);
                const d2 = ox * ox + oy * oy;
                if (d2 < 784 && d2 > 0.01) {
                    const d = Math.sqrt(d2);
                    vx += (ox / d) * (1 - d / 28) * 1.2;
                    vy += (oy / d) * (1 - d / 28) * 1.2;
                }
            }
        }
        const len = Math.hypot(vx, vy);
        if (len > 1) { vx /= len; vy /= len; }
        const sp = this.speed * (this.charge > 0 ? 0.35 : 1);
        const mvx = vx * sp * dt, mvy = vy * sp * dt;
        const ox = this.x, oy = this.y;
        this._moveWithCollision(mvx, mvy, world);
        // An der Wand: Richtung wechseln statt dagegen zu drücken
        const want = Math.abs(mvx) + Math.abs(mvy);
        if (want > 0.3 && Math.abs(this.x - ox) + Math.abs(this.y - oy) < want * 0.4 && this.flipCd <= 0) {
            this.orbitDir = -this.orbitDir;
            this.wanderA += Math.PI * 0.75;
            this.flipCd = 0.7;
        }

        // Schießen
        if (this.charge > 0) {
            this.charge += dt / 0.4;
            this.flapExtra += dt * 10;
            if (this.charge >= 1) {
                this.charge = 0;
                this._shoot(projectiles, px, py);
                this.shotTimer = randRange(2.2, 3.0);
            }
        } else if (this.engaged && dist < 290) {
            this.shotTimer -= dt;
            if (this.shotTimer <= 0) {
                if (FalterKit.clearLine(world, mx, my, px, py)) {
                    this.charge = 0.001;
                    this.pattern = Math.random() < 0.45 ? 3 : 1;
                } else {
                    this.shotTimer = 0.3;   // Wand dazwischen: gleich noch mal versuchen
                }
            }
        }
    }

    _shoot(projectiles, px, py) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const sc = this.isKeyGhost ? FalterKit.GOLD : this.scheme;
        const mx = this.centerX(), my = this.centerY() - 3;
        const a = Math.atan2(py - my, px - mx);
        if (this.pattern === 3) {
            for (let i = -1; i <= 1; i++) list.push(new StardustShot(mx, my, a + i * 0.26, 108, sc.dust));
        } else {
            list.push(new StardustShot(mx, my, a, 125, sc.dust));
        }
        if (typeof FX !== 'undefined') FX.burst(mx, my - 6, [sc.dust, '#ffffff'], 5, 70, 0.3, { kind: 'star' });
    }

    // Flügelschlag 0.3 (hochgeklappt) … 1 (ausgebreitet), nur aus der Zeit abgeleitet
    _flapK(t) {
        return 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(t * 10.5 + this.seed * 3 + this.flapExtra));
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const t = Art.time;
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2 + Math.sin(t * 3.1 + this.seed) * 2.2;
        const sc = this.isKeyGhost ? FalterKit.GOLD : this.scheme;
        if (this.dead) {
            // Plopp: kurz aufblähen, dann zerfällt er zu Glitzer
            const d = clamp(this.deathProgress(), 0, 1);
            if (d >= 0.3) { this._drawGlitter(ctx, cx, cy, sc, (d - 0.3) / 0.7); return; }
            const s = 1 + d;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(s, s);
            ctx.translate(-cx, -cy);
            this._drawFigure(ctx, cx, cy, sc, t, 1);
            ctx.restore();
            return;
        }
        const ch = this.charge;
        if (ch > 0) Art.glow(ctx, cx, cy - 2, 16 + ch * 12, sc.dust, 0.2 + ch * 0.55);
        else if (this.isKeyGhost) Art.glow(ctx, cx, cy, 22, '#ffe066', 0.35);
        this._drawFigure(ctx, cx, cy, sc, t, this._flapK(t));
        if (ch > 0) this._drawGather(ctx, cx, cy, sc, ch);
        if (this.isKeyGhost) KeyGhost.drawKeyMarker(ctx, cx, pos.y - 17, this.seed);
    }

    _drawFigure(ctx, cx, cy, sc, t, k) {
        const W = FalterKit.WING_HALF * k;
        ctx.drawImage(FalterKit.wingSprite(sc), cx - W, cy - FalterKit.WING_TOP, W * 2, FalterKit.WING_H);
        // Hinterleib
        Art.body(ctx, cx, cy + 3.8, 2.7, 7.4, sc.body, { lineWidth: 1.2 });
        // Fühler mit Sternstaub-Kugeln
        const hy = cy - 6.2;
        const wob = Math.sin(t * 4 + this.seed) * 0.8;
        const lx = cx - 6 + wob, rx = cx + 6 - wob, ty = hy - 11.2;
        ctx.strokeStyle = Art.ink(sc.body);
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - 1.6, hy - 4.4);
        ctx.quadraticCurveTo(cx - 3, hy - 9.4, lx, ty);
        ctx.moveTo(cx + 1.6, hy - 4.4);
        ctx.quadraticCurveTo(cx + 3, hy - 9.4, rx, ty);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lx + 1.6, ty);
        ctx.arc(lx, ty, 1.6, 0, TAU);
        ctx.moveTo(rx + 1.6, ty);
        ctx.arc(rx, ty, 1.6, 0, TAU);
        ctx.fillStyle = sc.dust;
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Kopf mit Gesicht
        Art.body(ctx, cx, hy, 5.8, 5.3, sc.head, { lineWidth: 1.3 });
        const lk = this.look;
        Art.eyes(ctx, cx + lk.x * 0.6, hy - 0.4 + lk.y * 0.3, 2.15, { gap: 2.6, look: lk, seed: this.seed, iris: sc.iris });
        Art.mouth(ctx, cx, hy + 3.2, 2.8, this.dead || this.charge > 0.55 ? 'o' : 'smile');
        Art.blush(ctx, cx, hy + 2.1, 1.3, 3.9);
    }

    // Ankündigung: drei Funken wirbeln zum Kopf
    _drawGather(ctx, cx, cy, sc, ch) {
        const hy = cy - 8;
        for (let i = 0; i < 3; i++) {
            const a = this.seed + i * (TAU / 3) + ch * 4;
            const r = 19 * (1 - ch) + 3;
            Art.sparkle(ctx, cx + Math.cos(a) * r, hy + Math.sin(a) * r * 0.8, 1.6 + ch * 2.2, i ? '#ffffff' : sc.dust, 0.5 + ch * 0.5);
        }
    }

    // Zerfall zu Glitzer (q = 0..1): Flügelschuppen fliegen davon, weiße Funken
    _drawGlitter(ctx, cx, cy, sc, q) {
        const a0 = ctx.globalAlpha;
        Art.glow(ctx, cx, cy, 16 + q * 10, sc.dust, (1 - q) * 0.7);
        ctx.globalAlpha = a0 * (1 - q * q);
        for (let pass = 0; pass < 2; pass++) {
            ctx.fillStyle = pass ? sc.hind : sc.fore;
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = this.seed + (i + pass * 0.5) * (TAU / 4);
                const d = 4 + q * (20 + i * 2);
                const r = Math.max(0.3, 2.6 * (1 - q * 0.7));
                const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.85 - q * 4;
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fill();
        }
        for (let i = 0; i < 3; i++) {
            const a = this.seed * 2 + i * 2.1;
            const d = 3 + q * 15;
            Art.sparkle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d - q * 6, 3.4 * (1 - q) + 0.6, '#ffffff', 1);
        }
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// Sieges-Schwarm (Partikel nach dem Boss-Sieg)
// ══════════════════════════════════════════

// Wird beim Tod des Bosses in Game.particles gelegt. Wartet unsichtbar, bis der Boss nach dem epischen
// Stillstand verschwindet (main.js setzt dann deathTimer = 0), und legt dann einen frischen Schwarm ans
// Listenende (so schneidet die Partikel-Obergrenze ihn nicht ab): Glitzer fliegt nach außen, kleine
// bunte Falter flattern davon. Ohne x-Eigenschaft wird das Objekt immer gezeichnet.
class ButterflySwarm {
    constructor(boss, x, y) {
        this.boss = boss;
        this.ox = x;
        this.oy = y;
        this.dead = false;
        this.wait = 0;
        this.age = 0;
        this.bits = null;
    }

    update(dt) {
        if (!this.bits) {
            this.wait += dt;
            const b = this.boss;
            if (b && b.dead && b.deathTimer > 0 && this.wait < 5) return;
            this.dead = true;
            if (typeof Game !== 'undefined' && Game.particles) {
                const live = new ButterflySwarm(null, this.ox, this.oy);
                live._spawn();
                Game.particles.push(live);
            }
            return;
        }
        this.age += dt;
        let alive = false;
        for (const f of this.bits) {
            f.t += dt;
            if (f.t < 0 || f.t > f.life) continue;
            alive = true;
            const damp = Math.exp(-f.drag * dt);
            f.vx *= damp;
            f.vy = f.vy * damp + f.g * dt;
            f.x += f.vx * dt + (f.fly ? Math.sin(f.t * 5 + f.ph) * 26 * dt : 0);
            f.y += f.vy * dt;
        }
        if (!alive && this.age > 0.3) this.dead = true;
    }

    _spawn() {
        const cols = BossTripleButterfly.SWARM_COLORS;
        this.bits = [];
        for (let i = 0; i < 14; i++) {
            const a = -Math.PI / 2 + randRange(-1.9, 1.9);
            const sp = randRange(45, 100);
            this.bits.push({
                fly: true, x: this.ox + randRange(-55, 55), y: this.oy + randRange(-30, 25),
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 18, g: -14, drag: 0.35,
                t: -i * 0.025, life: randRange(1.9, 2.7), ph: Math.random() * TAU,
                col: cols[i % cols.length], s: randRange(0.85, 1.35),
            });
        }
        for (let i = 0; i < 18; i++) {
            const a = Math.random() * TAU;
            const sp = randRange(70, 180);
            this.bits.push({
                fly: false, x: this.ox + Math.cos(a) * 20, y: this.oy + Math.sin(a) * 14,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, g: 50, drag: 2.3,
                t: 0, life: randRange(0.7, 1.3), ph: Math.random() * TAU,
                col: i % 3 ? cols[i % cols.length] : '#ffffff', s: randRange(2.2, 3.8),
            });
        }
    }

    draw(ctx, camera) {
        if (!this.bits) return;
        const a0 = ctx.globalAlpha;
        const t = Art.time;
        for (const f of this.bits) {
            if (f.t < 0 || f.t > f.life) continue;
            const p = camera.worldToScreen(f.x, f.y);
            ctx.globalAlpha = a0 * Math.min(1, (f.life - f.t) / 0.5);
            if (f.fly) FalterKit.tiny(ctx, p.x, p.y, f.s, f.col, t * 15 + f.ph);
            else Art.sparkle(ctx, p.x, p.y, f.s * (0.6 + 0.4 * Math.sin(f.t * 18 + f.ph)), f.col, 1);
        }
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// Boss: Drei-Kopf-Schmetterling
// ══════════════════════════════════════════

// Riesiger Falter mit drei Köpfen auf einem Körper: blau (verschlafen, Zipfelmütze), rosa (fröhlich),
// gold (grummelig, Krone). Schwebt mit Wand-Kollision im Boss-Raum und hält Abstand zu Mark.
// Angriffe im Wechsel (Bossuhr, main.js lässt sie 1,15-mal schneller laufen):
//  a) Sternstaub-Sturm: alle Köpfe laden 1,05 s auf (Leuchten, wirbelnde Funken, Bodenzeichen), dann
//     • Ringe: 3 Ringe × 24 Sterne (33 Plätze, drei Lücken à 3 Plätze, grün markiert), alle 0,42 s
//     • oder Dreifach-Spirale: 6 Arme (je Kopf zwei) mit Lücken, drehen 2 s lang; Pfeile zeigen die Drehung
//  b) Kopf-Salven: rosa Fächer aus 3, blaue Wellen-Schlange aus 5, goldener Riesenstern, der in 8 zerplatzt
//  c) Glitzer-Regen: 6 rote Markierungen (eine unter Mark), 1,2 s später fallen Sterne darauf
// Phase 2 ab halber Lebensenergie: kurzes Aufwachen (0,85 s, verwundbar), der blaue Kopf verliert die
// Mütze, alle Köpfe werden wütend; Ringe 4 × 27, Spirale 2,4 s, Salven 5er-Fächer, 8er-Welle,
// 3 Riesensterne, Regen in zwei Wellen à 8. Nach jedem Sturm eine Verschnaufpause.
class BossTripleButterfly extends Enemy {
    constructor(x, y) {
        super(x, y, 70, 56);
        this.hp = 100;
        this.maxHp = 100;
        this.speed = 48;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.flying = true;
        this.shadow = { rx: 46, ry: 12, dy: 48, alpha: 0.2 };
        this.fxColor = '#ff7ad9';
        this.seed = Math.random() * 10;
        this.t = 0;
        this.look = { x: 0, y: 1 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 0.9;
        this.stateMax = 0.9;
        this.cycle = 0;
        this.stormVariant = 0;          // gerade = Ringe, ungerade = Spirale
        this.stormKind = 'rings';
        this.vx = 0;
        this.vy = 0;
        this.tx = null;
        this.ty = null;
        this.retarget = 0;
        this.flapExtra = 0;
        this.hc = [0, 0, 0];            // Aufladen je Kopf 0..1 (Darstellung)
        this.hf = [0, 0, 0];            // Schuss-Rückstoß je Kopf (Sekunden, Darstellung)
        this.awakeT = 0;                // Zeit seit dem Aufwachen (Phase 2)
        this.laneFade = 0;              // Gassen nach dem letzten Ring ausblenden
        this.rainShots = [];
        this.rainWave = 0;
        this.gapA = 0;
        this.ringN = 33;
        this.ringsTotal = 3;
        this.ringsFired = 0;
        this.ringGap = 0.42;
        this.ringSpeed = 100;
        this.spinA = 0;
        this.spinDir = 1;
        this.spinW = 1.05;
        this.emitT = 0;
        this.emitGap = 0.11;
        this.emitN = 0;
        this.salvoOrder = BossTripleButterfly.ORDERS[0];
        this.salvoStep = 0;
        this.salvoPart = 'charge';
        this.streamLeft = 0;
        this.streamT = 0;
        this.streamGap = 0.1;
        this.streamA = 0;
        this._room = null;
        this._orig = { x: 0, y: 0 };
    }

    // Innenraum des Boss-Raums (nur im Spiel bekannt, sonst null).
    static room(world) {
        if (typeof Game === 'undefined' || Game.world !== world || !Game.bossActive || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    takeDamage(amount, knockbackAngle, knockbackForce) {
        const wasDead = this.dead;
        // Großer schwebender Falter: nur leichter Rückstoß. Schaden und Zähigkeit regelt Enemy.takeDamage.
        super.takeDamage(amount, knockbackAngle, knockbackForce ? knockbackForce * 0.3 : knockbackForce);
        if (!wasDead && this.dead && typeof Game !== 'undefined' && Game.particles) {
            Game.particles.push(new ButterflySwarm(this, this.centerX(), this.centerY() - 8));
        }
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (!this._room) this._room = BossTripleButterfly.room(world);
        if (this.homeX === undefined) {
            this.homeX = this.centerX();
            this.homeY = this.centerY();
        }
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const mx = this.centerX(), my = this.centerY();
        const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
        this.aimX = pcx;                // für die Ziel-Vorwarnung (nur Darstellung)
        this.aimY = pcy;
        const dx = pcx - mx, dy = pcy - my;
        const dist = Math.hypot(dx, dy) || 1;
        const lk = 1 - Math.exp(-7 * dt);
        this.look.x += (dx / dist - this.look.x) * lk;
        this.look.y += (dy / dist - this.look.y) * lk;
        for (let i = 0; i < 3; i++) {
            this.hc[i] = Math.max(0, this.hc[i] - dt * 3);
            this.hf[i] = Math.max(0, this.hf[i] - dt);
        }
        if (this.phase === 2) this.awakeT += dt;
        if (this.laneFade > 0) this.laneFade -= dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this._startAwaken();
        this.flapExtra += dt * this._flapBoost();
        this._drift(dt, world, pcx, pcy, dist);
        if (!list) return;

        switch (this.state) {
            case 'intro':
                this.stateT -= dt;
                if (this.stateT <= 0) this._toRest(0.35);
                break;
            case 'rest':
                this.stateT -= dt;
                if (this.stateT <= 0) this._startAttack(list, pcx, pcy);
                break;
            case 'toCenter':
                // vor dem Sturm in die Raummitte fliegen (dort haben die Sterne den meisten Platz)
                this.stateT -= dt;
                if (this.stateT <= 0 || Math.hypot(this.tx - mx, this.ty - my) < 10) this._startStorm(pcx, pcy);
                break;
            case 'awaken':
                this.stateT -= dt;
                for (let i = 0; i < 3; i++) this.hc[i] = Math.max(this.hc[i], 0.7);
                if (this.stateT <= 0) {
                    this.cycle = 0;             // nach dem Aufwachen sofort ein Sturm
                    this._startAttack(list, pcx, pcy);
                }
                break;
            case 'stormCharge': {
                this.stateT -= dt;
                const k = 1 - Math.max(0, this.stateT) / this.stateMax;
                for (let i = 0; i < 3; i++) this.hc[i] = Math.max(this.hc[i], k);
                if (this.stateT <= 0) this._releaseStorm(mx, my);
                break;
            }
            case 'rings':
                for (let i = 0; i < 3; i++) this.hc[i] = 1;
                this.stateT -= dt;
                if (this.stateT <= 0) {
                    this._fireRing(list, mx, my);
                    this.ringsFired++;
                    if (this.ringsFired >= this.ringsTotal) {
                        this._toRest(this.phase === 2 ? 1.15 : 1.5);
                        this.laneFade = 1;      // Gassen noch kurz zeigen, die Ringe fliegen ja weiter
                    } else {
                        this.stateT += this.ringGap;
                    }
                }
                break;
            case 'spiral':
                for (let i = 0; i < 3; i++) this.hc[i] = 1;
                this.stateT -= dt;
                this.spinA += this.spinDir * this.spinW * dt;
                this.emitT -= dt;
                while (this.emitT <= 0 && this.stateT > 0) {
                    this._emitSpiral(list, mx, my);
                    this.emitT += this.emitGap;
                }
                if (this.stateT <= 0) this._toRest(this.phase === 2 ? 1.15 : 1.5);
                break;
            case 'salvo':
                this._updateSalvo(dt, list, pcx, pcy);
                break;
            case 'rain':
                this._updateRain(dt, list, pcx, pcy);
                break;
        }
    }

    // ── Bewegung ──

    // Schweben: Ziel im Raum mit etwa 125 Einheiten Abstand zu Mark, lieber in der oberen Raumhälfte.
    // Beim Sturm steht er still in der Luft, damit Lücken und Bodenzeichen genau passen.
    _drift(dt, world, pcx, pcy, dist) {
        const st = this.state;
        const still = st === 'stormCharge' || st === 'rings' || st === 'spiral' || st === 'awaken';
        const rush = st === 'toCenter';
        this.retarget -= dt;
        if (!rush && (this.tx === null || this.retarget <= 0 || (dist < 75 && this.retarget < 1.2))) this._pickTarget(pcx, pcy);
        let wx = 0, wy = 0;
        if (!still) {
            const ddx = this.tx - this.centerX(), ddy = this.ty - this.centerY();
            const dd = Math.hypot(ddx, ddy);
            const relaxed = st === 'rest' || st === 'intro';
            const sp = Math.min(this.speed * (this.phase === 2 ? 1.25 : 1) * (rush ? 2 : (relaxed ? 1 : 0.55)), dd * 3);
            if (dd > 1) {
                wx = (ddx / dd) * sp;
                wy = (ddy / dd) * sp;
            }
        }
        const k = 1 - Math.exp(-(still ? 8 : 3) * dt);
        this.vx += (wx - this.vx) * k;
        this.vy += (wy - this.vy) * k;
        const fl = still ? 0 : 1;
        const fx = Math.sin(this.t * 1.9 + this.seed) * 9 * fl;
        const fy = Math.cos(this.t * 2.6 + this.seed) * 7 * fl;
        this._moveWithCollision((this.vx + fx) * dt, (this.vy + fy) * dt, world);
    }

    _pickTarget(pcx, pcy) {
        const r = this._room;
        const cx = this.centerX(), cy = this.centerY();
        let bx = cx, by = cy, best = -Infinity;
        for (let i = 0; i < 7; i++) {
            const a = Math.random() * TAU;
            const d = randRange(100, 150);
            let x = pcx + Math.cos(a) * d, y = pcy + Math.sin(a) * d;
            if (r) {
                x = clamp(x, r.x + 46, r.x + r.w - 46);
                y = clamp(y, r.y + 72, r.y + r.h - 44);
            } else {
                x = clamp(x, this.homeX - 80, this.homeX + 80);
                y = clamp(y, this.homeY - 50, this.homeY + 50);
            }
            let score = -Math.abs(Math.hypot(x - pcx, y - pcy) - 125) - Math.hypot(x - cx, y - cy) * 0.12;
            if (r) score -= Math.max(0, y - (r.y + r.h * 0.6)) * 0.4;
            if (score > best) { best = score; bx = x; by = y; }
        }
        this.tx = bx;
        this.ty = by;
        this.retarget = randRange(1.8, 2.6);
    }

    _flapBoost() {
        switch (this.state) {
            case 'stormCharge': return 6;
            case 'rings': case 'spiral': return 4;
            case 'rain': case 'toCenter': return 5;
            case 'awaken': return 7;
            default: return 0;
        }
    }

    // ── Angriffe ──

    _toRest(time) {
        this.state = 'rest';
        this.stateT = time;
        this.stateMax = time;
    }

    _startAttack(list, pcx, pcy) {
        const kind = BossTripleButterfly.CYCLE[this.cycle % BossTripleButterfly.CYCLE.length];
        this.cycle++;
        if (kind === 'storm') this._startCenter(pcx, pcy);
        else if (kind === 'salvo') this._startSalvo();
        else this._startRain(list, pcx, pcy);
    }

    // Sturm-Anflug: Platz nahe der Raummitte, aber mindestens ~120 Einheiten von Mark weg
    _startCenter(pcx, pcy) {
        const r = this._room;
        const mx = r ? r.x + r.w / 2 : this.homeX, my = r ? r.y + r.h / 2 + 6 : this.homeY;
        let bx = mx, by = my, best = -Infinity;
        const C = BossTripleButterfly.CENTER_SPOTS;
        for (let i = 0; i < C.length; i += 2) {
            const x = mx + C[i], y = my + C[i + 1];
            const score = Math.min(Math.hypot(x - pcx, y - pcy), 120) - 0.4 * Math.hypot(C[i], C[i + 1]);
            if (score > best) { best = score; bx = x; by = y; }
        }
        this.tx = bx;
        this.ty = by;
        this.state = 'toCenter';
        this.stateT = this.stateMax = 1.3;
        if (Math.hypot(bx - this.centerX(), by - this.centerY()) < 10) this._startStorm(pcx, pcy);
    }

    _startAwaken() {
        this.phase = 2;
        this.awakeT = 0;
        this.state = 'awaken';
        this.stateT = 0.85;
        this.stateMax = 0.85;
        this.streamLeft = 0;
        FalterKit.shake(5, 0.35);
        if (typeof FX !== 'undefined') {
            const x = this.centerX(), y = this.centerY() - 20;
            FX.burst(x, y, ['#ff4fb0', '#ffd23f', '#4cc9f0', '#ffffff'], 16, 190, 0.6, { kind: 'star' });
            FX.ring(x, y, '#ff9ae6', 90, 0.5, 4);
        }
    }

    // Sternstaub-Sturm: Aufladen
    _startStorm(pcx, pcy) {
        const p2 = this.phase === 2;
        this.state = 'stormCharge';
        this.stateT = this.stateMax = p2 ? 0.95 : 1.05;
        this.stormKind = this.stormVariant % 2 === 0 ? 'rings' : 'spiral';
        this.stormVariant++;
        // Lücken so legen, dass Mark ein kleines Stück laufen muss (die nächste liegt 20–50° neben ihm)
        const toMark = Math.atan2(pcy - (this.centerY() - 4), pcx - this.centerX());
        this.gapA = toMark + (Math.random() < 0.5 ? -1 : 1) * randRange(0.35, 0.9);
        this.spinDir = Math.random() < 0.5 ? -1 : 1;
    }

    // Sternstaub-Sturm: loslassen
    _releaseStorm(mx, my) {
        const p2 = this.phase === 2;
        if (this.stormKind === 'rings') {
            this.state = 'rings';
            this.ringN = p2 ? 36 : 33;
            this.ringsTotal = p2 ? 4 : 3;
            this.ringGap = p2 ? 0.34 : 0.42;
            this.ringSpeed = p2 ? 112 : 100;
            this.ringsFired = 0;
            this.stateT = 0;
        } else {
            this.state = 'spiral';
            this.stateT = this.stateMax = p2 ? 2.4 : 2.0;
            this.spinA = this.gapA;
            this.spinW = p2 ? 1.2 : 1.05;
            this.emitGap = p2 ? 0.09 : 0.1;
            this.emitT = 0;
            this.emitN = 0;
        }
        FalterKit.shake(3, 0.3);
        if (typeof FX !== 'undefined') {
            FX.burst(mx, my - 10, ['#ff4fb0', '#ffd23f', '#4cc9f0', '#ffffff'], 14, 200, 0.5, { kind: 'star' });
            FX.ring(mx, my - 4, '#fff6a8', 70, 0.35, 4);
        }
    }

    // Ein Ring: N Plätze, an drei Stellen (gapA + k·120°) je drei Plätze frei
    _fireRing(list, mx, my) {
        const N = this.ringN;
        const third = N / 3;
        if (FalterKit.liveBossShots(list) + N - 9 > FalterKit.BOSS_CAP) return;
        const col = BossTripleButterfly.HEADS[(this.ringsFired + 1) % 3].dust;
        const oy = my - 4;
        this.laneX = mx;                // Ursprung merken (Gassen bleiben dort, wenn er weiterfliegt)
        this.laneY = oy;
        for (let i = 0; i < N; i++) {
            const m = i % third;
            if (m <= 1 || m >= third - 1) continue;
            const a = this.gapA + (i * TAU) / N;
            list.push(new StardustShot(mx + Math.cos(a) * 26, oy + Math.sin(a) * 26, a, this.ringSpeed, col, { boss: true, life: 3.4, size: 7.2 }));
        }
        this.hf[0] = this.hf[1] = this.hf[2] = 0.2;
        if (typeof FX !== 'undefined') FX.burst(mx, oy, [col, '#ffffff'], 6, 150, 0.3, { kind: 'star' });
    }

    // Spirale: 6 Arme (Kopf i → Arme i und i+3), jeder Arm 3 Sterne an, 3 aus (Lücken zum Durchschlüpfen)
    _emitSpiral(list, mx, my) {
        const oy = my - 4;
        const n = this.emitN++;
        let live = FalterKit.liveBossShots(list);
        const speed = this.phase === 2 ? 102 : 92;
        for (let j = 0; j < 6; j++) {
            if ((n + j * 3) % 6 >= 3) continue;
            if (live >= FalterKit.BOSS_CAP) break;
            const a = this.spinA + (j * TAU) / 6;
            const col = BossTripleButterfly.HEADS[j % 3].dust;
            list.push(new StardustShot(mx + Math.cos(a) * 26, oy + Math.sin(a) * 26, a, speed, col, { boss: true, life: 3.4, size: 7.2 }));
            live++;
        }
    }

    // Kopf-Salven: die Köpfe laden nacheinander auf und schießen ihr eigenes Muster
    _startSalvo() {
        const p2 = this.phase === 2;
        this.state = 'salvo';
        this.salvoStep = 0;
        this.salvoPart = 'charge';
        this.salvoOrder = p2 ? BossTripleButterfly.ORDERS[Math.floor(Math.random() * BossTripleButterfly.ORDERS.length)] : BossTripleButterfly.ORDERS[0];
        this.stateT = this.stateMax = p2 ? 0.4 : 0.5;
    }

    _updateSalvo(dt, list, pcx, pcy) {
        const p2 = this.phase === 2;
        const h = this.salvoOrder[this.salvoStep];
        this.stateT -= dt;
        if (this.salvoPart === 'charge') {
            this.hc[h] = Math.max(this.hc[h], 1 - Math.max(0, this.stateT) / this.stateMax);
            if (this.stateT <= 0) {
                this._headShot(h, list, pcx, pcy);
                this.salvoPart = 'pause';
                this.stateT = this.stateMax = (p2 ? 0.22 : 0.32) + this.streamLeft * this.streamGap;
            }
            return;
        }
        if (this.streamLeft > 0) {
            this.streamT -= dt;
            while (this.streamT <= 0 && this.streamLeft > 0) {
                this._streamStar(list);
                this.streamT += this.streamGap;
            }
        }
        if (this.stateT <= 0) {
            this.salvoStep++;
            if (this.salvoStep >= 3) {
                this.streamLeft = 0;
                this._toRest(p2 ? 0.9 : 1.25);
            } else {
                this.salvoPart = 'charge';
                this.stateT = this.stateMax = p2 ? 0.4 : 0.5;
            }
        }
    }

    // Mundposition eines Kopfes in Weltkoordinaten, in die Hitbox geklemmt (nie in einer Wand)
    _headOrigin(h) {
        const H = BossTripleButterfly.HEADS[h];
        const o = this._orig;
        o.x = clamp(this.centerX() + H.x, this.x + 4, this.x + this.w - 4);
        o.y = clamp(this.centerY() - 4 + H.y + H.r * 0.4, this.y + 4, this.y + this.h - 4);
        return o;
    }

    _headShot(h, list, pcx, pcy) {
        const p2 = this.phase === 2;
        const H = BossTripleButterfly.HEADS[h];
        const o = this._headOrigin(h);
        const ox = o.x, oy = o.y;
        const a = Math.atan2(pcy - oy, pcx - ox);
        const live = FalterKit.liveBossShots(list);
        this.hf[h] = 0.3;
        if (h === 1) {
            // rosa: gezielter Fächer
            const n = p2 ? 5 : 3, spread = p2 ? 0.17 : 0.22, sp = p2 ? 148 : 138;
            for (let i = 0; i < n && live + i < FalterKit.BOSS_CAP; i++) {
                list.push(new StardustShot(ox, oy, a + (i - (n - 1) / 2) * spread, sp, H.dust, { boss: true }));
            }
        } else if (h === 0) {
            // blau: Wellen-Schlange (verschlafen langsam, wach schnell und länger)
            this.streamLeft = p2 ? 8 : 5;
            this.streamGap = p2 ? 0.08 : 0.1;
            this.streamT = 0;
            this.streamA = a;
        } else {
            // gold: große langsame Sterne, die zerplatzen
            const n = p2 ? 3 : 1;
            const k = p2 ? 7 : 8;
            for (let i = 0; i < n && live + (i + 1) * (k + 1) <= FalterKit.BOSS_CAP; i++) {
                list.push(new StardustShot(ox, oy, a + (i - (n - 1) / 2) * 0.45, 70, H.dust, {
                    boss: true, radius: 7, size: 10, life: 3,
                    split: { at: p2 ? 0.95 : 1.05, n: k, speed: p2 ? 112 : 104 },
                }));
            }
        }
        if (typeof FX !== 'undefined') FX.burst(ox, oy, [H.dust, '#ffffff'], 6, 100, 0.3, { kind: 'star' });
    }

    _streamStar(list) {
        this.streamLeft--;
        if (FalterKit.liveBossShots(list) >= FalterKit.BOSS_CAP) return;
        const p2 = this.phase === 2;
        const o = this._headOrigin(0);
        list.push(new StardustShot(o.x, o.y, this.streamA, p2 ? 112 : 88, BossTripleButterfly.HEADS[0].dust,
            { boss: true, wave: p2 ? 20 : 15, waveFreq: p2 ? 7 : 6, life: 3.4 }));
        this.hf[0] = Math.max(this.hf[0], 0.12);
    }

    // Glitzer-Regen: Markierungen am Boden (eine unter Mark, zwei in seiner Nähe), dann fallen Sterne
    _startRain(list, pcx, pcy) {
        this.state = 'rain';
        this.stateT = 0;
        this.rainWave = 0;
        this.rainShots.length = 0;
        this._rainWave(list, pcx, pcy);
    }

    _rainWave(list, pcx, pcy) {
        this.rainWave++;
        const p2 = this.phase === 2;
        const n = p2 ? 8 : 6;
        const fall = p2 ? 1.05 : 1.2;
        const r = this._room;
        const minX = r ? r.x + 18 : this.homeX - 150, maxX = r ? r.x + r.w - 18 : this.homeX + 150;
        const minY = r ? r.y + 18 : this.homeY - 110, maxY = r ? r.y + r.h - 18 : this.homeY + 110;
        const pts = this._rainPts || (this._rainPts = []);
        pts.length = 0;
        for (let i = 0; i < n; i++) {
            let x = pcx, y = pcy;
            for (let tries = 0; tries < 14; tries++) {
                if (i === 0) { x = pcx; y = pcy; }
                else if (i < 3) {
                    const a = Math.random() * TAU, d = randRange(48, 95);
                    x = pcx + Math.cos(a) * d;
                    y = pcy + Math.sin(a) * d;
                } else {
                    x = randRange(minX, maxX);
                    y = randRange(minY, maxY);
                }
                x = clamp(x, minX, maxX);
                y = clamp(y, minY, maxY);
                let ok = true;
                for (let j = 0; j < pts.length; j += 2) {
                    if (Math.hypot(pts[j] - x, pts[j + 1] - y) < 46) { ok = false; break; }
                }
                if (ok || i === 0) break;
            }
            pts.push(x, y);
            if (FalterKit.liveBossShots(list) >= FalterKit.BOSS_CAP) continue;
            const s = new StardustShot(x, y, 0, 0, '#ffe066', { boss: true, fall: fall + i * 0.07, radius: 8, size: 8 });
            list.push(s);
            this.rainShots.push(s);
        }
        this.hf[0] = this.hf[1] = this.hf[2] = 0.25;
        if (typeof FX !== 'undefined') {
            FX.burst(this.centerX(), this.centerY() - 20, ['#ffe066', '#ffffff', '#ff9ae6'], 12, 150, 0.6, { kind: 'star', gravity: -60 });
        }
    }

    _updateRain(dt, list, pcx, pcy) {
        this.stateT += dt;
        if (this.phase === 2 && this.rainWave === 1 && this.stateT >= 0.65) this._rainWave(list, pcx, pcy);
        let busy = false;
        for (const s of this.rainShots) {
            if (!s.dead) { busy = true; break; }
        }
        if (!busy && this.stateT > 0.3) this._toRest(this.phase === 2 ? 0.8 : 1.1);
    }

    // ── Zeichnen ──

    // Bodenzeichen unter allen Figuren: Sturm-Gassen, Drehpfeile, Regen-Markierungen
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const lanesAfter = st === 'rest' && this.laneFade > 0 && this.stormKind === 'rings';
        if (st === 'stormCharge' || st === 'rings' || st === 'spiral' || lanesAfter) {
            const c = lanesAfter ? camera.worldToScreen(this.laneX, this.laneY) : camera.worldToScreen(this.centerX(), this.centerY() - 4);
            const k = st === 'stormCharge' ? 1 - Math.max(0, this.stateT) / this.stateMax : 1;
            // Bodenzeichen nur im Boss-Raum (nicht über die Wände malen)
            const r = this._room;
            ctx.save();
            if (r) {
                const tl = camera.worldToScreen(r.x, r.y);
                ctx.beginPath();
                ctx.rect(tl.x, tl.y, r.w, r.h);
                ctx.clip();
            }
            if (this.stormKind === 'rings') {
                let fade = st === 'rings' ? 1 - (this.ringsFired / this.ringsTotal) * 0.5 : 1;
                if (lanesAfter) fade = 0.5 * Math.max(0, this.laneFade);
                this._drawLanes(ctx, c.x, c.y, k, fade);
            } else {
                const fade = st === 'spiral' ? Math.min(1, this.stateT / 0.5) : 1;
                this._drawSpinArrows(ctx, c.x, c.y, k, fade);
            }
            ctx.restore();
        }
        if (st === 'salvo' && this.salvoPart === 'charge' && this.aimX !== undefined) this._drawAim(ctx, camera);
        for (const s of this.rainShots) {
            if (s.dead || s.mode !== 'fall') continue;
            const p = camera.worldToScreen(s.x, s.y);
            LateWorldArt.warn(ctx, p.x, p.y, 22, 1 - s.fall / s.fallMax);
        }
    }

    // Kopf-Salve: Ziellinien vom aufladenden Kopf zu Mark (Anzahl und Fächer wie der Schuss)
    _drawAim(ctx, camera) {
        const h = this.salvoOrder[this.salvoStep];
        const k = 1 - Math.max(0, this.stateT) / this.stateMax;
        const o = this._headOrigin(h);
        const p = camera.worldToScreen(o.x, o.y);
        const a = Math.atan2(this.aimY - o.y, this.aimX - o.x);
        const p2 = this.phase === 2;
        const n = h === 1 ? (p2 ? 5 : 3) : (h === 2 ? (p2 ? 3 : 1) : 1);
        const spread = h === 1 ? (p2 ? 0.17 : 0.22) : 0.45;
        const len = 40 + 70 * k;
        const a0 = ctx.globalAlpha;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const ai = a + (i - (n - 1) / 2) * spread;
            const c = Math.cos(ai), s = Math.sin(ai);
            ctx.moveTo(p.x + c * 30, p.y + s * 30);
            if (h === 0) {
                // blaue Welle: geschlängelte Linie
                for (let d = 30; d <= len; d += 6) {
                    const w = Math.sin(d * 0.12) * 7;
                    ctx.lineTo(p.x + c * d - s * w, p.y + s * d + c * w);
                }
            } else {
                ctx.lineTo(p.x + c * len, p.y + s * len);
            }
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = BossTripleButterfly.HEADS[h].dust;
        ctx.lineWidth = h === 2 ? 4.5 : 3;
        ctx.globalAlpha = a0 * (0.25 + 0.5 * k);
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    // Gefahrenring und drei grüne Gassen (die Lücken der Ringe) mit Pfeilen nach außen
    _drawLanes(ctx, x, y, k, fade) {
        const a0 = ctx.globalAlpha;
        const w = (1.5 * TAU) / this.ringN;      // halbe Gassenbreite (Winkel)
        const r0 = 30, r1 = 250;
        // Gefahrenring
        ctx.globalAlpha = a0 * (0.35 + 0.25 * Math.sin(Art.time * 14)) * fade;
        ctx.strokeStyle = '#ff4f9a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 24 + 46 * k, 0, TAU);
        ctx.stroke();
        // Gassen
        ctx.beginPath();
        for (let j = 0; j < 3; j++) {
            const a = this.gapA + (j * TAU) / 3;
            ctx.moveTo(x + Math.cos(a - w) * r0, y + Math.sin(a - w) * r0);
            ctx.arc(x, y, r1, a - w, a + w);
            ctx.arc(x, y, r0, a + w, a - w, true);
            ctx.closePath();
        }
        ctx.fillStyle = '#6dffb0';
        ctx.globalAlpha = a0 * (0.1 + 0.14 * k) * fade;
        ctx.fill();
        ctx.strokeStyle = '#d9ffe9';
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = a0 * (0.3 + 0.35 * k) * fade;
        ctx.stroke();
        // Pfeile wandern nach außen
        ctx.beginPath();
        const off = (Art.time * 60) % 40;
        for (let j = 0; j < 3; j++) {
            const a = this.gapA + (j * TAU) / 3;
            const ca = Math.cos(a), sa = Math.sin(a);
            for (let i = 0; i < 4; i++) {
                const d = 46 + off + i * 40;
                const px = x + ca * d, py = y + sa * d;
                ctx.moveTo(px - ca * 6 - sa * 6, py - sa * 6 + ca * 6);
                ctx.lineTo(px, py);
                ctx.lineTo(px - ca * 6 + sa * 6, py - sa * 6 - ca * 6);
            }
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = a0 * (0.35 + 0.45 * k) * fade;
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    // Drei gebogene Pfeile zeigen, in welche Richtung sich die Spirale dreht
    _drawSpinArrows(ctx, x, y, k, fade) {
        const a0 = ctx.globalAlpha;
        const dir = this.spinDir;
        const rot = this.state === 'spiral' ? this.spinA : this.gapA + dir * Art.time * 1.2;
        const R = 62;
        ctx.beginPath();
        for (let j = 0; j < 3; j++) {
            const s = rot + (j * TAU) / 3;
            const e = s + dir * 1.25;
            ctx.moveTo(x + Math.cos(s) * R, y + Math.sin(s) * R);
            ctx.arc(x, y, R, s, e, dir < 0);
            const ex = x + Math.cos(e) * R, ey = y + Math.sin(e) * R;
            const tx = -Math.sin(e) * dir, ty = Math.cos(e) * dir;     // Tangente in Drehrichtung
            const nx = Math.cos(e), ny = Math.sin(e);
            ctx.moveTo(ex - tx * 9 + nx * 7, ey - ty * 9 + ny * 7);
            ctx.lineTo(ex, ey);
            ctx.lineTo(ex - tx * 9 - nx * 7, ey - ty * 9 - ny * 7);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#ff4f9a';
        ctx.lineWidth = 6;
        ctx.globalAlpha = a0 * 0.3 * fade;
        ctx.stroke();
        ctx.strokeStyle = '#fff3a0';
        ctx.lineWidth = 2.6;
        ctx.globalAlpha = a0 * (0.4 + 0.45 * k) * fade;
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    // Deckkraft der Flügel: steht Mark dahinter (wird vorher gezeichnet), werden sie durchsichtig
    _wingAlpha() {
        const pl = typeof Game !== 'undefined' ? Game.player : null;
        if (!pl || pl.dead || this.dead) return 1;
        if (pl.y + pl.h >= this.y + this.h) return 1;
        const dx = Math.abs(pl.x + pl.w / 2 - this.centerX());
        const dy = pl.y + pl.h / 2 - (this.centerY() - 12);
        if (dx > 84 || dy < -70 || dy > 50) return 1;
        return 0.5;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const dead = this.dead;
        const dp = dead ? clamp(this.deathProgress(), 0, 1) : 0;
        const p2 = this.phase === 2 || this.hp <= this.maxHp / 2;
        const st = this.state;
        const a0 = ctx.globalAlpha;
        ctx.save();
        if (dead) {
            // Siegesmoment: zittert im Stillstand; läuft die Todesuhr, zerfällt er zu Glitzer und Faltern
            ctx.translate(cx + Math.sin(t * 47) * 1.6, cy);
            ctx.rotate(Math.sin(t * 31) * 0.025);
            ctx.translate(-cx, -cy);
            if (dp > 0) this._drawDissolve(ctx, cx, cy - 4, dp, t);
            ctx.globalAlpha = a0 * (1 - dp);
        }
        const bob = dead ? 0 : Math.sin(t * 2.2 + this.seed) * 3;
        const by = cy - 4 + bob;
        const charge = !dead && st === 'stormCharge' ? 1 - Math.max(0, this.stateT) / this.stateMax : 0;
        const storming = !dead && (st === 'rings' || st === 'spiral');
        let k;
        if (dead) k = 0.92 + Math.sin(t * 40) * 0.03;
        else if (charge > 0) k = 1.04 + Math.sin(t * 50) * 0.03 * charge;
        else k = 0.82 + 0.18 * Math.cos(t * 6.5 + this.seed + this.flapExtra);
        // Leuchten hinter den Flügeln
        if (charge > 0 || storming) Art.glow(ctx, cx, by - 18, 76 + 30 * charge, '#ff9ae6', 0.25 + 0.35 * (storming ? 1 : charge));
        else if (p2 && !dead) Art.glow(ctx, cx, by - 18, 80, '#ff5aa8', 0.16 + 0.08 * Math.sin(t * 5));
        const aw = this._wingAlpha();
        if (aw < 1) ctx.globalAlpha *= aw;
        this._drawWings(ctx, cx, by, k, p2);
        if (aw < 1) ctx.globalAlpha /= aw;
        this._drawTorso(ctx, cx, by, p2);
        // Köpfe: außen zuerst, der große Mittelkopf zuletzt
        for (const i of BossTripleButterfly.DRAW_ORDER) this._drawHead(ctx, i, cx, by, t, p2, dead);
        if (charge > 0) this._drawSwirl(ctx, cx, by - 12, charge, t);
        if (!dead && st === 'rain') this._drawWingDust(ctx, cx, by, t);
        if (dead && dp === 0) this._drawDefeatSparkles(ctx, cx, by, t);
        ctx.restore();
    }

    // Vier Flügel aus je drei Schichten (Rand, Fläche, Band), dazu Augenflecken und Tupfen
    _drawWings(ctx, cx, by, k, p2) {
        const C = p2 ? BossTripleButterfly.WING2 : BossTripleButterfly.WING1;
        const HI = BossTripleButterfly.HIND, FO = BossTripleButterfly.FORE;
        const kh = 0.86 + 0.14 * k;             // Hinterflügel schlagen etwas weniger
        this._wingLayers(ctx, cx, by, kh, HI, C.hindRim, C.hind, C.hindBand, 0.82, 0.48, { x: cx - 48 * kh, y: by, w: 96 * kh, h: 44 });
        // Augenflecken auf den Hinterflügeln
        const ex = HI[0] + 23, ey = by + HI[1] + 19;
        for (let layer = 0; layer < 3; layer++) {
            const r = layer === 0 ? 7.8 : (layer === 1 ? 5.4 : 2.2);
            ctx.beginPath();
            for (let side = -1; side <= 1; side += 2) {
                const x = cx + side * kh * ex;
                ctx.moveTo(x + r * kh, ey);
                ctx.ellipse(x, ey, r * kh, r, 0, 0, TAU);
            }
            ctx.fillStyle = layer === 0 ? C.spotRing : (layer === 1 ? C.spot : '#ffffff');
            ctx.fill();
        }
        this._wingLayers(ctx, cx, by, k, FO, C.foreRim, C.fore, C.foreBand, 0.86, 0.52, { x: cx - 76 * k, y: by - 66, w: 152 * k, h: 70 });
        // Tupfen im dunklen Vorderrand
        const D = BossTripleButterfly.FORE_DOTS;
        ctx.beginPath();
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < D.length; i += 3) {
                const x = cx + side * k * (FO[0] + D[i]), y = by + FO[1] + D[i + 1], r = D[i + 2];
                ctx.moveTo(x + r * k, y);
                ctx.ellipse(x, y, r * k, r, 0, 0, TAU);
            }
        }
        ctx.fillStyle = C.dot;
        ctx.fill();
        // Glanz auf den Vorderflügeln
        Art.shine(ctx, cx - k * 40, by - 50, 10 * k, 3.4, -0.35, 0.32);
        Art.shine(ctx, cx + k * 38, by - 50, 8 * k, 2.8, 0.35, 0.22);
    }

    _wingLayers(ctx, cx, by, k, F, rim, base, band, sBase, sBand, bbox) {
        const wp = BossTripleButterfly.wingPath;
        ctx.beginPath();
        wp(ctx, cx, by, 1, k, 1, F);
        wp(ctx, cx, by, -1, k, 1, F);
        ctx.fillStyle = rim;
        ctx.fill();
        Art.shape(ctx, c => { wp(c, cx, by, 1, k, sBase, F); wp(c, cx, by, -1, k, sBase, F); }, bbox, base, { outline: false, linear: true });
        ctx.beginPath();
        wp(ctx, cx, by, 1, k, sBand, F);
        wp(ctx, cx, by, -1, k, sBand, F);
        ctx.fillStyle = band;
        ctx.fill();
        ctx.beginPath();
        wp(ctx, cx, by, 1, k, 1, F);
        wp(ctx, cx, by, -1, k, 1, F);
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = Art.ink(rim);
        ctx.stroke();
    }

    // Brust (flauschig) und geringelter Hinterleib
    _drawTorso(ctx, cx, by, p2) {
        const col = p2 ? '#4a1f86' : '#563199';
        Art.body(ctx, cx, by + 16, 9, 19, col, { lineWidth: 2 });
        ctx.strokeStyle = Art.light(col, 0.4);
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const yy = by + 11 + i * 7;
            const w = 7.4 - i * 1.5;
            ctx.moveTo(cx - w, yy);
            ctx.quadraticCurveTo(cx, yy + 2.6, cx + w, yy);
        }
        ctx.stroke();
        Art.body(ctx, cx, by - 7, 14, 11.5, Art.light(col, 0.18), { lineWidth: 2.2 });
        // Hälse zu den drei Köpfen
        const H = BossTripleButterfly.HEADS;
        for (let i = 0; i < 3; i++) {
            Art.limb(ctx, cx + H[i].x * 0.3, by - 12, cx + H[i].x * 0.85, by + H[i].y * 0.8, 8, Art.light(col, 0.18), { lineWidth: 1.8 });
        }
    }

    _headPos(i, cx, by, t) {
        const H = BossTripleButterfly.HEADS[i];
        const o = this._headPt || (this._headPt = { x: 0, y: 0 });
        const tired = this.phase === 1 && i === 0 && !this.dead;
        o.x = cx + H.x + Math.sin(t * 2 + i * 2.1 + this.seed) * 1.2;
        o.y = by + H.y + Math.cos(t * (tired ? 1.3 : 2.4) + i * 1.7) * (tired ? 2.2 : 1.4) - this.hf[i] * 10;
        return o;
    }

    _drawHead(ctx, i, cx, by, t, p2, dead) {
        const H = BossTripleButterfly.HEADS[i];
        const hp = this._headPos(i, cx, by, t);
        const x = hp.x, y = hp.y, r = H.r;
        const glow = dead ? 0 : this.hc[i];
        const fire = dead ? 0 : this.hf[i];
        if (glow > 0.05) Art.glow(ctx, x, y, r * (1.7 + glow * 1.2), H.dust, 0.2 + glow * 0.55);
        const sleepy = i === 0 && !p2;
        const wake = i === 0 && p2 ? clamp(this.awakeT / 0.85, 0, 1) : 1;   // 0..1 beim Aufwachen
        this._antennae(ctx, i, x, y, r, t, sleepy, glow);
        Art.body(ctx, x, y, r, r * 0.94, H.col, { lineWidth: 2, glossy: true });
        if (i === 0 && (sleepy || wake < 1)) this._nightcap(ctx, x, y, r, t, sleepy ? 0 : wake);
        if (i === 2) this._crown(ctx, x, y - r * 0.82, r, dead ? 0.35 : 0);
        const lk = this.look;
        const ex = x + lk.x * r * 0.12, ey = y - r * 0.1 + lk.y * r * 0.06;
        const er = r * 0.3, gap = r * 0.42;
        if (dead) {
            BossTripleButterfly.spiralEye(ctx, ex - gap, ey, er, t, 1);
            BossTripleButterfly.spiralEye(ctx, ex + gap, ey, er, t, -1);
            Art.mouth(ctx, x, y + r * 0.5, r * 0.42, 'o');
            return;
        }
        const talking = fire > 0 || glow > 0.35;
        if (i === 1) {
            // rosa: fröhlich, in Phase 2 entschlossen
            Art.eyes(ctx, ex, ey, er, { gap, look: lk, iris: '#d6379a', seed: this.seed, angry: p2 });
            Art.mouth(ctx, x, y + r * 0.46, r * 0.55, talking ? 'open' : (p2 ? 'teeth' : 'grin'));
            Art.blush(ctx, x, y + r * 0.28, r * 0.2, r * 0.6);
        } else if (i === 0) {
            if (sleepy) {
                // verschlafen: halb zu, schnarcht mit Schlafblase und Zzz
                const open = talking ? 0.55 : 0.3;
                Art.eyes(ctx, ex, ey + 0.5, er, { gap, look: lk, iris: '#2566d6', blink: false, open });
                Art.mouth(ctx, x - 1, y + r * 0.5, r * 0.4, 'o');
                this._sleepBubble(ctx, x + r * 0.22, y + r * 0.46, r, t);
                this._zzz(ctx, x - r * 0.9, y - r * 1.1, t);
            } else {
                Art.eyes(ctx, ex, ey, er * (1 + (1 - wake) * 0.25), { gap, look: lk, iris: '#2566d6', seed: this.seed + 1, angry: wake >= 1 });
                Art.mouth(ctx, x, y + r * 0.5, r * 0.5, talking || wake < 1 ? 'open' : 'angry');
                if (wake < 1) this._exclaim(ctx, x + r * 0.2, y - r * 1.9, wake);
            }
            Art.blush(ctx, x, y + r * 0.3, r * 0.18, r * 0.62, '#7aa0ff');
        } else {
            // gold: grummelig mit Krone, in Phase 2 rote Augen und Dampfwölkchen
            if (p2) Art.glow(ctx, ex, ey, r * 1.1, '#ff2d55', 0.35);
            Art.eyes(ctx, ex, ey, er, { gap, look: lk, iris: p2 ? '#ff2d55' : '#e07a00', seed: this.seed + 2, angry: true });
            Art.mouth(ctx, x, y + r * 0.52, r * 0.46, talking ? 'open' : (p2 ? 'teeth' : 'angry'));
            if (p2) this._steam(ctx, x, y, r, t);
        }
    }

    _antennae(ctx, i, x, y, r, t, sleepy, glow) {
        const H = BossTripleButterfly.HEADS[i];
        const sw = Math.sin(t * 3 + i * 2 + this.seed) * 1.2;
        // Spitzen: rosa geschwungen, blau (verschlafen) hängend, gold steif
        let tx, ty, qx, qy;
        if (sleepy) { tx = r * 1.35; ty = -r * 0.95; qx = r * 0.8; qy = -r * 1.75; }
        else if (i === 2) { tx = r * 0.62; ty = -r * 2.05; qx = r * 0.45; qy = -r * 1.3; }
        else { tx = r * 1.05; ty = -r * 1.85; qx = r * 0.2; qy = -r * 1.7; }
        ctx.strokeStyle = '#2d1850';
        ctx.lineWidth = 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let s = -1; s <= 1; s += 2) {
            ctx.moveTo(x + s * r * 0.34, y - r * 0.78);
            ctx.quadraticCurveTo(x + s * qx, y + qy, x + s * tx + sw, y + ty);
        }
        ctx.stroke();
        if (glow > 0.05) {
            Art.glow(ctx, x - tx + sw, y + ty, 7 + glow * 6, H.dust, 0.4 + glow * 0.5);
            Art.glow(ctx, x + tx + sw, y + ty, 7 + glow * 6, H.dust, 0.4 + glow * 0.5);
        }
        const br = 2.7 + glow * 1.2;
        ctx.beginPath();
        for (let s = -1; s <= 1; s += 2) {
            ctx.moveTo(x + s * tx + sw + br, y + ty);
            ctx.arc(x + s * tx + sw, y + ty, br, 0, TAU);
        }
        ctx.fillStyle = H.dust;
        ctx.fill();
        ctx.lineWidth = 1.1;
        ctx.stroke();
    }

    // Zipfelmütze des verschlafenen Kopfes; fly = 0 sitzt, 0..1 fliegt beim Aufwachen davon
    _nightcap(ctx, x, y, r, t, fly) {
        const a0 = ctx.globalAlpha;
        ctx.save();
        ctx.translate(x - fly * 34, y - r * 0.55 - fly * 46);
        ctx.rotate(-0.25 - fly * 5);
        if (fly > 0) ctx.globalAlpha = a0 * (1 - fly);
        const droop = Math.sin(t * 1.6 + this.seed) * 1.5;
        // Zipfel hängt nach außen (links), weg vom rosa Kopf
        Art.shape(ctx, c => {
            c.moveTo(r * 0.95, r * 0.12);
            c.quadraticCurveTo(r * 0.7, -r * 0.95, -r * 0.25, -r * 0.8);
            c.quadraticCurveTo(-r * 1.2, -r * 0.6, -r * 1.45, r * 0.25 + droop);
            c.quadraticCurveTo(-r * 0.9, -r * 0.15, -r * 0.95, r * 0.18);
            c.closePath();
        }, { x: -r * 1.5, y: -r, w: r * 2.5, h: r * 1.3 }, '#5a48e0', { lineWidth: 1.6 });
        // weißer Rand und Bommel
        Art.limb(ctx, r * 0.95, r * 0.14, -r * 0.95, r * 0.2, 3.2, '#f4f6ff', { lineWidth: 1.2 });
        Art.body(ctx, -r * 1.45, r * 0.3 + droop, 3.2, 3.2, '#ffffff', { lineWidth: 1.2 });
        ctx.restore();
    }

    _sleepBubble(ctx, x, y, r, t) {
        const s = 0.5 + 0.5 * Math.sin(t * 2.2 + this.seed);
        const br = 1.5 + s * r * 0.3;
        ctx.fillStyle = 'rgba(190,230,255,0.55)';
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(x + br * 0.7, y + br * 0.2, br, 0, TAU);
        ctx.fill();
        ctx.stroke();
    }

    // Zzz über dem schlafenden Kopf (zwei steigende „z“)
    _zzz(ctx, x, y, t) {
        ctx.beginPath();
        for (let i = 0; i < 2; i++) {
            const f = (t * 0.45 + i * 0.5 + this.seed) % 1;
            const s = 2.4 + f * 2.2;
            const zx = x - f * 7 - i * 2, zy = y - f * 16;
            ctx.moveTo(zx - s, zy - s);
            ctx.lineTo(zx + s, zy - s);
            ctx.lineTo(zx - s, zy + s);
            ctx.lineTo(zx + s, zy + s);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#2d1850';
        ctx.lineWidth = 2.8;
        ctx.stroke();
        ctx.strokeStyle = '#e8f1ff';
        ctx.lineWidth = 1.3;
        ctx.stroke();
    }

    // „!“ beim Aufwachen
    _exclaim(ctx, x, y, k) {
        const s = 1 + Math.sin(k * Math.PI) * 0.35;
        ctx.beginPath();
        ctx.roundRect(x - 1.8 * s, y - 9 * s, 3.6 * s, 9 * s, 1.8 * s);
        ctx.moveTo(x + 1.9 * s, y + 3.4 * s);
        ctx.arc(x, y + 3.4 * s, 1.9 * s, 0, TAU);
        ctx.fillStyle = '#ffe14a';
        ctx.fill();
        ctx.strokeStyle = '#6b3a00';
        ctx.lineWidth = 1.3;
        ctx.stroke();
    }

    // Kleine Krone des grummeligen Kopfes; tilt > 0 = verrutscht (besiegt)
    _crown(ctx, x, y, r, tilt) {
        const w = r * 0.62, h = r * 0.62;
        if (tilt) {
            ctx.save();
            ctx.translate(x + r * 0.2, y);
            ctx.rotate(tilt);
            ctx.translate(-x, -y);
        }
        Art.shape(ctx, c => {
            c.moveTo(x - w, y + h * 0.25);
            c.lineTo(x - w * 1.12, y - h * 0.7);
            c.lineTo(x - w * 0.45, y - h * 0.2);
            c.lineTo(x, y - h);
            c.lineTo(x + w * 0.45, y - h * 0.2);
            c.lineTo(x + w * 1.12, y - h * 0.7);
            c.lineTo(x + w, y + h * 0.25);
            c.closePath();
        }, { x: x - w, y: y - h, w: w * 2, h: h * 1.25 }, '#ff6b4a', { lineWidth: 1.5, glossy: true });
        ctx.fillStyle = '#fff3a0';
        ctx.beginPath();
        ctx.arc(x, y - h * 0.15, r * 0.12, 0, TAU);
        ctx.fill();
        if (tilt) ctx.restore();
    }

    // Dampfwölkchen (grummeliger Kopf in Phase 2)
    _steam(ctx, x, y, r, t) {
        const a0 = ctx.globalAlpha;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 2; i++) {
            const f = (t * 1.2 + i * 0.5) % 1;
            const s = i ? 1 : -1;
            ctx.globalAlpha = a0 * (1 - f) * 0.8;
            ctx.beginPath();
            ctx.arc(x + s * (r * 1.05 + f * 6), y - r * 0.3 - f * 12, 2.2 + f * 3, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = a0;
    }

    // Sturm-Aufladen: bunte Funken wirbeln zum Körper
    _drawSwirl(ctx, x, y, k, t) {
        const H = BossTripleButterfly.HEADS;
        for (let i = 0; i < 10; i++) {
            const f = (k * 1.6 + i / 10) % 1;
            const r = 100 * (1 - f) + 12;
            const a = i * 2.39996 + f * 3.2 + t * 0.8;
            Art.sparkle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 2 + f * 3.2, i % 2 ? '#ffffff' : H[i % 3].dust, 0.3 + 0.7 * f);
        }
    }

    // Glitzer-Regen: Sternstaub rieselt aus den Flügeln
    _drawWingDust(ctx, cx, by, t) {
        for (let i = 0; i < 6; i++) {
            const f = (t * 1.3 + i / 6) % 1;
            const side = i % 2 ? 1 : -1;
            const x = cx + side * (26 + ((i * 17) % 40));
            const y = by - 20 + f * 60;
            Art.sparkle(ctx, x, y, 2.6 * (1 - f) + 1, i % 3 ? '#fff3a0' : '#ffffff', 1 - f);
        }
    }

    // Besiegt im Stillstand: Glitzer funkelt auf den Flügeln
    _drawDefeatSparkles(ctx, cx, by, t) {
        for (let i = 0; i < 10; i++) {
            const tw = Math.sin(t * 9 + i * 1.7);
            if (tw < 0.1) continue;
            const side = i % 2 ? 1 : -1;
            const x = cx + side * (22 + ((i * 23) % 50));
            const y = by - 50 + ((i * 29) % 84);
            Art.glow(ctx, x, y, 6 + tw * 6, '#fff6a8', tw * 0.6);
            Art.sparkle(ctx, x, y, 3 + tw * 4, i % 3 ? '#fff6a8' : '#ffffff', tw);
        }
    }

    // Zerfall (nur sichtbar, wenn die Todesuhr läuft, z. B. in der Galerie): Glitzer und kleine Falter
    _drawDissolve(ctx, cx, cy, dp, t) {
        const cols = BossTripleButterfly.SWARM_COLORS;
        const a0 = ctx.globalAlpha;
        Art.glow(ctx, cx, cy, 60 + dp * 40, '#ff9ae6', (1 - dp) * 0.6);
        for (let i = 0; i < 12; i++) {
            const a = -Math.PI / 2 + (i - 5.5) * 0.28 + Math.sin(i * 3.1) * 0.2;
            const d = 20 + dp * (70 + (i % 4) * 14);
            const x = cx + Math.cos(a) * d * 1.3, y = cy + Math.sin(a) * d * 0.8;
            ctx.globalAlpha = a0 * Math.min(1, dp * 3) * (1 - dp * 0.4);
            FalterKit.tiny(ctx, x, y, 1 + (i % 3) * 0.15, cols[i % cols.length], t * 15 + i);
        }
        for (let i = 0; i < 10; i++) {
            const a = i * 0.63 + 0.3;
            const d = 10 + dp * 60;
            ctx.globalAlpha = a0 * (1 - dp);
            Art.sparkle(ctx, cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d, 3 * (1 - dp) + 1, i % 2 ? '#ffffff' : cols[i % cols.length], 1);
        }
        ctx.globalAlpha = a0;
    }

    // Kringel-Auge (besiegt, benommen)
    static spiralEye(ctx, x, y, r, t, dir) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = Art.INK;
        ctx.lineWidth = Math.max(0.9, r * 0.2);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 1.06, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
            const a = i * 0.95 + t * 8 * dir;
            const rr = r * (0.1 + i * 0.075);
            if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.lineWidth = Math.max(0.9, r * 0.17);
        ctx.stroke();
    }

    // Ein Flügel (side = 1 rechts, -1 links) als Teilpfad. k = Flügelschlag (Stauchung in x),
    // s = Größe um die Flügelwurzel. F = [wurzelX, wurzelY, dann drei Bézier-Segmente relativ zur Wurzel].
    static wingPath(c, cx, cy, side, k, s, F) {
        const sk = side * k;
        const x0 = cx + sk * F[0], y0 = cy + F[1];
        c.moveTo(x0, y0);
        for (let i = 2; i < F.length; i += 6) {
            c.bezierCurveTo(
                x0 + sk * s * F[i], y0 + s * F[i + 1],
                x0 + sk * s * F[i + 2], y0 + s * F[i + 3],
                x0 + sk * s * F[i + 4], y0 + s * F[i + 5]);
        }
        c.closePath();
    }
}

// Köpfe: Lage zur Körpermitte, Radius, Hautfarbe, Sternstaub-Farbe
BossTripleButterfly.HEADS = [
    { x: -29, y: -25, r: 14, col: '#7ab6ff', dust: '#4cc9f0' },     // 0 blau, verschlafen
    { x: 0, y: -37, r: 15.5, col: '#ff82cc', dust: '#ff4fb0' },     // 1 rosa, fröhlich
    { x: 29, y: -25, r: 14, col: '#ffc53d', dust: '#ffd23f' },      // 2 gold, grummelig
];
BossTripleButterfly.DRAW_ORDER = [0, 2, 1];
BossTripleButterfly.CYCLE = ['storm', 'salvo', 'rain'];
// Mögliche Sturm-Plätze um die Raummitte (x, y)
BossTripleButterfly.CENTER_SPOTS = [0, 0, -60, 0, 60, 0, 0, -36, 0, 40, -80, -30, 80, -30, -80, 40, 80, 40];
// Reihenfolgen der Kopf-Salven (Phase 1 immer die erste: rosa, blau, gold)
BossTripleButterfly.ORDERS = [[1, 0, 2], [0, 2, 1], [2, 1, 0], [1, 2, 0], [2, 0, 1], [0, 1, 2]];
// Flügelformen (rechter Flügel): Wurzel, dann Bézier-Segmente relativ zur Wurzel.
// Die Vorderflügel steigen hoch hinauf und rahmen die drei Köpfe ein, die Hinterflügel sind rund.
BossTripleButterfly.FORE = [6, -8, 0, -32, 31, -58, 58, -52, 70, -48, 67, -18, 50, -6, 34, 4, 13, 10, 0, 12];
BossTripleButterfly.HIND = [5, 2, 18, -2, 42, 4, 42, 18, 42, 32, 28, 40, 18, 38, 8, 36, 2, 22, 0, 8];
// Tupfen im Vorderflügelrand: x, y (relativ zur Wurzel), Radius
BossTripleButterfly.FORE_DOTS = [38.7, -48.4, 2.2, 53.9, -48.4, 2.6, 59.7, -41.7, 2.6, 60.4, -29.8, 2.4, 55.9, -16.5, 2.1];
BossTripleButterfly.WING1 = {
    foreRim: '#3d1a8a', fore: '#9b5cff', foreBand: '#ff8ad8',
    hindRim: '#0f5a6e', hind: '#2ed3c6', hindBand: '#c4fff4',
    spotRing: '#1d2a6b', spot: '#ffd23f', dot: '#ffffff',
};
BossTripleButterfly.WING2 = {
    foreRim: '#5c0f63', fore: '#d14dff', foreBand: '#ffd23f',
    hindRim: '#16307a', hind: '#4c8bff', hindBand: '#ffb3ec',
    spotRing: '#5c0f2e', spot: '#ff4f7b', dot: '#fff6a8',
};
BossTripleButterfly.SWARM_COLORS = ['#ff7ad9', '#9b5cff', '#2ed3c6', '#ffd23f', '#4cc9f0', '#ff4fb0'];
