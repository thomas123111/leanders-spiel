// ── Menüs und Dialoge (HTML/CSS über dem Spiel-Canvas) ──

const STAR_TIERS = [
    { id: 'green', label: 'Scharf', color: '#47d163', price: 50, gift: 'Schnell-Wurf', flag: 'unlockedTripleShot', emoji: '🟢' },
    { id: 'yellow', label: 'Super Scharf', color: '#ffe14d', price: 150, gift: 'Schatten-Werfer', flag: 'unlockedShadowCaster', emoji: '🟡' },
    { id: 'orange', label: 'Mega Scharf', color: '#ff9f2e', price: 200, gift: 'Gamer-Pistole', flag: 'unlockedGamerPistol', emoji: '🟠' },
    { id: 'red', label: 'Ultra Scharf', color: '#ff5f5f', price: 350, gift: 'Goldene Krone', flag: 'unlockedCrown', emoji: '🔴' },
];
const BAD_STAR_PRICE = 100;

const UI = {
    root: null,
    screens: {},
    current: null,
    _starRaf: 0,

    init() {
        this.root = document.getElementById('ui');
        for (const id of ['title', 'worlds', 'shop', 'star', 'extra', 'pause', 'result', 'settings']) {
            const el = document.createElement('section');
            el.className = 'screen' + (['pause', 'result', 'settings'].includes(id) ? ' overlay' : ' page');
            if (id === 'title' || id === 'star') el.classList.remove('page');
            el.id = 'scr-' + id;
            this.root.appendChild(el);
            this.screens[id] = el;
        }
        this.root.addEventListener('click', e => this._onClick(e));
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hide');
            setTimeout(() => loading.remove(), 400);
        }
    },

    // Blendet genau einen Bildschirm ein (oder keinen: null).
    show(id) {
        for (const [key, el] of Object.entries(this.screens)) el.classList.toggle('show', key === id);
        this.current = id;
        if (id !== 'star') cancelAnimationFrame(this._starRaf);
    },

    // Passenden Bildschirm zum Spielzustand zeigen
    onState(state) {
        if (state === 'TITLE') this.renderTitle();
        else if (state === 'WORLD_SELECT') this.renderWorlds();
        else if (state === 'SHOP') this.renderShop();
        else if (state === 'EXTRA_MENU') this.renderExtra();
        else if (state === 'WORLD_CLEAR') this.renderResult('clear');
        else if (state === 'GAME_OVER') this.renderResult('over');
        else if (state === 'WIN') this.renderResult('win');
        else this.show(Game.paused ? 'pause' : null);
    },

    showPause(on) {
        if (on) this.renderPause();
        else if (this.current === 'pause' || this.current === 'settings') this.show(null);
    },

    _chips() {
        const stars = Game.boseStarUses || 0;
        return `<div class="chips">
            <span class="chip coin"><i>🪙</i><b>${Game.coins | 0}</b></span>
            <span class="chip gem"><i>💎</i><b>${Game.jewels | 0}</b></span>
            ${stars ? `<span class="chip star"><i>😈</i><b>${stars}</b></span>` : ''}
        </div>`;
    },

    // ── Startseite ──
    renderTitle() {
        const el = this.screens.title;
        const canFs = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
        el.innerHTML = `
            <div class="wallet">${this._chips()}</div>
            <div class="topbar">
                ${canFs ? '<button class="icon-btn" data-act="fullscreen" aria-label="Vollbild">⛶</button>' : ''}
                <button class="icon-btn" data-act="settings" aria-label="Einstellungen">⚙️</button>
            </div>
            <div class="hero" data-act="spin"><div class="tap-hint">Tipp auf Mark!</div></div>
            <div class="menu">
                <div class="logo"><span class="l1">Mark</span><span class="l2">und die geklauten Erfindungen</span></div>
                <p class="story">Mark ist Baseballspieler und Geisterjäger. Seit er bestohlen wurde, hat er sich verwandelt … Findet es selbst heraus!</p>
                <button class="btn big pulse" data-act="play">▶ SPIELEN</button>
                <div class="menu-row">
                    <button class="btn blue" data-act="shop">🛒 Shop</button>
                    <button class="btn green" data-act="training">🎯 Training</button>
                    <button class="btn purple" data-act="extra">✨ Extra</button>
                </div>
            </div>`;
        this.show('title');
    },

    // ── Weltkarte ──
    renderWorlds() {
        const el = this.screens.worlds;
        const max = Game.maxWorldUnlocked || 0;
        let cards = `<button class="world-card random" data-act="random" ${max <= 0 ? 'disabled' : ''}>
                <div class="num">ZUFALL</div><div class="emoji">🎲</div>
                <div class="name">Überrasch mich!</div><div class="boss">eine freie Welt</div>
                <div class="reward">?</div></button>`;
        for (let i = 1; i <= LAST_WORLD; i++) {
            const info = worldInfo(i);
            const locked = i > max;
            const reward = Game._getWorldReward(i);
            const done = reward.claimed;
            const isNew = !locked && !done && i === max;
            cards += `<button class="world-card${locked ? ' locked' : ''}" style="--a:${info.accent}" data-act="world" data-n="${i}" ${locked ? 'disabled' : ''}>
                ${done ? '<span class="badge">✓</span>' : (isNew ? '<span class="badge new">NEU</span>' : '')}
                <div class="num">WELT ${i}</div>
                <div class="emoji">${info.emoji}</div>
                ${locked ? '<div class="lock">🔒</div>' : ''}
                <div class="name">${info.name}</div>
                <div class="boss">Boss: ${locked ? '???' : info.boss}</div>
                <div class="reward${done ? ' done' : ''}">${done ? '✓ geschafft' : '🎁 ' + this._rewardText(reward)}</div>
            </button>`;
        }
        el.innerHTML = `
            <div class="page-head">
                <button class="btn small gray" data-act="title">◀ Zurück</button>
                <h2>Weltkarte</h2>
                ${this._chips()}
            </div>
            <div class="page-body"><div class="world-strip">${cards}</div></div>`;
        this.show('worlds');
        // Zur neuesten Welt scrollen
        requestAnimationFrame(() => {
            const strip = el.querySelector('.world-strip');
            const target = el.querySelector(`[data-n="${Math.max(1, max)}"]`);
            if (strip && target) strip.scrollLeft = Math.max(0, target.offsetLeft - strip.clientWidth / 2 + target.clientWidth / 2);
        });
    },

    _rewardText(r) {
        if (!r) return 'Belohnung';
        const map = {
            'Kein Bonus': 'Ruhm & Ehre', 'BASEBALL-WERFER': 'Baseball-Werfer', 'AUTO': 'Auto', 'KRONE': 'Krone',
            'SCHATTEN-WERFER': 'Schatten-Werfer', 'OBST-UPGRADES': 'Obst-Upgrades', 'GAMER-PISTOLE': 'Gamer-Pistole',
            'KNOCHEN-UPGRADE': 'Knochen-Upgrade', 'SCHLANGE': 'Schlange', 'STEIN-GIFT': 'Stein-Gift',
            '1000 MUENZEN': '1000 Münzen', '50 JUWELEN': '50 Juwelen', '1 BOESER STERN': '1 Böser Stern',
            '1 SCHATTEN-MEISTER-STERN': 'Schatten-Meister-Stern', '3 BOESE STERNE': '3 Böse Sterne', '500 MUENZEN': '500 Münzen',
            '100 JUWELEN': '100 Juwelen',
        };
        return map[r.label] || r.label;
    },

    // ── Shop ──
    renderShop() {
        const el = this.screens.shop;
        const g = Game;
        const today = g._todayKey();
        const dailyDone = g.dailyRewardClaimDate === today;
        let starCards = '';
        for (const t of STAR_TIERS) {
            const owned = !!g[t.flag];
            const free = g.freeStarTier === t.id;
            const can = free || (!owned && g.coins >= t.price);
            let label = '🪙 ' + t.price;
            if (free) label = owned ? 'GRATIS: +150 🪙' : 'GRATIS holen';
            starCards += `<div class="card" style="--a:${t.color}">
                <div class="head"><span class="ico">⭐</span><div><h3>${t.label}</h3><p>schenkt dir: <b>${t.gift}</b></p></div></div>
                <div class="foot">
                    ${owned ? '<span class="owned">✓ hast du schon</span>' : ''}
                    ${owned && !free ? '' : `<button class="btn small ${free ? 'green' : ''}" data-act="buystar" data-tier="${t.id}" ${can ? '' : 'disabled'}>${label}</button>`}
                </div></div>`;
        }
        // Gleicher Kurs in beide Richtungen (1 💎 = 10 🪙) – vorher ließen sich unendlich Münzen erzeugen.
        const exchange = [
            [20, 'J', 100, 'M'], [50, 'J', 500, 'M'], [100, 'J', 1000, 'M'], [150, 'J', 1500, 'M'],
            [500, 'M', 50, 'J'], [1000, 'M', 100, 'J'], [3000, 'M', 300, 'J'], [5000, 'M', 500, 'J'],
        ];
        const exBtns = exchange.map(([a, from, b, to], i) => {
            const can = from === 'J' ? g.jewels >= a : g.coins >= a;
            const ic = x => x === 'J' ? '💎' : '🪙';
            return `<button class="btn small blue" data-act="exchange" data-i="${i}" ${can ? '' : 'disabled'}>${a}${ic(from)} → ${b}${ic(to)}</button>`;
        }).join('');
        const badCan = g.shopRandomStarActive || (g.boseStarUses || 0) > 0 || g.coins >= BAD_STAR_PRICE;
        const badLabel = g.shopRandomStarActive ? 'Weitermachen!' :
            ((g.boseStarUses || 0) > 0 ? 'Öffnen (1 😈)' : 'Öffnen · 🪙 ' + BAD_STAR_PRICE);
        el.innerHTML = `
            <div class="page-head">
                <button class="btn small gray" data-act="title">◀ Zurück</button>
                <h2>Shop</h2>
                ${this._chips()}
            </div>
            <div class="page-body"><div class="cards">
                <div class="card" style="--a:#3ddc97">
                    <div class="head"><span class="ico">🎁</span><div><h3>Tagesbelohnung</h3>
                    <p>${dailyDone ? 'Heute schon geholt. Nochmal geht für 5000 Münzen.' : 'Einmal am Tag gratis: Münzen, Upgrade oder ein freier Stern!'}</p></div></div>
                    ${g.freeStarTier ? `<p>Freier Stern wartet: <b>${(STAR_TIERS.find(t => t.id === g.freeStarTier) || {}).label || g.freeStarTier}</b></p>` : ''}
                    <div class="foot">${dailyDone
                        ? `<span class="owned">✓ heute geholt</span><button class="btn small gray" data-act="dailypaid" ${g.coins < 5000 ? 'disabled' : ''}>Nochmal · 🪙 5000</button>`
                        : '<button class="btn small green pulse" data-act="daily">GRATIS holen</button>'}</div>
                </div>
                <div class="card" style="--a:#ff5f5f">
                    <div class="head"><span class="ico">😈</span><div><h3>Böse Sterne</h3>
                    <p>Tippe den Stern 5-mal an – mit Glück wird er schärfer und die Belohnung größer!</p></div></div>
                    <div class="foot"><button class="btn small pink${g.shopRandomStarActive ? ' pulse' : ''}" data-act="badstar" ${badCan ? '' : 'disabled'}>${badLabel}</button></div>
                </div>
                <div class="card" style="--a:#ffd23f">
                    <div class="head"><span class="ico">👑</span><div><h3>Goldene Krone</h3>
                    <p>Jedes Level startest du mit 15 Sekunden Schutzschild.</p></div></div>
                    <div class="foot">${g.unlockedCrown ? '<span class="owned">✓ hast du schon</span>' :
                        `<button class="btn small" data-act="crown" ${g.coins >= 500 ? '' : 'disabled'}>🪙 500</button>`}</div>
                </div>
                <div class="section-title">Sternen-Markt</div>
                ${starCards}
                <div class="section-title">Wechselstube</div>
                <div class="card wide" style="--a:#4cc9f0"><div class="exchange">${exBtns}</div></div>
            </div></div>`;
        this.show('shop');
        this._exchange = exchange;
    },

    // ── Böse Sterne ──
    renderStar() {
        const el = this.screens.star;
        const g = Game;
        const tier = Math.min(g.shopRandomStarTier || 0, 3);
        const used = 5 - Math.max(0, g.shopRandomStarAttempts || 0);
        const ready = g.shopRandomStarFinished && g.shopRandomStarRevealReady;
        el.innerHTML = `
            <div class="star-area"><button class="star-btn" data-act="startap"><canvas></canvas></button></div>
            <div class="side">
                <h2>Böser Stern</h2>
                <div class="tiers">${STAR_TIERS.map((t, i) => `<div class="tier${i <= tier ? ' on' : ''}" style="color:${t.color}">${t.label}</div>`).join('')}</div>
                <div class="tries">${[0, 1, 2, 3, 4].map(i => `<span class="${i < used ? 'used' : ''}"></span>`).join('')}</div>
                <div class="msg">${ready ? 'Fertig geladen! Tipp auf ÖFFNEN.' : 'Tipp auf den Stern! Noch ' + Math.max(0, g.shopRandomStarAttempts) + ' Versuche.'}</div>
                <div class="row" style="display:flex;gap:10px">
                    ${ready ? '<button class="btn big pulse" data-act="staropen">ÖFFNEN!</button>' : ''}
                    <button class="btn small gray" data-act="starback">Zurück</button>
                </div>
            </div>`;
        this.show('star');
        this._animateStar(el.querySelector('canvas'));
    },

    _animateStar(cv) {
        cancelAnimationFrame(this._starRaf);
        if (!cv) return;
        const draw = () => {
            const rect = cv.getBoundingClientRect();
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const W = Math.max(10, Math.round(rect.width * dpr));
            if (cv.width !== W) { cv.width = W; cv.height = W; }
            const ctx = cv.getContext('2d');
            ctx.setTransform(W / 200, 0, 0, W / 200, 0, 0);
            ctx.clearRect(0, 0, 200, 200);
            const t = performance.now() / 1000;
            const tier = Math.min(Game.shopRandomStarTier || 0, 3);
            const col = STAR_TIERS[tier].color;
            const shake = this._starShake > 0 ? (this._starShake -= 0.016, Math.sin(t * 60) * 4 * this._starShake) : 0;
            const s = 1 + Math.sin(t * 3) * 0.03 + (this._starBump > 0 ? (this._starBump -= 0.02) * 0.4 : 0);
            ctx.save();
            ctx.translate(100 + shake, 102);
            ctx.scale(s, s);
            ctx.rotate(Math.sin(t * 1.3) * 0.06);
            Art.glow(ctx, 0, 0, 105, col, 0.5 + tier * 0.12);
            Art.star(ctx, 0, 0, 78, col, { inner: 0.5, lineWidth: 5, glossy: true });
            Art.shine(ctx, -26, -30, 16, 9, -0.6, 0.5);
            // Gesicht: je schärfer, desto böser
            Art.eyes(ctx, 0, -2, 11, { gap: 17, angry: tier >= 1, look: { x: Math.sin(t) * 0.6, y: 0.2 }, seed: 3, iris: tier >= 2 ? '#ff2a2a' : null });
            Art.mouth(ctx, 0, 22, 26, tier >= 2 ? 'teeth' : (tier === 1 ? 'grin' : 'smile'));
            if (tier >= 3) for (let i = 0; i < 6; i++) {
                const a = t * 2 + i;
                Art.glow(ctx, Math.cos(a) * 70, Math.sin(a) * 70, 14, '#ffae00', 0.8);
            }
            ctx.restore();
            this._starRaf = requestAnimationFrame(draw);
        };
        draw();
    },

    // ── Extra ──
    renderExtra() {
        const el = this.screens.extra;
        const max = Math.max(1, Game.maxWorldUnlocked || 1);
        const modes = [
            { id: 'ultra', ico: '⚔️', c: '#ff5d7b', t: 'Ultra-Kampf', p: 'Direkt in deine schwerste freie Welt!', w: Math.min(max, LAST_WORLD) },
            { id: 'parkour', ico: '🔥', c: '#69d26a', t: 'Sumpf-Parkour', p: 'Feuer-Fallen, Seen und schmale Brücken.', w: Math.min(max, 20) },
            { id: 'jewels', ico: '💎', c: '#6db8ff', t: 'Juwelenjagd', p: 'Sammel-Abenteuer in den Schatten-Sümpfen.', w: Math.min(max, 19) },
        ];
        el.innerHTML = `
            <div class="page-head">
                <button class="btn small gray" data-act="title">◀ Zurück</button>
                <h2>Extra-Modi</h2>
                ${this._chips()}
            </div>
            <div class="page-body"><div class="cards">
                ${modes.map(m => `<div class="card" style="--a:${m.c}">
                    <div class="head"><span class="ico">${m.ico}</span><div><h3>${m.t}</h3><p>${m.p}</p></div></div>
                    <div class="foot"><span class="owned" style="color:#ffe38a">Welt ${m.w}: ${worldInfo(m.w).name}</span>
                    <button class="btn small" data-act="world" data-n="${m.w}">Los!</button></div></div>`).join('')}
                <div class="card" style="--a:#4cc9f0">
                    <div class="head"><span class="ico">🐧</span><div><h3>Frosty Burger</h3><p>Minispiel: Hilf dem Pinguin-Koch in der Antarktis-Küche!</p></div></div>
                    <div class="foot"><button class="btn small blue" data-act="frosty">Kochen!</button></div></div>
                <div class="card wide" style="--a:#7b4dff"><p>Hier kommen bald eigene Spezial-Modi dazu. Bis dahin starten sie eine passende Welt.</p></div>
            </div></div>`;
        this.show('extra');
    },

    // ── Pause und Einstellungen ──
    _toggles() {
        const s = Game.settings;
        const t = (key, label) => `<button class="toggle${s[key] ? ' on' : ''}" data-act="toggle" data-key="${key}">${label}<span class="sw"></span></button>`;
        return `<div class="toggles">
            ${t('sound', '🔊 Geräusche')}${t('music', '🎵 Musik')}
            ${t('aimAssist', '🎯 Zielhilfe')}${t('autoFire', '🔥 Auto-Angriff')}
            ${t('vibration', '📳 Vibration')}
        </div>`;
    },

    renderPause() {
        const el = this.screens.pause;
        const training = Game.currentWorld === 0;
        el.innerHTML = `<div class="dialog">
            <h2>Pause</h2>
            <div class="sub">${training ? 'Training' : 'Welt ' + Game.currentWorld + ' · ' + worldInfo(Game.currentWorld).name}</div>
            <div class="row"><button class="btn big" data-act="resume">▶ Weiter</button></div>
            <div class="row">
                <button class="btn small blue" data-act="restart">↻ Neu starten</button>
                <button class="btn small purple" data-act="worlds">🗺️ Weltkarte</button>
                <button class="btn small gray" data-act="title">🏠 Startseite</button>
            </div>
            ${this._toggles()}
        </div>`;
        this.show('pause');
    },

    renderSettings() {
        const el = this.screens.settings;
        el.innerHTML = `<div class="dialog">
            <h2>Einstellungen</h2>
            ${this._toggles()}
            <div class="sub">Zielhilfe: Würfe und Schläge gehen leichter auf Gegner.<br>Auto-Angriff: Mark greift von selbst an, wenn Gegner nah sind.</div>
            <div class="row"><button class="btn" data-act="closesettings">Fertig</button></div>
        </div>`;
        this.show('settings');
    },

    // ── Ergebnis: Welt geschafft / Game Over / Sieg ──
    renderResult(kind) {
        const el = this.screens.result;
        const g = Game;
        const info = worldInfo(g.currentWorld);
        let html = '';
        if (kind === 'clear') {
            const r = g.lastReward;
            const unlock = g.lastUnlockText;
            html = `<div class="dialog">
                <h2>${g.currentWorld === 0 ? 'Training geschafft!' : 'Welt ' + g.currentWorld + ' geschafft!'}</h2>
                <div class="sub">${info.boss ? info.boss + ' ist besiegt! 🎉' : 'Super gemacht!'}</div>
                ${r || unlock || g.levelCoins ? `<div class="reward-box">
                    ${g.levelCoins ? `<span>🪙 +${g.levelCoins} gesammelt</span>` : ''}
                    ${r && r.coins ? `<span class="big">🪙</span><span>+${r.coins}</span>` : ''}
                    ${r && r.jewels ? `<span class="big">💎</span><span>+${r.jewels}</span>` : ''}
                    ${unlock ? `<span class="big">🎁</span><span>${unlock}</span>` : ''}
                </div>` : ''}
                ${g.lastHowTo ? `<div class="sub howto">${g.lastHowTo}</div>` : ''}
                <div class="row">
                    ${g.currentWorld < LAST_WORLD ? '<button class="btn big pulse" data-act="next">WEITER ▶</button>' : ''}
                </div>
                <div class="row">
                    <button class="btn small purple" data-act="worlds">🗺️ Weltkarte</button>
                    <button class="btn small gray" data-act="title">🏠 Startseite</button>
                </div></div>`;
        } else if (kind === 'over') {
            html = `<div class="dialog">
                <h2>Autsch!</h2>
                <div class="sub">Mark braucht eine Pause. Versuch es gleich nochmal!</div>
                ${g.levelCoins ? `<div class="reward-box"><span>🪙 ${g.levelCoins} Münzen behalten</span></div>` : ''}
                <div class="row"><button class="btn big green pulse" data-act="restart">↻ NOCHMAL</button></div>
                <div class="row">
                    <button class="btn small purple" data-act="worlds">🗺️ Weltkarte</button>
                    <button class="btn small gray" data-act="title">🏠 Startseite</button>
                </div></div>`;
        } else {
            html = `<div class="dialog">
                <h2>🏆 Alle Welten geschafft! 🏆</h2>
                <div class="sub">Mark hat alle geklauten Erfindungen zurück. Du bist ein echter Held!</div>
                <div class="reward-box"><span class="big">👑</span><span>Geisterjäger-Meister</span></div>
                <div class="row">
                    <button class="btn big" data-act="worlds">🗺️ Weltkarte</button>
                    <button class="btn small gray" data-act="title">🏠 Startseite</button>
                </div></div>`;
        }
        el.innerHTML = html;
        this.show('result');
        // Kurz sperren, damit wildes Weitertippen aus dem Kampf nicht sofort einen Knopf trifft
        const dlg = el.querySelector('.dialog');
        if (dlg) {
            dlg.classList.add('locked');
            setTimeout(() => dlg.classList.remove('locked'), 650);
        }
    },

    // ── Klicks ──
    _onClick(e) {
        const btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        const act = btn.dataset.act;
        Sound.resume();
        if (act !== 'spin') Sound.ui();
        const g = Game;
        switch (act) {
            case 'play':
                g.maybeFullscreen();
                g.openWorldSelect();
                break;
            case 'training': g.maybeFullscreen(); g.startWorld(0); break;
            case 'shop': g.openShop(); break;
            case 'extra': g.openExtraMode(); break;
            case 'title': g.returnToTitle(); break;
            case 'worlds': g.openWorldSelect(); break;
            case 'fullscreen': g.enterFullscreen(); break;
            case 'settings': this.renderSettings(); break;
            case 'closesettings': this.renderTitle(); break;
            case 'spin': g.titleSpin = 1; Sound.dodge(); break;
            case 'world': g.maybeFullscreen(); g.startWorld(+btn.dataset.n); break;
            case 'random': {
                const max = Math.max(1, g.maxWorldUnlocked || 1);
                g.startWorld(1 + Math.floor(Math.random() * max));
                break;
            }
            case 'resume': g.pause(false); break;
            case 'restart': g.paused = false; g.startWorld(g.currentWorld); break;
            case 'next': g._advanceToNextWorld(); break;
            case 'toggle': {
                const key = btn.dataset.key;
                g.settings[key] = !g.settings[key];
                g.applySettings();
                g.saveSettings();
                btn.classList.toggle('on', g.settings[key]);
                break;
            }
            case 'daily': {
                if (g.dailyRewardClaimDate === g._todayKey()) break; // bezahltes Nachholen hat einen eigenen Knopf
                if (g._grantDailyReward(false)) {
                    Sound.powerUp();
                    this.flashMessage(g.lastDailyText || 'Belohnung abgeholt!');
                    this._dailyLockUntil = performance.now() + 2000;
                }
                this.renderShop();
                break;
            }
            case 'dailypaid': {
                if (performance.now() < (this._dailyLockUntil || 0)) break;
                // Nur nach zweitem Tippen (Bestätigung), damit kein Doppeltipp 5000 Münzen kostet
                if (!(this._dailyConfirm && performance.now() - this._dailyConfirm < 3000)) {
                    this._dailyConfirm = performance.now();
                    btn.textContent = 'Wirklich 5000 🪙? Nochmal tippen';
                    btn.classList.add('pink');
                    break;
                }
                this._dailyConfirm = 0;
                if (g._grantDailyReward(true)) {
                    Sound.powerUp();
                    this.flashMessage(g.lastDailyText || 'Belohnung abgeholt!');
                }
                this.renderShop();
                break;
            }
            case 'buystar': {
                const tier = btn.dataset.tier;
                const info = STAR_TIERS.find(x => x.id === tier) || {};
                const free = g.freeStarTier === tier;
                if (free && g[info.flag]) {
                    // Freier Stern für etwas, das man schon hat: in Münzen tauschen
                    g._consumeFreeStar();
                    g._grantCoins(150);
                    g.save();
                    Sound.coin();
                    this.flashMessage('Stern eingetauscht: +150 🪙');
                } else {
                    const t = free ? g._consumeFreeStar() : tier;
                    if (g._applyStarReward(t, free)) {
                        Sound.powerUp();
                        this.flashMessage(info.gift + ' freigeschaltet!');
                    }
                }
                this.renderShop();
                break;
            }
            case 'crown':
                if (g._spendCoins(500)) {
                    g.unlockedCrown = true;
                    g.save();
                    Sound.powerUp();
                    this.flashMessage('Goldene Krone gekauft! 👑');
                }
                this.renderShop();
                break;
            case 'exchange': {
                const [a, from, b, to] = this._exchange[+btn.dataset.i];
                const ok = from === 'J' ? g._spendJewels(a) : g._spendCoins(a);
                if (ok) {
                    if (to === 'J') g._grantJewels(b); else g._grantCoins(b);
                    g.save();
                    Sound.coin();
                }
                this.renderShop();
                break;
            }
            case 'badstar':
                if (g.startBadStar()) this.renderStar();
                break;
            case 'startap':
                if (g.shopRandomStarFinished) break;
                g._advanceRandomStarStep();
                this._starShake = 1;
                this._starBump = 1;
                Sound.hit();
                this.renderStar();
                break;
            case 'staropen': {
                const text = g.openBadStar();
                Sound.powerUp();
                this.renderShop();
                this.flashMessage(text);
                break;
            }
            case 'starback': this.renderShop(); break;
            case 'frosty': g.save(); location.href = 'frosty-burger/'; break;
        }
    },

    // Kurze Einblendung im Menü
    flashMessage(text) {
        const d = document.createElement('div');
        d.style.cssText = 'position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:40;padding:12px 20px;border-radius:18px;' +
            'background:linear-gradient(180deg,#ffe14d,#ffb01f);color:#3a1d00;font:900 18px var(--font);box-shadow:0 5px 0 #c96a00,0 12px 24px rgba(0,0,0,.4);' +
            'pointer-events:none;animation:pop-in .35s cubic-bezier(.2,1.3,.4,1);white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis';
        d.textContent = text;
        document.body.appendChild(d);
        setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; }, 1800);
        setTimeout(() => d.remove(), 2300);
    },
};
