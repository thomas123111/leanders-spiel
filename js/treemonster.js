// ── Welt 37: Monsterwald ── (Idee von Leander)
// Baummonster: ein kleiner wandelnder Baum. Stamm mit frech-bösem Gesicht, zwei Astarme, Blätterkrone mit
//   buntem Obst darin. Es stapft langsam (Wurzelschritte, Stamm wippt) auf Mark zu, bleibt auf mittlerem
//   Abstand stehen und wirft Obst im Bogen: Apfel, Birne oder Pflaume (zufällig, im Konstruktor festgelegt).
//   Vor dem Wurf holt es 0,5 s aus (Stamm lehnt sich zurück, Astarm geht hoch, Frucht leuchtet) und am
//   Landepunkt wächst ein Warnkreis (drawUnder) – Kinder können ausweichen. Getroffen werden Mark UND
//   Juri/Krokodil (ein tödlicher Treffer haut die Freunde nur um, knockOut).
//   Ein Exemplar trägt den Schlüssel (main.js setzt isKeyGhost): etwas zäher, wirft zwei Früchte,
//   goldener Schlüssel über der Krone (LateWorldArt.keyBadge).
// Riesenbaum (Boss, 132 LP, bleibt im Boss-Raum):
//   a) Schütteln: die Krone wackelt 1 s (Warnkreise an allen Landeplätzen), dann fallen 8–11 Äpfel verteilt
//      in die Arena, landen, glühen kurz und EXPLODIEREN (kleiner Explosionskreis, Schaden in der Nähe).
//   b) Sprung-Stampfer: duckt sich (Ausholbewegung), springt hoch (Schatten wird klein und hell), landet mit
//      Wumms → eine riesige Welle wächst als Ring über die ganze Arena. Wer drin steht: 1 Schaden und kurz
//      benommen. Durch Draufrallen (Ausweichrolle) überspringbar.
//   c) Phase 2 (ab halben LP): wütender (rote Glutaugen, Risse in der Rinde, mehr Äpfel), zwei Wellen
//      nacheinander, Blätter rieseln von der Krone, alles etwas schneller.
//   Nach jedem großen Angriff steht der Baum 1,0–1,4 s keuchend still – Zeit zum Zurückhauen. Kein
//   Berührungsschaden, damit Kinder in der Pause gefahrlos den Stamm erwischen.
   // Gerufene Helfer: ruft maximal vier junge Baummonster (TreeMonster mit .summoner) in den Boss-Raum;
//   die verpuffen, sobald der Riesenbaum besiegt ist (Muster aus js/witch.js).
// Hitbox des Bosses 74×66, gezeichnet wird rund 110 breit und 150 hoch (Krone und Astarme ragen über die
//   Hitbox hinaus – wie bei den anderen Bossen dieser Welten, z. B. js/angel.js:568).

const TreeCfg = {
    // Früchte: Apfel, Birne, Pflaume (Farbe + Umriss + Glanz, Art.mix/ink funktioniert damit)
    fruits: [
        { kind: 0, col: '#ff4d4d', hl: '#ffd9d9', stem: '#6b3f1d' },
        { kind: 1, col: '#b9dd4a', hl: '#f2ffcf', stem: '#6b3f1d' },
        { kind: 2, col: '#9b5de5', hl: '#e7d3ff', stem: '#4a2a70' },
    ],
    bark: '#b0723f', barkDeep: '#7a4620', leaf: '#43c457', leafDeep: '#1f7a33',
    appleRed: '#ff3b30',
    warnR: 26,        // Landekreis eines normalen Obstwurfs
    boomR: 34,        // Schaden radius einer explodierenden Boss-Apfelbombe
    band: 16,         // Breite der Wellenfront (Sprung-Stampfer)
    waveSpeed: 215,   // Einheiten pro Sekunde, die die Wellenfront wächst
    maxProj: 56,      // eigene Obergrenze für Gegnergeschosse in dieser Welt (Engine: 400)
    maxHelpers: 4,    // gerufene Helfer gleichzeitig
    playerStun: 2.2,  // benommen nach der Welle (Mark)
    friendStun: 2.6,  // benommen nach der Welle (Juri, Krokodil)
};

const TreeArt = {
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine (Galerie) direkt.
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

    sound(name) {
        if (typeof Sound !== 'undefined' && typeof Sound[name] === 'function') Sound[name]();
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

    // Freunde nie verschwinden lassen: ein tödlicher Treffer haut sie nur um.
    hitCompanion(c, amount) {
        if (c.hp - amount <= 0) c.knockOut(8);
        else c.takeDamage(amount);
        this.burst(c.x + (c.w || 20) / 2, c.y + (c.h || 20) / 2, [TreeCfg.appleRed, '#ffffff'], 9, 140, 0.45, { kind: 'star' });
    },

    // Frucht an (x, y), f = Eintrag aus TreeCfg.fruits, s = Größe, rot = Drehwinkel
    fruit(ctx, x, y, f, s, rot) {
        ctx.save();
        ctx.translate(x, y);
        if (rot) ctx.rotate(rot);
        if (f.kind === 1) {
            // Birne: kleiner Kopf auf breitem Bauch
            Art.body(ctx, 0, 2.1 * s, 4.5 * s, 4.8 * s, f.col, { lineWidth: 1.2 });
            Art.body(ctx, 0, -3.3 * s, 2.7 * s, 2.9 * s, f.col, { lineWidth: 1.1, highlight: false });
        } else if (f.kind === 2) {
            // Pflaume: leicht oval mit heller Naht
            Art.body(ctx, 0, 0, 4.3 * s, 3.9 * s, f.col, { lineWidth: 1.2, glossy: true });
            ctx.strokeStyle = Art.alpha(f.hl, 0.75);
            ctx.lineWidth = Math.max(0.6, 0.8 * s);
            ctx.beginPath();
            ctx.moveTo(-1.2 * s, -3 * s);
            ctx.quadraticCurveTo(-2.4 * s, 0, -1.2 * s, 3 * s);
            ctx.stroke();
        } else {
            // Apfel: rundlich mit kleiner Delle oben
            Art.body(ctx, 0, 0, 4.7 * s, 4.3 * s, f.col, { lineWidth: 1.2, glossy: true });
        }
        Art.limb(ctx, 0, -4 * s, 1.1 * s, -6.8 * s, 1.1 * s, f.stem, { lineWidth: 0.7 });
        ctx.beginPath();
        ctx.ellipse(3.1 * s, -5.8 * s, 2.3 * s, 1.15 * s, -0.55, 0, TAU);
        ctx.fillStyle = TreeCfg.leaf;
        ctx.fill();
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = Art.ink(TreeCfg.leaf);
        ctx.stroke();
        ctx.restore();
    },

    // Blatt (fällt im Phase-2-Regen und sitzt in jeder Krone)
    leaf(ctx, x, y, r, rot, col) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.52, rot, 0, TAU);
        ctx.fillStyle = col;
        ctx.fill();
    },

    // Blätterkrone: überlappende Büsche plus Obst. n = Anzahl Büsche, Obstpunkte folgen darauf.
    crown(ctx, x, y, s, wob, col, deep, apples, seeds) {
        for (let i = 0; i < 5; i++) {
            const a = (i * TAU) / 5 + 0.4;
            const bx = x + Math.cos(a) * 21 * s + wob * (0.5 + i * 0.12);
            const by = y + Math.sin(a) * 12 * s;
            Art.body(ctx, bx, by, 15 * s, 12.5 * s, i % 2 ? col : deep, { lineWidth: Math.min(2.2, 1.3 * s) });
        }
        Art.body(ctx, x + wob, y - 3 * s, 18 * s, 14.5 * s, col, { lineWidth: Math.min(2.2, 1.4 * s), glossy: true });
        for (let i = 0; i < apples; i++) {
            const sd = seeds[i % seeds.length];
            const ax = x + Math.cos(sd * 2.4) * 20 * s + wob * (0.4 + (i % 3) * 0.2);
            const ay = y + Math.sin(sd * 3.1) * 10 * s - 2 * s;
            Art.body(ctx, ax, ay, 3.1 * s, 2.9 * s, TreeCfg.appleRed, { lineWidth: Math.min(1.6, 1 * s), highlight: false });
        }
    },

    // Wurzelfüße (Fußpunkt 0,0), step = Phase der Schritte, sp = 0..1 wie stark das Monster läuft
    roots(ctx, spread, step, sp, col) {
        for (let s = -1; s <= 1; s += 2) {
            const lift = sp > 0 ? Math.max(0, Math.sin(step + (s > 0 ? 0 : Math.PI))) * 3.4 * sp : 0;
            const fx = s * spread * (0.62 + 0.1 * Math.sin(step + (s > 0 ? 0 : Math.PI)));
            LateWorldArt.blob(ctx, fx, -1 - lift, spread * 0.42, spread * 0.2, col, 1.2);
            LateWorldArt.blob(ctx, fx + s * spread * 0.34, -0.5 - lift * 0.5, spread * 0.26, spread * 0.13, col, 1);
        }
    },
};

// ══════════════════════════════════════════
// ── Geworfene Frucht (normaler Gegner und Boss-Apfel) ──
// ══════════════════════════════════════════

// Liegt in der Geschoss-Liste (owner 'bossfx': die Engine prüft keine Treffer, das macht die Frucht selbst –
// Muster aus js/angel.js:444). Fliegt im Bogen vom Werfer zum festen Landepunkt.
// boom = false: platscht auf (1 Schaden im kleinen Kreis).
// boom = true: landet, glüht 0,42 s (der Landekreis flackert) und EXPLODIERT – Schaden im Umkreis.
// Ist der Werfer besiegt, verpufft die Frucht ersatzlos.
class TreeFruit {
    constructor(o) {
        this.owner = 'bossfx';
        this.damage = o.dmg || 1;
        this.radius = o.r || 6;
        this.dead = false;
        this.x = o.x0;
        this.y = o.y0;
        this.x0 = o.x0;
        this.y0 = o.y0;
        this.tx = o.tx;
        this.ty = o.ty;
        this.dur = o.dur || 0.62;
        this.arc = o.arc || 52;
        this.lead = o.delay || 0;
        this.t = -this.lead;            // negativ = noch in der Ankündigung (Warnkreis läuft)
        this.type = o.type || TreeCfg.fruits[0];
        this.boom = !!o.boom;
        this.boss = o.boss || null;
        this.spin = (Math.random() < 0.5 ? -1 : 1) * randRange(5, 11);
        this.rot = Math.random() * TAU;
        this.lift = 0;                  // Höhe über dem Boden (nur Darstellung)
        this.state = 'fly';
        this.fuse = 0;
        this.blast = 0;
        this.hitDone = false;
    }

    update(dt) {
        if (this.boss && this.boss.dead) {
            this.pop();
            return;
        }
        this.t += dt;
        if (this.t < 0) return;
        if (this.state === 'fly') {
            const k = clamp(this.t / this.dur, 0, 1);
            this.x = this.x0 + (this.tx - this.x0) * k;
            this.y = this.y0 + (this.ty - this.y0) * k;
            this.lift = Math.sin(Math.PI * k) * this.arc;
            this.rot += this.spin * dt;
            if (k >= 1) {
                this.x = this.tx;
                this.y = this.ty;
                this.rot = 0;
                if (this.boom) {
                    this.state = 'fuse';
                    this.fuse = 0.42;
                    TreeArt.burst(this.x, this.y, ['#f0e6d0', '#c8b28c'], 5, 70, 0.3, { kind: 'smoke', size: 4 });
                    TreeArt.sound('hit');
                } else {
                    this.splat();
                }
            }
            return;
        }
        if (this.state === 'fuse') {
            this.lift = Math.max(0, this.lift - 90 * dt);
            this.fuse -= dt;
            if (this.fuse <= 0) this.explode();
            return;
        }
        // 'blast': Explosionsblitz, danach weg
        this.blast += dt;
        if (this.blast > 0.26) this.dead = true;
    }

    // Aufplatschen (normale Frucht): Schaden im kleinen Kreis, Fruchtbrei
    splat() {
        if (!this.hitDone) {
            this.hitDone = true;
            this.hitArea(TreeCfg.warnR);
        }
        TreeArt.burst(this.x, this.y, [this.type.col, this.type.hl, '#ffffff'], 8, 120, 0.4, { gravity: 220 });
        TreeArt.ring(this.x, this.y, this.type.col, 20, 0.28, 3);
        this.dead = true;
    }

    // Boss-Apfel geht hoch: kleiner Explosionskreis, Schaden in der Nähe
    explode() {
        this.state = 'blast';
        this.blast = 0;
        this.lift = 0;
        if (!this.hitDone) {
            this.hitDone = true;
            this.hitArea(TreeCfg.boomR);
        }
        TreeArt.burst(this.x, this.y, ['#ff9f1c', '#ff3b30', '#fff6a8'], 14, 200, 0.5, { kind: 'spark' });
        TreeArt.burst(this.x, this.y, ['#c8b28c', '#8a6a4a'], 6, 90, 0.5, { kind: 'smoke', size: 6 });
        TreeArt.ring(this.x, this.y, '#ffd23f', 46, 0.32, 5);
        TreeArt.shake(4.5, 0.18);
        TreeArt.sound('hit');
    }

    // Verpuffen ohne Wirkung (Werfer besiegt)
    pop() {
        TreeArt.burst(this.x, this.y - this.lift, [TreeCfg.leaf, '#ffffff'], 6, 90, 0.35, { kind: 'star' });
        this.dead = true;
    }

    // Alle im Kreis Umstehenden: Mark und die Freunde
    hitArea(r) {
        const P = typeof Game !== 'undefined' ? Game.player : null;
        if (P && !P.dead) {
            const px = P.x + P.w / 2, py = P.y + P.h / 2;
            const d = Math.hypot(px - this.x, py - this.y);
            if (d < r + P.w / 2) {
                const before = P.hp;
                TreeArt.hurt(P, this.damage, Math.atan2(py - this.y, px - this.x), 170);
                if (P.hp < before) TreeArt.burst(px, py, [TreeCfg.appleRed, '#ffffff'], 9, 150, 0.4, { kind: 'star' });
            }
        }
        for (const c of TreeArt.companions()) {
            if (c.iFrames > 0) continue;
            const cw = c.w || 20, ch = c.h || 20;
            if (Math.hypot(c.x + cw / 2 - this.x, c.y + ch / 2 - this.y) < r + Math.max(cw, ch) / 2) {
                TreeArt.hitCompanion(c, this.damage);
            }
        }
    }

    // Fruchtschatten am Landeweg (zeigt Kindern, wo sie gleich ankommt)
    draw(ctx, camera) {
        const g = camera.worldToScreen(this.x, this.y);
        const s = this.boom ? 1.25 : 1;
        if (this.state === 'blast') {
            const k = clamp(this.blast / 0.26, 0, 1);
            Art.glow(ctx, g.x, g.y, (TreeCfg.boomR + 12) * (0.6 + k * 0.7), '#ff9f1c', 0.55 * (1 - k));
            Art.ring(ctx, g.x, g.y, TreeCfg.boomR * (0.35 + k), '#ffd23f', 3.4 * (1 - k) + 0.8, 1 - k * 0.7);
            Art.ring(ctx, g.x, g.y, TreeCfg.boomR * (0.2 + k * 0.8), '#ffffff', 1.6, 0.8 * (1 - k));
            return;
        }
        if (this.state !== 'fly') {
            // liegt und glüht: flackernder Warnring + glühende Frucht
            const f = clamp(this.fuse / 0.42, 0, 1);
            const pulse = Math.sin(Art.time * 34) > 0 ? 1 : 0.5;
            Art.ring(ctx, g.x, g.y, TreeCfg.boomR, '#ff3d5a', 2.4, 0.35 + 0.5 * pulse);
            Art.glow(ctx, g.x, g.y - 4, 14 + (1 - f) * 12, '#ff9f1c', 0.4 + 0.4 * pulse);
            this._drawFruit(ctx, g.x, g.y - 4, s * (1 + (1 - f) * 0.15), 0);
            return;
        }
        const a = camera.worldToScreen(this.x0, this.y0);
        ctx.fillStyle = 'rgba(40,60,30,0.22)';
        ctx.beginPath();
        ctx.ellipse(g.x, g.y, 5 * s, 2 * s, 0, 0, TAU);
        ctx.fill();
        if (this.t < 0.12) {
            ctx.strokeStyle = Art.alpha(TreeCfg.leaf, 0.5);
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y - 10);
            ctx.lineTo(g.x, g.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        this._drawFruit(ctx, g.x, g.y - this.lift, s, this.rot);
    }

    _drawFruit(ctx, x, y, s, rot) {
        if (this.boom) Art.glow(ctx, x, y, 11 * s, '#ff6b3d', 0.35);
        TreeArt.fruit(ctx, x, y, this.type, s, rot);
    }
}

// ══════════════════════════════════════════
// ── Baummonster ──
// ══════════════════════════════════════════

// Wandelnder kleiner Baum (Hitbox 26×28). Stapft langsam, wirft alle 2,2–3,4 s Obst im Bogen.
// summoner gesetzt = vom Riesenbaum gerufen: bleibt im Boss-Raum und verpufft mit ihm.
class TreeMonster extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 28);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(34, 42);        // stapft langsam
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;       // Schlüsselträger darf nicht in der Wand landen
        this.fxColor = TreeCfg.leaf;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? -1 : 1;
        this.look = { x: 0, y: 0.25 };
        this.type = TreeCfg.fruits[Math.floor(Math.random() * TreeCfg.fruits.length)];
        this.crownHue = randRange(-10, 12);    // eigene Blattfärbung
        this.detection = 240;
        this.engaged = false;
        this.throwT = randRange(1.2, 2.6);
        this.wind = 0;                        // > 0: holt aus (steht still)
        this.windMax = 0.5;
        this.aim = { x: 0, y: 0, on: false };
        this.target = null;
        this.step = Math.random() * TAU;
        this.sp = 0;                          // 0..1 Laufrhythmus (nur Darstellung)
        this.wx = 0;
        this.wy = 0;
        this.wanderT = 0;
        this.summoner = null;
        this._keyInit = false;
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        if (this.isKeyGhost && !this._keyInit) {
            // Schlüsselträger (main.js setzt das Flag nach dem Erzeugen): etwas zäher
            this._keyInit = true;
            this.hp = this.maxHp = 9;
        }
        if (this.summoner) {
            if (this.summoner.dead) {
                // Helfer verpuffen mit ihrem Riesenbaum
                this.dead = true;
                this.deathTimer = 0.4;
                TreeArt.burst(this.centerX(), this.centerY(), [TreeCfg.leaf, TreeCfg.leafDeep, '#ffffff'], 12, 130, 0.5, { kind: 'star' });
                return;
            }
            const room = this._room(world);
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }
        if (this.wind > 0) {
            // Ausholen: steht, Stamm lehnt zurück, Ziel wird bis 0,2 s vor dem Wurf noch nachgezogen
            this.wind -= dt;
            if (this.wind > 0.2) this._aimAt(world, player);
            this.sp *= Math.exp(-6 * dt);
            this._look(dt, this.aim.x - this.centerX(), this.aim.y - (this.y + 8));
            if (this.wind <= 0) {
                this._throw(projectiles);
                this.aim.on = false;
                this.target = null;
                // nächste Pause bis zum nächsten Wurf (Schlüsselträger wirft öfter nach)
                this.throwT = this.isKeyGhost ? randRange(1.9, 2.7) : randRange(2.4, 3.6);
            }
            return;
        }
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - this.centerX(), dy = py - this.centerY();
        const dist = Math.hypot(dx, dy) || 1;
        if (!player.dead && dist < this.detection) this.engaged = true;
        else if (dist > this.detection + 80) this.engaged = false;

        this.throwT -= dt;
        if (this.engaged && !player.dead && this.throwT <= 0 && dist < 300 && this._freeSlots(projectiles)) {
            this.target = null;
            this._aimAt(world, player);
            this.aim.on = true;
            this.wind = this.windMax;
            this.sp *= 0.4;
            return;
        }

        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            // hält mittleren Abstand (Nahkampf für Mark), sonst stapft er weiter
            if (dist > 150) {
                vx = dx / dist; vy = dy / dist; sp = this.speed;
            } else if (dist < 78) {
                vx = -dx / dist; vy = -dy / dist; sp = this.speed * 0.75;
            } else {
                vx = dx / dist; vy = dy / dist; sp = this.speed * 0.25;
            }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.6, 3.2);
                const a = Math.random() * TAU;
                this.wx = Math.cos(a);
                this.wy = Math.sin(a);
            }
            vx = this.wx; vy = this.wy; sp = this.speed * 0.35;
        }
        if (sp > 0) {
            const ox = this.x, oy = this.y;
            this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
            if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) this.wanderT = 0;
            this.step += dt * sp * 0.1;
        }
        this.sp += ((sp > 1 ? 1 : 0) - this.sp) * Math.min(1, dt * 6);
        if (this.engaged) {
            if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
            this._look(dt, dx, dy);
        } else {
            if (Math.abs(vx) > 0.2) this.face = vx > 0 ? 1 : -1;
            this._look(dt, vx * 0.6, vy * 0.6 + 0.3);
        }
    }

    _look(dt, dx, dy) {
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 8);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    _room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    _freeSlots(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        return !list || list.length < TreeCfg.maxProj;
    }

    // Ziel: Mark oder (manchmal) ein Freund, wenn freie Sicht. Wird während des Ausholens nachgezogen.
    _aimAt(world, player) {
        if (!this.target) {
            this.target = player;
            const opts = [];
            const mx = this.centerX(), my = this.centerY();
            for (const c of TreeArt.companions()) {
                const cx = c.x + (c.w || 20) / 2, cy = c.y + (c.h || 20) / 2;
                if (Math.hypot(cx - mx, cy - my) > 260) continue;
                if (typeof Juri !== 'undefined' && !Juri.lineClear(world, mx, my, cx, cy)) continue;
                opts.push(c);
            }
            if (opts.length && Math.random() < 0.4) this.target = opts[Math.floor(Math.random() * opts.length)];
        }
        let tg = this.target;
        if (tg !== player && (tg.dead || tg.koTimer > 0)) {
            tg = this.target = player;
        }
        const tw = tg.w || 20, th = tg.h || 20;
        this.aim.x = tg.x + tw / 2 + randRange(-7, 7);
        this.aim.y = tg.y + th / 2 + randRange(-7, 7);
    }

    // Abwurf: ein Bogen (Schlüsselträger zwei leicht versetzt)
    _throw(projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) return;
        const n = this.isKeyGhost ? 2 : 1;
        const hx = this.centerX() + this.face * 10, hy = this.y + 2;
        for (let i = 0; i < n; i++) {
            if (list.length >= TreeCfg.maxProj) break;
            const f = new TreeFruit({
                x0: hx, y0: hy,
                tx: this.aim.x + (i === 0 ? 0 : this.face * 22),
                ty: this.aim.y + (i === 0 ? 0 : 12),
                dur: randRange(0.58, 0.72), arc: randRange(58, 76),
                delay: i * 0.16, type: this.type, r: 6, dmg: 1,
            });
            list.push(f);
        }
        TreeArt.burst(hx, hy, [this.type.col, '#ffffff'], 5, 80, 0.3, { kind: 'spark' });
    }

    drawUnder(ctx, camera) {
        if (this.dead || !this.aim.on) return;
        const p = camera.worldToScreen(this.aim.x, this.aim.y);
        LateWorldArt.warn(ctx, p.x, p.y, TreeCfg.warnR, clamp(1 - this.wind / this.windMax, 0, 1));
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (LateWorldArt.deathPop(ctx, this, cx, by - 16)) this._drawTree(ctx, cx, by, true);
            ctx.restore();
            return;
        }
        this._drawTree(ctx, cx, by, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 26 + Math.sin(Art.time * 3 + this.seed) * 2);
    }

    // Baum mit Fußpunkt (cx, by)
    _drawTree(ctx, cx, by, dead) {
        const t = Art.time, f = this.face, sd = this.seed;
        const w = dead ? 0 : this.wind;
        const wind = clamp(w / this.windMax, 0, 1);       // 0 = frisch ausgeholt, 1 = gerade abgeworfen
        const lean = dead ? 0.12 : wind * 0.16 * -f;
        const walk = this.sp > 0.05 ? Math.sin(this.step * 2) : 0;
        const squash = 1 + Math.abs(walk) * 0.05 * this.sp - wind * 0.04;
        const leaf = `hsl(${122 + this.crownHue}, 62%, 48%)`;
        const deep = `hsl(${128 + this.crownHue}, 60%, 32%)`;
        ctx.save();
        ctx.translate(cx, by);
        TreeArt.roots(ctx, 9.5, this.step, this.sp, TreeCfg.barkDeep);
        ctx.scale(2 - squash, squash);
        ctx.rotate(lean);
        // Stamm (unten breiter, Rinde mit zwei Linien)
        Art.shape(ctx, c => {
            c.moveTo(-9, -2);
            c.quadraticCurveTo(-6.5, -12, -5.4, -24);
            c.lineTo(5.4, -24);
            c.quadraticCurveTo(6.5, -12, 9, -2);
            c.closePath();
        }, { x: -9, y: -24, w: 18, h: 22 }, TreeCfg.bark, { lineWidth: 1.4, glossy: true });
        ctx.strokeStyle = Art.alpha(TreeCfg.barkDeep, 0.8);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3.2, -20);
        ctx.lineTo(-2.4, -6);
        ctx.moveTo(3.6, -21);
        ctx.lineTo(4.4, -7);
        ctx.stroke();
        // Astarme: einer wirft, einer hält dagegen
        const hx = f * (9 + wind * 3), hy = -20 - wind * 13;
        Art.limb(ctx, f * 5, -18, hx, hy, 2.6, TreeCfg.bark, { lineWidth: 1.1 });
        Art.limb(ctx, hx, hy, hx + f * 4, hy - 3, 1.6, TreeCfg.bark, { lineWidth: 0.8 });
        Art.limb(ctx, -f * 5, -18, -f * (11 + walk), -15 + wind * 3, 2.4, TreeCfg.bark, { lineWidth: 1.1 });
        // Blätterkrone mit Obst
        TreeArt.crown(ctx, 0, -30 + Math.sin(t * 2.4 + sd) * 0.9, 0.62, dead ? 0 : Math.sin(t * 2 + sd) * 1.1,
            leaf, deep, this.isKeyGhost ? 4 : 3, [sd, sd + 2.1, sd + 4.4, sd + 6.3]);
        // Gesicht im Stamm
        const fx = f * 1.2, fy = -14;
        if (dead) LateWorldArt.xEyes(ctx, fx, fy, 1.5, 3);
        else Art.eyes(ctx, fx, fy, 2.4, { gap: 3.2, look: this.look, angry: true, iris: '#2f5a1a', seed: sd });
        Art.mouth(ctx, fx, fy + 5.4, 4.6, dead ? 'o' : (wind > 0.4 ? 'grin' : 'angry'));
        Art.blush(ctx, fx, fy + 3.6, 1.8, 5.4);
        // Frucht in der Wurfhand (leuchtet beim Ausholen)
        if (!dead && wind > 0) {
            Art.glow(ctx, hx, hy - 2, 6 + wind * 9, this.type.hl, 0.35 + wind * 0.45);
            TreeArt.fruit(ctx, hx, hy - 3, this.type, 0.85, -wind * 0.8);
        }
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 37: Riesenbaum ──
// ══════════════════════════════════════════

// Ablauf: intro → lauft umher → Angriff (Schütteln oder Sprung-Stampfer) → keuchende Pause → …
// Phase 2 ab halben LP: erst Wutausbruch (roar), dann mehr Äpfel, zwei Wellen, Blätterregen.
class BossGiantTree extends Enemy {
    constructor(x, y) {
        super(x, y, 74, 66);
        this.hp = 132;
        this.maxHp = 132;
        this.speed = 30;
        this.damage = 1;
        // Kein Berührungsschaden: gefährlich sind Äpfel und Wellen. So kann man den Stamm in den
        // keuchenden Pausen gefahrlos hauen (fair für Kinder).
        this.contactDamage = false;
        this.isBoss = true;
        this.fxColor = TreeCfg.leaf;
        this.shadow = { rx: 40, ry: 14, dy: 32, alpha: 0.34 };
        this.seed = Math.random() * 10;
        this.leafSeeds = [1.3, 2.7, 4.1, 5.9, 7.4, 8.8];
        this.look = { x: 0, y: 0.8 };
        this.face = -1;
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.state = 'intro';
        this.stateT = 1.7;
        this.stateDur = 1.7;
        this.seq = 0;
        this.callClock = 5;
        this.apples = [];       // eigene Äpfel (liegen zusätzlich in Game.projectiles)
        this.aimPts = [];       // Landeplätze der aktuellen Schüttelaktion
        this.callPts = [];      // Spawnorte gerufener Helfer
        this.summoned = [];
        this.waves = [];
        this.jumpH = 0;
        this.leapA = 0;
        this.leapLen = 0;
        this.crouch = 0;
        this.slam = 0;
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Ein uralter Riesenbaum lässt sich nicht wegschubsen.
    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.12);
    }

    _room(world) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || typeof Game._bossRoomRect !== 'function') return null;
        return Game._bossRoomRect();
    }

    //arena zum Zielen: echter Boss-Raum, sonst (Galerie) eine Fläche um den Baum
    _arena(world) {
        return this._room(world) || { x: this.x - 150, y: this.y - 130, w: 380, h: 330 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        compactInPlace(this.apples, a => !a.dead);
        compactInPlace(this.summoned, k => !k.dead);
        this._updateWaves(dt, player);
        this.stateT -= dt;
        const p2 = this.phase === 2;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        // Krone-Verlustanzeige (nur Darstellung): je weniger LP, desto leerer die Krone
        switch (this.state) {
            case 'intro':
                this.crouch = 0;
                if (this.stateT <= 0) this._toIdle();
                break;
            case 'idle':
                this._stomp(dt, world, px, py, 1);
                if (this.stateT <= 0) this._nextAttack(world, player, projectiles);
                break;
            case 'shake':
                this.crouch = 0;
                if (this.stateT <= 0) {
                    this._dropApples(world, player, projectiles);
                    this._set('catch', p2 ? 1.0 : 1.25);
                }
                break;
            case 'crouch':
                this.crouch = clamp(1 - this.stateT / (p2 ? 0.5 : 0.62), 0, 1);
                if (this.stateT <= 0) {
                    this.leapA = Math.atan2(py - this.centerY(), px - this.centerX());
                    this.leapLen = clamp(Math.hypot(px - this.centerX(), py - this.centerY()), 40, 150);
                    this._set('jump', p2 ? 0.55 : 0.66);
                }
                break;
            case 'jump': {
                const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
                this.crouch = 0;
                this.jumpH = Math.sin(Math.PI * k) * 52;
                const sp = this.leapLen / Math.max(0.2, this.stateDur);
                this._moveWithCollision(Math.cos(this.leapA) * sp * dt, Math.sin(this.leapA) * sp * dt, world);
                if (this.stateT <= 0) {
                    this.jumpH = 0;
                    this.slam = 1;
                    this._slam(world, player);
                }
                break;
            }
            case 'land':
                this.slam = Math.max(0, this.slam - dt * 3.4);
                if (this.stateT <= 0) this._set('catch', p2 ? 1.1 : 1.4);
                break;
            case 'call':
                if (this.stateT <= 0) {
                    this._spawnHelpers(world, player);
                    this._set('catch', 0.9);
                }
                break;
            case 'roar':
                if (this.stateT <= 0) this._toIdle();
                break;
            default:        // catch
                this.slam = Math.max(0, this.slam - dt * 3.4);
                this.crouch = 0;
                this.jumpH *= Math.exp(-9 * dt);
                if (this.stateT <= 0) this._toIdle();
        }
        this._lookAt(dt, px, py);
        // Schatten passt auf den Sprung auf
        this.shadow.rx = 40 * (1 - this.jumpH / 130);
        this.shadow.alpha = 0.34 * (1 - this.jumpH / 170);
    }

    _lookAt(dt, px, py) {
        const dx = px - this.centerX(), dy = py - (this.y + this.h - 62);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 6);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
        if (Math.abs(dx) > 16) this.face = dx > 0 ? 1 : -1;
    }

    _toIdle() {
        if (this.phase === 2 && !this.roared) {
            // Wutausbruch beim Phasenwechsel (kein Angriff, nicht unverwundbar)
            this.roared = true;
            this._set('roar', 1.05);
            const x = this.centerX(), y = this.y + this.h - 90;
            TreeArt.shake(7, 0.5);
            TreeArt.burst(x, y, [TreeCfg.appleRed, '#ffd23f', '#ffffff'], 20, 200, 0.7, { kind: 'star' });
            TreeArt.ring(x, this.y + this.h - 6, '#ff6b3d', 120, 0.55, 6);
            TreeArt.sound('bossIntro');
            return;
        }
        this._set('idle', this.phase === 2 ? randRange(0.8, 1.15) : randRange(1.2, 1.7));
    }

    // stapft schwerfällig auf mittlerem Abstand umher
    _stomp(dt, world, px, py, k) {
        const dx = px - this.centerX(), dy = py - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        let vx, vy, sp = this.speed * k;
        if (d > 150) {
            vx = dx / d; vy = dy / d;
        } else if (d < 96) {
            vx = -dx / d; vy = -dy / d; sp *= 0.7;
        } else {
            vx = (-dy / d); vy = (dx / d); sp *= 0.55;
        }
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
        if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.25) this._set('idle', 0.4);
    }

    // Angriffsrhythmus: Schütteln, Stampfer, zwischendurch Helfer rufen
    _nextAttack(world, player, projectiles) {
        this.callClock -= 1;
        const helpers = this._aliveHelpers();
        if (this.callClock <= 0 && helpers < TreeCfg.maxHelpers) {
            this.callClock = this.phase === 2 ? 5 : 7;
            this._startCall(world, player);
            return;
        }
        const n = this.seq++;
        if (n % 2 === 0) this._startShake(world, player);
        else this._startLeap();
    }

    _aliveHelpers() {
        let n = 0;
        for (const k of this.summoned) if (k && !k.dead) n++;
        return n;
    }

    // ── a) Schütteln: Äpfel regnen in die Arena ──

    _startShake(world, player) {
        this.aimPts = this._scatter(world, player, this.phase === 2 ? randInt(11, 14) : randInt(8, 11));
        this._set('shake', this.phase === 2 ? 0.9 : 1.05);
    }

    // Landeplätze auf einem ausgeregelten Raster mit Versatz: garantiert verteilte Äpfel UND Lücken zum
    // Ausweichen. Zwei Punkte zusätzlich auf Mark bzw. einen Freund.
    _scatter(world, player, n) {
        const r = this._arena(world);
        const cols = 5, rows = 4, cw = r.w / cols, ch = r.h / rows;
        const cells = [];
        for (let i = 0; i < cols * rows; i++) cells.push(i);
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = cells[i];
            cells[i] = cells[j];
            cells[j] = tmp;
        }
        const pts = [];
        const m = Math.max(0, Math.min(cells.length, n - 2));
        for (let i = 0; i < m; i++) {
            const c = cells[i];
            pts.push({
                x: r.x + (Math.floor(c % cols) + 0.5) * cw + randRange(-cw * 0.24, cw * 0.24),
                y: r.y + (Math.floor(c / cols) + 0.5) * ch + randRange(-ch * 0.24, ch * 0.24),
            });
        }
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        pts.push({ x: px, y: py });
        const comps = TreeArt.companions();
        if (comps.length) {
            const c = comps[Math.floor(Math.random() * comps.length)];
            pts.push({ x: c.x + (c.w || 20) / 2, y: c.y + (c.h || 20) / 2 });
        } else {
            pts.push({ x: px + randRange(-40, 40), y: py + randRange(-40, 40) });
        }
        for (const p of pts) {
            p.x = clamp(p.x, r.x + 12, r.x + r.w - 12);
            p.y = clamp(p.y, r.y + 12, r.y + r.h - 12);
        }
        return pts;
    }

    _dropApples(world, player, projectiles) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (!list) {
            this.aimPts.length = 0;
            return;
        }
        const cx = this.centerX(), cy = this.y - 16;
        for (let i = 0; i < this.aimPts.length; i++) {
            if (list.length >= TreeCfg.maxProj) break;
            const pt = this.aimPts[i];
            const a = new TreeFruit({
                x0: cx + Math.cos(i * 1.7 + this.seed) * 34,
                y0: cy + Math.sin(i * 2.3 + this.seed) * 12,
                tx: pt.x, ty: pt.y,
                dur: randRange(0.85, 1.05), arc: randRange(120, 165),
                delay: (i % 4) * 0.12 + randRange(0, 0.16),
                type: TreeCfg.fruits[0], boom: true, r: 7, dmg: 1, boss: this,
            });
            list.push(a);
            this.apples.push(a);
        }
        this.aimPts.length = 0;
        TreeArt.burst(cx, cy, [TreeCfg.leaf, TreeCfg.leafDeep, TreeCfg.appleRed], 16, 150, 0.6, { gravity: 210, size: 4 });
        TreeArt.shake(3.5, 0.2);
    }

    // ── b) Sprung-Stampfer mit riesiger Welle ──

    _startLeap() {
        this._set('crouch', this.phase === 2 ? 0.5 : 0.62);
    }

    _slam(world, player) {
        const x = this.centerX(), y = this.y + this.h - 4;
        const max = this._waveMax();
        this.waves.push({ x, y, r: 22, max, delay: 0, hitP: false, hitC: [] });
        if (this.phase === 2) this.waves.push({ x, y, r: 22, max, delay: 0.55, hitP: false, hitC: [] });
        TreeArt.shake(9, 0.4);
        TreeArt.burst(x, y, ['#c8b28c', '#8a6a4a', '#f0e6d0'], 18, 190, 0.6, { kind: 'smoke', size: 7 });
        TreeArt.burst(x, y, [TreeCfg.leaf, TreeCfg.leafDeep], 10, 160, 0.5, { gravity: 240, size: 4 });
        TreeArt.ring(x, y, '#ffe6c4', 60, 0.35, 6);
        TreeArt.sound('hit');
        this._set('land', 0.34);
    }

    _waveMax() {
        const r = this._arena(null);
        return Math.max(r.w, r.h) + 190;
    }

    // Wellenfront wächst über die ganze Arena: 1 Schaden + kurz benommen. Draufrallen rettet.
    _updateWaves(dt, player) {
        if (!this.waves.length) return;
        for (const w of this.waves) {
            if (w.delay > 0) {
                w.delay -= dt;
                if (w.delay <= 0) {
                    TreeArt.shake(6, 0.25);
                    TreeArt.ring(w.x, w.y, '#ffe6c4', 60, 0.3, 5);
                }
                continue;
            }
            w.r += TreeCfg.waveSpeed * dt;
            const band = TreeCfg.band;
            if (!w.hitP && player && !player.dead && !(player.stunTimer > 0) && !player.dodging) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                if (Math.abs(Math.hypot(px - w.x, py - w.y) - w.r) < band + player.w / 2) {
                    w.hitP = true;
                    TreeArt.hurt(player, 1, Math.atan2(py - w.y, px - w.x), 150);
                    if (player.stun && player.stun(TreeCfg.playerStun)) {
                        TreeArt.burst(px, py - 14, ['#ffe35a', '#ffffff'], 8, 90, 0.5, { kind: 'star' });
                    }
                }
            }
            for (const c of TreeArt.companions()) {
                if (c.iFrames > 0 || c.stunTimer > 0 || w.hitC.indexOf(c) >= 0) continue;
                const cw = c.w || 20, ch = c.h || 20;
                const d = Math.hypot(c.x + cw / 2 - w.x, c.y + ch / 2 - w.y);
                if (Math.abs(d - w.r) < band + Math.max(cw, ch) / 2) {
                    w.hitC.push(c);
                    c.stun(TreeCfg.friendStun);
                    TreeArt.burst(c.x + cw / 2, c.y, ['#ffe35a', '#ffffff'], 6, 80, 0.45, { kind: 'star' });
                }
            }
        }
        compactInPlace(this.waves, w => w.r < w.max);
    }

    // ── c) Junge Bäume rufen (nur im Boss-Raum, höchstens vier, verpuffen mit dem Boss) ──

    _startCall(world, player) {
        const r = this._arena(world);
        const want = Math.min(TreeCfg.maxHelpers - this._aliveHelpers(), this.phase === 2 ? 2 : 1);
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        this.callPts.length = 0;
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = r.x + 22 + Math.random() * (r.w - 44);
                const y = r.y + 22 + Math.random() * (r.h - 44);
                if (Math.hypot(x - px, y - py) < 70) continue;
                if (Math.hypot(x - this.centerX(), y - this.centerY()) < 60) continue;
                if (world && world.isWall && world.isWall(x, y)) continue;
                this.callPts.push({ x, y });
                break;
            }
        }
        this._set('call', 0.85);
    }

    _spawnHelpers(world, player) {
        if (typeof Game === 'undefined' || !Game.enemies) {
            this.callPts.length = 0;
            return;
        }
        for (const p of this.callPts) {
            const kid = new TreeMonster(p.x, p.y);
            kid.summoner = this;
            kid.hp = kid.maxHp = 5;
            kid.engaged = true;
            kid.throwT = randRange(0.9, 1.8);
            Game.enemies.push(kid);
            this.summoned.push(kid);
            TreeArt.burst(p.x, p.y, [TreeCfg.leaf, '#ffffff', TreeCfg.leafDeep], 12, 130, 0.5, { kind: 'star' });
            TreeArt.ring(p.x, p.y + 8, TreeCfg.leaf, 28, 0.4, 3);
        }
        this.callPts.length = 0;
    }

    // ── Zeichnen ──

    // Haltung nur aus dem Zustand abgeleitet (draw() ändert nichts)
    _pose(dead) {
        const p = this._pz || (this._pz = {});
        const st = dead ? 'dead' : this.state, t = Art.time;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const p2 = this.phase === 2;
        p.wob = 0;              // Kronen-Wackeln
        p.raise = 0;           // Astarme hoch
        p.slam = this.slam;
        p.crouch = this.crouch;
        p.jump = this.jumpH;
        p.mouth = p2 ? 'teeth' : 'angry';
        p.hurt = this.hp <= this.maxHp * 0.25 && !dead;
        p.breathe = Math.sin(t * (p2 ? 3.2 : 2.1) + this.seed) * 2.2;
        if (st === 'intro') {
            p.raise = Math.sin(k * Math.PI) * 0.8;
            p.mouth = 'open';
        } else if (st === 'shake') {
            p.wob = Math.sin(t * 21) * (3 + k * 9);
            p.raise = 0.35 + k * 0.55;
            p.mouth = 'open';
        } else if (st === 'crouch') {
            p.mouth = 'teeth';
        } else if (st === 'jump') {
            p.raise = 1;
            p.mouth = 'open';
        } else if (st === 'land') {
            p.slam = Math.max(p.slam, 0.6);
            p.mouth = 'open';
        } else if (st === 'catch') {
            p.mouth = 'o';
            p.breathe = Math.sin(t * 8.5 + this.seed) * 3.4;
            p.raise = 0.12;
        } else if (st === 'roar') {
            p.wob = Math.sin(t * 26) * 7;
            p.raise = Math.sin(k * Math.PI);
            p.mouth = 'open';
        } else if (st === 'call') {
            p.raise = 0.5 + Math.sin(t * 9) * 0.12;
            p.mouth = 'grin';
        } else if (st === 'dead') {
            p.mouth = 'o';
            p.raise = 0;
        }
        return p;
    }

    drawUnder(ctx, camera) {
        if (this.dead) return;
        const p2 = this.phase === 2;
        // a) Landeplätze beim Schütteln (Krone wackelt noch)
        if (this.state === 'shake') {
            const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
            for (const pt of this.aimPts) {
                const s = camera.worldToScreen(pt.x, pt.y);
                LateWorldArt.warn(ctx, s.x, s.y, TreeCfg.boomR, k);
            }
        }
        // b) Warnkreise der fallenden und glühenden Äpfel
        for (const a of this.apples) {
            if (a.dead) continue;
            if (a.state !== 'fly') continue;
            const s = camera.worldToScreen(a.tx, a.ty);
            LateWorldArt.warn(ctx, s.x, s.y, TreeCfg.boomR, clamp((a.t + a.lead) / (a.lead + a.dur), 0.05, 1));
        }
        // c) Helfer-Saatpunkte
        if (this.state === 'call') {
            const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
            for (const pt of this.callPts) {
                const s = camera.worldToScreen(pt.x, pt.y);
                LateWorldArt.warn(ctx, s.x, s.y, 22, k, '#3fd05a');
            }
        }
        // d) Stampfbahn (wo er landet) und die Wellenfronten
        const foot = camera.worldToScreen(this.centerX(), this.y + this.h - 6);
        if (this.state === 'crouch') {
            const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
            LateWorldArt.lane(ctx, foot.x, foot.y, this.leapA, this.leapLen + 40, 46, k);
            const l = camera.worldToScreen(this.centerX() + Math.cos(this.leapA) * this.leapLen,
                this.y + this.h - 6 + Math.sin(this.leapA) * this.leapLen);
            LateWorldArt.warn(ctx, l.x, l.y, 74, k * 0.6);
        } else if (this.state === 'jump') {
            const l = camera.worldToScreen(this.centerX() + Math.cos(this.leapA) * this.leapLen,
                this.y + this.h - 6 + Math.sin(this.leapA) * this.leapLen);
            LateWorldArt.warn(ctx, l.x, l.y, 74, 1);
        }
        for (const w of this.waves) {
            if (w.delay > 0) continue;
            const s = camera.worldToScreen(w.x, w.y);
            const fade = clamp(1 - w.r / w.max, 0, 1);
            Art.ring(ctx, s.x, s.y, w.r, '#8a5a2a', 30, 0.28 * fade);
            Art.ring(ctx, s.x, s.y, w.r, '#ffe6c4', 10, 0.55 * fade + 0.15);
            Art.ring(ctx, s.x, s.y, w.r + TreeCfg.band * 0.6, '#ff9f1c', 3, 0.5 * fade);
            if (p2) Art.ring(ctx, s.x, s.y, Math.max(2, w.r - TreeCfg.band), '#ff3d5a', 2.2, 0.4 * fade);
        }
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            LateWorldArt.bossDeath(ctx, this, cx, by - 60);
            this._drawTree(ctx, cx, by, true);
        } else {
            this._drawTree(ctx, cx, by, false);
        }
        ctx.restore();
    }

    // Riesenbaum mit Fußpunkt (cx, by)
    _drawTree(ctx, cx, by, dead) {
        const p = this._pose(dead);
        const t = Art.time, f = this.face, p2 = this.phase === 2 && !dead;
        const leaf = p2 ? 'hsl(104, 66%, 42%)' : 'hsl(122, 62%, 46%)';
        const deep = p2 ? 'hsl(96, 62%, 26%)' : 'hsl(128, 60%, 30%)';
        const squash = 1 - p.crouch * 0.14 + p.slam * 0.12;
        const stretch = 1 + p.crouch * 0.1 - p.slam * 0.1;
        ctx.save();
        ctx.translate(cx, by);
        // Wurzelfüße
        for (let i = -2; i <= 2; i++) {
            const rx = i * 13;
            Art.limb(ctx, i * 5, -16, rx, -2 + (i % 2 ? 1 : 0), 7 - Math.abs(i) * 0.7, TreeCfg.barkDeep, { lineWidth: 1.8 });
            LateWorldArt.blob(ctx, rx, -1.5, 8.5 - Math.abs(i), 3.2, TreeCfg.barkDeep, 1.6);
        }
        ctx.scale(squash, stretch);
        ctx.translate(0, p.breathe * 0.2 - p.jump);
        // Phase 2: rötliches Grollen im Stamm
        if (p2) Art.glow(ctx, 0, -70, 84, '#ff4a2a', 0.16 + 0.06 * Math.sin(t * 4));
        // Krone hinten (hinter dem Stamm)
        TreeArt.crown(ctx, p.wob * 0.5, -124, 1.55, p.wob, leaf, deep, p2 ? 9 : 7, [this.seed, this.seed + 1.7, this.seed + 3.3, this.seed + 5.1, this.seed + 7.2]);
        // Stamm: unten breit auslaufend, oben schmaler
        Art.shape(ctx, c => {
            c.moveTo(-30, -2);
            c.quadraticCurveTo(-20, -22, -17, -52);
            c.quadraticCurveTo(-15, -80, -11, -100);
            c.lineTo(11, -100);
            c.quadraticCurveTo(15, -80, 17, -52);
            c.quadraticCurveTo(20, -22, 30, -2);
            c.closePath();
        }, { x: -30, y: -100, w: 60, h: 98 }, TreeCfg.bark, { lineWidth: 2.2, glossy: true });
        // Rindenlinien und Astknoten
        ctx.strokeStyle = Art.alpha(TreeCfg.barkDeep, 0.85);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-12, -92);
        ctx.quadraticCurveTo(-9, -60, -12, -14);
        ctx.moveTo(12, -92);
        ctx.quadraticCurveTo(9, -60, 12, -14);
        ctx.stroke();
        LateWorldArt.blob(ctx, -f * 15, -86, 5, 6.4, TreeCfg.barkDeep, 1.4);
        if (p.hurt || p2) {
            // Risse (Phase 2 und bei wenig LP)
            ctx.strokeStyle = '#3a1e0c';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(-6, -96);
            ctx.lineTo(-2, -84);
            ctx.lineTo(-6, -74);
            ctx.moveTo(7, -44);
            ctx.lineTo(3, -32);
            ctx.lineTo(6, -20);
            ctx.stroke();
        }
        // Astarme (hintere Hand vorn, wenn hochgeholt)
        const lift = p.raise;
        for (let s = -1; s <= 1; s += 2) {
            const hx = s * (34 + lift * 8);
            const hy = -78 - lift * 44 - Math.sin(t * 2 + s) * 2;
            Art.limb(ctx, s * 14, -84, hx * 0.72, hy + 14, 8, TreeCfg.bark, { lineWidth: 2 });
            Art.limb(ctx, hx * 0.72, hy + 14, hx, hy, 5.4, TreeCfg.bark, { lineWidth: 1.6 });
            Art.limb(ctx, hx, hy, hx + s * 9, hy - 8, 2.6, TreeCfg.bark, { lineWidth: 1.1 });
            if (lift > 0.3) {
                // dicker roter Apfel in der Hand
                Art.glow(ctx, hx, hy - 4, 16, '#ff6b3d', 0.3 + lift * 0.3);
                TreeArt.fruit(ctx, hx + s * 3, hy - 6, TreeCfg.fruits[0], 1.5, s * 0.3);
            }
        }
        // Gesicht im Stamm
        const fx = f * 3, fy = -62;
        if (dead) {
            LateWorldArt.xEyes(ctx, fx, fy, 3.4, 8);
        } else if (this.state === 'catch') {
            // keuchend: geschlossene Augen
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let s = -1; s <= 1; s += 2) {
                ctx.moveTo(fx + s * 8 - 3, fy - 1);
                ctx.quadraticCurveTo(fx + s * 8, fy + 2.4, fx + s * 8 + 3, fy - 1);
            }
            ctx.stroke();
        } else {
            if (p2) Art.glow(ctx, fx, fy, 26, '#ff3b30', 0.45);
            Art.eyes(ctx, fx, fy, 6, { gap: 8.5, look: this.look, angry: true, iris: p2 ? '#ff2d2d' : '#2f5a1a', seed: this.seed });
        }
        // buschige Holzbrauen
        ctx.strokeStyle = TreeCfg.barkDeep;
        ctx.lineWidth = 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let s = -1; s <= 1; s += 2) {
            const bx = fx + s * 8;
            ctx.moveTo(bx - s * 6, fy - 11 + (p2 ? 2 : 0));
            ctx.lineTo(bx + s * 5, fy - 7 + (p2 ? 4 : 0));
        }
        ctx.stroke();
        Art.mouth(ctx, fx, fy + 15, 16, p.mouth);
        // Krone vorn (vor dem Kopf) + Blattregen in Phase 2
        Art.body(ctx, p.wob * 0.8 - 6, -136, 26, 19, leaf, { lineWidth: 2.2 });
        Art.body(ctx, p.wob + 14, -126, 22, 16, deep, { lineWidth: 2 });
        Art.body(ctx, p.wob * 1.2 + 2, -146, 18, 13, leaf, { lineWidth: 1.8, glossy: true });
        for (let i = 0; i < 5; i++) {
            const sd = this.leafSeeds[i];
            Art.body(ctx, p.wob + Math.cos(sd * 2.2) * 30, -134 + Math.sin(sd * 3.4) * 12, 4.2, 3.9, TreeCfg.appleRed, { lineWidth: 1.2, highlight: false });
        }
        if (p2) {
            // Blätterregen: reine Darstellung, alles hängt an Art.time
            for (let i = 0; i < 6; i++) {
                const sd = this.leafSeeds[i % this.leafSeeds.length];
                const q = (t * 0.26 + sd * 0.17) % 1;
                const lx = Math.sin(t * 1.4 + sd * 2) * 46 + (sd - 4) * 6;
                const ly = -128 + q * 128;
                ctx.globalAlpha = (1 - q) * 0.9;
                TreeArt.leaf(ctx, lx, ly, 4.4, t * 2 + sd, i % 2 ? TreeCfg.leaf : TreeCfg.leafDeep);
                ctx.globalAlpha = 1;
            }
        }
        if (this.state === 'catch' && !dead) LateWorldArt.dizzy(ctx, fx, fy - 26, 22, 3.6);
        ctx.restore();
    }
}
