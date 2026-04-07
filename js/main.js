// ── Main Game ──

const Game = {
    canvas: null,
    ctx: null,
    state: 'TITLE', // TITLE, PLAYING, BOSS_INTRO, GAME_OVER, WORLD_CLEAR, WIN
    currentWorld: 1, // 1, 2, 3
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

    // Persistent unlocks across worlds
    unlockedRanged: false,
    unlockedAuto: false,
    unlockedCrown: false,

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

        Input.init(this.canvas);
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
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
        this.currentWorld = 1;
        this.unlockedRanged = false;
        this.unlockedAuto = false;
        this.unlockedCrown = false;
        this.startWorld(1);
    },

    startWorld(worldNum) {
        this.currentWorld = worldNum;
        this.state = 'PLAYING';
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
        const levels = [null, WORLD1_LEVEL, WORLD2_LEVEL, WORLD3_LEVEL];
        const themes = [null, 'castle', 'factory', 'cave'];
        this.world.load(levels[worldNum]);
        this.world.theme = themes[worldNum];

        // Spawn player
        this.player = new Player(this.world.spawnPoint.x, this.world.spawnPoint.y);

        // Apply unlocked abilities
        if (this.unlockedRanged) {
            this.player.rangedWeapon = new BaseballLauncher();
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

        // Spawn enemies and chests for this world
        this._spawnWorldContent(worldNum);
    },

    _spawnWorldContent(worldNum) {
        if (worldNum === 1) {
            this._spawnWorld1();
        } else if (worldNum === 2) {
            this._spawnWorld2();
        } else if (worldNum === 3) {
            this._spawnWorld3();
        }
    },

    // ── World 1: Ghost Castle ──
    _spawnWorld1() {
        // Ghosts
        this.enemies.push(new Ghost(5 * 32 + 16, 3 * 32 + 16));
        this.enemies.push(new Ghost(6 * 32 + 16, 5 * 32 + 16));
        this.enemies.push(new Ghost(13 * 32 + 16, 6 * 32 + 16));
        this.enemies.push(new Ghost(13 * 32 + 16, 9 * 32 + 16));
        this.enemies.push(new Ghost(12 * 32 + 16, 10 * 32 + 16));
        this.enemies.push(new Ghost(14 * 32 + 16, 11 * 32 + 16));
        this.enemies.push(new Ghost(11 * 32 + 16, 12 * 32 + 16));
        this.enemies.push(new Ghost(20 * 32 + 16, 11 * 32 + 16));
        this.enemies.push(new Ghost(24 * 32 + 16, 13 * 32 + 16));
        this.enemies.push(new KeyGhost(24 * 32 + 16, 19 * 32 + 16));
        this.enemies.push(new Ghost(23 * 32 + 16, 18 * 32 + 16));
        this.enemies.push(new Ghost(25 * 32 + 16, 20 * 32 + 16));
        this.enemies.push(new Ghost(12 * 32 + 16, 18 * 32 + 16));
        this.enemies.push(new Ghost(14 * 32 + 16, 19 * 32 + 16));

        // Chests
        this.chests.push(new Chest(6 * 32 + 4, 6 * 32 + 6));
        this.chests.push(new Chest(15 * 32 + 4, 10 * 32 + 6));
        this.chests.push(new Chest(24 * 32 + 4, 11 * 32 + 6));
        this.chests.push(new Chest(13 * 32 + 4, 20 * 32 + 6));
        this.chests.push(new Chest(12 * 32 + 4, 20 * 32 + 6));
    },

    // ── World 2: Robot Chick Factory ──
    _spawnWorld2() {
        // RoboChicks in factory rooms
        this.enemies.push(new RoboChick(6 * 32 + 16, 5 * 32 + 16));
        this.enemies.push(new RoboChick(8 * 32 + 16, 7 * 32 + 16));
        this.enemies.push(new RoboChick(16 * 32 + 16, 5 * 32 + 16));
        this.enemies.push(new RoboChick(20 * 32 + 16, 8 * 32 + 16));
        this.enemies.push(new RoboChick(14 * 32 + 16, 12 * 32 + 16));
        this.enemies.push(new RoboChick(18 * 32 + 16, 14 * 32 + 16));
        // MiniRoboChicks
        this.enemies.push(new MiniRoboChick(7 * 32 + 16, 4 * 32 + 16));
        this.enemies.push(new MiniRoboChick(19 * 32 + 16, 6 * 32 + 16));
        this.enemies.push(new MiniRoboChick(15 * 32 + 16, 13 * 32 + 16));
        this.enemies.push(new MiniRoboChick(22 * 32 + 16, 10 * 32 + 16));
        // Key ghost (same mechanic, different look could be a RoboChick variant)
        this.enemies.push(new KeyGhost(26 * 32 + 16, 18 * 32 + 16));
        this.enemies.push(new RoboChick(25 * 32 + 16, 17 * 32 + 16));
        this.enemies.push(new MiniRoboChick(27 * 32 + 16, 19 * 32 + 16));

        // Chests
        this.chests.push(new Chest(5 * 32 + 4, 7 * 32 + 6));
        this.chests.push(new Chest(17 * 32 + 4, 6 * 32 + 6));
        this.chests.push(new Chest(22 * 32 + 4, 12 * 32 + 6));
        this.chests.push(new Chest(14 * 32 + 4, 19 * 32 + 6));
        this.chests.push(new Chest(10 * 32 + 4, 15 * 32 + 6));
    },

    // ── World 3: Slime Arena ──
    _spawnWorld3() {
        // Slimes throughout the caves
        this.enemies.push(new Slime(6 * 32 + 16, 5 * 32 + 16));
        this.enemies.push(new Slime(8 * 32 + 16, 8 * 32 + 16));
        this.enemies.push(new Slime(14 * 32 + 16, 6 * 32 + 16));
        this.enemies.push(new Slime(18 * 32 + 16, 5 * 32 + 16));
        this.enemies.push(new Slime(12 * 32 + 16, 12 * 32 + 16));
        this.enemies.push(new Slime(16 * 32 + 16, 14 * 32 + 16));
        this.enemies.push(new Slime(20 * 32 + 16, 10 * 32 + 16));
        this.enemies.push(new Slime(24 * 32 + 16, 8 * 32 + 16));
        this.enemies.push(new Slime(10 * 32 + 16, 16 * 32 + 16));
        this.enemies.push(new Slime(22 * 32 + 16, 14 * 32 + 16));
        // Key ghost
        this.enemies.push(new KeyGhost(24 * 32 + 16, 18 * 32 + 16));
        this.enemies.push(new Slime(23 * 32 + 16, 17 * 32 + 16));
        this.enemies.push(new Slime(25 * 32 + 16, 19 * 32 + 16));

        // Chests
        this.chests.push(new Chest(7 * 32 + 4, 6 * 32 + 6));
        this.chests.push(new Chest(15 * 32 + 4, 7 * 32 + 6));
        this.chests.push(new Chest(21 * 32 + 4, 9 * 32 + 6));
        this.chests.push(new Chest(11 * 32 + 4, 14 * 32 + 6));
        this.chests.push(new Chest(17 * 32 + 4, 16 * 32 + 6));
    },

    _spawnBoss() {
        this.bossActive = true;
        this.state = 'BOSS_INTRO';

        let boss;
        if (this.currentWorld === 1) {
            boss = new BossGhost(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 2) {
            boss = new BossGhostChick(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 3) {
            boss = new BossSlime(this.world.bossSpawn.x, this.world.bossSpawn.y);
        }
        this.enemies.push(boss);

        setTimeout(() => {
            if (this.state === 'BOSS_INTRO') this.state = 'PLAYING';
        }, 2000);
    },

    _onBossDefeated() {
        this.bossDefeated = true;

        if (this.currentWorld === 1) {
            // Reward: Baseball-Werfer
            this.unlockedRanged = true;
            this.state = 'WORLD_CLEAR';
            this.worldClearTimer = 4;
        } else if (this.currentWorld === 2) {
            // Reward: Auto ability
            this.unlockedAuto = true;
            this.state = 'WORLD_CLEAR';
            this.worldClearTimer = 4;
        } else if (this.currentWorld === 3) {
            // Reward: Crown
            this.unlockedCrown = true;
            this.state = 'WIN'; // Final victory!
        }
    },

    _advanceToNextWorld() {
        if (this.currentWorld < 3) {
            this.startWorld(this.currentWorld + 1);
        }
    },

    gameLoop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
        this.lastTime = timestamp;
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
            if (Input.attackPressed || Input._key('Enter') || Input._key('Space')) {
                this.startNewGame();
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'GAME_OVER') {
            if (Input.attackPressed || Input._key('Enter') || Input._key('Space')) {
                // Restart current world
                this.startWorld(this.currentWorld);
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'WORLD_CLEAR') {
            this.worldClearTimer -= dt;
            if (this.worldClearTimer <= 0 || Input.attackPressed || Input._key('Enter')) {
                this._advanceToNextWorld();
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
            this.player.activeWeapon.attack(this.player.facingAngle, this.player, this.projectiles);
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

        // Cleanup
        this.enemies = this.enemies.filter(e => !(e.dead && e.deathTimer <= 0 && !e.isBoss));
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.particles = this.particles.filter(p => !p.dead);

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

        // Enemies
        for (const enemy of this.enemies) {
            if (enemy.dead && enemy.deathTimer <= 0) continue;
            enemy.draw(ctx, this.camera);
        }

        // Projectiles
        for (const proj of this.projectiles) {
            proj.draw(ctx, this.camera);
        }

        // Player
        if (this.player) {
            this.player.draw(ctx, this.camera);
        }

        // Particles
        for (const p of this.particles) {
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
    }
};

// ── Start ──
window.addEventListener('load', () => Game.init());
