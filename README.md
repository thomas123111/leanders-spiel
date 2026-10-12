# Mark und die geklauten Erfindungen

Ein Action-Abenteuer für den Handy-Browser: Mark, Baseballspieler und Geisterjäger, holt sich in
50 Welten seine geklauten Erfindungen zurück. Jede Welt hat einen Schlüssel-Träger und einen Boss.
Die Welten 22 bis 50 hat sich Leander ausgedacht, von der „Zombie Academy“ bis zum „Schneemann-Tal“.

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

## Menüs

- **Shop:** Die Karten stehen in **einer Reihe** und werden mit dem Finger nach links und rechts gewischt
  (am Computer dreht auch das Mausrad die Reihe) – nach unten scrollt der Shop nicht. Darin: Tagesbelohnung,
  Böse Sterne, Goldene Krone, Glücksboxen, **Upgrades**, Sternen-Markt und Wechselstube.
- **Upgrades kaufen:** Im Abschnitt „Upgrades“ steht eine Karte für jedes Extra, das noch fehlt. Bezahlt wird in
  Juwelen nach Figur – Mark 850, Juri 500, Schattenkrokodil 450, Panda 350 (`UPGRADE_PRICES` in `js/upgrades.js`).
  Gekaufte Extras bekommen einen eigenen Merker im Spielstand (`boughtUps`) und sind danach im Menü „Waffen“
  wählbar. Reicht das Geld nicht, ist der Knopf grau und die Karte sagt, wie viele Juwelen noch fehlen.
  In einer laufenden Runde kauft und ändert man nichts.
- **Böse Sterne:** sechs Versuche – einer pro Seltenheit – und sechs Fragezeichen-Kreise. Die Chancen je Stufe
  bleiben 40/30/25/20/15 %, darum ist Ultralegendär etwa jeder 240. Stern. Alte Spielstände mit fünf übrigen
  Versuchen laden mit genau diesen fünf weiter.

## Technik

Reines HTML5-Canvas mit klassischen Script-Dateien, kein Build-Schritt. Alle Grafiken und Töne
werden im Browser erzeugt (keine Bild- oder Tondateien).

| Datei | Inhalt |
|---|---|
| `js/main.js` | Spielzustände, Schleife, Welten, Belohnungen, Shop-Logik, Zeichen-Reihenfolge |
| `js/art.js` | gemeinsamer Zeichenstil (Schattierung, Umriss, Augen, Leuchten) |
| `js/fx.js` | Partikel, schwebende Zahlen, Schockwellen, Umgebungseffekte |
| `js/world.js` | Karten, Kollision, Welt-Grafik |
| `js/entities.js`, `js/entities2.js` | Gegner, Bosse, Begleiter; Gegner-Grundklasse `freeze()` (Eisball, Eishammer) und die Schattenwolke des Krokodils |
| `js/zombie.js`, `js/butterfly.js`, `js/dragon.js` | Welt 22 (Zombies, Riesen-Zombie), Welt 23 (Schmetterlinge, Drei-Kopf-Schmetterling), Welt 24 (Drachenkinder, Drachenvater) |
| `js/werewolf.js`, `js/angel.js`, `js/mummy.js`, `js/firepig.js`, `js/thunder.js`, `js/witch.js` | Welt 25–30 (Werwölfe, böse Engel, Mumien, Feuerschweine, Blitzbälle, Hexenkinder und ihre Bosse) |
| `js/bunny.js` … `js/fox.js` (12 Dateien) | Welt 31–42 (Hasen, Teufel, Aliens, Spinnen, Frösche, Zwerge, Baummonster, Feuergolems, Kürbiskinder, Krebse, Adler, Fuchssoldaten) |
| `js/porcupine.js`, `js/gorilla.js` | Welt 43–44 (Stachelschwein, Gorilla und ihre Bosse) |
| `js/peacock.js` … `js/snowman.js` (6 Dateien) | Welt 45–50 (Pfauen, Clowns, Pandas, Einhörner, Vampire, Schneemänner und ihre Bosse) – noch Platzhalter aus dem Gerüst |
| `js/progress.js`, `js/ui-box.js`, `js/ui-end.js`, `js/ui-progress.js` | Powerpunkte, Quests, Power-Pfad, Tagesleiste, Glücksboxen, Endseite |
| `js/player.js`, `js/weapons.js`, `js/loot.js` | Mark, Waffen (Baseball-Werfer: Laserkugel, Knallball, Eisball), Truhen, Schlüssel, Münzen |
| `js/upgrades.js`, `js/ui-waffen.js`, `css/waffen.css` | auswählbare Upgrades: die Liste, die Auswahl für eine Runde, der Kauf im Shop (Preise je Figur in `UPGRADE_PRICES`) und die Seite „Waffen“ |
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
  Ohne Zahlen prüft er alle 50 Welten, die Belohnungs-Merker der Welten 45–50 und danach die Zustände Gift und
  Schlaf (Gift zieht ein halbes Herz pro Sekunde ab und endet von selbst, Schlaf hält fest und lässt danach
  1,5 s Schonzeit, die Freunde fallen im Schlaf nicht k.o., Krone und Auto schützen vor beidem).
- `node tools/pruefe-karten.mjs 100` prüft alle Karten (Start vorhanden, Boss-Tür erreichbar, nichts abgeschnitten).
- In der Browser-Konsole: `Game.startWorld(5)`, `Game.debugStep(600)` (10 s vorspulen).
- Alle Welten automatisch durchspielen: `eval(await (await fetch('tools/test-welten.js')).text()); await testeWelten([1, 22, 23])`.
- Alle Bosse sind zentral stärker gemacht: `BOSS_TOUGHNESS` und `BOSS_TEMPO` oben in `js/main.js`.
