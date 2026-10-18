// ── Seite „Waffen“: je Figur EIN auswählbares Upgrade für die nächste Runde (Knopf der Startseite) ──
// Die Liste der Upgrades und die Auswahl-Regeln stehen in js/upgrades.js, hier ist nur Anzeige und Antippen.
// Optik schlicht im Stil von css/progress.css - die Feinarbeit macht Claude.

const UIWaffen = {
    tab: 'mark',

    onClick(act, btn) {
        if (act === 'waffen') { this.render(); return true; }
        if (act === 'waffentab') {
            this.tab = UPGRADE_HEROES.some(h => h.id === btn.dataset.hero) ? btn.dataset.hero : 'mark';
            this.render();
            return true;
        }
        if (act === 'waffenpick') {
            // Antippen wählt für DIESE Figur an, nochmaliges Antippen wählt sie ab (Leander, 18.10.2026)
            const id = btn.dataset.id;
            const nach = Game.chooseUpgrade(id);
            const u = UPGRADE_BY_ID[id];
            if (nach === id) UI.flashMessage(u.emoji + ' ' + u.name + ' gilt für die nächste Runde');
            else if (nach === null) UI.flashMessage(u.emoji + ' ' + u.name + ' ist abgewählt');
            this.render();
            return true;
        }
        return false;
    },

    _tabBar() {
        return `<div class="wf-tabs">${UPGRADE_HEROES.map(h => {
            const n = UPGRADES.filter(u => u.figur === h.id).length;
            return `<button class="wf-tab${this.tab === h.id ? ' on' : ''}" data-act="waffentab" data-hero="${h.id}">
                <i>${h.emoji}</i><b>${h.name}</b>${n ? '' : '<s>–</s>'}</button>`;
        }).join('')}</div>`;
    },

    _card(u) {
        const frei = upgradeIsFree(u.id, Game);
        const gewaehlt = frei && Game.chosenUpgradeId(u.figur) === u.id;
        const figure = UPGRADE_HEROES.find(h => h.id === u.figur) || { name: '' };
        const cls = 'wf-card' + (frei ? (gewaehlt ? ' sel' : ' free') : ' locked');
        const state = gewaehlt
            ? '<span class="wf-state ok">✓ ausgewählt</span>'
            : (frei ? `<span class="wf-state">Antippen: gilt für die Runde (${figure.name})</span>`
                : `<span class="wf-state lock">🔒 ${u.where}</span>`);
        const inner = `<span class="wf-ico">${u.emoji}</span>
            <span class="wf-body"><b>${u.name}${u.bald ? '<i class="wf-bald">bald</i>' : ''}</b>
            <p>${u.text}</p>${state}</span>`;
        return frei
            ? `<button class="${cls}" data-act="waffenpick" data-id="${u.id}">${inner}</button>`
            : `<div class="${cls}">${inner}</div>`;
    },

    render() {
        const el = UI.screens.waffen;
        if (!el) return;
        const hero = UPGRADE_HEROES.find(h => h.id === this.tab) || UPGRADE_HEROES[0];
        const preise = UPGRADE_HEROES.map(h => `${h.name} ${UPGRADE_PRICES[h.id]}`).join(', ');
        const alle = upgradesSummaryText(Game);
        const list = UPGRADES.filter(u => u.figur === hero.id);
        const cards = list.length
            ? `<div class="wf-cards">${list.map(u => this._card(u)).join('')}</div>`
            : `<p class="wf-empty">Noch keine Upgrades – der Panda hat noch nichts geklaut.</p>`;
        const cur = Game.selectedUpgrades();
        el.innerHTML = `
            <div class="page-head">
                <button class="btn small gray" data-act="title">◀ Zurück</button>
                <h2>Waffen</h2>
                ${UI._chips()}
            </div>
            <div class="page-body">
                ${this._tabBar()}
                <p class="wf-now">${alle ? `Für die nächste Runde: <b>${alle}</b>${cur.length > 1 ? ` – ${cur.length} Extras an` : ''}`
                    : 'Kein Extra ausgewählt – nur die Grundausstattung ist an.'}</p>
                ${cards}
                <p class="wf-note">Jede Figur darf EIN Extra für die nächste Runde haben - du kannst also alle
                    vier gleichzeitig wählen. Grundausstattung ist immer an: Marks Schläger und Baseball-Werfer,
                    das Auto, Juris Hammer, das Spucken des Krokodils und die Power-Stufen.
                    In einer laufenden Runde kannst du hier nichts mehr ändern.
                    Noch gesperrte Extras, die man kaufen kann, gibt es im Shop für Juwelen (${preise}).
                    Extras mit einer Welt dahinter sind Belohnung in dieser Welt und stehen dort nicht zum Kauf.</p>
            </div>`;
        UI.show('waffen');
    },
};

UI.register({
    screens: { waffen: 'page' },
    onClick: (act, btn, e) => UIWaffen.onClick(act, btn, e),
});
