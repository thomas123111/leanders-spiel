// ── Welt 54: Wackelpudding-See (Idee von Leander, 19.10.2026) ──
// Puddingmonster in Vanille (gelb), Erdbeer (rosa) und Waldmeister (gruen): wabbelige Pudding-Wuerfel,
//   die GENAU IHREN Pudding ausspucken – auf Mark UND auf die Freunde. 0,5 s vorher steht die rote
//   Wurfbahn am Boden und der Klecks fliegt genau diese Bahn (Ansage = Treffer). Zu dicht an Mark
//   hopst der Wuerfel zurueck – schlagen kann er nicht.
//   Schluesseltraeger: SCHOKOLADENPUDDING (braun) mit Sahnehaube und Kirsche – haelt mehr aus und
//   spuckt drei Kleckse auf drei angesagten Bahnen.
// Boss: RIESEN-PUDDINGMONSTER – Endgegner von Welt 54, bleibt im Boss-Raum (die riesige Puddingschuessel),
//   148 LP, zwei Phasen, ZEHN ARME (fuenf auf jeder Seite).
//   Puddingregen: aus allen zehn Armen fallen Puddingkleckse auf angesagte Warnflecken am Boden;
//     jeder Fleck platscht genau dort, wo der Kreis stand.
//   Armwirbel: grosser Warnkreis um den Riesen, dann wirbelt er mit allen zehn Armen im Kreis –
//     alles in Reichweite fliegt durch die Luft.
//   Landesprung: er springt hoch, am Ziel steht ein Warnkreis, bei der Landung laeuft eine
//     Puddingwelle in genau diesen Kreis hinaus.
//   Phase 2 (halbe LP): schneller, mehr Flecken, groessere Wirbel und Wellen.
//   Mit wenig Leben wird er nach grossen Angriffen schwindelig (Sterne, kurz wehrlos) – Marks Zeit.
// Nur die Wirkungen, die Leander genannt hat: Schaden durch Pudding. KEINE zusaetzlichen Zustaende.
// Freunde verschwinden nie: ein Treffer, der Juri, das Krokodil oder den Panda besiegen wuerde,
//   haut sie nur um (knockOut).

const PuddingCfg = {
    vanille: '#ffd94f',           // Leanders drei Sorten
    erdbeer: '#ff8fb3',
    waldmeister: '#7fd957',
    schoko: '#8a5a2b',            // Schluesseltraeger: Schokoladenpudding
    cream: '#fff6ea',             // Sahnehaube
    creamShade: '#eadbc8',
    cherry: '#e0243f',            // Kirsche obendrauf
    cherryDark: '#9c0f28',
    stem: '#6b4a1e',
    sauce: '#b06a2a',             // Karamellueberzug des Riesen
    sauceDark: '#7e4a1a',
    warn: '#ff5a3d',
    warnWelle: '#ffb02e',
};

// Hoechstens so viele Puddingkleckse gleichzeitig unterwegs (wie die Gummibaelle in Welt 51).
const PUDDING_CAP = 96;

// Palette pro Grundfarbe (hell/basis/tief), einmal ausgerechnet und behalten.
const _puddingPal = new Map();
function puddingPal(base) {
    let p = _puddingPal.get(base);
    if (!p) {
        p = { base, hi: Art.light(base, 0.45), mid: base, deep: Art.dark(base, 0.42) };
        if (_puddingPal.size > 40) _puddingPal.clear();
        _puddingPal.set(base, p);
    }
    return p;
}

// Punkt auf einer quadratischen Bezier-Kurve (t = 0..1) – heisst hier puddingQP, damit die Datei
// fuer sich steht (qp aus scorpion.js ist zwar geladen, aber Verlass ist nur auf Eigenes).
function puddingQP(a, b, c, t) {
    const u = 1 - t;
    return u * u * a + 2 * u * t * b + t * t * c;
}

// Angesagte Bahn = wirkliche Flugweite: der Klecks vergeht am Ende der roten Bahn.
function puddingWeite(g, len) {
    g.lifetime = (len + g.radius) / (Math.hypot(g.vx, g.vy) || 1);
    return g;
}

const PuddingArt = {
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
    hitCompanion(c, amount, color) {
        if (c.hp - amount <= 0) c.knockOut(7);
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [color || PuddingCfg.vanille, '#ffffff'], 9, 130, 0.42, { kind: 'star' });
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

    nearTarget(player, x, y, maxD) {
        let best = null;
        for (const t of this.targets(player)) {
            const d = Math.hypot(t.x - x, t.y - y);
            if (d > maxD) continue;
            if (!best || d < best.d) best = { t, d };
        }
        return best;
    },

    // Innenraum des Boss-Raums (nur im echten Bosskampf), sonst null.
    room(world) {
        if (typeof Game === 'undefined' || Game.world !== world || !Game.bossActive || typeof Game._bossRoomRect !== 'function') return null;
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

    // Flächenschaden: trifft Mark und die Freunde innerhalb von R, jeder höchstens einmal (hit-Liste).
    // Pudding macht NUR Schaden – keine zusaetzlichen Zustaende (Leanders Wunsch).
    areaHit(x, y, R, amount, force, hit, color) {
        const player = typeof Game !== 'undefined' ? Game.player : null;
        let getroffen = 0;
        for (const t of this.targets(player)) {
            if (hit && hit.indexOf(t.ref) >= 0) continue;
            if (t.ref.dead || t.ref.koTimer > 0) continue;
            if (Math.hypot(t.x - x, t.y - y) > R + Math.max(t.w, t.h) / 2) continue;
            if (hit) hit.push(t.ref);
            getroffen++;
            if (t.isPlayer) Kit915.hurt(t.ref, amount, Math.atan2(t.y - y, t.x - x), force);
            else this.hitCompanion(t.ref, amount, color);
        }
        return getroffen;
    },

    // Klecks platscht: Pudding-Spritzer und ein Ring am Einschlagpunkt
    splatFx(x, y, pal) {
        this.burst(x, y, [pal.base, pal.hi, pal.deep], 9, 120, 0.45, { kind: 'dot', gravity: 210 });
        this.ring(x, y, pal.base, 20, 0.26, 3);
    },

    // ── Pudding-Wuerfel von vorn: Kuppel, Wackelrand, Gesicht – auf den ersten Blick ein Pudding ──
    // p = { pal, lw, t, seed, squ, mood, look, armRaise, armSway, cream(chocolate key), sauce }
    // Fusspunkt der Figur ist (0, 0); Grundbreite +/-11, Hoehe 17.
    figure(ctx, p) {
        const c = p.pal, lw = p.lw, t = p.t;
        const wob = Math.sin(t * 5.2 + p.seed) * 0.7;
        const body = -8.4 + wob * 0.35;

        // ── Aermel (zwei kurze Pudding-Stummel) ──
        const raise = p.armRaise || 0;
        for (const s of [-1, 1]) {
            const sx = s * 8.6, sy = body + 2.4;
            const ang = s * (1.25 - raise * 1.7) + (p.armSway || 0) * s;
            const ex = sx + Math.cos(ang) * s * 5.4, ey = sy + Math.sin(ang) * 5.4 - 1;
            Art.limb(ctx, sx, sy, ex, ey, 3.1, c.mid, { lineWidth: lw });
            Art.body(ctx, ex, ey, 2.1, 2.0, c.hi, { lineWidth: lw * 0.8 });
        }

        // ── Wackel-Puddingkoerper: Kuppel mit drei Wackelbuenden unten ──
        Art.shape(ctx, g => {
            g.moveTo(-11, -1.5);
            g.bezierCurveTo(-11.6, body - 6.5, -7, body - 9.6, 0, body - 9.6);
            g.bezierCurveTo(7, body - 9.6, 11.6, body - 6.5, 11, -1.5);
            for (let i = 0; i < 3; i++) {
                const x0 = 11 - i * 7.33;
                g.quadraticCurveTo(x0 - 3.66, 2.6 + Math.sin(t * 6 + i * 2.1 + p.seed) * 1.3, x0 - 7.33, -1.5);
            }
            g.closePath();
        }, { x: -11.6, y: body - 9.6, w: 23.2, h: 12.8 }, c.base, { glossy: true, lineWidth: lw });
        Art.shine(ctx, -5.2, body - 5.6, 3, 2.1, -0.5, 0.55);

        // ── Sahnehaube + Kirsche (nur beim Schoko-Schluesseltraeger) ──
        if (p.cream) {
            Art.body(ctx, 0, body - 10.2, 5.4, 2.2, PuddingCfg.cream, { lineWidth: lw });
            Art.body(ctx, 0, body - 12.6, 3.8, 1.9, PuddingCfg.cream, { lineWidth: lw });
            Art.body(ctx, 0, body - 14.6, 2.3, 1.5, PuddingCfg.cream, { lineWidth: lw });
            Art.limb(ctx, 0.4, body - 16, 1.8, body - 18.2, 1.1, PuddingCfg.stem, { lineWidth: lw * 0.7 });
            Art.body(ctx, 0, body - 15.6, 2.2, 2.1, PuddingCfg.cherry, { glossy: true, lineWidth: lw });
            Art.shine(ctx, -0.7, body - 16.4, 0.7, 0.5, -0.5, 0.7);
        }

        // ── Gesicht ──
        const mood = p.mood, look = p.look || { x: 0, y: 0 };
        const ey = body + 0.6;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, 0, ey, 1.7, 3.4);
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, s * 3.9, ey, 2.05, { x: look.x, y: look.y }, {
                    angry: mood !== 'tired', side: s < 0 ? 'left' : 'right',
                    iris: '#5a3413', open: mood === 'tired' ? 0.55 : 1,
                });
            }
        }
        Art.mouth(ctx, 0, body + 5.4, 5,
            mood === 'open' ? 'open' : mood === 'dead' ? 'o' : mood === 'tired' ? 'angry' : 'angry',
            { color: c.deep });
        if (mood !== 'dead') Art.blush(ctx, 0, body + 3.6, 1.7, 6.6, Art.alpha(PuddingCfg.cherry, 0.8));

        return { body, ey };
    },

    // Ein fallender Puddingklecks (Regen des Riesen, Wurf-Klecks der Kleinen)
    glob(ctx, x, y, r, pal, t, seed, glow) {
        if (glow) Art.glow(ctx, x, y, r * 2.4, pal.base, 0.45);
        const wob = Math.sin(t * 12 + seed) * 0.14;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 + wob, 1 - wob);
        Art.body(ctx, 0, 0, r, r * 0.9, pal.base, { glossy: true, lineWidth: 1.35 });
        // zwei Tropfen unten: man sieht, dass er kleckst
        ctx.fillStyle = pal.mid;
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.ellipse(-r * 0.4 + i * r * 0.8, r * 0.62, r * 0.2, r * 0.34, 0, 0, TAU);
            ctx.fill();
        }
        Art.shine(ctx, -r * 0.3, -r * 0.4, r * 0.32, r * 0.2, -0.5, 0.6);
        ctx.restore();
    },
};

// ══════════════════════════════════════════
// ── Puddingklecks (Geschoß) ──
// ══════════════════════════════════════════

// Wabbeliger Klecks, der genau die angesagte Bahn fliegt. Trifft Mark ueber die Engine und die
// Freunde ueber companionHit. Macht NUR Schaden – kein Gift, kein Schlaf, kein Schleim.
class PuddingGlob extends Projectile {
    constructor(x, y, angle, speed, color) {
        const sp = speed || randRange(150, 174);
        super(x, y, Math.cos(angle) * sp, Math.sin(angle) * sp, 1, 'enemy', 95);
        this.radius = 6.5;
        this.lifetime = 2.4;
        this.pal = puddingPal(color || PuddingCfg.vanille);
        this.seed = Math.random() * 10;
        this.grace = 0.12;              // direkt am Maul darf kein Freund getroffen werden
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) return;
        if (typeof FX !== 'undefined' && Math.random() < dt * 16) {
            FX.burst(this.x, this.y, [this.pal.base], 1, 18, 0.4, { kind: 'dot', gravity: 120 });
        }
        if (this.age >= this.grace) this._companionHit();
    }

    _companionHit() {
        for (const c of PuddingArt.companions()) {
            const w = c.w || 20, h = c.h || 20;
            if (Math.hypot(this.x - (c.x + w / 2), this.y - (c.y + h / 2)) >= this.radius + Math.max(w, h) / 2) continue;
            PuddingArt.hitCompanion(c, this.damage, this.pal.base);
            this.dead = true;
            PuddingArt.splatFx(this.x, this.y, this.pal);
            return;
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        // weiche Spur in eigener Farbe
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const prev = ctx.globalAlpha;
        for (let i = 3; i >= 1; i--) {
            ctx.globalAlpha = prev * (0.2 - i * 0.05);
            ctx.fillStyle = this.pal.mid;
            ctx.beginPath();
            ctx.arc(p.x - dx * i * this.radius * 0.8, p.y - dy * i * this.radius * 0.8, this.radius * (1 - i * 0.24), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = prev;
        PuddingArt.glob(ctx, p.x, p.y, this.radius, this.pal, Art.time + this.seed, this.seed, this.big);
    }
}

// ══════════════════════════════════════════
// ── Normales Puddingmonster ──
// ══════════════════════════════════════════

// Pudding-Wuerfel (Hitbox 24×24, 6 LP, Schluesseltraeger 9 LP). Haelt 70–190 Abstand und spuckt
//   Pudding auf Mark oder einen Freund; die rote Wurfbahn steht 0,5 s vorher (Ansage = Treffer) und
//   die Kleckse fliegen genau dort lang. Der Schluesseltraeger ist Schokoladenpudding mit Sahnehaube
//   und Kirsche und spuckt drei Kleckse auf drei Bahnen. Bei halben LP schaut er muede drein.
class PuddingMonster extends Enemy {
    constructor(x, y) {
        super(x, y, 24, 24);
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(42, 52);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        const sorten = [PuddingCfg.vanille, PuddingCfg.erdbeer, PuddingCfg.waldmeister];
        this.color = sorten[randInt(0, 2)];
        this.pal = puddingPal(this.color);
        this.fxColor = this.color;
        this.seed = Math.random() * 10;
        this.detectionRange = 250;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.15 };
        this.state = 'walk';
        this.stateT = 0;
        this.stateDur = 0;
        this.cool = randRange(0.9, 2);
        this.step = 0;
        this.moving = false;
        this.choco = false;             // Schokoladen-Schluesseltraeger
        this.aims = [];                 // angesagte Wurfrichtungen (stehen fest vor dem ersten Wurf)
        this.aimLen = 120;
        this.aimLock = false;
        this.throwLeft = 0;             // Schnellfolge
        this._keyInit = false;
        this._engaged = false;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    // Punkt, aus dem die Kleckse fliegen (vorderer Aermel)
    _mouth() {
        return { x: this.centerX() + this.face * 9, y: this.centerY() - 3 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schluesseltraeger (Flag setzt main.js nach dem Erzeugen): Schoko mit Sahne und Kirsche
            this._keyInit = true;
            this.choco = true;
            this.color = PuddingCfg.schoko;
            this.pal = puddingPal(PuddingCfg.schoko);
            this.fxColor = PuddingCfg.schoko;
            this.hp = this.maxHp = 9;
            this.speed = randRange(50, 58);
        }
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        this.moving = false;
        if (this.state !== 'wind' && this.state !== 'throw') {
            // Blick und Richtung bleiben während Ansage und Wurf stehen: die Bahn gilt wirklich.
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 7);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 7);
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
        }
        if (!this._engaged && !player.dead && dist < this.detectionRange) {
            this._engaged = true;
            this._set('jiggle', 0.6);   // kurzes Wackeln: „gleich komt Pudding“
            PuddingArt.burst(mx, my - 6, [this.pal.base, PuddingCfg.cream], 7, 62, 0.5, { kind: 'dot', gravity: 150 });
            return;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'jiggle':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'wind':
                if (!this.aimLock) {
                    const near = PuddingArt.nearTarget(player, mx, my, 250);
                    if (near) {
                        const a = Math.atan2(near.t.y - my, near.t.x - mx);
                        this.aims = this.choco ? [a - 0.16, a, a + 0.16] : [a, a];
                        this.aimLen = clamp(near.d + 24, 70, 220);
                        if (Math.abs(Math.cos(a)) > 0.25) this.face = Math.cos(a) > 0 ? 1 : -1;
                    } else this.aims = this.choco ? [0, 0, 0] : [0, 0];
                    if (this.stateT <= this.stateDur * 0.35) this.aimLock = true;   // Bahnen stehen jetzt fest
                }
                if (this.stateT <= 0) {
                    this.throwLeft = this.aims.length - 1;
                    this._throw(projectiles);
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
                        this.cool = this.choco ? randRange(1.2, 1.6) : randRange(1.3, 1.9);
                        this._set('walk', 0);
                    }
                }
                break;
            case 'back':
                this._back(dt, world, dx, dy, dist);
                if (this.stateT <= 0) {
                    this.cool = randRange(0.6, 1);
                    this._set('walk', 0);
                }
                break;
            default: this._walk(dt, world, player, dist, dx, dy);
        }
    }

    // ── Ansatz: Abstand halten, dann spucken; zu dicht weg hopsen ──
    _walk(dt, world, player, dist, dx, dy) {
        if (player.dead) {
            this.step += dt * 2.2;
            this._moveWithCollision(Math.sin(this.step) * this.speed * 0.22 * dt,
                Math.cos(this.step * 0.7) * this.speed * 0.22 * dt, world);
            return;
        }
        this.cool -= dt;
        let vx = 0, vy = 0;
        if (dist > 170) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 76) { vx = -dx / dist; vy = -dy / dist; }
        if (vx || vy) {
            Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
            this.moving = true;
            this.step += dt * 7;
        } else this.step += dt * 1.8;
        if (this.cool > 0) return;
        if (dist < 62) {
            this._set('back', 0.42);    // Wackel-Rueckhopfer: der Wuerfel hat keinen Schlag
            return;
        }
        if (dist < 235) {
            this.aimLock = false;
            this.aims = [];
            this._set('wind', this.choco ? 0.55 : 0.5);
            return;
        }
        this.cool = 0.5;
    }

    // Huepfen zurueck (weg von Mark) – Wurfbahnen bleiben unangetastet.
    _back(dt, world, dx, dy, dist) {
        const d = dist || 1;
        Kit915.rush(this, (-dx / d) * this.speed * 1.5 * dt, (-dy / d) * this.speed * 1.5 * dt, world);
        this.moving = true;
        this.step += dt * 9;
        if (Math.random() < dt * 7) {
            PuddingArt.burst(this.centerX(), this.centerY() + 10, [this.pal.base, PuddingCfg.cream], 2, 55, 0.3, { kind: 'dot', gravity: 190 });
        }
    }

    // Naechster Klecks auf der naechsten angesagten Bahn.
    _throw(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const m = this._mouth();
        const idx = this.throwLeft;
        const a = this.aims[clamp(idx, 0, this.aims.length - 1)] || 0;
        if (!list || list.length > PUDDING_CAP) {
            PuddingArt.burst(m.x, m.y, [this.pal.base, PuddingCfg.cream], 4, 70, 0.3, { kind: 'dot', gravity: 160 });
            return;
        }
        list.push(puddingWeite(new PuddingGlob(m.x + Math.cos(a) * 7, m.y + Math.sin(a) * 7, a, null, this.color), this.aimLen));
        PuddingArt.burst(m.x, m.y, [this.pal.base, PuddingCfg.cream], 5, 88, 0.3, { kind: 'dot', gravity: 160 });
    }

    // Ansage am Boden: die roten Wurfbahnen – unter allen Figuren, damit nichts verdeckt wird
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        if (st !== 'wind' && st !== 'throw') return;
        const m = this._mouth();
        const p = camera.worldToScreen(m.x, m.y);
        const fade = st === 'throw' ? clamp(this.stateT / 0.24, 0, 1) : 1;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * (0.45 + 0.55 * fade);
        for (const a of this.aims) LateWorldArt.lane(ctx, p.x, p.y, a, this.aimLen, 20, this._k(), PuddingCfg.warn);
        ctx.globalAlpha = prev;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const foot = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, foot - 9)) {
                ctx.translate(cx, foot);
                this._body(ctx, true);
            }
            ctx.restore();
            return;
        }
        ctx.translate(cx, foot);
        this._body(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 22 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Pudding-Wuerfel mit Fusspunkt (0, 0); Zeichnung in PuddingArt.figure
    _body(ctx, dead) {
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const k = this._k();
        const tired = !dead && this.hp <= this.maxHp / 2;
        const wind = st === 'wind' ? k : 0;
        const throwing = st === 'throw';
        const jiggle = st === 'jiggle';
        const back = st === 'back';
        const walk = this.moving && !dead ? Math.sin(this.step * 2) : 0;
        // Wabbeln: im Stand sanft, beim Ansagen spannt sich der Wuerfel an (hoeher+dicker),
        // beim Spucken schnalzt er kurz.
        const squ = dead ? 0
            : Math.sin(t * 2.4) * 0.035 + (this.moving ? Math.abs(walk) * 0.04 : 0)
              + wind * 0.08 - (throwing ? 0.1 * clamp(this.stateT / 0.24, 0, 1) : 0)
              + (jiggle ? Math.sin(t * 22) * 0.06 : 0) + (back ? Math.abs(Math.sin(this.step * 2)) * 0.05 : 0);
        ctx.save();
        Kit915.scaleAt(ctx, 0, 0, 1 + squ, 1 - squ);
        ctx.scale(this.face, 1);
        if (this.isKeyGhost && !dead) Art.glow(ctx, 0, -9, 24, '#ffd23f', 0.3 + 0.1 * Math.sin(t * 3));
        if (wind > 0.55 && !dead) Art.glow(ctx, 0, -8, 18, this.pal.base, 0.25 + 0.2 * Math.sin(t * 14));
        const mood = dead ? 'dead' : (throwing || (wind > 0.8)) ? 'open' : tired ? 'tired' : 'angry';
        PuddingArt.figure(ctx, {
            pal: this.pal, lw: 1.25, t, seed: this.seed, mood,
            cream: this.choco,
            armRaise: wind * 0.5 + (throwing ? 0.9 : 0),
            armSway: jiggle ? Math.sin(t * 18) * 0.3 : walk * 0.18,
            look: { x: this.look.x * this.face, y: this.look.y },
        });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss: RIESEN-PUDDINGMONSTER mit ZEHN ARMEN (Endgegner Welt 54) ──
// ══════════════════════════════════════════

// Riesen-Pudding (148 LP), bleibt im Boss-Raum (riesige Puddingschuessel). Zehn arme Wackelpudding,
//   fuenf je Seite. Ablauf Phase 1:
//   Drohen → Puddingregen (Warnflecken, Kleckse aus allen zehn Armen) → Armwirbel (Warnkreis, alle
//   Arme im Kreis) → Landesprung (Warnkreis, Welle bei der Landung) → Verschnaufpause …
// Phase 2 (halbe LP): schneller, mehr Flecken, groesserer Wirbel, groessere Welle.
// Bei wenig Leben wird er nach grossen Angriffen schwindelig (Sterne, kurz wehrlos) – Marks Zeit.
// Schaden macht NUR, was angesagt ist (contactDamage aus).
class BossGiantPudding extends Enemy {
    constructor(x, y) {
        super(x, y, 92, 84);
        this.hp = 148;
        this.maxHp = 148;
        this.speed = 34;
        this.damage = 2;
        this.isBoss = true;
        this.contactDamage = false;      // Schaden macht nur, was angesagt ist
        this.phasesThroughWalls = false;
        this.shadow = { rx: 42, ry: 13, dy: 38, alpha: 0.32 };
        this._shadowRx = 42;
        this._shadowRy = 13;
        this.pal = puddingPal(PuddingCfg.vanille);
        this.fxColor = PuddingCfg.warnWelle;
        this.seed = Math.random() * 10;
        this.face = 1;
        this.look = { x: 0, y: 0.2 };
        this.phase = 1;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.cool = 0.7;
        this.step = 0;
        this.moving = false;
        this.angry = 0;
        this.bigHits = 0;
        this.z = 0;                      // Flughoehe beim Landesprung (nur Darstellung + Schatten)
        // Puddingregen
        this.drops = [];                 // [{x, y, delay, arm, seed, done}] – stehen schon in der Ansage
        this.rainT = 0;
        // Armwirbel
        this.spinA = 0;                  // momentaner Drehwinkel der Arme
        this.spinR = 84;
        this.spinHit = [];
        // Landesprung
        this.leapTo = null;
        this.leapFrom = null;
        this.waveR = 70;
        this.waveT = 0;
        this.waveHit = [];
        this.hitOnce = [];
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    _k() { return this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1; }

    _rainN() { return this.phase === 2 ? 14 : 10; }

    // ── Zehn Arme (fuenf je Seite): Ruhe-, Geh- und Angriffsposen ──
    // Gibt je Arm {bx, by, ang, len, droop} im LOCALen Figurmass zurueck (vor face-Spiegelung).
    _arms() {
        const out = [];
        const t = Art.time + this.seed;
        const st = this.state;
        const k = this._k();
        const intro = st === 'intro';
        const rain = (st === 'rainWind' || st === 'rain') ? (st === 'rain' ? 1 : k) : 0;
        const spin = st === 'spin';
        const wind = st === 'spinWind' ? k : 0;
        const leap = st === 'leap';
        const dizzy = st === 'dizzy';
        for (const s of [-1, 1]) {
            for (let i = 0; i < 5; i++) {
                const bx = s * 10.5, by = -15.5 + i * 3.1;
                let ang = s * (1.15 + i * 0.1);                       // Haende hangen lassig seitlich
                let len = 11 + (2 - Math.abs(i - 2)) * 2.6;            // mittlere Arme am langsten
                let droop = 5.5;
                const sway = Math.sin(t * 2.1 + i * 1.4 + (s > 0 ? 0 : 2.6)) * 0.14;
                ang += sway;
                if (intro || rain > 0) {                               // Arme hoch: Drohen / Regen
                    ang = s * (0.18 + i * 0.14) - 0.1;
                    if (s < 0) ang = Math.PI + (0.18 + i * 0.14) + 0.1;
                    droop = -1.5 * rain;
                }
                if (wind > 0) ang += (-0.5 - wind * 0.6) * s;          // Wirbel-Ansatz: Arme gehen zurueck
                if (spin) {                                            // Armwirbel: alle zehn im vollen Kreis
                    const idx = (s > 0 ? i : 9 - i);
                    ang = this.spinA + (idx * TAU) / 10;
                    droop = 0;
                }
                if (leap) { ang = s * (0.55 + i * 0.16); droop = 2.5; }
                if (dizzy) { ang = s * (1.35 + i * 0.08) + Math.sin(t * 4 + i) * 0.2; droop = 7; }
                if (this.moving && !spin && !leap) {
                    ang += Math.sin(this.step * 2 + i * 1.2 + (s > 0 ? 0 : 3)) * 0.16;
                }
                out.push({ s, i, bx, by, ang, len, droop });
            }
        }
        return out;
    }

    // Spitze eines Arms im Figurmass (local)
    _armTip(a) {
        const mx = a.bx + Math.cos(a.ang) * a.len * 0.55;
        const my = a.by + Math.sin(a.ang) * a.len * 0.55 + a.droop * 0.5;
        return {
            x: puddingQP(a.bx, mx, a.bx + Math.cos(a.ang) * a.len, 1),
            y: puddingQP(a.by, my, a.by + Math.sin(a.ang) * a.len + a.droop, 1),
        };
    }

    // Weltkoordinaten aller zehn Armspitzen (Regen-Muenzungen). Der Riese wird am Fusspunkt
    // (y + h) gezeichnet, also liegt local y = 0 genau dort – nicht in der Mitte.
    _armTipsWorld() {
        const S = BossGiantPudding.S;
        const cx = this.centerX(), foot = this.y + this.h - this.z;
        return this._arms().map(a => {
            const tip = this._armTip(a);
            return { x: cx + this.face * tip.x * S, y: foot + tip.y * S };
        });
    }

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
            PuddingArt.burst(mx, my - 20, [PuddingCfg.erdbeer, PuddingCfg.cream, this.pal.base], 24, 205, 0.7, { kind: 'star' });
            PuddingArt.ring(mx, my, PuddingCfg.warnWelle, 108, 0.6, 6);
            PuddingArt.shake(8, 0.45);
        }
        const still = this.state === 'intro' || this.state === 'dizzy' || this.state === 'leap';
        if (!still) {
            this.look.x += (dx / dist - this.look.x) * Math.min(1, dt * 6);
            this.look.y += (dy / dist - this.look.y) * Math.min(1, dt * 6);
            if (this.state !== 'rainWind' && this.state !== 'rain' && this.state !== 'spinWind' && this.state !== 'spin'
                && Math.abs(dx) > 12) this.face = dx > 0 ? 1 : -1;
        }
        this.stateT -= dt;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0);
                break;
            case 'walk': this._walk(dt, world, player, dist, dx, dy); break;
            case 'rainWind':
                if (this.stateT <= 0) {
                    // Arme sind jetzt oben: die Kleckse starten an den erhobenen Armspitzen
                    const tips = this._armTipsWorld();
                    this.drops.forEach((d, i) => { d.arm = tips[i % tips.length] || d.arm; });
                    this.rainT = 0;
                    for (const d of this.drops) d.done = false;
                    this._set('rain', 0.55 + this.drops.length * 0.055 + 0.45);
                }
                break;
            case 'rain': this._rain(dt); break;
            case 'spinWind':
                if (this.stateT <= 0) {
                    this.spinA = 0;
                    this.spinHit = [];
                    PuddingArt.areaHit(mx, my, this.spinR, this.damage, 250, this.spinHit, this.pal.base);
                    PuddingArt.shake(6, 0.24);
                    PuddingArt.ring(mx, my, this.pal.base, this.spinR, 0.34, 5);
                    this._set('spin', this.phase === 2 ? 1.1 : 0.9);
                }
                break;
            case 'spin':
                this.spinA += dt * (this.phase === 2 ? 15 : 11.5);
                this._wobbleTrail();
                if (this.stateT <= 0) this._afterBig();
                break;
            case 'leapWind':
                if (this.stateT <= 0) {
                    this.leapFrom = { x: this.x, y: this.y };
                    this._set('leap', 0.5);
                }
                break;
            case 'leap': {
                const q = clamp(1 - this.stateT / this.stateDur, 0, 1);
                const to = this.leapTo || { x: mx, y: my };
                this.x = this.leapFrom ? puddingQP(this.leapFrom.x, (this.leapFrom.x + to.x) / 2, to.x, q) : this.x;
                this.y = this.leapFrom ? puddingQP(this.leapFrom.y, Math.min(this.leapFrom.y, to.y) - 30, to.y, q) : this.y;
                this.z = Math.sin(Math.PI * q) * 64;
                this.shadow.rx = this._shadowRx * (1 - this.z / 150);
                this.shadow.ry = this._shadowRy * (1 - this.z / 150);
                this.shadow.alpha = 0.32 * (1 - this.z / 130);
                if (this.stateT <= 0) this._land(world, player);
                break;
            }
            case 'wave': {
                this.waveT += dt;
                if (this.stateT <= 0) {
                    this.z = 0;
                    this._resetShadow();
                    this._afterBig();
                }
                break;
            }
            case 'dizzy':
                if (this.stateT <= 0) {
                    this.cool = this.phase === 2 ? 0.45 : 0.8;
                    this._set('walk', 0);
                }
                break;
            default:                // pant
                if (this.stateT <= 0) this._set('walk', 0);
        }
        if (this.state !== 'leap') PuddingArt.clampToRoom(this, world);
    }

    _resetShadow() {
        this.z = 0;
        this.shadow.rx = this._shadowRx;
        this.shadow.ry = this._shadowRy;
        this.shadow.alpha = 0.32;
    }

    // ── Bewegung im Raum, dann nächster großer Angriff ──
    _walk(dt, world, player, dist, dx, dy) {
        this.moving = !player.dead;
        if (player.dead) { this.step += dt * 1.8; return; }
        this.step += dt * 5;
        let vx = 0, vy = 0;
        if (dist > 140) { vx = dx / dist; vy = dy / dist; }
        else if (dist < 74) { vx = -dx / dist; vy = -dy / dist; }
        else { vx = (-dy / dist) * (this.seed > 5 ? 1 : -1); vy = (dx / dist) * (this.seed > 5 ? 1 : -1); }
        Kit915.rush(this, vx * this.speed * dt, vy * this.speed * dt, world);
        this.cool -= dt;
        if (this.cool > 0) return;
        this.spinR = this.phase === 2 ? 96 : 84;
        const cyc = this.phase === 2 ? BossGiantPudding.CYCLE2 : BossGiantPudding.CYCLE1;
        let what = cyc[this.seq % cyc.length];
        this.seq++;
        if (what === 'spin' && dist > this.spinR + 40) what = 'rain';   // der Wirbel holt nur von nah
        if (what === 'rain') {
            this._planRain(player, world);      // Flecken stehen schon – die Ansage zeigt genau sie
            this._set('rainWind', this.phase === 2 ? 0.85 : 1);
        }
        else if (what === 'spin') this._set('spinWind', this.phase === 2 ? 0.66 : 0.84);
        else if (what === 'leap') this._startLeap(player, world);
        else this.cool = this.phase === 2 ? 0.45 : 0.9;                 // bewusste Verschnaufpause
    }

    // ── a) Puddingregen: Warnflecken, dann Kleckse aus allen zehn Armen ──
    // Die Flecken werden schon in der Ansage gelegt und nicht mehr umgeworfen (Ansage = Treffer).
    _planRain(player, world) {
        const cx = this.centerX(), cy = this.centerY();
        const spots = [];
        const ts = PuddingArt.targets(player);
        // Erst die Ziele selbst (Mark und die Freunde), dann Fuell-Punkte drum herum
        for (const t of ts) if (spots.length < this._rainN()) spots.push({ x: t.x, y: t.y });
        let guard = 0;
        while (spots.length < this._rainN() && guard++ < 80) {
            const c = spots.length ? spots[guard % spots.length] : { x: cx, y: cy };
            const a = Math.random() * TAU, d = randRange(26, 58);
            const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
            const room = PuddingArt.room(world);
            if (!PuddingArt.free(world, x, y, 10)) continue;
            if (room && (x < room.x + 14 || x > room.x + room.w - 14 || y < room.y + 14 || y > room.y + room.h - 14)) continue;
            spots.push({ x, y });
        }
        const tips = this._armTipsWorld();
        this.drops = spots.map((sp, i) => ({
            x: sp.x, y: sp.y,
            arm: tips[i % tips.length] || { x: cx, y: cy - 40 },
            delay: i * 0.06,
            seed: Math.random() * 10,
            done: false,
        }));
        this.rainT = 0;
        this.hitOnce = [];
    }

    _rain(dt) {
        this.rainT += dt;
        const flight = 0.55;
        for (const d of this.drops) {
            if (d.done || this.rainT < d.delay + flight) continue;
            d.done = true;
            PuddingArt.areaHit(d.x, d.y, 30, 1, 160, this.hitOnce, this.pal.base);
            PuddingArt.splatFx(d.x, d.y, this.pal);
            PuddingArt.shake(1.6, 0.08);
        }
        if (this.stateT <= 0) this._afterBig();
    }

    // Spritzer-Spuren beim Wirbel
    _wobbleTrail() {
        if (Math.random() > 0.5) return;
        const a = this.spinA + Math.random() * TAU;
        const r = randRange(this.spinR * 0.5, this.spinR * 0.95);
        PuddingArt.burst(this.centerX() + Math.cos(a) * r, this.centerY() + Math.sin(a) * r * 0.7,
            [this.pal.base, PuddingCfg.cream], 2, 60, 0.35, { kind: 'dot', gravity: 170 });
    }

    // ── c) Landesprung: hoch, Warnkreis am Ziel, Puddingwelle bei der Landung ──
    _startLeap(player, world) {
        const cx = this.centerX(), cy = this.centerY();
        const near = PuddingArt.nearTarget(player, cx, cy, 430);
        let tx = near ? near.t.x : cx + this.face * 90;
        let ty = near ? near.t.y : cy + 20;
        const room = PuddingArt.room(world);
        const pad = this.w / 2 + 8;
        if (room) {
            tx = clamp(tx, room.x + pad, room.x + room.w - pad);
            ty = clamp(ty, room.y + pad, room.y + room.h - pad);
        }
        this.leapTo = { x: tx - this.w / 2, y: ty - this.h / 2 };
        this.waveR = this.phase === 2 ? 84 : 70;
        this.waveHit = [];
        this._set('leapWind', this.phase === 2 ? 0.6 : 0.78);
    }

    _land(world, player) {
        PuddingArt.shake(7.5, 0.3);
        const cx = this.centerX(), cy = this.centerY() + 26;
        PuddingArt.burst(cx, cy, [this.pal.base, PuddingCfg.cream, this.pal.hi], 18, 190, 0.55, { kind: 'dot', gravity: 240 });
        this.waveT = 0;
        this.waveHit = [];
        PuddingArt.areaHit(cx, cy, this.waveR, this.damage, 260, this.waveHit, this.pal.base);
        this._set('wave', 0.5);
    }

    // Nach großen Angriffen: Verschnaufpause – und bei wenig Leben wird er schwindelig.
    _afterBig() {
        this.bigHits++;
        this._resetShadow();
        const low = this.hp <= this.maxHp * 0.35;
        if (low) {
            this._set('dizzy', this.hp <= this.maxHp * 0.2 ? 2.2 : 1.7);
            PuddingArt.burst(this.centerX(), this.y + 8, ['#ffe35a', '#ffffff'], 12, 100, 0.5, { kind: 'star' });
            return;
        }
        if (this.phase === 2 && this.bigHits % 2 === 0) {
            this._set('dizzy', 1.3);
            PuddingArt.burst(this.centerX(), this.y + 8, ['#ffe35a', '#ffffff'], 9, 90, 0.45, { kind: 'star' });
            return;
        }
        this.cool = this.phase === 2 ? 0.5 : 0.9;
        this._set('pant', this.cool + 0.4);
    }

    // Ansagen am Boden: Warnflecken des Regens, Wirbelkreis, Landekreis der Welle
    drawUnder(ctx, camera) {
        if (this.dead) return;
        const st = this.state;
        const k = this._k();
        if (st === 'rainWind') {
            // Genau die Flecken, die gleich getroffen werden, duensten nacheinander herauf.
            const n = this.drops.length || 1;
            for (let i = 0; i < n; i++) {
                const d = this.drops[i];
                const part = clamp(k * 1.3 - (i / n) * 0.5, 0, 1);
                if (part <= 0) continue;
                const p = camera.worldToScreen(d.x, d.y);
                LateWorldArt.warn(ctx, p.x, p.y, 30, part, PuddingCfg.warn);
            }
            return;
        }
        if (st === 'rain') {
            for (const d of this.drops) {
                if (d.done) continue;
                const p = camera.worldToScreen(d.x, d.y);
                const near = clamp((this.rainT - d.delay) / 0.55, 0, 1);
                LateWorldArt.warn(ctx, p.x, p.y, 30, 0.55 + 0.45 * near, PuddingCfg.warn);
            }
            return;
        }
        if (st === 'spinWind' || st === 'spin') {
            const p = camera.worldToScreen(this.centerX(), this.centerY());
            LateWorldArt.warn(ctx, p.x, p.y, this.spinR, st === 'spin' ? 1 : k, PuddingCfg.warn);
            return;
        }
        if (st === 'leapWind' || st === 'leap') {
            if (!this.leapTo) return;
            const p = camera.worldToScreen(this.leapTo.x + this.w / 2, this.leapTo.y + this.h / 2 + 26);
            LateWorldArt.warn(ctx, p.x, p.y, this.waveR, st === 'leap' ? 1 : k, PuddingCfg.warn);
            return;
        }
        if (st === 'wave') {
            const q = clamp(this.waveT / 0.5, 0, 1);
            const p = camera.worldToScreen(this.centerX(), this.centerY() + 26);
            Art.ring(ctx, p.x, p.y, 16 + q * (this.waveR - 10), this.pal.base, 6 * (1 - q) + 1.5, 0.75 * (1 - q) + 0.15);
            Art.ring(ctx, p.x, p.y, 10 + q * (this.waveR - 22), PuddingCfg.cream, 3 * (1 - q) + 0.8, 0.6 * (1 - q));
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
        ctx.translate(cx, foot - (this.z || 0));
        this._body(ctx, false);
        ctx.restore();
        // Fallende Puddingkleckse aus den zehn Armen (regen) – über allen Figuren sichtbar
        if (this.state === 'rain' && !this.dead) {
            const flight = 0.55;
            for (const d of this.drops) {
                if (d.done) continue;
                const q = clamp((this.rainT - d.delay) / flight, 0, 1);
                if (q <= 0) continue;
                const wx = puddingQP(d.arm.x, (d.arm.x + d.x) / 2, d.x, q);
                const wy = puddingQP(d.arm.y, Math.min(d.arm.y, d.y) - 130, d.y, q);
                const p = camera.worldToScreen(wx, wy);
                PuddingArt.glob(ctx, p.x, p.y, 7.5, this.pal, Art.time + d.seed, d.seed, false);
            }
        }
    }

    // Riesen-Pudding: dieselbe Wackel-Kuppel wie die kleinen, 2,6-mal so groß, mit Karamellhaube,
    // Sahne + Kirsche und zehn Wackelarmen; Phase 2 mit roten Augen und Erdbeer-Glühen.
    _body(ctx, dead) {
        const S = BossGiantPudding.S;
        const t = Art.time + this.seed;
        const st = dead ? 'dead' : this.state;
        const p2 = this.phase === 2;
        const k = this._k();
        const dizzy = st === 'dizzy';
        const rest = st === 'pant';
        const intro = st === 'intro';
        const rain = st === 'rain' ? 1 : st === 'rainWind' ? k : 0;
        const spinWind = st === 'spinWind' ? k : 0;
        const spin = st === 'spin';
        const leap = st === 'leap';
        const wave = st === 'wave';
        const walk = this.moving && !dizzy && !dead && !leap ? Math.sin(this.step * 2) : 0;
        // Wabbeln wie bei den Kleinen, nur trager; beim Ansagen spannt er sich an
        const squ = dead ? 0
            : Math.sin(t * 1.8) * 0.02 + (this.moving ? Math.abs(walk) * 0.035 : 0)
              + (st === 'rainWind' || st === 'spinWind' || intro ? k * 0.05 : 0)
              - (rest ? 0.03 : 0) + (wave ? 0.09 * clamp(1 - this.waveT / 0.3, 0, 1) : 0);
        const arms = this._arms();

        // Wirbel: der ganze Riese dreht sich – die Arme wirbeln im Kreis
        const spinRot = spin ? this.spinA * 0.55 : 0;
        ctx.save();
        Kit915.scaleAt(ctx, 0, -26 * S, 1 + squ, 1 - squ);
        if (spinRot) {
            ctx.translate(0, -26 * S);
            ctx.rotate(spinRot * 0.35);
            ctx.translate(0, 26 * S);
        }
        ctx.scale(this.face * S, S);

        // Arme hinter dem Korper
        for (const a of arms) {
            const mx = a.bx + Math.cos(a.ang) * a.len * 0.55;
            const my = a.by + Math.sin(a.ang) * a.len * 0.55 + a.droop * 0.5;
            const tx = a.bx + Math.cos(a.ang) * a.len;
            const ty = a.by + Math.sin(a.ang) * a.len + a.droop;
            Art.limb(ctx, a.bx, a.by, mx, my, 4.6, this.pal.mid, { lineWidth: 0.7 });
            Art.limb(ctx, mx, my, tx, ty, 3.6, this.pal.mid, { lineWidth: 0.7 });
            for (let j = 1; j <= 2; j++) {
                const u = j / 3;
                Art.body(ctx, puddingQP(a.bx, mx, tx, u), puddingQP(a.by, my, ty, u),
                    3.4 - j * 0.7, (3.4 - j * 0.7) * 0.9, j % 2 ? this.pal.base : this.pal.hi, { lineWidth: 0.7, highlight: false });
            }
            Art.body(ctx, tx, ty, 2.6, 2.4, this.pal.base, { lineWidth: 0.7, glossy: true });
        }
        if (p2 && !dead) Art.glow(ctx, 0, -26, 40, PuddingCfg.erdbeer, 0.15 * this.angry + 0.06 * Math.sin(t * 6));

        // ── Riesen-Puddingkorper: Kuppel mit Wackelrand ──
        const wob = Math.sin(t * 3.4 + this.seed) * 0.6;
        const body = -8.4 + wob * 0.4 - (intro || rain > 0 ? 1.6 * Math.max(k, rain) : 0) + (rest ? 0.8 : 0);
        Art.shape(ctx, g => {
            g.moveTo(-13.5, -1.5);
            g.bezierCurveTo(-14.4, body - 8.6, -8.6, body - 13.2, 0, body - 13.2);
            g.bezierCurveTo(8.6, body - 13.2, 14.4, body - 8.6, 13.5, -1.5);
            for (let i = 0; i < 3; i++) {
                const x0 = 13.5 - i * 9;
                g.quadraticCurveTo(x0 - 4.5, 3.4 + Math.sin(t * 4.4 + i * 2.2 + this.seed) * 1.6, x0 - 9, -1.5);
            }
            g.closePath();
        }, { x: -14.4, y: body - 13.2, w: 28.8, h: 17.4 }, this.pal.base, { glossy: true, lineWidth: 0.75 });
        Art.shine(ctx, -6.4, body - 7.6, 3.4, 2.4, -0.5, 0.55);
        // Karamellhaube mit drei Klecksen
        Art.shape(ctx, g => {
            g.moveTo(-9.6, body - 8.2);
            g.bezierCurveTo(-8.4, body - 12.6, 8.4, body - 12.6, 9.6, body - 8.2);
            g.quadraticCurveTo(7.2, body - 4.6, 4.8, body - 8);
            g.quadraticCurveTo(2, body - 3.4, -0.6, body - 7.8);
            g.quadraticCurveTo(-4, body - 3.2, -6, body - 8);
            g.quadraticCurveTo(-8, body - 5, -9.6, body - 8.2);
            g.closePath();
        }, { x: -9.6, y: body - 12.6, w: 19.2, h: 9.4 }, PuddingCfg.sauce, { glossy: true, lineWidth: 0.7 });
        // Sahne + Kirsche auf dem Scheitel
        Art.body(ctx, 0, body - 14.4, 6.2, 2.6, PuddingCfg.cream, { lineWidth: 0.75 });
        Art.body(ctx, 0, body - 17.2, 4.3, 2.2, PuddingCfg.cream, { lineWidth: 0.75 });
        Art.body(ctx, 0, body - 19.6, 2.6, 1.8, PuddingCfg.cream, { lineWidth: 0.75 });
        Art.limb(ctx, 0.5, body - 21.4, 2.2, body - 24, 1.2, PuddingCfg.stem, { lineWidth: 0.6 });
        Art.body(ctx, 0, body - 21.2, 2.6, 2.4, PuddingCfg.cherry, { glossy: true, lineWidth: 0.75 });
        Art.shine(ctx, -0.8, body - 22.2, 0.8, 0.55, -0.5, 0.7);

        // ── Gesicht ──
        const mood = dead ? 'dead' : dizzy ? 'dizzy'
            : (intro || rain > 0 || spinWind > 0 || spin || leap || wave) ? 'open' : rest ? 'tired' : 'angry';
        const ey = body + 1.6;
        if (mood === 'dead') {
            LateWorldArt.xEyes(ctx, 0, ey, 2.4, 5);
        } else if (dizzy) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.7;
            for (const s of [-1, 1]) {
                ctx.beginPath();
                for (let i = 0; i <= 14; i++) {
                    const a = i * 0.75 + t * 6 * s, r = 0.25 + i * 0.12;
                    const x = s * 4.6 + Math.cos(a) * r, y = ey + Math.sin(a) * r;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                }
                ctx.stroke();
            }
        } else {
            for (const s of [-1, 1]) {
                Art.eye(ctx, s * 4.6, ey, 2.5, { x: this.look.x * this.face, y: this.look.y }, {
                    angry: mood !== 'tired', side: s < 0 ? 'left' : 'right',
                    iris: p2 ? '#ff3b3b' : '#5a3413', open: mood === 'tired' ? 0.55 : 1,
                });
            }
        }
        Art.mouth(ctx, 0, body + 6.6, 6.4, mood === 'open' ? 'open' : mood === 'tired' || mood === 'dizzy' || mood === 'dead' ? 'o' : 'angry',
            { color: this.pal.deep });
        if (mood !== 'dead') Art.blush(ctx, 0, body + 4.4, 2, 8.6, Art.alpha(PuddingCfg.cherry, 0.8));
        ctx.restore();
        if (dizzy && !dead) LateWorldArt.dizzy(ctx, 0, -46, 30, 4.6);
    }
}

BossGiantPudding.S = 2.6;               // Figurmass → Pixel
BossGiantPudding.CYCLE1 = ['rain', 'spin', 'leap', 'walk'];
BossGiantPudding.CYCLE2 = ['rain', 'leap', 'spin', 'rain', 'walk'];
