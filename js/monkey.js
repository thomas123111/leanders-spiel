// ── Welt 57: Affeninsel (letzte Welt, Idee von Leander) ──
// Affen mit braunem Fell und hellem Gesicht – der mit dem Schlüssel hat GOLDENES Fell, alle anderen braun.
//   Sie holen Kokosnüsse vom Boden auf und werfen sie in hohem Bogen auf Mark ODER einen seiner Freunde
//   (wer näher ist, bekommt zuerst eine ab). Ganze Salven: vier Kokosnüsse hintereinander, das
//   goldene Tier wirft fünf. Gefährlich sind nur die Kokosnüsse, Berührung tut nicht weh.
//   Jede Kokosnuss kündigt sich an: der Affe holt über dem Kopf aus, und am Landeplatz wächst ein
//   roter Warnteller, solange die Nuss fliegt.
// Boss: RIESENAFFE mit KRONE – Endgegner von Welt 57, bleibt im Boss-Raum (Lichtung mit Palmblatt-Thron),
//   148 LP, zwei Phasen.
//     1) Kokosnuss-Explosionen: holt beide Arme hoch, am Boden wachsen fünf (Phase 2: acht) Warnkreise,
//        dann fallen die Kokosnüsse drüber und platzen – Schaden im Kreis für Mark, Juri und das
//        Schattenkrokodil.
//     2) Riesiger Kokosnuss-Hagel: der Riese brüllt, zwölf (Phase 2: achtzehn) Kokosnüsse fallen vom
//        Himmel. Jeder Einschlagpunkt hat vorher einen Schatten am Boden, der mit der Nuss mitwächst.
//     3) Phase 2 (halbe LP): schneller und mehr Nüsse. Bei wenig Leben wird er SCHWINDELIG (Sterne um
//        den Kopf, kurz wehrlos) – das ist Marks Zeit zum Zurückhauen.
//   Freunde verschwinden nie: ein tödlicher Treffer haut Juri und das Krokodil nur um (knockOut).

const MonkeyCfg = {
    fur: '#96602f',           // braunes Fell (heller Ton, damit es auf dem sandigen Boden lesbar bleibt)
    furMid: '#7c4c22',
    furDark: '#5c3517',
    belly: '#c79a63',         // heller Bauchflecken
    face: '#f7e3bd',          // helles Gesicht (Leanders Wunsch)
    faceMid: '#e9cd9c',       // etwas dunklerer Maulkorb
    ear: '#eec99a',           // Innenohr
    line: '#4a3320',          // Nasenlöcher, Gesichtslinien
    gold: '#e9b83a',          // Schlüsselträger: goldenes Fell
    goldMid: '#c9942a',
    goldDark: '#9d7118',
    goldBelly: '#fbe6a8',
    coco: '#6d4426',          // Kokosnuss
    cocoMid: '#8f5f34',
    cocoDark: '#3f2716',
    cocoFiber: '#b98a55',
    crown: '#ffd23f',         // Krone des Riesenaffen
    crownGem: '#ff4d6d',
    crownGem2: '#5ac8ff',
    warn: '#ff7a2f',
};

const C_MONKEY_BROWN = { fur: MonkeyCfg.fur, furMid: MonkeyCfg.furMid, furDark: MonkeyCfg.furDark, belly: MonkeyCfg.belly };
const C_MONKEY_GOLD = { fur: MonkeyCfg.gold, furMid: MonkeyCfg.goldMid, furDark: MonkeyCfg.goldDark, belly: MonkeyCfg.goldBelly };

const MONKEY_WINDUP = 0.5;        // Ausholen mit der Kokosnuss über dem Kopf
const MONKEY_STEP = 0.34;         // Pause zwischen zwei Würfen einer Salve
const MONKEY_FLIGHT = 0.62;       // Flugzeit einer Kokosnuss
const MONKEY_LOB_R = 24;          // Trefferumkreis am Boden
const MONKEY_LOB_DMG = 1;         // halbes Herz
const MONKEY_SHOT_CAP = 40;       // höchstens so viele fliegende Kokosnüsse dieser Welt

const MONK_BOOM_WIND = 1.2;       // Warnkreise der Kokosnuss-Explosionen
const MONK_BOOM_FALL = 0.5;       // Flug der fallenden Nüsse
const MONK_BOOM_R = 34;           // Explosionskreis
const MONK_BOOM_DMG = 2;
const MONK_HAIL_WIND = 1.1;       // Brüllen vor dem Hagel
const MONK_HAIL_FLIGHT = 0.82;    // Fallzeit einer Hagel-Kokosnuss
const MONK_HAIL_R = 26;
const MONK_HAIL_DMG = 1;
const MONK_HAIL_GAP = 0.13;       // Abstand zweier Hagel-Wellen

// Gemeinsame Helfer der Welt 57
const MonkeyKit = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine (Galerie) direkt.
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && istMarkZiel(player) && typeof Game._hurtPlayer === 'function') {
            Game._hurtPlayer(amount, angle, force);
        } else if (player && player.takeDamage) {
            player.takeDamage(amount, angle, force);
        }
    },

    // Treffbare Begleiter (Juri und das Krokodil – nicht die Schlange auf Marks Schulter)
    friends() {
        const out = [];
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Freund treffen: Schaden, aber nie verschwinden – statt besiegt nur umgehauen.
    hitFriend(c, dmg) {
        if (!c || c.dead || c.koTimer > 0 || c.iFrames > 0) return false;
        if (c.hp - dmg <= 0) c.knockOut(6);
        else c.takeDamage(dmg);
        MonkeyKit.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2,
            [MonkeyCfg.cocoMid, '#ffffff', MonkeyCfg.fur], 8, 120, 0.4, { kind: 'star' });
        return true;
    },

    // Mark und die Freunde in einem Kreis um (x, y) – wer zu weit weg ist, bleibt verschont.
    splash(x, y, r, dmg) {
        if (typeof Game !== 'undefined' && Game.player && !Game.player.dead) {
            const p = Game.player;
            const px = p.x + p.w / 2, py = p.y + p.h / 2;
            if (Math.hypot(px - x, py - y) < r + 6) MonkeyKit.hurt(p, dmg, Math.atan2(py - y, px - x), 170);
        }
        for (const c of MonkeyKit.friends()) {
            const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
            if (Math.hypot(cx - x, cy - y) < r + Math.max(c.w || 20, c.h || 20) * 0.3) MonkeyKit.hitFriend(c, dmg);
        }
    },

    // Alle treffbaren Ziele (Mark zuerst, dann die Freunde)
    targets(player) {
        const out = [];
        if (player && !player.dead) {
            out.push({ ref: player, x: player.x + player.w / 2, y: player.y + player.h / 2, isPlayer: true });
        }
        for (const c of MonkeyKit.friends()) {
            out.push({ ref: c, x: c.x + (c.w || 20) / 2, y: c.y + (c.h || 20) / 2 });
        }
        return out;
    },

    // Nächstes Wurfziel, dabei möglichst ein anderes als beim letzten Wurf (Mark UND die Freunde).
    pickTarget(e, player, last) {
        const list = MonkeyKit.targets(player);
        if (!list.length) return null;
        let best = null, alt = null;
        for (const t of list) {
            const d = Math.hypot(t.x - e.centerX(), t.y - e.centerY()) || 1;
            const cand = { ...t, d };
            if (!best || d < best.d) best = cand;
            if (t.ref !== last && (!alt || d < alt.d)) alt = cand;
        }
        return alt || best;
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

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room() {
        if (typeof Game === 'undefined' || !Game.bossActive || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e) {
        const r = MonkeyKit.room();
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, Math.max(r.x + 2, r.x + r.w - e.w - 2));
        e.y = clamp(e.y, r.y + 2, Math.max(r.y + 2, r.y + r.h - e.h - 2));
    },

    free(world, x, y, r) {
        if (!world || !world.collideRect) return true;
        return world.collideRect({ x: x - r, y: y - r, w: r * 2, h: r * 2 }).length === 0;
    },

    // Punkt im Raum (oder um den Werfer herum), an dem nichts im Weg ist.
    spotNear(e, world, minD, maxD) {
        const cx = e.centerX(), cy = e.centerY();
        const room = MonkeyKit.room();
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * TAU;
            const d = randRange(minD, maxD);
            let x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
            if (room) x = clamp(x, room.x + 18, room.x + room.w - 18);
            if (room) y = clamp(y, room.y + 18, room.y + room.h - 18);
            if (MonkeyKit.free(world, x, y, 12)) return { x, y };
        }
        return { x: cx, y: cy + Math.min(e.h, 26) };
    },

    // Fliegende Kokosnüsse dieser Welt (Leistungsdeckel fürs Handy).
    shots() {
        if (typeof Game === 'undefined' || !Game.projectiles) return 0;
        let n = 0;
        for (const p of Game.projectiles) if (!p.dead && p.monkeyWorld) n++;
        return n;
    },

    // Eine Kokosnuss in hohem Bogen auf einen Punkt (from = Wurfsand) oder gerade von oben herunter
    // (straight = Boss-Angriff, die Nuss fällt von außerhalb des Bildes).
    lob(tx, ty, flight, r, dmg, big, straight, from) {
        if (typeof Game === 'undefined' || !Game.projectiles) return null;
        if (MonkeyKit.shots() >= MONKEY_SHOT_CAP) return null;
        const sx = straight ? tx : (from ? from.sx : tx);
        const sy = straight ? ty - 170 : (from ? from.sy : ty);
        const c = new MonkeyCoconut(sx, sy, tx, ty, flight, r, dmg, big, straight);
        Game.projectiles.push(c);
        return c;
    },

    // ── Kokosnuss (rund, braun, drei Keimlöcher, faserig) ──
    coconut(ctx, x, y, r, rot, lw = 1.1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot || 0);
        Art.body(ctx, 0, 0, r, r * 0.94, MonkeyCfg.coco, { glossy: true, lineWidth: lw });
        ctx.strokeStyle = MonkeyCfg.cocoFiber;
        ctx.lineWidth = Math.max(0.7, lw * 0.6);
        ctx.beginPath();
        for (const d of [-0.5, 0.1, 0.7]) {
            ctx.moveTo(-r * 0.8, r * d);
            ctx.quadraticCurveTo(0, r * (d + 0.22), r * 0.8, r * d);
        }
        ctx.stroke();
        // die drei Keimlöcher, eine Kokosnuss ist sofort als eine zu erkennen
        ctx.fillStyle = MonkeyCfg.cocoDark;
        for (const d of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(r * 0.22 * d, -r * 0.3, r * 0.15, r * 0.19, 0, 0, TAU);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.ellipse(0, r * 0.12, r * 0.15, r * 0.19, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
    },

    // ── Ganze Figur (Qwen, 19.10.2026): Affe von vorn, Fußpunkt (0, 0). Eine Einheit = normaler
    // Affe, der Riese zeichnet dieselbe Figur größer (ctx.scale vorher).
    // Runde Kopfform mit zwei großen Seitohren, heller Gesichtsfleck, Scheitelstrupp, langer Ringelschwanz,
    // kurze Beine, lange Arme. p = { c, lw, t, bob, walk, hands: { b, f }, carry, mood, look, crown,
    //                                  headDy, legLift, red }
    figure(ctx, p) {
        const c = p.c, lw = p.lw, t = p.t || 0;
        const hip = -8 - p.bob;
        const wig = Math.sin(t * 2.4);
        // Ringelschwanz (hinter dem Körper, also zuerst)
        const pts = [];
        for (let i = 0; i <= 6; i++) {
            const k = i / 6;
            pts.push({
                x: -6.5 - k * 11,
                y: hip + 1 - Math.sin(k * 2.5 + wig * 0.6) * 3.4 - k * 3.6,
            });
        }
        for (let i = 0; i < pts.length - 1; i++) {
            Art.limb(ctx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y,
                Math.max(1.1, 3.2 - i * 0.34), i < 3 ? c.furMid : c.fur, { lineWidth: lw * 0.7 });
        }
        const tip = pts[pts.length - 1];
        Art.body(ctx, tip.x, tip.y, 1.7, 1.5, c.furDark, { highlight: false, lineWidth: lw * 0.7 });
        // Beine und Füße (kurz, der Affe steht breit)
        for (const s of [-1, 1]) {
            const lift = ((p.legLift && p.legLift[s > 0 ? 1 : 0]) || 0) + Math.max(0, s * (p.walk || 0)) * 2;
            const fx = s * 6;
            Art.limb(ctx, s * 4.4, hip - 1, fx, -2.6 - lift, 5, c.furMid, { lineWidth: lw });
            Art.body(ctx, fx + s * 0.8, -1.7 - lift, 3.8, 2, c.furDark, { lineWidth: lw * 0.85 });
            Art.body(ctx, fx + s * 1.2, -1.1 - lift, 2.3, 1, MonkeyCfg.faceMid, { highlight: false, outline: false });
        }
        // Rumpf: schmale Schultern, runder Bauch
        const top = hip - 19;
        Art.shape(ctx, g => {
            g.moveTo(-6.5, hip + 1.5);
            g.bezierCurveTo(-10.5, hip - 3, -11.5, hip - 10, -9.5, top + 1);
            g.bezierCurveTo(-8, top - 1.5, 8, top - 1.5, 9.5, top + 1);
            g.bezierCurveTo(11.5, hip - 10, 10.5, hip - 3, 6.5, hip + 1.5);
            g.quadraticCurveTo(0, hip + 4, -6.5, hip + 1.5);
            g.closePath();
        }, { x: -11.5, y: top - 2, w: 23, h: hip + 4 - top }, c.fur, { glossy: true, lineWidth: lw });
        Art.body(ctx, 0, hip - 6.5, 5, 5.6, c.belly, { highlight: false, lineWidth: lw * 0.7 });
        // Arme: Schulter → Ellenbogen → Hand (lange Affenarme)
        const arm = (s, h, col) => {
            const sx = s * 8, sy = top + 2.5;
            const mx = (sx + h.x) / 2 + s * 3, my = (sy + h.y) / 2 + 1.5;
            Art.limb(ctx, sx, sy, mx, my, Math.max(1.2, 4.6), col, { lineWidth: lw });
            Art.limb(ctx, mx, my, h.x, h.y, Math.max(1.1, 3.9), col, { lineWidth: lw });
            Art.body(ctx, h.x, h.y, 2.8, 2.6, MonkeyCfg.faceMid, { lineWidth: lw * 0.85 });
        };
        arm(-1, p.hands.b, c.furMid);
        arm(1, p.hands.f, c.fur);
        if (p.carry > 0) {
            const cx = (p.hands.b.x + p.hands.f.x) / 2, cy = (p.hands.b.y + p.hands.f.y) / 2;
            MonkeyKit.coconut(ctx, cx, cy - 1, 3.6 * p.carry, t * 0.8, lw);
        }
        // Kopf mit zwei großen Seitohren
        const hx = 1.2, hy = top - 8 + (p.headDy || 0);
        for (const s of [-1, 1]) {
            Art.body(ctx, hx + s * 9.2, hy + 0.6, 3.5, 3.2, c.fur, { lineWidth: lw });
            Art.body(ctx, hx + s * 9.4, hy + 0.8, 1.8, 1.7, MonkeyCfg.ear, { highlight: false, lineWidth: lw * 0.6 });
        }
        Art.body(ctx, hx, hy, 8.4, 7.9, c.fur, { glossy: true, lineWidth: lw });
        // Scheitelstrupp (drei kleine Fellzacken)
        for (const s of [-1, 0, 1]) {
            Art.body(ctx, hx + s * 2.4, hy - 7.6 + Math.abs(s) * 0.6, 1.5, 2.1, c.furDark,
                { highlight: false, lineWidth: lw * 0.6, rot: s * 0.4 });
        }
        // helles Gesicht: große Herzform ohne dunkle Maske
        Art.shape(ctx, g => {
            g.moveTo(hx, hy - 3.4);
            g.bezierCurveTo(hx + 2.2, hy - 6.2, hx + 6.4, hy - 5, hx + 6, hy - 0.4);
            g.bezierCurveTo(hx + 5.6, hy + 5, hx + 2.6, hy + 7.2, hx, hy + 7);
            g.bezierCurveTo(hx - 2.6, hy + 7.2, hx - 5.6, hy + 5, hx - 6, hy - 0.4);
            g.bezierCurveTo(hx - 6.4, hy - 5, hx - 2.2, hy - 6.2, hx, hy - 3.4);
            g.closePath();
        }, { x: hx - 6.4, y: hy - 6.4, w: 12.8, h: 13.6 }, MonkeyCfg.face, { highlight: false, lineWidth: lw * 0.75 });
        Art.body(ctx, hx, hy + 4, 4, 2.8, MonkeyCfg.faceMid, { highlight: false, lineWidth: lw * 0.6 });
        ctx.fillStyle = MonkeyCfg.line;
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(hx + s * 1.2, hy + 3.1, 0.75, 0.55, s * 0.4, 0, TAU);
            ctx.fill();
        }
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        if (mood === 'dead') LateWorldArt.xEyes(ctx, hx, hy - 0.6, 1.6, 2.7);
        else if (mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.8;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.2 + i * 0.11;
                    const x = hx + s * 2.7 + Math.cos(a) * r, y = hy - 0.6 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, hx + s * 2.7, hy - 0.5, 1.8, { x: look.x, y: look.y },
                    { angry: mood !== 'tired', side: s < 0 ? 'left' : 'right',
                      iris: p.red ? '#ff3b3b' : '#5a3212', open: mood === 'tired' ? 0.55 : 1 });
            }
        }
        Art.mouth(ctx, hx, hy + 5.6, 4, mood === 'open' ? 'teeth' : (mood === 'dizzy' || mood === 'tired') ? 'o' : 'angry');
        // goldene Krone (nur der Riese)
        if (p.crown) {
            const cy2 = hy - 7.2;
            for (const s of [-1, 0, 1]) {
                const zx = hx + s * 5.2;
                Art.shape(ctx, g => {
                    g.moveTo(zx - 2.9, cy2 + 0.6);
                    g.lineTo(zx, cy2 - (s === 0 ? 7.4 : 5.6));
                    g.lineTo(zx + 2.9, cy2 + 0.6);
                    g.closePath();
                }, { x: zx - 3, y: cy2 - 8, w: 6, h: 9 }, MonkeyCfg.crown, { lineWidth: lw * 0.8, glossy: true });
            }
            Art.box(ctx, hx - 7.2, cy2 - 0.2, 14.4, 3.4, 1.5, MonkeyCfg.crown, { lineWidth: lw * 0.8 });
            Art.body(ctx, hx, cy2 + 1.5, 1.4, 1.4, MonkeyCfg.crownGem, { highlight: false, lineWidth: lw * 0.7 });
            for (const s of [-1, 1]) {
                Art.body(ctx, hx + s * 4.8, cy2 + 1.5, 0.95, 0.95, MonkeyCfg.crownGem2,
                    { highlight: false, lineWidth: lw * 0.6 });
            }
        }
        return { hx, hy };
    },
};

// ══════════════════════════════════════════
// ── Fliegende Kokosnuss ──
// ══════════════════════════════════════════

// Eigener Flugeigner (owner 'lobber' wie in js/pumpkin.js): die Engine prüft für ihn keine Treffer,
// deshalb wirft der Affe auch Juri und das Krokodil um, ohne sie zu betäuben. Getroffen wird erst
// beim Aufschlag (Platsch im Umkreis). straight = senkrecht von oben (Boss-Angriffe).
class MonkeyCoconut extends Projectile {
    constructor(sx, sy, tx, ty, flight, r, dmg, big, straight) {
        super(sx, sy, 0, 0, dmg, 'lobber', 140);
        this.sx = sx;
        this.sy = sy;
        this.tx = tx;
        this.ty = ty;
        this.flight = flight;
        this.zone = r;
        this.big = !!big;
        this.straight = !!straight;
        this.monkeyWorld = true;
        this.radius = this.big ? 9 : 7;
        this.lifetime = flight + 0.2;
        const span = Math.hypot(tx - sx, ty - sy);
        this.height = straight ? 0 : 30 + span * 0.16;
        this.lift = 0;
        this.spin = randRange(-8, 8);
    }

    update(dt) {
        this.age += dt;
        this.lifetime -= dt;
        const k = clamp(this.age / this.flight, 0, 1);
        this.x = lerp(this.sx, this.tx, k);
        this.y = lerp(this.sy, this.ty, k);
        this.lift = this.straight ? 0 : Math.sin(Math.PI * k) * this.height;
        if (k >= 1) {
            this._burst();
            this.dead = true;
        } else if (this.lifetime <= 0) {
            this.dead = true;
        }
    }

    // Aufschlag: platscht, trifft Mark und die Freunde im Umkreis
    _burst() {
        MonkeyKit.splash(this.tx, this.ty, this.zone, this.damage);
        MonkeyKit.burst(this.tx, this.ty, [MonkeyCfg.cocoMid, MonkeyCfg.cocoDark, '#f4e2bd', '#ffffff'],
            this.big ? 14 : 9, this.big ? 185 : 135, 0.5, { gravity: 300, size: this.big ? 4 : 3.1 });
        MonkeyKit.ring(this.tx, this.ty + 3, '#f4e2bd', this.zone, 0.26, this.big ? 5 : 3.6);
        MonkeyKit.shake(this.big ? 4.4 : 1.9, this.big ? 0.18 : 0.09);
        if (typeof Sound !== 'undefined' && Sound.explosion) Sound.explosion();
    }

    draw(ctx, camera) {
        const g = camera.worldToScreen(this.x, this.y);
        const foot = camera.worldToScreen(this.tx, this.ty);
        const k = clamp(this.age / this.flight, 0, 1);
        // Schatten am Boden: vorher da, wächst mit der fallenden Nuss (Leanders Regel)
        const sr = this.radius * (0.7 + k * 1.5);
        const a0 = ctx.globalAlpha;
        ctx.fillStyle = 'rgba(28,18,6,0.34)';
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y, sr, sr * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a0 * clamp(this.lifetime / 0.18, 0, 1);
        const y = g.y - this.lift;
        Art.glow(ctx, g.x, y, this.radius * 2, MonkeyCfg.cocoMid, 0.25);
        MonkeyKit.coconut(ctx, g.x, y, this.radius, this.age * this.spin, 1.2);
        ctx.globalAlpha = a0;
    }
}

// ══════════════════════════════════════════
// ── Normaler Affe ──
// ══════════════════════════════════════════

// Affe mit braunem Fell (Schlüsselträger golden). Hält 90–175 Einheiten Abstand und wirft Salven aus
//   Kokosnüssen auf Mark oder den nächstbesten Freund. Gefährlich sind nur die Nüsse.
class Monkey extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 28);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(48, 58);
        this.damage = 1;
        this.contactDamage = false;         // nur die Kokosnüsse tun weh
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 250;
        this.fxColor = MonkeyCfg.furMid;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2.1);
        this.step = 0;
        this.moving = false;
        this.gold = false;                  // goldenes Fell (Schlüsselträger)
        this.volley = 0;                    // noch fehlende Würfe dieser Salve
        this.aim = null;                    // {x, y} anvisierter Landepunkt
        this.plates = [];                   // Warnteller am Boden {x, y, r, t, dur}
        this.lastTarget = null;
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.gold ? C_MONKEY_GOLD : C_MONKEY_BROWN; }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): goldenes Fell, etwas zäher
            this._keyInit = true;
            this.gold = true;
            this.hp = this.maxHp = 10;
        }
        for (const q of this.plates) q.t -= dt;
        this.plates = this.plates.filter(q => q.t > 0);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'wind' && this.state !== 'throw') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('screech', 0.7);      // Drohgebärde, damit Kinder ihn erst einmal sehen
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'screech':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'wind':
                if (this.stateT <= 0) this._throw(world);
                break;
            case 'throw':
                if (this.stateT <= 0) {
                    if (this.volley > 0) this._startWind(world, player, MONKEY_STEP * 1.3);
                    else {
                        this.cool = this.gold ? randRange(0.9, 1.4) : randRange(1.2, 1.8);
                        this._set('walk', 0);
                    }
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, dann Salve anfangen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.2;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.25 * dt,
                Math.cos(this.step * 0.7) * this.speed * 0.25 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 175) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 92) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 6.2;
        } else this.step += dt * 1.8;
        if (this.cool > 0 || dist > 300) return;
        this.volley = this.gold ? 5 : 4;    // "ganz viele Kokosnüsse" (Leander)
        this._startWind(world, player, this.gold ? MONKEY_WINDUP * 0.8 : MONKEY_WINDUP);
    }

    // Ziel aussuchen und die Kokosnuss über den Kopf heben
    _startWind(world, player, dur) {
        const t = MonkeyKit.pickTarget(this, player, this.lastTarget);
        if (!t) {
            this.volley = 0;
            this.cool = 0.6;
            this._set('walk', 0);
            return;
        }
        this.lastTarget = t.ref;
        const room = MonkeyKit.room();
        let x = t.x + randRange(-9, 9), y = t.y + randRange(-7, 7);
        if (room) {
            x = clamp(x, room.x + 14, room.x + room.w - 14);
            y = clamp(y, room.y + 14, room.y + room.h - 14);
        }
        this.aim = { x, y };
        if (Math.abs(x - this.centerX()) > 4) this.face = x > this.centerX() ? 1 : -1;
        this._set('wind', dur);
    }

    // Loslassen: die Nuss fliegt im Bogen, der Warnteller bleibt bis zur Landung sichtbar.
    //Leistungsdeckel erreicht: kein Warnteller ohne Nuss, die Salve bricht sauber ab.
    _throw(world) {
        const a = this.aim || { x: this.centerX(), y: this.centerY() };
        const sx = this.centerX() + this.face * 3, sy = this.y + this.h - 34;
        const flight = clamp(MONKEY_FLIGHT * 0.8 + Math.hypot(a.x - sx, a.y - sy) / 460, 0.5, MONKEY_FLIGHT * 1.5);
        const c = MonkeyKit.lob(a.x, a.y, flight, MONKEY_LOB_R, MONKEY_LOB_DMG, false, false, { sx, sy });
        if (c) this.plates.push({ x: a.x, y: a.y, r: MONKEY_LOB_R, t: flight, dur: flight });
        else this.volley = 0;
        this.volley--;
        this._set('throw', 0.16);
    }

    // Ansagen am Boden: Warnteller der fliegenden Nüsse und Zielkreis des Ausholens
    drawUnder(ctx, camera) {
        if (this.dead) return;
        if (this.state === 'wind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, MONKEY_LOB_R, this._k(), MonkeyCfg.warn);
        }
        for (const q of this.plates) {
            const p = camera.worldToScreen(q.x, q.y);
            LateWorldArt.warn(ctx, p.x, p.y, q.r, clamp((1 - q.t / q.dur) * 1.15, 0, 1), MonkeyCfg.warn);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 13)) {
                ctx.translate(cx, foot);
                this._body(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 14 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Affe mit Fußpunkt (0, 0); Figur steht in MonkeyKit.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const f = this.face;
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const screech = st === 'screech' ? Math.sin(t * 15) : 0;
        const wind = st === 'wind' ? k : 0;
        const throwing = st === 'throw';
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 2.6) * 0.7)
            - (throwing ? 1 : 0) + wind * 1.2;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.04 : Math.sin(t * 2.6) * 0.018);
        const hip = -8 - bob;
        // Hände: am Boden (Knöchelgang), beim Drohen vorn, beim Ausholen über dem Kopf, beim Wurf vorn oben
        let hb = { x: -10, y: -2.4 - Math.max(0, -walk) * 2.2 };
        let hf = { x: 10, y: -2.4 - Math.max(0, walk) * 2.2 };
        let carry = 0;
        if (st === 'screech') { hb = { x: -6, y: hip - 20 + screech * 2 }; hf = { x: 7, y: hip - 20 - screech * 2 }; }
        else if (wind) { hb = { x: -4.6, y: hip - 29 - wind * 3 }; hf = { x: 6.2, y: hip - 29 - wind * 3 }; carry = 1; }
        else if (throwing) { hb = { x: -7, y: hip - 22 }; hf = { x: 15, y: hip - 27 }; }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(f, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, hip - 12, 24, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (throwing || wind || st === 'screech') ? 'open' : tired ? 'tired' : 'angry';
        MonkeyKit.figure(ctx, { c, lw: 1.2, t, bob, walk, hands: { b: hb, f: hf }, carry, mood,
            look: { x: this.look.x * f, y: this.look.y } });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESENAFFE MIT KRONE (Endgegner Welt 57) ──
// ══════════════════════════════════════════

class BossGiantMonkey extends Enemy {
    constructor(x, y) {
        super(x, y, 96, 88);
        this.hp = 148;
        this.maxHp = 148;
        this.speed = 32;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;         // gefährlich sind die Kokosnüsse
        this.phasesThroughWalls = false;
        this.shadow = { rx: 42, ry: 13, dy: 42, alpha: 0.32 };
        this.fxColor = MonkeyCfg.crown;
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
        this.moving = false;
        this.plates = [];                   // Warnkreise des laufenden Angriffs
        this.hailLeft = 0;
        this.hailClock = 0;
        this.bigHits = 0;
        this.angry = 0;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this._world = world;
        this._player = player;
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 46;
            this.bigHits = 0;
            MonkeyKit.burst(mx, my - 18, [MonkeyCfg.crown, '#ffffff', MonkeyCfg.fur], 22, 200, 0.7, { kind: 'star' });
            MonkeyKit.ring(mx, my, MonkeyCfg.crown, 106, 0.6, 6);
            MonkeyKit.shake(8, 0.45);
        }
        if (this.state !== 'intro' && this.state !== 'boomWind' && this.state !== 'hailWind') {
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
            case 'boomWind':
                if (this.stateT <= 0) this._dropBoom();
                break;
            case 'boomFall':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'hailWind':
                if (this.stateT <= 0) {
                    this.hailClock = 0;
                    this._set('hail', (this.hailLeft / 3) * MONK_HAIL_GAP + MONK_HAIL_FLIGHT + 0.15);
                }
                break;
            case 'hail': this._hail(dt); break;
            case 'dizzy':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        MonkeyKit.clampToRoom(this);
    }

    // ── Bewegung in der Lichtung, dann nächster Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 4.4;
        let vx = 0, vy = 0;
        if (dist > 124) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 66) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool <= 0) this._nextAttack(world, player);
    }

    _nextAttack(world, player) {
        const cyc = this.phase === 2 ? BossGiantMonkey.CYCLE2 : BossGiantMonkey.CYCLE1;
        const what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'boom') this._startBoom(world, player);
        else if (what === 'hail') this._startHail();
        else this.cool = this.phase === 2 ? 0.45 : 0.85;     // bewusste Verschnaufpause
    }

    // ── a) Ganz viele Kokosnuss-Explosionen: erst Warnkreise, dann platzt es ──
    _startBoom(world, player) {
        const n = this.phase === 2 ? 8 : 5;
        const pts = [];
        for (const q of MonkeyKit.targets(player)) {
            pts.push({ x: q.x + randRange(-6, 6), y: q.y + randRange(-5, 5) });
            if (pts.length >= n) break;
        }
        while (pts.length < n) {
            const s = MonkeyKit.spotNear(this, world, 46, 165);
            pts.push(s);
        }
        this.plates = pts.map(p => ({ x: p.x, y: p.y, r: MONK_BOOM_R }));
        this._set('boomWind', this.phase === 2 ? MONK_BOOM_WIND * 0.82 : MONK_BOOM_WIND);
    }

    // Die Nüsse fallen senkrecht in die markierten Kreise
    _dropBoom() {
        for (const q of this.plates) {
            MonkeyKit.lob(q.x, q.y, MONK_BOOM_FALL, MONK_BOOM_R, MONK_BOOM_DMG, true, true);
        }
        this.plates = [];
        MonkeyKit.shake(3, 0.14);
        this._set('boomFall', MONK_BOOM_FALL + 0.3);
    }

    // ── b) Riesiger Kokosnuss-Hagel: viele Nüsse fallen vom Himmel ──
    _startHail() {
        this.hailLeft = this.phase === 2 ? 18 : 12;
        this._set('hailWind', MONK_HAIL_WIND);
    }

    _hail(dt) {
        if (this.hailLeft > 0) {
            this.hailClock -= dt;
            if (this.hailClock <= 0) {
                this.hailClock = MONK_HAIL_GAP;
                const world = this._world, player = this._player;
                for (let i = 0; i < 3 && this.hailLeft > 0; i++, this.hailLeft--) {
                    let s;
                    const q = Math.random() < 0.6 ? MonkeyKit.pickTarget(this, player, null) : null;
                    if (q) s = { x: q.x + randRange(-26, 26), y: q.y + randRange(-22, 22) };
                    else s = MonkeyKit.spotNear(this, world, 40, 190);
                    const room = MonkeyKit.room();
                    if (room) {
                        s.x = clamp(s.x, room.x + 16, room.x + room.w - 16);
                        s.y = clamp(s.y, room.y + 16, room.y + room.h - 16);
                    }
                    MonkeyKit.lob(s.x, s.y, MONK_HAIL_FLIGHT, MONK_HAIL_R, MONK_HAIL_DMG, false, true);
                }
            }
        }
        if (this.stateT <= 0) this._afterBig();
    }

    // Nach großen Angriffen: Verschnaufpause – und bei wenig Leben wird er schwindelig.
    _afterBig() {
        this.bigHits++;
        if (this.hp <= this.maxHp * 0.4) {
            this._set('dizzy', 2.2);
            MonkeyKit.burst(this.centerX(), this.y + 20, ['#ffe35a', '#ffffff'], 12, 100, 0.55, { kind: 'star' });
            return;
        }
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', 1.5);
            MonkeyKit.burst(this.centerX(), this.y + 20, ['#ffe35a', '#ffffff'], 9, 90, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.5 : 0.85;
        this._set('pant', this.cool + 0.35);
    }

    // Ansage: Warnkreise der Explosionen (unter allen Figuren, bevor die Nüsse fliegen)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st === 'boomWind') {
            const room = MonkeyKit.room();
            ctx.save();
            if (room) {
                const a = camera.worldToScreen(room.x, room.y);
                ctx.beginPath();
                ctx.rect(a.x, a.y, room.w, room.h);
                ctx.clip();
            }
            const k = this._k();
            for (const q of this.plates) {
                const p = camera.worldToScreen(q.x, q.y);
                LateWorldArt.warn(ctx, p.x, p.y, q.r, k, MonkeyCfg.warn);
            }
            ctx.restore();
            return;
        }
        if (st === 'hailWind') {
            const c = camera.worldToScreen(this.centerX(), this.y + this.h - 30);
            Art.glow(ctx, c.x, c.y - 34, 62 + 18 * this._k(), MonkeyCfg.crown, 0.2 + 0.24 * this._k());
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

    // Riesenaffe: dieselbe Figur wie die normalen Affen, 2,5-mal so groß, mit goldener Krone;
    // Phase 2 mit roten Augen und gelbem Zornleuchten, danach Schwindel mit kreisenden Sternen.
    _body(ctx, dead) {
        const S = 2.5;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const c = C_MONKEY_BROWN;
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const intro = st === 'intro';
        const boomWind = st === 'boomWind';
        const hailWind = st === 'hailWind';
        const falling = st === 'boomFall' || st === 'hail';
        const beat = intro || hailWind ? Math.sin(t * 14) : 0;
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 1.9) * 1)
            - (rest ? 1.6 : 0) + (boomWind ? k * 2 : 0) - (dizzy ? 0 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.035 : Math.sin(t * 1.9) * 0.015);
        const hip = -8 - bob;
        const sway = dizzy ? Math.sin(t * 5) * 2 : 0;
        // Hände (Einheiten der kleinen Figur)
        let hb = { x: -11, y: -2.4 - Math.max(0, -walk) * 2.2 };
        let hf = { x: 11, y: -2.4 - Math.max(0, walk) * 2.2 };
        let carry = 0;
        if (intro || hailWind) { hb = { x: -6, y: hip - 21 + beat * 2.6 }; hf = { x: 7, y: hip - 21 - beat * 2.6 }; }
        else if (boomWind) { hb = { x: -6.5, y: hip - 30 - k * 5 }; hf = { x: 7.5, y: hip - 30 - k * 5 }; carry = 1; }
        else if (falling) { hb = { x: -14, y: hip - 24 }; hf = { x: 16, y: hip - 24 }; }
        else if (dizzy) { hb = { x: -11 + sway, y: -3 }; hf = { x: 12 + sway, y: -3 }; }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, hip - 16, 30, MonkeyCfg.crown, 0.18 * this.angry + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (boomWind || hailWind || intro || falling) ? 'open' : rest ? 'tired' : 'angry';
        const h = MonkeyKit.figure(ctx, { c, lw: 0.8, t, bob, walk, hands: { b: hb, f: hf }, carry, mood,
            look: { x: this.look.x * this.face, y: this.look.y }, crown: true,
            headDy: dizzy ? 1.6 : 0, red: p2 });
        if (p2 && !dead && !dizzy) Art.glow(ctx, h.hx, h.hy - 0.5, 8.5, '#ff3b5c', 0.3 + 0.2 * Math.sin(t * 9));
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 1.7 * S * this.face, (hip - 40) * S, 24, 4.6);
        // Krone blinkt in Phase 2
        if (!dead && p2 && !dizzy) {
            Art.sparkle(ctx, (h.hx + 5.2) * S * this.face, (h.hy - 13) * S, 3 + Math.sin(t * 7) * 1.2, '#fff6a8', 0.8);
        }
    }
}

BossGiantMonkey.CYCLE1 = ['boom', 'walk', 'hail', 'walk'];
BossGiantMonkey.CYCLE2 = ['boom', 'hail', 'boom', 'walk'];
