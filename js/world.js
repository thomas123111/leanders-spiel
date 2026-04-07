// ── World / Level System ──

const TILE_SIZE = 32;

// Tile types
const TILE_EMPTY = 0;
const TILE_WALL = 1;
const TILE_FLOOR = 2;
const TILE_DOOR = 3;
const TILE_BOSS_DOOR = 4;
const TILE_WINDOW = 5;
const TILE_SPAWN = 6;
const TILE_BOSS_SPAWN = 7;

class World {
    constructor() {
        this.tiles = [];
        this.width = 0;
        this.height = 0;
        this.pixelWidth = 0;
        this.pixelHeight = 0;
        this.spawnPoint = { x: 0, y: 0 };
        this.bossSpawn = { x: 0, y: 0 };
        this.bossDoorTiles = [];
        this.bossDoorOpen = false;
        this.enemySpawns = [];
        this.chestPositions = [];
        this.colorTimer = 0;
        this.bgHue = 270; // purple
    }

    load(levelData) {
        this.tiles = levelData;
        this.height = levelData.length;
        this.width = levelData[0].length;
        this.pixelWidth = this.width * TILE_SIZE;
        this.pixelHeight = this.height * TILE_SIZE;
        this.bossDoorTiles = [];
        this.enemySpawns = [];
        this.chestPositions = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const t = this.tiles[y][x];
                if (t === TILE_SPAWN) {
                    this.spawnPoint = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
                    this.tiles[y][x] = TILE_FLOOR;
                }
                if (t === TILE_BOSS_SPAWN) {
                    this.bossSpawn = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
                    this.tiles[y][x] = TILE_FLOOR;
                }
                if (t === TILE_BOSS_DOOR) {
                    this.bossDoorTiles.push({ x, y });
                }
            }
        }
    }

    openBossDoor() {
        this.bossDoorOpen = true;
        for (const pos of this.bossDoorTiles) {
            this.tiles[pos.y][pos.x] = TILE_DOOR;
        }
    }

    isWall(px, py) {
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
        const t = this.tiles[ty][tx];
        return t === TILE_WALL || t === TILE_BOSS_DOOR;
    }

    collideRect(rect) {
        // Check all tiles the rect overlaps
        const left = Math.floor(rect.x / TILE_SIZE);
        const top = Math.floor(rect.y / TILE_SIZE);
        const right = Math.floor((rect.x + rect.w - 1) / TILE_SIZE);
        const bottom = Math.floor((rect.y + rect.h - 1) / TILE_SIZE);

        const collisions = [];
        for (let ty = top; ty <= bottom; ty++) {
            for (let tx = left; tx <= right; tx++) {
                if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) {
                    collisions.push({ x: tx * TILE_SIZE, y: ty * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
                    continue;
                }
                const t = this.tiles[ty][tx];
                if (t === TILE_WALL || t === TILE_BOSS_DOOR) {
                    collisions.push({ x: tx * TILE_SIZE, y: ty * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
                }
            }
        }
        return collisions;
    }

    update(dt) {
        // Color cycling for ghost castle
        this.colorTimer += dt;
        if (this.colorTimer > 8) {
            this.colorTimer = 0;
            this.bgHue = (this.bgHue + randInt(30, 60)) % 360;
        }
    }

    draw(ctx, camera) {
        const startX = Math.max(0, Math.floor(camera.x / TILE_SIZE));
        const startY = Math.max(0, Math.floor(camera.y / TILE_SIZE));
        const endX = Math.min(this.width, Math.ceil((camera.x + camera.width) / TILE_SIZE) + 1);
        const endY = Math.min(this.height, Math.ceil((camera.y + camera.height) / TILE_SIZE) + 1);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const t = this.tiles[y][x];
                const pos = camera.worldToScreen(x * TILE_SIZE, y * TILE_SIZE);

                if (t === TILE_WALL) {
                    ctx.fillStyle = `hsl(${this.bgHue}, 20%, 25%)`;
                    ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
                    // brick pattern
                    ctx.strokeStyle = `hsl(${this.bgHue}, 15%, 20%)`;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
                } else if (t === TILE_FLOOR || t === TILE_DOOR || t === TILE_SPAWN || t === TILE_BOSS_SPAWN) {
                    ctx.fillStyle = `hsl(${this.bgHue}, 15%, 40%)`;
                    ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
                    // subtle tile lines
                    ctx.strokeStyle = `hsl(${this.bgHue}, 10%, 35%)`;
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
                } else if (t === TILE_BOSS_DOOR) {
                    ctx.fillStyle = '#8B0000';
                    ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
                    // lock icon
                    ctx.fillStyle = '#FFD700';
                    ctx.fillRect(pos.x + 12, pos.y + 8, 8, 10);
                    ctx.beginPath();
                    ctx.arc(pos.x + 16, pos.y + 10, 6, Math.PI, 0);
                    ctx.strokeStyle = '#FFD700';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                } else if (t === TILE_WINDOW) {
                    ctx.fillStyle = `hsl(${this.bgHue}, 20%, 25%)`;
                    ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = `hsl(200, 40%, 60%)`;
                    ctx.fillRect(pos.x + 6, pos.y + 6, 20, 20);
                    ctx.strokeStyle = `hsl(${this.bgHue}, 15%, 20%)`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(pos.x + 16, pos.y + 6);
                    ctx.lineTo(pos.x + 16, pos.y + 26);
                    ctx.moveTo(pos.x + 6, pos.y + 16);
                    ctx.lineTo(pos.x + 26, pos.y + 16);
                    ctx.stroke();
                }
            }
        }
    }
}

// ── Level Data for World 1: Ghost Castle ──

const WORLD1_LEVEL = (function() {
    const W = TILE_WALL, F = TILE_FLOOR, D = TILE_DOOR, B = TILE_BOSS_DOOR;
    const S = TILE_SPAWN, BS = TILE_BOSS_SPAWN, WN = TILE_WINDOW;

    // 30x30 castle layout
    return [
        // Row 0-1: Top wall
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 2-7: Entrance hall (bottom-left area)
        [W,W,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,F,S,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,WN,F,F,F,F,F,F,D,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,F,F,F,F,F,F,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,F,F,F,F,F,F,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 8-14: Main corridor + side rooms
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,D,F,F,F,F,F,F,F,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,F,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,F,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,WN,F,W,W,W,W,W],
        // Row 15-19: Lower corridor to Key Ghost room + treasure room
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,F,F,F,F,F,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,WN,F,F,F,F,F,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,F,F,F,F,F,W,W,W],
        // Row 20-24: Boss antechamber + corridor
        [W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,D,F,F,F,F,F,F,F,F,F,F,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,F,F,F,F,F,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,B,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 23-28: Boss room
        [W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,F,F,WN,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,F,F,F,F,BS,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,F,F,WN,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    ];
})();
