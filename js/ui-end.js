// ── Endseite nach jeder Runde: Band, Quests, Buehne mit Mark und Freunden, Belohnungen, Knöpfe ──
// Meldet sich bei UI an (screens.end = overlay, onResult, onClick). Klassische Script-Datei.
(function () {
    'use strict';

    const LW = 840, LH = 400;          // logische Zeichenflaeche der Buehne (passt sich der Groesse an)

    const UIEnd = {
        kind: null,
        canvas: null,
        ctx: null,
        raf: 0,
        last: 0,
        t: 0,
        confetti: [],
        chars: null,
        glow: null,
        _lockTimer: 0,
        // Quest-Blättern: immer drei auf einmal (Wunsch von Leander, 04.10.2026)
        PER_PAGE: 3,
        qPage: 0,
        _qSig: null,                // die Zusammenfassung, zu der qPage gehört
        _openedSig: null,           // für diese Zusammenfassung wurden die Belohnungen schon gezeigt
        _openedRewards: false,

        // ── Anmeldung bei der Oberflaeche ──
        ext: {
            screens: { end: 'overlay' },
            onResult(kind) {
                // Training: alte Anzeige behalten
                if (typeof Game === 'undefined' || Game.currentWorld === 0) return false;
                UIEnd.show(kind);
                return true;
            },
            onClick(act, btn, e) {
                const g = Game;
                if (act === 'endnext') { g._advanceToNextWorld(); return true; }
                if (act === 'endretry') { g.paused = false; g.startWorld(g.currentWorld); return true; }
                if (act === 'endleave') { g.returnToTitle(); return true; }
                if (act === 'endqprev') { UIEnd.pageQuests(-1); return true; }
                if (act === 'endqnext') { UIEnd.pageQuests(1); return true; }
                if (act === 'endopen') { UIEnd.openRewards(); return true; }
                return false;
            }
        },

        // ── Anzeige aufbauen ──
        show(kind) {
            this.kind = kind;
            const won = kind !== 'over';
            const g = Game;
            const s = g.roundSummary;
            const info = worldInfo(g.currentWorld);
            const page = this._pageInfo(s);
            const pg = page.pages <= 1 ? 'disabled' : '';

            // Knöpfe
            let btns = '';
            if (kind === 'win') {
                btns = '<button class="btn big gray" data-act="endleave">Verlassen</button>';
            } else if (won) {
                btns = (g.currentWorld < LAST_WORLD
                    ? '<button class="btn big green pulse" data-act="endnext">Nächstes Level ▶</button>' : '')
                    + '<button class="btn big gray" data-act="endleave">Verlassen</button>';
            } else {
                btns = '<button class="btn big green" data-act="endretry">Nochmal ↻</button>'
                    + '<button class="btn big gray" data-act="endleave">Verlassen</button>';
            }

            const el = UI.screens.end;
            el.innerHTML = `
                <div class="end-grid">
                    <div class="end-banner ${won ? 'win' : 'lose'}">
                        <div class="end-banner-word">${won ? 'GEWONNEN' : 'VERLOREN'}</div>
                        <div class="end-banner-sub">${this.subText(kind, info)}</div>
                    </div>
                    <div class="end-quests">
                        <div class="end-h with-pager"><span>Quests</span><span class="end-pager">
                            <button class="end-pbtn" data-act="endqprev" aria-label="Die drei Quests davor" ${pg}>◀</button>
                            <b class="end-pageno">${page.page + 1}/${page.pages}</b>
                            <button class="end-pbtn" data-act="endqnext" aria-label="Die nächsten drei Quests" ${pg}>▶</button>
                        </span></div>
                        <div class="end-quest-list">${this.questHtml(s)}</div>
                    </div>
                    <div class="end-stage"><canvas class="end-canvas"></canvas></div>
                    <div class="end-rewards">
                        <div class="end-h">Belohnungen</div>
                        <div class="end-reward-list">${this.rewardHtml(s)}</div>
                    </div>
                    <div class="end-actions">${btns}</div>
                </div>`;

            UI.show('end');

            // Knöpfe kurz sperren (gegen Weitertippen aus dem Kampf), wie in renderResult
            const grid = el.querySelector('.end-grid');
            grid.classList.add('locked');
            clearTimeout(this._lockTimer);
            this._lockTimer = setTimeout(() => grid.classList.remove('locked'), 650);

            this.chars = null;   // Figuren haengen an der Welt ab (Juri ab 7, Krokodil ab 8) -> je Show neu bauen
            this.setupCanvas();
            this.buildConfetti();
            this.last = performance.now();
            cancelAnimationFrame(this.raf);
            const loop = (now) => {
                if (UI.current !== 'end') { this.raf = 0; return; }
                const dt = Math.min(0.05, (now - this.last) / 1000);
                this.last = now;
                this.t += dt;
                this.draw(dt);
                this.raf = requestAnimationFrame(loop);
            };
            this.raf = requestAnimationFrame(loop);
        },

        subText(kind, info) {
            const g = Game;
            if (kind === 'win') return 'Alle Welten geschafft! Du bist ein echter Held!';
            let t = 'Welt ' + g.currentWorld + ' · ' + info.name;
            if (kind !== 'over' && info.boss) t += ' · ' + info.boss + ' besiegt!';
            return t;
        },

        // Welche drei Quests gerade zu sehen sind. Neue Runde: die Seite mit der frisch geschafften Quest zuerst.
        _pageInfo(s) {
            const qs = (s && s.quests) || [];
            const pages = Math.max(1, Math.ceil(qs.length / this.PER_PAGE));
            if (this._qSig !== s) {
                const fresh = qs.findIndex(q => q.newlyDone);
                this._qSig = s;
                this.qPage = fresh >= 0 ? Math.floor(fresh / this.PER_PAGE) : 0;
            }
            return { qs, pages, page: Math.max(0, Math.min(this.qPage, pages - 1)) };
        },

        // Blättern im Kreis: nur die Liste neu zeichnen, die Buehnen-Animation laeuft weiter
        pageQuests(step) {
            const s = Game.roundSummary;
            const info = this._pageInfo(s);
            if (info.pages <= 1) return;
            this._qSig = s;
            this.qPage = ((info.page + step) % info.pages + info.pages) % info.pages;
            const el = UI.screens.end;
            const list = el.querySelector('.end-quest-list');
            if (!list) return;
            list.innerHTML = this.questHtml(s);
            const no = el.querySelector('.end-pageno');
            if (no) no.textContent = (this.qPage + 1) + '/' + info.pages;
            list.classList.remove('in-left', 'in-right');
            void list.offsetWidth;                      // Animation neu starten
            list.classList.add(step > 0 ? 'in-right' : 'in-left');
        },

        questHtml(s) {
            const p = this._pageInfo(s);
            if (!p.qs.length) return '<div class="end-empty">Diesmal keine Quest weitergekommen.</div>';
            return p.qs.slice(p.page * this.PER_PAGE, p.page * this.PER_PAGE + this.PER_PAGE).map(q => {
                const have = Math.min(q.have, q.target);
                const pct = q.target > 0 ? Math.round(have * 100 / q.target) : 100;
                const note = q.claimed ? '<div class="end-quest-claim">✓ abgeholt</div>'
                    : (q.newlyDone ? `<div class="end-quest-done">✓ geschafft! +${q.xp} EP abholen</div>` : '');
                return `<div class="end-quest${q.newlyDone ? ' done' : ''}${q.claimed ? ' claimed' : ''}${q.daily ? ' today' : ''}">
                    <span class="end-quest-icon">${q.icon}</span>
                    <div class="end-quest-body">
                        <div class="end-quest-text">${q.daily ? '<span class="end-quest-tag">Heute</span>' : ''}${q.text}</div>
                        <div class="end-quest-bar"><i style="width:${pct}%"></i><b>${have}/${q.target}</b></div>
                        ${note}
                    </div>
                </div>`;
            }).join('');
        },

        rewardHtml(s) {
            const g = Game;
            const rows = [];
            if (g.levelCoins) rows.push(`<div class="end-row"><span class="end-ic">🪙</span><span>+${g.levelCoins} Münzen in dieser Runde</span></div>`);
            if (g.lastReward) rows.push(`<div class="end-row"><span class="end-ic">${Progress.rewardIcon(g.lastReward)}</span><span>Weltbelohnung: ${UI._rewardText(g.lastReward)}</span></div>`);
            if (g.lastUnlockText) rows.push(`<div class="end-row"><span class="end-ic">🎁</span><span>${g.lastUnlockText}</span></div>`);
            const d = s && s.daily;
            const btn = this.openBtnHtml(s);
            if (d) {
                const list = Progress.dailyList();
                rows.push(`<div class="end-row daily"><span class="end-ic">${Progress.rewardIcon(d)}</span>`
                    + `<span>${Progress.rewardText(d)}<br><small>Tagesbelohnung ${list.got}/${DAILY_SLOTS}</small></span>`
                    + btn + '</div>');
            } else {
                const list = Progress.dailyList();
                if (list.got >= DAILY_SLOTS) rows.push('<div class="end-row muted"><span class="end-ic">🌙</span><span>Alle 10 Tagesbelohnungen geholt!</span></div>');
                // Ohne Tagesbelohnung bekommt die Zeile den Knopf, damit die Weltbelohnung trotzdem als Berg erscheint
                if (btn) rows.push(`<div class="end-row"><span class="end-ic">🎁</span><span>Belohnungen als Berg ansehen</span>${btn}</div>`);
            }
            if (!rows.length) rows.push('<div class="end-row muted"><span class="end-ic">🪙</span><span>Diese Runde gab es nichts zu holen.</span></div>');
            return rows.join('');
        },

        // ── Belohnungen der Runde ansehen: Berge, Böser Stern und Glücksbox der Reihe nach ──
        // Zuerst die Weltbelohnung, dann die Tagesleiste (Leander: beide Berge erscheinen nacheinander).
        // Böse Sterne und Glücksboxen behalten ihren heutigen Weg (gehen sofort auf), Erfahrung gibt es nie.
        _steps(s) {
            const steps = [];
            const w = Game.lastReward;
            if (w && (w.coins || w.jewels || w.pp)) steps.push({ items: [w], head: 'Weltbelohnung' });
            const d = s && s.daily;
            if (d) {
                if (d.box !== undefined && d.box !== null && !Progress.box && typeof BoxUI !== 'undefined') steps.push({ box: d.box });
                else if (d.stars && !Game.shopRandomStarActive) steps.push({ star: true });
                else if (d.coins || d.jewels || d.pp) steps.push({ items: [d], head: 'Tagesbelohnung' });
            }
            return steps;
        },
        rewardsOpened(s) { return this._openedSig === s && this._openedRewards; },
        openBtnHtml(s) {
            const steps = this._steps(s);
            if (this.rewardsOpened(s) || !steps.length) return '';
            // Stern und Box gehen auf, alles andere wird als Berg gezeigt
            const label = steps.some(x => x.box !== undefined || x.star) ? 'Öffnen!' : 'Ansehen!';
            return `<button class="btn small green pulse end-open" data-act="endopen">${label}</button>`;
        },
        // Antippen: die Belohnungen der Runde einer nach dem anderen. Zurück auf die Endseite geht erst der
        // letzte Schritt – UIEnd.show baut die ganze Seite neu und startet die Figuren, das soll nicht
        // zwischen zwei Belohnungen zweimal geschehen.
        openRewards() {
            const s = Game.roundSummary;
            if (this.rewardsOpened(s)) return false;
            const steps = this._steps(s);
            if (!steps.length) return false;
            this._openedSig = s;
            this._openedRewards = true;
            let geschafft = false;            // hat wenigstens ein Schritt aufgegangen?
            const run = i => {
                const st = steps[i];
                if (!st) {
                    if (!geschafft) { UIEnd._openedRewards = false; return; }   // Knopf bleibt stehen
                    UIEnd.show(UIEnd.kind);
                    return;
                }
                const next = () => run(i + 1);
                if (st.box !== undefined && BoxUI.openNow(st.box, next)) { geschafft = true; return; }
                if (st.star && UI.openBadStarNow(false, next)) { geschafft = true; return; }
                if (st.items && typeof BoxUI !== 'undefined' && BoxUI.showRewards(st.items, next, { head: st.head })) { geschafft = true; return; }
                run(i + 1);            // dieser Schritt ging nicht auf: weiter zum nächsten
            };
            run(0);
            return true;
        },

        // ── Buehne: Canvas scharf und groessenanpasst ──
        setupCanvas() {
            const el = UI.screens.end;
            this.canvas = el.querySelector('.end-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.glow = null;
            this.fitCanvas();
        },

        fitCanvas() {
            const c = this.canvas;
            if (!c || !c.parentElement) return;
            const r = c.parentElement.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
            // CSS-Groesse kommt aus end.css (100%/100%): unter #ui { zoom } wuerde ein in px
            // gesetztes style.width doppelt hochskaliert und die Buehne abgeschnitten (Review B2).
            if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
            // Gleichmäßig skalieren (vorher getrennt in x und y: die schmale Mitte quetschte die Figuren);
            // die logische Breite folgt dem Seitenverhältnis der Bühne
            this.scaleX = this.scaleY = (h * dpr) / LH;
            this.lw = (w * dpr) / this.scaleX;
        },

        // Figuren wie auf der Startseite (main.js _drawTitleCarousel), nur mit eigener Aufstellung
        getChars() {
            if (this.chars) return this.chars;
            const mk = (fn, ...args) => { try { return new fn(...args); } catch (e) { return null; } };
            const w = Game.currentWorld;
            const list = [{ id: 'mark', obj: mk(Player, 0, 0) }];
            if (w >= 7) list.push({ id: 'juri', obj: mk(Juri, 0, 0) });
            if (w >= 8) list.push({ id: 'croc', obj: mk(ShadowCrocodile, 0, 0) });
            this.chars = list.filter(c => c.obj);
            return this.chars;
        },

        buildConfetti() {
            this.confetti = [];
            if (this.kind === 'over') return;
            const colors = ['#ffd23f', '#ff4d8d', '#3fa7ff', '#3ddc97', '#b58cff', '#ff9a3c', '#ffffff'];
            for (let i = 0; i < 90; i++) {
                this.confetti.push({
                    x: Math.random() * (this.lw || LW), y: Math.random() * LH,
                    vy: 55 + Math.random() * 85, ph: Math.random() * 6.283, sw: 26 + Math.random() * 40,
                    rot: Math.random() * 6.283, vr: (Math.random() - 0.5) * 7,
                    w: 5 + Math.random() * 5, h: 8 + Math.random() * 7,
                    c: colors[i % colors.length]
                });
            }
        },

        drawConfetti(dt) {
            const ctx = this.ctx;
            for (const p of this.confetti) {
                p.y += p.vy * dt;
                p.ph += dt * 2.4;
                p.rot += p.vr * dt;
                if (p.y > LH + 14) { p.y = -14; p.x = Math.random() * (this.lw || LW); }
                const x = p.x + Math.sin(p.ph) * p.sw * 0.35;
                ctx.save();
                ctx.translate(x, p.y);
                ctx.rotate(p.rot);
                ctx.globalAlpha = 0.92;
                ctx.fillStyle = p.c;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
            ctx.globalAlpha = 1;
        },

        draw(dt) {
            const ctx = this.ctx;
            if (!ctx || !this.canvas.parentElement) return;
            this.fitCanvas();
            const won = this.kind !== 'over';
            const t = this.t;
            ctx.save();
            ctx.scale(this.scaleX, this.scaleY);
            const CW = this.lw || LW;
            ctx.clearRect(0, 0, CW, LH);

            // Leuchtende Buehne: Verlauf einmal bauen und wiederverwenden (keiner pro Bild)
            if (!this.glow) {
                const gl = ctx.createRadialGradient(0, 0, 20, 0, 0, 210);
                if (won) { gl.addColorStop(0, 'rgba(255, 224, 120, 0.5)'); gl.addColorStop(0.55, 'rgba(255, 170, 60, 0.16)'); }
                else { gl.addColorStop(0, 'rgba(150, 150, 175, 0.32)'); gl.addColorStop(0.55, 'rgba(90, 90, 120, 0.12)'); }
                gl.addColorStop(1, 'rgba(255, 200, 90, 0)');
                this.glow = gl;
            }
            ctx.save();
            ctx.translate(CW / 2, 300);
            ctx.scale(1, 0.34);
            ctx.fillStyle = this.glow;
            ctx.save();
            ctx.scale(1, 1 / 0.34);
            ctx.beginPath();
            ctx.arc(0, 0, 210, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = won ? 'rgba(255, 214, 110, 0.34)' : 'rgba(140, 140, 170, 0.2)';
            ctx.beginPath();
            ctx.arc(0, 0, 150, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Reihenfolge: Freunde hinten, Mark vorn in der Mitte
            const chars = this.getChars();
            const back = chars.filter(c => c.id !== 'mark');
            const order = back.concat(chars.filter(c => c.id === 'mark'));
            const cam = { x: 0, y: 0, width: 100, height: 100, shakeX: 0, shakeY: 0, worldToScreen(x, y) { return { x, y }; } };
            const spots = { mark: { x: CW / 2, y: 262, s: 3.4 }, juri: { x: CW / 2 - Math.min(118, CW * 0.3), y: 222, s: 2.4 }, croc: { x: CW / 2 + Math.min(122, CW * 0.3), y: 222, s: 2.4 } };
            const jumpSlot = { mark: 0, juri: 1, croc: 2 };
            let bi = 0;
            for (const c of order) {
                const spot = spots[c.id] || spots.mark;
                const slot = jumpSlot[c.id] != null ? jumpSlot[c.id] : bi;
                bi++;
                let s = spot.s * (won ? 1 : 0.88);
                let dy = won ? 0 : 9;                       // verloren: etwas kleiner und tiefer
                let jump = 0;
                if (won) {
                    const u = ((t - 0.3 - slot * 0.45) % 1.7) / 1.25;
                    if (u >= 0 && u <= 1) jump = Math.sin(u * Math.PI) * 34;
                }
                ctx.save();
                Art.groundShadow(ctx, spot.x, spot.y + 16 * s, 15 * s, 5 * s, (jump > 0 ? 0.24 : 0.42));
                ctx.translate(spot.x, spot.y - jump * s * 0.35 + dy);
                ctx.scale(s, s);
                const o = c.obj;
                o.x = -o.w / 2;
                o.y = -o.h / 2;
                if (c.id === 'mark') {
                    o.facingAngle = Math.sin(t * (won ? 2.4 : 0.7)) * (won ? 0.6 : 0.16) + Math.PI * 0.12;
                    o.aimAngle = o.facingAngle;
                } else {
                    o.faceX = 1;
                    o.moving = false;
                    o.target = null;
                }
                try { o.draw(ctx, cam); } catch (e) { /* Figur fehlt: Platz bleibt leer */ }
                ctx.restore();
            }

            // Ueber Mark ein kleines graues Wölkchen (verloren)
            if (!won) {
                const mx = CW / 2, my = 262 - 120 + Math.sin(t * 1.8) * 4;
                ctx.save();
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = '#9a97ad';
                const puff = (dx, r) => { ctx.beginPath(); ctx.arc(mx + dx, my + (dx === 0 ? -5 : 0), r, 0, Math.PI * 2); ctx.fill(); };
                puff(-13, 9); puff(0, 12); puff(13, 9);
                ctx.fillRect(mx - 13, my - 2, 26, 9);
                ctx.restore();
            }

            if (won) this.drawConfetti(dt);
            ctx.restore();
        },
    };

    UI.register(UIEnd.ext);
    window.UIEnd = UIEnd;
})();
