// ── Menüs und Dialoge (HTML/CSS über dem Spiel-Canvas) ──

const STAR_TIERS = [
    { id: 'green', label: 'Scharf', color: '#47d163', price: 50, gift: 'Schnell-Wurf', flag: 'unlockedTripleShot', emoji: '🟢' },
    { id: 'yellow', label: 'Super Scharf', color: '#ffe14d', price: 150, gift: 'Schatten-Werfer', flag: 'unlockedShadowCaster', emoji: '🟡' },
    { id: 'orange', label: 'Mega Scharf', color: '#ff9f2e', price: 200, gift: 'Gamer-Pistole', flag: 'unlockedGamerPistol', emoji: '🟠' },
    { id: 'red', label: 'Ultra Scharf', color: '#ff5f5f', price: 350, gift: 'Goldene Krone', flag: 'unlockedCrown', emoji: '🔴' },
];
const BAD_STAR_PRICE = 100;

// Seltenheiten der Bösen Sterne (Wunsch von Leander: wie in Brawl Stars). Namen und Farben nur hier ändern.
// c = Grundfarbe, hi/lo = helle und dunkle Seite der 3D-Facetten, rainbow = Regenbogen-Facetten.
const STAR_RARITIES = [
    { name: 'Selten', c: '#4fd46a', hi: '#b6f7c0', lo: '#17702c', emoji: '🟢' },
    { name: 'Superselten', c: '#3d9bff', hi: '#b4dcff', lo: '#15489e', emoji: '🔵' },
    { name: 'Episch', c: '#b45cff', hi: '#e6c6ff', lo: '#5a1a9e', emoji: '🟣' },
    { name: 'Mythisch', c: '#ff4d6d', hi: '#ffc0cb', lo: '#9e1030', emoji: '🔴' },
    { name: 'Legendär', c: '#ffd23f', hi: '#fff6c2', lo: '#b87400', emoji: '🟡' },
    { name: 'Ultralegendär', c: '#ff7af5', hi: '#ffffff', lo: '#5a2ad0', emoji: '🌈', rainbow: true },
];
// Chance, beim Antippen eine Seltenheit aufzusteigen (je aktueller Stufe); 5 Versuche pro Stern.
// Ergibt am Ende: Selten 8 %, Superselten 36 %, Episch 38 %, Mythisch 15 %, Legendär 2 %, Ultralegendär 0,1 %.
const STAR_UPGRADE_CHANCES = [0.4, 0.3, 0.25, 0.2, 0.15];
const STAR_TRIES = 5;
// Figuren im Karussell der Startseite (Wunsch von Leander: wischen → nächste Figur und ihr Text).
// Die Reihenfolge ist die im Kreis; gezeichnet werden sie in main.js (_drawTitleScene).
const TITLE_CHARS = [
    { id: 'mark', name: 'Mark', text: 'Mark ist Baseballspieler und Geisterjäger. Seit er bestohlen wurde, hat er sich verwandelt … Findet es selbst heraus!' },
    { id: 'juri', name: 'Juri', text: 'Juri ist Marks bester Freund. Er haut mit seinem Hammer auf die Gegner und kämpft ab Welt 7 an deiner Seite, ab Welt 8 sogar mit einem Feuerkreis.' },
    { id: 'croc', name: 'Schatten-Krokodil', text: 'Das Schatten-Krokodil spuckt auf alle Gegner in der Nähe. Es hilft dir ab Welt 8, ab Welt 9 explodieren seine Schüsse in Feuer.' },
];

// Werfer-Upgrades (Game-Flag → Name), mit Bild auf der Belohnungsseite der Bösen Sterne
const UPGRADE_INFO = {
    unlockedTripleShot: { name: 'Schnell-Wurf' },
    unlockedShadowCaster: { name: 'Schatten-Werfer' },
    unlockedGamerPistol: { name: 'Gamer-Pistole' },
    unlockedFruitUpgrades: { name: 'Obst-Upgrades' },
};

const UI = {
    root: null,
    screens: {},
    current: null,
    _starRaf: 0,
    // Bewegungswerte des Bösen Sterns (0 = Ruhe)
    _starShake: 0,
    _starBump: 0,
    _starSpin: 0,
    _starFlash: 0,

    // Erweiterungen aus eigenen Dateien (js/ui-box.js, js/ui-end.js, js/ui-progress.js), angemeldet mit
    // UI.register({ screens: { id: 'page' | 'full' | 'overlay' }, onClick(act, btn, e) → true wenn erledigt,
    //   onResult(kind) → true wenn die Endseite selbst gezeigt wurde, titleButtons() → HTML,
    //   worldsFooter() → HTML, shopCards() → HTML }).
    ext: [],
    register(mod) { this.ext.push(mod); },
    _extHtml(fn) { return this.ext.map(m => (m[fn] ? m[fn]() || '' : '')).join(''); },

    init() {
        this.root = document.getElementById('ui');
        const kinds = { title: 'full', worlds: 'page', shop: 'page', star: 'full', extra: 'page', pause: 'overlay', result: 'overlay', settings: 'overlay' };
        for (const m of this.ext) Object.assign(kinds, m.screens || {});
        for (const [id, kind] of Object.entries(kinds)) {
            const el = document.createElement('section');
            el.className = 'screen' + (kind === 'overlay' ? ' overlay' : kind === 'page' ? ' page' : '');
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
            <span class="chip pp"><i>⚡</i><b>${Progress.pp | 0}</b></span>
            ${stars ? `<span class="chip star"><i>😈</i><b>${stars}</b></span>` : ''}
            ${Game.settings.difficulty !== 'normal' ? `<span class="chip"><i>${Game.settings.difficulty === 'extrem' ? '🔥' : '💪'}</i><b>${Game.difficulty().name}</b></span>` : ''}
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
            <div class="hero" aria-label="Figuren: zur Seite wischen"><div class="tap-hint">◀ wischen ▶</div></div>
            <div class="menu">
                <div class="logo"><span class="l1">Mark</span><span class="l2">und die geklauten Erfindungen</span></div>
                <p class="story">${this._titleCharText()}</p>
                <button class="btn big pulse" data-act="play">▶ SPIELEN</button>
                <div class="menu-row">
                    <button class="btn blue" data-act="shop">🛒 Shop</button>
                    <button class="btn green" data-act="training">🎯 Training</button>
                    <button class="btn purple" data-act="extra">✨ Extra</button>
                </div>
            </div>
            <div class="title-ext">${this._extHtml('titleButtons')}</div>`;
        this.show('title');
        // Karussell: waagerecht wischen dreht die Figuren weiter, Tippen lässt die vordere Figur springen
        const hero = el.querySelector('.hero');
        let sx = null, sy = 0;
        hero.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
        hero.addEventListener('pointercancel', () => { sx = null; });
        hero.addEventListener('pointerup', e => {
            if (sx === null) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            sx = null;
            Sound.resume();
            if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) this.titleTurn(dx < 0 ? 1 : -1);
            else { Game.titleSpin = 1; Sound.dodge(); }
        });
    },

    // Text der vorderen Figur im Karussell
    _titleCharText() {
        const n = TITLE_CHARS.length;
        const c = TITLE_CHARS[((Game.titleIndex || 0) % n + n) % n];
        return `<b>${c.name}:</b> ${c.text}`;
    },

    // Karussell eine Figur weiterdrehen (dir = 1 nach links wischen, -1 nach rechts)
    titleTurn(dir) {
        Game.titleIndex = (Game.titleIndex || 0) + dir;
        Sound.ui();
        const story = this.screens.title.querySelector('.story');
        if (story) {
            story.innerHTML = this._titleCharText();
            story.classList.remove('swap');
            void story.offsetWidth;                  // Animation neu starten
            story.classList.add('swap');
        }
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
                <div class="name">${this._shy(info.name)}</div>
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
            <div class="page-body"><div class="world-strip">${cards}</div></div>
            ${this._extHtml('worldsFooter')}`;
        this.show('worlds');
        // Zur neuesten Welt scrollen
        requestAnimationFrame(() => {
            const strip = el.querySelector('.world-strip');
            const target = el.querySelector(`[data-n="${Math.max(1, max)}"]`);
            if (strip && target) strip.scrollLeft = Math.max(0, target.offsetLeft - strip.clientWidth / 2 + target.clientWidth / 2);
        });
    },

    // Weiche Trennstellen in langen Weltnamen: Chrome trennt Deutsch nicht selbst und brach sonst mitten
    // im Wort ohne Bindestrich um („Wolkenfestun|g“)
    _shy(name) {
        return name.replace(/(Wolken|Pyramiden|Gewitter|Schmetterling|Glut|Vollmond|Drachen|Maschinen|Sternen|Schatten|Knochen)(?=\p{L}{3})/gu, '$1­');
    },

    _rewardText(r) {
        if (!r) return 'Belohnung';
        const map = {
            'Kein Bonus': 'Ruhm & Ehre', 'BASEBALL-WERFER': 'Baseball-Werfer', 'AUTO': 'Auto', 'KRONE': 'Krone',
            'SCHATTEN-WERFER': 'Schatten-Werfer', 'OBST-UPGRADES': 'Obst-Upgrades', 'GAMER-PISTOLE': 'Gamer-Pistole',
            'KNOCHEN-UPGRADE': 'Knochen-Upgrade', 'SCHLANGE': 'Schlange', 'STEIN-GIFT': 'Stein-Gift',
            '1000 MUENZEN': '1000 Münzen', '50 JUWELEN': '50 Juwelen', '1 BOESER STERN': '1 Böser Stern',
            '1 SCHATTEN-MEISTER-STERN': 'Schatten-Meister-Stern', '3 BOESE STERNE': '3 Böse Sterne', '500 MUENZEN': '500 Münzen',
            '100 JUWELEN': '100 Juwelen', '2000 MUENZEN': '2000 Münzen',
            '150 JUWELEN': '150 Juwelen', '2500 MUENZEN': '2500 Münzen', '200 JUWELEN': '200 Juwelen',
            '3000 MUENZEN': '3000 Münzen', '5000 MUENZEN': '5000 Münzen',
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
                    <p>${dailyDone ? 'Heute schon geholt. Morgen gibt es die nächste!' : 'Einmal am Tag gratis: Münzen, Upgrade oder ein Böser Stern!'}</p></div></div>
                    ${g.freeStarTier ? `<p>Freier Stern wartet: <b>${(STAR_TIERS.find(t => t.id === g.freeStarTier) || {}).label || g.freeStarTier}</b></p>` : ''}
                    <div class="foot">${dailyDone
                        ? '<span class="owned">✓ heute geholt</span>'
                        : '<button class="btn small green pulse" data-act="daily">GRATIS holen</button>'}</div>
                </div>
                <div class="card" style="--a:#ff5f5f">
                    <div class="head"><span class="ico">😈</span><div><h3>Böse Sterne</h3>
                    <p>Tippe den Stern ${STAR_TRIES}-mal an. Mit Glück wird er seltener und die Belohnung größer:
                    ${STAR_RARITIES.map(r => r.name).join(', ')}!</p></div></div>
                    <div class="foot"><button class="btn small pink${g.shopRandomStarActive ? ' pulse' : ''}" data-act="badstar" ${badCan ? '' : 'disabled'}>${badLabel}</button></div>
                </div>
                <div class="card" style="--a:#ffd23f">
                    <div class="head"><span class="ico">👑</span><div><h3>Goldene Krone</h3>
                    <p>Jedes Level startest du mit 15 Sekunden Schutzschild.</p></div></div>
                    <div class="foot">${g.unlockedCrown ? '<span class="owned">✓ hast du schon</span>' :
                        `<button class="btn small" data-act="crown" ${g.coins >= 500 ? '' : 'disabled'}>🪙 500</button>`}</div>
                </div>
                ${this._extHtml('shopCards')}
                <div class="section-title">Sternen-Markt</div>
                ${starCards}
                <div class="section-title">Wechselstube</div>
                <div class="card wide" style="--a:#4cc9f0"><div class="exchange">${exBtns}</div></div>
            </div></div>`;
        this.show('shop');
        this._exchange = exchange;
    },

    // ── Böse Sterne: ganzer Bildschirm und kein einziger Knopf (Wunsch von Leander) ──
    // Oben steht immer die Seltenheit, darunter der 3D-Stern und je Versuch ein Kreis mit Fragezeichen,
    // der beim Antippen verschwindet. Nach dem letzten Versuch platzt der Stern in einer kleinen blauen
    // Explosion, dann kommt jede Belohnung als eigenes Bild (Münzenberg, Juwelenberg, Upgrade-Bild);
    // Tippen irgendwo führt weiter, nach der letzten Belohnung zurück in den Shop.
    renderStar() {
        const el = this.screens.star;
        const g = Game;
        const tier = clamp(g.shopRandomStarTier || 0, 0, STAR_RARITIES.length - 1);
        const rar = STAR_RARITIES[tier];
        const left = Math.max(0, g.shopRandomStarAttempts || 0);
        let circles = '';
        for (let i = 0; i < STAR_TRIES; i++) {
            const cls = i < left ? 'q' : (i === this._starJustUsed ? 'q pop' : 'q gone');
            circles += `<span class="${cls}">?</span>`;
        }
        this._starJustUsed = -1;
        this._starTier = tier;
        this._starMode = 'star';
        el.style.setProperty('--c', rar.c);
        // Fertiger, aber noch nicht geöffneter Stern (z. B. Spiel dazwischen zu): Antippen lässt ihn platzen
        const act = g.shopRandomStarFinished ? 'staropen' : 'startap';
        el.innerHTML = `
            <div class="rarity${this._starUp ? ' up' : ''}${rar.rainbow ? ' rainbow' : ''}">${rar.name}</div>
            <button class="star-btn" data-act="${act}" aria-label="Stern antippen"><canvas></canvas></button>
            <div class="tries" aria-label="${left} Versuche übrig">${circles}</div>
            <div class="msg">${left ? 'Tipp auf den Stern!' : '&nbsp;'}</div>`;
        this._starUp = false;
        this.show('star');
        this._animateStar(el.querySelector('canvas'));
    },

    // Letzter Versuch verbraucht: kleine blaue Explosion, dann die Belohnungen
    _starFinish(delay) {
        if (this._starBusy) return;
        this._starBusy = true;
        setTimeout(() => {
            this._starBoom = 1;
            this._starBurst(34, ['#3d9bff', '#7fd0ff', '#bfe8ff', '#ffffff'], 1.3);
            Sound.enemyDeath();
            Game.vibrate(120);
            const m = this.screens.star.querySelector('.msg');
            if (m) m.innerHTML = '&nbsp;';
        }, delay || 0);
        setTimeout(() => {
            const res = Game.openBadStar();
            this._starTier = res.tier;
            this._starPages = this._rewardPages(res);
            this._starPage = 0;
            this._starBusy = false;
            this.renderStarReward();
        }, (delay || 0) + 700);
    },

    _rewardPages(res) {
        const pages = [];
        if (res.coins) pages.push({ kind: 'coins', n: res.coins, label: res.coins + ' Münzen', note: res.owned ? res.owned + ' hattest du schon' : '' });
        if (res.jewels) pages.push({ kind: 'jewels', n: res.jewels, label: res.jewels + ' Juwelen' });
        if (res.upgrades.length) {
            pages.push({ kind: 'upgrade', ids: res.upgrades.slice(),
                label: res.upgrades.length > 1 ? 'Alle Werfer-Upgrades!' : UPGRADE_INFO[res.upgrades[0]].name });
        }
        return pages.length ? pages : [{ kind: 'coins', n: 0, label: 'Leider leer' }];
    },

    renderStarReward() {
        const el = this.screens.star;
        const pages = this._starPages || [];
        const p = pages[this._starPage] || pages[0];
        const rar = STAR_RARITIES[this._starTier || 0];
        this._starMode = 'reward';
        this._starPageT = performance.now();
        this._starLockUntil = performance.now() + 550;   // wildes Weitertippen überspringt keine Belohnung
        const dots = pages.length > 1
            ? `<div class="pages">${pages.map((_, i) => `<span class="${i === this._starPage ? 'on' : ''}"></span>`).join('')}</div>` : '';
        el.style.setProperty('--c', rar.c);
        el.innerHTML = `
            <div class="rarity${rar.rainbow ? ' rainbow' : ''}">${rar.name}</div>
            <div class="star-btn"><canvas></canvas></div>
            <div class="reward-label">${p.label}</div>
            ${p.note ? `<div class="msg">${p.note}</div>` : ''}
            ${dots}
            <div class="msg small">Tippen zum Weitermachen</div>
            <button class="tap-all" data-act="starnext" aria-label="Weiter"></button>`;
        this._starBurst(20, p.kind === 'coins' ? ['#ffd23f', '#fff6c2', '#ffb01f'] : (p.kind === 'jewels' ? ['#39d5ff', '#ff5fd2', '#b98cff'] : [rar.c, rar.hi, '#ffffff']));
        if (p.kind === 'coins') Sound.coin(); else if (p.kind === 'jewels') Sound.chest(); else Sound.powerUp();
        this.show('star');
        this._animateStar(el.querySelector('canvas'));
    },

    // Leinwand der Bösen Sterne: 3D-Stern (Modus 'star', mit blauer Explosion) oder Belohnungsbild ('reward').
    // Eigene kleine Leinwand im Menü, nicht im Spiel.
    _animateStar(cv) {
        cancelAnimationFrame(this._starRaf);
        if (!cv) return;
        const sparks = this._starSparks || (this._starSparks = []);
        let last = performance.now();
        const draw = now => {
            now = now || performance.now();
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const rect = cv.getBoundingClientRect();
            // Direkt nach dem Einblenden hat die Leinwand noch keine Größe: im nächsten Bild zeichnen
            if (rect.width < 4) { this._starRaf = requestAnimationFrame(draw); return; }
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const W = Math.max(10, Math.round(rect.width * dpr));
            if (cv.width !== W) { cv.width = W; cv.height = W; }
            const ctx = cv.getContext('2d');
            ctx.setTransform(W / 200, 0, 0, W / 200, 0, 0);
            ctx.clearRect(0, 0, 200, 200);
            const t = now / 1000;
            if (this._starMode === 'reward') this._drawReward(ctx, t, (now - (this._starPageT || now)) / 1000);
            else this._drawStar3D(ctx, t, dt);
            // Funken (Aufsteigen, Explosion, Belohnung)
            for (let i = sparks.length - 1; i >= 0; i--) {
                const f = sparks[i];
                f.life -= dt;
                if (f.life <= 0) { sparks.splice(i, 1); continue; }
                f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt;
                ctx.globalAlpha = Math.min(1, f.life * 2);
                Art.star(ctx, f.x, f.y, f.r, f.c, { lineWidth: 1 });
            }
            ctx.globalAlpha = 1;
            this._starRaf = requestAnimationFrame(draw);
        };
        draw();
    },

    // 3D-Stern: zehn schattierte Facetten, dicke Seitenwand, leichtes Drehen; beim Aufsteigen eine ganze
    // Drehung. Mit _starBoom (1 → 0) platzt er in einer kleinen blauen Explosion.
    _drawStar3D(ctx, t, dt) {
        const P = this._starPts || (this._starPts = Array.from({ length: 10 }, (_, i) => {
            const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.47 : 1;
            return { a, x: Math.cos(a) * r, y: Math.sin(a) * r };
        }));
        {
            const tier = this._starTier || 0;
            const rar = STAR_RARITIES[tier];
            // Bewegung: Wackeln, Stoß beim Antippen, ganze Drehung beim Aufsteigen
            if (this._starShake > 0) this._starShake = Math.max(0, this._starShake - dt * 2.5);
            if (this._starBump > 0) this._starBump = Math.max(0, this._starBump - dt * 3);
            if (this._starSpin > 0) this._starSpin = Math.max(0, this._starSpin - dt * 1.6);
            if (this._starFlash > 0) this._starFlash = Math.max(0, this._starFlash - dt * 2);
            // Kleine blaue Explosion: Stern bläht sich auf und verblasst, ein blauer Ring läuft nach außen
            let bk = 1;
            if (this._starBoom !== undefined && this._starBoom !== null) {
                this._starBoom = Math.max(0, this._starBoom - dt * 1.7);
                bk = this._starBoom;
                const e = 1 - bk;
                ctx.save();
                ctx.translate(100, 100);
                Art.glow(ctx, 0, 0, 55 + e * 65, '#7fd0ff', 0.95 * bk);
                ctx.globalAlpha = bk;
                ctx.strokeStyle = '#5fb8ff';
                ctx.lineWidth = 3 + 9 * bk;
                ctx.beginPath();
                ctx.arc(0, 0, 18 + e * 78, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                if (bk <= 0) return;                         // geplatzt: bis zur Belohnung leer
            }
            const spinExtra = this._starSpin > 0 ? (1 - this._starSpin) * (1 - this._starSpin) * Math.PI * 2 : 0;
            const ang = Math.sin(t * 0.9) * 0.5 + spinExtra;       // Drehung um die senkrechte Achse
            const sx = Math.cos(ang);
            const front = sx >= 0;
            // (|| 0: vor dem ersten Antippen sind die Werte noch leer; NaN würde translate/scale still ignorieren)
            const shake = (this._starShake || 0) * Math.sin(t * 60) * 5;
            const s = (1 + Math.sin(t * 2.6) * 0.025 + (this._starBump || 0) * 0.18) * (1 + (1 - bk) * 0.55);
            const R = 74;
            const cx = 100 + shake, cy = 100 + Math.sin(t * 1.7) * 2.5;
            // Strahlen und Leuchten hinter dem Stern (ab Mythisch mit Strahlen)
            ctx.save();
            ctx.translate(cx, cy);
            ctx.globalAlpha = bk * bk;
            Art.glow(ctx, 0, 0, 112, rar.c, 0.45 + tier * 0.07 + (this._starFlash || 0) * 0.4);
            if (tier >= 3) {
                ctx.save();
                ctx.rotate(t * 0.35);
                ctx.globalAlpha = (0.16 + 0.05 * tier) * bk * bk;
                ctx.fillStyle = rar.hi;
                const n = 12;
                for (let i = 0; i < n; i++) {
                    const a = i * Math.PI * 2 / n;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(a - 0.09) * 90, Math.sin(a - 0.09) * 90);
                    ctx.lineTo(Math.cos(a + 0.09) * 90, Math.sin(a + 0.09) * 90);
                    ctx.closePath();
                    ctx.fill();
                }
                ctx.restore();
            }
            ctx.scale(s, s);
            // Seitenwand (Dicke): versetzte dunkle Kopien, dann die Vorderseite
            const depth = 13;
            const off = Math.sin(ang) * depth;
            const path = (dx, dy) => {
                ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const px = P[i].x * R * sx + dx, py = P[i].y * R + dy;
                    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
                }
                ctx.closePath();
            };
            for (let k = 4; k >= 1; k--) {
                path(-off * k / 4, depth * 0.55 * k / 4);
                ctx.fillStyle = k === 4 ? Art.INK : rar.lo;
                ctx.fill();
            }
            path(-off, depth * 0.55);
            ctx.lineWidth = 3;
            ctx.strokeStyle = Art.INK;
            ctx.stroke();
            // Vorderseite: zehn Facetten, Licht von links oben (dreht mit)
            const light = -2.35 - ang * 0.9;
            for (let i = 0; i < 10; i++) {
                const p = P[i], q = P[(i + 1) % 10];
                const outer = i % 2 === 0 ? p : q;           // Spitze dieses Dreiecks
                const side = i % 2 === 0 ? 1 : -1;           // rechte oder linke Flanke des Zackens
                const dir = outer.a + side * Math.PI / 2;
                let b = 0.5 + 0.5 * Math.cos(dir - light);
                if (!front) b *= 0.55;
                let fill;
                if (rar.rainbow) {
                    const h = (Math.floor(i / 2) * 72 + t * 70) % 360;
                    fill = `hsl(${h | 0},92%,${(38 + b * 40) | 0}%)`;
                } else {
                    // gerundet, weil Art.mix jede Farbe zwischenspeichert (sonst wächst der Speicher je Bild)
                    fill = Art.mix(rar.lo, rar.hi, Math.round((0.12 + b * 0.82) * 32) / 32);
                }
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(p.x * R * sx, p.y * R);
                ctx.lineTo(q.x * R * sx, q.y * R);
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
            }
            // Grate und Umriss
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1.2;
            for (let i = 0; i < 10; i += 2) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(P[i].x * R * sx, P[i].y * R);
                ctx.stroke();
            }
            path(0, 0);
            ctx.lineWidth = 4;
            ctx.strokeStyle = Art.INK;
            ctx.stroke();
            if (front) {
                // Lichtstreif auf der oberen Spitze
                Art.shine(ctx, -7 * sx, -44, 3.5 * Math.max(0.3, sx), 12, -0.35, 0.5);
                // Gesicht: je seltener, desto frecher (dreht mit)
                ctx.save();
                ctx.scale(Math.max(0.2, sx), 1);
                const angry = tier >= 2;
                Art.eyes(ctx, 0, -1, 11, { gap: 17, angry, look: { x: Math.sin(t) * 0.5, y: 0.2 }, seed: 3, iris: tier >= 3 ? '#ff2a2a' : null });
                Art.mouth(ctx, 0, 21, 25, tier >= 3 ? 'teeth' : (tier >= 1 ? 'grin' : 'smile'));
                ctx.restore();
            }
            ctx.restore();
        }
    },

    // Belohnungsbild: Münzenberg, Juwelenberg oder Bild(er) der Upgrades; age = Sekunden seit dem Erscheinen
    _drawReward(ctx, t, age) {
        const pages = this._starPages || [];
        const p = pages[this._starPage] || pages[0];
        if (!p) return;
        const rar = STAR_RARITIES[this._starTier || 0];
        ctx.save();
        ctx.translate(100, 100);
        Art.glow(ctx, 0, 0, 110, p.kind === 'coins' ? '#ffd23f' : (p.kind === 'jewels' ? '#39d5ff' : rar.c), 0.55);
        // drehende Lichtstrahlen
        ctx.save();
        ctx.rotate(t * 0.3);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI / 6;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a - 0.1) * 92, Math.sin(a - 0.1) * 92);
            ctx.lineTo(Math.cos(a + 0.1) * 92, Math.sin(a + 0.1) * 92);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        ctx.restore();
        if (p.kind === 'coins' || p.kind === 'jewels') this._drawPile(ctx, t, age, p.kind, p.n);
        else {
            // Upgrade-Bild(er) springen herein
            const k = Math.min(1, age / 0.45);
            const pop = 1 + Math.sin(k * Math.PI) * 0.25 - (1 - k) * 0.6;
            const ids = p.ids || [];
            const spots = ids.length === 1 ? [[100, 100, 50]]
                : ids.length === 2 ? [[62, 100, 34], [138, 100, 34]]
                : ids.length === 3 ? [[55, 104, 27], [100, 92, 27], [145, 104, 27]]
                : [[66, 70, 26], [134, 70, 26], [66, 134, 26], [134, 134, 26]];
            ids.forEach((id, i) => {
                const [x, y, r] = spots[Math.min(i, spots.length - 1)];
                this._drawUpgradeIcon(ctx, id, x, y + Math.sin(t * 2.4 + i) * 3, r * Math.max(0.05, pop), t);
            });
        }
    },

    // Berg aus Münzen oder Juwelen: mehr Menge, größerer Berg; die Stücke fallen von oben herein
    _drawPile(ctx, t, age, kind, n) {
        const count = Math.max(6, Math.min(36, Math.round(6 + Math.sqrt(n) * (kind === 'coins' ? 0.9 : 2.2))));
        if (!this._pile || this._pile.kind !== kind || this._pile.count !== count) {
            // Plätze einmal festlegen: unten breite Reihen, oben schmal (Dreieck)
            const pts = [];
            // Grundreihe so breit, dass alle Stücke in ein Dreieck passen (kein Turm obendrauf)
            const base = Math.ceil((Math.sqrt(8 * count + 1) - 1) / 2);
            let row = 0;
            while (pts.length < count) {
                const width = Math.max(1, base - row);
                for (let i = 0; i < width && pts.length < count; i++) {
                    const h = Math.sin((pts.length + 1) * 12.9898) * 43758.5453;
                    const jit = h - Math.floor(h);
                    pts.push({ x: 100 + (i - (width - 1) / 2) * 19 + (jit - 0.5) * 6, y: 160 - row * 15 + (jit - 0.5) * 4,
                        spin: 0.35 + jit * 0.65, col: ['#39d5ff', '#ff5fd2', '#6bff8f', '#b98cff', '#ffd23f'][pts.length % 5] });
                }
                row++;
            }
            // von hinten (oben) nach vorne (unten) zeichnen
            this._pile = { kind, count, pts: pts.map((p, i) => ({ ...p, i })).sort((a, b) => a.y - b.y) };
        }
        for (const p of this._pile.pts) {
            const k = Math.min(1, Math.max(0, (age - p.i * 0.025) / 0.3));
            if (k <= 0) continue;
            const y = p.y - (1 - k) * (1 - k) * 110;
            if (kind === 'coins') Art.coin(ctx, p.x, y, 10.5, p.spin);
            else Art.gem(ctx, p.x, y, 10.5, p.col);
        }
        // Glitzern auf dem Berg
        for (let i = 0; i < 4; i++) {
            const a = (t * 1.3 + i * 1.7) % 1;
            const pt = this._pile.pts[(i * 7) % this._pile.pts.length];
            Art.sparkle(ctx, pt.x + 4, pt.y - 6, 5 * Math.sin(a * Math.PI), '#ffffff', 0.9);
        }
    },

    // Bild eines Werfer-Upgrades
    _drawUpgradeIcon(ctx, id, x, y, r, t) {
        ctx.save();
        ctx.translate(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (id === 'unlockedTripleShot') {
            // Schnell-Wurf: Baseball mit Tempo-Streifen
            ctx.strokeStyle = '#ffb01f';
            ctx.lineWidth = r * 0.14;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(-r * 2.0, i * r * 0.45);
                ctx.lineTo(-r * 1.15, i * r * 0.45);
                ctx.stroke();
            }
            Art.body(ctx, 0, 0, r, r, '#ffffff', { glossy: true });
            ctx.strokeStyle = '#e8384f';
            ctx.lineWidth = r * 0.1;
            ctx.beginPath(); ctx.arc(-r * 1.3, 0, r * 0.98, -0.62, 0.62); ctx.stroke();
            ctx.beginPath(); ctx.arc(r * 1.3, 0, r * 0.98, Math.PI - 0.62, Math.PI + 0.62); ctx.stroke();
        } else if (id === 'unlockedShadowCaster') {
            // Schatten-Werfer: Regenbogen-Ball mit bunter Spur
            const cols = ['#ff5f5f', '#ffb01f', '#ffe14d', '#4fd46a', '#3d9bff', '#b45cff'];
            const c0 = Math.floor(t * 6);
            for (let i = 2; i >= 1; i--) {
                ctx.globalAlpha = 0.2 + 0.15 * (2 - i);
                ctx.fillStyle = cols[(c0 + i) % 6];
                ctx.beginPath();
                ctx.arc(-r * 0.55 * i, r * 0.2 * i, r * (1 - i * 0.2), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            Art.body(ctx, 0, 0, r, r, cols[c0 % 6], { glossy: true });
            ctx.lineWidth = r * 0.16;
            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = cols[(c0 + i + 2) % 6];
                ctx.beginPath();
                ctx.arc(0, r * 1.6, r * (1.25 + i * 0.2), -Math.PI * 0.72, -Math.PI * 0.28);
                ctx.stroke();
            }
        } else if (id === 'unlockedGamerPistol') {
            // Gamer-Pistole: blauer Pixel-Blaster
            const u = r / 5;
            Art.glow(ctx, r * 0.9, -u, r * 0.9, '#3d8bff', 0.7);
            const px = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(gx * u, gy * u, gw * u, gh * u); };
            ctx.fillStyle = Art.INK;
            ctx.fillRect(-5.6 * u, -3.1 * u, 11.2 * u, 4.2 * u);
            ctx.fillRect(-3.1 * u, -0.5 * u, 3.6 * u, 5.8 * u);
            px(-5, -2.5, 10, 3, '#3d8bff');
            px(-5, -2.5, 10, 1, '#9fd0ff');
            px(-2.5, 0, 2.4, 4.8, '#2a5fd0');
            px(3, -2, 1.5, 1.5, '#9ff3ff');
            px(5, -2.2, 2.2, 2.4, '#e6fbff');
        } else {
            // Obst-Upgrades: Orange mit Blatt
            Art.body(ctx, 0, 0, r, r * 0.94, '#ff9f1c', { glossy: true });
            ctx.fillStyle = 'rgba(160,70,0,0.35)';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(Math.cos(i * 2.4) * r * 0.5, Math.sin(i * 2.4) * r * 0.45, r * 0.05, 0, Math.PI * 2);
                ctx.fill();
            }
            Art.body(ctx, r * 0.32, -r * 0.98, r * 0.36, r * 0.17, '#4fd46a', { rot: -0.55 });
        }
        ctx.restore();
    },

    // Funkenregen in der Stern-Leinwand (speed: Vielfaches der Grundgeschwindigkeit)
    _starBurst(n, colors, speed = 1) {
        const sparks = this._starSparks || (this._starSparks = []);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 120) * speed;
            sparks.push({ x: 100, y: 100, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, r: 3 + Math.random() * 4,
                c: colors[i % colors.length], life: 0.7 + Math.random() * 0.6 });
        }
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
        const d = (key, label) => `<button class="seg-btn${s.difficulty === key ? ' on' : ''}" data-act="difficulty" data-v="${key}">${label}</button>`;
        return `<div class="seg" role="group" aria-label="Schwierigkeit">
            <span class="seg-label">Schwierigkeit</span>
            ${d('normal', 'Normal')}${d('schwer', 'Schwer')}${d('extrem', '🔥 Extrem')}
        </div>
        <div class="toggles">
            ${t('sound', '🔊 Geräusche')}${t('music', '🎵 Musik')}
            ${t('aimAssist', '🎯 Zielhilfe')}${t('vibration', '📳 Vibration')}
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
            <div class="sub">Schwer: doppelt so viele Gegner, schneller, jeder hält etwa 3 Treffer aus.<br>
                Extrem: fünfmal so viele Gegner, dreimal so schnell, 3 bis 5 Treffer. Gilt ab dem nächsten Weltstart.<br>
                Zielhilfe: Würfe und Schläge gehen leichter auf Gegner.</div>
            <div class="row"><button class="btn" data-act="closesettings">Fertig</button></div>
        </div>`;
        this.show('settings');
    },

    // ── Ergebnis: Welt geschafft / Game Over / Sieg ──
    renderResult(kind) {
        for (const m of this.ext) if (m.onResult && m.onResult(kind)) return;
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
            case 'difficulty': {
                const v = btn.dataset.v;
                if (!DIFFICULTY[v] || g.settings.difficulty === v) break;
                g.settings.difficulty = v;
                g.saveSettings();
                for (const b of btn.parentElement.querySelectorAll('.seg-btn')) b.classList.toggle('on', b.dataset.v === v);
                if (g.state === 'PLAYING' || g.paused) this.flashMessage(DIFFICULTY[v].name + ': gilt ab dem nächsten Weltstart');
                break;
            }
            case 'toggle': {
                const key = btn.dataset.key;
                g.settings[key] = !g.settings[key];
                g.applySettings();
                g.saveSettings();
                btn.classList.toggle('on', g.settings[key]);
                break;
            }
            case 'daily': {
                if (!g._grantDailyReward()) { this.renderShop(); break; }
                Sound.powerUp();
                // Böser Stern: gleich richtig öffnen (antippen, Seltenheit steigt, Belohnung), wenn kein anderer offen ist
                if (g.lastDailyStar && !g.shopRandomStarActive) {
                    this._starSparks = [];
                    this._starBoom = null;
                    this._starBusy = false;
                    if (g.startBadStar()) { this.renderStar(); break; }
                }
                this.flashMessage(g.lastDailyText || 'Belohnung abgeholt!');
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
                this._starSparks = [];
                this._starBoom = null;
                this._starBusy = false;
                if (g.startBadStar()) this.renderStar();
                break;
            case 'startap': {
                if (g.shopRandomStarFinished || this._starBusy) break;
                const up = g._advanceRandomStarStep();
                this._starJustUsed = g.shopRandomStarAttempts;   // dieser Kreis verschwindet gerade
                this._starShake = 1;
                this._starBump = 1;
                if (up) {
                    const rar = STAR_RARITIES[g.shopRandomStarTier];
                    this._starUp = true;
                    this._starSpin = 1;
                    this._starFlash = 1;
                    this._starBurst(22, [rar.c, rar.hi, '#ffffff']);
                    Sound.powerUp();
                    g.vibrate(60);
                } else {
                    Sound.hit();
                }
                this.renderStar();
                // Alle Versuche aufgebraucht: kurz die letzte Seltenheit zeigen, dann platzt der Stern
                if (g.shopRandomStarFinished) this._starFinish(up ? 900 : 450);
                break;
            }
            case 'staropen':
                // Fertiger Stern von vorhin (Spiel war zwischendurch zu)
                this._starFinish(0);
                break;
            case 'starnext':
                if (performance.now() < (this._starLockUntil || 0)) break;
                if (this._starPages && this._starPage < this._starPages.length - 1) {
                    this._starPage++;
                    this.renderStarReward();
                } else {
                    this._starPages = null;
                    this._starMode = 'star';
                    this.renderShop();
                }
                break;
            case 'frosty': g.save(); location.href = 'frosty-burger/'; break;
            default:
                for (const m of this.ext) if (m.onClick && m.onClick(act, btn, e)) break;
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
