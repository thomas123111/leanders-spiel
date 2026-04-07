// ── Main Game ──

const Game = {
    canvas: null,
    ctx: null,
    state: 'TITLE', // TITLE, PLAYING, BOSS_INTRO, GAME_OVER, WIN
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
    lastTime: 0,

    init() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        Input.init(this.canvas);
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    },

    resize() {
        const dpr = 1; // keep it simple for performance
        const maxW = 640;
        const maxH = 480;
        const aspect = maxW / maxH;
        let w = window.innerWidth;
        let h = window.innerHeight;

        if (w / h > aspect) {
            w = h * aspect;
        } else {
            h = w / aspect;
        }

        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = maxW;
        this.canvas.height = maxH;
    },

    startGame() {
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
        this.world.load(WORLD1_LEVEL);

        // Spawn player
        this.player = new Player(this.world.spawnPoint.x, this.world.spawnPoint.y);

        // Camera
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        this.camera.x = this.player.x - this.canvas.width / 2;
        this.camera.y = this.player.y - this.canvas.height / 2;

        // Spawn enemies
        this._spawnEnemies();

        // Spawn chests
        this._spawnChests();
    },

    _spawnEnemies() {
        // Regular ghosts in the rooms
        // Room 1 (entrance): 2 ghosts
        this.enemies.push(new Ghost(5 * 32 + 16, 3 * 32 + 16));
        this.enemies.push(new Ghost(6 * 32 + 16, 5 * 32 + 16));

        // Corridor: 2 ghosts
        this.enemies.push(new Ghost(13 * 32 + 16, 6 * 32 + 16));
        this.enemies.push(new Ghost(13 * 32 + 16, 9 * 32 + 16));

        // Central room: 3 ghosts
        this.enemies.push(new Ghost(12 * 32 + 16, 10 * 32 + 16));
        this.enemies.push(new Ghost(14 * 32 + 16, 11 * 32 + 16));
        this.enemies.push(new Ghost(11 * 32 + 16, 12 * 32 + 16));

        // Right corridor + room: 2 ghosts
        this.enemies.push(new Ghost(20 * 32 + 16, 11 * 32 + 16));
        this.enemies.push(new Ghost(24 * 32 + 16, 13 * 32 + 16));

        // Key ghost room (right side)
        this.enemies.push(new KeyGhost(24 * 32 + 16, 19 * 32 + 16));
        this.enemies.push(new Ghost(23 * 32 + 16, 18 * 32 + 16));
        this.enemies.push(new Ghost(25 * 32 + 16, 20 * 32 + 16));

        // Lower left room (treasure room): 2 ghosts
        this.enemies.push(new Ghost(12 * 32 + 16, 18 * 32 + 16));
        this.enemies.push(new Ghost(14 * 32 + 16, 19 * 32 + 16));
    },

    _spawnChests() {
        // Entrance room
        this.chests.push(new Chest(6 * 32 + 4, 6 * 32 + 6));
        // Central room
        this.chests.push(new Chest(15 * 32 + 4, 10 * 32 + 6));
        // Right room
        this.chests.push(new Chest(24 * 32 + 4, 11 * 32 + 6));
        // Treasure room (lower left)
        this.chests.push(new Chest(13 * 32 + 4, 20 * 32 + 6));
        // Before boss
        this.chests.push(new Chest(12 * 32 + 4, 20 * 32 + 6));
    },

    _spawnBoss() {
        this.bossActive = true;
        this.state = 'BOSS_INTRO';
        const boss = new BossGhost(this.world.bossSpawn.x, this.world.bossSpawn.y);
        this.enemies.push(boss);

        setTimeout(() => {
            if (this.state === 'BOSS_INTRO') this.state = 'PLAYING';
        }, 2000);
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
                this.startGame();
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'GAME_OVER') {
            if (Input.attackPressed || Input._key('Enter') || Input._key('Space')) {
                this.startGame();
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'WIN') {
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
                enemy.update(dt, this.world, this.player);
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
                    // Hit particles
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
                // Hit particles
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
        if (this.player.activeWeapon.type === 'ranged' && Input.attackPressed) {
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
                // Particles
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
                // Particles
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

        // Check for boss trigger (player enters boss room)
        if (this.hasKey && !this.bossActive && !this.bossDefeated) {
            const px = this.player.x + this.player.w / 2;
            const py = this.player.y + this.player.h / 2;
            // Boss room area: rows 23-28, cols 9-17
            if (py > 23 * 32 && px > 9 * 32 && px < 17 * 32) {
                this._spawnBoss();
                // Lock boss room (close the door)
                for (const pos of this.world.bossDoorTiles) {
                    this.world.tiles[pos.y][pos.x] = TILE_WALL;
                }
            }
        }

        // Check boss defeated
        if (this.bossActive && !this.bossDefeated) {
            const boss = this.enemies.find(e => e.isBoss);
            if (boss && boss.dead && boss.deathTimer <= 0) {
                this.bossDefeated = true;
                this.state = 'WIN';
            }
        }

        // Particles
        for (const p of this.particles) {
            p.update(dt);
        }

        // Cleanup dead entities
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

        // Particles (on top)
        for (const p of this.particles) {
            p.draw(ctx, this.camera);
        }

        // HUD
        Renderer.drawHUD(ctx, this.player, this);

        // Game Over
        if (this.state === 'GAME_OVER') {
            Renderer.drawGameOver(ctx);
        }

        // Win
        if (this.state === 'WIN') {
            Renderer.drawWinScreen(ctx);
        }

        // Chest interaction hint
        for (const chest of this.chests) {
            if (!chest.opened && chest.canInteract(this.player)) {
                const pos = this.camera.worldToScreen(chest.x + chest.w / 2, chest.y - 10);
                ctx.save();
                ctx.fillStyle = '#FFF';
                ctx.font = '10px monospace';
                ctx.textAlign = 'center';
                const text = Input.isMobile ? 'Tippen' : 'Klick';
                ctx.fillText(text, pos.x, pos.y);
                ctx.restore();
            }
        }
    }
};

// ── Start ──
window.addEventListener('load', () => Game.init());
