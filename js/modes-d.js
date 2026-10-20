// ── Extra-Modi, Paket D ──
// Sechs echte Modi: Autorennen, Geisterjagd, Endloslauf, Mega-Bosse, Upgrade-Chaos und
// Schneeballschlacht. Das Geruest (registerMode, Rekorde, Bausteine, Ergebnis-Seite)
// erklaert js/modes.js im Detail; hier stehen nur die Modi und ihre eigenen Bauteile.
//
// Wichtig fuer alle Paketdateien: js/modes-a.js bis js/modes-d.js laufen im SELBEN globalen
// Bereich. Deshalb traegt hier jeder eigene Name ein `D4` voran oder haengt an `ModiD` -
// ein zweites `const fallen = ...` wuerde das Spiel schon beim Laden zerlegen.
//
// Zwei Techniken, die ein Modus in main.js nicht aendern darf, hier aber braucht:
//   - Eigene Welt-Objekte (Zielflagge, Renn-Wimpel, Geisterfalle) laufen in Game.projectiles
//     mit: main.js ruft dort pro Bild update(dt, world) auf (main.js:1704) und zeichnet alles
//     mit draw(ctx, camera) (main.js:2436). Ihr `owner` ist weder 'player' noch 'enemy',
//     darum prueft die Trefferlogik niemanden an ihnen.
//   - Erzwungenes Laufen ueber player._moveWithCollision im update-Haken: Input.update setzt
//     die Richtung jeden Bild neu aus der echten Eingabe (main.js:1441), die ein Modus nicht
//     dauerhaft ueberschreiben darf.

const ModiD = {
    rennen: null,   // Autorennen: Wimpel, Ziel, Reihenfolge
    jagd: null,     // Geisterjagd: Fallen und Faelle
    lauf: null,     // Endloslauf: Abschnitt, Tempo, Strecke
    mega: null,     // Mega-Bosse: aktueller Boss und seine Nummer
    chaos: null,    // Upgrade-Chaos: die Lose dieser Runde
    schnee: null,   // Schneeballschlacht: Werfer, Wurf-Takt der Freunde

    meldung(text, farbe) {
        if (typeof HUD !== 'undefined' && HUD.toast) HUD.toast(text, farbe || '#ffe38a', 1.9);
    },

    // Gegner aus der Liste nehmen, ohne ihn sterben zu lassen: fangen statt schlagen.
    // Bewusst kein takeDamage - sonst zaehlen Tod-Effekt, Münzfall und Fortschritt in den Modus.
    einfangen(e) {
        const liste = Game.enemies;
        const i = Array.isArray(liste) ? liste.indexOf(e) : -1;
        if (i >= 0) liste.splice(i, 1);
    },

    // naechster lebender Gegner um einen Punkt (sonst null)
    naechsterGegner(x, y, maxAbstand) {
        let best = null;
        let beste = Number.isFinite(maxAbstand) ? maxAbstand : Infinity;
        for (const e of Game.enemies) {
            if (!e || e.dead || typeof e.centerX !== 'function') continue;
            const d = Math.hypot(e.centerX() - x, e.centerY() - y);
            if (d < beste) { beste = d; best = e; }
        }
        return best;
    },

    // Marks Mitte (die Modi rechnen mit der Mitte, nicht mit der Ecke)
    mitte() {
        const p = Game.player;
        return { x: p.x + p.w / 2, y: p.y + p.h / 2 };
    },

    // ganze Zahl von 1 bis n
    wuerfel(n) { return 1 + Math.floor(Math.random() * Math.max(1, n)); },

    // kurzer Text fuer die Pillenzeile: lange Upgradenamen zerlegen die Anzeige nicht
    kurz(text, laenge) {
        const t = String(text || '');
        const max = laenge || 12;
        return t.length > max ? t.slice(0, max - 1) + '…' : t;
    },
};

// ══════════════════════════════ eigene Welt-Objekte ══════════════════════════════
// Ziel-Flagge, Renn-Wimpel und Geisterfalle. main.js zeichnet alles in Game.projectiles
// mit draw(ctx, camera); der owner 'kulisse' ist bewusst weder 'player' noch 'enemy'.
class D4Kulisse {
    constructor(x, y, art) {
        this.x = x;
        this.y = y;
        this.owner = 'kulisse';
        this.dead = false;
        this.art = art || 'wimpel';
        this.alter = 0;
        this.erledigt = false;
        this.ablauf = 0;              // > 0: liegt nur so lange (Geisterfalle)
        this.radius = this.art === 'falle' ? 30 : 42;
        this.seed = Math.random() * 10;
    }

    update(dt) {
        this.alter += dt;
        if (this.ablauf > 0) {
            this.ablauf -= dt;
            if (this.ablauf <= 0) this.dead = true;
        }
    }

    draw(ctx, camera) {
        const p = camera.worldToScreen(this.x, this.y);
        const wehen = 1 + 0.07 * Math.sin(Art.time * 3.2 + this.seed);
        if (this.art === 'falle') {
            const pul = this.erledigt ? 0 : 0.5 + 0.5 * Math.sin(Art.time * 5 + this.seed);
            Art.ring(ctx, p.x, p.y, this.radius, this.erledigt
                ? 'rgba(120,220,150,0.45)' : 'rgba(255,226,120,' + (0.5 + 0.35 * pul).toFixed(2) + ')', 3);
            Art.ring(ctx, p.x, p.y, this.radius * 0.6, 'rgba(255,255,255,0.32)', 1.5);
            ctx.strokeStyle = 'rgba(255,242,205,0.45)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = i * TAU / 6 + this.alter * 0.7;
                ctx.moveTo(p.x + Math.cos(a) * this.radius * 0.18, p.y + Math.sin(a) * this.radius * 0.18);
                ctx.lineTo(p.x + Math.cos(a) * this.radius, p.y + Math.sin(a) * this.radius);
            }
            ctx.stroke();
            Art.text(ctx, this.erledigt ? '✅' : '🪤', p.x, p.y - this.radius - 14, { size: 16 });
            return;
        }
        if (this.art === 'ziel') {
            const bw = 62, bh = 26;
            ctx.strokeStyle = Art.ink('#20244a');
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(p.x - bw / 2, p.y + 12); ctx.lineTo(p.x - bw / 2, p.y - bh - 8);
            ctx.moveTo(p.x + bw / 2, p.y + 12); ctx.lineTo(p.x + bw / 2, p.y - bh - 8);
            ctx.stroke();
            for (let ry = 0; ry < 2; ry++) {
                for (let rx = 0; rx < 6; rx++) {
                    ctx.fillStyle = (rx + ry) % 2 ? '#20244a' : '#ffffff';
                    ctx.fillRect(p.x - bw / 2 + rx * (bw / 6), p.y - bh - 6 + ry * (bh / 2), bw / 6, bh / 2);
                }
            }
            Art.text(ctx, 'ZIEL', p.x, p.y - bh - 20, { size: 15, color: '#ffe38a' });
            Art.sparkle(ctx, p.x, p.y - bh - 34, 3.2 + Math.sin(Art.time * 4) * 1.2, '#ffffff', 0.8);
            return;
        }
        // Renn-Wimpel: Pfosten mit Fahne, erreicht wird gruen
        const hoehe = 36;
        ctx.strokeStyle = Art.ink('#2b2f5e');
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + 12);
        ctx.lineTo(p.x, p.y - hoehe);
        ctx.stroke();
        ctx.fillStyle = this.erledigt ? '#69d26a' : '#ff9f1c';
        ctx.beginPath();
        ctx.moveTo(p.x + 1, p.y - hoehe);
        ctx.lineTo(p.x + 24 * wehen, p.y - hoehe + 8);
        ctx.lineTo(p.x + 1, p.y - hoehe + 17);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = Art.ink(this.erledigt ? '#69d26a' : '#ff9f1c');
        ctx.lineWidth = 1.6;
        ctx.stroke();
        if (this.erledigt) Art.text(ctx, '✅', p.x, p.y - hoehe - 14, { size: 15 });
        else Art.ring(ctx, p.x, p.y, 13, 'rgba(255,159,28,0.55)', 2);
    }
}

// ══════════════════════════════ Waffen und Schneebaelle ══════════════════════════
// Marks und der Freunde Schneeball: sieht aus wie der Schneeball des Schneemannes
// (js/snowman.js), gehuert aber Mark. Der Schneemann-Takt wird deshalb nur bis zum
// Grund-Takt benutzt - SnowBall.update wuerfele auch einen Freundertreffer ein
// (SnowmanArt.companionHit), und eigene Schneebaelle duerfen Juri, Krokodil und Panda
// auf keinen Fall treffen.
class D4Schnee extends SnowBall {
    constructor(x, y, angle, speed, schaden) {
        super(x, y, angle, speed || 330, false);
        this.owner = 'player';
        this.damage = schaden || 3;
        this.knockback = 110;
        this.bouncesLeft = 2;
    }

    update(dt, world) {
        Projectile.prototype.update.call(this, dt, world);
    }
}

class D4SchneeWerfer {
    constructor() {
        this.name = 'Schneeball-Werfer';
        this.type = 'ranged';
        this.damage = 3;
        this.cooldown = 0.36;
        this.cooldownTimer = 0;
        this.knockback = 110;
        this.projectileSpeed = 330;
    }
    canAttack() { return this.cooldownTimer <= 0; }
    update(dt) { if (this.cooldownTimer > 0) this.cooldownTimer -= dt; }
    getHitEntities() { return []; }
    attack(angle, playerPos, projectiles) {
        if (!this.canAttack()) return false;
        this.cooldownTimer = this.cooldown;
        projectiles.push(new D4Schnee(playerPos.x + playerPos.w / 2, playerPos.y + playerPos.h / 2,
            angle, this.projectileSpeed, this.damage));
        return true;
    }
}

// Stumme Waffe fuer den Endloslauf: in diesem Modus wird nur ausgewichen, nicht gehauen.
class D4Stumm {
    constructor() {
        this.name = 'keine Waffe';
        this.type = 'none';
        this.damage = 0;
        this.cooldown = 999;
        this.cooldownTimer = 0;
        this.knockback = 0;
    }
    canAttack() { return false; }
    update() {}
    attack() { return false; }
    getHitEntities() { return []; }
    draw() {}
}

// ══════════════════════════ Upgrade-Chaos: geliehene Extras ══════════════════════════
// Leander will hier auch Extras, die er gar nicht hat. Ein Modus darf dafuer aber keine
// Kauf-Merker im Spielstand setzen (sonst haette das Kind die Extras dauerhaft). Der Modus
// leiht sich die Wirkung nur fuer seine eigene Laufzeit:
//   - Game.selectedUpgrade und Game.selectedUpgrades sind ueberlagert und liefern die Lose
//     nur, solange genau dieser Modus laeuft (D4Chaos.spielt()).
//   - Die istFrei-Ausnahme eines einzelnen Eintrags gilt ebenso nur waehrend des Laufs.
// Der Spielstand (activeUpgrades, boughtUpgrades) wird nie angefasst; main.js und die
// apply()-Funktionen der Upgrades lesen ausschliesslich die beiden Methoden.
const D4Chaos = {
    picks: [],        // [{ figur, u, name, emoji }]
    ausnahmen: [],    // [{ u, alt }] - istFrei-Ausnahmen dieser Runde
    heilig: null,     // die Original-Methoden von Game

    spielt() {
        return !!(typeof Modes !== 'undefined' && Modes.run && Modes.run.mode &&
            Modes.run.mode.id === 'upgrade-chaos');
    },

    traegt(u) {
        for (const p of D4Chaos.picks) if (p.u === u) return true;
        return false;
    },

    // welche Figuren sind in dieser Welt dabei? (dasselbe wie main.js startWorld)
    dabei(welt) {
        return {
            mark: true,
            juri: welt >= 7 && typeof Juri !== 'undefined',
            croc: welt >= 8 && typeof ShadowCrocodile !== 'undefined',
            panda: !!Game.unlockedPandaFriend && typeof PandaBuddy !== 'undefined',
        };
    },

    verteilen(welt) {
        D4Chaos.aufraeumen();
        if (!D4Chaos.heilig) {
            D4Chaos.heilig = { selectedUpgrade: Game.selectedUpgrade, selectedUpgrades: Game.selectedUpgrades };
        }
        const pool = Object.create(null);
        const helden = (typeof UPGRADE_HEROES !== 'undefined' ? UPGRADE_HEROES : []);
        const dabei = D4Chaos.dabei(welt);
        for (const u of (typeof UPGRADES !== 'undefined' ? UPGRADES : [])) {
            if (!u || !u.id || u.bald || typeof u.istFrei !== 'function') continue;
            if (!helden.some(h => h.id === u.figur) || !dabei[u.figur]) continue;
            (pool[u.figur] || (pool[u.figur] = [])).push(u);
        }
        for (const h of helden) {
            const liste = pool[h.id];
            if (!liste || !liste.length) continue;
            const u = liste[Math.floor(Math.random() * liste.length)];
            D4Chaos.picks.push({ figur: h.id, u, name: h.name, emoji: h.emoji });
            let frei = false;
            try { frei = !!u.istFrei(Game); } catch (e) { frei = false; }
            if (!frei) {
                const alt = u.istFrei;
                D4Chaos.ausnahmen.push({ u, alt });
                u.istFrei = function (g) {
                    if (D4Chaos.spielt() && D4Chaos.traegt(u)) return true;
                    try { return !!alt.call(this, g); } catch (e) { return false; }
                };
            }
        }
        Game.selectedUpgrade = function (figur) {
            if (!D4Chaos.spielt()) return D4Chaos.heilig.selectedUpgrade.call(this, figur);
            for (const p of D4Chaos.picks) if (p.figur === figur) return p.u;
            return D4Chaos.heilig.selectedUpgrade.call(this, figur);
        };
        Game.selectedUpgrades = function () {
            if (!D4Chaos.spielt()) return D4Chaos.heilig.selectedUpgrades.call(this);
            const out = [];
            for (const h of (typeof UPGRADE_HEROES !== 'undefined' ? UPGRADE_HEROES : [])) {
                const u = Game.selectedUpgrade(h.id);
                if (u) out.push(u);
            }
            return out;
        };
        return D4Chaos.picks;
    },

    aufraeumen() {
        for (const a of D4Chaos.ausnahmen) {
            if (a && a.u && typeof a.alt === 'function') a.u.istFrei = a.alt;
        }
        D4Chaos.ausnahmen.length = 0;
        D4Chaos.picks.length = 0;
        if (D4Chaos.heilig) {
            Game.selectedUpgrade = D4Chaos.heilig.selectedUpgrade;
            Game.selectedUpgrades = D4Chaos.heilig.selectedUpgrades;
        }
    },
};

// ══════════════════════════ Bausteine fuer mehrere Modi ══════════════════════════
// Arena mit Wand-Inseln (Autorennen: die stehen im Weg, das Auto zerlegt sie - main.js
// _crashWalls) und die Hindernis-Bahn des Endloslaufs.
function D4Inseln(inseln) {
    const w = Game.world;
    for (const s of inseln) {
        for (let y = s[1]; y < s[1] + s[3]; y++) {
            for (let x = s[0]; x < s[0] + s[2]; x++) w.setTile(x, y, TILE_WALL);
        }
    }
    Modes.merkeBoden();
}

// Ein Stueck Endloslauf-Bahn: langer Gang, Wände mit je einer Luecke. Mit jedem Abschnitt
// mehr Wände, engere Luecken, mehr Gegner.
function D4Bahn(abschnitt) {
    const hoehe = 15, breite = 46;
    const level = [];
    for (let y = 0; y < hoehe; y++) {
        const row = new Array(breite).fill(TILE_WALL);
        for (let x = 1; x < breite - 1; x++) if (y >= 2 && y <= 12) row[x] = TILE_FLOOR;
        level.push(row);
    }
    level[7][2] = TILE_SPAWN;
    level[7][breite - 3] = TILE_BOSS_SPAWN;
    const mauern = Math.min(5, 2 + Math.floor(abschnitt / 2));
    const lueckeBreite = Math.max(2, 4 - Math.floor(abschnitt / 5));
    const obenMax = 12 - lueckeBreite + 1;         // die Luecke bleibt in den freien Reihen 2..12
    const freieReihe = () => 2 + ModiD.wuerfel(obenMax - 1);
    // Die Mauer geht ueber alle freien Reihen: eine Zeile, die in JEDEM Abschnitt offen
    // bleibt, waere die kostenlose Abkuerzung durch den ganzen Lauf. Die ersten beiden
    // Luecken liegen deshalb auseinander, als Paar sind sie in keiner Zeile offen.
    const erste = freieReihe();
    let zweite = freieReihe();
    for (let versuch = 0; versuch < 40 && Math.abs(zweite - erste) < lueckeBreite; versuch++) zweite = freieReihe();
    let lueckeOben = erste;
    for (let i = 0; i < mauern; i++) {
        const spalte = 11 + i * 7;
        if (i === 1) lueckeOben = zweite;
        else if (i > 1) lueckeOben = clamp(lueckeOben + ModiD.wuerfel(5) - 2, 2, obenMax);
        for (let y = 2; y <= 12; y++) {
            if (y >= lueckeOben && y < lueckeOben + lueckeBreite) continue;
            level[y][spalte] = TILE_WALL;
        }
    }
    return level;
}

// Gegner fuer den Endloslauf: bestehende Klassen, alle vor Mark, keiner als Boss
function D4Laufgegner(abschnitt) {
    const klassen = [];
    if (typeof Slime !== 'undefined') klassen.push(Slime);
    if (typeof AngryFruit !== 'undefined') klassen.push(AngryFruit);
    if (typeof WalkingMushroom !== 'undefined') klassen.push(WalkingMushroom);
    const vor = [];
    const p = Game.player;
    for (const f of (Game._floorTiles || [])) {
        if (p && f.x > p.x + 220 && f.x < Game.world.pixelWidth - 3 * TILE_SIZE) vor.push(f);
    }
    if (!klassen.length || !vor.length) return 0;
    const anzahl = Math.min(vor.length, 9, 3 + Math.floor(abschnitt / 2));
    for (let i = 0; i < anzahl; i++) {
        const f = vor[Math.floor(Math.random() * vor.length)];
        const e = new klassen[i % klassen.length](f.x, f.y);
        e.tempo = 1 + Math.min(0.6, abschnitt * 0.08);
        Game.enemies.push(e);
    }
    return anzahl;
}

// Der Schwung des Schneemannes landet ohne Schaden: der Kreis, der Schaden und das Beben
// stecken alle in _swipeHit (js/snowman.js:616), die Aushol-Bewegung laeuft weiter.
const D4KeinHieb = function () { };

// Geister fuer die Geisterjagd: sie steigen in der Naehe von Mark aus dem Boden
// (190 bis 330 px), damit das Kind sie sieht und ihnen eine Falle stellen kann.
function D4Geister(anzahl) {
    const klassen = [];
    if (typeof Ghost !== 'undefined') klassen.push(Ghost);
    if (typeof ShadowGhost !== 'undefined') klassen.push(ShadowGhost);
    const p = Game.player, fliesen = Game._floorTiles || [];
    if (!klassen.length || !p || !fliesen.length) return 0;
    let n = 0;
    for (let i = 0; i < anzahl * 24 && n < anzahl; i++) {
        const f = fliesen[Math.floor(Math.random() * fliesen.length)];
        const abstand = Math.hypot(f.x - p.x, f.y - p.y);
        if (abstand < 190 || abstand > 330) continue;
        const e = new klassen[n % klassen.length](f.x, f.y);
        Game.enemies.push(e);
        if (typeof FX !== 'undefined') FX.burst(f.x, f.y, ['#b26bff', '#ffffff'], 10, 110, 0.5, { kind: 'spark' });
        n++;
    }
    return n;
}

// Der "Zurueck"-Knopf und die Weltkarte geben den Modus ohne jeden Ende-Haken auf
// (js/main.js:392 und js/main.js:854 rufen Modes.zuruecksetzen). Auch dann muss die
// geliehene Extra-Ueberlagerung zurueck zum Spiel.
if (typeof Modes !== 'undefined' && typeof Modes.zuruecksetzen === 'function') {
    const D4Zuruecksetzen = Modes.zuruecksetzen;
    Modes.zuruecksetzen = function () {
        D4Chaos.aufraeumen();
        return D4Zuruecksetzen.call(this);
    };
}

// ══════════════════════════════════ 1) Autorennen ══════════════════════════════════
registerMode({
    id: 'autorennen',
    name: 'Autorennen',
    emoji: '🏎️',
    text: 'Rase mit dem Auto von Wimpel zu Wimpel und erreiche die Zielflagge.',
    frei: g => g.maxWorldUnlocked >= 3,
    hinweis: 'Erst Welt 3 schaffen.',
    wertung: 'zeit',
    start(g) {
        Modes.arena({ welt: 22, breite: 58, hoehe: 26, herzen: 6, zeitlimit: 150 });
        D4Inseln([[22, 4, 12, 3], [22, 19, 12, 3], [6, 11, 8, 3], [44, 11, 8, 3]]);
        const a = Modes.run.arena;
        const rute = [[0.15, 0.25], [0.8, 0.2], [0.82, 0.78], [0.2, 0.8]];
        const marken = rute.map(p => new D4Kulisse(a.x + a.w * p[0], a.y + a.h * p[1], 'wimpel'));
        marken.push(new D4Kulisse(a.x + a.w * 0.5, a.y + a.h * 0.5, 'ziel'));
        for (const m of marken) Game.projectiles.push(m);
        ModiD.rennen = { marken, nr: 0 };
        ModiD.meldung('Los! Zuerst der 1. Wimpel 🏁', '#c9f2ff');
    },
    update(dt) {
        const r = ModiD.rennen, g = Game, p = g.player;
        if (!r || !p || p.dead) return;
        // das Auto haelt die ganze Runde durch (main.js laedt es sonst nach fuenf Siegen neu auf)
        if (!p.autoActive) {
            p.hasAuto = true;
            p.autoReady = true;
            p.activateAuto();
        }
        // Der Wagen darf in einer Arena keinen Schritt fahren: main.js haelt das Auto aus dem
        // Boss-Bereich, und in der Arena ist die ganze Halle der Boss-Bereich (js/modes.js:351).
        // Also faehrt der Modus den Wagen selbst - Optik und doppeltes Tempo bleiben beim Auto.
        const fahrt = Input.direction;
        if (p.autoActive && (fahrt.x !== 0 || fahrt.y !== 0)) {
            p._moveWithCollision(fahrt.x * p.speed * dt, fahrt.y * p.speed * dt, g.world);
        }
        const m = ModiD.mitte();
        const ziel = r.marken[r.nr];
        if (!ziel || ziel.dead) return;
        if (Math.hypot(ziel.x - m.x, ziel.y - m.y) >= 48) return;
        ziel.erledigt = true;
        r.nr++;
        if (typeof FX !== 'undefined') FX.burst(ziel.x, ziel.y, ['#ffe38a', '#ffffff'], 12, 150, 0.6, { kind: 'star' });
        if (r.nr >= r.marken.length) {
            Modes.finish({ text: 'Im Ziel in ' + Modes.zeitText(Modes.zeit()) });
            return;
        }
        ModiD.meldung(r.marken[r.nr].art === 'ziel' ? 'Ab zur Zielflagge! 🏁'
            : 'Zum ' + (r.nr + 1) + '. Wimpel!', '#c9f2ff');
        Sound.powerUp();
    },
    onPlayerDeath(g) { ModiD.rennen = null; return Modes.finish({ text: 'Das Auto ist hin.' }); },
    onWorldClear(g) { return Modes.finish({ text: 'Runde geschafft.' }); },
    drawHud(ctx) {
        const r = ModiD.rennen;
        const zeilen = ['⏱ ' + Modes.zeitText(Modes.restzeit())];
        if (r) {
            const ziel = r.marken[r.nr];
            zeilen.push(ziel && ziel.art === 'ziel' ? '🏁 Ziel!' : '🚩 ' + Math.min(r.nr + 1, 4) + '/4');
        }
        Modes.hudStatus(ctx, zeilen);
    },
    belohnung(info) { return Math.round(clamp(420 - info.zeit * 2.2, 80, 420)); },
});

// ═════════════════════════════════ 2) Geisterjagd ══════════════════════════════════
registerMode({
    id: 'geisterjagd',
    name: 'Geisterjagd',
    emoji: '👻',
    text: 'Leg eine Falle aus und locke einen Geist hinein - eine Falle fängt genau einen.',
    frei: g => g.maxWorldUnlocked >= 5,
    hinweis: 'Erst Welt 5 schaffen.',
    wertung: 'punkte',
    start(g) {
        Modes.arena({ welt: 9, breite: 42, hoehe: 24, herzen: 6, dunkelheit: 0.5, zeitlimit: 120 });
        ModiD.jagd = { fallen: [], gefangen: 0, nachlegen: 0, nachschub: 1.4 };
        D4Geister(3);
        ModiD.meldung('E drückt: Falle auslegen 🪤', '#ffe38a');
    },
    update(dt) {
        const j = ModiD.jagd, g = Game, p = g.player;
        if (!j || !p || p.dead) return;
        // E ist hier der Fallenknopf: ohne Auto macht E an Mark selbst nichts
        p.hasAuto = false;
        // Nachschub: die Geruest-Wellen wuerfen die Geister an den fernen Rand der Halle.
        // Hier kommen sie in der Naehe von Mark heraus - das Kind sieht sie und kann jagen.
        j.nachschub -= dt;
        if (j.nachschub <= 0) {
            j.nachschub = 3.2;
            let frei = 0;
            for (const e of g.enemies) if (e && !e.dead && !e.isBoss) frei++;
            if (frei < 8) D4Geister(2);
        }
        j.nachlegen -= dt;
        if (Input.abilityPressed && j.nachlegen <= 0 && j.fallen.length < 3) {
            const f = new D4Kulisse(p.x + p.w / 2, p.y + p.h / 2 + 8, 'falle');
            f.ablauf = 16;
            g.projectiles.push(f);
            j.fallen.push(f);
            j.nachlegen = 2;
            Sound.chest();
            ModiD.meldung('Falle liegt!', '#c9ffb0');
        }
        for (let i = j.fallen.length - 1; i >= 0; i--) {
            const f = j.fallen[i];
            if (f.dead) { j.fallen.splice(i, 1); continue; }
            for (const e of g.enemies) {
                if (!e || e.dead || e.isBoss || typeof e.centerX !== 'function') continue;
                const d = Math.hypot(e.centerX() - f.x, e.centerY() - f.y);
                if (d > 300 || d < 1) continue;
                // Der Koeder lockt: ein Geist in Sichtweite wird zur Falle gezogen -
                // Geister treiben sonst nur langsam durch die Halle und waeren nie hineingeraten.
                if (d > f.radius * 0.8) {
                    e.x += (f.x - e.centerX()) / d * 110 * dt;
                    e.y += (f.y - e.centerY()) / d * 110 * dt;
                    continue;
                }
                f.erledigt = true;
                f.ablauf = 0.5;
                j.gefangen++;
                Modes.punkte(1);
                ModiD.einfangen(e);
                if (typeof FX !== 'undefined') {
                    FX.burst(f.x, f.y, ['#ffffff', e.color || '#b26bff', '#ffe38a'], 14, 150, 0.6, { kind: 'star' });
                    FX.text(f.x, f.y - 26, 'gefangen!', '#c9ffb0', 13);
                }
                Sound.powerUp();
                ModiD.meldung('Ein Geist im Netz! 👻 ' + j.gefangen, '#c9ffb0');
                break;
            }
        }
    },
    onPlayerDeath(g) {
        const j = ModiD.jagd;
        ModiD.jagd = null;
        return Modes.finish({ text: 'Mark kann nicht mehr jagen.', punkte: j ? j.gefangen : 0 });
    },
    onWorldClear(g) { return Modes.finish({ text: 'Kein Geist mehr übrig.' }); },
    drawHud(ctx) {
        const j = ModiD.jagd;
        Modes.hudStatus(ctx, j ? ['👻 ' + j.gefangen, '🪤 ' + j.fallen.length + '/3',
            '⏱ ' + Modes.zeitText(Modes.restzeit())] : Modes.statusText());
    },
    belohnung(info) { return Math.round(clamp(50 + info.punkte * 22, 50, 380)); },
});

// ═════════════════════════════════ 3) Endloslauf ═══════════════════════════════════
// Bahn fuer den Endloslauf: ein Abschnitt nach dem anderen. Der erste startet eine echte
// Welt (Ausruestung, Begleiter, Kamera), jeder weitere legt nur eine neue Bahn darueber.
ModiD.neuerAbschnitt = function () {
    const l = ModiD.lauf;
    if (!l) return false;
    if (!l.startiert) {
        Modes.starteWelt({ welt: 21, herzen: 6 });
        l.startiert = true;
    }
    const g = Game, w = g.world, p = g.player;
    if (!w || !p) return false;
    l.abschnitt++;
    w.load(D4Bahn(l.abschnitt));
    Modes.merkeBoden();
    g.enemies.length = 0;
    g.projectiles.length = 0;
    g.chests.length = 0;
    g.keyDrops.length = 0;
    g.coinDrops.length = 0;
    g.props.length = 0;
    g.hasKey = false;
    g.bossActive = false;
    g.bossDefeated = false;
    p.hasAuto = false;
    p.activeWeapon = new D4Stumm();
    p.rangedWeapon = null;
    p.facingAngle = 0;
    p.x = w.spawnPoint.x - p.w / 2;
    p.y = w.spawnPoint.y - p.h / 2;
    for (let i = 0; i < g.companions.length; i++) {
        const c = g.companions[i];
        c.x = clamp(w.spawnPoint.x - 44 - i * 26, TILE_SIZE, w.pixelWidth - TILE_SIZE);
        c.y = clamp(w.spawnPoint.y + 14, TILE_SIZE, w.pixelHeight - TILE_SIZE);
    }
    D4Laufgegner(l.abschnitt);
    g.camera.x = clamp(p.x + p.w / 2 - g.viewW / 2, 0, Math.max(0, w.pixelWidth - g.viewW));
    g.camera.y = clamp(p.y + p.h / 2 - g.viewH / 2, 0, Math.max(0, w.pixelHeight - g.viewH));
    g.camera.clampTo(w.pixelWidth, w.pixelHeight);
    l.xVorher = p.x;
    l.stall = 0;
    l.tempo = 168 + Math.min(90, l.abschnitt * 8);
    if (l.abschnitt > 0) {
        ModiD.meldung('Abschnitt ' + (l.abschnitt + 1) + '! 🚧', '#c9f2ff');
        if (typeof FX !== 'undefined') FX.screenFlash('#ffffff', 0.2);
    }
    return true;
};

// Ein Bild laufen lassen: Mark nach vorn, Strecke zaehlen, Ende pruefen.
ModiD.laufUpdate = function (dt) {
    const l = ModiD.lauf, g = Game, w = g.world, p = g.player;
    if (!l || !w || !p || p.dead) return;
    if (!p.activeWeapon || p.activeWeapon.type !== 'none') p.activeWeapon = new D4Stumm();
    p.facingAngle = 0;
    // Mark rennt immer nach vorn: die Waagerechte kommt vom Modus, die Senkrechte von ihm
    const schub = (l.xVorher + l.tempo * dt) - p.x;
    if (Math.abs(schub) > 0.05) p._moveWithCollision(schub, 0, w);
    const gelaufen = p.x - l.xVorher;
    l.xVorher = p.x;
    l.meter = Math.max(l.meter, Math.round((l.abschnitt * 41 + (p.x - 2 * TILE_SIZE)) / TILE_SIZE));
    if (Modes.run) Modes.run.punkte = l.meter;
    // Steckt er in eine Wand (Luecke verfehlt), endet der Lauf - so endet ein Lauf eben.
    if (gelaufen < 0.4) {
        l.stall += dt;
        if (l.stall > 0.75) return Modes.finish({ text: 'Angelaufen nach ' + l.meter + ' m.', punkte: l.meter });
    } else l.stall = 0;
    if (p.x > (w.width - 5) * TILE_SIZE) ModiD.neuerAbschnitt();
};

registerMode({
    id: 'endloslauf',
    name: 'Endloslauf',
    emoji: '🏃',
    text: 'Mark rennt immer weiter nach vorn - du weichst nur aus. Ein Punkt ist ein Meter.',
    frei: g => g.maxWorldUnlocked >= 2,
    hinweis: 'Erst Welt 2 schaffen.',
    wertung: 'punkte',
    start(g) {
        ModiD.lauf = { abschnitt: -1, startiert: false, xVorher: 0, stall: 0, meter: 0, tempo: 168 };
        ModiD.neuerAbschnitt();
        ModiD.meldung('Ausweichen: hoch und runter! 🏃', '#c9f2ff');
    },
    update(dt) { ModiD.laufUpdate(dt); },
    onPlayerDeath(g) {
        const l = ModiD.lauf;
        ModiD.lauf = null;
        return Modes.finish({ text: 'Nach ' + (l ? l.meter : 0) + ' m ist Schluss.', punkte: l ? l.meter : 0 });
    },
    drawHud(ctx) {
        const l = ModiD.lauf;
        Modes.hudStatus(ctx, l ? ['📏 ' + l.meter + ' m', '🚧 Abschnitt ' + (l.abschnitt + 1),
            '❤️ ' + Math.max(0, Math.ceil(Game.player.hp / 4))] : Modes.statusText());
    },
    belohnung(info) { return Math.round(clamp(50 + info.punkte * 1.2, 50, 320)); },
});

// ═════════════════════════════════ 4) Mega-Bosse ═══════════════════════════════════
// Alte Bosse aus den Welten, jeder mit doppelten Herzen und deutlich schneller.
// Die Klassen werden erst im Aufruf gelesen (sie kommen aus js/entities.js und -2.js).
const D4MegaBosse = [
    { name: 'Boss-Gespenst', K: () => BossGhost },
    { name: 'Boss-Schleim', K: () => BossSlime },
    { name: 'Boss-Ritterfledermaus', K: () => BossKnightBat },
    { name: 'Riesenpilz', K: () => BossMushroomGiant },
    { name: 'Mücken-Boss', K: () => BossMosquito },
    { name: 'Schneeeule', K: () => BossSnowEagle },
    { name: 'Feuer-Phönix', K: () => BossFirePhoenix },
    { name: 'Schattenmeister', K: () => BossShadowMaster },
    { name: 'Skelettreiter', K: () => BossSkeletonRider },
    { name: 'Hydra', K: () => BossHydra },
];

function D4MegaKlasse(nr) {
    const e = D4MegaBosse[((nr % D4MegaBosse.length) + D4MegaBosse.length) % D4MegaBosse.length];
    try {
        const K = e && typeof e.K === 'function' ? e.K() : null;
        return typeof K === 'function' ? K : null;
    } catch (err) { return null; }
}

// Boss rufen und mega machen: doppelte Herzen, schneller, mit Anlaufzeit des Geruests
function D4MegaRuf(nr) {
    const g = Game;
    const K = D4MegaKlasse(nr);
    if (!K || !Modes.run) return null;
    // Ein besiegter oder ausgewechselter Boss darf nicht zweimal zaehlen
    g.enemies = g.enemies.filter(e => !(e && e.isBoss));
    g.epicFreezeActive = false;
    g.epicFreezeBoss = null;
    g.epicFreezeTimer = 0;
    g.bossActive = false;
    g.bossDefeated = false;
    if (!Modes.bossReihe([K])) return null;
    const boss = g.enemies.find(e => e && e.isBoss && !e.dead);
    if (!boss) return null;
    boss.maxHp = Math.max(20, Math.round((boss.maxHp || 40) * 2));
    boss.hp = boss.maxHp;
    // Der doppelte Lebensfaktor muss auch in den Merker der zentralen Boss-Staerke (js/main.js
    // bossStarke): Bosse, die ihr Leben spaeter selbst neu setzen (Verwandlung, Phase 2 - heute
    // nur der Vampir, und der steht in keiner Mega-Auswahl), rechnen sonst mit dem einfachen
    // Faktor zurueck und waeren nach der Verwandlung halbvoll, obwohl sie mega sind. Sicherungs-
    // zeile: zieht erst, wenn ein solcher Boss in die Auswahl kommt.
    boss._g1BossSkala = (boss._g1BossSkala || BOSS_HP) * 2;
    boss.tempo = (typeof BOSS_TEMPO === 'number' ? BOSS_TEMPO : 1) * 1.55;
    boss.isMega = true;
    ModiD.mega = { nr, boss, name: (D4MegaBosse[nr] && D4MegaBosse[nr].name) || boss.constructor.name };
    return boss;
}

registerMode({
    id: 'mega-bosse',
    name: 'Mega-Bosse',
    emoji: '👹',
    text: 'Ein alter Boss mit doppelt so vielen Herzen und viel schneller - E ist ein anderer Boss.',
    frei: g => g.maxWorldUnlocked >= 12,
    hinweis: 'Erst Welt 12 schaffen.',
    wertung: 'zeit',
    start(g) {
        ModiD.mega = null;
        // 600 s statt 300 s: seit den schwereren Bossen (3,2-mal Leben, 2,1-mal zaeh) braucht der
        // laengste Mega-Boss 386 bis 410 s, wenn Mark durch den Raum laeuft und nur trifft, wenn er
        // drankommt (klebend am Boss 102 s; Messung aller zehn Bosse in ERGEBNIS-3). Mit 300 s waren
        // sieben von zehn Bossen nicht mehr zu schaffen - daher doppelte Frist: sicher zu schaffen.
        Modes.arena({ welt: 12, breite: 48, hoehe: 26, herzen: 8, zeitlimit: 600 });
        const nr = ModiD.wuerfel(D4MegaBosse.length) - 1;
        D4MegaRuf(nr);
        if (Game.player) Game.player.hasAuto = false;
        ModiD.meldung('E drückt: anderer Boss 👹', '#ffd0d0');
    },
    update(dt) {
        const m = ModiD.mega, p = Game.player;
        if (!m || !p || p.dead) return;
        p.hasAuto = false;
        if (!Input.abilityPressed) return;
        if (D4MegaRuf((m.nr + 1) % D4MegaBosse.length)) ModiD.meldung('Anderer Boss: ' + ModiD.mega.name + ' 👹', '#ffd0d0');
    },
    onPlayerDeath(g) { return Modes.finish({ text: 'Der Mega-Boss war zu stark.' }); },
    onWorldClear(g) { return Modes.finish({ text: ModiD.mega ? ModiD.mega.name + ' fällt um!' : 'Der Mega-Boss fällt um!' }); },
    drawHud(ctx) {
        const m = ModiD.mega;
        Modes.hudStatus(ctx, ['⏱ ' + Modes.zeitText(Modes.zeit())].concat(
            m && m.boss && !m.boss.dead ? ['💗 ' + Math.max(0, Math.ceil(m.boss.hp)), '👹 x2'] : ['👹 x2']));
    },
    belohnung(info) { return Math.round(clamp(500 - info.zeit * 2.5, 120, 500)); },
});

// ══════════════════════════════ 5) Upgrade-Chaos ═══════════════════════════════════
registerMode({
    id: 'upgrade-chaos',
    name: 'Upgrade-Chaos',
    emoji: '🎲',
    text: 'Jede Runde bekommt jede Figur ein zufälliges Extra - auch eins, das du gar nicht hast.',
    frei: g => g.maxWorldUnlocked >= 8,
    hinweis: 'Erst Welt 8 schaffen.',
    wertung: 'punkte',
    start(g) {
        ModiD.chaos = null;
        const hoch = clamp(+g.maxWorldUnlocked || 8, 8, LAST_WORLD);
        const welt = clamp(8 + ModiD.wuerfel(Math.max(1, hoch - 7)), 8, LAST_WORLD);
        const liste = D4Chaos.verteilen(welt);
        ModiD.chaos = { getroffen: 0, liste, welt };
        Modes.starteWelt({ welt, herzen: 6 });
        ModiD.meldung('Chaos-Extras sind nur für diese Runde geliehen 🎲', '#e2c8ff');
    },
    update(dt) {
        const c = ModiD.chaos;
        if (!c) return;
        for (const e of Game.enemies) {
            if (!e || !e.dead || e.d4gezahlt || e.isBoss) continue;
            e.d4gezahlt = true;
            c.getroffen++;
        }
        if (Modes.run) Modes.run.punkte = c.getroffen;
    },
    onPlayerDeath(g) {
        const c = ModiD.chaos;
        D4Chaos.aufraeumen();
        return Modes.finish({ text: 'Die Extras haben nicht gereicht.', punkte: c ? c.getroffen : 0 });
    },
    onWorldClear(g) {
        const c = ModiD.chaos;
        D4Chaos.aufraeumen();
        return Modes.finish({ text: 'Welt ' + (c ? c.welt : '') + ' geschafft - mit geliehenen Extras.',
            punkte: c ? c.getroffen : 0 });
    },
    drawHud(ctx) {
        const c = ModiD.chaos;
        const zeilen = ['🎯 ' + (c ? c.getroffen : 0)];
        if (c && c.liste) {
            for (const p of c.liste) zeilen.push(p.emoji + ' ' + ModiD.kurz(p.u.name, 11));
        }
        Modes.hudStatus(ctx, zeilen);
    },
    belohnung(info) { return Math.round(clamp(50 + info.punkte * 3, 50, 280)); },
});

// ═════════════════════════════ 6) Schneeballschlacht ═══════════════════════════════
registerMode({
    id: 'schneeballschlacht',
    name: 'Schneeballschlacht',
    emoji: '⛄',
    text: 'Alle werfen nur Schneebälle: Mark, seine Freunde und die Schneemänner.',
    frei: g => g.maxWorldUnlocked >= 4,
    hinweis: 'Erst Welt 4 schaffen.',
    wertung: 'punkte',
    start(g) {
        Modes.arena({ welt: 12, thema: 'snowman', breite: 46, hoehe: 24, herzen: 6, zeitlimit: 120 });
        ModiD.schnee = { werfer: new D4SchneeWerfer(), treffer: 0 };
        const p = Game.player;
        p.activeWeapon = ModiD.schnee.werfer;
        p.rangedWeapon = ModiD.schnee.werfer;
        p.hasAuto = false;
        Modes.dauerwellen({ gegner: [Snowman], pro: 2, interval: 5, maxLeben: 9 });
        ModiD.meldung('Schneebälle fliegen! ❄️', '#c9f2ff');
    },
    update(dt) {
        const s = ModiD.schnee, g = Game, p = g.player;
        if (!s || !p || p.dead) return;
        // Der Waffenwechsel-Knopf darf den Werfer nicht austauschen
        if (p.activeWeapon !== s.werfer) p.activeWeapon = s.werfer;
        // Die Schneemaenner werfen nur Schnee: kein Beruehrungsschaden, kein Astarm
        const schnee = typeof Snowman !== 'undefined';
        for (const e of g.enemies) {
            if (!e || e.d4schnee || !schnee || !(e instanceof Snowman)) continue;
            e.d4schnee = true;
            e.contactDamage = false;
            e.damage = 0;
            // Der Armschwung zieht seinen Schaden aus eigener Rechnung (js/snowman.js:615:
            // SnowmanArt.areaHit(..., 2, ...)) - weder contactDamage noch damage begrenzen ihn.
            // Hier bleibt die Aushol-Bewegung, nur der Schlag ins Leere.
            e._swipeHit = D4KeinHieb;
        }
        // Freunde: eigene Waffe aus, dafuer Schneebaelle
        for (const c of g.companions) {
            if (!c || c.dead || c.koTimer > 0) continue;
            if (typeof c.damage === 'number') c.damage = 0;
            if (typeof c.attackTimer === 'number' && c.attackTimer < 900) c.attackTimer = 900;
            if (typeof c.shootTimer === 'number' && c.shootTimer < 900) c.shootTimer = 900;
            if (typeof c.spitTimer === 'number' && c.spitTimer < 900) c.spitTimer = 900;
            let t = c.d4wurf;
            if (typeof t !== 'number') t = Math.random() * 0.6;
            t -= dt;
            if (t <= 0) {
                t = 0.9;
                const ziel = ModiD.naechsterGegner(c.centerX(), c.centerY(), 320);
                if (ziel) {
                    const a = angleBetween({ x: c.centerX(), y: c.centerY() },
                        { x: ziel.centerX(), y: ziel.centerY() });
                    g.projectiles.push(new D4Schnee(c.centerX(), c.centerY() - 6, a, 300, 2));
                }
            }
            c.d4wurf = t;
        }
        // Zaehlen: besiegte Schneemaenner sind die Punkte
        for (const e of g.enemies) {
            if (!e || !e.dead || e.d4gezahlt) continue;
            e.d4gezahlt = true;
            s.treffer++;
        }
        if (Modes.run) Modes.run.punkte = s.treffer;
    },
    onPlayerDeath(g) {
        const s = ModiD.schnee;
        ModiD.schnee = null;
        return Modes.finish({ text: 'Mark ist eingeschneit.', punkte: s ? s.treffer : 0 });
    },
    onWorldClear(g) {
        const s = ModiD.schnee;
        ModiD.schnee = null;
        return Modes.finish({ text: 'Die Arena ist leer gefegt.', punkte: s ? s.treffer : 0 });
    },
    drawHud(ctx) {
        const s = ModiD.schnee;
        Modes.hudStatus(ctx, s ? ['❄️ ' + s.treffer, '⛄ ' + ModiD.lebendeSchneemaenner(),
            '⏱ ' + Modes.zeitText(Modes.restzeit())] : Modes.statusText());
    },
    belohnung(info) { return Math.round(clamp(50 + info.punkte * 9, 50, 300)); },
});

ModiD.lebendeSchneemaenner = function () {
    const schnee = typeof Snowman !== 'undefined';
    let n = 0;
    for (const e of Game.enemies) {
        if (e && !e.dead && schnee && e instanceof Snowman) n++;
    }
    return n;
};
