// ── Welt 55: Nudelland ──
// Spaghetti-Monster in Spaghetti-Farbe (hellgelb): ein Knäuel aus Nudeln mit zwei großen Augen und
//   langen Nudelarmen. Die Arme peitschen Mark und die Freunde – der Einschlag wird angesagt: erst
//   zieht sich am Ziel ein roter Kreis zusammen, dann schlägt genau dort die Nudel ein
//   (Ansage = Treffer). Der Schlüsselträger ist ROT (Leander), etwas zäher und greift weiter aus.
// Boss: RIESEN-SPAGHETTI-MONSTER – Endgegner von Welt 55, bleibt auf dem großen Teller (Boss-Raum),
//   148 LP, zwei Phasen.
//   Peitsche: eine lange Nudel schlägt auf einen angesagten Kreis – Schaden, kein Zustand.
//   Nudelwirbel: der Riese dreht sich, alle Nudeln peitschen im Kreis; der Wirbel-Kreis steht vorher.
//   Fleischbällchen: fliegen im Bogen auf vorher angesagte Punkte und schlagen dort ein.
//   Tomatensoßen-Pfützen: angesagte Kleckse, danach Pfützen, in denen Mark und die Freunde
//     langsamer werden (mehr Soße = mehr Kleckse, nie mehr als sechs auf einmal).
//   Phase 2 (halbe LP): schneller, die Peitsche kommt früher, mehr Bällchen, längere Wirbel.
//   Bei wenig Leben wird er nach großen Angriffen schwindelig (Sterne, kurz wehrlos) – Marks Zeit.
// Nur die Wirkungen, die Leander genannt hat: Schaden und das Langsamwerden in der Soße. Kein Gift,
// kein Schlaf, kein Schleim. Freunde verschwinden nie: ein tödlicher Treffer haut sie nur um.

const NoodleCfg = {
    noodle: '#f0cf5e',        // Spaghetti-Farbe (hellgelb)
    noodleMid: '#d9b13c',
    noodleDark: '#9c7618',
    noodlePale: '#ffeaa6',
    keyNoodle: '#d92c1c',     // Schlüsselträger: ROT
    keyMid: '#ac1f0f',
    keyDark: '#74130a',
    keyPale: '#ff9a78',
    sauce: '#c02a1a',         // Tomatensoße
    sauceLight: '#e8503a',
    sauceDark: '#7c1408',
    meat: '#8e4a24',          // Fleischbällchen
    meatMid: '#6f3418',
    meatDark: '#4c2210',
    herb: '#4f9a2a',
    eye: '#fffdf2',
    iris: '#7a3a10',
    steam: '#fff2dc',
    warn: '#ff5a3d',
    warnSauce: '#e8503a',
    slowFactor: 0.55,         // Soße: beide laufen nur 55 % so schnell
    slowSeconds: 0.3,
};

// Zwei Nudelpaletten: hellgelb (alle) und rot (Schlüsselträger)
const C_NOODLE = {
    body: NoodleCfg.noodle, mid: NoodleCfg.noodleMid, dark: NoodleCfg.noodleDark, pale: NoodleCfg.noodlePale,
};
const C_NOODLE_KEY = {
    body: NoodleCfg.keyNoodle, mid: NoodleCfg.keyMid, dark: NoodleCfg.keyDark, pale: NoodleCfg.keyPale,
};

// Höchstens so viele Fleischbällchen gleichzeitig unterwegs (wie die Gifttropfen in Welt 53)
const MEATBALL_CAP = 40;
// Höchstens so viele Soßenpfützen auf dem Teller (wie in Welt 35 bei der Kröte)
const SAUCE_CAP = 6;

const NoodleArt = {
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
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },

    // Begleiter treffen: nie verschwinden lassen, ein tödlicher Treffer haut nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(7);
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [NoodleCfg.sauce, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.bossDefeated ||
            typeof Game._bossRoomRect !== 'function') return null;
        // drawUnder bekommt keine Welt mit: ohne Argument bleibt die aktuelle maßgeblich.
        if (world && Game.world !== world) return null;
        return Game._bossRoomRect();
    },

    // Figur in den Boss-Raum zwingen (Bosse verlassen den Raum nie).
    clampToRoom(e, world) {
        const r = this.room(world);
        if (!r) return;
        e.x = clamp(e.x, r.x + 2, r.x + r.w - e.w - 2);
        e.y = clamp(e.y, r.y + 2, r.y + r.h - e.h - 2);
    },

    // Freier Punkt in der Welt (für Einschlag- und Pfützenziele)?
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
    // Die Nudeln ziehen nur Leben ab – keine Zustände, Leander hat keine genannt.
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

    // Verlangsamen in der Soße: Mark über den vorhandenen Helfer player.applySlow, die Freunde über
    // ihre eigene Geschwindigkeit – Juri, Krokodil und Panda kennen keinen Verlangsamen-Zustand und
    // laufen alle über this.speed. Der gemerkte Grundwert wird beim Verlassen der Pfütze exakt
    // zurückgesetzt, dasselbe tut der Boss sofort, wenn er stirbt.
    sauceSlow(c, on) {
        if (!c) return;
        if (on) {
            if (c.noodleSauceBase === undefined) c.noodleSauceBase = c.speed;
            c.speed = (c.noodleSauceBase || 0) * NoodleCfg.slowFactor;
        } else if (c.noodleSauceBase !== undefined) {
            c.speed = c.noodleSauceBase;
            c.noodleSauceBase = undefined;
        }
    },

    // Ein Zielpunkt bleibt im Raum: kein Ansage-Kreis halb in der Wand.
    roomPoint(room, x, y, pad) {
        if (!room) return { x, y };
        return { x: clamp(x, room.x + pad, room.x + room.w - pad), y: clamp(y, room.y + pad, room.y + room.h - pad) };
    },

    // Soßenspritzer am Einschlagpunkt
    sauceFx(x, y, R) {
        this.burst(x, y, [NoodleCfg.sauce, NoodleCfg.sauceLight, '#ffffff'], 9, 120, 0.4, { kind: 'dot', gravity: 240 });
        this.ring(x, y, NoodleCfg.sauce, R, 0.24, 3);
    },

    // Nudelpeitsche am Einschlagpunkt: kurze Sternsparkel, kein Zustand
    whipFx(x, y, R) {
        this.burst(x, y, [NoodleCfg.noodle, NoodleCfg.noodlePale, '#ffffff'], 8, 140, 0.36, { kind: 'spark' });
        this.ring(x, y, NoodleCfg.warn, R, 0.22, 3);
    },

    // Dampf über heißen Nudeln
    steamFx(x, y) {
        this.burst(x, y, [NoodleCfg.steam], 2, 34, 0.7, { kind: 'bubble', size: 4 });
    },

    // ── Eine Nudel: gewellte Linie mit Umriss (Arme, Beine, Knäuel-Wellen) ──
    // o: { color, width, amp, waves, phase, outline (Farbe|false), lineWidth, taper }
    strand(ctx, x0, y0, x1, y1, o = {}) {
        const color = o.color || NoodleCfg.noodle;
        const width = o.width || 3;
        const amp = o.amp === undefined ? 2 : o.amp;
        const waves = o.waves === undefined ? 2 : o.waves;
        const phase = o.phase || 0;
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const N = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const outline = o.outline === false ? null : (o.outline || Art.ink(color));
        for (let pass = outline ? 0 : 1; pass <= 1; pass++) {
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const u = i / N;
                // Auslenkung zu beiden Enden hin ausblenden, sonst sitzt die Nudel nicht sauber an
                const off = Math.sin(u * Math.PI * waves + phase) * amp * Math.sin(Math.PI * u);
                const x = x0 + dx * u + nx * off, y = y0 + dy * u + ny * off;
                if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            if (pass === 0) {
                ctx.strokeStyle = outline;
                ctx.lineWidth = width + (o.lineWidth || Art.LINE) * 2;
            } else {
                ctx.strokeStyle = color;
                ctx.lineWidth = width;
            }
            ctx.stroke();
        }
    },

    // ── Ganze Figur: von vorn, klar erkennbar ──
    // Knäuel aus Nudeln als Körper, zwei große Augen mittendrin, ein Mund, zwei lange Nudelarme und
    // zwei kurze Nudelfüße. p = { c, lw, t, bob, mood, look, seed, red, arms: [{sx, sy, x, y, amp,
    //   phase, width, front}], feet: [liftL, liftR], tuft: [{x, dx, h}], sauce: [{x, y, r}], blush }
    figure(ctx, p) {
        const c = p.c, lw = p.lw, t = p.t;
        const by = -16 - p.bob;                 // Körpermitte (Fußpunkt der Figur ist 0,0)
        const arms = p.arms || [];

        // ── Nudelfüße ──
        for (let i = 0; i < 2; i++) {
            const s = i ? 1 : -1;
            const lift = (p.feet && p.feet[i]) || 0;
            NoodleArt.strand(ctx, s * 4.5, by + 9.5, s * 8, -1 - lift, {
                color: c.mid, width: 4.4, amp: 1, waves: 1.5, phase: t * 2 + s, lineWidth: lw * 0.8,
            });
        }

        // ── hintere Nudelarme ──
        for (const a of arms) if (!a.front) this._arm(ctx, c, lw, a);

        // ── Knäuel (Körper) ──
        Art.body(ctx, 0, by, 15, 13.8, c.body, { glossy: true, lineWidth: lw });
        // Querwellen: man sieht, dass das Knäuel aus einzelnen Nudeln gedreht ist
        for (let i = 0; i < 5; i++) {
            const yy = by - 8.4 + i * 4.2;
            const k = (yy - by) / 13.8;
            const half = Math.sqrt(Math.max(0, 1 - k * k)) * 13.6;
            if (half < 3) continue;
            NoodleArt.strand(ctx, -half, yy, half, yy + 0.8, {
                color: i % 2 ? c.pale : c.mid, width: 2.6, amp: 1.4, waves: 3,
                phase: t * 0.9 + i * 1.7, outline: false,
            });
        }
        // hochstehende Nudelenden (macht die Silhouette zur Nudel)
        for (const s of (p.tuft || [])) {
            NoodleArt.strand(ctx, s.x, by - 10.5, s.x + s.dx, by - 10.5 - s.h, {
                color: c.mid, width: 2.6, amp: 1.6, waves: 1.3, phase: t * 1.6 + s.x, lineWidth: lw * 0.8,
            });
        }
        // Soßentropfen obendrauf
        for (const s of (p.sauce || [])) {
            Art.body(ctx, s.x, by + s.y, s.r, s.r * 0.82, NoodleCfg.sauce, { glossy: true, lineWidth: lw * 0.7 });
        }

        // ── Gesicht: zwei große Augen, ein Mund ──
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        const ey = by - 1.6;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, 0, ey, 2.2, 5.4);
        } else if (mood !== 'dizzy') {
            Art.eyes(ctx, 0, ey, 4.4, {
                gap: 5.4, look, seed: p.seed, angry: mood !== 'tired',
                iris: p.red ? '#ff3b3b' : NoodleCfg.iris, sclera: NoodleCfg.eye,
                open: mood === 'tired' ? 0.55 : 1,
            });
        }
        Art.mouth(ctx, 0, by + 7.6, 9.5,
            mood === 'open' ? 'open' : (mood === 'dizzy' || mood === 'tired') ? 'o' : 'grin',
            { color: c.dark });
        if (p.blush) Art.blush(ctx, 0, by + 4.6, 2.6, 8.6, p.red ? '#ffd0c0' : '#ff9a6a');

        // ── vordere Nudelarme ──
        for (const a of arms) if (a.front) this._arm(ctx, c, lw, a);

        return { by, ey };
    },

    // Ein Nudelarm: gewellte Nudel von der Schulter (sx, sy) zur Hand (x, y) mit Soßenspitze.
    _arm(ctx, c, lw, a) {
        const width = a.width || 4.2;
        NoodleArt.strand(ctx, a.sx, a.sy, a.x, a.y, {
            color: c.body, width, amp: a.amp === undefined ? 2.6 : a.amp,
            waves: a.waves || 2.4, phase: a.phase || 0, lineWidth: lw,
        });
        Art.body(ctx, a.x, a.y, width * 0.72, width * 0.66, c.mid, { lineWidth: lw * 0.8, highlight: false });
    },

    // ── Fleischbällchen (für Wurf und Bodenmarkierung) ──
    meatball(ctx, x, y, r, t, seed) {
        Art.body(ctx, x, y, r, r * 0.94, NoodleCfg.meat, { glossy: true, lineWidth: 1.4 });
        ctx.fillStyle = NoodleCfg.meatMid;
        for (let i = 0; i < 3; i++) {
            const a = seed + i * 2.1;
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.42, r * 0.2, 0, TAU);
            ctx.fill();
        }
        ctx.fillStyle = NoodleCfg.herb;
        ctx.beginPath();
        ctx.arc(x + r * 0.3, y - r * 0.34, r * 0.16, 0, TAU);
        ctx.fill();
        Art.shine(ctx, x - r * 0.34, y - r * 0.4, r * 0.3, r * 0.18, -0.5, 0.55);
    },

    // ── Soßenpfütze am Boden (Zeichnung unter allen Figuren) ──
    puddle(ctx, sx, sy, p, fade) {
        const wob = 1 + Math.sin(Art.time * 2.6 + p.seed) * 0.07;
        const rx = p.r * wob, ry = p.r * 0.5 * (2 - wob);
        ctx.fillStyle = NoodleCfg.sauceDark;
        ctx.globalAlpha = fade * 0.5;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = fade * 0.72;
        ctx.fillStyle = NoodleCfg.sauce;
        ctx.beginPath();
        ctx.ellipse(sx, sy - 1, rx * 0.86, ry * 0.82, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = NoodleCfg.sauceLight;
        ctx.lineWidth = 2;
        ctx.stroke();
        // zwei aufsteigende Bläschen: die Soße kocht noch
        ctx.fillStyle = NoodleCfg.sauceLight;
        for (let i = 0; i < 2; i++) {
            const a = Art.time * 1.7 + p.seed + i * 3;
            ctx.beginPath();
            ctx.arc(sx + Math.cos(a) * rx * 0.4, sy - 2 + Math.sin(a) * ry * 0.35, 2.2, 0, TAU);
            ctx.fill();
        }
        // ein Käsespäne-Fleck: passt zum Tischtuch-Boden
        ctx.fillStyle = NoodleCfg.noodlePale;
        ctx.globalAlpha = fade * 0.8;
        ctx.beginPath();
        ctx.ellipse(sx - rx * 0.42, sy + ry * 0.2, 2.6, 1.6, 0.4, 0, TAU);
        ctx.fill();
    },
};

// ══════════════════════════════════════════
// ── Fleischbällchen (Wurf des Riesen-Spaghetti-Monsters) ──
// ══════════════════════════════════════════

// Fliegt im Bogen auf einen vorher angesagten Punkt und schlägt dort ein – geworfen wird nur auf
// Kreise, die schon standen. Eigener Flugeigner (owner 'lobber', wie in pumpkin.js und candy.js):
// die Engine prüft für ihn keinen Treffer, getroffen wird erst beim Aufschlag.
class Meatball extends Projectile {
    constructor(x, y, tx, ty, flight, damage) {
        super(x, y, 0, 0, damage || 1, 'lobber', 170);
        this.sx = x;
        this.sy = y;
        this.tx = tx;
        this.ty = ty;
        this.flight = Math.max(0.16, flight || 0.5);
        this.lifetime = this.flight + 0.3;
        this.radius = 10;
        this.height = 34 + Math.hypot(tx - x, ty - y) * 0.16;
        this.lift = 0;
        this.spin = randRange(-6, 6);
        this.seed = Math.random() * 10;
    }

    update(dt) {
        this.age += dt;
        this.lifetime -= dt;
        const t = clamp(this.age / this.flight, 0, 1);
        this.x = lerp(this.sx, this.tx, t);
        this.y = lerp(this.sy, this.ty, t);
        this.lift = Math.sin(Math.PI * t) * this.height;
        if (Math.random() < dt * 9) NoodleArt.burst(this.x, this.y - this.lift, [NoodleCfg.steam], 1, 26, 0.5, { kind: 'bubble', size: 3 });
        if (t >= 1 || this.lifetime <= 0) {
            this._land();
            this.dead = true;
        }
    }

    // Aufschlag genau auf dem angesagten Kreis: Schaden, Soßenspritzer, kurze Erschütterung
    _land() {
        const R = 30;
        NoodleArt.areaHit(this.tx, this.ty, R, this.damage, 190, null);
        NoodleArt.sauceFx(this.tx, this.ty, R);
        NoodleArt.burst(this.tx, this.ty - 4, [NoodleCfg.meat, NoodleCfg.meatMid, '#ffffff'], 8, 130, 0.42, { kind: 'dot', gravity: 300 });
        NoodleArt.shake(2.6, 0.12);
    }

    draw(ctx, camera) {
        const g = camera.worldToScreen(this.x, this.y);
        const r = this.radius;
        // Bodenpunkt: daran erkennt man den zu erwartenden Einschlag
        ctx.globalAlpha = 0.3;
        Art.ring(ctx, g.x, g.y, r * 0.9, Art.ink(NoodleCfg.sauce), 1.4, 1);
        ctx.globalAlpha = 1;
        const y = g.y - this.lift;
        Art.glow(ctx, g.x, y, r * 1.9, NoodleCfg.meat, 0.3);
        ctx.save();
        ctx.translate(g.x, y);
        ctx.rotate(this.spin * this.age);
        NoodleArt.meatball(ctx, 0, 0, r, this.age, this.seed);
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Normales Spaghetti-Monster ──
// ══════════════════════════════════════════

// Spaghetti-Monster (Hitbox 30×30, 7 LP, Schlüsselträger 9 LP und rot). Hält 40–140 Abstand, holt dann
//   mit einem Nudelarm aus und peitscht auf eine angesagte Kreisfläche – der Einschlag macht Schaden.
//   Der rote Schlüsselträger greift weiter aus und peitscht schneller. Bei halben LP schaut er müde drein.
class NoodleMonster extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 30);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(44, 54);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = NoodleCfg.noodle;
        this.seed = Math.random() * 10;
        this.detectionRange = 235;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.15 };
        this.state = 'idle';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2);
        this.step = 0;
        this.moving = false;
        this.red = false;                 // rotes Knäuel (Schlüsselträger)
        this.aim = null;                  // {x, y} Punkt der Peitsche
        this.whipHit = [];
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _colors() { return this.red ? C_NOODLE_KEY : C_NOODLE; }

    // Peitschkreis – so groß wie die Fläche, die gleich eingeschlagen wird
    _R() { return this.red ? 32 : 28; }

    // Wie weit reicht der Nudelarm?
    _reach() { return this.red ? 158 : 138; }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (Flag setzt main.js nach dem Erzeugen): rot, zäher, greift weiter aus
            this._keyInit = true;
            this.red = true;
            this.hp = this.maxHp = 9;
            this.speed = randRange(54, 62);
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'whipWind' && this.state !== 'whip') {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('threat', 0.55);    // Drohstellung: beide Arme hoch, Nudeln gewellt
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'threat':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'whipWind':
                if (this.stateT <= 0) {
                    this._whipHit();
                    this._set('whip', 0.22);
                }
                break;
            case 'whip':
                if (this.stateT <= 0) {
                    this.cool = this.red ? randRange(1.1, 1.6) : randRange(1.5, 2.2);
                    this._set('hop', 0.32);
                }
                break;
            case 'hop':
                this._hop(dt, world, dist, dx, dy);
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, dann peitschen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.2;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.25 * dt, Math.cos(this.step * 0.7) * this.speed * 0.25 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 86) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 36) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 7.6;
        } else this.step += dt * 1.8;
        if (this.cool > 0 || dist > this._reach()) return;
        const near = NoodleArt.nearTarget(player, this.centerX(), this.centerY(), this._reach());
        this.aim = near ? { x: near.t.x, y: near.t.y } : { x: this.centerX() + this.face * 30, y: this.centerY() + 6 };
        if (Math.abs(this.aim.x - this.centerX()) > 3) this.face = this.aim.x > this.centerX() ? 1 : -1;
        this.whipHit = [];
        this._set('whipWind', this.red ? 0.4 : 0.5);
    }

    // Kurzer Hüpfer seitwärts nach der Peitsche (Nudeln wackeln nach)
    _hop(dt, world, dist, dx, dy) {
        const side = this.seed > 5 ? 1 : -1;
        const vx = (-dy / dist) * side, vy = (dx / dist) * side;
        Kit915.rush(this, vx * this.speed * 0.7 * dt, vy * this.speed * 0.7 * dt, world);
        this.moving = true;
        this.step += dt * 12;
        if (Math.random() < dt * 7) NoodleArt.steamFx(this.centerX() - vx * 10, this.y + 4);
    }

    // Die Peitsche landet genau dort, wo der Kreis stand – sie reicht also bis an den Kreis heran.
    _whipHit() {
        const a = this.aim || { x: this.centerX() + this.face * 28, y: this.centerY() + 6 };
        const R = this._R();
        NoodleArt.areaHit(a.x, a.y, R, this.damage, 165, this.whipHit);
        NoodleArt.whipFx(a.x, a.y, R);
        NoodleArt.shake(2, 0.1);
    }

    // Ansage am Boden: der Peitschenkreis (unter allen Figuren, damit nichts verdeckt wird)
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if ((st === 'whipWind' || st === 'whip') && this.aim) {
            const p = camera.worldToScreen(this.aim.x, this.aim.y);
            LateWorldArt.warn(ctx, p.x, p.y, this._R(), st === 'whip' ? 1 : this._k(), NoodleCfg.warn);
            if (st === 'whipWind') {
                // der erhobene Nudelarm zeigt sichtbar auf den Kreis
                const s = camera.worldToScreen(this.centerX(), this.y + 2);
                LateWorldArt.chevrons(ctx, s.x, s.y, Math.atan2(this.aim.y - (this.y + 2), this.aim.x - this.centerX()), this._k(), NoodleCfg.warn);
            }
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 15)) {
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

    // Spaghetti-Monster mit Fußpunkt (0, 0); Zeichnung in NoodleArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const c = this._colors();
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const threat = st === 'threat' ? 1 : 0;
        const wind = st === 'whipWind' ? k : 0;
        const whip = st === 'whip' ? 1 : 0;
        const lashing = st === 'whipWind' || st === 'whip';
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        // Ausholen: Arm hoch und zurück, Körper leicht weggelehnt; Peitsche: Arm lang nach vorn
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.1 : Math.sin(t * 2.3) * 0.7) + wind * 2.2 - whip * 1.4;
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.035 : Math.sin(t * 2.3) * 0.016) + wind * 0.02;
        const feet = [
            Math.max(0, Math.sin(this.step * 2)) * 2.4,
            Math.max(0, Math.sin(this.step * 2 + 3.1)) * 2.4,
        ];
        // Peitschenhand in Figur-Koordinaten (Welt -> Bildschirm -> lokal nach ctx.scale(face, 1))
        const hand = this._handLocal(lashing, whip, wind);
        const raised = threat * 6 + wind * 9;
        const arms = [
            {
                sx: -13, sy: -15, x: -21 - wind * 4, y: -13 - raised - Math.max(0, -walk) * 2,
                amp: 2.6 + wind * 1.6, phase: t * 3.1, front: false,
            },
            hand ? {
                sx: 13, sy: -15, x: hand.x, y: hand.y,
                amp: whip ? 1.1 : 2.6 + wind * 2.2, waves: whip ? 1.4 : 2.4,
                phase: t * (whip ? 12 : 3.4), width: 4.4, front: true,
            } : {
                sx: 13, sy: -15, x: 21 + wind * 3, y: -13 - raised - Math.max(0, walk) * 2,
                amp: 2.6, phase: t * 3.4 + 1.7, front: true,
            },
        ];
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -17, 26, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        if (whip && hand) Art.glow(ctx, hand.x, hand.y, 20, NoodleCfg.warn, 0.45);
        const mood = dead ? 'dead' : (wind || whip || threat) ? 'open' : tired ? 'tired' : 'angry';
        NoodleArt.figure(ctx, {
            c, lw: 1.3, t, bob, mood, arms, feet,
            seed: this.seed, red: this.red, blush: !dead && !tired,
            tuft: [{ x: -6, dx: -3, h: 5.5 }, { x: 1, dx: 1, h: 7 }, { x: 7, dx: 4, h: 4.5 }],
            sauce: [{ x: -5, y: -10.5, r: 2.4 }, { x: 4.5, y: -9, r: 1.7 }],
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        ctx.restore();
    }

    // Hand-Ziel der Peitsche in den Figuren-Koordinaten von _body (Fußpunkt 0,0, nach ctx.scale(face, 1)).
    // Ausholen zieht die Hand über den Kopf zurück, die Peitsche selbst streckt sie bis an den Kreis.
    _handLocal(lashing, whip, wind) {
        if (!this.aim || !lashing) return null;
        const cam = (typeof Game !== 'undefined' && Game.camera) ? Game.camera : null;
        if (!cam) return null;
        const pos = cam.worldToScreen(this.x, this.y);
        const a = cam.worldToScreen(this.aim.x, this.aim.y);
        let lx = (a.x - pos.x - this.w / 2) * this.face, ly = a.y - (pos.y + this.h);
        const max = this._reach();
        const d = Math.hypot(lx, ly) || 1;
        if (d > max) { lx *= max / d; ly *= max / d; }
        if (!whip) return { x: -6 - wind * 6, y: -40 - wind * 8 };       // ausgeholt über dem Kopf
        return { x: lx, y: ly };
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESEN-SPAGHETTI-MONSTER (Endgegner Welt 55) ──
// ══════════════════════════════════════════

// Riesen-Spaghetti-Monster, 148 LP, bleibt auf dem Teller (Boss-Raum). Ablauf Phase 1:
//   Drohen → Peitsche → Fleischbällchen → Verschnaufpause → Nudelwirbel → Soßenpfützen …
//   Jede Wirkung steht vorher als Kreis auf dem Boden. Phase 2 (halbe LP): schneller, drei Bällchen,
//   vierte Pfütze, die Peitsche holt kürzer aus. Bei wenig Leben wird er nach großen Angriffen
//   schwindelig (Sterne, kurz wehrlos) – Marks Zeit zum Zurückhauen.
class BossGiantNoodle extends Enemy {
    constructor(x, y) {
        super(x, y, 94, 80);
        this.hp = 148;
        this.maxHp = 148;
        this.speed = 34;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;      // Schaden macht nur, was angesagt ist
        this.phasesThroughWalls = false;
        this.shadow = { rx: 43, ry: 14, dy: 38, alpha: 0.32 };
        this.fxColor = NoodleCfg.noodle;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.15 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 1.9;
        this.stateDur = 1.9;
        this.seq = 0;
        this.cool = 0.7;
        this.step = 0;
        this.moving = false;
        // Peitsche
        this.whipAim = null;
        this.whipR = 52;
        this.hitOnce = [];
        // Nudelwirbel
        this.spinAngle = 0;
        this.spinRate = 0;
        this.spinTick = 0;
        this.spinR = 0;
        // Fleischbällchen
        this.lobPts = [];
        // Soßenpfützen
        this.puddles = [];
        this.saucePts = [];
        this._slowed = [];
        this._markSlowed = false;
        this._steam = 0;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.2);
        // Sterben die Nudeln, hört die Soße sofort auf: kein Freund bleibt auf halber Tempo stehen.
        if (this.dead) this._releaseSauce();
    }

    _releaseSauce() {
        for (const c of this._slowed) NoodleArt.sauceSlow(c, false);
        this._slowed = [];
        this.puddles = [];
        // Marks Langsamkeit laeuft in der Engine noch kurz nach – die Soesse ist aber weg, also weg damit.
        if (this._markSlowed && typeof Game !== 'undefined' && Game.player
            && Game.player.slowTimer <= NoodleCfg.slowSeconds + 0.001) {
            Game.player.slowTimer = 0;
            Game.player.slowFactor = 1;
        }
        this._markSlowed = false;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.speed = 47;
            NoodleArt.burst(mx, my - 26, [NoodleCfg.sauce, NoodleCfg.noodle, '#ffffff'], 26, 210, 0.7, { kind: 'star' });
            NoodleArt.ring(mx, my, NoodleCfg.sauce, 108, 0.6, 6);
            NoodleArt.shake(8, 0.45);
        }
        this._updatePuddles(dt, player);
        this._steam -= dt;
        if (this._steam <= 0) { this._steam = 0.5; NoodleArt.steamFx(mx + randRange(-22, 22), this.y + 6); }
        const still = this.state === 'intro' || this.state === 'dizzy';
        if (!still) {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (this.state !== 'spin' && this.state !== 'spinWind' && this.state !== 'lobWind' && this.state !== 'lob' &&
                Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'whipWind':
                if (!this.whipAim) this._aimWhip(player);
                if (this.stateT <= 0) {
                    this._whipHit();
                    this._set('whip', 0.26);
                }
                break;
            case 'whip':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'spinWind':
                if (this.stateT <= 0) {
                    this.spinTick = 0;
                    this.hitOnce = [];
                    this._set('spin', this.phase === 2 ? 2.9 : 2.3);
                }
                break;
            case 'spin': this._spin(dt, world, player, dist, dx, dy); break;
            case 'lobWind':
                if (this.stateT <= 0) this._throw(projectiles);
                break;
            case 'lob':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'sauceWind':
                if (this.stateT <= 0) this._dropSauce(world);
                break;
            case 'sauceDrop':
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'dizzy':
                this.spinRate *= Math.exp(-6 * dt);
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.45 : 0.8;
                    this._set('walk', 0);
                }
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        NoodleArt.clampToRoom(this, world);
    }

    // ── Bewegung auf dem Teller, dann nächster großer Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 5.2;
        let vx = 0, vy = 0;
        if (dist > 126) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 66) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool > 0) return;
        const cyc = this.phase === 2 ? BossGiantNoodle.CYCLE2 : BossGiantNoodle.CYCLE1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'whip' && dist > 210) what = 'lob';        // die Nudel reicht nicht so weit
        if (what === 'whip') this._startWhip();
        else if (what === 'spin') this._startSpin();
        else if (what === 'lob') this._startLob(player);
        else if (what === 'sauce') this._startSauce(player, world);
        else this.cool = this.phase === 2 ? 0.45 : 0.9;         // bewusste Verschnaufpause
    }

    // ── a) Peitsche: eine lange Nudel schlägt auf den angesagten Kreis ──
    _startWhip() {
        this.whipAim = null;
        this.hitOnce = [];
        this._set('whipWind', this.phase === 2 ? 0.46 : 0.62);
    }

    _aimWhip(player) {
        const mx = this.centerX(), my = this.centerY();
        const near = NoodleArt.nearTarget(player, mx, my, 205);
        this.whipAim = near ? { x: near.t.x, y: near.t.y } : { x: mx + this.face * 60, y: my + 12 };
        if (Math.abs(this.whipAim.x - mx) > 4) this.face = this.whipAim.x > mx ? 1 : -1;
    }

    _whipHit() {
        const a = this.whipAim;
        if (!a) return;
        NoodleArt.areaHit(a.x, a.y, this.whipR, this.damage, 260, this.hitOnce);
        NoodleArt.whipFx(a.x, a.y, this.whipR);
        NoodleArt.burst(a.x, a.y, [NoodleCfg.noodle, NoodleCfg.noodlePale], 8, 150, 0.4, { kind: 'spark' });
        NoodleArt.shake(5.2, 0.2);
    }

    // ── b) Nudelwirbel: der Riese dreht sich, alle Nudeln peitschen im Kreis ──
    _startSpin() {
        this.spinR = this.phase === 2 ? 80 : 70;    // der angekündigte Kreis gilt für den ganzen Wirbel
        this.spinTick = 0;
        this.hitOnce = [];
        this._set('spinWind', this.phase === 2 ? 0.62 : 0.82);
    }

    _spinRadius() { return this.spinR || (this.phase === 2 ? 80 : 70); }

    _spin(dt, world, player, dist, dx, dy) {
        this.spinRate = Math.min(this.phase === 2 ? 17 : 13, this.spinRate + 30 * dt);
        this.spinAngle = (this.spinAngle + this.spinRate * dt) % TAU;
        if (!player.dead && dist > 62) {
            const sp = this.speed * (this.phase === 2 ? 1.35 : 1.1);
            Kit915.rush(this, (dx / dist) * sp * dt, (dy / dist) * sp * dt, world);
            this.moving = true;
        }
        if (Math.random() < dt * 20) {
            const a = Math.random() * TAU, R = this._spinRadius();
            NoodleArt.burst(this.centerX() + Math.cos(a) * R, this.centerY() + Math.sin(a) * R * 0.7,
                [NoodleCfg.noodle, NoodleCfg.noodlePale, '#ffffff'], 2, 70, 0.5, { kind: 'spark' });
        }
        this.spinTick -= dt;
        if (this.spinTick <= 0) {
            this.spinTick = this.phase === 2 ? 0.3 : 0.36;
            const R = this._spinRadius();
            NoodleArt.areaHit(this.centerX(), this.centerY(), R, 1, 170, this.hitOnce);
            NoodleArt.ring(this.centerX(), this.centerY(), NoodleCfg.noodle, R, 0.24, 3.4);
            NoodleArt.shake(2.4, 0.1);
        }
        if (this.stateT <= 0) {
            this.spinRate *= 0.4;
            this._afterBig();
        }
    }

    // ── c) Fleischbällchen: fliegen auf die Kreise, die schon standen ──
    _startLob(player) {
        const pts = [];
        const room = NoodleArt.room(typeof Game !== 'undefined' ? Game.world : null);
        const tied = NoodleArt.targets(player)
            .map(t => ({ t, d: Math.hypot(t.x - this.centerX(), t.y - this.centerY()) }))
            .sort((a, b) => a.d - b.d);
        const n = this.phase === 2 ? 3 : 2;
        for (const o of tied) {
            if (pts.length >= n) break;
            pts.push(NoodleArt.roomPoint(room, o.t.x, o.t.y, 26));
        }
        while (pts.length < n) {
            const a = Math.random() * TAU, d = randRange(40, 90);
            pts.push(NoodleArt.roomPoint(room, this.centerX() + Math.cos(a) * d, this.centerY() + Math.sin(a) * d * 0.8, 30));
        }
        this.lobPts = pts;
        this._set('lobWind', this.phase === 2 ? 0.58 : 0.72);
    }

    _throw(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const mx = this.centerX(), my = this.y + 4;
        NoodleArt.burst(mx, my, [NoodleCfg.meat, NoodleCfg.sauce, '#ffffff'], 10, 150, 0.4, { kind: 'spark' });
        NoodleArt.shake(3, 0.14);
        if (!list) { this._afterBig(); return; }
        let flight = 0, eigene = 0;
        for (const p of list) if (!p.dead && p instanceof Meatball) eigene++;
        for (const p of this.lobPts) {
            if (eigene >= MEATBALL_CAP) break;
            eigene++;
            const d = Math.hypot(p.x - mx, p.y - my);
            const f = clamp(d / 250, 0.26, 0.95);
            flight = Math.max(flight, f);
            list.push(new Meatball(mx, my, p.x, p.y, f, 1));
        }
        this._set('lob', flight + 0.4);
    }

    // ── d) Tomatensoße: erst die Kreise, dann die Pfützen (langsamer darin) ──
    _startSauce(player, world) {
        const n = this.phase === 2 ? 4 : 3;
        const room = NoodleArt.room(world);
        const pts = [];
        const tied = NoodleArt.targets(player)
            .map(t => ({ t, d: Math.hypot(t.x - this.centerX(), t.y - this.centerY()) }))
            .sort((a, b) => a.d - b.d);
        for (const o of tied) {
            if (pts.length >= n) break;
            pts.push(NoodleArt.roomPoint(room, o.t.x, o.t.y, 34));
        }
        let guard = 0;
        while (pts.length < n && guard++ < 30) {
            const a = Math.random() * TAU, d = randRange(50, 110);
            let x = this.centerX() + Math.cos(a) * d, y = this.centerY() + Math.sin(a) * d * 0.8;
            if (room) {
                x = clamp(x, room.x + 34, room.x + room.w - 34);
                y = clamp(y, room.y + 34, room.y + room.h - 34);
            } else if (!NoodleArt.free(world, x, y, 20)) continue;
            pts.push({ x, y });
        }
        this.saucePts = pts;
        this._set('sauceWind', this.phase === 2 ? 0.6 : 0.76);
    }

    _dropSauce(world) {
        let dropped = 0;
        for (const p of this.saucePts) {
            if (this.puddles.length >= SAUCE_CAP) break;
            this.puddles.push({ x: p.x, y: p.y, r: 34, life: 6, seed: Math.random() * 10 });
            dropped++;
            NoodleArt.burst(p.x, p.y, [NoodleCfg.sauce, NoodleCfg.sauceLight, NoodleCfg.sauceDark], 12, 130, 0.45, { kind: 'dot', gravity: 320 });
            NoodleArt.ring(p.x, p.y, NoodleCfg.sauce, 34, 0.3, 3.6);
        }
        if (dropped) NoodleArt.shake(4, 0.18);
        this.saucePts = [];
        this._set('sauceDrop', 0.42);
    }

    // Pfützen: zählen ab, verlangsamen Mark (vorhandener Helfer) und die Freunde (Tempo)
    _updatePuddles(dt, player) {
        if (!this.puddles.length && !this._slowed.length && !this._markSlowed) return;
        for (const p of this.puddles) p.life -= dt;
        compactInPlace(this.puddles, p => p.life > 0);
        const inside = [];
        let markDrin = false;
        if (this.puddles.length) {
            if (player && !player.dead && typeof player.applySlow === 'function') {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                for (const p of this.puddles) {
                    if (Math.hypot(px - p.x, py - p.y) < p.r + player.w / 3) {
                        player.applySlow(NoodleCfg.slowSeconds, NoodleCfg.slowFactor);
                        markDrin = true;
                        break;
                    }
                }
            }
            for (const c of NoodleArt.companions()) {
                const w = c.w || 20, h = c.h || 20, cx = c.x + w / 2, cy = c.y + h / 2;
                for (const p of this.puddles) {
                    if (Math.hypot(cx - p.x, cy - p.y) < p.r + Math.max(w, h) / 3) {
                        inside.push(c);
                        break;
                    }
                }
            }
        }
        for (const c of this._slowed) {
            if (inside.indexOf(c) < 0) NoodleArt.sauceSlow(c, false);
        }
        for (const c of inside) NoodleArt.sauceSlow(c, true);
        this._slowed = inside;
        this._markSlowed = markDrin;      // sitzt Mark gerade in der Soesse? (zum Loslassen beim Tod)
    }

    // Nach großen Angriffen: Verschnaufpause – und bei wenig Leben wird er schwindelig.
    _afterBig() {
        const low = this.hp <= this.maxHp * 0.35;
        if (low) {
            this._set('dizzy', this.hp <= this.maxHp * 0.2 ? 2.2 : 1.7);
            NoodleArt.burst(this.centerX(), this.y + 6, ['#ffe35a', '#ffffff'], 12, 100, 0.5, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.5 : 0.9;
        this._set('pant', this.cool + 0.4);
    }

    // Ansagen am Boden: Peitschenkreis, Wirbel-Ring, Wurf- und Soßenkreise, Pfützen – immer unter
    // allen Figuren, damit kein Kind etwas verdeckt.
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const prev = ctx.globalAlpha;
        for (const p of this.puddles) {
            const s = camera.worldToScreen(p.x, p.y);
            NoodleArt.puddle(ctx, s.x, s.y, p, clamp(p.life / 1.1, 0, 1) * 0.95);
        }
        ctx.globalAlpha = prev;
        const st = this.state;
        const k = this._k();
        if ((st === 'whipWind' || st === 'whip') && this.whipAim) {
            const p = camera.worldToScreen(this.whipAim.x, this.whipAim.y);
            LateWorldArt.warn(ctx, p.x, p.y, this.whipR, st === 'whip' ? 1 : k, NoodleCfg.warn);
            if (st === 'whipWind') {
                const s = camera.worldToScreen(this.centerX(), this.y + 8);
                LateWorldArt.chevrons(ctx, s.x, s.y, Math.atan2(this.whipAim.y - (this.y + 8), this.whipAim.x - this.centerX()), k, NoodleCfg.warn);
            }
            return;
        }
        if (st === 'spinWind' || st === 'spin') {
            const p = camera.worldToScreen(this.centerX(), this.centerY());
            LateWorldArt.warn(ctx, p.x, p.y, this._spinRadius(), st === 'spin' ? 1 : k, NoodleCfg.warn);
            if (st === 'spinWind') {
                // die Speichen zeigen, wohin die Nudeln gleich peitschen
                LateWorldArt.rays(ctx, p.x, p.y, 6, this.spinAngle, 22, this._spinRadius(), k, NoodleCfg.warn);
            }
            return;
        }
        if (st === 'lobWind' || st === 'lob') {
            for (const p of this.lobPts) {
                const s = camera.worldToScreen(p.x, p.y);
                LateWorldArt.warn(ctx, s.x, s.y, 30, st === 'lob' ? 1 : k, NoodleCfg.warn);
            }
            return;
        }
        if (st === 'sauceWind') {
            for (const p of this.saucePts) {
                const s = camera.worldToScreen(p.x, p.y);
                LateWorldArt.warn(ctx, s.x, s.y, 34, k, NoodleCfg.warnSauce);
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
        ctx.restore();
    }

    // Riesen-Spaghetti-Monster: dieselbe Figur wie die kleinen, 2,6-mal so groß, dazu sechs Nudelarme,
    // ein Busch hochstehender Nudelenden und Soßenspritzer. Phase 2: rote Augen und dampfende Soße.
    _body(ctx, dead) {
        const S = 2.6;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const intro = st === 'intro';
        const whipWind = st === 'whipWind' ? k : 0;
        const whip = st === 'whip';
        const spinWind = st === 'spinWind' ? k : 0;
        const spin = st === 'spin';
        const lobWind = st === 'lobWind' ? k : 0;
        const lob = st === 'lob';
        const sauceWind = st === 'sauceWind' ? k : 0;
        const sauceDrop = st === 'sauceDrop';
        const walk = this.moving && !dizzy && !dead && !spin ? Math.sin(this.step * 2) : 0;
        const bob = dead ? -1 : (this.moving ? Math.abs(walk) * 1.3 : Math.sin(t * 1.8) * 1.1)
            + whipWind * 3 + spinWind * 4 + lobWind * 3.5 + sauceWind * 5 + (intro ? 2 : 0)
            - (whip ? 2 : 0) - (rest || dizzy ? 1.6 : 0);
        const squ = dead ? 0 : (this.moving ? Math.abs(walk) * 0.03 : Math.sin(t * 1.8) * 0.013) + spinWind * 0.03;
        const feet = [
            Math.max(0, Math.sin(this.step * 2)) * 3.2,
            Math.max(0, Math.sin(this.step * 2 + 3.1)) * 3.2,
        ];
        const f = { whipWind, whip, lashing: st === 'whipWind' || whip, spinWind, spin, lobWind, lob, sauceWind, sauceDrop, dizzy };
        const arms = this._arms(t, k, f);
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        if (spin) ctx.rotate(Math.sin(this.spinAngle * 2) * 0.06);
        ctx.scale(S * this.face, S);
        if (p2 && !dead) Art.glow(ctx, 0, -17, 30, NoodleCfg.sauce, 0.18 + 0.06 * Math.sin(t * 2.4));
        const mood = dead ? 'dead' : dizzy ? 'dizzy' : (whipWind || whip || spinWind || spin || lobWind || lob || sauceWind || sauceDrop) ? 'open' : rest ? 'tired' : 'angry';
        NoodleArt.figure(ctx, {
            c: p2 ? { body: NoodleCfg.noodle, mid: NoodleCfg.noodleMid, dark: NoodleCfg.noodleDark, pale: NoodleCfg.noodlePale } : C_NOODLE,
            lw: 0.62, t, bob, mood, arms, feet,
            seed: this.seed, red: p2, blush: !dead && !rest && !dizzy,
            tuft: [
                { x: -9, dx: -5, h: 8 }, { x: -3.5, dx: -2, h: 10.5 }, { x: 2, dx: 1, h: 11.5 },
                { x: 7, dx: 4, h: 9 }, { x: 11.5, dx: 7, h: 6 },
            ],
            sauce: [
                { x: -7, y: -11, r: 3.1 }, { x: 1, y: -12.4, r: 2.2 }, { x: 8, y: -9.5, r: 2.6 },
                { x: -2, y: 9.6, r: 2.4 },
            ],
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        if (dizzy) LateWorldArt.dizzy(ctx, 0, -16 - bob - 22, 13, 1.5);
        ctx.restore();
    }

    // Sechs Nudelarme: hinten zwei, vorn zwei bis vier. Beim Wirbel peitschen alle im Kreis, bei der
    // Peitsche streckt sich der vordere rechte Arm bis an den angesagten Kreis, beim Soßenguss langen
    // beide nach unten auf den Teller, beim Werfen halten sie oben die Bällchen.
    _arms(t, k, f) {
        const S = 2.6;
        const swing = Math.sin(this.step * 2) * 3;
        const idle = (sx, sy, dx, dy, ph) => ({
            sx, sy, x: dx, y: dy - Math.max(0, swing) * 0.6, amp: 3, phase: t * 2.6 + ph, width: 4.6, front: false,
        });
        const arms = [
            idle(-14, -16, -25, -14 + swing * 0.4, 0.4),
            idle(14, -16, 25, -14 - swing * 0.4, 2.3),
        ];
        const front = [];
        if (f.spin || f.spinWind) {
            const R = (f.spin ? this._spinRadius() : this._spinRadius() * (0.45 + 0.4 * f.spinWind)) / S;
            for (let i = 0; i < 4; i++) {
                const a = this.spinAngle + (TAU * i) / 4;
                front.push({
                    sx: Math.cos(a) * 8, sy: -16 + Math.sin(a) * 5,
                    x: Math.cos(a) * R, y: -16 + Math.sin(a) * R * 0.72,
                    amp: f.spin ? 1.4 : 3, waves: 2.8, phase: this.spinAngle * 2 + i, width: 4.4, front: true,
                });
            }
        } else if (f.dizzy) {
            const sway = Math.sin(t * 5) * 3;
            front.push({ sx: -13, sy: -14, x: -24 + sway, y: -6, amp: 3.4, phase: t * 2.2, width: 4.6, front: true });
            front.push({ sx: 13, sy: -14, x: 24 + sway, y: -6, amp: 3.4, phase: t * 2.2 + 2, width: 4.6, front: true });
        } else if (f.sauceWind || f.sauceDrop) {
            const q = f.sauceDrop ? 1 : k;
            for (let i = 0; i < 2; i++) {
                const s = i ? 1 : -1;
                front.push({
                    sx: s * 12, sy: -14, x: s * (10 + q * 8), y: -16 + q * 22,
                    amp: 3 - q * 1.6, phase: t * 3 + i, width: 4.6, front: true,
                });
            }
        } else if (f.lobWind || f.lob) {
            const q = f.lob ? Math.min(1, k * 2.2) : 0;
            front.push({ sx: -13, sy: -15, x: -16 - q * 6, y: -30 + q * 6, amp: 2.4, phase: t * 3, width: 4.6, front: true });
            front.push({ sx: 13, sy: -15, x: 15 + q * 8, y: -32 + q * 10, amp: 2.4, phase: t * 3 + 1.6, width: 4.6, front: true });
        } else {
            front.push(idle(-13, -15, -23, -12 - Math.max(0, -swing), 1.1));
            const hand = this._whipHand(f);
            front.push(hand ? {
                sx: 13, sy: -15, x: hand.x, y: hand.y,
                amp: f.whip ? 1.2 : 3 + f.whipWind * 2.4, waves: f.whip ? 1.3 : 2.4,
                phase: t * (f.whip ? 14 : 3.2), width: 5, front: true,
            } : idle(13, -15, 23, -12 - Math.max(0, swing), 3.4));
        }
        return arms.concat(front);
    }

    // Peitschenhand in Figuren-Koordinaten (der Zeichenraum ist um S und face skaliert).
    _whipHand(f) {
        if (!this.whipAim || !f.lashing) return null;
        const cam = (typeof Game !== 'undefined' && Game.camera) ? Game.camera : null;
        if (!cam) return null;
        const S = 2.6;
        const pos = cam.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, foot = pos.y + this.h;
        const a = cam.worldToScreen(this.whipAim.x, this.whipAim.y);
        let lx = (a.x - cx) / this.face / S, ly = (a.y - foot) / S;
        const max = 86;                                   // Reichweite in Figuren-Einheiten
        const d = Math.hypot(lx, ly) || 1;
        if (d > max) { lx *= max / d; ly *= max / d; }
        if (!f.whip) return { x: -8 - f.whipWind * 8, y: -34 - f.whipWind * 10 };   // ausgeholt
        return { x: lx, y: ly };
    }
}

// Angriffsreihenfolgen: dazwischen liegt immer eine Verschnaufpause, damit Mark treffen kann.
BossGiantNoodle.CYCLE1 = ['whip', 'lob', 'pant', 'spin', 'sauce', 'pant'];
BossGiantNoodle.CYCLE2 = ['whip', 'lob', 'spin', 'sauce', 'whip', 'spin'];
