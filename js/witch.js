// ── Welt 30: Hexenwald (Idee von Leander) ──
// Hexenkinder: kleine Hexen mit großem Spitzhut, Umhang und Zauberstab, in drei Sorten:
//   Eis (hellblau), Feuer (orange-rot), Schatten (violett-schwarz). Sie halten Abstand, zielen ~0,6 s
//   (Stab leuchtet, dünne Warnlinie am Boden) und schießen dann einen Zauber auf Mark oder einen Freund.
//   Eis: 1 Schaden + Mark kurz langsamer. Feuer: 2 Schaden. Schatten: 1 Schaden + eine dunkle Schattenwolke
//   folgt Mark ~2 s (die Sicht ringsum wird dunkler, Mark selbst bleibt sichtbar). Danach kichern sie.
// Metallarm-Hexe (Boss, Endgegnerin des Spiels): alte Hexe mit krummer Nase, grauem Haar und Hut, in der
//   einen Hand ein Besen als Stock, der andere Arm ist ein großer Metallarm mit Nieten, Zahnrad und
//   Kristall-Kanone. Angriffe:
//   1. Riesen-Magiestrahl: der Arm lädt ~1,2 s auf (Kristall leuchtet, Warnfächer am Boden zeigt Start und
//      Schwenkrichtung), dann schwenkt ein breiter Strahl langsam über die Arena. 4 Schaden (ein Herz),
//      jedes Ziel höchstens einmal je Strahl. Freunde werden nur umgehauen (K.o. wie in Welt 24).
//   2. Hexen-Salve: hebt den Besen und wirft Eis-, Feuer- und Schattenkugeln im Fächer.
//   3. Phase 2 (halbe LP): Hexenlachen, ruft 2–3 Hexenkinder in den Boss-Raum (höchstens 3 gleichzeitig),
//      der Strahl schwenkt schneller und weiter. Die gerufenen Kinder bleiben im Raum und verpuffen,
//      sobald die Hexe besiegt ist.

const WITCH_KINDS = ['ice', 'fire', 'shadow'];

// Farben je Sorte
const WITCH_PAL = {
    ice: { robe: '#6cc8ff', cape: '#3f8fe0', hat: '#4aa6f0', band: '#effaff', glow: '#5fd8ff', core: '#ffffff', hair: '#f2fbff', iris: '#2f7fe0', bolt: '#9fe6ff' },
    fire: { robe: '#ff7a3d', cape: '#d8382a', hat: '#e8452e', band: '#ffd23f', glow: '#ff7a1f', core: '#fff1a8', hair: '#ffcf4a', iris: '#e0471a', bolt: '#ffb347' },
    shadow: { robe: '#8455dc', cape: '#2e1a52', hat: '#3a2066', band: '#c79bff', glow: '#b06bff', core: '#f2e0ff', hair: '#2a1a40', iris: '#8a3fe0', bolt: '#b98bff' },
};
const WITCH_SKIN = '#ffd9b8';
const WITCH_DMG = { ice: 1, fire: 2, shadow: 1 };

const WITCHKID_AIM = 0.6;       // so lange zielt ein Hexenkind (Stab leuchtet, Warnlinie)
const WITCHKID_LOCK = 0.16;     // die letzten ~0,15 s steht die Richtung fest
const WITCHKID_RANGE = 250;

// Boss
const OLDWITCH_SHOULDER_X = 21, OLDWITCH_SHOULDER_Y = -52;   // Metallarm-Schulter relativ zu den Füßen
const OLDWITCH_ARM = 56;                                       // Schulter bis Kanonenmündung
const OLDWITCH_BEAM_DMG = 4;                                   // ein ganzes Herz
const OLDWITCH_BEAM_W = 30;
const OLDWITCH_BEAM_MAX = 520;
const OLDWITCH_CHARGE = 1.2;
const OLDWITCH_SKIN = '#b5e08a', OLDWITCH_ROBE = '#6a3fb8', OLDWITCH_HAT = '#41297a', OLDWITCH_HAIR = '#cfd2e0';
const OLDWITCH_STEEL = '#b8c4d6', OLDWITCH_STEEL_D = '#7d8aa0', OLDWITCH_BRASS = '#e0b04a';
const WITCH_TMP = { x: 0, y: 0 };

const WitchArt = {
    // Ein-Bild-Zeichenobjekt in Game.particles: zeichnet über allen Figuren (nicht vom Treffer-Blitz
    // beschnitten). (x, y) = Ort für die Bildschirm-Prüfung.
    overlay(owner, x, y) {
        if (typeof Game === 'undefined' || !Game.particles) return;
        Game.particles.push({
            x, y, dead: false, age: 0,
            update() { if (this.age++ > 0) this.dead = true; },
            draw(ctx, camera) { owner._drawOverlay(ctx, camera); },
        });
    },

    // Kichern (kurz, hoch, gedrosselt)
    giggle() {
        if (typeof Sound === 'undefined' || typeof Sound._play !== 'function') return;
        Sound._play(() => {
            for (let i = 0; i < 3; i++) Sound._tone('triangle', 1300 + i * 120, 980, 0.07, 0.05, i * 0.09);
        }, 'witchGiggle', 500);
    },

    // Hexenlachen der alten Hexe
    cackle() {
        if (typeof Sound === 'undefined' || typeof Sound._play !== 'function') return;
        Sound._play(() => {
            for (let i = 0; i < 5; i++) Sound._tone('sawtooth', 620 - i * 30, 420, 0.11, 0.08, i * 0.13);
        }, 'witchCackle', 800);
    },

    // Zauber trifft ein Ziel: Mark (Schaden + Sorten-Wirkung) oder einen Freund (Schaden, K.o. statt besiegt)
    hitPlayer(P, kind, dmg, angle, force) {
        const before = P.hp;
        DragonArt.hurt(P, dmg, angle, force);
        if (P.hp >= before) return false;
        if (kind === 'ice' && P.applySlow) P.applySlow(2.2, 0.55);
        if (kind === 'shadow') WitchShadowCloud.attach(2.1);
        return true;
    },

    hitCompanion(c, dmg, koTime) {
        if (c.hp - dmg <= 0) c.knockOut(koTime);
        else c.takeDamage(dmg);
    },

    // wache, treffbare Freunde (Juri, Krokodil – nicht die Schlange auf der Schulter)
    companions() {
        return typeof Game !== 'undefined' && Game.companions ? Game.companions : [];
    },

    companionOk(c) {
        return c && !c.dead && typeof c.knockOut === 'function' && !(c.koTimer > 0);
    },

    lineClear(world, ax, ay, bx, by) {
        return typeof Juri === 'undefined' || Juri.lineClear(world, ax, ay, bx, by);
    },

    // kleines Sorten-Zeichen (Schneeflocke, Flämmchen, Mondsichel) um (x, y)
    emblem(ctx, kind, x, y, r, t, seed, bg) {
        if (kind === 'ice') {
            Art.sparkle(ctx, x, y, r * 1.3, '#ffffff', 0.75 + 0.25 * Math.sin(t * 4 + seed));
        } else if (kind === 'fire') {
            const fl = Math.sin(t * 14 + seed) * r * 0.25;
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.moveTo(x - r * 0.8, y + r * 0.6);
            ctx.quadraticCurveTo(x - r, y - r * 0.4, x, y - r * 1.3 - fl);
            ctx.quadraticCurveTo(x + r, y - r * 0.4, x + r * 0.8, y + r * 0.6);
            ctx.closePath();
            ctx.fill();
        } else {
            // Mondsichel: heller Kreis, darüber ein Kreis in Hutfarbe
            ctx.fillStyle = '#e8d2ff';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.arc(x + r * 0.55, y - r * 0.25, r * 0.85, 0, TAU);
            ctx.fill();
        }
    },
};

// ══════════════════════════════════════════
// ── Hexenkinder ──
// ══════════════════════════════════════════

// Kleines Hexenkind (Hitbox 22×24, Zeichnung ~40 hoch mit Hut). Sorte reihum (alle drei kommen vor,
// etwa gleich viele). summoner = gerufen von der Metallarm-Hexe (bleibt im Boss-Raum).
class WitchKid extends Enemy {
    constructor(x, y, kind) {
        super(x, y, 22, 24);
        if (WITCH_KINDS.includes(kind)) this.kind = kind;
        else this.kind = WITCH_KINDS[(WitchKid._n++) % 3];
        this.pal = WITCH_PAL[this.kind];
        this.hp = 6;
        this.maxHp = 6;
        this.speed = randRange(50, 60);
        this.damage = 1;
        this.contactDamage = true;
        this.phasesThroughWalls = false;
        this.flying = false;
        this.fxColor = this.pal.robe;
        this.seed = Math.random() * 10;
        this.face = Math.random() < 0.5 ? 1 : -1;
        this.look = { x: 0, y: 0.3 };
        this.engaged = false;
        this.moving = false;
        this.t = Math.random() * 10;
        this.castT = randRange(1.0, 2.6);
        this.aiming = false;
        this.aimT = 0;
        this.aimA = 0;
        this.aimLen = 0;
        this.target = null;
        this.giggleT = 0;
        this.wandA = -0.7;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.strafeT = randRange(0.8, 1.8);
        this.wanderT = randRange(0.3, 1.5);
        this.wx = 0;
        this.wy = 0;
        this.summoner = null;
        this._tip = { x: 0, y: 0 };
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        // Gerufene Kinder verpuffen mit ihrer Hexe und bleiben im Boss-Raum
        if (this.summoner) {
            if (this.summoner.dead) {
                this.hp = 0;
                this.dead = true;
                this.deathTimer = 0.4;
                DragonArt.burst(this.centerX(), this.centerY(), [this.pal.glow, '#ffffff'], 8, 90, 0.4, { kind: 'star' });
                return;
            }
            const room = typeof Game !== 'undefined' && Game.bossActive && Game._bossRoomRect ? Game._bossRoomRect() : null;
            if (room) {
                this.x = clamp(this.x, room.x, room.x + room.w - this.w);
                this.y = clamp(this.y, room.y, room.y + room.h - this.h);
            }
        }
        this.t += dt;
        if (this.giggleT > 0) this.giggleT -= dt;
        const mx = this.centerX(), my = this.centerY();
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        const dx = px - mx, dy = py - my;
        const dist = Math.hypot(dx, dy) || 1;
        if (player.dead) this.engaged = false;
        else if (this.summoner || dist < WITCHKID_RANGE) this.engaged = true;
        else if (dist > WITCHKID_RANGE + 60) this.engaged = false;

        // Zielen: steht still, Stab zeigt aufs Ziel, die letzten ~0,15 s steht die Richtung fest
        if (this.aiming) {
            this.aimT -= dt;
            this.moving = false;
            const tg = this.target;
            if (!tg || tg.dead || tg.koTimer > 0 || !this.engaged) {
                this.aiming = false;
                this.castT = randRange(0.8, 1.4);
            } else {
                if (this.aimT > WITCHKID_LOCK) this._aimAt(tg, world);
                if (this.aimT <= 0) {
                    this._cast(projectiles);
                    this.aiming = false;
                    this.castT = randRange(2.4, 3.4);
                    this.giggleT = 0.85;
                    WitchArt.giggle();
                }
                return;
            }
        } else if (this.engaged) {
            this.castT -= dt;
            if (this.castT <= 0) {
                const tg = this._pickTarget(world, player);
                if (tg) {
                    this.target = tg;
                    this.aiming = true;
                    this.aimT = WITCHKID_AIM;
                    this._aimAt(tg, world);
                    return;
                }
                this.castT = 0.45;   // keine freie Sicht: gleich nochmal
            }
        }

        // Laufen: Abstand halten (90–150), dazwischen seitwärts; ohne Mark herumtrippeln
        let vx = 0, vy = 0, sp = 0;
        if (this.engaged) {
            if (dist > 150) {
                vx = dx / dist; vy = dy / dist; sp = this.speed;
            } else if (dist < 90) {
                vx = -dx / dist; vy = -dy / dist; sp = this.speed * 0.9;
            } else {
                this.strafeT -= dt;
                if (this.strafeT <= 0) {
                    this.strafe = -this.strafe;
                    this.strafeT = randRange(0.9, 1.9);
                }
                vx = (-dy / dist) * this.strafe; vy = (dx / dist) * this.strafe; sp = this.speed * 0.55;
            }
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderT = randRange(1.2, 2.8);
                if (Math.random() < 0.35) {
                    this.wx = 0;
                    this.wy = 0;
                } else {
                    const a = Math.random() * TAU;
                    this.wx = Math.cos(a);
                    this.wy = Math.sin(a);
                }
            }
            vx = this.wx; vy = this.wy; sp = this.speed * 0.45;
        }
        this.moving = sp > 0 && (vx !== 0 || vy !== 0);
        if (this.moving) {
            const ox = this.x, oy = this.y;
            this._moveWithCollision(vx * sp * dt, vy * sp * dt, world);
            if (Math.hypot(this.x - ox, this.y - oy) < sp * dt * 0.3) {
                if (this.engaged) this.strafe = -this.strafe;
                else this.wanderT = 0;
            }
        }
        let lx, ly;
        if (this.engaged) {
            if (dx > 3) this.face = 1; else if (dx < -3) this.face = -1;
            lx = dx / dist; ly = dy / dist;
        } else {
            if (Math.abs(vx) > 0.2) this.face = vx > 0 ? 1 : -1;
            lx = vx * 0.6; ly = vy * 0.6 + 0.2;
        }
        this._look(lx, ly, dt);
        // Stab in Ruhe schräg nach oben vorn
        this.wandA = this.face > 0 ? -0.75 : Math.PI + 0.75;
    }

    // Mark oder ein wacher, sichtbarer Freund in Reichweite
    _pickTarget(world, player) {
        const mx = this.centerX(), my = this.centerY();
        const list = [];
        if (!player.dead && WitchArt.lineClear(world, mx, my - 6, player.x + player.w / 2, player.y + player.h / 2)) list.push(player);
        for (const c of WitchArt.companions()) {
            if (!WitchArt.companionOk(c)) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - mx, cy - my) > WITCHKID_RANGE) continue;
            if (!WitchArt.lineClear(world, mx, my - 6, cx, cy)) continue;
            list.push(c);
        }
        if (!list.length) return null;
        // meistens Mark, manchmal ein Freund
        if (list[0] === player && (list.length === 1 || Math.random() < 0.6)) return player;
        return list[Math.floor(Math.random() * list.length)];
    }

    // Stabspitze in Weltkoordinaten (liegt in this._tip); passt zur Zeichnung
    _wandTip(a) {
        const hx = this.centerX() + this.face * 8, hy = this.y + this.h - 11;
        this._tip.x = hx + Math.cos(a) * 10;
        this._tip.y = hy + Math.sin(a) * 10;
        return this._tip;
    }

    _aimAt(tg, world) {
        const tx = tg.x + tg.w / 2, ty = tg.y + tg.h / 2;
        if (Math.abs(tx - this.centerX()) > 2) this.face = tx > this.centerX() ? 1 : -1;
        const tip = this._wandTip(Math.atan2(ty - (this.y + this.h - 11), tx - this.centerX()));
        this.aimA = Math.atan2(ty - tip.y, tx - tip.x);
        this.wandA = this.aimA;
        const tip2 = this._wandTip(this.aimA);
        this.aimLen = Math.min(DragonArt.beamLength(world, tip2.x, tip2.y, this.aimA, 260), Math.hypot(tx - tip2.x, ty - tip2.y) + 30);
        const d = Math.hypot(tx - this.centerX(), ty - this.centerY()) || 1;
        this.look.x = (tx - this.centerX()) / d;
        this.look.y = (ty - this.centerY()) / d;
    }

    _cast(projectiles) {
        const tip = this._wandTip(this.aimA);
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        if (list) list.push(new WitchBolt(tip.x, tip.y, this.aimA, this.kind, false));
        DragonArt.burst(tip.x, tip.y, [this.pal.glow, '#ffffff'], 6, 90, 0.3, { kind: 'spark' });
    }

    _look(nx, ny, dt) {
        const k = Math.min(1, dt * 8);
        this.look.x += (nx - this.look.x) * k;
        this.look.y += (ny - this.look.y) * k;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        ctx.save();
        ctx.translate(cx, pos.y + this.h);
        if (this.dead) {
            this._drawDeath(ctx);
            ctx.restore();
            return;
        }
        this._drawBody(ctx, false);
        ctx.restore();
        if (this.isKeyGhost) LateWorldArt.keyBadge(ctx, cx, pos.y - 26);
    }

    // Hexenkind mit Füßen bei (0, 0)
    _drawBody(ctx, dead) {
        const t = Art.time, f = this.face, P = this.pal, sd = this.seed;
        const aimK = this.aiming && !dead ? clamp(1 - this.aimT / WITCHKID_AIM, 0, 1) : 0;
        const gig = this.giggleT > 0 && !dead;
        let bob = Math.sin(t * 3 + sd) * 0.8, sx = 1, sy = 1, jit = 0;
        if (this.moving && !dead) {
            const s = Math.sin(t * 12 + sd);
            bob = -Math.abs(s) * 2;
            sx = 1 - Math.abs(s) * 0.04;
            sy = 1 + Math.abs(s) * 0.05;
        }
        if (gig) jit = Math.sin(t * 46) * 0.7;   // schüttelt sich vor Kichern
        const key = this.isKeyGhost && !dead;
        if (key) Art.glow(ctx, 0, -14, 22, '#ffd23f', 0.4 + 0.12 * Math.sin(t * 3 + sd));
        ctx.save();
        ctx.translate(jit, bob);
        ctx.scale(sx, sy);
        // Umhang hinter dem Körper (weht nach hinten)
        const wave = Math.sin(t * 5 + sd) * 1.5;
        Art.shape(ctx, c => {
            c.moveTo(-5, -15);
            c.lineTo(5, -15);
            c.quadraticCurveTo(-f * 6 + 4, -6, -f * 9 + 3, -1 + wave);
            c.lineTo(-f * 12, 0.5 - wave);
            c.quadraticCurveTo(-f * 9, -8, -5, -15);
            c.closePath();
        }, { x: -12, y: -15, w: 24, h: 16 }, P.cape, { lineWidth: 1.1 });
        // Schuhe
        ctx.fillStyle = '#3a2048';
        ctx.beginPath();
        ctx.ellipse(-3.2 + f, -1.3, 2.8, 1.6, 0, 0, TAU);
        ctx.moveTo(3.2 + f + 2.8, -1.3);
        ctx.ellipse(3.2 + f, -1.3, 2.8, 1.6, 0, 0, TAU);
        ctx.fill();
        // Kleid mit Zackensaum
        Art.shape(ctx, c => {
            c.moveTo(-4, -15);
            c.lineTo(4, -15);
            c.lineTo(8, -2.5);
            c.lineTo(5, -3.8);
            c.lineTo(2.5, -2);
            c.lineTo(0, -3.8);
            c.lineTo(-2.5, -2);
            c.lineTo(-5, -3.8);
            c.lineTo(-8, -2.5);
            c.closePath();
        }, { x: -8, y: -15, w: 16, h: 13 }, P.robe, { lineWidth: 1.2 });
        // Schlüsselträger: goldener Schlüssel am Gürtel
        if (key) {
            ctx.save();
            ctx.translate(-f * 3, -7);
            ctx.rotate(Math.PI / 2 + Math.sin(t * 3 + sd) * 0.2);
            Art.key(ctx, 1.4, 0, 3, '#ffd23f');
            ctx.restore();
        }
        // Arm mit Zauberstab (zeigt beim Zielen aufs Ziel)
        const wa = this.wandA + (this.aiming || dead ? 0 : Math.sin(t * 2.4 + sd) * 0.15);
        const hx = f * 8, hy = -11;
        Art.limb(ctx, f * 3, -12.5, hx, hy, 2.6, P.robe, { lineWidth: 1 });
        const tx = hx + Math.cos(wa) * 10, ty = hy + Math.sin(wa) * 10;
        ctx.strokeStyle = '#6a3a1e';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx - Math.cos(wa) * 1.5, hy - Math.sin(wa) * 1.5);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        Art.glow(ctx, tx, ty, 5 + aimK * 9, P.glow, 0.5 + aimK * 0.5);
        Art.sparkle(ctx, tx, ty, 2.2 + aimK * 2.2, P.core, 1);
        // Kopf
        const hxh = f * 0.6, hyh = -20;
        Art.body(ctx, hxh, hyh, 7.4, 6.8, WITCH_SKIN, { lineWidth: 1.2 });
        // Haarsträhnen unter dem Hut
        ctx.fillStyle = P.hair;
        ctx.beginPath();
        ctx.ellipse(hxh - 6.2, hyh - 1, 2.2, 3.6, 0.3, 0, TAU);
        ctx.ellipse(hxh + 6.2, hyh - 1, 2.2, 3.6, -0.3, 0, TAU);
        ctx.fill();
        // Gesicht
        const look = this.look;
        if (dead) LateWorldArt.xEyes(ctx, hxh + f * 0.8, hyh, 1.5, 3);
        else if (gig) {
            // Kichern: zugekniffene Augen
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(hxh + f * 0.8 - 3, hyh + 0.6, 1.6, Math.PI + 0.3, TAU - 0.3);
            ctx.moveTo(hxh + f * 0.8 + 3 + 1.6 * Math.cos(Math.PI + 0.3), hyh + 0.6 + 1.6 * Math.sin(Math.PI + 0.3));
            ctx.arc(hxh + f * 0.8 + 3, hyh + 0.6, 1.6, Math.PI + 0.3, TAU - 0.3);
            ctx.stroke();
        } else {
            Art.eyes(ctx, hxh + f * 0.8, hyh - 0.2, 2.3, { gap: 3, look, iris: P.iris, seed: sd, angry: this.aiming });
        }
        Art.mouth(ctx, hxh + f * 1.2, hyh + 3.6, 3.4, gig ? 'grin' : (this.aiming ? 'o' : 'smile'));
        Art.blush(ctx, hxh + f * 0.6, hyh + 2.4, 1.3, 4.6);
        // Großer Spitzhut mit Krempe, Band und Sorten-Zeichen; die Spitze knickt nach hinten
        const tip = Math.sin(t * 2 + sd) * 1.2;
        Art.shape(ctx, c => {
            c.moveTo(hxh - 6.5, hyh - 5);
            c.quadraticCurveTo(hxh - 3, hyh - 16, hxh - f * 1 , hyh - 21);
            c.quadraticCurveTo(hxh - f * 5, hyh - 23 + tip, hxh - f * 9, hyh - 20 + tip);
            c.quadraticCurveTo(hxh - f * 2, hyh - 18, hxh + 6.5, hyh - 5);
            c.closePath();
        }, { x: hxh - 9, y: hyh - 23, w: 18, h: 18 }, P.hat, { lineWidth: 1.2 });
        Art.body(ctx, hxh, hyh - 5, 11.5, 2.8, P.hat, { lineWidth: 1.2, highlight: false });
        ctx.fillStyle = P.band;
        ctx.beginPath();
        ctx.moveTo(hxh - 6.2, hyh - 6.5);
        ctx.lineTo(hxh + 6.2, hyh - 6.5);
        ctx.lineTo(hxh + 5.5, hyh - 9);
        ctx.lineTo(hxh - 5.5, hyh - 9);
        ctx.closePath();
        ctx.fill();
        WitchArt.emblem(ctx, this.kind, hxh + f * 0.5, hyh - 12.5, 2, t, sd, P.hat);
        ctx.restore();
    }

    // Tod (0,4 s): dreht sich, schrumpft und verpufft in Funkeln der Sortenfarbe; der Hut fliegt hoch
    _drawDeath(ctx) {
        const k = clamp(this.deathProgress(), 0, 1);
        const a0 = ctx.globalAlpha;
        if (k < 0.55) {
            const q = k / 0.55;
            ctx.save();
            ctx.globalAlpha = a0 * (1 - q * 0.6);
            ctx.translate(0, -12);
            ctx.rotate(q * this.face * 3);
            ctx.scale(1 - q * 0.6, 1 - q * 0.6);
            ctx.translate(0, 12);
            this._drawBody(ctx, true);
            ctx.restore();
        }
        ctx.globalAlpha = a0 * (1 - k) * 0.85;
        ctx.fillStyle = this.kind === 'shadow' ? '#5a3f80' : '#f4efff';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = (i * TAU) / 5 + 0.4;
            const d = 4 + k * 12, r = 3 + k * 4;
            const x = Math.cos(a) * d, y = -12 + Math.sin(a) * d * 0.8;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
        ctx.globalAlpha = a0;
        for (let i = 0; i < 4; i++) {
            const a = (i * TAU) / 4 + k * 2;
            Art.sparkle(ctx, Math.cos(a) * (6 + k * 16), -12 + Math.sin(a) * (6 + k * 14), 3 * (1 - k) + 1, this.pal.glow, 1 - k);
        }
    }

    // Warnlinie am Boden: genau dorthin geht der Zauber; blinkt, wenn die Richtung feststeht
    drawUnder(ctx, camera) {
        if (this.dead || !this.aiming || this.aimLen < 4) return;
        const tip = this._wandTip(this.aimA);
        const p = camera.worldToScreen(tip.x, tip.y);
        const k = clamp(1 - this.aimT / WITCHKID_AIM, 0, 1);
        const locked = this.aimT <= WITCHKID_LOCK;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.aimA);
        ctx.strokeStyle = this.pal.glow;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -Art.time * 40;
        ctx.globalAlpha = locked ? 0.55 + 0.45 * Math.abs(Math.sin(Art.time * 24)) : 0.3 + 0.4 * k;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.aimLen, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#ff3d5a';
        ctx.lineWidth = 1;
        ctx.globalAlpha *= 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.aimLen * k, 0);
        ctx.stroke();
        ctx.restore();
    }
}
WitchKid._n = Math.floor(Math.random() * 3);

// ══════════════════════════════════════════
// ── Zauber (Hexenkinder und Hexen-Salve) ──
// ══════════════════════════════════════════

// owner 'witch': die Engine prüft keine Treffer, das macht der Zauber selbst (Mark und die Freunde).
// big = Kugel der alten Hexe (etwas größer, langsamer).
class WitchBolt extends Projectile {
    constructor(x, y, angle, kind, big) {
        const speed = (kind === 'ice' ? 150 : kind === 'fire' ? 175 : 160) * (big ? 0.85 : 1);
        super(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, WITCH_DMG[kind], 'witch', 60);
        this.kind = kind;
        this.big = !!big;
        this.radius = big ? 7.5 : 5;
        this.lifetime = big ? 3.2 : 2.4;
        this.seed = Math.random() * 10;
    }

    update(dt, world) {
        super.update(dt, world);
        if (this.dead) {
            if (this.lifetime > 0) DragonArt.burst(this.x, this.y, [WITCH_PAL[this.kind].glow, '#ffffff'], 4, 60, 0.25, { kind: 'spark' });
            return;
        }
        if (typeof Game === 'undefined') return;
        const P = Game.player;
        if (P && !P.dead && Game.world === world) {
            const px = P.x + P.w / 2, py = P.y + P.h / 2;
            if (Math.hypot(this.x - px, this.y - py) < this.radius + P.w / 2) {
                WitchArt.hitPlayer(P, this.kind, this.damage, Math.atan2(this.vy, this.vx), 100);
                this._pop();
                return;
            }
        }
        for (const c of WitchArt.companions()) {
            if (!WitchArt.companionOk(c) || c.iFrames > 0) continue;
            const w = c.w || 20, h = c.h || 20;
            if (Math.hypot(this.x - (c.x + w / 2), this.y - (c.y + h / 2)) < this.radius + Math.max(w, h) / 2) {
                WitchArt.hitCompanion(c, this.damage, 6);
                this._pop();
                return;
            }
        }
    }

    _pop() {
        this.dead = true;
        DragonArt.burst(this.x, this.y, [WITCH_PAL[this.kind].glow, '#ffffff'], 8, 110, 0.35, { kind: 'star' });
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const P = WITCH_PAL[this.kind];
        const r = this.radius;
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp, dy = this.vy / sp;
        const t = Art.time;
        // Schweif
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.4;
        ctx.fillStyle = P.bolt;
        ctx.beginPath();
        ctx.moveTo(p.x - dy * r * 0.8, p.y + dx * r * 0.8);
        ctx.lineTo(p.x - dx * r * 3.4, p.y - dy * r * 3.4);
        ctx.lineTo(p.x + dy * r * 0.8, p.y - dx * r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = prev;
        if (this.kind === 'shadow') {
            // dunkle Kugel mit violettem Rand (Leuchten hellt nicht auf, darum ein heller Ring)
            Art.glow(ctx, p.x, p.y, r * 2.4, '#9a5bff', 0.55);
            Art.body(ctx, p.x, p.y, r, r, '#2e1a52', { lineWidth: 1.4, outline: '#c79bff', highlight: false });
            ctx.fillStyle = '#c79bff';
            ctx.beginPath();
            ctx.arc(p.x - r * 0.25, p.y - r * 0.3, r * 0.3, 0, TAU);
            ctx.fill();
        } else {
            Art.glow(ctx, p.x, p.y, r * 2.6, P.glow, 0.75);
            Art.body(ctx, p.x, p.y, r, r, P.bolt, { lineWidth: 1.2, outline: Art.ink(P.glow) });
            Art.sparkle(ctx, p.x, p.y, r * 0.9, P.core, 0.9);
        }
        // kreisende Funken
        const a = t * 9 + this.seed;
        Art.sparkle(ctx, p.x + Math.cos(a) * r * 1.5, p.y + Math.sin(a) * r * 1.5, r * 0.45, '#ffffff', 0.9);
    }
}

// ══════════════════════════════════════════
// ── Schattenwolke (Schattenhexen) ──
// ══════════════════════════════════════════

// Liegt (höchstens einmal) in Game.props, folgt Mark ein paar Sekunden: die Sicht ringsum wird dunkler,
// ein heller Kreis um Mark bleibt frei, dunkle Rauchbällchen kreisen um ihn. Kein Schaden.
class WitchShadowCloud {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.w = 1;
        this.h = 1;
        this.onlyUnder = true;
        this.noShadow = true;
        this.timer = 0;
        this.dur = 1;
        this.cx = 0;
        this.cy = 0;
    }

    static attach(seconds) {
        if (typeof Game === 'undefined' || !Game.props || !Game.player) return;
        let c = Game.props.find(p => p instanceof WitchShadowCloud);
        if (!c) {
            c = new WitchShadowCloud();
            Game.props.push(c);
        }
        if (c.timer <= 0) {
            c.cx = Game.player.x + Game.player.w / 2;
            c.cy = Game.player.y + Game.player.h / 2;
            c.dur = seconds;
        } else {
            c.dur = Math.max(c.dur, seconds);
        }
        c.timer = Math.max(c.timer, seconds);
    }

    update(dt) {
        if (this.timer <= 0) return;
        this.timer -= dt;
        if (typeof Game === 'undefined' || !Game.player) return;
        const P = Game.player;
        const k = Math.min(1, dt * 7);
        this.cx += (P.x + P.w / 2 - this.cx) * k;
        this.cy += (P.y + P.h / 2 - this.cy) * k;
        this.x = this.cx;
        this.y = this.cy;
        if (this.timer > 0) WitchArt.overlay(this, this.cx, this.cy);
    }

    draw() {}

    _drawOverlay(ctx, camera) {
        if (this.timer <= 0) return;
        const fade = clamp(Math.min(this.timer / 0.4, (this.dur - this.timer) / 0.25), 0, 1);
        const p = camera.worldToScreen(this.cx, this.cy);
        const W = camera.width || 640, H = camera.height || 400;
        const t = Art.time;
        const prev = ctx.globalAlpha;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#12081f';
        // zwei Lagen mit Loch um Mark: weicher Übergang, außen am dunkelsten
        const layers = [[100, 0.5], [66, 0.4]];
        for (const [r, a] of layers) {
            ctx.globalAlpha = prev * a * fade;
            ctx.beginPath();
            ctx.rect(-40, -40, W + 80, H + 80);
            ctx.moveTo(p.x + r, p.y);
            ctx.arc(p.x, p.y, r, 0, TAU);
            ctx.fill('evenodd');
        }
        // kreisende Rauchbällchen
        ctx.globalAlpha = prev * 0.85 * fade;
        ctx.fillStyle = '#3d2266';
        ctx.strokeStyle = '#9a6be0';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
            const a = t * 1.6 + (i * TAU) / 7;
            const d = 40 + Math.sin(t * 3 + i * 1.7) * 6;
            const r = 9 + Math.sin(t * 4 + i) * 2.5;
            const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d * 0.75;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = prev * fade;
        for (let i = 0; i < 3; i++) {
            const a = -t * 2.2 + (i * TAU) / 3;
            Art.sparkle(ctx, p.x + Math.cos(a) * 34, p.y + Math.sin(a) * 26, 2.4, '#c79bff', 0.8);
        }
        ctx.restore();
        ctx.globalAlpha = prev;
    }
}

// ══════════════════════════════════════════
// ── Boss Welt 30: Metallarm-Hexe ──
// ══════════════════════════════════════════

// Alte, krumme Hexe (Hitbox 60×64, Zeichnung ~110 breit und ~135 hoch mit Hut). Humpelt mit ihrem
// Besen-Stock, hält Abstand. Ablauf: Intro → Humpeln → Angriff (Strahl / Salve, Phase 2 auch Rufen) → …
class BossOldWitch extends Enemy {
    constructor(x, y) {
        super(x, y, 60, 64);
        this.hp = 125;
        this.maxHp = 125;
        this.speed = 33;
        this.damage = 1;
        // wie der Drachenvater: ihre Gefahr ist die Magie, Freunde verschwinden im Kampf nie
        this.contactDamage = false;
        this.isBoss = true;
        this.fxColor = '#b884ff';
        this.shadow = { rx: 40, ry: 12 };
        this.seed = Math.random() * 10;
        this.phase = 1;
        this.cackled = false;
        this.t = 0;
        this.walkT = 0;
        this.moving = false;
        this.stepSign = 1;
        this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.face = -1;
        this.look = { x: -1, y: 0.3 };
        this.state = 'intro';
        this.stateT = 2;
        this.stateDur = 2;
        this.seq = 0;
        this.target = null;
        this.armA = Math.PI - 0.55;   // Richtung des Metallarms (Welt), Strahlrichtung beim Feuern
        this.beamFrom = 0;
        this.beamTo = 0;
        this.beamLen = 0;
        this.beamHit = [];
        this.volleyKind = 0;
        this.summoned = [];
        this.chargeLen = 0;
        this._m = { x: 0, y: 0 };
        this._s = { x: 0, y: 0 };
    }

    _set(state, dur) {
        this.state = state;
        this.stateT = dur;
        this.stateDur = dur;
    }

    takeDamage(amount, angle, force) {
        super.takeDamage(amount, angle, (force || 0) * 0.25);
    }

    update(dt, world, player, enemies, projectiles) {
        this.baseUpdate(dt, world);
        if (this.dead) return;
        this.t += dt;
        if (this.phase === 1 && this.hp <= this.maxHp / 2) this.phase = 2;
        this.stateT -= dt;
        this.moving = false;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        switch (this.state) {
            case 'intro':
                if (this.stateT <= 0) this._set('walk', 0.6);
                break;
            case 'walk':
                this._walk(dt, world, px, py);
                if (this.stateT <= 0) this._nextAttack(world, player);
                break;
            case 'charge':
                this._aimArm(world);
                if (this.stateT <= 0) this._startBeam(world);
                break;
            case 'beam':
                this._updateBeam(dt, world);
                if (this.stateT <= 0) {
                    this.beamLen = 0;
                    this._set('tired', this.phase === 2 ? 0.75 : 1.0);
                }
                break;
            case 'windup':
                if (this.stateT <= 0) this._throwVolley(projectiles, player);
                break;
            case 'cackle':
                if (this.stateT <= 0) {
                    this._summon(world, player);
                    this._set('recover', 0.4);
                }
                break;
            default:            // tired, recover, throw
                if (this.stateT <= 0) this._toWalk();
        }
        // Blick und Richtung (Arm in Ruhe hängt schräg nach vorn unten)
        if (this.state !== 'charge' && this.state !== 'beam') {
            const dx = px - this.centerX();
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
            this.armA = this.face > 0 ? 0.55 + Math.sin(this.t * 1.3) * 0.12 : Math.PI - 0.55 - Math.sin(this.t * 1.3) * 0.12;
        }
        const hx = this.centerX() + this.face * 6, hy = this.y + this.h - 74;
        const ld = Math.hypot(px - hx, py - hy) || 1;
        const k = Math.min(1, dt * 6);
        this.look.x += ((px - hx) / ld - this.look.x) * k;
        this.look.y += ((py - hy) / ld - this.look.y) * k;
        if (this.state === 'beam') WitchArt.overlay(this, px, py);
    }

    _toWalk() {
        if (this.phase === 2 && !this.cackled) {
            // Wechsel in Phase 2: Hexenlachen, dann ruft sie Hexenkinder
            this.cackled = true;
            this._set('cackle', 1.2);
            const x = this.centerX(), y = this.y + this.h - 70;
            DragonArt.shake(6, 0.45);
            DragonArt.burst(x, y, ['#7fd8ff', '#ff7a1f', '#b06bff', '#ffffff'], 18, 180, 0.6, { kind: 'star' });
            DragonArt.ring(x, this.y + this.h - 10, '#b884ff', 110, 0.5, 5);
            WitchArt.cackle();
            return;
        }
        this._set('walk', this.phase === 2 ? randRange(0.8, 1.1) : randRange(1.3, 1.7));
    }

    // Humpelt mit dem Besen-Stock: näher heran, zurück, sonst seitwärts
    _walk(dt, world, px, py) {
        const cx = this.centerX(), cy = this.centerY();
        const dx = px - cx, dy = py - cy;
        const d = Math.hypot(dx, dy) || 1;
        let vx, vy, sp = this.speed;
        if (d > 180) {
            vx = dx / d; vy = dy / d;
        } else if (d < 110) {
            vx = -dx / d; vy = -dy / d;
        } else {
            vx = (-dy / d) * this.strafe; vy = (dx / d) * this.strafe; sp *= 0.7;
        }
        this.walkT += dt;
        const s = Math.sin(this.walkT * 4);
        const v = sp * (0.45 + 1.0 * s * s);
        const ox = this.x, oy = this.y;
        this._moveWithCollision(vx * v * dt, vy * v * dt, world);
        if (Math.hypot(this.x - ox, this.y - oy) < v * dt * 0.3) this.strafe = -this.strafe;
        this.moving = true;
        const sign = s >= 0 ? 1 : -1;
        if (sign !== this.stepSign) {
            this.stepSign = sign;
            DragonArt.burst(cx - this.face * 22, this.y + this.h - 2, 'rgba(225,215,255,0.8)', 3, 40, 0.35, { kind: 'smoke', size: 3 });
        }
    }

    _aliveSummoned() {
        let n = 0;
        for (const k of this.summoned) if (!k.dead) n++;
        return n;
    }

    _nextAttack(world, player) {
        const i = this.seq++ % 3;
        if (i === 0) {
            this.target = this._pickTarget(world, player);
            this._prepBeam(world);
            this._set('charge', OLDWITCH_CHARGE);
        } else if (i === 2 && this.phase === 2 && this._aliveSummoned() < 2) {
            this._set('cackle', 1.0);
            WitchArt.cackle();
        } else {
            this.target = player;
            this._set('windup', 0.6);
        }
    }

    // Mark oder ein wacher, sichtbarer Freund
    _pickTarget(world, player) {
        const list = [player];
        const mx = this.centerX(), my = this.centerY();
        for (const c of WitchArt.companions()) {
            if (!WitchArt.companionOk(c)) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (Math.hypot(cx - mx, cy - my) > 420) continue;
            if (!WitchArt.lineClear(world, mx, my, cx, cy)) continue;
            list.push(c);
        }
        return list[Math.floor(Math.random() * list.length)];
    }

    // Schulter und Mündung des Metallarms in Weltkoordinaten
    _shoulder() {
        this._s.x = this.centerX() + this.face * OLDWITCH_SHOULDER_X;
        this._s.y = this.y + this.h + OLDWITCH_SHOULDER_Y;
        return this._s;
    }

    _muzzle(a) {
        const s = this._shoulder();
        this._m.x = s.x + Math.cos(a) * OLDWITCH_ARM;
        this._m.y = s.y + Math.sin(a) * OLDWITCH_ARM;
        return this._m;
    }

    // Strahl planen: beginnt neben dem Ziel und schwenkt quer darüber (Ausweichen: weg von der Schwenkrichtung
    // oder durchrollen). Richtung steht beim Aufladen schon fest, der Warnfächer zeigt den ganzen Weg.
    _prepBeam(world) {
        const tg = this.target;
        const s0 = this._shoulder();
        const tx = tg ? tg.x + tg.w / 2 : s0.x + this.face * 100, ty = tg ? tg.y + tg.h / 2 : s0.y + 60;
        this.face = tx >= this.centerX() ? 1 : -1;
        const s = this._shoulder();
        const a0 = Math.atan2(ty - s.y, tx - s.x);
        const half = this.phase === 2 ? 0.8 : 0.62;
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.beamFrom = a0 - dir * half;
        this.beamTo = a0 + dir * half;
        this.armA = this.beamFrom;
        this.beamHit.length = 0;
        this.beamLen = 0;
        const m = this._muzzle(this.beamFrom);
        this.chargeLen = DragonArt.beamLength(world, m.x, m.y, this.beamFrom, OLDWITCH_BEAM_MAX);
    }

    _aimArm() {
        // Arm zittert beim Aufladen leicht, bleibt aber auf der Startrichtung
        const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
        this.armA = this.beamFrom + Math.sin(this.t * 40) * 0.02 * k;
    }

    _beamDur() {
        return this.phase === 2 ? 1.5 : 2.1;
    }

    _startBeam() {
        this.armA = this.beamFrom;
        this._set('beam', this._beamDur());
        const m = this._muzzle(this.armA);
        DragonArt.shake(5, 0.35);
        DragonArt.burst(m.x, m.y, ['#ff6fe0', '#ffffff', '#b884ff'], 12, 150, 0.4, { kind: 'spark' });
        if (typeof Sound !== 'undefined' && Sound._play) {
            Sound._play(() => {
                Sound._tone('sawtooth', 180, 420, 0.5, 0.12, 0, 'lin');
                Sound._noiseBurst(0.8, 0.12, 'bandpass', 900);
            }, 'witchBeam', 400);
        }
    }

    _beamAngle() {
        const k = clamp(1 - this.stateT / this.stateDur, 0, 1);
        const e = k * k * (3 - 2 * k);
        return this.beamFrom + (this.beamTo - this.beamFrom) * e;
    }

    _updateBeam(dt, world) {
        this.armA = this._beamAngle();
        const m = this._muzzle(this.armA);
        const x0 = m.x, y0 = m.y;
        const full = DragonArt.beamLength(world, x0, y0, this.armA, OLDWITCH_BEAM_MAX);
        const grow = Math.min(1, (this.stateDur - this.stateT) / 0.12);
        this.beamLen = full * grow;
        if (typeof Game === 'undefined' || Game.world !== world) return;
        const x1 = x0 + Math.cos(this.armA) * this.beamLen, y1 = y0 + Math.sin(this.armA) * this.beamLen;
        const w = OLDWITCH_BEAM_W;
        const P = Game.player;
        if (P && !P.dead && this.beamHit.indexOf(P) < 0) {
            const px = P.x + P.w / 2, py = P.y + P.h / 2;
            const d = DragonArt.segDist(px, py, x0, y0, x1, y1, WITCH_TMP);
            if (d <= w / 2 + P.w / 2) {
                const ang = d > 0.5 ? Math.atan2(py - WITCH_TMP.y, px - WITCH_TMP.x) : this.armA + Math.PI / 2;
                const before = P.hp;
                DragonArt.hurt(P, OLDWITCH_BEAM_DMG, ang, 240);
                if (P.hp < before) {
                    this.beamHit.push(P);
                    DragonArt.burst(px, py, ['#ff6fe0', '#ffffff'], 10, 140, 0.45, { kind: 'star' });
                }
            }
        }
        for (const c of WitchArt.companions()) {
            if (!WitchArt.companionOk(c) || c.iFrames > 0 || this.beamHit.indexOf(c) >= 0) continue;
            const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
            if (DragonArt.segDist(cx, cy, x0, y0, x1, y1) > w / 2 + Math.max(c.w, c.h) / 2) continue;
            this.beamHit.push(c);
            // Freunde verschwinden nie durch den Strahl: statt besiegt nur umgehauen
            WitchArt.hitCompanion(c, OLDWITCH_BEAM_DMG, 8);
            DragonArt.burst(cx, cy, ['#ff6fe0', '#ffffff'], 10, 140, 0.45, { kind: 'star' });
        }
        // Funken, wo der Strahl auf die Wand trifft
        if (Math.random() < dt * 20) DragonArt.burst(x1, y1, ['#ff6fe0', '#ffffff'], 2, 90, 0.3, { kind: 'spark' });
    }

    // Spitze des Besen-Stocks (Weltkoordinaten), passt zur Zeichnung beim Ausholen
    _broomTop() {
        this._m.x = this.centerX() - this.face * 30;
        this._m.y = this.y + this.h - 96;
        return this._m;
    }

    // Hexen-Salve: Eis-, Feuer- und Schattenkugeln im Fächer (Phase 2: fünf)
    _throwVolley(projectiles, player) {
        const list = projectiles || (typeof Game !== 'undefined' ? Game.projectiles : null);
        const o = this._broomTop();
        const ox = o.x, oy = o.y;
        const tg = this.target && !this.target.dead ? this.target : player;
        const a0 = Math.atan2(tg.y + tg.h / 2 - oy, tg.x + tg.w / 2 - ox);
        const n = this.phase === 2 ? 5 : 3;
        const gap = this.phase === 2 ? 0.24 : 0.3;
        for (let i = 0; i < n; i++) {
            const kind = WITCH_KINDS[(this.volleyKind + i) % 3];
            if (list) list.push(new WitchBolt(ox, oy, a0 + (i - (n - 1) / 2) * gap, kind, true));
        }
        this.volleyKind = (this.volleyKind + 1) % 3;
        DragonArt.burst(ox, oy, ['#7fd8ff', '#ff7a1f', '#b06bff', '#ffffff'], 10, 120, 0.4, { kind: 'star' });
        this._set('throw', 0.5);
    }

    // Ruft 2–3 Hexenkinder in den Boss-Raum (höchstens 3 gleichzeitig, nur im echten Bosskampf)
    _summon(world, player) {
        if (typeof Game === 'undefined' || !Game.bossActive || Game.world !== world || !Game._bossRoomRect || !Game.enemies) return;
        const room = Game._bossRoomRect();
        const want = Math.min(3 - this._aliveSummoned(), randInt(2, 3));
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        for (let i = 0; i < want; i++) {
            for (let tries = 0; tries < 25; tries++) {
                const x = room.x + 20 + Math.random() * (room.w - 40);
                const y = room.y + 20 + Math.random() * (room.h - 40);
                if (Math.hypot(x - px, y - py) < 90 || Math.hypot(x - this.centerX(), y - this.centerY()) < 55) continue;
                if (world.isWall(x - 12, y - 13) || world.isWall(x + 12, y - 13) || world.isWall(x - 12, y + 13) || world.isWall(x + 12, y + 13)) continue;
                const kid = new WitchKid(x, y);
                kid.summoner = this;
                kid.engaged = true;
                kid.castT = randRange(1.2, 2.2);
                Game.enemies.push(kid);
                this.summoned.push(kid);
                DragonArt.burst(x, y, [kid.pal.glow, '#ffffff', '#b884ff'], 12, 120, 0.5, { kind: 'star' });
                DragonArt.ring(x, y + 8, kid.pal.glow, 26, 0.4, 3);
                break;
            }
        }
    }

    // ── Zeichnen ──

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        ctx.save();
        ctx.translate(pos.x + this.w / 2, pos.y + this.h);
        if (this.dead) this._drawDead(ctx);
        else this._drawAlive(ctx);
        ctx.restore();
    }

    _drawAlive(ctx) {
        const t = Art.time, st = this.state, p2 = this.phase === 2, f = this.face;
        const k = this.stateDur > 0 ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        const step = this.moving ? Math.sin(this.walkT * 4) : 0;
        const bob = this.moving ? -Math.abs(step) * 3 : Math.sin(t * 1.5 + this.seed) * 1.2;
        const cackle = st === 'cackle' ? Math.abs(Math.sin(t * 14)) : 0;
        const tired = st === 'tired';
        const lean = (tired ? 0.08 : 0) + cackle * 0.05 - step * 0.03;
        ctx.save();
        ctx.rotate(-f * lean);
        this._broom(ctx, f, bob, st, k, t);
        this._hairBack(ctx, f, bob, t, p2);
        this._robe(ctx, f, bob, t);
        this._head(ctx, f, bob, st, p2, cackle, false);
        this._hat(ctx, f, bob - cackle * 3, t, false);
        ctx.restore();
        // Metallarm vorne (ohne Neigung, damit der Strahl genau an der Mündung beginnt)
        const ck = st === 'charge' ? k : (st === 'beam' ? 1 : 0);
        this._metalArm(ctx, f, this._armLocal(), ck, p2, tired, false);
    }

    // Armwinkel in Zeichenkoordinaten (gleich wie Welt, da nicht gespiegelt wird)
    _armLocal() {
        return this.armA;
    }

    // Besen als Stock in der hinteren Hand; beim Ausholen (Salve) über den Kopf gehoben
    _broom(ctx, f, bob, st, k, t) {
        const raise = st === 'windup' ? Math.min(1, k * 1.6) : (st === 'throw' ? 1 - k : 0);
        const bx = -f * (26 + raise * 4), byTop = -70 - raise * 26 + bob, byBot = -raise * 26 - 2;
        // hintere Hand (normaler, dünner Arm)
        const hx = -f * 24, hy = -40 - raise * 22 + bob;
        Art.limb(ctx, -f * 12, -54 + bob, hx, hy, 6, OLDWITCH_ROBE, { lineWidth: 1.8 });
        // Stiel
        ctx.strokeStyle = '#4a2a14';
        ctx.lineWidth = 5.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, byTop);
        ctx.quadraticCurveTo(bx - f * 3, (byTop + byBot) / 2, bx + f * 1, byBot - 10);
        ctx.stroke();
        ctx.strokeStyle = '#8a5a2e';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Reisigbündel unten
        Art.shape(ctx, c => {
            c.moveTo(bx + f * 1 - 4, byBot - 14);
            c.lineTo(bx + f * 1 + 4, byBot - 14);
            c.lineTo(bx + f * 1 + 9, byBot + 2);
            c.lineTo(bx + f * 1 - 9, byBot + 2);
            c.closePath();
        }, { x: bx - 9, y: byBot - 14, w: 18, h: 16 }, '#e8b85a', { lineWidth: 1.6 });
        ctx.strokeStyle = '#b07a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
            ctx.moveTo(bx + f * 1 + i * 2, byBot - 12);
            ctx.lineTo(bx + f * 1 + i * 5, byBot + 1);
        }
        ctx.stroke();
        Art.body(ctx, bx + f * 0.5, byBot - 14, 5, 2, '#c0392b', { lineWidth: 1.2, highlight: false });
        // Hand am Stiel
        Art.body(ctx, hx, hy, 4.5, 4, OLDWITCH_SKIN, { lineWidth: 1.6, highlight: false });
        // beim Ausholen leuchtet oben ein Dreifarben-Zauber
        if (raise > 0) {
            const gx = bx, gy = byTop - 4;
            Art.glow(ctx, gx, gy, 10 + raise * 14, '#b06bff', 0.4 + raise * 0.4);
            for (let i = 0; i < 3; i++) {
                const a = t * 7 + (i * TAU) / 3;
                Art.sparkle(ctx, gx + Math.cos(a) * 9, gy + Math.sin(a) * 6, 3.2, WITCH_PAL[WITCH_KINDS[i]].glow, raise);
            }
        }
    }

    // langes, wildes graues Haar hinter Kopf und Schultern
    _hairBack(ctx, f, bob, t, p2) {
        const fl = p2 ? Math.sin(t * 9) * 2 : Math.sin(t * 2) * 1;
        Art.shape(ctx, c => {
            c.moveTo(-f * 2 - 14, -84 + bob);
            c.quadraticCurveTo(-f * 18 - 8, -70 + bob, -f * 20 - 6 + fl, -46 + bob);
            c.lineTo(-f * 12 - 4, -52 + bob);
            c.lineTo(-f * 14 + fl, -40 + bob);
            c.lineTo(-f * 4, -50 + bob);
            c.lineTo(f * 6, -46 + bob - fl);
            c.quadraticCurveTo(f * 16, -64 + bob, f * 8 + 6, -84 + bob);
            c.closePath();
        }, { x: -28, y: -86, w: 56, h: 46 }, OLDWITCH_HAIR, { lineWidth: 1.8 });
    }

    // Kleid und Umhang mit Flicken und Zackensaum, Gürtel mit Schnalle
    _robe(ctx, f, bob, t) {
        const sw = Math.sin(t * 2.4 + this.seed) * 1.5;
        Art.shape(ctx, c => {
            c.moveTo(-14, -60 + bob);
            c.quadraticCurveTo(0, -64 + bob, 14, -60 + bob);
            c.quadraticCurveTo(24, -30, 30 + sw, -3);
            c.lineTo(22, -7);
            c.lineTo(15, -1);
            c.lineTo(8, -6);
            c.lineTo(0, 0);
            c.lineTo(-8, -6);
            c.lineTo(-15, -1);
            c.lineTo(-22, -7);
            c.lineTo(-30 - sw, -3);
            c.quadraticCurveTo(-24, -30, -14, -60 + bob);
            c.closePath();
        }, { x: -30, y: -64, w: 60, h: 64 }, OLDWITCH_ROBE, { lineWidth: 2.2 });
        // Flicken
        Art.box(ctx, -f * 14 - 5, -24, 10, 9, 1.5, '#4fbf7a', { lineWidth: 1.4, highlight: false });
        ctx.strokeStyle = '#2a6a3f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-f * 14 - 3, -22);
        ctx.lineTo(-f * 14 - 1, -20);
        ctx.moveTo(-f * 14 + 1, -18);
        ctx.lineTo(-f * 14 + 3, -16);
        ctx.stroke();
        // Gürtel mit goldener Schnalle
        Art.box(ctx, -17, -38 + bob * 0.6, 34, 6, 2, '#2e1a40', { lineWidth: 1.4, highlight: false });
        Art.box(ctx, -4, -39.5 + bob * 0.6, 8, 9, 1.5, OLDWITCH_BRASS, { lineWidth: 1.4 });
        ctx.fillStyle = '#2e1a40';
        ctx.fillRect(-1.8, -37 + bob * 0.6, 3.6, 4);
        // Füße mit Schnabelschuhen
        ctx.fillStyle = '#2a1a36';
        ctx.beginPath();
        for (let i = -1; i <= 1; i += 2) {
            const x = i * 9;
            ctx.moveTo(x - 6, 0);
            ctx.quadraticCurveTo(x, -5, x + 6, -1);
            ctx.quadraticCurveTo(x + f * 9, -3, x + f * 10, -6);
            ctx.quadraticCurveTo(x + f * 6, 1, x - 6, 0);
        }
        ctx.fill();
    }

    // Kopf: grünliche Haut, krumme Nase mit Warze, spitzes Kinn, Augen, Grinsen mit einem Zahn
    _head(ctx, f, bob, st, p2, cackle, dead) {
        const hx = f * 4, hy = -74 + bob;
        Art.body(ctx, hx, hy, 14, 13, OLDWITCH_SKIN, { lineWidth: 2 });
        // spitzes Kinn
        Art.shape(ctx, c => {
            c.moveTo(hx - 6 + f * 2, hy + 9);
            c.quadraticCurveTo(hx + f * 8, hy + 22, hx + f * 10, hy + 15);
            c.quadraticCurveTo(hx + f * 12, hy + 8, hx + f * 6, hy + 9);
            c.closePath();
        }, { x: hx - 8, y: hy + 8, w: 20, h: 14 }, OLDWITCH_SKIN, { lineWidth: 1.6, highlight: false });
        // Augen
        const ex = hx + f * 1, ey = hy - 3;
        if (dead) {
            Juri.spiralEye(ctx, ex - 5.5, ey, 3.6, Art.time * 7);
            Juri.spiralEye(ctx, ex + 5.5, ey, 3.6, -Art.time * 7);
        } else if (cackle > 0) {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(ex - 5.5, ey + 1, 3, Math.PI + 0.3, TAU - 0.3);
            ctx.moveTo(ex + 5.5 + 3 * Math.cos(Math.PI + 0.3), ey + 1 + 3 * Math.sin(Math.PI + 0.3));
            ctx.arc(ex + 5.5, ey + 1, 3, Math.PI + 0.3, TAU - 0.3);
            ctx.stroke();
        } else {
            Art.eyes(ctx, ex, ey, 3.8, {
                gap: 5.5, look: this.look, iris: p2 ? '#ff3d5a' : '#ffd23f', angry: true, seed: this.seed,
                open: st === 'tired' ? 0.5 : 1,
            });
        }
        // krumme Nase mit Warze
        Art.shape(ctx, c => {
            c.moveTo(hx + f * 3, hy - 1);
            c.quadraticCurveTo(hx + f * 15, hy - 1, hx + f * 17, hy + 7);
            c.quadraticCurveTo(hx + f * 11, hy + 5, hx + f * 4, hy + 5);
            c.closePath();
        }, { x: hx - 1, y: hy - 2, w: 18, h: 10 }, Art.dark(OLDWITCH_SKIN, 0.05), { lineWidth: 1.6 });
        Art.body(ctx, hx + f * 11, hy + 1.5, 1.6, 1.5, '#7a9a4a', { lineWidth: 0.8, highlight: false });
        // Mund
        const mx = hx + f * 2, my = hy + 9;
        if (dead || cackle > 0 || st === 'cackle') {
            Art.mouth(ctx, mx, my - 1, 9, 'open');
        } else if (st === 'tired') {
            Art.mouth(ctx, mx, my, 6, 'o');
        } else {
            ctx.strokeStyle = Art.INK;
            ctx.lineWidth = 1.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(mx - 5, my - 1);
            ctx.quadraticCurveTo(mx, my + 3, mx + 5, my - 1.5);
            ctx.stroke();
            // ein einzelner Zahn
            ctx.fillStyle = '#fffbe8';
            ctx.fillRect(mx + f * 1.2 - 1.2, my, 2.4, 2.6);
        }
    }

    // Großer, krummer Spitzhut mit breiter Krempe, Band, Schnalle und Flicken
    _hat(ctx, f, bob, t, dead) {
        const hx = f * 3, hy = -84 + bob;
        const tilt = dead ? 0.5 : 0;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(-f * (0.1 + tilt));
        const sw = Math.sin(t * 1.8 + this.seed) * 2;
        Art.shape(ctx, c => {
            c.moveTo(-16, 0);
            c.quadraticCurveTo(-10, -26, -f * 4 - 2, -42);
            c.quadraticCurveTo(-f * 14, -52 + sw, -f * 26, -44 + sw);
            c.quadraticCurveTo(-f * 12, -42, f * 4 + 4, -32);
            c.quadraticCurveTo(12, -14, 16, 0);
            c.closePath();
        }, { x: -26, y: -52, w: 52, h: 52 }, OLDWITCH_HAT, { lineWidth: 2.2 });
        // Flicken am Hut
        Art.box(ctx, f * 2 - 4, -22, 8, 7, 1.2, '#e05a8a', { lineWidth: 1.2, highlight: false });
        // Krempe
        Art.body(ctx, 0, 0, 27, 6, OLDWITCH_HAT, { lineWidth: 2.2, highlight: false });
        // Band mit Schnalle
        ctx.fillStyle = '#7dff6a';
        ctx.beginPath();
        ctx.moveTo(-15.5, -2);
        ctx.lineTo(15.5, -2);
        ctx.lineTo(14.2, -7.5);
        ctx.lineTo(-14.2, -7.5);
        ctx.closePath();
        ctx.fill();
        Art.box(ctx, -4, -8.5, 8, 7.5, 1.2, OLDWITCH_BRASS, { lineWidth: 1.2, highlight: false });
        ctx.fillStyle = '#41297a';
        ctx.fillRect(-1.6, -6.5, 3.2, 3.5);
        ctx.restore();
    }

    // Metallarm: Schulterpanzer mit Nieten, Oberarm, Zahnrad-Ellbogen, Unterarm und Kristall-Kanone.
    // a = Armrichtung, ck = Aufladen 0..1 (1 = feuert).
    _metalArm(ctx, f, a, ck, p2, tired, dead) {
        const sx = f * OLDWITCH_SHOULDER_X, sy = OLDWITCH_SHOULDER_Y;
        const t = Art.time;
        const crys = p2 ? '#ff4fa8' : '#ff6fe0';
        ctx.save();
        ctx.translate(sx, sy);
        // Oberarm und Unterarm entlang der Armrichtung
        ctx.save();
        ctx.rotate(a);
        const shake = ck > 0 && ck < 1 ? Math.sin(t * 60) * 0.6 * ck : 0;
        ctx.translate(shake, 0);
        Art.box(ctx, 4, -6.5, 22, 13, 4, OLDWITCH_STEEL, { lineWidth: 2 });
        Art.box(ctx, 30, -5.5, 16, 11, 3, OLDWITCH_STEEL, { lineWidth: 2 });
        // Kanone mit Messingring
        Art.box(ctx, 44, -8.5, 11, 17, 3, OLDWITCH_STEEL_D, { lineWidth: 2 });
        Art.box(ctx, 43, -9.5, 3.5, 19, 1.5, OLDWITCH_BRASS, { lineWidth: 1.4, highlight: false });
        // Nieten
        ctx.fillStyle = '#eef3fa';
        ctx.beginPath();
        for (const [x, y] of [[10, -3.2], [20, -3.2], [10, 3.2], [20, 3.2], [38, 0], [50, -5], [50, 5]]) {
            ctx.moveTo(x + 1.1, y);
            ctx.arc(x, y, 1.1, 0, TAU);
        }
        ctx.fill();
        // Zahnrad am Ellbogen (dreht sich)
        ctx.save();
        ctx.translate(28, 0);
        ctx.rotate(t * (ck > 0 ? 8 : 1.5));
        ctx.fillStyle = OLDWITCH_BRASS;
        ctx.strokeStyle = Art.ink(OLDWITCH_BRASS);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a0 = (i * TAU) / 8;
            ctx.lineTo(Math.cos(a0 - 0.18) * 8, Math.sin(a0 - 0.18) * 8);
            ctx.lineTo(Math.cos(a0 + 0.18) * 8, Math.sin(a0 + 0.18) * 8);
            ctx.lineTo(Math.cos(a0 + 0.42) * 6.4, Math.sin(a0 + 0.42) * 6.4);
            ctx.lineTo(Math.cos(a0 + 0.36 + TAU / 16) * 6.4, Math.sin(a0 + 0.36 + TAU / 16) * 6.4);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = OLDWITCH_STEEL_D;
        ctx.beginPath();
        ctx.arc(0, 0, 2.6, 0, TAU);
        ctx.fill();
        ctx.restore();
        // Kristall in der Mündung
        const mx = OLDWITCH_ARM - 1;
        if (ck > 0 || p2) Art.glow(ctx, mx, 0, 10 + ck * 22, crys, 0.35 + ck * 0.6);
        Art.shape(ctx, c => {
            c.moveTo(mx + 5, 0);
            c.lineTo(mx, -5);
            c.lineTo(mx - 4, 0);
            c.lineTo(mx, 5);
            c.closePath();
        }, { x: mx - 4, y: -5, w: 9, h: 10 }, dead ? '#9a8aa8' : crys, { lineWidth: 1.4, glossy: true, outline: '#7a1a5a' });
        if (ck > 0 && !dead) {
            // Lade-Funken werden in die Mündung gesaugt
            for (let i = 0; i < 4; i++) {
                const q = 1 - ((t * 2.2 + i / 4) % 1);
                const aa = i * 1.7 + this.seed;
                Art.sparkle(ctx, mx + Math.cos(aa) * 22 * q, Math.sin(aa) * 22 * q, 2.4, '#ffffff', ck * (1 - q * 0.5));
            }
            Art.ring(ctx, mx, 0, 4 + (1 - ck) * 16, crys, 2, ck);
        }
        ctx.restore();
        // Schulterpanzer obendrauf
        Art.body(ctx, 0, 0, 11, 9, OLDWITCH_STEEL, { lineWidth: 2 });
        ctx.fillStyle = '#eef3fa';
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const aa = Math.PI + 0.4 + i * 0.75;
            const x = Math.cos(aa) * 7.5, y = Math.sin(aa) * 6;
            ctx.moveTo(x + 1.1, y);
            ctx.arc(x, y, 1.1, 0, TAU);
        }
        ctx.fill();
        // Dampf nach dem Strahl / Funken in Phase 2
        if (tired && !dead) {
            const prev = ctx.globalAlpha;
            ctx.fillStyle = '#eceaf5';
            for (let i = 0; i < 3; i++) {
                const q = (t * 1.3 + i / 3) % 1;
                ctx.globalAlpha = prev * (1 - q) * 0.7;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * 50 + Math.sin(i * 2 + t) * 3, Math.sin(a) * 50 - 6 - q * 22, 3 + q * 5, 0, TAU);
                ctx.fill();
            }
            ctx.globalAlpha = prev;
        } else if (p2 && !dead) {
            const q = (t * 3) % 1;
            Art.sparkle(ctx, Math.cos(a) * 28 + q * 6, Math.sin(a) * 28 - q * 8, 2.2 * (1 - q) + 0.5, '#ffe066', 1 - q);
        }
        ctx.restore();
    }

    // Besiegt: setzt sich benommen hin (Spiralaugen, Hut schief, Arm hängt), dann eine Wolke aus Funkeln
    _drawDead(ctx) {
        const k = clamp(this.deathProgress(), 0, 1);
        const t = Art.time, a0 = ctx.globalAlpha, f = this.face;
        const s = Math.max(0.05, 1 - k * k * 0.95);
        ctx.save();
        ctx.globalAlpha = a0 * clamp(1.25 - k * 1.2, 0, 1);
        ctx.scale(s, s * 0.92);
        ctx.translate(0, 6);
        this._broom(ctx, f, 6, 'dead', 0, t);
        this._hairBack(ctx, f, 6, t, false);
        this._robe(ctx, f, 6, t);
        this._head(ctx, f, 6, 'dead', false, 0, true);
        this._hat(ctx, f, 6, t, true);
        this._metalArm(ctx, f, f > 0 ? 1.45 : Math.PI - 1.45, 0, false, false, true);
        ctx.restore();
        for (let j = 0; j < 3; j++) {
            const a = t * 4.5 + (j * TAU) / 3;
            Art.star(ctx, (f * 4 + Math.cos(a) * 18) * s, (-96 + Math.sin(a) * 5) * s, 3 * s + 1.2, '#ffe35a', { lineWidth: 1.1, outline: '#a86a00' });
        }
        if (k > 0.05) {
            ctx.globalAlpha = a0 * (1 - k) * 0.8;
            ctx.fillStyle = '#f4efff';
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const a = Math.PI * (1.02 + i * 0.16);
                const d = 18 + k * 46, r = 8 + k * 13;
                const x = Math.cos(a) * d * 1.2, y = -46 + Math.sin(a) * d * 0.8;
                ctx.moveTo(x + r, y);
                ctx.arc(x, y, r, 0, TAU);
            }
            ctx.fill();
            ctx.globalAlpha = a0;
            for (let i = 0; i < 6; i++) {
                const a = i * 1.05 + k * 2;
                const col = WITCH_PAL[WITCH_KINDS[i % 3]].glow;
                Art.sparkle(ctx, Math.cos(a) * (22 + k * 56), -56 + Math.sin(a) * (18 + k * 40), 5 * (1 - k) + 1.5, col, 1 - k);
            }
        }
        ctx.globalAlpha = a0;
    }

    // Riesen-Magiestrahl (über allen Figuren, aus WitchArt.overlay)
    _drawOverlay(ctx, camera) {
        if (this.dead || this.state !== 'beam' || this.beamLen < 1) return;
        const t = Art.time;
        const fade = this.stateT < 0.15 ? clamp(this.stateT / 0.15, 0, 1) : 1;
        const w = OLDWITCH_BEAM_W * (0.5 + 0.5 * fade) * (1 + Math.sin(t * 38) * 0.06);
        const L = this.beamLen;
        const m = this._muzzle(this.armA);
        const p = camera.worldToScreen(m.x, m.y);
        const col = this.phase === 2 ? '#ff4fa8' : '#c86bff', glow = this.phase === 2 ? '#ff5f9a' : '#ff6fe0';
        const prev = ctx.globalAlpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(this.armA);
        ctx.fillStyle = glow;
        ctx.globalAlpha = prev * 0.25 * fade;
        ctx.beginPath();
        ctx.roundRect(-w * 0.2, -w * 0.95, L + w * 0.4, w * 1.9, w * 0.95);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.globalAlpha = prev * 0.9 * fade;
        ctx.beginPath();
        ctx.roundRect(0, -w / 2, L, w, w / 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = prev * fade;
        ctx.beginPath();
        ctx.roundRect(0, -w * 0.18, L, w * 0.36, w * 0.18);
        ctx.fill();
        // Zauber-Ringe und Sterne wandern im Strahl nach vorn (Eis-, Feuer-, Schattenfarben)
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
            const x = ((t * 1.6 + i / 6) % 1) * L;
            ctx.strokeStyle = WITCH_PAL[WITCH_KINDS[i % 3]].glow;
            ctx.globalAlpha = prev * 0.85 * fade;
            ctx.beginPath();
            ctx.ellipse(x, 0, 3, w * 0.55, 0, 0, TAU);
            ctx.stroke();
        }
        ctx.globalAlpha = prev * fade;
        for (let i = 0; i < 5; i++) {
            const x = ((t * 0.9 + i / 5 + this.seed) % 1) * L;
            Art.sparkle(ctx, x, Math.sin(t * 7 + i * 1.7) * w * 0.3, 3 + 2 * Math.abs(Math.sin(t * 9 + i)), '#ffffff', 1);
        }
        ctx.restore();
        ctx.globalAlpha = prev;
        const ex = p.x + Math.cos(this.armA) * L, ey = p.y + Math.sin(this.armA) * L;
        Art.glow(ctx, p.x, p.y, w * 1.5, glow, 0.85 * fade);
        Art.glow(ctx, ex, ey, w * 1.6, glow, 0.9 * fade);
        Art.sparkle(ctx, ex, ey, w * 0.5, '#ffffff', fade);
    }

    // ── Bodenwarnungen (unter allen Figuren) ──
    // Beim Aufladen: Fächer über den ganzen Schwenkweg, die Startlinie blinkt rot, Pfeile zeigen die Richtung.
    drawUnder(ctx, camera) {
        if (this.dead || (this.state !== 'charge' && this.state !== 'beam')) return;
        const t = Art.time;
        const s = this._shoulder();
        const p = camera.worldToScreen(s.x, s.y);
        const R = OLDWITCH_BEAM_MAX * 0.75;
        const a0 = this.beamFrom, a1 = this.beamTo;
        const ccw = a1 < a0;
        const k = this.state === 'charge' ? clamp(1 - this.stateT / this.stateDur, 0, 1) : 1;
        ctx.save();
        // Fächer
        ctx.fillStyle = '#ff6fe0';
        ctx.globalAlpha = this.state === 'charge' ? 0.08 + 0.1 * k : 0.06;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, R, a0, a1, ccw);
        ctx.closePath();
        ctx.fill();
        if (this.state === 'charge') {
            // Startlinie (so breit wie der Strahl)
            const m = this._muzzle(a0);
            const mp = camera.worldToScreen(m.x, m.y);
            const len = Math.max(20, this.chargeLen || R - OLDWITCH_ARM);
            ctx.save();
            ctx.translate(mp.x, mp.y);
            ctx.rotate(a0);
            ctx.fillStyle = '#ff6fe0';
            ctx.globalAlpha = 0.12 + 0.22 * k;
            ctx.beginPath();
            ctx.roundRect(0, -OLDWITCH_BEAM_W / 2, Math.max(OLDWITCH_BEAM_W, len * k), OLDWITCH_BEAM_W, OLDWITCH_BEAM_W / 2);
            ctx.fill();
            ctx.strokeStyle = '#ff3d5a';
            ctx.lineWidth = 2;
            ctx.globalAlpha = k > 0.7 ? 0.6 + 0.4 * Math.abs(Math.sin(t * 22)) : 0.35 + 0.3 * Math.abs(Math.sin(t * 9));
            ctx.beginPath();
            ctx.roundRect(0, -OLDWITCH_BEAM_W / 2, len, OLDWITCH_BEAM_W, OLDWITCH_BEAM_W / 2);
            ctx.stroke();
            ctx.restore();
            // Bogen mit Pfeilspitze in Schwenkrichtung
            const r = 70;
            ctx.strokeStyle = '#ff3d5a';
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(t * 8));
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, a0, a1, ccw);
            const ex = p.x + Math.cos(a1) * r, ey = p.y + Math.sin(a1) * r;
            const dir = ccw ? -1 : 1;
            const tx = -Math.sin(a1) * dir, ty = Math.cos(a1) * dir;   // Tangente in Schwenkrichtung
            const nx = Math.cos(a1), ny = Math.sin(a1);
            ctx.moveTo(ex - tx * 7 + nx * 5, ey - ty * 7 + ny * 5);
            ctx.lineTo(ex, ey);
            ctx.lineTo(ex - tx * 7 - nx * 5, ey - ty * 7 - ny * 5);
            ctx.stroke();
            // Pfeil über dem Ziel
            const tg = this.target;
            if (tg && !tg.dead && !(tg.koTimer > 0)) {
                const ap = camera.worldToScreen(tg.x + tg.w / 2, tg.y - 14 + Math.sin(t * 9) * 2.5);
                ctx.globalAlpha = 0.95;
                ctx.fillStyle = '#ff3d5a';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.4;
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(ap.x - 5.5, ap.y - 6.5);
                ctx.lineTo(ap.x + 5.5, ap.y - 6.5);
                ctx.lineTo(ap.x, ap.y + 1);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
