// ── Glücksboxen: Shop-Karte, Bildschirm zum Öffnen, Belohnungsseiten (im Stil der Bösen Sterne) ──
// Klassische Script-Datei (kein import/export). Meldet sich über UI.register bei der Oberfläche an.
// Regeln und Zahlen stehen in js/progress.js (BOX_RARITIES, BOX_TRIES, Progress.startBox/boxTap/openBox).

const BOX_PRICE = 30;

// Festgenagelte Werte fuer die Holztruhe: Maserung und Muenzwurf flackern nicht (kein Zufall pro Bild).
// Maserung je Brett: [x0, y0, x1, y1] in Anteilen von Breite und Hoehe der Vorderseite.
const BOX_GRAIN = [
    [0.06, 0.10, 0.22, 0.14], [0.42, 0.22, 0.56, 0.26], [0.76, 0.08, 0.90, 0.12],
    [0.08, 0.42, 0.22, 0.46], [0.44, 0.55, 0.55, 0.58], [0.78, 0.40, 0.92, 0.44],
    [0.07, 0.74, 0.20, 0.78], [0.80, 0.72, 0.93, 0.76],
];
// Goldmuenzen-Funken beim Aufspringen: [x in z-Einheiten, Verzoegerung 0..1]
const BOX_COIN = [[-26, 0.05], [-15, 0.35], [-5, 0.0], [6, 0.45], [16, 0.2], [25, 0.6], [-21, 0.75], [12, 0.85]];


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
        else { openLabel = 'Öffnen (' + owned + ' 🧰)'; openCan = owned > 0; }
        const canBuy = (Game.jewels | 0) >= BOX_PRICE;
        return `<div class="card" style="--a:#ff6ec7">
            <div class="head"><span class="ico">🧰</span><div><h3>Glücksboxen</h3>
            <p>Tippe die Truhe ${BOX_TRIES}-mal an. Mit Glück wird sie größer: Typisch, Groß, Supergroß, Megagroß, Ultragroß!</p>
            <p>Du hast: ${owned} ${owned === 1 ? 'Truhe' : 'Truhen'}${started ? ' · eine ist schon offen' : ''}</p></div></div>
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
            <button class="box-btn" data-act="boxtap" aria-label="Truhe antippen"><canvas></canvas></button>
            <div class="tries" aria-label="${left} Versuche übrig">${circles}</div>
            <div class="msg">${b.done ? '&nbsp;' : 'Tipp auf die Truhe!'}</div>`;
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
            this._boxBurst(36, ['#ffd23f', '#fff3b0', '#ffffff', '#ffb01f'], 1.3);   // Goldmünzen-Funken
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

    // Truhe in Schrägansicht: Korpus und gewölbter Deckel, Metallbeschläge in Stufenfarbe, Schloss vorn.
    // Ruhig leichtes Wippen; Antippen = Wackeln, Stauchen und hellere Lichtritze; Aufstieg = Drehung,
    // weißer Blitz, Funken. Mit _boxBoom (1 -> 0) springt der Deckel nach hinten oben auf: Lichtstrahlen
    // und Goldmünzen-Funken steigen aus der Truhe, die Truhe selbst bleibt stehen (erst bk <= 0 = nichts).
    _drawBox3D(ctx, t, dt) {
        const rar = BOX_RARITIES[this._boxTier || 0];
        if (this._boxShake > 0) this._boxShake = Math.max(0, this._boxShake - dt * 2.5);
        if (this._boxBump > 0) this._boxBump = Math.max(0, this._boxBump - dt * 3);
        if (this._boxSpin > 0) this._boxSpin = Math.max(0, this._boxSpin - dt * 1.6);
        if (this._boxFlash > 0) this._boxFlash = Math.max(0, this._boxFlash - dt * 2);
        // Größe wächst weich auf die neue Stufe (kein Sprung)
        this._boxSize += (rar.size - this._boxSize) * Math.min(1, dt * 5);
        let bk = 1, open = 0;
        if (this._boxBoom !== undefined && this._boxBoom !== null) {
            this._boxBoom = Math.max(0, this._boxBoom - dt * 1.7);
            bk = this._boxBoom;
            const e = 1 - bk;
            open = Math.min(1, e * 2.6);                      // Deckel ist im ersten Drittel offen
            open = 1 - (1 - open) * (1 - open);               // ... und das mit Schwung
            ctx.save();
            ctx.translate(100, 100);
            Art.glow(ctx, 0, 0, 55 + e * 65, rar.hi, 0.95 * bk);
            ctx.globalAlpha = bk;
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 3 + 9 * bk;
            ctx.beginPath();
            ctx.arc(0, 0, 18 + e * 78, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            if (bk <= 0) return;                         // ausgetrunken: bis zur Belohnung nichts mehr malen
        }
        const spinExtra = this._boxSpin > 0 ? (1 - this._boxSpin) * (1 - this._boxSpin) * Math.PI * 2 : 0;
        const shake = (this._boxShake || 0) * Math.sin(t * 55) * 5;
        const sq = (this._boxBump || 0) * 0.12;          // Stauchen beim Antippen
        // wächst beim Aufspringen, bleibt aber in der Leinwand (Ultragroß füllt sie ohnehin fast)
        const grow = Math.min(1 + (1 - bk) * 0.45, Math.max(0.9, 90 / (84 * this._boxSize)));
        ctx.save();
        ctx.translate(100 + shake, 104 + Math.sin(t * 1.7) * 2.5);
        ctx.globalAlpha = Math.min(1, 0.55 + 0.45 * bk); // die Truhe bleibt stehen, nur das Leuchten ebbt ab
        Art.glow(ctx, 0, 0, 95, rar.c, 0.4 + this._boxFlash * 0.5);
        ctx.rotate(Math.sin(t * 1.1) * 0.03 + spinExtra);
        ctx.scale(grow * (1 + sq), grow * (1 - sq));
        this._paintBox(ctx, t, rar, open, bk);
        ctx.restore();
        if (this._boxFlash > 0) {
            // weißer Blitz beim Aufstieg
            ctx.save();
            ctx.translate(100, 100);
            Art.glow(ctx, 0, 0, 120, '#ffffff', this._boxFlash * 0.75);
            ctx.restore();
        }
    },

    // Die Truhe in einem 200er Koordinatensystem um den Nullpunkt (save/restore des Aufrufers).
    // open = 0 (Deckel zu) bis 1 (Deckel nach hinten oben weg, Lichtstrahlen und Münzen steigen auf);
    // bk = 1 im Normalbetrieb und läuft bei der Explosion von 1 auf 0. Alle Zufallswerte stehen fest.
    _paintBox(ctx, t, rar, open = 0, bk = 1) {
        const ga0 = ctx.globalAlpha;
        const z = this._boxSize * 1.6;
        const hw = 40 * z, bodyH = 34 * z, ov = 3 * z;
        const dx = 19 * z, dy = 11 * z;                  // Schräge nach rechts oben (Tiefe)
        const by = 44 * z, ft = by - bodyH;              // Vorderkante unten, Korpus oben
        const lidBot = ft + 1.5 * z;                     // Vorderkante Deckel (überlappt den Korpus)
        const arch = 17 * z;                             // Höhe der gewölbten Deckelfront
        const a = hw + ov;                               // halbe Breite des Deckels
        const C = arch * 1.05;                           // Bézier-Höhe für den Bogen
        const lw = Math.max(1.2, 1.6 * z);
        ctx.translate(-dx / 2, -6 * z);

        // ── Farben: Holz immer gleich, Beschläge in der Stufenfarbe ──
        const WOOD_F = '#a8642a', WOOD_S = '#7a4418', WOOD_E = '#c98a4a', SEAM = '#5a3010';
        let met = rar.c, metLo = rar.lo, metHi = rar.hi, slit = rar.hi, sheen = null;
        if (rar.rainbow) {
            // Ultragroß: wandernder Regenbogen in festen 15-Grad-Schritten
            const h = (Math.floor(t * 8) * 15) % 360;
            met = `hsl(${h},92%,62%)`;
            metLo = `hsl(${h},85%,38%)`;
            metHi = `hsl(${(h + 40) % 360},95%,80%)`;
            slit = '#ffffff';
            sheen = 'rgba(255,214,80,0.17)';             // leichter goldener Schimmer über dem Holz
        }
        const poly = (pts, fill, ink = true) => {
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) { if (i) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]); }
            ctx.closePath();
            if (fill) { ctx.fillStyle = fill; ctx.fill(); }
            if (ink) { ctx.lineWidth = 3; ctx.strokeStyle = Art.INK; ctx.stroke(); }
        };
        // Bogen der Deckelfront (nur der Pfad, ohne fill/stroke)
        const archPath = (ox, oy, w = a, ch = C) => {
            ctx.moveTo(-w + ox, lidBot + oy);
            ctx.bezierCurveTo(-w + ox, lidBot - ch + oy, w + ox, lidBot - ch + oy, w + ox, lidBot + oy);
        };
        // Höhe des Bogens an einer Stelle x (für die Metallbänder)
        // genau der Bezier-Bogen aus archPath (sonst ragten die Bänder oben über den Deckel):
        // x(t) = a·(−1 + 2·(3t² − 2t³)), y(t) = lidBot − C·3t(1−t); t per Halbierung aus x bestimmen
        const archY = x => {
            let lo = 0, hi = 1;
            for (let i = 0; i < 18; i++) {
                const t = (lo + hi) / 2;
                if (a * (-1 + 2 * (3 * t * t - 2 * t * t * t)) < x) lo = t; else hi = t;
            }
            const t = (lo + hi) / 2;
            return lidBot - C * 3 * t * (1 - t);
        };
        const rivet = (x, y) => {
            ctx.beginPath(); ctx.arc(x, y, 1.8 * z, 0, Math.PI * 2);
            ctx.fillStyle = metHi; ctx.fill();
            ctx.lineWidth = Math.max(0.9, 1.1 * z); ctx.strokeStyle = Art.INK; ctx.stroke();
        };

        // ── Deckel ──
        const lid = () => {
            // Wölbung nach hinten oben: vorderer Bogen, hintere Kante, zurückversetzter Bogen
            ctx.beginPath();
            archPath(0, 0);
            ctx.lineTo(a + dx, lidBot - dy);
            ctx.bezierCurveTo(a + dx, lidBot - C - dy, -a + dx, lidBot - C - dy, -a + dx, lidBot - dy);
            ctx.closePath();
            ctx.fillStyle = WOOD_E; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = Art.INK; ctx.stroke();
            if (sheen) { ctx.fillStyle = sheen; ctx.fill(); }
            // Bretter auf der Wölbung: Fugen in Richtung nach hinten
            ctx.strokeStyle = SEAM; ctx.lineWidth = lw;
            for (const f of [-0.62, -0.21, 0.21, 0.62]) {
                const x0 = a * f, y0 = archY(x0);
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx, y0 - dy); ctx.stroke();
            }
            // Vorderseite: Bogen über dem Korpus
            ctx.beginPath(); archPath(0, 0); ctx.closePath();
            ctx.fillStyle = WOOD_F; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = Art.INK; ctx.stroke();
            if (sheen) { ctx.fillStyle = sheen; ctx.fill(); }
            // helle Kante dem Bogen entlang
            const aH = a - 3.6 * z;
            ctx.beginPath(); archPath(0, 0, aH, C - 3.6 * z);
            ctx.strokeStyle = WOOD_E; ctx.lineWidth = lw * 1.5; ctx.stroke();
            // Bretter auf der Deckelfront
            ctx.strokeStyle = SEAM; ctx.lineWidth = lw;
            for (const f of [-0.62, -0.21, 0.21, 0.62]) {
                const x0 = a * f;
                ctx.beginPath(); ctx.moveTo(x0, archY(x0)); ctx.lineTo(x0, lidBot); ctx.stroke();
            }
            // Metallbänder über dem Deckel: vorn auf der Front, dann über die Wölbung nach hinten
            for (const s of [-1, 1]) {
                const cx = s * 16 * z;
                poly([[cx - bw2, archY(cx - bw2)], [cx - bw2 * 0.5, archY(cx - bw2 * 0.5)], [cx, archY(cx)],
                    [cx + bw2 * 0.5, archY(cx + bw2 * 0.5)], [cx + bw2, archY(cx + bw2)],
                    [cx + bw2 + dx, archY(cx + bw2) - dy], [cx - bw2 + dx, archY(cx - bw2) - dy]], metLo);
                const pts = [[cx - bw2, lidBot]];
                for (const o of [-bw2, -bw2 * 0.5, 0, bw2 * 0.5, bw2]) pts.push([cx + o, archY(cx + o)]);
                pts.push([cx + bw2, lidBot]);
                poly(pts, met);
                rivet(cx, lidBot - 4 * z);
                rivet(cx, archY(cx) + 3.4 * z);
            }
        };

        // ── Korpus aus Holz: drei Bretter mit dunklen Fugen und Maserung ──
        poly([[hw, ft], [hw + dx, ft - dy], [hw + dx, by - dy], [hw, by]], WOOD_S);   // rechte Seitenfläche
        ctx.strokeStyle = SEAM; ctx.lineWidth = lw;
        for (const s of [1 / 3, 2 / 3]) {
            ctx.beginPath(); ctx.moveTo(hw, ft + bodyH * s); ctx.lineTo(hw + dx, ft + bodyH * s - dy); ctx.stroke();
        }
        for (const q of [[0.24, 0.16, 0.78, 0.1], [0.3, 0.66, 0.72, 0.6]]) {          // Maserung Seite
            ctx.beginPath();
            ctx.moveTo(hw + dx * q[0], ft + bodyH * q[1] - dy * q[0]);
            ctx.lineTo(hw + dx * q[2], ft + bodyH * q[3] - dy * q[2]);
            ctx.stroke();
        }
        poly([[-hw, ft], [hw, ft], [hw, by], [-hw, by]], WOOD_F);                      // Vorderseite
        if (sheen) poly([[-hw, ft], [hw, ft], [hw, by], [-hw, by]], sheen, false);
        for (const s of [0, 1 / 3, 2 / 3]) {                                           // helle Kant' je Brett
            ctx.beginPath();
            ctx.moveTo(-hw + 2 * z, ft + bodyH * s + lw);
            ctx.lineTo(hw - 2 * z, ft + bodyH * s + lw);
            ctx.strokeStyle = WOOD_E; ctx.lineWidth = lw * 1.4; ctx.stroke();
        }
        ctx.strokeStyle = SEAM; ctx.lineWidth = lw;
        for (const s of [1 / 3, 2 / 3]) {
            ctx.beginPath(); ctx.moveTo(-hw, ft + bodyH * s); ctx.lineTo(hw, ft + bodyH * s); ctx.stroke();
        }
        for (const q of BOX_GRAIN) {                                                    // Maserung vorn
            ctx.beginPath();
            ctx.moveTo(-hw + 2 * hw * q[0], ft + bodyH * q[1]);
            ctx.lineTo(-hw + 2 * hw * q[2], ft + bodyH * q[3]);
            ctx.stroke();
        }
        // offenes Inneres: dunkle Öffnung, sobald der Deckel wegspringt
        if (open > 0) {
            ctx.globalAlpha = ga0 * Math.min(1, open * 1.6);
            poly([[-hw, ft], [-hw + dx, ft - dy], [hw + dx, ft - dy], [hw, ft]], '#3a1f0c');
            ctx.globalAlpha = ga0;
        }
        // Lichtritze: schmaler Streifen unter der Deckelkante, beim Antippen etwas heller
        if (open < 0.98) {
            const bump = this._boxBump || 0;
            ctx.globalAlpha = ga0 * (0.7 + 0.3 * bump) * (1 - open);
            ctx.fillStyle = slit;
            ctx.fillRect(-hw + 1.5 * z, lidBot + 0.6 * z, 2 * hw - 3 * z, 2.6 * z);
            if (bump > 0.05) Art.glow(ctx, 0, lidBot + 2 * z, 34 * z, slit, 0.5 * bump * (1 - open));
            ctx.globalAlpha = ga0;
        }

        // ── Deckel: zu auf der Truhe, oder nach hinten oben weggedreht ──
        const bw2 = 3.6 * z;
        if (open > 0) {
            // Der Deckel dreht um die hintere obere Kante nach hinten oben weg (gedacht rund 100 Grad).
            // In der Schrägansicht ist das keine Drehung im Bild, sondern: Höhe schrumpft auf den
            // Verkürzungsanteil, die Lehne nach hinten (Scherung) und ein kleines Heben der Scharnierkante.
            const hy = ft - dy;                             // Scharnierlinie: hinten oben am Korpus
            ctx.save();
            ctx.translate(0, hy - 5 * z * open);
            ctx.scale(1, Math.max(0.2, 1 - 0.78 * open));
            ctx.transform(1, 0, -0.12 * open, 1, 0, 0);
            ctx.translate(0, -hy);
            lid();
            ctx.restore();
        } else {
            lid();
        }

        // ── Beschläge am Korpus: zwei senkrechte Bänder, Eckbeschläge unten, Nieten ──
        for (const s of [-1, 1]) {
            const cx = s * 16 * z;
            poly([[cx - bw2, ft], [cx + bw2, ft], [cx + bw2, by], [cx - bw2, by]], met);
            ctx.fillStyle = metHi;
            ctx.fillRect(cx - bw2 + 1.2 * z, ft + 1 * z, 1.7 * z, bodyH - 2 * z);
            for (const yy of [ft + 6 * z, ft + bodyH * 0.52, by - 6.5 * z]) rivet(cx, yy);
            const ix = s * (hw - 0.6 * z);                  // Eckbeschlag unten
            const sgn = -s;
            poly([[ix, by - 13 * z], [ix + sgn * 11 * z, by - 13 * z], [ix + sgn * 11 * z, by - 4.6 * z],
                [ix + sgn * 19 * z, by - 4.6 * z], [ix + sgn * 19 * z, by], [ix, by]], met);
            rivet(ix + sgn * 5.4 * z, by - 8.8 * z);
        }

        // ── Schloss: goldener Schild mit dunklem Schlüsselloch, darüber der Edelstein ──
        if ((this._boxTier || 0) >= 2) {
            const gy = ft + 8.8 * z, gr = 4.0 * z;         // direkt über dem Schloss, unter der Lichtritze
            ctx.beginPath();
            ctx.moveTo(0, gy - gr);
            ctx.lineTo(gr * 0.86, gy - gr * 0.18);
            ctx.lineTo(0, gy + gr);
            ctx.lineTo(-gr * 0.86, gy - gr * 0.18);
            ctx.closePath();
            ctx.fillStyle = rar.rainbow ? met : rar.c; ctx.fill();
            ctx.lineWidth = 3; ctx.strokeStyle = Art.INK; ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, gy - gr); ctx.lineTo(-gr * 0.86, gy - gr * 0.18); ctx.lineTo(0, gy + gr * 0.1);
            ctx.closePath();
            ctx.fillStyle = rar.hi; ctx.fill();
            Art.star(ctx, gr * 1.5, gy - gr * 1.1, (1.8 + Math.sin(t * 3.4) * 0.7) * z, '#ffffff', { lineWidth: 1 });
        }
        const lw2 = 11.5 * z, lt = ft + 13.5 * z, lbm = ft + 28.5 * z;
        ctx.beginPath();
        ctx.moveTo(-lw2, lt);
        ctx.lineTo(lw2, lt);
        ctx.lineTo(lw2, lbm - 6 * z);
        ctx.quadraticCurveTo(lw2, lbm, 0, lbm + 3.5 * z);
        ctx.quadraticCurveTo(-lw2, lbm, -lw2, lbm - 6 * z);
        ctx.closePath();
        ctx.fillStyle = '#ffd23f'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = Art.INK; ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, lt + 7.5 * z, 3.2 * z, 0, Math.PI * 2);
        ctx.moveTo(-2.1 * z, lt + 9.4 * z);
        ctx.lineTo(2.1 * z, lt + 9.4 * z);
        ctx.lineTo(3.1 * z, lt + 15 * z);
        ctx.lineTo(-3.1 * z, lt + 15 * z);
        ctx.closePath();
        ctx.fillStyle = '#4a2a08'; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-lw2 + 3 * z, lt + 3.2 * z);
        ctx.quadraticCurveTo(0, lt + 1.2 * z, lw2 - 3 * z, lt + 3.2 * z);
        ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = lw; ctx.stroke();

        // ── Beim Aufspringen: Lichtstrahlen und Goldmünzen-Funken aus der Öffnung ──
        if (open > 0) {
            const mouth = ft - dy * 0.35;
            Art.glow(ctx, 0, mouth, 42 * z, rar.hi, 0.6 * open * Math.max(0.25, bk));
            ctx.globalAlpha = ga0 * 0.42 * open;
            for (let i = 0; i < 7; i++) {
                const ang = -Math.PI / 2 + (i - 3) * 0.26 + Math.sin(t * 1.3 + i) * 0.02;
                const len = (30 + ((i * 7) % 3) * 9) * z * (0.55 + 0.45 * open);
                const w = 0.055;
                ctx.beginPath();
                ctx.moveTo(0, mouth);
                ctx.lineTo(Math.cos(ang - w) * len, mouth + Math.sin(ang - w) * len);
                ctx.lineTo(Math.cos(ang + w) * len, mouth + Math.sin(ang + w) * len);
                ctx.closePath();
                ctx.fillStyle = (i % 2) ? rar.hi : '#ffd23f';
                ctx.fill();
            }
            ctx.globalAlpha = ga0;
            for (let i = 0; i < BOX_COIN.length; i++) {
                const k = Math.min(1, Math.max(0, open * 1.7 - BOX_COIN[i][1]));
                if (k <= 0) continue;
                const x = (BOX_COIN[i][0] + Math.sin(t * 2.6 + i * 1.7) * 2.5) * z;
                const y = mouth - k * (30 + ((i * 5) % 4) * 8) * z;
                const r = (2.9 - k * 0.8) * z;
                ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#ffd23f'; ctx.fill();
                ctx.lineWidth = Math.max(0.9, 1.2 * z); ctx.strokeStyle = '#b87a00'; ctx.stroke();
                ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = '#fff3b0'; ctx.fill();
            }
        }
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
