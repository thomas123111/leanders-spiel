// Automatischer Welten-Durchlauf für die Entwicklung (nicht Teil des Spiels).
// In der Spielseite (http://localhost:8123/) in der Konsole oder per Werkzeug ausführen:
//   eval(await (await fetch('tools/test-welten.js')).text());
//   await testeWelten([1, 21, 22, 23]);
// Je Welt: starten, Schlüssel geben, zur Boss-Tür, Boss-Einblendung abwarten, 8 s kämpfen lassen
// (Mark unverwundbar), prüfen ob der Boss im Raum bleibt, Boss besiegen, Endzustand melden.
// Funktioniert auch im verdeckten Browser, weil Game.debugStep die Bilder selbst weiterschaltet.
async function testeWelten(welten, opts = {}) {
    const kampfBilder = opts.kampfBilder || 480;
    const res = [];
    const errs = [];
    const onErr = e => errs.push((e && e.message) || String(e));
    window.addEventListener('error', onErr);
    const save = Game.save;
    Game.save = () => {};
    try {
        for (const n of welten) {
            const r = { welt: n };
            try {
                Game.startWorld(n);
                Game.debugStep(30, 1000 / 60, true);
                r.start = Game.state;
                r.gegner = Game.enemies.length;
                if (n > 0) {
                    Game.hasKey = true;
                    Game.world.openBossDoor();
                    const d = Game.world.bossDoorTiles[0];
                    Game.player.x = d.x * TILE_SIZE + TILE_SIZE / 2 - Game.player.w / 2;
                    Game.player.y = (d.y - 1) * TILE_SIZE + TILE_SIZE / 2 - Game.player.h / 2;
                    Game.debugStep(5, 1000 / 60, false);
                    r.intro = Game.state;
                    Game.debugStep(240, 1000 / 60, false);
                    const boss = Game.enemies.find(e => e.isBoss);
                    r.boss = boss ? boss.constructor.name : null;
                    r.bossHp = boss ? boss.maxHp : null;
                    r.zaeh = boss ? boss.toughness : null;
                    Game.player.iFrames = 999;
                    // Kampf Bild für Bild (jedes 10. Bild wird auch gezeichnet, um Zeichenfehler zu finden)
                    const room = Game._bossRoomRect();
                    r.imRaum = true;
                    r.geschosseMax = 0;
                    for (let i = 0; i < kampfBilder; i++) {
                        Game.debugStep(1, 1000 / 60, i % 10 === 0);
                        r.geschosseMax = Math.max(r.geschosseMax, Game.projectiles.length);
                        if (boss && !boss.dead && !(boss.x >= room.x - 1 && boss.y >= room.y - 1 &&
                            boss.x + boss.w <= room.x + room.w + 1 && boss.y + boss.h <= room.y + room.h + 1)) r.imRaum = false;
                    }
                    let guard = 0;
                    while (boss && !boss.dead && guard++ < 1000) {
                        boss.iFrames = 0;
                        boss.takeDamage(10, 0, 0);
                        Game.debugStep(2, 1000 / 60, false);
                    }
                    Game.debugStep(400, 1000 / 60, false);
                    r.ende = Game.state;
                    Game.player.iFrames = 0;
                }
            } catch (e) {
                r.fehler = e.message;
            }
            res.push(r);
        }
    } finally {
        Game.save = save;
        window.removeEventListener('error', onErr);
    }
    return { res, errs };
}
