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
];

const LAST_WORLD = WORLDS.length - 1;

function worldInfo(n) {
    return WORLDS[clamp(n | 0, 0, LAST_WORLD)];
}
