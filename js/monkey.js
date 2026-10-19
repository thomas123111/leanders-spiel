// ── Welt 57: Affeninsel (letzte Welt) ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class Monkey extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.phasesThroughWalls = false;
        this.flying = false;
        this.speed = 58;
        this.hp = 6;
        this.maxHp = 6;
    }
}

class BossGiantMonkey extends BossScrapRaccoon {}
