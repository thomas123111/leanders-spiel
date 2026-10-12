// ── Upgrades für MARK (Datei des Mark-Auftrags) ──
// Hier trägt der Mark-Auftrag seine neuen Upgrades ein - nur in dieser Datei,
// der Figuren-Code (js/player.js, js/weapons.js) wird nicht angefasst.
//
// So kommt ein neues Upgrade hinein (genau ein registerUpgrade-Aufruf pro Extra):
//
//   registerUpgrade({
//       id: 'meinUpgrade',            // eindeutig, englisch, kein bestehender Id-Dieb
//       figur: 'mark',                // fest: 'mark'
//       name: 'Mein Extra',           // erscheint im Menü „Waffen" und im Shop
//       text: 'Was das Extra tut.',   // ein Satz für die Karte
//       emoji: '⚡',
//       where: 'Welt 12 schaffen',    // Hinweis auf der gesperrten Karte
//       istFrei: g => g.maxWorldUnlocked >= 13,   // oder: g.unlockedMeinUpgrade
//       apply(c) {                    // c = { game, welt, player, juri, croc, panda }
//           // einmal beim Weltstart, NUR wenn dieses Extra gewählt wurde.
//           // Hier die Haken anmelden - sie wirken dann die ganze Runde:
//           c.player.hooks.onUpdate.push(dt => { /* jeder Bild-Takt */ });
//           c.player.hooks.onMeleeHit.push((gegner, schaden) => { /* Nahkampf-Treffer */ });
//           c.player.hooks.onProjectileHit.push((gegner, geschoss) => { /* Ball-Treffer */ });
//           c.player.hooks.onThrow.push(geschoss => { /* gerade geworfen */ });
//           c.player.hooks.onDodge.push(() => { /* Ausweichen */ });
//           c.player.hooks.onDamaged.push(menge => menge * 0.5); // Menge ändern (Zahl zurückgeben)
//           c.player.hooks.onKill.push(gegner => { /* Gegner besiegt */ });
//           c.player.hooks.onDraw.push(ctx => { /* über Mark malen (Bildschirmmaße) */ });
//           // Runden-Haken (ganze Welt): game.roundHooks.onUpdate / onEnemyKilled / onDrawWorld
//       },
//   });
//
// Gemeinsame Helfer (stehen in js/upgrades.js, einfach aufrufen):
//   areaDamage(x, y, radius, schaden, except)       Flächenschaden um einen Punkt
//   knockBack(gegner, winkel, kraft)                Gegner wegschubsen
//   slowEnemy(gegner, sekunden, faktor)             Gegner zeitweise verlangsamen
//   spawnHelper(objektOderKlasse, x, y, sekunden)   zeitweiliger Begleiter
//   companionShoot(figur, winkel, tempo, schaden)   Schuss eines Begleiters
//
// Regeln: kein neuer Welt-Datei-Griff, keine APP_VERSION, kein ?v=. Pro Runde gilt
// genau EIN Extra - die Auswahl und das Kaufen im Shop übernimmt js/upgrades.js von selbst.
