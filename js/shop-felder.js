// ── Fragezeichen-Felder im Coinshop (Wunsch von Thomas und Leander, 29.10.2026) ──
// Klassische Script-Datei (kein import/export), meldet sich über UI.register bei der Oberfläche an.
// Eingehängt wird der Vorauftrag schon: UI._shopFelderHtml() ruft ShopFelder.html() (js/ui.js).
//
// Zehn Felder je Tag (Datum wie die Tagesbelohnung: Game._todayKey()), im Spielstand gespeichert
// (Game.shopFelder - dieselbe Datei, in der auch die Tagesbelohnung steht: js/main.js save/loadSave).
// Aufdecken ist GRATIS und bringt 10 Münzen: das Feld dreht sich um (.open), ein Schwarm aus 8 bis 10
// Münzen fliegt vom Feld zur Münzanzeige oben, dort erscheint „+10“ (.chip-plus) und der Zähler zählt
// hoch (.bump). Kein Münzberg und keine Belohnungsseite beim Aufdecken (Thomas, 29.10.2026).
//
// Umgedreht zeigt das Feld Bild, Name und Kaufknopf mit Preis (.btn.small.blue, ausgegraut bei zu
// wenig Geld). Nach dem Kauf steht „Öffnen“ (.btn.small.pink): Böse Sterne starten wie gewohnt
// (Stern-Bildschirm), Glücksboxen öffnen wie gewohnt, die gekaufte Rad-Drehung dreht das Rad ohne
// weitere Kosten, Upgrade/Paket und Juwelen zeigen die gewohnte Belohnungsseite. Danach „✓“.
// Ist das Upgrade eines Feldes inzwischen anderswo gekauft oder Welt-Belohnung geworden, steht
// „✓ hast du schon“ ohne Kauf.
//
// Was hinter einem Feld stecken kann (Preis bleibt, wie ihn der Coinshop schon hat):
//   · Böse Sterne   1, 2, 3 oder 5     → 💎 BAD_STAR_PRICE je Stern      (js/ui.js)
//   · Glücksboxen   1, 2, 3 oder 5     → 🪙 BOX_PRICE je Box              (js/ui-box.js)
//   · ein fehlendes kaufbares Upgrade  → 💎 upgradePrice() nach Figur     (js/upgrades.js)
//   · Upgrade-Paket: 3 fehlende kaufbare Upgrades einer Figur, Preis = 3 Upgrades dieser Figur
//   · eine Glücksrad-Drehung           → 💎 RAD_SPIN_COST                 (js/progress.js)
//   · eines der Juwelen-Angebote       → 🪙 Preis des Angebots            (js/ui.js, GEM_OFFERS)
// Das Aussehen liefert ausschließlich css/shop2.css - diese Datei ändert keine CSS-Datei.

const QFELD_ANZAHL = 10;              // zehn Felder je Tag (Thomas, 29.10.2026)
const QFELD_MUENZEN = 10;             // Münzen je Aufdecken, gratis und genau einmal je Feld
const QFELD_STERNEN = [1, 2, 3, 5];   // mögliche Zahl Böser Sterne je Feld
const QFELD_BOXEN = [1, 2, 3, 5];     // mögliche Zahl Glücksboxen je Feld

const ShopFelder = {
    ANZAHL: QFELD_ANZAHL,
    MUENZEN: QFELD_MUENZEN,

    // ── Der Stand von heute ──
    // Game.shopFelder = { date: 'JJJJ-MM-TT', felder: [ { art, n, st, ... } ] } und damit im Spielstand.
    // st: 0 = verdeckt, 1 = umgedreht (noch nicht gekauft), 2 = gekauft (wartet aufs Öffnen), 3 = ✓
    // Ein anderer Tag wirft das ganze Raster weg und zieht ein neues; unlesbare Einträge (eine spätere
    // Fassung dieser Datei) ziehen an ihrer Stelle neu. Liefert immer genau ANZAHL Felder.
    heute() {
        const tag = Game._todayKey();
        const alt = Game.shopFelder;
        const brauchbar = !!(alt && alt.date === tag && Array.isArray(alt.felder));
        const stand = brauchbar ? alt : { date: tag, felder: [] };
        let geaendert = !brauchbar;
        for (let i = 0; i < this.ANZAHL; i++) {
            if (!this._kennt(stand.felder[i])) {
                stand.felder[i] = this._ziehe();
                geaendert = true;
            }
        }
        if (stand.felder.length > this.ANZAHL) {
            stand.felder.length = this.ANZAHL;
            geaendert = true;
        }
        Game.shopFelder = stand;
        if (geaendert) Game.save();
        return stand;
    },

    // Kennt diese Datei den Eintrag? (gilt auch als Prüfung eines geladenen Spielstands)
    _kennt(it) {
        if (!it || typeof it !== 'object') return false;
        if (it.st !== 0 && it.st !== 1 && it.st !== 2 && it.st !== 3) return false;
        switch (it.art) {
            case 'stars': return QFELD_STERNEN.indexOf(it.n) >= 0;
            case 'box': return QFELD_BOXEN.indexOf(it.n) >= 0;
            case 'spin': return true;
            case 'gems': return !!(typeof GEM_OFFERS !== 'undefined' && Array.isArray(GEM_OFFERS[it.i]));
            case 'upgrade': return upgradeKnown(it.id);
            case 'pack': return !!UPGRADE_PRICES[it.fig] && Array.isArray(it.ids) &&
                it.ids.length === 3 && it.ids.every(id => upgradeKnown(id));
            default: return false;
        }
    },

    // ── Ein Feldinhalt ──
    // Was angeboten wird, steht beim Anlegen fest; nur Upgrade und Paket sind an das gebunden,
    // was in diesem Moment fehlt (Regel von Thomas: alles Fehlende ist kaufbar, Weltbelohnungen nicht).
    _ziehe() {
        const fehlend = this._fehlendeUpgrades();
        const pakete = this._pakete(fehlend);
        const moeglich = [['stars', 2], ['box', 2], ['spin', 2]];
        if (typeof GEM_OFFERS !== 'undefined' && GEM_OFFERS.length) moeglich.push(['gems', 2]);
        if (fehlend.length) moeglich.push(['upgrade', 3]);
        if (pakete.length) moeglich.push(['pack', 2]);
        const art = this._aus(moeglich)[0];
        if (art === 'stars') return { art, n: this._aus(QFELD_STERNEN), st: 0 };
        if (art === 'box') return { art, n: this._aus(QFELD_BOXEN), st: 0 };
        if (art === 'gems') return { art, i: Math.floor(Math.random() * GEM_OFFERS.length), st: 0 };
        if (art === 'pack') {
            const p = this._aus(pakete);
            return { art, fig: p.fig, ids: p.ids.slice(), st: 0 };
        }
        if (art === 'upgrade' && fehlend.length) return { art, id: this._aus(fehlend).id, st: 0 };
        return { art: 'spin', st: 0 };
    },

    _aus(liste) {
        return liste[Math.floor(Math.random() * liste.length)];
    },

    // Fehlende Extras, die man im Shop kaufen kann (Weltbelohnungen sind das nie - Regel von Leander).
    _fehlendeUpgrades() {
        return (typeof upgradesToBuy === 'function' ? upgradesToBuy(Game) : []).filter(u => upgradePrice(u) > 0);
    },

    // Figuren, für die es genau drei fehlende kaufbare Extras gibt: daraus besteht ein Upgrade-Paket
    // (Preis = drei Upgrades dieser Figur). Gibt es keine solche Figur, gibt es auch kein Paket.
    _pakete(fehlend) {
        const out = [];
        for (const h of UPGRADE_HEROES) {
            const ids = fehlend.filter(u => u.figur === h.id).map(u => u.id);
            if (ids.length >= 3) out.push({ fig: h.id, ids: ids.slice(0, 3) });
        }
        return out;
    },

    // ── Sache, Bild und Preis eines Feldes ──
    stoff(it) {
        const J = { waehrung: 'J', zeichen: '💎' };
        const M = { waehrung: 'M', zeichen: '🪙' };
        switch (it.art) {
            case 'stars': {
                const preis = BAD_STAR_PRICE * it.n;
                return { ...J, emoji: '😈', preis, name: (it.n === 1 ? '1 Böser Stern' : it.n + ' Böse Sterne') };
            }
            case 'box': {
                const preis = BOX_PRICE * it.n;
                return { ...M, emoji: '🧰', preis, name: (it.n === 1 ? 'Glücksbox' : it.n + ' Glücksboxen') };
            }
            case 'spin':
                return { ...J, emoji: '🎡', preis: RAD_SPIN_COST, name: 'Rad-Drehung' };
            case 'gems': {
                const angebot = (typeof GEM_OFFERS !== 'undefined' && GEM_OFFERS[it.i]) || [0, 0];
                return { ...M, emoji: '💎', preis: angebot[1], name: angebot[0] + ' Juwelen', anzahl: angebot[0] };
            }
            case 'upgrade': {
                const u = UPGRADE_BY_ID[it.id] || {};
                return { ...J, emoji: u.emoji || '✨', preis: upgradePrice(u), name: u.name || 'Upgrade' };
            }
            case 'pack': {
                const h = UPGRADE_HEROES.find(x => x.id === it.fig) || { name: '', emoji: '🎖️' };
                return { ...J, emoji: '🎖️', preis: 3 * (UPGRADE_PRICES[it.fig] || 0), name: 'Paket ' + h.emoji };
            }
            default:
                return { ...M, emoji: '❓', preis: 0, name: 'Feld' };
        }
    },

    // Zum Feld gehört nichts mehr, wenn sein Extra schon frei ist - anderswo gekauft oder über seine
    // Welt erreicht (Leanders Regel: Weltbelohnungen holt man in der Welt).
    _schon(it) {
        if (it.art === 'upgrade') return upgradeIsFree(it.id, Game);
        if (it.art === 'pack') return it.ids.every(id => upgradeIsFree(id, Game));
        return false;
    },

    // ── Das Raster oben im Coinshop (Aussehen: css/shop2.css) ──
    html() {
        const st = this.heute();
        const kacheln = st.felder.map((it, i) => this._kachel(it, i)).join('');
        return `<div class="section-title">Fragezeichen-Felder · jeden Tag 10 neue</div>
            <div class="q-grid">${kacheln}</div>`;
    },

    // Die Rückseite wird immer mitgezeichnet (sie ist durch backface-visibility verdeckt): das
    // Umdrehen ist danach bloß die Klasse .open und braucht kein Neuzeichnen.
    _kachel(it, i) {
        const s = this.stoff(it);
        const offen = it.st > 0;
        let fuss;
        if (it.st >= 3) fuss = '<span class="owned">✓</span>';
        else if (this._schon(it)) fuss = '<span class="owned">✓ hast du schon</span>';
        else if (it.st === 2) fuss = `<button class="btn small pink" data-act="qopen" data-i="${i}">Öffnen</button>`;
        else {
            const hat = s.waehrung === 'J' ? (Game.jewels | 0) : (Game.coins | 0);
            const kann = s.preis > 0 && hat >= s.preis;
            fuss = `<button class="btn small blue" data-act="qbuy" data-i="${i}" data-cur="${s.waehrung}" ` +
                `data-price="${s.preis}"${kann ? '' : ' disabled'}>${s.zeichen} ${s.preis}</button>`;
        }
        return `<div class="q-tile${offen ? ' open' : ''}" data-act="qtile" data-i="${i}" role="button" ` +
            `aria-label="${offen ? s.name : 'Fragezeichen-Feld ' + (i + 1)}">
            <div class="q-in">
                <div class="q-front"><b>?</b></div>
                <div class="q-back"><i>${s.emoji}</i><span>${s.name}</span>${fuss}</div>
            </div></div>`;
    },

    // ── Knöpfe (ui.js reicht unbekannte Aktionen an angemeldete Module weiter) ──
    onClick(act, btn, e) {
        const i = +btn.dataset.i;
        const st = this.heute();
        const it = st.felder[i];
        if (!it) return true;
        if (act === 'qtile') {
            if (it.st !== 0) return true;            // umgedreht: Antippen dreht nichts mehr, kostet nichts
            it.st = 1;
            Game._grantCoins(this.MUENZEN);          // gratis, genau einmal je Feld
            Game.save();
            Sound.coin();
            Game.vibrate(40);
            this._umdrehen(btn);
            this._muenzschwarm(btn);
            this._zeigeZehn();
            this._synciere();
            return true;
        }
        if (act === 'qbuy') {
            if (this.kaufen(i)) {
                Sound.coin();
                Game.vibrate(60);
                UI.flashMessage('Gekauft – jetzt „Öffnen“');
            } else if (this._schon(it)) {
                UI.flashMessage('Das hast du schon');
            } else {
                const s = this.stoff(it);
                UI.flashMessage('Nicht genug ' + (s.waehrung === 'J' ? 'Juwelen' : 'Münzen') +
                    ' – es kostet ' + s.zeichen + ' ' + s.preis);
            }
            UI.renderShop();
            return true;
        }
        if (act === 'qopen') {
            this.oeffnen(i);
            return true;
        }
        return false;
    },

    // ── Kaufen: Geld weg, die Sache selbst kommt erst beim Öffnen ──
    kaufen(i) {
        const it = this.heute().felder[i];
        if (!it || it.st !== 1 || this._schon(it)) return false;
        const s = this.stoff(it);
        if (!s.preis) return false;
        const bezahlt = s.waehrung === 'J' ? Game._spendJewels(s.preis) : Game._spendCoins(s.preis);
        if (!bezahlt) return false;
        it.st = 2;
        Game.save();
        return true;
    },

    // ── Öffnen: genau die Sache, die unter dem Feld steckte ──
    // Gibt false zurück, wenn etwas anderes noch läuft (ein angefangener Stern, eine angefangene Truhe) -
    // das Feld bleibt dann gekauft stehen und der „Öffnen“-Knopf bleibt erhalten.
    oeffnen(i) {
        const it = this.heute().felder[i];
        if (!it || it.st !== 2) return false;
        const zurueck = () => UI.renderShop();
        if (this._schon(it)) {
            this._erledigt(it);
            UI.flashMessage('Das hast du schon');
            UI.renderShop();
            return true;
        }
        if (it.art === 'stars') {
            if (Game.shopRandomStarActive) {
                UI.flashMessage('Erst den laufenden Bösen Stern zu Ende tippen');
                return false;
            }
            Game.boseStarUses = (Game.boseStarUses || 0) + it.n;
            this._erledigt(it);
            // Einer startet sofort, die übrigen liegen im Shop bereit (wie beim Paket-Kauf im Coinshop)
            if (UI.openBadStarNow(false, zurueck)) return true;
            UI.flashMessage('😈 ' + it.n + (it.n === 1 ? ' Stern' : ' Sterne') + ' im Shop bereit');
            UI.renderShop();
            return true;
        }
        if (it.art === 'box') {
            if (Progress.box) {
                UI.flashMessage('Erst die angefangene Truhe zu Ende tippen');
                return false;
            }
            for (let k = 0; k < it.n; k++) Progress.grant({ box: 0 });
            this._erledigt(it);
            if (typeof BoxUI !== 'undefined' && BoxUI.openNow(0, zurueck)) return true;
            UI.flashMessage('🧰 ' + it.n + (it.n === 1 ? ' Glücksbox' : ' Glücksboxen') + ' im Shop bereit');
            UI.renderShop();
            return true;
        }
        if (it.art === 'spin') {
            if (typeof RadUI === 'undefined' || !RadUI.geschenktOeffnen()) {
                UI.flashMessage('Das Rad ist gleich wieder da');
                return false;
            }
            this._erledigt(it);
            return true;
        }
        if (it.art === 'upgrade' || it.art === 'pack') {
            const ids = (it.art === 'upgrade' ? [it.id] : it.ids.slice())
                .filter(id => upgradeKnown(id) && !upgradeIsFree(id, Game));
            this._erledigt(it);
            if (!ids.length) {
                UI.renderShop();
                return true;
            }
            for (const id of ids) Game.boughtUpgrades[id] = true;   // derselbe Merker wie ein Kauf im Shop
            Game.save();
            this._extrasSeite(ids);
            return true;
        }
        if (it.art === 'gems') {
            const anzahl = this.stoff(it).anzahl;
            this._erledigt(it);
            Game._grantJewels(anzahl);
            Game.save();
            if (typeof BoxUI !== 'undefined' && BoxUI.showRewards([{ jewels: anzahl }], zurueck, { head: 'Coinshop' })) {
                return true;
            }
            UI.flashMessage('💎 ' + anzahl + ' Juwelen');
            UI.renderShop();
            return true;
        }
        return false;
    },

    _erledigt(it) {
        it.st = 3;
        Game.save();
    },

    // Die gewohnte Belohnungsseite für Extras: dieselbe Seite, die nach einem Bösen Stern die
    // Extra-Bilder zeigt (UI.renderStarReward) - ein Bild je Extra, Tippen führt zurück in den Shop.
    _extrasSeite(ids) {
        UI._starSparks = [];
        UI._starBoom = null;
        UI._starBusy = false;
        UI._starTier = 3;                                     // Mythisch: Randfarbe dieser Seite
        UI._starPages = [{
            kind: 'upgrade', ids: ids.slice(),
            label: ids.length === 1 ? (UPGRADE_BY_ID[ids[0]] || {}).name || 'Upgrade'
                : 'Upgrade-Paket: ' + ids.map(id => (UPGRADE_BY_ID[id] || {}).name || '').join(' · '),
        }];
        UI._starPage = 0;
        UI._starReturn = () => UI.renderShop();
        UI.renderStarReward();
    },

    // ── Aufdecken: Umdrehen, Münzschwarm, „+10“ an der Münzanzeige ──
    // Die Kachel ist der Knopf selbst (data-act="qtile" sitzt auf .q-tile).
    _umdrehen(kachel) {
        if (!kachel || !kachel.classList) return;
        kachel.classList.add('turning');                       // läuft nur die CSS-Übergangszeit
        kachel.classList.add('open');
        setTimeout(() => kachel.classList.remove('turning'), 700);
    },

    // Acht bis zehn Münzen fliegen vom Feld zur Münzanzeige oben (css/shop2.css, kein Münzberg).
    _muenzschwarm(kachel) {
        if (!kachel || !kachel.getBoundingClientRect || typeof document === 'undefined') return;
        const ziel = document.querySelector('#scr-shop .chip.coin');
        if (!ziel) return;
        const a = kachel.getBoundingClientRect();
        const b = ziel.getBoundingClientRect();
        const feld = document.createElement('div');
        feld.className = 'coin-swarm';
        let stuecke = '';
        for (let k = 0; k < 8 + Math.floor(Math.random() * 3); k++) {
            stuecke += '<i style="--x0:' + Math.round(a.left + a.width / 2) + 'px;--y0:' +
                Math.round(a.top + a.height / 2) + 'px;--x1:' + Math.round(b.left + b.width / 2) +
                'px;--y1:' + Math.round(b.top + b.height / 2) + 'px;--d:' + (k * 0.05).toFixed(2) + 's">🪙</i>';
        }
        feld.innerHTML = stuecke;
        document.body.appendChild(feld);
        setTimeout(() => feld.remove(), 1900);
    },

    // „+10“ an der Münzanzeige und der Zähler zählt hoch
    _zeigeZehn() {
        if (typeof document === 'undefined') return;
        const chip = document.querySelector('#scr-shop .chip.coin');
        if (!chip) return;
        const zahl = chip.querySelector('b');
        if (zahl) zahl.textContent = String(Game.coins | 0);
        chip.classList.remove('bump');
        void chip.offsetWidth;                                 //Animation neu starten
        chip.classList.add('bump');
        setTimeout(() => chip.classList.remove('bump'), 450);
        const plus = document.createElement('span');
        plus.className = 'chip-plus';
        plus.textContent = '+' + this.MUENZEN;
        chip.appendChild(plus);
        setTimeout(() => plus.remove(), 1600);
    },

    // Nach dem Aufdecken (ohne Neuzeichnen) dürfen die Kaufknöpfe nicht auf dem alten Stand bleiben.
    _synciere() {
        if (typeof document === 'undefined' || !UI.screens || !UI.screens.shop) return;
        for (const b of UI.screens.shop.querySelectorAll('.q-back .btn[data-price]')) {
            const hat = b.dataset.cur === 'J' ? (Game.jewels | 0) : (Game.coins | 0);
            b.disabled = hat < (+b.dataset.price || 0);
        }
    },
};

UI.register({
    onClick(act, btn, e) { return ShopFelder.onClick(act, btn, e); },
});
