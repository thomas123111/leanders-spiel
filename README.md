# Mark und die geklauten Erfindungen

Ein Action-Abenteuer für den Handy-Browser: Mark, Baseballspieler und Geisterjäger, holt sich in
23 Welten seine geklauten Erfindungen zurück. Jede Welt hat einen Schlüssel-Träger und einen Boss.
Die letzten beiden Welten, „Zombie Academy“ und „Schmetterlingwelt“, hat sich Leander ausgedacht.

**Spielen:** https://thomas123111.github.io/leanders-spiel/
Auf dem Handy quer halten. Über „Zum Startbildschirm hinzufügen“ wird es eine App (Vollbild, offline).

## Steuerung

| | Handy | Computer |
|---|---|---|
| Laufen | linker Daumen (Stick erscheint, wo du tippst) | WASD / Pfeiltasten |
| Zielen & Angreifen | rechter Daumen ziehen, Tippen = Schlag/Wurf | Maus zielen, Klick |
| Ausweichen | blaue Taste oder links doppelt tippen | Leertaste |
| Waffe wechseln | Taste rechts oben | Q |
| Auto | Taste rechts oben (lädt sich mit 5 besiegten Gegnern auf) | E |
| Pause | Taste oben rechts | P / Esc |

Zielhilfe und Auto-Angriff lassen sich in der Pause bzw. in den Einstellungen ein- und ausschalten.

## Technik

Reines HTML5-Canvas mit klassischen Script-Dateien, kein Build-Schritt. Alle Grafiken und Töne
werden im Browser erzeugt (keine Bild- oder Tondateien).

| Datei | Inhalt |
|---|---|
| `js/main.js` | Spielzustände, Schleife, Welten, Belohnungen, Shop-Logik, Zeichen-Reihenfolge |
| `js/art.js` | gemeinsamer Zeichenstil (Schattierung, Umriss, Augen, Leuchten) |
| `js/fx.js` | Partikel, schwebende Zahlen, Schockwellen, Umgebungseffekte |
| `js/world.js` | Karten, Kollision, Welt-Grafik |
| `js/entities.js`, `js/entities2.js` | Gegner, Bosse, Begleiter |
| `js/zombie.js`, `js/butterfly.js` | Welt 22 (Zombies, Riesen-Zombie) und Welt 23 (Schmetterlinge, Drei-Kopf-Schmetterling) |
| `js/player.js`, `js/weapons.js`, `js/loot.js` | Mark, Waffen, Truhen, Schlüssel, Münzen |
| `js/hud.js`, `js/ui.js`, `css/game.css` | Anzeige im Spiel und Menüs |
| `js/sound.js`, `js/music.js` | Geräusche und Musik (Web Audio) |
| `sw.js`, `manifest.webmanifest` | App-Installation und Offline-Betrieb |

Der Spielstand liegt im Browser (`localStorage`, Schlüssel `mark_save`).

## Entwickeln

```
node tools/serve.mjs 8123
```
Dann http://127.0.0.1:8123/ öffnen.

- `tools/galerie.html` zeigt alle Figuren in Ruhe, getroffen, mit wenig Leben und sterbend.
- `node tools/pruefe-karten.mjs 100` prüft alle Karten (Start vorhanden, Boss-Tür erreichbar, nichts abgeschnitten).
- In der Browser-Konsole: `Game.startWorld(5)`, `Game.debugStep(600)` (10 s vorspulen).
- Alle Welten automatisch durchspielen: `eval(await (await fetch('tools/test-welten.js')).text()); await testeWelten([1, 22, 23])`.
- Alle Bosse sind zentral stärker gemacht: `BOSS_TOUGHNESS` und `BOSS_TEMPO` oben in `js/main.js`.
