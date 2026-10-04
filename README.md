# Mark und die geklauten Erfindungen

Ein Action-Abenteuer für den Handy-Browser: Mark, Baseballspieler und Geisterjäger, holt sich in
43 Welten seine geklauten Erfindungen zurück. Jede Welt hat einen Schlüssel-Träger und einen Boss.
Die Welten 22 bis 43 hat sich Leander ausgedacht, von der „Zombie Academy“ bis zum „Stachelwald“.

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

In der Pause und in den Einstellungen: Schwierigkeit (Normal, Schwer, Extrem; gilt ab dem nächsten Weltstart),
Zielhilfe, Geräusche, Musik und Vibration. Einen Auto-Angriff gibt es nicht mehr: Mark greift nur an, wenn man
selbst tippt, zieht oder klickt. Die Werte der Schwierigkeiten stehen in `DIFFICULTY` oben in `js/main.js`.

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
| `js/zombie.js`, `js/butterfly.js`, `js/dragon.js` | Welt 22 (Zombies, Riesen-Zombie), Welt 23 (Schmetterlinge, Drei-Kopf-Schmetterling), Welt 24 (Drachenkinder, Drachenvater) |
| `js/werewolf.js`, `js/angel.js`, `js/mummy.js`, `js/firepig.js`, `js/thunder.js`, `js/witch.js` | Welt 25–30 (Werwölfe, böse Engel, Mumien, Feuerschweine, Blitzbälle, Hexenkinder und ihre Bosse) |
| `js/bunny.js` … `js/fox.js` (12 Dateien) | Welt 31–42 (Hasen, Teufel, Aliens, Spinnen, Frösche, Zwerge, Baummonster, Feuergolems, Kürbiskinder, Krebse, Adler, Fuchssoldaten) |
| `js/progress.js`, `js/ui-box.js`, `js/ui-end.js`, `js/ui-progress.js` | Powerpunkte, Quests, Power-Pfad, Tagesleiste, Glücksboxen, Endseite |
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
- `node tools/smoke-welt.mjs 31 32` spielt Welten ohne Browser durch (Gegner, Boss, Phase 2, Sieg) und meldet jeden Fehler.
- `node tools/pruefe-karten.mjs 100` prüft alle Karten (Start vorhanden, Boss-Tür erreichbar, nichts abgeschnitten).
- In der Browser-Konsole: `Game.startWorld(5)`, `Game.debugStep(600)` (10 s vorspulen).
- Alle Welten automatisch durchspielen: `eval(await (await fetch('tools/test-welten.js')).text()); await testeWelten([1, 22, 23])`.
- Alle Bosse sind zentral stärker gemacht: `BOSS_TOUGHNESS` und `BOSS_TEMPO` oben in `js/main.js`.
