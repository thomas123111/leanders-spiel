// ── Glücksrad: Shop-Karte, Rad mit 15 Feldern, Dreh-Animation, Belohnung als Berg ──
// Klassische Script-Datei (kein import/export). Meldet sich über UI.register bei der Oberfläche an.
// Regeln und Zahlen stehen in js/progress.js (RAD_FIELDS, RAD_SPIN_COST, Progress.radSpin/radFree).
// Wunsch von Leander (18./19.10.2026): oben sitzt ein Pfeil, das Rad dreht schnell an und läuft langsam aus;
// das Feld, auf das der Pfeil zeigt, ist die Belohnung. Es kommt genau EINE Belohnung – als Berg über
// BoxUI.showRewards und OHNE Zähler. Glücksbox und Böser Stern öffnen wie gewohnt, ein gewonnenes Upgrade
// zeigt eine eigene Seite mit seinem Bild und Namen. Eine Drehung pro Kalenderwoche ist gratis,
// sonst kostet sie RAD_SPIN_COST Juwelen; zu finden ist das Rad im Shop als Karte „Glücksrad“.

// Bild auf dem Feld → kräftige Grundfarbe (benachbarte Felder hell/dunkel im Rad selbst)
const RAD_ICON = {
    coin: '#ffd23f',
    pp: '#b26bff',
    upgrade: '#4cc9f0',
    gem: '#39d5ff',
    box: '#ff6ec7',
    star: '#ff3b3b',
};
const RAD_TURNS = 7;      // volle Umdrehungen pro Drehung (mindestens)
const RAD_TIME = 4800;    // Millisekunden: schnell anlaufen, lange auslaufen

const RadUI = {
    _raf: 0,
    _rot: 0.4,            // aktuelle Drehung in Radiant (im Stand 0 … 2π)
    _sparks: [],
    _spin: null,          // laufende Drehung { from, to, t0, index, ticks }
    _busy: false,         // Rad steht, die Belohnung wird gleich gezeigt
    _win: -1,             // angezeigtes Gewinnfeld (nur nach dem Stillstand)
    _prize: null,         // gewinnenes Upgrade: { emoji, name, text } – eigene Seite
    _lockUntil: 0,

    // ── Shop-Karte (wie die „Glücksboxen“-Karte) ──
    // Wunsch von Leander (29.10.2026): kein Zurückknopf am Rad. Der Knopf hier öffnet das Rad und dreht
    // sofort - sonst stünde ein Kind vor dem Rad und käme nur mit 💎 wieder heraus.
    shopCards() {
        if (!this._ready()) return '';         // alte gespeicherte progress.js: Karte bleibt weg
        const free = Progress.radFree();
        const note = free
            ? `Diese Woche ist eine Drehung gratis – danach 💎 ${RAD_SPIN_COST} je Drehung.`
            : `Gratis-Drehung schon genutzt: jede weitere kostet 💎 ${RAD_SPIN_COST}.`;
        return `<div class="card" style="--a:#ff9f1c">
            <div class="head"><span class="ico">🎡</span><div><h3>Glücksrad</h3>
            <p>15 Felder: Münzen, Powerpunkte, Upgrades, Juwelen, Glücksboxen und Böse Sterne.
            Einmal drehen – der Pfeil oben zeigt, was du bekommst.</p>
            <p>${note}</p></div></div>
            <div class="foot">
                <button class="btn small ${free ? 'green pulse' : ''}" data-act="radopen"
                        ${Progress.radCanSpin() ? '' : 'disabled'}>${free ? 'Gratis drehen!' : 'Drehen! · 💎 ' + RAD_SPIN_COST}</button>
            </div></div>`;
    },

    // ── Alle Knöpfe des Rad-Bildschirms ──
    onClick(act, btn, e) {
        if (act === 'radopen') {
            // Oeffnen und sofort drehen. Ohne moegliche Drehung bleibt der Bildschirm besser zu:
            // am Rad gibt es keinen Zurueckknopf mehr, man kaeme dort nicht mehr heraus.
            if (!this._ready() || !Progress.radCanSpin()) { UI.renderShop(); return true; }
            this._prize = null;
            this._spin = null;
            this._busy = false;
            this._win = -1;
            this.render();
            this._start();
            return true;
        }
        if (act === 'radspin') { this._start(); return true; }
        if (act === 'radnext') {
            if (performance.now() < this._lockUntil) return true;
            this._prize = null;
            UI.renderShop();
            return true;
        }
        return false;
    },

    // ── Rad-Bildschirm: ganzer Bildschirm, oben der Pfeil, unten der Knopf „Drehen!“ ──
    // Die Regeln wohnen in progress.js. Ist dort das Rad noch nicht enthalten (eine alte Fassung der
    // Datei kommt aus dem Offline-Speicher), darf nichts davon aufgerufen werden – sonst bleibt der
    // ganze Shop leer. Dann zeigt sich das Rad einfach erst, wenn die neue Datei ausgeliefert ist.
    _ready() { return typeof Progress !== 'undefined' && typeof Progress.radSpin === 'function'; },

    render() {
        if (!this._ready()) return;
        const el = UI.screens.rad;
        if (this._prize) { this._renderPrize(); return; }
        this._sparks = [];                 // Funkenregen des letzten Besuchs ist vorbei
        el.innerHTML = `
            <div class="rad-head">Glücksrad</div>
            <div class="rad-wheel"><canvas></canvas></div>
            <div class="rad-msg">${this._msg()}</div>
            <button class="btn rad-go" data-act="radspin" ${this._can() ? '' : 'disabled'}>${this._goLabel()}</button>`;
        UI.show('rad');
        this._animate(el.querySelector('canvas'));
    },

    _can() { return !this._spin && !this._busy && Progress.radCanSpin(); },
    _goLabel() {
        if (this._spin || this._busy) return 'Das Rad läuft …';
        return Progress.radFree() ? 'Drehen!' : `Drehen! · 💎 ${RAD_SPIN_COST}`;
    },
    _msg() {
        if (this._spin || this._busy) return 'Der Pfeil oben entscheidet …';
        return Progress.radFree()
            ? 'Eine Drehung ist diese Woche gratis. Das Feld unter dem Pfeil ist dein Gewinn!'
            : `Gratis-Drehung schon gehabt – jetzt 💎 ${RAD_SPIN_COST} je Drehung.`;
    },
    // Knopf und Text ohne Neueszeichnen anpassen (das Rad selbst läuft in seiner Leinwand weiter)
    _sync() {
        const el = UI.screens.rad;
        const m = el.querySelector('.rad-msg');
        if (m) m.innerHTML = this._msg();
        const b = el.querySelector('.rad-go');
        if (b) { b.innerHTML = this._goLabel(); b.disabled = !this._can(); }
    },

    // Drehen: bezahlen (oder die Wochen-Drehung zählen), Feld ziehen und das Rad anlaufen lassen.
    // Gezogen wird VOR der Fahrt – die Endlage wird genau auf dieses Feld gestellt, Zeigen und
    // Gutschrift können also nie auseinanderlaufen.
    _start() {
        if (this._spin || this._busy) return;
        const res = Progress.radSpin();
        if (!res) {
            UI.flashMessage(`Nicht genug Juwelen – eine Drehung kostet 💎 ${RAD_SPIN_COST}`);
            this._sync();
            return;
        }
        const two = Math.PI * 2;
        const step = two / RAD_FIELDS.length;
        // Endlage: Feldmitte genau unter den Pfeil oben (-90°), leicht versetzt damit es nicht starr wirkt
        const aim = -Math.PI / 2 - (res.index + 0.5) * step + (Math.random() - 0.5) * step * 0.66;
        const to = ((aim % two) + two) % two + two * (RAD_TURNS + Math.floor(Math.random() * 2));
        this._spin = { from: this._rot, to, t0: performance.now(), index: res.index, reward: res.reward, ticks: 0 };
        this._win = res.index;
        Sound.swing();
        Game.vibrate(40);
        this._sync();
    },

    // Rad steht: Gewinnfeld aufleuchten lassen, kurz zeigen, dann die Belohnung
    _finish() {
        const s = this._spin;
        this._spin = null;
        this._busy = true;
        this._burst(26, ['#ffe14d', '#ffb01f', '#ffffff'], 1.2);
        Sound.powerUp();
        Game.vibrate(90);
        this._sync();
        setTimeout(() => this._showReward(s), 850);
    },

    // Eine Belohnung, genau wie Leander es will: Berg ohne Zähler, Truhe und Stern öffnen sich,
    // ein gewonnenes Extra zeigt eine Seite mit Bild und Namen.
    _showReward(s) {
        const gone = Game.state !== 'SHOP' || UI.current !== 'rad';
        this._busy = false;
        this._win = -1;
        this._spin = null;
        if (gone) return;      // Spieler ist inzwischen weg: die Belohnung ist gutgeschrieben und im Shop sichtbar
        const r = s.reward;
        const back = () => UI.renderShop();
        if (r.upgrade) {
            this._prize = { emoji: r.emoji || '✨', name: r.name || r.label, text: r.text || '' };
            this.render();
            return;
        }
        // Truhe und Stern öffnen nur, wenn nicht gerade eine andere läuft – die gewonnene liegt dann im Shop bereit
        if (r.box !== undefined && r.box !== null) {
            if (!Progress.box && typeof BoxUI !== 'undefined' && BoxUI.openNow(r.box, back)) return;
            UI.flashMessage('Glücksbox gewonnen – sie liegt im Shop bereit');
            UI.renderShop();
            return;
        }
        if (r.stars) {
            if (!Game.shopRandomStarActive && typeof UI.openBadStarNow === 'function' && UI.openBadStarNow(false, back)) return;
            UI.flashMessage('Böser Stern gewonnen – er liegt im Shop bereit');
            UI.renderShop();
            return;
        }
        if (typeof BoxUI !== 'undefined' && BoxUI.showRewards([r], back, { head: 'Glücksrad' })) return;
        UI.flashMessage(Progress.rewardText(r) || 'Belohnung!');
        UI.renderShop();
    },

    // Seite für ein gewonnenes Extra: sein Bild (Symbol der Shop-Karten) und sein Name
    _renderPrize() {
        const el = UI.screens.rad;
        const p = this._prize;
        this._animate(null);
        this._lockUntil = performance.now() + 550;
        el.innerHTML = `
            <div class="rad-head">Glücksrad</div>
            <div class="rad-prize"><span>${p.emoji}</span><b>${p.name}</b>
            <p>${p.text}</p>
            <p class="rad-sub">Neues Extra – im Menü „Waffen“ wählst du es für die nächste Runde.</p></div>
            <div class="rad-msg small">Tippen zum Weitermachen</div>
            <button class="rad-tap" data-act="radnext" aria-label="Weiter"></button>`;
        Sound.powerUp();
        UI.show('rad');
    },

    // Funkenregen in der Rad-Leinwand
    _burst(n, colors, speed = 1) {
        const sparks = this._sparks || (this._sparks = []);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 130) * speed;
            sparks.push({ x: 100, y: 100, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
                r: 3 + Math.random() * 4, c: colors[i % colors.length], life: 0.7 + Math.random() * 0.6 });
        }
    },

    // Leinwand: Rad mit 15 Feldern, Rahmen, Nabe und festem Pfeil oben. Zeit über performance.now();
    // die Schleife endet, sobald UI.current !== 'rad'.
    _animate(cv) {
        cancelAnimationFrame(this._raf);
        if (!cv) return;
        const sparks = this._sparks || (this._sparks = []);
        let last = performance.now();
        const draw = now => {
            if (UI.current !== 'rad') { this._raf = 0; return; }
            now = now || performance.now();
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            const rect = cv.getBoundingClientRect();
            // Direkt nach dem Einblenden hat die Leinwand noch keine Größe: im nächsten Bild zeichnen
            if (rect.width < 4) { this._raf = requestAnimationFrame(draw); return; }
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const W = Math.max(10, Math.round(rect.width * dpr));
            if (cv.width !== W) { cv.width = W; cv.height = W; }
            const ctx = cv.getContext('2d');
            ctx.save();
            ctx.scale(W / 200, W / 200);
            ctx.clearRect(0, 0, 200, 200);
            this._step(now, dt);
            this._drawWheel(ctx, now / 1000);
            for (let i = sparks.length - 1; i >= 0; i--) {
                const f = sparks[i];
                f.life -= dt;
                if (f.life <= 0) { sparks.splice(i, 1); continue; }
                f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 70 * dt;
                ctx.globalAlpha = Math.min(1, f.life * 2);
                Art.star(ctx, f.x, f.y, f.r, f.c, { lineWidth: 1 });
            }
            ctx.globalAlpha = 1;
            ctx.restore();
            this._raf = requestAnimationFrame(draw);
        };
        draw();
    },

    // Drehung fortschreiben: schnell anlaufen, viertelpotentiell auslaufen; im Stand sehr langsames Weitertreiben
    _step(now, dt) {
        const two = Math.PI * 2;
        const s = this._spin;
        if (s) {
            const p = Math.min(1, (now - s.t0) / RAD_TIME);
            this._rot = s.from + (s.to - s.from) * (1 - Math.pow(1 - p, 4));
            const ticks = Math.floor((this._rot - s.from) / (two / RAD_FIELDS.length));
            if (ticks > s.ticks) { s.ticks = ticks; Sound.hit(); }      // Klick laut Felder, wird immer langsamer
            if (p >= 1) this._finish();
            return;
        }
        if (!this._busy && !this._prize) this._rot += dt * 0.22;
        this._rot = ((this._rot % two) + two) % two;
    },

    // Das Rad in einem 200er Koordinatensystem: Keile, Bilder, Rahmen, Nabe – und der feste Pfeil oben
    _drawWheel(ctx, t) {
        const n = RAD_FIELDS.length;
        const step = (Math.PI * 2) / n;
        const R = 84;
        ctx.save();
        ctx.translate(100, 100);
        Art.glow(ctx, 0, 0, 118, '#ffb347', 0.5);
        ctx.save();
        ctx.rotate(this._rot);
        for (let i = 0; i < n; i++) {
            const f = RAD_FIELDS[i];
            const base = RAD_ICON[f.icon] || '#7b4dff';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, i * step, (i + 1) * step);
            ctx.closePath();
            ctx.fillStyle = i % 2 ? Art.dark(base, 0.36) : base;
            ctx.fill();
            ctx.strokeStyle = 'rgba(24,10,44,0.6)';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            if (this._win === i && !this._spin) {
                // das Feld unter dem Pfeil pulsiert hell – erst wenn das Rad steht, sonst wäre der
                // Gewinn schon während der Fahrt zu sehen
                ctx.fillStyle = `rgba(255,255,255,${(0.35 + 0.3 * Math.sin(t * 9)).toFixed(3)})`;
                ctx.fill();
            }
            const a = (i + 0.5) * step;
            ctx.save();
            ctx.translate(Math.cos(a) * R * 0.63, Math.sin(a) * R * 0.63);
            ctx.rotate(-this._rot);                 // die Bilder bleiben aufrecht stehen
            this._drawFieldIcon(ctx, f.icon, t);
            ctx.restore();
        }
        ctx.restore();
        // Rahmen mit Nieten (dreht nicht mit – der Rahmen gehört zum Gehäuse)
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#2a1050';
        ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#ffd23f';
        ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI / 6;
            Art.body(ctx, Math.cos(a) * (R + 4), Math.sin(a) * (R + 4), 2.6, 2.6, '#fff3bf', { outline: '#5a2400', highlight: false });
        }
        Art.body(ctx, 0, 0, 16, 16, '#ffe14d', { outline: '#5a2400', glossy: true });
        Art.star(ctx, 0, 0, 8.5, '#ff9f1c', { points: 5, inner: 0.46, rot: -Math.PI / 2 });
        ctx.restore();
        // Der Pfeil oben: steht fest, zeigt nach unten ins Rad
        Art.shape(ctx, c => {
            c.moveTo(100, 31); c.lineTo(87, 6); c.lineTo(113, 6); c.closePath();
        }, { x: 87, y: 6, w: 26, h: 25 }, '#ffe14d', { glossy: true });
        Art.shine(ctx, 97, 14, 3.4, 2.2, -0.5, 0.7);
    },

    // Bild eines Feldes, gezeichnet um den Nullpunkt (der Aufrufer hat hingeschoben und aufrecht gedreht)
    _drawFieldIcon(ctx, icon, t) {
        if (icon === 'coin') {
            Art.coin(ctx, 0, 0, 10.5, Math.max(0.4, Math.abs(Math.cos(t * 1.4))));
            return;
        }
        if (icon === 'pp') { Art.ppOrb(ctx, 0, 0, 10); return; }
        if (icon === 'gem') { Art.gem(ctx, 0, 0, 10.5, '#39d5ff'); return; }
        if (icon === 'star') {
            Art.star(ctx, 0, 0, 11.5, '#ff3b3b', { points: 5, inner: 0.48, rot: -Math.PI / 2 });
            Art.eyes(ctx, 0, -1, 2.6, { gap: 5, angry: true, iris: '#ffd23f', seed: 5 });
            return;
        }
        if (icon === 'box') {
            Art.box(ctx, -10, -2, 20, 11, 2.6, '#a8642a', { outline: '#42200a' });
            Art.box(ctx, -11, -10, 22, 9, 3.2, '#c98a4a', { outline: '#42200a' });
            Art.box(ctx, -2.3, -10, 4.6, 19, 1.6, '#ffd23f', { outline: '#8a5a00' });
            return;
        }
        // Upgrade-Symbol: drei nach oben weisende Winkel
        ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
            const y = 8 - k * 6;
            ctx.beginPath();
            ctx.moveTo(-7, y); ctx.lineTo(0, y - 6); ctx.lineTo(7, y);
            ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(24,10,44,0.6)'; ctx.stroke();
            ctx.lineWidth = 2.6; ctx.strokeStyle = '#eafcff'; ctx.stroke();
        }
    },
};

UI.register({
    screens: { rad: 'full' },
    shopTab: 'woche',           // die Rad-Karte steht in der Abteilung „Wochenbelohnung“
    onClick(act, btn, e) { return RadUI.onClick(act, btn, e); },
    shopCards() { return RadUI.shopCards(); },
});
