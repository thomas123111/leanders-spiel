// ── Hauptspiel: Zustände, Spielschleife, Welten, Belohnungen ──

const SAVE_KEY = 'mark_save';
const SETTINGS_KEY = 'mark_settings';

// Welten 9 und 10 haben keine eigene Vorlage in world.js
const WORLD9_LEVEL = generateLevel(50, 48, 14, 909);
const WORLD10_LEVEL = generateLevel(52, 48, 14, 1010);
const LEVELS = [TUTORIAL_LEVEL, WORLD1_LEVEL, WORLD2_LEVEL, WORLD3_LEVEL, WORLD4_LEVEL,
    WORLD5_LEVEL, WORLD6_LEVEL, WORLD7_LEVEL, WORLD8_LEVEL, WORLD9_LEVEL, WORLD10_LEVEL,
    WORLD11_LEVEL, WORLD12_LEVEL, WORLD13_LEVEL, WORLD14_LEVEL, WORLD15_LEVEL,
    WORLD16_LEVEL, WORLD17_LEVEL, WORLD18_LEVEL, WORLD19_LEVEL, WORLD20_LEVEL, WORLD21_LEVEL];

const Game = {
    canvas: null,
    ctx: null,
    state: 'TITLE',
    currentWorld: 0, // 0 = Training
    player: null,
    world: null,
    camera: null,
    enemies: [],
    projectiles: [],
    companions: [], // Juri, Krokodil
    particles: [],
    chests: [],
    coinDrops: [],
    props: [],
    keyDrops: [],
    hasKey: false,
    bossActive: false,
    bossDefeated: false,
    bossIntroTime: 0,
    lastTime: 0,
    levelCoins: 0,
    lastReward: null,
    lastUnlockText: '',
    lastDailyText: '',
    titleSpin: 0,

    // Dauerhafte Freischaltungen
    unlockedRanged: false,
    unlockedAuto: false,
    unlockedCrown: false,
    unlockedTripleShot: false,
    unlockedShadowCaster: false,
    unlockedFruitUpgrades: false,
    unlockedGamerPistol: false,
    unlockedBoneBat: false,
    unlockedSnakeCompanion: false,
    unlockedPetrifyStone: false,
    maxWorldUnlocked: 1,
    trainingCompleted: false,
    coins: 0,
    jewels: 0,
    dailyRewardClaimDate: '',
    freeStarTier: null,
    boseStarUses: 0,
    shopRandomStarActive: false,
    shopRandomStarTier: 0,
    shopRandomStarAttempts: 5,
    shopRandomStarFinished: false,
    shopRandomStarRevealReady: false,
    worldRewardClaims: {},
    rewardValues: {},
    activeMode: null,

    settings: { sound: true, vibration: true, aimAssist: true, autoFire: false },

    // Epischer Stillstand beim Boss-Sieg
    epicFreezeActive: false,
    epicFreezeTimer: 0,
    epicFreezeBoss: null,
    hitstopTimer: 0,

    // Überblendung
    fadeAlpha: 0,
    fadeDir: 0, // 0 = keine, 1 = ausblenden, -1 = einblenden
    fadeCallback: null,

    // Darstellung: logische Sicht (Welt-Einheiten) und Pixel pro Einheit
    viewW: 800,
    viewH: 400,
    renderScale: 1,
    hudScale: 1,
    hudW: 800,
    hudH: 400,
    cssW: 800,
    cssH: 400,
    quality: 1,
    paused: false,
    _drawList: [],
    _frameTimes: [],
    _qualityTimer: 0,

    init() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.loadSettings();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
        if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
        document.addEventListener('fullscreenchange', () => this.resize());
        document.addEventListener('webkitfullscreenchange', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.onHidden();
        });

        Sound.init();
        this.applySettings();
        Input.init(this.canvas);
        this.loadSave();
        UI.init();
        this.setState('TITLE');
        // Offline-Fähigkeit (nur auf der echten Seite, nicht beim lokalen Entwickeln)
        if ('serviceWorker' in navigator && location.protocol === 'https:') {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
        this.lastTime = performance.now();
        requestAnimationFrame(t => this.gameLoop(t));
    },

    setState(state) {
        const prev = this.state;
        this.state = state;
        if (state !== 'PLAYING' && state !== 'BOSS_INTRO') this.paused = false;
        // Gehaltene Finger aus dem vorigen Bildschirm nicht in den nächsten mitnehmen
        if (!(prev === 'BOSS_INTRO' && state === 'PLAYING')) Input.releaseAll();
        UI.onState(state);
    },

    // ── Bildschirm ──

    // Canvas an Bildschirm anpassen: scharf (devicePixelRatio), unverzerrt, Figuren groß genug fürs Handy.
    resize() {
        const vv = window.visualViewport;
        const cssW = Math.max(1, Math.round(vv ? vv.width : window.innerWidth));
        const cssH = Math.max(1, Math.round(vv ? vv.height : window.innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
        this.cssW = cssW;
        this.cssH = cssH;
        this.canvas.style.width = cssW + 'px';
        this.canvas.style.height = cssH + 'px';
        this.canvas.width = Math.max(1, Math.round(cssW * dpr));
        this.canvas.height = Math.max(1, Math.round(cssH * dpr));

        // Kurze Bildschirmseite zeigt ~330–470 Welt-Einheiten (Handy quer: ~360 → Figuren schön groß).
        const shortSide = Math.min(cssW, cssH);
        const viewShort = clamp(shortSide * 0.92, 330, 470);
        const cssPerUnit = shortSide / viewShort;
        this.viewW = cssW / cssPerUnit;
        this.viewH = cssH / cssPerUnit;
        this.renderScale = this.canvas.width / this.viewW;

        // HUD in CSS-Pixeln, auf Tablets etwas größer.
        const uiZoom = clamp(shortSide / 400, 1, 1.45);
        this.hudScale = (this.canvas.width / cssW) * uiZoom;
        this.hudW = cssW / uiZoom;
        this.hudH = cssH / uiZoom;
        this.safe = this._readSafeArea(uiZoom);
        // Menüs auf Tablets im gleichen Verhältnis vergrößern wie das HUD
        document.documentElement.style.setProperty('--ui-zoom', uiZoom.toFixed(3));

        if (this.camera) {
            this.camera.width = this.viewW;
            this.camera.height = this.viewH;
        }
        if (this.world && this.world.invalidateCache) this.world.invalidateCache();
        this._pausedFrameDrawn = false;
        // Handy hochkant gedreht (Dreh-Hinweis deckt das Spiel ab): mitten im Kampf pausieren
        if (cssH > cssW && typeof Input !== 'undefined' && Input.isMobile &&
            (this.state === 'PLAYING' || this.state === 'BOSS_INTRO') && !this.paused) {
            this.pause(true);
        }
    },

    // Abstände für Notch/abgerundete Ecken (CSS env(safe-area-inset-*)) in HUD-Einheiten.
    _readSafeArea(uiZoom) {
        if (!this._safeProbe) {
            const d = document.createElement('div');
            d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
                'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
            document.body.appendChild(d);
            this._safeProbe = d;
        }
        const cs = getComputedStyle(this._safeProbe);
        const px = v => (parseFloat(v) || 0) / uiZoom;
        return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
    },

    // Bildrate beobachten und Auflösung bei Bedarf senken/heben (schwache Handys).
    _trackPerformance(frameMs) {
        const ft = this._frameTimes;
        ft.push(frameMs);
        if (ft.length > 90) ft.shift();
        this._qualityTimer += frameMs / 1000;
        if (this._qualityTimer < 3 || ft.length < 60 || this.state !== 'PLAYING' || this.paused) return;
        this._qualityTimer = 0;
        const sorted = ft.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        let q = this.quality;
        if (median > 24 && q > 0.55) q = Math.max(0.55, q - 0.15);
        else if (median < 15 && q < 1) q = Math.min(1, q + 0.1);
        if (q !== this.quality) {
            this.quality = q;
            this.resize();
        }
    },

    // Vollbild, danach Querformat sperren (Chrome erlaubt die Sperre erst im Vollbild).
    enterFullscreen() {
        const el = document.documentElement;
        const lock = () => {
            if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        };
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            lock();
            return;
        }
        const request = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!request) return;
        try {
            const p = request.call(el, { navigationUI: 'hide' });
            if (p && typeof p.then === 'function') p.then(lock).catch(() => {});
            else setTimeout(lock, 300);
        } catch (e) { /* kein Vollbild möglich */ }
    },

    // Auf dem Handy beim ersten Spielen automatisch Vollbild (nicht als installierte App).
    maybeFullscreen() {
        const standalone = window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
        if (Input.isMobile && !standalone) this.enterFullscreen();
    },

    onHidden() {
        if (this.state === 'PLAYING' || this.state === 'BOSS_INTRO') this.pause(true);
        this.save();
        Input.releaseAll();
    },

    pause(on) {
        if (this.state !== 'PLAYING' && this.state !== 'BOSS_INTRO') {
            this.paused = false;
            return;
        }
        this.paused = !!on;
        Input.releaseAll();
        UI.showPause(this.paused);
    },

    // ── Einstellungen ──
    loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if (s && typeof s === 'object') Object.assign(this.settings, s);
        } catch (e) { /* Standardwerte */ }
    },

    saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { /* egal */ }
    },

    applySettings() {
        Sound.setMuted(!this.settings.sound);
    },

    // ── Menüs ──
    openWorldSelect() {
        Sound.resume();
        this.activeMode = null;
        this.setState('WORLD_SELECT');
        this.save();
    },

    openExtraMode() {
        Sound.resume();
        this.setState('EXTRA_MENU');
    },

    openShop() {
        this.setState('SHOP');
    },

    returnToTitle() {
        if (this.currentWorld === 0 && (this.state === 'PLAYING' || this.state === 'WORLD_CLEAR')) {
            this.trainingCompleted = true;
            this.maxWorldUnlocked = Math.max(1, this.maxWorldUnlocked);
        }
        this.activeMode = null;
        this.paused = false;
        this.setState('TITLE');
        this.save();
    },

    // ── Speicherstand (gleiches Format wie bisher, damit Leanders Fortschritt erhalten bleibt) ──
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                world: this.currentWorld,
                maxWorld: this.maxWorldUnlocked,
                coins: this.coins,
                jewels: this.jewels,
                trainingDone: this.trainingCompleted,
                dailyRewardClaimDate: this.dailyRewardClaimDate,
                freeStarTier: this.freeStarTier,
                boseStarUses: this.boseStarUses,
                worldRewards: this.worldRewardClaims,
                rewardValues: this.rewardValues,
                ranged: this.unlockedRanged,
                auto: this.unlockedAuto,
                crown: this.unlockedCrown,
                triple: this.unlockedTripleShot,
                shadow: this.unlockedShadowCaster,
                fruit: this.unlockedFruitUpgrades,
                gamer: this.unlockedGamerPistol,
                bone: this.unlockedBoneBat,
                snake: this.unlockedSnakeCompanion,
                petrify: this.unlockedPetrifyStone,
                star: this.shopRandomStarActive ? {
                    tier: this.shopRandomStarTier, tries: this.shopRandomStarAttempts, done: this.shopRandomStarFinished,
                } : null,
            }));
        } catch (e) { /* Speichern nicht möglich (privater Modus) */ }
    },

    loadSave() {
        try {
            const data = JSON.parse(localStorage.getItem(SAVE_KEY));
            if (data) {
                this.currentWorld = clamp(typeof data.world === 'number' ? data.world : 1, 0, LAST_WORLD);
                const maxWorld = typeof data.maxWorld === 'number'
                    ? data.maxWorld
                    : (typeof data.world === 'number' ? data.world : 1);
                this.maxWorldUnlocked = clamp(maxWorld, 1, LAST_WORLD);
                this.coins = Math.max(0, data.coins | 0);
                this.jewels = Math.max(0, data.jewels | 0);
                this.trainingCompleted = !!data.trainingDone;
                this.dailyRewardClaimDate = data.dailyRewardClaimDate || '';
                this.freeStarTier = data.freeStarTier || null;
                this.boseStarUses = Math.max(0, data.boseStarUses | 0);
                this.worldRewardClaims = data.worldRewards || {};
                this.rewardValues = data.rewardValues || {};
                this.unlockedRanged = !!data.ranged;
                this.unlockedAuto = !!data.auto;
                this.unlockedCrown = !!data.crown;
                this.unlockedTripleShot = !!data.triple;
                this.unlockedShadowCaster = !!data.shadow;
                this.unlockedFruitUpgrades = !!data.fruit;
                this.unlockedGamerPistol = !!data.gamer;
                this.unlockedBoneBat = !!data.bone;
                this.unlockedSnakeCompanion = !!data.snake;
                this.unlockedPetrifyStone = !!data.petrify;
                if (data.star && typeof data.star === 'object') {
                    this.shopRandomStarActive = true;
                    this.shopRandomStarTier = clamp(data.star.tier | 0, 0, 3);
                    this.shopRandomStarAttempts = clamp(data.star.tries | 0, 0, 5);
                    this.shopRandomStarFinished = !!data.star.done;
                    this.shopRandomStarRevealReady = !!data.star.done;
                }
            }
        } catch (e) { /* kaputter Speicherstand: neu beginnen */ }
    },

    clearSave() {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* egal */ }
    },

    // ── Belohnungen und Shop ──
    _todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    _worldRewardKey(worldNum) {
        return `w${worldNum}`;
    },

    _worldRewardTable() {
        return {
            1: { label: 'Kein Bonus', coins: 0, jewels: 0 },
            2: { label: 'BASEBALL-WERFER', coins: 0, jewels: 0, item: 'unlockedRanged' },
            3: { label: 'AUTO', coins: 0, jewels: 0, item: 'unlockedAuto' },
            4: { label: 'KRONE', coins: 0, jewels: 0, item: 'unlockedCrown' },
            5: { label: 'Kein Bonus', coins: 0, jewels: 0 },
            6: { label: 'Juri', coins: 0, jewels: 0 },
            7: { label: 'Schatten-Krokodil', coins: 0, jewels: 0 },
            8: { label: 'Kein Bonus', coins: 0, jewels: 0 },
            9: { label: 'SCHATTEN-WERFER', coins: 0, jewels: 0, item: 'unlockedShadowCaster' },
            10: { label: 'OBST-UPGRADES', coins: 0, jewels: 0, item: 'unlockedFruitUpgrades' },
            11: { label: 'GAMER-PISTOLE', coins: 0, jewels: 0, item: 'unlockedGamerPistol' },
            12: { label: 'Kein Bonus', coins: 0, jewels: 0 },
            13: { label: 'KNOCHEN-UPGRADE', coins: 0, jewels: 0 },
            14: { label: 'SCHLANGE', coins: 0, jewels: 0 },
            15: { label: 'STEIN-GIFT', coins: 0, jewels: 0 },
            16: { label: '1000 MUENZEN', coins: 1000, jewels: 0 },
            17: { label: '50 JUWELEN', coins: 0, jewels: 50 },
            18: { label: '1 BOESER STERN', coins: 0, jewels: 0, star: 'green' },
            19: { label: '1 SCHATTEN-MEISTER-STERN', coins: 0, jewels: 0, star: 'yellow' },
            20: { label: '3 BOESE STERNE', coins: 0, jewels: 0, starPack: 3 },
            21: { label: '500 MUENZEN', coins: 500, jewels: 0 },
        };
    },

    _claimWorldReward(worldNum) {
        const key = this._worldRewardKey(worldNum);
        if (this.worldRewardClaims[key]) return null;
        const reward = this._worldRewardTable()[worldNum];
        if (!reward) return null;
        this.worldRewardClaims[key] = true;
        this.rewardValues[key] = 0;
        if (reward.star) this.boseStarUses = (this.boseStarUses || 0) + 1;
        if (reward.starPack) this.boseStarUses = (this.boseStarUses || 0) + reward.starPack;
        return { ...reward, rewardValue: 0 };
    },

    _getWorldReward(worldNum) {
        const key = this._worldRewardKey(worldNum);
        const reward = this._worldRewardTable()[worldNum] || { label: 'Kein Bonus', coins: 0, jewels: 0 };
        return {
            ...reward,
            rewardValue: this.worldRewardClaims[key] ? 0 : (reward.coins || reward.jewels || reward.starPack || 0),
            claimed: !!this.worldRewardClaims[key],
        };
    },

    _grantCoins(amount) {
        this.coins = Math.max(0, this.coins + amount);
    },

    _grantJewels(amount) {
        this.jewels = Math.max(0, this.jewels + amount);
    },

    _spendCoins(amount) {
        if (this.coins < amount) return false;
        this.coins -= amount;
        return true;
    },

    _spendJewels(amount) {
        if (this.jewels < amount) return false;
        this.jewels -= amount;
        return true;
    },

    _grantDailyReward(forcePay) {
        const today = this._todayKey();
        const alreadyClaimed = this.dailyRewardClaimDate === today;
        if (alreadyClaimed && !forcePay) return false;
        if (alreadyClaimed && forcePay && !this._spendCoins(5000)) return false;
        const roll = Math.random();
        if (roll < 0.45) {
            const amount = randInt(150, 700);
            this._grantCoins(amount);
            this.lastDailyText = amount + ' Münzen! 🪙';
        } else if (roll < 0.7) {
            const upgrades = [
                ['unlockedTripleShot', 'Schnell-Wurf'], ['unlockedShadowCaster', 'Schatten-Werfer'],
                ['unlockedGamerPistol', 'Gamer-Pistole'], ['unlockedFruitUpgrades', 'Obst-Upgrades'],
            ];
            const next = upgrades.find(u => !this[u[0]]);
            if (next) {
                this[next[0]] = true;
                this.lastDailyText = next[1] + ' freigeschaltet! 🎁';
            } else {
                this._grantCoins(300);
                this.lastDailyText = '300 Münzen! 🪙';
            }
        } else {
            const tiers = ['green', 'yellow', 'orange', 'red'];
            this.freeStarTier = tiers[randInt(0, tiers.length - 1)];
            const t = STAR_TIERS.find(x => x.id === this.freeStarTier);
            this.lastDailyText = 'Freier Stern: ' + (t ? t.label : '') + ' ⭐';
        }
        this.dailyRewardClaimDate = today;
        this.save();
        return true;
    },

    _consumeFreeStar() {
        const tier = this.freeStarTier;
        this.freeStarTier = null;
        return tier;
    },

    _applyStarReward(tier, free = false) {
        const price = { green: 50, yellow: 150, orange: 200, red: 350 }[tier] || 50;
        if (!free && !this._spendCoins(price)) return false;
        if (tier === 'green') this.unlockedTripleShot = true;
        else if (tier === 'yellow') this.unlockedShadowCaster = true;
        else if (tier === 'orange') this.unlockedGamerPistol = true;
        else if (tier === 'red') this.unlockedCrown = true;
        this.save();
        return true;
    },

    // Böser Stern: kostet einen verdienten Stern oder 100 Münzen (vorher war er versehentlich gratis).
    startBadStar() {
        // Angefangener (schon bezahlter) Stern läuft weiter, statt verloren zu gehen
        if (this.shopRandomStarActive) return true;
        if ((this.boseStarUses || 0) > 0) this.boseStarUses--;
        else if (!this._spendCoins(BAD_STAR_PRICE)) return false;
        this.shopRandomStarActive = true;
        this.shopRandomStarTier = 0;
        this.shopRandomStarAttempts = 5;
        this.shopRandomStarFinished = false;
        this.shopRandomStarRevealReady = false;
        this.save();
        return true;
    },

    _advanceRandomStarStep() {
        if (this.shopRandomStarFinished) return;
        this.shopRandomStarAttempts--;
        const chances = [0.65, 0.5, 0.35];
        const chance = chances[Math.min(this.shopRandomStarTier, chances.length - 1)];
        if (Math.random() < chance && this.shopRandomStarTier < 3) this.shopRandomStarTier++;
        if (this.shopRandomStarTier >= 3 || this.shopRandomStarAttempts <= 0) {
            this.shopRandomStarFinished = true;
            this.shopRandomStarRevealReady = true;
        }
        this.save();
    },

    openBadStar() {
        const tier = Math.min(this.shopRandomStarTier || 0, 3);
        let text;
        if (tier >= 3) {
            this._grantCoins(1000);
            this.unlockedTripleShot = true;
            this.unlockedShadowCaster = true;
            this.unlockedGamerPistol = true;
            this.unlockedFruitUpgrades = true;
            text = 'ULTRA! 1000 Münzen + alle Werfer-Upgrades! 🔥';
        } else if (tier === 2) {
            this.unlockedGamerPistol = true;
            text = 'Mega Scharf: Gamer-Pistole! 🟠';
        } else if (tier === 1) {
            this.unlockedShadowCaster = true;
            text = 'Super Scharf: Schatten-Werfer! 🟡';
        } else {
            this.unlockedTripleShot = true;
            text = 'Scharf: Schnell-Wurf! 🟢';
        }
        this.shopRandomStarActive = false;
        this.shopRandomStarFinished = false;
        this.shopRandomStarRevealReady = false;
        this.shopRandomStarTier = 0;
        this.shopRandomStarAttempts = 5;
        this.save();
        return text;
    },

    // ── Kleine Effekte ──
    doHitstop(duration) {
        this.hitstopTimer = Math.max(this.hitstopTimer, duration);
    },

    vibrate(ms) {
        if (this.settings.vibration && navigator.vibrate) {
            try { navigator.vibrate(ms); } catch (e) { /* egal */ }
        }
    },

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

    // ── Welt starten ──
    startWorld(worldNum) {
        worldNum = clamp(worldNum | 0, 0, LAST_WORLD);
        Sound.resume();
        this.currentWorld = worldNum;
        this.trainingMode = worldNum === 0;
        this.paused = false;
        this.hitstopTimer = 0;
        this.epicFreezeActive = false;
        this.epicFreezeTimer = 0;
        this.epicFreezeBoss = null;
        this.fadeCallback = null;
        this.fadeIn();
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.chests = [];
        this.coinDrops = [];
        this.props = [];
        this.companions = [];
        this.keyDrops = [];
        this.hasKey = false;
        this.bossActive = false;
        this.bossDefeated = false;
        this.bossIntroTime = 0;
        this.levelCoins = 0;
        this.lastReward = null;
        this.lastUnlockText = '';
        this._trainingDoneShown = false;

        // Welt laden
        this.world = new World();
        this.world.theme = worldInfo(worldNum).theme;
        this.world.worldNum = worldNum;
        this.world.load(LEVELS[worldNum]);

        this.player = new Player(this.world.spawnPoint.x, this.world.spawnPoint.y);

        // Begleiter
        if (worldNum >= 7) {
            const juri = new Juri(this.player.x + 30, this.player.y + 20);
            if (worldNum >= 8) juri.fireCircle = true;
            if (this.unlockedFruitUpgrades) juri.melonHammers = true;
            this.companions.push(juri);
            const croc = new ShadowCrocodile(this.player.x - 30, this.player.y + 20);
            if (worldNum >= 9) croc.fireExplosion = true;
            if (this.unlockedFruitUpgrades) croc.fruitAmmo = true;
            this.companions.push(croc);
        }

        // Freigeschaltete Fähigkeiten
        if (this.unlockedRanged || worldNum >= 3) {
            this.unlockedRanged = true;
            const w = new BaseballLauncher();
            w.tripleShot = true;
            w.poison = true;
            if (this.unlockedShadowCaster || worldNum >= 10) {
                w.damage = 5;
                w.shadowCaster = true;
            }
            if (this.unlockedGamerPistol || worldNum >= 12) {
                w.damage = 7;
                w.gamerPistol = true;
            }
            // Stern „Scharf“ (Schnell-Wurf): schnellere Würfe
            if (this.unlockedTripleShot) w.cooldown = 0.22;
            this.player.rangedWeapon = w;
            if (worldNum >= 3) this.player.activeWeapon = w;
        }
        // Welt 10: Obst-Upgrades (Orangen-Explosion bei Treffern, Begleiter mit Obst)
        if (this.unlockedFruitUpgrades) this.player.orangeExplosion = true;
        // Welt 13: Knochen-Schläger (mehr Schaden)
        if (this.unlockedBoneBat) {
            this.player.meleeWeapon.damage += 2;
            this.player.meleeWeapon.boneBat = true;
        }
        // Welt 14: kleine Schlange auf Marks Schulter spuckt Gift
        if (this.unlockedSnakeCompanion && worldNum > 0 && typeof SnakeBuddy !== 'undefined') {
            this.companions.push(new SnakeBuddy(this.player.x, this.player.y));
        }
        if (this.unlockedAuto) {
            this.player.hasAuto = true;
            if (worldNum === 3) {
                // In Welt 3 muss das Auto erst mit 5 Schleim-Treffern aufgeladen werden
                this.player.autoReady = false;
                this.player.autoCharges = 0;
            }
        }
        if (this.unlockedCrown) {
            this.player.hasCrown = true;
            this.player.startCrownShield();
        }
        if (worldNum === 0) {
            this.player.hasAuto = false;
            this.player.rangedWeapon = null;
            this.player.activeWeapon = this.player.meleeWeapon;
        }

        // Kamera
        this.camera = new Camera(this.viewW, this.viewH);
        this.camera.x = this.player.x + this.player.w / 2 - this.viewW / 2;
        this.camera.y = this.player.y + this.player.h / 2 - this.viewH / 2;
        this.camera.clampTo(this.world.pixelWidth, this.world.pixelHeight);
        this._lastCam = { x: this.camera.x, y: this.camera.y };
        FX.reset();
        FX.setAmbient(this.world.theme, this.viewW, this.viewH);

        // Freie Bodenfelder für Gegner (nicht im Boss-Raum), gemischt
        this._floorTiles = [];
        for (let y = 2; y < this.world.height - 2; y++) {
            for (let x = 2; x < this.world.width - 2; x++) {
                if (this.world.tiles[y][x] === TILE_FLOOR && !this._isBossRoomTile(x, y)) {
                    this._floorTiles.push({ x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 });
                }
            }
        }
        for (let i = this._floorTiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._floorTiles[i], this._floorTiles[j]] = [this._floorTiles[j], this._floorTiles[i]];
        }

        this._spawnWorldContent(worldNum);
        HUD.onWorldStart();
        this.setState('PLAYING');
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
        return this._floorTiles.pop() || { x: px + 64, y: py };
    },

    _isBossRoomTile(tx, ty) {
        if (!this.world) return false;
        return tx >= this.world.width - 13 &&
            tx <= this.world.width - 3 &&
            ty >= this.world.height - 11 &&
            ty <= this.world.height - 3;
    },

    // Innenraum des Boss-Raums in Welt-Einheiten
    _bossRoomRect() {
        const w = this.world.width;
        const h = this.world.height;
        return { x: (w - 13) * TILE_SIZE, y: (h - 11) * TILE_SIZE, w: 11 * TILE_SIZE, h: 9 * TILE_SIZE };
    },

    _spawnAt(EnemyClass, minDist) {
        const p = this._getSpawnPos(minDist || 150);
        return new EnemyClass(p.x, p.y);
    },

    _spawnChestAt() {
        const p = this._getSpawnPos(80);
        return new Chest(p.x - 12, p.y - 10);
    },

    // Gegner, Schlüsselträger und Truhen je Welt
    _spawnWorldContent(worldNum) {
        const add = (K, n, minDist) => { for (let i = 0; i < n; i++) this.enemies.push(this._spawnAt(K, minDist)); };
        const chests = n => { for (let i = 0; i < n; i++) this.chests.push(this._spawnChestAt()); };
        const keyCarrier = K => {
            const e = this._spawnAt(K, 300);
            e.isKeyGhost = true;
            this.enemies.push(e);
        };
        switch (worldNum) {
            case 0:
                add(TrainingTargetRobot, 4, 120);
                add(TrainingPatrolRobot, 4, 160);
                add(TrainingShooterRobot, 3, 200);
                for (let i = 0; i < 4; i++) {
                    const p = this._getSpawnPos(60);
                    this.props.push(new SkullProp(p.x - 8, p.y - 8));
                }
                break;
            case 1: add(Ghost, 25); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(6); break;
            case 2:
                add(RoboChick, 6); add(MiniRoboChick, 4); add(Drone, 5);
                this.enemies.push(this._spawnAt(GiantEgg, 300)); chests(6); break;
            case 3: add(Slime, 16); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(6); break;
            case 4: add(ShadowKnight, 10); add(GiantBat, 6); this.enemies.push(this._spawnAt(KeyKnight, 300)); chests(6); break;
            case 5: add(WalkingMushroom, 18); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 6: add(SwampMosquito, 20); this.enemies.push(this._spawnAt(CrocodileKid, 300)); chests(7); break;
            case 7: add(IcePenguin, 16); add(GiantBat, 4); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 8: add(LavaBall, 20); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 9: add(ShadowGhost, 16); add(ShadowWraith, 4); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 10: add(AngryFruit, 18); add(GiantPlant, 5); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 11: add(PixelGhost, 20); add(PixelRobot, 1, 300); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 12: add(StarKnight, 18); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 13: add(SkeletonArcher, 16); add(BoomerangSkeleton, 1, 300); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 14: add(PoisonSnake, 22); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 15: add(StoneSamurai, 16); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7); break;
            case 16:
                add(AppleNinja, 10); add(KiwiNinja, 8); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(7);
                for (let i = 0; i < 6; i++) this.props.push(new SkullProp(this.player.x + 100 + i * 22, this.player.y + 60 + (i % 2) * 18));
                break;
            case 17: add(MiniTRex, 16); add(Triceratops, 6); this.enemies.push(this._spawnAt(KeyGhost, 300)); chests(8); break;
            case 18: add(TimeClock, 14); keyCarrier(TimeClock); chests(6); break;
            case 19: add(ShadowCrocodileRunner, 16); keyCarrier(ShadowCrocodileRunner); chests(7); break;
            case 20: add(FootballEnemy, 18); keyCarrier(FootballEnemy); chests(7); break;
            case 21: add(ScrapRaccoon, 16); keyCarrier(ScrapRaccoon); chests(7); break;
        }
    },

    _spawnBoss() {
        this.bossActive = true;
        this.bossIntroTime = 0;
        this.setState('BOSS_INTRO');
        Sound.bossIntro();
        this.vibrate(200);
        const bosses = {
            1: BossGhost, 2: BossGhostChick, 3: BossSlime, 4: BossKnightBat, 5: BossMushroomGiant,
            6: BossMosquito, 7: BossSnowEagle, 8: BossFirePhoenix, 9: BossShadowMaster, 10: BossFruitKing,
            11: BossGhostChick, 12: BossKnightBat, 13: BossSkeletonRider, 14: BossHydra, 15: BossStoneDemon,
            16: BossFruitGiant, 17: BossStingRex, 18: BossTimeSphere, 19: BossShadowCrocodile,
            20: BossFootball, 21: BossScrapRaccoon,
        };
        // Welt 11/12 bekommen eigene Boss-Varianten (Pixel-Roboter, Sternen-Ritter), falls vorhanden
        if (typeof BossPixelRobot !== 'undefined') bosses[11] = BossPixelRobot;
        if (typeof BossStarKnight !== 'undefined') bosses[12] = BossStarKnight;
        const K = bosses[this.currentWorld] || BossGhost;
        const boss = new K(this.world.bossSpawn.x, this.world.bossSpawn.y);
        boss.isBoss = true;
        if (this.currentWorld === 11) { boss.hp = 55; boss.maxHp = 55; }
        if (this.currentWorld === 12) { boss.hp = 65; boss.maxHp = 65; }
        if (!bosses[this.currentWorld]) { boss.hp = 50; boss.maxHp = 50; }
        this.enemies.push(boss);
    },

    _onBossDefeated() {
        this.bossDefeated = true;
        Sound.bossDeath();
        this.camera.shake(8, 0.5);
        this.vibrate(400);

        this.maxWorldUnlocked = Math.min(LAST_WORLD, Math.max(this.maxWorldUnlocked, this.currentWorld + 1));
        Sound.worldClear();

        const reward = this._claimWorldReward(this.currentWorld);
        if (reward) {
            if (reward.coins) this.coins += reward.coins;
            if (reward.jewels) this.jewels += reward.jewels;
        }
        this.lastReward = reward;

        const unlocks = {
            2: ['unlockedRanged', 'Baseball-Werfer! ⚾'],
            3: ['unlockedAuto', 'Das Auto! 🚗'],
            4: ['unlockedCrown', 'Goldene Krone! 👑'],
            9: ['unlockedShadowCaster', 'Schatten-Werfer! 🌈'],
            10: ['unlockedFruitUpgrades', 'Obst-Upgrades! 🍊'],
            11: ['unlockedGamerPistol', 'Gamer-Pistole! 🔫'],
            13: ['unlockedBoneBat', 'Knochen-Upgrade! 🦴'],
            14: ['unlockedSnakeCompanion', 'Schlangen-Freund! 🐍'],
            15: ['unlockedPetrifyStone', 'Stein-Gift! 🪨'],
        };
        const u = unlocks[this.currentWorld];
        this.lastUnlockText = '';
        if (u) {
            if (!this[u[0]]) this.lastUnlockText = u[1];
            this[u[0]] = true;
        }
        if (!this.lastUnlockText && reward) {
            if (reward.star || reward.starPack) this.lastUnlockText = UI._rewardText(reward) + ' 😈';
            else if (this.currentWorld === 6) this.lastUnlockText = 'Juri hilft dir bald! 🧒';
            else if (this.currentWorld === 7) this.lastUnlockText = 'Das Schatten-Krokodil ist dabei! 🐊';
        }

        this.save();
        FX.confetti(this.player.x + this.player.w / 2, this.player.y, 60);
        // Kurz den Sieg genießen, dann Ergebnis zeigen
        this._resultDelay = 1.2;
        this._resultState = this.currentWorld >= LAST_WORLD ? 'WIN' : 'WORLD_CLEAR';
    },

    _advanceToNextWorld() {
        if (this.currentWorld < LAST_WORLD) this.startWorld(this.currentWorld + 1);
        else this.returnToTitle();
    },

    // ── Spielschleife ──
    gameLoop(timestamp) {
        const rawMs = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this._frame(rawMs);
        requestAnimationFrame(t => this.gameLoop(t));
    },

    // Für Tests: n Bilder simulieren, ohne auf requestAnimationFrame zu warten.
    debugStep(n = 1, ms = 1000 / 60, draw = false) {
        const r = this.render;
        if (!draw) this.render = () => {};
        try {
            for (let i = 0; i < n; i++) this._frame(ms);
        } finally {
            this.render = r;
        }
    },

    _frame(rawMs) {
        let dt = this.paused ? 0 : Math.min(rawMs / 1000, 0.05);
        if (rawMs > 0 && rawMs < 250) this._trackPerformance(rawMs);
        if (this.hitstopTimer > 0 && dt > 0) {
            this.hitstopTimer -= dt;
            dt *= 0.12;
        }
        Art.time += dt;
        FX.update(dt);
        HUD.update(dt);
        if (this.titleSpin > 0) this.titleSpin = Math.max(0, this.titleSpin - rawMs / 900);

        if (this.fadeDir !== 0) {
            this.fadeAlpha += this.fadeDir * Math.min(rawMs / 1000, 0.05) * 3;
            if (this.fadeDir === 1 && this.fadeAlpha >= 1) {
                this.fadeAlpha = 1;
                this.fadeDir = 0;
                if (this.fadeCallback) this.fadeCallback();
            } else if (this.fadeDir === -1 && this.fadeAlpha <= 0) {
                this.fadeAlpha = 0;
                this.fadeDir = 0;
            }
        }

        if (this.paused) {
            if (Input.pausePressed) this.pause(false);
            Input.postUpdate();
        } else {
            try {
                this.update(dt);
            } catch (err) {
                // Ein unerwarteter Fehler darf das Spiel nicht einfrieren.
                Input.postUpdate();
                if (!this._updateErrorShown) {
                    this._updateErrorShown = true;
                    console.error('Spielfehler:', err);
                }
            }
        }
        // In der Pause reicht ein einziges Bild (spart Akku)
        if (this.paused && this._pausedFrameDrawn) return;
        this._pausedFrameDrawn = this.paused;
        try {
            this.render();
        } catch (err) {
            if (!this._renderErrorShown) {
                this._renderErrorShown = true;
                console.error('Zeichenfehler:', err);
            }
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    },

    update(dt) {
        const playerScreenPos = this.player && this.camera
            ? this.camera.worldToScreen(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2)
            : null;
        Input.update(dt, playerScreenPos);

        // Menüs: nur Tastatur-Kürzel, Rest läuft über die Oberfläche
        if (['TITLE', 'WORLD_SELECT', 'EXTRA_MENU', 'SHOP'].includes(this.state)) {
            if (this.state === 'TITLE' && Input.keyPressed('Enter')) this.openWorldSelect();
            else if (this.state !== 'TITLE' && Input.keyPressed('Escape')) this.returnToTitle();
            if (this.state === 'TITLE' && Input.keyPressed('KeyF')) this.enterFullscreen();
            Input.postUpdate();
            return;
        }
        if (this.state === 'GAME_OVER') {
            if (Input.keyPressed('Enter')) this.startWorld(this.currentWorld);
            Input.postUpdate();
            return;
        }
        if (this.state === 'WORLD_CLEAR' || this.state === 'WIN') {
            if (Input.keyPressed('Enter')) this._advanceToNextWorld();
            this._updateAmbientOnly(dt);
            Input.postUpdate();
            return;
        }
        if (Input.pausePressed) {
            this.pause(true);
            Input.postUpdate();
            return;
        }
        if (this.state === 'BOSS_INTRO') {
            this.bossIntroTime += dt;
            if (this.bossIntroTime >= 2.2) this.setState('PLAYING');
            this._updateAmbientOnly(dt);
            Input.postUpdate();
            return;
        }

        // ── Spielen ──

        // Boss besiegt: epischer Stillstand – alles hält an, Mark ist sicher, dann Explosion
        if (this.bossActive && !this.bossDefeated && !this.epicFreezeActive) {
            const boss = this.enemies.find(e => e.isBoss);
            if (boss && boss.dead) {
                this.epicFreezeActive = true;
                this.epicFreezeTimer = 1.6;
                this.epicFreezeBoss = boss;
                if (this.player.dead) {
                    // Gleichzeitig besiegt? Der Sieg zählt – Mark steht wieder auf.
                    this.player.dead = false;
                    this.player.hp = Math.max(4, this.player.hp);
                }
                this.player.iFrames = Math.max(this.player.iFrames, 3);
                this.projectiles = this.projectiles.filter(p => p.owner === 'player');
                Sound.bossDeath();
                this.camera.shake(10, 0.6);
                FX.screenFlash('#ffffff', 0.6);
                this.vibrate(400);
            }
        }
        if (this.epicFreezeActive) {
            this.epicFreezeTimer -= dt;
            // Boss bleibt eingefroren stehen und flackert weiß
            if (this.epicFreezeBoss) this.epicFreezeBoss.hitFlash = Math.floor(this.epicFreezeTimer * 9) % 2 ? 0.1 : 0;
            if (Math.random() < dt * 8 && this.epicFreezeBoss) {
                const b = this.epicFreezeBoss;
                FX.burst(b.x + Math.random() * b.w, b.y + Math.random() * b.h, ['#ffd23f', '#ffffff'], 6, 120, 0.4, { kind: 'spark' });
            }
            for (const p of this.particles) p.update(dt);
            this.particles = this.particles.filter(p => !p.dead);
            if (this.epicFreezeTimer <= 0) {
                this.epicFreezeActive = false;
                if (this.epicFreezeBoss) {
                    const bc = this.epicFreezeBoss.center();
                    FX.burst(bc.x, bc.y, ['#ffd23f', '#ff9f1c', '#ff4d6d', '#ffffff'], 36, 280, 1.1);
                    FX.ring(bc.x, bc.y, '#fff6a8', 160, 0.7, 6);
                    FX.screenFlash('#fff6a8', 0.5);
                    for (let i = 0; i < 12; i++) this._dropCoin(bc.x, bc.y, 5, true);
                    this.epicFreezeBoss.deathTimer = 0;
                }
                this._onBossDefeated();
            }
            this._updateCamera(dt);
            Input.postUpdate();
            return;
        }

        this.world.update(dt);
        this._updateAssist();
        this.player.update(dt, this.world);
        if (this.player.dodging && !this._wasDodging) FX.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h - 2, 'rgba(230,240,255,0.9)', 6, 60, 0.4, { kind: 'smoke', size: 4 });
        this._wasDodging = this.player.dodging;

        for (const c of this.companions) c.update(dt, this.world, this.player, this.enemies);
        for (const prop of this.props) prop.update(dt, this.world, this.player, this.enemies);

        // Tod des Spielers (nach dem Bosssieg zählt er nicht mehr)
        if (this.player.dead && this.player.deathTimer <= 0 && this.state === 'PLAYING' && !this.bossDefeated) {
            Sound.gameOver();
            this.vibrate(300);
            this.save();
            this.setState('GAME_OVER');
            Input.postUpdate();
            return;
        }

        // Gegner
        const playerBush = this.world.isBush(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
        for (const enemy of this.enemies) {
            if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
            if (enemy.dead) {
                enemy.deathTimer -= dt;
                if (!enemy._deathFxDone) this._onEnemyDeathFx(enemy);
                continue;
            }
            // Versteinert (Stein-Gift aus Welt 15) oder im Busch versteckt: wartet, bleibt aber verwundbar
            const frozen = enemy.stoneTimer > 0;
            if (frozen) enemy.stoneTimer -= dt;
            const enemyBush = this.world.isBush(enemy.centerX(), enemy.centerY());
            if (frozen || (enemyBush && !playerBush && !enemy.isBoss)) {
                if (enemy.iFrames > 0) enemy.iFrames -= dt;
                continue;
            }
            // Alle Gegner bekommen die Geschoss-Liste. Früher bekamen Bosse die Partikel-Liste –
            // Bosse aus Welt 5–8 legten ihre Geschosse dort ab, was das Spiel abstürzen ließ.
            enemy.update(dt, this.world, this.player, this.enemies, this.projectiles);

            // Berührungsschaden
            if (!enemy.dead && enemy.contactDamage && !this.player.dead &&
                rectOverlap(this.player, enemy)) {
                const angle = angleBetween(
                    { x: enemy.centerX(), y: enemy.centerY() },
                    { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h / 2 }
                );
                this._hurtPlayer(enemy.damage, angle, 150);
            }
        }

        // Sicherheitsnetz im Bosskampf: Boss und Mark bleiben im Boss-Raum, niemand steckt in einer Wand
        if (this.bossActive && !this.bossDefeated) {
            const room = this._bossRoomRect();
            for (const e of this.enemies) {
                if (!e.isBoss || e.dead) continue;
                e.x = clamp(e.x, room.x, Math.max(room.x, room.x + room.w - e.w));
                e.y = clamp(e.y, room.y, Math.max(room.y, room.y + room.h - e.h));
            }
            if (!this.player.dead) {
                this.player.x = clamp(this.player.x, room.x, room.x + room.w - this.player.w);
                this.player.y = clamp(this.player.y, room.y, room.y + room.h - this.player.h);
            }
        }
        if (!this.player.autoActive && !this.player.dead) escapeFromWalls(this.player, this.world, 4);

        // Effekt-Partikel, die Bosse in die Geschoss-Liste gelegt haben, gehören zu den Partikeln
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            if (this.projectiles[i] instanceof Particle) this.particles.push(this.projectiles.splice(i, 1)[0]);
        }

        // Nahkampf-Treffer
        if (this.player.activeWeapon.type === 'melee') {
            const hitEnemies = this.player.activeWeapon.getHitEntities(this.player, this.enemies);
            for (const enemy of hitEnemies) {
                if (enemy.iFrames > 0) continue;
                const angle = angleBetween(
                    { x: this.player.x + this.player.w / 2, y: this.player.y + this.player.h / 2 },
                    { x: enemy.centerX(), y: enemy.centerY() }
                );
                let damage = this.player.activeWeapon.damage;
                if (this.player.hasPowerUp('attack')) damage += 2;
                enemy.takeDamage(damage, angle, this.player.activeWeapon.knockback);
                this.camera.shake(3, 0.15);
                Sound.hit();
                if (enemy.dead) {
                    Sound.enemyDeath();
                    this.doHitstop(0.05);
                }
                FX.burst(enemy.centerX(), enemy.centerY(), ['#fff6a8', '#ffd23f'], 5, 110, 0.3, { kind: 'spark' });
            }
        }

        // Fernkampf
        if (this.player.activeWeapon.type === 'ranged' && !this.player.dead &&
            (Input.attackPressed || Input.attackHeld || this.player.autoAttack)) {
            if (this.player.activeWeapon.attack(this.player.facingAngle, this.player, this.projectiles)) {
                Sound.shoot();
            }
        }

        // Geschosse
        for (const proj of this.projectiles) {
            proj.update(dt, this.world);
            if (proj.dead) continue;
            if (proj.owner === 'player') {
                for (const enemy of this.enemies) {
                    if (enemy.dead) continue;
                    const dist = Math.hypot(proj.x - enemy.centerX(), proj.y - enemy.centerY());
                    if (dist < proj.radius + Math.max(enemy.w, enemy.h) / 2) {
                        let damage = proj.damage;
                        if (this.player.hasPowerUp('attack')) damage += 1;
                        enemy.takeDamage(damage, Math.atan2(proj.vy, proj.vx), proj.knockback);
                        proj.dead = true;
                        Sound.hit();
                        if (enemy.dead) Sound.enemyDeath();
                        FX.burst(proj.x, proj.y, ['#ffffff', proj.poison ? '#7dff6a' : '#ffd23f'], 4, 90, 0.25, { kind: 'spark' });
                        // Welt 15: Stein-Gift versteinert manchmal kurz
                        if (this.unlockedPetrifyStone && !enemy.dead && !enemy.isBoss && Math.random() < 0.2) {
                            enemy.stoneTimer = 1.5;
                            FX.burst(enemy.centerX(), enemy.centerY(), ['#b9c3d6', '#ffffff'], 6, 70, 0.4);
                        }
                        // Welt 10: Orangen-Explosion trifft Gegner in der Nähe
                        if (this.player.orangeExplosion) this._orangeSplash(proj.x, proj.y, enemy);
                        // Feuer-Geschosse (z. B. Schatten-Krokodil ab Welt 9) explodieren
                        if (proj.explosive) this._orangeSplash(proj.x, proj.y, enemy, ['#ff5a1f', '#ffd23f', '#ff9f1c']);
                        break;
                    }
                }
            } else if (proj.owner === 'enemy' && !this.player.dead) {
                const dist = Math.hypot(proj.x - (this.player.x + this.player.w / 2), proj.y - (this.player.y + this.player.h / 2));
                if (dist < proj.radius + this.player.w / 2) {
                    this._hurtPlayer(1, Math.atan2(proj.vy, proj.vx), 100);
                    if (proj.slow && this.player.applySlow) this.player.applySlow(2.5, 0.55);
                    proj.dead = true;
                }
            }
        }

        // Truhen: öffnen beim Berühren oder per Tippen in der Nähe
        for (const chest of this.chests) {
            if (!chest.opened && chest.canInteract(this.player) &&
                (Input.attackPressed || rectOverlap(this.player, { x: chest.x - 4, y: chest.y - 4, w: chest.w + 8, h: chest.h + 8 }))) {
                chest.open();
                Sound.chest();
                FX.burst(chest.x + chest.w / 2, chest.y + chest.h / 2, ['#ffd23f', '#fff6a8', '#ff9f1c'], 12, 130, 0.6, { kind: 'star', gravity: 160 });
                for (let i = 0; i < 3; i++) this._dropCoin(chest.x + chest.w / 2, chest.y + chest.h / 2, randInt(2, 5), true);
                const names = { heart: 'Herz! ❤️', halfheart: 'Halbes Herz! ❤️', speed: 'Tempo! ⚡', attack: 'Stärke! 💪' };
                if (chest.item) HUD.toast(names[chest.item.type] || chest.item.name, '#ffe38a', 1.8);
            }
            const wasCollected = chest.itemCollected;
            chest.update(dt, this.player);
            if (!wasCollected && chest.itemCollected) Sound.powerUp();
        }

        // Schlüssel
        for (const key of this.keyDrops) {
            if (key.update(dt, this.player)) {
                this.hasKey = true;
                this.world.openBossDoor();
                Sound.key();
                this.vibrate(80);
                FX.burst(key.x + key.w / 2, key.y + key.h / 2, ['#ffd23f', '#fff6a8'], 14, 140, 0.7, { kind: 'star' });
                HUD.toast('Schlüssel! Ab zur Boss-Tür! 🔑', '#ffd23f', 3);
            }
        }
        for (const enemy of this.enemies) {
            if (enemy.isKeyGhost && enemy.dead && !enemy.droppedKey) {
                enemy.droppedKey = true;
                // Schlüssel immer auf eine freie Kachel legen (nie in eine Wand)
                const spot = nearestFreeTileCenter(this.world, enemy.centerX(), enemy.centerY());
                this.keyDrops.push(new KeyDrop(spot.x - 8, spot.y - 8));
            }
        }

        // Auto lädt sich mit besiegten Gegnern auf (in Welt 3 nur mit Schleimen, wie bisher)
        if (this.player.hasAuto && !this.player.autoActive && !this.player.autoReady) {
            for (const enemy of this.enemies) {
                if (enemy.dead && !enemy._countedForCharge && !enemy.isBoss &&
                    (this.currentWorld !== 3 || enemy instanceof Slime)) {
                    enemy._countedForCharge = true;
                    this.player.addAutoCharge();
                    if (this.player.autoReady) HUD.toast('Auto bereit! 🚗', '#5ff2ff', 1.8);
                }
            }
        }

        // Training geschafft, wenn alle Übungsroboter besiegt sind
        if (this.currentWorld === 0 && !this._trainingDoneShown && this.enemies.every(e => e.dead)) {
            this._trainingDoneShown = true;
            this.trainingCompleted = true;
            this.maxWorldUnlocked = Math.max(1, this.maxWorldUnlocked);
            this.lastReward = null;
            this.lastUnlockText = 'Welt 1 ist offen! 👻';
            Sound.worldClear();
            FX.confetti(this.player.x + this.player.w / 2, this.player.y, 50);
            this.save();
            this._resultDelay = 1.2;
            this._resultState = 'WORLD_CLEAR';
        }

        // Boss-Tür
        if (this.hasKey && this.world.bossDoorOpen && !this.bossActive && !this.bossDefeated) {
            const px = this.player.x + this.player.w / 2;
            const py = this.player.y + this.player.h / 2;
            for (const dPos of this.world.bossDoorTiles) {
                const doorCX = dPos.x * TILE_SIZE + TILE_SIZE / 2;
                const doorCY = dPos.y * TILE_SIZE + TILE_SIZE / 2;
                if (Math.hypot(px - doorCX, py - doorCY) < 40) {
                    this.player.x = this.world.bossSpawn.x - this.player.w / 2;
                    this.player.y = this.world.bossSpawn.y - this.player.h / 2 - 64;
                    this.fadeIn();
                    // Gegner-Geschosse aus dem Flur mitnehmen wäre unfair
                    this.projectiles = this.projectiles.filter(p => p.owner === 'player');
                    this._spawnBoss();
                    for (const pos of this.world.bossDoorTiles) this.world.setTile(pos.x, pos.y, TILE_WALL);
                    break;
                }
            }
        }

        // Münzen
        this._updateCoins(dt);

        // Partikel
        for (const p of this.particles) p.update(dt);

        // Aufräumen
        this.enemies = this.enemies.filter(e => !(e.dead && e.deathTimer <= 0 && !e.isBoss));
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.coinDrops = this.coinDrops.filter(c => !c.collected);
        this.particles = this.particles.filter(p => !p.dead);
        if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
        if (this.projectiles.length > 400) this.projectiles.splice(0, this.projectiles.length - 400);

        // Ergebnis nach kurzer Siegespause zeigen
        if (this._resultDelay > 0) {
            this._resultDelay -= dt;
            if (this._resultDelay <= 0) {
                this._resultDelay = 0;
                this.setState(this._resultState);
            }
        }

        this._updateCamera(dt);
        Input.postUpdate();
    },

    _updateCamera(dt) {
        if (!this.player.dead) {
            this.camera.follow(this.player, this.world.pixelWidth, this.world.pixelHeight, dt);
        } else {
            this.camera.updateShake(dt);
        }
        const last = this._lastCam || { x: this.camera.x, y: this.camera.y };
        FX.updateAmbient(dt, this.viewW, this.viewH, this.camera.x - last.x, this.camera.y - last.y);
        this._lastCam = { x: this.camera.x, y: this.camera.y };
    },

    _updateAmbientOnly(dt) {
        if (!this.camera) return;
        for (const p of this.particles) p.update(dt);
        this.particles = this.particles.filter(p => !p.dead);
        FX.updateAmbient(dt, this.viewW, this.viewH, 0, 0);
    },

    // Schaden am Spieler mit Rückmeldung (Wackeln, Ton, Vibration, roter Rand)
    _hurtPlayer(amount, angle, force) {
        const before = this.player.hp;
        this.player.takeDamage(amount, angle, force);
        if (this.player.hp < before) {
            this.camera.shake(4, 0.2);
            Sound.playerHit();
            this.vibrate(50);
            FX.screenFlash('#ff2d55', 0.28);
            FX.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, ['#ff4d6d', '#ffffff'], 6, 110, 0.35);
        }
    },

    // Zielhilfe und Auto-Angriff für Touch
    _updateAssist() {
        const p = this.player;
        p.assistAim = undefined;
        p.autoAttack = false;
        if (p.dead || Input.lastInput !== 'touch') return;
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const ranged = p.activeWeapon.type === 'ranged';
        const range = ranged ? 290 : 72;
        const aimA = Input.aiming ? Input.aimAngle : null;
        let best = null;
        let bestScore = Infinity;
        for (const e of this.enemies) {
            if (e.dead) continue;
            const dx = e.centerX() - cx;
            const dy = e.centerY() - cy;
            const d = Math.hypot(dx, dy) - Math.max(e.w, e.h) / 2;
            if (d > range) continue;
            const a = Math.atan2(dy, dx);
            let score = d;
            if (aimA !== null) {
                let diff = a - aimA;
                while (diff > Math.PI) diff -= TAU;
                while (diff < -Math.PI) diff += TAU;
                if (Math.abs(diff) > 0.42) continue;
                score = d * (1 + Math.abs(diff) * 3);
            }
            if (score < bestScore) {
                bestScore = score;
                best = a;
            }
        }
        if (aimA !== null) {
            if (best !== null && this.settings.aimAssist) {
                let diff = best - aimA;
                while (diff > Math.PI) diff -= TAU;
                while (diff < -Math.PI) diff += TAU;
                p.assistAim = aimA + diff * 0.75;
            }
        } else if (best !== null && (Input.attackPressed || Input.attackHeld)) {
            if (this.settings.aimAssist) p.assistAim = best;
        } else if (best !== null && this.settings.autoFire && !p.autoActive) {
            p.assistAim = best;
            p.autoAttack = true;
        }
    },

    _orangeSplash(x, y, except, colors = ['#ff9f1c', '#ffd23f', '#ffe9a8']) {
        FX.burst(x, y, colors, 8, 120, 0.35);
        FX.ring(x, y, '#ffb347', 34, 0.25, 3);
        for (const e of this.enemies) {
            if (e === except || e.dead) continue;
            if (Math.hypot(e.centerX() - x, e.centerY() - y) < 36 + Math.max(e.w, e.h) / 2) {
                e.takeDamage(1, Math.atan2(e.centerY() - y, e.centerX() - x), 60);
            }
        }
    },

    // ── Münzen ──
    _dropCoin(x, y, value, burst) {
        const c = new CoinDrop(x - 7, y - 7, value);
        const a = randRange(0, TAU);
        const s = burst ? randRange(90, 180) : randRange(20, 60);
        c.vx = Math.cos(a) * s;
        c.vy = Math.sin(a) * s;
        c.age = 0;
        this.coinDrops.push(c);
    },

    _updateCoins(dt) {
        const p = this.player;
        const px = p.x + p.w / 2;
        const py = p.y + p.h / 2;
        for (const c of this.coinDrops) {
            if (c.collected) continue;
            c.age = (c.age || 0) + dt;
            const damp = Math.exp(-5 * dt);
            c.vx = (c.vx || 0) * damp;
            c.vy = (c.vy || 0) * damp;
            const cx = c.x + c.w / 2;
            const cy = c.y + c.h / 2;
            const d = Math.hypot(px - cx, py - cy);
            if (c.age > 0.35 && d < 95 && !p.dead) {
                const pull = 520 * (1 - d / 110);
                c.vx += (px - cx) / (d || 1) * pull * dt * 6;
                c.vy += (py - cy) / (d || 1) * pull * dt * 6;
            }
            const nx = c.x + c.vx * dt;
            const ny = c.y + c.vy * dt;
            if (!this.world.isWall(nx + c.w / 2, c.y + c.h / 2)) c.x = nx; else c.vx *= -0.5;
            if (!this.world.isWall(c.x + c.w / 2, ny + c.h / 2)) c.y = ny; else c.vy *= -0.5;
            if (c.age > 0.35 && !p.dead && c.update(dt, p)) {
                this.coins += c.value;
                this.levelCoins += c.value;
                FX.text(cx, cy - 6, '+' + c.value, '#ffd23f', 10, { life: 0.6 });
                Sound.coin();
            } else if (c.age <= 0.35) {
                c.bobOffset += dt;
            }
        }
    },

    // Einmalige Effekte (und Münzen), wenn ein Gegner stirbt.
    _onEnemyDeathFx(enemy) {
        enemy._deathFxDone = true;
        const cx = enemy.centerX();
        const cy = enemy.centerY();
        const color = enemy.fxColor || '#ffe066';
        const big = enemy.isBoss;
        FX.burst(cx, cy, [color, '#ffffff', Art.light(color, 0.4)], big ? 26 : 12, big ? 260 : 150, big ? 0.9 : 0.5);
        FX.burst(cx, cy, 'rgba(235,225,255,0.9)', big ? 10 : 5, 60, big ? 0.9 : 0.55, { kind: 'smoke', size: big ? 7 : 4.5 });
        FX.ring(cx, cy, Art.light(color, 0.3), big ? 120 : Math.max(26, enemy.w * 1.4), big ? 0.6 : 0.3, big ? 5 : 3);
        if (!big && this.currentWorld > 0) {
            const tough = enemy.maxHp >= 8;
            if (enemy.isKeyGhost) this._dropCoin(cx, cy, 5, true);
            else if (Math.random() < (tough ? 0.7 : 0.4)) this._dropCoin(cx, cy, tough ? randInt(2, 4) : randInt(1, 2), true);
        }
    },

    // ── Zeichnen ──

    // Bodenschatten einer Figur. Steuerbar über e.flying / e.shadow = {rx, ry, dy, alpha}.
    _drawShadow(ctx, e) {
        if (e.noShadow || (e.dead && e.deathTimer <= 0)) return;
        const c = this.camera.worldToScreen(e.x + e.w / 2, e.y + e.h / 2);
        const flying = e.flying !== undefined ? e.flying : !!e.phasesThroughWalls;
        const sh = e.shadow || {};
        let rx = sh.rx || Math.max(6, e.w * (e.isBoss ? 0.5 : 0.46));
        let ry = sh.ry || rx * 0.36;
        let dy = sh.dy !== undefined ? sh.dy : e.h / 2 - 1;
        let a = sh.alpha || (flying ? 0.2 : 0.34);
        if (flying && sh.dy === undefined) {
            dy += 8;
            rx *= 0.8;
            ry *= 0.8;
        }
        if (e.dead) a *= Math.max(0, (e.deathTimer || 0) / 0.4);
        Art.groundShadow(ctx, c.x, c.y + dy, rx, ry, a);
    },

    _drawEntity(ctx, e) {
        const camera = this.camera;
        const inBush = e !== this.player && !e.isBoss && typeof e.centerX === 'function' &&
            this.world.isBush(e.centerX(), e.centerY());
        const playerInBush = e === this.player && this.world.isBush(e.x + e.w / 2, e.y + e.h / 2);
        ctx.save();
        if (inBush || playerInBush) ctx.globalAlpha = 0.35;
        try {
            if (e.stoneTimer > 0 && !e.dead) {
                FX.drawFlashing(ctx, e, camera, this.renderScale, 0.62, '#8f98ad');
            } else if (e.hitFlash > 0 && (!e.dead || e === this.epicFreezeBoss)) {
                FX.drawFlashing(ctx, e, camera, this.renderScale, Math.min(0.85, e.hitFlash * 7));
            } else {
                e.draw(ctx, camera);
            }
        } catch (err) {
            const name = e.constructor ? e.constructor.name : '?';
            this._drawErrors = this._drawErrors || {};
            if (!this._drawErrors[name]) {
                this._drawErrors[name] = true;
                console.error('Zeichenfehler in ' + name + ':', err);
            }
        }
        ctx.restore();
    },

    _drawEnemyBars(ctx) {
        for (const e of this.enemies) {
            if (e.dead || e.isBoss || e.maxHp < 6 || e.hp >= e.maxHp || e.hideHpBar) continue;
            if (!isOnScreen(e, this.camera, 20)) continue;
            const p = this.camera.worldToScreen(e.x + e.w / 2, e.y);
            const w = clamp(e.w * 0.9, 16, 40);
            const k = clamp(e.hp / e.maxHp, 0, 1);
            ctx.fillStyle = 'rgba(20,8,40,0.75)';
            ctx.beginPath();
            ctx.roundRect(p.x - w / 2 - 1, p.y - 9, w + 2, 5, 2.5);
            ctx.fill();
            ctx.fillStyle = k > 0.5 ? '#6ee06e' : (k > 0.25 ? '#ffc23d' : '#ff4d5e');
            ctx.beginPath();
            ctx.roundRect(p.x - w / 2, p.y - 8, Math.max(1.5, w * k), 3, 1.5);
            ctx.fill();
        }
    },

    // Hintergrund der Startseite: Mark groß, mit Geistern und Sternen
    _drawTitleScene(ctx) {
        const W = this.viewW;
        const H = this.viewH;
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#2b1660');
        g.addColorStop(0.65, '#1a0d3a');
        g.addColorStop(1, '#0f0826');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        if (!this._titleAmbient) {
            FX.setAmbient('space', W, H);
            this._titleAmbient = true;
        }
        FX.updateAmbient(1 / 60, W, H, 0.15, 0);
        FX.drawAmbient(ctx);

        const mx = W * 0.22;
        const my = H * 0.6;
        const scale = H / 150;
        Art.glow(ctx, mx, my - 20 * scale, 95 * scale / 2.4, '#7b4dff', 0.55);
        // Bühne
        ctx.fillStyle = 'rgba(123,77,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(mx, my + 17 * scale, 36 * scale, 9 * scale, 0, 0, TAU);
        ctx.fill();
        Art.groundShadow(ctx, mx, my + 16 * scale, 16 * scale, 5 * scale, 0.5);

        // Umherschwebende Geister
        if (!this._titleGhosts) {
            this._titleGhosts = [];
            for (let i = 0; i < 3; i++) {
                try { this._titleGhosts.push(new Ghost(0, 0)); } catch (e) { /* ohne Geister */ }
            }
        }
        const ghostCam = { x: 0, y: 0, width: W, height: H, shakeX: 0, shakeY: 0, worldToScreen(x, y) { return { x, y }; } };
        this._titleGhosts.forEach((gh, i) => {
            const a = Art.time * 0.5 + i * 2.1;
            gh.x = mx + Math.cos(a) * 34 * scale - gh.w / 2;
            gh.y = my - 26 * scale + Math.sin(a * 1.3) * 12 * scale - gh.h / 2;
            gh.chasing = false;
            ctx.save();
            const k = 0.9 + (i % 2) * 0.35;
            ctx.translate(gh.x + gh.w / 2, gh.y + gh.h / 2);
            ctx.scale(k, k);
            ctx.translate(-(gh.x + gh.w / 2), -(gh.y + gh.h / 2));
            try { gh.draw(ctx, ghostCam); } catch (e) { /* egal */ }
            ctx.restore();
        });

        // Mark
        if (!this._titlePlayer) this._titlePlayer = new Player(0, 0);
        const p = this._titlePlayer;
        const spin = this.titleSpin;
        const jump = Math.sin((1 - spin) * Math.PI) * (spin > 0 ? 22 : 0);
        p.facingAngle = spin > 0 ? (1 - spin) * TAU * 2 : Math.sin(Art.time * 0.8) * 0.5 + Math.PI * 0.12;
        p.aimAngle = p.facingAngle;
        p.x = -p.w / 2;
        p.y = -p.h / 2;
        const cam = { x: 0, y: 0, width: 100, height: 100, shakeX: 0, shakeY: 0, worldToScreen(x, y) { return { x, y }; } };
        ctx.save();
        ctx.translate(mx, my - jump * scale * 0.4);
        ctx.scale(scale, scale);
        try { p.draw(ctx, cam); } catch (e) { /* egal */ }
        ctx.restore();
    },

    _drawMenuBackdrop(ctx) {
        const W = this.viewW;
        const H = this.viewH;
        ctx.fillStyle = '#140b2a';
        ctx.fillRect(0, 0, W, H);
    },

    render() {
        const ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        const menu = ['TITLE', 'WORLD_SELECT', 'EXTRA_MENU', 'SHOP'].includes(this.state);
        if (menu || !this.world || !this.camera || !this.player) {
            ctx.fillStyle = '#140b2a';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
            if (this.state === 'TITLE') this._drawTitleScene(ctx);
            else this._drawMenuBackdrop(ctx);
            return;
        }
        this._titleAmbient = false;

        const camera = this.camera;
        ctx.fillStyle = (this.world.palette && this.world.palette.void) || '#140b2a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);

        // Welt (Boden, Wände)
        this.world.draw(ctx, camera);
        FX.drawRings(ctx, camera);

        // Figuren sammeln, von oben nach unten sortieren
        const list = this._drawList;
        list.length = 0;
        for (const c of this.chests) list.push(c);
        for (const k of this.keyDrops) if (!k.collected) list.push(k);
        for (const c of this.coinDrops) if (!c.collected) list.push(c);
        for (const p of this.props) list.push(p);
        for (const e of this.enemies) {
            if (e.dead && e.deathTimer <= 0) continue;
            if (!e.isBoss && !isOnScreen(e, camera, 40)) continue;
            list.push(e);
        }
        for (const c of this.companions) list.push(c);
        list.push(this.player);
        list.sort((a, b) => (a.y + a.h) - (b.y + b.h));

        for (const e of list) {
            if (e === this.player || typeof e.centerX === 'function') this._drawShadow(ctx, e);
        }
        for (const e of list) this._drawEntity(ctx, e);

        // Geschosse und Partikel über den Figuren
        for (const proj of this.projectiles) {
            if (!isOnScreen({ x: proj.x - 8, y: proj.y - 8, w: 16, h: 16 }, camera, 16)) continue;
            try { proj.draw(ctx, camera); } catch (err) { proj.dead = true; }
        }
        for (const p of this.particles) {
            if (!isOnScreen({ x: p.x - 6, y: p.y - 6, w: 12, h: 12 }, camera, 12)) continue;
            try { p.draw(ctx, camera); } catch (err) { p.dead = true; }
        }
        if (this.world.drawOverlay) this.world.drawOverlay(ctx, camera);
        this._drawEnemyBars(ctx);
        FX.drawFloaters(ctx, camera);

        // Hinweis an Truhen
        for (const chest of this.chests) {
            if (!chest.opened && chest.canInteract(this.player)) {
                const pos = camera.worldToScreen(chest.x + chest.w / 2, chest.y - 12 + Math.sin(Art.time * 5) * 2);
                Art.text(ctx, 'Öffnen!', pos.x, pos.y, { size: 9, color: '#ffe066' });
            }
        }

        // Bildschirm-Ebene: Umgebungspartikel, Licht, Vignette, Blitz
        FX.drawAmbient(ctx);
        if (this.world.drawLighting) this.world.drawLighting(ctx, camera, this.viewW, this.viewH);
        FX.drawVignette(ctx, this.viewW, this.viewH, (this.world.palette && this.world.palette.vignette) || 0.42);
        if (this.player.hp <= 4 && !this.player.dead) FX.drawVignette(ctx, this.viewW, this.viewH, 0.25 + Math.sin(Art.time * 6) * 0.08);
        FX.drawScreenFlash(ctx, this.viewW, this.viewH);

        // HUD in CSS-Pixel-Koordinaten
        ctx.setTransform(this.hudScale, 0, 0, this.hudScale, 0, 0);
        if (this.state === 'PLAYING' || this.state === 'BOSS_INTRO') HUD.draw(ctx, this);

        if (this.fadeAlpha > 0) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(10,4,24,${this.fadeAlpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    },
};

// ── Start ──
window.addEventListener('load', () => Game.init());
