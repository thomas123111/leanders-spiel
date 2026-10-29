// ── Wochenangebote im Shop (Wunsch von Thomas und Leander, 29.10.2026) ──
// Klassische Script-Datei (kein import/export), meldet sich über UI.register bei der Oberfläche an.
// Eingehängt wird der Vorauftrag schon: UI._shopWocheHtml() ruft ShopWoche.html() (js/ui.js) - die
// Angebote stehen damit in der Abteilung „Wochenbelohnung“ über Tagesbelohnung und Glücksrad.
//
// Genau DREI Angebote je Woche, zufällig gezogen aus:
//   · Upgrade-Paket  3 fehlende kaufbare Upgrades EINER Figur → Preis = 2 Upgrades dieser Figur in 💎
//                    (gibt es für eine Figur keine drei fehlenden, gibt es in der Woche kein Paket)
//   · Juwelenberg    300 💎            → 12.000 🪙
//   · Münzenberg     2.000 🪙          →   150 💎
//   · Glücksboxen    3 Glücksboxen     → 1.000 🪙
//   · Böse Sterne    3 Böse Sterne     →   300 💎 (💎 BAD_STAR_PRICE je Stern wie sonst auch)
// Der Wochenschlüssel ist derselbe wie beim Glücksrad: Progress.radWeekKey() („JJJJ-W01“ nach ISO 8601),
// eine neue Woche zieht also neue Angebote. Alles steht im Spielstand (Game.shopWoche, js/main.js).
// Jedes Angebot ist genau einmal pro Woche kaufbar; danach steht auf der Karte „✓ diese Woche gekauft“.
// Aussehen: ganz normale Karten (.card) wie im Rest des Shops - css/shop2.css wird nicht angefasst.
//
// Nach dem Kauf kommt die gewohnte Belohnungsseite: Münzen und Juwelen als Berg (BoxUI.showRewards),
// ein Upgrade-Paket als Extra-Bild (UI.renderStarReward wie im Coinshop). Glücksboxen und Böse Sterne
// wandern in den Vorrat und lassen sich dort öffnen (dieselbe Öffnung wie beim Coinshop-Kauf).

const WOCHE_ANZAHL = 3;   // drei Angebote je Woche (Thomas, 29.10.2026)
const WOCHE_PAKET_TER = 3; // ein Upgrade-Paket sind genau drei fehlende Extras einer Figur

// Feste Preise je Angebotsart: preis = Kosten, anzahl = was man dafür bekommt, waehrung = 'J' 💎 | 'M' 🪙
const WOCHE_PREISE = {
    gems: { anzahl: 300, preis: 12000, waehrung: 'M' },   // Juwelenberg: 300 💎 für 12.000 🪙
    coins: { anzahl: 2000, preis: 150, waehrung: 'J' },   // Münzenberg: 2.000 🪙 für 150 💎
    boxes: { anzahl: 3, preis: 1000, waehrung: 'M' },     // Glücksbox-Stapel: 3 Boxen für 1.000 🪙
    stars: { anzahl: 3, preis: 300, waehrung: 'J' },      // Böse-Sterne-Paket: 3 Sterne für 300 💎
};

const ShopWoche = {
    ANZAHL: WOCHE_ANZAHL,
    PREISE: WOCHE_PREISE,

    // ── Der Stand dieser Woche ──
    // Game.shopWoche = { woche: '2026-W44', angebote: [ { art, gekauft, ... } ] } - andere Woche => neu.
    // Unlesbare Einträge (eine spätere Fassung dieser Datei oder ein fremder Spielstand) ziehen an ihrer
    // Stelle neu. Liefert immer genau ANZAHL Angebote.
    angebote() {
        const woche = this._wocheSchluessel();
        const alt = Game.shopWoche;
        const brauchbar = !!(alt && alt.woche === woche && Array.isArray(alt.angebote) &&
            alt.angebote.length <= this.ANZAHL && this._kenntAlle(alt.angebote) &&
            new Set(alt.angebote.map(it => it && it.art)).size === alt.angebote.length);
        const stand = brauchbar ? alt : { woche, angebote: [] };
        let geaendert = !brauchbar;
        const moeglich = this._moeglich();
        while (stand.angebote.length < this.ANZAHL) {
            const freie = moeglich.filter(a => !this._hat(stand, a));
            stand.angebote.push(this._ziehe(this._aus(freie)));
            geaendert = true;
        }
        Game.shopWoche = stand;
        if (geaendert) Game.save();
        return stand;
    },

    _kenntAlle(liste) {
        return liste.every(it => this._kennt(it));
    },

    _hat(stand, art) {
        return stand.angebote.some(it => it && it.art === art);
    },

    // Der Wochenschlüssel vom Glücksrad (js/progress.js); ohne das Rad zählt der Tag.
    _wocheSchluessel() {
        if (typeof Progress !== 'undefined' && Progress && typeof Progress.radWeekKey === 'function') {
            return Progress.radWeekKey();
        }
        return Game._todayKey();
    },

    // Kennt diese Datei den Eintrag? (gilt auch als Prüfung eines geladenen Spielstands)
    _kennt(it) {
        if (!it || typeof it !== 'object' || typeof it.gekauft !== 'boolean') return false;
        switch (it.art) {
            case 'gems': case 'coins': case 'boxes': case 'stars': return true;
            case 'pack': {
                if (!UPGRADE_PRICES[it.fig] || !Array.isArray(it.ids) || it.ids.length !== WOCHE_PAKET_TER) return false;
                if (new Set(it.ids).size !== WOCHE_PAKET_TER) return false;   // dreimal dasselbe Extra ist keins
                return it.ids.every(id => upgradeKnown(id) && !isWorldReward(UPGRADE_BY_ID[id]) &&
                    UPGRADE_BY_ID[id].figur === it.fig);
            }
            default: return false;
        }
    },

    // ── Was diese Woche im Los sitzt ──
    // Das Paket ist nur im Los, wenn es überhaupt drei fehlende kaufbare Upgrades einer Figur gibt.
    _moeglich() {
        const out = ['gems', 'coins', 'boxes', 'stars'];
        if (this._pakete().length) out.push('pack');
        return out;
    },

    _ziehe(art) {
        if (art === 'pack' && this._pakete().length) {
            const p = this._aus(this._pakete());
            return { art, fig: p.fig, ids: p.ids.slice(), gekauft: false };
        }
        return { art: (art && art !== 'pack') ? art : 'coins', gekauft: false };
    },

    _aus(liste) {
        return liste[Math.floor(Math.random() * liste.length)];
    },

    // Fehlende Extras, die man im Shop kaufen kann (Weltbelohnungen sind das nie - Leanders Regel).
    _fehlendeUpgrades() {
        return (typeof upgradesToBuy === 'function' ? upgradesToBuy(Game) : []).filter(u => upgradePrice(u) > 0);
    },

    // Figuren mit mindestens drei fehlenden kaufbaren Extras: daraus besteht ein Upgrade-Paket
    // (Preis = zwei Upgrades dieser Figur, Thomas 29.10.2026). Gibt es keine solche Figur, kein Paket.
    _pakete() {
        const fehlend = this._fehlendeUpgrades();
        const out = [];
        for (const h of UPGRADE_HEROES) {
            const ids = fehlend.filter(u => u.figur === h.id).map(u => u.id);
            if (ids.length >= 3) out.push({ fig: h.id, ids: ids.slice(0, 3) });
        }
        return out;
    },

    // ── Sache, Bild und Preis eines Angebots ──
    stoff(it) {
        const J = { waehrung: 'J', zeichen: '💎' };
        const M = { waehrung: 'M', zeichen: '🪙' };
        switch (it.art) {
            case 'gems':
                return { ...M, emoji: '💎', preis: WOCHE_PREISE.gems.preis, anzahl: WOCHE_PREISE.gems.anzahl,
                    name: 'Juwelenberg', text: WOCHE_PREISE.gems.anzahl + ' Juwelen für ' +
                        WOCHE_PREISE.gems.preis + ' Münzen – günstiger als im Coinshop.' };
            case 'coins':
                return { ...J, emoji: '🪙', preis: WOCHE_PREISE.coins.preis, anzahl: WOCHE_PREISE.coins.anzahl,
                    name: 'Münzenberg', text: WOCHE_PREISE.coins.anzahl + ' Münzen für ' +
                        WOCHE_PREISE.coins.preis + ' Juwelen – günstiger als in der Wechselstube.' };
            case 'boxes':
                return { ...M, emoji: '🧰', preis: WOCHE_PREISE.boxes.preis, anzahl: WOCHE_PREISE.boxes.anzahl,
                    name: 'Glücksbox-Stapel', text: '3 Glücksboxen für ' + WOCHE_PREISE.boxes.preis +
                        ' Münzen – die dritte ist geschenkt.' };
            case 'stars':
                return { ...J, emoji: '😈', preis: WOCHE_PREISE.stars.preis, anzahl: WOCHE_PREISE.stars.anzahl,
                    name: 'Böse-Sterne-Paket', text: '3 Böse Sterne für ' + WOCHE_PREISE.stars.preis +
                        ' Juwelen – auf Vorrat, jederzeit zu öffnen.' };
            case 'pack': {
                const h = UPGRADE_HEROES.find(x => x.id === it.fig) || { name: '', emoji: '🎖️' };
                return { ...J, emoji: '🎖️', preis: 2 * (UPGRADE_PRICES[it.fig] || 0), anzahl: 3,
                    name: 'Upgrade-Paket ' + h.name,
                    text: '3 Upgrades von ' + h.name + ' für den Preis von zweien.' };
            }
            default:
                return { ...M, emoji: '🎁', preis: 0, anzahl: 0, name: 'Wochenangebot', text: '' };
        }
    },

    // Zum Paket gehört nichts mehr, wenn NICHT genau drei seiner Extras noch fehlen (bestellt sind drei
    // FEHLENDE Upgrades). Wer schon eines hat, bekäme sonst für den Zweier-Preis zu wenig geliefert.
    _schon(it) {
        return it.art === 'pack' && it.ids.filter(id => !upgradeIsFree(id, Game)).length < WOCHE_PAKET_TER;
    },

    // ── Die drei Karten oben in der Abteilung Wochenbelohnung ──
    html() {
        const st = this.angebote();
        const karten = st.angebote.map((it, i) => this._karte(it, i)).join('');
        return `<div class="section-title">Wochenangebote · drei je Woche, jedes einmal</div>${karten}`;
    },

    _karte(it, i) {
        const s = this.stoff(it);
        const farben = { gems: '#39d5ff', coins: '#ffd23f', boxes: '#b26bff', stars: '#ff5f5f', pack: '#ff9f2e' };
        let fuss;
        if (it.gekauft) fuss = '<span class="owned">✓ diese Woche gekauft</span>';
        else if (this._schon(it)) fuss = '<span class="owned">✓ hast du schon</span>';
        else {
            const hat = s.waehrung === 'J' ? (Game.jewels | 0) : (Game.coins | 0);
            const kann = s.preis > 0 && hat >= s.preis;
            fuss = `<button class="btn small blue" data-act="wochebuy" data-i="${i}"${kann ? '' : ' disabled'}>` +
                `${s.zeichen} ${s.preis}</button>` +
                `<span class="up-hint">${kann ? 'einmal pro Woche' : 'noch ' + (s.preis - hat) + ' ' +
                    (s.waehrung === 'J' ? 'Juwelen' : 'Münzen') + ' zu wenig'}</span>`;
        }
        return `<div class="card" style="--a:${farben[it.art] || '#3ddc97'}">
            <div class="head"><span class="ico">${s.emoji}</span><div><h3>${s.name}</h3>
            <p>${s.text}</p></div></div>
            <div class="foot">${fuss}</div></div>`;
    },

    // ── Kaufen (ui.js reicht unbekannte Aktionen an angemeldete Module weiter) ──
    onClick(act, btn) {
        if (act !== 'wochebuy') return false;
        const i = +btn.dataset.i;
        const it = this.angebote().angebote[i];
        if (!it) return true;
        if (this.kaufen(i)) {
            Sound.coin();
            Game.vibrate(60);
            this._belohnung(it);
            return true;
        }
        // Genau eine Meldung je Grund - die Reihenfolge ist die der Kaufprüfung selbst
        if (it.gekauft) UI.flashMessage('Das Angebot hast du diese Woche schon gekauft');
        else if (this._schon(it)) UI.flashMessage('Das hast du schon');
        else if (it.art === 'pack' && upgradePurchaseBlocked(Game)) {
            UI.flashMessage('Upgrades kaufst du erst, wenn die Runde zu Ende ist');
            UI.renderShop();
        } else {
            const s = this.stoff(it);
            UI.flashMessage('Nicht genug ' + (s.waehrung === 'J' ? 'Juwelen' : 'Münzen') +
                ' – es kostet ' + s.zeichen + ' ' + s.preis);
            UI.renderShop();
        }
        return true;
    },

    // Kaufen: Geld weg, Merker „diese Woche gekauft“ (ein zweiter Kauf geht nie), dann die Belohnung.
    // Liefert false ohne jede Wirkung - welche Meldung passt, entscheidet onClick in einer einzigen Kette.
    kaufen(i) {
        const it = this.angebote().angebote[i];
        if (!it || it.gekauft || this._schon(it)) return false;
        if (it.art === 'pack' && upgradePurchaseBlocked(Game)) return false;
        const s = this.stoff(it);
        if (!s.preis) return false;
        const bezahlt = s.waehrung === 'J' ? Game._spendJewels(s.preis) : Game._spendCoins(s.preis);
        if (!bezahlt) return false;
        it.gekauft = true;
        Game.save();
        return true;
    },

    // ── Die gewohnte Belohnungsseite nach dem Kauf ──
    _belohnung(it) {
        const zurueck = () => UI.renderShop();
        const s = this.stoff(it);
        if (it.art === 'gems') {
            Game._grantJewels(s.anzahl);
            Game.save();
            this._berg([{ jewels: s.anzahl }], 'Juwelenberg', zurueck);
            return true;
        }
        if (it.art === 'coins') {
            Game._grantCoins(s.anzahl);
            Game.save();
            this._berg([{ coins: s.anzahl }], 'Münzenberg', zurueck);
            return true;
        }
        if (it.art === 'boxes') {
            for (let k = 0; k < s.anzahl; k++) Progress.grant({ box: 0 });
            // Eine geht sofort auf, die übrigen bleiben im Vorrat und lassen sich dort öffnen
            if (typeof BoxUI !== 'undefined' && BoxUI.openNow(0, zurueck)) return true;
            UI.flashMessage('🧰 ' + s.anzahl + ' Glücksboxen im Vorrat – im Coinshop zu öffnen');
            UI.renderShop();
            return true;
        }
        if (it.art === 'stars') {
            // Erst der Vorrat, dann die Öffnung: ein noch laufender Böser Stern darf ein bezahltes
            // Angebot nicht schlucken (dieselbe Reihenfolge wie der Sternen-Kauf im Coinshop).
            Game.boseStarUses = (Game.boseStarUses || 0) + s.anzahl;
            Game.save();
            if (!Game.shopRandomStarActive && UI.openBadStarNow && UI.openBadStarNow(false, zurueck)) return true;
            UI.flashMessage('😈 ' + s.anzahl + ' Böse Sterne im Vorrat – gleich zu öffnen');
            UI.renderShop();
            return true;
        }
        if (it.art === 'pack') {
            const ids = it.ids.filter(id => upgradeKnown(id) && !upgradeIsFree(id, Game));
            if (!ids.length) {
                UI.flashMessage('Das hast du schon');
                UI.renderShop();
                return true;
            }
            for (const id of ids) Game.boughtUpgrades[id] = true;   // derselbe Merker wie ein Kauf im Shop
            Game.save();
            this._extrasSeite(ids);
            return true;
        }
        UI.renderShop();
        return false;
    },

    // Münz- und Juwelenberg: derselbe Seitenweg wie bei Tages- und Weltbelohnung (js/ui-box.js).
    _berg(items, kopf, zurueck) {
        if (typeof BoxUI !== 'undefined' && BoxUI.showRewards && BoxUI.showRewards(items, zurueck, { head: kopf })) {
            return true;
        }
        const s = items[0];
        UI.flashMessage((s.jewels ? '💎 ' + s.jewels + ' Juwelen' : '🪙 ' + s.coins + ' Münzen'));
        UI.renderShop();
        return false;
    },

    // Die gewohnte Belohnungsseite für Extras: dieselbe Seite, die nach einem Bösen Stern die
    // Extra-Bilder zeigt (UI.renderStarReward) - Tippen führt zurück in den Shop.
    _extrasSeite(ids) {
        UI._starSparks = [];
        UI._starBoom = null;
        UI._starBusy = false;
        UI._starTier = 3;                                     // Mythisch: Randfarbe dieser Seite
        UI._starPages = [{
            kind: 'upgrade', ids: ids.slice(),
            label: 'Upgrade-Paket: ' + ids.map(id => (UPGRADE_BY_ID[id] || {}).name || '').join(' · '),
        }];
        UI._starPage = 0;
        UI._starReturn = () => UI.renderShop();
        UI.renderStarReward();
    },
};

UI.register({
    onClick(act, btn, e) { return ShopWoche.onClick(act, btn, e); },
});
