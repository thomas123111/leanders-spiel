// ── Welt 51: Süßigkeitenland (Idee von Leander, 13.10.2026) ──
// Gummibär: durchscheinender Gummibär (Wunsch von Leander: rot, grün, gelb, orange, blau). Hüpft auf
//   Abstand und schießt Gummibälle auf Mark UND auf Juri, das Schattenkrokodil und den Panda. 0,5 s vorher
//   leuchtet eine rote Wurfbahn am Boden und der Ball fliegt genau diese Bahn (Ansage = Treffer). Weicht er
//   zu dicht an Mark heran, hüpft er zurück – er hat keinen Schlag, nur den Wurf.
//   Das Gummibär mit dem Schlüssel ist BUNT mit Regenbogenstreifen (Wunsch von Leander), hält mehr aus und
//   wirft zwei Bälle kurz hintereinander – beide folgen genau der angesagten Bahn.
// Boss: RIESEN-GUMMIBÄR – Endgegner von Welt 51, bleibt im Boss-Raum (der runde Tortenplatz), 145 LP,
//   zwei Phasen.
//   Gummi-Explosionen: mehrere grüne und rote Warnkreise liegen fest, dann platzen sie nacheinander und
//     spritzen Gummi (ganz viele, in Phase 2 noch mehr).
//   Einschleimen: auf Mark und die Freunde legt sich je ein Warfkreis, dann fliegt ein Gummiklex, platzt
//     dort – wer drin steht, klebt drei Sekunden und läuft nur noch langsam (Zustand slime aus dem Gerüst).
//     Der Klex zieht kein Leben ab, er klebt nur.
//   Fächer: eine breite Salve Gummibälle, angesagt mit roten Bahnen in jede Wurfrichtung.
//   Phase 2 (halbe LP): schneller, mehr Explosionen, breiterer Fächer. Nach jedem zweiten großen Angriff
//     wird er schwindelig (kreisende Sterne, kurz wehrlos), bei wenig Leben 2,4 s lang – Marks Zeit zum
//     Zurückhauen.
//   Leander will genau diese Wirkungen: KEIN Gift, kein Schlaf, keine zusätzlichen Zustände.
//   Freunde verschwinden nie: ein Gummiball, der Juri, das Krokodil oder den Panda besiegen würde, haut
//   sie nur um.

const CandyCfg = {
    // Leanders fünf Gummibär-Farben
    gummy: ['#ff3d5a', '#4fd23f', '#ffd23f', '#ff8c2b', '#3fa9ff'],
    rainbow: ['#ff3d5a', '#ff8c2b', '#ffd23f', '#4fd23f', '#3fa9ff', '#b06aff'],
    keyBody: '#fff2f7',           // der bunte Schlüsselträger selbst ist helles Gummi
    muzzle: '#fff0f4',            // helle Schnauze (jedes Gummibär hat eine)
    slime: '#8fd23f',             // Gummi-Klex zum Einschleimen
    slimeMid: '#6bb428',
    slimeDark: '#3f7a1c',
    warn: '#ff5a3d',
    warnHot: '#ff3d5a',
    warnSlime: '#9ade3f',         // grüner Warnkreis = gleich klebt es (Kind lernt: grün = Gummi)
    sugar: '#ffffff',
};

// Höchstens so viele Gummibälle gleichzeitig auf dem Bildschirm.
const GUMBALL_CAP = 110;
// Reichweite des Schleim-Klexes: muss zum Radius seines Warnkreises passen (Ansage = Treffer).
const SLIME_R = 27;
const BOOM_R = 31;

// Eine Farbpalette pro Grundfarbe (hell/dunkel/Umriss), einmal ausgerechnet und behalten.
const _candyPal = new Map();
function gummyPal(base) {
    let p = _candyPal.get(base);
    if (!p) {
        p = {
            base,
            hi: Art.light(base, 0.5),
            mid: Art.light(base, 0.18),
            lo: Art.dark(base, 0.26),
            deep: Art.dark(base, 0.46),
            ink: Art.ink(base),
        };
        _candyPal.set(base, p);
    }
    return p;
}

const CandyArt = {
    // Eine der fünf Farben (für Gegner, die ihre Farbe noch nicht haben)
    pickColor() { return CandyCfg.gummy[Math.floor(Math.random() * CandyCfg.gummy.length)]; },

    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine direkt.
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && istMarkZiel(player) && typeof Game._hurtPlayer === 'function') {
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
            if (!c || c.dead || typeof c.knockOut !== 'function') continue;
            if (c.koTimer > 0 || c.iFrames > 0) continue;      // umgefallen oder in der Schonzeit
            out.push(c);
        }
        return out;
    },

    // Begleiter treffen: nie verschwinden lassen, ein tödlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(7);
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2,
            [CandyCfg.sugar, c.fxColor || CandyCfg.gummy[0]], 9, 130, 0.42, { kind: 'star' });
    },

    // Gummibälle treffen auch Juri, das Krokodil und den Panda (hier eigener Treffer, damit es richtig
    // weh tut). Mark übernimmt die Engine – dort zählt die Ausweichrolle und die Schonzeit nach dem Treffer.
    companionHit(proj) {
        for (const c of this.companions()) {
            if (typeof c.takeDamage !== 'function') continue;
            const w = c.w || 20, h = c.h || 20;
            const cx = c.x + w / 2, cy = c.y + h / 2;
            if (Math.hypot(proj.x - cx, proj.y - cy) > proj.radius + Math.max(w, h) / 2) continue;
            proj.dead = true;
            this.hitCompanion(c, proj.damage >= 2 ? 2 : 1);
            return true;
        }
        return false;
    },

    // Einschleimen: alle treffbaren Ziele im Kreis – Mark und die Freunde. Nur der Schleim aus dem Gerüst
    // (drei Sekunden kleben, danach Schonzeit), kein Schaden und kein weiterer Zustand.
    slimeAround(x, y, R, seconds) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        let traf = false;
        if (player && !player.dead && typeof player.slime === 'function' &&
            Math.hypot(player.x + player.w / 2 - x, player.y + player.h / 2 - y) <= R + player.w / 2) {
            if (player.slime(seconds)) traf = true;
        }
        for (const c of this.companions()) {
            if (typeof c.slime !== 'function') continue;
            const w = c.w || 20, h = c.h || 20;
            if (Math.hypot(c.x + w / 2 - x, c.y + h / 2 - y) > R + Math.max(w, h) / 2) continue;
            if (c.slime(seconds)) traf = true;
        }
        return traf;
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.bossDefeated ||
            typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    // Freier Punkt in der Welt (für Landpunkte der Gummi-Explosionen)?
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

    // Nächster Zielpunkt von (x, y) aus, höchstens maxD weit – Mark oder ein Freund.
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

    // ── Ganze Figur: ein Gummibär von vorn, leicht in Blickrichtung gedreht, Fußpunkt (0, 0).
    // Eine Einheit = normales Gummibär, der Boss zeichnet dieselbe Figur größer (ctx.scale vorher).
    // Das Gummi scheint durch: Körper und Glieder in durchscheinendem Farbton, Gesicht und Nase deckend,
    // damit das Kind das Bär auf den ersten Blick erkennt.
    // p = { c (Palette), lw, t, bob, lean, squash, mood ('calm'|'angry'|'open'|'tired'|'dizzy'|'dead'),
    //       look, arms: { b: {x, y}, f: {x, y} }, ball (Gummiball in der Vorderhand), rainbow (Streifen),
    //       dents (Dellen/Knicke in Phase 2), a (Deckkraft des Gummis) }
    figure(ctx, p) {
        const c = p.c, lw = p.lw;
        const y0 = -p.bob;
        const lean = p.lean || 0;
        const sq = p.squash || 0;                       // >0: plattgedrückt (Landung), <0: gedehnt (Sprung)
        const a = p.a === undefined ? 0.88 : p.a;
        const prevA = ctx.globalAlpha;
        const bodyPath = (g) => {
            g.moveTo(-7.6, y0 - 3.2 + sq * 1.6);
            g.bezierCurveTo(-10.0 - sq * 1.2, y0 - 6.6, -9.4, y0 - 13.6, -7.2, y0 - 17.4);
            g.quadraticCurveTo(-3.4, y0 - 20.6, 0, y0 - 20.6);
            g.quadraticCurveTo(3.4, y0 - 20.6, 7.2, y0 - 17.4);
            g.bezierCurveTo(9.4, y0 - 13.6, 10.0 + sq * 1.2, y0 - 6.6, 7.6, y0 - 3.2 + sq * 1.6);
            g.quadraticCurveTo(0, y0 - 0.4, -7.6, y0 - 3.2 + sq * 1.6);
            g.closePath();
        };
        // ── Pfoten (hinten), Arme (hinten) ──
        ctx.globalAlpha = prevA * a;
        for (const s of [-1, 1]) {
            Art.body(ctx, s * 5.9, y0 - 2.4, 4.5, 2.9, c.mid, { lineWidth: lw, highlight: false });
        }
        const arm = (s, hd) => {
            Art.limb(ctx, s * 6.6, y0 - 15.4, hd.x, hd.y, 3.5, c.mid, { lineWidth: lw * 0.85 });
            Art.body(ctx, hd.x, hd.y, 3.1, 3.0, c.base, { lineWidth: lw * 0.85, glossy: true });
        };
        arm(-1, p.arms.b);
        // ── Rumpf (Gummi), Bauch hell, Regenbogenstreifen für den Schlüsselträger ──
        Art.shape(ctx, bodyPath, { x: -10.2, y: y0 - 20.8, w: 20.4, h: 20.6 }, c.base,
            { glossy: true, lineWidth: lw });
        Art.body(ctx, 0, y0 - 9.4 + sq, 5.3, 5.0, c.mid, { highlight: false, lineWidth: lw * 0.7 });
        if (p.rainbow) {
            // BUNT: diagonal laufende Regenbogenstreifen, sauber auf den Rumpf beschnitten
            ctx.save();
            ctx.beginPath();
            bodyPath(ctx);
            ctx.clip();
            const n = CandyCfg.rainbow.length;
            for (let i = 0; i < n; i++) {
                ctx.fillStyle = Art.alpha(CandyCfg.rainbow[i], 0.82);
                ctx.beginPath();
                ctx.ellipse(0, y0 - 19.4 + i * 3.5, 12.5, 1.7, -0.34, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
            ctx.beginPath();
            bodyPath(ctx);
            ctx.strokeStyle = c.ink;
            ctx.lineWidth = lw;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
        if (p.dents) {
            // Phase 2: Knicke und Dellen im Gummi
            ctx.strokeStyle = c.deep;
            ctx.lineWidth = lw * 0.8;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-6.2, y0 - 6.4); ctx.lineTo(-3.4, y0 - 9.2); ctx.lineTo(-5.2, y0 - 12.6);
            ctx.moveTo(6.4, y0 - 14.2); ctx.lineTo(4.0, y0 - 11.0);
            ctx.moveTo(2.2, y0 - 4.4); ctx.lineTo(4.4, y0 - 6.8);
            ctx.stroke();
        }
        // Glanz des Gummis: heller Schein oben links, kalter Schimmer unten rechts
        Art.shine(ctx, -4.2, y0 - 16.2, 2.6, 1.7, -0.6, 0.55);
        Art.ring(ctx, 0.6, y0 - 11.4, 7.4, c.hi, lw * 0.8, 0.3);
        // ── vorderer Arm (hält den Gummiball) ──
        arm(1, p.arms.f);
        if (p.ball) {
            const b = p.arms.f;
            Art.body(ctx, b.x + 2.4, b.y - 1.4, 3.5, 3.4, c.base, { lineWidth: lw * 0.85, glossy: true });
        }
        // ── Kopf mit zwei runden Ohren ──
        const hx = lean * 1.1, hy = y0 - 25.6;
        for (const s of [-1, 1]) {
            Art.body(ctx, hx + s * 5.1, hy - 4.9, 2.9, 2.9, c.base, { lineWidth: lw, glossy: true });
            Art.body(ctx, hx + s * 5.1, hy - 4.9, 1.5, 1.5, c.hi, { highlight: false, outline: false });
        }
        Art.body(ctx, hx, hy, 7.1, 6.6, c.base, { glossy: true, lineWidth: lw });
        Art.shine(ctx, hx - 3.1, hy - 3.4, 2.2, 1.4, -0.6, 0.5);
        // Helle Schnauze (bei Gummibären immer heller als der Rest)
        ctx.globalAlpha = prevA;
        Art.body(ctx, hx + 0.4, hy + 2.2, 3.9, 2.9, CandyCfg.muzzle, { highlight: false, lineWidth: lw * 0.75 });
        // ── Gesicht: Nase, Augen, Mund – deckend, damit das Bär sofort zu erkennen ist ──
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        const ex = 2.7;
        ctx.fillStyle = c.deep;
        ctx.beginPath();
        ctx.ellipse(hx + 0.4, hy + 0.8, 1.25, 0.95, 0, 0, TAU);         // Nase
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(hx - 0.1, hy + 0.5, 0.38, 0, TAU);
        ctx.fill();
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, hx, hy - 1.1, 1.5, ex);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = c.deep;
            ctx.lineWidth = Math.max(0.9, lw * 0.85);
            ctx.lineCap = 'round';
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const ang = i * 0.75 + (p.t || 0) * 6 * s, r = 0.25 + i * 0.11;
                    const x = hx + s * ex + Math.cos(ang) * r, y = hy - 1.1 + Math.sin(ang) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                const px = hx + s * ex + look.x * 0.6, py = hy - 1.1 + look.y * 0.45;
                ctx.fillStyle = c.deep;
                ctx.beginPath();
                ctx.ellipse(px, py, 1.35, mood === 'tired' ? 0.75 : 1.55, 0, 0, TAU);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.beginPath();
                ctx.arc(px - 0.45, py - 0.55, 0.42, 0, TAU);
                ctx.fill();
            }
            if (mood === 'angry' || mood === 'open') {
                ctx.strokeStyle = c.deep;
                ctx.lineWidth = Math.max(1, lw);
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (const s of [-1, 1]) {
                    ctx.moveTo(hx + s * (ex + 1.7), hy - 3.7);
                    ctx.lineTo(hx + s * (ex - 1.0), hy - 2.7);
                }
                ctx.stroke();
            }
        }
        if (mood === 'open') {
            Art.mouth(ctx, hx + 0.4, hy + 4.0, 3.6, 'open');
        } else {
            ctx.strokeStyle = c.deep;
            ctx.lineWidth = Math.max(0.9, lw * 0.85);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(hx - 1.3, hy + 3.5);
            ctx.quadraticCurveTo(hx + 0.4, hy + 4.6, hx + 2.1, hy + 3.5);
            ctx.stroke();
        }
        ctx.globalAlpha = prevA;
        return { hx, hy };
    },
};

// ══════════════════════════════════════════
// ── Gummiball (Geschoß von Gummibär und Riese) ──
// ══════════════════════════════════════════

// Durchscheinender Gummiball in der Farbe seines Werfers, wabbelt beim Fliegen. big = der große Ball des
// Riesen (langsamer, 2 Schaden). Trifft Mark über die Engine, die Freunde über CandyArt.companionHit.
class GummyBall extends Projectile {
    constructor(x, y, angle, speed, color, big) {
        const sp = speed || (big ? 128 : randRange(162, 186));
        super(x, y, Math.cos(angle) * sp, Math.sin(angle) * sp, big ? 2 : 1, 'enemy', big ? 170 : 95);
        this.radius = big ? 9 : 6;
        this.lifetime = big ? 3.4 : 2.5;
        this.big = !!big;
        this.color = color || CandyArt.pickColor();
        this.pal = gummyPal(this.color);
        this.wob = Math.random() * 10;
        this.grace = 0.12;              // direkt an der Hand darf kein Freund getroffen werden
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) return;
        if (this.big && Math.random() < 0.22) {
            CandyArt.burst(this.x, this.y, [this.color, this.pal.hi], 1, 26, 0.34, { kind: 'smoke', size: 3 });
        }
        if (this.age >= this.grace) CandyArt.companionHit(this);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        // Gummispur: kurze, weiche Spur in der eigenen Farbe
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const prev = ctx.globalAlpha;
        for (let i = 3; i >= 1; i--) {
            ctx.globalAlpha = prev * (0.24 - i * 0.06);
            ctx.fillStyle = this.pal.mid;
            ctx.beginPath();
            ctx.arc(p.x - dx * i * r * 0.85, p.y - dy * i * r * 0.85, r * (1 - i * 0.24), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = prev;
        if (this.big) Art.glow(ctx, p.x, p.y, r * 2.5, this.color, 0.5);
        // Wabbeln quer zur Flugrichtung: Gummi, keine Kugel
        const wob = Math.sin(Art.time * 13 + this.wob) * 0.13;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.scale(1 + wob, 1 - wob);
        ctx.globalAlpha = prev * 0.9;
        Art.body(ctx, 0, 0, r, r * 0.96, this.color, { glossy: true, lineWidth: this.big ? 1.7 : 1.3 });
        if (this.big) {
            ctx.globalAlpha = prev;
            ctx.strokeStyle = this.pal.deep;
            ctx.lineWidth = 2.1;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.98, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
        if (this.big) {
            Art.sparkle(ctx, p.x + r * 0.85, p.y - r * 0.85, 2.4, '#ffffff', 0.5 + 0.5 * Math.sin(Art.time * 9 + this.wob));
        }
    }
}

// ══════════════════════════════════════════
// ── Gummi-Klex (Schleim-Wurf des Riesen) ──
// ══════════════════════════════════════════

// Grüner Gummiklex: fliegt auf einen vorher angesagten Punkt, platzt dort und klebt alles im Kreis
// drei Sekunden lang ein (Zustand slime aus dem Gerüst). Er zieht KEIN Leben ab. Der Kreis am Boden
// stand schon, bevor er flog – wer da stand, ist zu Recht eingeklebt.
class GummyGlob extends Projectile {
    constructor(x, y, tx, ty) {
        const ang = Math.atan2(ty - y, tx - x);
        const d = Math.hypot(tx - x, ty - y);
        const sp = 190;
        super(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, 0, 'enemy', 0);
        this.radius = 8;
        this.flight = Math.max(0.12, d / sp);
        this.lifetime = this.flight + 0.6;
        this.wob = Math.random() * 10;
    }

    update(dt, world) {
        super.update(dt, world);
        this._splat();
    }

    // Platzen: am Zielpunkt, an der Wand oder mit Ablauf der Flugzeit – immer derselbe Effekt.
    _splat() {
        if (this.dead && this._splatted) return;
        if (!this._splatted && this.age < this.flight && !this.dead) return;
        this._splatted = true;
        this.dead = true;
        const traf = CandyArt.slimeAround(this.x, this.y, SLIME_R, 3);
        CandyArt.burst(this.x, this.y, [CandyCfg.slime, CandyCfg.slimeMid, CandyCfg.slimeDark], traf ? 16 : 10, 130, 0.5,
            { kind: 'dot', gravity: 210 });
        CandyArt.ring(this.x, this.y, CandyCfg.slime, SLIME_R, 0.34, 3.4);
        CandyArt.shake(1.8, 0.1);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        const prev = ctx.globalAlpha;
        Art.glow(ctx, p.x, p.y, r * 2.1, CandyCfg.slime, 0.35);
        const wob = Math.sin(Art.time * 11 + this.wob) * 0.16;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.scale(1 + wob, 1 - wob);
        ctx.globalAlpha = prev * 0.9;
        Art.body(ctx, 0, 0, r, r * 0.86, CandyCfg.slime, { glossy: true, lineWidth: 1.5 });
        ctx.globalAlpha = prev;
        // zwei dunkle Tropfen: man sieht, dass es klebt
        ctx.fillStyle = CandyCfg.slimeMid;
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.ellipse(-r * 0.4 + i * r * 0.8, r * 0.55, r * 0.22, r * 0.34, 0, 0, TAU);
            ctx.fill();
        }
        Art.shine(ctx, -r * 0.3, -r * 0.4, r * 0.34, r * 0.2, -0.5, 0.6);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Normaler Gummibär ──
// ══════════════════════════════════════════

// Gummibär (Hitbox 26×26, 7 LP, Schlüsselträger 9 LP). Hüpft auf 70–200 Abstand und schießt Gummibälle
// auf Mark oder einen Freund; die rote Wurbahn steht 0,5 s vorher und der Ball fliegt genau dort lang.
// Zu dicht an Mark hüpft er zurück – einen Schlag hat er nicht. Bei halben LP schaut er drein, als
// wäre er warm geworden. Der Schlüsselträger ist bunt (Regenbogenstreifen) und wirft zwei Bälle.
class GummyBear extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 26);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(44, 54);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.color = CandyArt.pickColor();
        this.pal = gummyPal(this.color);
        this.fxColor = this.color;
        this.seed = Math.random() * 10;
        this.detectionRange = 250;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.15 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2.0);
        this.step = 0;
        this.moving = false;
        this.rainbow = false;           // bunter Schlüsselträger
        this.aimAng = 0;                // Wurfrichtung (steht fest, sobald die Bahn angezeigt wird)
        this.aimLen = 120;
        this.aimLock = false;
        this.throwLeft = 0;             // Schnellfolge des Schlüsselträgers
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // Punkt, aus dem die Gummibälle fliegen (vordere Hand)
    _hand() {
        return { x: this.centerX() + this.face * 9, y: this.centerY() - 3 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): bunt und zäher
            this._keyInit = true;
            this.rainbow = true;
            this.color = CandyCfg.keyBody;
            this.pal = gummyPal(CandyCfg.keyBody);
            this.fxColor = CandyCfg.rainbow[0];
            this.hp = this.maxHp = 9;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'wind' && this.state !== 'throw') {
            // Blick und Richtung bleiben während Ansage und Wurf stehen: die angesagte Bahn gilt wirklich.
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('jiggle', 0.7);       // wackelt kurz: Gummimännchen-Vorwarnung, Zuckerkrümel fliegen
            CandyArt.burst(mx, my - 6, [this.color, CandyCfg.sugar], 7, 66, 0.5, { kind: 'spark' });
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'jiggle':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'wind':
                if (!this.aimLock) {
                    const near = CandyArt.nearTarget(player, mx, my, 250);
                    if (near) {
                        this.aimAng = Math.atan2(near.t.y - my, near.t.x - mx);
                        this.aimLen = clamp(near.d + 24, 70, 215);
                        if (Math.abs(Math.cos(this.aimAng)) > 0.25) this.face = Math.cos(this.aimAng) > 0 ? 1 : -1;
                    }
                    if (this.stateT <= this.stateDur * 0.35) this.aimLock = true;   // Bahn steht jetzt fest
                }
                if (this.stateT <= 0) {
                    this._throw(projectiles);
                    this.throwLeft = this.rainbow ? 1 : 0;
                    this._set('throw', 0.24);
                }
                break;
            case 'throw':
                if (this.stateT <= 0) {
                    if (this.throwLeft > 0) {
                        this.throwLeft--;
                        this._throw(projectiles);
                        this._set('throw', 0.2);
                    } else {
                        this.cool = this.rainbow ? randRange(1.4, 1.9) : randRange(1.3, 2.1);
                        this._set('walk', 0);
                    }
                }
                break;
            case 'hop':
                this._hop(dt, world, dx, dy, dist);
                if (this.stateT <= 0) {
                    this.cool = randRange(0.7, 1.1);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, dann werfen; zu dicht weghoppeln ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.3;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.22 * dt,
                Math.cos(this.step * 0.7) * this.speed * 0.22 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 178) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 74) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 7.4;
        } else this.step += dt * 1.8;
        if (this.cool > 0) return;
        if (dist < 62) {
            this._set('hop', 0.42);            // Gummi-Fußtritt zurück: kein Schlag, nur Abstand
            return;
        }
        if (dist < 235) {
            this.aimLock = false;
            this._set('wind', this.rainbow ? 0.44 : 0.5);
            return;
        }
        this.cool = 0.5;
    }

    // Hüpfen zurück (weg von Mark), dabei bleibt die Wurfrichtung unangetastet.
    _hop(dt, world, dx, dy, dist) {
        const d = dist || 1;
        const k = this._k();
        const away = 1 - Math.abs(k - 0.5) * 2;            // in der Mitte am höchsten
        Kit915.rush(this, (-dx / d) * this.speed * 1.5 * dt, (-dy / d) * this.speed * 1.5 * dt, world);
        this.moving = true;
        this.step += dt * 9;
        if (k > 0.5 && away < 0.15) {
            CandyArt.burst(this.centerX(), this.centerY() + 10, [this.color, CandyCfg.sugar], 3, 60, 0.3,
                { kind: 'dot', gravity: 190 });
        }
    }

    // Alle Würfe – auch der zweite des Schlüsselträgers – fliegen genau die angesagte Bahn.
    _throw(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const h = this._hand();
        if (!list || list.length > GUMBALL_CAP) {
            CandyArt.burst(h.x, h.y, [this.color, CandyCfg.sugar], 5, 80, 0.3, { kind: 'spark' });
            return;
        }
        const a = this.aimAng;
        list.push(new GummyBall(h.x + Math.cos(a) * 6, h.y + Math.sin(a) * 6, a, null, this.color));
        CandyArt.burst(h.x, h.y, [this.color, CandyCfg.sugar], 5, 92, 0.3, { kind: 'spark' });
    }

    // Ansage am Boden: die rote Wurfbahn – unter allen Figuren, damit nichts verdeckt wird
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st !== 'wind' && st !== 'throw') return;
        const h = this._hand();
        const p = camera.worldToScreen(h.x, h.y);
        const fade = st === 'throw' ? clamp(this.stateT / 0.24, 0, 1) : 1;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * (0.45 + 0.55 * fade);
        LateWorldArt.lane(ctx, p.x, p.y, this.aimAng, this.aimLen, 21, this._k(), CandyCfg.warn);
        ctx.globalAlpha = prev;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 11)) {
                ctx.translate(cx, foot);
                this._body(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 15 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Gummibär mit Fußpunkt (0, 0); gezeichnet in CandyArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this.pal;
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const wind = st === 'wind' ? k : 0;
        const throwing = st === 'throw';
        const hopping = st === 'hop';
        const jiggle = st === 'jiggle' ? Math.sin(t * 24) * 1.5 : 0;
        const hop = hopping ? Math.sin(k * Math.PI) : 0;
        const walk = this.moving && !dead && !hopping ? Math.abs(Math.sin(this.step)) : 0;
        const bob = dead ? -1 : hop * 5 + (this.moving ? walk * 1.2 : Math.sin(t * 2.6) * 0.5) + (throwing ? -0.8 : 0);
        const squash = dead ? 0 : (hopping ? -hop * 0.9 : (this.moving ? -walk * 0.5 : 0)) + wind * 0.5;
        const lean = dead ? 0 : wind * 2.2 + (throwing ? -2.0 : 0) + jiggle;
        // Arme: hinten unten, vorn je Zustand (ausgeholt über die Schulter, nach dem Wurf weit vorn)
        let hb = { x: -10 - jiggle, y: -8 + Math.max(0, walk - 0.5) * 1.6 };
        let hf = { x: 10 + jiggle, y: -8 - Math.max(0, walk - 0.5) * 1.6 };
        if (wind) hf = { x: -2 - wind * 6, y: -17 - wind * 4 };
        else if (throwing) hf = { x: 13, y: -15 };
        else if (hopping) { hb = { x: -12, y: -14 - hop * 2 }; hf = { x: 12, y: -14 - hop * 2 }; }
        else if (st === 'jiggle') { hb = { x: -9, y: -14 + jiggle }; hf = { x: 9, y: -14 - jiggle }; }
        ctx.save();
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -14, 24, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (wind || throwing) ? 'open' : tired ? 'tired' : 'angry';
        CandyArt.figure(ctx, {
            c, lw: 1.25, t, bob, lean, squash, mood,
            arms: { b: hb, f: hf }, ball: !!(wind || throwing),
            rainbow: this.rainbow && !dead,
            look: { x: this.look.x * this.face, y: this.look.y },
            a: this.rainbow ? 0.92 : 0.88,
        });
        if (throwing && !dead) Art.glow(ctx, hf.x, hf.y, 12, this.color, 0.45);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESEN-GUMMIBÄR (Endgegner Welt 51) ──
// ══════════════════════════════════════════

// Riesiger Gummibär, 145 LP, bleibt im Boss-Raum (dem runden Tortenplatz). Ablauf Phase 1:
//   Gummirohren → Gummi-Explosionen (mehrere Warnkreise, dann platschen sie) → Einschleimen (Warnkreis auf
//   Mark und den Freunden, dann fliegt der Klex) → Gummifächer → Verschnaufpause …
// Phase 2 (halbe LP): schneller, mehr Explosionskreise, breiterer Fächer, mehr Kleckse. Nach jedem zweiten
//   großen Angriff wird er schwindelig, bei wenig Leben 2,4 s lang – Marks Zeit zum Zurückhauen.
//   Kein Gift, kein Schlaf – nur Gummi-Explosionen, Einschleimen und Gummibälle, genau wie Leander es sich
//   gewünscht hat.
class BossGiantGummyBear extends Enemy {
    constructor(x, y) {
        super(x, y, 64, 84);
        this.hp = 145;
        this.maxHp = 145;
        this.speed = 35;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.shadow = { rx: 31, ry: 11, dy: 40, alpha: 0.3 };
        this.color = '#ff3d5a';                 // der Riese ist rot – wie ein übergroßes Gummibär
        this.pal = gummyPal(this.color);
        this.fxColor = this.color;
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
        // Gummi-Explosionen
        this.booms = [];
        this.boomIdx = 0;
        this.boomT = 0;
        this.boomHit = [];
        // Einschleimen
        this.slimePts = [];
        // Fächer
        this.fanA = 0;
        this.fanLock = false;
        this.fanFriend = null;
    }

    static room(world) { return CandyArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // Wo der Riese wirft (obere Körperhöhe)
    _muzzle() { return { x: this.centerX(), y: this.y + this.h * 0.32 }; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) { this.booms = []; this.slimePts = []; return; }
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 48;
            this.bigHits = 0;
            CandyArt.burst(mx, my - 18, [this.color, this.pal.hi, CandyCfg.sugar], 26, 210, 0.7, { kind: 'star' });
            CandyArt.ring(mx, my, this.color, 96, 0.6, 6);
            CandyArt.shake(8, 0.45);
        }
        const still = this.state === 'intro' || this.state === 'dizzy';
        if (!still) {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (this.state !== 'boomWind' && this.state !== 'boomPop' && Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'boomWind':
                if (this.stateT <= 0) {
                    this.boomIdx = 0;
                    this.boomT = 0;
                    this.boomHit = [];
                    this._set('boomPop', 0.2 + 0.17 * this.booms.length);
                }
                break;
            case 'boomPop': this._boomPop(dt); break;
            case 'slimeWind':
                if (this.stateT <= 0) {
                    this._throwGlobs();
                    this._set('slimeThrow', 0.45);
                }
                break;
            case 'slimeThrow':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'fanWind':
                if (!this.fanLock) {
                    const near = CandyArt.nearTarget(player, mx, my, 400);
                    if (near) {
                        this.fanA = Math.atan2(near.t.y - my, near.t.x - mx);
                        if (Math.abs(Math.cos(this.fanA)) > 0.2) this.face = Math.cos(this.fanA) > 0 ? 1 : -1;
                    }
                    if (this.stateT <= this.stateDur * 0.3) this.fanLock = true;   // Fächer steht jetzt fest
                }
                if (this.stateT <= 0) {
                    this._fireFan(projectiles);
                    this._set('fanFire', 0.3);
                }
                break;
            case 'fanFire':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'dizzy':
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.5 : 0.85;
                    this._set('walk', 0);
                }
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        CandyArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster großer Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 4.6;
        let vx = 0, vy = 0;
        if (dist > 124) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 64) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool > 0) return;
        const cyc = this.phase === 2 ? BossGiantGummyBear.CYCLE2 : BossGiantGummyBear.CYCLE1;
        const what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'boom') this._startBoom(player, world);
        else if (what === 'slime') this._startSlime(player);
        else if (what === 'fan') this._startFan();
        else this.cool = this.phase === 2 ? 0.45 : 0.9;      // bewusste Verschnaufpause
    }

    // ── a) Gummi-Explosionen: mehrere Warnkreise, dann platschen sie nacheinander ──
    _startBoom(player, world) {
        const n = this.phase === 2 ? 6 : 4;
        const pts = [];
        const cand = CandyArt.targets(player);
        // Erst die Ziele selbst (Mark und die Freunde), dann Punkte um Mark herum – so trifft es niemanden
        // zweimal, und die Kreise sind gut sichtbar verteilt.
        for (const t of cand) {
            if (pts.length >= n) break;
            if (CandyArt.free(world, t.x, t.y, BOOM_R * 0.6)) pts.push({ x: t.x, y: t.y });
        }
        const mid = cand.length ? cand[0] : { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        let versuche = 0;
        while (pts.length < n && versuche++ < 40) {
            const a = Math.random() * TAU, d = randRange(26, 74);
            const x = mid.x + Math.cos(a) * d, y = mid.y + Math.sin(a) * d;
            if (!CandyArt.free(world, x, y, BOOM_R * 0.6)) continue;
            let nah = false;
            for (const p of pts) if (Math.hypot(p.x - x, p.y - y) < BOOM_R * 1.3) { nah = true; break; }
            if (!nah) pts.push({ x, y });
        }
        this.booms = pts;
        this._set('boomWind', this.phase === 2 ? 0.78 : 0.95);
    }

    _boomPop(dt) {
        this.boomT -= dt;
        if (this.boomT <= 0 && this.boomIdx < this.booms.length) {
            const b = this.booms[this.boomIdx++];
            CandyArt.areaHit(b.x, b.y, BOOM_R, 2, 210, this.boomHit);
            CandyArt.ring(b.x, b.y, this.color, BOOM_R + 8, 0.32, 4.2);
            CandyArt.burst(b.x, b.y, [this.color, this.pal.hi, CandyCfg.sugar], 14, 190, 0.5, { kind: 'dot', gravity: 150 });
            CandyArt.burst(b.x, b.y, [this.pal.mid, CandyCfg.sugar], 6, 90, 0.45, { kind: 'smoke', size: 4 });
            CandyArt.shake(3.6, 0.14);
            this.boomT = 0.17;
        }
        if (this.boomIdx >= this.booms.length && this.boomT <= 0) {
            this.booms = [];
            this._afterBig();
        }
    }

    // ── b) Einschleimen: Warnkreis auf Mark und die Freunde, dann fliegt je ein Gummiklex ──
    _startSlime(player) {
        const pts = [];
        if (player && !player.dead) pts.push({ x: player.x + player.w / 2, y: player.y + player.h / 2 });
        const freunde = CandyArt.companions();
        for (let i = 0; i < freunde.length && pts.length < (this.phase === 2 ? 4 : 3); i++) {
            const c = freunde[i];
            pts.push({ x: c.x + (c.w || 20) / 2, y: c.y + (c.h || 20) / 2 });
        }
        this.slimePts = pts;
        this._set('slimeWind', this.phase === 2 ? 0.72 : 0.9);
    }

    _throwGlobs() {
        const list = typeof Game !== 'undefined' ? Game.projectiles : null;
        const m = this._muzzle();
        for (const p of this.slimePts) {
            if (!list || list.length > GUMBALL_CAP) break;
            list.push(new GummyGlob(m.x, m.y, p.x, p.y));
        }
        CandyArt.burst(m.x, m.y, [CandyCfg.slime, CandyCfg.slimeMid, CandyCfg.sugar], 10, 120, 0.4, { kind: 'spark' });
        CandyArt.shake(2.2, 0.12);
        this.slimePts = [];
    }

    // ── c) Fächer: breite Salve Gummibälle ──
    _startFan() {
        this.fanLock = false;
        this.fanFriend = null;
        const opts = CandyArt.companions();
        if (opts.length && Math.random() < 0.7) this.fanFriend = opts[Math.floor(Math.random() * opts.length)];
        this._set('fanWind', this.phase === 2 ? 0.62 : 0.8);
    }

    _fireFan(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const m = this._muzzle();
        if (!list) return;
        const n = this.phase === 2 ? 9 : 7;
        const step = this.phase === 2 ? 0.19 : 0.21;
        for (let i = 0; i < n; i++) {
            if (list.length > GUMBALL_CAP) break;
            list.push(new GummyBall(m.x, m.y, this.fanA + (i - (n - 1) / 2) * step, randRange(154, 174), this.color));
        }
        // Auf einen Freund zielt der Riese zusätzlich – auch der soll Gummibälle abbekommen.
        const fr = this.fanFriend;
        if (fr && !fr.dead && !(fr.koTimer > 0) && list.length <= GUMBALL_CAP) {
            const a = Math.atan2(fr.y + fr.h / 2 - m.y, fr.x + fr.w / 2 - m.x);
            list.push(new GummyBall(m.x, m.y, a, 182, this.color));
        }
        CandyArt.burst(m.x, m.y, [this.color, this.pal.hi, CandyCfg.sugar], 14, 170, 0.42, { kind: 'spark' });
        CandyArt.shake(3.4, 0.16);
    }

    // Nach großen Angriffen: Verschnaufpause – in Phase 2 und vollends bei wenig Leben wird er schwindelig.
    _afterBig() {
        this.bigHits++;
        const low = this.hp <= this.maxHp * 0.3;
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', low ? 2.4 : 1.7);
            CandyArt.burst(this.centerX(), this.y + 14, ['#ffe35a', CandyCfg.sugar], 11, 95, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.55 : 0.95;
        this._set('pant', this.cool + 0.4);
    }

    // Ansagen am Boden: Warnkreise der Explosionen, grüne Kleckskreise, Wurfstrahlen des Fächers –
    // immer vor allen Figuren, damit das Kind genau sieht, wo gleich was passiert.
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const k = this._k();
        const m = this._muzzle();
        if (st === 'boomWind' || st === 'boomPop') {
            for (let i = 0; i < this.booms.length; i++) {
                if (st === 'boomPop' && i < this.boomIdx) continue;      // die einen platschen nicht mehr
                const p = camera.worldToScreen(this.booms[i].x, this.booms[i].y);
                LateWorldArt.warn(ctx, p.x, p.y, BOOM_R, st === 'boomWind' ? k : 1, CandyCfg.warnHot);
            }
            return;
        }
        if (st === 'slimeWind') {
            for (const p0 of this.slimePts) {
                const p = camera.worldToScreen(p0.x, p0.y);
                LateWorldArt.warn(ctx, p.x, p.y, SLIME_R, k, CandyCfg.warnSlime);
            }
            return;
        }
        if (st === 'fanWind') {
            const p = camera.worldToScreen(m.x, m.y);
            const n = this.phase === 2 ? 9 : 7;
            const step = this.phase === 2 ? 0.19 : 0.21;
            // Angesagt wird genau die breite Salve, die gleich fliegt (Ansage = Treffer).
            for (let i = 0; i < n; i++) {
                LateWorldArt.lane(ctx, p.x, p.y, this.fanA + (i - (n - 1) / 2) * step, 168, 15, k, CandyCfg.warn);
            }
            return;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, foot - 28);
            ctx.translate(cx, foot);
            this._body(ctx, true);
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
    }

    // Riesen-Gummibär: dieselbe Figur wie die kleinen, 2,6-mal so groß; Phase 2 mit Dellen,
    // dunklerem Gummi und rotem Leuchten.
    _body(ctx, dead) {
        const S = 2.6;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const boomWind = st === 'boomWind';
        const boomPop = st === 'boomPop';
        const slimeWind = st === 'slimeWind';
        const slimeThrow = st === 'slimeThrow';
        const fanWind = st === 'fanWind';
        const fanFire = st === 'fanFire';
        const low = this.hp <= this.maxHp * 0.35;
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const wob = (boomWind || boomPop) ? Math.sin(t * 17) * 1.5 : (slimeWind ? Math.sin(t * 12) * 1.2 : 0);
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.0 : Math.sin(t * 1.8) * 0.9)
            + (fanFire ? -1.4 : 0) - (rest ? 1.3 : 0) + (boomPop ? Math.abs(Math.sin(t * 20)) * 1.2 : 0);
        const squash = dead ? 0 : (boomWind ? k * 0.7 : 0) + (boomPop ? -0.5 : 0) + (fanWind ? k * 0.5 : 0)
            + (slimeThrow ? -0.4 : 0);
        const lean = dead ? 0 : (fanWind ? k * 3 : 0) + (fanFire ? -3.0 : 0) + wob
            + (boomWind ? -k * 1.6 : 0) + (slimeWind ? k * 1.4 : 0) + (dizzy ? Math.sin(t * 4) * 2.2 : 0);
        // Arme: beim Holz holen weit hoch, nach dem Wurf weit vorn, im Schwindel kraftlos runter
        let hb = { x: -16 + wob, y: -18 + Math.max(0, -walk) * 2 };
        let hf = { x: 16 - wob, y: -18 - Math.max(0, walk) * 2 };
        if (boomWind || slimeWind) { hb = { x: -9 - k * 8, y: -32 - k * 7 }; hf = { x: -1 - k * 9, y: -34 - k * 8 }; }
        else if (boomPop) { hb = { x: -19, y: -30 }; hf = { x: 19, y: -30 }; }
        else if (fanWind) { hb = { x: -7 - k * 9, y: -33 - k * 6 }; hf = { x: 0 - k * 9, y: -35 - k * 7 }; }
        else if (fanFire || slimeThrow) { hb = { x: -13, y: -24 }; hf = { x: 22, y: -28 }; }
        else if (dizzy) { hb = { x: -19 + Math.sin(t * 5) * 2, y: -12 }; hf = { x: 19 + Math.sin(t * 5 + 1) * 2, y: -12 }; }
        else if (rest) { hb = { x: -14, y: -10 }; hf = { x: 14, y: -10 }; }
        ctx.save();
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, -19, 28, this.color, 0.18 * this.angry + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (boomWind || boomPop || slimeWind || slimeThrow || fanWind || fanFire) ? 'open'
                : (rest || low) ? 'tired' : 'angry';
        const f = CandyArt.figure(ctx, {
            c: this.pal, lw: 0.72, t, bob, lean, squash, mood,
            arms: { b: hb, f: hf },
            ball: !!(fanWind || (slimeThrow && Math.sin(t * 5) > 0)),
            dents: p2 && !dead,
            look: { x: this.look.x * this.face, y: this.look.y },
            a: 0.9,
        });
        if (p2 && !dead && !dizzy) Art.glow(ctx, f.hx, f.hy - 1, 8, '#ff9f1c', 0.3 + 0.2 * Math.sin(t * 9));
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, f.hx * this.face * S, f.hy * S - 16, 26, 4.6);
        // Zuckerkrümel und Glanz: der Riese glänzt wie ein Bonbon
        if (!dead && (boomWind || boomPop)) {
            const prev = ctx.globalAlpha;
            for (let i = 0; i < 4; i++) {
                const a = t * 2.2 + (i * TAU) / 4;
                Art.sparkle(ctx, Math.cos(a) * 42, -54 + Math.sin(a) * 14, 3.2, CandyCfg.sugar,
                    0.35 + 0.25 * Math.sin(t * 6 + i));
            }
            ctx.globalAlpha = prev;
        }
    }
}

BossGiantGummyBear.CYCLE1 = ['boom', 'slime', 'fan', 'walk'];
BossGiantGummyBear.CYCLE2 = ['boom', 'slime', 'boom', 'fan', 'walk'];
