// ── Player ──

class Player {
    constructor(x, y) {
        this.x = x - 14;
        this.y = y - 14;
        this.w = 28;
        this.h = 28;
        this.baseSpeed = 150;
        this.speed = this.baseSpeed;
        this.hp = 20; // 5 hearts x 4 quarters
        this.maxHp = 20;
        this.facingAngle = 0;
        this.dead = false;

        // Weapons
        this.meleeWeapon = new BaseballBat();
        this.rangedWeapon = null;
        this.activeWeapon = this.meleeWeapon;

        // Dodge / roll
        this.dodging = false;
        this.dodgeTimer = 0;
        this.dodgeDuration = 0.3;
        this.dodgeCooldown = 0;
        this.dodgeCooldownTime = 0.8;
        this.dodgeSpeed = 400;
        this.dodgeDir = { x: 0, y: 0 };

        // Invincibility
        this.iFrames = 0;
        this.iFrameDuration = 1.0;

        // Power-ups
        this.powerUps = {}; // { speed: { timer: 10 }, attack: { timer: 15 } }

        // ── Unlockable abilities ──
        // Auto (unlocked after World 2): drive through walls for 15s
        this.hasAuto = false;
        this.autoActive = false;
        this.autoTimer = 0;
        this.autoDuration = 15;
        this.autoCharges = 0;    // World 3: must kill 5 slimes to charge
        this.autoChargesNeeded = 5;
        this.autoReady = true;   // true in W2, in W3 must be charged

        // Krone/Crown (unlocked after World 3): 5s shield at level start
        this.hasCrown = false;
        this.crownShieldTimer = 0;
        this.crownShieldDuration = 15;

        // Slow / sticky effects
        this.slowTimer = 0;
        this.slowFactor = 1;
        // Betäubung (z. B. Pfotenschlag des Riesen-Werwolfs): > 0 = Mark kann nicht laufen, angreifen, ausweichen
        this.stunTimer = 0;

        // Jump pads
        this.jumpPadStandTimer = 0;
        this.jumpPadCooldown = 0;
        this.jumpPadLaunchTimer = 0;
        this.jumpPadLaunchDir = { x: 0, y: 0 };

        // Death
        this.deathTimer = 0;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    addPowerUp(type, duration) {
        this.powerUps[type] = { timer: duration };
    }

    hasPowerUp(type) {
        return this.powerUps[type] && this.powerUps[type].timer > 0;
    }

    takeDamage(amount, knockbackAngle, knockbackForce) {
        if (this.iFrames > 0 || this.dodging || this.dead) return;
        if (this.crownShieldTimer > 0) return;
        if (this.autoActive) return;
        this.hp -= amount;
        this.iFrames = this.iFrameDuration;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.deathTimer = 1.5;
        }
    }

    activateAuto() {
        if (!this.hasAuto || this.autoActive) return;
        if (!this.autoReady) return;
        this.autoActive = true;
        this.autoTimer = this.autoDuration;
        // Danach muss das Auto neu aufgeladen werden (5 besiegte Gegner) – sonst wäre Mark dauerhaft unverwundbar.
        this.autoCharges = 0;
        this.autoReady = false;
        if (typeof Sound !== 'undefined' && Sound.powerUp) Sound.powerUp();
    }

    // Darf Mark auf dieser Kachel landen? Außerhalb des Bosskampfs nur vom Start aus erreichbare Kacheln
    // außerhalb des Boss-Bereichs, im Bosskampf nur der Boss-Raum (sonst Einsperren ohne Schlüssel möglich).
    _safeTile(world, x, y) {
        if (isSolidTile(world.tiles[y][x])) return false;
        if (typeof Game === 'undefined' || !Game._isBossRoomTile) return true;
        const inBossRoom = Game._isBossRoomTile(x, y);
        if (Game.bossActive && !Game.bossDefeated) return inBossRoom;
        if (inBossRoom) return false;
        return !Game._reach || !!Game._reach[y * world.width + x];
    }

    // Nach dem Auto-Modus: steckt Mark in einer Wand oder außerhalb, auf die nächste sichere Kachel setzen.
    _escapeWalls(world) {
        const sx = clamp(Math.floor((this.x + this.w / 2) / TILE_SIZE), 0, world.width - 1);
        const sy = clamp(Math.floor((this.y + this.h / 2) / TILE_SIZE), 0, world.height - 1);
        const inside = world.collideRect({ x: this.x, y: this.y, w: this.w, h: this.h }).length > 0;
        if (!inside && this._safeTile(world, sx, sy)) return;
        const seen = new Set([sy * world.width + sx]);
        const queue = [[sx, sy]];
        while (queue.length) {
            const [x, y] = queue.shift();
            if (this._safeTile(world, x, y)) {
                this.x = x * TILE_SIZE + TILE_SIZE / 2 - this.w / 2;
                this.y = y * TILE_SIZE + TILE_SIZE / 2 - this.h / 2;
                return;
            }
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
                if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
                const k = ny * world.width + nx;
                if (seen.has(k)) continue;
                seen.add(k);
                queue.push([nx, ny]);
            }
        }
    }

    // Prüft das ganze Auto-Rechteck gegen den Boss-Bereich
    _autoMayEnter(world, px, py) {
        if (typeof Game === 'undefined' || !Game._isBossBlockTile) return true;
        const fight = Game.bossActive && !Game.bossDefeated;
        const x0 = Math.floor(px / TILE_SIZE), x1 = Math.floor((px + this.w - 0.01) / TILE_SIZE);
        const y0 = Math.floor(py / TILE_SIZE), y1 = Math.floor((py + this.h - 0.01) / TILE_SIZE);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                if (fight ? !Game._isBossRoomTile(tx, ty) : Game._isBossBlockTile(tx, ty)) return false;
            }
        }
        return true;
    }

    addAutoCharge() {
        if (!this.hasAuto) return;
        this.autoCharges++;
        if (this.autoCharges >= this.autoChargesNeeded) {
            this.autoReady = true;
        }
    }

    startCrownShield() {
        if (this.hasCrown) {
            this.crownShieldTimer = this.crownShieldDuration;
        }
    }

    applySlow(duration, factor) {
        this.slowTimer = Math.max(this.slowTimer, duration);
        this.slowFactor = Math.min(this.slowFactor, factor || 0.65);
    }

    // Betäuben: wirkt nicht beim Ausweichen, im Auto und unter dem Kronen-Schild (wie Schaden).
    // Gibt zurück, ob Mark jetzt betäubt ist.
    stun(seconds) {
        if (this.dead || this.dodging || this.autoActive || this.crownShieldTimer > 0) return false;
        this.stunTimer = Math.max(this.stunTimer, seconds);
        return true;
    }

    switchWeapon() {
        if (this.rangedWeapon) {
            this.activeWeapon = this.activeWeapon === this.meleeWeapon
                ? this.rangedWeapon : this.meleeWeapon;
        }
    }

    update(dt, world) {
        if (this.dead) {
            this.deathTimer -= dt;
            return;
        }

        // Crown shield countdown
        if (this.crownShieldTimer > 0) this.crownShieldTimer -= dt;

        // Slow countdown
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.slowFactor = 1;
        }

        // Jump pad cooldown / launch
        if (this.jumpPadCooldown > 0) this.jumpPadCooldown -= dt;
        if (this.jumpPadLaunchTimer > 0) {
            this.jumpPadLaunchTimer -= dt;
            const dx = this.jumpPadLaunchDir.x * 380 * dt;
            const dy = this.jumpPadLaunchDir.y * 380 * dt;
            this._moveWithCollision(dx, dy, world);
            if (this.jumpPadLaunchTimer <= 0) {
                this.jumpPadCooldown = 3;
            }
            return;
        }

        // Auto ability
        if (this.autoActive) {
            this.autoTimer -= dt;
            if (this.autoTimer <= 0) {
                this.autoActive = false;
                this._escapeWalls(world);
                this.iFrames = Math.max(this.iFrames, 1);
            }
        }

        if (this.hasAuto && this.autoReady && !this.autoActive && Input.abilityPressed) {
            this.activateAuto();
        }

        // Power-ups
        this.speed = this.baseSpeed;
        if (this.autoActive) this.speed = this.baseSpeed * 2; // Auto is fast!
        for (const key of Object.keys(this.powerUps)) {
            this.powerUps[key].timer -= dt;
            if (this.powerUps[key].timer <= 0) {
                delete this.powerUps[key];
            }
        }
        if (this.hasPowerUp('speed')) this.speed *= 1.5;

        // Invincibility
        if (this.iFrames > 0) this.iFrames -= dt;

        // Dodge cooldown
        if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;

        // Betäubt: steht still, kein Angriff, kein Ausweichen
        if (this.stunTimer > 0 && !this.dodging) {
            this.stunTimer -= dt;
            if (Input.consumeDodge) Input.consumeDodge();
            this.activeWeapon.update(dt);
            return;
        }

        // Dodge
        if (this.dodging) {
            this.dodgeTimer -= dt;
            const dx = this.dodgeDir.x * this.dodgeSpeed * dt;
            const dy = this.dodgeDir.y * this.dodgeSpeed * dt;
            this._moveWithCollision(dx, dy, world);
            if (this.dodgeTimer <= 0) {
                this.dodging = false;
                this.dodgeCooldown = this.dodgeCooldownTime;
            }
            return; // No other movement during dodge
        }

        // Ausweichen: in Laufrichtung, im Stand in Blickrichtung
        if (Input.dodgeTriggered && !this.dodging && this.dodgeCooldown <= 0) {
            const dir = Input.direction;
            const moving = dir.x !== 0 || dir.y !== 0;
            this.dodging = true;
            this.dodgeTimer = this.dodgeDuration;
            this.dodgeDir = moving ? vecNormalize(dir) : { x: Math.cos(this.facingAngle), y: Math.sin(this.facingAngle) };
            this.iFrames = Math.max(this.iFrames, this.dodgeDuration + 0.1);
            Input.consumeDodge();
            Sound.dodge();
        }

        // Movement
        const dir = Input.direction;
        if (dir.x !== 0 || dir.y !== 0) {
            this.facingAngle = Math.atan2(dir.y, dir.x);
        }
        const dx = dir.x * this.speed * this.slowFactor * dt;
        const dy = dir.y * this.speed * this.slowFactor * dt;
        if (this.autoActive) {
            // Auto: fährt durch Wände, aber nie aus der Karte hinaus, nie in den Boss-Bereich (samt Wänden)
            // und im Bosskampf nicht aus dem Boss-Raum heraus
            const nx = clamp(this.x + dx, TILE_SIZE, world.pixelWidth - TILE_SIZE - this.w);
            const ny = clamp(this.y + dy, TILE_SIZE, world.pixelHeight - TILE_SIZE - this.h);
            if (this._autoMayEnter(world, nx, ny)) {
                this.x = nx;
                this.y = ny;
            } else if (this._autoMayEnter(world, nx, this.y)) {
                this.x = nx;
            } else if (this._autoMayEnter(world, this.x, ny)) {
                this.y = ny;
            }
        } else {
            this._moveWithCollision(dx, dy, world);
        }

        // Jump pad charging
        const onJumpPad = world && world.isJumpPad && world.isJumpPad(this.x + this.w / 2, this.y + this.h / 2);
        if (onJumpPad && this.jumpPadCooldown <= 0 && dir.x === 0 && dir.y === 0 && !this.dodging) {
            this.jumpPadStandTimer += dt;
            if (this.jumpPadStandTimer >= 5) {
                const launchAngle = this.facingAngle || 0;
                this.jumpPadLaunchDir = {
                    x: Math.cos(launchAngle) || 1,
                    y: Math.sin(launchAngle)
                };
                const len = Math.hypot(this.jumpPadLaunchDir.x, this.jumpPadLaunchDir.y) || 1;
                this.jumpPadLaunchDir.x /= len;
                this.jumpPadLaunchDir.y /= len;
                this.jumpPadLaunchTimer = 0.35;
                this.jumpPadStandTimer = 0;
            }
        } else {
            this.jumpPadStandTimer = 0;
        }

        // Blickrichtung: aktiv zielen (Stick/Maus/Zielhilfe) hat Vorrang, sonst Laufrichtung
        if (Input.aiming || this.assistAim !== undefined) {
            this.facingAngle = this.assistAim !== undefined ? this.assistAim : Input.aimAngle;
        }
        this.aimAngle = this.facingAngle;

        // Weapon update
        this.activeWeapon.update(dt);

        // Attack - triggered by click/tap or by holding the right aim joystick
        if ((Input.attackPressed || Input.attackHeld || this.autoAttack) && this.activeWeapon.canAttack()) {
            if (this.activeWeapon.type === 'melee') {
                this.activeWeapon.attack(this.facingAngle);
                Sound.swing();
            }
        }

        if (Input.swapPressed) this.switchWeapon();
    }

    _moveWithCollision(dx, dy, world) {
        moveWithCollision(this, dx, dy, world);
    }

    // ── Zeichnen ──
    // Mark: Baseballspieler und Geisterjäger. Rote Kappe (Wiedererkennung!), braune Haare,
    // türkisblaues T-Shirt, Jeans, braune Turnschuhe. Blickrichtung = facingAngle.
    // Nur Darstellung: kein Spielzustand wird verändert. Den Bodenschatten zeichnet die Engine.
    draw(ctx, camera) {
        const pos = camera.worldToScreen(this.x, this.y);
        const cx = pos.x + this.w / 2;
        const cy = pos.y + this.h / 2;
        const t = Art.time;
        if (this.dead) {
            this._drawDeath(ctx, cx, cy, t);
            return;
        }
        const P = this._drawPose(cx, cy, t);
        ctx.save();
        if (P.attack || P.fast) this._drawAura(ctx, P, t, true);
        if (this.dodging) this._drawDodgeTrail(ctx, P);
        if (P.blink) ctx.globalAlpha *= 0.5;
        if (this.autoActive) this._drawKart(ctx, camera, P, t);
        else this._drawFigure(ctx, camera, P, t);
        ctx.restore();
        if (P.attack || P.fast) this._drawAura(ctx, P, t, false);
        if (this.slowTimer > 0 && this.slowFactor < 1) this._drawSlowed(ctx, P, t);
        if (this.crownShieldTimer > 0) this._drawCrownShield(ctx, P, t);
        if (this.stunTimer > 0 && typeof Juri !== 'undefined' && Juri.dizzyStars) {
            Juri.dizzyStars(ctx, cx, cy - 20, 10, 1.7);
        }
    }

    // Haltung für dieses Bild (reine Anzeigewerte; das Objekt wird wiederverwendet).
    _drawPose(cx, cy, t) {
        const P = this._pz || (this._pz = { look: { x: 0, y: 1 } });
        const dir = Input.direction;
        const fa = this.facingAngle || 0;
        const moving = !this.dodging && (dir.x !== 0 || dir.y !== 0);
        const dl = Math.hypot(dir.x, dir.y) || 1;
        P.cx = cx;
        P.cy = cy;
        P.fa = fa;
        P.fx = Math.cos(fa);
        P.fy = Math.sin(fa);
        P.moving = moving;
        P.mdx = moving ? dir.x / dl : P.fx;
        P.mdy = moving ? dir.y / dl : P.fy;
        P.attack = this.hasPowerUp('attack');
        P.fast = this.hasPowerUp('speed');
        P.ph = t * 13 * (P.fast ? 1.3 : 1) * (this.slowFactor || 1);
        P.bob = moving ? -Math.abs(Math.sin(P.ph)) * 1.6 : Math.sin(t * 2.4) * 0.35;
        const sq = moving ? Math.cos(P.ph * 2) * 0.05 : Math.sin(t * 2.4) * 0.012;
        P.sx = 1 + sq;
        P.sy = 1 - sq;
        P.lift = 0;
        P.roll = 0;
        P.seated = false;
        if (this.jumpPadLaunchTimer > 0) {
            const q = 1 - this.jumpPadLaunchTimer / 0.35;
            P.lift = Math.sin(q * Math.PI) * 13;
            P.sx = 0.92;
            P.sy = 1.1;
        }
        if (this.dodging) {
            const q = clamp(1 - this.dodgeTimer / (this.dodgeDuration || 0.3), 0, 1);
            const d = this.dodgeDir || { x: 1, y: 0 };
            const sgn = Math.abs(d.x) > 0.3 ? Math.sign(d.x) : (d.y >= 0 ? 1 : -1);
            P.roll = q * TAU * sgn;
            P.lift = Math.sin(q * Math.PI) * 3;
        }
        // Armhaltung je Waffe
        const w = this.activeWeapon;
        P.mode = 'hang';
        P.wa = fa;
        if (this.dodging) P.mode = 'tuck';
        else if (w && w.type === 'ranged') P.mode = 'gun';
        else if (w && w.type === 'melee') {
            P.mode = w.swinging ? 'swing' : 'bat';
            if (w.swinging) P.wa = w._swingAngle ? w._swingAngle() : w.swingAngle;
        }
        // Gesicht; nach einem Treffer dezent blinken (nicht beim Ausweichen, nicht im Sieges-Schutz)
        const dodgeIF = this.dodging || this.dodgeCooldown > (this.dodgeCooldownTime || 0.8) - 0.15;
        const hitIF = this.iFrames > 0 && this.iFrames <= (this.iFrameDuration || 1) && !dodgeIF;
        P.blink = hitIF && Math.floor(this.iFrames * 12) % 2 === 1;
        P.hurt = hitIF && this.iFrames > 0.72;
        const shot = w && w.type === 'ranged' && w.cooldown > 0 && w.cooldownTimer > w.cooldown * 0.45;
        P.mouth = P.hurt ? 'o' : (this.dodging || (w && w.swinging) || shot ? 'grin' : 'smile');
        P.open = P.hurt ? 0.5 : 1;
        P.sad = this.hp <= 4;
        P.look.x = P.fx;
        P.look.y = P.fy;
        return P;
    }

    // Stehend/laufend: Wippen, Stauchen und Strecken um den Fußpunkt; Ausweichrolle als Salto.
    _drawFigure(ctx, camera, P, t) {
        const cx = P.cx;
        const cy = P.cy;
        const footY = cy + 14;
        ctx.save();
        if (P.roll) {
            ctx.translate(cx, cy - 2 - P.lift);
            ctx.rotate(P.roll);
            ctx.scale(0.9, 0.9);
            ctx.translate(-cx, -(cy - 2));
        } else {
            ctx.translate(cx, footY - P.lift);
            ctx.scale(P.sx, P.sy);
            ctx.translate(-cx, -footY);
        }
        this._drawMark(ctx, camera, P, t, cx, cy);
        ctx.restore();
    }

    // Mark aus Einzelteilen. Was von der Kamera weg zeigt, wird zuerst gezeichnet.
    _drawMark(ctx, camera, P, t, cx, cy) {
        const fx = P.fx;
        const fy = P.fy;
        const rx = -fy;                  // rechte Körperseite im Bild
        const ry = fx;
        const ub = P.bob;
        const shY = cy - 0.8 + ub;
        const sRx = cx + rx * 6.3, sRy = shY + ry * 2.2;
        const sLx = cx - rx * 6.3, sLy = shY - ry * 2.2;
        let hRx, hRy, hLx, hLy;
        let fwd = 0;
        let layer = 'none';              // Ebene der Waffe: back | mid | front
        if (P.mode === 'gun') {
            P.gx = cx + fx * 8.2 + rx * 2.6;
            P.gy = cy + 2.6 + ub + fy * 4.6 + ry * 1.0;
            hRx = P.gx; hRy = P.gy;
            hLx = P.gx + fx * 4.4; hLy = P.gy + fy * 2.8;
            layer = fy < -0.3 ? 'back' : (fy > 0.45 ? 'mid' : 'front');
            fwd = fy;
        } else if (P.mode === 'swing') {
            const ca = Math.cos(P.wa), sa = Math.sin(P.wa);
            P.gx = cx + ca * 8.5;
            P.gy = cy + 1.6 + ub + sa * 6.2;
            hRx = P.gx; hRy = P.gy;
            hLx = P.gx - ca * 2.3; hLy = P.gy - sa * 2.3;
            layer = sa < -0.3 ? 'back' : 'front';
            fwd = sa;
        } else if (P.mode === 'bat') {
            // Schläger lässig auf der rechten Schulter, Spitze nach oben und seitlich am Kopf vorbei
            P.gx = sRx + fx * 2.2 + rx * 0.6;
            P.gy = sRy + 3.4 + fy * 1.2;
            const side = P.gx - cx;
            let bx = Math.abs(side) > 3 ? Math.sign(side) * 0.36 : -fx * 0.9, by = -1;
            const bl = Math.hypot(bx, by);
            bx /= bl;
            by /= bl;
            P.batAngle = Math.atan2(by, bx);
            hRx = P.gx; hRy = P.gy;
            // linke Hand hängt locker und schwingt beim Laufen
            const sw = P.moving ? Math.sin(P.ph) : 0;
            hLx = sLx - rx * 1.2 + P.mdx * sw * 2.4; hLy = sLy + 6.2 + P.mdy * sw * 1.2;
            layer = ry > 0.35 ? 'front' : 'back';
            fwd = fy * 0.5;
        } else if (P.mode === 'wheel') {
            hRx = P.whx + P.wpx * 2.4; hRy = P.why + P.wpy * 2.4;
            hLx = P.whx - P.wpx * 2.4; hLy = P.why - P.wpy * 2.4;
            fwd = fy;
        } else if (P.mode === 'tuck') {
            hRx = cx + rx * 3.2; hRy = cy + 2.5 + ub;
            hLx = cx - rx * 3.2; hLy = hRy;
        } else if (P.mode === 'up') {
            hRx = sRx + rx * 2.6; hRy = sRy - 5.5;
            hLx = sLx - rx * 2.6; hLy = sLy - 5.5;
        } else {
            // hängende Arme, schwingen gegengleich zu den Beinen
            const sw = P.moving ? Math.sin(P.ph) : 0;
            hRx = sRx + rx * 1.2 - P.mdx * sw * 2.4; hRy = sRy + 6.2 - P.mdy * sw * 1.2;
            hLx = sLx - rx * 1.2 + P.mdx * sw * 2.4; hLy = sLy + 6.2 + P.mdy * sw * 1.2;
        }
        const armsBack = layer === 'back' && P.mode !== 'bat';
        const backR = armsBack || ry * 0.8 + fwd * 0.6 < -0.25;
        const backL = armsBack || -ry * 0.8 + fwd * 0.6 < -0.25;

        // 1) Beine, 2) Arme und Waffe hinter dem Körper
        if (!P.seated) this._drawLegs(ctx, P, cx, cy, rx, ry);
        if (backR) this._drawArm(ctx, sRx, sRy, hRx, hRy);
        if (backL) this._drawArm(ctx, sLx, sLy, hLx, hLy);
        if (layer === 'back') this._drawWeapon(ctx, camera, P);
        if (backR) this._drawHand(ctx, hRx, hRy);
        if (backL) this._drawHand(ctx, hLx, hLy);
        // 3) Rumpf, 4) vordere Arme
        this._drawTorso(ctx, P, cx, cy, ub);
        if (!backR) this._drawArm(ctx, sRx, sRy, hRx, hRy);
        if (!backL) this._drawArm(ctx, sLx, sLy, hLx, hLy);
        if (layer === 'mid') this._drawWeapon(ctx, camera, P);
        if (layer !== 'front') {
            if (!backR) this._drawHand(ctx, hRx, hRy);
            if (!backL) this._drawHand(ctx, hLx, hLy);
        }
        // 5) Kopf mit Kappe, beim Laufen leicht schief
        const hx = cx + fx * 0.6;
        const hy = cy - 10.6 + ub * 1.15;
        const tilt = P.moving ? Math.sin(P.ph) * 0.045 : 0;
        if (tilt) {
            ctx.save();
            ctx.translate(hx, hy + 8);
            ctx.rotate(tilt);
            ctx.translate(-hx, -(hy + 8));
        }
        this._drawHead(ctx, P, hx, hy);
        if (tilt) ctx.restore();
        // 6) Waffe vor dem Körper
        if (layer === 'front') {
            this._drawWeapon(ctx, camera, P);
            if (!backR) this._drawHand(ctx, hRx, hRy);
            if (!backL) this._drawHand(ctx, hLx, hLy);
        }
    }

    _drawWeapon(ctx, camera, P) {
        const w = this.activeWeapon;
        if (w && w.draw) w.draw(ctx, camera, this, P);
    }

    _drawLegs(ctx, P, cx, cy, rx, ry) {
        const C = MARK_COLORS;
        const hipY = cy + 5.6 + P.bob * 0.4;
        const first = ry > 0 ? -1 : 1;             // hinteres Bein zuerst
        let ax = 0, ay = 0, bx = 0, by = 0;        // Fußpunkte (hinten, vorn)
        for (let i = 0; i < 2; i++) {
            const s = i === 0 ? first : -first;
            const hx = cx + s * rx * 3.3 + s * ry * 1.3;
            const hy = hipY + s * ry * 0.9;
            let fx = hx, fy = hy + 5.2;
            if (P.mode === 'tuck') fy = hy + 2.2;
            else if (P.moving) {
                const sw = Math.sin(P.ph) * s;
                fx += P.mdx * sw * 3.4;
                fy += P.mdy * sw * 1.8 - Math.max(0, Math.cos(P.ph) * s) * 1.8;
            }
            Art.limb(ctx, hx, hy, fx, fy, 4.6, C.jeans, { lineWidth: 1.3 });
            if (i === 0) { ax = fx; ay = fy; } else { bx = fx; by = fy; }
        }
        // Turnschuhe (beide in einem Pfad): helle Sohle, braunes Oberteil, Spitze in Lauf-/Blickrichtung
        const tx = P.mdx * 1.1;
        ctx.beginPath();
        ctx.ellipse(ax + tx, ay + 2, 3.6, 2, 0, 0, TAU);
        ctx.moveTo(bx + tx + 3.6, by + 2);
        ctx.ellipse(bx + tx, by + 2, 3.6, 2, 0, 0, TAU);
        ctx.fillStyle = C.sole;
        ctx.fill();
        ctx.strokeStyle = C.soleInk;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        Art.shape(ctx, c => {
            c.ellipse(ax + tx, ay + 1.1, 3.1, 2.2, 0, 0, TAU);
            c.moveTo(bx + tx + 3.1, by + 1.1);
            c.ellipse(bx + tx, by + 1.1, 3.1, 2.2, 0, 0, TAU);
        }, { x: Math.min(ax, bx) + tx - 3.1, y: Math.min(ay, by) - 1.1, w: Math.abs(ax - bx) + 6.2, h: Math.abs(ay - by) + 4.4 }, C.shoe, { lineWidth: 1.2 });
    }

    _drawArm(ctx, sx, sy, hx, hy) {
        const C = MARK_COLORS;
        Art.limb(ctx, sx, sy, hx, hy, 3.0, C.skin, { lineWidth: 1.25, outline: C.skinInk });
        Art.limb(ctx, sx, sy, sx + (hx - sx) * 0.34, sy + (hy - sy) * 0.34, 4.7, C.shirt, { lineWidth: 1.3 });
    }

    _drawHand(ctx, x, y) {
        ctx.fillStyle = MARK_COLORS.skin;
        ctx.strokeStyle = MARK_COLORS.skinInk;
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.ellipse(x, y, 2.3, 2.2, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
    }

    _drawTorso(ctx, P, cx, cy, ub) {
        const C = MARK_COLORS;
        const tw = 7.1 * (0.84 + 0.16 * Math.abs(P.fy));
        const bw = tw * 0.86;
        const top = cy - 2.6 + ub;
        const bot = cy + 7.1 + ub * 0.5;
        Art.shape(ctx, c => {
            c.moveTo(cx - tw, top + 3);
            c.quadraticCurveTo(cx - tw, top, cx - tw + 3.2, top);
            c.lineTo(cx + tw - 3.2, top);
            c.quadraticCurveTo(cx + tw, top, cx + tw, top + 3);
            c.lineTo(cx + bw, bot - 1.8);
            c.quadraticCurveTo(cx + bw, bot, cx + bw - 2, bot);
            c.lineTo(cx - bw + 2, bot);
            c.quadraticCurveTo(cx - bw, bot, cx - bw, bot - 1.8);
            c.closePath();
        }, { x: cx - tw, y: top, w: tw * 2, h: bot - top }, C.shirt);
        // heller Saum
        ctx.strokeStyle = C.shirtLight;
        ctx.lineWidth = 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - bw + 1.4, bot - 1.7);
        ctx.lineTo(cx + bw - 1.4, bot - 1.7);
        ctx.stroke();
        // Baseball-Emblem auf der Brust (nur von vorn zu sehen)
        if (P.fy > 0.3) {
            const ex = cx + P.fx * 2.6;
            const ey = cy + 2.9 + ub;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#8fa4bf';
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.arc(ex, ey, 2.25, 0, TAU);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = C.cap;
            ctx.lineWidth = 0.55;
            ctx.beginPath();
            ctx.arc(ex - 2.3, ey, 1.6, -0.75, 0.75);
            ctx.moveTo(ex + 2.3 + 1.6 * Math.cos(Math.PI - 0.75), ey + 1.6 * Math.sin(Math.PI - 0.75));
            ctx.arc(ex + 2.3, ey, 1.6, Math.PI - 0.75, Math.PI + 0.75);
            ctx.stroke();
        }
    }

    // Kopf: rund in Haarfarbe, darauf die Gesichtsfläche zur Blickrichtung hin (von hinten nur Haare).
    _drawHead(ctx, P, hx, hy) {
        const C = MARK_COLORS;
        const hr = 9.4;
        const fx = P.fx;
        const fy = P.fy;
        const yaw = Math.atan2(fx, fy);       // 0 = schaut zur Kamera
        // Schirm hinter dem Kopf (Blick nach oben): nur was über die Kappe hinausragt, bleibt sichtbar
        if (fy < -0.25) this._drawBrim(ctx, P, hx, hy, hr);
        Art.body(ctx, hx, hy, hr, hr, C.hair, { outline: false, highlight: false });   // Umriss folgt unten
        const fcx = hx + fx * hr * 0.5;
        // Gesichtsmitte: von vorn tief, im Profil seitlich, von hinten unter der Kappe versteckt
        const fcy = hy + hr * (fy >= 0 ? 0.1 + 0.25 * fy : 0.1 + 1.1 * fy + 2 * Math.min(0, fy + 0.5));
        const fr = hr * (1 + 0.2 * Math.max(0, fy));   // von vorn: ganzes Gesicht, Haare nur als Büschel
        ctx.save();
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, TAU);
        ctx.clip();
        if (fy < -0.2) {
            // Hinterkopf: Glanz und ein paar Haarsträhnen
            Art.shine(ctx, hx - 3.6, hy - 0.2, 3, 1.5, -0.6, 0.22);
            ctx.strokeStyle = C.hairDark;
            ctx.lineWidth = 0.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(hx - 2.6, hy - 2.5);
            ctx.quadraticCurveTo(hx - 3.2, hy + 2, hx - 5, hy + 6);
            ctx.moveTo(hx + 1.8, hy - 2.2);
            ctx.quadraticCurveTo(hx + 2.4, hy + 2.4, hx + 1.2, hy + 7);
            ctx.stroke();
        }
        Art.body(ctx, fcx, fcy, fr, fr, C.skin, { outline: C.hairLine, lineWidth: 0.9, highlight: false });
        ctx.restore();
        // Umriss: an den Haaren dunkelbraun, am Gesicht weicher (sonst wirkt das Kinn wie ein Bart)
        ctx.strokeStyle = C.headInk;
        ctx.lineWidth = Art.LINE;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, TAU);
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        ctx.arc(fcx, fcy, fr, 0, TAU);
        ctx.clip();
        ctx.strokeStyle = C.skinInk;
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, TAU);
        ctx.stroke();
        ctx.restore();
        // Ohren (ein Pfad)
        ctx.beginPath();
        for (let e = -1; e <= 1; e += 2) {
            const a = yaw + e * 1.6;
            const v = Math.cos(a);
            if (v < -0.15) continue;
            const ex = hx + Math.sin(a) * hr * 0.97, erx = 1.1 + 0.7 * Math.max(0, v);
            ctx.moveTo(ex + erx, hy + 2.7);
            ctx.ellipse(ex, hy + 2.7, erx, 2.0, 0, 0, TAU);
        }
        ctx.fillStyle = C.skin;
        ctx.fill();
        ctx.strokeStyle = C.skinInk;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        if (fy > -0.55) {
            // Wangen
            ctx.fillStyle = C.blush;
            ctx.beginPath();
            for (let e = -1; e <= 1; e += 2) {
                const a = yaw + e * 0.95;
                if (Math.cos(a) < 0.15) continue;
                const bx = hx + Math.sin(a) * hr * 0.68;
                ctx.moveTo(bx + 1.7, hy + 5.4);
                ctx.ellipse(bx, hy + 5.4, 1.7, 1.05, 0, 0, TAU);
            }
            ctx.fill();
            // Augen: freundliche Jungenaugen, braune Iris, blicken in Blickrichtung
            const open = Math.min(P.open, Art.blink(0.7));
            for (let e = -1; e <= 1; e += 2) {
                const a = yaw + e * 0.52;
                const v = Math.cos(a);
                if (v < 0.1) continue;
                ctx.save();
                ctx.translate(hx + Math.sin(a) * hr * 0.64, hy + 3.1 + fy * 0.3);
                ctx.scale(clamp(v * 1.2, 0.3, 1), 1);
                Art.eye(ctx, 0, 0, 2.2, P.look, { iris: C.iris, irisSize: 0.8, tall: 1.32, open, sad: P.sad, side: e < 0 ? 'left' : 'right', brow: C.hairDark, lid: C.eyeInk, pupil: '#1c0d06' });
                ctx.restore();
            }
            // Nase nur im Profil (von vorn wirkt sie wie ein Brillensteg), dann der Mund
            if (fy > -0.45 && Math.abs(fx) > 0.4) {
                ctx.fillStyle = C.nose;
                ctx.beginPath();
                ctx.ellipse(hx + fx * hr * 0.92, hy + 5.0, 1.1, 0.85, 0, 0, TAU);
                ctx.fill();
            }
            if (fy > -0.3) Art.mouth(ctx, hx + fx * hr * 0.52, hy + 6.7 + fy * 0.2, 2.2 + 1.5 * Math.max(0, fy), P.mouth, { color: C.mouth });
        }
        this._drawCap(ctx, P, hx, hy, hr, yaw);
    }

    // Rote Baseballkappe: Kuppel mit Nähten und „M“, Schirm zeigt in Blickrichtung.
    _drawCap(ctx, P, hx, hy, hr, yaw) {
        const C = MARK_COLORS;
        const fx = P.fx;
        const fy = P.fy;
        const bandY = hy - hr * 0.42;
        const crx = hr + 0.9;
        const cry = hr * 0.58 + 1.8;
        const dip = hr * 0.22;
        // braune Haarbüschel, die seitlich/hinten unter der Kappe hervorschauen
        ctx.beginPath();
        for (let e = -1; e <= 1; e += 2) {
            const a = yaw + Math.PI + e * 1.15;
            if (Math.cos(a) < -0.2) continue;
            const sg = Math.sin(a) >= 0 ? 1 : -1;
            const tx = hx + Math.sin(a) * crx * 0.95;
            const ty = bandY + 0.6;
            ctx.moveTo(tx - sg * 1.8, ty - 1.5);
            ctx.quadraticCurveTo(tx + sg * 2.2, ty - 0.2, tx + sg * 2.7, ty + 2.7);
            ctx.quadraticCurveTo(tx + sg * 1.3, ty + 1.5, tx + sg * 0.7, ty + 3.5);
            ctx.quadraticCurveTo(tx - sg * 0.3, ty + 1.9, tx - sg * 1.6, ty + 1.9);
            ctx.closePath();
        }
        ctx.fillStyle = C.hair;
        ctx.fill();
        ctx.strokeStyle = C.headInk;
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        ctx.stroke();
        Art.shape(ctx, c => {
            c.ellipse(hx, bandY, crx, cry, 0, Math.PI, TAU);
            c.quadraticCurveTo(hx, bandY + dip * 2, hx - crx, bandY);
            c.closePath();
        }, { x: hx - crx, y: bandY - cry, w: crx * 2, h: cry + dip }, C.cap, { glossy: true, outline: C.capInk });
        // Nähte der vorderen Bahnen
        ctx.strokeStyle = C.capSeam;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let e = -1; e <= 1; e += 2) {
            const a = yaw + e * 0.85;
            if (Math.cos(a) < 0.05) continue;
            const u = Math.sin(a);
            ctx.moveTo(hx + u * 0.8, bandY - cry + 0.9);
            ctx.quadraticCurveTo(hx + u * crx * 0.95, bandY - cry * 0.35, hx + u * crx, bandY + (1 - u * u) * dip);
        }
        ctx.stroke();
        Art.shine(ctx, hx - crx * 0.38, bandY - cry * 0.56, crx * 0.28, cry * 0.17, -0.45, 0.5);
        ctx.fillStyle = C.capDark;
        ctx.beginPath();
        ctx.ellipse(hx, bandY - cry + 0.6, 1.5, 1.1, 0, 0, TAU);
        ctx.fill();
        // „M“ für Mark vorn auf der Kappe
        if (fy > 0.15) {
            const lx = hx + fx * 0.62 * crx * 0.9;
            const ly = bandY - cry * 0.4;
            const k = 0.35 + 0.65 * fy;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.95;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(lx - 1.8 * k, ly + 1.3);
            ctx.lineTo(lx - 1.6 * k, ly - 1.3);
            ctx.lineTo(lx, ly + 0.4);
            ctx.lineTo(lx + 1.6 * k, ly - 1.3);
            ctx.lineTo(lx + 1.8 * k, ly + 1.3);
            ctx.stroke();
        }
        // Verschluss hinten (Blick von der Kamera weg)
        if (fy < -0.3) {
            const u = -fx * 0.5;
            const sx = hx + u * crx;
            const sy = bandY + (1 - u * u) * dip;
            ctx.fillStyle = C.hairDark;
            ctx.beginPath();
            ctx.ellipse(sx, sy - 0.2, 2.4, 2.1, 0, Math.PI, TAU);
            ctx.fill();
            ctx.strokeStyle = C.capInk;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(sx - 2.7, sy - 0.3);
            ctx.lineTo(sx + 2.7, sy - 0.3);
            ctx.stroke();
        }
        if (fy >= -0.25) this._drawBrim(ctx, P, hx, hy, hr);
    }

    // Schirm: flache Halbellipse in Blickrichtung, mit dunkler Unterseite als Dicke.
    _drawBrim(ctx, P, hx, hy, hr) {
        const C = MARK_COLORS;
        const fx = P.fx;
        const fy = P.fy;
        const bandY = hy - hr * 0.42;
        const crx = hr + 0.9;
        const dip = hr * 0.22;
        const L = 7.4;
        const W = hr * 0.98;
        const alx = fx * L, aly = fy * L * (fy > 0 ? 0.36 : 0.5);
        const acx = -fy * W, acy = fx * W * 0.45;
        const rX = hx + fx * crx * 0.86;
        const rY = bandY + Math.max(0, fy) * dip;
        const K = 0.5523;
        // Verlaufs-Rahmen = Ausdehnung des Schirms (sonst wirkt er zu dunkel)
        const bx0 = Math.min(rX + acx, rX - acx, rX + alx), bx1 = Math.max(rX + acx, rX - acx, rX + alx);
        const by0 = Math.min(rY + acy, rY - acy, rY + aly), by1 = Math.max(rY + acy, rY - acy, rY + aly);
        for (let pass = 0; pass < 2; pass++) {
            const oy = pass === 0 ? 1.3 : 0;
            const build = c => {
                c.moveTo(rX + acx, rY + acy + oy);
                c.bezierCurveTo(rX + acx + alx * K, rY + acy + aly * K + oy, rX + acx * K + alx, rY + acy * K + aly + oy, rX + alx, rY + aly + oy);
                c.bezierCurveTo(rX - acx * K + alx, rY - acy * K + aly + oy, rX - acx + alx * K, rY - acy + aly * K + oy, rX - acx, rY - acy + oy);
                c.closePath();
            };
            const box = { x: bx0, y: by0 + oy, w: Math.max(2, bx1 - bx0), h: Math.max(2, by1 - by0) };
            if (pass === 0) Art.shape(ctx, build, box, C.capDark, { flat: true, outline: C.capInk });
            else Art.shape(ctx, build, box, C.cap, { outline: C.capInk });
        }
    }

    // Auto-Modus: Mark sitzt in einem Spielzeug-Kart (flach am Boden, dreht mit der Fahrtrichtung).
    _drawKart(ctx, camera, P, t) {
        const C = MARK_COLORS;
        const fa = P.fa;
        const fx = P.fx;
        const fy = P.fy;
        const K = 0.72;                                   // Bodenverkürzung der Schrägsicht
        const cx = P.cx;
        const cy = P.cy + 5;
        const buzz = P.moving ? Math.sin(t * 42) * 0.45 : Math.sin(t * 64) * 0.2;
        // Abgaswolken hinter dem Kart
        const ex = cx - fx * 19;
        const ey = cy - fy * 19 * K;
        const rate = P.moving ? 2.8 : 1.3;
        const a0 = ctx.globalAlpha;
        ctx.fillStyle = '#f1ecff';
        for (let i = 0; i < 4; i++) {
            const u = (t * rate + i * 0.25) % 1;
            ctx.globalAlpha = a0 * (1 - u) * 0.55;
            ctx.beginPath();
            ctx.arc(ex - fx * u * 15 + Math.sin(i * 1.9 + t * 5) * 1.3, ey - fy * u * 15 * K - u * 8, 1.8 + u * 4.2, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = a0;
        // Karosserie: Seitenwand mit Rädern (tiefer), dann die Oberseite
        for (let pass = 0; pass < 2; pass++) {
            ctx.save();
            ctx.translate(cx, cy + buzz + (pass === 0 ? 3.2 : 0));
            ctx.scale(1, K);
            ctx.rotate(fa);
            if (pass === 0) {
                // vier Räder in einem Pfad, Profilstriche laufen beim Fahren mit
                const roll = P.moving ? (t * 46) % 4 : 0;
                ctx.beginPath();
                for (let i = 0; i < 4; i++) {
                    const wx = i < 2 ? 9 : -9;
                    const wy = (i % 2 ? 1 : -1) * (i < 2 ? 10.4 : 10.9);
                    ctx.roundRect(wx - 4.2, wy - 2.5, 8.4, 5, 2.2);
                }
                ctx.fillStyle = C.tire;
                ctx.fill();
                ctx.strokeStyle = Art.ink(C.tire);
                ctx.lineWidth = Art.LINE;
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255,255,255,0.28)';
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                for (let i = 0; i < 4; i++) {
                    const wx = i < 2 ? 9 : -9;
                    const wy = (i % 2 ? 1 : -1) * (i < 2 ? 10.4 : 10.9);
                    for (let k = 0; k < 2; k++) {
                        const lx = wx - 3 + ((roll + k * 4) % 8) * 0.75;
                        ctx.moveTo(lx, wy - 2);
                        ctx.lineTo(lx, wy + 2);
                    }
                }
                ctx.stroke();
                Art.shape(ctx, markKartPath, { x: -15, y: -10, w: 32, h: 20 }, C.kartSide, { flat: true, outline: C.kartInk });
            } else {
                Art.shape(ctx, markKartPath, { x: -15, y: -10, w: 32, h: 20 }, C.kart, { glossy: true, outline: C.kartInk });
                // Sitz, Rennstreifen, Stern
                Art.box(ctx, -11.5, -6.8, 13.5, 13.6, 5.5, C.kartSeat, { highlight: false });
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.roundRect(4, -3.4, 12, 1.7, 0.8);
                ctx.roundRect(4, 1.7, 12, 1.7, 0.8);
                ctx.fill();
                // Scheinwerfer
                ctx.fillStyle = '#fff6c9';
                ctx.beginPath();
                ctx.arc(15.4, -6, 1.6, 0, TAU);
                ctx.arc(15.4, 6, 1.6, 0, TAU);
                ctx.fill();
                // Heckflügel und Auspuff
                Art.box(ctx, -19.8, -11.6, 3.6, 23.2, 1.5, C.cap, { highlight: false, outline: C.capInk });
                ctx.fillStyle = '#dfe6f1';
                ctx.strokeStyle = '#5a6278';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(-16.4, -4.6, 1.8, 0, TAU);
                ctx.moveTo(-14.6, 4.6);
                ctx.arc(-16.4, 4.6, 1.8, 0, TAU);
                ctx.fill();
                ctx.stroke();
                // Auspuff-Flammen beim Fahren
                if (P.moving) {
                    for (let s = -1; s <= 1; s += 2) {
                        const fl = 3.2 + Math.sin(t * 37 + s * 2) * 1.3;
                        Art.glow(ctx, -19.5, s * 4.6, 4.5, '#ff7a1f', 0.7);
                        ctx.fillStyle = '#ffb02e';
                        ctx.beginPath();
                        ctx.moveTo(-18.2, s * 4.6 - 1.3);
                        ctx.lineTo(-18.2 - fl, s * 4.6);
                        ctx.lineTo(-18.2, s * 4.6 + 1.3);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                // Lenkrad
                ctx.strokeStyle = '#2b2540';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(4.2, 0, 3, 0, TAU);
                ctx.stroke();
            }
            ctx.restore();
        }
        // Scheinwerfer-Leuchten und Tempo-Striche (Bildschirmraum)
        Art.glow(ctx, cx + fx * 16 - fy * 6, cy + (fy * 16 + fx * 6) * K, 5, '#fff3a8', 0.5);
        Art.glow(ctx, cx + fx * 16 + fy * 6, cy + (fy * 16 - fx * 6) * K, 5, '#fff3a8', 0.5);
        if (P.moving) {
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let j = -1; j <= 1; j++) {
                const u = (t * 3 + j * 0.37 + 1) % 1;
                const ox = -fy * j * 8, oy = fx * j * 8 * K;
                const bx = cx - fx * (20 + u * 6) + ox, by = cy - fy * (20 + u * 6) * K + oy;
                ctx.moveTo(bx, by);
                ctx.lineTo(bx - fx * 8, by - fy * 8 * K);
            }
            ctx.stroke();
        }
        // Mark sitzt im Kart (Oberkörper), lenkt oder zielt
        const mv = P.moving;
        const bob = P.bob;
        P.seated = true;
        P.moving = false;
        P.bob = 0;
        P.whx = cx + fx * 4.4;
        P.why = cy + fy * 4.4 * K + buzz;
        P.wpx = -fy;
        P.wpy = fx * K;
        if (P.mode === 'bat') P.mode = 'wheel';
        const sx = cx - fx * 4;
        const sy = cy - fy * 4 * K + buzz;
        this._drawMark(ctx, camera, P, t, sx, sy - 6.2);
        P.moving = mv;
        P.bob = bob;
    }

    // Ausweichrolle: bläuliche Nachbilder und Schwunglinien hinter Mark.
    _drawDodgeTrail(ctx, P) {
        const C = MARK_COLORS;
        const d = this.dodgeDir || { x: 0, y: 0 };
        const q = clamp(1 - this.dodgeTimer / (this.dodgeDuration || 0.3), 0, 1);
        const a0 = ctx.globalAlpha;
        for (let i = 3; i >= 1; i--) {
            const k = i * 6.5;
            const x = P.cx - d.x * k;
            const y = P.cy - 2 - d.y * k;
            const a = (0.42 - i * 0.1) * (1 - q * 0.4);
            Art.glow(ctx, x, y, 15, '#7fe7ff', a * 0.8);
            ctx.globalAlpha = a0 * a;
            ctx.fillStyle = C.shirt;
            ctx.beginPath();
            ctx.arc(x, y + 3, 8, 0, TAU);
            ctx.fill();
            ctx.fillStyle = C.cap;
            ctx.beginPath();
            ctx.arc(x, y - 3, 7.5, Math.PI, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = a0 * 0.75 * (1 - q);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let j = -1; j <= 1; j += 2) {
            const ox = -d.y * j * 7, oy = d.x * j * 7;
            ctx.moveTo(P.cx - d.x * 9 + ox, P.cy - 2 - d.y * 9 + oy);
            ctx.lineTo(P.cx - d.x * 24 + ox, P.cy - 2 - d.y * 24 + oy);
        }
        ctx.stroke();
        ctx.globalAlpha = a0;
    }

    // Power-ups: Stärke = rote Aura mit aufsteigenden Funken, Tempo = blaue Aura mit Wind und Blitzen.
    _drawAura(ctx, P, t, behind) {
        const x = P.cx;
        const y = P.cy - 3 - P.lift;
        if (behind) {
            if (P.attack) Art.glow(ctx, x, y, 27, '#ff4d3a', 0.3 + 0.08 * Math.sin(t * 9));
            if (P.fast) Art.glow(ctx, x, y, 25, '#45b8ff', 0.26 + 0.06 * Math.sin(t * 7));
            return;
        }
        if (P.attack) {
            for (let i = 0; i < 4; i++) {
                const u = (t * 1.3 + i * 0.25) % 1;
                const sx = x + Math.sin(i * 2.4 + t * 2.2) * 10;
                const sy = P.cy + 10 - u * 30 - P.lift;
                Art.glow(ctx, sx, sy, 4.5 * (1 - u) + 1.5, '#ff7a3c', (1 - u) * 0.9);
                ctx.fillStyle = '#ffe08a';
                ctx.beginPath();
                ctx.arc(sx, sy, 1.2 * (1 - u) + 0.4, 0, TAU);
                ctx.fill();
            }
        }
        if (P.fast) {
            if (P.moving) {
                const a0 = ctx.globalAlpha;
                ctx.globalAlpha = a0 * 0.7;
                ctx.strokeStyle = '#c9f0ff';
                ctx.lineWidth = 1.3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let j = -1; j <= 1; j++) {
                    const u = (t * 4 + j * 0.31 + 1) % 1;
                    const ox = -P.mdy * j * 7, oy = P.mdx * j * 7;
                    const bx = x - P.mdx * (12 + u * 5) + ox;
                    const by = y - P.mdy * (12 + u * 5) + oy;
                    ctx.moveTo(bx, by);
                    ctx.lineTo(bx - P.mdx * 9, by - P.mdy * 9);
                }
                ctx.stroke();
                ctx.globalAlpha = a0;
            }
            for (let i = 0; i < 2; i++) {
                const g = t * 5 + i * Math.PI;
                Art.sparkle(ctx, x + Math.cos(g) * 14, y + Math.sin(g) * 10, 2.6, '#a8e6ff', 0.55 + 0.45 * Math.sin(t * 12 + i * 2));
            }
        }
    }

    // Verlangsamt (Eis/Schleim): kleine eisblaue Funken um die Füße.
    _drawSlowed(ctx, P, t) {
        for (let i = 0; i < 3; i++) {
            const g = t * 2.2 + i * TAU / 3;
            Art.sparkle(ctx, P.cx + Math.cos(g) * 11, P.cy + 12 + Math.sin(g) * 3.5 - P.lift, 2.3, '#bfe8ff', 0.85);
        }
    }

    // Kronen-Schild: goldene Blase und kleine Krone über der Kappe; blinkt kurz vor dem Ende.
    _drawCrownShield(ctx, P, t) {
        const tm = this.crownShieldTimer;
        let a = Math.min(1, tm * 2);
        if (tm < 2.5 && Math.sin(t * 24) < 0) a *= 0.35;
        const x = P.cx;
        const y = P.cy - 4 - P.lift;
        const R = 21 + Math.sin(t * 3) * 0.6;
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * a;
        Art.glow(ctx, x, y, R + 9, '#ffd23f', 0.2);
        ctx.fillStyle = 'rgba(255,221,110,0.12)';
        ctx.beginPath();
        ctx.arc(x, y, R, 0, TAU);
        ctx.fill();
        Art.ring(ctx, x, y, R, '#ffd966', 1.7, 0.9);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y, R - 3.2, Math.PI * 1.08, Math.PI * 1.42);
        ctx.stroke();
        Art.shine(ctx, x - R * 0.5, y - R * 0.62, 1.6, 1.1, 0, 0.8);
        for (let i = 0; i < 2; i++) {
            const g = t * 1.7 + i * Math.PI;
            Art.sparkle(ctx, x + Math.cos(g) * R, y + Math.sin(g) * R, 2.8, '#fff6c2', 0.95);
        }
        const kx = x;
        const ky = P.cy - 29.5 - P.lift + Math.sin(t * 3.2) * 1.3;
        Art.shape(ctx, c => {
            c.moveTo(kx - 5.5, ky + 2.5);
            c.lineTo(kx - 6, ky - 3);
            c.lineTo(kx - 2.8, ky - 0.4);
            c.lineTo(kx, ky - 4.6);
            c.lineTo(kx + 2.8, ky - 0.4);
            c.lineTo(kx + 6, ky - 3);
            c.lineTo(kx + 5.5, ky + 2.5);
            c.closePath();
        }, { x: kx - 6, y: ky - 4.6, w: 12, h: 7.1 }, '#ffd23f', { glossy: true, outline: '#a86a00' });
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.arc(kx, ky + 0.6, 1.1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff6c2';
        ctx.beginPath();
        ctx.arc(kx - 6, ky - 3, 0.9, 0, TAU);
        ctx.moveTo(kx + 0.9, ky - 4.6);
        ctx.arc(kx, ky - 4.6, 0.9, 0, TAU);
        ctx.moveTo(kx + 6.9, ky - 3);
        ctx.arc(kx + 6, ky - 3, 0.9, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a0;
    }

    // Tod (deathTimer 1,5 → 0): Mark dreht sich weg, hebt ab und verpufft mit Sternchen.
    _drawDeath(ctx, cx, cy, t) {
        const k = clamp(1 - this.deathTimer / 1.5, 0, 1);
        const P = this._drawPose(cx, cy, t);
        P.moving = false;
        P.bob = 0;
        P.lift = 0;
        P.roll = 0;
        P.mode = 'up';
        P.mouth = 'o';
        P.open = 0.1;
        P.sad = false;
        if (k < 0.62) {
            const q = k / 0.62;
            const fa = (this.facingAngle || 0) + q * q * TAU * 2.5;
            P.fa = fa;
            P.fx = Math.cos(fa);
            P.fy = Math.sin(fa);
            P.look.x = P.fx;
            P.look.y = P.fy;
            const s = 1 - q * 0.18;
            const lift = q * 5;
            ctx.save();
            ctx.translate(cx, cy + 14 - lift);
            ctx.scale(s, s);
            ctx.translate(-cx, -(cy + 14));
            this._drawMark(ctx, null, P, t, cx, cy);
            ctx.restore();
            for (let i = 0; i < 3; i++) {
                const g = t * 7 + i * TAU / 3;
                Art.star(ctx, cx + Math.cos(g) * 10, cy - 26 - lift + Math.sin(g) * 3, 2.3, '#ffd23f', { outline: '#a86a00', lineWidth: 0.8 });
            }
            return;
        }
        const q = (k - 0.62) / 0.38;
        const s = (1 - q) * (1 - q) * 0.82;
        if (s > 0.04) {
            const fa = (this.facingAngle || 0) + TAU * 2.5 + q * 8;
            P.fa = fa;
            P.fx = Math.cos(fa);
            P.fy = Math.sin(fa);
            ctx.save();
            ctx.translate(cx, cy - 2);
            ctx.scale(s, s);
            ctx.translate(-cx, -(cy - 2));
            this._drawMark(ctx, null, P, t, cx, cy);
            ctx.restore();
        }
        const a0 = ctx.globalAlpha;
        ctx.globalAlpha = a0 * (1 - q);
        ctx.fillStyle = '#f3eeff';
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
            const g = i / 7 * TAU + 0.3;
            const d = 3 + q * 13;
            const r = (3.2 + q * 5.5) * (1 - q * 0.45);
            const px = cx + Math.cos(g) * d;
            const py = cy - 4 + Math.sin(g) * d * 0.8;
            ctx.moveTo(px + r, py);
            ctx.arc(px, py, r, 0, TAU);
        }
        ctx.fill();
        ctx.globalAlpha = a0;
        for (let i = 0; i < 8; i++) {
            const g = i / 8 * TAU + q * 1.5;
            const d = 7 + q * 30;
            const gold = i % 2 === 1;
            Art.star(ctx, cx + Math.cos(g) * d, cy - 4 + Math.sin(g) * d * 0.85, (1 - q) * 3 + 0.6,
                gold ? '#ffd23f' : '#ffffff', { rot: q * 5 + i, outline: gold ? '#a86a00' : '#9aa6c8', lineWidth: 0.7 });
        }
    }
}

// Farben von Mark (auch für Kart und Nachbilder).
const MARK_COLORS = {
    skin: '#ffcfa0',
    skinInk: '#8a4a2a',
    nose: '#eeaa7c',
    blush: 'rgba(255,120,150,0.42)',
    hair: '#8b4a22',
    hairDark: '#5a2d14',
    hairLine: '#6d3818',
    headInk: '#4a2414',
    iris: '#6a3a1e',
    eyeInk: '#7a3f22',
    cap: '#ee2d38',
    capDark: '#a3121c',
    capInk: '#6e0a14',
    capSeam: 'rgba(110,10,20,0.55)',
    shirt: '#17b4d6',
    shirtLight: 'rgba(255,255,255,0.55)',
    jeans: '#3d62c7',
    mouth: '#6e2a22',
    shoe: '#a8622e',
    sole: '#f4ead9',
    soleInk: '#7a6a5a',
    kart: '#ffc52e',
    kartSide: '#c98a12',
    kartInk: '#7a4a00',
    kartSeat: '#3b2d57',
    tire: '#2b2540',
};

// Umriss des Karts (x = vorn), für Seitenwand und Oberseite.
function markKartPath(c) {
    c.moveTo(-15, -6.5);
    c.quadraticCurveTo(-15, -10, -11, -10);
    c.lineTo(5, -9.4);
    c.quadraticCurveTo(15.5, -9, 16.8, -4);
    c.lineTo(16.8, 4);
    c.quadraticCurveTo(15.5, 9, 5, 9.4);
    c.lineTo(-11, 10);
    c.quadraticCurveTo(-15, 10, -15, 6.5);
    c.closePath();
}
