// ── Welt 48: Regenbogental (Idee von Leander) ──
// Einhörner: weiß mit rosa-lila Mähne und goldenem Horn. Sie halten Abstand, laden das Horn auf
//   (0,55 s: der Zielkreis am Boden füllt sich, die Hornspitze glüht) und schießen dann
//   Regenbogenstaub – eine bunte Glitzerwolke – auf Mark oder einen seiner Freunde.
//   Das Einhorn mit dem Schlüssel: nachtblaues Fell mit silbernen Sternen und silbernem Horn.
// Boss: RIESEN-EINHORN mit DREI Hörnern – Endgegner von Welt 48, bleibt im Boss-Raum (runde Wiese
//   unter dem Regenbogenbogen), 140 LP, zwei Phasen.
//   Staubfächer: breitet die Stirn (Vorwarnung: farbige Strahlen), dann ein Fächer aus drei
//     Regenbogenwolken auf Mark oder einen Freund (Phase 2: fünf).
//   Staubsturm: Warnstrahlen rundum, dann ein Ring aus acht Wolken (Phase 2: zwölf, zweimal
//     hintereinander mit gedrehtem Ring).
//   Schlaflied: drei Hörner leuchten, funkelnde Noten steigen auf und ein Warnkreis wächst –
//     wer nach 1,5 s noch im Kreis steht, schläft drei Sekunden ein (Mark, Juri und Krokodil).
//   Phase 2 (halbe LP): schneller, mehr Wolken. Nach großen Angriffen wird das Rieseneinhorn
//     schwindelig (kreisende Sterne, kurz wehrlos) – bei wenig Leben besonders lange.
//   Nur was Leander will: Staub, Fächer, Schlaflied, Schwindel. Kein Gift, kein zusätzlicher Zustand.
// Fairness: jeder Angriff wird angesagt. Freunde verschwinden nie – ein tödlicher Treffer haut
//   Juri und das Krokodil nur um (knockOut).

const U48 = {
    coat: '#fdfaff',            // weißes Fell (hellster Ton, glänzend)
    coatMid: '#ece2f8',
    coatDark: '#d3c4e8',
    belly: '#f3ecfb',
    muzzle: '#ffd9ea',          // rosa Nüsternpartie
    hoof: '#cbb6e6',
    inner: '#ffc9e2',
    maneA: '#ff8ad0',           // rosa-lila Mähne (genau so von Leander gewuenscht)
    maneB: '#c9a8ff',
    horn: '#ffd23f',
    hornDark: '#c98f1e',
    keyCoat: '#2b3266',         // Schluesseltraeger: nachtblau
    keyMid: '#232a58',
    keyDark: '#171d40',
    keyBelly: '#3a4380',
    keyMuzzle: '#4a5494',
    keyHoof: '#8f9ac4',
    keyHorn: '#e2e9f8',
    keyHornDark: '#9aa6cc',
    star: '#eef2ff',            // silberne Sterne im nachtblauen Fell
    eye: '#7a4fb0',
    warn: '#ff4f86',
    note: '#ffe9a8',
    glow: '#c9a8ff',
};

const RAINBOW48 = ['#ff5a6a', '#ff9f1c', '#ffe14a', '#5fe08a', '#4cc9f0', '#b980ff', '#ff8ad8'];
const DUST_CAP48 = 40;          // nie mehr als so viele Staubwolken gleichzeitig (Handy)

const UnicornArt = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine direkt.
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && typeof Game.hurtPlayer === 'function') {
            Game.hurtPlayer(amount, angle, force);
        } else if (typeof Game !== 'undefined' && Game.player === player && typeof Game._hurtPlayer === 'function') {
            Game._hurtPlayer(amount, angle, force);
        } else if (player && player.takeDamage) {
            player.takeDamage(amount, angle, force);
        }
    },

    shake(strength, time) {
        if (typeof Game !== 'undefined' && Game.camera && Game.camera.shake) Game.camera.shake(strength, time);
    },

    burst(x, y, colors, n, speed, life, o) {
        if (typeof FX !== 'undefined') FX.burst(x, y, colors, n, speed, life, o || {});
    },

    ring(x, y, color, radius, life, width) {
        if (typeof FX !== 'undefined') FX.ring(x, y, color, radius, life, width);
    },

    // Wache, treffbare Begleiter (nicht die Schlange auf Marks Schulter)
    companions() {
        const out = [];
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Begleiter treffen: nie verschwinden lassen, ein tödlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(7);
        else if (c.takeDamage) c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [U48.maneA, '#ffffff'], 8, 125, 0.4, { kind: 'star' });
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    // Freie Sicht? Nutzt die gemeinsame Linie der Begleiter-KI.
    clearLine(world, ax, ay, bx, by) {
        if (typeof Juri !== 'undefined' && Juri.lineClear) return Juri.lineClear(world, ax, ay, bx, by);
        if (!world || !world.isWall) return true;
        const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
        for (let i = 1; i < steps; i++) {
            if (world.isWall(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps)) return false;
        }
        return true;
    },

    // Noch lebende Staubwolken zählen (Obergrenze pro Gegner und gesamt)
    dustCount(list, who) {
        if (!list) return 0;
        let n = 0;
        for (const p of list) if (!p.dead && p.rainbowDust && (!who || p.shooter === who)) n++;
        return n;
    },

    totalShots(list) {
        if (!list) return 0;
        let n = 0;
        for (const p of list) if (!p.dead && (p.owner === 'enemy' || p.owner === 'lobber')) n++;
        return n;
    },

    // Alle treffbaren Ziele (Mark zuerst, dann die Freunde)
    targets(player) {
        const out = [];
        if (player && !player.dead) {
            out.push({ ref: player, x: player.x + player.w / 2, y: player.y + player.h / 2, w: player.w, h: player.h, isPlayer: true });
        }
        for (const c of this.companions()) {
            out.push({ ref: c, x: c.x + (c.w || 20) / 2, y: c.y + (c.h || 20) / 2, w: c.w || 20, h: c.h || 20 });
        }
        return out;
    },

    // Ziel für den Staub: meist Mark, manchmal ein Freund mit freier Sicht.
    pickAim(world, mx, my, player, maxDist, friendChance) {
        if (!player || player.dead) return null;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        if (Math.hypot(px - mx, py - my) < maxDist && this.clearLine(world, mx, my, px, py)) {
            if (Math.random() < friendChance) {
                const cs = this.companions();
                const start = Math.floor(Math.random() * Math.max(1, cs.length));
                for (let k = 0; k < cs.length; k++) {
                    const c = cs[(start + k) % cs.length];
                    const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                    if (Math.hypot(cx - mx, cy - my) > maxDist) continue;
                    if (this.clearLine(world, mx, my, cx, cy)) return { x: cx, y: cy };
                }
            }
            return { x: px, y: py };
        }
        return null;
    },

    // Nächster Zielträger (Mark oder Freund), für den Fächer – nah und mit freier Sicht.
    nearestTarget(world, mx, my, player, maxDist) {
        let best = null;
        for (const t of this.targets(player)) {
            if (t.isPlayer && player.dead) continue;
            const d = Math.hypot(t.x - mx, t.y - my);
            if (d > maxDist) continue;
            if (!this.clearLine(world, mx, my, t.x, t.y)) continue;
            if (!best || d < best.d) best = { t, d };
        }
        return best ? best.t : null;
    },

    // Schlaflied: alle im Kreis schlafen drei Sekunden ein (sleep aus dem Gerüst, kein Schaden).
    // Mark und die Freunde sind durch Ausweichrolle, Auto, Krone und Schonzeit selbst geschützt.
    lull(x, y, R, seconds) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        let wake = 0;
        for (const t of this.targets(player)) {
            if (t.ref.dead) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (t.ref.sleep && t.ref.sleep(seconds)) {
                wake++;
                this.burst(t.x, t.y - 8, [U48.note, U48.maneB, '#ffffff'], 7, 60, 0.7, { kind: 'star' });
            }
        }
        return wake;
    },

    // ── Ein Regenbogen-Horn (x, y = Ansatz, tilt = Neigung, 0 = senkrecht nach oben) ──
    horn(ctx, x, y, len, tilt, w, col, dark, lw) {
        const tx = x + Math.sin(tilt) * len, ty = y - Math.cos(tilt) * len;
        const px = Math.cos(tilt), py = Math.sin(tilt);
        Art.shape(ctx, g => {
            g.moveTo(x - px * w, y - py * w);
            g.lineTo(tx, ty);
            g.lineTo(x + px * w, y + py * w);
            g.quadraticCurveTo(x, y + 1.4, x - px * w, y - py * w);
            g.closePath();
        }, {
            x: Math.min(x, tx) - w - 1, y: Math.min(y, ty) - 1,
            w: Math.abs(tx - x) + w * 2 + 2, h: Math.abs(ty - y) + 3,
        }, col, { glossy: true, lineWidth: lw });
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(0.7, lw * 0.7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 1; i <= 3; i++) {
            const q = i / 4.4;
            const bx = x + (tx - x) * q, by = y + (ty - y) * q;
            const ww = w * (1 - q * 0.72);
            ctx.moveTo(bx - px * ww, by - py * ww);
            ctx.lineTo(bx + px * ww * 0.8, by + py * ww * 0.8 + 0.7);
        }
        ctx.stroke();
    },

    // Eine funkelnde Note (Vorwarnung fürs Schlaflied), x, y = Kopf der Note.
    note(ctx, x, y, s, color, a) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * clamp(a, 0, 1);
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.ellipse(x, y, 2.2 * s, 1.7 * s, -0.35, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 1.9 * s, y - 0.3 * s);
        ctx.lineTo(x + 1.9 * s, y - 8 * s);
        ctx.quadraticCurveTo(x + 5.4 * s, y - 7.2 * s, x + 4.4 * s, y - 4.2 * s);
        ctx.stroke();
        Art.sparkle(ctx, x + 5.2 * s, y - 9.4 * s, 2.2 * s, '#ffffff', 0.9);
        ctx.globalAlpha = prev;
    },

    // Steigende, nach außen driftende Noten über dem Boss (k = Füllstand der Warnung).
    lullabyNotes(ctx, x, y, R, k, seed, s) {
        for (let i = 0; i < 6; i++) {
            const q = (Art.time * 0.5 + seed * 0.13 + i / 6) % 1;
            const a = -1.9 + (i % 3) * 1.15 + Math.sin(Art.time * 2.4 + i) * 0.16;
            const d = 14 + q * R * 0.92;
            const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d * 0.55 - 10 - q * 16;
            const fade = (q < 0.18 ? q / 0.18 : 1 - (q - 0.18) / 0.82) * (0.45 + 0.55 * k);
            this.note(ctx, nx, ny, s * (0.8 + 0.4 * Math.sin(Art.time * 5 + i)), i % 2 ? U48.note : U48.maneB, fade);
        }
    },

    // ── Ganze Figur: Einhorn in der Seite, leicht in Blickrichtung gedreht, Fußpunkt (0, 0).
    // Eine Einheit = normales Einhorn, der Boss zeichnet dieselbe Figur größer (ctx.scale vorher).
    // p = { c, lw, t, bob, walkAmt, stepT, tilt, rear, mood, look, legs: [hinten vorn] gehoben,
    //       horns (1 oder 3), stars (Silbersterne), shine (Phasen-Glanz), dizzy, key }
    figure(ctx, p) {
        const c = p.c, lw = p.lw, t = p.t;
        const hipY = -12 - (p.bob || 0) * 0.6;
        const walkAmt = p.walkAmt || 0;
        const stepT = p.stepT || 0;
        const rear = p.rear || 0;
        ctx.save();
        if (p.tilt) {
            ctx.translate(0, hipY);
            ctx.rotate(p.tilt);
            ctx.translate(0, -hipY);
        }
        // Beine (vier, hintere Paare gegenläufig). rear hebt die Vorderbeine zum Ausbrechen.
        const leg = (lx, phase, far, front) => {
            const sw = Math.sin(stepT + phase) * walkAmt * 3.4;
            const lift = Math.max(0, Math.sin(stepT + phase + 1.6)) * walkAmt * 2.2;
            const up = front ? rear * 7.5 : 0;
            const hx2 = lx + sw + (front ? rear * 2.2 : -rear * 1.6);
            const hy2 = -1.8 - lift - up;
            Art.limb(ctx, lx, hipY, hx2, hy2, far ? 3.6 : 4.2, far ? c.coatMid : c.coat, { lineWidth: lw });
            Art.body(ctx, hx2, hy2 - 0.4, 2.6, 1.7, c.hoof, { lineWidth: lw * 0.8 });
        };
        leg(-10.8, 0, true, false);
        leg(6.4, Math.PI, true, true);
        // Schweif (hinter dem Körper): drei lange rosa-lila Strähnen
        for (let i = 0; i < 3; i++) {
            const wv = Math.sin(t * 2.3 + i * 1.15 + (p.seed || 0)) * 3 + walkAmt * 2;
            const bx = -13.4, by = hipY - 11.5 + i * 2.2;
            const ex = -23 - i * 2.4, ey = -3 + i * 2.4 + wv;
            Art.shape(ctx, g => {
                g.moveTo(bx, by - 1.8);
                g.quadraticCurveTo(bx - 6 - i, by + 1 + wv * 0.4, ex, ey);
                g.quadraticCurveTo(bx - 5 - i, by + 5 + wv * 0.7, bx + 1.6, by + 2.6);
                g.closePath();
            }, { x: ex - 1, y: by - 3, w: bx - ex + 3, h: Math.abs(ey - by) + 6 }, i === 1 ? c.maneB : c.maneA, { lineWidth: lw * 0.85 });
        }
        // Körper: ein Zug aus Kruppe, Rücken, Brust und Bauch (klarer Umriss)
        Art.shape(ctx, g => {
            g.moveTo(-14.5, hipY - 1);
            g.bezierCurveTo(-17.4, hipY - 8, -15.6, hipY - 14.4, -9, hipY - 15.8);
            g.bezierCurveTo(-2, hipY - 17.4, 6, hipY - 17.2, 11.6, hipY - 14.6);
            g.bezierCurveTo(16.6, hipY - 12.6, 17.2, hipY - 6, 14, hipY - 1.4);
            g.bezierCurveTo(10, hipY + 2.8, -9, hipY + 2.8, -14.5, hipY - 1);
            g.closePath();
        }, { x: -17.8, y: hipY - 17.8, w: 35.4, h: 21.2 }, c.coat, { glossy: true, lineWidth: lw });
        Art.body(ctx, 0, hipY - 1.6, 11, 3.4, c.belly, { highlight: false, outline: false });
        Art.body(ctx, -9.4, hipY - 6.6, 6.4, 6, c.coatMid, { highlight: false, outline: false });
        Art.body(ctx, 8.6, hipY - 8.4, 4.4, 4.6, c.coatMid, { highlight: false, outline: false });
        if (p.stars) {
            for (const s of p.stars) {
                const tw = 0.55 + 0.45 * Math.sin(t * 3.4 + s[0] + s[1]);
                const prev = ctx.globalAlpha;
                ctx.globalAlpha = prev * tw;
                Art.star(ctx, s[0], hipY + s[1], s[2], c.star, { lineWidth: lw * 0.55 });
                ctx.globalAlpha = prev;
            }
        }
        // Nacken (dick, nach vorn oben) und Mähne entlang des Nackens
        const hx = 15.6, hy = hipY - 25.6;
        Art.limb(ctx, 9, hipY - 12.4, hx - 1.8, hy + 3.6, 9.8, c.coat, { lineWidth: lw });
        for (let i = 0; i < 4; i++) {
            const q = i / 3;
            const bx = 10.2 + (hx - 5.4 - 10.2) * q, by = hipY - 15.4 + (hy - 3.4 - (hipY - 15.4)) * q;
            const wv = Math.sin(t * 2.6 + i * 1.5 + (p.seed || 0)) * 2.2;
            Art.shape(ctx, g => {
                g.moveTo(bx + 2.6, by - 2.4);
                g.quadraticCurveTo(bx - 5.4 - i, by + 2.2 + wv, bx - 8.4 - i * 1.3, by + 8.4 + wv * 1.3);
                g.quadraticCurveTo(bx - 2.4 - i * 0.4, by + 4.4 + wv * 0.5, bx + 3.6, by + 1.4);
                g.closePath();
            }, { x: bx - 10 - i * 1.3, y: by - 3.4, w: 14 + i * 1.3, h: 13.4 }, i % 2 ? c.maneB : c.maneA, { lineWidth: lw * 0.8 });
        }
        // Vordere Beine (vor dem Körper, näher am Kind)
        leg(-7.4, Math.PI, false, false);
        leg(9.6, 0, false, true);
        // Kopf
        const hy2 = hy + (p.headDy || 0);
        Art.shape(ctx, g => {                                   // Ohr
            g.moveTo(hx - 3.6, hy2 - 4.4);
            g.lineTo(hx - 6.4, hy2 - 12.4);
            g.lineTo(hx - 0.2, hy2 - 6.8);
            g.closePath();
        }, { x: hx - 7, y: hy2 - 13, w: 7.4, h: 9.4 }, c.coat, { lineWidth: lw });
        Art.shape(ctx, g => {
            g.moveTo(hx - 3.6, hy2 - 5.6);
            g.lineTo(hx - 5.2, hy2 - 10.6);
            g.lineTo(hx - 1.6, hy2 - 7.2);
            g.closePath();
        }, { x: hx - 5.8, y: hy2 - 11.2, w: 4.8, h: 6 }, c.inner, { lineWidth: 0 });
        Art.body(ctx, hx, hy2, 7.4, 6.6, c.coat, { glossy: true, lineWidth: lw });
        Art.body(ctx, hx + 5.6, hy2 + 2.6, 5.1, 3.9, c.muzzle, { lineWidth: lw });
        Art.body(ctx, hx + 8.6, hy2 + 1.8, 1.2, 0.9, Art.dark(c.muzzle, 0.45), { highlight: false, outline: false });
        // Hörner: normales Einhorn eins, das Rieseneinhorn drei (deutlich als Dreiergruppe zu sehen)
        const hn = p.horns || 1;
        const hb = { x: hx + 0.6, y: hy2 - 5.6 };
        if (hn >= 3) {
            UnicornArt.horn(ctx, hb.x - 6.6, hb.y + 1.6, 8.8, -0.82, 2.3, c.horn, c.hornDark, lw);
            UnicornArt.horn(ctx, hb.x - 3.2, hb.y + 0.4, 11.4, -0.34, 2.5, c.horn, c.hornDark, lw);
        }
        UnicornArt.horn(ctx, hb.x, hb.y, hn >= 3 ? 15.4 : 12.4, 0.3, hn >= 3 ? 3.1 : 2.7, c.horn, c.hornDark, lw);
        // Stirnsträhne zwischen den Hörnern
        for (let i = 0; i < 2; i++) {
            const wv = Math.sin(t * 3 + i * 1.7 + (p.seed || 0)) * 1.6;
            Art.shape(ctx, g => {
                g.moveTo(hb.x - 1.4 - i * 1.8, hb.y + 0.6);
                g.quadraticCurveTo(hb.x - 6 - i * 2, hb.y + 3.4 + wv, hb.x - 7.4 - i * 2.4, hb.y + 8.2 + wv);
                g.quadraticCurveTo(hb.x - 3.4 - i, hb.y + 5 + wv * 0.5, hb.x + 0.6 - i * 1.4, hb.y + 2.6);
                g.closePath();
            }, { x: hb.x - 10.4 - i * 2.4, y: hb.y - 1, w: 12 + i * 2.4, h: 11 }, i % 2 ? c.maneA : c.maneB, { lineWidth: lw * 0.75 });
        }
        // Augen, Nüsternmund, Backen
        const look = p.look || { x: 0, y: 0 };
        const mood = p.mood || 'calm';
        const ex = hx + 1.2, ey = hy2 - 0.8;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, ex, ey, 1.9, 3.6);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.8;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.2 + i * 0.1;
                    const x2 = ex + s * 2.6 + Math.cos(a) * r, y2 = ey + Math.sin(a) * r;
                    if (i) ctx.lineTo(x2, y2); else ctx.moveTo(x2, y2);
                }
                ctx.stroke();
            }
        } else {
            const open = mood === 'tired' ? 0.5 : (mood === 'sleepy' ? 0.22 : 1);
            Art.eye(ctx, ex - 1.4, ey, 2.3, look, {
                angry: mood === 'angry' || mood === 'open', open, side: 'left',
                iris: p.red ? '#ff3b5c' : U48.eye, sad: mood === 'tired',
            });
            Art.eye(ctx, ex + 3.6, ey - 0.3, 2.0, look, {
                angry: mood === 'angry' || mood === 'open', open: open * 0.94, side: 'right',
                iris: p.red ? '#ff3b5c' : U48.eye, sad: mood === 'tired',
            });
        }
        Art.mouth(ctx, hx + 4.4, hy2 + 4.4, 3.6, mood === 'open' ? 'open' : mood === 'angry' ? 'angry' : 'smile');
        if (mood !== 'dead') Art.blush(ctx, hx + 2.4, hy2 + 3.4, 1.7, 2.6, c.blush);
        if (p.shine) {
            Art.sparkle(ctx, hx + 9.4, hy2 - 8.4, 2.6 + Math.sin(t * 5) * 0.7, '#ffffff', 0.5 + 0.4 * Math.sin(t * 6));
            Art.sparkle(ctx, -12, hipY - 14, 2.2 + Math.sin(t * 4.2 + 1) * 0.6, U48.maneB, 0.4 + 0.4 * Math.sin(t * 5.5));
        }
        ctx.restore();
        return { hx, hy: hy2 };
    },
};

// Paletten: weißes Einhorn, nachtblauer Schlüsselträger
const P_WHITE = {
    coat: U48.coat, coatMid: U48.coatMid, coatDark: U48.coatDark, belly: U48.belly, muzzle: U48.muzzle,
    hoof: U48.hoof, inner: U48.inner, maneA: U48.maneA, maneB: U48.maneB, horn: U48.horn, hornDark: U48.hornDark,
    star: U48.star, blush: '#ff7aa8',
};
const P_NIGHT = {
    coat: U48.keyCoat, coatMid: U48.keyMid, coatDark: U48.keyDark, belly: U48.keyBelly, muzzle: U48.keyMuzzle,
    hoof: U48.keyHoof, inner: '#6c78b4', maneA: U48.maneA, maneB: U48.maneB, horn: U48.keyHorn, hornDark: U48.keyHornDark,
    star: U48.star, blush: '#8fb0ff',
};
const STARS_NIGHT = [[-9.6, -8, 1.7], [-3.4, -12.4, 1.3], [4.4, -6.2, 1.5], [-12.8, -13.2, 1.2]];

// ══════════════════════════════════════════
// ── Regenbogenstaub: bunte Glitzerwolke als Geschoss ──
// ══════════════════════════════════════════

// Eigener Flugeigner (owner 'lobber'): die Engine prüft keine Treffer, deshalb trifft die Wolke
// auch Juri und das Krokodil – und betäubt sie nicht, sondern macht genau den Schaden, den
// Leander will. big = Wolke des Rieseneinhorns (etwas größer, 2 Schaden).
class RainbowDust extends Projectile {
    constructor(x, y, angle, speed, big, shooter) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, big ? 2 : 1, 'lobber', big ? 120 : 90);
        this.radius = big ? 9 : 6.4;
        this.lifetime = big ? 2.4 : 2;
        this.big = !!big;
        this.shooter = shooter || null;
        this.rainbowDust = true;
        this.seed = Math.random() * 10;
        this.spin = randRange(-5, 5);
    }

    update(dt, world) {
        const alive = !this.dead;
        super.update(dt, world);
        if (this.dead) {
            if (alive) UnicornArt.burst(this.x, this.y, RAINBOW48, 6, 85, 0.32, { kind: 'star' });
            return;
        }
        const player = typeof Game !== 'undefined' ? Game.player : null;
        if (player && !player.dead && (player.iFrames || 0) <= 0) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(this.x - px, this.y - py) < this.radius + player.w / 2) {
                UnicornArt.hurt(player, this.big ? 2 : 1, Math.atan2(this.vy, this.vx), this.knockback);
                this._pop();
                return;
            }
        }
        for (const c of UnicornArt.companions()) {
            const cw = c.w || 20, ch = c.h || 20;
            if ((c.iFrames || 0) > 0) continue;
            if (Math.hypot(this.x - (c.x + cw / 2), this.y - (c.y + ch / 2)) < this.radius + Math.max(cw, ch) / 2) {
                UnicornArt.hitCompanion(c, this.big ? 2 : 1);
                this._pop();
                return;
            }
        }
    }

    _pop() {
        this.dead = true;
        UnicornArt.burst(this.x, this.y, RAINBOW48, this.big ? 12 : 8, this.big ? 150 : 115, 0.42, { kind: 'star' });
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        const t = Art.time + this.seed;
        const fade = clamp(this.lifetime / 0.28, 0, 1);
        const prev = ctx.globalAlpha;
        if (fade < 1) ctx.globalAlpha = prev * fade;
        Art.glow(ctx, p.x, p.y, r * 2.6, U48.maneB, 0.5);
        // Wolkiger Kern: sieben bunte Tropfen um eine helle Mitte, drehen langsam
        for (let i = 0; i < 7; i++) {
            const a = t * this.spin * 0.5 + (TAU * i) / 7;
            const d = r * (0.5 + 0.26 * Math.sin(t * 3 + i));
            Art.body(ctx, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.85, r * 0.52, r * 0.46,
                RAINBOW48[(i + Math.floor(t * 5)) % RAINBOW48.length], { lineWidth: 0.9, highlight: false });
        }
        Art.body(ctx, p.x, p.y, r * 0.6, r * 0.54, '#fffdf6', { glossy: true, lineWidth: 1.1 });
        for (let i = 0; i < 2; i++) {
            const a = -t * 3.4 + i * 2.6;
            Art.sparkle(ctx, p.x + Math.cos(a) * r * 1.3, p.y + Math.sin(a) * r * 1.1,
                r * (0.4 + 0.14 * Math.sin(t * 7 + i)), '#ffffff', 0.85);
        }
        ctx.globalAlpha = prev;
    }
}

// ══════════════════════════════════════════
// ── Normales Einhorn ──
// ══════════════════════════════════════════

// Weißes Einhorn mit rosa-lila Mähne und goldenem Horn (Schlüsselträger: nachtblau mit
// silbernen Sternen und silbernem Horn). Hält 70–170 Abstand, lädt das Horn auf und schießt
// Regenbogenstaub auf Mark oder einen Freund. Von nah bockt es hoch (Kontaktschaden).
class Unicorn extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 26);          // Box wie die spaeteren Gegner (22 bis 28 breit), Figur selbst zeichne ich grosser
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(46, 56);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.fxColor = U48.maneB;
        this.seed = Math.random() * 10;
        this.detectionRange = 250;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(1.1, 2.3);
        this.stepT = Math.random() * 6;
        this.moving = false;
        this.gray = false;                  // nachtblaues Fell (Schlüsselträger)
        this.aim = null;                    // {x, y} Ziel der Staubwolke
        this.charge = 0;                    // 0..1 Horn laden (Vorwarnung)
        this.shotFlash = 0;
        this.dust = [];
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.gray ? P_NIGHT : P_WHITE; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.shotFlash > 0) this.shotFlash -= dt;
        this.dust = this.dust.filter(d => !d.dead);
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): nachtblau, silbern, etwas zäher
            this._keyInit = true;
            this.gray = true;
            this.hp = this.maxHp = 10;
            this.speed *= 0.94;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'aim') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('prance', 0.72);      // bockt hoch, damit Kinder das Einhorn erst sehen
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'prance':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'aim':
                this.charge += dt / (this.gray ? 0.46 : 0.58);
                if (this.charge < 0.7) {
                    const tgt = UnicornArt.pickAim(world, mx, my, player, 260, this.gray ? 0.5 : 0.32);
                    if (tgt) this.aim = tgt;
                }
                if (this.charge >= 1) {
                    this.charge = 0;
                    this._set('shoot', 0.2);
                }
                break;
            case 'shoot':
                if (this.stateT <= 0) {
                    this._fire(projectiles);
                    this.cool = this.gray ? randRange(2.2, 3) : randRange(1.9, 2.7);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, dann Horn aufladen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.stepT += dt * 2.2;
            this._moveWithCollision(Math.sin(this.stepT * 0.7 + this.seed) * this.speed * 0.25 * dt,
                Math.cos(this.stepT * 0.5 + this.seed) * this.speed * 0.25 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 150) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 66) { vx = -dx / dist; vy = -dy / dist; }
        else if ((Math.floor(this.stepT) + this.seed) % 5 < 2) { vx = -dy / dist; vy = dx / dist; }
        if (vx || vy) {
            this._moveWithCollision(vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.stepT += dt * 6.2;
        } else this.stepT += dt * 1.8;
        if (this.cool > 0 || dist > 250) return;
        const tgt = UnicornArt.pickAim(world, this.centerX(), this.centerY() - 8, player, 250, this.gray ? 0.5 : 0.32);
        if (!tgt) { this.cool = 0.5; return; }
        this.aim = tgt;
        if (Math.abs(tgt.x - this.centerX()) > 4) this.face = tgt.x > this.centerX() ? 1 : -1;
        this._set('aim', 0.01);
    }

    _fire(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        if (UnicornArt.totalShots(list) >= DUST_CAP48) return;
        const mx = this.centerX(), my = this.centerY() - 8;
        const a = this.aim ? Math.atan2(this.aim.y - my, this.aim.x - mx) : Math.atan2(this.look.y, this.look.x || 1);
        // Schlüsselträger: drei Wolken im kleinen Fächer, sonst eine gezielte
        const n = this.gray ? 3 : 1;
        for (let i = 0; i < n; i++) {
            if (UnicornArt.dustCount(list, this) >= 4) break;     // pro Einhorn bleiben es höchstens vier
            if (UnicornArt.totalShots(list) >= DUST_CAP48) break;
            const aa = a + (i - (n - 1) / 2) * 0.19;
            const d = new RainbowDust(mx + Math.cos(aa) * 14, my + Math.sin(aa) * 14, aa, this.gray ? 152 : 165, false, this);
            list.push(d);
            this.dust.push(d);
        }
        this.shotFlash = 0.16;
        UnicornArt.burst(mx + Math.cos(a) * 15, my + Math.sin(a) * 15, RAINBOW48, 6, 105, 0.3, { kind: 'star' });
    }

    // Vorwarnung am Boden: der Zielkreis füllt sich, während das Horn glüht
    drawUnder(ctx, camera) {
        if (this.dead || this.state !== 'aim' || !this.aim) return;
        const p = camera.worldToScreen(this.aim.x, this.aim.y);
        LateWorldArt.warn(ctx, p.x, p.y, 20, this.charge, U48.warn);
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 16)) {
                ctx.translate(cx, foot);
                this._body(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 17 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Einhorn mit Fußpunkt (0, 0); Zeichnung in UnicornArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const rear = st === 'prance' ? Math.sin(k * Math.PI) : (st === 'aim' ? 0.28 : 0);
        const walk = this.moving && !dead ? Math.sin(this.stepT * 2) : 0;
        const bob = dead ? -1.4 : (this.moving ? Math.abs(walk) * 1.3 : Math.sin(t * 2) * 0.7) - rear * 1.4;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 2) * 0.014);
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -20, 26, U48.keyHorn, 0.26 + 0.09 * Math.sin(t * 3));
        if (st === 'aim' && !dead) {
            const g = 0.3 + 0.7 * this.charge;
            Art.glow(ctx, 17 + this.charge * 3, -38 - this.charge * 3, 12 + 9 * this.charge, U48.horn, g);
            if (this.charge > 0.72) Art.sparkle(ctx, 20, -42, 3.4 + 1.6 * Math.sin(t * 20), '#ffffff', 0.9);
        }
        if (this.shotFlash > 0 && !dead) Art.glow(ctx, 20, -40, 22, U48.maneB, 0.6);
        const mood = dead ? 'dead' : st === 'shoot' || st === 'aim' ? 'open' : tired ? 'tired' : this._engaged ? 'angry' : 'calm';
        UnicornArt.figure(ctx, {
            c, lw: 1.2, t, bob, walkAmt: this.moving && !dead ? 1 : 0, stepT: this.stepT, seed: this.seed,
            tilt: -rear * 0.16, rear, mood, look: { x: this.look.x * this.face, y: this.look.y },
            horns: 1, stars: this.gray ? STARS_NIGHT : null, shine: !dead && (st === 'aim' || st === 'shoot'),
        });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESEN-EINHORN mit drei Hörnern (Endgegner Welt 48) ──
// ══════════════════════════════════════════

class BossGiantUnicorn extends Enemy {
    constructor(x, y) {
        super(x, y, 96, 88);
        this.hp = 140;
        this.maxHp = 140;
        this.speed = 34;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.phasesThroughWalls = false;
        this.shadow = { rx: 44, ry: 14, dy: 42, alpha: 0.32 };
        this.fxColor = U48.maneA;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 1.9;
        this.stateDur = 1.9;
        this.seq = 0;
        this.cool = 0.8;
        this.stepT = 0;
        this.moving = false;
        this.aim = null;                    // {x, y} Ziel des Staubfachers
        this.fanA = 0;                      // Mittelwinkel des Fachers
        this.ringA = 0;                     // Drehung des Staubsturms
        this.ringLeft = 0;                  // verbleibende Ringe des Sturms
        this.lullR = 112;                   // Radius des Schlaflied-Kreises
        this.bigHits = 0;                   // große Angriffe seit dem Phasenwechsel (Schwindel)
        this.dust = [];                     // eigene Wolken (Obergrenze)
        this.angry = 0;                     // 0..1 Glühen in Phase 2
    }

    static room(world) { return UnicornArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
        if (state !== 'walk') this.moving = false;      // solange der Boss angreift, stehen die Beine still
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) { this.dust.length = 0; return; }    // tote Bosse bleiben in der Liste – Wolken-Referenzen loslassen
        this.dust = this.dust.filter(d => !d.dead);
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 48;
            this.bigHits = 0;
            UnicornArt.burst(mx, my - 20, RAINBOW48, 26, 210, 0.75, { kind: 'star' });
            UnicornArt.ring(mx, my, U48.maneB, 108, 0.6, 6);
            UnicornArt.shake(8, 0.45);
        }
        if (this.state !== 'intro' && this.state !== 'lull') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'fanWind':
                if (this.stateT <= 0) {
                    this._fireFan(projectiles);
                    this._set('fanFire', 0.24);
                }
                break;
            case 'fanFire':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'stormWind':
                if (this.stateT <= 0) {
                    this._fireRing(projectiles);
                    this.ringLeft--;
                    this._set('stormSpin', this.phase === 2 ? 0.44 : 0.5);
                }
                break;
            case 'stormSpin':
                if (this.stateT <= 0) {
                    if (this.ringLeft > 0) {
                        this.ringA += 0.34;
                        this._set('stormWind', this.phase === 2 ? 0.36 : 0.5);
                    } else this._afterBig();
                }
                break;
            case 'lullWind':
                if (this.stateT <= 0) {
                    this._sing();
                    this._set('lullHold', 0.6);
                }
                break;
            case 'lullHold':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'dizzy':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default:                        // rest
                if (this.stateT <= 0) this._set('walk', 0);
        }
        UnicornArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.stepT += dt * 1.8; return; }
        this.stepT += dt * 4.4;
        let vx = 0, vy = 0;
        if (dist > 150) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 84) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        this._moveWithCollision(vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool <= 0) this._nextAttack(world, player, dist);
    }

    _nextAttack(world, player, dist) {
        const cyc = this.phase === 2 ? BossGiantUnicorn.CYCLE2 : BossGiantUnicorn.CYCLE1;
        const what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'fan') {
            const t = UnicornArt.nearestTarget(world, this.centerX(), this.centerY(), player, 420);
            if (!t) { this.cool = 0.6; return; }
            this.aim = { x: t.x, y: t.y };
            const hx = this.centerX() + this.face * 24, hy = this.centerY() - 42;
            this.fanA = Math.atan2(t.y - hy, t.x - hx);
            if (Math.abs(t.x - this.centerX()) > 8) this.face = t.x > this.centerX() ? 1 : -1;
            this._set('fanWind', this.phase === 2 ? 0.52 : 0.68);
        } else if (what === 'storm') {
            this.ringA = randRange(0, TAU);
            this.ringLeft = this.phase === 2 ? 2 : 1;
            this._set('stormWind', this.phase === 2 ? 0.56 : 0.74);
        } else if (what === 'lull') {
            this.lullR = this.phase === 2 ? 132 : 112;
            this._set('lullWind', this.phase === 2 ? 1.25 : 1.5);
        } else this.cool = this.phase === 2 ? 0.5 : 0.9;   // bewusste Verschnaufpause
    }

    // ── a) Staubfächer: farbige Warnstrahlen, dann drei (Phase 2 fünf) Wolken ──
    _fireFan(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const hx = this.centerX() + this.face * 24, hy = this.centerY() - 42;
        const n = this.phase === 2 ? 5 : 3;
        const spread = 0.21;
        for (let i = 0; i < n; i++) {
            if (UnicornArt.totalShots(list) >= DUST_CAP48) break;
            const a = this.fanA + (i - (n - 1) / 2) * spread;
            const d = new RainbowDust(hx + Math.cos(a) * 26, hy + Math.sin(a) * 26, a, randRange(168, 186), true, this);
            list.push(d);
            this.dust.push(d);
        }
        UnicornArt.burst(hx, hy, RAINBOW48, 12, 150, 0.4, { kind: 'star' });
        UnicornArt.shake(4, 0.16);
    }

    // ── b) Staubsturm: Ring aus Wolken rund um das Rieseneinhorn ──
    _fireRing(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const n = this.phase === 2 ? 12 : 8;
        const hx = this.centerX(), hy = this.centerY() - 34;
        for (let i = 0; i < n; i++) {
            if (UnicornArt.totalShots(list) >= DUST_CAP48) break;
            const a = this.ringA + (TAU * i) / n;
            const d = new RainbowDust(hx + Math.cos(a) * 34, hy + Math.sin(a) * 34, a, 142, true, this);
            list.push(d);
            this.dust.push(d);
        }
        UnicornArt.ring(hx, hy + 24, U48.maneB, 60, 0.4, 5);
        UnicornArt.burst(hx, hy, RAINBOW48, 16, 175, 0.45, { kind: 'star' });
        UnicornArt.shake(5.5, 0.22);
    }

    // ── c) Schlaflied: Wer im warnenden Kreis steht, schläft drei Sekunden ein ──
    _sing() {
        const mx = this.centerX(), my = this.centerY();
        UnicornArt.lull(mx, my, this.lullR, 3);
        UnicornArt.ring(mx, my, U48.note, this.lullR, 0.55, 7);
        UnicornArt.ring(mx, my, '#ffffff', this.lullR * 0.6, 0.4, 4);
        UnicornArt.burst(mx, my - 40, [U48.note, U48.maneB, '#ffffff'], 20, 150, 0.8, { kind: 'star' });
        UnicornArt.shake(4.5, 0.3);
    }

    // Nach großen Angriffen: Verschnaufpause – und in Phase 2 wird das Rieseneinhorn schwindelig.
    _afterBig() {
        this.bigHits++;
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', this.hp <= this.maxHp * 0.3 ? 2.3 : 1.7);
            UnicornArt.burst(this.centerX(), this.centerY() - 70, ['#ffe35a', '#ffffff'], 10, 95, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.6 : 0.95;
        this._set('rest', this.cool + 0.4);
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const mx = this.centerX(), my = this.centerY();
        if (st === 'fanWind') {
            const p = camera.worldToScreen(mx + this.face * 24, my - 42);
            const n = this.phase === 2 ? 5 : 3;
            LateWorldArt.rays(ctx, p.x, p.y, n, this.fanA - ((n - 1) / 2) * 0.21, 26, 168, this._k(), U48.warn);
            return;
        }
        if (st === 'stormWind') {
            const p = camera.worldToScreen(mx, my - 34);
            const n = this.phase === 2 ? 12 : 8;
            LateWorldArt.rays(ctx, p.x, p.y, n, this.ringA, 30, 128, 0.6 + 0.4 * Math.sin(Art.time * 16), U48.warn);
            return;
        }
        if (st === 'lullWind' || st === 'lullHold') {
            const p = camera.worldToScreen(mx, my);
            const k = st === 'lullHold' ? 1 : 1 - this.stateT / this.stateDur;
            LateWorldArt.warn(ctx, p.x, p.y, this.lullR, k, U48.warn);
            const prev = ctx.globalAlpha;
            ctx.strokeStyle = U48.note;
            ctx.globalAlpha = prev * (0.35 + 0.3 * Math.abs(Math.sin(Art.time * 4)));
            ctx.lineWidth = 2.4;
            ctx.setLineDash([9, 7]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.lullR * (0.35 + 0.65 * k), 0, TAU);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = prev;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 40);
            ctx.translate(cx, foot);
            this._body(ctx, true);
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
        // Schlaflied: funkelnde Noten steigen um das Rieseneinhorn auf (Vorwarnung)
        if (!this.dead && (this.state === 'lullWind' || this.state === 'lullHold')) {
            const p = camera.worldToScreen(cx, pos.y + 18);
            const k = this.state === 'lullHold' ? 1 : 1 - this.stateT / this.stateDur;
            UnicornArt.lullabyNotes(ctx, p.x, p.y, this.lullR, k, this.seed, 2.1);
        }
    }

    // Rieseneinhorn: dieselbe Figur wie die normalen Einhörner, 2,5-mal so groß, mit drei Hörnern.
    // Phase 2 mit rotem Blick, Regenbogenglanz und aufgestellten Hörnern; schwindelig mit Sternen.
    _body(ctx, dead) {
        const S = 2.5;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'rest';
        const lull = st === 'lullWind' || st === 'lullHold';
        const wind = st === 'fanWind';
        const storm = st === 'stormWind';
        const intro = st === 'intro';
        const walk = this.moving && !dizzy && !dead ? 1 : 0;
        const bob = dead ? -1.6 : (this.moving ? Math.abs(Math.sin(this.stepT * 2)) * 1.5 : Math.sin(t * 1.7) * 1.1)
            - (rest ? 1.6 : 0) + (lull ? Math.sin(t * 3) * 0.8 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(Math.sin(this.stepT * 2)) * 0.03 : Math.sin(t * 1.7) * 0.014);
        const sway = dizzy ? Math.sin(t * 4.6) * 0.1 : 0;
        const rear = intro || storm ? Math.sin(clamp(k, 0, 1) * Math.PI) * 0.5 : 0;
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, -22, 34, U48.maneA, 0.16 * this.angry + 0.05 * Math.sin(t * 6));
        // Hornleuchten beim Ansetzen (Vorwarnung, gut sichtbar über dem Kopf)
        if ((wind || lull || intro) && !dead) {
            const g = intro ? 0.35 + 0.25 * Math.sin(t * 8) : 0.35 + 0.65 * (lull ? 1 - this.stateT / this.stateDur : k);
            Art.glow(ctx, 20, -46, 16 + 10 * g, p2 ? '#ff6fae' : U48.horn, g);
            Art.sparkle(ctx, 24, -52, 3.4 + 2 * Math.sin(t * 12), '#ffffff', 0.8 + 0.2 * Math.sin(t * 15));
        }
        const mood = dead ? 'dead' : dizzy ? 'dizzy' : lull ? 'sleepy'
            : (wind || storm || intro || st === 'fanFire') ? 'open' : rest ? 'tired' : 'angry';
        UnicornArt.figure(ctx, {
            c: P_WHITE, lw: 0.72, t, bob, walkAmt: walk, stepT: this.stepT, seed: this.seed,
            tilt: -rear * 0.2 + sway, rear, mood, headDy: dizzy ? 1.6 : 0,
            look: { x: this.look.x * this.face, y: this.look.y },
            horns: 3, stars: null, shine: p2 && !dead, red: p2,
        });
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 1.4 * S * this.face, -104, 24, 4.6);
        // Regenbogen-Funkelkranz in Phase 2
        if (p2 && !dead && !dizzy) {
            for (let i = 0; i < 4; i++) {
                const a = t * 1.6 + (TAU * i) / 4;
                const r = 52 + Math.sin(t * 3 + i) * 6;
                Art.sparkle(ctx, Math.cos(a) * r, -52 + Math.sin(a) * 16,
                    3 + 1.4 * Math.sin(t * 6 + i), RAINBOW48[(i + Math.floor(t * 3)) % RAINBOW48.length], 0.55 + 0.35 * Math.sin(t * 5 + i));
            }
        }
    }
}

BossGiantUnicorn.CYCLE1 = ['fan', 'lull', 'storm', 'walk'];
BossGiantUnicorn.CYCLE2 = ['fan', 'storm', 'lull', 'fan', 'walk'];
