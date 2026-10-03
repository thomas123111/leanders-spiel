// ── Quests, Power-Pfad, Upgrades mit Powerpunkten und Tagesleiste (Menüs über dem Canvas) ──
// Regeln und Zahlen stehen in js/progress.js, hier ist nur die Anzeige und das Antippen davon.

const UIProgress = {
    // ── Startseite: drei runde Knöpfe am linken Rand ──
    titleButtons() {
        if (typeof Progress === 'undefined') return '';
        let ups = 0;
        for (const h of POWER_HEROES) if (Progress.canUpgrade(h.id)) ups++;
        const b = (act, icon, label, n) => `<span class="pg-side-item">
            <button class="pg-round" data-act="${act}" aria-label="${label}">${icon}${n ? `<b class="pg-badge">${n > 99 ? '99' : n}</b>` : ''}</button>
            <span class="pg-rlab">${label}</span></span>`;
        return `<div class="pg-side">
            ${b('quests', '📜', 'Quests', Progress.claimableQuests())}
            ${b('path', '🛤️', 'Power-Pfad', Progress.pathClaimable())}
            ${b('power', '⚡', 'Upgrades', ups)}
        </div>`;
    },

    // ── Weltkarte: Tagesleiste unten rechts ──
    _dailyShort(r) {
        if (!r) return '';
        if (r.box !== undefined && r.box !== null) return 'Box';
        if (r.jewels) return r.jewels;
        if (r.stars) return r.stars;
        if (r.pp) return r.pp;
        if (r.coins) return r.coins;
        return '🎁';
    },

    worldsFooter() {
        if (typeof Progress === 'undefined') return '';
        const d = Progress.dailyList();
        const n = d.list.length;
        const got = Math.max(0, Math.min(d.got | 0, n));
        let tiles = '';
        for (let i = 0; i < n; i++) {
            const r = d.list[i];
            const cls = i < got ? ' got' : (i === got ? ' next' : '');
            tiles += `<span class="pg-dtile${cls}${r.jewels ? ' gem' : ''}">
                <i>${Progress.rewardIcon(r)}</i><b>${this._dailyShort(r)}</b>
                ${i < got ? '<s class="pg-dcheck">✓</s>' : ''}
                ${i === got ? '<span class="pg-dhint">nach der nächsten Runde</span>' : ''}
            </span>`;
        }
        return `<div class="pg-daily">
            <div class="pg-dhead">🎁 Tagesbelohnungen ${got}/${n}</div>
            <div class="pg-drow">${tiles}</div>
        </div>`;
    },

    // ── Klicks ──
    onClick(act, btn) {
        if (act === 'quests') { this.renderQuests(); return true; }
        if (act === 'path') { this.renderPath(); return true; }
        if (act === 'power') { this.renderPower(); return true; }
        if (act === 'questclaim') {
            const xp = Progress.claimQuest(btn.dataset.id);
            if (xp) {
                Sound.powerUp();
                UI.flashMessage('+' + xp + ' EP ⭐');
            }
            this.renderQuests();
            return true;
        }
        if (act === 'pathclaim') {
            const r = Progress.claimPath();
            if (r) {
                Sound.powerUp();
                UI.flashMessage('Belohnung: ' + (r.label || Progress.rewardText(r)));
            }
            this.renderPath();
            return true;
        }
        if (act === 'powerup') {
            const id = btn.dataset.id;
            const before = Progress.levels[id] || 0;
            if (Progress.upgrade(id)) {
                Sound.powerUp();
                const h = POWER_HEROES.find(x => x.id === id) || { name: 'Figur' };
                UI.flashMessage(h.name + ' ist jetzt Stufe ' + (before + 1) + '! ⚡');
                this.renderPower(id);
            }
            return true;
        }
        return false;
    },

    // ── Quest-Seite ──
    renderQuests() {
        const el = UI.screens.quests;
        const list = Progress.allQuests().slice().sort((a, b) =>
            (b.done ? 1 : 0) - (a.done ? 1 : 0) || (b.have / b.target) - (a.have / a.target));
        let cards = '';
        for (const s of list) {
            const pct = Math.max(0, Math.min(100, Math.round(s.have / s.target * 100)));
            const bar = `<span class="pg-bar"><i style="width:${pct}%"></i><b>${s.have}/${s.target}</b></span>`;
            const head = `<span class="head"><span class="ico">${s.quest.icon}</span><h3>${s.text}</h3></span>`;
            if (s.done) {
                cards += `<button class="card q-card done" data-act="questclaim" data-id="${s.quest.id}">
                    ${head}${bar}
                    <span class="foot"><span class="pg-rew">+${s.xp} EP</span><span class="pg-take">Antippen: +${s.xp} EP</span></span>
                </button>`;
            } else {
                cards += `<div class="card q-card">
                    ${head}${bar}
                    <span class="foot"><span class="pg-rew">+${s.xp} EP</span></span>
                </div>`;
            }
        }
        el.innerHTML = `
            <div class="page-head">
                <button class="btn small gray" data-act="title">◀ Zurück</button>
                <h2>Quests</h2>
                ${UI._chips()}
            </div>
            <div class="page-body">
                <div class="pg-top">
                    <span class="pg-xp">⭐ ${Progress.xp} EP gesammelt</span>
                    <button class="btn small blue" data-act="path">🛤️ Zum Power-Pfad</button>
                </div>
                <div class="cards">${cards}</div>
            </div>`;
        UI.show('quests');
    },

    // ── Power-Pfad ──
    renderPath() {
        const el = UI.screens.path;
        const wasScroll = el.classList.contains('show') ? (el.querySelector('.pg-scroll') || {}).scrollLeft : null;
        const reached = Progress.pathReached();
        const claimed = Progress.pathClaimed;
        const doneAll = reached >= PATH_STEPS;
        const need = doneAll ? 1 : pathCost(reached + 1);
        const base = Progress.pathTotal(reached);
        const cur = doneAll ? need : Math.max(0, Math.min(need, Progress.xp - base));
        const pct = Math.round(cur / need * 100);

        const STEP = 104, MID = 62, AMP = 20;
        const cx = n => (n - 1) * STEP + STEP / 2;
        const cy = n => MID + Math.sin(n * 0.62) * AMP;
        const rad = n => (n === PATH_STEPS ? 48 : (n % 10 === 0 ? 37 : 27));
        const pts = [];
        for (let n = 1; n <= PATH_STEPS; n++) pts.push([cx(n), cy(n)]);
        const lineTo = k => {
            if (k < 2) return '';
            let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
            for (let i = 1; i < k; i++) {
                const x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1];
                const m = (x0 + x1) / 2;
                d += ` C ${m.toFixed(1)} ${y0.toFixed(1)} ${m.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
            }
            return d;
        };
        const width = PATH_STEPS * STEP;
        let nodes = '';
        for (let n = 1; n <= PATH_STEPS; n++) {
            const r = pathReward(n);
            const got = n <= claimed;
            const can = !got && n <= reached;
            const cls = (got ? ' got' : (can ? ' can' : ' locked')) + (n === PATH_STEPS ? ' b100' : (n % 10 === 0 ? ' b10' : ''));
            const act = can ? ' data-act="pathclaim"' : ' disabled';
            nodes += `<button class="pg-node${cls}" data-step="${n}" style="left:${(n - 1) * STEP}px; top:${(cy(n) - rad(n)).toFixed(1)}px"${act}
                aria-label="Station ${n}: ${r.label}">
                ${n === PATH_STEPS ? '<span class="pg-crown">👑</span>' : ''}
                <span class="pg-circ"><b class="pg-num">${n}</b><i class="pg-ic">${Progress.rewardIcon(r)}</i>
                    ${got ? '<s class="pg-st ok">✓</s>' : (can ? '' : '<s class="pg-st">🔒</s>')}</span>
                <span class="pg-txt">${r.label}</span>
                <span class="pg-ep">${Progress.pathTotal(n)} EP</span>
            </button>`;
        }
        el.innerHTML = `
            <div class="page-head">
                <button class="btn small gray" data-act="title">◀ Zurück</button>
                <h2>Power-Pfad</h2>
                ${UI._chips()}
            </div>
            <div class="pg-level">
                <span class="pg-level-txt">${doneAll ? `Stufe ${PATH_STEPS} · alles geschafft` : `Stufe ${reached} · ${cur}/${need} EP`}</span>
                <span class="pg-bar big"><i style="width:${doneAll ? 100 : pct}%"></i></span>
            </div>
            <div class="page-body">
                <div class="pg-scroll">
                    <div class="pg-track" style="width:${width}px">
                        <svg class="pg-lines" width="${width}" height="130" viewBox="0 0 ${width} 130" aria-hidden="true">
                            <path class="pg-line" d="${lineTo(PATH_STEPS)}"></path>
                            <path class="pg-line on" d="${lineTo(Math.max(1, reached))}"></path>
                        </svg>
                        ${nodes}
                    </div>
                </div>
            </div>`;
        UI.show('path');
        const go = Math.min(PATH_STEPS, claimed + 1);
        requestAnimationFrame(() => {
            const scroll = el.querySelector('.pg-scroll');
            if (!scroll) return;
            if (wasScroll !== null && wasScroll > 0) { scroll.scrollLeft = wasScroll; return; }
            const target = el.querySelector(`.pg-node[data-step="${go}"]`);
            if (target) scroll.scrollLeft = Math.max(0, target.offsetLeft - scroll.clientWidth / 2 + target.offsetWidth / 2);
        });
    },

    // ── Upgrade-Seite ──
    _heroEffect(h, lv) {
        if (h.hpPerLevel) {
            return `+${lv * h.hpPerLevel} Leben, +${Math.round(lv * h.dmgPerLevel * 100)} % Schaden`;
        }
        return `+${Math.round(lv * h.hpMulPerLevel * 100)} % Leben, +${Math.round(lv * h.dmgPerLevel * 100)} % Schaden`;
    },

    renderPower(flashId) {
        const el = UI.screens.power;
        let cards = '';
        for (const h of POWER_HEROES) {
            const lv = Progress.levels[h.id] || 0;
            const open = Progress.heroUnlocked(h.id);
            const cost = Progress.nextCost(h.id);
            const max = cost === null;
            const can = Progress.canUpgrade(h.id);
            let box = '';
            for (let i = 1; i <= POWER_MAX; i++) box += `<i class="${i <= lv ? 'on' : ''}"></i>`;
            const effect = lv ? this._heroEffect(h, lv) : (max ? 'keine Wirkung' : 'Ab der nächsten Stufe: ' + this._heroEffect(h, 1));
            const foot = !open
                ? `<span class="pg-lock">🔒 Kommt ab Welt ${h.from + 1}</span>`
                : (max
                    ? '<button class="btn small gold" disabled>MAX</button>'
                    : `<button class="btn small ${can ? 'green pulse' : 'gray'}" data-act="powerup" data-id="${h.id}" ${can ? '' : 'disabled'}>Upgrade · ⚡ ${cost}</button>`);
            cards += `<div class="card pg-hero${open ? '' : ' locked'}" data-id="${h.id}" style="--a:${h.id === 'mark' ? '#ffd23f' : (h.id === 'juri' ? '#3fa7ff' : '#3ddc97')}">
                <canvas class="pg-cv"></canvas>
                <span class="head"><span class="ico">${h.emoji}</span><h3>${h.name}</h3></span>
                <span class="pg-lab">Stufe ${lv}/${POWER_MAX}</span>
                <span class="pg-lvls">${box}</span>
                <p>${effect}</p>
                <span class="foot">${foot}</span>
            </div>`;
        }
        el.innerHTML = `
            <div class="page-head">
                <button class="btn small gray" data-act="title">◀ Zurück</button>
                <h2>Upgrades</h2>
                ${UI._chips()}
            </div>
            <div class="page-body">
                <div class="pg-heroes">${cards}</div>
                <p class="pg-note">Powerpunkte bekommst du aus der Tagesleiste, Glücksboxen und dem Power-Pfad.</p>
            </div>`;
        UI.show('power');
        const cvs = el.querySelectorAll('.pg-cv');
        requestAnimationFrame(() => {
            cvs.forEach((cv, i) => this._drawHero(cv, POWER_HEROES[i] ? POWER_HEROES[i].id : null));
            if (flashId) {
                const card = el.querySelector(`.pg-hero[data-id="${flashId}"]`);
                if (card) {
                    card.classList.add('flash');
                    setTimeout(() => card.classList.remove('flash'), 750);
                }
            }
        });
    },

    // Kleine ruhige Figur, scharf über devicePixelRatio, einmal gezeichnet (wie das Karussell der Startseite)
    _drawHero(cv, id) {
        if (!cv || !id) return;
        const w = cv.clientWidth || 110;
        const h = cv.clientHeight || 100;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.max(1, Math.round(w * dpr));
        cv.height = Math.max(1, Math.round(h * dpr));
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, cv.width, cv.height);
        let o = null;
        try {
            if (id === 'mark') o = new Player(0, 0);
            else if (id === 'juri') o = new Juri(0, 0);
            else if (id === 'croc' && typeof ShadowCrocodile !== 'undefined') o = new ShadowCrocodile(0, 0);
        } catch (e) { return; }
        if (!o || !o.w || !o.h) return;
        const cam = { x: 0, y: 0, width: 100, height: 100, shakeX: 0, shakeY: 0, worldToScreen(x, y) { return { x, y }; } };
        const k = Math.min(w / (o.w + 18), h / (o.h + 18));
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(w / 2, h / 2);
        ctx.scale(k, k);
        o.x = -o.w / 2;
        o.y = -o.h / 2;
        if (id === 'mark') {
            o.facingAngle = Math.PI * 0.12;
            o.aimAngle = o.facingAngle;
        } else {
            o.faceX = 1;
            o.moving = false;
            o.target = null;
        }
        try { o.draw(ctx, cam); } catch (e) { /* Figur kam nicht klar: Platz bleibt leer */ }
        ctx.restore();
    },
};

UI.register({
    screens: { quests: 'page', path: 'page', power: 'page' },
    onClick: (act, btn, e) => UIProgress.onClick(act, btn, e),
    titleButtons: () => UIProgress.titleButtons(),
    worldsFooter: () => UIProgress.worldsFooter(),
});
