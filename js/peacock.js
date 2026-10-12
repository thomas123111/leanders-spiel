// ── Welt 45: Pfauen-Insel (Idee von Leander, 11.10.2026) ──
// Pfauen mit blauem Gefieder, Krone (Scheitelfedern) auf dem Kopf und langer Schleppe hinter sich her.
//   Der Pfau mit dem Schlüssel ist türkis, alle anderen sind blau.
//   Von weitem schießt er Federn auf Mark und seine Freunde, aus der Nähe kratzt er mit den scharfen
//   Krallen – ein Kratzer macht normalen Schaden, kein Gift (Korrektur aus Claudes Abnahme: Gift war
//   nicht bestellt).
// Boss: RIESENPAU – schlägt sein Rad auf. Aus den Augenflecken im Rad schießen Laserstrahlen:
//   erst leuchten die Augen auf und dünne Warnlinien zeigen die Richtung, dann wandert eine Welle
//   kurzer Strahlen über das Rad (Phase 2: zweimal, erst hin, erst zurück). Abgrenzung zum
//   Riesenadler (Welt 41): bei ihm kommt Federhagel aus dem Maul, hier kommen die Strahlen aus
//   vielen Augen im aufgeschlagenen Rad.
//   Weitere Angriffe: Federschuss (Fächer auf Mark plus eine Feder auf einen Freund), Drehangriff
//   mit Rad – der Wirbel aus Federn macht Benommenheit im Kreis, aber schläfert nicht mehr ein
//   (Korrektur aus Claudes Abnahme), und der Sturzflug auf Mark oder einen Freund
//   mit Zielkreis vorher; die Landung kratzt mit normalem Schaden und ohne Gift.
//   Phase 2 (halbe Lebenskraft): schneller, mehr Federn, zwei Strahlenwellen – und nach großen
//   Angriffen wird er schwindelig (Sterne um den Kopf, kurz wehrlos, wie der Riesen-Gorilla).
//   Lebenspunkte 140, Schaden 2 – im Rahmen von Welt 43 und 44.
//   Freunde verschwinden nie: ein tödlicher Treffer haut Juri und das Krokodil nur um (knockOut).

const PeacockCfg = {
    blue: '#2f74d8',        // helles Pfauenblau (Brust und Hals)
    blueMid: '#245aab',
    blueDark: '#163c78',
    wing: '#2c8fc6',        // Flügel: blau mit Stich ins Türkise
    wingDark: '#1a6291',
    train: '#1f9e72',       // Schleppe und Rad: satte Grüntöne mit Glanz
    trainMid: '#177f5c',
    trainDark: '#0d5a41',
    spotGold: '#e0b64a',    // Augenfleck: goldener Ring …
    spotBlue: '#2f9fd8',    // … blaue Mitte …
    spotDeep: '#12306e',    // … dunkles Auge
    crest: '#3fd8c4',       // Kronenfeder: türkis glänzende Tropfen
    beak: '#f2c14e',
    beakDark: '#c18e26',
    legs: '#c99a5e',        // Beine und Krallen
    claw: '#fff2cf',
    keyBlue: '#1ec2bd',     // Schlüsselträger: türkis statt blau
    keyMid: '#14a09f',
    keyDark: '#0a7174',
    keyWing: '#26cfd2',
    keyWingDark: '#128f9c',
    laser: '#7cf2ff',
    laserCore: '#e8feff',
    warn: '#ff5a3d',
    star: '#ffe35a',
};

// Zwei Gefiederpaletten: blau (alle) und türkis (Schlüsselträger)
const C_BLUE = {
    body: PeacockCfg.blue, bodyMid: PeacockCfg.blueMid, bodyDark: PeacockCfg.blueDark,
    wing: PeacockCfg.wing, wingDark: PeacockCfg.wingDark,
};
const C_TUERKIS = {
    body: PeacockCfg.keyBlue, bodyMid: PeacockCfg.keyMid, bodyDark: PeacockCfg.keyDark,
    wing: PeacockCfg.keyWing, wingDark: PeacockCfg.keyWingDark,
};

const PEACOCK_FEATHER_CAP = 44;   // nie mehr als so viele Pfauen-Geschosse gleichzeitig (Handy)
const PCST = 2.5;                 // Boss-Figur: 2,5-mal so groß wie ein normaler Pfau
const PC_HUB_DY = 46;             // Radmittelpunkt des Bosses: 46 Einheiten über dem Fußpunkt
const PC_WHEEL_R = 66;            // Radradius des Bosses (Bildschirmeinheiten)

const PeacockArt = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine direkt.
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && typeof Game.hurtPlayer === 'function') {
            Game.hurtPlayer(amount, angle, force);
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
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [PeacockCfg.trainDark, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    // Freier Punkt in der Welt (für Landeziele)?
    free(world, x, y, r) {
        if (!world || !world.collideRect) return true;
        return world.collideRect({ x: x - r, y: y - r, w: r * 2, h: r * 2 }).length === 0;
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

    // Flächenschaden: trifft Mark und die Freunde innerhalb von R, jeder höchstens einmal (hit-Liste).
    // Nur Schaden – kein Gift und kein Schlaf (Korrektur aus Claudes Abnahme).
    areaHit(x, y, R, amount, force, hit) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (hit) hit.push(t.ref);
            if (t.isPlayer) {
                this.hurt(t.ref, amount, Math.atan2(t.y - y, t.x - x), force);
            } else {
                this.hitCompanion(t.ref, amount);
            }
        }
    },

    // Ziel für den Sturzflug/Sprung: Mark oder der nächste Freund, auf freiem Boden, im Boss-Raum.
    dropTarget(world, e, player, minD, maxD) {
        const cx = e.centerX(), cy = e.centerY();
        let best = null;
        for (const t of this.targets(player)) {
            const d = Math.hypot(t.x - cx, t.y - cy);
            if (d < 20) continue;
            if (!best || d < best.d) best = { t, d };
        }
        if (!best) return null;
        const want = clamp(best.d, minD, maxD);
        let x = cx + ((best.t.x - cx) / best.d) * want;
        let y = cy + ((best.t.y - cy) / best.d) * want;
        const room = e.isBoss ? this.room(world) : null;
        if (room) {
            x = clamp(x, room.x + e.w / 2 + 6, room.x + room.w - e.w / 2 - 6);
            y = clamp(y, room.y + e.h / 2 + 6, room.y + room.h - e.h / 2 - 6);
        }
        const r = Math.min(e.w, e.h) * 0.4;
        if (!this.free(world, x, y, r)) return null;
        return { x, y };
    },

    // Länge eines Strahls bis zur ersten Wand (in 8er-Schritten), nie länger als max.
    beamLen(world, x0, y0, a, max) {
        if (!world || !world.isWall) return max;
        const ca = Math.cos(a), sa = Math.sin(a);
        let free = false;
        for (let d = 0; d <= max; d += 8) {
            const wall = world.isWall(x0 + ca * d, y0 + sa * d);
            if (!free) {
                if (!wall) free = true;
                continue;
            }
            if (wall) return Math.max(0, d - 4);
        }
        return free ? max : 0;
    },

    // Dünne Warnlinien über den Fächer: n Linien von base-spread bis base+spread, k = Füllstand.
    fanWarn(ctx, x, y, n, base, spread, r0, r1, k, color) {
        const prev = ctx.globalAlpha;
        ctx.lineCap = 'round';
        ctx.strokeStyle = color;
        const line = (to) => {
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const q = n === 1 ? 0.5 : i / (n - 1);
                const a = base - spread + 2 * spread * q;
                ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
                ctx.lineTo(x + Math.cos(a) * to, y + Math.sin(a) * to);
            }
        };
        ctx.globalAlpha = prev * 0.18;
        ctx.lineWidth = 7;
        line(r1);
        ctx.globalAlpha = prev * (0.55 + 0.35 * Math.sin(Art.time * 18));
        ctx.lineWidth = 2.6;
        line(r0 + (r1 - r0) * clamp(k, 0, 1));
        ctx.globalAlpha = prev;
    },

    // Trifft ein Strahl von (x0, y0) in Richtung a (von r0 bis len) das Ziel?
    beamHit(x0, y0, a, r0, len, tx, ty, band) {
        if (len <= r0) return false;
        const ca = Math.cos(a), sa = Math.sin(a);
        const dx = tx - x0, dy = ty - y0;
        const along = dx * ca + dy * sa;
        if (along < r0 || along > len) return false;
        return Math.abs(dx * sa - dy * ca) <= band;
    },

    // ── Augenfleck: goldener Ring, blaue Mitte, dunkles Auge (das Erkennungszeichen im Rad) ──
    spot(ctx, x, y, r, glow, lw) {
        const w = Math.max(0.4, r * 0.14);
        Art.body(ctx, x, y, r, r * 1.14, PeacockCfg.spotGold, { lineWidth: lw === undefined ? w : lw, highlight: false });
        Art.body(ctx, x, y - r * 0.06, r * 0.72, r * 0.84, PeacockCfg.spotBlue, { lineWidth: w, highlight: false });
        Art.body(ctx, x, y - r * 0.04, r * 0.4, r * 0.5, PeacockCfg.spotDeep, { lineWidth: w * 0.8, highlight: false });
        if (glow > 0.05) Art.glow(ctx, x, y, r * 2.8, PeacockCfg.laser, 0.2 + 0.65 * glow);
    },

    // ── Eine Pfauenfeder: Schaft von (0,0) nach (len,0), Blättchen, Augenfleck an der Spitze ──
    feather(ctx, len, col, o = {}) {
        const lw = o.lineWidth === undefined ? 0.8 : o.lineWidth;
        const w = Math.max(0.6, len * (o.wide === undefined ? 0.2 : o.wide));
        Art.shape(ctx, g => {
            g.moveTo(0, 0);
            g.quadraticCurveTo(len * 0.5, -w, len * 0.9, -w * 0.36);
            g.quadraticCurveTo(len, 0, len * 0.9, w * 0.36);
            g.quadraticCurveTo(len * 0.5, w, 0, 0);
            g.closePath();
        }, { x: 0, y: -w, w: Math.max(1, len), h: w * 2 }, col, { lineWidth: lw });
        ctx.strokeStyle = Art.dark(col, 0.28);
        ctx.lineWidth = Math.max(0.35, len * 0.022);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 1; i <= 3; i++) {
            const q = 0.24 + i * 0.16;
            const h = w * (0.86 - q * 0.4);
            ctx.moveTo(len * q, 0);
            ctx.lineTo(len * (q + 0.13), -h);
            ctx.moveTo(len * q, 0);
            ctx.lineTo(len * (q + 0.13), h);
        }
        ctx.stroke();
        Art.limb(ctx, 0, 0, len * 0.96, 0, Math.max(0.45, len * 0.032), Art.dark(col, 0.16), { outline: false });
        if (o.eye) this.spot(ctx, len * 0.8, 0, len * (o.eyeR || 0.19), o.eye === true ? 0 : o.eye, lw);
    },

    // ── Das aufgeschlagene Rad: n Federn um (x, y), off = 0..1, base = Blickrichtung in Weltwinkel ──
    // Zeichnet in Bildschirmeinheiten (der Aufrufer rechnet Welt -> Bildschirm).
    wheel(ctx, x, y, R, off, base, n, spread, glow, t, ink) {
        if (off <= 0.01) return;
        const len = R * (0.55 + 0.45 * off);
        const lw = Math.max(0.7, R * 0.018);
        // Weicher Grünschimmer hinter dem Rad, damit es auf hellem Marmor leuchtet
        Art.glow(ctx, x, y, R * 1.15, PeacockCfg.train, 0.12 + 0.16 * off);
        for (let i = 0; i < n; i++) {
            const q = n === 1 ? 0.5 : i / (n - 1);
            const a = base - spread + 2 * spread * q;
            const sway = Math.sin(t * 1.6 + i * 0.7) * 0.022;
            const ll = len * (0.86 + 0.14 * Math.cos((q - 0.5) * 2.6));
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a + sway);
            this.feather(ctx, ll, i % 2 ? PeacockCfg.train : PeacockCfg.trainMid, {
                eye: glow, eyeR: 0.155, lineWidth: lw, wide: 0.24,
            });
            ctx.restore();
        }
        // Deckfedern unten am Radansatz (goldene Spitze), verdecken den Ansatz
        for (let i = 0; i < 5; i++) {
            const a = base - 0.7 + (i * 1.4) / 4;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(a);
            this.feather(ctx, R * 0.42, PeacockCfg.trainDark, { lineWidth: lw, wide: 0.3 });
            ctx.restore();
        }
        if (ink) {
            Art.body(ctx, x, y, R * 0.2, R * 0.2, PeacockCfg.trainDark, { lineWidth: lw });
        }
    },

    // ── Ganze Figur: Pfau von vorn, leicht in Blickrichtung gedreht, Fußpunkt (0, 0). ──
    // Ein Einheit = normaler Pfau; der Boss zeichnet dieselbe Figur größer (ctx.scale vorher).
    // Lange Schleppe hintenhoch, Krone aus Scheitelfedern, weißer Fleck über jedem Auge, gelber Schnabel.
    // p = { c, lw, t, bob, walk, mood, look, off (Rad offen 0..1), base, wheelR, n, lift,
    //       clawK (Kralle vorn 0..1), wingLift, lean, spin (Rotationswinkel), red, crest }
    figure(ctx, p) {
        const c = p.c, lw = p.lw;
        const t = p.t;
        const hip = -10 - p.bob;
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        const spin = p.spin || 0;
        // ── Schleppe (hintenhoch, lang) – beim offenen Rad vom Rad übernommen ──
        if (p.off < 0.02) {
            for (let i = 0; i < 5; i++) {
                const q = i / 4;
                const a = Math.PI + 0.5 + q * 0.85 + Math.sin(t * 1.3 + i * 0.9) * 0.035;
                const len = (15 + 8 * Math.sin(q * Math.PI)) * (mood === 'dead' ? 0.9 : 1);
                ctx.save();
                ctx.translate(-2.4, hip - 7);
                ctx.rotate(a);
                PeacockArt.feather(ctx, len, i % 2 ? PeacockCfg.train : PeacockCfg.trainMid, { eye: true, eyeR: 0.14, lineWidth: lw * 0.7, wide: 0.19 });
                ctx.restore();
            }
        }
        // ── Beine mit scharfen Krallen ──
        const lift = p.legLift || [0, 0];
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const up = lift[i] || 0;
            const kx = s * 3.4 + (i === 1 ? (p.clawK || 0) * 3.2 : 0);
            const ky = -2.2 - up - (i === 1 ? (p.clawK || 0) * 4.4 : 0);
            Art.limb(ctx, s * 2.6, hip - 1, kx, ky, 2.1, PeacockCfg.legs, { lineWidth: lw * 0.7 });
            ctx.strokeStyle = PeacockCfg.claw;
            ctx.lineWidth = Math.max(0.5, lw * 0.75);
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const d of [-2.2, 0.2, 2.4]) {
                ctx.moveTo(kx, ky + 0.4);
                ctx.lineTo(kx + d, ky + 1.9 + Math.abs(d) * 0.18);
            }
            ctx.stroke();
        }
        // ── Körper: hohe Brust, Rücken rund ──
        const bx = 0, by = hip - 11;
        Art.shape(ctx, g => {
            g.moveTo(bx - 6.6, hip + 0.5);
            g.bezierCurveTo(bx - 10.5, hip - 5, bx - 9.4, hip - 15, bx - 4.6, hip - 20);
            g.bezierCurveTo(bx - 1, hip - 23, bx + 3.4, hip - 22.6, bx + 6.2, hip - 19);
            g.bezierCurveTo(bx + 10, hip - 14, bx + 9.6, hip - 4.6, bx + 6, hip + 0.6);
            g.quadraticCurveTo(bx, hip + 3, bx - 6.6, hip + 0.5);
            g.closePath();
        }, { x: bx - 11, y: hip - 23, w: 22, h: 26 }, c.body, { glossy: true, lineWidth: lw });
        // Brustglanz (helles Pfauenblau)
        Art.body(ctx, bx + 2.2, hip - 13.4, 4.6, 6.6, Art.light(c.body, 0.24), { highlight: false, outline: false, rot: 0.16 });
        // ── Flügel ──
        const wl = p.wingLift || 0;
        for (const s of [-1, 1]) {
            const front = s > 0;
            ctx.save();
            ctx.translate(bx + s * 6.4 - 0.4, hip - 11 + (front ? -wl * 3.4 : 0));
            ctx.rotate(s * (0.22 - (front ? wl * 0.9 : 0)) + spin * 0.2);
            Art.shape(ctx, g => {
                g.moveTo(0, -5.6);
                g.quadraticCurveTo(s * 4.4, -2.4, s * 3.6, 5.4);
                g.quadraticCurveTo(0, 7.4, -1.6, 3.4);
                g.quadraticCurveTo(-2.4, -1.4, 0, -5.6);
                g.closePath();
            }, { x: -2.6, y: -6, w: 7.4, h: 14 }, front ? c.wing : c.wingDark, { lineWidth: lw * 0.85 });
            // Federreihen im Flügel
            ctx.strokeStyle = Art.dark(front ? c.wing : c.wingDark, 0.3);
            ctx.lineWidth = Math.max(0.4, lw * 0.6);
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const yy = -2.4 + i * 2.6;
                ctx.moveTo(-1.2, yy);
                ctx.quadraticCurveTo(s * 1.4, yy + 1.4, s * 3, yy + 0.6);
            }
            ctx.stroke();
            ctx.restore();
        }
        // ── Hals ──
        const hx0 = 1.4, hy0 = hip - 20;
        const nx = 2 + (p.lean || 0) * 2.4, ny = -30.5 - p.bob * 0.4;
        Art.limb(ctx, hx0, hy0, nx, ny, 4.6, c.bodyMid, { lineWidth: lw });
        // ── Kopf ──
        const hx = nx, hy = ny - 1.4;
        Art.body(ctx, hx, hy, 5, 4.7, c.body, { glossy: true, lineWidth: lw });
        // Weiße Sicheln über den Augen (typisch Pfau)
        for (const s of [-1, 1]) {
            Art.body(ctx, hx + s * 2.6, hy - 1.9, 2, 1.15, '#f2fbff', { highlight: false, lineWidth: lw * 0.5, rot: -s * 0.4 });
        }
        // ── Krone: drei Scheitelfedern mit türkis glänzenden Tropfen ──
        for (let i = 0; i < 3; i++) {
            const a = -Math.PI / 2 + (i - 1) * 0.42 + Math.sin(t * 2 + i) * 0.05;
            const lx = hx + Math.cos(a) * 1.2, ly = hy - 3.6 + Math.sin(a) * 0.6;
            const tx = lx + Math.cos(a) * 5.4, ty = ly + Math.sin(a) * 5.4;
            Art.limb(ctx, lx, ly, tx, ty, 0.85, c.bodyDark, { lineWidth: lw * 0.5 });
            Art.body(ctx, tx, ty, 1.5, 1.7, PeacockCfg.crest, { lineWidth: lw * 0.6, glossy: true });
        }
        // ── Schnabel ──
        Art.shape(ctx, g => {
            g.moveTo(hx + 3.6, hy - 1.6);
            g.lineTo(hx + 9.6, hy + 0.5);
            g.lineTo(hx + 3.6, hy + 2.4);
            g.closePath();
        }, { x: hx + 3.4, y: hy - 2, w: 6.6, h: 4.6 }, PeacockCfg.beak, { lineWidth: lw * 0.8 });
        ctx.strokeStyle = PeacockCfg.beakDark;
        ctx.lineWidth = Math.max(0.4, lw * 0.6);
        ctx.beginPath();
        ctx.moveTo(hx + 3.8, hy + 0.6);
        ctx.lineTo(hx + 8.8, hy + 0.55);
        ctx.stroke();
        // ── Augen ──
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, hx, hy + 0.1, 1.5, 2.4);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.8;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.2 + i * 0.1;
                    const x = hx + s * 2.4 + Math.cos(a) * r, y = hy + 0.1 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, hx + s * 2.4, hy + 0.1, 1.7, { x: look.x, y: look.y }, {
                    angry: mood === 'angry' || mood === 'open', side: s < 0 ? 'left' : 'right',
                    iris: p.red ? '#ff3b3b' : '#1d3f7a', open: mood === 'tired' ? 0.5 : 1,
                });
            }
        }
        return { hx, hy };
    },
};

// ══════════════════════════════════════════
// ── Pfauenfeder (Geschoß) ──
// ══════════════════════════════════════════

// Blaue Feder mit Augenfleck, fliegt in leichtem Bogen (anderes Flugbild als die spitze Adlerfeder).
// Trifft Mark über die Engine; hitsCompanions + stunTime lässt die Engine auch Juri und das Krokodil
// treffen (die werden betäubt, nie besiegt).
class PeacockFeather extends Projectile {
    constructor(x, y, angle, speed) {
        const sp = speed || randRange(132, 158);
        super(x, y, Math.cos(angle) * sp, Math.sin(angle) * sp, 1, 'enemy', 70);
        this.radius = 6;
        this.lifetime = 2.4;
        this.hitsCompanions = true;
        this.stunTime = 1.2;
        this.wob = Math.random() * 10;
        this.spin = Math.random() * TAU;
    }

    update(dt, world) {
        // Feder driftet: sie dreht langsam ab, statt kerzengerade zu fliegen
        const a = Math.atan2(this.vy, this.vx) + Math.sin(this.age * 4.4 + this.wob) * 1.1 * dt;
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(a) * sp;
        this.vy = Math.sin(a) * sp;
        this.spin += dt * 7;
        super.update(dt, world);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const a = Math.atan2(this.vy, this.vx);
        Art.glow(ctx, p.x, p.y, 13, PeacockCfg.blue, 0.42);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a + Math.sin(this.spin) * 0.32);
        PeacockArt.feather(ctx, 13, PeacockCfg.train, { eye: true, eyeR: 0.17, lineWidth: 0.9, wide: 0.24 });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Normaler Pfau ──
// ══════════════════════════════════════════

// Blauer Pfau mit Krone und langer Schleppe (Schlüsselträger türkis). Hält 70–190 Einheiten Abstand,
//   schießt dann Federn auf Mark oder einen Freund; aus der Nähe kratzt er mit den Krallen (Schaden ohne Gift).
class Peacock extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 34);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(44, 54);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.fxColor = PeacockCfg.blue;
        this.seed = Math.random() * 10;
        this.detectionRange = 240;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.8, 2);
        this.step = 0;
        this.moving = false;
        this.teal = false;            // türkis (Schlüsselträger)
        this.aim = null;               // Ziel des Kratzers
        this.aimA = 0;                 // Schussrichtung
        this.aimFriend = null;
        this.hitList = [];
        this.clawK = 0;
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.teal ? C_TUERKIS : C_BLUE; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): türkis, etwas zäher
            this._keyInit = true;
            this.teal = true;
            this.hp = this.maxHp = 10;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'shot') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('display', 0.9);   // kurzer Flatterbalz: erst zeigen, dann angreifen
            return;
        }
        this.clawK += ((this.state === 'scratch' || this.state === 'scratchWind' ? 1 : 0) - this.clawK) * Math.min(1, dt * 12);
        this.stateT -= dt;
        switch (this.state) {
            case 'display':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'aim': this._aim(dt, player, projectiles); break;
            case 'shot':
                if (this.stateT <= 0) {
                    this.cool = this.teal ? randRange(1.1, 1.7) : randRange(1.5, 2.3);
                    this._set('walk', 0);
                }
                break;
            case 'scratchWind':
                if (this.stateT <= 0) {
                    this._scratchHit();
                    this._set('scratch', 0.2);
                }
                break;
            case 'scratch':
                if (this.stateT <= 0) {
                    this.cool = this.teal ? randRange(1, 1.5) : randRange(1.4, 2);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, Angriff auswählen ──
    _walk(dt, world, player, dist, dx, dy) {
        this.step += dt * 2.2;
        if (player.dead) {
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.25 * dt, Math.cos(this.step * 0.7) * this.speed * 0.25 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 150) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 62) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 5.6;
        }
        if (this.cool > 0) return;
        if (dist < 72) { this._startScratch(player); return; }
        this._startAim(player);
    }

    // ── a) Federn schießen (Vorwarnung: Zielpunkt am Schnabel + dünne Schusslinien) ──
    _startAim(player) {
        this.aimA = Math.atan2(this.look.y, this.look.x || 1);
        this.aimFriend = null;
        const opts = PeacockArt.companions();
        const mx = this.centerX(), my = this.centerY();
        let best = null;
        for (const c of opts) {
            const d = Math.hypot(c.x + (c.w || 20) / 2 - mx, c.y + (c.h || 20) / 2 - my);
            if (d < 210 && (!best || d < best.d)) best = { c, d };
        }
        if (best) this.aimFriend = best.c;
        this._set('aim', this.teal ? 0.4 : 0.55);
    }

    _aim(dt, player, projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (this.stateT > 0.16 && player && !player.dead) {
            this.aimA = Math.atan2(player.y + player.h / 2 - this.centerY(), player.x + player.w / 2 - this.centerX());
        }
        if (this.stateT <= 0) {
            this._shoot(list);
            this._set('shot', 0.2);
        }
    }

    _shoot(list) {
        const m = this._muzzle();
        if (list && list.length <= PEACOCK_FEATHER_CAP) list.push(new PeacockFeather(m.x, m.y, this.aimA));
        const fr = this.aimFriend;
        if (fr && !fr.dead && !(fr.koTimer > 0) && list && list.length <= PEACOCK_FEATHER_CAP) {
            const a = Math.atan2(fr.y + (fr.h || 20) / 2 - m.y, fr.x + (fr.w || 20) / 2 - m.x);
            list.push(new PeacockFeather(m.x, m.y, a));
        }
        PeacockArt.burst(m.x, m.y, [PeacockCfg.blue, '#ffffff', PeacockCfg.train], 7, 120, 0.34, { kind: 'spark' });
    }

    _muzzle() {
        return { x: this.centerX() + this.face * 12, y: this.centerY() - 12 };
    }

    // ── b) Kratzen aus der Nähe: Schaden ohne Gift ──
    _startScratch(player) {
        const mx = this.centerX(), my = this.centerY();
        let best = null;
        for (const q of PeacockArt.targets(player)) {
            const d = Math.hypot(q.x - mx, q.y - my);
            if (d < 78 && (!best || d < best.d)) best = { q, d };
        }
        this.aim = best ? { x: best.q.x, y: best.q.y } : { x: mx + this.face * 26, y: my + 4 };
        if (Math.abs(this.aim.x - mx) > 3) this.face = this.aim.x > mx ? 1 : -1;
        this.hitList = [];
        this._set('scratchWind', this.teal ? 0.3 : 0.4);
    }

    // Der Kratzer landet genau dort, wo der rote Zielkreis war.
    _scratchHit() {
        const a = this.aim || { x: this.centerX() + this.face * 22, y: this.centerY() + 4 };
        PeacockArt.areaHit(a.x, a.y, 26, this.damage + 1, 180, this.hitList);
        PeacockArt.shake(2.4, 0.1);
        PeacockArt.burst(a.x, a.y, [PeacockCfg.claw, '#ffffff', PeacockCfg.legs], 8, 150, 0.32, { kind: 'spark' });
        PeacockArt.ring(a.x, a.y, PeacockCfg.legs, 26, 0.2, 3);
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st === 'aim') {
            const m = this._muzzle();
            const p = camera.worldToScreen(m.x, m.y);
            const k = this._k();
            LateWorldArt.warn(ctx, p.x, p.y, 20, k, PeacockCfg.warn);
            const prev = ctx.globalAlpha;
            ctx.strokeStyle = PeacockCfg.warn;
            ctx.lineCap = 'round';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            const dirs = [this.aimA];
            const fr = this.aimFriend;
            if (fr && !fr.dead) dirs.push(Math.atan2(fr.y + (fr.h || 20) / 2 - m.y, fr.x + (fr.w || 20) / 2 - m.x));
            for (const a of dirs) {
                ctx.moveTo(p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12);
                ctx.lineTo(p.x + Math.cos(a) * (12 + 92 * clamp(k, 0, 1)), p.y + Math.sin(a) * (12 + 92 * clamp(k, 0, 1)));
            }
            ctx.globalAlpha = prev * (0.35 + 0.4 * Math.abs(Math.sin(Art.time * 12)));
            ctx.stroke();
            ctx.globalAlpha = prev;
            return;
        }
        if (st === 'scratchWind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 26, this._k(), PeacockCfg.warn);
        }
        if (st === 'scratch') {
            const a = this.aim || { x: this.centerX(), y: this.centerY() };
            const p = camera.worldToScreen(a.x, a.y);
            Art.ring(ctx, p.x, p.y, 18 + this._k() * 24, '#ffe6b8', 3, 0.7);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 14)) {
                ctx.translate(cx, foot);
                this._body(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 13 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Pfau mit Fußpunkt (0, 0); Zeichnung in PeacockArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const display = st === 'display' ? Math.sin(t * 20) * 0.5 + 0.5 : 0;
        const wind = st === 'scratchWind' ? k : 0;
        const claw = st === 'scratch' ? 1 : wind * 0.8;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 2.2) * 0.7) + display * 1.2 - claw * 0.8;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 2.2) * 0.014);
        const legLift = [Math.max(0, -walk) * 1.6, claw > 0.2 ? 0 : Math.max(0, walk) * 1.6];
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -18, 24, PeacockCfg.keyBlue, 0.28 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (st === 'aim' || st === 'shot' || st === 'scratchWind' || st === 'scratch') ? 'open'
            : (!dead && this.hp <= this.maxHp / 2) ? 'tired' : 'angry';
        const h = PeacockArt.figure(ctx, {
            c, lw: 1.15, t, bob, walk, mood, clawK: claw, wingLift: display * 0.7 + claw * 0.8,
            lean: (st === 'scratch' ? 0.5 : wind * -0.4), look: { x: this.look.x * this.face, y: this.look.y },
            off: 0,
        });
        if (st === 'shot' && !dead) Art.glow(ctx, h.hx + 8, h.hy + 0.5, 12, PeacockCfg.blue, 0.5 * k);
        if (claw > 0.4 && !dead) Art.glow(ctx, 6.6, -6.6 - claw * 4.4, 11, '#ffe6b8', 0.4);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 45: RIESENPAU (Endgegner, Klasse `BossGiantPeacock` ist der Name der Engine) ──
// ══════════════════════════════════════════

// Riesiger blauer Pfau, 140 LP, bleibt im Boss-Raum (Marmorplatz mit Pfauenrad-Mosaik). Ablauf Phase 1:
//   Rad aufschlagen und Strahlen → Federschuss → Rad-Dreher → Sturzflug → Verschnaufpause …
// Phase 2 (halbe LP): schneller, 13 Federn im Rad, zwei Strahlenwellen, mehr Federn – und nach jedem
//   zweiten großen Angriff wird er schwindelig (Sterne, kurz wehrlos): Marks Zeit zum Zurückhauen.
class Riesenpfau extends Enemy {
    constructor(x, y) {
        super(x, y, 92, 90);
        this.hp = 140;
        this.maxHp = 140;
        this.speed = 31;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;   // gefährlich sind Strahlen, Federn, Rad und Krallen
        this.phasesThroughWalls = false;
        this.shadow = { rx: 42, ry: 13, dy: 40, alpha: 0.32 };
        this.fxColor = PeacockCfg.blue;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 1.9;
        this.stateDur = 1.9;
        this.seq = 0;
        this.cool = 0.7;
        this.step = 0;
        this.moving = false;
        this.lift = 0;
        this.off = 0;                 // Rad offen 0..1
        this.wheelA = 0;              // Blickrichtung des Rades (Weltwinkel)
        this.wheelLock = false;
        this.spinAngle = 0;
        this.spinRate = 0;
        this.beamT = 0;               // Sekunden seit Beginn des Strahlens
        this.beamDur = 0;
        this.beamWaves = 1;           // Phase 2 schickt die Strahlen zweimal über das Rad
        this.beamBack = false;
        this.beamLens = [];
        this.beamHit = [];
        this.hitList = [];
        this.aim = null;              // {x, y} Landepunkt des Sturzflugs
        this._dropFrom = null;
        this.diveFriend = null;
        this.fanA = 0;
        this.fanFriend = null;
        this.fanLock = false;
        this.spinTick = 0;
        this.bigHits = 0;             // große Angriffe seit dem Phasenwechsel
        this.angry = 0;               // 0..1 Glühen in Phase 2
    }

    static room(world) { return PeacockArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // Radmittelpunkt und Federn des Rades (Weltkoordinaten bzw. Weltwinkel)
    _hub() { return { x: this.centerX(), y: this.y + this.h - PC_HUB_DY - this.lift }; }

    _feathers() { return this.phase === 2 ? 13 : 11; }

    _spread() { return 1.28; }

    // Richtung einer Feder i (0..n-1) – für Warnlinien, Strahlen und Augenfleck-Leuchten dieselbe
    _spokeA(i, n) {
        const base = this.state === 'spin' ? this.spinAngle : this.wheelA;
        if (n <= 1) return base;
        const q = i / (n - 1);
        return base - this._spread() + 2 * this._spread() * q;
    }

    // Wie kräftig Strahl i gerade leuchtet (0 = aus): die Strahlen laufen als Welle über das Rad.
    _spokeBeam(i, n) {
        if (this.state !== 'beam' || !this.beamDur) return 0;
        const w = i >= n ? 1 : 0;                     // 0 = hin, 1 = zurück
        if (w >= (this.beamWaves || 1)) return 0;
        const idx = w === 1 ? i - n : i;
        const span = this.beamDur / (this.beamWaves || 1);
        const gap = (span * 0.56) / Math.max(1, n - 1);
        const q = (this.beamT - (w * span + idx * gap * 0.9)) / (span * 0.56);
        if (q <= 0 || q >= 1) return 0;
        return Math.sin(q * Math.PI);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const p2 = this.phase === 2;
        this.angry += ((p2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        this.spinAngle = (this.spinAngle + this.spinRate * dt) % TAU;
        if (this.state !== 'spin') this.spinRate *= Math.exp(-5 * dt);
        // Rad öffnet und schließt weich
        const wantOff = (this.state === 'wheelOpen' || this.state === 'beam' || this.state === 'spin') ? 1 : 0;
        this.off += (wantOff - this.off) * Math.min(1, dt * (wantOff ? 7 : 5));

        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 46;
            this.bigHits = 0;
            PeacockArt.burst(mx, my - 18, [PeacockCfg.train, PeacockCfg.laser, '#ffffff'], 24, 210, 0.7, { kind: 'star' });
            PeacockArt.ring(mx, my, PeacockCfg.laser, 106, 0.6, 6);
            PeacockArt.shake(8, 0.45);
        }
        const air = this.state === 'diveRise' || this.state === 'diveDrop';
        const busy = air || this.state === 'wheelOpen' || this.state === 'beam' || this.state === 'spin';
        if (!busy && this.state !== 'intro') {
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
            case 'wheelOpen': this._wheelOpen(dt, world, player); break;
            case 'beam': this._beam(dt, world, player); break;
            case 'featherWind': this._featherWind(dt, world, player, projectiles); break;
            case 'feathers':
                if (this.stateT <= 0) { this.cool = p2 ? 0.5 : 0.9; this._set('rest', this.cool + 0.3); }
                break;
            case 'spinWind':
                if (this.stateT <= 0) this._set('spin', p2 ? 1.8 : 2.2);
                break;
            case 'spin': this._spin(dt, world, player, dist, dx, dy); break;
            case 'diveRise': this._diveRise(dt, world, player); break;
            case 'diveDrop': this._diveDrop(dt); break;
            case 'diveLand':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'dizzy':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default:                 // rest
                if (this.stateT <= 0) this._set('walk', 0);
        }
        PeacockArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 4.4;
        let vx = 0, vy = 0;
        if (dist > 140) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 78) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool <= 0) this._nextAttack(world, player, dist);
    }

    _nextAttack(world, player, dist) {
        const cyc = this.phase === 2 ? Riesenpfau.CYCLE2 : Riesenpfau.CYCLE1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'dive' && !this._startDive(world, player)) this.cool = 0.55;
        else if (what === 'wheel') this._startWheel(player);
        else if (what === 'feathers') this._startFeathers(player);
        else if (what === 'spin') this._startSpin(player);
        else this.cool = this.phase === 2 ? 0.5 : 0.95;      // bewusste Verschnaufpause
    }

    // ── a) Rad aufschlagen: Augen leuchten, dünne Warnlinien, dann wandern die Strahlen über das Rad ──
    _startWheel(player) {
        this.wheelLock = false;
        this._faceWheel(player);
        this._set('wheelOpen', this.phase === 2 ? 0.85 : 1.05);
    }

    _faceWheel(player) {
        const h = this._hub();
        let tx = player.x + player.w / 2, ty = player.y + player.h / 2;
        if (player.dead) { tx = h.x + Math.cos(this.wheelA) * 60; ty = h.y + Math.sin(this.wheelA) * 60; }
        this.wheelA = Math.atan2(ty - h.y, tx - h.x);
        if (Math.abs(Math.cos(this.wheelA)) > 0.25) this.face = Math.cos(this.wheelA) > 0 ? 1 : -1;
    }

    _wheelOpen(dt, world, player) {
        // Richtung steht fest, sobald die Warnlinien deutlich sichtbar sind
        if (!this.wheelLock) {
            if (this.stateT <= this.stateDur * 0.35) this.wheelLock = true;
            else this._faceWheel(player);
        }
        if (this.stateT <= 0) this._fireBeams(world);
    }

    _fireBeams(world) {
        const p2 = this.phase === 2;
        const h = this._hub();
        const n = this._feathers();
        const waves = p2 ? 2 : 1;
        this.beamBack = waves === 2;
        this.beamWaves = waves;
        this.beamT = 0;
        this.beamDur = (p2 ? 0.62 : 0.72) * waves;
        this.beamLens = [];
        const r0 = PC_WHEEL_R * 0.62;
        for (let w = 0; w < waves; w++) {
            for (let i = 0; i < n; i++) {
                const idx = w === 1 ? n - 1 - i : i;
                const a = this._spokeA(idx, n);
                this.beamLens[w * n + i] = PeacockArt.beamLen(world, h.x + Math.cos(a) * r0, h.y + Math.sin(a) * r0, a, 320);
            }
        }
        this.beamHit = [];
        PeacockArt.shake(4, 0.2);
        PeacockArt.burst(h.x, h.y, [PeacockCfg.laser, PeacockCfg.laserCore, '#ffffff'], 14, 170, 0.4, { kind: 'spark' });
        this._set('beam', this.beamDur + 0.12);
    }

    _beam(dt, world, player) {
        this.beamT += dt;
        const n = this._feathers();
        const h = this._hub();
        const r0 = PC_WHEEL_R * 0.62;
        const band = 9;
        for (const t of PeacockArt.targets(player)) {
            if (this.beamHit.indexOf(t.ref) >= 0 || t.ref.koTimer > 0) continue;
            if (t.isPlayer && t.ref.dodging) continue;
            let hit = false;
            for (let i = 0; i < n * (this.beamWaves || 1); i++) {
                const s = this._spokeBeam(i, n);
                if (s <= 0) continue;
                const gi = i % n;
                const a = this._spokeA(this.beamBack && i >= n ? n - 1 - gi : gi, n);
                if (PeacockArt.beamHit(h.x, h.y, a, r0, (this.beamLens[i] || 0) + 8, t.x, t.y, band + Math.max(t.w, t.h) / 3)) { hit = true; break; }
            }
            if (!hit) continue;
            this.beamHit.push(t.ref);
            if (t.isPlayer) PeacockArt.hurt(t.ref, 2, Math.atan2(t.y - h.y, t.x - h.x), 170);
            else PeacockArt.hitCompanion(t.ref, 2);
            PeacockArt.burst(t.x, t.y - 8, [PeacockCfg.laser, PeacockCfg.laserCore, '#ffffff'], 10, 150, 0.4, { kind: 'spark' });
        }
        if (this.stateT <= 0) this._afterBig();
    }

    // ── b) Federschuss: Fächer auf Mark, eine Feder auf einen Freund ──
    _startFeathers(player) {
        this.fanLock = false;
        this.fanFriend = null;
        const opts = PeacockArt.companions();
        if (opts.length && Math.random() < 0.7) this.fanFriend = opts[Math.floor(Math.random() * opts.length)];
        this.fanA = Math.atan2(this.look.y, this.look.x || 1);
        this._set('featherWind', this.phase === 2 ? 0.5 : 0.68);
    }

    _featherWind(dt, world, player, projectiles) {
        const h = this._hub();
        if (!this.fanLock) {
            this.fanA = Math.atan2(player.y + player.h / 2 - h.y, player.x + player.w / 2 - h.x);
            if (this.stateT <= 0.18) this.fanLock = true;
        }
        if (this.stateT <= 0) {
            this._fireFan(projectiles, h);
            this._set('feathers', 0.24);
        }
    }

    _fireFan(projectiles, h) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const p2 = this.phase === 2;
        const m = { x: h.x, y: h.y };
        const wide = p2 ? 4 : 3;
        for (let i = -wide; i <= wide; i++) {
            if (list.length > PEACOCK_FEATHER_CAP) break;
            list.push(new PeacockFeather(m.x, m.y, this.fanA + i * 0.17, p2 ? randRange(150, 175) : undefined));
        }
        const fr = this.fanFriend;
        if (fr && !fr.dead && !(fr.koTimer > 0) && list.length <= PEACOCK_FEATHER_CAP) {
            const a = Math.atan2(fr.y + (fr.h || 20) / 2 - m.y, fr.x + (fr.w || 20) / 2 - m.x);
            list.push(new PeacockFeather(m.x, m.y, a));
        }
        PeacockArt.burst(m.x, m.y, [PeacockCfg.train, '#ffffff', PeacockCfg.blue], 12, 150, 0.42, { kind: 'spark' });
        PeacockArt.shake(3, 0.16);
    }

    // ── c) Drehangriff: das Rad wirbelt, im Kreis Schaden – ohne Schlaf ──
    _startSpin(player) {
        this.spinTick = 0;
        this.spinAngle = this.wheelA;
        this.hitList = [];
        this._set('spinWind', this.phase === 2 ? 0.6 : 0.8);
    }

    _spinRadius() { return this.phase === 2 ? 60 : 54; }

    _spin(dt, world, player, dist, dx, dy) {
        this.spinRate = Math.min(this.phase === 2 ? 19 : 15, this.spinRate + 36 * dt);
        if (!player.dead && dist > 30) {
            const sp = this.speed * (this.phase === 2 ? 1.5 : 1.2);
            Kit915.rush(this, (dx / dist) * sp * dt, (dy / dist) * sp * dt, world);
            this.moving = true;
        }
        if (Math.random() < dt * 22) {
            const a = Math.random() * TAU, R = this._spinRadius();
            const h = this._hub();
            PeacockArt.burst(h.x + Math.cos(a) * R, h.y + Math.sin(a) * R, [PeacockCfg.train, PeacockCfg.blue, '#ffffff'], 2, 70, 0.5, { kind: 'spark' });
        }
        this.spinTick -= dt;
        if (this.spinTick <= 0) {
            this.spinTick = 0.38;
            const h = this._hub();
            const R = this._spinRadius();
            PeacockArt.areaHit(h.x, h.y, R, 1, 150, this.hitList);
            PeacockArt.ring(h.x, h.y, PeacockCfg.train, R, 0.26, 3);
        }
        if (this.stateT <= 0) {
            this.hitList = [];
            this._afterBig();
        }
    }

    // ── d) Sturzflug auf Mark oder einen Freund (Zielkreis vorher) ──
    _startDive(world, player) {
        const opts = PeacockArt.companions();
        this.diveFriend = opts.length && Math.random() < 0.45 ? opts[Math.floor(Math.random() * opts.length)] : null;
        const t = PeacockArt.dropTarget(world, this, player, 60, 215);
        if (!t) return false;
        this.aim = { x: t.x, y: t.y };
        this._dropFrom = { x: this.x, y: this.y };
        this.hitList = [];
        this.lift = 0;
        if (Math.abs(this.aim.x - this.centerX()) > 6) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this._set('diveRise', this.phase === 2 ? 0.58 : 0.76);
        return true;
    }

    _diveRise(dt, world, player) {
        const top = this.phase === 2 ? 168 : 150;
        this.lift += (top - this.lift) * Math.min(1, dt * 7);
        // Er zieht unterwegs noch etwas zum Ziel hin – der Zielkreis bleibt dabei lesbar.
        if (!player.dead && this.diveFriend && !this.diveFriend.dead) {
            const c = this.diveFriend;
            this.aim.x += (c.x + (c.w || 20) / 2 - this.aim.x) * Math.min(1, dt * 1.6);
            this.aim.y += (c.y + (c.h || 20) / 2 - this.aim.y) * Math.min(1, dt * 1.6);
        } else if (!player.dead && this.stateT < this.stateDur * 0.5) {
            this.aim.x += (player.x + player.w / 2 - this.aim.x) * Math.min(1, dt * 1.4);
            this.aim.y += (player.y + player.h / 2 - this.aim.y) * Math.min(1, dt * 1.4);
        }
        // Der Zielkreis liegt immer im Raum – auch wenn ein Begleiter an der Wand steht.
        const room = PeacockArt.room(world);
        if (room) {
            this.aim.x = clamp(this.aim.x, room.x + this.w / 2 + 6, room.x + room.w - this.w / 2 - 6);
            this.aim.y = clamp(this.aim.y, room.y + this.h / 2 + 6, room.y + room.h - this.h / 2 - 6);
        }
        if (this.stateT <= 0) this._set('diveDrop', this.phase === 2 ? 0.24 : 0.32);
    }

    _diveDrop(dt) {
        const k = this._k();
        const from = this._dropFrom || { x: this.x, y: this.y };
        const toX = this.aim.x - this.w / 2, toY = this.aim.y - this.h / 2;
        const e = k * k * (3 - 2 * k);
        this.x = from.x + (toX - from.x) * e;
        this.y = from.y + (toY - from.y) * e;
        this.lift = Math.max(0, this.lift * (1 - e));
        if (Math.abs(toX - this.x) > 4) this.face = toX > this.x ? 1 : -1;
        if (this.stateT <= 0) {
            this.x = toX;
            this.y = toY;
            this.lift = 0;
            this._diveHit();
        }
    }

    // Landung: Kratzer-Schaden im Kreis für Mark, Juri und das Krokodil – ohne Gift.
    _diveHit() {
        const x = this.centerX(), y = this.y + this.h - 10;
        const p2 = this.phase === 2;
        const R = p2 ? 54 : 46;
        this.hitList = [];
        PeacockArt.areaHit(x, y, R, 2, 240, this.hitList);
        PeacockArt.shake(10, 0.4);
        PeacockArt.ring(x, y + 4, '#ffe6b8', R + 26, 0.4, 6);
        PeacockArt.burst(x, y, [PeacockCfg.claw, '#e8d8b0', '#ffffff'], 16, 190, 0.5, { kind: 'spark' });
        PeacockArt.burst(x, y, 'rgba(226,212,180,0.85)', 7, 85, 0.6, { kind: 'smoke', size: 6 });
        PeacockArt.burst(x, y - 26, [PeacockCfg.train, PeacockCfg.laser], 6, 120, 0.55, { kind: 'star' });
        this._set('diveLand', p2 ? 0.34 : 0.46);
    }

    // Nach großen Angriffen: Verschnaufpause – und in Phase 2 wird er zwischendurch schwindelig.
    _afterBig() {
        this.bigHits++;
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', this.hp <= this.maxHp * 0.3 ? 2 : 1.6);
            PeacockArt.burst(this.centerX(), this.y + 20, [PeacockCfg.star, '#ffffff'], 10, 90, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.55 : 0.95;
        this._set('rest', this.cool + 0.4);
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const h = this._hub();
        const hp = camera.worldToScreen(h.x, h.y);
        const n = this._feathers();
        if (st === 'wheelOpen') {
            // Augen im Rad leuchten auf, dünne Linien zeigen die Richtung der Strahlen
            const k = this._k();
            const r0 = PC_WHEEL_R * 0.62;
            PeacockArt.fanWarn(ctx, hp.x, hp.y, n, this.wheelA, this._spread(), r0, r0 + 215, k, PeacockCfg.warn);
            return;
        }
        if (st === 'spinWind') {
            const k = this._k();
            const R = this._spinRadius();
            LateWorldArt.warn(ctx, hp.x, hp.y, R, k, PeacockCfg.warn);
            LateWorldArt.rays(ctx, hp.x, hp.y, 8, this.spinAngle, R * 0.4, R * (0.8 + 0.3 * k), k, PeacockCfg.train);
            return;
        }
        if (st === 'spin') {
            Art.ring(ctx, hp.x, hp.y, this._spinRadius(), PeacockCfg.train, 3, 0.5);
            return;
        }
        if (st === 'diveRise' || st === 'diveDrop') {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            const R = this.phase === 2 ? 54 : 46;
            LateWorldArt.warn(ctx, p.x, p.y, R, this._k(), st === 'diveDrop' ? '#ff3d5a' : PeacockCfg.warn);
            if (st === 'diveRise') {
                LateWorldArt.rays(ctx, p.x, p.y, 10, this.seed, R * 0.5, R * (0.7 + 0.4 * this._k()), this._k(), '#ffb03a');
            }
            // Schlagschatten des Riesen auf dem Marmor – kleiner, je höher er steigt
            const s = clamp(1 - this.lift / 300, 0.25, 1);
            ctx.fillStyle = 'rgba(20,18,34,0.32)';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 38 * s, 14 * s, 0, 0, TAU);
            ctx.fill();
            return;
        }
        if (st === 'diveLand') {
            const p = camera.worldToScreen(this.centerX(), this.y + this.h - 10);
            Art.ring(ctx, p.x, p.y, 26 + this._k() * 54, '#ffe6b8', 4, 0.7);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        const hp = camera.worldToScreen(this._hub().x, this._hub().y);
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 34);
            if (this.off > 0.02) this._drawWheel(ctx, hp, 0.3);
            ctx.translate(cx, foot);
            this._body(ctx, true);
            ctx.restore();
            return;
        }
        // Rad hinter dem Körper (bei offenem Rad ersetzt es die Schleppe)
        if (this.off > 0.02) this._drawWheel(ctx, hp, this.off);
        ctx.translate(cx, foot - this.lift);
        this._body(ctx, false);
        ctx.restore();
    }

    // Rad in Bildschirmkoordinaten: Federn, Augenfleck-Leuchten und die Strahlen selbst
    _drawWheel(ctx, hp, off) {
        const n = this._feathers();
        const glow = this.state === 'wheelOpen' ? this._k() * 0.9 : (this.state === 'beam' ? 1 : 0);
        PeacockArt.wheel(ctx, hp.x, hp.y, PC_WHEEL_R, off,
            this.state === 'spin' ? this.spinAngle : this.wheelA, n, this._spread(), glow, Art.time + this.seed, true);
        if (this.state !== 'beam') return;
        // Die Strahlen: hell an der Achse, heißer Kern, enden an der Wand
        const r0 = PC_WHEEL_R * 0.62;
        const prev = ctx.globalAlpha;
        ctx.lineCap = 'round';
        for (let w = 0; w < (this.beamWaves || 1); w++) {
            for (let i = 0; i < n; i++) {
                const gi = w === 1 ? n - 1 - i : i;
                const s = this._spokeBeam(w * n + i, n);
                if (s <= 0) continue;
                const a = this._spokeA(gi, n);
                const len = this.beamLens[w * n + i] || 0;
                if (len <= r0) continue;
                const x0 = hp.x + Math.cos(a) * r0, y0 = hp.y + Math.sin(a) * r0;
                const x1 = hp.x + Math.cos(a) * len, y1 = hp.y + Math.sin(a) * len;
                ctx.globalAlpha = prev * 0.4 * s;
                ctx.strokeStyle = PeacockCfg.laser;
                ctx.lineWidth = 17;
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
                ctx.globalAlpha = prev * 0.85 * s;
                ctx.lineWidth = 7;
                ctx.stroke();
                ctx.globalAlpha = prev * s;
                ctx.strokeStyle = PeacockCfg.laserCore;
                ctx.lineWidth = 2.6;
                ctx.stroke();
                Art.glow(ctx, x1, y1, 13, PeacockCfg.laser, 0.5 * s);
            }
        }
        ctx.globalAlpha = prev;
    }

    // Riesenpfau: dieselbe Figur wie die normalen Pfauen, 2,5-mal so groß, mit langem Rad;
    // Phase 2 mit roten Augen, kaltem Blauglühen und Dampf.
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const c = C_BLUE;
        const dizzy = st === 'dizzy';
        const rest = st === 'rest';
        const spin = st === 'spin';
        const rise = st === 'diveRise';
        const drop = st === 'diveDrop';
        const air = rise || drop;
        const walk = this.moving && !dizzy && !spin && !air && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1 : Math.sin(t * 1.7) * 0.9)
            - (rest ? 1.4 : 0) + (dizzy ? Math.sin(t * 4) * 0.7 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 1.7) * 0.012)
            + (st === 'diveLand' ? Math.sin(k * Math.PI) * 0.05 : 0);
        const clawK = (drop || st === 'diveLand') ? 1 : (air ? 0.6 : 0);
        const sway = dizzy ? Math.sin(t * 5) * 1.6 : 0;
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face * PCST, PCST);
        if (spin) ctx.rotate(Math.sin(t * 17) * 0.05 * (1 / this.face));
        if (p2 && !dead) Art.glow(ctx, 0, -22, 34, PeacockCfg.laser, 0.16 * this.angry + 0.05 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (st === 'wheelOpen' || st === 'beam' || st === 'featherWind' || air || st === 'diveLand' || spin) ? 'open'
                : rest ? 'tired' : 'angry';
        const h = PeacockArt.figure(ctx, {
            c, lw: 0.72, t, bob, walk, mood, clawK, legLift: air ? [1.2, 1.6] : [Math.max(0, -walk) * 1.4, Math.max(0, walk) * 1.4],
            wingLift: (air || st === 'featherWind') ? 0.8 : (spin ? 0.5 : 0),
            lean: air ? 0.6 : (st === 'featherWind' ? k * 0.3 : 0),
            red: p2, look: { x: this.look.x * this.face, y: this.look.y },
            off: this.off, base: this.wheelA,
        });
        if (p2 && !dead && !dizzy) Art.glow(ctx, h.hx, h.hy + 0.2, 8, '#ff3b5c', 0.3 + 0.2 * Math.sin(t * 9));
        if (clawK > 0.4 && !dead) Art.glow(ctx, 7.4, -11, 13, '#ffe6b8', 0.45);
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 1.4 * PCST * this.face + sway, -(PC_HUB_DY + 22), 24, 4.6);
        // Kalter Dampf aus dem Rad in Phase 2
        if (p2 && !dizzy && !dead && this.off > 0.4) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.8 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.4;
                ctx.beginPath();
                ctx.arc((i - 1) * 26 + Math.sin(t * 3 + i) * 4, -(PC_HUB_DY + 52) - q * 22, 4 + q * 7, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
    }
}

Riesenpfau.CYCLE1 = ['wheel', 'feathers', 'spin', 'rest', 'dive', 'rest'];
Riesenpfau.CYCLE2 = ['wheel', 'spin', 'feathers', 'dive', 'wheel', 'rest'];

// ── Name der Engine ──
// main.js und die Galerie sprechen den Boss über `BossGiantPeacock` an, Leander nennt ihn
// Riesenpfau: die Klasse heißt wie das Tier, die Engine bekommt ihren gewohnten Namen.
class BossGiantPeacock extends Riesenpfau {}
