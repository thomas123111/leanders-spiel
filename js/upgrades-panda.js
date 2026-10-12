// ── Upgrades für Panda-Freund (Datei des Panda-Freund-Auftrags) ──
// Hier trägt der Panda-Freund-Auftrag seine neuen Upgrades ein - nur in dieser Datei,
// der Figuren-Code (js/pandafreund.js, Klasse PandaBuddy) wird nicht angefasst.
//
// So kommt ein neues Upgrade hinein (genau ein registerUpgrade-Aufruf pro Extra):
//
//   registerUpgrade({
//       id: 'meinUpgrade',            // eindeutig, englisch, kein bestehender Id-Dieb
//       figur: 'panda',                // fest: 'panda'
//       name: 'Mein Extra',           // erscheint im Menü „Waffen" und im Shop
//       text: 'Was das Extra tut.',   // ein Satz für die Karte
//       emoji: '🔥',
//       where: 'Welt 12 schaffen',    // Hinweis auf der gesperrten Karte
//       istFrei: g => g.maxWorldUnlocked >= 13,   // oder: g.unlockedMeinUpgrade
//       apply(c) {                    // c = { game, welt, player, juri, croc, panda }
//           // einmal beim Weltstart, NUR wenn dieses Extra gewählt wurde.
//           // Achtung: die eigene Figur kann in der Welt fehlen (c.panda ist dann null) -
//           // erst prüfen: if (!c.panda) return;
//           // Hier die Haken anmelden - sie wirken dann die ganze Runde:
//           c.panda.hooks.onUpdate.push(dt => { /* jeder Bild-Takt */ });
//           c.panda.hooks.onHit.push((gegner, schaden) => schaden);  // (Reserve; der Panda schießt Pflanzen)
//           c.panda.hooks.onShoot.push(geschoss => { /* nur mit companionShoot - die Pflanzen laufen anders */ });
//           c.panda.hooks.onDamaged.push(menge => menge * 0.5); // Menge aendern (Zahl zurueckgeben)
//           c.panda.hooks.onDraw.push(ctx => { /* ueber dem Panda malen (Bildschirmmasse) */ });
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
//     Achtung: companionShoot loest den onShoot-Haken derselben Figur aus. Ein onShoot-Haken,
//     der selbst companionShoot aufruft, loest sich damit immer wieder selbst - deshalb immer
//     erst pruefen (if (this._schon) return; this._schon = true; ... this._schon = false;),
//     sonst kappt das Geruest die Kette nach acht Runden (Meldung in der Konsole).
//
// Regeln: kein neuer Welt-Datei-Griff, keine APP_VERSION, kein ?v=. Pro Runde gilt
// genau EIN Extra - die Auswahl und das Kaufen im Shop übernimmt js/upgrades.js von selbst.
