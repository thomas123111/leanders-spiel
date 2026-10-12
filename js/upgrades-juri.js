// ── Upgrades für Juri (Datei des Juri-Auftrags) ──
// Hier trägt der Juri-Auftrag seine neuen Upgrades ein - nur in dieser Datei,
// der Figuren-Code (js/entities.js, Klasse Juri) wird nicht angefasst.
//
// So kommt ein neues Upgrade hinein (genau ein registerUpgrade-Aufruf pro Extra):
//
//   registerUpgrade({
//       id: 'meinUpgrade',            // eindeutig, englisch, kein bestehender Id-Dieb
//       figur: 'juri',                // fest: 'juri'
//       name: 'Mein Extra',           // erscheint im Menü „Waffen" und im Shop
//       text: 'Was das Extra tut.',   // ein Satz für die Karte
//       emoji: '🔥',
//       where: 'Welt 12 schaffen',    // Hinweis auf der gesperrten Karte
//       istFrei: g => g.maxWorldUnlocked >= 13,   // oder: g.unlockedMeinUpgrade
//       apply(c) {                    // c = { game, welt, player, juri, croc, panda }
//           // einmal beim Weltstart, NUR wenn dieses Extra gewählt wurde.
//           // Achtung: die eigene Figur kann in der Welt fehlen (c.juri ist dann null) -
//           // erst prüfen: if (!c.juri) return;
//           // Hier die Haken anmelden - sie wirken dann die ganze Runde:
//           c.juri.hooks.onUpdate.push(dt => { /* jeder Bild-Takt */ });
//           c.juri.hooks.onHit.push((gegner, schaden) => schaden);  // Hammerschlag (Zahl = Schaden, darf geaendert werden)
//           c.juri.hooks.onShoot.push(geschoss => { /* nur mit companionShoot - Juri spuckt sonst nicht */ });
//           c.juri.hooks.onDamaged.push(menge => menge * 0.5); // Menge aendern (Zahl zurueckgeben)
//           c.juri.hooks.onDraw.push(ctx => { /* ueber Juri malen (Bildschirmmasse) */ });
//           // Runden-Haken (ganze Welt): game.roundHooks.onUpdate / onEnemyKilled / onDrawWorld
//       },
//   });
//
// Gemeinsame Helfer (stehen in js/upgrades.js, einfach aufrufen):
//   areaDamage(x, y, radius, schaden, except)       Flächenschaden um einen Punkt
//   knockBack(gegner, winkel, kraft)                Gegner wegschubsen
//   slowEnemy(gegner, sekunden, faktor)             Gegner zeitweise verlangsamen
//   spawnHelper(objektOderKlasse, x, y, sekunden)   zeitweiliger Begleiter
//   companionShoot(figur, winkel, tempo, schaden)   Schuss eines Begleiters (löst onShoot aus)
//
// Regeln: kein neuer Welt-Datei-Griff, keine APP_VERSION, kein ?v=. Pro Runde gilt
// genau EIN Extra - die Auswahl und das Kaufen im Shop übernimmt js/upgrades.js von selbst.
