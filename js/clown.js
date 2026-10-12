// ── Welt 46: Clownzirkus ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class Clown extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.phasesThroughWalls = false;
        this.flying = false;
        this.speed = 50;
        this.hp = 6;
        this.maxHp = 6;
    }
}

class BossGiantClown extends BossScrapRaccoon {}
