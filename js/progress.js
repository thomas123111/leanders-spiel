// ── Fortschritt: Powerpunkte, Upgrades, Quests, Erfahrung, Power-Pfad, Tagesleiste, Glücksboxen ──
// Wünsche von Leander (03.10.2026). Nur Spielregeln und Zahlen, keine Anzeige (die steht in den UI-Dateien).
// Eigener Speicherplatz (PROGRESS_KEY), damit der alte Spielstand (mark_save) unverändert bleibt.

const PROGRESS_KEY = 'mark_progress';

// Kosten je Upgrade-Stufe in Powerpunkten (Stufe 1 … 12 = Max). Leander nannte 13 Zahlen für 12 Stufen
// (die fünfte zweimal: 150 und 185); genommen ist 185, so bleibt das Muster +35/+15 und die Max-Stufe 450.
const POWER_COSTS = [10, 50, 100, 135, 185, 200, 235, 250, 300, 350, 400, 450];
const POWER_MAX = POWER_COSTS.length;

// Wer upgraden kann. from = ab welcher geschafften Welt die Figur dabei ist (Juri ab Welt 6, Krokodil ab 7).
// Wirkung je Stufe: Mark +1 Lebenspunkt (¼ Herz) und +5 % Schaden; Freunde +8 % Leben und +6 % Schaden.
const POWER_HEROES = [
    { id: 'mark', name: 'Mark', emoji: '🧢', from: 0, hpPerLevel: 1, dmgPerLevel: 0.05 },
    { id: 'juri', name: 'Juri', emoji: '🔨', from: 6, hpMulPerLevel: 0.08, dmgPerLevel: 0.06 },
    { id: 'croc', name: 'Schatten-Krokodil', emoji: '🐊', from: 7, hpMulPerLevel: 0.08, dmgPerLevel: 0.06 },
];

// Glücksboxen: fünf Seltenheiten. count = [min, max] Zahl der Belohnungen in der Box,
// size = Zeichengröße (wächst mit jedem Aufstieg), c/hi/lo = Farben wie bei den Bösen Sternen.
const BOX_RARITIES = [
    { name: 'Typisch', c: '#ff8ad8', hi: '#ffd0f0', lo: '#a83a8a', count: [3, 5], size: 0.72 },
    { name: 'Groß', c: '#c77dff', hi: '#ead2ff', lo: '#6a2aa8', count: [5, 8], size: 0.82 },
    { name: 'Supergroß', c: '#5fa8ff', hi: '#cfe6ff', lo: '#1f4fa8', count: [6, 8], size: 0.92 },
    { name: 'Megagroß', c: '#ffcf3d', hi: '#fff3bf', lo: '#b87a00', count: [8, 10], size: 1.02 },
    { name: 'Ultragroß', c: '#ff5fa2', hi: '#ffffff', lo: '#7a2ad0', count: [9, 10], size: 1.12, rainbow: true },
];
const BOX_TRIES = 5;
// Chance je Versuch, eine Stufe aufzusteigen (je aktueller Stufe)
const BOX_UPGRADE_CHANCES = [0.45, 0.3, 0.2, 0.12];

// Quests: laufen immer im Hintergrund mit (Lebenszeit-Zähler). Jede Quest hat Stufen [Ziel, Erfahrung];
// nach der letzten geht sie mit größeren Zielen weiter. „Besiege 500 Gegner = 50 EP“ wünscht sich Leander.
const QUESTS = [
    { id: 'kills', stat: 'kills', text: n => `Besiege ${n} Gegner`, icon: '👊',
        steps: [[25, 10], [100, 20], [250, 30], [500, 50], [1000, 70], [2000, 90], [4000, 120]] },
    { id: 'bosses', stat: 'bosses', text: n => `Besiege ${n} ${n === 1 ? 'Boss' : 'Bosse'}`, icon: '👹',
        steps: [[1, 15], [3, 25], [6, 35], [10, 50], [20, 70], [35, 90], [60, 120]] },
    { id: 'wins', stat: 'wins', text: n => `Schaffe ${n} ${n === 1 ? 'Welt' : 'Welten'}`, icon: '🏁',
        steps: [[1, 10], [5, 25], [10, 40], [20, 60], [40, 80], [70, 100]] },
    { id: 'rounds', stat: 'rounds', text: n => `Spiele ${n} Runden`, icon: '🎮',
        steps: [[3, 10], [10, 20], [25, 35], [50, 50], [100, 80]] },
    { id: 'coins', stat: 'coins', text: n => `Sammle ${n} Münzen im Kampf`, icon: '🪙',
        steps: [[50, 10], [200, 20], [500, 35], [1500, 55], [4000, 80]] },
    { id: 'chests', stat: 'chests', text: n => `Öffne ${n} Truhen`, icon: '🧰',
        steps: [[5, 10], [20, 25], [50, 40], [100, 60], [200, 80]] },
    { id: 'keys', stat: 'keys', text: n => `Finde ${n} Schlüssel`, icon: '🔑',
        steps: [[3, 15], [10, 30], [25, 50], [50, 70]] },
    { id: 'flawless', stat: 'flawless', text: n => `Schaffe ${n === 1 ? 'eine Welt' : n + ' Welten'} ohne Herz zu verlieren`, icon: '💖',
        steps: [[1, 30], [3, 50], [6, 70], [10, 100]] },
    { id: 'hardwins', stat: 'hardwins', text: n => `Schaffe ${n} ${n === 1 ? 'Welt' : 'Welten'} auf Schwer oder Extrem`, icon: '🔥',
        steps: [[1, 25], [5, 50], [10, 80], [25, 120]] },
    { id: 'stars', stat: 'stars', text: n => `Öffne ${n} Böse Sterne`, icon: '😈',
        steps: [[1, 10], [5, 25], [15, 45], [30, 70]] },
    { id: 'boxes', stat: 'boxes', text: n => `Öffne ${n} Glücksboxen`, icon: '🎁',
        steps: [[1, 10], [5, 25], [15, 45], [30, 70]] },
    { id: 'upgrades', stat: 'upgrades', text: n => `Mach ${n} Upgrades mit Powerpunkten`, icon: '⚡',
        steps: [[1, 15], [5, 30], [12, 50], [24, 80], [36, 120]] },
];

// Power-Pfad: 100 Belohnungen. Erfahrung für Stufe n: 20, 20, 20, 20, 25, … (alle 4 Stufen +5), Stufe 100 = 140.
const PATH_STEPS = 100;
function pathCost(n) { return 20 + 5 * Math.floor((n - 1) / 4); }
// Belohnung der Stufe n (1 … 100): jede 10. Stufe etwas Großes, dazwischen ein Wechsel aus Münzen,
// Powerpunkten, Glücksboxen und Bösen Sternen, wachsend mit der Stufe.
function pathReward(n) {
    const k = 1 + Math.floor((n - 1) / 10) * 0.25;           // wird alle 10 Stufen um 25 % größer
    if (n === 100) return { box: 4, label: 'Ultragroße Glücksbox' };
    if (n % 25 === 0) return { box: 3, label: 'Megagroße Glücksbox' };
    if (n % 10 === 0) return { jewels: n >= 50 ? 30 : 20, label: (n >= 50 ? 30 : 20) + ' Juwelen' };
    const r5 = n % 5;
    if (r5 === 0) return { box: n >= 40 ? 2 : 1, label: (n >= 40 ? 'Supergroße' : 'Große') + ' Glücksbox' };
    if (r5 === 1) return { coins: round5(50 * k), label: round5(50 * k) + ' Münzen' };
    if (r5 === 2) return { pp: round5(20 * k), label: round5(20 * k) + ' Powerpunkte' };
    if (r5 === 3) return n % 3 === 0 ? { stars: 1, label: '1 Böser Stern' } : { box: 0, label: 'Glücksbox' };
    return { pp: round5(30 * k), label: round5(30 * k) + ' Powerpunkte' };
}
function round5(v) { return Math.max(5, Math.round(v / 5) * 5); }

// Tagesleiste: 10 Belohnungen je Tag, nach jeder Runde gibt es die nächste.
const DAILY_SLOTS = 10;

// Kleiner fester Zufall (gleiche Tagesleiste beim Neuladen am selben Tag)
function seededRandom(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const Progress = {
    pp: 0,                      // Powerpunkte
    levels: { mark: 0, juri: 0, croc: 0 },
    xp: 0,                      // gesammelte Erfahrung insgesamt (wird nie ausgegeben)
    pathClaimed: 0,             // so viele Pfad-Belohnungen sind abgeholt
    questStep: {},              // id → Index der aktuellen Stufe
    stats: {},                  // Lebenszeit-Zähler für die Quests
    daily: { date: '', list: [], got: 0 },
    boxes: [],                  // ungeöffnete Glücksboxen (Start-Seltenheit je Box)
    box: null,                  // gerade geöffnete Box: { tier, tries, done }
    round: null,                // Zähler der laufenden Runde

    // ── Speichern ──
    load() {
        try {
            const d = JSON.parse(localStorage.getItem(PROGRESS_KEY));
            if (d && typeof d === 'object') {
                const num = v => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);
                this.pp = num(d.pp);
                for (const h of POWER_HEROES) this.levels[h.id] = Math.min(POWER_MAX, num(d.levels && d.levels[h.id]));
                this.xp = num(d.xp);
                this.pathClaimed = Math.min(PATH_STEPS, num(d.pathClaimed));
                this.questStep = d.questStep && typeof d.questStep === 'object' ? d.questStep : {};
                this.stats = d.stats && typeof d.stats === 'object' ? d.stats : {};
                if (d.daily && Array.isArray(d.daily.list)) this.daily = d.daily;
                this.boxes = Array.isArray(d.boxes) ? d.boxes.map(t => clamp(t | 0, 0, BOX_RARITIES.length - 1)) : [];
                this.box = d.box && typeof d.box === 'object' ? d.box : null;
            }
        } catch (e) { /* kaputter Stand: neu beginnen */ }
        this._ensureDaily();
    },

    save() {
        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify({
                pp: this.pp, levels: this.levels, xp: this.xp, pathClaimed: this.pathClaimed,
                questStep: this.questStep, stats: this.stats, daily: this.daily, boxes: this.boxes, box: this.box,
            }));
        } catch (e) { /* privater Modus */ }
    },

    // ── Belohnungen gutschreiben (eine Stelle für alles) ──
    // r = { coins, jewels, pp, stars, box (Start-Seltenheit), xp }
    grant(r) {
        if (!r) return;
        if (r.coins) Game._grantCoins(r.coins);
        if (r.jewels) Game._grantJewels(r.jewels);
        if (r.pp) this.pp += r.pp;
        if (r.stars) Game.boseStarUses = (Game.boseStarUses || 0) + r.stars;
        if (r.box !== undefined && r.box !== null) this.boxes.push(clamp(r.box | 0, 0, BOX_RARITIES.length - 1));
        if (r.xp) this.xp += r.xp;
        this.save();
        Game.save();
    },

    // Kurzer Text für eine Belohnung, z. B. „+40 🪙“
    rewardText(r) {
        if (!r) return '';
        if (r.label) return r.label;
        const p = [];
        if (r.coins) p.push(r.coins + ' Münzen');
        if (r.jewels) p.push(r.jewels + ' Juwelen');
        if (r.pp) p.push(r.pp + ' Powerpunkte');
        if (r.stars) p.push(r.stars + (r.stars === 1 ? ' Böser Stern' : ' Böse Sterne'));
        if (r.box !== undefined && r.box !== null) p.push((r.box ? BOX_RARITIES[r.box].name + ' ' : '') + 'Glücksbox');
        if (r.xp) p.push(r.xp + ' EP');
        return p.join(', ');
    },

    rewardIcon(r) {
        if (!r) return '';
        if (r.box !== undefined && r.box !== null) return '🎁';
        if (r.stars) return '😈';
        if (r.jewels) return '💎';
        if (r.pp) return '⚡';
        if (r.xp) return '⭐';
        return '🪙';
    },

    // ── Upgrades mit Powerpunkten ──
    heroUnlocked(id) {
        const h = POWER_HEROES.find(x => x.id === id);
        if (!h) return false;
        if (!h.from) return true;
        return !!(Game.worldRewardClaims && Game.worldRewardClaims['w' + h.from]) || (Game.maxWorldUnlocked || 1) > h.from;
    },
    nextCost(id) {
        const lv = this.levels[id] || 0;
        return lv >= POWER_MAX ? null : POWER_COSTS[lv];
    },
    canUpgrade(id) {
        const c = this.nextCost(id);
        return c !== null && this.heroUnlocked(id) && this.pp >= c;
    },
    upgrade(id) {
        if (!this.canUpgrade(id)) return false;
        this.pp -= this.nextCost(id);
        this.levels[id] = (this.levels[id] || 0) + 1;
        this.addStat('upgrades', 1);
        this.save();
        return true;
    },
    // Beim Weltstart: Stufen auf Mark und die Freunde anwenden (main.js ruft das nach dem Aufbau auf)
    applyPower(game) {
        const p = game.player;
        const lm = this.levels.mark || 0;
        if (p && lm) {
            p.maxHp += lm * POWER_HEROES[0].hpPerLevel;
            p.hp = p.maxHp;
            const k = 1 + lm * POWER_HEROES[0].dmgPerLevel;
            if (p.meleeWeapon) p.meleeWeapon.damage *= k;
            if (p.rangedWeapon) p.rangedWeapon.damage *= k;
        }
        for (const c of game.companions) {
            const id = c instanceof Juri ? 'juri' : (typeof ShadowCrocodile !== 'undefined' && c instanceof ShadowCrocodile ? 'croc' : null);
            const lv = id ? this.levels[id] || 0 : 0;
            if (!lv) continue;
            const h = POWER_HEROES.find(x => x.id === id);
            c.maxHp = Math.round(c.maxHp * (1 + lv * h.hpMulPerLevel));
            c.hp = c.maxHp;
            if (c.damage) c.damage *= 1 + lv * h.dmgPerLevel;
            c.powerLevel = lv;
        }
        if (p) p.powerLevel = lm;
    },

    // ── Quests ──
    addStat(key, n) {
        this.stats[key] = (this.stats[key] || 0) + n;
    },
    // Aktuelle Stufe einer Quest: { quest, index, target, xp, have, done, text }
    questState(q) {
        const i = this.questStep[q.id] || 0;
        let target, xp;
        if (i < q.steps.length) [target, xp] = q.steps[i];
        else {
            // nach der letzten Stufe: Ziel ×1,5, Erfahrung +20 je weitere Stufe
            const [lt, lx] = q.steps[q.steps.length - 1];
            const extra = i - q.steps.length + 1;
            target = Math.round(lt * Math.pow(1.5, extra) / 5) * 5 || lt + extra;
            xp = lx + 20 * extra;
        }
        const have = this.stats[q.stat] || 0;
        return { quest: q, index: i, target, xp, have: Math.min(have, target), done: have >= target, text: q.text(target) };
    },
    allQuests() { return QUESTS.map(q => this.questState(q)); },
    claimableQuests() { return this.allQuests().filter(s => s.done).length; },
    // Erledigte Quest antippen: Erfahrung gutschreiben, nächste Stufe. Liefert die Erfahrung oder 0.
    claimQuest(id) {
        const q = QUESTS.find(x => x.id === id);
        if (!q) return 0;
        const s = this.questState(q);
        if (!s.done) return 0;
        this.questStep[id] = s.index + 1;
        this.xp += s.xp;
        this.save();
        return s.xp;
    },

    // ── Power-Pfad ──
    // Wie viel Erfahrung bis einschließlich Stufe n nötig ist
    pathTotal(n) { let t = 0; for (let i = 1; i <= n; i++) t += pathCost(i); return t; },
    pathReached() { let n = 0; while (n < PATH_STEPS && this.xp >= this.pathTotal(n + 1)) n++; return n; },
    pathClaimable() { return this.pathReached() - this.pathClaimed; },
    // Nächste erreichte Belohnung abholen. Liefert die Belohnung oder null.
    claimPath() {
        if (this.pathClaimed >= this.pathReached()) return null;
        const n = this.pathClaimed + 1;
        const r = pathReward(n);
        this.pathClaimed = n;
        this.grant(r);
        return { step: n, ...r };
    },

    // ── Tagesleiste (10 Belohnungen je Tag, eine nach jeder Runde) ──
    _ensureDaily() {
        const today = typeof Game !== 'undefined' && Game._todayKey ? Game._todayKey() : '';
        if (!today || this.daily.date === today) return;
        const rnd = seededRandom(parseInt(today.replace(/-/g, ''), 10));
        const list = [];
        for (let i = 0; i < DAILY_SLOTS; i++) {
            const x = rnd();
            const late = i >= 6;          // die letzten Felder sind etwas besser
            let r;
            if (x < 0.03) r = { jewels: 5 + 5 * Math.floor(rnd() * 2) };                 // Juwelen: sehr selten
            else if (x < 0.13) r = { stars: 1 };
            else if (x < 0.25) r = { box: late && rnd() < 0.4 ? 1 : 0 };
            else if (x < 0.62) r = { pp: round5((late ? 15 : 10) + rnd() * 25) };
            else r = { coins: round5((late ? 40 : 20) + rnd() * 60) };
            list.push(r);
        }
        this.daily = { date: today, list, got: 0 };
        this.save();
    },
    dailyList() { this._ensureDaily(); return this.daily; },

    // ── Runde: Zähler während des Kampfs ──
    startRound(world) {
        this.round = { world, kills: 0, bosses: 0, coins: 0, chests: 0, keys: 0, hurt: 0, ended: false,
            before: this.allQuests().map(s => ({ id: s.quest.id, have: s.have, done: s.done })) };
    },
    onKill(enemy) { if (this.round && !this.round.ended && this.round.world > 0) { if (enemy.isBoss) this.round.bosses++; else this.round.kills++; } },
    onCoin(v) { if (this.round && !this.round.ended && this.round.world > 0) this.round.coins += v; },
    onChest() { if (this.round && !this.round.ended && this.round.world > 0) this.round.chests++; },
    onKey() { if (this.round && !this.round.ended && this.round.world > 0) this.round.keys++; },
    onHurt() { if (this.round && !this.round.ended) this.round.hurt++; },

    // Runde vorbei (won = Welt geschafft). Zählt die Quests weiter, gibt die nächste Tagesbelohnung und
    // liefert eine Zusammenfassung für die Endseite. Training und abgebrochene Runden zählen nicht.
    endRound(won) {
        const r = this.round;
        if (!r || r.ended) return this.lastSummary || null;
        r.ended = true;
        if (r.world <= 0) { this.lastSummary = null; return null; }
        this.addStat('kills', r.kills);
        this.addStat('bosses', r.bosses);
        this.addStat('coins', r.coins);
        this.addStat('chests', r.chests);
        this.addStat('keys', r.keys);
        this.addStat('rounds', 1);
        if (won) {
            this.addStat('wins', 1);
            if (r.hurt === 0) this.addStat('flawless', 1);
            if (Game.settings && Game.settings.difficulty !== 'normal') this.addStat('hardwins', 1);
        }
        // Quests, die in dieser Runde weitergekommen oder fertig geworden sind
        const quests = [];
        for (const s of this.allQuests()) {
            const b = r.before.find(x => x.id === s.quest.id);
            if (!b || (s.have === b.have && s.done === b.done)) continue;
            quests.push({ id: s.quest.id, icon: s.quest.icon, text: s.text, have: s.have, target: s.target,
                done: s.done, newlyDone: s.done && !b.done, xp: s.xp });
        }
        // Tagesleiste: nächste Belohnung (verlorene Runden zählen nur, wenn mindestens ein Gegner besiegt wurde)
        let daily = null;
        const d = this.dailyList();
        if (d.got < d.list.length && (won || r.kills > 0)) {
            daily = { index: d.got, ...d.list[d.got] };
            d.got++;
            this.grant(daily);
        }
        this.save();
        this.lastSummary = { won, world: r.world, kills: r.kills, bosses: r.bosses, coins: r.coins, quests, daily };
        return this.lastSummary;
    },

    // ── Glücksboxen öffnen (wie die Bösen Sterne: 5 Versuche, Aufstieg mit Glück, kein Zurück) ──
    startBox() {
        if (this.box) return true;                 // angefangene Box läuft weiter
        if (!this.boxes.length) return false;
        // die beste vorhandene Box zuerst
        let best = 0;
        for (let i = 1; i < this.boxes.length; i++) if (this.boxes[i] > this.boxes[best]) best = i;
        const tier = this.boxes.splice(best, 1)[0];
        this.box = { tier, tries: BOX_TRIES, done: tier >= BOX_RARITIES.length - 1 };
        this.save();
        return true;
    },
    // Ein Versuch. Liefert true bei Aufstieg.
    boxTap() {
        const b = this.box;
        if (!b || b.done) return false;
        b.tries--;
        const max = BOX_RARITIES.length - 1;
        const up = b.tier < max && Math.random() < BOX_UPGRADE_CHANCES[Math.min(b.tier, BOX_UPGRADE_CHANCES.length - 1)];
        if (up) b.tier++;
        if (b.tier >= max || b.tries <= 0) b.done = true;
        this.save();
        return up;
    },
    // Box öffnen: Liste der Belohnungen (jede einzeln, z. B. { coins: 35 }). Wird sofort gutgeschrieben.
    openBox() {
        const b = this.box;
        if (!b) return null;
        const tier = b.tier;
        const rar = BOX_RARITIES[tier];
        const n = randInt(rar.count[0], rar.count[1]);
        const items = [];
        for (let i = 0; i < n; i++) {
            const x = Math.random();
            let it;
            if (x < 0.04 + tier * 0.01) it = { jewels: round5(5 + Math.random() * (5 + tier * 5)) };       // selten
            else if (x < 0.07 + tier * 0.02) it = { stars: 1 };                                             // selten
            else if (x < 0.5) it = { pp: round5((8 + Math.random() * 17) * (1 + tier * 0.35)) };
            else it = { coins: round5((15 + Math.random() * 45) * (1 + tier * 0.5)) };
            items.push(it);
            this.grant(it);
        }
        this.box = null;
        this.addStat('boxes', 1);
        this.save();
        return { tier, items };
    },
};
