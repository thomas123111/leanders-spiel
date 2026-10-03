// ── Welt 30: Hexenwald ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class WitchKid extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.phasesThroughWalls = false;
        this.flying = false;
        this.speed = 50;
        this.hp = 6;
        this.maxHp = 6;
    }
}

class BossOldWitch extends BossScrapRaccoon {}
