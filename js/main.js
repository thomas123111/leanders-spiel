// ── Main Game ──

const Game = {
    canvas: null,
    ctx: null,
    state: 'TITLE',
    currentWorld: 1,
    player: null,
    world: null,
    camera: null,
    enemies: [],
    projectiles: [],
    particles: [],
    chests: [],
    keyDrops: [],
    hasKey: false,
    bossActive: false,
    bossDefeated: false,
    worldClearTimer: 0,
    lastTime: 0,

    // Persistent unlocks
    unlockedRanged: false,
    unlockedAuto: false,
    unlockedCrown: false,
    unlockedTripleShot: false,
    maxWorldUnlocked: 1,

    // Screen transition
    fadeAlpha: 0,
    fadeDir: 0, // 0=none, 1=fading out, -1=fading in
    fadeCallback: null,

    init() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Request fullscreen on first user interaction
        const requestFS = () => {
            const el = document.documentElement;
            const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
            if (rfs) {
                rfs.call(el).catch(() => {});
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            }
            document.removeEventListener('touchstart', requestFS);
            document.removeEventListener('click', requestFS);
        };
        document.addEventListener('touchstart', requestFS, { once: true });
        document.addEventListener('click', requestFS, { once: true });

        document.addEventListener('fullscreenchange', () => this.resize());
        document.addEventListener('webkitfullscreenchange', () => this.resize());

        Sound.init();
        Input.init(this.canvas);
        this.loadSave();
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    },

    // ── Save System ──
    save() {
        try {
            localStorage.setItem('mark_save', JSON.stringify({
                world: this.currentWorld,
                maxWorld: this.maxWorldUnlocked,
                ranged: this.unlockedRanged,
                auto: this.unlockedAuto,
                crown: this.unlockedCrown,
                triple: this.unlockedTripleShot
            }));
        } catch (e) {}
    },

    loadSave() {
        try {
            const data = JSON.parse(localStorage.getItem('mark_save'));
            if (data) {
                this.currentWorld = data.world || 1;
                this.maxWorldUnlocked = data.maxWorld || data.world || 1;
                this.unlockedRanged = !!data.ranged;
                this.unlockedAuto = !!data.auto;
                this.unlockedCrown = !!data.crown;
                this.unlockedTripleShot = !!data.triple;
            }
        } catch (e) {}
    },

    clearSave() {
        try { localStorage.removeItem('mark_save'); } catch (e) {}
    },

    // ── Hitstop ──
    doHitstop(duration) {
        this.hitstopTimer = Math.max(this.hitstopTimer, duration);
    },

    // ── Haptic Feedback ──
    vibrate(ms) {
        if (navigator.vibrate) navigator.vibrate(ms);
    },

    // ── Screen Transition ──
    fadeOut(callback) {
        this.fadeDir = 1;
        this.fadeAlpha = 0;
        this.fadeCallback = callback;
    },

    fadeIn() {
        this.fadeDir = -1;
        this.fadeAlpha = 1;
        this.fadeCallback = null;
    },

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        const logicalH = 480;
        const logicalW = Math.round(logicalH * (w / h));
        this.canvas.width = Math.max(640, logicalW);
        this.canvas.height = logicalH;
        if (this.camera) {
            this.camera.width = this.canvas.width;
            this.camera.height = this.canvas.height;
        }
    },

    startNewGame() {
        Sound.resume();
        this.currentWorld = 1;
        this.unlockedRanged = false;
        this.unlockedAuto = false;
        this.unlockedCrown = false;
        this.unlockedTripleShot = false;
        this.maxWorldUnlocked = 1;
        this.clearSave();
        this.startWorld(1);
    },

    startWorld(worldNum) {
        this.currentWorld = worldNum;
        this.state = 'PLAYING';
        this.hitstopTimer = 0;
        this.fadeIn();
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.chests = [];
        this.keyDrops = [];
        this.hasKey = false;
        this.bossActive = false;
        this.bossDefeated = false;

        // Load world
        this.world = new World();
        const levels = [null, WORLD1_LEVEL, WORLD2_LEVEL, WORLD3_LEVEL, WORLD4_LEVEL];
        const themes = [null, 'castle', 'factory', 'cave', 'dark'];
        this.world.load(levels[worldNum]);
        this.world.theme = themes[worldNum];

        // Spawn player
        this.player = new Player(this.world.spawnPoint.x, this.world.spawnPoint.y);

        // Apply unlocked abilities
        if (this.unlockedRanged || worldNum >= 2) {
            this.unlockedRanged = true;
            this.player.rangedWeapon = new BaseballLauncher();
            if (this.unlockedTripleShot || worldNum >= 4) {
                this.player.rangedWeapon.tripleShot = true;
            }
            if (worldNum >= 2) {
                this.player.activeWeapon = this.player.rangedWeapon;
            }
        }
        if (this.unlockedAuto) {
            this.player.hasAuto = true;
            if (worldNum === 3) {
                // In World 3, auto must be charged by killing 5 slimes
                this.player.autoReady = false;
                this.player.autoCharges = 0;
            }
        }
        if (this.unlockedCrown) {
            this.player.hasCrown = true;
            this.player.startCrownShield();
        }

        // Player always has 5 hearts (20 HP)

        // Camera
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        this.camera.x = this.player.x - this.canvas.width / 2;
        this.camera.y = this.player.y - this.canvas.height / 2;

        // Find valid floor positions for spawning (away from player)
        this._floorTiles = [];
        for (let y = 2; y < this.world.height - 2; y++) {
            for (let x = 2; x < this.world.width - 2; x++) {
                if (this.world.tiles[y][x] === TILE_FLOOR) {
                    this._floorTiles.push({ x: x * 32 + 16, y: y * 32 + 16 });
                }
            }
        }
        // Shuffle
        for (let i = this._floorTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._floorTiles[i], this._floorTiles[j]] = [this._floorTiles[j], this._floorTiles[i]];
        }

        // Spawn enemies and chests for this world
        this._spawnWorldContent(worldNum);
    },

    _getSpawnPos(minDist) {
        minDist = minDist || 100;
        const px = this.world.spawnPoint.x;
        const py = this.world.spawnPoint.y;
        for (let i = 0; i < this._floorTiles.length; i++) {
            const t = this._floorTiles[i];
            if (Math.abs(t.x - px) + Math.abs(t.y - py) > minDist) {
                this._floorTiles.splice(i, 1);
                return t;
            }
        }
        return this._floorTiles.pop() || { x: 200, y: 200 };
    },

    _spawnWorldContent(worldNum) {
        if (worldNum === 1) {
            this._spawnWorld1();
        } else if (worldNum === 2) {
            this._spawnWorld2();
        } else if (worldNum === 3) {
            this._spawnWorld3();
        } else if (worldNum === 4) {
            this._spawnWorld4();
        }
    },

    _spawnAt(EnemyClass, minDist) {
        const p = this._getSpawnPos(minDist || 150);
        return new EnemyClass(p.x, p.y);
    },

    _spawnChestAt() {
        const p = this._getSpawnPos(80);
        return new Chest(p.x - 12, p.y - 10);
    },

    // ── World 1: Ghost Castle ──
    _spawnWorld1() {
        for (let i = 0; i < 14; i++) this.enemies.push(this._spawnAt(Ghost));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 2: Robot Chick Factory ──
    _spawnWorld2() {
        for (let i = 0; i < 8; i++) this.enemies.push(this._spawnAt(RoboChick));
        for (let i = 0; i < 5; i++) this.enemies.push(this._spawnAt(MiniRoboChick));
        this.enemies.push(this._spawnAt(GiantEgg, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 3: Slime Arena ──
    _spawnWorld3() {
        for (let i = 0; i < 14; i++) this.enemies.push(this._spawnAt(Slime));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 4: Dark Knight Castle ──
    _spawnWorld4() {
        for (let i = 0; i < 8; i++) this.enemies.push(this._spawnAt(ShadowKnight));
        for (let i = 0; i < 6; i++) this.enemies.push(this._spawnAt(GiantBat));
        this.enemies.push(this._spawnAt(KeyKnight, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    _spawnBoss() {
        this.bossActive = true;
        this.state = 'BOSS_INTRO';
        Sound.bossIntro();
        this.vibrate(200);

        let boss;
        if (this.currentWorld === 1) {
            boss = new BossGhost(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 2) {
            boss = new BossGhostChick(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 3) {
            boss = new BossSlime(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 4) {
            boss = new BossKnightBat(this.world.bossSpawn.x, this.world.bossSpawn.y);
        }
        this.enemies.push(boss);

        setTimeout(() => {
            if (this.state === 'BOSS_INTRO') this.state = 'PLAYING';
        }, 2000);
    },

    _onBossDefeated() {
        this.bossDefeated = true;
        Sound.bossDeath();
        this.camera.shake(8, 0.5);
        this.vibrate(400);

        this.maxWorldUnlocked = Math.max(this.maxWorldUnlocked, this.currentWorld + 1);
        Sound.worldClear();
        this.state = 'WORLD_CLEAR';
        this.worldClearTimer = 60; // wait for button click

        if (this.currentWorld === 1) {
            this.unlockedRanged = true;
        } else if (this.currentWorld === 2) {
            this.unlockedAuto = true;
        } else if (this.currentWorld === 3) {
            this.unlockedCrown = true;
        } else if (this.currentWorld === 4) {
            this.unlockedTripleShot = true;
            this.state = 'WIN';
        }
        this.save();
    },

    _advanceToNextWorld() {
        if (this.currentWorld < 4) {
            this.startWorld(this.currentWorld + 1);
        }
    },

    gameLoop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;

        // Fade transitions
        if (this.fadeDir !== 0) {
            this.fadeAlpha += this.fadeDir * dt * 3;
            if (this.fadeDir === 1 && this.fadeAlpha >= 1) {
                this.fadeAlpha = 1;
                this.fadeDir = 0;
                if (this.fadeCallback) this.fadeCallback();
            } else if (this.fadeDir === -1 && this.fadeAlpha <= 0) {
                this.fadeAlpha = 0;
                this.fadeDir = 0;
            }
        }

        this.update(dt);
        this.render();
        requestAnimationFrame(t => this.gameLoop(t));
    },

    update(dt) {
        const playerScreenPos = this.player && this.camera
            ? this.camera.worldToScreen(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2)
            : null;
        Input.update(dt, playerScreenPos);

        if (this.state === 'TITLE') {
            if (Input._key('Enter') || Input._key('Space')) {
                Sound.resume();
                this.startWorld(this.maxWorldUnlocked);
            }
            if (Input.attackPressed || Input.mouse.pressed) {
                Sound.resume();
                const btn = Renderer.getClickedButton(Input.mouse.x, Input.mouse.y);
                if (btn) {
                    const worldNames = ['Welt 1: Geisterschloss', 'Welt 2: Roboter-K\u00fcken', 'Welt 3: Schleim-Arena', 'Welt 4: Ritterburg'];
                    for (let i = 0; i < worldNames.length; i++) {
                        if (btn === worldNames[i] && i + 1 <= this.maxWorldUnlocked) {
                            this.startWorld(i + 1);
                            break;
                        }
                    }
                }
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'GAME_OVER') {
            if (Input._key('Enter') || Input._key('Space')) {
                this.startWorld(this.currentWorld);
            }
            if (Input.attackPressed || Input.mouse.pressed) {
                const btn = Renderer.getClickedButton(Input.mouse.x, Input.mouse.y);
                if (btn === 'NOCHMAL') this.startWorld(this.currentWorld);
                else if (btn === 'STARTSEITE') { this.state = 'TITLE'; }
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'WORLD_CLEAR') {
            if (Input._key('Enter') || Input._key('Space')) {
                this._advanceToNextWorld();
            }
            if (Input.attackPressed || Input.mouse.pressed) {
                const btn = Renderer.getClickedButton(Input.mouse.x, Input.mouse.y);
                if (btn === 'WEITER') this._advanceToNextWorld();
                else if (btn === 'STARTSEITE') this.state = 'TITLE';
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'WIN') {
            if (Input.attackPressed || Input._key('Enter') || Input._key('Space')) {
                this.state = 'TITLE';
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'BOSS_INTRO') {
            Input.postUpdate();
            return;
        }

        // ── Playing ──
        this.world.update(dt);
        this.player.update(dt, this.world);

        // Check player death
        if (this.player.dead && this.player.deathTimer <= 0) {
            this.state = 'GAME_OVER';
            Sound.gameOver();
            this.vibrate(300);
        }

        // Enemies
        for (const enemy of this.enemies) {
            if (enemy.dead) {
                enemy.deathTimer -= dt;
                continue;
            }
            if (enemy.isBoss) {
                enemy.update(dt, this.world, this.player, this.enemies, this.particles);
            } else {
                enemy.update(dt, this.world, this.player, this.enemies, this.projectiles);
            }

            // Contact damage
            if (!enemy.dead && enemy.contactDamage && !this.player.dead) {
                if (rectOverlap(
                    { x: this.player.x, y: this.player.y, w: this.player.w, h: this.player.h },
                    { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h }
                )) {
                    const angle = angleBetween(
                        { x: enemy.centerX(), y: enemy.centerY() },
                        { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h / 2 }
                    );
                    this.player.takeDamage(enemy.damage, angle, 150);
                    this.camera.shake(4, 0.2);
                    Sound.playerHit();
                    this.vibrate(50);

                    for (let i = 0; i < 4; i++) {
                        this.particles.push(new Particle(
                            this.player.x + this.player.w / 2,
                            this.player.y + this.player.h / 2,
                            randRange(-80, 80), randRange(-80, 80),
                            '#F44', 0.3
                        ));
                    }
                }
            }
        }

        // Melee weapon hit detection
        if (this.player.activeWeapon.type === 'melee') {
            const hitEnemies = this.player.activeWeapon.getHitEntities(this.player, this.enemies);
            for (const enemy of hitEnemies) {
                const angle = angleBetween(
                    { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h / 2 },
                    { x: enemy.centerX(), y: enemy.centerY() }
                );
                let damage = this.player.activeWeapon.damage;
                if (this.player.hasPowerUp('attack')) damage += 2;
                enemy.takeDamage(damage, angle, this.player.activeWeapon.knockback);
                this.camera.shake(3, 0.15);
                Sound.hit();

                if (enemy.dead) Sound.enemyDeath();
                for (let i = 0; i < 3; i++) {
                    this.particles.push(new Particle(
                        enemy.centerX(), enemy.centerY(),
                        randRange(-60, 60), randRange(-60, 60),
                        '#FF0', 0.3
                    ));
                }
            }
        }

        // Ranged weapon shooting
        if (this.player.activeWeapon.type === 'ranged' && (Input.attackPressed || Input.attackHeld)) {
            if (this.player.activeWeapon.attack(this.player.facingAngle, this.player, this.projectiles)) {
                Sound.shoot();
            }
        }

        // Projectiles
        for (const proj of this.projectiles) {
            proj.update(dt, this.world);
            if (proj.dead) continue;

            if (proj.owner === 'player') {
                for (const enemy of this.enemies) {
                    if (enemy.dead) continue;
                    const dist = vecDist(
                        { x: proj.x, y: proj.y },
                        { x: enemy.centerX(), y: enemy.centerY() }
                    );
                    if (dist < proj.radius + Math.max(enemy.w, enemy.h) / 2) {
                        const angle = Math.atan2(proj.vy, proj.vx);
                        let damage = proj.damage;
                        if (this.player.hasPowerUp('attack')) damage += 1;
                        enemy.takeDamage(damage, angle, proj.knockback);
                        proj.dead = true;
                        Sound.hit();
                        if (enemy.dead) Sound.enemyDeath();
                        for (let i = 0; i < 3; i++) {
                            this.particles.push(new Particle(
                                proj.x, proj.y,
                                randRange(-60, 60), randRange(-60, 60),
                                '#FF0', 0.3
                            ));
                        }
                        break;
                    }
                }
            } else if (proj.owner === 'enemy' && !this.player.dead) {
                const dist = vecDist(
                    { x: proj.x, y: proj.y },
                    { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h / 2 }
                );
                if (dist < proj.radius + this.player.w / 2) {
                    const angle = Math.atan2(proj.vy, proj.vx);
                    this.player.takeDamage(1, angle, 100);
                    proj.dead = true;
                    this.camera.shake(3, 0.15);
                }
            }
        }

        // Chests
        for (const chest of this.chests) {
            if (!chest.opened && chest.canInteract(this.player) && Input.attackPressed) {
                chest.open();
                Sound.chest();
                for (let i = 0; i < 5; i++) {
                    this.particles.push(new Particle(
                        chest.x + chest.w / 2, chest.y + chest.h / 2,
                        randRange(-40, 40), randRange(-60, -20),
                        '#FFD700', 0.5
                    ));
                }
            }
            chest.update(dt, this.player);
        }

        // Key drops
        for (const key of this.keyDrops) {
            if (key.update(dt, this.player)) {
                this.hasKey = true;
                this.world.openBossDoor();
                Sound.key();
                for (let i = 0; i < 8; i++) {
                    this.particles.push(new Particle(
                        key.x + key.w / 2, key.y + key.h / 2,
                        randRange(-60, 60), randRange(-60, 60),
                        '#FFD700', 0.6
                    ));
                }
            }
        }

        // Check for dead key ghost → spawn key
        for (const enemy of this.enemies) {
            if (enemy.isKeyGhost && enemy.dead && !enemy.droppedKey) {
                enemy.droppedKey = true;
                this.keyDrops.push(new KeyDrop(enemy.centerX(), enemy.centerY()));
            }
        }

        // Track slime kills for auto charge (World 3)
        if (this.currentWorld === 3 && this.player.hasAuto) {
            for (const enemy of this.enemies) {
                if (enemy.dead && !enemy._countedForCharge && enemy.constructor.name === 'Slime') {
                    enemy._countedForCharge = true;
                    this.player.addAutoCharge();
                }
            }
        }

        // Boss door trigger
        if (this.hasKey && this.world.bossDoorOpen && !this.bossActive && !this.bossDefeated) {
            const px = this.player.x + this.player.w / 2;
            const py = this.player.y + this.player.h / 2;
            // Find boss door position dynamically
            for (const dPos of this.world.bossDoorTiles) {
                const doorCX = dPos.x * 32 + 16;
                const doorCY = dPos.y * 32 + 16;
                if (vecDist({ x: px, y: py }, { x: doorCX, y: doorCY }) < 40) {
                    // Teleport into boss room
                    this.player.x = this.world.bossSpawn.x - this.player.w / 2;
                    this.player.y = this.world.bossSpawn.y - this.player.h / 2 - 64;
                    this._spawnBoss();
                    // Lock boss room
                    for (const pos of this.world.bossDoorTiles) {
                        this.world.tiles[pos.y][pos.x] = TILE_WALL;
                    }
                    break;
                }
            }
        }

        // Check boss defeated
        if (this.bossActive && !this.bossDefeated) {
            const boss = this.enemies.find(e => e.isBoss);
            if (boss && boss.dead && boss.deathTimer <= 0) {
                this._onBossDefeated();
            }
        }

        // Particles
        for (const p of this.particles) {
            p.update(dt);
        }

        // Cleanup + particle cap
        this.enemies = this.enemies.filter(e => !(e.dead && e.deathTimer <= 0 && !e.isBoss));
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.particles = this.particles.filter(p => !p.dead);
        if (this.particles.length > MAX_PARTICLES) {
            this.particles.splice(0, this.particles.length - MAX_PARTICLES);
        }

        // Camera
        if (!this.player.dead) {
            this.camera.follow(this.player, this.world.pixelWidth, this.world.pixelHeight, dt);
        }

        Input.postUpdate();
    },

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'TITLE') {
            Renderer.drawTitleScreen(ctx);
            return;
        }

        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // World
        this.world.draw(ctx, this.camera);

        // Chests
        for (const chest of this.chests) {
            chest.draw(ctx, this.camera);
        }

        // Key drops
        for (const key of this.keyDrops) {
            key.draw(ctx, this.camera);
        }

        // Enemies (with offscreen culling)
        for (const enemy of this.enemies) {
            if (enemy.dead && enemy.deathTimer <= 0) continue;
            if (!enemy.isBoss && !isOnScreen(enemy, this.camera)) continue;
            enemy.draw(ctx, this.camera);
        }

        // Projectiles (with offscreen culling)
        for (const proj of this.projectiles) {
            if (!isOnScreen({ x: proj.x - 5, y: proj.y - 5, w: 10, h: 10 }, this.camera, 10)) continue;
            proj.draw(ctx, this.camera);
        }

        // Player
        if (this.player) {
            this.player.draw(ctx, this.camera);
        }

        // Particles (with offscreen culling)
        for (const p of this.particles) {
            if (!isOnScreen({ x: p.x - 5, y: p.y - 5, w: 10, h: 10 }, this.camera, 10)) continue;
            p.draw(ctx, this.camera);
        }

        // HUD
        Renderer.drawHUD(ctx, this.player, this);

        // Overlays
        if (this.state === 'GAME_OVER') {
            Renderer.drawGameOver(ctx);
        } else if (this.state === 'WIN') {
            Renderer.drawFinalWinScreen(ctx);
        } else if (this.state === 'WORLD_CLEAR') {
            Renderer.drawWorldClearScreen(ctx, this.currentWorld);
        }

        // Chest interaction hint
        for (const chest of this.chests) {
            if (!chest.opened && chest.canInteract(this.player)) {
                const pos = this.camera.worldToScreen(chest.x + chest.w / 2, chest.y - 10);
                ctx.save();
                ctx.fillStyle = '#FFF';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(Input.isMobile ? 'Tippen' : 'Klick', pos.x, pos.y);
                ctx.restore();
            }
        }

        // Fade overlay
        if (this.fadeAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${this.fadeAlpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
};

// ── Start ──
window.addEventListener('load', () => Game.init());
