// ── Glücksboxen: Shop-Karte, Bildschirm zum Öffnen, Belohnungsseiten (im Stil der Bösen Sterne) ──
// Klassische Script-Datei (kein import/export). Meldet sich über UI.register bei der Oberfläche an.
// Regeln und Zahlen stehen in js/progress.js (BOX_RARITIES, BOX_TRIES, Progress.startBox/boxTap/openBox).

const BOX_PRICE = 30;

const BoxUI = {
    _boxRaf: 0,
    _boxSparks: [],
    _boxTier: 0,
    _boxMode: 'box',            // 'box' = Box zeigen, 'reward' = Belohnungsbild, 'summary' = Übersicht
    _boxSize: 0,                // aktuelle Zeichengröße (wächst weich auf BOX_RARITIES[tier].size)
    _boxShake: 0,
    _boxBump: 0,
    _boxSpin: 0,
    _boxFlash: 0,
    _boxBoom: null,
    _boxBusy: false,
    _boxJustUsed: -1,
    _boxUp: false,
    _boxItems: null,
    _boxPages: null,
    _boxPage: 0,
    _boxPageT: 0,
    _boxLockUntil: 0,

    // ── Shop-Karte (wie die „Böse Sterne“-Karte) ──
    shopCards() {
        const owned = Progress.boxes.length;
        const started = !!Progress.box;
        let openLabel, openCls = 'btn small pink', openCan;
        if (started) { openLabel = 'Weitermachen!'; openCls += ' pulse'; openCan = true; }
        else { openLabel = 'Öffnen (' + owned + ' 🎁)'; openCan = owned > 0; }
        const canBuy = (Game.jewels | 0) >= BOX_PRICE;
        return `<div class="card" style="--a:#ff6ec7">
            <div class="head"><span class="ico">🎁</span><div><h3>Glücksboxen</h3>
            <p>Tippe die Box ${BOX_TRIES}-mal an. Mit Glück wird sie größer: Typisch, Groß, Supergroß, Megagroß, Ultragroß!</p>
            <p>Du hast: ${owned} ${owned === 1 ? 'Box' : 'Boxen'}${started ? ' · eine ist schon offen' : ''}</p></div></div>
            <div class="foot">
                <button class="${openCls}" data-act="boxopen" ${openCan ? '' : 'disabled'}>${openLabel}</button>
                <button class="btn small purple" data-act="boxbuy" ${canBuy ? '' : 'disabled'}>Kaufen · 💎 ${BOX_PRICE}</button>
            </div></div>`;
    },

    // ── Alle Knöpfe und das Antippen der Box ──
    onClick(act, btn, e) {
        if (act === 'boxopen') {
            this._resetRun();
            if (Progress.startBox()) this.renderBox();
            return true;
        }
        if (act === 'boxbuy') {
            // Gekauft wird, um zu öffnen: die neue Box erscheint sofort (Wunsch von Leander, 04.10.2026)
            if (!Progress.box && Game._spendJewels(BOX_PRICE)) {
                Progress.grant({ box: 0 });
                Sound.coin();
                if (this.openNow(0)) return true;
            }
            UI.renderShop();
            return true;
        }
        if (act === 'boxtap') {
            if (this._boxBusy || !Progress.box) return true;
            if (Progress.box.done) { this._boxFinish(0); return true; }
            const up = Progress.boxTap();
            this._boxJustUsed = Progress.box.tries;   // dieser Kreis verschwindet gerade
            this._boxShake = 1;
            this._boxBump = 1;
            if (up) {
                const rar = BOX_RARITIES[Progress.box.tier];
                this._boxUp = true;
                this._boxSpin = 1;
                this._boxFlash = 1;
                this._boxBurst(22, [rar.c, rar.hi, '#ffffff']);
                Sound.powerUp();
                Game.vibrate(60);
            } else {
                Sound.hit();
            }
            this.renderBox();
            // Letzter Versuch: kurz die letzte Größe zeigen, dann platzt die Box
            if (Progress.box.done) this._boxFinish(up ? 900 : 450);
            return true;
        }
        if (act === 'boxnext') {
            if (performance.now() < this._boxLockUntil) return true;
            if (this._boxPages && this._boxPage < this._boxPages.length - 1) {
                this._boxPage++;
                this.renderBoxReward();
            } else {
                this.renderBoxSummary();
            }
            return true;
        }
        if (act === 'boxdone') {
            this._boxItems = null;
            this._boxPages = null;
            const back = this._boxReturn;
            this._boxReturn = null;
            if (typeof back === 'function') back(); else UI.renderShop();
            return true;
        }
        return false;
    },

    // Box sofort öffnen (nach dem Kauf, aus dem Power-Pfad). tier = diese Box nehmen, falls vorhanden;
    // returnTo = Funktion, die nach der Übersicht aufgerufen wird (Vorgabe: Shop).
    openNow(tier, returnTo) {
        this._resetRun();
        if (!Progress.startBox(tier)) return false;
        this._boxReturn = returnTo || null;
        this.renderBox();
        return true;
    },

    _resetRun() {
        this._boxSparks = [];
        this._boxBoom = null;
        this._boxBusy = false;
        this._boxSize = 0;
        this._boxItems = null;
        this._boxPages = null;
        this._boxPage = 0;
    },

    // ── Box-Bildschirm: ganzer Bildschirm, kein Knopf außer der Box selbst ──
    renderBox() {
        const el = UI.screens.box;
        const b = Progress.box;
        if (!b) { UI.renderShop(); return; }
        const tier = clamp(b.tier | 0, 0, BOX_RARITIES.length - 1);
        const rar = BOX_RARITIES[tier];
        const left = b.done ? 0 : Math.max(0, b.tries | 0);
        this._boxTier = tier;
        this._boxMode = 'box';
        if (!(this._boxSize > 0)) this._boxSize = rar.size;
        let circles = '';
        for (let i = 0; i < BOX_TRIES; i++) {
            const cls = i < left ? 'q' : (i === this._boxJustUsed ? 'q pop' : 'q gone');
            circles += `<span class="${cls}">?</span>`;
        }
        this._boxJustUsed = -1;
        el.style.setProperty('--c', rar.c);
        el.innerHTML = `
            <div class="rarity${this._boxUp ? ' up' : ''}${rar.rainbow ? ' rainbow' : ''}">${rar.name}</div>
            <button class="box-btn" data-act="boxtap" aria-label="Box antippen"><canvas></canvas></button>
            <div class="tries" aria-label="${left} Versuche übrig">${circles}</div>
            <div class="msg">${b.done ? '&nbsp;' : 'Tipp auf die Box!'}</div>`;
        this._boxUp = false;
        UI.show('box');
        this._animateBox(el.querySelector('canvas'));
    },

    // Alle Versuche weg (oder Ultragroß erreicht): kurze Pause, kleine Explosion, dann openBox()
    _boxFinish(delay) {
        if (this._boxBusy) return;
        this._boxBusy = true;
        setTimeout(() => {
            this._boxBoom = 1;
            this._boxBurst(36, ['#ff6ec7', '#ffd23f', '#ffffff', '#ff9fd8'], 1.3);   // Konfetti pink, gold, weiß
            Sound.enemyDeath();
            Game.vibrate(120);
            const m = UI.screens.box.querySelector('.msg');
            if (m) m.innerHTML = '&nbsp;';
        }, delay || 0);
        setTimeout(() => {
            this._boxBusy = false;
            if (!Progress.box) { UI.renderShop(); return; }
            const res = Progress.openBox();   // schreibt und schreibt alles gut
            this._boxItems = res.items;
            this._boxPages = res.items.map(it => ({
                kind: it.coins ? 'coins' : (it.jewels ? 'jewels' : (it.pp ? 'pp' : 'stars')),
                n: it.coins || it.jewels || it.pp || it.stars,
                label: Progress.rewardText(it),
            }));
            this._boxPage = 0;
            this.renderBoxReward();
        }, (delay || 0) + 700);
    },

    // ── Belohnungsseite: eine Belohnung als großes Bild, Tippen irgendwo = weiter ──
    renderBoxReward() {
        const el = UI.screens.box;
        const pages = this._boxPages || [];
        const p = pages[this._boxPage] || pages[0];
        const rar = BOX_RARITIES[this._boxTier || 0];
        this._boxMode = 'reward';
        this._boxPageT = performance.now();
        this._boxLockUntil = performance.now() + 550;   // wildes Weitertippen überspringt keine Belohnung
        const left = pages.length - this._boxPage;      // diese und alle noch kommenden Belohnungen
        el.style.setProperty('--c', rar.c);
        el.innerHTML = `
            <div class="rarity${rar.rainbow ? ' rainbow' : ''}">${rar.name}</div>
            <div class="box-btn"><canvas></canvas></div>
            <div class="reward-label">${p.label}</div>
            <div class="msg small">Tippen zum Weitermachen</div>
            <div class="box-badge${this._boxPage === 0 ? ' hop' : ''}"><b>×${left}</b><span>Belohnungen</span></div>
            <button class="box-tap" data-act="boxnext" aria-label="Weiter"></button>`;
        this._boxBurst(18, p.kind === 'coins' ? ['#ffd23f', '#fff6c2', '#ffb01f']
            : (p.kind === 'jewels' ? ['#39d5ff', '#ff5fd2', '#b98cff'] : [rar.c, rar.hi, '#ffffff']));
        if (p.kind === 'coins') Sound.coin(); else if (p.kind === 'jewels') Sound.chest(); else Sound.powerUp();
        UI.show('box');
        this._animateBox(el.querySelector('canvas'));
    },

    // ── Übersichtsseite nach der letzten Belohnung: alle als kleine Kacheln ──
    renderBoxSummary() {
        const el = UI.screens.box;
        const items = this._boxItems || [];
        this._boxMode = 'summary';
        this._animateBox(null);
        const tiles = items.map(it => `<div class="box-tile"><span>${Progress.rewardIcon(it)}</span><b>${it.coins || it.jewels || it.pp || it.stars}</b></div>`).join('');
        el.innerHTML = `
            <div class="rarity box-fertig">Fertig!</div>
            <div class="box-tiles">${tiles}</div>
            <div class="msg small">Tippen für den Shop</div>
            <button class="box-tap" data-act="boxdone" aria-label="Zum Shop"></button>`;
        Sound.powerUp();
        UI.show('box');
    },

    // Funkenregen in der Box-Leinwand (speed: Vielfaches der Grundgeschwindigkeit)
    _boxBurst(n, colors, speed = 1) {
        const sparks = this._boxSparks || (this._boxSparks = []);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 120) * speed;
            sparks.push({ x: 100, y: 100, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, r: 3 + Math.random() * 4,
                c: colors[i % colors.length], life: 0.7 + Math.random() * 0.6 });
        }
    },

    // Leinwand: 3D-Box (Modus 'box') oder Belohnungsbild ('reward'). Eigene kleine Leinwand im Menü.
    // Zeit über performance.now(); die Schleife endet, sobald UI.current !== 'box'.
    _animateBox(cv) {
        cancelAnimationFrame(this._boxRaf);
        if (!cv) return;
        const sparks = this._boxSparks || (this._boxSparks = []);
        let last = performance.now();
        const draw = now => {
            if (UI.current !== 'box') { this._boxRaf = 0; return; }
            now = now || performance.now();
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const rect = cv.getBoundingClientRect();
            // Direkt nach dem Einblenden hat die Leinwand noch keine Größe: im nächsten Bild zeichnen
            if (rect.width < 4) { this._boxRaf = requestAnimationFrame(draw); return; }
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const W = Math.max(10, Math.round(rect.width * dpr));
            if (cv.width !== W) { cv.width = W; cv.height = W; }
            const ctx = cv.getContext('2d');
            ctx.save();
            ctx.scale(W / 200, W / 200);
            ctx.clearRect(0, 0, 200, 200);
            const t = now / 1000;
            if (this._boxMode === 'reward') this._drawBoxReward(ctx, t, (now - this._boxPageT) / 1000);
            else this._drawBox3D(ctx, t, dt);
            // Funken (Aufstieg, Explosion, Belohnung)
            for (let i = sparks.length - 1; i >= 0; i--) {
                const f = sparks[i];
                f.life -= dt;
                if (f.life <= 0) { sparks.splice(i, 1); continue; }
                f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt;
                ctx.globalAlpha = Math.min(1, f.life * 2);
                Art.star(ctx, f.x, f.y, f.r, f.c, { lineWidth: 1 });
            }
            ctx.globalAlpha = 1;
            ctx.restore();
            this._boxRaf = requestAnimationFrame(draw);
        };
        draw();
    },

    // 3D-Box in Schrägansicht: Vorderseite, Seite, Deckel, Schleife, kreuzweises Band.
    // Ruhig leichtes Wippen; Antippen = Wackeln und Stauchen; Aufstieg = Drehung, weißer Blitz, Funken;
    // mit _boxBoom (1 → 0) platzt sie in einer kleinen Konfetti-Explosion.
    _drawBox3D(ctx, t, dt) {
        const rar = BOX_RARITIES[this._boxTier || 0];
        if (this._boxShake > 0) this._boxShake = Math.max(0, this._boxShake - dt * 2.5);
        if (this._boxBump > 0) this._boxBump = Math.max(0, this._boxBump - dt * 3);
        if (this._boxSpin > 0) this._boxSpin = Math.max(0, this._boxSpin - dt * 1.6);
        if (this._boxFlash > 0) this._boxFlash = Math.max(0, this._boxFlash - dt * 2);
        // Größe wächst weich auf die neue Stufe (kein Sprung)
        this._boxSize += (rar.size - this._boxSize) * Math.min(1, dt * 5);
        let bk = 1;
        if (this._boxBoom !== undefined && this._boxBoom !== null) {
            this._boxBoom = Math.max(0, this._boxBoom - dt * 1.7);
            bk = this._boxBoom;
            const e = 1 - bk;
            ctx.save();
            ctx.translate(100, 100);
            Art.glow(ctx, 0, 0, 55 + e * 65, '#ff9fd8', 0.95 * bk);
            ctx.globalAlpha = bk;
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 3 + 9 * bk;
            ctx.beginPath();
            ctx.arc(0, 0, 18 + e * 78, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            if (bk <= 0) return;                         // geplatzt: bis zur Belohnung leer
        }
        const spinExtra = this._boxSpin > 0 ? (1 - this._boxSpin) * (1 - this._boxSpin) * Math.PI * 2 : 0;
        const shake = (this._boxShake || 0) * Math.sin(t * 55) * 5;
        const sq = (this._boxBump || 0) * 0.12;          // Stauchen beim Antippen
        const grow = 1 + (1 - bk) * 0.45;
        ctx.save();
        ctx.translate(100 + shake, 104 + Math.sin(t * 1.7) * 2.5);
        ctx.globalAlpha = bk * bk;
        Art.glow(ctx, 0, 0, 95, rar.c, 0.4 + this._boxFlash * 0.5);
        ctx.rotate(Math.sin(t * 1.1) * 0.03 + spinExtra);
        ctx.scale(grow * (1 + sq), grow * (1 - sq));
        this._paintBox(ctx, t, rar);
        ctx.restore();
        if (this._boxFlash > 0) {
            // weißer Blitz beim Aufstieg
            ctx.save();
            ctx.translate(100, 100);
            Art.glow(ctx, 0, 0, 120, '#ffffff', this._boxFlash * 0.75);
            ctx.restore();
        }
    },

    // Die Box selbst in einem 200er Koordinatensystem um den Nullpunkt (save/restore des Aufrufers)
    _paintBox(ctx, t, rar) {
        // 1,6-fach: die Box soll die Mitte füllen (vorher wirkte sie verloren); um die halbe Tiefe nach links
        // geschoben, damit auch die Ultragroße mit Seitenfläche in die 200er Leinwand passt
        const z = this._boxSize * 1.6;
        const hw = 40 * z, bodyH = 34 * z, lidH = 10 * z, ov = 3 * z;
        const dx = 19 * z, dy = 11 * z;                  // Schräge nach rechts oben (Tiefe)
        ctx.translate(-dx / 2, -6 * z);
        const by = 44 * z;                               // Vorderkante unten
        const ft = by - bodyH;                           // Korpus oben
        const ftl = ft - lidH;                           // Deckel oben (Vorderkante)
        let front = rar.c, side = rar.lo, top = rar.hi, lidFront = rar.c;
        if (rar.rainbow) {
            // Ultragroß: wandernde Regenbogenfarbe in festen 15-Grad-Schritten (Art.mix-ähnlich, ohne Wachstum)
            const h = (Math.floor(t * 8) * 15) % 360;
            front = `hsl(${h},92%,60%)`;
            side = `hsl(${h},85%,38%)`;
            top = `hsl(${(h + 40) % 360},95%,78%)`;
            lidFront = front;
        } else {
            lidFront = Art.mix(rar.c, rar.hi, 0.25);
        }
        const poly = (pts, fill) => {
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); }
            ctx.closePath();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            ctx.lineWidth = 3;
            ctx.strokeStyle = Art.INK;
            ctx.stroke();
        };
        // von hinten nach vorne: Deckelfläche, Deckelseite, Korpusseite, Vorderseiten
        poly([[-hw - ov, ftl], [-hw - ov + dx, ftl - dy], [hw + ov + dx, ftl - dy], [hw + ov, ftl]], top);
        poly([[hw + ov, ftl], [hw + ov + dx, ftl - dy], [hw + ov + dx, ft + 2 - dy], [hw + ov, ft + 2]], side);
        poly([[hw, ft], [hw + dx, ft - dy], [hw + dx, by - dy], [hw, by]], side);
        poly([[-hw, ft], [hw, ft], [hw, by], [-hw, by]], front);
        poly([[-hw - ov, ftl], [hw + ov, ftl], [hw + ov, ft + 2], [-hw - ov, ft + 2]], lidFront);
        // Band kreuzweise: weiß mit festem Umriss (vorn durch, über den Deckel, quer über die Oberseite)
        const rw = 8 * z;
        poly([[-rw / 2, ft], [rw / 2, ft], [rw / 2, by], [-rw / 2, by]], '#ffffff');
        poly([[-rw / 2, ftl], [rw / 2, ftl], [rw / 2, ft + 2], [-rw / 2, ft + 2]], '#ffffff');
        poly([[-rw / 2, ftl], [-rw / 2 + dx, ftl - dy], [rw / 2 + dx, ftl - dy], [rw / 2, ftl]], '#ffffff');
        poly([[-hw - ov + dx * 0.3, ftl - dy * 0.3], [hw + ov + dx * 0.3, ftl - dy * 0.3],
            [hw + ov + dx * 0.7, ftl - dy * 0.7], [-hw - ov + dx * 0.7, ftl - dy * 0.7]], '#ffffff');
        // goldene Kante auf dem vorderen Band
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2 * z;
        ctx.beginPath(); ctx.moveTo(-rw / 2 + 1.6 * z, ft); ctx.lineTo(-rw / 2 + 1.6 * z, by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(rw / 2 - 1.6 * z, ft); ctx.lineTo(rw / 2 - 1.6 * z, by); ctx.stroke();
        // Schleife oben auf der Deckelmitte: zwei weiße Schlaufen, goldener Knoten, zwei kurze Bänder
        const bx = dx * 0.5, byy = ftl - dy * 0.5;
        ctx.save();
        ctx.translate(bx, byy);
        for (const sgn of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(sgn * 9 * z, -4 * z, 9.5 * z, 5.5 * z, sgn * 0.55, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = Art.INK;
            ctx.stroke();
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 3 * z;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sgn * 8 * z, 11 * z);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 4.5 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd23f';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = Art.INK;
        ctx.stroke();
        ctx.restore();
    },

    // Belohnungsbild: Münz-/Juwelenberg (UI._drawPile), gelber Blitz für Powerpunkte,
    // roter Stern mit bösen Augen für Böse Sterne; age = Sekunden seit dem Erscheinen
    _drawBoxReward(ctx, t, age) {
        const pages = this._boxPages || [];
        const p = pages[this._boxPage] || pages[0];
        if (!p) return;
        const rar = BOX_RARITIES[this._boxTier || 0];
        const glowC = p.kind === 'coins' ? '#ffd23f' : (p.kind === 'jewels' ? '#39d5ff' : (p.kind === 'pp' ? '#ffe14d' : '#ff5f5f'));
        ctx.save();
        ctx.translate(100, 100);
        Art.glow(ctx, 0, 0, 110, glowC, 0.55);
        ctx.save();
        ctx.rotate(t * 0.3);
        ctx.globalAlpha = 0.16;
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
        if (p.kind === 'coins' || p.kind === 'jewels') {
            UI._drawPile(ctx, t, age, p.kind, p.n);
        } else if (p.kind === 'pp') {
            // Powerpunkte: großer gelber Blitz, der etwas mitatmet
            const k = Math.min(1, age / 0.4);
            const r = 46 * (1 + Math.sin(k * Math.PI) * 0.2) * (1 + Math.sin(t * 3) * 0.03);
            const pts = [[0.18, -1], [-0.52, 0.12], [-0.06, 0.12], [-0.28, 1], [0.56, -0.22], [0.1, -0.22]];
            ctx.save();
            ctx.translate(100, 94);
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                if (i) ctx.lineTo(pts[i][0] * r, pts[i][1] * r); else ctx.moveTo(pts[i][0] * r, pts[i][1] * r);
            }
            ctx.closePath();
            ctx.fillStyle = '#ffe14d';
            ctx.fill();
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#b87a00';
            ctx.stroke();
            ctx.restore();
            Art.sparkle(ctx, 134, 62, 6 * (0.5 + 0.5 * Math.sin(t * 4)), '#ffffff', 0.9);
            Art.sparkle(ctx, 68, 122, 5 * (0.5 + 0.5 * Math.sin(t * 4 + 2)), '#ffffff', 0.8);
        } else {
            // Böser Stern: roter Stern mit bösen Augen und Zähnen
            const k = Math.min(1, age / 0.4);
            const r = 44 * (1 + Math.sin(k * Math.PI) * 0.22);
            Art.star(ctx, 100, 92, r, '#ff3b3b', { points: 5, inner: 0.48, rot: -Math.PI / 2 + Math.sin(t * 1.4) * 0.08 });
            ctx.save();
            ctx.translate(100, 90);
            Art.eyes(ctx, 0, -2, 9, { gap: 15, angry: true, look: { x: Math.sin(t) * 0.4, y: 0.2 }, seed: 5, iris: '#ffd23f' });
            Art.mouth(ctx, 0, 16, 22, 'teeth');
            ctx.restore();
        }
    },
};

UI.register({
    screens: { box: 'full' },
    onClick(act, btn, e) { return BoxUI.onClick(act, btn, e); },
    shopCards() { return BoxUI.shopCards(); },
});
