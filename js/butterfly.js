// ── Welt 23: Schmetterlingwelt ──
// PLATZHALTER aus dem Gerüst: wird durch die echten Figuren ersetzt.

class StarButterfly extends Ghost {
    constructor(x, y) {
        super(x, y);
        this.speed = 70;
        this.hp = 4;
        this.maxHp = 4;
    }
}

class BossTripleButterfly extends BossScrapRaccoon {}
