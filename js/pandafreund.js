// ── Der kleine Panda: Marks vierter Freund (Belohnung für Welt 47) ──
// Eigener Freund nach dem Vorbild von Juri und Schatten-Krokodil (js/entities.js): er rollt mit Mark
// mit, schießt aus seinem Bambusrohr Pflanzen auf Gegner und die vergiften sie über ein paar Sekunden.
// Er kann betäubt, vergiftet, eingeschlafen und k.o. werden; nach dem k.o. steht er wieder auf.
// Bei null Leben verschwindet er für den Rest der Welt – genau wie Juri und das Schatten-Krokodil.
// Angemeldet wird er in js/main.js (startWorld), im Karussell (js/ui.js) und als Power-Figur (js/progress.js).

// Wirkung der Bambus-Pflanzen – Gift über Zeit, wie Marks Gift-Würfe (BaseballLauncher in js/weapons.js)
const PANDA_POISON_SECONDS = 3;    // so lange brennt das Gift einer Pflanze nach
const PANDA_POISON_TICK = 0.5;     // alle halben Sekunden zieht es Leben ab
const PANDA_POISON_DAMAGE = 1;     // 1/4 Herz je Tropfen
// Öffnung des Bambuohrs, lokal zum Mittelpunkt der Figur (x wird mit der Blickrichtung gespiegelt)
const PANDA_TUBE = { x: -9, y: -12.5 };

// Eine Pflanze aus dem Rohr: ganz normales Spieler-Geschoss (Fliegen, Wand, Treffer und Schaden
// passieren in js/main.js), nur das Aussehen ist ein rollendes Saatkapfel mit zwei Blättern.
class PandaPlant extends Projectile {
    constructor(x, y, vx, vy, damage) {
        super(x, y, vx, vy, damage, 'player', 90);
        this.radius = 4;
        this.poison = true;       // Gift-Optik (js/weapons.js) und die Wirkung gleich unten
        this.pandaPlant = true;   // daran erkennt js/main.js: dieser Treffer vergiftet
        this.poisonSeconds = PANDA_POISON_SECONDS;
        this.poisonDamage = PANDA_POISON_DAMAGE;   // 1/4 Herz je Tropfen, wirkt in js/main.js
        this.seed = Math.random() * 10;
    }

    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const x = pos.x, y = pos.y;
        const r = this.radius || 4;
        const sp = Math.hypot(this.vx, this.vy);
        const dx = sp > 1 ? this.vx / sp : 1;
        const dy = sp > 1 ? this.vy / sp : 0;
        const age = this.age || 0;
        this._streak(ctx, x, y, dx, dy, r * 0.7, r * 3.2, '#9dff72', 0.4);
        Art.glow(ctx, x, y, r * 3, '#6bff5a', 0.6);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(age * 11 + this.seed);
        // Kapfel mit Längsstreifen
        Art.body(ctx, 0, 0, r * 0.95, r * 1.1, '#c8f07a', { glossy: true, outline: '#3f7a1f', lineWidth: 1 });
        ctx.strokeStyle = 'rgba(63,122,31,0.55)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.85);
        ctx.quadraticCurveTo(-r * 0.1, 0, -r * 0.45, r * 0.85);
        ctx.moveTo(r * 0.45, -r * 0.85);
        ctx.quadraticCurveTo(r * 0.1, 0, r * 0.45, r * 0.85);
        ctx.stroke();
        // zwei Blätter, die im Flug rotieren
        for (let i = 0; i < 2; i++) {
            const a = i * Math.PI;
            const lx = Math.cos(a) * r * 1.35, ly = Math.sin(a) * r * 1.35;
            Art.shape(ctx, c => {
                c.moveTo(lx * 0.45, ly * 0.45);
                c.quadraticCurveTo(lx * 1.1 - ly * 0.28, ly * 1.1 + lx * 0.28, lx * 1.5, ly * 1.5);
                c.quadraticCurveTo(lx * 1.1 + ly * 0.28, ly * 1.1 - lx * 0.28, lx * 0.45, ly * 0.45);
                c.closePath();
            }, { x: Math.min(lx * 0.45, lx * 1.5), y: Math.min(ly * 0.45, ly * 1.5), w: Math.abs(lx) + r, h: Math.abs(ly) + r },
                '#5fe04a', { outline: '#1f7a2a', lineWidth: 0.9, flat: true });
        }
        ctx.restore();
    }
}

class PandaBuddy {
    constructor(x, y) {
        this.x = x; this.y = y; this.w = 26; this.h = 24;
        this.hp = 16; this.maxHp = 16; // 4 Herzen
        this.speed = 125; this.damage = 3;
        this.dead = false; this.iFrames = 0; this.hitFlash = 0;
        this.shootTimer = 0; this.shootCooldown = 1.4; this.range = 210;
        this.puffTimer = 0;        // > 0: Rohr hat gerade gespuckt (Ruck, offenes Maul)
        this.target = null; this.facingAngle = 0;
        // Anzeige: Blickrichtung, Rollen, Rohr in Zielrichtung
        this.faceX = 1; this.moving = false; this.walkT = 0;
        this.aimX = 1; this.aimY = -0.3;
        this.stuckTimer = 0;
        this.poisonTimer = 0; this.poisonTick = 0;   // > 0: vergiftet (zieht Leben ab, kein Tempo-Abzug)
        this.sleepTimer = 0; this.sleepGuard = 0;    // > 0: eingeschlafen, danach Schonzeit gegen neues sleep
        this.seed = Math.random() * 10;
        this.stunTimer = 0;   // > 0: betäubt (z. B. vom Hammer des Riesen-Zombies)
        this.koTimer = 0;     // > 0: k.o. am Boden (Drachenstrahl), steht danach mit halben LP auf
        this.koDur = 0;
    }
    centerX() { return this.x + this.w / 2; }
    centerY() { return this.y + this.h / 2; }

    takeDamage(amount) {
        if (this.iFrames > 0 || this.dead || this.koTimer > 0) return;
        this.hp -= amount; this.iFrames = 1; this.hitFlash = 0.12;
        if (this.hp <= 0) {
            this.hp = 0; this.dead = true;
            Juri.poof(this.centerX(), this.centerY());
        }
    }

    // Betäuben: steht ein paar Sekunden benommen da (Engine: Gegnergeschosse mit hitsCompanions)
    stun(seconds) {
        if (this.koTimer > 0) return;
        this.stunTimer = Math.max(this.stunTimer, seconds);
    }

    // Vergiften: zieht nach und nach Leben ab, ohne den Panda k.o. zu machen (mindestens 1 LP bleibt)
    poison(seconds) {
        if (this.dead || this.koTimer > 0) return false;
        this.poisonTimer = Math.max(this.poisonTimer, seconds);
        return true;
    }

    // Einschlafen: steht wie benommen still, schießt nicht – und fällt dabei ausdrücklich nicht k.o.
    sleep(seconds) {
        if (this.dead || this.koTimer > 0 || this.sleepGuard > 0) return false;
        this.sleepTimer = Math.max(this.sleepTimer, seconds);
        return true;
    }

    // K.o. statt verschwinden: liegt am Boden, steht nach `seconds` mit halben LP wieder auf.
    knockOut(seconds) { Juri.knockOutCompanion(this, seconds); }

    // ── Gift der Bambus-Pflanzen ──

    // Ein Gegner ist vergiftet: er verliert über `seconds` Sekunden immer wieder Leben. Wie das Gift der
    // Schlange und von Marks Würfen, nur dass es hier den Gegnern gilt (Tropfen zählt `poisonTick`).
    static poisonEnemy(e, seconds, damage) {
        if (!e || e.dead) return false;
        const secs = seconds > 0 ? seconds : PANDA_POISON_SECONDS;
        e.pandaPoison = Math.max(e.pandaPoison || 0, secs);
        e.pandaPoisonDamage = damage || PANDA_POISON_DAMAGE;
        if (e.pandaPoisonTick === undefined) e.pandaPoisonTick = 0;
        if (typeof FX !== 'undefined') {
            FX.burst(e.centerX(), e.centerY(), ['#7dff5a', '#c8ffb0'], 5, 70, 0.45, { kind: 'bubble' });
        }
        return true;
    }

    // Gift-Tropfen für alle getroffenen Gegner: läuft unabhängig davon weiter, ob der Panda gerade
    // betäubt, eingeschlafen oder k.o. ist (der Aufrufer zählt es vor allen Zuständen ab).
    static poisonTick(enemies, dt) {
        if (!enemies || !enemies.length) return;
        for (const e of enemies) {
            if (!(e.pandaPoison > 0)) continue;
            if (e.dead) { e.pandaPoison = 0; e.pandaPoisonTick = 0; continue; }
            e.pandaPoison -= dt;
            e.pandaPoisonTick = (e.pandaPoisonTick || 0) + dt;
            while (e.pandaPoisonTick >= PANDA_POISON_TICK) {
                e.pandaPoisonTick -= PANDA_POISON_TICK;
                if (e.dead) break;
                e.takeDamage(e.pandaPoisonDamage || PANDA_POISON_DAMAGE);
                if (typeof FX !== 'undefined') {
                    FX.burst(e.centerX(), e.centerY(), ['#7dff5a', '#9dff72', '#c8ffb0'], 3, 45, 0.5, { kind: 'bubble' });
                }
            }
            if (e.pandaPoison <= 0) { e.pandaPoison = 0; e.pandaPoisonTick = 0; }
        }
    }

    // Mundoosung des Rohrs in Weltkoordinaten (Schuss und Zeichenzeichnung nutzen dieselbe Stelle)
    muzzle() {
        return { x: this.centerX() + PANDA_TUBE.x * (this.faceX || 1), y: this.centerY() + PANDA_TUBE.y };
    }

    update(dt, world, player, enemies) {
        // Das Gift der Pflanzen wirkt weiter, egal was dem Panda gerade passiert
        PandaBuddy.poisonTick(enemies, dt);
        if (this.dead) return;
        if (this.iFrames > 0) this.iFrames -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        if (this.puffTimer > 0) this.puffTimer -= dt;
        // K.o.: liegt am Boden (nicht treffbar), schießt nicht, rollt nicht zu Mark
        if (Juri.koUpdate(this, dt)) return;
        Juri.poisonUpdate(this, dt);
        const asleep = Juri.sleepUpdate(this, dt);
        // Betäubt oder eingeschlafen: steht still, schießt nicht, rollt nicht zu Mark
        if (this.stunTimer > 0 || asleep) {
            if (this.stunTimer > 0) this.stunTimer -= dt;
            this.moving = false;
            this.stuckTimer = 0;
            this.target = null;
            Juri.bump(this, enemies);
            return;
        }
        this.shootTimer -= dt;
        const px = player.x + player.w / 2, py = player.y + player.h / 2;
        if (Math.hypot(px - this.centerX(), py - this.centerY()) > 260 || this.stuckTimer > 1.2) {
            Juri.hopTo(this, player, world, this.faceX > 0 ? -1 : 1);   // dritte Seite neben Juri und Krokodil
        }
        const cx = this.centerX(), cy = this.centerY();

        // Ziel: nächster Gegner in Schussweite, den der Panda auch sehen kann
        this.target = null;
        let best = this.range;
        for (const e of enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.centerX() - cx, e.centerY() - cy);
            if (d < best && Juri.lineClear(world, cx, cy, e.centerX(), e.centerY())) { best = d; this.target = e; }
        }

        // Mitrollen: Mark folgen (mit Wandkollision), Abstand halten
        const gd = Math.hypot(px - cx, py - cy);
        this.moving = false;
        if (gd > 46) {
            const len = Math.min(this.speed * (gd > 120 ? 1.5 : 1) * dt, gd - 46);
            const moved = Juri.step(this, (px - cx) / gd * len, (py - cy) / gd * len, world);
            this.stuckTimer = moved < len * 0.3 ? this.stuckTimer + dt : 0;
            this.moving = moved > 0.05;
            if (!this.target) this.facingAngle = Math.atan2(py - cy, px - cx);
        } else {
            this.stuckTimer = 0;
        }
        if (this.moving) this.walkT += dt;
        if (this.target) this.facingAngle = Math.atan2(this.target.centerY() - cy, this.target.centerX() - cx);
        const fc = Math.cos(this.facingAngle);
        if (Math.abs(fc) > 0.15) this.faceX = fc > 0 ? 1 : -1;
        this.aimX = Math.cos(this.facingAngle);
        this.aimY = Math.sin(this.facingAngle);

        // Spucken: eine Pflanze aus dem Bambusrohr, sie vergiftet den getroffenen Gegner
        if (this.target && this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            this.puffTimer = 0.3;
            const m = this.muzzle();
            const a = Math.atan2(this.target.centerY() - m.y, this.target.centerX() - m.x);
            if (typeof Game !== 'undefined' && Game.projectiles && typeof PandaPlant !== 'undefined') {
                Game.projectiles.push(new PandaPlant(m.x, m.y, Math.cos(a) * 235, Math.sin(a) * 235, this.damage));
            }
            if (typeof FX !== 'undefined') {
                FX.burst(m.x, m.y, ['#9dff72', '#c8ffb0', '#a8d95c'], 6, 80, 0.4, { kind: 'smoke', size: 4 });
            }
        }

        // Berührungsschaden durch Gegner
        Juri.bump(this, enemies);
    }

    // Kleiner runder Panda, schwarz-weiß, mit GRÜNEM HALSTUCH (unterscheidet ihn von den feindlichen
    // Pandas aus Welt 47) und einem kleinen Bambusrohr auf dem Rücken. Fröhliches Gesicht, große Augen
    // in den schwarzen Augenflecken. Beim Laufen rollt er leicht, beim Schucken ruckt das Rohr.
    draw(ctx, camera) {
        if (this.dead) return;
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        const f = this.faceX || 1;
        const X = dx => cx + dx * f;
        const WH = '#f7f5ff', WD = '#4a4560', BLK = '#2b2734', BLD = '#120e1c';
        const SC = '#2fbf5f', SCD = '#157a38', BAM = '#a8d95c', BMD = '#5f9a2e';
        const ph = this.walkT * 10;
        const bob = this.moving ? -Math.abs(Math.sin(ph)) * 1.7 : Math.sin(t * 2.4 + this.seed) * 0.45;
        const roll = this.moving ? Math.sin(ph) * 0.13 : Math.sin(t * 2.4 + this.seed) * 0.025;
        const puff = this.puffTimer > 0 ? Math.min(1, this.puffTimer / 0.14) : 0;
        const charge = this.target && this.shootTimer < 0.35 ? clamp(1 - this.shootTimer / 0.35, 0, 1) : 0;
        const ko = this.koTimer > 0;
        const stunned = !ko && this.stunTimer > 0;
        const dizzy = stunned || (ko && this.koTimer > this.koDur - 2.5);
        const sleeping = !ko && !stunned && this.sleepTimer > 0;
        // Lage: k.o. am Boden, sonst schwankend (betäubt/eingeschlafen) und beim Rollen leicht gekippt
        ctx.save();
        if (ko) {
            Juri.koPose(ctx, this, cx, cy + 9, f);
        } else if (stunned || sleeping) {
            ctx.translate(cx, cy + 12);
            ctx.rotate(Math.sin(t * (sleeping ? 1.6 : 5) + this.seed) * (sleeping ? 0.06 : 0.09));
            ctx.translate(-cx, -(cy + 12));
        } else {
            ctx.translate(cx, cy + 11);
            ctx.rotate(roll);
            ctx.translate(-cx, -(cy + 11));
        }
        const by = cy + 3 + bob;                 // Bauchmitte
        const hx = X(1), hy = cy - 6.6 + bob;    // Kopfmitte
        // Rohr-Öffnung (hinten oben über der Schulter), beim Zielen leicht zur Beute geneigt
        const mx = X(PANDA_TUBE.x) + this.aimX * 2.2, my = cy + PANDA_TUBE.y + bob + this.aimY * 2.2;
        // Bambusrohr auf dem Rücken (hinter dem Körper)
        Art.limb(ctx, X(-2.4), by + 3.4, mx, my, 4.6, BAM, { lineWidth: 1.2, outline: BMD });
        ctx.strokeStyle = BMD;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        for (let i = 1; i <= 2; i++) {
            const k = i / 3;
            const rx = X(-2.4) + (mx - X(-2.4)) * k, ry = by + 3.4 + (my - by - 3.4) * k;
            ctx.moveTo(rx - 2.4, ry + 1);
            ctx.lineTo(rx + 2.4, ry - 1);
        }
        ctx.stroke();
        // Blatt am Rohr und dunkle Öffnung
        Art.shape(ctx, c => {
            c.moveTo(mx - 1, my - 1.5);
            c.quadraticCurveTo(mx + 3.4, my - 4.6, mx + 5.4, my - 2.2);
            c.quadraticCurveTo(mx + 2.6, my - 0.4, mx - 1, my - 1.5);
            c.closePath();
        }, { x: mx - 1, y: my - 4.6, w: 6.4, h: 4.2 }, '#5fe04a', { outline: '#1f7a2a', lineWidth: 0.9, flat: true });
        if (charge > 0 || puff > 0) {
            Art.glow(ctx, mx, my, 4.5 + Math.max(charge, puff) * 4, '#6bff5a', 0.35 + Math.max(charge, puff) * 0.5);
        }
        ctx.fillStyle = '#22331a';
        ctx.beginPath();
        ctx.ellipse(mx, my, 2.1, 1.5, -0.9 * f, 0, TAU);
        ctx.fill();
        // Pfoten (hinten und vorne, laufen mit)
        const l0 = this.moving ? Math.max(0, Math.sin(ph)) * 1.8 : 0;
        const l1 = this.moving ? Math.max(0, Math.sin(ph + Math.PI)) * 1.8 : 0;
        ctx.beginPath();
        ctx.ellipse(X(-4.2), cy + 10.6 - l0, 3.7, 2.4, 0, 0, TAU);
        ctx.moveTo(X(4.4) + 3.7, cy + 10.6 - l1);
        ctx.ellipse(X(4.4), cy + 10.6 - l1, 3.7, 2.4, 0, 0, TAU);
        ctx.fillStyle = BLK;
        ctx.fill();
        ctx.strokeStyle = BLD;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Arme (schwarz, die vordere Pfote greift nach vorn)
        Art.limb(ctx, X(-6.6), by - 0.6, X(-8.8), by + 4.2, 3.4, BLK, { lineWidth: 1.1, outline: BLD });
        Art.limb(ctx, X(6.4), by - 1.2, X(8.8), by + 3.2 - puff * 1.6, 3.4, BLK, { lineWidth: 1.1, outline: BLD });
        // Körper: rund und weiß
        Art.body(ctx, cx, by, 9, 8.4, WH, { outline: WD });
        // grünes Halstuch: Band, Knoten und ein wehendes Ende
        const ky = cy - 1.8 + bob;
        Art.shape(ctx, c => {
            c.ellipse(cx, ky, 8.2, 3, 0, 0, TAU);
        }, { x: cx - 8.2, y: ky - 3, w: 16.4, h: 6 }, SC, { outline: SCD, lineWidth: 1.1 });
        ctx.beginPath();
        ctx.ellipse(X(4.6), ky + 1.6, 2.2, 1.9, 0.3 * f, 0, TAU);
        ctx.fillStyle = Art.light(SC, 0.18);
        ctx.fill();
        ctx.strokeStyle = SCD;
        ctx.lineWidth = 1;
        ctx.stroke();
        const wav = Math.sin(t * 4.2 + this.seed) * 1.3 + (this.moving ? 1.2 : 0);
        Art.shape(ctx, c => {
            c.moveTo(X(5.4), ky + 2.4);
            c.quadraticCurveTo(X(9.4), ky + 3.6 - wav, X(12.2), ky + 5.4 - wav);
            c.lineTo(X(11), ky + 7.6 - wav * 0.8);
            c.quadraticCurveTo(X(8.4), ky + 5.8 - wav * 0.5, X(4.8), ky + 4.4);
            c.closePath();
        }, { x: Math.min(X(4.8), X(12.2)), y: ky + 2, w: 8, h: 6.4 }, SC, { outline: SCD, lineWidth: 1 });
        // Ohren (hinter dem Kopf)
        ctx.beginPath();
        ctx.arc(X(-4.8), hy - 6.2, 3.1, 0, TAU);
        ctx.moveTo(X(4.6) + 3, hy - 6.4);
        ctx.arc(X(4.6), hy - 6.4, 3, 0, TAU);
        ctx.fillStyle = BLK;
        ctx.fill();
        ctx.strokeStyle = BLD;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        // Kopf
        Art.body(ctx, hx, hy, 8.4, 7.6, WH, { outline: WD });
        // schwarze Augenflecken
        ctx.fillStyle = BLK;
        ctx.beginPath();
        ctx.ellipse(X(-3.2), hy - 1.1, 3.2, 3.6, -0.34 * f, 0, TAU);
        ctx.moveTo(X(3.6) + 3.1, hy - 1.1);
        ctx.ellipse(X(3.6), hy - 1.1, 3.1, 3.5, 0.34 * f, 0, TAU);
        ctx.fill();
        // große Augen in den Flecken (Blick zum Ziel)
        let lx = f * 0.75, ly = 0.1;
        const tg = this.target;
        if (tg && !tg.dead) {
            const dx = tg.centerX() - this.centerX(), dy = tg.centerY() - this.centerY();
            const d = Math.hypot(dx, dy) || 1;
            lx = dx / d;
            ly = dy / d;
        }
        const ex = hx + f * 0.3;
        if (dizzy) {
            Juri.spiralEye(ctx, X(-3.2), hy - 1.2, 2.1, t * 7);
            Juri.spiralEye(ctx, X(3.6), hy - 1.2, 2.1, -t * 7);
        } else if (ko || sleeping) {
            Art.eye(ctx, X(-3.2), hy - 1.2, 2.4, { x: 0, y: 0 }, { open: 0.05, sclera: '#ffffff' });
            Art.eye(ctx, X(3.6), hy - 1.2, 2.4, { x: 0, y: 0 }, { open: 0.05, sclera: '#ffffff' });
        } else {
            Art.eyes(ctx, ex, hy - 1.2, 2.4, {
                gap: 3.4, look: { x: lx, y: ly }, seed: this.seed,
                sclera: '#ffffff', iris: '#5a7a3a', irisSize: 0.66,
            });
        }
        // Näschen und fröhliches Maul
        ctx.fillStyle = BLD;
        ctx.beginPath();
        ctx.ellipse(X(0.4), hy + 2.5, 1.8, 1.3, 0, 0, TAU);
        ctx.fill();
        Art.mouth(ctx, X(0.4), hy + 4.8, 4.6, stunned || ko || sleeping ? 'o' : (puff > 0.2 ? 'open' : 'smile'));
        Art.blush(ctx, hx + f * 0.4, hy + 3, 1.4, 5.4, '#ff9ab0');
        ctx.restore();
        // Anzeigen über der Figur (wie bei Juri und dem Krokodil)
        if (ko) {
            if (dizzy) Juri.dizzyStars(ctx, cx - f * 11, cy - 1, 8, this.seed);
            else Juri.zzz(ctx, cx - f * 9, cy - 2, this.seed);
        } else if (stunned) {
            Juri.dizzyStars(ctx, cx, pos.y - 7, 10, this.seed);
        } else if (sleeping) {
            Juri.zzz(ctx, cx + f * 5, pos.y - 9, this.seed);
        }
        if (this.poisonTimer > 0) Juri.poisonMark(ctx, cx + f * 10, pos.y - 13, t);
        Juri.hpBar(ctx, cx, pos.y - 14, this.hp, this.maxHp);
    }
}
