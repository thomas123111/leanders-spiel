// ── Welt 53: Skorpionwüste (letzte Welt, Idee von Leander) ──
// Rote Skorpione: sie richten sich auf, heben den Schwanz und STECHEN mit dem Schwanzstachel.
//   Der Stich vergiftet – Mark und die Freunde verlieren eine Weile langsam Leben (poison aus dem
//   Gerüst, kein Tempo-Abzug). Der Schlüsselträger ist ORANGE, etwas flinker und giftiger.
//   Der Stich wird angesagt: erst zieht sich am Ziel ein roter Kreis zusammen, dann schlägt der
//   Stachel dort ein (Ansage = Treffer).
// Boss: RIESENSKORPION mit DREI Stacheln – Endgegner von Welt 53, bleibt im Boss-Raum (Felskessel),
//   145 LP, zwei Phasen.
//   Zwicken: die großen Krallen schnappen über dem Ziel zusammen – Schaden, kein Gift.
//   Giftsalve: aus den Stacheln sprüht eine Garbe Gifttropfen; jede Flugbahn ist als Bahn angesagt,
//   ehe sie fliegt. Getroffene werden vergiftet.
//   Dreifach-Stich: die drei Stacheln fahren nacheinander auf drei angesagte Kreise herab
//   (Mark und die Freunde), jeder Stich zieht Leben und vergiftet.
//   Phase 2 (halbe LP): schneller, die Salve wird größer und kommt zweimal. Bei wenig Leben wird er
//   nach großen Angriffen schwindelig (Sterne, kurz wehrlos) – Marks Zeit zum Zurückhauen.
// Nur die Wirkungen, die Leander genannt hat: Schaden und Gift. Kein Schlaf, kein Schleim.
// Freunde verschwinden nie: ein tödlicher Treffer haut Juri und das Krokodil nur um (knockOut).

const ScorpionCfg = {
    shell: '#d4382c',           // roter Panzer (hellster Ton, damit er auf dem hellen Sand zu sehen ist)
    shellMid: '#b72a22',
    shellDark: '#8e1d18',
    belly: '#e8794f',           // helle Unterseite / Plattenränder
    seg: '#c22f26',             // Schwanzsegmente
    segMid: '#a5251e',
    leg: '#a8271f',
    legDark: '#7d1a14',
    keyShell: '#ff8a1e',        // Schluesseltraeger: ORANGE
    keyMid: '#e06f10',
    keyDark: '#b0530a',
    keyBelly: '#ffc078',
    keySeg: '#f57e14',
    keySegMid: '#d2660a',
    keyLeg: '#d96c10',
    keyLegDark: '#a44c06',
    venom: '#8ede3a',           // Gift im Stachel und in den Tropfen
    venomDark: '#4f9a18',
    venomLight: '#d2ff9a',
    eye: '#ffe9b0',
    iris: '#7a1408',
    dust: '#e8cd9a',            // Sand unter den Krallen
    warn: '#ff5a3d',
    warnPoison: '#ff8c1e',
};

// Zwei Panzerpaletten: rot (alle) und orange (Schlüsselträger)
const C_SCORP_RED = {
    shell: ScorpionCfg.shell, shellMid: ScorpionCfg.shellMid, shellDark: ScorpionCfg.shellDark,
    belly: ScorpionCfg.belly, seg: ScorpionCfg.seg, segMid: ScorpionCfg.segMid,
    leg: ScorpionCfg.leg, legDark: ScorpionCfg.legDark,
};
const C_SCORP_KEY = {
    shell: ScorpionCfg.keyShell, shellMid: ScorpionCfg.keyMid, shellDark: ScorpionCfg.keyDark,
    belly: ScorpionCfg.keyBelly, seg: ScorpionCfg.keySeg, segMid: ScorpionCfg.keySegMid,
    leg: ScorpionCfg.keyLeg, legDark: ScorpionCfg.keyLegDark,
};

// Höchstens so viele Gifttropfen gleichzeitig unterwegs (wie die Schneebälle in Welt 50)
const POISON_CAP = 46;

const ScorpionArt = {
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
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [ScorpionCfg.shellDark, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
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

    // Freier Punkt in der Welt (für Stichziele)?
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

    // Nächster Ziel-Punkt (Mark oder ein Freund)
    nearTarget(player, x, y, maxD) {
        let best = null;
        for (const t of this.targets(player)) {
            const d = Math.hypot(t.x - x, t.y - y);
            if (d > maxD) continue;
            if (!best || d < best.d) best = { t, d };
        }
        return best;
    },

    // Flächenschaden: trifft Mark und die Freunde innerhalb von R, jeder höchstens einmal (hit-Liste).
    // gift = Sekunden Gift für jeden Getroffenen (0 = nur Schaden, wie beim Krallenzwicken).
    areaHit(x, y, R, amount, force, hit, gift) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        let getroffen = 0;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (hit) hit.push(t.ref);
            getroffen++;
            if (t.isPlayer) {
                this.hurt(t.ref, amount, Math.atan2(t.y - y, t.x - x), force);
                if (gift && typeof t.ref.poison === 'function') t.ref.poison(gift);
            } else {
                if (gift && typeof t.ref.poison === 'function') t.ref.poison(gift);
                this.hitCompanion(t.ref, amount);
            }
        }
        return getroffen;
    },

    // Grünstich nach einem Stich: Luftbläschen und ein Gift-Ring am Einschlagpunkt
    venomFx(x, y, R) {
        this.burst(x, y, [ScorpionCfg.venom, ScorpionCfg.venomLight, '#ffffff'], 9, 120, 0.4, { kind: 'spark' });
        this.burst(x, y, 'rgba(150,225,90,0.75)', 4, 55, 0.55, { kind: 'bubble', size: 4 });
        this.ring(x, y, ScorpionCfg.venom, R, 0.26, 3.2);
    },

    // Sandwolke unter den Krallen
    dustFx(x, y) {
        this.burst(x, y, [ScorpionCfg.dust, '#f8e4b8', '#ffffff'], 7, 110, 0.36, { kind: 'smoke', size: 4 });
    },

    // ── Ganze Figur: von vorn, klar erkennbar ──
    // Acht Beine (drei je Seite sichtbar), zwei große Klemmscheren vorn, Kopf mit zwei Augen
    // und zwei Punkt-Augen, und der Schwanz, der sich über den Rücken nach vorn über den Kopf legt –
    // mit dem Stachel nach unten. p = { c, lw, t, bob, walk, claw: {b:{x,y,a,open}, f:{...}},
    //   legs: [{lift} je Paar], tails: [{lean, lift, strike, seed}], mood, look, ridges, scar, red }
    figure(ctx, p) {
        const c = p.c, lw = p.lw, t = p.t;
        const body = -12 - p.bob;                 // Körpermitte (Fußpunkt der Figur ist 0,0)
        const tails = p.tails || [{ lean: 0, lift: 0, strike: 0, seed: 0 }];

        // ── Beine (je Seite drei, von hinten nach vorn) ──
        for (const s of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                const lift = (p.legs && p.legs[i]) || 0;
                const bx = s * (2.2 + i * 1.5), by = body + 2.6 - i * 1.5;
                const kx = s * (9.5 + i * 2.6), ky = by - 4.2 + i * 0.9;
                const fx = s * (11.5 + i * 4.2), fy = -0.4 - lift;
                Art.limb(ctx, bx, by, kx, ky, 2.5, c.leg, { lineWidth: lw });
                Art.limb(ctx, kx, ky, fx, fy, 2.1, c.leg, { lineWidth: lw });
                Art.body(ctx, fx + s * 0.7, fy - 0.5, 1.9, 1.05, c.legDark, { highlight: false, lineWidth: lw * 0.7 });
            }
        }

        // ── Schwänze (hinter dem Körper, einer bei den kleinen Skorpionen, drei beim Boss) ──
        for (const o of tails) this._tail(ctx, c, p, o, body);

        // ── Hinterleib (liegt hinter/mittig, der Schwanz setzt daran an) ──
        Art.body(ctx, 0, body - 7.6, 8.2, 6.2, c.shellMid, { glossy: true, lineWidth: lw });
        if (p.ridges) {
            ctx.strokeStyle = Art.dark(c.shellMid, 0.35);
            ctx.lineWidth = lw * 0.8;
            for (let i = 0; i < 3; i++) {
                const yy = body - 10.4 + i * 2.4;
                ctx.beginPath();
                ctx.moveTo(-6 + i * 1.2, yy);
                ctx.quadraticCurveTo(0, yy + 1.5, 6 - i * 1.2, yy);
                ctx.stroke();
            }
        }

        // ── Vorderkörper (breiter Panzer, leicht nach vorn geneigt) ──
        Art.shape(ctx, g => {
            g.moveTo(-11.6, body - 1.6);
            g.bezierCurveTo(-12.6, body + 4.6, -7.6, body + 9.6, 0, body + 10.2);
            g.bezierCurveTo(7.6, body + 9.6, 12.6, body + 4.6, 11.6, body - 1.6);
            g.bezierCurveTo(9.6, body - 7.4, -9.6, body - 7.4, -11.6, body - 1.6);
            g.closePath();
        }, { x: -12.6, y: body - 7.4, w: 25.2, h: 17.6 }, c.shell, { glossy: true, lineWidth: lw });
        // Panzerplatten (drei Bogenrippen) und helle Saumlinie
        ctx.strokeStyle = Art.dark(c.shell, 0.34);
        ctx.lineWidth = lw * 0.85;
        for (let i = 0; i < 3; i++) {
            const yy = body - 2.2 + i * 3.1;
            ctx.beginPath();
            ctx.moveTo(-9.2 + i * 1.6, yy);
            ctx.quadraticCurveTo(0, yy + 2.1, 9.2 - i * 1.6, yy);
            ctx.stroke();
        }
        ctx.strokeStyle = Art.alpha(c.belly, 0.6);
        ctx.lineWidth = lw * 0.9;
        ctx.beginPath();
        ctx.moveTo(-8.6, body + 7.4);
        ctx.quadraticCurveTo(0, body + 10.2, 8.6, body + 7.4);
        ctx.stroke();
        if (p.scar) {
            ctx.strokeStyle = '#f2c9a8';
            ctx.lineWidth = lw * 0.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-6.8, body - 3.4); ctx.lineTo(-2.4, body + 2.6);
            ctx.moveTo(-6.2, body + 0.6); ctx.lineTo(-4.4, body - 0.4);
            ctx.stroke();
        }

        // ── Gesicht: zwei große Augen, zwei Punkt-Augen, kleine Kieferklauen ──
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        const ey = body + 3.4;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, 0, ey, 1.8, 3.2);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.85;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.2 + i * 0.1;
                    const x = s * 3.2 + Math.cos(a) * r, y = ey + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, s * 3.2, ey, 2.05, { x: look.x, y: look.y }, {
                    angry: mood !== 'tired', side: s < 0 ? 'left' : 'right',
                    iris: p.red ? '#ff3b3b' : ScorpionCfg.iris, sclera: ScorpionCfg.eye,
                    open: mood === 'tired' ? 0.5 : 1,
                });
            }
        }
        ctx.fillStyle = Art.dark(c.shellDark, 0.3);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 6.6, ey - 3.1, 0.85, 0, TAU); ctx.fill(); }
        Art.mouth(ctx, 0, body + 8.4, 3.6, mood === 'open' ? 'teeth' : (mood === 'dizzy' || mood === 'tired') ? 'o' : 'angry',
            { color: ScorpionCfg.shellDark });
        for (const s of [-1, 1]) {
            Art.limb(ctx, s * 2.2, body + 9.6, s * 4.4, body + 11.6 + (mood === 'open' ? 1 : 0), 1.5, c.legDark, { lineWidth: lw * 0.7 });
        }

        // ── Scheren (Klemmzangen): hintere und vordere, je mit zwei offenen Backen ──
        const claw = (s, h, col) => {
            const sx = s * 8.4, sy = body - 1.4;
            const mx = (sx + h.x) / 2 + s * 2.6, my = (sy + h.y) / 2 - 1.6;
            Art.limb(ctx, sx, sy, mx, my, 3.6, col, { lineWidth: lw });
            Art.limb(ctx, mx, my, h.x, h.y, 3.1, col, { lineWidth: lw });
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.rotate(h.a || 0);
            const o = h.open || 0;
            for (const d of [-1, 1]) {
                ctx.save();
                ctx.rotate(d * (0.2 + o * 0.46));
                Art.shape(ctx, g => {
                    g.moveTo(0, -1.6);
                    g.quadraticCurveTo(4.6, -2.4, 7.6, -0.2);
                    g.quadraticCurveTo(4.4, 1.5, 0, 1.6);
                    g.closePath();
                }, { x: 0, y: -2.4, w: 7.6, h: 4 }, col, { glossy: true, lineWidth: lw });
                ctx.restore();
            }
            Art.body(ctx, 0.2, 0, 2.5, 2.3, col, { lineWidth: lw });
            ctx.restore();
        };
        const hb = p.claw ? p.claw.b : { x: -16, y: body + 2, a: Math.PI + 0.2, open: 0.3 };
        const hf = p.claw ? p.claw.f : { x: 16, y: body + 2, a: -0.2, open: 0.3 };
        claw(-1, hb, c.shellMid);
        if (p.clawGlow) Art.glow(ctx, hf.x, hf.y, 16, p.clawGlow, 0.5);
        claw(1, hf, c.shell);

        return { body, ey };
    },

    // Ein Schwanz: Segment für Segment auf einer Bogenkurve, oben der Stachel (Knolle + Spitze).
    // o = { lean (seitliche Neigung), lift (0..1 Ausholen), strike (0..1 Stich), size, seed }
    _tail(ctx, c, p, o, body) {
        const lw = p.lw, size = o.size || 1;
        const sway = Math.sin(p.t * 1.9 + (o.seed || 0)) * (1.2 + size);
        const lift = o.lift || 0, strike = o.strike || 0;
        const bx = -2.4 + (o.lean || 0) * 5.2, by = body - 11.4;
        // Ausholen: der Bogen wird höher und steiler; Stich: die Spitze peitscht nach vorn unten.
        const ctrlX = bx - 7.4 - lift * 2.2 + (o.lean || 0) * 2.2;
        const ctrlY = by - 17 - lift * 7 + strike * 13;
        const tipX = bx + 7.4 + lift * 4.6 - strike * 12.6 + sway * 0.4;
        const tipY = by - 12.6 + lift * 1.6 + strike * 20;
        const N = 5;
        let px = bx, py = by, ang = 0;
        for (let i = 1; i <= N; i++) {
            const u = i / (N + 1);
            const x = qp(bx, ctrlX, tipX, u), y = qp(by, ctrlY, tipY, u);
            const r = (3.5 - i * 0.42) * size;
            Art.body(ctx, x, y, r, r * 0.88, i % 2 ? c.seg : c.segMid, { lineWidth: lw, glossy: i < 3 });
            ang = Math.atan2(y - py, x - px);
            px = x; py = y;
        }
        // Stachel: Giftknolle und kurze, scharfe Spitze
        const tx = qp(bx, ctrlX, tipX, 1), ty = qp(by, ctrlY, tipY, 1);
        const a2 = Math.atan2(ty - py, tx - px);
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(a2);
        const bs = 3.4 * size;
        Art.body(ctx, bs * 0.15, bs * 0.1, bs * 0.92, bs * 0.78, ScorpionCfg.venom, { glossy: true, lineWidth: lw });
        Art.shape(ctx, g => {
            g.moveTo(bs * 0.5, -bs * 0.42);
            g.quadraticCurveTo(bs * 1.5, -bs * 0.1, bs * 2.1, bs * 0.12);
            g.quadraticCurveTo(bs * 1.3, bs * 0.42, bs * 0.5, bs * 0.5);
            g.closePath();
        }, { x: bs * 0.5, y: -bs * 0.5, w: bs * 1.6, h: bs }, ScorpionCfg.venomDark, { lineWidth: lw });
        ctx.restore();
        const glow = 0.24 + 0.3 * strike + (p.venomGlow || 0);
        if (glow > 0.25) Art.glow(ctx, tx + Math.cos(a2) * bs, ty + Math.sin(a2) * bs, 9 * size, ScorpionCfg.venom, glow);
        return { tx, ty, a2 };
    },

    // ── Kleine Zange für die Geschoß-Zeichnung (ohne Figuren-Zusammenhang) ──
    drop(ctx, x, y, r, t, seed) {
        Art.glow(ctx, x, y, r * 2.6, ScorpionCfg.venom, 0.6);
        Art.body(ctx, x, y, r, r * 0.88, ScorpionCfg.venom, { glossy: true, lineWidth: 1.3 });
        Art.body(ctx, x - r * 0.15, y - r * 0.2, r * 0.42, r * 0.34, ScorpionCfg.venomLight, { highlight: false, outline: false });
        // zwei kleine Stachel-Splitter hinter dem Tropfen
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((t * 5 + seed) % TAU);
        for (const s of [-1, 1]) {
            Art.shape(ctx, g => {
                g.moveTo(-r * 0.7, s * r * 0.3);
                g.quadraticCurveTo(-r * 1.9, s * r * 0.9, -r * 2.3, s * r * 0.2);
                g.quadraticCurveTo(-r * 1.5, s * r * 0.1, -r * 0.7, -s * r * 0.1);
                g.closePath();
            }, { x: -r * 2.3, y: -r, w: r * 1.6, h: r * 2 }, ScorpionCfg.venomDark, { lineWidth: 1, highlight: false });
        }
        ctx.restore();
    },
};

// Punkt auf einer quadratischen Bezier-Kurve (t = 0..1)
function qp(a, b, c, t) {
    const u = 1 - t;
    return u * u * a + 2 * u * t * b + t * t * c;
}

// ══════════════════════════════════════════
// ── Gifttropfen (Geschoß des Riesenskorpions) ──
// ══════════════════════════════════════════

// Fliegt geradeaus, platzt an der Wand und setzt Gift frei, wenn es Mark, Juri oder das
// Schattenkrokodil trifft. Gift wirkt wie im Gerüst vorgesehen: es zieht langsam Leben ab, macht
// aber nicht langsamer; bei den Freunden bleibt mindestens ein Lebenspunkt (kein K.o. durch Gift).
class PoisonDrop extends Projectile {
    constructor(x, y, angle, speed, poisonSec, damage) {
        const sp = speed || 152;
        super(x, y, Math.cos(angle) * sp, Math.sin(angle) * sp, damage || 1, 'enemy', 90);
        this.radius = 7;
        this.lifetime = 2.7;
        this.poisonSec = poisonSec || 3;
        this.seed = Math.random() * 10;
        this.angle = angle;
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) { this._splat(); return; }
        const player = typeof Game !== 'undefined' ? Game.player : null;
        if (player && !player.dead && !player.dodging) {
            const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
            if (Math.hypot(this.x - cx, this.y - cy) < this.radius + player.w / 2) {
                ScorpionArt.hurt(player, this.damage, Math.atan2(this.vy, this.vx), 105);
                if (typeof player.poison === 'function') player.poison(this.poisonSec);
                this._splat();
                this.dead = true;
                return;
            }
        }
        for (const c of ScorpionArt.companions()) {
            const w = c.w || 20, h = c.h || 20;
            if (Math.hypot(this.x - (c.x + w / 2), this.y - (c.y + h / 2)) >= this.radius + Math.max(w, h) / 2) continue;
            if (typeof c.poison === 'function') c.poison(this.poisonSec);
            ScorpionArt.hitCompanion(c, this.damage);
            this._splat();
            this.dead = true;
            return;
        }
        if (typeof FX !== 'undefined' && Math.random() < dt * 22) {
            FX.burst(this.x, this.y, [ScorpionCfg.venom], 1, 16, 0.45, { kind: 'bubble' });
        }
    }

    _splat() {
        ScorpionArt.burst(this.x, this.y, [ScorpionCfg.venom, ScorpionCfg.venomLight, ScorpionCfg.venomDark], 8, 115, 0.4, { kind: 'spark' });
        ScorpionArt.burst(this.x, this.y, 'rgba(150,225,90,0.7)', 3, 50, 0.5, { kind: 'bubble', size: 4 });
        ScorpionArt.ring(this.x, this.y, ScorpionCfg.venom, 15, 0.22, 2.4);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time + this.seed;
        const wob = Math.sin(t * 9) * 0.9;
        ScorpionArt.drop(ctx, p.x, p.y + wob, this.radius * 0.78, t, this.seed);
    }
}

// ══════════════════════════════════════════
// ── Normaler Skorpion ──
// ══════════════════════════════════════════

// Roter Skorpion (Schlüsselträger orange). Hält 40–120 Einheiten Abstand, richtet sich dann auf und
//   sticht mit dem Schwanzstachel auf eine angesagte Kreisfläche – der Stich vergiftet. Bei wenig
//   Leben grimmiges Gesicht.
class Scorpion extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 26);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(46, 56);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = ScorpionCfg.shell;
        this.seed = Math.random() * 10;
        this.detectionRange = 235;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'idle';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2);
        this.step = 0;
        this.moving = false;
        this.orange = false;             // orange Panzerung (Schlüsselträger)
        this.aim = null;                 // {x, y} Punkt des Stichs
        this.stingHit = [];
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.orange ? C_SCORP_KEY : C_SCORP_RED; }

    // Stichradius – der angesagte Kreis ist genau so groß wie die getroffene Fläche
    _R() { return this.orange ? 32 : 28; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): orange, etwas zäher und giftiger
            this._keyInit = true;
            this.orange = true;
            this.hp = this.maxHp = 10;
            this.speed = randRange(56, 64);
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'stingWind' && this.state !== 'sting') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('threat', 0.62);   // Drohstellung: Schwanz hoch, Scheren auf
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'threat':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'stingWind':
                if (this.stateT <= 0) {
                    this._stingHit();
                    this._set('sting', 0.2);
                }
                break;
            case 'sting':
                if (this.stateT <= 0) {
                    this.cool = this.orange ? randRange(1.1, 1.7) : randRange(1.5, 2.2);
                    this._set('skitter', 0.34);
                }
                break;
            case 'skitter':
                this._skitter(dt, world, dist, dx, dy);
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, dann stechen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.2;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.25 * dt, Math.cos(this.step * 0.7) * this.speed * 0.25 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 96) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 40) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 8.2;
        } else this.step += dt * 1.7;
        if (this.cool > 0 || dist > 132) return;
        const near = ScorpionArt.nearTarget(player, this.centerX(), this.centerY(), 132);
        this.aim = near ? { x: near.t.x, y: near.t.y } : { x: this.centerX() + this.face * 26, y: this.centerY() };
        if (Math.abs(this.aim.x - this.centerX()) > 3) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this.stingHit = [];
        this._set('stingWind', this.orange ? 0.42 : 0.52);
    }

    // Kurzes Seitwärts-Schäkern nach dem Stich (Sand fliegt auf)
    _skitter(dt, world, dist, dx, dy) {
        const side = this.seed > 5 ? 1 : -1;
        const vx = (-dy / dist) * side, vy = (dx / dist) * side;
        Kit915.rush(this, vx * this.speed * 0.8 * dt, vy * this.speed * 0.8 * dt, world);
        this.moving = true;
        this.step += dt * 11;
        if (Math.random() < dt * 8) ScorpionArt.dustFx(this.centerX() - vx * 12, this.y + this.h - 2);
    }

    // Der Stich landet genau dort, wo der rote Kreis stand – er reicht also bis an den Kreis heran.
    _stingHit() {
        const a = this.aim || { x: this.centerX() + this.face * 24, y: this.centerY() };
        const R = this._R();
        ScorpionArt.areaHit(a.x, a.y, R, this.damage, 170, this.stingHit, this.orange ? 4 : 3);
        ScorpionArt.venomFx(a.x, a.y, R);
        ScorpionArt.shake(2.2, 0.1);
    }

    // Ansagen am Boden: der Stich-Kreis (unter allen Figuren, damit nichts verdeckt wird)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if ((st === 'stingWind' || st === 'sting') && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, this._R(), st === 'sting' ? 1 : this._k(), ScorpionCfg.warn);
            if (st === 'stingWind') {
                // der Stachel zielt sichtbar auf den Kreis
                const s = camera.worldToScreen(this.centerX(), this.centerY() - 30);
                LateWorldArt.chevrons(ctx, s.x, s.y, Math.atan2(this.aim.y - (this.centerY() - 30), this.aim.x - this.centerX()), this._k(), ScorpionCfg.venom);
            }
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
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 17 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Skorpion mit Fußpunkt (0, 0); Zeichnung in ScorpionArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const threat = st === 'threat' ? 1 : 0;
        const wind = st === 'stingWind' ? k : 0;
        const sting = st === 'sting' ? 1 : 0;
        const skit = st === 'skitter';
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        // Aufgerichteter Körper beim Ausholen, tiefer Schwung beim Stich
        const rise = wind * 3.2 + threat * 1.6 - sting * 2.2;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 0.9 : Math.sin(t * 2.2) * 0.5) + rise;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 2.2) * 0.015) + wind * 0.02;
        // Beine: abwechselnd gehoben (drei Paare)
        const legs = [
            Math.max(0, Math.sin(this.step * 2)) * 2.2,
            Math.max(0, Math.sin(this.step * 2 + 2.1)) * 2.2,
            Math.max(0, Math.sin(this.step * 2 + 4.2)) * 2.2,
        ];
        // Scheren: vorn ruhig tief, beim Drohen und Ausholen hoch und auf, beim Stich zusammen
        const openBase = 0.35 + threat * 0.3 + wind * 0.5;
        let hb = { x: -14, y: -10 + Math.max(0, -walk) * 2, a: Math.PI + 0.25, open: openBase };
        let hf = { x: 14, y: -10 - Math.max(0, walk) * 2, a: -0.25, open: openBase };
        if (wind || threat) { hb = { x: -11, y: -18 - wind * 4, a: Math.PI - 0.5, open: openBase }; hf = { x: 11, y: -18 - wind * 4, a: 0.5, open: openBase }; }
        if (sting) { hb = { x: -13, y: -12, a: Math.PI + 0.1, open: 0.05 }; hf = { x: 13, y: -12, a: 0.1, open: 0.05 }; }
        if (skit) { hb = { x: -15, y: -6, a: Math.PI + 0.5, open: 0.5 }; hf = { x: 15, y: -6, a: -0.5, open: 0.5 }; }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -16, 26, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (wind || sting || threat) ? 'open' : tired ? 'tired' : 'angry';
        ScorpionArt.figure(ctx, {
            c, lw: 1.25, t, bob, walk, legs, mood,
            claw: { b: hb, f: hf }, clawGlow: sting && !dead ? ScorpionCfg.venom : null,
            tails: [{ lean: 0, lift: clamp(wind + threat * 0.5, 0, 1), strike: sting, seed: this.seed }],
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESENSKORPION mit DREI Stacheln (Endgegner Welt 53) ──
// ══════════════════════════════════════════

// Riesiger Skorpion, 145 LP, bleibt im Boss-Raum (Felskessel). Ablauf Phase 1:
//   Drohen → Zwicken mit den Krallen → Giftsalve (angesagte Bahnen) → Dreifach-Stich → Verschnaufpause …
//   Das Zwicken macht Schaden, Gift und Stachel vergiften.
// Phase 2 (halbe LP): schneller, die Salve wird größer und kommt zweimal, die Stiche fahren schneller.
//   Bei wenig Leben wird er nach großen Angriffen schwindelig (Sterne, kurz wehrlos) – Marks Zeit.
class BossGiantScorpion extends Enemy {
    constructor(x, y) {
        super(x, y, 92, 74);
        this.hp = 145;
        this.maxHp = 145;
        this.speed = 33;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;      // Schaden macht nur, was angesagt ist
        this.phasesThroughWalls = false;
        this.shadow = { rx: 42, ry: 13, dy: 35, alpha: 0.32 };
        this.fxColor = ScorpionCfg.shell;
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
        this.angry = 0;
        this.bigHits = 0;
        // Zwicken
        this.clawAim = null;             // {x, y} Kreis über dem die Scheren zuschnappen
        this.clawR = 46;
        this.hitOnce = [];
        // Giftsalve
        this.fanA = 0;
        this.fanA2 = null;              // Richtung der zweiten Welle – steht vor dem ersten Schuss fest
        this.fanLock = false;
        this.fanWaves = 0;
        this.fanT = 0;
        this.fanFriend = null;
        // Dreifach-Stich
        this.stings = [];                // [{x, y, R, done}]
        this.stingT = 0;
        this.stingNext = 0;
    }

    static room(world) { return ScorpionArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // Wo der Riese Gift sprüht (Spitze des mittleren Stachels)
    _muzzle() { return { x: this.centerX() + this.face * 16, y: this.y - 2 }; }

    // Richtung der zweiten Welle: wird in der Ansage sichtbar und spaeter nicht mehr umgeworfen
    _fanA2(player, px, py) {
        if (this.phase !== 2) return this.fanA;
        const m = this._muzzle();
        const fr = this.fanFriend;
        if (fr && !fr.dead && !(fr.koTimer > 0)) {
            return Math.atan2(fr.y + (fr.h || 20) / 2 - m.y, fr.x + (fr.w || 20) / 2 - m.x);
        }
        if (player && !player.dead) return Math.atan2(py - m.y, px - m.x);
        return this.fanA;
    }

    // Anzahl Gifttropfen je Salve
    _fanN() { return this.phase === 2 ? 9 : 6; }

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
            this.speed = 46;
            this.bigHits = 0;
            ScorpionArt.burst(mx, my - 24, [ScorpionCfg.venom, '#ffffff', ScorpionCfg.shell], 24, 205, 0.7, { kind: 'star' });
            ScorpionArt.ring(mx, my, ScorpionCfg.venom, 104, 0.6, 6);
            ScorpionArt.shake(8, 0.45);
        }
        const still = this.state === 'intro' || this.state === 'dizzy';
        if (!still) {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (this.state !== 'volleyWind' && this.state !== 'volleyFire' && Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'clawWind':
                if (!this.clawAim) this._aimClaw(player);
                if (this.stateT <= 0) {
                    this._clawHit();
                    this._set('claw', 0.22);
                }
                break;
            case 'claw':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'volleyWind':
                if (!this.fanLock) {
                    const near = ScorpionArt.nearTarget(player, mx, my, 420);
                    if (near) {
                        this.fanA = Math.atan2(near.t.y - (this.y - 2), near.t.x - this.centerX());
                        if (Math.abs(Math.cos(this.fanA)) > 0.2) this.face = Math.cos(this.fanA) > 0 ? 1 : -1;
                    }
                    if (this.stateT <= this.stateDur * 0.35) {
                        // beide Wellen stehen fest, bevor die erste fliegt – die zweite wird angesagt, nicht umgeworfen
                        this.fanA2 = this._fanA2(player, px, py);
                        this.fanLock = true;
                    }
                }
                if (this.stateT <= 0) {
                    this.fanWaves = this.phase === 2 ? 2 : 1;
                    this.fanT = 0;
                    this._set('volleyFire', this.phase === 2 ? 0.9 : 0.36);
                }
                break;
            case 'volleyFire': this._volley(dt, projectiles); break;
            case 'stingWind':
                if (this.stateT <= 0) {
                    this.stingT = 0;
                    this.stingNext = 0;
                    this._set('stingRun', 0.2 + this.stings.length * 0.2);
                }
                break;
            case 'stingRun': this._stingRun(dt); break;
            case 'dizzy':
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.45 : 0.8;
                    this._set('walk', 0);
                }
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        ScorpionArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster großer Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 5.4;
        let vx = 0, vy = 0;
        if (dist > 132) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 70) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        if (this.moving && Math.random() < dt * 6) ScorpionArt.dustFx(this.centerX() - vx * 26, this.y + this.h - 3);
        this.cool -= dt;
        if (this.cool > 0) return;
        const cyc = this.phase === 2 ? BossGiantScorpion.CYCLE2 : BossGiantScorpion.CYCLE1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'claw' && dist > 168) what = 'volley';        // die Scheren reichen nur von nah
        if (what === 'claw') this._startClaw();
        else if (what === 'volley') this._startVolley();
        else if (what === 'sting') this._startSting(player);
        else this.cool = this.phase === 2 ? 0.45 : 0.9;            // bewusste Verschnaufpause
    }

    // ── a) Zwicken mit den Krallen: Schaden, kein Gift ──
    _startClaw() {
        this.clawAim = null;
        this.hitOnce = [];
        this._set('clawWind', this.phase === 2 ? 0.44 : 0.58);
    }

    _aimClaw(player) {
        const mx = this.centerX(), my = this.centerY();
        const near = ScorpionArt.nearTarget(player, mx, my, 178);
        this.clawAim = near ? { x: near.t.x, y: near.t.y } : { x: mx + this.face * 46, y: my + 8 };
        if (Math.abs(this.clawAim.x - mx) > 4) this.face = this.clawAim.x > mx ? 1 : -1;
    }

    _clawHit() {
        const a = this.clawAim;
        if (!a) return;
        ScorpionArt.areaHit(a.x, a.y, this.clawR, this.damage, 250, this.hitOnce, 0);
        ScorpionArt.shake(5.4, 0.2);
        ScorpionArt.ring(a.x, a.y, ScorpionCfg.belly, this.clawR, 0.26, 5);
        ScorpionArt.burst(a.x, a.y, [ScorpionCfg.shell, '#ffffff', ScorpionCfg.belly], 12, 175, 0.42, { kind: 'spark' });
        ScorpionArt.dustFx(a.x, a.y + 6);
    }

    // ── b) Giftsalve: viele Tropfen entlang angesagter Bahnen ──
    _startVolley() {
        this.fanLock = false;
        this.fanA2 = null;              // kein Altwert aus der vorigen Salve
        this.fanWaves = 0;
        this.fanFriend = null;
        const opts = ScorpionArt.companions();
        if (opts.length && Math.random() < 0.7) this.fanFriend = opts[Math.floor(Math.random() * opts.length)];
        this._set('volleyWind', this.phase === 2 ? 0.7 : 0.9);
    }

    // Wellen der Salve: Phase 1 eine, Phase 2 zwei – „ganz viel Gift“
    _volley(dt, projectiles) {
        this.fanT -= dt;
        if (this.fanT <= 0 && this.fanWaves > 0) {
            const wave = this.fanWaves;
            this.fanWaves--;
            this.fanT = 0.34;
            // die zweite Welle fliegt auf genau die Bahn, die seit der Ansage sichtbar ist
            if (wave === 1 && this.fanA2 !== null) this.fanA = this.fanA2;
            this._fireVolley(projectiles);
        }
        if (this.stateT <= 0 || (this.fanWaves === 0 && this.fanT <= 0)) this._afterBig();
    }

    _fireVolley(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const m = this._muzzle();
        const n = this._fanN();
        const step = 0.2;
        const gift = this.phase === 2 ? 3.5 : 3;
        ScorpionArt.burst(m.x, m.y, [ScorpionCfg.venom, ScorpionCfg.venomLight, '#ffffff'], 12, 150, 0.4, { kind: 'spark' });
        ScorpionArt.shake(3.2, 0.16);
        if (!list) return;
        for (let i = 0; i < n; i++) {
            if (list.length > POISON_CAP) break;
            const a = this.fanA + (i - (n - 1) / 2) * step;
            list.push(new PoisonDrop(m.x + Math.cos(a) * 8, m.y + Math.sin(a) * 8, a, randRange(146, 168), gift, 1));
        }
    }

    // ── c) Dreifach-Stich: die drei Stacheln auf drei angesagte Kreise ──
    _startSting(player) {
        const mx = this.centerX(), my = this.centerY();
        const pts = ScorpionArt.targets(player)
            .map(t => ({ t, d: Math.hypot(t.x - mx, t.y - my) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 3)
            .map(o => ({ x: o.t.x, y: o.t.y }));
        // Sind weniger als drei Ziele dabei, liegen die übrigen Stacheln um Mark herum
        if (pts.length < 3) {
            const c = pts.length ? pts[0] : { x: mx + this.face * 40, y: my + 10 };
            for (const o of [{ a: 2.3, d: 40 }, { a: 0.9, d: 40 }]) {
                if (pts.length >= 3) break;
                const x = c.x + Math.cos(o.a) * o.d, y = c.y + Math.sin(o.a) * o.d;
                if (ScorpionArt.free(typeof Game !== 'undefined' ? Game.world : null, x, y, 12)) pts.push({ x, y });
                else pts.push({ x: c.x - Math.cos(o.a) * o.d, y: c.y - Math.sin(o.a) * o.d });
            }
        }
        this.stings = pts.map(p => ({ x: p.x, y: p.y, R: 34, done: false }));
        this.hitOnce = [];
        this._set('stingWind', this.phase === 2 ? 0.62 : 0.86);
    }

    // Die Stacheln fahren nacheinander herab – jeder Kreis füllt sich, dann schlägt er ein
    _stingRun(dt) {
        this.stingT += dt;
        while (this.stingNext < this.stings.length && this.stingT >= this.stingNext * 0.2) {
            const s = this.stings[this.stingNext];
            this.stingNext++;
            if (!s || s.done) continue;
            s.done = true;
            ScorpionArt.areaHit(s.x, s.y, s.R, 1, 200, this.hitOnce, this.phase === 2 ? 3.5 : 3);
            ScorpionArt.venomFx(s.x, s.y, s.R);
            ScorpionArt.shake(3.6, 0.14);
        }
        if (this.stateT <= 0) {
            this.stings = [];
            this._afterBig();
        }
    }

    // Nach großen Angriffen: Verschnaufpause – und bei wenig Leben wird er schwindelig.
    _afterBig() {
        this.bigHits++;
        const low = this.hp <= this.maxHp * 0.35;
        if (low) {
            this._set('dizzy', this.hp <= this.maxHp * 0.2 ? 2.2 : 1.7);
            ScorpionArt.burst(this.centerX(), this.y + 6, ['#ffe35a', '#ffffff'], 12, 100, 0.5, { kind: 'star' });
            return;
        }
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', 1.3);
            ScorpionArt.burst(this.centerX(), this.y + 6, ['#ffe35a', '#ffffff'], 9, 90, 0.45, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.5 : 0.9;
        this._set('pant', this.cool + 0.4);
    }

    // Ansagen am Boden: Scherenkreis, Flugbahnen der Salve, drei Stichkreise – immer vor allen Figuren
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const k = this._k();
        if (st === 'clawWind' || st === 'claw') {
            if (this.clawAim) {
                const p = camera.worldToScreen(this.clawAim.x, this.clawAim.y);
                LateWorldArt.warn(ctx, p.x, p.y, this.clawR, st === 'claw' ? 1 : k, ScorpionCfg.warn);
            }
            return;
        }
        if (st === 'volleyWind' || st === 'volleyFire') {
            const m = this._muzzle();
            const p = camera.worldToScreen(m.x, m.y);
            const n = this._fanN();
            const step = 0.2;
            // Jede einzelne Bahn: LateWorldArt.rays stellt Speichen im vollen Kreis, angesagt werden
            // muss aber genau die Salve, die gleich fliegt (Ansage = Treffer).
            for (let i = 0; i < n; i++) {
                LateWorldArt.lane(ctx, p.x, p.y, this.fanA + (i - (n - 1) / 2) * step, 186, 15,
                    st === 'volleyFire' ? 1 : k, ScorpionCfg.warnPoison);
            }
            if (st === 'volleyFire' && this.fanWaves > 0 && this.fanA2 !== null && this.fanA2 !== this.fanA) {
                // die noch kommende zweite Welle steht schon sichtbar in der Landschaft
                for (let i = 0; i < n; i++) {
                    LateWorldArt.lane(ctx, p.x, p.y, this.fanA2 + (i - (n - 1) / 2) * step, 186, 15, 0.75, ScorpionCfg.warnPoison);
                }
            }
            if (st === 'volleyWind') Art.ring(ctx, p.x, p.y, 20 + 12 * k, ScorpionCfg.venom, 2.4, 0.3 + 0.3 * k);
            return;
        }
        if (st === 'stingWind' || st === 'stingRun') {
            for (let i = 0; i < this.stings.length; i++) {
                const s = this.stings[i];
                const p = camera.worldToScreen(s.x, s.y);
                if (st === 'stingWind') {
                    // die Kreise füllen sich nacheinander: welcher Stachel als nächstes kommt, ist klar
                    const part = clamp(this._k() * this.stings.length - i, 0, 1);
                    LateWorldArt.warn(ctx, p.x, p.y, s.R, part, ScorpionCfg.warn);
                    Art.text(ctx, String(i + 1), p.x, p.y, { size: 13, color: '#ffffff', outline: 'rgba(60,10,4,0.85)' });
                } else if (!s.done) {
                    LateWorldArt.warn(ctx, p.x, p.y, s.R, 1, ScorpionCfg.warn);
                } else {
                    Art.ring(ctx, p.x, p.y, s.R * (0.7 + 0.5 * k), ScorpionCfg.venom, 3, 0.5);
                }
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 30);
            ctx.translate(cx, foot);
            this._body(ctx, true);
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
    }

    // Riesenskorpion: dieselbe Figur wie die kleinen, 2,3-mal so groß, mit drei Schwänzen,
    // Rückenkämmen und Narbe; Phase 2 mit grünen Panzerspalten, roten Augen und Gift-Dampf.
    _body(ctx, dead) {
        const S = 2.3;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const intro = st === 'intro';
        const clawWind = st === 'clawWind' ? k : 0;
        const claw = st === 'claw';
        const volleyWind = st === 'volleyWind' ? k : 0;
        const volleyFire = st === 'volleyFire';
        const stingWind = st === 'stingWind' ? k : 0;
        const stingRun = st === 'stingRun';
        const wind = Math.max(clawWind, stingWind);
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const rise = wind * 4.4 + (intro ? 2 : 0) + volleyWind * 2 - (claw ? 2.6 : 0);
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.0 : Math.sin(t * 1.7) * 0.9) + rise - (rest ? 1.4 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 1.7) * 0.014) + wind * 0.02;
        const legs = [
            Math.max(0, Math.sin(this.step * 2)) * 3.4,
            Math.max(0, Math.sin(this.step * 2 + 2.1)) * 3.4,
            Math.max(0, Math.sin(this.step * 2 + 4.2)) * 3.4,
        ];
        // Scheren: Drohen hoch und weit auf, beim Zwicken weit vorn und zu, beim StichGift gespreizt
        const open = 0.4 + wind * 0.45 + volleyWind * 0.3;
        let hb = { x: -22, y: -16 + Math.max(0, -walk) * 2.4, a: Math.PI + 0.25, open };
        let hf = { x: 22, y: -16 - Math.max(0, walk) * 2.4, a: -0.25, open };
        if (wind || intro) { hb = { x: -17, y: -34 - wind * 8, a: Math.PI - 0.55, open }; hf = { x: 17, y: -34 - wind * 8, a: 0.55, open }; }
        if (clawWind || claw) {
            const q = claw ? 1 : k;
            const a = this.clawAim ? Math.atan2(this.clawAim.y - (this.y + this.h), this.clawAim.x - this.centerX()) : 0;
            const s = Math.cos(a) * this.face >= 0 ? 1 : -1;
            hb = { x: -6 + s * 30 * q, y: -26 + 12 * q, a: Math.PI + 0.4 - 0.4 * q, open: 0.85 * (1 - q) + 0.05 };
            hf = { x: 10 + s * 30 * q, y: -26 + 12 * q, a: 0.4 - 0.4 * q, open: 0.85 * (1 - q) + 0.05 };
        }
        if (volleyWind || volleyFire) { hb = { x: -24, y: -30 - volleyWind * 4, a: Math.PI - 0.7, open: 0.8 }; hf = { x: 24, y: -30 - volleyWind * 4, a: 0.7, open: 0.8 }; }
        if (dizzy) {
            const sway = Math.sin(t * 5) * 2.4;
            hb = { x: -24 + sway, y: -8, a: Math.PI + 0.7, open: 0.7 };
            hf = { x: 24 + sway, y: -8, a: -0.7, open: 0.7 };
        }
        // Die drei Stacheln: Mitte geradeaus, die seitlichen schräg; beim Dreifach-Stich nacheinander
        const tails = [];
        for (let i = 0; i < 3; i++) {
            let lift = clamp(wind * 0.8 + volleyWind + (intro ? 0.4 : 0), 0, 1);
            let strike = 0;
            if (stingRun) {
                const seq = Math.min(this.stings.length, 3) - 1 - i;
                const f = clamp(this.stingT / 0.2 - seq, 0, 1);
                lift = clamp(1 - f * 1.6, 0, 1);
                strike = clamp(f * 1.6 - 0.3, 0, 1);
            } else if (claw) strike = 0.25;
            tails.push({ lean: i - 1, lift, strike, seed: this.seed + i * 1.7, size: i === 1 ? 1.12 : 0.92 });
        }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, -20, 34, ScorpionCfg.venom, 0.16 * this.angry + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (wind || claw || clawWind || volleyWind || volleyFire || stingWind || stingRun || intro) ? 'open'
                : rest ? 'tired' : 'angry';
        const f = ScorpionArt.figure(ctx, {
            c: C_SCORP_RED, lw: 0.8, t, bob, walk, legs, mood,
            claw: { b: hb, f: hf }, clawGlow: claw && !dead ? ScorpionCfg.belly : null,
            tails, venomGlow: !dead && (volleyFire || stingRun || volleyWind > 0.5) ? 0.4 : 0,
            look: { x: this.look.x * this.face, y: this.look.y },
            ridges: true, scar: true, red: p2,
        });
        if (p2 && !dead && !dizzy) Art.glow(ctx, 0, f.ey, 9, '#ff3b5c', 0.3 + 0.2 * Math.sin(t * 9));
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 0, f.ey * S - 14, 28, 4.6);
        // Gift-Dampf aus den Stacheln in Phase 2
        if (p2 && !dizzy && !dead) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = ScorpionCfg.venomLight;
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.8 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.45;
                ctx.beginPath();
                ctx.arc((i - 1) * 22 + Math.sin(t * 3 + i) * 4, (f.body - 52) * S - q * 22, 4 + q * 7, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
    }
}

BossGiantScorpion.CYCLE1 = ['claw', 'volley', 'sting', 'walk'];
BossGiantScorpion.CYCLE2 = ['volley', 'claw', 'sting', 'volley', 'walk'];
