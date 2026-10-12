// ── Auswählbare Upgrades: die Liste dahinter und die Auswahl für genau eine Runde (Knopf „Waffen“) ──
// Regel von Leander (12.10.2026): Die Grundausstattung (Schläger, Baseball-Werfer, Auto, Juris Hammer,
// das Spucken des Krokodils, Power-Stufen) ist immer an. Von den Extras hier gilt pro Runde genau EINS.
// Antippen auf der Waffen-Seite wählt an, nochmaliges Antippen wählt ab. In einer laufenden Runde
// lässt sich nichts mehr ändern - js/main.js legt die Auswahl beim Weltstart für die Runde fest.
// Spätere Aufträge hängen hier einfach weitere Einträge an und fragen in js/main.js Game.upgradeOn(id) ab.

const UPGRADE_HEROES = [
    { id: 'mark', name: 'Mark', emoji: '🧢' },
    { id: 'juri', name: 'Juri', emoji: '🔨' },
    { id: 'croc', name: 'Schattenkrokodil', emoji: '🐊' },
    { id: 'panda', name: 'Panda', emoji: '🐼' },
];

// figur: 'mark' | 'juri' | 'croc' | 'panda'
// istFrei(game): frei, sobald der Merker gesetzt ist ODER die Welt erreicht wurde, die es früher automatisch gab
// where: Hinweis, wo man das Upgrade bekommt (steht auf der gesperrten Karte)
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
        istFrei: g => !!g.unlockedShadowCaster || g.maxWorldUnlocked >= 10 },
    { id: 'gamerPistol', figur: 'mark', name: 'Gamer-Pistole', emoji: '🔫',
        text: 'Mark schießt die Gamer-Pistole: deutlich mehr Schaden pro Schuss.',
        where: 'Welt 11 schaffen',
        istFrei: g => !!g.unlockedGamerPistol || g.maxWorldUnlocked >= 12 },
    { id: 'fruit', figur: 'mark', name: 'Obst-Upgrades', emoji: '🍊',
        text: 'Orangen-Explosion bei Treffern. Juri und Krokodil werfen auch mit Obst.',
        where: 'Welt 10 schaffen',
        istFrei: g => !!g.unlockedFruitUpgrades },
    { id: 'boneBat', figur: 'mark', name: 'Knochen-Schläger', emoji: '🦴',
        text: 'Marks Schläger haut mit dem Knochen kräftiger zu.',
        where: 'Welt 13 schaffen',
        istFrei: g => !!g.unlockedBoneBat },
    { id: 'petrifyStone', figur: 'mark', name: 'Stein-Gift', emoji: '🪨',
        text: 'Treffer verwandeln Gegner manchmal kurz in Stein.',
        where: 'Welt 15 schaffen',
        istFrei: g => !!g.unlockedPetrifyStone },
    { id: 'snake', figur: 'mark', name: 'Schlangen-Freund', emoji: '🐍',
        text: 'Eine kleine Schlange sitzt auf Marks Schulter und spuckt Gift.',
        where: 'Welt 14 schaffen',
        istFrei: g => !!g.unlockedSnakeCompanion },
    { id: 'crown', figur: 'mark', name: 'Goldene Krone', emoji: '👑',
        text: 'Die Krone startet die Runde mit einem schützenden Schild.',
        where: 'Welt 4 schaffen oder 500 🪙 im Shop',
        istFrei: g => !!g.unlockedCrown },
    { id: 'laserBalls', figur: 'mark', name: 'Baseball-Laserkugeln', emoji: '🔮',
        text: 'Marks Werfer schießt leuchtende Laser-Baseballs: schneller als Bälle und durch bis zu drei Gegner hindurch.',
        where: 'Welt 45 schaffen',
        istFrei: g => !!g.unlockedLaserBalls },
    { id: 'boomBall', figur: 'mark', name: 'Knallball', emoji: '💥',
        text: 'Marks Würfe knallen beim Aufprall und treffen alle Gegner im Umkreis - auch hinter Ecken.',
        where: 'Welt 46 schaffen',
        istFrei: g => !!g.unlockedBoomBall },
    { id: 'iceBall', figur: 'mark', name: 'Eisball', emoji: '❄️',
        text: 'Getroffene Gegner frieren zwei Sekunden ein und können sich nicht bewegen. Bosse halten nur 0,6 Sekunden dicht.',
        where: 'Welt 48 schaffen',
        istFrei: g => !!g.unlockedIceBall },
    // ── Juri ──
    { id: 'juriFireCircle', figur: 'juri', name: 'Feuerkreis', emoji: '🔥',
        text: 'Juri zündet um sich herum einen brennenden Kreis an.',
        where: 'Ab Welt 8 dabei',
        istFrei: g => g.maxWorldUnlocked >= 8 },
    { id: 'juriIceHammer', figur: 'juri', name: 'Eishammer', emoji: '🧊',
        text: 'Juris Hammerschläge frieren Gegner ein, und der Hammer sieht eisig aus. Für Bosse gilt dasselbe wie beim Eisball.',
        where: 'Welt 50 schaffen',
        istFrei: g => !!g.unlockedIceHammer },
    // ── Schattenkrokodil ──
    { id: 'crocFire', figur: 'croc', name: 'Feuerschüsse', emoji: '🎇',
        text: 'Die Schüsse des Krokodils explodieren in Feuer.',
        where: 'Ab Welt 9 dabei',
        istFrei: g => g.maxWorldUnlocked >= 9 },
    { id: 'crocShadowCloud', figur: 'croc', name: 'Schattenwolke', emoji: '🌑',
        text: 'Alle 12 Sekunden legt das Krokodil eine dunkle Wolke um Mark. Solange er darin steht, suchen ihn die Gegner woanders.',
        where: 'Welt 49 schaffen',
        istFrei: g => !!g.unlockedShadowCloud },
];

const UPGRADE_BY_ID = {};
for (const u of UPGRADES) UPGRADE_BY_ID[u.id] = u;

// Kennt diese Liste den Eintrag? (gebraucht, wenn ein alter Spielstand ein Upgrade wiederbringt)
function upgradeKnown(id) { return !!UPGRADE_BY_ID[id]; }

// Frei im Sinn der Waffen-Seite: Eintrag bekannt, und die Bedingung ist erfüllt
function upgradeIsFree(id, g) {
    const u = UPGRADE_BY_ID[id];
    if (!u || !g) return false;
    try { return !!u.istFrei(g); } catch (e) { return false; }
}

// ── Auswahl im Spiel: activeUpgrade bleibt, bis man es ändert; roundUpgrade gilt für die laufende Runde ──
Object.assign(Game, {
    activeUpgrade: null,     // dauerhaft ausgewähltes Extra (im Spielstand)
    roundUpgrade: null,      // beim Weltstart festgelegtes Extra, in der Runde unveränderlich
    roundUpgradeSet: false,  // true, solange eine Runde läuft (auch wenn kein Extra gewählt wurde)

    // Das Extra, das gerade zählt (in der Runde das festgelegte) - oder null.
    // Die Freiheitsprüfung sitzt hier mit drin: ein aus einem alten oder veränderten Spielstand
    // gekipptes Extra wird weder angezeigt noch wirkt es.
    selectedUpgrade() {
        const id = this.roundUpgradeSet ? this.roundUpgrade : this.activeUpgrade;
        return upgradeIsFree(id, this) ? UPGRADE_BY_ID[id] : null;
    },

    // Fragt die Wirkungstellen in js/main.js ab: gilt das Extra mit dieser Id gerade?
    upgradeOn(id) {
        const s = this.selectedUpgrade();
        return !!id && !!s && s.id === id;
    },

    // An- und abtippen auf der Waffen-Seite. Genau eins insgesamt; in einer laufenden Runde geht nichts mehr.
    chooseUpgrade(id) {
        if (this.roundUpgradeSet) return this.activeUpgrade;
        if (!upgradeIsFree(id, this)) return this.activeUpgrade;
        this.activeUpgrade = (this.activeUpgrade === id) ? null : id;
        this.save();
        return this.activeUpgrade;
    },

    // Beim Weltstart für die ganze Runde festhalten
    lockRoundUpgrade() {
        const id = this.activeUpgrade;
        this.roundUpgrade = upgradeIsFree(id, this) ? id : null;
        this.roundUpgradeSet = true;
    },

    // Zurück im Menü: die Auswahl ist wieder frei
    unlockRoundUpgrade() {
        this.roundUpgradeSet = false;
        this.roundUpgrade = null;
    },
});
