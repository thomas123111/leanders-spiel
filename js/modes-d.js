// ── Extra-Modi, Paket D ──
// Hier traegt ein spaeterer Auftrag seine Modi ein, ohne eine gemeinsame Datei anzufassen.
// Das Geruest (registerMode, Rekorde, Bausteine)erklaert js/modes.js im Detail.
//
// Vorlage - einfach einfuegen und ausfuellen:
//
//   registerMode({
//       id: 'ueberleben',                     // eindeutig, nur a-z, 0-9 und Bindestrich
//       name: 'Ueberleben',
//       emoji: '🛡️',
//       text: 'Halte so lange durch, wie du kannst.',   // EIN Satz, fuer Kinder geschrieben
//       frei: g => g.maxWorldUnlocked >= 5,    // ab wann die Karte „Los!“ zeigt (ohne Angabe: immer)
//       hinweis: 'Erst Welt 5 schaffen.',      // Text auf der noch gesperrten Karte
//       wertung: 'punkte',                    // 'punkte' (mehr ist besser) | 'zeit' (weniger ist besser)
//       start(g) {
//           Modes.arena({ welt: 12, herzen: 5, breite: 44, hoehe: 24 });
//           Modes.dauerwellen({ gegner: [Ghost, KeyGhost], pro: 4, interval: 6, maxLeben: 18 });
//       },
//       update(dt) { ... },                   // optional, jeder Takt beim Spielen
//       onPlayerDeath(g) { Modes.finish({ text: 'Mark hat ausgeharrt.' }); return true; },
//       onWorldClear(g) { return true; },     // Boss-Sieg: der Modus uebernimmt (keine Welt-Belohnung)
//       drawHud(ctx) { Modes.hudStatus(ctx); } // eigene Anzeige (ohne Haken zeigt Modes Zeit und Punkte)
//   });
//
// Weitere Bausteine: Modes.starteWelt({ welt, herzen, tempo, groesse, dunkelheit, spiegel, zeitlimit }),
// Modes.welle({ gegner, anzahl }), Modes.bossReihe([...]) mit Modes.naechsterBoss(),
// Modes.punkte(n), Modes.zeit(), Modes.restzeit(), Modes.finish({ punkte, text, muenzen }).

// (Noch keine Modi in diesem Paket.)
