// ── Welt 56: Bienenstock ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class Bee extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.phasesThroughWalls = false;
        this.flying = true;
        this.speed = 62;
        this.hp = 5;
        this.maxHp = 5;
    }
}

class BossBeeQueen extends BossScrapRaccoon {}
