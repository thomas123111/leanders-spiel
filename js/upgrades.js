// ── Auswählbare Upgrades: die Liste dahinter und die Auswahl für genau eine Runde (Knopf „Waffen“) ──
// Regel von Leander (12.10.2026): Die Grundausstattung (Schläger, Baseball-Werfer, Auto, Juris Hammer,
// das Spucken des Krokodils, Power-Stufen) ist immer an.
// Regel von Leander (18.10.2026, ersetzt „pro Runde genau EINS“): PRO FIGUR höchstens EIN Extra - Mark,
// Juri, Schattenkrokodil und Panda können also gleichzeitig je ein Extra haben. Antippen auf der
// Waffen-Seite wählt für diese Figur an, nochmaliges Antippen wählt ab. In einer laufenden Runde
// lässt sich nichts mehr ändern - js/main.js legt die Auswahl beim Weltstart für die Runde fest.
// Spätere Aufträge hängen hier einfach weitere Einträge an und fragen in js/main.js Game.upgradeOn(id) ab.
// Regel von Leander (18.10.2026): Einträge mit `welt: <Nummer>` sind Belohnungen einer Welt und damit
// NICHT im Shop kaufbar (upgradesToBuy() und buyUpgrade() halten sich daran). tripleShot (Böser Stern)
// hat kein `welt` und bleibt kaufbar. Wer etwas schon hat, behält es natürlich.
// Preise, Kauf und Freiheitsprüfung stehen weiter unten in dieser Datei, die Shop-Seite in js/ui.js zeigt sie nur.

const UPGRADE_HEROES = [
    { id: 'mark', name: 'Mark', emoji: '🧢', farbe: '#ffd23f' },
    { id: 'juri', name: 'Juri', emoji: '🔨', farbe: '#ff9f2e' },
    { id: 'croc', name: 'Schattenkrokodil', emoji: '🐊', farbe: '#4fd46a' },
    { id: 'panda', name: 'Panda', emoji: '🐼', farbe: '#8ab4ff' },
];

// figur: 'mark' | 'juri' | 'croc' | 'panda'
// istFrei(game): frei, sobald der Merker gesetzt ist ODER die Welt erreicht wurde, die es früher automatisch gab
// where: Hinweis, wo man das Upgrade bekommt (steht auf der gesperrten Karte)
// welt:  <Nummer> = Belohnung dieser Welt, deshalb NICHT im Shop kaufbar (Regel von Leander, 18.10.2026)
// bald: ein Eintrag ist nur Vorbereitet, die Wirkung baut ein späterer Auftrag (heute hat keines mehr)
const UPGRADES = [
    // ── Mark ──
    { id: 'tripleShot', figur: 'mark', name: 'Schnell-Wurf', emoji: '⚡',
        text: 'Mark wirft seine Bälle viel schneller hintereinander.',
        where: 'Bösen Stern „Scharf“ im Shop',
        istFrei: g => !!g.unlockedTripleShot },
    { id: 'shadowCaster', figur: 'mark', name: 'Schatten-Werfer', emoji: '🌈',
        text: 'Marks Bälle schleudern Schatten hinterher und machen mehr Schaden.',
        where: 'Welt 9 schaffen',
        welt: 9,
        istFrei: g => !!g.unlockedShadowCaster || g.maxWorldUnlocked >= 10 },
    { id: 'gamerPistol', figur: 'mark', name: 'Gamer-Pistole', emoji: '🔫',
        text: 'Mark schießt die Gamer-Pistole: deutlich mehr Schaden pro Schuss.',
        where: 'Welt 11 schaffen',
        welt: 11,
        istFrei: g => !!g.unlockedGamerPistol || g.maxWorldUnlocked >= 12 },
    { id: 'fruit', figur: 'mark', name: 'Obst-Upgrades', emoji: '🍊',
        text: 'Orangen-Explosion bei Treffern. Juri und Krokodil werfen auch mit Obst.',
        where: 'Welt 10 schaffen',
        welt: 10,
        istFrei: g => !!g.unlockedFruitUpgrades },
    { id: 'boneBat', figur: 'mark', name: 'Knochen-Schläger', emoji: '🦴',
        text: 'Marks Schläger haut mit dem Knochen kräftiger zu.',
        where: 'Welt 13 schaffen',
        welt: 13,
        istFrei: g => !!g.unlockedBoneBat },
    { id: 'petrifyStone', figur: 'mark', name: 'Stein-Gift', emoji: '🪨',
        text: 'Treffer verwandeln Gegner manchmal kurz in Stein.',
        where: 'Welt 15 schaffen',
        welt: 15,
        istFrei: g => !!g.unlockedPetrifyStone },
    { id: 'snake', figur: 'mark', name: 'Schlangen-Freund', emoji: '🐍',
        text: 'Eine kleine Schlange sitzt auf Marks Schulter und spuckt Gift.',
        where: 'Welt 14 schaffen',
        welt: 14,
        istFrei: g => !!g.unlockedSnakeCompanion },
    { id: 'crown', figur: 'mark', name: 'Goldene Krone', emoji: '👑',
        text: 'Die Krone startet die Runde mit einem schützenden Schild.',
        where: 'Welt 4 schaffen oder 500 🪙 im Shop',
        welt: 4,
        istFrei: g => !!g.unlockedCrown },
    { id: 'laserBalls', figur: 'mark', name: 'Baseball-Laserkugeln', emoji: '🔮',
        text: 'Marks Werfer schießt leuchtende Laser-Baseballs: schneller als Bälle und durch bis zu drei Gegner hindurch.',
        where: 'Welt 45 schaffen',
        welt: 45,
        istFrei: g => !!g.unlockedLaserBalls },
    { id: 'boomBall', figur: 'mark', name: 'Knallball', emoji: '💥',
        text: 'Marks Würfe knallen beim Aufprall und treffen alle Gegner im Umkreis - auch hinter Ecken.',
        where: 'Welt 46 schaffen',
        welt: 46,
        istFrei: g => !!g.unlockedBoomBall },
    { id: 'iceBall', figur: 'mark', name: 'Eisball', emoji: '❄️',
        text: 'Getroffene Gegner frieren zwei Sekunden ein und können sich nicht bewegen. Bosse halten nur 0,6 Sekunden dicht.',
        where: 'Welt 48 schaffen',
        welt: 48,
        istFrei: g => !!g.unlockedIceBall },
    // ── Juri ──
    { id: 'juriFireCircle', figur: 'juri', name: 'Feuerkreis', emoji: '🔥',
        text: 'Juri zündet um sich herum einen brennenden Kreis an.',
        where: 'Ab Welt 8 dabei',
        welt: 8,
        istFrei: g => g.maxWorldUnlocked >= 8 },
    { id: 'juriIceHammer', figur: 'juri', name: 'Eishammer', emoji: '🧊',
        text: 'Juris Hammerschläge frieren Gegner ein, und der Hammer sieht eisig aus. Für Bosse gilt dasselbe wie beim Eisball.',
        where: 'Welt 50 schaffen',
        welt: 50,
        istFrei: g => !!g.unlockedIceHammer },
    // ── Schattenkrokodil ──
    { id: 'crocFire', figur: 'croc', name: 'Feuerschüsse', emoji: '🎇',
        text: 'Die Schüsse des Krokodils explodieren in Feuer.',
        where: 'Ab Welt 9 dabei',
        welt: 9,
        istFrei: g => g.maxWorldUnlocked >= 9 },
    { id: 'crocShadowCloud', figur: 'croc', name: 'Schattenwolke', emoji: '🌑',
        text: 'Alle 12 Sekunden legt das Krokodil eine dunkle Wolke um Mark. Solange er darin steht, suchen ihn die Gegner woanders.',
        where: 'Welt 49 schaffen',
        welt: 49,
        istFrei: g => !!g.unlockedShadowCloud },
];

const UPGRADE_BY_ID = {};
for (const u of UPGRADES) UPGRADE_BY_ID[u.id] = u;

// ── Kaufen im Shop ──
// Preis in Juwelen je Figur (Wunsch von Leander, 12.10.2026): Mark 850, Juri 500, Schattenkrokodil 450,
// Panda 350. Hier und sonst nirgends ändern - die Shop-Seite holt sich den Preis über upgradePrice().
// Ein gekauftes Extra bekommt einen eigenen Merker (Game.boughtUpgrades, im Spielstand) und gilt danach
// auf der Seite „Waffen" als frei. Die Belohnungen aus den Welten bleiben davon unberührt.
const UPGRADE_PRICES = { mark: 850, juri: 500, croc: 450, panda: 350 };

// Juwelenpreis eines Eintrags (0 bei einem Eintrag, den diese Liste nicht kennt)
function upgradePrice(u) {
    return (u && UPGRADE_PRICES[u.figur]) || 0;
}

// Belohnung einer Welt? Die gibt es nur in dieser Welt und NIEMALS im Shop (Regel von Leander, 18.10.2026).
function isWorldReward(u) {
    return !!(u && u.welt);
}

// In einer laufenden Runde kauft man nichts (dieselbe Grenze wie beim Auswählen auf der Waffen-Seite).
function upgradePurchaseBlocked(g) {
    return !!g && (g.roundUpgradeSet || g.state === 'PLAYING');
}

// Die Einträge, die man noch nicht hat und im Shop kaufen kann (Reihenfolge der Liste).
// Weltbelohnungen (Eintrag hat `welt`) fallen raus - die gibt es nur über ihre Welt (Leander, 18.10.2026).
function upgradesToBuy(g) {
    return UPGRADES.filter(u => !isWorldReward(u) && !upgradeIsFree(u.id, g));
}

// Kennt diese Liste den Eintrag? (gebraucht, wenn ein alter Spielstand ein Upgrade wiederbringt)
// hasOwnProperty statt bloßem Indexieren: ein ausgedachter Schluessel wie "__proto__" oder "constructor"
// kommt sonst als geerbtes Objekt vom Objektbau und würde als bekannt durchgehen.
function upgradeKnown(id) { return Object.prototype.hasOwnProperty.call(UPGRADE_BY_ID, id); }

// Frei im Sinn der Waffen-Seite: Eintrag bekannt, und die Bedingung ist erfüllt -
// erfüllt heißt: über die Welt erreicht ODER im Shop für Juwelen gekauft.
function upgradeIsFree(id, g) {
    const u = UPGRADE_BY_ID[id];
    if (!u || !g) return false;
    if (g.hasBoughtUpgrade && g.hasBoughtUpgrade(id)) return true;
    try { return !!u.istFrei(g); } catch (e) { return false; }
}

// Die Zeile „Für die nächste Runde: …“ (Steht auf der Startseite und im Menü „Waffen“): alle
// gewählten Extras mit ihrer Figur, getrennt durch · . Liefert '' wenn keines gewählt ist.
function upgradesSummaryText(g) {
    if (!g || typeof g.selectedUpgrades !== 'function') return '';
    return g.selectedUpgrades().map(u => {
        const h = UPGRADE_HEROES.find(x => x.id === u.figur);
        return u.emoji + ' ' + u.name + (h ? ' (' + h.name + ')' : '');
    }).join(' · ');
}

// ── Auswahl im Spiel: je Figur ein Extra; in der laufenden Runde gelten die festgelegten Extras ──
// Pro Figur höchstens EIN Extra (Leander, 18.10.2026) - die vier Figuren können gleichzeitig je eins haben.
Object.assign(Game, {
    activeUpgrades: {},      // je Figur das dauerhaft gewählte Extra (figur -> Id, im Spielstand)
    roundUpgrades: {},       // beim Weltstart festgelegte Extras (figur -> Id), in der Runde unveränderlich
    roundUpgradeSet: false,  // true, solange eine Runde läuft (auch wenn kein Extra gewählt wurde)
    boughtUpgrades: {},      // im Shop für Juwelen gekaufte Extras (Id -> true, im Spielstand)

    // Wird das Extra über den Kauf-Merker gehalten? (wieder hasOwnProperty: "__proto__" ist kein Kauf)
    hasBoughtUpgrade(id) { return !!id && Object.prototype.hasOwnProperty.call(this.boughtUpgrades, id); },

    // Im Shop für Juwelen kaufen: Preis nach Figur, Geld nur bei wirklich fehlenden Extras.
    // Liefert true, wenn das Extra danach frei ist. In einer laufenden Runde geht nichts, und
    // Weltbelohnungen (Eintrag hat `welt`) stehen im Shop gar nicht erst zum Verkauf.
    buyUpgrade(id) {
        const u = UPGRADE_BY_ID[id];
        const price = upgradePrice(u);
        if (!u || !price || isWorldReward(u) || upgradePurchaseBlocked(this) || upgradeIsFree(id, this)) return false;
        if (!this._spendJewels(price)) return false;
        this.boughtUpgrades[id] = true;
        this.save();
        return true;
    },

    // Id des gewählten Extras einer Figur (oder null) - in der laufenden Runde das festgelegte.
    chosenUpgradeId(figur) {
        if (!figur) return null;
        const map = this.roundUpgradeSet ? this.roundUpgrades : this.activeUpgrades;
        return map[figur] || null;
    },

    // Das Extra einer Figur, das gerade zählt - oder null. Die Freiheitsprüfung sitzt hier mit
    // drin: ein aus einem alten oder veränderten Spielstand gekipptes Extra wird weder angezeigt
    // noch wirkt es.
    selectedUpgrade(figur) {
        const id = this.chosenUpgradeId(figur);
        return upgradeIsFree(id, this) ? UPGRADE_BY_ID[id] : null;
    },

    // Alle gewählten Extras (in der Runde die festgelegten) in der Reihenfolge der Figuren.
    selectedUpgrades() {
        const out = [];
        for (const h of UPGRADE_HEROES) {
            const u = this.selectedUpgrade(h.id);
            if (u) out.push(u);
        }
        return out;
    },

    // Fragt die Wirkungstellen in js/main.js ab: gilt das Extra mit dieser Id gerade?
    // Es gilt über die Figur, zu der der Eintrag gehört (deshalb braucht jede Figur ihr eigenes Extra).
    upgradeOn(id) {
        const u = UPGRADE_BY_ID[id];
        if (!u) return false;
        const s = this.selectedUpgrade(u.figur);
        return !!s && s.id === id;
    },

    // An- und abtippen auf der Waffen-Seite: wählt für DIESE Figur an oder ab, die anderen Figuren
    // bleiben, wie sie sind. In einer laufenden Runde geht nichts. Gibt das zurück, was für die
    // Figur jetzt gewählt ist (Id oder null).
    chooseUpgrade(id) {
        if (this.roundUpgradeSet) return null;
        const u = UPGRADE_BY_ID[id];
        if (!u || !upgradeIsFree(id, this)) return null;
        if (this.activeUpgrades[u.figur] === u.id) delete this.activeUpgrades[u.figur];
        else this.activeUpgrades[u.figur] = u.id;
        this.save();
        return this.activeUpgrades[u.figur] || null;
    },

    // Beim Weltstart für die ganze Runde festhalten: jedes gewählte Extra seiner Figur.
    lockRoundUpgrade() {
        const fest = {};
        for (const h of UPGRADE_HEROES) {
            const u = this.selectedUpgrade(h.id);
            if (u) fest[h.id] = u.id;
        }
        this.roundUpgrades = fest;
        this.roundUpgradeSet = true;
    },

    // Zurück im Menü: die Auswahl ist wieder frei
    unlockRoundUpgrade() {
        this.roundUpgradeSet = false;
        this.roundUpgrades = {};
        this.roundHooks = null;   // die Haken der alten Runde dürfen nicht nachlaufen
    },
});

// ══════════════════════════════════════════════════════════════════════════
// ── Das Upgrade-Gerüst (B0, 13.10.2026) ──
// Spätere Aufträge tragen ihr Upgrade NUR in ihrer eigenen Datei ein
// (js/upgrades-mark.js, -juri.js, -croc.js, -panda.js) und fassen keinen
// Figuren-Code an. Zwei Stücke gehören dazu:
//  1. registerUpgrade(eintrag)  - hängt einen Eintrag an UPGRADES/UPGRADE_BY_ID an.
//     Shop, Menü „Waffen" und Spielstand lesen diese Listen und sehen solche
//     Einträge deshalb automatisch (auch kaufen und auswählen).
//  2. Die Ereignis-Haken - je Figur ein Objekt `hooks` mit leeren Funktions-
//     listen und Game.roundHooks für die ganze Runde. Ein Upgrade meldet seine
//     Funktionen beim Weltstart in `apply(c)` darin an; die Figuren und js/main.js
//     lösen sie aus. Ein fehlerhaftes Upgrade hält das Spiel nie an: jeder
//     Aufruf läuft in sicherem Schutz (dispatchHooks).
// Dazu die gemeinsamen Helfer (Flächenschaden, Wegschubsen, Verlangsamen,
// zeitweiliger Begleiter), damit jedes Upgrade dasselbe Rad nicht neu erfindet.
// ══════════════════════════════════════════════════════════════════════════

// Die Haken, die eine Figur beim Weltstart vorfindet (leere Listen).
// mark darf zusätzlich onMeleeHit, onProjectileHit, onThrow, onDodge und onKill.
const HOOK_EVENTS = {
    mark: ['onUpdate', 'onMeleeHit', 'onProjectileHit', 'onThrow', 'onDodge', 'onDamaged', 'onKill', 'onDraw'],
    juri: ['onUpdate', 'onHit', 'onShoot', 'onDamaged', 'onDraw'],
    croc: ['onUpdate', 'onHit', 'onShoot', 'onDamaged', 'onDraw'],
    panda: ['onUpdate', 'onHit', 'onShoot', 'onDamaged', 'onDraw'],
};

// ── interner Zustand der Haken-Auslösung ──
const hookRuns = new Set();  // läuft gerade "(figur)|onX" auf? (Schutz gegen endlose Rückruf-Ketten)
const hookPending = [];      // Haken, die mitten in einer Auslösung erneut gewünscht wurden
let hookRunDepth = 0;        // Tiefe der äußeren Auslösung
let hookDraining = false;    // die nachgeholten Haken laufen gerade (ein einziger Stapel, keine Rekursion)
let hookZaehler = 0;         // vergibt die eigene Nummer jeder Haken-Liste
let hookErrorCount = 0;      // wie oft ein Upgrade-Haken schon daneben ging
const hookMeldeBudget = { haken: 5, sicherheit: 5 };   // Meldungen je Art, damit die Konsole voll bleibt
const HOOK_NACHHOL_RUNDEN = 8;   // höchstens so viele Nachhol-Runden, dann ist die Kette kappt

// Ein Fehler im Upgrade-Code wird gezählt und nur die ersten paar Male gemeldet, damit ein
// kaputtes Upgrade die Konsole nicht zumüllt. Schutz-Meldungen ("Kette gekappt", "Liste voll")
// haben ein eigenes Budget - sie dürfen nicht hinter fünf gewöhnlichen Hakenfehlern verschwinden.
function hookProblem(where, e, sicherheit) {
    hookErrorCount++;
    const art = sicherheit ? 'sicherheit' : 'haken';
    if (typeof console !== 'undefined' && console.error && hookMeldeBudget[art] > 0) {
        hookMeldeBudget[art]--;
        console.error('Upgrade-Haken' + (where ? ' ' + where : '') + ':', e && e.message ? e.message : e);
    }
}

// Leere Haken-Listen für eine Figur anlegen (von den Figuren in deren Baukasten aufgerufen).
// Gibt das (bestehende) hooks-Objekt zurück.
function setupHooks(figure, figur) {
    if (!figure) return null;
    if (!figure.hooks || typeof figure.hooks !== 'object') figure.hooks = {};
    const names = HOOK_EVENTS[figur] || HOOK_EVENTS.panda;
    for (const name of names) {
        if (!Array.isArray(figure.hooks[name])) figure.hooks[name] = [];
    }
    figure.hooks.figur = figur;
    figure.hooks._nr = ++hookZaehler;   // eigene Nummer: zwei Figuren derselben Art teilen sich nichts
    return figure.hooks;
}

// Einen Haken auslösen: alle angemeldeten Funktionen der Figur, jede in sicherem Schutz.
// figur = das Objekt mit .hooks, oder null für die Runden-Haken (Game.roundHooks).
// args  = die Argumente des Ereignisses (z. B. [gegner] beim Hammerschlag oder [dt]).
// value (bei onDamaged/onHit): die aktuelle Menge - sie hängt sich hintenan an die Argumente
// (onHit bekommt also (gegner, schaden), onDamaged die Menge). Gibt eine Funktion eine Zahl
// zurück, wirkt die weiter: der letzte Zahlenwert zählt.
function dispatchHooks(figur, name, args, value) {
    const besitzer = figur ? figur.hooks : Game.roundHooks;
    const hooks = besitzer && besitzer[name];
    if (!hooks || !hooks.length) return value;
    const key = (besitzer ? (besitzer._nr || besitzer.figur || 'objekt') : 'runde') + '|' + name;
    if (hookRuns.has(key)) {   // Rückruf-Kette: nicht wiederholt aufrufen, nach dem outersten Lauf nachholen
        if (hookPending.length < 16) hookPending.push({ figur, name, args, value });
        else hookProblem('Nachhole-Liste voll', new Error(name), true);
        return value;
    }
    const aeussersterLauf = hookRunDepth === 0;
    hookRuns.add(key);
    hookRunDepth++;
    try {
        for (const fn of hooks.slice()) {
            try {
                const out = value === undefined ? fn(...args) : fn(...args, value);
                if (typeof out === 'number' && Number.isFinite(out)) value = out;
            } catch (e) {
                hookProblem(((figur && figur.constructor && figur.constructor.name) || (besitzer && besitzer.figur) || 'Runde') + '.' + name, e);
            }
        }
    } finally {
        hookRuns.delete(key);
        hookRunDepth--;
    }
    // Nachholen: schleife (kein rekursiver Aufruf), damit eine Kette - etwa ein onShoot-Haken,
    // der selbst companionShoot benutzt - den Stapel nicht sprengen kann. Die Rückgabewerte
    // nachgeholter Mengen-Haken wirken nicht mehr (der Schaden ist da schon verrechnet).
    if (aeussersterLauf && !hookDraining) holHakenNach();
    return value;
}

// Die während der laufenden Auslösung gewünschten Haken abarbeiten - höchstens
// HOOK_NACHHOL_RUNDEN Runden, dann ist die Kette kappt und meldet sich.
function holHakenNach() {
    if (!hookPending.length) return;
    hookDraining = true;
    let runden = 0;
    try {
        while (hookPending.length) {
            if (++runden > HOOK_NACHHOL_RUNDEN) {
                hookProblem('Kette gekappt', new Error(hookPending.length + ' Hakenwünsche'), true);
                hookPending.length = 0;
                break;
            }
            const spaeter = hookPending.splice(0, hookPending.length);
            for (const p of spaeter) {
                try { dispatchHooks(p.figur, p.name, p.args, p.value); }
                catch (e) { hookProblem('Nachholen', e); }
            }
        }
    } finally {
        hookDraining = false;
    }
}

// Die Runden-Haken beim Weltstart leeren - ein Upgrade hängt sie in seinem apply() wieder voll.
// Gleichzeitig verjährt die Markierung "apply wurde schon aufgerufen": in jeder neuen Runde
// darf die apply-Funktion des gewählten Upgrades genau einmal wirken.
Object.assign(Game, {
    roundHooks: null,
    setupRoundHooks() {
        this.roundHooks = { onUpdate: [], onEnemyKilled: [], onDrawWorld: [], figur: 'runde', _nr: ++hookZaehler };
        for (const u of UPGRADES) u._appliedRound = false;
    },
});

// ── Anmelden: ein Upgrade aus seiner eigenen Datei ──
// Eintrag: { id, figur: 'mark'|'juri'|'croc'|'panda', name, text, emoji,
//            istFrei(g), where, welt, apply(c) }  - apply bekommt c = { game, welt, player, juri, croc, panda }
// und trägt dort seine Haken ein. istFrei/where fehlen? Dann ist das Extra ab der Anmeldung frei.
// welt = Belohnung einer Welt -> der Eintrag erscheint nicht im Shop (Regel von Leander, 18.10.2026).
// Doppelte Ids und unbrauchbare Einträge werden abgelehnt (die Konsole sagt warum).
function registerUpgrade(eintrag) {
    if (!eintrag || typeof eintrag.id !== 'string' || !eintrag.id) {
        hookProblem('registerUpgrade (Id fehlt)', new Error('Eintrag ohne id'));
        return false;
    }
    if (Object.prototype.hasOwnProperty.call(UPGRADE_BY_ID, eintrag.id)) {
        hookProblem('registerUpgrade (doppelte Id)', new Error(eintrag.id));
        return false;
    }
    if (!UPGRADE_HEROES.some(h => h.id === eintrag.figur)) {
        hookProblem('registerUpgrade (Figur)', new Error(String(eintrag.figur)));
        return false;
    }
    if (eintrag.id === '__proto__' || eintrag.id === 'constructor' || eintrag.id === 'prototype') {
        hookProblem('registerUpgrade (Schlüsselwort)', new Error(eintrag.id));
        return false;
    }
    if (typeof eintrag.name !== 'string' || !eintrag.name ||
        typeof eintrag.text !== 'string' || !eintrag.text) {
        hookProblem('registerUpgrade (name/text)', new Error(eintrag.id));
        return false;
    }
    const u = Object.assign({ emoji: '✨', where: '', bald: false }, eintrag);
    if (typeof u.istFrei !== 'function') u.istFrei = () => true;
    // `welt` (Belohnung dieser Welt, nicht kaufbar) nur als echte Weltzahl annehmen: ohne gueltige
    // Zahl zaehlt der Eintrag wie ein ganz normaler und bleibt im Shop kaufbar.
    if (u.welt !== undefined) {
        const n = Math.floor(+u.welt);
        if (Number.isFinite(n) && n >= 1) u.welt = n; else delete u.welt;
    }
    UPGRADES.push(u);
    // defineProperty statt bloßer Zuweisung: der Schlüssel bleibt ein eigener Eintrag
    // (eine blanke Zuweisung von '__proto__' würde sonst den Objektbau selbst überschreiben).
    Object.defineProperty(UPGRADE_BY_ID, u.id, { value: u, enumerable: true, writable: true, configurable: true });
    return true;
}

// ── Gemeinsame Helfer für Upgrades (dasselbe Rad nicht dreimal erfinden) ──

// Flächenschaden um einen Punkt: jeder Gegner im Radius (außer `except`) nimmt Schaden.
// Ruft absichtlich KEINE Treffer-Haken auf - sonst würde ein onProjectileHit-Haken,
// der areaDamage benutzt, sich selbst von neuem auslösen.
function areaDamage(x, y, radius, damage, except, angle) {
    if (!Game.enemies) return 0;
    let hits = 0;
    const dir = angle !== undefined ? angle : null;
    // über eine Kopie: takeDamage kann währenddessen Gegner erzeugen (Nachwuchs, Splitter)
    for (const e of Game.enemies.slice()) {
        if (!e || e === except || e.dead) continue;
        if (Math.hypot(e.centerX() - x, e.centerY() - y) <= radius + Math.max(e.w, e.h) / 2) {
            e.takeDamage(damage, dir !== null ? Math.atan2(e.centerY() - y, e.centerX() - x) : undefined, dir !== null ? 120 : undefined);
            hits++;
        }
    }
    return hits;
}

// Gegner wegschubsen: Kurzer Ruck in Richtung `angle` (Radian, weg von der Quelle).
function knockBack(e, angle, force) {
    if (!e || e.dead) return false;
    e.knockbackVx = Math.cos(angle) * (force || 220);
    e.knockbackVy = Math.sin(angle) * (force || 220);
    return true;
}

// Gegner zeitweise verlangsamen: er bewegt und schießt für `seconds` Sekunden
// im Tempo `factor` (0,5 = halb so schnell). Die Engine zählt in js/main.js ab.
function slowEnemy(e, seconds, factor) {
    if (!e || e.dead) return false;
    // Faktor nie ganz 0: sonst steht der Gegner still, stellt aber auch nichts mehr fertig
    // (und seine Schutzzeit würde gar nicht mehr ablaufen) - 0,05 ist die unterste Stufe.
    const f = Math.max(0.05, factor !== undefined ? factor : 0.6);
    e.slowTimer = Math.max(e.slowTimer || 0, seconds || 2);
    e.slowFactor = Math.min(e.slowFactor !== undefined ? e.slowFactor : 1, f);
    return true;
}

// Einen zeitweisen Helfer (Begleiter) für `seconds` Sekunden neben die Figur setzen.
// `companion` ist ein Objekt mit update(dt, world, player, enemies) und draw(ctx, camera)
// (gleiche Regel wie Juri und Krokodil); ist es eine Klasse, wird sie mit (x, y) erzeugt.
// Der Helfer verschwindet von selbst, wenn sein Zähler abgelaufen ist.
function spawnHelper(companion, x, y, seconds) {
    if (!Game.companions || !companion) return null;
    const c = typeof companion === 'function' ? new companion(x, y) : companion;
    if (!c) return null;
    c.helperTimer = seconds !== undefined ? seconds : 10;
    Game.companions.push(c);
    return c;
}

// Ein Begleiter schießt (für Juris und Marks Panda-Dateien: Juri spuckt sonst nicht).
// Das Geschoss ist ein ganz normales Spieler-Geschoss (Projectile aus js/weapons.js);
// der onShoot-Haken der Figur läuft vorher - Upgrades können es dort noch umhängen.
// Gibt das Geschoss zurück oder null, wenn kein Spiel läuft.
function companionShoot(figure, angle, speed, damage) {
    if (!Game.projectiles || !figure) return null;
    const p = new Projectile(figure.centerX(), figure.centerY(),
        Math.cos(angle) * (speed || 250), Math.sin(angle) * (speed || 250),
        damage || 3, 'player', 80);
    p.radius = 4;
    if (figure.hooks && figure.hooks.onShoot && figure.hooks.onShoot.length) {
        dispatchHooks(figure, 'onShoot', [p]);
    }
    Game.projectiles.push(p);
    return p;
}
