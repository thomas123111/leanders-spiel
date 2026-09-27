// ── Welt 24: Drachenberg ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class DragonKid extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.phasesThroughWalls = false;
        this.flying = false;
        this.speed = 50;
        this.hp = 6;
        this.maxHp = 6;
    }
}

class BossDragonFather extends BossScrapRaccoon {}

// Schatten des Drachenvaters, der ab und zu über die Karte fliegt (reine Stimmung, kein Schaden).
// Liegt in Game.props; onlyUnder = nur drawUnder (unter allen Figuren), nicht in der sortierten Figurenliste.
class DragonFatherShadow {
    constructor() {
        this.x = 0; this.y = 0; this.w = 1; this.h = 1;
        this.onlyUnder = true;
        this.noShadow = true;
    }
    update() {}
    drawUnder() {}
    draw() {}
}
