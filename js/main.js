// ── Main Game ──

const Game = {
    canvas: null,
    ctx: null,
    state: 'TITLE',
    currentWorld: 0, // 0 = tutorial
    player: null,
    world: null,
    camera: null,
    enemies: [],
    projectiles: [],
    companions: [], // Juri, Crocodile
    particles: [],
    chests: [],
    coinDrops: [],
    props: [],
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
    unlockedShadowCaster: false,
    unlockedFruitUpgrades: false,
    unlockedGamerPistol: false,
    maxWorldUnlocked: 1,
    trainingCompleted: false,
    coins: 0,
    jewels: 0,
    dailyRewardClaimDate: '',
    freeStarTier: null,
    boseStarUses: 0,
    shopRandomStarTier: 0,
    shopRandomStarAttempts: 5,
    shopRandomStarFinished: false,
    shopRandomStarRevealReady: false,
    worldRewardClaims: {},
    rewardValues: {},
    activeMode: null,

    // Epic Freeze
    epicFreezeActive: false,
    epicFreezeTimer: 0,
    epicFreezeBoss: null,

    // Screen transition
    fadeAlpha: 0,
    fadeDir: 0, // 0=none, 1=fading out, -1=fading in
    fadeCallback: null,

    init() {
        this.canvas = document.getElementById('game');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        document.addEventListener('fullscreenchange', () => this.resize());
        document.addEventListener('webkitfullscreenchange', () => this.resize());

        Sound.init();
        Input.init(this.canvas);
        this.loadSave();
        this.lastTime = performance.now();
        this.gameLoop(this.lastTime);
    },

    enterFullscreen() {
        const el = document.documentElement;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (isFullscreen) return;
        const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (request) {
            const maybePromise = request.call(el);
            if (maybePromise && typeof maybePromise.catch === 'function') {
                maybePromise.catch(() => {});
            }
        }
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }
    },

    // ── Save System ──
    save() {
        try {
            localStorage.setItem('mark_save', JSON.stringify({
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
                gamer: this.unlockedGamerPistol
            }));
        } catch (e) {}
    },

    loadSave() {
        try {
            const data = JSON.parse(localStorage.getItem('mark_save'));
            if (data) {
                this.currentWorld = Math.max(0, Math.min(21, typeof data.world === 'number' ? data.world : 1));
                const maxWorld = typeof data.maxWorld === 'number'
                    ? data.maxWorld
                    : (typeof data.world === 'number' ? data.world : 1);
                this.maxWorldUnlocked = Math.min(21, maxWorld);
                this.coins = data.coins || 0;
                this.jewels = data.jewels || 0;
                this.trainingCompleted = !!data.trainingDone;
                this.dailyRewardClaimDate = data.dailyRewardClaimDate || '';
                this.freeStarTier = data.freeStarTier || null;
                this.boseStarUses = data.boseStarUses || 0;
                this.worldRewardClaims = data.worldRewards || {};
                this.rewardValues = data.rewardValues || {};
                this.unlockedRanged = !!data.ranged;
                this.unlockedAuto = !!data.auto;
                this.unlockedCrown = !!data.crown;
                this.unlockedTripleShot = !!data.triple;
                this.unlockedShadowCaster = !!data.shadow;
                this.unlockedFruitUpgrades = !!data.fruit;
                this.unlockedGamerPistol = !!data.gamer;
            }
        } catch (e) {}
    },

    clearSave() {
        try { localStorage.removeItem('mark_save'); } catch (e) {}
    },

    _todayKey() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
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
            21: { label: '500 MUENZEN', coins: 500, jewels: 0 }
        };
    },

    _claimWorldReward(worldNum) {
        const key = this._worldRewardKey(worldNum);
        if (this.worldRewardClaims[key]) return null;
        this.worldRewardClaims[key] = true;
        const reward = this._worldRewardTable()[worldNum];
        if (!reward) return null;
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
            claimed: !!this.worldRewardClaims[key]
        };
    },

    openShop() {
        this.shopRandomStarTier = 0;
        this.shopRandomStarAttempts = 5;
        this.shopRandomStarFinished = false;
        this.shopRandomStarRevealReady = false;
        this.showWorldSelectOverlay(false);
        this.state = 'SHOP';
        this.buildShopOverlay2();
        this.buildRandomStarOverlay2();
        this.refreshShopOverlay2();
        this.showShopOverlay(true);
    },

    buildShopOverlay2() {
        if (this.shopOverlay) return;

        const overlay = document.createElement('div');
        overlay.id = 'shop-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.display = 'none';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '12px';
        overlay.style.background = 'linear-gradient(135deg, rgba(18, 20, 58, 0.96), rgba(8, 10, 28, 0.98) 55%, rgba(15, 30, 56, 0.96))';
        overlay.style.backdropFilter = 'blur(12px)';
        overlay.style.webkitBackdropFilter = 'blur(12px)';
        overlay.style.zIndex = '9999';
        overlay.style.color = '#fff';
        overlay.style.fontFamily = 'monospace';

        const panel = document.createElement('div');
        panel.style.position = 'relative';
        panel.style.width = 'min(960px, 100%)';
        panel.style.height = '100%';
        panel.style.border = '1px solid rgba(255,255,255,0.12)';
        panel.style.borderRadius = '18px';
        panel.style.background = 'linear-gradient(180deg, rgba(37, 42, 116, 0.92), rgba(14, 15, 33, 0.98))';
        panel.style.boxShadow = '0 24px 80px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.overflow = 'hidden';

        const header = document.createElement('div');
        header.style.padding = '16px 16px 12px';
        header.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
        header.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0))';
        header.innerHTML = `
            <div style="min-width:0">
                <div style="font-size:20px;font-weight:800;letter-spacing:0.06em">BOESE STERNE</div>
                <div style="margin-top:4px;font-size:12px;color:#d7d0c0;line-height:1.4">Swipe ueber den Stern. Nach 5 Versuchen kannst du ihn antippen.</div>
            </div>
        `;
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Zurueck';
        close.style.cssText = 'border:0;border-radius:12px;padding:10px 14px;background:#2a2f3f;color:#fff;font:700 12px monospace;flex:0 0 auto;';
        close.addEventListener('click', () => this.closeRandomStarOverlay2());
        header.appendChild(close);

        const legend = document.createElement('div');
        legend.style.display = 'grid';
        legend.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        legend.style.gap = '8px';
        legend.style.fontSize = '11px';
        legend.style.color = '#f4ead1';
        const legendItems = [
            ['Scharf', '#47d163'],
            ['Super Scharf', '#ffeb59'],
            ['Mega Scharf', '#ff9f2e'],
            ['Ultrascharf', '#ff5f5f']
        ];
        for (const [label, color] of legendItems) {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 10px;border-radius:999px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;gap:8px;';
            item.innerHTML = `<span>${label}</span><span style="width:18px;height:18px;border-radius:999px;background:${color};box-shadow:0 0 14px ${color}"></span>`;
            legend.appendChild(item);
        }

        const center = document.createElement('div');
        center.style.flex = '1 1 auto';
        center.style.display = 'flex';
        center.style.alignItems = 'center';
        center.style.justifyContent = 'center';
        center.style.padding = '10px 0';

        const starWrap = document.createElement('div');
        starWrap.style.position = 'relative';
        starWrap.style.width = 'min(62vw, 360px)';
        starWrap.style.maxWidth = '360px';
        starWrap.style.aspectRatio = '1';
        starWrap.style.display = 'flex';
        starWrap.style.alignItems = 'center';
        starWrap.style.justifyContent = 'center';

        const star = document.createElement('button');
        star.type = 'button';
        star.style.cssText = [
            'position:relative',
            'width:100%',
            'height:100%',
            'border:0',
            'cursor:pointer',
            'background:linear-gradient(180deg, #ffe76a, #ff9c1f)',
            'clip-path:polygon(50% 0%,61% 36%,98% 36%,68% 58%,79% 96%,50% 73%,21% 96%,32% 58%,2% 36%,39% 36%)',
            'box-shadow:0 0 0 4px rgba(0,0,0,0.18) inset, 0 0 40px rgba(255,199,55,0.45)',
            'padding:0'
        ].join(';');
        star.dataset.swipes = '0';

        const eyeStyle = 'position:absolute;width:16px;height:20px;border-radius:999px;background:#10131d;top:38%;';
        const eyeLeft = document.createElement('span');
        eyeLeft.style.cssText = eyeStyle + 'left:36%;';
        const eyeRight = document.createElement('span');
        eyeRight.style.cssText = eyeStyle + 'right:36%;';
        const mouth = document.createElement('span');
        mouth.style.cssText = 'position:absolute;left:50%;top:56%;transform:translateX(-50%);width:42px;height:18px;border-bottom:6px solid #10131d;border-radius:0 0 999px 999px;';
        const hint = document.createElement('div');
        hint.style.cssText = 'position:absolute;left:50%;bottom:20%;transform:translateX(-50%);font-size:13px;font-weight:700;color:#10131d;text-shadow:0 1px 0 rgba(255,255,255,0.35);letter-spacing:0.08em;';
        hint.textContent = 'SWIPE';
        star.appendChild(eyeLeft);
        star.appendChild(eyeRight);
        star.appendChild(mouth);
        star.appendChild(hint);

        let swipeStart = null;
        const onPointerDown = e => {
            swipeStart = { x: e.clientX, y: e.clientY, t: Date.now() };
            star.setPointerCapture?.(e.pointerId);
        };
        const onPointerUp = e => {
            if (!swipeStart) return;
            const dx = e.clientX - swipeStart.x;
            const dy = e.clientY - swipeStart.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 28) {
                this._advanceRandomStarStep2();
            }
            swipeStart = null;
        };
        star.addEventListener('pointerdown', onPointerDown);
        star.addEventListener('pointerup', onPointerUp);
        star.addEventListener('pointercancel', () => { swipeStart = null; });

        starWrap.appendChild(star);
        center.appendChild(starWrap);

        const progress = document.createElement('div');
        progress.style.display = 'grid';
        progress.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
        progress.style.gap = '10px';
        progress.style.maxWidth = '420px';
        progress.style.margin = '0 auto';

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.flexDirection = 'column';
        footer.style.alignItems = 'center';
        footer.style.gap = '10px';
        footer.style.paddingBottom = '2px';

        const action = document.createElement('button');
        action.type = 'button';
        action.style.cssText = 'border:0;border-radius:14px;padding:12px 18px;background:#ffd84a;color:#111;font:800 13px monospace;min-width:210px;';
        action.addEventListener('click', () => {
            if (this.shopRandomStarFinished && this.shopRandomStarRevealReady) {
                this._resolveRandomStarReward();
                this.closeRandomStarOverlay2();
                this.returnToTitle();
                return;
            }
            this._advanceRandomStarStep2();
        });

        const status = document.createElement('div');
        status.style.cssText = 'font-size:12px;color:#d7d0c0;text-align:center;line-height:1.5;min-height:2.4em;';

        footer.appendChild(action);
        footer.appendChild(status);

        content.appendChild(header);
        content.appendChild(legend);
        content.appendChild(center);
        content.appendChild(progress);
        content.appendChild(footer);

        panel.appendChild(trophyBg);
        panel.appendChild(content);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        this.shopStarOverlay = overlay;
        this.shopStarPanel = panel;
        this.shopStarProgress = progress;
        this.shopStarAction = action;
        this.shopStarStatus = status;
        this.shopStarHint = hint;
        this.shopStarNode = star;
        this.shopStarSwipes = 0;
    },

    refreshRandomStarOverlay2() {
        if (!this.shopStarOverlay) return;
        if (this.shopStarProgress) {
            this.shopStarProgress.innerHTML = '';
            const attemptsUsed = 5 - Math.max(0, this.shopRandomStarAttempts || 0);
            for (let i = 0; i < 5; i++) {
                const orb = document.createElement('div');
                const active = i < attemptsUsed;
                const colors = ['#5eff77', '#ffe75f', '#ffb13d', '#ff6363', '#9a78ff'];
                orb.style.cssText = 'aspect-ratio:1;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;' +
                    'border:2px solid ' + (active ? colors[Math.min(i, colors.length - 1)] : 'rgba(255,255,255,0.18)') + ';' +
                    'background:' + (active ? colors[Math.min(i, colors.length - 1)] : 'rgba(255,255,255,0.05)') + ';' +
                    'color:' + (active ? '#10131d' : 'rgba(255,255,255,0.55)') + ';';
                orb.textContent = '?';
                this.shopStarProgress.appendChild(orb);
            }
        }
        if (this.shopStarAction) {
            this.shopStarAction.textContent = this.shopRandomStarFinished && this.shopRandomStarRevealReady
                ? 'ZUM OEFFNEN TIPPEN'
                : 'Swipe den Stern';
        }
        if (this.shopStarHint) {
            const tierLabel = ['Scharf', 'Super Scharf', 'Mega Scharf', 'Ultrascharf'][Math.min(this.shopRandomStarTier || 0, 3)];
            this.shopStarHint.textContent = this.shopRandomStarFinished && this.shopRandomStarRevealReady
                ? 'Der Stern ist fertig geladen. Jetzt tippen!'
                : `Schaerfegrad: ${tierLabel}`;
        }
        if (this.shopStarStatus) {
            this.shopStarStatus.textContent = `Versuche uebrig: ${Math.max(0, this.shopRandomStarAttempts || 0)}.`;
        }
    },

    _advanceRandomStarStep2() {
        if (this.shopRandomStarFinished) return;
        if (this.shopRandomStarAttempts <= 0) {
            this.shopRandomStarFinished = true;
            this.shopRandomStarRevealReady = true;
            this.refreshRandomStarOverlay2();
            return;
        }

        this.shopRandomStarAttempts--;
        const chances = [0.65, 0.5, 0.35];
        const chance = chances[Math.min(this.shopRandomStarTier, chances.length - 1)];
        if (Math.random() < chance && this.shopRandomStarTier < 3) {
            this.shopRandomStarTier++;
        }
        if (this.shopRandomStarTier >= 3 || this.shopRandomStarAttempts <= 0) {
            this.shopRandomStarFinished = true;
            this.shopRandomStarRevealReady = true;
        }
        this.save();
        this.refreshRandomStarOverlay2();
    },

    buildShopOverlay() {
        if (this.shopOverlay) return;

        const overlay = document.createElement('div');
        overlay.id = 'shop-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.display = 'none';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '12px';
        overlay.style.background = 'rgba(4, 6, 10, 0.92)';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.webkitBackdropFilter = 'blur(10px)';
        overlay.style.zIndex = '9999';
        overlay.style.color = '#fff';
        overlay.style.fontFamily = 'monospace';

        const panel = document.createElement('div');
        panel.style.width = 'min(720px, 100%)';
        panel.style.maxHeight = 'min(92vh, 860px)';
        panel.style.border = '1px solid rgba(255,255,255,0.12)';
        panel.style.borderRadius = '18px';
        panel.style.background = 'linear-gradient(180deg, rgba(19, 16, 28, 0.98), rgba(10, 12, 18, 0.98))';
        panel.style.boxShadow = '0 24px 80px rgba(0,0,0,0.55)';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.overflow = 'hidden';

        const header = document.createElement('div');
        header.style.padding = '16px 16px 12px';
        header.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
        header.innerHTML = `
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
                <div>
                    <div style="font-size:20px;font-weight:700;letter-spacing:0.06em">SHOP</div>
                    <div style="font-size:12px;color:#a9b0c0;margin-top:4px">Alles ist antippbar und die Liste kann gescrollt werden.</div>
                </div>
                <button data-action="close" style="border:0;border-radius:12px;padding:10px 14px;background:#2a2f3f;color:#fff;font:700 12px monospace">Zurueck</button>
            </div>
            <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:#c4cad8">
                <span style="padding:6px 10px;border-radius:999px;background:rgba(255,255,255,0.06)">Muenzen: <span data-role="coins">0</span></span>
                <span style="padding:6px 10px;border-radius:999px;background:rgba(255,255,255,0.06)">Juwelen: <span data-role="jewels">0</span></span>
                <span style="padding:6px 10px;border-radius:999px;background:rgba(255,255,255,0.06)">Daily Reward, Sterne und Krone</span>
            </div>
        `;

        const list = document.createElement('div');
        list.style.overflowY = 'auto';
        list.style.webkitOverflowScrolling = 'touch';
        list.style.flex = '1 1 auto';
        list.style.minHeight = '0';
        list.style.padding = '12px';
        list.style.display = 'grid';
        list.style.gap = '12px';
        list.style.alignContent = 'start';

        const footer = document.createElement('div');
        footer.style.padding = '12px 16px 16px';
        footer.style.borderTop = '1px solid rgba(255,255,255,0.08)';
        footer.style.fontSize = '12px';
        footer.style.color = '#94a0b8';
        footer.textContent = 'Tipp: Freier Stern aus dem Daily Reward wird hier direkt sichtbar.';

        panel.appendChild(header);
        panel.appendChild(list);
        panel.appendChild(footer);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        header.querySelector('[data-action="close"]').addEventListener('click', () => this.closeShop());

        this.shopOverlay = overlay;
        this.shopPanel = panel;
        this.shopList = list;
        this.shopCoinsNode = header.querySelector('[data-role="coins"]');
        this.shopJewelsNode = header.querySelector('[data-role="jewels"]');
    },

    buildRandomStarOverlay() {
        if (this.shopStarOverlay) return;

        const overlay = document.createElement('div');
        overlay.id = 'shop-star-overlay';
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.display = 'none';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '12px';
        overlay.style.background = 'rgba(2, 4, 10, 0.96)';
        overlay.style.backdropFilter = 'blur(12px)';
        overlay.style.webkitBackdropFilter = 'blur(12px)';
        overlay.style.zIndex = '10000';
        overlay.style.color = '#fff';
        overlay.style.fontFamily = 'monospace';

        const panel = document.createElement('div');
        panel.style.position = 'relative';
        panel.style.width = 'min(760px, 100%)';
        panel.style.height = 'min(92vh, 900px)';
        panel.style.borderRadius = '22px';
        panel.style.border = '1px solid rgba(255,255,255,0.12)';
        panel.style.boxShadow = '0 28px 100px rgba(0,0,0,0.58)';
        panel.style.overflow = 'hidden';
        panel.style.background = 'linear-gradient(180deg, rgba(30, 18, 10, 0.98), rgba(10, 11, 18, 0.98))';

        const trophyBg = document.createElement('div');
        trophyBg.style.position = 'absolute';
        trophyBg.style.inset = '0';
        trophyBg.style.opacity = '0.18';
        trophyBg.style.pointerEvents = 'none';
        trophyBg.style.display = 'grid';
        trophyBg.style.gridTemplateColumns = 'repeat(8, 1fr)';
        trophyBg.style.gap = '14px';
        trophyBg.style.padding = '18px';
        for (let i = 0; i < 48; i++) {
            const trophy = document.createElement('div');
            trophy.style.display = 'flex';
            trophy.style.alignItems = 'center';
            trophy.style.justifyContent = 'center';
            trophy.style.color = '#FFD94A';
            trophy.style.fontSize = '20px';
            trophy.style.transform = `rotate(${(i % 5 - 2) * 4}deg)`;
            trophy.textContent = '🏆';
            trophyBg.appendChild(trophy);
        }

        const content = document.createElement('div');
        content.style.position = 'relative';
        content.style.zIndex = '1';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.height = '100%';
        content.style.padding = '14px';
        content.style.gap = '12px';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'flex-start';
        header.style.gap = '12px';
        header.innerHTML = `
            <div style="min-width:0">
                <div style="font-size:20px;font-weight:800;letter-spacing:0.06em">BÖSE STERNE</div>
                <div style="margin-top:4px;font-size:12px;color:#d7d0c0;line-height:1.4">Tippe den Stern 5x an, um ihn aufzuladen. Danach kannst du ihn öffnen.</div>
            </div>
        `;
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Zurück';
        close.style.cssText = 'border:0;border-radius:12px;padding:10px 14px;background:#2a2f3f;color:#fff;font:700 12px monospace;flex:0 0 auto;';
        close.addEventListener('click', () => this.closeRandomStarOverlay());
        header.appendChild(close);

        const legend = document.createElement('div');
        legend.style.display = 'grid';
        legend.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        legend.style.gap = '8px';
        legend.style.fontSize = '11px';
        legend.style.color = '#f4ead1';
        const legendItems = [
            ['Scharf', '#47d163'],
            ['Super Scharf', '#ffeb59'],
            ['Mega Scharf', '#ff9f2e'],
            ['Ultrascharf', '#ff5f5f']
        ];
        for (const [label, color] of legendItems) {
            const item = document.createElement('div');
            item.style.cssText = 'padding:8px 10px;border-radius:999px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;gap:8px;';
            item.innerHTML = `<span>${label}</span><span style="width:18px;height:18px;border-radius:999px;background:${color};box-shadow:0 0 14px ${color}"></span>`;
            legend.appendChild(item);
        }

        const center = document.createElement('div');
        center.style.flex = '1 1 auto';
        center.style.display = 'flex';
        center.style.alignItems = 'center';
        center.style.justifyContent = 'center';
        center.style.padding = '10px 0';

        const starWrap = document.createElement('div');
        starWrap.style.position = 'relative';
        starWrap.style.width = 'min(62vw, 360px)';
        starWrap.style.maxWidth = '360px';
        starWrap.style.aspectRatio = '1';
        starWrap.style.display = 'flex';
        starWrap.style.alignItems = 'center';
        starWrap.style.justifyContent = 'center';

        const star = document.createElement('button');
        star.type = 'button';
        star.style.cssText = [
            'position:relative',
            'width:100%',
            'height:100%',
            'border:0',
            'cursor:pointer',
            'background:linear-gradient(180deg, #ffe76a, #ff9c1f)',
            'clip-path:polygon(50% 0%,61% 36%,98% 36%,68% 58%,79% 96%,50% 73%,21% 96%,32% 58%,2% 36%,39% 36%)',
            'box-shadow:0 0 0 4px rgba(0,0,0,0.18) inset, 0 0 40px rgba(255,199,55,0.45)',
            'padding:0'
        ].join(';');
        star.addEventListener('click', () => this._advanceRandomStarStep());

        const eyeStyle = 'position:absolute;width:16px;height:20px;border-radius:999px;background:#10131d;top:38%;';
        const eyeLeft = document.createElement('span');
        eyeLeft.style.cssText = eyeStyle + 'left:36%;';
        const eyeRight = document.createElement('span');
        eyeRight.style.cssText = eyeStyle + 'right:36%;';
        const mouth = document.createElement('span');
        mouth.style.cssText = 'position:absolute;left:50%;top:56%;transform:translateX(-50%);width:42px;height:18px;border-bottom:6px solid #10131d;border-radius:0 0 999px 999px;';
        const hint = document.createElement('div');
        hint.style.cssText = 'position:absolute;left:50%;bottom:20%;transform:translateX(-50%);font-size:13px;font-weight:700;color:#10131d;text-shadow:0 1px 0 rgba(255,255,255,0.35);letter-spacing:0.08em;';
        hint.textContent = 'TIPPEN';
        star.appendChild(eyeLeft);
        star.appendChild(eyeRight);
        star.appendChild(mouth);
        star.appendChild(hint);

        starWrap.appendChild(star);
        center.appendChild(starWrap);

        const progress = document.createElement('div');
        progress.style.display = 'grid';
        progress.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
        progress.style.gap = '10px';
        progress.style.maxWidth = '420px';
        progress.style.margin = '0 auto';

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.flexDirection = 'column';
        footer.style.alignItems = 'center';
        footer.style.gap = '10px';
        footer.style.paddingBottom = '2px';

        const action = document.createElement('button');
        action.type = 'button';
        action.style.cssText = 'border:0;border-radius:14px;padding:12px 18px;background:#ffd84a;color:#111;font:800 13px monospace;min-width:210px;';
        action.addEventListener('click', () => {
            if (this.shopRandomStarFinished && this.shopRandomStarRevealReady) {
                this._resolveRandomStarReward();
                this.closeRandomStarOverlay();
                this.refreshShopOverlay2();
                return;
            }
            this._advanceRandomStarStep();
        });

        const status = document.createElement('div');
        status.style.cssText = 'font-size:12px;color:#d7d0c0;text-align:center;line-height:1.5;min-height:2.4em;';

        footer.appendChild(action);
        footer.appendChild(status);

        content.appendChild(header);
        content.appendChild(legend);
        content.appendChild(center);
        content.appendChild(progress);
        content.appendChild(footer);

        panel.appendChild(trophyBg);
        panel.appendChild(content);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        this.shopStarOverlay = overlay;
        this.shopStarPanel = panel;
        this.shopStarProgress = progress;
        this.shopStarAction = action;
        this.shopStarStatus = status;
        this.shopStarHint = hint;
        this.shopStarNode = star;
    },

    refreshRandomStarOverlay() {
        if (!this.shopStarOverlay) return;
        if (this.shopStarProgress) {
            this.shopStarProgress.innerHTML = '';
            const attemptsUsed = 5 - Math.max(0, this.shopRandomStarAttempts || 0);
            for (let i = 0; i < 5; i++) {
                const orb = document.createElement('div');
                const active = i < attemptsUsed;
                const colors = ['#5eff77', '#ffe75f', '#ffb13d', '#ff6363', '#9a78ff'];
                orb.style.cssText = 'aspect-ratio:1;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;' +
                    'border:2px solid ' + (active ? colors[Math.min(i, colors.length - 1)] : 'rgba(255,255,255,0.18)') + ';' +
                    'background:' + (active ? colors[Math.min(i, colors.length - 1)] : 'rgba(255,255,255,0.05)') + ';' +
                    'color:' + (active ? '#10131d' : 'rgba(255,255,255,0.55)') + ';';
                orb.textContent = '?';
                this.shopStarProgress.appendChild(orb);
            }
        }
        if (this.shopStarAction) {
            this.shopStarAction.textContent = this.shopRandomStarFinished && this.shopRandomStarRevealReady
                ? 'ZUM ÖFFNEN TIPPEN'
                : 'Stern antippen';
        }
        if (this.shopStarHint) {
            const tierLabel = ['Scharf', 'Super Scharf', 'Mega Scharf', 'Ultra Scharf'][Math.min(this.shopRandomStarTier || 0, 3)];
            this.shopStarHint.textContent = this.shopRandomStarFinished && this.shopRandomStarRevealReady
                ? 'Der Stern ist voll geladen. Jetzt kannst du ihn öffnen.'
                : `Stufe: ${tierLabel}`;
        }
        if (this.shopStarStatus) {
            this.shopStarStatus.textContent = `Versuche übrig: ${Math.max(0, this.shopRandomStarAttempts || 0)}. Die Farbe steigt zufällig an.`;
        }
    },

    showRandomStarOverlay(visible) {
        if (this.shopStarOverlay) {
            this.shopStarOverlay.style.display = visible ? 'flex' : 'none';
        }
    },

    openRandomStarOverlay() {
        this.buildRandomStarOverlay();
        this.refreshRandomStarOverlay();
        this.showRandomStarOverlay(true);
    },

    closeRandomStarOverlay() {
        this.showRandomStarOverlay(false);
    },

    refreshShopOverlay() {
        if (!this.shopList) return;
        if (this.shopCoinsNode) {
            this.shopCoinsNode.textContent = String(this.coins || 0);
        }
        if (this.shopJewelsNode) {
            this.shopJewelsNode.textContent = String(this.jewels || 0);
        }

        this.shopList.innerHTML = '';
        const cardStyle = 'padding:14px;border:1px solid rgba(255,255,255,0.10);border-radius:16px;background:rgba(255,255,255,0.05);flex:0 0 270px;min-width:270px;scroll-snap-align:start;';
        const btnStyle = 'border:0;border-radius:12px;padding:10px 14px;font:700 12px monospace;color:#000;background:#FFD700;';
        const smallBtnStyle = 'border:0;border-radius:10px;padding:8px 12px;font:700 11px monospace;color:#000;background:#FFD700;';

        const makeCard = (title, subtitle) => {
            const card = document.createElement('div');
            card.style.cssText = cardStyle;
            const head = document.createElement('div');
            head.style.display = 'flex';
            head.style.justifyContent = 'space-between';
            head.style.gap = '12px';
            head.style.alignItems = 'flex-start';
            head.style.minWidth = '0';
            head.innerHTML = `
                <div style="min-width:0;overflow-wrap:anywhere">
                    <div style="font-size:15px;font-weight:700">${title}</div>
                    <div style="font-size:11px;color:#a8afbf;margin-top:4px">${subtitle}</div>
                </div>
            `;
            card.appendChild(head);
            return card;
        };

        const daily = makeCard('Daily Reward', this.dailyRewardClaimDate === this._todayKey() ? 'Heute bereits geholt oder fuer 5000 Muenzen erneut freischalten.' : 'Erster Klick heute gratis.');
        if (this.freeStarTier) {
            const tag = document.createElement('div');
            tag.style.cssText = 'margin-top:10px;display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:rgba(255,215,0,0.12);color:#ffd966;font-size:11px;font-weight:700;';
            tag.textContent = 'Freier Stern: ' + this.freeStarTier.toUpperCase();
            daily.appendChild(tag);
        }
        const dailyBtn = document.createElement('button');
        dailyBtn.type = 'button';
        dailyBtn.textContent = this.dailyRewardClaimDate === this._todayKey() ? 'Nochmal holen (5000 M)' : 'Gratis holen';
        dailyBtn.style.cssText = btnStyle + 'margin-top:12px;align-self:flex-start;';
        dailyBtn.addEventListener('click', () => {
            this._grantDailyReward(false) || this._grantDailyReward(true);
            this.refreshShopOverlay2();
        });
        daily.appendChild(dailyBtn);
        this.shopList.appendChild(daily);

        const exchange = makeCard('Wechselstube', 'Coins und Juwelen tauschen.');
        const exchangeRows = [
            { label: '20 J = 100 M', can: this.jewels >= 20, action: () => { if (this._spendJewels(20)) this._grantCoins(100); } },
            { label: '50 J = 500 M', can: this.jewels >= 50, action: () => { if (this._spendJewels(50)) this._grantCoins(500); } },
            { label: '100 J = 1000 M', can: this.jewels >= 100, action: () => { if (this._spendJewels(100)) this._grantCoins(1000); } },
            { label: '150 J = 5000 M', can: this.jewels >= 150, action: () => { if (this._spendJewels(150)) this._grantCoins(5000); } },
            { label: '500 M = 50 J', can: this.coins >= 500, action: () => { if (this._spendCoins(500)) this._grantJewels(50); } },
            { label: '1000 M = 100 J', can: this.coins >= 1000, action: () => { if (this._spendCoins(1000)) this._grantJewels(100); } },
            { label: '3000 M = 500 J', can: this.coins >= 3000, action: () => { if (this._spendCoins(3000)) this._grantJewels(500); } },
            { label: '5000 M = 800 J', can: this.coins >= 5000, action: () => { if (this._spendCoins(5000)) this._grantJewels(800); } }
        ];
        const exchangeGrid = document.createElement('div');
        exchangeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px;';
        for (const row of exchangeRows) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = row.label;
            btn.disabled = !row.can;
            btn.style.cssText = 'border:0;border-radius:10px;padding:8px 10px;font:700 11px monospace;' +
                (row.can ? 'color:#fff;background:#2A8CFF;' : 'color:#666;background:#2a2a33;');
            btn.addEventListener('click', () => {
                row.action();
                this.refreshShopOverlay2();
            });
            exchangeGrid.appendChild(btn);
        }
        exchange.appendChild(exchangeGrid);
        this.shopList.appendChild(exchange);

        const market = makeCard('Sternen-Markt', 'Feste Preise, feste Seltenheiten. Kein Zufall hier.');
        const tiers = [
            { id: 'green', label: 'Scharf', price: 50, desc: 'kleiner Bonus' },
            { id: 'yellow', label: 'Super Scharf', price: 150, desc: 'solider Bonus' },
            { id: 'orange', label: 'Mega Scharf', price: 200, desc: 'starker Bonus' },
            { id: 'red', label: 'Ultra Scharf', price: 350, desc: 'maximaler Bonus' }
        ];
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px;';
        for (const tier of tiers) {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.style.cssText = 'text-align:left;border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:12px;background:rgba(255,255,255,0.05);color:#fff;min-height:92px;min-width:0;';
            const free = this.freeStarTier === tier.id;
            cell.innerHTML = `
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
                    <div style="min-width:0">
                        <div style="font-size:14px;font-weight:700">${tier.label}</div>
                        <div style="font-size:11px;color:#a8afbf;margin-top:4px">${tier.desc}</div>
                    </div>
                    <div style="font-size:11px;font-weight:700;color:${free ? '#ffd966' : '#fff'}">${free ? 'FREE' : tier.price + ' M'}</div>
                </div>
            `;
            cell.addEventListener('click', () => {
                const actualTier = free ? this._consumeFreeStar() : tier.id;
                this._applyStarReward(actualTier, free);
                this.refreshShopOverlay2();
            });
            grid.appendChild(cell);
        }
        market.appendChild(grid);
        this.shopList.appendChild(market);

        const random = makeCard('Zufalls-Stern', '5 Versuche im Vollbild-Overlay. Preis: 100 Münzen.');
        const randomMeta = document.createElement('div');
        randomMeta.style.cssText = 'margin-top:10px;font-size:12px;color:#cfd6e2;line-height:1.5';
        randomMeta.textContent = 'Stufe: ' + ['Scharf', 'Super Scharf', 'Mega Scharf', 'Ultra Scharf'][Math.min(this.shopRandomStarTier || 0, 3)] + ' | Versuche: ' + (this.shopRandomStarAttempts || 0);
        random.appendChild(randomMeta);
        const randomBtn = document.createElement('button');
        randomBtn.type = 'button';
        randomBtn.textContent = 'Böse Sterne öffnen';
        randomBtn.style.cssText = smallBtnStyle + 'margin-top:12px;align-self:flex-start;';
        randomBtn.addEventListener('click', () => {
            this.openRandomStarOverlay2();
        });
        random.appendChild(randomBtn);
        this.shopList.appendChild(random);

        const crown = makeCard('Goldene Krone', '500 Münzen. Startet jedes Level mit 15 Sekunden Schutzschild.');
        const crownBtn = document.createElement('button');
        crownBtn.type = 'button';
        crownBtn.textContent = this.unlockedCrown ? 'Bereits gekauft' : 'Krone kaufen';
        crownBtn.style.cssText = smallBtnStyle + 'margin-top:12px;align-self:flex-start;';
        crownBtn.disabled = !!this.unlockedCrown;
        crownBtn.addEventListener('click', () => {
            if (this.coins >= 500) {
                this.coins -= 500;
                this.unlockedCrown = true;
                if (this.player) {
                    this.player.hasCrown = true;
                    this.player.startCrownShield();
                }
                this.save();
                this.refreshShopOverlay2();
            }
        });
        crown.appendChild(crownBtn);
        this.shopList.appendChild(crown);

        const quick = makeCard('Navigation', 'Schnelle Bedienung.');
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.textContent = 'Zurück zur Titelseite';
        backBtn.style.cssText = btnStyle + 'margin-top:12px;align-self:flex-start;';
        backBtn.addEventListener('click', () => this.closeShop());
        quick.appendChild(backBtn);
        this.shopList.appendChild(quick);
    },

    showShopOverlay(visible) {
        if (this.shopOverlay) {
            this.shopOverlay.style.display = visible ? 'flex' : 'none';
        }
    },

    closeShop() {
        this.showShopOverlay(false);
        this.closeRandomStarOverlay2();
        this.state = 'TITLE';
        this.save();
    },

    returnToTitle() {
        if (this.trainingMode) {
            this.trainingCompleted = true;
        }
        this.trainingMode = false;
        this.activeMode = null;
        this.showShopOverlay(false);
        this.closeRandomStarOverlay2();
        this.showWorldSelectOverlay(false);
        this.closeExtraMode();
        this.state = 'TITLE';
        this.save();
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
        const randI = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const alreadyClaimed = this.dailyRewardClaimDate === today;
        if (alreadyClaimed && !forcePay) return false;
        if (alreadyClaimed && forcePay) {
            if (this.coins < 5000) return false;
            this.coins -= 5000;
        }
        const roll = Math.random();
        if (roll < 0.45) {
            this._grantCoins(randI(150, 700));
        } else if (roll < 0.7) {
            const upgrades = ['unlockedTripleShot', 'unlockedShadowCaster', 'unlockedGamerPistol', 'unlockedFruitUpgrades'];
            const unlocked = upgrades.find(u => !this[u]);
            if (unlocked) {
                this[unlocked] = true;
            } else {
                this._grantCoins(300);
            }
        } else {
            const tiers = ['green', 'yellow', 'orange', 'red'];
            this.freeStarTier = tiers[randI(0, tiers.length - 1)];
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
        if (!free && this.coins < price) return false;
        if (!free) this.coins -= price;

        if (tier === 'green') {
            this.unlockedTripleShot = true;
        } else if (tier === 'yellow') {
            this.unlockedShadowCaster = true;
        } else if (tier === 'orange') {
            this.unlockedGamerPistol = true;
        } else if (tier === 'red') {
            this.unlockedCrown = true;
        }
        this.save();
        return true;
    },

    _advanceRandomStarStep() {
        if (this.shopRandomStarFinished) return;
        if (this.shopRandomStarAttempts <= 0) {
            this.shopRandomStarFinished = true;
            this.shopRandomStarRevealReady = true;
            this.refreshRandomStarOverlay();
            return;
        }

        this.shopRandomStarAttempts--;
        const chances = [0.65, 0.5, 0.35];
        const chance = chances[Math.min(this.shopRandomStarTier, chances.length - 1)];
        if (Math.random() < chance && this.shopRandomStarTier < 3) {
            this.shopRandomStarTier++;
        }
        if (this.shopRandomStarTier >= 3 || this.shopRandomStarAttempts <= 0) {
            this.shopRandomStarFinished = true;
            this.shopRandomStarRevealReady = true;
        }
        this.save();
        this.refreshRandomStarOverlay();
    },

    _resolveRandomStarReward() {
        const tier = Math.min(this.shopRandomStarTier || 0, 3);
        if (tier >= 3) {
            this._grantCoins(1000);
            this.unlockedTripleShot = true;
            this.unlockedShadowCaster = true;
            this.unlockedGamerPistol = true;
            this.unlockedFruitUpgrades = true;
        } else if (tier === 2) {
            this.unlockedGamerPistol = true;
        } else if (tier === 1) {
            this.unlockedShadowCaster = true;
        } else {
            this.unlockedTripleShot = true;
        }
        this.save();
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
        this.currentWorld = 0;
        this.unlockedRanged = false;
        this.unlockedAuto = false;
        this.unlockedCrown = false;
        this.unlockedTripleShot = false;
        this.maxWorldUnlocked = 0;
        this.trainingCompleted = false;
        this.coins = 0;
        this.jewels = 0;
        this.dailyRewardClaimDate = '';
        this.freeStarTier = null;
        this.worldRewardClaims = {};
        this.activeMode = null;
        this.clearSave();
        this.startWorld(0);
    },

    startWorld(worldNum) {
        this.currentWorld = worldNum;
        this.state = 'PLAYING';
        this.trainingMode = worldNum === 0;
        this.hitstopTimer = 0;
        this.epicFreezeActive = false;
        this.epicFreezeTimer = 0;
        this.epicFreezeBoss = null;
        this.fadeAlpha = 0;
        this.fadeDir = 0;
        this.fadeCallback = null;
        this.shopRandomStarFinished = false;
        this.shopRandomStarRevealReady = false;
        this.showShopOverlay(false);
        this.closeRandomStarOverlay();
        this.showWorldSelectOverlay(false);
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

        // Load world
        this.world = new World();
        const levels = [TUTORIAL_LEVEL, WORLD1_LEVEL, WORLD2_LEVEL, WORLD3_LEVEL, WORLD4_LEVEL,
            WORLD5_LEVEL, WORLD6_LEVEL, WORLD7_LEVEL, WORLD8_LEVEL,
            generateLevel(50,48,14,909), generateLevel(52,48,14,1010),
            WORLD11_LEVEL, WORLD12_LEVEL, WORLD13_LEVEL, WORLD14_LEVEL, WORLD15_LEVEL,
            WORLD16_LEVEL, WORLD17_LEVEL, WORLD18_LEVEL, WORLD19_LEVEL, WORLD20_LEVEL, WORLD21_LEVEL];
        const themes = ['castle', 'castle', 'factory', 'cave', 'dark',
            'mushroom', 'swamp', 'ice', 'volcano',
            'dark', 'mushroom', 'pixel', 'space', 'dark', 'swamp', 'ice'];
        themes.push('fruit');
        themes.push('dino');
        themes.push('space');
        themes.push('swamp');
        themes.push('football');
        themes.push('factory');
        this.world.load(levels[worldNum]);
        this.world.theme = themes[worldNum];

        // Spawn player
        this.player = new Player(this.world.spawnPoint.x, this.world.spawnPoint.y);

        // Spawn companions
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

        // Apply unlocked abilities
        if (this.unlockedRanged || worldNum >= 3) {
            this.unlockedRanged = true;
            this.player.rangedWeapon = new BaseballLauncher();
            this.player.rangedWeapon.tripleShot = true;
            this.player.rangedWeapon.poison = true;
            // W9 reward: Schattenwerfer (more damage, colorful)
            if (this.unlockedShadowCaster || worldNum >= 10) {
                this.player.rangedWeapon.damage = 5;
                this.player.rangedWeapon.shadowCaster = true;
            }
            // W11 reward: Gamer-Pistole (pixel beam, even more damage)
            if (this.unlockedGamerPistol || worldNum >= 12) {
                this.player.rangedWeapon.damage = 7;
                this.player.rangedWeapon.gamerPistol = true;
            }
            if (worldNum >= 3) {
                this.player.activeWeapon = this.player.rangedWeapon;
            }
        }
        // W10 reward: fruit upgrades for companions
        if (this.unlockedFruitUpgrades) {
            this.player.orangeExplosion = true;
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

        if (worldNum === 0) {
            this.player.hasAuto = false;
            this.player.rangedWeapon = null;
            this.player.activeWeapon = this.player.meleeWeapon;
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
                    if (!this._isBossRoomTile(x, y)) {
                        this._floorTiles.push({ x: x * 32 + 16, y: y * 32 + 16 });
                    }
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

    _isBossRoomTile(tx, ty) {
        if (!this.world) return false;
        return tx >= this.world.width - 13 &&
            tx <= this.world.width - 3 &&
            ty >= this.world.height - 11 &&
            ty <= this.world.height - 3;
    },

    _spawnWorldContent(worldNum) {
        if (worldNum === 0) {
            this._spawnTraining();
        } else if (worldNum === 1) {
            this._spawnWorld1();
        } else if (worldNum === 2) {
            this._spawnWorld2();
        } else if (worldNum === 3) {
            this._spawnWorld3();
        } else if (worldNum === 4) {
            this._spawnWorld4();
        } else if (worldNum === 5) {
            this._spawnWorld5();
        } else if (worldNum === 6) {
            this._spawnWorld6();
        } else if (worldNum === 7) {
            this._spawnWorld7();
        } else if (worldNum === 8) {
            this._spawnWorld8();
        } else if (worldNum === 9) {
            for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(ShadowGhost));
            for (let i = 0; i < 4; i++) this.enemies.push(this._spawnAt(ShadowWraith));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 10) {
            for (let i = 0; i < 18; i++) this.enemies.push(this._spawnAt(AngryFruit));
            for (let i = 0; i < 5; i++) this.enemies.push(this._spawnAt(GiantPlant));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 11) {
            for (let i = 0; i < 20; i++) this.enemies.push(this._spawnAt(PixelGhost));
            this.enemies.push(this._spawnAt(PixelRobot, 300));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 12) {
            for (let i = 0; i < 18; i++) this.enemies.push(this._spawnAt(StarKnight));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 13) {
            for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(SkeletonArcher));
            this.enemies.push(this._spawnAt(BoomerangSkeleton, 300));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 14) {
            for (let i = 0; i < 22; i++) this.enemies.push(this._spawnAt(PoisonSnake));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 15) {
            for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(StoneSamurai));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 16) {
            this._spawnWorld16();
        } else if (worldNum === 17) {
            for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(MiniTRex));
            for (let i = 0; i < 6; i++) this.enemies.push(this._spawnAt(Triceratops));
            this.enemies.push(this._spawnAt(KeyGhost, 300));
            for (let i = 0; i < 8; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 18) {
            for (let i = 0; i < 14; i++) this.enemies.push(this._spawnAt(TimeClock));
            this.enemies.push(this._spawnAt(TimeClock, 300));
            this.enemies[this.enemies.length - 1].isKeyGhost = true;
            for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 19) {
            for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(ShadowCrocodileRunner));
            this.enemies.push(this._spawnAt(ShadowCrocodileRunner, 300));
            this.enemies[this.enemies.length - 1].isKeyGhost = true;
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 20) {
            for (let i = 0; i < 18; i++) this.enemies.push(this._spawnAt(FootballEnemy));
            this.enemies.push(this._spawnAt(FootballEnemy, 300));
            this.enemies[this.enemies.length - 1].isKeyGhost = true;
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        } else if (worldNum === 21) {
            for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(ScrapRaccoon));
            this.enemies.push(this._spawnAt(ScrapRaccoon, 300));
            this.enemies[this.enemies.length - 1].isKeyGhost = true;
            for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        }
    },

    _spawnAt(EnemyClass, minDist) {
        const p = this._getSpawnPos(minDist || 150);
        return new EnemyClass(p.x, p.y);
    },

    // ── Tutorial (Level 0) ──
    _spawnTraining() {
        for (let i = 0; i < 4; i++) this.enemies.push(this._spawnAt(TrainingTargetRobot, 120));
        for (let i = 0; i < 4; i++) this.enemies.push(this._spawnAt(TrainingPatrolRobot, 160));
        for (let i = 0; i < 3; i++) this.enemies.push(this._spawnAt(TrainingShooterRobot, 200));
        for (let i = 0; i < 4; i++) this.props.push(new SkullProp(this.player.x + i * 28, this.player.y + 100 + i * 10));
    },

    _spawnChestAt() {
        const p = this._getSpawnPos(80);
        return new Chest(p.x - 12, p.y - 10);
    },

    // ── World 1: Geisterschloss (VIELE Geister!) ──
    _spawnWorld1() {
        for (let i = 0; i < 25; i++) this.enemies.push(this._spawnAt(Ghost));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 2: Maschinen-Hof (RoboChicks + Drohnen) ──
    _spawnWorld2() {
        for (let i = 0; i < 6; i++) this.enemies.push(this._spawnAt(RoboChick));
        for (let i = 0; i < 4; i++) this.enemies.push(this._spawnAt(MiniRoboChick));
        for (let i = 0; i < 5; i++) this.enemies.push(this._spawnAt(Drone));
        this.enemies.push(this._spawnAt(GiantEgg, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 3: Schleim-Arena (Schleim-Bälle) ──
    _spawnWorld3() {
        for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(Slime));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 4: Schatten-Burg (Schatten-Ritter + Fledermäuse) ──
    _spawnWorld4() {
        for (let i = 0; i < 10; i++) this.enemies.push(this._spawnAt(ShadowKnight));
        for (let i = 0; i < 6; i++) this.enemies.push(this._spawnAt(GiantBat));
        this.enemies.push(this._spawnAt(KeyKnight, 300));
        for (let i = 0; i < 6; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 5: Pilz-Wald (Wandelnde Pilze mit Giftwolken) ──
    _spawnWorld5() {
        for (let i = 0; i < 18; i++) this.enemies.push(this._spawnAt(WalkingMushroom));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 6: Mücken-Sumpf (Sumpf-Mücken + Krokodil-Kind für Schlüssel) ──
    _spawnWorld6() {
        for (let i = 0; i < 20; i++) this.enemies.push(this._spawnAt(SwampMosquito));
        this.enemies.push(this._spawnAt(CrocodileKid, 300)); // replaces KeyGhost
        for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 7: Antarktis (Eisstrahl-Pinguine) ──
    _spawnWorld7() {
        for (let i = 0; i < 16; i++) this.enemies.push(this._spawnAt(IcePenguin));
        for (let i = 0; i < 4; i++) this.enemies.push(this._spawnAt(GiantBat));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
    },

    // ── World 8: Vulkan-Insel (Lava-Kugeln) ──
    _spawnWorld8() {
        for (let i = 0; i < 20; i++) this.enemies.push(this._spawnAt(LavaBall));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
    },

    // â”€â”€ World 16: Obst-Ninja Welt â”€â”€
    _spawnWorld16() {
        for (let i = 0; i < 10; i++) this.enemies.push(this._spawnAt(AppleNinja));
        for (let i = 0; i < 8; i++) this.enemies.push(this._spawnAt(KiwiNinja));
        this.enemies.push(this._spawnAt(KeyGhost, 300));
        for (let i = 0; i < 7; i++) this.chests.push(this._spawnChestAt());
        for (let i = 0; i < 6; i++) this.props.push(new SkullProp(this.player.x + 100 + i * 22, this.player.y + 60 + (i % 2) * 18));
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
        } else if (this.currentWorld === 5) {
            boss = new BossMushroomGiant(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 6) {
            boss = new BossMosquito(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 7) {
            boss = new BossSnowEagle(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 8) {
            boss = new BossFirePhoenix(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 9) {
            boss = new BossShadowMaster(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 10) {
            boss = new BossFruitKing(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 11) {
            boss = new BossGhostChick(this.world.bossSpawn.x, this.world.bossSpawn.y);
            boss.hp = 55; boss.maxHp = 55;
        } else if (this.currentWorld === 12) {
            boss = new BossKnightBat(this.world.bossSpawn.x, this.world.bossSpawn.y);
            boss.hp = 65; boss.maxHp = 65;
        } else if (this.currentWorld === 13) {
            boss = new BossSkeletonRider(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 14) {
            boss = new BossHydra(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 15) {
            boss = new BossStoneDemon(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 16) {
            boss = new BossFruitGiant(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 17) {
            boss = new BossStingRex(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 18) {
            boss = new BossTimeSphere(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 19) {
            boss = new BossShadowCrocodile(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 20) {
            boss = new BossFootball(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else if (this.currentWorld === 21) {
            boss = new BossScrapRaccoon(this.world.bossSpawn.x, this.world.bossSpawn.y);
        } else {
            boss = new BossGhost(this.world.bossSpawn.x, this.world.bossSpawn.y);
            boss.hp = 50; boss.maxHp = 50;
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

        this.maxWorldUnlocked = Math.min(21, Math.max(this.maxWorldUnlocked, this.currentWorld + 1));
        Sound.worldClear();
        this.state = 'WORLD_CLEAR';
        this.worldClearTimer = 60; // wait for button click

        const reward = this._claimWorldReward(this.currentWorld);
        if (reward) {
            if (reward.coins) this.coins += reward.coins;
            if (reward.jewels) this.jewels += reward.jewels;
        }

        if (this.currentWorld === 1) {
            // Progress only
        } else if (this.currentWorld === 2) {
            this.unlockedRanged = true;
        } else if (this.currentWorld === 3) {
            this.unlockedAuto = true;
        } else if (this.currentWorld === 4) {
            this.unlockedCrown = true;
        } else if (this.currentWorld === 9) {
            this.unlockedShadowCaster = true;
        } else if (this.currentWorld === 10) {
            this.unlockedFruitUpgrades = true;
        } else if (this.currentWorld === 11) {
            this.unlockedGamerPistol = true;
        } else if (this.currentWorld === 13) {
            this.unlockedBoneBat = true;
        } else if (this.currentWorld === 14) {
            this.unlockedSnakeCompanion = true;
        } else if (this.currentWorld === 15) {
            this.unlockedPetrifyStone = true;
        } else if (this.currentWorld === 16) {
            this.state = 'WIN';
        } else if (this.currentWorld === 17) {
            this.state = 'WIN';
        } else if (this.currentWorld >= 21) {
            this.state = 'WIN';
        }
        this.save();
    },

    _advanceToNextWorld() {
        if (this.currentWorld < 21) {
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
                this.openWorldSelect();
            }
            if (Input.keyPressed('KeyF')) {
                Sound.resume();
                this.enterFullscreen();
            }
            if (Input.attackPressed || Input.mouse.pressed) {
                Sound.resume();
                const btn = Renderer.getClickedButton(Input.mouse.x, Input.mouse.y);
                console.log('TITLE_CLICK', {
                    btn,
                    x: Input.mouse.x,
                    y: Input.mouse.y,
                    attackPressed: Input.attackPressed,
                    mousePressed: Input.mouse.pressed,
                    buttons: Renderer._buttons ? Renderer._buttons.map(b => b.id) : []
                });
                if (btn === 'PLAY') {
                    this.openWorldSelect();
                } else if (btn === 'SHOP') {
                    this.openShop();
                } else if (btn === 'TRAININGSPLATZ') {
                    this.startWorld(0);
                } else if (btn === 'EXTRA') {
                    this.openExtraMode();
                } else if (btn === 'VOLLBILD') {
                    this.enterFullscreen();
                }
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'WORLD_SELECT') {
            if (Input._key('Escape') || Input._key('Backspace')) {
                this.closeWorldSelect();
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'EXTRA_MENU') {
            if (Input._key('Escape') || Input._key('Backspace')) {
                this.closeExtraMode();
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'SHOP') {
            if (Input._key('Escape') || Input._key('Enter')) {
                this.returnToTitle();
                Input.postUpdate();
                return;
            }
            if (this.shopOverlay && this.shopOverlay.style.display !== 'none') {
                Input.postUpdate();
                return;
            }
            if (Input.attackPressed || Input.mouse.pressed) {
                const btn = Renderer.getClickedButton(Input.mouse.x, Input.mouse.y);
                if (btn === 'BACK') {
                    this.returnToTitle();
                } else if (btn === 'DAILY') {
                    this._grantDailyReward(false) || this._grantDailyReward(true);
                } else if (btn === 'GREEN') {
                    const free = this.freeStarTier === 'green';
                    const tier = free ? this._consumeFreeStar() : 'green';
                    this._applyStarReward(tier, free);
                } else if (btn === 'YELLOW') {
                    const free = this.freeStarTier === 'yellow';
                    const tier = free ? this._consumeFreeStar() : 'yellow';
                    this._applyStarReward(tier, free);
                } else if (btn === 'ORANGE') {
                    const free = this.freeStarTier === 'orange';
                    const tier = free ? this._consumeFreeStar() : 'orange';
                    this._applyStarReward(tier, free);
                } else if (btn === 'RED') {
                    const free = this.freeStarTier === 'red';
                    const tier = free ? this._consumeFreeStar() : 'red';
                    this._applyStarReward(tier, free);
                } else if (btn === 'RANDOM_STAR' || btn === 'BOESE STERNE') {
                    this.openRandomStarOverlay2();
                } else if (btn === 'CROWN_ITEM') {
                    if (this.coins >= 500) {
                        this.coins -= 500;
                        this.unlockedCrown = true;
                        if (this.player) {
                            this.player.hasCrown = true;
                            this.player.startCrownShield();
                        }
                        this.save();
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
                else if (btn === 'STARTSEITE') { this.trainingMode = false; this.state = 'TITLE'; }
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
                else if (btn === 'STARTSEITE') { this.trainingMode = false; this.state = 'TITLE'; }
            }
            Input.postUpdate();
            return;
        }

        if (this.state === 'WIN') {
            if (Input.attackPressed || Input._key('Enter') || Input._key('Space')) {
                this.trainingMode = false;
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
        if (this.currentWorld === 0 && (Input._key('Escape') || Input._key('Backspace'))) {
            this.returnToTitle();
            Input.postUpdate();
            return;
        }
        if (this.currentWorld === 0 && (Input.attackPressed || Input.mouse.pressed)) {
            const btn = Renderer.getClickedButton(Input.mouse.x, Input.mouse.y);
            if (btn === 'STARTSEITE') {
                this.returnToTitle();
                Input.postUpdate();
                return;
            }
        }
        this.world.update(dt);
        this.player.update(dt, this.world);

        // Update companions
        for (const c of this.companions) {
            c.update(dt, this.world, this.player, this.enemies);
        }

        // Decorative props
        for (const prop of this.props) {
            prop.update(dt, this.world, this.player, this.enemies);
        }

        // Check player death
        if (this.player.dead && this.player.deathTimer <= 0) {
            this.state = 'GAME_OVER';
            Sound.gameOver();
            this.vibrate(300);
        }

        // Enemies
        const playerBush = this.world && this.world.isBush(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2);
        for (const enemy of this.enemies) {
            if (enemy.dead) {
                enemy.deathTimer -= dt;
                continue;
            }
            const enemyBush = this.world && this.world.isBush(enemy.centerX(), enemy.centerY());
            if (enemyBush && !playerBush && !enemy.isBoss) {
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
                    if (proj.slow && this.player.applySlow) this.player.applySlow(2.5, 0.55);
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

        // Check boss defeated - Epic Freeze!
        if (this.bossActive && !this.bossDefeated) {
            const boss = this.enemies.find(e => e.isBoss);
            if (boss && boss.dead && !this.epicFreezeActive) {
                // Start 2-second freeze
                this.epicFreezeActive = true;
                this.epicFreezeTimer = 2;
                this.epicFreezeBoss = boss;
                Sound.bossDeath();
                this.camera.shake(10, 0.5);
                this.vibrate(400);
            }
            if (this.epicFreezeActive) {
                this.epicFreezeTimer -= dt;
                if (this.epicFreezeTimer <= 0) {
                    // Freeze ends - boss explodes, celebrate!
                    this.epicFreezeActive = false;
                    if (this.epicFreezeBoss) {
                        const bc = this.epicFreezeBoss.center();
                        for (let i = 0; i < 20; i++) {
                            const a = (Math.PI * 2 * i) / 20;
                            this.particles.push(new Particle(bc.x, bc.y,
                                Math.cos(a) * randRange(80, 200), Math.sin(a) * randRange(80, 200),
                                ['#FF0', '#F80', '#F44', '#FFF'][i % 4], 1.0));
                        }
                        this.epicFreezeBoss.deathTimer = 0;
                    }
                    this._onBossDefeated();
                }
                Input.postUpdate();
                return; // Freeze: skip all updates but keep rendering
            }
        }

        // Particles
        for (const p of this.particles) {
            p.update(dt);
        }

        // Cleanup + particle cap
        this.enemies = this.enemies.filter(e => !(e.dead && e.deathTimer <= 0 && !e.isBoss));
        this.projectiles = this.projectiles.filter(p => !p.dead);
        this.coinDrops = [];
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

        if (this.state === 'TITLE' || this.state === 'WORLD_SELECT' || this.state === 'EXTRA_MENU') {
            Renderer.drawTitleScreen(ctx, this);
            return;
        }

        if (this.state === 'SHOP') {
            Renderer.drawShopScreen(ctx, this);
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

        // Coin drops
        for (const coin of this.coinDrops) {
            coin.draw(ctx, this.camera);
        }

        // Props
        for (const prop of this.props) {
            prop.draw(ctx, this.camera);
        }

        // Enemies (with offscreen culling)
        for (const enemy of this.enemies) {
            if (enemy.dead && enemy.deathTimer <= 0) continue;
            if (!enemy.isBoss && !isOnScreen(enemy, this.camera)) continue;
            ctx.save();
            if (this.world && this.world.isBush(enemy.centerX(), enemy.centerY())) {
                ctx.globalAlpha = 0.3;
            }
            enemy.draw(ctx, this.camera);
            ctx.restore();
        }

        // Projectiles (with offscreen culling)
        for (const proj of this.projectiles) {
            if (!isOnScreen({ x: proj.x - 5, y: proj.y - 5, w: 10, h: 10 }, this.camera, 10)) continue;
            proj.draw(ctx, this.camera);
        }

        // Companions
        for (const c of this.companions) {
            ctx.save();
            if (this.world && this.world.isBush(c.centerX(), c.centerY())) {
                ctx.globalAlpha = 0.3;
            }
            c.draw(ctx, this.camera);
            ctx.restore();
        }

        // Player
        if (this.player) {
            ctx.save();
            if (this.world && this.world.isBush(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2)) {
                ctx.globalAlpha = 0.3;
            }
            this.player.draw(ctx, this.camera);
            ctx.restore();
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
