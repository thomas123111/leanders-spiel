// ── Welten-Daten: eine Quelle für Namen, Themen, Farben, Bosse ──
// theme = Aussehen der Welt (js/world.js), accent = Leitfarbe für Menü/HUD.

const WORLDS = [
    { name: 'Trainingsplatz', theme: 'training', accent: '#7bd66b', emoji: '🎯', boss: null },
    { name: 'Geisterschloss', theme: 'castle', accent: '#a877ff', emoji: '👻', boss: 'König Geist' },
    { name: 'Maschinen-Hof', theme: 'factory', accent: '#ff9a3c', emoji: '🐤', boss: 'Riesen-Küken' },
    { name: 'Schleim-Arena', theme: 'slime', accent: '#5fe06b', emoji: '🟢', boss: 'König Schleim' },
    { name: 'Schatten-Burg', theme: 'shadowcastle', accent: '#ff5d73', emoji: '🦇', boss: 'Schatten-Fledermaus' },
    { name: 'Pilz-Wald', theme: 'mushroom', accent: '#ff7a59', emoji: '🍄', boss: 'Riesen-Pilz' },
    { name: 'Mücken-Sumpf', theme: 'swamp', accent: '#9ccc4a', emoji: '🦟', boss: 'Riesen-Mücke' },
    { name: 'Antarktis', theme: 'ice', accent: '#7fd8ff', emoji: '🐧', boss: 'Schnee-Adler' },
    { name: 'Vulkan-Insel', theme: 'volcano', accent: '#ff6a2b', emoji: '🌋', boss: 'Feuer-Phönix' },
    { name: 'Schatten-Dimension', theme: 'shadow', accent: '#b36bff', emoji: '🌀', boss: 'Schatten-Meister' },
    { name: 'Obst-Paradies', theme: 'orchard', accent: '#ffb02e', emoji: '🍎', boss: 'Obst-König' },
    { name: 'Pixel-Welt', theme: 'pixel', accent: '#4c9bff', emoji: '👾', boss: 'Pixel-Roboter' },
    { name: 'Sternen-Galaxie', theme: 'space', accent: '#ffc83d', emoji: '⭐', boss: 'Sternen-Ritter' },
    { name: 'Knochen-Tal', theme: 'bones', accent: '#f3e3c3', emoji: '💀', boss: 'Knochen-Reiter' },
    { name: 'Gift-Sumpf', theme: 'poison', accent: '#6bff5a', emoji: '🐍', boss: 'Hydra' },
    { name: 'Steinwelt', theme: 'stone', accent: '#b9c3d6', emoji: '🗿', boss: 'Stein-Dämon' },
    { name: 'Obst-Ninja', theme: 'dojo', accent: '#ff7b9c', emoji: '🥷', boss: 'Frucht-Gigant' },
    { name: 'Dino-Welt', theme: 'dino', accent: '#9bd65b', emoji: '🦖', boss: 'Stachel-T-Rex' },
    { name: 'Chrono-Sphäre', theme: 'chrono', accent: '#6fe7ff', emoji: '⏰', boss: 'Riesen-Zeitkugel' },
    { name: 'Schatten-Sümpfe', theme: 'shadowswamp', accent: '#77f08d', emoji: '🐊', boss: 'Schatten-Krokodil' },
    { name: 'Fußball-Arena', theme: 'football', accent: '#ffb020', emoji: '⚽', boss: 'Riesen-Fußball' },
    { name: 'Schrottplatz', theme: 'scrap', accent: '#c7ced9', emoji: '🦝', boss: 'Riesen-Waschbär' },
    { name: 'Zombie Academy', theme: 'zombie', accent: '#8ee86a', emoji: '🧟', boss: 'Riesen-Zombie' },
    { name: 'Schmetterlingwelt', theme: 'butterfly', accent: '#ff8ad8', emoji: '🦋', boss: 'Drei-Kopf-Schmetterling' },
    { name: 'Drachenberg', theme: 'dragon', accent: '#ff8a3d', emoji: '🐉', boss: 'Drachenvater' },
    { name: 'Vollmondwald', theme: 'werewolf', accent: '#ff4a4a', emoji: '🐺', boss: 'Riesen-Werwolf' },
    { name: 'Wolkenfestung', theme: 'angel', accent: '#ffd66b', emoji: '👼', boss: 'Schwert-Engel' },
    { name: 'Pyramidengrab', theme: 'mummy', accent: '#e8c27a', emoji: '🏺', boss: 'Drei-Kopf-Mumie' },
    { name: 'Glutschmiede', theme: 'firepig', accent: '#ff6b2e', emoji: '🐷', boss: 'Hammer-Schweinefrau' },
    { name: 'Gewitterwolken', theme: 'thunder', accent: '#ffe74a', emoji: '⚡', boss: 'Hundert-Augen-Blitzball' },
    { name: 'Hexenwald', theme: 'witch', accent: '#b884ff', emoji: '🧙', boss: 'Metallarm-Hexe' },
    { name: 'Hasenhügel', theme: 'bunny', accent: '#ffb3d1', emoji: '🐰', boss: 'Riesenhase' },
    { name: 'Teufelsschlucht', theme: 'devil', accent: '#ff3b5c', emoji: '👿', boss: 'Vier-Arm-Teufel' },
    { name: 'Alienplanet', theme: 'alien', accent: '#6dff8a', emoji: '👽', boss: 'Blaster-Raumschiff' },
    { name: 'Spinnenhöhle', theme: 'spider', accent: '#a8ff3c', emoji: '🕷️', boss: 'Riesenspinne' },
    { name: 'Krötensumpf', theme: 'toad', accent: '#9ccc4a', emoji: '🐸', boss: 'Drei-Kopf-Kröte' },
    { name: 'Zwergengarten', theme: 'dwarf', accent: '#ff7a3c', emoji: '⛏️', boss: 'Riesenzwerg' },
    { name: 'Monsterwald', theme: 'treemonster', accent: '#6fcf4a', emoji: '🌳', boss: 'Riesenbaum' },
    { name: 'Glutberg', theme: 'golem', accent: '#ff8a2b', emoji: '🔥', boss: 'Riesen-Feuergolem' },
    { name: 'Kürbisfeld', theme: 'pumpkin', accent: '#ff9a1f', emoji: '🎃', boss: 'Kürbisvater' },
    { name: 'Krebsstrand', theme: 'crab', accent: '#ff5f4a', emoji: '🦀', boss: 'Riesenkrebs' },
    { name: 'Adlerhorst', theme: 'eagle', accent: '#e8c27a', emoji: '🦅', boss: 'Riesenadler' },
    { name: 'Fuchsfestung', theme: 'fox', accent: '#ff8c32', emoji: '🦊', boss: 'Riesenfuchs' },
    { name: 'Stachelwald', theme: 'porcupine', accent: '#c8a06a', emoji: '🦔', boss: 'Riesen-Stachelschwein' },
    { name: 'Dschungelfelsen', theme: 'gorilla', accent: '#5fd44a', emoji: '🦍', boss: 'Riesen-Gorilla' },
];

const LAST_WORLD = WORLDS.length - 1;

function worldInfo(n) {
    return WORLDS[clamp(n | 0, 0, LAST_WORLD)];
}
