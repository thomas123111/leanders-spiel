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
        this.theme = 'castle'; // 'castle', 'factory', 'cave'
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
        this.colorTimer += dt;
        if (this.theme === 'castle') {
            // Color cycling for ghost castle
            if (this.colorTimer > 8) {
                this.colorTimer = 0;
                this.bgHue = (this.bgHue + randInt(30, 60)) % 360;
            }
        } else if (this.theme === 'factory') {
            // Blue-gray industrial, no cycling
            this.bgHue = 200;
        } else if (this.theme === 'cave') {
            // Greenish with slight pulse
            this.bgHue = 120 + Math.sin(this.colorTimer * 0.5) * 10;
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

                if (this.theme === 'factory') {
                    this._drawFactory(ctx, t, pos, x, y);
                } else if (this.theme === 'cave') {
                    this._drawCave(ctx, t, pos, x, y);
                } else {
                    this._drawCastle(ctx, t, pos, x, y);
                }
            }
        }
    }

    _drawCastle(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = `hsl(${this.bgHue}, 20%, 25%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = `hsl(${this.bgHue}, 15%, 20%)`;
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (t === TILE_FLOOR || t === TILE_DOOR || t === TILE_SPAWN || t === TILE_BOSS_SPAWN) {
            ctx.fillStyle = `hsl(${this.bgHue}, 15%, 40%)`;
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = `hsl(${this.bgHue}, 10%, 35%)`;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (t === TILE_BOSS_DOOR) {
            this._drawBossDoor(ctx, pos);
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

    _drawFactory(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = '#3A3A44';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // metallic panel lines
            ctx.strokeStyle = '#2E2E36';
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
            // rivets in corners
            ctx.fillStyle = '#50505A';
            ctx.beginPath();
            ctx.arc(pos.x + 4, pos.y + 4, 1.5, 0, Math.PI * 2);
            ctx.arc(pos.x + TILE_SIZE - 4, pos.y + 4, 1.5, 0, Math.PI * 2);
            ctx.arc(pos.x + 4, pos.y + TILE_SIZE - 4, 1.5, 0, Math.PI * 2);
            ctx.arc(pos.x + TILE_SIZE - 4, pos.y + TILE_SIZE - 4, 1.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (t === TILE_FLOOR || t === TILE_DOOR || t === TILE_SPAWN || t === TILE_BOSS_SPAWN) {
            ctx.fillStyle = '#5A5A64';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // rivet dots on floor
            ctx.fillStyle = '#4A4A54';
            ctx.beginPath();
            ctx.arc(pos.x + 16, pos.y + 16, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#505058';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (t === TILE_BOSS_DOOR) {
            this._drawBossDoor(ctx, pos);
        } else if (t === TILE_WINDOW) {
            // Factory window showing machinery
            ctx.fillStyle = '#3A3A44';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#1A2A3A';
            ctx.fillRect(pos.x + 5, pos.y + 5, 22, 22);
            // gear silhouette inside window
            ctx.strokeStyle = '#4A6A7A';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pos.x + 16, pos.y + 16, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(pos.x + 16, pos.y + 16, 2, 0, Math.PI * 2);
            ctx.stroke();
            // frame
            ctx.strokeStyle = '#50505A';
            ctx.lineWidth = 2;
            ctx.strokeRect(pos.x + 5, pos.y + 5, 22, 22);
        }
    }

    _drawCave(ctx, t, pos, x, y) {
        if (t === TILE_WALL) {
            ctx.fillStyle = '#3D2E1A';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // rough earth texture lines
            ctx.strokeStyle = '#332616';
            ctx.lineWidth = 1;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
            // earthy speckles
            ctx.fillStyle = '#4A3820';
            ctx.fillRect(pos.x + 5, pos.y + 10, 3, 2);
            ctx.fillRect(pos.x + 20, pos.y + 6, 2, 3);
            ctx.fillRect(pos.x + 12, pos.y + 22, 3, 2);
        } else if (t === TILE_FLOOR || t === TILE_DOOR || t === TILE_SPAWN || t === TILE_BOSS_SPAWN) {
            ctx.fillStyle = '#4A5A3A';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // muddy texture
            ctx.strokeStyle = '#3E4E30';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(pos.x + 0.5, pos.y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (t === TILE_BOSS_DOOR) {
            this._drawBossDoor(ctx, pos);
        } else if (t === TILE_WINDOW) {
            // Glowing crystal formation
            ctx.fillStyle = '#3D2E1A';
            ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
            // crystal glow
            const glow = 0.5 + Math.sin(this.colorTimer * 2) * 0.3;
            ctx.fillStyle = `rgba(100, 255, 180, ${glow * 0.3})`;
            ctx.fillRect(pos.x + 4, pos.y + 4, 24, 24);
            // crystal shards
            ctx.fillStyle = `rgba(100, 255, 180, ${glow})`;
            ctx.beginPath();
            ctx.moveTo(pos.x + 10, pos.y + 24);
            ctx.lineTo(pos.x + 13, pos.y + 8);
            ctx.lineTo(pos.x + 16, pos.y + 24);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(pos.x + 16, pos.y + 26);
            ctx.lineTo(pos.x + 20, pos.y + 10);
            ctx.lineTo(pos.x + 24, pos.y + 26);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(pos.x + 6, pos.y + 26);
            ctx.lineTo(pos.x + 8, pos.y + 14);
            ctx.lineTo(pos.x + 12, pos.y + 26);
            ctx.fill();
        }
    }

    _drawBossDoor(ctx, pos) {
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(pos.x, pos.y, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(pos.x + 12, pos.y + 8, 8, 10);
        ctx.beginPath();
        ctx.arc(pos.x + 16, pos.y + 10, 6, Math.PI, 0);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
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

// ── Level Data for World 2: Roboter-Küken Factory ──

const WORLD2_LEVEL = (function() {
    const W = TILE_WALL, F = TILE_FLOOR, D = TILE_DOOR, B = TILE_BOSS_DOOR;
    const S = TILE_SPAWN, BS = TILE_BOSS_SPAWN, WN = TILE_WINDOW;

    // 35x30 factory layout
    return [
        // Row 0: Top wall
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 1
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 2-6: Entry room (top-left)
        [W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,WN,F,F,S,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,F,F,F,F,F,F,F,D,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,WN,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 7-8: Conveyor belt corridor
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 9-16: Assembly room (large open area)
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,F,F,F,F,F,F,WN,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,F,F,F,F,F,F,WN,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,D,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 17-20: Side storage rooms + corridor
        [W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,F,F,F,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W],
        [W,W,W,W,W,WN,F,F,F,F,F,D,F,F,F,F,F,F,F,F,F,F,F,D,F,F,F,F,F,WN,W,W,W,W],
        [W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,F,F,F,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 21-22: Boss antechamber corridor
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,B,B,B,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 23-28: Boss arena (large 10x10 open space)
        [W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,F,F,F,F,WN,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,BS,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,F,F,F,F,WN,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 29: Bottom wall
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    ];
})();

// ── Level Data for World 3: Schleim-Arena ──

const WORLD3_LEVEL = (function() {
    const W = TILE_WALL, F = TILE_FLOOR, D = TILE_DOOR, B = TILE_BOSS_DOOR;
    const S = TILE_SPAWN, BS = TILE_BOSS_SPAWN, WN = TILE_WINDOW;

    // 32x28 cave/arena layout
    return [
        // Row 0-1: Top wall
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 2-5: Cave entrance (organic shape)
        [W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,F,F,F,S,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,F,F,F,F,F,F,D,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,F,F,F,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 6-8: Narrow tunnel
        [W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 9-13: First arena room (rounded)
        [W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,D,F,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W,W],
        // Row 14-15: Connecting corridor
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,W,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,W,W,W,W,W,W,W,W,W,W,W],
        // Row 16-19: Second arena + treasure alcoves
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,WN,F,F,F,F,F,F,F,F,F,WN,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,W,W,W,W,W,W,W],
        // Row 20: Treasure alcoves branching off
        [W,W,WN,F,F,F,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,F,F,WN,W],
        [W,W,W,F,F,F,D,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,D,F,F,W,W],
        [W,W,WN,F,F,F,W,W,W,W,W,W,W,W,W,W,W,W,W,B,W,W,W,W,W,W,W,W,F,F,WN,W],
        // Row 23-26: Boss pit (large circular-ish)
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,W,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,WN,F,F,F,BS,F,F,F,WN,W,W,W,W,W,W,W,W],
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,F,F,F,F,F,F,F,W,W,W,W,W,W,W,W,W],
        // Row 27: Bottom wall
        [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    ];
})();
