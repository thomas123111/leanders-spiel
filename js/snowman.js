// ── Welt 50: Schneemann-Tal (letzte Welt, Idee von Leander) ──
// Schneemann: drei Schneekugeln übereinander, Karottennase, bunter Schal und bunte Mütze – damit man ihn
//   auf dem verschneiten Boden sofort erkennt und als Schneemann sieht. Wirft Schneebälle auf Mark UND auf
//   Juri und das Schattenkrokodil. 0,55 s vorher leuchtet eine rote Bahn in Wurfrichtung am Boden, und der
//   Schneeball fliegt genau diese Bahn entlang (Ansage = Treffer). Von nah holt er mit dem Astarm aus
//   (roter Kreis) und fegt ihn zu Boden. Der Schlüsselträger hat GRAUEN Schnee (Wunsch von Leander), hält
//   mehr aus und wirft drei Schneebälle kurz hintereinander – die Bahn bleibt so lange stehen.
// Boss: RIESENSCHNEEMANN – Endgegner von Welt 50, bleibt im Boss-Raum (der zugefrorene See), 140 LP,
//   zwei Phasen.
//   Fächer: eine breite Salve Schneebälle, angekündigt mit roten Strahlen in jede Wurfrichtung.
//   Kreis: rotierender Ring aus Schneebällen um ihn herum (Phase 2: drei Ringe hintereinander).
//   Schneesturm: weiße Schleier über dem Bildschirm (Mark und Gegner bleiben erkennbar) und Wind, der Mark
//     zur Seite schiebt. Die Richtung steht vorher fest – lange Bahnen am Boden zeigen sie an, ebenso lange
//     wirft der Riese einzelne große Schneebälle auf markierte Stellen.
//   Phase 2 (halbe LP): schneller, mehr Schneebälle, längerer Sturm. Mit wenig Leben wird er nach jedem
//     großen Angriff schwindelig (kreisende Sterne, kurz wehrlos) – Marks Zeit zum Zurückhauen.
//   Leander will genau diese Wirkungen: KEINE Gift- oder Schlaf-Bälle, keine zusätzlichen Zustände.
//   Freunde verschwinden nie: ein Schneeball, der Juri oder das Krokodil besiegen würde, haut sie nur um.

const SnowmanCfg = {
    snow: '#f2fbff',            // helles Weiß – der Boden ist bläulich-grau, davon hebt sich die Figur ab
    snowMid: '#d8eafb',
    snowDark: '#a9c6e2',        // Schattenseite und festgetretener Sockel
    keySnow: '#b9c2cf',         // Schlüsselträger: grauer Schnee (Wunsch von Leander)
    keyMid: '#98a3b3',
    keyDark: '#6f7b8d',
    scarf: '#ff4d6d',           // bunter Schal
    scarfWarm: '#ffd23f',
    scarfCool: '#3ddc97',
    hat: '#3d7bff',             // bunte Mütze
    hatBand: '#ffe14a',
    pompom: '#ffffff',
    carrot: '#ff8a2b',
    carrotDark: '#d96a12',
    coal: '#2b2440',
    twig: '#96602c',
    cheek: '#ff7aa8',
    ice: '#bfe4ff',
    warn: '#ff5a3d',
    warnHot: '#ff3d5a',
};

// Zwei Schnee-Paletten: weiß (alle) und grau (Schlüsselträger)
const C_SNOW = { snow: SnowmanCfg.snow, mid: SnowmanCfg.snowMid, dark: SnowmanCfg.snowDark };
const C_GRAY = { snow: SnowmanCfg.keySnow, mid: SnowmanCfg.keyMid, dark: SnowmanCfg.keyDark };

// Höchstens so viele Schneebälle gleichzeitig auf dem Bildschirm (Welt 50 wirft sehr viele).
const SNOWBALL_CAP = 130;

const SnowmanArt = {
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
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, ['#ffffff', SnowmanCfg.ice], 9, 130, 0.42, { kind: 'star' });
    },

    // Schneebälle treffen auch Juri und das Krokodil (hier eigener Treffer, damit es richtig weh tut).
    // Mark übernimmt die Engine – dort zählt die Ausweichrolle und die Schonzeit nach einem Treffer.
    companionHit(proj) {
        const list = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of list) {
            if (!c || c.dead || c.koTimer > 0 || typeof c.knockOut !== 'function' || typeof c.takeDamage !== 'function') continue;
            const w = c.w || 20, h = c.h || 20;
            const cx = c.x + w / 2, cy = c.y + h / 2;
            if (Math.hypot(proj.x - cx, proj.y - cy) > proj.radius + Math.max(w, h) / 2) continue;
            proj.dead = true;
            this.hitCompanion(c, proj.damage >= 2 ? 2 : 1);
            return true;
        }
        return false;
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

    // Freier Punkt in der Welt (für Wurf- und Landpunkte)?
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

    // ── Schneesturm: breite weiße Bahnen und Windstreifen über dem Bildschirm ──
    // Oben und unten weht es fast ganz zu, in der Mitte (da steht Mark) bleibt ein dünnerer Schleier:
    // man sieht deutlich schlechter, Mark, die Freunde und die Schneebälle bleiben aber erkennbar.
    // Die Bahnen wandern auf und ab, darum ist die Sicht abwechselnd richtig schlecht.
    veils(ctx, k, dir, seed) {
        const vw = (typeof Game !== 'undefined' && Game.viewW) || (ctx.canvas && ctx.canvas.width) || 760;
        const vh = (typeof Game !== 'undefined' && Game.viewH) || (ctx.canvas && ctx.canvas.height) || 360;
        const prev = ctx.globalAlpha;
        const deckend = [0.66, 0.44, 0.26, 0.46, 0.68];
        for (let i = 0; i < 5; i++) {
            const y = vh * (0.1 + 0.2 * i) + Math.sin(Art.time * (0.5 + i * 0.14) + seed + i) * vh * 0.1;
            const hohe = vh * (0.17 + 0.05 * Math.sin(Art.time * 0.9 + i * 2.3));
            ctx.fillStyle = i % 2 ? '#f2faff' : '#ffffff';
            ctx.globalAlpha = prev * deckend[i] * k * 0.34;
            ctx.fillRect(-20, y - hohe, vw + 40, hohe * 2);
            ctx.globalAlpha = prev * deckend[i] * k;
            ctx.fillRect(-20, y - hohe * 0.5, vw + 40, hohe);
        }
        // Treibende Schnee-Bausche darüber
        for (let i = 0; i < 6; i++) {
            const span = vw + 300;
            let x = (seed * 7 + i * 137 + Art.time * (110 + i * 26) * dir) % span;
            if (x < 0) x += span;
            x -= 150;
            const y = ((i * 97 + Math.sin(Art.time * 0.8 + i) * 40) % vh + vh) % vh;
            Art.glow(ctx, x, y, 62 + i * 9, '#ffffff', (0.2 + 0.06 * Math.sin(Art.time * 2 + i)) * k);
        }
        // Windstreifen: kräftige Striche in Schieberichtung, damit das Kind den Wind sieht
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#ffffff';
        for (let i = 0; i < 11; i++) {
            const span = vw + 220;
            let x = (seed + i * 91 + Art.time * (190 + i * 26) * dir) % span;
            if (x < 0) x += span;
            x -= 110;
            const y = ((i * 53 + Math.sin(i * 2.1) * 34) % vh + vh) % vh;
            const len = 30 + (i % 3) * 18;
            ctx.globalAlpha = prev * (0.42 + 0.12 * (i % 3)) * k;
            ctx.lineWidth = 2.6 + (i % 3);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + len * dir, y + 2);
            ctx.stroke();
        }
        ctx.globalAlpha = prev;
    },

    // ── Ganze Figur: ein Schneemann von vorn, leicht in Blickrichtung gedreht, Fußpunkt (0, 0).
    // Eine Einheit = normaler Schneemann, der Boss zeichnet dieselbe Figur größer (ctx.scale vorher).
    // p = { c, lw, t, bob, lean, sway, arms: { b: {x, y}, f: {x, y} }, ball (Schneeball in der Vorderhand),
    //       mood ('calm'|'angry'|'open'|'tired'|'dizzy'|'dead'), look, scarfSway,
    //       icicles (Eiszapfen am Boss), cracks (Risse in Phase 2) }
    figure(ctx, p) {
        const c = p.c, lw = p.lw;
        const y0 = -p.bob;
        const lean = p.lean || 0;
        const sway = p.sway || 0;
        // ── drei Schneekugeln: unten die größte, dann Bauch, dann Kopf ──
        Art.body(ctx, 0, y0 - 9.4, 10.6, 9.6, c.snow, { glossy: true, lineWidth: lw });
        Art.body(ctx, 0, y0 - 3.2, 9.4, 4.2, c.dark, { highlight: false, lineWidth: lw * 0.8 });   // festgetretener Sockel
        Art.body(ctx, lean * 0.5, y0 - 22.4, 7.7, 7.3, c.snow, { glossy: true, lineWidth: lw });
        // Knöpfe aus Kohle auf dem Bauch
        ctx.fillStyle = SnowmanCfg.coal;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(lean * 0.3, y0 - 26.2 + i * 3.6, 1.15, 0, TAU);
            ctx.fill();
        }
        if (p.cracks) {
            ctx.strokeStyle = c.dark;
            ctx.lineWidth = lw * 0.8;
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-6.4, y0 - 12.4); ctx.lineTo(-3.2, y0 - 8.6); ctx.lineTo(-5.4, y0 - 4.4);
            ctx.moveTo(6.6, y0 - 24.6); ctx.lineTo(4.2, y0 - 21.2);
            ctx.moveTo(4.6, y0 - 15.2); ctx.lineTo(7.4, y0 - 11.4);
            ctx.stroke();
        }
        // ── Astarme (hinten und vorn), die vordere Hand hält einen Schneeball ──
        const arm = (s, hd) => {
            const sx = s * 6.4, sy = y0 - 24.8;
            Art.limb(ctx, sx, sy, hd.x, hd.y, s > 0 ? 2.5 : 2.2, SnowmanCfg.twig, { lineWidth: lw * 0.8 });
            const a = Math.atan2(hd.y - sy, hd.x - sx);
            for (const d of [-0.7, 0.6]) {
                Art.limb(ctx, hd.x, hd.y, hd.x + Math.cos(a + d) * 5.2, hd.y + Math.sin(a + d) * 5.2,
                    1.5, SnowmanCfg.twig, { lineWidth: lw * 0.7 });
            }
            if (s > 0 && p.ball) Art.body(ctx, hd.x + 2.6, hd.y - 1.2, 4.0, 3.9, c.snow, { glossy: true, lineWidth: lw * 0.8 });
        };
        arm(-1, p.arms.b);
        arm(1, p.arms.f);
        // ── Kopf ──
        const hx = lean * 1.1, hy = y0 - 32.6;
        Art.body(ctx, hx, hy, 6.2, 5.9, c.snow, { glossy: true, lineWidth: lw });
        // ── bunter Schal: Band um den Hals, Zipfel weht nach hinten ──
        const ny = y0 - 27.2 + lean * 0.2;
        const tw = p.scarfSway || 0;
        Art.shape(ctx, g => {
            g.moveTo(hx - 5.6, ny + 0.4);
            g.quadraticCurveTo(hx - 10.2, ny + 6 + tw, hx - 8.4, ny + 13.4 + tw);
            g.lineTo(hx - 4.2, ny + 12.4 + tw);
            g.quadraticCurveTo(hx - 5.4, ny + 6 + tw, hx - 1.8, ny + 1.2);
            g.closePath();
        }, { x: hx - 10.6, y: ny, w: 9.2, h: 14.6 }, SnowmanCfg.scarf, { lineWidth: lw * 0.9 });
        Art.limb(ctx, hx - 7.6, ny + 5.2 + tw * 0.6, hx - 3.8, ny + 4.6 + tw * 0.6, 1.6, SnowmanCfg.scarfWarm, { lineWidth: lw * 0.6 });
        Art.limb(ctx, hx - 8.2, ny + 9.4 + tw * 0.9, hx - 4.4, ny + 9.0 + tw * 0.9, 1.6, SnowmanCfg.scarfCool, { lineWidth: lw * 0.6 });
        Art.body(ctx, hx * 0.6, ny, 7.1, 2.6, SnowmanCfg.scarf, { lineWidth: lw * 0.9 });
        Art.box(ctx, hx - 6.4, ny - 1.9, 4.3, 3.8, 1.7, SnowmanCfg.scarfCool, { lineWidth: lw * 0.7, highlight: false });
        Art.box(ctx, hx - 2.2, ny - 2.1, 4.4, 4.2, 1.7, SnowmanCfg.scarfWarm, { lineWidth: lw * 0.7, highlight: false });
        Art.box(ctx, hx + 2.1, ny - 1.9, 4.5, 3.8, 1.7, SnowmanCfg.scarf, { lineWidth: lw * 0.7, highlight: false });
        if (p.icicles) {
            // Eiszapfen am Schal (nur der Riese ist winterhart genug)
            for (const s of [-1, 1]) {
                Art.shape(ctx, g => {
                    g.moveTo(hx + s * 5.4 - 1.1, ny + 1.6);
                    g.lineTo(hx + s * 5.4 + 1.1, ny + 1.6);
                    g.lineTo(hx + s * 5.4, ny + 6.4);
                    g.closePath();
                }, { x: hx + s * 5.4 - 1.2, y: ny + 1.4, w: 2.4, h: 5.2 }, SnowmanCfg.ice, { lineWidth: lw * 0.6 });
            }
        }
        // ── bunte Mütze (hinten ein wenig überhängend, mit weißem Bund und Bommel) ──
        const htop = hy - 4.4;
        Art.shape(ctx, g => {
            g.moveTo(hx - 6.1, htop - 1.4);
            g.quadraticCurveTo(hx - 7.0, htop - 11.4, hx - 1.4, htop - 12.8);
            g.quadraticCurveTo(hx + 4.8, htop - 11.6, hx + 6.1, htop - 1.4);
            g.closePath();
        }, { x: hx - 7.2, y: htop - 13.2, w: 13.6, h: 12 }, SnowmanCfg.hat, { glossy: true, lineWidth: lw });
        Art.limb(ctx, hx - 5.6, htop - 6.6, hx + 5.6, htop - 6.6, 2.0, SnowmanCfg.hatBand, { lineWidth: lw * 0.6 });
        Art.box(ctx, hx - 6.6, htop - 3.2, 13.2, 3.6, 1.7, SnowmanCfg.pompom, { lineWidth: lw * 0.9 });
        Art.body(ctx, hx - 2.4, htop - 13.2, 2.8, 2.8, SnowmanCfg.pompom, { glossy: true, lineWidth: lw * 0.8 });
        if (p.icicles) {
            Art.shape(ctx, g => {
                g.moveTo(hx + 4.2, htop - 0.2);
                g.lineTo(hx + 6.0, htop - 0.2);
                g.lineTo(hx + 5.1, htop + 5.4);
                g.closePath();
            }, { x: hx + 4.1, y: htop - 0.4, w: 2.0, h: 5.8 }, SnowmanCfg.ice, { lineWidth: lw * 0.6 });
        }
        // ── Gesicht: Kohleaugen, Karottennase, Kohle-Lächeln ──
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        const ex = 2.5;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, hx + 1.2, hy - 1.0, 1.8, ex);
        } else if (mood === 'dizzy') {
            ctx.strokeStyle = SnowmanCfg.coal;
            ctx.lineWidth = lw * 0.9;
            ctx.lineCap = 'round';
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + (p.t || 0) * 6 * s, r = 0.25 + i * 0.12;
                    const x = hx + 1.2 + s * ex + Math.cos(a) * r, y = hy - 1.0 + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                const px = hx + 1.2 + s * ex + look.x * 0.7, py = hy - 1.0 + look.y * 0.5;
                ctx.fillStyle = SnowmanCfg.coal;
                ctx.beginPath();
                ctx.ellipse(px, py, 1.55, mood === 'tired' ? 1.0 : 1.8, 0, 0, TAU);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.beginPath();
                ctx.arc(px - 0.5, py - 0.6, 0.45, 0, TAU);
                ctx.fill();
            }
            if (mood !== 'tired') {
                // frostige Augenbrauen: grimmig zusammengezogen
                ctx.strokeStyle = SnowmanCfg.snowDark;
                ctx.lineWidth = lw * 1.1;
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (const s of [-1, 1]) {
                    ctx.moveTo(hx + 1.2 + s * (ex + 1.9), hy - 3.9);
                    ctx.lineTo(hx + 1.2 + s * (ex - 1.2), hy - 2.9);
                }
                ctx.stroke();
            }
        }
        // Karottennase: zeigt deutlich in Blickrichtung, damit man sieht, woher der Wurf kommt
        Art.shape(ctx, g => {
            g.moveTo(hx + 2.2, hy + 0.1);
            g.lineTo(hx + 11.8, hy + 2.5);
            g.lineTo(hx + 2.6, hy + 3.4);
            g.closePath();
        }, { x: hx + 2, y: hy - 0.2, w: 10, h: 3.8 }, SnowmanCfg.carrot, { glossy: true, lineWidth: lw * 0.9 });
        Art.limb(ctx, hx + 3.4, hy + 0.7, hx + 9.6, hy + 2.3, 1.0, SnowmanCfg.carrotDark, { lineWidth: lw * 0.4, outline: false });
        Art.blush(ctx, hx + 1.2, hy + 3.4, 1.9, 5.0, SnowmanCfg.cheek);
        if (mood === 'open') {
            Art.mouth(ctx, hx + 2.4, hy + 5.4, 4.6, 'open', { color: SnowmanCfg.coal });
        } else {
            ctx.fillStyle = SnowmanCfg.coal;
            for (let i = 0; i < 5; i++) {
                const a = 0.24 * Math.PI + (i / 4) * 0.52 * Math.PI;
                ctx.beginPath();
                ctx.arc(hx + 1.6 + Math.cos(a) * 4.0, hy + 2.4 + Math.sin(a) * 3.0, 0.85, 0, TAU);
                ctx.fill();
            }
        }
        return { hx, hy, ny };
    },
};

// ══════════════════════════════════════════
// ── Schneeball (Geschoß von Schneemann und Riese) ──
// ══════════════════════════════════════════

// Weißer Schneeball mit bläulichem Schatten und ein paar Krümeln hinterher. big = der große Ball des
// Riesen (langsamer, 2 Schaden). Trifft Mark über die Engine, Juri und das Krokodil über SnowmanArt.
class SnowBall extends Projectile {
    constructor(x, y, angle, speed, big) {
        const sp = speed || (big ? 132 : randRange(168, 190));
        super(x, y, Math.cos(angle) * sp, Math.sin(angle) * sp, big ? 2 : 1, 'enemy', big ? 175 : 95);
        this.radius = big ? 9 : 6;
        this.lifetime = big ? 3.4 : 2.5;
        this.big = !!big;
        this.spin = randRange(-7, 7);
        this.wob = Math.random() * 10;
        this.grace = 0.12;              // direkt an der Hand darf niemand getroffen werden
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) return;
        if (this.big && Math.random() < 0.25) {
            SnowmanArt.burst(this.x, this.y, ['#ffffff', SnowmanCfg.snowMid], 1, 26, 0.34, { kind: 'smoke', size: 3 });
        }
        if (this.age >= this.grace) SnowmanArt.companionHit(this);
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        // Spur aus Schnee-Krümeln hinterher
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const prev = ctx.globalAlpha;
        for (let i = 3; i >= 1; i--) {
            ctx.globalAlpha = prev * (0.26 - i * 0.06);
            ctx.fillStyle = SnowmanCfg.snowMid;
            ctx.beginPath();
            ctx.arc(p.x - dx * i * r * 0.9, p.y - dy * i * r * 0.9, r * (1 - i * 0.22), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = prev;
        if (this.big) Art.glow(ctx, p.x, p.y, r * 2.6, SnowmanCfg.ice, 0.5);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.spin * this.age);
        Art.body(ctx, 0, 0, r, r * 0.96, C_SNOW.snow, { glossy: true, lineWidth: this.big ? 1.7 : 1.3 });
        // unebene Schnee-Oberfläche
        ctx.fillStyle = C_SNOW.mid;
        for (let i = 0; i < 3; i++) {
            const a = i * 2.2 + 0.7;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.24, r * 0.18, a, 0, TAU);
            ctx.fill();
        }
        if (this.big) {
            // Dunkler Rand: auch vor den weißen Schnee-Bahnen des Sturms bleibt der große Ball klar zu sehen
            ctx.strokeStyle = SnowmanCfg.snowDark;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.98, 0, TAU);
            ctx.stroke();
        }
        ctx.restore();
        if (this.big) Art.sparkle(ctx, p.x + r * 0.9, p.y - r * 0.9, 2.4, '#ffffff', 0.5 + 0.5 * Math.sin(Art.time * 9 + this.wob));
    }
}

// ══════════════════════════════════════════
// ── Normaler Schneemann ──
// ══════════════════════════════════════════

// Schneemann (Hitbox 26×34, 8 LP, Schlüsselträger 10 LP). Hält 62–210 Abstand und wirft Schneebälle auf
// Mark oder einen Freund; die rote Wurfbahn steht 0,55 s vorher. Von nah fegt er mit dem Astarm um sich
// (roter Ansagekreis = Trefferkreis). Bei wenig Leben schaut er drein, als gleich taut er weg.
class Snowman extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 34);
        this.hp = 8;
        this.maxHp = 8;
        this.speed = randRange(42, 52);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.fxColor = SnowmanCfg.ice;
        this.seed = Math.random() * 10;
        this.detectionRange = 250;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.2 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2.0);
        this.step = 0;
        this.moving = false;
        this.gray = false;              // grauer Schnee (Schlüsselträger)
        this.aimAng = 0;                // Wurfrichtung (steht fest, sobald die Bahn angezeigt wird)
        this.aimLen = 120;
        this.aimLock = false;
        this.throwLeft = 0;             // Schnellfolge des Schlüsselträgers
        this.aim = null;                // Zielpunkt des Armschwungs
        this.swipeHit = [];
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.gray ? C_GRAY : C_SNOW; }

    // Punkt, aus dem die Schneebälle fliegen (vordere Hand)
    _hand() {
        return { x: this.centerX() + this.face * 9, y: this.centerY() - 7 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): grauer Schnee, etwas zäher
            this._keyInit = true;
            this.gray = true;
            this.hp = this.maxHp = 10;
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'aim' && this.state !== 'throw') {
            // Blick und Richtung bleiben während Ansage und Wurf stehen: die angesagte Bahn gilt wirklich.
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('shiver', 0.8);   // schüttelt sich: Schneestaub fliegt, Kinder sehen ihn zuerst
            SnowmanArt.burst(mx, my - 8, ['#ffffff', SnowmanCfg.snowMid], 8, 70, 0.5, { kind: 'smoke', size: 4 });
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'shiver':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'aim':
                if (!this.aimLock) {
                    const near = SnowmanArt.nearTarget(player, mx, my, 250);
                    if (near) {
                        this.aimAng = Math.atan2(near.t.y - my, near.t.x - mx);
                        this.aimLen = clamp(near.d + 26, 70, 215);
                        if (Math.abs(Math.cos(this.aimAng)) > 0.25) this.face = Math.cos(this.aimAng) > 0 ? 1 : -1;
                    }
                    if (this.stateT <= this.stateDur * 0.35) this.aimLock = true;   // Bahn steht jetzt fest
                }
                if (this.stateT <= 0) {
                    this._throw(0, projectiles);
                    this.throwLeft = this.gray ? 2 : 0;
                    this._set('throw', 0.26);
                }
                break;
            case 'throw':
                if (this.stateT <= 0) {
                    if (this.throwLeft > 0) {
                        this.throwLeft--;
                        this._throw(3 - this.throwLeft, projectiles);
                        this._set('throw', 0.2);
                    } else {
                        this.cool = this.gray ? randRange(1.4, 1.9) : randRange(1.2, 2.0);
                        this._set('walk', 0);
                    }
                }
                break;
            case 'swipeWind':
                if (this.stateT <= 0) {
                    this._swipeHit();
                    this._set('swipe', 0.2);
                }
                break;
            case 'swipe':
                if (this.stateT <= 0) {
                    this.cool = randRange(1.3, 1.9);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, dann werfen oder fegen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.1;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.22 * dt, Math.cos(this.step * 0.7) * this.speed * 0.22 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 185) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 62) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 6.0;
        } else this.step += dt * 1.5;
        if (this.cool > 0) return;
        if (dist < 58) {
            const near = SnowmanArt.nearTarget(player, this.centerX(), this.centerY(), 84);
            this.aim = near ? { x: near.t.x, y: near.t.y } : { x: this.centerX() + this.face * 24, y: this.centerY() };
            if (Math.abs(this.aim.x - this.centerX()) > 3) this.face = this.aim.x > this.centerX() ? 1 : -1;
            this.swipeHit = [];
            this._set('swipeWind', this.gray ? 0.34 : 0.42);
            return;
        }
        if (dist < 235) {
            this.aimLock = false;
            this._set('aim', this.gray ? 0.46 : 0.55);
            return;
        }
        this.cool = 0.5;
    }

    // Nummer 0 = erster Wurf, 1..2 = die Schnellfolge des Schlüsselträgers (gleiche, angesagte Bahn)
    _throw(n, projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const h = this._hand();
        if (!list || list.length > SNOWBALL_CAP) {
            SnowmanArt.burst(h.x, h.y, ['#ffffff', SnowmanCfg.snowMid], 5, 80, 0.3, { kind: 'spark' });
            return;
        }
        const a = this.aimAng + (n ? (n - 1.5) * 0.1 : 0);
        list.push(new SnowBall(h.x + Math.cos(a) * 6, h.y + Math.sin(a) * 6, a));
        SnowmanArt.burst(h.x, h.y, ['#ffffff', SnowmanCfg.snowMid], 5, 95, 0.3, { kind: 'spark' });
    }

    // Der Armschwung landet genau dort, wo der rote Kreis stand.
    _swipeHit() {
        const a = this.aim || { x: this.centerX() + this.face * 22, y: this.centerY() };
        SnowmanArt.areaHit(a.x, a.y, 28, 2, 190, this.swipeHit);
        SnowmanArt.shake(2.4, 0.12);
        SnowmanArt.burst(a.x, a.y, ['#ffffff', SnowmanCfg.snowMid, SnowmanCfg.ice], 9, 140, 0.36, { kind: 'spark' });
        SnowmanArt.ring(a.x, a.y, SnowmanCfg.ice, 28, 0.22, 3.4);
    }

    // Ansagen am Boden: Wurfbahn und Armschwung – unter allen Figuren, damit nichts verdeckt wird
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st === 'aim' || st === 'throw') {
            const h = this._hand();
            const p = camera.worldToScreen(h.x, h.y);
            const fade = st === 'throw' ? clamp(this.stateT / 0.26, 0, 1) : 1;
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = prev * (0.45 + 0.55 * fade);
            LateWorldArt.lane(ctx, p.x, p.y, this.aimAng, this.aimLen, 22, this._k(), SnowmanCfg.warn);
            ctx.globalAlpha = prev;
            return;
        }
        if (st === 'swipeWind' && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, 28, this._k(), SnowmanCfg.warn);
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

    // Schneemann mit Fußpunkt (0, 0); gezeichnet in SnowmanArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const wind = st === 'aim' ? k : 0;
        const throwing = st === 'throw';
        const swipe = st === 'swipe' ? 1 : 0;
        const swipeWind = st === 'swipeWind' ? k : 0;
        const shiver = st === 'shiver' ? Math.sin(t * 26) * 1.4 : 0;
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 2.2) * 0.5) + (throwing ? -1 : 0);
        const lean = dead ? 0 : wind * 2.4 + (throwing ? -2.2 : 0) + swipeWind * 1.6 + shiver;
        // Äste: hinten unten, vorn je Zustand (ausgeholt über die Schulter, nach dem Wurf weit vorn)
        let hb = { x: -15 - shiver, y: -13 + Math.max(0, -walk) * 2 };
        let hf = { x: 15 + shiver, y: -13 - Math.max(0, walk) * 2 };
        if (wind) hf = { x: -3 - wind * 8, y: -27 - wind * 5 };
        else if (throwing) hf = { x: 20, y: -24 };
        else if (swipeWind) hf = { x: -6 - swipeWind * 8, y: -20 };
        else if (swipe) hf = { x: 21, y: -6 };
        else if (st === 'shiver') { hb = { x: -11, y: -22 + shiver }; hf = { x: 11, y: -22 - shiver }; }
        ctx.save();
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -18, 26, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        const mood = dead ? 'dead' : (wind || throwing || swipe || swipeWind) ? 'open' : tired ? 'tired' : 'angry';
        SnowmanArt.figure(ctx, {
            c, lw: 1.25, t, bob, lean, sway: Math.sin(t * 2.6) * 1.2, mood,
            arms: { b: hb, f: hf }, ball: !!(wind || throwing),
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        if (throwing && !dead) Art.glow(ctx, hf.x, hf.y, 13, SnowmanCfg.ice, 0.45);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESENSCHNEEMANN (Endgegner Welt 50) ──
// ══════════════════════════════════════════

// Riesiger Schneemann, 140 LP, bleibt im Boss-Raum (dem zugefrorenen See). Ablauf Phase 1:
//   Schneedrohen → Schneeball-Fächer → Kreissalve → Schneesturm → Verschnaufpause …
// Phase 2 (halbe LP): schneller, der Fächer wird breiter, der Kreis wirft drei Ringe, der Sturm dauert
//   länger und schiebt stärker. Nach jedem zweiten großen Angriff wird er schwindelig, bei wenig Leben
//   länger (2,2 s) – Marks Zeit zum Zurückhauen.
//   Der Sturm macht die Sicht schlechter (weiße Schleier) und schiebt Mark zur Seite; Mark und Gegner
//   bleiben erkennbar. Kein Gift, kein Schlaf – nur was Leander sich gewünscht hat.
class BossGiantSnowman extends Enemy {
    constructor(x, y) {
        super(x, y, 66, 88);
        this.hp = 140;
        this.maxHp = 140;
        this.speed = 34;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.shadow = { rx: 32, ry: 11, dy: 42, alpha: 0.3 };
        this.fxColor = SnowmanCfg.ice;
        this.seed = Math.random() * 10;
        this._vseed = Math.random() * 400;
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
        // Fächer
        this.fanA = 0;
        this.fanLock = false;
        this.fanFriend = null;
        // Kreis
        this.ringA = 0;
        this.ringLeft = 0;
        this.ringT = 0;
        // Sturm
        this.stormDir = 1;
        this.stormVeil = 0;
        this.stormAimT = 0.9;
        this.stormLock = null;          // {x, y, ang, t, dur}
        this.ringBase = 0;
    }

    static room(world) { return SnowmanArt.room(world); }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // Sturmstärke 0..1: rollt sich ein und wieder aus, damit der Wind nicht plötzlich anfängt
    _gust() {
        if (this.state !== 'storm') return 0;
        const k = this._k();
        return clamp(Math.min(k * 4.5, (1 - k) * 4.5), 0, 1);
    }

    // Wo der Riese wirft (obere Körperhöhe)
    _muzzle() { return { x: this.centerX(), y: this.y + this.h * 0.3 }; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        const gust = this._gust();
        this.stormVeil += ((gust > 0 ? 1 : 0) - this.stormVeil) * Math.min(1, dt * (gust > 0 ? 3.6 : 2.4));
        if (this.stormVeil < 0.01) this.stormVeil = 0;
        if (this.dead) { this.stormLock = null; return; }
        this.angry += ((this.phase === 2 ? 1 : 0) - this.angry) * Math.min(1, dt * 3);
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 47;
            this.bigHits = 0;
            SnowmanArt.burst(mx, my - 20, [SnowmanCfg.ice, '#ffffff', SnowmanCfg.snowMid], 24, 210, 0.7, { kind: 'star' });
            SnowmanArt.ring(mx, my, SnowmanCfg.ice, 96, 0.6, 6);
            SnowmanArt.shake(8, 0.45);
        }
        const still = this.state === 'intro' || this.state === 'dizzy';
        if (!still) {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (this.state !== 'storm' && Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        // Wind: schiebt Mark zur Seite, aber nicht durch Wände (und nie aus dem Boss-Raum)
        if (gust > 0 && !player.dead && player._moveWithCollision) {
            const push = (this.phase === 2 ? 148 : 116) * gust * this.stormDir;
            player._moveWithCollision(push * dt, 0, world);
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'fanWind':
                if (!this.fanLock) {
                    const near = SnowmanArt.nearTarget(player, mx, my, 400);
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
                if (this.stateT <= 0) {
                    if (this.phase === 2) { this._startRing(); break; }   // Phase 2: erst Fächer, dann Kreis
                    this._afterBig();
                }
                break;
            case 'ringWind':
                if (this.stateT <= 0) {
                    this.ringLeft = this.phase === 2 ? 3 : 1;
                    this.ringT = 0;
                    this.ringA = this.ringBase;
                    this._set('ringShot', this.phase === 2 ? 1.15 : 0.6);
                }
                break;
            case 'ringShot': this._ringShot(dt, projectiles); break;
            case 'stormWind':
                if (this.stateT <= 0) {
                    this.stormLock = null;
                    this.stormAimT = 0.8;
                    this._set('storm', this.phase === 2 ? 4.3 : 3.8);
                }
                break;
            case 'storm': this._storm(dt, player, projectiles); break;
            case 'dizzy':
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.5 : 0.85;
                    this._set('walk', 0);
                }
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        SnowmanArt.clampToRoom(this, world);
    }

    // ── Bewegung im Raum, dann nächster großer Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.7; return; }
        this.step += dt * 4.2;
        let vx = 0, vy = 0;
        if (dist > 128) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 66) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool > 0) return;
        const cyc = this.phase === 2 ? BossGiantSnowman.CYCLE2 : BossGiantSnowman.CYCLE1;
        const what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'fan') this._startFan();
        else if (what === 'ring') this._startRing();
        else if (what === 'storm') this._startStorm(player);
        else this.cool = this.phase === 2 ? 0.45 : 0.9;      // bewusste Verschnaufpause
    }

    // ── a) Fächer: ganz viele Schneebälle gleichzeitig, breit gestreut ──
    _startFan() {
        this.fanLock = false;
        this.fanFriend = null;
        const opts = SnowmanArt.companions();
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
            if (list.length > SNOWBALL_CAP) break;
            list.push(new SnowBall(m.x, m.y, this.fanA + (i - (n - 1) / 2) * step, randRange(158, 178)));
        }
        // Auf einen Freund zielt der Riese zusätzlich – auch der soll Schneebälle abbekommen.
        const fr = this.fanFriend;
        if (fr && !fr.dead && !(fr.koTimer > 0) && list && list.length <= SNOWBALL_CAP) {
            const a = Math.atan2(fr.y + fr.h / 2 - m.y, fr.x + fr.w / 2 - m.x);
            list.push(new SnowBall(m.x, m.y, a, 186));
        }
        SnowmanArt.burst(m.x, m.y, ['#ffffff', SnowmanCfg.snowMid, SnowmanCfg.ice], 14, 170, 0.42, { kind: 'spark' });
        SnowmanArt.shake(3.4, 0.16);
    }

    // ── b) Kreis: rotierender Ring um ihn herum ──
    _startRing() {
        this.ringBase = Math.random() * TAU;
        this._set('ringWind', this.phase === 2 ? 0.6 : 0.74);
    }

    _ringShot(dt, projectiles) {
        this.ringT -= dt;
        if (this.ringT <= 0 && this.ringLeft > 0) {
            this.ringLeft--;
            this.ringT = 0.28;
            this.ringA += 0.3;
            const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
            const m = this._muzzle();
            const n = this.phase === 2 ? 11 : 9;
            if (list) {
                for (let i = 0; i < n; i++) {
                    if (list.length > SNOWBALL_CAP) break;
                    list.push(new SnowBall(m.x, m.y, this.ringA + (TAU * i) / n, 148));
                }
            }
            SnowmanArt.ring(m.x, m.y, SnowmanCfg.ice, 44, 0.32, 3.4);
            SnowmanArt.burst(m.x, m.y, ['#ffffff', SnowmanCfg.ice], 8, 130, 0.36, { kind: 'spark' });
            SnowmanArt.shake(2.6, 0.12);
        }
        if (this.stateT <= 0 || (this.ringLeft === 0 && this.ringT <= 0)) this._afterBig();
    }

    // ── c) Schneesturm: weiße Schleier + Wind, der Mark zur Seite schiebt ──
    _startStorm(player) {
        // Der Wind schiebt dorthin, wo Mark gerade steht – die Richtung wird angesagt und bleibt stehen.
        this.stormDir = player.x + player.w / 2 >= this.centerX() ? 1 : -1;
        this._set('stormWind', this.phase === 2 ? 0.95 : 1.15);
    }

    _storm(dt, player, projectiles) {
        const gust = this._gust();
        if (gust > 0.25 && Math.random() < 0.2) {
            const m = this._muzzle();
            SnowmanArt.burst(m.x + this.stormDir * 22, m.y - 8, ['#ffffff', SnowmanCfg.snowMid], 2, 150 * gust, 0.5,
                { kind: 'smoke', size: 4 });
        }
        // Einzelne große Schneebälle während des Sturms – erst erscheint der Ansagekreis, dann der Wurf.
        if (!this.stormLock) {
            this.stormAimT -= dt;
            if (this.stormAimT <= 0) {
                const near = SnowmanArt.nearTarget(player, this.centerX(), this.centerY(), 420);
                const m = this._muzzle();
                const t = near ? near.t : { x: player.x + player.w / 2, y: player.y + player.h / 2 };
                this.stormLock = { x: t.x, y: t.y, ang: Math.atan2(t.y - m.y, t.x - m.x), t: 0.5, dur: 0.5 };
            }
        } else {
            this.stormLock.t -= dt;
            if (this.stormLock.t <= 0) {
                const m = this._muzzle();
                const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
                if (list && list.length <= SNOWBALL_CAP) list.push(new SnowBall(m.x, m.y, this.stormLock.ang, 138, true));
                SnowmanArt.burst(m.x, m.y, ['#ffffff', SnowmanCfg.ice], 9, 140, 0.36, { kind: 'spark' });
                this.stormLock = null;
                this.stormAimT = this.phase === 2 ? 0.95 : 1.35;
            }
        }
        if (this.stateT <= 0) {
            this.stormLock = null;
            this._afterBig();
        }
    }

    // Nach großen Angriffen: Verschnaufpause – in Phase 2 und vollends bei wenig Leben wird er schwindelig.
    _afterBig() {
        this.bigHits++;
        const low = this.hp <= this.maxHp * 0.3;
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', low ? 2.2 : 1.6);
            SnowmanArt.burst(this.centerX(), this.y + 16, ['#ffe35a', '#ffffff'], 11, 95, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.55 : 0.95;
        this._set('pant', this.cool + 0.4);
    }

    // Ansagen am Boden: Wurfstrahlen, Windbahnen, Ansagekreise – immer vor allen Figuren
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const k = this._k();
        const m = this._muzzle();
        if (st === 'fanWind') {
            const p = camera.worldToScreen(m.x, m.y);
            const n = this.phase === 2 ? 9 : 7;
            const step = this.phase === 2 ? 0.19 : 0.21;
            LateWorldArt.rays(ctx, p.x, p.y, n, this.fanA - ((n - 1) / 2) * step, 22, 168, k, SnowmanCfg.warn);
            return;
        }
        if (st === 'ringWind' || st === 'ringShot') {
            const p = camera.worldToScreen(m.x, m.y);
            const n = this.phase === 2 ? 11 : 9;
            const off = st === 'ringWind' ? this.ringBase : this.ringA;
            LateWorldArt.rays(ctx, p.x, p.y, n, off, 20, st === 'ringWind' ? 96 + 40 * k : 128,
                st === 'ringWind' ? k : 0.55 + 0.45 * Math.sin(Art.time * 16), SnowmanCfg.warn);
            if (st === 'ringWind') Art.ring(ctx, p.x, p.y, 96, SnowmanCfg.warn, 2.4, 0.35 + 0.3 * k);
            return;
        }
        if (st === 'stormWind' || st === 'storm') {
            // Windbahnen: sie zeigen die Richtung, in die der Wind Mark schieben wird
            const a = this.stormDir > 0 ? 0 : Math.PI;
            const player = typeof Game !== 'undefined' ? Game.player : null;
            const rows = [];
            if (player && !player.dead) rows.push({ x: player.x + player.w / 2 - Math.cos(a) * 34, y: player.y + player.h / 2, len: 226, w: 30 });
            rows.push({ x: this.centerX() - Math.cos(a) * 40, y: this.centerY() + 26, len: 190, w: 26 });
            for (const r of rows) {
                const p = camera.worldToScreen(r.x, r.y);
                LateWorldArt.lane(ctx, p.x, p.y, a, r.len, r.w, st === 'storm' ? 1 : k, SnowmanCfg.warn);
            }
            if (st === 'storm') {
                // Wirbel über dem Riesen: hier dreht sich der Sturm zusammen
                const w = camera.worldToScreen(m.x, m.y - 6);
                Art.ring(ctx, w.x, w.y, 150 + 30 * Math.sin(Art.time * 3), SnowmanCfg.ice, 2.6, 0.3);
            }
            // Große Schneebälle des Sturms: Ansagekreis da, wo sie hinfliegen
            if (this.stormLock) {
                const p = camera.worldToScreen(this.stormLock.x, this.stormLock.y);
                LateWorldArt.warn(ctx, p.x, p.y, 30, 1 - this.stormLock.t / this.stormLock.dur, SnowmanCfg.warnHot);
            }
            return;
        }
    }

    // Über der Nacht-Aufhellung, aber unter Vignette und HUD: die Schneesturm-Schleier
    drawOverLight(ctx, camera) {
        if (this.stormVeil <= 0.02 || this.dead) return;
        SnowmanArt.veils(ctx, this.stormVeil, this.stormDir, this._vseed);
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

    // Riesenschneemann: dieselbe Figur wie die kleinen, 2,4-mal so groß, mit Eiszapfen; Phase 2 mit
    // Rissen, kaltem Leuchten und rotblauem Blick.
    _body(ctx, dead) {
        const S = 2.4;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const storm = st === 'storm';
        const stormWind = st === 'stormWind';
        const fanWind = st === 'fanWind';
        const fanFire = st === 'fanFire';
        const ringWind = st === 'ringWind';
        const ringShot = st === 'ringShot';
        const walk = this.moving && !dizzy && !dead ? Math.sin(this.step * 2) : 0;
        const gust = this._gust();
        const shiver = (stormWind || ringWind) ? Math.sin(t * 24) * 1.6 : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.0 : Math.sin(t * 1.7) * 0.8)
            - (storm ? 1.2 : 0) + (fanFire ? -1.5 : 0) - (rest ? 1.4 : 0);
        const lean = dead ? 0 : (fanWind ? k * 3 : 0) + (fanFire ? -3.2 : 0) + shiver
            + (ringWind ? k * 1.6 : 0) + (ringShot ? Math.sin(t * 9) * 1.4 : 0) + (dizzy ? Math.sin(t * 4) * 2.2 : 0);
        // Äste: ausgeholt über die Schulter, nach dem Wurf weit vorn, im Sturm beide hoch
        let hb = { x: -17 + shiver, y: -20 + Math.max(0, -walk) * 2 };
        let hf = { x: 17 - shiver, y: -20 - Math.max(0, walk) * 2 };
        if (fanWind || ringWind) { hb = { x: -8 - k * 8, y: -34 - k * 6 }; hf = { x: -2 - k * 9, y: -36 - k * 7 }; }
        else if (fanFire || ringShot) { hb = { x: -14, y: -26 }; hf = { x: 24, y: -30 }; }
        else if (stormWind || storm) { hb = { x: -12, y: -42 - gust * 4 }; hf = { x: 12, y: -42 - gust * 4 }; }
        else if (dizzy) { hb = { x: -20 + Math.sin(t * 5) * 2, y: -14 }; hf = { x: 20 + Math.sin(t * 5 + 1) * 2, y: -14 }; }
        else if (rest) { hb = { x: -15, y: -12 }; hf = { x: 15, y: -12 }; }
        ctx.save();
        ctx.scale(this.face * S, S);
        if (p2 && !dead) Art.glow(ctx, 0, -22, 30, SnowmanCfg.ice, 0.18 * this.angry + 0.06 * Math.sin(t * 6));
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (fanWind || fanFire || ringWind || ringShot || storm || stormWind) ? 'open'
                : rest ? 'tired' : 'angry';
        const f = SnowmanArt.figure(ctx, {
            c: C_SNOW, lw: 0.8, t, bob, lean, sway: Math.sin(t * 2.2) * 1.6, mood,
            arms: { b: hb, f: hf }, ball: !!(fanWind || ringWind || (storm && Math.sin(t * 4) > 0)),
            look: { x: this.look.x * this.face, y: this.look.y },
            icicles: !dead, cracks: p2 && !dead,
        });
        if (p2 && !dead && !dizzy) Art.glow(ctx, f.hx + 1.2, f.hy - 1, 8, '#5ad8ff', 0.3 + 0.2 * Math.sin(t * 9));
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, (f.hx + 1) * this.face * S, f.hy * S - 16, 26, 4.6);
        // Im Sturm wirbelt Schnee um den Riesen
        if ((storm || stormWind) && !dead) {
            const prev = ctx.globalAlpha;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.6;
            for (let i = 0; i < 3; i++) {
                const a = t * 3.4 + (i * TAU) / 3;
                ctx.globalAlpha = prev * (0.2 + 0.16 * Math.sin(t * 5 + i));
                ctx.beginPath();
                ctx.ellipse(0, -66 - i * 12, 40 + i * 12, 11 + i * 3, Math.sin(t * 2 + i) * 0.2, a, a + 2.4);
                ctx.stroke();
            }
            ctx.globalAlpha = prev;
        }
    }
}

BossGiantSnowman.CYCLE1 = ['fan', 'ring', 'storm', 'walk'];
BossGiantSnowman.CYCLE2 = ['fan', 'storm', 'ring', 'fan', 'walk'];
