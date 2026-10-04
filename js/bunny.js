// ── Welt 31: Hasenhügel (Idee von Leander) ──
// HammerHasen: kleine Hasen mit Holzhammer (Fell weiß, grau oder braun), lange wippende Ohren, rosa Nase,
//   freche Zähne. Sie hoppen in Sprüngen auf Mark oder den nächsten Freund zu, holen sichtbar aus
//   (0,5 s, Hammer über dem Kopf, Warnkreis am Boden) und hauen zu. Kein Berührungsschaden: gefährlich
//   ist nur der Hammer. Freunde, die der Hammer besiegen würde, werden nur umgehauen (knockOut).
// Riesenhase (Boss): riesiger Hase mit je einem Holzhammer in der linken und rechten Pfote.
//   Doppelschlag: die Hämmer hauen abwechselnd links/rechts auf die Plätze, wo Mark und die Freunde
//     stehen (Warnkreis; der Punkt wird vor jedem einzelnen Schlag fixiert – wer rechtzeitig
//     wegläuft, entkommt). Nach der Serie eine Verschnaufpause zum Zurückschlagen.
//   Riesensprung: duckt sich (Warnkreis unter Marks Platz), springt hoch (der Bodenschatten wandert
//     mit) und landet mit einer Schockwelle. Getroffene bekommen Schaden, Mark ist kurz benommen.
//   Ruft kleine HammerHasen in den Boss-Raum (Phase 1 bis 2, Phase 2 bis 4) – sie verpuffen mit ihm.
//   Phase 2 (halbe Lebenspunkte): Gebrüll, die Ohren stehen wütend ab, rote Augen, Dreifachschläge,
//     schnellere Sprünge, mehr Helfer.

// Einziges globales Hilfswerkzeug dieser Welt (alle neuen Namen beginnen mit „Bunny“).
const BunnyArt = {
    SKINS: ['#fdf6ee', '#b6c2d8', '#c08a5a'],   // weiß, grau, braun
    DMG: 2,                                     // halbes Herz
    pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    },
    ease(k) {
        k = clamp(k, 0, 1);
        return k * k * (3 - 2 * k);
    },
    // Schaden an Mark über die Engine (Wackeln, Ton, roter Rand); ohne Engine (Galerie) direkt.
    hurt(player, amount, angle, force) {
        if (typeof Game !== 'undefined' && Game.player === player && typeof Game.hurtPlayer === 'function') {
            Game.hurtPlayer(amount, angle, force);
        } else if (player && player.takeDamage) {
            player.takeDamage(amount, angle, force);
        }
    },
    // Begleiter, die getroffen werden können (Juri, Krokodil – nicht die Schlange auf Marks Schulter)
    friends() {
        const out = [];
        const comps = typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
        for (const c of comps) {
            if (!c || c.dead || typeof c.knockOut !== 'function' || c.koTimer > 0) continue;
            out.push(c);
        }
        return out;
    },
    // Freund treffen: Schaden, aber nie verschwinden – statt besiegt nur umgehauen (wie beim Engel)
    hitFriend(c, dmg) {
        if (!c || c.dead || c.koTimer > 0 || c.iFrames > 0) return false;
        if (c.hp - dmg <= 0) c.knockOut(6);
        else c.takeDamage(dmg);
        BunnyArt.burst(c.x + c.w / 2, c.y + c.h / 2, ['#ffd23f', '#ffffff', '#ff5a7a'], 8, 120, 0.4, { kind: 'star' });
        return true;
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
    // Holzhammer: Stiel entlang +x bis len, großer Holzblock als Kopf (breit hw, hoch hl).
    // glow 0..1 lässt den Kopf rot vor Wut glühen (nur beim Boss im Ausholen).
    woodHammer(ctx, len, hw, hl, lw, glow) {
        Art.limb(ctx, 0, 0, len - hw * 0.3, 0, Math.max(2, hl * 0.24), '#b9773f', { lineWidth: lw * 0.75 });
        if (glow > 0) Art.glow(ctx, len, 0, hl * 1.1, '#ff5a7a', 0.5 * glow);
        Art.box(ctx, len - hw / 2, -hl / 2, hw, hl, Math.min(hw, hl) * 0.24, '#9a6b3f', { lineWidth: lw, highlight: false });
        // dunkle Hirnholzbänder an den Schlagflächen
        ctx.fillStyle = glow > 0.05 ? Art.mix('#7c5230', '#ff6a8a', glow) : '#7c5230';
        ctx.beginPath();
        ctx.rect(len - hw / 2 + lw * 0.4, -hl / 2 + lw * 0.4, hw - lw * 0.8, hl * 0.16);
        ctx.rect(len - hw / 2 + lw * 0.4, hl / 2 - lw * 0.4 - hl * 0.16, hw - lw * 0.8, hl * 0.16);
        ctx.fill();
        Art.shine(ctx, len - hw * 0.15, -hl * 0.14, hw * 0.16, hl * 0.2, 0, 0.38);
    },
};

// ══════════════════════════════════════════
// ── HammerHase ──
// ══════════════════════════════════════════

// Hopplnder Hase (Hitbox 26×24). Zustände: hop (Sprung) → windup (0,5 s Ausholen) → smash → recover.
// Ziel: Mark oder ein Freund, wer näher ist. summoner = vom Riesenhasen gerufen (bleibt im Boss-Raum,
// verpufft mit ihm). Ein Exemplar trägt den Schlüssel (isKeyGhost, goldenes Schlüssel-Abzeichen).
class HammerBunny extends Enemy {
    constructor(x, y) {
        super(x, y, 26, 24);
        this.hp = 7;
        this.maxHp = 7;
        this.speed = randRange(46, 56);          // Mark läuft ~150; hoppt in Stößen
        this.damage = BunnyArt.DMG;
        this.contactDamage = false;              // gefährlich ist nur der Hammer
        this.phasesThroughWalls = false;
        this.flying = false;
        this.detectionRange = 230;
        this.seed = Math.random() * 10;
        this.skin = BunnyArt.pick(BunnyArt.SKINS);
        this.fxColor = this.skin;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.state = 'hop';
        this.stateT = randRange(0.2, 0.8);
        this.stateDur = this.stateT;
        this.hnx = 0;                            // Sprungrichtung (beim Absprung fixiert)
        this.hny = 0;
        this.engaged = false;
        this.moving = false;
        this.target = null;
        this.retargetT = 0;
        this.cooldown = randRange(0.2, 0.8);
        this.hitX = 0;                           // Aufschlagpunkt des laufenden Schlags (Welt)
        this.hitY = 0;
        this.t = Math.random() * 10;
        this.summoner = null;                    // Ruf-Helfer des Bosses (sonst null)
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Sprung in eine Richtung antreten
    _hopTo(nx, ny) {
        this.hnx = nx;
        this.hny = ny;
        this._set('hop', randRange(0.36, 0.5));
        this.retargetT = 0.3;
    }

    // Nächstes Ziel: Mark oder ein wacher Freund
    _pickTarget(player) {
        const mx = this.centerX(), my = this.centerY();
        let best = player && !player.dead ? player : null;
        let bd = best ? Math.hypot(player.x + player.w / 2 - mx, player.y + player.h / 2 - my) : Infinity;
        for (const c of BunnyArt.friends()) {
            const d = Math.hypot(c.x + c.w / 2 - mx, c.y + c.h / 2 - my);
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        // Gerufene Helfer verpuffen mit ihrem Boss und bleiben im Boss-Raum
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                BunnyArt.burst(this.centerX(), this.centerY(), ['#ffd23f', '#ffffff', this.skin], 8, 90, 0.4, { kind: 'star' });
                return;
            }
            if (typeof Game !== 'undefined' && Game.bossActive && Game._bossRoomRect) {
                const room = Game._bossRoomRect();
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
            this.engaged = true;
        }
        this.t += dt;
        if (this.cooldown > 0) this.cooldown -= dt;
        this.moving = false;

        // Ausholen und Zuhauen laufen unabhängig vom Ziel weiter (Richtung steht beim Ausholen fest)
        if (this.state !== 'hop') {
            this.stateT -= dt;
            if (this.stateT <= 0) {
                if (this.state === 'windup') this._set('smash', 0.12);
                else if (this.state === 'smash') {
                    this._smash(player);
                    this._set('recover', 0.5);
                } else {
                    this._toHop(world, player);
                }
            }
            return;
        }

        this.retargetT -= dt;
        if (this.retargetT <= 0 || !this.target || this.target.dead || this.target.koTimer > 0) {
            this.target = this._pickTarget(player);
            this.retargetT = 0.4;
        }
        const tg = this.target;
        let dist = Infinity, dx = 0, dy = 0;
        if (tg) {
            dx = tg.x + tg.w / 2 - this.centerX();
            dy = tg.y + tg.h / 2 - this.centerY();
            dist = Math.hypot(dx, dy) || 1;
        }
        if (this.summoner) this.engaged = true;
        else if (!tg || player.dead) this.engaged = false;
        else if (dist < this.detectionRange) this.engaged = true;
        else if (dist > this.detectionRange + 60) this.engaged = false;

        if (this.engaged && tg) {
            if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
            this._look(dx / dist, dy / dist, dt);
            if (dist < 36 && this.cooldown <= 0) {
                // Ausholen: Aufschlagpunkt steht fest – wer rechtzeitig wegläuft, wird nicht getroffen
                this.hitX = this.centerX() + (dx / dist) * 19;
                this.hitY = this.centerY() + (dy / dist) * 19;
                if (Math.abs(dx) > 2) this.face = dx > 0 ? 1 : -1;
                this._set('windup', 0.5);
                return;
            }
        } else {
            this._look(this.hnx * 0.6, this.hny * 0.6 + 0.2, dt);
        }

        // Hoppen: Richtung steht seit dem Absprung, Bewegung in Stößen
        if (this.stateT <= 0) {
            this._toHop(world, player);
            return;
        }
        if (this.hnx || this.hny) {
            const sp = this.speed * (this.engaged ? 1.55 : 0.7);
            this._moveWithCollision(this.hnx * sp * dt, this.hny * sp * dt, world);
            this.moving = true;
        }
    }

    // Nach Landung oder Pause neu abspringen: zum Ziel oder gemütlich umher
    _toHop(world, player) {
        const tg = this.engaged ? this.target : null;
        if (tg && !tg.dead && tg.koTimer <= 0) {
            const dx = tg.x + tg.w / 2 - this.centerX();
            const dy = tg.y + tg.h / 2 - this.centerY();
            const d = Math.hypot(dx, dy) || 1;
            this._hopTo(dx / d, dy / d);
        } else if (Math.random() < 0.4) {
            this._hopTo(0, 0);                   // kleine Verschnaufpause zwischendrin
        } else {
            const a = Math.random() * TAU;
            this._hopTo(Math.cos(a), Math.sin(a));
        }
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    // Hammer kracht auf den Boden: trifft Mark und Freunde nahe am Aufschlagpunkt
    _smash(player) {
        const x = this.hitX, y = this.hitY;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - x, py - y) < 18 + 6) {
                BunnyArt.hurt(player, BunnyArt.DMG, Math.atan2(py - this.centerY(), px - this.centerX()), 190);
            }
        }
        for (const c of BunnyArt.friends()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - x, cy - y) < 18 + Math.max(c.w, c.h) * 0.3) BunnyArt.hitFriend(c, BunnyArt.DMG);
        }
        BunnyArt.burst(x, y + 4, ['#ffd23f', '#b9773f', '#ffffff'], 6, 110, 0.35, { kind: 'spark' });
        BunnyArt.burst(x, y + 4, 'rgba(220,205,185,0.8)', 3, 45, 0.35, { kind: 'smoke', size: 3 });
        BunnyArt.shake(1.4, 0.09);
    }

    // Warnkreis unter dem Aufschlagpunkt (unter allen Figuren)
    drawUnder(ctx, camera) {
        if (this.dead || (this.state !== 'windup' && this.state !== 'smash')) return;
        const k = this.state === 'windup' ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const p = camera.worldToScreen(this.hitX, this.hitY + 4);
        LateWorldArt.warn(ctx, p.x, p.y, 18, k, '#ff5a7a');
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) {
            if (!LateWorldArt.deathPop(ctx, this, cx, by - 12)) { ctx.restore(); return; }
        }
        ctx.translate(cx, by);
        ctx.scale(this.face, 1);
        this._drawBunny(ctx, this.dead);
        ctx.restore();
        if (this.isKeyGhost && !this.dead) LateWorldArt.keyBadge(ctx, cx, pos.y - 16);
    }

    // Sprunghöhe gerade jetzt (nur Darstellung, aus Zustand errechnet)
    _hopHeight() {
        if (this.dead || this.state !== 'hop' || !(this.hnx || this.hny)) return 0;
        const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
        return Math.sin(k * Math.PI) * 7;
    }

    // Haltung des Hammers (in Blickrichtung +x): Hand (hx, hy), Stielwinkel ha, Neigung, Stauchung
    _pose() {
        const st = this.state;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const idle = { hx: 5.5, hy: -4, ha: 0.6 + Math.sin(Art.time * 2.4 + this.seed) * 0.05, lean: 0, sq: 0 };
        if (st === 'hop') {
            return { hx: 3.5, hy: -11, ha: -0.6, lean: 0.1 * Math.sin(k * Math.PI), sq: 0.05 * Math.cos(k * Math.PI) };
        }
        if (st === 'windup') {
            const e = BunnyArt.ease(k);
            const shake = k > 0.6 ? Math.sin(Art.time * 55 + this.seed) * 0.06 : 0;
            return { hx: lerp(5.5, 0, e), hy: lerp(-4, -17, e), ha: lerp(0.6, -2.7, e) + shake, lean: -0.12 * e, sq: -0.05 * e };
        }
        if (st === 'smash') {
            const e = k * k;
            return { hx: lerp(0, 8, e), hy: lerp(-17, -5, e), ha: lerp(-2.7, 0.45, e), lean: 0.15 * e, sq: 0.07 * e };
        }
        if (st === 'recover') {
            const e = BunnyArt.ease(Math.max(0, (k - 0.45) / 0.55));
            return { hx: lerp(8, 5.5, e), hy: lerp(-5, -4, e), ha: lerp(0.45, 0.6, e), lean: 0.15 * (1 - e), sq: 0.07 * (1 - e) };
        }
        return idle;
    }

    // Hase mit Füßen bei (0, 0), Blick nach +x. dead = Kreuzaugen.
    _drawBunny(ctx, dead) {
        const t = Art.time, sd = this.seed, skin = this.skin;
        const P = this._pose();
        const hopH = this._hopHeight();
        const hopping = this.state === 'hop' && hopH > 0.2 && !dead;
        const earA = Math.sin(t * (hopping ? 9 : 2.6) + sd) * (hopping ? 0.26 : 0.07) - hopH * 0.022 + P.lean * 0.5;
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -13, 24, '#ffd23f', 0.42 + 0.12 * Math.sin(t * 3 + sd));

        // Pfoten am Boden (ziehen sich im Sprung an)
        const tuck = hopH * 0.45;
        ctx.fillStyle = Art.dark(skin, 0.2);
        ctx.beginPath();
        ctx.roundRect(-9, -5.5 - tuck, 4.6, 5.5 + tuck, 1.8);
        ctx.roundRect(2.5, -5.5 - tuck * 0.6, 4.6, 5.5 + tuck * 0.6, 1.8);
        ctx.fill();
        // Stummelschwanz
        ctx.fillStyle = dead ? Art.dark(skin, 0.2) : '#ffffff';
        ctx.beginPath();
        ctx.arc(-12, -10, 3.1, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.translate(0, -hopH);
        ctx.rotate(P.lean);
        ctx.scale(1 + P.sq, 1 - P.sq);
        // Rumpf + Bauch
        Art.body(ctx, 0, -11, 11.5, 10.5, skin, { glossy: true, lineWidth: 1.5 });
        ctx.fillStyle = Art.light(skin, 0.4);
        ctx.beginPath();
        ctx.ellipse(1.5, -6.5, 6.5, 3.8, 0, 0, TAU);
        ctx.fill();

        // lange Ohren (hinteres dunkler, beide wippen)
        const ear = (bx, tilt, back) => {
            ctx.save();
            ctx.translate(bx, -24);
            ctx.rotate(tilt);
            Art.shape(ctx, c => {
                c.moveTo(-2.7, 1);
                c.quadraticCurveTo(-3.8, -11, 0, -16.5);
                c.quadraticCurveTo(3.8, -11, 2.7, 1);
                c.closePath();
            }, { x: -4, y: -17, w: 8, h: 18 }, back ? Art.dark(skin, 0.12) : skin, { lineWidth: 1.2 });
            if (!back) {
                ctx.fillStyle = '#ffb3c8';
                ctx.beginPath();
                ctx.ellipse(0, -8.5, 1.4, 5.2, 0, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        };
        ear(-1, earA - 0.36, true);
        // Kopf
        Art.body(ctx, 5.5, -20, 9, 8.2, skin, { glossy: true, lineWidth: 1.5 });
        ear(5, earA - 0.06, false);
        // Gesicht
        if (dead) LateWorldArt.xEyes(ctx, 8.4, -21, 1.8, 2.9);
        else Art.eyes(ctx, 8.6, -21.4, 2.3, { gap: 2.8, look: { x: this.look.x * this.face, y: this.look.y }, angry: true, seed: sd });
        // rosa Nase + freche Zähne
        ctx.fillStyle = '#ff7aa8';
        ctx.beginPath();
        ctx.ellipse(13.4, -18.6, 1.8, 1.3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fffbe8';
        ctx.beginPath();
        ctx.roundRect(11.6, -17.4, 1.9, 3.4, 0.7);
        ctx.roundRect(13.9, -17.4, 1.9, 3.1, 0.7);
        ctx.fill();
        // Schnurrhaare (dünn, ohne Umriss)
        ctx.strokeStyle = Art.alpha(Art.ink(skin), 0.55);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(14.6, -18.4);
        ctx.lineTo(18.4, -19.6);
        ctx.moveTo(14.6, -17.4);
        ctx.lineTo(18.2, -16.8);
        ctx.stroke();
        // Arm mit Holzhammer
        ctx.save();
        ctx.translate(P.hx, P.hy);
        ctx.rotate(P.ha);
        BunnyArt.woodHammer(ctx, 13, 7, 10, 1.2, 0);
        ctx.restore();
        Art.limb(ctx, 1, -7, P.hx, P.hy, 3.2, skin, { lineWidth: 1.2 });
        Art.body(ctx, P.hx, P.hy, 2.1, 2.1, Art.dark(skin, 0.08), { lineWidth: 0.9, highlight: false });
        ctx.restore();
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 31: Riesenhase ──
// ══════════════════════════════════════════

// Hitbox 72×64, Zeichnung ~150 hoch (mit Ohren) und ~140 breit (mit Hämmern).
// Ablauf: Intro → Laufen → Doppelschlag (2, Phase 2: 3 Hiebe auf Marks und der Freunde Plätze) →
// Laufen → Riesensprung mit Schockwelle → Laufen → zwischendurch Helfer rufen → …
class BossGiantBunny extends Enemy {
    constructor(x, y) {
        super(x, y, 72, 64);
        this.hp = 130;
        this.maxHp = 130;
        this.speed = 34;
        this.damage = 1;
        this.contactDamage = true;
        this.isBoss = true;
        this.fxColor = '#ffb3c8';
        this.shadow = { rx: 44, ry: 13 };
        this.seed = Math.random() * 10;
        this.look = { x: 0, y: 1 };
        this.phase = 1;
        this.roared = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        // Doppelschlag
        this.strikeLeft = 0;                     // noch offene Hiebe der Serie
        this.strikeCycle = 0.64;                 // Zeit pro Hieb (Ausholen + Hauen)
        this.strikeSide = 1;                     // welcher Hammer als Nächstes haut (-1 links, 1 rechts)
        this.strikeIndex = 0;                    // welches Opfer dran ist
        this.strikeX = 0;
        this.strikeY = 0;
        // Riesensprung
        this._jumpFrom = { cx: 0, cy: 0 };
        this._jumpTo = { cx: 0, cy: 0 };
        this.waves = [];                         // laufende Schockwellen {x, y, r, max, hitP, hitC[]}
        this.summoned = [];                      // gerufene HammerHasen
        this._arm = [{ x: 0, y: 0, hot: 0 }, { x: 0, y: 0, hot: 0 }];   // Hammerhaltungen (nur Darstellung)
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    // Ein Riesenhase lässt sich kaum wegschubsen. Besiegt: die Wellen verebben.
    takeDamage(amount, angle, force) {
        const was = this.dead;
        super.takeDamage(amount, angle, (force || 0) * 0.22);
        if (this.dead && !was) this.waves.length = 0;
    }

    feetX() { return this.centerX(); }
    feetY() { return this.y + this.h - 6; }

    _room() {
        return typeof Game !== 'undefined' && Game.bossActive && Game._bossRoomRect ? Game._bossRoomRect() : null;
    }

    update(dt, world, player) {
        this.baseUpdate(dt, world);
        if (this.dead) {
            this._updateWaves(dt, null);
            return;
        }
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this._updateWaves(dt, player);
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        this._lookAt(px - this.centerX(), py - (this.centerY() - 50), dt);

        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0.6);
                break;
            case 'walk':
                this._walk(dt, world, px, py, 76, 1);
                if (this.stateT <= 0) this._nextAttack(player);
                break;
            case 'strike':
                this._walk(dt, world, this.strikeX, this.strikeY, 30, 1.15);
                if (this.stateT <= 0) {
                    this._strikeHit(player);
                    this.strikeLeft--;
                    this.strikeSide = -this.strikeSide;
                    if (this.strikeLeft > 0) this._prepStrike(player);
                    else this._set('stuck', this.phase === 2 ? 0.8 : 1.05);   // Verschnaufpause
                }
                break;
            case 'leapCrouch':
                if (this.stateT <= 0) {
                    this._jumpFrom = { cx: this.centerX(), cy: this.centerY() };
                    this._set('leapAir', this.phase === 2 ? 0.55 : 0.75);
                }
                break;
            case 'leapAir': {
                const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
                const cx = lerp(this._jumpFrom.cx, this._jumpTo.cx, k);
                const cy = lerp(this._jumpFrom.cy, this._jumpTo.cy, k);
                this.x = cx - this.w / 2;
                this.y = cy - this.h / 2;
                if (this.stateT <= 0) this._land(player);
                break;
            }
            case 'call':
                if (this.stateT <= 0) {
                    this._summon(world, player);
                    this._set('stuck', 0.6);
                }
                break;
            default:            // stuck, land, roar
                if (this.stateT <= 0) this._toWalk();
        }
    }

    _lookAt(dx, dy, dt) {
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dt * 7);
        this.look.x += (dx / d - this.look.x) * k;
        this.look.y += (dy / d - this.look.y) * k;
    }

    _toWalk() {
        if (this.phase === 2 && !this.roared) {
            // Wut-Gebrüll beim Wechsel in Phase 2: die Ohren fahren hoch (kein Angriff)
            this.roared = true;
            this._set('roar', 1.0);
            const x = this.centerX(), y = this.y + this.h - 80;
            BunnyArt.shake(7, 0.5);
            BunnyArt.burst(x, y, ['#ff5a7a', '#ffd23f', '#ffffff'], 18, 190, 0.6, { kind: 'star' });
            BunnyArt.ring(x, y + 50, '#ff5a7a', 100, 0.5, 5);
            if (typeof Sound !== 'undefined' && Sound.bossIntro) Sound.bossIntro();
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.7, 1.0) : randRange(1.2, 1.6));
    }

    // Stampft Richtung Ziel (mit Wandkollision), bleibt davor stehen
    _walk(dt, world, tx, ty, near, fast) {
        const dx = tx - this.centerX(), dy = ty - this.centerY();
        const d = Math.hypot(dx, dy) || 1;
        if (d < near) return;
        this.walkT += dt * fast;
        const s = Math.sin(this.walkT * 3.4);
        const v = this.speed * fast * (this.phase === 2 ? 1.35 : 1) * (0.55 + 0.9 * s * s);
        this._moveWithCollision((dx / d) * v * dt, (dy / d) * v * dt, world);
        this.moving = true;
    }

    _nextAttack(player) {
        const i = this.seq++ % 3;
        if (i === 1) {
            this._beginLeap(player);
        } else if (i === 2 && this._aliveHelpers() < this._helperCap()) {
            this._set('call', 0.9);
        } else {
            this.strikeLeft = this.phase === 2 ? 3 : 2;
            this.strikeCycle = this.phase === 2 ? 0.52 : 0.64;
            this.strikeSide = player.x + player.w / 2 >= this.centerX() ? 1 : -1;
            this._prepStrike(player);
        }
    }

    // ── a) Doppelschlag: Hiebe auf die Plätze von Mark und den Freunden ──

    // Reihenfolge der Ziele: erst Mark, dann die Freunde, danach wieder von vorn
    _pickVictims(player) {
        const v = [];
        if (player && !player.dead) v.push(player);
        for (const c of BunnyArt.friends()) v.push(c);
        if (!v.length && player) v.push(player);
        return v;
    }

    // Einen Hieb ansagen: Opfer aussuchen, dessen Platz NOW fixieren, Warnkreis zeigt ihn 0,5-0,6 s
    _prepStrike(player) {
        const victims = this._pickVictims(player);
        const v = victims.length ? victims[this.strikeIndex++ % victims.length] : null;
        let x = this.centerX() + this.strikeSide * 46;
        let y = this.feetY();
        if (v) {
            x = v.x + v.w / 2;
            y = v.y + v.h / 2;
        }
        const room = this._room();
        if (room) {
            x = clamp(x, room.x + 16, room.x + room.w - 16);
            y = clamp(y, room.y + 16, room.y + room.h - 16);
        }
        this.strikeX = x;
        this.strikeY = y;
        this._set('strike', this.strikeCycle);
    }

    _strikeHit(player) {
        const x = this.strikeX, y = this.strikeY;
        if (player && !player.dead) {
            const px = player.x + player.w / 2, py = player.y + player.h / 2;
            if (Math.hypot(px - x, py - y) < 27 + 8) {
                BunnyArt.hurt(player, BunnyArt.DMG, Math.atan2(py - this.centerY(), px - this.centerX()), 210);
            }
        }
        for (const c of BunnyArt.friends()) {
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - x, cy - y) < 27 + Math.max(c.w, c.h) * 0.35) BunnyArt.hitFriend(c, BunnyArt.DMG);
        }
        BunnyArt.shake(3.2, 0.14);
        BunnyArt.burst(x, y, ['#ffd23f', '#b9773f', '#ffffff'], 8, 150, 0.35, { kind: 'spark' });
        BunnyArt.burst(x, y, 'rgba(225,210,185,0.8)', 3, 60, 0.4, { kind: 'smoke', size: 4 });
        BunnyArt.ring(x, y, '#ffb3c8', 32, 0.25, 4);
    }

    // ── b) Riesensprung mit Schockwelle ──

    _beginLeap(player) {
        const room = this._room();
        let cx = player.x + player.w / 2, cy = player.y + player.h / 2;
        if (room) {
            cx = clamp(cx, room.x + this.w / 2 + 6, room.x + room.w - this.w / 2 - 6);
            cy = clamp(cy, room.y + this.h / 2 + 6, room.y + room.h - this.h / 2 - 6);
        }
        this._jumpTo = { cx, cy };
        this._set('leapCrouch', this.phase === 2 ? 0.55 : 0.75);
    }

    // Landung: Bodenwellen-Ring wächst nach außen, trifft Mark und die Freunde je einmal
    _land(player) {
        const x = this.centerX(), y = this.y + this.h - 10;
        this._jumpTo = { cx: x, cy: this.centerY() };
        this.waves.push({ x, y, r: 24, max: this.phase === 2 ? 160 : 138, hitP: false, hitC: [] });
        BunnyArt.shake(this.phase === 2 ? 8 : 6.5, 0.35);
        for (const s of [-1, 1]) {
            BunnyArt.burst(x + s * 46, y, ['#ffd23f', '#b9773f', '#ffffff'], 10, 180, 0.45, { kind: 'spark' });
            BunnyArt.burst(x + s * 46, y, 'rgba(230,215,190,0.85)', 5, 70, 0.5, { kind: 'smoke', size: 5 });
        }
        BunnyArt.ring(x, y, '#ffd23f', 52, 0.3, 5);
        if (typeof Sound !== 'undefined' && Sound.explosion) Sound.explosion();
        this._set('land', 0.2);
    }

    // Der Ring wächst. Wer drin steht: Schaden, Mark zusätzlich kurz benommen, jeder höchstens einmal.
    _updateWaves(dt, player) {
        if (!this.waves.length) return;
        for (const w of this.waves) {
            w.r += 185 * dt;
            const band = 14;
            if (!w.hitP && player && !player.dead && !(player.stunTimer > 0)) {
                const px = player.x + player.w / 2, py = player.y + player.h / 2;
                const d = Math.hypot(px - w.x, py - w.y);
                if (Math.abs(d - w.r) < band + player.w / 2 && !player.dodging) {
                    w.hitP = true;
                    BunnyArt.hurt(player, BunnyArt.DMG, Math.atan2(py - w.y, px - w.x), 170);
                    if (player.stun && player.stun(2.5)) {
                        BunnyArt.burst(px, py - 14, ['#ffe35a', '#ffffff'], 8, 90, 0.5, { kind: 'star' });
                    }
                }
            }
            for (const c of BunnyArt.friends()) {
                if (w.hitC.includes(c) || c.stunTimer > 0) continue;
                const d = Math.hypot(c.x + c.w / 2 - w.x, c.y + c.h / 2 - w.y);
                if (Math.abs(d - w.r) < band + Math.max(c.w, c.h) / 2) {
                    w.hitC.push(c);
                    BunnyArt.hitFriend(c, BunnyArt.DMG);
                    if (typeof c.stun === 'function' && c.koTimer <= 0) c.stun(2.5);
                }
            }
        }
        compactInPlace(this.waves, w => w.r < w.max);
    }

    // ── c) Helfer rufen (nur im Boss-Raum, verpuffen mit dem Boss) ──

    _helperCap() { return this.phase === 2 ? 4 : 2; }

    _aliveHelpers() {
        let n = 0;
        for (const k of this.summoned) if (k && !k.dead) n++;
        return n;
    }

    _summon(world, player) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || !Game._bossRoomRect || !Game.enemies) return;
        const room = Game._bossRoomRect();
        const want = Math.min(this._helperCap() - this._aliveHelpers(), 2);
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 20 + Math.random() * (room.w - 40);
                const y = room.y + 20 + Math.random() * (room.h - 40);
                if (Math.hypot(x - px, y - py) < 90 || Math.hypot(x - this.centerX(), y - this.centerY()) < 55) continue;
                if (world.isWall(x - 12, y - 13) || world.isWall(x + 12, y - 13) || world.isWall(x - 12, y + 13) || world.isWall(x + 12, y + 13)) continue;
                const kid = new HammerBunny(x, y);
                kid.summoner = this;
                kid.engaged = true;
                Game.enemies.push(kid);
                this.summoned.push(kid);
                BunnyArt.burst(x, y, [kid.skin, '#ffffff', '#ffd23f'], 12, 120, 0.5, { kind: 'star' });
                BunnyArt.ring(x, y + 8, '#ffd23f', 26, 0.4, 3);
                break;
            }
        }
    }

    // ── Zeichnen ──

    // Warnkreise, Landekreis, Bodenwellen (unter allen Figuren), nur im Boss-Raum sichtbar
    drawUnder(ctx, camera) {
        const st = this.state;
        const striking = !this.dead && st === 'strike';
        const crouching = !this.dead && st === 'leapCrouch';
        const air = !this.dead && st === 'leapAir';
        if (!striking && !crouching && !air && !this.waves.length) return;
        ctx.save();
        const room = this._room();
        if (room) {
            const a = camera.worldToScreen(room.x, room.y);
            ctx.beginPath();
            ctx.rect(a.x, a.y, room.w, room.h);
            ctx.clip();
        }
        if (striking) {
            const k = clamp(1 - this.stateT / this.strikeCycle, 0, 1);
            const p = camera.worldToScreen(this.strikeX, this.strikeY + 3);
            LateWorldArt.warn(ctx, p.x, p.y, 27, k, '#ff5a7a');
        }
        if (crouching || air) {
            const k = crouching ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
            const p = camera.worldToScreen(this._jumpTo.cx, this._jumpTo.cy + 22);
            LateWorldArt.warn(ctx, p.x, p.y, 60, k, '#ff5a7a');
            if (air) {
                // der dunkle Fleck unter ihm wandert mit zum Landepunkt
                const q = clamp(1 - this.stateT / this.stateDur, 0, 1);
                ctx.fillStyle = 'rgba(70,45,55,0.3)';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y - 10 * (1 - Math.sin(q * Math.PI)), 26, 11, 0, 0, TAU);
                ctx.fill();
            }
        }
        for (const w of this.waves) {
            const c = camera.worldToScreen(w.x, w.y);
            const a = clamp(1 - w.r / w.max, 0.15, 1);
            const prev = ctx.globalAlpha;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(c.x, c.y, w.r, 0, TAU);
            ctx.strokeStyle = '#ff8fa8';
            ctx.globalAlpha = prev * a * 0.3;
            ctx.lineWidth = 30;
            ctx.stroke();
            ctx.strokeStyle = '#ffd23f';
            ctx.globalAlpha = prev * a;
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.globalAlpha = prev;
        }
        ctx.restore();
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2, by = pos.y + this.h;
        ctx.save();
        if (this.dead) LateWorldArt.bossDeath(ctx, this, cx, by - 55);
        ctx.translate(cx, by);
        this._drawGiant(ctx, this.dead);
        ctx.restore();
    }

    // Sprunghöhe gerade jetzt (nur Darstellung)
    _airHeight() {
        if (this.dead || this.state !== 'leapAir') return 0;
        const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
        return Math.sin(k * Math.PI) * 62;
    }

    // Haltungen beider Hammerpfoten (lokal zu den Füßen bei 0,0) – aus dem Zustand, keine Logik
    _arms() {
        const st = this.state, t = Art.time, sd = this.seed;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const A = this._arm;
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const sw = this.moving ? Math.sin(this.walkT * 3.4 + i * Math.PI) * 4 : Math.sin(t * 2 + sd + i) * 1.5;
            let x = s * 43, y = -36 + sw, hot = 0;
            const upX = s * 27, upY = -124;
            const dnIdle = s * 46, dnY = -6;
            const active = st === 'strike' && s === this.strikeSide;
            let dnX = dnIdle;
            let dnYp = dnY;
            if (active) {
                dnX = clamp(this.strikeX - this.feetX(), -62, 62);
                dnYp = clamp(this.strikeY - this.feetY(), -26, 4);
            }
            if (this.dead) {
                x = s * 40; y = -12;
            } else if (active) {
                if (k < 0.66) {
                    const e = BunnyArt.ease(k / 0.66);
                    x = lerp(x, upX, e);
                    y = lerp(y, upY, e) + (k > 0.5 ? Math.sin(t * 50 + i) * 1.5 : 0);
                    hot = e * 0.8;
                } else {
                    const e = ((k - 0.66) / 0.34) ** 2;
                    x = lerp(upX, dnX, e);
                    y = lerp(upY, dnYp, e);
                    hot = 1;
                }
            } else if (st === 'strike') {
                const e = BunnyArt.ease(clamp((k - 0.4) / 0.6, 0, 1));
                x = lerp(dnIdle, x, e);
                y = lerp(dnY, y, e);
                hot = Math.max(0, 0.5 - k);
            } else if (st === 'leapCrouch') {
                const e = BunnyArt.ease(k);
                x = lerp(x, s * 36, e);
                y = lerp(y, -8, e);
            } else if (st === 'leapAir') {
                x = s * (26 + 12 * Math.sin(k * Math.PI));
                y = -130;
                hot = 0.5;
            } else if (st === 'land' || st === 'stuck') {
                const e = BunnyArt.ease(k);
                x = lerp(dnIdle, x, e);
                y = lerp(dnY, y, e);
                hot = Math.max(0, 1 - k * 2) * (st === 'land' ? 1 : 0.4);
            } else if (st === 'roar' || st === 'intro' || st === 'call') {
                const c = Math.abs(Math.sin(t * (st === 'roar' ? 9 : st === 'call' ? 7 : 4)));
                x = s * (17 + 15 * c);
                y = -124 - 6 * c;
                hot = st === 'roar' ? 1 : 0.35;
            }
            if (this.phase === 2 && !this.dead) hot = Math.max(hot, 0.25);
            A[i].x = x;
            A[i].y = y;
            A[i].hot = hot;
        }
        return A;
    }

    // Riesenhase mit Füßen bei (0, 0), Blick zum Betrachter
    _drawGiant(ctx, dead) {
        const t = Art.time, sd = this.seed, p2 = this.phase === 2 && !dead;
        const fur = '#f7f1e6', ink = Art.ink(fur);
        const st = this.state;
        const airH = this._airHeight();
        const step = this.moving ? Math.sin(this.walkT * 3.4) : 0;
        const bob = this.moving ? -Math.abs(step) * 2.2 : Math.sin(t * 1.7 + sd) * 1.2;
        const crouch = st === 'leapCrouch' ? Math.sin(clamp(1 - this.stateT / this.stateDur, 0, 1) * Math.PI) * 8 : 0;
        const land = st === 'land' ? Math.sin(clamp(1 - this.stateT / this.stateDur, 0, 1) * Math.PI) * 6 : 0;
        const lx = clamp(this.look.x, -1, 1) * 3.5;
        if (p2) Art.glow(ctx, 0, -70, 110, '#ff5a7a', 0.3 + 0.12 * Math.sin(t * 6));

        ctx.save();
        ctx.translate(0, -airH);
        // ── Beine ──
        const l0 = this.moving ? Math.max(0, step) * 3 : 0, l1 = this.moving ? Math.max(0, -step) * 3 : 0;
        Art.box(ctx, -20, -22 - l0 + crouch * 0.4, 14, 22 - crouch * 0.4, 5, Art.dark(fur, 0.1), { lineWidth: 2 });
        Art.box(ctx, 6, -22 - l1 + crouch * 0.4, 14, 22 - crouch * 0.4, 5, Art.dark(fur, 0.1), { lineWidth: 2 });
        ctx.fillStyle = '#e58aa5';
        ctx.beginPath();
        ctx.roundRect(-20, -5 - l0, 14, 5, 2);
        ctx.roundRect(6, -5 - l1, 14, 5, 2);
        ctx.fill();

        ctx.save();
        ctx.translate(0, bob + crouch - land);
        ctx.scale(1 + (crouch + land) * 0.008, 1 - (crouch + land) * 0.008);
        // ── Rumpf + Latzhose ──
        Art.body(ctx, 0, -45, 33, 30, fur, { glossy: true, lineWidth: 2.2 });
        Art.shape(ctx, c => {
            c.moveTo(-18, -58);
            c.lineTo(18, -58);
            c.quadraticCurveTo(26, -34, 23, -16);
            c.quadraticCurveTo(0, -10, -23, -16);
            c.quadraticCurveTo(-26, -34, -18, -58);
            c.closePath();
        }, { x: -26, y: -58, w: 52, h: 46 }, p2 ? '#4aa3e8' : '#6fc3ff', { lineWidth: 1.8 });
        // Träger + Karotten-Tasche
        ctx.strokeStyle = p2 ? '#2d7ec0' : '#3f97d8';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(-15, -58);
        ctx.lineTo(-9, -66);
        ctx.moveTo(15, -58);
        ctx.lineTo(9, -66);
        ctx.stroke();
        ctx.fillStyle = '#ff8c42';
        ctx.beginPath();
        ctx.moveTo(-4, -42);
        ctx.lineTo(4, -42);
        ctx.lineTo(0.5, -31);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#3fae4a';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-2, -43);
        ctx.lineTo(-4, -47);
        ctx.moveTo(1, -43);
        ctx.lineTo(2, -48);
        ctx.moveTo(3, -43);
        ctx.lineTo(6, -46.5);
        ctx.stroke();

        // ── Kopf ──
        // Löffel: Phase 1 locker hängend, Phase 2 wütend gerade ab
        const ear = (bx, tiltBack, back) => {
            ctx.save();
            ctx.translate(bx, -98);
            ctx.rotate(tiltBack);
            Art.shape(ctx, c => {
                c.moveTo(-6, 4);
                c.quadraticCurveTo(-9, -24, 0, -44);
                c.quadraticCurveTo(9, -24, 6, 4);
                c.closePath();
            }, { x: -9, y: -44, w: 18, h: 48 }, back ? Art.dark(fur, 0.1) : fur, { lineWidth: 2 });
            if (!back) {
                ctx.fillStyle = p2 ? '#ff8fa8' : '#ffb3c8';
                ctx.beginPath();
                ctx.ellipse(0, -20, 3.1, 15, 0, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        };
        const wob = Math.sin(t * (this.moving ? 4 : 2) + sd) * (p2 ? 0.05 : 0.09);
        const anger = p2 ? Math.sin(t * 24 + sd) * 0.02 : 0;
        ear(lx - 15, p2 ? -0.16 - wob + anger : -0.55 - wob, true);
        Art.body(ctx, lx, -78, 24, 21, fur, { glossy: true, lineWidth: 2.2 });
        ear(lx + 15, p2 ? 0.16 + wob + anger : 0.55 + wob, false);
        // Gesicht
        const fx = lx + clamp(this.look.x, -1, 1) * 2;
        if (dead) LateWorldArt.xEyes(ctx, fx, -83, 3.8, 8.5);
        else Art.eyes(ctx, fx, -83.5, 5, { gap: 8.5, look: this.look, angry: true, seed: sd, iris: p2 ? '#ff3b2f' : '#c96a8a' });
        // rosa Nasenknopf + dicke Hasenzähne
        ctx.fillStyle = '#ff7aa8';
        ctx.beginPath();
        ctx.ellipse(fx, -73.5, 3.6, 2.6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fffbe8';
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(fx - 5.4, -71.2, 4.8, 8, 1.6);
        ctx.roundRect(fx + 0.6, -71.2, 4.8, 7.4, 1.6);
        ctx.fill();
        ctx.stroke();
        Art.blush(ctx, fx, -73, 4, 15);
        // Schnurrhaare
        ctx.strokeStyle = Art.alpha(ink, 0.5);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (const s of [-1, 1]) {
            ctx.moveTo(fx + s * 8, -75);
            ctx.lineTo(fx + s * 19, -78);
            ctx.moveTo(fx + s * 8, -72.5);
            ctx.lineTo(fx + s * 19, -70.5);
        }
        ctx.stroke();
        if (st === 'roar' || st === 'intro' || st === 'strike' || st === 'leapCrouch') {
            Art.mouth(ctx, fx, -62, 11, 'open');
        }
        if (p2) {
            // Wutader auf der Stirn
            ctx.strokeStyle = '#ff3b2f';
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(fx - 14, -95);
            ctx.lineTo(fx - 10, -92);
            ctx.lineTo(fx - 14, -89);
            ctx.moveTo(fx - 10, -95);
            ctx.lineTo(fx - 12.5, -92);
            ctx.stroke();
        }
        if (dead) LateWorldArt.dizzy(ctx, lx, -112, 20);
        ctx.restore();

        // ── Hammerpfoten (vorn): Arm = Pfote, Pfote = Holzhammer ──
        const arms = this._arms();
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? -1 : 1;
            const A = arms[i];
            const sx = s * 28, sy = -62 + bob;
            const ang = Math.atan2(A.y - sy, A.x - sx);
            Art.limb(ctx, sx, sy, A.x, A.y, 11, fur, { lineWidth: 2 });
            ctx.save();
            ctx.translate(A.x, A.y);
            ctx.rotate(ang);
            // Pfotenstulpe
            Art.body(ctx, -1, 0, 6.5, 7, Art.dark(fur, 0.08), { lineWidth: 1.6, highlight: false });
            BunnyArt.woodHammer(ctx, 17, 19, 32, 2, A.hot);
            ctx.restore();
        }
        ctx.restore();
    }
}
