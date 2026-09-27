// ── Welt 22: Zombie Academy ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class Zombie extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.phasesThroughWalls = false;
        this.flying = false;
        this.speed = 22;
        this.hp = 6;
        this.maxHp = 6;
    }
}

class BossGiantZombie extends BossScrapRaccoon {}
