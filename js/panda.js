// ── Welt 47: Bambuswald (Idee von Leander) ──
// Faule Pandas, die aus einem Bambusrohr vergiftete Pflanzen pusten – und zwar SEHR langsam (Leander).
//   Schwarzes Fell an Ohren, Augenflecken, Armen und Beinen, weißer Rumpf und Kopf, runde Ohren,
//   Stupsnase: ein Kind erkennt den Panda auf den ersten Blick.
//   Der Schlüsselträger ist braun-weiß und trägt ein rotes Stirnband. Der spätere Panda-FREUND ist
//   eine eigene Figur mit grünem Halstuch – die feindlichen Pandas hier tragen es bewusst nicht.
//   Jeder Angriff wird angesagt: grüne, wachsende Ziellinie vor dem Rohr, roter Kreis vor dem Schlag.
//   Getroffene pflanzen Gift: Mark, Juri und das Schattenkrokodil verlieren langsam Leben (poison).
// Boss: GROßER PANDA – Endgegner von Welt 47, bleibt im Boss-Raum, 140 LP, zwei Phasen.
//   Peitscht mit einem Riesen-Bambusstock: Halbkreis-Wurf (Phase 1) bzw. ganzer Kreis (Phase 2), vorher
//     zeigt die gewarnte Sektorfläche genau den Bereich, durch den der Stock nachher fährt.
//   Stich: der Stock schnellt auf einen Punkt am Boden – roter Warnkreis vorher.
//   Giftpflanzen: aus der offenen Stockspitze (eins, in Phase 2 drei mit Spreizung), Ziellinie vorher.
//   Mit wenig Leben (unter halben LP in Phase 2, unter gut drei Zehntel ständig) wird er schwindelig:
//     Sterne um den Kopf, kurz wehrlos – das ist Marks Zeit zum Zurückschlagen.
//   Freunde verschwinden nie: ein tödlicher Treffer haut Juri und das Krokodil nur um (knockOut).

const PandaCfg = {
    light: '#f4f3ea',           // helles Fell (Rumpf, Kopf)
    lightMid: '#e6e5d9',
    belly: '#fdfdf6',
    dark: '#37373f',            // dunkles Fell (Ohren, Flecken, Arme, Beine)
    darkMid: '#2c2c34',
    darkDark: '#20202a',
    keyLight: '#f8ecd4',        // Schluesseltraeger: braun-weiss statt schwarz-weiss
    keyBelly: '#fff8e8',
    keyDark: '#7d5533',
    keyDarkMid: '#6a4527',
    band: '#e2413f',            // rotes Stirnband
    bandDark: '#a8292c',
    nose: '#1b1522',
    bamboo: '#84cf4e',          // Bambus (Rohr und Riesenstock)
    bambooMid: '#63ab39',
    bambooDark: '#3d7a26',
    leaf: '#57c247',
    poison: '#7dff5a',          // Gift (wie Gift-Tropfen von Mark und den Freunden)
    poisonBulb: '#a8d94f',
    poisonDark: '#2f8f2c',
    warn: '#ff5a3d',            // roter Warnkreis (Nahkampf)
    warnGreen: '#8fe04a',       // grüne Ziellinien (Giftschuss – Kinder lernen: grün = Gift)
    dust: '#e8e2c8',
};

// Zwei Fellpaletten: schwarz-weiss (alle) und braun-weiss (Schlüsselträger)
const P_BLACK = { light: PandaCfg.light, belly: PandaCfg.belly, dark: PandaCfg.dark, darkMid: PandaCfg.darkMid };
const P_KEY = { light: PandaCfg.keyLight, belly: PandaCfg.keyBelly, dark: PandaCfg.keyDark, darkMid: PandaCfg.keyDarkMid };
const P_BOSS = { light: PandaCfg.light, belly: PandaCfg.belly, dark: PandaCfg.dark, darkMid: PandaCfg.darkMid };

const PandaArt = {
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
        if (c.iFrames > 0) return;                      // Schonzeit direkt nach einem Treffer
        if (c.hp - amount <= 0) c.knockOut(7);
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [PandaCfg.darkMid, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
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

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    },

    // Boss in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    // Winkel nach Normieren (-PI .. PI)
    ang(a) {
        let v = a;
        while (v > Math.PI) v -= TAU;
        while (v < -Math.PI) v += TAU;
        return v;
    },

    // Giftpflanze aus dem Rohr: eigenes Geschoß, das Gift setzt (Mark, Juri und Krokodil).
    plant(x, y, angle, o) {
        if (typeof Game === 'undefined' || !Game.projectiles) return null;
        const p = new PoisonPlant(x, y, Math.cos(angle) * (o.speed || 148), Math.sin(angle) * (o.speed || 148),
            o.poison || 2.5, o.damage || 1);
        Game.projectiles.push(p);
        return p;
    },

    // ── Warnung in Form eines Sektors (Stockschwung) oder Rings (ganzer Kreis) ──
    // from = Anfangswinkel auf dem Schirm, span = Winkelbreite (negativ = gegen den Uhrzeigersinn).
    sector(ctx, x, y, r0, r1, from, span, k, color) {
        ctx.save();
        const prev = ctx.globalAlpha;
        const pulse = 0.5 + 0.5 * Math.sin(Art.time * 15);
        const path = (rr0, rr1) => {
            ctx.beginPath();
            ctx.arc(x, y, rr1, from, from + span, span < 0);
            if (rr0 > 0.5) ctx.arc(x, y, rr0, from + span, from, span > 0);
            ctx.closePath();
        };
        ctx.fillStyle = color;
        ctx.globalAlpha = prev * (0.1 + 0.13 * clamp(k, 0, 1));
        path(r0, r1);
        ctx.fill();
        ctx.globalAlpha = prev * (0.5 + 0.4 * pulse);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.lineJoin = 'round';
        path(r0, r1);
        ctx.stroke();
        // Wanderteilen zeigen die Drehrichtung des Stocks
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const f of [0.28, 0.6, 0.92]) {
            const w = (f + Art.time * 0.55 * Math.sign(span || 1)) % 1;
            const a = from + span * (w < 0 ? w + 1 : w);
            const dr = (r0 + r1) / 2;
            const px = x + Math.cos(a) * dr, py = y + Math.sin(a) * dr;
            const ta = a + (span >= 0 ? Math.PI / 2 : -Math.PI / 2);
            for (const s of [-1, 1]) {
                ctx.moveTo(px + Math.cos(ta + s * 2.5) * 5, py + Math.sin(ta + s * 2.5) * 5);
                ctx.lineTo(px + Math.cos(ta) * 7, py + Math.sin(ta) * 7);
            }
        }
        ctx.globalAlpha = prev * (0.45 + 0.3 * pulse);
        ctx.stroke();
        ctx.restore();
    },

    // ── Bambus-Stange (Rohr des Pandas, Riesenstock des Bosses) ──
    // Griffpunkt (o.x, o.y), Richtung o.a (Winkel in der Zeichenebene des Aufrufers),
    // hinten o.back und vorn o.front Einheiten lang, o.thick = Dicke.
    tool(ctx, o) {
        const dx = Math.cos(o.a), dy = Math.sin(o.a);
        const nx = -dy, ny = dx;
        Art.limb(ctx, o.x - dx * o.back, o.y - dy * o.back, o.x + dx * o.front, o.y + dy * o.front,
            o.thick, PandaCfg.bamboo, { lineWidth: o.lw, outline: Art.ink(PandaCfg.bambooMid) });
        // Lichtseite oben
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = Math.max(0.7, o.thick * 0.22);
        ctx.beginPath();
        ctx.moveTo(o.x - dx * o.back + nx * o.thick * 0.24, o.y - dy * o.back + ny * o.thick * 0.24);
        ctx.lineTo(o.x + dx * (o.front - 2) + nx * o.thick * 0.24, o.y + dy * (o.front - 2) + ny * o.thick * 0.24);
        ctx.stroke();
        // Bambus-Gelenke
        ctx.strokeStyle = PandaCfg.bambooDark;
        ctx.lineWidth = Math.max(0.8, o.thick * 0.2);
        ctx.lineCap = 'butt';
        const step = o.step || Math.max(8, o.thick * 1.9);
        for (let s = -o.back + step * 0.7; s < o.front - step * 0.4; s += step) {
            const px = o.x + dx * s, py = o.y + dy * s;
            ctx.beginPath();
            ctx.moveTo(px + nx * o.thick * 0.44, py + ny * o.thick * 0.44);
            ctx.lineTo(px - nx * o.thick * 0.44, py - ny * o.thick * 0.44);
            ctx.stroke();
        }
        ctx.lineCap = 'round';
        // Offene Mündung vorn (dunkles Loch) – daraus kommen die Giftpflanzen
        const mx = o.x + dx * o.front, my = o.y + dy * o.front;
        Art.body(ctx, mx, my, o.thick * 0.5, o.thick * 0.5, PandaCfg.bambooMid, { lineWidth: o.lw * 0.8 });
        ctx.fillStyle = '#2a1f12';
        ctx.beginPath();
        ctx.ellipse(mx, my, o.thick * 0.26, o.thick * 0.3, o.a, 0, TAU);
        ctx.fill();
        if (o.glow > 0) Art.glow(ctx, mx, my, o.thick * (1.4 + o.glow), PandaCfg.poison, 0.35 + 0.5 * o.glow);
        // Blattbusch am hinteren Ende (peitscht sichtbar mit)
        if (o.leaves) {
            const bx = o.x - dx * (o.back + 1), by = o.y - dy * (o.back + 1);
            for (const s of [-1, 0.35, 1]) {
                const la = o.a + Math.PI + s * 0.62 + Math.sin((o.t || 0) * 2.4 + s) * 0.12;
                const lx = bx + Math.cos(la) * o.thick * 1.5, ly = by + Math.sin(la) * o.thick * 1.5;
                Art.body(ctx, lx, ly, o.thick * 1.5, o.thick * 0.52, PandaCfg.leaf, { rot: la, lineWidth: o.lw * 0.8 });
            }
        }
    },

    // ── Ganze Figur: Panda von vorn, leicht in Blickrichtung gedreht, Fußpunkt (0, 0).
    // Eine Einheit = normaler Panda; der Boss zeichnet dieselbe Figur größer (ctx.scale vorher).
    // p = { c, lw, t, bob, walk, hands: { b: {x,y}, f: {x,y} }, legLift, mood, look, band (rotes
    //       Stirnband), leafTuft (Blattbüschel auf dem Kopf), toolGlow, tired }
    figure(ctx, p) {
        const c = p.c, lw = p.lw;
        const t = p.t || 0;
        const hip = -9 - p.bob;
        const mood = p.mood || 'calm';
        const look = p.look || { x: 0, y: 0 };
        // Beine: kurz, dunkel, breite Pfoten mit Zehen
        for (const s of [-1, 1]) {
            const lift = ((p.legLift && p.legLift[s > 0 ? 1 : 0]) || 0) + Math.max(0, s * (p.walk || 0)) * 2.1;
            const fx = s * 6.4;
            Art.limb(ctx, s * 3.8, hip - 2.4, fx, -3.8 - lift, 7, c.darkMid, { lineWidth: lw });
            Art.body(ctx, fx + s * 1.2, -2.4 - lift, 5.3, 2.8, c.dark, { lineWidth: lw });
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = lw * 0.6;
            ctx.beginPath();
            for (const d of [-1.7, 0, 1.7]) {
                ctx.moveTo(fx + s * 2.6 + d, -3.4 - lift);
                ctx.lineTo(fx + s * 4.2 + d, -3.1 - lift);
            }
            ctx.stroke();
        }
        // Rumpf: rund, weisses Fell, heller Bauch, dunkle Schultern (vordere Gliedmassen sind schwarz)
        const bc = hip - 13.5;
        Art.body(ctx, 0, bc, 13.2, 13.8, c.light, { glossy: true, lineWidth: lw });
        Art.body(ctx, 1.8, bc + 3.6, 8.6, 8.4, c.belly, { highlight: false, lineWidth: lw * 0.7 });
        for (const s of [-1, 1]) Art.body(ctx, s * 9.6, bc - 5.6, 5.4, 4.8, c.dark, { highlight: false, lineWidth: lw * 0.8 });
        if (p.leafStick) {
            // angebissenes Bambusblatt am Bauch (Beute-Rest, macht den Panda lebendig)
            Art.body(ctx, -6.4, bc + 6.6, 3.1, 1.3, PandaCfg.leaf, { rot: -0.5, lineWidth: lw * 0.7 });
            Art.body(ctx, -8.6, bc + 7.6, 1.5, 0.8, PandaCfg.bambooMid, { rot: 0.3, lineWidth: lw * 0.6 });
        }
        // Arme: aus der dunklen Schulter zur Pfote (Griff sitzt an der Stange)
        const arm = (s, h, col) => {
            const sx = s * 9.8, sy = bc - 5;
            const mx = (sx + h.x) / 2 + s * 2.2, my = (sy + h.y) / 2 + 1.8;
            Art.limb(ctx, sx, sy, mx, my, 6.6, col, { lineWidth: lw });
            Art.limb(ctx, mx, my, h.x, h.y, 5.8, col, { lineWidth: lw });
            Art.body(ctx, h.x, h.y, 4.1, 3.7, c.dark, { lineWidth: lw });
        };
        arm(-1, p.hands.b, c.darkMid);
        arm(1, p.hands.f, c.dark);
        // Kopf: rund, weisse Grundfarbe, schwarze Ohren, schwarze Augenflecken
        const hx = 1.4, hy = hip - 30.5 + (p.headDy || 0);
        for (const s of [-1, 1]) Art.body(ctx, hx + s * 7.5, hy - 7.4, 4.3, 4.1, c.dark, { lineWidth: lw });
        Art.body(ctx, hx, hy, 10.8, 10, c.light, { glossy: true, lineWidth: lw });
        for (const s of [-1, 1]) {
            Art.body(ctx, hx + s * 4.5, hy - 0.6, 3.7, 4.6, c.dark, { rot: -s * 0.4, highlight: false, lineWidth: lw * 0.8 });
        }
        // Rotes Stirnband (nur Schlüsselträger) – mit Knoten und wehenden Zipfeln
        if (p.band) {
            Art.limb(ctx, hx - 9.3, hy - 3.4, hx + 9.5, hy - 4.6, 3.4, PandaCfg.band, { lineWidth: lw });
            Art.limb(ctx, hx - 8.2, hy - 4.2, hx + 8.6, hy - 5.4, 1.1, Art.light(PandaCfg.band, 0.4), { outline: false });
            Art.body(ctx, hx - 9.8, hy - 4.4, 2.1, 1.6, PandaCfg.band, { rot: 0.5, lineWidth: lw * 0.8 });
            const flap = Math.sin(t * 5.2) * 1.2;
            Art.limb(ctx, hx - 10.2, hy - 4, hx - 14.6, hy - 1.2 + flap, 1.9, PandaCfg.band, { lineWidth: lw });
            Art.limb(ctx, hx - 10.2, hy - 5.1, hx - 13.8, hy - 6.8 - flap, 1.6, PandaCfg.bandDark, { lineWidth: lw });
        }
        // Blattbüschel auf dem Kopf (Kennzeichen des Großen Pandas)
        if (p.leafTuft) {
            for (const s of [-1, 0.4]) {
                const la = -Math.PI / 2 + s * 0.75 + Math.sin(t * 2 + s) * 0.1;
                Art.body(ctx, hx + Math.cos(la) * 3.4, hy - 10.4 + Math.sin(la) * 3, 3.4, 1.3, PandaCfg.leaf, { rot: la, lineWidth: lw * 0.7 });
            }
        }
        // Schnauze: helle Partie, schwarze Stupsnase, Mund
        Art.body(ctx, hx + 0.5, hy + 4.7, 4.9, 3.5, c.belly, { highlight: false, lineWidth: lw * 0.7 });
        Art.body(ctx, hx + 0.5, hy + 3.3, 2.3, 1.6, PandaCfg.nose, { highlight: false, outline: false });
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, hx, hy - 0.9, 1.6, 4.5);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.85;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.2 + i * 0.1;
                    const x = hx + s * 4.5 + Math.cos(a) * r, y = hy - 0.9 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, hx + s * 4.5, hy - 0.9, 1.85, { x: look.x, y: look.y }, {
                    angry: mood !== 'tired' && mood !== 'hurt', side: s < 0 ? 'left' : 'right',
                    iris: p.red ? '#ff3b3b' : '#5a3316', open: mood === 'tired' ? 0.55 : 1, sclera: '#ffffff',
                });
            }
        }
        Art.mouth(ctx, hx + 0.5, hy + 7.6, 3.8,
            mood === 'open' ? 'teeth' : (mood === 'dizzy' || mood === 'tired') ? 'o' : mood === 'calm' ? 'smile' : 'angry');
        return { hx, hy, bc, hip };
    },
};

// ══════════════════════════════════════════
// ── Giftpflanze (Geschoß aus Bambusrohr und Stockspitze) ──
// ══════════════════════════════════════════

// Fliegt wirbelnd geradeaus, platzt an der Wand und setzt Gift frei, wenn es Mark, Juri oder das
// Schattenkrokodil trifft. Gift wirkt wie im Gerüst vorgesehen: es zieht langsam Leben ab, macht aber
// nicht langsamer; bei den Freunden bleibt mindestens ein Lebenspunkt (kein K.o. durch Gift).
class PoisonPlant extends Projectile {
    constructor(x, y, vx, vy, poisonSec, damage) {
        super(x, y, vx, vy, damage || 1, 'enemy', 95);
        this.radius = 7;
        this.lifetime = 2.9;
        this.poisonSec = poisonSec || 2.5;
        this.seed = Math.random() * 10;
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) { this._splat(); return; }
        const player = typeof Game !== 'undefined' ? Game.player : null;
        if (player && !player.dead && !player.dodging) {
            const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
            if (Math.hypot(this.x - cx, this.y - cy) < this.radius + player.w / 2) {
                PandaArt.hurt(player, this.damage, Math.atan2(this.vy, this.vx), 110);
                player.poison(this.poisonSec);
                this._splat();
                this.dead = true;
                return;
            }
        }
        for (const c of PandaArt.companions()) {
            const w = c.w || 20, h = c.h || 20;
            if (Math.hypot(this.x - (c.x + w / 2), this.y - (c.y + h / 2)) >= this.radius + Math.max(w, h) / 2) continue;
            c.poison(this.poisonSec);
            PandaArt.hitCompanion(c, this.damage);
            this._splat();
            this.dead = true;
            return;
        }
        if (typeof FX !== 'undefined' && Math.random() < dt * 26) {
            FX.burst(this.x, this.y, [PandaCfg.poison], 1, 18, 0.45, { kind: 'bubble' });
        }
    }

    _splat() {
        PandaArt.burst(this.x, this.y, [PandaCfg.poison, '#c8ffb0', PandaCfg.poisonDark], 9, 120, 0.42, { kind: 'spark' });
        PandaArt.burst(this.x, this.y, 'rgba(140,230,110,0.75)', 3, 55, 0.5, { kind: 'smoke', size: 5 });
        PandaArt.ring(this.x, this.y, PandaCfg.poison, 16, 0.24, 2.6);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time + this.seed;
        const sp = Math.hypot(this.vx, this.vy);
        const a = (sp > 1 ? Math.atan2(this.vy, this.vx) : 0) + Math.sin(t * 9) * 0.4;
        ctx.save();
        ctx.translate(p.x, p.y);
        LateWorldArt._trail(ctx, 0, 0, this.vx, this.vy, 8, PandaCfg.poison);
        ctx.rotate(a);
        Art.glow(ctx, 0, 0, 14, PandaCfg.poison, 0.55);
        for (const s of [-1, 1]) {
            Art.body(ctx, -3.6, s * 3.3, 4, 1.9, PandaCfg.leaf, { rot: s * 0.6 + Math.sin(t * 8) * 0.15, lineWidth: 1.1 });
        }
        Art.body(ctx, 1.1, 0, 5.5, 4.7, PandaCfg.poisonBulb, { glossy: true, lineWidth: 1.3 });
        Art.body(ctx, 3.6, 0.4, 2.7, 2.6, PandaCfg.poison, { highlight: false, lineWidth: 1.1 });
        Art.shine(ctx, -0.5, -2, 1.8, 1.1, -0.5, 0.7);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Normaler Panda (Bambusrohr) ──
// ══════════════════════════════════════════

// Sehr langsamer Panda mit Bambusrohr: hält Abstand und pustet von weitem eine Giftpflanze drauflos
//   (grüne Ziellinie vorher, dann der Schuss). Kommt Mark zu nah, haut er mit dem Rohr drauf –
//   roter Warnkreis vorher. Bei halben LP schaut er grimmig.
class BambooPanda extends Enemy {
    constructor(x, y) {
        super(x, y, 32, 30);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(20, 27);      // sehr langsam – Leanders ausdrücklicher Wunsch
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.fxColor = PandaCfg.bamboo;
        this.seed = Math.random() * 10;
        this.detectionRange = 235;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'idle';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2.1);
        this.step = 0;
        this.moving = false;
        this.brown = false;                 // Schlüsselträger: braunes Fell, rotes Stirnband
        this.aim = null;                    // {x, y} Ziel des Schusses oder Schlages
        this.hit = [];                      // bereits getroffene Ziele des laufenden Angriffs
        this.lane = null;                   // {x, y, a, len} angesagte Schusslinie
        this.toolA = -0.2;                  // Rohrwinkel (lokaler Winkel, +x = Blickrichtung)
        this.recoil = 0;
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.brown ? P_KEY : P_BLACK; }

    // Rohr­spitze in Weltkoordinaten – identische Quelle für Warnlinie, Einschuss und Zeichnung
    _muzzle() {
        const a = this._worldA(this.toolA);
        const gx = this.centerX() + this.face * 2, gy = this.y + this.h - 23;      // Griff vor der Brust
        return { x: gx + Math.cos(a) * 23, y: gy + Math.sin(a) * 23, a, gx, gy };
    }

    // lokaler (blickrichtungsbezogener) Winkel -> Winkel auf dem Schirm
    _worldA(a) { return Math.atan2(Math.sin(a), Math.cos(a) * this.face); }

    // Rohr-Winkel je Zustand: nur für das Bild. toolA selbst bleibt der gesetzte Zielwinkel,
    // sonst würde der Zustands-Offset in jeder Folgezeichnung noch einmal obendrauf kommen.
    _tool() {
        const t = Art.time + this.seed;
        const k = this._k();
        let a;
        switch (this.state) {
            case 'aim': a = this.toolA; break;                  // starr aufs Ziel gerichtet
            case 'shoot': a = this.toolA + 0.12; break;
            case 'bonkWind': a = this.toolA - 0.75 * k; break;  // weit ausgeholt
            case 'bonk': a = this.toolA + 0.5; break;
            case 'huff': a = -0.95 - Math.sin(t * 9) * 0.1; break;
            default: a = -0.2 + Math.sin(t * 1.4) * 0.06;       // locker über der Schulter
        }
        return a + this.recoil * 0.35;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): braun-weiss, rotes Stirnband, zäher
            this._keyInit = true;
            this.brown = true;
            this.hp = this.maxHp = 10;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.recoil = Math.max(0, this.recoil - dt * 5);
        this.moving = false;
        if (this.state !== 'shoot') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('huff', 0.9);     // aufstellen und das Rohr heben, damit Kinder ihn erst sehen
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'huff':
                if (this.stateT <= 0) this._set('idle', 0);
                break;
            case 'aim':
                if (this.stateT <= 0) {
                    this._fire();
                    this._set('shoot', 0.26);
                }
                break;
            case 'shoot':
                if (this.stateT <= 0) {
                    this.cool = this.brown ? randRange(1.7, 2.3) : randRange(2.3, 3.1);
                    this.lane = null;
                    this._set('idle', 0);
                }
                break;
            case 'bonkWind':
                if (this.stateT <= 0) {
                    this._bonkHit();
                    this._set('bonk', 0.2);
                }
                break;
            case 'bonk':
                if (this.stateT <= 0) {
                    this.cool = this.brown ? randRange(1.3, 1.9) : randRange(1.8, 2.4);
                    this._set('idle', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: sehr langsam näher rücken, dann Angriff wählen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 1.4;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.3 * dt, Math.cos(this.step * 0.7) * this.speed * 0.3 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 128) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 44) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 4.2;
            if (Math.abs(dx) > 5) this.face = dx > 0 ? 1 : -1;
        } else this.step += dt * 1.3;
        if (this.cool > 0) return;
        if (dist < 62) { this._startBonk(player); return; }
        if (dist < 215) { this._startAim(world, player, dx, dy); return; }
        this.cool = 0.5;
    }

    // Schuss ansagen: Rohr auf das Ziel richten, grüne Ziellinie wächst von der Rohrspitze weg
    _startAim(world, player, dx, dy) {
        this.aim = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
        this.toolA = Math.atan2(dy, dx * this.face);
        const m = this._muzzle();
        const a = Math.atan2(this.aim.y - m.y, this.aim.x - m.x);
        this.lane = { x: m.x, y: m.y, a, len: Kit915.laneLength(this, Math.cos(a), Math.sin(a), world, 230) };
        this._set('aim', this.brown ? 0.62 : 0.78);
    }

    _fire() {
        const m = this._muzzle();
        const a = this.lane ? this.lane.a : m.a;
        PandaArt.plant(m.x, m.y, a, { poison: this.brown ? 3 : 2.5, damage: 1, speed: this.brown ? 165 : 148 });
        this.recoil = 1;
        PandaArt.burst(m.x, m.y, [PandaCfg.poison, '#c8ffb0', PandaCfg.bamboo], 7, 110, 0.34, { kind: 'spark' });
        PandaArt.burst(m.x, m.y, 'rgba(150,235,120,0.7)', 3, 45, 0.45, { kind: 'smoke', size: 4 });
        PandaArt.shake(1.8, 0.1);
    }

    // Schlag aus der Nähe: der rote Kreis zeigt genau die Stelle, die nachher getroffen wird
    _startBonk(player) {
        const mx = this.centerX(), my = this.centerY();
        let best = null;
        for (const q of PandaArt.targets(player)) {
            const d = Math.hypot(q.x - mx, q.y - my);
            if (d < 92 && (!best || d < best.d)) best = { q, d };
        }
        this.aim = best ? { x: best.q.x, y: best.q.y } : { x: mx + this.face * 28, y: my };
        if (Math.abs(this.aim.x - mx) > 3) this.face = this.aim.x > mx ? 1 : -1;
        this.toolA = Math.atan2(this.aim.y - (this.y + this.h - 23), (this.aim.x - (this.centerX() + this.face * 2)) * this.face);
        this.hit = [];
        this._set('bonkWind', this.brown ? 0.4 : 0.52);
    }

    _bonkHit() {
        const a = this.aim || { x: this.centerX() + this.face * 24, y: this.centerY() };
        PandaArt.areaHit(a.x, a.y, 26, this.damage + 1, 200, this.hit);
        PandaArt.shake(2.8, 0.12);
        PandaArt.burst(a.x, a.y, [PandaCfg.bamboo, '#ffffff', PandaCfg.leaf], 8, 150, 0.34, { kind: 'spark' });
        PandaArt.ring(a.x, a.y, PandaCfg.bamboo, 26, 0.22, 3.2);
    }

    // Ansagen auf dem Boden (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if ((st === 'aim' || st === 'shoot') && this.lane) {
            const p = camera.worldToScreen(this.lane.x, this.lane.y);
            LateWorldArt.lane(ctx, p.x, p.y, this.lane.a, this.lane.len, 15, st === 'shoot' ? 1 : this._k(), PandaCfg.warnGreen);
            return;
        }
        if (st === 'bonkWind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 26, this._k(), PandaCfg.warn);
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
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 15 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Panda mit Fußpunkt (0, 0); Bambusrohr wird in derselben (blickrichtungsbezogenen) Ebene gezeichnet
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const wind = st === 'bonkWind' ? k : 0;
        const bonk = st === 'bonk';
        const aim = st === 'aim';
        const huff = st === 'huff';
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 1.7) * 0.7) + (huff ? 1.2 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 1.7) * 0.015) + (bonk ? 0.03 : 0);
        const hip = -9 - bob;
        // Rohr: Winkel kommt aus _tool() – toolA bleibt der Zielwinkel, der Zustand verschiebt ihn nur hier
        const a = this._tool();
        const gx = 2, gy = hip - 14;                       // Griff vor der Brust
        const dx = Math.cos(a), dy = Math.sin(a);
        const hands = { f: { x: gx + dx * 9, y: gy + dy * 9 }, b: { x: gx - dx * 5, y: gy - dy * 5 } };
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, hip - 14, 26, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (bonk || wind || aim) ? 'open' : tired ? 'tired' : this._engaged ? 'angry' : 'calm';
        PandaArt.figure(ctx, {
            c, lw: 1.2, t, bob, walk, hands, mood,
            look: { x: this.look.x * this.face, y: this.look.y },
            band: this.brown, leafStick: !dead && !this.brown,
            headDy: huff ? -1.2 : 0,
        });
        PandaArt.tool(ctx, {
            x: gx, y: gy, a, back: 6, front: 23, thick: 5.6, lw: 1.2, t,
            glow: (aim ? 0.35 + 0.65 * k : 0) + (st === 'shoot' ? 0.8 : 0),
        });
        if (bonk && !dead) Art.glow(ctx, gx + dx * 22, gy + dy * 22, 13, '#ffe6b8', 0.45);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: GROSSER PANDA (Endgegner Welt 47) ──
// ══════════════════════════════════════════

// Riesiger Panda mit einem Riesen-Bambusstock. 140 LP, zwei Phasen, bleibt im Boss-Raum.
//   Stockschwung: Halbkreis (Phase 1) bzw. ganzer Kreis (Phase 2) – die gewarnte Sektorfläche ist
//     exakt der Bereich, durch den der Stock nachher fährt.
//   Stich: der Stock schnellt auf einen angesagten Punkt am Boden.
//   Giftpflanzen: aus der offenen Stockspitze (Phase 2: drei mit Spreizung), grüne Ziellinie vorher.
//   Mit wenig Leben wird er schwindelig (Sterne, kurz wehrlos) – Marks Zeit zum Zurückhauen.
class BossGiantPanda extends Enemy {
    constructor(x, y) {
        super(x, y, 92, 86);
        this.hp = 140;
        this.maxHp = 140;
        this.speed = 34;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;
        this.phasesThroughWalls = false;
        this.shadow = { rx: 42, ry: 13, dy: 40, alpha: 0.32 };
        this.fxColor = PandaCfg.bamboo;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.cool = 0.8;
        this.step = 0;
        this.moving = false;
        this.stickA = -2.1;                 // Stockwinkel (blickrichtungsbezogen)
        this.sweep0 = 0;
        this.sweep1 = 0;
        this.spin = false;
        this.hitList = [];
        this.aim = null;                    // {x, y} Stichpunkt
        this.volleys = null;                // [{a, len}] angesagte Schusslinien
        this.bigHits = 0;
        this.angry = 0;
        this.recoil = 0;
    }

    static room(world) { return PandaArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // blickrichtungsbezogener Winkel -> Winkel auf dem Schirm
    _sa(a) { return this.face > 0 ? a : Math.PI - a; }

    // Stockwinkel (blickrichtungsbezogen) je Zustand – eine Quelle für Warnung, Schaden und Bild
    _stick() {
        const t = Art.time + this.seed;
        switch (this.state) {
            case 'sweepWind':
            case 'spinWind':
            case 'sweep':
            case 'spin':
            case 'jabWind':
            case 'jab':
            case 'volleyWind':
                return this.stickA;                             // setzt der Zustandsautomat
            case 'shoot':
                return this.stickA + this.recoil * 0.14;        // Rückstoß nach dem Schuss
            case 'dizzy':
                return 1.35 + Math.sin(t * 3.4) * 0.3;          // die Spitze schleift am Boden
            case 'intro':
                return -2.6 + this._k() * 0.6;                  // er hebt den Stock über den Kopf
            default:
                return -2.1 + Math.sin(t * 1.3) * 0.07;         // locker über der Schulter
        }
    }

    // Drehpunkt des Stocks in Weltkoordinaten – für Warnung, Schaden UND Zeichnung identisch
    _pivot() { return { x: this.centerX(), y: this.y + this.h - 52 }; }

    get _p2() { return this.phase === 2; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        this.recoil = Math.max(0, this.recoil - dt * 4.5);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 46;
            this.bigHits = 0;
            PandaArt.burst(mx, my - 16, [PandaCfg.bamboo, '#ffffff', PandaCfg.leaf], 22, 200, 0.7, { kind: 'star' });
            PandaArt.ring(mx, my, PandaCfg.bamboo, 104, 0.6, 6);
            PandaArt.shake(8, 0.45);
        }
        const st = this.state;
        // Blick folgt immer; Blickrichtung wechselt er nur im Stand (Schwünge bleiben anchored)
        if (st !== 'intro' && st !== 'dizzy') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 5);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 5);
        }
        if (st === 'walk' || st === 'pant' || st === 'intro') {
            if (Math.abs(dx) > 14) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (st) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'sweepWind':
            case 'spinWind':                                        // ganzer Kreis (Phase 2) – gleicher Ausholcode
                this.stickA = this.sweep0 - 0.34 * this._k();     // hinten ausholen
                if (this.stateT <= 0) {
                    this.hitList = [];
                    this._set(this.spin ? 'spin' : 'sweep', this.spin ? (this._p2 ? 0.92 : 1.1) : (this._p2 ? 0.46 : 0.6));
                }
                break;
            case 'sweep':
            case 'spin': this._sweepTick(player); break;
            case 'jabWind':
                if (this.aim) {
                    this.stickA = Math.atan2(this.aim.y - this._pivot().y, (this.aim.x - this._pivot().x) * this.face);
                }
                if (this.stateT <= 0) {
                    this._jabHit();
                    this._set('jab', 0.22);
                }
                break;
            case 'jab':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'volleyWind':
                this.stickA = -1.2 - 0.25 * this._k();
                if (this.stateT <= 0) {
                    this._shootPlants();
                    this._set('shoot', 0.24);
                }
                break;
            case 'shoot':
                if (this.stateT <= 0) {
                    this.volleys = null;
                    this.cool = this._p2 ? 0.55 : 0.9;
                    this._set('pant', this.cool + 0.35);
                }
                break;
            case 'dizzy':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        this.stickA = this._stick();
        PandaArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.6; return; }
        this.step += dt * 3.6;
        let vx = 0, vy = 0;
        if (dist > 118) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 62) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool <= 0) this._nextAttack(world, player, dist);
    }

    _nextAttack(world, player, dist) {
        const cyc = this.phase === 2 ? BossGiantPanda.CYCLE2 : BossGiantPanda.CYCLE1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if ((what === 'sweep' || what === 'spin') && dist > BossGiantPanda.R + 90) what = 'volley';
        if (what === 'jab' && dist > 175) what = 'volley';
        if (what === 'sweep') this._startSweep(false);
        else if (what === 'spin') this._startSweep(true);
        else if (what === 'jab') this._startJab(world, player);
        else if (what === 'volley') this._startVolley(world, player);
        else this.cool = this.phase === 2 ? 0.5 : 0.9;            // bewusste Verschnaufpause
    }

    // ── a) Stockschwung: Halbkreis oder ganzer Kreis ──
    _startSweep(spin) {
        this.spin = spin;
        this.sweep0 = spin ? -Math.PI : -BossGiantPanda.SECTOR;
        this.sweep1 = spin ? Math.PI : BossGiantPanda.SECTOR;
        this.hitList = [];
        this._set(spin ? 'spinWind' : 'sweepWind', spin ? (this._p2 ? 0.66 : 0.86) : (this._p2 ? 0.7 : 0.9));
    }

    // Der Stock fährt durch die vorher gewarnte Fläche; getroffen wird, wer überholt wird.
    _sweepTick(player) {
        const k = this._k();
        const e = k * k * (3 - 2 * k);
        this.stickA = this.sweep0 + (this.sweep1 - this.sweep0) * e;
        if (k < 0.06) return;
        const pv = this._pivot();
        const A = this._sa(this.stickA);
        for (const t of PandaArt.targets(player)) {
            if (this.hitList.indexOf(t.ref) >= 0 || t.ref.dead || t.ref.koTimer > 0) continue;
            const R = Math.max(t.w, t.h) / 2;
            const d = Math.hypot(t.x - pv.x, t.y - pv.y);
            if (d < BossGiantPanda.R0 - R || d > BossGiantPanda.R + R) continue;
            const loc = Math.atan2(t.y - pv.y, (t.x - pv.x) * this.face);
            if (loc < this.sweep0 || loc > this.sweep1) continue;
            const passed = PandaArt.ang(Math.atan2(t.y - pv.y, t.x - pv.x) - A) * this.face;
            if (passed > 0.14 || passed < -0.6) continue;
            this.hitList.push(t.ref);
            const a = Math.atan2(t.y - pv.y, t.x - pv.x);
            if (t.isPlayer) PandaArt.hurt(t.ref, this.damage, a, 300);
            else PandaArt.hitCompanion(t.ref, this.damage);
            PandaArt.burst(t.x, t.y, [PandaCfg.bamboo, '#ffffff', PandaCfg.leaf], 10, 190, 0.4, { kind: 'spark' });
            PandaArt.shake(4.5, 0.14);
        }
        if (this.stateT <= 0) this._afterBig();
    }

    // ── b) Stich auf einen angesagten Punkt ──
    _startJab(world, player) {
        const pv = this._pivot();
        let best = null;
        for (const t of PandaArt.targets(player)) {
            const d = Math.hypot(t.x - pv.x, t.y - pv.y);
            if (d < 150 && (!best || d < best.d)) best = { t, d };
        }
        let x, y;
        if (best) { x = best.t.x; y = best.t.y; }
        else { const a = Math.atan2(this.look.y, this.look.x || 1); x = pv.x + Math.cos(a) * 90; y = pv.y + Math.sin(a) * 90; }
        // Der Stich trifft nur, wohin der Stock sichtbar reicht – sonst/sticht er ins Leere und es macht trotzdem Schaden
        const dxj = x - pv.x, dyj = y - pv.y, dj = Math.hypot(dxj, dyj) || 1;
        const reich = BossGiantPanda.R - 8;
        if (dj > reich) { x = pv.x + dxj * reich / dj; y = pv.y + dyj * reich / dj; }
        const room = PandaArt.room(world);
        if (room) {
            x = clamp(x, room.x + 20, room.x + room.w - 20);
            y = clamp(y, room.y + 20, room.y + room.h - 20);
        }
        this.aim = { x, y };
        this._set('jabWind', this._p2 ? 0.46 : 0.62);
    }

    _jabHit() {
        const a = this.aim;
        if (!a) return;
        const pv = this._pivot();
        const player = typeof Game !== 'undefined' ? Game.player : null;
        for (const t of PandaArt.targets(player)) {
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - a.x, t.y - a.y) > 34 + Math.max(t.w, t.h) / 2) continue;
            const ang = Math.atan2(t.y - pv.y, t.x - pv.x);
            if (t.isPlayer) PandaArt.hurt(t.ref, this.damage, ang, 240);
            else PandaArt.hitCompanion(t.ref, this.damage);
        }
        PandaArt.shake(7, 0.24);
        PandaArt.ring(a.x, a.y, '#ffe6b8', 40, 0.28, 5);
        PandaArt.burst(a.x, a.y, [PandaCfg.dust, PandaCfg.bamboo, '#ffffff'], 13, 170, 0.45, { kind: 'spark' });
        PandaArt.burst(a.x, a.y, 'rgba(226,216,190,0.8)', 5, 70, 0.55, { kind: 'smoke', size: 6 });
        // kurzer Satz in Richtung Stich
        const pvx = a.x - pv.x, pvy = a.y - pv.y;
        const d = Math.hypot(pvx, pvy) || 1;
        Kit915.rush(this, (pvx / d) * 26, (pvy / d) * 26, typeof Game !== 'undefined' ? Game.world : null);
    }

    // ── c) Giftpflanzen aus der Stockspitze ──
    _startVolley(world, player) {
        this.stickA = -1.2;
        const tip = this._tip(this._sa(this.stickA));
        const n = this._p2 ? 3 : 1;
        const tx = player.x + player.w / 2, ty = player.y + player.h / 2;
        const a0 = Math.atan2(ty - tip.y, tx - tip.x);
        this.volleys = [];
        for (let i = 0; i < n; i++) {
            const a = PandaArt.ang(a0 + (i - (n - 1) / 2) * 0.26);
            this.volleys.push({ a, len: Kit915.laneLength(this, Math.cos(a), Math.sin(a), world, 240) });
        }
        this._set('volleyWind', this._p2 ? 0.6 : 0.76);
    }

    _tip(A) {
        const pv = this._pivot();
        return { x: pv.x + Math.cos(A) * BossGiantPanda.R, y: pv.y + Math.sin(A) * BossGiantPanda.R };
    }

    _shootPlants() {
        const tip = this._tip(this._sa(this.stickA));
        this.recoil = 1;
        for (const v of this.volleys || []) {
            PandaArt.plant(tip.x, tip.y, v.a, { poison: this._p2 ? 3.2 : 2.8, damage: 1, speed: this._p2 ? 175 : 158 });
        }
        PandaArt.burst(tip.x, tip.y, [PandaCfg.poison, '#c8ffb0', PandaCfg.bamboo], 11, 150, 0.4, { kind: 'spark' });
        PandaArt.burst(tip.x, tip.y, 'rgba(150,235,120,0.7)', 4, 60, 0.5, { kind: 'smoke', size: 5 });
        PandaArt.shake(3, 0.14);
    }

    // Nach großen Angriffen: Verschnaufpause – und mit wenig Leben wird er schwindelig.
    _afterBig() {
        this.bigHits++;
        const low = this.hp <= this.maxHp * 0.32;
        if (this.phase === 2 && (low || this.bigHits % 2 === 0)) {
            this.spin = false;
            this.volleys = null;
            this.aim = null;
            this._set('dizzy', low ? 2.2 : 1.7);
            PandaArt.burst(this.centerX(), this.y + 26, ['#ffe35a', '#ffffff'], 12, 95, 0.55, { kind: 'star' });
            return;
        }
        this.cool = this._p2 ? 0.55 : 0.95;
        this._set('pant', this.cool + 0.4);
    }

    // ── Zeichnen ──
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const pv = this._pivot();
        const p = camera.worldToScreen(pv.x, pv.y);
        const R = BossGiantPanda.R, R0 = BossGiantPanda.R0;
        if (st === 'sweepWind' || st === 'sweep' || st === 'spinWind' || st === 'spin') {
            const from = this._sa(this.sweep0);
            const span = (this.sweep1 - this.sweep0) * this.face;
            PandaArt.sector(ctx, p.x, p.y, R0, R, from, span, st === 'sweepWind' || st === 'spinWind' ? this._k() : 1,
                st === 'sweepWind' || st === 'spinWind' ? PandaCfg.warn : '#ff8a3d');
            return;
        }
        if (st === 'jabWind' && this.aim) {
            const q = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, q.x, q.y, 34, this._k(), PandaCfg.warn);
            return;
        }
        if ((st === 'volleyWind' || st === 'shoot') && this.volleys) {
            const tip = this._tip(this._sa(this.stickA));
            const q = camera.worldToScreen(tip.x, tip.y);
            for (const v of this.volleys) {
                LateWorldArt.lane(ctx, q.x, q.y, v.a, v.len, 17, st === 'shoot' ? 1 : this._k(), PandaCfg.warnGreen);
            }
            return;
        }
        if (st === 'jab' && this.aim) {
            const q = camera.worldToScreen(this.aim.x, this.aim.y);
            Art.ring(ctx, q.x, q.y, 24 + this._k() * 46, '#ffe6b8', 4, 0.7);
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

    // Derselbe Panda wie die kleinen, 2,35-mal so groß, mit Blattbüschel, Riesen-Bambusstock und
    // (Phase 2) roten Augen, grünem Zornleuchten und Dampf. Der Stock wird außerhalb der Spiegelung
    // in Schirm-Pixeln gezeichnet: seine Länge ist dann exakt der Radius, in dem er trifft.
    _body(ctx, dead) {
        const S = 2.35;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const c = P_BOSS;
        const wind = st === 'sweepWind' || st === 'spinWind';
        const swinging = st === 'sweep' || st === 'spin';
        const jabWind = st === 'jabWind';
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const beat = st === 'intro' ? Math.sin(t * 12) : 0;
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const crouch = wind ? 2.2 * k : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 1.5) * 0.9) + (dizzy ? Math.sin(t * 5) * 0.8 : 0) - crouch
            - (rest ? 1.4 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 1.5) * 0.014) + (wind ? 0.02 * k : 0);
        // Stockwinkel auf dem Schirm (kommt aus _stick(), identisch für Warnung, Schaden und Bild)
        let A = this._sa(this.stickA) + this.recoil * 0.16 * (this.face > 0 ? 1 : -1);
        if (st === 'intro') A += beat * 0.05;                   // er schlägt den Stock auf den Boden
        // Griffe: vorn und hinten an der Stange (in Figuren-Einheiten, spiegelverkehrt)
        const dx = Math.cos(A), dy = Math.sin(A);
        const hands = {
            f: { x: (dx * 30 * this.face) / S, y: (-52 + dy * 30) / S },
            b: { x: (dx * -26 * this.face) / S, y: (-52 + dy * -26) / S },
        };
        if (st === 'intro') { hands.f.y -= 2; hands.b.y -= 2; }
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.save();
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, -9 - bob - 14, 30, PandaCfg.bamboo, 0.2 * this.angry + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (swinging || wind || jabWind || st === 'jab' || st === 'volleyWind' || st === 'shoot') ? 'open'
                : rest ? 'tired' : 'angry';
        const h = PandaArt.figure(ctx, {
            c, lw: 0.68, t, bob, walk, hands, mood,
            look: { x: this.look.x * this.face, y: this.look.y },
            leafTuft: !dead, red: p2, headDy: dizzy ? 1.6 : 0,
        });
        ctx.restore();
        // Riesen-Bambusstock: Länge = Trefferadius, deshalb in Schirm-Pixeln
        PandaArt.tool(ctx, {
            x: 0, y: -52, a: A, back: 26, front: BossGiantPanda.R * (st === 'jab' ? 1.06 : 1),
            thick: st === 'jab' ? 14 : 15.5, lw: 1.4, t, leaves: !dead,
            glow: (st === 'volleyWind' ? 0.3 + 0.7 * k : 0) + (st === 'shoot' ? 0.9 : 0),
        });
        if (swinging && !dead) {
            // Staub am vorderen Ende der Peitsche
            const tip = { x: Math.cos(A) * BossGiantPanda.R, y: -52 + Math.sin(A) * BossGiantPanda.R };
            Art.glow(ctx, tip.x, tip.y, 17, '#ffe6b8', 0.4);
        }
        if (p2 && !dead && !dizzy) {
            // rot glühende Augen in Phase 2
            Art.glow(ctx, h.hx * this.face * S, -94 + (dizzy ? 4 : 0), 10, '#ff3b5c', 0.28 + 0.18 * Math.sin(t * 9));
        }
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, h.hx * this.face * S, -110, 26, 4.8);
        // Zorn-Dampf in Phase 2
        if (p2 && !dizzy && !dead) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 3; i++) {
                const q = (t * 0.8 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.45;
                ctx.beginPath();
                ctx.arc((i - 1) * 24 + Math.sin(t * 3 + i) * 4, -112 - q * 24, 4 + q * 7, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        }
    }
}

BossGiantPanda.R = 98;              // Reichweite des Stocks (Warnung = Schaden = Bild)
BossGiantPanda.R0 = 34;             // innen kann Mark gefahrlos stehen
BossGiantPanda.SECTOR = 1.25;       // Halbkreis-Schwung: ±1,25 rad vor dem Boss
BossGiantPanda.CYCLE1 = ['sweep', 'volley', 'jab', 'walk'];
BossGiantPanda.CYCLE2 = ['spin', 'volley', 'sweep', 'jab', 'volley', 'walk'];
