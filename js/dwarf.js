// ── Welt 36: Zwergengarten ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class GardenDwarf extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.phasesThroughWalls = false;
        this.flying = false;
        this.speed = 50;
        this.hp = 6;
        this.maxHp = 6;
    }
}

class BossGiantDwarf extends BossScrapRaccoon {}
