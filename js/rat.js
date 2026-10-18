// ── Welt 52: Rattenkanal (Idee von Leander) ──
// Ratte mit grauer Eisenrüstung und Schwert – braunes Fell, grosse runde Ohren, lange Schnauz, langer
//   Schwanz, darueber die graue Eisenrüstung mit Schulterruckern. Sie sticht schnell zu (0,42 s vorher
//   liegt eine rote Bahn am Boden, dann rennt sie genau diese Bahn entlang) oder schlaegt mit dem Schwert
//   (0,5 s vorher steht ein roter Kreis da, genau da landet der Schlag). Beides macht Schaden.
//   Schluesseltraeger (Claude ausgesucht): GOLDENE Ruestung mit rotem Federbusch, haelt mehr aus, ist
//   schneller und haengt Stich und Schlag direkt aneinander.
// Boss: RIESENRATTE – Endgegner von Welt 52, bleibt im Boss-Raum (runde Halle mit Gullydeckel), 145 LP,
//   zwei Schwerter, zwei Phasen.
//   Schwertkreise: holt aus (grosser Warnkreis um ihn), dann dreht er sich mit beiden Schwertern und
//     rutscht auf Mark zu. Wer in den Kreis kommt, wird getroffen – der Kreis bleibt waehrend der Drehung
//     sichtbar.
//   Schwerter in den Boden: er hebt beide Schwerter, ein riesiger Warnkreis steht vorher fest (1,15 s),
//     dann faehrt er hin und staecht beide Schwerter in den Boden – riesige Explosion mit Feuerball,
//     Bodenwackeln und weissem Blitz.
//   Phase 2 (halbe LP): schneller, langere Drehung, die Explosion kommt zweimal hintereinander.
//   Mit wenig Leben wird er schwindelig (kreisende Sterne, kurz wehrlos) – Marks Zeit zum Zurueckhauen.
//   Leander will genau diese Wirkungen: KEIN Gift, kein Schlaf, kein Schleim, keine zusaetzlichen Zustaende.
//   Freunde verschwinden nie: ein Treffer, der Juri oder das Krokodil besiegen wuerde, haut sie nur um.

const RatCfg = {
    fur: '#9a7b60',           // braunes Fell – hebt sich von den hellen Steinwegen der Welt ab
    furMid: '#7d6049',
    furDark: '#5d4535',
    belly: '#cdb79d',
    ear: '#e2a8a2',           // Innenohr
    nose: '#e0757f',
    whisker: '#f2e8d8',
    tooth: '#fffaf0',
    iron: '#96a2ae',          // graue Eisenrüstung (Wunsch von Leander)
    ironMid: '#7a8694',
    ironDark: '#59636f',
    rivet: '#cbd5df',
    bossIron: '#7c8896',      // der Riese traegt daesseres, verbeultes Eisen
    bossMid: '#616d7c',
    bossDark: '#454f5c',
    gold: '#ffc93c',          // goldene Ruestung des Schluesseltraegers
    goldMid: '#e0a323',
    goldDark: '#a06a10',
    plume: '#e0334a',         // roter Federbusch
    plumeDark: '#a81f33',
    steel: '#dde7f3',         // Schwertklinge
    steelMid: '#b8c8dc',
    steelDark: '#8fa0b6',
    grip: '#7a4a24',
    guard: '#c9a227',
    tail: '#dd9aa2',
    warn: '#ff5a3d',
    warnHot: '#ff3d5a',
    boom: '#ffab2e',
    boomHot: '#ff6a2a',
    boomLight: '#ffe9ae',
    star: '#ffe35a',
};

// Zwei Ruestungen: graues Eisen (alle) und vergoldetes Eisen mit rotem Busch (Schluesseltraeger)
const C_IRON = {
    fur: RatCfg.fur, furMid: RatCfg.furMid, furDark: RatCfg.furDark, belly: RatCfg.belly,
    plate: RatCfg.iron, plateMid: RatCfg.ironMid, plateDark: RatCfg.ironDark, trim: RatCfg.rivet,
};
const C_GOLD = {
    fur: RatCfg.fur, furMid: RatCfg.furMid, furDark: RatCfg.furDark, belly: RatCfg.belly,
    plate: RatCfg.gold, plateMid: RatCfg.goldMid, plateDark: RatCfg.goldDark, trim: '#fff2c0',
};
const C_BOSS = {
    fur: RatCfg.furMid, furMid: RatCfg.furDark, furDark: '#4a3527', belly: '#b8a288',
    plate: RatCfg.bossIron, plateMid: RatCfg.bossMid, plateDark: RatCfg.bossDark, trim: RatCfg.rivet,
};

const RAT_SPIN_R = 64;        // Radius der Schwertkreise (Phase 1)
const RAT_SPIN_R2 = 70;       // Radius in Phase 2
const RAT_BOOM_R = 116;       // Radius der riesigen Explosion (Phase 1)
const RAT_BOOM_R2 = 130;      // Radius in Phase 2
const RAT_LUNGE_T = 0.3;      // Zeit des Stich-Ansturms
const RAT_STAB_R = 17;        // Trefferradius der Schwertspitze
const RAT_LANE_W = 40;        // Breite der angesagten Stichbahn (deckt Spitze und Mark ab)

const RatArt = {
    // Schaden an Mark ueber die Engine (Wackeln, Ton, roter Rand); ohne Engine direkt.
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

    flash(color, strength) {
        if (typeof FX !== 'undefined' && FX.screenFlash) FX.screenFlash(color, strength);
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

    // Begleiter treffen: nie verschwinden lassen, ein toedlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(7);
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, ['#ffffff', RatCfg.steelMid], 9, 130, 0.42, { kind: 'star' });
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.bossDefeated ||
            typeof Game._bossRoomRect !== 'function') return null;
        if (world && Game.world && Game.world !== world) return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    // Punkt innerhalb des Boss-Raums, hoechstens `marg` vom Rand entfernt (fuer Explosionskreise)
    inRoom(x, y, marg) {
        const r = this.room();
        if (!r) return { x, y };
        return {
            x: clamp(x, r.x + marg, Math.max(r.x + marg, r.x + r.w - marg)),
            y: clamp(y, r.y + marg, Math.max(r.y + marg, r.y + r.h - marg)),
        };
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

    // Naechstes Ziel von (x, y) aus, hoechstens maxD weit – Mark oder ein Freund.
    nearTarget(player, x, y, maxD) {
        let best = null;
        for (const t of this.targets(player)) {
            const d = Math.hypot(t.x - x, t.y - y);
            if (d > maxD) continue;
            if (!best || d < best.d) best = { t, d };
        }
        return best;
    },

    // Flaechenschaden: trifft Mark und die Freunde innerhalb von R, jeder hoechstens einmal (hit-Liste).
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

    // ── Schwert: Griff bei (x, y), Klinge zeigt in Richtung a, Laenge len ──
    sword(ctx, x, y, a, len, o = {}) {
        const lw = o.lw || 1.1;
        const blade = o.blade || RatCfg.steel;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        Art.limb(ctx, -1.2, 0, -6.6, 0, 2.6, RatCfg.grip, { lineWidth: lw * 0.8 });
        Art.body(ctx, -6.8, 0, 1.9, 1.9, RatCfg.guard, { lineWidth: lw * 0.8 });
        Art.shape(ctx, g => {
            g.moveTo(3.6, -2.3);
            g.lineTo(len - 2.4, -1.5);
            g.lineTo(len + 2.6, 0);
            g.lineTo(len - 2.4, 1.5);
            g.lineTo(3.6, 2.3);
            g.closePath();
        }, { x: 3.4, y: -2.4, w: len - 0.6, h: 4.8 }, blade, { linear: true, lineWidth: lw });
        Art.limb(ctx, 5.4, -0.7, len - 3.2, -0.2, 0.9, RatCfg.steelMid, { lineWidth: lw * 0.5, outline: false });
        Art.box(ctx, 1.2, -4.8, 3.0, 9.6, 1.5, RatCfg.guard, { lineWidth: lw * 0.8, highlight: false });
        ctx.restore();
    },

    // ── Schwerterkreise: zwei Klingen, die um die Figur kreisen (cx, cy = Mitte) ──
    whirl(ctx, cx, cy, ang, len, o = {}) {
        const lw = o.lw || 1.1;
        for (let i = 0; i < 2; i++) {
            const a = ang + i * Math.PI;
            this.sword(ctx, cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, a, len, { lw, blade: o.blade });
        }
        // Fahrtwind: zwei dunge Boegen, damit die Drehung als Bewegung zu sehen ist
        const prev = ctx.globalAlpha;
        ctx.strokeStyle = o.wind || RatCfg.steelMid;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            const a = ang + i * Math.PI - 0.9;
            ctx.globalAlpha = prev * 0.45;
            ctx.beginPath();
            ctx.arc(cx, cy, len + 12, a, a + 0.8);
            ctx.stroke();
        }
        ctx.globalAlpha = prev;
    },

    // ── Feuerball der riesigen Explosion (t = 0..1) ──
    blast(ctx, x, y, R, t) {
        const k = clamp(t, 0, 1);
        const rr = R * (0.35 + 0.65 * k);
        Art.glow(ctx, x, y, rr * 1.15, RatCfg.boom, 0.85 * (1 - k * 0.75));
        const prev = ctx.globalAlpha;
        ctx.fillStyle = RatCfg.boomHot;
        ctx.globalAlpha = prev * 0.5 * (1 - k);
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = RatCfg.boom;
        ctx.globalAlpha = prev * 0.62 * (1 - k);
        ctx.beginPath();
        ctx.arc(x, y, rr * 0.72, 0, TAU);
        ctx.fill();
        ctx.fillStyle = RatCfg.boomLight;
        ctx.globalAlpha = prev * 0.8 * (1 - k);
        ctx.beginPath();
        ctx.arc(x, y, rr * 0.42, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = prev;
        // Flammenzungen am Rand
        for (let i = 0; i < 10; i++) {
            const a = (i * TAU) / 10 + k * 0.7;
            const zn = rr * (0.86 + 0.3 * Math.sin(Art.time * 14 + i));
            Art.limb(ctx, x + Math.cos(a) * rr * 0.7, y + Math.sin(a) * rr * 0.7,
                x + Math.cos(a) * zn, y + Math.sin(a) * zn, 7 * (1 - k * 0.6), RatCfg.boom,
                { lineWidth: 1, outline: RatCfg.boomHot });
        }
        Art.ring(ctx, x, y, rr * 1.04, RatCfg.boomLight, 3.4, 0.85 * (1 - k));
    },

    // ── Ganze Figur: Ratte von vorn, klarer Umriss, Fusspunkt (0, 0).
    // Eine Einheit = normale Ratte, der Boss zeichnet dieselbe Figur groesser (ctx.scale vorher).
    // p = { c, lw, t, bob, lean, walk, mood ('calm'|'angry'|'open'|'tired'|'dizzy'|'dead'), look,
    //       arms: { b: {x,y}, f: {x,y} }, angB, angF (Schwertwinkel beider Haende), swords (Anzahl Schwerter),
    //       swordLen, helm (Stahlhelm), plume (roter Federbusch), spikes (Boss-Schultern), dented (Phase 2) }
    figure(ctx, p) {
        const c = p.c, lw = p.lw;
        const y0 = -p.bob;
        const lean = p.lean || 0;
        const t = p.t, look = p.look || { x: 0, y: 0 };
        const len = p.swordLen || 15;
        const two = (p.swords || 1) >= 2;
        const mood = p.mood || 'angry';
        const sw = Math.sin(t * 3.1) * 4;

        // ── Schwanz (hinten, zeichnet unter der Figur) ──
        let px = 8.4, py = y0 - 7.4;
        const seg = [[15.4, y0 - 5.2 + sw * 0.3], [20.2, y0 - 11.0 + sw], [22.6, y0 - 19.0 + sw * 1.4]];
        for (let i = 0; i < seg.length; i++) {
            Art.limb(ctx, px, py, seg[i][0], seg[i][1], 3.1 - i * 0.75, RatCfg.tail, { lineWidth: lw * 0.7 });
            px = seg[i][0]; py = seg[i][1];
        }

        // ── Hinterer Arm (bei zwei Schwertern auch mit Klinge) ──
        const arm = (s, hd, ang, has) => {
            const shx = s * 7.8, shy = y0 - 20.8;
            Art.limb(ctx, shx, shy, hd.x, hd.y, s > 0 ? 3.1 : 2.8, c.fur, { lineWidth: lw * 0.8 });
            Art.body(ctx, hd.x, hd.y, 2.7, 2.7, c.furMid, { lineWidth: lw * 0.8 });
            if (has) this.sword(ctx, hd.x + s * 1.2, hd.y, ang, len, { lw, blade: p.blade });
        };
        arm(-1, p.arms.b, p.angB, !!p.angB && two);

        // ── Fuesse und Beine ──
        const walk = p.walk || 0;
        const lift = [Math.max(0, -walk) * 2.6, Math.max(0, walk) * 2.6];
        for (const s of [-1, 1]) {
            const lf = s < 0 ? lift[0] : lift[1];
            Art.limb(ctx, s * 5.2, y0 - 10.4, s * 6.2, y0 - 3.4 - lf * 0.5, 3.4, c.fur, { lineWidth: lw * 0.8 });
            Art.body(ctx, s * 6.6, y0 - 2.2 - lf, 4.3, 2.5, c.furMid, { lineWidth: lw * 0.8 });
        }

        // ── Koerper: Fellbauch, darueber die Ruestung ──
        Art.body(ctx, 0, y0 - 15.4, 11.6, 10.8, c.fur, { lineWidth: lw });
        Art.body(ctx, lean * 0.3, y0 - 12.6, 7.4, 6.6, c.belly, { highlight: false, lineWidth: lw * 0.7 });
        Art.shape(ctx, g => {
            g.moveTo(-9.4, y0 - 22.6);
            g.quadraticCurveTo(0, y0 - 26.0, 9.4, y0 - 22.6);
            g.lineTo(7.8, y0 - 10.6);
            g.quadraticCurveTo(0, y0 - 7.4, -7.8, y0 - 10.6);
            g.closePath();
        }, { x: -9.6, y: y0 - 26.2, w: 19.2, h: 19 }, c.plate, { linear: true, lineWidth: lw });
        // Bauchreife mit Guertelschnalle und Nieten
        Art.limb(ctx, -7.9, y0 - 11.4, 7.9, y0 - 11.4, 2.2, c.plateDark, { lineWidth: lw * 0.7 });
        ctx.fillStyle = c.trim;
        for (const d of [-6.2, 0, 6.2]) {
            ctx.beginPath();
            ctx.arc(d + lean * 0.2, y0 - 19.6, 0.95, 0, TAU);
            ctx.fill();
        }
        Art.body(ctx, lean * 0.4, y0 - 16.2, 2.5, 2.2, c.trim, { lineWidth: lw * 0.6, glossy: true });
        if (p.dented) {
            // Dellen und Kratzer in Phase 2: der Riese hat schon viel einstecken muessen
            ctx.strokeStyle = c.plateDark;
            ctx.lineWidth = lw * 0.9;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-6.6, y0 - 20.6); ctx.lineTo(-3.4, y0 - 17.4); ctx.lineTo(-5.8, y0 - 13.6);
            ctx.moveTo(5.8, y0 - 22.4); ctx.lineTo(3.2, y0 - 19.2);
            ctx.stroke();
        }
        // Schulterruckern (der Boss mit Spitzen)
        for (const s of [-1, 1]) {
            Art.body(ctx, s * 10.2, y0 - 21.4, 4.9, 3.8, c.plateMid, { rot: s * 0.35, lineWidth: lw * 0.9 });
            if (p.spikes) {
                Art.shape(ctx, g => {
                    g.moveTo(s * 12.6, y0 - 24.2);
                    g.lineTo(s * 15.6, y0 - 28.6);
                    g.lineTo(s * 11.4, y0 - 26.2);
                    g.closePath();
                }, { x: Math.min(s * 11.4, s * 15.6), y: y0 - 28.8, w: Math.abs(15.6 - 11.4), h: 4.6 },
                    c.plateDark, { lineWidth: lw * 0.7 });
            }
        }

        // ── Kopf: grosse runde Ohren, lange Schnauze, Schnurrhaare ──
        const hx = lean * 1.2, hy = y0 - 30.8;
        for (const s of [-1, 1]) {
            Art.body(ctx, hx + s * 6.4, hy - 5.2, 4.9, 4.9, c.fur, { lineWidth: lw });
            Art.body(ctx, hx + s * 6.4, hy - 5.0, 2.9, 2.9, RatCfg.ear, { highlight: false, lineWidth: lw * 0.6 });
        }
        Art.body(ctx, hx, hy, 7.7, 7.0, c.fur, { lineWidth: lw });
        // Schnauze: lang und spitz, zeigt in Blickrichtung
        const nx = hx + 6.2, ny = hy + 2.6 + look.y * 1.1;
        Art.shape(ctx, g => {
            g.moveTo(hx - 2.2, hy - 3.4);
            g.quadraticCurveTo(hx + 5.2, hy - 2.2, nx + 6.6, ny);
            g.quadraticCurveTo(hx + 5.4, hy + 6.2, hx - 1.2, hy + 5.6);
            g.closePath();
        }, { x: hx - 2.4, y: hy - 3.6, w: nx + 6.8 - hx + 2.4, h: 10 }, c.fur, { lineWidth: lw });
        Art.body(ctx, nx + 6.0, ny, 2.0, 1.8, RatCfg.nose, { lineWidth: lw * 0.8 });
        // Schnurrhaare
        ctx.strokeStyle = RatCfg.whisker;
        ctx.lineWidth = Math.max(0.8, lw * 0.55);
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            ctx.moveTo(nx + 4.6, ny + 0.6);
            ctx.lineTo(nx + 12.6, ny - 2.6 + i * 3.2);
            ctx.moveTo(nx - 1.6, ny + 1.4);
            ctx.lineTo(nx - 8.6, ny + 0.2 + i * 3.0);
        }
        ctx.stroke();
        // Nagezaehne
        Art.box(ctx, nx + 2.0, ny + 1.6, 1.9, 2.6, 0.7, RatCfg.tooth, { lineWidth: lw * 0.6, highlight: false });
        Art.box(ctx, nx + 4.1, ny + 1.6, 1.9, 2.6, 0.7, RatCfg.tooth, { lineWidth: lw * 0.6, highlight: false });
        // Augen
        const ex = 3.3;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, hx + 1.0, hy - 1.2, 1.9, ex);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = RatCfg.furDark;
            ctx.lineWidth = lw * 0.9;
            ctx.lineCap = 'round';
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.25 + i * 0.13;
                    const x = hx + 1.0 + s * ex + Math.cos(a) * r, y = hy - 1.2 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                const ox = hx + 1.0 + s * ex + look.x * 0.7, oy = hy - 1.2 + look.y * 0.5;
                Art.eye(ctx, ox, oy, 2.1, look, {
                    angry: mood === 'angry' || mood === 'open', open: mood === 'tired' ? 0.55 : 1,
                    iris: p.hot ? RatCfg.warnHot : (mood === 'angry' || mood === 'open' ? '#c9452f' : '#7a5230'), seed: p.seed || 0,
                });
            }
        }
        // ── Stahlhelm (nur gepanzerte tragen einen) ──
        if (p.helm) {
            Art.shape(ctx, g => {
                g.moveTo(hx - 7.5, hy - 1.8);
                g.quadraticCurveTo(hx - 8.0, hy - 9.8, hx, hy - 10.0);
                g.quadraticCurveTo(hx + 8.0, hy - 9.8, hx + 7.5, hy - 1.8);
                g.closePath();
            }, { x: hx - 8.2, y: hy - 10.2, w: 16.4, h: 9 }, c.plate, { linear: true, lineWidth: lw });
            Art.limb(ctx, hx - 7.3, hy - 2.4, hx + 7.3, hy - 2.4, 2.1, c.plateDark, { lineWidth: lw * 0.6 });
            if (p.spikes) Art.limb(ctx, hx, hy - 4.0, hx, hy - 9.4, 1.9, c.plateDark, { lineWidth: lw * 0.6 });
        }
        // ── Roter Federbusch (Schluesseltraeger) ──
        if (p.plume) {
            const top = p.helm ? hy - 9.6 : hy - 7.4;
            Art.glow(ctx, hx - 1.6, top - 6, 15, RatCfg.plume, 0.28);
            for (let i = 0; i < 4; i++) {
                const a = -1.9 + i * 0.32 + Math.sin(t * 2.4 + i) * 0.07;
                const l = 9.5 - Math.abs(i - 1.5) * 1.6;
                Art.limb(ctx, hx - 0.6, top - 1.0, hx - 0.6 + Math.cos(a) * l, top - 1.0 + Math.sin(a) * l,
                    3.4 - i * 0.35, i % 2 ? RatCfg.plume : RatCfg.plumeDark, { lineWidth: lw * 0.7 });
            }
            Art.body(ctx, hx - 0.6, top - 1.2, 2.4, 2.2, RatCfg.plume, { lineWidth: lw * 0.7 });
        }

        // ── Vorderer Arm (mit Schwert, immer ueber dem Koerper) ──
        arm(1, p.arms.f, p.angF, !!p.angF);
        return { hx, hy };
    },
};

// ══════════════════════════════════════════
// ── Gepanzerte Ratte mit Schwert ──
// ══════════════════════════════════════════

// Ratte in grauer Eisenrüstung (Hitbox 28×30, 8 LP, Schluesseltraeger 10 LP). Sie laeuft nah heran und
// waehlt dann einen der beiden Angriffe:
//   Stich  – 0,42 s liegt eine rote Bahn am Boden (beim Schluesseltraeger 0,34 s), dann rennt sie genau
//            diese Bahn entlang und trifft mit der Schwertspitze (2 Schaden).
//   Schlag – 0,5 s steht ein roter Kreis (26 Radius) am Boden, genau da landet der Schwertschwung (2 Schaden).
// Beides trifft auch Juri und das Schattenkrokodil; die werden nie besiegt, nur umgehauen.
class ArmorRat extends Enemy {
    constructor(x, y) {
        super(x, y, 28, 30);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(54, 64);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = RatCfg.iron;
        this.seed = Math.random() * 10;
        this.detectionRange = 240;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.8, 1.9);
        this.step = 0;
        this.moving = false;
        this.gold = false;              // goldene Ruestung (Schluesseltraeger)
        this.aimAng = 0;                // Richtung des Stichs (bleht stehen, sobald die Bahn gezeigt wird)
        this.aimLen = 70;
        this.aimLock = false;
        this.aim = null;                // Zielpunkt des Schwunges
        this.hit = [];                  // im laufenden Angriff schon getroffene Figuren
        this.combo = 0;                 // Schnellfolge des Schluesseltraegers: 1 = Schlag folgt direkt
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.gold ? C_GOLD : C_IRON; }

    // Spitze des Schwertes in Blickrichtung
    _tip(dist) {
        const d = dist === undefined ? 22 : dist;
        return {
            x: this.centerX() + Math.cos(this.aimAng) * d,
            y: this.centerY() + 2 + Math.sin(this.aimAng) * d,
        };
    }

    _rushSpeed() { return this.gold ? 372 : 330; }

    // Laenge der angesagten Bahn: bis dorthin, wo die Spitze im Ansturm hoechstens hinkommt,
    // zueglich ihr Trefferradius – so passt der Kreis der Spitze in jedem Bild in die Bahn.
    _laneReach() { return this.aimLen - 8 + this._rushSpeed() * RAT_LUNGE_T + RAT_STAB_R; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schluesseltraeger (Flag setzt main.js nach dem Erzeugen): goldene Ruestung, zaeher, schneller
            this._keyInit = true;
            this.gold = true;
            this.hp = this.maxHp = 10;
            this.speed *= 1.12;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        const busy = this.state === 'stabWind' || this.state === 'lunge' ||
            this.state === 'swingWind' || this.state === 'swing';
        if (!busy) {
            // Blick und Schwert bleiben während Ansatz und Angriff stehen: die Ansage gilt wirklich.
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('rattle', 0.6);   // Ruestung klappert: Kinder hoeren und sehen die Ratte zuerst
            RatArt.burst(mx, my - 12, [RatCfg.rivet, RatCfg.steelMid, '#ffffff'], 7, 70, 0.45, { kind: 'spark' });
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'rattle':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'stabWind':
                if (!this.aimLock) {
                    const near = RatArt.nearTarget(player, mx, my, 230);
                    if (near) {
                        this.aimAng = Math.atan2(near.t.y - my, near.t.x - mx);
                        this.aimLen = clamp(near.d + 30, 54, 108);
                        if (Math.abs(Math.cos(this.aimAng)) > 0.25) this.face = Math.cos(this.aimAng) > 0 ? 1 : -1;
                    }
                    if (this.stateT <= this.stateDur * 0.4) {
                        this.aimLock = true;   // Bahn steht jetzt fest
                        this.laneFrom = { x: mx, y: my + 2 };   // ab hier bleibt ihr Anfang stehen, auch im Ansturm
                    }
                }
                if (this.stateT <= 0) {
                    this.hit = [];
                    this._set('lunge', RAT_LUNGE_T);
                }
                break;
            case 'lunge': {
                // Sie rennt die angesagte Bahn entlang und trifft mit der Spitze, wer darin steht.
                const sp = this._rushSpeed();
                const ux = Math.cos(this.aimAng), uy = Math.sin(this.aimAng);
                const from = this.laneFrom || { x: mx, y: my + 2 };
                // Der Ansturm endet spaetestens am Bahnende – auch bei langsamen Bildern.
                const used = (mx - from.x) * ux + (my + 2 - from.y) * uy;
                const step = Math.min(sp * dt, Math.max(0, sp * RAT_LUNGE_T - used));
                const blocked = Kit915.rush(this, ux * step, uy * step, world);
                // Seitlichen Abtrieb ausgleichen (Stoss von Marks Hieben, Schluppf an der Wand):
                // die Spitze liegt auf der Bahn, bevor sie in diesem Bild treffen kann.
                const cx = this.centerX(), cy = this.centerY();
                const off = -(cx - from.x) * uy + (cy + 2 - from.y) * ux;
                if (Math.abs(off) > 0.25) { this.x += off * uy; this.y -= off * ux; }
                this.moving = true;
                this.step += dt * 22;
                const tip = this._tip(this.aimLen - 8);
                RatArt.areaHit(tip.x, tip.y, RAT_STAB_R, 2, 200, this.hit);
                if (blocked || this.stateT <= 0) {
                    if (this.gold && this.combo > 0) { this._startSwing(player); break; }
                    this.cool = this.gold ? randRange(0.75, 1.1) : randRange(1.05, 1.6);
                    this._set('recover', 0.24);
                }
                break;
            }
            case 'swingWind':
                if (this.stateT <= 0) {
                    this._swingHit();
                    this._set('swing', 0.22);
                }
                break;
            case 'swing':
            case 'recover':
                if (this.stateT <= 0) {
                    if (this.state === 'swing' && this.gold && this.combo > 0) {
                        this.combo = 0;
                        this._startStab(true);   // der zweite Stich schliesst die Kette ab
                        break;
                    }
                    this.cool = this.gold ? randRange(0.8, 1.2) : randRange(1.1, 1.7);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: nah heran, dann stechen oder schlagen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.2;
            Kit915.rush(this, Math.sin(this.step) * this.speed * 0.22 * dt, Math.cos(this.step * 0.7) * this.speed * 0.22 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 44) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 22) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 8.4;
        } else this.step += dt * 1.6;
        if (this.cool > 0) return;
        if (dist < 40) { this._startSwing(player); return; }
        if (dist < 128) { this._startStab(false); return; }
        this.cool = 0.5;
    }

    // Stich: Ziel und Richtung werden jetzt festgelegt und nicht mehr geaendert.
    // chain = true ist der Folgestich nach einem Schlag: der bringt die Folge zum Abschluss.
    _startStab(chain) {
        this.aimLock = false;
        this.combo = (this.gold && !chain) ? 1 : 0;
        if (!(this.aimLen > 0)) this.aimLen = 54;
        this.laneFrom = { x: this.centerX(), y: this.centerY() + 2 };
        this._set('stabWind', this.gold ? 0.34 : 0.42);
    }

    // Schlag: der rote Kreis steht fest, bevor der Schwung kommt.
    _startSwing(player) {
        const near = RatArt.nearTarget(player, this.centerX(), this.centerY(), 80);
        const t = near ? near.t : { x: this.centerX() + this.face * 26, y: this.centerY() + 2 };
        this.aim = { x: t.x, y: t.y };
        if (Math.abs(t.x - this.centerX()) > 3) this.face = t.x > this.centerX() ? 1 : -1;
        this.hit = [];
        this._set('swingWind', this.gold ? 0.4 : 0.5);
    }

    // Der Schwung landet genau dort, wo der rote Kreis stand.
    _swingHit() {
        const a = this.aim || { x: this.centerX() + this.face * 24, y: this.centerY() + 2 };
        RatArt.areaHit(a.x, a.y, 26, 2, 190, this.hit);
        RatArt.shake(2.2, 0.12);
        RatArt.burst(a.x, a.y, [RatCfg.steel, '#ffffff', RatCfg.steelMid], 9, 140, 0.34, { kind: 'spark' });
        RatArt.ring(a.x, a.y, RatCfg.steelMid, 26, 0.22, 3.2);
    }

    // Ansagen am Boden: Stichbahn und Schlagkreis – unter allen Figuren, damit nichts verdeckt wird
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st === 'stabWind' || st === 'lunge') {
            // Die Bahn steht in voller Laenge fest, bevor der Ansturm laeuft: die Spitze bleibt immer darin.
            const from = this.laneFrom || { x: this.centerX(), y: this.centerY() + 2 };
            const p = camera.worldToScreen(from.x, from.y);
            LateWorldArt.lane(ctx, p.x, p.y, this.aimAng, this._laneReach(), RAT_LANE_W, this._k(), RatCfg.warn);
            if (st === 'lunge') {
                const t = this._tip(this.aimLen - 8);
                const q = camera.worldToScreen(t.x, t.y);
                LateWorldArt.warn(ctx, q.x, q.y, RAT_STAB_R, 1, RatCfg.warn);
            }
            return;
        }
        if (st === 'swingWind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 26, this._k(), RatCfg.warn);
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
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 20 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Ratte mit Fusspunkt (0, 0); gezeichnet in RatArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const wind = st === 'stabWind' ? k : 0;
        const lunge = st === 'lunge' ? 1 : 0;
        const swingWind = st === 'swingWind' ? k : 0;
        const swing = st === 'swing' ? 1 : 0;
        const rattle = st === 'rattle' ? Math.sin(t * 30) * 1.3 : 0;
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.3 : Math.sin(t * 2.4) * 0.5) + (lunge ? -1.4 : 0);
        const lean = dead ? 0 : wind * 2.6 + (lunge ? -3.2 : 0) + swingWind * 1.8 + rattle;
        const faceAng = this.look.x * this.face >= 0 ? 0 : Math.PI;
        // Schwert: hinten am Koerper, vorn je Zustand (angestellt ueber der Schulter, beim Stich lang vorn)
        let hb = { x: -12.6, y: -13 + Math.max(0, -walk) * 2 };
        let hf = { x: 13.2, y: -13 - Math.max(0, walk) * 2 };
        let aB = 0, aF = faceAng - 0.9 + Math.sin(t * 2.2) * 0.12;
        if (wind) { hf = { x: -4 - wind * 5, y: -24 - wind * 4 }; aF = Math.PI + 0.5; }
        else if (lunge) { hf = { x: 17, y: -14 }; aF = 0.05; }
        else if (swingWind) { hf = { x: -2 - swingWind * 4, y: -26 - swingWind * 3 }; aF = -2.2; }
        else if (swing) { hf = { x: 18, y: -8 }; aF = 0.85; }
        else if (st === 'rattle') { hb = { x: -10, y: -20 + rattle }; hf = { x: 10, y: -20 - rattle }; aF = -0.6; }
        else if (st === 'recover') { hf = { x: 14, y: -10 }; aF = 0.5; }
        ctx.save();
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -18, 26, RatCfg.gold, 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (wind || lunge || swingWind || swing) ? 'open' : tired ? 'tired' : 'angry';
        RatArt.figure(ctx, {
            c, lw: 1.2, t, seed: this.seed, bob, lean, walk, mood,
            arms: { b: hb, f: hf }, angB: aB, angF: aF, swords: 1, swordLen: 15,
            helm: true, plume: this.gold && !dead,
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        if ((lunge || swing) && !dead) {
            const tp = this._tip(20);
            RatArt.burst(tp.x - this.centerX(), tp.y - this.centerY(), [RatCfg.steel, '#ffffff'], 3, 90, 0.2, { kind: 'spark' });
        }
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESEN-RATTE mit zwei Schwertern (Endgegner Welt 52) ──
// ══════════════════════════════════════════

// Riesige Ratte in verbeultem Eisen, 145 LP, bleibt im Boss-Raum (der runden Halle mit dem Gullydeckel).
// Ablauf Phase 1: Heranlaufen → Schwertkreise → Schwerter in den Boden (riesige Explosion) → Verschnaufpause …
//   Schwertkreise: 0,85 s lang fuellt sich der Warnkreis um ihn, dann dreht er sich mit beiden Schwertern
//     und rutscht auf Mark zu. Wer im Kreis steht, bekommt 2 Schaden (auch Juri und das Krokodil).
//   Schwerter in den Boden: 1,15 s hebt er beide Schwerter ueber den Kopf, der riesige Warnkreis (116
//     Radius) steht fest, dann faehrt er hin und staecht zu – Feuerball, Bodenwackeln, weisslicher Blitz.
// Phase 2 (halbe LP): schneller, langere Drehung, die Explosion kommt zweimal hintereinander.
// Mit wenig Leben (unter 30 %) wird er nach JEDEM grossen Angriff schwindelig, sonst in Phase 2 nach
// jedem zweiten – 1,6 s, bei wenig Leben 2,2 s lang: Marks Zeit zum Zurueckhauen.
// Nur was Leander sich gewuenscht hat: keine weiteren Zustaende, keine Geschosse.
class BossGiantRat extends Enemy {
    constructor(x, y) {
        super(x, y, 74, 74);
        this.hp = 145;
        this.maxHp = 145;
        this.speed = 36;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.shadow = { rx: 34, ry: 12, dy: 36, alpha: 0.3 };
        this.fxColor = RatCfg.iron;
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
        this.round = 0;                 // die zweite Explosion in Phase 2
        // Schwertkreise
        this.spinAngle = 0;
        this.spinRate = 0;
        this.spinHit = [];
        // Schwerter in den Boden
        this.boomPoint = null;          // festgelegter Einschlagpunkt
        this.boomR = RAT_BOOM_R;
        this.boomFx = null;             // {x, y, r, t} laufender Feuerball
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _spinR() { return this.phase === 2 ? RAT_SPIN_R2 : RAT_SPIN_R; }

    // Ankerpunkt der Schwerter (Schulterhoehe)
    _muzzle() { return { x: this.centerX(), y: this.y + this.h * 0.42 }; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.boomFx) {
            this.boomFx.t += dt / 0.45;
            if (this.boomFx.t >= 1) this.boomFx = null;
        }
        if (this.dead) { this.boomPoint = null; return; }
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        if (this.state === 'spin') this.spinRate = Math.min(this.phase === 2 ? 20 : 15, this.spinRate + 42 * dt);
        else this.spinRate *= Math.exp(-5 * dt);
        this.spinAngle = (this.spinAngle + this.spinRate * dt) % TAU;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 49;
            this.bigHits = 0;
            RatArt.burst(mx, my - 18, [RatCfg.iron, RatCfg.rivet, '#ffffff'], 24, 210, 0.7, { kind: 'star' });
            RatArt.ring(mx, my, RatCfg.rivet, 100, 0.6, 6);
            RatArt.shake(8, 0.45);
        }
        const still = this.state === 'intro' || this.state === 'dizzy' || this.state === 'spin';
        if (!still) {
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
            case 'spinWind':
                if (this.stateT <= 0) {
                    this.spinHit = [];
                    this._set('spin', this.phase === 2 ? 2.7 : 2.2);
                }
                break;
            case 'spin':
                this._spinMove(dt, world, dx, dy, dist);
                this._spinHits(player);
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'boomAim':
                if (this.stateT <= 0) {
                    this.boomR = this.phase === 2 ? RAT_BOOM_R2 : RAT_BOOM_R;
                    this._set('boomDrop', 0.42);
                }
                break;
            case 'boomDrop':
                this._boomDrop(dt, world);
                if (this.stateT <= 0) {
                    this._explode(world);
                    if (this.phase === 2 && this.round === 0) {
                        this.round = 1;
                        this._startBoom(player);
                        break;
                    }
                    this.round = 0;
                    this._set('roar', 0.6);
                    this._afterBig();
                }
                break;
            case 'dizzy':
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.5 : 0.85;
                    this._set('walk', 0);
                }
                break;
            default:                // roar = Verschnaufpause
                if (this.stateT <= 0) this._set('walk', 0);
        }
        RatArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann der naechste grosse Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.7; return; }
        this.step += dt * 4.4;
        let vx = 0, vy = 0;
        if (dist > 120) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 62) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool > 0) return;
        const cyc = this.phase === 2 ? BossGiantRat.CYCLE2 : BossGiantRat.CYCLE1;
        const what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'spin') this._startSpin();
        else if (what === 'boom') this._startBoom(player);
        else this.cool = this.phase === 2 ? 0.45 : 0.9;      // bewusste Verschnaufpause
    }

    // ── a) Schwertkreise: Warnkreis, dann Drehung mit beiden Schwertern ──
    _startSpin() {
        this.spinAngle = Math.random() * TAU;
        this._set('spinWind', this.phase === 2 ? 0.7 : 0.85);
    }

    // Er rutscht beim Drehen auf Mark zu (mit Wandkollision und innerhalb des Boss-Raums)
    _spinMove(dt, world, dx, dy, dist) {
        if (dist < 6) return;
        const sp = (this.phase === 2 ? 92 : 70) * Math.min(1, (this.stateDur - this.stateT) / 0.4 + 0.2);
        Kit915.rush(this, (dx / dist) * sp * dt, (dy / dist) * sp * dt, world);
        this.moving = true;
        RatArt.clampToRoom(this, world);
        if (Math.random() < 0.35) {
            const m = this._muzzle();
            RatArt.burst(m.x + Math.cos(this.spinAngle) * 30, m.y + Math.sin(this.spinAngle) * 30,
                [RatCfg.steel, RatCfg.steelMid], 1, 60, 0.26, { kind: 'spark' });
        }
    }

    // Wer in den Schwertkreisen steht, wird getroffen (Schutzzeit verhindert Mehrfachtreffer)
    _spinHits(player) {
        const R = this._spinR();
        // Mittelpunkt wie beim gezeichneten Warnkreis – der Treffer bleibt genau in seinem Kreis.
        const m = { x: this.centerX(), y: this.centerY() };
        RatArt.areaHit(m.x, m.y, R, 2, 250, this.spinHit);
        // Nach einer halben Umdrehung darf die naechste treffen – Schutzzeiten der Engine laufen daneben mit.
        // Das Fenster ist breiter als ein Drehschritt, sonst wird es bei schneller Drehung uebersprungen.
        if (Math.abs(Math.sin(this.spinAngle)) < 0.34 && Math.cos(this.spinAngle) > 0.8) this.spinHit = [];
    }

    // ── b) Schwerter in den Boden: riesiger Warnkreis, dann die Explosion ──
    _startBoom(player) {
        const m = this._muzzle();
        const r = this.phase === 2 ? RAT_BOOM_R2 : RAT_BOOM_R;
        const near = RatArt.nearTarget(player, m.x, m.y, 620);
        const t = near ? near.t : { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        this.boomPoint = RatArt.inRoom(t.x, t.y, 18);
        this.boomR = r;
        this._set('boomAim', this.phase === 2 ? 0.95 : 1.15);
    }

    // Er faehrt mit erhobenen Schwertern zu dem Punkt, dessen Kreis gezeigt wurde.
    _boomDrop(dt, world) {
        const p = this.boomPoint;
        if (!p) return;
        const dx = p.x - this.centerX(), dy = p.y - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d > 10) {
            Kit915.rush(this, (dx / d) * 330 * dt, (dy / d) * 330 * dt, world);
            this.moving = true;
            RatArt.burst(this.centerX(), this.y + this.h - 2, ['#e8e4d8', RatCfg.steelMid], 2, 60, 0.34, { kind: 'smoke', size: 5 });
        }
        if (Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
    }

    // Beide Schwerter in den Boden: Feuerball, Schockwelle, Bodenwackeln – Schaden im grossen Kreis.
    _explode(world) {
        const p = this.boomPoint || { x: this.centerX(), y: this.centerY() };
        const r = this.boomR;
        this.boomFx = { x: p.x, y: p.y, r, t: 0 };
        RatArt.areaHit(p.x, p.y, r, 2, 330, []);
        RatArt.burst(p.x, p.y, [RatCfg.boomLight, RatCfg.boom, RatCfg.boomHot], 30, 300, 0.7, { kind: 'star' });
        RatArt.burst(p.x, p.y, [RatCfg.steelMid, '#ffffff'], 12, 210, 0.5, { kind: 'spark' });
        RatArt.ring(p.x, p.y, RatCfg.boomLight, r, 0.42, 7);
        RatArt.ring(p.x, p.y, RatCfg.boomHot, r * 0.6, 0.3, 5);
        RatArt.shake(11, 0.5);
        RatArt.flash('#ffe0b0', 0.45);
        RatArt.burst(p.x, p.y, ['#e8e4d8', RatCfg.steelMid, '#ffffff'], 16, 150, 0.6, { kind: 'smoke', size: 7 });
        this.boomPoint = null;
    }

    // Nach grossen Angriffen: Verschnaufpause – bei wenig Leben immer, sonst in Phase 2 jedes zweite Mal
    // wird er schwindelig (Leanders Regel).
    _afterBig() {
        this.bigHits++;
        const low = this.hp <= this.maxHp * 0.3;
        if (low || (this.phase === 2 && this.bigHits % 2 === 0)) {
            this._set('dizzy', low ? 2.2 : 1.6);
            RatArt.burst(this.centerX(), this.y + 12, [RatCfg.star, '#ffffff'], 11, 95, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.55 : 0.95;
        this._set('roar', this.cool + 0.35);
    }

    // Ansagen am Boden: Warnkreis der Drehung und riesiger Warnkreis der Explosion – vor allen Figuren
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const k = this._k();
        if (st === 'spinWind') {
            const p = camera.worldToScreen(this.centerX(), this.centerY());
            LateWorldArt.warn(ctx, p.x, p.y, this._spinR(), k, RatCfg.warn);
            return;
        }
        if (st === 'spin') {
            // Der Kreis bleibt sichtbar: genau da tun die Schwerter weh.
            const p = camera.worldToScreen(this.centerX(), this.centerY());
            Art.ring(ctx, p.x, p.y, this._spinR(), RatCfg.warn, 3.0, 0.5 + 0.3 * Math.sin(Art.time * 14));
            return;
        }
        if ((st === 'boomAim' || st === 'boomDrop') && this.boomPoint) {
            const p = camera.worldToScreen(this.boomPoint.x, this.boomPoint.y);
            const kk = st === 'boomAim' ? k : 1;
            LateWorldArt.warn(ctx, p.x, p.y, this.boomR, kk, RatCfg.warnHot);
            // Zweiter Kreis: die Explosion selbst fuellt den Rand, die Mitte trifft zuerst
            LateWorldArt.warn(ctx, p.x, p.y, this.boomR * 0.5, kk, RatCfg.warn);
            return;
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        if (this.boomFx) {
            const b = camera.worldToScreen(this.boomFx.x, this.boomFx.y);
            RatArt.blast(ctx, b.x, b.y, this.boomFx.r, this.boomFx.t);
        }
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

    // Riesen-Ratte: dieselbe Figur wie die kleinen, 2,2-mal so groß, mit zwei Schwertern, Spikeschultern
    // und Helm; Phase 2 mit Dellen und rotem Blick.
    _body(ctx, dead) {
        const S = 2.2;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'roar';
        const spinWind = st === 'spinWind';
        const spin = st === 'spin';
        const aim = st === 'boomAim';
        const drop = st === 'boomDrop';
        const walk = this.moving && !dizzy && !dead && !spin ? Math.sin(this.step * 2) : 0;
        const shiver = (spinWind || aim) ? Math.sin(t * 26) * 1.7 : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.2 : Math.sin(t * 1.8) * 0.9)
            + (aim ? -2.4 * k : 0) + (drop ? 1.6 : 0) - (rest ? 1.4 : 0);
        const lean = dead ? 0 : (spinWind ? k * 2.2 : 0) + (aim ? -k * 2.6 : 0) + (drop ? 3.4 : 0) + shiver;
        // Schwerter: haengend, ueber dem Kopf (Explosion) oder kreisend (Drehung)
        let hb = { x: -17 - shiver, y: -16 + Math.max(0, -walk) * 2 };
        let hf = { x: 18 + shiver, y: -16 - Math.max(0, walk) * 2 };
        let aB = Math.PI - 0.5, aF = -0.6 + Math.sin(t * 2) * 0.1;
        if (spinWind || spin) { aB = this.spinAngle + Math.PI; aF = this.spinAngle; }
        else if (aim) { hb = { x: -8 - k * 3, y: -34 - k * 8 }; hf = { x: 8 + k * 3, y: -34 - k * 8 }; aB = -2.5; aF = -0.65; }
        else if (drop) { aB = 1.35; aF = 1.8; }
        else if (dizzy) { hb = { x: -18, y: -22 }; hf = { x: 19, y: -22 }; aB = Math.PI + 1.2; aF = 1.2; }
        else if (rest) { hb = { x: -19, y: -12 }; hf = { x: 20, y: -12 }; aB = Math.PI - 0.2; aF = 0.2; }
        ctx.save();
        ctx.scale(S, S);
        if (p2 && !dead) Art.glow(ctx, 0, -20, 40, RatCfg.warnHot, 0.16 + 0.07 * Math.sin(t * 4));
        ctx.scale(this.face, 1);
        const mood = dead ? 'dead' : dizzy ? 'dizzy' : (spin || spinWind || aim || drop) ? 'open' : rest ? 'tired' : p2 ? 'angry' : 'angry';
        RatArt.figure(ctx, {
            c: C_BOSS, lw: 0.72, t, seed: this.seed, bob, lean, walk, mood,
            arms: { b: hb, f: hf }, angB: aB, angF: aF, swords: 2, swordLen: 20,
            helm: true, spikes: true, dented: p2 && !dead, hot: p2 && !dead, blade: RatCfg.steel,
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        ctx.restore();
        if (!dead && (spin || spinWind)) {
            // Die kreisenden Klingen liegen ueber allem und bleiben auch in Phase 2 gut sichtbar
            ctx.save();
            ctx.scale(S, S);
            const m = { x: 0, y: -18 + bob };
            // Die Klingenspitzen enden genau am angesagten Kreis: was droht, trifft – und nicht weiter.
            const reach = this._spinR() / S - 16;
            RatArt.whirl(ctx, m.x, m.y, this.spinAngle * (this.face > 0 ? 1 : -1), spin ? reach : reach * 0.78,
                { lw: 0.8, blade: RatCfg.steel, wind: p2 ? RatCfg.warnHot : RatCfg.steelMid });
            ctx.restore();
        }
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 0, -80, 22, 4.2);
    }
}

BossGiantRat.CYCLE1 = ['spin', 'boom', 'rest'];
BossGiantRat.CYCLE2 = ['spin', 'boom', 'spin', 'boom', 'rest'];
