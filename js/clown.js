// ── Welt 46: Clownzirkus (Idee von Leander) ──
// Clowns mit ROTEN Haaren – der mit dem Schlüssel hat LILA Haare, damit Kinder ihn sofort sehen.
//   Sie werfen von mittlem Abstand rote Bälle: beim Zielpunkt am Boden auf, dort steht von Anfang an
//   ein markierter Wirkkreis. Der Ball explodiert beim Treffer auf Mark oder einem Freund, beim Aufprall
//   an einer Wand und von selbst am Ende seiner Flugweite. Explosion: Schaden im Kreis, kein Gift
//   (Korrektur aus Claudes Abnahme: Gift war nicht bestellt).
// Boss: RIESENCLAWN auf einem Einrad – Endgegner von Welt 46, bleibt im Boss-Raum (große Manege),
//   140 LP, zwei Phasen.
//   Phase 1: fährt Einrad, wirft einzelne Bälle und Fächer aus drei Bällen (Strahlen sagen den Fächer an),
//     und rast mit dem Einrad über die Manege (rote Bahn sagt den Ansturm an).
//   Phase 2 (halbe LP): nimmt das Einrad in die Hand und schwingt es wie ein Schwert. Bodenschlag mit
//     deutlichem Warnkreis vorher – wer drin steht, kann sich DREI Sekunden nicht bewegen (Mark stun,
//     Juri und Krokodil stun). Zwischendurch wird er schwindelig (Sterne, kurz wehrlos – Marks Zeit).
//   Lebenspunkte und Schaden im Rahmen von Welt 43/44. Freunde verschwinden nie: ein tödlicher Treffer
//     haut Juri und das Krokodil nur um (knockOut).

const ClownCfg = {
    suit: '#3fa9ff',           // buntes Kostüm (Blau), Punkte in Gelb und Rot
    suitMid: '#2f7fd6',
    suitDark: '#1f5aa0',
    dotA: '#ffd23f',
    dotB: '#ff5a6e',
    ruffle: '#ffd23f',        // Gelüskrause am Hals
    face: '#fdf6ee',          // weiß geschminktes Gesicht
    faceShade: '#e8dcd2',
    nose: '#ff3b3b',          // rote Nasch
    hair: '#ff3b30',          // ROTE Locken (Schlüsselträger: lila)
    hairMid: '#d61f1a',
    keyHair: '#9a5ce8',
    keyHairMid: '#7a3cc8',
    shoe: '#ff5a6e',          // große Schuhe
    shoeB: '#ffd23f',
    hat: '#7fe0a8',
    glove: '#ffffff',
    ball: '#ff3b3b',
    ballDark: '#c81f2a',
    wheel: '#2b2740',
    rim: '#c9d2e8',
    steel: '#8fa0c8',
    warn: '#ff5a3d',
    dizzy: '#ffe35a',
};

// Zwei HaarPaletten: rot (alle) und lila (Schlüsselträger)
const H_RED = { hair: ClownCfg.hair, hairMid: ClownCfg.hairMid };
const H_KEY = { hair: ClownCfg.keyHair, hairMid: ClownCfg.keyHairMid };

const ClownArt = {
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
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [ClownCfg.ball, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
    },

    // Betäuben (Bodenschlag des Einrads): drei Sekunden keine Bewegung. Mark wehrt ab, wenn er gerade
    // ausweicht, im Auto sitzt oder die Goldene Krone trägt (Prüfung in player.stun).
    stunTarget(t, seconds) {
        if (!t || t.dead || typeof t.stun !== 'function') return false;
        return t.stun(seconds) === true;
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

    // Freier Punkt in der Welt (für Wurfziele und Ansturm-Bahn)?
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

    // Nächstes Ziel (Mark oder Freund) von (x, y) aus; null wenn niemand da ist.
    nearest(x, y, player) {
        let best = null;
        for (const t of this.targets(player)) {
            const d = Math.hypot(t.x - x, t.y - y);
            if (!best || d < best.d) best = { t, d };
        }
        return best;
    },

    // Steht zwischen (x, y) und (tx, ty) eine Wand? Dann wirkt eine Wirkung dort nicht hindurch.
    wallBetween(x, y, tx, ty) {
        const world = typeof Game !== 'undefined' ? Game.world : null;
        if (!world || typeof world.isWall !== 'function') return false;
        const d = Math.hypot(tx - x, ty - y);
        if (!Number.isFinite(d) || d < 6) return false;
        const steps = Math.min(14, Math.max(2, Math.ceil(d / 12)));
        for (let i = 1; i < steps; i++) {
            const f = i / steps;
            if (world.isWall(x + (tx - x) * f, y + (ty - y) * f)) return true;
        }
        return false;
    },

    // Flächenschaden: trifft Mark und die Freunde innerhalb von R, jeder höchstens einmal (hit-Liste).
    // Nur Schaden – kein Gift (Korrektur aus Claudes Abnahme).
    areaHit(x, y, R, amount, force, hit) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (this.wallBetween(x, y, t.x, t.y)) continue;
            if (hit) {
                hit.push(t.ref);
                if (hit.length > 16) hit.splice(0, hit.length - 16);
            }
            if (t.isPlayer) {
                this.hurt(t.ref, amount, Math.atan2(t.y - y, t.x - x), force);
            } else {
                this.hitCompanion(t.ref, amount);
            }
        }
    },

    // ── Roter Zirkusball (Geschoß) ──
    // Wirft einen Ball: er fliegt geradeaus und geht am Ende seiner Flugweite hoch – oder früher, wenn er
    // Mark oder einen Freund trifft oder gegen eine Wand fliegt. Der Aufschlagpunkt ist von Anfang an
    // markiert (Landekreis), damit Kinder sehen, wo es weh tut.
    throwBall(x, y, angle, owner, o) {
        if (typeof Game === 'undefined' || !Game.projectiles) return null;
        const range = o.range || 180;
        const speed = o.speed || 190;
        let end = range;
        const step = 8;
        for (let d = step; d <= range; d += step) {
            const wx = x + Math.cos(angle) * d;
            const wy = y + Math.sin(angle) * d;
            if (typeof Game.world !== 'undefined' && Game.world && Game.world.isWall(wx, wy)) {
                end = Math.max(24, d - step);
                break;
            }
        }
        const dest = { x: x + Math.cos(angle) * end, y: y + Math.sin(angle) * end };
        const b = new ClownBall(x, y, angle, speed, end, dest, o.dmg || 1, o.R || 28, o.size || 6.4, owner);
        Game.projectiles.push(b);
        return b;
    },

    // Landekreise aller fliegenden Clowns-Bälle (der markierte Wirkkreis während des Flugs).
    landingZones(ctx, camera) {
        const list = typeof Game !== 'undefined' && Game.projectiles ? Game.projectiles : [];
        for (const p of list) {
            if (!(p instanceof ClownBall) || p.dead || !p.dest) continue;
            const q = camera.worldToScreen(p.dest.x, p.dest.y);
            Art.ring(ctx, q.x, q.y, p.R, 'rgba(255,59,59,0.85)', 2.4, 0.55);
            Art.ring(ctx, q.x, q.y, p.R * 0.45, 'rgba(255,210,63,0.9)', 1.6, 0.5);
        }
    },

    // ── Ganze Figur: Clown von vorn, Fußpunkt (0, 0). Eine Einheit = normaler Clown,
    // der Boss zeichnet dieselbe Figur größer (ctx.scale vorher).
    // Weißes Gesicht, runde rote Nase, ROTE Locken, bunter Anzug mit Punkten, Gelüskrause am Hals,
    // übergroße Schuhe, Käppchen. p = { c: {hair, hairMid}, lw, t, bob, walk, face, hands: {b, f},
    //   hold (Ball in der vorderen Hand), legs: {mode:'stand'|'pedal', lift:[h,v], pedals:[hinten,vorn]},
    //   mood, look, sit (Hüfte sitzt höher – auf dem Einrad), hat }
    figure(ctx, p) {
        const c = p.c, lw = p.lw || 1.2, f = p.face || 1;
        const sit = p.sit || 0;
        const hip = -9 - p.bob - sit;
        const sho = hip - 20;                       // Schulterhöhe
        const hx = 1.2, hy = sho - 8;               // Kopfzentrum
        const mood = p.mood || 'angry';
        const look = p.look || { x: 0, y: 0 };
        const legs = p.legs || { mode: 'stand' };
        const ped = legs.pedals || [0, 0];

        // ── Beine mit übergroßen Schuhen ──
        const leg = (s, fx, fy, col) => {
            const knee = { x: (s * 6 + fx) / 2 + s * 2.4, y: (hip - 1 + fy) / 2 };
            Art.limb(ctx, s * 3.4, hip - 1, knee.x, knee.y, 5.4, ClownCfg.suitMid, { lineWidth: lw });
            Art.limb(ctx, knee.x, knee.y, fx, fy, 4.8, ClownCfg.suitMid, { lineWidth: lw });
            ctx.save();
            ctx.translate(fx, fy);
            ctx.rotate(Math.min(0.5, Math.max(-0.5, (hip - 1 - fy) * 0.03)));
            Art.body(ctx, s * 2.6, -1.5, 6.2, 2.7, col, { lineWidth: lw });
            Art.shine(ctx, s * 2.6, -2.6, 2.4, 0.8, 0, 0.3);
            ctx.restore();
        };
        if (legs.mode === 'pedal') {
            leg(-1, -3 + Math.cos(ped[0]) * 5.4, -4.4 + Math.sin(ped[0]) * 5.4, ClownCfg.shoeB);
            leg(1, 3 + Math.cos(ped[1]) * 5.4, -4.4 + Math.sin(ped[1]) * 5.4, ClownCfg.shoe);
        } else {
            const lift = legs.lift || [0, 0];
            leg(-1, -6.4 - f * 1.2, -1.4 - lift[0], ClownCfg.shoeB);
            leg(1, 6.4 + f * 1.2, -1.4 - lift[1], ClownCfg.shoe);
        }

        // ── Körper: unten weit (dicker Anzug), oben schmal ──
        Art.shape(ctx, g => {
            g.moveTo(-6.6, sho + 1);
            g.bezierCurveTo(-12.5, hip - 13, -15, hip - 6, -13, hip + 1.4);
            g.quadraticCurveTo(0, hip + 4.6, 13, hip + 1.4);
            g.bezierCurveTo(15, hip - 6, 12.5, hip - 13, 6.6, sho + 1);
            g.quadraticCurveTo(0, sho - 1.4, -6.6, sho + 1);
            g.closePath();
        }, { x: -15, y: sho - 2, w: 30, h: hip - sho + 7 }, ClownCfg.suit, { glossy: true, lineWidth: lw });
        // Punkte im Stoff
        const dots = [[-6.4, hip - 11, ClownCfg.dotA], [5.4, hip - 12.6, ClownCfg.dotB], [-2.2, hip - 5.4, ClownCfg.dotB], [8, hip - 6, ClownCfg.dotA], [-9.2, hip - 3.6, ClownCfg.dotA]];
        for (const d of dots) Art.body(ctx, d[0], d[1], 1.9, 1.9, d[2], { highlight: false, lineWidth: lw * 0.6 });
        // Gelüskrause am Hals
        for (let i = 0; i < 7; i++) {
            const a = Math.PI * (0.12 + (i / 6) * 0.76);
            Art.body(ctx, hx - Math.cos(a) * 6.4, sho - 0.6 + Math.sin(a) * 1.5, 2.5, 1.9, ClownCfg.ruffle, { lineWidth: lw * 0.7 });
        }

        // ── Arme mit weißen Handschuhen ──
        const arm = (s, hnd, col) => {
            const sx = s * 6.2, sy = sho + 1.4;
            const mx = (sx + hnd.x) / 2 + s * 3.2, my = (sy + hnd.y) / 2 + 1.6;
            Art.limb(ctx, sx, sy, mx, my, 5, col, { lineWidth: lw });
            Art.limb(ctx, mx, my, hnd.x, hnd.y, 4.4, col, { lineWidth: lw });
            Art.body(ctx, hnd.x, hnd.y, 3.1, 2.9, ClownCfg.glove, { lineWidth: lw });
        };
        arm(-1, p.hands.b, ClownCfg.suitMid);
        if (p.hold) {
            const hb = p.hands.f;
            Art.glow(ctx, hb.x, hb.y, 11 * p.hold, ClownCfg.ball, 0.4);
            Art.body(ctx, hb.x, hb.y - 3.4, 4.2 * p.hold, 4.2 * p.hold, ClownCfg.ball, { glossy: true, lineWidth: lw * 0.8 });
        }
        arm(1, p.hands.f, ClownCfg.suit);

        // ── Kopf: weise Lockenkränze, weißes Gesicht, rote Nase ──
        const hairP = c;
        for (const s of [-1, 1]) {
            const tufts = [[s * 8.4, hy - 1.6, 3.5], [s * 9.4, hy + 2.6, 3.0], [s * 7.4, hy - 5.4, 2.7]];
            for (const tf of tufts) Art.body(ctx, hx + tf[0], tf[1], tf[2], tf[2] * 0.94, s < 0 ? hairP.hairMid : hairP.hair, { lineWidth: lw * 0.8 });
        }
        Art.body(ctx, hx + 0.4, hy - 8.4, 3.4, 3.0, hairP.hair, { lineWidth: lw * 0.8 });
        Art.body(ctx, hx, hy, 7.6, 7.4, ClownCfg.face, { glossy: true, lineWidth: lw });
        Art.body(ctx, hx, hy + 2.6, 6.4, 4.6, ClownCfg.faceShade, { highlight: false, lineWidth: lw * 0.6 });
        // Schminke: rote Wangen, rote Kugeln an den Mundwinkeln
        Art.blush(ctx, hx, hy + 2.2, 2.2, 4.9, ClownCfg.nose);
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, hx, hy - 2.0, 1.7, 2.9);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = ClownCfg.dizzy;
            ctx.lineWidth = lw * 0.9;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + p.t * 6 * s, r = 0.25 + i * 0.1;
                    const x = hx + s * 2.9 + Math.cos(a) * r, y = hy - 2.0 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, hx + s * 2.9, hy - 2.0, 2.0, { x: look.x * f, y: look.y },
                    { angry: mood === 'angry', side: s < 0 ? 'left' : 'right', iris: '#3f7fd6', open: mood === 'tired' ? 0.45 : 1 });
            }
        }
        Art.body(ctx, hx, hy + 3.1, 2.3, 2.2, ClownCfg.nose, { glossy: true, lineWidth: lw * 0.8 });
        Art.mouth(ctx, hx, hy + 5.9, 5, mood === 'dead' ? 'angry' : mood === 'dizzy' || mood === 'open' ? 'o' : mood === 'tired' ? 'angry' : 'grin');
        if (p.hat !== false) {
            Art.shape(ctx, g => {
                g.moveTo(hx - 4.6, hy - 6.6);
                g.quadraticCurveTo(hx + 0.4, hy - 14.4, hx + 5, hy - 6.4);
                g.closePath();
            }, { x: hx - 5, y: hy - 15, w: 10.4, h: 9 }, ClownCfg.hat, { lineWidth: lw });
            Art.body(ctx, hx + 0.6, hy - 13.8, 1.9, 1.9, ClownCfg.dotA, { lineWidth: lw * 0.7 });
        }
        return { hx, hy, sho, hip };
    },

    // ── Einrad (Fußpunkt des Rads bei 0, 0; wheelR in Einheiten der kleinen Figur) ──
    // draw='wheel' nur das Rad, draw='full' Rad plus Gabel/Tretkurbel (vordergrundig).
    unicycle(ctx, draw, wheelR, spin, o) {
        const lw = (o && o.lw) || 1.2;
        const R = wheelR;
        const cx = 0, cy = -R;
        if (draw === 'wheel' || draw === 'full') {
            Art.body(ctx, cx, cy, R, R, ClownCfg.wheel, { glossy: false, lineWidth: lw });
            Art.ring(ctx, cx, cy, R * 0.68, ClownCfg.rim, Math.max(1.4, R * 0.2), 1);
            ctx.strokeStyle = ClownCfg.rim;
            ctx.lineWidth = Math.max(0.9, R * 0.1);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = spin + (i * Math.PI) / 3;
                ctx.moveTo(cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16);
                ctx.lineTo(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
            }
            ctx.stroke();
            Art.body(ctx, cx, cy, R * 0.2, R * 0.2, ClownCfg.steel, { lineWidth: lw * 0.8 });
            Art.shine(ctx, cx - R * 0.4, cy - R * 0.44, R * 0.24, R * 0.12, -0.6, 0.35);
        }
        if (draw !== 'full') return { cx, cy };
        // Gabel, Sattel, Tretkurbel
        ctx.strokeStyle = ClownCfg.steel;
        ctx.lineWidth = Math.max(1.6, R * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - R * 0.86, cy - R * 0.1);
        ctx.lineTo(cx, cy - R * 1.42);
        ctx.lineTo(cx + R * 0.86, cy - R * 0.1);
        ctx.stroke();
        Art.body(ctx, cx, cy - R * 1.52, R * 0.5, R * 0.2, ClownCfg.wheel, { lineWidth: lw * 0.8 });
        return { cx, cy };
    },

    // Einrad in der Hand (Schwert des Riesenclowns): Rad unten an der Hand, Stiel nach oben.
    // ang = Pose-Winkel in Figur-Einheiten (0 = Rad zeigt nach unten); inside(nach ctx.scale(face, 1)) aufrufen.
    unicycleWeapon(ctx, x, y, ang, wheelR, glow, lw) {
        ctx.save();
        ctx.translate(x, y);
        // Handgelenk bleibt der Drehpunkt: erst am Grifsende (laengt des Posen-Winkels) aufstellen, dann drehen
        ctx.translate(Math.sin(ang) * wheelR * 0.9, Math.cos(ang) * wheelR * 0.9);
        ctx.rotate(ang);
        if (glow > 0) Art.glow(ctx, 0, wheelR * 0.9, wheelR * 1.5, ClownCfg.dotA, 0.4 * glow);
        ctx.strokeStyle = ClownCfg.steel;
        ctx.lineWidth = Math.max(1.6, wheelR * 0.16);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, wheelR * 0.1);
        ctx.lineTo(0, -wheelR * 1.1);
        ctx.stroke();
        Art.body(ctx, 0, -wheelR * 1.2, wheelR * 0.46, wheelR * 0.2, ClownCfg.wheel, { lineWidth: lw * 0.8 });
        this.unicycleWheelOnly(ctx, 0, wheelR, wheelR, lw);
        ctx.restore();
    },

    unicycleWheelOnly(ctx, cx, cy, R, lw) {
        Art.body(ctx, cx, cy, R, R, ClownCfg.wheel, { glossy: false, lineWidth: lw });
        Art.ring(ctx, cx, cy, R * 0.68, ClownCfg.rim, Math.max(1.4, R * 0.2), 1);
        ctx.strokeStyle = ClownCfg.rim;
        ctx.lineWidth = Math.max(0.9, R * 0.1);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3 + Art.time * 2;
            ctx.moveTo(cx + Math.cos(a) * R * 0.16, cy + Math.sin(a) * R * 0.16);
            ctx.lineTo(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
        }
        ctx.stroke();
        Art.body(ctx, cx, cy, R * 0.2, R * 0.2, ClownCfg.steel, { lineWidth: lw * 0.8 });
    },
};

// ══════════════════════════════════════════
// ── Roter Zirkusball (Geschoß) ──
// ══════════════════════════════════════════

// Rote Kugel des Clowns: fliegt bis zu ihrer Flugweite und explodiert dort – oder früher an einer Wand
// oder auf Mark/einem Freund. Die Engine meldet einen Geschoßtreffer nur als `dead` und fragt das
// Geschoß nie weiter ab, also prüft der Ball seine Ziele selbst. Die Detonation zeigt den deutlich
// markierten Wirkkreis und trifft alle im Kreis – ohne Gift (Korrektur aus Claudes Abnahme).
class ClownBall extends Projectile {
    constructor(x, y, angle, speed, range, dest, dmg, R, size, owner) {
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, 'enemy', 120);
        this.radius = size * 0.92;
        this.size = size;
        this.travel = 0;
        this.range = range;
        this.dest = dest;
        this.blastDmg = dmg;
        this.R = R;
        this.ownerRef = owner;
        this.spin = Math.random() * TAU;
        this.hitsCompanions = true;   // die Engine lässt ihn auch Juri und das Krokodil treffen
        this.stunTime = 0.4;          // kurze Rollerei bei einem Direkttreffer – die Wucht steckt in der Detonation
        this.lifetime = range / speed + 0.45;
        this.boom = false;
        this.poison = 0;              // keine grüne Verlangsamung der Engine – die Bälle haben gar kein Gift
    }

    update(dt, world) {
        if (this.dead) { this._boom(); return; }
        this.travel += Math.hypot(this.vx, this.vy) * dt;
        super.update(dt, world);
        if (this.dead || this.travel >= this.range) { this._boom(); return; }
        // Eigene Zielpruefung ACHTER der Bewegung (dasselbe Feld wie die Engine in main.js:1478):
        // die Engine setzt bei einem Treffer nur `dead` und fragt das Geschoess nie weiter ab – ohne
        // diesen Weg bliebe ein Direkttreffer ein kleiner Nadelstich ohne die angesagte Explosion.
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const t of ClownArt.targets(player)) {
            if (Math.hypot(this.x - t.x, this.y - t.y) < this.radius + Math.max(t.w, t.h) / 2) { this._boom(); return; }
        }
    }

    _boom() {
        if (this.boom) return;
        this.boom = true;
        this.dead = true;
        const hit = this.ownerRef && Array.isArray(this.ownerRef.landHit) ? this.ownerRef.landHit : [];
        ClownBall.explode(this.x, this.y, this.R, this.blastDmg, this.size, hit);
    }

    // Detonation: Wirkkreis, Schein, Funken – und Schaden für Mark und alle Freunde im Kreis.
    static explode(x, y, R, dmg, size, hit) {
        ClownArt.shake(3.4 + size * 0.18, 0.16);
        ClownArt.ring(x, y, ClownCfg.dotA, R, 0.34, 4);
        ClownArt.ring(x, y, ClownCfg.ball, R * 0.66, 0.26, 6);
        ClownArt.burst(x, y, [ClownCfg.ball, ClownCfg.dotA, '#ffffff'], 16, 210, 0.5, { kind: 'spark' });
        ClownArt.burst(x, y, [ClownCfg.ball, ClownCfg.dotB, ClownCfg.suit], 8, 120, 0.6, { kind: 'star', gravity: 120 });
        ClownArt.burst(x, y, 'rgba(255,220,180,0.8)', 5, 70, 0.5, { kind: 'smoke', size: 5 });
        ClownArt.areaHit(x, y, R, dmg, 200, hit);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.size;
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, r * 1.1, ClownCfg.ball);
        this.spin += 0.12;
        Art.glow(ctx, p.x, p.y, r * 2.1, ClownCfg.ball, 0.4);
        Art.body(ctx, p.x, p.y, r, r, ClownCfg.ball, { glossy: true, lineWidth: 1.3 });
        // weiße Zinkpunkte, die sich mit dem Ball drehen
        ctx.fillStyle = '#fff2ea';
        for (let i = 0; i < 3; i++) {
            const a = this.spin + (i * TAU) / 3;
            const d = r * 0.5;
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r * 0.17, 0, TAU);
            ctx.fill();
        }
        Art.ring(ctx, p.x, p.y, r, ClownCfg.ballDark, 1.2, 0.8);
    }
}

// ══════════════════════════════════════════
// ── Normaler Clown ──
// ══════════════════════════════════════════

// Clown mit roten Haaren (Schlüsselträger lila). Hält 90–190 Einheiten Abstand und wirft rote Bälle,
//   die am markierten Landekreis explodieren. Weicht zurück, wenn Mark zu nah kommt.
class Clown extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 32);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(40, 50);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = ClownCfg.ball;
        this.seed = Math.random() * 10;
        this.detectionRange = 235;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.8, 1.8);
        this.step = 0;
        this.moving = false;
        this.purple = false;              // lila Haare (Schlüsselträger)
        this.throwAngle = 0;
        this.landHit = [];
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _hair() { return this.purple ? H_KEY : H_RED; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): lila Haare, etwas zäher, wirft weiter
            this._keyInit = true;
            this.purple = true;
            this.hp = this.maxHp = 9;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'windup' && this.state !== 'throw') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 5) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) this._engaged = true;
        this.stateT -= dt;
        switch (this.state) {
            case 'windup':
                if (this.stateT <= 0) {
                    this._throw(world);
                    this._set('throw', 0.2);
                }
                break;
            case 'throw':
                if (this.stateT <= 0) {
                    this.cool = this.purple ? randRange(1.5, 2.1) : randRange(2, 2.8);
                    this._set('walk', 0);
                }
                break;
            case 'flee':
                this._flee(dt, world, dist, dx, dy);
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, Wurf ansetzen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2;
            Kit915.rush(this, Math.sin(this.step) * this.speed * 0.25 * dt, Math.cos(this.step * 0.7) * this.speed * 0.25 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 190) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 92) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 7;
        } else this.step += dt * 1.6;
        if (this.cool > 0) return;
        if (dist < 62) { this._set('flee', 0.42); return; }
        const near = ClownArt.nearest(this.centerX(), this.centerY(), player);
        if (near && near.d > 40 && near.d < 215) {
            this.throwAngle = Math.atan2(near.t.y - this.centerY(), near.t.x - this.centerX());
            this.landHit = [];
            this._set('windup', this.purple ? 0.44 : 0.56);
            return;
        }
        this.cool = 0.5;
    }

    _flee(dt, world, dist, dx, dy) {
        if (dist < 1) return;
        Kit915.rush(this, (-dx / dist) * this.speed * 1.7 * dt, (-dy / dist) * this.speed * 1.7 * dt, world);
        this.moving = true;
        this.step += dt * 11;
    }

    _throw(world) {
        const mx = this.centerX(), my = this.centerY() - 6;
        ClownArt.throwBall(mx, my, this.throwAngle, this, {
            range: this.purple ? 210 : 180, speed: this.purple ? 205 : 190,
            dmg: 1, R: 28, size: this.purple ? 7 : 6.2,
        });
        ClownArt.burst(mx + Math.cos(this.throwAngle) * 10, my + Math.sin(this.throwAngle) * 10,
            [ClownCfg.ball, '#ffffff'], 5, 90, 0.28, { kind: 'spark' });
    }

    // Ansagen am Boden: Landekreis des laufenden Wurfs + Kreise aller fliegenden Bälle
    drawUnder(ctx, camera) {
        if (this.dead) return;
        if (typeof Game === 'undefined' || !Game.enemies || Game.enemies.find(e => e instanceof Clown && !e.dead) === this) {
            ClownArt.landingZones(ctx, camera);      // einmal pro Frame genuegt – sonst mehrfach ueberzeichnet
        }
        if (this.state === 'windup') {
            const a = this.throwAngle;
            const mx = this.centerX(), my = this.centerY() - 6;
            let end = this.purple ? 210 : 180;
            const step = 8;
            if (typeof Game !== 'undefined' && Game.world && Game.world.isWall) {
                for (let d = step; d <= end; d += step) {
                    if (Game.world.isWall(mx + Math.cos(a) * d, my + Math.sin(a) * d)) {
                        end = Math.max(24, d - step);
                        break;
                    }
                }
            }
            const q = camera.worldToScreen(mx + Math.cos(a) * end, my + Math.sin(a) * end);
            LateWorldArt.warn(ctx, q.x, q.y, 28, this._k(), ClownCfg.warn);
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
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, foot - 56 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Clown mit Fußpunkt (0, 0); Zeichnung in ClownArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._hair();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const wind = st === 'windup' ? k : 0;
        const threw = st === 'throw';
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 2.2) * 0.7);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.04 : Math.sin(t * 2.2) * 0.015);
        // Hände: hinten unten, vorn beim Ausholen über den Kopf, beim Wurf weit vorn
        let hb = { x: -11, y: -12 - Math.max(0, -walk) * 2 };
        let hf = { x: 11.5, y: -12 - Math.max(0, walk) * 2 };
        if (wind) hf = { x: 4 - wind * 4, y: -30 - wind * 5 };
        else if (threw) hf = { x: 16, y: -18 };
        else if (st === 'flee') { hb = { x: -13, y: -22 }; hf = { x: 13, y: -22 }; }
        const lift = this.moving && !dead ? [Math.max(0, -walk) * 2.6, Math.max(0, walk) * 2.6] : [0, 0];
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -20, 24, ClownCfg.keyHair, 0.28 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : threw || wind ? 'open' : tired ? 'tired' : st === 'flee' ? 'tired' : 'angry';
        ClownArt.figure(ctx, {
            c, lw: 1.2, t, bob, walk, hands: { b: hb, f: hf }, hold: wind ? 0.6 + wind * 0.6 : 0,
            legs: { mode: 'stand', lift }, mood, look: { x: this.look.x * this.face, y: this.look.y },
        });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESENCLAWN AUF EINRAD (Endgegner Welt 46) ──
// ══════════════════════════════════════════

class BossGiantClown extends Enemy {
    constructor(x, y) {
        super(x, y, 88, 84);
        this.hp = 140;
        this.maxHp = 140;
        this.speed = 36;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;     // gefährlich sind Bälle, Rad und der Bodenschlag
        this.phasesThroughWalls = false;
        this.shadow = { rx: 40, ry: 13, dy: 40, alpha: 0.3 };
        this.fxColor = ClownCfg.ball;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.mounted = true;            // true = fährt Einrad, false = trägt es als Schwert
        this.state = 'intro';
        this.stateT = 1.9;
        this.stateDur = 1.9;
        this.seq = 0;
        this.cool = 0.7;
        this.step = 0;
        this.spin = 0;                  // Radumdrehungen
        this.moving = false;
        this.aim = null;                // Ziel des nächsten Wurfs (Punkt)
        this.throwAngle = 0;
        this.fanAngle = 0;
        this.slamAim = null;            // Aufschlagpunkt des Einrad-Schlags
        this.charge = null;             // {x, y, dx, dy, len} laufender Ansturm
        this.chargeAim = null;
        this.landHit = [];
        this.bigHits = 0;               // große Angriffe seit dem Phasenwechsel
        this.angry = 0;                 // 0..1 Glühen in Phase 2
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.mounted = false;
            this.speed = 50;
            this.bigHits = 0;
            this.state = 'mount';
            this._set('mount', 1.1);
            ClownArt.burst(mx, my - 14, [ClownCfg.ball, ClownCfg.dotA, '#ffffff'], 24, 210, 0.7, { kind: 'star' });
            ClownArt.ring(mx, my, ClownCfg.dotA, 104, 0.6, 6);
            ClownArt.shake(8, 0.45);
        }
        if (this.state !== 'intro' && this.state !== 'charge' && this.state !== 'chargeWind') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('ride', 0);
                break;
            case 'mount':
                if (this.stateT <= 0) this._set('ride', 0);
                break;
            case 'ride': this._ride(dt, world, player, dist, dx, dy); break;
            case 'throwWind':
                if (this.stateT <= 0) {
                    this._throw(world);
                    this._set('throw', 0.2);
                }
                break;
            case 'throw':
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.5 : 0.8;
                    this.aim = null;
                    this._set('ride', 0);
                }
                break;
            case 'fanWind':
                if (this.stateT <= 0) {
                    this._fan(world);
                    this._set('fan', 0.26);
                }
                break;
            case 'fan':
                if (this.stateT <= 0) this._afterBig(0.5);
                break;
            case 'chargeWind':
                if (this.stateT <= 0) this._startCharge();
                break;
            case 'charge': this._charge(dt, world, player); break;
            case 'slamWind':
                if (this.stateT <= 0) this._set('swing', 0.16);
                break;
            case 'swing':
                if (this.stateT <= 0) {
                    this._slamHit();
                    this._set('after', 0.5);
                }
                break;
            case 'dizzy':
                if (this.stateT <= 0) this._set('ride', 0);
                break;
            default:                // after (Verschnaufpause)
                if (this.stateT <= 0) this._set('ride', 0);
        }
        ClownArt.clampToRoom(this, world);
    }

    // ── Fahren im Raum, dann nächster Angriff ──
    _ride(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.6; return; }
        this.step += dt * 5.2;
        let vx = 0, vy = 0;
        if (dist > 150) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 84) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        if (Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world)) this.step += dt * 2;
        this.spin += (Math.hypot(vx, vy) * this.speed * dt) / 15;
        this.cool -= dt;
        if (this.cool <= 0) this._nextAttack(world, player, dist);
    }

    _nextAttack(world, player, dist) {
        const cyc = this.phase === 2 ? BossGiantClown.CYCLE2 : BossGiantClown.CYCLE1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        const near = ClownArt.nearest(this.centerX(), this.centerY(), player);
        if (what === 'throw' || what === 'fan') {
            if (!near || near.d > 300) { this.cool = 0.6; return; }
        }
        if (what === 'throw') {
            this.throwAngle = Math.atan2(near.t.y - (this.centerY() - 10), near.t.x - this.centerX());
            this.landHit = [];
            this._set('throwWind', this.phase === 2 ? 0.44 : 0.58);
        } else if (what === 'fan') {
            this.fanAngle = Math.atan2(near.t.y - (this.centerY() - 10), near.t.x - this.centerX());
            this.landHit = [];
            this._set('fanWind', this.phase === 2 ? 0.6 : 0.76);
        } else if (what === 'charge') {
            if (!near || near.d < 70 || near.d > 280) { this.cool = 0.7; return; }
            const a = Math.atan2(near.t.y - this.centerY(), near.t.x - this.centerX());
            const len = Kit915.laneLength(this, Math.cos(a), Math.sin(a), world, this.phase === 2 ? 300 : 240);
            if (len < 70) { this.cool = 0.7; return; }
            this.chargeAim = { x: this.centerX(), y: this.centerY(), dx: Math.cos(a), dy: Math.sin(a), len };
            this._set('chargeWind', this.phase === 2 ? 0.5 : 0.66);
        } else if (what === 'slam') {
            const t = this._slamTarget(world, player);
            if (!t) { this.cool = 0.6; return; }
            this.slamAim = t;
            this.landHit = [];
            this._set('slamWind', this.phase === 2 && this.hp <= this.maxHp * 0.3 ? 0.86 : 1.02);
        } else this.cool = this.phase === 2 ? 0.5 : 0.9;         // bewusste Verschnaufpause
    }

    // Ziel des Bodenschlags: Mark oder der nächste Freund, auf freiem Boden, im Boss-Raum.
    _slamTarget(world, player) {
        const near = ClownArt.nearest(this.centerX(), this.centerY(), player);
        if (!near) return null;
        const room = ClownArt.room(world);
        let x = near.t.x, y = near.t.y;
        if (room) {
            x = clamp(x, room.x + 44, room.x + room.w - 44);
            y = clamp(y, room.y + 44, room.y + room.h - 44);
        }
        if (!ClownArt.free(world, x, y, 26)) {
            x = this.centerX() + this.face * 46;
            y = this.centerY() + 16;
            if (!ClownArt.free(world, x, y, 26)) return null;
        }
        return { x, y };
    }

    _throw(world) {
        const mx = this.centerX(), my = this.centerY() - 12;
        ClownArt.throwBall(mx, my, this.throwAngle, this, {
            range: 250, speed: 215, dmg: 2, R: 38, size: 9,
        });
        ClownArt.burst(mx + Math.cos(this.throwAngle) * 16, my + Math.sin(this.throwAngle) * 16,
            [ClownCfg.ball, '#ffffff'], 7, 110, 0.3, { kind: 'spark' });
    }

    // Fächer aus drei (Phase 1) bzw. fünf (Phase 2) Bällen
    _fan(world) {
        const mx = this.centerX(), my = this.centerY() - 12;
        const n = this.phase === 2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
            const a = this.fanAngle + (i - (n - 1) / 2) * 0.3;
            ClownArt.throwBall(mx, my, a, this, { range: 220, speed: 200, dmg: 2, R: 34, size: 8 });
        }
        ClownArt.shake(3.6, 0.14);
    }

    // ── Ansturm auf dem Einrad (nur Phase 1, Phase 2 hat das Rad in der Hand) ──
    _startCharge() {
        const c = this.chargeAim;
        this.charge = { x: c.x, y: c.y, dx: c.dx, dy: c.dy, len: c.len, d: 0, hit: [] };
        this.contactDamage = false;
        this._set('charge', c.len / 330 + 0.12);
        ClownArt.burst(this.centerX(), this.y + this.h - 6, ['rgba(240,224,194,0.9)'], 6, 80, 0.5, { kind: 'smoke', size: 5 });
    }

    _charge(dt, world, player) {
        const c = this.charge;
        if (!c) { this._set('ride', 0); return; }
        const step = 330 * dt;
        c.d += step;
        this.spin += step / 15;
        const stopped = Kit915.rush(this, c.dx * step, c.dy * step, world);
        this.moving = true;
        const hx = this.centerX(), hy = this.centerY();
        for (const t of ClownArt.targets(player)) {
            if (c.hit.indexOf(t.ref) >= 0 || t.ref.dead || t.ref.koTimer > 0) continue;
            const along = (t.x - c.x) * c.dx + (t.y - c.y) * c.dy;
            if (along < 0 || along > Math.min(c.d, c.len) + 18) continue;
            const side = Math.abs(-(t.x - c.x) * c.dy + (t.y - c.y) * c.dx);
            if (side > 26 + Math.max(t.w, t.h) / 2) continue;
            c.hit.push(t.ref);
            if (t.isPlayer) ClownArt.hurt(t.ref, 2, Math.atan2(c.dy, c.dx), 260);
            else ClownArt.hitCompanion(t.ref, 2);
        }
        if (stopped || c.d >= c.len || this.stateT <= 0) {
            ClownArt.shake(5, 0.16);
            ClownArt.burst(this.centerX() - c.dx * 14, this.y + this.h - 6,
                [ClownCfg.ball, '#e8d5b2', '#ffffff'], 10, 150, 0.4, { kind: 'spark' });
            this.charge = null;
            this.chargeAim = null;
            this._afterBig(0.55);
        }
    }

    // ── Bodenschlag mit dem Einrad (Phase 2): drei Sekunden Bewegungsunfähigkeit im Kreis ──
    _slamHit() {
        const p = this.slamAim;
        if (!p) { this._set('after', 0.4); return; }
        const R = 70;
        ClownArt.shake(11, 0.42);
        ClownArt.ring(p.x, p.y, ClownCfg.dotA, R + 30, 0.45, 7);
        ClownArt.ring(p.x, p.y, ClownCfg.ball, R, 0.34, 5);
        ClownArt.burst(p.x, p.y, [ClownCfg.ball, ClownCfg.dotA, '#ffffff'], 18, 210, 0.55, { kind: 'spark' });
        ClownArt.burst(p.x, p.y, 'rgba(240,224,194,0.9)', 9, 95, 0.6, { kind: 'smoke', size: 6 });
        ClownArt.burst(p.x, p.y - 24, [ClownCfg.dotB, ClownCfg.suit, ClownCfg.hair], 9, 130, 0.6, { kind: 'star', gravity: 140 });
        this.slamAim = null;               // die Ansage ist verbraucht – kein Ring ohne folgenden Schlag
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const t of ClownArt.targets(player)) {
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - p.x, t.y - p.y) > R + Math.max(t.w, t.h) / 2) continue;
            if (ClownArt.wallBetween(p.x, p.y, t.x, t.y)) continue;
            const a = Math.atan2(t.y - p.y, t.x - p.x);
            const angle = Number.isFinite(a) ? a : 0;
            if (t.isPlayer) {
                ClownArt.hurt(t.ref, 2, angle, 220);
                if (ClownArt.stunTarget(t.ref, 3)) {
                    ClownArt.burst(t.x, t.y - 16, [ClownCfg.dotA, '#ffffff'], 8, 80, 0.5, { kind: 'star' });
                }
            } else {
                ClownArt.hitCompanion(t.ref, 2);
                if (!t.ref.dead && t.ref.koTimer <= 0 && t.ref.stunTimer <= 0) {
                    t.ref.stun(3);
                    ClownArt.burst(t.x, t.y - 12, [ClownCfg.dotA, '#ffffff'], 7, 80, 0.5, { kind: 'star' });
                }
            }
        }
    }

    // Nach großen Angriffen: Verschnaufpause – und in Phase 2 wird er zwischendurch schwindelig.
    _afterBig(cool) {
        this.bigHits++;
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', this.hp <= this.maxHp * 0.3 ? 2 : 1.6);
            ClownArt.burst(this.centerX(), this.y + 22, [ClownCfg.dizzy, '#ffffff'], 10, 90, 0.5, { kind: 'star' });
            return;
        }
        this.cool = cool || (this.phase === 2 ? 0.55 : 0.9);
        this._set('after', this.cool + 0.4);
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        ClownArt.landingZones(ctx, camera);
        if (st === 'throwWind') {
            const mx = this.centerX(), my = this.centerY() - 12;
            const q = camera.worldToScreen(mx + Math.cos(this.throwAngle) * 250, my + Math.sin(this.throwAngle) * 250);
            Art.ring(ctx, q.x, q.y, 38, 'rgba(255,59,59,0.8)', 2.4, 0.4 + 0.3 * this._k());
            return;
        }
        if (st === 'fanWind') {
            const mx = this.centerX(), my = this.centerY() - 12;
            const n = this.phase === 2 ? 5 : 3;
            const q = camera.worldToScreen(mx, my);
            LateWorldArt.rays(ctx, q.x, q.y, n, this.fanAngle - ((n - 1) / 2) * 0.3, 24, 205, this._k(), ClownCfg.warn);
            return;
        }
        if (st === 'chargeWind' && this.chargeAim) {
            const c = this.chargeAim;
            const p = camera.worldToScreen(c.x, c.y);
            LateWorldArt.lane(ctx, p.x, p.y, Math.atan2(c.dy, c.dx), c.len, 52, this._k(), ClownCfg.warn);
            return;
        }
        if (st === 'charge') {
            const c = this.charge;
            if (c) {
                const p = camera.worldToScreen(c.x, c.y);
                LateWorldArt.lane(ctx, p.x, p.y, Math.atan2(c.dy, c.dx), Math.min(c.d, c.len), 52, 1, 'rgba(255,110,60,0.8)');
            }
            return;
        }
        if (st === 'slamWind' && this.slamAim) {
            const p = camera.worldToScreen(this.slamAim.x, this.slamAim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 70, this._k(), ClownCfg.warn);
            LateWorldArt.rays(ctx, p.x, p.y, 10, this.seed, 70 * 0.62, 70 * (0.74 + 0.4 * this._k()), this._k(), ClownCfg.dotA);
            return;
        }
        if (st === 'swing' || st === 'after') {
            const q = this.slamAim || { x: this.centerX(), y: this.y + this.h };
            const p = camera.worldToScreen(q.x, q.y);
            Art.ring(ctx, p.x, p.y, 26 + this._k() * 66, ClownCfg.dotA, 4, st === 'swing' ? 0.8 : 0.7 * (1 - this._k()));
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 34);
            ctx.translate(cx, foot);
            this._body(ctx, true);
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
    }

    // Riesenclown: dieselbe Figur wie die normalen Clowns, 2,35-mal so groß. Phase 1 auf dem Einrad
    // (Räder drehen sich, Beine treten), Phase 2 mit dem Einrad in der Hand als Schwert.
    _body(ctx, dead) {
        const S = 2.35;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const c = H_RED;
        const riding = this.mounted;
        const wind = st === 'throwWind' ? k : 0;
        const fanW = st === 'fanWind' ? k : 0;
        const slamW = st === 'slamWind' ? k : 0;
        const swing = st === 'swing' ? k : 0;
        const dizzy = st === 'dizzy';
        const rest = st === 'after' || st === 'throw' || st === 'fan';
        const charging = st === 'charge';
        const beat = st === 'intro' ? Math.sin(t * 12) : 0;
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (charging ? Math.abs(Math.sin(this.step * 3)) * 0.8
            : this.moving && riding ? Math.abs(walk) * 0.9 : Math.sin(t * 1.9) * 0.8)
            - (rest ? 1.2 : 0) + (swing ? Math.sin(k * Math.PI) * 2 : 0);
        const squ = dead ? 0 : Math.sin(t * 1.9) * 0.012 + (swing ? 0.02 : 0);
        const sit = riding ? 15 : 0;
        const hip = -9 - bob - sit;
        // Hände (Einheiten der kleinen Figur)
        const sway = dizzy ? Math.sin(t * 5) * 2 : 0;
        let hb = { x: -13, y: hip + 6 };
        let hf = { x: 13, y: hip + 6 };
        if (riding) { hb = { x: -10, y: hip + 9 }; hf = { x: 10, y: hip + 9 }; }
        if (st === 'intro') { hb = { x: -12, y: hip + 4 }; hf = { x: 12 + beat, y: hip + 2 - beat * 4 }; }
        if (wind) { hb = { x: -12, y: hip + 6 }; hf = { x: 3 - wind * 3, y: hip - 18 - wind * 6 }; }
        else if (st === 'throw') hf = { x: 17, y: hip + 1 };
        if (fanW) { hb = { x: -12 - fanW * 3, y: hip + 2 }; hf = { x: 12 + fanW * 3, y: hip + 2 }; }
        if (charging) { hb = { x: -9, y: hip + 10 }; hf = { x: 9, y: hip + 10 }; }
        if (dizzy) { hb = { x: -15 + sway, y: hip + 11 }; hf = { x: 15 + sway, y: hip + 11 }; }
        // Einrad in der Hand (Phase 2)
        let weapon = null;
        if (!riding) {
            hb = { x: -11, y: hip + 8 };
            hf = { x: 12, y: hip + 4 };
            if (slamW) { hf = { x: 5 - slamW * 2, y: hip - 22 - slamW * 12 }; weapon = { x: hf.x, y: hf.y, ang: Math.PI - 0.35 + slamW * 0.45, glow: slamW }; }
            else if (swing) { hf = { x: 13 + swing * 3, y: hip + 16 + swing * 6 }; weapon = { x: hf.x, y: hf.y, ang: 1.9 - swing * 1.4, glow: 1 }; }
            else if (charging) { hb = { x: -10, y: hip + 9 }; hf = { x: 10, y: hip + 9 }; weapon = { x: 14, y: hip + 14, ang: Math.PI - 0.85, glow: 0.5 }; }
            else if (rest) { weapon = { x: 15, y: hip + 14, ang: Math.PI - 0.18, glow: 0 }; }
            else weapon = { x: hf.x, y: hf.y, ang: Math.PI - 0.12 + Math.sin(t * 2) * 0.08, glow: 0.2 + 0.2 * Math.sin(t * 5) };
        }
        const pedals = riding ? [this.spin + Math.PI, this.spin] : [0, 0];
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, hip - 6, 34, ClownCfg.ball, 0.18 * this.angry + 0.06 * Math.sin(t * 6));
        // Einrad (hintere Ebene)
        if (riding && !dead) {
            ClownArt.unicycle(ctx, 'wheel', 15, -this.spin * this.face, { lw: 0.8 });
        }
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (wind || fanW || slamW || swing || charging) ? 'open'
                : rest ? 'tired' : 'angry';
        const lift = !riding && this.moving && !dizzy && !dead ? [Math.max(0, -walk) * 2.4, Math.max(0, walk) * 2.4] : [0, 0];
        ClownArt.figure(ctx, {
            c, lw: 0.75, t, bob, walk, hands: { b: hb, f: hf },
            hold: wind ? 0.7 + wind * 0.7 : fanW ? 0.5 : 0,
            legs: riding ? { mode: 'pedal', pedals } : { mode: 'stand', lift },
            mood, look: { x: this.look.x * this.face, y: this.look.y }, sit,
        });
        if (riding && !dead) {
            ClownArt.unicycle(ctx, 'full', 15, -this.spin * this.face, { lw: 0.8 });
        }
        if (weapon && !dead) {
            // sitzt bereits im gespiegelten Koerperfeld: Hand und Waffe teilen sich dieselben Figur-Maße
            ClownArt.unicycleWeapon(ctx, weapon.x, weapon.y, weapon.ang, 15, weapon.glow, 0.8);
        }
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 1.5 * S * this.face, (hip - 30) * S, 24, 4.6);
        // Zorn-Dampf in Phase 2
        if (p2 && !dizzy && !dead) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.85 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.45;
                ctx.beginPath();
                ctx.arc((i - 1) * 22 + Math.sin(t * 3 + i) * 4, (hip - 34) * S - q * 22, 4 + q * 6, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
    }
}

BossGiantClown.CYCLE1 = ['throw', 'fan', 'charge', 'ride'];
BossGiantClown.CYCLE2 = ['slam', 'fan', 'throw', 'charge', 'ride'];
