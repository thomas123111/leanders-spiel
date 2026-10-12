// ── Welt 49: Vampirschloss (Idee von Leander) ──
// Bleiche Vampire mit schwarzem Umhang und rotem Futter, weiße Eckzähne. Der mit dem Schlüssel hat
// graue Zähne (Leander). Aus der Ferne schießen sie dunkelrote Blut-Tropfen (Comic-Stil, nichts
// Gruseliges) oder grauen Fledermaus-Staub. Aus der Nähe beißen sie: vorher reißt der Vampir den Mund
// weit auf (Ansage; der rote Kreis ist genau der Trefferbereich), danach schläft das Ziel DREI Sekunden
// ein (sleep). Die Schonzeit aus sleep verhindert, dass jemand mehrmals hintereinander einschläft.
//
// Boss: RIESENVAMPIR in zwei Gestalten.
//   Gestalt 1 – Riesenfledermaus (135 LP): fliegt große Bögen durch den Ballsaal und kratzt mit den
//     Krallen; der Sturzflug startet mit einem Zielkreis, die Krallen mit einem Kratzer-Fächer.
//   Sinkt ihre Lebenskraft auf 0, STIRBT sie nicht, sondern verwandelt sich: Rauchwolke und ein
//     Fledermausschwarm, danach steigt der Riesenvampir auf – mit einer NEUEN VOLLEN Lebensleiste (140 LP).
//   Gestalt 2 – Riesenvampir: teleportiert sich (Rauchwolke hier, Rauchwolke dort), schießt einen Bogen
//     aus Blut-Tropfen und lässt Mark und die Freunde einschlafen (wachsender violetter Kreis mit Zzz =
//     Trefferbereich, danach sleep 3). Bei wenig Leben wird er nach großen Angriffen schwindelig.
//   Erst der Sieg über den Vampir beendet die Welt.
//
// Beide Gestalten sind ZUSTÄNDE desselben Bosses (this.form = 'fledermaus' | 'vampir'): der Boss bleibt
// dasselbe Objekt, deshalb spielt tools/smoke-welt.mjs die Verwandlung einfach mit, ohne Sonderfälle.
// `Riesenvampir` ist dieselbe Gestalt als eigene Klasse – für die Galerie, die beide Gestalten zeigen will.
// Freunde verschwinden nie: ein tödlicher Treffer haut Juri und das Krokodil nur um (knockOut).

const VampCfg = {
    // Vampir (zwei Paletten: weiße Zähne, graue Zähne für den Schlüsselträger)
    cape: '#2a1f3a', capeMid: '#1d1529', capeDark: '#110b1b',
    lining: '#b0324f', liningLight: '#d9506f',
    skin: '#e9e0f2', skinDark: '#c2b2d2',
    hair: '#161020',
    suit: '#332743', suitMid: '#413352',
    tooth: '#ffffff', toothKey: '#9aa0ae',
    eye: '#ff3b5c',
    blood: '#8e1430', bloodLight: '#c8284c',
    dust: '#a58fd6', dustDark: '#6b5499',
    // Riesenfledermaus
    fur: '#4d3c5c', furMid: '#3b2d49', furDark: '#281e33',
    wing: '#352640', wingDark: '#231a2d', wingVein: '#6b4f86',
    earIn: '#a05a78', muzzle: '#8d7599',
    claw: '#efe6f8',
    // Gemeinsames
    smoke: '#6b4f86',
    warn: '#ff5a3d', sleepWarn: '#a06fff',
    sleep: 3,                      // drei Sekunden Schlaf (Leander)
};

const VC_PLAIN = {
    cape: VampCfg.cape, capeMid: VampCfg.capeMid, capeDark: VampCfg.capeDark,
    lining: VampCfg.lining, liningLight: VampCfg.liningLight,
    skin: VampCfg.skin, skinDark: VampCfg.skinDark, hair: VampCfg.hair,
    suit: VampCfg.suit, suitMid: VampCfg.suitMid, tooth: VampCfg.tooth, eye: VampCfg.eye,
};
const VC_KEY = Object.assign({}, VC_PLAIN, {
    tooth: VampCfg.toothKey, cape: '#332b3f', capeMid: '#272130', suit: '#3b3348',
});
const VC_BAT = {
    fur: VampCfg.fur, furMid: VampCfg.furMid, furDark: VampCfg.furDark,
    wing: VampCfg.wing, wingDark: VampCfg.wingDark, wingVein: VampCfg.wingVein,
    earIn: VampCfg.earIn, muzzle: VampCfg.muzzle, tooth: VampCfg.tooth, claw: VampCfg.claw,
};

const VampArt = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine direkt.
    hurt(player, amount, angle, force) {
        if (typeof LateWorldArt !== 'undefined') LateWorldArt.hurt(player, amount, angle, force);
        else if (player && player.takeDamage) player.takeDamage(amount, angle, force);
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
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [VampCfg.capeDark, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

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

    // Nächster Gegner zu einem Punkt
    nearest(player, x, y, maxD) {
        let best = null;
        for (const t of this.targets(player)) {
            const d = Math.hypot(t.x - x, t.y - y);
            if (d <= maxD && (!best || d < best.d)) best = { t, d };
        }
        return best;
    },

    // Flächenschaden: trifft Mark und die Freunde innerhalb von R, jeder höchstens einmal (hit-Liste).
    areaHit(x, y, R, amount, force, hit) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (hit) hit.push(t.ref);
            if (t.isPlayer) this.hurt(t.ref, amount, Math.atan2(t.y - y, t.x - x), force);
            else this.hitCompanion(t.ref, amount);
        }
    },

    // Einschlafen lassen: Mark und die Freunde in R für `seconds` Sekunden. Trifft jeder höchstens
    // einmal; die Schonzeit aus sleep (sleepGuard) wirkt von selbst, ein zweiter Biss kurz danach geht ins Leere.
    sleepArea(x, y, R, seconds, hit) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        let gewirkt = false;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (hit) hit.push(t.ref);
            if (typeof t.ref.sleep === 'function' && t.ref.sleep(seconds)) gewirkt = true;
        }
        return gewirkt;
    },

    // Ein Punkt im Boss-Raum, der frei ist (für Teleport und Sturzflug). null = nichts brauchbares.
    spotInRoom(world, e, x, y) {
        const r = this.room(world);
        const half = Math.max(e.w, e.h) / 2;
        const box = r || (world && world.width ? { x: 32, y: 32, w: (world.width - 2) * 32, h: (world.height - 2) * 32 } : null);
        if (!box) return null;
        for (const d of [0, 40, 80, 120, 170]) {
            for (const a of [0, 1.6, 3.1, 4.7, -1.6, -3.1, -4.7]) {
                const nx = clamp(x + Math.cos(a) * d, box.x + half + 4, box.x + box.w - half - 4);
                const ny = clamp(y + Math.sin(a) * d, box.y + half + 4, box.y + box.h - half - 4);
                if (this.free(world, nx, ny, half * 0.8)) return { x: nx, y: ny };
            }
        }
        return null;
    },

    // ── Der Vampir zu Fuß (Fußpunkt 0, 0, eine Einheit = normaler Vampir, der Boss skaliert) ──
    // p = { c, lw, t, bob, walk, hands: {b, f}, headDy, cape: 0..1 (ausgebreitet), capeUp: 0..1
    //       (hochgezogen), mood: calm|angry|open|tired|dizzy|dead, look, fangs (Zahnfarbe) }
    figure(ctx, p) {
        const c = p.c, lw = p.lw;
        const hip = -10 - p.bob;
        const top = hip - 21;                       // Schultern
        const open = p.cape || 0;
        const up = p.capeUp || 0;
        const spread = 14 + open * 8;
        const hem = hip + 7 + up * 8;

        // ── Umhang: erst das rote Futter (einen Hauch größer), dann der schwarze Mantel ──
        const capePath = (g, sp, hy, dip) => {
            g.moveTo(-6, top + 1.5);
            g.bezierCurveTo(-sp * 0.72, top + 3 - up * 9, -sp * 1.04, hy - 13, -sp, hy);
            const n = 4;
            for (let i = 0; i < n; i++) {
                const x1 = -sp + (2 * sp * (i + 1)) / n;
                const xm = -sp + (2 * sp * (i + 0.5)) / n;
                g.quadraticCurveTo(xm, hy - dip, x1, hy + (i === n - 1 ? -1 : 0));
            }
            g.bezierCurveTo(sp * 1.04, hy - 13, sp * 0.72, top + 3 - up * 9, 6, top + 1.5);
            g.quadraticCurveTo(0, top - 1.2, -6, top + 1.5);
            g.closePath();
        };
        Art.shape(ctx, g => capePath(g, spread + 2.4, hem + 1.6, 4.4), { x: -spread - 3, y: top, w: (spread + 3) * 2, h: hem - top + 6 },
            VampCfg.lining, { flat: true, lineWidth: lw });
        Art.shape(ctx, g => capePath(g, spread, hem, 3.4), { x: -spread - 1, y: top, w: (spread + 1) * 2, h: hem - top + 5 },
            c.cape, { linear: true, lineWidth: lw });

        // ── Beine und Schuhe ──
        for (const s of [-1, 1]) {
            const lift = Math.max(0, s * (p.walk || 0)) * 2;
            Art.limb(ctx, s * 3.6, hip + 1, s * 4.4, -2.2 - lift, 5.2, c.capeMid, { lineWidth: lw });
            Art.body(ctx, s * 4.8, -1.5 - lift, 4.2, 1.9, c.capeDark, { lineWidth: lw });
        }

        // ── Körper: dunkler Anzug, rotes Futter als Kragen-V, Fladderhemd-Hemdbluse ──
        Art.shape(ctx, g => {
            g.moveTo(-7.5, hip + 2);
            g.bezierCurveTo(-10, hip - 5, -11.5, hip - 12, -10.5, top + 2);
            g.quadraticCurveTo(0, top - 2.2, 10.5, top + 2);
            g.bezierCurveTo(11.5, hip - 12, 10, hip - 5, 7.5, hip + 2);
            g.quadraticCurveTo(0, hip + 4.5, -7.5, hip + 2);
            g.closePath();
        }, { x: -11, y: top - 2, w: 22, h: hip + 3 - top }, c.suit, { linear: true, lineWidth: lw });
        // Hemd und Futter-Streifen
        Art.shape(ctx, g => {
            g.moveTo(0, top + 0.5);
            g.lineTo(4.6, top + 2.5);
            g.lineTo(1.8, hip - 1);
            g.lineTo(-1.8, hip - 1);
            g.lineTo(-4.6, top + 2.5);
            g.closePath();
        }, { x: -4.6, y: top, w: 9.2, h: hip - top }, '#efe6f4', { flat: true, lineWidth: lw * 0.7 });
        for (const s of [-1, 1]) {
            Art.shape(ctx, g => {
                g.moveTo(s * 4.4, top + 1.6);
                g.lineTo(s * 2.2, top + 6.5);
                g.lineTo(s * 5.6, hip - 4);
                g.lineTo(s * 7.4, top + 3);
                g.closePath();
            }, { x: s > 0 ? 2 : -7.6, y: top, w: 5.6, h: hip - top - 3 }, c.lining, { flat: true, lineWidth: lw * 0.6 });
        }
        // Fledermaus-Brosche
        Art.body(ctx, 0, top + 5.4, 2.1, 1.5, '#ffd23f', { lineWidth: lw * 0.7, highlight: false });

        // ── Arme (hinten = von uns weg, vorn = Angriffsseite) ──
        const arm = (s, h, col) => {
            const sx = s * 9, sy = top + 3.5;
            const mx = (sx + h.x) / 2 + s * 2.6, my = (sy + h.y) / 2;
            Art.limb(ctx, sx, sy, mx, my, 5.8, col, { lineWidth: lw });
            Art.limb(ctx, mx, my, h.x, h.y, 5, col, { lineWidth: lw });
            // Stulpe und blasse Hand mit Krallen
            Art.body(ctx, h.x, h.y, 3.5, 3.1, c.capeDark, { lineWidth: lw });
            Art.body(ctx, h.x + s * 0.6, h.y - 1.4, 2.8, 2.5, c.skin, { lineWidth: lw * 0.9 });
            ctx.strokeStyle = Art.ink(c.skin);
            ctx.lineWidth = lw * 0.55;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                ctx.moveTo(h.x + s * 0.6 + i * 1.2, h.y - 3);
                ctx.lineTo(h.x + s * 1.4 + i * 1.5, h.y - 4.8);
            }
            ctx.stroke();
        };
        arm(-1, p.hands.b, c.capeMid);
        arm(1, p.hands.f, c.cape);

        // ── Hoher Kragen hinter dem Kopf (außen schwarz, innen rot) ──
        const hx = 1.4, hy = top - 8 + (p.headDy || 0);
        for (const s of [-1, 1]) {
            Art.shape(ctx, g => {
                g.moveTo(hx + s * 2, hy + 6);
                g.lineTo(hx + s * 11.5, hy - 9 - up * 2);
                g.lineTo(hx + s * 9.4, hy + 7.5);
                g.closePath();
            }, { x: s > 0 ? hx + 2 : hx - 11.5, y: hy - 9, w: 9.5, h: 17 }, c.capeDark, { flat: true, lineWidth: lw });
            Art.shape(ctx, g => {
                g.moveTo(hx + s * 3.2, hy + 5.4);
                g.lineTo(hx + s * 10, hy - 6.4 - up * 2);
                g.lineTo(hx + s * 8.4, hy + 6.4);
                g.closePath();
            }, { x: s > 0 ? hx + 3 : hx - 10, y: hy - 7, w: 7, h: 14 }, c.lining, { flat: true, outline: false });
        }

        // ── Kopf ──
        for (const s of [-1, 1]) Art.body(ctx, hx + s * 6.9, hy + 0.6, 1.9, 2.6, c.skin, { lineWidth: lw * 0.8, rot: s * 0.4 });
        Art.body(ctx, hx, hy, 6.9, 7.7, c.skin, { glossy: true, lineWidth: lw });
        Art.body(ctx, hx, hy + 3.4, 4.6, 3.9, c.skinDark, { highlight: false, outline: false });   // Schattenseite Kinn
        // Scheitel mit Witwenkuppe
        Art.shape(ctx, g => {
            g.moveTo(hx - 6.9, hy - 0.6);
            g.bezierCurveTo(hx - 7.4, hy - 8, hx - 3, hy - 9.6, hx, hy - 9);
            g.bezierCurveTo(hx + 3, hy - 9.6, hx + 7.4, hy - 8, hx + 6.9, hy - 0.6);
            g.lineTo(hx + 4.4, hy - 2.6);
            g.lineTo(hx + 2.2, hy - 0.4);
            g.lineTo(hx, hy - 2.4);
            g.lineTo(hx - 2.2, hy - 0.4);
            g.lineTo(hx - 4.4, hy - 2.6);
            g.closePath();
        }, { x: hx - 7.4, y: hy - 9.6, w: 14.8, h: 10 }, c.hair, { lineWidth: lw });
        ctx.lineCap = 'round';                                    // hohe, schmale Augenbrauen
        ctx.strokeStyle = c.hair;
        ctx.lineWidth = 1.5;
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(hx + s * 1.4, hy - 1.9);
            ctx.lineTo(hx + s * 4.6, hy - (p.mood === 'calm' || p.mood === 'tired' ? 2.6 : 3.6));
            ctx.stroke();
        }
        const look = p.look || { x: 0, y: 0 };
        if (p.mood === 'dead') LateWorldArt.xEyes(ctx, hx, hy - 0.2, 1.6, 2.7);
        else if (p.mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.8;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + (p.t || 0) * 6 * s, r = 0.2 + i * 0.1;
                    const x = hx + s * 2.7 + Math.cos(a) * r, y = hy - 0.2 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, hx + s * 2.7, hy - 0.2, 1.8, { x: look.x, y: look.y },
                    { iris: c.eye, irisSize: 0.55, side: s < 0 ? 'left' : 'right', open: p.mood === 'tired' ? 0.5 : 1 });
            }
        }
        ctx.strokeStyle = c.skinDark;                             // kleine Nase
        ctx.lineWidth = lw * 0.7;
        ctx.beginPath();
        ctx.moveTo(hx + 0.2, hy + 1.4);
        ctx.lineTo(hx - 0.6, hy + 2.6);
        ctx.stroke();
        // Mund: weit aufgerissen beim Biss, sonst grimmig; die zwei großen Eckzähne hängen von oben runter
        const wide = p.mood === 'open';
        Art.mouth(ctx, hx, hy + (wide ? 5.6 : 4.9), wide ? 8 : 5, wide ? 'open' : 'angry');
        const fh = wide ? 4.4 : 2.6;
        for (const s of [-1, 1]) {
            const fx = hx + s * (wide ? 2.5 : 1.7);
            ctx.fillStyle = p.fangs || c.tooth;
            ctx.beginPath();
            ctx.moveTo(fx - 1, hy + 4);
            ctx.lineTo(fx + 1, hy + 4);
            ctx.lineTo(fx + s * 0.2, hy + 4 + fh);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = Art.ink(c.skin);
            ctx.lineWidth = lw * 0.5;
            ctx.stroke();
        }
        return { hx, hy, top, hip };
    },

    // ── Riesenfledermaus von vorn (Fußpunkt 0, 0): riesige Ohren, breite Schwingen, lange Krallen.
    // p = { c, lw, t, bob, flap: -1..1, fold: 0..1, clawArm: 0..1 (Kratzer-Arm nach vorn), mood, look }
    batFigure(ctx, p) {
        const c = p.c, lw = p.lw;
        const bodyY = -18 - p.bob;
        const flap = p.flap || 0;

        // Flügel (hinter dem Körper)
        for (const s of [-1, 1]) {
            const reach = 31 * (1 - (p.fold || 0) * 0.42);
            const shX = s * 5.5, shY = bodyY - 4;
            Art.shape(ctx, g => {
                g.moveTo(shX, shY);
                g.quadraticCurveTo(s * reach * 0.52, bodyY - 17 - flap * 8, s * reach, bodyY - 13 - flap * 10);
                g.quadraticCurveTo(s * reach * 0.94, bodyY - 4 - flap * 5, s * reach * 0.8, bodyY + 3 - flap * 3);
                g.quadraticCurveTo(s * reach * 0.66, bodyY - 1 - flap * 2, s * reach * 0.52, bodyY + 5 - flap * 2);
                g.quadraticCurveTo(s * reach * 0.4, bodyY + 1, s * reach * 0.26, bodyY + 6 - flap);
                g.quadraticCurveTo(s * reach * 0.14, bodyY + 2, shX - s * 1.2, shY + 5);
                g.closePath();
            }, { x: s > 0 ? shX : -reach - 1, y: bodyY - 24, w: reach, h: 31 }, c.wing, { linear: true, lineWidth: lw });
            // Fingerknochen und Flügelkralle
            ctx.strokeStyle = c.wingVein;
            ctx.lineWidth = lw * 0.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const f of [0.8, 0.52, 0.26]) {
                ctx.moveTo(shX, shY + 1);
                ctx.lineTo(s * reach * f, bodyY + (f > 0.7 ? -1 : 3) - flap * 2);
            }
            ctx.stroke();
            ctx.strokeStyle = c.claw;
            ctx.lineWidth = lw * 0.8;
            ctx.beginPath();
            ctx.moveTo(s * reach, bodyY - 13 - flap * 10);
            ctx.lineTo(s * (reach + 3.2), bodyY - 16.5 - flap * 11);
            ctx.stroke();
        }

        // Nach unten hängende Beine mit Krallen (Fledermäuse hängen kopfüber)
        for (const s of [-1, 1]) {
            const lift = Math.max(0, s * (p.walk || 0)) * 1.6;
            Art.limb(ctx, s * 3.4, bodyY + 8, s * 4.6, -3 - lift, 4.2, c.furMid, { lineWidth: lw });
            ctx.strokeStyle = c.claw;
            ctx.lineWidth = lw * 0.7;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const d of [-1.4, 0, 1.4]) { ctx.moveTo(s * 4.6 + d, -3 - lift); ctx.lineTo(s * 4.6 + d * 1.6, 0.6 - lift); }
            ctx.stroke();
        }

        // Körper mit hellem Bauchfell
        Art.body(ctx, 0, bodyY, 9.6, 11.2, c.fur, { glossy: true, lineWidth: lw });
        Art.body(ctx, 0, bodyY + 3.4, 6, 6.6, c.muzzle, { highlight: false, outline: false });
        Art.body(ctx, 0, bodyY - 1.5, 4.4, 4.6, Art.light(c.fur, 0.18), { highlight: false, outline: false });

        // Riesige Ohren (das erkennt ein Kind sofort)
        for (const s of [-1, 1]) {
            Art.shape(ctx, g => {
                g.moveTo(s * 3.4, bodyY - 11);
                g.bezierCurveTo(s * 9.5, bodyY - 15, s * 12.4, bodyY - 25, s * 8.4, bodyY - 28.5);
                g.bezierCurveTo(s * 5.4, bodyY - 30, s * 3.2, bodyY - 21, s * 2.4, bodyY - 13);
                g.closePath();
            }, { x: s > 0 ? 2 : -13, y: bodyY - 30, w: 11, h: 18 }, c.fur, { linear: true, lineWidth: lw });
            Art.shape(ctx, g => {
                g.moveTo(s * 4.2, bodyY - 12.6);
                g.bezierCurveTo(s * 8.6, bodyY - 16, s * 10.4, bodyY - 23.6, s * 8, bodyY - 26);
                g.bezierCurveTo(s * 6, bodyY - 27, s * 4.4, bodyY - 20, s * 3.6, bodyY - 14);
                g.closePath();
            }, { x: s > 0 ? 3 : -11, y: bodyY - 27, w: 8, h: 15 }, c.earIn, { flat: true, outline: false });
        }

        // Kopf vorn
        const hy = bodyY - 12.5;
        Art.body(ctx, 0, hy, 7.6, 6.9, c.fur, { glossy: true, lineWidth: lw });
        Art.body(ctx, 0, hy + 3.1, 4.4, 3.2, c.muzzle, { highlight: false, lineWidth: lw * 0.7 });
        ctx.fillStyle = c.furDark;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 1.3, hy + 2.4, 0.8, 0.55, s * 0.4, 0, TAU); ctx.fill(); }
        if (p.mood === 'dead') LateWorldArt.xEyes(ctx, 0, hy - 0.6, 1.5, 2.9);
        else if (p.mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.8;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + (p.t || 0) * 6 * s, r = 0.2 + i * 0.1;
                    const x = s * 2.9 + Math.cos(a) * r, y = hy - 0.6 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                const look = p.look || { x: 0, y: 0 };
                Art.eye(ctx, s * 2.9, hy - 0.6, 1.7, { x: look.x, y: look.y },
                    { iris: '#ff4a4a', irisSize: 0.6, side: s < 0 ? 'left' : 'right', open: p.mood === 'tired' ? 0.55 : 1 });
            }
        }
        // Oberkiefer mit zwei langen Eckzähnen
        Art.mouth(ctx, 0, hy + 4.6, 6.4, p.mood === 'open' ? 'teeth' : 'angry', { color: c.furDark });
        for (const s of [-1, 1]) {
            const fx = s * 2.5;
            ctx.fillStyle = c.tooth;
            ctx.beginPath();
            ctx.moveTo(fx - 1.2, hy + 4);
            ctx.lineTo(fx + 1.2, hy + 4);
            ctx.lineTo(fx + s * 0.2, hy + 4 + (p.mood === 'open' ? 5 : 3.4));
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = Art.ink(c.muzzle);
            ctx.lineWidth = lw * 0.5;
            ctx.stroke();
        }

        // Krallenarm (Kratzer): schlägt mit der Flügelkralle nach vorn
        if (p.clawArm > 0) {
            const a = p.clawArm;
            const hx2 = 8 + a * 15, hy2 = bodyY - 6 + a * 4;
            Art.limb(ctx, 5, bodyY - 4, hx2 - 4, hy2 - 3, 5.4, c.fur, { lineWidth: lw });
            Art.body(ctx, hx2 - 4, hy2 - 3, 4, 3.6, c.furMid, { lineWidth: lw });
            ctx.strokeStyle = c.claw;
            ctx.lineWidth = lw * 1.1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (const d of [-3, 0, 3]) {
                ctx.moveTo(hx2 - 2, hy2 - 4 + d);
                ctx.lineTo(hx2 + 6.5, hy2 - 5 + d * 1.5);
            }
            ctx.stroke();
        }
        return { hy, bodyY };
    },

    // Rauchwolke (Rauch, kein Schattenverlauf): mehrere weiche Kreise.
    smoke(ctx, x, y, r, k, a = 1) {
        if (r <= 0.5 || k <= 0) return;
        const prev = ctx.globalAlpha;
        const n = 7;
        for (let i = 0; i < n; i++) {
            const ang = (i * TAU) / n + i * 1.3;
            const d = r * (0.18 + 0.72 * ((i % 3) / 2)) * k;
            const rr = r * (0.62 - 0.22 * (i % 3)) * (0.5 + k * 0.9);
            ctx.fillStyle = i % 2 ? VampCfg.smoke : Art.light(VampCfg.smoke, 0.28);
            ctx.globalAlpha = prev * clamp(a * (1 - k) * 0.62, 0, 1);
            ctx.beginPath();
            ctx.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.72 - k * r * 0.2, Math.max(0.6, rr), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = prev;
    },

    // Kleiner Fledermaus-Silhouette (Schwarm bei der Verwandlung)
    miniBat(ctx, x, y, s, flap) {
        if (s <= 0.2) return;
        ctx.fillStyle = VampCfg.furDark;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - s * 1.6, y - s * (0.9 + flap * 0.7), x - s * 2.8, y - s * flap);
        ctx.quadraticCurveTo(x - s * 1.5, y + s * 0.5, x, y + s * 0.4);
        ctx.quadraticCurveTo(x + s * 1.5, y + s * 0.5, x + s * 2.8, y - s * flap);
        ctx.quadraticCurveTo(x + s * 1.6, y - s * (0.9 + flap * 0.7), x, y);
        ctx.closePath();
        ctx.fill();
    },

    // ── Geschosse ──

    // Blut-Tropfen (Comic-Stil: dunkelrot mit hellem Glanzpunkt, tropfenförmig)
    shotBlood(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 6, VampCfg.bloodLight);
        Art.glow(ctx, p.x, p.y, 15, VampCfg.bloodLight, 0.5);
        const a = Math.atan2(this.vy, this.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.quadraticCurveTo(-1, -4.6, 5.2, 0);
        ctx.quadraticCurveTo(-1, 4.6, -9, 0);
        ctx.closePath();
        ctx.fillStyle = VampCfg.blood;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = Art.ink(VampCfg.blood);
        ctx.stroke();
        Art.shine(ctx, 0.6, -1.6, 1.9, 1.1, -0.4, 0.7);
        ctx.restore();
    },

    // Fledermaus-Staub (graues Wölkchen mit zwei winzigen Flügeln)
    shotDust(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time * 6 + (this.age || 0) * 9;
        LateWorldArt._trail(ctx, p.x, p.y, this.vx, this.vy, 5, VampCfg.dust);
        Art.glow(ctx, p.x, p.y, 14, VampCfg.dust, 0.42);
        for (let i = 0; i < 3; i++) {
            const a = t + (i * TAU) / 3;
            Art.body(ctx, p.x + Math.cos(a) * 3.2, p.y + Math.sin(a) * 2.4, 3.4, 3, i % 2 ? VampCfg.dust : Art.light(VampCfg.dust, 0.3),
                { lineWidth: 1, highlight: false });
        }
        VampArt.miniBat(ctx, p.x, p.y, 2.4, Math.sin(t * 2.4));
    },

};

// ══════════════════════════════════════════
// ── Normaler Vampir ──
// ══════════════════════════════════════════

// Blasser Vampir mit schwarzem Umhang und rotem Futter. Hält 70–150 Einheiten Abstand und schießt Blut
//   oder Fledermaus-Staub; aus der Nähe reißt er erst den Mund auf (Ansage, roter Kreis = Trefferkreis)
//   und beißt dann – das Ziel schläft drei Sekunden ein. Schlüsselträger: graue Zähne.
class Vampire extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 34);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(42, 52);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.fxColor = VampCfg.lining;
        this.seed = Math.random() * 10;
        this.detectionRange = 235;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.15 };
        this.state = 'idle';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(1, 2.2);
        this.step = 0;
        this.moving = false;
        this.gray = false;                 // graue Zähne (Schlüsselträger)
        this.aim = null;                   // Biss-Punkt
        this.seq = 0;                      // abwechselnd Blut / Staub
        this.glide = 0;                    // schwebt leicht
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.gray ? VC_KEY : VC_PLAIN; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): graue Zähne, etwas zäher
            this._keyInit = true;
            this.gray = true;
            this.hp = this.maxHp = 9;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        const air = this.state === 'biteWind' || this.state === 'bite';
        this.contactDamage = !air;
        if (this.state !== 'bite' && this.state !== 'biteWind') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 5) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('hiss', 0.75);       // Umhang ausgebreitet: erst sehen, dann schlagen
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'hiss':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'bloodWind':
                if (this.stateT <= 0) {
                    this._shootBlood(this.aim);
                    this._set('shoot', 0.16);
                }
                break;
            case 'dustWind':
                if (this.stateT <= 0) {
                    this._shootDust(this.aim);
                    this._set('shoot', 0.16);
                }
                break;
            case 'shoot':
                if (this.stateT <= 0) {
                    this.cool = this.gray ? randRange(1.1, 1.7) : randRange(1.5, 2.3);
                    this._set('walk', 0);
                }
                break;
            case 'biteWind':
                if (this.stateT <= 0) {
                    this._biteHit();
                    this._set('bite', 0.22);
                }
                break;
            case 'bite':
                if (this.stateT <= 0) {
                    this.cool = randRange(1.6, 2.4);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Abstand halten und Angriff aussuchen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.22 * dt, Math.cos(this.step * 0.7) * this.speed * 0.22 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 140) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 58) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 5.6;
        } else this.step += dt * 1.5;
        if (this.cool > 0) return;
        if (dist < 72) { this._startBite(player); return; }
        if (dist < 215) {
            const t = VampArt.nearest(player, this.centerX(), this.centerY(), 240);
            if (t) {
                this.aim = { x: t.t.x, y: t.t.y };
                if (Math.abs(this.aim.x - this.centerX()) > 3) this.face = this.aim.x > this.centerX() ? 1 : -1;
                const blood = this.seq++ % 3 !== 2;      // zwei Drittel Blut, ein Drittel Staub
                this._set(blood ? 'bloodWind' : 'dustWind', blood ? 0.52 : 0.46);
                return;
            }
        }
        this.cool = 0.6;
    }

    _startBite(player) {
        const t = VampArt.nearest(player, this.centerX(), this.centerY(), 92);
        this.aim = t ? { x: t.t.x, y: t.t.y } : { x: this.centerX() + this.face * 30, y: this.centerY() };
        if (Math.abs(this.aim.x - this.centerX()) > 3) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this.biteHit = [];
        this._set('biteWind', 0.55);        // Ansage: Mund auf, Kreis am Ziel
    }

    // Der Biss landet genau da, wo der rote Kreis war – der Kreis ist der Trefferbereich.
    _biteHit() {
        const a = this.aim || { x: this.centerX() + this.face * 26, y: this.centerY() };
        VampArt.areaHit(a.x, a.y, 26, 1, 150, this.biteHit);
        VampArt.sleepArea(a.x, a.y, 26, VampCfg.sleep, this.biteHit);
        VampArt.shake(2.2, 0.1);
        VampArt.burst(a.x, a.y, [VampCfg.lining, '#ffffff'], 8, 130, 0.34, { kind: 'spark' });
        VampArt.ring(a.x, a.y, VampCfg.lining, 26, 0.22, 3);
    }

    _shootBlood(aim) {
        if (typeof LateWorldArt === 'undefined') return;
        const mx = this.centerX(), my = this.centerY() - 4;
        const a = aim ? Math.atan2(aim.y - my, aim.x - mx) : Math.atan2(this.look.y, this.look.x || 1);
        for (const off of [-0.16, 0.16]) {
            const p = LateWorldArt.shoot(mx + Math.cos(a) * 12, my + Math.sin(a) * 12, a + off, 155, 90, VampArt.shotBlood);
            if (p) { p.hitsCompanions = true; p.stunTime = 0.7; p.radius = 6; }
        }
        VampArt.burst(mx + Math.cos(a) * 12, my + Math.sin(a) * 12, [VampCfg.blood, VampCfg.bloodLight], 6, 90, 0.3);
    }

    _shootDust(aim) {
        if (typeof LateWorldArt === 'undefined') return;
        const mx = this.centerX(), my = this.centerY() - 4;
        const a = aim ? Math.atan2(aim.y - my, aim.x - mx) : Math.atan2(this.look.y, this.look.x || 1);
        const p = LateWorldArt.shoot(mx + Math.cos(a) * 12, my + Math.sin(a) * 12, a, 128, 70, VampArt.shotDust);
        if (p) { p.hitsCompanions = true; p.stunTime = 1.1; p.radius = 7; p.poison = true; }
        VampArt.burst(mx + Math.cos(a) * 12, my + Math.sin(a) * 12, [VampCfg.dust, VampCfg.dustDark, '#ffffff'], 7, 80, 0.4, { kind: 'smoke', size: 4 });
    }

    // Ansage am Boden: Zielkreis für den Biss (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        if (this.state === 'biteWind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 26, this._k(), VampCfg.warn);
            return;
        }
        if (this.state === 'bite' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            Art.ring(ctx, p.x, p.y, 18 + this._k() * 22, VampCfg.lining, 3.4, 0.75);
        }
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
        const glide = Math.sin(Art.time * 2.6 + this.seed) * 1.6;
        ctx.translate(cx, foot - Math.max(0, glide));
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 14 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const wind = st === 'biteWind' ? k : 0;
        const bite = st === 'bite';
        const cast = st === 'bloodWind' || st === 'dustWind' ? k : 0;
        const hiss = st === 'hiss' ? Math.sin(clamp(k, 0, 1) * Math.PI) : 0;
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 2.2) * 0.7) - wind * 1.5;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 2.2) * 0.012);
        const top = (-10 - bob) - 21;
        // Hände: im Flug ausgebreitet, beim Schuss vorn hoch, beim Biss weit zurück und dann nach vorn
        let hb = { x: -12.5, y: top + 12 + Math.sin(t * 1.8) * 1.2 };
        let hf = { x: 12.5, y: top + 12 - Math.sin(t * 1.8) * 1.2 };
        if (hiss) { hb = { x: -15 - hiss * 3, y: top + 4 - hiss * 5 }; hf = { x: 15 + hiss * 3, y: top + 4 - hiss * 5 }; }
        else if (cast) { hb = { x: -10, y: top + 9 }; hf = { x: 11 + cast * 6, y: top + 6 - cast * 3 }; }
        else if (wind) { hb = { x: -9, y: top + 6 }; hf = { x: 4 - wind * 8, y: top + 1 - wind * 5 }; }
        else if (bite) { hf = { x: 17, y: top + 9 }; hb = { x: -11, y: top + 10 }; }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, top + 10, 24, '#cfd6e4', 0.28 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (bite || wind) ? 'open' : tired ? 'tired' : (hiss || cast ? 'angry' : 'angry');
        VampArt.figure(ctx, {
            c, lw: 1.2, t, bob, walk, hands: { b: hb, f: hf }, mood,
            look: { x: this.look.x * this.face, y: this.look.y },
            cape: hiss * 0.9 + cast * 0.3, capeUp: hiss,
            fangs: this.gray ? VampCfg.toothKey : VampCfg.tooth,
        });
        if ((st === 'bloodWind' || st === 'dustWind') && !dead) {
            const gl = st === 'dustWind' ? VampCfg.dust : VampCfg.bloodLight;
            Art.glow(ctx, hf.x, hf.y, 12 * (0.5 + cast), gl, 0.35 + 0.4 * cast);
        }
        if (bite && !dead) Art.glow(ctx, hf.x, hf.y, 13, VampCfg.lining, 0.45);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESENVAMPIR in zwei Gestalten (Endgegner Welt 49) ──
// ══════════════════════════════════════════

// Ein Objekt, zwei Gestalten (this.form): Riesenfledermaus -> Verwandlung -> Riesenvampir.
class BossGiantVampire extends Enemy {
    constructor(x, y) {
        super(x, y, 92, 84);
        this.form = 'fledermaus';
        this.hp = 135;
        this.maxHp = 135;
        this.vampirHp = 140;               // neue volle Leiste nach der Verwandlung
        this.speed = 54;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.phasesThroughWalls = true;    // beide Gestalten schweben
        this.shadow = { rx: 38, ry: 12, dy: 40, alpha: 0.26 };
        this.fxColor = VampCfg.lining;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 1.9;
        this.stateDur = 1.9;
        this.seq = 0;
        this.cool = 0.8;
        this.step = 0;
        this.moving = true;
        this.lift = 0;
        this.flap = 0;
        this.aim = null;                   // Ziel von Kratzer, Sturzflug, Blut oder Schlaf
        this.to = null;                    // Flug-/Teleportziel
        this.from = null;
        this.hitOnce = [];
        this.bigHits = 0;
        this.tpAlpha = 1;                  // 1 = sichtbar, 0 = in der Rauchwolke
        this.rage = 0;
        this.swarm = 0;                    // 0..1 Fledermausschwarm während der Verwandlung
    }

    static room(world) { return VampArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _p2() { return this.phase === 2; }

    // Tod der Fledermaus = Verwandlung; erst der Vampir kann sterben.
    takeDamage(amount, ka, kf) {
        if (this.state === 'transform' || this.state === 'appear' || this.dead) return;
        super.takeDamage(amount, ka, kf);
        if (this.dead && this.form === 'fledermaus') {
            this.dead = false;
            this.deathTimer = 0;
            this.hp = 0;
            this._beginTransform();
        }
    }

    _beginTransform() {
        const mx = this.centerX(), my = this.centerY();
        this.contactDamage = false;
        this.tpAlpha = 1;
        this.swarm = 0;
        this._set('transform', 2.1);
        VampArt.shake(7, 0.5);
        VampArt.burst(mx, my, [VampCfg.smoke, Art.light(VampCfg.smoke, 0.35), VampCfg.furDark], 26, 150, 0.85, { kind: 'smoke', size: 7 });
        VampArt.ring(mx, my, VampCfg.smoke, 116, 0.7, 7);
        VampArt.burst(mx, my, [VampCfg.furDark, VampCfg.wing], 16, 200, 0.8, { kind: 'star' });
        if (typeof FX !== 'undefined') FX.screenFlash('#2a1f3a', 0.35);
    }

    _finishTransform() {
        const mx = this.centerX(), my = this.centerY();
        this.form = 'vampir';
        this.phase = 1;
        this.maxHp = this.vampirHp;
        this.hp = this.vampirHp;                 // neue VOLLE Lebensleiste
        this.bigHits = 0;
        this.seq = 0;
        this.speed = 44;
        this.contactDamage = false;
        this.swarm = 0;
        this._set('appear', 1.05);
        VampArt.shake(9, 0.5);
        VampArt.burst(mx, my, [VampCfg.lining, '#ffffff', VampCfg.cape], 30, 210, 0.9, { kind: 'star' });
        VampArt.ring(mx, my, VampCfg.lining, 150, 0.8, 8);
        VampArt.burst(mx, my - 20, [VampCfg.smoke, '#ffffff'], 12, 110, 0.9, { kind: 'smoke', size: 7 });
        if (typeof FX !== 'undefined') FX.screenFlash('#ffffff', 0.5);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        if (this.state === 'transform') {
            // Die Verwandlung läuft ab: Rauch, Schwarm, danach steigt der Vampir auf. In dieser Zeit
            // ist der Boss nicht treffbar (takeDamage ignoriert Treffer), er steht still.
            this.swarm = clamp(this._k(), 0, 1);
            this.contactDamage = false;
            this.moving = false;
            this.lift = Math.sin(clamp(this._k(), 0, 1) * Math.PI) * 7;
            this.stateT -= dt;
            if (this.stateT <= 0) this._finishTransform();
            VampArt.clampToRoom(this, world);
            return;
        }
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        // Phasenwechsel: Fledermaus bei halber Kraft, Vampir bei halber Kraft der NEUEN Leiste
        if (this.form === 'fledermaus' && this.phase === 1 && this.hp > 0 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 74;
            VampArt.burst(mx, my, [VampCfg.lining, '#ffffff'], 20, 190, 0.7, { kind: 'star' });
            VampArt.ring(mx, my, VampCfg.lining, 100, 0.6, 6);
            VampArt.shake(7, 0.4);
        }
        if (this.form === 'vampir' && this.phase === 1 && this.hp > 0 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 60;
            VampArt.burst(mx, my, [VampCfg.lining, '#ffffff', VampCfg.cape], 22, 200, 0.7, { kind: 'star' });
            VampArt.ring(mx, my, VampCfg.lining, 112, 0.6, 6);
            VampArt.shake(8, 0.45);
        }
        this.rage += ((this.phase === 2 ? 1 : 0) - this.rage) * Math.min(1, dt * 3);
        const still = this.state === 'intro' || this.state === 'transform' || this.state === 'appear' || this.state === 'dizzy';
        if (!still) {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (Math.abs(dx) > 10) this.face = dx > 0 ? 1 : -1;
        }
        if (this.state === 'tpOut' || this.state === 'tpIn') this.tpAlpha = this.state === 'tpOut' ? 1 - this._k() : this._k();
        else this.tpAlpha = 1;
        this.stateT -= dt;
        if (this.form === 'fledermaus') this._updateBat(dt, world, player, dist, dx, dy);
        else this._updateVampir(dt, world, player, dist, dx, dy);
        VampArt.clampToRoom(this, world);
    }

    // ── Gestalt 1: Riesenfledermaus ──
    _updateBat(dt, world, player, dist, dx, dy) {
        this.flap = Math.sin(Art.time * (this._p2() ? 9 : 6.5) + this.seed);
        switch (this.state) {
            case 'intro':
                this.moving = false;
                if (this.stateT <= 0) this._set('arc', 1.1);
                break;
            case 'arc': this._arcFly(dt, world, player, dist, dx, dy); break;
            case 'clawWind':
                this.moving = false;
                if (this.stateT <= 0) {
                    this._clawHit();
                    this._set('claw', 0.2);
                }
                break;
            case 'claw':
                this.moving = false;
                if (this.stateT <= 0) {
                    if (this._p2() && this.doubleClaw) { this.doubleClaw = false; this._startClaw(player); break; }
                    this._afterBig();
                }
                break;
            case 'diveWind':
                this.moving = false;
                if (this.stateT <= 0) {
                    this.from = { x: this.x, y: this.y };
                    this._set('dive', this._p2() ? 0.52 : 0.66);
                }
                break;
            case 'dive': this._dive(dt); break;
            case 'hover':
                this.moving = false;
                if (this.stateT <= 0) this._set('arc', 0.9);
                break;
            default:
                if (this.stateT <= 0) this._set('arc', 0.9);
        }
    }

    // Fliegt Bögen: gerade Richtung zum Ziel, seitlich ausgelenkt – gut lesbar und nie durch Mauern
    _arcFly(dt, world, player, dist, dx, dy) {
        this.moving = true;
        this.step += dt * (this._p2() ? 3.4 : 2.6);
        if (player.dead) {
            this.x += Math.sin(this.step) * this.speed * 0.3 * dt;
            this.y += Math.cos(this.step * 0.8) * this.speed * 0.3 * dt;
            return;
        }
        let nx, ny;
        if (dist > 150) { nx = dx / dist; ny = dy / dist; }
        else if (dist < 74) { nx = -dx / dist; ny = -dy / dist; }
        else { nx = -dy / dist; ny = dx / dist; }
        const bend = Math.sin(this.step * 1.5) * 0.85;
        const a = Math.atan2(ny, nx) + bend;
        this.x += Math.cos(a) * this.speed * dt;
        this.y += Math.sin(a) * this.speed * dt;
        this.lift = 6 + Math.sin(this.step * 1.5) * 4;
        this.cool -= dt;
        if (this.cool <= 0) this._nextAttack(world, player, dist);
    }

    _nextAttack(world, player, dist) {
        const cyc = this._p2() ? BossGiantVampire.BAT2 : BossGiantVampire.BAT1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'claw' && dist > 128) what = 'dive';
        if (what === 'dive' && dist < 70) what = 'claw';
        if (what === 'claw') this._startClaw(player);
        else if (what === 'dive') this._startDive(world, player);
        else { this.cool = this._p2() ? 0.45 : 0.8; this._set('arc', 0.9); }
    }

    // Kratzer mit der Flügelkralle: Zielkreis am Ziel, dann drei Krallengurven
    _startClaw(player) {
        const t = VampArt.nearest(player, this.centerX(), this.centerY(), 150);
        if (!t) { this.cool = 0.6; return; }
        this.aim = { x: t.t.x, y: t.t.y };
        this.clawR = this._p2() ? 62 : 54;
        this.doubleClaw = this._p2() && this.seq % 2 === 0;
        if (Math.abs(this.aim.x - this.centerX()) > 6) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this.hitOnce = [];
        this._set('clawWind', this._p2() ? 0.44 : 0.58);
    }

    _clawHit() {
        const a = this.aim || { x: this.centerX() + this.face * 30, y: this.centerY() };
        const R = this.clawR || 54;
        VampArt.areaHit(a.x, a.y, R, 2, 220, this.hitOnce);
        VampArt.shake(4.6, 0.16);
        VampArt.burst(a.x, a.y, [VampCfg.claw, '#ffffff', VampCfg.lining], 12, 180, 0.4, { kind: 'spark' });
        VampArt.ring(a.x, a.y, VampCfg.lining, R, 0.26, 4.4);
    }

    // Sturzflug in einem Bogen auf den angesagten Punkt
    _startDive(world, player) {
        const t = VampArt.nearest(player, this.centerX(), this.centerY(), 320);
        if (!t) { this.cool = 0.6; return false; }
        const spot = VampArt.spotInRoom(world, this, t.t.x, t.t.y);
        if (!spot) { this.cool = 0.6; return false; }
        this.aim = { x: spot.x, y: spot.y };
        this.diveR = this._p2() ? 66 : 58;
        this.hitOnce = [];
        this.lift = 10;
        this._set('diveWind', this._p2() ? 0.5 : 0.66);
        return true;
    }

    _dive(dt) {
        const k = this._k();
        const from = this.from || { x: this.x, y: this.y };
        const toX = this.aim.x - this.w / 2, toY = this.aim.y - this.h / 2;
        const e = k * k * (3 - 2 * k);
        this.x = from.x + (toX - from.x) * e;
        this.y = from.y + (toY - from.y) * e;
        this.lift = 16 + Math.sin(k * Math.PI) * 30;
        if (Math.abs(toX - this.x) > 4) this.face = toX > this.x ? 1 : -1;
        this.moving = true;
        if (this.stateT <= 0) {
            const mx = this.centerX(), my = this.centerY();
            VampArt.areaHit(mx, my, this.diveR || 58, 2, 250, this.hitOnce);
            VampArt.shake(8, 0.34);
            VampArt.ring(mx, my, '#e8dcf6', (this.diveR || 58) + 26, 0.4, 6);
            VampArt.burst(mx, my + 10, [VampCfg.furDark, '#e6dff0', '#ffffff'], 16, 190, 0.5, { kind: 'spark' });
            VampArt.burst(mx, my + 14, [VampCfg.smoke, '#ffffff'], 7, 80, 0.55, { kind: 'smoke', size: 6 });
            this.lift = 0;
            this._set('hover', this._p2() ? 0.34 : 0.46);
        }
    }

    // ── Gestalt 2: Riesenvampir ──
    _updateVampir(dt, world, player, dist, dx, dy) {
        this.flap = 0;
        switch (this.state) {
            case 'appear':
                this.moving = false;
                if (this.stateT <= 0) this._set('stalk', 0);
                break;
            case 'stalk': this._stalk(dt, world, player, dist, dx, dy); break;
            case 'bow':
                this.moving = false;
                if (this.stateT <= 0) {
                    this.cool = this._p2() ? 0.5 : 0.9;
                    this._set('stalk', 0);
                }
                break;
            case 'bloodWind':
                this.moving = false;
                if (this.stateT <= 0) {
                    this._bloodVolley();
                    this._set('bow', 0.5);
                }
                break;
            case 'sleepWind':
                this.moving = false;
                if (this.stateT <= 0) {
                    this._sleepCast();
                    this._set('sleepCast', this._p2() ? 0.4 : 0.5);
                }
                break;
            case 'sleepCast':
                this.moving = false;
                if (this.stateT <= 0) {
                    if (this._p2() && this.doubleSleep) { this.doubleSleep = false; this._startSleep(world, player); break; }
                    this._afterBig();
                }
                break;
            case 'clawWind':
                this.moving = false;
                if (this.stateT <= 0) {
                    this._vampClawHit();
                    this._set('claw', 0.2);
                }
                break;
            case 'claw':
                this.moving = false;
                if (this.stateT <= 0) {
                    this.cool = this._p2() ? 0.4 : 0.7;
                    this._set('stalk', 0);
                }
                break;
            case 'tpOut':
                this.moving = false;
                if (this.stateT <= 0) {
                    if (this.to) {
                        this.x = this.to.x - this.w / 2;
                        this.y = this.to.y - this.h / 2;
                    }
                    this._set('tpIn', 0.42);
                    VampArt.burst(this.centerX(), this.centerY(), [VampCfg.smoke, Art.light(VampCfg.smoke, 0.4), '#ffffff'], 18, 150, 0.6, { kind: 'smoke', size: 7 });
                }
                break;
            case 'tpIn':
                this.moving = false;
                if (this.stateT <= 0) {
                    this.cool = this._p2() ? 0.35 : 0.6;
                    this._set('stalk', 0);
                }
                break;
            case 'dizzy':
                this.moving = false;
                if (this.stateT <= 0) {
                    this.cool = 0.4;
                    this._set('stalk', 0);
                }
                break;
            default:
                if (this.stateT <= 0) this._set('stalk', 0);
        }
    }

    // Schreitet gemessen auf Mark zu, hält aber Abstand für seine Angriffe
    _stalk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.moving = false;
            this.step += dt * 1.6;
            return;
        }
        this.moving = true;
        this.step += dt * 3.4;
        let vx = 0, vy = 0;
        if (dist > 128) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 66) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        this.x += vx * this.speed * dt;
        this.y += vy * this.speed * dt;
        this.cool -= dt;
        if (this.cool <= 0) this._nextVampirAttack(world, player, dist);
    }

    _nextVampirAttack(world, player, dist) {
        const cyc = this._p2() ? BossGiantVampire.VAMPIR2 : BossGiantVampire.VAMPIR1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'claw' && dist > 96) what = 'blood';
        if (what === 'blood') this._startBlood(player);
        else if (what === 'sleep') this._startSleep(world, player);
        else if (what === 'claw') this._startVampClaw(player);
        else if (what === 'tp') this._startTeleport(world, player);
        else { this.cool = this._p2() ? 0.5 : 0.95; this._set('bow', this.cool + 0.2); }
    }

    // Blut: Vorwarnung durch glühende Augen und Strahlen, dann ein Fächer aus Tropfen
    _startBlood(player) {
        const t = VampArt.nearest(player, this.centerX(), this.centerY(), 340);
        if (!t) { this.cool = 0.6; return; }
        this.aim = { x: t.t.x, y: t.t.y };
        this.bloodN = this._p2() ? 9 : 6;
        if (Math.abs(this.aim.x - this.centerX()) > 6) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this._set('bloodWind', this._p2() ? 0.52 : 0.68);
    }

    _bloodVolley() {
        if (typeof LateWorldArt === 'undefined') return;
        const mx = this.centerX(), my = this.centerY() - 6;
        const a0 = this.aim ? Math.atan2(this.aim.y - my, this.aim.x - mx) : Math.atan2(this.look.y, this.look.x || 1);
        const n = this.bloodN || 6;
        const spread = (n === 1 ? 0 : 0.62) * (this._p2() ? 1.15 : 1);
        for (let i = 0; i < n; i++) {
            const a = a0 + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
            const p = LateWorldArt.shoot(mx + Math.cos(a) * 22, my + Math.sin(a) * 22, a, this._p2() ? 178 : 158, 110, VampArt.shotBlood);
            if (p) { p.hitsCompanions = true; p.stunTime = 0.8; p.radius = 6.5; }
        }
        VampArt.burst(mx + Math.cos(a0) * 22, my + Math.sin(a0) * 22, [VampCfg.blood, VampCfg.bloodLight, '#ffffff'], 10, 130, 0.4);
        VampArt.ring(mx, my, VampCfg.bloodLight, 46, 0.3, 4);
        VampArt.shake(3.4, 0.14);
    }

    // Einschlafen lassen: der violette Kreis ist der Trefferbereich, er bleibt stehen – wer
    // rechtzeitig hinausläuft, wird nicht müde. Danach schlafen die Treffer drei Sekunden.
    _startSleep(world, player) {
        const t = VampArt.nearest(player, this.centerX(), this.centerY(), 340);
        if (!t) { this.cool = 0.6; return; }
        this.sleepAim = { x: t.t.x, y: t.t.y };
        this.sleepR = this._p2() ? 62 : 54;
        this.doubleSleep = this._p2() && this.seq % 2 === 0;
        this.hitOnce = [];
        this._set('sleepWind', this._p2() ? 0.8 : 1);
    }

    _sleepCast() {
        const a = this.sleepAim || { x: this.centerX(), y: this.centerY() };
        const R = this.sleepR || 54;
        const gewirkt = VampArt.sleepArea(a.x, a.y, R, VampCfg.sleep, this.hitOnce);
        VampArt.burst(a.x, a.y, ['#a06fff', '#e6d4ff', VampCfg.cape], 20, 140, 0.8, { kind: 'smoke', size: 6 });
        VampArt.ring(a.x, a.y, '#c9a8ff', R, 0.5, 5);
        VampArt.burst(a.x, a.y - 10, ['#e6d4ff', '#ffffff'], 8, 90, 0.7, { kind: 'star' });
        if (gewirkt && typeof FX !== 'undefined') FX.text(a.x, a.y - 26, 'Zzz', '#e6d4ff', 15);
        VampArt.shake(2.4, 0.14);
    }

    // Nahkampf-Schwinge mit der Kralle, falls Mark zu dicht herankommt
    _startVampClaw(player) {
        const t = VampArt.nearest(player, this.centerX(), this.centerY(), 130);
        if (!t) { this.cool = 0.6; return; }
        this.aim = { x: t.t.x, y: t.t.y };
        this.clawR = 48;
        this.hitOnce = [];
        if (Math.abs(this.aim.x - this.centerX()) > 6) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this._set('clawWind', this._p2() ? 0.4 : 0.52);
    }

    _vampClawHit() {
        const a = this.aim || { x: this.centerX() + this.face * 34, y: this.centerY() };
        VampArt.areaHit(a.x, a.y, this.clawR || 48, 2, 240, this.hitOnce);
        VampArt.shake(4.2, 0.16);
        VampArt.burst(a.x, a.y, [VampCfg.cape, '#ffffff', VampCfg.lining], 11, 170, 0.4, { kind: 'spark' });
        VampArt.ring(a.x, a.y, VampCfg.lining, this.clawR || 48, 0.26, 4);
    }

    // Teleport: Rauchwolke hier, Rauchwolke dort – kein Angriff, deshalb keine Schadens-Vorwarnung.
    _startTeleport(world, player) {
        const room = VampArt.room(world);
        const half = Math.max(this.w, this.h) / 2;
        const cx = this.centerX(), cy = this.centerY();
        const t = VampArt.nearest(player, cx, cy, 400);
        const base = t ? { x: t.t.x, y: t.t.y } : { x: cx, y: cy };
        let best = null;
        for (let i = 0; i < 10; i++) {
            const a = Math.random() * TAU;
            const d = randRange(96, 168);
            const spot = VampArt.spotInRoom(world, this, base.x + Math.cos(a) * d, base.y + Math.sin(a) * d);
            if (!spot) continue;
            const nd = Math.hypot(spot.x - cx, spot.y - cy);
            if (room && nd < 70) continue;                 // nicht direkt neben sich selbst
            if (!best || nd > best.d) best = { spot, d: nd };
        }
        const goal = best ? best.spot : VampArt.spotInRoom(world, this, cx + (this.face > 0 ? -140 : 140), cy);
        if (!goal) { this.cool = 0.7; return; }
        this.to = { x: clamp(goal.x, room ? room.x + half : goal.x, room ? room.x + room.w - half : goal.x), y: goal.y };
        this.to.y = clamp(this.to.y, room ? room.y + half : goal.y, room ? room.y + room.h - half : goal.y);
        VampArt.burst(cx, cy, [VampCfg.cape, VampCfg.smoke, '#ffffff'], 20, 160, 0.7, { kind: 'smoke', size: 7 });
        VampArt.burst(cx, cy, [VampCfg.furDark, VampCfg.wing], 6, 120, 0.6, { kind: 'star' });
        VampArt.ring(cx, cy, VampCfg.smoke, 62, 0.4, 5);
        this._set('tpOut', 0.34);
    }

    // Nach großen Angriffen: kurze Pause – bei wenig Leben wird er schwindelig (Marks Zeit zum Zuschlagen)
    _afterBig() {
        this.bigHits++;
        const wenig = this.hp <= this.maxHp * 0.35;
        if (this._p2() && (wenig || this.bigHits % 2 === 0)) {
            this._set('dizzy', wenig ? 2 : 1.6);
            VampArt.burst(this.centerX(), this.y + 18, ['#ffe35a', '#ffffff'], 10, 90, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this._p2() ? 0.55 : 0.95;
        this._set(this.form === 'vampir' ? 'bow' : 'hover', this.cool + 0.3);
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const mx = this.centerX(), my = this.centerY();
        if (st === 'clawWind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, this.clawR || 54, this._k(), VampCfg.warn);
            return;
        }
        if (st === 'diveWind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, this.diveR || 58, this._k(), st === 'dive' ? '#ff3d5a' : VampCfg.warn);
            LateWorldArt.rays(ctx, p.x, p.y, 8, this.seed, (this.diveR || 58) * 0.55, (this.diveR || 58) * (0.8 + 0.4 * this._k()), this._k(), '#ffb03a');
            const s = camera.worldToScreen(mx, my);
            Art.ring(ctx, s.x, s.y, 22 + this._k() * 16, '#ffffff', 2.4, 0.35);
            return;
        }
        if (st === 'bloodWind' && this.aim) {
            const p = camera.worldToScreen(mx, my);
            const a0 = Math.atan2(this.aim.y - my, this.aim.x - mx);
            LateWorldArt.rays(ctx, p.x, p.y, this.bloodN || 6, a0 - 0.31, 24, 92, this._k(), VampCfg.warn);
            return;
        }
        if (st === 'sleepWind' && this.sleepAim) {
            const p = camera.worldToScreen(this.sleepAim.x, this.sleepAim.y);
            LateWorldArt.warn(ctx, p.x, p.y, this.sleepR || 54, this._k(), VampCfg.sleepWarn);
            Art.ring(ctx, p.x, p.y, (this.sleepR || 54) + 8, '#c9a8ff', 2, 0.35 + 0.2 * Math.sin(Art.time * 8));
            const n = 3;
            for (let i = 0; i < n; i++) {
                const k = (this._k() * 1.4 + i / n) % 1;
                Art.text(ctx, 'z', p.x + 10 + k * 12, p.y - 14 - k * 20, { size: 9 + k * 6, color: '#e6d4ff', lineWidth: 3 });
            }
            return;
        }
        if (st === 'claw' || st === 'dive' || st === 'sleepCast') {
            const q = st === 'dive' ? { x: mx, y: my } : (this.aim || this.sleepAim || { x: mx, y: my });
            const p = camera.worldToScreen(q.x, q.y);
            Art.ring(ctx, p.x, p.y, 26 + this._k() * 54, st === 'sleepCast' ? '#c9a8ff' : '#ffe6b8', 4, 0.7);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 36);
            ctx.translate(cx, foot);
            this._body(ctx, true);
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot - this.lift);
        if (this.state === 'transform') {
            const k = this._k();
            VampArt.smoke(ctx, 0, -34, 46, k, 1);
            if (k > 0.35) {
                const n = 9;
                for (let i = 0; i < n; i++) {
                    const a = (i * TAU) / n + k * 2.4;
                    const d = 14 + k * 74;
                    VampArt.miniBat(ctx, Math.cos(a) * d, -34 + Math.sin(a) * d * 0.5 - k * 16,
                        3.6 * (1 - k * 0.4), Math.sin(Art.time * 14 + i));
                }
            }
            if (k > 0.55) {
                ctx.globalAlpha *= clamp((k - 0.55) / 0.45, 0, 1) * 0.85;
                this._vampirBody(ctx, false, true);
            }
            ctx.restore();
            return;
        }
        const tp = this.state === 'tpOut' || this.state === 'tpIn';
        if (tp) {
            VampArt.smoke(ctx, 0, -36, 40, this.state === 'tpOut' ? this._k() : 1 - this._k(), 1);
            if (this.tpAlpha > 0.12) {
                ctx.globalAlpha *= this.tpAlpha * 0.9;
                this._body(ctx, false);
            }
            ctx.restore();
            return;
        }
        this._body(ctx, false);
        ctx.restore();
    }

    _body(ctx, dead) {
        if (this.form === 'fledermaus') this._batBody(ctx, dead);
        else this._vampirBody(ctx, dead, false);
    }

    // Riesenfledermaus: dieselbe Figur wie oben beschrieben, 1,75-fach
    _batBody(ctx, dead) {
        const S = 1.75;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const k = this._k();
        const wind = st === 'clawWind' ? k : 0;
        const claw = st === 'claw' ? 1 : 0;
        const windDive = st === 'diveWind' ? k : 0;
        const dizzy = st === 'dizzy';
        const fold = st === 'dive' ? 0.55 : (wind * 0.35 + windDive * 0.5);
        const bob = dead ? -1 : Math.sin(t * 2.4) * 1.2 + windDive * 3;
        ctx.save();
        ctx.scale(this.face * S, S);
        if (this._p2() && !dead) Art.glow(ctx, 0, -20, 34, VampCfg.lining, 0.18 * this.rage + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (claw || wind || windDive || st === 'dive') ? 'open' : 'angry';
        VampArt.batFigure(ctx, {
            c: VC_BAT, lw: 0.85, t, bob, flap: dead ? 0 : this.flap, fold, mood,
            clawArm: claw + wind * 0.45, look: { x: this.look.x * this.face, y: this.look.y },
        });
        if (this._p2() && !dead && !dizzy) Art.glow(ctx, 0, -30.5, 9, '#ff3b5c', 0.28 + 0.18 * Math.sin(t * 9));
        if ((claw || wind) && !dead) Art.glow(ctx, 8 + (claw || wind) * 15, -24, 16, '#ffffff', 0.4);
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 0, -64, 26, 4.6);
    }

    // Riesenvampir: dieselbe Figur wie die normalen Vampire, 2,15-fach; Phase 2 mit roten Augen und Dampf
    _vampirBody(ctx, dead, ghost) {
        const S = ghost ? 1.9 : 2.15;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const k = this._k();
        const wind = st === 'bloodWind' ? k : 0;
        const sleepW = st === 'sleepWind' || st === 'sleepCast' ? (st === 'sleepCast' ? 1 : k) : 0;
        const clawWind = st === 'clawWind' ? k : 0;
        const claw = st === 'claw' ? 1 : 0;
        const dizzy = st === 'dizzy';
        const appear = st === 'appear' ? k : 0;
        const bow = st === 'bow' ? Math.sin(clamp(k, 0, 1) * Math.PI) : 0;
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.2 : Math.sin(t * 1.8) * 0.9) - bow * 2 + dizzy * 0.8;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 1.8) * 0.012);
        const hip = -10 - bob;
        const top = hip - 21;
        const sway = dizzy ? Math.sin(t * 5) * 1.8 : 0;
        let hb = { x: -14 + sway, y: top + 13 + Math.sin(t * 1.6) * 1.4 };
        let hf = { x: 14 - sway, y: top + 13 - Math.sin(t * 1.6) * 1.4 };
        if (appear) { hb = { x: -17 - appear * 3, y: top + 3 - appear * 6 }; hf = { x: 17 + appear * 3, y: top + 3 - appear * 6 }; }
        else if (bow) { hb = { x: -11, y: hip - 6 }; hf = { x: 12, y: hip - 6 }; }
        else if (wind) { hf = { x: 12 + wind * 8, y: top + 4 - wind * 4 }; hb = { x: -12, y: top + 8 }; }
        else if (sleepW) { hb = { x: -8 - sleepW * 5, y: top + 2 - sleepW * 7 }; hf = { x: 8 + sleepW * 5, y: top + 2 - sleepW * 7 }; }
        else if (clawWind || claw) { hf = { x: 8 + (clawWind || claw) * 20, y: top + 11 }; hb = { x: -12, y: top + 9 }; }
        else if (dizzy) { hb = { x: -13 + sway, y: top + 16 }; hf = { x: 13 + sway, y: top + 16 }; }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face * S, S);
        if (this._p2() && !dead) Art.glow(ctx, 0, hip - 12, 30, VampCfg.lining, 0.2 * this.rage + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (claw || clawWind) ? 'open'
                : st === 'sleepWind' || st === 'sleepCast' || appear ? 'open'
                    : (this.hp <= this.maxHp * 0.35 && !dead) ? 'tired' : 'angry';
        VampArt.figure(ctx, {
            c: VC_PLAIN, lw: 0.72, t, bob, walk, hands: { b: hb, f: hf }, mood,
            look: { x: this.look.x * this.face, y: this.look.y },
            cape: (appear || (st === 'hiss' ? 1 : 0)) * 0.85 + (sleepW * 0.35) + (wind * 0.2),
            capeUp: appear * 0.9 + sleepW * 0.4,
            headDy: bow * 3 + (dizzy ? 1.2 : 0),
            fangs: VampCfg.tooth,
        });
        if ((wind || sleepW) && !dead) {
            const col = wind ? VampCfg.bloodLight : '#a06fff';
            Art.glow(ctx, hf.x, hf.y, 13, col, 0.35 + 0.4 * (wind || sleepW));
            Art.glow(ctx, hb.x, hb.y, 13, col, 0.3 + 0.35 * (wind || sleepW));
        }
        if (claw && !dead) Art.glow(ctx, hf.x, hf.y, 15, VampCfg.lining, 0.45);
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 0, (top - 14) * S, 24, 4.4);
        // Dampf in Phase 2 (kein Schattenverlauf, nur helle Kreise)
        if (this._p2() && !dizzy && !dead && !ghost) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#efe4ff';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.8 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.42;
                ctx.beginPath();
                ctx.arc((i - 1) * 22 + Math.sin(t * 3 + i) * 4, (top - 6) * S - q * 26, 4 + q * 7, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
    }
}

BossGiantVampire.BAT1 = ['claw', 'arc', 'dive', 'arc'];
BossGiantVampire.BAT2 = ['dive', 'claw', 'claw', 'arc'];
BossGiantVampire.VAMPIR1 = ['blood', 'tp', 'sleep', 'bow'];
BossGiantVampire.VAMPIR2 = ['sleep', 'blood', 'tp', 'claw', 'bow'];

// Zweite Gestalt als eigene Klasse (derselbe Boss, nur direkt als Riesenvampir): die Galerie zeigt so
// beide Gestalten, ohne dass das Spiel oder die Weltprüfung Sonderfälle braucht.
class Riesenvampir extends BossGiantVampire {
    constructor(x, y) {
        super(x, y);
        this.form = 'vampir';
        this.maxHp = this.vampirHp;
        this.hp = this.vampirHp;
        this.speed = 44;
        this.state = 'stalk';
        this.stateT = 0;
        this.stateDur = 0;
        this.contactDamage = false;
    }
}

// Der Boss dieser Welt heisst Riesenvampir (Bauplan W49). Die Weltkarte in js/main.js – und die ist für
// diese Aufgabe nicht zu ändern – erzeugt für Welt 49 die Klasse BossGiantVampire, und die Weltprüfung
// (tools/smoke-welt.mjs) schreibt den Klassennamen in ihre Zeile. Damit der Boss überall so heisst, wie
// er aussieht, zeigt sein Klassenname auf den echten Namen; die Klasse selbst bleibt beim Namen, den
// main.js aufruft. Die Galerie kann beide Namen unverändert auflösen.
Object.defineProperty(BossGiantVampire, 'name', { value: 'Riesenvampir', configurable: true });
