// ── Welt 56: Bienenstock (Idee von Leander, 19.10.2026) ──
// Wütende Bienen: gelb-schwarz gestreift, von vorn gemalt (große Augen, zwei Flügel, Stachel unten).
//   Sie schwärmen auf Abstand, halten ihn und STECHEN dann: 0,45 s vorher zieht sich am Ziel ein roter
//   Kreis zusammen und vor der Biene erscheinen zwei Pfeilspitzen – der Stich schlägt genau dort ein,
//   wo der Kreis stand (Ansage = Treffer). Der Stich zieht Leben, verderfen tut nichts.
//   Schlüsselträger: weiß-goldene Biene mit kleiner Krone, etwas zäher und flinker.
// Boss: BIENENKÖNIGIN – Endgegnerin von Welt 56, bleibt im Boss-Raum (Königinnenkammer), 148 LP,
//   zwei Phasen. Große Krone, langer gestreifter Hinterleib, langer Stachel.
//   Stachelsalve: fünf (Phase 2: sieben) Stacheln fliegen genau entlang der Bahnen, die vorher als
//     orangefarbene Warnlinien am Boden standen. Phase 2 schießt zweimal, die zweite Bahn steht schon
//     sichtbar in der Landschaft, ehe der erste Stachel fliegt.
//   Bienenschwarm: sechs goldene Sechsecke am Boden zeigen, wo die Bienen auftauchen, dann summt es
//     und der Schwarm ist da (höchstens fünf, in Phase 2 sieben zugleich).
//   Honigpfützen: sie spuckt Honig auf vorher angesagte Kreise. Wo Honig liegt, wird man langsamer –
//     der Honig zieht KEIN Leben ab (Verlangsamen über player.applySlow, wie in den anderen Welten).
//   Phase 2 (halbe LP): schneller, größere Salve, mehr Honig, mehr Bienen.
//   Bei wenig Leben wird sie nach großen Angriffen schwindelig (Sterne, kurz wehrlos) – Marks Zeit.
// Nur die Wirkungen, die Leander genannt hat: Schaden durch Stich/Stachel, Schwarm, langsamer im Honig.
//   Kein Gift, kein Schlaf, kein Schleim.
// Freunde verschwinden nie: ein tödlicher Treffer haut Juri, das Krokodil und den Panda nur um (knockOut).

const BeeCfg = {
    yellow: '#ffd23f',          // gelber Streifenton (hellster Ton, damit man die Biene auf dem Honigboden sieht)
    yellowMid: '#f2b31f',
    yellowDark: '#c98a10',
    band: '#3a2a14',            // schwarze Streifen (nicht tiefschwarz, das ist hier der Umriss)
    bandDark: '#241708',
    fur: '#4d3719',             // pelziger Brustpanzer
    furMid: '#3a2812',
    wing: '#e6f6ff',            // helle Flügel
    wingEdge: '#7fbcdd',
    leg: '#2d2010',
    eyeShine: '#ffffff',
    iris: '#ff8a1e',
    keyBody: '#fff3cd',         // Schlüsselträger: weiß-goldene Biene
    keyBand: '#e3ac22',
    keyFur: '#f3dfa4',
    queenBody: '#ffc22e',       // Bienenkönigin: etwas wärmeres Gold
    queenBand: '#33200e',
    queenFur: '#5a3f19',
    honey: '#ffb020',           // Honig: Pfützen, Tropfen, Glanz
    honeyMid: '#e08a10',
    honeyDark: '#a5610a',
    honeyLight: '#ffe39a',
    crown: '#ffd23f',
    crownDark: '#b4770a',
    warn: '#ff5a3d',            // Ansage für Stich und Stachel
    warnHoney: '#ffae1e',       // Ansage für Honig
    pollen: '#ffe35a',
};

// Drei Paletten: Arbeiterin (gelb-schwarz), Schlüsselträger (weiß-gold), Königin (wärmer, dunkler)
const C_BEE_WORKER = {
    body: BeeCfg.yellow, bodyMid: BeeCfg.yellowMid, bodyDark: BeeCfg.yellowDark,
    band: BeeCfg.band, bandDark: BeeCfg.bandDark, fur: BeeCfg.fur, furMid: BeeCfg.furMid,
};
const C_BEE_KEY = {
    body: BeeCfg.keyBody, bodyMid: BeeCfg.keyBand, bodyDark: '#c79a2c',
    band: '#caa02a', bandDark: '#9a7414', fur: BeeCfg.keyFur, furMid: '#dcc481',
};
const C_BEE_QUEEN = {
    body: BeeCfg.queenBody, bodyMid: '#e79c17', bodyDark: '#bd7a0a',
    band: BeeCfg.queenBand, bandDark: '#1c1004', fur: BeeCfg.queenFur, furMid: '#422e11',
};

// Höchstens so viele Stacheln gleichzeitig unterwegs (wie die Gifttropfen in Welt 53)
const STINGER_CAP = 44;
// Höchstens so viele Honigpfützen zugleich auf dem Boden
const HONEY_MAX = 5;

const BeeArt = {
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

    text(x, y, str, color, size, life) {
        if (typeof FX !== 'undefined') FX.text(x, y, str, color, size || 11, { life: life || 1 });
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
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [BeeCfg.yellow, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
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

    // Freier Punkt in der Welt (für Stichziele, Schwarmplätze und Honigpfützen)?
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
    // Der Stich in Welt 56 zieht nur Leben ab – kein Zustand hängt daran.
    areaHit(x, y, R, amount, force, hit) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        let getroffen = 0;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (hit) hit.push(t.ref);
            getroffen++;
            if (t.isPlayer) this.hurt(t.ref, amount, Math.atan2(t.y - y, t.x - x), force);
            else this.hitCompanion(t.ref, amount);
        }
        return getroffen;
    },

    // Stachel-Einschlag: gelbe Stäubchen und ein Ring genau über dem angesagten Kreis
    stingFx(x, y, R) {
        this.burst(x, y, [BeeCfg.pollen, BeeCfg.yellow, '#ffffff'], 9, 125, 0.4, { kind: 'spark' });
        this.ring(x, y, BeeCfg.yellow, R, 0.24, 3);
    },

    // Pollenwölkchen hinter einer fliegenden Biene
    pollenFx(x, y) {
        this.burst(x, y, [BeeCfg.pollen, BeeCfg.yellow], 1, 26, 0.5, { kind: 'dot' });
    },

    // Honig platscht auf
    honeyFx(x, y, R) {
        this.burst(x, y, [BeeCfg.honey, BeeCfg.honeyLight, BeeCfg.honeyMid], 11, 120, 0.5, { kind: 'dot', gravity: 240 });
        this.ring(x, y, BeeCfg.honey, R, 0.3, 3.2);
    },

    // ── Ganze Figur: Biene von vorn, Fußpunkt (0, 0) ──
    // Zwei Flügel, pelziger Brustpanzer, gestreifter Hinterleib mit Stachel unten, Kopf mit zwei
    // großen Augen, zwei Fühlern und kleinem Kiefer. Eine Einheit = normale Biene; die Königin
    // zeichnet dieselbe Figur größer (ctx.scale vorher) und mit langer Krone.
    // p = { c, lw, t, bob, flap (Flügelschlag-Tempo), wing (0..1 ausgebreitet), dash (0..1 Vorflug),
    //       mood ('angry'|'open'|'tired'|'dead'|'dizzy'), look, bands, queen, crown (1 klein, 2 groß),
    //       sting (0..1 Stachel gehoben/leuchtend), red (rote Augen), fuzz }
    figure(ctx, p) {
        const c = p.c, lw = p.lw, t = p.t;
        const cy = -15.5 - p.bob;                 // Brustmitte (Biene schwebt über ihrem Fußpunkt)
        const lean = (p.dash || 0) * 0.34;        // beim Anflug nach vorn geneigt

        // ── Flügel (hinter dem Körper) ──
        this._wings(ctx, p, cy, lean);

        // ── Beine (drei je Seite, baumeln im Flug) ──
        for (const s of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                const sway = Math.sin(t * 3.4 + i * 1.7 + (s < 0 ? 0 : 2.1)) * 1.1;
                const bx = s * (2.4 + i * 0.9), by = cy + 3.4 + i * 1.7;
                const kx = s * (6.6 + i * 1.4), ky = by + 4.6;
                const fx = s * (6.2 + i * 1.6) + sway, fy = by + 9.4 + i * 0.6;
                Art.limb(ctx, bx, by, kx, ky, 1.7, BeeCfg.leg, { lineWidth: lw * 0.75 });
                Art.limb(ctx, kx, ky, fx, fy, 1.4, BeeCfg.leg, { lineWidth: lw * 0.75 });
            }
        }

        ctx.save();
        ctx.rotate(lean * 0.5);

        // ── Hinterleib mit Streifen und Stachel ──
        this._abdomen(ctx, p, c, cy);

        // ── Brustpanzer (fellig) ──
        Art.body(ctx, 0, cy, 8.1, 7.3, c.fur, { glossy: true, lineWidth: lw });
        if (p.fuzz !== false) {
            ctx.strokeStyle = Art.light(c.fur, 0.34);
            ctx.lineWidth = lw * 0.7;
            ctx.lineCap = 'round';
            for (let i = 0; i < 7; i++) {
                const a = -2.55 + i * 0.42;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * 7.1, cy + Math.sin(a) * 6.4);
                ctx.lineTo(Math.cos(a) * 9.1, cy + Math.sin(a) * 8.4);
                ctx.stroke();
            }
        }

        // ── Kopf ──
        const hx = 0, hy = cy - 10.4;
        // Fuehler
        for (const s of [-1, 1]) {
            const tx = s * 6.4 + Math.sin(t * 2.6 + s) * 0.7, ty = hy - 9.6;
            Art.limb(ctx, s * 2.2, hy - 4.8, tx, ty, 1.2, BeeCfg.leg, { lineWidth: lw * 0.65 });
            Art.body(ctx, tx, ty, 1.3, 1.3, BeeCfg.bandDark, { highlight: false, lineWidth: lw * 0.55 });
        }
        Art.body(ctx, hx, hy, 6.7, 6.2, c.body, { glossy: true, lineWidth: lw });
        // Gesicht: zwei große Facettenaugen, Augenbrauen, kleiner Kiefer
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        const ey = hy - 0.5;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, hx, ey, 1.9, 3);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = lw * 0.85;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.2 + i * 0.11;
                    const x = hx + s * 3 + Math.cos(a) * r, y = ey + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, hx + s * 3, ey, 2.15, { x: look.x, y: look.y }, {
                    angry: mood !== 'tired', side: s < 0 ? 'left' : 'right',
                    iris: p.red ? '#ff3b3b' : BeeCfg.iris, sclera: '#fffaf0',
                    open: mood === 'tired' ? 0.5 : 1, irisSize: 0.7,
                });
            }
        }
        Art.mouth(ctx, hx, hy + 4.5, 3.4, mood === 'open' ? 'teeth' : (mood === 'dizzy' || mood === 'tired') ? 'o' : 'angry',
            { color: BeeCfg.bandDark });
        // Kiefertaster
        for (const s of [-1, 1]) {
            Art.limb(ctx, hx + s * 2, hy + 5.6, hx + s * 3.4, hy + 7.2, 1.2, BeeCfg.bandDark, { lineWidth: lw * 0.6 });
        }

        // ── Krone (Schlüsselträger klein, Königin groß) ──
        if (p.crown) this._crown(ctx, hx, hy - 5.6, p.crown === 2 ? 1.5 : 1, t);

        ctx.restore();
        return { cy, hx, hy };
    },

    // Zwei Flügel je Seite, im Flug zu einer Scheibe verschliffen; o.wing breitet sie aus.
    _wings(ctx, p, cy, lean) {
        const beat = Math.sin(p.t * (p.flap || 30));
        const spread = p.wing || 0;
        const prev = ctx.globalAlpha;
        for (const s of [-1, 1]) {
            ctx.save();
            ctx.translate(s * 3.2, cy - 2.6);
            ctx.rotate(s * (0.44 - spread * 0.3 + lean * 0.5 + beat * 0.16));
            const beatScale = 0.42 + 0.58 * Math.abs(beat);
            ctx.globalAlpha = prev * 0.74;
            // oberer (langer) Flügel
            Art.body(ctx, s * 10.4, -3.4, 10.4, 4.3 * (0.55 + 0.45 * spread) * (0.62 + 0.38 * beatScale), BeeCfg.wing,
                { outline: BeeCfg.wingEdge, lineWidth: 1.1, highlight: false, flat: true });
            // unterer (kleiner) Flügel
            Art.body(ctx, s * 8.4, 2.6, 6.4, 3 * (0.6 + 0.4 * spread) * (0.6 + 0.4 * beatScale), BeeCfg.wing,
                { outline: BeeCfg.wingEdge, lineWidth: 1, highlight: false, flat: true });
            // zwei Flügeladern
            ctx.globalAlpha = prev * 0.5;
            ctx.strokeStyle = BeeCfg.wingEdge;
            ctx.lineWidth = 0.9;
            for (const d of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(s * 2.4, -3 + d * 1.2);
                ctx.quadraticCurveTo(s * 9, -4.6 + d * 1.6, s * 18.6, -3.2 + d * 1.2);
                ctx.stroke();
            }
            ctx.restore();
        }
        ctx.globalAlpha = prev;
    },

    // Gestreifter Hinterleib (vorn breit, unten der Stachel). p.bands = Anzahl dunkler Streifen.
    _abdomen(ctx, p, c, cy) {
        const lw = p.lw;
        const long = p.queen ? 13.4 : 10.8;
        const ax = 0, ay = cy + 4.4 + long * 0.55;
        const rx = p.queen ? 9.4 : 8.3, ry = long;
        const bands = p.bands || (p.queen ? 4 : 3);
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(ax, ay, rx, ry, 0, 0, TAU);
        ctx.clip();
        Art.body(ctx, ax, ay, rx, ry, c.body, { highlight: false, outline: false, glossy: true });
        ctx.fillStyle = c.band;
        // Baelke duenn genug, dass Gelb und Schwarz sich abwechseln – ein Kind muss "Biene" lesen
        const step = (ry * 2 - 6.4) / bands;
        for (let i = 0; i < bands; i++) {
            const yy = ay - ry + 4.2 + i * step;
            ctx.beginPath();
            ctx.ellipse(ax, yy, rx * 1.2, p.queen ? 1.75 : 1.4, 0, 0, TAU);
            ctx.fill();
        }
        // heller Saum unten (Bienenwachs)
        ctx.fillStyle = Art.alpha(c.bodyMid, 0.5);
        ctx.beginPath();
        ctx.ellipse(ax, ay + ry * 0.72, rx * 1.1, ry * 0.3, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        // Umriss und Glanz
        ctx.lineWidth = lw;
        ctx.strokeStyle = Art.ink(c.body);
        ctx.beginPath();
        ctx.ellipse(ax, ay, rx, ry, 0, 0, TAU);
        ctx.stroke();
        Art.shine(ctx, ax - rx * 0.42, ay - ry * 0.52, rx * 0.3, ry * 0.2, -0.6, 0.4);
        // ── Stachel unten am Hinterleib ──
        const lift = p.sting || 0;
        const sx = ax, sy = ay + ry - 0.6;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(0.2 - lift * 1.15);
        Art.shape(ctx, g => {
            g.moveTo(-1.7, 0);
            g.quadraticCurveTo(0, 1.4, 0, (p.queen ? 8.6 : 5.4));
            g.quadraticCurveTo(0.6, 1.2, 1.7, 0);
            g.closePath();
        }, { x: -1.8, y: 0, w: 3.6, h: p.queen ? 8.6 : 5.4 }, c.bandDark, { lineWidth: lw * 0.8, highlight: false });
        ctx.restore();
        if (lift > 0.25) Art.glow(ctx, sx, sy + (p.queen ? 6 : 4), p.queen ? 22 : 11, BeeCfg.warn, 0.3 + lift * 0.4);
    },

    // Kleine goldene Krone (crown = 1) oder Königinnenkrone mit drei Zacken und Edelstein (= 2).
    _crown(ctx, x, y, s, t) {
        const pts = s > 1 ? 5 : 3;
        const w = 5.4 * s, h = 3.6 * s;
        Art.shape(ctx, g => {
            g.moveTo(x - w, y);
            g.lineTo(x - w, y - h * 0.45);
            for (let i = 0; i < pts; i++) {
                const px = x - w + (2 * w * (i + 0.5)) / pts;
                const top = y - h * (i % 2 === 0 ? 1 : 0.66);
                g.lineTo(px, top);
                g.lineTo(px + w / pts, y - h * 0.45);
            }
            g.lineTo(x + w, y - h * 0.45);
            g.lineTo(x + w, y);
            g.closePath();
        }, { x: x - w, y: y - h, w: w * 2, h: h }, BeeCfg.crown, { glossy: true, lineWidth: 1.1 });
        ctx.fillStyle = s > 1 ? '#ff5a7a' : BeeCfg.crownDark;
        ctx.beginPath();
        ctx.arc(x, y - h * 0.2, s * (s > 1 ? 1.15 : 0.8), 0, TAU);
        ctx.fill();
        if (s > 1) Art.sparkle(ctx, x - w * 0.55, y - h * 0.75, 1.8 + Math.sin(t * 4) * 0.3, '#ffffff', 0.75);
    },

    // Ein Stachel als Geschoss (Spitze voran, kurzer gelber Flight)
    stinger(ctx, x, y, r, ang, t, seed) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        Art.limb(ctx, -r * 2.6, 0, -r * 0.8, 0, r * 0.5, Art.alpha(BeeCfg.pollen, 0.7), { outline: false, lineWidth: 1 });
        Art.shape(ctx, g => {
            g.moveTo(r * 1.5, 0);
            g.quadraticCurveTo(r * 0.2, -r * 0.72, -r * 1.1, -r * 0.3);
            g.quadraticCurveTo(-r * 0.6, 0, -r * 1.1, r * 0.3);
            g.quadraticCurveTo(r * 0.2, r * 0.72, r * 1.5, 0);
            g.closePath();
        }, { x: -r * 1.1, y: -r * 0.72, w: r * 2.6, h: r * 1.44 }, BeeCfg.bandDark, { lineWidth: 1.2, highlight: false });
        Art.body(ctx, -r * 0.5, 0, r * 0.62, r * 0.5, BeeCfg.yellow, { highlight: false, lineWidth: 1 });
        ctx.restore();
        Art.glow(ctx, x, y, r * 2.4, BeeCfg.pollen, 0.32 + 0.12 * Math.sin(t * 12 + seed));
    },

    // Ein Honigklecks (Wurfgeschoss und Pfütze in einem Strich)
    glob(ctx, x, y, r, t, seed) {
        Art.glow(ctx, x, y, r * 2.4, BeeCfg.honey, 0.45);
        const wob = Math.sin(t * 10 + seed) * 0.14;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 + wob, 1 - wob);
        Art.body(ctx, 0, 0, r, r * 0.9, BeeCfg.honey, { glossy: true, lineWidth: 1.4 });
        ctx.restore();
        Art.shine(ctx, x - r * 0.3, y - r * 0.42, r * 0.34, r * 0.2, -0.5, 0.7);
    },

    // ── Bienenwabe als Ansage-Marker (Auftauchpunkt des Schwarms) ──
    hex(ctx, x, y, r, color, k, t) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * (0.14 + 0.2 * clamp(k, 0, 1));
        ctx.fillStyle = color;
        ctx.beginPath();
        LateWorldArt.poly(ctx, x, y, r, 6, Math.PI / 6);
        ctx.fill();
        ctx.globalAlpha = prev * (0.55 + 0.4 * Math.abs(Math.sin(t * 8)));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        LateWorldArt.poly(ctx, x, y, r, 6, Math.PI / 6);
        ctx.stroke();
        ctx.globalAlpha = prev * (0.1 + 0.24 * clamp(k, 0, 1));
        ctx.beginPath();
        LateWorldArt.poly(ctx, x, y, r * clamp(k, 0, 1), 6, Math.PI / 6);
        ctx.fill();
        ctx.globalAlpha = prev;
    },

    // Honigpfütze am Boden: goldene Lache mit dunklem Rand, Bläschen und Glanz
    puddle(ctx, x, y, r, age, life, seed) {
        const grow = clamp(age / 0.28, 0, 1);
        const gone = clamp(life / 0.7, 0, 1);
        const rr = r * (0.5 + 0.5 * grow) * (0.55 + 0.45 * gone);
        if (rr < 1) return;
        const prev = ctx.globalAlpha;
        const wob = Math.sin(Art.time * 2.2 + seed) * 0.05;
        ctx.globalAlpha = prev * 0.9 * gone;
        // Lache (leicht welliger Rand)
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
            const a = (i / 14) * TAU;
            const k = 1 + Math.sin(a * 3 + Art.time * 1.6 + seed) * 0.08;
            const px = x + Math.cos(a) * rr * k, py = y + Math.sin(a) * rr * (0.52 + wob) * k;
            if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = BeeCfg.honey;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = BeeCfg.honeyDark;
        ctx.stroke();
        // dunkler Kern, Glanz und drei Bläschen
        ctx.globalAlpha = prev * 0.55 * gone;
        ctx.fillStyle = BeeCfg.honeyMid;
        ctx.beginPath();
        ctx.ellipse(x, y + rr * 0.1, rr * 0.55, rr * 0.26, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev * 0.7 * gone;
        Art.shine(ctx, x - rr * 0.34, y - rr * 0.2, rr * 0.26, rr * 0.1, -0.4, 0.7);
        for (let i = 0; i < 3; i++) {
            const a = Art.time * 1.1 + seed + i * 2.2;
            const bx = x + Math.cos(a) * rr * 0.5, by = y + Math.sin(a) * rr * 0.24;
            ctx.fillStyle = BeeCfg.honeyLight;
            ctx.beginPath();
            ctx.arc(bx, by, rr * 0.07 + 0.6, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = prev;
    },
};

// ══════════════════════════════════════════
// ── Stachel (Geschoß der Bienenkönigin) ──
// ══════════════════════════════════════════

// Fliegt genau die Bahn lang, die als Warnlinie angesagt war, und zieht ein Leben ab.
// Eigener Besitzer 'lobber' (wie der Gummiklex in Welt 51): die Engine prüft für ihn keinen Treffer –
// sonst würden Juri, Krokodil und Panda über stun() betäubt. Getroffen wird hier, ohne Zustand.
class Stinger extends Projectile {
    constructor(x, y, angle, speed) {
        const sp = speed || 178;
        super(x, y, Math.cos(angle) * sp, Math.sin(angle) * sp, 1, 'lobber', 90);
        this.radius = 6;
        this.lifetime = 2.5;
        this.seed = Math.random() * 10;
        this.angle = angle;
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) { this._puff(); return; }
        const player = typeof Game !== 'undefined' ? Game.player : null;
        if (player && !player.dead && !player.dodging) {
            const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
            if (Math.hypot(this.x - cx, this.y - cy) < this.radius + player.w / 2) {
                BeeArt.hurt(player, 1, Math.atan2(this.vy, this.vx), 110);
                this._puff();
                this.dead = true;
                return;
            }
        }
        for (const c of BeeArt.companions()) {
            const w = c.w || 20, h = c.h || 20;
            if (Math.hypot(this.x - (c.x + w / 2), this.y - (c.y + h / 2)) >= this.radius + Math.max(w, h) / 2) continue;
            BeeArt.hitCompanion(c, 1);
            this._puff();
            this.dead = true;
            return;
        }
        if (typeof FX !== 'undefined' && Math.random() < dt * 20) {
            FX.burst(this.x, this.y, [BeeCfg.pollen], 1, 14, 0.4, { kind: 'dot' });
        }
    }

    _puff() {
        BeeArt.burst(this.x, this.y, [BeeCfg.pollen, BeeCfg.yellow, '#ffffff'], 6, 95, 0.34, { kind: 'spark' });
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        BeeArt.stinger(ctx, p.x, p.y, this.radius * 0.8, Math.atan2(this.vy, this.vx), Art.time, this.seed);
    }
}

// ══════════════════════════════════════════
// ── Honigklecks (wirft die Bienenkönigin auf angesagte Kreise) ──
// ══════════════════════════════════════════

// Fliegt auf den Punkt, dessen Kreis vorher angesagt war, und platscht dort auf: daraus entsteht die
// Honigpfütze, in der man langsamer wird. Er zieht kein Leben ab (damage 0, eigener Besitzer).
class HoneyGlob extends Projectile {
    constructor(x, y, tx, ty, boss, r) {
        const ang = Math.atan2(ty - y, tx - x);
        const d = Math.hypot(tx - x, ty - y);
        const sp = 168;
        super(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, 0, 'lobber', 0);
        this.radius = 8;
        this.flight = Math.max(0.12, d / sp);
        this.lifetime = this.flight + 0.8;
        this.seed = Math.random() * 10;
        this.boss = boss;
        this.puddleR = r || 34;
    }

    update(dt, world) {
        super.update(dt, world);
        this._splat(world);
    }

    // Aufschlagen: am angesagten Punkt, an der Wand oder mit Ablauf der Flugzeit.
    _splat(world) {
        if (this._splatted) return;
        if (this.age < this.flight && !this.dead) return;
        this._splatted = true;
        this.dead = true;
        const b = this.boss;
        if (b && !b.dead) b._addPuddle(this.x, this.y, this.puddleR);
        BeeArt.honeyFx(this.x, this.y, this.puddleR * 0.8);
        BeeArt.shake(1.6, 0.1);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const t = Art.time + this.seed;
        BeeArt.glob(ctx, p.x, p.y + Math.sin(t * 7) * 1.2, this.radius * 0.8, t, this.seed);
    }
}

// ══════════════════════════════════════════
// ── Normale Biene ──
// ══════════════════════════════════════════

// Wütende Biene (gelb-schwarz, Schlüsselträger weiß-gold mit Krone). Hält 45–135 Einheiten Abstand,
//   hält ihn und sticht dann auf eine angesagte Kreisfläche: 0,45 s vorher zieht sich der Kreis
//   zusammen, zwei Pfeilspitzen zeigen, woher sie kommt, dann schlägt der Stachel dort ein.
//   Der Stich zieht ein Leben ab – mehr nicht. Bei halben LP schaut sie mürrischer drein.
class Bee extends Enemy {
    constructor(x, y) {
        super(x, y, 28, 26);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(52, 62);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = true;
        this.fxColor = BeeCfg.yellow;
        this.seed = Math.random() * 10;
        this.detectionRange = 250;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: -0.1 };
        this.state = 'idle';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.8, 1.9);
        this.step = 0;
        this.moving = false;
        this.gold = false;              // weiß-goldene Biene (Schlüsselträgerin)
        this.aim = null;                // {x, y} Punkt des Stiches
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

    _colors() { return this.gold ? C_BEE_KEY : C_BEE_WORKER; }

    // Stichradius – der angesagte Kreis ist genau so groß wie die getroffene Fläche
    _R() { return this.gold ? 30 : 26; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträgerin (Flag setzt main.js nach dem Erzeugen): weiß-gold, zäher und flinker
            this._keyInit = true;
            this.gold = true;
            this.hp = this.maxHp = 9;
            this.speed = randRange(62, 70);
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
            this._set('threat', 0.55);      // Drohstellung: Stachel hoch, Flügel weit auf
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'threat':
                if (this.stateT <= 0) this._set('hover', 0);
                break;
            case 'stingWind':
                if (this.stateT <= 0) {
                    this._stingHit();
                    this._set('sting', 0.24);
                }
                break;
            case 'sting':
                this._dash(dt, world);
                if (this.stateT <= 0) this._set('back', 0.36);
                break;
            case 'back':
                this._retreat(dt, world, dist, dx, dy);
                if (this.stateT <= 0) this._set('hover', 0);
                break;
            default: this._hover(dt, world, player, dist, dx, dy);
        }
        if (typeof FX !== 'undefined' && this.moving && Math.random() < dt * 3) BeeArt.pollenFx(this.centerX(), this.centerY() + 6);
    }

    // ── Ansatz: Abstand halten, dann stechen ──
    _hover(dt, world, player, dist, dx, dy) {
        this.step += dt * 2.4;
        if (player.dead) {
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.22 * dt, Math.cos(this.step * 0.7) * this.speed * 0.22 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 92) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 42) { vx = -dx / dist; vy = -dy / dist; }
        else {
            // Schwanken auf einer Linie quer zum Ziel: man sieht, dass sie es noch umkreist
            const s = this.seed > 5 ? 1 : -1;
            vx = (-dy / dist) * s * 0.6 + (dx / dist) * 0.2;
            vy = (dx / dist) * s * 0.6 + (dy / dist) * 0.2;
        }
        const n = Math.hypot(vx, vy) || 1;
        Kit915.rush(this, (vx / n) * this.speed * dt, (vy / n) * this.speed * dt, world);
        this.moving = true;
        if (this.cool > 0 || dist > 150) return;
        const near = BeeArt.nearTarget(player, this.centerX(), this.centerY(), 150);
        this.aim = near ? { x: near.t.x, y: near.t.y } : { x: this.centerX() + this.face * 26, y: this.centerY() };
        if (Math.abs(this.aim.x - this.centerX()) > 3) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this.stingHit = [];
        this._set('stingWind', this.gold ? 0.42 : 0.5);
    }

    // Der Anflug: sie fliegt in den Kreis hinein, dessen Ansage gerade abgelaufen ist
    _dash(dt, world) {
        const a = this.aim;
        if (!a) return;
        const cx = this.centerX(), cy = this.centerY();
        const dx = a.x - cx, dy = a.y - cy;
        const d = Math.hypot(dx, dy);
        if (d < 6) return;
        const step = Math.min(d, this.speed * 3.2 * dt);
        Kit915.rush(this, (dx / d) * step, (dy / d) * step, world);
        this.moving = true;
    }

    // Nach dem Stich kurz zurücksetzen (Flügelgeräusch sieht man als Pollenwölkchen)
    _retreat(dt, world, dist, dx, dy) {
        const vx = dist > 8 ? -dx / dist : 0, vy = dist > 8 ? -dy / dist : 0;
        Kit915.rush(this, vx * this.speed * 1.1 * dt, vy * this.speed * 1.1 * dt, world);
        this.moving = true;
        this.step += dt * 9;
    }

    // Der Stich landet genau dort, wo der rote Kreis stand – er reicht also bis an den Kreis heran.
    _stingHit() {
        const a = this.aim || { x: this.centerX() + this.face * 24, y: this.centerY() };
        const R = this._R();
        BeeArt.areaHit(a.x, a.y, R, this.damage, 165, this.stingHit);
        BeeArt.stingFx(a.x, a.y, R);
        BeeArt.shake(2, 0.1);
    }

    // Ansagen am Boden: der Stich-Kreis (unter allen Figuren, damit nichts verdeckt wird)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if ((st === 'stingWind' || st === 'sting') && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, this._R(), st === 'sting' ? 1 : this._k(), BeeCfg.warn);
            if (st === 'stingWind') {
                // die Pfeilspitzen zeigen, aus welcher Richtung der Stich kommt
                const s = camera.worldToScreen(this.centerX(), this.centerY() - 6);
                LateWorldArt.chevrons(ctx, s.x, s.y, Math.atan2(this.aim.y - s.y, this.aim.x - s.x), this._k(), BeeCfg.pollen);
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
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 19 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Biene mit Fußpunkt (0, 0); Zeichnung in BeeArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const threat = st === 'threat' ? 1 : 0;
        const wind = st === 'stingWind' ? k : 0;
        const dash = st === 'sting' ? 1 : 0;
        const back = st === 'back';
        // Im Schweben hebt und senkt sie sich; beim Anflug geht sie tief, beim Drohen hoch
        const bob = dead ? -1 : Math.sin(t * 3.1) * 1.1 + threat * 2.4 + wind * 1.4 - dash * 2.6;
        const squ = dead ? 0 : Math.sin(t * (back ? 12 : 6)) * 0.012;
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.gold && !dead) Art.glow(ctx, 0, -16, 24, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (wind || dash || threat) ? 'open' : tired ? 'tired' : 'angry';
        BeeArt.figure(ctx, {
            c, lw: 1.25, t, bob,
            flap: 30 + wind * 10,
            wing: clamp(threat * 0.7 + wind * 0.9 + dash * 0.5, 0, 1),
            dash: dash,
            sting: clamp(wind + threat * 0.6 + dash * 0.4, 0, 1),
            crown: this.gold ? 1 : 0,
            mood,
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: BIENENKÖNIGIN (Endgegnerin Welt 56) ──
// ══════════════════════════════════════════

// Riesige Biene mit Königinnenkrone, 148 LP, bleibt im Boss-Raum (Königinnenkammer). Ablauf Phase 1:
//   Drohen → Stachelsalve (angesagte Bahnen) → Honigpfützen (angesagte Kreise) → Bienenschwarm
//   (angesagte Waben) → Verschnaufpause …
//   Die Salve zieht Leben, der Schwarm beißt, der Honig macht langsam – er zieht kein Leben ab.
// Phase 2 (halbe LP): schneller, die Salve wird größer und kommt zweimal, mehr Honig, mehr Bienen.
//   Bei wenig Leben wird sie nach großen Angriffen schwindelig (Sterne, kurz wehrlos) – Marks Zeit.
class BossBeeQueen extends Enemy {
    constructor(x, y) {
        super(x, y, 88, 84);
        this.hp = 148;
        this.maxHp = 148;
        this.speed = 34;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;      // Schaden macht nur, was angesagt ist
        this.phasesThroughWalls = false;
        this.flying = true;
        this.shadow = { rx: 40, ry: 12, dy: 46, alpha: 0.26 };
        this.fxColor = BeeCfg.yellow;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: -0.1 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 1.9;
        this.stateDur = 1.9;
        this.seq = 0;
        this.cool = 0.7;
        this.step = 0;
        this.moving = false;
        this.minions = [];
        // Stachelsalve
        this.fanA = 0;
        this.fanA2 = null;               // Richtung der zweiten Welle – steht vor dem ersten Schuss fest
        this.fanLock = false;
        this.fanWaves = 0;
        this.fanT = 0;
        this.fanFriend = null;
        // Bienenschwarm
        this.spots = [];                 // [{x, y}] angesagte Auftauchpunkte
        this.honey = [];                 // [{x, y}] angesagte Honigpunkte
        // Honigpfützen am Boden
        this.puddles = [];
    }

    static room(world) { return BeeArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // Wo die Salve losfliegt (Spitze des Stachels)
    _muzzle() { return { x: this.centerX() + this.face * 14, y: this.y + this.h - 6 }; }

    // Anzahl Stacheln je Salve
    _fanN() { return this.phase === 2 ? 7 : 5; }

    // Anzahl Bienen, die sie je Ruf ruft, und wie viele zugleich darf
    _swarmN() { return this.phase === 2 ? 3 : 2; }
    _swarmMax() { return this.phase === 2 ? 7 : 5; }

    // Pfützenradius (kleiner als der angesagte Kreis? nein: genau der angesagte Kreis)
    _honeyR() { return this.phase === 2 ? 38 : 34; }

    // Honig: wer darin steht, wird langsamer (player.applySlow – derselbe Weg wie Eisball und Spinnennetz)
    _honeyTick(dt, player) {
        for (let i = this.puddles.length - 1; i >= 0; i--) {
            const p = this.puddles[i];
            p.age += dt;
            p.life -= dt;
            if (p.life <= 0) { this.puddles.splice(i, 1); continue; }
            if (!player || player.dead) continue;
            const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
            if (Math.hypot(cx - p.x, cy - p.y) > p.r + player.w / 3) continue;
            if (typeof player.applySlow === 'function') player.applySlow(0.8, 0.55);
            if (typeof FX !== 'undefined' && Math.random() < dt * 9) {
                FX.burst(cx, cy + 6, [BeeCfg.honey, BeeCfg.honeyLight], 1, 26, 0.5, { kind: 'dot', gravity: 210 });
            }
        }
    }

    // Neue Pfütze ablegen (höchstens HONEY_MAX zugleich; die älteste läuft zuerst aus)
    _addPuddle(x, y, r) {
        this.puddles.push({ x, y, r: r || this._honeyR(), age: 0, life: this.phase === 2 ? 5.5 : 4.6, seed: Math.random() * 10 });
        while (this.puddles.length > HONEY_MAX) this.puddles.shift();
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) {
            // Mit ihr geht auch der Honig am Boden weg
            if (this.puddles.length) this.puddles.length = 0;
            return;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 47;
            BeeArt.burst(mx, my - 20, [BeeCfg.pollen, '#ffffff', BeeCfg.honey], 26, 210, 0.7, { kind: 'star' });
            BeeArt.ring(mx, my, BeeCfg.pollen, 106, 0.6, 6);
            BeeArt.shake(8, 0.45);
            BeeArt.text(mx, my - 60, 'Die Königin wird wütend!', '#ffd23f', 13, 1.4);
        }
        this._honeyTick(dt, player);
        const still = this.state === 'intro' || this.state === 'dizzy';
        if (!still) {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (this.state !== 'salvoWind' && this.state !== 'salvoFire' && Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'salvoWind':
                this._aimSalvo(player, mx, my, px, py);
                if (this.stateT <= 0) {
                    this.fanWaves = this.phase === 2 ? 2 : 1;
                    this.fanT = 0;
                    this._set('salvoFire', this.phase === 2 ? 0.92 : 0.38);
                }
                break;
            case 'salvoFire': this._salvo(dt, projectiles); break;
            case 'swarmWind':
                if (this.stateT <= 0) {
                    this._set('swarmCall', 0.34);
                    this._summonBees(enemies, world);
                }
                break;
            case 'swarmCall':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'honeyWind':
                if (this.stateT <= 0) {
                    this._spitHoney(projectiles);
                    this._set('honeyDrop', 0.5);
                }
                break;
            case 'honeyDrop':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'dizzy':
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.45 : 0.8;
                    this._set('walk', 0);
                }
                break;
            default:                  // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        BeeArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster großer Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 3.2;
        let vx = 0, vy = 0;
        if (dist > 148) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 78) { vx = -dx / dist; vy = -dy / dist; }
        else {
            const s = this.seed > 5 ? 1 : -1;
            vx = (-dy / dist) * s;
            vy = (dx / dist) * s;
        }
        // Schweben: sie schaukelt sanft auf und ab, während sie um Mark kreist
        vx += Math.sin(this.step * 1.6) * 0.25;
        vy += Math.cos(this.step * 2.1) * 0.25;
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        if (typeof FX !== 'undefined' && Math.random() < dt * 5) BeeArt.pollenFx(this.centerX(), this.centerY() + 22);
        this.cool -= dt;
        if (this.cool > 0) return;
        const cyc = this.phase === 2 ? BossBeeQueen.CYCLE2 : BossBeeQueen.CYCLE1;
        const what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'salvo') this._startSalvo();
        else if (what === 'honey') this._startHoney(player, world);
        else if (what === 'swarm') this._startSwarm(world);
        else this.cool = this.phase === 2 ? 0.45 : 0.9;        // bewusste Verschnaufpause
    }

    // ── a) Stachelsalve: mehrere Stacheln entlang angesagter Bahnen ──
    _startSalvo() {
        this.fanLock = false;
        this.fanA2 = null;
        this.fanWaves = 0;
        this.fanFriend = null;
        const opts = BeeArt.companions();
        if (opts.length && Math.random() < 0.7) this.fanFriend = opts[Math.floor(Math.random() * opts.length)];
        this._set('salvoWind', this.phase === 2 ? 0.72 : 0.94);
    }

    // Zielpunkt und Bahnen werden in der Ansage sichtbar und danach nicht mehr umgeworfen
    _aimSalvo(player, mx, my, px, py) {
        if (!this.fanLock) {
            const near = BeeArt.nearTarget(player, mx, my, 460);
            if (near) {
                const m = this._muzzle();
                this.fanA = Math.atan2(near.t.y - m.y, near.t.x - m.x);
                if (Math.abs(Math.cos(this.fanA)) > 0.2) this.face = Math.cos(this.fanA) > 0 ? 1 : -1;
            }
            if (this.stateT <= this.stateDur * 0.35) {
                this.fanA2 = this._fanA2(player, px, py);
                this.fanLock = true;
            }
        }
    }

    // Richtung der zweiten Welle (Phase 2): steht schon fest, bevor der erste Stachel fliegt
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

    // Wellen der Salve: Phase 1 eine, Phase 2 zwei – und die zweite fliegt die angesagte zweite Bahn
    _salvo(dt, projectiles) {
        this.fanT -= dt;
        if (this.fanT <= 0 && this.fanWaves > 0) {
            const wave = this.fanWaves;
            this.fanWaves--;
            this.fanT = 0.34;
            if (wave === 1 && this.fanA2 !== null) this.fanA = this.fanA2;
            this._fireSalvo(projectiles);
        }
        if (this.stateT <= 0 || (this.fanWaves === 0 && this.fanT <= 0)) this._afterBig();
    }

    _fireSalvo(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const m = this._muzzle();
        const n = this._fanN();
        const step = 0.19;
        BeeArt.burst(m.x, m.y, [BeeCfg.pollen, BeeCfg.yellow, '#ffffff'], 11, 145, 0.4, { kind: 'spark' });
        BeeArt.shake(3, 0.16);
        if (!list) return;
        for (let i = 0; i < n; i++) {
            if (list.length > STINGER_CAP) break;
            const a = this.fanA + (i - (n - 1) / 2) * step;
            list.push(new Stinger(m.x + Math.cos(a) * 10, m.y + Math.sin(a) * 10, a, randRange(168, 190)));
        }
    }

    // ── b) Bienenschwarm: angesagte Waben, dann tauchen Bienen auf ──
    _startSwarm(world) {
        const mx = this.centerX(), my = this.centerY();
        const player = typeof Game !== 'undefined' ? Game.player : null;
        const n = this._swarmN() + 2;            // zwei Waben mehr als Bienen: man sieht, was kommen kann
        const room = BeeArt.room(world);
        const spots = [];
        for (let i = 0; i < n; i++) {
            for (let versuch = 0; versuch < 8; versuch++) {
                const a = (i / n) * TAU + (player ? Math.atan2(player.y + player.h / 2 - my, player.x + player.w / 2 - mx) : 0) * 0.2;
                const d = 52 + (i % 3) * 20;
                let x = mx + Math.cos(a) * d, y = my + Math.sin(a) * d * 0.85;
                if (room) {
                    x = clamp(x, room.x + 16, room.x + room.w - 16);
                    y = clamp(y, room.y + 16, room.y + room.h - 16);
                }
                if (BeeArt.free(world, x, y, 12)) { spots.push({ x, y }); break; }
            }
        }
        this.spots = spots;
        this._set('swarmWind', 0.82);
    }

    // Ruf: höchstens _swarmMax() eigene Bienen zugleich (G-09) und nie in eine Wand (G-08)
    _summonBees(enemies, world) {
        this.minions = (this.minions || []).filter(m => !m.dead);
        BeeArt.ring(this.centerX(), this.centerY(), BeeCfg.pollen, 90, 0.45, 5);
        BeeArt.shake(4, 0.2);
        BeeArt.text(this.centerX(), this.y + 8, 'Schwarm!', BeeCfg.pollen, 13, 1.2);
        if (!enemies) return;
        let i = 0;
        const want = this._swarmN();
        for (const s of this.spots) {
            if (i >= want || this.minions.length >= this._swarmMax()) break;
            const m = new Bee(s.x, s.y);
            m.isKeyGhost = false;
            m._engaged = true;                    // frisch geschlüpft: erst fliegen, dann stechen
            m.cool = randRange(0.5, 1.1);
            m.x = s.x - m.w / 2;
            m.y = s.y - m.h / 2;
            this.minions.push(m);
            enemies.push(m);
            BeeArt.burst(s.x, s.y, [BeeCfg.pollen, BeeCfg.yellow, '#ffffff'], 12, 130, 0.5, { kind: 'star' });
            BeeArt.ring(s.x, s.y, BeeCfg.pollen, 26, 0.36, 3);
            i++;
        }
        this.spots = [];
    }

    // ── c) Honigpfützen: Kreise ansagen, dann spucken ──
    _startHoney(player, world) {
        const mx = this.centerX(), my = this.centerY();
        const room = BeeArt.room(world);
        const n = this.phase === 2 ? 3 : 2;
        const pts = BeeArt.targets(player)
            .map(t => ({ t, d: Math.hypot(t.x - mx, t.y - my) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, n)
            .map(o => ({ x: o.t.x, y: o.t.y }));
        // Sind weniger Ziele dabei, kommen die übrigen Punkte um Mark herum
        const c = pts.length ? pts[0] : { x: mx + this.face * 46, y: my + 20 };
        for (const o of [{ a: 2.35, d: 46 }, { a: 0.85, d: 46 }, { a: 4.7, d: 52 }]) {
            if (pts.length >= n) break;
            const x = c.x + Math.cos(o.a) * o.d, y = c.y + Math.sin(o.a) * o.d;
            pts.push({ x, y });
        }
        this.honey = pts.filter(p => !room || (p.x > room.x + 12 && p.x < room.x + room.w - 12 &&
            p.y > room.y + 12 && p.y < room.y + room.h - 12));
        if (!this.honey.length) this.honey = [{ x: mx + this.face * 40, y: my + 26 }];
        this._set('honeyWind', this.phase === 2 ? 0.66 : 0.84);
    }

    _spitHoney(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const m = this._muzzle();
        if (!list) return;
        for (const p of this.honey) {
            list.push(new HoneyGlob(m.x, m.y, p.x, p.y, this, this._honeyR()));
        }
        BeeArt.burst(m.x, m.y, [BeeCfg.honey, BeeCfg.honeyLight], 8, 110, 0.4, { kind: 'dot', gravity: 200 });
        BeeArt.shake(2.2, 0.12);
    }

    // Nach großen Angriffen: Verschnaufpause – und bei wenig Leben wird sie schwindelig.
    _afterBig() {
        this.honey = [];
        const low = this.hp <= this.maxHp * 0.35;
        if (low) {
            this._set('dizzy', this.hp <= this.maxHp * 0.2 ? 2.2 : 1.7);
            BeeArt.burst(this.centerX(), this.y + 10, ['#ffe35a', '#ffffff'], 12, 100, 0.5, { kind: 'star' });
            return;
        }
        if (this.phase === 2 && this.seq % 2 === 0) {
            this._set('dizzy', 1.3);
            BeeArt.burst(this.centerX(), this.y + 10, ['#ffe35a', '#ffffff'], 9, 90, 0.45, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.5 : 0.9;
        this._set('pant', this.cool + 0.4);
    }

    // Ansagen am Boden: Stachelbahnen, Waben des Schwarms, Honigkreise – immer vor allen Figuren,
    // dazu die Honigpfützen selbst (sie liegen unter den Figuren).
    drawUnder(ctx, camera) {
        if (this.dead) return;
        // Honigpfützen liegen am Boden und gehören unter die Figuren
        for (const p of this.puddles) {
            const q = camera.worldToScreen(p.x, p.y);
            BeeArt.puddle(ctx, q.x, q.y, p.r, p.age, p.life, p.seed);
        }
        const st = this.state;
        const k = this._k();
        if (st === 'salvoWind' || st === 'salvoFire') {
            const m = this._muzzle();
            const p = camera.worldToScreen(m.x, m.y);
            const n = this._fanN();
            const step = 0.19;
            // Genau die Bahnen, die gleich fliegen (Ansage = Treffer)
            for (let i = 0; i < n; i++) {
                LateWorldArt.lane(ctx, p.x, p.y, this.fanA + (i - (n - 1) / 2) * step, 210, 15,
                    st === 'salvoFire' ? 1 : k, BeeCfg.warn);
            }
            if (st === 'salvoFire' && this.fanWaves > 0 && this.fanA2 !== null && this.fanA2 !== this.fanA) {
                // die noch kommende zweite Welle steht schon sichtbar in der Landschaft
                for (let i = 0; i < n; i++) {
                    LateWorldArt.lane(ctx, p.x, p.y, this.fanA2 + (i - (n - 1) / 2) * step, 210, 15, 0.75, BeeCfg.warn);
                }
            }
            if (st === 'salvoWind') Art.ring(ctx, p.x, p.y, 20 + 12 * k, BeeCfg.pollen, 2.4, 0.3 + 0.3 * k);
            return;
        }
        if (st === 'swarmWind' || st === 'swarmCall') {
            for (const s of this.spots) {
                const p = camera.worldToScreen(s.x, s.y);
                BeeArt.hex(ctx, p.x, p.y, 20, BeeCfg.pollen, st === 'swarmCall' ? 1 : k, Art.time + s.x * 0.01);
            }
            return;
        }
        if (st === 'honeyWind' || st === 'honeyDrop') {
            for (const h of this.honey) {
                const p = camera.worldToScreen(h.x, h.y);
                LateWorldArt.warn(ctx, p.x, p.y, this._honeyR(), st === 'honeyDrop' ? 1 : k, BeeCfg.warnHoney);
            }
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
        if (this.state === 'dizzy') {
            // kreisende Sterne über der Krone: sie ist kurz wehrlos – Marks Zeit zum Zurückhauen
            ctx.translate(0, -70);
            LateWorldArt.dizzy(ctx, 0, 0, 30, 5);
        }
        ctx.restore();
    }

    // Bienenkönigin: dieselbe Figur wie die kleinen Bienen, 2,5-mal so groß, mit Königinnenkrone,
    // langem Hinterleib und vier Streifen; Phase 2 mit roten Augen und leuchtendem Stachel.
    _body(ctx, dead) {
        const S = 2.5;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const intro = st === 'intro';
        const salvoWind = st === 'salvoWind' ? k : 0;
        const salvoFire = st === 'salvoFire';
        const swarm = st === 'swarmWind' || st === 'swarmCall';
        const honey = st === 'honeyWind' || st === 'honeyDrop';
        const wind = Math.max(salvoWind, honey ? k : 0, swarm ? k * 0.7 : 0);
        const bob = dead ? -1 : Math.sin(t * 1.9) * 1.6 + (intro ? 2 : 0) + wind * 1.6 - (rest ? 1.2 : 0) + (dizzy ? Math.sin(t * 5) * 1.4 : 0);
        const squ = dead ? 0 : Math.sin(t * (this.moving ? 7 : 3.4)) * 0.012;
        ctx.save();
        ctx.scale(S, S);
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (!dead) Art.glow(ctx, 0, -18, 30, p2 ? BeeCfg.honey : BeeCfg.pollen, 0.22 + 0.08 * Math.sin(t * 2.6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy' : (wind || intro) ? 'open' : rest ? 'tired' : 'angry';
        BeeArt.figure(ctx, {
            c: C_BEE_QUEEN, lw: 1.5, t: t / 2, bob: bob / S,
            flap: 17,
            wing: clamp(wind * 0.8 + (intro ? 0.5 : 0) + (dizzy ? 0.2 : 0), 0, 1),
            dash: salvoFire ? 0.6 : 0,
            sting: clamp(wind + (salvoFire ? 0.6 : 0), 0, 1),
            crown: 2,
            queen: true,
            bands: 4,
            red: p2,
            mood,
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        ctx.restore();
    }
}

// Reihenfolge der großen Angriffe (Phase 1 und 2). 'rest' ist die bewusste Verschnaufpause.
BossBeeQueen.CYCLE1 = ['salvo', 'honey', 'swarm', 'rest'];
BossBeeQueen.CYCLE2 = ['salvo', 'honey', 'salvo', 'swarm', 'rest'];
